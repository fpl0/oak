import { describe, expect, test } from "bun:test";
import { strudel } from "../analyze/__support__/fixtures.ts";
import { parseProgram, programInfo } from "../lint/ast.ts";
import { invertAroundCentre, retrogradePitches, rewriteDegrees, rotatePitches, wrapChain } from "./index.ts";

const code = (mini: string): string =>
  `setcpm(96/4)\n\nmel: n("${mini}").scale("C4:major").s("piano")\ndrums: s("bd ~ sd ~")\n`;
const rewrites = {
  wrapChain: (code: string, label: string) => wrapChain(code, label, "rev", ""),
  rewriteDegrees: (code: string, label: string) => rewriteDegrees(code, label, (d) => d - 3),
  invertAroundCentre,
  retrogradePitches,
  rotatePitches: (code: string, label: string) => rotatePitches(code, label, 1),
};

function labels(code: string): string[] {
  const parsed = parseProgram(code);
  expect(parsed.ok).toBe(true);
  return parsed.ok ? programInfo(parsed.ast).labels.map((part) => part.label) : [];
}

describe("AC1 missing labels", () => {
  for (const [name, rewrite] of Object.entries(rewrites)) {
    test(`${name} returns the identical string for a missing label`, () => {
      const input = code("0 2 4");
      expect(rewrite(input, "missing")).toBe(input);
    });
  }
});

describe("AC2 rewritten parts parse and evaluate", () => {
  const cases: [string, string, (code: string) => string][] = [
    ["wrapChain scale", code("0 2 4").replace("C4:major", "C:major"), (c) => wrapChain(c, "mel", "rev", "")],
    ["wrapChain add", code("0 2 4"), (c) => wrapChain(c, "mel", "add", 'n("<0 2>")')],
    ["rewriteDegrees nested", code("0 [2 [4 6]] ~"), (c) => rewriteDegrees(c, "mel", (d) => d - 3)],
    ["rewriteDegrees alternation", code("<0 2> ~ 4"), (c) => rewriteDegrees(c, "mel", (d) => d + 1)],
    ["invertAroundCentre negative", code("-3 0 2 5"), (c) => invertAroundCentre(c, "mel")],
    [
      "invertAroundCentre existing add",
      code("0 2 4").replace(".scale(", '.add(n("<0 2>")).scale('),
      (c) => invertAroundCentre(c, "mel"),
    ],
    ["retrogradePitches nested", code("[0 [2 4]] ~ 6"), (c) => retrogradePitches(c, "mel")],
    ["retrogradePitches alternation", code("<0 2> ~ 4@2"), (c) => retrogradePitches(c, "mel")],
    ["rotatePitches weighted", code("0@2 2 7 ~"), (c) => rotatePitches(c, "mel", 1)],
    ["rotatePitches nested alternation", code("[0 [2 4]] <7 ~ 9>"), (c) => rotatePitches(c, "mel", -2)],
  ];
  for (const [name, input, rewrite] of cases) {
    test(name, async () => {
      const output = rewrite(input);
      expect(output).not.toBe(input);
      expect(labels(output)).toEqual(labels(input));
      const after = await strudel(output, 4);
      expect(after.byTrack.mel?.length).toBeGreaterThan(0);
      if (name.startsWith("rotatePitches")) {
        const before = await strudel(input, 4);
        for (const track of Object.keys(before.byTrack)) {
          expect(after.byTrack[track]?.map((e) => [e.onset, e.dur])).toEqual(
            before.byTrack[track]?.map((e) => [e.onset, e.dur]),
          );
        }
      }
      expect(rewrite(input)).toBe(output);
    });
  }
});

describe("AC3 chain insertion boundaries", () => {
  const input = `// keep the tempo\nsetcpm(90/4)\nmel: n("0 2 4") /* degrees */\n  .scale("C:major") /* sound */ .s("sine"); // end\ndrums: s("bd*2")\n`;
  for (const method of ["rev", "early", "late", "scaleTranspose", "ply", "segment"]) {
    test(`${method} goes immediately after scale and preserves every other byte`, () => {
      const inserted = `.${method}(1)`;
      const output = wrapChain(input, "mel", method, "1");
      expect(output).toBe(input.replace('.scale("C:major")', `.scale("C:major")${inserted}`));
      expect(output.replace(inserted, "")).toBe(input);
      expect(labels(output)).toEqual(labels(input));
    });
  }
  test("add with n goes before scale and preserves every other byte", () => {
    const inserted = '.add(n("<0 2>"))';
    const output = wrapChain(input, "mel", "add", 'n("<0 2>")');
    expect(output).toBe(input.replace('n("0 2 4")', `n("0 2 4")${inserted}`));
    expect(output.replace(inserted, "")).toBe(input);
  });
  test("sound goes at the chain end and preserves every other byte", () => {
    const inserted = '.s("piano")';
    const output = wrapChain(input, "mel", "s", '"piano"');
    expect(output).toBe(input.replace('.s("sine")', `.s("sine")${inserted}`));
    expect(output.replace(inserted, "")).toBe(input);
  });
  test("without scale and for numeric add the call goes at the end", () => {
    expect(wrapChain('mel: n("0 2").s("piano")', "mel", "rev", "")).toBe('mel: n("0 2").s("piano").rev()');
    expect(wrapChain(input, "mel", "add", "2")).toBe(input.replace('.s("sine")', '.s("sine").add(2)'));
  });
});

describe("degree atom edits", () => {
  test("only pitches change; rests, stacks, weights, repetition and nested operators survive", () => {
    const input = code("[-2,0] <1 ~> [3 4]*2 5@3 6(3,8) 7/2");
    expect(rewriteDegrees(input, "mel", (d) => d - 3)).toBe(code("[-5,-3] <-2 ~> [0 1]*2 2@3 3(3,8) 4/2"));
  });
  test("weighted-pattern regression: whitespace after @2 is not a pitch", () => {
    const input = code("0@2 2 7 ~");
    expect(retrogradePitches(input, "mel")).toBe(code("7@2 2 0 ~"));
    expect(invertAroundCentre(input, "mel")).toBe(code("7@2 5 0 ~"));
    expect(rewriteDegrees(input, "mel", (d) => d - 3)).toBe(code("-3@2 -1 4 ~"));
    expect(rotatePitches(input, "mel", 1)).toBe(code("2@2 7 0 ~"));
  });
  test("suffixes and nested operator operands are never rewritten", () => {
    const input = code("0:2 1!2 2 _ 3? 4*<2 3> {5 [6 7]}%4 <8@2 9>");
    expect(rewriteDegrees(input, "mel", (d) => d + 10)).toBe(
      code("10:2 11!2 12 _ 13? 14*<2 3> {15 [16 17]}%4 <18@2 19>"),
    );
    expect(rotatePitches(input, "mel", 1)).toBe(code("1:2 2!2 3 _ 4? 5*<2 3> {6 [7 8]}%4 <9@2 0>"));
    expect(retrogradePitches(input, "mel")).toBe(code("9:2 8!2 7 _ 6? 5*<2 3> {4 [3 2]}%4 <1@2 0>"));
  });
  test("tabs and newlines after weights preserve their exact positions", () => {
    const input = 'mel: n(`0@2 \t  2!3\n  7 _\n -4`).scale("C4:major")';
    expect(rotatePitches(input, "mel", 1)).toBe('mel: n(`2@2 \t  7!3\n  -4 _\n 0`).scale("C4:major")');
  });
  test("only the first n string changes, including when a later add has its own n", () => {
    const input = 'mel: n("0 2").add(n("<0 2>")).scale("C4:major")\nmel2: n("0 2")';
    expect(rewriteDegrees(input, "mel", (d) => d + 2)).toBe(
      'mel: n("2 4").add(n("<0 2>")).scale("C4:major")\nmel2: n("0 2")',
    );
  });
  test("backtick mini-notation preserves its layout", () => {
    expect(retrogradePitches("mel: n(`0 [2 ~ 4]`)", "mel")).toBe("mel: n(`4 [2 ~ 0]`)");
  });
  test("no n mini-string or no pitches leaves the code untouched", () => {
    for (const input of ['mel: note("c4 e4 g4")', 'mel: n("~ ~")', "mel: n(2)", "mel: n('0 2')"]) {
      for (const rewrite of [
        rewrites.rewriteDegrees,
        invertAroundCentre,
        retrogradePitches,
        rewrites.rotatePitches,
      ])
        expect(rewrite(input, "mel")).toBe(input);
    }
  });
  test("retrograde reverses pitches across nested positions, not sub-patterns", () => {
    expect(retrogradePitches(code("0 [2 ~ [4 7]] <9 11>@2"), "mel")).toBe(code("11 [9 ~ [7 4]] <2 0>@2"));
  });
});

describe("rotation table", () => {
  const cases: [string, number, string][] = [
    ["0 2 4", 1, "2 4 0"],
    ["0 2 4", -1, "4 0 2"],
    ["0 2 4", 5, "4 0 2"],
    ["0 2 4", -7, "4 0 2"],
    ["-3 0 5", 2, "5 -3 0"],
    ["7 7 7", 1, "7 7 7"],
    ["0@2 2 7 ~", 1, "2@2 7 0 ~"],
    ["[0 ~ [2 4]] <7 9>@2", 2, "[4 ~ [7 9]] <0 2>@2"],
    ["-0 02 4", 0, "-0 02 4"],
    ["-0 02 4", 6, "-0 02 4"],
    ["-0 02 4", -3, "-0 02 4"],
    ["-3", 100, "-3"],
  ];
  for (const [mini, k, expected] of cases) {
    test(`${mini} rotated by ${k}`, () => {
      expect(rotatePitches(code(mini), "mel", k)).toBe(code(expected));
    });
  }
});

describe("AC4 inversion keeps the range", () => {
  const cases = [
    [0, 2, 4],
    [-4, -2, 0],
    [-3, 0, 5],
    [7, 7, 7],
    [0],
    [-6],
    [0, 7],
    [9, 2, 5, 3],
    [-9, -2, -5],
    [12, 0, 4, 7],
    [-12, 12, 0, 6],
    [1, 2, 1, 2, 1],
  ];
  for (const values of cases) {
    test(`range and reflected values for ${values.join(" ")}`, () => {
      const input = code(values.join(" "));
      const output = invertAroundCentre(input, "mel");
      const min = Math.min(...values);
      const max = Math.max(...values);
      const expected = values.map((d) => min + max - d);
      expect(output).toBe(code(expected.join(" ")));
      expect(Math.min(...expected)).toBe(min);
      expect(Math.max(...expected)).toBe(max);
      expect(invertAroundCentre(output, "mel")).toBe(input);
    });
  }
});

describe("AC5 retrograde keeps evaluated onsets exactly", () => {
  for (const mini of ["0 ~ 2 4", "0@2 2 7 ~", "[0 [2 4]] ~ 7*2", "<0 2> [4 ~ 7]"]) {
    test(mini, async () => {
      const input = code(mini);
      const before = await strudel(input, 4);
      const after = await strudel(retrogradePitches(input, "mel"), 4);
      expect(after.byTrack.mel?.length).toBeGreaterThan(0);
      for (const track of Object.keys(before.byTrack)) {
        expect(after.byTrack[track]?.map((e) => e.onset)).toEqual(before.byTrack[track]?.map((e) => e.onset));
        expect(after.byTrack[track]?.map((e) => e.dur)).toEqual(before.byTrack[track]?.map((e) => e.dur));
      }
    });
  }
});
