import { describe, expect, test } from "bun:test";
import {
  CAPSTONE_REVIEW_JSON_SCHEMA,
  CapstoneReviewSchema,
  reviewNoteText,
  reviewSummaryLine,
  revisionCountFor,
  TRANSCRIPTION_REVIEW_JSON_SCHEMA,
  TranscriptionReviewSchema,
  validateCapstoneReview,
  validateTranscriptionReview,
} from "./reviews.ts";
import { CAPSTONE_REVIEW, TRANSCRIPTION_REVIEW } from "./testing/fixtures.ts";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
const problemsOf = (r: { ok: boolean; problems?: string[] }) => (r.ok ? [] : (r.problems ?? []));
const capstone = (patch: object, revisions: 1 | 2 = 1, totalBars: number | null = 8) =>
  problemsOf(validateCapstoneReview({ ...CAPSTONE_REVIEW, ...patch }, { revisions, totalBars }));
const transcription = (patch: object, revisions: 1 | 2 = 1) =>
  problemsOf(validateTranscriptionReview({ ...TRANSCRIPTION_REVIEW, ...patch }, { revisions, totalBars: 8 }));
const strength = CAPSTONE_REVIEW.strengths[0];
const revision = CAPSTONE_REVIEW.revisions[0];
if (!strength || !revision) throw new Error("fixture");

describe("capstone review", () => {
  test("the fixture is valid", () => {
    expect(validateCapstoneReview(CAPSTONE_REVIEW, { revisions: 1, totalBars: 8 })).toEqual({
      ok: true,
      value: CAPSTONE_REVIEW,
    });
  });

  test("0 to 3 strengths", () => {
    expect(capstone({ strengths: [strength] })).toEqual([]);
    expect(capstone({ strengths: [strength, strength, strength] })).toEqual([]);
    expect(capstone({ strengths: [strength, strength, strength, strength] })).toEqual([
      "strengths: need 0 to 3, got 4",
    ]);
  });

  test("the revision count is a parameter: one up to C4 and X1, two from C5 on", () => {
    expect(capstone({}, 2)).toEqual(["revisions: need exactly 2, got 1"]);
    expect(capstone({ revisions: [revision, revision] }, 2)).toEqual([]);
    expect(capstone({ revisions: [revision, revision] }, 1)).toEqual(["revisions: need exactly 1, got 2"]);
    expect(capstone({ revisions: [] }, 1)).toEqual(["revisions: need exactly 1, got 0"]);
    for (const id of ["C0", "C1", "C2", "C3", "C4", "X1"]) expect(revisionCountFor(id)).toBe(1);
    for (const id of ["C5", "X2", "C6", "C7", "CF-A", "CF-T", "JC1", "RC2", "AC1"])
      expect(revisionCountFor(id)).toBe(2);
  });

  test("word limits", () => {
    expect(capstone({ strengths: [{ ...strength, text: words(41) }, strength] })).toEqual([
      "strengths[0].text: 41 words, the limit is 40",
    ]);
    expect(capstone({ revisions: [{ ...revision, title: words(9) }] })).toEqual([
      "revisions[0].title: 9 words, the limit is 8",
    ]);
    expect(capstone({ revisions: [{ ...revision, why: words(51) }] })).toEqual([
      "revisions[0].why: 51 words, the limit is 50",
    ]);
    expect(capstone({ linerNote: words(60) })).toEqual([]);
    expect(capstone({ linerNote: words(61) })).toEqual(["linerNote: 61 words, the limit is 60"]);
    expect(capstone({ listeningQuestion: `${words(30)}?` })).toEqual([]);
    expect(capstone({ listeningQuestion: `${words(31)}?` })).toEqual([
      "listeningQuestion: 31 words, the limit is 30",
    ]);
    expect(capstone({ linerNote: " " })).toEqual(["linerNote: must not be empty"]);
  });

  test("exactly one listening question", () => {
    expect(capstone({ listeningQuestion: "Listen to bar 8." })).toHaveLength(1);
    expect(capstone({ listeningQuestion: "Is it finished? Or not?" })).toHaveLength(1);
  });

  test("the liner note is in the third person", () => {
    expect(capstone({ linerNote: "You wrote a groove in D dorian." })).toEqual([
      "linerNote: write in the third person (no 'you')",
    ]);
    expect(capstone({ linerNote: "The I chord returns in bar 8." })).toEqual([]);
  });

  test("bar anchors are a pair inside the piece", () => {
    expect(capstone({ strengths: [{ ...strength, bars: [0, 2] }, strength] })).toHaveLength(1);
    expect(capstone({ strengths: [{ ...strength, bars: [3, 2] }, strength] })).toHaveLength(1);
    expect(capstone({ strengths: [{ ...strength, bars: [7, 9] }, strength] })).toEqual([
      "strengths[0].bars: bar 9 is past the end (8 bars)",
    ]);
    expect(capstone({ strengths: [{ ...strength, bars: [7, 9] }, strength] }, 1, null)).toEqual([]);
    expect(capstone({ strengths: [{ ...strength, bars: [1] }, strength] })).toHaveLength(1);
    expect(capstone({ strengths: [{ ...strength, bars: [1, 2, 3] }, strength] })).toHaveLength(1);
    expect(capstone({ strengths: [{ ...strength, bars: [1.5, 2] }, strength] })).toHaveLength(1);
  });

  test("tryCode: at most 12 lines and through the strict lint", () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `t${i}: n("${i}")`).join("\n");
    expect(capstone({ revisions: [{ ...revision, tryCode: lines(12) }] })).toEqual([]);
    expect(capstone({ revisions: [{ ...revision, tryCode: lines(13) }] })).toEqual([
      "revisions[0].tryCode: 13 lines, the limit is 12",
    ]);
    expect(capstone({ revisions: [{ ...revision, tryCode: "" }] })).toContain(
      "revisions[0].tryCode: must not be empty",
    );
    const bad = capstone({ revisions: [{ ...revision, tryCode: 'fetch("/api/x")' }] });
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain("lint.base.identifier");
  });

  test("at most three skills", () => {
    expect(capstone({ revisions: [{ ...revision, skills: ["a", "b", "c", "d"] }] })).toEqual([
      "revisions[0].skills: at most 3",
    ]);
  });

  test("unknown and missing fields are rejected by the schema", () => {
    expect(capstone({ extra: 1 })).toHaveLength(1);
    const { linerNote: _dropped, ...rest } = CAPSTONE_REVIEW;
    expect(validateCapstoneReview(rest, { revisions: 1 }).ok).toBe(false);
    expect(validateCapstoneReview(null, { revisions: 1 }).ok).toBe(false);
    expect(validateCapstoneReview("a string", { revisions: 1 }).ok).toBe(false);
  });

  test("every problem is reported at once, so one resubmission can fix them all", () => {
    expect(
      capstone({
        strengths: [strength, strength, strength, strength],
        linerNote: words(70),
        listeningQuestion: "No question",
      }),
    ).toHaveLength(3);
  });
});

describe("transcription review", () => {
  const rev = TRANSCRIPTION_REVIEW.revisions[0];
  if (!rev) throw new Error("fixture");

  test("the fixture is valid", () => {
    expect(transcription({})).toEqual([]);
  });

  test("layers are an enum", () => {
    expect(transcription({ revisions: [{ ...rev, layer: "vocals" }] })).toHaveLength(1);
  });

  test("listenFor at most 30 words; 0 to 3 plausibility flags of at most 30 words", () => {
    expect(transcription({ revisions: [{ ...rev, listenFor: words(31) }] })).toEqual([
      "revisions[0].listenFor: 31 words, the limit is 30",
    ]);
    const flag = { bars: [5, 5], issue: "bass and chord disagree" };
    expect(transcription({ plausibilityFlags: [] })).toEqual([]);
    expect(transcription({ plausibilityFlags: [flag, flag, flag] })).toEqual([]);
    expect(transcription({ plausibilityFlags: [flag, flag, flag, flag] })).toEqual([
      "plausibilityFlags: need 0 to 3, got 4",
    ]);
    expect(transcription({ plausibilityFlags: [{ ...flag, issue: words(31) }] })).toEqual([
      "plausibilityFlags[0].issue: 31 words, the limit is 30",
    ]);
  });

  test("two revisions for X2, CF-T and later", () => {
    expect(transcription({}, 2)).toEqual(["revisions: need exactly 2, got 1"]);
    expect(transcription({ revisions: [rev, rev] }, 2)).toEqual([]);
  });
});

describe("JSON Schemas", () => {
  // Strict tool schemas: closed objects, every property required, no bounds the API would reject.
  function check(node: unknown, path: string): void {
    if (Array.isArray(node)) {
      node.forEach((n, i) => {
        check(n, `${path}[${i}]`);
      });
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const o = node as Record<string, unknown>;
    for (const banned of [
      "minimum",
      "maximum",
      "minLength",
      "maxLength",
      "minItems",
      "maxItems",
      "pattern",
      "prefixItems",
    ]) {
      expect(`${path}:${banned in o}`).toBe(`${path}:false`);
    }
    if (o.type === "object") {
      expect(o.additionalProperties).toBe(false);
      expect(o.required).toEqual(Object.keys(o.properties as object));
    }
    for (const [k, v] of Object.entries(o)) check(v, `${path}.${k}`);
  }

  test("are strict", () => {
    check(CAPSTONE_REVIEW_JSON_SCHEMA, "capstone");
    check(TRANSCRIPTION_REVIEW_JSON_SCHEMA, "transcription");
  });

  test("name the same fields as the zod schemas", () => {
    const keys = (s: Readonly<Record<string, unknown>>) => Object.keys(s.properties as object).sort();
    expect(keys(CAPSTONE_REVIEW_JSON_SCHEMA)).toEqual(Object.keys(CapstoneReviewSchema.shape).sort());
    expect(keys(TRANSCRIPTION_REVIEW_JSON_SCHEMA)).toEqual(
      Object.keys(TranscriptionReviewSchema.shape).sort(),
    );
  });
});

test("what a review leaves behind", () => {
  expect(reviewSummaryLine("C2", CAPSTONE_REVIEW)).toBe(
    "review of C2 submitted: revision 'Land the ending on the tonic'",
  );
  expect(reviewNoteText(CAPSTONE_REVIEW)).toBe(
    "Review suggested: Land the ending on the tonic. Listening question: In bar 8, does the bass sound finished or does it still lean forward?",
  );
});
