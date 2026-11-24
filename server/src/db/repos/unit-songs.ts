// Unit songs (0011_unit_songs.sql; spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.4): the songs, their
// takes in order, their frozen releases, and the two album columns a release writes.
import { all, bool, type Db, fromJson, get, int, run, toJson } from "../index.ts";

export interface UnitSongRow {
  unitId: string;
  songId: string;
  songVersion: number;
  flavour: string;
  title: string;
  status: "open" | "released";
  backfilled: boolean;
  styleSeen: boolean;
  createdAt: string;
  releasedAt: string | null;
}

export interface UnitSongTakeRow {
  id: number;
  unitId: string;
  lessonId: string;
  sketchId: string;
  sketchVersion: number;
  cells: string[];
  labels: Record<string, string | null>;
  bpm: number;
  backfilled: boolean;
  createdAt: string;
}

export interface UnitSongReleaseRow {
  id: number;
  unitId: string;
  albumTrackId: string;
  albumVersion: number;
  songId: string;
  songVersion: number;
  flavour: string;
  title: string;
  bpm: number;
  oakCode: string;
  /** The `UnitSongDef` as it was at release (JSON). */
  def: unknown;
  /** The takes as they were at release (JSON, `UnitSongSnapshotTake[]`). */
  takes: unknown[];
  reviewBeforeRun: boolean;
  createdAt: string;
}

interface SongDbRow {
  unit_id: string;
  song_id: string;
  song_version: number;
  flavour: string;
  title: string;
  status: string;
  backfilled: number;
  style_seen: number;
  created_at: string;
  released_at: string | null;
}
const toSong = (r: SongDbRow): UnitSongRow => ({
  unitId: r.unit_id,
  songId: r.song_id,
  songVersion: r.song_version,
  flavour: r.flavour,
  title: r.title,
  status: r.status === "released" ? "released" : "open",
  backfilled: bool(r.backfilled),
  styleSeen: bool(r.style_seen),
  createdAt: r.created_at,
  releasedAt: r.released_at,
});

interface TakeDbRow {
  id: number;
  unit_id: string;
  lesson_id: string;
  sketch_id: string;
  sketch_version: number;
  cells_json: string;
  labels_json: string;
  bpm: number;
  backfilled: number;
  created_at: string;
}
const toTake = (r: TakeDbRow): UnitSongTakeRow => ({
  id: r.id,
  unitId: r.unit_id,
  lessonId: r.lesson_id,
  sketchId: r.sketch_id,
  sketchVersion: r.sketch_version,
  cells: fromJson<string[]>(r.cells_json, []),
  labels: fromJson<Record<string, string | null>>(r.labels_json, {}),
  bpm: r.bpm,
  backfilled: bool(r.backfilled),
  createdAt: r.created_at,
});

interface ReleaseDbRow {
  id: number;
  unit_id: string;
  album_track_id: string;
  album_version: number;
  song_id: string;
  song_version: number;
  flavour: string;
  title: string;
  bpm: number;
  oak_code: string;
  def_json: string;
  takes_json: string;
  review_before_run: number;
  created_at: string;
}
const toRelease = (r: ReleaseDbRow): UnitSongReleaseRow => ({
  id: r.id,
  unitId: r.unit_id,
  albumTrackId: r.album_track_id,
  albumVersion: r.album_version,
  songId: r.song_id,
  songVersion: r.song_version,
  flavour: r.flavour,
  title: r.title,
  bpm: r.bpm,
  oakCode: r.oak_code,
  def: fromJson<unknown>(r.def_json, null),
  takes: fromJson<unknown[]>(r.takes_json, []),
  reviewBeforeRun: bool(r.review_before_run),
  createdAt: r.created_at,
});

/** Takes in the order they apply: oldest first, a later take overriding an earlier one cell by cell. */
const TAKE_ORDER = "ORDER BY created_at, id";

export class UnitSongsRepo {
  constructor(private readonly db: Db) {}

  get(unitId: string): UnitSongRow | null {
    const r = get<SongDbRow>(this.db, "SELECT * FROM unit_songs WHERE unit_id = ?", unitId);
    return r === null ? null : toSong(r);
  }
  all(): UnitSongRow[] {
    return all<SongDbRow>(this.db, "SELECT * FROM unit_songs ORDER BY created_at, unit_id").map(toSong);
  }
  /** Creates the song unless the unit already has one (the primary key guards two tabs). Returns whether it did. */
  insert(s: Omit<UnitSongRow, "status" | "releasedAt">): boolean {
    return (
      run(
        this.db,
        `INSERT INTO unit_songs (unit_id, song_id, song_version, flavour, title, status, backfilled, style_seen, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?) ON CONFLICT (unit_id) DO NOTHING`,
        s.unitId,
        s.songId,
        s.songVersion,
        s.flavour,
        s.title,
        int(s.backfilled),
        int(s.styleSeen),
        s.createdAt,
      ).changes > 0
    );
  }
  patch(
    unitId: string,
    p: Partial<
      Pick<
        UnitSongRow,
        "songVersion" | "flavour" | "title" | "status" | "backfilled" | "styleSeen" | "releasedAt"
      >
    >,
  ): void {
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    const set = (col: string, v: string | number | null) => {
      sets.push(`${col} = ?`);
      vals.push(v);
    };
    if (p.songVersion !== undefined) set("song_version", p.songVersion);
    if (p.flavour !== undefined) set("flavour", p.flavour);
    if (p.title !== undefined) set("title", p.title);
    if (p.status !== undefined) set("status", p.status);
    if (p.backfilled !== undefined) set("backfilled", int(p.backfilled));
    if (p.styleSeen !== undefined) set("style_seen", int(p.styleSeen));
    if (p.releasedAt !== undefined) set("released_at", p.releasedAt);
    if (sets.length === 0) return;
    run(this.db, `UPDATE unit_songs SET ${sets.join(", ")} WHERE unit_id = ?`, ...vals, unitId);
  }

  // --- takes ---
  takes(unitId: string): UnitSongTakeRow[] {
    return all<TakeDbRow>(
      this.db,
      `SELECT * FROM unit_song_takes WHERE unit_id = ? ${TAKE_ORDER}`,
      unitId,
    ).map(toTake);
  }
  /** The take that plays this sketch version of this lesson, if one was recorded. */
  takeOf(unitId: string, lessonId: string, sketchId: string, sketchVersion: number): UnitSongTakeRow | null {
    const r = get<TakeDbRow>(
      this.db,
      `SELECT * FROM unit_song_takes WHERE unit_id = ? AND lesson_id = ? AND sketch_id = ? AND sketch_version = ?
       ORDER BY id LIMIT 1`,
      unitId,
      lessonId,
      sketchId,
      sketchVersion,
    );
    return r === null ? null : toTake(r);
  }
  insertTake(t: Omit<UnitSongTakeRow, "id">): number {
    return run(
      this.db,
      `INSERT INTO unit_song_takes (unit_id, lesson_id, sketch_id, sketch_version, cells_json, labels_json, bpm, backfilled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t.unitId,
      t.lessonId,
      t.sketchId,
      t.sketchVersion,
      toJson(t.cells),
      toJson(t.labels),
      t.bpm,
      int(t.backfilled),
      t.createdAt,
    ).lastInsertRowid;
  }
  /** The app saved a recorded version again: its cells, labels and tempo as computed now (order and id kept). */
  refineTake(id: number, t: Pick<UnitSongTakeRow, "cells" | "labels" | "bpm" | "backfilled">): void {
    run(
      this.db,
      "UPDATE unit_song_takes SET cells_json = ?, labels_json = ?, bpm = ?, backfilled = ? WHERE id = ?",
      toJson(t.cells),
      toJson(t.labels),
      t.bpm,
      int(t.backfilled),
      id,
    );
  }

  // --- releases ---
  releases(unitId: string): UnitSongReleaseRow[] {
    return all<ReleaseDbRow>(
      this.db,
      "SELECT * FROM unit_song_releases WHERE unit_id = ? ORDER BY id",
      unitId,
    ).map(toRelease);
  }
  release(unitId: string, id: number): UnitSongReleaseRow | null {
    const r = get<ReleaseDbRow>(
      this.db,
      "SELECT * FROM unit_song_releases WHERE unit_id = ? AND id = ?",
      unitId,
      id,
    );
    return r === null ? null : toRelease(r);
  }
  insertRelease(r: Omit<UnitSongReleaseRow, "id" | "reviewBeforeRun">): number {
    return run(
      this.db,
      `INSERT INTO unit_song_releases (unit_id, album_track_id, album_version, song_id, song_version, flavour, title, bpm,
         oak_code, def_json, takes_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      r.unitId,
      r.albumTrackId,
      r.albumVersion,
      r.songId,
      r.songVersion,
      r.flavour,
      r.title,
      r.bpm,
      r.oakCode,
      toJson(r.def),
      toJson(r.takes),
      r.createdAt,
    ).lastInsertRowid;
  }

  // --- the album rows a release writes (0011's ADD COLUMNs) ---
  /** Whether the album track still exists (the learner may delete it). */
  albumTrackExists(trackId: string): boolean {
    return get<{ id: string }>(this.db, "SELECT id FROM album_tracks WHERE id = ?", trackId) !== null;
  }
  setAlbumUnit(trackId: string, unitId: string): void {
    run(this.db, "UPDATE album_tracks SET unit_id = ? WHERE id = ?", unitId, trackId);
  }
  /** A song released again: its album track shows the newest release's title and style (older snapshots keep theirs). */
  setAlbumTrackMeta(trackId: string, title: string, flavour: string): void {
    run(this.db, "UPDATE album_tracks SET title = ?, flavour = ? WHERE id = ?", title, flavour, trackId);
  }
  /** The song release an album version plays (`song_release_id`), or `null` for any other version. */
  releaseOfAlbumVersion(trackId: string, version: number): { unitId: string; releaseId: number } | null {
    const r = get<{ unit_id: string; id: number }>(
      this.db,
      `SELECT r.unit_id, r.id FROM album_track_versions v JOIN unit_song_releases r ON r.id = v.song_release_id
       WHERE v.track_id = ? AND v.version = ?`,
      trackId,
      version,
    );
    return r === null ? null : { unitId: r.unit_id, releaseId: r.id };
  }
  setVersionRelease(trackId: string, version: number, releaseId: number): void {
    run(
      this.db,
      "UPDATE album_track_versions SET song_release_id = ? WHERE track_id = ? AND version = ?",
      releaseId,
      trackId,
      version,
    );
  }
}
