// Oak 2.0 W3 Task 1 (PLAN §4 S5 "Derive a part", "snap to the key"): the rewrites behind the Studio's derive and
// snap tools. Each reads one labelled line's mini-notation and writes visible code; every output evaluates.
import { describe, expect, test } from "bun:test";
import { evalHeadless, midisOf } from "../testing.ts";
import { drumsToDegrees, insertStatementAfter, rhythmMini, snapNotesToScale } from "./index.ts";

describe("rhythmMini", () => {
  test("every sounding leaf becomes x; rests, brackets and operators stay", () => {
    expect(rhythmMini('drums: s("bd ~ sd bd")', "drums")).toBe("x ~ x x");
    expect(rhythmMini('mel: n("0 [2 4] ~ 5").scale("C4:major")', "mel")).toBe("x [x x] ~ x");
    expect(rhythmMini('drums: s("bd*2 [~ sd]")', "drums")).toBe("x*2 [~ x]");
    expect(rhythmMini('drums: s("<bd sd> hh(3,8) cp@2 ~!")', "drums")).toBe("<x x> x(3,8) x@2 ~!");
    expect(rhythmMini('bass: note("c2 ~ g1 ~").s("ebass")', "bass")).toBe("x ~ x ~");
  });

  test("a sample number goes with its leaf", () => {
    expect(rhythmMini('drums: s("bd:3 sd")', "drums")).toBe("x x");
  });

  test("the line's own .struct wins over its head", () => {
    expect(rhythmMini('drums: s("bd").struct("x ~ x x")', "drums")).toBe("x ~ x x");
    // In a struct, 0 is a rest.
    expect(rhythmMini('drums: s("bd").struct("1 0 1 1")', "drums")).toBe("x ~ x x");
  });

  test("null for a const rhythm, a missing label or a head that is not s, sound, n or note", () => {
    expect(rhythmMini('const g = "bd sd"\ndrums: s(g)', "drums")).toBeNull();
    expect(rhythmMini('drums: s("bd sd")', "mel")).toBeNull();
    expect(rhythmMini("drums: s('bd sd')", "drums")).toBeNull();
    expect(rhythmMini('drums: stack(s("bd"), s("sd"))', "drums")).toBeNull();
  });

  test("melody as drums keeps every note, degree 0 included", async () => {
    const mini = rhythmMini('mel: n("0 2 4 7").scale("C4:major")', "mel");
    expect(mini).toBe("x x x x");
    const r = await evalHeadless(`drums2: s("sd").struct("${mini}")`, 1);
    expect(r.events.map((e) => e.onset)).toEqual([0, 0.25, 0.5, 0.75]);
    // The trap the x's avoid: in a struct, degree 0 is falsy and drops its note.
    const trap = await evalHeadless('drums2: s("sd").struct("0 2 4 7")', 1);
    expect(trap.events).toHaveLength(3);
  });
});

describe("drumsToDegrees", () => {
  const map = { bd: 0, sd: 4, hh: 7 };
  test("each drum name becomes its degree; rests stay", () => {
    expect(drumsToDegrees('drums: s("bd ~ sd hh")', "drums", map, 2)).toBe("0 ~ 4 7");
    expect(drumsToDegrees('drums: s("bd*2 [~ sd:1]")', "drums", map, 2)).toBe("0*2 [~ 4]");
  });
  test("a name not in the map takes the fallback", () => {
    expect(drumsToDegrees('drums: s("bd cp")', "drums", map, 2)).toBe("0 2");
  });
  test("null for a missing label, a const or a pitched line", () => {
    expect(drumsToDegrees('drums: s("bd")', "mel", map, 2)).toBeNull();
    expect(drumsToDegrees('const g = "bd"\ndrums: s(g)', "drums", map, 2)).toBeNull();
    expect(drumsToDegrees('mel: n("0 2")', "mel", map, 2)).toBeNull();
  });
});

describe("insertStatementAfter", () => {
  test("the new statement goes on its own line after the labelled statement", () => {
    const code = 'drums: s("bd") // kick\nmel: n("0")\n';
    expect(insertStatementAfter(code, "drums", 'x: s("hh")')).toBe(
      'drums: s("bd") // kick\nx: s("hh")\nmel: n("0")\n',
    );
    expect(insertStatementAfter('mel: n("0")\n  .scale("C4:major")', "mel", 'x: s("hh")')).toBe(
      'mel: n("0")\n  .scale("C4:major")\nx: s("hh")',
    );
  });
  test("a missing label leaves the code", () => {
    expect(insertStatementAfter('drums: s("bd")', "mel", 'x: s("hh")')).toBe('drums: s("bd")');
  });
});

describe("snapNotesToScale", () => {
  const C = { tonic: "C", mode: "major" } as const;
  test("letter names move to the nearest scale tone, ties upward, spelled from the key", async () => {
    const out = snapNotesToScale('mel: note("c4 eb4 f#4 a4").s("piano")', "mel", C);
    expect(out).toBe('mel: note("c4 e4 g4 a4").s("piano")');
    expect(await midisOf(out)).toEqual([60, 64, 67, 69]);
  });
  test("MIDI numbers stay numbers", async () => {
    const out = snapNotesToScale('mel: note("60 63 66")', "mel", C);
    expect(out).toBe('mel: note("60 64 67")');
    expect(await midisOf(out)).toEqual([60, 64, 67]);
  });
  test("A minor: g#4 goes up to a4", async () => {
    const out = snapNotesToScale('mel: note("g#4 c5")', "mel", { tonic: "A", mode: "minor" });
    expect(out).toBe('mel: note("a4 c5")');
    expect(await midisOf(out)).toEqual([69, 72]);
  });
  test("a sharp key spells its own sharps; chords snap note by note", async () => {
    const out = snapNotesToScale('chords: note("<[c4,f4,a4]>")', "chords", { tonic: "D", mode: "major" });
    expect(out).toBe('chords: note("<[c#4,f#4,a4]>")');
    expect(await midisOf(out)).toEqual([61, 66, 69]);
  });
  test("an n() line, a line already in the key and a missing label are left as they are", () => {
    const n = 'mel: n("0 2").scale("C4:major")';
    expect(snapNotesToScale(n, "mel", C)).toBe(n);
    const inKey = 'mel: note("c4 e4 g4")';
    expect(snapNotesToScale(inKey, "mel", C)).toBe(inKey);
    expect(snapNotesToScale(inKey, "bass", C)).toBe(inKey);
  });
});
