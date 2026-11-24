// Unit songs (docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.3–§5.6a): every unit is one song that Oak
// plays whole, each take lesson's Make takes over cells of it, and the song is released to the album as a frozen
// snapshot. The server never evaluates code: the app computes the cells a take claims (content-kit `claimsOf` over
// the evaluated code) and posts them with the take. What the server owns:
//  - the song row (style, title, status, the one-time style card), created idempotently (unit_id primary key);
//  - the takes in order (`created_at`, then `id`), each pointing at the lesson-make sketch version it plays;
//  - the backfill: a unit with completed take lessons and no takes for them gets one take per lesson from the
//    learner's latest lesson-make sketch, claiming the step's sections × declared parts (spec §5.6a); a song that
//    exists gains only the takes it lacks, placed so they never take a cell from its takes (`backfill`);
//  - releases: refused until the song's `releaseAfter` is complete; each writes a snapshot (Oak's code of the
//    flavour, the whole definition, every take with its code) and an album track version with no capstone.
// Grading is untouched: nothing here reads or writes attempts, evidence or rubric results (spec §4.1).
import type {
  UnitSongDetail,
  UnitSongPlan,
  UnitSongRelease,
  UnitSongReleaseResult,
  UnitSongSnapshot,
  UnitSongSnapshotTake,
  UnitSongSummary,
  UnitSongTake,
  UnitSongTakeCreate,
} from "@oak/api";
import {
  cellKey,
  claimsOf,
  FLAVOUR_IDS,
  type FlavourId,
  type LessonId,
  parseCellKey,
  stepSectionIds,
  type TakeoverStep,
  type TakeStep,
  type UnitId,
  type UnitSongDef,
} from "@oak/content-kit";
import { tx } from "../db/index.ts";
import type { UnitSongReleaseRow, UnitSongRow, UnitSongTakeRow } from "../db/repos/unit-songs.ts";
import { badRequest, conflict, notFound } from "../errors.ts";
import { LearnerTime, type ServiceContext } from "./context.ts";
import type { GatesService } from "./gates.ts";
import type { LibraryService } from "./library.ts";

export interface UnitSongsDeps {
  gates: GatesService;
  library: LibraryService;
  /** Dev only (config `songsAutostart`, the e2e stacks): `get` starts a song not started, in the profile's style. */
  autostart?: boolean;
}

const CELL = /^[a-z][a-z0-9-]*@[a-z][a-z0-9-]*$/;
const NOTHING_PLAYED = { parts: new Set<string>(), playsChords: false } as const;
const isFlavour = (f: string): f is FlavourId => (FLAVOUR_IDS as readonly string[]).includes(f);

/**
 * The tempo a Make's code sets (`setcpm(96/4)` → 96, the last uncommented one, as the last call wins), or `null`.
 * The server never evaluates code; Oak's convention writes the tempo as `setcpm(<bpm>/<beats per bar>)`.
 */
export function codeBpm(code: string): number | null {
  const text = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  let bpm: number | null = null;
  for (const m of text.matchAll(/\bsetcpm\(\s*(\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?\s*\)/g)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) bpm = n;
  }
  return bpm;
}

/**
 * When a backfilled take sits in the song's order (`created_at`, then `id`; a later take owns a cell it shares with
 * an earlier one). It dates from the Make it plays, so takes stay in the order the learner made them, but never at
 * or after a take the song already has that claims one of its cells: a take Oak adds later (a missing take found
 * at start-up, at a read or after a restore) only takes cells Oak was playing, and never one the learner's recorded
 * takes own. Then it is placed a millisecond before the earliest such take.
 */
export function gapTakeAt(
  madeAt: string,
  cells: readonly string[],
  held: readonly Pick<UnitSongTakeRow, "cells" | "createdAt">[],
): string {
  const mine = new Set(cells);
  let at = madeAt;
  for (const t of held)
    if (t.createdAt <= at && t.cells.some((c) => mine.has(c))) {
      const ms = Date.parse(t.createdAt);
      at = Number.isFinite(ms) ? new Date(ms - 1).toISOString() : t.createdAt;
    }
  return at;
}

/** A recorded take with the sketch version it plays (a take whose sketch the learner deleted plays nothing). */
interface LiveTake {
  row: UnitSongTakeRow;
  code: string;
  reviewBeforeRun: boolean;
}

export class UnitSongsService {
  readonly time: LearnerTime;
  #byUnit: Map<string, UnitSongDef> | null = null;
  #byLesson: Map<string, { def: UnitSongDef; step: TakeoverStep; index: number }> | null = null;

  constructor(
    private readonly ctx: ServiceContext,
    private readonly deps: UnitSongsDeps,
  ) {
    this.time = new LearnerTime(ctx);
  }

  get #repos() {
    return this.ctx.repos;
  }

  // --- content lookups ----------------------------------------------------------------------------

  #index(): void {
    if (this.#byUnit !== null) return;
    this.#byUnit = new Map();
    this.#byLesson = new Map();
    for (const def of this.ctx.content.source.unitSongs ?? []) {
      if (this.#byUnit.has(def.unit)) continue;
      this.#byUnit.set(def.unit, def);
      def.plan.forEach((step, index) => {
        if (!this.#byLesson?.has(step.lesson)) this.#byLesson?.set(step.lesson, { def, step, index });
      });
    }
  }
  /** The unit's song in the content, or `null`. */
  defOf(unitId: string): UnitSongDef | null {
    this.#index();
    return this.#byUnit?.get(unitId) ?? null;
  }
  /** The song a lesson belongs to and its step there (a take or a side step), or `null`. */
  stepOf(lessonId: string): { def: UnitSongDef; step: TakeoverStep; index: number } | null {
    this.#index();
    return this.#byLesson?.get(lessonId) ?? null;
  }
  /** A lesson or checkpoint the learner finished (a song's `releaseAfter`). */
  #done(id: string): boolean {
    if (this.ctx.content.lessonSite(id) !== null) return this.deps.gates.lessonCompleted(id);
    if (this.ctx.content.checkpointMeta(id) !== null) return this.deps.gates.checkpointPassed(id);
    return false;
  }
  #profileFlavour(): FlavourId {
    const f = this.#repos.profile.get().flavour;
    return isFlavour(f) ? f : "flavour.pop";
  }
  #unitOrder(unitId: string): number {
    const i = this.ctx.content.source.syllabus.units.findIndex((u) => u.id === unitId);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  }

  // --- reads --------------------------------------------------------------------------------------

  /** `songs.list`: the songs the learner has, in course order, without their takes. */
  list(): UnitSongSummary[] {
    return this.#repos.unitSongs
      .all()
      .sort(
        (a, b) => this.#unitOrder(a.unitId) - this.#unitOrder(b.unitId) || a.unitId.localeCompare(b.unitId),
      )
      .map((row) => {
        const def = this.defOf(row.unitId);
        const { takes, ...summary } = this.#detail(row.unitId, def, row);
        const steps =
          def === null ? null : new Set(def.plan.filter((s) => s.kind === "take").map((s) => s.lesson));
        const lessons = new Set(takes.map((t) => t.lessonId).filter((l) => steps === null || steps.has(l)));
        return { ...summary, lessonsCount: lessons.size };
      });
  }

  /** `songs.get`: the song with its takes; `status: "new"` while a song of the content has not started. */
  get(unitId: string): UnitSongDetail {
    const def = this.defOf(unitId);
    const row = this.#repos.unitSongs.get(unitId);
    if (def === null && row === null) throw notFound(`the song of ${unitId}`);
    if (def !== null && row === null && this.deps.autostart === true) return this.start(unitId, this.#profileFlavour());
    if (def === null || row === null) return this.#detail(unitId, def, row);
    // A completed take lesson whose take never landed joins the song now, not at the next start-up (see `backfill`).
    this.#fillGaps(def);
    return this.#detail(unitId, def, this.#repos.unitSongs.get(unitId));
  }

  /** `songs.snapshot`: a release exactly as it was frozen. */
  snapshot(unitId: string, releaseId: number): UnitSongSnapshot {
    const r = this.#repos.unitSongs.release(unitId, releaseId);
    if (r === null) throw notFound(`release ${releaseId} of the song of ${unitId}`);
    const def = (r.def ?? {}) as UnitSongDef;
    return {
      id: r.id,
      unitId: unitId as UnitId,
      albumTrackId: this.#repos.unitSongs.albumTrackExists(r.albumTrackId) ? r.albumTrackId : null,
      albumVersion: r.albumVersion,
      songId: r.songId as UnitSongSnapshot["songId"],
      songVersion: r.songVersion,
      flavour: isFlavour(r.flavour) ? r.flavour : this.#profileFlavour(),
      title: r.title,
      bpm: r.bpm,
      oakCode: r.oakCode,
      def,
      takes: (r.takes as UnitSongSnapshotTake[]).map((t) => ({
        ...t,
        cells: (t.cells ?? []).filter((c) => CELL.test(c)),
        labels: t.labels ?? {},
      })),
      reviewBeforeRun: r.reviewBeforeRun,
      createdAt: r.createdAt,
    };
  }

  /**
   * `SessionPlan.song` (spec §5.5): the song of a lesson Today plans, or `null` when the lesson is in no song. A song
   * the learner has not started is `new`, in Oak's title and the profile's style.
   */
  planSong(lessonId: string): UnitSongPlan | null {
    const hit = this.stepOf(lessonId);
    if (hit === null) return null;
    const { def, step, index } = hit;
    const row = this.#repos.unitSongs.get(def.unit);
    return {
      unitId: def.unit,
      songId: def.id,
      title: row?.title ?? def.title,
      flavour: row !== null && isFlavour(row.flavour) ? row.flavour : this.#profileFlavour(),
      status: row === null ? "new" : row.status,
      takesCount: row === null ? 0 : this.#liveTakes(def.unit).length,
      lessonIndex: index + 1,
      lessonsInSong: def.plan.length,
      today: step.kind === "take" ? step.today : null,
      side: step.kind === "side",
    };
  }

  // --- writes -------------------------------------------------------------------------------------

  /**
   * `songs.start` (the New song moment): creates the song in the chosen style unless it exists (a second start, from
   * another tab, returns it as it is), then records the unit's earlier Makes (the backfill of this unit).
   */
  start(unitId: string, flavour: FlavourId): UnitSongDetail {
    const def = this.#needDef(unitId);
    tx(this.#repos.db, () => {
      const created = this.#repos.unitSongs.insert({
        unitId,
        songId: def.id,
        songVersion: def.version,
        flavour,
        title: def.title,
        backfilled: false,
        styleSeen: true,
        createdAt: this.time.iso(),
      });
      // Only a song this start created gets the unit's earlier Makes; a song that exists keeps its takes (the read
      // below fills only the missing ones, see `backfill`).
      if (created) this.#backfillUnit(def, "new");
    });
    return this.get(unitId);
  }

  /** `songs.setFlavour`: the takes stay; Oak's parts switch style; every release keeps the style it was frozen in. */
  setFlavour(unitId: string, flavour: FlavourId): UnitSongDetail {
    this.#needRow(unitId);
    const def = this.defOf(unitId);
    this.#repos.unitSongs.patch(unitId, {
      flavour,
      styleSeen: true,
      ...(def === null ? {} : { songVersion: def.version }),
    });
    return this.get(unitId);
  }

  rename(unitId: string, title: string): UnitSongDetail {
    this.#needRow(unitId);
    const t = title.trim();
    if (t.length < 1 || t.length > 60) throw badRequest("a song title is 1 to 60 characters");
    this.#repos.unitSongs.patch(unitId, { title: t });
    return this.get(unitId);
  }

  /** `songs.ackStyle`: the one-time style card of a backfilled song was seen. */
  ackStyle(unitId: string): UnitSongDetail {
    this.#needRow(unitId);
    this.#repos.unitSongs.patch(unitId, { styleSeen: true });
    return this.get(unitId);
  }

  /**
   * `songs.recordTake`: a take step's Make was saved (`sketches.create`, origin `lesson-make`, this lesson). The cells
   * must lie in the step's sections and name the song's parts. A song not started yet starts in the profile's style
   * (with the unit's backfill), so no take is lost; a song that exists gains the missing takes of its other completed
   * take lessons (see `backfill`). Saving a version that already has a take refines that take (its
   * cells, labels and tempo; its place in the order stays): that is how the app replaces a backfilled take's
   * declared cells with the ones it computed, and how a second tab's save counts once.
   */
  recordTake(unitId: string, body: Omit<UnitSongTakeCreate, "idempotencyKey">): UnitSongDetail {
    const def = this.#needDef(unitId);
    const step = def.plan.find((s) => s.lesson === body.lessonId);
    if (step === undefined) throw badRequest(`${body.lessonId} is not a lesson of this song`);
    if (step.kind !== "take")
      throw badRequest(`${body.lessonId} is a side step of this song: its Make stays a sketch of its own`);
    const sketch = this.#repos.sketches.get(body.sketchId);
    if (sketch === null || this.#repos.sketches.version(body.sketchId, body.sketchVersion) === null)
      throw notFound(`sketch ${body.sketchId} v${body.sketchVersion}`);
    if (sketch.originKind !== "lesson-make" || sketch.originId !== body.lessonId)
      throw badRequest(`a take of ${body.lessonId} plays that lesson's Make sketch`);
    const cells = this.#cells(def, step, body.cells);
    const labels = this.#labels(def, body.labels);
    tx(this.#repos.db, () => {
      if (this.#repos.unitSongs.get(unitId) === null) {
        this.#repos.unitSongs.insert({
          unitId,
          songId: def.id,
          songVersion: def.version,
          flavour: this.#profileFlavour(),
          title: def.title,
          backfilled: false,
          styleSeen: false,
          createdAt: this.time.iso(),
        });
        this.#backfillUnit(def, "new", body.lessonId);
      } else this.#backfillUnit(def, "gaps", body.lessonId);
      const existing = this.#repos.unitSongs.takeOf(unitId, body.lessonId, body.sketchId, body.sketchVersion);
      if (existing !== null)
        this.#repos.unitSongs.refineTake(existing.id, { cells, labels, bpm: body.bpm, backfilled: false });
      else
        this.#repos.unitSongs.insertTake({
          unitId,
          lessonId: body.lessonId,
          sketchId: body.sketchId,
          sketchVersion: body.sketchVersion,
          cells,
          labels,
          bpm: body.bpm,
          backfilled: false,
          createdAt: this.time.iso(),
        });
      this.#repos.unitSongs.patch(unitId, { songVersion: def.version });
    });
    return this.get(unitId);
  }

  /**
   * `songs.release`: refused until the song's `releaseAfter` is complete and while it has no take. The first release
   * creates an album track with no capstone (side `Bside`, `unit_id` set); "Release again" adds a version to that
   * track. Each writes a frozen snapshot that the album version names (`song_release_id`). A retried release with
   * nothing changed since the newest one answers that one again.
   */
  release(unitId: string, title: string): UnitSongReleaseResult {
    const def = this.#needDef(unitId);
    const songs = this.#repos.unitSongs;
    const out = tx(this.#repos.db, () => {
      const row = this.#needRow(unitId);
      if (!this.#done(def.releaseAfter))
        throw conflict(`This song can be released once ${this.#title(def.releaseAfter)} is done.`);
      // The release freezes what songs.get shows: the song with every completed take lesson in it.
      this.#backfillUnit(def, "gaps");
      const takes = this.#liveTakes(unitId);
      const newest = takes.at(-1);
      if (newest === undefined) throw conflict("This song has none of your takes yet.");
      const flavour = isFlavour(row.flavour) ? row.flavour : this.#profileFlavour();
      const latest = songs.releases(unitId).at(-1);
      const alive = latest !== undefined && songs.albumTrackExists(latest.albumTrackId);
      if (latest !== undefined && alive && !this.#changedSince(latest, def, flavour, takes)) {
        songs.patch(unitId, { title });
        return { albumTrackId: latest.albumTrackId, albumVersion: latest.albumVersion, releaseId: latest.id };
      }
      const oakCode = def.code[flavour];
      if (oakCode === undefined) throw conflict(`This song has no ${flavour} arrangement.`);
      const album = {
        sketchId: newest.row.sketchId,
        sketchVersion: newest.row.sketchVersion,
        linerNotesMd: this.#linerNotes(unitId, takes),
        theoryTags: [] as string[],
        attribution: null,
      };
      let trackId: string;
      let version: number;
      if (latest !== undefined && alive) {
        trackId = latest.albumTrackId;
        version = this.deps.library.addTrackVersion(trackId, album).currentVersion;
        // The track is named and coloured as its newest release; each older snapshot keeps its own title and style.
        songs.setAlbumTrackMeta(trackId, title, flavour);
      } else {
        const track = this.deps.library.createTrack({
          capstoneId: null,
          side: "Bside",
          title,
          flavour,
          ...album,
        });
        trackId = track.id;
        version = track.currentVersion;
        songs.setAlbumUnit(trackId, unitId);
      }
      const now = this.time.iso();
      const releaseId = songs.insertRelease({
        unitId,
        albumTrackId: trackId,
        albumVersion: version,
        songId: def.id,
        songVersion: def.version,
        flavour,
        title,
        bpm: newest.row.bpm,
        oakCode,
        def,
        takes: takes.map(
          (t): UnitSongSnapshotTake => ({
            takeId: t.row.id,
            lessonId: t.row.lessonId as LessonId,
            sketchId: t.row.sketchId,
            sketchVersion: t.row.sketchVersion,
            code: t.code,
            cells: t.row.cells,
            labels: t.row.labels,
            bpm: t.row.bpm,
          }),
        ),
        // A take from an imported backup keeps its flag in the snapshot: album playback and export strict-lint every
        // code of a flagged release (contracts §11.3), as the live song does for a flagged take.
        reviewBeforeRun: takes.some((t) => t.reviewBeforeRun),
        createdAt: now,
      });
      songs.setVersionRelease(trackId, version, releaseId);
      songs.patch(unitId, {
        status: "released",
        title,
        songVersion: def.version,
        releasedAt: row.releasedAt ?? now,
      });
      return { albumTrackId: trackId, albumVersion: version, releaseId };
    });
    return { ...out, song: this.get(unitId) };
  }

  /**
   * The backfill (spec §5.6a, contracts §5.11 rules 4 and 17), at start-up and after an import of a backup from
   * before songs:
   *  - every unit with a completed take lesson and no song yet gets its song (in the profile's style, `backfilled`,
   *    style not seen yet), with one take per completed take lesson from the learner's latest lesson-make sketch;
   *  - a song that exists keeps every take it has (their rows, cells, labels, tempo and order) and gains only the
   *    takes of completed take lessons that have none at all: a Make whose `songs.recordTake` never landed (the song
   *    could not be read when the Make opened, the server refused or was down, the app closed before a retry), or a
   *    side step that a content update made a take. Such a take never takes a cell from a take the song already
   *    has (`gapTakeAt`), so a restored or established song changes only where Oak was playing. Its style, its
   *    `backfilled` flag and the one-time style card stay as they are. Release snapshots are frozen and untouched.
   * `songs.get`, `songs.recordTake` and `songs.release` run the same gap fill for their unit, so a missing take
   * comes back without a restart. Idempotent.
   */
  backfill(): { songs: number; takes: number } {
    let songs = 0;
    let takes = 0;
    this.#index();
    for (const def of this.#byUnit?.values() ?? []) {
      tx(this.#repos.db, () => {
        if (this.#repos.unitSongs.get(def.unit) !== null) {
          takes += this.#backfillUnit(def, "gaps");
          return;
        }
        takes += this.#backfillUnit(def, "create");
        if (this.#repos.unitSongs.get(def.unit) !== null) songs += 1;
      });
    }
    return { songs, takes };
  }

  // --- internals ----------------------------------------------------------------------------------

  #needDef(unitId: string): UnitSongDef {
    const def = this.defOf(unitId);
    if (def === null) throw notFound(`the song of ${unitId}`);
    return def;
  }
  #needRow(unitId: string): UnitSongRow {
    const row = this.#repos.unitSongs.get(unitId);
    if (row !== null) return row;
    if (this.defOf(unitId) === null) throw notFound(`the song of ${unitId}`);
    throw conflict("Start this song first.");
  }
  #title(id: string): string {
    return (
      this.ctx.content.lessonDef(id)?.title ??
      this.ctx.content.lessonSite(id)?.meta.title ??
      this.ctx.content.checkpointMeta(id)?.title ??
      id
    );
  }

  /** The completed take steps of a song with no take at all (a take whose sketch was deleted still counts). */
  #missingTakes(def: UnitSongDef, except?: string): TakeStep[] {
    const have = new Set(this.#repos.unitSongs.takes(def.unit).map((t) => t.lessonId));
    return def.plan.filter(
      (s): s is TakeStep =>
        s.kind === "take" &&
        s.lesson !== except &&
        !have.has(s.lesson) &&
        this.deps.gates.lessonCompleted(s.lesson),
    );
  }

  /**
   * The gap fill of a song that exists (see `backfill`), for `songs.get`: a read that finds nothing missing writes
   * nothing. Runs in its own transaction, which re-checks.
   */
  #fillGaps(def: UnitSongDef): void {
    if (this.#repos.unitSongs.get(def.unit) === null) return;
    const missing = this.#missingTakes(def);
    // A completed lesson with no Make sketch (none saved, or deleted) has nothing to add.
    if (missing.length === 0 || this.#latestMakeSketches(new Set(missing.map((s) => s.lesson))).size === 0)
      return;
    tx(this.#repos.db, () => this.#backfillUnit(def, "gaps"));
  }

  /**
   * One unit's backfill, inside the caller's transaction. Returns how many takes it added.
   *  - `create`: a unit with a completed take lesson and no song gets one (`backfilled`, style not seen yet).
   *  - `new`: the caller just created the song; a take added here marks it `backfilled`.
   *  - `gaps`: the song exists; it gains only the missing takes, and its flags stay as they are.
   * `except` is the lesson whose take the caller is recording now: it never gets a backfilled take first.
   */
  #backfillUnit(def: UnitSongDef, mode: "create" | "new" | "gaps", except?: string): number {
    const songs = this.#repos.unitSongs;
    const completed = this.#missingTakes(def, except);
    if (completed.length === 0) return 0;
    let created = false;
    if (songs.get(def.unit) === null) {
      if (mode !== "create") return 0;
      created = songs.insert({
        unitId: def.unit,
        songId: def.id,
        songVersion: def.version,
        flavour: this.#profileFlavour(),
        title: def.title,
        backfilled: true,
        styleSeen: false,
        createdAt: this.time.iso(),
      });
    }
    const held = songs.takes(def.unit);
    const sketches = this.#latestMakeSketches(new Set(completed.map((s) => s.lesson)));
    let added = 0;
    for (const step of completed) {
      const sk = sketches.get(step.lesson);
      if (sk === undefined) continue;
      const v = this.#repos.sketches.version(sk.id, sk.currentVersion);
      if (v === null) continue;
      const cells = claimsOf(def, step, NOTHING_PLAYED);
      songs.insertTake({
        unitId: def.unit,
        lessonId: step.lesson,
        sketchId: v.sketchId,
        sketchVersion: v.version,
        cells,
        labels: {},
        bpm: codeBpm(v.code) ?? (v.bpm !== null && v.bpm > 0 ? v.bpm : def.bpm),
        backfilled: true,
        createdAt: gapTakeAt(v.createdAt, cells, held),
      });
      added += 1;
    }
    // A song that existed before this call keeps its flags: the takes Oak adds to it are marked one by one.
    if (created || (added > 0 && mode !== "gaps")) songs.patch(def.unit, { backfilled: true });
    return added;
  }

  /** The learner's newest lesson-make sketch of each lesson (unarchived first), as `lessons.sketch` picks it. */
  #latestMakeSketches(lessons: ReadonlySet<string>): Map<string, { id: string; currentVersion: number }> {
    const mine = this.#repos.sketches
      .list({ origin: "lesson-make" })
      .filter((s) => s.originId !== null && lessons.has(s.originId))
      .sort(
        (a, b) =>
          Number(a.archived) - Number(b.archived) ||
          b.updatedAt.localeCompare(a.updatedAt) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    const out = new Map<string, { id: string; currentVersion: number }>();
    for (const s of mine) if (s.originId !== null && !out.has(s.originId)) out.set(s.originId, s);
    return out;
  }

  /** The takes in order with the code they play; a take whose sketch version is gone is left out. */
  #liveTakes(unitId: string): LiveTake[] {
    const out: LiveTake[] = [];
    for (const row of this.#repos.unitSongs.takes(unitId)) {
      const v = this.#repos.sketches.version(row.sketchId, row.sketchVersion);
      if (v === null) continue;
      out.push({ row, code: v.code, reviewBeforeRun: v.flags.reviewBeforeRun === true });
    }
    return out;
  }

  /**
   * Whether the song would play differently from a release: another style, another version of the song's
   * definition or of Oak's code, another take, or a take whose saved version, cells, track labels or tempo changed.
   */
  #changedSince(
    release: UnitSongReleaseRow,
    def: UnitSongDef | null,
    flavour: FlavourId,
    takes: readonly LiveTake[],
  ): boolean {
    if (release.flavour !== flavour) return true;
    if (def !== null && (release.songVersion !== def.version || release.oakCode !== def.code[flavour]))
      return true;
    const labels = (l: Readonly<Record<string, string | null>> | undefined) =>
      Object.entries(l ?? {}).sort(([a], [b]) => a.localeCompare(b));
    const then = (release.takes as Partial<UnitSongSnapshotTake>[]).map((t) => [
      t.takeId,
      t.sketchId,
      t.sketchVersion,
      t.cells ?? [],
      labels(t.labels),
      t.bpm,
    ]);
    const now = takes.map((t) => [
      t.row.id,
      t.row.sketchId,
      t.row.sketchVersion,
      t.row.cells,
      labels(t.row.labels),
      t.row.bpm,
    ]);
    return JSON.stringify(then) !== JSON.stringify(now);
  }

  #linerNotes(unitId: string, takes: readonly LiveTake[]): string {
    const lessons = new Set(takes.map((t) => t.row.lessonId)).size;
    const unit = this.ctx.content.source.syllabus.units.find((u) => u.id === unitId)?.title ?? unitId;
    return `${lessons} ${lessons === 1 ? "Make" : "Makes"} from “${unit}”, with Oak's band on the rest.`;
  }

  /** The cells of a take: real parts, in the step's sections, once each, in song order. */
  #cells(def: UnitSongDef, step: TakeStep, cells: readonly string[]): string[] {
    const sections = new Set(stepSectionIds(def, step));
    const parts = new Set(def.parts.map((p) => p.id));
    const want = new Set<string>();
    for (const c of cells) {
      const cell = parseCellKey(c);
      if (cell === null || !parts.has(cell.part)) throw badRequest(`${c} names no part of this song`);
      if (!sections.has(cell.section)) throw badRequest(`${c} is outside the sections of ${step.lesson}`);
      want.add(c);
    }
    const out: string[] = [];
    for (const s of def.sections)
      for (const p of def.parts) if (want.has(cellKey(p.id, s.id))) out.push(cellKey(p.id, s.id));
    return out;
  }

  #labels(def: UnitSongDef, labels: Readonly<Record<string, string | null>>): Record<string, string | null> {
    const parts = new Set(def.parts.map((p) => p.id));
    for (const [label, part] of Object.entries(labels))
      if (part !== null && !parts.has(part))
        throw badRequest(`track ${label}: ${part} is not a part of this song`);
    return { ...labels };
  }

  #detail(unitId: string, def: UnitSongDef | null, row: UnitSongRow | null): UnitSongDetail {
    if (row === null) {
      // A song of the content the learner has not started: Oak's title, the profile's style, nothing in it yet.
      const d = def as UnitSongDef;
      return {
        unitId: unitId as UnitId,
        songId: d.id,
        songVersion: d.version,
        contentVersion: d.version,
        flavour: this.#profileFlavour(),
        title: d.title,
        status: "new",
        changedSinceRelease: false,
        releasable: false,
        backfilled: false,
        styleSeen: false,
        takesCount: 0,
        releases: [],
        takes: [],
      };
    }
    const live = this.#liveTakes(unitId);
    const flavour = isFlavour(row.flavour) ? row.flavour : this.#profileFlavour();
    const releases = this.#repos.unitSongs.releases(unitId);
    const latest = releases.at(-1);
    const takes = live.map(
      (t): UnitSongTake => ({
        id: t.row.id,
        lessonId: t.row.lessonId as LessonId,
        sketchId: t.row.sketchId,
        sketchVersion: t.row.sketchVersion,
        code: t.code,
        cells: t.row.cells.filter((c) => CELL.test(c)),
        labels: t.row.labels,
        bpm: t.row.bpm,
        backfilled: t.row.backfilled,
        reviewBeforeRun: t.reviewBeforeRun,
        createdAt: t.row.createdAt,
      }),
    );
    return {
      unitId: unitId as UnitId,
      songId: row.songId as UnitSongDetail["songId"],
      songVersion: row.songVersion,
      contentVersion: def?.version ?? null,
      flavour,
      title: row.title,
      status: row.status,
      // A newest release whose album track the learner deleted is no longer on the album: release() makes a new track
      // for it (its `alive` rule), so the song offers "Release" again.
      changedSinceRelease:
        latest !== undefined &&
        (!this.#repos.unitSongs.albumTrackExists(latest.albumTrackId) ||
          this.#changedSince(latest, def, flavour, live)),
      releasable: def !== null && live.length > 0 && this.#done(def.releaseAfter),
      backfilled: row.backfilled,
      styleSeen: row.styleSeen,
      takesCount: live.length,
      releases: releases.map(
        (r): UnitSongRelease => ({
          id: r.id,
          albumTrackId: this.#repos.unitSongs.albumTrackExists(r.albumTrackId) ? r.albumTrackId : null,
          albumVersion: r.albumVersion,
          flavour: isFlavour(r.flavour) ? r.flavour : flavour,
          title: r.title,
          createdAt: r.createdAt,
        }),
      ),
      takes,
    };
  }
}
