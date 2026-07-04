/**
 * Query history stored in localStorage.
 */
export class History {
    constructor(maxEntries) {
        this.maxEntries = maxEntries || 100;
        this._key = "dpd_query_history";
        this._pageSize = 10;
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
        list.unshift(entry);
        if (list.length > this.maxEntries) list.length = this.maxEntries;
        localStorage.setItem(this._key, JSON.stringify(list));
    }

    clear() {
        localStorage.removeItem(this._key);
    }

    show() {
        var list = this.get();
        if (list.length === 0) {
            alert("暂无查询历史。");
            return;
        }

        var self = this;
        var totalPages = Math.ceil(list.length / this._pageSize);
        var currentPage = 1;

        var overlay = document.createElement("div");
        overlay.id = "dpd-history-overlay";

        var panel = document.createElement("div");
        panel.className = "dpd-history-panel";

        // 标题栏 + 关闭按钮
        var header = document.createElement("div");
        header.className = "dpd-history-header";
        header.innerHTML = '<span class="dpd-history-title">查询历史</span>'
            + '<span class="dpd-history-close">&times;</span>';

        // 内容区（固定高度，滚动）
        var body = document.createElement("div");
        body.className = "dpd-history-body";

        // 分页栏
        var footer = document.createElement("div");
        footer.className = "dpd-history-footer";

        function renderPage(page) {
            var start = (page - 1) * self._pageSize;
            var end = Math.min(start + self._pageSize, list.length);
            var pageItems = list.slice(start, end);

            var rows = "";
            for (var i = 0; i < pageItems.length; i++) {
                var e = pageItems[i];
                rows += "<tr>"
                    + "<td>" + self._e(e.word || "") + "</td>"
                    + "<td>" + self._e(e.headword || "") + "</td>"
                    + '<td class="dpd-history-time">'
                    + new Date(e.timestamp).toLocaleString() + "</td>"
                    + "</tr>";
            }

            body.innerHTML = ""
                + '<table class="dpd-history-table">'
                + "<thead><tr>"
                + "<th>查询词</th><th>词目</th><th>时间</th>"
                + "</tr></thead>"
                + "<tbody>" + rows + "</tbody>"
                + "</table>";

            // 分页栏
            var info = "第 " + start + "-" + (end - 1) + " 条，共 " + list.length + " 条";
            var btns = '<div class="dpd-history-pages">';
            btns += '<button class="dpd-page-btn" data-page="' + (page - 1) + '"'
                + (page <= 1 ? ' disabled' : '') + '>&#9664; 上一页</button>';
            btns += '<span class="dpd-page-info">' + page + ' / ' + totalPages + '</span>';
            btns += '<button class="dpd-page-btn" data-page="' + (page + 1) + '"'
                + (page >= totalPages ? ' disabled' : '') + '>下一页 &#9654;</button>';
            btns += '</div>';
            footer.innerHTML = '<div class="dpd-history-bar">'
                + '<span class="dpd-history-count">' + info + '</span>'
                + btns
                + '<button class="dpd-history-clear">清空记录</button>'
                + '</div>';

            // 绑定分页事件
            var pageBtns = footer.querySelectorAll(".dpd-page-btn:not([disabled])");
            for (var bi = 0; bi < pageBtns.length; bi++) {
                pageBtns[bi].addEventListener("click", function () {
                    var p = parseInt(this.getAttribute("data-page"));
                    if (p >= 1 && p <= totalPages) {
                        currentPage = p;
                        renderPage(p);
                    }
                });
            }
        }

        renderPage(1);

        panel.appendChild(header);
        panel.appendChild(body);
        panel.appendChild(footer);

        // 清空
        footer.addEventListener("click", function (e) {
            if (e.target.classList.contains("dpd-history-clear")) {
                if (confirm("确定清空所有查询历史？")) {
                    self.clear();
                    overlay.remove();
                }
            }
        });

        // × 关闭
        header.querySelector(".dpd-history-close").addEventListener("click", function () {
            overlay.remove();
        });

        // 点击遮罩关闭
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) overlay.remove();
        });

        overlay.appendChild(panel);

        // 注入样式
        var style = document.createElement("style");
        style.textContent = ""
            + "#dpd-history-overlay{"
            + "position:fixed;inset:0;background:rgba(0,0,0,0.4);"
            + "display:flex;align-items:center;justify-content:center;z-index:99999;"
            + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
            + "}"
            + ".dpd-history-panel{"
            + "background:#fff;border-radius:10px;width:560px;max-width:92%;"
            + "box-shadow:0 8px 30px rgba(0,0,0,0.25);display:flex;flex-direction:column;"
            + "}"
            + ".dpd-history-header{"
            + "display:flex;align-items:center;justify-content:space-between;"
            + "padding:16px 20px 12px;border-bottom:1px solid #e8d5c4;"
            + "}"
            + ".dpd-history-title{font-size:17px;font-weight:700;color:#5c2e0e;}"
            + ".dpd-history-close{"
            + "font-size:24px;color:#999;cursor:pointer;line-height:1;"
            + "padding:0 4px;border-radius:4px;"
            + "}"
            + ".dpd-history-close:hover{color:#333;background:#f0f0f0;}"
            + ".dpd-history-body{"
            + "flex:1;overflow-y:auto;max-height:420px;padding:0 20px;"
            + "}"
            + ".dpd-history-table{width:100%;border-collapse:collapse;font-size:13px;}"
            + ".dpd-history-table th{"
            + "text-align:left;padding:8px 6px 4px;color:#888;font-weight:500;"
            + "font-size:12px;border-bottom:1px solid #eee;position:sticky;top:0;background:#fff;"
            + "}"
            + ".dpd-history-table td{padding:7px 6px;border-bottom:1px solid #f0ebe4;color:#333;}"
            + ".dpd-history-table tbody tr:hover td{background:#fdf8f2;}"
            + ".dpd-history-time{color:#999!important;font-size:12px;white-space:nowrap;}"
            + ".dpd-history-footer{"
            + "border-top:1px solid #e8d5c4;padding:10px 20px 14px;"
            + "}"
            + ".dpd-history-bar{"
            + "display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;"
            + "}"
            + ".dpd-history-count{font-size:12px;color:#999;white-space:nowrap;}"
            + ".dpd-history-pages{display:flex;align-items:center;gap:6px;}"
            + ".dpd-page-btn{"
            + "padding:4px 10px;border:1px solid #d4a574;border-radius:4px;"
            + "background:#fef9f0;cursor:pointer;font-size:12px;color:#5c2e0e;"
            + "}"
            + ".dpd-page-btn:hover:not([disabled]){background:#fdf3e6;}"
            + ".dpd-page-btn[disabled]{opacity:.4;cursor:default;}"
            + ".dpd-page-info{font-size:13px;color:#666;min-width:48px;text-align:center;}"
            + ".dpd-history-clear{"
            + "padding:4px 10px;border:1px solid #e0c0b0;border-radius:4px;"
            + "background:#fef9f0;cursor:pointer;font-size:12px;color:#a0522d;"
            + "}"
            + ".dpd-history-clear:hover{background:#fdf3e6;border-color:#c08060;}"
            + "";

        overlay.appendChild(style);
        document.body.appendChild(overlay);
    }

    _e(str) {
        var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return String(str).replace(/[&<>"']/g, function (ch) { return map[ch]; });
    }
}
