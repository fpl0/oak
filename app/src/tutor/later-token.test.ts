// Oak 2.0 W1: the app's tutor markdown reads `[[later]]` (no value) as the Later offer; `[[later:x]]` is plain text.
import { describe, expect, test } from "bun:test";
import { type Inline, parseInline, parseMarkdown, plainText, tokensIn } from "./markdown.ts";

describe("[[later]] in tutor markdown", () => {
  test('"Good question. [[later]]" is text, then the Later token', () => {
    expect(parseInline("Good question. [[later]]")).toEqual([
      { t: "text", text: "Good question. " },
      { t: "token", token: { kind: "later" }, raw: "[[later]]" },
    ] satisfies Inline[]);
    expect(tokensIn(parseMarkdown("Good question. [[later]]"))).toEqual([{ kind: "later" }]);
  });

  test("[[later:x]] stays plain text, and so does [[later]] inside code", () => {
    expect(parseInline("[[later:x]]")).toEqual([{ t: "text", text: "[[later:x]]" }]);
    expect(parseInline("`[[later]]`")).toEqual([{ t: "code", text: "[[later]]" }]);
  });

  test("the plain text of a message leaves the token out", () => {
    expect(plainText(parseMarkdown("Good question. [[later]]"))).toBe("Good question. ");
  });

  test("music tokens and reveal still parse beside it", () => {
    expect(tokensIn(parseMarkdown("[[deg:5]] then [[reveal]] and [[later]]"))).toEqual([
      { kind: "deg", value: "5" },
      { kind: "reveal" },
      { kind: "later" },
    ]);
  });
});
