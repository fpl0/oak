// Oak 2.0 W1 (S3): the takes of a jam (newest first, cut ones hidden unless asked) and a version built from them.
import { describe, expect, test } from "bun:test";
import type { SketchVersion } from "@oak/api";
import { labelledLines } from "@oak/content-kit";
import { evalHeadless } from "@oak/grader/testing";
import { isDescriptive } from "./descriptive.ts";
import { buildFromTakes, builtNote, showCutWords, TAKES_WORDS, takesOf } from "./takes.ts";

const v = (
  version: number,
  takeState: SketchVersion["takeState"],
  code = 'drums: s("bd")',
): SketchVersion => ({
  sketchId: "sk_1",
  version,
  code,
  bpm: null,
  meter: "4/4",
  key: null,
  analysis: null,
  note: null,
  tutorAssisted: false,
  band: null,
  flags: { lockedTools: [], previewTools: [] },
  createdAt: `2026-11-25T10:0${version}:00.000Z`,
  takeState,
  parentVersion: null,
  generation: null,
  dimension: null,
});

describe("takesOf", () => {
  const versions = [v(1, null), v(2, "open"), v(3, "cut"), v(4, "kept"), v(5, null), v(6, "open")];

  test("cut takes are hidden unless shown; ordinary Runs never listed; newest first", () => {
    expect(takesOf(versions, { showCut: false }).map((x) => x.version)).toEqual([6, 4, 2]);
    expect(takesOf(versions, { showCut: true }).map((x) => x.version)).toEqual([6, 4, 3, 2]);
  });

  test("a 1.x row without takeState is not a take", () => {
    const { takeState: _t, ...old } = v(7, null);
    expect(takesOf([old], { showCut: true })).toEqual([]);
  });
});

describe("buildFromTakes", () => {
  const take3 = {
    version: 3,
    code: 'setcpm(96/4)\nconst groove = "x ~ x ~"\ndrums: s("bd").struct(groove)\nbass: note("c2").s("ebass")',
  };
  const take5 = {
    version: 5,
    code: 'setcpm(100/4)\ndrums: s("bd*4")\nmel: n("0 2").scale("C4:major").s("piano")',
  };

  test("build from takes keeps each picked line's consts and one line per label", async () => {
    const code = buildFromTakes([take3, take5], { drums: 3, mel: 5 });
    expect(code).toBe(
      [
        "setcpm(100/4)",
        "",
        'const groove = "x ~ x ~"',
        'drums: s("bd").struct(groove)',
        'mel: n("0 2").scale("C4:major").s("piano")',
      ].join("\n"),
    );
    expect(code.match(/const groove/g)).toHaveLength(1);
    expect(code).not.toContain("bass:");
    expect(labelledLines(code).map((l) => l.label)).toEqual(["drums", "mel"]);
    const { events } = await evalHeadless(code, 1);
    expect(events.some((e) => e.track === "drums")).toBe(true);
    expect(events.some((e) => e.track === "mel")).toBe(true);
  });

  test("a const shared by two picked lines is written once", () => {
    const a = { version: 1, code: 'const p = "0 2"\nmel: n(p).s("piano")' };
    const b = { version: 2, code: 'const p = "0 2"\nbass: n(p).sub(7).s("triangle")' };
    const code = buildFromTakes([a, b], { mel: 1, bass: 2 });
    expect(code.match(/const p =/g)).toHaveLength(1);
    expect(labelledLines(code).map((l) => l.label)).toEqual(["mel", "bass"]);
  });

  test("two different consts of one name are both kept: the later one is renamed where its line uses it", async () => {
    const a = { version: 1, code: 'setcpm(90/4)\nconst p = "0 2"\nmel: n(p).scale("C4:major").s("piano")' };
    const b = { version: 2, code: 'const p = "<0 4>"\nbass: n(p).scale("C2:major").s("triangle") // p here' };
    const code = buildFromTakes([a, b], { mel: 1, bass: 2 });
    expect(code).toBe(
      [
        "setcpm(90/4)",
        "",
        'const p = "0 2"',
        'mel: n(p).scale("C4:major").s("piano")',
        'const p2 = "<0 4>"',
        'bass: n(p2).scale("C2:major").s("triangle")',
      ].join("\n"),
    );
    const { events } = await evalHeadless(code, 1);
    expect(events.filter((e) => e.track === "bass")).toHaveLength(1);
    expect(events.filter((e) => e.track === "mel")).toHaveLength(2);
  });

  test("a label is not renamed with its const, and a string with the const's name is left alone", () => {
    const a = { version: 1, code: 'const groove = "x x"\ngroove: s("bd").struct(groove)' };
    const b = { version: 2, code: 'const groove = "x ~"\ndrums: s("groove").struct(groove)' };
    const code = buildFromTakes([a, b], { groove: 1, drums: 2 });
    expect(code).toContain('groove: s("bd").struct(groove)');
    expect(code).toContain('drums: s("groove").struct(groove2)');
    expect(code).toContain('const groove2 = "x ~"');
  });

  test("nothing picked: nothing written; no tempo anywhere: no tempo line", () => {
    expect(buildFromTakes([take3, take5], {})).toBe("");
    expect(buildFromTakes([{ version: 1, code: 'drums: s("bd")' }], { drums: 1 })).toBe('drums: s("bd")');
  });

  test("a pick whose take lacks the label is left out", () => {
    expect(buildFromTakes([take5], { bass: 5, drums: 5 })).toBe('setcpm(100/4)\n\ndrums: s("bd*4")');
  });

  test("the built version's note names its takes", () => {
    expect(builtNote({ drums: 5, mel: 3, bass: 5 })).toBe("Built from takes 3, 5");
  });

  test("every takes string describes", () => {
    for (const s of [...Object.values(TAKES_WORDS), builtNote({ a: 1 }), showCutWords(2)])
      expect({ s, ok: isDescriptive(s) }).toEqual({ s, ok: true });
  });
});
