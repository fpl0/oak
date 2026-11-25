// Oak 2.0 W1 (PLAN S7, contracts §10.7 and §10.11): the tutor's honest stance ("## Judging a piece") and the
// `[[later]]` offer, in the persona and in the server's markup.
import { describe, expect, test } from "bun:test";
import { type MarkupOptions, parseMarkup } from "../markup.ts";
import { CATALOG, SYLLABUS } from "../testing/fixtures.ts";
import type { Prefix } from "../types.ts";
import { buildPrefix, PERSONA, prefixVersion } from "./persona.ts";

/** The persona as it was before W1: without the new section and the new output-format line. */
function personaBeforeW1(): string {
  const start = PERSONA.indexOf("## Judging a piece");
  const end = PERSONA.indexOf("## The hint ladder");
  const withoutSection = PERSONA.slice(0, start) + PERSONA.slice(end);
  return withoutSection.replace(/^- `\[\[later\]\]`:.*\n/m, "");
}

describe("persona: judging a piece", () => {
  test("a section after Teaching with the honest stance", () => {
    const teaching = PERSONA.indexOf("## Teaching");
    const judging = PERSONA.indexOf("## Judging a piece");
    expect(teaching).toBeGreaterThan(-1);
    expect(judging).toBeGreaterThan(teaching);
    expect(judging).toBeLessThan(PERSONA.indexOf("## The hint ladder"));
    const section = PERSONA.slice(judging, PERSONA.indexOf("## The hint ladder"));
    for (const phrase of [
      "works for what the learner is trying to do",
      "never whether it is original",
      "no padding",
      "strengths only when they are real",
      "none is a valid answer",
      "one or two sentences",
      "`[[later]]`",
    ])
      expect(section).toContain(phrase);
  });

  test("the output format documents [[later]]", () => {
    expect(PERSONA).toContain(
      "- `[[later]]`: offers to park the learner's question on their Later list; at most one per message; chat, hint and explain threads only.",
    );
  });

  test("prefixVersion changes (intended: W1 adds to the persona)", () => {
    const sources = { syllabus: SYLLABUS, catalog: CATALOG };
    const now = buildPrefix(sources);
    const before: Prefix = Object.freeze({ ...now, persona: personaBeforeW1() });
    expect(before.persona).not.toContain("Judging a piece");
    expect(before.persona).not.toContain("[[later]]");
    expect(prefixVersion(now)).not.toBe(prefixVersion(before));
  });
});

describe("markup: [[later]]", () => {
  const laters = (text: string, thread?: MarkupOptions["thread"]) =>
    parseMarkup(text, thread === undefined ? {} : { thread }).filter((s) => s.type === "later");

  test("kept once per message in chat, hint and explain; a second stays text", () => {
    for (const thread of ["chat", "hint", "explain"] as const) {
      expect(laters("Good question. [[later]]", thread)).toEqual([{ type: "later", raw: "[[later]]" }]);
    }
    const segs = parseMarkup("Park it? [[later]] Or [[later]]", { thread: "chat" });
    expect(segs.filter((s) => s.type === "later")).toHaveLength(1);
    expect(segs.at(-1)).toEqual({ type: "text", md: " Or [[later]]" });
  });

  test("dropped in listening and reviews, and with no thread", () => {
    for (const thread of ["listening", "review-capstone", "review-transcription"] as const) {
      expect(laters("Nice. [[later]]", thread)).toEqual([]);
      expect(parseMarkup("Nice. [[later]]", { thread })).toEqual([{ type: "text", md: "Nice. [[later]]" }]);
    }
    expect(laters("Nice. [[later]]")).toEqual([]);
  });

  test("[[later:x]] and later inside code stay text", () => {
    expect(laters("[[later:x]]", "chat")).toEqual([]);
    expect(parseMarkup("`[[later]]`", { thread: "chat" })).toEqual([
      { type: "code_inline", code: "[[later]]" },
    ]);
  });

  test("[[later]] and [[reveal]] are counted apart", () => {
    const segs = parseMarkup("[[reveal]] [[later]]", { thread: "chat", revealAllowed: true });
    expect(segs.map((s) => s.type)).toEqual(["reveal", "text", "later"]);
  });
});
