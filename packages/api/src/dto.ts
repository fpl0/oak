// Shared domain DTOs: what crosses the wire between the app and the server. Each is a zod schema plus
// its inferred type. Field names are camelCase; the SQLite columns they come from are in
// docs/design/interfaces.md. Absent values are `null` in responses (never a missing key).
import {
  DEGREES,
  FLAVOUR_IDS,
  type LearnerProfile,
  schemas,
  type TrackId,
  type UnitSongDef,
} from "@oak/content-kit";
import { z } from "zod";
import {
  BACKEND_IDS,
  CapstoneReviewSchema,
  RungSchema,
  SubjectRefSchema,
  TranscriptionReviewSchema,
  TUTOR_HEALTH,
  TutorSettingsSchema,
} from "./tutor.ts";

const {
  idSchema,
  SessionIdSchema,
  GradeResultSchema,
  AnswerSchema,
  KeySpecSchema,
  NEventSchema,
  AnalysisSummarySchema,
  PickupSpecSchema,
  SwingSpecSchema,
} = schemas;

// --- primitives ---------------------------------------------------------------------------------

/** ISO-8601 UTC instant, as stored (`2026-11-11T09:30:00.000Z`). */
export const Instant = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/, "expected an ISO-8601 UTC instant");
/** Learner-local calendar day after the 04:00 rollover, `YYYY-MM-DD`. */
export const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
/** Monday of a learner-local week, `YYYY-MM-DD`. */
export const WeekStart = Day;
export const TargetMinutesSchema = z.union([z.literal(15), z.literal(20), z.literal(25)]);
export const SingTolCentsSchema = z.union([z.literal(70), z.literal(50), z.literal(35), z.literal(25)]);
const flavour = z.enum(FLAVOUR_IDS);
const lessonId = idSchema("lesson");
const skillId = idSchema("skill");
const familyId = idSchema("family");
const checkpointId = idSchema("checkpoint");
const capstoneId = idSchema("capstone");
const canDoId = idSchema("canDo");
const termId = idSchema("term");
const unlockable = z.string().regex(/^(?:tb|snd|scale|chord)\./);
const meterId = z.enum(["4/4", "3/4", "2/4", "6/8", "9/8", "12/8", "5/4", "5/8", "7/8", "9/8i"]);

/** Error body of every non-2xx JSON response. */
export const ApiErrorBodySchema = z.object({
  error: z.object({
    /** `bad_request` 400 · `forbidden` 403 · `not_found` 404 · `conflict` 409 · `confirm_required` 428 · `internal` 500. */
    code: z.enum([
      "bad_request",
      "forbidden",
      "not_found",
      "conflict",
      "confirm_required",
      "payload_too_large",
      "unavailable",
      "internal",
      /** 501: a Wave 2 endpoint whose contract exists and whose handler is not built yet (docs/design/wave2.md §4). */
      "not_implemented",
    ]),
    message: z.string(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).exactOptional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
export const Ok = z.object({ ok: z.literal(true) });

// --- profile and settings -----------------------------------------------------------------------

export const OUTPUT_KINDS = ["wired", "bluetooth", "speakers", "unknown"] as const;
export const INPUT_KINDS = ["builtin", "external", "bluetooth", "none"] as const;

/** `learner_profile` (one row). MIDI numbers and milliseconds are `null` until calibrated. */
export const ProfileSchema = z.object({
  displayName: z.string().nullable(),
  /** IANA zone. The day rolls over at `rolloverHour` there. */
  timezone: z.string(),
  rolloverHour: z.number().int().min(0).max(23),
  targetMinutes: TargetMinutesSchema,
  weeklyGoal: z.number().int().min(3).max(7),
  flavour,
  vocalLowMidi: z.number().nullable(),
  vocalHighMidi: z.number().nullable(),
  comfortLowMidi: z.number().nullable(),
  comfortHighMidi: z.number().nullable(),
  singToleranceCents: SingTolCentsSchema,
  singTolMode: z.enum(["auto", "fixed"]),
  outputLatencyMs: z.number().nullable(),
  inputLatencyMs: z.number().nullable(),
  singLatencyMs: z.number().nullable(),
  tapLatencyMs: z.number().nullable(),
  tapJitterMs: z.number().nullable(),
  visualOffsetMs: z.number(),
  outputKind: z.enum(OUTPUT_KINDS),
  inputKind: z.enum(INPUT_KINDS),
  inputDeviceId: z.string().nullable(),
  noiseFloorDb: z.number().nullable(),
  /** Quiet mode for today, or always when no usable mic is found. */
  quiet: z.boolean(),
  /** Numbers until U03.L08 introduces syllables. */
  solfege: z.enum(["numbers", "syllables"]),
  onboardedAt: Instant.nullable(),
  createdAt: Instant,
});
export type Profile = z.infer<typeof ProfileSchema>;
export const ProfilePatchSchema = ProfileSchema.omit({ createdAt: true }).partial().strict();
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

/** The grader's and drill generators' view of the profile, with defaults where nothing is calibrated yet. */
export function toLearnerProfile(p: Profile): LearnerProfile {
  const low = p.vocalLowMidi ?? 48;
  const high = p.vocalHighMidi ?? 72;
  return {
    rangeLow: low,
    rangeHigh: high,
    comfLow: p.comfortLowMidi ?? low + 2,
    comfHigh: p.comfortHighMidi ?? high - 2,
    tapLatencyMs: p.tapLatencyMs ?? 0,
    tapJitterMs: p.tapJitterMs ?? 0,
    singLatencyMs: p.singLatencyMs ?? 0,
    singTolCents: p.singToleranceCents,
    singTolMode: p.singTolMode,
    noiseFloorDb: p.noiseFloorDb ?? -60,
    outputKind: p.outputKind,
    inputKind: p.inputKind,
    quiet: p.quiet,
  };
}

export const CALIBRATION_KINDS = [
  "output",
  "noise",
  "bleed",
  "tap-latency",
  "sing-latency",
  "range",
  "pitch-match",
] as const;
/** One step of the set-up wizard (contracts §8.6). The server stores the run and updates the profile. */
export const CalibrationRunSchema = z.strictObject({
  kind: z.enum(CALIBRATION_KINDS),
  /** Raw measurements: tap offsets in ms, noise floor in dBFS, range in MIDI, ... */
  result: z.record(z.string(), z.unknown()),
  /** Profile fields this run sets. */
  patch: ProfilePatchSchema,
});
export type CalibrationRun = z.infer<typeof CalibrationRunSchema>;

/** The note-label lenses (Wave 3). Each is the learner's preference; the unlock gate is applied on top. */
export const LensPrefsSchema = z.strictObject({
  /** 1-based scale degrees with ♭/♯ ("1", "♭3"). Gated by tb.feature.degree-labels (U03.L02). */
  degrees: z.boolean(),
  /** Movable-do syllables ("do", "me"). Gated by tb.feature.solfege (U03.L08). */
  solfege: z.boolean(),
  /** Spelled note names ("F♯4"). Never gated. */
  noteNames: z.boolean(),
  /**
   * Wave 4 (docs/design/wave4.md §4.3): lead-sheet chord symbols on the roll's chord band and above the staff.
   * Absent = on. Gated by the chord-symbol unlock of U05.L04.
   */
  chordSymbols: z.boolean().optional(),
  /** Wave 4: Roman numerals under the staff and on the chord band. Absent = on. Gated by tb.feature.rn (U06.L02). */
  romanNumerals: z.boolean().optional(),
  /**
   * Wave 5 (docs/design/wave5.md §4.3): the section ribbon over the roll and the staff (from `arrange()`). Absent = on.
   * Gated by tb.lens.form (U09.L02).
   */
  sections: z.boolean().optional(),
  /** Wave 5: root / fifth / octave / approach marks on the bass line. Absent = on. Gated by the bass-role unlock (U08). */
  bassRoles: z.boolean().optional(),
  /** Wave 5: blue notes (♭3 ♭5 ♭7 against a major key) marked on roll and staff. Absent = on. Gated by scale.blues (U11.L03). */
  blueNotes: z.boolean().optional(),
  /**
   * Wave 6 (docs/design/wave6.md §4.3): the 3rd and the 7th of each chord marked on roll and staff, and the line
   * they make through the changes. Absent = on. Gated by the seventh-chord unlock (U12).
   */
  guideTones: z.boolean().optional(),
  /** Wave 6: the key in force along the timeline when a piece changes key. Absent = on. Gated by tb.scale.patterned. */
  keyPlan: z.boolean().optional(),
  /** Wave 6: the beat grid of a compound meter, or of triplets, on the roll. Absent = on. Gated by U13.L04 / L05. */
  beatGrid: z.boolean().optional(),
  /**
   * Wave 7 (docs/design/wave7.md §4.3): the advanced tracks' lenses, each absent = on and shown only once its
   * lesson or tool has opened it (`TRACK_LENS_GATES` in app/src/lib/lenses.ts): the 9, 11 and 13 of each melody
   * note against its chord with avoid notes marked; the type of each voicing; the chord-scale of each chord; the
   * two-bar clave grid; polyrhythm and polymeter lanes on the roll; how far each onset sits from the grid; register
   * bands on the spectrum panel; a density strip per section.
   */
  tensions: z.boolean().optional(),
  voicings: z.boolean().optional(),
  chordScales: z.boolean().optional(),
  clave: z.boolean().optional(),
  polyLanes: z.boolean().optional(),
  microtiming: z.boolean().optional(),
  registers: z.boolean().optional(),
  density: z.boolean().optional(),
});
export type LensPrefs = z.infer<typeof LensPrefsSchema>;
export const LENS_IDS = ["degrees", "solfege", "noteNames"] as const;
export type LensId = (typeof LENS_IDS)[number];
/** Wave 4: the chord-label lenses, kept apart from the note-label ones so note-lens switches stay as they are. */
export const CHORD_LENS_IDS = ["chordSymbols", "romanNumerals"] as const;
export type ChordLensId = (typeof CHORD_LENS_IDS)[number];
/** Wave 5: the form and line lenses (sections, bass roles, blue notes), stored beside the others. */
export const LINE_LENS_IDS = ["sections", "bassRoles", "blueNotes"] as const;
export type LineLensId = (typeof LINE_LENS_IDS)[number];
/** Wave 6: the harmony and time lenses of U12–U17 (guide tones, the key plan, the compound / triplet beat grid). */
export const MUSIC_LENS_IDS = ["guideTones", "keyPlan", "beatGrid"] as const;
export type MusicLensId = (typeof MUSIC_LENS_IDS)[number];
/** Wave 7: the advanced tracks' lenses (jazz harmony, rhythm, sound), stored beside the others. */
export const TRACK_LENS_IDS = [
  "tensions",
  "voicings",
  "chordScales",
  "clave",
  "polyLanes",
  "microtiming",
  "registers",
  "density",
] as const;
export type TrackLensId = (typeof TRACK_LENS_IDS)[number];

/** `settings` rows by key. `PUT /api/settings/:key` validates the value with this shape's entry. */
export const SettingsSchema = z.object({
  theme: z.enum(["paper", "bark"]),
  /** Master output, 0 to 1. */
  volume: z.number().min(0).max(1),
  clickVolume: z.number().min(0).max(1),
  rollLabels: z.enum(["auto", "note", "degree", "degree+solfege"]),
  editorFontSize: z.number().int().min(11).max(24),
  /** Weeks marked paused ("Pause Oak"), at most 4. */
  pausedWeeks: z.array(WeekStart).max(4),
  /** The next-lesson teaser is opt-in after the second week. */
  teaserOptIn: z.boolean(),
  /** Whether the liner note of a tutor review appears in the album by default. */
  linerNotesInAlbum: z.boolean(),
  tutor: TutorSettingsSchema,
  /** Include audio in `.oakbackup` exports by default. */
  backupWithAudio: z.boolean(),
  /**
   * Wave 3 lenses (docs/design/wave3.md §4.3): the learner's choice of note labels in the Workbench, drills and
   * answer widgets. A lens shows only once its tool is unlocked (`degrees`: tb.feature.degree-labels, `solfege`:
   * tb.feature.solfege); `app/src/lib/lenses.ts` applies the gate. A lesson step's `ui.rollLabels` wins inside it.
   */
  lenses: LensPrefsSchema,
  /**
   * Wave 3: the album's name (ux §5.3: printed on every cover and heading /album; editable). `null` until the
   * learner names it (the app then prints "Oak Sessions"). Optional in the type so Wave 2 settings objects still
   * type-check; the server always answers it (default `null`).
   */
  albumTitle: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[^\p{Cc}]*$/u, "no control characters")
    .nullable()
    .optional(),
  /**
   * The desktop app asks GitHub once a day whether a newer Oak is out (`GET /api/app/update`). On by default; optional
   * in the type so older settings objects still type-check; the server always answers it.
   */
  checkForUpdates: z.boolean().optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;
export type SettingKey = keyof Settings;
export const SETTING_KEYS = Object.keys(SettingsSchema.shape) as SettingKey[];
export const DEFAULT_SETTINGS: Settings = {
  theme: "paper",
  volume: 0.8,
  clickVolume: 0.6,
  rollLabels: "auto",
  editorFontSize: 15,
  pausedWeeks: [],
  teaserOptIn: false,
  linerNotesInAlbum: true,
  tutor: { backend: "auto", softMonthlyUsd: 25, softWarnedMonth: null },
  backupWithAudio: true,
  lenses: { degrees: true, solfege: true, noteNames: false },
  albumTitle: null,
  checkForUpdates: true,
};

export const HealthSchema = z.object({
  ok: z.literal(true),
  appVersion: z.string(),
  contractsVersion: z.string(),
  schemaVersion: z.number(),
  contentVersion: z.string().nullable(),
  tutor: z.enum(TUTOR_HEALTH),
  /** The backend the selection order picked; `null` when the tutor is off. */
  tutorBackend: z.enum(BACKEND_IDS).nullable(),
  /** `OAK_DEV=1`: `/dev/*` routes and `/api/dev/*` endpoints exist. */
  dev: z.boolean(),
});
export type Health = z.infer<typeof HealthSchema>;

/** A link to Oak's GitHub releases (the only place an update notice may point). */
const ReleaseLink = z.string().regex(/^https:\/\/github\.com\/fpl0\/oak\/releases\//i);
/**
 * `GET /api/app/update`: a newer Oak than this desktop app, from GitHub's latest release (checked at most once a
 * day; server/src/services/app-update.ts). The endpoint answers `null` when there is none, when the check is off,
 * offline, or when the server is not the desktop app's.
 */
export const AppUpdateSchema = z.object({
  /** This app's version (`OAK_APP_VERSION`). */
  current: z.string(),
  /** The newer release's version, without the `v`. */
  latest: z.string(),
  /** The DMG to download, or the release page when the release has none. */
  url: ReleaseLink,
  /** The release page with its notes. */
  notesUrl: ReleaseLink,
});
export type AppUpdate = z.infer<typeof AppUpdateSchema>;

/** Answer of `POST /api/settings/anthropic-key`, after one minimal validation call. */
export const KeyStatusSchema = z.object({
  status: z.enum(TUTOR_HEALTH),
  source: z.enum(["env", "pasted", "none"]),
});
export type KeyStatus = z.infer<typeof KeyStatusSchema>;

// --- unlocks, can-do, terms ---------------------------------------------------------------------

export const UNLOCK_KINDS = ["tool", "sound", "scale", "chord", "feature", "template", "lens"] as const;
/** `unlocks` row. Rows are never deleted. */
export const UnlockSchema = z.object({
  itemId: unlockable,
  kind: z.enum(UNLOCK_KINDS),
  /** The session that granted it, or `backfill` (contracts §11.7 rule 5). */
  sourceKind: z.enum(["session-complete", "session-start", "fallback", "backfill"]),
  sourceId: z.string(),
  unlockedAt: Instant,
  /** False until its Coda ceremony was shown. */
  seen: z.boolean(),
});
export type Unlock = z.infer<typeof UnlockSchema>;

export const CANDO_STATUSES = ["emerging", "solid", "strong", "fading"] as const;
/** `cando_ledger` is a status history; the current status is the latest row. */
export const CanDoEntrySchema = z.object({
  candoId: canDoId,
  status: z.enum(CANDO_STATUSES),
  evidenceKind: z.enum(["sketch", "track", "lesson", "checkpoint", "set", "transcription"]),
  evidenceId: z.string(),
  at: Instant,
});
export type CanDoEntry = z.infer<typeof CanDoEntrySchema>;

export const TermIntroducedSchema = z.object({ termId, lessonId, at: Instant });
export type TermIntroduced = z.infer<typeof TermIntroducedSchema>;

// --- streak (contracts §7.8) --------------------------------------------------------------------

export const STREAK_DAY_SOURCES = [
  "review",
  "sketch",
  "keepalive",
  "session",
  "repair",
  "rest",
  "banked-rest",
  "paused",
] as const;
export const StreakDaySchema = z.object({
  day: Day,
  qualified: z.boolean(),
  source: z.enum(STREAK_DAY_SOURCES),
  /** Everything that qualified the day. */
  kinds: z.array(z.enum(["review", "sketch", "keepalive"])),
  minutes: z.number(),
  reviewSets: z.number(),
  sketchSaved: z.boolean(),
});
export type StreakDay = z.infer<typeof StreakDaySchema>;
export const STREAK_WEEK_STATUSES = [
  "open",
  "met",
  "met-banked",
  "met-repaired",
  "tie-open",
  "missed",
  "paused",
] as const;
export const StreakWeekSchema = z.object({
  weekStart: WeekStart,
  goal: z.number().int(),
  qualifyingDays: z.number().int(),
  bankedUsed: z.number().int(),
  repairedDays: z.number().int(),
  status: z.enum(STREAK_WEEK_STATUSES),
});
export type StreakWeek = z.infer<typeof StreakWeekSchema>;
export const StreakSummarySchema = z.object({
  /** Consecutive weeks that met the goal. The running week never breaks it before it ends. */
  weeks: z.number().int(),
  longestWeeks: z.number().int(),
  weeklyGoal: z.number().int(),
  /** This week: goal (first week: the pro-rated goal), days so far, and each day. */
  thisWeek: StreakWeekSchema.extend({ days: z.array(StreakDaySchema) }),
  /** Unspent banked rests, at most 2. */
  bankedRests: z.number().int().min(0).max(2),
  /** An open tie on last week: any qualifying activity before `until` also repairs one of its days. */
  repair: z.object({ weekStart: WeekStart, missingDays: z.number().int(), until: Instant }).nullable(),
  /** Secondary numbers, shown small; no rules, no rewards. */
  totalDays: z.number().int(),
  currentRunDays: z.number().int(),
  todayQualified: z.boolean(),
});
export type StreakSummary = z.infer<typeof StreakSummarySchema>;

// --- skills and mastery (contracts §7.5, §7.10) -------------------------------------------------

export const MASTERY_LEVELS = ["new", "available", "learning", "practiced", "mastered"] as const;
export const DEBT_REASONS = ["soft-pass", "production-lag", "checkpoint-level"] as const;
/** `skill_state` row plus what the map needs to draw the node. */
export const SkillStateSchema = z.object({
  skillId,
  /** Performance, shrunk toward 0.5. */
  P: z.number(),
  /** Weighted retrievability of linked cards; `null` when it has none (or only paused ones). */
  R: z.number().nullable(),
  /** Distinct days in the last 60 with an evidence item ≥ 0.8. */
  D: z.number().int(),
  /** Strength M = P · R, for display and planning. */
  M: z.number(),
  level: z.enum(MASTERY_LEVELS),
  debt: z.boolean(),
  debtReason: z.enum(DEBT_REASONS).nullable(),
  provisional: z.boolean(),
  /** Production node with no mic. */
  paused: z.boolean(),
  /** Freshness F_node, 0 to 1; `opacity = 0.35 + 0.65 · F`. */
  freshness: z.number(),
  /** Its stale cards are in today's planned warm-up: draw it drying, with "Revive". */
  drying: z.boolean(),
  updatedAt: Instant,
  /**
   * Wave 7 (carry f1; docs/design/wave7.md §5.6): when the skill was first introduced to this learner (the first
   * evidence from its introducing lesson, or the backfilled completion of that lesson), never changed afterwards.
   * The illustrated Oak marks a leaf "newly learned" for 48 hours after it. `updatedAt` is when the state was last
   * recalculated and is NOT an introduction date. `null` while the skill is not introduced; absent from an older
   * server.
   */
  introducedAt: Instant.nullable().optional(),
});
export type SkillState = z.infer<typeof SkillStateSchema>;
export const SkillMapSchema = z.object({ nodes: z.array(SkillStateSchema), reviveSec: z.number() });
export type SkillMap = z.infer<typeof SkillMapSchema>;

export const EVIDENCE_SOURCES = [
  "step",
  "retry",
  "predict",
  "checkpoint",
  "srs-set",
  "gym-set",
  "anchor-set",
  "rubric-rule",
  "self-transcription",
] as const;
/** `evidence` row. Weights are in contracts §7.5. */
export const EvidenceSchema = z.object({
  skillId,
  /** `E05/deg.6` when the evidence is on a category. */
  category: z.string().nullable(),
  at: Instant,
  day: Day,
  score: z.number().min(0).max(1),
  weight: z.number(),
  sourceKind: z.enum(EVIDENCE_SOURCES),
  sourceId: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// --- SRS (contracts §7.1 to §7.4) ---------------------------------------------------------------

export const CARD_KINDS = ["fact", "concept", "family", "composite"] as const;
export const CARD_STATUSES = ["active", "deferred", "graduated", "paused", "retired"] as const;
export const RATINGS = ["Again", "Hard", "Good", "Easy"] as const;
/** `srs_cards` row. `cardId` is the family, deck-card or fact ID. */
export const SrsCardSchema = z.object({
  cardId: z.string(),
  kind: z.enum(CARD_KINDS),
  status: z.enum(CARD_STATUSES),
  desiredRetention: z.number(),
  dueAt: Instant,
  /** ts-fsrs state: 0 New · 1 Learning · 2 Review · 3 Relearning. */
  state: z.number().int().min(0).max(3),
  stability: z.number(),
  difficulty: z.number(),
  reps: z.number().int(),
  lapses: z.number().int(),
  scheduledDays: z.number(),
  lastReviewAt: Instant.nullable(),
  /** Stored so a later model change can migrate by replay. */
  model: z.string(),
  /** Predicted recall right now. */
  retrievability: z.number(),
  introducedBy: z.string().nullable(),
  releasedAt: Instant.nullable(),
});
export type SrsCard = z.infer<typeof SrsCardSchema>;

/** `family_state` row: levels, per-category statistics and confusion pairs live here, not in cards. */
export const FamilyStateSchema = z.object({
  familyId,
  level: z.number().int().min(1),
  /** The day of the last set that counted towards promotion. */
  promoDay: Day.nullable(),
  categoryStats: z.record(
    z.string(),
    z.object({ n: z.number().int(), hits: z.number(), lastAt: Instant.nullable() }),
  ),
  /** `expected|got` → count. */
  confusion: z.record(z.string(), z.number().int()),
  /** Blocked-intro sets still to run before normal interleaving. */
  blockedRemaining: z.number().int(),
  compositeId: familyId.nullable(),
  graduatedAt: Instant.nullable(),
  /** Categories whose lesson is completed. */
  openCategories: z.array(z.string()),
  /** The highest level whose gate is open. */
  maxOpenLevel: z.number().int(),
  /**
   * Wave 3 (decision 27): the learner day this family began resting in its composite, below its mastery level,
   * or `null` when it is not resting. A resting family shows `graduatedAt` and `compositeId` like a graduated
   * one; it is still practised in mixed practice and returns to its own sets where it left off. Absent from a
   * server older than Wave 3.
   */
  restingSince: Day.nullable().optional(),
  /**
   * Wave 4 (docs/design/wave4.md §5): per-category hits of the learner's sung resolutions (a passed resolution is a
   * hit), the drill engine's `SetPlanInput.sungStats`. Only on FET families with sung resolutions; absent from a
   * server older than Wave 4 (the drills then fall back to `categoryStats`).
   */
  sungStats: z.record(z.string(), z.object({ n: z.number().int(), hits: z.number() })).optional(),
});
export type FamilyState = z.infer<typeof FamilyStateSchema>;

export const WARMUP_ITEM_KINDS = [
  "anchor",
  "repair",
  "family-set",
  "composite-set",
  "concept-set",
  "fact-set",
  "blocked-intro",
  "listen",
] as const;
/** One planned block of a warm-up or review session. */
export const WarmupItemSchema = z.object({
  id: z.string(),
  kind: z.enum(WARMUP_ITEM_KINDS),
  familyId: familyId.nullable(),
  /** Composite sets: the members sampled. Fact sets: empty. */
  members: z.array(familyId),
  cardIds: z.array(z.string()),
  level: z.number().int().nullable(),
  trials: z.number().int(),
  estSec: z.number(),
  mic: z.boolean(),
  /** Whether this set is rated (an anchor set is evidence only). */
  rated: z.boolean(),
});
export type WarmupItem = z.infer<typeof WarmupItemSchema>;
export const DueBatchSchema = z.object({
  budgetSec: z.number(),
  plannedSec: z.number(),
  items: z.array(WarmupItemSchema),
  /** "Today's review ≈ 5 min". Raw due counts are never shown. */
  label: z.string(),
  /** `/practice/review` may offer "a little more" in budget-sized blocks, up to 12 minutes in total. */
  moreAvailable: z.boolean(),
});
export type DueBatch = z.infer<typeof DueBatchSchema>;

/**
 * Wave 3 (docs/design/wave3.md §5.2): a client-generated key (`crypto.randomUUID()`) that makes a write
 * idempotent. The server stores the first response under the key and answers a repeat with that same
 * response, counting nothing twice (a double submit, two tabs, a retry after a lost response).
 */
export const IdempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,64}$/, "an idempotency key is 8 to 64 characters of [A-Za-z0-9_-]");

export const SrsReviewRequestSchema = z.strictObject({
  /** Wave 3: see `IdempotencyKeySchema`. Optional on the wire; the app always sends one. */
  idempotencyKey: IdempotencyKeySchema.optional(),
  cardId: z.string(),
  drillSessionId: z.string().nullable(),
  /** Fact cards: one answer. Families: the set's summary (the server recomputes it from the stored trials). */
  outcome: z.strictObject({
    meanCredit: z.number().min(0).max(1),
    medianRtMs: z.number().nonnegative(),
    extraReplays: z.number().int().nonnegative(),
    hintRung: RungSchema,
    revealed: z.boolean(),
    playedLevel: z.number().int().nullable(),
    meanAbsCents: z.number().nullable(),
  }),
});
export type SrsReviewRequest = z.infer<typeof SrsReviewRequestSchema>;
export const SrsReviewResultSchema = z.object({
  cardId: z.string(),
  /** `null`: a disputed attempt or a mic-less skip produces no rating. */
  rating: z.enum(RATINGS).nullable(),
  dueAt: Instant,
  scheduledDays: z.number(),
  status: z.enum(CARD_STATUSES),
  familyState: FamilyStateSchema.nullable(),
  /** Level change caused by this set, if any. */
  levelChange: z.enum(["promoted", "demoted"]).nullable(),
  graduated: z.boolean(),
});
export type SrsReviewResult = z.infer<typeof SrsReviewResultSchema>;

// --- drills -------------------------------------------------------------------------------------

export const DRILL_PURPOSES = [
  "srs",
  "practice",
  "lesson",
  "checkpoint",
  "gym",
  "anchor",
  "repair",
  "keepalive",
] as const;
export const DrillSessionCreateSchema = z.strictObject({
  sessionId: z.string().nullable(),
  purpose: z.enum(DRILL_PURPOSES),
  familyIds: z.array(familyId).min(1),
  /** The warm-up item this set fulfils, if any. */
  warmupItemId: z.string().nullable(),
});
export const DrillSessionSchema = z.object({
  id: z.string(),
  sessionId: z.string().nullable(),
  purpose: z.enum(DRILL_PURPOSES),
  familyIds: z.array(familyId),
  /** Seeds the generator: `mulberry32(hash(familyId, setId, trialIndex))`. */
  setId: z.string(),
  /** Level to generate at, per family (75% at this level, 25% one down). */
  levels: z.record(z.string(), z.number().int()),
  /** Categories the generator may sample, per family. */
  openCategories: z.record(z.string(), z.array(z.string())),
  /** Category to favour, per family (lowest recent accuracy). */
  focus: z.record(z.string(), z.string().nullable()),
  trialsPlanned: z.number().int(),
  startedAt: Instant,
  finishedAt: Instant.nullable(),
});
export type DrillSession = z.infer<typeof DrillSessionSchema>;
/** One sung note's summary (never audio): what `@oak/pitch` `gradeSung` measured. */
export const SungNoteSchema = z.strictObject({
  midi: z.number().nullable(),
  cents: z.number().nullable(),
  credit: z.number(),
});
export type SungNote = z.infer<typeof SungNoteSchema>;
/**
 * A sung resolution of a functional-ear trial (contracts §8.3, ux §4.2): the path from the answered degree to
 * the tonic (4→3→2→1, 5→6→7→1′), sung after Oak played it (levels 1–2) or before (level 3+). It never changes
 * the trial's identification credit; it is evidence for `fam.deg.resolve` and the tolerance ladder.
 */
export const SungResolutionSchema = z.strictObject({
  /** The degrees sung, in order, 1-based ("4", "3", "2", "1"). */
  path: z.array(z.enum(DEGREES)).min(1).max(8),
  order: z.enum(["play-first", "sing-first"]),
  notes: z.array(SungNoteSchema),
  /** Mean pitch credit of the notes (contracts §8.1 item 5). */
  credit: z.number().min(0).max(1),
  passed: z.boolean(),
  /** `Shift+S`: skipped (logged, no evidence, no penalty). */
  skipped: z.boolean(),
  /** Quiet mode: listened instead of sung (self-report, no voice evidence). */
  quiet: z.boolean(),
  /** The tolerance the notes were graded at. */
  tolCents: SingTolCentsSchema,
});
export type SungResolution = z.infer<typeof SungResolutionSchema>;

export const DrillTrialRecordSchema = z.strictObject({
  idx: z.number().int().nonnegative(),
  familyId,
  seed: z.number().int(),
  level: z.number().int(),
  category: z.string(),
  /** What was asked, minus events: enough to regenerate the trial from its seed. */
  params: z.record(z.string(), z.unknown()),
  response: z.strictObject({
    answer: AnswerSchema.nullable(),
    taps: z.array(z.number()).nullable(),
    /** Sung trials: the per-note summary, never audio. */
    sung: z
      .array(
        z.strictObject({ midi: z.number().nullable(), cents: z.number().nullable(), credit: z.number() }),
      )
      .nullable(),
    skipped: z.boolean(),
  }),
  credit: z.number().min(0).max(1),
  correct: z.boolean(),
  rtMs: z.number().nonnegative(),
  replays: z.number().int().nonnegative(),
  confusion: z.tuple([z.string(), z.string()]).nullable(),
  centsError: z.number().nullable(),
  at: Instant,
  // --- Wave 3 (docs/design/wave3.md §5.3); optional on the wire, the drill runner always sends them ---
  /** The learner asked to be shown the answer before answering: credit 0, no evidence (contracts §5.3 rung 4). */
  revealed: z.boolean().optional(),
  /**
   * How the trial was taken: `normal`; `quiet` (Quiet mode: a sung part replaced by listening or "hear it in
   * your head, then press Space", contracts §8.5: no voice evidence, no penalty); `fallback` (a mic kind shown
   * as its identify fallback).
   */
  modality: z.enum(["normal", "quiet", "fallback"]).optional(),
  /** FET trials: the sung resolution after the answer (contracts §8.3). `null` when none was asked. */
  sungResolution: SungResolutionSchema.nullable().optional(),
  /**
   * docs/design/retry.md §3: practice takes inside this trial after its first answer ("Try again"). Telemetry
   * only: the trial's credit, answer and sung resolution stay those of the first answer, and the server keeps the
   * first ones it stored whatever a re-post says.
   */
  retries: z.number().int().nonnegative().max(99).optional(),
});
export type DrillTrialRecord = z.infer<typeof DrillTrialRecordSchema>;
export const DrillFinishSchema = z.object({
  session: DrillSessionSchema,
  meanCredit: z.number(),
  medianRtMs: z.number(),
  reviews: z.array(SrsReviewResultSchema),
  evidence: z.array(EvidenceSchema),
  streak: StreakSummarySchema,
});
export type DrillFinish = z.infer<typeof DrillFinishSchema>;

// --- lessons, attempts, checkpoints, capstones --------------------------------------------------

export const LESSON_STATUSES = ["locked", "available", "in_progress", "completed"] as const;
export const LessonProgressSchema = z.object({
  lessonId,
  status: z.enum(LESSON_STATUSES),
  /** Local step ID (`S5`). */
  currentStep: z.string().nullable(),
  /** 15-minute target: `A` once part A is done and part B is pending. */
  splitPart: z.enum(["A", "B"]).nullable(),
  startedAt: Instant.nullable(),
  completedAt: Instant.nullable(),
  bestScore: z.number().nullable(),
  /** Lesson version at completion; new steps since then show a "new since you finished" dot. */
  completedVersion: z.number().int().nullable(),
  contentHash: z.string().nullable(),
  updatedAt: Instant,
});
export type LessonProgress = z.infer<typeof LessonProgressSchema>;

// --- Wave 6 shared shapes (docs/design/wave6.md §5): advanced-track gates, the end of the core, album takes ----
// Defined here because the progress, plan and summary schemas below carry them.

/** The advanced tracks of contracts §2.6. */
export const TRACK_IDS = ["J", "R", "A"] as const satisfies readonly TrackId[];
export const TRACK_TITLES: Readonly<Record<TrackId, string>> = {
  J: "Jazz Harmony",
  R: "Advanced Rhythm",
  A: "Arrangement & Sound",
};
/**
 * The lesson gates of contracts §4.3 (the capstone gates J.CP1 → JC1 and so on are capstone gates, `capstones.gate`).
 * A gate is met when every `requires` item is done: a checkpoint passed or soft-passed, a lesson completed. The
 * server RECORDS each gate the moment it is met (and at start-up for a learner already past it), whether or not the
 * lessons behind it exist yet: in Wave 6 no J or R lesson is authored, and the plan says so (`SessionPlan.tracks`).
 * `A.side` (A1.L01–L04, optional side lessons) is the Wave 5 gate `SIDE_LESSON_GATE`, listed for completeness.
 */
export const TRACK_GATES = [
  { gateId: "A.side", trackId: "A", requires: ["U03.L02"], opens: "A1.L01–L04", units: ["A1"] },
  { gateId: "A.sound", trackId: "A", requires: ["U09.CP"], opens: "A1.L05–L07", units: ["A1"] },
  { gateId: "A.arrangement", trackId: "A", requires: ["U10.CP"], opens: "A2", units: ["A2"] },
  {
    gateId: "J.main",
    trackId: "J",
    requires: ["U13.CP"],
    opens: "J1, J2.L01–L03, J3",
    units: ["J1", "J2", "J3"],
  },
  { gateId: "R.main", trackId: "R", requires: ["U13.CP"], opens: "R1–R3", units: ["R1", "R2", "R3"] },
  { gateId: "J.chord-scales", trackId: "J", requires: ["U14.CP"], opens: "J2.L04", units: ["J2"] },
  { gateId: "J.forms", trackId: "J", requires: ["U15.L06"], opens: "J4", units: ["J4"] },
  { gateId: "J.reharmonization", trackId: "J", requires: ["U17.CP"], opens: "J5", units: ["J5"] },
] as const satisfies readonly {
  gateId: string;
  trackId: TrackId;
  requires: readonly string[];
  opens: string;
  units: readonly string[];
}[];
export type TrackGateId = (typeof TRACK_GATES)[number]["gateId"];
/** One gate as the server reports it. */
export const TrackGateStateSchema = z.object({
  gateId: z.string(),
  trackId: z.enum(TRACK_IDS),
  /** What it opens, as the contracts name it: "J1, J2.L01–L03, J3". */
  opens: z.string(),
  requires: z.array(
    z.object({
      /** `U13.CP`, `U15.L06`. */
      ref: z.string(),
      kind: z.enum(["checkpoint", "lesson"]),
      /** Plain copy: "U13 checkpoint passed", "U15.L06 completed". */
      label: z.string(),
      met: z.boolean(),
    }),
  ),
  open: z.boolean(),
  /** When the gate was recorded as met; `null` while closed. */
  openedAt: Instant.nullable(),
  /** Lessons behind this gate that this content version ships, and how many the contracts list. */
  lessonsAuthored: z.number().int().nonnegative(),
  lessonsTotal: z.number().int().nonnegative(),
});
export type TrackGateState = z.infer<typeof TrackGateStateSchema>;
/** One advanced track: its gates, what is done, and what Today may plan from it. */
export const TrackStateSchema = z.object({
  trackId: z.enum(TRACK_IDS),
  title: z.string(),
  /** `open` once its first lesson gate is met (J and R: U13.CP; A: U03.L02). */
  status: z.enum(["locked", "open"]),
  openedAt: Instant.nullable(),
  gates: z.array(TrackGateStateSchema),
  /** Sessions done and in the track (contracts §2.6: J 34, R 20, A 20). */
  sessionsDone: z.number().int().nonnegative(),
  sessionsTotal: z.number().int().nonnegative(),
  /** The next lesson of the track the learner may start now; `null` when none is open or none is authored. */
  next: lessonId.nullable(),
  /**
   * The one honest line every surface shows for this track now: "Opens with the unit 13 checkpoint.", "Open. Its
   * first lessons are still being written.", "Next: J1.L01 Swing Feel & the Ride." Never a count of what is missing.
   */
  note: z.string(),
  /**
   * Wave 7 (docs/design/wave7.md §5.2). `nextSession`: the next thing of the track the learner may start now —
   * a lesson, the track checkpoint or a capstone session (`next` above stays the next LESSON only); `null` when
   * nothing of the track can be started. `focus`: the learner chose this track (`tracks.focus`). `checkpoints` and
   * `capstones`: the track's checkpoints and capstones with their status. All absent from an older server.
   */
  nextSession: z
    .object({
      kind: z.enum(["lesson", "checkpoint", "capstone"]),
      mapItemId: SessionIdSchema,
      title: z.string(),
      estMinutes: z.number().nonnegative(),
    })
    .nullable()
    .optional(),
  focus: z.boolean().optional(),
  checkpoints: z
    .array(
      z.object({
        cpId: checkpointId,
        status: z.enum(["locked", "open", "passed", "soft-passed", "failed"]),
      }),
    )
    .optional(),
  capstones: z
    .array(
      z.object({
        capstoneId,
        status: z.enum(["locked", "open", "in_progress", "released"]),
        lockedReason: z.string().nullable(),
      }),
    )
    .optional(),
});
export type TrackState = z.infer<typeof TrackStateSchema>;
/** `GET /tracks`. */
export const TracksSchema = z.object({ items: z.array(TrackStateSchema) });
export type Tracks = z.infer<typeof TracksSchema>;

/**
 * The end of the core (contracts §2.5, version 1.6: the core is complete at session 185; ux §5.5 M7). `stage`:
 * - `in-progress`: core lessons or checkpoints remain;
 * - `lessons-done`: every core lesson is completed and every core checkpoint passed or soft-passed, and at least one
 *   core capstone (C0–C7, X1, X2, CF-A, CF-T) is not released yet (a capstone never gates, contracts §7.6, so a
 *   learner can stand here for a while);
 * - `complete`: all of it, both finales released. `completedAt` is the instant the last piece landed.
 * The same object rides on `SessionSummary.coreComplete` in the Coda of the session that completed the core, once.
 */
export const CORE_STAGES = ["in-progress", "lessons-done", "complete"] as const;
export const CoreCompletionSchema = z.object({
  stage: z.enum(CORE_STAGES),
  completedAt: Instant.nullable(),
  /**
   * The session whose Coda carried the moment (its stored summary holds `coreComplete`), so the ending can be
   * reopened with that day's cards; `null` before the core is complete, or when no session's Coda carried it.
   */
  sessionId: z.string().nullable().optional(),
  /** Core map sessions done and in the core (lessons, checkpoints, capstone sessions, gym slots, CF-T). */
  sessionsDone: z.number().int().nonnegative(),
  sessionsTotal: z.number().int().positive(),
  /** What is still open, in map order (at most 12): the next lessons, an unpassed checkpoint, an unreleased capstone. */
  remaining: z.array(
    z.object({ kind: z.enum(["lesson", "checkpoint", "capstone"]), id: z.string(), title: z.string() }),
  ),
  /** The core-complete milestone of `content/milestones.ts` (ms.07), reached or not. */
  milestone: z
    .object({ id: z.string(), title: z.string(), description: z.string(), reachedAt: Instant.nullable() })
    .nullable(),
  /** The road behind, in the learner's own numbers. Never compared with a plan, never "days missed". */
  stats: z.object({
    firstDay: Day.nullable(),
    /** Learner days with a session, and sessions ended. */
    days: z.number().int().nonnegative(),
    sessions: z.number().int().nonnegative(),
    activeMinutes: z.number().nonnegative(),
    lessons: z.number().int().nonnegative(),
    /** Album tracks released on Side A, transcriptions finished (X1, X2, CF-T and graded ladder songs), sketches saved. */
    tracksReleased: z.number().int().nonnegative(),
    transcriptions: z.number().int().nonnegative(),
    sketches: z.number().int().nonnegative(),
  }),
  /**
   * What the learner can now do: one can-do statement per area (compose, transcribe, hear, write, read, code,
   * sing) at `solid` or `strong`, at most seven.
   */
  canDo: z.array(z.object({ candoId: canDoId, text: z.string(), status: z.enum(CANDO_STATUSES) })),
  /** Side A of the album: released core tracks out of the core's capstones, and the newest track (the banner plays it). */
  album: z.object({
    released: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    latestTrackId: z.string().nullable(),
  }),
  /**
   * What stays open after the core, in the order Today offers it: the advanced tracks (with their honest note),
   * the Transcription Gym (ladder L8 once CF-T is released, own audio), Studio, reviews, side lessons, and any
   * capstone left unreleased. `available: false` with a `note` when it cannot be started yet.
   */
  open: z.array(
    z.object({
      kind: z.enum(["track", "gym", "studio", "review", "side-lesson", "capstone"]),
      /** A track id, a capstone id, a lesson id; `null` for gym, Studio and reviews. */
      id: z.string().nullable(),
      title: z.string(),
      note: z.string(),
      available: z.boolean(),
    }),
  ),
});
export type CoreCompletion = z.infer<typeof CoreCompletionSchema>;

/**
 * One recording of an album track version (decision of 2026-11-13, d20: re-recording keeps both takes; nothing is
 * deleted). Takes are numbered from 1 in the order recorded.
 */
export const AlbumTakeSchema = z.object({
  take: z.number().int().positive(),
  audioMime: z.string(),
  durationS: z.number().nullable(),
  bytes: z.number().int().nonnegative(),
  recordedAt: Instant,
});
export type AlbumTake = z.infer<typeof AlbumTakeSchema>;

export const CheckpointStatusSchema = z.object({
  cpId: checkpointId,
  status: z.enum(["locked", "open", "passed", "soft-passed", "failed"]),
  attempts: z.number().int(),
  lastScore: z.number().nullable(),
  /** "Continue anyway" may be offered on the next attempt (a retake ≥ 0.75, or any third attempt). */
  softPassAvailable: z.boolean(),
  /** An unfinished attempt older than 3 days restarts with new items. */
  pendingAttemptAt: Instant.nullable(),
});
export type CheckpointStatus = z.infer<typeof CheckpointStatusSchema>;

export const CapstoneStatusSchema = z.object({
  capstoneId,
  status: z.enum(["locked", "open", "in_progress", "released"]),
  /** Why it is still locked, as learner-facing copy ("Two more gym sets open X1"). */
  lockedReason: z.string().nullable(),
  sessionsDone: z.number().int(),
  sessionsTotal: z.number().int(),
  sketchId: z.string().nullable(),
  trackId: z.string().nullable(),
});
export type CapstoneStatus = z.infer<typeof CapstoneStatusSchema>;

export const CourseProgressSchema = z.object({
  lessons: z.array(LessonProgressSchema),
  checkpoints: z.array(CheckpointStatusSchema),
  capstones: z.array(CapstoneStatusSchema),
  /** Gym sessions done, in order (`GYM.01`, ...). */
  gym: z.array(z.object({ gymId: z.string(), kind: z.enum(["ladder", "own-audio"]), at: Instant })),
  /** The next map item in the default order. */
  next: SessionIdSchema.nullable(),
  /** Map sessions completed out of the 185 of the core (plus track sessions once a track is open). */
  mapDone: z.number().int(),
  mapTotal: z.number().int(),
  /**
   * Wave 5 (docs/design/wave5.md §5.1): optional side lessons (A1.L01–L04) done and offered. They advance
   * track A, never the core map (contracts §9.6). Absent from a server older than Wave 5.
   */
  sideLessons: z
    .object({ done: z.number().int().nonnegative(), total: z.number().int().nonnegative() })
    .optional(),
  /** Wave 6 (wave6.md §5.3, §5.5): the advanced tracks with their gates, and where the core stands. */
  tracks: z.array(TrackStateSchema).optional(),
  core: z.enum(CORE_STAGES).optional(),
  /** Wave 7 (wave7.md §5.8): the whole course's stage; `mapTotal` counts 259 once a track has lessons. */
  course: z.enum(["in-progress", "complete"]).optional(),
});
export type CourseProgress = z.infer<typeof CourseProgressSchema>;

/** What the learner answered: one of the response shapes a `TestCase` can carry (contracts §5.4). */
export const AttemptResponseSchema = z.union([
  z.strictObject({ code: z.string().max(60_000) }),
  z.strictObject({ blanks: z.record(z.string(), z.string()) }),
  z.strictObject({ order: z.array(z.string()) }),
  z.strictObject({ answer: AnswerSchema }),
  z.strictObject({ taps: z.array(z.number()) }),
  /** Wave 7 (`tap.lanes`, R2.L04 and R.CP): two lanes tapped at once, one per hand, each in seconds. */
  z.strictObject({ lanes: z.array(z.array(z.number()).max(512)).min(2).max(4) }),
  z.strictObject({
    sung: z.array(
      z.strictObject({ midi: z.number().nullable(), cents: z.number().nullable(), credit: z.number() }),
    ),
  }),
  z.strictObject({ staff: z.string() }),
  z.strictObject({ click: z.union([z.strictObject({ from: z.number(), to: z.number() }), z.string()]) }),
  z.strictObject({ parts: z.array(z.unknown()) }),
  z.strictObject({ skipped: z.literal(true) }),
]);
export type AttemptResponse = z.infer<typeof AttemptResponseSchema>;

export const StepAttemptCreateSchema = z.strictObject({
  /** Wave 3: see `IdempotencyKeySchema`. Optional on the wire; the app always sends one. */
  idempotencyKey: IdempotencyKeySchema.optional(),
  sessionId: z.string().nullable(),
  /** Slug inside the lesson; the global ID is `${lessonId}/${exerciseId}`. */
  exerciseId: z.string(),
  exerciseVersion: z.number().int().positive(),
  /** "Try a new one" starts a new series; params are drawn from `(globalId, seriesNo)`. */
  seriesNo: z.number().int().nonnegative(),
  params: z.record(z.string(), z.union([z.number(), z.string()])).nullable(),
  response: AttemptResponseSchema,
  /** The result the browser grader produced. The server stores it and takes rung, attempt number and evidence from its own state. */
  result: GradeResultSchema,
  /** Extra replays beyond the cue's limit, as counted by the client. */
  extraReplays: z.number().int().nonnegative(),
  activeMs: z.number().nonnegative(),
  /** Code applied from a tutor card and not yet edited by hand gives no evidence (contracts §10.7). */
  tutorAssisted: z.boolean(),
});
export type StepAttemptCreate = z.infer<typeof StepAttemptCreateSchema>;

/** `step_attempts` row. */
export const StepAttemptSchema = z.object({
  id: z.number().int(),
  sessionId: z.string().nullable(),
  lessonId: z.string(),
  stepId: z.string(),
  exerciseId: z.string(),
  exerciseVersion: z.number().int(),
  seriesNo: z.number().int(),
  attemptNo: z.number().int(),
  passed: z.boolean(),
  score: z.number(),
  /** score × rung multiplier × replay multiplier. */
  adjusted: z.number(),
  hintRung: RungSchema,
  feedbackCodes: z.array(z.string()),
  modality: z.enum(["normal", "fallback"]),
  disputed: z.boolean(),
  /**
   * The retry policy (docs/design/retry.md §3): taken after the step already counted (it passed, the lesson is
   * complete, a predict was already answered). Stored with its grade; gives no evidence, no SRS rating, no test-out
   * and leaves `passed`, `exercise_results` and the lesson's best score as they were (it is one more graded attempt
   * in `StepState.attempts`). The server
   * decides it; a client never sends it. Absent from servers before the policy (read as false).
   */
  practice: z.boolean().optional(),
  at: Instant,
});
export type StepAttempt = z.infer<typeof StepAttemptSchema>;

/** `exercise_results` row: the best state of one exercise, keyed by `(exerciseId, version)`. */
export const ExerciseResultSchema = z.object({
  exerciseId: z.string(),
  exerciseVersion: z.number().int(),
  lessonId: z.string(),
  firstPassAt: Instant.nullable(),
  attemptsToPass: z.number().int().nullable(),
  bestScore: z.number().nullable(),
  lastScore: z.number().nullable(),
  assisted: z.boolean(),
  lastAt: Instant,
});
export type ExerciseResult = z.infer<typeof ExerciseResultSchema>;

/** The learner's state on one step. The hint rung lives on the server and nowhere else (contracts §10.4). */
export const StepStateSchema = z.object({
  lessonId: z.string(),
  stepId: z.string(),
  rung: RungSchema,
  passed: z.boolean(),
  /** Graded attempts in the current series (`status: 'error'` is not an attempt). */
  attempts: z.number().int(),
  seriesNo: z.number().int(),
  /** Reveal is available after 2 graded attempts (3 for sing and tap). */
  revealAvailable: z.boolean(),
  result: ExerciseResultSchema.nullable(),
  /**
   * docs/design/retry.md §3: the next graded attempt on this step will be stored as practice (the step passed,
   * the lesson is complete, or a predict was already answered), so the step shows the practice line before the
   * take. Absent from servers before the policy (read as false).
   */
  practiceNext: z.boolean().optional(),
});
export type StepState = z.infer<typeof StepStateSchema>;

export const StepAttemptResultSchema = z.object({
  attempt: StepAttemptSchema,
  state: StepStateSchema,
  evidence: z.array(EvidenceSchema),
  reviews: z.array(SrsReviewResultSchema),
  /** A test-out pass marks these scaffold steps complete (contracts §9.5). */
  testedOut: z.array(z.string()),
  /** The voicing gate: tools that became usable inside this session because of this attempt. */
  unlocked: z.array(UnlockSchema),
});
export type StepAttemptResult = z.infer<typeof StepAttemptResultSchema>;

export const LessonCompleteRequestSchema = z.strictObject({
  sessionId: z.string().nullable(),
  /** The Make's saved sketch. A lesson cannot complete without one. */
  sketchId: z.string(),
  lessonVersion: z.number().int().positive(),
  contentHash: z.string(),
  /** 15-minute target: `A` saves the Quick sketch and stops at `wrapAt`; `B` (or `null`) completes the lesson. */
  splitPart: z.enum(["A", "B"]).nullable(),
});
export const LessonCompleteResultSchema = z.object({
  progress: LessonProgressSchema,
  /** Wave 6: the advanced-track gates this completion met (U15.L06 opens `J.forms`), announced once. */
  gatesOpened: z.array(TrackGateStateSchema).optional(),
  unlocks: z.array(UnlockSchema),
  canDo: z.array(CanDoEntrySchema),
  terms: z.array(TermIntroducedSchema),
  /** Families and fact cards this lesson seeded: `active`, or `deferred` by the governor. */
  seeded: z.array(z.object({ cardId: z.string(), status: z.enum(CARD_STATUSES) })),
  opened: z.array(SessionIdSchema),
  streak: StreakSummarySchema,
});
export type LessonCompleteResult = z.infer<typeof LessonCompleteResultSchema>;

export const CheckpointItemSpecSchema = z.object({
  idx: z.number().int(),
  skillId,
  /** Gating items count in the pass score; level-setting items never block. */
  role: z.enum(["gating", "level-setting"]),
  source: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("family"),
      familyId,
      level: z.number().int(),
      category: z.string().nullable(),
      seed: z.number().int(),
    }),
    z.object({ kind: z.literal("authored"), exerciseId: z.string() }),
    z.object({ kind: z.literal("make") }),
  ]),
  /** A debt re-test from an earlier checkpoint. */
  debt: z.boolean(),
});
export type CheckpointItemSpec = z.infer<typeof CheckpointItemSpecSchema>;
export const CheckpointAttemptStartSchema = z.object({
  cpId: checkpointId,
  attemptNo: z.number().int(),
  startedAt: Instant,
  /** 12 to 18 items, interleaved. Sing items are left out in Quiet mode. */
  items: z.array(CheckpointItemSpecSchema),
});
export type CheckpointAttemptStart = z.infer<typeof CheckpointAttemptStartSchema>;
export const CheckpointSubmitSchema = z.strictObject({
  sessionId: z.string().nullable(),
  attemptNo: z.number().int().positive(),
  items: z.array(
    z.strictObject({
      idx: z.number().int(),
      score: z.number().min(0).max(1),
      skipped: z.boolean(),
      response: AttemptResponseSchema,
      result: GradeResultSchema.nullable(),
    }),
  ),
  makeSketchId: z.string().nullable(),
  /** "Continue anyway": only honoured when the server's rules offer it. */
  acceptSoftPass: z.boolean(),
});
export type CheckpointSubmit = z.infer<typeof CheckpointSubmitSchema>;
export const CheckpointOutcomeSchema = z.object({
  cpId: checkpointId,
  attemptNo: z.number().int(),
  /** Weighted score over gating items; pass needs ≥ 0.85 and every gated skill's mean ≥ 0.70. */
  score: z.number(),
  passed: z.boolean(),
  softPass: z.boolean(),
  softPassOffered: z.boolean(),
  perSkill: z.array(
    z.object({
      skillId,
      role: z.enum(["gating", "level-setting"]),
      mean: z.number(),
      items: z.number().int(),
      ok: z.boolean(),
    }),
  ),
  /** On fail: 2 sets per failed skill, scheduled into the next warm-ups. */
  repairQueue: z.array(z.object({ skillId, familyId: familyId.nullable(), sets: z.number().int() })),
  debts: z.array(skillId),
  opened: z.array(z.string()),
  unlocks: z.array(UnlockSchema),
  /**
   * Wave 6 (contracts §4.3): the advanced-track gates this pass (or soft pass) met, announced once: U13.CP opens
   * `J.main` and `R.main`, U14.CP `J.chord-scales`, U17.CP `J.reharmonization`. Empty on a fail and on a retake of a
   * checkpoint already passed.
   */
  gatesOpened: z.array(TrackGateStateSchema).optional(),
});
export type CheckpointOutcome = z.infer<typeof CheckpointOutcomeSchema>;

export const CapstoneStateSchema = CapstoneStatusSchema.extend({
  /** Session IDs completed (`C2.S1`). */
  sessions: z.array(z.string()),
  flavour: flavour.nullable(),
  /** The latest rubric run on the draft. */
  lastResult: GradeResultSchema.nullable(),
  reviewRequested: z.boolean(),
  /**
   * Wave 5 (carry-over c1, docs/design/wave5.md §5.2): the draft version the last passing check graded, and
   * whether the draft changed since (then the first release answers 409 and the page says "check again before
   * you release"). Absent from older servers.
   */
  checkedVersion: z
    .object({ sketchId: z.string(), sketchVersion: z.number().int().positive() })
    .nullable()
    .optional(),
  draftChangedSinceCheck: z.boolean().optional(),
});
export type CapstoneState = z.infer<typeof CapstoneStateSchema>;
export const CapstoneCheckSchema = z.strictObject({
  sessionId: z.string().nullable(),
  sketchId: z.string(),
  sketchVersion: z.number().int().positive(),
  result: GradeResultSchema,
});
export const CapstoneSessionCompleteSchema = z.strictObject({
  sessionId: z.string().nullable(),
  capstoneSessionId: z.string(),
  sketchId: z.string(),
  flavour: flavour.nullable(),
});

/**
 * Wave 7: what a gym session after the core serves (app/src/transcribe gym-after-core.ts `GymSource`): the learner's
 * own audio, a repertoire song, an analysis, a jazz form in a key, a rhythm item.
 */
export const GymSourceSchema = z
  .string()
  .max(120)
  .regex(/^(?:own|song|analysis|jazz|rhythm):[A-Za-z0-9._#♭♯:-]+$/);
export const GymSessionCreateSchema = z.strictObject({
  sessionId: z.string().nullable(),
  kind: z.enum(["ladder", "own-audio"]),
  transcriptionId: z.string().nullable(),
  /** Wave 7: the source served (absent: none recorded, as before). */
  source: GymSourceSchema.nullable().optional(),
});
/** `gym_sessions` row. The ID is the next free `GYM.nn` when the session starts. */
export const GymSessionSchema = z.object({
  gymId: z.string().regex(/^GYM\.\d{2}$/),
  sessionId: z.string().nullable(),
  kind: z.enum(["ladder", "own-audio"]),
  ladderLevel: z.number().int().min(1).max(8).nullable(),
  /** R0 to R4. */
  realism: z.number().int().min(0).max(4).nullable(),
  transcriptionId: z.string().nullable(),
  at: Instant,
  /** Wave 7: the source this session served, kept so the two-week rule survives devices and backups. */
  source: GymSourceSchema.nullable().optional(),
});
export type GymSession = z.infer<typeof GymSessionSchema>;

// --- sessions -----------------------------------------------------------------------------------

export const SESSION_KINDS = [
  "lesson",
  "checkpoint",
  "capstone",
  "gym",
  "keepalive",
  "light",
  "studio",
  "review",
] as const;
// --- Wave 7 shared shapes (docs/design/wave7.md §5): the next session, track offers, the whole course ----------

/**
 * One session the planner would run, as the Coda's "next" line, Today's track offers and a track's next session
 * show it (carry f6: taken from the planner, never composed in the app). `goal` is the session's objective as the
 * content states it (a lesson's objective, a capstone session's goal, "Transcription Gym: ladder L6"). `day` says
 * when the planner would run it: `tomorrow` (the next learner day), `today` (a "one more" offer after the planned
 * session) or `later` (an alternative).
 */
export const NextSessionSchema = z.object({
  kind: z.enum(SESSION_KINDS),
  /** A lesson, checkpoint, capstone session or `GYM.nn`; `null` for a reviews-only or Studio day. */
  mapItemId: SessionIdSchema.nullable(),
  title: z.string(),
  goal: z.string(),
  estMinutes: z.number().nonnegative(),
  /** The advanced track it belongs to; `null` for the core, the gym and reviews. */
  trackId: z.enum(["J", "R", "A"]).nullable(),
  /** It fills the every-5th transcription slot, and with what (as `SessionPlan.slot.fills`); `null` otherwise. */
  slot: z.enum(["gym", "cf-t", "x"]).nullable(),
  day: z.enum(["today", "tomorrow", "later"]),
});
export type NextSession = z.infer<typeof NextSessionSchema>;

/**
 * Where the learner's attention goes between the core and the tracks (contracts §2.6: order inside a track is fixed,
 * order between tracks is the learner's). `core` (the default, and what `null` means): the core's next item is the
 * New block while the core is unfinished, and open tracks are offered beside it. A track id: that track's next
 * session is the New block; the core's next item becomes the first alternative. A due core checkpoint stays the New
 * block whatever the focus (it is scheduled, §7.6), and a focus on a track with nothing open falls back to `core`
 * for that day (`SessionPlan.note` says so).
 */
export const TRACK_FOCUS = ["core", "J", "R", "A"] as const;
export type TrackFocusId = (typeof TRACK_FOCUS)[number];
export const TrackFocusSetSchema = z.strictObject({ focus: z.enum(TRACK_FOCUS) });
export type TrackFocusSet = z.infer<typeof TrackFocusSetSchema>;
export const TrackFocusSchema = z.object({
  focus: z.enum(TRACK_FOCUS),
  /** When the learner last chose; `null` while they never did (the default `core`). */
  chosenAt: Instant.nullable(),
});
export type TrackFocus = z.infer<typeof TrackFocusSchema>;

/** One open track Today may offer instead of (or, with a focus, as) the New block. */
export const TrackOfferSchema = z.object({
  trackId: z.enum(["J", "R", "A"]),
  title: z.string(),
  next: NextSessionSchema,
  /** Sessions done and in the track. */
  sessionsDone: z.number().int().nonnegative(),
  sessionsTotal: z.number().int().nonnegative(),
  /** One plain line: "Jazz Harmony · next: J1.L03 The Major ii–V–I (about 20 minutes)". */
  note: z.string(),
});
export type TrackOffer = z.infer<typeof TrackOfferSchema>;

/**
 * The whole course (contracts §2.7: 259 sessions — the core's 185 and the tracks' 74). `stage`: `in-progress`
 * until every lesson and checkpoint of the core and of all three tracks is done (passed or soft-passed) and every
 * capstone released; then `complete`. Session 259 is the last of those in whatever order the learner took them.
 */
export const COURSE_STAGES = ["in-progress", "complete"] as const;
export const WholeCourseSchema = z.object({
  stage: z.enum(COURSE_STAGES),
  completedAt: Instant.nullable(),
  /** The session whose Coda carried the moment; `null` before. */
  sessionId: z.string().nullable(),
  sessionsDone: z.number().int().nonnegative(),
  sessionsTotal: z.number().int().positive(),
  core: z.enum(CORE_STAGES),
  tracks: z.array(TrackStateSchema),
  /** The album: released tracks of the course's capstones (Side A 12, Side B 8). */
  album: z.object({
    released: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    latestTrackId: z.string().nullable(),
  }),
  /** The learner's own numbers, as `CoreCompletion.stats`. */
  stats: CoreCompletionSchema.shape.stats,
  /** What the learner can now do, newest first, at most 10 (one per area plus the tracks' own). */
  canDo: CoreCompletionSchema.shape.canDo,
  /** What stays open after the course: the gym (L8 on other standards, own audio), Studio, reviews, replays. */
  open: CoreCompletionSchema.shape.open,
});
export type WholeCourse = z.infer<typeof WholeCourseSchema>;

// --- unit songs (docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.4) ---------------------------------

/**
 * `new`: the unit has a song in the content that the learner has not started (no row yet); `open`: started, takes
 * going in; `released`: released to the album at least once (later takes still update it, `changedSinceRelease`).
 */
export const UNIT_SONG_STATUSES = ["new", "open", "released"] as const;
export type UnitSongStatus = (typeof UNIT_SONG_STATUSES)[number];
const unitId = idSchema("unit");
/** A song's title as the learner names it: 1 to 60 characters once trimmed. */
const songTitle = z.string().trim().min(1).max(60);
/** A cell of the song's grid, `<part>@<section>` (content-kit `CellKey`): both are slugs. */
const songCell = z
  .string()
  .regex(/^[a-z][a-z0-9-]*@[a-z][a-z0-9-]*$/, "a cell is <part>@<section>")
  .max(130);
/** A take's track labels → the song part each plays (`null`: no part; it goes past the brief). */
const songLabels = z
  .record(z.string().min(1).max(64), z.string().max(64).nullable())
  .refine((r) => Object.keys(r).length <= 64, "at most 64 track labels");

/** Today's line about the song of the lesson it plans (`SessionPlan.song`). */
export const UnitSongPlanSchema = z.object({
  unitId,
  songId: idSchema("unitSong"),
  /** The learner's title for the song (Oak's working title while it is `new`). */
  title: z.string(),
  /** The song's style (the profile's while it is `new`: what the New song moment offers first). */
  flavour,
  status: z.enum(UNIT_SONG_STATUSES),
  /** Takes in the song now. */
  takesCount: z.number().int().nonnegative(),
  /** Where the planned lesson is in the song's plan (1-based) and how many lessons the plan has: "lesson 4 of 9". */
  lessonIndex: z.number().int().positive(),
  lessonsInSong: z.number().int().positive(),
  /** The take step's `today` line; `null` for a side step. */
  today: z.string().nullable(),
  /** The lesson is a side step: its Make stays a sketch of its own (the content's `reason` says why). */
  side: z.boolean(),
});
export type UnitSongPlan = z.infer<typeof UnitSongPlanSchema>;

/** One take of a song: a lesson's Make, the sketch version it plays and the cells it claims (`unit_song_takes`). */
export const UnitSongTakeSchema = z.object({
  id: z.number().int().positive(),
  lessonId,
  sketchId: z.string(),
  sketchVersion: z.number().int().positive(),
  /** The code of that sketch version (the take plays it; the server never copies or changes it). */
  code: z.string(),
  /** The cells it claims, in song order (content-kit `CellKey`). Later takes override earlier ones. */
  cells: z.array(songCell),
  labels: songLabels,
  /** The tempo of its code; the song plays at the newest take's tempo (spec §5.2). */
  bpm: z.number().positive(),
  /**
   * Oak recorded it from an earlier lesson-make sketch (spec §5.6a): `cells` are the step's sections × declared parts,
   * until the app saves this version again with the cells it computed from the code.
   */
  backfilled: z.boolean(),
  /** The sketch version came from a backup import: its code runs only after the strict lint (contracts §11.3). */
  reviewBeforeRun: z.boolean(),
  createdAt: Instant,
});
export type UnitSongTake = z.infer<typeof UnitSongTakeSchema>;

/** One release of a song to the album (`unit_song_releases`, without its snapshot). */
export const UnitSongReleaseSchema = z.object({
  id: z.number().int().positive(),
  /** The album track it became; `null` once the learner deleted that track. */
  albumTrackId: z.string().nullable(),
  albumVersion: z.number().int().positive(),
  flavour,
  title: z.string(),
  createdAt: Instant,
});
export type UnitSongRelease = z.infer<typeof UnitSongReleaseSchema>;

const unitSongFields = {
  unitId,
  songId: idSchema("unitSong"),
  /** The `UnitSongDef.version` the song was last arranged with (at start, a style change or a take). */
  songVersion: z.number().int().nonnegative(),
  /** The song's version in the content now; `null` when the content no longer has it. */
  contentVersion: z.number().int().positive().nullable(),
  flavour,
  title: z.string(),
  status: z.enum(UNIT_SONG_STATUSES),
  /** Released, and a take or the style changed since the newest release: the song page offers "Release again". */
  changedSinceRelease: z.boolean(),
  /** `releaseAfter` is complete and the song has a take: `songs.release` will accept it. */
  releasable: z.boolean(),
  /** Oak made (part of) it from earlier lessons' sketches (spec §5.6a). */
  backfilled: z.boolean(),
  /** The learner picked or saw the song's style (Today's one-time style card shows while backfilled and not seen). */
  styleSeen: z.boolean(),
  takesCount: z.number().int().nonnegative(),
  /** Oldest first. */
  releases: z.array(UnitSongReleaseSchema),
};
/** `songs.list`: a song without its takes. */
export const UnitSongSummarySchema = z.object({
  ...unitSongFields,
  /** The song's take lessons that have a take in it (a lesson redone counts once), for "N of M lessons". */
  lessonsCount: z.number().int().nonnegative(),
});
export type UnitSongSummary = z.infer<typeof UnitSongSummarySchema>;
/** `songs.get` and every song write: the song with its takes in order (a `new` song has none). */
export const UnitSongDetailSchema = z.object({ ...unitSongFields, takes: z.array(UnitSongTakeSchema) });
export type UnitSongDetail = z.infer<typeof UnitSongDetailSchema>;

export const UnitSongStartSchema = z.strictObject({
  flavour,
  /** See `IdempotencyKeySchema`. A second start without the key returns the song as it is. */
  idempotencyKey: IdempotencyKeySchema.optional(),
});
export type UnitSongStart = z.infer<typeof UnitSongStartSchema>;
export const UnitSongFlavourSetSchema = z.strictObject({ flavour });
export const UnitSongRenameSchema = z.strictObject({ title: songTitle });
export const UnitSongTakeCreateSchema = z.strictObject({
  /** A take step of this unit's song. */
  lessonId,
  /** The lesson-make sketch version the Make just saved (`sketches.create`). */
  sketchId: z.string().min(1).max(64),
  sketchVersion: z.number().int().positive(),
  /** `claimsOf(def, step, playedParts, filled)` (content-kit): only cells in the step's sections. */
  cells: z.array(songCell).max(1024),
  labels: songLabels,
  bpm: z.number().positive().max(400),
  /** See `IdempotencyKeySchema` (`[A-Za-z0-9_-]`, so not `take:U01.L05:…`). Saving the same version again refines it. */
  idempotencyKey: IdempotencyKeySchema.optional(),
});
export type UnitSongTakeCreate = z.infer<typeof UnitSongTakeCreateSchema>;
export const UnitSongReleaseRequestSchema = z.strictObject({
  title: songTitle,
  idempotencyKey: IdempotencyKeySchema.optional(),
});
export type UnitSongReleaseRequest = z.infer<typeof UnitSongReleaseRequestSchema>;
export const UnitSongReleaseResultSchema = z.object({
  albumTrackId: z.string(),
  albumVersion: z.number().int().positive(),
  releaseId: z.number().int().positive(),
  song: UnitSongDetailSchema,
});
export type UnitSongReleaseResult = z.infer<typeof UnitSongReleaseResultSchema>;

/** A take as a release froze it: its claim and its code at release. */
export const UnitSongSnapshotTakeSchema = z.object({
  takeId: z.number().int().positive(),
  lessonId,
  sketchId: z.string(),
  sketchVersion: z.number().int().positive(),
  code: z.string(),
  cells: z.array(songCell),
  labels: songLabels,
  bpm: z.number().positive(),
});
export type UnitSongSnapshotTake = z.infer<typeof UnitSongSnapshotTakeSchema>;
/**
 * `songs.snapshot`: a release exactly as it was frozen (spec §5.4). Album playback and export compose from this, never
 * from the current content or takes: `def` is the whole `UnitSongDef` at release (stored as it was, so it is not
 * re-validated here), `oakCode` its `code[flavour]`, `takes` in order.
 */
export const UnitSongSnapshotSchema = z.object({
  id: z.number().int().positive(),
  unitId,
  albumTrackId: z.string().nullable(),
  albumVersion: z.number().int().positive(),
  songId: idSchema("unitSong"),
  songVersion: z.number().int().nonnegative(),
  flavour,
  title: z.string(),
  bpm: z.number().positive(),
  oakCode: z.string(),
  def: z.custom<UnitSongDef>((v) => typeof v === "object" && v !== null && !Array.isArray(v), {
    message: "a song definition",
  }),
  takes: z.array(UnitSongSnapshotTakeSchema),
  /** Set by a backup import: every code in it runs only after the strict lint (contracts §11.3). */
  reviewBeforeRun: z.boolean(),
  createdAt: Instant,
});
export type UnitSongSnapshot = z.infer<typeof UnitSongSnapshotSchema>;

export const SessionPlanSchema = z.object({
  day: Day,
  targetMinutes: TargetMinutesSchema,
  kind: z.enum(SESSION_KINDS),
  /** What the New block is: a lesson, checkpoint, capstone session or gym slot; `null` on a reviews-only day. */
  mapItemId: SessionIdSchema.nullable(),
  title: z.string(),
  /** Why this and not the next lesson ("Checkpoint day: about 20 minutes", "Two more gym sets open X1"). */
  note: z.string().nullable(),
  warmup: DueBatchSchema,
  main: z
    .object({
      resumeStep: z.string().nullable(),
      splitPart: z.enum(["A", "B"]).nullable(),
      /** A Light lesson after a long gap: the last completed lesson's Make with one new constraint. */
      light: z.object({ lessonId, constraint: z.string() }).nullable(),
      estMinutes: z.number(),
    })
    .nullable(),
  /** Return policy (contracts §7.9). Gap lengths are never shown. */
  returning: z
    .object({
      recap: z.object({ canDoId: canDoId.nullable(), sketchId: z.string().nullable() }).nullable(),
      offerLoosen: z.boolean(),
    })
    .nullable(),
  /** Other things Today may offer instead (an extra gym session, a capstone left open, a side lesson). */
  alternatives: z.array(
    z.object({ kind: z.enum(SESSION_KINDS), mapItemId: SessionIdSchema.nullable(), title: z.string() }),
  ),
  /** Rendered deterministically from the latest non-retracted tutor note; makes no API call. */
  tutorNote: z.string().nullable(),
  /**
   * Wave 5 (docs/design/wave5.md §5.1): an optional side lesson (A1.L01–L04, open once U03.L02 is done) Today may
   * offer. Never the New block: `alternative` shows it as a chip beside today's session; `after-core` offers it
   * only once today's planned session ended ("One more, if you like"). Started with `session.start { kind:
   * "lesson", mapItemId: "A1.L0n" }`; counts 1 in track A, a streak day, 1 in the pace estimate (contracts §9.6).
   */
  sideLesson: z
    .object({
      lessonId,
      title: z.string(),
      estMinutes: z.number(),
      placement: z.enum(["alternative", "after-core"]),
      /** One plain line: "Optional: how a filter shapes a sound (about 15 minutes)". */
      note: z.string(),
    })
    .nullable()
    .optional(),
  /**
   * Wave 6 (contracts §2.5; docs/design/wave6.md §5.2): this session fills the every-5th transcription slot, and
   * with what: a gym session (`kind: "gym"`), the next CF-T session while CF-T is open and unfinished (`kind:
   * "capstone"`, `mapItemId: "CF-T.S2"`), or an `X#` session that was next anyway. `null` on other days.
   */
  slot: z
    .object({ fills: z.enum(["gym", "cf-t", "x"]), sinceLast: z.number().int().nonnegative() })
    .nullable()
    .optional(),
  /**
   * Wave 6 (contracts §2.6, §4.3; wave6.md §5.3): the advanced tracks whose gate is met, while they have no lesson
   * to plan. `note` is the honest line Today shows ("The Jazz and Rhythm tracks are open. Their first lessons are
   * still being written."). `null` before any gate is met or once a track lesson can be planned.
   */
  tracks: z
    .object({ open: z.array(z.enum(["J", "R", "A"])), lessonsAuthored: z.boolean(), note: z.string() })
    .nullable()
    .optional(),
  /**
   * Wave 6 (wave6.md §5.5): where the learner stands at the end of the core. `lessons-done`: every core lesson and
   * checkpoint is behind them and a capstone is still open (it is then today's session or an alternative);
   * `complete`: session 185 is done and today is a review, gym or Studio day. Absent or `in-progress` before.
   */
  core: z.enum(["in-progress", "lessons-done", "complete"]).optional(),
  /**
   * Wave 7 (docs/design/wave7.md §5.2). `track`: the New block is a track session, and where it stands in its track.
   * `trackOffers`: the open tracks with a session the learner may start now, in the order J, R, A with the focused
   * track first (Today shows them beside the New block; `alternatives` keeps listing them too). `focus`: the learner's
   * choice (`tracks.focus`). `course`: `complete` once the whole course is (wave7.md §5.8). All absent from an older
   * server.
   */
  track: z
    .object({
      trackId: z.enum(["J", "R", "A"]),
      sessionIndex: z.number().int().positive(),
      sessionsTotal: z.number().int().positive(),
    })
    .nullable()
    .optional(),
  trackOffers: z.array(TrackOfferSchema).optional(),
  focus: z.enum(TRACK_FOCUS).optional(),
  course: z.enum(COURSE_STAGES).optional(),
  /**
   * Unit songs (spec 2026-11-24 §5.5): the song of the lesson Today plans, when that lesson is in one (a take or a
   * side step). Absent otherwise, and from an older server.
   */
  song: UnitSongPlanSchema.nullable().optional(),
});
export type SessionPlan = z.infer<typeof SessionPlanSchema>;

export const SessionStartSchema = z.strictObject({
  kind: z.enum(SESSION_KINDS),
  mapItemId: SessionIdSchema.nullable(),
  targetMinutes: TargetMinutesSchema,
  /**
   * Wave 6 (decision of 2026-11-13, d21; docs/design/wave6.md §5.6): the browser tab's own id (`tabId()` of
   * `app/src/lib/tab-session.ts`, kept in sessionStorage). A second tab or browser starts its OWN session; the
   * same tab starting again on the same learner day (a reload, a retry) gets its open session back. Absent (an
   * older client): the caller is one anonymous tab.
   */
  tabId: z.string().min(8).max(64).optional(),
});
export const SESSION_PHASES = ["idle", "warmup", "main", "make", "coda", "done"] as const;
/** `sessions` row. */
export const SessionSchema = z.object({
  id: z.string(),
  day: Day,
  kind: z.enum(SESSION_KINDS),
  targetMinutes: TargetMinutesSchema,
  mapItemId: SessionIdSchema.nullable(),
  contentVersion: z.string().nullable(),
  startedAt: Instant,
  endedAt: Instant.nullable(),
  activeMinutes: z.number(),
  phase: z.enum(SESSION_PHASES),
  /** Wave 6 (d21): the tab that started it (`SessionStart.tabId`); `null` or absent for an older client's session. */
  tabId: z.string().nullable().optional(),
});
export type Session = z.infer<typeof SessionSchema>;
export const SessionHeartbeatSchema = z.strictObject({
  phase: z.enum(SESSION_PHASES),
  activeMs: z.number().nonnegative(),
  stepId: z.string().nullable(),
});
export const SessionEndSchema = z.strictObject({
  wrappedEarly: z.boolean(),
  phaseMs: z.strictObject({ warmup: z.number(), main: z.number(), make: z.number(), coda: z.number() }),
});
/** The Coda shows only cards whose state changed today. */
export const SessionSummarySchema = z.object({
  session: SessionSchema,
  streak: StreakSummarySchema,
  sketchesSaved: z.array(z.string()),
  canDo: z.array(CanDoEntrySchema),
  unlocks: z.array(UnlockSchema),
  /** "Your ear-to-voice aim got finer: ±35¢ now". Announced once, never mid-session. */
  toleranceChange: z.object({ from: SingTolCentsSchema, to: SingTolCentsSchema }).nullable(),
  /** Offer "Ask Claude to listen"; automatic in the first 7 days and in a capstone Coda. */
  listeningNote: z.enum(["offer", "auto", "off"]),
  teaser: z.object({ mapItemId: SessionIdSchema, title: z.string() }).nullable(),
  /**
   * Wave 6 (wave6.md §5.3, §5.5). `gatesOpened`: the advanced-track gates met in this session (the U13.CP Coda:
   * "The Jazz and Rhythm tracks are open"), each announced once. `coreComplete`: set in the summary of the session
   * that completed the core (stage `complete`), and only there; the Coda then shows the finale card instead of a
   * teaser. `null` or absent on every other day.
   */
  gatesOpened: z.array(TrackGateStateSchema).optional(),
  coreComplete: CoreCompletionSchema.nullable().optional(),
  /**
   * Wave 5 (carry-over c10, docs/design/wave5.md §5.4): what a gym day's Coda shows — the ladder item (level,
   * realism, a realism change or an offered level-up, announced once) or the own-audio project (its checklist and
   * versions today). `null` on other days; absent from older servers.
   */
  gym: z
    .object({
      gymId: z.string().regex(/^GYM\.\d{2}$/),
      kind: z.enum(["ladder", "own-audio"]),
      transcriptionId: z.string().nullable(),
      title: z.string(),
      ladder: z
        .object({
          level: z.number().int().min(1).max(8),
          realism: z.number().int().min(0).max(4),
          bestScore: z.number().min(0).max(1).nullable(),
          gradedPass: z.boolean(),
          realismChange: z
            .object({ from: z.number().int().min(0).max(4), to: z.number().int().min(0).max(4) })
            .nullable(),
          levelUp: z.object({ to: z.number().int().min(1).max(8), reason: z.string() }).nullable(),
        })
        .nullable(),
      ownAudio: z
        .object({
          /** Checklist item ID → 0–2 as saved today. */
          checklist: z.record(z.string(), z.number().min(0).max(2)),
          versionsToday: z.number().int().nonnegative(),
          /** Regions (bars) worked on today. */
          regions: z.number().int().nonnegative(),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  /**
   * Wave 7 (carry f6; wave7.md §5.7): the planner's real next session — what Today will plan on the next learner day
   * given everything this session changed (a track lesson, a checkpoint, a capstone session, a gym slot, a reviews
   * day). The Coda's "next" line is drawn from it, never composed in the app. `null` when nothing is planned (the
   * whole course complete and nothing due); absent from an older server.
   */
  next: NextSessionSchema.nullable().optional(),
  /** Wave 7 (wave7.md §5.8): set in the summary of the session that completed the WHOLE course, once. */
  courseComplete: WholeCourseSchema.nullable().optional(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

// --- sketches -----------------------------------------------------------------------------------

export const SKETCH_ORIGINS = [
  "lesson-make",
  "free",
  "capstone",
  "transcription",
  "tutor",
  "keepalive",
  "checkpoint",
] as const;
const bandState = z.strictObject({
  bandId: idSchema("band"),
  flavour,
  /**
   * The tracks the step left out, by label: a Band's roles (`drums`, `bass`, `chords`) or, inside a unit song, the
   * song's part labels (`kick`, `mel`…). Unit songs (2026-11-24) widened it from the three Band roles.
   */
  mutes: z.array(z.string().max(64)),
  /**
   * Unit songs (spec 2026-11-24 §5.2): the Make played inside its unit's song, over these takes (`unit_song_takes`
   * ids, in order). Absent for a plain Band.
   */
  song: z.strictObject({ unitId, takeIds: z.array(z.number().int().positive()).max(256) }).optional(),
});
/**
 * Oak 2.0 S3 (contracts §13): a jam take is `open` (not kept or cut yet), `kept` or `cut` (cut = hidden, never
 * deleted); `null` = not a take. Stored in `sketch_versions.take_state`, which has no CHECK (the service validates
 * against this list).
 */
export const TAKE_STATES = ["open", "kept", "cut"] as const;
export type TakeState = (typeof TAKE_STATES)[number];
/**
 * Oak 2.0 S5: the musical dimensions a variation changes, the learner's pick for a sibling or a generation
 * (`sketch_versions.dimension`). `diffDimensions` in `@oak/grader` describes a change with the same five names.
 */
export const SKETCH_DIMENSIONS = ["sound", "rhythm", "notes", "harmony", "form"] as const;
export type SketchDimension = (typeof SKETCH_DIMENSIONS)[number];
/** Oak 2.0 S7 Commit sounds: a line whose sound settings are committed as they were in `version` (edits ask first). */
const committedLine = z.strictObject({
  label: z.string().min(1).max(64),
  version: z.number().int().positive(),
  at: Instant,
});
/** Oak 2.0 S6: a card drawn for this sketch (`content/studio/cards.ts` id). */
const drawnCard = z.strictObject({ cardId: z.string().min(1).max(80), drawnAt: Instant });
/** Oak 2.0 S5: a version's place in a variation chain (absent from a 1.x server; W3 builds the writes). */
const lineageFields = {
  /** The version of the same sketch this one was copied from (a sibling or a next generation); `null` otherwise. */
  parentVersion: z.number().int().positive().nullable(),
  /** 1 for a child of a version outside any chain, parent's + 1 after that; `null` for ordinary Runs. */
  generation: z.number().int().positive().nullable(),
  /** The one dimension the learner chose to change against the parent. */
  dimension: z.enum(SKETCH_DIMENSIONS).nullable(),
};
const sketchFlags = z.strictObject({
  lockedTools: z.array(z.string()),
  previewTools: z.array(z.string()),
  /**
   * Set by a backup import on every imported version (contracts §11.3): the code was not typed on this
   * machine, so it runs only after the strict lint passes; otherwise it opens as text with "Review before
   * running". A version the learner saves afterwards does not carry it.
   */
  reviewBeforeRun: z.literal(true).optional(),
});
/** `sketch_versions` row. */
export const SketchVersionSchema = z.object({
  sketchId: z.string(),
  version: z.number().int().positive(),
  code: z.string(),
  bpm: z.number().nullable(),
  meter: meterId.nullable(),
  key: KeySpecSchema.nullable(),
  analysis: AnalysisSummarySchema.nullable(),
  note: z.string().nullable(),
  /** Set when a tutor card was applied; this version gives no evidence. */
  tutorAssisted: z.boolean(),
  band: bandState.nullable(),
  flags: sketchFlags,
  createdAt: Instant,
  /** Oak 2.0 (migration 0012, contracts §13): optional until the W1/W3 server returns them, then always present. */
  takeState: z.enum(TAKE_STATES).nullable().optional(),
  parentVersion: lineageFields.parentVersion.optional(),
  generation: lineageFields.generation.optional(),
  dimension: lineageFields.dimension.optional(),
});
export type SketchVersion = z.infer<typeof SketchVersionSchema>;
/** `sketches` row. */
export const SketchSchema = z.object({
  id: z.string(),
  title: z.string(),
  originKind: z.enum(SKETCH_ORIGINS),
  originId: z.string().nullable(),
  currentVersion: z.number().int().positive(),
  tags: z.array(z.string()),
  archived: z.boolean(),
  listeningNote: z.string().nullable(),
  createdAt: Instant,
  updatedAt: Instant,
  /** Oak 2.0 S7: lines whose sound settings are committed (`sketches.committed_json`; empty = none). */
  committed: z.array(committedLine).optional(),
  /** Oak 2.0 S6: cards drawn for this sketch (`sketches.cards_json`; empty = none). */
  cards: z.array(drawnCard).optional(),
});
export type Sketch = z.infer<typeof SketchSchema>;
export const SketchDetailSchema = SketchSchema.extend({ versions: z.array(SketchVersionSchema) });
export type SketchDetail = z.infer<typeof SketchDetailSchema>;
const sketchVersionInput = {
  code: z.string().max(60_000),
  bpm: z.number().positive().nullable(),
  meter: meterId.nullable(),
  key: KeySpecSchema.nullable(),
  analysis: AnalysisSummarySchema.nullable(),
  note: z.string().max(2000).nullable(),
  tutorAssisted: z.boolean(),
  band: bandState.nullable(),
  flags: sketchFlags,
  /** A sketch qualifies a streak day only after at least one successful Run. */
  ranOk: z.boolean(),
};
export const SketchCreateSchema = z.strictObject({
  title: z.string().min(1).max(120),
  originKind: z.enum(SKETCH_ORIGINS),
  originId: z.string().nullable(),
  sessionId: z.string().nullable(),
  ...sketchVersionInput,
});
export type SketchCreate = z.infer<typeof SketchCreateSchema>;
export const SketchVersionCreateSchema = z.strictObject({
  sessionId: z.string().nullable(),
  ...sketchVersionInput,
  /**
   * Oak 2.0 (contracts §13). `analysis` above is the worker's analysis, saved with the version (the habits mirror
   * reads it). A Run in a jam is a take (`takeState: "open"` until kept or cut; `null` = not a take); a sibling or
   * next generation names its parent, generation and dimension. Absent = `null`.
   */
  takeState: z.enum(TAKE_STATES).nullable().optional(),
  parentVersion: lineageFields.parentVersion.optional(),
  generation: lineageFields.generation.optional(),
  dimension: lineageFields.dimension.optional(),
});
export type SketchVersionCreate = z.infer<typeof SketchVersionCreateSchema>;
export const SketchPatchSchema = z
  .strictObject({
    title: z.string().min(1).max(120),
    tags: z.array(z.string()),
    archived: z.boolean(),
    listeningNote: z.string().nullable(),
    /** Oak 2.0 S7: the whole committed list (replaces it). */
    committed: z.array(committedLine).max(64),
    /** Oak 2.0 S6: the whole list of drawn cards (replaces it). */
    cards: z.array(drawnCard).max(64),
  })
  .partial();
/** Oak 2.0 S3 (`sketches.patchVersion`): keep or cut a take, or clear the mark. */
export const SketchVersionPatchSchema = z.strictObject({ takeState: z.enum(TAKE_STATES).nullable() });
export type SketchVersionPatch = z.infer<typeof SketchVersionPatchSchema>;
/** Oak 2.0 S5 (`sketches.lineage`): the chain that ends at a version, first to last. */
export const SketchLineageSchema = z.object({
  sketchId: z.string(),
  versions: z.array(
    z.object({
      version: z.number().int().positive(),
      ...lineageFields,
      takeState: z.enum(TAKE_STATES).nullable(),
      /** The change undoes the grandparent's change in the same dimension (noted, never blocked). */
      undoesGrandparent: z.boolean(),
      createdAt: Instant,
    }),
  ),
});
export type SketchLineage = z.infer<typeof SketchLineageSchema>;
export const SketchSavedSchema = z.object({ sketch: SketchDetailSchema, streak: StreakSummarySchema });
export type SketchSaved = z.infer<typeof SketchSavedSchema>;

// --- album --------------------------------------------------------------------------------------

/** `album_track_versions` row. */
export const AlbumTrackVersionSchema = z.object({
  trackId: z.string(),
  version: z.number().int().positive(),
  sketchId: z.string(),
  sketchVersion: z.number().int().positive(),
  hasAudio: z.boolean(),
  audioMime: z.string().nullable(),
  durationS: z.number().nullable(),
  linerNotesMd: z.string(),
  theoryTags: z.array(z.string()),
  /** A `CapstoneReview` (or `null`). The learner chooses whether its liner note appears in the album. */
  review: z.unknown().nullable(),
  tutorAssisted: z.boolean(),
  /** "Revision suggested by Claude (bars 5–8)". */
  attribution: z.string().nullable(),
  band: bandState.nullable(),
  flags: sketchFlags,
  createdAt: Instant,
  /** Wave 4: whether the review's liner note shows in the album for this version (absent: not chosen yet). */
  includeReviewNote: z.boolean().optional(),
  /**
   * Wave 6 (d20): every recording of this version, oldest first, and the one that plays by default (`currentTake`:
   * the newest unless the learner chose an older one). `hasAudio`, `audioMime` and `durationS` above describe the
   * current take. Absent from older servers (then there is at most one recording).
   */
  takes: z.array(AlbumTakeSchema).optional(),
  currentTake: z.number().int().positive().nullable().optional(),
});
export type AlbumTrackVersion = z.infer<typeof AlbumTrackVersionSchema>;
/** `album_tracks` row. Side A: core capstones; side B: advanced capstones; Bside: promoted sketches. */
export const AlbumTrackSchema = z.object({
  id: z.string(),
  capstoneId: capstoneId.nullable(),
  sketchId: z.string().nullable(),
  side: z.enum(["A", "B", "Bside"]),
  trackNo: z.number().int(),
  title: z.string(),
  flavour: flavour.nullable(),
  currentVersion: z.number().int().positive(),
  coverSeed: z.string(),
  createdAt: Instant,
  /**
   * Oak 2.0 F6 (`album_tracks.shelved`): finished but on the Shelf, not on the album; counts as finished. Optional
   * until the W4 server returns it.
   */
  shelved: z.boolean().optional(),
});
export type AlbumTrack = z.infer<typeof AlbumTrackSchema>;
/** Oak 2.0 F6 (`album.patchTrack`): shelve a track or take it back off the Shelf. */
export const TrackPatchSchema = z.strictObject({ shelved: z.boolean() }).partial();
export type TrackPatch = z.infer<typeof TrackPatchSchema>;
export const AlbumTrackDetailSchema = AlbumTrackSchema.extend({ versions: z.array(AlbumTrackVersionSchema) });
export type AlbumTrackDetail = z.infer<typeof AlbumTrackDetailSchema>;
export const AlbumSchema = z.object({
  tracks: z.array(AlbumTrackSchema),
  /**
   * Wave 7 (wave7.md §5.5): the two sides of the record. Side A: the twelve core capstones; Side B: the eight
   * advanced-track capstones (`ALBUM_SIDES`). `released` counts released tracks of the side. Absent from an older
   * server (then every track is Side A, B-sides apart).
   */
  sides: z
    .array(
      z.object({
        side: z.enum(["A", "B"]),
        title: z.string(),
        released: z.number().int().nonnegative(),
        total: z.number().int().positive(),
      }),
    )
    .optional(),
});
export type Album = z.infer<typeof AlbumSchema>;
const trackVersionInput = {
  sketchId: z.string(),
  sketchVersion: z.number().int().positive(),
  linerNotesMd: z.string(),
  theoryTags: z.array(z.string()),
  attribution: z.string().nullable(),
};
export const AlbumTrackCreateSchema = z.strictObject({
  capstoneId: capstoneId.nullable(),
  side: z.enum(["A", "B", "Bside"]),
  title: z.string().min(1).max(120),
  flavour: flavour.nullable(),
  ...trackVersionInput,
});
export const AlbumTrackVersionCreateSchema = z.strictObject(trackVersionInput);

// --- audio and transcription --------------------------------------------------------------------

/** `audio_files` row. The ID is the file's sha256; audio never leaves the machine. */
export const AudioFileSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/),
  originalName: z.string(),
  mime: z.string(),
  bytes: z.number().int(),
  durationS: z.number().nullable(),
  sampleRate: z.number().nullable(),
  channels: z.number().nullable(),
  hasPeaks: z.boolean(),
  createdAt: Instant,
});
export type AudioFile = z.infer<typeof AudioFileSchema>;

const region = z.strictObject({
  id: z.string(),
  label: z.string(),
  startS: z.number(),
  endS: z.number(),
  kind: z.enum(["loop", "section"]),
});
/**
 * Wave 4 (docs/design/wave4.md §5.3): what Transcribe remembers of a project between visits: the player's rate,
 * transposition, fine-tune and A–B loop, and the learner's own notes. Rate is 25–100 % (contracts §6.12); a
 * pattern source ignores `fineTuneCents` and rounds its loop to whole bars.
 */
export const TranscriptionSettingsSchema = z.strictObject({
  rate: z.number().min(0.25).max(1),
  semitones: z.number().int().min(-12).max(12),
  fineTuneCents: z.number().min(-50).max(50),
  loop: z.strictObject({ startS: z.number().nonnegative(), endS: z.number().nonnegative() }).nullable(),
  /** The learner's own notes on the project (never sent to the tutor without the learner asking). */
  notes: z.string().max(4000),
  /**
   * Wave 5 (additive): the feel the learner hears in their own audio (contracts §6.10): `null` straight, absent =
   * not set. Own-audio projects only; a pattern source's feel is its `given.swing`.
   */
  swing: SwingSpecSchema.nullable().optional(),
});
export type TranscriptionSettings = z.infer<typeof TranscriptionSettingsSchema>;
export const DEFAULT_TRANSCRIPTION_SETTINGS: TranscriptionSettings = {
  rate: 1,
  semitones: 0,
  fineTuneCents: 0,
  loop: null,
  notes: "",
};

/** `transcriptions` row. `hiddenCode` (pattern sources) never reaches the browser's editors or DOM. */
export const TranscriptionSchema = z.object({
  id: z.string(),
  sourceKind: z.enum(["own-audio", "pd-song", "generated"]),
  /** `audio`: the learner's file through the stretch node. `pattern`: hidden reference code in a hidden adapter. */
  player: z.enum(["audio", "pattern"]),
  audioId: z.string().nullable(),
  songId: z.string().nullable(),
  title: z.string(),
  artist: z.string().nullable(),
  key: KeySpecSchema.nullable(),
  bpm: z.number().nullable(),
  meter: meterId.nullable(),
  downbeatS: z.number().nullable(),
  fineTuneCents: z.number().min(-50).max(50),
  ladderLevel: z.number().int().min(1).max(8).nullable(),
  realism: z.number().int().min(0).max(4).nullable(),
  regions: z.array(region),
  /** Self-assessment: item ID to a 0 to 2 score. */
  checklist: z.record(z.string(), z.number()),
  selfScore: z.number().nullable(),
  currentVersion: z.number().int(),
  status: z.enum(["in_progress", "done"]),
  review: z.unknown().nullable(),
  createdAt: Instant,
  updatedAt: Instant,
  /** Wave 4: the player settings and notes (absent from a server older than Wave 4: use the defaults). */
  settings: TranscriptionSettingsSchema.optional(),
  /**
   * Wave 4: a graded ladder pass (status pass at ≥ 0.85, not revealed) — what ladder milestones count
   * (wave3.md known gap: a finished generated transcription is no longer enough). Absent = false.
   */
  gradedPass: z.boolean().optional(),
  /** Wave 4: the gym session (`GYM.nn`) this project was worked in, if any. */
  gymId: z
    .string()
    .regex(/^GYM\.\d{2}$/)
    .nullable()
    .optional(),
});
export type Transcription = z.infer<typeof TranscriptionSchema>;
export const TranscriptionVersionSchema = z.object({
  transcriptionId: z.string(),
  version: z.number().int(),
  code: z.string(),
  createdAt: Instant,
  /**
   * Wave 5 (carry-over c2, contracts §11.3): set on a version that arrived through a backup import — code the
   * learner did not type here. Transcribe shows it and runs it only once the strict lint passes, until the learner
   * confirms it (`transcriptions.confirmVersion`). A version saved afterwards does not carry it.
   */
  reviewBeforeRun: z.literal(true).optional(),
});
export type TranscriptionVersion = z.infer<typeof TranscriptionVersionSchema>;
export const TranscriptionDetailSchema = TranscriptionSchema.extend({
  versions: z.array(TranscriptionVersionSchema),
  /** Pattern sources: the events to play, in place of the hidden code. Empty for own audio. */
  stimulus: z
    .object({
      events: z.array(NEventSchema),
      cps: z.number(),
      bars: z.number(),
      preload: z.array(z.string()),
      /**
       * Wave 4 integration (additive): a generated ladder item's performance hints, as `@oak/drills`
       * `LadderPiece.performance` made them — the part realism buries (R3), whether the comping swings (R2, jazz-soul)
       * and the vocal-like lead at R4. The browser passes them to `@oak/strudel` `realismSpec`. Absent on PD songs.
       */
      performance: z
        .object({
          target: z.string(),
          swung: z.boolean(),
          vocalLead: z.enum(["tenor", "choir"]).nullable(),
        })
        .optional(),
    })
    .nullable(),
  /**
   * Wave 5 (additive): what a pd-song project gives the learner (contracts §6.12): the song's pickup (bar numbers
   * count from the first full bar, c4), its feel (`null` straight; L6 and X2 blues swing) and its form label.
   * Absent for own audio and generated items.
   */
  given: z
    .object({
      pickup: PickupSpecSchema.nullable(),
      swing: SwingSpecSchema.nullable(),
      /** `null` for an L8 standard until its form map passed or was revealed (the form is what the stage asks). */
      form: z.string().nullable(),
      /**
       * Wave 6 (contracts §6.8): the keys of a tune that changes key, by bar (`SongDef.keyPlan`; the first entry is
       * the song's key); `null` or absent when it stays in one key. The key ribbon reads it.
       */
      keyPlan: z
        .array(z.strictObject({ bar: z.number().int().min(0), key: KeySpecSchema }))
        .nullable()
        .optional(),
    })
    .optional(),
});
export type TranscriptionDetail = z.infer<typeof TranscriptionDetailSchema>;
export const TranscriptionCreateSchema = z.strictObject({
  sourceKind: z.enum(["own-audio", "pd-song", "generated"]),
  audioId: z.string().nullable(),
  songId: z.string().nullable(),
  title: z.string().min(1).max(200),
  artist: z.string().nullable(),
  ladderLevel: z.number().int().min(1).max(8).nullable(),
  templateId: z.string().nullable(),
});
export const TranscriptionPatchSchema = z
  .strictObject({
    title: z.string().min(1).max(200),
    artist: z.string().nullable(),
    key: KeySpecSchema.nullable(),
    bpm: z.number().positive().nullable(),
    meter: meterId.nullable(),
    downbeatS: z.number().nullable(),
    fineTuneCents: z.number().min(-50).max(50),
    regions: z.array(region),
    /** Self-assessment, 0 to 2 per item (contracts §6.12): each change is self-reported evidence, so out of range is refused. */
    checklist: z.record(z.string().max(64), z.number().min(0).max(2)),
    selfScore: z.number().nullable(),
    status: z.enum(["in_progress", "done"]),
    /** Wave 5: the own-audio feel (`null` straight); stored in `settings.swing`. */
    swing: SwingSpecSchema.nullable(),
  })
  .partial();
export const TranscriptionVersionCreateSchema = z.strictObject({
  sessionId: z.string().nullable(),
  code: z.string().max(60_000),
  result: GradeResultSchema.nullable(),
  ranOk: z.boolean(),
  /**
   * Wave 4: the code is a "Hum it, Oak drafts it" draft the learner has not edited yet (contracts §6.12): it gives
   * no evidence until a corrected version is checked. Default false.
   */
  machineDraft: z.boolean().optional(),
});

// --- telemetry and QA (contracts §9.7, §11.8) ---------------------------------------------------

/** `step_telemetry` row. Local only; shown on Progress › Your sessions (`/progress/sessions`). */
export const StepTelemetrySchema = z.strictObject({
  sessionId: z.string(),
  lessonId: z.string(),
  lessonVersion: z.number().int(),
  stepId: z.string(),
  stepKind: z.string(),
  targetMinutes: TargetMinutesSchema,
  authoredMinutes: z.number(),
  scaledMinutes: z.number(),
  startedAt: Instant,
  endedAt: Instant,
  /** Time with focus; idle over 60 s removed. */
  activeMs: z.number().nonnegative(),
  attempts: z.number().int().nonnegative(),
  maxHintRung: RungSchema,
  tutorMessages: z.number().int().nonnegative(),
  passed: z.boolean(),
  skipped: z.boolean(),
  testedOut: z.boolean(),
  splitPart: z.enum(["A", "B"]).nullable(),
});
export type StepTelemetry = z.infer<typeof StepTelemetrySchema>;
/** `session_telemetry` row, derived by the server when a session ends. */
export const SessionTelemetrySchema = z.object({
  sessionId: z.string(),
  day: Day,
  targetMinutes: TargetMinutesSchema,
  kind: z.enum(SESSION_KINDS),
  warmupMs: z.number(),
  newMs: z.number(),
  makeMs: z.number(),
  codaMs: z.number(),
  totalActiveMs: z.number(),
  warmupSets: z.number().int(),
  warmupPlannedSec: z.number(),
  dueSecBefore: z.number(),
  dueSecAfter: z.number(),
  deferredCards: z.number().int(),
  /** Warm-up overflow: seconds of due review left beyond the planned warm-up (never shown to the learner). */
  overflowSec: z.number(),
  wrappedEarly: z.boolean(),
  split: z.boolean(),
});
export type SessionTelemetry = z.infer<typeof SessionTelemetrySchema>;
/**
 * What Progress › Your sessions shows (contracts §9.7), computed by the server from the rows: per lesson
 * actual vs scaled minutes (flagged above 1.15 ×), daily review seconds against the warm-up budget, warm-up
 * overflow, and whether the rolling multiplier asks for a new BEGINNER_FACTOR (outside 1.25–1.55).
 * Wave 2 addition.
 */
export const TelemetryAggregatesSchema = z.object({
  lessons: z.array(
    z.object({
      lessonId: z.string(),
      lessonVersion: z.number().int(),
      steps: z.number().int(),
      activeMin: z.number(),
      authoredMin: z.number(),
      scaledMin: z.number(),
      /** activeMin / scaledMin; `null` with no scaled minutes. */
      ratio: z.number().nullable(),
      /** Over 1.15 × its scaled budget. */
      flagged: z.boolean(),
      lastAt: Instant,
    }),
  ),
  days: z.array(
    z.object({
      day: Day,
      sessions: z.number().int(),
      reviewSec: z.number(),
      plannedSec: z.number(),
      budgetSec: z.number(),
      overflowSec: z.number(),
      activeMin: z.number(),
    }),
  ),
  /** Rolling multiplier outside 1.25–1.55: time to revisit BEGINNER_FACTOR. */
  multiplierPrompt: z.boolean(),
  overflow: z.object({ sessions: z.number().int(), meanSec: z.number(), maxSec: z.number() }),
});
export type TelemetryAggregates = z.infer<typeof TelemetryAggregatesSchema>;

export const TelemetryReportSchema = z.object({
  steps: z.array(StepTelemetrySchema),
  sessions: z.array(SessionTelemetrySchema),
  aggregates: TelemetryAggregatesSchema,
  /** median(active content time / authored minutes) over the last 10 lessons; prompt when it leaves 1.25 to 1.55. */
  rollingMultiplier: z.number().nullable(),
  forecastSec: z.array(z.number()),
  tutor: z.object({ cacheHitRatio: z.number(), costUsd: z.number() }),
});
export type TelemetryReport = z.infer<typeof TelemetryReportSchema>;

export const QA_KINDS = [
  "lesson-step",
  "drill-trial",
  "checkpoint-item",
  "capstone-rubric",
  "ladder-transcription",
] as const;
export const QaReportCreateSchema = z.strictObject({
  kind: z.enum(QA_KINDS),
  lessonId: z.string().nullable(),
  stepId: z.string().nullable(),
  exerciseId: z.string().nullable(),
  exerciseVersion: z.number().int().nullable(),
  familyId: z.string().nullable(),
  trialSeed: z.number().int().nullable(),
  params: z.record(z.string(), z.unknown()).nullable(),
  /** The code or answer. */
  response: z.unknown(),
  gradeResult: GradeResultSchema.nullable(),
  hintRung: RungSchema,
  note: z.string().max(2000).nullable(),
  /** The attempt to mark disputed: no mastery evidence, no SRS rating. */
  attemptId: z.number().int().nullable(),
});
export type QaReportCreate = z.infer<typeof QaReportCreateSchema>;
/** `qa_reports` row. Nothing leaves the machine. */
export const QaReportSchema = QaReportCreateSchema.omit({ attemptId: true }).extend({
  id: z.number().int(),
  at: Instant,
  contentVersion: z.string().nullable(),
  appVersion: z.string(),
  status: z.enum(["open", "triaged", "fixed", "wontfix"]),
});
export type QaReport = z.infer<typeof QaReportSchema>;

// --- progress page, confirm nonce, backup, bootstrap --------------------------------------------

export const ProgressReportSchema = z.object({
  canDo: z.array(CanDoEntrySchema),
  /** Every milestone of `content/milestones.ts`, in registry order; `reachedAt` null until reached. */
  milestones: z.array(
    z.object({ id: z.string(), title: z.string(), description: z.string(), reachedAt: Instant.nullable() }),
  ),
  /** Shown as a month, never as a count of sessions behind. `null` until there is enough data. */
  paceEstimate: z
    .object({ coreDoneBy: z.string().regex(/^\d{4}-\d{2}$/), sessionsPerWeek: z.number() })
    .nullable(),
  streak: StreakSummarySchema,
});
export type ProgressReport = z.infer<typeof ProgressReportSchema>;

/** Destructive actions (contracts §11.6). Each needs `X-Oak-Confirm: <nonce>`. */
export const CONFIRM_ACTIONS = [
  "backup.import",
  "data.reset",
  "sketch.delete",
  "track.delete",
  "audio.delete",
  "transcription.delete",
  "anthropic-key.delete",
  /** Wave 5 (carry-over c11): re-recording an album version replaces its earlier recording. */
  "album.audio.replace",
  /** Oak 2.0 (contracts §13): deleting a saved scrap or one of the learner's templates. */
  "scrap.delete",
  "template.delete",
] as const;
export type ConfirmAction = (typeof CONFIRM_ACTIONS)[number];
export const ConfirmRequestSchema = z.strictObject({
  action: z.enum(CONFIRM_ACTIONS),
  /** The ID the action applies to, or `*`. */ target: z.string().min(1),
});
/** Single-use, lives 60 seconds, bound to `(action, target)`, kept in server memory only. */
export const ConfirmNonceSchema = z.object({ nonce: z.string().min(16), expiresAt: Instant });
export type ConfirmNonce = z.infer<typeof ConfirmNonceSchema>;

/** `backup.json` inside a `.oakbackup` archive. The API key and `~/.oak/secrets` are never included. */
export const BackupManifestSchema = z.object({
  format: z.literal("oak-backup"),
  formatVersion: z.number().int().positive(),
  schemaVersion: z.number().int().nonnegative(),
  contentVersion: z.string().nullable(),
  exportedAt: Instant,
  /** Table name to rows, as stored. */
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  /** `audio/<sha256>.<ext>` and `album/<trackId>/v<n>.<ext>` entries present in the archive. */
  files: z.array(z.object({ path: z.string(), bytes: z.number().int(), sha256: z.string() })).exactOptional(),
});
export type BackupManifest = z.infer<typeof BackupManifestSchema>;
export const BACKUP_FORMAT_VERSION = 1;
export const BackupInfoSchema = z.object({
  bytesWithAudio: z.number().int(),
  bytesWithoutAudio: z.number().int(),
  lastAutomatic: Day.nullable(),
  /**
   * Wave 4 integration (additive): the learner's own recordings (`audio.upload`) — all of them, and those no
   * transcription project uses any more (left behind by a deleted project). Absent from older servers.
   */
  ownAudio: z
    .object({
      files: z.number().int().nonnegative(),
      bytes: z.number().int().nonnegative(),
      unusedFiles: z.number().int().nonnegative(),
      unusedBytes: z.number().int().nonnegative(),
    })
    .optional(),
  /** Wave 4 integration (additive): bytes of the album's recordings (every version). */
  albumAudioBytes: z.number().int().nonnegative().optional(),
  /** Wave 5 (additive): each album recording's size, by track and version (Settings › Data lists them). */
  albumAudio: z
    .array(
      z.object({
        trackId: z.string(),
        version: z.number().int().min(1),
        bytes: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});
export type BackupInfo = z.infer<typeof BackupInfoSchema>;
export const BackupImportResultSchema = z.object({
  ok: z.literal(true),
  tables: z.number().int(),
  rows: z.number().int(),
  audioFiles: z.number().int(),
  /** Audio of the replaced data that the imported tables no longer reference, moved beside the safety copy. */
  orphanedFiles: z.number().int(),
  migratedFrom: z.number().int().nullable(),
  safetyCopy: z.string(),
});

export const BootstrapSchema = z.object({
  health: HealthSchema,
  profile: ProfileSchema,
  settings: SettingsSchema,
  unlocks: z.array(UnlockSchema),
  streak: StreakSummarySchema,
  /** Glossary terms from completed lessons. */
  terms: z.array(TermIntroducedSchema),
  /** The learner-local day now. */
  day: Day,
  /** A session left open today, to resume. */
  openSession: SessionSchema.nullable(),
});
export type Bootstrap = z.infer<typeof BootstrapSchema>;

// --- server grader (dev tools, e2e) -------------------------------------------------------------

export const GradeRequestSchema = z.strictObject({
  /** Global exercise ID. */
  exerciseId: z.string(),
  response: AttemptResponseSchema,
  params: z.record(z.string(), z.union([z.number(), z.string()])).nullable(),
  mode: z.enum(["lesson", "capstone"]),
});
export const AnalyzeRequestSchema = z.strictObject({
  code: z.string().max(60_000),
  bars: z.number().int().min(1).max(128),
  mode: z.enum(["lesson", "capstone", "tutor"]),
});
export const AnalyzeResponseSchema = z.object({
  ok: z.boolean(),
  error: z.object({ kind: z.string(), message: z.string(), line: z.number().nullable() }).nullable(),
  cps: z.number().nullable(),
  bpm: z.number().nullable(),
  tracks: z.array(z.string()),
  events: z.array(NEventSchema),
  logs: z.array(z.object({ level: z.enum(["error", "warn", "log"]), text: z.string() })),
  analysis: AnalysisSummarySchema.nullable(),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export { GradeResultSchema };

// --- Wave 2 additions (docs/design/wave2.md §4) -------------------------------------------------
// Each one names the surface that needs it. Additive: no existing schema changed.

/** `GET /lessons/:id/steps`: every step's state in one call (the step rail, resume, "new since you finished"). */
export const LessonStepsSchema = z.object({
  lessonId,
  /** `null` until the lesson was first opened. */
  progress: LessonProgressSchema.nullable(),
  /** One per authored step, in lesson order (steps without an exercise report `passed` once visited). */
  steps: z.array(StepStateSchema),
});
export type LessonSteps = z.infer<typeof LessonStepsSchema>;

/**
 * `PUT /lessons/:id/position`: where the learner is in a lesson, so the next session resumes there
 * (contracts §9.3 pause and resume; §9.4 "Wrap up" before the Make resumes at the next unfinished step).
 */
export const LessonPositionSchema = z.strictObject({
  sessionId: z.string().nullable(),
  /** The step now on screen (local ID, `S5`). */
  stepId: z.string().min(1),
  /** 15-minute split: the part being played. */
  splitPart: z.enum(["A", "B"]).nullable(),
  /** True when the learner pressed "Wrap up": the Quick sketch follows and the lesson stays in progress. */
  wrapped: z.boolean(),
});
export type LessonPosition = z.infer<typeof LessonPositionSchema>;

/** `POST /capstones/:id/release`: the first (or a new) album release of a capstone draft (ux §5.3). */
export const CapstoneReleaseSchema = z.strictObject({
  sessionId: z.string().nullable(),
  sketchId: z.string(),
  sketchVersion: z.number().int().positive(),
  title: z.string().min(1).max(120),
  flavour: flavour.nullable(),
  /** Deterministic liner notes (the tutor's liner note is added only if the learner chooses it). */
  linerNotesMd: z.string().max(4000),
  theoryTags: z.array(z.string()).max(12),
  /** Whether the review's liner note goes into the album (`Settings.linerNotesInAlbum` is the default). */
  includeReviewNote: z.boolean(),
});
export type CapstoneRelease = z.infer<typeof CapstoneReleaseSchema>;
export const CapstoneReleaseResultSchema = z.object({
  state: CapstoneStateSchema,
  /** The album track with the new version (render its audio next with `album.putAudio`). */
  track: AlbumTrackDetailSchema,
  unlocks: z.array(UnlockSchema),
  canDo: z.array(CanDoEntrySchema),
  streak: StreakSummarySchema,
});
export type CapstoneReleaseResult = z.infer<typeof CapstoneReleaseResultSchema>;

/**
 * `GET /unlocks/next`: the goal-gradient line of Today and the Coda ("2 lessons → .voicing()", ux §1.4, §1.6).
 * Sorted nearest first; at most 3.
 */
export const NextUnlockSchema = z.object({
  itemId: unlockable,
  kind: z.enum(UNLOCK_KINDS),
  /** The map item whose completion grants it. */
  grantedBy: SessionIdSchema,
  /** Map sessions still to complete in the default order, counting `grantedBy` itself (≥ 1). */
  remaining: z.number().int().positive(),
  /** What `remaining` counts, for the copy ("2 lessons", "1 checkpoint"). */
  remainingKind: z.enum(["lesson", "checkpoint", "capstone", "session"]),
});
export type NextUnlock = z.infer<typeof NextUnlockSchema>;

export const ONBOARDING_STEPS = [
  "welcome",
  "loop",
  "edit",
  "react",
  "tutor",
  "headphones",
  "mic",
  "latency",
  "range",
  "first-sing",
  "prefs",
  "sketch",
  "coda",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
/** Onboarding = U00.L01 "Hello, loop" (ux §8). Survives a reload; `profile.onboardedAt` marks the end. */
export const OnboardingStateSchema = z.object({
  /** The step to show now. */
  step: z.enum(ONBOARDING_STEPS),
  completed: z.array(z.enum(ONBOARDING_STEPS)),
  /** Steps the learner skipped (no mic, no headphones): set up later in Settings. */
  skipped: z.array(z.enum(ONBOARDING_STEPS)),
  /** The degree the learner typed at `edit` (0–7, n = degree − 1), which keys the `react` copy. */
  firstEdit: z.number().int().min(0).max(7).nullable(),
  /** Sketch 001, saved at `sketch`. */
  sketchId: z.string().nullable(),
  startedAt: Instant.nullable(),
  finishedAt: Instant.nullable(),
});
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;
export const OnboardingPatchSchema = z
  .strictObject({
    step: z.enum(ONBOARDING_STEPS),
    completed: z.array(z.enum(ONBOARDING_STEPS)),
    skipped: z.array(z.enum(ONBOARDING_STEPS)),
    firstEdit: z.number().int().min(0).max(7).nullable(),
    sketchId: z.string().nullable(),
    /** True on the last step: the server also sets `profile.onboardedAt`. */
    finished: z.boolean(),
  })
  .partial();
export type OnboardingPatch = z.infer<typeof OnboardingPatchSchema>;

/** `calibration_runs` row, newest first in `GET /profile/calibrations` (Settings → Voice, Audio). */
export const CalibrationRecordSchema = z.object({
  id: z.number().int(),
  kind: z.enum(CALIBRATION_KINDS),
  result: z.record(z.string(), z.unknown()),
  at: Instant,
});
export type CalibrationRecord = z.infer<typeof CalibrationRecordSchema>;

/** Settings › Listening pass verdicts (architecture §3.8), moved from localStorage to the server. */
export const LISTEN_VERDICTS = ["ok", "wrong-sound", "wrong-notation", "weak", "wrong-theory"] as const;
export const ListenMarkCreateSchema = z.strictObject({
  /** Hash of the code the verdict was given on: a verdict is stale once the code changes. */
  hash: z.string().min(1).max(64),
  verdict: z.enum(LISTEN_VERDICTS),
  note: z.string().max(2000),
});
export const ListenMarkSchema = z.object({
  /** `U01.L02@slug`. */
  ref: z.string(),
  hash: z.string(),
  verdict: z.enum(LISTEN_VERDICTS),
  note: z.string(),
  at: Instant,
});
export type ListenMark = z.infer<typeof ListenMarkSchema>;

// --- Wave 2 Build additions (server engineer; dev only) ----------------------------------------

/**
 * `POST /dev/seed` (OAK_DEV=1): wipe the learner's data and fast-forward to a named point of the default
 * order, one simulated day per map session, ending yesterday (so today is a fresh day). For other engineers'
 * e2e. Points (case-insensitive): `fresh`, `onboarded`, `after <SessionId>` (e.g. `after U01.L03`,
 * `after U01.CP`, `after C0.S1`), `U01.CP due`, `U01.CP failed`, `U01.CP failed twice`, `C0 ready`,
 * `C0 in progress`, `C0 released`, `U02.CP due`, `C1 ready`, `C1 in progress`, `C1 released`, and
 * `<N>-day gap` (the base `after U01.L03` with `gapDays: N`). Wave 3 adds `WAVE3_SEED_POINTS` (end of this
 * file). `GET /dev/seed` lists them.
 */
export const DevSeedRequestSchema = z.strictObject({
  point: z.string().min(1).max(80),
  /**
   * Days with no practice between the last seeded activity and today: the gap of contracts §7.9 as the
   * planner counts it (0, the default: the last session was yesterday; 3+ return warm-up; 10+ Light lesson).
   */
  gapDays: z.number().int().min(0).max(400).optional(),
  targetMinutes: z.union([z.literal(15), z.literal(20), z.literal(25)]).optional(),
  /** Do one warm-up review set on each simulated day (default true): SRS cards have history. */
  practice: z.boolean().optional(),
  /**
   * Wave 3: the learner has a working microphone and a calibrated range (default true, as after onboarding's
   * mic and range steps). `false`: no microphone (`inputKind: "none"`, Quiet mode with reason `no-mic`).
   */
  mic: z.boolean().optional(),
  /**
   * Wave 4 (additive): each capstone release the seeder makes gets a recording (default true). `false`: the album
   * holds released tracks with no recording yet, as before Wave 4.
   */
  recordings: z.boolean().optional(),
});
export type DevSeedRequest = z.infer<typeof DevSeedRequestSchema>;
export const DevSeedResultSchema = z.object({
  point: z.string(),
  /** Map sessions completed, in order. */
  done: z.array(z.string()),
  /** The next map item in the default order. */
  next: z.string().nullable(),
  /** The learner day now and the last day with activity. */
  day: z.string(),
  lastActiveDay: z.string().nullable(),
  /** Days without practice between `lastActiveDay` and `day` (contracts §7.9). */
  gapDays: z.number().int(),
  /** IDs created on the way, for specs that need them. */
  sketchIds: z.array(z.string()),
  capstoneSketchId: z.string().nullable(),
  trackId: z.string().nullable(),
});
export type DevSeedResult = z.infer<typeof DevSeedResultSchema>;
export const DevSeedPointSchema = z.object({ point: z.string(), description: z.string() });
export type DevSeedPoint = z.infer<typeof DevSeedPointSchema>;

/** `GET/PUT /dev/clock`: the server's clock in dev (`OAK_NOW=<ISO>` sets it at start-up). */
export const DevClockSchema = z.object({
  now: Instant,
  /** The learner day of `now` (04:00 rollover in the profile's zone). */
  day: z.string(),
  /** Milliseconds added to the real clock (0 when not moved). */
  offsetMs: z.number(),
  /** A frozen clock does not move with real time. */
  frozen: z.boolean(),
});
export type DevClock = z.infer<typeof DevClockSchema>;
export const DevClockSetSchema = z.strictObject({
  /** Jump to this instant. */
  at: Instant.optional(),
  advanceMs: z.number().int().optional(),
  advanceDays: z.number().int().min(-400).max(400).optional(),
  /** Stop (true) or restart (false) the clock at its current reading. */
  freeze: z.boolean().optional(),
  /** Back to real time (offset 0, running). Applied first. */
  reset: z.boolean().optional(),
});
export type DevClockSet = z.infer<typeof DevClockSetSchema>;

// --- Wave 3 additions (docs/design/wave3.md §5) ----------------------------------------------------
// Each names the surface that needs it. Additive: existing fields are unchanged; the few new request fields
// above are optional, and every new endpoint answers a typed 501 until the server engineer builds it.

/**
 * `GET /session/day`: today's sessions as the server stores them, so Today's "done for today" survives a
 * reload and another browser (wave2.md known gap 3). One open session per learner day: `session.start` on a
 * day with an open session returns that session instead of starting a second (docs/design/wave3.md §5.1).
 */
export const SessionDaySchema = z.object({
  day: Day,
  /**
   * The session left open today (also `bootstrap.openSession`). Wave 6 (d21): with `?tab=<tabId>` it is THAT tab's
   * open session (`null` when the tab has none, even if another tab has one); without `tab` the newest open one.
   */
  open: SessionSchema.nullable(),
  /** Wave 6 (d21): every session open today, oldest first (two tabs: two). Absent from older servers. */
  openSessions: z.array(SessionSchema).optional(),
  /** Sessions ended today, oldest first. */
  ended: z.array(SessionSchema),
  /**
   * True once a planned session (kind lesson, checkpoint, capstone, gym, keepalive, light or review) ended today:
   * Today shows the done state with "More practice" and Studio. Studio sessions never count.
   */
  doneForToday: z.boolean(),
  /** The session whose summary the done state links to (`session.summary`), the last planned one ended. */
  summarySessionId: z.string().nullable(),
});
export type SessionDay = z.infer<typeof SessionDaySchema>;

/** One day of graded sung notes inside the ladder's 21-day window (contracts §8.2). */
export const VoiceLadderDaySchema = z.object({
  day: Day,
  /** Graded sung notes that day (Quiet, skipped and calibration notes excluded). */
  notes: z.number().int().nonnegative(),
  /** Median |cents error| of those notes; `null` with no notes. */
  medianAbsCents: z.number().nullable(),
  /** ≥ 8 notes and a median at or under the next step's bar. */
  qualifies: z.boolean(),
});
/**
 * The sing tolerance ladder 70 → 50 → 35 → 25 (contracts §8.2), as the server keeps it. It is updated from
 * evidence the server already receives: `drills.trials` (sung responses and `sungResolution`) and
 * `steps.attempt` (sung responses); never by unit or date, never while a checkpoint is pending.
 */
export const VoiceLadderSchema = z.object({
  cents: SingTolCentsSchema,
  mode: z.enum(["auto", "fixed"]),
  /** The next rung and the median it needs on 3 days; `null` at ±25¢ or in fixed mode. */
  next: z.object({ cents: SingTolCentsSchema, medianAtMost: z.number() }).nullable(),
  /** The days inside the 21-day window with any graded sung notes, oldest first. */
  days: z.array(VoiceLadderDaySchema),
  /** Qualifying days in the window, and how many tightening needs (3). */
  qualifyingDays: z.number().int().nonnegative(),
  daysNeeded: z.number().int().positive(),
  /**
   * Tightening is held while a checkpoint the planner has offered (within the last 14 learner days) is not yet
   * passed or soft-passed (decision 29).
   */
  held: z.object({ reason: z.literal("checkpoint-pending"), checkpointId: z.string() }).nullable(),
  /** After a gap of 21 days or more: a one-tap loosen is offered (Settings → Voice, the return day). */
  offerLoosen: z.boolean(),
  /** The last change, announced once in the Coda (`SessionSummary.toleranceChange`). */
  lastChange: z
    .object({
      from: SingTolCentsSchema,
      to: SingTolCentsSchema,
      at: Instant,
      reason: z.enum(["evidence", "learner", "loosen"]),
    })
    .nullable(),
});
export type VoiceLadder = z.infer<typeof VoiceLadderSchema>;

export const QUIET_REASONS = ["today", "always", "no-mic"] as const;
/**
 * `GET /voice`: the voice state drills and lessons read before asking for the mic (contracts §8.5): Quiet mode
 * for today, the vocal range and the tolerance ladder. One request; the drill runner and the lesson's sing
 * steps never derive Quiet mode on their own.
 */
export const VoiceStateSchema = z.object({
  day: Day,
  /** Quiet mode is in effect today. */
  quiet: z.boolean(),
  /** Why: toggled for today, set always, or no usable mic (`profile.inputKind === "none"`). */
  quietReason: z.enum(QUIET_REASONS).nullable(),
  /** From the range sweep; `null` until calibrated (drills then use the defaults of `toLearnerProfile`). */
  range: z
    .object({
      low: z.number(),
      high: z.number(),
      comfortLow: z.number(),
      comfortHigh: z.number(),
    })
    .nullable(),
  /** Singing labels: numbers until U03.L08 introduces syllables (contracts §8.3). */
  labels: z.enum(["numbers", "syllables"]),
  ladder: VoiceLadderSchema,
});
export type VoiceState = z.infer<typeof VoiceStateSchema>;
/** `PUT /voice/quiet`: the mic chip and Settings → Voice. `today` lapses at the next learner day. */
export const VoiceQuietSetSchema = z.strictObject({
  quiet: z.boolean(),
  scope: z.enum(["today", "always"]),
});
export type VoiceQuietSet = z.infer<typeof VoiceQuietSetSchema>;
/** `PUT /voice/ladder`: Settings → Voice (Auto / ±70 / ±50 / ±35 / ±25) and the one-tap loosen. */
export const VoiceLadderSetSchema = z
  .strictObject({
    /** `auto`: tighten from evidence; `fixed`: hold `cents`; `loosen`: one rung looser (only when `offerLoosen`). */
    mode: z.enum(["auto", "fixed", "loosen"]),
    /** Required with `fixed`, absent otherwise. */
    cents: SingTolCentsSchema.optional(),
  })
  .refine((b) => (b.mode === "fixed") === (b.cents !== undefined), {
    message: "cents is given with mode 'fixed' and only then",
    path: ["cents"],
  });
export type VoiceLadderSet = z.infer<typeof VoiceLadderSetSchema>;

/** `GET /drills/sessions/:id`: a drill set with its stored trials (resume after a reload, the set summary). */
export const DrillSessionDetailSchema = z.object({
  session: DrillSessionSchema,
  trials: z.array(DrillTrialRecordSchema),
});
export type DrillSessionDetail = z.infer<typeof DrillSessionDetailSchema>;

/**
 * Dev seed points Wave 3 e2e needs (`POST /dev/seed`, `point`). The server engineer implements them first;
 * `GET /dev/seed` lists what exists. "after U03.L02" and the U03/U04 points need the U03/U04 content.
 */
export const WAVE3_SEED_POINTS = [
  "after U02.CP",
  "C1 released",
  "after U03.L02",
  "U03.CP due",
  "after U03.CP",
  "U04.CP due",
  "after U04.CP",
] as const;
export type Wave3SeedPoint = (typeof WAVE3_SEED_POINTS)[number];

// --- Wave 4 additions (docs/design/wave4.md §5) ----------------------------------------------------
// Harmony, album and transcription. Additive: existing shapes only gained optional fields (above); every new
// endpoint answers a typed 501 until the server engineer builds it (`WAVE4_ENDPOINTS` in contract.ts).

const gymId = z.string().regex(/^GYM\.\d{2}$/);
const capstoneSessionId = idSchema("capstoneSession");
/**
 * Wave 5: L5 (PD folk, per phrase) and L6 (blues, staged) join the generated L1–L4 (contracts §2.9). Wave 6: L7 (the
 * learner's own audio, self-assessed: reported, never an item) and L8 (a full arrangement of a public-domain
 * standard, staged form → bass → changes → melody; docs/design/wave6.md §5.4).
 */
const ladderLevel = z.number().int().min(1).max(8);
/** A level an item can be drawn at or the ladder set to: 1–6 and 8. L7 is own audio: a project, never an item. */
const ladderItemLevel = ladderLevel.refine((l) => l !== 7, {
  message: "L7 is your own audio, not a ladder item",
});
/**
 * Wave 5: ladder stages. L3 (generated chords): `bass` → `quality` → `rn`. L6 (blues and standards, X2's order):
 * `bass` → `changes` → `melody`. L5 is per phrase and has no stages. Wave 6, L8 (a standard, CF-T's order):
 * `form` → `bass` → `changes` → `melody`; `form` is the form map (an answer, no code) and is appended here so the
 * Wave 5 order of the array is unchanged.
 */
export const LADDER_STAGES = ["bass", "quality", "rn", "changes", "melody", "form"] as const;
export type LadderStageId = (typeof LADDER_STAGES)[number];
const realismLevel = z.number().int().min(0).max(4);

// capstones: one capstone over several sessions (C2.S1–S2, X1.S1–S3; contracts §2.4, §6.6) -----------------

export const CAPSTONE_SESSION_STATUSES = ["locked", "open", "in_progress", "done"] as const;
/**
 * The state of one graded check of a transcribe capstone session (content-kit `CapstoneSessionDef.checks`,
 * `PhraseCheck`): a phrase's melody by ear (X1: `melody`, key-relative, ≥ 0.85), or one stage of its chords
 * bass-first (`bass` → `quality` → `rn`, each ≥ 0.80, in order). One row per check, and per stage for staged ones.
 */
export const CapstoneCheckStateSchema = z.object({
  /** `PhraseCheck.id` (slug, unique in the capstone). */
  checkId: z.string(),
  /** 1-based phrase, or `[from, to]` for several phrases checked together. */
  phrase: z.union([z.number().int().min(1), z.tuple([z.number().int().min(1), z.number().int().min(1)])]),
  /** Wave 6: `form` is the form map of a transcribe capstone session (content-kit `FormMapCheck`, CF-T.S1). */
  layer: z.enum(["melody", "bass", "chords", "form"]),
  /** The stage of a staged chords check; `null` otherwise. */
  stage: z.enum(["bass", "quality", "rn"]).nullable(),
  /** Locked until the stage before it passed. */
  open: z.boolean(),
  /** Best score so far; `null` before the first check. */
  score: z.number().min(0).max(1).nullable(),
  passed: z.boolean(),
  /** Revealed with hint 4: no evidence, named in the liner notes. */
  revealed: z.boolean(),
  attempts: z.number().int().nonnegative(),
  lastAt: Instant.nullable(),
  /**
   * Wave 5 (X2: bass ≥ 0.90, then changes ≥ 0.85, then melody ≥ 0.85, "stages in that order"; content-kit
   * `PhraseCheck.after`): the checks that must pass (or be revealed) before this one opens, and this check's own
   * pass mark. Absent: no order (X1 phrases) and the content's mark.
   */
  after: z.array(z.string()).optional(),
  passAt: z.number().min(0).max(1).optional(),
});
export type CapstoneCheckState = z.infer<typeof CapstoneCheckStateSchema>;
/** One session of a capstone (`C2.S1`): its status, its draft and, for X1, its phrase and stage checks. */
export const CapstoneSessionStateSchema = z.object({
  capstoneSessionId,
  status: z.enum(CAPSTONE_SESSION_STATUSES),
  /** The Oak session (`sessions` row) it was worked in, when started from Today. */
  sessionId: z.string().nullable(),
  /** The latest saved draft (a sketch version; "the draft save is the Make", contracts §9.1). */
  draft: z
    .object({ sketchId: z.string(), sketchVersion: z.number().int().positive(), savedAt: Instant })
    .nullable(),
  /** Transcribe capstones: the session's checks (X1.S1: phrases 1–2; S2: 3–4; S3: chords by stage). Empty for compositions. */
  checks: z.array(CapstoneCheckStateSchema),
  startedAt: Instant.nullable(),
  completedAt: Instant.nullable(),
});
export type CapstoneSessionState = z.infer<typeof CapstoneSessionStateSchema>;
/** `GET /capstones/:id/sessions`. */
export const CapstoneSessionsSchema = z.object({
  capstoneId,
  sessions: z.array(CapstoneSessionStateSchema),
  /** The session to work in next (`X1.S2`), `null` once all are done. */
  current: capstoneSessionId.nullable(),
  /**
   * Wave 7 (docs/design/wave7.md §5.4; content-kit `CapstoneDef.versions`, AC1 "One Tune, Two Genres"): a capstone
   * made of two pieces of code, each its own draft (its own sketch), released together as one album track with both
   * versions. Absent for every other capstone and from an older server.
   */
  versions: z
    .array(
      z.object({
        id: z.enum(["a", "b"]),
        label: z.string(),
        startsIn: capstoneSessionId,
        draft: z
          .object({ sketchId: z.string(), sketchVersion: z.number().int().positive(), savedAt: Instant })
          .nullable(),
      }),
    )
    .optional(),
});
export type CapstoneSessions = z.infer<typeof CapstoneSessionsSchema>;
/** `POST /capstones/:id/drafts`: a draft saved in a capstone session (also counts as the session's Make). */
export const CapstoneDraftSaveSchema = z.strictObject({
  capstoneSessionId,
  sessionId: z.string().nullable(),
  sketchId: z.string(),
  sketchVersion: z.number().int().positive(),
  /** Wave 7: which version of a two-version capstone this draft belongs to (AC1); absent for every other capstone. */
  versionId: z.enum(["a", "b"]).optional(),
});
export type CapstoneDraftSave = z.infer<typeof CapstoneDraftSaveSchema>;
/** `POST /capstones/:id/checks/:checkId`: one transcribe-capstone check (or stage) graded in the browser. */
export const CapstoneCheckRecordSchema = z.strictObject({
  capstoneSessionId,
  /** For a staged chords check: the stage this result answers. */
  stage: z.enum(["bass", "quality", "rn"]).nullable(),
  sketchId: z.string(),
  sketchVersion: z.number().int().positive(),
  result: GradeResultSchema,
  idempotencyKey: IdempotencyKeySchema.optional(),
});
export type CapstoneCheckRecord = z.infer<typeof CapstoneCheckRecordSchema>;
/** What a capstone needs to open, and what is met (contracts §2.4; X1: U07.CP, C2 released, `fam.mel.dictation` ≥ 4). */
export const CapstoneGateConditionSchema = z.object({
  /** `lesson` (build phase, additive): a lesson that must be completed (CF-T opens at U15.L01). */
  kind: z.enum(["checkpoint", "capstone", "family-level", "lesson"]),
  /** `U07.CP`, `C2`, `fam.mel.dictation`, `U15.L01`. */
  ref: z.string(),
  /** Plain copy: "U07 checkpoint passed", "C2 released", "Melodic dictation at level 4". */
  label: z.string(),
  met: z.boolean(),
  /** Family level now and needed (`family-level` only). */
  have: z.number().int().nullable(),
  need: z.number().int().nullable(),
});
export const CapstoneGateSchema = z.object({
  capstoneId,
  open: z.boolean(),
  conditions: z.array(CapstoneGateConditionSchema),
  /** X1 only: gym sets the planner schedules to reach the family level ("Two more gym sets open X1"); else `null`. */
  gymSetsToOpen: z.number().int().nonnegative().nullable(),
  /** The one line Today and the capstone page show while closed ("Two more gym sets open X1"); `null` when open. */
  message: z.string().nullable(),
  /**
   * Wave 7 (wave7.md §5.3): a capstone whose tunes open separately (AC1: St. Louis Blues with the capstone, Sweet
   * Georgia Brown once U15.L05 is completed, and only songs whose answer key passed review are listed). Absent for
   * every other capstone.
   */
  tunes: z
    .array(
      z.object({
        songId: z.string(),
        title: z.string(),
        open: z.boolean(),
        /** Why it is closed ("Opens after U15.L05"), or `null`. */
        reason: z.string().nullable(),
      }),
    )
    .optional(),
});
export type CapstoneGate = z.infer<typeof CapstoneGateSchema>;

// album: versions, liner notes, recordings, reviews (contracts §10.6, §10.7, §11.10) ------------------------

/** `PATCH /album/tracks/:id/versions/:v`: edit a version's liner notes and whether the review's note shows. */
export const AlbumVersionPatchSchema = z
  .strictObject({
    linerNotesMd: z.string().max(4000),
    includeReviewNote: z.boolean(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: "nothing to change" });
export type AlbumVersionPatch = z.infer<typeof AlbumVersionPatchSchema>;
/**
 * `PUT /album/tracks/:id/versions/:v/review`: attach the tutor's submitted capstone review to a version
 * (`album_track_versions.review_json`). The review comes from a finished `review` conversation; the server
 * checks the conversation's subject is this track's capstone and that its `submit_capstone_review` was accepted.
 */
export const AlbumReviewAttachSchema = z.strictObject({
  conversationId: z.string(),
  review: CapstoneReviewSchema,
  includeReviewNote: z.boolean(),
});
export type AlbumReviewAttach = z.infer<typeof AlbumReviewAttachSchema>;

// tutor reviews as records (one schema per kind, contracts §10.6) -------------------------------------------

/** A submitted review as stored, with what it reviewed. `GET /tutor/reviews?subjectKind&subjectId`. */
export const ReviewRecordSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("capstone"),
    subject: SubjectRefSchema,
    conversationId: z.string(),
    /** The album version it is attached to, when attached. */
    track: z.object({ trackId: z.string(), version: z.number().int().positive() }).nullable(),
    review: CapstoneReviewSchema,
    at: Instant,
  }),
  z.object({
    kind: z.literal("transcription"),
    subject: SubjectRefSchema,
    conversationId: z.string(),
    /** The transcription version reviewed. */
    version: z.number().int().nullable(),
    review: TranscriptionReviewSchema,
    at: Instant,
  }),
]);
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

// audio and own-audio projects (contracts §2.8, §6.12, §11.10) ---------------------------------------------

/** The server's upload limit (`server/src/services/audio-store.ts` MAX_AUDIO_BYTES), for a check before upload. */
export const AUDIO_UPLOAD_MAX_BYTES = 300 * 1024 * 1024;
/** Containers the audio store recognises by their first bytes (anything else is refused with 400). */
export const AUDIO_UPLOAD_TYPES = [
  "audio/wav",
  "audio/flac",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/aiff",
] as const;
/**
 * The default self-assessed checklist of an own-audio project (contracts §6.12: `grading.mode: 'self'`, a
 * 0 to 2 score per item, evidence weight 0.3 flagged `selfReported`). Item IDs are stable.
 */
export const OWN_AUDIO_CHECKLIST = [
  { id: "contour", label: "The melody goes up and down where the recording does" },
  { id: "rhythm", label: "The notes land where the recording's notes land" },
  { id: "landing", label: "Phrases end on the same notes as the recording" },
  { id: "bass", label: "The bass notes match the recording's bass" },
  { id: "chords", label: "The chords change where the recording's chords change" },
] as const;
/**
 * Wave 6 (ladder L8 on own audio, Transcribe's full-arrangement mode): the row the checklist gains once the
 * recording's sections are mapped. Self-reported evidence for the form skills (`fam.frm.sections`), weight 0.3.
 */
export const OWN_AUDIO_FORM_ROW = {
  id: "form",
  label: "The sections start where the recording's sections start",
} as const;
/** `PUT /transcriptions/:id/settings`: remember the player and the notes (partial). */
export const TranscriptionSettingsPatchSchema = TranscriptionSettingsSchema.partial().refine(
  (b) => Object.keys(b).length > 0,
  { message: "nothing to change" },
);
export type TranscriptionSettingsPatch = z.infer<typeof TranscriptionSettingsPatchSchema>;

// the transcription ladder L1–L4 (contracts §2.9, §6.12) --------------------------------------------------

export const LadderSessionScoreSchema = z.object({
  level: ladderLevel,
  realism: realismLevel,
  score: z.number().min(0).max(1),
  passed: z.boolean(),
  day: Day,
  gymId: gymId.nullable(),
});
export type LadderSessionScore = z.infer<typeof LadderSessionScoreSchema>;
/** `GET /ladder`: where the learner stands on the generated ladder. */
export const LadderStateSchema = z.object({
  /** The level graded items are drawn at (1–4 in Wave 4; L5+ are songs and capstones). */
  level: ladderLevel,
  /** R0–R4: raised after two consecutive sessions ≥ 0.9, lowered after one below 0.6 (contracts §6.12). */
  realism: realismLevel,
  /** Last 10 ladder sessions, oldest first. */
  history: z.array(LadderSessionScoreSchema),
  /** Graded passes per level (`"1"`…`"4"` → count): the evidence for a level-up and for ladder milestones. */
  gradedPasses: z.record(z.string(), z.number().int().nonnegative()),
  /** A level-up the learner may take (wave4.md §5.4: two graded passes at R2 or higher on two days). */
  levelUp: z.object({ to: ladderLevel, reason: z.string() }).nullable(),
});
export type LadderState = z.infer<typeof LadderStateSchema>;
/** `POST /ladder/items`: the next generated item, created as a `generated` transcription project. */
export const LadderNextSchema = z.strictObject({
  sessionId: z.string().nullable(),
  gymId: gymId.nullable(),
  /** Default: the learner's level. A lower level is allowed (practice); a higher one only when offered. */
  level: ladderItemLevel.optional(),
  /** Default: a fresh seed. A seed replays the same item (tests, "try this one again"). */
  seed: z.number().int().nonnegative().optional(),
  /** Wave 5, L5/L6: the repertoire song to work (`ladder.songs`); default: the next unfinished one at the level. */
  songId: z.string().optional(),
});
export type LadderNext = z.infer<typeof LadderNextSchema>;
/** The item: its project (hidden code stays on the server) and what the learner is told. */
export const LadderItemSchema = z.object({
  /** = the transcription project ID; submissions go to `/ladder/items/:id/submissions`. */
  itemId: z.string(),
  level: ladderItemLevel,
  realism: realismLevel,
  seed: z.number().int().nonnegative(),
  /**
   * L3 is staged: `bass`, then `quality`, then `rn`; L6 (Wave 5): `bass`, then `changes`, then `melody` — each its
   * own submission, each opening after the one before passed. `null` for the other levels.
   */
  stages: z.array(z.enum(LADDER_STAGES)).nullable(),
  /** Given to the learner (contracts §6.12): tempo, meter, key, pickup. */
  given: z.object({
    bpm: z.number(),
    meter: meterId,
    key: KeySpecSchema,
    pickup: PickupSpecSchema.nullable(),
    bars: z.number().int().positive(),
    /** Wave 6: the keys of a tune that changes key, by bar (`SongDef.keyPlan`); absent when it stays in one key. */
    keyPlan: z
      .array(z.strictObject({ bar: z.number().int().min(0), key: KeySpecSchema }))
      .nullable()
      .optional(),
  }),
  project: TranscriptionDetailSchema,
  /**
   * Wave 5, L5/L6: the song from the repertoire pool (contracts §2.8) and its phrases as the lead sheet numbers
   * the bars (1-based, inclusive). L5 is graded one phrase per submission. Absent for L1–L4.
   */
  song: z
    .object({ songId: z.string(), title: z.string(), year: z.union([z.number().int(), z.literal("trad")]) })
    .nullable()
    .optional(),
  phrases: z
    .array(z.tuple([z.number().int().min(0), z.number().int().min(0)]))
    .nullable()
    .optional(),
});
export type LadderItem = z.infer<typeof LadderItemSchema>;
/** `POST /ladder/items/:id/submissions`: the learner's code, graded exactly on the server. */
export const LadderSubmitSchema = z.strictObject({
  sessionId: z.string().nullable(),
  code: z.string().max(60_000),
  /** L3 and L6: which stage this submission answers. */
  stage: z.enum(LADDER_STAGES).optional(),
  /** Wave 5, L5: the 1-based phrase this submission answers. */
  phrase: z.number().int().min(1).optional(),
  /**
   * Wave 6, L8 `stage: "form"`: the form map (a label per section and the 1-based bar each starts on); `code` is
   * then the draft so far (may be empty). Graded on the server by `@oak/grader` `gradeFormMap`.
   */
  formMap: z
    .strictObject({
      sections: z.array(z.string().min(1).max(24)).min(1).max(16),
      bars: z.array(z.number().int().min(1)).min(1).max(16),
    })
    .optional(),
  /** Hint ladder state of the item (rung 4 = revealed: no graded pass). */
  rung: RungSchema,
  idempotencyKey: IdempotencyKeySchema.optional(),
});
export type LadderSubmit = z.infer<typeof LadderSubmitSchema>;
export const LadderSubmitResultSchema = z.object({
  result: GradeResultSchema,
  /** status pass and score ≥ 0.85. */
  passed: z.boolean(),
  /** A pass that counts for milestones and level-ups: passed, not revealed, every stage of L3 passed. */
  gradedPass: z.boolean(),
  ladder: LadderStateSchema,
  /** Announced once (in the Coda), never mid-item. */
  realismChange: z.object({ from: realismLevel, to: realismLevel }).nullable(),
  /** The saved transcription version. */
  version: z.number().int(),
});
export type LadderSubmitResult = z.infer<typeof LadderSubmitResultSchema>;
/** `PUT /ladder`: take an offered level-up, or move down a level. */
export const LadderLevelSetSchema = z.strictObject({ level: ladderItemLevel });
export type LadderLevelSet = z.infer<typeof LadderLevelSetSchema>;

// the Transcription Gym (contracts §2.5, §9.1) ---------------------------------------------------------

/** `GET /gym`: the slot rule's state and what the next gym session is. */
export const GymPlanSchema = z.object({
  /** True from U07.L01 on (the slot rule runs). */
  active: z.boolean(),
  /** Completed core sessions since the last transcription session (gym, X#.S#, CF-T.S#). */
  sinceLast: z.number().int().nonnegative(),
  /** True when the next session's New block is a transcription slot (count reached 4, nothing in progress). */
  slotDue: z.boolean(),
  /** What the slot holds next (`null` while the rule is off or an `X#` session takes the slot). */
  next: z
    .object({
      gymId,
      /** Odd: graded ladder; even: own audio (contracts §2.5). */
      kind: z.enum(["ladder", "own-audio"]),
      ladderLevel: ladderLevel.nullable(),
      realism: realismLevel.nullable(),
      /** An even slot with no audio project: a ladder session one realism level up. */
      ownAudioFallback: z.boolean(),
      /** The own-audio project to continue, when there is one. */
      transcriptionId: z.string().nullable(),
    })
    .nullable(),
  /** Gym sessions taken, oldest first. */
  history: z.array(GymSessionSchema),
  /** X1's gate, while X1 is not open (Today: "Two more gym sets open X1"). */
  x1: CapstoneGateSchema.nullable(),
  /**
   * Wave 6 (contracts §2.5 "What fills a slot"): CF-T, once U15.L01 is completed. While it is open and unfinished
   * the next transcription slot is `nextSessionId` (`takesSlot: true`, and `next` above is `null`); once released
   * the slots are gym sessions again. `null` before U15.L01.
   */
  cfT: z
    .object({
      status: z.enum(["open", "in_progress", "released"]),
      nextSessionId: capstoneSessionId.nullable(),
      takesSlot: z.boolean(),
      /** The standard the learner picked (`song.five-foot-two` …); `null` before CF-T.S1 starts. */
      songId: z.string().nullable(),
    })
    .nullable()
    .optional(),
});
export type GymPlan = z.infer<typeof GymPlanSchema>;

// the voicing gate (contracts §3.1 rule 6; content/toolbox.ts VOICING_GATE) ------------------------------

/**
 * `GET /gates/voicing`: the U05.L07 hand-voiced cadence check that unlocks `voicing()`, `chord()`, `rhodes`,
 * `organ` and the rest of the gated rows at ≥ 0.9, unrevealed, from the learner's own typing only (a
 * tutor-applied card gives no evidence). Evaluated by the server on `steps.attempt` of that exercise or a variant.
 */
export const VoicingGateSchema = z.object({
  exerciseId: z.string(),
  /**
   * Regenerated variants that also count (`VOICING_GATE.variants`: U05.L08's `gateCheck` step,
   * `U05.L08/hand-voiced-cadence-again`, shown only while the gate is unmet).
   */
  variants: z.array(z.string()),
  minScore: z.number(),
  /** Best unrevealed, learner-typed score; `null` before the first attempt. */
  best: z.number().min(0).max(1).nullable(),
  passed: z.boolean(),
  passedAt: Instant.nullable(),
  attempts: z.number().int().nonnegative(),
  /**
   * Wave 4 integration (additive): the code of the first qualifying attempt, as the learner typed it — the voicing
   * the Workbench compares `voicing()` against. `null` until the gate passes; absent from older servers.
   */
  passedCode: z.string().nullable().optional(),
  /**
   * Wave 5 (carry-over c2): the passing attempt arrived through a backup import. The Workbench runs `passedCode` only
   * after the strict lint passes (contracts §11.3). Absent = false.
   */
  passedCodeImported: z.boolean().optional(),
  /** The unlocks the gate holds (tool and sound IDs), granted at U05.L08 once passed. */
  holds: z.array(unlockable),
});
export type VoicingGate = z.infer<typeof VoicingGateSchema>;

// dev seeds (docs/design/wave4.md §6) ---------------------------------------------------------------------

/**
 * Dev seed points Wave 4 e2e needs (`POST /dev/seed`, `point`). The server engineer implements them FIRST;
 * `GET /dev/seed` lists what exists; wave4.md §6 says what each must contain.
 */
export const WAVE4_SEED_POINTS = [
  "after U05.L04",
  "U05.L07 gate open",
  "after U05.L08",
  "U05.CP due",
  "after U06.L05",
  "U06.CP due",
  "after U07.L03 (gym due)",
  "after U07.L07",
  "U07.CP due",
  "C2 open",
  "C2.S1 done",
  "C2 released",
  "X1 open",
  "X1.S2 done",
  "X1 released",
  "ladder L3",
  "own-audio project",
] as const;
export type Wave4SeedPoint = (typeof WAVE4_SEED_POINTS)[number];

// --- Wave 5 additions (docs/design/wave5.md §5) ----------------------------------------------------
// Bass, form, minor, pentatonic and blues; side lessons; C3–C5 and X2; ladder L5–L6. Additive: existing shapes only
// gained optional fields (above); every new endpoint answers a typed 501 until the server engineer builds it
// (`WAVE5_ENDPOINTS` in contract.ts).

/** The optional side lessons of contracts §2.6 (track A), open once U03.L02 is done. */
export const SIDE_LESSON_IDS = ["A1.L01", "A1.L02", "A1.L03", "A1.L04"] as const;
/** The core lesson that opens them (contracts §2.6 gate). */
export const SIDE_LESSON_GATE = "U03.L02" as const;
export const SideLessonStateSchema = z.object({
  lessonId,
  title: z.string(),
  /** `locked` until U03.L02 is done; `open`; `in_progress` once started; `done` once completed. */
  status: z.enum(["locked", "open", "in_progress", "done"]),
  /** Authored minutes at the learner's target (contracts §9.1). */
  estMinutes: z.number(),
  completedAt: Instant.nullable(),
  /** Wave 5 (additive): the one-line offer ("Tame a raw synth bass with a filter …"), one source for every surface. */
  offer: z.string().optional(),
});
export type SideLessonState = z.infer<typeof SideLessonStateSchema>;
/** `GET /side-lessons`: the side lessons, their state, and the one Today would offer next (if any). */
export const SideLessonsSchema = z.object({
  /** The gate (U03.L02 completed) is met. */
  open: z.boolean(),
  items: z.array(SideLessonStateSchema),
  /** The next unfinished side lesson Today may offer (the same object as `SessionPlan.sideLesson`), or `null`. */
  next: lessonId.nullable(),
});
export type SideLessons = z.infer<typeof SideLessonsSchema>;

/** `GET /ladder/songs`: the repertoire pool for L5 and L6 (contracts §2.8), as the learner may pick from it. */
export const LadderSongSchema = z.object({
  songId: z.string(),
  title: z.string(),
  year: z.union([z.number().int(), z.literal("trad")]),
  /** Wave 6: 8 is a standard for L8 and CF-T (Five Foot Two, Ain't She Sweet, Bye Bye Blackbird). */
  level: z.union([z.literal(5), z.literal(6), z.literal(8)]),
  /** Phrases (L5) as the lead sheet numbers bars, 1-based inclusive. */
  phrases: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])),
  /** `locked` before its `availableFrom` lesson (Drunken Sailor: U14) or while its answer key is unverified. */
  status: z.enum(["locked", "open", "done"]),
  /** Learner-facing reason while locked ("Opens with U14"). */
  lockedReason: z.string().nullable(),
  /** L5: 1-based phrases with a graded pass (L6: the melody lines passed, = `passedLines`). `passedStages`: L6 stages passed, in order. */
  passedPhrases: z.array(z.number().int().min(1)),
  passedStages: z.array(z.enum(["bass", "changes", "melody", "form"])),
  /** Wave 5 (additive), L6: the 1-based 4-bar melody lines with a pass, while the melody stage is open. */
  passedLines: z.array(z.number().int().min(1)).optional(),
});
export type LadderSong = z.infer<typeof LadderSongSchema>;

/**
 * `POST /transcriptions/:id/versions/:v/confirm` (carry-over c2): the learner read an imported version, the strict
 * lint passed in the browser, and they confirm it as theirs; it then runs like typed code. Refused (409) when the
 * version carries no flag; the server re-lints strictly and answers 400 naming the first finding.
 */
export const TranscriptionVersionConfirmSchema = z.strictObject({ strictLintPassed: z.literal(true) });
export type TranscriptionVersionConfirm = z.infer<typeof TranscriptionVersionConfirmSchema>;

/**
 * Dev seed points Wave 5 e2e needs (`POST /dev/seed`, `point`). The server engineer implements them FIRST;
 * `GET /dev/seed` lists what exists; wave5.md §6 says what each must contain. Until a lesson they walk through is
 * authored the point answers 400 naming it.
 */
export const WAVE5_SEED_POINTS = [
  "after X1 (U08.L02 next)",
  "after U08.L04",
  "after U09.L01",
  "after U09.L04",
  "U09.CP due",
  "C3 open",
  "C3.S2 done",
  "C3 released",
  "after U10.L02",
  "after U10.L05",
  "after U10.L08",
  "U10.CP due",
  "C4 open",
  "C4 released",
  "after U11.L03",
  "after U11.L06",
  "U11.CP due",
  "C5 open",
  "C5.S1 done",
  "C5 released",
  "X2 open",
  "X2.S1 done",
  "X2 released",
  "ladder L5",
  "ladder L6",
  "ladder level-up due",
  "ladder realism-up due",
  "side lesson offered",
  "A1.L02 done",
  // Integration (c2): an own-audio project whose versions arrived through a backup import, held for review.
  "imported own-audio (c2)",
] as const;
export type Wave5SeedPoint = (typeof WAVE5_SEED_POINTS)[number];

// --- Wave 6 additions (docs/design/wave6.md §5) ----------------------------------------------------
// Sevenths, rhythm II, modes, secondary dominants, borrowed chords, modulation; C6, C7 and the core finale; the
// advanced-track gates; the end of the core; ladder L8. Additive: existing shapes only gained optional fields
// (above; the shared shapes `TrackStateSchema`, `CoreCompletionSchema` and `AlbumTakeSchema` are defined before the
// progress schemas that carry them); every new endpoint answers a typed 501 until the server engineer builds it
// (`WAVE6_ENDPOINTS` in contract.ts).

/** `GET /lessons/:id/sketch` (d15): the learner's latest saved Make sketch of that lesson, for a Make that builds on it. */
export const LessonSketchSchema = z.object({
  lessonId,
  /** The newest unarchived `lesson-make` sketch whose origin is this lesson, with its versions; `null` when none. */
  sketch: SketchDetailSchema.nullable(),
});
export type LessonSketch = z.infer<typeof LessonSketchSchema>;

/** `PUT /album/tracks/:id/versions/:v/take` (d20): choose which recording plays by default and is exported. */
export const AlbumTakeChooseSchema = z.strictObject({ take: z.number().int().positive() });
export type AlbumTakeChoose = z.infer<typeof AlbumTakeChooseSchema>;

/** The standards CF-T and ladder L8 draw from at v1 (contracts §2.4 "Repertoire limits"). */
export const CF_T_SONG_IDS = ["song.five-foot-two", "song.aint-she-sweet", "song.bye-bye-blackbird"] as const;
/** The lesson whose completion opens CF-T (contracts §2.4: "U15.L01 reached; runs in gym slots"). */
export const CF_T_GATE = "U15.L01" as const;

/**
 * Dev seed points Wave 6 e2e needs (`POST /dev/seed`, `point`). The server engineer implements them FIRST;
 * `GET /dev/seed` lists what exists; wave6.md §6 says what each must contain. Until a lesson they walk through is
 * authored the point answers 400 naming it.
 */
export const WAVE6_SEED_POINTS = [
  "after X2 (U12.L02 next)",
  "after U12.L05",
  "after U13.L03",
  "U13.CP due",
  "tracks open (after U13.CP)",
  "after U14.L03",
  "U14.CP due",
  "C6 open",
  "C6 released",
  "CF-T open (U15.L01 done)",
  "CF-T.S2 done",
  "after U15.L05",
  "after U16.L03",
  "after U17.L02",
  "U17.CP due",
  "C7 open",
  "C7.S2 done",
  "C7 released",
  "CF-A open",
  "CF-A.S3 done",
  "core complete",
  "ladder L8",
  // Carry-overs that need their own state (wave6.md §6): d13 a learner part-way through the old three-session C3;
  // d20 a released track with two takes; d21 a session left open by another tab.
  "C3.S3 in progress (d13)",
  "two takes (d20)",
  "second tab (d21)",
] as const;
export type Wave6SeedPoint = (typeof WAVE6_SEED_POINTS)[number];

// --- Wave 7 additions (docs/design/wave7.md §5) ----------------------------------------------------
// The advanced tracks (contracts §2.6): track lessons as sessions, the learner's choice between tracks, the track
// checkpoints that gate only track capstones, JC1–JC4, RC1–RC2, AC1–AC2 and their gates, sounds that unlock at a
// capstone session, the album's Side B, export, the planner's real next session and the whole course complete.
// Additive: existing shapes only gained optional fields (above, before the schemas that carry them); every new
// endpoint answers a typed 501 until the server engineer builds it (`WAVE7_ENDPOINTS` in contract.ts).

/** Sessions per part of the course (contracts §2.7). The map counts the tracks once a track lesson is authored. */
export const COURSE_SESSIONS = { core: 185, J: 34, R: 20, A: 20, total: 259 } as const;

/**
 * The track checkpoints (contracts §2.6, §7.6 rule 5): each covers part of its track and gates ONLY that track's
 * capstones (never a lesson). `afterLesson` is the last lesson it covers (it opens when that lesson is completed
 * and the planner places it after any one intervening session). J5.L05 (Coltrane changes) is enrichment and in no
 * checkpoint; J2.L04 belongs to J.CP2 so J.CP1 never waits for U14.CP. A lesson the content lead splits (wave7.md
 * §0, f9) joins its original's checkpoint.
 */
export const TRACK_CHECKPOINTS = [
  { cpId: "J.CP1", trackId: "J", covers: "J1, J2.L01–L03", afterLesson: "J2.L03", gates: ["JC1"] },
  {
    cpId: "J.CP2",
    trackId: "J",
    covers: "J2.L04, J3, J4, J5.L01–L04",
    afterLesson: "J5.L04",
    gates: ["JC3", "JC4"],
  },
  { cpId: "R.CP", trackId: "R", covers: "R1–R3", afterLesson: "R3.L05", gates: ["RC1", "RC2"] },
  { cpId: "A.CP", trackId: "A", covers: "A1–A2", afterLesson: "A2.L06", gates: ["AC1", "AC2"] },
] as const satisfies readonly {
  cpId: string;
  trackId: TrackId;
  covers: string;
  afterLesson: string;
  gates: readonly string[];
}[];
export type TrackCheckpointId = (typeof TRACK_CHECKPOINTS)[number]["cpId"];

/**
 * The capstone gates of contracts §4.3 for the eight track capstones, as `capstones.gate` reports them (each
 * requirement one `CapstoneGateCondition`: a checkpoint passed or soft-passed, a lesson completed). AC2 is the one
 * three-way gate. AC1's second tune has its own gate (`tunes`: Sweet Georgia Brown also needs U15.L05). A track
 * capstone never gates a lesson (§7.6 rule 4).
 */
export const TRACK_CAPSTONE_GATES = [
  { capstoneId: "JC1", trackId: "J", sessions: 2, requires: ["J.CP1"] },
  { capstoneId: "JC2", trackId: "J", sessions: 2, requires: ["J4.L04"] },
  { capstoneId: "JC3", trackId: "J", sessions: 3, requires: ["J.CP2"] },
  { capstoneId: "JC4", trackId: "J", sessions: 3, requires: ["J.CP2"] },
  { capstoneId: "RC1", trackId: "R", sessions: 2, requires: ["R.CP"] },
  { capstoneId: "RC2", trackId: "R", sessions: 2, requires: ["R.CP"] },
  {
    capstoneId: "AC1",
    trackId: "A",
    sessions: 3,
    requires: ["A.CP", "U11.CP"],
    tunes: [
      { songId: "song.st-louis-blues", requires: [] },
      { songId: "song.sweet-georgia-brown", requires: ["U15.L05"] },
    ],
  },
  { capstoneId: "AC2", trackId: "A", sessions: 3, requires: ["A.CP", "J3.L04", "R1.L05"] },
] as const satisfies readonly {
  capstoneId: string;
  trackId: TrackId;
  sessions: number;
  requires: readonly string[];
  tunes?: readonly { songId: string; requires: readonly string[] }[];
}[];
export type TrackCapstoneId = (typeof TRACK_CAPSTONE_GATES)[number]["capstoneId"];

/**
 * Sounds granted at the START of a capstone session (contracts §3.2 rule 11; content/toolbox.ts `when: "start"`):
 * `horns` at RC1.S2 unless U15.L05 already granted it, `choir` at AC2.S1. The grant is reported like any unlock
 * (`SessionSummary.unlocks` of that session, and the capstone's start screen shows the ceremony).
 */
export const CAPSTONE_SESSION_SOUNDS = [
  { capstoneSessionId: "RC1.S2", sound: "snd.horns", unlessLesson: "U15.L05" },
  { capstoneSessionId: "AC2.S1", sound: "snd.choir", unlessLesson: null },
] as const;

/** The two sides of the album (wave7.md §5.5): Side A the core's twelve capstones, Side B the tracks' eight. */
export const ALBUM_SIDES = [
  {
    side: "A",
    title: "Side A",
    capstones: ["C0", "C1", "C2", "X1", "C3", "C4", "C5", "X2", "C6", "C7", "CF-T", "CF-A"],
  },
  { side: "B", title: "Side B", capstones: ["JC1", "JC2", "JC3", "JC4", "RC1", "RC2", "AC1", "AC2"] },
] as const;

/**
 * `GET /album/tracks/:id/versions/:v/source` (carry f2, wave7.md §5.5): exactly what a released version plays —
 * its code (the sketch version it was released from), its Band and key — so "Export" renders that version offline
 * (`@oak/strudel/offline` `renderPiece`) whatever the sketch became later. The real-time take stays the release
 * recording; a rendered file is a download, never stored as a take.
 */
export const AlbumSourceSchema = z.object({
  trackId: z.string(),
  version: z.number().int().positive(),
  title: z.string(),
  code: z.string(),
  /** The Band as it played at release (`BandSetup` of @oak/strudel), or `null` with no Band. */
  band: z.unknown().nullable(),
  key: KeySpecSchema.nullable(),
  /** Tracks muted at release (label → true). */
  mutes: z.record(z.string(), z.boolean()),
  /** A safe file name for the download, without extension: "oak-side-a-03-first-light-v2". */
  fileName: z.string(),
  /**
   * Unit songs (contracts §5.11 rule 18): a version released from a unit song names its frozen release; it plays and
   * exports from `songs.snapshot` (Oak's code, the definition and every take as released), never from `code`, which
   * is only the newest take's. Absent on every other version.
   */
  songRelease: z.object({ unitId: z.string(), releaseId: z.number().int().positive() }).optional(),
});
export type AlbumSource = z.infer<typeof AlbumSourceSchema>;

/**
 * Dev seed points Wave 7 e2e needs (`POST /dev/seed`, `point`). The server engineer implements them FIRST;
 * wave7.md §6 says what each must contain. Until a lesson a point walks through is authored, it answers 400 naming
 * that lesson.
 */
export const WAVE7_SEED_POINTS = [
  "core complete, tracks untouched",
  "J1.L03 next",
  "J.CP1 due",
  "JC1 open",
  "JC1 released",
  "J2.L04 locked (U14.CP not passed)",
  "J3.L02 next",
  "J4.L03 next",
  "JC2 open",
  "J.CP2 due",
  "JC3 open",
  "JC4 open",
  "JC4.S2 done",
  "R1.L03 next",
  "R2.L04 next",
  "R3.L02 next",
  "R.CP due",
  "RC1 open",
  "RC2 open",
  "A1.L05 next",
  "A2.L04 next",
  "A.CP due",
  "AC1 open",
  "AC1.S2 done",
  "AC2 open",
  "two tracks in progress",
  "whole course complete",
] as const;
export type Wave7SeedPoint = (typeof WAVE7_SEED_POINTS)[number];

// --- Oak 2.0 additions (docs/oak2/PLAN.md §4–§6; contracts §13; migration 0012) --------------------------------
// Declared in W0; the handlers are built in W1 (scraps, templates, takes), W3 (lineage, habits, catalogs) and W4
// (Shelf, check history); until then each answers the typed 501 (`OAK2_ENDPOINTS` in contract.ts).

/** The part a scrap plays (`scraps.role`, no CHECK): the Band roles plus the tune, or anything else. */
export const SCRAP_ROLES = ["drums", "bass", "chords", "tune", "other"] as const;
export type ScrapRole = (typeof SCRAP_ROLES)[number];
/** Where a saved scrap came from (`scraps.source_kind`, no CHECK): a sketch line, a lesson step, a capture. */
export const SCRAP_SOURCE_KINDS = ["sketch", "lesson", "hum", "tap", "memo"] as const;
export type ScrapSourceKind = (typeof SCRAP_SOURCE_KINDS)[number];
/**
 * S1: one scrap. `saved` scraps are rows of `scraps`; `index` scraps are the labelled lines of every sketch's current
 * version, read on each list and never stored (their `id` is the server's, stable for one sketch version and line;
 * `scraps.delete` refuses it). For an `index` scrap `sourceKind` is `sketch` and `sketchId`/`sketchVersion` name the
 * version; for a saved one they are `null` unless it was saved from a sketch.
 */
export const ScrapSchema = z.object({
  id: z.string(),
  origin: z.enum(["saved", "index"]),
  role: z.enum(SCRAP_ROLES).nullable(),
  label: z.string().nullable(),
  code: z.string(),
  bpm: z.number().nullable(),
  meter: meterId.nullable(),
  key: KeySpecSchema.nullable(),
  sourceKind: z.enum(SCRAP_SOURCE_KINDS),
  sourceRef: z.string().nullable(),
  sketchId: z.string().nullable(),
  sketchVersion: z.number().int().positive().nullable(),
  /** Set by a backup import on a saved scrap: its code runs only after the strict lint (contracts §11.3). */
  reviewBeforeRun: z.literal(true).optional(),
  createdAt: Instant,
});
export type Scrap = z.infer<typeof ScrapSchema>;
/** Save a line as a scrap (from a lesson, a capture, or a line of a take in the edit view). */
export const ScrapCreateSchema = z.strictObject({
  role: z.enum(SCRAP_ROLES).nullable(),
  label: z.string().min(1).max(64).nullable(),
  code: z.string().min(1).max(8000),
  bpm: z.number().positive().nullable(),
  meter: meterId.nullable(),
  key: KeySpecSchema.nullable(),
  sourceKind: z.enum(SCRAP_SOURCE_KINDS),
  sourceRef: z.string().min(1).max(200).nullable(),
});
export type ScrapCreate = z.infer<typeof ScrapCreateSchema>;

/** S2: one of the learner's own starting points (`user_templates`). At most one is the Blank. */
export const UserTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  bpm: z.number().nullable(),
  meter: meterId.nullable(),
  isBlank: z.boolean(),
  /** Set by a backup import: its code runs only after the strict lint (contracts §11.3). */
  reviewBeforeRun: z.literal(true).optional(),
  createdAt: Instant,
  updatedAt: Instant,
});
export type UserTemplate = z.infer<typeof UserTemplateSchema>;
/**
 * Save a template. With `fromSketch`, the server reads that version and keeps its tempo, meter and sounds with no
 * notes ("Make this my Blank"), ignoring `code`; otherwise `code` is stored as given. `isBlank: true` makes it the
 * Blank (the previous Blank stops being one).
 */
export const UserTemplateCreateSchema = z.strictObject({
  name: z.string().min(1).max(80),
  isBlank: z.boolean(),
  fromSketch: z
    .strictObject({ sketchId: z.string().min(1), version: z.number().int().positive() })
    .nullable(),
  code: z.string().max(60_000).nullable(),
  bpm: z.number().positive().nullable(),
  meter: meterId.nullable(),
});
export type UserTemplateCreate = z.infer<typeof UserTemplateCreateSchema>;
export const UserTemplatePatchSchema = z
  .strictObject({ name: z.string().min(1).max(80), isBlank: z.boolean() })
  .partial();
export type UserTemplatePatch = z.infer<typeof UserTemplatePatchSchema>;

/** S6 habits mirror: plain sentences over the current version of every sketch, Oak's defaults ignored. */
export const HabitsSchema = z.object({
  /** How many sketches the sentences are drawn from. */
  sketches: z.number().int().nonnegative(),
  /** Empty when there is nothing to say. `id` is stable per habit, so "Not this time" can name it. */
  habits: z.array(z.object({ id: z.string(), text: z.string() })),
});
export type Habits = z.infer<typeof HabitsSchema>;

/** S7: who parked an item on the Later list (`later_items.source`, no CHECK). */
export const LATER_SOURCES = ["tutor", "learner"] as const;
export const LaterItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.enum(LATER_SOURCES).nullable(),
  createdAt: Instant,
  doneAt: Instant.nullable(),
});
export type LaterItem = z.infer<typeof LaterItemSchema>;
export const LaterCreateSchema = z.strictObject({
  text: z.string().trim().min(1).max(500),
  source: z.enum(LATER_SOURCES).nullable(),
});
/** `done: true` sets `doneAt` (the row stays); `false` clears it. */
export const LaterPatchSchema = z
  .strictObject({ text: z.string().trim().min(1).max(500), done: z.boolean() })
  .partial();

/**
 * S6 Catalog of attributes: what the reference is (`catalogs.ref_kind`, no CHECK). `outside` (Oak 2.0 W3): a track
 * the learner names for Outside your lane; `refId` is their own words ("<style> — <track>"), never resolved.
 */
export const CATALOG_REF_KINDS = ["song", "transcription", "audio", "outside"] as const;
/** The six plain lines, in the order the learner writes them. */
export const CATALOG_LINES = ["tempo", "sound", "harmony", "melody", "rhythm", "form"] as const;
const catalogLines = z.strictObject(
  Object.fromEntries(CATALOG_LINES.map((k) => [k, z.string().max(400)])) as Record<
    (typeof CATALOG_LINES)[number],
    z.ZodString
  >,
);
export const CatalogSchema = z.object({
  id: z.string(),
  refKind: z.enum(CATALOG_REF_KINDS),
  refId: z.string(),
  lines: catalogLines,
  /** The sketch written from the lines, once there is one. */
  sketchId: z.string().nullable(),
  createdAt: Instant,
});
export type Catalog = z.infer<typeof CatalogSchema>;
export const CatalogCreateSchema = z.strictObject({
  refKind: z.enum(CATALOG_REF_KINDS),
  refId: z.string().min(1).max(200),
  lines: catalogLines,
  sketchId: z.string().min(1).nullable(),
});

/** F2: one rubric check of a capstone draft (`capstone_check_history`), oldest first. */
export const CapstoneCheckHistoryEntrySchema = z.object({
  id: z.number().int().positive(),
  capstoneId,
  sessionId: z.string().nullable(),
  sketchId: z.string(),
  sketchVersion: z.number().int().positive(),
  passed: z.boolean(),
  at: Instant,
});
export type CapstoneCheckHistoryEntry = z.infer<typeof CapstoneCheckHistoryEntrySchema>;
