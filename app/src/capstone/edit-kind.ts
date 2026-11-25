import type { AnalysisSummary } from "@oak/api";

export type EditKind = "tweaks" | "swing-back" | "changes";

export interface EditVersion {
  version: number | null;
  code: string;
  analysis: AnalysisSummary | null;
}

function stringEnd(code: string, start: number): number {
  const quote = code[start];
  let end = start + 1;
  while (end < code.length) {
    const char = code[end++];
    if (char === "\\") end = Math.min(end + 1, code.length);
    else if (char === quote) break;
  }
  return end;
}

/** Code with comments removed and whitespace runs collapsed (strings untouched). */
export function normCode(code: string): string {
  let out = "";
  let space = false;
  for (let i = 0; i < code.length; ) {
    const char = code[i];
    if (char === "/" && code[i + 1] === "/") {
      i += 2;
      while (i < code.length && !/[\r\n\u2028\u2029]/.test(code[i] ?? "")) i++;
    } else if (char === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      i = end === -1 ? code.length : end + 2;
    } else if (/\s/.test(char ?? "")) {
      space = true;
      i++;
    } else {
      if (space && out.length > 0) out += " ";
      space = false;
      // Mini-notation and template contents describe music, including their numbers and whitespace.
      const end = char === '"' || char === "'" || char === "`" ? stringEnd(code, i) : i + 1;
      out += code.slice(i, end);
      i = end;
    }
  }
  return out;
}

/** The code's token shape: `normCode` with every numeric literal outside a string replaced by `#`. */
export function codeShape(code: string): string {
  const normalized = normCode(code);
  let out = "";
  const number = /(?:0[xX][\da-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/y;
  for (let i = 0; i < normalized.length; ) {
    const char = normalized[i];
    if (char === '"' || char === "'" || char === "`") {
      const end = stringEnd(normalized, i);
      out += normalized.slice(i, end);
      i = end;
    } else {
      // A digit in a label or variable name is part of its identity, not a control value.
      number.lastIndex = i;
      const literal = /[A-Za-z0-9_$]/.test(normalized[i - 1] ?? "") ? null : number.exec(normalized);
      if (literal) {
        out += "#";
        i = number.lastIndex;
      } else {
        out += char;
        i++;
      }
    }
  }
  return out;
}

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sortedKeys(entry)]),
    );
  }
  return value;
}

/** A stable key of the parts of an analysis that say what the music is, or `null`. */
export function analysisKey(a: AnalysisSummary | null): string | null {
  if (a === null) return null;
  return JSON.stringify(
    sortedKeys({
      bars: a.bars,
      form: a.form,
      roles: a.roles,
      slots: a.slots.map((s) => `${s.bar}:${s.beat}:${s.symbol}`),
      cadences: a.cadences.map((c) => `${c.bar}:${c.type}`),
      devices: [...a.devices].sort(),
    }),
  );
}

export function classifyRecentEdits(versions: readonly EditVersion[]): EditKind {
  const ordered = [...versions].sort((a, b) => {
    if (a.version === null) return b.version === null ? 0 : 1;
    if (b.version === null) return -1;
    return a.version - b.version;
  });
  const last = ordered.at(-1);
  const prev = ordered.at(-2);
  if (!last || !prev) return "changes";

  const codes = ordered.map((v) => normCode(v.code));
  const lastCode = codes.at(-1);
  const earlierCodes = codes.slice(0, -2);
  if (lastCode !== codes.at(-2) && earlierCodes.includes(lastCode ?? "")) return "swing-back";

  const lastAnalysis = analysisKey(last.analysis);
  if (
    lastAnalysis !== null &&
    lastAnalysis !== analysisKey(prev.analysis) &&
    ordered.slice(0, -2).some((v) => analysisKey(v.analysis) === lastAnalysis)
  ) {
    return "swing-back";
  }

  // Comparing the whole window keeps a later value tweak from hiding an earlier structural edit.
  const shape = codeShape(ordered[0]?.code ?? "");
  return ordered.every((v) => codeShape(v.code) === shape) ? "tweaks" : "changes";
}
