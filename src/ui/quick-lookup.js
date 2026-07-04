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
        var result = lookupHeadwords(query, word);
        if (!result) return;

        _injectStyle();

        var id = "dpd-quick-" + (_nextId++);
        var floatEl = document.createElement("div");
        floatEl.id = id;
        floatEl.className = "dpd-quick-float";

        // 标题栏
        var header = document.createElement("div");
        header.className = "dpd-quick-header";
        header.innerHTML = '<span class="dpd-quick-title">' + _e(word) + '</span><span class="dpd-quick-close">&times;</span>';

        // 内容区
        var body = document.createElement("div");
        body.className = "dpd-quick-body";

        floatEl.appendChild(header);
        floatEl.appendChild(body);
        document.body.appendChild(floatEl);

        // 拖拽移动
        _makeDraggable(floatEl, header);

        // 关闭
        header.querySelector(".dpd-quick-close").addEventListener("click", function () {
            floatEl.remove();
        });

        // 注入 DPD 结果
        var panel = new Panel(word, result.headwords, result.lookupRow, result.deconstruction, query, true);
        panel.renderTo(body);
        // 存引用方便调试
        floatEl._panel = panel;

        // 定位：在点击点右侧，垂直跟随
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

function _e(str) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(str).replace(/[&<>"']/g, function (ch) { return map[ch]; });
}
