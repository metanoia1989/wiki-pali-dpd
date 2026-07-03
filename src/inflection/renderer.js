/**
 * Client-side declension table renderer.
 * Ported from dpd-db's generate_inflection_tables.py logic.
 */
export class Renderer {
    /**
     * @param {Map<string, object>} templates - Map of pattern -> {pattern, like, data}
     */
    constructor(templates) {
        this.templates = templates;
    }

    /**
     * Render inflection table HTML for a given stem and pattern.
     * @param {string} stem - The word stem (e.g. "loka").
     * @param {string} pattern - Template name (e.g. "masc__a").
     * @param {string} [highlight] - Optional word to highlight in the table.
     * @returns {string} HTML table string, or empty string if template not found.
     */
    render(stem, pattern, highlight) {
        const tmpl = this._resolvePattern(pattern);
        if (!tmpl) return "";

        const tableData = JSON.parse(tmpl.data);
        let html = '<table class="dpd-inflection-table">';

        for (let rowIdx = 0; rowIdx < tableData.length; rowIdx++) {
            const row = tableData[rowIdx];
            html += "<tr>";

            for (let colIdx = 0; colIdx < row.length; colIdx++) {
                const cell = row[colIdx];

                if (rowIdx === 0) {
                    // Header row
                    if (colIdx === 0) {
                        html += '<th class="dpd-empty"></th>';
                    } else if (colIdx % 2 === 1) {
                        html += `<th>${this._escape(cell[0] || "")}</th>`;
                    }
                } else if (colIdx === 0) {
                    // Grammar label (Nom, Acc, ...)
                    html += `<th class="dpd-case-label">${this._escape(cell[0] || "")}</th>`;
                } else if (colIdx % 2 === 1) {
                    // Inflection suffix column
                    const cleaned = this._cleanStem(stem);
                    const forms = cell.map((suffix) => {
                        const form = cleaned + suffix;
                        if (highlight && form === highlight) {
                            return '<span class="dpd-hl">' + this._escape(form) + "</span>";
                        }
                        return this._escape(form);
                    });
                    html += `<td>${forms.join("<br>")}</td>`;
                }
            }
            html += "</tr>";
        }

        html += "</table>";
        return html;
    }

    /**
     * Resolve pattern, following the 'like' chain.
     */
    _resolvePattern(pattern) {
        let tmpl = this.templates.get(pattern);
        if (!tmpl) return null;

        // Follow "like" chain (max depth 5 to avoid cycles)
        let depth = 0;
        while (tmpl.like && !tmpl.like.startsWith("irreg") && depth < 5) {
            const next = this.templates.get(tmpl.like);
            if (!next || next === tmpl) break;
            if (next.data) return next;
            tmpl = next;
            depth++;
        }

        return tmpl;
    }

    _cleanStem(stem) {
        return stem.replace(/[!*]/g, "");
    }

    _escape(str) {
        const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return String(str).replace(/[&<>"']/g, (ch) => map[ch]);
    }
}
