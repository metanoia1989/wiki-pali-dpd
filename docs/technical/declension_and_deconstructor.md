# 变格表生成与复合词拆解原理

## 一、变格表（Declension）生成原理

### 概述

DPD 的变格表生成采用 **模板驱动** 的方式。编纂者在 Excel 中维护一套巴利语变格/变位模板，构建系统为每个词匹配对应的模板，批量生成 HTML 变格表。

### 1.1 涉及的数据文件

| 文件 | 说明 |
|------|------|
| `db/inflections/inflection_templates.xlsx` | 变格变位模板 Excel（包含 index 和 declensions 两个工作表） |
| `shared_data/headword_stem_pattern_dict` | 词干-模板映射 pickle 缓存（增量更新用） |
| `shared_data/changed_templates` | 已变更模板列表 pickle 缓存 |

### 1.2 涉及的代码文件

| 文件 | 作用 |
|------|------|
| `db/inflections/create_inflection_templates.py` | 从 Excel 读取模板，序列化为 JSON 存入数据库 |
| `db/inflections/generate_inflection_tables.py` | 为每个词头匹配模板，生成变格 HTML 表和词形列表 |
| `db/models.py`（InflectionTemplates 类） | ORM 模型，存储模板数据 |
| `tools/pos.py` | 定义 DECLENSIONS（变格词性）和 CONJUGATIONS（变位词性）列表 |

### 1.3 数据模型

InflectionTemplates 表结构：

| 列名 | 类型 | 说明 |
|------|------|------|
| `pattern` | TEXT (PK) | 模板名称，如 `masc__a`、`fem__ī`、`nt__a` |
| `like` | TEXT | 参考模板名（显示用，如 "like masc__a"），或 `irreg` 表示不规则 |
| `data` | TEXT | JSON 嵌套列表：`list[[row[[cell]]]]` |

数据结构的层级：

```
data = [
  [ [""], ["Sing."], [""],   ["Pl."],   [""]   ],  ← row 0: 表头
  [ ["Nom"], ["o"], ["masc o"], ["ā"], ["masc ā"] ],  ← row 1: 奇数行 = 变格后缀
  [ [""],   [""],  [""],      [""],  [""]   ],  ← row 2: 偶数行 > 0 = 语法注释
  [ ["Acc"], ["aṃ"], ["masc aṃ"], ["e"], ["masc e"] ],
  [ [""],   [""],  [""],      [""],  [""]   ],
  [ ["Instr"], ["ena"], ["masc ena"], ["ehi"], ["masc ehi"] ],
  ...
]
```

- 列 0：语法标记（Nom, Acc, Instr...）
- 奇数列（1, 3, 5...）：**变格后缀**
- 偶数列（2, 4, 6...）：HTML title 属性的语法注释

### 1.4 Excel 模板文件结构

`inflection_templates.xlsx` 包含两个工作表：

**① sheet "index"**

| pattern | cell_range | like |
|---------|-----------|------|
| `masc__a` | `B3:F10` | `masc__a` |
| `fem__ā` | `B12:F19` | `masc__a` |
| `nt__a` | `B21:F28` | `masc__a` |
| `verb__pr` | ... | ... |
| `irreg__as` | ... | `irreg` |

- `pattern`：模板名称，命名规则 `词性__词干类型`，如 `masc__a` = 阳性 -a 词干
- `cell_range`：数据在 declensions 表中的位置
- `like`：参考模板名；`irreg` 标记不规则变格

**② sheet "declensions"**

一个巨大的二维网格（约 200+ 列 × 100+ 行），所有变格模板分布在不同的单元格区域中，每个区域由 index 表中的 cell_range 定位。

### 1.5 处理流程

#### 步骤 A：创建模板（create_inflection_templates.py）

```
1. pd.read_excel("inflection_templates.xlsx", sheet_name="index")
   → 读取所有模板名称、单元格范围、参考模板

2. pd.read_excel("inflection_templates.xlsx", sheet_name="declensions")
   → 读取全部变格数据

3. 遍历 index 表的每一行：
   a. 按 cell_range 从 declensions 切片出单个模板 DataFrame
   b. 将 DataFrame 转换为嵌套列表结构
   c. 单元格内用 \n 分隔的多值，按巴利字母表排序
   d. 存入数据库：InflectionTemplates(pattern, like, data=JSON)

4. 检测已删除的模板并清理
5. 保存 changed_templates 到 pickle 和 db_info 表（供增量更新使用）
```

#### 步骤 B：生成变格表（generate_inflection_tables.py）

对每个 DpdHeadword：

```
1. 读取 headword 的 stem（词干）和 pattern（模板名）
   例：stem="loka", pattern="masc__a"

2. 从数据库查找 InflectionTemplates WHERE pattern="masc__a"
   例：like="masc__a", data=JSON[[...]...]

3. unpack JSON data → 嵌套列表 table_data

4. 核心渲染逻辑（第 173-213 行）：
   stem = "loka"（去掉 ! 和 * 标记）

   遍历 table_data 的行和列：
   - 如果是表头行（row 0）→ <th>
   - 如果是数据行：
     - 列 0 → <th> 语法标记
     - 奇数列 → 取后缀 cell_data，拼接到 stem 后面

     word_clean = f"{stem}{inflection}"
     例：loka + o = lokā, loka + aṃ = lokaṃ

   - 三藏验证：
     if word_clean in all_tipitaka_words_set:
         → 粗体显示（原文出现过）
     else:
         → 灰色显示（仅为理论形式）

5. 写入 DpdHeadword 的两个字段：
   - inflections = "loka,lokā,lokaṃ,lokena,..." （逗号分隔，用于查询索引）
   - inflections_html = "<table class='inflection'>..." （渲染用的 HTML）
```

**特殊处理：**

- **词干含 `!`**：如 `kat!a`，只存词干本身不分拆（不规则词）
- **无 pattern**：视为不变词（indeclinable），只存词干
- **无效 pattern**：在 `test_wrong_pattern` 中检测并提示更正
- **增量更新**：通过 pickle 记录已变更的词头和模板，只处理有变更的部分

#### 三藏验证词表

来源：`tools/all_tipitaka_words.py`

```
make_all_tipitaka_word_set():
  CST wordlist   → 缅甸版三藏词表
  BJT wordlist   → 泰国版三藏词表
  SYA wordlist   → 1927 泰版三藏词表
  SC wordlist    → SuttaCentral 版三藏词表
  return 四者并集
```

这四个词表由 Go 模块 `go_modules/frequency/` 预先生成。

---

## 二、复合词拆解（Deconstruction）原理

### 概述

复合词拆解是 DPD 中最复杂的算法模块。它采用 **基于词表的递归拆分 + Sandhi 规则还原** 策略，在 Go 中实现以获得较好性能。

核心思路：把所有已知的巴利语词形（变格形式、原文词汇等）建成一个哈希集合，对待拆词的每个切分位置，检查切分结果是否在集合中。

### 2.1 涉及的数据文件

| 文件 | 说明 |
|------|------|
| `shared_data/deconstructor/sandhi_rules.tsv` | 约 300 条连音规则表 |
| `shared_data/deconstructor/exceptions.tsv` | 拆词异常表 |
| `shared_data/deconstructor/manual_corrections.tsv` | 人工订正表 |
| `shared_data/deconstructor/see.tsv` | 同义词指引表 |
| `shared_data/deconstructor/spelling_mistakes.tsv` | 拼写错误映射 |
| `shared_data/deconstructor/variant_readings.tsv` | 异文映射 |
| `resources/deconstructor_output/` | 预计算拆解结果（子模块） |

### 2.2 涉及的代码文件

| 文件 | 作用 |
|------|------|
| `go_modules/deconstructor/main.go` | 入口，初始化 + 执行拆分 |
| `go_modules/deconstructor/importer/importer.go` | 数据导入（并发的） |
| `go_modules/deconstructor/importer/unmatched.go` | 构建已知词表和三藏词表 |
| `go_modules/deconstructor/importer/sandhi_rules.go` | 加载 Sandhi 规则 |
| `go_modules/deconstructor/importer/manualCorrections.go` | 加载人工订正 |
| `go_modules/deconstructor/splitters/split_recursive.go` | 递归拆分调度器 |
| `go_modules/deconstructor/splitters/split_2words.go` | 两词拆分器 |
| `go_modules/deconstructor/splitters/split_3words.go` | 三词拆分器 |
| `go_modules/deconstructor/splitters/split_lwff.go` | 从前端找最长已知词 |
| `go_modules/deconstructor/splitters/split_lwfb.go` | 从后端找最长已知词 |
| `go_modules/deconstructor/splitters/split_neg.go` | na- 否定前缀处理 |
| `go_modules/deconstructor/splitters/split_prefixes.go` | 前缀（abhi- 等）处理 |
| `go_modules/deconstructor/splitters/split_ka.go` | -ka 变格后缀处理 |
| `go_modules/deconstructor/splitters/split_ika.go` | -ika 变格后缀处理 |
| `go_modules/deconstructor/splitters/split_tta.go` | -tta 抽象名词后缀处理 |
| `go_modules/deconstructor/splitters/split_ati.go` | ati- 前缀处理 |
| `go_modules/deconstructor/splitters/split_dur.go` | du-/dus- 前缀处理 |
| `go_modules/deconstructor/splitters/split_nir.go` | ni-/nir- 前缀处理 |
| `go_modules/deconstructor/splitters/split_sa.go` | sa- 前缀处理 |
| `go_modules/deconstructor/splitters/split_su.go` | su- 前缀处理 |
| `go_modules/deconstructor/splitters/split_tissa.go` | tissa 结尾处理 |
| `go_modules/deconstructor/splitters/split_pīti.go` | pīti 结尾处理 |
| `go_modules/deconstructor/splitters/split_ādi.go` | ādi 结尾处理 |
| `go_modules/deconstructor/splitters/split_apicaevaiti.go` | pi/ca/eva/ti/iti/hi 等小品词处理 |
| `go_modules/deconstructor/splitters/split_double.go` | 双写首字母处理 |
| `scripts/build/deconstructor_output_add_to_db.py` | 将 Go 拆解结果写入数据库 |

### 2.3 已知词表（Knowledge Base）

Go 模块在启动时构建多个词表：

```
AllInflections         = 所有变格形式
                        （来自 DpdHeadword.inflections + 四版三藏原文）
AllInflectionsNoFirst  = 去掉首字母（用于模糊匹配，"...X" 找 X）
AllInflectionsNoLast   = 去掉尾字母（用于模糊匹配，"X..." 找 X）
```

辅助映射表：

| 映射 | 作用 |
|------|------|
| `spellingMistakes` | 拼写错误 → 正确拼写 |
| `variantMain` | 异文 → 标准形 |
| `abbreviations` | 缩写 → 全称 |
| `manualCorrections` | 人工订正 → 正确拆解 |
| `see` | 同义词指引 |

### 2.4 Sandhi 规则

**文件**：`shared_data/deconstructor/sandhi_rules.tsv`

**格式**（约 300 条）：

| 字段 | 说明 | 示例 |
|------|------|------|
| `index` | 规则编号 | 1 |
| `chA` | wordA 尾字母 | a |
| `chB` | wordB 首字母 | p |
| `ch1` | 还原后 wordA 尾字母 | a |
| `ch2` | 还原后 wordB 首字母 | ap |
| `eg` | 示例 | abhivaggen'api |
| `weight` | 可靠度权重 | 3 |

规则含义：当 wordA 以 chA 结尾且 wordB 以 chB 开头时，在复合词中实际表现为 `wordA[:-1] + ch1` + `ch2 + wordB[1:]`。

例如规则 `{chA:a, chB:p, ch1:a, ch2:ap}`：

```
理论组合: anussati + pada  = anussatipada
实际文本: anussati + apada → anussati-apada → anussat'apada (省略形式)
```

Sandhi 规则在启动时预编译为**双层 map 索引**以实现 O(1) 查找：

```go
var SandhiRuleIndex = map[rune]map[rune][]SandhiRules{
    'a': {'p': [{ch1:'a', ch2:'ap', weight:3}], 't': [{...}], ...},
    'ā': {'p': [{...}], 't': [{...}], ...},
    ...
}
```

规则文件中有大量针对巴利语特殊音变现象的处理：
- 元音省略（如 `'ti`、`'pi`）
- 同化（如 `t+b → d+b`、`n+ch → ñ+ch`）
- 送气替换（如 `b+b → d+b`、`d+dh → ddh`）
- 前鼻化（如 `ṃ+h → ṃ+h`）

### 2.5 拆分算法详解

入口 `SplitRecursive` 是一个**策略调度器**，按优先级依次调用不同的拆分器：

```
输入: word = "dhammābhiññā"

┌── 第一轮：特殊模式匹配 ──────────────────────┐
│                                                │
│ 1. ati- 前缀? → SplitAti(word)                 │
│ 2. su-/du-/nir- 前缀? → SplitSu/Dur/Nir(word) │
│ 3. sa- 前缀? → SplitSa(word)                   │
│ 4. abhi- 等前缀? → SplitPrefixes(word)         │
│ 5. -tissa/-pīti/-ādi 结尾? → 相应 splitter     │
│ 6. pi/ca/eva/ti 等结尾? → SplitApicaEvati      │
│ 7. 双字母开头? → SplitDoubleLetter(word)       │
│ 8. -tā/-tta/-ttā 抽象名词结尾 → SplitTta       │
│ 9. -ka/-ika 变格结尾 → SplitKa/SplitIka        │
│                                                │
└────────────────────────────────────────────────┘

┌── 第二轮：通用拆分（processCount >= 1） ──────┐
│                                                │
│ 10. SplitLwff(word)                            │
│     → 从前端找最长已知词                       │
│     → "dhammābhiññā" 依次截取前缀              │
│       "dhammābhiññā" → 不在词表                │
│       "dhammābhiññ"  → 不在词表                │
│       ...                                      │
│       "dhamma" → 在词表!                       │
│       → 剩余 "bhiññā" → 在词表?               │
│         → 在: 完整拆解 "dhamma+bhiññā"         │
│         → 不在: 对 "bhiññā" 递归调用          │
│                                                │
│ 11. SplitLwfb(word)                            │
│     → 从后端找最长已知词                       │
│     → 对称于 SplitLwff                         │
│                                                │
│ 12. Split2(word)                               │
│     → 穷举所有切分位置                         │
│     → 每个位置测试：                           │
│       "dha" + "mmābhiññā"                      │
│       直接查词表 → 不在                        │
│       Sandhi 还原 → "dhā" + "mābhiññā"         │
│       → "dhā" 在词表? "mābhiññā" 在词表?     │
│                                                │
│ 13. Split3(word)                               │
│     → 切为三段                                 │
│                                                │
└────────────────────────────────────────────────┘

┌── 递归拆分 ──────────────────────────────────┐
│                                                │
│ 对部分匹配的结果继续拆分                       │
│ "dhamma" → 已完整匹配，不再拆                 │
│ "bhiññā" → 不在词表，递归                     │
│   → 再走一遍 SplitRecursive                   │
│   → "bhi" + "ññā" ? "bhi" + ññā → 词表?      │
│                                               │
└────────────────────────────────────────────────┘
```

#### LWFF（Longest Word From Front）详解

```go
func SplitLwff(w data.WordData) {
    // 从完整词开始，逐个缩短前缀
    for i := range len(word) {
        lwff := word[:len(word)-i]

        // 直接匹配（无 sandhi）
        if data.G.IsInInflections(lwff) {
            // 剩余部分如果也在词表中 → 找到完整拆分
            // 否则递归拆剩余部分
        }

        // 模糊匹配（去掉尾字母尝试 sandhi 还原）
        if data.G.IsInInflectionNoLast(lwff) {
            // 尝试用 sandhi 规则还原
            // wordA_last + wordB_first → ch1 + ch2
            // 重新匹配
        }
    }
}
```

#### Split2 中的 Sandhi 还原

```go
for _, sr := range data.G.SandhiRuleIndex[wordALastRune][wordBFirstRune] {
    // 替换首尾字母
    word1 := wordA[:(len-1)] + sr.Ch1
    word2 := sr.Ch2 + wordB[1:]

    if IsInInflections(word1) && IsInInflections(word2) {
        // 成功还原，添加匹配
    }
}
```

此处的 O(1) 索引设计非常重要——实际运行时每个切分位置只需要查 1-5 条规则而不是扫描全部 300 条。

### 2.6 评分与排序

每个拆分方案根据以下因素累加权重：

| 权重来源 | 说明 |
|---------|------|
| 直接拆分（无 sandhi 调整） | +2 |
| 通过 sandhi 规则还原 | +`sr.Weight`（规则本身的权重 2-5） |
| 更多匹配路径 | 路径越长权重越高 |

取权重最高的前 5 组拆分存入数据库。

### 2.7 数据写入流程

```
Go 模块输出 → JSON 文件
     ↓
scripts/build/deconstructor_output_add_to_db.py
     ↓
查找 dpd_headwords，将拆解结果写入：
  DpdHeadword.construction = "dhamma + abhiññā"
     ↓
同步到 lookup 表的 deconstructor 列
  供前端词典查询时快速检索
```

---

## 三、两套机制的协作关系

```
变格表生成 (Python)                复合词拆解 (Go)
         │                               │
         ▼                               ▼
   DpdHeadword                     Go 模块读 DpdHeadword
   .stem + .pattern                     .inflections
   → 每个词 20 个变格形式          → 构建 AllInflections 词表
         │                               │
         ▼                               ▼
   inflections 转为 lookup         对每条待拆词：
   表的 headwords 列                递归拆分 + sandhi 还原
   → 词形 → 原型 索引               → 复合词 → 组分 映射
         │                               │
         ▼                               ▼
   ┌──────────────────────────────────────────┐
   │          lookup 表（最终查询入口）          │
   │                                          │
   │ lookup_key  | headwords | deconstructor  │
   │ "lokaṃ"     | [1]       | ""             │
   │ "abhiññā"   | [42]      | ""             │
   │ "dhammābhiññā" | [1]    | "dhamma+bhiññā"│
   └──────────────────────────────────────────┘
```

对于前端（如 Wiki Pali 油猴脚本）的查询流程：

```
用户输入: "dhammābhiññā"

1. 查 lookup.headwords
   → 有结果 → 显示词干 "dhamma"
   → 无结果 → 不干扰原有界面

2. 如果查到词干:
   → 查 dpd_headwords.stem + pattern
   → 查 inflection_templates.data
   → 在客户端拼出变格表

3. 查 lookup.deconstructor
   → 有结果 → 显示复合词拆解
   → 无结果 → 不显示
```
