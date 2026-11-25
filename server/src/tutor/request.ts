// The body of a tutor route, validated. Note what is NOT here: no hint rung, no "passed" flag, no
// apply state. Those are server state; a browser cannot ask for a deeper reveal.
import { z } from "zod";
import type { GradeSnapshot } from "./domain.ts";
import { SUBJECT_KINDS, THREAD_KINDS, type TurnRequest } from "./types.ts";

/** The learner's own piece can be much longer than a tutor card. */
export const MAX_LEARNER_CODE_CHARS = 40_000;
export const MAX_USER_TEXT_CHARS = 8_000;

const short = z.string().max(400);

const RawIssueSchema = z.strictObject({
  where: z.strictObject({
    track: short.nullable(),
    bar: z.number().int().nullable(),
    beat: z.number().nullable(),
    code: z.strictObject({ from: z.number().int(), to: z.number().int() }).nullable(),
  }),
  severity: z.enum(["error", "warn", "info"]),
  feedback: short,
  direction: short.nullable(),
  concept: short.nullable(),
  what: z.string().max(1_000),
  fix: z.string().max(1_000).nullable(),
  expected: z.string().max(1_000).nullable(),
  got: z.string().max(1_000).nullable(),
});

export const GradeSnapshotSchema = z.strictObject({
  status: z.enum(["pass", "fail", "error", "ungraded"]),
  score: z.number(),
  dims: z.record(short, z.number()),
  counts: z.strictObject({ missing: z.number().int(), extra: z.number().int(), wrong: z.number().int() }),
  issues: z.array(RawIssueSchema).max(200),
  warnings: z.array(short).max(100),
}) satisfies z.ZodType<GradeSnapshot>;

export const TurnRequestSchema = z.strictObject({
  thread: z.strictObject({ subjectKind: z.enum(SUBJECT_KINDS), subjectId: z.string().min(1).max(200) }),
  kind: z.enum(THREAD_KINDS),
  userText: z.string().max(MAX_USER_TEXT_CHARS),
  learnerCode: z.string().max(MAX_LEARNER_CODE_CHARS).optional(),
  graderResult: GradeSnapshotSchema.optional(),
  lessonId: z.string().min(1).max(200).optional(),
  stepId: z.string().min(1).max(200).optional(),
  // Wave 4: the version a review is about (packages/api TutorTurnRequestSchema).
  albumTrackId: z.string().min(1).max(200).optional(),
  albumVersion: z.number().int().positive().optional(),
  transcriptionVersion: z.number().int().nonnegative().optional(),
  reviewQuestion: z.string().trim().min(1).max(300).optional(), // Oak's call: one short question.
});

/** Parse a request body. zod's `optional()` yields `T | undefined`; the result is narrowed to TurnRequest. */
export function parseTurnRequest(
  body: unknown,
): { ok: true; request: TurnRequest } | { ok: false; problems: string[] } {
  const parsed = TurnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
    };
  }
  const d = parsed.data;
  const request: TurnRequest = { thread: d.thread, kind: d.kind, userText: d.userText };
  if (d.learnerCode !== undefined) request.learnerCode = d.learnerCode;
  if (d.graderResult !== undefined) request.graderResult = d.graderResult;
  if (d.lessonId !== undefined) request.lessonId = d.lessonId;
  if (d.stepId !== undefined) request.stepId = d.stepId;
  if (d.albumTrackId !== undefined) request.albumTrackId = d.albumTrackId;
  if (d.albumVersion !== undefined) request.albumVersion = d.albumVersion;
  if (d.transcriptionVersion !== undefined) request.transcriptionVersion = d.transcriptionVersion;
  if (d.reviewQuestion !== undefined) request.reviewQuestion = d.reviewQuestion;
  return { ok: true, request };
}
