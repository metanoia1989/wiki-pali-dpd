/**
 * 跨标签页通信协议。
 *
 * 利用 GM_setValue + GM_addValueChangeListener 实现
 * wikipali 标签页 ↔ chat.deepseek.com 标签页之间的消息传递。
 *
 * 协议：
 *   dpd_llm_request  — wikipali → deepseek（查询请求）
 *   dpd_llm_response — deepseek → wikipali（回复结果）
 *   dpd_llm_heartbeat — deepseek 定期心跳（用于检测 deepseek 标签是否存活）
 */
export class LlmCommunicator {
    constructor() {
        this._reqListenerId = null;
        this._heartbeatTimer = null;
    }

    // ── wikipali 侧 ─────────────────────────────────
    /** 发送请求到 DeepSeek */
    send(text, prompt, newConversation) {
        var id = "llm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        GM_setValue("dpd_llm_request", {
            id: id,
            text: text,
            prompt: prompt || "",
            newConversation: !!newConversation,
            timestamp: Date.now(),
        });
        return id;
    }

    /** 监听回复（wikipali 侧调用） */
    onResponse(callback) {
        this._cleanupListener();
        this._reqListenerId = GM_addValueChangeListener(
            "dpd_llm_response",
            function (_key, _oldVal, newVal) {
                if (!newVal) return;
                // GM storage 存储的值可能已经是对象，也可能序列化为字符串
                var resp = typeof newVal === "string"
                    ? JSON.parse(newVal) : newVal;
                if (resp && resp.id) callback(resp);
            }
        );
    }

    // ── deepseek 侧 ─────────────────────────────────
    /** 监听请求（deepseek 侧调用） */
    onRequest(callback) {
        this._reqListenerId = GM_addValueChangeListener(
            "dpd_llm_request",
            function (_key, _oldVal, newVal) {
                if (!newVal) return;
                var req = typeof newVal === "string"
                    ? JSON.parse(newVal) : newVal;
                if (req && req.id) callback(req);
            }
        );
    }

    /** 回复结果（deepseek 侧调用） */
    respond(requestId, content, done) {
        GM_setValue("dpd_llm_response", {
            id: requestId,
            content: content,
            done: !!done,
            timestamp: Date.now(),
        });
    }

    /** 发送心跳（deepseek 侧调用） */
    startHeartbeat() {
        GM_setValue("dpd_llm_heartbeat", Date.now());
        this._heartbeatTimer = setInterval(function () {
            GM_setValue("dpd_llm_heartbeat", Date.now());
        }, 5000);
    }

    stopHeartbeat() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    // ── 公共 ────────────────────────────────────────
    /** 检测 DeepSeek 标签页是否存活（heartbeat < 15s 前） */
    isConnected() {
        var hb = GM_getValue("dpd_llm_heartbeat", 0);
        return Date.now() - hb < 15000;
    }

    cleanup() {
        this._cleanupListener();
        this.stopHeartbeat();
    }

    _cleanupListener() {
        if (this._reqListenerId != null) {
            try { GM_removeValueChangeListener(this._reqListenerId); } catch (e) { /* ignore */ }
            this._reqListenerId = null;
        }
    }
}
