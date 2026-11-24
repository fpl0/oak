// A derived file is kept on --update when its recipe is unchanged, so every line of code that shapes its audio
// must be in the recipe's code hash. These tests pin that: the renderer lives in hashed files (render.ts and
// what it imports), mirror.ts (not hashed) holds none of it, and an edit to the renderer changes the hashes.
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codeFiles, codeHash, RECIPE_CODE, relativeImports } from "./recipe.ts";

const DIR = import.meta.dirname;
const read = (f: string) => readFileSync(join(DIR, f), "utf8");

describe("recipe code sets", () => {
  test("pitched files and kits hash the renderer and everything it runs", () => {
    for (const kind of ["pitched", "kit"] as const) {
      const files = codeFiles(RECIPE_CODE[kind]);
      for (const f of ["render.ts", "audio.ts", "dsp.ts", "brk.ts", "library.ts"]) expect(files).toContain(f);
      expect(files).not.toContain("mirror.ts");
    }
    expect(codeFiles(RECIPE_CODE.kit)).toEqual(expect.arrayContaining(["flac.ts", "drummachine.ts"]));
    expect(codeFiles(RECIPE_CODE.brk)).toEqual(
      expect.arrayContaining(["breaks.ts", "audio.ts", "dsp.ts", "flac.ts", "brk.ts"]),
    );
    // audio.ts writes WAV through brk.ts, so a table depends on it too
    expect(codeFiles(RECIPE_CODE.table)).toEqual(["audio.ts", "brk.ts", "wavetables.ts"]);
  });

  test("each set is closed over the value imports of its files (type-only imports do not count)", () => {
    for (const set of Object.values(RECIPE_CODE)) {
      const files = codeFiles(set);
      for (const f of files)
        for (const i of relativeImports(read(f)))
          if (i.values.length)
            expect({ from: f, dep: i.path, inSet: files.includes(i.path) }).toMatchObject({ inSet: true });
    }
  });

  test("relativeImports tells value imports from type-only ones", () => {
    const src = [
      'import { a, type B } from "./x.ts";',
      'import type { C } from "./y.ts";',
      'import {\n  type D,\n  type E,\n} from "./z.ts";',
      'import "./side.ts";',
      'import * as ns from "./ns.ts";',
      'import { readFile } from "node:fs/promises";',
    ].join("\n");
    expect(relativeImports(src)).toEqual([
      { path: "x.ts", values: ["a"] },
      { path: "y.ts", values: [] },
      { path: "z.ts", values: [] },
      { path: "side.ts", values: ["(side effect)"] },
      { path: "ns.ts", values: ["ns"] },
    ]);
  });
});

describe("mirror.ts holds no audio-shaping code", () => {
  const mirror = read("mirror.ts");

  test("the level, trim, filter and mixdown steps are not defined there", () => {
    for (const name of ["levelled", "renderNote", "renderHit", "renderOneShot", "mixdown", "codeHash"])
      expect(mirror).not.toMatch(new RegExp(`function ${name}\\b`));
    expect(mirror).not.toMatch(/PIANO_RMS400_DB\s*=/);
  });

  test("it imports only decoding and file-writing helpers from the DSP modules", () => {
    const byPath = new Map(relativeImports(mirror).map((i) => [i.path, i.values]));
    for (const name of byPath.get("audio.ts") ?? [])
      expect(["decodeAudio", "toRate", "RATE", "wav16"]).toContain(name);
    expect(byPath.get("dsp.ts") ?? []).toEqual([]);
  });
});

describe("codeHash", () => {
  const edits: [string, string, string, string[]][] = [
    // file, from, to, kinds whose hash must change
    ["render.ts", "PIANO_RMS400_DB = -21", "PIANO_RMS400_DB = -18", ["pitched", "kit"]],
    ["render.ts", "fadeMs: 150", "fadeMs: 90", ["pitched", "kit"]],
    ["dsp.ts", "export function biquad(", "// edited\nexport function biquad(", ["pitched", "kit", "brk"]],
    ["brk.ts", "export function encodeWav(", "// edited\nexport function encodeWav(", ["table"]],
  ];
  for (const [file, from, to, kinds] of edits)
    test(`an edit to ${file} (${to.split("\n")[0]}) changes the ${kinds.join(", ")} hash`, () => {
      const tmp = mkdtempSync(join(tmpdir(), "oak-recipe-"));
      try {
        cpSync(DIR, tmp, { recursive: true });
        const before = Object.fromEntries(
          Object.entries(RECIPE_CODE).map(([k, set]) => [k, codeHash(set, tmp)]),
        );
        const src = readFileSync(join(tmp, file), "utf8");
        expect(src).toContain(from);
        writeFileSync(join(tmp, file), src.replace(from, to));
        for (const kind of kinds)
          expect(codeHash(RECIPE_CODE[kind as keyof typeof RECIPE_CODE], tmp)).not.toBe(before[kind]);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });

  test("mirror.ts is not part of any recipe (a log line there re-renders nothing)", () => {
    for (const set of Object.values(RECIPE_CODE)) expect(codeFiles(set)).not.toContain("mirror.ts");
  });
});
