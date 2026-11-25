// Oak 2.0 W3 tempo try (PLAN §4 S6): three tempos of the learner's loop as A, B, C, the BPM named only after the
// pick, and the tempo line written with every other byte unchanged (W3 fidelity rule 2).
import { describe, expect, test } from "bun:test";
import { tempoLine } from "@oak/theory";
import { isDescriptive } from "./descriptive.ts";
import { OAK_DEFAULTS } from "./model.ts";
import {
  bpmOfCode,
  shuffledOffsets,
  TEMPO_TRY_STEP,
  TEMPO_TRY_WORDS,
  tempoOfCode,
  tempoTryOptions,
  withTempo,
} from "./tempo-try.ts";

const SRC = 'setcpm(96/4)\n\ndrums: s("bd")';

describe("reading and writing the tempo", () => {
  test("bpmOfCode reads the tempo line, else Oak's default", () => {
    expect(bpmOfCode(SRC, "4/4")).toBe(96);
    expect(bpmOfCode('setcpm(108/3)\ndrums: s("bd")', "3/4")).toBe(108);
    expect(bpmOfCode('drums: s("bd")', "4/4")).toBe(OAK_DEFAULTS.bpm);
    expect(tempoOfCode('drums: s("bd")', "4/4")).toBeNull();
    expect(tempoOfCode("setcps(0.4)", "4/4")).toBe(96);
  });

  test("withTempo replaces the first tempo line and nothing else", () => {
    expect(withTempo(SRC, 104, "4/4")).toBe('setcpm(104/4)\n\ndrums: s("bd")');
    const three = 'setcpm(108/3)\n// a waltz\ndrums: s("bd ~ ~")';
    const out = withTempo(three, 104, "3/4");
    expect(out.split("\n")[0]).toBe(tempoLine(104, "3/4"));
    expect(out.slice(out.indexOf("\n"))).toBe(three.slice(three.indexOf("\n")));
  });

  test("a commented tempo is not the tempo line", () => {
    const code = '// setcpm(120/4) was too fast\nsetcpm(96/4)\ndrums: s("bd")';
    expect(withTempo(code, 88, "4/4")).toBe('// setcpm(120/4) was too fast\nsetcpm(88/4)\ndrums: s("bd")');
  });

  test("no tempo line: the tempo line and a blank line go first", () => {
    const code = 'drums: s("bd sd")';
    expect(withTempo(code, 100, "4/4")).toBe(`${tempoLine(100, "4/4")}\n\n${code}`);
  });
});

describe("the options", () => {
  test("A, B, C follow the order; each differs from the source only in its tempo line", () => {
    const opts = tempoTryOptions(SRC, "4/4", [8, -8, 0]);
    expect(opts.map((o) => [o.name, o.bpm])).toEqual([
      ["A", 104],
      ["B", 88],
      ["C", 96],
    ]);
    const rest = (code: string) => code.split("\n").slice(1).join("\n");
    for (const o of opts) {
      expect(rest(o.code)).toBe(rest(SRC));
      expect(o.code.split("\n")[0]).toBe(tempoLine(o.bpm, "4/4"));
    }
    expect(opts.find((o) => o.bpm === 96)?.code).toBe(SRC);
    expect(TEMPO_TRY_STEP).toBe(8);
  });

  test("a variant below 40 BPM is left out", () => {
    const opts = tempoTryOptions('setcpm(44/4)\ndrums: s("bd")', "4/4", [-8, 0, 8]);
    expect(opts.map((o) => [o.name, o.bpm])).toEqual([
      ["A", 44],
      ["B", 52],
    ]);
  });

  test("shuffledOffsets is a permutation of −8, 0, +8", () => {
    for (const r of [0, 0.3, 0.6, 0.99])
      expect([...shuffledOffsets(() => r)].sort((a, b) => a - b)).toEqual([-8, 0, 8]);
  });
});

describe("the BPM is named only after the pick", () => {
  test("the option labels before a pick contain no digit; the reveal names it", () => {
    for (const name of ["A", "B", "C"] as const) {
      expect(TEMPO_TRY_WORDS.option(name)).not.toMatch(/\d/);
      expect(TEMPO_TRY_WORDS.pick(name)).not.toMatch(/\d/);
    }
    for (const s of [TEMPO_TRY_WORDS.button, TEMPO_TRY_WORDS.intro, TEMPO_TRY_WORDS.play])
      expect(s).not.toMatch(/\d/);
    expect(TEMPO_TRY_WORDS.reveal("B", 104)).toBe("B was 104 BPM.");
  });

  test("every string only describes", () => {
    for (const [k, v] of Object.entries(TEMPO_TRY_WORDS)) {
      const text = typeof v === "function" ? (v as (a: "A", b: number) => string)("A", 96) : v;
      expect({ k, ok: isDescriptive(text) }).toEqual({ k, ok: true });
      expect(text).not.toMatch(/\b(recommend|better|best)\b/i);
    }
  });
});
