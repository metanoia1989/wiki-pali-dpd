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
        const stmt = this._prepare(
            "getHeadword",
            `SELECT id, lemma_1, pos, stem, pattern, meaning_1, meaning_lit, inflections
             FROM headwords WHERE id = ?`
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
