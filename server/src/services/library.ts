// The learner's own things: sketches, the album (tracks, versions, liner-note data, recorded audio),
// their audio files, and transcription projects. Saving a sketch version after a successful Run
// qualifies the streak day (contracts §7.8 b).

import { readFileSync, statSync } from "node:fs";
import {
  ALBUM_SIDES,
  type Album,
  type AlbumSource,
  type AlbumTrackDetail,
  type AlbumTrackVersion,
  type AudioFile,
  DEFAULT_TRANSCRIPTION_SETTINGS,
  type LessonSketch,
  type Sketch,
  type SketchDetail,
  type SketchSaved,
  type SketchVersion,
  TAKE_STATES,
  type TakeState,
  type TrackPatch,
  type Transcription,
  type TranscriptionDetail,
  type TranscriptionSettings,
  type TranscriptionVersion,
} from "@oak/api";
import { type GradeResult, skillOf } from "@oak/content-kit";
import type { LadderPiece } from "@oak/drills";
import { lintStrict } from "@oak/grader";
import { tx } from "../db/index.ts";
import type { StoredTranscription, TranscriptionVersionRow } from "../db/repos/library.ts";
import { ApiError, badRequest, conflict, notFound } from "../errors.ts";
import {
  type AudioStore,
  extFor,
  MAX_AUDIO_BYTES,
  MAX_PEAKS_BYTES,
  mimeFor,
  sha256,
  sniffAudio,
  wavInfo,
} from "./audio-store.ts";
import { familyForLayer } from "./capstone-sessions.ts";
import { LearnerTime, newId, type ServiceContext } from "./context.ts";
import { checkLineage } from "./lineage.ts";
import { evidenceWeight, type MasteryService } from "./mastery.ts";
import type { StreakService } from "./streak.ts";

type VersionInput = Omit<SketchVersion, "sketchId" | "version" | "createdAt"> & {
  ranOk: boolean;
  sessionId: string | null;
};

/** Events of hidden pattern code for the Transcribe player, computed by the server grader. */
/** The stage a transcription version answers: L3 (bass, quality, rn) or L6 (bass, changes, melody). */
export type TranscriptionVersionStage = NonNullable<TranscriptionVersionRow["stage"]>;

/** Events of hidden pattern code over `bars` cycles, read in the song's meter (default 4/4). */
export type PatternStimulus = (
  code: string,
  bars: number,
  meter?: string,
) => Promise<TranscriptionDetail["stimulus"]>;
/**
 * A ladder piece (`@oak/drills` `generateLadderPiece`), behind a seam because it may be unfinished. `completed`
 * (lesson IDs) turns on the generator's later vocabulary (a pickup from U07.L08).
 */
export type LadderGenerator = (
  level: number,
  realism: number,
  seed: number,
  opts?: { completed?: ReadonlySet<string> },
) => LadderPiece;

export interface LibraryDeps {
  streak: StreakService;
  /** Wave 4: own-audio checklists are self-reported evidence (weight 0.3, contracts §6.12). */
  mastery?: MasteryService;
  store: AudioStore;
  stimulus?: PatternStimulus;
  ladder?: LadderGenerator;
}

/** A project as the browser sees it: never the hidden code or the stored ladder item (contracts §11.11). */
export function publicTranscription(t: StoredTranscription): Transcription {
  const { hiddenCode: _h, ladder: _l, ...out } = t;
  return out;
}

export class LibraryService {
  readonly time: LearnerTime;
  readonly #stimulusCache = new Map<string, NonNullable<TranscriptionDetail["stimulus"]>>();
  constructor(
    private readonly ctx: ServiceContext,
    private readonly d: LibraryDeps,
  ) {
    this.time = new LearnerTime(ctx);
  }
  get #repos() {
    return this.ctx.repos;
  }

  // --- sketches ---------------------------------------------------------------------------------

  sketches(filter: { origin?: Sketch["originKind"]; archived?: boolean }): Sketch[] {
    return this.#repos.sketches.list(filter);
  }
  sketch(id: string): SketchDetail {
    const s = this.#repos.sketches.get(id);
    if (s === null) throw notFound(`sketch ${id}`);
    return { ...s, versions: this.#repos.sketches.versions(id) };
  }

  /**
   * `GET /lessons/:id/sketch` (d15): the newest unarchived Make sketch of a lesson with its versions, for a Make that
   * builds on it ("your blues"); `sketch: null` when the learner saved none. 404 for an unknown lesson id.
   */
  lessonSketch(lessonId: string): LessonSketch {
    if (this.ctx.content.lessonSite(lessonId) === null) throw notFound(`lesson ${lessonId}`);
    const mine = this.#repos.sketches
      .list({ origin: "lesson-make", archived: false })
      .filter((x) => x.originId === lessonId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt));
    const newest = mine[0];
    return {
      lessonId: lessonId as LessonSketch["lessonId"],
      sketch: newest === undefined ? null : this.sketch(newest.id),
    };
  }

  #version(sketchId: string, version: number, v: VersionInput, at: string): SketchVersion {
    return {
      sketchId,
      version,
      code: v.code,
      bpm: v.bpm,
      meter: v.meter,
      key: v.key,
      analysis: v.analysis,
      note: v.note,
      tutorAssisted: v.tutorAssisted,
      band: v.band,
      flags: v.flags,
      createdAt: at,
      // Oak 2.0 (contracts §13): a jam Run is a take; a sibling or next generation names its lineage. Absent = null.
      takeState: v.takeState ?? null,
      parentVersion: v.parentVersion ?? null,
      generation: v.generation ?? null,
      dimension: v.dimension ?? null,
    };
  }

  createSketch(
    body: VersionInput & { title: string; originKind: Sketch["originKind"]; originId: string | null },
  ): SketchSaved {
    const id = newId("sk");
    tx(this.#repos.db, () => {
      const at = this.time.iso();
      this.#repos.sketches.insert({
        id,
        title: body.title,
        originKind: body.originKind,
        originId: body.originId,
        currentVersion: 1,
        tags: [],
        archived: false,
        listeningNote: null,
        createdAt: at,
        updatedAt: at,
      });
      this.#repos.sketches.insertVersion(this.#version(id, 1, body, at));
      if (body.ranOk) this.d.streak.qualify("sketch");
    });
    return { sketch: this.sketch(id), streak: this.d.streak.summary() };
  }

  addSketchVersion(id: string, body: VersionInput): SketchSaved {
    tx(this.#repos.db, () => {
      const s = this.#repos.sketches.get(id);
      if (s === null) throw notFound(`sketch ${id}`);
      checkLineage(this.#repos.sketches.versions(id), body);
      this.#repos.sketches.insertVersion(this.#version(id, s.currentVersion + 1, body, this.time.iso()));
      if (body.ranOk) this.d.streak.qualify("sketch");
    });
    return { sketch: this.sketch(id), streak: this.d.streak.summary() };
  }

  patchSketch(
    id: string,
    patch: {
      title?: string;
      tags?: string[];
      archived?: boolean;
      listeningNote?: string | null;
      committed?: NonNullable<Sketch["committed"]>;
      cards?: NonNullable<Sketch["cards"]>;
    },
  ): Sketch {
    if (this.#repos.sketches.get(id) === null) throw notFound(`sketch ${id}`);
    this.#repos.sketches.patch(id, patch, this.time.iso());
    return this.#repos.sketches.get(id) as Sketch;
  }

  /**
   * Oak 2.0 S3 (`sketches.patchVersion`): keep or cut a jam take, or clear the mark. Cut hides it in the app; the
   * version is never deleted. 404 for an unknown sketch or version.
   */
  patchSketchVersion(id: string, version: number, takeState: TakeState | null): SketchVersion {
    if (takeState !== null && !(TAKE_STATES as readonly string[]).includes(takeState))
      throw badRequest(`takeState must be one of ${TAKE_STATES.join(", ")} or null`);
    if (this.#repos.sketches.get(id) === null) throw notFound(`sketch ${id}`);
    if (!this.#repos.sketches.setTakeState(id, version, takeState))
      throw notFound(`sketch ${id} version ${version}`);
    return this.#repos.sketches.version(id, version) as SketchVersion;
  }

  deleteSketch(id: string): void {
    if (!this.#repos.sketches.delete(id)) throw notFound(`sketch ${id}`);
  }

  // --- album ------------------------------------------------------------------------------------

  /**
   * `GET /album`. Wave 7 (wave7.md §5.5): with the two sides of the record, released and total per side. Oak 2.0 W4
   * F6: shelved tracks are listed under `shelf`, never under `tracks`; a shelved capstone track still counts in its
   * side's `released` (a piece on the Shelf counts as finished, PLAN §10 call 1).
   */
  album(): Album {
    const all = this.#repos.album.tracks();
    const sides = ALBUM_SIDES.map((side) => {
      const caps = new Set<string>(side.capstones);
      return {
        side: side.side,
        title: side.title,
        released: all.filter((t) => t.capstoneId !== null && caps.has(t.capstoneId)).length,
        total: side.capstones.length,
      };
    });
    return {
      tracks: all.filter((t) => t.shelved !== true),
      shelf: all.filter((t) => t.shelved === true),
      sides,
    };
  }

  /**
   * `PATCH /album/tracks/:id` (Oak 2.0 W4 F6): put a track on the Shelf (`shelved: true`) or back on the album.
   * Nothing else changes: the track keeps every version and take, a capstone stays released. `{}` changes nothing.
   */
  patchTrack(id: string, body: TrackPatch): AlbumTrackDetail {
    tx(this.#repos.db, () => {
      if (this.#repos.album.track(id) === null) throw notFound(`track ${id}`);
      if (body.shelved !== undefined) this.#repos.album.setShelved(id, body.shelved);
    });
    return this.track(id);
  }

  /**
   * `GET /album/tracks/:id/versions/:v/source` (carry f2; wave7.md §5.5): exactly what a released version plays —
   * the sketch version it was released from, the Band setting and the key it was released with, the parts muted —
   * and a safe file name for the WAV the app renders offline. Nothing is stored.
   */
  albumSource(trackId: string, version: number): AlbumSource {
    const track = this.#repos.album.track(trackId);
    if (track === null) throw notFound(`track ${trackId}`);
    const v = this.#repos.album.version(trackId, version);
    if (v === null) throw notFound(`track ${trackId} v${version}`);
    // A released unit song (spec 2026-11-24 §5.4): the version plays its frozen snapshot (`songs.snapshot`), never
    // the newest take's code alone; `code` stays that take's for older readers. The snapshot's codes are
    // strict-linted by the app when it is flagged for review (a failing take falls back to Oak, not the export).
    const songRelease = this.#repos.unitSongs.releaseOfAlbumVersion(trackId, version);
    const sk = this.#repos.sketches.version(v.sketchId, v.sketchVersion);
    let code: string;
    let flagged: boolean;
    if (songRelease === null) {
      if (sk === null) throw notFound(`sketch ${v.sketchId} v${v.sketchVersion}`);
      code = sk.code;
      flagged = sk.flags.reviewBeforeRun === true || v.flags.reviewBeforeRun === true;
    } else {
      // The snapshot holds every take's code, so the version stays exportable after the learner deletes the newest
      // take's sketch: `code` is then that take's code as the release froze it.
      const rel = this.#repos.unitSongs.release(songRelease.unitId, songRelease.releaseId);
      const frozen = rel?.takes.at(-1) as { code?: unknown } | undefined;
      code = sk?.code ?? (typeof frozen?.code === "string" ? frozen.code : "");
      flagged =
        sk?.flags.reviewBeforeRun === true ||
        v.flags.reviewBeforeRun === true ||
        rel?.reviewBeforeRun === true;
    }
    // Code from an imported backup runs only after the strict lint (contracts §11.3, §11.10). The offline
    // renderer reads this code with the base lint only, so a version that fails it is not handed out at all: refused
    // for a capstone or loop version, and `code` left empty for a song version (it plays from its snapshot, which the
    // app strict-lints).
    if (flagged && lintStrict(code).some((d) => d.severity === "error")) {
      if (songRelease === null)
        throw conflict(
          "This version came from an imported backup and its code does not pass Oak's safety check, so it cannot be exported.",
        );
      code = "";
    }
    const band = v.band ?? sk?.band ?? null;
    const mutes: Record<string, boolean> = {};
    for (const m of band?.mutes ?? []) mutes[m] = true;
    const slug = track.title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    const side = track.side === "Bside" ? "b-sides" : `side-${track.side.toLowerCase()}`;
    const no = String(Math.max(0, track.trackNo)).padStart(2, "0");
    return {
      trackId,
      version,
      title: track.title,
      code,
      band,
      key: sk?.key ?? null,
      mutes,
      fileName: `oak-${side}-${no}${slug === "" ? "" : `-${slug}`}-v${version}`,
      ...(songRelease === null ? {} : { songRelease }),
    };
  }
  track(id: string): AlbumTrackDetail {
    const t = this.#repos.album.track(id);
    if (t === null) throw notFound(`track ${id}`);
    return { ...t, versions: this.#repos.album.versions(id).map((v) => this.#withTakes(v)) };
  }

  /**
   * Wave 6 (d20): a version with every recording of it, oldest first, and the one that plays by default. The
   * version's `hasAudio`, `audioMime` and `durationS` describe that take.
   */
  #withTakes(v: AlbumTrackVersion): AlbumTrackVersion {
    const takes = this.#repos.takes.of(v.trackId, v.version).map((t) => {
      let bytes = t.bytes;
      if (bytes === 0) {
        try {
          bytes = statSync(this.d.store.resolveStored(t.audioPath)).size;
        } catch {
          bytes = 0;
        }
      }
      return {
        take: t.take,
        audioMime: t.audioMime,
        durationS: t.durationS,
        bytes,
        recordedAt: t.recordedAt,
      };
    });
    return { ...v, takes, currentTake: this.#repos.takes.currentTake(v.trackId, v.version) };
  }
  /** Whether a stored recording holds exactly `bytes` (a missing or unreadable file is not the same). */
  #sameBytes(stored: string, bytes: Uint8Array): boolean {
    try {
      return Buffer.from(readFileSync(this.d.store.resolveStored(stored))).equals(Buffer.from(bytes));
    } catch {
      return false;
    }
  }

  #versionWithTakes(id: string, version: number): AlbumTrackVersion {
    return this.#withTakes(this.#repos.album.version(id, version) as AlbumTrackVersion);
  }

  #trackVersion(
    trackId: string,
    version: number,
    body: {
      sketchId: string;
      sketchVersion: number;
      linerNotesMd: string;
      theoryTags: string[];
      attribution: string | null;
      includeReviewNote?: boolean;
    },
  ): AlbumTrackVersion {
    const sv = this.#repos.sketches.version(body.sketchId, body.sketchVersion);
    if (sv === null) throw notFound(`sketch ${body.sketchId} v${body.sketchVersion}`);
    return {
      trackId,
      version,
      sketchId: body.sketchId,
      sketchVersion: body.sketchVersion,
      hasAudio: false,
      audioMime: null,
      durationS: null,
      linerNotesMd: body.linerNotesMd,
      theoryTags: body.theoryTags,
      review: null,
      tutorAssisted: sv.tutorAssisted,
      attribution: body.attribution,
      band: sv.band,
      flags: sv.flags,
      createdAt: this.time.iso(),
      ...(body.includeReviewNote === undefined ? {} : { includeReviewNote: body.includeReviewNote }),
    };
  }

  createTrack(body: {
    capstoneId: AlbumTrackDetail["capstoneId"];
    side: AlbumTrackDetail["side"];
    title: string;
    flavour: AlbumTrackDetail["flavour"];
    sketchId: string;
    sketchVersion: number;
    linerNotesMd: string;
    theoryTags: string[];
    attribution: string | null;
    includeReviewNote?: boolean;
    /** Oak 2.0 W4 F6: create the track on the Shelf (absent = on the album). */
    shelved?: boolean | undefined;
  }): AlbumTrackDetail {
    const id = newId("trk");
    tx(this.#repos.db, () => {
      if (body.capstoneId !== null) {
        if (this.ctx.content.capstoneMeta(body.capstoneId) === null)
          throw notFound(`capstone ${body.capstoneId}`);
        if (this.#repos.album.trackOfCapstone(body.capstoneId) !== null)
          throw conflict("this capstone already has a track; add a version to it");
      } else if (body.side !== "Bside") throw badRequest("a track without a capstone is a B-side");
      const version = this.#trackVersion(id, 1, body);
      this.#repos.album.insertTrack({
        id,
        capstoneId: body.capstoneId,
        sketchId: body.capstoneId === null ? body.sketchId : null,
        side: body.side,
        trackNo: this.#repos.album.nextTrackNo(body.side),
        title: body.title,
        flavour: body.flavour,
        currentVersion: 1,
        coverSeed: sha256(new TextEncoder().encode(`${id}:${body.title}`)).slice(0, 16),
        createdAt: version.createdAt,
        shelved: body.shelved === true,
      });
      this.#repos.album.insertVersion(version);
      if (body.capstoneId !== null) {
        const row = this.#repos.capstones.get(body.capstoneId);
        if (row !== null) this.#repos.capstones.save({ ...row, trackId: id, updatedAt: version.createdAt });
      }
    });
    return this.track(id);
  }

  addTrackVersion(
    id: string,
    body: {
      sketchId: string;
      sketchVersion: number;
      linerNotesMd: string;
      theoryTags: string[];
      attribution: string | null;
      includeReviewNote?: boolean;
    },
  ): AlbumTrackDetail {
    tx(this.#repos.db, () => {
      const t = this.#repos.album.track(id);
      if (t === null) throw notFound(`track ${id}`);
      this.#repos.album.insertVersion(this.#trackVersion(id, t.currentVersion + 1, body));
    });
    return this.track(id);
  }

  /**
   * `PUT /album/tracks/:id/versions/:v/audio`: the first recording of a version. Wave 6 (d20): on a version that
   * already has one it is another take (nothing is replaced, nothing is deleted).
   */
  putTrackAudio(
    id: string,
    version: number,
    bytes: Uint8Array,
    declaredMime: string,
    durationS: number | null,
  ): AlbumTrackVersion {
    return this.addTrackTake(id, version, bytes, declaredMime, durationS);
  }

  /**
   * `POST /album/tracks/:id/versions/:v/takes` (d20): one more recording of a version. It becomes the take that plays
   * by default; every earlier take stays on disk, in the history and in backups.
   */
  addTrackTake(
    id: string,
    version: number,
    bytes: Uint8Array,
    _declaredMime: string,
    durationS: number | null,
  ): AlbumTrackVersion {
    const v = this.#repos.album.version(id, version);
    if (v === null) throw notFound(`track ${id} v${version}`);
    if (bytes.length === 0) throw badRequest("empty upload");
    if (bytes.length > MAX_AUDIO_BYTES) throw new ApiError("payload_too_large", "audio file too large");
    const sniffed = sniffAudio(bytes);
    if (sniffed === null) throw badRequest("not an audio file this app can store");
    const ext = extFor(sniffed, "");
    const duration = durationS ?? wavInfo(bytes).durationS;
    tx(this.#repos.db, () => {
      const takes = this.#repos.takes.of(id, version);
      // A retried upload (the same bytes again, a lost response, a double click) is the take it already made, not
      // another one: only a new recording is a new take (d20; review:robustness, Wave 6).
      const last = takes.at(-1);
      if (last && last.bytes === bytes.length && this.#sameBytes(last.audioPath, bytes)) {
        this.#repos.takes.setCurrent(last);
        return;
      }
      const take = (takes.at(-1)?.take ?? 0) + 1;
      const abs = this.d.store.albumTakePath(id, version, take, ext);
      this.d.store.write(abs, bytes);
      const row = {
        trackId: id,
        version,
        take,
        audioPath: this.d.store.storedName(abs),
        audioMime: mimeFor(ext, sniffed),
        durationS: duration,
        bytes: bytes.length,
        recordedAt: this.time.iso(),
      };
      this.#repos.takes.insert(row);
      this.#repos.takes.setCurrent(row);
    });
    return this.#versionWithTakes(id, version);
  }

  /** `PUT /album/tracks/:id/versions/:v/take` (d20): the take that plays by default and is exported. */
  chooseTrackTake(id: string, version: number, take: number): AlbumTrackVersion {
    if (this.#repos.album.version(id, version) === null) throw notFound(`track ${id} v${version}`);
    const row = this.#repos.takes.get(id, version, take);
    if (row === null) throw notFound(`take ${take} of track ${id} v${version}`);
    this.#repos.takes.setCurrent(row);
    return this.#versionWithTakes(id, version);
  }

  /** The audio of a version: its current take, or take `take` (d20). */
  trackAudio(id: string, version: number, take: number | null = null): { abs: string; mime: string } {
    const what = `audio of track ${id} v${version}${take === null ? "" : ` take ${take}`}`;
    let a: { path: string; mime: string } | null;
    if (take === null) a = this.#repos.album.audioOf(id, version);
    else {
      const row = this.#repos.takes.get(id, version, take);
      a = row === null ? null : { path: row.audioPath, mime: row.audioMime };
    }
    if (a === null) throw notFound(what);
    const abs = this.d.store.resolveStored(a.path);
    if (!this.d.store.exists(abs)) throw notFound(what);
    return { abs, mime: a.mime };
  }

  deleteTrack(id: string): void {
    tx(this.#repos.db, () => {
      const t = this.#repos.album.track(id);
      if (t === null) throw notFound(`track ${id}`);
      this.#repos.album.deleteTrack(id);
      if (t.capstoneId !== null) {
        const row = this.#repos.capstones.get(t.capstoneId);
        if (row !== null && row.trackId === id)
          this.#repos.capstones.save({ ...row, trackId: null, updatedAt: this.time.iso() });
      }
    });
    this.d.store.removeDir(id);
  }

  /**
   * An accepted capstone review lands on the capstone's track (contracts §10.6): on the version the review was
   * about when the turn named one (`albumTrackId` + `albumVersion`, Wave 4), else the latest version.
   */
  saveCapstoneReview(
    capstoneId: string,
    review: unknown,
    opts: { trackId?: string; version?: number; conversationId?: string } = {},
  ): boolean {
    const t = this.#repos.album.trackOfCapstone(capstoneId);
    if (t === null) return false;
    if (opts.trackId !== undefined && opts.trackId !== t.id) return false;
    const version = opts.version ?? t.currentVersion;
    if (this.#repos.album.version(t.id, version) === null) return false;
    this.#repos.album.setReview(t.id, version, review, opts.conversationId ?? null);
    return true;
  }

  /** `PATCH /album/tracks/:id/versions/:v` (Wave 4): edit the liner notes; choose whether the review's note shows. */
  patchTrackVersion(
    id: string,
    version: number,
    patch: { linerNotesMd?: string; includeReviewNote?: boolean },
  ): AlbumTrackVersion {
    return tx(this.#repos.db, () => {
      if (this.#repos.album.version(id, version) === null) throw notFound(`track ${id} v${version}`);
      this.#repos.album.patchVersion(id, version, patch);
      return this.#versionWithTakes(id, version);
    });
  }

  /**
   * `PUT /album/tracks/:id/versions/:v/review` (Wave 4): attach a submitted capstone review to a version. The review
   * must come from a `review` conversation about this track's capstone, and be one that conversation accepted.
   */
  attachTrackReview(
    id: string,
    version: number,
    body: { conversationId: string; review: unknown; includeReviewNote: boolean },
  ): AlbumTrackVersion {
    return tx(this.#repos.db, () => {
      const t = this.#repos.album.track(id);
      if (t === null) throw notFound(`track ${id}`);
      if (this.#repos.album.version(id, version) === null) throw notFound(`track ${id} v${version}`);
      const conv = this.#repos.tutor.conversation(body.conversationId);
      if (conv === null) throw notFound(`conversation ${body.conversationId}`);
      if (
        conv.key.lane !== "review" ||
        conv.key.subjectKind !== "capstone" ||
        conv.key.subjectId !== t.capstoneId
      )
        throw conflict("that conversation is not a review of this track's capstone");
      const submitted = this.#repos.tutor.reviewsOfConversation(body.conversationId);
      const same = submitted.some((r) => stableJson(r) === stableJson(body.review));
      if (!same) throw conflict("that review was not submitted in that conversation");
      this.#repos.album.setReview(id, version, body.review, body.conversationId);
      this.#repos.album.patchVersion(id, version, { includeReviewNote: body.includeReviewNote });
      return this.#versionWithTakes(id, version);
    });
  }

  // --- audio files ------------------------------------------------------------------------------

  audioList(): AudioFile[] {
    return this.#repos.audio.list().map(({ storedPath: _s, peaksPath: _p, ...a }) => a);
  }

  uploadAudio(name: string, bytes: Uint8Array, declaredMime: string): AudioFile {
    if (bytes.length === 0) throw badRequest("empty upload");
    if (bytes.length > MAX_AUDIO_BYTES) throw new ApiError("payload_too_large", "audio file too large");
    const sniffed = sniffAudio(bytes);
    if (sniffed === null) throw badRequest("not an audio file this app can read");
    const id = sha256(bytes);
    const existing = this.#repos.audio.get(id);
    if (existing !== null) {
      const { storedPath: _s, peaksPath: _p, ...a } = existing;
      return a;
    }
    const ext = extFor(sniffed, name);
    const abs = this.d.store.ownPath(id, ext);
    this.d.store.write(abs, bytes);
    const info = wavInfo(bytes);
    const row = {
      id,
      originalName: name,
      mime: mimeFor(ext, declaredMime || sniffed),
      bytes: bytes.length,
      durationS: info.durationS,
      sampleRate: info.sampleRate,
      channels: info.channels,
      hasPeaks: false,
      createdAt: this.time.iso(),
      storedPath: this.d.store.storedName(abs),
      peaksPath: null,
    };
    this.#repos.audio.insert(row);
    const { storedPath: _s, peaksPath: _p, ...a } = row;
    return a;
  }

  audio(id: string): { abs: string; mime: string } {
    const a = this.#repos.audio.get(id);
    if (a === null) throw notFound(`audio ${id}`);
    const abs = this.d.store.resolveStored(a.storedPath);
    if (!this.d.store.exists(abs)) throw notFound(`audio ${id}`);
    return { abs, mime: a.mime };
  }

  putPeaks(id: string, bytes: Uint8Array): void {
    const a = this.#repos.audio.get(id);
    if (a === null) throw notFound(`audio ${id}`);
    if (bytes.length === 0 || bytes.length > MAX_PEAKS_BYTES)
      throw badRequest("peaks must be 1 byte to 16 MB");
    const abs = this.d.store.peaksPath(id);
    this.d.store.write(abs, bytes);
    this.#repos.audio.setPeaks(id, this.d.store.storedName(abs));
  }

  peaks(id: string): string {
    const a = this.#repos.audio.get(id);
    if (a === null || a.peaksPath === null) throw notFound(`peaks of ${id}`);
    const abs = this.d.store.resolveStored(a.peaksPath);
    if (!this.d.store.exists(abs)) throw notFound(`peaks of ${id}`);
    return abs;
  }

  deleteAudio(id: string): void {
    const a = this.#repos.audio.get(id);
    if (a === null) throw notFound(`audio ${id}`);
    // Projects that used it keep their transcription; `audio_id` becomes NULL (ON DELETE SET NULL).
    this.#repos.audio.delete(id);
    this.d.store.remove(this.d.store.resolveStored(a.storedPath));
    if (a.peaksPath !== null) this.d.store.remove(this.d.store.resolveStored(a.peaksPath));
  }

  // --- transcriptions ---------------------------------------------------------------------------

  transcriptions(): Transcription[] {
    return this.#repos.transcriptions.list().map(publicTranscription);
  }

  async transcription(id: string): Promise<TranscriptionDetail> {
    const t = this.#repos.transcriptions.get(id);
    if (t === null) throw notFound(`transcription ${id}`);
    const { hiddenCode } = t;
    const rest = publicTranscription(t);
    const versions = this.#repos.transcriptions.versions(id).map((v) => ({
      transcriptionId: v.transcriptionId,
      version: v.version,
      code: v.code,
      createdAt: v.createdAt,
      ...(v.reviewBeforeRun === true ? { reviewBeforeRun: true as const } : {}),
    }));
    const song = t.songId === null ? undefined : this.ctx.content.source.songs.find((x) => x.id === t.songId);
    // Wave 5: a pd-song project gives the learner its pickup, feel and form (contracts §6.12; the transcribe page
    // and X1/X2 read them instead of guessing from the stimulus).
    // Wave 6: an L8 standard's form is what its first stage asks for, so it is given only once the form map passed
    // or was revealed; a tune that changes key gives its key plan (contracts §6.8).
    const formAsked =
      t.ladderLevel === 8 &&
      !this.#repos.transcriptions
        .versions(id)
        .some(
          (v) =>
            v.stage === "form" &&
            v.result !== null &&
            (v.result.status === "pass" || v.result.assist.revealed || v.result.assist.rung >= 4),
        );
    const given =
      t.sourceKind === "pd-song" && song !== undefined
        ? {
            given: {
              pickup: song.pickup ?? null,
              swing: song.swing ?? null,
              form: formAsked ? null : (song.form ?? null),
              ...(song.keyPlan === undefined ? {} : { keyPlan: song.keyPlan.map((k) => ({ ...k })) }),
            },
          }
        : {};
    return { ...rest, versions, stimulus: await this.#stimulus(t, hiddenCode), ...given };
  }

  async #stimulus(t: StoredTranscription, code: string | null): Promise<TranscriptionDetail["stimulus"]> {
    if (t.player !== "pattern" || code === null) return null;
    // A generated ladder item carries its stimulus (Wave 4): a restart needs no grader to play it.
    const stored = t.ladder?.stimulus;
    if (stored !== undefined && stored !== null)
      return stored as NonNullable<TranscriptionDetail["stimulus"]>;
    const key = `${t.id}:${sha256(new TextEncoder().encode(code))}`;
    const cached = this.#stimulusCache.get(key);
    if (cached !== undefined) return cached;
    if (this.d.stimulus === undefined) return null;
    const song = t.songId === null ? null : this.ctx.content.source.songs.find((s) => s.id === t.songId);
    // With a pickup the code's first cycle is the pickup bar: the stimulus spans one cycle more than the bars.
    const bars =
      song === undefined || song === null ? 8 : song.answerKey.bars + (song.pickup === undefined ? 0 : 1);
    try {
      const s = await this.d.stimulus(code, bars, song?.meter ?? t.meter ?? "4/4");
      if (s !== null) this.#stimulusCache.set(key, s);
      return s;
    } catch {
      return null;
    }
  }

  createTranscription(body: {
    sourceKind: Transcription["sourceKind"];
    audioId: string | null;
    songId: string | null;
    title: string;
    artist: string | null;
    ladderLevel: number | null;
    templateId: string | null;
  }): Promise<TranscriptionDetail> {
    const id = newId("tr");
    const at = this.time.iso();
    const base: StoredTranscription = {
      id,
      sourceKind: body.sourceKind,
      player: body.sourceKind === "own-audio" ? "audio" : "pattern",
      audioId: null,
      songId: null,
      title: body.title,
      artist: body.artist,
      key: null,
      bpm: null,
      meter: null,
      downbeatS: null,
      fineTuneCents: 0,
      ladderLevel: null,
      realism: null,
      regions: [],
      checklist: {},
      selfScore: null,
      currentVersion: 0,
      status: "in_progress",
      review: null,
      createdAt: at,
      updatedAt: at,
      hiddenCode: null,
    };
    if (body.sourceKind === "own-audio") {
      if (body.audioId === null || this.#repos.audio.get(body.audioId) === null)
        throw notFound(`audio ${body.audioId ?? ""}`);
      base.audioId = body.audioId;
    } else if (body.sourceKind === "pd-song") {
      const song = this.ctx.content.source.songs.find((s) => s.id === body.songId);
      if (song === undefined) throw notFound(`song ${body.songId ?? ""}`);
      // A song whose answer key no human has checked against its cited edition is never offered: grading a
      // transcription against an unchecked key could mark the learner's right notes wrong.
      if (/^pending\b/i.test(song.verifiedBy))
        throw conflict(`${song.title} is not available yet: its answer key has not been checked`);
      Object.assign(base, {
        songId: song.id,
        key: song.key,
        bpm: song.bpm,
        meter: song.meter,
        hiddenCode: song.answerKey.code,
        ladderLevel: body.ladderLevel,
      });
    } else {
      if (this.d.ladder === undefined)
        throw new ApiError("unavailable", "the ladder generator is not available yet");
      const level = body.ladderLevel ?? 1;
      const seed = Number.parseInt(sha256(new TextEncoder().encode(id)).slice(0, 8), 16);
      const piece = this.d.ladder(level, 0, seed);
      Object.assign(base, {
        ladderLevel: level,
        realism: 0,
        hiddenCode: piece.code,
        bpm: Math.round(piece.cps * 60 * 4),
      });
      this.#stimulusCache.set(`${id}:${sha256(new TextEncoder().encode(piece.code))}`, {
        events: piece.events,
        cps: piece.cps,
        bars: piece.bars,
        preload: piece.preload,
      });
    }
    if (body.templateId !== null) base.regions = [];
    this.#repos.transcriptions.insert(base);
    return this.transcription(id);
  }

  patchTranscription(id: string, patch: Partial<Omit<Transcription, "id">>): Transcription {
    const t = this.#repos.transcriptions.get(id);
    if (t === null) throw notFound(`transcription ${id}`);
    // Wave 5: the own-audio feel lives in the player settings (`settings.swing`); the patch field is a shorthand.
    const { swing, ...rest } = patch as typeof patch & { swing?: TranscriptionSettings["swing"] };
    const next: StoredTranscription = {
      ...t,
      ...rest,
      ...(swing === undefined
        ? {}
        : {
            settings: {
              ...DEFAULT_TRANSCRIPTION_SETTINGS,
              ...(t.settings ?? { fineTuneCents: t.fineTuneCents }),
              swing,
            },
          }),
      id,
      hiddenCode: t.hiddenCode,
      updatedAt: this.time.iso(),
    };
    tx(this.#repos.db, () => {
      this.#repos.transcriptions.update(next);
      if (t.sourceKind === "own-audio" && patch.checklist !== undefined)
        this.#selfEvidence(id, t.checklist, patch.checklist);
    });
    return publicTranscription(next);
  }

  /**
   * An own-audio project is graded by the learner (`grading.mode: 'self'`, contracts §6.12): each checklist item
   * set or changed (0–2) is evidence at weight 0.3, flagged self-reported by its source kind, for the skills of the
   * layer it describes (contour, rhythm and landing: the melody; bass; chords).
   */
  #selfEvidence(id: string, before: Record<string, number>, after: Record<string, number>): void {
    if (this.d.mastery === undefined) return;
    // c11: checklist toggles are self-reported evidence at most once per project per learner day.
    if (this.#repos.mastery.hasEvidenceOn("self-transcription", `${id}/`, this.time.day())) return;
    const LAYER: Record<string, "melody" | "bass" | "chords" | "form"> = {
      contour: "melody",
      rhythm: "melody",
      landing: "melody",
      bass: "bass",
      chords: "chords",
      // Wave 6: the form row of the full-arrangement checklist (OWN_AUDIO_FORM_ROW).
      form: "form",
    };
    const items: Parameters<MasteryService["addEvidence"]>[0][number][] = [];
    for (const [item, value] of Object.entries(after)) {
      const layer = LAYER[item];
      if (layer === undefined || before[item] === value || !Number.isFinite(value)) continue;
      const fam = familyForLayer(this.ctx.content, layer);
      for (const skillId of new Set(fam?.skills.map((x) => skillOf(x.skill)) ?? []))
        items.push({
          skillId: skillId as never,
          category: null,
          score: Math.max(0, Math.min(1, value / 2)),
          weight: evidenceWeight("self-transcription"),
          sourceKind: "self-transcription",
          sourceId: `${id}/${item}`,
        });
    }
    if (items.length > 0) this.d.mastery.addEvidence(items);
  }

  /**
   * `PUT /transcriptions/:id/settings` (Wave 4): the player's rate, transposition, fine-tune and A–B loop, and the
   * learner's notes. A pattern source has no fine-tune (contracts §6.12), so it stays 0 there.
   */
  putTranscriptionSettings(id: string, patch: Partial<TranscriptionSettings>): Transcription {
    return tx(this.#repos.db, () => {
      const t = this.#repos.transcriptions.get(id);
      if (t === null) throw notFound(`transcription ${id}`);
      const settings: TranscriptionSettings = {
        ...DEFAULT_TRANSCRIPTION_SETTINGS,
        ...(t.settings ?? { fineTuneCents: t.fineTuneCents }),
        ...patch,
      };
      if (t.player === "pattern") settings.fineTuneCents = 0;
      if (settings.loop !== null && settings.loop.endS <= settings.loop.startS)
        throw badRequest("the loop must end after it starts");
      const next: StoredTranscription = {
        ...t,
        settings,
        fineTuneCents: settings.fineTuneCents,
        updatedAt: this.time.iso(),
      };
      this.#repos.transcriptions.update(next);
      return publicTranscription(next);
    });
  }

  addTranscriptionVersion(
    id: string,
    body: {
      code: string;
      result: GradeResult | null;
      ranOk: boolean;
      machineDraft?: boolean;
      stage?: TranscriptionVersionStage | null;
      phrase?: number | null;
    },
  ): Promise<TranscriptionDetail> {
    this.saveTranscriptionVersion(id, body);
    return this.transcription(id);
  }

  /** One version, in the caller's transaction or its own. Returns the version number. */
  saveTranscriptionVersion(
    id: string,
    body: {
      code: string;
      result: GradeResult | null;
      ranOk: boolean;
      machineDraft?: boolean;
      stage?: TranscriptionVersionStage | null;
      phrase?: number | null;
    },
  ): number {
    return tx(this.#repos.db, () => {
      const t = this.#repos.transcriptions.get(id);
      if (t === null) throw notFound(`transcription ${id}`);
      const at = this.time.iso();
      const version = t.currentVersion + 1;
      // A machine draft ("Hum it, Oak drafts it", contracts §6.12) is stored without its grade: it gives no evidence
      // and no pass until the learner's corrected version is checked.
      const machineDraft = body.machineDraft === true;
      this.#repos.transcriptions.insertVersion({
        transcriptionId: id,
        version,
        code: body.code,
        result: machineDraft ? null : body.result,
        createdAt: at,
        machineDraft,
        stage: body.stage ?? null,
        phrase: body.phrase ?? null,
      });
      this.#repos.transcriptions.update({ ...t, currentVersion: version, updatedAt: at });
      // The saved transcription version is the gym day's Make (contracts §9.1) and a sketch for the streak.
      if (body.ranOk && !machineDraft) this.d.streak.qualify("sketch");
      return version;
    });
  }

  deleteTranscription(id: string): void {
    if (!this.#repos.transcriptions.delete(id)) throw notFound(`transcription ${id}`);
  }

  /**
   * An accepted transcription review. Wave 5 (c11): the version it was asked about (the request's
   * `transcriptionVersion`, else the version current when it was given) is recorded for `ReviewRecord.version`.
   */
  saveTranscriptionReview(
    id: string,
    review: unknown,
    asked: { conversationId?: string; version?: number | null } = {},
  ): boolean {
    const t = this.#repos.transcriptions.get(id);
    if (t === null) return false;
    const at = this.time.iso();
    tx(this.#repos.db, () => {
      this.#repos.transcriptions.update({ ...t, review, updatedAt: at });
      if (asked.conversationId !== undefined)
        this.#repos.transcriptions.addReviewVersion({
          conversationId: asked.conversationId,
          transcriptionId: id,
          version: asked.version ?? (t.currentVersion > 0 ? t.currentVersion : null),
          at,
        });
    });
    return true;
  }

  /**
   * `POST /transcriptions/:id/versions/:v/confirm` (c2, contracts §11.3): the learner read an imported version, the
   * browser's strict lint passed, and they run it as theirs. The server lints it strictly again (400 naming the
   * first finding); a version without the flag is refused (409).
   */
  confirmTranscriptionVersion(id: string, version: number): TranscriptionVersion {
    return tx(this.#repos.db, () => {
      if (this.#repos.transcriptions.get(id) === null) throw notFound(`transcription ${id}`);
      const v = this.#repos.transcriptions.versions(id).find((x) => x.version === version);
      if (v === undefined) throw notFound(`transcription ${id} v${version}`);
      if (v.reviewBeforeRun !== true) throw conflict("this version was typed here; it needs no confirmation");
      const findings = lintStrict(v.code).filter((d) => d.severity === "error");
      const first = findings[0];
      if (first !== undefined)
        throw badRequest(`the strict lint refuses this code: ${first.message}`, [
          { path: `code@${first.range.from}`, message: first.message },
        ]);
      this.#repos.transcriptions.confirmVersion(id, version);
      return { transcriptionId: id, version: v.version, code: v.code, createdAt: v.createdAt };
    });
  }
}

/** JSON with sorted keys, to compare two parsed values for equality. */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x !== null && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : x,
  );
}
