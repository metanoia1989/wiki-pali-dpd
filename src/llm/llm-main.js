/**
 * LLM 功能集成入口（wikipali 侧）。
 *
 * 职责：
 * 1. 检查 dpd_llm_enabled 配置开关（默认关闭）
 * 2. 监听 DPD 面板内的文本选中事件
 * 3. 显示浮动菜单（LlmPanel）
 * 4. 通过 LlmCommunicator 发送到 DeepSeek
 * 5. 监听回复并展示
 * 6. 缓存查询结果
 * 7. 检测 DeepSeek 标签页是否在线，离线时自动打开
 */
import { LlmCommunicator } from "./llm-communicator.js";
import { LlmPanel } from "./llm-panel.js";
import { LlmCache } from "./llm-cache.js";

var SETTING_KEY = "dpd_llm_enabled";

export class LlmMain {
    constructor() {
        this._comm = new LlmCommunicator();
        this._panel = new LlmPanel();
        this._cache = new LlmCache();
        this._msgCount = 0;
        this._currentReqId = null;
        this._currentReqText = "";
        this._currentReqPrompt = "";
        this._connected = false;
    }

    start() {
        // 检查配置开关
        if (!GM_getValue(SETTING_KEY, false)) {
            console.log("[DPD-LLM] \u5DF3\u5173\u95ED\uFF08dpd_llm_enabled=false\uFF09");
            return;
        }

        console.log("[DPD-LLM] \u542F\u52A8");

        this._maxMsgs = parseInt(GM_getValue("dpd_llm_max_msgs", 20), 10) || 20;

        this._checkConnection();
        setInterval(this._checkConnection.bind(this), 10000);

        document.addEventListener("mouseup", this._onMouseUp.bind(this));

        this._comm.onResponse(this._onResponse.bind(this));

        this._msgCount = parseInt(localStorage.getItem("dpd_llm_msgcount") || "0", 10);
    }

    /** 外部调用：开关变化后启用/停用 (recheck=true 强制重启监听) */
    recheck() {
        var enabled = GM_getValue(SETTING_KEY, false);
        if (enabled) {
            // 如果已启动则跳过
            return;
        }
        // 停用：清理
        this.stop();
    }

    stop() {
        this._comm.cleanup();
        this._panel.hide();
    }

    /** 当前是否已激活 */
    static isEnabled() {
        return GM_getValue(SETTING_KEY, false);
    }

    /** 切换开关，返回新状态 */
    static toggle() {
        var cur = GM_getValue(SETTING_KEY, false);
        var next = !cur;
        GM_setValue(SETTING_KEY, next);
        return next;
    }

    // ── 连接检测 ────────────────────────────────────

    _checkConnection() {
        var wasConnected = this._connected;
        this._connected = this._comm.isConnected();
        if (this._connected && !wasConnected) {
            console.log("[DPD-LLM] DeepSeek \u6807\u7B7E\u9875\u5DF2\u8FDE\u63A5");
        } else if (!this._connected && wasConnected) {
            console.log("[DPD-LLM] DeepSeek \u6807\u7B7E\u9875\u5DF2\u65AD\u5F00");
        }
    }

    // ── 选中事件 ────────────────────────────────────

    _onMouseUp(e) {
        // 鼠标左键才触发
        if (e.button !== 0) return;

        // 如果点击在已有的浮窗上，不处理
        if (this._panel._el && this._panel._el.contains(e.target)) return;

        var sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

        var text = sel.toString().trim();
        if (text.length > 200) text = text.slice(0, 200) + "\u2026";
        if (text.length < 1) return;

        // 判断是否在 DPD 面板内
        var node = sel.anchorNode;
        var inDpd = false;
        while (node) {
            if (node.classList && node.classList.contains("dpd-wrap")) {
                inDpd = true;
                break;
            }
            if (node.id === "dpd-init-banner") { inDpd = true; break; }
            node = node.parentNode;
        }
        if (!inDpd) return;

        this._checkConnection();

        this._panel.show(
            { x: e.clientX, y: e.clientY },
            text,
            function (selectedText, prompt, newChat) {
                this._handleSend(selectedText, prompt, newChat);
            }.bind(this),
            function () {
                this._handleCancel();
            }.bind(this),
            this._maxMsgs
        );
        this._panel.setMsgCount(this._msgCount);
    }

    // ── 发送 ────────────────────────────────────────

    _handleSend(text, prompt, newChat) {
        var cached = this._cache.find(text, prompt);
        if (cached) {
            this._panel.showResponse(cached.response + "\n\n（来自缓存）");
            return;
        }

        if (newChat) {
            this._msgCount = 0;
            localStorage.setItem("dpd_llm_msgcount", "0");
        }

        if (!this._connected) {
            this._panel.showPending();
            var opened = this._tryOpenDeepSeek();
            if (opened) {
                this._waitForConnectionAndSend(text, prompt, newChat);
            } else {
                this._panel.showResponse(
                    "\u274C DeepSeek \u672A\u8FDE\u63A5\u3002\n\n"
                    + "\u8BF7\u6253\u5F00 https://chat.deepseek.com \u5E76\u767B\u5F55\uFF0C"
                    + "\u7136\u540E\u91CD\u65B0\u9009\u62E9\u6587\u672C\u53D1\u9001\u3002"
                );
            }
            return;
        }

        this._doSend(text, prompt, newChat);
    }

    _doSend(text, prompt, newChat) {
        // 到达上限时自动切新对话
        if (this._msgCount >= this._maxMsgs && !newChat) {
            newChat = true;
            this._msgCount = 0;
            localStorage.setItem("dpd_llm_msgcount", "0");
        }

        this._panel.showPending();
        this._currentReqId = this._comm.send(text, prompt, newChat);
        this._currentReqText = text;
        this._currentReqPrompt = prompt;

        this._msgCount++;
        localStorage.setItem("dpd_llm_msgcount", String(this._msgCount));
        this._panel.setMsgCount(this._msgCount);
    }

    /** 取消当前请求 */
    _handleCancel() {
        if (!this._currentReqId) return;
        GM_setValue("dpd_llm_cancel", this._currentReqId);
        this._panel.showResponse("(已取消)");
        this._currentReqId = null;
        this._currentReqText = "";
        this._currentReqPrompt = "";
    }

    _tryOpenDeepSeek() {
        try {
            GM_openInTab("https://chat.deepseek.com", { active: true, insert: true });
            return true;
        } catch (e) {
            console.warn("[DPD-LLM] GM_openInTab \u5931\u8D25:", e);
            return false;
        }
    }

    _waitForConnectionAndSend(text, prompt, newChat) {
        var self = this;
        var waited = 0;
        var interval = setInterval(function () {
            waited += 2000;
            self._checkConnection();
            if (self._connected) {
                clearInterval(interval);
                self._doSend(text, prompt, newChat);
            } else if (waited > 30000) {
                clearInterval(interval);
                self._panel.showResponse(
                    "\u274C \u7B49\u5F85 DeepSeek \u8FDE\u63A5\u8D85\u65F6\u3002"
                    + "\u8BF7\u624B\u52A8\u6253\u5F00 chat.deepseek.com \u5E76\u767B\u5F55\u3002"
                );
            }
        }, 2000);
    }

    // ── 回复 ────────────────────────────────────────

    _onResponse(resp) {
        if (resp.id !== this._currentReqId) return;
        if (!resp.done) return;

        this._panel.showResponse(resp.content);

        // 错误响应不缓存（如"找不到发送按钮"等）
        if (resp.content && resp.content.indexOf("\u274C") < 0) {
            this._cache.add({
                text: this._currentReqText,
                prompt: this._currentReqPrompt,
                response: resp.content,
            });
        }

        this._currentReqId = null;
        this._currentReqText = "";
        this._currentReqPrompt = "";
    }
}
