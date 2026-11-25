// Bodies and parameters of the tutor routes. The route fixes the thread kind, so a body has no
// `kind`; and, as in request.ts, there is no hint rung, no "passed" flag and no apply state
// anywhere in these shapes: a browser cannot ask for a deeper reveal.
import { z } from "zod";
import {
  MAX_LEARNER_CODE_CHARS,
  MAX_USER_TEXT_CHARS,
  parseTurnRequest,
  TurnRequestSchema,
} from "../request.ts";
import { THREAD_DEFAULT_LIMIT, THREAD_MAX_LIMIT } from "../thread-view.ts";
import { SUBJECT_KINDS, type ThreadKind, type TurnRequest } from "../types.ts";

const base = TurnRequestSchema.omit({ kind: true, reviewQuestion: true });
const id = z.string().min(1).max(200);
const hasText = (s: string) => s.trim().length > 0;

/** Free question. The only route where the learner must have typed something. */
export const ChatBody = base.extend({
  userText: z.string().max(MAX_USER_TEXT_CHARS).refine(hasText, "must not be empty"),
});

/**
 * "Give me a nudge" and "Explain this error": a button on a lesson step, so the text may be
 * missing but the step may not. The step is what the server reads the rung from.
 */
export const StepHelpBody = base
  .extend({
    userText: z.string().max(MAX_USER_TEXT_CHARS).default(""),
    stepId: id,
  })
  .refine((b) => b.thread.subjectKind === "lesson" || b.lessonId !== undefined, {
    path: ["lessonId"],
    message: "required when the thread is not a lesson",
  });

/** A listening note on a saved sketch: the code is the whole subject. Audio is never sent. */
export const NoteBody = base.extend({
  userText: z.string().max(MAX_USER_TEXT_CHARS).default(""),
  learnerCode: z.string().max(MAX_LEARNER_CODE_CHARS).refine(hasText, "must not be empty"),
});

/**
 * A review reads the piece the SERVER holds (code, analysis, rubric), so the body names the
 * subject and may carry a short note; code sent by the browser would be ignored and is refused.
 */
const reviewBody = (...kinds: [(typeof SUBJECT_KINDS)[number], ...(typeof SUBJECT_KINDS)[number][]]) =>
  z.strictObject({
    thread: z.strictObject({ subjectKind: z.enum(kinds), subjectId: id }),
    userText: z.string().max(MAX_USER_TEXT_CHARS).default(""),
  });
/** Wave 4: a capstone review may name the album version it is about (both fields, or neither). */
export const CapstoneReviewBody = reviewBody("capstone", "track")
  .extend({
    reviewQuestion: TurnRequestSchema.shape.reviewQuestion,
    albumTrackId: id.optional(),
    albumVersion: z.number().int().positive().optional(),
  })
  .refine((b) => (b.albumTrackId === undefined) === (b.albumVersion === undefined), {
    path: ["albumVersion"],
    message: "albumTrackId and albumVersion go together",
  });
/** Wave 4: a transcription review may name the version it is about (default: the latest). */
export const TranscriptionReviewBody = reviewBody("transcription").extend({
  transcriptionVersion: z.number().int().nonnegative().optional(),
});

export const ThreadParams = z.strictObject({ subjectKind: z.enum(SUBJECT_KINDS), subjectId: id });
export const ThreadQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(THREAD_MAX_LIMIT).default(THREAD_DEFAULT_LIMIT),
});
export const StatusQuery = z.strictObject({ refresh: z.enum(["0", "1"]).default("0") });
export const CardParams = z.strictObject({ cardId: id });
export const NoteParams = z.strictObject({ noteId: id });

export const TURN_BODIES = {
  chat: ChatBody,
  hint: StepHelpBody,
  explain: StepHelpBody,
  listening: NoteBody,
  "review-capstone": CapstoneReviewBody,
  "review-transcription": TranscriptionReviewBody,
} as const satisfies Record<ThreadKind, z.ZodType>;

export function problemsOf(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
}

/**
 * Validate a route body for `kind` and return the canonical TurnRequest. The second pass through
 * `parseTurnRequest` keeps one definition of what a turn request is.
 */
export function parseTurnBody(
  kind: ThreadKind,
  body: unknown,
): { ok: true; request: TurnRequest } | { ok: false; problems: string[] } {
  const parsed = TURN_BODIES[kind].safeParse(body);
  if (!parsed.success) return { ok: false, problems: problemsOf(parsed.error) };
  return parseTurnRequest({ ...parsed.data, kind });
}
