// Oak 2.0 migration 0012 (docs/oak2/PLAN.md §4–§6; wave plan W0 Task 1, Review Focus 5): new tables and ADD COLUMN
// only. A 1.4.0 database (0001–0011 with a learner's sketch, version and album track) keeps every row; the new
// tables and columns exist with their defaults; a backup export → import keeps the new rows, and a backup made by
// 1.4.0 (schema 11) imports into 2.0 with its rows and the new columns' defaults.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readZip, writeZip } from "../lib/zip.ts";
import { type Harness, harness } from "../testing/harness.ts";
import { all, type Db, openDb, schemaVersion, tableNames } from "./index.ts";
import { latestVersion, loadMigrations, migrate } from "./migrate.ts";

type Col = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number };
const cols = (db: Db, t: string) => all<Col>(db, `PRAGMA table_info("${t}")`);
const names = (db: Db, t: string) => cols(db, t).map((c) => c.name);
const count = (db: Db, t: string) => all<{ n: number }>(db, `SELECT COUNT(*) AS n FROM "${t}"`)[0]?.n;

/** The tables 0012 creates, with their columns in order (binding names for W1–W4). */
const NEW_TABLES: Record<string, string[]> = {
  scraps: [
    "id",
    "role",
    "label",
    "code",
    "bpm",
    "meter",
    "key_json",
    "source_kind",
    "source_ref",
    "created_at",
    "review_before_run",
  ],
  user_templates: [
    "id",
    "name",
    "code",
    "bpm",
    "meter",
    "is_blank",
    "created_at",
    "updated_at",
    "review_before_run",
  ],
  capstone_check_history: ["id", "capstone_id", "session_id", "sketch_id", "sketch_version", "passed", "at"],
  later_items: ["id", "text", "source", "created_at", "done_at"],
  catalogs: ["id", "ref_kind", "ref_id", "lines_json", "sketch_id", "created_at"],
};
/** The columns 0012 adds to existing tables. */
const NEW_COLUMNS: Record<string, string[]> = {
  sketch_versions: ["take_state", "parent_version", "generation", "dimension"],
  sketches: ["committed_json", "cards_json"],
  album_tracks: ["shelved"],
};

/** A database as Oak 1.4.0 left it: migrations 0001–0011, one sketch with one version, one album track. */
function db140(): Db {
  const db = openDb(":memory:", { migrate: false });
  migrate(db, loadMigrations().slice(0, 11));
  db.run(
    "INSERT INTO sketches (id, title, origin_kind, origin_id, created_at, updated_at) VALUES ('sk_1', 'Groove', 'free', NULL, 't', 't')",
  );
  db.run(
    `INSERT INTO sketch_versions (sketch_id, version, code, bpm, created_at) VALUES ('sk_1', 1, 'drums: s("bd sd")', 96, 't')`,
  );
  db.run(
    "INSERT INTO album_tracks (id, side, track_no, title, cover_seed, sketch_id, created_at) VALUES ('trk_1', 'Bside', 1, 'Groove', 'c', 'sk_1', 't')",
  );
  db.run(
    "INSERT INTO album_track_versions (track_id, version, sketch_id, sketch_version, created_at) VALUES ('trk_1', 1, 'sk_1', 1, 't')",
  );
  return db;
}

describe("migration 0012 (Oak 2.0)", () => {
  test("a fresh database is at schema 12 with every new table and column", () => {
    const db = openDb(":memory:");
    expect(latestVersion()).toBe(12);
    expect(schemaVersion(db)).toBe(12);
    const tables = tableNames(db);
    for (const [t, expected] of Object.entries(NEW_TABLES)) {
      expect([t, tables.includes(t)]).toEqual([t, true]);
      expect([t, names(db, t)]).toEqual([t, expected]);
    }
    for (const [t, added] of Object.entries(NEW_COLUMNS))
      expect([t, names(db, t)]).toEqual([t, expect.arrayContaining(added)]);
  });

  test("defaults and checks: flags start at 0 and only take 0 or 1; status-like text has no CHECK", () => {
    const db = openDb(":memory:");
    db.run(
      `INSERT INTO scraps (id, code, source_kind, created_at) VALUES ('scr_1', 'bass: note("c2")', 'lesson', 't')`,
    );
    expect(
      all(db, "SELECT role, label, bpm, meter, key_json, source_ref, review_before_run FROM scraps"),
    ).toEqual([
      {
        role: null,
        label: null,
        bpm: null,
        meter: null,
        key_json: null,
        source_ref: null,
        review_before_run: 0,
      },
    ]);
    // code and source_kind are required.
    expect(() =>
      db.run("INSERT INTO scraps (id, source_kind, created_at) VALUES ('scr_2', 'lesson', 't')"),
    ).toThrow();
    expect(() => db.run("INSERT INTO scraps (id, code, created_at) VALUES ('scr_3', 'x', 't')")).toThrow();

    db.run(
      "INSERT INTO user_templates (id, name, code, created_at, updated_at) VALUES ('tpl_1', 'My Blank', 'setcpm(90/4)', 't', 't')",
    );
    expect(all(db, "SELECT is_blank, review_before_run FROM user_templates")).toEqual([
      { is_blank: 0, review_before_run: 0 },
    ]);
    expect(() =>
      db.run(
        "INSERT INTO user_templates (id, name, code, is_blank, created_at, updated_at) VALUES ('tpl_2', 'x', 'x', 2, 't', 't')",
      ),
    ).toThrow();

    db.run(
      "INSERT INTO capstone_check_history (capstone_id, session_id, sketch_id, sketch_version, passed, at) VALUES ('C3', NULL, 'sk_1', 1, 1, 't')",
    );
    expect(all(db, "SELECT id FROM capstone_check_history")).toEqual([{ id: 1 }]);
    expect(() =>
      db.run(
        "INSERT INTO capstone_check_history (capstone_id, sketch_id, sketch_version, passed, at) VALUES ('C3', 'sk_1', 1, 3, 't')",
      ),
    ).toThrow();

    db.run("INSERT INTO later_items (id, text, created_at) VALUES ('lat_1', 'modes of melodic minor', 't')");
    expect(all(db, "SELECT source, done_at FROM later_items")).toEqual([{ source: null, done_at: null }]);

    db.run(
      `INSERT INTO catalogs (id, ref_kind, ref_id, lines_json, created_at) VALUES ('cat_1', 'song', 'U05', '{}', 't')`,
    );
    expect(all(db, "SELECT sketch_id FROM catalogs")).toEqual([{ sketch_id: null }]);
    expect(() =>
      db.run("INSERT INTO catalogs (id, ref_kind, ref_id, created_at) VALUES ('cat_2', 'song', 'U05', 't')"),
    ).toThrow();

    // Status-like text takes any value: the services validate it, so a later wave never rebuilds the table.
    db.run(
      "INSERT INTO sketches (id, title, origin_kind, origin_id, created_at, updated_at) VALUES ('sk_1', 'x', 'free', NULL, 't', 't')",
    );
    db.run(
      "INSERT INTO sketch_versions (sketch_id, version, code, created_at, take_state, dimension) VALUES ('sk_1', 1, 'x', 't', 'some-later-state', 'some-later-dimension')",
    );
    db.run(
      "INSERT INTO album_tracks (id, side, track_no, title, cover_seed, created_at) VALUES ('trk_1', 'Bside', 1, 'B', 'c', 't')",
    );
    expect(all(db, "SELECT shelved FROM album_tracks")).toEqual([{ shelved: 0 }]);
    expect(() => db.run("UPDATE album_tracks SET shelved = 2")).toThrow();
  });

  test("a 1.4.0 database migrates once, keeps every row, and its rows gain the defaults", () => {
    const db = db140();
    expect(schemaVersion(db)).toBe(11);
    const before = Object.fromEntries(
      ["sketches", "sketch_versions", "album_tracks", "album_track_versions"].map((t) => [t, count(db, t)]),
    );
    expect(migrate(db)).toEqual([12]);
    // The migrator is idempotent: a second start applies nothing.
    expect(migrate(db)).toEqual([]);
    expect(schemaVersion(db)).toBe(12);
    for (const [t, n] of Object.entries(before)) expect([t, count(db, t)]).toEqual([t, n]);
    expect(before.sketches).toBe(1);
    expect(all(db, "SELECT take_state, parent_version, generation, dimension FROM sketch_versions")).toEqual([
      { take_state: null, parent_version: null, generation: null, dimension: null },
    ]);
    expect(all(db, "SELECT committed_json, cards_json FROM sketches")).toEqual([
      { committed_json: null, cards_json: null },
    ]);
    expect(all(db, "SELECT shelved FROM album_tracks")).toEqual([{ shelved: 0 }]);
    for (const t of Object.keys(NEW_TABLES)) expect([t, count(db, t)]).toEqual([t, 0]);
    expect(all(db, "PRAGMA foreign_key_check")).toEqual([]);
  });

  test("0012 rebuilds nothing: the 1.4.0 tables keep their columns in order, new ones appended", () => {
    const old = db140();
    const kept = ["sketches", "sketch_versions", "album_tracks", "album_track_versions", "sessions"];
    const before = Object.fromEntries(kept.map((t) => [t, names(old, t)]));
    migrate(old);
    for (const t of kept)
      expect([t, names(old, t)]).toEqual([t, [...(before[t] as string[]), ...(NEW_COLUMNS[t] ?? [])]]);
  });
});

describe("backup with the Oak 2.0 tables", () => {
  let a: Harness;
  let b: Harness;
  beforeEach(async () => {
    a = await harness();
    b = await harness();
  });
  afterEach(async () => {
    await a.close();
    await b.close();
  });

  const scrap = {
    id: "scr_1",
    role: "bass",
    label: "bass",
    code: 'bass: note("c2 ~ g1 ~").s("ebass")',
    bpm: 96,
    meter: "4/4",
    key_json: '{"tonic":"C","mode":"minor"}',
    source_kind: "lesson",
    source_ref: "U03.L02/S4",
    created_at: "2026-11-24T10:00:00.000Z",
  };
  const template = {
    id: "tpl_1",
    name: "My Blank",
    code: 'drums: s("~").bank("oak909")',
    bpm: 84,
    meter: "4/4",
    is_blank: 1,
    created_at: "2026-11-24T10:00:00.000Z",
    updated_at: "2026-11-24T10:00:00.000Z",
  };
  const seed2 = (db: Db): void => {
    db.query(
      `INSERT INTO scraps (id, role, label, code, bpm, meter, key_json, source_kind, source_ref, created_at)
       VALUES ($id, $role, $label, $code, $bpm, $meter, $key_json, $source_kind, $source_ref, $created_at)`,
    ).run(scrap);
    db.query(
      `INSERT INTO user_templates (id, name, code, bpm, meter, is_blank, created_at, updated_at)
       VALUES ($id, $name, $code, $bpm, $meter, $is_blank, $created_at, $updated_at)`,
    ).run(template);
    db.run(
      "INSERT INTO later_items (id, text, source, created_at) VALUES ('lat_1', 'what a tritone sub is', 'tutor', 't')",
    );
    db.run(
      `INSERT INTO catalogs (id, ref_kind, ref_id, lines_json, created_at) VALUES ('cat_1', 'song', 'U05', '{"tempo":"slow"}', 't')`,
    );
    db.run(
      "INSERT INTO capstone_check_history (capstone_id, sketch_id, sketch_version, passed, at) VALUES ('C3', 'sk_x', 2, 0, 't')",
    );
  };

  async function exportOf(h: Harness): Promise<Uint8Array> {
    const res = await h.req("GET", "/api/backup/export?audio=0");
    expect(res.status).toBe(200);
    return new Uint8Array(await res.arrayBuffer());
  }

  test("export → import keeps scraps and templates; their code is marked for review", async () => {
    seed2(a.server.deps.db);
    const imported = await b.destructive(
      "POST",
      "/api/backup/import",
      "backup.import",
      "*",
      await exportOf(a),
    );
    expect(imported.status).toBe(200);
    const db = b.server.deps.db;
    expect(all(db, "SELECT * FROM scraps")).toEqual([{ ...scrap, review_before_run: 1 }]);
    expect(all(db, "SELECT * FROM user_templates")).toEqual([{ ...template, review_before_run: 1 }]);
    expect(count(db, "later_items")).toBe(1);
    expect(count(db, "catalogs")).toBe(1);
    expect(count(db, "capstone_check_history")).toBe(1);
  });

  test("a backup made by 1.4.0 (schema 11) imports forward with its rows and the new defaults", async () => {
    // A sketch, a version and a B-side through the API, then the archive rewritten as 1.4.0 would have written it.
    const sk = await a.json<{ sketch: { id: string } }>("POST", "/api/sketches", {
      title: "Groove",
      originKind: "free",
      originId: null,
      sessionId: null,
      code: 'drums: s("bd ~ sd ~")',
      bpm: 96,
      meter: "4/4",
      key: null,
      analysis: null,
      note: null,
      tutorAssisted: false,
      band: null,
      flags: { lockedTools: [], previewTools: [] },
      ranOk: true,
    });
    expect(sk.status).toBe(200);
    const files = readZip(await exportOf(a));
    const manifest = JSON.parse(new TextDecoder().decode(files.get("backup.json"))) as {
      schemaVersion: number;
      tables: Record<string, Record<string, unknown>[]>;
    };
    manifest.schemaVersion = 11;
    for (const t of Object.keys(NEW_TABLES)) delete manifest.tables[t];
    for (const [t, added] of Object.entries(NEW_COLUMNS))
      for (const row of manifest.tables[t] ?? []) for (const c of added) delete row[c];
    const old = writeZip([{ name: "backup.json", data: new TextEncoder().encode(JSON.stringify(manifest)) }]);

    const imported = await b.destructive("POST", "/api/backup/import", "backup.import", "*", old);
    expect(imported.status).toBe(200);
    expect(((await imported.json()) as { migratedFrom: number | null }).migratedFrom).toBe(11);
    const db = b.server.deps.db;
    expect(schemaVersion(db)).toBe(12);
    for (const t of ["sketches", "sketch_versions"])
      expect([t, count(db, t)]).toEqual([t, (manifest.tables[t] ?? []).length]);
    expect(count(db, "sketches")).toBeGreaterThan(0);
    expect(all(db, "SELECT DISTINCT take_state, parent_version, generation FROM sketch_versions")).toEqual([
      { take_state: null, parent_version: null, generation: null },
    ]);
  });
});
