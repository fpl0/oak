// Backups (contracts §11.10): the daily automatic `VACUUM INTO`, `.oakbackup` export (backup.json plus
// the learner's audio and recorded album versions by default), import (validate → safety copy → one
// transaction replacing every table, append-only triggers dropped and recreated → audio written by
// hash → migrated forward when older), and the data reset. Secrets are never part of any of it.
import { Database } from "bun:sqlite";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { BACKUP_FORMAT_VERSION, type BackupManifest, BackupManifestSchema } from "@oak/api";
import { type Db, schemaVersion, tableNames, tightenMode } from "../db/index.ts";
import { latestVersion, loadMigrations, migrate, triggerDdl } from "../db/migrate.ts";
import { badRequest } from "../errors.ts";
import { readZip, writeZip, type ZipEntry, ZipError } from "../lib/zip.ts";
import { MAX_BINARY_BYTES } from "../routes/define.ts";
import { type AudioStore, sha256 } from "./audio-store.ts";

export const KEEP_DAILY = 14;
const MANIFEST = "backup.json";
/** The only file names an archive may carry besides backup.json (export writes, import accepts). */
const ARCHIVE_AUDIO_PATH =
  /^(audio\/[0-9a-f]{64}\.[a-z0-9]{2,5}|album\/[A-Za-z0-9_-]+\/v\d+(?:-t\d+)?\.[a-z0-9]{2,5})$/;

export interface BackupPaths {
  backupsDir: string;
  store: AudioStore;
}

function compact(day: string): string {
  return day.replaceAll("-", "");
}

/** `VACUUM INTO <backups>/oak-YYYYMMDD.db` on the first launch of a day; keeps the newest 14. Returns the path, or null when today's exists. */
export function dailyBackup(db: Db, backupsDir: string, day: string): string | null {
  mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
  const path = join(backupsDir, `oak-${compact(day)}.db`);
  if (existsSync(path)) return null;
  db.run("VACUUM INTO ?", [path]);
  tightenMode(path, 0o600);
  const daily = readdirSync(backupsDir)
    .filter((f) => /^oak-\d{8}\.db$/.test(f))
    .sort();
  for (const old of daily.slice(0, Math.max(0, daily.length - KEEP_DAILY)))
    rmSync(join(backupsDir, old), { force: true });
  return path;
}

export function lastAutomatic(backupsDir: string): string | null {
  if (!existsSync(backupsDir)) return null;
  const last = readdirSync(backupsDir)
    .filter((f) => /^oak-\d{8}\.db$/.test(f))
    .sort()
    .at(-1);
  if (last === undefined) return null;
  const d = last.slice(4, 12);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/** A copy of the current state before anything replaces it. */
export function safetyCopy(db: Db, backupsDir: string, label: string, now: Date): string {
  mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
  const stamp = now.toISOString().replaceAll(/[:.]/g, "-");
  // Two copies at one clock reading (a frozen dev clock, two quick resets) get distinct names.
  let path = join(backupsDir, `${label}-${stamp}.db`);
  for (let n = 2; existsSync(path); n++) path = join(backupsDir, `${label}-${stamp}-${n}.db`);
  db.run("VACUUM INTO ?", [path]);
  tightenMode(path, 0o600);
  return path;
}

function dumpTables(db: Db): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const t of tableNames(db))
    out[t] = db.query(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[];
  return out;
}

interface FileRef {
  /** Path inside the archive. */
  name: string;
  abs: string;
}

export class BackupService {
  constructor(
    private readonly db: Db,
    private readonly paths: BackupPaths,
    private readonly opts: { contentVersion: () => string | null; now: () => Date },
  ) {}

  #files(): FileRef[] {
    const out: FileRef[] = [];
    // A stored path that escapes the audio folders (an edited or hostile imported backup) is skipped,
    // never followed and never allowed to break the export.
    const resolve = (stored: string): string | null => {
      if (!ARCHIVE_AUDIO_PATH.test(stored)) return null;
      try {
        const abs = this.paths.store.resolveStored(stored);
        return this.paths.store.exists(abs) ? abs : null;
      } catch {
        return null;
      }
    };
    const audio = this.db.query("SELECT stored_path, peaks_path FROM audio_files ORDER BY id").all() as {
      stored_path: string;
      peaks_path: string | null;
    }[];
    for (const a of audio) {
      for (const p of [a.stored_path, a.peaks_path]) {
        if (p === null) continue;
        const abs = resolve(p);
        if (abs !== null) out.push({ name: p, abs });
      }
    }
    // Wave 6 (d20): every take of every version, not only the one that plays (nothing a learner recorded is lost
    // in a backup). A version's own `audio_path` is one of its takes; an older database has only that column.
    const album = this.db
      .query(
        `SELECT audio_path FROM album_takes
         UNION SELECT audio_path FROM album_track_versions WHERE audio_path IS NOT NULL
         ORDER BY audio_path`,
      )
      .all() as {
      audio_path: string;
    }[];
    for (const a of album) {
      const abs = resolve(a.audio_path);
      if (abs !== null) out.push({ name: a.audio_path, abs });
    }
    return out;
  }

  info(): {
    bytesWithAudio: number;
    bytesWithoutAudio: number;
    lastAutomatic: string | null;
    ownAudio: { files: number; bytes: number; unusedFiles: number; unusedBytes: number };
    albumAudioBytes: number;
    albumAudio: { trackId: string; version: number; bytes: number }[];
  } {
    const json = new TextEncoder().encode(JSON.stringify(dumpTables(this.db))).length + 512;
    const files = this.#files().reduce((s, f) => s + statSync(f.abs).size + 76 + 2 * f.name.length, 0);
    // Wave 4 (kit's Settings › Data): the learner's own recordings, and those no transcription project uses any more.
    const own = this.db
      .query(
        `SELECT a.bytes AS bytes, EXISTS (SELECT 1 FROM transcriptions t WHERE t.audio_id = a.id) AS used
         FROM audio_files a`,
      )
      .all() as { bytes: number; used: number }[];
    const album = this.db
      .query(
        `SELECT track_id, version, audio_path FROM album_takes
         UNION SELECT track_id, version, audio_path FROM album_track_versions WHERE audio_path IS NOT NULL
         ORDER BY track_id, version, audio_path`,
      )
      .all() as { track_id: string; version: number; audio_path: string }[];
    let albumAudioBytes = 0;
    // One line per version: the bytes of every take of it (d20).
    const albumAudio: { trackId: string; version: number; bytes: number }[] = [];
    for (const a of album) {
      try {
        const abs = this.paths.store.resolveStored(a.audio_path);
        if (!this.paths.store.exists(abs)) continue;
        const bytes = statSync(abs).size;
        albumAudioBytes += bytes;
        const line = albumAudio.find((x) => x.trackId === a.track_id && x.version === a.version);
        if (line === undefined) albumAudio.push({ trackId: a.track_id, version: a.version, bytes });
        else line.bytes += bytes;
      } catch {
        // A stored path outside the audio folders is never followed (as in the export).
      }
    }
    const unused = own.filter((a) => a.used === 0);
    return {
      bytesWithAudio: json + files,
      bytesWithoutAudio: json,
      lastAutomatic: lastAutomatic(this.paths.backupsDir),
      ownAudio: {
        files: own.length,
        bytes: own.reduce((s, a) => s + a.bytes, 0),
        unusedFiles: unused.length,
        unusedBytes: unused.reduce((s, a) => s + a.bytes, 0),
      },
      albumAudioBytes,
      albumAudio,
    };
  }

  export(withAudio: boolean): { bytes: Uint8Array; filename: string } {
    const files = withAudio ? this.#files() : [];
    const entries: ZipEntry[] = [];
    const listed: NonNullable<BackupManifest["files"]> = [];
    for (const f of files) {
      const data = new Uint8Array(readFileSync(f.abs));
      entries.push({ name: f.name, data });
      listed.push({ path: f.name, bytes: data.length, sha256: sha256(data) });
    }
    const now = this.opts.now();
    const manifest: BackupManifest = {
      format: "oak-backup",
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: schemaVersion(this.db),
      contentVersion: this.opts.contentVersion(),
      exportedAt: now.toISOString(),
      tables: dumpTables(this.db),
      ...(withAudio ? { files: listed } : {}),
    };
    entries.unshift({ name: MANIFEST, data: new TextEncoder().encode(JSON.stringify(manifest)) });
    return { bytes: writeZip(entries), filename: `oak-${now.toISOString().slice(0, 10)}.oakbackup` };
  }

  /** Rows of an older schema, migrated forward through a scratch database. */
  #forward(manifest: BackupManifest): Record<string, Record<string, unknown>[]> {
    const latest = latestVersion();
    if (manifest.schemaVersion === latest) return manifest.tables;
    const scratch = new Database(":memory:", { strict: true });
    try {
      const migrations = loadMigrations();
      migrate(scratch, migrations.slice(0, manifest.schemaVersion));
      this.#replaceAll(scratch, manifest.tables);
      migrate(scratch, migrations);
      return dumpTables(scratch);
    } finally {
      scratch.close();
    }
  }

  /** Deletes every row of every table and inserts `tables`, in one transaction, triggers dropped and recreated. */
  #replaceAll(db: Db, tables: Record<string, Record<string, unknown>[]>): { tables: number; rows: number } {
    const names = tableNames(db);
    const triggers = triggerDdl(db);
    let rows = 0;
    let count = 0;
    db.run("PRAGMA foreign_keys = OFF");
    try {
      db.transaction(() => {
        for (const t of triggers) db.run(`DROP TRIGGER IF EXISTS "${t.name}"`);
        for (const t of [...names].reverse()) db.run(`DELETE FROM "${t}"`);
        for (const t of names) {
          const list = tables[t];
          if (list === undefined) continue;
          count += 1;
          const cols = (db.query(`PRAGMA table_info("${t}")`).all() as { name: string }[]).map((c) => c.name);
          for (const row of list) {
            const keys = Object.keys(row).filter((k) => cols.includes(k));
            if (keys.length === 0) continue;
            const marks = keys.map(() => "?").join(", ");
            db.query(`INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${marks})`).run(
              ...keys.map((k) => normalizeValue(row[k])),
            );
            rows += 1;
          }
        }
        for (const t of triggers) db.run(t.sql);
        const fk = db.query("PRAGMA foreign_key_check").all();
        if (fk.length > 0) throw badRequest("the backup's rows do not fit together (foreign keys)");
      }).immediate();
    } finally {
      db.run("PRAGMA foreign_keys = ON");
    }
    return { tables: count, rows };
  }

  import(bytes: Uint8Array): {
    ok: true;
    tables: number;
    rows: number;
    audioFiles: number;
    orphanedFiles: number;
    migratedFrom: number | null;
    safetyCopy: string;
  } {
    let files: Map<string, Uint8Array>;
    try {
      // Stored entries: the archive is about the size of its content. Deflated ones may not inflate past
      // twice the upload limit in all.
      files = readZip(bytes, { maxEntries: 50_000, maxBytes: 2 * MAX_BINARY_BYTES });
    } catch (e) {
      throw badRequest(
        e instanceof ZipError ? `not a readable .oakbackup: ${e.message}` : "not a readable .oakbackup",
      );
    }
    const raw = files.get(MANIFEST);
    if (raw === undefined) throw badRequest("backup.json is missing");
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      throw badRequest("backup.json is not JSON");
    }
    const parsed = BackupManifestSchema.safeParse(json);
    if (!parsed.success)
      throw badRequest(
        "backup.json does not match the backup format",
        parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })),
      );
    const manifest = parsed.data;
    if (manifest.formatVersion > BACKUP_FORMAT_VERSION)
      throw badRequest("this backup was made by a newer Oak");
    if (manifest.schemaVersion > latestVersion())
      throw badRequest("this backup's database is newer than this Oak");
    // Audio must match its manifest entry before anything is replaced.
    const audio: { name: string; data: Uint8Array }[] = [];
    for (const f of manifest.files ?? []) {
      const data = files.get(f.path);
      if (data === undefined) throw badRequest(`${f.path} is listed but missing`);
      if (sha256(data) !== f.sha256) throw badRequest(`${f.path} is damaged`);
      if (!ARCHIVE_AUDIO_PATH.test(f.path)) throw badRequest(`${f.path} is not an audio path`);
      // The learner's own files are stored by their content hash: `audio/<sha256>.<ext>` must hold those bytes
      // (peaks are named after the audio they draw, so they are exempt).
      const own = /^audio\/([0-9a-f]{64})\.([a-z0-9]{2,5})$/.exec(f.path);
      if (own !== null && own[2] !== "peaks" && own[1] !== f.sha256)
        throw badRequest(`${f.path} does not hold the audio its name says`);
      audio.push({ name: f.path, data });
    }
    const tables = this.#forward(manifest);
    const copy = safetyCopy(this.db, this.paths.backupsDir, "pre-import", this.opts.now());
    const result = this.#replaceAll(this.db, tables);
    markForReview(this.db);
    for (const a of audio) this.paths.store.write(this.paths.store.resolveStored(a.name), a.data);
    const setAside = this.#setAsideOrphans(copy.replace(/\.db$/, "-audio"));
    return {
      ok: true,
      tables: result.tables,
      rows: result.rows,
      audioFiles: audio.length,
      orphanedFiles: setAside,
      migratedFrom: manifest.schemaVersion === latestVersion() ? null : manifest.schemaVersion,
      safetyCopy: copy,
    };
  }

  /**
   * After an import, the previous learner's audio that the new tables no longer reference is moved next to
   * the pre-import safety copy (`<copy>-audio/{audio,album}/…`), never deleted: restoring that copy then
   * only needs the folder moved back. Returns how many files were moved.
   */
  #setAsideOrphans(dest: string): number {
    const keep = new Set(this.#files().map((f) => f.abs));
    const { audioDir, albumDir } = this.paths.store;
    let moved = 0;
    const walk = (dir: string, base: string, label: string): void => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(abs, base, label);
          continue;
        }
        if (!entry.isFile() || keep.has(abs)) continue;
        const target = join(dest, label, relative(base, abs));
        mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
        try {
          renameSync(abs, target);
        } catch {
          // Another filesystem (a data dir split across mounts): copy, then remove.
          copyFileSync(abs, target);
          rmSync(abs, { force: true });
        }
        moved++;
      }
    };
    walk(audioDir, audioDir, "audio");
    walk(albumDir, albumDir, "album");
    // Empty track folders left behind in album/.
    if (existsSync(albumDir)) {
      for (const entry of readdirSync(albumDir, { withFileTypes: true })) {
        const abs = join(albumDir, entry.name);
        if (entry.isDirectory() && readdirSync(abs).length === 0)
          rmSync(abs, { recursive: true, force: true });
      }
    }
    return moved;
  }

  /** `POST /api/data/reset`: a safety copy, then every table emptied and the audio folders cleared. */
  reset(): string {
    const copy = safetyCopy(this.db, this.paths.backupsDir, "pre-reset", this.opts.now());
    this.#replaceAll(this.db, {});
    for (const dir of [this.paths.store.audioDir, this.paths.store.albumDir]) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    return copy;
  }
}

/**
 * Every imported sketch and album version runs only after the strict lint (§11.3): flag it for review. Wave 5
 * (carry-over c2): so does every imported transcription version (`review_before_run`, until the learner confirms
 * it), and an imported lesson attempt is marked `imported` (the voicing gate never hands its code back as typed).
 * Unit songs (spec 2026-11-24 §5.4): a take plays its sketch version, flagged above (`UnitSongTake.reviewBeforeRun`
 * reads that flag); a release snapshot holds code of its own (Oak's and every take's), so it is flagged too.
 */
export function markForReview(db: Db): void {
  const empty = '{"lockedTools":[],"previewTools":[]}';
  for (const t of ["sketch_versions", "album_track_versions"]) {
    db.run(
      `UPDATE "${t}" SET flags_json = json_set(COALESCE(flags_json, '${empty}'), '$.reviewBeforeRun', json('true'))`,
    );
  }
  db.run("UPDATE transcription_versions SET review_before_run = 1");
  db.run("UPDATE step_attempts SET imported = 1 WHERE code IS NOT NULL");
  db.run("UPDATE unit_song_releases SET review_before_run = 1");
}

/** JSON gives numbers, strings, booleans and nulls; SQLite STRICT tables want 0/1 for booleans. */
function normalizeValue(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "string") return v;
  return JSON.stringify(v);
}
