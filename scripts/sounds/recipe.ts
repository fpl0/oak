// The build code behind each kind of derived file, and its hash (the `code` part of every recipe, mirror.ts).
//
// A derived file whose recipe is unchanged is kept as it is on disk, even by --update, so every function or
// constant that shapes a derived file's audio must live in a file these sets reach: render.ts and what it
// imports, the synthesisers, the encoders. mirror.ts is deliberately not hashed (an edit there, even a log
// line, would re-render the whole pack); it only fetches, decodes and plans. A set is closed over the
// value imports of its files, so a new dependency of the renderer is hashed without listing it here.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Entry files per kind of derived file (closed over their value imports by `codeFiles`). */
export const RECIPE_CODE = {
  pitched: ["render.ts", "library.ts"],
  kit: ["render.ts", "library.ts", "drummachine.ts", "flac.ts"],
  brk: ["breaks.ts", "flac.ts", "audio.ts"],
  table: ["wavetables.ts", "audio.ts"],
  /** v5: Oak's synthesised additions (synth-v5.ts, X13): plain sounds, the synth kits' hat pairs, soft strokes, sh, tb. */
  synth: ["synth-v5.ts", "flac.ts"],
} as const satisfies Record<string, readonly string[]>;

const CLAUSE = String.raw`(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+))?)`;
const FROM = new RegExp(
  String.raw`^(?:import|export)\s+(type\s+)?(${CLAUSE})\s+from\s+"(\.{1,2}/[^"]+)"`,
  "gm",
);
const BARE = /^import\s+"(\.{1,2}\/[^"]+)"/gm;

/** The relative imports (and re-exports) of a module, with the names each one brings in as values. */
export function relativeImports(source: string): { path: string; values: string[] }[] {
  const found: { at: number; path: string; values: string[] }[] = [];
  for (const m of source.matchAll(FROM)) {
    const [, typeOnly, clause = "", path = ""] = m;
    const values = typeOnly
      ? []
      : clause
          .replace(/[{}]/g, ",")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith("type "))
          .map(
            (s) =>
              s
                .replace(/^\*\s+as\s+/, "")
                .split(/\s+as\s+/)
                .pop() as string,
          );
    found.push({ at: m.index, path: path.replace(/^\.\//, ""), values });
  }
  for (const m of source.matchAll(BARE))
    found.push({ at: m.index, path: (m[1] as string).replace(/^\.\//, ""), values: ["(side effect)"] });
  return found.sort((a, b) => a.at - b.at).map(({ path, values }) => ({ path, values }));
}

/** The entry files plus every file they reach through value imports, sorted. */
export function codeFiles(entries: readonly string[], dir = import.meta.dirname): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    if (file.includes("/")) throw new Error(`recipe code must be in scripts/sounds/: ${file}`);
    seen.add(file);
    for (const i of relativeImports(readFileSync(join(dir, file), "utf8")))
      if (i.values.length) visit(i.path);
  };
  for (const f of entries) visit(f);
  return [...seen].sort();
}

/** Hash of the build code a kind of derived file depends on. */
export function codeHash(entries: readonly string[], dir = import.meta.dirname): string {
  const h = createHash("sha256");
  for (const f of codeFiles(entries, dir))
    h.update(`${f}\0`)
      .update(readFileSync(join(dir, f)))
      .update("\0");
  return h.digest("hex").slice(0, 16);
}
