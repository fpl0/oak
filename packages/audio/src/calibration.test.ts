// The calibration wizard's measurements, driven by a fake clock and a scripted "world" the mic hears.
import { describe, expect, test } from "bun:test";
import type { PitchFrame } from "@oak/pitch";
import { midiToHz } from "@oak/pitch";
import { mulberry32 } from "@oak/pitch/synth";
import { CALIBRATION, createCalibration, quietCheckOf } from "./calibration.ts";
import { FakeContext, framesBetween } from "./fakes.test-data.ts";
import type { MicGraph, MicSession, MicState } from "./types.ts";

type World = (tc: number) => { midi: number | null; rms?: number };

function rig(world: (played: { midi: number; at: number; dur: number }[]) => World) {
  const ctx = new FakeContext();
  const played: { midi: number; at: number; dur: number }[] = [];
  const clicks: number[] = [];
  const panned: [number, number][] = [];
  let open: { frames: PitchFrame[]; subs: Set<(f: PitchFrame) => void>; closed: boolean } | null = null;
  let opens = 0;
  const taps: AudioNode[] = [];
  const untaps: AudioNode[] = [];
  let state: MicState = "closed";
  const mic: MicGraph = {
    prepare: async () => {},
    async open() {
      opens++;
      state = "live";
      const s = { frames: [] as PitchFrame[], subs: new Set<(f: PitchFrame) => void>(), closed: false };
      open = s;
      const session: MicSession = {
        onFrame: (cb) => {
          s.subs.add(cb);
          return () => s.subs.delete(cb);
        },
        frames: () => [...s.frames],
        levelDb: () => -60,
        deviceId: "mic",
        sampleRate: 48000,
        tap: (node) => {
          taps.push(node);
          return () => untaps.push(node);
        },
        close: () => {
          s.closed = true;
          state = "closed";
        },
      };
      return session;
    },
    get state() {
      return state;
    },
    subscribe: () => () => {},
    closeAll: () => {},
    dispose: () => {},
  };
  const sleep = async (ms: number) => {
    const from = ctx.currentTime;
    ctx.advance(ms / 1000);
    const s = open;
    if (s && !s.closed) {
      for (const f of framesBetween(from, ctx.currentTime, world(played))) {
        s.frames.push(f);
        for (const cb of s.subs) cb(f);
      }
    }
    await Promise.resolve();
  };
  const cal = createCalibration({
    ctx: ctx as unknown as AudioContext,
    mic,
    playClick: (at) => clicks.push(at),
    playTone: (midi, at, dur) => played.push({ midi, at, dur }),
    playPanned: (hz, pan) => panned.push([hz, pan]),
    sleep,
  });
  return { ctx, cal, played, clicks, panned, taps, untaps, state: () => state, opens: () => opens };
}

const silent: World = () => ({ midi: null, rms: 10 ** (-62 / 20) });

describe("calibration", () => {
  test("output check plays left then right", async () => {
    const r = rig(() => silent);
    await r.cal.outputCheck();
    expect(r.panned.map(([, pan]) => pan)).toEqual([-1, 1]);
    expect(r.ctx.currentTime).toBeGreaterThan(2);
  });

  test("noise floor: median input level; the mic is closed afterwards", async () => {
    const r = rig(() => silent);
    const db = await r.cal.noiseFloor(1);
    expect(db).toBeCloseTo(-62, 3);
    expect(r.state()).toBe("closed");
    expect(r.opens()).toBe(1);
  });

  test("quiet check: a quiet room passes; humming through it is caught, not stored as the floor", async () => {
    const quiet = await rig(() => silent).cal.noiseCheck(1);
    expect(quiet.voiced).toBe(false);
    expect(quiet.floorDb).toBeCloseTo(-62, 3);
    // The learner hums C4 at −30 dBFS for the middle half of the check.
    const hum = rig(() => (tc) => (tc > 0.5 && tc < 1.0 ? { midi: 60, rms: 10 ** (-30 / 20) } : silent(tc)));
    const r = await hum.cal.noiseCheck(1.2);
    expect(r.voiced).toBe(true);
    expect(r.voicedSec).toBeGreaterThan(0.3);
    expect(hum.state()).toBe("closed");
    // A short cough is not a voice.
    const cough = quietCheckOf(
      Array.from({ length: 280 }, (_, i) => ({
        t: i * 0.0107,
        hz: i > 100 && i < 110 ? 200 : 0,
        clarity: i > 100 && i < 110 ? 0.95 : 0.1,
        rms: i > 100 && i < 110 ? 0.05 : 0.0008,
      })),
    );
    expect(cough.voiced).toBe(false);
  });

  test("bleed test: true when the mic hears the 880/1175/1568 Hz tones, false on headphones", async () => {
    const speakers = rig((played) => (tc) => {
      const p = played.find((x) => tc >= x.at + 0.03 && tc < x.at + x.dur);
      return p ? { midi: p.midi, rms: 0.02 } : { midi: null };
    });
    expect(await speakers.cal.bleedTest()).toBe(true);
    expect(speakers.played.map((p) => p.midi)).toEqual([...CALIBRATION.bleedTones]);
    const phones = rig(() => silent);
    expect(await phones.cal.bleedTest()).toBe(false);
  });

  test("leak check: an analyser on the mic hears the tones Oak played (speakers), or only the room (headphones)", async () => {
    // The raw mic: what was played at `gain` (−∞: nothing), 90 ms late, over a −65 dBFS room; no pitch frames.
    const withAnalyser = (leakDb: number | null) => {
      const r = rig(() => silent);
      const rand = mulberry32(5);
      const sample = (t: number) => {
        let v = 10 ** (-65 / 20) * Math.sqrt(3) * (2 * rand() - 1);
        if (leakDb !== null)
          for (const p of r.played)
            if (t >= p.at + 0.09 && t < p.at + 0.09 + p.dur)
              v += 10 ** (leakDb / 20) * Math.SQRT2 * Math.sin(2 * Math.PI * midiToHz(p.midi) * t);
        return v;
      };
      (r.ctx as unknown as { createAnalyser(): unknown }).createAnalyser = () => ({
        fftSize: 2048,
        smoothingTimeConstant: 0.8,
        getFloatTimeDomainData(buf: Float32Array) {
          const end = r.ctx.currentTime;
          for (let i = 0; i < buf.length; i++) buf[i] = sample(end - (buf.length - 1 - i) / 48000);
        },
      });
      return r;
    };
    const speakers = withAnalyser(-40);
    const loud = await speakers.cal.bleedCheck();
    expect(loud.heard).toBe(true);
    expect(loud.byPitch).toBe(false);
    expect(loud.tones?.heard).toBe(true);
    expect(loud.tones?.leakDb as number).toBeCloseTo(-40, 0);
    expect(speakers.played.map((p) => p.midi)).toEqual([...CALIBRATION.bleedTones]);
    expect(speakers.untaps).toEqual(speakers.taps);
    expect(speakers.state()).toBe("closed");
    const phones = await withAnalyser(null).cal.bleedCheck();
    expect(phones).toMatchObject({ heard: false, byPitch: false, tones: { heard: false, leakDb: null } });
    expect(phones.tones?.floorDb as number).toBeCloseTo(-65, 0);
    // Without an analyser (or a session that cannot tap) the pitch tracker's check still answers.
    expect((await rig(() => silent).cal.bleedCheck()).tones).toBeNull();
  });

  test("tap latency: 16 clicks, median and MAD; 'high' above 120 ms", async () => {
    for (const [lat, high] of [
      [0.08, false],
      [0.21, true],
    ] as const) {
      const r = rig(() => silent);
      const progress: number[] = [];
      async function* taps() {
        // The learner taps a little after each click (the clicks are known once the step starts).
        while (r.clicks.length === 0) await Promise.resolve();
        for (const [k, c] of r.clicks.entries()) yield c + lat + (k % 2 ? 0.004 : -0.004);
      }
      const res = await r.cal.tapLatency(taps(), (i) => progress.push(i));
      expect(r.clicks.length).toBe(16);
      expect(res.taps).toBe(16);
      expect(res.latencyMs).toBeCloseTo(lat * 1000, 0);
      expect(res.jitterMs).toBeCloseTo(4, 3);
      expect(res.high).toBe(high);
      expect(progress).toEqual(Array.from({ length: 16 }, (_, i) => i));
    }
  });

  test("sing latency: the learner's 'da' starts 140 ms after each click", async () => {
    let clicks: number[] = [];
    const r = rig(() => (tc) => {
      const c = clicks.find((x) => tc >= x + 0.14 && tc < x + 0.44);
      return c === undefined ? { midi: null } : { midi: 57 };
    });
    // The clicks are scheduled at the start of the step: read them as soon as they exist.
    const p = r.cal.singLatency();
    clicks = r.clicks;
    const ms = await p;
    expect(r.clicks.length).toBe(8);
    expect(Math.abs(ms - 140)).toBeLessThan(12);
  });

  test("range sweep: lowest and highest sustained notes, comfort inside", async () => {
    const r = rig(() => (tc) => {
      const k = Math.floor((tc - 0.5) / 0.35);
      return k >= 0 && k <= 24 && (tc - 0.5) % 0.35 < 0.3 ? { midi: 45 + k } : { midi: null };
    });
    const seen: number[] = [];
    const res = await r.cal.rangeSweep((f) => seen.push(f.t));
    expect(res).toEqual({ lowMidi: 45, highMidi: 69, comfortLowMidi: 49, comfortHighMidi: 65 });
    expect(seen.length).toBeGreaterThan(100);
  });

  test("Stop ends a take early and measures what was heard (range, taps, sung 'da's)", async () => {
    // Range: the learner sweeps for 4 s of the 10 and presses Stop.
    const r = rig(() => (tc) => {
      const k = Math.floor((tc - 0.2) / 0.3);
      return k >= 0 && k <= 10 && (tc - 0.2) % 0.3 < 0.26 ? { midi: 48 + k } : { midi: null };
    });
    const stop = new AbortController();
    const seen: number[] = [];
    const sweep = r.cal.rangeSweep((f) => {
      seen.push(f.t);
      if (f.t >= 4) stop.abort();
    }, stop.signal);
    const res = await sweep;
    expect(r.ctx.currentTime).toBeLessThan(5);
    expect(res.lowMidi).toBe(48);
    expect(res.highMidi).toBeGreaterThanOrEqual(58);
    expect(r.state()).toBe("closed");

    // Taps: Stop after 5 clicks; the result counts the 5 taps (the part judges whether that is enough).
    const t = rig(() => silent);
    const tapStop = new AbortController();
    async function* taps() {
      while (t.clicks.length === 0) await Promise.resolve();
      for (const c of t.clicks.slice(0, 5)) yield c + 0.05;
      tapStop.abort();
      // The learner stops tapping; the stream stays open.
      await new Promise(() => {});
    }
    const tr = await t.cal.tapLatency(taps(), undefined, tapStop.signal);
    expect(t.ctx.currentTime).toBeLessThan(CALIBRATION.leadIn + 16 * CALIBRATION.tapSpacing);
    expect(tr.taps).toBe(5);
    expect(tr.latencyMs).toBeCloseTo(50, 0);

    // Sung 'da's: Stop half-way; the latency is measured from the clicks heard so far.
    let clicks: number[] = [];
    const s = rig(() => (tc) => {
      const c = clicks.find((x) => tc >= x + 0.14 && tc < x + 0.44);
      return c === undefined ? { midi: null } : { midi: 57 };
    });
    const singStop = new AbortController();
    const p = s.cal.singLatency((i) => {
      if (i === 4) singStop.abort();
    }, singStop.signal);
    clicks = s.clicks;
    const ms = await p;
    expect(s.ctx.currentTime).toBeLessThan(CALIBRATION.leadIn + 6 * CALIBRATION.singSpacing);
    expect(Math.abs(ms - 140)).toBeLessThan(15);
  });

  test("range sweep with no voice rejects", async () => {
    const r = rig(() => silent);
    await expect(r.cal.rangeSweep()).rejects.toBeInstanceOf(RangeError);
    expect(r.state()).toBe("closed");
  });

  test("pitch match: cents error of each trial, folded; NaN when nothing is sung", async () => {
    const r = rig((played) => (tc) => {
      const p = played.find((x) => tc >= x.at + x.dur + 0.35 && tc < x.at + x.dur + 2.6);
      if (!p) return { midi: null };
      if (p.midi === 64) return { midi: null };
      return { midi: p.midi - 12 + 0.2 }; // an octave down, 20 cents sharp
    });
    const errs = await r.cal.pitchMatch([57, 60, 64]);
    expect(errs[0]).toBeCloseTo(20, 3);
    expect(errs[1]).toBeCloseTo(20, 3);
    expect(Number.isNaN(errs[2])).toBe(true);
  });
});
