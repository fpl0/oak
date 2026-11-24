// The unit-song composer (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.2). A unit song is Oak's
// code (one `arrange()` per part) plus the learner's saved Make codes (sources), each owning cells of the song's grid
// (part × section, `@oak/content-kit` claims model). This module builds what is heard from them, at the pattern level:
//
//  - Oak's tracks are masked bar by bar (by onset) to the cells still owned by Oak;
//  - a source's loop is placed in every section where it still owns a cell, with `arrange()`'s restart (it starts
//    from its own bar 1 at each section), its drum hits filtered one by one to the parts it still owns there, its
//    pitched tracks kept where their part is still its own (a track that maps to no part plays wherever the source
//    owns any cell of the section, going past the brief);
//  - a source with its own `arrange()` (U09.L02 on) maps onto the song by section type, each learner section looping
//    inside the song section it fills (`ribbon`);
//  - the live Make (the code being edited) owns today's cells: the parts it declares and every part it plays, and,
//    when it plays chords, Oak's pitched parts except `oakKeeps`. Its own pattern is placed into today's sections.
//
// Pure: it imports `@strudel/core` and `@oak/content-kit` (plus band-form.ts's static `arrange()` reader) and never
// evaluates code. Both realms that play a song use it: the adapter (evaluation.ts: editor, pattern player, offline
// export) and the grader (the Workbench analysis), each with its own evaluator (`buildSong`'s `evaluate`). It lives in
// the grader package (`@oak/grader/song`) because the grader may not import the adapter (docs/design/interfaces.md
// §2); the adapter re-exports it unchanged as `@oak/strudel/song-compose`. `@strudel/core` is imported directly, not
// through runtime/strudel.ts, so the browser's main thread never loads the grader's mini/tonal/transpiler facade
// for it. Track names are `band.oak.<label>` and `band.take.<lessonId>.<label>` (`…<label>#<n>` for an older take of a
// lesson the song has several takes of): they start with `band.`, so `'*'` and roles never match them (contracts §6.2
// rule 5).
import {
  type CellKey,
  cellKey,
  claimsOf,
  drumPartsOfSound,
  type FlavourId,
  isCellKey,
  LABEL_ROLES,
  type LessonId,
  type LintContext,
  OAK_OWNER,
  ownedBy,
  type PlayedParts,
  partOfTrack,
  type SongPartId,
  type SongSectionId,
  type TakeStep,
  type TrackLabel,
  type UnitSongDef,
} from "@oak/content-kit";
import * as core from "@strudel/core";
import { learnerSectionsOf } from "./band-form.ts";
import { stripComments } from "./comments.ts";

type Pattern = Strudel.Pattern;
type Hap = Strudel.Hap;

/** A track's role as the claims model reads it (contracts §6.2 rule 1); `null` when nothing tells. */
export type SongTrackRole = "drums" | "bass" | "chords" | "melody";

/** A learner's saved Make code that went into the song (a take). */
export interface SongSource {
  /** Unique in the song (the take's id); never `"oak"` or `"live"`. */
  sourceId: string;
  lessonId: LessonId;
  code: string;
}

/** The id the live Make's cells carry in a composed grid. */
export const LIVE_SOURCE = "live" as const;

/** The Make being edited: its code is the evaluation's own code, and it owns today's cells while it is open. */
export interface SongLive {
  sourceId: typeof LIVE_SOURCE;
  /** Where today's code plays (the step's sections). */
  sections: SongSectionId[] | "all";
  /** The take step: its declared parts and `oakKeeps` decide, with what the code plays, the cells it takes. */
  step: TakeStep;
}

/** A unit song as it stands, ready to play (`BandSetup.song`). */
export interface SongBand {
  def: UnitSongDef;
  flavour: FlavourId;
  /** The song's tempo until the evaluated code sets one (the newest take's, else `def.bpm`). */
  bpm: number;
  /** The saved takes, oldest first. Their own `setcpm` is ignored. */
  sources: SongSource[];
  live?: SongLive;
  /** Who owns each cell from the saved takes (`resolveGrid`); the live Make's cells are added when it is composed. */
  grid: ReadonlyMap<CellKey, string>;
  /** Oak's code to play; default `def.code[flavour]`. A release snapshot passes its frozen code. */
  oakCode?: string;
}

/** A section of a source's own `arrange()`. */
export interface SourceSection {
  /** The section type (`verse`), or `null` for a `silence` section. */
  type: string | null;
  startBar: number;
  bars: number;
  /** The digit of a numbered variant (`melChorus2` → 2), when there is one. */
  variant?: number;
}

export interface SongTrackInput {
  label: string;
  role: SongTrackRole | null;
  pattern: Pattern;
}
export interface ComposeSource {
  sourceId: string;
  /** Names its tracks: `band.take.<lessonId>.<label>`. */
  lessonId: string;
  /** Its take number when it is an older take of its lesson (`olderTakeNumbers`): its tracks get `#<take>`. */
  take?: number;
  tracks: readonly SongTrackInput[];
  /** Its own `arrange()` (`sourceSectionsOf`), or `null` for a loop. */
  sections: readonly SourceSection[] | null;
}
export interface ComposeInput {
  def: UnitSongDef;
  lengthBars: number;
  oak: readonly { label: string; pattern: Pattern }[];
  sources: readonly ComposeSource[];
  grid: ReadonlyMap<CellKey, string>;
}
export interface ComposedTrack {
  track: string;
  pattern: Pattern;
}

export const OAK_TRACK_PREFIX = "band.oak.";
export const TAKE_TRACK_PREFIX = "band.take.";
export const oakTrackName = (label: string): string => `${OAK_TRACK_PREFIX}${label}`;
/**
 * A take's track: `band.take.<lessonId>.<label>`, with `#<take>` when the take is an older one of a lesson the song has
 * several takes of (`olderTakeNumbers`), so two takes of one lesson never share a track name (the analysis keys its
 * tracks by name, mutes and solos act on names).
 */
export const takeTrackName = (lessonId: string, label: string, take?: number): string =>
  `${TAKE_TRACK_PREFIX}${lessonId}.${label}${take ? `#${take}` : ""}`;

/**
 * The take number of every source that is not the newest take of its lesson in the song (sources oldest first):
 * 1 for the oldest. The newest keeps the plain name. A replayed lesson's older take, which keeps the cells the new one
 * did not claim, plays as `band.take.U01.L03.drums#1` beside the new `band.take.U01.L03.drums`.
 */
export function olderTakeNumbers(
  sources: readonly { sourceId: string; lessonId: string }[],
): Map<string, number> {
  const byLesson = new Map<string, string[]>();
  for (const s of sources) byLesson.set(s.lessonId, [...(byLesson.get(s.lessonId) ?? []), s.sourceId]);
  const out = new Map<string, number>();
  for (const ids of byLesson.values()) for (const [i, id] of ids.slice(0, -1).entries()) out.set(id, i + 1);
  return out;
}

/** Total bars of the song's form. */
export function songLengthBars(def: Pick<UnitSongDef, "sections">): number {
  return def.sections.reduce((n, s) => n + s.bars, 0);
}

interface PlacedSection {
  id: SongSectionId;
  type: string;
  startBar: number;
  bars: number;
  /** 1-based: the second chorus is occurrence 2 of type chorus. */
  occurrence: number;
}

/** The song's sections with their first bar and the occurrence of their type. */
function layoutOf(def: Pick<UnitSongDef, "sections">): PlacedSection[] {
  const seen = new Map<string, number>();
  let at = 0;
  return def.sections.map((s) => {
    const occurrence = (seen.get(s.type) ?? 0) + 1;
    seen.set(s.type, occurrence);
    const placed = { id: s.id, type: s.type, startBar: at, bars: s.bars, occurrence };
    at += s.bars;
    return placed;
  });
}

/**
 * The song's form for the Workbench (`GradeContext.songForm`, the form view and the section ribbon): one entry per
 * section, in order, with the label the caller gives it (term-gated by the app: letters until the section's term is
 * introduced). A section with no label is the letter of its type's first appearance (A, B, C…).
 */
export function songFormView(
  def: Pick<UnitSongDef, "sections">,
  labels: Readonly<Record<SongSectionId, string>>,
): { label: string; bars: number }[] {
  const letters = new Map<string, string>();
  return def.sections.map((s) => {
    if (!letters.has(s.type)) letters.set(s.type, String.fromCharCode(65 + (letters.size % 26)));
    return { label: labels[s.id] ?? (letters.get(s.type) as string), bars: s.bars };
  });
}

/** The sections of a source's own `arrange()`, read statically (band-form.ts), or `null` for a loop. */
export function sourceSectionsOf(code: string): SourceSection[] | null {
  const sections = learnerSectionsOf(code);
  if (!sections) return null;
  let at = 0;
  return sections.map((s) => {
    const digit = s.type === null ? null : /(\d+)$/.exec(s.ident);
    const out: SourceSection = { type: s.type, startBar: at, bars: s.bars };
    if (digit) out.variant = Number(digit[1]);
    at += s.bars;
    return out;
  });
}

/**
 * The learner section that fills a song section: a numbered variant matching the song section's occurrence
 * (`melChorus2` fills the second chorus), else the first learner section of the same type, else none.
 */
function learnerSectionFor(song: PlacedSection, sections: readonly SourceSection[]): SourceSection | null {
  const same = sections.filter((s) => s.type === song.type);
  if (same.length === 0) return null;
  if (song.occurrence > 1) {
    const variant = same.find((s) => s.variant === song.occurrence);
    if (variant) return variant;
  }
  return same[0] as SourceSection;
}

/**
 * The bars of a source that play in the song, as `[from, to)` spans of the source's own bars, merged: each song
 * section in `owned` plays a loop from its bar 1 for the section's length, or the learner section of its type for
 * at most that length. What a source plays (its role, the parts it claims) is read over these bars, so a part it
 * brings in after a long intro still counts.
 */
export function playedSpans(
  def: Pick<UnitSongDef, "sections">,
  owned: ReadonlySet<SongSectionId>,
  sections: readonly SourceSection[] | null,
): [number, number][] {
  const spans: [number, number][] = [];
  for (const s of layoutOf(def)) {
    if (!owned.has(s.id)) continue;
    if (!sections) {
      spans.push([0, s.bars]);
      continue;
    }
    const own = learnerSectionFor(s, sections);
    if (own) spans.push([own.startBar, own.startBar + Math.min(own.bars, s.bars)]);
  }
  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: [number, number][] = [];
  for (const [from, to] of spans) {
    const last = out.at(-1);
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  }
  return out;
}

/** What a source plays in one song section: its loop from bar 1, or the learner section of that type, looping. */
function sectionBody(
  pattern: Pattern,
  section: PlacedSection,
  sections: readonly SourceSection[] | null,
): Pattern | null {
  if (!sections) return pattern;
  const own = learnerSectionFor(section, sections);
  if (!own) return null;
  return (pattern.ribbon as (offset: number, cycles: number) => Pattern).call(
    pattern,
    own.startBar,
    own.bars,
  );
}

const arrange = (sections: [number, Pattern][]): Pattern => core.arrange(...sections) as Pattern;

/** The bar a hap starts in, inside a form of `length` bars that loops. */
function barOf(hap: Hap, length: number): number {
  const begin = (hap.whole ?? hap.part).begin.valueOf();
  const bar = Math.floor(begin + 1e-9);
  return ((bar % length) + length) % length;
}

const soundOf = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;
  const s = (value as Record<string, unknown>).s;
  return typeof s === "string" ? s : null;
};

/** A cache of `drumPartsOfSound` for one song (it is asked once per hap): empty when no drum part owns the sound. */
function drumParts(def: UnitSongDef): (sound: string) => readonly SongPartId[] {
  const cache = new Map<string, readonly SongPartId[]>();
  return (sound) => {
    let parts = cache.get(sound);
    if (!parts) {
      parts = drumPartsOfSound(def, sound);
      cache.set(sound, parts);
    }
    return parts;
  };
}

/** The part a learner track stands for when a hap's sound names no drum part. */
function trackPartOf(def: UnitSongDef, track: Pick<SongTrackInput, "label" | "role">): SongPartId | null {
  const exact = def.parts.find((p) => p.label === track.label)?.id ?? null;
  // A drum track's hits are split by sound; only an exact label (`kick:`) stands for one part as a whole.
  if (track.role === "drums") return exact;
  return exact ?? partOfTrack(def, track);
}

/**
 * The patterns Oak and the saved takes play (spec §5.2), in order: Oak's tracks (those that still own a cell), then
 * each source's tracks (those that play somewhere). The live Make is not here: its pattern is the evaluation's own
 * and is placed by `placeInSections` (`finishSong` does both).
 */
export function composeSongPatterns(input: ComposeInput): ComposedTrack[] {
  const { def, grid } = input;
  const layout = layoutOf(def);
  const length = Math.max(1, Math.round(input.lengthBars));
  const out: ComposedTrack[] = [];
  for (const { label, pattern } of input.oak) {
    const part = def.parts.find((p) => p.label === label);
    const bars = new Set<number>();
    for (const s of layout) {
      const owner = part ? (grid.get(cellKey(part.id, s.id)) ?? OAK_OWNER) : OAK_OWNER;
      if (owner === OAK_OWNER) for (let b = 0; b < s.bars; b++) bars.add((s.startBar + b) % length);
    }
    if (bars.size === 0) continue;
    const masked = bars.size >= length ? pattern : pattern.filterHaps((h) => bars.has(barOf(h, length)));
    out.push({ track: oakTrackName(label), pattern: masked });
  }
  const drumPartsOf = drumParts(def);
  for (const src of input.sources) {
    const owned = ownedBy(grid, src.sourceId).parts;
    if (owned.size === 0) continue;
    for (const t of src.tracks) {
      const whole = trackPartOf(def, t);
      let plays = false;
      const sections = layout.map((s): [number, Pattern] => {
        const parts = owned.get(s.id);
        const body = parts && parts.size > 0 ? sectionBody(t.pattern, s, src.sections) : null;
        if (!body || !parts) return [s.bars, core.silence as Pattern];
        plays = true;
        const kept = body.filterHaps((h) => {
          const sound = soundOf(h.value);
          // A hit of a drum part plays where the source still owns that part; a break (every drum part) where it
          // still owns any of them, since one sample cannot be split.
          const hit = sound === null ? [] : drumPartsOf(sound);
          if (hit.length > 0) return hit.some((p) => parts.has(p));
          return whole === null || parts.has(whole);
        });
        return [s.bars, kept];
      });
      if (plays)
        out.push({ track: takeTrackName(src.lessonId, t.label, src.take), pattern: arrange(sections) });
    }
  }
  return out;
}

/**
 * A pattern placed into some of the song's sections: each one plays it from its own bar 1 (`arrange()` restart),
 * or, for code with its own `arrange()`, the learner section of that type, looping. Every other bar is silent.
 */
export function placeInSections(
  def: Pick<UnitSongDef, "sections">,
  pattern: Pattern,
  owned: ReadonlySet<SongSectionId>,
  sections: readonly SourceSection[] | null,
): Pattern {
  return arrange(
    layoutOf(def).map((s): [number, Pattern] => {
      const body = owned.has(s.id) ? sectionBody(pattern, s, sections) : null;
      return [s.bars, body ?? (core.silence as Pattern)];
    }),
  );
}

// --- what a track plays (roles and played parts) --------------------------------------------------------------

/** What a track plays in its first bars: sounds, pitched onsets and how many of them sound together. */
export interface TrackFacts {
  /** Onsets read. */
  events: number;
  /** Distinct sound names (`bd`, `piano`). */
  sounds: string[];
  /** Onsets with a pitch. */
  pitched: number;
  /** Share of the pitched onsets (moments a pitch starts) where two or more pitches start together (chords). */
  chordShare: number;
  /** Median MIDI pitch of the pitched onsets. */
  medianMidi: number | null;
}

function midiOf(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const note = (value as Record<string, unknown>).note;
  if (typeof note === "number" && Number.isFinite(note)) return note;
  if (typeof note === "string") {
    try {
      const midi = core.noteToMidi(note) as number;
      return Number.isFinite(midi) ? midi : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** The most bars of a track `trackFacts` reads: a song's length at most (`defineUnitSong`). */
const FACT_BARS = 64;

type Spans = readonly (readonly [number, number])[];

/** The `[from, to)` bar ranges `trackFacts` reads: the first `bars` bars, or the spans, 64 bars at most in all. */
function factRanges(bars: number | Spans): [number, number][] {
  const spans: Spans = typeof bars === "number" ? [[0, Math.max(1, Math.ceil(bars))]] : bars;
  const out: [number, number][] = [];
  let budget = FACT_BARS;
  for (const [from, to] of spans) {
    const end = Math.min(to, from + budget);
    if (end <= from) continue;
    budget -= end - from;
    out.push([from, end]);
    if (budget <= 0) break;
  }
  return out;
}

/**
 * Reads a track's first `bars` bars, or the `[from, to)` bar spans of it that play (`playedSpans`), 64 bars at most
 * in all. A query that throws reads as nothing.
 */
export function trackFacts(pattern: Pattern, bars: number | Spans): TrackFacts {
  let onsets: { begin: number; value: unknown }[] = [];
  try {
    for (const [from, to] of factRanges(bars))
      for (const h of pattern.queryArc(from, to))
        if (h.hasOnset()) onsets.push({ begin: Number(h.whole?.begin.valueOf()), value: h.value });
  } catch {
    onsets = [];
  }
  return factsOfOnsets(onsets);
}

/** An evaluated onset as the grader reports it (`OakEvent`): enough of it for `trackFactsOfEvents`. */
export interface FactEvent {
  /** Its track (`drums`, `$0`, `main`; `band.*` is not the code's own). */
  track: string;
  /** Where it starts, in bars (`OakEvent.beginF`). */
  beginF: number;
  /** `value.s` and `value.note` as Strudel carries them. */
  s: string | null;
  note: string | number | null;
}

/**
 * `trackFacts` over a track's evaluated onsets instead of its pattern (the app reads a saved take from the grader's
 * events): the same bars, the same reading, so a saved take claims what the live Make claimed.
 */
export function trackFactsOfEvents(events: readonly FactEvent[], bars: number | Spans): TrackFacts {
  const ranges = factRanges(bars);
  return factsOfOnsets(
    events
      .filter((e) => ranges.some(([from, to]) => e.beginF >= from - 1e-9 && e.beginF < to - 1e-9))
      .map((e) => ({ begin: e.beginF, value: { s: e.s, note: e.note } })),
  );
}

function factsOfOnsets(onsets: readonly { begin: number; value: unknown }[]): TrackFacts {
  const sounds = new Set<string>();
  const pitches: number[] = [];
  const starts = new Map<number, number>();
  for (const h of onsets) {
    const s = soundOf(h.value);
    if (s !== null) sounds.add(s);
    const midi = midiOf(h.value);
    if (midi === null) continue;
    pitches.push(midi);
    starts.set(h.begin, (starts.get(h.begin) ?? 0) + 1);
  }
  // Onsets, not notes: a two-note chord among five single notes is one polyphonic onset in six (the grader's
  // `polyphonyRatio`, contracts §6.2 rule 1).
  let together = 0;
  for (const n of starts.values()) if (n > 1) together += 1;
  const sorted = [...pitches].sort((a, b) => a - b);
  return {
    events: onsets.length,
    sounds: [...sounds],
    pitched: pitches.length,
    chordShare: starts.size === 0 ? 0 : together / starts.size,
    medianMidi: sorted.length === 0 ? null : (sorted[Math.floor(sorted.length / 2)] as number),
  };
}

/** Below C3 a single line reads as a bass, above it as a tune (contracts §6.2 rule 1, per track). */
const BASS_BELOW = 48;

/**
 * A track's role: its label first (STYLE §2, `mel2` reads as `mel`), else what it plays: only unpitched hits are
 * drums, a quarter of the notes sounding together is chords, a single line is a bass below C3 and a tune above.
 */
export function roleOfTrack(label: string, facts: TrackFacts): SongTrackRole | null {
  const fixed = LABEL_ROLES[label.replace(/[2-4]$/, "") as TrackLabel];
  if (fixed) return fixed;
  if (facts.events === 0) return null;
  if (facts.pitched === 0) return facts.sounds.length > 0 ? "drums" : null;
  if (facts.chordShare >= 0.25) return "chords";
  return facts.medianMidi !== null && facts.medianMidi < BASS_BELOW ? "bass" : "melody";
}

/** The parts some code plays (claims model `PlayedParts`): drum hits by sound, pitched tracks by label and role. */
export function playedPartsOfTracks(
  def: UnitSongDef,
  tracks: readonly { label: string; role: SongTrackRole | null; facts: TrackFacts }[],
): PlayedParts {
  const parts = new Set<SongPartId>();
  const drumPartsOf = drumParts(def);
  let playsChords = false;
  for (const t of tracks) {
    if (t.facts.events === 0) continue;
    for (const s of t.facts.sounds) for (const p of drumPartsOf(s)) parts.add(p);
    if (t.role === "chords") playsChords = true;
    if (t.role === "drums") {
      const exact = def.parts.find((p) => p.label === t.label && p.role === "drums");
      if (exact && t.facts.sounds.every((s) => drumPartsOf(s).length === 0)) parts.add(exact.id);
    } else if (t.facts.pitched > 0) {
      const p = partOfTrack(def, { label: t.label, role: t.role });
      if (p) parts.add(p);
    }
  }
  return { parts, playsChords };
}

// --- what a Make claims: one reading for the live Make and its saved take --------------------------------------

/** Where a Make's code plays in the song: the sections it fills and the bars of it that play there. */
export interface MakeReading {
  /** The step, its sections narrowed to today's (song order). */
  step: TakeStep;
  /** The sections the code fills: today's, or those its own `arrange()` names (U09.L02 on). */
  owned: ReadonlySet<SongSectionId>;
  /** `owned` when the code has its own `arrange()`, else `undefined` (a loop fills every section of the step). */
  filled: SongSectionId[] | undefined;
  /** Its own `arrange()` (`sourceSectionsOf`), or `null` for a loop. */
  sections: SourceSection[] | null;
  /** The bars of the code that play in the song (`playedSpans`): what it plays is read over these. */
  spans: [number, number][];
  /** The bars to evaluate to read every span (the end of the last one), 1 at least. */
  bars: number;
}

/**
 * Where a Make plays in the song, read statically from its code: `sections` are today's sections (the step's, or the
 * live band's `live.sections`). The live Make (`finishSong`) and the take its Save records read it the same way.
 */
export function makeReading(
  def: UnitSongDef,
  sections: readonly SongSectionId[] | "all",
  step: TakeStep,
  code: string,
): MakeReading {
  const own = sourceSectionsOf(code);
  const wanted = new Set(sections === "all" ? def.sections.map((s) => s.id) : sections);
  const layout = layoutOf(def).filter((s) => wanted.has(s.id));
  const filled = own ? layout.filter((s) => learnerSectionFor(s, own) !== null).map((s) => s.id) : undefined;
  const owned = new Set(filled ?? layout.map((s) => s.id));
  const spans = playedSpans(def, owned, own);
  return {
    step: { ...step, sections: layout.map((s) => s.id) },
    owned,
    filled,
    sections: own,
    spans,
    bars: Math.max(1, Math.ceil(spans.at(-1)?.[1] ?? 1)),
  };
}

/** What a Make plays and the cells it takes. */
export interface MakeClaims {
  /** Its tracks with the role the claims model reads (`roleOfTrack`) and what they play over the spans. */
  tracks: { label: string; role: SongTrackRole | null; facts: TrackFacts }[];
  played: PlayedParts;
  /** `claimsOf`: the step's declared parts, every part it plays, Oak's pitched parts when it plays chords. */
  cells: CellKey[];
}

/** The cells a Make takes from what its tracks play over `reading.spans` (`trackFacts` / `trackFactsOfEvents`). */
export function makeClaims(
  def: UnitSongDef,
  reading: MakeReading,
  tracks: readonly { label: string; facts: TrackFacts }[],
): MakeClaims {
  const read = tracks.map((t) => ({ label: t.label, facts: t.facts, role: roleOfTrack(t.label, t.facts) }));
  const played = playedPartsOfTracks(def, read);
  return { tracks: read, played, cells: claimsOf(def, reading.step, played, reading.filled) };
}

/**
 * `makeClaims` from the grader's evaluation of the code alone (its `events`, queried from bar 1 over at least
 * `reading.bars` bars): the code's own tracks (`band.*` left out), read as the live Make's patterns are.
 */
export function makeClaimsOfEvents(
  def: UnitSongDef,
  reading: MakeReading,
  events: readonly FactEvent[],
): MakeClaims {
  const byTrack = new Map<string, FactEvent[]>();
  for (const e of events) {
    if (e.track.startsWith("band.")) continue;
    byTrack.set(e.track, [...(byTrack.get(e.track) ?? []), e]);
  }
  return makeClaims(
    def,
    reading,
    [...byTrack].map(([label, evs]) => ({ label, facts: trackFactsOfEvents(evs, reading.spans) })),
  );
}

// --- the whole song: build (async, per realm) and finish (sync) -------------------------------------------------

/** Evaluates code into labelled tracks with the code's own tempo neutralised (each realm brings its own). */
export type SongEvaluator = (code: string) => Promise<{ label: string; pattern: Pattern }[]>;
/** Whether a code may play (the Band lint, the export's bounds). A source that may not falls back to Oak. */
export type SongCheck = (code: string, who: "oak" | "source") => boolean;

/**
 * The lint a unit song's code passes before it plays (spec 2026-11-24 §5.2), for a `SongCheck` built on the one lint:
 * Oak's code is authored Band code (profile `band`); a learner's saved take is the learner's own code, linted as the
 * Studio lints it (profile `studio`), so a take that ran when it was saved still plays in the song instead of
 * falling back to Oak. Previews are allowed for both.
 */
export function songLintContext(ctx: LintContext, who: "oak" | "source"): LintContext {
  return { ...ctx, profile: who === "oak" ? "band" : "studio", allowPreview: true };
}

/** Oak's code for the song's flavour (pop when the flavour has none), or `null`. */
export function oakCodeOf(band: Pick<SongBand, "def" | "flavour" | "oakCode">): string | null {
  if (typeof band.oakCode === "string") return band.oakCode;
  const code = band.def.code as Partial<Record<FlavourId, string>>;
  return code[band.flavour] ?? code["flavour.pop" as FlavourId] ?? null;
}

/** A song's evaluated parts, before the live Make is known. */
export interface BuiltSong {
  /** The band, its grid with the cells of every dropped source handed back to Oak. */
  band: SongBand;
  oak: { label: string; pattern: Pattern }[];
  sources: {
    sourceId: string;
    lessonId: string;
    tracks: { label: string; pattern: Pattern }[];
    sections: SourceSection[] | null;
  }[];
  /** Sources that failed their check or their evaluation. */
  dropped: string[];
}

/** The grid with every cell of `sources` given back to Oak. */
function toOak(grid: ReadonlyMap<CellKey, string>, sources: readonly string[]): ReadonlyMap<CellKey, string> {
  const gone = new Set(sources);
  const out = new Map<CellKey, string>();
  for (const [key, owner] of grid) out.set(key, gone.has(owner) ? OAK_OWNER : owner);
  return out;
}

/**
 * Evaluates Oak's code and every source that still owns a cell. Oak's code failing its check or its evaluation
 * throws (the song cannot play); a source that fails is dropped and its cells go back to Oak, so one broken take never
 * silences the song.
 */
export async function buildSong(
  band: SongBand,
  evaluate: SongEvaluator,
  check?: SongCheck,
): Promise<BuiltSong> {
  const code = oakCodeOf(band);
  if (code === null || code.trim() === "") throw new Error(`the song has no code for ${band.flavour}`);
  if (check && !check(code, "oak")) throw new Error("the song's code did not pass its check");
  const oak = await evaluate(code);
  const sources: BuiltSong["sources"] = [];
  const dropped: string[] = [];
  for (const s of band.sources) {
    if (ownedBy(band.grid, s.sourceId).parts.size === 0) continue;
    if (s.sourceId === OAK_OWNER || s.sourceId === LIVE_SOURCE || (check && !check(s.code, "source"))) {
      dropped.push(s.sourceId);
      continue;
    }
    try {
      const tracks = await evaluate(s.code);
      sources.push({
        sourceId: s.sourceId,
        lessonId: s.lessonId,
        tracks,
        sections: sourceSectionsOf(s.code),
      });
    } catch {
      dropped.push(s.sourceId);
    }
  }
  return {
    band: dropped.length > 0 ? { ...band, grid: toOak(band.grid, dropped) } : band,
    oak,
    sources,
    dropped,
  };
}

/** The song as it plays for one evaluation. */
export interface FinishedSong {
  /** Oak's and the sources' tracks, named `band.oak.*` and `band.take.*` (untagged: the caller tags them). */
  tracks: ComposedTrack[];
  /** The grid, with the live Make's cells when there is one. */
  grid: ReadonlyMap<CellKey, string>;
  /** Places the evaluation's own pattern (the live Make) into today's sections; `null` without a live Make. */
  place: ((pattern: Pattern) => Pattern) | null;
  /** What the live Make plays, or `null`. */
  played: PlayedParts | null;
}

/**
 * Composes a built song with the live Make's tracks (`live.tracks`, as the evaluation registered them, and its
 * code for its own `arrange()`). The live Make claims its step's declared parts and every part it plays in the
 * sections it fills (`claimsOf`), over the saved takes.
 */
export function finishSong(
  built: BuiltSong,
  live: { tracks: readonly { label: string; pattern: Pattern }[]; code: string } | null,
): FinishedSong {
  const { band } = built;
  const def = band.def;
  const lengthBars = songLengthBars(def);
  const withRole = (
    t: { label: string; pattern: Pattern },
    spans: readonly (readonly [number, number])[],
  ) => {
    const facts = trackFacts(t.pattern, spans);
    return { label: t.label, pattern: t.pattern, facts, role: roleOfTrack(t.label, facts) };
  };
  let grid = band.grid;
  let place: FinishedSong["place"] = null;
  let played: PlayedParts | null = null;
  if (band.live && live) {
    const reading = makeReading(def, band.live.sections, band.live.step, live.code);
    // What the Make plays, read over every bar of it that plays in the song (not just its first bars).
    const claim = makeClaims(
      def,
      reading,
      live.tracks.map((t) => ({ label: t.label, facts: trackFacts(t.pattern, reading.spans) })),
    );
    played = claim.played;
    const next = new Map(grid);
    for (const c of claim.cells) if (next.has(c)) next.set(c, LIVE_SOURCE);
    grid = next;
    place = (pattern) => placeInSections(def, pattern, reading.owned, reading.sections);
  }
  const takes = olderTakeNumbers(band.sources);
  const tracks = composeSongPatterns({
    def,
    lengthBars,
    oak: built.oak,
    sources: built.sources.map((s) => ({
      sourceId: s.sourceId,
      lessonId: s.lessonId,
      ...(takes.has(s.sourceId) && { take: takes.get(s.sourceId) as number }),
      sections: s.sections,
      tracks: s.tracks.map((t) => {
        const owned = new Set(ownedBy(grid, s.sourceId).parts.keys());
        const r = withRole(t, playedSpans(def, owned, s.sections));
        return { label: r.label, role: r.role, pattern: r.pattern };
      }),
    })),
    grid,
  });
  return { tracks, grid, place, played };
}

// --- static helpers for the app --------------------------------------------------------------------------------

const LABEL_LINE = /^[ \t]*([A-Za-z_$][\w$]*)[ \t]*:(?!:)/gm;

/** The track names a code registers, read statically in source order (`$:` → `$0`, `$1`; `_x`/`x_` muted). */
export function labelsOf(code: string): string[] {
  const out: string[] = [];
  let anonymous = 0;
  for (const m of stripComments(code).matchAll(LABEL_LINE)) {
    const label = m[1] as string;
    if (label.startsWith("_") || label.endsWith("_")) continue;
    const name = label.includes("$") ? `${label}${anonymous++}` : label;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * The song's track names without `band.` (`oak.kick`, `take.U01.L01.drums`), read statically: `BandSetup.tracks`
 * for a song (the Workbench's heard Band parts). Oak's parts that still own a cell, then the labels of every source
 * that still owns one. The live Make's claims are not known before it runs, so Oak's parts it takes stay listed.
 */
export function songBandTracks(band: SongBand): string[] {
  const out: string[] = [];
  const takes = olderTakeNumbers(band.sources);
  for (const p of band.def.parts) {
    const oakOwns = band.def.sections.some(
      (s) => (band.grid.get(cellKey(p.id, s.id)) ?? OAK_OWNER) === OAK_OWNER,
    );
    if (oakOwns) out.push(oakTrackName(p.label).slice("band.".length));
  }
  for (const s of band.sources) {
    if (ownedBy(band.grid, s.sourceId).parts.size === 0) continue;
    for (const label of labelsOf(s.code)) {
      const name = takeTrackName(s.lessonId, label, takes.get(s.sourceId)).slice("band.".length);
      if (!out.includes(name)) out.push(name);
    }
  }
  return out;
}

/** A song band as plain JSON (the grader's worker and the Bun subprocess host take no `Map`). */
export interface SongBandWire extends Omit<SongBand, "grid"> {
  grid: [string, string][];
}
export function songBandToWire(band: SongBand): SongBandWire {
  return { ...band, grid: [...band.grid] };
}
export function songBandFromWire(wire: SongBandWire): SongBand {
  const grid = new Map<CellKey, string>();
  for (const [key, owner] of wire.grid) if (isCellKey(key) && typeof owner === "string") grid.set(key, owner);
  return { ...wire, grid };
}
