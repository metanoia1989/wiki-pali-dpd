#!/usr/bin/env python3
"""
从 dpd.db 导出浏览器查询用的精简版 dpd-web.db。

Usage:
    python scripts/export/web_db.py

Requires:
    - dpd.db 在项目根目录存在
    - sqlite3 (stdlib)

Output:
    exporter/share/dpd-web.db.gz
"""

import gzip
import sqlite3
import sys
from pathlib import Path

# ── paths ────────────────────────────────────────────────────────────────
PROJECT_DIR = Path(__file__).resolve().parents[2]
SRC_DB = PROJECT_DIR / "dpd.db"
OUT_DIR = PROJECT_DIR / "exporter" / "share"
OUT_DB = OUT_DIR / "dpd-web.db"
OUT_GZ = OUT_DIR / "dpd-web.db.gz"

# ── schema ───────────────────────────────────────────────────────────────
SCHEMA_SQL = """
CREATE TABLE lookup (
    lookup_key      TEXT PRIMARY KEY,
    headwords       TEXT,
    deconstructor   TEXT,
    grammar         TEXT,
    spelling        TEXT,
    see             TEXT
);

CREATE TABLE headwords (
    id              INTEGER PRIMARY KEY,
    lemma_1         TEXT,
    pos             TEXT,
    stem            TEXT,
    pattern         TEXT,
    meaning_1       TEXT,
    meaning_lit     TEXT
);

CREATE TABLE inflection_templates (
    pattern         TEXT PRIMARY KEY,
    like            TEXT,
    data            TEXT
);

CREATE TABLE roots (
    root            TEXT PRIMARY KEY,
    root_meaning    TEXT
);
"""

INDEX_SQL = """
CREATE INDEX idx_headwords_lemma_1 ON headwords(lemma_1);
CREATE INDEX idx_headwords_pos ON headwords(pos);
CREATE INDEX idx_headwords_pattern ON headwords(pattern);
CREATE INDEX idx_lookup_headwords ON lookup(headwords);
"""


def main():
    if not SRC_DB.exists():
        print(f"Error: {SRC_DB} not found.", file=sys.stderr)
        print("Run this script from the dpd-db project root or symlink dpd.db here.", file=sys.stderr)
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    src_size = SRC_DB.stat().st_size / (1024 * 1024)
    print(f"Source: {SRC_DB} ({src_size:.1f} MB)")

    # -- build dest database --
    if OUT_DB.exists():
        OUT_DB.unlink()

    dst = sqlite3.connect(str(OUT_DB))
    dst.executescript(SCHEMA_SQL)
    dst.commit()

    # -- connect source (separate connection, read-only) --
    src = sqlite3.connect(str(SRC_DB))
    src.execute("PRAGMA query_only = ON;")
    src.row_factory = sqlite3.Row

    # -- check which source tables exist (full pipeline may not have run) --
    existing_tables = {
        row["name"]
        for row in src.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }

    # -- count rows --
    for tbl in ["lookup", "dpd_headwords", "inflection_templates", "dpd_roots"]:
        if tbl in existing_tables:
            cnt = src.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
            print(f"  {tbl}: {cnt:,} rows")
        else:
            print(f"  {tbl}: table not found")

    # -- import data (use src connection to read, dst to write) --

    IMPORT_TABLES = [
        ("lookup",               "lookup_key, headwords, deconstructor, grammar, spelling, see"),
        ("dpd_headwords",        "headwords", "id, lemma_1, pos, stem, pattern, meaning_1, meaning_lit"),
        ("inflection_templates", "pattern, like, data"),
        ("dpd_roots",            "roots", "root, root_meaning"),
    ]
    for entry in IMPORT_TABLES:
        src_tbl = entry[0]
        if src_tbl not in existing_tables:
            print(f"  -> {entry[1] if len(entry) == 3 else src_tbl}: table not found in source, skipped")
            continue
        dst_tbl = entry[1] if len(entry) == 3 else src_tbl
        cols = entry[2] if len(entry) == 3 else entry[1]
        rows = list(src.execute(f"SELECT {cols} FROM {src_tbl}"))
        if rows:
            placeholders = ", ".join("?" * len(rows[0]))
            dst.executemany(
                f"INSERT INTO {dst_tbl} ({cols}) VALUES ({placeholders})",
                (tuple(r) for r in rows),
            )
        print(f"  -> {dst_tbl}: {len(rows):,} rows written")
    dst.commit()

    # -- indexes + vacuum --
    dst.executescript(INDEX_SQL)
    dst.commit()
    dst.execute("VACUUM;")
    dst.commit()
    dst.close()
    src.close()

    out_size = OUT_DB.stat().st_size / (1024 * 1024)
    print(f"\nUncompressed: {OUT_DB} ({out_size:.1f} MB)")

    # -- gzip --
    with open(OUT_DB, "rb") as f_in, gzip.open(OUT_GZ, "wb", compresslevel=9) as f_out:
        f_out.writelines(f_in)

    gz_size = OUT_GZ.stat().st_size / (1024 * 1024)
    ratio = gz_size / out_size * 100 if out_size else 0
    print(f"Compressed:   {OUT_GZ} ({gz_size:.1f} MB, {ratio:.0f}% of original)")

    # -- cleanup temp --
    OUT_DB.unlink()
    print(f"\nDone. Output: {OUT_GZ}")


if __name__ == "__main__":
    main()
