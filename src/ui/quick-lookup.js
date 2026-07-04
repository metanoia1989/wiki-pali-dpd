/**
 * 快捷查词浮窗。
 *
 * 点击 .dpd-word-click 时，在点击位置附近弹出浮窗，完整渲染 DPD 查询结果。
 * 无遮罩，点击右上角 × 关闭，允许多个浮窗共存。
 */
import { lookupHeadwords } from "../db/query.js";

/** 全局计数器，用于生成唯一 ID */
var _nextId = 1;
/** 样式是否已注入 */
var _styleInjected = false;

export class QuickLookup {
    /**
     * @param {string} word - 查询词
     * @param {object} query - Query 实例
     * @param {class} Panel - Panel 类
     * @param {{ x: number, y: number }} clickPos - 点击坐标（用于定位）
     */
    static show(word, query, Panel, clickPos) {
        // 含 √ → 优先查词根表，跳过常规查词
        var hasRootMark = /[√÷×*]/.test(word);
        var result = null;
        var rootData = null;

        if (hasRootMark) {
            var rootSearch = word.replace(/^[√÷×*]+/, "");
            rootData = query.getRoot("\u221A" + rootSearch) || query.getRoot(rootSearch);
        } else {
            result = lookupHeadwords(query, word);
            if (!result) {
                _toast("词典中未找到 \u201C" + word + "\u201D");
                return;
            }
        }

        _injectStyle();
        var title = rootData ? "\u221A" + rootData.root.replace(/^[√÷×*]+/, "") : word;

        var floatEl = document.createElement("div");
        floatEl.className = "dpd-quick-float";

        var header = document.createElement("div");
        header.className = "dpd-quick-header";
        header.innerHTML = '<span class="dpd-quick-title">' + _e(title) + '</span><span class="dpd-quick-close">&times;</span>';

        var body = document.createElement("div");
        body.className = "dpd-quick-body";

        floatEl.appendChild(header);
        floatEl.appendChild(body);
        document.body.appendChild(floatEl);

        _makeDraggable(floatEl, header);
        header.querySelector(".dpd-quick-close").addEventListener("click", function () {
            floatEl.remove();
        });

        if (result) {
            var panel = new Panel(word, result.headwords, result.lookupRow, result.deconstruction, query, true);
            panel.renderTo(body);
            floatEl._panel = panel;
        } else {
            body.innerHTML = _rootHtml(rootData);
        }

        _position(floatEl, clickPos);
    }
}

function _injectStyle() {
    if (_styleInjected) return;
    _styleInjected = true;
    var style = document.createElement("style");
    style.textContent = ""
        + ".dpd-quick-float{"
        + "position:fixed;z-index:99999;background:#fff;border-radius:8px;"
        + "box-shadow:0 6px 20px rgba(0,0,0,0.2);"
        + "display:flex;flex-direction:column;overflow:hidden;"
        + "}"
        + ".dpd-quick-header{"
        + "display:flex;align-items:center;justify-content:space-between;"
        + "padding:8px 12px 6px;border-bottom:1px solid #e8d5c4;flex-shrink:0;"
        + "}"
        + ".dpd-quick-title{font-size:14px;font-weight:700;color:#5c2e0e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}"
        + ".dpd-quick-close{"
        + "font-size:20px;color:#999;cursor:pointer;line-height:1;"
        + "padding:0 4px;border-radius:4px;flex-shrink:0;"
        + "}"
        + ".dpd-quick-close:hover{color:#333;background:#f0f0f0;}"
        + ".dpd-quick-body{flex:1;overflow-y:auto;padding: 2px 8px 0px;}"
        + ".dpd-quick-nodata{text-align:center;padding:36px 16px;}"
        + ".dpd-quick-nodata-icon{font-size:32px;color:#ddd;margin-bottom:8px;}"
        + ".dpd-quick-nodata-msg{font-size:14px;color:#666;margin-bottom:10px;}"
        + ".dpd-quick-nodata-msg strong{color:#8b4513;}"
        + ".dpd-quick-nodata-hint{font-size:12px;color:#bbb;line-height:1.6;}"
        + ".dpd-quick-root{padding:12px;}"
        + ".dpd-quick-root-head{font-size:14px;color:#333;margin-bottom:6px;}"
        + ".dpd-quick-root-word{font-weight:700;color:#8b4513;font-size:16px;}"
        + ".dpd-quick-root-sign{color:#888;font-size:12px;margin-left:4px;}"
        + ".dpd-quick-root-mean{font-size:14px;color:#555;line-height:1.6;padding:6px 10px;background:#f8f4f0;border-radius:4px;}"
        + ".dpd-quick-root-hint{font-size:11px;color:#bbb;margin-top:8px;}"
        + "";
    document.head.appendChild(style);
}

/** 拖拽移动 */
function _makeDraggable(el, handle) {
    handle.addEventListener("mousedown", function (e) {
        if (e.target.closest(".dpd-quick-close")) return;
        var ox = e.clientX - el.offsetLeft;
        var oy = e.clientY - el.offsetTop;
        function onMove(ev) {
            el.style.left = (ev.clientX - ox) + "px";
            el.style.top = (ev.clientY - oy) + "px";
        }
        function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    });
}

/** 定位浮窗：靠近点击点右下方，自适应边界 */
function _position(el, clickPos) {
    var winW = window.innerWidth;
    var winH = window.innerHeight;
    var elW = 420;
    var elH = Math.min(winH - 40, 500);

    el.style.width = Math.min(elW, winW - 40) + "px";
    el.style.maxHeight = elH + "px";

    // 先放点击点右侧
    var left = clickPos.x + 16;
    var top = clickPos.y - 20;

    // 右边界溢出 → 放左侧
    if (left + elW > winW - 16) {
        left = Math.max(16, clickPos.x - elW - 16);
    }
    // 下边界溢出
    if (top + elH > winH - 16) {
        top = winH - elH - 16;
    }
    // 上边界溢出
    if (top < 16) top = 16;

    el.style.left = left + "px";
    el.style.top = top + "px";
}

/** 渲染词根信息卡片 */
function _rootHtml(root) {
    var meaning = root.root_meaning
        ? '<div class="dpd-quick-root-mean">' + _e(root.root_meaning) + "</div>"
        : "";
    var sign = root.root_sign
        ? '<span class="dpd-quick-root-sign">' + _e(root.root_sign) + "</span>"
        : "";
    // 避免 roots 表中已含 √ 导致重复
    var rootClean = root.root.replace(/^[√÷×*]+/, "");
    return '<div class="dpd-quick-root">'
        + '<div class="dpd-quick-root-head">词根 <span class="dpd-quick-root-word">\u221A' + _e(rootClean) + '</span>' + sign + '</div>'
        + meaning
        + '<div class="dpd-quick-root-hint">在 DPD 词典中未查到该词的完整词条，以上为词根信息</div>'
        + '</div>';
}

/** 短暂提示，2s 自动消失 */
function _toast(msg) {
    var el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
        position: "fixed", bottom: "60px", left: "50%", transform: "translateX(-50%)",
        background: "#333", color: "#fff", padding: "8px 18px", borderRadius: "6px",
        fontSize: "13px", zIndex: "999999", fontFamily: "-apple-system,sans-serif",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        opacity: "0", transition: "opacity .25s ease",
    });
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = "1"; });
    setTimeout(function () {
        el.style.opacity = "0";
        setTimeout(function () { el.remove(); }, 300);
    }, 2000);
}

function _e(str) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(str).replace(/[&<>"']/g, function (ch) { return map[ch]; });
}
