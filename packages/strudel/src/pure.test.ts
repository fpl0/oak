// Pure helpers of the adapter: mutex, live budget, logs, mutes, haps, store, coordinator, lint bridge,
// recorder window, playback plan, pattern-player positions.
import { describe, expect, test } from "bun:test";
import type { LintContext, LintDiagnostic, LintResult } from "@oak/content-kit";
import type { AudioPlan } from "@oak/drills";
import { createCoordinator } from "./coordinator.ts";
import { audibleCycle, sortLiveHaps, TRACK_KEY, toLiveHap } from "./haps.ts";
import {
  ADAPTER_FEEDBACK,
  errorToDiagnostic,
  hasError,
  lineOf,
  runLint,
  toCmDiagnostics,
} from "./lint-bridge.ts";
import { isNoise, isSkipMessage, missingSoundOf, parseStrudelLog } from "./logs.ts";
import { LiveBudget } from "./lru.ts";
import { limiterMakeupDb } from "./master-bus.ts";
import { copyMutes, isMuted, trackNameOf } from "./mutes.ts";
import { EvalMutex, withTimeout } from "./mutex.ts";
import { barPosition, clampRate, clampTranspose, lintForLoad } from "./pattern-player.ts";
import { preloadSpecOfNames, schedulePlan } from "./playback.ts";
import { pickMimeType, recordingWindow } from "./recorder.ts";
import { createStore, shallowEqual } from "./store.ts";
import type { BandSetup, LiveHap } from "./types.ts";
import { midiToHz, UI_BUS_GAIN } from "./ui-sounds.ts";

describe("EvalMutex", () => {
  test("runs strictly one after another, in call order, and survives a failure", async () => {
    const m = new EvalMutex();
    const log: string[] = [];
    const job = (name: string, ms: number, fail = false) =>
      m.run(async () => {
        log.push(`${name}+`);
        await new Promise((r) => setTimeout(r, ms));
        log.push(`${name}-`);
        if (fail) throw new Error(name);
        return name;
      });
    const a = job("a", 20);
    const b = job("b", 1, true);
    const c = job("c", 5);
    expect(m.pending).toBe(3);
    expect(await a).toBe("a");
    await expect(b).rejects.toThrow("b");
    expect(await c).toBe("c");
    expect(log).toEqual(["a+", "a-", "b+", "b-", "c+", "c-"]);
    expect(m.pending).toBe(0);
  });
  test("withTimeout rejects a promise that never settles and resolves a fast one", async () => {
    await expect(withTimeout(new Promise(() => {}), 10, () => new Error("locked"))).rejects.toThrow("locked");
    expect(await withTimeout(Promise.resolve(3), 10, () => new Error("x"))).toBe(3);
  });
});

describe("LiveBudget", () => {
  test("evicts least recently used first, never a protected one", () => {
    const b = new LiveBudget<string>(3);
    for (const k of ["a", "b", "c"]) b.touch(k);
    b.touch("a");
    expect(b.keys()).toEqual(["b", "c", "a"]);
    expect(b.overflow()).toEqual(["b"]);
    expect(b.overflow((k) => k === "b")).toEqual(["c"]);
    expect(b.overflow(() => true)).toEqual([]);
    b.delete("c");
    expect(b.overflow()).toEqual([]);
    expect(() => new LiveBudget(0)).toThrow(RangeError);
  });
});

describe("logs", () => {
  test("both skip messages are recognised, with the sound name when it is known", () => {
    const sampler = parseStrudelLog('[sampler] loading sound "RolandTR909_bd:0" took too long');
    expect(sampler.tag).toBe("sampler");
    expect(sampler.skippedSound).toBe("RolandTR909_bd:0");
    const font = parseStrudelLog("[webaudio] skip hap: still loading", "rhodes");
    expect(font.skippedSound).toBe("rhodes");
    expect(isSkipMessage("[webaudio] skip hap: still loading")).toBe(true);
    expect(parseStrudelLog("hello").tag).toBe("other");
    expect(missingSoundOf("[getTrigger] error: sound gm_violin not found! Is it loaded?")).toBe("gm_violin");
    expect(isNoise("[superdough] Deprecation warning: ... onended = callback")).toBe(true);
  });
});

describe("mutes", () => {
  test("solo wins over mute; names follow repl.mjs 1.2.6", () => {
    const m = { muted: new Set(["drums"]), solo: null };
    expect(isMuted("drums", m)).toBe(true);
    expect(isMuted("bass", m)).toBe(false);
    const s = { muted: new Set<string>(), solo: "bass" };
    expect(isMuted("drums", s)).toBe(true);
    expect(isMuted("band.drums", s)).toBe(true);
    expect(isMuted("bass", s)).toBe(false);
    expect(trackNameOf("$", 2)).toEqual({ track: "$2", anonymous: true });
    expect(trackNameOf("_drums", 0).track).toBeNull();
    expect(trackNameOf("drums_", 0).track).toBeNull();
    const own = new Set(["x"]);
    const copy = copyMutes({ muted: own, solo: null });
    own.add("y");
    expect(copy.muted.has("y")).toBe(false);
  });
});

describe("haps", () => {
  const hap = (begin: number, track: string, note?: number): LiveHap => ({
    track,
    begin,
    end: begin + 0.25,
    value: note === undefined ? {} : { note },
    locations: [],
  });
  test("sorted by onset, then track order, then pitch", () => {
    const sorted = sortLiveHaps(
      [hap(2, "bass", 40), hap(1.33, "mel", 72), hap(1.33, "bass", 36), hap(1.33, "mel", 60)],
      ["bass", "mel"],
    );
    expect(sorted.map((h) => [h.begin, h.track, h.value.note])).toEqual([
      [1.33, "bass", 36],
      [1.33, "mel", 60],
      [1.33, "mel", 72],
      [2, "bass", 40],
    ]);
  });
  test("toLiveHap reads the track tag, keeps locations, makes fractions JSON-safe", () => {
    const frac = { n: 1n, d: 3n, s: 1n, valueOf: () => 1 / 3 };
    const live = toLiveHap({
      whole: { begin: { valueOf: () => 0.5 }, end: { valueOf: () => 0.75 } },
      value: { note: 60, s: "piano", weird: frac, fn: () => 1 },
      context: { locations: [{ start: 3, end: 5 }], [TRACK_KEY]: "mel" },
    });
    expect(live).toEqual({
      track: "mel",
      begin: 0.5,
      end: 0.75,
      value: { note: 60, s: "piano", weird: 1 / 3 },
      locations: [{ start: 3, end: 5 }],
    });
    expect(JSON.parse(JSON.stringify(live))).toEqual(live);
  });
  test("audibleCycle subtracts every latency in cycles", () => {
    expect(
      audibleCycle(10, 0.5, {
        schedulerLeadS: 0.1,
        outputLatencyS: 0.05,
        baseLatencyS: 0.01,
        visualOffsetMs: 40,
      }),
    ).toBeCloseTo(10 - 0.2 * 0.5);
  });
});

describe("store and coordinator", () => {
  test("store notifies only on change", () => {
    const s = createStore({ a: 1, b: [1, 2] }, shallowEqual);
    const seen: number[] = [];
    const off = s.subscribe((v) => seen.push(v.a));
    s.set({ a: 1, b: [1, 2] });
    s.set({ a: 2, b: [1, 2] });
    off();
    s.set({ a: 3, b: [] });
    expect(seen).toEqual([2]);
    expect(s.size).toBe(0);
  });
  test("only one source plays; a claim stops the others; panic stops all", () => {
    let panics = 0;
    const c = createCoordinator(() => panics++);
    const stopped: string[] = [];
    const src = (id: string, kind: "editor" | "plan" = "editor") => ({
      id,
      kind,
      stop: () => stopped.push(id),
    });
    c.claim(src("e1"));
    expect(c.get()).toEqual({ activeId: "e1", kind: "editor" });
    const releasePlan = c.claim(src("plan:1", "plan"));
    expect(stopped).toEqual(["e1"]);
    expect(c.get().activeId).toBe("plan:1");
    releasePlan();
    expect(c.get().activeId).toBeNull();
    c.claim(src("e2"));
    c.release("nope");
    expect(c.get().activeId).toBe("e2");
    c.panic();
    expect(stopped).toEqual(["e1", "e2"]);
    expect(panics).toBe(1);
    expect(c.get().activeId).toBeNull();
  });
  test("a source whose stop() releases synchronously does not clear the new claim", () => {
    const c = createCoordinator();
    c.claim({ id: "a", kind: "editor", stop: () => c.release("a") });
    c.claim({ id: "b", kind: "editor", stop: () => {} });
    expect(c.get().activeId).toBe("b");
  });
});

describe("lint bridge", () => {
  test("clamps stale ranges and maps severities", () => {
    const d = toCmDiagnostics(
      [
        {
          id: "code.locked-tool",
          severity: "warn",
          range: { from: 5, to: 50 },
          line: 1,
          params: {},
          message: "m",
        },
      ],
      10,
    );
    expect(d).toEqual([{ from: 5, to: 10, severity: "warning", source: "code.locked-tool", message: "m" }]);
  });
  test("duck-types syntax errors (window.SyntaxError is replaced by evalScope)", () => {
    const acorn = errorToDiagnostic(
      Object.assign(new Error("Unexpected token (1:4)"), { pos: 4 }),
      "abc\ndef",
    );
    expect(acorn.id).toBe(ADAPTER_FEEDBACK.syntax);
    expect(acorn.range).toEqual({ from: 4, to: 5 });
    expect(acorn.line).toBe(2);
    expect(errorToDiagnostic(new Error("boom"), "x").id).toBe(ADAPTER_FEEDBACK.runtime);
    expect(lineOf("a\nb\nc", 4)).toBe(3);
  });
  test("a lint that throws fails closed", () => {
    const out = runLint(
      () => {
        throw new Error("broken");
      },
      "s('bd')",
      { profile: "graded", unlocked: new Set(), allowPreview: false, meter: "4/4", key: null },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.diagnostic.id).toBe(ADAPTER_FEEDBACK.lintFailed);
      expect(hasError([out.diagnostic])).toBe(true);
    }
  });
});

describe("master bus, recorder, ui", () => {
  test("limiter makeup matches the spike measurement (+1.71 dB predicted, +1.73 measured)", () => {
    expect(limiterMakeupDb()).toBeCloseTo(1.71, 2);
    expect(10 ** (-limiterMakeupDb() / 20)).toBeCloseTo(0.8213, 3);
  });
  test("recording starts at the next integer cycle and lasts bars / cps + tail", () => {
    const w = recordingWindow(
      { bars: 4 },
      { playing: true, cycle: 2.25, cps: 0.5, now: 10, timeOfCycle: (c) => 10 + (c - 2.25) / 0.5 },
    );
    expect(w.delayS).toBeCloseTo(1.5);
    expect(w.durationS).toBeCloseTo(4 / 0.5 + 2);
    expect(
      recordingWindow(
        { bars: 2, tailSec: 0 },
        { playing: false, cycle: 0, cps: 1, now: 0, timeOfCycle: () => 0 },
      ),
    ).toEqual({ delayS: 0, durationS: 2 });
    expect(pickMimeType(undefined, (m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickMimeType("audio/mp4", () => true)).toBe("audio/mp4");
  });
  test("the UI bus sits at −24 dBFS; A4 is 440 Hz", () => {
    expect(20 * Math.log10(UI_BUS_GAIN)).toBeCloseTo(-24, 6);
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(60)).toBeCloseTo(261.63, 2);
  });
});

describe("playback plans", () => {
  test("absolute times, sorted, gain multiplied", () => {
    const plan: AudioPlan = {
      events: [
        { at: 0.5, dur: 0.4, value: { s: "piano", note: 64, gain: 0.5 } },
        { at: 0, dur: 0.4, value: { s: "piano", note: 60 } },
      ],
      durationSec: 1,
      preload: ["piano"],
    };
    expect(schedulePlan(plan, 10, 0.5)).toEqual([
      { t: 10, dur: 0.4, value: { s: "piano", note: 60, gain: 0.5 } },
      { t: 10.5, dur: 0.4, value: { s: "piano", note: 64, gain: 0.25 } },
    ]);
    expect(preloadSpecOfNames(["piano", "RolandTR909_bd:2"])).toEqual({
      sounds: [{ s: "piano" }, { s: "RolandTR909_bd", n: 2 }],
    });
  });
});

describe("pattern player helpers", () => {
  test("bar position honours the A–B loop", () => {
    expect(barPosition(5.5, null)).toBe(5.5);
    expect(barPosition(0, { fromBar: 4, bars: 2 })).toBe(4);
    expect(barPosition(3.25, { fromBar: 4, bars: 2 })).toBeCloseTo(5.25);
    expect(clampRate(0.1)).toBe(0.25);
    expect(clampRate(2)).toBe(1);
    expect(clampTranspose(14)).toBe(12);
    expect(clampTranspose(-3.4)).toBe(-3);
  });
});

describe("PatternPlayer.load of a unit song alone (review s1a)", () => {
  // A content-profile lint as the real one behaves: code with no tempo line is an error there.
  const lint = (code: string, ctx: LintContext): LintResult => {
    const missing = ctx.profile === "content" && !code.includes("setcpm");
    const diagnostics: LintDiagnostic[] = missing
      ? [
          {
            id: "code.setcpm-missing" as LintDiagnostic["id"],
            severity: "error",
            range: { from: 0, to: 0 },
            line: 1,
            params: {},
            message: "There is no tempo line",
          },
        ]
      : [];
    return { ok: !missing, diagnostics, used: [], locked: [], lockedTools: [] };
  };
  const ctx: LintContext = {
    profile: "content",
    unlocked: new Set(),
    allowPreview: true,
    meter: "4/4",
    key: null,
  };
  const song = { song: {} } as unknown as BandSetup;

  test("a song with no code of its own plays over a placeholder that is not linted", () => {
    const out = lintForLoad(lint, "", song, ctx);
    expect(out.code).toBe("silence");
    expect(out.outcome.ok && out.outcome.result.ok).toBe(true);
  });

  test("code of its own is linted as before", () => {
    const out = lintForLoad(lint, 'kick: s("bd")', song, ctx);
    expect(out.code).toBe('kick: s("bd")');
    expect(out.outcome.ok && out.outcome.result.ok).toBe(false);
    expect(lintForLoad(lint, "", null, ctx).outcome.ok).toBe(true);
    const plain = lintForLoad(lint, "", null, ctx);
    expect(plain.code).toBe("");
    expect(plain.outcome.ok && plain.outcome.result.ok).toBe(false);
  });
});
