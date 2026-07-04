# WikiPali 搜索流程分析及 DPD 注入策略

## 背景

wiki-pali-dpd 是一个 Tampermonkey 用户脚本，在 WikiPali 页面搜索巴利语单词时，从本地 SQLite（dpd-web.db）查询 DPD 词典数据，并将变格表、释义、复合词拆解等信息注入到搜索结果上方。

脚本同时支持 chat.deepseek.com（LLM Agent），通过 `src/config.js` 中的 `DPD_SITES` 白名单隔离两种场景：
- **白名单站点**（wikipali.cc / wikipali.org / localhost）：加载词典数据 + DOM 注入
- **白名单外站点**（chat.deepseek.com）：仅启动 DeepSeek Agent，跳过词典数据

核心挑战：WikiPali 使用 React + Redux + Ant Design 架构，搜索结果容器在每次搜索时被完全销毁重建。脚本需要在不侵入 React 代码的前提下，可靠地拦截搜索事件并注入内容。

---

## 一、WikiPali 搜索架构分析

### 1.1 项目结构

WikiPali 前端代码位于 `dashboard-v6/src/`，关键目录：

| 路径 | 职责 |
|------|------|
| `components/dict/` | 词典查询相关组件 |
| `components/template/` | 模板渲染，含 `WdCtl`（文中词点击） |
| `reducers/` | Redux store |
| `store.ts` | Redux store 配置 |

### 1.2 完整搜索链路

```
用户操作
    │
    ├── 搜索框输入 (SearchVocabulary.tsx)
    │     └── AutoComplete + Input.Search
    │         └── onSearch/onSelect → dictSearch(word)
    │
    ├── 文中词点击 (Wd.tsx)
    │     └── store.dispatch(lookup(text))
    │
    ├── 复合词选择 (Compound.tsx)
    │
    └── URL 参数恢复
          │
          ▼
    Redux state.command.lookup = word
          │
          ▼
    DictComponent (useAppSelector(lookupWord))
          │
          ▼
    Dictionary (布局容器)
          │
          ├── SearchVocabulary (搜索框)
          ├── Compound (复合词选择器)
          └── DictSearch → useDict(word) hook
                │
                ├── useEffect([word]) → API: GET /api/v2/dict?word=...
                │     ├── loading → spinner
                │     └── data → DictContent
                │
                └── DictContent (Ant Design Tabs)
                      ├── Tab "result" → WordCard 列表
                      └── Tab "my" → 单词本
```

### 1.3 关键组件细节

#### WdCtl — 文中词点击

文件：`components/template/Wd.tsx`

```tsx
export const WdCtl = ({ text }) => {
  return (
    <span className="pcd_word" onClick={() => {
      store.dispatch(lookup(text));
    }}>
      {text}
    </span>
  );
};
```

- 点击 `span.pcd_word` → 直接 `dispatch(lookup(text))` 写入 Redux
- 不等待输入框更新，不触发 input 事件

#### SearchVocabulary — 搜索输入框

文件：`components/dict/SearchVocabulary.tsx`

```tsx
<AutoComplete
  value={input}
  onChange={(val) => { setInput(val); }}
  onSelect={(val) => { onSearch?.(val); }}
>
  <Input.Search
    placeholder="search here"
    onSearch={(val) => { onSearch?.(val); }}
  />
</AutoComplete>
```

- 使用 Ant Design `AutoComplete` + `Input.Search`
- 内部渲染为 `input#rc_select_0`
- 用户输入时触发 `onChange` → `setInput`；回车或选择时触发 `onSearch`

#### useDict — 数据获取 Hook

文件：`components/dict/hooks/useDict.ts`

```typescript
useEffect(() => {
  if (!word) return;
  const fetchData = async () => {
    setLoading(true);
    const res = await fetchDictByWord(word);
    setData(res.data);
  };
  fetchData();
}, [word, tick]);
```

- 监听 `word` 变化 → 调用 `GET /api/v2/dict?word=...` → 更新 `data`
- 依赖 `tick` 支持手动刷新
- 使用 cleanup 函数防止竞态

#### DictContent — 搜索结果面板

文件：`components/dict/DictContent.tsx`

```tsx
<Tabs
  activeKey={tab}
  onChange={setTab}
  items={[
    { key: "result", label: "查询结果", children: <WordCardList data={data} /> },
    { key: "my", label: "单词本", children: <MyWordBook /> },
  ]}
/>
```

- 使用 Ant Design `<Tabs>` 组件
- 内部由 `rc-tabs` 驱动，DOM ID 格式 `rc-tabs-{n}-panel-result`（n 随渲染次数递增）
- 每次搜索重建整个 Tab 面板，替换旧的 DOM 节点

### 1.4 DOM 结构特点

```
div.ant-tabs (稳定)
  div.ant-tabs-nav (tab 导航栏)
  div.ant-tabs-content-holder
    div.ant-tabs-content
      div#rc-tabs-{n}-panel-result.ant-tabs-tabpane-active (每次搜索销毁重建)
        div.ant-card (WordCard 列表)
```

**关键约束**：
- 结果容器 DIV 的 ID 每次搜索递增（`rc-tabs-3` → `rc-tabs-4` → ...）
- 容器 DOM 节点被 React 完全销毁、新建、插入
- **搜索输入框的 ID 也每次递增**（`rc_select_0` → `rc_select_5` → ...），由 Ant Design `rc-select` 内部计数器生成
- 脚本无法通过 React Context 或 Redux 直接订阅（Tampermonkey 沙箱隔离）
- 搜索框 `.dict_search_div` 外层容器类名稳定，可作为锚点

---

## 二、拦截与注入策略

### 2.1 设计原则

1. **零轮询** — 所有触发必须是事件驱动的
2. **零延迟** — DPD 数据在本地 SQLite 中，查询应即时返回
3. **容器无关** — 不缓存任何 DOM 引用，注入时重新查询
4. **路径无关** — 同一策略处理输入框输入和文中词点击两条路径

### 2.2 架构

```
body MutationObserver (全局)
    │
    ├── 发现 input#rc_select_0 → 绑定 input 事件
    ├── 发现 span.pcd_word → 绑定 click 事件
    └── 检测 pending + 结果容器存在 → 执行注入
            │
            ▼
    输入框 input 事件 / pcd_word click 事件
            │
            ▼
    _onWordDetected() / pcd_word click handler
            │
            ├── 从事件源取词（input.value / span.textContent）
            ├── 查重：_lastWord 防重复
            └── _queryDpd(word)
                    │
                    ├── lookupWord(word) + searchInflections(word)
                    ├── getHeadwords(ids)
                    ├── 缓存结果到 _pending
                    │
                    └── 容器存在？ → 是 → _doInject()
                                    否 → 等待 MutationObserver
                                            │
                                            ▼
                                    _onBodyChange() 检测到容器
                                            │
                                            ▼
                                    _doInject(container)
                                            │
                                            ├── panel.injectBefore(container)
                                            ├── 记录 history
                                            └── 调试日志
```

### 2.3 事件源拦截

#### 输入框定位

搜索输入框的 ID 每次 React 渲染递增（`rc_select_0` → `rc_select_5`），不能依赖固定 ID。改为通过稳定外层容器查找：

```javascript
_findInput() {
    var container = document.querySelector(".dict_search_div");
    if (container) {
        var inp = container.querySelector("input");
        if (inp) return inp;
    }
    return document.querySelector("input.ant-input")
        || document.querySelector("input[id^='rc_select_']");
}
```

#### 路径 A：搜索框输入

输入框本身可能被 React 重建，改为 **document 级事件委托**：

```javascript
// 按键捕获
document.addEventListener("keyup", function (e) {
    var container = document.querySelector(".dict_search_div");
    if (container && container.contains(e.target)) {
        setTimeout(function () {
            var val = self._getInputWord();
            if (val && val !== self._lastWord) {
                self._lastWord = val;
                self._queryDpd(val);
            }
        }, 0);
    }
});

// 回车（keydown 比 keyup 早，适合拦截确认搜索）
document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var container = document.querySelector(".dict_search_div");
    if (container && container.contains(e.target)) {
        setTimeout(function () {
            var val = self._getInputWord();
            if (val) self._queryDpd(val);
        }, 0);
    }
});

// 搜索按钮点击
document.addEventListener("click", function (e) {
    var btn = e.target.closest("button.ant-input-search-button");
    if (btn) {
        setTimeout(function () {
            var val = self._getInputWord();
            if (val) self._queryDpd(val);
        }, 0);
    }
});
```

- `setTimeout(0)` 让 React 先处理事件、更新 input.value，再读取
- 不直接绑定到 input 元素，避免因元素重建导致监听丢失
- `_lastWord` 去重防止同一值的重复查询

#### 路径 B：文中词点击

```javascript
span.pcd_word.addEventListener("click", function () {
    var word = this.textContent.trim().toLowerCase().normalize("NFC");
    if (word && word !== self._lastWord) {
        self._lastWord = word;
        self._queryDpd(word);
    }
});
```

- 直接从 `span.textContent` 取词，**不**从输入框读取
- 此时 Redux 尚未更新（`store.dispatch(lookup(text))` 后续执行）
- 查询完成后，容器可能还不存在 → 存入 pending

### 2.4 注入容器等待机制

当 `_queryDpd` 完成时，结果容器可能尚未渲染（React 还未处理 Redux dispatch → API 调用 → 渲染）。此时：

```javascript
// 查询结果缓存
this._pending = { word, headwords, lookupRow, deconstruction };

// 尝试立即注入
var container = this._findResultContainer();
if (container) {
    this._doInject(container);
}
// 否则等待 MutationObserver 发现容器
```

`_findResultContainer()` 使用实时 DOM 查询，不缓存：

```javascript
_findResultContainer() {
    return document.querySelector(".ant-tabs-tabpane-active[id$='-panel-result']")
        || document.querySelector("div#rc-tabs-0-panel-result")
        || null;
}
```

`_onBodyChange()`（在 body MutationObserver 中）每次执行都检查 pending 状态：

```javascript
if (this._pending) {
    var container = this._findResultContainer();
    if (container) {
        this._doInject(container);
    }
}
```

### 2.5 数据流全景

```
用户点击 pcd_word "dhamma"
    │
    ├── [我们的脚本]
    │     └── click handler → _queryDpd("dhamma")
    │           ├── lookupWord("dhamma") → JSON 解析 headwords
    │           ├── getHeadwords([...]) → 6 个词条
    │           ├── 缓存 _pending
    │           └── 容器? 无 → 等待
    │
    ├── [WikiPali React]
    │     └── store.dispatch(lookup("dhamma"))
    │           └── Redux → DictComponent → Dictionary
    │                 └── useDict("dhamma") → API 请求
    │                       └── setData → DictContent → Tabs
    │                             └── React 创建 #rc-tabs-4-panel-result
    │                                   └── DOM 插入 body
    │
    └── [body MutationObserver 触发]
          └── _onBodyChange()
                ├── pending = {word:"dhamma", ...}
                ├── container = #rc-tabs-4-panel-result ✓
                └── _doInject(container)
                      └── Panel.injectBefore(container)
                            ├── 曲折分析表
                            ├── 复合词拆解 (如有)
                            └── 词条列表
```

### 2.6 为什么之前的方案失败

| 方案 | 问题 |
|------|------|
| 固定 ID `#rc-tabs-0-panel-result` | WikiPali 升级后 ID 不再固定 |
| 固定 ID `input#rc_select_0` | Ant Design 每次渲染 ID 递增，重建后监听丢失 |
| 缓存容器引用 `this._resultContainer` | React 每次搜索销毁重建节点，引用悬空 |
| MutationObserver 绑定到结果容器 | 容器被替换后 observer 丢失 |
| 取 `.ant-tabs-tabpane-active` 最后一个 | 多个 tab 同时 active，取错 |
| `setTimeout` 延迟注入 | 用户明确反对延迟方案 |
| `Object.defineProperty` 拦截 input.value | 作用域问题导致报错 |
| `input` 事件绑定到 input 元素 | Ant Design 重建元素后监听丢失 |
| 依赖 `_onBodyChange` 值检查 | input ID 变化 → querySelector 找不到 → 值始终为空 |

### 2.7 最终方案的核心优势

- **事件驱动**：`keyup`、`keydown`、`click`、`MutationObserver` — 均为浏览器原生事件，无轮询
- **零延迟**：DPD 查询使用本地 SQLite（sql.js WebAssembly），10 万行级查询 < 1ms
- **容器无关**：`_findResultContainer()` 每次实时查询 DOM，不缓存任何引用
- **输入框无关**：通过 `.dict_search_div` 锚点实时查找输入框，不依赖递增 ID `rc_select_N`
- **document 级事件委托**：不直接绑定到 input 元素，避免因 React 重建元素导致监听丢失
- **双路径统一**：搜索框输入和文中词点击经同一 `_queryDpd` → `_doInject` 管道处理
- **幂等注入**：`_lastWord` 防重复 + `_removePanel()` 先清理旧面板
- **可调试**：`dpd_debug` 模式下输出完整的事件触发链路和注入位置
