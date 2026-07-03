/**
 * 工具条：放在 WikiPali 搜索结果上方，支持多词条展示 + 曲折分析表。
 */
import { Renderer } from "../inflection/renderer.js";

export class Panel {
    constructor(word, headwords, lookupRow, deconstruction, query, autoShow) {
        this.word = word;
        this.headwords = headwords;
        this.lookupRow = lookupRow;
        this.deconstruction = deconstruction;
        this.query = query;
        this._autoShow = autoShow !== false;
        this._el = null;
        this._sortCol = -1;
        this._sortDir = 1;
        this._fullRendered = false;
    }

    remove() {
        if (this._el) {
            this._el.remove();
            this._el = null;
        }
    }

    // ── POS 映射 ─────────────────────────────────────
    _cleanLemma(lemma) {
        return lemma.replace(/\s+\d+(\.\d+)*$/, "");
    }
    _lemmaNumber(lemma) {
        var m = lemma.match(/\s+(\d+(\.\d+)*)$/);
        return m ? m[1] : "";
    }

    _mapPos(pos) {
        if (pos === "adj") return "adj";
        if (pos === "masc" || pos === "fem" || pos === "nt") return "noun";
        var verbs = {
            "pr": 1, "aor": 1, "fut": 1, "perf": 1, "cond": 1,
            "opt": 1, "imp": 1, "imperf": 1,
            "pp": 1, "prp": 1, "ptp": 1,
            "ger": 1, "abs": 1, "inf": 1, "cs": 1, "ve": 1
        };
        if (verbs[pos]) return "verb";
        if (pos === "ind") return "ind";
        if (pos === "pron") return "pron";
        if (pos === "card" || pos === "ordin") return "numeral";
        return pos;
    }

    _normGender(g) {
        if (g === "neut") return "nt";
        return g;
    }

    _knownGenders(g) {
        return g === "masc" || g === "fem" || g === "nt" || g === "neut";
    }

    // ── 构建 ──────────────────────────────────────────
    _buildHTML() {
        var parts = [];
        var self = this;

        // 1. 曲折分析表（始终显示）
        var analyses = this._getAnalyses();
        if (analyses.length > 0) {
            this._analyses = analyses;
            var maxRows = parseInt(GM_getValue("dpd_max_rows", 5), 10) || 5;
            var rowsHtml = this._renderAllRows(analyses, maxRows);
            parts.push(
                '<div class="dpd-analysis-wrap"><table class="dpd-analysis'
                + (analyses.length > maxRows ? ' dpd-limited' : '')
                + '" id="dpd-analysis-tbl">'
                + '<thead><tr>'
                + '<th data-col="0">pos <span class="dpd-sort">\u21C5</span></th>'
                + '<th data-col="1"><span class="dpd-sort">\u21C5</span></th>'
                + '<th data-col="2"><span class="dpd-sort">\u21C5</span></th>'
                + '<th data-col="3"><span class="dpd-sort">\u21C5</span></th>'
                + '<th class="dpd-of"></th>'
                + '<th data-col="5">word <span class="dpd-sort">\u21C5</span></th>'
                + "</tr></thead>"
                + '<tbody id="dpd-analysis-body">'
                + rowsHtml
                + "</tbody>"
                + "</table></div>"
            );
        }

        // 2. 复合词突出展示（单一结果时，在词条列表前）
        if (this.headwords.length === 1) {
            var hw0 = this.headwords[0];
            var isCompound = false;
            var compoundParts = null;
            if (this.deconstruction && this.deconstruction.length > 0) {
                isCompound = true;
                compoundParts = this.deconstruction;
            } else if (hw0.grammar && hw0.grammar.indexOf("comp") >= 0) {
                isCompound = true;
            }
            if (isCompound) {
                var compHtml = "";
                if (compoundParts) {
                    var compDecon = [];
                    for (var di = 0; di < compoundParts.length; di++) {
                        compDecon.push('<span class="dpd-decomp">' + self._e(compoundParts[di]) + "</span>");
                    }
                    compHtml = compDecon.join(" + ");
                } else if (hw0.construction) {
                    compHtml = '<span class="dpd-decomp">' + self._e(hw0.construction) + "</span>";
                }
                if (compHtml) {
                    parts.push('<div class="dpd-compound">' + compHtml + "</div>");
                }
            }
        }

        // 3. 词条列表
        for (var hi = 0; hi < this.headwords.length; hi++) {
            var hw = this.headwords[hi];
            var bodyParts = [];

            // 词义放第一行
            var meaningLine = (hw.pos || "") + ". " + (hw.meaning_1 || "");
            if (hw.meaning_lit) {
                meaningLine += " (lit. " + hw.meaning_lit + ")";
            }
            bodyParts.push('<div class="dpd-line">' + self._e(meaningLine) + "</div>");

            // 词条信息块（lemma / grammar / root family / root / construction）
            var infoParts = [];

            // Lemma（清理尾部的编号）
            var cleanLemma = self._cleanLemma(hw.lemma_1);
            infoParts.push('<div class="dpd-info"><span class="dpd-info-label">Lemma</span> ' + self._e(cleanLemma) + "</div>");

            // Grammar
            if (hw.grammar) {
                infoParts.push('<div class="dpd-info"><span class="dpd-info-label">Grammar</span> ' + self._e(hw.grammar) + "</div>");
            }

            // Root Family
            if (hw.family_root) {
                infoParts.push('<div class="dpd-info"><span class="dpd-info-label">Root Family</span> <span class="dpd-root">' + self._e(hw.family_root) + "</span></div>");
            }

            // Root
            if (hw.root_key) {
                var root = self.query.getRoot(hw.root_key);
                if (root) {
                    var rootText = self._e(hw.root_key);
                    if (root.root_sign) rootText += " " + self._e(root.root_sign);
                    if (root.root_meaning) rootText += " (" + self._e(root.root_meaning) + ")";
                    infoParts.push('<div class="dpd-info"><span class="dpd-info-label">Root</span> <span class="dpd-root">' + rootText + "</span></div>");
                } else {
                    infoParts.push('<div class="dpd-info"><span class="dpd-info-label">Root</span> <span class="dpd-root">' + self._e(hw.root_key) + "</span></div>");
                }
            }

            // Construction
            if (hw.construction) {
                infoParts.push('<div class="dpd-info"><span class="dpd-info-label">Construction</span> ' + self._e(hw.construction) + "</div>");
            }

            if (infoParts.length > 0) {
                bodyParts.push('<div class="dpd-info-block">' + infoParts.join("\n") + "</div>");
            }

            // 变格表
            if (hw.stem && hw.pattern) {
                var renderer = new Renderer(this.query.getAllTemplates());
                var tableHtml = renderer.render(hw.stem, hw.pattern, this.word);
                if (tableHtml) {
                    bodyParts.push('<div class="dpd-table-scroll">' + tableHtml + "</div>");
                }
            }

            // 复合词拆解
            if (this.deconstruction && this.deconstruction.length > 0) {
                var deconParts = [];
                for (var di = 0; di < this.deconstruction.length; di++) {
                    deconParts.push(
                        '<span class="dpd-decomp">' + self._e(this.deconstruction[di]) + "</span>"
                    );
                }
                bodyParts.push(
                    '<div class="dpd-decon">'
                    + "\u62C6\u89E3\uFF1A" + deconParts.join(" + ")
                    + "</div>"
                );
            }

            // 语法信息
            if (this.lookupRow.grammar) {
                bodyParts.push(
                    '<div class="dpd-grammar">' + self._e(this.lookupRow.grammar) + "</div>"
                );
            }

            parts.push(
                '<div class="dpd-entry">'
                + '<div class="dpd-entry-header" data-id="' + hw.id + '">'
                + '<span class="dpd-entry-lemma">' + self._e(self._cleanLemma(hw.lemma_1)) + '<span class="dpd-entry-num">' + self._e(self._lemmaNumber(hw.lemma_1)) + '</span></span>'
                + '<span class="dpd-entry-pos">' + self._e(hw.pos || "") + '</span>'
                + '<span class="dpd-entry-meaning">' + self._truncate(self._e(hw.meaning_1 || ""), 50) + '</span>'
                + '<span class="dpd-entry-toggle">\u25B6</span>'
                + "</div>"
                + '<div class="dpd-entry-body" style="display:none">'
                + bodyParts.join("\n")
                + "</div>"
                + "</div>"
            );
        }

        return parts.join("\n");
    }

    _renderAllRows(analyses, maxRows) {
        var rows = "";
        for (var i = 0; i < analyses.length; i++) {
            var a = analyses[i];
            var cls = (maxRows && i >= maxRows) ? ' class="dpd-h"' : "";
            rows += "<tr" + cls + ">"
                + "<td>" + this._e(this._mapPos(a.pos)) + "</td>"
                + "<td>" + this._e(this._normGender(a.gender)) + "</td>"
                + "<td>" + this._e(a.case) + "</td>"
                + "<td>" + this._e(a.number) + "</td>"
                + "<td class='dpd-of'>&nbsp;</td>"
                + "<td>" + this._e(a.lemma) + "</td>"
                + "</tr>";
        }
        if (maxRows && analyses.length > maxRows) {
            rows += '<tr class="dpd-x" data-n="' + analyses.length + '">'
                + '<td colspan="6">\u5C55\u5F00\u5168\u90E8 ' + analyses.length + ' \u6761 \u25BE</td>'
                + "</tr>";
        }
        return rows;
    }

    // ── 曲折分析 ──────────────────────────────────────
    _getAnalyses() {
        var templates = this.query.getAllTemplates();
        var results = [];
        var knownGenders = { "masc": 1, "fem": 1, "nt": 1, "neut": 1 };

        for (var hi = 0; hi < this.headwords.length; hi++) {
            var hw = this.headwords[hi];
            if (!hw.stem || !hw.pattern) continue;

            var tmpl = this._resolveTemplate(hw.pattern, templates);
            if (!tmpl || !tmpl.data) continue;

            var tableData = JSON.parse(tmpl.data);
            var stem = hw.stem.replace(/[!*]/g, "");
            var colHeaders = tableData[0] || [];
            var matched = false;

            for (var rowIdx = 1; rowIdx < tableData.length; rowIdx++) {
                var row = tableData[rowIdx];
                var caseLabel = row[0]?.[0] || "";

                for (var colIdx = 1; colIdx < row.length; colIdx += 2) {
                    var suffixes = row[colIdx];
                    if (!Array.isArray(suffixes)) continue;

                    var colHeader = colHeaders[colIdx]?.[0] || "";
                    var parts = colHeader.trim().split(/\s+/);

                    // 列头解析: 如果是已知性别 → {gender, number}，否则整个是 number
                    var gender = "";
                    var number = "";
                    if (parts.length >= 2 && knownGenders[parts[0]]) {
                        gender = parts[0];
                        number = parts.slice(1).join(" ");
                    } else {
                        number = colHeader.trim();
                    }

                    for (var si = 0; si < suffixes.length; si++) {
                        if (stem + suffixes[si] === this.word) {
                            results.push({
                                pos: hw.pos,
                                gender: gender,
                                case: caseLabel,
                                number: number,
                                lemma: hw.lemma_1,
                            });
                            matched = true;
                        }
                    }
                }
            }

            if (!matched) {
                results.push({
                    pos: hw.pos,
                    gender: this._deriveGender(hw.pattern),
                    case: "\u2014",
                    number: "\u2014",
                    lemma: hw.lemma_1,
                });
            }
        }

        return results;
    }

    _resolveTemplate(pattern, templates) {
        var tmpl = templates.get(pattern);
        if (!tmpl) return null;
        var depth = 0;
        while (tmpl.like && tmpl.like.indexOf("irreg") !== 0 && depth < 5) {
            var next = templates.get(tmpl.like);
            if (!next || next === tmpl) break;
            if (next.data) return next;
            tmpl = next;
            depth++;
        }
        return tmpl;
    }

    _deriveGender(pattern) {
        if (/\bmasc\b/.test(pattern)) return "masc";
        if (/\bfem\b/.test(pattern)) return "fem";
        if (/\bnt\b/.test(pattern)) return "nt";
        return "";
    }

    // ── 交互 ──────────────────────────────────────────
    _bindSort() {
        var table = this._el.querySelector("#dpd-analysis-tbl");
        if (!table) return;
        var self = this;
        var headers = table.querySelectorAll("th[data-col]");
        for (var hi = 0; hi < headers.length; hi++) {
            headers[hi].addEventListener("click", function () {
                var col = parseInt(this.getAttribute("data-col"));
                if (self._sortCol === col) {
                    self._sortDir = -self._sortDir;
                } else {
                    self._sortCol = col;
                    self._sortDir = 1;
                }
                // col 5 = word, col 0 = pos, col 1 = gender, col 2 = case, col 3 = number
                var colMap = { 0: "pos", 1: "gender", 2: "case", 3: "number", 5: "lemma" };
                var key = colMap[col] || "pos";
                self._analyses.sort(function (a, b) {
                    var va = (a[key] || "").toLowerCase();
                    var vb = (b[key] || "").toLowerCase();
                    if (va < vb) return -self._sortDir;
                    if (va > vb) return self._sortDir;
                    return 0;
                });
                var maxRows = parseInt(GM_getValue("dpd_max_rows", 5), 10) || 5;
                var tbody = table.querySelector("#dpd-analysis-body");
                tbody.innerHTML = self._renderAllRows(self._analyses, maxRows);
                // 排序后复位为限制视图
                if (self._analyses.length > maxRows) {
                    table.classList.add("dpd-limited");
                } else {
                    table.classList.remove("dpd-limited");
                }
                self._bindExpand(table);
                self._updateSortIcons(table, col);
            });
        }
    }

    _updateSortIcons(table, activeCol) {
        var icons = table.querySelectorAll(".dpd-sort");
        for (var i = 0; i < icons.length; i++) {
            var th = icons[i].parentNode;
            var col = parseInt(th.getAttribute("data-col"));
            if (col === activeCol) {
                icons[i].textContent = this._sortDir === 1 ? "\u25B2" : "\u25BC";
            } else {
                icons[i].textContent = "\u21C5";
            }
        }
    }

    _bindExpand(table) {
        var xrow = table && table.querySelector("tr.dpd-x");
        if (xrow) {
            var count = parseInt(xrow.getAttribute("data-n") || "0", 10);
            xrow.addEventListener("click", function () {
                var isLimited = table.classList.toggle("dpd-limited");
                var td = this.querySelector("td");
                if (isLimited) {
                    td.textContent = "\u5C55\u5F00\u5168\u90E8 " + count + " \u6761 \u25BE";
                } else {
                    td.textContent = "\u6536\u8D77 \u25B4";
                }
            });
        }
    }

    _bindEntryToggles() {
        var headers = this._el.querySelectorAll(".dpd-entry-header");
        for (var hi = 0; hi < headers.length; hi++) {
            headers[hi].addEventListener("click", function () {
                var body = this.nextElementSibling;
                var toggle = this.querySelector(".dpd-entry-toggle");
                var isHidden = body.style.display === "none";
                body.style.display = isHidden ? "block" : "none";
                toggle.textContent = isHidden ? "\u25BC" : "\u25B6";
            });
        }
    }

    _promptHTML() {
        var first = this.headwords[0];
        var label = this._e(this._cleanLemma(first.lemma_1));
        if (this.headwords.length > 1) {
            label += " +" + (this.headwords.length - 1);
        }
        return '<div class="dpd-prompt">'
            + '<span class="dpd-prompt-icon">\u25B6</span>'
            + '<span>DPD \u67E5\u8BE2\u7ED3\u679C\uFF1A</span>'
            + '<span class="dpd-prompt-word">' + label + '</span>'
            + '<span class="dpd-prompt-hint">\u70B9\u51FB\u67E5\u770B</span>'
            + "</div>";
    }

    injectBefore(referenceEl) {
        this._el = document.createElement("div");
        this._el.className = "dpd-wrap";
        if (this._autoShow) {
            this._el.innerHTML = this._buildHTML() + this._styleHTML();
            referenceEl.parentNode.insertBefore(this._el, referenceEl);
            this._bindEntryToggles();
            this._bindSort();
            this._bindExpand(this._el.querySelector("#dpd-analysis-tbl"));
        } else {
            this._el.innerHTML = this._promptHTML() + this._styleHTML();
            referenceEl.parentNode.insertBefore(this._el, referenceEl);
            var self = this;
            this._el.querySelector(".dpd-prompt").addEventListener("click", function () {
                if (self._fullRendered) return;
                self._fullRendered = true;
                self._el.innerHTML = self._buildHTML() + self._styleHTML();
                self._bindEntryToggles();
                self._bindSort();
                self._bindExpand(self._el.querySelector("#dpd-analysis-tbl"));
            });
        }
    }

    // ── 样式 ──────────────────────────────────────────
    _styleHTML() {
        return "<style>"
            + ".dpd-wrap{"
            + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
            + "margin:8px 0;padding:4px 0;border-top:1px solid #dce0e5;"
            + "}"
            /* 分析表 */
            + ".dpd-analysis-wrap{overflow-x:auto;margin:6px 0 10px;}"
            + ".dpd-analysis{border-collapse:collapse;width:100%;font-size:12px;background:#f8fafc;}"
            + ".dpd-analysis th,.dpd-analysis td{"
            + "border:1px solid #d4dae5;padding:3px 10px;text-align:center;white-space:nowrap;"
            + "}"
            + ".dpd-analysis th{background:#e2e8f0;color:#334155;font-weight:600;cursor:pointer;user-select:none;}"
            + ".dpd-analysis th:hover{background:#cbd5e1;}"
            + ".dpd-analysis td{color:#475569;}"
            + ".dpd-of{width:20px;min-width:20px;max-width:20px;border-left:none;border-right:none;}"
            + ".dpd-analysis tr:hover td{background:#eef2f6;}"
            + ".dpd-limited tr.dpd-h{display:none;}"
            + ".dpd-limited tr.dpd-x td{"
            + "text-align:center;cursor:pointer;color:#8b4513;font-weight:600;font-size:12px;"
            + "background:#fefcf9;padding:6px 10px;"
            + "}"
            + ".dpd-limited tr.dpd-x td:hover{background:#f8efe4;}"
            + ".dpd-limited tr.dpd-x td:after{"
            + "content:'';display:block;height:1px;margin:0 20px;"
            + "}"
            + ".dpd-sort{font-size:10px;margin-left:2px;color:#64748b;}"
            /* 词条 */
            + ".dpd-entry{margin:3px 0;border-radius:4px;overflow:hidden;}"
            + ".dpd-entry-header{"
            + "display:flex;align-items:center;gap:8px;"
            + "padding:5px 8px;cursor:pointer;user-select:none;"
            + "border:1px solid #e8d5c0;border-radius:4px;"
            + "background:#fdf8f2;font-size:13px;"
            + "}"
            + ".dpd-entry-header:hover{background:#f8efe4;}"
            + ".dpd-entry-lemma{font-weight:600;color:#8b4513;font-size:14px;}"
            + ".dpd-entry-num{color:#b8936e;font-size:11px;font-weight:400;margin-left:2px;}"
            + ".dpd-entry-pos{color:#888;font-style:italic;font-size:11px;}"
            + ".dpd-entry-meaning{"
            + "color:#555;font-size:12px;flex:1;overflow:hidden;"
            + "text-overflow:ellipsis;white-space:nowrap;"
            + "}"
            + ".dpd-entry-toggle{color:#8b4513;font-size:11px;}"
            + ".dpd-entry-body{padding:0;"
            + "border:1px solid #e8d5c0;border-top:none;border-radius:0 0 4px 4px;"
            + "background:#fffcf8;"
            + "}"
            /* 词条信息块 — 统一样式 */
            + ".dpd-info-block{padding-left:10px;margin:2px 0 6px;font-size:12px;line-height:1.7;}"
            + ".dpd-line{padding-left:10px;font-size:13px;color:#333;line-height:1.7;}"
            + ".dpd-info{display:flex;gap:6px;font-size:12px;line-height:1.7;}"
            + ".dpd-info-label{color:#7f8c8d;min-width:80px;flex-shrink:0;font-weight:500;}"
            + ".dpd-root{font-weight:600;color:#2d5a27;}"
            + ".dpd-decon{padding:5px 8px;margin:6px 0;background:#f0f7ee;border-radius:4px;font-size:12px;color:#333;}"
            + ".dpd-decomp{font-weight:600;color:#2d5a27;}"
            + ".dpd-compound{padding:6px 10px;margin:6px 0;background:#eef6ff;border:1px solid #bdd7f5;border-radius:4px;font-size:13px;font-weight:600;color:#1a4a7a;text-align:center;}"
            + ".dpd-grammar{padding:4px 8px;margin:4px 0;font-size:12px;color:#555;}"
            + ".dpd-table-scroll{overflow-x:auto;margin:0px 0;}"
            + ".dpd-inflection-table{border-collapse:collapse;font-size:12px;}"
            + ".dpd-inflection-table th,.dpd-inflection-table td{"
            + "border:1px solid #d4a574;padding:2px 6px;text-align:center;white-space:nowrap;"
            + "}"
            + ".dpd-inflection-table th{background:#f5e6d3;font-weight:600;color:#5c3a1e;}"
            + ".dpd-case-label{width:50px;}"
            + ".dpd-empty{border:none!important;background:transparent!important;}"
            + ".dpd-hl{background:#fde68a;color:#92400e;font-weight:600;border-radius:2px;padding:0 2px;}"
            + ".dpd-prompt{"
            + "display:flex;align-items:center;gap:8px;padding:8px 12px;margin:4px 0;"
            + "border:1px solid #d4a574;border-radius:6px;background:#fef9f0;"
            + "cursor:pointer;user-select:none;font-size:13px;"
            + "}"
            + ".dpd-prompt:hover{background:#fdf3e6;}"
            + ".dpd-prompt-icon{color:#8b4513;font-size:11px;}"
            + ".dpd-prompt-word{font-weight:600;color:#8b4513;flex:1;}"
            + ".dpd-prompt-hint{color:#b8936e;font-size:12px;}"
            + "</style>";
    }

    _e(str) {
        var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return String(str).replace(/[&<>"']/g, function (ch) { return map[ch]; });
    }

    _truncate(str, max) {
        if (!str) return "";
        if (str.length <= max) return str;
        return str.slice(0, max) + "\u2026";
    }
}
