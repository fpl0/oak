// Oak 2.0 W3 (PLAN §4 S5 "Derive a part"): read one labelled line's rhythm or drum names as mini-notation, so the
// Studio can write a new, visible part from it (`.struct("x ~ x x")`, `n("0 ~ 4 0")`). Pure; no evaluation. The leaves
// are Strudel's own (`mini2ast`), so operator operands (`*2`, `(3,8)`, `@2`) are never mistaken for notes.
import {
  type AstNode,
  chainOf,
  isMiniLiteral,
  parseProgram,
  programInfo,
  type StringLit,
  stringLit,
} from "../lint/ast.ts";
import { type MiniNode, miniAst } from "../runtime/strudel.ts";

/** A source leaf of a mini-notation string, with absolute offsets into the code (trimmed). */
export interface MiniLeaf {
  start: number;
  end: number;
  text: string;
}

/** The labelled expression, or `null` when the label is missing or the code does not parse. */
export function labelledExpr(code: string, label: string): { stmt: AstNode; expr: AstNode } | null {
  const parsed = parseProgram(code);
  if (!parsed.ok) return null;
  const part = programInfo(parsed.ast).labels.find((p) => p.label === label);
  return part?.expr ? { stmt: part.node, expr: part.expr } : null;
}

/**
 * The source leaves of a mini-notation literal (operator operands left out), each trimmed and, when a sample
 * number follows (`bd:3`), widened over it. `null` when the string does not parse as mini-notation.
 */
export function miniLeaves(code: string, lit: StringLit): MiniLeaf[] | null {
  const contentStart = lit.contentStart;
  const contentEnd = lit.node.end - 1;
  const content = code.slice(contentStart, contentEnd);
  let root: MiniNode;
  try {
    root = miniAst(content);
  } catch {
    return null;
  }
  const leaves: MiniLeaf[] = [];
  const visit = (node: MiniNode): void => {
    if (node.type_ === "atom" && node.location_) {
      let start = contentStart + node.location_.start.offset - 1;
      let end = Math.min(contentStart + node.location_.end.offset - 1, contentEnd);
      // Strudel 1.2.6 locations can carry the whitespace around a leaf.
      while (start < end && /\s/.test(code[start] as string)) start++;
      while (end > start && /\s/.test(code[end - 1] as string)) end--;
      if (end <= start) return;
      // A sample number (`bd:3`) belongs to its leaf.
      if (code[end] === ":") {
        let e = end + 1;
        while (e < contentEnd && /[\w.#-]/.test(code[e] as string)) e++;
        end = e;
      }
      leaves.push({ start, end, text: code.slice(start, end) });
    } else if (Array.isArray(node.source_)) {
      for (const child of node.source_ as MiniNode[]) visit(child);
    } else if (node.source_ && typeof node.source_ === "object") {
      visit(node.source_ as MiniNode);
    }
  };
  visit(root);
  return leaves.sort((a, b) => a.start - b.start);
}

/** The literal's content with each leaf replaced by `f(leaf)` (offsets relative to the literal). */
function rewriteLeaves(code: string, lit: StringLit, f: (leaf: MiniLeaf) => string): string | null {
  const leaves = miniLeaves(code, lit);
  if (!leaves) return null;
  const contentStart = lit.contentStart;
  let out = "";
  let from = contentStart;
  for (const leaf of leaves) {
    out += code.slice(from, leaf.start) + f(leaf);
    from = leaf.end;
  }
  return out + code.slice(from, lit.node.end - 1);
}

const isRest = (text: string): boolean => text === "~" || text === "-";
/** A leaf a `.struct` reads as no hit: Strudel's struct keeps only truthy values. */
const isFalsy = (text: string): boolean => /^(?:0+(?:\.0+)?|f|false)$/.test(text);
const HEADS = new Set(["s", "sound", "n", "note"]);
const DRUM_HEADS = new Set(["s", "sound"]);

/** The first argument of a link when it is a mini-notation string literal (double quotes or backticks). */
function miniArg(args: readonly AstNode[]): StringLit | null {
  const lit = stringLit(args[0] ?? null);
  return lit && isMiniLiteral(lit) ? lit : null;
}

/**
 * The line's rhythm as mini-notation with every sounding leaf written `x`: taken from its `.struct("…")` link when it
 * has one, else from the first argument of its head call (`s`, `sound`, `n`, `note`); rests, brackets and operators
 * (`*`, `!`, `@`, `<>`, `,`) are kept. `null` when the label is missing or the rhythm is not a string literal (a const).
 */
export function rhythmMini(code: string, label: string): string | null {
  const part = labelledExpr(code, label);
  if (!part) return null;
  const chain = chainOf(part.expr);
  const struct = chain.links.find((l) => l.name === "struct");
  if (struct) {
    const lit = miniArg(struct.args);
    return lit
      ? rewriteLeaves(code, lit, (leaf) => (isRest(leaf.text) || isFalsy(leaf.text) ? "~" : "x"))
      : null;
  }
  const head = chain.rootIsCall ? chain.links[0] : undefined;
  if (!head || !HEADS.has(head.name)) return null;
  const lit = miniArg(head.args);
  return lit ? rewriteLeaves(code, lit, (leaf) => (isRest(leaf.text) ? leaf.text : "x")) : null;
}

/**
 * The drum line's head mini string (`s("…")` or `sound("…")`) with each drum name replaced by its degree in `map`
 * (`fallback` for names not in it; a bank prefix such as `RolandTR909_bd` is read as `bd`). `null` when the label is
 * missing, the line is not a drum line or its rhythm is not a string literal.
 */
export function drumsToDegrees(
  code: string,
  label: string,
  map: Readonly<Record<string, number>>,
  fallback: number,
): string | null {
  const part = labelledExpr(code, label);
  if (!part) return null;
  const chain = chainOf(part.expr);
  const head = chain.rootIsCall ? chain.links[0] : undefined;
  if (!head || !DRUM_HEADS.has(head.name)) return null;
  const lit = miniArg(head.args);
  if (!lit) return null;
  return rewriteLeaves(code, lit, (leaf) => {
    if (isRest(leaf.text)) return leaf.text;
    const name = (leaf.text.split(":")[0] ?? "").toLowerCase();
    const short = name.includes("_") ? name.slice(name.lastIndexOf("_") + 1) : name;
    return String(map[name] ?? map[short] ?? fallback);
  });
}

/**
 * `statement` on a line of its own right after the labelled statement (after any comment on its last line). The
 * code is returned unchanged when the label is missing.
 */
export function insertStatementAfter(code: string, label: string, statement: string): string {
  const part = labelledExpr(code, label);
  if (!part) return code;
  const nl = code.indexOf("\n", part.stmt.end);
  const at = nl < 0 ? code.length : nl;
  return `${code.slice(0, at)}\n${statement}${code.slice(at)}`;
}
