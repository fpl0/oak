// What the song surfaces say and play, pure (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.5): the
// five styles, how much of the song is the learner's and where a lesson sits in it, the sentence that says which
// blocks a take holds, the song as it stood after any take, a release's frozen song, where the song is in its plan,
// which tracks a part's mute or solo acts on, and which release action the song page offers. Names come from `songViewOf`, so a section or part is named only once its term is met
// (spec §4.3). Words follow AUTHORING §5, §21 and §22.
import {
  type CellKey,
  cellKey,
  drumPartsOfSound,
  type FlavourId,
  isCellKey,
  type LessonId,
  OAK_OWNER,
  type SongPartId,
  type SongSectionId,
  type UnitSongDef,
  type UnitSongDetail,
  type UnitSongSnapshot,
  type UnitSongSummary,
  type UnitSongTake,
} from "@oak/api";
import { lintStrict } from "@oak/grader";
import type { MuteMap } from "@oak/strudel";
import type { RenderPieceRequest } from "@oak/strudel/offline";
import {
  oakTrackName,
  olderTakeNumbers,
  type SongBand,
  songLengthBars,
  takeTrackName,
} from "@oak/strudel/song-compose";
import { bpmToCps } from "@oak/theory";
import { songBandSetupOf } from "../lesson/band.ts";
import { playableTakes, type SongView, songGridOf } from "./model.ts";

// --- styles ---------------------------------------------------------------------------------------------

export interface SongStyle {
  id: FlavourId;
  name: string;
  /** What the style sounds like, in plain words (no term the first lesson has not met). */
  blurb: string;
}

/** The five styles a song can play in, in the order the New song moment offers them. */
export const SONG_STYLES: readonly SongStyle[] = [
  { id: "flavour.pop", name: "Pop", blurb: "Piano and electric bass over a punchy drum kit." },
  { id: "flavour.indie", name: "Indie", blurb: "Clean electric guitar over a dry drum machine." },
  { id: "flavour.jazz-soul", name: "Jazz-soul", blurb: "Electric piano, upright bass and a soft jazz kit." },
  { id: "flavour.funk", name: "Funk", blurb: "Clavinet, finger bass and a classic drum machine." },
  {
    id: "flavour.electronic",
    name: "Electronic",
    blurb: "A squelchy synth bass and synth chords over a drum machine and a dusty kit.",
  },
];

export function styleName(flavour: FlavourId | string): string {
  return SONG_STYLES.find((s) => s.id === flavour)?.name ?? "Pop";
}

// --- words ------------------------------------------------------------------------------------------------

/** "A", "A and B", "A, B and C". */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Distinct labels, in order. */
const unique = (xs: readonly string[]) => [...new Set(xs)];

/** A label that is a single letter (A, B…): said as a section, never alone, since "in D" reads as the key of D. */
const isLetter = (label: string) => /^[A-Z]$/.test(label);

/** "bridges", "pre-choruses", "A sections": a section label in the plural, inside a sentence. */
function sectionsPlural(label: string): string {
  if (isLetter(label)) return `${label} sections`;
  const lower = label.toLowerCase();
  return /(s|x|ch|sh)$/.test(lower) ? `${lower}es` : `${lower}s`;
}

const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/**
 * Where a set of sections sits, in the one wording every song sentence uses (`cellsSentence`, `grewSentence`, the
 * grid's summary): a letter is always a section with its capital kept ("section D", "both A sections"), since "in D"
 * alone reads as the key of D; a named section is said in sentence case with its article ("the bridge", "all four
 * choruses"); a repeated label is told apart: all of them ("both bridges"), or the ones held by their bars ("the
 * bridge at bar 17", "the A sections at bars 1 and 9"), since the label alone would stand for all of them. Several single sections share one phrase when nothing else is
 * listed ("sections B and D", "the verse and chorus"); otherwise each keeps its own so the "and"s never pile up.
 */
export function whereWords(view: SongView, sections: readonly SongView["sections"][number][]): string {
  if (sections.length === view.sections.length) return "the whole song";
  const ids = new Set(sections.map((s) => s.id));
  const labels = unique(sections.map((s) => s.label));
  const once = labels.filter((label) => view.sections.filter((s) => s.label === label).length === 1);
  if (once.length === labels.length && labels.length > 1) {
    if (labels.every(isLetter)) return `sections ${andList(labels)}`;
    if (!labels.some(isLetter)) return `the ${andList(labels.map((l) => l.toLowerCase()))}`;
  }
  return andList(
    labels.map((label) => {
      const all = view.sections.filter((s) => s.label === label);
      const held = all.filter((s) => ids.has(s.id));
      const one = isLetter(label) ? `section ${label}` : `the ${label.toLowerCase()}`;
      if (all.length === 1) return one;
      if (held.length === all.length)
        return all.length === 2
          ? `both ${sectionsPlural(label)}`
          : `all ${COUNT_WORDS[all.length] ?? all.length} ${sectionsPlural(label)}`;
      const bars = andList(held.map((s) => String(s.startBar + 1)));
      return held.length === 1 ? `${one} at bar ${bars}` : `the ${sectionsPlural(label)} at bars ${bars}`;
    }),
  );
}

/** The parts a set of cells holds (in song order) and where (`whereWords`: a repeated section told apart). */
function cellsWhat(
  view: SongView,
  cells: readonly string[],
): { names: string[]; parts: SongViewPartRef[]; where: string } | null {
  const keys = new Set(cells.filter(isCellKey));
  const parts = view.parts.filter((p) => view.sections.some((s) => keys.has(cellKey(p.id, s.id))));
  const sections = view.sections.filter((s) => view.parts.some((p) => keys.has(cellKey(p.id, s.id))));
  if (parts.length === 0) return null;
  return { names: parts.map((p) => p.name), parts, where: whereWords(view, sections) };
}

/**
 * What a set of cells holds, in the view's words: "Kick and Snare in section B", "Bass in both D sections", "Bass in
 * the chorus at bar 13". `null` for none.
 */
export function cellsSentence(view: SongView, cells: readonly string[]): string | null {
  const what = cellsWhat(view, cells);
  return what ? `${andList(what.names)} in ${what.where}` : null;
}

/**
 * The sentence the Coda says about a new take: "The song now plays your kick and snare in B." `played` is the parts
 * the take's code plays (`partsPlayedByTake`): a part it took over but does not play rests there now (Oak's part is
 * masked out and the learner's code has none), and the sentence says so instead of claiming it. `null`: not known
 * (a take with no labels recorded), every part is named as played.
 */
export function grewSentence(
  view: SongView,
  cells: readonly string[],
  played: ReadonlySet<SongPartId> | null = null,
): string | null {
  const what = cellsWhat(view, cells);
  if (!what) return null;
  const where = what.where;
  const names = (parts: readonly SongViewPartRef[]) => andList(parts.map((p) => lowerName(p.name)));
  const plays = played ? what.parts.filter((p) => played.has(p.id)) : what.parts;
  const rests = played ? what.parts.filter((p) => !played.has(p.id)) : [];
  if (plays.length === 0)
    return `Your code took over the ${names(rests)} in ${where}; ${rests.length === 1 ? "it rests" : "they rest"} there now.`;
  const yours = `The song now plays your ${names(plays)} in ${where}`;
  if (rests.length === 0) return `${yours}.`;
  return `${yours}; the ${names(rests)} ${rests.length === 1 ? "rests" : "rest"} there now.`;
}

type SongViewPartRef = { id: SongPartId; name: string };

/**
 * The grid of "Your song grew", drawn as its sentence (`grewSentence`) says: a block today's take holds and plays is
 * today's; a block it holds whose part its code does not play is drawn as a rest, since nothing sounds there now (the
 * take silenced Oak's part and plays none of its own). `fresh` is today's blocks, in grid order (they fill in bar by
 * bar). `played` `null` (not known): every block it holds is today's, as the sentence names every part as played.
 */
export function grewView(
  view: SongView,
  held: readonly string[],
  played: ReadonlySet<SongPartId> | null,
): { view: SongView; fresh: Set<string> } {
  const heldSet = new Set(held);
  const fresh = new Set<string>();
  const cells = view.cells.map((c): SongView["cells"][number] => {
    const key = `${c.part}@${c.section}`;
    if (!heldSet.has(key)) return c;
    if (played && !played.has(c.part)) return { part: c.part, section: c.section, owner: "oak", rests: true };
    fresh.add(key);
    return { ...c, owner: "today" };
  });
  return { view: { ...view, cells }, fresh };
}

/**
 * The parts a saved take's code plays, read from what was recorded with it: every labelled line that plays a part
 * (`labels`), and the drum parts whose sounds a line that plays several parts names (`drums: s("bd sd")`). `null` when
 * the take has no labels recorded (a take Oak backfilled before its code was read).
 */
export function partsPlayedByTake(
  def: UnitSongDef,
  take: Pick<UnitSongTake, "labels" | "code">,
): Set<SongPartId> | null {
  const labels = Object.entries(take.labels);
  if (labels.length === 0) return null;
  const out = new Set<SongPartId>();
  for (const [, part] of labels) if (part) out.add(part as SongPartId);
  if (labels.some(([, part]) => part === null))
    for (const [, , quoted] of take.code.matchAll(/(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g))
      for (const word of (quoted ?? "").split(/[^A-Za-z0-9_:]+/))
        for (const p of drumPartsOfSound(def, word)) out.add(p);
  return out;
}

/** A part name inside a sentence: "Kick" → "kick"; a name that starts with two capitals (an acronym) stays. */
const lowerName = (name: string) =>
  /^[A-Z][a-z]/.test(name) ? name[0]?.toLowerCase() + name.slice(1) : name;

/**
 * How many blocks of the song are the learner's, and of how many (shared decision 1 of the 2026-11-24 review). A
 * block is one part in one section that sounds: a cell where Oak rests is not one. Only blocks the learner has
 * written and saved count as yours: pass the song as saved (a view with no Make open), so Today's hero and the song
 * page give the same number on every day. The blocks today's lesson will take over are said apart (`todayAdds`).
 */
export function ownedCount(view: SongView): { yours: number; total: number } {
  const total = view.cells.filter((c) => !(c.owner === "oak" && c.rests)).length;
  return { yours: view.cells.filter((c) => c.owner === "yours").length, total };
}

/**
 * How many blocks today's Make adds to what is yours: its blocks (`live`, the view with the Make open) that the saved
 * song (`saved`) does not already have as yours. 0 once today's Make is saved.
 */
export function todayAdds(saved: SongView, live: SongView): number {
  const yours = new Set(saved.cells.filter((c) => c.owner === "yours").map((c) => `${c.part}@${c.section}`));
  return live.cells.filter((c) => c.owner === "today" && !yours.has(`${c.part}@${c.section}`)).length;
}

/**
 * How much of the song is the learner's, in the words every song surface uses: "15 of 46 blocks are yours", and, with
 * the blocks today's lesson adds, "15 of 46 blocks are yours · today adds 4". `saved` is the song as saved (no Make
 * open). Never "cells", an authoring word the learner has not met.
 */
export function blocksLine(saved: SongView, adds = 0): string {
  const { yours, total } = ownedCount(saved);
  const line = `${yours} of ${total} ${total === 1 ? "block" : "blocks"} ${yours === 1 ? "is" : "are"} yours`;
  return adds > 0 ? `${line} · today adds ${adds}` : line;
}

// --- the song at any point ---------------------------------------------------------------------------------

/** The song as it stood right after a take (that take and the ones before it); the whole song for `null`. */
export function detailUpTo<D extends Pick<UnitSongDetail, "takes">>(detail: D, takeId: number | null): D {
  if (takeId === null) return detail;
  const at = detail.takes.findIndex((t) => t.id === takeId);
  return at < 0 ? detail : { ...detail, takes: detail.takes.slice(0, at + 1) };
}

/** The song as it stood right before a take (the takes before it). */
export function detailBefore<D extends Pick<UnitSongDetail, "takes">>(detail: D, takeId: number): D {
  const at = detail.takes.findIndex((t) => t.id === takeId);
  return at < 0 ? detail : { ...detail, takes: detail.takes.slice(0, at) };
}

/**
 * The newest take of a lesson, or `null`. With `sketchIds` (the sketches a session saved), only a take of one of those
 * sketches: a session whose take did not reach the song never shows an earlier run's take as today's.
 */
export function newestTakeOfLesson(
  detail: Pick<UnitSongDetail, "takes"> | null,
  lessonId: string,
  sketchIds?: readonly string[],
): UnitSongTake | null {
  const takes = detail?.takes ?? [];
  for (let i = takes.length - 1; i >= 0; i--) {
    const t = takes[i];
    if (t?.lessonId === lessonId && (!sketchIds || sketchIds.includes(t.sketchId))) return t;
  }
  return null;
}

/**
 * Where a lesson sits among the song's lessons: "Lesson 5 of 8 in this song" counts take lessons only, on every
 * surface (Today's hero, the lesson's song card, the song page, the album). A side lesson is a dash among the dots
 * and has no number: `index` is `null` for it, and for a lesson in no step of the song.
 */
export function songLessonOf(
  def: Pick<UnitSongDef, "plan">,
  lessonId: string | null,
): { index: number | null; of: number } {
  const takes = def.plan.filter((p) => p.kind === "take").map((p) => p.lesson as string);
  const at = lessonId === null ? -1 : takes.indexOf(lessonId);
  return { index: at < 0 ? null : at + 1, of: takes.length };
}

/** "Lesson 5 of 8 in this song" for a take lesson; `null` for a side lesson (it has no number). */
export function lessonOfSongLine(def: Pick<UnitSongDef, "plan">, lessonId: string | null): string | null {
  const { index, of } = songLessonOf(def, lessonId);
  return index === null ? null : `Lesson ${index} of ${of} in this song`;
}

/** How many lessons of the song have a take in it (a lesson redone adds a take, not a lesson), of its take steps. */
export function lessonsInSong(
  def: Pick<UnitSongDef, "plan">,
  detail: Pick<UnitSongDetail, "takes"> | null,
): { done: number; of: number } {
  const takeSteps = def.plan.filter((p) => p.kind === "take").map((p) => p.lesson as string);
  const taken = new Set((detail?.takes ?? []).map((t) => t.lessonId as string));
  return { done: takeSteps.filter((l) => taken.has(l)).length, of: takeSteps.length };
}

/**
 * The cells a take still holds in the song now (a later take may have taken some back). Only takes that can play
 * hold cells (`playableTakes`): an imported take that fails the strict lint leaves them to Oak, as the song plays.
 */
export function cellsHeldBy(
  def: UnitSongDef,
  detail: Pick<UnitSongDetail, "takes">,
  takeId: number,
): CellKey[] {
  const grid = songGridOf(def, playableTakes(detail));
  return [...grid].filter(([, owner]) => owner === String(takeId)).map(([key]) => key);
}

/**
 * A release as it was frozen (`songs.snapshot`), ready to play: Oak's code at release, the song's sections and parts
 * at release, and every take's code and cells (spec §5.4: never the current content). A snapshot imported from a
 * backup plays its takes only after the strict lint (contracts §11.3); the others fall back to Oak.
 */
export function snapshotBand(snapshot: UnitSongSnapshot): SongBand {
  const takes = snapshot.takes.filter(
    (t) => t.code.trim() !== "" && !(snapshot.reviewBeforeRun && lintStrict(t.code).length > 0),
  );
  const asTakes = takes.map((t) => ({ id: t.takeId, cells: t.cells }));
  const oakOk = !(snapshot.reviewBeforeRun && lintStrict(snapshot.oakCode).length > 0);
  return {
    def: snapshot.def,
    flavour: snapshot.flavour,
    bpm: snapshot.bpm,
    sources: takes.map((t) => ({
      sourceId: String(t.takeId),
      lessonId: t.lessonId as LessonId,
      code: t.code,
      labels: t.labels,
    })),
    grid: songGridOf(snapshot.def, asTakes as never),
    ...(oakOk ? { oakCode: snapshot.oakCode } : {}),
  };
}

/**
 * The offline render of a released song (album Export, contracts §5.11 rule 18): the frozen snapshot alone, every
 * take and Oak's code as released, never the newest take's code or today's content. It has no code of its own.
 */
export function songReleaseRenderRequest(
  snapshot: UnitSongSnapshot,
): Pick<RenderPieceRequest, "code" | "band" | "key" | "mutes"> & { mutes: MuteMap } {
  return {
    code: "",
    band: songBandSetupOf(null, snapshotBand(snapshot)),
    key: null,
    mutes: { muted: new Set(), solo: null },
  };
}

/** The song release an album version plays (`songs.list` → its releases), or `null` for any other version. */
export function songReleaseOfVersion(
  songs: readonly Pick<UnitSongSummary, "unitId" | "releases">[] | undefined,
  trackId: string,
  version: number,
): { unitId: string; releaseId: number } | null {
  for (const s of songs ?? [])
    for (const r of s.releases)
      if (r.albumTrackId === trackId && r.albumVersion === version)
        return { unitId: s.unitId, releaseId: r.id };
  return null;
}

// --- where the song is in its plan ----------------------------------------------------------------------

/**
 * A dot's state: `yours` (its take is in the song), `today` (the lesson planned now), `later`, `side` (a side lesson:
 * a sketch of its own, drawn as a dash), `side-today` (the side lesson planned now: the same dash, ringed, so a lesson
 * keeps its shape from day to day), `done` (finished, but its take is not in the song: a song not started yet takes
 * the earlier lessons' Makes in when it starts).
 */
export type LessonDotState = "yours" | "today" | "later" | "side" | "side-today" | "done";
export interface LessonDot {
  lessonId: LessonId;
  state: LessonDotState;
}

/**
 * One dot per lesson of the song's plan: `yours` for a take lesson that has a take in the song, `today` for the
 * lesson planned now (`side-today` when it is a side step), `side` for a side step, `done` for a take lesson the
 * learner finished whose take is not in the song (`completed`: the lessons finished), `later` for the rest.
 */
export function lessonDots(
  def: Pick<UnitSongDef, "plan">,
  detail: Pick<UnitSongDetail, "takes"> | null,
  today: string | null,
  completed: ReadonlySet<string> = new Set(),
): LessonDot[] {
  const taken = new Set((detail?.takes ?? []).map((t) => t.lessonId as string));
  return def.plan.map((step) => ({
    lessonId: step.lesson,
    state:
      step.kind === "side"
        ? step.lesson === today
          ? "side-today"
          : "side"
        : step.lesson === today
          ? "today"
          : taken.has(step.lesson)
            ? "yours"
            : completed.has(step.lesson)
              ? "done"
              : "later",
  }));
}

// --- mute and solo per part ------------------------------------------------------------------------------

/**
 * The tracks a part plays on: Oak's track for it while Oak still holds a cell of it, and every take line that holds
 * one, by the take's labels (a track label → its part). A take line that plays several parts (a `drums:` line split
 * over the kick and the snare: label `null`) belongs to each of them; `partMutes` mutes such a line hit by hit.
 */
export function partTracks(
  def: UnitSongDef,
  detail: Pick<UnitSongDetail, "takes"> | null,
  partId: SongPartId,
): string[] {
  const part = def.parts.find((p) => p.id === partId);
  if (!part) return [];
  // The takes the song loads (`songBandOf`): an imported take that fails the strict lint never plays.
  const takes = playableTakes(detail);
  const grid = songGridOf(def, takes);
  const owners = new Set(def.sections.map((s) => grid.get(cellKey(partId, s.id)) ?? OAK_OWNER));
  const out: string[] = [];
  if (owners.has(OAK_OWNER)) out.push(oakTrackName(part.label));
  // An older take of a replayed lesson plays as `band.take.<lesson>.<label>#<n>` (`olderTakeNumbers`).
  const older = olderTakeNumbers(takes.map((t) => ({ sourceId: String(t.id), lessonId: t.lessonId })));
  for (const t of takes) {
    if (!owners.has(String(t.id))) continue;
    for (const label of takeLinesOf(t, partId))
      out.push(takeTrackName(t.lessonId, label, older.get(String(t.id))));
  }
  return unique(out);
}

/**
 * The labels of a take's lines that play a part: by its saved labels (a line labelled `null` plays several parts and
 * belongs to each); a take with no labels recorded (a backfilled take): every line it plays.
 */
function takeLinesOf(t: Pick<UnitSongTake, "labels" | "code">, partId: SongPartId): string[] {
  const labels = Object.entries(t.labels);
  if (labels.length === 0) return labelsOfCode(t.code);
  return labels.filter(([, p]) => p === partId || p === null).map(([label]) => label);
}

/** The labelled lines of a code (`drums:`, `kick:`), in order. */
function labelsOfCode(code: string): string[] {
  return unique([...code.matchAll(/^[ \t]*([a-z][a-z0-9_]*)[ \t]*:/gm)].map((m) => m[1] as string));
}

/**
 * The take lines that play several parts (a `drums:` line labelled `null`, or every line of a take with no labels),
 * with the parts each one stands for: their mutes act hit by hit.
 */
function sharedLines(
  def: UnitSongDef,
  detail: Pick<UnitSongDetail, "takes"> | null,
): Map<string, SongPartId[]> {
  const takes = playableTakes(detail);
  const older = olderTakeNumbers(takes.map((t) => ({ sourceId: String(t.id), lessonId: t.lessonId })));
  const shared = new Set<string>();
  for (const t of takes) {
    const labels = Object.entries(t.labels);
    const lines =
      labels.length === 0 ? labelsOfCode(t.code) : labels.filter(([, p]) => p === null).map(([l]) => l);
    for (const label of lines) shared.add(takeTrackName(t.lessonId, label, older.get(String(t.id))));
  }
  const out = new Map<string, SongPartId[]>();
  if (shared.size === 0) return out;
  for (const p of def.parts)
    for (const track of partTracks(def, detail, p.id))
      if (shared.has(track)) out.set(track, [...(out.get(track) ?? []), p.id]);
  return out;
}

/**
 * The player's mute map for the muted parts and the soloed one, over the tracks the song loaded. A take line that
 * plays several parts is muted hit by hit (`MuteMap.hits`): a hit of a drum part's sound (`drumPartsOfSound`) is
 * that part's, any other hit stands for the parts of the whole line. Muting the kick silences the line's `bd` hits
 * only; soloing it keeps them only.
 */
export function partMutes(
  def: UnitSongDef,
  detail: Pick<UnitSongDetail, "takes"> | null,
  state: { muted: ReadonlySet<SongPartId>; solo: SongPartId | null },
  loaded: readonly string[],
): MuteMap {
  const shared = sharedLines(def, detail);
  const muted = new Set<string>();
  const byHit = new Set<string>();
  for (const p of state.muted)
    for (const t of partTracks(def, detail, p)) (shared.has(t) ? byHit : muted).add(t);
  const solo = state.solo;
  if (solo) {
    const keep = new Set(partTracks(def, detail, solo));
    for (const t of loaded) {
      if (!keep.has(t)) muted.add(t);
      else if (shared.has(t)) byHit.add(t);
    }
  }
  const hits = new Map<string, (sound: string) => boolean>();
  // Asked once per hap while the song plays: each sound's drum parts are read once.
  const partsOfSound = new Map<string, readonly SongPartId[]>();
  const drumPartsOf = (sound: string) => {
    let parts = partsOfSound.get(sound);
    if (!parts) {
      parts = drumPartsOfSound(def, sound);
      partsOfSound.set(sound, parts);
    }
    return parts;
  };
  for (const t of byHit) {
    if (muted.has(t)) continue;
    const line = shared.get(t) ?? [];
    hits.set(t, (sound) => {
      const own = drumPartsOf(sound);
      const parts = own.length > 0 ? own : line;
      return parts.some((p) => state.muted.has(p)) || (solo !== null && !parts.includes(solo));
    });
  }
  return { muted, solo: null, ...(hits.size > 0 && { hits }) };
}

// --- release ---------------------------------------------------------------------------------------------

/**
 * What the song page offers about the album: `release` (releasable, and not on the album: never released, or its
 * album track was removed), `again` (on the album, and a take or the style changed since), `on-album` (on the album,
 * unchanged), `not-yet` (the song's last lesson is not done).
 */
export type ReleaseOffer = "release" | "again" | "on-album" | "not-yet";

export function releaseOffer(
  detail: Pick<UnitSongDetail, "status" | "releasable" | "changedSinceRelease" | "releases">,
): ReleaseOffer {
  if (isOnAlbum(detail)) return detail.changedSinceRelease && detail.releasable ? "again" : "on-album";
  return detail.releasable ? "release" : "not-yet";
}

/**
 * The song's newest release is still on the album. Its track removed, the song is off the album and `songs.release`
 * makes a new track (as the server decides: it looks at the newest release only).
 */
export function isOnAlbum(detail: Pick<UnitSongDetail, "releases">): boolean {
  const latest = detail.releases.at(-1);
  return latest !== undefined && latest.albumTrackId !== null;
}

/** The newest release that is still on the album, or `null`. */
export function newestRelease(detail: Pick<UnitSongDetail, "releases">) {
  return [...detail.releases].reverse().find((r) => r.albumTrackId !== null) ?? null;
}

/**
 * Where a song stands, in the one set of words the song page and the album shelf use: `growing` while lessons of its
 * unit can still add to it, `complete` once every take lesson is in but the release point is not reached, `ready`
 * when it can go to the album and is not there, `on-album`, and `off-album` once its album track was removed.
 */
export type SongStage = "growing" | "complete" | "ready" | "on-album" | "off-album";

export function songStage(
  detail: Pick<UnitSongDetail, "releasable" | "releases">,
  lessons: { done: number; of: number },
): SongStage {
  if (isOnAlbum(detail)) return "on-album";
  if (detail.releases.length > 0) return "off-album";
  if (detail.releasable) return "ready";
  return lessons.of > 0 && lessons.done >= lessons.of ? "complete" : "growing";
}

/**
 * The song the empty album speaks of beside C0 (`FirstTrack`), with its stage: one ready for the album first, then one
 * taken off it, then one still growing (in course order within each). `stepsOf` is a song's number of take lessons.
 * `null` when there is none, or every song is on the album (the album is not empty then).
 */
export function firstTrackSong<
  S extends Pick<UnitSongSummary, "unitId" | "releasable" | "releases" | "lessonsCount">,
>(songs: readonly S[], stepsOf: (unitId: S["unitId"]) => number): { song: S; stage: SongStage } | null {
  const staged = songs.map((song) => ({
    song,
    stage: songStage(song, { done: song.lessonsCount, of: stepsOf(song.unitId) }),
  }));
  for (const want of ["ready", "off-album", "complete", "growing"] as const) {
    const found = staged.find((s) => s.stage === want);
    if (found) return found;
  }
  return null;
}

export const SONG_STAGE_WORDS: Readonly<Record<SongStage, string>> = {
  growing: "Still growing",
  complete: "Every lesson is in",
  ready: "Ready for the album",
  "on-album": "On the album",
  "off-album": "Off the album",
};

/**
 * What changed since the song's newest release, for the "Release again" card: the style (named from and to) and the
 * Makes that went in after it. `null` when neither is known to have changed.
 */
export function changedSinceLine(
  detail: Pick<UnitSongDetail, "flavour" | "releases"> & {
    takes?: readonly Pick<UnitSongTake, "createdAt">[];
  },
): string | null {
  const last = detail.releases.at(-1);
  if (!last) return null;
  const out: string[] = [];
  if (last.flavour !== detail.flavour)
    out.push(`the style changed from ${styleName(last.flavour)} to ${styleName(detail.flavour)}`);
  const newer = (detail.takes ?? []).filter((t) => t.createdAt > last.createdAt).length;
  if (newer > 0) out.push(`${newer === 1 ? "a lesson's Make" : `${newer} lessons' Makes`} went into it`);
  if (out.length === 0) return null;
  const line = andList(out);
  return `Since you released it, ${line}.`;
}

/** A song's release on the album: the unit, the release, and the album version it is. */
export interface SongTrackRelease {
  unitId: string;
  releaseId: number;
  version: number;
}

/**
 * Every album track that is a song release (`songs.list` → releases), by track id: its unit and its releases by
 * album version. The album row has no unit field; the songs list is what says a track is a song.
 */
export function songTracksOf(
  songs: readonly Pick<UnitSongSummary, "unitId" | "releases">[] | undefined,
): Map<string, { unitId: string; releases: SongTrackRelease[] }> {
  const out = new Map<string, { unitId: string; releases: SongTrackRelease[] }>();
  for (const s of songs ?? [])
    for (const r of s.releases) {
      if (!r.albumTrackId) continue;
      const t = out.get(r.albumTrackId) ?? { unitId: s.unitId, releases: [] };
      t.releases.push({ unitId: s.unitId, releaseId: r.id, version: r.albumVersion });
      out.set(r.albumTrackId, t);
    }
  return out;
}

/** How long a released song plays once through, in seconds: its bars at its tempo in its meter. */
export function snapshotSeconds(snapshot: Pick<UnitSongSnapshot, "bpm" | "def">): number {
  const cps = bpmToCps(snapshot.bpm, snapshot.def.meter);
  return cps > 0 ? songLengthBars(snapshot.def) / cps : 0;
}

/** The section a bar falls in, or `null`. */
export function sectionAtBar(view: SongView, bar: number): SongSectionId | null {
  return view.sections.find((s) => bar >= s.startBar && bar < s.startBar + s.bars)?.id ?? null;
}
