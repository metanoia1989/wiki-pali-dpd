/**
 * Query history stored in localStorage.
 */
export class History {
    constructor(maxEntries = 100) {
        this.maxEntries = maxEntries;
        this._key = "dpd_query_history";
    }

    get() {
        try {
            return JSON.parse(localStorage.getItem(this._key) || "[]");
        } catch {
            return [];
        }
    }

    add(entry) {
        const list = this.get();
        list.unshift(entry);
        if (list.length > this.maxEntries) list.length = this.maxEntries;
        localStorage.setItem(this._key, JSON.stringify(list));
    }

    clear() {
        localStorage.removeItem(this._key);
    }

    show() {
        const list = this.get();
        if (list.length === 0) {
            alert("No query history yet.");
            return;
        }

        const html = `
            <div id="dpd-history-overlay" style="
                position: fixed; inset: 0; background: rgba(0,0,0,0.4);
                display: flex; align-items: center; justify-content: center; z-index: 99999;
            ">
                <div style="
                    background: #fff; border-radius: 8px; padding: 24px;
                    max-width: 500px; width: 90%; max-height: 70vh; overflow-y: auto;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                ">
                    <h2 style="margin: 0 0 16px; font-size: 18px;">Query History</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr style="background: #f5e6d3;">
                            <th style="padding: 4px 8px; text-align: left;">Word</th>
                            <th style="padding: 4px 8px; text-align: left;">Lemma</th>
                            <th style="padding: 4px 8px; text-align: left;">Time</th>
                        </tr>
                        ${list.map(e => `
                            <tr>
                                <td style="padding: 4px 8px;">${e.word}</td>
                                <td style="padding: 4px 8px;">${e.headword}</td>
                                <td style="padding: 4px 8px; color: #888; font-size: 12px;">
                                    ${new Date(e.timestamp).toLocaleString()}
                                </td>
                            </tr>
                        `).join("")}
                    </table>
                    <div style="margin-top: 16px;">
                        <button id="dpd-history-close" style="
                            padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px;
                            background: #eee; cursor: pointer;
                        ">Close</button>
                    </div>
                </div>
            </div>`;

        const container = document.createElement("div");
        container.innerHTML = html;
        document.body.appendChild(container);
        document.getElementById("dpd-history-close").onclick = () => container.remove();
    }
}
