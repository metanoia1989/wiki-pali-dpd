# Wiki Pali DPD — 油猴脚本 + 数据导出方案

## 项目概览

巴利语词典 DPD 数据的浏览器端应用。从 dpd-db 项目提取结构化数据 → 导出精简 SQLite → 油猴脚本在 WikiPali 页面注入变格表、复合词拆解、释义。

## 两个子项目

```
wiki-pali-dpd/          ← 油猴脚本源码 + 数据导出脚本
    scripts/export/web_db.py    ← 从 dpd.db → dpd-web.db.gz
    src/                        ← 油猴脚本源码
    dist/wiki-pali-dpd.user.js  ← 构建产物

dpd-db/                 ← 原始词典数据源（含构建 pipeline）
    dpd.db                      ← 完整 DPD 数据库（~526 MB）
    scripts/bash/generate_components.py  ← 完整 pipeline
    scripts/export/web_db.py    ← 精简导出脚本（自 wiki-pali-dpd 复制）
    exporter/share/dpd-web.db.gz ← 导出产物（~11 MB）
    config.ini                  ← pipeline 控制（必须存在）
    shared_data/                ← deconstructor/frequency 数据文件
    resources/                  ← 子模块（三藏语料）
```

---

## dpd-web.db.gz 构建指南

### 实际数据规模（2026-07 实测）

| 表 | 行数 | 大小（解压） | 说明 |
|------|------|------------|------|
| `lookup` | 221,707 | ~6 MB | 词形→原型映射 + 复合词拆解 |
| `headwords` | 89,114 | ~5 MB | 词干、模板、释义（不含 inflections） |
| `inflection_templates` | 154 | ~0.1 MB | 变格模板 JSON |
| `roots` | 753 | ~0.02 MB | 词根释义 |
| SQLite 页开销 | — | ~17 MB | 索引 + 空页 |
| **合计** | | **~29 MB 解压 / ~11 MB gzip** | |

**注意：** `headwords.inflections` 列（23 MB 纯文本）已排除，因为前端渲染变格表只需要 `stem + pattern + templates`，不需要逗号分隔的变格形式列表。排除后文件从 58 MB → 29 MB。

### 依赖分析

油猴脚本只需要以下 4 个 dpd-db 组件，其余均可跳过：

| 组件 | 位置 | 功能 | 必需 | 耗时 |
|------|------|------|------|------|
| db_rebuild_from_tsv | `scripts/build/db_rebuild_from_tsv.py` | 从 TSV 重建核心表 | ✅ | ~15s |
| create_inflection_templates | `db/inflections/create_inflection_templates.py` | 变格模板 | ✅ | ~1s |
| generate_inflection_tables | `db/inflections/generate_inflection_tables.py` | 变格表生成 | ✅ | ~13s |
| inflections_to_headwords | `db/inflections/inflections_to_headwords.py` | 词形→原型索引 | ✅ | ~30s |
| grammar/lookup/see/spelling/epd | 6 个脚本 (3.11) | lookup 表填充 | ✅ | ~45s |
| deconstructor (Go) | `go_modules/deconstructor/main.go` | 复合词拆解 | ✅ | ~50s |
| deconstructor_output_add_to_db | `scripts/build/deconstructor_output_add_to_db.py` | 拆解结果写入 db | ✅ | ~3s |
| web_db.py | `scripts/export/web_db.py` | 精简导出 | ✅ | ~30s |
| ✅ 核心合计 | | | | **~3 min** |

以下为 pipeline 中可选组件，油猴脚本**不需要**：

| 组件 | 跳过原因 |
|------|---------|
| pytest | 依赖 dpd_audio.db |
| variants | 异文提取，前端不需要 |
| frequency (Go) | 三藏词频统计，前端不需要。缺三藏词表时 deconstructor 仍可运行，仅少部分三藏特有词识别 |
| families (5 个) | 词族关系，前端不需要 |
| Anki 导出 | Anki 牌组 |
| transliterate | 天城体/僧伽罗/泰文转写 |
| suttas | 经文信息，依赖 Google Sheets API |
| ebt_counter | 词频计数 |
| audio | TTS 音频，依赖 Bhashini API |
| dealbreakers | 完整性检查 |

### 构建命令序列

```bash
cd /path/to/dpd-db

# 前置：确保 config.ini 存在（否则 Go 模块会 panic）
cat config.ini  # 必须包含 [generate] deconstructor = yes

# 前置：安装缺失的 Python 依赖
uv add pandas openpyxl

# 1. 重建核心表
uv run python scripts/build/db_rebuild_from_tsv.py

# 2. 变格模板 + 变格表
uv run python db/inflections/create_inflection_templates.py
uv run python db/inflections/generate_inflection_tables.py

# 3. 词形索引
uv run python db/inflections/inflections_to_headwords.py

# 4. Lookup 表填充
uv run python db/grammar/grammar_to_lookup.py
uv run python db/lookup/see.py
uv run python db/lookup/spelling_mistakes.py
uv run python db/lookup/transliterate_lookup_table.py
uv run python db/lookup/help_abbrev_add_to_lookup.py
uv run python db/epd/epd_to_lookup.py
uv run python exporter/webapp/generate_search_index.py

# 5. 复合词拆解（Go 模块）
# 前置：需创建空 freq JSON 防 panic
echo '{}' > shared_data/frequency/cst_freq.json
echo '{}' > shared_data/frequency/bjt_freq.json
echo '{}' > shared_data/frequency/sya_freq.json
echo '{}' > shared_data/frequency/sc_freq.json
echo '[]' > shared_data/frequency/cst_wordlist.json
echo '[]' > shared_data/frequency/bjt_wordlist.json
echo '[]' > shared_data/frequency/sya_wordlist.json
echo '[]' > shared_data/frequency/sc_wordlist.json

go run go_modules/deconstructor/main.go
# ↑ 会输出 matches.tsv + deconstructor_output.json
# 重要：会 DELETE FROM lookup 然后重建，确保前面步骤已填充数据

# 6. 拆解结果写入 lookup 表
# 前置：复制 Go 输出到 Python 期望路径
cp go_modules/deconstructor/output/deconstructor_output.json \
   resources/deconstructor_output/deconstructor_output.json

uv run python scripts/build/deconstructor_output_add_to_db.py

# 7. 导出精简版
uv run python scripts/export/web_db.py
# 输出: exporter/share/dpd-web.db.gz (~11 MB)
```

### 已知陷阱

1. **config.ini 必须存在** — Go 模块启动时会 `ini.Load("config.ini")`，不存在则 panic。至少需要：
   ```ini
   [generate]
   deconstructor = yes
   ```

2. **deconstructor 会清空 lookup 表** — `matchdata.go:462` 执行 `DELETE FROM lookup` 然后重建。如果重建时发生 panic（如缺少 freq JSON），lookup 表会变为空表。务必先做好 dummy JSON 文件再跑。

3. **Go 输出路径 vs Python 期望路径不一致**：
   - Go 写入：`go_modules/deconstructor/output/deconstructor_output.json`
   - Python 读取：`resources/deconstructor_output/deconstructor_output.json`
   - 需要手动复制

4. **缺少 Python 依赖** — `pandas`、`openpyxl` 需要额外安装（不在 pyproject.toml 中）。

5. **frequency 模块不可用** — 需要四版三藏子模块完整拉取 + variants 前置数据。缺省时 deconstructor 使用 `DpdHeadword.inflections` 作为已知词表，可以覆盖绝大部分常见词汇。

### 子模块状态

| 子模块 | 路径 | 用途 | 是否需要 |
|--------|------|------|---------|
| `resources/dpd_submodules/cst/romn/` | CST XML 三藏 | variants / frequency | ❌ 跳过后不影响核心功能 |
| `resources/dpd_submodules/bjt/.../roman_json/` | BJT JSON 三藏 | variants / frequency | ❌ |
| `resources/sc-data/` | SC Bilara 语料 | variants / frequency | ❌ |
| `resources/syāmaraṭṭha_1927/` | SYA 泰版三藏 | variants / frequency | ❌ |
| `resources/deconstructor_output/` | 拆解结果存储 | 复合词拆解输出 | ✅ 需要（空目录即可，文件由 Python 脚本写入） |

---

## 油猴脚本文档

### 技术架构

| 层 | 选型 | 说明 |
|----|------|------|
| 构建工具 | **Vite** + esbuild | Vite 开发服务器 + esbuild 打包 IIFE |
| 语言 | **JavaScript** | ESM 模块组织 |
| SQLite | **sql.js** | 浏览器端 SQLite WASM |
| 解压 | **pako**（@require） | gzip 解压 |
| 存储 | **IndexedDB** + localStorage | 数据缓存 + 用户设置 |

### 项目结构

```
wiki-pali-dpd/
├── package.json              # Vite + esbuild devDependency
├── vite.config.js            # Vite 配置
├── scripts/
│   ├── vite-userscript.js    # Vite 插件：油猴脚本构建 + DB 数据拷贝 + version.json
│   └── export/
│       └── web_db.py         # dpd.db → dpd-web.db.gz 导出脚本
├── src/
│   ├── config.js             # 共享配置：站点白名单、版本号、部署 URL
│   ├── meta.js               # 油猴元数据头模块（从 config.js 取版本号）
│   ├── version.js            # 版本信息（从 config.js 导入）
│   ├── main.js               # 入口：域名路由 → DeepSeek Agent / WikiPali 主逻辑
│   ├── db/
│   │   ├── loader.js         # fetch + ReadableStream 进度 + pako 解压
│   │   └── query.js          # sql.js 查询封装（预编译 SQL stmt + CSV 兜底）
│   ├── inflection/
│   │   └── renderer.js       # 变格表渲染（stem+suffix→HTML）
│   ├── ui/
│   │   ├── injector.js       # MutationObserver + 事件委托监听搜索
│   │   ├── panel.js          # 工具条（变格表+拆解+释义）
│   │   └── settings.js       # 设置弹窗（清缓存、版本信息）
│   ├── llm/
│   │   ├── deepseek-agent.js # DeepSeek 网页端 Agent（自动填充/回复）
│   │   ├── llm-main.js       # LLM 集成入口（选中浮窗开关）
│   │   ├── llm-panel.js      # 选中文本浮动菜单 + 拖拽/缩放
│   │   ├── llm-cache.js      # LLM 问答记录缓存 + 展示面板
│   │   ├── llm-communicator.js # GM storage 跨标签页通信
│   │   └── llm-presets.js    # 预设提示词
│   └── storage/
│       ├── cache.js          # IndexedDB 读写封装
│       └── history.js        # 查询历史（分页面板）
├── docs/                     # 技术文档
└── dist/
    ├── wiki-pali-dpd.user.js # 构建产物（~130 KB）
    ├── index.html            # 介绍页
    ├── version.json          # 版本信息（构建时生成）
    └── dpd-web.db.gz         # 词典数据（可选）
```

### 构建方式

```bash
cd wiki-pali-dpd
npm install           # 安装依赖（Vite + esbuild）
npm run dev           # 开发：Vite 开发服务器 + 油猴脚本热更新
npm run build         # 生产构建：打包脚本 + 拷贝 DB + 生成 version.json
```

### 客户端执行流程

```
页面加载
    ↓
@require 注入 sql.js + pako
    ↓
检查 IndexedDB 是否有 dpd-web.db 缓存
    ├─ 无缓存 → 弹出初始化提示
    │           ↓ 用户点击"下载"
    │           fetch(dpd-web.db.gz) → 进度条
    │           pako.ungzip → sql.js 加载
    │           IndexedDB.put → 标记已缓存
    │
    └─ 有缓存 → IndexedDB.get → sql.js 加载
    ↓
MutationObserver 监听 div#rc-tabs-0-panel-result
    ↓
用户操作（输入框键入 / 点击文中 span.pcd_word / 搜索按钮）
    ↓
WikiPali React 渲染搜索结果
    ↓
脚本检测到结果容器变化 → 读取 input#rc_select_0 的值
    ↓
SQL: SELECT * FROM lookup WHERE lookup_key = ?
    │
    ├─ 匹配 → 查 headwords → 查 inflection_templates
    │         在搜索结果上方插入 ▶ DPD 工具条
    │         ├─ 点击展开 → 变格表 HTML + 复合词拆解 + 释义
    │         └─ 再次点击 → 折叠
    │
    └─ 不匹配 → 不显示任何内容
```

### 目标页面 DOM 结构

脚本适配的 WikiPali 页面（Ant Design React）：

```
input#rc_select_0              ← 搜索输入框
button.ant-input-search-button ← 搜索按钮
div#rc-tabs-0-panel-result     ← 搜索结果容器（MutationObserver 目标）
span.pcd_word                  ← 文中词标签（点击后 React 填充搜索）
```

### 数据加载流程

```
首次访问:
  GM_getValue("dpd_data_url") → 获取数据 URL（需在油猴控制台设置）
  fetch(url) → ReadableStream 分块下载 → onProgress(0-100)
  pako.ungzip → new SQL.Database(buffer)
  IndexedDB.put("dpd_web_db", buffer)

后续访问:
  IndexedDB.get("dpd_web_db") → 直接加载 sql.js
```

数据 URL 通过 `GM_setValue("dpd_data_url", "https://...")` 配置。

### 查询 API

```javascript
query.lookupWord("lokaṃ")
  → { lookup_key, headwords: "[1]", deconstructor, grammar, spelling, see }

query.getHeadword(1)
  → { id, lemma_1, pos, stem, pattern, meaning_1, meaning_lit }

query.getTemplate("masc__a")
  → { pattern, like, data: "[[[...]]]" }

query.getAllTemplates()
  → Map<string, {pattern, like, data}>
```

### 变格表渲染

`stem + pattern + templates` → HTML table：

```javascript
const renderer = new Renderer(query.getAllTemplates());
const html = renderer.render("loka", "masc__a");
```

不依赖 `headwords.inflections` 列。所有变格形式在客户端即时拼装。

### 输出文件

| 文件 | 位置 | 大小 |
|------|------|------|
| 构建产物 | `dist/wiki-pali-dpd.user.js` | ~130 KB |
| 版本信息 | `dist/version.json` | 构建时动态生成 |
| 导出数据 | `data/dpd-web.db.gz` | ~11 MB |
| 数据模版 | `scripts/export/web_db.py` | — |

### 开发指南

1. **修改源码**：编辑 `src/` 下模块，运行 `npm run build`
2. **测试**：启动 dev + test 服务器，在 `http://127.0.0.1:8080/test/` 调试
3. **调试**：打开油猴控制台查看 `self.__DPD` 对象，`GM_setValue("dpd_debug", true)` 开启详细日志
4. **数据更新**：在 dpd-db 项目重新运行导出步骤，更新 `dpd-web.db.gz` 并上传
5. **@match 调整**：如果目标页面 URL 变更，同步修改 `src/config.js` 的 `DPD_SITES` 白名单和 `src/meta.js` 的 `@match` 规则后重新构建
6. **公共配置**：站点白名单、版本号、数据 URL 集中在 `src/config.js`，修改一处即可
