/**
 * 监听 WikiPali 搜索事件，匹配 DPD 数据后插入工具条。
 *
 * 触发时机（仅在搜索确认时，不在每个字符键入时）：
 *   1. 回车键
 *   2. 点击搜索按钮
 *   3. 选择 AutoComplete 下拉提示（输入框失焦 + 值变化）
 *   4. 点击文中词 (pcd_word)
 *
 * DOM 特点：
 *   - 结果容器 ID 递增 rc-tabs-N，不能缓存引用
 *   - 搜索框 ID 递增 rc_select_N，通过 .dict_search_div 锚点定位
 *   - React 会销毁重建节点，采用 document 级事件委托
 */
export class Injector {
    constructor(query, Panel, history) {
        this.query = query;
        this.Panel = Panel;
        this.history = history;
        this._observer = null;
        this._lastWord = "";
        this._pending = null;
        this._panelInstance = null;
    }

    _log() {
        if (GM_getValue("dpd_debug", false)) {
            var args = Array.prototype.slice.call(arguments);
            args.unshift("[DPD]");
            console.log.apply(console, args);
        }
    }

    _tagSummary(el) {
        if (!el) return "null";
        return el.tagName + (el.id ? "#" + el.id : "") + (el.className ? "." + el.className.trim().split(/\s+/).join(".") : "");
    }

    _findInput() {
        var container = document.querySelector(".dict_search_div");
        if (container) {
            var inp = container.querySelector("input");
            if (inp) return inp;
        }
        return document.querySelector("input.ant-input")
            || document.querySelector("input[id^='rc_select_']");
    }

    _getInputWord() {
        var input = this._findInput();
        return input ? input.value.trim().toLowerCase().normalize("NFC") : "";
    }

    start() {
        var self = this;
        this._log("start");

        // ── 回车 ───────────────────────────────────
        document.addEventListener("keydown", function (e) {
            if (e.key !== "Enter") return;
            var container = document.querySelector(".dict_search_div");
            if (container && container.contains(e.target)) {
                setTimeout(function () {
                    var val = self._getInputWord();
                    if (val) { self._queryDpd(val); }
                }, 0);
            }
        });

        // ── 搜索按钮点击 ────────────────────────────
        document.addEventListener("click", function (e) {
            try {
                var btn = e.target.closest("button.ant-input-search-button");
                if (btn) {
                    setTimeout(function () {
                        var val = self._getInputWord();
                        if (val) { self._queryDpd(val); }
                    }, 0);
                }
            } catch (err) {
                // closest 在 detached 元素上可能抛 DOMException
            }
        });

        // ── 选择 AutoComplete 下拉提示 ──────────────
        // 下拉选项在 .ant-select-dropdown 中（Ant Design 渲染到 body）
        document.addEventListener("click", function (e) {
            try {
                var option = e.target.closest('div[role="option"]');
                if (!option) return;
                var dd = option.closest(".ant-select-dropdown");
                if (!dd) return;
                // 确认是搜索框的下拉，而非其他组件
                var input = self._findInput();
                if (!input) return;
                setTimeout(function () {
                    var val = self._getInputWord();
                    if (val && val !== self._lastWord) {
                        self._lastWord = val;
                        self._log("autocomplete: \"" + val + "\" -> queryDpd");
                        self._queryDpd(val);
                    }
                }, 50);
            } catch (err) { /* ignore */ }
        }, true);

        // ── MutationObserver 兜底 ──────────────────
        // 仅处理输入框失焦后的值变化（非键入时），
        // 及面板被 React 移除后重新注入
        this._observer = new MutationObserver(function () {
            self._onBodyChange();
        });
        this._observer.observe(document.body, { childList: true, subtree: true });
        this._onBodyChange();
    }

    stop() {
        if (this._observer) this._observer.disconnect();
        this._removePanel();
    }

    _recheck() {
        this._lastWord = "";
        var val = this._getInputWord();
        if (val) this._queryDpd(val);
    }

    // ── 每次 body 变动检查 ──────────────────────────
    _onBodyChange() {
        var self = this;

        // 绑定文中词点击
        var pcdWords = document.querySelectorAll("span.pcd_word");
        for (var pi = 0; pi < pcdWords.length; pi++) {
            if (!pcdWords[pi]._dpd_listening) {
                pcdWords[pi]._dpd_listening = true;
                pcdWords[pi].addEventListener("click", function () {
                    var word = this.textContent.trim().toLowerCase().normalize("NFC");
                    if (word && word !== self._lastWord) {
                        self._lastWord = word;
                        self._log("pcd_word: \"" + word + "\" -> queryDpd");
                        self._queryDpd(word);
                    }
                });
            }
        }

        // 仅在输入框失焦时检查值变化（避免键入时频繁触发）
        var input = this._findInput();
        if (input && document.activeElement !== input) {
            var val = this._getInputWord();
            if (val && val !== this._lastWord) {
                this._lastWord = val;
                this._log("blur-detect: \"" + val + "\" -> queryDpd");
                this._queryDpd(val);
            }
        }

        // 面板被 React 移除后重新注入
        if (this._pending && !this._isPanelInDom()) {
            var container = this._findResultContainer();
            if (container) {
                this._log("re-inject: panel 不在 DOM，容器=" + this._tagSummary(container));
                this._doInject(container);
            }
        }
    }

    _isPanelInDom() {
        return this._panelInstance && this._panelInstance._el
            && this._panelInstance._el.parentNode
            && document.body.contains(this._panelInstance._el);
    }

    // ── DPD 查询 ────────────────────────────────────
    _queryDpd(word) {
        this._pending = null;

        var lookupRow = this.query.lookupWord(word);
        var source = "lookup";
        if (!lookupRow || !lookupRow.headwords) {
            lookupRow = this.query.searchInflections(word);
            source = "inflections";
            if (!lookupRow) {
                this._log("_queryDpd: \"" + word + "\" 未找到");
                return;
            }
        }

        var headwordIds;
        try {
            headwordIds = JSON.parse(lookupRow.headwords);
        } catch (e) {
            this._log("_queryDpd: headwords parse fail");
            return;
        }
        if (!headwordIds || headwordIds.length === 0) return;

        var headwords = this.query.getHeadwords(headwordIds);
        if (!headwords || headwords.length === 0) return;

        this._log("_queryDpd: \"" + word + "\" (" + source + "), " + headwords.length + " results");

        var deconstruction = null;
        if (lookupRow.deconstructor) {
            try {
                deconstruction = JSON.parse(lookupRow.deconstructor);
            } catch (e) { /* ignore */ }
        }

        this._pending = { word: word, headwords: headwords, lookupRow: lookupRow, deconstruction: deconstruction };

        var container = this._findResultContainer();
        if (container) {
            this._doInject(container);
        }
    }

    // ── 注入面板 ────────────────────────────────────
    _doInject(container) {
        if (!this._pending) return;
        var p = this._pending;
        this._removePanel();

        var autoShow = GM_getValue("dpd_auto_show", true);
        var panel = new this.Panel(
            p.word, p.headwords, p.lookupRow, p.deconstruction, this.query, autoShow
        );
        panel.injectBefore(container);
        this._panelInstance = panel;

        this._log("_doInject: \"" + p.word + "\"");

        this.history.add({ word: p.word, headword: p.headwords[0].lemma_1, timestamp: Date.now() });
    }

    _removePanel() {
        if (this._panelInstance) {
            this._panelInstance.remove();
            this._panelInstance = null;
        }
    }

    _findResultContainer() {
        return document.querySelector(".ant-tabs-tabpane-active[id$='-panel-result']")
            || document.querySelector("div#rc-tabs-0-panel-result")
            || null;
    }
}
