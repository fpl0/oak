// Oak 2.0 W4 F4: the review's one question, as the learner writes it and as the request carries it.
import { beforeEach, describe, expect, test } from "bun:test";
import { TutorTurnRequestSchema } from "@oak/api";
import { isDescriptive } from "../studio/descriptive.ts";
import { askReview, useTutorContext } from "../tutor/context.ts";
import { cleanQuestion, REVIEW_ASK_COPY, REVIEW_PROMPTS, REVIEW_QUESTION_MAX } from "./review-ask.ts";

describe("cleanQuestion", () => {
  test("whitespace collapsed and trimmed", () => {
    expect(cleanQuestion("  Does the bridge lift?  ")).toBe("Does the bridge lift?");
    expect(cleanQuestion("Does the\n\n bridge   lift?")).toBe("Does the bridge lift?");
  });

  test("empty is no question", () => {
    expect(cleanQuestion("")).toBeNull();
    expect(cleanQuestion("   ")).toBeNull();
  });

  test("longer than the limit is refused", () => {
    expect(REVIEW_QUESTION_MAX).toBe(300);
    expect(cleanQuestion("a".repeat(301))).toBeNull();
    expect(cleanQuestion("a".repeat(300))).toBe("a".repeat(300));
  });

  test("a prompt still holding its _ placeholders is not sent; filled in, it is", () => {
    expect(cleanQuestion("In bars _ to _, does this part work?")).toBeNull();
    expect(cleanQuestion("In bars 5 to _, does this part work?")).toBeNull();
    expect(cleanQuestion("In bars 5 to 8, does this part work?")).toBe(
      "In bars 5 to 8, does this part work?",
    );
    // A muted label is not a placeholder.
    expect(cleanQuestion("Should _pad stay muted?")).toBe("Should _pad stay muted?");
  });

  test("the three prompts are the sound, the form and a detail", () => {
    expect(REVIEW_PROMPTS.map((p) => p.id)).toEqual(["sound", "form", "detail"]);
    expect(cleanQuestion(REVIEW_PROMPTS[0].text)).toBe("Does the sound suit the song?");
    expect(cleanQuestion(REVIEW_PROMPTS[2].text)).toBeNull();
  });
});

describe("askReview sends the question", () => {
  beforeEach(() => {
    useTutorContext.setState({
      subject: null,
      availability: "ready",
      offReason: null,
      queue: [],
      notice: null,
    });
  });

  // `askReview` queues the turn the tutor panel streams (it never calls fetch itself): the queued request is the
  // body the panel posts.
  test("with a question the request carries reviewQuestion", () => {
    const r = askReview({ capstoneId: "C3", title: "C3", code: "x", question: "Does the bridge lift?" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ask.request.reviewQuestion).toBe("Does the bridge lift?");
    expect(TutorTurnRequestSchema.safeParse(r.ask.request).success).toBe(true);
  });

  test("without one the body has no reviewQuestion key", () => {
    for (const question of [undefined, null, "   "]) {
      const r = askReview({
        capstoneId: "C3",
        title: "C3",
        code: "x",
        ...(question === undefined ? {} : { question }),
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(Object.hasOwn(r.ask.request, "reviewQuestion")).toBe(false);
    }
  });
});

test("every review-ask string is descriptive", () => {
  const strings = [...Object.values(REVIEW_ASK_COPY), ...REVIEW_PROMPTS.flatMap((p) => [p.chip, p.text])];
  for (const s of strings) expect(isDescriptive(s)).toBe(true);
});
