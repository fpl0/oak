import { describe, expect, test } from "bun:test";
import {
  areaOf,
  areaSpecs,
  because,
  buildGraph,
  bunfigIgnores,
  bunfigPreloads,
  type Graph,
  loadWorkspace,
  parseArgs,
  parseJsonc,
  planSpecs,
  planUnit,
  resolveSpecifier,
  templateGlob,
  unitConfig,
} from "./changed.ts";

/** A small repo in memory: path → source. */
const REPO: Record<string, string> = {
  "package.json": JSON.stringify({ workspaces: ["app", "packages/*"] }),
  "tsconfig.base.json": `{
    // comments and trailing commas, as tsconfig allows
    "compilerOptions": { "paths": { "@app/*": ["./app/src/*"], "@content/*": ["./content/*"], }, },
  }`,
  "app/package.json": JSON.stringify({ name: "@oak/app" }),
  "packages/theory/package.json": JSON.stringify({
    name: "@oak/theory",
    exports: { ".": "./src/index.ts", "./extra": { import: "./src/extra.ts" } },
  }),
  "packages/theory/src/index.ts": `export * from "./interval.ts";\nexport { scale } from "./scale";\nexport { other as renamed } from "./other.ts";`,
  "packages/theory/src/other.ts": "export const other = 3;",
  // Through the barrel by name: one name, the whole namespace, types only.
  "server/src/barrel/only.test.ts": `import {\n  interval,\n  type Note,\n} from "@oak/theory";`,
  "server/src/barrel/whole.test.ts": `import * as T from "@oak/theory";`,
  "server/src/barrel/renamed.test.ts": `import { renamed as r } from "@oak/theory"; // import { scale } from "@oak/theory"`,
  "server/src/barrel/types.test.ts": `import { type Note } from "@oak/theory";\nimport type { Other } from "@oak/theory";`,
  "packages/theory/src/interval.ts": `import type { Note } from "./types.ts";\nexport const interval = 1;`,
  "packages/theory/src/types.ts": "export type Note = string;",
  "packages/theory/src/scale/index.ts": `import { interval } from "../interval.js";\nexport const scale = interval;`,
  "packages/theory/src/extra.ts": "export const extra = 2;",
  "packages/theory/src/interval.test.ts": `import { interval } from "./interval.ts";`,
  "packages/theory/src/scale/scale.test.ts": `import { scale } from "./index.ts";`,
  "packages/theory/e2e/theory.pw.ts": `import { test } from "@playwright/test";`,
  // The app reaches the package by name, by subpath, and through an alias.
  "app/src/lesson/Player.tsx": `import { scale } from "@oak/theory";\nimport { extra } from "@oak/theory/extra";\nimport raw from "./words.txt?raw";\nexport const Player = () => scale + extra;`,
  "app/src/lesson/words.txt": "hello",
  "app/src/lesson/Player.test.tsx": `import { Player } from "@app/lesson/Player.tsx";`,
  "app/src/lesson/e2e/player.pw.ts": `import { test } from "@playwright/test";`,
  "app/src/lesson/e2e/checkpoint.pw.ts": `import { walk } from "./walk.ts";`,
  "app/src/lesson/e2e/walk.ts": `export const walk = () => import(\`../../../../content/core/\${"u"}/lesson.ts\`);`,
  "app/src/lesson/Checkpoint.tsx": "export const Checkpoint = 1;",
  "app/src/session/seeds/Seeds.tsx": "export const Seeds = 1;",
  "app/src/session/seeds/e2e/seeds.pw.ts": "",
  "app/src/session/Session.tsx": "export const Session = 1;",
  "app/src/session/e2e/session.pw.ts": "",
  "app/src/ui/Shared.tsx": "export const Shared = 1;",
  "app/src/ui/kit/Button.tsx": "export const Button = 1;",
  "app/src/ui/kit/e2e/kit.pw.ts": "",
  "app/src/ui/review/e2e/review.pw.ts": "",
  "app/src/routes/learn/$id.tsx": "export const Route = 1;",
  // A cycle: a ↔ b, a test of a.
  "server/src/a.ts": `import { b } from "./b.ts";\nexport const a = () => b;`,
  "server/src/b.ts": `import { a } from "./a.ts";\nexport const b = () => a;`,
  "server/src/a.test.ts": `import { a } from "./a.ts";\nconst fixture = { "tsconfig.base.json": "{}" };`,
  "server/src/gone.test.ts": `import { x } from "./gone.ts";`,
  // Content: a dynamic template import, the loader's walk, a fixture read by name, a snapshot.
  "content/lib/load.bun.ts": `export const load = 1;`,
  "content/index.ts": `import { load } from "./lib/load.bun.ts";`,
  "content/index.test.ts": `import "@content/index.ts";`,
  "content/core/U01/lesson.ts": "export default {};",
  "content/core/U01/lesson.mdx": "# U01",
  "content/core/grading.test.ts": `const m = await import(\`./\${"U01"}/lesson.ts\`);`,
  "content/validate/registries.test.ts": `const ids = readFileSync(join(dir, "fixture-ids.lock.json"));`,
  "content/fixture-ids.lock.json": "{}",
  "content/notes/fixture-data.json": "{}",
  "content/notes/reader.ts":
    "// Why: docs/fixture-decisions.md §3; `content/fixture-ids.lock.json` is the ledger.\nexport const r = 1;",
  "docs/fixture-decisions.md": "# Decisions",
  "content/notes/reader.test.ts": `import { r } from "./reader.ts";`,
  "app/src/album/__snapshots__/cover.test.ts.snap": "",
  "app/src/album/cover.test.ts": "",
  // Stale copies and installed packages are never read.
  "desktop/stage/content/core/U01/lesson.test.ts": `import "./lesson.ts";`,
  "node_modules/x/index.test.ts": `import "../../server/src/a.ts";`,
};

const read = (f: string): string | null => REPO[f] ?? null;
const FILES = Object.keys(REPO);
const WS = loadWorkspace(FILES, read);
const G: Graph = buildGraph(FILES, read, WS);
const has = (f: string): boolean => G.files.has(f);
const tests = (changed: string[]): string[] => planUnit(changed, G).tests.map((t) => t.file);

describe("resolution", () => {
  test("relative imports, with or without an extension, .js for .ts, and index files", () => {
    expect(resolveSpecifier("./interval.ts", "packages/theory/src/index.ts", WS, has)).toBe(
      "packages/theory/src/interval.ts",
    );
    expect(resolveSpecifier("./scale", "packages/theory/src/index.ts", WS, has)).toBe(
      "packages/theory/src/scale/index.ts",
    );
    expect(resolveSpecifier("../interval.js", "packages/theory/src/scale/index.ts", WS, has)).toBe(
      "packages/theory/src/interval.ts",
    );
  });
  test("@oak/* through the package exports, the tsconfig paths, and ?raw suffixes", () => {
    expect(resolveSpecifier("@oak/theory", "app/src/x.ts", WS, has)).toBe("packages/theory/src/index.ts");
    expect(resolveSpecifier("@oak/theory/extra", "app/src/x.ts", WS, has)).toBe(
      "packages/theory/src/extra.ts",
    );
    expect(resolveSpecifier("@app/lesson/Player.tsx", "x.ts", WS, has)).toBe("app/src/lesson/Player.tsx");
    expect(resolveSpecifier("@content/index.ts", "x.ts", WS, has)).toBe("content/index.ts");
    expect(resolveSpecifier("./words.txt?raw", "app/src/lesson/Player.tsx", WS, has)).toBe(
      "app/src/lesson/words.txt",
    );
  });
  test("installed packages and node: builtins are outside the graph; a deleted file keeps its path", () => {
    expect(resolveSpecifier("react", "app/src/x.ts", WS, has)).toBeNull();
    expect(resolveSpecifier("node:fs", "app/src/x.ts", WS, has)).toBeNull();
    expect(resolveSpecifier("./gone.ts", "server/src/gone.test.ts", WS, has)).toBe("server/src/gone.ts");
  });
  test("tsconfig with comments and trailing commas", () => {
    expect(parseJsonc(`{ // c\n "a": "x//y", /* b */ "c": [1,], }`)).toEqual({ a: "x//y", c: [1] });
  });
  test("a template-literal import is a glob", () => {
    expect(templateGlob(`../content/core/\${u}/\${l}/lesson.ts`)).toBe("../content/core/*/*/lesson.ts");
    expect(templateGlob(`\${ROOT}/x.ts`)).toBeNull();
    expect(templateGlob("./plain.ts")).toBeNull();
  });
});

describe("unit tests", () => {
  test("a changed test selects itself; a changed module selects the tests that import it", () => {
    expect(tests(["packages/theory/src/interval.test.ts"])).toEqual(["packages/theory/src/interval.test.ts"]);
    expect(tests(["packages/theory/src/extra.ts"])).toEqual(["app/src/lesson/Player.test.tsx"]);
  });
  test("transitively, through @oak/*, index files and aliases", () => {
    expect(tests(["packages/theory/src/interval.ts"])).toEqual([
      "app/src/lesson/Player.test.tsx",
      "packages/theory/src/interval.test.ts",
      "packages/theory/src/scale/scale.test.ts",
      "server/src/barrel/only.test.ts",
      "server/src/barrel/whole.test.ts",
    ]);
  });
  test("through a barrel only the importers of a changed name; --coarse takes every importer", () => {
    expect(tests(["packages/theory/src/other.ts"])).toEqual([
      "server/src/barrel/renamed.test.ts",
      "server/src/barrel/whole.test.ts",
    ]);
    expect(planUnit(["packages/theory/src/other.ts"], G, { coarse: true }).tests.map((t) => t.file)).toEqual([
      "app/src/lesson/Player.test.tsx",
      "server/src/barrel/only.test.ts",
      "server/src/barrel/renamed.test.ts",
      "server/src/barrel/whole.test.ts",
    ]);
  });
  test("type-only imports do not select (typecheck covers them)", () => {
    expect(tests(["packages/theory/src/types.ts"])).toEqual([]);
  });
  test("a cycle terminates and still selects", () => {
    expect(tests(["server/src/b.ts"])).toEqual(["server/src/a.test.ts"]);
  });
  test("a deleted file selects the tests that imported it", () => {
    expect(tests(["server/src/gone.ts"])).toEqual(["server/src/gone.test.ts"]);
  });
  test("template imports and the content loader reach lessons; the stale desktop copy and node_modules never count", () => {
    expect(tests(["content/core/U01/lesson.ts"])).toEqual([
      "content/core/grading.test.ts",
      "content/index.test.ts",
    ]);
    expect(tests(["content/core/U01/lesson.mdx"])).toEqual(["content/index.test.ts"]);
    expect(tests(["server/src/a.ts"])).toEqual(["server/src/a.test.ts"]);
  });
  test("a data file stands for the code that names it, else the code beside it; a snapshot for its test", () => {
    expect(tests(["content/fixture-ids.lock.json"])).toEqual(["content/validate/registries.test.ts"]);
    expect(tests(["content/notes/fixture-data.json"])).toEqual(["content/notes/reader.test.ts"]);
    expect(tests(["app/src/album/__snapshots__/cover.test.ts.snap"])).toEqual([
      "app/src/album/cover.test.ts",
    ]);
    // Prose that names a document is not a reader of it.
    expect(tests(["docs/fixture-decisions.md"])).toEqual([]);
  });
  test("the plan says why, and what no test reaches", () => {
    const p = planUnit(["packages/theory/src/interval.ts", "docs/x.md"], G);
    const player = p.tests.find((t) => t.file === "app/src/lesson/Player.test.tsx");
    expect(player?.chain).toEqual([
      "packages/theory/src/interval.ts",
      "packages/theory/src/index.ts",
      "app/src/lesson/Player.tsx",
      "app/src/lesson/Player.test.tsx",
    ]);
    expect(because(player as NonNullable<typeof player>)).toBe(
      "← packages/theory/src/interval.ts (via packages/theory/src/index.ts → app/src/lesson/Player.tsx)",
    );
    expect(p.uncovered).toEqual(["docs/x.md"]);
  });
  test("bunfig: ignored tests are reported, not run", () => {
    const p = planUnit(["server/src/a.ts"], G, { ignores: ["server/**"] });
    expect(p.tests).toEqual([]);
    expect(p.ignored).toEqual(["server/src/a.test.ts"]);
  });
});

describe("configs", () => {
  test("manifests, lockfile, tsconfigs, Biome, bunfig and its preloads affect everything", () => {
    const preloads = bunfigPreloads(`[test]\npreload = ["./test/setup.ts", "x.ts"]\n`);
    expect(preloads).toEqual(["test/setup.ts", "x.ts"]);
    for (const f of [
      "package.json",
      "packages/x/package.json",
      "bun.lock",
      "tsconfig.app.json",
      "biome.json",
      "bunfig.toml",
      "test/setup.ts",
    ])
      expect(unitConfig(f, { preloads })).not.toBeNull();
    expect(unitConfig("server/src/a.ts", { preloads })).toBeNull();
    // A package.json outside the workspace (the desktop app's) is not the workspace's manifest.
    const manifests = new Set(["package.json", "packages/x/package.json"]);
    expect(unitConfig("desktop/package.json", { manifests })).toBeNull();
    expect(unitConfig("packages/x/package.json", { manifests })).not.toBeNull();
    expect(planUnit(["tsconfig.base.json"], G)).toMatchObject({
      configs: [["tsconfig.base.json", "a tsconfig"]],
      tests: [],
    });
    expect(bunfigIgnores(`[test]\npathIgnorePatterns = ["spikes/**", "e2e/**"]`)).toEqual([
      "spikes/**",
      "e2e/**",
    ]);
  });
});

describe("browser specs", () => {
  const specs = (changed: string[], max?: number) => planSpecs(changed, G, max ? { max } : {});
  test("the area of a changed file", () => {
    expect(areaOf("app/src/lesson/x/y.tsx")).toBe("app/src/lesson");
    expect(areaOf("packages/audio/src/a.ts")).toBe("packages/audio");
    expect(areaOf("app/src/routes/learn/$id.tsx")).toBe("app/src/lesson");
    expect(areaOf("app/src/routes/settings/x.tsx")).toBeNull();
    expect(areaOf("server/src/a.ts")).toBeNull();
  });
  test("app/src/<area>/** → its e2e folder; the nearest one wins", () => {
    expect(areaSpecs("app/src/lesson/Checkpoint.tsx", G)).toEqual([
      "app/src/lesson/e2e/checkpoint.pw.ts",
      "app/src/lesson/e2e/player.pw.ts",
    ]);
    expect(areaSpecs("app/src/session/seeds/Seeds.tsx", G)).toEqual([
      "app/src/session/seeds/e2e/seeds.pw.ts",
    ]);
    expect(areaSpecs("app/src/session/Session.tsx", G)).toEqual(["app/src/session/e2e/session.pw.ts"]);
    expect(areaSpecs("app/src/ui/kit/Button.tsx", G)).toEqual(["app/src/ui/kit/e2e/kit.pw.ts"]);
  });
  test("an area with no e2e folder above the file takes every e2e folder of the area; routes map to areas", () => {
    expect(areaSpecs("app/src/ui/Shared.tsx", G)).toEqual([
      "app/src/ui/kit/e2e/kit.pw.ts",
      "app/src/ui/review/e2e/review.pw.ts",
    ]);
    expect(areaSpecs("app/src/routes/learn/$id.tsx", G)).toHaveLength(2);
    expect(areaSpecs("packages/theory/src/interval.ts", G)).toEqual(["packages/theory/e2e/theory.pw.ts"]);
    expect(areaSpecs("server/src/a.ts", G)).toEqual([]);
  });
  test("a changed spec first, then importers, then the area, names sharing a word first", () => {
    const p = specs(["app/src/lesson/Checkpoint.tsx", "app/src/lesson/e2e/player.pw.ts"]);
    expect(p.selected.map((s) => [s.file, s.how])).toEqual([
      ["app/src/lesson/e2e/player.pw.ts", "changed"],
      ["app/src/lesson/e2e/checkpoint.pw.ts", "area"],
    ]);
  });
  test("a helper in an e2e folder selects the specs that import it, not the whole folder", () => {
    const p = specs(["app/src/lesson/e2e/walk.ts"]);
    expect(p.selected.map((s) => [s.file, s.how])).toEqual([
      ["app/src/lesson/e2e/checkpoint.pw.ts", "imports"],
    ]);
  });
  test("content reaches a spec through its template import", () => {
    expect(specs(["content/core/U01/lesson.ts"]).selected.map((s) => s.file)).toEqual([
      "app/src/lesson/e2e/checkpoint.pw.ts",
    ]);
  });
  test("the cap keeps the best and names the dropped", () => {
    const p = specs(["app/src/ui/Shared.tsx", "app/src/lesson/Checkpoint.tsx"], 2);
    expect(p.selected.map((s) => s.file)).toEqual([
      "app/src/lesson/e2e/checkpoint.pw.ts",
      "app/src/lesson/e2e/player.pw.ts",
    ]);
    expect(p.dropped.map((s) => s.file)).toEqual([
      "app/src/ui/kit/e2e/kit.pw.ts",
      "app/src/ui/review/e2e/review.pw.ts",
    ]);
  });
  test("the root Playwright config is a config for specs", () => {
    expect(specs(["playwright.config.ts"]).configs).toEqual([
      ["playwright.config.ts", "the root Playwright config"],
    ]);
  });
});

describe("arguments", () => {
  test("modes, flags, --files until the next flag, and the pass-through", () => {
    const o = parseArgs(["test", "--files", "./a.ts", "b/", "--list", "--base=HEAD~2", "--", "--bail"]);
    expect(o).toMatchObject({
      mode: "test",
      files: ["a.ts", "b"],
      list: true,
      base: "HEAD~2",
      rest: ["--bail"],
    });
    expect(parseArgs(["e2e", "--max", "3", "--all-on-config"])).toMatchObject({ max: 3, allOnConfig: true });
    expect(() => parseArgs(["nope"])).toThrow();
    expect(() => parseArgs(["e2e", "--max", "0"])).toThrow();
    expect(() => parseArgs(["test", "--bogus"])).toThrow();
  });
});
