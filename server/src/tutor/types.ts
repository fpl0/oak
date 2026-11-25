// The tutor's own model: threads, turns, and the TutorBackend contract that the two backends
// ('anthropic-api' and 'claude-cli') implement. Backends and routes build on these types, so they
// change only with care.
import type {
  GradeSnapshot,
  IntroducedTerms,
  LessonSource,
  ProgressSnapshot,
  ReviewSource,
  ReviewTarget,
  Rung,
  StepSource,
  StepState,
  SubjectFacts,
  TutorNote,
} from "./domain.ts";
import type { TutorErrorKind } from "./errors.ts";
import type { ReviewKind } from "./reviews.ts";

export type { Rung } from "./domain.ts";

/** One model on every route (PLAN resolution 10). */
export const MODEL = "claude-opus-5-5";

export type BackendId = "anthropic-api" | "claude-cli";
export const BACKEND_IDS = ["anthropic-api", "claude-cli"] as const satisfies readonly BackendId[];

export type Effort = "low" | "medium" | "high";

// --- threads -----------------------------------------------------------------------------------

export const SUBJECT_KINDS = [
  "general",
  "lesson",
  "checkpoint",
  "capstone",
  "transcription",
  "sketch",
  "track",
  "drill",
] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export interface SubjectRef {
  subjectKind: SubjectKind;
  subjectId: string;
}

/** What the learner sees as one thread: a subject on one learner-local day (04:00 rollover). */
export interface ThreadKey extends SubjectRef {
  day: string;
}

/** What a request asks for. Six kinds, because the UI has six entry points. */
export const THREAD_KINDS = [
  "chat",
  "hint",
  "explain",
  "listening",
  "review-capstone",
  "review-transcription",
] as const;
export type ThreadKind = (typeof THREAD_KINDS)[number];

/**
 * The `thread_kind` of contracts §10.2: the four conversations a subject can have per day. Each
 * has one constant effort, so a conversation's cached prefix is never invalidated by an effort change.
 */
export const LANES = ["hint", "note", "chat", "review"] as const;
export type Lane = (typeof LANES)[number];

export interface ConversationKey extends ThreadKey {
  lane: Lane;
}

const LANE_OF: Record<ThreadKind, Lane> = {
  chat: "chat",
  hint: "hint",
  explain: "hint",
  listening: "note",
  "review-capstone": "review",
  "review-transcription": "review",
};

const EFFORT_OF: Record<Lane, Effort> = { hint: "low", note: "low", chat: "medium", review: "high" };

export interface Limits {
  maxTokens: number;
  /** Model calls per turn. */
  maxIterations: number;
  /** Cards one turn may show. */
  maxCards: number;
  /** Word limit the persona asks for; `null` where the limit is stated in sentences or by a schema. */
  maxWords: number | null;
}

const LIMITS_OF: Record<Lane, Limits> = {
  hint: { maxTokens: 4_000, maxIterations: 3, maxCards: 1, maxWords: 80 },
  note: { maxTokens: 4_000, maxIterations: 2, maxCards: 0, maxWords: null },
  chat: { maxTokens: 16_000, maxIterations: 6, maxCards: 6, maxWords: 200 },
  review: { maxTokens: 32_000, maxIterations: 8, maxCards: 2, maxWords: null },
};

export function laneFor(kind: ThreadKind): Lane {
  return LANE_OF[kind];
}

/** Effort is fixed per thread kind and never lowered to save money (contracts §10.9). */
export function effortFor(kind: ThreadKind): Effort {
  return EFFORT_OF[LANE_OF[kind]];
}

export function limitsFor(kind: ThreadKind): Limits {
  return LIMITS_OF[LANE_OF[kind]];
}

export function reviewKindOf(kind: ThreadKind): ReviewKind | null {
  if (kind === "review-capstone") return "capstone";
  if (kind === "review-transcription") return "transcription";
  return null;
}

// --- one turn ----------------------------------------------------------------------------------

/** What a route receives from the browser. Nothing here is trusted to decide what may be revealed. */
export interface TurnRequest {
  thread: SubjectRef;
  kind: ThreadKind;
  userText: string;
  /** The code in the subject's editor. */
  learnerCode?: string;
  /** The latest check result as the browser saw it. Redacted by the server's rung before use. */
  graderResult?: GradeSnapshot;
  lessonId?: string;
  stepId?: string;
  /**
   * Wave 4 (`TutorTurnRequestSchema`): a capstone review of one album version. With both set, the review reads
   * that version and the accepted review is attached to it.
   */
  albumTrackId?: string;
  albumVersion?: number;
  /** Wave 4: a transcription review of one version of the project (default: its latest). */
  transcriptionVersion?: number;
  reviewQuestion?: string;
}

/** The version a review request names, if any (both album fields, or the transcription version). */
export function reviewTargetOf(request: TurnRequest): ReviewTarget | null {
  if (request.albumTrackId !== undefined && request.albumVersion !== undefined)
    return { kind: "album", trackId: request.albumTrackId, version: request.albumVersion };
  if (request.transcriptionVersion !== undefined)
    return { kind: "transcription", version: request.transcriptionVersion };
  return null;
}

export type ApplyState = "preview_only" | "applicable";

/** `socratic`: withhold by rung. `may_reveal`: rung 4 or passed. `open`: nothing to withhold. */
export type AnswerPolicy = "socratic" | "may_reveal" | "open";

/**
 * Everything one turn runs under, resolved on the server before any backend is called. The
 * `lesson`, `step`, `grade` and `review` fields are UNREDACTED and exist for the tool executors
 * and the context builder; they are never handed to a backend.
 */
export interface TurnContext {
  conversation: ConversationKey;
  conversationId: string;
  kind: ThreadKind;
  lane: Lane;
  effort: Effort;
  limits: Limits;
  isFirstTurn: boolean;
  facts: SubjectFacts;
  lesson: LessonSource | null;
  step: StepSource | null;
  stepState: StepState | null;
  /** Server state after any advance this request caused. Never model input, never client input. */
  rung: Rung;
  /** The level the redaction matrix is read at: the rung, or 4 once the step has passed. */
  disclosure: Rung;
  answerPolicy: AnswerPolicy;
  revealAllowed: boolean;
  /** What a card in this turn may offer, before locked tools are considered. */
  apply: ApplyState;
  /** Lesson steps, checkpoints, capstones, drills and ladder transcriptions: locked tools never get Apply. */
  gradedContext: boolean;
  learnerCode: string | null;
  grade: GradeSnapshot | null;
  progress: ProgressSnapshot;
  terms: IntroducedTerms;
  /** Tutor notes that seed the conversation; empty after its first turn. */
  notes: TutorNote[];
  /** One-line summaries of what the other conversations of this subject did since the last chat turn. */
  handoffs: string[];
  review: ReviewSource | null;
}

// --- transcript --------------------------------------------------------------------------------

/**
 * One entry of the app-level transcript: what the panel shows and what any backend can be seeded
 * from. Append-only. A failed tail turn is stored with `excluded: true` and never replayed.
 */
export interface TranscriptEntry {
  conversationId: string;
  seq: number;
  /** ISO instant. Storage only: nothing finer than the day is ever sent to a model. */
  at: string;
  role: "user" | "assistant";
  kind: ThreadKind;
  /** User: the learner's text as typed. Assistant: sanitized markdown (markup.ts). */
  text: string;
  learnerCode: string | null;
  cardIds: string[];
  review: unknown | null;
  stepId: string | null;
  rung: Rung | null;
  /** A one-line hand-off other conversations of the subject may be told (contracts §10.2 "Seeding"). */
  summary: string | null;
  backend: BackendId | null;
  excluded: boolean;
  errorKind: TutorErrorKind | null;
}

export type NewTranscriptEntry = Omit<TranscriptEntry, "conversationId" | "seq" | "at">;

export * from "./backend.ts";
