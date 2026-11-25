// Oak 2.0 W1 (S1): capture anywhere, the pure part: tempo from taps, a tapped rhythm and a hum draft as scraps.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { initRealm } from "@oak/grader";
import { evalHeadless } from "@oak/grader/testing";
import { draftFromHum, type SungNote } from "@oak/pitch";
import { isDescriptive } from "../studio/descriptive.ts";
import { draftLine } from "../transcribe/hum.ts";
import {
  captureSketchTitle,
  DEFAULT_BPM,
  DEFAULT_KEY,
  DEFAULT_METER,
  humScrapBody,
  monoOf,
  readLastCapture,
  readPendingCapture,
  tapGridOf,
  tapScrapBody,
  tempoOfTaps,
  writeLastCapture,
  writePendingCapture,
} from "./model.ts";

setDefaultTimeout(60_000);
beforeAll(async () => {
  await initRealm({ toolbox: [], lockdown: false });
});

describe("tempoOfTaps", () => {
  test("four steady taps give the tempo and the first downbeat", () => {
    expect(tempoOfTaps([0, 0.5, 1, 1.5])).toEqual({ bpm: 120, downbeat: 0 });
    expect(tempoOfTaps([2, 2.6, 3.2, 3.8, 4.4])).toEqual({ bpm: 100, downbeat: 2 });
  });
  test("three taps are too few", () => {
    expect(tempoOfTaps([0, 0.5, 1])).toBeNull();
  });
  test("uneven taps give no tempo", () => {
    expect(tempoOfTaps([0, 0.5, 1.4, 1.5])).toBeNull();
  });
});

describe("tapScrapBody", () => {
  test("a tapped snare rhythm is a drums line that plays the taps", async () => {
    const body = tapScrapBody({ mini: "x ~ x x", bars: 1 }, { drum: "sd", bpm: 90, meter: "4/4" });
    expect(body.code).toBe('drums: s("sd").struct("x ~ x x")');
    expect(body.bpm).toBe(90);
    expect(body.sourceKind).toBe("tap");
    expect(body.role).toBe("drums");
    expect(body.label).toBe("drums");
    const r = await evalHeadless(`setcpm(90/4)\n${body.code}`, 1);
    expect(r.events.map((e) => e.begin)).toEqual(["0", "1/2", "3/4"]);
    expect(r.events.every((e) => e.s === "sd")).toBe(true);
  });
  test("6/8 taps count two dotted beats in threes", () => {
    expect(tapGridOf("6/8")).toEqual({ beatsPerBar: 2, grid: 12 });
    expect(tapGridOf("4/4")).toEqual({ beatsPerBar: 4, grid: 16 });
  });
});

describe("humScrapBody", () => {
  /** C4 E4 G4 E4, one beat each at 100 bpm. */
  const sung: SungNote[] = [60, 64, 67, 64].map((midi, i) => ({
    start: 1 + i * 0.6,
    end: 1 + (i + 1) * 0.6 - 0.08,
    midi,
    centsSpread: 10,
    frames: 40,
  }));
  const key = { tonic: "C", mode: "major" as const };

  test("a melody becomes a tune scrap labelled mel", async () => {
    const draft = draftFromHum(sung, { key, bpm: 100, label: "melody", tonicOctave: 4 });
    const body = humScrapBody(draft, "melody", { sourceKind: "hum", meter: "4/4", key });
    expect(body.role).toBe("tune");
    expect(body.label).toBe("mel");
    expect(body.code).toBe(draftLine(draft, "melody").replace(/^melody:/, "mel:"));
    expect(body.code.startsWith("mel: n(")).toBe(true);
    expect(body.code).toContain('.scale("C4:major")');
    expect(body.bpm).toBe(100);
    expect(body.key).toEqual(key);
    expect(body.sourceKind).toBe("hum");
    const r = await evalHeadless(`${draft.tempoLine}\n${body.code}`, 1);
    expect(r.events.map((e) => e.midi)).toEqual([60, 64, 67, 64]);
  });

  test("a bass stays labelled bass", () => {
    const draft = draftFromHum(sung, { key, bpm: 100, label: "bass", tonicOctave: 2 });
    const body = humScrapBody(draft, "bass", { sourceKind: "memo", meter: "4/4", key });
    expect(body.role).toBe("bass");
    expect(body.label).toBe("bass");
    expect(body.code).toBe(draftLine(draft, "bass"));
    expect(body.sourceKind).toBe("memo");
  });
});

describe("monoOf", () => {
  test("averages the channels", () => {
    const ch = [new Float32Array([1, 1]), new Float32Array([0, 0])];
    const mono = monoOf({ numberOfChannels: 2, length: 2, getChannelData: (i) => ch[i] as Float32Array });
    expect([...mono]).toEqual([0.5, 0.5]);
  });
  test("one channel is kept as it is", () => {
    const ch = new Float32Array([0.25, -0.5]);
    expect([...monoOf({ numberOfChannels: 1, length: 2, getChannelData: () => ch })]).toEqual([0.25, -0.5]);
  });
});

describe("capture settings and the unsaved result", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };
  test("no last capture: C major, 90, 4/4, a tune", () => {
    expect(readLastCapture(mem())).toEqual({
      key: DEFAULT_KEY,
      bpm: DEFAULT_BPM,
      meter: DEFAULT_METER,
      target: "melody",
    });
    expect(DEFAULT_KEY).toEqual({ tonic: "C", mode: "major" });
    expect(DEFAULT_BPM).toBe(90);
    expect(readLastCapture(null).bpm).toBe(90);
  });
  test("the last capture's settings come back", () => {
    const s = mem();
    const last = {
      key: { tonic: "A", mode: "minor" as const },
      bpm: 76,
      meter: "3/4" as const,
      target: "bass" as const,
    };
    writeLastCapture(s, last);
    expect(readLastCapture(s)).toEqual(last);
    s.setItem("oak.capture.last", "{not json");
    expect(readLastCapture(s).bpm).toBe(90);
  });
  test("an unsaved result is kept until saved or discarded", () => {
    const s = mem();
    const body = tapScrapBody({ mini: "x x", bars: 1 }, { drum: "bd", bpm: 100, meter: "4/4" });
    writePendingCapture(s, { body, to: "sketch" });
    expect(readPendingCapture(s)).toEqual({ body, to: "sketch" });
    writePendingCapture(s, null);
    expect(readPendingCapture(s)).toBeNull();
  });
  test("capture words are descriptive", () => {
    for (const kind of ["hum", "tap", "memo"] as const)
      expect(isDescriptive(captureSketchTitle({ sourceKind: kind }))).toBe(true);
  });
});
