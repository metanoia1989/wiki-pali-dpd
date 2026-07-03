/**
 * LLM 查询/结果缓存（localStorage）。
 * 与 history.js 类似，但存储 LLM 对话记录。
 */
export class LlmCache {
    constructor(maxEntries) {
        this.maxEntries = maxEntries || 200;
        this._key = "dpd_llm_cache";
    }

    get() {
        try {
            return JSON.parse(localStorage.getItem(this._key) || "[]");
        } catch (e) {
            return [];
        }
    }

    add(entry) {
        var list = this.get();
        list.unshift({
            text: entry.text,
            prompt: entry.prompt || "",
            response: entry.response || "",
            timestamp: Date.now(),
        });
        if (list.length > this.maxEntries) list.length = this.maxEntries;
        localStorage.setItem(this._key, JSON.stringify(list));
    }

    /** 按 text + prompt 精确查找缓存 */
    find(text, prompt) {
        var list = this.get();
        for (var i = 0; i < list.length; i++) {
            if (list[i].text === text && list[i].prompt === (prompt || "")) {
                return list[i];
            }
        }
        return null;
    }

    clear() {
        localStorage.removeItem(this._key);
    }
}
