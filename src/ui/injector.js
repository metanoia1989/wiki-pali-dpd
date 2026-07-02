/**
 * 监听 WikiPali 搜索结果容器，匹配 DPD 数据后插入工具条。
 *
 * 页面结构：
 *   搜索框       input#rc_select_0
 *   搜索按钮     button.ant-input-search-button
 *   结果容器     div#rc-tabs-0-panel-result
 *   文中词标签   span.pcd_word（点击后 React 自动填充搜索并查询）
 */
export class Injector {
    constructor(query, Panel, history) {
        this.query = query;
        this.Panel = Panel;
        this.history = history;
        this._observer = null;
        this._containerObserver = null;
        this._lastWord = "";
        this._panelInstance = null;
        this._resultContainer = null;
    }

    start() {
        // 等待结果容器出现后监听其子节点变化
        this._observer = new MutationObserver(() => this._findContainer());
        this._observer.observe(document.body, { childList: true, subtree: true });
        this._findContainer();
    }

    stop() {
        if (this._observer) this._observer.disconnect();
        if (this._containerObserver) this._containerObserver.disconnect();
        this._removePanel();
    }

    _findContainer() {
        const el = document.querySelector("div#rc-tabs-0-panel-result");
        if (el && el !== this._resultContainer) {
            this._resultContainer = el;
            if (this._containerObserver) this._containerObserver.disconnect();
            this._containerObserver = new MutationObserver(() =>
                this._onResultChange()
            );
            this._containerObserver.observe(el, { childList: true, subtree: true });
            this._onResultChange();
        }
    }

    _onResultChange() {
        if (!this._resultContainer) return;
        // 确保结果已渲染（React 可能刚清空旧结果重建）
        if (!this._resultContainer.children.length) return;

        const input = document.querySelector("input#rc_select_0");
        if (!input) return;

        const word = input.value.trim().toLowerCase();
        if (!word || word === this._lastWord) return;
        this._lastWord = word;

        // 等 React 本帧更新完成
        requestAnimationFrame(() => this._lookup(word));
    }

    _removePanel() {
        if (this._panelInstance) {
            this._panelInstance.remove();
            this._panelInstance = null;
        }
    }

    async _lookup(word) {
        this._removePanel();

        const lookupRow = this.query.lookupWord(word);
        if (!lookupRow || !lookupRow.headwords) return;

        let headwordIds;
        try {
            headwordIds = JSON.parse(lookupRow.headwords);
        } catch {
            return;
        }
        if (!headwordIds || headwordIds.length === 0) return;

        const headword = this.query.getHeadword(headwordIds[0]);
        if (!headword) return;

        let deconstruction = null;
        if (lookupRow.deconstructor) {
            try {
                deconstruction = JSON.parse(lookupRow.deconstructor);
            } catch {
                /* ignore */
            }
        }

        const panel = new this.Panel(
            word,
            headword,
            lookupRow,
            deconstruction,
            this.query
        );
        if (this._resultContainer) {
            panel.injectBefore(this._resultContainer);
            this._panelInstance = panel;
        }

        this.history.add({
            word,
            headword: headword.lemma_1,
            timestamp: Date.now(),
        });
    }
}
