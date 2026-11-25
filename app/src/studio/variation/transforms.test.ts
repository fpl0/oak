// Oak 2.0 W3 (PLAN §4 S5 "Transforms", "Misuse cards"): each transform on the line under the cursor writes plain,
// visible Strudel that evaluates, or says in one sentence why it leaves the code as it is. Values checked headlessly.
import { describe, expect, test } from "bun:test";
import { isDescriptive } from "@oak/content-kit";
import { evalHeadless } from "@oak/grader/testing";
import {
  applyTransform,
  TRANSFORM_MENU_WORDS,
  TRANSFORMS,
  type TransformId,
  UNCHANGED_WORDS,
} from "./transforms.ts";

const S = 'mel: n("0 2 4 7").scale("C4:major").s("piano")';
const C = { key: { tonic: "C", mode: "major" } as const };

function changed(code: string, label: string, id: TransformId, amount?: number, ctx = C): string {
  const r = applyTransform(code, label, amount === undefined ? { id } : { id, amount }, ctx);
  if (!("code" in r)) throw new Error(`unchanged: ${r.unchanged}`);
  expect(r.code).not.toBe(code);
  return r.code;
}
const midis = async (code: string) => (await evalHeadless(code, 1)).events.map((e) => e.midi);
const why = (code: string, label: string, id: TransformId, ctx: Parameters<typeof applyTransform>[3] = C) => {
  const r = applyTransform(code, label, { id }, ctx);
  if (!("unchanged" in r)) throw new Error(`changed: ${r.code}`);
  return r.unchanged;
};

const strings = (o: object): string[] => Object.values(o).filter((w) => typeof w === "string");

describe("transpose", () => {
  test("a line of scale steps moves in steps of the scale", async () => {
    const out = changed(S, "mel", "transpose", 2);
    expect(out).toBe('mel: n("0 2 4 7").add(n(2)).scale("C4:major").s("piano")');
    expect(await midis(out)).toEqual([64, 67, 71, 76]);
  });
  test("any other line moves in half steps", async () => {
    const out = changed('mel: note("c4 e4 g4").s("piano")', "mel", "transpose", 2);
    expect(out).toBe('mel: note("c4 e4 g4").s("piano").transpose(2)');
    expect(await midis(out)).toEqual([62, 66, 69]);
  });
  test("no amount picked yet leaves the code", () => {
    expect(isDescriptive(why(S, "mel", "transpose"))).toBe(true);
  });
});

describe("pitch rewrites", () => {
  test("invert around the line's own centre", async () => {
    const out = changed(S, "mel", "invert");
    expect(out).toContain('n("7 5 3 0")');
    expect(await midis(out)).toEqual([72, 69, 65, 60]);
  });
  test("retrograde: the pitches back to front, the rhythm kept", async () => {
    const out = changed(S, "mel", "retrograde");
    expect(out).toContain('n("7 4 2 0")');
    expect(await midis(out)).toEqual([72, 67, 64, 60]);
  });
  test("mirror: .rev() right after .scale(…)", async () => {
    const out = changed(S, "mel", "rev");
    expect(out).toBe('mel: n("0 2 4 7").scale("C4:major").rev().s("piano")');
    expect(await midis(out)).toEqual([72, 67, 64, 60]);
  });
  test("rotate by 1 (the default) and by the learner's amount", async () => {
    const out = changed(S, "mel", "rotate");
    expect(out).toContain('n("2 4 7 0")');
    expect(await midis(out)).toEqual([64, 67, 72, 60]);
    expect(changed(S, "mel", "rotate", 2)).toContain('n("4 7 0 2")');
  });
});

describe("time shift", () => {
  test("time shift writes a JS fraction and moves every onset by 1/8", async () => {
    const out = changed(S, "mel", "shift", 8);
    expect(out).toContain(".early(1/8)");
    expect(out).not.toContain('.early("1/8")');
    const r = await evalHeadless(out, 1);
    expect(r.events.map((e) => e.onset)).toEqual([1 / 8, 3 / 8, 5 / 8, 7 / 8]);
    expect(r.events.map((e) => e.midi)).toEqual([64, 67, 72, 60]);
  });
  test("a quarter of a bar", () => {
    expect(changed(S, "mel", "shift", 4)).toContain(".early(1/4)");
  });
});

describe("snap and harmony", () => {
  test("snap a note line into the key", async () => {
    const out = changed('mel: note("c4 eb4 f#4").s("piano")', "mel", "snap");
    expect(out).toBe('mel: note("c4 e4 g4").s("piano")');
    expect(await midis(out)).toEqual([60, 64, 67]);
  });
  test("add a harmony a third above in the scale", async () => {
    const out = changed(S, "mel", "harmony");
    expect(out).toContain(".superimpose(x => x.scaleTranspose(2))");
    const r = await evalHeadless(out, 1);
    expect(r.events).toHaveLength(8);
    expect(r.events.filter((e) => e.onset === 0).map((e) => e.midi)).toEqual([60, 64]);
  });
});

describe("misuse moves", () => {
  test("segment on a busy line", async () => {
    const out = changed(S, "mel", "segment");
    expect(out).toContain(".segment(16)");
    expect((await evalHeadless(out, 1)).events).toHaveLength(16);
  });
  test("chop on a pad", async () => {
    const out = changed('pad: note("[c3,e3,g3]").s("sawtooth")', "pad", "chop");
    expect(out).toContain(".chop(4)");
    expect((await evalHeadless(out, 1)).events).toHaveLength(12);
  });
  test("striate on a pad", async () => {
    const out = changed('pad: note("[c3,e3,g3]").s("sawtooth")', "pad", "striate");
    expect(out).toContain(".striate(4)");
    expect((await evalHeadless(out, 1)).events).toHaveLength(12);
  });
  test("ply on held chords", async () => {
    const out = changed('chords: note("<[c3,e3,g3]>").s("piano")', "chords", "ply");
    expect(out).toContain(".ply(2)");
    const r = await evalHeadless(out, 1);
    expect(r.events).toHaveLength(6);
    expect([...new Set(r.events.map((e) => e.onset))]).toEqual([0, 0.5]);
  });
});

describe("a transform that cannot apply says why and leaves the code", () => {
  const notes = 'mel: note("c4 e4").s("piano")';
  const cases: [string, string, TransformId, Parameters<typeof applyTransform>[3]][] = [
    ["invert on a note line", notes, "invert", C],
    ["harmony on a note line", notes, "harmony", C],
    ["snap on scale steps", S, "snap", C],
    ["snap with no key", notes, "snap", { key: null }],
    ["snap on a line already in the key", notes, "snap", C],
    ["retrograde of a line that reads the same", 'mel: n("0 2 0").scale("C4:major")', "retrograde", C],
    ["snap on a drum line", 'drums: s("bd sd")', "snap", C],
  ];
  for (const [name, code, id, ctx] of cases) {
    test(name, () => {
      const text = why(code, code.startsWith("drums") ? "drums" : "mel", id, ctx);
      expect(text.length).toBeGreaterThan(0);
      expect(isDescriptive(text)).toBe(true);
    });
  }
  test("any transform on a label not in the code", () => {
    for (const t of TRANSFORMS) {
      const text = why(S, "bass", t.id);
      expect(text.length).toBeGreaterThan(0);
      expect(isDescriptive(text)).toBe(true);
    }
  });
});

describe("every note only describes", () => {
  test("labels and details", () => {
    for (const t of TRANSFORMS) {
      expect(isDescriptive(t.label)).toBe(true);
      expect(isDescriptive(t.detail)).toBe(true);
    }
    expect(TRANSFORMS.filter((t) => t.misuse).map((t) => t.id)).toEqual([
      "segment",
      "chop",
      "striate",
      "ply",
    ]);
  });
  test("the menu's words and every reason a transform gives", () => {
    const words = [
      ...strings(TRANSFORM_MENU_WORDS),
      TRANSFORM_MENU_WORDS.title("mel"),
      ...strings(UNCHANGED_WORDS),
      UNCHANGED_WORDS.noLine("bass"),
    ];
    expect(words.filter((text) => !isDescriptive(text))).toEqual([]);
  });
});
