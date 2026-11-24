// The one place a StrudelMirror is constructed (architecture §2.1, promoted from
// spikes/s2-editors/src/oakStrudel.ts with every gotcha of docs/spikes.md s2).
import { setDiagnostics } from "@codemirror/lint";
import { Compartment, EditorState, Prec, StateEffect, Transaction } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type { LintContext, LintDiagnostic, UnlockableId } from "@oak/content-kit";
import { bpmToCps } from "@oak/theory";
import { StrudelMirror } from "@strudel/codemirror";
import * as draw from "@strudel/draw";
import { transpiler } from "@strudel/transpiler";
import * as webaudio from "@strudel/webaudio";
import * as WT from "worker-timers";
import { type PreparedBand, prepareBandFor } from "./band.ts";
import { formBarsOf } from "./band-form.ts";
import {
  type EvalSession,
  evaluatePreparedBand,
  finalizePattern,
  installTrackWrapper,
  newSession,
} from "./evaluation.ts";
import {
  addFlashEffect,
  editableField,
  editableOf,
  focusRangesIn,
  oakExtensions,
  programmatic,
  relint,
  removeFlashEffect,
  setEditableEffect,
  setMarksEffect,
} from "./extensions.ts";
import { sortLiveHaps, toLiveHap } from "./haps.ts";
import {
  ADAPTER_FEEDBACK,
  diagnostic,
  errorToDiagnostic,
  hasError,
  runLint,
  toCmDiagnostics,
} from "./lint-bridge.ts";
import { copyMutes, NO_MUTES } from "./mutes.ts";
import { withTimeout } from "./mutex.ts";
import { scopeRequests } from "./pack.ts";
import { playOnce } from "./play-once.ts";
import { WARM_AHEAD_BARS, type WarmAhead } from "./preload.ts";
import { captureMessageListeners, type Runtime, removeCaptured } from "./runtime.ts";
import { songLengthBars, songLintContext } from "./song-compose.ts";
import { type CyclistLike, queryLiveHaps } from "./transport.ts";
import type {
  BandSetup,
  EditorHandle,
  EditorOptions,
  EvalOutcome,
  EvaluateOptions,
  LiveHap,
  MuteMap,
  ScopePanel,
} from "./types.ts";

/** The most a play waits for its first two cycles of sounds before it starts anyway. */
const PRELOAD_BUDGET_MS = 4000;
const TRAILING_UNDERSCORE = /_$/;

interface MirrorLike {
  editor: EditorView;
  repl: {
    scheduler: CyclistLike & { stop(): void; start(): Promise<void>; pattern?: Strudel.Pattern };
    state: { pattern?: Strudel.Pattern };
    start(): Promise<void>;
    setCps(cps: number): unknown;
  };
  drawer: { stop(): void };
  evaluate(autostart?: boolean): Promise<void>;
  clear(): void;
  flash(ms?: number): void;
  highlight(haps: Strudel.Hap[], time: number): void;
}

export type InternalEditor = EditorHandle & { evict(): void };

export function createEditor(rt: Runtime, root: HTMLElement, opts: EditorOptions): InternalEditor {
  if (!TRAILING_UNDERSCORE.test(opts.id))
    throw new Error(`@oak/strudel: editor id must end with '_' (got ${opts.id})`);
  if (rt.editors.has(opts.id)) throw new Error(`@oak/strudel: an editor with id ${opts.id} already exists`);
  rt.beforeFirstMirror();

  // Live-mirror budget: make room before building (a playing or focused editor is never evicted).
  for (const victim of rt.budget.overflow((key) => {
    const e = rt.editors.get(key);
    return !e || e.playing || e.view.hasFocus;
  })) {
    rt.editors.get(victim)?.evict();
  }

  let disposed = false;
  let playing = false;
  let mutes: MuteMap = NO_MUTES;
  let band: BandSetup | null = opts.band ?? null;
  let lintCtx: LintContext = { ...opts.lint };
  let external: LintDiagnostic[] = [];
  let session: EvalSession = newSession();
  let lastPattern: Strudel.Pattern | undefined;
  let tracks: string[] = [];
  let flashId = 0;
  const flashTimers = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<number>();
  const offscreen = document.createElement("canvas").getContext("2d");
  const readOnly = new Compartment();
  const drawWindow = opts.drawWindow ?? [-2, 2];
  const releaseCoordinator: { fn: (() => void) | null } = { fn: null };
  let pendingBand: PreparedBand | null = null;
  let bandFailure: unknown = null;
  /** The background warm of a long piece's later bars (cancelled by the next evaluation and by dispose). */
  let ahead: WarmAhead | null = null;

  root.classList.add("oak-editor");

  const paint = (time: number, haps: Strudel.Hap[]): void => {
    if (disposed || !opts.onPaint) return;
    const live: LiveHap[] = sortLiveHaps(
      haps.filter((h) => h.hasOnset()).map((h) => toLiveHap(h)),
      tracks,
    );
    opts.onPaint({ haps: live, cycle: time, audibleCycle: rt.transport.audibleCycle() });
  };

  const constructed = captureMessageListeners(
    () =>
      new StrudelMirror({
        root,
        id: opts.id,
        initialCode: opts.initialCode,
        // 1.2.6 API (`onSchedule` on Strudel main): the only module that knows.
        defaultOutput: (hap: Strudel.Hap, deadline: number, duration: number, cps: number, t: number) => {
          rt.noteTrigger(hap.value);
          return webaudio.webaudioOutput(hap, deadline, duration, cps, t);
        },
        getTime: () => rt.ctx.currentTime,
        transpiler,
        prebake: () => rt.prebake(),
        setInterval: (cb: () => void, ms: number) => {
          const id = WT.setInterval(cb, ms);
          intervals.add(id);
          return id;
        },
        clearInterval: (id: number) => {
          if (intervals.delete(id)) WT.clearInterval(id);
        },
        drawTime: drawWindow,
        drawContext: offscreen,
        bgFill: false,
        solo: true,
        autodraw: false,
        editPattern: (pat: Strudel.Pattern) => {
          const out = finalizePattern(pat, { session, mutes: () => mutes, scopeTrack: rt.scope.track });
          return (out.onPaint as (fn: unknown) => Strudel.Pattern)(
            (_ctx: unknown, time: number, haps: Strudel.Hap[]) => paint(time, haps),
          );
        },
        beforeEval: async () => {
          // A unit song keeps its own tempo and meter until the learner's `setcpm` runs (spec §5.2).
          const song = pendingBand?.kind === "song" ? pendingBand.song : null;
          const { defaultBpm, meter } = opts.lessonCtx;
          const bpm = song ? song.bpm : defaultBpm;
          if (bpm > 0) mirror.repl.setCps(bpmToCps(bpm, song ? song.def.meter : meter));
          installTrackWrapper(session, () => mutes);
          if (pendingBand) {
            try {
              await evaluatePreparedBand(pendingBand, session, bandCheck);
            } catch (err) {
              session.band = [];
              session.song = null;
              bandFailure = err;
            }
          }
        },
        beforeStart: async () => {
          const ok = await rt.unlock();
          if (!ok) throw new Error("oak: audio is locked (needs a user gesture)");
          if (disposed) throw new Error("oak: editor was disposed before start");
        },
        afterEval: () => {
          // nothing: the locked evaluate reads the repl state after rawEvaluate returns
        },
        onEvalError: (err: unknown) => {
          session.error = err;
        },
        onToggle: (started: boolean) => {
          // Solo is noisy (the mirror's own 'start-repl' event and the coordinator both stop): forward
          // transitions only.
          if (disposed || started === playing) return;
          playing = started;
          if (started) {
            rt.budget.touch(opts.id);
            rt.transport.setActive(clockSource);
            releaseCoordinator.fn = rt.coordinator.claim({
              id: opts.id,
              kind: "editor",
              stop: () => mirror.repl.scheduler.stop(),
            });
          } else {
            const release = releaseCoordinator.fn;
            releaseCoordinator.fn = null;
            release?.();
            rt.transport.refresh();
          }
          opts.onToggle?.(started);
        },
      }) as MirrorLike,
  );
  const mirror = constructed.value;
  const captured = constructed.captured;
  const view = mirror.editor;
  rt.afterMirror();

  // Calm highlighting: instead of the haps active this frame (an outline that blinks with every `~`), light
  // every token that plays somewhere in the current cycle; it changes only at cycle boundaries.
  const rawHighlight = mirror.highlight.bind(mirror);
  let calmKey: { cycle: number; pattern: Strudel.Pattern | undefined } | null = null;
  let calmHaps: Strudel.Hap[] = [];
  mirror.highlight = (haps: Strudel.Hap[], time: number) => {
    if (!rt.calm()) {
      calmKey = null;
      rawHighlight(haps, time);
      return;
    }
    const cycle = Math.floor(time);
    if (!calmKey || calmKey.cycle !== cycle || calmKey.pattern !== lastPattern) {
      calmKey = { cycle, pattern: lastPattern };
      try {
        calmHaps = lastPattern ? lastPattern.queryArc(cycle, cycle + 1).filter((h) => h.hasOnset()) : [];
      } catch {
        calmHaps = [];
      }
    }
    rawHighlight(calmHaps, time);
  };

  const clockSource = {
    id: opts.id,
    scheduler: mirror.repl.scheduler,
    pattern: () => lastPattern,
    meter: () => opts.lessonCtx.meter,
    trackOrder: () => tracks,
  };

  // Oak's CM6 extensions (and the change listener: user edits only, not setCode).
  const onChange = opts.onChange;
  view.dispatch({
    effects: StateEffect.appendConfig.of([
      oakExtensions({
        vocabulary: () => rt.vocabulary,
        unlocked: () => lintCtx.unlocked,
        hooks: opts.hooks,
        lint: (code) => runLintCached(code),
        external: () => external,
        clearExternal: () => {
          external = [];
        },
        readOnly,
        initialReadOnly: opts.readOnly,
      }),
      EditorView.updateListener.of((update) => {
        if (onChange && update.docChanged && !update.transactions.some((t) => t.annotation(programmatic))) {
          onChange(update.state.doc.toString());
        }
      }),
      // Strudel binds the literal Ctrl-Enter / Ctrl-. only; on macOS Cmd must work too (ux §7.10). "Mod" is
      // Cmd on a Mac and Ctrl elsewhere (where Strudel's own binding already answers first).
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              void evaluate({ autostart: true });
              return true;
            },
          },
          {
            key: "Mod-.",
            preventDefault: true,
            run: () => {
              if (!disposed) mirror.repl.scheduler.stop();
              return true;
            },
          },
        ]),
      ),
    ]),
  });

  // Every evaluation goes through the one mutex, including StrudelMirror's own entry points (the
  // Ctrl-Enter keymap, toggle() and the 'repl-evaluate' document event all call `this.evaluate`).
  const rawEvaluate = mirror.evaluate.bind(mirror);
  mirror.evaluate = (autostart = true) => evaluate({ autostart }).then(() => undefined);

  function lintNow(code: string) {
    return runLint(rt.lint, code, lintCtx);
  }
  /**
   * The Band's own lint (profile `band`, previews allowed) for Band code and Oak's code of a unit song; a song's
   * saved take is linted as the learner's own code (`songLintContext`).
   */
  function bandCheck(bandCode: string, who: "oak" | "source" = "oak"): boolean {
    const linted = runLint(rt.lint, bandCode, songLintContext(lintCtx, who));
    return linted.ok && linted.result.ok;
  }
  let lintCache: { code: string; diagnostics: LintDiagnostic[] } | null = null;
  function runLintCached(code: string): LintDiagnostic[] {
    if (lintCache?.code === code) return lintCache.diagnostics;
    const out = lintNow(code);
    const diagnostics = out.ok ? out.result.diagnostics : [out.diagnostic];
    lintCache = { code, diagnostics };
    return diagnostics;
  }

  function outcomeOf(code: string, partial: Partial<EvalOutcome>): EvalOutcome {
    const outcome: EvalOutcome = {
      ok: false,
      code,
      cps: null,
      diagnostics: [],
      lint: null,
      miniLocations: [],
      tracks: [],
      ...partial,
    };
    return outcome;
  }

  function pushExternal(diagnostics: readonly LintDiagnostic[]): void {
    if (disposed) return;
    external = [...diagnostics];
    try {
      view.dispatch(setDiagnostics(view.state, toCmDiagnostics(external, view.state.doc.length)));
    } catch {
      // view destroyed meanwhile
    }
    relint(view);
  }

  function evaluate(evalOpts: EvaluateOptions = {}): Promise<EvalOutcome> {
    const autostart = evalOpts.autostart ?? true;
    return rt.mutex.run(async (): Promise<EvalOutcome> => {
      const code = view.state.doc.toString();
      const done = (outcome: EvalOutcome): EvalOutcome => {
        if (!disposed) opts.onEvaluated?.(outcome);
        return outcome;
      };
      if (disposed) {
        return outcomeOf(code, {
          diagnostics: [diagnostic(ADAPTER_FEEDBACK.disposed, "error", "The editor was closed.", code)],
        });
      }
      // 1. The one lint pass. An error-severity finding means the code is not run.
      const linted = lintNow(code);
      if (!linted.ok) {
        pushExternal([linted.diagnostic]);
        return done(outcomeOf(code, { diagnostics: [linted.diagnostic] }));
      }
      const lint = linted.result;
      lintCache = { code, diagnostics: lint.diagnostics };
      if (!lint.ok || hasError(lint.diagnostics)) {
        relint(view);
        return done(outcomeOf(code, { diagnostics: [...lint.diagnostics], lint }));
      }
      // 2. The real async waits, inside the mutex but before the repl, checking `disposed` in between.
      try {
        await rt.prebake();
      } catch (err) {
        const d = diagnostic(
          ADAPTER_FEEDBACK.runtime,
          "error",
          `Sounds could not be loaded: ${String(err)}`,
          code,
        );
        return done(outcomeOf(code, { diagnostics: [d], lint }));
      }
      const extra: LintDiagnostic[] = [];
      let start = autostart;
      if (autostart && !(await rt.unlock())) {
        start = false;
        extra.push(
          diagnostic(
            ADAPTER_FEEDBACK.audioLocked,
            "warn",
            "Audio is locked: click Play or press a key to start it.",
            code,
          ),
        );
      }
      if (disposed) {
        return outcomeOf(code, {
          diagnostics: [diagnostic(ADAPTER_FEEDBACK.disposed, "error", "The editor was closed.", code)],
        });
      }
      // 3. The Band, prepared outside the repl; evaluated in beforeEval with a private collector.
      pendingBand = null;
      bandFailure = null;
      if (band) {
        const prepared = prepareBandFor(band, {
          key: opts.lessonCtx.key,
          defaultBpm: opts.lessonCtx.defaultBpm,
          learnerCode: code,
        });
        // A song checks each of its codes as it evaluates them (`bandCheck`); a broken take falls back to Oak.
        if (prepared.kind === "song" || bandCheck(prepared.code)) pendingBand = prepared;
        else bandFailure = new Error("the Band code did not pass its check");
      }
      // 4. Evaluate without starting; then warm what the first two cycles trigger; then start.
      session = newSession();
      scopeRequests.clear();
      await rawEvaluate(false);
      pendingBand = null;
      if (bandFailure) {
        extra.push(
          diagnostic(
            ADAPTER_FEEDBACK.band,
            "warn",
            `The Band could not play (${String(bandFailure)}); your code still runs.`,
            code,
          ),
        );
      }
      const repl = mirror.repl;
      if (session.error) {
        const d = errorToDiagnostic(session.error, code);
        pushExternal([d]);
        return done(outcomeOf(code, { diagnostics: [...lint.diagnostics, d, ...extra], lint }));
      }
      lastPattern = repl.state.pattern;
      tracks = [...session.tracks, ...session.band.map((b) => b.track)];
      // Once (a take): the scheduler plays only what starts before the last bar's end, from a stopped start (cycle 0).
      if (evalOpts.once !== undefined) playOnce(repl, evalOpts.once);
      // A pattern that runs but makes no notes (`silence`, a `mask("0")`, an empty string) is not an error,
      // but the learner hears nothing: say so instead of looking broken. Mutes are the learner's choice.
      if (mutes.muted.size === 0 && mutes.solo === null) {
        const cycles = Math.max(1, Math.min(opts.lessonCtx.loopBars || 1, 16));
        if (queryLiveHaps(lastPattern, 0, cycles, tracks).length === 0) {
          extra.push(
            diagnostic(ADAPTER_FEEDBACK.silent, "info", "The code ran, but it plays no notes yet.", code),
          );
        }
      }
      const panels = [...scopeRequests] as ScopePanel[];
      rt.scope.setPanels(opts.id, panels);
      if (!rt.transport.active || !rt.transport.get().playing) rt.transport.setActive(clockSource);
      ahead?.cancel();
      ahead = null;
      if (start && lastPattern && !disposed) {
        const from = repl.scheduler.started ? repl.scheduler.now() : 0;
        const warm = rt.preloadPattern(lastPattern, from, from + 2);
        // A song in sections (a 90-second C3) brings sounds and pitches the first bars never play: warm them,
        // in order, while the first bars play, so the chorus's first crash or pad note is never skipped.
        const pattern = lastPattern;
        const songBars = session.song ? songLengthBars(session.song.built.band.def) : null;
        void warm.then(() => {
          if (disposed || lastPattern !== pattern) return;
          const form = songBars ?? formBarsOf(code);
          const bars = Math.min(form ?? WARM_AHEAD_BARS, WARM_AHEAD_BARS);
          ahead = rt.warmAhead(pattern, from + 2, from + Math.max(2, bars));
        });
        if (!repl.scheduler.started) {
          await withTimeout(warm, PRELOAD_BUDGET_MS, () => new Error("preload budget")).catch(
            () => undefined,
          );
          if (!disposed) {
            try {
              await repl.start();
            } catch (err) {
              extra.push(
                diagnostic(
                  ADAPTER_FEEDBACK.audioLocked,
                  "warn",
                  String((err as Error)?.message ?? err),
                  code,
                ),
              );
            }
          }
        }
      }
      rt.transport.refresh();
      if (external.length > 0) pushExternal([]);
      const meta = (repl.state as { miniLocations?: [number, number][] }).miniLocations ?? [];
      const outcome = outcomeOf(code, {
        ok: true,
        cps: repl.scheduler.cps,
        diagnostics: [...lint.diagnostics, ...extra],
        lint,
        miniLocations: meta.map(([a, b]) => [a, b] as [number, number]),
        tracks: [...session.tracks],
      });
      if (panels.length > 0) outcome.panels = panels;
      return done(outcome);
    });
  }

  function staticize(): void {
    const pre = document.createElement("pre");
    pre.className = "oak-static-code";
    pre.textContent = view.state.doc.toString();
    teardown();
    root.replaceChildren(pre);
  }

  function teardown(): void {
    if (disposed) return;
    disposed = true;
    ahead?.cancel();
    ahead = null;
    rt.editors.delete(opts.id);
    rt.budget.delete(opts.id);
    const release = releaseCoordinator.fn;
    releaseCoordinator.fn = null;
    const wasPlaying = playing;
    try {
      mirror.repl.scheduler.stop(); // -> onToggle(false) -> drawer.stop + updateMiniLocations + cleanupDraw
    } catch {
      // ignore
    }
    release?.();
    // Closing a playing editor (leaving the page) must not leave its last chords ringing for seconds:
    // cut the voices already scheduled, as the panic key does. A stopped editor leaves the others alone.
    if (wasPlaying && !rt.disposed()) rt.coordinator.panic();
    rt.transport.clearActive(opts.id);
    try {
      mirror.drawer.stop();
      mirror.clear(); // the 4 document listeners
    } catch {
      // ignore
    }
    removeCaptured(captured); // kabelsalat's window 'message' listener
    for (const id of [...intervals]) {
      intervals.delete(id);
      WT.clearInterval(id);
    }
    for (const t of flashTimers) clearTimeout(t);
    flashTimers.clear();
    try {
      view.destroy();
    } catch {
      // ignore
    }
    root.replaceChildren();
    root.removeAttribute("style"); // StrudelMirror sets display, font-size and font-family inline
    root.classList.remove("oak-editor");
    try {
      draw.cleanupDraw(true, opts.id);
    } catch {
      // ignore
    }
  }

  // The learner's Stop: the scheduler stops, and the notes it already started stop with it (a 4-second pad no
  // longer rings on for seconds; review:surfaces). Only when this editor was playing, so a Stop on a silent
  // editor never cuts another source's tail; the master ducks for 40 ms, so the cut does not click.
  function stopAndCut(): void {
    const wasPlaying = playing;
    mirror.repl.scheduler.stop();
    const active = rt.coordinator.get().activeId;
    if (wasPlaying && !rt.disposed() && (active === null || active === opts.id)) rt.coordinator.panic();
  }

  const handle: InternalEditor = {
    id: opts.id,
    view,
    get playing() {
      return playing && !disposed;
    },
    get disposed() {
      return disposed;
    },
    getCode: () => view.state.doc.toString(),
    setCode(code, setOpts) {
      if (disposed) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
        annotations: [programmatic.of(true), Transaction.addToHistory.of(setOpts?.undoable ?? true)],
      });
      opts.onChange?.(code);
    },
    evaluate,
    play: (playOpts) =>
      evaluate({ autostart: true, ...(playOpts?.once !== undefined ? { once: playOpts.once } : {}) }),
    stop() {
      if (!disposed) stopAndCut();
    },
    async toggle() {
      if (disposed) return;
      if (mirror.repl.scheduler.started) stopAndCut();
      else await evaluate({ autostart: true });
    },
    setDiagnostics(diagnostics) {
      pushExternal(diagnostics);
    },
    focusRanges(ranges) {
      if (!disposed) focusRangesIn(view, ranges);
    },
    setMarks(marks) {
      if (!disposed) view.dispatch({ effects: setMarksEffect.of(marks) });
    },
    flashRanges(ranges, ms = 600) {
      if (disposed || ranges.length === 0) return;
      const id = ++flashId;
      view.dispatch({ effects: addFlashEffect.of({ id, ranges }) });
      const timer = setTimeout(() => {
        flashTimers.delete(timer);
        if (!disposed) view.dispatch({ effects: removeFlashEffect.of(id) });
      }, ms);
      flashTimers.add(timer);
    },
    queryHaps(from, to) {
      return queryLiveHaps(lastPattern, from, to, tracks);
    },
    editableRanges() {
      const st = view.state.field(editableField);
      if (st.kind === "all") return null;
      if (st.kind === "none") return [];
      return st.ranges.map((r) => ({ from: r.from, to: r.to }));
    },
    setEditable(next) {
      if (disposed) return;
      view.dispatch({
        effects: [
          setEditableEffect.of(editableOf(next)),
          readOnly.reconfigure(EditorState.readOnly.of(next === true)),
        ],
      });
    },
    setUnlocked(unlocked: ReadonlySet<UnlockableId>) {
      lintCtx = { ...lintCtx, unlocked };
      lintCache = null;
      if (!disposed) relint(view);
    },
    setMutes(next) {
      mutes = copyMutes(next);
    },
    getMutes: () => copyMutes(mutes),
    setBand(next) {
      band = next;
    },
    dispose() {
      teardown();
    },
    evict() {
      if (disposed) return;
      staticize();
      opts.onEvicted?.();
    },
  };

  view.dom.addEventListener("focusin", () => rt.budget.touch(opts.id));

  rt.editors.set(opts.id, handle);
  rt.budget.touch(opts.id);
  return handle;
}
