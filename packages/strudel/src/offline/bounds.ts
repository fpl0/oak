// What keeps an export from hanging the page (wave7.md §3.4, carry f2). The frame is a same-origin iframe, so it
// shares the editor's main thread: a timer cannot interrupt a script that never returns. Three bounds, each a
// refusal with a plain message, never a hang:
//   1. Before any frame exists, the source is read, not run: the base lint the editor uses; no JavaScript loop
//      (`for`, `while`, `do`: the base profile lets a learner type one, and an export cannot stop one that never
//      ends); the piece's length from its arrange() form (at most 128 bars); and every number the code writes, in
//      JS or inside a pattern string, at most 100 000 (`.fast(1e9)`, `"c4*1000000000"`, `run(10 ** 9)`).
//   2. The render's length is the form's computed length; nothing past its last bar is queried or scheduled.
//   3. The notes are read from the pattern a slice at a time, the slice growing only while the notes stay sparse,
//      against a note budget and a time budget; a pattern that grows denser than either is refused there.
import { lintBase, lintStrict, sectionsFromAst } from "@oak/grader";
import { parse } from "acorn";
import { PieceRenderError } from "./errors.ts";
import { MAX_PIECE_BARS } from "./math.ts";

/** The largest number an exported piece may write: above any tempo, frequency or step count a piece uses. */
export const MAX_LITERAL = 100_000;
/** Notes an export may schedule (polyphony and memory): the renderer's budget since Foundation. */
export const MAX_NOTES = 60_000;
/** Time the frame may spend reading notes from the pattern before it refuses. */
export const QUERY_BUDGET_MS = 10_000;

interface Node {
  type: string;
  [key: string]: unknown;
}
const isNode = (v: unknown): v is Node =>
  typeof v === "object" && v !== null && typeof (v as { type?: unknown }).type === "string";

/** A constant numeric expression's value (`10 ** 9`, `1000 * 1000`, `-1e6`), or null when it reads a name. */
function constant(node: Node): number | null {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "number" ? node.value : null;
    case "UnaryExpression": {
      const v = isNode(node.argument) ? constant(node.argument) : null;
      return v === null ? null : node.operator === "-" ? -v : node.operator === "+" ? v : null;
    }
    case "BinaryExpression": {
      const a = isNode(node.left) ? constant(node.left) : null;
      const b = isNode(node.right) ? constant(node.right) : null;
      if (a === null || b === null) return null;
      switch (node.operator) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return a / b;
        case "%":
          return a % b;
        case "**":
          return a ** b;
        case "<<":
          return a * 2 ** b;
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

/** Every number written inside a string (mini-notation): `c4*1000000`, `1e9`, `<0 250000>`. */
const NUMBER_IN_TEXT = /(?<![\w.])\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi;
function textNumbers(text: string): number[] {
  return [...text.matchAll(NUMBER_IN_TEXT)].map((m) => Number(m[0]));
}

const LOOPS = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
]);

/** The largest magnitude the code writes (a constant expression or inside a string), and whether it loops. */
export function readSource(code: string): { largest: number; loops: boolean } {
  let ast: Node;
  try {
    ast = parse(code, { ecmaVersion: 2022, allowAwaitOutsideFunction: true }) as unknown as Node;
  } catch {
    return { largest: 0, loops: false }; // A parse error is the lint's to report.
  }
  let largest = 0;
  let loops = false;
  const note = (v: number | null) => {
    if (v === null) return;
    largest = Math.max(largest, Number.isNaN(v) ? Number.POSITIVE_INFINITY : Math.abs(v));
  };
  const visit = (node: Node) => {
    if (LOOPS.has(node.type)) loops = true;
    const value = constant(node);
    if (value !== null) {
      note(value);
      return;
    }
    if (node.type === "Literal" && typeof node.value === "string")
      for (const n of textNumbers(node.value)) note(n);
    if (node.type === "TemplateElement") {
      const v = node.value as { cooked?: string | null; raw: string };
      for (const n of textNumbers(v.cooked ?? v.raw)) note(n);
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === "type") continue;
      if (Array.isArray(child)) {
        for (const c of child) if (isNode(c)) visit(c);
      } else if (isNode(child)) visit(child);
    }
  };
  visit(ast);
  return { largest, loops };
}

/** The largest magnitude the code writes, as a constant expression or inside a string, or 0. */
export const largestNumber = (code: string): number => readSource(code).largest;

/**
 * Read the source before running it (bound 1): the bars of its form when it may be rendered, otherwise a typed
 * refusal. `authored` reads Band code with the strict profile; a Band has no form of its own (it follows the piece).
 * `form: false` reads a learner's code that needs no form of its own: a unit song's take or live Make, whose length
 * is the song's (spec §5.2).
 */
export function checkSource(code: string, authored = false, form = !authored): number | null {
  const diagnostics = (authored ? lintStrict : lintBase)(code).filter((d) => d.severity === "error");
  if (diagnostics.length)
    throw new PieceRenderError(
      "evaluation",
      `${authored ? "Band" : "Piece"}: ${diagnostics.map((d) => d.message).join(" ")}`,
    );
  const { largest, loops } = readSource(code);
  // "length": a loop's end cannot be known before it runs, as a piece without a form has no known end.
  if (loops)
    throw new PieceRenderError(
      "length",
      "The piece runs a JavaScript loop (for or while). An export cannot stop a loop that never ends, so it takes pieces written as patterns only: write the repeats with the pattern's own tools.",
    );
  if (largest > MAX_LITERAL)
    throw new PieceRenderError(
      "too-long",
      `The ${authored ? "Band" : "piece"} writes the number ${formatNumber(largest)}; an export takes numbers up to ${formatNumber(MAX_LITERAL)}, so it would never finish.`,
    );
  if (authored || !form) return null;
  const sections = sectionsFromAst(code);
  const bars = sections && ("totalBars" in sections ? sections.totalBars : sections.arrangedBars);
  if (!bars)
    throw new PieceRenderError(
      "length",
      sections && "inconsistent" in sections
        ? sections.inconsistent.detail
        : "Give the piece an arrangement: one arrange() per sectioned track, so the export knows where it ends.",
    );
  if (!Number.isInteger(bars) || bars <= 0)
    throw new PieceRenderError("length", "The piece needs a readable arrangement with whole bars.");
  if (bars > MAX_PIECE_BARS)
    throw new PieceRenderError(
      "too-long",
      `The piece has ${bars} bars; exports support at most ${MAX_PIECE_BARS}.`,
    );
  return bars;
}

const formatNumber = (n: number): string =>
  Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 3 }) : "too large to write";

export interface QueryablePattern<H> {
  queryArc(begin: number, end: number, state?: unknown): H[];
}
export interface BoundedQueryOptions<H> {
  bars: number;
  state?: unknown;
  hasOnset: (hap: H) => boolean;
  maxNotes?: number;
  budgetMs?: number;
  now?: () => number;
}

/**
 * Bound 3: the notes with an onset in [0, bars), read in slices. A slice starts at 2^-18 of a bar (so even two
 * numbers at the limit multiplied, 10^10 notes a bar, give a first slice of under 40 000 notes) and doubles, up to
 * a bar, while it holds fewer than 1/256 of the note budget; it halves (down to 2^-20) when it holds more than
 * 1/16. Past the note budget or the time budget the export is refused with a plain message. A slice is half-open
 * on its whole's onset, so a note that spans two slices is counted once.
 */
export function boundedQuery<H>(pattern: QueryablePattern<H>, options: BoundedQueryOptions<H>): H[] {
  const maxNotes = options.maxNotes ?? MAX_NOTES;
  const budgetMs = options.budgetMs ?? QUERY_BUDGET_MS;
  const now = options.now ?? (() => performance.now());
  const started = now();
  const out: H[] = [];
  let at = 0;
  let width = 2 ** -18;
  while (at < options.bars) {
    // A slice never crosses a bar line, so a refusal names the bar it happened in.
    const end = Math.min(options.bars, at + width, Math.floor(at) + 1);
    const got = pattern.queryArc(at, end, options.state).filter(options.hasOnset);
    for (const hap of got) out.push(hap);
    if (out.length > maxNotes)
      throw new PieceRenderError(
        "too-long",
        `The piece plays more than ${formatNumber(maxNotes)} notes by bar ${Math.floor(at) + 1}; an export stops there. Thin out the fastest part.`,
      );
    if (now() - started > budgetMs)
      throw new PieceRenderError(
        "timeout",
        `Reading the notes took longer than ${budgetMs / 1000} seconds by bar ${Math.floor(at) + 1}. Thin out the fastest part.`,
      );
    at = end;
    if (got.length < maxNotes / 256) width = Math.min(1, width * 2);
    else if (got.length > maxNotes / 16) width = Math.max(2 ** -20, width / 2);
  }
  return out;
}
