// The prebake's alias and kit wrappers, and the preloader's pitch plan for soundfonts. No audio runs: the
// triggers are stand-ins that record what they receive.
import { describe, expect, test } from "bun:test";
import {
  kitGainOf,
  layeredIndex,
  layerOf,
  OAK_KITS,
  pinVariant,
  type SoundEntry,
  sampleAliasTrigger,
  withOutputGain,
} from "./pack.ts";
import { DEFAULT_FONT_RANGE, FONT_WARM_STEP, fontWarmNotes } from "./preload.ts";

function recorder() {
  const seen: Record<string, unknown>[] = [];
  const entry: SoundEntry = {
    onTrigger: (_t, value) => {
      seen.push(value);
      return undefined;
    },
  };
  return { seen, entry };
}

describe("pinVariant", () => {
  test("pins n onto the mirrored upstream indices (wrapping) and never mutates the hap value", () => {
    const { seen, entry } = recorder();
    const trigger = pinVariant(entry, [0, 5]);
    const value = { s: "gm_x", n: 3, note: 60 };
    trigger(0, value, () => {});
    trigger(0, { s: "gm_x" }, () => {});
    expect(seen.map((v) => v.n)).toEqual([5, 0]);
    expect(value.n).toBe(3);
  });

  test("an alias's defaults fill only what the code did not set", () => {
    const { seen, entry } = recorder();
    const trigger = pinVariant(entry, [5], { release: 0.08 });
    trigger(0, { s: "acgtr", note: 50 }, () => {});
    trigger(0, { s: "acgtr", note: 50, release: 1 }, () => {});
    expect(seen.map((v) => v.release)).toEqual([0.08, 1]);
  });
});

describe("withOutputGain", () => {
  function fakeHandle() {
    const connected: unknown[] = [];
    const trim = { gain: { value: 1 } };
    const node = {
      context: { createGain: () => trim },
      connect: (to: unknown) => {
        connected.push(to);
        return to;
      },
    };
    return { node, trim, connected };
  }

  test("a gain of 1 is the trigger itself", () => {
    const { entry } = recorder();
    expect(withOutputGain(entry.onTrigger, 1)).toBe(entry.onTrigger);
  });

  test("the handle's node is routed through a trim gain, which becomes the handle's node", async () => {
    const h = fakeHandle();
    const trigger = withOutputGain(() => ({ node: h.node, stop: () => {} }), 0.56);
    const out = (await trigger(0, { s: "rhodes" }, () => {})) as { node: unknown; stop: unknown };
    expect(out.node).toBe(h.trim);
    expect(h.trim.gain.value).toBe(0.56);
    expect(h.connected).toEqual([h.trim]);
    expect(typeof out.stop).toBe("function");
  });

  test("a per-hit gain function sees the hap value; a silent trigger passes through", async () => {
    const h = fakeHandle();
    const trigger = withOutputGain(
      () => ({ node: h.node }),
      (v) => (v.n === 2 ? 0.33 : 0.76),
    );
    await trigger(0, { s: "jazzkit_sd", n: 2 }, () => {});
    expect(h.trim.gain.value).toBe(0.33);
    const none = withOutputGain(() => undefined, 0.5);
    expect(await none(0, { s: "x" }, () => {})).toBeUndefined();
  });
});

describe("kitGainOf", () => {
  test("one gain for the role, or the variant's gain with superdough's wrapping", () => {
    expect(kitGainOf(0.59, 3)).toBe(0.59);
    expect(kitGainOf([0.76, 1.19, 0.33], 0)).toBe(0.76);
    expect(kitGainOf([0.76, 1.19, 0.33], 2)).toBe(0.33);
    expect(kitGainOf([0.76, 1.19, 0.33], 4)).toBe(1.19);
    expect(kitGainOf([0.76, 1.19, 0.33], undefined)).toBe(0.76);
    expect(kitGainOf([], 1)).toBe(1);
  });
});

describe("fontWarmNotes", () => {
  test("covers the range every few semitones, both ends included", () => {
    const notes = fontWarmNotes([40, 88]);
    expect(notes[0]).toBe(40);
    expect(notes.at(-1)).toBe(88);
    for (let i = 1; i < notes.length; i++)
      expect((notes[i] as number) - (notes[i - 1] as number)).toBeLessThanOrEqual(FONT_WARM_STEP);
  });

  test("no zone of a degree melody in any key goes unwarmed: every pitch is within a step of a warmed one", () => {
    const notes = fontWarmNotes(DEFAULT_FONT_RANGE);
    for (let m = DEFAULT_FONT_RANGE[0]; m <= DEFAULT_FONT_RANGE[1]; m++)
      expect(Math.min(...notes.map((n) => Math.abs(n - m)))).toBeLessThan(FONT_WARM_STEP);
  });

  test("a reversed range is accepted", () => {
    expect(fontWarmNotes([67, 24])).toEqual(fontWarmNotes([24, 67]));
  });
});

describe("v4 velocity layers", () => {
  test("a hap plays the first layer whose threshold its velocity is below; no velocity is the top layer", () => {
    expect(layerOf(undefined, [0.6])).toBe(1);
    expect(layerOf(1, [0.6])).toBe(1);
    expect(layerOf(0.6, [0.6])).toBe(1);
    expect(layerOf(0.3, [0.6])).toBe(0);
    expect(layerOf(0.2, [0.4, 0.8])).toBe(0);
    expect(layerOf(0.5, [0.4, 0.8])).toBe(1);
    expect(layerOf(0.9, [0.4, 0.8])).toBe(2);
    expect(layerOf(0.1, [])).toBe(0);
  });

  test("a kit role's files are variant-major: n picks the variant (wrapping), velocity the layer", () => {
    // 3 variants x 2 layers = 6 files
    expect(layeredIndex(0, 1, 6, 2, [0.6])).toBe(1);
    expect(layeredIndex(0, 0.3, 6, 2, [0.6])).toBe(0);
    expect(layeredIndex(2, 1, 6, 2, [0.6])).toBe(5);
    expect(layeredIndex(2, 0.45, 6, 2, [0.6])).toBe(4);
    expect(layeredIndex(4, 1, 6, 2, [0.6])).toBe(3);
    expect(layeredIndex(undefined, undefined, 6, 2, [0.6])).toBe(1);
  });

  test("a sample alias picks its layer from the velocity and fills its release only when the code sets none", () => {
    const { seen, entry } = recorder();
    const a = {
      sample: "src_rhodes",
      layers: 2,
      split: [0.6],
      release: 0.35,
      range: [29, 96] as [number, number],
    };
    const trigger = sampleAliasTrigger(entry, a);
    trigger(0, { s: "rhodes", note: 60 }, () => {});
    trigger(0, { s: "rhodes", note: 60, velocity: 0.4, n: 7 }, () => {});
    trigger(0, { s: "rhodes", note: 60, release: 2 }, () => {});
    expect(seen.map((v) => v.n)).toEqual([1, 0, 1]);
    expect(seen.map((v) => v.release)).toEqual([0.35, 0.35, 2]);
  });

  test("a one-layer sample alias always plays its only file", () => {
    const { seen, entry } = recorder();
    const trigger = sampleAliasTrigger(entry, {
      sample: "src_tenor",
      layers: 1,
      release: 0.15,
      range: [44, 88],
    });
    trigger(0, { s: "tenor", note: 60, n: 3, velocity: 0.2 }, () => {});
    expect(seen[0]?.n).toBe(0);
  });

  test("the v4 kits are the runtime's default kit list", () => {
    expect([...OAK_KITS]).toEqual(["jazzkit", "rockkit", "lofikit", "oak909", "oak808"]);
  });
});
