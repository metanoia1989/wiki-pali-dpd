/**
 * SQL query API wrapping sql.js.
 */
export class Query {
    constructor(dbBuffer, SQL) {
        this.ready = this._init(dbBuffer, SQL);
    }

    async _init(dbBuffer, SQL) {
        this.db = new SQL.Database(new Uint8Array(dbBuffer));
        this._stmtCache = {};
    }

    /**
     * Look up a word in the lookup table.
     * @param {string} word - The word to query.
     * @returns {object|null} Row with {lookup_key, headwords, deconstructor, grammar, spelling, see}
     */
    lookupWord(word) {
        if (!this.db) return null;
        const stmt = this._prepare(
            "lookupWord",
            `SELECT lookup_key, headwords, deconstructor, grammar, spelling, see
             FROM lookup WHERE lookup_key = ?`
        );
        stmt.bind([word]);
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.reset();
            return row;
        }
        stmt.reset();
        return null;
    }

    /**
     * Get headword info by id.
     * @param {number} id - headword ID.
     * @returns {object|null}
     */
    getHeadword(id) {
        if (!this.db) return null;
        var stmt = this._prepare(
            "getHeadword",
            "SELECT id, lemma_1, pos, stem, pattern, meaning_1, meaning_lit,"
            + " phonetic, grammar, construction, root_key, family_root"
            + " FROM headwords WHERE id = ?"
        );
        stmt.bind([id]);
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.reset();
            return row;
        }
        stmt.reset();
        return null;
    }

    /**
     * Get multiple headwords by ids. Preserves order of input ids.
     * @param {number[]} ids - Array of headword IDs.
     * @returns {object[]}
     */
    getHeadwords(ids) {
        if (!this.db || !ids || !ids.length) return [];
        // 不缓存 stmt，因为 ? 数量每次可能不同
        var stmt = this.db.prepare(
            "SELECT id, lemma_1, pos, stem, pattern, meaning_1, meaning_lit,"
            + " phonetic, grammar, construction, root_key, family_root"
            + " FROM headwords WHERE id IN (" + ids.map(function () { return "?"; }).join(",") + ")"
        );
        stmt.bind(ids);
        var map = {};
        while (stmt.step()) {
            var row = stmt.getAsObject();
            map[row.id] = row;
        }
        stmt.free();
        return ids.filter(function (id) { return map[id]; }).map(function (id) { return map[id]; });
    }

    /**
     * Fallback: search the headwords.inflections CSV column.
     * Covers inflected forms that dpd-db didn't write into the lookup table
     * (e.g. forms not attested in the Tipitaka corpus like sādhunā).
     *
     * @param {string} word - Normalized word to search for.
     * @returns {object|null} Fake lookup row with {headwords}, or null.
     */
    searchInflections(word) {
        if (!this.db) return null;
        try {
            const stmt = this._prepare(
                "searchInflections",
                `SELECT id FROM headwords
                 WHERE inflections IS NOT NULL
                   AND ',' || inflections || ',' LIKE ?`
            );
            const pattern = "%," + word + ",%";
            stmt.bind([pattern]);
            const ids = [];
            while (stmt.step()) {
                ids.push(stmt.getAsObject().id);
            }
            stmt.reset();
            if (ids.length === 0) return null;
            return { headwords: JSON.stringify(ids) };
        } catch (e) {
            // inflections 列不存在（旧版 DB）→ 静默降级
            return null;
        }
    }

    /**
     * Get inflection template by pattern name.
     * @param {string} pattern - Template name, e.g. "masc__a".
     * @returns {object|null} {pattern, like, data}
     */
    getTemplate(pattern) {
        if (!this.db) return null;
        const stmt = this._prepare(
            "getTemplate",
            `SELECT pattern, like, data FROM inflection_templates WHERE pattern = ?`
        );
        stmt.bind([pattern]);
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.reset();
            return row;
        }
        stmt.reset();
        return null;
    }

    /**
     * Get all templates as a Map for fast lookup.
     * @returns {Map<string, object>}
     */
    getAllTemplates() {
        if (!this.db) return new Map();
        const stmt = this._prepare(
            "getAllTemplates",
            `SELECT pattern, like, data FROM inflection_templates`
        );
        const map = new Map();
        while (stmt.step()) {
            const row = stmt.getAsObject();
            map.set(row.pattern, row);
        }
        stmt.reset();
        return map;
    }

    /**
     * Look up root info.
     * @param {string} root
     * @returns {object|null}
     */
    getRoot(root) {
        if (!this.db) return null;
        const stmt = this._prepare(
            "getRoot",
            `SELECT root, root_meaning FROM roots WHERE root = ?`
        );
        stmt.bind([root]);
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.reset();
            return row;
        }
        stmt.reset();
        return null;
    }

    _prepare(key, sql) {
        if (!this._stmtCache[key]) {
            this._stmtCache[key] = this.db.prepare(sql);
        }
        return this._stmtCache[key];
    }
}

/**
 * 快捷查词：从 lookup 表查询，未命中则走 inflections CSV 兜底。
 * 返回 { headwords, lookupRow, deconstruction } 或 null。
 * 供 Injector 和 QuickLookup 复用。
 */
export function lookupHeadwords(query, word) {
    var lookupRow = query.lookupWord(word);
    if (!lookupRow || !lookupRow.headwords) {
        lookupRow = query.searchInflections(word);
        if (!lookupRow) return null;
    }

    var headwordIds;
    try { headwordIds = JSON.parse(lookupRow.headwords); } catch (e) { return null; }
    if (!headwordIds || headwordIds.length === 0) return null;

    var headwords = query.getHeadwords(headwordIds);
    if (!headwords || headwords.length === 0) return null;

    var deconstruction = null;
    if (lookupRow.deconstructor) {
        try { deconstruction = JSON.parse(lookupRow.deconstructor); } catch (e) { /* ignore */ }
    }

    return { headwords: headwords, lookupRow: lookupRow, deconstruction: deconstruction };
}
