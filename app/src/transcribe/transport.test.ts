// The A/B transport's rules with fake audio parts: sides are mutes (pattern) or gains (own audio) on sides that
// run together, the position is kept, a failing learner code never silences the source, and own audio starts
// the file on the bar the pattern starts on.
import { describe, expect, test } from "bun:test";
import { realismSpec } from "@oak/strudel";
import type { SourceEngine, SourceEngineState } from "./engine.ts";
import {
  createAudioTransport,
  createPatternTransport,
  LATE_START_RETRIES,
  type PatternPlayerPort,
  preRoll,
} from "./transport.ts";

function fakePlayer() {
  const calls: string[] = [];
  let pos = 0;
  let playing = false;
  let mutes: ReadonlySet<string> = new Set();
  let realismThrows = true;
  const p: PatternPlayerPort & {
    calls: string[];
    mutes(): ReadonlySet<string>;
    setPos(n: number): void;
    realismOk(): void;
    code: string;
  } = {
    calls,
    code: "",
    async load(code, opts) {
      p.code = code;
      calls.push(`load:${opts.cps.toFixed(3)}`);
      if (code.includes("BROKEN"))
        return { ok: false, tracks: [], diagnostics: [{ message: "Unexpected token" }] };
      const tracks = [...code.matchAll(/^([A-Za-z_][\w]*):/gm)].map((m) => m[1] as string);
      return { ok: true, tracks, diagnostics: [] };
    },
    async play() {
      playing = true;
      calls.push("play");
    },
    stop() {
      playing = false;
      calls.push("stop");
    },
    setRate: (r) => calls.push(`rate:${r}`),
    setTranspose: (s) => calls.push(`transpose:${s}`),
    setLoop: (l) => calls.push(`loop:${l ? `${l.fromBar}+${l.bars}` : "off"}`),
    setEnd: (b) => calls.push(`end:${b ?? "off"}`),
    setMutes: (m) => {
      mutes = m.muted;
    },
    setRealism(spec) {
      if (realismThrows && spec.level > 0) throw new Error("not built");
      calls.push(`realism:${spec.level}`);
    },
    position: () => pos,
    get playing() {
      return playing;
    },
    dispose: () => calls.push("dispose"),
    mutes: () => mutes,
    setPos: (n) => {
      pos = n;
    },
    realismOk: () => {
      realismThrows = false;
    },
  };
  return p;
}

const REF = { code: 'ref_kick: s("bd ~ ~ ~")\nref_hats: s("hh*8")', tracks: ["ref_kick", "ref_hats"] };
const manualTimers = () => {
  let cb: (() => void) | null = null;
  return {
    setInterval: (f: () => void) => {
      cb = f;
      return 1;
    },
    clearInterval: () => {
      cb = null;
    },
    tick: () => cb?.(),
  };
};

describe("pattern transport", () => {
  test("A/B is a mute switch on one pattern: the position is kept", async () => {
    const player = fakePlayer();
    const timers = manualTimers();
    const t = await createPatternTransport({ player, ref: REF, bars: 2, cps: 0.4, ...timers });
    await t.setMineCode('kick: s("bd ~ bd ~")');
    expect(player.code).toContain("ref_kick");
    expect(player.code).toContain("kick: s(");
    expect(t.state.mine.kind).toBe("ok");
    expect([...player.mutes()]).toEqual(["kick"]);
    await t.play();
    player.setPos(1.5);
    timers.tick();
    expect(t.state.time).toBeCloseTo(1.5 / 0.4, 6);
    const loads = player.calls.filter((c) => c.startsWith("load")).length;
    t.setSide("mine");
    expect([...player.mutes()].sort()).toEqual(["ref_hats", "ref_kick"]);
    t.setSide("both");
    expect([...player.mutes()]).toEqual([]);
    // No reload, no restart: still playing at the same place.
    expect(player.calls.filter((c) => c.startsWith("load")).length).toBe(loads);
    expect(player.calls.filter((c) => c === "play")).toHaveLength(1);
    expect(t.state.playing).toBe(true);
  });

  test("played once through: the item stops at its last bar and the next play starts from bar 1", async () => {
    const player = fakePlayer();
    const timers = manualTimers();
    const t = await createPatternTransport({ player, ref: REF, bars: 2, cps: 0.5, ...timers });
    // The pattern itself sends nothing past the item's end (the scheduler's look-ahead never reaches a repeat).
    expect(player.calls).toContain("end:2");
    await t.play();
    player.setPos(1.9);
    timers.tick();
    expect(t.state.playing).toBe(true);
    expect(t.state.time).toBeCloseTo(3.8, 6);
    player.setPos(2.02);
    timers.tick();
    expect(t.state.playing).toBe(false);
    expect(player.playing).toBe(false);
    expect(t.state.time).toBe(0);
    // Polling stopped with the take: a later tick changes nothing.
    player.setPos(3);
    timers.tick();
    expect(t.state.time).toBe(0);
  });

  test("with an A–B loop the item plays on past its last bar until it is stopped", async () => {
    const player = fakePlayer();
    const timers = manualTimers();
    const t = await createPatternTransport({ player, ref: REF, bars: 4, cps: 0.5, ...timers });
    t.setLoop({ startS: 4, endS: 8 });
    await t.play();
    // The player reports the bar within the loop; the take has run past four bars of the scheduler's clock.
    player.setPos(3.5);
    timers.tick();
    expect(t.state.playing).toBe(true);
    expect(player.playing).toBe(true);
  });

  test("listening to one layer mutes the others on the source side only, without a reload", async () => {
    const player = fakePlayer();
    const t = await createPatternTransport({ player, ref: REF, bars: 2, cps: 0.4 });
    await t.setMineCode('kick: s("bd ~ bd ~")');
    const loads = player.calls.filter((c) => c.startsWith("load")).length;
    expect(t.state.sourceTracks).toEqual(["ref_kick", "ref_hats"]);
    t.setSourceMutes(["ref_hats", "ref_nope"]);
    expect(t.state.sourceMuted).toEqual(["ref_hats"]);
    expect([...player.mutes()].sort()).toEqual(["kick", "ref_hats"]);
    t.setSide("both");
    expect([...player.mutes()]).toEqual(["ref_hats"]);
    // "Mine" still mutes the whole source.
    t.setSide("mine");
    expect([...player.mutes()].sort()).toEqual(["ref_hats", "ref_kick"]);
    t.setSide("source");
    t.setSourceMutes([]);
    expect([...player.mutes()]).toEqual(["kick"]);
    expect(player.calls.filter((c) => c.startsWith("load")).length).toBe(loads);
  });

  test("broken learner code never silences the source", async () => {
    const player = fakePlayer();
    const t = await createPatternTransport({ player, ref: REF, bars: 2, cps: 0.4 });
    await t.setMineCode('kick: s("bd BROKEN');
    expect(t.state.mine).toEqual({ kind: "error", message: "Unexpected token" });
    expect(player.code).toBe(REF.code);
    t.setSide("mine");
    expect(t.state.side).toBe("source");
    expect(t.state.mineBlocked).toContain("didn't run");
  });

  test("unlabelled code cannot be switched to", async () => {
    const player = fakePlayer();
    const t = await createPatternTransport({ player, ref: REF, bars: 2, cps: 0.4 });
    await t.setMineCode('s("bd ~ ~ ~")');
    expect(t.state.mine.kind).toBe("silent");
    expect(t.state.mineBlocked).toContain("Name your lines");
  });

  test("rate, transposition and a loop in whole bars; fine-tune is off", async () => {
    const player = fakePlayer();
    const t = await createPatternTransport({ player, ref: REF, bars: 4, cps: 0.5 });
    t.setRate(0.75);
    t.setSemitones(-3);
    t.setCents(20);
    t.setLoop({ startS: 2.2, endS: 5.1 });
    expect(player.calls).toContain("rate:0.75");
    expect(player.calls).toContain("transpose:-3");
    expect(player.calls).toContain("loop:1+2");
    expect(t.state.loop).toEqual({ startS: 2, endS: 6 });
    expect(t.state.cents).toBeNull();
    t.setLoop({ startS: 7, endS: 20 });
    expect(player.calls.at(-1)).toBe("loop:3+1");
  });

  test("realism: applied when the player has it, clean (and said so) when not", async () => {
    const a = await createPatternTransport({
      player: fakePlayer(),
      ref: REF,
      bars: 2,
      cps: 0.4,
      realism: realismSpec(2, { seed: 3 }),
    });
    expect(a.state.realism).toBe(2);
    expect(a.state.realismApplied).toBe(false);
    const p = fakePlayer();
    p.realismOk();
    const b = await createPatternTransport({
      player: p,
      ref: REF,
      bars: 2,
      cps: 0.4,
      realism: realismSpec(2),
    });
    expect(b.state.realismApplied).toBe(true);
    expect(p.calls).toContain("realism:2");
  });
});

function fakeEngine(durationS = 20, impl: SourceEngine["impl"] = "transcription") {
  const calls: string[] = [];
  let state: SourceEngineState = {
    loaded: true,
    playing: false,
    time: 0,
    durationS,
    rate: 1,
    semitones: 0,
    cents: 0,
    loop: null,
  };
  const subs = new Set<(s: SourceEngineState) => void>();
  const set = (p: Partial<SourceEngineState>) => {
    state = { ...state, ...p };
    for (const cb of subs) cb(state);
  };
  const e: SourceEngine & { calls: string[]; gain: number } = {
    calls,
    gain: 1,
    impl,
    buffer: {} as AudioBuffer,
    get state() {
      return state;
    },
    async play(o = {}) {
      calls.push(`play:${o.at?.toFixed(3) ?? "now"}@${(o.fromS ?? state.time).toFixed(3)}`);
      set({ playing: true, time: o.fromS ?? state.time });
    },
    pause() {
      calls.push("pause");
      set({ playing: false });
    },
    seek(s) {
      set({ time: s });
    },
    setRate(r) {
      set({ rate: r });
    },
    setSemitones(s) {
      set({ semitones: s });
    },
    setCents(c) {
      set({ cents: c });
    },
    setLoop(l) {
      calls.push(`loop:${l ? `${l.startS}-${l.endS}` : "off"}`);
      set({ loop: l });
    },
    setGain(g) {
      e.gain = g;
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    dispose() {},
  };
  return e;
}

describe("own-audio transport", () => {
  const grid = { downbeatS: 0.5, barSec: 2 };

  test("without a grid only the recording plays, and A/B says why", async () => {
    const engine = fakeEngine();
    const t = createAudioTransport({
      engine,
      createMine: fakePlayer,
      timeOfCycle: (c) => c,
      cycle: () => 0,
      now: () => 0,
      grid: null,
    });
    await t.setMineCode('bass: n("0")');
    t.setSide("mine");
    expect(t.state.side).toBe("source");
    expect(t.state.mineBlocked).toContain("Tap tempo");
    await t.play();
    expect(engine.calls).toContain("play:now@0.000");
  });

  test("the file starts on the bar the pattern starts on", async () => {
    const engine = fakeEngine();
    const mine = fakePlayer();
    const t = createAudioTransport({
      engine,
      createMine: () => mine,
      // cycle 0 sounds at ctx 10 s, 0.2 s from now; one cycle = 2 s (the bar).
      timeOfCycle: (c) => 10 + c * 2,
      cycle: () => 0.3,
      now: () => 9.8,
      grid,
    });
    await t.setMineCode('bass: n("0 2").scale("C2:major")');
    engine.seek(4.6); // bar 2 (0-based) is 4.5–6.5
    t.setSide("both");
    await t.play();
    // The pattern was told to start at bar 2; cycle 0 sounds at 10 s and is bar 2 → source 4.5 s.
    expect(mine.calls).toContain("loop:2+1024");
    expect(engine.calls.at(-1)).toBe("play:10.000@4.500");
    expect(mine.calls.find((c) => c.startsWith("load"))).toBe("load:0.500");
    // A switch is a gain and a mute: nothing restarts.
    const plays = engine.calls.filter((c) => c.startsWith("play")).length;
    t.setSide("mine");
    expect(engine.gain).toBe(0);
    expect([...mine.mutes()]).toEqual([]);
    t.setSide("source");
    expect(engine.gain).toBe(1);
    expect([...mine.mutes()]).toEqual(["bass"]);
    expect(engine.calls.filter((c) => c.startsWith("play")).length).toBe(plays);
  });

  test("the stretch engine starts 0.1 s of source early on the same line (its fade-in is over by the bar)", async () => {
    const engine = fakeEngine(20, "stretch");
    const mine = fakePlayer();
    const t = createAudioTransport({
      engine,
      createMine: () => mine,
      timeOfCycle: (c) => 10 + c * 2,
      cycle: () => 0.3,
      now: () => 9.8,
      grid,
    });
    await t.setMineCode('bass: n("0 2").scale("C2:major")');
    engine.seek(4.6);
    t.setRate(0.75);
    t.setSide("both");
    await t.play();
    // Bar 2 (source 4.5 s) sounds at 10 s: the stretch starts 0.1 s of source earlier, 0.1 / 0.75 s earlier.
    expect(engine.calls.at(-1)).toBe(`play:${(10 - 0.1 / 0.75).toFixed(3)}@4.400`);
  });

  test("a loop on bar lines runs in whole bars on both sides while the pattern plays beside the file", async () => {
    const engine = fakeEngine();
    const mine = fakePlayer();
    const t = createAudioTransport({
      engine,
      createMine: () => mine,
      timeOfCycle: (c) => 0.2 + c * 2,
      cycle: () => 0,
      now: () => 0,
      grid,
    });
    await t.setMineCode('bass: n("0")');
    t.setLoop({ startS: 2.5, endS: 6.5 }); // bars 1–2 of the grid (0-based)
    t.setSide("both");
    await t.play();
    expect(mine.calls).toContain("loop:1+2");
    expect(engine.calls).toContain("loop:2.5-6.5");
    // cycle 0 is the loop's first bar → 2.5 s.
    expect(engine.calls.at(-1)).toBe("play:0.200@2.500");
  });

  test("a bar loop a few ms off its lines (bar 1 nudged since) is played on the lines by both sides", async () => {
    const engine = fakeEngine();
    const mine = fakePlayer();
    const t = createAudioTransport({
      engine,
      createMine: () => mine,
      timeOfCycle: (c) => c * 2,
      cycle: () => 0,
      now: () => 0,
      grid,
    });
    await t.setMineCode('bass: n("0")');
    t.setLoop({ startS: 4.51, endS: 6.51 });
    t.setSide("both");
    await t.play();
    expect(mine.calls).toContain("loop:2+1");
    expect(engine.calls).toContain("loop:4.5-6.5");
  });

  // Review: a half-beat loop was silently widened to its whole bar whenever the learner's code was loaded (always:
  // the starter is code), so the playhead left the marked region.
  test("a loop inside a bar stays exactly what the learner marked, on both sides", async () => {
    const engine = fakeEngine();
    const mine = fakePlayer();
    const t = createAudioTransport({
      engine,
      createMine: () => mine,
      timeOfCycle: (c) => 0.2 + c * 2,
      cycle: () => 0,
      now: () => 0,
      grid,
    });
    await t.setMineCode('bass: n("0")');
    // Half a beat (0.25 s) on beat 2 of bar 3 (0-based bar 2: 4.5–6.5 s).
    t.setLoop({ startS: 5, endS: 5.25 });
    await t.play();
    expect(engine.calls).toContain("loop:5-5.25");
    expect(engine.calls).not.toContain("loop:4.5-6.5");
    // The pattern loops the same span: from bar 2.25 for an eighth of a bar.
    expect(mine.calls).toContain("loop:2.25+0.125");
    // Every pass of the pattern starts at the loop start, so the file is anchored there.
    expect(engine.calls.at(-1)).toBe("play:0.200@5.000");
    expect(t.state.loop).toEqual({ startS: 5, endS: 5.25 });
  });

  test("broken code: the recording still plays; mine is blocked with the reason", async () => {
    const engine = fakeEngine();
    const t = createAudioTransport({
      engine,
      createMine: fakePlayer,
      timeOfCycle: (c) => c,
      cycle: () => 0,
      now: () => 0,
      grid,
    });
    await t.setMineCode("bass: BROKEN");
    expect(t.state.mine.kind).toBe("error");
    t.setSide("mine");
    expect(t.state.side).toBe("source");
    await t.play();
    expect(engine.calls.at(-1)).toBe("play:now@0.000");
  });

  test("rate and pitch reach both sides; fine-tune the file only", async () => {
    const engine = fakeEngine();
    const mine = fakePlayer();
    const t = createAudioTransport({
      engine,
      createMine: () => mine,
      timeOfCycle: (c) => c,
      cycle: () => 0,
      now: () => 0,
      grid,
    });
    await t.setMineCode('bass: n("0")');
    t.setRate(0.75);
    t.setSemitones(2);
    t.setCents(-15);
    expect(engine.state.rate).toBe(0.75);
    expect(mine.calls).toContain("rate:0.75");
    expect(mine.calls).toContain("transpose:2");
    expect(t.state.cents).toBe(-15);
    t.setRate(3);
    expect(t.state.rate).toBe(1);
  });
});

describe("own audio and the playback coordinator", () => {
  function fakeCoordinator() {
    let active: { id: string; stop(): void } | null = null;
    const subs = new Set<(s: { activeId: string | null }) => void>();
    const emit = () => {
      for (const cb of subs) cb({ activeId: active?.id ?? null });
    };
    return {
      claim(src: { id: string; stop(): void }) {
        const prev = active;
        active = src;
        if (prev && prev.id !== src.id) prev.stop();
        emit();
        return () => {
          if (active?.id === src.id) active = null;
          emit();
        };
      },
      get: () => ({ activeId: active?.id ?? null }),
      subscribe(cb: (s: { activeId: string | null }) => void) {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      take(id: string) {
        this.claim({ id, stop() {} });
      },
    };
  }

  test("the file alone claims the speakers; another source taking them stops it", async () => {
    const engine = fakeEngine();
    const coordinator = fakeCoordinator();
    const t = createAudioTransport({
      engine,
      createMine: fakePlayer,
      timeOfCycle: (c) => c,
      cycle: () => 0,
      now: () => 0,
      grid: null,
      coordinator,
    });
    await t.play();
    expect(coordinator.get().activeId).toBe("transcribe-source");
    expect(t.state.playing).toBe(true);
    coordinator.take("oak_editor_0_");
    expect(t.state.playing).toBe(false);
    expect(engine.calls.at(-1)).toBe("pause");
    t.dispose();
  });

  test("with the pattern beside it, the pattern's claim is ours; a foreign one stops both", async () => {
    const engine = fakeEngine();
    const coordinator = fakeCoordinator();
    const mine = fakePlayer();
    const t = createAudioTransport({
      engine,
      createMine: () => {
        const origPlay = mine.play;
        mine.play = async () => {
          await origPlay();
          coordinator.take("player:7");
        };
        return mine;
      },
      timeOfCycle: (c) => c * 2,
      cycle: () => 0,
      now: () => 0,
      grid: { downbeatS: 0, barSec: 2 },
      coordinator,
    });
    await t.setMineCode('bass: n("0")');
    await t.play();
    expect(t.state.playing).toBe(true);
    coordinator.take("player:7");
    expect(t.state.playing).toBe(true);
    coordinator.take("oak_editor_1_");
    expect(t.state.playing).toBe(false);
    expect(mine.calls.at(-1)).toBe("stop");
    t.dispose();
  });
});

// Review: with a loop on, A/B started the stretch's 0.1 s run-up before the loop start; the stretch moved that start
// to the loop start, so the whole recording played up to 0.1 s / rate early against the code on every pass.
describe("the stretch's run-up inside a loop", () => {
  test("no loop: up to the file's start", () => {
    expect(preRoll(0.1, 4.5, null)).toEqual({ pre: 0.1, from: 4.4 });
    expect(preRoll(0.1, 0.05, null)).toEqual({ pre: 0.05, from: 0 });
  });
  test("starting at the loop start: the run-up is the loop's end, which wraps into the start on time", () => {
    const r = preRoll(0.1, 4.5, { startS: 4.5, endS: 6.5 });
    expect(r.pre).toBe(0.1);
    expect(r.from).toBeCloseTo(6.4, 9);
  });
  test("inside the loop: before the start as usual; a short loop keeps the run-up under half its length", () => {
    expect(preRoll(0.1, 5, { startS: 4.5, endS: 6.5 })).toEqual({ pre: 0.1, from: 4.9 });
    const half = preRoll(0.1, 5, { startS: 5, endS: 5.1 });
    expect(half.pre).toBeCloseTo(0.05, 9);
    expect(half.from).toBeCloseTo(5.05, 9);
  });
  test("a loop on bar lines with A/B: the file starts on the loop's end line, run-up and all", async () => {
    const engine = fakeEngine(20, "stretch");
    const mine = fakePlayer();
    const t = createAudioTransport({
      engine,
      createMine: () => mine,
      timeOfCycle: (c) => 10 + c * 2,
      cycle: () => 0.3,
      now: () => 9.8,
      grid: { downbeatS: 0.5, barSec: 2 },
    });
    await t.setMineCode('bass: n("0 2").scale("C2:major")');
    t.setLoop({ startS: 4.5, endS: 6.5 });
    t.setSide("both");
    await t.play();
    // Cycle 0 (10 s) is the loop start 4.5 s; the run-up of 0.1 s is taken from the loop's end, 6.4 s.
    expect(engine.calls.at(-1)).toBe("play:9.900@6.400");
  });
});

// Review (Wave 4): on a busy page the scheduler's first bar could be gone by the time the transport looked (its lead
// is 0.1 s), and the recording then came in a whole bar after the place the learner played from. d10 (Wave 6): the
// file then joined part-way into bar 0 without its run-up. Now the file is scheduled in the same turn as the
// pattern's start, and a start that is late all the same is taken again, so both sides begin at bar 0.
describe("a late start (d10)", () => {
  const grid = { downbeatS: 0.5, barSec: 2 };
  /** A clock, and a pattern player whose first bar sounds 0.11 s after each `play()` (the scheduler's latency). */
  function lateRig(opts: { busyS: number[]; impl?: SourceEngine["impl"] }) {
    const clock = { now: 20, cycle0: Number.NaN };
    const engine = fakeEngine(20, opts.impl ?? "stretch");
    const mine = fakePlayer();
    const play = mine.play.bind(mine);
    mine.play = async () => {
      await play();
      clock.cycle0 = clock.now + 0.11;
    };
    const busy = [...opts.busyS];
    const t = createAudioTransport({
      engine,
      createMine: () => mine,
      timeOfCycle: (c) => clock.cycle0 + c * 2,
      cycle: () => 0,
      now: () => clock.now,
      grid,
      // The page is busy for `busyS[k]` seconds between the pattern's k-th start and the transport's next line.
      settle: async () => {
        clock.now += busy.shift() ?? 0;
      },
    });
    return { clock, engine, mine, t };
  }
  const starts = (calls: string[]) => calls.filter((c) => c === "play" || c === "stop");

  test("on time: the file is scheduled for the pattern's first bar, its run-up filling the lead", async () => {
    const { clock, engine, mine, t } = lateRig({ busyS: [0] });
    await t.setMineCode('bass: n("0 2").scale("C2:major")');
    engine.seek(0.5);
    t.setRate(0.75);
    t.setSide("both");
    await t.play();
    expect(starts(mine.calls)).toEqual(["play"]);
    // Bar 1 (source 0.5 s) sounds at cycle 0, 0.11 s from now; the stretch starts 0.1 s of real time earlier
    // (0.075 s of source at 0.75×: all the lead there is, less 10 ms).
    expect(engine.calls.at(-1)).toBe(`play:${(clock.cycle0 - 0.1).toFixed(3)}@0.425`);
    expect(clock.cycle0).toBeCloseTo(20.11, 6);
  });

  test("a page busy for 300 ms after the pattern started: it starts again, and both begin at bar 0", async () => {
    const { clock, engine, mine, t } = lateRig({ busyS: [0.3, 0] });
    await t.setMineCode('bass: n("0 2").scale("C2:major")');
    engine.seek(0.5);
    t.setRate(0.75);
    t.setSide("both");
    await t.play();
    // The first bar of the first start was 0.19 s gone: the pattern is stopped and started again.
    expect(starts(mine.calls)).toEqual(["play", "stop", "play"]);
    expect(clock.cycle0).toBeCloseTo(20.41, 6);
    // The file is scheduled ONCE, for the new first bar, from the bar line (0.5 s) with its run-up: never part-way
    // into the bar, never without the run-up.
    expect(engine.calls.filter((c) => c.startsWith("play"))).toEqual([
      `play:${(clock.cycle0 - 0.1).toFixed(3)}@0.425`,
    ]);
    expect(t.state.playing).toBe(true);
    expect(t.state.time).toBe(0.5);
  });

  test("60 ms late (the old timer's slack was 20 ms): still bar 0, still the full run-up", async () => {
    const { clock, engine, mine, t } = lateRig({ busyS: [0.06] });
    await t.setMineCode('bass: n("0 2").scale("C2:major")');
    engine.seek(4.6); // bar 3 is 4.5–6.5
    t.setSide("both");
    await t.play();
    // 0.05 s of lead is left: enough to schedule the file for the bar line, so nothing restarts.
    expect(starts(mine.calls)).toEqual(["play"]);
    expect(engine.calls.at(-1)).toBe(`play:${(clock.cycle0 - 0.04).toFixed(3)}@4.460`);
  });

  test("a loop: a late start begins again on the loop's first bar", async () => {
    const { clock, engine, mine, t } = lateRig({ busyS: [0.5, 0], impl: "transcription" });
    await t.setMineCode('bass: n("0 2").scale("C2:major")');
    t.setLoop({ startS: 2.5, endS: 6.5 });
    engine.seek(2.5);
    t.setSide("both");
    await t.play();
    expect(starts(mine.calls)).toEqual(["play", "stop", "play"]);
    expect(mine.calls).toContain("loop:1+2");
    expect(engine.calls.at(-1)).toBe(`play:${clock.cycle0.toFixed(3)}@2.500`);
  });

  test("a page that stays busy: after two more starts the recording joins part-way, nothing skipped", async () => {
    const engine = fakeEngine(20, "stretch");
    const mine = fakePlayer();
    const t = createAudioTransport({
      engine,
      createMine: () => mine,
      // Cycle 0 sounded at 10 s every time; it is 10.6 s now (one bar is 2 s).
      timeOfCycle: (c) => 10 + c * 2,
      cycle: () => 0.3,
      now: () => 10.6,
      grid,
    });
    await t.setMineCode('bass: n("0 2").scale("C2:major")');
    engine.seek(0.5);
    t.setSide("both");
    await t.play();
    expect(starts(mine.calls)).toEqual(["play", "stop", "play", "stop", "play"]);
    expect(starts(mine.calls).filter((c) => c === "stop")).toHaveLength(LATE_START_RETRIES);
    // At 10.63 s the pattern is 0.315 of the way into bar 1: the file starts there (0.5 + 0.63 s), after a run-up of
    // the 0.02 s there is room for.
    expect(engine.calls.at(-1)).toBe("play:10.610@1.110");
  });

  test("paused while the page was busy: nothing is started again, nothing is left playing", async () => {
    const clock = { now: 20, cycle0: Number.NaN };
    const engine = fakeEngine(20, "stretch");
    const mine = fakePlayer();
    const play = mine.play.bind(mine);
    mine.play = async () => {
      await play();
      clock.cycle0 = clock.now + 0.11;
    };
    let t: ReturnType<typeof createAudioTransport> | null = null;
    t = createAudioTransport({
      engine,
      createMine: () => mine,
      timeOfCycle: (c) => clock.cycle0 + c * 2,
      cycle: () => 0,
      now: () => clock.now,
      grid,
      settle: async () => {
        clock.now += 0.3;
        t?.pause();
      },
    });
    await t.setMineCode('bass: n("0 2").scale("C2:major")');
    t.setSide("both");
    await t.play();
    expect(t.state.playing).toBe(false);
    expect(engine.calls.filter((c) => c.startsWith("play"))).toEqual([]);
    expect(starts(mine.calls)).toEqual(["play", "stop"]);
    expect(mine.playing).toBe(false);
  });
});
