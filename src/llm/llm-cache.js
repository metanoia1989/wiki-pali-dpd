/**
 * LLM 查询/结果缓存（localStorage）。
 */
export class LlmCache {
    constructor(maxEntries) {
        this.maxEntries = maxEntries || 200;
        this._key = "dpd_llm_cache";
        this._pageSize = 15;
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

    // ── 展示面板（两层：问题列表 → 点击展开问答详情）──

    show() {
        var list = this.get();
        if (list.length === 0) {
            alert("暂无 LLM 问答记录。");
            return;
        }

        var self = this;
        var totalPages = Math.ceil(list.length / this._pageSize);
        var currentPage = 1;

        var overlay = document.createElement("div");
        overlay.id = "dpd-llm-history-overlay";

        var panel = document.createElement("div");
        panel.className = "dpd-llm-history-panel";

        // 标题栏 + 关闭
        var header = document.createElement("div");
        header.className = "dpd-llm-history-header";
        header.innerHTML = '<span class="dpd-llm-history-title">LLM 问答记录</span>'
            + '<span class="dpd-llm-history-close">&times;</span>';

        // 内容区
        var body = document.createElement("div");
        body.className = "dpd-llm-history-body";

        // 分页栏
        var footer = document.createElement("div");
        footer.className = "dpd-llm-history-footer";

        function renderPage(page) {
            var start = (page - 1) * self._pageSize;
            var end = Math.min(start + self._pageSize, list.length);
            var pageItems = list.slice(start, end);

            var items = "";
            for (var i = 0; i < pageItems.length; i++) {
                var e = pageItems[i];
                var qhtml = '<span class="dpd-llm-q-label">选中</span><span class="dpd-llm-q-val">'
                    + self._e(e.text) + '</span>'
                    + (e.prompt ? '<br><span class="dpd-llm-q-label">提示</span><span class="dpd-llm-q-val">'
                        + self._e(e.prompt) + '</span>' : '');
                var time = new Date(e.timestamp).toLocaleString();
                items += '<div class="dpd-llm-history-item">'
                    + '<div class="dpd-llm-history-q" data-idx="' + (start + i) + '">'
                    + '<span class="dpd-llm-history-qtext">' + qhtml + '</span>'
                    + '<span class="dpd-llm-history-time">' + time + '</span>'
                    + '<span class="dpd-llm-history-arrow">&#9656;</span>'
                    + '</div>'
                    + '<div class="dpd-llm-history-detail" style="display:none">'
                    + '<div class="dpd-llm-detail-response">' + (e.response || "") + '</div>'
                    + '<div class="dpd-llm-detail-close">收起 &#9656;</div>'
                    + '</div>'
                    + '</div>';
            }

            body.innerHTML = '<div class="dpd-llm-history-list">' + items + '</div>';

            // 绑定点击展开/收起
            var qEls = body.querySelectorAll(".dpd-llm-history-q");
            for (var qi = 0; qi < qEls.length; qi++) {
                qEls[qi].addEventListener("click", function () {
                    var item = this.parentNode;
                    var detail = item.querySelector(".dpd-llm-history-detail");
                    var arrow = this.querySelector(".dpd-llm-history-arrow");
                    if (!detail) return;
                    var isHidden = detail.style.display === "none";

                    // 先重置所有项
                    var allItems = body.querySelectorAll(".dpd-llm-history-item");
                    for (var ai = 0; ai < allItems.length; ai++) {
                        allItems[ai].classList.remove("dpd-llm-active");
                    }
                    var allQ = body.querySelectorAll(".dpd-llm-history-q");
                    for (var aqi = 0; aqi < allQ.length; aqi++) {
                        allQ[aqi].classList.remove("dpd-llm-q-dim");
                    }

                    if (isHidden) {
                        // 展开：高亮当前，虚化其他
                        item.classList.add("dpd-llm-active");
                        for (var ai = 0; ai < allItems.length; ai++) {
                            var otherDetail = allItems[ai].querySelector(".dpd-llm-history-detail");
                            if (allItems[ai] !== item && (!otherDetail || otherDetail.style.display !== "block")) {
                                var q = allItems[ai].querySelector(".dpd-llm-history-q");
                                if (q) q.classList.add("dpd-llm-q-dim");
                            }
                        }
                        detail.style.display = "block";
                        arrow.textContent = "\u25BC";
                    } else {
                        // 收起：移除所有高亮和虚化
                        detail.style.display = "none";
                        arrow.textContent = "\u25B6";
                    }
                });
            }
            // 收起按钮
            var closeBtns = body.querySelectorAll(".dpd-llm-detail-close");
            for (var ci = 0; ci < closeBtns.length; ci++) {
                closeBtns[ci].addEventListener("click", function (e) {
                    e.stopPropagation();
                    var detail = this.parentNode;
                    var item = detail.parentNode;
                    var arrow = item.querySelector(".dpd-llm-history-arrow");
                    detail.style.display = "none";
                    if (arrow) arrow.textContent = "\u25B6";
                    item.classList.remove("dpd-llm-active");
                    // 恢复所有虚化
                    var allQ = body.querySelectorAll(".dpd-llm-history-q");
                    for (var aqi = 0; aqi < allQ.length; aqi++) {
                        allQ[aqi].classList.remove("dpd-llm-q-dim");
                    }
                });
            }

            var info = "第 " + start + "-" + (end - 1) + " 条，共 " + list.length + " 条";
            var btns = '<div class="dpd-llm-history-pages">';
            btns += '<button class="dpd-page-btn" data-page="' + (page - 1) + '"'
                + (page <= 1 ? ' disabled' : '') + '>&#9664; 上一页</button>';
            btns += '<span class="dpd-page-info">' + page + ' / ' + totalPages + '</span>';
            btns += '<button class="dpd-page-btn" data-page="' + (page + 1) + '"'
                + (page >= totalPages ? ' disabled' : '') + '>下一页 &#9654;</button>';
            btns += '</div>';
            footer.innerHTML = '<div class="dpd-llm-history-bar">'
                + '<span class="dpd-llm-history-count">' + info + '</span>'
                + btns
                + '<button class="dpd-llm-history-clear">清空记录</button>'
                + '</div>';

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
            if (e.target.classList.contains("dpd-llm-history-clear")) {
                if (confirm("确定清空所有 LLM 问答记录？")) {
                    self.clear();
                    overlay.remove();
                }
            }
        });

        // × 关闭
        header.querySelector(".dpd-llm-history-close").addEventListener("click", function () {
            overlay.remove();
        });

        // 点击遮罩关闭
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) overlay.remove();
        });

        overlay.appendChild(panel);

        var style = document.createElement("style");
        style.textContent = ""
            + "#dpd-llm-history-overlay{"
            + "position:fixed;inset:0;background:rgba(0,0,0,0.4);"
            + "display:flex;align-items:center;justify-content:center;z-index:99999;"
            + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
            + "}"
            + ".dpd-llm-history-panel{"
            + "background:#fff;border-radius:10px;width:640px;max-width:92%;"
            + "box-shadow:0 8px 30px rgba(0,0,0,0.25);display:flex;flex-direction:column;"
            + "}"
            + ".dpd-llm-history-header{"
            + "display:flex;align-items:center;justify-content:space-between;"
            + "padding:14px 20px 10px;border-bottom:1px solid #e8d5c4;"
            + "}"
            + ".dpd-llm-history-title{font-size:17px;font-weight:700;color:#5c2e0e;}"
            + ".dpd-llm-history-close{"
            + "font-size:24px;color:#999;cursor:pointer;line-height:1;"
            + "padding:0 4px;border-radius:4px;"
            + "}"
            + ".dpd-llm-history-close:hover{color:#333;background:#f0f0f0;}"
            + ".dpd-llm-history-body{"
            + "flex:1;overflow-y:auto;max-height:520px;padding:0;"
            + "}"
            // 问题列表
            + ".dpd-llm-history-list{display:flex;flex-direction:column;gap:0;}"
            + ".dpd-llm-history-q{"
            + "display:flex;align-items:center;gap:8px;"
            + "padding:10px 16px;cursor:pointer;user-select:none;"
            + "border-bottom:1px solid #f0ebe4;"
            + "}"
            + ".dpd-llm-history-q:hover{background:#fdf8f2;}"
            + ".dpd-llm-history-qtext{"
            + "flex:1;font-size:13px;line-height:1.5;color:#333;overflow:hidden;"
            + "}"
            + ".dpd-llm-q-label{font-size:12px;font-weight:600;color:#8b4513;margin-right:4px;}"
            + ".dpd-llm-q-val{color:#333;}"
            // 高亮当前问题
            + ".dpd-llm-active .dpd-llm-history-q{background:#fdf3e6;border-bottom:none;}"
            + ".dpd-llm-active .dpd-llm-q-val{color:#8b4513;font-weight:600;}"
            + ".dpd-llm-active .dpd-llm-q-label{color:#b8936e;}"
            + ".dpd-llm-active .dpd-llm-history-time{color:#b8936e;}"
            + ".dpd-llm-active .dpd-llm-history-arrow{color:#8b4513;}"
            // 虚化其他问题
            + ".dpd-llm-q-dim .dpd-llm-q-label{color:#ddd;}"
            + ".dpd-llm-q-dim .dpd-llm-q-val{color:#ccc;}"
            + ".dpd-llm-q-dim .dpd-llm-history-time{color:#e8e0d8;}"
            + ".dpd-llm-q-dim .dpd-llm-history-arrow{color:#e8e0d8;}"
            + ".dpd-llm-q-dim:hover .dpd-llm-q-val{color:#bbb;}"
            // 时间
            + ".dpd-llm-history-time{font-size:11px;color:#bbb;white-space:nowrap;transition:color .2s;}"
            + ".dpd-llm-history-arrow{font-size:11px;color:#bbb;min-width:14px;text-align:center;transition:color .2s;}"
            // 问答详情（与问题行紧密连接）
            + ".dpd-llm-history-detail{"
            + "padding:0;background:#faf8f5;"
            + "border-bottom:1px solid #e8d5c4;font-size:13px;line-height:1.7;"
            + "}"
            + ".dpd-llm-detail-response{"
            + "margin:0;padding:8px 16px;background:#fff;"
            + "border-top:1px solid #e8d5c4;border-bottom:1px solid #e8d5c4;"
            + "font-size:12px;line-height:1.7;color:#333;"
            + "}"
            + ".dpd-llm-detail-response p{margin:4px 0;}"
            + ".dpd-llm-detail-response h1,.dpd-llm-detail-response h2,.dpd-llm-detail-response h3{margin:8px 0 4px;color:#333;}"
            + ".dpd-llm-detail-response h3{font-size:14px;}"
            + ".dpd-llm-detail-response h2{font-size:15px;}"
            + ".dpd-llm-detail-response ul,.dpd-llm-detail-response ol{margin:4px 0;padding-left:20px;}"
            + ".dpd-llm-detail-response li{margin:2px 0;}"
            + ".dpd-llm-detail-response code{background:#eef2f6;padding:1px 4px;border-radius:3px;font-size:11px;font-family:monospace;color:#c7254e;}"
            + ".dpd-llm-detail-response pre{background:#f4f6f8;padding:8px 12px;border-radius:4px;overflow-x:auto;margin:6px 0;}"
            + ".dpd-llm-detail-response pre code{background:none;padding:0;color:#333;}"
            + ".dpd-llm-detail-response strong{font-weight:600;color:#222;}"
            + ".dpd-llm-detail-response em{font-style:italic;}"
            // 收起按钮
            + ".dpd-llm-detail-close{"
            + "text-align:center;padding:8px 0 6px;font-size:12px;color:#999;"
            + "cursor:pointer;user-select:none;"
            + "}"
            + ".dpd-llm-detail-close:hover{color:#8b4513;}"
            // 分页栏
            + ".dpd-llm-history-footer{"
            + "border-top:1px solid #e8d5c4;padding:10px 16px 14px;"
            + "}"
            + ".dpd-llm-history-bar{"
            + "display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;"
            + "}"
            + ".dpd-llm-history-count{font-size:12px;color:#999;white-space:nowrap;}"
            + ".dpd-llm-history-pages{display:flex;align-items:center;gap:6px;}"
            + ".dpd-llm-history-pages .dpd-page-btn{"
            + "padding:4px 10px;border:1px solid #d4a574;border-radius:4px;"
            + "background:#fef9f0;cursor:pointer;font-size:12px;color:#5c2e0e;"
            + "}"
            + ".dpd-llm-history-pages .dpd-page-btn:hover:not([disabled]){background:#fdf3e6;}"
            + ".dpd-llm-history-pages .dpd-page-btn[disabled]{opacity:.4;cursor:default;}"
            + ".dpd-llm-history-pages .dpd-page-info{font-size:13px;color:#666;min-width:48px;text-align:center;}"
            + ".dpd-llm-history-clear{"
            + "padding:4px 10px;border:1px solid #e0c0b0;border-radius:4px;"
            + "background:#fef9f0;cursor:pointer;font-size:12px;color:#a0522d;"
            + "}"
            + ".dpd-llm-history-clear:hover{background:#fdf3e6;border-color:#c08060;}"
            + "";

        overlay.appendChild(style);
        document.body.appendChild(overlay);
    }

    _e(str) {
        var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return String(str).replace(/[&<>"']/g, function (ch) { return map[ch]; });
    }
}
