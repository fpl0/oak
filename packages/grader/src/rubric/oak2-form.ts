// Oak 2.0 form and arrangement rules (docs/oak2/PLAN.md §5–§6, wave W0 Task 2): how a piece ends, whether its
// sections are carved from the fullest one, whether a seam is blurred, whether something happens once, and whether
// the piece has an arc. Strategies from DeSantis, *Making Music*: Three Ways to End, Short Loops as Endings,
// Arranging as a Subtractive Process, Power of Erasing, Fuzzy Boundaries, Unique Events, Maximal Density, Dramatic Arc.
//
// Each rule reads what is heard: the learner's own tracks (never a Band's, `band.*`), their onsets bar by bar and
// beat by beat, with beats counted in `ctx.meter` and places named with `ctx.pickup`. Every rule takes `tracks`
// (track refs; default every learner track): a named track with no events fails with a detail naming it. Content
// uses them as `{ rule: "custom", fn: "<name>", params: { … } }`; the integrator registers them (W0 Task 7).
import type { KeySpec, NEvent } from "@oak/content-kit";
import { R, rat } from "@oak/content-kit";
import { METERS, pcOf, toLeadSheet } from "@oak/theory";
import type { ChordSlot } from "../analyze/chords.ts";
import { locAt } from "../analyze/events.ts";
import { resolveSection, sectionsFromAst } from "../analyze/sections.ts";
import { selectTrack } from "../analyze/tracks.ts";
import { formView } from "../analyze/wave5-views.ts";
import type { Normalized, SectionInfo } from "../types.ts";
import type { RubricContext } from "./context.ts";
import type { CorrectionDeps, CorrectionEval, CorrectionRule } from "./corrections-rules.ts";
import { placeText } from "./corrections-rules.ts";

// --- params -----------------------------------------------------------------------------------------

const num = (p: Record<string, unknown>, k: string, d: number): number =>
  typeof p[k] === "number" && Number.isFinite(p[k]) ? (p[k] as number) : d;
const strs = (p: Record<string, unknown>, k: string): string[] | undefined =>
  Array.isArray(p[k]) && (p[k] as unknown[]).every((x) => typeof x === "string")
    ? (p[k] as string[])
    : undefined;

// --- the piece as the rules read it -------------------------------------------------------------------------

interface Track {
  name: string;
  events: NEvent[];
}
interface Piece {
  /** Learner tracks that sound, each with its events before `total`. */
  tracks: Track[];
  /** Bars of the piece: the `arrange()` total, else the bars queried. */
  total: number;
  /** Beats per bar (`ctx.meter`). */
  u: number;
  sections: SectionInfo[] | null;
  /** `n` restricted to `tracks` (no Band), for the shared views. */
  n: Normalized;
}

const NEEDS_SECTIONS =
  "needs sections: write one `arrange()` per labelled track, so the piece has sections to compare";
const nameWord = (ref: string): string => `\`${ref.replace(/^@/, "")}\``;
const plural = (k: number, word: string): string => `${k} ${word}${k === 1 ? "" : "s"}`;
const orList = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`;
const andList = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
const barOf = (e: NEvent): number => R.floor(e.onset);
const at = (x: number): number => Math.round(x * 1e6) / 1e6;
/** "bar 5" for a 0-based cycle, numbered as the learner counts (bar 0 is a pickup bar). */
const barNo = (cycle: number, ctx: RubricContext): number => locAt(rat(cycle), ctx).bar ?? cycle + 1;
const barText = (cycle: number, ctx: RubricContext): string => `bar ${barNo(cycle, ctx)}`;
const barsText = (from: number, to: number, ctx: RubricContext): string =>
  to - from <= 1 ? barText(from, ctx) : `bars ${barNo(from, ctx)}–${barNo(to - 1, ctx)}`;

/**
 * The tracks a rule reads and the piece's sections. A failing reading comes back as the rule's answer: a named
 * track with no events, nothing playing, an inconsistent `arrange()`, or (when the rule needs them) no sections.
 */
function readPiece(
  n: Normalized,
  ctx: RubricContext,
  p: Record<string, unknown>,
  deps: CorrectionDeps,
  needSections: boolean,
): Piece | CorrectionEval {
  const s = sectionsFromAst(ctx.code);
  if (s && "inconsistent" in s) return { ok: false, detail: s.inconsistent.detail };
  if (!s && needSections) return { ok: false, detail: NEEDS_SECTIONS };
  const total = s ? s.totalBars : Math.max(1, ctx.bars ?? deps.pieceBars(n, ctx));
  const refs = strs(p, "tracks");
  const by = new Map<string, NEvent[]>();
  const add = (e: NEvent): void => {
    if (e.track.startsWith("band.") || barOf(e) >= total) return;
    const list = by.get(e.track) ?? [];
    list.push(e);
    by.set(e.track, list);
  };
  if (refs && refs.length > 0) {
    for (const ref of refs) {
      const got = selectTrack(n, ref).filter((e) => !e.track.startsWith("band.") && barOf(e) < total);
      if (got.length === 0)
        return {
          ok: false,
          value: 0,
          target: 1,
          detail: `${nameWord(ref)} plays nothing: check the label is spelt as the brief asks and is not muted with _`,
          where: { track: ref },
        };
      for (const e of got) if (!(by.get(e.track) ?? []).includes(e)) add(e);
    }
  } else for (const e of n.all) add(e);
  const tracks = [...by.entries()]
    .filter(([, es]) => es.length > 0)
    .map(([name, events]) => ({ name, events }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (tracks.length === 0) return { ok: false, value: 0, target: 1, detail: "nothing plays yet" };
  const byTrack = Object.fromEntries(tracks.map((t) => [t.name, t.events]));
  const all = tracks.flatMap((t) => t.events).sort((a, b) => R.cmp(a.onset, b.onset));
  return {
    tracks,
    total,
    u: METERS[ctx.meter].unitsPerBar,
    sections: s ? s.sections : null,
    n: { ...n, byTrack, all, band: [] },
  };
}
const isEval = (x: Piece | CorrectionEval): x is CorrectionEval => "ok" in x;

/** What an event is, for comparing material: its place in the unit, its pitch or sound (no gain, no track). */
function eventKey(
  e: NEvent,
  from: number,
  unitsPerCycle: number,
  o: { dur?: boolean; controls?: boolean },
): string {
  const place = at((R.toNum(e.onset) - from) * unitsPerCycle);
  const what = e.midi !== null ? `m${e.midi}` : (e.drum ?? e.s ?? "?");
  const dur = o.dur && e.midi !== null ? `|${at(R.toNum(e.clipDur ?? e.dur))}` : "";
  const ctl =
    o.controls && e.controls
      ? `|${Object.keys(e.controls)
          .sort()
          .map((k) => `${k}=${String(e.controls?.[k])}`)
          .join(",")}`
      : "";
  return `${place}|${what}${e.chordSymbol ? `|${e.chordSymbol}` : ""}${dur}${ctl}`;
}
/** Each bar's events of a track, by bar. */
function perBar(events: readonly NEvent[], total: number): NEvent[][] {
  const out: NEvent[][] = Array.from({ length: total }, () => []);
  for (const e of events) {
    const b = barOf(e);
    if (b >= 0 && b < total) (out[b] as NEvent[]).push(e);
  }
  return out;
}
/** A bar's material: the sorted keys of its onsets (empty string for a silent bar). */
const barSig = (
  es: readonly NEvent[],
  bar: number,
  o: { dur?: boolean; controls?: boolean } = { dur: true },
): string =>
  es
    .map((e) => eventKey(e, bar, 1, o))
    .sort()
    .join(";");
/** Every learner track's material in a bar, with the track's name: what the whole band plays there. */
function pieceBarSigs(pc: Piece): string[] {
  const bars = pc.tracks.map((t) => perBar(t.events, pc.total));
  return Array.from({ length: pc.total }, (_, b) =>
    pc.tracks.map((t, i) => `${t.name}:${barSig((bars[i] as NEvent[][])[b] as NEvent[], b)}`).join("/"),
  );
}
/** Beat signatures of the whole piece, beat by beat in `ctx.meter`: onsets with their track, place and pitch. */
function pieceBeatSigs(pc: Piece): string[] {
  const out: string[][] = Array.from({ length: pc.total * pc.u }, () => []);
  for (const t of pc.tracks)
    for (const e of t.events) {
      const x = R.toNum(e.onset) * pc.u;
      const i = Math.floor(x + 1e-9);
      if (i >= 0 && i < out.length) (out[i] as string[]).push(`${t.name}:${eventKey(e, i / pc.u, pc.u, {})}`);
    }
  return out.map((xs) => xs.sort().join(";"));
}
const sameSlice = (s: readonly string[], a: number, b: number, len: number): boolean => {
  for (let i = 0; i < len; i++) if (s[a + i] !== s[b + i]) return false;
  return true;
};
/** Onsets per bar of a span over the given tracks. */
const onsetsIn = (pc: Piece, from: number, to: number): number =>
  pc.tracks.reduce((a, t) => a + t.events.filter((e) => barOf(e) >= from && barOf(e) < to).length, 0);
const tracksIn = (pc: Piece, from: number, to: number): string[] =>
  pc.tracks.filter((t) => t.events.some((e) => barOf(e) >= from && barOf(e) < to)).map((t) => t.name);
const sectionName = (s: SectionInfo): string => s.tag;

// --- ends-on-purpose ------------------------------------------------------------------------------------------

const END_MODES = ["exit-order", "shrinking-tail", "build-out", "fades-out", "cadence", "final-hit"] as const;
type EndMode = (typeof END_MODES)[number];
const END_WORDS: Record<EndMode, string> = {
  "exit-order": "let the parts leave one by one, the reverse of how they came in",
  "shrinking-tail": "loop a shorter and shorter piece of the closing phrase",
  "build-out": "add parts so the last bar is the fullest",
  "fades-out": "fade out a part that repeats",
  cadence: "end on the home chord after the V or IV chord",
  "final-hit": "end on one last hit followed by silence",
};
/** Fades by at least this much in dB count as a fade (Oak's call; a fade you hear clearly, kept loose). */
const FADE_DB = 9;
const DOMINANT_QUALITIES = new Set(["7", "9", "13", "7b9", "7#9", "7#11", "7b13"]);

/** Whether the bar the ending lands in was written for the end: its material is heard in no earlier bar. */
const writtenForTheEnd = (sigs: readonly string[], bar: number): boolean =>
  !sigs.slice(0, bar).includes(sigs[bar] as string);

function exitOrder(pc: Piece, span: [number, number], ctx: RubricContext): string | null {
  const tr = pc.tracks.map((t) => ({
    name: t.name,
    entry: Math.min(...t.events.map(barOf)),
    exit: Math.max(...t.events.map(barOf)),
  }));
  const last = Math.max(...tr.map((t) => t.exit));
  // A part leaves when it stops for good: its last bar and the silence after it were never heard before (a loop
  // that rests in its last bar on every pass does not leave on the last pass).
  const leaves = (name: string, exit: number): boolean => {
    const t = pc.tracks.find((x) => x.name === name) as Track;
    const sigs = perBar(t.events, pc.total).map((es, b) => barSig(es, b));
    const tail = sigs.slice(exit, last + 1);
    for (let x = 0; x + tail.length <= exit; x++) if (tail.every((v, j) => sigs[x + j] === v)) return false;
    return true;
  };
  const inLast = tr.filter((t) => t.exit >= span[0]);
  const leavers = inLast.filter((t) => t.exit < last && leaves(t.name, t.exit));
  if (leavers.length < 2) return null;
  // Oak's call: parts that all stop in the same bar leave together, not in turn, so the leavers need at least two
  // different last bars; two of them may still stop together as one stage (X14, U09.L06 S4).
  if (new Set(leavers.map((t) => t.exit)).size < 2) return null;
  for (const a of inLast) for (const b of inLast) if (a.entry < b.entry && a.exit < b.exit) return null;
  const order = [...leavers].sort((a, b) => a.exit - b.exit);
  return `the parts leave one by one at the end (${order.map((t) => `${nameWord(t.name)} after ${barText(t.exit, ctx)}`).join(", ")}), the reverse of how they came in`;
}

function shrinkingTail(pc: Piece, span: [number, number]): string | null {
  const sig = pieceBeatSigs(pc);
  const s0 = span[0] * pc.u;
  const end = span[1] * pc.u;
  // The final loop X: the shortest unit the section ends by playing twice in a row.
  let p = 0;
  for (let q = 1; end - 2 * q >= 0; q++)
    if (sameSlice(sig, end - 2 * q, end - q, q) && sig.slice(end - q, end).some((x) => x !== "")) {
      p = q;
      break;
    }
  if (p === 0) return null;
  let k = 2;
  while (end - (k + 1) * p >= 0 && sameSlice(sig, end - (k + 1) * p, end - p, p)) k++;
  const x = sig.slice(end - p, end);
  const contains = (hay: readonly string[], needle: readonly string[]): boolean => {
    for (let i = 0; i + needle.length <= hay.length; i++)
      if (needle.every((v, j) => hay[i + j] === v)) return true;
    return false;
  };
  // Before the repeats of X: a longer piece Y of earlier material, heard before the section, whose continuation
  // back then was not what follows now (else the loop just plays on).
  for (let kk = k; kk >= 2; kk--) {
    const b = end - kk * p;
    if (b <= s0) continue;
    const after = sig.slice(b, end);
    // Y is a whole number of X's, and is looped inside the last section itself (the shortening happens there).
    for (let q = 2 * p; q <= Math.min(b - s0, 8 * pc.u); q += p) {
      const y = sig.slice(b - q, b);
      if (!y.some((v) => v !== "") || !contains(y, x)) continue;
      let earlier = false;
      let continues = false;
      for (let o = 0; o < s0 && o + q <= b - q; o++) {
        if (!y.every((v, j) => sig[o + j] === v)) continue;
        earlier = true;
        if (after.every((v, j) => sig[o + q + j] === v)) continues = true;
      }
      if (earlier && !continues) {
        const unit = (beats: number): string =>
          beats % pc.u === 0 ? plural(beats / pc.u, "bar") : plural(beats, "beat");
        return `the closing loop gets shorter at the end (from ${unit(q)} to ${unit(p)})`;
      }
    }
  }
  return null;
}

function buildOut(pc: Piece, span: [number, number]): string | null {
  const [a, b] = span;
  if (b - a < 2) return null;
  const tc = (bar: number): number => tracksIn(pc, bar, bar + 1).length;
  const oc = (bar: number): number => onsetsIn(pc, bar, bar + 1);
  const last = b - 1;
  for (let bar = a; bar < last; bar++) if (oc(bar) > oc(last)) return null;
  if (!(tc(last) > tc(a) && oc(last) > oc(a))) return null;
  return "parts build up through the last section and its final bar is the fullest";
}

function fadesOut(pc: Piece, span: [number, number]): string | null {
  const [a, b] = span;
  const len = b - a;
  if (len < 2) return null;
  const sigs = pieceBarSigs(pc).slice(a, b);
  let repeats = false;
  for (let q = 1; 2 * q <= len && !repeats; q++) {
    let same = true;
    for (let c = 0; c + q < len && same; c++) same = sigs[c] === sigs[c + q];
    if (same) repeats = true;
  }
  if (!repeats) return null;
  const gainIn = (bar: number): number =>
    pc.tracks.reduce(
      (s, t) => s + t.events.filter((e) => barOf(e) === bar).reduce((x, e) => x + e.gain, 0),
      0,
    );
  const first = gainIn(a);
  const final = Math.max(gainIn(b - 1), 1e-6);
  if (first <= 0) return null;
  const db = 20 * Math.log10(first / final);
  return db >= FADE_DB - 1e-9 ? "the last section repeats while it fades out" : null;
}

function cadence(
  pc: Piece,
  ctx: RubricContext,
  deps: CorrectionDeps,
  sigs: readonly string[],
): string | null {
  const slots = deps
    .pieceSlots(pc.n)
    .filter((s): s is ChordSlot & { chord: NonNullable<ChordSlot["chord"]> } => s.chord !== null)
    .filter((s) => R.lt(s.span[0], rat(pc.total)));
  const same = (x: ChordSlot["chord"], y: ChordSlot["chord"]): boolean =>
    !!x && !!y && x.rootPc === y.rootPc && x.quality === y.quality;
  const runs: (typeof slots)[number][] = [];
  for (const s of slots) if (!same(runs[runs.length - 1]?.chord ?? null, s.chord)) runs.push(s);
  const last = runs[runs.length - 1];
  const prev = runs[runs.length - 2];
  if (!last || !prev) return null;
  const keys = deps.ruleKeys(pc.n, ctx);
  const bar = R.floor(last.span[0]);
  const key: KeySpec | null = ctx.key ?? keys[Math.min(bar, keys.length - 1)] ?? null;
  if (!key) return null;
  const tonic = pcOf(key.tonic);
  const from = (prev.chord.rootPc - tonic + 12) % 12;
  if (last.chord.rootPc !== tonic || DOMINANT_QUALITIES.has(last.chord.quality)) return null;
  if (from !== 7 && from !== 5) return null;
  if (!writtenForTheEnd(sigs, bar)) return null;
  const name = (c: NonNullable<ChordSlot["chord"]>): string => toLeadSheet({ ...c, bassPc: c.rootPc });
  return `the piece ends on the home chord, ${name(last.chord)}, right after ${name(prev.chord)} (${from === 7 ? "V" : "IV"} to I)`;
}

function finalHit(pc: Piece, ctx: RubricContext, sigs: readonly string[]): string | null {
  const all = pc.n.all;
  const lastOnset = all.reduce((m, e) => (R.lt(m, e.onset) ? e.onset : m), all[0]?.onset ?? rat(0));
  const beat = rat(1, pc.u);
  const silentFrom = all.reduce((m, e) => {
    // A drum hit sounds for its step, up to a beat; a note for as long as it is written to last.
    const end = R.add(e.onset, e.midi !== null ? (e.clipDur ?? e.dur) : R.min(e.dur, beat));
    return R.lt(m, end) ? end : m;
  }, lastOnset);
  if (R.lt(R.sub(rat(pc.total), silentFrom), beat)) return null;
  if (!writtenForTheEnd(sigs, R.floor(lastOnset))) return null;
  return `the piece ends on one last hit (${placeText(lastOnset, ctx)}) and silence`;
}

/**
 * `ends-on-purpose` (U09.L06 Endings; F1 on CF-A): the last section (the last 4 bars without `arrange()`) ends the
 * piece on purpose, in any of `modes` (default all): **exit-order** ≥ 2 parts stop inside it, in at least two different
 * bars, in the reverse order of their entry (two parts may stop together); **shrinking-tail** it loops material heard before it and the loop gets shorter at least
 * once; **build-out** parts are added through it and its final bar is the fullest; **fades-out** its material repeats
 * while the summed level falls by ≥ 9 dB; **cadence** the last chord change is V→I or IV→I, on a bar heard nowhere
 * earlier; **final-hit** a last onset, on a bar heard nowhere earlier, then ≥ 1 beat of silence. A loop that plays
 * unchanged to the end passes none of them.
 */
const endsOnPurpose: (deps: CorrectionDeps) => CorrectionRule = (deps) => (n, ctx, p) => {
  const pc = readPiece(n, ctx, p, deps, false);
  if (isEval(pc)) return pc;
  const asked = strs(p, "modes")?.filter((m): m is EndMode => (END_MODES as readonly string[]).includes(m));
  const modes: readonly EndMode[] = asked && asked.length > 0 ? asked : END_MODES;
  const span: [number, number] = pc.sections
    ? (resolveSection("last", pc.sections, pc.total) ?? [0, pc.total])
    : [Math.max(0, pc.total - 4), pc.total];
  const sigs = pieceBarSigs(pc);
  for (const m of modes) {
    const got =
      m === "exit-order"
        ? exitOrder(pc, span, ctx)
        : m === "shrinking-tail"
          ? shrinkingTail(pc, span)
          : m === "build-out"
            ? buildOut(pc, span)
            : m === "fades-out"
              ? fadesOut(pc, span)
              : m === "cadence"
                ? cadence(pc, ctx, deps, sigs)
                : finalHit(pc, ctx, sigs);
    if (got) return { ok: true, value: 1, target: 1, detail: got };
  }
  const last = pc.sections?.[pc.sections.length - 1];
  const what = last
    ? `the last section (the ${sectionName(last)}) plays on like the rest`
    : `the last ${plural(span[1] - span[0], "bar")} play on like the rest`;
  return {
    ok: false,
    value: 0,
    target: 1,
    detail: `${what}: ${orList(modes.map((m) => END_WORDS[m]))}`,
    where: { bar: barNo(span[0], ctx) },
  };
};

// --- carved ------------------------------------------------------------------------------------------------

/** Each event's key in its bar, as a multiset (pitched notes keep their length: a held note is no deletion). */
const barKeys = (es: readonly NEvent[], bar: number): string[] =>
  es.map((e) => eventKey(e, bar, 1, { dur: true })).sort();
const subMultiset = (small: readonly string[], big: readonly string[]): boolean => {
  const left = new Map<string, number>();
  for (const k of big) left.set(k, (left.get(k) ?? 0) + 1);
  for (const k of small) {
    const c = left.get(k) ?? 0;
    if (c === 0) return false;
    left.set(k, c - 1);
  }
  return true;
};

/** The section with the most onsets per bar (ties: more tracks, then the first). */
function densestSection(pc: Piece, sections: readonly SectionInfo[]): SectionInfo {
  const score = (s: SectionInfo): [number, number] => [
    onsetsIn(pc, s.startBar, s.startBar + s.bars) / Math.max(1, s.bars),
    tracksIn(pc, s.startBar, s.startBar + s.bars).length,
  ];
  return sections.reduce((best, s) => {
    const [a, b] = score(s);
    const [x, y] = score(best);
    return a > x + 1e-9 || (Math.abs(a - x) <= 1e-9 && b > y) ? s : best;
  });
}

/**
 * A section with every part counts as carved when it plays at most this share of the fullest section's onsets per bar
 * (Oak's call: the `contrast` and `arc` threshold, a quarter fewer notes, so thinning you can hear counts).
 */
const CARVED_THIN = 0.75;

/**
 * `carved` (U09.L07 Carve It; A2.L08 Peak First): every section is the fullest section with parts or notes taken out.
 * The fullest (most onsets per bar) has every track; in every other section each track plays only bars that are its
 * bar at the same place in the fullest with notes deleted (a sub-multiset of it: a bar moved or reordered is new
 * material); at least `minDiffer` (default 2, Oak's call) different versions of the section are heard, where a version
 * is a line-up of tracks, or the full line-up thinned to at most `CARVED_THIN` of the fullest's onsets per bar. An
 * additive build (a verse line the chorus never plays) fails, as do identical sections.
 */
const carved: (deps: CorrectionDeps) => CorrectionRule = (deps) => (n, ctx, p) => {
  const pc = readPiece(n, ctx, p, deps, true);
  if (isEval(pc)) return pc;
  const sections = pc.sections as SectionInfo[];
  const minDiffer = num(p, "minDiffer", 2);
  const d = densestSection(pc, sections);
  const dSpan: [number, number] = [d.startBar, d.startBar + d.bars];
  const inD = new Set(tracksIn(pc, ...dSpan));
  for (const t of pc.tracks)
    if (!inD.has(t.name)) {
      const where = sections.find((s) => tracksIn(pc, s.startBar, s.startBar + s.bars).includes(t.name));
      return {
        ok: false,
        value: 0,
        target: 1,
        detail: `${nameWord(t.name)} plays in the ${where ? sectionName(where) : "piece"} but not in the ${sectionName(d)}, your fullest section: write the fullest section first with every part, then take parts out`,
        where: { track: t.name },
      };
    }
  for (const t of pc.tracks) {
    const bars = perBar(t.events, pc.total);
    const full = Array.from({ length: d.bars }, (_, i) =>
      barKeys(bars[d.startBar + i] ?? [], d.startBar + i),
    );
    for (const s of sections) {
      if (s === d) continue;
      for (let b = s.startBar; b < s.startBar + s.bars; b++) {
        const keys = barKeys(bars[b] ?? [], b);
        // The bar at the same place of the fullest section (looped when this section is longer).
        const same = full[(b - s.startBar) % d.bars] as string[];
        if (keys.length === 0 || subMultiset(keys, same)) continue;
        return {
          ok: false,
          value: 0,
          target: 1,
          detail: `${nameWord(t.name)} plays something in the ${sectionName(s)} (${barText(b, ctx)}) that it does not play at that place in the ${sectionName(d)}, your fullest section: make the other sections by taking parts or notes out of the ${sectionName(d)}, not by writing or moving notes`,
          where: { bar: barNo(b, ctx), track: t.name },
        };
      }
    }
  }
  const fullLineup = tracksIn(pc, ...dSpan).join(",");
  const peak = onsetsIn(pc, ...dSpan) / Math.max(1, d.bars);
  const versions = new Set(
    sections.map((s) => {
      const lineup = tracksIn(pc, s.startBar, s.startBar + s.bars).join(",");
      if (lineup !== fullLineup) return `parts:${lineup}`;
      const dens = onsetsIn(pc, s.startBar, s.startBar + s.bars) / Math.max(1, s.bars);
      if (dens > peak * CARVED_THIN + 1e-9) return "full";
      return `thin:${pc.tracks
        .map((t) =>
          perBar(t.events, pc.total)
            .slice(s.startBar, s.startBar + s.bars)
            .map((es, i) => barSig(es, s.startBar + i))
            .join("/"),
        )
        .join("|")}`;
    }),
  );
  const count = versions.size;
  if (count < minDiffer)
    return {
      ok: false,
      value: count,
      target: minDiffer,
      detail:
        count === 1
          ? "every section plays the same parts with about as many notes: take some parts out of some sections, or thin them out"
          : `${count} different versions of the ${sectionName(d)}; the brief asks for ${minDiffer}: take different parts or notes out of another section`,
    };
  return {
    ok: true,
    value: count,
    target: minDiffer,
    detail: `every section is the ${sectionName(d)} with parts or notes taken out (${count} different versions)`,
  };
};

// --- staggered-boundary -----------------------------------------------------------------------------------

/** A track's beat in a bar: the onsets that start in it (place, pitch or sound) and whether a note still sounds. */
function beatSigs(t: Track, bar: number, u: number): string[] {
  const out: string[][] = Array.from({ length: u }, () => []);
  const ring: boolean[] = Array.from({ length: u }, () => false);
  for (const e of t.events) {
    const x = (R.toNum(e.onset) - bar) * u;
    const end = x + (e.midi !== null ? R.toNum(e.clipDur ?? e.dur) * u : 0);
    for (let j = 0; j < u; j++) {
      if (x >= j - 1e-9 && x < j + 1 - 1e-9) {
        (out[j] as string[]).push(eventKey(e, bar + j / u, u, {}));
        ring[j] = true;
      } else if (x < j && end > j + 1e-9) ring[j] = true;
    }
  }
  return out.map((xs, j) => `${xs.sort().join(";")}${ring[j] ? "~" : ""}`);
}
/** Smallest period of a run of bar signatures, with at least one comparison; null when none holds. */
function periodOfSigs(sigs: readonly string[]): number | null {
  for (let q = 1; q < sigs.length; q++) {
    let same = true;
    for (let c = 0; c + q < sigs.length && same; c++) same = sigs[c] === sigs[c + q];
    if (same) return q;
  }
  return null;
}

interface Shift {
  track: string;
  /** Beats from the bar line: negative before it, positive after it. */
  beats: number;
  kind: "stops" | "early" | "late" | "carries" | "changes-late";
}

/**
 * How a track moves at the seam `b` between sections `a` and `c`: off the bar line (a `Shift`), on it ("bar"), or not
 * at all (null). The bar before the seam is compared with what the track's own loop in section `a` would play there,
 * and the bar after it with what its loop in `c` plays; a difference that runs from some beat to the bar line (or
 * from the bar line to some beat) is a change of state off the bar line.
 */
function moveAt(t: Track, a: SectionInfo, c: SectionInfo, u: number): Shift[] | "bar" | null {
  const b = c.startBar;
  const sigsOf = (bar: number): string => beatSigs(t, bar, u).join("/");
  const aBars = Array.from({ length: a.bars - 1 }, (_, i) => sigsOf(a.startBar + i));
  const cBars = Array.from({ length: c.bars - 1 }, (_, i) => sigsOf(b + 1 + i));
  // The bar the track's own loop would play just before the seam (from section `a`) and just after it (from `c`).
  const qa = aBars.length >= 2 ? periodOfSigs(aBars) : aBars.length === 1 ? 1 : null;
  const qc = cBars.length >= 2 ? periodOfSigs(cBars) : cBars.length === 1 ? 1 : null;
  const expA = qa === null ? null : b - 1 - qa;
  const expC = qc === null ? null : b + qc;
  const shifts: Shift[] = [];
  const silent = (s: string): boolean => s === "";
  if (expA !== null) {
    const got = beatSigs(t, b - 1, u);
    const want = beatSigs(t, expA, u);
    const diff = got.map((g, j) => g !== want[j]);
    const k = diff.indexOf(true);
    const suffix =
      k >= 1 &&
      diff.slice(k).every((dd, j) => dd || (silent(got[k + j] as string) && silent(want[k + j] as string)));
    if (suffix) {
      const stops = got.slice(k).every(silent);
      shifts.push({ track: t.name, beats: -(u - k), kind: stops ? "stops" : "early" });
    }
  }
  if (expC !== null) {
    const got = beatSigs(t, b, u);
    const want = beatSigs(t, expC, u);
    const diff = got.map((g, j) => g !== want[j]);
    const k = diff.lastIndexOf(true) + 1;
    const prefix =
      k >= 1 &&
      k <= u - 1 &&
      diff.slice(0, k).every((dd, j) => dd || (silent(got[j] as string) && silent(want[j] as string)));
    if (prefix) {
      // Carrying on is playing what the track played in `a` (its loop's bar there) past the bar line.
      const prev = beatSigs(t, expA ?? b - 1, u);
      const late = got.slice(0, k).every(silent);
      const carries = got.slice(0, k).every((g, j) => silent(g) || g === prev[j]);
      shifts.push({ track: t.name, beats: k, kind: late ? "late" : carries ? "carries" : "changes-late" });
    }
  }
  if (shifts.length > 0) return shifts;
  // No shift: does the track change at all across the seam (its bars in `a` against its bars in `c`)?
  const setA = new Set(aBars.length > 0 ? aBars : [sigsOf(b - 1)]);
  const setC = new Set(cBars.length > 0 ? cBars : [sigsOf(b)]);
  const changes = setA.size !== setC.size || [...setA].some((x) => !setC.has(x));
  return changes ? "bar" : null;
}

const shiftText = (s: Shift, next: SectionInfo): string => {
  const beats = plural(Math.abs(s.beats), "beat");
  return s.kind === "stops"
    ? `${nameWord(s.track)} stops ${beats} early`
    : s.kind === "early"
      ? `${nameWord(s.track)} changes ${beats} early`
      : s.kind === "late"
        ? `${nameWord(s.track)} comes in ${beats} late`
        : s.kind === "carries"
          ? `${nameWord(s.track)} carries on ${beats} into the ${sectionName(next)}`
          : `${nameWord(s.track)} changes ${beats} into the ${sectionName(next)}`;
};

/** Drum onsets of the given drum tracks in [from, to) cycles. */
const drumHits = (drums: readonly Track[], from: number, to: number): number =>
  drums.reduce(
    (a, t) =>
      a + t.events.filter((e) => R.toNum(e.onset) >= from - 1e-9 && R.toNum(e.onset) < to - 1e-9).length,
    0,
  );

/**
 * `staggered-boundary` (U09.L07 Carve It; A2.L09 Seams and Surprises; Fuzzy Boundaries): at ≥ `min` (default 1)
 * section seams, some but not all parts change state a beat or more off the bar line (stop early, carry on into the
 * next section, or come in late). Every part switching on the bar line fails; so does every changing part moving by
 * the same amount (the seam just moved). With `fill`: a drum fill in the bar before the seam (more drum hits than any
 * other bar of the section) that leaves the downbeat empty (`anticipate`) or runs past it (`hesitate`).
 */
const staggeredBoundary: (deps: CorrectionDeps) => CorrectionRule = (deps) => (n, ctx, p) => {
  const pc = readPiece(n, ctx, p, deps, true);
  if (isEval(pc)) return pc;
  const sections = pc.sections as SectionInfo[];
  const min = num(p, "min", 1);
  const fill = p.fill === "anticipate" || p.fill === "hesitate" ? p.fill : null;
  if (sections.length < 2)
    return { ok: false, value: 0, target: min, detail: "one section has no seam: add another section" };
  const found: string[] = [];
  let moved: string | null = null;
  const drums = pc.tracks.filter((t) => t.events.every((e) => e.drum !== undefined));
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1] as SectionInfo;
    const c = sections[i] as SectionInfo;
    const b = c.startBar;
    const seam = `the ${sectionName(a)} → ${sectionName(c)} seam (${barText(b, ctx)})`;
    if (fill) {
      if (drums.length === 0 || a.bars < 2) continue;
      const beat = 1 / pc.u;
      const before = drumHits(drums, b - 1, b);
      const usual = Math.max(
        ...Array.from({ length: a.bars - 1 }, (_, j) => drumHits(drums, a.startBar + j, a.startBar + j + 1)),
      );
      if (before <= usual) continue;
      const down = drumHits(drums, b, b + beat / 2);
      const firstBeat = drumHits(drums, b, b + beat);
      const usualFirst = Math.max(
        0,
        ...(c.bars > 1
          ? Array.from({ length: c.bars - 1 }, (_, j) => drumHits(drums, b + 1 + j, b + 1 + j + beat))
          : Array.from({ length: a.bars - 1 }, (_, j) =>
              drumHits(drums, a.startBar + j, a.startBar + j + beat),
            )),
      );
      if (fill === "anticipate" && down === 0)
        found.push(`a drum fill before ${seam}, with an empty downbeat`);
      if (fill === "hesitate" && firstBeat > usualFirst)
        found.push(`a drum fill that runs past the downbeat at ${seam}`);
      continue;
    }
    const shifts: Shift[] = [];
    let onBar = 0;
    for (const t of pc.tracks) {
      const m = moveAt(t, a, c, pc.u);
      if (m === "bar") onBar++;
      else if (m) shifts.push(...m);
    }
    if (shifts.length === 0) continue;
    const offsets = new Set(shifts.map((s) => s.beats));
    if (onBar === 0 && offsets.size === 1) {
      const s = shifts[0] as Shift;
      moved ??= `at ${seam} the parts all change ${plural(Math.abs(s.beats), "beat")} ${s.beats < 0 ? "early" : "late"} together: that just moves the seam; let only some parts change off the bar line`;
      continue;
    }
    found.push(
      `at ${seam}, ${andList(shifts.map((s) => `${shiftText(s, c)} (${placeText(rat(b * pc.u + s.beats, pc.u), ctx)})`))}${onBar > 0 ? " while the rest change on the bar line" : ""}`,
    );
  }
  const ok = found.length >= min;
  if (ok) return { ok, value: found.length, target: min, detail: found.slice(0, 2).join("; ") };
  const fails = fill
    ? fill === "anticipate"
      ? "no drum fill before a seam that leaves the downbeat empty: fill the bar before a new section and rest on its first beat"
      : "no drum fill that runs past the downbeat into a new section: let the fill carry on over the bar line"
    : (moved ??
      "every part changes right on the bar line at each seam: let one part stop a beat or more early, carry on into the next section, or come in late");
  return {
    ok: false,
    value: found.length,
    target: min,
    detail: found.length > 0 ? `${found.length} blurred seam; the brief asks for ${min}: ${fails}` : fails,
  };
};

// --- unique-event ----------------------------------------------------------------------------------------------

/**
 * `unique-event` (U09.L07; A2.L09; Unique Events): at least `min` (default 1) bars hold a moment heard once: a track's
 * bar material (onsets with pitch or drum sound; with `controls`, its sound controls too) heard in exactly that one bar
 * of the piece, inside a section type that occurs ≥ 2 times, and no longer than that bar (the track's bars around it
 * are heard again); or a stop, the track silent for that one bar while it plays around it and at that place of every
 * other time the section comes. A whole section heard once (an intro, a bridge) is no moment.
 */
const uniqueEvent: (deps: CorrectionDeps) => CorrectionRule = (deps) => (n, ctx, p) => {
  const pc = readPiece(n, ctx, p, deps, true);
  if (isEval(pc)) return pc;
  const sections = pc.sections as SectionInfo[];
  const min = num(p, "min", 1);
  const controls = p.controls === true;
  const count = new Map<string, number>();
  for (const s of sections) count.set(s.label, (count.get(s.label) ?? 0) + 1);
  const sectionAtBar = (b: number): SectionInfo | undefined =>
    sections.find((s) => b >= s.startBar && b < s.startBar + s.bars);
  const moments = new Map<number, string>();
  const wholeOnce = new Set<string>();
  for (const t of pc.tracks) {
    const bars = perBar(t.events, pc.total);
    const sigs = bars.map((es, b) => barSig(es, b, { dur: true, controls }));
    const times = new Map<string, number>();
    for (const s of sigs) times.set(s, (times.get(s) ?? 0) + 1);
    // A stop is a moment too: an empty bar in a section that comes back, where the track plays in the bars around it
    // and at the same place of every other time that section comes.
    const stop = (b: number): boolean => {
      if (sigs[b] !== "") return false;
      const s = sectionAtBar(b);
      if (!s) return false;
      const near = [b - 1, b + 1].filter((x) => x >= s.startBar && x < s.startBar + s.bars);
      if (near.length === 0 || near.some((x) => sigs[x] === "")) return false;
      const others = sections.filter((o) => o !== s && o.label === s.label);
      return (
        others.length > 0 &&
        others.every((o) => {
          const x = o.startBar + (b - s.startBar);
          return x < o.startBar + o.bars && sigs[x] !== "";
        })
      );
    };
    const once = (b: number): boolean => (sigs[b] !== "" && times.get(sigs[b] as string) === 1) || stop(b);
    for (let b = 0; b < pc.total; b++) {
      if (!once(b)) continue;
      const s = sectionAtBar(b);
      if (!s) continue;
      if ((count.get(s.label) ?? 0) < 2) continue;
      const lo = s.startBar;
      const hi = s.startBar + s.bars;
      if ((b - 1 >= lo && once(b - 1)) || (b + 1 < hi && once(b + 1))) continue;
      if (!moments.has(b))
        moments.set(
          b,
          sigs[b] === ""
            ? `${nameWord(t.name)} stops for one bar, once, in ${barText(b, ctx)} (${s.label})`
            : `${nameWord(t.name)} plays something once, in ${barText(b, ctx)} (${s.label})`,
        );
    }
  }
  // Sections heard once whose material is new to the piece (an intro, a bridge): new as a whole, no moment.
  for (const s of sections) {
    if ((count.get(s.label) ?? 0) > 1) continue;
    const inside = (b: number): boolean => b >= s.startBar && b < s.startBar + s.bars;
    const isNew = pc.tracks.some((t) => {
      const sigs = perBar(t.events, pc.total).map((es, b) => barSig(es, b, { dur: true, controls }));
      const outside = new Set(sigs.filter((_, b) => !inside(b)));
      return sigs.some((x, b) => inside(b) && x !== "" && !outside.has(x));
    });
    if (isNew) wholeOnce.add(sectionName(s));
  }
  const ok = moments.size >= min;
  const list = [...moments.entries()].sort((x, y) => x[0] - y[0]).map(([, v]) => v);
  if (ok) return { ok, value: moments.size, target: min, detail: list.slice(0, 3).join("; ") };
  const how = "add one moment (a hit, a fill, an effect) to one bar of a section you repeat";
  const whole = [...wholeOnce];
  return {
    ok: false,
    value: moments.size,
    target: min,
    detail:
      moments.size > 0
        ? `${plural(moments.size, "moment")} heard once (${list.join("; ")}); the brief asks for ${min}: ${how}`
        : whole.length > 0
          ? `the ${andList(whole)} ${whole.length === 1 ? "plays" : "each play"} only once as a whole, and nothing happens only once inside a section you repeat: ${how}`
          : `nothing happens only once: ${how}`,
  };
};

// --- arc ----------------------------------------------------------------------------------------------------

/**
 * A section counts as thinner than the fullest when its onsets per bar are at least this much lower (Oak's call, the
 * `contrast` default `CONTRAST_THRESHOLDS.densityRatio`, read the same way: exactly a quarter fewer counts).
 */
const THINNER = 0.25;

/**
 * `arc` (A2.L08 Peak First, optional suggestion; Dramatic Arc): the fullest section (most onsets per bar) has a
 * thinner section before it and after it; repeats of the fullest next to each other are allowed. Fails: the fullest
 * comes first or last; every section about as busy.
 */
const arc: (deps: CorrectionDeps) => CorrectionRule = (deps) => (n, ctx, p) => {
  const pc = readPiece(n, ctx, p, deps, true);
  if (isEval(pc)) return pc;
  const view = formView(pc.n, { code: ctx.code, bars: pc.total });
  if (view.kind !== "sections") return { ok: false, detail: NEEDS_SECTIONS };
  const dens = view.sections.map((s) => s.features.density);
  const peak = Math.max(...dens);
  const thin = dens.map((d) => d <= peak * (1 - THINNER) + 1e-9);
  if (!thin.some(Boolean))
    return {
      ok: false,
      value: 0,
      target: 1,
      detail:
        "every section is about as busy: take parts out of some sections so one stands out as the fullest",
    };
  for (let i = 0; i < dens.length; i++) {
    if (Math.abs((dens[i] as number) - peak) > 1e-9) continue;
    let lo = i;
    let hi = i;
    while (lo > 0 && !thin[lo - 1]) lo--;
    while (hi < dens.length - 1 && !thin[hi + 1]) hi++;
    if (lo > 0 && hi < dens.length - 1) {
      const first = view.sections[lo] as SectionInfo;
      const last = view.sections[hi] as SectionInfo;
      return {
        ok: true,
        value: 1,
        target: 1,
        detail: `the ${sectionName(view.sections[i] as SectionInfo)} (${barsText(first.startBar, last.startBar + last.bars, ctx)}) is the fullest, with thinner sections before and after it`,
      };
    }
  }
  const at0 = Math.abs((dens[0] as number) - peak) <= 1e-9 || !thin[0];
  const name = sectionName(view.sections[dens.indexOf(peak)] as SectionInfo);
  return {
    ok: false,
    value: 0,
    target: 1,
    detail: at0
      ? `the fullest section, the ${name}, comes first: put a thinner section before it, so the piece builds to it`
      : `the fullest section, the ${name}, comes last: let the piece come down after it with a thinner section`,
  };
};

/** The form and arrangement rules of Oak 2.0, by name (merged into `CUSTOM_RULES` by the integrator). */
export function oak2FormRules(deps: CorrectionDeps): Record<string, CorrectionRule> {
  return {
    "ends-on-purpose": endsOnPurpose(deps),
    carved: carved(deps),
    "staggered-boundary": staggeredBoundary(deps),
    "unique-event": uniqueEvent(deps),
    arc: arc(deps),
  };
}
