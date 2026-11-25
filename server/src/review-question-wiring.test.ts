import { expect, test } from "bun:test";
import * as api from "@oak/api";
import { forwardedTurnBody } from "./routes/tutor.ts";
import { countWords } from "./tutor/markup.ts";
import {
  CAPSTONE_REVIEW_JSON_SCHEMA,
  type CapstoneReview,
  CapstoneReviewSchema,
  REVIEW_LIMITS,
  type ReviewRules,
  TranscriptionReviewSchema,
  validateCapstoneReview,
} from "./tutor/reviews.ts";
import { CAPSTONE_REVIEW, LESSON_ID, TRANSCRIPTION_REVIEW } from "./tutor/testing/fixtures.ts";
import type { StructuredTurn } from "./tutor/types.ts";
import { FAKE_REVIEW_ANSWER, FakeTutorBackend } from "./tutor-adapters/fake-backend.ts";

const C3 = { subjectKind: "capstone", subjectId: "C3" } as const;
const lesson = { subjectKind: "lesson", subjectId: LESSON_ID } as const;
const { answer: _answer, ...legacyReview } = CAPSTONE_REVIEW;

test("AC4: the contract rejects long or blank questions", () => {
  for (const [reviewQuestion, ok] of [
    ["x".repeat(301), false],
    ["x".repeat(300), true],
    ["   ", false],
  ] as const) {
    const body = { thread: C3, userText: "", kind: "review-capstone", reviewQuestion };
    expect(api.TutorTurnRequestSchema.safeParse(body).success).toBe(ok);
  }
});

test("AC12: both transcription schemas accept zero strengths and refuse an answer", () => {
  for (const schema of [TranscriptionReviewSchema, api.TranscriptionReviewSchema]) {
    expect(schema.safeParse({ ...TRANSCRIPTION_REVIEW, strengths: [] }).success).toBe(true);
    expect(schema.safeParse({ ...TRANSCRIPTION_REVIEW, answer: null }).success).toBe(false);
  }
});

test("AC13: both schema copies preserve old reviews and agree on answers and limits", () => {
  for (const schema of [CapstoneReviewSchema, api.CapstoneReviewSchema]) {
    expect(schema.parse(legacyReview).answer).toBeUndefined();
    for (const [answer, success] of [
      [null, true],
      ["x", true],
      [3, false],
      [["x"], false],
    ] as const) {
      expect(schema.safeParse({ ...CAPSTONE_REVIEW, answer }).success).toBe(success);
    }
  }
  expect(api.REVIEW_LIMITS).toEqual(REVIEW_LIMITS);
  expect(REVIEW_LIMITS.strengths).toEqual([0, 3]);
  expect(REVIEW_LIMITS.answerWords).toBe(60);
});

test("AC20: forwarding keeps the question only for capstone reviews", () => {
  const rest = { thread: C3, userText: "", reviewQuestion: "Q?" };
  expect(forwardedTurnBody("review-capstone", rest, {})).toEqual(rest);
  expect(forwardedTurnBody("review-capstone", { thread: C3, userText: "" }, {})).toEqual({
    thread: C3,
    userText: "",
  });
  const target = { albumTrackId: "t1", albumVersion: 2 };
  expect(forwardedTurnBody("review-capstone", rest, target)).toEqual({ ...rest, ...target });
  const tr = { subjectKind: "transcription", subjectId: "tr-1" } as const;
  expect(
    forwardedTurnBody("review-transcription", { ...rest, thread: tr }, { transcriptionVersion: 1 }),
  ).toEqual({ thread: tr, userText: "", transcriptionVersion: 1 });
  expect(
    forwardedTurnBody("chat", { thread: lesson, userText: "hi", learnerCode: "x", reviewQuestion: "Q?" }, {}),
  ).toEqual({ thread: lesson, userText: "hi", learnerCode: "x" });
});

async function fakeReview(oakContext: string, rules: ReviewRules) {
  let validations = 0;
  const input: StructuredTurn<CapstoneReview> = {
    conversationId: "capstone:C2:2026-11-11:review",
    kind: "review-capstone",
    lane: "review",
    model: "claude-opus-5-5",
    effort: "high",
    limits: { maxTokens: 32_000, maxIterations: 8 },
    prefix: { persona: "", syllabus: "", catalog: "" },
    prefixVersion: "v",
    tools: [],
    executeTool: async () => ({ content: "{}", isError: false }),
    transcript: [],
    continuity: { records: [], commit: async () => {} },
    user: { oakContext, learnerCode: null, text: "" },
    isFirstTurn: true,
    schemaName: "CapstoneReview",
    jsonSchema: CAPSTONE_REVIEW_JSON_SCHEMA,
    submitTool: "submit_capstone_review",
    accepted: () => undefined,
    maxResubmits: 2,
    reminder: "Deliver the review.",
    validate: async (raw) => {
      validations++;
      return validateCapstoneReview(raw, rules);
    },
  };
  const backend = new FakeTutorBackend({ delayMs: 0 });
  const result = await backend.runStructured(input, new AbortController().signal);
  expect(validations).toBe(1);
  return result.value;
}

test("F1: the fake answers a learner question on its first attempt", async () => {
  const question = "Does bar 8 sound finished?";
  const value = await fakeReview(`<oak_context>\nlearner_question: ${question}\n</oak_context>`, {
    revisions: 1,
    totalBars: 4,
    question,
  });
  expect(value.answer).toBe(FAKE_REVIEW_ANSWER);
  expect(countWords(FAKE_REVIEW_ANSWER)).toBeLessThan(60);
});

test("F2: without a question the fake omits answer on its first attempt", async () => {
  const value = await fakeReview("<oak_context>\n</oak_context>", { revisions: 1, totalBars: 4 });
  expect(value).not.toHaveProperty("answer");
});

test("F3: the fake reads current and legacy strengths requests on its first attempt", async () => {
  for (const [line, count] of [
    ["strengths_wanted: up to 3 · the strongest first", 3],
    ["strengths_wanted: 3 · the strongest first", 3],
    ["", 2],
  ] as const) {
    const value = await fakeReview(`<oak_context>\n${line}\n</oak_context>`, { revisions: 1, totalBars: 4 });
    expect(value.strengths).toHaveLength(count);
  }
});
