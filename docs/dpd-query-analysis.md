# DPD 查词流程分析

## 背景

wiki-pali-dpd 从 dpd-db 项目导出精简版 SQLite 数据库，在浏览器端用 sql.js 查询。
本文档记录 dpd-db 的完整查词流程、与 wiki-pali-dpd 的实现差异、以及排查 "sādhunā 查不到" 问题的分析过程。

---

## 1. dpd-db 完整查词流程

dpd-db 提供了一个基于 FastAPI 的查询服务（`exporter/webapp/main.py`），其核心查词逻辑在 `toolkit.py:make_dpd_html()` 中。

### 1.1 请求链路

```
用户输入 "sādhunā"
    │
    ▼
浏览器 JS (home.js): Velthuis 音译转换 (aa→ā, .t→ṭ, .m→ṃ)
    │
    ▼
浏览器 JS (app.js): GET /search_json?q=sādhunā
    │
    ▼
FastAPI: db_search_json()
    │
    ▼
音译检测 (tools/translit.py): 若非罗马字母则转写，罗马字母原样通过
    │
    ▼
核心查词: make_dpd_html()
```

### 1.2 查词步骤

```
make_dpd_html(db_session, q):
    │
    ├── [1] 输入清洗: 去引号、ṁ→ṃ、去空白
    │
    ├── [2] 手动变体检查 (VariantManager)
    │     从 TSV 文件中查找手动维护的变体映射
    │
    ├── [3] 主查询: lookup 表 ILIKE
    │     SELECT * FROM lookup
    │     WHERE lookup_key ILIKE 'sādhunā'
    │        OR lookup_key ILIKE 'sādhunā.'
    │
    ├── [4] 若有结果:
    │     ├── headwords JSON → 解析ID数组
    │     ├── 查询 DpdHeadword WHERE id IN (...)
    │     ├── 查询 FamilyCompound, Idioms, Sets 等关联表
    │     └── 渲染模板
    │
    ├── [5] 若无结果且 q 为数字:
    │     按 DpdHeadword.id 直接查询
    │
    ├── [6] 若无结果且 q 匹配 "word N":
    │     按 DpdHeadword.lemma_1 精确匹配
    │
    └── [7] 最终回退: find_closest_matches()
           ├── ascii_to_unicode_dict[q]  (Velthuis → Unicode)
           └── difflib.get_close_matches(q, headwords_clean_set, n=10, cutoff=0.7)
```

### 1.3 变格表高亮

高亮是纯客户端的，在 `exporter/webapp/static/app.js` 的 `highlightInflections()` 中：

```
render/performSearch 完成后
    │
    ▼
highlightInflections(searchTerm):
    ├── 遍历所有 <table class="inflection">
    ├── 遍历所有 <td>
    ├── 按 <br> 分割单元格内容
    ├── 规范化后与搜索词做精确字符串匹配
    └── 匹配的短语 → <span class="inflection-highlight">...</span>
```

服务端只负责渲染变格表的 HTML（存储在 `DpdHeadword.inflections_html` 列），不做高亮判断。

---

## 2. 变格表生成与 lookup 填充

这是理解 "为什么有些变格查不到" 的关键。

### 2.1 变格生成流程

```
dpd-db 构建 pipeline (scripts/bash/generate_components.py):
    │
    ├── [A] generate_inflection_tables.py
    │     遍历所有 DpdHeadword，根据 stem + pattern + InflectionTemplates
    │     生成所有变格形式，存入 DpdHeadword.inflections (CSV)
    │     及 DpdHeadword.inflections_html (HTML 表格)
    │
    └── [B] inflections_to_headwords.py
           ├── 收集所有变格形式
           ├── 过滤: 只保留在 all_words_set 中的形式
           │        (all_words_set = Tipitaka 经文词汇 ∪ 复合词拆解 ∪ 词头)
           └── 写入 lookup 表: lookup_key → headword_ids
```

**关键约束**: `inflections_to_headwords.py` **只将经文中验证过的** 变格形式写入 lookup 表。
"验证" 意味着该形式曾在 Tipitaka 藏经文本中出现过。

这意味着：
- `bhikkhave`（出现在经文中）→ lookup 表中有
- `sādhunā`（语法正确但未在指定经文语料中出现）→ lookup 表中**没有**

但 `dpd_headwords.inflections` 列中**确实有** `sādhunā` —— 它是根据变格模板生成的，只是未被写入 lookup 表。

### 2.2 lookup 表结构

```sql
CREATE TABLE lookup (
    lookup_key      TEXT PRIMARY KEY,  -- 可搜索形式
    headwords       TEXT,              -- JSON: [headword_id, ...]
    roots           TEXT,              -- JSON: [root, ...]
    deconstructor   TEXT,              -- JSON: 复合词拆解
    variant         TEXT,              -- 拼写变体说明
    spelling        TEXT,              -- 拼写
    grammar         TEXT,              -- 语法说明
    help            TEXT,              -- 帮助/说明
    abbrev          TEXT,              -- 缩写
    epd             TEXT,              -- 词源
    see             TEXT,              -- 参见
    abbrev_other    TEXT
);
```

### 2.3 dpd_headwords 表相关字段

```sql
CREATE TABLE dpd_headwords (
    id              INTEGER PRIMARY KEY,
    lemma_1         TEXT,              -- 词目/原形 (如 "sādhu")
    stem            TEXT,              -- 词干 (如 "sādh")
    pattern         TEXT,              -- 变格模板 (如 "u adj")
    meaning_1       TEXT,              -- 释义
    inflections     TEXT,              -- CSV: 所有变格形式
    inflections_html TEXT,             -- HTML: 变格表
    pos             TEXT,              -- 词性
    ...
);
```

---

## 3. wiki-pali-dpd 的实现

### 3.1 导出脚本 scripts/export/web_db.py

从 dpd-db 的 `dpd.db` 导出精简版 `dpd-web.db`，包含四张表：

```sql
-- lookup: 查词主表（221K 行）
CREATE TABLE lookup (
    lookup_key      TEXT PRIMARY KEY,
    headwords       TEXT,
    deconstructor   TEXT,
    grammar         TEXT,
    spelling        TEXT,
    see             TEXT
);

-- headwords: 词目（89K 行）
CREATE TABLE headwords (
    id              INTEGER PRIMARY KEY,
    lemma_1         TEXT,
    pos             TEXT,
    stem            TEXT,
    pattern         TEXT,
    meaning_1       TEXT,
    meaning_lit     TEXT,
    inflections     TEXT          -- 2026-07 新增：存 CSV 变格用于兜底
);

-- inflection_templates: 变格模板（154 行）
CREATE TABLE inflection_templates (
    pattern         TEXT PRIMARY KEY,
    like            TEXT,
    data            TEXT
);

-- roots: 词根（753 行）
CREATE TABLE roots (
    root            TEXT PRIMARY KEY,
    root_meaning    TEXT
);
```

### 3.2 查询流程 src/db/query.js

```
lookupWord(word)
    │
    ├── SELECT FROM lookup WHERE lookup_key = ?
    │
    └── 有结果 → 返回 {headwords, deconstructor, grammar, spelling, see}
        无结果 → null
```

### 3.3 注入流程 src/ui/injector.js

```
_onResultChange()
    │
    ├── 监听 #rc-tabs-0-panel-result 的 DOM 变化
    ├── 读取 input#rc_select_0 的值
    ├── .normalize("NFC") 统一 Unicode
    ├── 防重复: _lastWord 记录
    └── → _lookup(word)
           │
           ├── lookupWord(word)  ← 主查
           ├── → null → searchInflections(word)  ← 2026-07 新增兜底
           ├── getHeadword(headwordIds[0])
           └── new Panel(...) → injectBefore(#rc-tabs-0-panel-result)
```

---

## 4. 问题排查: sādhunā 查不到

### 4.1 发现

用户在测试页输入 `sādhunā`，底部状态栏显示 "DPD 已就绪"，但右侧结果区空白。

### 4.2 排查过程

**第一步**: 检查全量 dpd.db 的 lookup 表

```sql
SELECT lookup_key, headwords FROM lookup WHERE lookup_key = 'sādhunā';
-- → 无结果（NULL）
```

对比已知词:

```sql
SELECT lookup_key, headwords FROM lookup WHERE lookup_key = 'sādhu';
-- → sādhu  [62220, 62221, 62222, 62223, 62224, 74546]
```

**第二步**: 检查 headwords 的 inflections 列

```sql
SELECT id, lemma_1, inflections FROM dpd_headwords WHERE lemma_1 = 'sādhu';
-- → sādhu 1: "sādhu,sādhavo,sādhū,sādhunī,...,sādhunā,..."
-- → sādhu 5: "sādhu,sādhuṃ,sādhū,sādhūni,sādhunā,..."
-- → sādhu 6: "sādhu,sādhavo,sādhū,sādhunaṃ,sādhuṃ,sādhunā,..."
```

**结论**: `sādhunā` 在 `dpd_headwords.inflections` 中，但不在 `lookup` 表中。

**根因**: dpd-db 的 `inflections_to_headwords.py` 只将**在 Tipitaka 经文中验证过的**变格写入 lookup 表。`sādhunā` 虽语法正确但未在指定语料中出现，故被排除。

### 4.3 修复方案对比

| 方案 | 描述 | DB 大小 | 查询速度 | 选择理由 |
|------|------|---------|---------|---------|
| A: 膨胀 lookup 表 | 导出时遍历所有 inflections 补全到 lookup | 40 MB (超 25 MiB 限制) | O(1) | ❌ 太大 |
| B: 单独 inflection_map 表 | 新建表存储 inflection→headword_id 映射 | ~25 MB | O(log n) | ❌ 仍偏大 |
| C: CSV 全表扫描兜底 | lookup 查不到时扫 headwords.inflections | 16 MB | ~20ms | ✅ 最佳 |

最终采用方案 C: 在 `headwords` 表中保留 `inflections` CSV 列，`query.js` 加 `searchInflections()` 做 `LIKE '%word%'` 精确匹配。

### 4.4 最终改动

| 文件 | 改动 |
|------|------|
| `scripts/export/web_db.py` | headwords 表加 `inflections TEXT` 列，导入时包含该字段 |
| `src/db/query.js` | 新增 `searchInflections(word)`: CSV 列全表扫描兜底 |
| `src/ui/injector.js` | `_lookup()`: lookupWord 失败时自动 fallback 到 searchInflections |

### 4.5 验证结果

```
sādhunā       → ids=[62220, 62224, 74546]  (3 个 sādhu 词头)
bhikkhave     → lookup 直接命中
manopubbaṅgamā → inflections 命中
manasā        → lookup 直接命中
```

---

## 5. 与 dpd-db API 的关键差异

| 特性 | dpd-db API | wiki-pali-dpd |
|------|------------|---------------|
| 运行环境 | Python FastAPI + SQLAlchemy | sql.js (WebAssembly) 浏览器端 |
| 查词方式 | `ILIKE` 模糊匹配 | `=` 精确匹配 + CSV 全表扫描 |
| 匹配回退 | difflib 模糊匹配 + ASCII→Unicode 映射 | 无模糊匹配 |
| 变格表高亮 | 客户端 JS 精确匹配 | 客户端精确匹配（同上） |
| 关联数据 | roots, families, idioms, sets 等 | 仅 roots |
| DB 大小 | 526 MB 全量 | 16 MB 精简 |
| Unicode 处理 | 客户端 Velthuis 转写 + 服务端自动检测 | `.normalize("NFC")` |
| 菜单 | 无（Web 应用） | Tampermonkey 菜单 |
| 历史 | 浏览器 localStorage | 浏览器 localStorage |

---

## 6. 数据流全景

```
dpd-db 项目
    ┌─────────────────────────────┐
    │ dpd_headwords (89K rows)    │
    │   ├─ lemma_1, stem, pattern │
    │   ├─ inflections (CSV)      │
    │   └─ inflections_html       │
    ├─ lookup (221K rows)         │
    │   └─ lookup_key → headwords │
    ├─ inflection_templates       │
    └─ dpd_roots                  │
    └─ ... (families, idioms...)  │
              │
              ▼ web_db.py (导出)
    ┌─────────────────────────────┐
    │ dpd-web.db (16 MB .gz)      │
    │ headwords (含 inflections)  │
    │ lookup                      │
    │ inflection_templates        │
    │ roots                       │
    └──────────┬──────────────────┘
               │ npm run build (拷贝到 dist/)
               ▼
    ┌─────────────────────────────┐
    │ dist/                       │
    │ ├─ wiki-pali-dpd.user.js    │
    │ ├─ index.html               │
    │ └─ dpd-web.db.gz            │
    └──────────┬──────────────────┘
               │ Cloudflare Pages 部署
               ▼
    浏览器端 Tampermonkey 运行
    ┌─────────────────────────────┐
    │ 1. 下载 dpd-web.db.gz       │
    │ 2. IndexedDB 缓存           │
    │ 3. sql.js 打开 SQLite       │
    │ 4. 监听 WikiPali DOM        │
    │ 5. 用户点击/输入 → 查词     │
    │ 6. injectBefore 注入面板    │
    └─────────────────────────────┘
```
