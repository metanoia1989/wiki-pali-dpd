/**
 * Query history stored in localStorage.
 */
export class History {
    constructor(maxEntries) {
        this.maxEntries = maxEntries || 100;
        this._key = "dpd_query_history";
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
            alert("No query history yet.");
            return;
        }

        var rows = "";
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            rows += "<tr>"
                + '<td style="padding:4px 8px;">' + this._e(e.word || "") + "</td>"
                + '<td style="padding:4px 8px;">' + this._e(e.headword || "") + "</td>"
                + '<td style="padding:4px 8px;color:#888;font-size:12px;">'
                + new Date(e.timestamp).toLocaleString() + "</td>"
                + "</tr>";
        }

        var html = '<div id="dpd-history-overlay" style="'
            + 'position:fixed;inset:0;background:rgba(0,0,0,0.4);'
            + 'display:flex;align-items:center;justify-content:center;z-index:99999;'
            + '">'
            + '<div style="'
            + 'background:#fff;border-radius:8px;padding:24px;'
            + 'max-width:500px;width:90%;max-height:70vh;overflow-y:auto;'
            + 'box-shadow:0 4px 20px rgba(0,0,0,0.2);'
            + '">'
            + '<h2 style="margin:0 0 16px;font-size:18px;color:#333;">Query History</h2>'
            + '<table style="width:100%;border-collapse:collapse;font-size:14px;">'
            + '<tr style="background:#f5e6d3;">'
            + '<th style="padding:4px 8px;text-align:left;color:#333;">Word</th>'
            + '<th style="padding:4px 8px;text-align:left;color:#333;">Lemma</th>'
            + '<th style="padding:4px 8px;text-align:left;color:#333;">Time</th>'
            + "</tr>"
            + rows
            + "</table>"
            + '<div style="margin-top:16px;">'
            + '<button id="dpd-history-close" style="'
            + 'padding:6px 14px;border:1px solid #ccc;border-radius:4px;'
            + 'background:#eee;cursor:pointer;font-size:14px;color:#333;'
            + '">Close</button>'
            + "</div></div>"
            + '<style>'
            + "#dpd-history-overlay{"
            + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
            + "color:#333;font-size:14px;line-height:1.5;}"
            + "#dpd-history-overlay *{"
            + "color:inherit;font-size:inherit;line-height:inherit;"
            + "font-family:inherit;}"
            + "#dpd-history-overlay h2{font-size:18px;font-weight:700;color:#333!important;}"
            + "#dpd-history-overlay td{color:#333!important;}"
            + "#dpd-history-overlay th{color:#333!important;}"
            + "#dpd-history-overlay button{"
            + "font-family:inherit;text-transform:none;letter-spacing:normal;"
            + "box-shadow:none;text-shadow:none;}"
            + "</style></div>";

        var container = document.createElement("div");
        container.innerHTML = html;
        document.body.appendChild(container);
        document.getElementById("dpd-history-close").onclick = function () { container.remove(); };
    }

    _e(str) {
        var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return String(str).replace(/[&<>"']/g, function (ch) { return map[ch]; });
    }
}
