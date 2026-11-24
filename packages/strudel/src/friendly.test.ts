import { describe, expect, test } from "bun:test";
import { bracketProblem, friendlyEvalError, stringLiterals, stripPrefixes } from "./friendly.ts";
import { ADAPTER_FEEDBACK, errorToDiagnostic } from "./lint-bridge.ts";

// The raw messages below are what Strudel 1.2.6 / the transpiler actually throw (captured in the browser).
const MINI =
  'pattern string: [mini] parse error at line 1: Expected "!", "(", "*", ",", ".", "..", "/", ":", "<", "?", "[", "]", "{", "|", [@_], a letter, a number, "-", "#", ".", "^", "_", or whitespace but "\\"" found.';

describe("friendlyEvalError", () => {
  test("an unclosed [ in a mini-notation string names the bracket and points at it", () => {
    const code = 'setcpm(90/4)\nmel: note("c e [g").s("piano")';
    const f = friendlyEvalError(MINI, code);
    expect(f.message).toBe(
      'Line 2: A "[" is never closed: add a "]". The pattern in quotes can\'t be read until then.',
    );
    expect(code.slice(f.range?.from, f.range?.to)).toBe("[");
    expect(f.detail.startsWith("[mini] parse error")).toBe(true);
    expect(f.message).not.toContain("Expected");
  });
  test("a stray closer and a mismatched pair", () => {
    expect(bracketProblem("c e] g")?.text).toBe('There is a "]" with no "[" before it.');
    expect(bracketProblem("<c [e g>]")?.text).toBe('The "[" is closed with ">"; it needs "]".');
    expect(bracketProblem("<c [e g]>")).toBeNull();
  });
  test("a mini error with balanced brackets still reads calmly", () => {
    const f = friendlyEvalError(MINI, 'note("c e @@ g")');
    expect(f.message).toContain("a pattern in quotes has a typo");
    expect(f.message).not.toContain("Expected");
  });
  test("an unknown method names the method and selects it", () => {
    const code = 'note("c e g").s("piano").fooBar()';
    const f = friendlyEvalError("TypeError: note(...).s(...).fooBar is not a function", code);
    expect(f.message).toBe("Line 1: `fooBar` isn't a Strudel function. Check its spelling, or remove it.");
    expect(code.slice(f.range?.from, f.range?.to)).toBe("fooBar");
  });
  test("an unknown name suggests quotes", () => {
    const code = "setcpm(90/4)\n\nfoo(1)";
    const f = friendlyEvalError("ReferenceError: foo is not defined", code);
    expect(f.message).toContain("`foo` isn't something Strudel knows");
    expect(f.range).toEqual({ from: 14, to: 17 });
  });
  test("acorn syntax errors keep their position", () => {
    const f = friendlyEvalError("Unexpected token (1:23)", 'note("c e g".s("piano")', 23);
    expect(f.message).toBe("Line 1: the code can't be read here. Check brackets, commas and quotes.");
    expect(f.range).toEqual({ from: 23, to: 23 });
  });
  test("unknown errors keep their first sentence without the class name", () => {
    expect(friendlyEvalError("Error: something odd. More text.", "x").message).toBe("something odd.");
    expect(stripPrefixes("TypeError: pattern string: x")).toBe("x");
  });
  test("string literals: double quotes and backticks are mini-notation; comments are skipped", () => {
    const lits = stringLiterals('s("bd") // "not [ this"\nn(`0 [1`).x(\'a [\')');
    expect(lits.map((l) => l.body)).toEqual(["bd", "0 [1"]);
  });
});

describe("errorToDiagnostic is friendly", () => {
  test("mini parse errors become a located eval.syntax error with the raw text in params.detail", () => {
    const code = 'note("c e [g").s("piano")';
    const d = errorToDiagnostic(new Error(MINI), code);
    expect(d.id).toBe(ADAPTER_FEEDBACK.syntax);
    expect(d.severity).toBe("error");
    expect(d.range).toEqual({ from: 10, to: 11 });
    expect(d.message).toContain('A "[" is never closed');
    expect(String(d.params.detail)).toContain("[mini] parse error");
  });
  test("runtime errors are located at the unknown function", () => {
    const code = 'note("c").fooBar()';
    const d = errorToDiagnostic(new TypeError("note(...).fooBar is not a function"), code);
    expect(d.id).toBe(ADAPTER_FEEDBACK.runtime);
    expect(code.slice(d.range.from, d.range.to)).toBe("fooBar");
  });

  test("a lint message that mentions mini-notation is not read as a typo", () => {
    const f = friendlyEvalError(
      "The mini-notation `,` unlocks in the lesson “Together Now”. For now, use the tools you have.",
      's("bd, hh")',
    );
    expect(f.message).not.toContain("typo");
  });
});

describe("an undefined section const (wave 5 gate)", () => {
  test("asks for the const, not for quotes", () => {
    const code = 'const drumsVerse = s("bd sd")\ndrums: arrange([4, drumsVerse], [4, drumsChorus])';
    const f = friendlyEvalError("ReferenceError: drumsChorus is not defined", code);
    expect(f.message).toContain("`drumsChorus` isn't defined yet");
    expect(f.message).toContain("const drumsChorus = …");
    expect(f.message).not.toContain("in quotes");
  });
  test("a single lower-case word outside arrange() still reads as a missing quote", () => {
    const f = friendlyEvalError("ReferenceError: bd is not defined", "s(bd)");
    expect(f.message).toContain('like "bd"');
  });
});
