/**
 * DeepSeek 网页端 Agent。
 *
 * 运行在 chat.deepseek.com 上，监听 GM storage 中的请求：
 * 1. 确保侧边栏展开（new chat 需要）
 * 2. 自动填入输入框并发送
 * 3. 等待流式回复完成（通过 ds-flex 判断）
 * 4. 提取完整回复内容写回 GM storage
 *
 * DOM 结构（2026-07）：
 *   发送按钮       → .ds-button[tabindex="0"][role="button"]
 *   新对话         → span（文本"开启新对话"/"New Chat"），父级含 ds-icon + ds-focus-ring
 *   侧边栏切换     → .ds-button 内含 .ds-icon 且文本含 "Sidebar"/"侧边栏"
 *   消息列表       → div.ds-virtual-list-visible-items
 *   单条消息       → data-virtual-list-item-key="{序号}"
 *   消息内容       → div.ds-message
 *   回复完成标记   → div.ds-flex（仅 AI 回复有，回复完毕才插入）
 *
 * 调试日志：开启设置面板的"调试模式"或 GM_setValue("dpd_debug", true) 后可见。
 */
import { LlmCommunicator } from "./llm-communicator.js";

export class DeepSeekAgent {
    constructor() {
        this._comm = new LlmCommunicator();
        this._processing = false;
    }

    /** 调试模式下才打印 */
    _debug() {
        if (!GM_getValue("dpd_debug", false)) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift("[DPD-DEBUG]");
        console.log.apply(console, args);
    }

    /** 简要描述一个 DOM 节点 */
    _desc(el) {
        if (!el) return "null";
        var id = el.id ? "#" + el.id : "";
        var cls = "";
        if (el.className && typeof el.className === "string") {
            cls = "." + el.className.trim().split(/\s+/).join(".");
        }
        return "<" + el.tagName.toLowerCase() + id + cls + ">"
            + (el.textContent ? " '" + el.textContent.trim().slice(0, 50) + "'" : "");
    }

    start() {
        console.log("[DPD-LLM] DeepSeek Agent 启动");
        this._debug("=== 页面信息 ===");
        this._debug("URL:", location.href);
        this._debug("textarea 数量:", document.querySelectorAll("textarea").length);

        // 注册调试菜单
        this._updateDebugMenu();

        this._comm.startHeartbeat();
        this._comm.onRequest(this._onRequest.bind(this));
    }

    /** 更新调试菜单项 */
    _updateDebugMenu() {
        var isDebug = GM_getValue("dpd_debug", false);
        GM_registerMenuCommand(
            (isDebug ? "✅" : "⬜") + " DeepSeek 调试模式",
            function () {
                var cur = GM_getValue("dpd_debug", false);
                var next = !cur;
                GM_setValue("dpd_debug", next);
                var msg = "调试模式 " + (next ? "✅ 已开启" : "⬜ 已关闭");
                console.log("[DPD-LLM]", msg);
                _toast(msg);
            }
        );
    }

    async _onRequest(req) {
        if (this._processing) {
            console.log("[DPD-LLM] 正在处理中，忽略新请求", req.id);
            return;
        }
        this._processing = true;

        console.log("[DPD-LLM] 收到请求:", req.id, req.text.slice(0, 40));

        try {
            // 1. 如需新对话
            if (req.newConversation) {
                var opened = this._clickNewChat();
                if (opened) await this._sleep(2000);
                else console.warn("[DPD-LLM] 未找到新对话按钮");
            }

            // 2. 找输入框
            this._inputEl = this._findInput();
            if (!this._inputEl) {
                this._sendError(req.id, "找不到输入框，请确认 chat.deepseek.com 已加载");
                return;
            }
            var input = this._inputEl;

            // 3. 构造完整提示词
            var text = req.prompt ? req.prompt + "\n\n" + req.text : req.text;

            // 4. 填入输入框（React 兼容）
            this._setNativeValue(input, text);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            await this._sleep(500);

            // 5. 点击发送按钮
            var sendBtn = this._findSendButton();
            if (!sendBtn) {
                this._sendError(req.id, "找不到可用的发送按钮");
                return;
            }
            sendBtn.click();
            console.log("[DPD-LLM] 已发送请求");

            // 6. 等待回复完成（传入 req.id 支持取消）
            this._cancelRequested = false;
            var response = await this._waitForResponse(req.id);
            console.log("[DPD-LLM] 回复完成，长度:", response.length);

            // 7. 写回结果
            this._comm.respond(req.id, response, true);

        } catch (e) {
            console.error("[DPD-LLM] 处理出错:", e);
            this._sendError(req.id, "处理出错: " + e.message);
        } finally {
            this._processing = false;
        }
    }

    // ── 输入框 ──────────────────────────────────────

    _findInput() {
        // 1. 用实际观察到的类名优先
        var ta = document.querySelector("textarea.ds-scroll-area");
        this._debug("输入框[ds-scroll-area]:", ta ? "✓ " + this._desc(ta) : "✗");
        if (ta) return ta;

        // 2. 消息容器附近找 textarea
        var msgContainer = document.querySelector(".ds-virtual-list-visible-items");
        if (msgContainer) {
            var root = msgContainer.closest("[class*='ds-']") || msgContainer.parentElement;
            var limit = 0;
            while (root && limit < 5) {
                var found = root.querySelector("textarea");
                if (found) {
                    this._debug("输入框[消息容器附近]: ✓ " + this._desc(found));
                    return found;
                }
                root = root.parentElement;
                limit++;
            }
        }

        // 3. 兜底
        var fallback = document.querySelector("textarea")
            || document.querySelector('[contenteditable="true"]')
            || document.querySelector('div[role="textbox"]');
        this._debug("输入框[兜底]:", fallback ? "✓ " + this._desc(fallback) : "✗");
        return fallback;
    }

    /** React 兼容的 textarea value 设置 */
    _setNativeValue(el, value) {
        var proto = window.HTMLTextAreaElement.prototype;
        var setter = Object.getOwnPropertyDescriptor(proto, "value");
        if (setter && setter.set) {
            setter.set.call(el, value);
            this._debug("输入框赋值: 使用 native setter, 长度=" + value.length);
        } else {
            el.value = value;
            this._debug("输入框赋值: 直接赋值, 长度=" + value.length);
        }
    }

    // ── 发送按钮 ──────────────────────────────────

    _findSendButton() {
        this._debug("=== 查找发送按钮 ===");

        // 判断按钮是否为附件按钮（关联 input[type="file"]）
        function isAttachmentBtn(el) {
            if (!el) return false;
            // 按钮本身或附近有 file input
            var fi = el.querySelector('input[type="file"]');
            if (fi) return true;
            var sibling = el.nextElementSibling;
            if (sibling && sibling.matches && sibling.matches('input[type="file"]')) return true;
            sibling = el.previousElementSibling;
            if (sibling && sibling.matches && sibling.matches('input[type="file"]')) return true;
            return false;
        }

        // 1. 以输入框为锚，找附近所有 ds-button，跳过附件按钮
        var input = this._inputEl;
        if (input) {
            this._debug("策略1[以输入框为锚]:");
            var parent = input.parentElement;
            var depth = 0;
            while (parent && depth < 5) {
                var btns = parent.querySelectorAll('.ds-button');
                for (var i = 0; i < btns.length; i++) {
                    var b = btns[i];
                    if (b === input || b.disabled || isAttachmentBtn(b)) continue;
                    this._debug("  䏻候选[" + i + "]:", this._desc(b));
                    // 优先选有 tabindex="0" 且 role="button" 的
                    if (b.getAttribute("tabindex") === "0"
                        && b.getAttribute("role") === "button") {
                        this._debug("  ✓ 选中:", this._desc(b));
                        return b;
                    }
                }
                // 没找到精确匹配的，用第一个非附件按钮
                for (var i = 0; i < btns.length; i++) {
                    var b = btns[i];
                    if (b === input || b.disabled || isAttachmentBtn(b)) continue;
                    this._debug("  ✓ 退而求其次:", this._desc(b));
                    return b;
                }
                parent = parent.parentElement;
                depth++;
            }
        }

        // 2. 精确选择器
        var exact = document.querySelector('.ds-button[tabindex="0"][role="button"]');
        this._debug("策略2[精确]:", exact
            ? "✓ " + this._desc(exact) + " disabled=" + exact.disabled
            : "✗");
        if (exact && !exact.disabled) return exact;

        // 3. 兜底：所有非附件 ds-button
        var all = document.querySelectorAll(".ds-button");
        this._debug("策略3[兜底]: 共", all.length, "个");
        for (var i = 0; i < all.length; i++) {
            this._debug("  [" + i + "]", this._desc(all[i]), "disabled=" + all[i].disabled);
            if (!all[i].disabled && !isAttachmentBtn(all[i])) return all[i];
        }

        this._debug("✗ 所有策略均未找到");
        return null;
    }

    // ── 新对话 ──────────────────────────────────────

    _clickNewChat() {
        this._debug("=== 新对话 ===");
        // 不主动展开侧边栏（如果找到文本说明侧边栏已展开）

        var spans = document.querySelectorAll("span");
        for (var i = 0; i < spans.length; i++) {
            var s = spans[i];
            var txt = s.textContent.trim();
            if (txt === "开启新对话" || txt === "New Chat") {
                var parent = s.parentElement;
                // 验证父级含 ds-focus-ring（ds-icon 可能没有，放宽条件）
                if (parent && parent.querySelector(".ds-focus-ring")) {
                    this._debug("  ✓ 点击新对话:", txt);
                    parent.click();
                    return true;
                }
                // 兜底：直接点父级
                if (parent) {
                    this._debug("  ✓ 点击父级(降级):", txt);
                    parent.click();
                    return true;
                }
            }
        }
        this._debug("✗ 未找到新对话按钮");
        return false;
    }

    _expandSidebar() {
        this._debug("=== 展开侧边栏 ===");

        var btns = document.querySelectorAll(".ds-button");
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            var txt = (b.textContent || "").trim().toLowerCase();
            var hasIcon = !!b.querySelector(".ds-icon");
            if ((txt.indexOf("sidebar") >= 0 || txt.indexOf("侧边栏") >= 0) && hasIcon) {
                this._debug("  ✓ 找到侧边栏按钮:", this._desc(b));
                b.click();
                return true;
            }
        }

        btns = document.querySelectorAll('[aria-label*="sidebar" i], [aria-label*="侧边栏"]');
        if (btns.length > 0) {
            this._debug("  ✓ 通过 aria-label 找到:", this._desc(btns[0]));
            btns[0].click();
            return true;
        }

        this._debug("✗ 未找到侧边栏按钮");
        return false;
    }

    // ── 回复等待 ────────────────────────────────────

    async _waitForResponse(requestId) {
        var self = this;
        this._debug("=== 等待回复 ===");

        // 监听取消信号
        var cancelId = GM_addValueChangeListener("dpd_llm_cancel", function (_k, _o, val) {
            if (val === requestId) self._cancelRequested = true;
        });

        return new Promise(function (resolve) {
            var totalPolls = 0;
            var timer = setInterval(function () {
                totalPolls++;

                if (self._cancelRequested) {
                    self._debug("取消, 共轮询", totalPolls, "次");
                    clearInterval(timer);
                    GM_removeValueChangeListener(cancelId);
                    self._clickStopButton();
                    resolve("(已取消)");
                    return;
                }

                var c = document.querySelector(".ds-virtual-list-visible-items");
                if (!c) { self._debug("#" + totalPolls + ": 容器不存在"); return; }

                var items = c.children;
                var last = items[items.length - 1];
                if (!last) { self._debug("#" + totalPolls + ": 无消息"); return; }

                // 检查最后一个元素是否有 .ds-flex 直接子元素
                var hasFlex = false;
                var childCount = last.children.length;
                for (var ci = 0; ci < childCount; ci++) {
                    if (last.children[ci].classList.contains("ds-flex")) {
                        hasFlex = true;
                        break;
                    }
                }

                self._debug("#" + totalPolls + ": 消息数=" + items.length
                    + " 最后项子div=" + childCount
                    + " ds-flex=" + (hasFlex ? "✓" : "✗"));

                if (!hasFlex) return;

                // 回复完成，提取内容
                var html = self._extractResponseHtml(last);
                if (html) {
                    self._debug("✓ 第 " + totalPolls + " 轮取到回复, 长度=" + html.length);
                    clearInterval(timer);
                    GM_removeValueChangeListener(cancelId);
                    resolve(html);
                } else {
                    // 有 ds-flex 但内容为空 → 继续等一轮
                    self._debug("  ds-flex 存在但内容空，再等一轮");
                }
            }, 2000);

            setTimeout(function () {
                clearInterval(timer);
                GM_removeValueChangeListener(cancelId);
                var c = document.querySelector(".ds-virtual-list-visible-items");
                if (c && c.children.length) {
                    resolve(self._extractResponseHtml(c.children[c.children.length - 1]) || "(超时)");
                } else {
                    resolve("(超时)");
                }
            }, 180000);
        });
    }

    /** 从消息 item 提取 AI 回复 HTML */
    _extractResponseHtml(item) {
        if (!item) return "";
        var md = item.querySelector(".ds-markdown.ds-assistant-message-main-content");
        if (md && md.innerHTML.trim()) return md.innerHTML;
        var msg = item.querySelector(".ds-message");
        if (msg && msg.textContent.trim()) return "<p>" + this._e(msg.textContent) + "</p>";
        return "";
    }

    _e(str) {
        var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return String(str).replace(/[&<>"']/g, function (ch) { return map[ch]; });
    }

    // ── 取消 ────────────────────────────────────────

    _clickStopButton() {
        // DeepSeek 生成中时，页面会出现停止按钮
        // 通常在输入框附近或回复消息中
        var stopBtn = document.querySelector('[class*="stop"]')
            || document.querySelector('button:has(svg.lucide-square)')
            || document.querySelector('[aria-label*="stop" i]');
        if (stopBtn) {
            this._debug("✓ 点击停止按钮");
            stopBtn.click();
        }
    }

    // ── 辅助 ────────────────────────────────────────

    _sendError(requestId, message) {
        this._comm.respond(requestId, "❌ " + message, true);
    }

    _sleep(ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
    }
}

/** 短暂提示，2s 自动消失 */
function _toast(msg) {
    var el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#333",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: "8px",
        fontSize: "14px",
        zIndex: "999999",
        fontFamily: "-apple-system,sans-serif",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        opacity: "0",
        transition: "opacity .25s ease",
    });
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = "1"; });
    setTimeout(function () {
        el.style.opacity = "0";
        setTimeout(function () { el.remove(); }, 300);
    }, 2000);
}
