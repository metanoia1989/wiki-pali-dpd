/**
 * 监听 WikiPali 搜索事件，匹配 DPD 数据后插入工具条。
 *
 * WikiPali React 每次搜索会销毁重建结果容器（ID 随 tab 变化），
 * 导致注入的面板也被移除。方案：
 *   1. 事件驱动取词（input / pcd_word click），零延迟
 *   2. _pending 持久缓存最后一次查询结果
 *   3. 每次 MutationObserver 触发时检测面板是否还在 DOM 中
 *   4. 不在则重新注入
 */
export class Injector {
    constructor(query, Panel, history) {
        this.query = query;
        this.Panel = Panel;
        this.history = history;
        this._observer = null;
        this._lastWord = "";
        this._pending = null;   // 最后一次查询结果，持久化，不清除
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

    start() {
        var self = this;
        this._log("start");
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
        this._onWordDetected();
    }

    // ── 每次 body 变动检查 ──────────────────────────
    _onBodyChange() {
        var self = this;

        // 1. 绑定搜索输入框
        var input = document.querySelector("input#rc_select_0");
        if (input && !input._dpd_listening) {
            input._dpd_listening = true;
            input.addEventListener("input", function () {
                self._onWordDetected();
            });
            this._log("_onBodyChange: input bound");
        }

        // 2. 绑定文中词点击
        var pcdWords = document.querySelectorAll("span.pcd_word");
        for (var pi = 0; pi < pcdWords.length; pi++) {
            if (!pcdWords[pi]._dpd_listening) {
                pcdWords[pi]._dpd_listening = true;
                pcdWords[pi].addEventListener("click", function () {
                    var word = this.textContent.trim().toLowerCase().normalize("NFC");
                    if (word && word !== self._lastWord) {
                        self._lastWord = word;
                        self._log("_onWordDetected: \"" + word + "\" (pcd_word)");
                        self._queryDpd(word);
                    }
                });
            }
        }

        // 3. 面板被 React 移除后重新注入
        if (this._pending && !this._isPanelInDom()) {
            var container = this._findResultContainer();
            if (container) {
                this._log("_onBodyChange: panel 已不在 DOM，重新注入，容器=" + this._tagSummary(container));
                this._doInject(container);
            } else {
                this._log("_onBodyChange: panel 已不在 DOM，但容器也尚未出现");
            }
        }
    }

    _isPanelInDom() {
        return this._panelInstance && this._panelInstance._el
            && this._panelInstance._el.parentNode
            && document.body.contains(this._panelInstance._el);
    }

    // ── 检测当前词 ─────────────────────────────────
    _onWordDetected() {
        var word = "";
        var input = document.querySelector("input#rc_select_0");
        if (input) {
            word = input.value.trim().toLowerCase().normalize("NFC");
        }
        if (!word || word === this._lastWord) return;
        this._lastWord = word;
        this._log("_onWordDetected: \"" + word + "\" (input)");
        this._queryDpd(word);
    }

    // ── DPD 查询（缓存结果到 _pending）───────────────
    _queryDpd(word) {
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
            this._log("_queryDpd: headwords parse fail", lookupRow.headwords);
            return;
        }
        if (!headwordIds || headwordIds.length === 0) return;

        var headwords = this.query.getHeadwords(headwordIds);
        if (!headwords || headwords.length === 0) return;

        this._log("_queryDpd: \"" + word + "\" (" + source + "), ids=", headwordIds, "count=" + headwords.length);
        for (var hi = 0; hi < headwords.length; hi++) {
            this._log("  #" + headwords[hi].id + " " + headwords[hi].lemma_1 + " (" + headwords[hi].pos + ")");
        }

        var deconstruction = null;
        if (lookupRow.deconstructor) {
            try {
                deconstruction = JSON.parse(lookupRow.deconstructor);
            } catch (e) { /* ignore */ }
        }

        // 持久缓存查询结果（不清除，供 React 移除面板后重新注入）
        this._pending = {
            word: word,
            headwords: headwords,
            lookupRow: lookupRow,
            deconstruction: deconstruction,
        };

        // 尝试立即注入
        var container = this._findResultContainer();
        if (container) {
            this._doInject(container);
        } else {
            this._log("_queryDpd: 容器尚未出现，等待 MutationObserver");
        }
    }

    // ── 注入面板 ────────────────────────────────────
    _doInject(container) {
        if (!this._pending) return;
        var p = this._pending;

        this._removePanel();

        var panel = new this.Panel(
            p.word,
            p.headwords,
            p.lookupRow,
            p.deconstruction,
            this.query
        );
        panel.injectBefore(container);
        this._panelInstance = panel;

        var el = panel._el;
        this._log("_doInject: injected, word=\"" + p.word + "\", el=" + this._tagSummary(el)
            + ", parent=" + this._tagSummary(el.parentNode)
            + ", prev=" + this._tagSummary(el.previousElementSibling)
            + ", next=" + this._tagSummary(el.nextElementSibling)
            + ", container=" + this._tagSummary(container)
            + ", container.parent=" + this._tagSummary(container.parentNode));

        this.history.add({
            word: p.word,
            headword: p.headwords[0].lemma_1,
            timestamp: Date.now(),
        });
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
