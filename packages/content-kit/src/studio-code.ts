// Oak 2.0 W1: the lines of a Studio sketch, read as plain text (no Strudel, no AST). Scraps, starting points,
// takes, focus, plain sounds and commit-sounds all cut and combine the learner's code through these functions, so
// they agree on what "a line" is. Isomorphic and pure.
//
// A statement starts at a line whose first code is outside any string, template, comment or bracket. A line whose
// first code is `.` (or `?.`), or any line while a bracket, string or template is still open, continues it. Blank
// and comment-only lines belong to no statement. A statement's text runs from its first code to its last code: no
// leading indent, no trailing comment, no trailing newline.
import { LABEL_ROLES, type Layer } from "./schema/common.ts";

export interface CodeLine {
  /** As written, mute marks included (`_bass`, `bass_`, `$`). */
  label: string;
  /** Strudel mutes a label that starts or ends with `_`. */
  muted: boolean;
  /** Offsets into the code: `code.slice(from, to) === text`. */
  from: number;
  to: number;
  text: string;
}

export interface ConstDecl {
  name: string;
  from: number;
  to: number;
  text: string;
}

export interface ChainLink {
  name: string;
  /** The text between the call's parentheses, trimmed. */
  args: string;
}

// --- scanning ------------------------------------------------------------------------------------

const CODE = 0;
const STR = 1;
const COMMENT = 2;

interface Scan {
  /** Per character: CODE, STR (string or template text, quotes and `${`/`}` included) or COMMENT. */
  cls: Uint8Array;
  /** Per character: 1 when, before it, nothing is open (no bracket, string, template or comment). */
  top: Uint8Array;
}

function scan(code: string): Scan {
  const n = code.length;
  const cls = new Uint8Array(n);
  const top = new Uint8Array(n);
  // Open brackets, `${` and template text ("`").
  const stack: string[] = [];
  let i = 0;
  while (i < n) {
    const c = code[i] as string;
    const inTemplateText = stack[stack.length - 1] === "`";
    if (!inTemplateText && stack.length === 0) top[i] = 1;
    if (inTemplateText) {
      cls[i] = STR;
      if (c === "\\") {
        if (i + 1 < n) cls[i + 1] = STR;
        i += 2;
      } else if (c === "`") {
        stack.pop();
        i++;
      } else if (c === "$" && code[i + 1] === "{") {
        cls[i + 1] = STR;
        stack.push("${");
        i += 2;
      } else i++;
      continue;
    }
    const next = code[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && code[i] !== "\n") cls[i++] = COMMENT;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      while (i < stop) cls[i++] = COMMENT;
      continue;
    }
    if (c === '"' || c === "'") {
      cls[i++] = STR;
      while (i < n && code[i] !== c && code[i] !== "\n") {
        if (code[i] === "\\" && i + 1 < n) cls[i++] = STR;
        cls[i++] = STR;
      }
      if (i < n && code[i] === c) cls[i++] = STR;
      continue;
    }
    if (c === "`") {
      cls[i++] = STR;
      stack.push("`");
      continue;
    }
    if (c === "(" || c === "[" || c === "{") stack.push(c);
    else if (c === "}" && stack[stack.length - 1] === "${") {
      cls[i++] = STR;
      stack.pop();
      continue;
    } else if (c === ")" || c === "]" || c === "}") {
      const open = c === ")" ? "(" : c === "]" ? "[" : "{";
      if (stack[stack.length - 1] === open) stack.pop();
    }
    cls[i++] = CODE;
  }
  return { cls, top };
}

/** The code with comments blanked to spaces and string text to NUL, newlines kept: offsets are unchanged. */
function masked(code: string, s: Scan): string {
  let out = "";
  for (let i = 0; i < code.length; i++) {
    const c = code[i] as string;
    const k = s.cls[i];
    out += k === CODE || c === "\n" ? c : k === COMMENT ? " " : "\0";
  }
  return out;
}

const isSpace = (c: string | undefined): boolean => c === " " || c === "\t" || c === "\r" || c === "\n";

interface Statement {
  from: number;
  to: number;
  /** Start of the physical line holding `from`, end of the one holding `to` (no newline). */
  lineFrom: number;
  lineTo: number;
  text: string;
}

function statementsOf(code: string, s: Scan = scan(code)): Statement[] {
  const out: Statement[] = [];
  let cur: Statement | null = null;
  const close = () => {
    if (cur) {
      cur.text = code.slice(cur.from, cur.to);
      out.push(cur);
      cur = null;
    }
  };
  let lineStart = 0;
  while (lineStart <= code.length) {
    let lineEnd = code.indexOf("\n", lineStart);
    if (lineEnd < 0) lineEnd = code.length;
    let first = -1;
    let last = -1;
    for (let i = lineStart; i < lineEnd; i++) {
      if (s.cls[i] === COMMENT || isSpace(code[i])) continue;
      if (first < 0) first = i;
      last = i;
    }
    if (first >= 0) {
      const continues =
        cur !== null && (!s.top[first] || code[first] === "." || code.startsWith("?.", first));
      if (continues && cur) {
        const c: Statement = cur;
        c.to = last + 1;
        c.lineTo = lineEnd;
      } else {
        close();
        cur = { from: first, to: last + 1, lineFrom: lineStart, lineTo: lineEnd, text: "" };
      }
    }
    lineStart = lineEnd + 1;
  }
  close();
  return out;
}

const LABEL_RE = /^([A-Za-z_$][\w$]*)\s*:(?!:)/;
const CONST_RE = /^const\s+([A-Za-z_$][\w$]*)\s*=/;
const TEMPO_RE = /^(?:setcpm|setCpm|setcps|setCps)\s*\(/;

function toCodeLine(st: Statement): CodeLine | null {
  const m = LABEL_RE.exec(st.text);
  if (!m) return null;
  const label = m[1] as string;
  const muted = label.length > 1 && (label.startsWith("_") || label.endsWith("_"));
  return { label, muted, from: st.from, to: st.to, text: st.text };
}

// --- lines ---------------------------------------------------------------------------------------

/** Every labelled statement (`drums: …`, `$: …`, muted ones included), in source order. */
export function labelledLines(code: string): CodeLine[] {
  const out: CodeLine[] = [];
  for (const st of statementsOf(code)) {
    const line = toCodeLine(st);
    if (line) out.push(line);
  }
  return out;
}

/**
 * The labelled statement whose physical lines hold `offset` (a cursor: the end of the last line counts), or `null`
 * on a blank line, an unlabelled statement or outside every statement.
 */
export function lineAt(code: string, offset: number): CodeLine | null {
  for (const st of statementsOf(code)) {
    if (offset >= st.lineFrom && offset <= st.lineTo) return toCodeLine(st);
  }
  return null;
}

/** Top-level `const <name> = …` statements, in source order. */
export function constDecls(code: string): ConstDecl[] {
  const out: ConstDecl[] = [];
  for (const st of statementsOf(code)) {
    const m = CONST_RE.exec(st.text);
    if (m) out.push({ name: m[1] as string, from: st.from, to: st.to, text: st.text });
  }
  return out;
}

/** Identifiers read as values in `text` (masked): property names after `.` are not. */
function identifiersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?<![\w$])[A-Za-z_$][\w$]*/g)) {
    let j = m.index - 1;
    while (j >= 0 && isSpace(text[j])) j--;
    if (text[j] === "." && text[j - 1] !== ".") continue;
    out.add(m[0]);
  }
  return out;
}

/**
 * A line with what it needs to run on its own: every const it uses, transitively, in source order, then the line,
 * joined by `\n`. A label means its first statement; a `CodeLine` means that statement. `null` when the label is not
 * in the code. The tempo line is not included (`tempoLineOf`).
 */
export function scrapCode(code: string, line: string | CodeLine): string | null {
  const s = scan(code);
  const statements = statementsOf(code, s);
  let target: CodeLine | null = null;
  if (typeof line === "string") {
    for (const st of statements) {
      const l = toCodeLine(st);
      if (l && l.label === line) {
        target = l;
        break;
      }
    }
  } else target = line;
  if (!target) return null;
  const mask = masked(code, s);
  const decls = new Map<string, ConstDecl & { uses: Set<string> }>();
  for (const st of statements) {
    const m = CONST_RE.exec(st.text);
    const name = m?.[1];
    if (!name || decls.has(name)) continue;
    const body = mask.slice(st.from + (m?.[0].length ?? 0), st.to);
    decls.set(name, { name, from: st.from, to: st.to, text: st.text, uses: identifiersIn(body) });
  }
  // The label itself is not a use (`chords: …` does not need `const chords`).
  const lineMask = masked(target.text, scan(target.text));
  const labelLen = LABEL_RE.exec(target.text)?.[0].length ?? 0;
  const needed = new Set<string>();
  const queue = [...identifiersIn(lineMask.slice(labelLen))];
  while (queue.length > 0) {
    const name = queue.pop() as string;
    const d = decls.get(name);
    if (!d || needed.has(name)) continue;
    needed.add(name);
    queue.push(...d.uses);
  }
  const parts = [...decls.values()]
    .filter((d) => needed.has(d.name) && d.from !== target.from)
    .sort((a, b) => a.from - b.from)
    .map((d) => d.text);
  parts.push(target.text);
  return parts.join("\n");
}

/** The first top-level `setcpm(…)` (or `setcps`, `setCpm`, `setCps`) statement, or `null`. */
export function tempoLineOf(code: string): string | null {
  for (const st of statementsOf(code)) if (TEMPO_RE.test(st.text)) return st.text;
  return null;
}

// --- call chains and sound settings --------------------------------------------------------------

/**
 * `note("c2").s("ebass").lpf(600)` → `note`, `s`, `lpf` with their argument text. Only top-level links; a nested
 * call stays inside its link's `args`. `null` for anything that is not `name(…)` followed by `.name(…)` links (a
 * label, a string or identifier root, a property without a call, trailing code). A trailing `;` is allowed.
 */
export function chainLinks(expr: string): ChainLink[] | null {
  const mask = masked(expr, scan(expr));
  const n = mask.length;
  const links: ChainLink[] = [];
  let i = 0;
  const skip = () => {
    while (i < n && isSpace(mask[i])) i++;
  };
  const ident = /[A-Za-z_$][\w$]*/y;
  skip();
  for (;;) {
    ident.lastIndex = i;
    const m = ident.exec(mask);
    if (!m) return null;
    i += m[0].length;
    skip();
    if (mask[i] !== "(") return null;
    const open = i;
    let depth = 0;
    for (; i < n; i++) {
      const c = mask[i];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (i >= n) return null;
    links.push({ name: m[0], args: expr.slice(open + 1, i).trim() });
    i++;
    skip();
    if (i >= n) return links;
    if (mask[i] === ";") {
      i++;
      skip();
      return i >= n ? links : null;
    }
    if (mask[i] !== ".") return null;
    i++;
    skip();
  }
}

/** The links that change how a line sounds, not what it plays (commit sounds, "Make this my Blank"). */
export const SOUND_LINKS: ReadonlySet<string> = new Set([
  "s",
  "sound",
  "bank",
  "gain",
  "velocity",
  "postgain",
  "pan",
  "lpf",
  "cutoff",
  "hpf",
  "hcutoff",
  "resonance",
  "lpq",
  "hpq",
  "room",
  "size",
  "roomsize",
  "delay",
  "delaytime",
  "delayfeedback",
  "distort",
  "crush",
  "coarse",
  "shape",
  "vowel",
  "phaser",
  "attack",
  "decay",
  "sustain",
  "release",
  "adsr",
  "orbit",
  "legato",
  "voicing",
  "dict",
]);

/**
 * A statement's sound settings: its `SOUND_LINKS` links after the first call, re-joined as `.name(args)` in written
 * order (`bass: note("c2 e2").s("ebass").lpf(600)` → `.s("ebass").lpf(600)`). The first call is the pattern itself
 * (`s("bd hh")` on a drum line is the rhythm), so it never counts. A leading label is skipped; `""` when the
 * statement is not a call chain or has no sound links.
 */
export function soundSettingsOf(statement: string): string {
  const label = LABEL_RE.exec(statement.trimStart());
  const expr = label ? statement.trimStart().slice(label[0].length) : statement;
  const links = chainLinks(expr);
  if (!links) return "";
  return links
    .slice(1)
    .filter((l) => SOUND_LINKS.has(l.name))
    .map((l) => `.${l.name}(${l.args})`)
    .join("");
}

// --- roles ---------------------------------------------------------------------------------------

export const STUDIO_ROLES = ["drums", "bass", "chords", "tune", "other"] as const;
export type StudioRole = (typeof STUDIO_ROLES)[number];

/**
 * The Studio role of a label, from `LABEL_ROLES` (`drums kick snare hats perc` → drums, `bass`, `chords pad` →
 * chords, `mel vox` → tune), read without its mute marks (`_bass` → bass) and without a trailing number (`bass2`,
 * the second bass line that combining scraps writes, is still a bass: Oak's call). Anything else is `other`.
 */
export function roleOfLabel(label: string): StudioRole {
  const base = label.replace(/^_+|_+$/g, "").replace(/(?<=[A-Za-z])\d+$/, "");
  if (!Object.hasOwn(LABEL_ROLES, base)) return "other";
  const layer: Exclude<Layer, "all"> | undefined = LABEL_ROLES[base as keyof typeof LABEL_ROLES];
  if (!layer) return "other";
  return layer === "melody" ? "tune" : layer;
}

/**
 * The sound each role plays while "plain sounds" is on (a listening mode: never written into the code). Oak's call
 * until W2's sound pack v5 plain role sounds replace these names here, in one edit.
 */
export const PLAIN_SOUNDS: Readonly<Record<"bass" | "chords" | "tune", string>> = {
  bass: "triangle",
  chords: "piano",
  tune: "sine",
};
