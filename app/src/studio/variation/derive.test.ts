// Oak 2.0 W3 (PLAN §4 S5 "Derive a part"): a new part written from an existing one, as a new labelled line after its
// source. The source lines stay as they are. Values checked headlessly.
import { describe, expect, test } from "bun:test";
import { isDescriptive, PLAIN_SOUNDS } from "@oak/content-kit";
import { evalHeadless } from "@oak/grader/testing";
import { DERIVE_WORDS, deriveRhythm, drumsAsMelody, freeLabel, melodyAsDrums } from "./derive.ts";

const S = 'mel: n("0 2 4 7").scale("C4:major").s("piano")';

function made(r: ReturnType<typeof deriveRhythm>): { code: string; label: string } {
  if (!("code" in r)) throw new Error(`unchanged: ${r.unchanged}`);
  return r;
}
const track = async (code: string, label: string) =>
  (await evalHeadless(code, 1)).events.filter((e) => e.track === label);

describe("freeLabel", () => {
  test("the base when unused, else the next number", () => {
    expect(freeLabel('drums: s("bd")', "mel")).toBe("mel");
    expect(freeLabel(`${S}\nmel2: n("0")`, "mel")).toBe("mel3");
    expect(freeLabel(`_mel: n("0")`, "mel")).toBe("mel2");
  });
});

describe("deriveRhythm", () => {
  test("one line's rhythm on another line's notes, right after the notes line", async () => {
    const code = `drums: s("bd ~ sd bd")\n${S}\nbass: note("c2").s("triangle")`;
    const r = made(deriveRhythm(code, { rhythmFrom: "drums", notesFrom: "mel" }));
    expect(r.label).toBe("mel2");
    expect(r.code).toBe(
      `drums: s("bd ~ sd bd")\n${S}\nmel2: n("0 2 4 7").scale("C4:major").s("piano").struct("x ~ x x")\nbass: note("c2").s("triangle")`,
    );
    const events = await track(r.code, "mel2");
    expect(events.map((e) => e.onset)).toEqual([0, 0.5, 0.75]);
    expect(events.map((e) => e.midi)).toEqual([60, 67, 72]);
  });
  test("a rhythm Oak cannot read, or the same line twice, leaves the code", () => {
    const code = `const g = "bd sd"\ndrums: s(g)\n${S}`;
    const a = deriveRhythm(code, { rhythmFrom: "drums", notesFrom: "mel" });
    const b = deriveRhythm(code, { rhythmFrom: "mel", notesFrom: "mel" });
    const c = deriveRhythm(code, { rhythmFrom: "mel", notesFrom: "bass" });
    for (const r of [a, b, c]) {
      if (!("unchanged" in r)) throw new Error("changed");
      expect(isDescriptive(r.unchanged)).toBe(true);
    }
  });
});

describe("drumsAsMelody", () => {
  test("the drum rhythm as a tune in the key, with Oak's plain tune sound", async () => {
    const r = made(drumsAsMelody('drums: s("bd ~ sd bd")', "drums", null));
    expect(r.label).toBe("mel");
    expect(r.code).toBe(
      `drums: s("bd ~ sd bd")\nmel: n("0 ~ 4 0").scale("C4:major").s("${PLAIN_SOUNDS.tune}")`,
    );
    expect((await track(r.code, "mel")).map((e) => e.midi)).toEqual([60, 67, 60]);
  });
  test("the sketch's key when it has one", () => {
    const r = made(drumsAsMelody('drums: s("bd hh")', "drums", { tonic: "A", mode: "minor" }));
    expect(r.code).toContain('n("0 7").scale("A4:minor")');
  });
  test("a line that is not drums leaves the code", () => {
    const r = drumsAsMelody(S, "mel", null);
    if (!("unchanged" in r)) throw new Error("changed");
    expect(isDescriptive(r.unchanged)).toBe(true);
  });
});

describe("melodyAsDrums", () => {
  test("the tune's rhythm on one drum, every note kept", async () => {
    const r = made(melodyAsDrums(`drums: s("bd*4")\n${S}`, "mel", "sd"));
    expect(r.label).toBe("drums2");
    expect(r.code).toBe(`drums: s("bd*4")\n${S}\ndrums2: s("sd").struct("x x x x")`);
    expect(await track(r.code, "drums2")).toHaveLength(4);
  });
});

describe("every note only describes", () => {
  test("the words", () => {
    for (const text of Object.values(DERIVE_WORDS)) expect(isDescriptive(text)).toBe(true);
  });
});
