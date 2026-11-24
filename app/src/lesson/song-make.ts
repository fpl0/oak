// The Make inside the unit song (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.3; contracts §5.11
// rules 14–15). Pure rules, no queries:
//  - which Make is a take step of a song (`songMakeOf`) and which a side step (`songSideOf`);
//  - where the editor starts (`openingCode`): the authored starter, or the learner's take of the step's `startFrom`
//    lesson, in both cases with the first `setcpm(<n>/<beats>)` set to the song's tempo when the Make accepts it;
//  - what counts as unchanged (`openingsOf`): the code the Make opened with, and Oak's copy at the song's tempo;
//  - what a saved take claims (`recordSongTake`): the saved code is evaluated once and read as the composer reads the
//    live Make (`makeReading` + `makeClaimsOfEvents`: the bars that play in today's sections, roles label first), and
//    the cells come from the claims model (`claimsOf`);
//  - the transport's chips: today's code line by line, then one chip per part of the song ("Kick (yours and Oak)").
// Grading stays the learner's code alone (spec §4.1); only `make.unchanged` learns the opening code (grading.ts).
import {
  type CodeRange,
  claimsOf,
  drumPartsOfSound,
  type Exercise,
  type LessonId,
  type MeterId,
  OakApiError,
  partOfTrack,
  type SideStep,
  type SongPartId,
  stepSectionIds,
  type TakeStep,
  type UnitId,
  type UnitSongDef,
  type UnitSongDetail,
  type UnitSongTake,
  type UnitSongTakeCreate,
} from "@oak/api";
import type { EvalResult } from "@oak/grader";
import type { BandSetup, MuteMap } from "@oak/strudel";
import { makeClaimsOfEvents, makeReading, type SongTrackRole } from "@oak/strudel/song-compose";
import { songStepOf } from "../../../content/unit-songs/index.ts";
import { playableTakes, type SongView } from "../song/model.ts";
import { cellsSentence, partMutes, partTracks } from "../song/surfaces-model.ts";
import { chipName } from "../workbench/chip-words.ts";

// --- which song a Make belongs to ----------------------------------------------------------------------

/** A side step's Make: today's standalone sketch over today's Band, with the reason the lesson card gives. */
export interface SongSideHost {
  kind: "side";
  def: UnitSongDef;
  reason: string;
  /**
   * The learner has started the song (`songs.get` answered, not `new`). A track whose first lesson is a side step
   * (J1.L01) has no song for the learner yet: the Make then says nothing about "your song".
   */
  started: boolean;
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
  /** The transport's chips inside the song: today's code line by line, then one per part (`songChips`). */
  chips: SongChips;
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

/**
 * The line beside a take Make's Save (spec §5.3): what Save does to the song, in the grid's words. "Save puts your
 * code into “Turn the dial”, where it plays Kick and Snare in B." Today's code that takes no cell (it plays nothing
 * the song has yet) still goes into the song.
 */
export function songSaveLine(view: SongView): string {
  const today = view.cells.filter((c) => c.owner === "today").map((c) => `${c.part}@${c.section}`);
  const what = cellsSentence(view, today);
  return what
    ? `Save puts your code into “${view.title}”, where it plays ${what}.`
    : `Save puts your code into “${view.title}”.`;
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
 * The tempo the code's first tempo line sets (`setcpm(<n>/<beats>)`, as `withSongTempo` reads it), or `null` when the
 * code has none in that form. The Make's "set to your song's tempo" note holds only while this is the song's tempo.
 */
export function firstTempoOf(code: string): number | null {
  for (const line of code.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed === "") continue;
    if (!/^setcpm\s*\(/.test(trimmed)) {
      if (/\bsetcpm\s*\(/.test(line)) return null;
      continue;
    }
    const m = TEMPO.exec(line);
    return m ? Number(m[2]) : null;
  }
  return null;
}

/** The code's first tempo line still sets the song's tempo (the opening note about it stays true). */
export function holdsSongTempo(code: string, bpm: number): boolean {
  const t = firstTempoOf(code);
  return t !== null && Math.abs(t - Math.round(bpm * 100) / 100) < 1e-9;
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

/**
 * The part one track stands for in the take's `labels`: its exact part, else (a drum track) the one part all its
 * hits belong to, else (pitched) its part by role. A `drums:` line split over several parts maps to `null`.
 */
function labelPartOf(
  def: UnitSongDef,
  t: { label: string; role: SongTrackRole | null; sounds: readonly string[] },
): SongPartId | null {
  const exact = def.parts.find((p) => p.label === t.label);
  if (exact) return exact.id;
  if (t.role === "drums") {
    const hit = new Set(t.sounds.flatMap((s) => drumPartsOfSound(def, s)));
    return hit.size === 1 ? ([...hit][0] as SongPartId) : null;
  }
  return partOfTrack(def, { label: t.label, role: t.role });
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
  /**
   * The Make's own length (its `bars[1]`). Not read by Save: it evaluates the bars of the code that play in today's
   * sections (`makeReading`), as the live Make reads them.
   */
  bars?: number;
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
  // The composer's own reading (`makeReading` + `makeClaimsOfEvents`, as the live Make claims in `finishSong`): the
  // sections the code fills, and what its tracks play over the bars of it that play there, roles label first.
  const reading = makeReading(input.def, input.step.sections, input.step, input.code);
  let res: EvalResult;
  try {
    res = await evaluate(input.code, Math.min(64, reading.bars), input.meter);
  } catch {
    return fallback;
  }
  if (!res.ok) return fallback;
  const claim = makeClaimsOfEvents(input.def, reading, res.events);
  const cells = claim.cells;
  const labels: Record<string, string | null> = {};
  for (const t of claim.tracks.filter((t) => t.facts.events > 0).slice(0, 64))
    labels[t.label.slice(0, 64)] = labelPartOf(input.def, {
      label: t.label,
      role: t.role,
      sounds: t.facts.sounds,
    });
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
 * take's tracks as the learner's from their lesson ("Drums (yours, from Heartbeat)"), and the editor's own tracks as
 * today's code ("Kick (today's code)"). A plain Band track says "(Oak)". The words follow `chipName`'s one rule.
 */
export function songChipLabel(
  track: string,
  o: { partName(label: string): string | null; lessonTitle(lessonId: string): string | null },
): string {
  if (track.startsWith(OAK_PREFIX)) {
    const label = track.slice(OAK_PREFIX.length);
    return `${o.partName(label) ?? chipName(label)} (Oak)`;
  }
  if (track.startsWith(TAKE_PREFIX)) {
    const rest = track.slice(TAKE_PREFIX.length);
    const dot = rest.lastIndexOf(".");
    const lessonId = dot > 0 ? rest.slice(0, dot) : rest;
    const label = dot > 0 ? rest.slice(dot + 1) : rest;
    // A lesson is named by its title, never by its id alone.
    const title = o.lessonTitle(lessonId);
    const name = o.partName(label) ?? chipName(label);
    return title ? `${name} (yours, from ${title})` : `${name} (yours)`;
  }
  if (track.startsWith("band.")) return `${chipName(track.slice(5))} (Oak)`;
  return `${o.partName(track) ?? chipName(track)} (today's code)`;
}

/** One chip of the transport: the tracks it mutes and solos, by id, and its words. */
export interface SongChip {
  /** Today's code's own track label (`drums`), `part:<id>` for a part of the song, or a band track's full name. */
  id: string;
  label: string;
}

/** The chips a song Make's transport shows, and the player's mutes for their state (Workbench `trackChips`). */
export interface SongChips {
  chipsOf(tracks: readonly string[]): SongChip[];
  /** The mutes that play what the chips say: a muted or soloed part acts on every track of it (`partMutes`). */
  mutesOf(state: Pick<MuteMap, "muted" | "solo">, tracks: readonly string[]): MuteMap;
}

const PART_CHIP = "part:";

/**
 * The song Make's chips (spec §5.3). A chip per line of today's code ("Drums (today's code)"), then one chip per part
 * of the song that plays ("Kick (Oak)", "Snare (yours)", "Hi-hats (yours and Oak)"): every earlier lesson's line of
 * that part and Oak's track for it under one chip, its mute and solo acting on all of them. A chip per take line made
 * a wall of 16 to 25 chips ("kick (yours, from Backbeat)", "kick (yours, from Two per Beat)", "Kick (Oak)") that
 * pushed the roll off the screen; which earlier lesson plays which section is the song page's to say.
 */
export function songChips(
  def: UnitSongDef,
  detail: Pick<UnitSongDetail, "takes"> | null,
  o: { partName(partId: SongPartId): string },
): SongChips {
  const byPart = def.parts.map((p) => ({ id: p.id, tracks: partTracks(def, detail, p.id) }));
  return {
    chipsOf(tracks) {
      const loaded = new Set(tracks);
      const out: SongChip[] = tracks
        .filter((t) => !t.startsWith("band."))
        .map((t) => {
          // A line that is a part of the song says the part's name, as that part's own chip does (`chipName`).
          const part = def.parts.find((p) => p.label === t);
          return { id: t, label: `${part ? o.partName(part.id) : chipName(t)} (today's code)` };
        });
      const grouped = new Set<string>();
      for (const p of byPart) {
        const mine = p.tracks.filter((t) => loaded.has(t));
        if (mine.length === 0) continue;
        for (const t of mine) grouped.add(t);
        const oak = mine.some((t) => t.startsWith(OAK_PREFIX));
        const yours = mine.some((t) => t.startsWith(TAKE_PREFIX));
        const whose = yours && oak ? "yours and Oak" : yours ? "yours" : "Oak";
        out.push({ id: `${PART_CHIP}${p.id}`, label: `${o.partName(p.id)} (${whose})` });
      }
      // A band track no part claims (a take line the song no longer places) keeps a chip of its own.
      for (const t of tracks)
        if (t.startsWith("band.") && !grouped.has(t))
          out.push({ id: t, label: songChipLabel(t, { partName: () => null, lessonTitle: () => null }) });
      return out;
    },
    mutesOf(state, tracks) {
      const partOf = (id: string | null) =>
        id?.startsWith(PART_CHIP) ? (id.slice(PART_CHIP.length) as SongPartId) : null;
      const mutedParts = new Set<SongPartId>();
      const mutedTracks = new Set<string>();
      for (const id of state.muted) {
        const p = partOf(id);
        if (p) mutedParts.add(p);
        else mutedTracks.add(id);
      }
      const soloPart = partOf(state.solo);
      const base = partMutes(def, detail, { muted: mutedParts, solo: soloPart }, tracks);
      const muted = new Set([...base.muted, ...mutedTracks]);
      // A line of today's code (or a lone band track) soloed: the player's own solo silences every other track.
      const solo = state.solo !== null && soloPart === null ? state.solo : null;
      return { muted, solo, ...(base.hits && solo === null ? { hits: base.hits } : {}) };
    },
  };
}
