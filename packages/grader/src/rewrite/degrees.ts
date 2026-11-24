import { isMiniLiteral, parseProgram, programInfo, stringArgs } from "../lint/ast.ts";
import { type MiniAtom, readMini } from "../lint/mini.ts";
import { type MiniNode, miniAst } from "../runtime/strudel.ts";

function degrees(code: string, label: string): MiniAtom[] {
  const parsed = parseProgram(code);
  if (!parsed.ok) return [];
  const part = programInfo(parsed.ast).labels.find((part) => part.label === label);
  if (!part?.expr) return [];
  const literal = stringArgs(part.expr)
    .filter((arg) => arg.callee === "n" && isMiniLiteral(arg))
    .sort((a, b) => a.node.start - b.node.start)[0];
  if (!literal) return [];
  const content = code.slice(literal.contentStart, literal.node.end - 1);
  const mini = readMini(content, literal.contentStart);
  if (mini.error) return [];

  // readMini also lists operands of * / and Euclidean operators. Only source leaves are pitches;
  // visiting their options would turn a pitch edit into a rhythm edit.
  const positions = new Map<number, number>();
  const visit = (node: MiniNode): void => {
    if (node.type_ === "atom" && node.location_) {
      positions.set(
        literal.contentStart + node.location_.start.offset - 1,
        literal.contentStart + node.location_.end.offset - 1,
      );
    } else if (Array.isArray(node.source_)) {
      for (const child of node.source_ as MiniNode[]) visit(child);
    } else if (node.source_ && typeof node.source_ === "object") {
      visit(node.source_ as MiniNode);
    }
  };
  visit(miniAst(content));
  const atoms = mini.atoms
    .filter((atom) => positions.has(atom.start) && /^-?\d+(?:\.\d+)?$/.test(atom.text))
    .sort((a, b) => a.start - b.start);
  const located: MiniAtom[] = [];
  for (const atom of atoms) {
    let start = atom.start;
    const limit = positions.get(start) as number;
    // Strudel 1.2.6 can include leading whitespace in a leaf's location after @, ! and _. readMini
    // trims the text but retains that start. Stay inside this leaf rather than searching other tokens.
    while (start < limit && /\s/.test(code[start] as string)) start++;
    const end = start + atom.text.length;
    if (end > limit || code.slice(start, end) !== atom.text) return [];
    located.push({ ...atom, start, end });
  }
  return located;
}

function replace(code: string, atoms: MiniAtom[], f: (d: number, i: number) => number): string {
  let out = "";
  let from = 0;
  for (const [i, atom] of atoms.entries()) {
    out += code.slice(from, atom.start) + String(f(Number(atom.text), i));
    from = atom.end;
  }
  return out + code.slice(from);
}

/** Rewrite only the pitch leaves of the first n mini-notation string in this labelled expression. */
export function rewriteDegrees(code: string, label: string, f: (d: number) => number): string {
  return replace(code, degrees(code, label), f);
}

export function invertAroundCentre(code: string, label: string): string {
  const atoms = degrees(code, label);
  if (atoms.length === 0) return code;
  const values = atoms.map((atom) => Number(atom.text));
  const centreTwice = Math.min(...values) + Math.max(...values);
  return rewriteDegrees(code, label, (d) => centreTwice - d);
}

export function retrogradePitches(code: string, label: string): string {
  const atoms = degrees(code, label);
  const values = atoms.map((atom) => Number(atom.text)).reverse();
  return replace(code, atoms, (_d, i) => values[i] as number);
}

/** Rotate values across existing pitch positions; rhythmic operators stay attached to their positions. */
export function rotatePitches(code: string, label: string, k: number): string {
  const atoms = degrees(code, label);
  if (atoms.length === 0 || !Number.isInteger(k)) return code;
  const shift = ((k % atoms.length) + atoms.length) % atoms.length;
  if (shift === 0) return code;
  return replace(code, atoms, (_d, i) => Number(atoms[(i + shift) % atoms.length]?.text));
}
