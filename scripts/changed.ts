// `bun run test:changed`, `bun run e2e:changed`, `bun run check:changed`: the spot checks for a change. The whole
// `bun run check` takes about half an hour and `bun run e2e` about three quarters of one; these run only what the
// change can affect.
//
//   bun run test:changed                   the unit tests the change reaches (`bun test --isolate ./a.test.ts …`)
//   bun run e2e:changed                    the browser specs the change reaches, at most 12 (scripts/e2e-parallel.ts
//                                          --file …, budgets not enforced: a partial run)
//   bun run check:changed                  every typecheck (`bun run typecheck`), Biome on the changed files, then
//                                          test:changed
//
//   --list                                 print the plan (each test or spec, and the changed file that pulled it
//                                          in) and exit
//   --base <ref>                           changed = since the merge-base with <ref> (default origin/main, else main),
//                                          plus everything uncommitted (staged, unstaged, untracked)
//   --files a b c                          changed = exactly these repo-relative paths (until the next --flag)
//   --all-on-config                        a changed config that affects everything (package.json, bun.lock,
//                                          tsconfig*.json, biome.json, bunfig.toml, a bunfig preload; the root
//                                          playwright.config.ts for specs) runs everything; without it the run
//                                          warns and keeps the selection
//   --max <n>                              e2e: at most n specs (default 12); the plan names the ones dropped
//   --coarse                               every importer of a changed file counts, not only those that use a
//                                          name it changed (see "names" below)
//   -- <args>                              passed on to `bun test` (test, check) or to scripts/e2e-parallel.ts (e2e)
//
// How a test is selected. The repo's files (`git ls-files`, tracked and untracked, never node_modules, dist,
// desktop/stage or desktop/release, which hold stale copies of content/) form an import graph: every code file's
// imports (Bun.Transpiler's scanImports: static, `export … from`, dynamic and require; type-only imports do not
// count, typecheck covers them), resolved as Bun and Vite resolve them: relative paths with their extension, index
// files, `.js` written for `.ts`, `?raw`/`?url`/`?worker` suffixes dropped, `@oak/*` through each workspace
// package.json `exports`, and the tsconfig `paths` (`@app/*`, `@content/*`). Three edges no import statement
// spells out are added too: a dynamic import of a template literal (`../content/core/${u}/${l}/lesson.ts` reaches
// every file the pattern matches), `new URL("./x", import.meta.url)`, and the content loader's walk of the lesson
// folders (LOADERS). Vite's import.meta.glob is not an edge: Bun has no import.meta.glob, so no unit test reads it.
//   Names: every package is a barrel (`@oak/theory` is src/index.ts re-exporting every module), so a file reaches
// its importers through the names they import. A changed file changes all its exports; an importer that uses one of
// them (or imports it whole: `* as`, a side-effect or dynamic import) changes all of its own; a barrel passes on only
// the names it re-exports from it. So a test importing `chordOf` from @oak/theory is not selected by a change to
// meters.ts unless chords.ts imports meters.ts. What this misses: a module's top-level side effects reach every
// importer of its barrel; `--coarse` selects by files alone.
//   A unit test (*.test.ts, *.test.tsx) is selected when it changed or transitively imports a changed file. A changed
// file no module imports (a data file: a fixture .json, a .md a test reads) stands for the code that names it in a
// string literal (comments do not count), else for the code beside it; a changed snapshot selects its test.
//   A browser spec (*.pw.ts) is selected when it changed, imports a changed file, or lives in the e2e folder of the
// area that owns the changed file: app/src/<area>/** → the nearest app/src/<area>/…/e2e*/ above the file (or every
// e2e folder of the area when none is above it), packages/<pkg>/** → packages/<pkg>/e2e, app/src/routes/<r>/** →
// the area the route renders (ROUTE_AREAS), e2e/<suite>/** → that suite. Changed and imported specs come first,
// then the area's, those whose names share a word with the changed file first, then the quickest measured
// (test-results/e2e-durations.json).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

// --- files -------------------------------------------------------------------------------------------------------

const CODE_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx"]);
const PROBE_EXT = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json", ".d.ts"];

const extOf = (f: string): string => {
  const b = posix.basename(f);
  const i = b.lastIndexOf(".");
  return i <= 0 ? "" : b.slice(i);
};
export const isCode = (f: string): boolean => CODE_EXT.has(extOf(f)) && !f.endsWith(".d.ts");
export const isTest = (f: string): boolean => /\.test\.tsx?$/.test(f);
export const isSpec = (f: string): boolean => f.endsWith(".pw.ts");

/** Never in the graph: installed packages, build output, and the desktop app's stale copies of content/. */
export function excluded(f: string): boolean {
  const segs = f.split("/");
  return (
    segs.includes("node_modules") ||
    segs.includes("dist") ||
    f.startsWith("desktop/stage/") ||
    f.startsWith("desktop/release/")
  );
}

/**
 * Code that reaches files by walking folders rather than by importing them. content/lib/load.bun.ts imports every
 * lesson.ts, checkpoint.ts and capstone.ts it finds and reads each lesson.mdx (content/index.ts and the validation
 * suite load the course through it).
 */
export const LOADERS: { loader: string; reaches: string[] }[] = [
  {
    loader: "content/lib/load.bun.ts",
    reaches: [
      "content/{core,advanced}/**/lesson.ts",
      "content/{core,advanced}/**/lesson.mdx",
      "content/**/CP/checkpoint.ts",
      "content/**/capstone.ts",
    ],
  },
];

/** app/src/routes/<route>/** renders this app/src/<area> (whose e2e folder covers the route). */
export const ROUTE_AREAS: Record<string, string> = {
  learn: "lesson",
  checkpoint: "lesson",
  practice: "drills",
  session: "session",
  capstone: "capstone",
  album: "album",
  transcribe: "transcribe",
  studio: "studio",
  toolbox: "toolbox",
  onboarding: "onboarding",
};

// --- the workspace -----------------------------------------------------------------------------------------------

export interface Workspace {
  /** `@oak/audio` → its folder and its exports (`""`, `/waveview`, … → repo-relative file). */
  packages: Map<string, { dir: string; exports: Map<string, string> }>;
  /** tsconfig `paths`, made repo-relative: `@app/` → [`app/src/`] (`prefix`: the key ended in `*`). */
  paths: { from: string; to: string[]; prefix: boolean }[];
}

function exportTarget(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const t = exportTarget(x);
      if (t) return t;
    }
    return null;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["bun", "import", "module", "default", "require", "types"])
      if (k in o) {
        const t = exportTarget(o[k]);
        if (t) return t;
      }
  }
  return null;
}

/** One workspace package: its name and exports (subpath → repo-relative file). */
export function workspacePackage(
  dir: string,
  pkg: { name?: string; exports?: unknown; main?: string },
): { name: string; dir: string; exports: Map<string, string> } | null {
  if (!pkg.name) return null;
  const exports = new Map<string, string>();
  let ex = pkg.exports;
  if (typeof ex === "string" || Array.isArray(ex)) ex = { ".": ex };
  else if (ex && typeof ex === "object" && !Object.keys(ex).some((k) => k.startsWith("."))) ex = { ".": ex }; // a conditions object for ".".
  if (ex && typeof ex === "object")
    for (const [k, v] of Object.entries(ex as Record<string, unknown>)) {
      const t = exportTarget(v);
      if (t) exports.set(k === "." ? "" : k.slice(1), posix.join(dir, t));
    }
  if (!exports.has("") && pkg.main) exports.set("", posix.join(dir, pkg.main));
  return { name: pkg.name, dir, exports };
}

/** JSON with comments and trailing commas (tsconfig). */
export function parseJsonc(text: string): unknown {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2);
      if (i < 0) break;
      i++;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

/** Adds one tsconfig's `paths` (relative to its baseUrl, else to its folder) to the workspace. */
export function addTsconfigPaths(ws: Workspace, file: string, config: unknown): void {
  const co = (config as { compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string } })
    ?.compilerOptions;
  if (!co?.paths) return;
  const base = posix.normalize(posix.join(posix.dirname(file), co.baseUrl ?? "."));
  for (const [key, targets] of Object.entries(co.paths)) {
    const prefix = key.endsWith("*");
    const from = prefix ? key.slice(0, -1) : key;
    const to = targets.map((t) => {
      const p = posix.normalize(posix.join(base, prefix ? t.replace(/\*$/, "") : t));
      return prefix && !p.endsWith("/") ? `${p}/` : p;
    });
    const same = ws.paths.find((p) => p.from === from && p.prefix === prefix);
    if (!same) ws.paths.push({ from, to, prefix });
    else for (const t of to) if (!same.to.includes(t)) same.to.push(t);
  }
}

/** The repo's workspace packages (root package.json `workspaces`) and every tsconfig's `paths`. */
export function loadWorkspace(files: string[], read: (f: string) => string | null): Workspace {
  const ws: Workspace = { packages: new Map(), paths: [] };
  const rootPkg = JSON.parse(read("package.json") ?? "{}") as { workspaces?: string[] };
  const globs = (rootPkg.workspaces ?? []).map((w) => new Bun.Glob(`${w}/package.json`));
  for (const f of files)
    if (globs.some((g) => g.match(f))) {
      const p = workspacePackage(posix.dirname(f), JSON.parse(read(f) ?? "{}"));
      if (p) ws.packages.set(p.name, { dir: p.dir, exports: p.exports });
    }
  for (const f of files.filter((x) => /(^|\/)tsconfig[^/]*\.json$/.test(x)).sort()) {
    try {
      addTsconfigPaths(ws, f, parseJsonc(read(f) ?? "{}"));
    } catch {
      // An unreadable tsconfig adds no paths (typecheck reports it).
    }
  }
  // Longest alias first: `@oak/x/` before `@oak/`.
  ws.paths.sort((a, b) => b.from.length - a.from.length);
  return ws;
}

// --- resolution --------------------------------------------------------------------------------------------------

/** A path as a file of the repo: itself, with an extension, `.js` written for `.ts`, or its folder's index. */
export function probe(p: string, has: (f: string) => boolean): string | null {
  if (has(p)) return p;
  for (const e of PROBE_EXT) if (has(`${p}${e}`)) return `${p}${e}`;
  const js = /\.(c|m)?jsx?$/.exec(p);
  if (js) {
    const stem = p.slice(0, -js[0].length);
    for (const e of [".ts", ".tsx", ".mts", ".cts"]) if (has(`${stem}${e}`)) return `${stem}${e}`;
  }
  for (const e of PROBE_EXT) if (has(`${p}/index${e}`)) return `${p}/index${e}`;
  return null;
}

/**
 * The repo file an import specifier names, from `from`; `null` for an installed package. A relative import that
 * names no file keeps its literal path (a deleted file: the importers of a deleted file still select).
 */
export function resolveSpecifier(
  spec: string,
  from: string,
  ws: Workspace,
  has: (f: string) => boolean,
): string | null {
  const s = spec.replace(/[?#].*$/, "");
  if (!s || s.startsWith("node:") || s.startsWith("bun:") || /^[a-z]+:\/\//.test(s)) return null;
  if (s === "." || s === ".." || s.startsWith("./") || s.startsWith("../")) {
    const p = posix.normalize(posix.join(posix.dirname(from), s));
    return probe(p, has) ?? p;
  }
  if (s.startsWith("/")) return null;
  for (const a of ws.paths) {
    if (a.prefix ? !s.startsWith(a.from) : s !== a.from) continue;
    for (const t of a.to) {
      const hit = probe(a.prefix ? `${t}${s.slice(a.from.length)}` : t, has);
      if (hit) return hit;
    }
  }
  const segs = s.split("/");
  const name = s.startsWith("@") ? segs.slice(0, 2).join("/") : (segs[0] as string);
  const pkg = ws.packages.get(name);
  if (!pkg) return null;
  const sub = s.slice(name.length);
  const exported = pkg.exports.get(sub);
  if (exported) return probe(exported, has) ?? exported;
  for (const [k, v] of pkg.exports)
    if (k.endsWith("/*") && sub.startsWith(k.slice(0, -1))) {
      const hit = probe(v.replace("*", sub.slice(k.length - 1)), has);
      if (hit) return hit;
    }
  return pkg.exports.size === 0 ? probe(`${pkg.dir}${sub || "/index"}`, has) : null;
}

// --- scanning ----------------------------------------------------------------------------------------------------

const transpilers = new Map<string, Bun.Transpiler>();
function transpiler(file: string): Bun.Transpiler {
  const e = extOf(file);
  const loader =
    e === ".tsx" ? "tsx" : e === ".jsx" ? "jsx" : e === ".ts" || e === ".mts" || e === ".cts" ? "ts" : "js";
  let t = transpilers.get(loader);
  if (!t) {
    t = new Bun.Transpiler({ loader });
    transpilers.set(loader, t);
  }
  return t;
}

const FALLBACK_RE =
  /(?:^|[^.\w$])(?:import|export)\s+(?!type\s)[^'"`;]*?\bfrom\s*["']([^"']+)["']|(?:^|[^.\w$])import\s*["']([^"']+)["']|(?:^|[^.\w$])import\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
const TEMPLATE_RE = /(?:^|[^.\w$])import\s*\(\s*(?:\/\*[^*]*\*\/\s*)?`([^`]*)`\s*\)/g;
const URL_RE = /new\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g;

/** A template literal's import as a glob (`../c/${u}/x.ts` → `../c/*\/x.ts`); null when it starts with a value. */
export function templateGlob(tpl: string): string | null {
  if (!tpl.includes("${")) return null;
  if (tpl.startsWith("${")) return null;
  return tpl.replace(/\$\{[^}]*\}/g, "*").replace(/\*{2,}/g, "*");
}

function getOr<K, V>(m: Map<K, V>, k: K, make: () => V): V {
  let v = m.get(k);
  if (v === undefined) {
    v = make();
    m.set(k, v);
  }
  return v;
}

/** Every name, or every export (`ALL`). */
export const ALL = "*";
export type Names = Set<string> | typeof ALL;

/**
 * What an import edge carries: the names the importer uses itself (`uses`; `ALL` for a namespace, side-effect,
 * dynamic or unparsed import; null when it only re-exports), the names it re-exports (`reexports`: name in the
 * imported file → names in the importer), `export * from` (`star`) and `export * as ns from` (`namespaces`).
 */
export interface EdgeInfo {
  uses: Names | null;
  reexports: Map<string, string[]>;
  star: boolean;
  namespaces: string[];
}
const allUses = (): EdgeInfo => ({ uses: ALL, reexports: new Map(), star: false, namespaces: [] });

const COMMENT_RE = /\/\*[\s\S]*?\*\/|(^|[^:\\"'`])\/\/[^\n]*/g;
const STATEMENT_RE =
  /^[ \t]*(import|export)\s+(type\s+)?((?:(?!\b(?:import|export|class|function|const|let|var|interface|enum|async|abstract|declare|namespace)\b)[\w\s{},*$])*?)\s*from\s*["']([^"']+)["']/gm;
const SIDE_EFFECT_RE = /^[ \t]*import\s*["']([^"']+)["']/gm;

/** The import and export-from statements of a source, by specifier: what each one uses and re-exports. */
export function bindings(src: string): Map<string, EdgeInfo> {
  const out = new Map<string, EdgeInfo>();
  const of = (spec: string): EdgeInfo => {
    return getOr(out, spec, () => ({ uses: null, reexports: new Map(), star: false, namespaces: [] }));
  };
  const use = (e: EdgeInfo, names: Names): void => {
    if (e.uses === ALL || names === ALL) e.uses = ALL;
    else e.uses = new Set([...(e.uses ?? []), ...names]);
  };
  const code = src.replace(COMMENT_RE, "$1");
  for (const m of code.matchAll(SIDE_EFFECT_RE)) use(of(m[1] as string), ALL);
  for (const m of code.matchAll(STATEMENT_RE)) {
    if (m[2]) continue; // `import type` / `export type`: no runtime edge.
    const [kind, clause, spec] = [m[1], (m[3] as string).trim(), m[4] as string];
    const e = of(spec);
    const braces = /\{([^}]*)\}/.exec(clause);
    const items = (braces?.[1] ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x && !/^type\s/.test(x))
      .map((x) => x.split(/\s+as\s+/).map((y) => y.trim()) as [string, string?]);
    if (kind === "import") {
      const head = clause
        .replace(/\{[^}]*\}/, "")
        .replace(/,/g, " ")
        .trim();
      if (head.includes("*")) use(e, ALL);
      else {
        const names = new Set(items.map(([a]) => a));
        if (head) names.add("default");
        // `import { type A } from`: types only, nothing used at run time.
        use(e, names.size > 0 || braces ? names : ALL);
      }
    } else if (clause === "*") e.star = true;
    else if (/^\*\s*as\s+[\w$]+$/.test(clause)) e.namespaces.push(clause.replace(/^\*\s*as\s+/, ""));
    else for (const [a, b] of items) e.reexports.set(a, [...(e.reexports.get(a) ?? []), b ?? a]);
  }
  return out;
}

/** Every specifier a source imports, how it uses each, its exports, and its template-literal imports as globs. */
export function scanSource(
  file: string,
  src: string,
): { specs: Map<string, EdgeInfo>; exports: Set<string> | null; globs: string[] } {
  const specs = new Map<string, EdgeInfo>();
  const bound = bindings(src);
  let exports: Set<string> | null = null;
  try {
    const t = transpiler(file);
    exports = new Set(t.scan(src).exports);
    for (const i of t.scanImports(src)) specs.set(i.path, bound.get(i.path) ?? allUses());
  } catch {
    // A file mid-edit that does not parse: the same statements by pattern, each one used whole.
    for (const m of src.matchAll(FALLBACK_RE)) {
      const s = m[1] ?? m[2] ?? m[3] ?? m[4];
      if (s) specs.set(s, allUses());
    }
  }
  const globs: string[] = [];
  for (const m of src.matchAll(TEMPLATE_RE)) {
    const tpl = m[1] as string;
    const g = templateGlob(tpl);
    if (g) globs.push(g);
    else if (!tpl.includes("${")) specs.set(tpl, allUses());
  }
  for (const m of src.matchAll(URL_RE)) specs.set(m[1] as string, allUses());
  // A dynamic import or require of a specifier also imported by name uses it whole.
  for (const m of src.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g))
    specs.set(m[1] as string, allUses());
  return { specs, exports, globs };
}

// --- the graph ---------------------------------------------------------------------------------------------------

export interface Graph {
  /** Every file of the repo (code or not). */
  files: Set<string>;
  /** file → the files it imports. */
  imports: Map<string, Set<string>>;
  /** file → the files that import it. */
  importers: Map<string, Set<string>>;
  /** importer → imported → how (EdgeInfo). */
  info: Map<string, Map<string, EdgeInfo>>;
  /** Each code file's own exports (Bun's scan; null when it did not parse). */
  exports: Map<string, Set<string> | null>;
  /** Each code file's source (a data file is reached through the code that names it). */
  sources: Map<string, string>;
  edges: number;
}

export function buildGraph(
  fileList: string[],
  read: (f: string) => string | null,
  ws: Workspace,
  loaders = LOADERS,
): Graph {
  const files = new Set(fileList.filter((f) => !excluded(f)));
  const has = (f: string): boolean => files.has(f);
  const g: Graph = {
    files,
    imports: new Map(),
    importers: new Map(),
    info: new Map(),
    exports: new Map(),
    sources: new Map(),
    edges: 0,
  };
  const edge = (from: string, to: string, how: EdgeInfo): void => {
    if (from === to) return;
    const out = getOr(g.imports, from, () => new Set<string>());
    const infos = getOr(g.info, from, () => new Map<string, EdgeInfo>());
    const prev = infos.get(to);
    if (prev) {
      // Two specifiers of one file (`./a` and `./a.ts`): the union.
      prev.uses =
        prev.uses === ALL || how.uses === ALL ? ALL : new Set([...(prev.uses ?? []), ...(how.uses ?? [])]);
      for (const [k, v] of how.reexports) prev.reexports.set(k, [...(prev.reexports.get(k) ?? []), ...v]);
      prev.star ||= how.star;
      prev.namespaces.push(...how.namespaces);
      return;
    }
    infos.set(to, how);
    out.add(to);
    getOr(g.importers, to, () => new Set<string>()).add(from);
    g.edges++;
  };
  const globMatches = (pattern: string): string[] => {
    const glob = new Bun.Glob(pattern);
    return [...files].filter((f) => glob.match(f));
  };
  for (const f of files) {
    if (!isCode(f)) continue;
    const src = read(f);
    if (src === null) continue;
    g.sources.set(f, src);
    const { specs, exports, globs } = scanSource(f, src);
    g.exports.set(f, exports);
    for (const [s, how] of specs) {
      const to = resolveSpecifier(s, f, ws, has);
      if (to) edge(f, to, how);
    }
    for (const gl of globs) {
      if (!gl.startsWith("./") && !gl.startsWith("../")) continue;
      for (const to of globMatches(posix.normalize(posix.join(posix.dirname(f), gl)))) edge(f, to, allUses());
    }
  }
  for (const l of loaders) {
    if (!files.has(l.loader)) continue;
    for (const pattern of l.reaches)
      for (const to of globMatches(pattern)) if (!isTest(to)) edge(l.loader, to, allUses());
  }
  return g;
}

/** The repo's files: tracked and untracked (not ignored), that exist on disk. */
export function repoFiles(root = ROOT): string[] {
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`git ls-files: ${r.stderr}`);
  return [...new Set(r.stdout.split("\0").filter(Boolean))].filter(
    (f) => !excluded(f) && existsSync(`${root}${f}`),
  );
}

export function readRepoFile(root = ROOT): (f: string) => string | null {
  return (f) => {
    try {
      return readFileSync(`${root}${f}`, "utf8");
    } catch {
      return null;
    }
  };
}

// --- what changed ------------------------------------------------------------------------------------------------

function git(args: string[], root: string): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? "" };
}

/**
 * The paths changed since the merge-base of `ref` (default origin/main, else main) and HEAD, plus everything
 * uncommitted: `git diff <merge-base>` compares the working tree (staged and unstaged) with it; untracked files too.
 */
export function changedSince(
  ref: string | null,
  root = ROOT,
): { files: string[]; ref: string; base: string } {
  const verify = (r: string): boolean => git(["rev-parse", "--verify", "--quiet", `${r}^{commit}`], root).ok;
  const chosen = ref ?? ["origin/main", "main"].find(verify) ?? "HEAD";
  if (!verify(chosen)) throw new Error(`--base ${chosen}: not a commit`);
  const mb = git(["merge-base", chosen, "HEAD"], root);
  const base = mb.ok && mb.out.trim() ? mb.out.trim() : chosen;
  const diff = git(["diff", "-z", "--name-only", "--no-renames", base], root);
  const untracked = git(["ls-files", "-z", "--others", "--exclude-standard"], root);
  const files = [...diff.out.split("\0"), ...untracked.out.split("\0")].filter(Boolean);
  return { files: [...new Set(files)].filter((f) => !excluded(f)).sort(), ref: chosen, base };
}

// --- configs -----------------------------------------------------------------------------------------------------

/** The `[test] preload` files bunfig.toml names (repo-relative). */
export function bunfigPreloads(bunfig: string): string[] {
  const m = /^\s*preload\s*=\s*(\[[^\]]*\]|"[^"]*")/m.exec(bunfig);
  if (!m) return [];
  return [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => posix.normalize(x[1] as string));
}
/** The `[test] pathIgnorePatterns` of bunfig.toml: `bun test` never runs a test they match. */
export function bunfigIgnores(bunfig: string): string[] {
  const m = /^\s*pathIgnorePatterns\s*=\s*(\[[^\]]*\])/m.exec(bunfig);
  return m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1] as string) : [];
}

export interface ConfigContext {
  /** bunfig.toml's test preloads. */
  preloads?: string[];
  /** The package.json files of the workspace (root and workspace packages); undefined: every package.json. */
  manifests?: Set<string>;
}

/** Why a changed file affects every unit test (null: it does not). */
export function unitConfig(f: string, ctx: ConfigContext = {}): string | null {
  const b = posix.basename(f);
  if (b === "package.json" && (!ctx.manifests || ctx.manifests.has(f))) return "a package manifest";
  if (b === "bun.lock" || b === "bun.lockb") return "the lockfile";
  if (/^tsconfig.*\.json$/.test(b)) return "a tsconfig";
  if (b === "biome.json" || b === "biome.jsonc") return "the Biome config";
  if (f === "bunfig.toml") return "bunfig.toml";
  if (ctx.preloads?.includes(f)) return "a test preload (bunfig.toml)";
  return null;
}
/** Why a changed file affects every browser spec (null: it does not). */
export function e2eConfig(f: string, ctx: ConfigContext = {}): string | null {
  if (f === "playwright.config.ts") return "the root Playwright config";
  return unitConfig(f, ctx);
}

// --- selection ---------------------------------------------------------------------------------------------------

export interface Pulled {
  /** The selected test or spec. */
  file: string;
  /** The changed file that pulled it in. */
  changed: string;
  /** From the changed file to the selected one (both included). */
  chain: string[];
  /** How: `changed`, `imports` (the graph), `area` (the e2e folder of the changed file's area). */
  how: "changed" | "imports" | "area";
}

/**
 * Where the search starts: each changed file, plus what stands for it. A data file nothing imports stands for the
 * code that names it (its basename ending a string literal, outside comments), else for the code beside it (not
 * for a *.md); a snapshot for its test. A config is never a seed this way (the config rule covers it).
 */
const uncommented = new Map<string, string>();
/** A source without its comments (a doc comment that names `content/ids.lock.json` does not read it). */
function withoutComments(src: string): string {
  let out = uncommented.get(src);
  if (out === undefined) {
    out = src.replace(COMMENT_RE, "$1");
    uncommented.set(src, out);
  }
  return out;
}

export function seedsOf(changed: string[], g: Graph): Map<string, string> {
  const seeds = new Map<string, string>();
  const add = (f: string, origin: string): void => {
    if (!seeds.has(f)) seeds.set(f, origin);
  };
  for (const c of changed) add(c, c);
  for (const c of changed) {
    const snap = /^(.*)\/__snapshots__\/([^/]+)\.snap$/.exec(c);
    if (snap) {
      add(`${snap[1]}/${snap[2]}`, c);
      continue;
    }
    // Code is reached by its imports; a config by the config rule (a fixture that names `tsconfig.json` is no reader).
    if (isCode(c) || c.endsWith(".d.ts") || g.importers.has(c) || unitConfig(c)) continue;
    // Named at the end of a string literal (`"ids.lock.json"`, `"./fixtures/a.json"`), not in prose.
    const named = new RegExp(`["'\`/]${posix.basename(c).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`);
    const naming = [...g.sources]
      .filter(([f, src]) => f !== c && named.test(withoutComments(src)))
      .map(([f]) => f);
    // Documentation (*.md) stands for nothing beside it.
    const beside =
      naming.length || c.endsWith(".md")
        ? naming
        : [...g.files].filter(
            (f) => posix.dirname(f) === posix.dirname(c) && isCode(f) && !isTest(f) && !isSpec(f),
          );
    for (const f of beside) add(f, c);
  }
  return seeds;
}

/** Every name a file exports, through its `export * from` chains (`ALL` when one did not parse). */
function exportNamesOf(f: string, g: Graph, seen = new Set<string>()): Names {
  if (seen.has(f)) return new Set();
  seen.add(f);
  const own = g.exports.get(f);
  if (own === undefined || own === null) return ALL;
  const out = new Set(own);
  for (const [to, e] of g.info.get(f) ?? []) {
    if (!e.star) continue;
    const more = exportNamesOf(to, g, seen);
    if (more === ALL) return ALL;
    for (const n of more) if (n !== "default") out.add(n);
  }
  return out;
}

/**
 * What of `imported` reaches its importer along an edge, given what of `imported` changed (`changed`): everything
 * when the importer uses a changed name itself (its own exports may all depend on it), else the names it re-exports.
 */
export function through(e: EdgeInfo, changed: Names, imported: string, g: Graph): Names {
  const hit = (n: string): boolean => changed === ALL || changed.has(n);
  if (e.uses === ALL || (e.uses && [...e.uses].some(hit))) return ALL;
  const out = new Set<string>();
  for (const [from, to] of e.reexports) if (hit(from)) for (const n of to) out.add(n);
  for (const ns of e.namespaces) out.add(ns);
  if (e.star) {
    const names = changed === ALL ? exportNamesOf(imported, g) : changed;
    if (names === ALL) return ALL;
    for (const n of names) if (n !== "default") out.add(n);
  }
  return out;
}

/**
 * Every file a seed reaches through its importers, with the changed file it reaches and the way there. A file is
 * reached through the names it imports: a test that imports `chordOf` from @oak/theory is not reached by a change
 * to meters.ts unless `chordOf` depends on it (`coarse`: every importer is reached).
 */
export function reachBack(
  seeds: Map<string, string>,
  g: Graph,
  coarse = false,
): Map<string, { changed: string; chain: string[] }> {
  const parent = new Map<string, string | null>();
  const origin = new Map<string, string>();
  const affected = new Map<string, Names>();
  const queue: string[] = [];
  for (const [s, o] of seeds) {
    parent.set(s, o === s ? null : o);
    origin.set(s, o);
    affected.set(s, ALL);
    queue.push(s);
  }
  for (let i = 0; i < queue.length; i++) {
    const f = queue[i] as string;
    const changed = affected.get(f) as Names;
    for (const up of g.importers.get(f) ?? []) {
      const e = g.info.get(up)?.get(f) ?? allUses();
      const add = coarse ? ALL : through(e, changed, f, g);
      if (add !== ALL && add.size === 0) continue;
      const prev = affected.get(up);
      let next: Names;
      if (prev === ALL) continue;
      if (add === ALL) next = ALL;
      else {
        next = new Set([...(prev ?? []), ...add]);
        if (prev && next.size === prev.size) continue;
      }
      affected.set(up, next);
      if (!parent.has(up)) {
        parent.set(up, f);
        origin.set(up, origin.get(f) as string);
      }
      queue.push(up);
    }
  }
  const out = new Map<string, { changed: string; chain: string[] }>();
  for (const f of parent.keys()) {
    const chain: string[] = [];
    for (let at: string | null | undefined = f; at != null && !chain.includes(at); at = parent.get(at))
      chain.unshift(at);
    out.set(f, { changed: origin.get(f) as string, chain });
  }
  return out;
}

export interface UnitPlan {
  tests: Pulled[];
  /** Changed files that affect everything, with why. */
  configs: [file: string, why: string][];
  /** Changed files no test reaches. */
  uncovered: string[];
  /** Tests reached but never run by `bun test` (bunfig pathIgnorePatterns). */
  ignored: string[];
}

export function planUnit(
  changed: string[],
  g: Graph,
  opts: ConfigContext & { ignores?: string[]; coarse?: boolean } = {},
): UnitPlan {
  const ignoreGlobs = (opts.ignores ?? []).map((p) => new Bun.Glob(p));
  const reached = reachBack(seedsOf(changed, g), g, opts.coarse);
  const tests: Pulled[] = [];
  const ignored: string[] = [];
  const covered = new Set<string>();
  for (const [f, r] of reached) {
    if (!isTest(f) || !g.files.has(f)) continue;
    if (ignoreGlobs.some((gl) => gl.match(f))) {
      ignored.push(f);
      continue;
    }
    tests.push({
      file: f,
      changed: r.changed,
      chain: r.chain,
      how: r.chain.length === 1 ? "changed" : "imports",
    });
    covered.add(r.changed);
  }
  const configs: [string, string][] = [];
  for (const c of changed) {
    const why = unitConfig(c, opts);
    if (why) configs.push([c, why]);
  }
  return {
    tests: tests.sort((a, b) => a.file.localeCompare(b.file)),
    configs,
    uncovered: changed.filter((c) => !covered.has(c)).sort(),
    ignored: ignored.sort(),
  };
}

const E2E_DIR = /^e2e(-[^/]*)?$/;

/** The spec folders (folders that hold *.pw.ts files directly) and their specs. */
function specFolders(g: Graph): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of g.files)
    if (isSpec(f)) {
      const d = posix.dirname(f);
      out.set(d, [...(out.get(d) ?? []), f]);
    }
  return out;
}

/** The area folder that owns a path, for the e2e mapping (null: no area). */
export function areaOf(f: string): string | null {
  const route = /^app\/src\/routes\/([^/.]+)\//.exec(f);
  if (route) {
    const a = ROUTE_AREAS[route[1] as string];
    return a ? `app/src/${a}` : null;
  }
  const m =
    /^(app\/src\/[^/]+)\//.exec(f) ??
    /^(packages\/[^/]+)\//.exec(f) ??
    /^(e2e\/[^/]+)\//.exec(f) ??
    /^(app\/e2e)\//.exec(f);
  return m ? (m[1] as string) : null;
}

/**
 * The specs of the area that owns a changed file: the nearest spec folder at or above the file (a folder of specs,
 * or an `e2e*` child of a folder), up to the area's root; else every spec folder of the area.
 */
export function areaSpecs(f: string, g: Graph, folders = specFolders(g)): string[] {
  const area = areaOf(f);
  if (!area) return [];
  const routed = f.startsWith("app/src/routes/");
  let d = routed ? area : posix.dirname(f);
  for (;;) {
    const own = folders.get(d);
    if (own) return [...own].sort();
    const children = [...folders]
      .filter(([dir]) => posix.dirname(dir) === d && E2E_DIR.test(posix.basename(dir)))
      .flatMap(([, s]) => s);
    if (children.length) return children.sort();
    if (d === area || !d.includes("/")) break;
    d = posix.dirname(d);
  }
  return [...folders]
    .filter(([dir]) => dir.startsWith(`${area}/`) || dir === area)
    .flatMap(([, s]) => s)
    .sort();
}

const words = (f: string): Set<string> =>
  new Set(
    posix
      .basename(f)
      .replace(/\.(pw|test)?\.?[a-z]+$/i, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3),
  );

export interface SpecPlan {
  selected: Pulled[];
  dropped: Pulled[];
  configs: [file: string, why: string][];
  uncovered: string[];
}

/**
 * The browser specs a change affects, best first, cut at `max`: changed specs, then specs that import a changed
 * file, then the area's specs (those sharing a word with the changed file's name first, then the quickest measured).
 */
export function planSpecs(
  changed: string[],
  g: Graph,
  opts: ConfigContext & { max?: number; seconds?: Map<string, number>; coarse?: boolean } = {},
): SpecPlan {
  const max = opts.max ?? 12;
  const reached = reachBack(seedsOf(changed, g), g, opts.coarse);
  const picked = new Map<string, Pulled>();
  const covered = new Set<string>();
  for (const [f, r] of reached)
    if (isSpec(f) && g.files.has(f)) {
      picked.set(f, {
        file: f,
        changed: r.changed,
        chain: r.chain,
        how: r.chain.length === 1 ? "changed" : "imports",
      });
      covered.add(r.changed);
    }
  const folders = specFolders(g);
  for (const c of changed) {
    // A helper inside an e2e folder selects the specs that import it; the whole folder only when none does.
    const inE2e = c.split("/").some((s) => E2E_DIR.test(s)) || isSpec(c);
    if (inE2e && covered.has(c)) continue;
    const specs = areaSpecs(c, g, folders);
    for (const s of specs)
      if (!picked.has(s)) picked.set(s, { file: s, changed: c, chain: [c, s], how: "area" });
    if (specs.length) covered.add(c);
  }
  const rank = { changed: 0, imports: 1, area: 2 } as const;
  const score = (p: Pulled): number => {
    const w = words(p.changed);
    return [...words(p.file)].filter((x) => w.has(x)).length;
  };
  const secs = (p: Pulled): number => opts.seconds?.get(p.file) ?? Number.POSITIVE_INFINITY;
  const all = [...picked.values()].sort(
    (a, b) =>
      rank[a.how] - rank[b.how] || score(b) - score(a) || secs(a) - secs(b) || a.file.localeCompare(b.file),
  );
  const configs: [string, string][] = [];
  for (const c of changed) {
    const why = e2eConfig(c, opts);
    if (why) configs.push([c, why]);
  }
  return {
    selected: all.slice(0, max),
    dropped: all.slice(max),
    configs,
    uncovered: changed.filter((c) => !covered.has(c)).sort(),
  };
}

/** Seconds per spec file from the last `bun run e2e` (test-results/e2e-durations.json), summed over projects. */
export function specSeconds(root = ROOT): Map<string, number> {
  const out = new Map<string, number>();
  try {
    const d = JSON.parse(readFileSync(`${root}test-results/e2e-durations.json`, "utf8")) as {
      files?: Record<string, number>;
    };
    for (const [k, s] of Object.entries(d.files ?? {})) {
      const file = k.split(" › ")[1];
      if (file) out.set(file, (out.get(file) ?? 0) + s);
    }
  } catch {
    // No measurements yet: the order is by name.
  }
  return out;
}

// --- arguments ---------------------------------------------------------------------------------------------------

export interface Options {
  mode: "test" | "e2e" | "check";
  list: boolean;
  base: string | null;
  files: string[] | null;
  allOnConfig: boolean;
  /** Reach every importer, not only those that use a changed name (`--coarse`). */
  coarse: boolean;
  max: number;
  rest: string[];
}

export function parseArgs(argv: string[]): Options {
  const [mode, ...args] = argv;
  if (mode !== "test" && mode !== "e2e" && mode !== "check")
    throw new Error("usage: bun scripts/changed.ts <test|e2e|check> [--list] [--base ref] [--files a b …]");
  const o: Options = {
    mode,
    list: false,
    base: null,
    files: null,
    allOnConfig: false,
    coarse: false,
    max: 12,
    rest: [],
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    const [flag, inline] =
      a.startsWith("--") && a.includes("=") ? (a.split(/=(.*)/s, 2) as [string, string]) : [a, undefined];
    const take = (): string => {
      if (inline !== undefined) return inline;
      const v = args[++i];
      if (v === undefined) throw new Error(`${flag} needs a value`);
      return v;
    };
    if (a === "--") {
      o.rest = args.slice(i + 1);
      break;
    } else if (flag === "--list") o.list = true;
    else if (flag === "--all-on-config") o.allOnConfig = true;
    else if (flag === "--coarse") o.coarse = true;
    else if (flag === "--base") o.base = take();
    else if (flag === "--max") o.max = Number(take());
    else if (flag === "--files") {
      o.files = inline !== undefined ? inline.split(",").filter(Boolean) : [];
      while (inline === undefined && i + 1 < args.length && !(args[i + 1] as string).startsWith("--"))
        o.files.push(args[++i] as string);
    } else throw new Error(`unknown argument ${a}`);
  }
  if (!Number.isInteger(o.max) || o.max < 1) throw new Error("--max must be a positive integer");
  if (o.files) o.files = o.files.map((f) => posix.normalize(f.replace(/^\.\//, "")).replace(/\/$/, ""));
  return o;
}

// --- printing ----------------------------------------------------------------------------------------------------

/** `← changed (how)`: the changed file and the way from it to the selected file. */
export function because(p: Pulled): string {
  if (p.how === "changed") return `← ${p.changed} (changed)`;
  if (p.how === "area") return `← ${p.changed} (its area's e2e folder)`;
  const between = p.chain.slice(1, -1);
  const via =
    between.length === 0
      ? isCode(p.changed)
        ? "imports it"
        : "reads it"
      : between.length <= 2
        ? `via ${between.join(" → ")}`
        : `via ${between[0]} … ${between[between.length - 1]}, ${between.length + 1} hops`;
  return `← ${p.changed} (${via})`;
}

function printList(title: string, items: string[], limit = 40): void {
  console.log(`${title} (${items.length}):`);
  for (const x of items.slice(0, limit)) console.log(`  ${x}`);
  if (items.length > limit) console.log(`  … and ${items.length - limit} more`);
}

// --- main --------------------------------------------------------------------------------------------------------

function run(cmd: string, args: string[]): number {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  return r.status ?? 1;
}

if (import.meta.main) {
  const o = parseArgs(process.argv.slice(2));
  const t0 = performance.now();
  let changed: string[];
  if (o.files) {
    changed = o.files.flatMap((f) => {
      // A folder stands for its files.
      if (existsSync(`${ROOT}${f}`) && statSync(`${ROOT}${f}`).isDirectory())
        return repoFiles().filter((x) => x.startsWith(`${f}/`));
      return [f];
    });
    console.log(`Changed: ${changed.length} files (--files)`);
  } else {
    const c = changedSince(o.base);
    changed = c.files;
    console.log(
      `Changed: ${changed.length} files since ${c.ref} (merge-base ${c.base.slice(0, 10)}) and uncommitted`,
    );
  }
  for (const f of changed.slice(0, 30)) console.log(`  ${f}${existsSync(`${ROOT}${f}`) ? "" : " (deleted)"}`);
  if (changed.length > 30) console.log(`  … and ${changed.length - 30} more`);

  const tGraph = performance.now();
  const files = repoFiles();
  const read = readRepoFile();
  const ws = loadWorkspace(files, read);
  const g = buildGraph(files, read, ws);
  const manifests = new Set([
    "package.json",
    ...[...ws.packages.values()].map((p) => `${p.dir}/package.json`),
  ]);
  const graphMs = performance.now() - tGraph;
  console.log(
    `Import graph: ${g.files.size} files, ${g.sources.size} scanned, ${g.edges} edges, built in ${graphMs.toFixed(0)} ms`,
  );
  const bunfig = read("bunfig.toml") ?? "";
  const preloads = bunfigPreloads(bunfig);
  let failed = false;
  /** One line per step that ran (check prints them last). */
  const summary: string[] = [];

  const unitStep = (): void => {
    const p = planUnit(changed, g, { preloads, manifests, ignores: bunfigIgnores(bunfig), coarse: o.coarse });
    console.log("");
    const everything = p.configs.length > 0 && o.allOnConfig;
    for (const [f, why] of p.configs)
      console.log(
        `${everything ? "Config" : "WARNING: config"} changed: ${f} (${why}) affects every test${
          everything
            ? ": running the whole suite (--all-on-config)"
            : "; the run keeps the graph's selection (--all-on-config runs everything)"
        }`,
      );
    if (everything) {
      console.log("Unit tests: all (bun test --isolate)");
      if (o.list) return;
      const code = run("bun", ["test", "--isolate", ...o.rest]);
      summary.push(`bun test --isolate (all): ${code === 0 ? "passed" : "FAILED"}`);
      failed = code !== 0 || failed;
      return;
    }
    console.log(`Unit tests: ${p.tests.length}`);
    const width = Math.min(70, Math.max(0, ...p.tests.map((t) => t.file.length + 2)));
    for (const t of p.tests) console.log(`  ${`./${t.file}`.padEnd(width)}  ${because(t)}`);
    if (p.ignored.length) printList("Reached but ignored by bunfig pathIgnorePatterns", p.ignored);
    if (p.uncovered.length) printList("No unit test reaches", p.uncovered, 20);
    if (p.tests.length === 0) {
      console.log("No unit test is affected by the change.");
      return;
    }
    if (o.list) return;
    console.log(`\n$ bun test --isolate <${p.tests.length} files>`);
    const t = performance.now();
    const code = run("bun", ["test", "--isolate", ...p.tests.map((x) => `./${x.file}`), ...o.rest]);
    const line = `test:changed (${p.tests.length} files): ${code === 0 ? "passed" : "FAILED"} in ${((performance.now() - t) / 1000).toFixed(1)} s`;
    console.log(line);
    summary.push(line);
    failed = code !== 0 || failed;
  };

  if (o.mode === "test") unitStep();
  else if (o.mode === "check") {
    const lintable = changed.filter(
      (f) => existsSync(`${ROOT}${f}`) && !statSync(`${ROOT}${f}`).isDirectory(),
    );
    console.log(
      "\nPlan: bun run typecheck (whole-project), Biome on the changed files, then the unit tests below.",
    );
    console.log(`Biome: ${lintable.length} files`);
    if (!o.list) {
      const timed = (name: string, f: () => number): void => {
        const t = performance.now();
        console.log(`\n$ ${name}`);
        const code = f();
        summary.push(
          `${name}: ${code === 0 ? "passed" : "FAILED"} in ${((performance.now() - t) / 1000).toFixed(1)} s`,
        );
        failed = code !== 0 || failed;
      };
      timed("bun run typecheck", () => run("bun", ["run", "typecheck"]));
      if (lintable.length)
        timed("biome check <changed files>", () =>
          run(`${ROOT}node_modules/.bin/biome`, [
            "check",
            "--no-errors-on-unmatched",
            "--files-ignore-unknown=true",
            ...lintable,
          ]),
        );
      unitStep();
      console.log("");
      for (const line of summary) console.log(line);
    } else unitStep();
  } else {
    const p = planSpecs(changed, g, {
      max: o.max,
      seconds: specSeconds(),
      preloads,
      manifests,
      coarse: o.coarse,
    });
    console.log("");
    const everything = p.configs.length > 0 && o.allOnConfig;
    for (const [f, why] of p.configs)
      console.log(
        `${everything ? "Config" : "WARNING: config"} changed: ${f} (${why}) affects every spec${
          everything
            ? ": running every spec (--all-on-config)"
            : "; the run keeps the selection (--all-on-config runs everything)"
        }`,
      );
    if (everything) {
      console.log("Browser specs: all (bun scripts/e2e-parallel.ts)");
      if (!o.list)
        failed = run("bun", ["scripts/e2e-parallel.ts", ...(o.rest.length ? ["--", ...o.rest] : [])]) !== 0;
    } else {
      const total = p.selected.length + p.dropped.length;
      console.log(
        `Browser specs: ${p.selected.length}${p.dropped.length ? ` of ${total} (--max ${o.max})` : ""}`,
      );
      const width = Math.min(70, Math.max(0, ...p.selected.map((t) => t.file.length)));
      for (const s of p.selected) console.log(`  ${s.file.padEnd(width)}  ${because(s)}`);
      if (p.dropped.length) {
        console.log(`Dropped by --max ${o.max} (${p.dropped.length}):`);
        for (const s of p.dropped) console.log(`  ${s.file}  ${because(s)}`);
      }
      if (p.uncovered.length) printList("No browser spec reaches", p.uncovered, 20);
      if (p.selected.length === 0) console.log("No browser spec is affected by the change.");
      else if (!o.list) {
        const args = [
          "scripts/e2e-parallel.ts",
          "--no-budget",
          ...p.selected.flatMap((s) => ["--file", s.file]),
          ...(o.rest.length ? ["--", ...o.rest] : []),
        ];
        console.log(`\n$ bun ${args.join(" ")}`);
        failed = run("bun", args) !== 0;
      }
    }
  }
  console.log(
    `\n${o.mode}:changed ${o.list ? "plan" : failed ? "FAILED" : "done"} in ${((performance.now() - t0) / 1000).toFixed(1)} s`,
  );
  process.exit(failed ? 1 : 0);
}
