// sketches, sketch_versions, album_tracks, album_track_versions, audio_files, transcriptions,
// transcription_versions.
import {
  type AlbumTrack,
  type AlbumTrackVersion,
  type AudioFile,
  DEFAULT_TRANSCRIPTION_SETTINGS,
  type Sketch,
  type SketchVersion,
  type TakeState,
  type Transcription,
} from "@oak/api";
import type { GradeResult } from "@oak/content-kit";
import { all, bool, type Db, fromJson, get, int, run, toJson, toJsonOrNull } from "../index.ts";

const NO_FLAGS = { lockedTools: [] as string[], previewTools: [] as string[] };

// --- sketches -----------------------------------------------------------------------------------

interface SketchRow {
  id: string;
  title: string;
  origin_kind: string;
  origin_id: string | null;
  current_version: number;
  tags_json: string;
  archived: number;
  listening_comment: string | null;
  created_at: string;
  updated_at: string;
  /** Oak 2.0 (migration 0012): S7 committed lines and S6 drawn cards; NULL = none. */
  committed_json?: string | null;
  cards_json?: string | null;
}
const toSketch = (r: SketchRow): Sketch => ({
  id: r.id,
  title: r.title,
  originKind: r.origin_kind as Sketch["originKind"],
  originId: r.origin_id,
  currentVersion: r.current_version,
  tags: fromJson<string[]>(r.tags_json, []),
  archived: bool(r.archived),
  listeningNote: r.listening_comment,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  committed: fromJson<NonNullable<Sketch["committed"]>>(r.committed_json ?? null, []),
  cards: fromJson<NonNullable<Sketch["cards"]>>(r.cards_json ?? null, []),
});
interface SketchVersionRow {
  sketch_id: string;
  version: number;
  code: string;
  bpm: number | null;
  meter: string | null;
  key: string | null;
  analysis_json: string | null;
  note: string | null;
  tutor_assisted: number;
  band_json: string | null;
  flags_json: string | null;
  created_at: string;
  /** Oak 2.0 (migration 0012): S3 take state and S5 lineage; NULL = not a take / not in a chain. */
  take_state?: string | null;
  parent_version?: number | null;
  generation?: number | null;
  dimension?: string | null;
}
const toSketchVersion = (r: SketchVersionRow): SketchVersion => ({
  sketchId: r.sketch_id,
  version: r.version,
  code: r.code,
  bpm: r.bpm,
  meter: r.meter as SketchVersion["meter"],
  key: fromJson<SketchVersion["key"]>(r.key, null),
  analysis: fromJson<SketchVersion["analysis"]>(r.analysis_json, null),
  note: r.note,
  tutorAssisted: bool(r.tutor_assisted),
  band: fromJson<SketchVersion["band"]>(r.band_json, null),
  flags: fromJson<SketchVersion["flags"]>(r.flags_json, NO_FLAGS),
  createdAt: r.created_at,
  takeState: (r.take_state ?? null) as TakeState | null,
  parentVersion: r.parent_version ?? null,
  generation: r.generation ?? null,
  dimension: (r.dimension ?? null) as SketchVersion["dimension"] | null,
});

export class SketchesRepo {
  constructor(private readonly db: Db) {}
  list(filter: { origin?: string; archived?: boolean } = {}): Sketch[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (filter.origin !== undefined) {
      where.push("origin_kind = ?");
      params.push(filter.origin);
    }
    if (filter.archived !== undefined) {
      where.push("archived = ?");
      params.push(int(filter.archived));
    }
    return all<SketchRow>(
      this.db,
      `SELECT * FROM sketches ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC, id`,
      ...params,
    ).map(toSketch);
  }
  get(id: string): Sketch | null {
    const row = get<SketchRow>(this.db, "SELECT * FROM sketches WHERE id = ?", id);
    return row === null ? null : toSketch(row);
  }
  versions(id: string): SketchVersion[] {
    return all<SketchVersionRow>(
      this.db,
      "SELECT * FROM sketch_versions WHERE sketch_id = ? ORDER BY version",
      id,
    ).map(toSketchVersion);
  }
  version(id: string, version: number): SketchVersion | null {
    const row = get<SketchVersionRow>(
      this.db,
      "SELECT * FROM sketch_versions WHERE sketch_id = ? AND version = ?",
      id,
      version,
    );
    return row === null ? null : toSketchVersion(row);
  }
  insert(s: Sketch): void {
    run(
      this.db,
      `INSERT INTO sketches (id, title, origin_kind, origin_id, current_version, tags_json, archived, listening_comment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id,
      s.title,
      s.originKind,
      s.originId,
      s.currentVersion,
      toJson(s.tags),
      int(s.archived),
      s.listeningNote,
      s.createdAt,
      s.updatedAt,
    );
  }
  insertVersion(v: SketchVersion): void {
    run(
      this.db,
      `INSERT INTO sketch_versions (sketch_id, version, code, bpm, meter, key, analysis_json, note, tutor_assisted, band_json, flags_json, created_at,
         take_state, parent_version, generation, dimension)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      v.sketchId,
      v.version,
      v.code,
      v.bpm,
      v.meter,
      toJsonOrNull(v.key),
      toJsonOrNull(v.analysis),
      v.note,
      int(v.tutorAssisted),
      toJsonOrNull(v.band),
      toJson(v.flags),
      v.createdAt,
      v.takeState ?? null,
      v.parentVersion ?? null,
      v.generation ?? null,
      v.dimension ?? null,
    );
    run(
      this.db,
      "UPDATE sketches SET current_version = ?, updated_at = ? WHERE id = ?",
      v.version,
      v.createdAt,
      v.sketchId,
    );
  }
  patch(
    id: string,
    patch: {
      title?: string;
      tags?: string[];
      archived?: boolean;
      listeningNote?: string | null;
      committed?: NonNullable<Sketch["committed"]>;
      cards?: NonNullable<Sketch["cards"]>;
    },
    at: string,
  ): void {
    if (patch.title !== undefined)
      run(this.db, "UPDATE sketches SET title = ? WHERE id = ?", patch.title, id);
    if (patch.tags !== undefined)
      run(this.db, "UPDATE sketches SET tags_json = ? WHERE id = ?", toJson(patch.tags), id);
    if (patch.archived !== undefined)
      run(this.db, "UPDATE sketches SET archived = ? WHERE id = ?", int(patch.archived), id);
    if (patch.listeningNote !== undefined)
      run(this.db, "UPDATE sketches SET listening_comment = ? WHERE id = ?", patch.listeningNote, id);
    // Oak 2.0: the whole list replaces the stored one; an empty list is stored as NULL ("none").
    if (patch.committed !== undefined)
      run(
        this.db,
        "UPDATE sketches SET committed_json = ? WHERE id = ?",
        patch.committed.length === 0 ? null : toJson(patch.committed),
        id,
      );
    if (patch.cards !== undefined)
      run(
        this.db,
        "UPDATE sketches SET cards_json = ? WHERE id = ?",
        patch.cards.length === 0 ? null : toJson(patch.cards),
        id,
      );
    run(this.db, "UPDATE sketches SET updated_at = ? WHERE id = ?", at, id);
  }
  /** Oak 2.0 S3: keep or cut a take, or clear the mark (never deletes the version). False when there is no such version. */
  setTakeState(id: string, version: number, takeState: TakeState | null): boolean {
    return (
      run(
        this.db,
        "UPDATE sketch_versions SET take_state = ? WHERE sketch_id = ? AND version = ?",
        takeState,
        id,
        version,
      ).changes > 0
    );
  }
  delete(id: string): boolean {
    return run(this.db, "DELETE FROM sketches WHERE id = ?", id).changes > 0;
  }
  savedSince(at: string): string[] {
    return all<{ sketch_id: string }>(
      this.db,
      "SELECT DISTINCT sketch_id FROM sketch_versions WHERE created_at >= ? ORDER BY created_at",
      at,
    ).map((r) => r.sketch_id);
  }
  latest(): Sketch | null {
    const row = get<SketchRow>(
      this.db,
      "SELECT * FROM sketches WHERE archived = 0 ORDER BY updated_at DESC LIMIT 1",
    );
    return row === null ? null : toSketch(row);
  }
}

// --- album --------------------------------------------------------------------------------------

interface TrackRow {
  id: string;
  capstone_id: string | null;
  sketch_id: string | null;
  side: string;
  track_no: number;
  title: string;
  flavour: string | null;
  current_version: number;
  cover_seed: string;
  created_at: string;
  /** Oak 2.0 F6 (migration 0012): 1 on the Shelf, kept off the album; 0 on the album. */
  shelved: number;
}
const toTrack = (r: TrackRow): AlbumTrack => ({
  id: r.id,
  capstoneId: r.capstone_id as AlbumTrack["capstoneId"],
  sketchId: r.sketch_id,
  side: r.side as AlbumTrack["side"],
  trackNo: r.track_no,
  title: r.title,
  flavour: r.flavour as AlbumTrack["flavour"],
  currentVersion: r.current_version,
  coverSeed: r.cover_seed,
  createdAt: r.created_at,
  shelved: r.shelved === 1,
});
interface TrackVersionRow {
  track_id: string;
  version: number;
  sketch_id: string;
  sketch_version: number;
  audio_path: string | null;
  audio_mime: string | null;
  duration_s: number | null;
  liner_notes_md: string;
  theory_tags_json: string;
  review_json: string | null;
  tutor_assisted: number;
  attribution: string | null;
  band_json: string | null;
  flags_json: string | null;
  created_at: string;
  include_review_note?: number | null;
}
const toTrackVersion = (r: TrackVersionRow): AlbumTrackVersion => ({
  trackId: r.track_id,
  version: r.version,
  sketchId: r.sketch_id,
  sketchVersion: r.sketch_version,
  hasAudio: r.audio_path !== null,
  audioMime: r.audio_mime,
  durationS: r.duration_s,
  linerNotesMd: r.liner_notes_md,
  theoryTags: fromJson<string[]>(r.theory_tags_json, []),
  review: fromJson<unknown>(r.review_json, null),
  tutorAssisted: bool(r.tutor_assisted),
  attribution: r.attribution,
  band: fromJson<AlbumTrackVersion["band"]>(r.band_json, null),
  flags: fromJson<AlbumTrackVersion["flags"]>(r.flags_json, NO_FLAGS),
  createdAt: r.created_at,
  // Wave 4: absent until the learner (or a release) chose.
  ...(r.include_review_note === null || r.include_review_note === undefined
    ? {}
    : { includeReviewNote: r.include_review_note === 1 }),
});

export class AlbumRepo {
  constructor(private readonly db: Db) {}
  tracks(): AlbumTrack[] {
    return all<TrackRow>(
      this.db,
      "SELECT * FROM album_tracks ORDER BY CASE side WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END, track_no, created_at",
    ).map(toTrack);
  }
  track(id: string): AlbumTrack | null {
    const row = get<TrackRow>(this.db, "SELECT * FROM album_tracks WHERE id = ?", id);
    return row === null ? null : toTrack(row);
  }
  trackOfCapstone(capstoneId: string): AlbumTrack | null {
    const row = get<TrackRow>(this.db, "SELECT * FROM album_tracks WHERE capstone_id = ?", capstoneId);
    return row === null ? null : toTrack(row);
  }
  nextTrackNo(side: string): number {
    return Number(
      get<{ n: number }>(
        this.db,
        "SELECT COALESCE(MAX(track_no), 0) + 1 AS n FROM album_tracks WHERE side = ?",
        side,
      )?.n ?? 1,
    );
  }
  insertTrack(t: AlbumTrack): void {
    run(
      this.db,
      `INSERT INTO album_tracks (id, capstone_id, sketch_id, side, track_no, title, flavour, current_version, cover_seed, created_at, shelved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t.id,
      t.capstoneId,
      t.sketchId,
      t.side,
      t.trackNo,
      t.title,
      t.flavour,
      t.currentVersion,
      t.coverSeed,
      t.createdAt,
      t.shelved === true ? 1 : 0,
    );
  }
  /** Oak 2.0 F6: put a track on the Shelf or take it off; false when there is no such track. */
  setShelved(trackId: string, shelved: boolean): boolean {
    if (this.track(trackId) === null) return false;
    run(this.db, "UPDATE album_tracks SET shelved = ? WHERE id = ?", shelved ? 1 : 0, trackId);
    return true;
  }
  versions(trackId: string): AlbumTrackVersion[] {
    return all<TrackVersionRow>(
      this.db,
      "SELECT * FROM album_track_versions WHERE track_id = ? ORDER BY version",
      trackId,
    ).map(toTrackVersion);
  }
  version(trackId: string, version: number): AlbumTrackVersion | null {
    const row = get<TrackVersionRow>(
      this.db,
      "SELECT * FROM album_track_versions WHERE track_id = ? AND version = ?",
      trackId,
      version,
    );
    return row === null ? null : toTrackVersion(row);
  }
  audioOf(trackId: string, version: number): { path: string; mime: string } | null {
    const row = get<{ audio_path: string | null; audio_mime: string | null }>(
      this.db,
      "SELECT audio_path, audio_mime FROM album_track_versions WHERE track_id = ? AND version = ?",
      trackId,
      version,
    );
    return row === null || row.audio_path === null
      ? null
      : { path: row.audio_path, mime: row.audio_mime ?? "application/octet-stream" };
  }
  audioPaths(trackId?: string): { trackId: string; version: number; path: string; mime: string | null }[] {
    return all<{ track_id: string; version: number; audio_path: string; audio_mime: string | null }>(
      this.db,
      `SELECT track_id, version, audio_path, audio_mime FROM album_track_versions
       WHERE audio_path IS NOT NULL ${trackId === undefined ? "" : "AND track_id = ?"} ORDER BY track_id, version`,
      ...(trackId === undefined ? [] : [trackId]),
    ).map((r) => ({ trackId: r.track_id, version: r.version, path: r.audio_path, mime: r.audio_mime }));
  }
  insertVersion(v: AlbumTrackVersion): void {
    run(
      this.db,
      `INSERT INTO album_track_versions (track_id, version, sketch_id, sketch_version, liner_notes_md, theory_tags_json,
         review_json, tutor_assisted, attribution, band_json, flags_json, created_at, include_review_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      v.trackId,
      v.version,
      v.sketchId,
      v.sketchVersion,
      v.linerNotesMd,
      toJson(v.theoryTags),
      toJsonOrNull(v.review),
      int(v.tutorAssisted),
      v.attribution,
      toJsonOrNull(v.band),
      toJson(v.flags),
      v.createdAt,
      v.includeReviewNote === undefined ? null : int(v.includeReviewNote),
    );
    run(this.db, "UPDATE album_tracks SET current_version = ? WHERE id = ?", v.version, v.trackId);
  }
  /** Wave 4: edit a version's liner notes and whether the review's liner note shows (album.patchVersion). */
  patchVersion(
    trackId: string,
    version: number,
    patch: { linerNotesMd?: string; includeReviewNote?: boolean },
  ): void {
    if (patch.linerNotesMd !== undefined)
      run(
        this.db,
        "UPDATE album_track_versions SET liner_notes_md = ? WHERE track_id = ? AND version = ?",
        patch.linerNotesMd,
        trackId,
        version,
      );
    if (patch.includeReviewNote !== undefined)
      run(
        this.db,
        "UPDATE album_track_versions SET include_review_note = ? WHERE track_id = ? AND version = ?",
        int(patch.includeReviewNote),
        trackId,
        version,
      );
  }
  /** Wave 4: the conversation whose accepted review is attached to a version, or `null`. */
  reviewConversation(trackId: string, version: number): string | null {
    return (
      get<{ review_conversation_id: string | null }>(
        this.db,
        "SELECT review_conversation_id FROM album_track_versions WHERE track_id = ? AND version = ?",
        trackId,
        version,
      )?.review_conversation_id ?? null
    );
  }
  setAudio(trackId: string, version: number, path: string, mime: string, durationS: number | null): void {
    run(
      this.db,
      "UPDATE album_track_versions SET audio_path = ?, audio_mime = ?, duration_s = COALESCE(?, duration_s) WHERE track_id = ? AND version = ?",
      path,
      mime,
      durationS,
      trackId,
      version,
    );
  }
  setReview(trackId: string, version: number, review: unknown, conversationId: string | null = null): void {
    run(
      this.db,
      "UPDATE album_track_versions SET review_json = ?, review_conversation_id = COALESCE(?, review_conversation_id) WHERE track_id = ? AND version = ?",
      toJsonOrNull(review),
      conversationId,
      trackId,
      version,
    );
  }
  deleteTrack(id: string): boolean {
    return run(this.db, "DELETE FROM album_tracks WHERE id = ?", id).changes > 0;
  }
}

// --- audio files --------------------------------------------------------------------------------

interface AudioRow {
  id: string;
  original_name: string;
  mime: string;
  bytes: number;
  duration_s: number | null;
  sample_rate: number | null;
  channels: number | null;
  stored_path: string;
  peaks_path: string | null;
  created_at: string;
}
export interface StoredAudio extends AudioFile {
  storedPath: string;
  peaksPath: string | null;
}
const toAudio = (r: AudioRow): StoredAudio => ({
  id: r.id,
  originalName: r.original_name,
  mime: r.mime,
  bytes: r.bytes,
  durationS: r.duration_s,
  sampleRate: r.sample_rate,
  channels: r.channels,
  hasPeaks: r.peaks_path !== null,
  createdAt: r.created_at,
  storedPath: r.stored_path,
  peaksPath: r.peaks_path,
});

export class AudioRepo {
  constructor(private readonly db: Db) {}
  get(id: string): StoredAudio | null {
    const row = get<AudioRow>(this.db, "SELECT * FROM audio_files WHERE id = ?", id);
    return row === null ? null : toAudio(row);
  }
  list(): StoredAudio[] {
    return all<AudioRow>(this.db, "SELECT * FROM audio_files ORDER BY created_at, id").map(toAudio);
  }
  insert(a: StoredAudio): void {
    run(
      this.db,
      `INSERT OR IGNORE INTO audio_files (id, original_name, mime, bytes, duration_s, sample_rate, channels, stored_path, peaks_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      a.id,
      a.originalName,
      a.mime,
      a.bytes,
      a.durationS,
      a.sampleRate,
      a.channels,
      a.storedPath,
      a.peaksPath,
      a.createdAt,
    );
  }
  setPeaks(id: string, peaksPath: string): void {
    run(this.db, "UPDATE audio_files SET peaks_path = ? WHERE id = ?", peaksPath, id);
  }
  delete(id: string): boolean {
    return run(this.db, "DELETE FROM audio_files WHERE id = ?", id).changes > 0;
  }
}

// --- transcriptions -----------------------------------------------------------------------------

interface TrRow {
  id: string;
  source_kind: string;
  player: string;
  audio_id: string | null;
  song_id: string | null;
  title: string;
  artist: string | null;
  key: string | null;
  bpm: number | null;
  meter: string | null;
  downbeat_s: number | null;
  fine_tune_cents: number;
  ladder_level: number | null;
  realism: number | null;
  hidden_code: string | null;
  regions_json: string;
  checklist_json: string;
  self_score: number | null;
  current_version: number;
  status: string;
  review_json: string | null;
  created_at: string;
  updated_at: string;
  settings_json?: string | null;
  graded_pass?: number;
  gym_id?: string | null;
  ladder_seed?: number | null;
  ladder_json?: string | null;
}
/** Wave 4: what a generated ladder item keeps besides its hidden code (never sent to the browser). */
export interface StoredLadderItem {
  seed: number;
  given: {
    bpm: number;
    meter: NonNullable<Transcription["meter"]>;
    key: NonNullable<Transcription["key"]>;
    pickup: { units: [number, number] } | null;
    bars: number;
  };
  /** Cycles the reference plays (given bars, plus a pickup bar). */
  cycles: number;
  /** L3: bass → quality → rn; Wave 5, L6 songs: bass → changes → melody. */
  stages: ("bass" | "quality" | "rn" | "changes" | "melody" | "form")[] | null;
  swing: { subdivision: number; amount: number } | null;
  title: string;
  /** Wave 5: an L5/L6 song item — the repertoire song, its level and the phrases the item works. */
  song?: { songId: string; level: 5 | 6 | 8; phrases: [number, number][] };
  /** The stimulus as the pattern source plays it. */
  stimulus: {
    events: unknown[];
    cps: number;
    bars: number;
    preload: string[];
    /** The generator's performance hints (Wave 4 integration; absent on items stored before it). */
    performance?: { target: string; swung: boolean; vocalLead: "tenor" | "choir" | null };
  } | null;
}
export interface StoredTranscription extends Transcription {
  /** Never sent to the browser (contracts §11.11). */
  hiddenCode: string | null;
  /** Wave 4: generated ladder items only; never sent to the browser. */
  ladder?: StoredLadderItem | null;
}
const toTranscription = (r: TrRow): StoredTranscription => ({
  id: r.id,
  sourceKind: r.source_kind as Transcription["sourceKind"],
  player: r.player as Transcription["player"],
  audioId: r.audio_id,
  songId: r.song_id,
  title: r.title,
  artist: r.artist,
  key: fromJson<Transcription["key"]>(r.key, null),
  bpm: r.bpm,
  meter: r.meter as Transcription["meter"],
  downbeatS: r.downbeat_s,
  fineTuneCents: r.fine_tune_cents,
  ladderLevel: r.ladder_level,
  realism: r.realism,
  regions: fromJson<Transcription["regions"]>(r.regions_json, []),
  checklist: fromJson<Transcription["checklist"]>(r.checklist_json, {}),
  selfScore: r.self_score,
  currentVersion: r.current_version,
  status: r.status as Transcription["status"],
  review: fromJson<unknown>(r.review_json, null),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  hiddenCode: r.hidden_code,
  ...(r.settings_json === null || r.settings_json === undefined
    ? {}
    : {
        settings: fromJson<NonNullable<Transcription["settings"]>>(
          r.settings_json,
          DEFAULT_TRANSCRIPTION_SETTINGS,
        ),
      }),
  gradedPass: r.graded_pass === 1,
  gymId: (r.gym_id ?? null) as Transcription["gymId"],
  ladder: fromJson<StoredLadderItem | null>(r.ladder_json ?? null, null),
});

export interface TranscriptionVersionRow {
  transcriptionId: string;
  version: number;
  code: string;
  result: GradeResult | null;
  createdAt: string;
  /** Wave 4: a "Hum it, Oak drafts it" draft not yet edited (no evidence). */
  machineDraft?: boolean;
  /** Wave 4: the L3 stage this version answered; Wave 5: an L6 stage (`bass`, `changes`, `melody`). */
  stage?: "bass" | "quality" | "rn" | "changes" | "melody" | "form" | null;
  /** Wave 5: the L5 phrase (1-based) this version answered. */
  phrase?: number | null;
  /** Wave 5 (c2): arrived through a backup import; runs only after the strict lint and the learner's confirmation. */
  reviewBeforeRun?: boolean;
}

export class TranscriptionsRepo {
  constructor(private readonly db: Db) {}
  list(): StoredTranscription[] {
    return all<TrRow>(this.db, "SELECT * FROM transcriptions ORDER BY updated_at DESC, id").map(
      toTranscription,
    );
  }
  get(id: string): StoredTranscription | null {
    const row = get<TrRow>(this.db, "SELECT * FROM transcriptions WHERE id = ?", id);
    return row === null ? null : toTranscription(row);
  }
  usingAudio(audioId: string): string[] {
    return all<{ id: string }>(this.db, "SELECT id FROM transcriptions WHERE audio_id = ?", audioId).map(
      (r) => r.id,
    );
  }
  insert(t: StoredTranscription): void {
    run(
      this.db,
      `INSERT INTO transcriptions (id, source_kind, player, audio_id, song_id, title, artist, key, bpm, meter, downbeat_s,
         fine_tune_cents, ladder_level, realism, hidden_code, regions_json, checklist_json, self_score, current_version,
         status, review_json, created_at, updated_at, settings_json, graded_pass, gym_id, ladder_seed, ladder_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t.id,
      t.sourceKind,
      t.player,
      t.audioId,
      t.songId,
      t.title,
      t.artist,
      toJsonOrNull(t.key),
      t.bpm,
      t.meter,
      t.downbeatS,
      t.fineTuneCents,
      t.ladderLevel,
      t.realism,
      t.hiddenCode,
      toJson(t.regions),
      toJson(t.checklist),
      t.selfScore,
      t.currentVersion,
      t.status,
      toJsonOrNull(t.review),
      t.createdAt,
      t.updatedAt,
      t.settings === undefined ? null : toJson(t.settings),
      int(t.gradedPass === true),
      t.gymId ?? null,
      t.ladder?.seed ?? null,
      t.ladder === undefined || t.ladder === null ? null : toJson(t.ladder),
    );
  }
  update(t: StoredTranscription): void {
    run(
      this.db,
      `UPDATE transcriptions SET title = ?, artist = ?, key = ?, bpm = ?, meter = ?, downbeat_s = ?, fine_tune_cents = ?,
         regions_json = ?, checklist_json = ?, self_score = ?, current_version = ?, status = ?, review_json = ?, updated_at = ?,
         settings_json = ?, graded_pass = ?, gym_id = ?, ladder_level = ?, realism = ?
       WHERE id = ?`,
      t.title,
      t.artist,
      toJsonOrNull(t.key),
      t.bpm,
      t.meter,
      t.downbeatS,
      t.fineTuneCents,
      toJson(t.regions),
      toJson(t.checklist),
      t.selfScore,
      t.currentVersion,
      t.status,
      toJsonOrNull(t.review),
      t.updatedAt,
      t.settings === undefined ? null : toJson(t.settings),
      int(t.gradedPass === true),
      t.gymId ?? null,
      t.ladderLevel,
      t.realism,
      t.id,
    );
  }
  versions(id: string): TranscriptionVersionRow[] {
    return all<{
      transcription_id: string;
      version: number;
      code: string;
      result_json: string | null;
      created_at: string;
      machine_draft: number;
      stage: string | null;
      phrase?: number | null;
      review_before_run?: number;
    }>(this.db, "SELECT * FROM transcription_versions WHERE transcription_id = ? ORDER BY version", id).map(
      (r) => ({
        transcriptionId: r.transcription_id,
        version: r.version,
        code: r.code,
        result: fromJson<GradeResult | null>(r.result_json, null),
        createdAt: r.created_at,
        machineDraft: r.machine_draft === 1,
        stage: (r.stage ?? null) as NonNullable<TranscriptionVersionRow["stage"]> | null,
        phrase: r.phrase ?? null,
        ...(r.review_before_run === 1 ? { reviewBeforeRun: true } : {}),
      }),
    );
  }
  insertVersion(v: TranscriptionVersionRow): void {
    run(
      this.db,
      "INSERT INTO transcription_versions (transcription_id, version, code, result_json, created_at, machine_draft, stage, phrase, review_before_run) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      v.transcriptionId,
      v.version,
      v.code,
      toJsonOrNull(v.result),
      v.createdAt,
      int(v.machineDraft === true),
      v.stage ?? null,
      v.phrase ?? null,
      int(v.reviewBeforeRun === true),
    );
  }
  /** Wave 5 (c2): the learner read an imported version, the strict lint passed, and they confirmed it as theirs. */
  confirmVersion(id: string, version: number): boolean {
    return (
      run(
        this.db,
        "UPDATE transcription_versions SET review_before_run = 0 WHERE transcription_id = ? AND version = ? AND review_before_run = 1",
        id,
        version,
      ).changes > 0
    );
  }
  /** Wave 5 (c11): the version a review conversation was asked about, recorded when the review was accepted. */
  addReviewVersion(r: {
    conversationId: string;
    transcriptionId: string;
    version: number | null;
    at: string;
  }): void {
    run(
      this.db,
      "INSERT OR REPLACE INTO transcription_review_versions (conversation_id, transcription_id, version, at) VALUES (?, ?, ?, ?)",
      r.conversationId,
      r.transcriptionId,
      r.version,
      r.at,
    );
  }
  reviewVersions(transcriptionId: string): { conversationId: string; version: number | null; at: string }[] {
    return all<{ conversation_id: string; version: number | null; at: string }>(
      this.db,
      "SELECT conversation_id, version, at FROM transcription_review_versions WHERE transcription_id = ? ORDER BY at",
      transcriptionId,
    ).map((r) => ({ conversationId: r.conversation_id, version: r.version, at: r.at }));
  }
  delete(id: string): boolean {
    return run(this.db, "DELETE FROM transcriptions WHERE id = ?", id).changes > 0;
  }
}
