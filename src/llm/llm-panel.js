/**
 * 选中文本浮动菜单。
 *
 * 功能：
 * - 预设提示词 + 自定义输入 + 发送到 DeepSeek
 * - 拖拽移动（标题栏）+ 拖拽缩放（右下角手柄）
 * - 记住「新开对话」复选框状态
 * - 消息数上限配置，到达上限自动新开对话
 */
import { PRESETS } from "./llm-presets.js";

var NEWCHAT_KEY = "dpd_llm_newchat";

export class LlmPanel {
    constructor() {
        this._el = null;
        this._sendCallback = null;
        this._cancelCallback = null;
        this._selectedText = "";
        this._outsideHandler = null;
        this._dotsTimer = null;
        this._maxMsgs = 20;
    }

    /** 在鼠标指针附近显示面板 */
    show(mousePos, selectedText, onSend, onCancel, maxMsgs) {
        this.hide();
        this._selectedText = selectedText;
        this._sendCallback = onSend;
        this._cancelCallback = onCancel;
        this._maxMsgs = maxMsgs || 20;

        var el = document.createElement("div");
        el.className = "dpd-llm-float";
        el.innerHTML = this._html(selectedText);
        document.body.appendChild(el);
        this._el = el;

        this._position(mousePos.x, mousePos.y);
        this._makeDraggable();
        this._makeResizable();
        this._bindPresets();
        this._bindCopy();
        this._bindSend();
        this._bindCancel();
        this._bindClose();
        this._bindCheckbox();
    }

    hide() {
        if (this._outsideHandler) {
            document.removeEventListener("click", this._outsideHandler);
            this._outsideHandler = null;
        }
        if (this._el) {
            this._el.remove();
            this._el = null;
        }
        this._sendCallback = null;
    }

    /** 显示发送中状态 */
    showPending() {
        if (!this._el) return;
        this._stopPendingAnim();
        var status = this._el.querySelector(".dpd-llm-status");
        if (status) {
            status.className = "dpd-llm-status dpd-llm-pending";
            status.innerHTML = '<span class="dpd-spin">\u23F3</span> \u6B63\u5728\u53D1\u9001\u5230 DeepSeek<span class="dpd-dots"></span>';
        }
        var sendBtn = this._el.querySelector(".dpd-llm-send");
        if (sendBtn) sendBtn.style.display = "none";
        var cancelBtn = this._el.querySelector(".dpd-llm-cancel");
        if (cancelBtn) cancelBtn.style.display = "";
        var resp = this._el.querySelector(".dpd-llm-response");
        if (resp) resp.style.display = "none";

        var dotsEl = status && status.querySelector(".dpd-dots");
        if (dotsEl) {
            var dotCount = 0;
            this._dotsTimer = setInterval(function () {
                dotCount = (dotCount + 1) % 4;
                dotsEl.textContent = "." + "..".slice(0, dotCount);
            }, 400);
        }
    }

    _stopPendingAnim() {
        if (this._dotsTimer) {
            clearInterval(this._dotsTimer);
            this._dotsTimer = null;
        }
    }

    /** 显示回复（DeepSeek 已渲染 HTML，直接 innerHTML） */
    showResponse(html) {
        this._stopPendingAnim();
        if (!this._el) return;
        var cancelBtn = this._el.querySelector(".dpd-llm-cancel");
        if (cancelBtn) cancelBtn.style.display = "none";
        var sendBtn = this._el.querySelector(".dpd-llm-send");
        if (sendBtn) sendBtn.style.display = "";
        var status = this._el.querySelector(".dpd-llm-status");
        if (status) {
            status.className = "dpd-llm-status";
            status.textContent = "\u2705 \u5DF2\u56DE\u590D\uFF08\u70B9\u51FB \u00D7 \u5173\u95ED\uFF09";
        }

        var respArea = this._el.querySelector(".dpd-llm-response");
        if (respArea) {
            respArea.style.display = "block";
            respArea.innerHTML = html;
        }
    }

    /** 设置消息计数 */
    setMsgCount(count) {
        if (!this._el) return;
        var el = this._el.querySelector(".dpd-llm-count");
        if (el) el.textContent = count;
        // 到达上限时自动勾选新对话
        if (count >= this._maxMsgs) {
            var cb = this._el.querySelector(".dpd-llm-newchat");
            if (cb) cb.checked = true;
        }
    }

    // ── 构建 ────────────────────────────────────────

    _html(selectedText) {
        var presetsHtml = PRESETS.map(function (p) {
            return '<button class="dpd-llm-preset" data-prompt="'
                + this._e(p.prompt) + '">'
                + p.icon + ' ' + this._e(p.label) + "</button>";
        }, this).join("");

        var newChatChecked = GM_getValue(NEWCHAT_KEY, true);

        return '<div class="dpd-llm-arrow"></div>'
            + '<div class="dpd-llm-body">'
            + '<div class="dpd-llm-header">'
            + '<span class="dpd-llm-selected">' + this._e(selectedText) + "</span>"
            + '<button class="dpd-llm-copy" title="复制选中文本">\uD83D\uDCCB</button>'
            + '<button class="dpd-llm-close">&times;</button>'
            + "</div>"
            + '<div class="dpd-llm-presets">' + presetsHtml + "</div>"
            + '<textarea class="dpd-llm-input" placeholder="\u8F93\u5165\u989D\u5916\u6307\u793A\u6216\u95EE\u9898\u2026" rows="2"></textarea>'
            + '<div class="dpd-llm-options">'
            + '<label class="dpd-llm-label"><input type="checkbox" class="dpd-llm-newchat"'
            + (newChatChecked ? ' checked' : '')
            + '> \u65B0\u5F00\u5BF9\u8BDD</label>'
            + '<span class="dpd-llm-msgcount">\u6D88\u606F: <span class="dpd-llm-count">0</span>/<span class="dpd-llm-max">' + this._maxMsgs + '</span></span>'
            + '<button class="dpd-llm-send">\u53D1\u9001 \u2192</button>'
            + '<button class="dpd-llm-cancel" style="display:none">\u2716 \u53D6\u6D88</button>'
            + "</div>"
            + '<div class="dpd-llm-status"></div>'
            + '<div class="dpd-llm-response" style="display:none"></div>'
            + '<div class="dpd-llm-resize-handle"></div>'
            + "</div>"
            + this._styleHTML();
    }

    _position(clientX, clientY) {
        var el = this._el;
        var w = el.offsetWidth || 340;
        var top = clientY + 8;
        var left = clientX - 12;
        var maxLeft = window.innerWidth - w - 8;
        if (left > maxLeft) left = maxLeft;
        if (left < 8) left = 8;
        el.style.top = top + "px";
        el.style.left = left + "px";
    }

    // ── 拖拽移动 ────────────────────────────────────

    _makeDraggable() {
        var header = this._el.querySelector(".dpd-llm-header");
        if (!header) return;
        var self = this;
        header.addEventListener("mousedown", function (e) {
            if (e.target.closest("button")) return;
            var ox = e.clientX - self._el.offsetLeft;
            var oy = e.clientY - self._el.offsetTop;
            function onMove(ev) {
                self._el.style.left = (ev.clientX - ox) + "px";
                self._el.style.top = (ev.clientY - oy) + "px";
            }
            function onUp() {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
            }
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        });
    }

    // ── 拖拽缩放 ────────────────────────────────────

    _makeResizable() {
        var handle = this._el.querySelector(".dpd-llm-resize-handle");
        if (!handle) return;
        var self = this;
        var body = this._el.querySelector(".dpd-llm-body");
        var respArea = this._el.querySelector(".dpd-llm-response");
        var header = this._el.querySelector(".dpd-llm-header");
        var presets = this._el.querySelector(".dpd-llm-presets");
        var input = this._el.querySelector(".dpd-llm-input");
        var options = this._el.querySelector(".dpd-llm-options");
        var status = this._el.querySelector(".dpd-llm-status");

        handle.addEventListener("mousedown", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var startX = e.clientX;
            var startY = e.clientY;
            var startW = body.offsetWidth;
            var startH = body.offsetHeight;

            function onMove(ev) {
                var dw = ev.clientX - startX;
                var dh = ev.clientY - startY;
                body.style.width = Math.max(260, startW + dw) + "px";
                var newH = Math.max(200, startH + dh);
                body.style.height = newH + "px";
                body.style.overflow = "hidden";
                // 响应区高度 = body 高度 - 其他元素高度
                if (respArea) {
                    var other = 0;
                    [header, presets, input, options, status].forEach(function (el) {
                        if (el) other += el.offsetHeight || 0;
                    });
                    other += 24;
                    respArea.style.maxHeight = Math.max(60, newH - other) + "px";
                    respArea.style.overflowY = "auto";
                }
            }
            function onUp() { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        });
    }

    // ── 事件绑定 ────────────────────────────────────

    _bindPresets() {
        var self = this;
        var btns = this._el.querySelectorAll(".dpd-llm-preset");
        for (var i = 0; i < btns.length; i++) {
            btns[i].addEventListener("click", function () {
                var prompt = this.getAttribute("data-prompt") || "";
                var inp = self._el.querySelector(".dpd-llm-input");
                if (inp) inp.value = prompt;
            });
        }
    }

    _bindCopy() {
        var self = this;
        var btn = this._el.querySelector(".dpd-llm-copy");
        if (!btn) return;
        btn.addEventListener("click", function () {
            var text = self._selectedText;
            if (!text) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    var orig = btn.textContent;
                    btn.textContent = "\u2713";
                    setTimeout(function () { btn.textContent = orig; }, 1200);
                }).catch(function () { self._copyFallback(text); });
            } else {
                self._copyFallback(text);
            }
        });
    }

    _copyFallback(text) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
    }

    _bindSend() {
        var self = this;
        var btn = this._el.querySelector(".dpd-llm-send");
        if (!btn) return;
        btn.addEventListener("click", function () { self._doSend(); });

        var inp = this._el.querySelector(".dpd-llm-input");
        if (inp) {
            inp.addEventListener("keydown", function (e) {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    self._doSend();
                }
            });
        }
    }

    _bindCancel() {
        var self = this;
        var btn = this._el.querySelector(".dpd-llm-cancel");
        if (btn) {
            btn.addEventListener("click", function () {
                if (self._cancelCallback) self._cancelCallback();
                if (self._el) self._el.querySelector(".dpd-llm-cancel").style.display = "none";
            });
        }
    }

    _bindClose() {
        var self = this;
        var btn = this._el.querySelector(".dpd-llm-close");
        if (btn) {
            btn.addEventListener("click", function () { self.hide(); });
        }
        if (this._outsideHandler) {
            document.removeEventListener("click", this._outsideHandler);
        }
        this._outsideHandler = function (e) {
            if (self._el && !self._el.contains(e.target)) self.hide();
        };
        setTimeout(function () {
            document.addEventListener("click", self._outsideHandler);
        }, 0);
    }

    _bindCheckbox() {
        var cb = this._el.querySelector(".dpd-llm-newchat");
        if (!cb) return;
        cb.addEventListener("change", function () {
            GM_setValue(NEWCHAT_KEY, this.checked);
        });
    }

    _doSend() {
        if (!this._sendCallback) return;
        var inp = this._el.querySelector(".dpd-llm-input");
        var prompt = inp ? inp.value.trim() : "";
        var newChat = this._el.querySelector(".dpd-llm-newchat").checked;
        this._sendCallback(this._selectedText, prompt, newChat);
    }

    // ── 样式 ────────────────────────────────────────

    _styleHTML() {
        return "<style>"
            + ".dpd-llm-float{"
            + "position:fixed;z-index:999999;"
            + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
            + "font-size:13px;line-height:1.4;color:#333;"
            + "}"
            + ".dpd-llm-arrow{"
            + "width:0;height:0;border-left:7px solid transparent;"
            + "border-right:7px solid transparent;"
            + "border-bottom:7px solid #fff;"
            + "margin:0 0 0 16px;filter:drop-shadow(0 -1px 1px rgba(0,0,0,0.1));"
            + "}"
            + ".dpd-llm-body{"
            + "background:#fff;border-radius:8px;padding:10px 12px;"
            + "min-width:300px;min-height:160px;width:340px;"
            + "box-shadow:0 4px 20px rgba(0,0,0,0.18);"
            + "border:1px solid #e2e8f0;position:relative;"
            + "}"
            + ".dpd-llm-header{display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:grab;user-select:none;}"
            + ".dpd-llm-presets{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;}"
            + ".dpd-llm-input{width:100%;box-sizing:border-box;padding:6px 8px;"
            + "border:1px solid #d4dae5;border-radius:4px;"
            + "font-size:12px;font-family:inherit;resize:vertical;"
            + "outline:none;transition:border-color .15s;}"
            + ".dpd-llm-input:focus{border-color:#8b4513;}"
            + ".dpd-llm-options{display:flex;align-items:center;gap:10px;margin-top:6px;font-size:12px;}"
            + ".dpd-llm-status{font-size:11px;color:#888;margin-top:4px;min-height:16px;}"
            + ".dpd-llm-selected{"
            + "flex:1;font-weight:600;color:#8b4513;font-size:12px;"
            + "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
            + "}"
            + ".dpd-llm-copy{"
            + "background:none;border:1px solid #ddd;border-radius:4px;"
            + "cursor:pointer;font-size:13px;padding:1px 6px;line-height:1.4;color:#666;"
            + "}"
            + ".dpd-llm-copy:hover{background:#f0f0f0;color:#333;}"
            + ".dpd-llm-close{"
            + "background:none;border:none;font-size:18px;cursor:pointer;"
            + "color:#999;padding:0 2px;line-height:1;"
            + "}"
            + ".dpd-llm-close:hover{color:#333;}"
            + ".dpd-llm-preset{"
            + "padding:3px 8px;border:1px solid #d4a574;border-radius:4px;"
            + "background:#fef9f0;cursor:pointer;font-size:11px;color:#8b4513;"
            + "white-space:nowrap;transition:background .15s;"
            + "}"
            + ".dpd-llm-preset:hover{background:#fdf3e6;}"
            + ".dpd-llm-input{"
            + "width:100%;box-sizing:border-box;padding:6px 8px;"
            + "border:1px solid #d4dae5;border-radius:4px;"
            + "font-size:12px;font-family:inherit;resize:vertical;"
            + "outline:none;transition:border-color .15s;"
            + "}"
            + ".dpd-llm-input:focus{border-color:#8b4513;}"
            + ".dpd-llm-options{"
            + "display:flex;align-items:center;gap:10px;margin-top:6px;font-size:12px;"
            + "}"
            + ".dpd-llm-label{display:flex;align-items:center;gap:4px;cursor:pointer;color:#555;}"
            + ".dpd-llm-msgcount{color:#888;font-size:11px;flex:1;text-align:right;}"
            + ".dpd-llm-send{"
            + "padding:4px 14px;border:none;border-radius:4px;"
            + "background:#8b4513;color:#fff;cursor:pointer;font-size:12px;font-weight:500;"
            + "}"
            + ".dpd-llm-send:hover:not(:disabled){background:#a0522d;}"
            + ".dpd-llm-send:disabled{background:#ccc;cursor:default;}"
            + ".dpd-llm-cancel{"
            + "padding:4px 10px;border:1px solid #e2e8f0;border-radius:4px;"
            + "background:#fff;color:#888;cursor:pointer;font-size:12px;"
            + "}"
            + ".dpd-llm-cancel:hover{background:#fee2e2;color:#c00;border-color:#fca5a5;}"
            + ".dpd-llm-status{font-size:11px;color:#888;margin-top:4px;min-height:16px;}"
            + ".dpd-llm-pending{color:#8b4513;font-weight:500;}"
            + "@keyframes dpd-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}"
            + ".dpd-spin{display:inline-block;animation:dpd-spin 1.2s linear infinite;}"
            + ".dpd-llm-response{"
            + "margin-top:6px;padding:8px;background:#f8fafc;"
            + "border:1px solid #e2e8f0;border-radius:4px;"
            + "font-size:12px;line-height:1.6;color:#333;"
            + "max-height:300px;overflow-y:auto;word-break:break-word;"
            + "}"
            + ".dpd-llm-response p{margin:4px 0;}"
            + ".dpd-llm-response h1,.dpd-llm-response h2,.dpd-llm-response h3{margin:8px 0 4px;color:#333;}"
            + ".dpd-llm-response h3{font-size:14px;}"
            + ".dpd-llm-response h2{font-size:15px;}"
            + ".dpd-llm-response ul,.dpd-llm-response ol{margin:4px 0;padding-left:20px;}"
            + ".dpd-llm-response li{margin:2px 0;}"
            + ".dpd-llm-response code{background:#eef2f6;padding:1px 4px;border-radius:3px;font-size:11px;font-family:monospace;color:#c7254e;}"
            + ".dpd-llm-response pre{background:#f4f6f8;padding:8px 12px;border-radius:4px;overflow-x:auto;margin:6px 0;}"
            + ".dpd-llm-response pre code{background:none;padding:0;color:#333;}"
            + ".dpd-llm-response strong{font-weight:600;color:#222;}"
            + ".dpd-llm-response em{font-style:italic;}"
            /* 缩放手柄 */
            + ".dpd-llm-resize-handle{"
            + "position:absolute;right:0;bottom:0;width:16px;height:16px;"
            + "cursor:nwse-resize;opacity:.4;"
            + "background:linear-gradient(135deg,transparent 50%,#888 50%,#888 60%,transparent 60%),"
            + "linear-gradient(135deg,transparent 30%,#aaa 30%,#aaa 40%,transparent 40%);"
            + "}"
            + ".dpd-llm-resize-handle:hover{opacity:.7;}"
            + "</style>";
    }

    _e(str) {
        var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return String(str).replace(/[&<>"']/g, function (ch) { return map[ch]; });
    }
}
