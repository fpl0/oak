// The dependency direction of docs/design/interfaces.md §2, checked on the source text of every
// package, the app and the server. Types cannot enforce it (packages are linked as source, so one
// program sees everything); this test does.
//
//   1. Only @oak/strudel and @oak/grader import Strudel packages, and the grader only the four headless ones.
//      Tests elsewhere evaluate Strudel through "@oak/grader/testing".
//   2. A package imports only the @oak packages listed for it below. Test files are exempt from this rule.
//   3. Isomorphic packages use no Bun or Node API outside *.bun.ts and tests.
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { Glob } from "bun";

const ROOT = new URL("..", import.meta.url).pathname;

/** Who may import whom. `@oak/x/sub` counts as `@oak/x`. */
const ALLOWED: Record<string, string[]> = {
  "content-kit": [],
  api: ["content-kit"],
  theory: ["content-kit"],
  // Wave 5: the `notates` rule (C3's lead sheet) engraves through @oak/notation with `approximate = false`
  // (docs/design/wave5.md §1, grader seam). Notation is isomorphic and never imports the grader.
  grader: ["content-kit", "theory", "notation"],
  notation: ["content-kit", "theory"],
  pitch: ["content-kit", "theory"],
  drills: ["content-kit", "theory", "pitch"],
  srs: ["content-kit"],
  // Oak 2.0 W4 (X19): the audibility harness re-exports the BS.1770 loudness from `@oak/audio/loudness`, one
  // implementation shared with the album normalisation. `@oak/audio` never imports `@oak/strudel`, so there is no cycle.
  strudel: ["content-kit", "theory", "grader", "drills", "audio"],
  audio: ["content-kit", "theory", "pitch"],
};
const ISOMORPHIC = ["content-kit", "api", "theory", "grader", "notation", "pitch", "drills", "srs"];
const SERVER_MAY = ["api", "content-kit", "theory", "grader", "notation", "pitch", "drills", "srs"];
const HEADLESS_STRUDEL = ["@strudel/core", "@strudel/mini", "@strudel/tonal", "@strudel/transpiler"];

const isStrudel = (spec: string): boolean =>
  spec.startsWith("@strudel/") || spec === "superdough" || spec.startsWith("superdough/");
// Test-only support files (`*.test-util.ts`, `*.test-data.ts`) count as tests.
const isTest = (file: string): boolean => /\.(test|pw|test-util|test-data)\.tsx?$/.test(file);
const oakPackage = (spec: string): string | null => /^@oak\/([a-z-]+)/.exec(spec)?.[1] ?? null;

const IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

async function importsOf(dir: string): Promise<{ file: string; spec: string }[]> {
  const out: { file: string; spec: string }[] = [];
  // app/, content/ and parts of server/ arrive later in the wave.
  if (!existsSync(ROOT + dir)) return out;
  for await (const file of new Glob("**/*.{ts,tsx}").scan({ cwd: ROOT + dir })) {
    if (file.includes("node_modules/")) continue;
    const text = await Bun.file(`${ROOT}${dir}/${file}`).text();
    for (const m of text.matchAll(IMPORT))
      out.push({ file: `${dir}/${file}`, spec: (m[1] ?? m[2]) as string });
  }
  return out;
}

test("the import scanner sees static, type, re-export and dynamic imports", () => {
  const sample =
    'import a from "x";\nimport type { B } from "@oak/api";\nexport * from "./c.ts";\nconst d = await import("@strudel/core");\nimport "side";\n// a "string" that is not an import';
  expect([...sample.matchAll(IMPORT)].map((m) => m[1] ?? m[2])).toEqual([
    "x",
    "@oak/api",
    "./c.ts",
    "@strudel/core",
    "side",
  ]);
});

test("Strudel packages are imported only by @oak/strudel and @oak/grader", async () => {
  const offenders: string[] = [];
  for (const pkg of Object.keys(ALLOWED)) {
    for (const { file, spec } of await importsOf(`packages/${pkg}/src`)) {
      if (!isStrudel(spec)) continue;
      if (pkg === "strudel") continue;
      if (pkg === "grader" && HEADLESS_STRUDEL.includes(spec)) continue;
      offenders.push(`${file} imports ${spec}`);
    }
  }
  for (const dir of ["app/src", "server/src", "content", "scripts/content"]) {
    for (const { file, spec } of await importsOf(dir))
      if (isStrudel(spec)) offenders.push(`${file} imports ${spec}`);
  }
  expect(offenders).toEqual([]);
});

test("packages import only the @oak packages below them", async () => {
  const offenders: string[] = [];
  for (const [pkg, allowed] of Object.entries(ALLOWED)) {
    for (const { file, spec } of await importsOf(`packages/${pkg}/src`)) {
      const dep = oakPackage(spec);
      if (!dep || dep === pkg || isTest(file)) continue;
      if (!allowed.includes(dep)) offenders.push(`${file} imports ${spec}`);
    }
  }
  for (const { file, spec } of await importsOf("server/src")) {
    const dep = oakPackage(spec);
    if (dep && !SERVER_MAY.includes(dep) && !isTest(file))
      offenders.push(`${file} imports ${spec} (browser-only package)`);
  }
  expect(offenders).toEqual([]);
});

test("the allowed graph has no cycle", () => {
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (pkg: string, trail: string[]): void => {
    if (done.has(pkg)) return;
    if (visiting.has(pkg)) throw new Error(`cycle: ${[...trail, pkg].join(" → ")}`);
    visiting.add(pkg);
    for (const dep of ALLOWED[pkg] ?? []) visit(dep, [...trail, pkg]);
    visiting.delete(pkg);
    done.add(pkg);
  };
  for (const pkg of Object.keys(ALLOWED)) visit(pkg, []);
  expect(done.size).toBe(Object.keys(ALLOWED).length);
});

test("isomorphic packages use no Bun or Node API outside *.bun.ts and tests", async () => {
  const offenders: string[] = [];
  for (const pkg of ISOMORPHIC) {
    for (const { file, spec } of await importsOf(`packages/${pkg}/src`)) {
      if (isTest(file) || file.endsWith(".bun.ts")) continue;
      if (spec === "bun" || spec.startsWith("bun:") || spec.startsWith("node:"))
        offenders.push(`${file} imports ${spec}`);
    }
  }
  expect(offenders).toEqual([]);
});

test("every package exports TypeScript source and has its own tsconfig", async () => {
  for (const pkg of Object.keys(ALLOWED)) {
    const manifest = (await Bun.file(`${ROOT}packages/${pkg}/package.json`).json()) as {
      name: string;
      exports: Record<string, string>;
    };
    expect(manifest.name).toBe(`@oak/${pkg}`);
    expect(manifest.exports["."]).toBe("./src/index.ts");
    for (const target of Object.values(manifest.exports))
      expect([target, await Bun.file(`${ROOT}packages/${pkg}/${target}`).exists()]).toEqual([target, true]);
    expect(await Bun.file(`${ROOT}packages/${pkg}/tsconfig.json`).exists()).toBe(true);
  }
});
