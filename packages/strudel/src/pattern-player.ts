// The hidden pattern player (Transcribe's "pattern source": ladder stimuli, X1, X2, CF-T; the circle's key
// preview; auditions). A repl with no editor and nothing in the DOM: the code it plays never reaches an editor,
// the page or the learner. Rate is a cps scale, transposition a live `note` shift on pitched haps, the A–B loop
// `.ribbon(fromBar, bars)`, realism (contracts §6.12) a deterministic layer on the pattern; all four change the
// playing pattern at once, no re-evaluation. A Band (contracts §5.10) is evaluated next to the code and plays on
// the same scheduler, exactly as under an editor; so is a unit song (spec §5.2: the Today and song-page play buttons,
// the Workbench's section loop), composed by song-compose.ts around the loaded code.
import type { KeySpec, LintContext, LintDiagnostic } from "@oak/content-kit";
import * as core from "@strudel/core";
import { transpiler } from "@strudel/transpiler";
import * as webaudio from "@strudel/webaudio";
import * as WT from "worker-timers";
import { firstScaleOf, type PreparedBand, prepareBandFor } from "./band.ts";
import { formBarsOf } from "./band-form.ts";
import {
  type EvalSession,
  evaluatePreparedBand,
  finalizePattern,
  installTrackWrapper,
  newSession,
  songCps,
} from "./evaluation.ts";
import {
  ADAPTER_FEEDBACK,
  diagnostic,
  errorToDiagnostic,
  hasError,
  type LintOutcome,
  runLint,
} from "./lint-bridge.ts";
import { copyMutes, NO_MUTES } from "./mutes.ts";
import { WARM_AHEAD_BARS, type WarmAhead } from "./preload.ts";
import { isCleanRealism, type RealismSpec, realismSpec } from "./realism.ts";
import { applyRealism } from "./realism-pattern.ts";
import { captureMessageListeners, type Runtime, removeCaptured } from "./runtime.ts";
import { type SongCheck, songLengthBars, songLintContext } from "./song-compose.ts";
import type { CyclistLike } from "./transport.ts";
import type { BandSetup, EvalOutcome, MuteMap, PatternPlayer } from "./types.ts";

interface ReplLike {
  scheduler: CyclistLike & { stop(): void; start(): Promise<void> };
  state: { pattern?: Strudel.Pattern; miniLocations?: [number, number][] };
  evaluate(code: string, autostart?: boolean): Promise<unknown>;
  setPattern(pattern: Strudel.Pattern, autostart?: boolean): Promise<unknown>;
  setCps(cps: number): void;
  start(): Promise<void>;
  stop(): void;
}

/** Bar position of the player for a scheduler cycle, honouring the A–B loop. */
export function barPosition(cycle: number, loop: { fromBar: number; bars: number } | null): number {
  if (!loop || loop.bars <= 0) return cycle;
  const within = ((cycle % loop.bars) + loop.bars) % loop.bars;
  return loop.fromBar + within;
}

export const clampRate = (rate: number): number =>
  Math.max(0.25, Math.min(1, Number.isFinite(rate) ? rate : 1));
/** The step key a Band was written for: its first `.scale()` (the app filled `{{key}}` with it). */
export function keyOfBandCode(code: string): KeySpec | null {
  const first = firstScaleOf(code);
  if (!first) return null;
  return { tonic: first.tonic, mode: first.mode.replace(/:/g, " ") } as KeySpec;
}

/** Beats per bar of the player's meter (4/4): turns the item's cps into the Band's `{{bpm}}`. */
const BEATS_PER_BAR = 4;
/** Bars warmed ahead of play: a ladder item or a song phrase fits; longer sources warm the rest while playing. */
const PRELOAD_BARS = 16;

export const clampTranspose = (st: number): number =>
  Math.max(-12, Math.min(12, Math.round(Number.isFinite(st) ? st : 0)));

/** The lint result of a load that has nothing of its own to lint. */
const NOTHING_TO_LINT: LintOutcome = {
  ok: true,
  result: { ok: true, diagnostics: [], used: [], locked: [], lockedTools: [] },
};

/**
 * What `load` evaluates, linted: a unit song with no code of its own (Today's and the song page's play) plays alone
 * over the placeholder `silence`, which is neither the learner's code nor Oak's and is not linted (each code of the
 * song is checked as it evaluates: `songLintContext`); any other code is linted with the load's context.
 */
export function lintForLoad(
  lint: Runtime["lint"],
  given: string,
  band: BandSetup | null | undefined,
  ctx: LintContext,
): { code: string; outcome: LintOutcome } {
  if (!given.trim() && band?.song) return { code: "silence", outcome: NOTHING_TO_LINT };
  return { code: given, outcome: runLint(lint, given, ctx) };
}

let playerCount = 0;

export function createPatternPlayer(rt: Runtime): PatternPlayer {
  const id = `player:${++playerCount}`;
  let disposed = false;
  let playing = false;
  let mutes: MuteMap = NO_MUTES;
  let rate = 1;
  let transpose = 0;
  let loop: { fromBar: number; bars: number } | null = null;
  let baseCps = 0.5;
  let raw: Strudel.Pattern | undefined;
  let effective: Strudel.Pattern | undefined;
  let session: EvalSession = newSession();
  let release: (() => void) | null = null;
  let realism: RealismSpec = realismSpec(0);
  let pendingBand: PreparedBand | null = null;
  /** The Band lint of the current load, for each code of a unit song. */
  let bandCheck: SongCheck | null = null;
  let bandFailure: unknown = null;
  let loadedTracks: string[] = [];
  let loadedBars = 1;
  /** The preload a realism change started: `play` waits for it, so a new lead sound never skips. */
  let warming: Promise<unknown> = Promise.resolve();
  const intervals = new Set<number>();
  /** The background warm of a long source's later bars (a 90-second song). */
  let ahead: WarmAhead | null = null;

  const constructed = captureMessageListeners(
    () =>
      core.repl({
        defaultOutput: (hap: Strudel.Hap, deadline: number, duration: number, cps: number, t: number) => {
          rt.noteTrigger(hap.value);
          return webaudio.webaudioOutput(hap, deadline, duration, cps, t);
        },
        getTime: () => rt.ctx.currentTime,
        transpiler,
        setInterval: (cb: () => void, ms: number) => {
          const t = WT.setInterval(cb, ms);
          intervals.add(t);
          return t;
        },
        clearInterval: (t: number) => {
          if (intervals.delete(t)) WT.clearInterval(t);
        },
        id: `oak_${id.replace(":", "-")}_`,
        beforeEval: async () => {
          // A unit song plays at its own tempo until the loaded code sets one (spec §5.2).
          if (pendingBand?.kind === "song") repl.setCps(songCps(pendingBand.song));
          installTrackWrapper(session, () => mutes);
          if (pendingBand) {
            try {
              await evaluatePreparedBand(pendingBand, session, bandCheck ?? undefined);
            } catch (err) {
              session.band = [];
              session.song = null;
              bandFailure = err;
            }
          }
        },
        editPattern: (pat: Strudel.Pattern) => {
          raw = pat;
          effective = build();
          return live;
        },
        beforeStart: async () => {
          if (!(await rt.unlock())) throw new Error("oak: audio is locked (needs a user gesture)");
          if (disposed) throw new Error("oak: pattern player was disposed");
        },
        onEvalError: (err: unknown) => {
          session.error = err;
        },
        onToggle: (started: boolean) => {
          if (disposed) return;
          playing = started;
          if (started) {
            rt.transport.setActive(source);
            release = rt.coordinator.claim({ id, kind: "pattern-player", stop: () => repl.stop() });
          } else {
            const r = release;
            release = null;
            r?.();
            rt.transport.refresh();
          }
        },
      }) as ReplLike,
  );
  const repl = constructed.value;

  /** The playing pattern reads `effective` at query time, so loop and transpose apply live. */
  const live = new core.Pattern((state: Strudel.State) =>
    effective ? effective.query(state) : [],
  ) as Strudel.Pattern;
  function build(): Strudel.Pattern | undefined {
    if (!raw) return undefined;
    let out = finalizePattern(raw, {
      session,
      mutes: () => mutes,
      transpose: () => transpose,
      scopeTrack: rt.scope.track,
    });
    if (loop)
      out = (out.ribbon as (offset: number, cycles: number) => Strudel.Pattern)(loop.fromBar, loop.bars);
    // Realism after the loop (so a note pushed across the loop point stays one note, never a re-triggered
    // fragment), keyed by the bar each looped cycle plays: bars 3–4 looped sound as they did in the full play.
    if (!isCleanRealism(realism)) {
      const l = loop;
      out = applyRealism(out, realism, {
        cps: baseCps,
        tracks: loadedTracks,
        ...(l ? { origin: (c: number) => barPosition(c, l) } : {}),
      });
    }
    return out;
  }

  /**
   * The Band to evaluate under the hidden code (`prepareBandFor`, as under an editor), checked with the Band's own
   * lint profile; a unit song checks each of its codes as it evaluates them.
   */
  function prepareBand(
    band: BandSetup | null,
    code: string,
    cps: number,
    key: KeySpec | null | undefined,
    ctx: LintContext,
  ): { ok: true; value: PreparedBand } | { ok: false; error: unknown } {
    if (!band) return { ok: false, error: null };
    const check = (c: string, who: "oak" | "source" = "oak"): boolean => {
      const linted = runLint(rt.lint, c, songLintContext(ctx, who));
      return linted.ok && linted.result.ok;
    };
    bandCheck = check;
    const prepared = prepareBandFor(band, {
      key: key ?? keyOfBandCode(band.code),
      defaultBpm: cps > 0 ? Math.round(cps * 60 * BEATS_PER_BAR * 1000) / 1000 : 120,
      learnerCode: code,
    });
    if (prepared.kind === "code" && !check(prepared.code))
      return { ok: false, error: new Error("the Band code did not pass its check") };
    return { ok: true, value: prepared };
  }

  const source = {
    id,
    scheduler: repl.scheduler,
    pattern: () => effective,
    meter: () => "4/4" as const,
    trackOrder: () => session.tracks,
  };

  const applyRate = (): void => {
    repl.scheduler.setCps(baseCps * rate);
    rt.transport.refresh();
  };

  return {
    get playing() {
      return playing && !disposed;
    },
    load(given, opts) {
      const ctx: LintContext = opts.lint ?? {
        profile: "content",
        unlocked: new Set(),
        allowPreview: true,
        meter: "4/4",
        key: null,
      };
      const { code, outcome: linted } = lintForLoad(rt.lint, given, opts.band, ctx);
      return rt.mutex.run(async (): Promise<EvalOutcome> => {
        const base: EvalOutcome = {
          ok: false,
          code,
          cps: null,
          diagnostics: [],
          lint: null,
          miniLocations: [],
          tracks: [],
        };
        if (disposed) {
          return {
            ...base,
            diagnostics: [diagnostic(ADAPTER_FEEDBACK.disposed, "error", "The player was closed.", code)],
          };
        }
        if (!linted.ok) return { ...base, diagnostics: [linted.diagnostic] };
        const lint = linted.result;
        if (!lint.ok || hasError(lint.diagnostics))
          return { ...base, diagnostics: [...lint.diagnostics], lint };
        await rt.prebake();
        const extra: LintDiagnostic[] = [];
        pendingBand = null;
        bandFailure = null;
        const band = prepareBand(opts.band ?? null, code, opts.cps, opts.key, ctx);
        if (band.ok) pendingBand = band.value;
        else if (band.error) bandFailure = band.error;
        session = newSession();
        await repl.evaluate(code, false);
        pendingBand = null;
        if (session.error) {
          const d: LintDiagnostic = errorToDiagnostic(session.error, code);
          return { ...base, diagnostics: [...lint.diagnostics, d], lint };
        }
        if (bandFailure) {
          extra.push(
            diagnostic(
              ADAPTER_FEEDBACK.band,
              "warn",
              `The Band could not play (${String(bandFailure)}); the source still plays.`,
              code,
            ),
          );
        }
        loadedTracks = [...session.tracks, ...session.band.map((b) => b.track)];
        // Reference code is authored at its own tempo; `opts.cps` is the tempo at rate 1.
        baseCps = opts.cps > 0 ? opts.cps : repl.scheduler.cps;
        applyRate();
        effective = build();
        loadedBars = Math.max(1, Math.min(opts.bars, PRELOAD_BARS));
        // The whole stimulus as it will sound (Band, realism, lead sound and detuned pitches included).
        ahead?.cancel();
        ahead = null;
        if (effective) await rt.preloadPattern(effective, 0, loadedBars);
        // A source longer than the bars warmed up front: the rest is warmed in order while it plays.
        const form = session.song ? songLengthBars(session.song.built.band.def) : formBarsOf(code);
        const pieceBars = Math.min(Math.max(opts.bars, form ?? 0), WARM_AHEAD_BARS);
        if (effective && pieceBars > loadedBars) ahead = rt.warmAhead(effective, loadedBars, pieceBars);
        if (!playing) rt.transport.setActive(source);
        return {
          ...base,
          ok: true,
          cps: repl.scheduler.cps,
          diagnostics: [...lint.diagnostics, ...extra],
          lint,
          miniLocations: (repl.state.miniLocations ?? []).map(([a, b]) => [a, b] as [number, number]),
          tracks: [...loadedTracks],
        };
      });
    },
    async play() {
      if (disposed || !raw) return;
      await warming;
      if (disposed) return;
      if (!repl.scheduler.started) {
        applyRate();
        await repl.start();
      }
    },
    stop() {
      if (!disposed) repl.stop();
    },
    setRate(next) {
      rate = clampRate(next);
      applyRate();
    },
    setTranspose(semitones) {
      transpose = clampTranspose(semitones);
    },
    setLoop(next) {
      // `fromBar` may be fractional, and negative for own audio looped in its lead-in (before bar 1).
      loop =
        next && next.bars > 0 && Number.isFinite(next.fromBar)
          ? { fromBar: next.fromBar, bars: next.bars }
          : null;
      effective = build();
    },
    setMutes(next) {
      mutes = copyMutes(next);
    },
    setRealism(spec) {
      realism = { ...spec };
      effective = build();
      // A lead sound or detuned pitches the clean pattern never asked for: warm them before they are due.
      if (effective && !isCleanRealism(realism))
        warming = rt.preloadPattern(effective, 0, loadedBars).catch(() => undefined);
    },
    position: () => barPosition(repl.scheduler.started ? repl.scheduler.now() : 0, loop),
    dispose() {
      if (disposed) return;
      disposed = true;
      ahead?.cancel();
      ahead = null;
      try {
        repl.stop();
      } catch {
        // ignore
      }
      const r = release;
      release = null;
      r?.();
      rt.transport.clearActive(id);
      removeCaptured(constructed.captured);
      for (const t of [...intervals]) {
        intervals.delete(t);
        WT.clearInterval(t);
      }
    },
  };
}
