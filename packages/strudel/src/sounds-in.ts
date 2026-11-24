// `soundsIn(code)`: the sounds a piece of code names, read from its `s()`, `sound()` and `.bank()`
// string arguments. A coarse, static reading for lesson-level preloading; an editor that is about to
// play preloads exactly what its pattern triggers (preload.ts, `warmPattern`).
import { stripComments } from "./comments.ts";
import type { PreloadSpec } from "./types.ts";

type SoundSpec = PreloadSpec["sounds"][number];

const REST = new Set(["~", "-", "_"]);
/** A mini-notation leaf that can be a sound name, with an optional `:n`. */
const LEAF = /[A-Za-z][A-Za-z0-9_]*(?::\d+)?/g;
const NOTE = /^[a-gA-G][#bs]*-?\d$/;

// `stripComments` lives in comments.ts (no DOM types), so the unit-song composer stays isomorphic.
export { stripComments };

/** Top-level statements: split at newlines that are outside brackets and strings. */
export function statementsOf(code: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i] as string;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === "\n" && depth === 0) {
      // A line that starts with `.` continues the chain above it.
      const rest = code.slice(i + 1);
      if (/^\s*\./.test(rest)) continue;
      out.push(code.slice(start, i));
      start = i + 1;
    }
  }
  out.push(code.slice(start));
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** String arguments of every call to one of `callees` in `text` (first argument only). */
export function stringArgsOf(text: string, callees: readonly string[]): string[] {
  const out: string[] = [];
  const re = new RegExp(`(?:^|[^A-Za-z0-9_$])(?:${callees.join("|")})\\s*\\(\\s*(["'\`])`, "g");
  for (const m of text.matchAll(re)) {
    const quote = m[1] as string;
    const from = (m.index ?? 0) + m[0].length;
    let i = from;
    while (i < text.length && text[i] !== quote) i += text[i] === "\\" ? 2 : 1;
    out.push(text.slice(from, i));
  }
  return out;
}

function leavesOf(mini: string): { s: string; n?: number }[] {
  const out: { s: string; n?: number }[] = [];
  for (const m of mini.matchAll(LEAF)) {
    const [name, n] = m[0].split(":") as [string, string | undefined];
    if (REST.has(name)) continue;
    out.push(n === undefined ? { s: name } : { s: name, n: Number(n) });
  }
  return out;
}

export function soundsIn(code: string): PreloadSpec {
  const sounds: SoundSpec[] = [];
  const seen = new Set<string>();
  for (const statement of statementsOf(stripComments(code))) {
    const banks = stringArgsOf(statement, ["bank"]).flatMap((b) => leavesOf(b).map((l) => l.s));
    const notes = stringArgsOf(statement, ["note"]).flatMap((text) =>
      text.split(/[^A-Za-z0-9#-]+/).filter((t) => NOTE.test(t)),
    );
    for (const text of stringArgsOf(statement, ["s", "sound"])) {
      for (const leaf of leavesOf(text)) {
        for (const bank of banks.length > 0 ? banks : [undefined]) {
          const spec: SoundSpec = { s: leaf.s };
          if (bank !== undefined) spec.bank = bank;
          if (leaf.n !== undefined) spec.n = leaf.n;
          if (notes.length > 0) spec.notes = [...new Set(notes)];
          const key = JSON.stringify([spec.bank, spec.s, spec.n, spec.notes]);
          if (seen.has(key)) continue;
          seen.add(key);
          sounds.push(spec);
        }
      }
    }
  }
  return { sounds };
}
