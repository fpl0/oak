// Rubric rules → analyzers (exercises §3.10, contracts §5.6 and §6.6). Every rule returns whether it is
// met, a numeric value and target where it has one (partial credit `min(1, value / target)`), and a
// deterministic detail line for `rubric.unmet` / `rubric.met`.
import type {
  CadenceType,
  Diagnostic,
  KeySpec,
  Loc,
  NEvent,
  Rat,
  RubricRule,
  SectionRef,
} from "@oak/content-kit";
import { R, rat } from "@oak/content-kit";
import type { ChordId } from "@oak/theory";
import {
  arrivesOn,
  degreeOf,
  isMinorish,
  METERS,
  noteToMidi,
  parseChordSymbol,
  parseRN,
  pcOf,
  relativeKey,
  rnToChord,
  romanOf,
  spellMidi,
  toLeadSheet,
  triadCore,
} from "@oak/theory";
import type { ChordSlot } from "../analyze/chords.ts";
import {
  brokenChordSlots,
  cadenceAt,
  cadenceChords,
  chordChanges,
  chordPerBar,
  chordSlots,
  chordsOfRomans,
  findSchema,
  guideToneLine,
  harmonicRhythm,
  matchProgression,
  romanShown,
  romanText,
  schemaRomans,
  slotAt,
  slotPcs,
  unclustered,
  voiceLeadingOfSlots,
} from "../analyze/chords.ts";
import { locAt, mean, mod12, onsets, pitched, ratKey, sounding } from "../analyze/events.ts";
import { energyCurve, formMatches, spanStats } from "../analyze/form.ts";
import { grooveLock } from "../analyze/groove.ts";
import { keyEstimate, keyFromContext, keyOf } from "../analyze/key.ts";
import { keysByBar } from "../analyze/key-plan.ts";
import {
  barChordAt,
  chordToneRatio,
  degreeSequence,
  isStrong,
  melodyLine,
  motifReuse,
  pitchRange,
  scaleMembership,
  stepLeap,
} from "../analyze/melody.ts";
import { syncopation } from "../analyze/meter.ts";
import { detectDevices, harmonySlots, heardSymbols } from "../analyze/piece.ts";
import { transposeAfterScaleTracks } from "../analyze/scale-context.ts";
import { resolveSection, sectionsFromAst } from "../analyze/sections.ts";
import { pickSwingTrack, swingRatio } from "../analyze/swing.ts";
import {
  loopPassBars,
  periodOf,
  selectTrack,
  selectTracks,
  sliceNormalized,
  tracksOfRole,
} from "../analyze/tracks.ts";
import { diag, toolText } from "../feedback/catalog.ts";
import { noteName } from "../match/common.ts";
import { runMatcher } from "../match/index.ts";
import type { Normalized } from "../types.ts";
import type { RubricContext } from "./context.ts";
import type { CorrectionDeps } from "./corrections-rules.ts";
import { correctionRules, placeText } from "./corrections-rules.ts";
import {
  chordInversionsRule,
  chordQualitiesRule,
  isGateRule,
  nonChordTonesRule,
  pickupRule,
  voiceLeadingGateRule,
} from "./harmony-rules.ts";
import {
  bassLineRule,
  bluesFormRule as bluesFormWave5,
  degreeAnyOf,
  endsOverRule,
  notatesRule,
  scopeToSection,
  unscope,
} from "./wave5-rules.ts";
import {
  chordsLeftBehind,
  containsRnWave6,
  formWave6,
  guideTonesWave6,
  liftedChordName,
  modeRule as modeWave6,
  modulationRule,
  notBuiltYet,
  reharmonizeRule,
  ruleKeys,
  slotKeys,
  tupletsRule,
  unbuiltWave6,
  velocityGhostsRule as velocityGhostsWave6,
} from "./wave6-rules.ts";
import { wave7CustomRules } from "./wave7-custom.ts";
import {
  claveRule,
  euclidRule,
  noMuddyLowRule,
  polyrhythmRule,
  registerSepRule,
  unbuiltWave7,
  voiceLeadingTopRule,
  wave7CustomStubs,
} from "./wave7-rules.ts";

export interface RuleEval {
  ok: boolean;
  value?: number;
  target?: number;
  /** Partial credit when it is not `min(1, value / target)` (rules with an upper bound). */
  credit?: number;
  detail: string;
  where?: Loc;
  /** Findings beyond `rubric.unmet` (`form.inconsistent-arrange`, `rhythm.swing-missing`, ...). */
  extra?: Diagnostic[];
}

type RuleOf<K extends RubricRule["rule"]> = Extract<RubricRule, { rule: K }>;
type Impl<K extends RubricRule["rule"]> = (rule: RuleOf<K>, n: Normalized, ctx: RubricContext) => RuleEval;

const fmt = (x: number, digits = 2): string =>
  Number.isInteger(x) ? String(x) : x.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
const pct = (x: number): string => `${Math.round(x * 100)}%`;
const times = (n: number): string => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** Bars of the piece: the AST total, else the queried bars, else through the last event. */
export function pieceBars(n: Normalized, ctx: RubricContext): number {
  if (ctx.totalBars) return ctx.totalBars;
  if (ctx.bars) return ctx.bars;
  return n.all.reduce((m, e) => Math.max(m, R.floor(e.onset) + 1), 0);
}
/** Bars of music actually present (the queried window). */
const windowBars = (n: Normalized, ctx: RubricContext): number =>
  Math.max(
    ctx.bars ?? 0,
    n.all.reduce((m, e) => Math.max(m, R.floor(e.onset) + 1), 0),
  );

export function pieceKey(n: Normalized, ctx: RubricContext): KeySpec | null {
  return keyOf(n.all, ctx.key ?? null);
}
/**
 * Chord slots of the piece: the harmony tracks (symbols first), bass from every pitched learner track.
 * `exclude` leaves a line out of both (the line a rule checks against the chords, such as
 * `chord-tones-strong` with `melody: "bass"`), so it never takes part in naming the chord it is checked
 * against.
 */
export function pieceSlots(n: Normalized, track?: string, opts: { exclude?: string } = {}): ChordSlot[] {
  const out = opts.exclude ? new Set(selectTrack(n, opts.exclude).map((e) => e.id)) : null;
  const keep = (es: readonly NEvent[]): NEvent[] => (out ? es.filter((e) => !out.has(e.id)) : [...es]);
  // A symbol counts only where it is heard as a chord (`heardSymbols`): `chord(changes).rootNotes(2)` under a
  // muted chords line is a bass line, so the right names on a silent comping line never pass (J4.L01, J4.L02).
  // An unheard symbol's notes stay as plain notes.
  const plainOf = (es: readonly NEvent[]): NEvent[] => {
    const heard = new Set(heardSymbols(es).map((e) => e.id));
    return es.map((e) => {
      if (e.chordSymbol === undefined || heard.has(e.id)) return e;
      const { chordSymbol: _unheard, ...rest } = e;
      return rest as NEvent;
    });
  };
  const all = plainOf(keep(selectTrack(n, track ?? "*")));
  const symbolic = all.filter((e) => e.chordSymbol !== undefined);
  // The harmony tracks' own hand-voiced chords count beside their symbols (a chorus voiced by hand under a
  // verse of `chord()`); a melody or bass track never makes a chord here.
  const symTracks = new Set(symbolic.map((e) => e.track));
  const chords =
    symbolic.length > 0
      ? all.filter((e) => e.chordSymbol !== undefined || (e.midi !== null && symTracks.has(e.track)))
      : track
        ? all
        : plainOf(keep(tracksOfRole(n, "chords").flatMap((t) => n.byTrack[t] ?? [])));
  const bass = pitched(keep(n.all));
  const slots = chordSlots(chords.length > 0 ? chords : all, { bass }).map(unclustered);
  // A chord track played as a broken chord (`.arp()`) sounds one note at a time: read it bar by bar.
  if (symbolic.length === 0 && chords.length > 0 && slots.every((sl) => !sl.chord) && isBroken(chords))
    return brokenChordSlots(chords, { bass });
  return slots;
}
/** No two notes of the line ever sound together: a broken chord (or a melody), never a block chord. */
function isBroken(events: readonly NEvent[]): boolean {
  const notes = pitched(events);
  return notes.length >= 3 && notes.every((e) => sounding(notes, e.onset).length <= 1);
}
const coreEq = (a: ChordId | null, b: ChordId | null): boolean =>
  !!a && !!b && triadCore(a).rootPc === triadCore(b).rootPc && triadCore(a).quality === triadCore(b).quality;
/** A chord's seventh, as a family (a 9th or 13th keeps its seventh's family); null for a triad or a sixth. */
function seventhFamily(c: ChordId): "dom" | "maj7" | "m7" | "m7b5" | "dim7" | "mMaj7" | null {
  const q = c.quality;
  if (q === "m7b5") return "m7b5";
  if (q === "dim7") return "dim7";
  if (q === "mMaj7") return "mMaj7";
  if (/^maj(7|9|13)/.test(q)) return "maj7";
  if (/^m(7|9|11|13)/.test(q)) return "m7";
  if (/^(7|9|11|13)/.test(q)) return "dom";
  return null;
}
/**
 * W7 gate (review:teaching-jazz): where the numeral asks for a seventh (III7, ii7, I∆7) the heard chord's seventh
 * must be that one: a maj7 bridge is not "four dominant sevenths". A numeral without a seventh reads the triad only.
 */
const seventhEq = (heard: ChordId | null, want: ChordId | null): boolean => {
  if (!coreEq(heard, want)) return false;
  const w = want ? seventhFamily(want) : null;
  return w === null || (heard ? seventhFamily(heard) : null) === w;
};
const keyName = (k: KeySpec): string => `${k.tonic} ${k.mode}`;

// --- rules --------------------------------------------------------------------------------------

const bars: Impl<"bars"> = (r, n, ctx) => {
  const v = pieceBars(n, ctx);
  const ok = (r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max);
  const range =
    r.min !== undefined && r.max !== undefined
      ? r.min === r.max
        ? `${r.min}`
        : `${r.min}–${r.max}`
      : r.min !== undefined
        ? `at least ${r.min}`
        : `at most ${r.max}`;
  return {
    ok,
    value: v,
    ...(r.min !== undefined ? { target: r.min } : {}),
    ...(r.max !== undefined && v > r.max ? { credit: r.max / v } : {}),
    detail: `${v} bar${v === 1 ? "" : "s"}; the brief asks for ${range}`,
  };
};
const durationSecRule: Impl<"duration-sec"> = (r, n, ctx) => {
  const sec = n.cps > 0 ? pieceBars(n, ctx) / n.cps : 0;
  return {
    ok: sec >= r.min - 1e-9,
    value: Math.round(sec * 10) / 10,
    target: r.min,
    detail: `${fmt(sec, 1)} s long; at least ${r.min} s`,
  };
};
const tempoBpm: Impl<"tempo-bpm"> = (r, n) => {
  const v = Math.round(n.bpm * 100) / 100;
  const ok = (r.min === undefined || v >= r.min - 1e-6) && (r.max === undefined || v <= r.max + 1e-6);
  return { ok, value: v, detail: `${fmt(v)} BPM; the brief asks for ${r.min ?? "any"}–${r.max ?? "any"}` };
};
const tracks: Impl<"tracks"> = (r, n) => {
  const live = Object.keys(n.byTrack).filter(
    (t) => !t.startsWith("band.") && (n.byTrack[t]?.length ?? 0) > 0,
  );
  if (!r.roles || r.roles.length === 0)
    return {
      ok: live.length >= r.min,
      value: live.length,
      target: r.min,
      detail: `${live.length} part${live.length === 1 ? "" : "s"}; at least ${r.min}`,
    };
  const wanted = r.roles.filter((x) => x !== "all") as ("drums" | "bass" | "chords" | "melody")[];
  const of = new Set(wanted.flatMap((role) => tracksOfRole(n, role).filter((t) => live.includes(t))));
  const absent = wanted.filter((role) => !tracksOfRole(n, role).some((t) => live.includes(t)));
  const ok = absent.length === 0 && of.size >= r.min;
  return {
    ok,
    value: of.size,
    target: r.min,
    detail: absent.length
      ? `no ${absent.join(", ")} part`
      : `${of.size} ${wanted.join(" or ")} part${of.size === 1 ? "" : "s"}; at least ${r.min}`,
  };
};
const inKey: Impl<"in-key"> = (r, n, ctx) => {
  const ev = selectTracks(n, r.tracks);
  const key = r.key === "declared" ? keyOf(ev, ctx.key ?? null) : r.key;
  if (!key) return { ok: false, detail: "no pitched notes" };
  const m = scaleMembership(ev, key);
  const first = m.outside[0];
  return {
    ok: m.ratio >= r.minRatio,
    value: m.ratio,
    target: r.minRatio,
    detail: `${pct(m.ratio)} of the notes are in ${keyName(key)}; at least ${pct(r.minRatio)}`,
    ...(first
      ? { where: locAt(first.onset, ctx, { track: first.track, noteIds: m.outside.map((e) => e.id) }) }
      : {}),
  };
};
const endsOnDegree: Impl<"ends-on-degree"> = (r, n, ctx) => {
  // One pass of the learner's line: a loop's next turn (and its pickup) is not where the tune ends (Wave 4).
  const all = selectTrack(n, r.track);
  // With `over` (Wave 5, C4) the tune ends where the whole loop ends: a 1-bar riff over a 4-bar progression
  // ends over the progression's last chord, so the period is read on every track, not on the melody alone.
  const loop = r.over ? n.all : all;
  const reach = loop.reduce((m, e) => Math.max(m, R.floor(e.onset) + 1), 0);
  const window = Math.max(1, Math.min(ctx.bars ?? reach, reach || 1));
  // A piece longer than the motif cap (a 24-bar verse–verse–chorus C4) ends at its own last bar, not at bar 16.
  const long = ctx.totalBars && ctx.totalBars > MOTIF_PERIOD_CAP ? Math.min(ctx.totalBars, window) : 0;
  const period = Math.max(periodOf(loop, MOTIF_PERIOD_CAP, window), long);
  let events = period < window ? all.filter((e) => R.floor(e.onset) < period) : all;
  if (ctx.pickup) {
    // With a pickup, notes at the end of the last bar from the pickup's position on lead into the next turn.
    const p = R.div(ctx.pickup.units, rat(METERS[ctx.meter].unitsPerBar));
    const lastBar = events.reduce((m, e) => Math.max(m, R.floor(e.onset)), 0);
    const from = R.add(rat(lastBar), R.sub(rat(1), p));
    const before = events.filter((e) => R.lt(e.onset, from));
    if (lastBar > 0 && before.some((e) => e.midi !== null)) events = before;
  }
  const line = melodyLine(events);
  const heard = keyOf(
    line.map((x) => x.event),
    ctx.key ?? null,
  );
  const last = line[line.length - 1];
  if (!last || !heard) return { ok: false, detail: "no melody to end" };
  // With a key plan (a patterned `.scale()`, a declared plan) the tune ends in the key in force at its last bar:
  // after `<C4:major!6 G3:major!2>` a tune that ends on G ends on 1 of G (contracts §6.8; U17.L01).
  const plan = ruleKeys(n, ctx);
  const changes = plan.some((k) => k.tonic !== plan[0]?.tonic || k.mode !== plan[0]?.mode);
  const key = changes ? (plan[Math.max(0, Math.min(plan.length - 1, R.floor(last.onset)))] ?? heard) : heard;
  const d = degreeOf(last.midi, key).degree;
  const degreeOk = r.degrees.includes(d);
  const where = locAt(last.onset, ctx, {
    track: last.event.track,
    noteIds: [last.id],
    ...(last.event.locs.length ? { code: last.event.locs } : {}),
  });
  // Wave 5 (`over`, C4 "ends on 1 over i"): the chord under that last note is the numeral the rule names.
  const over = r.over ? endsOverRule(r.over, last.onset, n, ctx, r.track, pieceSlots) : null;
  const ok = degreeOk && (over?.ok ?? true);
  const shown = (x: string) => x.replace(/^b/, "♭").replace(/^#/, "♯");
  return {
    ok,
    detail: !degreeOk
      ? `it ends on ${shown(d)}; the brief asks for ${r.degrees.map(shown).join(" or ")}${r.over ? ` over ${r.over}` : ""}`
      : over && !over.ok
        ? `it ends on ${shown(d)}, but ${over.detail}`
        : `it ends on ${shown(d)}${over ? ` ${over.detail}` : ""}`,
    where,
    ...(ok
      ? {}
      : degreeOk
        ? { extra: [diag("harmony.ends-over", { detail: (over as { detail: string }).detail }, where, "rn")] }
        : { extra: [diag("melody.ends-on", { got: d, expected: r.degrees.join(" or ") }, where, "pitch")] }),
  };
};
const cadence: Impl<"cadence"> = (r, n, ctx) => {
  const key = pieceKey(n, ctx);
  if (!key) return { ok: false, detail: "no harmony found" };
  const slots = pieceSlots(n);
  const mel = melodyLine(selectTrack(n, "@melody").length ? selectTrack(n, "@melody") : []);
  const total = pieceBars(n, ctx);
  const ends =
    r.at === "last"
      ? [total]
      : r.at === "phrase-ends"
        ? Array.from({ length: Math.floor(total / 4) }, (_, i) => (i + 1) * 4)
        : [r.at.bar];
  if (ends.length === 0) return { ok: false, detail: "the piece is too short for a phrase" };
  const found: CadenceType[] = ends.map((b) => cadenceAt(slots, mel, key, b));
  // Corrections pass (`before`): the chord just before the last one must be one of these numerals (V → I only).
  const wantBefore = r.before ? chordsOfRomans(r.before, key).filter((c): c is ChordId => !!c) : null;
  const beforeOk = (b: number): boolean =>
    !wantBefore || wantBefore.some((w) => coreEq(cadenceChords(slots, b).prev?.chord ?? null, w));
  const bad = ends.filter((b, i) => !r.types.includes(found[i] as CadenceType) || !beforeOk(b));
  const okCount = ends.length - bad.length;
  // A cadence that lands before the bar it is asked for, with that bar left without harmony (C2 "bars 7–8 land
  // on I": V → I in bars 6–7, then an empty bar 8).
  const firstBad = bad[0];
  const lastBefore = firstBad !== undefined ? cadenceChords(slots, firstBad).last : undefined;
  const early =
    firstBad !== undefined && lastBefore && R.lte(lastBefore.span[1], rat(firstBad - 1))
      ? Math.ceil(R.toNum(lastBefore.span[1]))
      : null;
  // Corrections gate (AS-13): the home chord over its 5th (I6/4) does not arrive; say so in the chord's own terms.
  const lastBad = firstBad !== undefined ? cadenceChords(slots, firstBad).last?.chord : undefined;
  const sixFour =
    lastBad !== undefined &&
    lastBad !== null &&
    lastBad.bassPc !== lastBad.rootPc &&
    (lastBad.bassPc - lastBad.rootPc + 12) % 12 === 7 &&
    degreeOf(lastBad.rootPc, key).semitones === 0;
  return {
    ok: bad.length === 0,
    value: okCount,
    target: ends.length,
    detail:
      bad.length === 0
        ? `${found.join(", ")} at bar ${ends.join(", ")}`
        : sixFour
          ? `bar ${firstBad} ends on the home chord with its 5th, ${noteName(60 + lastBad.bassPc, key).replace(/-?\d+$/, "")}, in the bass: over its 5th the chord still leans on and the cadence has not arrived. Put its root, ${noteName(60 + lastBad.rootPc, key).replace(/-?\d+$/, "")}, in the bass`
          : early !== null
            ? `bar ${firstBad} has no chord, so no cadence lands there: the harmony stops after bar ${early}; the brief asks for ${r.before ? `${r.before.join(" or ")} → ${/minor/.test(key.mode) ? "i" : "I"}` : [...new Set(r.types.map((t) => cadenceAsk(t, key)))].join(" or ")} arriving in bar ${firstBad}`
            : r.types.includes(found[ends.indexOf(bad[0] as number)] as CadenceType) && r.before
              ? `bar ${bad[0]} ends ${endingWords(slots, key, bad[0] as number)}; the brief asks for ${r.before.map((x) => x.replace(/^b/, "♭")).join(" or ")} → ${/minor/.test(key.mode) ? "i" : "I"}`
              : `bar ${bad[0]} ends ${endingWords(slots, key, bad[0] as number)}: ${CADENCE_WORDS[found[ends.indexOf(bad[0] as number)] as CadenceType]}; the brief asks for ${r.before ? `${r.before.join(" or ")} → ${/minor/.test(key.mode) ? "i" : "I"}` : [...new Set(r.types.map((t) => cadenceAsk(t, key)))].join(" or ")}`,
    ...(bad.length ? { where: { bar: bad[0] as number } } : {}),
  };
};
/** What a cadence type is, in the course's words (U06.L04). */
const CADENCE_WORDS: Record<CadenceType, string> = {
  PAC: "a perfect authentic cadence",
  IAC: "an imperfect authentic cadence",
  PC: "a plagal cadence",
  HC: "a half cadence, which stops on V",
  DC: "a deceptive cadence, V to vi",
  "bVII-I": "♭VII to I, not a cadence the brief lists",
  none: "no cadence",
};
const CADENCE_ASK: Record<CadenceType, string> = {
  PAC: "V → I",
  IAC: "V → I",
  PC: "IV → I",
  HC: "a stop on V (half)",
  DC: "V → vi (deceptive)",
  "bVII-I": "♭VII → I",
  none: "no cadence",
};
/** What a cadence asks for, in the key's own numerals: V → i and iv → i in a minor key (U10). */
const cadenceAsk = (t: CadenceType, key: KeySpec): string =>
  /minor/.test(key.mode)
    ? CADENCE_ASK[t]
        .replace(/\bIV\b/g, "iv")
        .replace(/(→ )I\b/g, "$1i")
        .replace(/\bvi\b/g, "VI")
    : CADENCE_ASK[t];
/**
 * The last two chords before `endBar` as numerals ("ii → I", "V → Csus4 (no chord)"): what the learner wrote,
 * so a failed cadence names the chords and not only the type it missed.
 */
function endingWords(slots: readonly ChordSlot[], key: KeySpec, endBar: number): string {
  const sounding = slots.filter((s) => R.lt(s.span[0], rat(endBar)) && s.midis.length > 0);
  const name = (s: ChordSlot | undefined): string =>
    s === undefined
      ? "nothing"
      : s.chord
        ? romanShown(romanOf({ ...s.chord, bassPc: s.chord.rootPc }, key))
        : s.symbol !== undefined
          ? `${s.symbol} (a chord with no numeral)`
          : "no chord";
  const last = sounding[sounding.length - 1];
  let i = sounding.length - 2;
  while (
    i >= 0 &&
    last?.chord &&
    (sounding[i] as ChordSlot).chord &&
    coreEq((sounding[i] as ChordSlot).chord as ChordId, last.chord)
  )
    i--;
  const prev = i >= 0 ? sounding[i] : undefined;
  return prev === undefined ? `on ${name(last)}` : `${name(prev)} → ${name(last)}`;
}
const chordTonesStrong: Impl<"chord-tones-strong"> = (r, n, ctx) => {
  const line = melodyLine(selectTrack(n, r.melody));
  const slots = pieceSlots(n, r.harmony, { exclude: r.melody });
  const res = chordToneRatio(line, slots, ctx.meter, r.strength);
  // Corrections pass (`cover`): every strong position under a chord needs a note of the line there; a position
  // where nothing sounds is a miss ("on beat 1 of every bar"), and a note held into it is judged like a new one.
  if (r.cover) {
    const units = METERS[ctx.meter].unitsPerBar;
    const total = windowBars(n, ctx);
    const pool = pitched(selectTrack(n, r.melody));
    let need = 0;
    let good = 0;
    const empty: Rat[] = [];
    const wrong: Rat[] = [];
    for (let b = 0; b < total; b++)
      for (let u = 0; u < units; u++) {
        const at = rat(b * units + u, units);
        if (!isStrong(at, ctx.meter, r.strength)) continue;
        const slot = slotAt(slots, at) ?? barChordAt(slots, at);
        if (!slot?.chord) continue;
        need++;
        const here = sounding(pool, at);
        if (here.length === 0) {
          empty.push(at);
          continue;
        }
        const pcs = slotPcs(slot);
        if (here.some((e) => pcs.includes(mod12(e.midi)))) good++;
        else wrong.push(at);
      }
    if (need === 0) return { ok: false, value: 0, target: r.minRatio, detail: "no chords to play against" };
    const ratio = good / need;
    const word = r.strength === "downbeat" ? "beat 1" : r.strength === "strong" ? "strong beat" : "beat";
    const firstEmpty = empty[0];
    const firstWrong = wrong[0];
    const at = (x: Rat): string => placeText(x, ctx);
    return {
      ok: ratio >= r.minRatio - 1e-9,
      value: ratio,
      target: r.minRatio,
      detail:
        ratio >= r.minRatio - 1e-9
          ? `a chord tone on ${good} of ${need} ${word}s`
          : `a chord tone on ${good} of ${need} ${word}s; at least ${pct(r.minRatio)}${firstEmpty ? ` (${at(firstEmpty)}: no note sounds; ${empty.length} ${word}${empty.length === 1 ? " is" : "s are"} empty)` : firstWrong ? ` (${at(firstWrong)}: the note is not in the chord)` : ""}`,
      ...((firstEmpty ?? firstWrong) ? { where: locAt((firstEmpty ?? firstWrong) as Rat, ctx) } : {}),
    };
  }
  if (res.n === 0)
    return {
      ok: false,
      value: 0,
      target: r.minRatio,
      detail: "no melody notes on strong beats over a chord",
    };
  const miss = res.misses[0];
  return {
    ok: res.ratio >= r.minRatio,
    value: res.ratio,
    target: r.minRatio,
    detail: `${pct(res.ratio)} of strong-beat notes are chord tones; at least ${pct(r.minRatio)}`,
    ...(miss
      ? { where: locAt(miss.onset, ctx, { track: miss.event.track, noteIds: res.misses.map((m) => m.id) }) }
      : {}),
  };
};
const progression: Impl<"progression"> = (r, n, ctx) => {
  const schema = r.schema ? findSchema(r.schema) : undefined;
  if (r.schema && !schema) return { ok: false, detail: `unknown schema ${r.schema}` };
  let key = pieceKey(n, ctx);
  if (!key) return { ok: false, detail: "no harmony found" };
  if (schema && (schema.mode === "minor") !== (key.mode === "minor") && !ctx.key) key = relativeKey(key);
  const romans = schema ? schemaRomans(schema) : { rn: r.rn ?? [], perBar: false };
  const want = chordsOfRomans(romans.rn, key);
  const slots = pieceSlots(n, r.track);
  const rotate = r.allowRotation ?? schema?.rotations ?? false;
  const k = key;
  const rn = (c: ChordId | null): string => (c ? romanShown(romanOf(c, k)) : "no chord");
  // A chord named for the learner: its numeral in root position and its symbol ("vi (Am)", "VI (A)"), so a
  // wrong quality reads as such and never as an applied chord the course has not taught yet.
  const named = (c: ChordId | null): string => {
    if (!c) return "no chord";
    const root = { ...c, bassPc: c.rootPc };
    const core: ChordId = { ...root, quality: triadCore(root).quality, ext: [] };
    return `${romanShown(romanOf(core, k))} (${toLeadSheet(root)})`;
  };
  if (r.bars) {
    // Wave 4 (C2): only bars [from, to], one chord per bar, the loop in any rotation the rule allows. A
    // pickup bar is bar 0, so bar 1 is cycle 1 when the piece declares one.
    const [from, to] = r.bars;
    const offset = ctx.pickup ? 0 : -1;
    const perBar = chordPerBar(slots, to + offset + 1).slice(from + offset, to + offset + 1);
    const span = to - from + 1;
    const loop = want;
    let best = { matched: -1, rotation: 0 };
    for (let rot = 0; rot < (rotate ? loop.length : 1); rot++) {
      let m = 0;
      while (m < perBar.length && seventhEq(perBar[m] ?? null, loop[(m + rot) % loop.length] ?? null)) m++;
      if (m > best.matched) best = { matched: m, rotation: rot };
    }
    // One chord a bar (contracts §6.6): a second chord inside a bar breaks the loop even when every downbeat
    // follows it (C F | G C | Am G | F G … reads C G Am F on the downbeats).
    const crowded = Array.from({ length: span }, (_, i) => from + i).find((bar) => {
      const c = bar + offset;
      const cores = slots
        .filter((sl) => sl.chord && R.lte(rat(c), sl.span[0]) && R.lt(sl.span[0], rat(c + 1)))
        .map((sl) => sl.chord as ChordId);
      // Comping that leaves beat 1 empty (chords on 2 and 4) names the bar by the first chord struck in it,
      // as `chordPerBar` does (build-author-capstones-jazz-b, JC3's bridge).
      const first = slotAt(slots, rat(c))?.chord ?? cores[0] ?? null;
      return cores.some((x) => !coreEq(x, first));
    });
    if (crowded !== undefined && crowded < from + Math.min(best.matched, span)) {
      const c = crowded + offset;
      const inBar = [
        slotAt(slots, rat(c))?.chord ?? null,
        ...slots
          .filter((sl) => sl.chord && R.lt(rat(c), sl.span[0]) && R.lt(sl.span[0], rat(c + 1)))
          .map((sl) => sl.chord as ChordId),
      ];
      return {
        ok: false,
        value: crowded - from,
        target: span,
        detail: `bar ${crowded} has ${inBar.length} chords (${inBar.map(named).join(", ")}); the loop takes one chord a bar in bars ${from}–${to}`,
        where: { bar: crowded },
      };
    }
    const ok = best.matched >= span;
    const badBar = from + best.matched;
    const exp = loop[(best.matched + best.rotation) % loop.length] ?? null;
    return {
      ok,
      value: Math.min(best.matched, span),
      target: span,
      detail: ok
        ? `bars ${from}–${to}: ${perBar.map(rn).join(" ")}${best.rotation ? " (the loop from another chord)" : ""}`
        : coreEq(perBar[best.matched] ?? null, exp)
          ? // The right root and triad with another seventh: name both sevenths (a ∆7 where a dominant 7th goes).
            `bar ${badBar} is ${rn(perBar[best.matched] ?? null)} (${toLeadSheet(perBar[best.matched] as ChordId)}); the loop wants ${romans.rn[(best.matched + best.rotation) % romans.rn.length] ?? rn(exp)} there, another seventh on the same root (bars ${from}–${to}: ${romans.rn.join(" ")}, one chord per bar)`
          : `bar ${badBar} is ${named(perBar[best.matched] ?? null)}; the loop wants ${named(exp)} there (bars ${from}–${to}: ${romans.rn.join(" ")}${rotate ? ", from any chord" : ""}, one chord per bar)`,
      ...(!ok ? { where: { bar: badBar } } : {}),
    };
  }
  const got = romans.perBar ? chordPerBar(slots, pieceBars(n, ctx)) : chordChanges(slots);
  // Read by chord changes, a held chord is one chord on both sides: a loop with two bars of one chord
  // (I ♭VII IV I started on ♭VII: ♭VII IV I I; a chain with A7 held for two bars) is compared with its repeats
  // folded, round the loop's end too, in every rotation the rule allows.
  const folded = (xs: readonly (ChordId | null)[]): (ChordId | null)[] => {
    const out = xs.filter((c, i) => i === 0 || !coreEq(c, xs[i - 1] ?? null));
    while (out.length > 1 && coreEq(out[0] ?? null, out[out.length - 1] ?? null)) out.pop();
    return out;
  };
  const hasRepeat = want.some((c, i) => coreEq(c, want[(i + 1) % want.length] ?? null)) && want.length > 1;
  let m = matchProgression(got, want, rotate);
  if (!romans.perBar && hasRepeat && m.matched < m.length) {
    for (let r = 0; r < (rotate ? want.length : 1); r++) {
      const turn = folded([...want.slice(r), ...want.slice(0, r)]);
      const fm = matchProgression(got, turn, false);
      // One whole turn of the folded loop is the progression: count it as every chord of the written one.
      if (fm.matched >= turn.length && turn.length > 1) {
        m = { matched: want.length, length: want.length, rotation: r };
        break;
      }
    }
  }
  const matched = m.matched >= m.length && m.length > 0;
  // A minor loop started on its III is the relative major's I–V–vi–IV (Am F C G from C: C G Am F): the ear hears
  // it in C major, so it is not the minor loop the rule asks for (contracts §6.8: the key is the tonic heard).
  const startsOnRelative =
    matched &&
    schema?.mode === "minor" &&
    m.rotation > 0 &&
    (() => {
      const first = want[m.rotation % want.length];
      return !!first && mod12(first.rootPc - pcOf(k.tonic)) === 3 && triadCore(first).quality === "maj";
    })();
  if (startsOnRelative) {
    const first = want[m.rotation % want.length] as ChordId;
    const tonicChord = want[0] ?? null;
    const relName = toLeadSheet({ ...first, bassPc: first.rootPc });
    return {
      ok: false,
      value: 0,
      target: m.length,
      detail: `the loop starts on ${named(first)}, so it sounds like ${relName} major (I V vi IV), the relative major; start it on ${named(tonicChord)} to sound in ${k.tonic.replace("#", "♯").replace(/(?<=.)b/, "♭")} minor (${romans.rn.join(" ")})`,
      where: { slot: 1 },
    };
  }
  const ok = matched;
  const gotText = got
    .slice(0, Math.max(m.length, 1))
    .map((c) => (c ? romanShown(romanOf(c, k)) : "?"))
    .join(" ");
  const miss = got[m.matched];
  const expMiss = want[(m.matched + m.rotation) % Math.max(1, want.length)] ?? null;
  const unit = romans.perBar ? "bar" : "chord";
  return {
    ok,
    value: Math.min(m.matched, m.length),
    target: m.length,
    detail: ok
      ? `${romans.rn.join(" ")}${m.rotation ? " (rotated)" : ""}`
      : got.length > m.matched && miss !== undefined
        ? `chords go ${gotText}: ${unit} ${m.matched + 1} is ${rn(miss)}, the brief wants ${rn(expMiss)} (${romans.rn.join(" ")})`
        : `chords go ${gotText}; the brief asks for ${romans.rn.join(" ")}`,
    ...(!ok && got.length > m.matched ? { where: { slot: m.matched + 1 } } : {}),
  };
};
function rnMatches(
  slot: ChordSlot,
  next: ChordSlot | undefined,
  rn: string,
  key: KeySpec,
): { hit: boolean; resolved: boolean } {
  const parsed = parseRN(rn, key);
  if (!parsed || !slot.chord) return { hit: false, resolved: false };
  const want = rnToChord(parsed, key);
  if (!coreEq(slot.chord, want)) return { hit: false, resolved: false };
  if (parsed.of) {
    // An applied chord must sound applied: a plain I before IV is not V/IV, nor VII before III in minor
    // (V/III). `romanOf` reads the chord in context; only a chord it calls applied counts.
    if (!romanOf(slot.chord, key, next?.chord ?? undefined).of) return { hit: false, resolved: false };
    const target = rnToChord({ ...parsed.of, inversion: 0 }, key);
    // It lands on the chord it points at: that root with the target's own quality (V/vi → Am, not A), or a
    // dominant seventh there, the next link of a chain (corrections pass, theory-f; `arrivesOn`).
    return { hit: true, resolved: !!next?.chord && arrivesOn(next.chord, target) };
  }
  // A plain dominant resolves to the tonic, a 4th up; a leading-tone chord (vii°, vii°7, viiø7) a half step up.
  if (!next?.chord || !resolvesByRoot(slot.chord, next.chord)) return { hit: true, resolved: false };
  // Corrections gate (AS-14): landing on the key's home root, it lands on the home chord's own quality: V → Cm in
  // C major is no resolution to I (a minor key also takes the Picardy I; the blues any).
  if (mod12(next.chord.rootPc - pcOf(key.tonic)) === 0 && key.mode !== "blues") {
    const q = triadCore(next.chord).quality;
    const ok = /minor|dorian|phrygian|locrian/.test(key.mode) ? q === "min" || q === "maj" : q === "maj";
    return { hit: true, resolved: ok };
  }
  return { hit: true, resolved: true };
}
const DIMINISHED: readonly string[] = ["dim", "dim7", "m7b5"];
/**
 * Whether a chord goes where its root points: up a 4th (V → I, iiø7 → V7), or, for a diminished chord, also up a
 * half step (vii°7 → i: G♯°7 → Am; U12.L03). A half-diminished ii goes up a 4th, so both moves count for it.
 */
export function resolvesByRoot(
  chord: { rootPc: number; quality: string },
  next: { rootPc: number },
): boolean {
  const step = mod12(next.rootPc - chord.rootPc);
  return step === 5 || (step === 1 && DIMINISHED.includes(chord.quality));
}
const containsRn: Impl<"contains-rn"> = (r, n, ctx) => {
  // Wave 6: any chord of a kind, or a run of chords in order (rubric/wave6-rules.ts).
  if (r.kind !== undefined || r.inOrder) return containsRnWave6(r, n, ctx);
  const key = pieceKey(n, ctx);
  if (!key) return { ok: false, detail: "no harmony found" };
  const slots = pieceSlots(n);
  // Each chord in the key in force at its bar (contracts §6.8): a chorus lifted to D is read in D.
  const keys = slotKeys(n, ctx, slots) ?? slots.map(() => key);
  const keyAt = (i: number): KeySpec => keys[i] ?? key;
  // "At least two" is counted on one pass of the loop: an eight-bar loop graded over sixteen bars holds its one
  // V/vi once, not twice (Wave 6, U15). "At least one" reads the whole window, as it always has.
  const pass = r.min > 1 ? loopPassBars(n.all, windowBars(n, ctx)) : Number.POSITIVE_INFINITY;
  let count = 0;
  let unresolved: number | null = null;
  // Wave 7 Build (carry f4, corrections gate AS-35): a chord heard for less than a beat (an E as the last 16th of a
  // G bar) is a passing sound, not the chord the brief asks for; with `mustResolve` it must last a beat.
  const beat = rat(1, METERS[ctx.meter].unitsPerBar);
  slots.forEach((s, i) => {
    if (R.floor(s.span[0]) >= pass) return;
    if (r.mustResolve && R.lt(R.sub(s.span[1], s.span[0]), beat)) return;
    const hit = r.rn.map((x) => rnMatches(s, slots[i + 1], x, keyAt(i))).find((h) => h.hit);
    if (!hit) return;
    if (r.mustResolve && !hit.resolved) {
      unresolved ??= i;
      return;
    }
    count++;
  });
  const where =
    unresolved !== null
      ? locAt((slots[unresolved] as ChordSlot).span[0], ctx, { slot: unresolved + 1 })
      : undefined;
  const ok = count >= r.min;
  const base = `${count} × ${r.rn.join("/")}${r.mustResolve ? " that resolve" : ""}; at least ${r.min}`;
  return {
    ok,
    value: count,
    target: r.min,
    detail: ok
      ? `${base}${unresolved !== null ? " (one doesn't resolve)" : ""}`
      : `${base}${containsRnFault(r, slots, unresolved !== null ? keyAt(unresolved) : key, unresolved)}`,
    ...(where ? { where } : {}),
    ...(!ok && where === undefined ? nearMissWhere(r, slots, key, ctx) : {}),
  };
};
/** A chord as the learner reads it: its root-position numeral and symbol, "v (Em)". */
function chordWords(c: ChordId | null, key: KeySpec): string {
  if (!c) return "no chord";
  const root = { ...c, bassPc: c.rootPc };
  const core: ChordId = { ...root, quality: triadCore(root).quality, ext: [] };
  return `${romanShown(romanOf(core, key))} (${toLeadSheet(root)})`;
}
/** The first chord on a wanted numeral's root with the wrong triad quality (Em where V is E), if any. */
function nearMiss(
  r: RuleOf<"contains-rn">,
  slots: readonly ChordSlot[],
  key: KeySpec,
): { slot: ChordSlot; want: ChordId; rn: string } | null {
  for (const rn of r.rn) {
    const parsed = parseRN(rn, key);
    if (!parsed || parsed.of) continue;
    const want = rnToChord(parsed, key);
    const slot = slots.find(
      (s) =>
        s.chord && s.chord.rootPc === want.rootPc && triadCore(s.chord).quality !== triadCore(want).quality,
    );
    if (slot) return { slot, want, rn };
  }
  return null;
}
function nearMissWhere(
  r: RuleOf<"contains-rn">,
  slots: readonly ChordSlot[],
  key: KeySpec,
  ctx: RubricContext,
): { where?: ReturnType<typeof locAt> } {
  const m = nearMiss(r, slots, key);
  return m ? { where: locAt(m.slot.span[0], ctx, { slot: slots.indexOf(m.slot) + 1 }) } : {};
}
/**
 * Why a `contains-rn` rule found too few: the chord on the right root with the wrong quality ("Em (v) is minor:
 * V is E major, with G♯, the raised 7th"), a dominant that does not go home, or the chords that are there.
 */
function containsRnFault(
  r: RuleOf<"contains-rn">,
  slots: readonly ChordSlot[],
  key: KeySpec,
  unresolved: number | null,
): string {
  const miss = nearMiss(r, slots, key);
  if (miss) {
    const got = miss.slot.chord as ChordId;
    const gotQ = triadCore(got).quality;
    const wantQ = triadCore(miss.want).quality;
    const wantName = toLeadSheet({ ...miss.want, bassPc: miss.want.rootPc });
    const QW: Record<string, string> = { maj: "major", min: "minor", dim: "diminished", aug: "augmented" };
    const third = spellMidi(60 + mod12(miss.want.rootPc + (wantQ === "maj" || wantQ === "aug" ? 4 : 3)), {
      key,
      chord: miss.want,
    }).name.replace(/-?\d+$/, "");
    const thirdShown = `${third.charAt(0)}${third.slice(1).replace(/#/g, "♯").replace(/b/g, "♭")}`;
    const raised =
      key.mode.includes("minor") && wantQ === "maj" && mod12(miss.want.rootPc - pcOf(key.tonic)) === 7
        ? `, the raised 7th`
        : "";
    return ` (${chordWords(got, key)} is ${QW[gotQ] ?? gotQ}: ${miss.rn} is ${wantName} ${QW[wantQ] ?? wantQ}, with ${thirdShown}${raised})`;
  }
  if (unresolved !== null) {
    const s = slots[unresolved] as ChordSlot;
    const next = slots[unresolved + 1];
    const home = parseRN(key.mode.includes("minor") ? "i" : "I", key);
    const homeText = home ? chordWords(rnToChord(home, key), key) : "the tonic";
    // An applied chord points at its own target, not at home: V/vi (E7) goes to vi (Am).
    const applied = s.chord ? romanOf(s.chord, key, next?.chord ?? undefined) : null;
    if (s.chord && applied?.of) {
      const self = `${romanShown({ ...applied, inversion: 0 })} (${toLeadSheet({ ...s.chord, bassPc: s.chord.rootPc })})`;
      const goal = chordWords(rnToChord({ ...applied.of, inversion: 0 }, key), key);
      return next?.chord
        ? ` (${self} doesn't resolve: it goes to ${chordWords(next.chord, key)}, not to ${goal})`
        : ` (${self} doesn't resolve: it is the last chord; follow it with ${goal})`;
    }
    return next?.chord
      ? ` (${chordWords(s.chord, key)} doesn't resolve: it goes to ${chordWords(next.chord, key)}, not home to ${homeText})`
      : ` (${chordWords(s.chord, key)} doesn't resolve: it is the last chord; follow it with ${homeText})`;
  }
  const heard = [...new Set(slots.filter((s) => s.chord).map((s) => chordWords(s.chord, key)))];
  return heard.length === 0
    ? " (no chords here)"
    : ` (the chords here: ${heard.slice(0, 4).join(", ")}${heard.length > 4 ? ", …" : ""})`;
}
const range: Impl<"range"> = (r, n, ctx) => {
  const ev = selectTrack(n, r.track);
  const pr = pitchRange(ev);
  if (!pr) return { ok: false, detail: "no pitched notes" };
  let ok = true;
  const parts: string[] = [`span ${pr.span} half steps`];
  let credit = 1;
  if (r.maxSpan !== undefined) {
    if (pr.span > r.maxSpan) {
      ok = false;
      credit = r.maxSpan / pr.span;
    }
    parts.push(`at most ${r.maxSpan}`);
  }
  if (r.within) {
    const [lo, hi] =
      r.within === "learner-voice"
        ? [ctx.profile?.rangeLow ?? 0, ctx.profile?.rangeHigh ?? 127]
        : [noteToMidi(r.within[0]) ?? 0, noteToMidi(r.within[1]) ?? 127];
    const outside = pitched(ev).filter((e) => e.midi < lo || e.midi > hi);
    if (outside.length > 0) {
      ok = false;
      credit = Math.min(credit, 1 - outside.length / pitched(ev).length);
      parts.push(
        `${outside.length} note(s) outside ${r.within === "learner-voice" ? "your voice" : r.within.join("–")}`,
      );
    }
  }
  return {
    ok,
    value: pr.span,
    ...(r.maxSpan !== undefined ? { target: r.maxSpan } : {}),
    credit,
    detail: parts.join("; "),
  };
};
const stepRatio: Impl<"step-ratio"> = (r, n) => {
  const line = melodyLine(selectTrack(n, r.track));
  const s = stepLeap(line);
  // No line, one note, or one pitch repeated shows no motion at all: it is not evidence of moving by step.
  if (s.intervals === 0)
    return {
      ok: false,
      value: 0,
      target: r.min,
      detail:
        line.length === 0
          ? "no melody line to measure yet"
          : "one note only: a line needs at least two notes to move by step",
    };
  if (line.every((x) => x.midi === (line[0] as { midi: number }).midi))
    return {
      ok: false,
      value: 0,
      target: r.min,
      detail: "the line stays on one pitch: move it to a neighbouring note",
    };
  // Corrections gate (AS-40): a repeated note is no step. Only moves count: a half or whole step against every
  // move to another pitch, so C C C C G G G G (repeats and a 5th) does not "move mostly by step".
  let moves = 0;
  let steps = 0;
  for (let i = 1; i < line.length; i++) {
    const d = Math.abs((line[i] as { midi: number }).midi - (line[i - 1] as { midi: number }).midi);
    if (d === 0) continue;
    moves++;
    if (d <= 2) steps++;
  }
  const ratio = moves === 0 ? 0 : steps / moves;
  return {
    ok: ratio >= r.min,
    value: ratio,
    target: r.min,
    detail: `${pct(ratio)} steps (${steps} of the ${moves} moves to another note; a repeated note is not a move); at least ${pct(r.min)}`,
  };
};
const harmonicRhythmRule: Impl<"harmonic-rhythm"> = (r, n, ctx) => {
  const b = windowBars(n, ctx);
  const per = harmonicRhythm(chordSlotsMerged(pieceSlots(n)), b);
  const avg = per.length ? mean(per) : 0;
  const [lo, hi] = r.changesPerBar;
  return {
    ok: avg >= lo - 1e-9 && avg <= hi + 1e-9,
    value: avg,
    target: lo,
    detail: `${fmt(avg)} chord changes per bar; the brief asks for ${lo}–${hi}`,
  };
};
/** Slots with repeated neighbours merged into one change. */
function chordSlotsMerged(slots: readonly ChordSlot[]): ChordSlot[] {
  const out: ChordSlot[] = [];
  for (const s of slots) {
    const last = out[out.length - 1];
    if (last && coreEq(last.chord, s.chord) && R.eq(last.span[1], s.span[0]))
      last.span = [last.span[0], s.span[1]];
    else out.push({ ...s, span: [s.span[0], s.span[1]] });
  }
  return out;
}
const kickOnsets = (n: Normalized, ref: string): Rat[] => {
  const ev = selectTrack(n, ref);
  const kicks = ev.filter((e) => e.drum === "kick");
  return onsets(kicks.length > 0 ? kicks : ev);
};
const grooveLockRule: Impl<"groove-lock"> = (r, n, ctx) => {
  // An arranged piece whose tracks disagree about the sections is refused first (contracts §6.3 items 3, 8):
  // the bass and the kick are not where the code says they are.
  const s = sectionsFromAst(ctx.code);
  if (s && "inconsistent" in s)
    return {
      ok: false,
      detail: s.inconsistent.detail,
      extra: [
        diag("form.inconsistent-arrange", { detail: s.inconsistent.detail }, { track: s.inconsistent.track }),
      ],
    };
  const kicks = kickOnsets(n, r.kick);
  const bassOn = onsets(selectTrack(n, r.bass));
  if (kicks.length === 0)
    return { ok: false, value: 0, target: r.min, detail: "no kick drum to lock the bass to" };
  if (bassOn.length === 0)
    return { ok: false, value: 0, target: r.min, detail: "no bass notes to lock to the kick" };
  const g = grooveLock(kicks, bassOn, rat(0), rat(1, 16));
  const off = bassOn.find((b) => !kicks.some((k) => R.eq(k, b)));
  const offAt = off ? locAt(off, ctx) : undefined;
  return {
    ok: g.lock >= r.min,
    value: g.lock,
    target: r.min,
    detail:
      g.lock >= r.min
        ? `${pct(g.lock)} of the bass notes land with a kick`
        : `${pct(g.lock)} of the bass notes land with a kick; at least ${pct(r.min)}${offAt ? ` (bar ${offAt.bar === 0 ? "pickup" : offAt.bar}, ${offAt.beatLabel}: the bass plays without the kick; move one of them)` : ""}`,
    ...(g.lock < r.min && offAt ? { where: offAt } : {}),
  };
};
const swingRule: Impl<"swing"> = (r, n, ctx) => {
  const refs = Array.isArray(r.track) ? r.track : [r.track];
  const candidates = refs.map((ref) => {
    let ev = selectTrack(n, ref);
    if (r.drums && r.drums.length > 0)
      ev = ev.filter((e) => e.drum !== undefined && (r.drums as string[]).includes(e.drum));
    return { ref, events: ev };
  });
  // A whole-kit line (`s("[bd hh] [sd hh] …").swingBy(1/3, 4)`) whose hats play only the off-beats: its kick and
  // snare are the on-beats the hats swing against, so the line is measured whole (contracts §6.10 item 4).
  if (r.drums && r.drums.length > 0)
    for (const ref of refs) {
      const own = candidates.find((c) => c.ref === ref)?.events ?? [];
      const whole = selectTrack(n, ref);
      if (own.length >= 4 && whole.length > own.length) candidates.push({ ref, events: whole });
    }
  const notes = r.subdivision === 8 ? "8ths" : "16ths";
  // The first line the brief names that plays is the one measured: when it plays triplets, a later candidate (the
  // whole kit) must not lend it a swing it does not have (review:robustness: `hats: s("hh*12")` passed AC2).
  const firstLive = candidates.find((c) => c.events.length > 0);
  const triplet =
    firstLive && swingRatio(firstLive.events, ctx.meter, r.subdivision).triplets ? firstLive : undefined;
  // The first named line swings, but on the other subdivision (hats swung in 8ths where 16ths are asked): say so
  // before a later candidate (the whole kit) is measured in its place.
  const otherSub: 8 | 16 = r.subdivision === 8 ? 16 : 8;
  const firstElsewhere =
    firstLive && !triplet && swingRatio(firstLive.events, ctx.meter, r.subdivision).n < 4
      ? swingRatio(firstLive.events, ctx.meter, otherSub)
      : null;
  const swingsElsewhere = !!firstElsewhere && firstElsewhere.n >= 4 && firstElsewhere.ratio >= 1.15;
  const picked = triplet || swingsElsewhere ? null : pickSwingTrack(candidates, ctx.meter, r.subdivision);
  if (!picked) {
    // The first listed line that is a real track (`hats`), else the role (`@drums`) by its own name.
    const live = refs.find((ref) => selectTrack(n, ref).length > 0) ?? refs[0] ?? "hats";
    const line = live.startsWith("@") ? live.slice(1) : live;
    // A triplet line (three to a beat) is not a swung one: say what it plays (review:robustness).
    if (triplet) {
      const tLine = triplet.ref.startsWith("@")
        ? (triplet.events[0]?.track ?? triplet.ref.slice(1))
        : triplet.ref;
      return {
        ok: false,
        detail: `\`${tLine}\` plays triplets, every note of the three; swung ${notes} are pairs, long–short`,
        extra: [
          diag(
            "rhythm.swing-missing",
            { got: `triplets on \`${tLine}\``, expected: `swung ${notes}` },
            { track: tLine },
            "rhythm",
          ),
        ],
      };
    }
    // The line swings, but on the other subdivision: say so instead of "no steady 8ths".
    const other = otherSub;
    const elsewhere =
      swingsElsewhere && firstLive && firstElsewhere
        ? { candidate: firstLive, measure: firstElsewhere }
        : pickSwingTrack(candidates, ctx.meter, other);
    if (elsewhere && elsewhere.measure.ratio >= 1.15) {
      const otherLine = elsewhere.candidate.ref.startsWith("@")
        ? (elsewhere.candidate.events[0]?.track ?? elsewhere.candidate.ref.slice(1))
        : elsewhere.candidate.ref;
      const otherNotes = other === 8 ? "8ths" : "16ths";
      return {
        ok: false,
        detail: `\`${otherLine}\` swings ${otherNotes}; the brief asks for swung ${notes}: swing the ${notes} instead`,
        extra: [
          diag(
            "rhythm.swing-missing",
            { got: `swung ${otherNotes} on \`${otherLine}\``, expected: `swung ${notes}` },
            { track: otherLine },
            "rhythm",
          ),
        ],
      };
    }
    return {
      ok: false,
      detail: `no line plays steady ${notes} to swing; give \`${line}\` ${notes} and swing them`,
      extra: [
        diag(
          "rhythm.swing-missing",
          { got: `no steady ${notes} on \`${line}\``, expected: `swung ${notes}` },
          { track: line },
          "rhythm",
        ),
      ],
    };
  }
  const ratio = picked.measure.ratio;
  const [lo, hi] = r.ratio;
  const ok = ratio >= lo - 1e-9 && ratio <= hi + 1e-9;
  // A role (`@drums`) measured across several lines is named as the role, not by its first line's name.
  const lines = new Set(picked.candidate.events.map((e) => e.track));
  const line = picked.candidate.ref.startsWith("@")
    ? lines.size === 1
      ? (picked.candidate.events[0]?.track ?? picked.candidate.ref.slice(1))
      : picked.candidate.ref.slice(1)
    : picked.candidate.ref;
  const straight = picked.measure.cls === "straight" || ratio < 1.15;
  return {
    ok,
    value: Math.round(ratio * 100) / 100,
    target: lo,
    detail: ok
      ? `\`${line}\` swings at ${fmt(ratio)}:1`
      : straight
        ? `\`${line}\` plays straight ${notes}; swing them, long–short`
        : `\`${line}\` swings at ${fmt(ratio)}:1; the brief asks for ${lo}–${hi}:1`,
    ...(!ok
      ? {
          extra: [
            straight
              ? diag(
                  "rhythm.swing-missing",
                  { got: `straight ${notes} on \`${line}\``, expected: `swung ${notes}` },
                  { track: line },
                  "rhythm",
                )
              : diag(
                  "rhythm.swing-amount",
                  {
                    line,
                    ratio: fmt(ratio),
                    range: `${lo}–${hi}`,
                    tip:
                      ratio > hi
                        ? "swing it less: the off-beat comes back toward the middle"
                        : "swing it more: the off-beat comes later",
                  },
                  { track: line },
                  "rhythm",
                ),
          ],
        }
      : {}),
  };
};
const syncopationRule: Impl<"syncopation"> = (r, n, ctx) => {
  // Each line (each drum of a kit) holds its own notes: on `*` the hats' eighths must not cut short the pushed
  // chord they play beside. A push two lines play together counts once.
  const at = new Set<string>();
  for (const line of linesOf(selectTrack(n, r.track)))
    for (const x of syncopation(line, ctx.meter).at) at.add(`${x[0]}/${x[1]}`);
  const count = at.size;
  return {
    ok: count >= r.min,
    value: count,
    target: r.min,
    detail: `${count} syncopated note(s); at least ${r.min}`,
  };
};
/** The events of a selection split into lines: one per track, and one per drum sound inside a drum track. */
export function linesOf(events: readonly NEvent[]): NEvent[][] {
  const by = new Map<string, NEvent[]>();
  for (const e of events) {
    const k = `${e.track}|${e.drum ?? ""}`;
    const list = by.get(k) ?? [];
    list.push(e);
    by.set(k, list);
  }
  return [...by.values()];
}
const form: Impl<"form"> = (r, _n, ctx) => {
  // Wave 6: a section somewhere in the form (`contains`, `*`), the picked song's form (`@song`, `extra`).
  if (r.contains !== undefined || r.extra !== undefined || r.pattern === "*" || r.pattern === "@song")
    return formWave6(r, ctx, formMatches);
  const s = sectionsFromAst(ctx.code);
  if (!s)
    return {
      ok: false,
      detail: "no sections: write one `arrange()` per labelled track",
      extra: [diag("form.no-sections")],
    };
  if ("inconsistent" in s)
    return {
      ok: false,
      detail: s.inconsistent.detail,
      extra: [
        diag("form.inconsistent-arrange", { detail: s.inconsistent.detail }, { track: s.inconsistent.track }),
      ],
    };
  const ok = formMatches(r.pattern, s.sections);
  const got = s.sections.map((x) => x.tag).join(" ");
  return {
    ok,
    detail: ok ? got : `the form is ${got}; the brief asks for ${r.pattern}`,
    ...(ok ? {} : { extra: [diag("form.wrong", { got, expected: r.pattern })] }),
  };
};
const voiceLeadingRule: Impl<"voice-leading"> = (r, n, ctx) => {
  if (r.voice === "top") return voiceLeadingTopRule(r, n, ctx);
  if (isGateRule(r)) return voiceLeadingGateRule(r, n, ctx);
  let slots = chordSlots(selectTrack(n, r.track));
  // Corrections pass (`loop`): one pass of the loop, then its first chord again (the move back to the top).
  if (r.loop && slots.length > 1) {
    const events = selectTrack(n, r.track);
    const reach = events.reduce((m, e) => Math.max(m, R.floor(e.onset) + 1), 0);
    const period = periodOf(events, 16, Math.max(1, Math.min(ctx.bars ?? reach, reach || 1)));
    const pass = slots.filter((x) => R.lt(x.span[0], rat(period)));
    const first = pass[0];
    if (first && pass.length > 1)
      slots = [
        ...pass,
        { ...first, span: [R.add(first.span[0], rat(period)), R.add(first.span[1], rat(period))] },
      ];
  }
  const moves = voiceLeadingOfSlots(slots);
  if (moves.length === 0) return { ok: false, detail: "no chord changes to lead" };
  const good = moves.filter(
    (m) => m.vl.maxMove <= r.maxMovePerVoice && (r.maxTotal === undefined || m.vl.total <= r.maxTotal),
  );
  const bad = moves.find((m) => !good.includes(m));
  return {
    ok: good.length === moves.length,
    value: good.length / moves.length,
    target: 1,
    detail: bad
      ? `a voice moves ${bad.vl.maxMove} half steps (total ${bad.vl.total}); at most ${r.maxMovePerVoice}${r.maxTotal !== undefined ? ` (total ${r.maxTotal})` : ""}`
      : `smooth: every voice moves ≤ ${r.maxMovePerVoice}`,
    ...(bad ? { where: { bar: R.floor(bad.at) + 1 } } : {}),
  };
};
const guideTones: Impl<"guide-tones"> = (r, n, ctx) => {
  if (r.at !== undefined || r.maxMoveSemis !== undefined || r.changes) return guideTonesWave6(r, n, ctx);
  const g = guideToneLine(
    melodyLine(selectTrack(n, r.track)),
    pieceSlots(n, r.harmony, { exclude: r.track }),
  );
  const ok = g.ratio >= r.minRatio && g.maxMove <= 2;
  return {
    ok,
    value: g.ratio,
    target: r.minRatio,
    detail: `${pct(g.ratio)} of changes meet a 3rd or 7th (largest move ${g.maxMove}); at least ${pct(r.minRatio)}, moves ≤ 2`,
  };
};
const bluesFormRule: Impl<"blues-form"> = (r, n, ctx) =>
  // The piece as written (the AST total, else one period of the loop): a 12-bar loop is one chorus however
  // long it plays; the second chorus is the learner's own (contracts §6.4, §6.6 C5).
  bluesFormWave5(r, n, ctx, pieceSlots, pieceBars(n, ctx));
/** Source fallback when no toolbox is given: `tb.x.y` → a call or method named `y`; `tb.mini.euclid` → `(k,n)`. */
function usesInSource(code: string, tool: string): number {
  const last = tool.split(".").pop() ?? tool;
  if (tool === "tb.mini.euclid") return (code.match(/\(\s*\d+\s*,\s*\d+/g) ?? []).length;
  if (tool.startsWith("snd.")) return (code.match(new RegExp(`["\\s,]${last}["\\s,:*]`, "g")) ?? []).length;
  return (code.match(new RegExp(`\\b${last.replace(/[-.]/g, "\\$&")}\\s*\\(`, "g")) ?? []).length;
}
/**
 * The code with its muted lines blanked (fix:leftovers): a `_label:` line plays nothing, so a tool written only
 * there is not used. A muted line runs on over the lines below it that start with white space or a `.`.
 */
export function withoutMutedLines(code: string): string {
  const lines = code.split("\n");
  let muted = false;
  return lines
    .map((line) => {
      if (/^\s*_[A-Za-z$][\w$]*\s*:/.test(line)) muted = true;
      else if (!/^(\s|\.)/.test(line) || line.trim() === "") muted = false;
      return muted ? line.replace(/\S/g, " ") : line;
    })
    .join("\n");
}
/**
 * The code with every line blanked that is not heard (corrections gate, AS-12): muted lines (`withoutMutedLines`), and
 * a labelled line that was evaluated but sounds nothing (`.gain(0)`, only rests, masked under the mix). A tool written
 * only there changes nothing anyone hears.
 */
export function withoutUnheardLines(code: string, n: Normalized): string {
  const silent = new Set(
    Object.entries(n.byTrack)
      .filter(([, es]) => es.length === 0)
      .map(([t]) => t),
  );
  if (silent.size === 0) return withoutMutedLines(code);
  let blank = false;
  return withoutMutedLines(code)
    .split("\n")
    .map((line) => {
      const m = /^\s*([A-Za-z_$][\w$]*)\s*:(?!:)/.exec(line);
      if (m) blank = silent.has(m[1] as string);
      else if (!/^(\s|\.)/.test(line) || line.trim() === "") blank = false;
      return blank ? line.replace(/\S/g, " ") : line;
    })
    .join("\n");
}
/**
 * A tool written in a fuller form of itself counts as a use of it: `x(k,n,r)` is a rhythm written with `(k,n)`
 * (build-author-capstones-rhythm: R3.L03's own rotated bell failed RC2's "A rhythm written with (k,n)").
 */
const WRITTEN_AS: Readonly<Record<string, readonly string[]>> = {
  "tb.mini.euclid": ["tb.mini.euclid-rot"],
};
const uses: Impl<"uses"> = (r, n, ctx) => {
  const asked = Array.isArray(r.tool) ? r.tool : [r.tool];
  const tools = [...new Set(asked.flatMap((t) => [t, ...(WRITTEN_AS[t] ?? [])]))];
  const min = r.min ?? 1;
  const code = withoutUnheardLines(ctx.code, n);
  const used = ctx.toolsUsed ? ctx.toolsUsed(code).map((t) => t.id) : null;
  const count = tools.reduce(
    (a, t) => a + (used ? used.filter((u) => u === t).length : usesInSource(code, t)),
    0,
  );
  const label = asked.map((t) => toolText(t, ctx.toolCode)).join(" or ");
  return {
    ok: count >= min,
    value: count,
    target: min,
    detail:
      count === 0
        ? `${label} is not used yet (at least ${times(min)})`
        : `${label} used ${times(count)}; at least ${times(min)}`,
  };
};
/** Longest loop the motif check looks for (bars); a line with no shorter period is read whole. */
const MOTIF_PERIOD_CAP = 16;
const motifReuseRule: Impl<"motif-reuse"> = (r, n, ctx) => {
  const events = selectTrack(n, r.track);
  const unitBars = r.unitBars ?? 1;
  // One pass of the learner's own line: a 2-bar riff rendered over 16 bars is read as its 2 bars, so the
  // loop's repeats never count as reuse (contracts §5.6 measures the idea, not the playback).
  const reach = events.reduce((m, e) => Math.max(m, R.floor(e.onset) + 1), 0);
  const window = Math.max(1, Math.min(ctx.bars ?? reach, reach || 1));
  // Corrections pass (`loopRepeats`): a bar written again unchanged is a return when the brief allows it. A
  // number N reads one pass as at least N bars (a 2-bar hook played twice is a hook that comes back) but keeps a
  // one-bar loop out: every bar the same is no hook among other bars.
  const own = periodOf(events, MOTIF_PERIOD_CAP, window);
  if (typeof r.loopRepeats === "number" && own === 1 && window > 1)
    return {
      ok: false,
      value: 0,
      target: r.minRatio,
      detail: "every bar plays the same thing: a one-bar loop. Let the hook come back among bars that differ",
    };
  const period =
    r.loopRepeats === true
      ? window
      : typeof r.loopRepeats === "number"
        ? Math.min(window, Math.max(own, r.loopRepeats))
        : own;
  const m = motifReuse(melodyLine(events), unitBars, {
    periodBars: period,
    shape: r.shape ?? "semitones",
    key: keyFromContext(events) ?? ctx.key ?? null,
  });
  const unit = unitBars === 1 ? "bar" : `${fmt(unitBars)}-bar group`;
  const span = period < window ? `in one pass of your ${period}-bar loop` : `over your ${period} bars`;
  const verb = m.matched === 1 ? "repeats" : "repeat";
  return {
    ok: m.ratio >= r.minRatio,
    value: m.ratio,
    target: r.minRatio,
    detail: `${span}, ${m.matched} of ${m.units} ${unit}s ${verb} the shape of an earlier one (${pct(m.ratio)}); at least ${pct(r.minRatio)}`,
  };
};

function sectionsFor(
  ctx: RubricContext,
): { sections: import("../types.ts").SectionInfo[]; totalBars: number } | { error: RuleEval } {
  const s = sectionsFromAst(ctx.code);
  if (!s)
    return {
      error: {
        ok: false,
        detail: "no sections: write one `arrange()` per labelled track",
        extra: [diag("form.no-sections")],
      },
    };
  if ("inconsistent" in s)
    return {
      error: {
        ok: false,
        detail: s.inconsistent.detail,
        extra: [
          diag(
            "form.inconsistent-arrange",
            { detail: s.inconsistent.detail },
            { track: s.inconsistent.track },
          ),
        ],
      },
    };
  return s;
}
const refText = (ref: SectionRef): string =>
  ref === "last"
    ? "last section"
    : "bars" in ref
      ? `bars ${ref.bars[0]}–${ref.bars[1]}`
      : `${ref.nth === undefined ? "" : ref.nth === -1 ? "last " : `${["", "first", "second", "third", "fourth"][ref.nth] ?? `${ref.nth}th`} `}${ref.section}`;

const contrast: Impl<"contrast"> = (r, n, ctx) => {
  const s = sectionsFor(ctx);
  if ("error" in s) return s.error;
  const a = resolveSection(r.a, s.sections, s.totalBars);
  const b = resolveSection(r.b, s.sections, s.totalBars);
  if (!a || !b) return { ok: false, detail: `no section ${!a ? refText(r.a) : refText(r.b)}` };
  const th = { pitchSemis: 3, densityRatio: 0.25, registerSemis: 5, energyDelta: 0.15, ...r.thresholds };
  const mel = selectTrack(n, "@melody");
  const sa = spanStats(n.all, mel, a);
  const sb = spanStats(n.all, mel, b);
  const met: string[] = [];
  const key = pieceKey(n, ctx);
  for (const axis of r.axes) {
    if (
      axis === "pitch" &&
      Number.isFinite(sa.meanPitch) &&
      Number.isFinite(sb.meanPitch) &&
      Math.abs(sa.meanPitch - sb.meanPitch) >= th.pitchSemis
    )
      met.push("pitch");
    if (
      axis === "density" &&
      Math.max(sa.density, sb.density) > 0 &&
      Math.abs(sa.density - sb.density) / Math.max(sa.density, sb.density) >= th.densityRatio
    )
      met.push("density");
    if (
      axis === "register" &&
      sa.low !== null &&
      sb.low !== null &&
      sa.high !== null &&
      sb.high !== null &&
      (Math.abs(sa.low - sb.low) >= th.registerSemis || Math.abs(sa.high - sb.high) >= th.registerSemis)
    )
      met.push("register");
    if (axis === "energy") {
      const curve = energyCurve(n.byTrack, s.totalBars);
      const ea = mean(curve.slice(a[0], a[1]));
      const eb = mean(curve.slice(b[0], b[1]));
      if (Math.abs(ea - eb) >= th.energyDelta) met.push("energy");
    }
    if (axis === "harmony" && key) {
      const slots = pieceSlots(n);
      const rnSeq = (span: [number, number]): string =>
        chordPerBar(slots, span[1])
          .slice(span[0])
          .map((c) => (c ? romanText(romanOf(c, key)) : "-"))
          .join(" ");
      if (rnSeq(a) !== rnSeq(b)) met.push("harmony");
    }
  }
  const ok = met.length >= r.minAxes;
  const need = r.minAxes - met.length;
  const missingAxes = r.axes.filter((x) => !met.includes(x));
  const words = missingAxes.map((x) => AXIS_WORDS[x]);
  const list =
    words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
  const an = refText(r.a);
  const bn = refText(r.b);
  return {
    ok,
    value: met.length,
    target: r.minAxes,
    detail: ok
      ? `${an} and ${bn} differ in ${met.join(", ")}`
      : `the ${an} is no ${list} than the ${bn}${met.length ? ` (it differs only in ${met.join(", ")})` : ""}: ${
          // One axis asked: say it plainly ("one of these" of one reads oddly; build-author-A2a).
          missingAxes.length === 1
            ? `make it ${list}`
            : `change ${need === 1 ? "one" : need === 2 ? "two" : need} of these`
        }`,
    ...(ok
      ? {}
      : {
          extra: [
            diag("form.contrast", {
              a: an,
              b: bn,
              list,
              need: need === 1 ? "one" : need === 2 ? "two" : String(need),
            }),
          ],
        }),
  };
};
/** What a contrast axis means for the learner ("the chorus is no higher … than the verse"). */
const AXIS_WORDS: Record<string, string> = {
  pitch: "higher or lower in tune",
  density: "busier or sparser",
  harmony: "different in its chords",
  register: "wider in range",
  energy: "louder or fuller",
};
const keyChange: Impl<"key-change"> = (r, n, ctx) => {
  const s = sectionsFor(ctx);
  if ("error" in s) return s.error;
  const span = resolveSection(r.at, s.sections, s.totalBars);
  if (!span) return { ok: false, detail: `no section ${refText(r.at)}` };
  const idx = s.sections.findIndex((x) => x.startBar === span[0]);
  const here = s.sections[idx];
  const before = idx > 0 ? s.sections[idx - 1] : undefined;
  if (!here || !before) return { ok: false, detail: "the key change needs a section before it" };
  const inSpan = (from: number, to: number): NEvent[] =>
    pitched(n.all).filter((e) => R.floor(e.onset) >= from && R.floor(e.onset) < to);
  // Contracts §6.8 item 3: a track with `.transpose()` after `.scale()` keeps its old `scaleCtx`, so its context
  // is not read; such a stretch is read by ear, in the mode family of the brief (review:robustness, Wave 6).
  const distrust = new Set(transposeAfterScaleTracks(ctx.code));
  const keyIn = (from: number, to: number, family: KeySpec | null): KeySpec | null => {
    const ev = inSpan(from, to);
    const trusted = keyFromContext(ev.filter((e) => !distrust.has(e.track)));
    if (trusted) return trusted;
    const est = keyEstimate(ev);
    const same = family ? est.find((k) => isMinorish(k.key.mode) === isMinorish(family.mode)) : undefined;
    return (same ?? est[0])?.key ?? null;
  };
  const kOld = keyIn(before.startBar, before.startBar + before.bars, ctx.key ?? null);
  let kNew = keyIn(here.startBar, here.startBar + here.bars, kOld);
  if (!kOld || !kNew) return { ok: false, detail: "no pitched notes to read the keys from" };
  // The key plan, bar by bar. A lift that starts inside the section reads as the old key on the section's whole
  // span (its first scale wins): take the key the plan reaches inside the section instead, so the learner reads
  // where the lift starts and how long it lasts, not "C major → C major is +0" (gate leftover C7_MISS_SHORT_LIFT).
  const plan = keysByBar(n, here.startBar + here.bars, { code: ctx.code, pickup: !!ctx.pickup });
  if (pcOf(kNew.tonic) === pcOf(kOld.tonic)) {
    const old = kOld;
    const moved = Array.from({ length: here.bars }, (_, i) => plan[here.startBar + i]).find(
      (k): k is KeySpec => !!k && pcOf(k.tonic) !== pcOf(old.tonic),
    );
    if (moved) kNew = moved;
  }
  const newKey = kNew;
  const diff = mod12(pcOf(kNew.tonic) - pcOf(kOld.tonic));
  const problems: string[] = [];
  if (!r.semitones.some((x) => mod12(x) === diff))
    problems.push(
      diff === 0
        ? `${here.tag} stays in ${keyName(kOld)}, the key of ${before.tag}: nothing lifts; the brief asks for a lift of +${r.semitones.join(" or +")}`
        : `${keyName(kOld)} → ${keyName(kNew)} is +${diff}; the brief asks for +${r.semitones.join(" or +")}`,
    );
  // Corrections gate (AS-28): a lift moves the key, not the mode: C major lifted a whole step is D major.
  if (diff !== 0 && isMinorish(kOld.mode) !== isMinorish(newKey.mode))
    problems.push(
      `${here.tag} moves to ${keyName(newKey)}, but ${before.tag} is in ${keyName(kOld)}: a lift keeps the mode, so make it ${keyName({ tonic: newKey.tonic, mode: kOld.mode })}`,
    );
  const minAfter = r.minBarsAfter ?? 8;
  // The new key counts from the bar the key plan reaches it: a lift two bars into the last chorus lasts six.
  const isNew = (b: number): boolean => {
    const k = plan[b];
    return !!k && pcOf(k.tonic) === pcOf(newKey.tonic) && isMinorish(k.mode) === isMinorish(newKey.mode);
  };
  let liftAt = here.startBar;
  if (diff !== 0 && plan.length > 0 && !isNew(here.startBar)) {
    const first = Array.from({ length: here.bars }, (_, i) => here.startBar + i).find(isNew);
    if (first !== undefined) liftAt = first;
  }
  const lasts = here.startBar + here.bars - liftAt;
  if (liftAt > here.startBar)
    problems.push(
      `the key changes at bar ${liftAt + 1}, ${liftAt - here.startBar} bar${liftAt - here.startBar === 1 ? "" : "s"} into ${here.tag} (bar ${here.startBar + 1}): change it where the section starts${lasts < minAfter ? `; the new key lasts ${lasts} bars, at least ${minAfter}` : ""}`,
    );
  else if (here.bars < minAfter) problems.push(`the new key lasts ${here.bars} bars; at least ${minAfter}`);
  if (r.sameMelody && liftAt === here.startBar) {
    const prevSame = [...s.sections.slice(0, idx)].reverse().find((x) => x.label === here.label) ?? before;
    const mel = selectTrack(n, "@melody");
    const degs = (from: number, to: number, k: KeySpec): string =>
      degreeSequence(
        melodyLine(mel.filter((e) => R.floor(e.onset) >= from && R.floor(e.onset) < to)),
        k,
      ).join(" ");
    const kPrev = keyFromContext(inSpan(prevSame.startBar, prevSame.startBar + prevSame.bars)) ?? kOld;
    const len = Math.min(prevSame.bars, here.bars);
    if (
      degs(prevSame.startBar, prevSame.startBar + len, kPrev) !==
      degs(here.startBar, here.startBar + len, kNew)
    )
      problems.push(`the melody of ${here.tag} isn't the ${prevSame.tag} melody moved to the new key`);
  }
  // The chords move with the tune: chord names left in the old key under a lifted tune are two keys at once.
  if (diff !== 0) {
    const earlier = [...s.sections.slice(0, idx)].reverse().find((x) => x.label === here.label) ?? before;
    // And the tune moves with the chords (corrections pass, U17.L02: chords and bass lifted, the tune left in C).
    const melTracks = new Set(selectTrack(n, "@melody").map((e) => e.track));
    // Corrections gate (AS-28): the tune that sang the earlier section is heard in the lifted one.
    const sang = (from: number, to: number): boolean => inSpan(from, to).some((e) => melTracks.has(e.track));
    if (
      sang(earlier.startBar, earlier.startBar + earlier.bars) &&
      !sang(here.startBar, here.startBar + here.bars)
    )
      problems.push(
        `the tune is not heard in ${here.tag}: it sings ${earlier.tag}, then stops (or is too quiet to hear under the rest). Lift it with the chords`,
      );
    const melKey = keyFromContext(
      inSpan(here.startBar, here.startBar + here.bars).filter(
        (e) => melTracks.has(e.track) && !distrust.has(e.track) && R.floor(e.onset) >= liftAt,
      ),
    );
    if (melKey && pcOf(melKey.tonic) !== pcOf(kNew.tonic))
      problems.push(
        `the chords of ${here.tag} are in ${keyName(kNew)}, but its tune is still in ${keyName(melKey)}: lift the tune's \`.scale()\` too`,
      );
    const left = chordsLeftBehind(n, earlier, here, diff);
    if (left)
      problems.push(
        `the tune of ${here.tag} is in ${keyName(kNew)}, but its chords are still the ${keyName(kOld)} ones: bar ${left.bar + 1} is ${toLeadSheet({ ...left.got, bassPc: left.got.rootPc })}; lifted, it is ${liftedChordName(left.want, kNew)}`,
      );
  }
  return {
    ok: problems.length === 0,
    detail: problems.length
      ? problems.join("; ")
      : `${keyName(kOld)} → ${keyName(kNew)} at bar ${here.startBar + 1}`,
    where: { bar: here.startBar + 1 },
  };
};
const onsetsRule: Impl<"onsets"> = (r, n, ctx) => {
  let ev = selectTrack(n, r.track);
  if (r.drum) ev = ev.filter((e) => e.drum === r.drum);
  const want = (xs: readonly Rat[] | undefined): string[] =>
    (xs ?? []).map((x) => ratKey(r.perBar ? R.frac(x) : x)).sort();
  const check = (got: Set<string>): boolean => {
    if (r.contains && !want(r.contains).every((k) => got.has(k))) return false;
    if (r.excludes && want(r.excludes).some((k) => got.has(k))) return false;
    if (r.equals) {
      const eq = want(r.equals);
      if (eq.length !== got.size || !eq.every((k) => got.has(k))) return false;
    }
    return true;
  };
  if (!r.perBar) {
    const ok = check(new Set(onsets(ev).map(ratKey)));
    return { ok, detail: ok ? "every hit is where it should be" : "the hits are not where this asks yet" };
  }
  // The bars of the piece: an arranged piece shorter than the rendered window (RC2's eight bars of `arrange()`
  // under a 16-bar render) is counted over its own bars, never over the silence after it ends
  // (build-author-capstones-rhythm). A bar past `totalBars` in which nothing at all plays is not a bar of the piece.
  const playing = new Set(n.all.map((e) => R.floor(e.onset)));
  const window = windowBars(n, ctx);
  const total = Array.from({ length: window }, (_, b) => b).filter(
    (b) => !(ctx.totalBars && b >= ctx.totalBars && !playing.has(b)),
  ).length;
  let good = 0;
  let firstBad: number | null = null;
  for (let b = 0; b < window; b++) {
    if (ctx.totalBars && b >= ctx.totalBars && !playing.has(b)) continue;
    const got = new Set(onsets(ev.filter((e) => R.floor(e.onset) === b)).map((o) => ratKey(R.frac(o))));
    if (check(got)) good++;
    else firstBad ??= b;
  }
  // Corrections gate: say which place holds an onset it must not (`excludes`), in the bar's own beat words.
  const extraAt =
    firstBad !== null && r.excludes
      ? r.excludes.find((x) =>
          onsets(ev.filter((e) => R.floor(e.onset) === firstBad)).some((o) => R.eq(R.frac(o), R.frac(x))),
        )
      : undefined;
  return {
    ok: total > 0 && good === total,
    value: good,
    target: total,
    // Clarity pass (2026-11-22): "0 of 16 bars have the onsets" left the learner guessing. Say how many bars
    // are right and the first place to fix, in the bar's own beat words.
    detail: (() => {
      const right = `right in ${good} of ${total} bars`;
      if (firstBad === null) return right;
      if (extraAt !== undefined)
        return `${right}; ${placeText(R.add(rat(firstBad), R.frac(extraAt)), ctx)} has a hit too, where this part stays silent`;
      const bar = ev.filter((e) => R.floor(e.onset) === firstBad);
      const missing = r.contains?.find((x) => !onsets(bar).some((o) => R.eq(R.frac(o), R.frac(x))));
      return missing !== undefined
        ? `${right}; ${placeText(R.add(rat(firstBad), R.frac(missing)), ctx)} has no hit yet`
        : `${right}; bar ${locAt(rat(firstBad), ctx).bar} is the first to fix`;
    })(),
    ...(firstBad !== null ? { where: locAt(rat(firstBad), ctx) } : {}),
  };
};
const degreeSet: Impl<"degree-set"> = (r, n, ctx) => {
  const whole = pitched(selectTrack(n, r.track));
  // A count ("twice or more") is made on one pass of the line's own loop, as `motif-reuse` reads a riff: a
  // two-bar loop with one ♭7 has it once, however long it plays (Wave 6; "at least once" is unchanged).
  const reach = whole.reduce((m, e) => Math.max(m, R.floor(e.onset) + 1), 0);
  const window = Math.max(1, Math.min(ctx.bars ?? reach, reach || 1));
  const period = (r.minCount ?? 1) > 1 ? periodOf(whole, MOTIF_PERIOD_CAP, window) : window;
  const ev = period < window ? whole.filter((e) => R.floor(e.onset) < period) : whole;
  const key = keyOf(whole, ctx.key ?? null);
  if (!key || ev.length === 0) return { ok: false, detail: "no pitched notes" };
  const degs = ev.map((e) => degreeOf(e.midi, key).degree);
  const problems: string[] = [];
  if (r.subsetOf) {
    const out = degs.filter((d) => !(r.subsetOf as string[]).includes(d));
    if (out.length) problems.push(`degree ${out[0]} is outside ${r.subsetOf.join(" ")}`);
  }
  const shown = (x: string) => x.replace(/^b/, "♭").replace(/^#/, "♯");
  if (r.contains) {
    const min = r.minCount ?? 1;
    const short = r.contains.filter((d) => degs.filter((x) => x === d).length < min);
    if (short.length)
      problems.push(
        min === 1
          ? `no ${short.map(shown).join(" or ")} in the line yet`
          : `${short.map(shown).join(" and ")} appear${short.length === 1 ? "s" : ""} fewer than ${min} times`,
      );
  }
  let anyCount: number | undefined;
  if (r.anyOf) {
    const a = degreeAnyOf(ev, key, r.anyOf, r.minCount ?? 1);
    anyCount = a.count;
    if (!a.ok) problems.push(a.detail);
  }
  return {
    ok: problems.length === 0,
    ...(anyCount !== undefined && r.anyOf ? { value: anyCount, target: r.minCount ?? 1 } : {}),
    detail: problems.length ? problems.join("; ") : "the degrees are right",
  };
};
const soundName = (id: string): string =>
  id
    .replace(/^snd\./, "")
    .split(".")
    .pop() ?? id;
/** `sounds` with a `track` and `anyOf`: at least this share of the line's notes on one of the sounds. */
const SOUNDS_TRACK_SHARE = 0.75;
const sounds: Impl<"sounds"> = (r, n) => {
  // Corrections pass (`sounds.track`): the sound of one named track ("the octave line on a synth wave").
  const pool = r.track ? selectTrack(n, r.track) : n.all;
  const used = new Set(pool.map((e) => e.s).filter((s): s is string => !!s));
  const problems: string[] = [];
  const on = r.track ? ` in \`${r.track.replace(/^@/, "")}\`` : "";
  if (r.track && pool.length === 0) problems.push(`nothing plays${on}`);
  if (r.contains) {
    const missing = r.contains.filter((id) => !used.has(soundName(id)));
    if (missing.length) problems.push(`no ${missing.map(soundName).join(", ")}${on}`);
  }
  if (r.anyOf && pool.length > 0 && !r.anyOf.some((id) => used.has(soundName(id))))
    problems.push(
      `${r.track ? `\`${r.track.replace(/^@/, "")}\` plays ${[...used].join(", ") || "no named sound"}, ` : ""}none of ${r.anyOf.map(soundName).join(", ")}`,
    );
  else if (r.anyOf && r.track && pool.length > 0) {
    // Corrections gate (AS-03): the named line is on one of these sounds, not one note in four of it.
    const want = new Set(r.anyOf.map(soundName));
    const isOn = (e: NEvent): boolean => typeof e.s === "string" && want.has(e.s);
    const on = pool.filter(isOn).length;
    if (on / pool.length < SOUNDS_TRACK_SHARE) {
      const other = pool.find((e) => !isOn(e));
      problems.push(
        `only ${on} of ${pool.length} notes in \`${r.track.replace(/^@/, "")}\` are on ${[...want].join(", ")}; the rest play ${other?.s ?? "another sound"}: keep the whole line on one of them`,
      );
    }
  }
  if (r.subsetOf) {
    const allowed = new Set(r.subsetOf.map(soundName));
    const extra = [...used].filter((s) => !allowed.has(s));
    if (extra.length) problems.push(`${extra.join(", ")} isn't one of ${[...allowed].join(", ")}`);
  }
  return { ok: problems.length === 0, detail: problems.length ? problems.join("; ") : [...used].join(", ") };
};
const distinctPitches: Impl<"distinct-pitches"> = (r, n) => {
  const d = new Set(pitched(selectTrack(n, r.track)).map((e) => e.midi)).size;
  return { ok: d >= r.min, value: d, target: r.min, detail: `${d} different pitch(es); at least ${r.min}` };
};
/**
 * The song's own chords, bar by bar (1-based from the first full bar), from `songForm` when the host passes it, as
 * roots in order (a chord repeated in a bar once). `null` without a chart.
 */
function songChartRoots(ctx: RubricContext): (number[] | undefined)[] | null {
  const form = ctx.songForm;
  if (!form?.some((s) => s.chords)) return null;
  const out: (number[] | undefined)[] = [undefined];
  for (const s of form)
    for (let i = 0; i < s.bars; i++) {
      const roots = (s.chords?.[i] ?? []).flatMap((sym) => {
        const c = parseChordSymbol(sym);
        return c ? [c.rootPc] : [];
      });
      out.push(roots.length > 0 ? roots.filter((x, j) => j === 0 || roots[j - 1] !== x) : undefined);
    }
  return out;
}
/** The piece's chord roots, bar by bar (the same numbering as `detectDevices`). */
function pieceRootsByBar(n: Normalized, ctx: RubricContext): Map<number, number[]> {
  const shift = ctx.pickup ? 0 : 1;
  const out = new Map<number, number[]>();
  for (const s of harmonySlots(n)) {
    if (!s.chord) continue;
    const bar = R.floor(s.span[0]) + shift;
    const here = out.get(bar) ?? [];
    if (here[here.length - 1] !== s.chord.rootPc) here.push(s.chord.rootPc);
    out.set(bar, here);
  }
  return out;
}
const deviceCount: Impl<"device-count"> = (r, n, ctx) => {
  const found = detectDevices(n, { ...ctx, bars: windowBars(n, ctx) });
  // A song's own devices are not the learner's (JC4, review:robustness): with the song's chart passed (`songForm`),
  // a device counts only in a bar where the learner changed the chords (the bar its first chord sounds in).
  const chart = songChartRoots(ctx);
  const piece = chart ? pieceRootsByBar(n, ctx) : null;
  // The piece is read past the song's end when it loops (the 64-bar window): bar 34 of a 32-bar song is its bar 2.
  const songBars = chart ? chart.length - 1 : 0;
  const changedAt = (bar: number): boolean => {
    const want = chart?.[songBars > 0 && bar > songBars ? ((bar - 1) % songBars) + 1 : bar];
    if (!want) return true;
    const got = piece?.get(bar) ?? [];
    return got.length !== want.length || got.some((x, i) => x !== want[i]);
  };
  const all = chart ? found.filter((d) => changedAt(d.bar)) : found;
  // Each device once, with the bar it first sounds in ("each detected and named with its bar", CF-A).
  const first = new Map<string, number>();
  for (const d of all) if (!first.has(d.device)) first.set(d.device, d.bar);
  const hit = r.devices.filter((d) => first.has(d));
  const open = r.devices.filter((d) => !first.has(d));
  const named = hit.map((d) => `${d} (bar ${first.get(d)})`).join(", ");
  const ok = hit.length >= r.min;
  return {
    ok,
    value: hit.length,
    target: r.min,
    detail: ok
      ? `${hit.length} of ${r.devices.length}: ${named}`
      : `${hit.length} of the ${r.min} asked for${hit.length ? `: ${named}` : ""}; still open: ${open.join(", ")}`,
  };
};
const matches: Impl<"matches"> = (r, n, ctx) => {
  const ref = ctx.resolveReference?.(r.reference);
  if (!ref) return { ok: false, detail: "the reference could not be evaluated" };
  // The piece is queried longer than the reference (a Make reads 16 bars, a capstone more): compare the
  // reference's bars only, so a 4-bar loop played for 16 bars is not 12 bars of "extra" chords (Wave 4 fix).
  const piece = sliceNormalized(n, 0, Math.max(1, r.reference.bars));
  const all = ctx.resolveReferences?.(r.reference) ?? [];
  const m = (all.length > 1 ? all : [ref])
    .map((x) => runMatcher(r.matcher, x, piece, ctx))
    .reduce((best, x) => (x.score > best.score ? x : best));
  return {
    ok: m.score >= r.min - 1e-9,
    value: m.score,
    target: r.min,
    detail: `${pct(m.score)} like the reference; at least ${pct(r.min)}`,
    extra: m.diagnostics.slice(0, 3),
  };
};

// --- custom rules (registered by name, each with a unit test) ------------------------------------

export type CustomRule = (n: Normalized, ctx: RubricContext, params: Record<string, unknown>) => RuleEval;

const CUSTOM_DEPS: CorrectionDeps = {
  pieceSlots,
  ruleKeys,
  pieceBars,
  toolUse: (ctx, tools, n) => {
    const code = n ? withoutUnheardLines(ctx.code, n) : withoutMutedLines(ctx.code);
    const used = ctx.toolsUsed ? ctx.toolsUsed(code).map((t) => t.id) : null;
    const count = tools.reduce(
      (a, t) => a + (used ? used.filter((u) => u === t).length : usesInSource(code, t)),
      0,
    );
    return { used: count > 0, label: tools.map((t) => toolText(t, ctx.toolCode)).join(" or ") };
  },
};
const BUILT_CUSTOM_RULES: Readonly<Record<string, CustomRule>> = {
  // Corrections pass: effect checks for the lesson fixes (rubric/corrections-rules.ts).
  ...correctionRules(CUSTOM_DEPS),
  // Wave 7 Build: the advanced tracks' rules (rubric/wave7-custom.ts), walking-bass, allowed-tensions and
  // ii-v-chain rebuilt to their content-kit definitions (w7plan A3, A4).
  ...wave7CustomRules(CUSTOM_DEPS),
};
/**
 * Every custom rule by name. Wave 7 (rubric/wave7-rules.ts): each planned rule of the advanced tracks
 * (`TRACK_CUSTOM_RULES`) that is not built yet answers "not built yet" with `rubric.unknown`, never "no custom rule".
 */
export const CUSTOM_RULES: Readonly<Record<string, CustomRule>> = {
  ...wave7CustomStubs(Object.keys(BUILT_CUSTOM_RULES)),
  ...BUILT_CUSTOM_RULES,
};
const custom: Impl<"custom"> = (r, n, ctx) => {
  const fn = CUSTOM_RULES[r.fn];
  if (!fn)
    return {
      ok: false,
      detail: `no custom rule named ${r.fn}`,
      extra: [diag("rubric.unknown", { rule: r.fn })],
    };
  return fn(n, ctx, r.params ?? {});
};

/** The rule → analyzer map (exercises §3.10, contracts §5.6). */
export const RULES: { [K in RubricRule["rule"]]: Impl<K> } = {
  bars,
  "duration-sec": durationSecRule,
  "tempo-bpm": tempoBpm,
  tracks,
  "in-key": inKey,
  "ends-on-degree": endsOnDegree,
  cadence,
  "chord-tones-strong": chordTonesStrong,
  progression,
  "contains-rn": containsRn,
  range,
  "step-ratio": stepRatio,
  "harmonic-rhythm": harmonicRhythmRule,
  "groove-lock": grooveLockRule,
  swing: swingRule,
  syncopation: syncopationRule,
  form,
  "voice-leading": voiceLeadingRule,
  "guide-tones": guideTones,
  // Wave 6 (rubric/wave6-rules.ts): the key plan and `via`; `anyOf` and the declared tonic.
  modulation: modulationRule,
  mode: modeWave6,
  "blues-form": bluesFormRule,
  // Wave 7 Build: on the views of analyze/wave7-views.ts, golden-tested (rubric/wave7-rules.test.ts).
  euclid: euclidRule,
  clave: claveRule,
  polyrhythm: polyrhythmRule,
  "register-separation": registerSepRule,
  "no-muddy-low": noMuddyLowRule,
  uses,
  custom,
  "motif-reuse": motifReuseRule,
  contrast,
  "key-change": keyChange,
  "velocity-ghosts": velocityGhostsWave6,
  onsets: onsetsRule,
  "degree-set": degreeSet,
  sounds,
  "distinct-pitches": distinctPitches,
  "device-count": deviceCount,
  matches,
  pickup: pickupRule,
  "chord-qualities": chordQualitiesRule,
  "chord-inversions": chordInversionsRule,
  "non-chord-tones": (r, n, ctx) => nonChordTonesRule(r, n, ctx, pieceSlots),
  // Wave 5 (docs/design/wave5.md §3.2): `bass-line` on the bass view; `notates` through @oak/notation.
  "bass-line": (r, n, ctx) => bassLineRule(r, n, ctx, pieceSlots),
  notates: (r, n, ctx) => notatesRule(r, n, ctx, pieceSlots, pieceBars(n, ctx)),
  // Wave 6 (docs/design/wave6.md §3.2; rubric/wave6-rules.ts): the same tune over new chords (U16.L05).
  reharmonize: reharmonizeRule,
  // Wave 6 Build (U13.L05): a triplet somewhere in the line.
  tuplets: tupletsRule,
};

/**
 * Evaluates one rule. Unknown rule names (content from a newer version) fail with `rubric.unknown`. A rule with a
 * `section` (Wave 5, feature `rubric.section`) is read on that section or bar window only; `contrast` and
 * `key-change` name their own sections and ignore it.
 */
export function evalRule(rule: RubricRule, n: Normalized, ctx: RubricContext): RuleEval {
  const impl = (RULES as Record<string, Impl<RubricRule["rule"]> | undefined>)[rule.rule];
  if (!impl)
    return {
      ok: false,
      detail: `unknown rule ${rule.rule}`,
      extra: [diag("rubric.unknown", { rule: rule.rule })],
    };
  // A Wave 6 field with no analyzer yet is never silently ignored (rubric/wave6-rules.ts `WAVE6_UNBUILT`).
  const unbuilt = unbuiltWave6(rule) ?? unbuiltWave7(rule);
  if (unbuilt) return notBuiltYet(rule, unbuilt);
  const run = impl as (r: RubricRule, n: Normalized, c: RubricContext) => RuleEval;
  if (rule.section && rule.rule !== "contrast" && rule.rule !== "key-change") {
    const scoped = scopeToSection(rule.section, n, ctx);
    if ("error" in scoped) return scoped.error;
    // The section keeps the key the whole piece gives it (a lifted last chorus is read in its own key).
    const keys = ruleKeys(n, ctx);
    const keyByBar = keys.slice(scoped.from, scoped.from + (scoped.ctx.bars ?? keys.length));
    const sctx = keyByBar.length > 0 ? { ...scoped.ctx, keyByBar } : scoped.ctx;
    return unscope(run(rule, scoped.n, sctx), rule.section, scoped.from);
  }
  return run(rule, n, ctx);
}

/** Partial credit of a rule outcome: 1 when met, else `credit` or `min(1, value / target)`, else 0. */
export function ruleCredit(e: RuleEval): number {
  if (e.ok) return 1;
  if (e.credit !== undefined) return Math.max(0, Math.min(1, e.credit));
  if (e.value !== undefined && e.target !== undefined && e.target > 0)
    return Math.max(0, Math.min(1, e.value / e.target));
  return 0;
}
