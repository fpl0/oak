// Wave 7 Build (grader): the advanced tracks' custom rules (content-kit `TRACK_CUSTOM_RULES`, contracts 1.8 §5.6),
// each built on its view of analyze/wave7-views.ts so a rule, a lens and a checklist can never disagree. Every rule
// reads what is HEARD (normalize leaves out silent parts and parts more than 24 dB under the loudest one) and
// judges the musical result, never the function written: four attacks crowded into beat 1 do not walk, a ii–V
// aims at a key whether or not its I arrives, a `voicing()` line is not a hand voicing, a whole line moved late is
// no displaced copy. Each takes `alsoUses` (the corrections-pass convention: once the effect is heard, the code must
// also use one of these tools, credit 0.5 otherwise). Details describe the fault in musical words and never print
// the code that would fix it (no feedback below the reveal rung names the answer).
//
// Tested in wave7-custom.test.ts on real Strudel output: for each, right answers, the pre-flight's counterexample,
// and a wrong answer that uses the right function.
import type { KeySpec, MeterId, NEvent, Rat } from "@oak/content-kit";
import { AVAILABLE_TENSIONS, R, rat, type VoicingShape, voicingShapeOf } from "@oak/content-kit";
import {
  CHORD_SCALES,
  type ChordId,
  type ChordScaleId,
  chordPcs,
  chordScales,
  lateMs,
  METERS,
  metricWeights,
  parseChordSymbol,
  toLeadSheet,
  twoFiveTarget,
} from "@oak/theory";
import type { ChordSlot } from "../analyze/chords.ts";
import { mod12, pitched } from "../analyze/events.ts";
import { selectTrack } from "../analyze/tracks.ts";
import {
  barPeriodOf,
  claveAlignmentView,
  claveView,
  compareIdioms,
  contrafactView,
  counterMelodyView,
  feelView,
  governingSlot,
  groupingView,
  hemiolaView,
  interlockView,
  polymeterView,
  sampleChopView,
  slotsFor,
  voicedChordOf,
  voicingView,
  walkingBassView,
} from "../analyze/wave7-views.ts";

export { voicedChordOf };

import { noteName } from "../match/common.ts";
import type { Normalized } from "../types.ts";
import type { RubricContext } from "./context.ts";
import type { CorrectionDeps, CorrectionEval, CorrectionRule } from "./corrections-rules.ts";
import { placeText, withAlsoUses } from "./corrections-rules.ts";
import { scopeToSection } from "./wave5-rules.ts";

// --- params and words --------------------------------------------------------------------------------------------

const num = (p: Record<string, unknown>, k: string, d: number): number =>
  typeof p[k] === "number" && Number.isFinite(p[k]) ? (p[k] as number) : d;
const str = (p: Record<string, unknown>, k: string, d: string): string =>
  typeof p[k] === "string" && (p[k] as string).length > 0 ? (p[k] as string) : d;
const strs = (p: Record<string, unknown>, k: string): string[] | undefined =>
  Array.isArray(p[k]) && (p[k] as unknown[]).every((x) => typeof x === "string")
    ? (p[k] as string[])
    : undefined;
const ratP = (p: Record<string, unknown>, k: string): Rat | undefined => {
  const v = p[k];
  return Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === "number") && v[1] !== 0
    ? rat(v[0] as number, v[1] as number)
    : undefined;
};
const ratsP = (p: Record<string, unknown>, k: string): Rat[] | undefined =>
  Array.isArray(p[k]) &&
  (p[k] as unknown[]).every(
    (x) => Array.isArray(x) && x.length === 2 && x.every((y) => typeof y === "number"),
  )
    ? (p[k] as [number, number][]).map(([a, b]) => rat(a, b))
    : undefined;
const pct = (x: number): string => `${Math.round(x * 100)}%`;
const plural = (k: number, word: string, many = `${word}s`): string => `${k} ${k === 1 ? word : many}`;
const ROLE_WORDS: Record<string, string> = {
  "@melody": "the tune",
  "@bass": "the bass",
  "@drums": "the drums",
  "@chords": "the chords",
};
const trackWord = (ref: string): string =>
  ref === "*" ? "your lines" : (ROLE_WORDS[ref] ?? `\`${ref.replace(/^@/, "")}\``);
const EPS = 1e-6;
const at = (e: Pick<NEvent, "onset">): number => R.toNum(e.onset);
const barsOf = (n: Normalized, ctx: RubricContext): number =>
  Math.max(
    1,
    Math.min(
      ctx.bars ?? Number.POSITIVE_INFINITY,
      n.all.reduce((m, e) => Math.max(m, R.floor(e.onset) + 1), 0) || 1,
    ),
  );
const chordOfSlot = (s: ChordSlot): ChordId | null =>
  s.chord ?? (s.symbol ? parseChordSymbol(s.symbol) : null);
const slotAtNum = (slots: readonly ChordSlot[], t: number): ChordSlot | undefined =>
  slots.find((s) => R.toNum(s.span[0]) <= t + EPS && t + EPS < R.toNum(s.span[1]));

const chordName = (c: ChordId): string => toLeadSheet(c);
const isStructural = (e: NEvent, meter: MeterId, all: boolean): boolean => {
  if (all) return true;
  const beat = 1 / METERS[meter].unitsPerBar;
  const v = at(e) / beat;
  return Math.abs(v - Math.round(v)) < 1e-6 || R.toNum(e.clipDur ?? e.dur) >= beat - 1e-6;
};
const nothing = (ref: string): CorrectionEval => ({
  ok: false,
  value: 0,
  target: 1,
  detail: `nothing plays in ${trackWord(ref)} that you can hear: it is silent, or more than 24 dB under the loudest part`,
});
const keyOfCtx = (ctx: RubricContext): KeySpec | null => ctx.key ?? null;

// --- jazz harmony --------------------------------------------------------------------------------------------------

/**
 * `walking-bass` (J3.L04, J4.L02, JC2): an attack on every quarter of every bar, the chord's root on beat 1 in at
 * least `rootOnOne` of the bars, a chord tone on beat 3 in at least `chordToneOnThree`, and beat 4 within
 * `maxSemis` of the next bar's beat-1 note (not the same note) in at least `approachOnFour` of the bar lines.
 */
/** The share of bars in which a walk plays at least three different notes. */
const WALK_MOVES = 0.5;
const walkingBass: CorrectionRule = (n, ctx, p) => {
  const bassRef = str(p, "bass", "@bass");
  const harmony = str(p, "harmony", "@chords");
  const changes = strs(p, "changes");
  if (pitched(selectTrack(n, bassRef)).length === 0) return nothing(bassRef);
  const v = walkingBassView(n, {
    meter: ctx.meter,
    bars: barsOf(n, ctx),
    bass: bassRef,
    harmony,
    ...(changes ? { changes } : {}),
    skips: p.skips === true,
  });
  if (!Array.isArray(v)) return { ok: false, detail: v.notBuilt };
  const rootMin = num(p, "rootOnOne", 0.75);
  const threeMin = num(p, "chordToneOnThree", 0);
  const approachMin = num(p, "approachOnFour", 0.5);
  const maxSemis = num(p, "maxSemis", 2);
  const notWalking = v.find((b) => !b.quarters);
  const share = (k: number, of: number) => (of ? k / of : 0);
  const roots = share(v.filter((b) => b.rootOnOne).length, v.length);
  const threes = share(v.filter((b) => b.chordToneOnThree).length, v.length);
  const lines = v.filter((b) => b.approach);
  const approaches = share(
    lines.filter((b) => b.approach && b.approach.semis > 0 && b.approach.semis <= maxSemis).length,
    lines.length,
  );
  // A walk moves: a line that sits on one or two notes through most bars (roots repeated, an approach tacked on at
  // the end) keeps every quarter and every downbeat and is still not a walking bass (review:robustness).
  const units = METERS[ctx.meter].unitsPerBar;
  const moving = share(v.filter((b) => b.distinct >= Math.min(3, units)).length, v.length);
  const credit = Math.min(1, (v.length - v.filter((b) => !b.quarters).length) / v.length);
  if (notWalking)
    return {
      ok: false,
      value: credit,
      target: 1,
      credit: credit * 0.5,
      detail: `bar ${notWalking.bar}: the bass does not walk there. A walking bass plays one note on every beat of every bar${p.skips === true ? " (an eighth just before a beat may skip in)" : ""}, and nothing else`,
      where: { bar: notWalking.bar },
    };
  const faults: string[] = [];
  if (roots < rootMin - EPS)
    faults.push(`the chord's root on beat 1 in ${pct(roots)} of the bars; at least ${pct(rootMin)}`);
  if (threes < threeMin - EPS)
    faults.push(`a chord tone on beat 3 in ${pct(threes)} of the bars; at least ${pct(threeMin)}`);
  if (moving < WALK_MOVES - EPS)
    faults.push(
      `the line moves to ${Math.min(3, units)} or more different notes in ${pct(moving)} of the bars; a walk keeps moving, a new note on most beats, in at least ${pct(WALK_MOVES)}`,
    );
  if (lines.length > 0 && approaches < approachMin - EPS)
    faults.push(
      `beat 4 leads into the next bar by a step (at most ${maxSemis} half steps, not the same note) at ${pct(approaches)} of the bar lines; at least ${pct(approachMin)}`,
    );
  const firstRootMiss = v.find((b) => !b.rootOnOne);
  return faults.length === 0
    ? {
        ok: true,
        value: 1,
        target: 1,
        detail: `the bass walks: every beat played, the root on beat 1 in ${pct(roots)} of the bars, approached from beat 4 at ${pct(approaches)} of the bar lines`,
      }
    : {
        ok: false,
        value: Math.min(
          roots / Math.max(rootMin, EPS),
          lines.length ? approaches / Math.max(approachMin, EPS) : 1,
          moving / WALK_MOVES,
        ),
        target: 1,
        detail: faults.join("; "),
        ...(firstRootMiss && roots < rootMin ? { where: { bar: firstRootMiss.bar } } : {}),
      };
};

/** The tones and tensions a melody note may be over a chord (content-kit `AVAILABLE_TENSIONS` by seventh core). */
const CORE: Record<string, string> = {
  maj7: "maj7",
  maj9: "maj7",
  "maj7#11": "maj7",
  maj: "maj7",
  "7": "7",
  "9": "7",
  "13": "7",
  "7b9": "7",
  "7#9": "7",
  "7#11": "7",
  "7b13": "7",
  m7: "m7",
  m9: "m7",
  m11: "m7",
  min: "m7",
  m7b5: "m7b5",
  dim7: "dim7",
  "7alt": "7alt",
  "6": "6",
  "69": "6",
  m6: "m6",
  mMaj7: "mMaj7",
  "7sus4": "7sus4",
  sus4: "7sus4",
};
function noteOver(midi: number, c: ChordId): { fine: boolean; role: string; avoid: boolean } {
  const rel = mod12(midi - c.rootPc);
  const table = AVAILABLE_TENSIONS[(CORE[c.quality] ?? "") as keyof typeof AVAILABLE_TENSIONS];
  const own = new Set(chordPcs(c).map((x) => mod12(x - c.rootPc)));
  if (own.has(rel) && c.quality !== "7alt") return { fine: true, role: "chord tone", avoid: false };
  if (!table) return { fine: own.has(rel), role: own.has(rel) ? "chord tone" : "outside", avoid: false };
  if (table.chordTones.includes(rel)) return { fine: true, role: "chord tone", avoid: false };
  if (table.tensions.includes(rel)) return { fine: true, role: "tension", avoid: false };
  return {
    fine: false,
    role: table.avoid.includes(rel) ? "avoid" : "outside",
    avoid: table.avoid.includes(rel),
  };
}
/**
 * `allowed-tensions` (J2.L03, J5.L04, JC4): the MELODY against the chords. Of its structural notes (on a beat, or
 * a beat long or more) the share that are a chord tone or an available tension of the chord at their onset.
 */
const allowedTensions: CorrectionRule = (n, ctx, p) => {
  const melRef = str(p, "melody", "@melody");
  const mel = pitched(selectTrack(n, melRef));
  if (mel.length === 0) return nothing(melRef);
  const slots = slotsFor(n, str(p, "harmony", "@chords"), melRef);
  const all = str(p, "structural", "beat") === "all";
  const judged = mel
    .filter((e) => isStructural(e, ctx.meter, all))
    .map((e) => {
      const s = governingSlot(slots, at(e));
      const c = s ? chordOfSlot(s) : null;
      return { e, c, r: c ? noteOver(e.midi, c) : null };
    })
    .filter((x) => x.c && x.r) as {
    e: NEvent & { midi: number };
    c: ChordId;
    r: ReturnType<typeof noteOver>;
  }[];
  if (judged.length === 0)
    return { ok: false, value: 0, target: 1, detail: "no chords under the tune's notes yet" };
  const fine = judged.filter((x) => x.r.fine).length;
  const ratio = fine / judged.length;
  const min = num(p, "minRatio", 0.85);
  const bad = judged.find((x) => !x.r.fine);
  const key = keyOfCtx(ctx);
  return ratio >= min - EPS
    ? {
        ok: true,
        value: ratio,
        target: min,
        detail: `${pct(ratio)} of the tune's long or on-beat notes are chord tones or tensions their chord takes`,
      }
    : {
        ok: false,
        value: ratio,
        target: min,
        detail: `${pct(ratio)} of the tune's long or on-beat notes sit well on their chord; at least ${pct(min)}${
          bad
            ? `. ${placeText(bad.e.onset, ctx)}: ${noteName(bad.e.midi, key)} over ${chordName(bad.c)} ${
                bad.r.avoid
                  ? "clashes: it sits a half step above a chord tone"
                  : "is outside the chord and its tensions"
              }`
            : ""
        }`,
        ...(bad ? { where: { bar: R.floor(bad.e.onset) + 1, track: melRef.replace(/^@/, "") } } : {}),
      };
};

const PC = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
/**
 * `ii-v-chain` (J2.L01, JC1): a minor seventh (or m7♭5) followed by a dominant a 4th above it aims at a key a 5th
 * below the V, whether or not its I arrives. Counts the distinct target keys.
 */
const iiVChain: CorrectionRule = (n, _ctx, p) => {
  const slots = slotsFor(n, typeof p.harmony === "string" ? (p.harmony as string) : undefined);
  const chords: { c: ChordId; bar: number }[] = [];
  for (const s of slots) {
    const c = chordOfSlot(s);
    if (!c) continue;
    const last = chords[chords.length - 1];
    if (last && last.c.rootPc === c.rootPc && last.c.quality === c.quality) continue;
    chords.push({ c, bar: R.floor(s.span[0]) + 1 });
  }
  const pairs: { bar: number; key: string; resolved: boolean }[] = [];
  for (let i = 0; i + 1 < chords.length; i++) {
    const a = chords[i] as { c: ChordId; bar: number };
    const b = chords[i + 1] as { c: ChordId; bar: number };
    const t = twoFiveTarget(a.c, b.c);
    if (!t) continue;
    const next = chords[i + 2]?.c;
    pairs.push({
      bar: a.bar,
      key: `${PC[t.tonicPc]} ${t.mode}`,
      resolved: !!next && next.rootPc === t.tonicPc,
    });
  }
  // Distinct target KEYS, tonic and mode (contracts §6.6 JC1: "≥ 3 distinct target keys"; C major and C minor are
  // two keys). The JC1 spec's "by tonic" reading is overruled by contracts (Wave 7 integration).
  const keys = [...new Set(pairs.map((x) => x.key))];
  const minKeys = num(p, "minKeys", 3);
  const minPairs = num(p, "minPairs", minKeys);
  const resolvedMin = num(p, "resolved", 0);
  const resolved = pairs.length ? pairs.filter((x) => x.resolved).length / pairs.length : 0;
  const ok = keys.length >= minKeys && pairs.length >= minPairs && resolved >= resolvedMin - EPS;
  return {
    ok,
    value: keys.length,
    target: minKeys,
    detail: ok
      ? `${plural(pairs.length, "ii–V")} into ${plural(keys.length, "key")}: ${keys.join(", ")}`
      : pairs.length === 0
        ? "no ii–V yet: a minor seventh chord, then a dominant seventh a 4th above it"
        : keys.length < minKeys
          ? `${plural(pairs.length, "ii–V")} aiming at ${plural(keys.length, "key")} (${keys.join(", ")}); the brief asks for ${minKeys} different keys`
          : pairs.length < minPairs
            ? `${plural(pairs.length, "ii–V")}; at least ${minPairs}`
            : `${pct(resolved)} of the ii–Vs arrive on their I; at least ${pct(resolvedMin)}`,
  };
};

const SHAPE_WORDS: Record<string, string> = {
  shell: "a shell (root, then the 3rd and the 7th)",
  close: "a close voicing (four notes inside an octave)",
  "drop-2": "a drop-2 voicing",
  "rootless-a": "a rootless A voicing (the 3rd at the bottom)",
  "rootless-b": "a rootless B voicing (the 7th at the bottom)",
};
/**
 * `voicing-shape` (J1.L05, J3.L01, J3.L02, JC2): each hand-voiced chord of `track` in one of `shape`, read
 * octave-aware from its written notes against `changes` (or its own symbol). A `voicing()` line fails with a reason.
 */
const voicingShape: CorrectionRule = (n, ctx, p) => {
  const ref = str(p, "track", "@chords");
  const shapes = (strs(p, "shape") ?? []) as VoicingShape[];
  if (shapes.length === 0) return { ok: false, detail: "the rule needs `shape`" };
  if (pitched(selectTrack(n, ref)).length === 0) return nothing(ref);
  const changes = strs(p, "changes");
  const v = voicingView(n, { meter: ctx.meter, track: ref, ...(changes ? { changes } : {}) });
  if (v.length === 0)
    return {
      ok: false,
      value: 0,
      target: 1,
      detail: `no chords to read in ${trackWord(ref)}: give each bar its chord`,
    };
  if (v.some((x) => x.dictionary))
    return {
      ok: false,
      value: 0,
      target: 1,
      detail: `${trackWord(ref)} is voiced by the dictionary, so the shape is not yours: write the notes of each chord yourself`,
    };
  const judged = v.map((x) => {
    const c = parseChordSymbol(x.chord) as ChordId;
    const shape = voicingShapeOf(x.midis, voicedChordOf(c));
    return { x, c, shape, ok: shape !== null && shapes.includes(shape) };
  });
  const good = judged.filter((j) => j.ok).length;
  const ratio = good / judged.length;
  const min = num(p, "minRatio", 1);
  const bad = judged.find((j) => !j.ok);
  const want = shapes.map((s) => SHAPE_WORDS[s] ?? s).join(" or ");
  return ratio >= min - EPS
    ? { ok: true, value: ratio, target: min, detail: `${pct(ratio)} of the chords are ${want}` }
    : {
        ok: false,
        value: ratio,
        target: min,
        detail: `${pct(ratio)} of the chords are ${want}; at least ${pct(min)}${
          bad
            ? `. Bar ${bad.x.bar}, ${chordName(bad.c)}: ${
                bad.shape
                  ? `that is ${SHAPE_WORDS[bad.shape] ?? bad.shape}`
                  : `the notes (${bad.x.midis.map((m) => noteName(m, keyOfCtx(ctx))).join(" ")}) are none of these shapes`
              }`
            : ""
        }`,
        ...(bad ? { where: { bar: bad.x.bar } } : {}),
      };
};

/** Song notes against the learner's: matched by onset (a 16th's tolerance), pitch by `mode`. */
function melodyKept(
  n: Normalized,
  ctx: RubricContext,
  melRef: string,
  mode: string,
): { matched: number; total: number; first: { at: Rat; text: string } | null } | null {
  const song = ctx.songMelody;
  if (!song || song.length === 0) return null;
  const shift = ctx.pickup ? 1 : 0;
  // One pass of the piece (its arrange() length): a 16-bar version of a 32-bar song is judged on its 16 bars,
  // never against the song's bars 17–32 while the version loops (build-author-capstones-sound).
  const bars = ctx.totalBars && ctx.totalBars > 0 ? Math.min(barsOf(n, ctx), ctx.totalBars) : barsOf(n, ctx);
  // A swung tune is the same tune: an off-beat 8th of the song may sound up to a 16th later (3:1), the learner's
  // `.swingBy()` since U11.L07 (build-author-capstones-sound). Elsewhere a 32nd either way.
  const beat = 1 / METERS[ctx.meter].unitsPerBar;
  const offbeat8 = (t: number): boolean => {
    const inBeat = (((t % beat) + beat) % beat) / beat;
    return Math.abs(inBeat - 0.5) < 1e-6;
  };
  const near = (got: number, want: number): boolean =>
    Math.abs(got - want) < 1 / 32 || (offbeat8(want) && got > want && got - want <= beat / 4 + EPS);
  const mel = pitched(selectTrack(n, melRef)).sort((a, b) => R.cmp(a.onset, b.onset) || b.midi - a.midi);
  const top = mel.filter((e, i) => i === 0 || !R.eq(e.onset, (mel[i - 1] as NEvent).onset));
  const want = song
    .map((x) => ({ t: R.toNum(x.onset) + shift, midi: x.midi, onset: R.add(x.onset, rat(shift)) }))
    .filter((x) => x.t < bars - EPS && x.t > -EPS);
  if (want.length === 0) return null;
  let offset: number | null = mode === "absolute" ? 0 : null;
  let matched = 0;
  let first: { at: Rat; text: string } | null = null;
  const key = keyOfCtx(ctx);
  for (const w of want) {
    const g = top.find((e) => Math.abs(at(e) - w.t) < 1 / 32) ?? top.find((e) => near(at(e), w.t));
    if (!g) {
      first ??= { at: w.onset, text: `the tune's ${noteName(w.midi, key)} is missing` };
      continue;
    }
    let same = false;
    if (mode === "pitch-class") same = mod12(g.midi - w.midi) === 0;
    else {
      offset ??= g.midi - w.midi;
      same = g.midi - w.midi === offset;
    }
    if (same) matched++;
    else
      first ??= {
        at: w.onset,
        text: `the tune has ${noteName(w.midi + (offset ?? 0), key)} here; yours has ${noteName(g.midi, key)}`,
      };
  }
  // Notes of yours inside the song's span that the song does not have (a loop past its end is not judged).
  const end = Math.min(bars, Math.max(...song.map((x) => R.toNum(x.onset) + R.toNum(x.dur))) + shift);
  const extra = top.filter((e) => at(e) < end - EPS && !want.some((w) => near(at(e), w.t)));
  if (extra[0]) first ??= { at: extra[0].onset, text: `${noteName(extra[0].midi, key)} is not in the tune` };
  return { matched, total: want.length + extra.length, first };
}
/** `song-melody-kept` (JC4, J4.L04, CF-T.S4, AC1): the melody is the song's own, note for note. */
const songMelodyKept: CorrectionRule = (n, ctx, p) => {
  const melRef = str(p, "melody", "@melody");
  if (!ctx.songMelody || ctx.songMelody.length === 0)
    return {
      ok: false,
      value: 0,
      target: 1,
      detail: "the song's melody is not available to compare with: pick the song in the brief first",
    };
  if (pitched(selectTrack(n, melRef)).length === 0) return nothing(melRef);
  const k = melodyKept(n, ctx, melRef, str(p, "pitch", "absolute"));
  if (!k)
    return {
      ok: false,
      value: 0,
      target: 1,
      detail: "the song's melody does not fall inside the piece's bars",
    };
  const ratio = k.total ? k.matched / k.total : 0;
  const min = num(p, "minRatio", 1);
  return ratio >= min - EPS
    ? {
        ok: true,
        value: ratio,
        target: min,
        detail: `the tune is the song's own (${pct(ratio)} of its notes)`,
      }
    : {
        ok: false,
        value: ratio,
        target: min,
        detail: `${pct(ratio)} of the song's tune is kept; ${min >= 1 ? "all of it" : `at least ${pct(min)}`}${
          k.first ? `. ${placeText(k.first.at, ctx)}: ${k.first.text}` : ""
        }. The tune stays as the song has it`,
        ...(k.first ? { where: { bar: R.floor(k.first.at) + 1, track: melRef.replace(/^@/, "") } } : {}),
      };
};
/** The song's changes, one symbol a bar (the first chord of each bar of `songForm`). */
const songChanges = (ctx: RubricContext): string[] =>
  (ctx.songForm ?? []).flatMap((s) =>
    Array.from({ length: s.bars }, (_, i) => (s.chords?.[i]?.[0] as string | undefined) ?? ""),
  );
/**
 * A stand-in model head written into the rubric (W7 gate, decision 80): `{ name, notes, at }`, where `notes` are one
 * section's notes as `[onsetNum, onsetDen, durNum, durDen, midi]` from the section's first bar and `at` the bars
 * (0-based) where that section starts. JC3 reads it while the song's own answer key is not on file, so the
 * contrafact rule still judges what is heard: a tune that repeats the head the course taught on these changes.
 */
export function standInModel(
  p: Record<string, unknown>,
): { name: string; notes: { onset: Rat; dur: Rat; midi: number }[] } | null {
  const v = p.standIn as { name?: unknown; notes?: unknown; at?: unknown } | undefined;
  if (
    !v ||
    typeof v !== "object" ||
    typeof v.name !== "string" ||
    !Array.isArray(v.notes) ||
    !Array.isArray(v.at)
  )
    return null;
  const notes: { onset: Rat; dur: Rat; midi: number }[] = [];
  for (const start of v.at) {
    if (typeof start !== "number" || !Number.isInteger(start) || start < 0) return null;
    for (const raw of v.notes) {
      if (!Array.isArray(raw) || raw.length !== 5 || !raw.every((x) => typeof x === "number")) return null;
      const [on, od, dn, dd, midi] = raw as number[];
      if (!od || !dd) return null;
      notes.push({
        onset: R.add(rat(start, 1), rat(on as number, od)),
        dur: rat(dn as number, dd),
        midi: midi as number,
      });
    }
  }
  notes.sort((a, b) => R.cmp(a.onset, b.onset) || a.midi - b.midi);
  return notes.length > 0 ? { name: v.name, notes } : null;
}

/** `contrafact` (JC3): the model's changes bar by bar, and a melody that is NOT the model's head. */
const contrafact: CorrectionRule = (n, ctx, p) => {
  const melRef = str(p, "melody", "@melody");
  const changes = strs(p, "changes") ?? songChanges(ctx).filter((x) => x !== "");
  if (changes.length === 0)
    return { ok: false, detail: "no changes to compare with: the brief names the song's changes" };
  if (pitched(selectTrack(n, melRef)).length === 0) return nothing(melRef);
  // The song's own head when the host has it; else the stand-in the brief names (the head the course taught).
  const standIn = ctx.songMelody && ctx.songMelody.length > 0 ? null : standInModel(p);
  const model = ctx.songMelody && ctx.songMelody.length > 0 ? ctx.songMelody : (standIn?.notes ?? null);
  const v = contrafactView(n, {
    meter: ctx.meter,
    bars: barsOf(n, ctx),
    changes,
    ...(model ? { model } : {}),
    melody: melRef,
    harmony: str(p, "harmony", "@chords"),
    ...(ctx.pickup ? { pickup: ctx.pickup } : {}),
  });
  if (!("changesRatio" in v)) return { ok: false, detail: v.notBuilt };
  const minChanges = num(p, "changesMinRatio", 0.85);
  const maxShared = num(p, "maxSharedRatio", 0.5);
  if (v.changesRatio < minChanges - EPS)
    return {
      ok: false,
      value: v.changesRatio,
      target: minChanges,
      detail: `${pct(v.changesRatio)} of the bars keep the song's changes; at least ${pct(minChanges)} (bar ${v.changedBars.slice(0, 3).join(", ")} ${v.changedBars.length === 1 ? "differs" : "differ"}). A contrafact keeps the old chords under a new tune`,
      ...(v.changedBars[0] ? { where: { bar: v.changedBars[0] } } : {}),
    };
  if (!model)
    return {
      ok: false,
      value: 0.5,
      target: 1,
      credit: 0.5,
      detail: "the changes are the song's; its head is not available to check that your tune is new",
    };
  const old = standIn ? standIn.name : "the old head";
  return v.sharedMelodyRatio <= maxShared + EPS
    ? {
        ok: true,
        value: 1,
        target: 1,
        detail: `the song's changes in ${pct(v.changesRatio)} of the bars under a tune of your own (${pct(v.sharedMelodyRatio)} of its bars echo ${old})`,
      }
    : {
        ok: false,
        value: maxShared / Math.max(v.sharedMelodyRatio, EPS),
        target: 1,
        detail: `${pct(v.sharedMelodyRatio)} of your tune's bars repeat ${old} (bar ${v.sharedBars.slice(0, 3).join(", ")}); at most ${pct(maxShared)}. The changes stay; the tune is new`,
        ...(v.sharedBars[0] ? { where: { bar: v.sharedBars[0] } } : {}),
      };
};

/** Whether a chord carries a 9th, 11th or 13th: from its symbol, or from its notes over the bass's root. */
function extended(s: ChordSlot): boolean {
  if (s.symbol) {
    const c = parseChordSymbol(s.symbol);
    if (c && /9|11|13|alt|69/.test(c.quality)) return true;
    if (c) return false;
  }
  const root = s.bassMidi ?? s.midis[0];
  if (root === undefined) return false;
  const rels = new Set(s.midis.map((m) => mod12(m - root)));
  const has3 = rels.has(3) || rels.has(4);
  const has7 = rels.has(10) || rels.has(11);
  return (
    (rels.has(2) && (has3 || has7)) ||
    (rels.has(5) && rels.has(3) && has7) ||
    (rels.has(9) && has7 && rels.has(4))
  );
}
/** `extended-share` (AC2): the share of bars whose chord carries a 9th, 11th or 13th. */
const extendedShare: CorrectionRule = (n, ctx, p) => {
  const ref = str(p, "harmony", "@chords");
  const own = selectTrack(n, ref);
  if (own.length === 0) return nothing(ref);
  const slots = slotsFor(n, ref);
  const bars = barsOf(n, ctx);
  let ext = 0;
  let judged = 0;
  let firstPlain: number | null = null;
  for (let b = 0; b < bars; b++) {
    const s = slotAtNum(slots, b);
    if (!s) continue;
    judged++;
    if (extended(s)) ext++;
    else firstPlain ??= b + 1;
  }
  const ratio = judged ? ext / judged : 0;
  const min = num(p, "minRatio", 0.6);
  return ratio >= min - EPS
    ? { ok: true, value: ratio, target: min, detail: `${pct(ratio)} of the bars carry a 9th, 11th or 13th` }
    : {
        ok: false,
        value: ratio,
        target: min,
        detail: `${pct(ratio)} of the bars carry a 9th, 11th or 13th; at least ${pct(min)}${firstPlain ? ` (bar ${firstPlain} is a plain chord)` : ""}`,
        ...(firstPlain ? { where: { bar: firstPlain } } : {}),
      };
};

/** The scale a melody note is read against over a chord (`chord-scale-fit`): m7 Dorian, 7 Mixolydian, … */
function scalesFor(c: ChordId, key: KeySpec | null, next: ChordId | null): ChordScaleId[] {
  const core = CORE[c.quality] ?? "";
  if (core === "maj7" || core === "6") return ["ionian", "lydian"];
  if (core === "m7" || core === "m6") return ["dorian"];
  if (core === "7" && c.quality === "7") return ["mixolydian"];
  if (core === "m7b5") return ["locrian", "locrian-nat2"];
  if (core === "7alt") return ["altered"];
  if (core === "dim7") return ["whole-half"];
  const s = chordScales(c, { ...(key ? { key } : {}), ...(next ? { next } : {}) });
  return s.length > 0 ? [s[0] as ChordScaleId] : [];
}
/** `chord-scale-fit` (J2.L04): the melody's structural notes over each chord belong to that chord's scale. */
const chordScaleFit: CorrectionRule = (n, ctx, p) => {
  const melRef = str(p, "melody", "@melody");
  const mel = pitched(selectTrack(n, melRef));
  if (mel.length === 0) return nothing(melRef);
  const slots = slotsFor(n, str(p, "harmony", "@chords"), melRef);
  const key = keyOfCtx(ctx);
  const judged: { e: NEvent & { midi: number }; c: ChordId; ok: boolean; scale: string }[] = [];
  for (const e of mel) {
    if (!isStructural(e, ctx.meter, false)) continue;
    const i = slots.findIndex((s) => R.toNum(s.span[0]) <= at(e) + EPS && at(e) + EPS < R.toNum(s.span[1]));
    const s = slots[i];
    const c = s ? chordOfSlot(s) : null;
    if (!c) continue;
    const next = slots[i + 1] ? chordOfSlot(slots[i + 1] as ChordSlot) : null;
    const scales = scalesFor(c, key, next);
    const rel = mod12(e.midi - c.rootPc);
    const ok = scales.some((sc) => (CHORD_SCALES[sc] as readonly number[]).some((x) => mod12(x) === rel));
    judged.push({ e, c, ok, scale: scales[0] ?? "" });
  }
  if (judged.length === 0)
    return { ok: false, value: 0, target: 1, detail: "no chords under the tune's notes yet" };
  const ratio = judged.filter((j) => j.ok).length / judged.length;
  const min = num(p, "minRatio", 0.8);
  const bad = judged.find((j) => !j.ok);
  return ratio >= min - EPS
    ? {
        ok: true,
        value: ratio,
        target: min,
        detail: `${pct(ratio)} of the tune's long or on-beat notes are in their chord's scale`,
      }
    : {
        ok: false,
        value: ratio,
        target: min,
        detail: `${pct(ratio)} of the tune's long or on-beat notes are in their chord's scale; at least ${pct(min)}${
          bad
            ? `. ${placeText(bad.e.onset, ctx)}: ${noteName(bad.e.midi, key)} is not in the scale over ${chordName(bad.c)}`
            : ""
        }`,
        ...(bad ? { where: { bar: R.floor(bad.e.onset) + 1 } } : {}),
      };
};

const TENSION_SEMIS: Record<string, number> = { "9": 2, b9: 1, "#9": 3, "11": 5, "#11": 6, "13": 9, b13: 8 };
/** `tensions-used` (J2.L03, AC2): the melody lands on one of `tensions` over its chord, on a structural note. */
const tensionsUsed: CorrectionRule = (n, ctx, p) => {
  const melRef = str(p, "melody", "@melody");
  const mel = pitched(selectTrack(n, melRef));
  if (mel.length === 0) return nothing(melRef);
  const names = strs(p, "tensions") ?? [];
  const wanted = new Set(names.map((x) => TENSION_SEMIS[x]).filter((x): x is number => x !== undefined));
  if (wanted.size === 0) return { ok: false, detail: "the rule needs `tensions`" };
  const slots = slotsFor(n, str(p, "harmony", "@chords"), melRef);
  const hits: NEvent[] = [];
  for (const e of mel) {
    if (!isStructural(e, ctx.meter, false)) continue;
    const s = slotAtNum(slots, at(e));
    const c = s ? chordOfSlot(s) : null;
    if (c && wanted.has(mod12(e.midi - c.rootPc))) hits.push(e);
  }
  const min = num(p, "min", 2);
  const said = names.map((x) => x.replace("b", "♭").replace("#", "♯")).join(" or ");
  return hits.length >= min
    ? {
        ok: true,
        value: hits.length,
        target: min,
        detail: `the tune lands on the ${said} ${plural(hits.length, "time")}`,
      }
    : {
        ok: false,
        value: hits.length,
        target: min,
        detail:
          hits.length === 0
            ? `the tune never lands on the ${said} of its chord (on a beat, or held a beat or more)`
            : `the tune lands on the ${said} ${plural(hits.length, "time")}; at least ${min}`,
      };
};

// --- versions and idioms -------------------------------------------------------------------------------------------

const soundsOf = (x: Normalized): Set<string> =>
  new Set(x.all.map((e) => e.s ?? (e.midi !== null ? "triangle" : "")).filter((s) => s !== ""));
const tuneOf = (x: Normalized, ref: string): number[] => {
  const mel = pitched(selectTrack(x, ref)).sort((a, b) => R.cmp(a.onset, b.onset) || b.midi - a.midi);
  return mel.filter((e, i) => i === 0 || !R.eq(e.onset, (mel[i - 1] as NEvent).onset)).map((e) => e.midi);
};
const swung = (x: Normalized, meter: MeterId): boolean =>
  feelView(x, { meter }).some((f) => f.swingRatio !== null && f.swingRatio >= 1.3);
/**
 * `two-versions-differ` (AC1): both versions keep the tune (pitch classes in order, or the same tune moved to
 * another key) and differ audibly: tempo by `tempoDelta` BPM or one swung and one straight, and `soundsDiffer`
 * sounds of one absent from the other.
 */
const twoVersionsDiffer: CorrectionRule = (n, ctx, p) => {
  const other = ctx.otherVersion;
  if (!other)
    return {
      ok: false,
      value: 0,
      target: 1,
      detail: "the other version is not written yet: both versions are compared",
    };
  const melRef = str(p, "melody", "@melody");
  const a = tuneOf(n, melRef);
  const b = tuneOf(other.n, melRef);
  if (a.length === 0) return nothing(melRef);
  const len = Math.min(a.length, b.length, 64);
  const diffs = new Set(Array.from({ length: len }, (_, i) => mod12((a[i] as number) - (b[i] as number))));
  const sameTune = len > 0 && diffs.size === 1;
  if (!sameTune)
    return {
      ok: false,
      value: 0,
      target: 1,
      detail: "the two versions do not play the same tune: keep the melody's notes in the same order in both",
    };
  const tempoDelta = num(p, "tempoDelta", 20);
  const bpmA = n.bpm || 0;
  const bpmB = other.n.bpm || 0;
  const tempoApart = Math.abs(bpmA - bpmB) >= tempoDelta - EPS;
  const feelApart = swung(n, ctx.meter) !== swung(other.n, ctx.meter);
  const sa = soundsOf(n);
  const sb = soundsOf(other.n);
  const differ = Math.max([...sa].filter((s) => !sb.has(s)).length, [...sb].filter((s) => !sa.has(s)).length);
  const soundsMin = num(p, "soundsDiffer", 2);
  const faults: string[] = [];
  if (!tempoApart && !feelApart)
    faults.push(
      `the two versions sit ${Math.round(Math.abs(bpmA - bpmB))} BPM apart and share one feel: move the tempo by ${tempoDelta} BPM or more, or swing one and keep the other straight`,
    );
  if (differ < soundsMin)
    faults.push(
      `${differ === 1 ? "only 1 sound differs between the versions" : `${differ} sounds differ between the versions`}; at least ${soundsMin}`,
    );
  return faults.length === 0
    ? {
        ok: true,
        value: 1,
        target: 1,
        detail: `the same tune, ${tempoApart ? `${Math.round(Math.abs(bpmA - bpmB))} BPM apart` : "one swung and one straight"}, with ${plural(differ, "sound")} of its own`,
      }
    : { ok: false, value: 0.5, target: 1, detail: faults.join("; ") };
};
/** `same-tune-two-ways` (A2.L06): sections `a` and `b` play the same tune and differ on `minAxes` axes. */
const sameTuneTwoWays: CorrectionRule = (n, ctx, p) => {
  const melRef = str(p, "melody", "@melody");
  const isSection = (x: unknown) =>
    x === "last" || (typeof x === "object" && x !== null && ("section" in x || "bars" in x));
  if (!isSection(p.a) || !isSection(p.b))
    return { ok: false, detail: "the rule needs the sections `a` and `b`" };
  const sa = scopeToSection(p.a as never, n, ctx);
  const sb = scopeToSection(p.b as never, n, ctx);
  if ("error" in sa) return sa.error;
  if ("error" in sb) return sb.error;
  const v = compareIdioms(sa.n, sb.n, { meter: ctx.meter, melody: melRef });
  const minAxes = num(p, "minAxes", 2);
  if (!v.sameTune)
    return {
      ok: false,
      value: 0,
      target: 1,
      detail:
        "the two sections do not play the same tune: keep the melody's rhythm and its steps from note to note in both",
    };
  return v.axes.length >= minAxes
    ? { ok: true, value: 1, target: 1, detail: `the same tune; the sections differ in ${v.axes.join(", ")}` }
    : {
        ok: false,
        value: v.axes.length / Math.max(1, minAxes),
        target: 1,
        detail: `the same tune, and the sections differ in ${v.axes.length ? v.axes.join(", ") : "nothing yet"}; at least ${minAxes} of sounds, density, groove and register`,
      };
};

// --- rhythm -------------------------------------------------------------------------------------------------------

/**
 * `microtiming` (R1.L05, AC2): the median offset of a line's onsets from the grid (the 16th before it, or the
 * `against` line's onsets) is a FEEL: between `minMs` and `maxMs` at the piece's tempo, in the direction asked.
 */
const microtiming: CorrectionRule = (n, ctx, p) => {
  const ref = str(p, "track", "");
  if (!ref) return { ok: false, detail: "the rule needs `track`" };
  const events = selectTrack(n, ref);
  if (events.length === 0) return nothing(ref);
  const late = str(p, "direction", "late") === "late";
  const minMs = num(p, "minMs", 8);
  const maxMs = num(p, "maxMs", 45);
  const m = METERS[ctx.meter];
  const bpm = n.bpm || n.cps * 60 * m.unitsPerBar || 120;
  const against = typeof p.against === "string" ? selectTrack(n, p.against as string).map(at) : null;
  const step = 1 / (m.unitsPerBar * 4);
  // A lean is against the band, not the clock (review:robustness): when every other part is late by the same few
  // milliseconds (the whole piece `.late(.006)`), nothing leans. The band's time is the median offset of the other
  // parts' notes near a beat (within a 32nd), read from the beat grid; swung off-beats never sit there.
  const beat = 1 / m.unitsPerBar;
  const mine = new Set(events);
  const near = n.all
    .filter((e) => !mine.has(e))
    .map((e) => at(e) - Math.round(at(e) / beat) * beat)
    .filter((off) => Math.abs(off) < step / 2 - 1e-9)
    .sort((a, b) => a - b);
  const band = against ? 0 : (near[Math.floor(near.length / 2)] ?? 0);
  const offsets = [...new Set(events.map(at))].map((x) => {
    if (against && against.length > 0) {
      const ref2 = against.reduce((best, y) => (Math.abs(y - x) < Math.abs(best - x) ? y : best));
      return x - ref2;
    }
    // Signed offset from the nearest 16th; exactly half way counts in the direction asked (`.late(1/32)` is late).
    const off = x - Math.round(x / step) * step;
    return (Math.abs(Math.abs(off) - step / 2) < 1e-6 ? (late ? step / 2 : -step / 2) : off) - band;
  });
  const sorted = [...offsets].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const ms = lateMs(med, bpm, ctx.meter);
  const signed = late ? ms : -ms;
  const where = late ? "behind" : "ahead of";
  if (signed >= minMs - EPS && signed <= maxMs + EPS)
    return {
      ok: true,
      value: 1,
      target: 1,
      detail: `${trackWord(ref)} sits ${Math.round(Math.abs(ms))} ms ${where} the beat: a feel`,
    };
  return {
    ok: false,
    value: 0,
    target: 1,
    detail:
      Math.abs(ms) < 0.5
        ? `${trackWord(ref)} sits ${Math.abs(band) > 1e-9 ? "with the rest of the band, which moves with it" : "right on the grid"}: lean it ${where} the beat by ${minMs}–${maxMs} ms`
        : signed > maxMs
          ? `${trackWord(ref)} sits ${Math.round(Math.abs(ms))} ms ${where} the beat at ${Math.round(bpm)} BPM: that is a displacement you hear as a new rhythm, not a feel (${minMs}–${maxMs} ms)`
          : signed < 0
            ? `${trackWord(ref)} leans the other way (${Math.round(Math.abs(ms))} ms ${late ? "ahead of" : "behind"} the beat); the brief asks for ${where}`
            : `${trackWord(ref)} sits ${Math.round(Math.abs(ms))} ms ${where} the beat; a feel is ${minMs}–${maxMs} ms`,
  };
};

/** Events of a line in [from, from + 1) as (position in the window, what plays). */
function windowShape(events: readonly NEvent[], from: number, len = 1, rhythmOnly = false): string[] {
  return events
    .filter((e) => at(e) >= from - EPS && at(e) < from + len - EPS)
    .map(
      (e) => `${(at(e) - from).toFixed(5)}:${rhythmOnly && e.midi !== null ? "p" : (e.midi ?? e.s ?? "x")}`,
    )
    .sort();
}
/**
 * `displaced-copy` (R1.L05): a figure comes back moved to another place in the bar: every onset shifted by the same
 * amount (a 16th or more, not a whole bar), the same pitches or drums in the same rhythm, while the bar where the
 * copy starts does not already hold the figure unmoved. A whole line moved late has no original to be a copy of.
 */
const displacedCopy: CorrectionRule = (n, ctx, p) => {
  const refs =
    typeof p.track === "string"
      ? [p.track as string]
      : Object.keys(n.byTrack).filter((t) => !t.startsWith("band."));
  const allowed = ratsP(p, "by")?.map((x) => R.toNum(R.frac(x)));
  const min = num(p, "min", 1);
  const bars = barsOf(n, ctx);
  const found: { track: string; from: number; to: number; by: number }[] = [];
  // Displacement is a rhythm moved: the same pitches first, then (W7 gate, review:teaching-rest) the same rhythm
  // over another chord (R3.L05's `.late("<0 0 .125 .125>")` on a comping line that changes chord with the bars).
  for (const rhythmOnly of [false, true]) {
    for (const ref of refs) {
      const events = selectTrack(n, ref);
      for (let i = 0; i < bars; i++) {
        const fig = windowShape(events, i, 1, rhythmOnly);
        if (fig.length < 2) continue;
        for (let j = 0; j < bars; j++) {
          if (j === i) continue;
          if (windowShape(events, j, 1, rhythmOnly).join() === fig.join()) continue;
          for (let k = 1; k < 16; k++) {
            const d = k / 16;
            if (allowed && !allowed.some((x) => Math.abs(x - d) < EPS)) continue;
            // A copy that runs past the piece's end is compared up to the end (the loop comes round after it).
            const len = Math.min(1, bars - j - d);
            const head = windowShape(events, i, len, rhythmOnly);
            if (head.length < 2) continue;
            if (windowShape(events, j + d, len, rhythmOnly).join() === head.join()) {
              found.push({ track: ref, from: i + 1, to: j + 1, by: d });
              break;
            }
          }
          if (found.length >= min) break;
        }
        if (found.length >= min) break;
      }
      if (found.length >= min) break;
    }
    if (found.length >= min) break;
  }
  const f = found[0];
  const sixteenths = (d: number) => {
    const k = Math.round(d * 16);
    return k % 4 === 0 ? plural(k / 4, "beat") : k % 2 === 0 ? plural(k / 2, "eighth") : plural(k, "16th");
  };
  return found.length >= min && f
    ? {
        ok: true,
        value: found.length,
        target: min,
        detail: `bar ${f.from}'s figure comes back in bar ${f.to}, ${sixteenths(f.by)} later`,
      }
    : {
        ok: false,
        value: found.length,
        target: min,
        detail:
          "no figure comes back moved: play the figure once where it starts, then again with every note shifted by the same amount inside the bar",
      };
};

/**
 * `metric-weight` (R1.L01): the line's accents follow the metric hierarchy (`metricWeights`): the louder a place
 * is, the stronger it is in the bar (downbeat, then beat 3, then 2 and 4, then off-beats, then 16ths).
 */
const metricWeight: CorrectionRule = (n, ctx, p) => {
  const ref = str(p, "track", "");
  if (!ref) return { ok: false, detail: "the rule needs `track`" };
  const events = selectTrack(n, ref);
  if (events.length === 0) return nothing(ref);
  const weights = metricWeights(ctx.meter, 16);
  const steps = weights.length;
  const bars = barsOf(n, ctx);
  let good = 0;
  let judged = 0;
  let firstBad: number | null = null;
  for (let b = 0; b < bars; b++) {
    const byLevel = new Map<number, number[]>();
    for (const e of events) {
      if (Math.floor(at(e) + EPS) !== b) continue;
      const k = (at(e) - b) * steps;
      if (Math.abs(k - Math.round(k)) > 0.05) continue;
      const w = weights[Math.round(k) % steps] as number;
      byLevel.set(w, [...(byLevel.get(w) ?? []), e.gain]);
    }
    // A bar played at one level throughout has no accents to judge.
    if (byLevel.size < 2 || new Set([...byLevel.values()].flat().map((g) => Math.round(g * 1000))).size < 2)
      continue;
    judged++;
    const levels = [...byLevel.entries()]
      .map(([w, g]) => ({ w, g: g.reduce((a, c) => a + c, 0) / g.length }))
      .sort((x, y) => y.w - x.w);
    const monotone = levels.every((l, i) => i === 0 || l.g <= (levels[i - 1] as { g: number }).g + EPS);
    const top = levels[0] as { g: number };
    const bottom = levels[levels.length - 1] as { g: number };
    if (monotone && top.g > bottom.g + EPS) good++;
    else firstBad ??= b + 1;
  }
  const min = num(p, "minRatio", 0.75);
  const ratio = judged ? good / judged : 0;
  return ratio >= min - EPS && judged > 0
    ? {
        ok: true,
        value: ratio,
        target: min,
        detail: `the accents follow the beat's strong places in ${pct(ratio)} of the bars`,
      }
    : {
        ok: false,
        value: ratio,
        target: min,
        detail:
          judged === 0
            ? `${trackWord(ref)} plays every place at one level: the strong places of the bar need to be louder`
            : `the accents follow the strong places in ${pct(ratio)} of the bars; at least ${pct(min)}${firstBad ? ` (in bar ${firstBad} a weaker place is as loud as a stronger one, or louder)` : ""}`,
        ...(firstBad ? { where: { bar: firstBad } } : {}),
      };
};

/**
 * `grouping-accents` (R2.L01–L02): the accents (a kick or snare, a hit at 0.9 of the line's loudest, a bass note)
 * fall on every group start of `groups` and nowhere else on the bar's grid, in `minRatio` of the bars.
 */
const groupingAccents: CorrectionRule = (n, ctx, p) => {
  const groups = (strs(p, "groups") ?? []).map(Number).filter((x) => Number.isInteger(x) && x > 0);
  if (groups.length === 0) return { ok: false, detail: "the rule needs `groups`" };
  const ref = str(p, "track", "@drums");
  if (selectTrack(n, ref).length === 0) return nothing(ref);
  const v = groupingView(n, { meter: ctx.meter, bars: barsOf(n, ctx), track: ref, groups });
  if (!("onStarts" in v)) return { ok: false, detail: v.notBuilt };
  // W5 owner item 3: the linear groove may accent other eighths as well as every group start.
  const starts = groups.map((_, i) => groups.slice(0, i).reduce((a, b) => a + b, 0));
  const onStarts =
    p.allowOthers === true
      ? v.accents.map((accents) => (starts.every((at) => accents.includes(at)) ? 1 : 0))
      : v.onStarts;
  const ratio = onStarts.length ? onStarts.reduce((a, b) => a + b, 0) / onStarts.length : 0;
  const min = num(p, "minRatio", 1);
  const badBar = onStarts.indexOf(0);
  const g = groups.join("+");
  return ratio >= min - EPS
    ? { ok: true, value: ratio, target: min, detail: `the accents mark ${g} in ${pct(ratio)} of the bars` }
    : {
        ok: false,
        value: ratio,
        target: min,
        detail: `the accents mark the groups ${g} in ${pct(ratio)} of the bars; at least ${pct(min)}${
          badBar >= 0
            ? p.allowOthers === true
              ? `. In bar ${badBar + 1} a group starts without an accent`
              : `. In bar ${badBar + 1} an accent ${(v.accents[badBar] ?? []).length === 0 ? "is missing" : "falls inside a group, or a group starts without one"}`
            : ""
        }`,
        ...(badBar >= 0 ? { where: { bar: badBar + 1 } } : {}),
      };
};
/** `regrouped` (R2.L03): some bars accent the six pulses 3+3, others 2+2+2. */
const regrouped: CorrectionRule = (n, ctx, p) => {
  const refs =
    typeof p.track === "string"
      ? [p.track as string]
      : Object.keys(n.byTrack).filter((t) => !t.startsWith("band."));
  for (const ref of refs) {
    const v = hemiolaView(n, { meter: ctx.meter, bars: barsOf(n, ctx), track: ref });
    if (!Array.isArray(v)) continue;
    const three = v.indexOf("3+3");
    const two = v.indexOf("2+2+2");
    if (three >= 0 && two >= 0)
      return {
        ok: true,
        value: 1,
        target: 1,
        detail: `bar ${three + 1} groups the six pulses 3+3, bar ${two + 1} 2+2+2`,
      };
  }
  return {
    ok: false,
    value: 0,
    target: 1,
    detail:
      "the six pulses are grouped one way only: let some bars fall in two groups of three, others in three groups of two",
  };
};
/** `polymeter-cycle` (R2.L05): `a` repeats a cycle that crosses the bar line and lines up after `periodBars`; `b` keeps the bar. */
const polymeterCycle: CorrectionRule = (n, ctx, p) => {
  const a = str(p, "a", "");
  const b = str(p, "b", "");
  if (!a || !b) return { ok: false, detail: "the rule needs `a` and `b`" };
  if (selectTrack(n, a).length === 0) return nothing(a);
  if (selectTrack(n, b).length === 0) return nothing(b);
  const bars = barsOf(n, ctx);
  const v = polymeterView(n, { meter: ctx.meter, bars, a });
  if (!("periodBars" in v)) return { ok: false, detail: v.notBuilt };
  const want = typeof p.periodBars === "number" ? (p.periodBars as number) : null;
  const pb = barPeriodOf(n, b, bars);
  // A cycle that is a whole number of bars (`<bd ~>`, `{bd ~ ~ ~ ~ ~ ~ ~}%4`: two bars) never crosses the bar line
  // (build-author-R2c): the cycle must not fit a whole number of bars.
  if (v.periodBars < 2 || v.cycleSteps % 48 === 0)
    return {
      ok: false,
      value: 0,
      target: 1,
      detail:
        v.cycleSteps === 0
          ? `${trackWord(a)} does not come round again within ${bars} bars`
          : v.cycleSteps % 48 === 0 && v.cycleSteps > 48
            ? `${trackWord(a)}'s cycle lasts ${v.cycleSteps / 48} whole bars: it starts on the bar line every time`
            : `${trackWord(a)}'s cycle fits the bar: it never crosses the bar line`,
    };
  if (want !== null && v.periodBars !== want)
    return {
      ok: false,
      value: 0.5,
      target: 1,
      detail: `${trackWord(a)} lines up with the bar again after ${v.periodBars} bars; the brief asks for ${want}`,
    };
  if (pb !== 1)
    return {
      ok: false,
      value: 0.5,
      target: 1,
      detail: `${trackWord(b)} does not keep the bar: it should repeat every bar under the cycle`,
    };
  return {
    ok: true,
    value: 1,
    target: 1,
    detail: `${trackWord(a)} crosses the bar line and lines up again after ${v.periodBars} bars, over ${trackWord(b)} keeping the bar`,
  };
};
/**
 * `clave-aligned` (R3.L02, R3.L04, RC2): a two-bar part faces the clave: in every two-bar window its two bars
 * differ, it meets at least `min` clave strokes, and it meets more of them than it would with the clave reversed.
 */
const claveAligned: CorrectionRule = (n, ctx, p) => {
  const ref = str(p, "track", "");
  if (!ref) return { ok: false, detail: "the rule needs `track`" };
  const claveRef = str(p, "clave", "perc");
  if (selectTrack(n, ref).length === 0) return nothing(ref);
  const cv = claveView(n, { meter: ctx.meter, bars: barsOf(n, ctx), track: claveRef });
  if (!cv.first)
    return {
      ok: false,
      value: 0,
      target: 1,
      detail: `${trackWord(claveRef)} plays no son or rumba clave over two bars, so there is nothing to face`,
    };
  const v = claveAlignmentView(n, { meter: ctx.meter, bars: barsOf(n, ctx), track: ref, clave: claveRef });
  if (!Array.isArray(v)) return { ok: false, detail: v.notBuilt };
  const min = num(p, "min", 2);
  const windows = v.filter((w) => w.shared + w.crossed > 0 || w.barsDiffer);
  const bad = windows.find((w) => !w.barsDiffer || w.shared < min || w.shared <= w.crossed);
  if (windows.length === 0) return nothing(ref);
  if (!bad)
    return {
      ok: true,
      value: 1,
      target: 1,
      detail: `${trackWord(ref)} faces the ${cv.first.type} clave ${cv.first.direction}: it meets its strokes in every two-bar window`,
    };
  return {
    ok: false,
    value:
      (windows.length -
        windows.filter((w) => !w.barsDiffer || w.shared < min || w.shared <= w.crossed).length) /
      windows.length,
    target: 1,
    detail: !bad.barsDiffer
      ? `bars ${bad.bar}–${bad.bar + 1}: ${trackWord(ref)} plays the same rhythm in both bars, so it cannot face the clave's two sides`
      : bad.shared < min
        ? `bars ${bad.bar}–${bad.bar + 1}: ${trackWord(ref)} meets ${plural(bad.shared, "clave stroke")}; at least ${min}`
        : `bars ${bad.bar}–${bad.bar + 1}: ${trackWord(ref)} meets more strokes with the clave turned round (${bad.crossed} against ${bad.shared}): it is crossed`,
    where: { bar: bad.bar },
  };
};
/** `stabs` (RC1): a track of short attacks, at least `min` in every `perBars` bars, each no longer than `maxDur`. */
const stabs: CorrectionRule = (n, ctx, p) => {
  const ref = str(p, "track", "horns");
  const events = selectTrack(n, ref);
  if (events.length === 0) return nothing(ref);
  const maxDur = R.toNum(ratP(p, "maxDur") ?? rat(1, 8));
  const min = num(p, "min", 2);
  const per = Math.max(1, num(p, "perBars", 2));
  const long = events.find((e) => R.toNum(e.clipDur ?? e.dur) > maxDur + EPS);
  if (long)
    return {
      ok: false,
      value: 0.5,
      target: 1,
      detail: `${placeText(long.onset, ctx)}: ${trackWord(ref)} holds a note; a stab is short (an eighth or less) and gets out of the way`,
      where: { bar: R.floor(long.onset) + 1 },
    };
  // Every window of the piece as queried, silent bars included: a stab in bar 1 of four bars is not "every 2 bars".
  const bars = Math.max(ctx.bars ?? 0, barsOf(n, ctx));
  for (let b = 0; b + per <= bars; b += per) {
    const k = new Set(
      events.filter((e) => at(e) >= b - EPS && at(e) < b + per - EPS).map((e) => R.str(e.onset)),
    ).size;
    if (k < min)
      return {
        ok: false,
        value: 0.5,
        target: 1,
        detail: `bars ${b + 1}–${b + per}: ${plural(k, "stab")}; at least ${min} every ${plural(per, "bar")}`,
        where: { bar: b + 1 },
      };
  }
  return {
    ok: true,
    value: 1,
    target: 1,
    detail: `${trackWord(ref)} plays short stabs, ${min} or more every ${plural(per, "bar")}`,
  };
};
/**
 * `interlock` (R1.L04; requested by the R1 spec): parts that interlock like gears: on the 16th grid of a bar, at
 * most `maxShared` of the played places (beat 1 left out) are played by two or more parts, each part has at least
 * `minOwn` places of its own per bar, and together they cover at least `minCover` of the 16 places.
 */
const interlock: CorrectionRule = (n, ctx, p) => {
  const refs = strs(p, "tracks") ?? ["@bass", "keys", "gtr"];
  for (const r of refs) if (selectTrack(n, r).length === 0) return nothing(r);
  const v = interlockView(n, { meter: ctx.meter, bars: barsOf(n, ctx), tracks: refs });
  if (!("grid" in v)) return { ok: false, detail: v.notBuilt };
  const maxShared = num(p, "maxShared", 0.25);
  const minOwn = num(p, "minOwn", 2);
  const minCover = num(p, "minCover", 8);
  const thin = refs.find((r) => (v.own[r] ?? 0) < minOwn);
  const faults: string[] = [];
  if (v.shared > maxShared + EPS)
    faults.push(
      `${pct(v.shared)} of the places are played by two parts or more; at most ${pct(maxShared)}: the parts double each other instead of filling each other's gaps`,
    );
  if (thin)
    faults.push(`${trackWord(thin)} has ${v.own[thin] ?? 0} places of its own in a bar; at least ${minOwn}`);
  if (v.cover < minCover)
    faults.push(`together the parts play ${v.cover} of the 16 places; at least ${minCover}`);
  return faults.length === 0
    ? {
        ok: true,
        value: 1,
        target: 1,
        detail: `the parts interlock: ${pct(v.interlock)} of the places belong to one part, ${v.cover} of 16 covered`,
      }
    : { ok: false, value: 0.5, target: 1, detail: faults.join("; ") };
};

// --- sound and arrangement ---------------------------------------------------------------------------------------

/** `counter-melody` (A2.L03): a second line with its own motion, never doubling the tune for more than two beats. */
const counterMelody: CorrectionRule = (n, ctx, p) => {
  const melRef = str(p, "melody", "mel");
  const ctrRef = str(p, "counter", "vox");
  if (pitched(selectTrack(n, melRef)).length === 0) return nothing(melRef);
  if (pitched(selectTrack(n, ctrRef)).length === 0) return nothing(ctrRef);
  const v = counterMelodyView(n, { meter: ctx.meter, bars: barsOf(n, ctx), melody: melRef, counter: ctrRef });
  if (!("independence" in v)) return { ok: false, detail: v.notBuilt };
  const min = num(p, "minIndependence", 0.5);
  if (v.doubledBeats > 2)
    return {
      ok: false,
      value: 0.5,
      target: 1,
      detail: `${trackWord(ctrRef)} doubles the tune for ${plural(v.doubledBeats, "beat")} in a row: a counter-melody goes its own way`,
    };
  return v.independence >= min - EPS
    ? {
        ok: true,
        value: v.independence,
        target: min,
        detail: `${trackWord(ctrRef)} moves on its own at ${pct(v.independence)} of the moves (against the tune, or while it holds)`,
      }
    : {
        ok: false,
        value: v.independence,
        target: min,
        detail: `${trackWord(ctrRef)} moves with the tune most of the time: on its own at ${pct(v.independence)} of the moves; at least ${pct(min)}. Let it move when the tune holds, or the other way`,
      };
};
/** `slices-reordered` (A2.L04): a sample cut into `minSlices` slices that play in an order other than the sample's own. */
const slicesReordered: CorrectionRule = (n, ctx, p) => {
  const ref = typeof p.track === "string" ? (p.track as string) : undefined;
  const v = sampleChopView(n, { meter: ctx.meter, bars: barsOf(n, ctx), ...(ref ? { track: ref } : {}) });
  if (!("slices" in v)) return { ok: false, detail: v.notBuilt };
  const min = num(p, "minSlices", 4);
  if (v.slices < min)
    return {
      ok: false,
      value: v.slices / Math.max(1, min),
      target: 1,
      detail:
        v.slices === 0
          ? "no sample is cut into slices yet"
          : `the sample is cut into ${plural(v.slices, "slice")}; at least ${min}`,
    };
  return v.reordered
    ? { ok: true, value: 1, target: 1, detail: `${v.slices} slices, played in a new order` }
    : {
        ok: false,
        value: 0.5,
        target: 1,
        detail: `${v.slices} slices, but they play in the sample's own order: you hear the break as it was`,
      };
};
/** `level-balance` (A2.L05): `quieter` sits between `minDb` and `maxDb` under `louder` where they sound together. */
const levelBalance: CorrectionRule = (n, _ctx, p) => {
  const hi = str(p, "louder", "");
  const lo = str(p, "quieter", "");
  if (!hi || !lo) return { ok: false, detail: "the rule needs `louder` and `quieter`" };
  const H = selectTrack(n, hi);
  const L = selectTrack(n, lo);
  if (H.length === 0) return nothing(hi);
  if (L.length === 0)
    return {
      ok: false,
      value: 0,
      target: 1,
      detail: `${trackWord(lo)} is not heard: more than 24 dB under the loudest part, it is masked`,
    };
  const ratios: number[] = [];
  for (const e of L) {
    const over = H.filter((h) => at(h) <= at(e) + EPS && at(e) < at(h) + R.toNum(h.clipDur ?? h.dur) - EPS);
    if (over.length > 0) ratios.push(e.gain / Math.max(...over.map((h) => h.gain)));
  }
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const r =
    ratios.length > 0 ? med(ratios) : med(L.map((e) => e.gain)) / Math.max(EPS, med(H.map((e) => e.gain)));
  const under = -20 * Math.log10(Math.max(r, 1e-6));
  const minDb = num(p, "minDb", 3);
  const maxDb = num(p, "maxDb", 18);
  const dB = Math.round(under);
  return under >= minDb - EPS && under <= maxDb + EPS
    ? { ok: true, value: 1, target: 1, detail: `${trackWord(lo)} sits ${dB} dB under ${trackWord(hi)}` }
    : {
        ok: false,
        value: 0.5,
        target: 1,
        detail:
          under < minDb
            ? `${trackWord(lo)} is ${under <= 0 ? "as loud as or louder than" : `only ${dB} dB under`} ${trackWord(hi)}; it should sit ${minDb}–${maxDb} dB under`
            : `${trackWord(lo)} sits ${dB} dB under ${trackWord(hi)}: too far down to carry (${minDb}–${maxDb} dB)`,
      };
};

// --- the table --------------------------------------------------------------------------------------------------

/** The Wave 7 custom rules by name, each wrapped with `alsoUses` (merged into `CUSTOM_RULES`). */
export function wave7CustomRules(deps: CorrectionDeps): Record<string, CorrectionRule> {
  const table: Record<string, CorrectionRule> = {
    "walking-bass": walkingBass,
    "allowed-tensions": allowedTensions,
    "ii-v-chain": iiVChain,
    "voicing-shape": voicingShape,
    "song-melody-kept": songMelodyKept,
    contrafact,
    "two-versions-differ": twoVersionsDiffer,
    "same-tune-two-ways": sameTuneTwoWays,
    "extended-share": extendedShare,
    microtiming,
    "displaced-copy": displacedCopy,
    "metric-weight": metricWeight,
    "grouping-accents": groupingAccents,
    regrouped,
    "polymeter-cycle": polymeterCycle,
    "clave-aligned": claveAligned,
    stabs,
    "chord-scale-fit": chordScaleFit,
    "tensions-used": tensionsUsed,
    "counter-melody": counterMelody,
    "slices-reordered": slicesReordered,
    "level-balance": levelBalance,
    interlock,
  };
  return Object.fromEntries(Object.entries(table).map(([k, r]) => [k, withAlsoUses(r, deps)]));
}
export const WAVE7_BUILT_CUSTOM = [
  "walking-bass",
  "allowed-tensions",
  "ii-v-chain",
  "voicing-shape",
  "song-melody-kept",
  "contrafact",
  "two-versions-differ",
  "same-tune-two-ways",
  "extended-share",
  "microtiming",
  "displaced-copy",
  "metric-weight",
  "grouping-accents",
  "regrouped",
  "polymeter-cycle",
  "clave-aligned",
  "stabs",
  "chord-scale-fit",
  "tensions-used",
  "counter-melody",
  "slices-reordered",
  "level-balance",
  "interlock",
] as const;
