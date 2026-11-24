// A small headless Strudel evaluator for TESTS in any package (`@oak/grader/testing`): evaluate a code
// string, get sorted onset events back. It is the pattern of tests/smoke/strudel-import.test.ts with the
// gotchas of spike S1 fixed. It is not the production realm (no lint, no fuel, no lockdown): production
// code calls `evaluateForGrading` or a `GraderHost`.
//
// It imports Strudel and nothing from Oak's other packages, so any package's tests may use it.
import * as core from "@strudel/core";
import * as mini from "@strudel/mini";
import * as tonal from "@strudel/tonal";
import { transpiler } from "@strudel/transpiler";

export interface HeadlessEvent {
  /** Label, '$0', or 'main'. */
  track: string;
  /** Exact fraction strings in cycles: "0", "1/3". */
  begin: string;
  end: string;
  onset: number;
  /** Integer or fractional MIDI; `null` for drums and for `n` without `.scale()`. */
  midi: number | null;
  note: string | number | null;
  s: string | null;
  /** `hap.context.scale`, e.g. "C4 major". */
  scale: string | null;
  value: Record<string, unknown>;
  locations: { start: number; end: number }[];
}
export interface HeadlessResult {
  cps: number;
  /** Whether the code called setcpm/setcps. */
  cpsSet: boolean;
  tracks: string[];
  /** Sorted by (onset, track order, midi). */
  events: HeadlessEvent[];
  /** Strudel logger lines seen while evaluating and querying: "[tonal] …", "[voicing]: unknown chord …". */
  logs: string[];
}

const state = { cps: 0.5, cpsSet: false };
const unpure = (v: unknown): unknown =>
  v && typeof v === "object" && "_Pattern" in v ? (v as { __pure?: unknown }).__pure : v;
function setTempo(cps: unknown): unknown {
  const n = Number(unpure(cps));
  // setcpm("90") with double quotes is a mini pattern, not a number: Strudel keeps the previous tempo.
  if (Number.isFinite(n) && n > 0) {
    state.cps = n;
    state.cpsSet = true;
  }
  return core.silence;
}
const stubs = {
  setcps: (v: unknown) => setTempo(v),
  setCps: (v: unknown) => setTempo(v),
  setcpm: (v: unknown) => setTempo(Number(unpure(v)) / 60),
  setCpm: (v: unknown) => setTempo(Number(unpure(v)) / 60),
  samples: async () => {},
  hush: () => core.silence,
};

let scope: Promise<unknown> | undefined;
function ready(): Promise<unknown> {
  // evalScope(mini) would overwrite the global SyntaxError with the parser's class: leave it out.
  const { SyntaxError: _peggy, ...miniScope } = mini;
  const loaded: Promise<unknown> = scope ?? core.evalScope(core, miniScope, tonal);
  scope = loaded;
  // Re-apply the tempo stubs on every call: another realm in the same test process may have replaced them.
  return loaded.then(() => {
    installVisualStubs();
    return core.evalScope(stubs);
  });
}

// Draw/editor methods (`.scope()`, `.pianoroll()`…) exist only with @strudel/draw loaded; here they are the identity,
// as in the grader's realm (runtime/realm.ts VISUAL_METHODS). Installed only where core has no method of that name,
// and again on every call, since a realm's restore may have removed them.
const VISUAL_STUBS = [
  "pianoroll",
  "punchcard",
  "spiral",
  "pitchwheel",
  "wordfall",
  "scope",
  "tscope",
  "fscope",
  "spectrum",
  "markcss",
  "draw",
  "onPaint",
  "animate",
];
function installVisualStubs(): void {
  const proto = core.Pattern.prototype as unknown as Record<string, unknown>;
  for (const name of VISUAL_STUBS) {
    for (const key of [name, `_${name}`]) {
      if (typeof proto[key] !== "function") {
        proto[key] = function (this: unknown) {
          return this;
        };
      }
    }
  }
}

function midiOf(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") return core.isNote(value) ? core.noteToMidi(value) : null;
  if (typeof value !== "object" || value === null) return null;
  const v = value as { note?: unknown; freq?: unknown };
  if (typeof v.freq === "number") return core.freqToMidi(v.freq);
  if (typeof v.note === "number") return v.note;
  if (typeof v.note === "string") return core.isNote(v.note) ? core.noteToMidi(v.note) : null;
  return null;
}

/**
 * Evaluates `code` (labels, `$:`, `_muted:` and a tempo line all work as in the editor) and returns the
 * onset events of cycles [0, bars). Throws on a syntax, evaluation or query error.
 */
export function evalHeadless(code: string, bars = 1): Promise<HeadlessResult> {
  // One evaluation at a time: the collector and the tempo stubs are realm-global.
  const run = queue.then(() => evalOne(code, bars));
  queue = run.catch(() => {});
  return run;
}
let queue: Promise<unknown> = Promise.resolve();

async function evalOne(code: string, bars: number): Promise<HeadlessResult> {
  await ready();
  state.cps = 0.5;
  state.cpsSet = false;
  tonal.resetVoicings?.();
  const logs: string[] = [];
  const tracks = new Map<string, Strudel.Pattern>();
  let anon = 0;
  const proto = core.Pattern.prototype as { p?: unknown };
  const previousP = Object.getOwnPropertyDescriptor(proto, "p");
  const log = console.log;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("%c")) logs.push(args[0].slice(2));
    else log(...args);
  };
  try {
    // The collector of repl.mjs 1.2.6: `_x` and `x_` mute; a `$` label gets an index.
    proto.p = function (this: Strudel.Pattern, id: string) {
      if (id.startsWith("_") || id.endsWith("_")) return core.silence;
      const key = id.includes("$") ? `${id}${anon++}` : id;
      tracks.set(key, this);
      return this;
    };
    const { pattern } = (await core.evaluate(code, transpiler)) as { pattern: Strudel.Pattern };
    if (tracks.size === 0) {
      if (!pattern || typeof pattern.query !== "function")
        throw new Error("the code does not return a pattern");
      tracks.set("main", pattern);
    }
    const names = [...tracks.keys()];
    const events: HeadlessEvent[] = [];
    for (const [track, pat] of tracks) {
      for (let c = 0; c < bars; c++) {
        // `query` throws where `queryArc` would log "[query] error" and return nothing.
        const span = new core.TimeSpan(core.Fraction(c), core.Fraction(c + 1));
        for (const hap of pat.query(new core.State(span, { _cps: state.cps }))) {
          if (!hap.whole || !hap.hasOnset()) continue;
          const value = hap.value;
          const obj =
            typeof value === "object" && value !== null ? (value as Record<string, unknown>) : { value };
          events.push({
            track,
            begin: hap.whole.begin.toFraction(),
            end: hap.whole.end.toFraction(),
            onset: hap.whole.begin.valueOf(),
            midi: midiOf(value),
            note: typeof obj.note === "string" || typeof obj.note === "number" ? obj.note : null,
            s: typeof obj.s === "string" ? obj.s : null,
            scale: hap.context.scale ?? null,
            value: { ...obj },
            locations: hap.context.locations ?? [],
          });
        }
      }
    }
    events.sort(
      (a, b) =>
        a.onset - b.onset ||
        names.indexOf(a.track) - names.indexOf(b.track) ||
        (a.midi ?? -1) - (b.midi ?? -1),
    );
    return { cps: state.cps, cpsSet: state.cpsSet, tracks: names, events, logs };
  } finally {
    console.log = log;
    if (previousP) Object.defineProperty(proto, "p", previousP);
    else delete proto.p;
  }
}

/** MIDI numbers of the pitched events, in order: the quickest way to check a theory claim against Strudel. */
export async function midisOf(code: string, bars = 1): Promise<(number | null)[]> {
  return (await evalHeadless(code, bars)).events.map((e) => e.midi);
}
