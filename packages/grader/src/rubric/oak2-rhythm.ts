// Oak 2.0 W0: rhythm and sound checks read the heard events, except the explicit freeze check.
import type { NEvent, Rat } from "@oak/content-kit";
import { parseRat, R, rat } from "@oak/content-kit";
import { METERS } from "@oak/theory";
import { locAt, median, onsets, ratKey, sortEvents } from "../analyze/events.ts";
import { evenCount, grooveLock } from "../analyze/groove.ts";
import { selectTrack } from "../analyze/tracks.ts";
import {
  type AstNode,
  chainOf,
  child,
  memberName,
  parseProgram,
  programInfo,
  stringArgs,
  walk,
} from "../lint/ast.ts";
import { readMini } from "../lint/mini.ts";
import { CONTROL_KEYS, controlValue } from "../match/controls.ts";
import type { Normalized } from "../types.ts";
import type { RubricContext } from "./context.ts";
import {
  type CorrectionDeps,
  type CorrectionEval,
  type CorrectionRule,
  withAlsoUses,
} from "./corrections-rules.ts";

const num = (p: Record<string, unknown>, k: string, d: number): number =>
  typeof p[k] === "number" && Number.isFinite(p[k]) ? (p[k] as number) : d;
const str = (p: Record<string, unknown>, k: string, d: string): string =>
  typeof p[k] === "string" && p[k].length > 0 ? p[k] : d;
const strs = (p: Record<string, unknown>, k: string): string[] =>
  Array.isArray(p[k]) && p[k].every((x) => typeof x === "string") ? p[k] : [];
const nums = (p: Record<string, unknown>, k: string): number[] =>
  Array.isArray(p[k]) && p[k].every((x) => typeof x === "number" && Number.isFinite(x)) ? p[k] : [];
const EPS = 1e-9;
const result = (ok: boolean, detail: string): CorrectionEval => ({ ok, detail });
const missing = (ref: string): CorrectionEval =>
  result(false, `Make ${ref} audible before checking this step`);

function heard(n: Normalized, ref = "*"): NEvent[] {
  const band = new Set(n.band.map((e) => e.id));
  return selectTrack(n, ref).filter(
    (e) => !e.track.startsWith("band.") && !band.has(e.id) && e.gain > 0 && R.lt(rat(0), e.clipDur ?? e.dur),
  );
}

// A pickup occupies cycle zero; only the full bars contribute to per-bar quotas and comparisons.
function fullBars(n: Normalized, ctx: RubricContext, deps: CorrectionDeps): number[] {
  const end = Math.max(0, Math.floor(ctx.bars ?? deps.pieceBars(n, ctx)));
  return Array.from({ length: Math.max(0, end - (ctx.pickup ? 1 : 0)) }, (_, i) => i + (ctx.pickup ? 1 : 0));
}
const inBar = (events: readonly NEvent[], b: number): NEvent[] =>
  events.filter((e) => R.floor(e.onset) === b);
const endOf = (e: NEvent) => R.add(e.onset, e.clipDur ?? e.dur);

const kickBass =
  (deps: CorrectionDeps): CorrectionRule =>
  (n, ctx, p) => {
    const ref = str(p, "bass", "@bass");
    const bass = heard(n, ref);
    if (!bass.length) return missing(ref);
    const kicks = onsets(heard(n), { drum: "kick" });
    if (!kicks.length) return missing("the kick drum");
    let window: Rat;
    try {
      window = parseRat(str(p, "window", "1/32"));
    } catch {
      return result(false, "Choose a valid gap between the kick and bass notes");
    }
    if (R.lt(window, rat(0))) return result(false, "Choose a positive gap between the kick and bass notes");
    if (grooveLock(kicks, onsets(bass), window).lock > 0)
      return result(false, `Move ${ref} notes away from the kick hits so they take turns`);
    if (bass.some((e) => kicks.some((k) => R.lt(e.onset, k) && R.lt(k, endOf(e)))))
      return result(false, `Shorten ${ref} notes so they finish before the next kick`);
    for (let i = 1; i < bass.length; i++) {
      const prev = bass[i - 1] as NEvent;
      const next = bass[i] as NEvent;
      if (R.eq(prev.onset, next.onset) || R.lt(next.onset, endOf(prev)))
        return result(false, `Let each ${ref} note finish before another bass note starts`);
    }
    const bars = fullBars(n, ctx, deps);
    const count = bars.reduce((sum, b) => sum + onsets(inBar(bass, b)).length, 0);
    if (!bars.length || count / bars.length < num(p, "minBassPerBar", 1))
      return result(false, `Add more ${ref} notes between the kicks throughout the piece`);
    return result(true, "The kick and bass take turns as one line");
  };

const hocket =
  (deps: CorrectionDeps): CorrectionRule =>
  (n, ctx, p) => {
    const refs = strs(p, "tracks");
    const pitches = nums(p, "pitches");
    const steps = num(p, "steps", 0);
    if (refs.length !== 2 || ![8, 16].includes(steps) || pitches.length !== steps)
      return result(false, "Choose two parts and a complete line to share between them");
    const parts = refs.map((ref) => heard(n, ref));
    for (let i = 0; i < parts.length; i++) if (!parts[i]?.length) return missing(refs[i] as string);
    const sounds = parts.map((part) => new Set(part.map((e) => controlValue(e, "s", n.cps))));
    if ([...(sounds[0] ?? [])].some((s) => sounds[1]?.has(s)))
      return result(false, `Give ${refs[0]} and ${refs[1]} different sounds`);
    const bars = fullBars(n, ctx, deps);
    if (!bars.length) return result(false, "Play a full bar of the shared line");
    const counts = [0, 0];
    for (const b of bars) {
      const cells: NEvent[][] = Array.from({ length: steps }, () => []);
      for (let i = 0; i < parts.length; i++) {
        for (const e of inBar(parts[i] as NEvent[], b)) {
          const step = R.mul(R.frac(e.onset), rat(steps));
          if (step[1] !== 1 || e.midi === null)
            return result(false, "Place each shared note on its place in the given line");
          cells[step[0]]?.push(e);
          counts[i] = (counts[i] ?? 0) + 1;
        }
      }
      for (let s = 0; s < steps; s++) {
        const cell = cells[s] as NEvent[];
        const want = pitches[s];
        if (cell.length !== (want === -1 ? 0 : 1) || (want !== -1 && cell[0]?.midi !== want))
          return {
            ok: false,
            detail: "Share every note of the given line once and keep its rests empty",
            where: locAt(R.add(rat(b), rat(s, steps)), ctx),
          };
      }
    }
    // Alternating starts alone can hide notes that keep sounding over the other part.
    const merged = sortEvents(parts.flat());
    if (merged.some((e, i) => i > 0 && R.lt(e.onset, endOf(merged[i - 1] as NEvent))))
      return result(false, "Shorten the shared notes so each finishes before the next one starts");
    const total = (counts[0] ?? 0) + (counts[1] ?? 0);
    if (!total || counts.some((c) => c / total < 0.25))
      return result(false, `Give both ${refs[0]} and ${refs[1]} a share of the line`);
    return result(true, "Both sounds share the complete line without doubling its notes");
  };

const steppedControl: CorrectionRule = (n, _ctx, p) => {
  const ref = str(p, "track", "@melody");
  const events = heard(n, ref);
  if (!events.length) return missing(ref);
  const control = str(p, "control", "lpf");
  const key = CONTROL_KEYS[control] ?? control;
  const values: number[] = [];
  let lastOnset = "";
  for (const e of events) {
    const v = controlValue(e, key, n.cps);
    if (typeof v !== "number" || !Number.isFinite(v))
      return result(false, `Set a number for ${control} on ${ref} notes`);
    const onset = ratKey(e.onset);
    if (onset === lastOnset) {
      if (Math.abs(v - (values.at(-1) as number)) > EPS)
        return result(false, `Give notes together on ${ref} the same ${control} value`);
    } else values.push(v);
    lastOnset = onset;
  }
  const runs: { value: number; count: number }[] = [];
  for (const v of values) {
    const last = runs.at(-1);
    if (last && Math.abs(last.value - v) <= EPS) last.count++;
    else runs.push({ value: v, count: 1 });
  }
  const distinct = new Set(runs.map((r) => r.value));
  const range = Math.max(...values) - Math.min(...values);
  if (distinct.size < num(p, "minSteps", 3) || range <= EPS)
    return result(false, `Give ${control} on ${ref} more different held values`);
  if (runs.some((r) => r.count < 2))
    return result(false, `Hold each ${control} value on ${ref} for several notes before changing it`);
  if (runs.some((r, i) => i > 0 && Math.abs(r.value - (runs[i - 1]?.value ?? r.value)) + EPS < range * 0.2))
    return result(false, `Make clearer jumps between the held ${control} values on ${ref}`);
  return result(true, `${control} holds steady on ${ref} then jumps to a new value`);
};

const CHANCE = new Set([
  "degrade",
  "degradeBy",
  "undegradeBy",
  "sometimes",
  "sometimesBy",
  "often",
  "rarely",
  "almostNever",
  "almostAlways",
  "someCycles",
  "someCyclesBy",
  "rand",
  "irand",
  "perlin",
  "choose",
  "chooseCycles",
  "wchoose",
  "shuffle",
  "scramble",
]);

const noChance: CorrectionRule = (n, ctx, p) => {
  const ref = typeof p.track === "string" ? p.track : undefined;
  const parsed = parseProgram(ctx.code);
  if (!parsed.ok) return result(false, "Fix the code so the frozen notes can be checked");
  const info = programInfo(parsed.ast);
  const roots: AstNode[] = ref
    ? info.labels.filter((l) => l.label === ref).flatMap((l) => (l.expr ? [l.expr] : []))
    : [parsed.ast];
  if (!roots.length) return missing(ref ?? "your parts");
  const found = new Set<string>();
  const visited = new Set<AstNode>();
  // Follow consts used by a labelled part so moving its chance source to a variable cannot freeze it.
  const scan = (root: AstNode) => {
    if (visited.has(root)) return;
    visited.add(root);
    for (const link of chainOf(root).links) if (CHANCE.has(link.name)) found.add(link.name);
    for (const s of stringArgs(root)) {
      if (readMini(s.value, s.contentStart).ops.some((op) => op.op === "maybe")) found.add("?");
    }
    walk(root, (node, ancestors) => {
      if (node.type === "MemberExpression") {
        const name = memberName(node);
        if (name && CHANCE.has(name)) found.add(name);
      }
      if (node.type !== "Identifier") return;
      const parent = ancestors.at(-1);
      if (parent?.type === "MemberExpression" && !parent.computed && child(parent, "property") === node)
        return;
      const name = String(node.name);
      if (CHANCE.has(name)) found.add(name);
      const init = info.consts.find((c) => c.name === name)?.init;
      if (init) scan(init);
    });
  };
  for (const root of roots) scan(root);
  if (found.size)
    return result(
      false,
      `Replace ${[...found]
        .sort()
        .map((name) => `\`${name}\``)
        .join(", ")} with fixed notes to freeze this part`,
    );
  if (!heard(n, ref ?? "*").length) return missing(ref ?? "your parts");
  return result(true, "The notes are fixed without chance tools");
};

function material(events: readonly NEvent[]): string {
  return events
    .map((e) => `${ratKey(R.frac(e.onset))}:${e.drum ?? e.midi ?? e.s ?? "sound"}`)
    .sort()
    .join("|");
}

const depthLayers =
  (deps: CorrectionDeps): CorrectionRule =>
  (n, ctx, p) => {
    const front = str(p, "front", "@melody");
    const back = strs(p, "back");
    if (!back.length) return result(false, "Choose the background parts behind the lead");
    const refs = [front, ...back];
    const parts = refs.map((ref) => heard(n, ref));
    for (let i = 0; i < parts.length; i++) if (!parts[i]?.length) return missing(refs[i] as string);
    const bars = fullBars(n, ctx, deps);
    if (!bars.length) return result(false, "Play full bars so the lead and background can be compared");
    const views = parts.map((events) => {
      const rows = bars.map((b) => inBar(events, b));
      const patterns = rows.map(material);
      const freq = new Map<string, number>();
      for (const pattern of patterns) freq.set(pattern, (freq.get(pattern) ?? 0) + 1);
      return { rows, distinct: freq.size, repeat: Math.max(...freq.values()) / bars.length };
    });
    for (let i = 1; i < views.length; i++) {
      if ((views[i]?.repeat ?? 0) < 0.75)
        return result(false, `Keep ${refs[i]} mostly repeating so it stays behind the lead`);
      if ((views[0]?.distinct ?? 0) <= (views[i]?.distinct ?? 0))
        return result(false, `Vary ${front} more than ${refs[i]} so the lead stays in front`);
    }
    const stepsForward = views.slice(1).some(({ rows }) => {
      const gains = rows.map((row) => row.reduce((sum, e) => sum + e.gain, 0));
      const counts = rows.map((row) => onsets(row).length);
      const typicalGain = median(gains);
      const typicalCount = median(counts);
      const raised = rows.map(
        (_, i) =>
          ((gains[i] as number) > typicalGain + EPS &&
            (gains[i] as number) + EPS >= typicalGain * 10 ** (3 / 20)) ||
          ((counts[i] as number) > typicalCount && (counts[i] as number) >= typicalCount * 1.5),
      );
      const count = raised.filter(Boolean).length;
      // A brief foreground visit must not become a second, frequently changing lead.
      return (
        count >= 1 &&
        count / bars.length <= 1 / 8 &&
        raised.every((_, i) => raised.slice(i, i + 8).filter(Boolean).length <= 1)
      );
    });
    return stepsForward
      ? result(true, "The background repeats behind a changing lead and briefly steps forward")
      : result(
          false,
          "Let one background part become louder or busier for an occasional bar then settle back",
        );
  };

const linearDrums =
  (deps: CorrectionDeps): CorrectionRule =>
  (n, ctx, p) => {
    const events = heard(n).filter((e) => e.drum !== undefined);
    if (!events.length) return missing("the drums");
    if (onsets(events).length !== events.length)
      return result(false, "Let only one drum hit at a time including the first beat");
    const bars = fullBars(n, ctx, deps);
    const rows = bars.map((b) => inBar(events, b));
    if (
      !bars.length ||
      rows.reduce((sum, row) => sum + row.length, 0) / bars.length < num(p, "minHitsPerBar", 6)
    )
      return result(false, "Add more drum hits that take turns across the bar");
    for (const row of rows) {
      for (const role of new Set(row.map((e) => e.drum))) {
        const count = evenCount(onsets(row.filter((e) => e.drum === role)));
        if (count !== null && count >= 2)
          return result(false, "Break up the evenly spaced hits so no drum keeps time through the whole bar");
      }
    }
    const group = nums(p, "group");
    if (p.group !== undefined) {
      const meter = METERS[ctx.meter];
      const eighths = (meter.num * 8) / meter.den;
      if (
        !group.length ||
        group.some((g) => !Number.isInteger(g) || g <= 0) ||
        group.reduce((a, b) => a + b, 0) !== eighths
      )
        return result(false, "Choose groups that fill the bar in this meter");
      let start = 0;
      const starts = group.map((g) => {
        const at = rat(start, eighths);
        start += g;
        return at;
      });
      const matches = rows.filter((row, i) => {
        const peak = Math.max(...row.map((e) => e.gain));
        const low = Math.min(...row.map((e) => e.gain));
        return starts.every((at) => {
          const index = row.findIndex((e) => R.eq(R.frac(e.onset), at));
          const hit = row[index];
          if (!hit) return false;
          // At the first beat compare with the preceding bar, or the loop's tail at the start of the piece.
          const prev = row[index - 1] ?? rows[(i + rows.length - 1) % rows.length]?.at(-1);
          return (
            (prev !== undefined && prev.drum !== hit.drum) || (peak > low + EPS && hit.gain >= peak - EPS)
          );
        });
      }).length;
      if (matches / bars.length < 0.75)
        return result(false, "Mark each group start with a change of drum or a louder hit in most bars");
    }
    return result(true, "The drums take turns without a fixed timekeeping part");
  };

export function oak2RhythmRules(deps: CorrectionDeps): Record<string, CorrectionRule> {
  const rules: Record<string, CorrectionRule> = {
    "kick-bass-composite": kickBass(deps),
    hocket: hocket(deps),
    "stepped-control": steppedControl,
    "no-chance": noChance,
    "depth-layers": depthLayers(deps),
    "linear-drums": linearDrums(deps),
  };
  return Object.fromEntries(Object.entries(rules).map(([name, rule]) => [name, withAlsoUses(rule, deps)]));
}
