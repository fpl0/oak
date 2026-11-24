// The four Strudel packages the grader may import (core, mini, tonal, transpiler), behind one typed
// facade. The packages ship no types: every member used by the grader is declared here, and nothing else
// in this package imports "@strudel/*" directly (the lint's mini-notation reader goes through `miniAst`),
// except the unit-song composer (song/compose.ts), which the browser's main thread also loads and so takes
// `@strudel/core` alone rather than this facade's four packages.
import * as coreModule from "@strudel/core";
import * as miniModule from "@strudel/mini";
import * as tonalModule from "@strudel/tonal";
import { transpiler as strudelTranspiler } from "@strudel/transpiler";

export type Pat = Strudel.Pattern;
export type Hap = Strudel.Hap;
export type PatternMethod = (this: Pat, ...args: unknown[]) => unknown;

interface PatternClass {
  prototype: Record<string, unknown>;
}

export interface StrudelCore {
  Pattern: PatternClass;
  silence: Pat;
  stack(...patterns: unknown[]): Pat;
  pure(value: unknown): Pat;
  State: new (span: Strudel.TimeSpan, controls?: Record<string, unknown>) => Strudel.State;
  TimeSpan: new (begin: Strudel.Fraction, end: Strudel.Fraction) => Strudel.TimeSpan;
  Fraction(value: number | string): Strudel.Fraction;
  evalScope(...scopes: object[]): Promise<unknown>;
  strudelScope: Record<string, unknown>;
  register(name: string, fn: (...args: never[]) => unknown): unknown;
  isPattern(value: unknown): value is Pat;
  isNote(text: string): boolean;
  noteToMidi(text: string, defaultOctave?: number): number;
  freqToMidi(hz: number): number;
  logger(message: string): void;
  useRNG?(name: string): void;
  reset_state?(): void;
}

export interface StrudelTonal {
  resetVoicings?(): void;
  /** `name → { dictionary: { <quality suffix>: string[] } }`; the keys of `dictionary` are the symbols a dict knows. */
  voicingRegistry: Record<string, { dictionary: Record<string, unknown> } & Record<string, unknown>>;
}

/** One node of the mini-notation AST (`mini2ast`), as @strudel/mini 1.2.6 builds it. */
export interface MiniNode {
  type_: "pattern" | "element" | "atom" | (string & {});
  /** atom: the text; pattern: child nodes; element: the atom or sub-pattern. */
  source_?: unknown;
  arguments_?: {
    alignment?: string;
    stepsPerCycle?: MiniNode | null;
    amount?: MiniNode | number | null;
    type?: string;
    pulse?: MiniNode;
    step?: MiniNode;
    rotation?: MiniNode | null;
    element?: MiniNode;
    [key: string]: unknown;
  };
  options_?: { ops?: MiniNode[]; weight?: number; reps?: number };
  /** Offsets into the QUOTED string that was parsed (the opening quote is offset 0). */
  location_?: { start: { offset: number }; end: { offset: number } };
}

interface StrudelMini {
  mini2ast(quoted: string, offset?: number, code?: string): MiniNode;
  getLeafLocations(quoted: string, offset?: number, code?: string): [number, number][];
}

export const core = coreModule as unknown as StrudelCore;
export const tonal = tonalModule as unknown as StrudelTonal;
const mini = miniModule as unknown as StrudelMini;

/** Every export of the three scope packages, as `evalScope` receives them. */
export const scopeModules = {
  core: coreModule as unknown as Record<string, unknown>,
  mini: miniModule as unknown as Record<string, unknown>,
  tonal: tonalModule as unknown as Record<string, unknown>,
};

/** `transpiler(code, { emitWidgets: false })`: throws acorn's SyntaxError (with `pos`, `loc`) or its own errors. */
export function transpile(code: string): Strudel.TranspilerOutput {
  return (strudelTranspiler as (code: string, options: object) => Strudel.TranspilerOutput)(code, {
    emitWidgets: false,
  });
}

/**
 * Parses the CONTENT of a pattern string (no quotes) into the mini-notation AST. Node offsets are relative
 * to the opening quote, so `location_.start.offset - 1` is an offset into `text`. Throws on a parse error.
 */
export function miniAst(text: string): MiniNode {
  const quoted = `"${text}"`;
  return mini.mini2ast(quoted, 0, quoted);
}
