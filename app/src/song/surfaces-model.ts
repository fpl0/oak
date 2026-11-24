// What the song surfaces say and play, pure (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.5): the
// five styles, the sentence that says which cells a take holds, the song as it stood after any take, a release's
// frozen song, where the song is in its plan, which tracks a part's mute or solo acts on, and which release action
// the song page offers. Names come from `songViewOf`, so a section or part is named only once its term is met
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
import { oakTrackName, type SongBand, takeTrackName } from "@oak/strudel/song-compose";
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

/** The parts a set of cells holds (in song order) and where (section labels, a repeated label said once). */
function cellsWhat(
  view: SongView,
  cells: readonly string[],
): { names: string[]; parts: SongViewPartRef[]; where: string } | null {
  const keys = new Set(cells.filter(isCellKey));
  const parts = view.parts.filter((p) => view.sections.some((s) => keys.has(cellKey(p.id, s.id))));
  const sections = view.sections.filter((s) => view.parts.some((p) => keys.has(cellKey(p.id, s.id))));
  if (parts.length === 0) return null;
  const whole = sections.length === view.sections.length;
  const where = whole ? "the whole song" : andList(unique(sections.map((s) => s.label)));
  return { names: parts.map((p) => p.name), parts, where };
}

/** What a set of cells holds, in the view's words: "Kick and Snare in B", "Bass in A and C". `null` for none. */
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
  const names = (parts: readonly SongViewPartRef[]) => andList(parts.map((p) => lowerName(p.name)));
  const plays = played ? what.parts.filter((p) => played.has(p.id)) : what.parts;
  const rests = played ? what.parts.filter((p) => !played.has(p.id)) : [];
  if (plays.length === 0)
    return `Your code took over the ${names(rests)} in ${what.where}; ${rests.length === 1 ? "it rests" : "they rest"} there now.`;
  const yours = `The song now plays your ${names(plays)} in ${what.where}`;
  if (rests.length === 0) return `${yours}.`;
  return `${yours}; the ${names(rests)} ${rests.length === 1 ? "rests" : "rest"} there now.`;
}

type SongViewPartRef = { id: SongPartId; name: string };

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

/** How many cells of the song are the learner's, and of how many: "9 of 35 cells are yours". */
export function ownedCount(view: SongView): { yours: number; total: number } {
  const total = view.cells.filter((c) => !(c.owner === "oak" && c.rests)).length;
  return { yours: view.cells.filter((c) => c.owner === "yours").length, total };
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

export type LessonDotState = "yours" | "today" | "later" | "side";
export interface LessonDot {
  lessonId: LessonId;
  state: LessonDotState;
}

/**
 * One dot per lesson of the song's plan: `yours` for a take lesson that has a take in the song, `today` for the
 * lesson planned now, `side` for a side step, `later` for the rest.
 */
export function lessonDots(
  def: Pick<UnitSongDef, "plan">,
  detail: Pick<UnitSongDetail, "takes"> | null,
  today: string | null,
): LessonDot[] {
  const taken = new Set((detail?.takes ?? []).map((t) => t.lessonId as string));
  return def.plan.map((step) => ({
    lessonId: step.lesson,
    state:
      step.lesson === today
        ? "today"
        : step.kind === "side"
          ? "side"
          : taken.has(step.lesson)
            ? "yours"
            : "later",
  }));
}

// --- mute and solo per part ------------------------------------------------------------------------------

/**
 * The tracks a part plays on: Oak's track for it while Oak still holds a cell of it, and every take line that holds
 * one, by the take's labels (a track label → its part). A take line that plays several parts (a `drums:` line split
 * over the kick and the snare: label `null`) belongs to each of them, so muting one of those parts mutes the line.
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
  for (const t of takes) {
    if (!owners.has(String(t.id))) continue;
    const labels = Object.entries(t.labels);
    const mine = labels.filter(([, p]) => p === partId || p === null).map(([label]) => label);
    // A take with no labels recorded (a backfilled take): every line it plays.
    const lines = labels.length === 0 ? labelsOfCode(t.code) : mine;
    for (const label of lines) out.push(takeTrackName(t.lessonId, label));
  }
  return unique(out);
}

/** The labelled lines of a code (`drums:`, `kick:`), in order. */
function labelsOfCode(code: string): string[] {
  return unique([...code.matchAll(/^[ \t]*([a-z][a-z0-9_]*)[ \t]*:/gm)].map((m) => m[1] as string));
}

/** The player's mute map for the muted parts and the soloed one, over the tracks the song loaded. */
export function partMutes(
  def: UnitSongDef,
  detail: Pick<UnitSongDetail, "takes"> | null,
  state: { muted: ReadonlySet<SongPartId>; solo: SongPartId | null },
  loaded: readonly string[],
): MuteMap {
  const muted = new Set<string>();
  for (const p of state.muted) for (const t of partTracks(def, detail, p)) muted.add(t);
  if (state.solo) {
    const keep = new Set(partTracks(def, detail, state.solo));
    for (const t of loaded) if (!keep.has(t)) muted.add(t);
  }
  return { muted, solo: null };
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

/** The section a bar falls in, or `null`. */
export function sectionAtBar(view: SongView, bar: number): SongSectionId | null {
  return view.sections.find((s) => bar >= s.startBar && bar < s.startBar + s.bars)?.id ?? null;
}
