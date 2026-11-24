// The REST contract: every endpoint under /api (architecture §4.4 as amended by contracts §11).
// The server mounts handlers from this table (zValidator on `params`, `query`, `body`); the client
// (./client.ts) types calls from it. One entry per endpoint, no codegen.

import { SUBJECT_KINDS, schemas } from "@oak/content-kit";
import { z } from "zod";
import * as D from "./dto.ts";
import {
  CardRecordSchema,
  SubjectRefSchema,
  TutorNoteSchema,
  TutorStatusSchema,
  TutorTimelineSchema,
  TutorTurnRequestSchema,
  TutorUsageReportSchema,
} from "./tutor.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointDef {
  method: HttpMethod;
  /** Path under `/api`, with `:name` segments. */
  path: `/${string}`;
  /** Path parameters. Every `:name` in `path` has a key here. */
  params?: z.ZodObject;
  query?: z.ZodObject;
  /** JSON body schema, or `binary` for a raw upload (the body is the file; metadata goes in the query). */
  body?: z.ZodType | "binary";
  /** JSON response schema; `binary` for media and archives; `sse` for tutor streams (events: ./tutor.ts). */
  res: z.ZodType | "binary" | "sse";
  /** Destructive: needs `X-Oak-Confirm: <nonce>` from `POST /api/confirm` for this action (contracts §11.6). */
  confirm?: D.ConfirmAction;
  /**
   * Wave 5: destructive only when it replaces something (re-recording an album version, carry-over c11). The client
   * sends `X-Oak-Confirm` when the caller passes a nonce; the server answers 428 `confirm_required` when there is
   * something to replace and no valid nonce for this action and `<id>/v<v>`, and needs none otherwise.
   */
  confirmIf?: D.ConfirmAction;
  /**
   * Media GET, the target of an `<audio src>`: exempt from `X-Oak: 1`, must carry
   * `Sec-Fetch-Site: same-origin` instead (contracts §11.1 rule 4). Supports Range.
   */
  media?: true;
  /** Exists only when `OAK_DEV=1`. */
  dev?: true;
}

const id = z.string().min(1);
const p = <K extends string>(...names: K[]) =>
  z.strictObject(Object.fromEntries(names.map((n) => [n, id])) as Record<K, typeof id>);
const list = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });
const flag = z.enum(["0", "1"]);
/** `/songs/:unitId`: a unit id (`U01`, `J1`); anything else is a 400. */
const unitParams = z.strictObject({ unitId: schemas.idSchema("unit") });

export const contract = {
  // --- meta ---
  health: { method: "GET", path: "/health", res: D.HealthSchema },
  bootstrap: { method: "GET", path: "/bootstrap", res: D.BootstrapSchema },
  "settings.put": {
    method: "PUT",
    path: "/settings/:key",
    params: z.strictObject({ key: z.enum(D.SETTING_KEYS) }),
    body: z.strictObject({ value: z.unknown() }),
    res: D.SettingsSchema,
  },
  "settings.anthropicKey.set": {
    method: "POST",
    path: "/settings/anthropic-key",
    // Printable ASCII without spaces once trimmed: a key with a line break or control character would be
    // stored (an unreachable API stores the key) and then break, or split, the request header it goes in.
    body: z.strictObject({
      key: z
        .string()
        .trim()
        .min(20)
        .max(400)
        .regex(/^[\x21-\x7e]+$/, "an API key is printable characters without spaces"),
    }),
    res: D.KeyStatusSchema,
  },
  "settings.anthropicKey.delete": {
    method: "DELETE",
    path: "/settings/anthropic-key",
    res: D.KeyStatusSchema,
    confirm: "anthropic-key.delete",
  },
  confirm: { method: "POST", path: "/confirm", body: D.ConfirmRequestSchema, res: D.ConfirmNonceSchema },
  "data.reset": { method: "POST", path: "/data/reset", res: D.Ok, confirm: "data.reset" },

  // --- profile ---
  "profile.get": { method: "GET", path: "/profile", res: D.ProfileSchema },
  "profile.put": { method: "PUT", path: "/profile", body: D.ProfilePatchSchema, res: D.ProfileSchema },
  "profile.calibration": {
    method: "POST",
    path: "/profile/calibration",
    body: D.CalibrationRunSchema,
    res: D.ProfileSchema,
  },

  // --- session ---
  "session.today": {
    method: "GET",
    path: "/session/today",
    query: z.strictObject({ targetMinutes: z.enum(["15", "20", "25"]).optional() }),
    res: D.SessionPlanSchema,
  },
  "session.start": {
    method: "POST",
    path: "/session/start",
    body: D.SessionStartSchema,
    res: D.SessionSchema,
  },
  "session.heartbeat": {
    method: "POST",
    path: "/session/:id/heartbeat",
    params: p("id"),
    body: D.SessionHeartbeatSchema,
    res: D.Ok,
  },
  "session.end": {
    method: "POST",
    path: "/session/:id/end",
    params: p("id"),
    body: D.SessionEndSchema,
    res: D.SessionSummarySchema,
  },

  // --- lessons, steps, checkpoints, capstones, gym ---
  "lessons.progress": { method: "GET", path: "/lessons/progress", res: D.CourseProgressSchema },
  "steps.state": {
    method: "GET",
    path: "/lessons/:id/steps/:stepId",
    params: p("id", "stepId"),
    res: D.StepStateSchema,
  },
  "steps.attempt": {
    method: "POST",
    path: "/lessons/:id/steps/:stepId/attempts",
    params: p("id", "stepId"),
    body: D.StepAttemptCreateSchema,
    res: D.StepAttemptResultSchema,
  },
  /** Pressing Hint: raises the stored rung by one (to 4 only with `reveal: true`), exactly as a tutor hint request does up to 3. */
  "steps.hint": {
    method: "POST",
    path: "/lessons/:id/steps/:stepId/hints",
    params: p("id", "stepId"),
    body: z.strictObject({ reveal: z.boolean() }),
    res: D.StepStateSchema,
  },
  /** "Try a new one": starts a new attempt series with fresh params. */
  "steps.newSeries": {
    method: "POST",
    path: "/lessons/:id/steps/:stepId/series",
    params: p("id", "stepId"),
    res: D.StepStateSchema,
  },
  "lessons.complete": {
    method: "POST",
    path: "/lessons/:id/complete",
    params: p("id"),
    body: D.LessonCompleteRequestSchema,
    res: D.LessonCompleteResultSchema,
  },
  "checkpoints.start": {
    method: "POST",
    path: "/checkpoints/:cpId/start",
    params: p("cpId"),
    res: D.CheckpointAttemptStartSchema,
  },
  "checkpoints.attempt": {
    method: "POST",
    path: "/checkpoints/:cpId/attempts",
    params: p("cpId"),
    body: D.CheckpointSubmitSchema,
    res: D.CheckpointOutcomeSchema,
  },
  "capstones.get": { method: "GET", path: "/capstones/:id", params: p("id"), res: D.CapstoneStateSchema },
  "capstones.check": {
    method: "POST",
    path: "/capstones/:id/checks",
    params: p("id"),
    body: D.CapstoneCheckSchema,
    res: D.CapstoneStateSchema,
  },
  "capstones.completeSession": {
    method: "POST",
    path: "/capstones/:id/sessions",
    params: p("id"),
    body: D.CapstoneSessionCompleteSchema,
    res: D.CapstoneStateSchema,
  },
  "gym.start": {
    method: "POST",
    path: "/gym/sessions",
    body: D.GymSessionCreateSchema,
    res: D.GymSessionSchema,
  },
  "terms.introduced": { method: "GET", path: "/terms/introduced", res: list(D.TermIntroducedSchema) },

  // --- skills, SRS, drills ---
  "skills.map": { method: "GET", path: "/skills/map", res: D.SkillMapSchema },
  "srs.due": {
    method: "GET",
    path: "/srs/due",
    query: z.strictObject({ budgetSec: z.string().regex(/^\d+$/).optional(), more: flag.optional() }),
    res: D.DueBatchSchema,
  },
  "srs.review": {
    method: "POST",
    path: "/srs/review",
    body: D.SrsReviewRequestSchema,
    res: D.SrsReviewResultSchema,
  },
  "families.list": {
    method: "GET",
    path: "/drills/families",
    res: z.object({ families: z.array(D.FamilyStateSchema), cards: z.array(D.SrsCardSchema) }),
  },
  "families.state": {
    method: "GET",
    path: "/drills/difficulty/:familyId",
    params: p("familyId"),
    res: D.FamilyStateSchema,
  },
  "drills.start": {
    method: "POST",
    path: "/drills/sessions",
    body: D.DrillSessionCreateSchema,
    res: D.DrillSessionSchema,
  },
  "drills.trials": {
    method: "POST",
    path: "/drills/sessions/:id/trials",
    params: p("id"),
    body: z.strictObject({ trials: z.array(D.DrillTrialRecordSchema).min(1).max(50) }),
    res: D.Ok,
  },
  "drills.finish": {
    method: "POST",
    path: "/drills/sessions/:id/finish",
    params: p("id"),
    res: D.DrillFinishSchema,
  },

  // --- unlocks, can-do, progress, streak ---
  "unlocks.list": { method: "GET", path: "/unlocks", res: list(D.UnlockSchema) },
  "unlocks.seen": { method: "POST", path: "/unlocks/:id/seen", params: p("id"), res: D.Ok },
  "cando.list": { method: "GET", path: "/cando", res: list(D.CanDoEntrySchema) },
  "progress.get": { method: "GET", path: "/progress", res: D.ProgressReportSchema },
  "streak.get": {
    method: "GET",
    path: "/streak",
    query: z.strictObject({ weeks: z.string().regex(/^\d+$/).optional() }),
    res: z.object({
      summary: D.StreakSummarySchema,
      weeks: z.array(D.StreakWeekSchema),
      days: z.array(D.StreakDaySchema),
    }),
  },

  // --- sketches ---
  "sketches.list": {
    method: "GET",
    path: "/sketches",
    query: z.strictObject({ origin: z.enum(D.SKETCH_ORIGINS).optional(), archived: flag.optional() }),
    res: list(D.SketchSchema),
  },
  "sketches.create": {
    method: "POST",
    path: "/sketches",
    body: D.SketchCreateSchema,
    res: D.SketchSavedSchema,
  },
  "sketches.get": { method: "GET", path: "/sketches/:id", params: p("id"), res: D.SketchDetailSchema },
  "sketches.addVersion": {
    method: "POST",
    path: "/sketches/:id/versions",
    params: p("id"),
    body: D.SketchVersionCreateSchema,
    res: D.SketchSavedSchema,
  },
  "sketches.patch": {
    method: "PATCH",
    path: "/sketches/:id",
    params: p("id"),
    body: D.SketchPatchSchema,
    res: D.SketchSchema,
  },
  "sketches.delete": {
    method: "DELETE",
    path: "/sketches/:id",
    params: p("id"),
    res: D.Ok,
    confirm: "sketch.delete",
  },

  // --- album ---
  "album.get": { method: "GET", path: "/album", res: D.AlbumSchema },
  "album.track": { method: "GET", path: "/album/tracks/:id", params: p("id"), res: D.AlbumTrackDetailSchema },
  "album.createTrack": {
    method: "POST",
    path: "/album/tracks",
    body: D.AlbumTrackCreateSchema,
    res: D.AlbumTrackDetailSchema,
  },
  "album.addVersion": {
    method: "POST",
    path: "/album/tracks/:id/versions",
    params: p("id"),
    body: D.AlbumTrackVersionCreateSchema,
    res: D.AlbumTrackDetailSchema,
  },
  "album.putAudio": {
    method: "PUT",
    path: "/album/tracks/:id/versions/:v/audio",
    params: p("id", "v"),
    query: z.strictObject({ durationS: z.string().optional() }),
    body: "binary",
    res: D.AlbumTrackVersionSchema,
    confirmIf: "album.audio.replace",
  },
  "album.getAudio": {
    method: "GET",
    path: "/album/tracks/:id/versions/:v/audio",
    params: p("id", "v"),
    /** Wave 6 (d20): one take of the version (1-based); absent: the current take. Not personal data. */
    query: z.strictObject({
      take: z
        .string()
        .regex(/^[1-9]\d{0,3}$/)
        .optional(),
    }),
    res: "binary",
    media: true,
  },
  "album.deleteTrack": {
    method: "DELETE",
    path: "/album/tracks/:id",
    params: p("id"),
    res: D.Ok,
    confirm: "track.delete",
  },

  // --- audio (the learner's own files; never leave the machine) ---
  "audio.upload": {
    method: "POST",
    path: "/audio",
    query: z.strictObject({ name: z.string().min(1).max(255) }),
    body: "binary",
    res: D.AudioFileSchema,
  },
  "audio.get": { method: "GET", path: "/audio/:id", params: p("id"), res: "binary", media: true },
  "audio.putPeaks": { method: "PUT", path: "/audio/:id/peaks", params: p("id"), body: "binary", res: D.Ok },
  "audio.getPeaks": { method: "GET", path: "/audio/:id/peaks", params: p("id"), res: "binary", media: true },
  "audio.delete": {
    method: "DELETE",
    path: "/audio/:id",
    params: p("id"),
    res: D.Ok,
    confirm: "audio.delete",
  },

  // --- transcriptions ---
  "transcriptions.list": { method: "GET", path: "/transcriptions", res: list(D.TranscriptionSchema) },
  "transcriptions.create": {
    method: "POST",
    path: "/transcriptions",
    body: D.TranscriptionCreateSchema,
    res: D.TranscriptionDetailSchema,
  },
  "transcriptions.get": {
    method: "GET",
    path: "/transcriptions/:id",
    params: p("id"),
    res: D.TranscriptionDetailSchema,
  },
  "transcriptions.patch": {
    method: "PATCH",
    path: "/transcriptions/:id",
    params: p("id"),
    body: D.TranscriptionPatchSchema,
    res: D.TranscriptionSchema,
  },
  "transcriptions.addVersion": {
    method: "POST",
    path: "/transcriptions/:id/versions",
    params: p("id"),
    body: D.TranscriptionVersionCreateSchema,
    res: D.TranscriptionDetailSchema,
  },
  "transcriptions.delete": {
    method: "DELETE",
    path: "/transcriptions/:id",
    params: p("id"),
    res: D.Ok,
    confirm: "transcription.delete",
  },

  // --- tutor (SSE: POST + fetch stream; there is no delete endpoint for threads or messages) ---
  "tutor.chat": { method: "POST", path: "/tutor/chat", body: TutorTurnRequestSchema, res: "sse" },
  "tutor.hint": { method: "POST", path: "/tutor/hint", body: TutorTurnRequestSchema, res: "sse" },
  "tutor.note": { method: "POST", path: "/tutor/note", body: TutorTurnRequestSchema, res: "sse" },
  "tutor.reviewCapstone": {
    method: "POST",
    path: "/tutor/reviews/capstone",
    body: TutorTurnRequestSchema,
    res: "sse",
  },
  "tutor.reviewTranscription": {
    method: "POST",
    path: "/tutor/reviews/transcription",
    body: TutorTurnRequestSchema,
    res: "sse",
  },
  "tutor.warm": {
    method: "POST",
    path: "/tutor/warm",
    res: z.object({ ok: z.boolean(), warmed: z.boolean() }),
  },
  "tutor.timeline": {
    method: "GET",
    path: "/tutor/timeline",
    query: z.strictObject({ subjectKind: z.enum(SUBJECT_KINDS), subjectId: id }),
    res: TutorTimelineSchema,
  },
  "tutor.usage": {
    method: "GET",
    path: "/tutor/usage",
    query: z.strictObject({
      month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(),
    }),
    res: TutorUsageReportSchema,
  },
  "tutor.cardApplied": {
    method: "POST",
    path: "/tutor/cards/:id/applied",
    params: p("id"),
    body: z.strictObject({ sketchId: z.string().nullable(), toNewSketch: z.boolean() }),
    res: CardRecordSchema,
  },
  "tutor.notes": {
    method: "GET",
    path: "/tutor/notes",
    query: SubjectRefSchema.partial(),
    res: list(TutorNoteSchema),
  },
  "tutor.retractNote": {
    method: "POST",
    path: "/tutor/notes/:id/retract",
    params: p("id"),
    res: TutorNoteSchema,
  },

  // --- server grader, telemetry, QA ---
  grade: { method: "POST", path: "/grade", body: D.GradeRequestSchema, res: D.GradeResultSchema },
  analyze: { method: "POST", path: "/analyze", body: D.AnalyzeRequestSchema, res: D.AnalyzeResponseSchema },
  "telemetry.steps": {
    method: "POST",
    path: "/telemetry/steps",
    body: z.strictObject({ steps: z.array(D.StepTelemetrySchema).min(1).max(200) }),
    res: D.Ok,
  },
  "qa.report": { method: "POST", path: "/qa/reports", body: D.QaReportCreateSchema, res: D.QaReportSchema },

  // --- backup ---
  "backup.info": { method: "GET", path: "/backup", res: D.BackupInfoSchema },
  "backup.export": {
    method: "GET",
    path: "/backup/export",
    query: z.strictObject({ audio: flag.optional() }),
    res: "binary",
  },
  "backup.import": {
    method: "POST",
    path: "/backup/import",
    body: "binary",
    res: D.BackupImportResultSchema,
    confirm: "backup.import",
  },

  // --- dev (OAK_DEV=1) ---
  "dev.qa": { method: "GET", path: "/dev/qa", res: list(D.QaReportSchema), dev: true },
  "dev.qaUpdate": {
    method: "PATCH",
    path: "/dev/qa/:id",
    params: p("id"),
    body: z.strictObject({ status: z.enum(["open", "triaged", "fixed", "wontfix"]) }),
    res: D.QaReportSchema,
    dev: true,
  },
  "dev.telemetry": { method: "GET", path: "/dev/telemetry", res: D.TelemetryReportSchema, dev: true },
  "dev.contentReport": {
    method: "GET",
    path: "/dev/content-report",
    res: z.object({
      contentVersion: z.string().nullable(),
      lessons: z.number().int(),
      problems: z.array(z.object({ id: z.string(), message: z.string() })),
    }),
    dev: true,
  },

  // --- Wave 2 additions (docs/design/wave2.md §4). Until the server engineer builds a handler, each answers
  // 501 `not_implemented` (except `tutor.status`, which the tutor service already serves). ---
  /** Coda after a reload: the summary `session.end` returned. */
  "session.summary": {
    method: "GET",
    path: "/session/:id/summary",
    params: p("id"),
    res: D.SessionSummarySchema,
  },
  /** Every step's state of one lesson (step rail, resume). */
  "lessons.steps": { method: "GET", path: "/lessons/:id/steps", params: p("id"), res: D.LessonStepsSchema },
  /** Where the learner is in a lesson; "Wrap up" before the Make (contracts §9.3, §9.4). */
  "lessons.position": {
    method: "PUT",
    path: "/lessons/:id/position",
    params: p("id"),
    body: D.LessonPositionSchema,
    res: D.LessonProgressSchema,
  },
  /** Release a capstone draft to the album (first release or a revision). */
  "capstones.release": {
    method: "POST",
    path: "/capstones/:id/release",
    params: p("id"),
    body: D.CapstoneReleaseSchema,
    res: D.CapstoneReleaseResultSchema,
  },
  /** The next unlocks and how far away they are (Today's NextUnlockCard, the Coda's goal-gradient line). */
  "unlocks.next": { method: "GET", path: "/unlocks/next", res: list(D.NextUnlockSchema) },
  /** The map's "Revive": the planned warm-up sets of stale nodes (one node with `skillId`); `more` = "Revive more". */
  "skills.revive": {
    method: "GET",
    path: "/skills/revive",
    query: z.strictObject({ skillId: id.optional(), more: flag.optional() }),
    res: D.DueBatchSchema,
  },
  "onboarding.get": { method: "GET", path: "/onboarding", res: D.OnboardingStateSchema },
  "onboarding.put": {
    method: "PUT",
    path: "/onboarding",
    body: D.OnboardingPatchSchema,
    res: D.OnboardingStateSchema,
  },
  /** Calibration history, newest first (Settings → Voice and Audio show the last result of each kind). */
  "profile.calibrations": {
    method: "GET",
    path: "/profile/calibrations",
    query: z.strictObject({ kind: z.enum(D.CALIBRATION_KINDS).optional() }),
    res: list(D.CalibrationRecordSchema),
  },
  /** Settings → Tutor: backends, selection, budget. Served by the tutor service's own route. */
  "tutor.status": {
    method: "GET",
    path: "/tutor/status",
    query: z.strictObject({ refresh: z.literal("1").optional() }),
    res: TutorStatusSchema,
  },
  "dev.listen": { method: "GET", path: "/dev/listen", res: list(D.ListenMarkSchema), dev: true },
  "dev.listenMark": {
    method: "PUT",
    path: "/dev/listen/:ref",
    params: p("ref"),
    body: D.ListenMarkCreateSchema,
    res: D.ListenMarkSchema,
    dev: true,
  },

  // --- Wave 2 Build: dev tools for e2e (server engineer). ---
  /** Wipe the data and fast-forward the learner to a named point (DevSeedRequestSchema lists the points). */
  "dev.seed": {
    method: "POST",
    path: "/dev/seed",
    body: D.DevSeedRequestSchema,
    res: D.DevSeedResultSchema,
    dev: true,
  },
  /** The named seed points with one line each. */
  "dev.seedPoints": { method: "GET", path: "/dev/seed", res: list(D.DevSeedPointSchema), dev: true },
  "dev.clock": { method: "GET", path: "/dev/clock", res: D.DevClockSchema, dev: true },
  /** Move, freeze or reset the server clock (dev only). */
  "dev.clockSet": {
    method: "PUT",
    path: "/dev/clock",
    body: D.DevClockSetSchema,
    res: D.DevClockSchema,
    dev: true,
  },

  // --- Wave 3 additions (docs/design/wave3.md §5). Until the server engineer builds a handler, each answers
  // 501 `not_implemented` (`WAVE3_ENDPOINTS`; routes.test.ts keeps the list of those still pending). ---
  /** Today's sessions on the server: the "done for today" state across reloads and browsers. */
  "session.day": {
    method: "GET",
    path: "/session/day",
    /** Wave 6 (d21): the calling tab's id; `open` is then that tab's own open session. */
    query: z.strictObject({ tab: z.string().min(8).max(64).optional() }),
    res: D.SessionDaySchema,
  },
  /** Quiet mode for today, vocal range and the tolerance ladder: read before any mic is asked for. */
  "voice.get": { method: "GET", path: "/voice", res: D.VoiceStateSchema },
  /** The mic chip and Settings → Voice: Quiet mode for today or always. */
  "voice.quiet": {
    method: "PUT",
    path: "/voice/quiet",
    body: D.VoiceQuietSetSchema,
    res: D.VoiceStateSchema,
  },
  /** Settings → Voice: Auto, a fixed tolerance, or the one-tap loosen. */
  "voice.ladder": {
    method: "PUT",
    path: "/voice/ladder",
    body: D.VoiceLadderSetSchema,
    res: D.VoiceStateSchema,
  },
  /** One drill set with its stored trials (resume after a reload, the set summary). */
  "drills.get": {
    method: "GET",
    path: "/drills/sessions/:id",
    params: p("id"),
    res: D.DrillSessionDetailSchema,
  },

  // --- Wave 4 additions (docs/design/wave4.md §5). Until the server engineer builds a handler, each answers
  // 501 `not_implemented` (`WAVE4_ENDPOINTS`; routes.test.ts keeps the list of those still pending). ---
  /** A multi-session capstone's sessions: status, draft, X1's phrase and stage checks. */
  "capstones.sessions": {
    method: "GET",
    path: "/capstones/:id/sessions",
    params: p("id"),
    res: D.CapstoneSessionsSchema,
  },
  /** Save the draft of a capstone session (the session's Make). */
  "capstones.saveDraft": {
    method: "POST",
    path: "/capstones/:id/drafts",
    params: p("id"),
    body: D.CapstoneDraftSaveSchema,
    res: D.CapstoneSessionsSchema,
  },
  /** Record one transcribe-capstone check (an X1 phrase, or a stage of its chords) graded in the browser. */
  "capstones.recordCheck": {
    method: "POST",
    path: "/capstones/:id/checks/:checkId",
    params: p("id", "checkId"),
    body: D.CapstoneCheckRecordSchema,
    res: D.CapstoneSessionsSchema,
  },
  /** What a capstone needs to open and what is met (X1: "Two more gym sets open X1"). */
  "capstones.gate": {
    method: "GET",
    path: "/capstones/:id/gate",
    params: p("id"),
    res: D.CapstoneGateSchema,
  },
  /** Edit a release's liner notes; choose whether the review's liner note shows. */
  "album.patchVersion": {
    method: "PATCH",
    path: "/album/tracks/:id/versions/:v",
    params: p("id", "v"),
    body: D.AlbumVersionPatchSchema,
    res: D.AlbumTrackVersionSchema,
  },
  /** Attach a submitted capstone review to a version. */
  "album.attachReview": {
    method: "PUT",
    path: "/album/tracks/:id/versions/:v/review",
    params: p("id", "v"),
    body: D.AlbumReviewAttachSchema,
    res: D.AlbumTrackVersionSchema,
  },
  /** Submitted reviews of a subject (capstone or transcription), newest first. */
  "tutor.reviews": {
    method: "GET",
    path: "/tutor/reviews",
    query: SubjectRefSchema,
    res: list(D.ReviewRecordSchema),
  },
  /** Remember a project's player settings (rate, transposition, fine-tune, loop) and notes. */
  "transcriptions.putSettings": {
    method: "PUT",
    path: "/transcriptions/:id/settings",
    params: p("id"),
    body: D.TranscriptionSettingsPatchSchema,
    res: D.TranscriptionSchema,
  },
  /** The ladder: level, realism, history, graded passes, an offered level-up. */
  "ladder.get": { method: "GET", path: "/ladder", res: D.LadderStateSchema },
  /** Take an offered level-up or move down a level. */
  "ladder.setLevel": {
    method: "PUT",
    path: "/ladder",
    body: D.LadderLevelSetSchema,
    res: D.LadderStateSchema,
  },
  /** The next generated item (L1–L4 from a seed), created as a `generated` project. */
  "ladder.next": { method: "POST", path: "/ladder/items", body: D.LadderNextSchema, res: D.LadderItemSchema },
  /** Grade a ladder answer exactly on the server; updates realism and graded passes. */
  "ladder.submit": {
    method: "POST",
    path: "/ladder/items/:id/submissions",
    params: p("id"),
    body: D.LadderSubmitSchema,
    res: D.LadderSubmitResultSchema,
  },
  /** The gym slot rule's state and the next gym session. */
  "gym.plan": { method: "GET", path: "/gym", res: D.GymPlanSchema },
  /** The U05.L07 voice-leading gate that unlocks `voicing()`, `rhodes` and `organ`. */
  "gates.voicing": { method: "GET", path: "/gates/voicing", res: D.VoicingGateSchema },

  // --- Wave 5 additions (docs/design/wave5.md §5). Until the server engineer builds a handler, each answers
  // 501 `not_implemented` (`WAVE5_ENDPOINTS`; routes.test.ts keeps the list of those still pending). ---
  /** The optional side lessons A1.L01–L04: state, and the one Today would offer. */
  "sideLessons.list": { method: "GET", path: "/side-lessons", res: D.SideLessonsSchema },
  /** The repertoire pool of ladder levels L5 and L6, with what the learner has passed. */
  "ladder.songs": { method: "GET", path: "/ladder/songs", res: list(D.LadderSongSchema) },
  /** Confirm an imported transcription version as the learner's own after a strict lint (carry-over c2). */
  "transcriptions.confirmVersion": {
    method: "POST",
    path: "/transcriptions/:id/versions/:v/confirm",
    params: p("id", "v"),
    body: D.TranscriptionVersionConfirmSchema,
    res: D.TranscriptionVersionSchema,
  },

  // --- Wave 6 additions (docs/design/wave6.md §5). Until the server engineer builds a handler, each answers
  // 501 `not_implemented` (`WAVE6_ENDPOINTS`; routes.test.ts keeps the list of those still pending). ---
  /** The advanced tracks (J, R, A): their gates as recorded, what is done, what Today may plan (contracts §4.3). */
  "tracks.list": { method: "GET", path: "/tracks", res: D.TracksSchema },
  /** Where the core stands, what the learner can now do and what stays open after it (the end of the core). */
  "course.completion": { method: "GET", path: "/course/completion", res: D.CoreCompletionSchema },
  /** The learner's latest saved Make sketch of a lesson (d15: a Make that builds on an earlier lesson's sketch). */
  "lessons.sketch": {
    method: "GET",
    path: "/lessons/:id/sketch",
    params: p("id"),
    res: D.LessonSketchSchema,
  },
  /** Record another take of an album version; the earlier takes are kept and stay playable (d20). */
  "album.addTake": {
    method: "POST",
    path: "/album/tracks/:id/versions/:v/takes",
    params: p("id", "v"),
    query: z.strictObject({ durationS: z.string().optional() }),
    body: "binary",
    res: D.AlbumTrackVersionSchema,
  },
  /** Choose the take that plays by default and is exported. */
  "album.chooseTake": {
    method: "PUT",
    path: "/album/tracks/:id/versions/:v/take",
    params: p("id", "v"),
    body: D.AlbumTakeChooseSchema,
    res: D.AlbumTrackVersionSchema,
  },
  // --- Wave 7 additions (docs/design/wave7.md §5). Until the server engineer builds a handler, each answers
  // 501 `not_implemented` (`WAVE7_ENDPOINTS`; routes.test.ts keeps the list of those still pending). ---
  /** The learner's choice between the core and the tracks (contracts §2.6; default `core`). */
  "tracks.focus": { method: "GET", path: "/tracks/focus", res: D.TrackFocusSchema },
  /** Choose where the New block comes from: the core (default) or one open track. Idempotent. */
  "tracks.setFocus": {
    method: "PUT",
    path: "/tracks/focus",
    body: D.TrackFocusSetSchema,
    res: D.TrackFocusSchema,
  },
  /** The whole course (259 sessions): its stage, the tracks, Side A and B, what stays open after it. */
  "course.whole": { method: "GET", path: "/course/whole", res: D.WholeCourseSchema },
  /** Exactly what a released album version plays, for "Export" (rendered offline in the browser; carry f2). */
  "album.source": {
    method: "GET",
    path: "/album/tracks/:id/versions/:v/source",
    params: p("id", "v"),
    res: D.AlbumSourceSchema,
  },

  // --- Unit songs (docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.4): each unit is one song the learner
  // takes over lesson by lesson. Every write answers the song as it now stands. ---
  /** The learner's songs (started, open or released), in course order, without their takes. */
  "songs.list": { method: "GET", path: "/songs", res: list(D.UnitSongSummarySchema) },
  /** A unit's song with its takes and their code; `status: "new"` while the learner has not started it. */
  "songs.get": { method: "GET", path: "/songs/:unitId", params: unitParams, res: D.UnitSongDetailSchema },
  /** Start the unit's song in a style (the New song moment); also records the unit's earlier Makes (backfill). */
  "songs.start": {
    method: "POST",
    path: "/songs/:unitId/start",
    params: unitParams,
    body: D.UnitSongStartSchema,
    res: D.UnitSongDetailSchema,
  },
  /** Change the song's style: the takes stay, Oak's parts switch style; a release keeps its own. */
  "songs.setFlavour": {
    method: "POST",
    path: "/songs/:unitId/flavour",
    params: unitParams,
    body: D.UnitSongFlavourSetSchema,
    res: D.UnitSongDetailSchema,
  },
  "songs.rename": {
    method: "POST",
    path: "/songs/:unitId/title",
    params: unitParams,
    body: D.UnitSongRenameSchema,
    res: D.UnitSongDetailSchema,
  },
  /** The one-time style card of a backfilled song was seen. */
  "songs.ackStyle": {
    method: "POST",
    path: "/songs/:unitId/style-seen",
    params: unitParams,
    res: D.UnitSongDetailSchema,
  },
  /** A take Make saved (after `sketches.create`): the cells its code claims. Idempotent per key and per version. */
  "songs.recordTake": {
    method: "POST",
    path: "/songs/:unitId/takes",
    params: unitParams,
    body: D.UnitSongTakeCreateSchema,
    res: D.UnitSongDetailSchema,
  },
  /** Release (or release again) to the album as a frozen snapshot; refused until the song's `releaseAfter` is done. */
  "songs.release": {
    method: "POST",
    path: "/songs/:unitId/release",
    params: unitParams,
    body: D.UnitSongReleaseRequestSchema,
    res: D.UnitSongReleaseResultSchema,
  },
  /** A release exactly as it was frozen: what album playback and export compose. */
  "songs.snapshot": {
    method: "GET",
    path: "/songs/:unitId/releases/:releaseId",
    params: z.strictObject({
      unitId: unitParams.shape.unitId,
      releaseId: z.string().regex(/^[1-9]\d{0,9}$/),
    }),
    res: D.UnitSongSnapshotSchema,
  },
} as const satisfies Record<string, EndpointDef>;

/** The unit song endpoints (spec 2026-11-24 §5.4). */
export const UNIT_SONG_ENDPOINTS = [
  "songs.list",
  "songs.get",
  "songs.start",
  "songs.setFlavour",
  "songs.rename",
  "songs.ackStyle",
  "songs.recordTake",
  "songs.release",
  "songs.snapshot",
] as const satisfies readonly (keyof typeof contract)[];

/**
 * The Wave 7 endpoints of docs/design/wave7.md §5. Each answers a typed 501 until built; `routes.test.ts` lists the
 * ones still pending (`WAVE7_PENDING`), and the server engineer removes a name there as each lands.
 */
export const WAVE7_ENDPOINTS = [
  "tracks.focus",
  "tracks.setFocus",
  "course.whole",
  "album.source",
] as const satisfies readonly (keyof typeof contract)[];

/**
 * The Wave 6 endpoints of docs/design/wave6.md §5. Each answers a typed 501 until built; `routes.test.ts` lists the
 * ones still pending (`WAVE6_PENDING`), and the server engineer removes a name there as each lands.
 */
export const WAVE6_ENDPOINTS = [
  "tracks.list",
  "course.completion",
  "lessons.sketch",
  "album.addTake",
  "album.chooseTake",
] as const satisfies readonly (keyof typeof contract)[];

/**
 * The Wave 5 endpoints of docs/design/wave5.md §5. Each answers a typed 501 until built; `routes.test.ts` lists the
 * ones still pending (`WAVE5_PENDING`), and the server engineer removes a name there as each lands.
 */
export const WAVE5_ENDPOINTS = [
  "sideLessons.list",
  "ladder.songs",
  "transcriptions.confirmVersion",
] as const satisfies readonly (keyof typeof contract)[];

/**
 * The Wave 4 endpoints of docs/design/wave4.md §5. Each answers a typed 501 until built; `routes.test.ts`
 * lists the ones still pending (`WAVE4_PENDING`), and the server engineer removes a name there as each lands.
 */
export const WAVE4_ENDPOINTS = [
  "capstones.sessions",
  "capstones.saveDraft",
  "capstones.recordCheck",
  "capstones.gate",
  "album.patchVersion",
  "album.attachReview",
  "tutor.reviews",
  "transcriptions.putSettings",
  "ladder.get",
  "ladder.setLevel",
  "ladder.next",
  "ladder.submit",
  "gym.plan",
  "gates.voicing",
] as const satisfies readonly (keyof typeof contract)[];

/**
 * The Wave 3 endpoints of docs/design/wave3.md §5. Each answers a typed 501 until built; `routes.test.ts`
 * lists the ones still pending, and the server engineer removes a name there as each handler lands.
 */
export const WAVE3_ENDPOINTS = [
  "session.day",
  "voice.get",
  "voice.quiet",
  "voice.ladder",
  "drills.get",
] as const satisfies readonly (keyof typeof contract)[];

/** The Wave 2 endpoints of docs/design/wave2.md §4. All are built now (routes.test.ts checks none answers 501). */
export const WAVE2_ENDPOINTS = [
  "session.summary",
  "lessons.steps",
  "lessons.position",
  "capstones.release",
  "unlocks.next",
  "skills.revive",
  "onboarding.get",
  "onboarding.put",
  "profile.calibrations",
  "dev.listen",
  "dev.listenMark",
] as const satisfies readonly (keyof typeof contract)[];

export type Contract = typeof contract;
export type EndpointName = keyof Contract;
export const ENDPOINT_NAMES = Object.keys(contract) as EndpointName[];

type DefOf<N extends EndpointName> = Contract[N];
type ParamsOf<Def> = Def extends { params: infer P extends z.ZodType } ? { params: z.input<P> } : unknown;
type QueryOf<Def> = Def extends { query: infer Q extends z.ZodType } ? { query?: z.input<Q> } : unknown;
type BodyOf<Def> = Def extends { body: infer B extends z.ZodType }
  ? { body: z.input<B> }
  : Def extends { body: "binary" }
    ? { body: Blob | ArrayBuffer | Uint8Array; contentType?: string }
    : unknown;

/** What a caller passes for endpoint `N`: `params`, `query` and `body` as the contract declares them. */
export type EndpointInput<N extends EndpointName> = ParamsOf<DefOf<N>> & QueryOf<DefOf<N>> & BodyOf<DefOf<N>>;
/** What endpoint `N` returns: the parsed JSON, or the raw `Response` for binary endpoints. */
export type EndpointOutput<N extends EndpointName> = DefOf<N>["res"] extends infer R
  ? R extends z.ZodType
    ? z.output<R>
    : R extends "binary"
      ? Response
      : never
  : never;
/** What a server handler receives after validation. */
export type HandlerInput<N extends EndpointName> = (DefOf<N> extends { params: infer P extends z.ZodType }
  ? { params: z.output<P> }
  : unknown) &
  (DefOf<N> extends { query: infer Q extends z.ZodType } ? { query: z.output<Q> } : unknown) &
  (DefOf<N> extends { body: infer B extends z.ZodType } ? { body: z.output<B> } : unknown);

export type SseEndpointName = {
  [N in EndpointName]: DefOf<N>["res"] extends "sse" ? N : never;
}[EndpointName];
export type JsonEndpointName = Exclude<EndpointName, SseEndpointName>;
export type ConfirmEndpointName = {
  [N in EndpointName]: DefOf<N> extends { confirm: string } ? N : never;
}[EndpointName];

/** Header names of contracts §11. */
export const HEADERS = { oak: "X-Oak", confirm: "X-Oak-Confirm" } as const;
export const API_PREFIX = "/api";
/** The server binds 127.0.0.1:8787 only; in dev Vite on 5173 proxies /api and /sounds to it. */
export const PORTS = { api: 8787, vite: 5173 } as const;
export const ALLOWED_HOSTS = ["127.0.0.1:8787", "localhost:8787"] as const;
export const ALLOWED_DEV_HOSTS = ["127.0.0.1:5173", "localhost:5173"] as const;

/** Path parameter names of a contract path, in order. */
export function pathParams(path: string): string[] {
  return [...path.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1] as string);
}

/** `/api` + the path with its parameters filled in and the query appended. */
export function buildPath(
  def: Pick<EndpointDef, "path">,
  params: Record<string, string> = {},
  query: Record<string, string | undefined> = {},
): string {
  const path = def.path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_m, name: string) => {
    const value = params[name];
    if (value === undefined || value === "")
      throw new Error(`missing path parameter "${name}" for ${def.path}`);
    // A URL parser resolves `.` and `..` (also as %2E) as dot segments: `/sketches/..` would be another
    // endpoint. No Oak ID is all dots.
    if (/^(?:\.|%2e){1,2}$/i.test(value))
      throw new Error(`path parameter "${name}" cannot be "${value}" for ${def.path}`);
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined) search.set(k, v);
  const qs = search.toString();
  return `${API_PREFIX}${path}${qs ? `?${qs}` : ""}`;
}
