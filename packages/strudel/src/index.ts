// @oak/strudel: the OakStrudel adapter. Browser only; the single place that imports @strudel/codemirror,
// @strudel/webaudio, @strudel/draw, @strudel/soundfonts and superdough.
// Promoted from spikes/s2-editors/src/oakStrudel.ts and spikes/s3-sounds/src/oak-audio.ts with their gotchas.
import type { LintContext, LintResult } from "@oak/content-kit";
import { codemirrorSettings, defaultSettings } from "@strudel/codemirror";
import * as webaudio from "@strudel/webaudio";
import { buildVocabulary } from "./completion.ts";
import { createCoordinator } from "./coordinator.ts";
import { createEditor } from "./editor.ts";
import { isNoise, missingSoundOf, parseStrudelLog } from "./logs.ts";
import { LiveBudget } from "./lru.ts";
import { createMasterBus, LIMITER, limiterMakeupDb } from "./master-bus.ts";
import { EvalMutex, withTimeout } from "./mutex.ts";
import { type PackManifest, packFileUrls, prebake, soundNames } from "./pack.ts";
import { createPatternPlayer } from "./pattern-player.ts";
import { playEvents, playNote } from "./playback.ts";
import { preloadPattern, preloadSpec, soundKeyOf, warmAhead, warmAll } from "./preload.ts";
import { createRecorder } from "./recorder.ts";
import type { Runtime } from "./runtime.ts";
import { createScopeTap } from "./scope-tap.ts";
import { soundsIn } from "./sounds-in.ts";
import { createStore } from "./store.ts";
import { createTransport } from "./transport.ts";
import type { AudioState, EditorHandle, OakStrudel, OakStrudelOptions, StrudelLog } from "./types.ts";
import { createUiSoundBus } from "./ui-sounds.ts";

// The Band code a plain Band plays (key and form follow, register fold), for paths outside the adapter (the
// Workbench analysis), and the one preparation every path shares (unit songs: spec §5.2).
export {
  type BandContext,
  bandCodeFor,
  type PreparedBand,
  prepareBandFor,
} from "./band.ts";
export { buildVocabulary, completionSiteAt, completionsFor } from "./completion.ts";
export type { InternalEditor } from "./editor.ts";
export { evaluateSongBand, songCps } from "./evaluation.ts";
export { type FriendlyError, friendlyEvalError } from "./friendly.ts";
export { isMuted, NO_MUTES } from "./mutes.ts";
// Wave 5 seam (docs/design/wave5.md §3.4): visual probes and a fake scope tap (also "@oak/strudel/probes").
export * from "./probes.ts";
// Wave 4 seam (docs/design/wave4.md §3.5): realism levels of ladder stimuli.
export {
  isCleanRealism,
  type RealismLevelId,
  type RealismSpec,
  realismSpec,
  StrudelNotBuiltError,
} from "./realism.ts";
export {
  applyRealism,
  DETUNE_STEP_CENTS,
  detuneAt,
  isTargetTrack,
  REFERENCE_PREFIX,
  realismScope,
} from "./realism-pattern.ts";
export {
  cadencePlan,
  dronePlan,
  REFERENCE_PRELOAD,
  REFERENCE_TONES,
  type ReferenceKind,
  referenceValue,
  tonicPlan,
} from "./reference.ts";
// Unit songs (spec §5.2): the composer, also "@oak/strudel/song-compose" for the grader's realm.
export {
  composeSongPatterns,
  LIVE_SOURCE,
  labelsOf,
  OAK_TRACK_PREFIX,
  oakCodeOf,
  oakTrackName,
  placeInSections,
  playedPartsOfTracks,
  roleOfTrack,
  type SongBand,
  type SongBandWire,
  type SongLive,
  type SongSource,
  type SongTrackRole,
  type SourceSection,
  songBandFromWire,
  songBandToWire,
  songBandTracks,
  songFormView,
  songLengthBars,
  sourceSectionsOf,
  TAKE_TRACK_PREFIX,
  type TrackFacts,
  takeTrackName,
  trackFacts,
} from "./song-compose.ts";
export { soundsIn } from "./sounds-in.ts";
export * from "./types.ts";
export { LIMITER, limiterMakeupDb };

/** Strudel's CodeMirror settings as Oak sets them, in FULL, before the first mirror (docs/spikes.md s2). */
export const OAK_CM_SETTINGS = {
  ...defaultSettings,
  theme: "strudelTheme",
  isAutoCompletionEnabled: false,
  isPatternHighlightingEnabled: true,
  isFlashEnabled: true,
  isTooltipEnabled: false,
  fontSize: 15,
  // Strudel writes this inline on the root and the scroller: Oak's code face (ux §7.4), never bare monospace.
  fontFamily: 'var(--oak-font-code, "JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, monospace)',
  keybindings: "codemirror",
} as const;

/** `ctx.resume()` without user activation stays pending forever: race it. */
export const UNLOCK_TIMEOUT_MS = 1500;

let instance: OakStrudel | null = null;

/** The hidden 1×1 canvas Strudel's `getDrawContext()` finds instead of prepending a fullscreen one. */
function ensureTestCanvas(): void {
  if (document.getElementById("test-canvas")) return;
  const holder = document.createElement("div");
  holder.id = "oak-visuals";
  holder.hidden = true;
  holder.style.display = "none";
  const canvas = document.createElement("canvas");
  canvas.id = "test-canvas";
  canvas.width = 1;
  canvas.height = 1;
  holder.append(canvas);
  document.body.append(holder);
}

/**
 * Creates the adapter. One per page: a second call throws. It applies the full CodeMirror settings
 * object before the first mirror, prebakes once, installs the master bus and stubs the visual methods
 * (`.scope()` and `.fscope()` route to Oak's own panel through `master.analyser`).
 */
export function createOakStrudel(options: OakStrudelOptions): OakStrudel {
  if (instance) throw new Error("@oak/strudel: the adapter already exists; use getOakStrudel()");
  const ctx = options.ctx ?? new AudioContext({ latencyHint: "interactive" });
  webaudio.setAudioContext(ctx);
  ensureTestCanvas();

  let disposed = false;
  const cleanups: (() => void)[] = [];
  const logListeners = new Set<(log: StrudelLog) => void>();
  const mutex = new EvalMutex();
  const budget = new LiveBudget<string>(options.maxLiveEditors ?? 6);
  const transport = createTransport(ctx);
  const master = createMasterBus(ctx);
  // The scope's one-track source is superdough's `analyze` analyser. An AnalyserNode whose voices have all ended
  // has no input and stops being processed, freezing its last frame: a silent ConstantSource keeps it running,
  // so a track that stops reads silence, not its last wave.
  const kept = new WeakSet<AnalyserNode>();
  const scope = createScopeTap(master.analyser, ctx.sampleRate, (id, fftSize) => {
    // Only once audio is unlocked: superdough's analysers live in the context `initAudio` set up.
    if (!unlocked) return null;
    const node = webaudio.getAnalyserById(id, fftSize, 0) as AnalyserNode;
    if (!kept.has(node)) {
      kept.add(node);
      const zero = new ConstantSourceNode(ctx, { offset: 0 });
      zero.connect(node);
      zero.start();
    }
    return node;
  });
  const ui = createUiSoundBus(ctx);
  const editors: Runtime["editors"] = new Map();
  const audio = createStore<AudioState>("locked");
  let unlocked = false;
  let initAudio: Promise<void> | null = null;
  let unlocking: Promise<boolean> | null = null;
  let lastColdSound: string | undefined;

  const coordinator = createCoordinator(() => {
    // Panic: cut every ringing voice. resetGlobalEffects rebuilds superdough's output; the bus re-attaches.
    master.duck(40);
    if (unlocked) {
      try {
        webaudio.resetGlobalEffects();
      } catch {
        // nothing ringing
      }
    }
  });

  // --- prebake -------------------------------------------------------------------------------------
  let prebakePromise: Promise<PackManifest> | null = null;
  const prebakeOnce = (): Promise<PackManifest> => {
    if (!prebakePromise) {
      const p = prebake(options.soundsRoot);
      prebakePromise = p;
      p.catch(() => {
        if (prebakePromise === p) prebakePromise = null;
      });
    }
    return prebakePromise;
  };
  const ready = prebakeOnce().then(() => undefined);
  ready.catch((err) => console.error("[oak] prebake failed", err));

  // --- unlock --------------------------------------------------------------------------------------
  const mapState = (): AudioState => {
    if (!unlocked) return "locked";
    const s = ctx.state as string;
    return s === "running" ? "running" : s === "interrupted" ? "interrupted" : "suspended";
  };
  const onStateChange = (): void => {
    const before = audio.get();
    if (unlocked && ctx.state !== "running") {
      // Playback halts; the UI shows "Tap to resume audio" and the next gesture unlocks again.
      unlocked = false;
      if (before === "running") coordinator.stopAll();
      audio.set((ctx.state as string) === "interrupted" ? "interrupted" : "suspended");
      return;
    }
    audio.set(mapState());
  };
  ctx.addEventListener("statechange", onStateChange);
  cleanups.push(() => ctx.removeEventListener("statechange", onStateChange));

  const unlock = (): Promise<boolean> => {
    if (disposed) return Promise.resolve(false);
    if (unlocked && ctx.state === "running") return Promise.resolve(true);
    if (unlocking) return unlocking;
    const attempt = (async (): Promise<boolean> => {
      try {
        if (ctx.state !== "running") {
          await withTimeout(
            ctx.resume(),
            UNLOCK_TIMEOUT_MS,
            () => new Error("oak: audio is locked (needs a user gesture)"),
          );
        }
        if (ctx.state !== "running") return false;
        initAudio ??= webaudio.initAudio({ maxPolyphony: 128 }) as Promise<void>;
        await initAudio;
        master.attachSuperdough();
        unlocked = true;
        audio.set(mapState());
        return true;
      } catch {
        return false; // not memoized: the next gesture retries
      }
    })();
    unlocking = attempt;
    void attempt.finally(() => {
      if (unlocking === attempt) unlocking = null;
    });
    return attempt;
  };

  if (options.autoUnlock ?? true) {
    const onGesture = (): void => {
      void unlock().then((ok) => {
        if (ok) for (const type of GESTURES) document.removeEventListener(type, onGesture, true);
      });
    };
    const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;
    for (const type of GESTURES) document.addEventListener(type, onGesture, true);
    cleanups.push(() => {
      for (const type of GESTURES) document.removeEventListener(type, onGesture, true);
    });
  }

  // --- logs ----------------------------------------------------------------------------------------
  const emitLog = (log: StrudelLog): void => {
    for (const cb of [...logListeners]) {
      try {
        cb(log);
      } catch (err) {
        console.warn("[oak] log listener failed", err);
      }
    }
  };
  const recentSkips = new Set<string>();
  const onLogLine = (message: string): void => {
    if (isNoise(message)) return;
    const log = parseStrudelLog(message, lastColdSound);
    if (log.skippedSound) {
      // A sound was not ready in time: warm it now (once per name and second) and tell the UI.
      const name = log.skippedSound.split(":")[0] as string;
      if (!recentSkips.has(name)) {
        recentSkips.add(name);
        setTimeout(() => recentSkips.delete(name), 1000);
        void preloadSpec({ sounds: [{ s: name }] });
      }
    }
    const missing = missingSoundOf(message);
    if (missing && !log.skippedSound) log.tag = "getTrigger";
    emitLog(log);
  };
  webaudio.setLogger((...args: unknown[]) => onLogLine(args.map(String).join(" ")));
  const onDocumentLog = (e: Event): void => {
    const detail = (e as CustomEvent<{ message?: unknown }>).detail;
    if (detail && typeof detail.message === "string") onLogLine(detail.message);
  };
  document.addEventListener("strudel.log", onDocumentLog);
  cleanups.push(() => document.removeEventListener("strudel.log", onDocumentLog));

  // --- panic key -----------------------------------------------------------------------------------
  if (options.panicKey ?? true) {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "." && (e.ctrlKey || e.metaKey || e.altKey)) {
        coordinator.panic();
      }
    };
    window.addEventListener("keydown", onKey, true);
    cleanups.push(() => window.removeEventListener("keydown", onKey, true));
  }

  // --- side-effect guards around mirror construction ------------------------------------------------
  let settingsApplied = false;
  let htmlClass = "";
  const beforeFirstMirror = (): void => {
    if (!settingsApplied) {
      // FULL object: a stale partial localStorage entry is not merged with defaults, and
      // isAutoCompletionEnabled:true would make Oak's appendConfig throw.
      codemirrorSettings.set({ ...OAK_CM_SETTINGS });
      settingsApplied = true;
    }
    htmlClass = document.documentElement.className;
  };
  const afterMirror = (): void => {
    // activateTheme() toggles `dark` on <html> and writes :root vars with !important: Oak's theme wins.
    if (document.documentElement.className !== htmlClass) document.documentElement.className = htmlClass;
    const vars = document.getElementById("strudel-theme-vars");
    if (vars && vars.textContent !== "") vars.textContent = "";
  };

  // --- runtime -------------------------------------------------------------------------------------
  const rt: Runtime = {
    ctx,
    mutex,
    toolbox: options.toolbox,
    vocabulary: buildVocabulary(options.toolbox),
    lint: (code: string, lintCtx: LintContext): LintResult => options.lint(code, lintCtx),
    prebake: () => prebakeOnce().then(() => undefined),
    unlock,
    unlocked: () => unlocked,
    coordinator,
    transport,
    master,
    scope,
    budget,
    editors,
    preload: (spec) => preloadSpec(spec),
    preloadPattern: (pattern, from, to) => preloadPattern(pattern, from, to),
    warmAhead: (pattern, from, to) => warmAhead(pattern, from, to),
    preloadValues: (values) => prebakeOnce().then(() => warmAll(values)),
    noteTrigger(value) {
      if (!value || typeof value !== "object") return;
      const key = soundKeyOf(value as { s?: unknown; bank?: unknown });
      if (key === null) return;
      const sound = webaudio.getSound(key) as { data?: { type?: string } } | undefined;
      if (sound?.data?.type === "soundfont") lastColdSound = key;
    },
    emitLog,
    disposed: () => disposed,
    calm: () => {
      try {
        return options.calmHighlight?.() === true;
      } catch {
        return false;
      }
    },
    beforeFirstMirror,
    afterMirror,
  };

  const recorder = createRecorder({
    ctx,
    tap: master.tap,
    tapGain: master.tapGain,
    transport,
    playing: () => transport.get().playing,
    onStart: () => ui.suppress("recording"),
  });

  const stopAll = (): void => coordinator.panic();

  const adapter: OakStrudel = {
    ctx,
    ready,
    unlock,
    audio: { get: audio.get, subscribe: audio.subscribe },
    createEditor: (root, opts) => {
      if (disposed) throw new Error("@oak/strudel: the adapter was disposed");
      return createEditor(rt, root, opts);
    },
    editors: editors as ReadonlyMap<string, EditorHandle>,
    transport,
    preload: async (spec, onProgress) => {
      await rt.prebake();
      return preloadSpec(spec, onProgress);
    },
    soundsIn,
    playEvents: (plan, opts) => playEvents(rt, plan, opts),
    playNote: (value) => playNote(rt, value),
    stopAll,
    master,
    recorder,
    createPatternPlayer: () => createPatternPlayer(rt),
    lint: (code, lintCtx) => options.lint(code, lintCtx),
    onLog(cb) {
      logListeners.add(cb);
      return () => {
        logListeners.delete(cb);
      };
    },
    sounds: () => soundNames(),
    dispose() {
      if (disposed) return;
      for (const editor of [...editors.values()]) editor.dispose();
      coordinator.stopAll();
      recorder.dispose();
      disposed = true;
      for (const fn of cleanups.splice(0)) fn();
      logListeners.clear();
      webaudio.setLogger((msg: unknown) => console.log(msg));
      ui.dispose();
      master.dispose();
      if (instance === adapter) instance = null;
    },
    coordinator,
    ui,
    scope,
    async packFiles() {
      const manifest = await prebakeOnce();
      const urls = await packFileUrls(options.soundsRoot, manifest);
      const out: { url: string; bytes: number }[] = new Array(urls.length);
      let next = 0;
      const worker = async (): Promise<void> => {
        for (let i = next++; i < urls.length; i = next++) {
          const url = urls[i] as string;
          let bytes = 0;
          try {
            const res = await fetch(url, { method: "HEAD" });
            bytes = Number(res.headers.get("content-length") ?? 0) || 0;
          } catch {
            bytes = 0;
          }
          out[i] = { url, bytes };
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      return out;
    },
  };
  instance = adapter;
  return adapter;
}

/** The adapter created by `createOakStrudel`. Throws before that. */
export function getOakStrudel(): OakStrudel {
  if (!instance) throw new Error("@oak/strudel: createOakStrudel() has not been called");
  return instance;
}
/** Tests only: forget the instance after disposing it. */
export function resetOakStrudelForTests(): void {
  instance?.dispose();
  instance = null;
}
/** An editor ID that satisfies the trailing-underscore rule: `oak_${slug}_${n}_`. */
export function editorId(slug: string, n = 0): string {
  return `oak_${slug.replace(/[^A-Za-z0-9]+/g, "-")}_${n}_`;
}
