# 数据库构建全流程（Build Pipeline）

## 概述

dpd.db 从原始数据到完整词典数据库的构建过程分为 **三大阶段**，入口脚本为 `scripts/bash/initial_build_db.py`。完整构建约需 1 小时。

每个阶段由 `tools/script_runner.py` 驱动，顺序执行一系列命令。

---

## 入口：initial_build_db.py

```python
COMMANDS = [
    "tools/logo.py",                                    # 0. 打印 logo
    "scripts/build/db_rebuild_from_tsv.py",              # 1. 从 TSV 重建核心表
    "db/bold_definitions/update_bold_definitions_db.py", # 2. 粗体标注数据
    "scripts/bash/generate_components.py",               # 3. 生成全部衍生数据
]
```

---

## 阶段一：从 TSV 重建核心表

**脚本**：`scripts/build/db_rebuild_from_tsv.py`

### 流程

```
1. 检查 config.ini — 如果 regenerate.db_rebuild = yes 则执行
2. 删除现有 dpd.db
3. 创建空数据库（SQLAlchemy Base.metadata.create_all）
4. 检查 TSV 备份文件是否存在
5. 读取 dpd_headwords 的 TSV → 写入 DpdHeadword 表
6. 读取 dpd_roots 的 TSV → 写入 DpdRoot 表
7. commit 并关闭
```

### 使用的数据文件

| 文件 | 说明 |
|------|------|
| `db/backup_tsv/dpd_headwords_part_001.tsv` | 词头数据（分片 1，~36 MB，~2.8 万行） |
| `db/backup_tsv/dpd_headwords_part_002.tsv` | 词头数据（分片 2，~37 MB） |
| `db/backup_tsv/dpd_headwords_part_003.tsv` | 词头数据（分片 3，~35 MB） |
| `db/backup_tsv/dpd_roots_part_001.tsv` | 词根数据（~191 KB，~2000 行） |

TSV 的列与 SQLAlchemy 模型字段对应，排除 `user_id`、`created_at`、`updated_at` 等运维字段。

**TSV 的维护方式**：通过 `db/backup_tsv/backup_dpd_headwords_and_roots.py` 从数据库导出，每次导出自动按 30000 行分片并 Git 提交。

### 涉及的数据文件（backup_tsv 目录）

| 文件/目录 | 说明 |
|----------|------|
| `db/backup_tsv/dpd_headwords_part_001.tsv` | 词头备份（分片） |
| `db/backup_tsv/dpd_headwords_part_002.tsv` | 词头备份（分片） |
| `db/backup_tsv/dpd_headwords_part_003.tsv` | 词头备份（分片） |
| `db/backup_tsv/dpd_roots_part_001.tsv` | 词根备份 |
| `db/backup_tsv/sutta_info.tsv` | 经文信息备份（非阶段一使用） |
| `db/backup_tsv/backup_dpd_headwords_and_roots.py` | 导出脚本 |

### 涉及的核心代码文件

| 文件 | 作用 |
|------|------|
| `scripts/build/db_rebuild_from_tsv.py` | 从 TSV 重建数据库 |
| `db/db_helpers.py` | 创建数据库、获取 session |
| `db/models.py` | ORM 模型定义（DpdHeadword, DpdRoot 等） |
| `tools/paths.py` | 所有文件路径集中管理 |

---

## 阶段二：粗体标注（Bold Definitions）

**脚本**：`db/bold_definitions/update_bold_definitions_db.py`

将预计算的粗体标注数据（三藏原文中粗体标记的引用位置）写入 `BoldDefinition` 表。

### 使用的数据文件

| 文件 | 说明 |
|------|------|
| `db/bold_definitions/bold_definitions.tsv` | 粗体标注 TSV（索引位置、经文引用） |

### 涉及的核心代码文件

| 文件 | 作用 |
|------|------|
| `db/bold_definitions/update_bold_definitions_db.py` | 主逻辑 |
| `db/bold_definitions/extract_bold_definitions.py` | 从原文提取粗体标记 |
| `db/bold_definitions/search_bold_definitions.py` | 搜索粗体标注 |

---

## 阶段三：生成全部衍生数据

**脚本**：`scripts/bash/generate_components.py`

这是最长的阶段（约 40+ 步），分为多个子模块。

### 3.1 测试 + 版本信息

```
uv run pytest tests/     ← 运行测试套件
tools/version.py          ← 写入版本号到数据库
scripts/build/config_uposatha_day.py ← 更新布萨日信息
```

### 3.2 变格/变位表生成

**核心文件**：`db/inflections/create_inflection_templates.py` + `generate_inflection_tables.py`

- 从 Excel 模板创建变格表
- 为每个词头匹配模板生成变格形式
- **详细原理见 `declension_and_deconstructor.md`**

### 3.3 词根家族

```
scripts/build/root_has_verb_updater.py          ← 标记有动词形式的词根
scripts/build/sanskrit_root_families_updater.py ← 梵语词根家族映射
```

### 3.4 词族关系（Families）

```
db/families/family_root.py      ← 词根词族（同根词）
db/families/family_word.py      ← 单词词族（同源词）
db/families/family_compound.py  ← 复合词词族
db/families/family_set.py       ← 词集词族（主题相关）
db/families/family_idiom.py     ← 惯用语词族
```

各词族模块遍历 `DpdHeadword` 表，根据词根、词干、词义关联等建立层级关系。

### 3.5 Anki 导出

```
scripts/build/families_to_json.py  ← 词族数据序列化
exporter/anki/anki_updater.py      ← 更新 Anki 牌组数据
exporter/anki/anki_apkg_exporter.py ← 导出 .apkg 文件
```

### 3.6 异文提取（Variants）

**脚本**：`db/variants/main.py`

从四个版本的三藏提取异文（variant readings）：

```
CST（缅甸版） → resources/dpd_submodules/cst/romn_txt/
BJT（泰国版） → resources/dpd_submodules/bjt/public/static/roman_json/
SC（SuttaCentral） → resources/sc-data/sc_bilara_data/root/pli/ms/
SYA（1927 泰版） → resources/syāmaraṭṭha_1927/
```

- 使用 BeautifulSoup 解析 XML（CST 为 UTF-16 XML）
- 使用正则提取标注释文
- 异文去重后写入数据库
- 同步到 `lookup.variant` 列

### 3.7 复合词拆解（Deconstructor）

**Go 模块**：`go_modules/deconstructor/main.go`

```
go run go_modules/deconstructor/main.go
    ↓
scripts/build/tarball_deconstructor_output.py  ← 结果归档
scripts/build/deconstructor_output_add_to_db.py ← 写入数据库
```

- 基于词表 + Sandhi 规则的递归拆分
- **详细原理见 `declension_and_deconstructor.md`**

### 3.8 API 助词处理

**脚本**：`scripts/build/api_ca_eva_iti_iva_hi.py`

处理 `ca`（和）、`eva`（正是）、`iti`（如是）等巴利语高频助词的特殊变格形式，生成 `inflections_api_ca_eva_iti` 列。

### 3.9 转写（Transliteration）

```
db/inflections/transliterate_inflections.py  ← 变格形式转写（天城体/僧伽罗/泰文）
db/inflections/inflections_to_headwords.py   ← 变格形式→词头的反向索引
```

- 使用 **Aksharamukha** 库进行跨文字转写
- `inflections_to_headwords.py` 是查询系统的核心——建立 `变格形式 → 词头 ID` 映射，存入 `lookup.headwords` 列

### 3.10 经文信息

```
db/suttas/suttas_update.py      ← 从 Google Sheets 下载经文元数据
db/suttas/suttas_to_lookup.py   ← 同步到 lookup 表
```

- `suttas_update.py` 从在线 Google Sheets 下载 TSV
- 更新 `SuttaInfo` 表（涉及 CST/BJT/SC 多种索引编号系统）

### 3.11 查询索引（Lookup）

```
db/grammar/grammar_to_lookup.py           ← 语法信息
db/lookup/see.py                          ← 同义词指引（如 "karohi" → "karoti"）
db/lookup/spelling_mistakes.py            ← 拼写纠正
db/lookup/transliterate_lookup_table.py   ← lookup 表键的转写
db/lookup/help_abbrev_add_to_lookup.py    ← 帮助和缩写条目
```

所有这些脚本将数据同步到 `lookup` 表的不同列（`grammar`、`see`、`spelling`、`help`、`abbrev`），构成最终的快速查询索引。

### 3.12 词频统计

**脚本**：`scripts/build/ebt_counter.py`（早期佛教文献覆盖数）

**Go 模块**：`go_modules/frequency/main.go`

```
go run go_modules/frequency/main.go
```

从四版三藏（CST/BJT/SYA/SC）统计每个词的文献出现频率，生成：

| 输出文件 | 说明 |
|---------|------|
| `shared_data/frequency/cst_freq_json` | 各文献的词频 JSON |
| `shared_data/frequency/bjt_freq_json` | |
| `shared_data/frequency/sc_freq_json` | |
| `shared_data/frequency/sya_freq_json` | |

更新 `DpdHeadword.freq_data`（词频 JSON 数据）和 `freq_html`（词频 HTML 标签）。

### 3.13 英-巴反向索引

**脚本**：`db/epd/epd_to_lookup.py`

建立英语单词 → 巴利语词头的反向映射（English-Pāli Dictionary），存入 `lookup.epd` 列。

### 3.14 搜索索引

**脚本**：`exporter/webapp/generate_search_index.py`

为 Web App 生成全文搜索索引。

### 3.15 音频生成

```
audio/bhashini/generate_dpd.py   ← 调用 Bhashini TTS API 生成 MP3
audio/db_create.py               ← 创建 dpd_audio.db（MP3 BLOB 存储）
audio/db_release_upload.py       ← 上传音频包
```

#### 音频管道详细流程

**TTS 引擎**：Bhashini API（印度政府 AI 语音平台）

**音频生成参数**：

| 音色 | 文件目录 |
|------|---------|
| `kn-m4`（男声 1，Neutral，0.85 语速） | `audio/mp3s/Kannada_kn-m4_Neutral_0.85/` |
| `kn-m1`（男声 2，Neutral，0.85 语速） | `audio/mp3s/Kannada_kn-m1_Neutral_0.85/` |
| `kn-f4`（女声，Neutral，0.85 语速） | `audio/mp3s/Kannada_kn-f4_Neutral_0.85/` |

**文本处理流程**：
```
巴利语罗马字 → Aksharamukha 转写为卡纳达文 → API 请求

特殊处理：
  - 开头的 ñ → ny
  - 元音前的 ñ → ñy
  - 短词（<5字符）重复 3 次以提高发音准确度
  - 问题文件重复 4 次
```

**音频数据库结构**：

```
dpd_audio.db
└── DpdAudio 表
    ├── lemma_clean (PRIMARY KEY)
    ├── male1 (BLOB)   ← kn-m4 MP3 二进制
    ├── male2 (BLOB)   ← kn-m1 MP3 二进制
    └── female1 (BLOB) ← kn-f4 MP3 二进制
```

输出归档：`audio/db/dpd_audio_{version}.tar.gz` + `dpd_audio_index_{version}.tsv`

**详细原理**：见 `technicals/declension_and_deconstructor.md`（音频生成部分）

### 3.16 完整性检查

**脚本**：`scripts/build/dealbreakers.py`

构建最后的完整性检查，确保数据库的关键约束满足要求。

---

## 完整构建流程图

```
initial_build_db.py
    │
    ├── 0. logo.py
    │
    ├── 1. db_rebuild_from_tsv.py
    │   ├── 删除旧 dpd.db
    │   ├── 创建空库
    │   ├── dpd_headwords_part_*.tsv → DpdHeadword 表
    │   └── dpd_roots_part_001.tsv → DpdRoot 表
    │
    ├── 2. update_bold_definitions_db.py
    │   └── bold_definitions.tsv → BoldDefinition 表
    │
    └── 3. generate_components.py
        │
        ├── 3.1  pytest + 版本信息
        │
        ├── 3.2  变格表
        │   ├── inflection_templates.xlsx → InflectionTemplates 表 (create_inflection_templates.py)
        │   └── stem+pattern → inflections + inflections_html (generate_inflection_tables.py)
        │
        ├── 3.3  词根家族更新
        │
        ├── 3.4  词族关系（5 个 family_*.py）
        │
        ├── 3.5  Anki 导出
        │
        ├── 3.6  异文提取（从 4 版三藏）
        │   ├── CST XML → variants
        │   ├── BJT JSON → variants
        │   ├── SC Bilara → variants
        │   └── SYA → variants
        │
        ├── 3.7  复合词拆解 (Go)
        │   └── deconstructor → construction + lookup.deconstructor
        │
        ├── 3.8  API 助词处理
        │
        ├── 3.9  转写 + 屈折索引
        │   ├── inflections → 天城体/僧伽罗/泰文
        │   └── inflections-to-headwords → lookup.headwords
        │
        ├── 3.10 经文信息（Google Sheets 在线 + 本地缓存）
        │
        ├── 3.11 查询索引
        │   ├── grammar → lookup.grammar
        │   ├── see → lookup.see
        │   ├── spelling → lookup.spelling
        │   ├── transliterate → lookup.sinhala/deva/thai
        │   └── help/abbrev → lookup.help/abbrev
        │
        ├── 3.12 词频（Go）
        │   ├── ebt_counter.py
        │   └── frequency 模块
        │
        ├── 3.13 英-巴反向索引 → lookup.epd
        │
        ├── 3.14 全文搜索索引
        │
        ├── 3.15 音频
        │   ├── Bhashini TTS API → MP3 文件
        │   └── MP3 → dpd_audio.db (BLOB)
        │
        └── 3.16 dealbreakers.py（完整性检查）
```

## 关键依赖关系

```
阶段一 (TSV 重建) → 所有后续步骤

变格表 (3.2) → 转写 (3.9上半) → 屈折索引 (3.9下半)
    ↓
3.4 词族关系（依赖已有词头、词根数据）
3.7 复合词拆解（依赖变格表生成的词形集）
3.12 词频（依赖已有的词头映射）

异文 (3.6) → 独立，只依赖子模块语料

音频 (3.15) → 独立，只依赖 DpdHeadword.lemma_clean
```
