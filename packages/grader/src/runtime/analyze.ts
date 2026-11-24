// `evaluateForGrading`: lint → evaluate → query → events, with the caps of the grading mode
// (contracts §6.4). Never throws for a problem in the code: lint errors, syntax errors, query errors,
// too much work and silence come back as `{ ok: false }` or as diagnostics. State is reset before every
// request and the realm is healed after it.
import type { Diagnostic, LintContext, LintDiagnostic, LintResult, MeterId } from "@oak/content-kit";
import {
  buildSong,
  finishSong,
  type SongBandWire,
  type SongCheck,
  type SongEvaluator,
  songBandFromWire,
  songLintContext,
} from "@oak/strudel/song-compose";
import { bpmToCps, cpsToBpm } from "@oak/theory";
import { arrangedTotal, sectionsFromAst } from "../lint/ast.ts";
import { checkChord, splitChord } from "../lint/chords.ts";
import { lintOak } from "../lint/oak.ts";
import { sortOakEvents } from "../normalize/hap.ts";
import {
  defaultFuel,
  type EvalOptions,
  type EvalResult,
  type LogLine,
  MODE_LIMITS,
  type OakEvent,
} from "../types.ts";
import { captureInto } from "./console.ts";
import { errorMessage, GraderError } from "./errors.ts";
import { type Evaluated, evaluateCode, periodOfEvents, type QuerySource, queryCycles } from "./evaluate.ts";
import { FUEL, startFuel, stopFuel } from "./fuel.ts";
import { DEFAULT_CPS, ensureRealm, R, restoreRealm, TRACK_KEY } from "./realm.ts";
import { core, type Hap, type Pat, tonal } from "./strudel.ts";

/** One request at a time per realm: the collector, the tempo and the fuel meter are realm-global. */
let queue: Promise<unknown> = Promise.resolve();

export function evaluateForGrading(code: string, opts: EvalOptions): Promise<EvalResult> {
  const run = queue.then(() => evaluateOnce(code, opts));
  queue = run.catch(() => {});
  return run;
}

function resetRequestState(): void {
  R.cps = DEFAULT_CPS;
  R.cpsSet = false;
  R.tempoProblems = [];
  tonal.resetVoicings?.(); // voicing() keeps a module-global last voicing and default dictionary
  core.useRNG?.("legacy");
  core.reset_state?.();
}

function lintToDiagnostic(d: LintDiagnostic): Diagnostic {
  return { id: d.id, severity: d.severity, where: { code: [d.range] }, params: d.params };
}

function failure(error: GraderError, logs: LogLine[], lint: LintResult | null, t0: number): EvalResult {
  return { ok: false, error: error.info(), logs, lint, ms: performance.now() - t0 };
}

async function evaluateOnce(code: string, opts: EvalOptions): Promise<EvalResult> {
  const t0 = performance.now();
  await ensureRealm();
  const limits = MODE_LIMITS[opts.mode];
  const hapCap = Math.max(1, Math.floor(opts.hapCap ?? limits.hapCap));
  const fuel = opts.fuel ?? defaultFuel(hapCap);
  const meter: MeterId = opts.meter ?? opts.lint?.meter ?? "4/4";

  let lint: LintResult | null = null;
  if (opts.lint) {
    lint = lintOak(code, opts.lint, R.toolbox);
    if (!lint.ok) {
      const err = new GraderError(
        "lint",
        lint.diagnostics
          .filter((d) => d.severity === "error")
          .map((d) => d.message)
          .join(" "),
      );
      err.lint = lint.diagnostics;
      const first = lint.diagnostics.find((d) => d.severity === "error");
      if (first) err.line = first.line;
      return failure(err, [], lint, t0);
    }
    if (opts.band) {
      const bandLint = lintOak(opts.band, { ...opts.lint, profile: "band" }, R.toolbox);
      if (!bandLint.ok) {
        const err = new GraderError(
          "lint",
          `Band code: ${bandLint.diagnostics.find((d) => d.severity === "error")?.message}`,
        );
        err.lint = bandLint.diagnostics;
        return failure(err, [], lint, t0);
      }
    }
  }
  const structure = sectionsFromAst(code);
  const astTotal = arrangedTotal(structure);

  const logs: LogLine[] = [];
  restoreRealm();
  captureInto(logs);
  // Strudel's logger drops a line identical to the previous one within 1 s, across requests too: a
  // unique line resets it, so a repeated failing submission still gets its log line.
  core.logger(`[oak] request ${++R.seq}`);
  logs.length = 0;
  resetRequestState();
  startFuel(fuel);
  R.active = true;
  let events: OakEvent[];
  let learner: Evaluated;
  let cps: number;
  let cpsSet: boolean;
  let bars: number;
  let fromCycle: number;
  let tracks: string[];
  let truncated: boolean;
  try {
    try {
      learner = await evaluateCode(code);
    } catch (e) {
      throw classify(e, "eval");
    }
    cps = R.cps;
    cpsSet = R.cpsSet;
    const tempoProblems = [...R.tempoProblems];
    let band: Evaluated | null = null;
    let learnerPattern = learner.pattern;
    if (opts.song) {
      // A unit song, composed exactly as the adapter plays it; the learner's code is the live Make when it has one.
      let song: { band: Evaluated; place: ((p: Pat) => Pat) | null; cps: number };
      try {
        song = await evaluateSong(opts.song, learner, code, opts.lint);
      } catch (e) {
        const err = classify(e, "eval");
        throw new GraderError(err.kind, `Song: ${err.message}`);
      }
      band = song.band;
      if (song.place) learnerPattern = song.place(learner.pattern);
      // The learner's tempo wins; the song's applies when the learner set none (a take's own tempo never does).
      if (!cpsSet) {
        cps = song.cps;
        cpsSet = true;
      }
    } else if (opts.band) {
      try {
        band = await evaluateCode(opts.band, "band.");
      } catch (e) {
        const err = classify(e, "eval");
        throw new GraderError(err.kind, `Band code: ${err.message}`);
      }
      if (opts.bandTracks && opts.bandTracks.length > 0) band = onlyTracks(band, opts.bandTracks);
      // The learner's tempo wins; the Band's applies only when the learner set none.
      if (!cpsSet && R.cpsSet) {
        cps = R.cps;
        cpsSet = true;
      }
    }
    R.tempoProblems = tempoProblems;
    const requested = opts.mode === "capstone" ? (astTotal ?? opts.bars) : opts.bars;
    bars = Math.max(1, Math.min(limits.maxBars, Math.floor(requested) || 1));
    truncated = requested > limits.maxBars;
    fromCycle = Math.max(0, Math.floor(opts.fromBar ?? 1) - 1);
    tracks = [...learner.tracks.keys(), ...(band ? [...band.tracks.keys()] : [])];
    const sources: QuerySource[] = [
      { pattern: learnerPattern, code, roles: learner.roles, fallbackTrack: "main" },
      ...(band
        ? [{ pattern: band.pattern, code: opts.band ?? "", roles: band.roles, fallbackTrack: "band.main" }]
        : []),
    ];
    try {
      events = queryCycles(sources, fromCycle, bars, cps, hapCap);
    } catch (e) {
      throw classify(e, "query");
    }
    sortOakEvents(events, tracks);
  } catch (e) {
    const err = e instanceof GraderError ? e : classify(e, "internal");
    return failure(err, logs, lint, t0);
  } finally {
    R.active = false;
    stopFuel();
    captureInto(null);
    restoreRealm();
  }

  const learnerEvents = events.filter((ev) => !ev.track.startsWith("band."));
  const totalBars =
    astTotal ?? periodOfEvents(learnerEvents, Math.min(bars, limits.periodCap), bars, fromCycle);
  const diagnostics: Diagnostic[] = [
    ...(lint?.diagnostics.map(lintToDiagnostic) ?? []),
    ...evalDiagnostics(events, logs, R.tempoProblems, bars, truncated, limits.maxBars),
  ];
  return {
    ok: true,
    cps,
    cpsSet,
    bpm: cpsToBpm(cps, meter),
    tracks,
    events,
    miniLocations: learner.miniLocations,
    logs,
    diagnostics,
    lint,
    bars,
    totalBars,
    truncated,
    fuelUsed: FUEL.used,
    ms: performance.now() - t0,
  };
}

/** Tags a track's haps with its name (a hap already tagged keeps its tag), as `evaluateCode` does. */
const tagTrack = (pattern: Pat, track: string): Pat =>
  pattern.withHap((h: Hap) =>
    h.context?.[TRACK_KEY] ? h : h.setContext({ ...h.context, [TRACK_KEY]: track }),
  );

/** The Band with only the labels a step asked for, filtered by the label each track registered. */
function onlyTracks(band: Evaluated, labels: readonly string[]): Evaluated {
  const keep = new Set(labels.map((l) => `band.${l}`));
  const tracks = new Map([...band.tracks].filter(([k]) => keep.has(k)));
  return { ...band, tracks, pattern: core.stack(...[...tracks].map(([k, p]) => tagTrack(p, k))) };
}

/**
 * A unit song in the realm: Oak's code and every saved take evaluated like any code (a take's own tempo is undone),
 * a take that fails the Band lint or its evaluation handed back to Oak, then composed with the learner's tracks as
 * the live Make (`@oak/strudel/song-compose`, the adapter's own composer). The song's tracks lose their source
 * locations: they are offsets into other codes than the learner's.
 */
async function evaluateSong(
  wire: SongBandWire,
  learner: Evaluated,
  code: string,
  lint: LintContext | null,
): Promise<{ band: Evaluated; place: ((p: Pat) => Pat) | null; cps: number }> {
  const song = songBandFromWire(wire);
  const evaluate: SongEvaluator = async (src) => {
    const saved = { cps: R.cps, cpsSet: R.cpsSet, problems: [...R.tempoProblems] };
    try {
      const evaluated = await evaluateCode(src);
      return [...evaluated.tracks].map(([label, pattern]) => ({ label, pattern }));
    } finally {
      R.cps = saved.cps;
      R.cpsSet = saved.cpsSet;
      R.tempoProblems = saved.problems;
    }
  };
  // Oak's code is authored Band code; a saved take is the learner's own code (`songLintContext`), as in playback.
  const check: SongCheck | undefined = lint
    ? (src, who) => lintOak(src, songLintContext(lint, who), R.toolbox).ok
    : undefined;
  const built = await buildSong(song, evaluate, check);
  const live = song.live
    ? { tracks: [...learner.tracks].map(([label, pattern]) => ({ label, pattern })), code }
    : null;
  const finished = finishSong(built, live);
  const tracks = new Map<string, Pat>();
  for (const t of finished.tracks)
    tracks.set(
      t.track,
      t.pattern.withHap((h: Hap) => h.setContext({ ...h.context, locations: [], [TRACK_KEY]: t.track })),
    );
  return {
    band: { tracks, pattern: core.stack(...tracks.values()), miniLocations: [], roles: [] },
    place: finished.place,
    cps: bpmToCps(song.bpm, song.def.meter),
  };
}

function classify(e: unknown, fallback: "eval" | "query" | "internal"): GraderError {
  if (FUEL.exceeded)
    return new GraderError(
      "too-much-work",
      `the work budget (${FUEL.limit}) ran out: the pattern is too dense`,
    );
  if (e instanceof GraderError) return e;
  return new GraderError(fallback, errorMessage(e));
}

const VOICING_UNKNOWN = /unknown chord "([^"]*)"/;

/** Log lines, tempo problems, unresolved pitches and silence as diagnostics (never a wrong answer). */
function evalDiagnostics(
  events: readonly OakEvent[],
  logs: readonly LogLine[],
  tempoProblems: readonly string[],
  bars: number,
  truncated: boolean,
  maxBars: number,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const l of logs) {
    if (!l.tag || l.tag === "oak") continue;
    const key = `${l.tag}|${l.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const chord = l.tag === "voicing" ? VOICING_UNKNOWN.exec(l.message) : null;
    if (chord?.[1]) {
      const sym = chord[1];
      // Same suggestion as the lint's (code.unknown-chord names a replacement): the known alias, else
      // the bare root, which always voices.
      const parts = splitChord(sym);
      const suggest = checkChord(sym).suggest ?? (parts ? parts.root.toUpperCase() : "C");
      out.push({
        id: "code.unknown-chord",
        severity: "error",
        params: { sym, why: "isn't a Strudel chord name", suggest },
      });
    } else out.push({ id: "eval.runtime", severity: "warn", params: { fn: l.tag, detail: l.message } });
  }
  for (const fn of tempoProblems) {
    out.push({
      id: "code.setcpm-form",
      severity: "warn",
      params: { detail: `${fn}() needs a plain number, not a string in quotes: the tempo was not set` },
    });
  }
  // `note("c4").transpose("x")` gives note:"" with no log line; `note("h4")` an unplayable string.
  const unresolved = events.filter(
    (e) => typeof e.note === "string" && e.midi === null && e.pitchSource === "note-str",
  );
  if (unresolved.length) {
    out.push({
      id: "eval.runtime",
      severity: "warn",
      params: { fn: "note", detail: `${unresolved.length} note(s) are not note names` },
    });
  }
  if (events.filter((e) => !e.track.startsWith("band.")).length === 0) {
    out.push({ id: "eval.silent", severity: "error", params: { bars } });
  }
  if (truncated) out.push({ id: "eval.truncated", severity: "info", params: { bars: maxBars } });
  return out;
}
