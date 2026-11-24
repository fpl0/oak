// The analysis path (architecture §2.2): an `EvalResult` from the grader host → `NEvent`s (`normalize`)
// → view events with location roles, degrees and bar/beat positions → the NotationModel and ABC
// (`@oak/notation`). Pure and synchronous, so it runs the same in the browser and in bun tests.
import type {
  CodeRange,
  KeySpec,
  MeterId,
  MeterSpec,
  NEvent,
  PickupSpec,
  Rat,
  SwingSpec,
} from "@oak/content-kit";
import { R } from "@oak/content-kit";
import {
  type EvalResult,
  type EvalSuccess,
  type GraderErrorInfo,
  keyAt,
  keyAtBarOf,
  type Normalized,
  normalize,
  type TrackKeyContext,
  trackKeyContexts,
} from "@oak/grader";
import {
  type AbcResult,
  buildScore,
  type ChordLabel,
  type ChordLabelSet,
  chordLabelInput,
  clefOfTrack,
  type Score,
  type SectionMark,
  type StaffKind,
  sectionMarks,
  spelledByEvent,
} from "@oak/notation";
import {
  barPosition,
  isDominantSeventhSymbol,
  keyFromScaleCtx,
  METERS,
  parseChordSymbol,
  parseNote,
} from "@oak/theory";
import { type AnnotationKinds, annotateAbc, annotationText, NO_ANNOTATIONS } from "./annotate.ts";
import { primaryRanges } from "./code-roles.ts";
import {
  chordReading,
  keyPlanOf,
  type ModeMark,
  modeMarkOf,
  type WorkbenchColour,
  workbenchColour,
} from "./colour.ts";
import { type WorkbenchHarmony, workbenchHarmony } from "./harmony.ts";
import { linesOf, type WorkbenchLines } from "./lines.ts";
import { type ChordRole, chordRoleOf, type PitchLabel, pitchLabel } from "./music.ts";
import { type WorkbenchTrack, workbenchTrack } from "./track-lens.ts";

export interface ViewEvent {
  /** `NEvent.id`: stable for the same code; the link bus, the roll and the staff share it. */
  id: string;
  track: string;
  /** Index of the track in source order (Band tracks last): the part colour. */
  trackIndex: number;
  band: boolean;
  onset: number;
  end: number;
  onsetRat: Rat;
  durRat: Rat;
  midi: number | null;
  s?: string;
  drum?: NonNullable<NEvent["drum"]>;
  chordSymbol?: string;
  gain: number;
  /** Every contributing atom (as Strudel reports them). */
  locs: CodeRange[];
  /** The atoms that made the event (the note, the step, the drum sound): what the views link to. */
  primary: CodeRange[];
  /** 1-based display bar. */
  bar: number;
  beat: number;
  beatLabel: string;
  label: PitchLabel | null;
  /** Role in its chord ("R", "3", "5", "7"; tensions "9", "13") when the event carries a chord symbol. */
  chordTone: ChordRole | null;
  /**
   * Wave 6: the label once chromatic degrees are taught (`tb.n.chromatic`, U15.L01), when the chord under the note
   * decides its reading otherwise than `label` (G♯ under E7 is ♯5 "si", not ♭6 "le"). Absent: `label` stands.
   * `applyDepth` (depth.ts) picks one for the learner.
   */
  labelTaught?: PitchLabel;
}

export interface WorkbenchModel {
  code: string;
  cps: number;
  bpm: number;
  cpsSet: boolean;
  /** Track names in source order; Band tracks last. */
  tracks: string[];
  /** Bars analysed (cycles 0 … bars). */
  bars: number;
  totalBars: number | null;
  truncated: boolean;
  meter: MeterSpec;
  /**
   * The piece's key: the first key of the learner's code (its first `.scale()`), else the declared key, else
   * an estimate from the notes (Wave 3: `trackKeyContexts`, prefer "code"). Every event is labelled in the key
   * of its own track and bar (`keySpans`, `keyContexts`), which differs from this one in a patterned `.scale()`.
   */
  key: KeySpec | null;
  /** The learner piece's keys in time order (a patterned `.scale("<C4:major G4:major>")` gives several). */
  keySpans: PieceKeySpan[];
  /** Each track's key spans (the grader's seam, wave3.md §3.3). */
  keyContexts: TrackKeyContext[];
  events: ViewEvent[];
  byId: ReadonlyMap<string, ViewEvent>;
  score: Score | null;
  abc: AbcResult | null;
  notationError: string | null;
  diagnostics: EvalSuccess["diagnostics"];
  /** What the staff pages are engraved from (`staffPage`); null when there is no staff. `score`/`abc` are page 0. */
  staffSource: StaffSource | null;
  /**
   * Wave 4: the chords as they sound (the grader's `harmonyView`, wave4.md §3.2), with what the chord band, the
   * chord lenses and the lead sheet show; null when the piece plays no chords.
   */
  harmony: WorkbenchHarmony | null;
  /** The declared pickup (cycle 0 is the pickup bar, contracts §6.11), when the host gave one. */
  pickup: PickupSpec | null;
  /**
   * Wave 5 (lines.ts): the form from `arrange()`, the bass line's roles, blue notes and swing per track. Absent on a
   * model built without them (tests that build a model by hand).
   */
  lines?: WorkbenchLines | null;
  /**
   * Wave 6 (colour.ts): sevenths, applied and borrowed chords, guide tones, the key plan, the mode's colour tone,
   * pushes, ghost notes and the beat grid. Absent on a model built without them (tests that build one by hand).
   */
  colour?: WorkbenchColour | null;
  /**
   * Wave 7 (track-lens.ts): tensions, voicings, chord-scales, ii–V brackets and substitutions, the clave, pulse lanes,
   * microtiming and swing, registers, density and the odd meter's groups. Absent on a model built without them.
   */
  track?: WorkbenchTrack | null;
}

/** The staff engraves at most this many bars at a time; longer loops turn pages with the playhead. */
export const STAFF_PAGE_BARS = 8;

/** Fewest pitched notes a key estimate needs before notes are labelled in it. */
export const ESTIMATE_MIN_NOTES = 7;

/** A stretch of the piece in one key, in cycles (bars). */
export interface PieceKeySpan {
  from: number;
  to: number;
  key: KeySpec;
  source: "declared" | "scale" | "estimate";
}

/** The key of the piece at `cycle` (wrapped into nothing: the span containing it, else the nearest before). */
export function keyAtCycle(spans: readonly PieceKeySpan[], cycle: number): KeySpec | null {
  let found: PieceKeySpan | null = null;
  for (const s of spans) {
    if (s.from <= cycle + 1e-9) found = s;
    if (s.from <= cycle + 1e-9 && cycle < s.to - 1e-9) return s.key;
  }
  return (found ?? spans[0] ?? null)?.key ?? null;
}

const sameKey = (a: KeySpec | null, b: KeySpec | null) =>
  a === b || (a !== null && b !== null && a.tonic === b.tonic && a.mode === b.mode);

/**
 * The learner piece's key spans: from the first learner track (in source order) that reads a `.scale()`, else
 * the first pitched learner track. Neighbouring spans in the same key merge.
 */
export function pieceKeySpans(
  contexts: readonly TrackKeyContext[],
  trackOrder: readonly string[] = [],
): PieceKeySpan[] {
  // Source order (the first track the learner wrote, usually the melody), not the grader's order.
  const rank = (t: string) => {
    const i = trackOrder.indexOf(t);
    return i < 0 ? trackOrder.length : i;
  };
  const learner = contexts
    .filter((c) => !c.band && c.spans.length > 0)
    .sort((a, b) => rank(a.track) - rank(b.track));
  const ctx = learner.find((c) => c.spans.some((s) => s.source === "scale")) ?? learner[0];
  if (!ctx) return [];
  const out: PieceKeySpan[] = [];
  for (const s of ctx.spans) {
    const span = { from: R.toNum(s.from), to: R.toNum(s.to), key: s.key, source: s.source };
    const last = out[out.length - 1];
    if (last && sameKey(last.key, span.key)) last.to = Math.max(last.to, span.to);
    else out.push(span);
  }
  return out;
}

/** The distinct keys of the piece, in order of appearance. */
export function pieceKeys(spans: readonly PieceKeySpan[]): KeySpec[] {
  const out: KeySpec[] = [];
  for (const s of spans) if (!out.some((k) => sameKey(k, s.key))) out.push(s.key);
  return out;
}

/**
 * Labelled tracks whose `.scale()` is followed by a `.transpose()` (contracts §6.8 item 3, lint
 * `code.transpose-after-scale`): their scale context names the wrong key, so they are read another way.
 */
export function transposedAfterScale(code: string): string[] {
  const out: string[] = [];
  const re = /^\s*([A-Za-z_]\w*)\s*:/gm;
  const starts: { name: string; at: number }[] = [];
  for (let m = re.exec(code); m; m = re.exec(code)) starts.push({ name: m[1] as string, at: m.index });
  starts.forEach((s, i) => {
    const text = code.slice(s.at, starts[i + 1]?.at ?? code.length);
    if (/\.scale\s*\([\s\S]*\.transpose\s*\(/.test(text)) out.push(s.name);
  });
  return out;
}

export interface StaffSource {
  events: readonly NEvent[];
  meter: MeterSpec;
  /** The key signature of page 0 (each page takes the key at its first bar from `keySpans`). */
  key: KeySpec | null;
  keySpans: readonly PieceKeySpan[];
  /**
   * Tracks whose code states their own key (`.scale()`) unlike the piece's (a bass in G-flat under a melody in
   * C): their staff shows its own signature. Absent or empty: one signature for every staff.
   */
  trackKeySpans?: Readonly<Record<string, readonly PieceKeySpan[]>>;
  staff: StaffKind;
  /** Grand staff split (by track when the piece has several pitched tracks). */
  split: "register" | "track";
  /** Rhythm counts under a percussion staff (the notation package's own lyric line). */
  labels: "none" | "counts";
  /** The annotation lines under the staff and the text of each, per event (in its own track's key). */
  annotations: AnnotationKinds;
  labelOf: (eventId: string) => PitchLabel | null;
  /**
   * The label of an event as the staff spells it (`written`: the staff's name for it), when that differs from
   * `labelOf`'s (an approach tone the staff leans into its target, D♯ into E; a blue five by its motion). The
   * texts under a head then never name another note than the head shows. Absent: `labelOf` is used as is.
   */
  relabel?: (eventId: string, written: string) => PitchLabel | null;
  tempoBpm: number;
  /** Bars analysed. */
  bars: number;
  /** Bars per page. */
  pageBars: number;
  /** Bars per staff line, when the view knows its width (`barsPerLineFor`); else `barsPerLineOf` decides. */
  barsPerLine?: number;
  /** Wave 4: chord labels (absolute bars) and which of them show (symbols above, numerals below). */
  chordLabels?: readonly ChordLabel[];
  chordSet?: ChordLabelSet;
  /** Bar 0 is a pickup (engraved as a partial measure on the first page). */
  pickup?: PickupSpec;
  /** Wave 5: the sections of the piece (absolute 0-based bars): a label and a double barline at each. */
  sections?: readonly SectionMark[];
  /**
   * The swing the code plays (contracts §6.10 item 2: filled from the measured swing for a sketch): the staff prints
   * the swung lines straight under "Swing 8ths" / "Swing 16ths" instead of as triplets.
   */
  swing?: SwingSpec;
  /** Wave 7: chord symbols in jazz glyphs ("C∆7", "D–7", "Bø7"); absent: lead-sheet spelling. */
  chordStyle?: "lead-sheet" | "jazz";
}

export interface StaffPage {
  page: number;
  /** 0-based first bar of the page. */
  startBar: number;
  bars: number;
  score: Score | null;
  abc: AbcResult | null;
  error: string | null;
}

/** Pages of a staff source (1 for loops up to `pageBars`). */
export function staffPageCount(src: Pick<StaffSource, "bars" | "pageBars">): number {
  return Math.max(1, Math.ceil(src.bars / Math.max(1, src.pageBars)));
}

/**
 * Engraves one page: the events whose onset falls in it, shifted to start at bar 0. Event IDs are kept, so
 * the HighlightBus links the page's notes to the roll and the code exactly as on page 0.
 */
export function staffPage(src: StaffSource, page: number): StaffPage {
  const p = Math.max(0, Math.min(staffPageCount(src) - 1, Math.floor(page)));
  const startBar = p * src.pageBars;
  const bars = Math.max(1, Math.min(src.pageBars, src.bars - startBar));
  const shift: Rat = [startBar, 1];
  const events = src.events
    .filter((e) => {
      const on = R.toNum(e.onset);
      return on >= startBar && on < startBar + bars;
    })
    .map((e) => ({ ...e, onset: R.sub(e.onset, shift) }));
  try {
    const key = src.keySpans.length > 0 ? keyAtCycle(src.keySpans, startBar) : src.key;
    // A key that changes at a bar line inside the page (a patterned `.scale()`) changes the signature there,
    // so every note is spelled, and its accidental written, against the key it is in.
    const changesIn = (spans: readonly PieceKeySpan[]) =>
      spans
        .filter((s) => Number.isInteger(s.from) && s.from > startBar && s.from < startBar + bars)
        .map((s) => ({ bar: s.from - startBar, key: s.key }));
    const keyChanges = changesIn(src.keySpans);
    const trackKeys = Object.fromEntries(
      Object.entries(src.trackKeySpans ?? {}).flatMap(([track, spans]) => {
        const k = keyAtCycle(spans, startBar);
        return k ? [[track, { key: k, keyChanges: changesIn(spans) }] as const] : [];
      }),
    );
    const labels =
      src.chordLabels && src.chordSet
        ? chordLabelInput(
            src.chordLabels
              .filter((l) => l.bar >= startBar && l.bar < startBar + bars)
              .map((l) => ({ ...l, bar: l.bar - startBar })),
            src.chordSet,
          )
        : {};
    const sections = (src.sections ?? [])
      .filter((m) => m.bar >= startBar && m.bar < startBar + bars)
      .map((m) => ({ ...m, bar: m.bar - startBar }));
    const score = buildScore({
      events,
      meter: src.meter,
      ...labels,
      ...(sections.length > 0 ? { sections } : {}),
      ...(src.pickup && startBar === 0 ? { pickup: src.pickup } : {}),
      ...(src.swing ? { swing: src.swing } : {}),
      ...(src.chordStyle ? { chordStyle: src.chordStyle } : {}),
      key,
      ...(keyChanges.length ? { keyChanges } : {}),
      ...(Object.keys(trackKeys).length ? { trackKeys } : {}),
      bars,
      staff: src.staff,
      split: src.split,
      labels: src.labels,
      tempoBpm: src.tempoBpm,
    });
    // The texts follow the heads: an event the staff spells otherwise than its label is relabelled as drawn.
    const spelled = src.relabel ? spelledByEvent(score) : null;
    const labelFor = (id: string): PitchLabel | null => {
      const l = src.labelOf(id);
      const sp = spelled?.get(id);
      if (!l || !sp || sp.name === l.name || !src.relabel) return l;
      return src.relabel(id, sp.name) ?? l;
    };
    const abc = annotateAbc(
      score,
      {
        barsPerLine: src.barsPerLine ?? barsPerLineOf(score, src.annotations),
        // Only the page that ends the piece ends with the final barline.
        finalBar: startBar + bars >= src.bars,
      },
      src.annotations,
      (_n, ids) => annotationText(ids.map(labelFor), src.annotations),
    );
    return { page: p, startBar, bars, score, abc, error: null };
  } catch (err) {
    return {
      page: p,
      startBar,
      bars,
      score: null,
      abc: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Bars per staff line: four, or fewer when lines of text sit under busy bars, so the texts under the notes do not
 * run into each other (abcjs spaces notes by their length, not their lyrics). Degree numbers are narrow: two bars
 * a line past five notes a bar. Syllables and note names are words ("sol", "F♯5"): two bars a line past three
 * notes a bar, one bar past seven.
 */
export function barsPerLineOf(score: Score, lines: AnnotationKinds): number {
  if (!lines.degree && !lines.solfege && !lines.noteName) return 4;
  let most = 0;
  for (const st of score.staves)
    for (const b of st.voices[0]?.bars ?? [])
      most = Math.max(most, b.items.filter((it) => it.kind !== "rest" && !it.tieFromPrev).length);
  const words = lines.solfege || lines.noteName;
  if (words && most > 7) return 1;
  return most > (words ? 3 : 5) ? 2 : 4;
}

/**
 * The most text a bar carries under its notes on one staff, in note texts: every note that starts in the bar on
 * that staff, so a chord's three names count three ("E♭4 G♭4 B♭4" is as wide as three single notes' names) and a
 * chord under a tune on the same staff adds its own (Wave 4 review: a chord on every beat under a tune printed its
 * names over each other). On a grand staff (`grand`) the treble and bass staves have their own text lines, so each
 * is counted alone and the busier one decides (the gate: a tune over a chord a bar on the bass staff paged one bar
 * at a time). Notes go to staves as `@oak/notation` puts them: whole tracks by clef when the tracks divide, else by
 * register at middle C.
 */
export function busiestBar(events: readonly NEvent[], opts: { grand?: boolean } = {}): number {
  const pitched = events.filter((e) => e.midi !== null);
  let staffOf = (_e: NEvent) => 0;
  if (opts.grand) {
    const tracks = [...new Set(pitched.map((e) => e.track))];
    const low = new Set(
      tracks.filter(
        (t) =>
          clefOfTrack(
            t,
            pitched.filter((e) => e.track === t).map((e) => e.midi as number),
          ) === "bass",
      ),
    );
    staffOf =
      low.size > 0 && low.size < tracks.length
        ? (e) => (low.has(e.track) ? 1 : 0)
        : (e) => ((e.midi as number) < 60 ? 1 : 0);
  }
  const per = new Map<string, number>();
  for (const e of pitched) {
    const key = `${staffOf(e)}:${Math.floor(R.toNum(e.onset))}`;
    per.set(key, (per.get(key) ?? 0) + 1);
  }
  let most = 0;
  for (const n of per.values()) most = Math.max(most, n);
  return most;
}

/**
 * Bars per staff line for a staff `width` px wide: as many bars as fit with room under every note for its texts
 * (abcjs spaces notes by length, so short notes under long words collide). Note names ("F♯5") need the most room,
 * syllables less, degree numbers least; the clef, signature and time take the start of each line. 1 to 4.
 */
export function barsPerLineFor(most: number, lines: AnnotationKinds, width: number): number {
  if (!lines.degree && !lines.solfege && !lines.noteName) return 4;
  const perNote = lines.noteName ? 40 : lines.solfege ? 30 : 18;
  const need = Math.max(1, most) * perNote + 20;
  const room = width - 30 - 90;
  return Math.max(1, Math.min(4, Math.floor(room / need)));
}

/**
 * Bars per staff page once the lines are known: at most four lines of music, three when two or more lens lines
 * sit under each (a system is then half as tall again), half as many for a grand staff, whose systems are two
 * staves tall. A narrow host with words under busy bars then never stacks eight one-bar systems; the staff pages
 * with the playhead instead. Never more than the source's own page.
 */
export function pageBarsFor(
  pageBars: number,
  barsPerLine: number,
  staves: number,
  textLines: number,
): number {
  const lines = textLines >= 2 ? 3 : 4;
  const systems = staves > 1 ? Math.max(1, Math.floor(lines / 2)) : lines;
  return Math.max(1, Math.min(pageBars, Math.max(1, barsPerLine) * systems));
}

export type ModelOutcome =
  | { ok: true; model: WorkbenchModel; result: EvalSuccess }
  | { ok: false; error: GraderErrorInfo; result: EvalResult };

export interface ModelOptions {
  meter: MeterId | MeterSpec;
  /** The lesson's key; when absent, the events' `.scale()` context is used. */
  key: KeySpec | null;
  /** Staff to engrave; `false` skips notation. */
  staff: StaffKind | false;
  /** Rhythm counts under a percussion staff (the old single lyric line; degrees and syllables: `annotations`). */
  staffLabels?: "none" | "degree" | "solfege" | "counts";
  /** Annotation lines under the staff (the lenses, or a lesson step's `staffLabels`). */
  annotations?: AnnotationKinds;
  /** Whose key labels the notes: the code's `.scale()` first (views, default) or the declared key (grading). */
  keyPrefer?: "code" | "declared";
  /** Most bars engraved at a time (the staff is the slow view; longer loops page). Default 8. */
  maxStaffBars?: number;
  /** A declared pickup: the harmony's bar numbers and the staff's first bar follow it. */
  pickup?: PickupSpec | null;
  /** Wave 7: chord symbols on the staff in jazz glyphs (`tb.feature.jazz-glyphs`, J1.L02). Default lead-sheet. */
  chordStyle?: "lead-sheet" | "jazz";
  /**
   * The Band parts the learner hears (a step's `ui.band.tracks`, less the parts muted in the Workbench). The
   * harmony (chord band, numerals, function) reads only these: a Band bass that does not play must not turn the
   * learner's IV into IV⁶₄ on the chord band. The roll still draws every Band part. Absent: all of them.
   */
  bandHeard?: readonly string[] | null;
}

function meterSpec(m: MeterId | MeterSpec): MeterSpec {
  return typeof m === "string" ? METERS[m] : m;
}

/** Wave 2's key context (the declared key, else the first `.scale()`); views now read `keySpans`. */
export function keyContext(declared: KeySpec | null, events: readonly NEvent[]): KeySpec | null {
  if (declared) return declared;
  for (const e of events) {
    if (e.scaleCtx) {
      const k = keyFromScaleCtx(e.scaleCtx);
      if (k) return k;
    }
  }
  return null;
}

/** The normalized piece with only the Band parts the learner hears (`null`: all of them). */
export function heardBand(n: Normalized, heard: readonly string[] | null): Normalized {
  if (heard === null) return n;
  const keep = new Set(heard.map((r) => `band.${r}`));
  const band = n.band.filter((e) => keep.has(e.track));
  if (band.length === n.band.length) return n;
  const byTrack = Object.fromEntries(
    Object.entries(n.byTrack).filter(([t]) => !t.startsWith("band.") || keep.has(t)),
  );
  return { ...n, band, byTrack };
}

export function buildModel(code: string, result: EvalResult, opts: ModelOptions): ModelOutcome {
  if (!result.ok) return { ok: false, error: result.error, result };
  const meter = meterSpec(opts.meter);
  const n = normalize(result, { meter: meter.id });
  // A scale step the code alters (`n("2b")`) keeps the code's accidental on the staff and in the labels.
  const learner = alteredSteps(code, n.all);
  const all: NEvent[] = [...learner, ...n.band];
  // A key guessed from a handful of letter-name notes would label them wrongly as often as not: an estimate
  // is used only with at least ESTIMATE_MIN_NOTES pitched notes to go on (as the staff's own key estimate).
  const pitchedCount = learner.filter((e) => e.midi !== null).length;
  const keyContexts = trackKeyContexts(n, {
    declared: opts.key,
    prefer: opts.keyPrefer ?? "code",
    ignoreScaleCtx: transposedAfterScale(code),
  }).map((c) =>
    pitchedCount >= ESTIMATE_MIN_NOTES ? c : { ...c, spans: c.spans.filter((s) => s.source !== "estimate") },
  );
  const keySpans = pieceKeySpans(keyContexts, result.tracks);
  const key = keySpans[0]?.key ?? opts.key ?? keyContext(null, learner);
  const spellings = spellingOf(all);
  const blues = bluesContext(all);
  const trackIndex = new Map(result.tracks.map((t, i) => [t, i] as const));

  // The chords first (Wave 6): each note's label can then follow the chord under it.
  const heard = heardBand(n, opts.bandHeard ?? null);
  const analysedBars = Math.max(1, result.bars);
  const plan = keyPlanOf(heard, {
    code,
    meter: meter.id,
    key,
    bars: analysedBars,
    pickup: opts.pickup ?? null,
  });
  let harmony: WorkbenchHarmony | null = null;
  try {
    harmony = workbenchHarmony(heard, {
      meter: meter.id,
      key,
      bars: analysedBars,
      ...(opts.pickup ? { pickup: opts.pickup } : {}),
      ...(plan.spans.length > 1
        ? { keyPlan: plan.spans.map((sp) => ({ from: sp.fromBar - 1, to: sp.toBar, key: sp.key })) }
        : {}),
    });
  } catch {
    harmony = null;
  }
  let colour: WorkbenchColour | null = null;
  try {
    colour = workbenchColour(heard, harmony?.piece ?? heard, harmony, plan, {
      code,
      meter: meter.id,
      key,
      bars: analysedBars,
      pickup: opts.pickup ?? null,
    });
  } catch {
    colour = null;
  }
  const chordSpans = (colour?.harmony?.chords ?? []).map((c, i, list) => ({
    from: R.toNum(c.at),
    to: list[i + 1] ? R.toNum((list[i + 1] as typeof c).at) : Number.POSITIVE_INFINITY,
    chord: c.chord,
  }));
  const chordUnder = (onset: number) =>
    chordSpans.find((sp) => onset >= sp.from - 1e-9 && onset < sp.to - 1e-9)?.chord;
  const modeMarks = new Map<string, ModeMark>();
  // Wave 6 (definition of done 16): the key in force. A track that states its own key (`.scale()`) is read in
  // it bar by bar; a track that states none (a `chord()` line, `note()` names) follows the piece's key plan, so
  // after a lift from C to D its C♯ is 7 (ti), not ♯1.
  const statesKey = new Map(
    keyContexts.map((c) => [c.track, c.spans.some((sp) => sp.source === "scale")] as const),
  );
  const keyOfEvent = (e: NEvent): KeySpec | null => {
    const own = keyAt(keyContexts, e.track, e.onset);
    if (plan.spans.length < 2 || statesKey.get(e.track) || e.track.startsWith("band.")) return own;
    return keyAtBarOf(plan, R.floor(e.onset) + 1) ?? own;
  };

  const events: ViewEvent[] = all.map((e) => {
    const onset = R.toNum(e.onset);
    const end = R.toNum(R.add(e.onset, e.dur));
    const pos = barPosition(e.onset, meter);
    const chord = e.chordSymbol ? (parseChordSymbol(e.chordSymbol) ?? undefined) : undefined;
    const eventKey = e.midi === null ? null : keyOfEvent(e);
    const v: ViewEvent = {
      id: e.id,
      track: e.track,
      trackIndex: trackIndex.get(e.track) ?? result.tracks.length,
      band: e.track.startsWith("band."),
      onset,
      end,
      onsetRat: e.onset,
      durRat: e.dur,
      midi: e.midi,
      gain: e.gain,
      locs: e.locs,
      primary: primaryRanges(code, e.locs, e.midi !== null),
      bar: pos.bar,
      beat: pos.beat,
      beatLabel: pos.label,
      label:
        e.midi === null
          ? null
          : pitchLabel(
              e.midi,
              eventKey,
              chord,
              spellings.get(e.id)?.direction,
              spellings.get(e.id)?.written,
              blues,
            ),
      chordTone: e.midi !== null && e.chordSymbol ? chordRoleOf(e.midi, e.chordSymbol) : null,
    };
    // A chromatic note the code does not spell itself: once chromatic degrees are taught, the chord under it
    // says whether it is raised or lowered (U15.L01). A blues keeps its blue notes.
    const d = v.label?.degree;
    if (e.midi !== null && eventKey && d && !d.inKey && !blues && !spellings.get(e.id)?.written) {
      const under = chord ?? chordUnder(onset);
      const dir = under ? chordReading(e.midi, eventKey, under, d.label) : null;
      if (dir) {
        const taught = pitchLabel(e.midi, eventKey, chord, dir, undefined, blues);
        if (taught.degree && taught.degree.label !== d.label) v.labelTaught = taught;
      }
    }
    if (e.midi !== null && !v.band) {
      const mark = modeMarkOf(e.midi, eventKey);
      if (mark) modeMarks.set(e.id, mark);
    }
    if (e.s !== undefined) v.s = e.s;
    if (e.drum !== undefined) v.drum = e.drum;
    if (e.chordSymbol !== undefined) v.chordSymbol = e.chordSymbol;
    return v;
  });
  events.sort((a, b) => a.onset - b.onset || a.trackIndex - b.trackIndex || (a.midi ?? -1) - (b.midi ?? -1));

  if (colour) colour = { ...colour, mode: modeMarks };

  let lines: WorkbenchLines | null = null;
  try {
    lines = linesOf(heard, {
      code,
      meter: meter.id,
      key,
      pickup: opts.pickup ?? null,
      bars: Math.max(1, result.bars),
      ...(plan.spans.length > 1 ? { keyOf: keyOfEvent } : {}),
    });
  } catch {
    lines = null;
  }

  let track: WorkbenchTrack | null = null;
  try {
    track = workbenchTrack(heard, {
      code,
      meter,
      key,
      bars: analysedBars,
      harmony: harmony ? { view: harmony.view, regions: harmony.regions } : null,
      sections: lines?.sections ?? [],
      swing: (lines?.swing ?? []).map((t) => ({
        track: t.track,
        swung: t.swung,
        ratio:
          t.swung === 8
            ? Number.isFinite(t.eighths.ratio)
              ? t.eighths.ratio
              : null
            : t.swung === 16 && Number.isFinite(t.sixteenths.ratio)
              ? t.sixteenths.ratio
              : null,
      })),
    });
  } catch {
    track = null;
  }

  let score: Score | null = null;
  let abc: AbcResult | null = null;
  let notationError: string | null = null;
  let staffSource: StaffSource | null = null;
  if (opts.staff !== false && learner.length > 0) {
    const labelOf = new Map(events.map((e) => [e.id, e.label] as const));
    const byNEvent = new Map(learner.map((e) => [e.id, e] as const));
    const legacy = opts.staffLabels ?? "none";
    const pitchedTracks = new Set(learner.filter((e) => e.midi !== null).map((e) => e.track));
    // Only keys the code states (`.scale()` on every stretch of the track), never an estimate or the lesson's.
    const trackKeySpans: Record<string, PieceKeySpan[]> = {};
    for (const c of keyContexts) {
      if (c.band || c.spans.length === 0 || !c.spans.every((sp) => sp.source === "scale")) continue;
      trackKeySpans[c.track] = pieceKeySpans([c]);
    }
    staffSource = {
      events: learner,
      meter,
      key,
      keySpans,
      ...(Object.keys(trackKeySpans).length > 1 ? { trackKeySpans } : {}),
      staff: opts.staff,
      split: pitchedTracks.size > 1 ? "track" : "register",
      labels: legacy === "counts" ? "counts" : "none",
      annotations: opts.annotations ?? {
        ...NO_ANNOTATIONS,
        degree: legacy === "degree",
        solfege: legacy === "solfege",
      },
      labelOf: (id) => labelOf.get(id) ?? null,
      relabel: (id, written) => {
        const e = byNEvent.get(id);
        if (!e || e.midi === null) return null;
        const chord = e.chordSymbol ? (parseChordSymbol(e.chordSymbol) ?? undefined) : undefined;
        const l = pitchLabel(e.midi, keyAt(keyContexts, e.track, e.onset), chord, undefined, written, blues);
        return l.name === written ? l : null;
      },
      tempoBpm: Math.round(result.bpm),
      bars: Math.max(1, result.bars),
      pageBars: Math.max(1, opts.maxStaffBars ?? STAFF_PAGE_BARS),
      ...(harmony ? { chordLabels: harmony.labels } : {}),
      ...(opts.pickup ? { pickup: opts.pickup } : {}),
      ...(lines && lines.sections.length > 0 ? { sections: sectionMarks(lines.sections) } : {}),
      ...(opts.chordStyle === "jazz" ? { chordStyle: "jazz" as const } : {}),
    };
    const swing = staffSwingOf(lines?.swing ?? []);
    if (swing) staffSource.swing = swing;
    const first = staffPage(staffSource, 0);
    score = first.score;
    abc = first.abc;
    notationError = first.error;
  }

  return {
    ok: true,
    result,
    model: {
      code,
      cps: result.cps,
      bpm: result.bpm,
      cpsSet: result.cpsSet,
      tracks: result.tracks,
      bars: result.bars,
      totalBars: result.totalBars,
      truncated: result.truncated,
      meter,
      key,
      keySpans,
      keyContexts,
      events,
      byId: new Map(events.map((e) => [e.id, e] as const)),
      score,
      abc,
      notationError,
      diagnostics: result.diagnostics,
      staffSource,
      harmony,
      pickup: opts.pickup ?? null,
      lines,
      colour,
      track,
    },
  };
}

/**
 * How each pitched event is spelled, the same way the staff spells it (`@oak/notation` `spellVoice`), so a label
 * never contradicts the note drawn above it:
 * - a note the code names (`note("f5")`, `note("eb4")`) keeps the code's letter and accidental — a natural
 *   included: `f5` in G major is F♮ (♭7), never E♯ (♯6);
 * - otherwise only a chromatic *passing* note (one note between two neighbours a step or less away, moving the
 *   same way) is spelled by its motion (A♯ rising = ♯6, G♭ falling = ♭5; theory `labelPitch`); neighbours and
 *   leaps keep the key's default chromatic spelling (♭3 ♯4 ♭6 ♭7 ♭2 in major).
 * Only chromatic notes use the direction; `written` is the code's spelling (shown as the note name).
 */
export function spellingOf(events: readonly NEvent[]): Map<string, { direction?: 1 | -1; written?: string }> {
  const byTrack = new Map<string, NEvent[]>();
  for (const e of events) if (e.midi !== null) byTrack.set(e.track, [...(byTrack.get(e.track) ?? []), e]);
  const out = new Map<string, { direction?: 1 | -1; written?: string }>();
  for (const list of byTrack.values()) {
    // Slots: the events of the track at one onset (a chord is one slot), in time order.
    const slots = new Map<number, NEvent[]>();
    for (const e of list) {
      const at = R.toNum(e.onset);
      slots.set(at, [...(slots.get(at) ?? []), e]);
    }
    const ordered = [...slots.entries()].sort((a, b) => a[0] - b[0]).map(([, es]) => es);
    ordered.forEach((slot, i) => {
      const single = slot.length === 1;
      const cur = slot[0]?.midi ?? 0;
      const prev = ordered[i - 1]?.length === 1 ? ordered[i - 1]?.[0]?.midi : undefined;
      const next = ordered[i + 1]?.length === 1 ? ordered[i + 1]?.[0]?.midi : undefined;
      const near = (m: number | null | undefined): m is number =>
        m != null && m !== cur && Math.abs(m - cur) <= 2;
      let motion: 1 | -1 | undefined;
      if (single && near(prev) && near(next)) {
        if (prev < cur && cur < next) motion = 1;
        else if (prev > cur && cur > next) motion = -1;
      }
      for (const e of slot) {
        const midi = Math.round(e.midi as number);
        const w = e.written ? parseNote(e.written) : null;
        if (w && w.midi === midi) {
          const acc = w.alt > 0 ? "#".repeat(w.alt) : "b".repeat(-w.alt);
          out.set(e.id, { written: `${w.letter}${acc}${w.oct}` });
        } else if (motion) out.set(e.id, { direction: motion });
      }
    });
  }
  return out;
}

/**
 * The swing the staff prints for a piece (contracts §6.10 items 2–3): the subdivision and exact amount every swung
 * learner track shares (measured by the grader's `swingView`), `null` when nothing swings or the swung tracks
 * disagree (8ths in one, 16ths or another amount in another: the staff then shows what plays). Straight tracks are
 * untouched by it (only onsets at the swung position move).
 */
export function staffSwingOf(
  tracks: readonly {
    swung: 8 | 16 | null;
    eighths: { p: Rat | null };
    sixteenths: { p: Rat | null };
  }[],
): SwingSpec | null {
  const swung = tracks.filter((t) => t.swung !== null);
  const first = swung[0];
  if (!first) return null;
  const sub = first.swung as 8 | 16;
  const pOf = (t: (typeof swung)[number]) => (sub === 8 ? t.eighths.p : t.sixteenths.p);
  const p = pOf(first);
  if (!p) return null;
  if (swung.some((t) => t.swung !== sub || !pOf(t) || R.toNum(pOf(t) as Rat) !== R.toNum(p))) return null;
  const amount = (2 * p[0]) / p[1] - 1;
  return amount > 0 && amount < 1 ? { subdivision: sub, amount } : null;
}

const STEP_LETTERS = "CDEFGAB";
const LETTER_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Seven-note scales, where a step is a letter: `n("2b")` on them is the third letter, flattened. */
const HEPTATONIC =
  /^(?:major|minor|ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian|harmonic minor|melodic minor)$/;

/**
 * The written name of a scale step the code alters with an accidental (`n("2b")`, `n("3#")` on a seven-note scale):
 * the step's letter with the accidental the sound needs, so `n("0 2b 2").scale("C4:major")` is C E♭ E — the flat
 * the code wrote — and never C D♯ E, which the staff's approach-tone rule would otherwise choose. `null` for any
 * other event (no accidental, a pentatonic or blues scale, `note()`, a double accidental).
 */
export function alteredStepName(code: string, e: NEvent): string | null {
  if (e.pitchSource !== "n-scale" || e.midi === null || !e.scaleCtx) return null;
  const ctx = /^([A-G])([#b]*)-?\d*\s+(.+)$/.exec(e.scaleCtx.trim());
  if (!ctx || !HEPTATONIC.test((ctx[3] as string).trim().toLowerCase())) return null;
  let step: number | null = null;
  for (const l of e.locs) {
    const m = /^(-?\d+)([#b]+)$/.exec(code.slice(l.from, l.to).trim());
    if (m) {
      step = Number(m[1]);
      break;
    }
  }
  if (step === null) return null;
  const letter = STEP_LETTERS[(((STEP_LETTERS.indexOf(ctx[1] as string) + step) % 7) + 7) % 7] as string;
  const midi = Math.round(e.midi);
  for (let oct = -1; oct <= 9; oct++) {
    const alt = midi - (12 * (oct + 1) + (LETTER_PC[letter] as number));
    // A step altered twice over (`6b` on the ♭7 of a minor key) is left to the key's own spelling (C, not D𝄫).
    if (Math.abs(alt) <= 2)
      return Math.abs(alt) === 2 ? null : `${letter}${alt > 0 ? "#" : alt < 0 ? "b" : ""}${oct}`;
  }
  return null;
}

/** The learner's events, each altered scale step carrying its written name (`alteredStepName`). */
export function alteredSteps(code: string, events: readonly NEvent[]): NEvent[] {
  if (!/\d[#b]/.test(code)) return [...events];
  return events.map((e) => {
    const written = alteredStepName(code, e);
    return written ? { ...e, written } : e;
  });
}

/**
 * The melody of a lead sheet (Wave 4): the analysed melody line (the skyline of the melody track, wave4.md §3.2),
 * else every learner line that plays one note at a time, else every pitched learner note. Normalized events, so the
 * lead sheet keeps the IDs that link it to the roll and the code.
 */
export function leadEvents(model: Pick<WorkbenchModel, "staffSource" | "harmony">): NEvent[] {
  const all = (model.staffSource?.events ?? []).filter((e) => e.midi !== null);
  const melody = model.harmony?.melody;
  if (melody && melody.size > 0) {
    const line = all.filter((e) => melody.has(e.id));
    if (line.length > 0) return line;
  }
  const perTrack = new Map<string, Map<string, number>>();
  for (const e of all) {
    const m = perTrack.get(e.track) ?? new Map<string, number>();
    const k = `${e.onset[0]}/${e.onset[1]}`;
    m.set(k, (m.get(k) ?? 0) + 1);
    perTrack.set(e.track, m);
  }
  const lines = new Set(
    [...perTrack].filter(([, m]) => [...m.values()].every((c) => c === 1)).map(([t]) => t),
  );
  const first = all.find((e) => lines.has(e.track))?.track;
  return first ? all.filter((e) => e.track === first) : all;
}

/** Events sounding at `cycle` (wrapped into the analysed bars): the clock → roll/staff highlight. */
export function activeAt(model: Pick<WorkbenchModel, "events" | "bars">, cycle: number): string[] {
  if (model.bars <= 0 || !Number.isFinite(cycle) || cycle < 0) return [];
  const c = cycle % model.bars;
  const out: string[] = [];
  for (const e of model.events) {
    if (e.onset > c) break;
    if (c < e.end) out.push(e.id);
  }
  return out;
}

/**
 * Whether the piece is a blues for the degree lens (as @oak/notation's `bluesContext`): a line on a blues scale, or
 * chords that are all dominant sevenths on two roots or more (a 12-bar of I7 IV7 V7).
 */
export function bluesContext(events: readonly Pick<NEvent, "scaleCtx" | "chordSymbol">[]): boolean {
  // The grader's `scaleCtx` reads "C4 blues" / "A3 minor blues".
  if (events.some((e) => e.scaleCtx && /\bblues\b/i.test(e.scaleCtx))) return true;
  const symbols = events.flatMap((e) => (e.chordSymbol ? [e.chordSymbol] : []));
  if (symbols.length === 0 || !symbols.every(isDominantSeventhSymbol)) return false;
  return new Set(symbols.map((x) => parseChordSymbol(x)?.rootPc ?? x)).size >= 2;
}
