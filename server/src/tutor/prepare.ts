// Resolving a turn: from a browser request to the TurnContext every later step runs under.
// This is where the server-side facts are read (rung, passed, released, unlocked) and where the
// request's own claims stop mattering. Nothing here talks to a model.
import { buildOakContext } from "./context.ts";
import type { LessonSource, StepSource, StepState } from "./domain.ts";
import { TutorError } from "./errors.ts";
import type { ConversationRecord, TutorPorts } from "./ports.ts";
import { buildPrefix, prefixVersion } from "./prompt/persona.ts";
import { answerPolicy, disclosureLevel } from "./redaction.ts";
import {
  type BudgetStatus,
  checkBudget,
  conversationKey,
  coupleHintRung,
  handoffLines,
  learnerDay,
  openConversation,
  seedNotes,
} from "./threads.ts";
import { applyPolicyFor } from "./tools/propose.ts";
import {
  effortFor,
  laneFor,
  limitsFor,
  type Prefix,
  reviewKindOf,
  reviewTargetOf,
  type TranscriptEntry,
  type TurnContext,
  type TurnRequest,
  type UserTurn,
} from "./types.ts";

export interface PreparedTurn {
  request: TurnRequest;
  ctx: TurnContext;
  record: ConversationRecord;
  prefix: Prefix;
  prefixVersion: string;
  /** Prior turns of the conversation, failed tails left out. */
  transcript: TranscriptEntry[];
  /** The newest user turn, context already built and redacted. */
  user: UserTurn;
  budget: BudgetStatus;
}

const DEFAULT_REVIEW_TEXT = "Please review this.";
const DEFAULT_NOTE_TEXT = "Please write a listening note for this sketch.";

/**
 * Throws a TutorError for the cases a route answers with `error` instead of a stream:
 * `bad_request` (the tutor is off for this subject, or there is nothing to review). The budget is
 * read for the soft marker only; it never blocks a turn.
 */
export async function prepareTurn(request: TurnRequest, ports: TutorPorts): Promise<PreparedTurn> {
  const budget = await checkBudget(ports);

  const { thread, kind } = request;
  const facts = await ports.lessons.subject(thread);
  // Off during a checkpoint and during drill trials (contracts §10.2, §10.4).
  if (!facts.tutorOpen)
    throw new TutorError("bad_request", { detail: facts.closedReason ?? "tutor closed for subject" });

  const lane = laneFor(kind);
  const day = learnerDay(ports.clock.now(), ports.clock.timeZone());
  const key = conversationKey(thread, kind, day);

  const lessonId = request.lessonId ?? (thread.subjectKind === "lesson" ? thread.subjectId : undefined);
  let lesson: LessonSource | null = null;
  let step: StepSource | null = null;
  let stepState: StepState | null = null;
  if (lessonId !== undefined) {
    lesson = await ports.lessons.lesson(lessonId);
    if (lesson !== null && request.stepId !== undefined)
      step = await ports.lessons.step(lessonId, request.stepId);
  }

  const reviewKind = reviewKindOf(kind);
  const target = reviewKind === null ? null : reviewTargetOf(request);
  if (target !== null && (target.kind === "album") !== (reviewKind === "capstone"))
    throw new TutorError("bad_request", { detail: "the review target does not match the review kind" });
  const found = reviewKind === null ? null : await ports.lessons.review(thread, target);
  if (reviewKind !== null && found === null)
    throw new TutorError("bad_request", { detail: "nothing to review" });
  // The version reviewed is the one asked for; an adapter that does not say so is told here.
  let review = found === null ? null : { ...found, target: found.target ?? target };
  if (review !== null && (thread.subjectKind === "capstone" || thread.subjectKind === "track"))
    review = { ...review, question: request.reviewQuestion ?? null };

  const prefix = buildPrefix(await ports.lessons.prefixSources());
  const version = prefixVersion(prefix);
  const open = await openConversation(ports.conversations, key, {
    effort: effortFor(kind),
    prefixVersion: version,
  });

  if (step !== null) {
    stepState = await ports.progress.stepState(step.lessonId, step.id);
    // The rung moves here, before any model is called, and only through the server's own state.
    // A retry of a hint that failed (its tail is stored as excluded) does not climb a second time.
    const all = await ports.conversations.entries(open.record.id, { includeExcluded: true });
    const last = all.at(-1);
    const isRetry = last?.excluded === true && last.stepId === step.id;
    if (!isRetry) stepState = await coupleHintRung(kind, step, stepState, ports.progress);
  }

  const disclosure = disclosureLevel(stepState);
  const policy = answerPolicy(step, disclosure);
  const { apply, gradedContext } = applyPolicyFor({
    subjectKind: thread.subjectKind,
    facts,
    step,
    disclosure,
  });

  const [progress, terms] = await Promise.all([ports.progress.snapshot(), ports.progress.termsIntroduced()]);
  const notes = open.isFirstTurn ? await seedNotes(ports.notes, thread) : [];
  const handoffs =
    lane === "chat" ? handoffLines(await ports.conversations.subjectDay(thread, day), open.record.id) : [];

  // A review reads the code the server holds for the piece, not what the browser sent.
  const learnerCode = review !== null ? review.code : (request.learnerCode ?? null);

  const ctx: TurnContext = {
    conversation: key,
    conversationId: open.record.id,
    kind,
    lane,
    effort: effortFor(kind),
    limits: limitsFor(kind),
    isFirstTurn: open.isFirstTurn,
    facts,
    lesson,
    step,
    stepState,
    rung: stepState?.rung ?? 0,
    disclosure,
    answerPolicy: policy,
    // Valid only on a hint or chat thread whose step is graded, unpassed and not yet revealed.
    revealAllowed: (lane === "hint" || lane === "chat") && policy === "socratic",
    apply,
    gradedContext,
    learnerCode,
    grade: request.graderResult ?? null,
    progress,
    terms,
    notes,
    handoffs,
    review,
  };

  let text = request.userText.trim();
  if (text === "" && review !== null) text = review.learnerNote?.trim() || DEFAULT_REVIEW_TEXT;
  if (text === "" && kind === "listening") text = DEFAULT_NOTE_TEXT;

  return {
    request,
    ctx,
    record: open.record,
    prefix,
    prefixVersion: version,
    transcript: open.transcript,
    user: { oakContext: buildOakContext(ctx), learnerCode, text },
    budget,
  };
}
