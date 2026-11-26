// One transport over the source and the learner's pattern (ux §9 Transcription Studio: the mixer's
// "V original ⇄ mine", "O overlay"; wave4.md §3.4 `AbSwitch`). Switching sides keeps the musical position:
// both sides run together on one clock and the switch only changes what is heard.
//
//  - Pattern sources (ladder items): the reference (rebuilt from its events, `stimulus-code.ts`) and the
//    learner's code are ONE pattern in one hidden pattern player; a side is a mute of the other's tracks on the
//    playing pattern. Rate is a cps scale, transposition a live `note` shift, the A–B loop `.ribbon()` in bars.
//  - Own audio: the stretch engine plays the file; the learner's code plays in a hidden pattern player that
//    starts at a bar line, and the file is scheduled to start exactly when that bar sounds
//    (`timeOfCycle`, architecture §6.8 step 5). A side is the engine's gain or the pattern's mutes.
//
// Everything here takes its audio parts as arguments, so the rules are unit-tested with fakes.
import type { LintContext } from "@oak/content-kit";
import type { RealismSpec } from "@oak/strudel";
import type { SourceEngine } from "./engine.ts";
import {
  type BarGrid,
  barAt,
  barsOfLoop,
  clampRate,
  type Loop,
  loopInBars,
  loopOfBars,
  onBarLines,
  snapLoop,
} from "./grid.ts";
import { combinedCode, REF_PREFIX, type StimulusCode } from "./stimulus-code.ts";

export type Side = "source" | "mine" | "both";

export type MineStatus =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "error"; message: string }
  /** The code ran but has no labelled tracks the transport can switch to. */
  | { kind: "silent" };

export interface TransportState {
  kind: "audio" | "pattern";
  ready: boolean;
  playing: boolean;
  side: Side;
  /** Source seconds (pattern: bars · bar seconds). */
  time: number;
  durationS: number;
  rate: number;
  semitones: number;
  /** `null` for a pattern source: fine-tune is disabled there (contracts §6.12). */
  cents: number | null;
  loop: Loop | null;
  mine: MineStatus;
  /** Why "mine" cannot be heard now, when it cannot ("Set the tempo and the first downbeat …"). */
  mineBlocked: string | null;
  /** The realism the pattern source plays at (`null` for own audio); `realismApplied` false: played clean. */
  realism: number | null;
  realismApplied: boolean;
  /**
   * Wave 5: the reference's tracks (pattern sources; `[]` for own audio) and those muted for listening — "bass
   * only", "without melody" (song.ts `listenMutes`). Absent on a transport built before Wave 5.
   */
  sourceTracks?: readonly string[];
  sourceMuted?: readonly string[];
}

export interface TranscribeTransport {
  readonly kind: "audio" | "pattern";
  readonly state: TransportState;
  readonly canSeek: boolean;
  subscribe(cb: (s: TransportState) => void): () => void;
  play(): Promise<void>;
  pause(): void;
  toggle(): Promise<void>;
  seek(s: number): void;
  setRate(r: number): void;
  setSemitones(st: number): void;
  setCents(c: number): void;
  setLoop(loop: Loop | null): void;
  setSide(side: Side): void;
  /** Wave 5: mute these reference tracks while the source plays (pattern sources; own audio ignores it). */
  setSourceMutes(tracks: readonly string[]): void;
  /** The learner's code to compare with; reloaded on the next play (and at once while playing). */
  setMineCode(code: string): Promise<void>;
  /** Own audio: the bar grid from the tempo and the first downbeat changed (the next play uses it). */
  setGrid(grid: BarGrid | null): void;
  dispose(): void;
}

/** The part of @oak/strudel's `PatternPlayer` the transport drives (a structural copy, for fakes). */
export interface PatternPlayerPort {
  load(
    code: string,
    opts: { bars: number; cps: number; lint?: LintContext },
  ): Promise<{ ok: boolean; tracks: string[]; diagnostics: { message: string }[] }>;
  play(): Promise<void>;
  stop(): void;
  setRate(rate: number): void;
  setTranspose(semitones: number): void;
  setLoop(loop: { fromBar: number; bars: number } | null): void;
  setEnd(bar: number | null): void;
  setMutes(mutes: { muted: ReadonlySet<string>; solo: string | null }): void;
  setRealism(spec: RealismSpec): void;
  position(): number;
  readonly playing: boolean;
  dispose(): void;
}

/** The file is scheduled at least this far ahead of the clock. */
const START_MARGIN_SEC = 0.03;
/** Source seconds the stretch starts before the bar (`@oak/audio` `AB_PRE_ROLL_SEC`). */
const PRE_ROLL_SEC = 0.1;
/**
 * How often a start that came too late for the pattern's first bar is taken again (d10) before the file joins
 * the pattern part-way: both sides then begin at bar 0 together, a little later, instead of the recording
 * coming in after its own first beat.
 */
export const LATE_START_RETRIES = 2;

/**
 * Where the stretch starts so that `fromS` sounds on time: `pre` source seconds before it. Inside a loop the run-up
 * is the loop's own end (the stretch wraps from it into the loop start), never the audio before the loop: the
 * stretch would move such a start to the loop start and play the whole pass `pre / rate` early.
 */
export function preRoll(want: number, fromS: number, loop: Loop | null): { pre: number; from: number } {
  if (!loop) {
    const pre = Math.max(0, Math.min(want, fromS));
    return { pre, from: fromS - pre };
  }
  const len = loop.endS - loop.startS;
  const pre = Math.max(0, Math.min(want, len / 2));
  const from = fromS - pre;
  return { pre, from: from >= loop.startS - 1e-9 ? from : loop.endS - (loop.startS - from) };
}

const mutes = (muted: Iterable<string>) => ({ muted: new Set(muted), solo: null });
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function store(initial: TransportState) {
  let state = initial;
  const subs = new Set<(s: TransportState) => void>();
  return {
    get: () => state,
    set(patch: Partial<TransportState>) {
      state = { ...state, ...patch };
      for (const cb of [...subs]) cb(state);
    },
    subscribe(cb: (s: TransportState) => void) {
      subs.add(cb);
      cb(state);
      return () => {
        subs.delete(cb);
      };
    },
    clear: () => subs.clear(),
  };
}

const firstMessage = (d: { message: string }[]) => d[0]?.message ?? "The code didn't run.";

// --- pattern sources -----------------------------------------------------------------------------------

export interface PatternTransportDeps {
  player: PatternPlayerPort;
  ref: StimulusCode;
  bars: number;
  /** The item's tempo at rate 1. */
  cps: number;
  realism?: RealismSpec | null;
  /** Position polling while playing, ms. Default 50. */
  pollMs?: number;
  setInterval?: (cb: () => void, ms: number) => unknown;
  clearInterval?: (t: unknown) => void;
  /** How the hidden player lints the code it plays (default: the player's own). */
  lint?: LintContext;
}

export async function createPatternTransport(d: PatternTransportDeps): Promise<TranscribeTransport> {
  const barSec = 1 / d.cps;
  const grid: BarGrid = { downbeatS: 0, barSec };
  const st = store({
    kind: "pattern",
    ready: false,
    playing: false,
    side: "source",
    time: 0,
    durationS: d.bars * barSec,
    rate: 1,
    semitones: 0,
    cents: null,
    loop: null,
    mine: { kind: "none" },
    mineBlocked: "Write some code first: A/B compares it with the source.",
    realism: d.realism?.level ?? 0,
    realismApplied: true,
    sourceTracks: d.ref.tracks,
    sourceMuted: [],
  });
  const si = d.setInterval ?? ((cb: () => void, ms: number) => setInterval(cb, ms));
  const ci = d.clearInterval ?? ((t: unknown) => clearInterval(t as ReturnType<typeof setInterval>));
  let mineTracks: string[] = [];
  let mineCode: string | null = null;
  let loadedCode: string | null = null;
  let timer: unknown = null;
  let disposed = false;

  const applyMutes = () => {
    const side = st.get().side;
    const refMuted = side === "mine" ? d.ref.tracks : (st.get().sourceMuted ?? []);
    const mineMuted = side === "source" ? mineTracks : [];
    d.player.setMutes(mutes([...refMuted, ...mineMuted]));
  };

  /** Loads the reference with the learner's code; when the learner's code fails, the reference alone. */
  const load = async (): Promise<void> => {
    const want = mineCode?.trim() ? combinedCode(d.ref, mineCode as string) : d.ref.code;
    if (want === loadedCode) return;
    if (mineCode !== null) st.set({ mine: { kind: "loading" } });
    const opts = { bars: d.bars, cps: d.cps, ...(d.lint ? { lint: d.lint } : {}) };
    let out = await d.player.load(want, opts);
    if (disposed) return;
    if (!out.ok && want !== d.ref.code) {
      const message = firstMessage(out.diagnostics);
      out = await d.player.load(d.ref.code, opts);
      loadedCode = out.ok ? d.ref.code : null;
      mineTracks = [];
      st.set({
        mine: { kind: "error", message },
        mineBlocked: "Your code didn't run, so only the source plays.",
      });
    } else {
      loadedCode = out.ok ? want : null;
      mineTracks = out.tracks.filter((t) => !t.startsWith(REF_PREFIX));
      if (mineCode === null || !mineCode.trim()) st.set({ mine: { kind: "none" } });
      else if (mineTracks.length === 0)
        st.set({
          mine: { kind: "silent" },
          mineBlocked: "Name your lines (kick: …, bass: …) so A/B can switch to them.",
        });
      else st.set({ mine: { kind: "ok" }, mineBlocked: null });
    }
    if (!out.ok) throw new Error(firstMessage(out.diagnostics));
    if (st.get().mineBlocked !== null && st.get().side !== "source") st.set({ side: "source" });
    applyMutes();
  };

  const stopPolling = () => {
    if (timer !== null) ci(timer);
    timer = null;
  };
  const poll = () => {
    if (!d.player.playing) {
      stopPolling();
      if (st.get().playing) st.set({ playing: false });
      return;
    }
    const bar = d.player.position();
    // Once through, then the item ends at its last bar (an A–B loop plays until it is stopped). The next play
    // starts again from bar 1.
    if (st.get().loop === null && bar >= d.bars) {
      pause();
      st.set({ time: 0 });
      return;
    }
    st.set({ time: clamp(bar * barSec, 0, st.get().durationS) });
  };

  async function play(): Promise<void> {
    if (disposed) return;
    await load();
    await d.player.play();
    st.set({ playing: true });
    stopPolling();
    timer = si(poll, d.pollMs ?? 50);
  }
  function pause(): void {
    d.player.stop();
    stopPolling();
    st.set({ playing: false });
  }

  // The hidden pattern repeats for as long as it runs: past the item's last bar nothing more is sent.
  d.player.setEnd(d.bars);
  await load();
  if (d.realism && d.realism.level > 0) {
    try {
      d.player.setRealism(d.realism);
    } catch {
      // Realism layers are the sound engineer's (wave4.md §3.5); until they land the item plays clean.
      st.set({ realismApplied: false });
    }
  }
  st.set({ ready: true });

  return {
    kind: "pattern",
    canSeek: false,
    get state() {
      return st.get();
    },
    subscribe: st.subscribe,
    play,
    pause,
    async toggle() {
      if (st.get().playing) pause();
      else await play();
    },
    seek() {},
    setRate(r) {
      const rate = clampRate(r);
      d.player.setRate(rate);
      st.set({ rate });
    },
    setSemitones(s) {
      const semitones = Math.round(clamp(s, -12, 12));
      d.player.setTranspose(semitones);
      st.set({ semitones });
    },
    setCents() {},
    setLoop(loop) {
      if (!loop) {
        d.player.setLoop(null);
        st.set({ loop: null });
        return;
      }
      const b = snapLoop(loop, grid);
      const bars = Math.min(b.bars, d.bars - Math.min(b.fromBar, d.bars - 1));
      const fromBar = Math.min(b.fromBar, d.bars - 1);
      d.player.setLoop({ fromBar, bars });
      st.set({ loop: loopOfBars(grid, fromBar, bars) });
    },
    setSide(side) {
      st.set({ side: st.get().mineBlocked !== null ? "source" : side });
      applyMutes();
    },
    setSourceMutes(tracks) {
      const known = new Set(d.ref.tracks);
      st.set({ sourceMuted: tracks.filter((t) => known.has(t)) });
      applyMutes();
    },
    async setMineCode(code) {
      mineCode = code;
      // Read the tracks now (and swap the playing pattern), so the A/B switch knows whether it can play "mine".
      await load().catch(() => {});
    },
    setGrid() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      stopPolling();
      d.player.stop();
      d.player.dispose();
      st.clear();
    },
  };
}

// --- own audio -------------------------------------------------------------------------------------------

export interface AudioTransportDeps {
  engine: SourceEngine;
  /** A hidden pattern player for the learner's code (created on first use). */
  createMine: () => PatternPlayerPort;
  /** AudioContext time at which cycle `c` of the playing pattern sounds (`OakStrudel.transport.timeOfCycle`). */
  timeOfCycle: (cycle: number) => number;
  /** The active pattern's position in cycles (`OakStrudel.transport.cycle`). */
  cycle: () => number;
  now: () => number;
  grid: BarGrid | null;
  /**
   * A wait between the pattern's start and reading its clock, for a scheduler whose clock is not set by the time
   * `play()` resolves. Oak's is (the first tick runs inside `start()`), so the app passes none: any wait here is
   * time a busy page can stretch past the pattern's first bar (d10).
   */
  settle?: () => Promise<void>;
  /** How the hidden player lints the learner's code (default: the player's own). */
  lint?: LintContext;
  /** Position polling while playing, ms (the engine reports changes, not the running playhead). Default 50. */
  pollMs?: number;
  setInterval?: (cb: () => void, ms: number) => unknown;
  clearInterval?: (t: unknown) => void;
  /**
   * Oak's playback coordinator: only one source plays (ux §2.1). The file alone claims as an external source; with
   * the pattern beside it the pattern player holds the claim, and anything else taking it (an editor's Play, the
   * panic key) stops the file too.
   */
  coordinator?: {
    claim(source: { id: string; kind: "external"; stop(): void }): () => void;
    get(): { activeId: string | null };
    subscribe(cb: (s: { activeId: string | null }) => void): () => void;
  };
}

export function createAudioTransport(d: AudioTransportDeps): TranscribeTransport {
  let grid = d.grid;
  const e = d.engine;
  const noGrid = "Set the tempo and the first downbeat (Tap tempo) so your bars line up with the recording.";
  const st = store({
    kind: "audio",
    ready: e.state.loaded,
    playing: false,
    side: "source",
    time: e.state.time,
    durationS: e.state.durationS,
    rate: e.state.rate,
    semitones: e.state.semitones,
    cents: e.state.cents,
    loop: e.state.loop,
    mine: { kind: "none" },
    mineBlocked: grid ? "Write some code first: A/B compares it with the recording." : noGrid,
    realism: null,
    realismApplied: true,
    sourceTracks: [],
    sourceMuted: [],
  });
  let mine: PatternPlayerPort | null = null;
  let mineCode: string | null = null;
  let loadedCode: string | null = null;
  let mineTracks: string[] = [];
  let mineRunning = false;
  let wantLoop: Loop | null = e.state.loop;
  let disposed = false;
  let generation = 0;

  const offEngine = e.subscribe((s) => {
    const patch: Partial<TransportState> = {
      time: s.time,
      durationS: s.durationS,
      rate: s.rate,
      semitones: s.semitones,
      cents: s.cents,
      ready: s.loaded,
    };
    st.set(patch);
  });
  const si = d.setInterval ?? ((cb: () => void, ms: number) => setInterval(cb, ms));
  const ci = d.clearInterval ?? ((t: unknown) => clearInterval(t as ReturnType<typeof setInterval>));
  let poller: unknown = null;
  let startsAt: { ctx: number; fromS: number } | null = null;
  const stopPoll = () => {
    if (poller !== null) ci(poller);
    poller = null;
  };
  const startPoll = () => {
    stopPoll();
    poller = si(() => {
      const s = e.state;
      if (!s.playing && st.get().playing) {
        // The file ended (no loop), or someone else took the speakers: stop the pattern too.
        stopAll();
        st.set({ playing: false, time: s.time });
        return;
      }
      // Until the file sounds, the playhead waits where it will start (never a time before it).
      st.set({ time: startsAt && d.now() < startsAt.ctx ? startsAt.fromS : s.time });
    }, d.pollMs ?? 50);
  };

  const blockedReason = (): string | null => {
    if (!grid) return noGrid;
    const m = st.get().mine;
    if (m.kind === "error") return "Your code didn't run, so only the recording plays.";
    if (m.kind === "silent") return "Name your lines (bass: …, melody: …) so A/B can switch to them.";
    if (mineCode === null || !mineCode.trim())
      return "Write some code first: A/B compares it with the recording.";
    return null;
  };

  const loadMine = async (): Promise<boolean> => {
    if (!grid || mineCode === null || !mineCode.trim()) return false;
    if (mineCode === loadedCode && mineTracks.length > 0) return true;
    mine ??= d.createMine();
    st.set({ mine: { kind: "loading" } });
    const out = await mine.load(mineCode, {
      bars: 1024,
      cps: 1 / grid.barSec,
      ...(d.lint ? { lint: d.lint } : {}),
    });
    if (disposed) return false;
    if (!out.ok) {
      loadedCode = null;
      mineTracks = [];
      st.set({ mine: { kind: "error", message: firstMessage(out.diagnostics) } });
    } else {
      loadedCode = mineCode;
      mineTracks = out.tracks;
      st.set({ mine: mineTracks.length ? { kind: "ok" } : { kind: "silent" } });
    }
    st.set({ mineBlocked: blockedReason() });
    return out.ok && mineTracks.length > 0;
  };

  const applySide = () => {
    const side = st.get().side;
    e.setGain(side === "mine" ? 0 : 1);
    mine?.setMutes(mutes(side === "source" ? mineTracks : []));
  };

  /**
   * The loop the engine plays: the one the learner marked (half a beat stays half a beat). With the pattern beside
   * it, the pattern loops the same span in (fractional) bars, so both sides wrap together; a loop on the bar lines
   * (within `ON_LINE_SEC`) is played on exactly those lines by both, so the two passes have one length.
   */
  const engineLoop = (withMine: boolean): Loop | null => {
    if (!wantLoop || !withMine || !grid || !onBarLines(wantLoop, grid)) return wantLoop;
    const b = barsOfLoop(wantLoop, grid);
    return loopOfBars(grid, b.fromBar, b.bars);
  };

  const stopAll = () => {
    generation++;
    stopPoll();
    owner = null;
    const r = release;
    release = null;
    r?.();
    mineRunning = false;
    mine?.stop();
    e.pause();
  };

  const start = async (): Promise<void> => {
    const gen = ++generation;
    const withMine = (await loadMine()) && grid !== null;
    if (gen !== generation || disposed) return;
    const from = e.state.time;
    if (!withMine || !grid || !mine) {
      st.set({ side: "source" });
      applySide();
      e.setLoop(engineLoop(false));
      await e.play({ fromS: from });
      release = d.coordinator?.claim({ id: "transcribe-source", kind: "external", stop: halt }) ?? null;
      owner = "transcribe-source";
      st.set({ playing: true });
      startPoll();
      return;
    }
    // The pattern starts at a bar line; the file is scheduled to sound that same bar at the same moment.
    const loop = engineLoop(true);
    const lb = loop ? loopInBars(loop, grid) : null;
    let bar0 = Math.max(0, Math.floor(barAt(grid, from) + 1e-6));
    if (lb && (bar0 < lb.fromBar || bar0 >= lb.fromBar + lb.bars)) bar0 = lb.fromBar;
    mine.setRate(st.get().rate);
    mine.setTranspose(st.get().semitones);
    mine.setLoop(lb ? { fromBar: lb.fromBar, bars: lb.bars } : { fromBar: bar0, bars: 1024 });
    applySide();
    // Both sides start from ONE moment in the near future: the pattern's first bar (cycle 0, which the scheduler
    // puts its latency ahead of the clock, about 0.11 s). The file is scheduled for that moment in the same turn
    // as the pattern's start, with nothing awaited in between that could let a busy page in (d10: a 60 ms timer
    // stood here, and a page busy for longer than its slack left the file to join part-way into bar 0 without
    // its run-up). Should the moment be (nearly) gone all the same (the clock moved on while the scheduler
    // started), the pattern is started again, so the code and the recording still begin together at bar 0.
    let t0 = 0;
    for (let attempt = 0; ; attempt++) {
      await mine.play();
      mineRunning = true;
      if (d.settle) await d.settle();
      if (gen !== generation || disposed) return;
      t0 = d.timeOfCycle(0);
      if (t0 - d.now() >= START_MARGIN_SEC || attempt >= LATE_START_RETRIES) break;
      mine.stop();
      mineRunning = false;
    }
    // Still late after starting again (a page that stays busy): the file joins the pattern where it is, part-way
    // into the bar, so it neither skips a bar of the recording nor lags the code for the rest of the take.
    const cycleSec = d.timeOfCycle(1) - t0;
    const earliest = d.now() + START_MARGIN_SEC;
    const c = t0 >= earliest || !(cycleSec > 0) ? 0 : (earliest - t0) / cycleSec;
    const at = c === 0 ? t0 : earliest;
    // With a loop, cycle c is loop bar (c mod bars); without, bar0 + c. (A loop of a third of a bar: 1 mod ⅓ comes
    // out a hair under ⅓ in floating point, which is the loop's start, not its end.)
    const within = lb ? ((c % lb.bars) + lb.bars) % lb.bars : 0;
    const bar = lb ? lb.fromBar + (lb.bars - within < 1e-9 ? 0 : within) : bar0 + c;
    const fromS = grid.downbeatS + bar * grid.barSec;
    e.setLoop(loop);
    // The stretch fades its first window in from silence: started a little earlier on the same line (as the A/B
    // switch of @oak/audio does), it is already running when the bar comes.
    const startAt = Math.max(at, d.now());
    const room = Math.max(0, (startAt - d.now() - 0.01) * st.get().rate);
    const run = preRoll(e.impl === "stretch" ? Math.min(PRE_ROLL_SEC, room) : 0, fromS, loop);
    await e.play({ at: startAt - run.pre / st.get().rate, fromS: run.from });
    startsAt = { ctx: at, fromS };
    owner = d.coordinator?.get().activeId ?? null;
    st.set({ playing: true, time: fromS });
    startPoll();
  };
  /** Something else took the speakers: stop where we are. */
  function halt(): void {
    stopAll();
    st.set({ playing: false });
  }
  let release: (() => void) | null = null;
  let owner: string | null = null;
  const offCoordinator =
    d.coordinator?.subscribe((c) => {
      if (st.get().playing && owner !== null && c.activeId !== owner) halt();
    }) ?? (() => {});

  return {
    kind: "audio",
    canSeek: true,
    get state() {
      return st.get();
    },
    subscribe: st.subscribe,
    play: start,
    pause() {
      stopAll();
      st.set({ playing: false });
    },
    async toggle() {
      if (st.get().playing) {
        stopAll();
        st.set({ playing: false });
      } else await start();
    },
    seek(s) {
      const was = st.get().playing;
      if (was && mineRunning) {
        stopAll();
        e.seek(s);
        void start();
      } else e.seek(s);
    },
    setRate(r) {
      const rate = clampRate(r);
      if (st.get().playing && mineRunning) {
        // Both sides must change speed on the same bar: restart in step.
        stopAll();
        e.setRate(rate);
        st.set({ rate });
        void start();
        return;
      }
      e.setRate(rate);
      mine?.setRate(rate);
      st.set({ rate });
    },
    setSemitones(s) {
      const semitones = Math.round(clamp(s, -12, 12));
      e.setSemitones(semitones);
      mine?.setTranspose(semitones);
      st.set({ semitones });
    },
    setCents(c) {
      e.setCents(clamp(c, -50, 50));
      st.set({ cents: clamp(c, -50, 50) });
    },
    setLoop(loop) {
      wantLoop = loop;
      st.set({ loop });
      if (st.get().playing && mineRunning) {
        stopAll();
        if (loop) e.seek(loop.startS);
        void start();
        return;
      }
      e.setLoop(engineLoop(false));
    },
    setSide(side) {
      const blocked = blockedReason();
      st.set({ side: blocked ? "source" : side, mineBlocked: blocked });
      if (!blocked && st.get().playing && !mineRunning && side !== "source") {
        // Playing the recording alone: bring the pattern in on the next bar.
        stopAll();
        void start();
        return;
      }
      applySide();
    },
    setSourceMutes() {},
    async setMineCode(code) {
      mineCode = code;
      st.set({ mineBlocked: blockedReason() });
      await loadMine();
      st.set({ mineBlocked: blockedReason() });
      if (st.get().mineBlocked) {
        st.set({ side: "source" });
        applySide();
      }
    },
    setGrid(g) {
      const same = g && grid && g.barSec === grid.barSec && g.downbeatS === grid.downbeatS;
      if (same || (!g && !grid)) return;
      const was = st.get().playing && mineRunning;
      if (was) stopAll();
      grid = g;
      loadedCode = null;
      st.set({ mineBlocked: blockedReason() });
      if (was) void start();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopAll();
      offEngine();
      offCoordinator();
      mine?.dispose();
      e.dispose();
      st.clear();
    },
  };
}
