/**
 * 工具条：放在 WikiPali 搜索结果上方，点击展开变格表/拆解。
 */
import { Renderer } from "../inflection/renderer.js";

export class Panel {
    constructor(word, headword, lookupRow, deconstruction, query) {
        this.word = word;
        this.headword = headword;
        this.lookupRow = lookupRow;
        this.deconstruction = deconstruction;
        this.query = query;
        this._el = null;
        this._expanded = false;
    }

    remove() {
        if (this._el) {
            this._el.remove();
            this._el = null;
        }
    }

    // ── 紧凑工具条 ──────────────────────────────────────────────
    _compactHTML() {
        const hw = this.headword;
        return `
            <div class="dpd-bar">
                <span class="dpd-bar-lemma">${this._e(hw.lemma_1)}</span>
                <span class="dpd-bar-pos">${this._e(hw.pos || "")}</span>
                <span class="dpd-bar-meaning">${this._e(hw.meaning_1 || "")}</span>
                <span class="dpd-bar-toggle">▶ DPD</span>
            </div>
            <div class="dpd-body" style="display:none"></div>
            ${this._styleHTML()}`;
    }

    // ── 展开内容 ─────────────────────────────────────────────────
    _expandHTML() {
        const hw = this.headword;
        const parts = [];

        // 释义
        const meaning = [hw.lemma_1, hw.pos];
        if (hw.meaning_1) meaning.push("— " + hw.meaning_1);
        if (hw.meaning_lit) meaning.push("(lit. " + hw.meaning_lit + ")");
        parts.push(`<div class="dpd-section">${this._e(meaning.join(" "))}</div>`);

        // 变格表
        if (hw.stem && hw.pattern) {
            const renderer = new Renderer(this.query.getAllTemplates());
            const tableHtml = renderer.render(hw.stem, hw.pattern);
            if (tableHtml) {
                parts.push(`
                    <details class="dpd-section" open>
                        <summary>变格表</summary>
                        ${tableHtml}
                    </details>`);
            }
        }

        // 复合词拆解
        if (this.deconstruction && this.deconstruction.length > 0) {
            parts.push(`
                <div class="dpd-section dpd-decon">
                    复合词：${this.deconstruction
                        .map((d) => `<span class="dpd-decomp">${this._e(d)}</span>`)
                        .join(" + ")}
                </div>`);
        }

        // 语法信息
        if (this.lookupRow.grammar) {
            parts.push(`<div class="dpd-section">${this._e(this.lookupRow.grammar)}</div>`);
        }

        return parts.join("\n");
    }

    // ── 点击切换 ─────────────────────────────────────────────────
    _bindToggle() {
        const bar = this._el.querySelector(".dpd-bar");
        const body = this._el.querySelector(".dpd-body");
        const toggle = this._el.querySelector(".dpd-bar-toggle");

        bar.addEventListener("click", () => {
            this._expanded = !this._expanded;
            if (this._expanded) {
                body.innerHTML = this._expandHTML();
                body.style.display = "block";
                toggle.textContent = "▼ DPD";
            } else {
                body.style.display = "none";
                toggle.textContent = "▶ DPD";
            }
        });
    }

    injectBefore(referenceEl) {
        this._el = document.createElement("div");
        this._el.className = "dpd-toolbar";
        this._el.innerHTML = this._compactHTML();
        referenceEl.parentNode.insertBefore(this._el, referenceEl);
        this._bindToggle();
    }

    // ── 样式 ─────────────────────────────────────────────────────
    _styleHTML() {
        return `<style>
            .dpd-toolbar {
                font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                margin:6px 0;border-radius:6px;overflow:hidden;
                border:1px solid #d4a574;background:#fef9f0;
            }
            .dpd-bar {
                display:flex;align-items:center;gap:8px;
                padding:7px 12px;cursor:pointer;user-select:none;
                font-size:14px;
            }
            .dpd-bar:hover { background:#fdf3e6; }
            .dpd-bar-lemma { font-weight:700;color:#8b4513;font-size:15px; }
            .dpd-bar-pos { color:#888;font-style:italic;font-size:12px; }
            .dpd-bar-meaning { color:#444;font-size:13px;flex:1; }
            .dpd-bar-toggle { color:#8b4513;font-weight:600;font-size:12px; }
            .dpd-body { padding:4px 12px 12px; }
            .dpd-section { margin:6px 0;font-size:13px;color:#333; }
            .dpd-section summary { cursor:pointer;color:#8b4513;font-weight:600;font-size:13px; }
            .dpd-decon { padding:5px 8px;background:#f0f7ee;border-radius:4px; }
            .dpd-decomp { font-weight:600;color:#2d5a27; }
            .dpd-inflection-table {
                border-collapse:collapse;width:100%;margin:4px 0;font-size:12px;
            }
            .dpd-inflection-table th,.dpd-inflection-table td {
                border:1px solid #d4a574;padding:2px 6px;text-align:center;
            }
            .dpd-inflection-table th { background:#f5e6d3;font-weight:600; }
            .dpd-case-label { width:50px; }
            .dpd-empty { border:none !important;background:transparent !important; }
        </style>`;
    }

    _e(str) {
        const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return String(str).replace(/[&<>"']/g, (ch) => map[ch]);
    }
}
