// Friendly evaluation errors (ux §7.11 voice: second person, short, musical words, no blame). Strudel's raw
// messages ("[mini] parse error at line 1: Expected "!", "(", "*", … but "\"" found.", "note(...).s(...).fooBar
// is not a function") are accurate but unreadable for a learner. This maps them to one calm sentence and,
// where the raw error carries no position, finds the place in the code it is about. Pure: tested under Bun.
import type { CodeRange } from "@oak/content-kit";

export interface FriendlyError {
  /** One or two short sentences for the learner. */
  message: string;
  /** Where in the code it is about, when that can be found. */
  range: CodeRange | null;
  /** The raw message, prefixes stripped (for a "details" disclosure). */
  detail: string;
}

const PAIRS: readonly (readonly [string, string])[] = [
  ["[", "]"],
  ["<", ">"],
  ["{", "}"],
  ["(", ")"],
];

interface StringLit {
  from: number;
  to: number;
  body: string;
}

/** Double-quoted and backtick string literals (Strudel parses both as mini-notation). Unclosed ones run to EOL. */
export function stringLiterals(code: string): StringLit[] {
  const out: StringLit[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (ch === '"' || ch === "`" || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      while (i < code.length && code[i] !== quote && (quote === "`" || code[i] !== "\n")) {
        if (code[i] === "\\") i++;
        i++;
      }
      const end = Math.min(i + 1, code.length);
      if (quote !== "'")
        out.push({ from: start, to: end, body: code.slice(start + 1, Math.max(start + 1, i)) });
      i = end;
      continue;
    }
    i++;
  }
  return out;
}

/** The first bracket problem in a mini-notation body: an unclosed opener or a stray closer. */
export function bracketProblem(body: string): { offset: number; text: string } | null {
  const stack: { ch: string; at: number }[] = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i] as string;
    const open = PAIRS.find((p) => p[0] === ch);
    if (open) {
      stack.push({ ch, at: i });
      continue;
    }
    const close = PAIRS.find((p) => p[1] === ch);
    if (!close) continue;
    const top = stack.pop();
    if (!top) return { offset: i, text: `There is a "${ch}" with no "${close[0]}" before it.` };
    if (top.ch !== close[0]) {
      const want = PAIRS.find((p) => p[0] === top.ch)?.[1] ?? "";
      return { offset: i, text: `The "${top.ch}" is closed with "${ch}"; it needs "${want}".` };
    }
  }
  const left = stack.pop();
  if (left) {
    const want = PAIRS.find((p) => p[0] === left.ch)?.[1] ?? "";
    return { offset: left.at, text: `A "${left.ch}" is never closed: add a "${want}".` };
  }
  return null;
}

function lineAt(code: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < Math.min(offset, code.length); i++) if (code.charCodeAt(i) === 10) line++;
  return line;
}

/** Drops "Error:", "TypeError:", "pattern string:" … prefixes. */
export function stripPrefixes(raw: string): string {
  let s = raw.trim();
  for (;;) {
    const next = s.replace(/^(?:[A-Z][A-Za-z]*Error|Error|pattern string|evaluation error|oak)\s*:\s*/, "");
    if (next === s) return s;
    s = next;
  }
}

function findWord(code: string, word: string, before: RegExp | null, after: RegExp | null): CodeRange | null {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${before ? before.source : "\\b"}(${escaped})${after ? after.source : "\\b"}`, "g");
  let last: CodeRange | null = null;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    const at = m.index + m[0].indexOf(m[1] as string);
    last = { from: at, to: at + word.length };
  }
  return last;
}

/** A raw evaluation error (message, and optionally its offset) to a learner-facing sentence and a range. */
export function friendlyEvalError(raw: string, code: string, offset?: number | null): FriendlyError {
  const detail = stripPrefixes(raw);
  const at = (from: number, to = from + 1): CodeRange => ({
    from: Math.max(0, Math.min(from, code.length)),
    to: Math.max(0, Math.min(Math.max(to, from), code.length)),
  });
  const known = typeof offset === "number" && offset >= 0 ? at(offset) : null;

  // Strudel's own parser errors only: "[mini] parse error …". Not any message that mentions mini-notation (Oak's
  // lint says "The mini-notation `,` unlocks in the lesson “Together Now”", which is not a typo).
  if (/\[mini\]|\bparse error\b/i.test(detail)) {
    for (const lit of stringLiterals(code)) {
      const problem = bracketProblem(lit.body);
      if (problem) {
        const pos = lit.from + 1 + problem.offset;
        return {
          message: `Line ${lineAt(code, pos)}: ${problem.text} The pattern in quotes can't be read until then.`,
          range: at(pos),
          detail,
        };
      }
    }
    const found = /but "(.+?)" found/.exec(detail)?.[1];
    const lit = stringLiterals(code).find((l) => found !== undefined && l.body.includes(found)) ?? null;
    const range = known ?? (lit ? at(lit.from, lit.to) : null);
    const line = range ? `Line ${lineAt(code, range.from)}: ` : "";
    return {
      message: `${line}a pattern in quotes has a typo the mini-notation can't read${found && found !== '\\"' ? ` (near "${found}")` : ""}. Check its brackets and symbols.`,
      range,
      detail,
    };
  }

  const notFn = /([A-Za-z_$][\w$]*)(?:\(\.\.\.\))?\s+is not a function/.exec(detail);
  if (notFn) {
    const name = notFn[1] as string;
    const range = known ?? findWord(code, name, /\.?/, /\s*\(/);
    const line = range ? `Line ${lineAt(code, range.from)}: ` : "";
    return {
      message: `${line}\`${name}\` isn't a Strudel function. Check its spelling, or remove it.`,
      range,
      detail,
    };
  }

  const notDefined = /([A-Za-z_$][\w$]*) is not defined/.exec(detail);
  if (notDefined) {
    const name = notDefined[1] as string;
    const range = known ?? findWord(code, name, null, null);
    const line = range ? `Line ${lineAt(code, range.from)}: ` : "";
    // A part named for a section (`drumsChorus`, `melA`) or used inside `arrange()`: it is a const the learner
    // has not written yet, not a pattern that wants quotes.
    const inArrange = new RegExp(`arrange\\s*\\([^;]*\\b${name}\\b`).test(code);
    if (inArrange || /^[a-z]+[A-Z][A-Za-z0-9]*$/.test(name))
      return {
        message: `${line}\`${name}\` isn't defined yet. Write \`const ${name} = …\` above the line that uses it, or check the spelling against the const you wrote.`,
        range,
        detail,
      };
    return {
      message: `${line}\`${name}\` isn't something Strudel knows. Check the spelling; a pattern goes in quotes, like "${name}".`,
      range,
      detail,
    };
  }

  if (/Unterminated string|Unterminated template/i.test(detail)) {
    const line = known ? `Line ${lineAt(code, known.from)}: ` : "";
    return { message: `${line}a quote is never closed.`, range: known, detail };
  }

  if (/Unexpected (token|character|end of input)|Unexpected/i.test(detail)) {
    const line = known ? `Line ${lineAt(code, known.from)}: ` : "";
    return {
      message: `${line}the code can't be read here. Check brackets, commas and quotes.`,
      range: known,
      detail,
    };
  }

  if (/Cannot read propert(y|ies) of (undefined|null)/i.test(detail)) {
    return {
      message: "Something in this code is empty where a pattern was expected. Check the last change.",
      range: known,
      detail,
    };
  }

  // Unknown: the raw message's first sentence, without the error class.
  const first = (detail.split(/(?<=\.)\s/)[0] ?? detail).slice(0, 200);
  return { message: first.length > 0 ? first : "The code didn't run.", range: known, detail };
}
