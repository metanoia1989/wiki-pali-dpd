# 变格模板匹配机制

## 概述

DPD 中每个词头的变格表由 `stem`（词干）+ `pattern`（模板名）决定。本文档说明 pattern 的命名规则、词性到模板的映射关系，以及形容词与名词在模板复用上的区别。

## 数据来源

以下分析基于 `dpd-web.db`（2026-07 版）的实际数据。

| 表 | 行数 | 作用 |
|------|------|------|
| `headwords` | 89,114 | 每个词头的词干、词性、模板 |
| `inflection_templates` | 154 | 所有变格/变位模板 |

## 模板命名规则

模板名采用 `{词尾} {词性分类}` 格式：

| 模式 | 示例模板 | 说明 |
|------|---------|------|
| `{ending} adj` | `u adj`, `a adj`, `ī adj` | 形容词——**一张表含三性** |
| `{gender}__{ending}` | `masc__a`, `fem__ā`, `nt__a` | 名词——**按性别分表** |
| `{gender}` | `masc`, `fem`, `nt` | 特殊词尾名词（如 `u masc`, `u nt`） |
| `{pos}__{type}` | `verb__pr`, `verb__aor` | 动词变位（现在时、不定过去时等） |
| `irreg` | `irreg__as`, `jantu masc` | 不规则变格 |

### 形容词模板的性别列布局

形容词模板在一张表内包含三个性别的列。以 `u adj` 为例：

```
[u adj 模板结构]
            masc sg    masc pl    fem sg    fem pl    neut sg    neut pl
Nom         u          avo, ū     u, unī    uyo, ū    u          ū, ūni
Acc         uṃ         avo, ū     uṃ        uyo, ū    uṃ         ū, ūni
Instr       unā        ubhi...    uyā       ūhi       unā        ūhi
...
```

同一个 `stem` 拼接不同性别的后缀即可生成三张变格表，渲染时客户端取对应性别列即可。

## 词性到模板的映射规则

一个词头的 `pattern` 由两个因素决定：

1. **词干的末尾字母（或结尾模式）**
2. **词性（pos）** — adj / masc / nt / fem / verb / ind 等

### 名词

名词的 pattern 直接由性别 + 词尾编码在模板名中：

| 词尾 | 阳性 | 中性 | 阴性 |
|------|------|------|------|
| -a | `a masc` → like `masc__a` | `a nt` → like `nt__a` | `ā fem` → like `fem__ā` |
| -i | `i masc` | `i nt` | `i fem` |
| -u | `u masc` | `u nt` | `u fem` |
| -ī | — | — | `ī fem` |
| -ū | — | — | — |

名词模板只包含对应性别的列（单数 + 复数，共 2 或 4 列）。

### 形容词

形容词的 pattern 统一按词尾匹配 `{ending} adj` 模板：

| 词尾 | 模板 | 性别列数 |
|------|------|---------|
| -a | `a adj` | masc + fem + nt（6 列） |
| -ā | `ā adj` | masc + fem + nt |
| -i | `i adj` | masc + fem + nt |
| -ī | `ī adj` | masc + fem + nt |
| -u | `u adj` | masc + fem + nt |
| -ū | `u adj` | masc + fem + nt |
| -nt | `nt adj` | masc + fem + nt |
| -mant | `mant adj` | masc + fem + nt |
| -vant | `vant adj` | masc + fem + nt |

其中 `-u` 结尾的形容词与 `-ū` 结尾（如 `sādhū`）共享 `u adj` 模板，因为它们遵循相同的变格规则。

### 不变词（indeclinable）

词性为 `ind` 的词没有 pattern，词干标记为 `-`，不生成变格表。

### 动词

动词 pattern 按时态 + 变位类型命名：

| 模板 | 说明 |
|------|------|
| `verb__pr` | 现在时（一般变位） |
| `verb__aor` | 不定过去时（一般变位） |
| `ssati fut` | -ss- 将来时 |
| `issati fut` | -iss- 将来时 |
| `ati fut` | 以 -ati 结尾的将来时 |
| `hiti fut` | 以 -hiti 结尾的将来时 |
| 多个 `aor` 模板 | `i aor aṃsu`, `i aor isuṃ`, `āsi aor iṃsu` 等 |

## 示例：sādhu

```
sādhu 1   adj   stem=sādh   pattern=u adj   → u adj 模板（三性 6 列，渲染选 masc 列）
sādhu 5   nt    stem=sādh   pattern=u nt    → u nt 模板（仅中性 2 列）
sādhu 6   masc  stem=sādh   pattern=u masc  → u masc 模板（仅阳性 2 列）
```

三者词干相同（`sādh`），但模板不同，生成不同的变格表。渲染时都是将 `sādh` 拼接模板中的后缀：

| 格 | sādhu 1 (adj, masc) | sādhu 6 (masc) | sādhu 5 (nt) |
|------|-------------------|----------------|--------------|
| Nom.sg | sādh + `u` → **sādhu** | sādh + `u` → **sādhu** | sādh + `u, uṃ` → **sādhu, sādhuṃ** |
| Instr.sg | sādh + `unā` → **sādhunā** | sādh + `unā` → **sādhunā** | sādh + `unā` → **sādhunā** |
| Nom.pl | sādh + `avo, ū` → **sādhavo, sādhū** | sādh + `avo, ū` → **sādhavo, sādhū** | sādh + `ū, ūni` → **sādhū, sādhūni** |

注意形容词 `sādhu 1` 虽然使用 `u adj` 模板（包含三性），但渲染时根据上下文只展开所需性别的列。名词模板则只存对应性别的数据，没有冗余列。

## 模板解析链

渲染时 `renderer.js` 的 `_resolvePattern` 会沿 `like` 链向上查找最终数据：

```
u adj       → like = "bahu"    → 本身包含 data，直接使用
a masc      → like = "masc__a" → like = "masc__a" → 找到 data 为 masc__a 的数据
irreg__as   → like = "irreg"   → 停止链查找，使用自身 data
```

最大深度 5 层，防止循环引用。

## 查询时的变格表渲染流程

```
用户输入 "sādhunā"
  → lookup 表查到 headwords = [62220, 62224, 74546]
  → 加载 headwords[0] (sādhu 1): stem=sādh, pattern=u adj
  → 从 inflection_templates 取 u adj 的 data JSON
  → Renderer.render("sādh", "u adj")
  → 拼接出 HTML 变格表
  → 注入到页面面板
```
