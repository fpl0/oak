// The Make inside the unit song (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.3; contracts §5.11
// rules 14–15). Pure rules, no queries:
//  - which Make is a take step of a song (`songMakeOf`) and which a side step (`songSideOf`);
//  - where the editor starts (`openingCode`): the authored starter, or the learner's take of the step's `startFrom`
//    lesson, in both cases with the first `setcpm(<n>/<beats>)` set to the song's tempo when the Make accepts it;
//  - what counts as unchanged (`openingsOf`): the code the Make opened with, and Oak's copy at the song's tempo;
//  - what a saved take claims (`recordSongTake`): the saved code is evaluated once, its tracks read (drum hits by
//    sound, pitched tracks by label and role), and the cells come from the claims model (`claimsOf`);
//  - the transport's chips: today's code, "yours (from …)" and "Oak".
// Grading stays the learner's code alone (spec §4.1); only `make.unchanged` learns the opening code (grading.ts).
import {
  type CodeRange,
  claimsOf,
  drumPartsOfSound,
  type Exercise,
  LABEL_ROLES,
  type LessonId,
  type MeterId,
  OakApiError,
  type PlayedParts,
  partOfTrack,
  type SideStep,
  type SongPartId,
  type SongSectionId,
  stepSectionIds,
  type TakeStep,
  type TrackLabel,
  type UnitId,
  type UnitSongDef,
  type UnitSongDetail,
  type UnitSongTake,
  type UnitSongTakeCreate,
} from "@oak/api";
import { type EvalResult, type Normalized, normalize } from "@oak/grader";
import type { BandSetup } from "@oak/strudel";
import { sourceSectionsOf } from "@oak/strudel/song-compose";
import { songStepOf } from "../../../content/unit-songs/index.ts";
import { playableTakes, type SongView } from "../song/model.ts";

// --- which song a Make belongs to ----------------------------------------------------------------------

/** A side step's Make: today's standalone sketch over today's Band, with the reason the lesson card gives. */
export interface SongSideHost {
  kind: "side";
  def: UnitSongDef;
  reason: string;
}

/** The song side of a Make step (`StepHost.song`): a take, a side step, or a take whose song is still being read. */
export type SongStepHost = SongMakeHost | SongSideHost | { kind: "pending" };

/** Everything a take step's Make needs to play inside its song (app/src/song/hooks.ts `useSongMake`). */
export interface SongMakeHost {
  kind: "take";
  def: UnitSongDef;
  step: TakeStep;
  unitId: UnitId;
  detail: UnitSongDetail | null;
  /** The song's tempo until today's code sets one: the newest take's, else Oak's. */
  bpm: number;
  lengthBars: number;
  /** "In your song": the song with today's code live in it (`BandSetup.song`). */
  setup: BandSetup;
  /** "Today's code": the step's own Band, as Makes played before songs (`null`: no Band). */
  todays: BandSetup | null;
  /** What the editor opens with, and whose it is. */
  opening: OpeningCode;
  /** Oak's copy: the authored starter at the song's tempo ("Start from Oak's copy"). */
  oakCopy: string;
  /** The starter's marked regions, where they are in Oak's copy. */
  oakEditable: CodeRange[] | null;
  /** The opening's tempo line was set to the song's tempo (the note says so). */
  tempoSet: boolean;
  /** The learner's take of `startFrom`, at the song's tempo, when there is one. */
  own: { lessonId: LessonId; title: string; code: string } | null;
  /** The codes that count as unchanged for `make.unchanged` (`openingsOf`). */
  unchangedFrom: string[];
  /** The loop the Workbench starts with: today's first run of sections; `null` for the whole song. */
  loop: { from: number; bars: number } | null;
  /** The grid with today's cells. */
  view: SongView;
  /** The takes the song plays now (the sketch's `band.song.takeIds`). */
  takeIds: number[];
  /** A track chip's words: today's code, yours (from …), Oak. */
  chipLabel(track: string): string;
}

/** A lesson whose Make takes over cells of its unit's song. */
export interface SongMake {
  def: UnitSongDef;
  step: TakeStep;
}

/** The song and take step of a lesson, or `null` (a lesson in no song, or a side step). */
export function songMakeOf(lessonId: string): SongMake | null {
  const found = songStepOf(lessonId as LessonId);
  return found && found.step.kind === "take" ? { def: found.song, step: found.step } : null;
}

/** The song and side step of a lesson whose Make stays a sketch of its own, or `null`. */
export function songSideOf(lessonId: string): { def: UnitSongDef; step: SideStep } | null {
  const found = songStepOf(lessonId as LessonId);
  return found && found.step.kind === "side" ? { def: found.song, step: found.step } : null;
}

/**
 * The New song moment (spec §5.5) comes before a take lesson whose song the learner has not started: the server
 * answers `status: "new"` for it. A side step, or a song not read yet, never waits.
 */
export function newSongGateOf(
  step: Pick<TakeStep, "kind"> | Pick<SideStep, "kind"> | null,
  detail: Pick<UnitSongDetail, "status"> | null,
): boolean {
  return step?.kind === "take" && detail?.status === "new";
}

// --- the tempo line ----------------------------------------------------------------------------------------

const TEMPO = /^([ \t]*setcpm\(\s*)(\d+(?:\.\d+)?)(\s*\/\s*\d+\s*\))/;

/** The Make's accepted tempo range, from its rubric's `tempo-bpm` rule; `undefined` when it has none. */
export function tempoRangeOf(ex: Exercise | undefined): [number, number] | undefined {
  if (!ex || (ex.kind !== "code-make" && ex.kind !== "compose-brief")) return undefined;
  const rule = ex.rubric.find((r) => r.rule === "tempo-bpm");
  if (rule?.rule !== "tempo-bpm") return undefined;
  return [rule.min ?? 0, rule.max ?? Number.POSITIVE_INFINITY];
}

/**
 * The code with its first tempo line (`setcpm(<n>/<beats>)`, a statement of its own, comments skipped) set to `bpm`.
 * Only that number changes. Code whose first `setcpm` is another form (`setcpm(30)`), code with no tempo line, and a
 * tempo outside `allowed` (the Make's own tempo rule) are left as written.
 */
export function withSongTempo(code: string, bpm: number, allowed?: readonly [number, number]): string {
  if (!Number.isFinite(bpm) || bpm <= 0) return code;
  if (allowed && (bpm < allowed[0] || bpm > allowed[1])) return code;
  const value = String(Math.round(bpm * 100) / 100);
  let at = 0;
  for (const line of code.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed === "") {
      at += line.length + 1;
      continue;
    }
    if (!/^setcpm\s*\(/.test(trimmed)) {
      // A statement before the tempo line: the first `setcpm` is not the code's opening tempo.
      if (/\bsetcpm\s*\(/.test(line)) return code;
      at += line.length + 1;
      continue;
    }
    const m = TEMPO.exec(line);
    if (!m) return code;
    const from = at + (m[1] as string).length;
    return `${code.slice(0, from)}${value}${code.slice(from + (m[2] as string).length)}`;
  }
  return code;
}

/**
 * Ranges of `before` (a starter's marked regions) moved to where the same text is in `after`, when one stretch of the
 * text changed (the tempo number). A range that covers the change grows or shrinks with it.
 */
export function shiftRanges(ranges: readonly CodeRange[], before: string, after: string): CodeRange[] {
  if (before === after) return ranges.map((r) => ({ ...r }));
  let p = 0;
  while (p < before.length && p < after.length && before[p] === after[p]) p++;
  let s = 0;
  while (
    s < before.length - p &&
    s < after.length - p &&
    before[before.length - 1 - s] === after[after.length - 1 - s]
  )
    s++;
  const bEnd = before.length - s;
  const aEnd = after.length - s;
  const delta = after.length - before.length;
  const move = (x: number, end: boolean) => (x < p ? x : x >= bEnd ? x + delta : end ? aEnd : p);
  return ranges.map((r) => ({ ...r, from: move(r.from, false), to: move(r.to, true) }));
}

// --- where the editor starts ---------------------------------------------------------------------------

export interface OpeningCode {
  code: string;
  /** Oak's copy (the authored starter), or the lesson whose take the Make opened with. */
  source: "oak" | LessonId;
}

/** The learner's newest playable take of a lesson in the song, or `null`. */
export function newestTakeOf(detail: Pick<UnitSongDetail, "takes"> | null, lessonId: string) {
  const takes = playableTakes(detail).filter((t) => t.lessonId === lessonId);
  return takes.at(-1) ?? null;
}

/**
 * What a take step's Make opens with (spec §5.3): with `startFrom: '<lesson>'`, the learner's newest take of that
 * lesson; with `'oak'`, or when there is no such take (a skipped lesson, a song not started), the authored starter.
 * Either way the tempo line is set to the song's tempo when `allowed` takes it. Recomputed from the song every time
 * the Make opens: nothing is recorded by opening it.
 */
export function openingCode(
  step: Pick<TakeStep, "startFrom">,
  detail: Pick<UnitSongDetail, "takes"> | null,
  authoredStarter: string,
  songBpm: number,
  allowed?: readonly [number, number],
): OpeningCode {
  if (step.startFrom !== "oak") {
    const take = newestTakeOf(detail, step.startFrom);
    if (take) return { code: withSongTempo(take.code, songBpm, allowed), source: step.startFrom };
  }
  return { code: withSongTempo(authoredStarter, songBpm, allowed), source: "oak" };
}

/**
 * The codes a saved Make must differ from (`make.unchanged`, spec §5.3): what the Make opened with and Oak's copy at
 * the song's tempo ("Start from Oak's copy"). The authored starter itself the grader compares as always.
 */
export function openingsOf(
  step: Pick<TakeStep, "startFrom">,
  detail: Pick<UnitSongDetail, "takes"> | null,
  authoredStarter: string,
  songBpm: number,
  allowed?: readonly [number, number],
): string[] {
  const opening = openingCode(step, detail, authoredStarter, songBpm, allowed).code;
  const oak = withSongTempo(authoredStarter, songBpm, allowed);
  return [...new Set([opening, oak])].filter((c) => c !== authoredStarter && c.trim() !== "");
}

/**
 * The loop the Make's Workbench starts with: the first run of today's sections in song order (a 4-bar intro, two
 * choruses side by side). `null` when today's code plays the whole song.
 */
export function todayLoopOf(
  def: UnitSongDef,
  step: Pick<TakeStep, "sections">,
): { from: number; bars: number } | null {
  const today = new Set(stepSectionIds(def, step));
  if (today.size === 0 || today.size === def.sections.length) return null;
  let at = 0;
  let from = -1;
  let bars = 0;
  for (const s of def.sections) {
    if (today.has(s.id)) {
      if (from < 0) from = at;
      bars += s.bars;
    } else if (from >= 0) break;
    at += s.bars;
  }
  return from < 0 ? null : { from, bars };
}

// --- what a saved take plays and claims ---------------------------------------------------------------

/** One evaluated track, as the claims model reads it. */
export interface TrackSummary {
  label: string;
  role: "drums" | "bass" | "chords" | "melody" | null;
  /** Sound names of its hits (`bd`, `sd:2`, `piano`). */
  sounds: string[];
  /** It plays chords: its role is chords, or a quarter of its notes start together. */
  chords: boolean;
}

/**
 * The parts some code plays (claims model `PlayedParts`): every drum hit by its sound (`drumPartsOfSound`), a drum
 * track with an exact part label (`kick:`) for its part, a pitched track by its label then its role
 * (`partOfTrack`); and whether it plays chords.
 */
export function playedPartsOf(def: UnitSongDef, tracks: readonly TrackSummary[]): PlayedParts {
  const parts = new Set<SongPartId>();
  let playsChords = false;
  for (const t of tracks) {
    let byHits = false;
    for (const s of t.sounds) {
      for (const p of drumPartsOfSound(def, s)) {
        parts.add(p);
        byHits = true;
      }
    }
    if (t.chords) playsChords = true;
    if (t.role === "drums") {
      const exact = def.parts.find((p) => p.role === "drums" && p.label === t.label);
      if (exact && !byHits) parts.add(exact.id);
    } else if (t.role !== null || def.parts.some((p) => p.label === t.label)) {
      const p = partOfTrack(def, { label: t.label, role: t.role });
      if (p) parts.add(p);
    }
  }
  return { parts, playsChords };
}

const ROLES = ["drums", "bass", "chords", "melody"] as const;
const onsetKey = (e: Normalized["all"][number]) => `${e.onset[0]}/${e.onset[1]}`;

/**
 * The learner's tracks of an evaluated code: label, role (the label first, STYLE §2; else the grader's inference,
 * contracts §6.2 rule 1), the sounds it plays and whether it plays chords. Silent tracks and Band tracks are left out.
 */
export function trackSummariesOf(n: Normalized): TrackSummary[] {
  const out: TrackSummary[] = [];
  for (const [label, events] of Object.entries(n.byTrack)) {
    if (label.startsWith("band.") || events.length === 0) continue;
    const fixed = LABEL_ROLES[label.replace(/[2-4]$/, "") as TrackLabel] ?? null;
    const inferred = ROLES.find((r) => n.roles[r] === label) ?? null;
    const pitched = events.filter((e) => e.midi !== null && e.drum === undefined);
    const role = fixed ?? inferred ?? (pitched.length === 0 ? "drums" : null);
    const starts = new Map<string, number>();
    for (const e of pitched) starts.set(onsetKey(e), (starts.get(onsetKey(e)) ?? 0) + 1);
    // Polyphonic onsets over all pitched onsets, as the grader's `polyphonyRatio` (contracts §6.2 rule 1).
    let together = 0;
    for (const k of starts.values()) if (k > 1) together += 1;
    const sounds = [...new Set(events.map((e) => e.s).filter((s): s is string => typeof s === "string"))];
    out.push({
      label,
      role,
      sounds,
      chords: role === "chords" || (starts.size > 0 && together / starts.size >= 0.25),
    });
  }
  return out;
}

/**
 * The part one track stands for in the take's `labels`: its exact part, else (a drum track) the one part all its
 * hits belong to, else (pitched) its part by role. A `drums:` line split over several parts maps to `null`.
 */
function labelPartOf(def: UnitSongDef, t: TrackSummary): SongPartId | null {
  const exact = def.parts.find((p) => p.label === t.label);
  if (exact) return exact.id;
  if (t.role === "drums") {
    const hit = new Set(t.sounds.flatMap((s) => drumPartsOfSound(def, s)));
    return hit.size === 1 ? ([...hit][0] as SongPartId) : null;
  }
  return partOfTrack(def, { label: t.label, role: t.role });
}

/**
 * The sections a code with its own `arrange()` fills (U09.L02 on): the step's sections whose type the learner's
 * sections name. `undefined` for a loop, which fills every section of the step.
 */
export function filledSectionsOf(
  def: UnitSongDef,
  step: Pick<TakeStep, "sections">,
  code: string,
): SongSectionId[] | undefined {
  const own = sourceSectionsOf(code);
  if (!own) return undefined;
  const types = new Set(own.map((s) => s.type).filter((t): t is string => t !== null));
  const byId = new Map(def.sections.map((s) => [s.id, s]));
  return stepSectionIds(def, step).filter((id) => types.has(byId.get(id)?.type ?? ""));
}

/** One key per saved version (`[A-Za-z0-9_-]{8,64}`): a Save retried after a failure records the take once. */
export function takeIdempotencyKey(lessonId: string, sketchId: string, sketchVersion: number): string {
  return `take-${lessonId}-${sketchId}-${sketchVersion}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64);
}

export interface SongTakeInput {
  def: UnitSongDef;
  step: TakeStep;
  unitId: string;
  lessonId: string;
  meter: MeterId;
  /** The Make's own length (its `bars[1]`): the evaluation reads at least this much. */
  bars: number;
  /** The song's tempo, for code that sets none. */
  songBpm: number;
  /** The saved code and the sketch version `sketches.create` gave it. */
  code: string;
  sketchId: string;
  sketchVersion: number;
}

export interface SongTakeIo {
  /** Evaluates code without a lint (the browser grader host's `analyze`; the realm in tests). */
  evaluate(code: string, bars: number, meter: MeterId): Promise<EvalResult>;
  /** `songs.recordTake` for the unit. */
  post(unitId: string, body: UnitSongTakeCreate): Promise<unknown>;
}

/**
 * What `songs.recordTake` gets for a saved Make: the cells its code claims (`claimsOf`: the step's declared parts,
 * every part the code plays, Oak's pitched parts when it plays chords, in the sections it fills), its labels and its
 * tempo. Code that does not run claims the step's declared cells, at the song's tempo.
 */
export async function songTakeBody(
  evaluate: SongTakeIo["evaluate"],
  input: SongTakeInput,
): Promise<UnitSongTakeCreate> {
  const base = {
    lessonId: input.lessonId as LessonId,
    sketchId: input.sketchId,
    sketchVersion: input.sketchVersion,
    idempotencyKey: takeIdempotencyKey(input.lessonId, input.sketchId, input.sketchVersion),
  };
  const fallback: UnitSongTakeCreate = {
    ...base,
    cells: claimsOf(input.def, input.step, { parts: new Set(), playsChords: false }),
    labels: {},
    bpm: Math.min(400, input.songBpm),
  };
  const own = sourceSectionsOf(input.code);
  const arranged = own ? own.reduce((n, s) => n + s.bars, 0) : 0;
  const bars = Math.min(64, Math.max(4, Math.ceil(input.bars), arranged));
  let res: EvalResult;
  try {
    res = await evaluate(input.code, bars, input.meter);
  } catch {
    return fallback;
  }
  if (!res.ok) return fallback;
  const tracks = trackSummariesOf(normalize(res, { meter: input.meter }));
  const played = playedPartsOf(input.def, tracks);
  const cells = claimsOf(input.def, input.step, played, filledSectionsOf(input.def, input.step, input.code));
  const labels: Record<string, string | null> = {};
  for (const t of tracks.slice(0, 64)) labels[t.label.slice(0, 64)] = labelPartOf(input.def, t);
  const bpm =
    res.cpsSet && Number.isFinite(res.bpm) && res.bpm > 0 ? Math.round(res.bpm * 100) / 100 : input.songBpm;
  return { ...base, cells, labels, bpm: Math.min(400, bpm) };
}

/** Records the saved Make as a take of its song: evaluates it once, then posts what it claims. */
export async function recordSongTake(io: SongTakeIo, input: SongTakeInput): Promise<void> {
  await io.post(input.unitId, await songTakeBody(io.evaluate, input));
}

/**
 * A failure a later try can get past: no answer (the local server restarting, a network blip) or a server error.
 * An answer that says the take is wrong (400, 404, 409) stays wrong on a retry.
 */
export function isTransientTakeError(e: unknown): boolean {
  if (!(e instanceof OakApiError)) return true;
  return e.code === "network" || e.status === 0 || e.status >= 500;
}

/**
 * Posts one take body again after a transient failure, after each delay in turn, with the same body and idempotency
 * key (the server records it once). Resolves `true` once a post succeeds, `false` when every try failed or a failure
 * is not transient. Never throws.
 */
export async function retryTakePost(
  post: () => Promise<unknown>,
  o: { delaysMs: readonly number[]; wait?: (ms: number) => Promise<void> },
): Promise<boolean> {
  const wait = o.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (const ms of o.delaysMs) {
    await wait(ms);
    try {
      await post();
      return true;
    } catch (e) {
      if (!isTransientTakeError(e)) return false;
    }
  }
  return false;
}

/**
 * The takes Oak recorded from earlier lessons' sketches (spec §5.6a: `backfilled`, cells = the step's sections ×
 * declared parts, because the server cannot evaluate code), refined from their own code when the learner next saves
 * a take: each is posted again with its lesson, sketch and version, which the server refines in place (its id and
 * order kept). Returns how many were posted.
 */
export async function refineBackfilledTakes(
  io: SongTakeIo,
  o: {
    def: UnitSongDef;
    unitId: string;
    meter: MeterId;
    songBpm: number;
    takes: readonly Pick<UnitSongTake, "lessonId" | "code" | "sketchId" | "sketchVersion" | "backfilled">[];
  },
): Promise<number> {
  let posted = 0;
  for (const t of o.takes) {
    if (!t.backfilled || t.code.trim() === "") continue;
    const step = o.def.plan.find((s): s is TakeStep => s.kind === "take" && s.lesson === t.lessonId);
    if (!step) continue;
    await recordSongTake(io, {
      def: o.def,
      step,
      unitId: o.unitId,
      lessonId: t.lessonId,
      meter: o.meter,
      bars: 8,
      songBpm: o.songBpm,
      code: t.code,
      sketchId: t.sketchId,
      sketchVersion: t.sketchVersion,
    });
    posted++;
  }
  return posted;
}

// --- the transport's chips -------------------------------------------------------------------------------

const OAK_PREFIX = "band.oak.";
const TAKE_PREFIX = "band.take.";

/**
 * A track chip's text inside the song (spec §5.3): Oak's parts by their name ("Kick (Oak)", "Tune (Oak)"), a saved
 * take's tracks as the learner's from their lesson ("drums (yours, from Heartbeat)"), and the editor's own tracks as
 * today's code. A plain Band track keeps its "(band)".
 */
export function songChipLabel(
  track: string,
  o: { partName(label: string): string | null; lessonTitle(lessonId: string): string | null },
): string {
  if (track.startsWith(OAK_PREFIX)) {
    const label = track.slice(OAK_PREFIX.length);
    return `${o.partName(label) ?? label} (Oak)`;
  }
  if (track.startsWith(TAKE_PREFIX)) {
    const rest = track.slice(TAKE_PREFIX.length);
    const dot = rest.lastIndexOf(".");
    const lessonId = dot > 0 ? rest.slice(0, dot) : rest;
    const label = dot > 0 ? rest.slice(dot + 1) : rest;
    return `${label} (yours, from ${o.lessonTitle(lessonId) ?? lessonId})`;
  }
  if (track.startsWith("band.")) return `${track.slice(5)} (band)`;
  return `${track} (today's code)`;
}
