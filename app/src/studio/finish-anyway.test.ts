// Oak 2.0 W4 F6 "Finish it anyway" (DeSantis, Fail Better; Arranging as a Subtractive Process): how far a piece is
// arranged, filling the parts that are not in sections yet, and carving a part out of a section as visible code.
import { describe, expect, test } from "bun:test";
import { lintBase } from "@oak/grader";
import { evalHeadless } from "@oak/grader/testing";
import { isDescriptive } from "./descriptive.ts";
import { arrangementState, carveCell, FINISH_COPY, fillTheRest, sectionGrid } from "./finish-anyway.ts";

const HALF = [
  "setcpm(100/4)",
  "",
  'const drumsA = s("bd ~ sd ~")',
  'const drumsB = s("bd bd sd ~")',
  "drums: arrange([4, drumsA], [4, drumsB])",
  'bass: note("c2")',
  "",
].join("\n");
const WHOLE = [
  "setcpm(100/4)",
  'const drumsA = s("bd ~ sd ~")',
  'const drumsB = s("bd bd sd ~")',
  'const bassA = note("c2")',
  "drums: arrange([4, drumsA], [4, drumsB])",
  "bass: arrange([4, bassA], [4, bassA])",
].join("\n");
const barsOf = (events: readonly { track: string; onset: number }[], track: string): number[] =>
  [...new Set(events.filter((e) => e.track === track).map((e) => Math.floor(e.onset + 1e-9)))].sort(
    (a, b) => a - b,
  );

describe("arrangementState", () => {
  test("none, half and whole, over the unmuted labelled lines", () => {
    expect(arrangementState('drums: s("bd*4")\nbass: note("c2")')).toBe("none");
    expect(arrangementState(HALF)).toBe("half");
    expect(arrangementState(WHOLE)).toBe("whole");
    // A muted part does not count either way.
    expect(arrangementState(`${WHOLE}\n_mel: note("c4")`)).toBe("whole");
    expect(arrangementState('_bass: note("c2")')).toBe("none");
    expect(arrangementState("setcpm(90/4)\n// nothing yet")).toBe("none");
  });
});

describe("fillTheRest", () => {
  test("each part not in sections plays in every section, one const per section name", async () => {
    const r = fillTheRest(HALF);
    if (!("code" in r)) throw new Error(r.error);
    expect(r.code).toContain('const bassA = note("c2")\nconst bassB = note("c2")');
    expect(r.code).toContain("bass: arrange([4, bassA], [4, bassB])");
    expect(r.code).toContain("drums: arrange([4, drumsA], [4, drumsB])");
    expect(arrangementState(r.code)).toBe("whole");
    // The sections read the same in every part, so the code runs (an "all" section beside "a" and "b" would not).
    expect(lintBase(r.code).filter((d) => d.severity === "error")).toEqual([]);
    const { events } = await evalHeadless(r.code, 8);
    expect(barsOf(events, "bass")).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  test("a whole arrangement, none at all, and sections of different lengths are refused", () => {
    expect(fillTheRest(WHOLE)).toEqual({ error: "nothing-to-fill" });
    expect(fillTheRest('drums: s("bd*4")\nbass: note("c2")')).toEqual({ error: "no-sections" });
    const mixed = [
      'const a = s("bd*4")',
      'const b = s("sd*4")',
      'const c = note("c3")',
      "drums: arrange([4, a], [4, b])",
      "chords: arrange([8, c])",
      'bass: note("c2")',
    ].join("\n");
    expect(fillTheRest(mixed)).toEqual({ error: "mixed-sections" });
  });
  test("a taken name gets a number; a section that comes back is one const; a carved section keeps its name", () => {
    const taken = fillTheRest(`const bassA = note("e2")\n${HALF}`);
    if (!("code" in taken)) throw new Error(taken.error);
    expect(taken.code).toContain('const bassA2 = note("c2")\nconst bassB = note("c2")');
    expect(taken.code).toContain("bass: arrange([4, bassA2], [4, bassB])");
    const aba = [
      'const drumsA = s("bd ~ sd ~")',
      'const drumsB = s("bd bd sd ~")',
      "drums: arrange([4, drumsA], [4, silence /* drumsB */], [4, drumsA])",
      'mel: n("0 2").scale("C4:major")',
    ].join("\n");
    const r = fillTheRest(aba);
    if (!("code" in r)) throw new Error(r.error);
    expect(r.code.match(/const mel[AB] = /g)).toEqual(["const melA = ", "const melB = "]);
    expect(r.code).toContain("mel: arrange([4, melA], [4, melB], [4, melA])");
  });
});

describe("carveCell and sectionGrid", () => {
  test("a part left out of a section is silence that remembers its const; ticking it brings it back", async () => {
    const carved = carveCell(WHOLE, "drums", 1, false);
    expect(carved).toBe(WHOLE.replace("[4, drumsB]", "[4, silence /* drumsB */]"));
    expect(carveCell(carved, "drums", 1, true)).toBe(WHOLE);
    expect(sectionGrid(carved)?.plays[0]).toEqual([true, false]);
    expect(lintBase(carved).filter((d) => d.severity === "error")).toEqual([]);
    const { events } = await evalHeadless(carved, 8);
    expect(barsOf(events, "drums")).toEqual([0, 1, 2, 3]);
  });
  test("the grid: parts in source order, sections with their bars, what plays where", () => {
    expect(sectionGrid(WHOLE)).toEqual({
      parts: ["drums", "bass"],
      sections: [{ bars: 4 }, { bars: 4 }],
      plays: [
        [true, true],
        [true, true],
      ],
    });
    expect(sectionGrid(HALF)).toBeNull();
    expect(
      sectionGrid(WHOLE.replace("bass: arrange([4, bassA], [4, bassA])", "bass: arrange([8, bassA])")),
    ).toBeNull();
  });
  test("an unknown part, a section out of range or a cell already as asked leaves the code alone", () => {
    expect(carveCell(WHOLE, "mel", 0, false)).toBe(WHOLE);
    expect(carveCell(WHOLE, "drums", 5, false)).toBe(WHOLE);
    expect(carveCell(WHOLE, "drums", 0, true)).toBe(WHOLE);
  });
});

test("every new string is descriptive", () => {
  for (const [k, v] of Object.entries(FINISH_COPY)) expect([k, isDescriptive(v)]).toEqual([k, true]);
});
