// The tutor's wire protocol as the browser sees it (contracts §10). These declarations mirror
// server/src/tutor/{events,types,errors,domain,reviews}.ts, which belong to the tutor service and
// import no package; `tutor-align.test.ts` imports both sides and fails when they drift.
//
// Naming, to match what the service emits:
//   ThreadKind = what a request asks for (six UI entry points);
//   Lane       = the `thread_kind` of contracts §10.2 (the four conversations a subject has per day).
import { SUBJECT_KINDS } from "@oak/content-kit";
import { z } from "zod";

export const TUTOR_MODEL = "claude-opus-5-5";

export const BACKEND_IDS = ["anthropic-api", "claude-cli"] as const;
export type BackendId = (typeof BACKEND_IDS)[number];

export const THREAD_KINDS = [
  "chat",
  "hint",
  "explain",
  "listening",
  "review-capstone",
  "review-transcription",
] as const;
export type ThreadKind = (typeof THREAD_KINDS)[number];

export const LANES = ["hint", "note", "chat", "review"] as const;
export type Lane = (typeof LANES)[number];

export const LANE_OF: Readonly<Record<ThreadKind, Lane>> = {
  chat: "chat",
  hint: "hint",
  explain: "hint",
  listening: "note",
  "review-capstone": "review",
  "review-transcription": "review",
};
/** Effort is fixed per lane and never changes inside a conversation. */
export const EFFORT_OF: Readonly<Record<Lane, "low" | "medium" | "high">> = {
  hint: "low",
  note: "low",
  chat: "medium",
  review: "high",
};

export const TUTOR_ERROR_KINDS = [
  "rate_limit",
  "overloaded",
  "auth",
  "bad_request",
  "network",
  "refusal",
  "max_tokens",
  "iteration_limit",
  "aborted",
  "internal",
] as const;
export type TutorErrorKind = (typeof TUTOR_ERROR_KINDS)[number];

export const TUTOR_HEALTH = ["ready", "missing_key", "invalid_key", "unreachable"] as const;
/** `/api/health` reports a status enum only; the key never appears in any response. */
export type TutorHealth = (typeof TUTOR_HEALTH)[number];

export const RungSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type Rung = z.infer<typeof RungSchema>;

export const SubjectRefSchema = z.strictObject({
  subjectKind: z.enum(SUBJECT_KINDS),
  subjectId: z.string().min(1),
});
export type SubjectRef = z.infer<typeof SubjectRefSchema>;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// --- grade snapshot (what the browser may attach to a turn) -------------------------------------

export const RawIssueSchema = z.strictObject({
  where: z.strictObject({
    track: z.string().nullable(),
    bar: z.number().nullable(),
    beat: z.number().nullable(),
    code: z.strictObject({ from: z.number(), to: z.number() }).nullable(),
  }),
  severity: z.enum(["error", "warn", "info"]),
  feedback: z.string(),
  direction: z.string().nullable(),
  concept: z.string().nullable(),
  what: z.string(),
  fix: z.string().nullable(),
  expected: z.string().nullable(),
  got: z.string().nullable(),
});
export type RawIssue = z.infer<typeof RawIssueSchema>;

/** `GradeResult` reduced to what the tutor tools return. The server redacts it by its own rung before use. */
export const GradeSnapshotSchema = z.strictObject({
  status: z.enum(["pass", "fail", "error", "ungraded"]),
  score: z.number(),
  dims: z.record(z.string(), z.number()),
  counts: z.strictObject({ missing: z.number(), extra: z.number(), wrong: z.number() }),
  issues: z.array(RawIssueSchema),
  warnings: z.array(z.string()),
});
export type GradeSnapshot = z.infer<typeof GradeSnapshotSchema>;

/** Body of every tutor SSE route. Nothing here is trusted to decide what may be revealed. */
export const TutorTurnRequestSchema = z.strictObject({
  thread: SubjectRefSchema,
  kind: z.enum(THREAD_KINDS),
  userText: z.string().max(8000),
  learnerCode: z.string().max(60_000).exactOptional(),
  graderResult: GradeSnapshotSchema.exactOptional(),
  lessonId: z.string().exactOptional(),
  stepId: z.string().exactOptional(),
  /**
   * Wave 4 (docs/design/wave4.md §5.6): a capstone review of one album version. With both set, the accepted
   * `submit_capstone_review` is attached to that version (`album_track_versions.review_json`).
   */
  albumTrackId: z.string().exactOptional(),
  albumVersion: z.number().int().positive().exactOptional(),
  /** Wave 4: a transcription review of one version of the subject's project (default: its current version). */
  transcriptionVersion: z.number().int().nonnegative().exactOptional(),
  /**
   * Oak 2.0 W4 F4: the one question the learner asks a capstone or track review; the review answers it first
   * (`CapstoneReview.answer`). At most 300 characters (Oak's call). Absent = no question.
   */
  reviewQuestion: z.string().trim().min(1).max(300).exactOptional(),
});
export type TutorTurnRequest = z.infer<typeof TutorTurnRequestSchema>;

// --- reviews (contracts §10.6) ------------------------------------------------------------------

export const REVIEW_LAYERS = ["drums", "bass", "chords", "melody", "form"] as const;
const Bars = z.tuple([z.number().int(), z.number().int()]);

export const CapstoneReviewSchema = z.strictObject({
  strengths: z.array(z.strictObject({ text: z.string(), bars: Bars })),
  revisions: z.array(
    z.strictObject({
      title: z.string(),
      bars: Bars,
      why: z.string(),
      tryCode: z.string(),
      skills: z.array(z.string()),
    }),
  ),
  listeningQuestion: z.string(),
  linerNote: z.string(),
  /**
   * Oak 2.0 W4 F4: the answer to the learner's `reviewQuestion`, shown first; `null` without a question. Absent from
   * reviews stored before W4, which still parse.
   */
  answer: z.string().nullable().optional(),
});
export type CapstoneReview = z.infer<typeof CapstoneReviewSchema>;

export const TranscriptionReviewSchema = z.strictObject({
  strengths: z.array(z.strictObject({ text: z.string(), bars: Bars, layer: z.enum(REVIEW_LAYERS) })),
  revisions: z.array(
    z.strictObject({
      title: z.string(),
      bars: Bars,
      layer: z.enum(REVIEW_LAYERS),
      why: z.string(),
      listenFor: z.string(),
    }),
  ),
  plausibilityFlags: z.array(z.strictObject({ bars: Bars, issue: z.string() })),
  listeningQuestion: z.string(),
  linerNote: z.string(),
});
export type TranscriptionReview = z.infer<typeof TranscriptionReviewSchema>;

export type ReviewKind = "capstone" | "transcription";
export type ReviewValue = CapstoneReview | TranscriptionReview;

/** Counts and word limits a strict JSON Schema cannot express; the server checks them. */
export const REVIEW_LIMITS = {
  strengths: [2, 3],
  strengthWords: 40,
  titleWords: 8,
  whyWords: 50,
  tryCodeLines: 12,
  skills: 3,
  listenForWords: 30,
  flags: 3,
  flagWords: 30,
  questionWords: 30,
  linerNoteWords: 60,
} as const;

/** Exactly 1 revision for C0 to C4 and X1; exactly 2 for C5 and every later capstone. */
export function reviewRevisionsFor(capstoneId: string): 1 | 2 {
  return /^(?:C[0-4]|X1)$/.test(capstoneId) ? 1 : 2;
}

// --- SSE events ---------------------------------------------------------------------------------

export const UsageSummarySchema = z.object({
  backend: z.enum(BACKEND_IDS),
  requests: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadInputTokens: z.number(),
  cacheCreationInputTokens: z.number(),
  cacheCreation1hInputTokens: z.number(),
  cacheCreation5mInputTokens: z.number(),
  /** List-price estimate for the API backend; `null` for the CLI ("included in your Claude plan"). */
  costUsd: z.number().nullable(),
  includedInPlan: z.boolean(),
  servedBy: z.array(z.string()),
});
export type UsageSummary = z.infer<typeof UsageSummarySchema>;

export const APPLY_STATES = ["preview_only", "applicable"] as const;
export type ApplyState = (typeof APPLY_STATES)[number];

export const CardDataSchema = z.object({
  cardId: z.string(),
  toolUseId: z.string(),
  kind: z.enum(["hint", "fix", "variation", "example", "next_step"]),
  title: z.string(),
  code: z.string(),
  explanation: z.string(),
  bars: z.number(),
  /** Decided by the server from the subject (contracts §10.7); the model cannot ask for it. */
  apply: z.enum(APPLY_STATES),
  applyAllowed: z.boolean(),
  /** Tool IDs the card uses that are still locked: the card is badged "preview: unlocks at ...". */
  lockedTools: z.array(z.string()),
});
export type CardData = z.infer<typeof CardDataSchema>;

export const STOP_REASONS = ["end_turn", "max_tokens", "stop_sequence", "other"] as const;
export type StopReason = (typeof STOP_REASONS)[number];

const frame = <T extends string, D extends z.ZodType>(type: T, data: D) =>
  z.object({ type: z.literal(type), data });

export const TutorEventSchema = z.discriminatedUnion("type", [
  frame(
    "meta",
    z.object({
      conversationId: z.string(),
      kind: z.enum(THREAD_KINDS),
      lane: z.enum(LANES),
      backend: z.enum(BACKEND_IDS),
      model: z.string(),
      /** The step's rung after any advance this request caused; `null` when there is no graded step. */
      rung: RungSchema.nullable(),
      /** Whether `[[reveal]]` renders as the "Reveal (hint 4)" button in this turn. */
      revealAllowed: z.boolean(),
    }),
  ),
  frame("status", z.object({ phase: z.enum(["thinking", "tool", "writing"]), label: z.string() })),
  frame("text", z.object({ delta: z.string() })),
  /** Summarized thinking. Never sent by the `claude-cli` backend. */
  frame("thinking", z.object({ delta: z.string() })),
  frame("tool_start", z.object({ toolUseId: z.string(), name: z.string() })),
  /** Card draft: partial JSON of a `propose_code` input. */
  frame("tool_input", z.object({ toolUseId: z.string(), partialJson: z.string() })),
  frame(
    "tool_result",
    z.object({ toolUseId: z.string(), name: z.string(), ok: z.boolean(), summary: z.string() }),
  ),
  frame("card", CardDataSchema),
  frame(
    "review",
    z.object({
      reviewKind: z.enum(["capstone", "transcription"]),
      review: z.union([CapstoneReviewSchema, TranscriptionReviewSchema]),
    }),
  ),
  frame("usage", UsageSummarySchema),
  frame(
    "done",
    z.object({
      stopReason: z.enum(STOP_REASONS),
      backend: z.enum(BACKEND_IDS),
      iterations: z.number(),
      usage: UsageSummarySchema,
    }),
  ),
  frame(
    "error",
    z.object({
      kind: z.enum(TUTOR_ERROR_KINDS),
      message: z.string(),
      retryAfterSec: z.number().exactOptional(),
      usage: UsageSummarySchema.exactOptional(),
    }),
  ),
]);
export type TutorEvent = z.infer<typeof TutorEventSchema>;
export type TutorEventType = TutorEvent["type"];
export type TutorEventOf<T extends TutorEventType> = Extract<TutorEvent, { type: T }>;

export const TUTOR_EVENT_TYPES = [
  "meta",
  "status",
  "text",
  "thinking",
  "tool_start",
  "tool_input",
  "tool_result",
  "card",
  "review",
  "usage",
  "done",
  "error",
] as const satisfies readonly TutorEventType[];

/** The server sends `: ping` as an SSE comment every 5 s (Bun drops a silent stream at about 10 s). */
export const SSE_PING_INTERVAL_MS = 5_000;

export interface ParsedSse {
  event: string;
  data: unknown;
}

/** Incremental SSE parser. Feed it decoded text chunks of any size. */
export class SseParser {
  #buf = "";
  readonly comments: string[] = [];

  push(chunk: string): ParsedSse[] {
    this.#buf += chunk.replace(/\r\n?/g, "\n");
    const out: ParsedSse[] = [];
    for (;;) {
      const i = this.#buf.indexOf("\n\n");
      if (i < 0) break;
      const block = this.#buf.slice(0, i);
      this.#buf = this.#buf.slice(i + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith(":")) this.comments.push(line.slice(1).trim());
        else if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length === 0) continue;
      try {
        out.push({ event, data: JSON.parse(data.join("\n")) });
      } catch {
        // Not our JSON (for example a proxy's own error frame): surface it as text.
        out.push({ event, data: data.join("\n") });
      }
    }
    return out;
  }

  /** Text received after the last complete frame. Non-empty at end of stream means a cut-off frame. */
  get pending(): string {
    return this.#buf;
  }
}

/** Narrows a parsed frame to a validated `TutorEvent`, or `null` if it is not one of ours. */
export function asTutorEvent(parsed: ParsedSse): TutorEvent | null {
  if (!(TUTOR_EVENT_TYPES as readonly string[]).includes(parsed.event)) return null;
  const result = TutorEventSchema.safeParse({ type: parsed.event, data: parsed.data });
  return result.success ? result.data : null;
}

/** The fixed copy the server sends per error kind; used by the client for errors it raises itself. */
export const TUTOR_ERROR_COPY: Readonly<Record<TutorErrorKind, string>> = {
  rate_limit: "The tutor is being rate limited. Try again in a moment.",
  overloaded: "The tutor is busy right now. Try again.",
  auth: "The tutor could not sign in. Check the tutor setup in Settings.",
  bad_request: "The tutor could not handle that request.",
  network: "The tutor could not be reached. Check your connection.",
  refusal: "The tutor declined to answer that. Try asking in a different way.",
  max_tokens: "The tutor's answer was cut off. Try again.",
  iteration_limit: "The tutor took too many steps without finishing. Try again.",
  aborted: "Stopped.",
  internal: "Something went wrong in the tutor.",
};

// --- stored transcript and notes (what the panel reads back) ------------------------------------

export const TranscriptEntrySchema = z.object({
  conversationId: z.string(),
  seq: z.number(),
  at: z.string(),
  role: z.enum(["user", "assistant"]),
  kind: z.enum(THREAD_KINDS),
  /** User: the learner's text as typed. Assistant: sanitized markdown with music tokens (contracts §10.7). */
  text: z.string(),
  learnerCode: z.string().nullable(),
  cardIds: z.array(z.string()),
  review: z.unknown().nullable(),
  stepId: z.string().nullable(),
  rung: RungSchema.nullable(),
  summary: z.string().nullable(),
  backend: z.enum(BACKEND_IDS).nullable(),
  excluded: z.boolean(),
  errorKind: z.enum(TUTOR_ERROR_KINDS).nullable(),
});
export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;

export const CardRecordSchema = CardDataSchema.extend({ conversationId: z.string(), applied: z.boolean() });
export type CardRecord = z.infer<typeof CardRecordSchema>;

export const TutorNoteSchema = z.object({
  id: z.string(),
  day,
  subjectKind: z.string(),
  subjectId: z.string(),
  source: z.enum(["listening", "review", "observation"]),
  text: z.string(),
  skillId: z.string().nullable(),
  retractedAt: z.string().nullable(),
});
export type TutorNote = z.infer<typeof TutorNoteSchema>;

/** One merged timeline per subject: all days, all lanes, ordered by time. */
export const TutorTimelineSchema = z.object({
  subject: SubjectRefSchema,
  entries: z.array(TranscriptEntrySchema),
  cards: z.array(CardRecordSchema),
  notes: z.array(TutorNoteSchema),
  /** False during a checkpoint and during drill trials. */
  tutorOpen: z.boolean(),
  closedReason: z.string().nullable(),
});
export type TutorTimeline = z.infer<typeof TutorTimelineSchema>;

export const TutorSettingsSchema = z.strictObject({
  /** `auto`: an API key if present, then a logged-in `claude` on the PATH, otherwise off. */
  backend: z.enum(["auto", "off", ...BACKEND_IDS]),
  /** Always on. Default 25. */
  softMonthlyUsd: z.number().nonnegative(),
  softWarnedMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable(),
});
export type TutorSettings = z.infer<typeof TutorSettingsSchema>;
export const DEFAULT_TUTOR_SETTINGS: TutorSettings = {
  backend: "auto",
  softMonthlyUsd: 25,
  softWarnedMonth: null,
};

export const TutorUsageReportSchema = z.object({
  month: z.string(),
  activeBackend: z.enum(BACKEND_IDS).nullable(),
  /** Estimate; subscription usage adds nothing here. */
  costUsd: z.number(),
  includedInPlan: z.boolean(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadInputTokens: z.number(),
  cacheCreationInputTokens: z.number(),
  cacheHitRatio: z.number(),
  byLane: z.array(
    z.object({
      lane: z.enum(LANES),
      requests: z.number(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      costUsd: z.number(),
    }),
  ),
  softMonthlyUsd: z.number(),
  softPassed: z.boolean(),
});
export type TutorUsageReport = z.infer<typeof TutorUsageReportSchema>;

/**
 * `GET /api/tutor/status` (served by the tutor service itself, server/src/tutor/http/routes.ts): what Settings →
 * Tutor shows. Mirrors `TutorStatus` (server/src/tutor/service-types.ts). Wave 2 addition.
 */
export const TutorStatusSchema = z.object({
  tutor: z.enum(TUTOR_HEALTH),
  active: z.enum(BACKEND_IDS).nullable(),
  setting: z.enum(["auto", "off", ...BACKEND_IDS]),
  reason: z.string(),
  guidance: z.string().nullable(),
  model: z.string(),
  backends: z.array(
    z.object({
      id: z.enum(BACKEND_IDS),
      wired: z.boolean(),
      ok: z.boolean(),
      active: z.boolean(),
      reason: z.string().nullable(),
      guidance: z.string().nullable(),
      billing: z.enum(["api", "plan"]),
    }),
  ),
  budget: z.object({
    month: z.string(),
    monthUsd: z.number(),
    softMarkerUsd: z.number(),
    softPassed: z.boolean(),
  }),
  usage: z.object({
    costUsd: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheReadInputTokens: z.number(),
    cacheCreationInputTokens: z.number(),
    cacheHitRatio: z.number(),
  }),
});
export type TutorStatus = z.infer<typeof TutorStatusSchema>;

// --- music tokens in tutor text (contracts §10.7) -----------------------------------------------

export const MUSIC_TOKEN_KINDS = ["deg", "rn", "note", "chord", "bars", "tool", "term"] as const;
export type MusicTokenKind = (typeof MUSIC_TOKEN_KINDS)[number];
export type MusicToken = { kind: MusicTokenKind; value: string } | { kind: "reveal" };
export type TutorTextPart =
  | { type: "text"; text: string }
  | { type: "token"; token: MusicToken; raw: string };

const TOKEN = /\[\[(?:(reveal)|(deg|rn|note|chord|bars|tool|term):([^\][\n]{1,64}))\]\]/g;
const TOKEN_VALUE: Readonly<Record<MusicTokenKind, RegExp>> = {
  deg: /^[b#]?[1-7]$/,
  rn: /^[b#]?[IiVv]+[^\s\]]{0,12}$/,
  note: /^[A-G][#b]?-?\d$/,
  chord: /^[A-G][#b]?[A-Za-z0-9^#+-]{0,10}$/,
  bars: /^\d{1,3}(?:-\d{1,3})?$/,
  tool: /^tb\.[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)*$/,
  term: /^(?:term\.)?[a-z0-9-]+$/,
};

/** Splits tutor markdown into text and music tokens. Unknown or malformed tokens stay plain text. */
export function parseTutorText(markdown: string): TutorTextPart[] {
  const parts: TutorTextPart[] = [];
  let last = 0;
  const pushText = (text: string): void => {
    const prev = parts[parts.length - 1];
    if (text === "") return;
    if (prev?.type === "text") prev.text += text;
    else parts.push({ type: "text", text });
  };
  for (const m of markdown.matchAll(TOKEN)) {
    const raw = m[0];
    const index = m.index;
    pushText(markdown.slice(last, index));
    last = index + raw.length;
    if (m[1] === "reveal") parts.push({ type: "token", token: { kind: "reveal" }, raw });
    else {
      const kind = m[2] as MusicTokenKind;
      const value = (m[3] as string).trim();
      if (TOKEN_VALUE[kind].test(value)) parts.push({ type: "token", token: { kind, value }, raw });
      else pushText(raw);
    }
  }
  pushText(markdown.slice(last));
  return parts;
}
