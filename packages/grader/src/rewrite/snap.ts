// Oak 2.0 W3 (PLAN §4 S5 transforms: "snap to the key's scale"): every note of a `note("…")` line moved to the nearest
// tone of the key's scale, written as visible code. Pure; no evaluation. Only the moved notes are rewritten, so a note
// already in the scale keeps the learner's spelling.
import type { KeySpec } from "@oak/content-kit";
import { parseNote, scaleNotes, scalePcs } from "@oak/theory";
import { isMiniLiteral, stringArgs } from "../lint/ast.ts";
import { labelledExpr, miniLeaves } from "./derive.ts";

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** The nearest MIDI note whose pitch class is in `pcs`; at equal distance the upper one (Oak's call). */
function nearestIn(midi: number, pcs: ReadonlySet<number>): number {
  if (pcs.has(mod12(midi))) return midi;
  for (let d = 1; d <= 6; d++) {
    if (pcs.has(mod12(midi + d))) return midi + d;
    if (pcs.has(mod12(midi - d))) return midi - d;
  }
  return midi;
}

/** `midi` spelled with the key's scale name for its pitch class, in lowercase, with the octave ("f#4"). */
function spell(midi: number, key: KeySpec): string | null {
  const names = scaleNotes(key);
  const pcs = scalePcs(key);
  const name = names[pcs.indexOf(mod12(midi) as (typeof pcs)[number])];
  if (!name) return null;
  const at4 = parseNote(`${name}4`);
  if (!at4) return null;
  const octave = 4 + Math.round((midi - at4.midi) / 12);
  return `${name.toLowerCase()}${octave}`;
}

/**
 * Every note atom of the line's first `note("…")` string (letter names or MIDI numbers) moved to the nearest tone of
 * the key's scale, ties upward (Oak's call); moved letter names are spelled from the key's scale in lowercase with
 * the octave, numbers stay numbers. An `n("…")` line, a missing label or a line already in the scale returns the input.
 */
export function snapNotesToScale(code: string, label: string, key: KeySpec): string {
  const part = labelledExpr(code, label);
  if (!part) return code;
  const lit = stringArgs(part.expr)
    .filter((arg) => arg.callee === "note" && arg.argIndex === 0 && isMiniLiteral(arg))
    .sort((a, b) => a.node.start - b.node.start)[0];
  if (!lit) return code;
  const leaves = miniLeaves(code, lit);
  if (!leaves) return code;
  let pcs: Set<number>;
  try {
    pcs = new Set(scalePcs(key));
  } catch {
    return code;
  }
  let out = "";
  let from = 0;
  for (const leaf of leaves) {
    let next: string | null = null;
    if (/^-?\d+$/.test(leaf.text)) {
      const midi = Number(leaf.text);
      const to = nearestIn(midi, pcs);
      if (to !== midi) next = String(to);
    } else {
      const parsed = parseNote(leaf.text);
      if (parsed) {
        const to = nearestIn(parsed.midi, pcs);
        if (to !== parsed.midi) next = spell(to, key);
      }
    }
    if (next === null) continue;
    out += code.slice(from, leaf.start) + next;
    from = leaf.end;
  }
  return from === 0 ? code : out + code.slice(from);
}
