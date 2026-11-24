// The ID registry grammar (contracts §1.2). The prefix or shape decides the kind, so no two kinds collide.
//
// The ID *types* here are structural (template-literal) approximations. `bun run content:build`
// generates `content/.generated/ids.ts` with the exact string-literal unions (`LessonId`, `SkillId`, ...)
// and `isLessonId()`-style guards over the real registry; those are assignable to the types below, so
// engine code written against this module accepts them unchanged. No package declares `type XId = string`.

type CoreUnit = `U${number}`;
type TrackLetter = "J" | "R" | "A";
type SkillLetter = "R" | "P" | "N" | "S" | "I" | "C" | "H" | "B" | "M" | "F" | "E" | "V" | "J" | "D";

export type UnitId = CoreUnit | `${TrackLetter}${number}`;
export type TrackId = TrackLetter;
export type LessonId = `${UnitId}.L${number}`;
export type CheckpointId = `${CoreUnit}.CP` | "J.CP1" | "J.CP2" | "R.CP" | "A.CP";
export type CapstoneId =
  | `C${number}`
  | `X${number}`
  | "CF-A"
  | "CF-T"
  | `JC${number}`
  | `RC${number}`
  | `AC${number}`;
export type CapstoneSessionId = `${CapstoneId}.S${number}`;
export type GymSessionId = `GYM.${number}`;
/** Anything that occupies one session slot on the course map. */
export type SessionId = LessonId | CheckpointId | CapstoneSessionId | GymSessionId;
/** `<lesson>/S<n>`. The step's own ID inside its lesson is `StepLocalId` (`S5`). */
export type StepId = `${LessonId}/S${number}`;
export type StepLocalId = `S${number}`;
/** Who can own an exercise: a lesson, a capstone, or a checkpoint (its authored items). */
export type ExerciseOwnerId = LessonId | CapstoneId | CheckpointId;
/** `<owner>/<slug>`. */
export type ExerciseId = `${ExerciseOwnerId}/${string}`;
export type ExampleId = `${LessonId}@${string}`;
export type SkillId = `${SkillLetter}${number}` | `${SkillLetter}${number}${"a" | "b"}`;
export type SkillCategoryId = `${SkillId}/${string}`;
export type FamilyId = `fam.${string}.${string}`;
export type DeckId = `deck.${string}.${string}`;
export type FactId = `fact.${string}`;
export type ToolId = `tb.${string}`;
export type SoundId = `snd.${string}`;
export type ScaleId = `scale.${string}`;
export type ChordFamilyId = `chord.${string}`;
export type SchemaId = `schema.${string}`;
export type CanDoId = `cd.${string}.${string}`;
export type MilestoneId = `ms.${number}`;
export type TermId = `term.${string}`;
export type SongId = `song.${string}`;
export type FlavourId =
  | "flavour.pop"
  | "flavour.indie"
  | "flavour.jazz-soul"
  | "flavour.funk"
  | "flavour.electronic";
export type BandId = `band.${string}`;
/** A unit's song (spec 2026-11-24 §5.1): `usong.U01`, `usong.J1`. Not `song.*`, which is the repertoire. */
export type UnitSongId = `usong.${UnitId}`;
export type FeedbackId = `${FeedbackArea}.${string}`;
/** Anything the unlock table can grant or the lint can lock. */
export type UnlockableId = ToolId | SoundId | ScaleId | ChordFamilyId;

/** Registered feedback areas (contracts §5.7). A feedback code is only valid with one of these. */
export const FEEDBACK_AREAS = [
  "eval",
  "code",
  "lint",
  "rhythm",
  "melody",
  "harmony",
  "spell",
  "keysig",
  "sing",
  "tap",
  "id",
  "fill",
  "parsons",
  "hunt",
  "investigate",
  "kb",
  "staff",
  "predict",
  "form",
  "make",
  "rubric",
  "pass",
] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];

export const FLAVOUR_IDS = [
  "flavour.pop",
  "flavour.indie",
  "flavour.jazz-soul",
  "flavour.funk",
  "flavour.electronic",
] as const;

/** `subject_kind` of a tutor thread (contracts §10.2). */
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

/** `thread_kind` of a tutor conversation (contracts §10.2): one constant effort each. */
export const TUTOR_THREAD_KINDS = ["hint", "note", "chat", "review"] as const;
export type TutorThreadKind = (typeof TUTOR_THREAD_KINDS)[number];

const CAPSTONE = "(?:C[0-7]|X[12]|CF-A|CF-T|JC[1-4]|RC[12]|AC[12])";
const LESSON = "(?:U\\d{2}\\.L\\d{2}|[JRA]\\d\\.L\\d{2})";
const CHECKPOINT = "(?:U\\d{2}\\.CP|J\\.CP[12]|R\\.CP|A\\.CP)";
const SKILL = "[RPNSICHBMFEVJD]\\d{2}[ab]?";

/** One anchored regex per kind, exactly as the grammar table of contracts §1.2. */
export const ID_PATTERNS = {
  unit: /^(?:U\d{2}|J[1-5]|R[1-3]|A[1-2])$/,
  lesson: new RegExp(`^${LESSON}$`),
  checkpoint: new RegExp(`^${CHECKPOINT}$`),
  capstone: new RegExp(`^${CAPSTONE}$`),
  capstoneSession: new RegExp(`^${CAPSTONE}\\.S\\d$`),
  gymSession: /^GYM\.\d{2}$/,
  step: new RegExp(`^${LESSON}/S\\d{1,2}$`),
  exercise: new RegExp(`^(?:${LESSON}|${CAPSTONE}|${CHECKPOINT})/[a-z0-9-]+$`),
  example: new RegExp(`^${LESSON}@[a-z0-9-]+$`),
  skill: new RegExp(`^${SKILL}$`),
  skillCategory: new RegExp(`^${SKILL}/[a-z0-9.-]+$`),
  family: /^fam\.[a-z]+\.[a-z0-9-]+$/,
  deck: /^deck\.[a-z]+\.[a-z0-9-]+$/,
  fact: /^fact\.[a-z0-9-]+(?:\.[A-Za-z0-9#-]+)*$/,
  tool: /^tb\.[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)*$/,
  sound: /^snd\.[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?$/,
  scale: /^scale\.[a-z-]+$/,
  chordFamily: /^chord\.[a-z0-9-]+$/,
  schema: /^schema\.[a-z0-9-]+$/,
  canDo: /^cd\.[a-z]+\.[a-z0-9.-]+$/,
  milestone: /^ms\.\d{2}$/,
  term: /^term\.[a-z0-9-]+$/,
  song: /^song\.[a-z0-9-]+$/,
  flavour: /^flavour\.(?:pop|indie|jazz-soul|funk|electronic)$/,
  band: /^band\.[a-z0-9.-]+$/,
  unitSong: /^usong\.(?:U\d{2}|J[1-5]|R[1-3]|A[1-2])$/,
  feedback: new RegExp(`^(?:${FEEDBACK_AREAS.join("|")})(?:\\.[a-z0-9-]+){1,2}$`),
} as const satisfies Record<string, RegExp>;

export type IdKind = keyof typeof ID_PATTERNS;
export const ID_KINDS = Object.keys(ID_PATTERNS) as IdKind[];

/** Step ID local to a lesson: `S1` to `S99`. */
export const STEP_LOCAL_PATTERN = /^S\d{1,2}$/;
/** Exercise, example and rubric-rule slugs. */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export interface IdTypes {
  unit: UnitId;
  lesson: LessonId;
  checkpoint: CheckpointId;
  capstone: CapstoneId;
  capstoneSession: CapstoneSessionId;
  gymSession: GymSessionId;
  step: StepId;
  exercise: ExerciseId;
  example: ExampleId;
  skill: SkillId;
  skillCategory: SkillCategoryId;
  family: FamilyId;
  deck: DeckId;
  fact: FactId;
  tool: ToolId;
  sound: SoundId;
  scale: ScaleId;
  chordFamily: ChordFamilyId;
  schema: SchemaId;
  canDo: CanDoId;
  milestone: MilestoneId;
  term: TermId;
  song: SongId;
  flavour: FlavourId;
  band: BandId;
  unitSong: UnitSongId;
  feedback: FeedbackId;
}

/** True when `id` matches the grammar of `kind`. It does not say the ID is registered. */
export function isId<K extends IdKind>(kind: K, id: unknown): id is IdTypes[K] {
  return typeof id === "string" && ID_PATTERNS[kind].test(id);
}

/** The kind an ID's shape belongs to, or `null`. Exactly one kind can match (tested). */
export function idKind(id: string): IdKind | null {
  for (const kind of ID_KINDS) if (ID_PATTERNS[kind].test(id)) return kind;
  return null;
}

export class InvalidIdError extends Error {
  readonly id: string;
  readonly kind: IdKind | "session" | "skillRef" | "tutorThread";
  constructor(kind: InvalidIdError["kind"], id: string) {
    super(`"${id}" is not a valid ${kind} ID`);
    this.name = "InvalidIdError";
    this.kind = kind;
    this.id = id;
  }
}

/** Returns `id` typed, or throws `InvalidIdError`. */
export function assertId<K extends IdKind>(kind: K, id: string): IdTypes[K] {
  if (!isId(kind, id)) throw new InvalidIdError(kind, id);
  return id;
}

export const isLessonId = (id: unknown): id is LessonId => isId("lesson", id);
export const isCheckpointId = (id: unknown): id is CheckpointId => isId("checkpoint", id);
export const isCapstoneId = (id: unknown): id is CapstoneId => isId("capstone", id);
export const isSkillId = (id: unknown): id is SkillId => isId("skill", id);
export const isFamilyId = (id: unknown): id is FamilyId => isId("family", id);
export const isToolId = (id: unknown): id is ToolId => isId("tool", id);
export const isSoundId = (id: unknown): id is SoundId => isId("sound", id);
export const isFeedbackId = (id: unknown): id is FeedbackId => isId("feedback", id);

export function isSessionId(id: unknown): id is SessionId {
  return (
    isId("lesson", id) || isId("checkpoint", id) || isId("capstoneSession", id) || isId("gymSession", id)
  );
}
export function isUnlockableId(id: unknown): id is UnlockableId {
  return isId("tool", id) || isId("sound", id) || isId("scale", id) || isId("chordFamily", id);
}
/** A skill node or one of its categories. */
export function isSkillRef(id: unknown): id is SkillId | SkillCategoryId {
  return isId("skill", id) || isId("skillCategory", id);
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

// --- parse / format -----------------------------------------------------------------------------

export interface ParsedUnit {
  unit: UnitId;
  /** `core` for U00 to U17, otherwise the track letter. */
  track: "core" | TrackId;
  /** 0 to 17 in the core; 1-based inside a track. */
  n: number;
}
export function parseUnitId(id: string): ParsedUnit | null {
  if (!ID_PATTERNS.unit.test(id)) return null;
  const letter = id[0] as "U" | TrackId;
  return { unit: id as UnitId, track: letter === "U" ? "core" : letter, n: Number(id.slice(1)) };
}
export function formatUnitId(track: "core" | TrackId, n: number): UnitId {
  return assertId("unit", track === "core" ? `U${pad2(n)}` : `${track}${n}`);
}

export interface ParsedLesson extends ParsedUnit {
  lesson: LessonId;
  /** 1-based lesson number inside the unit. */
  l: number;
}
export function parseLessonId(id: string): ParsedLesson | null {
  if (!ID_PATTERNS.lesson.test(id)) return null;
  const [unit, l] = id.split(".L") as [string, string];
  const parsed = parseUnitId(unit);
  // "J9.L01" has the lesson shape but names no unit: grammar-valid, not a unit we can describe.
  const letter = unit[0] as "U" | TrackId;
  const base: ParsedUnit = parsed ?? {
    unit: unit as UnitId,
    track: letter === "U" ? "core" : letter,
    n: Number(unit.slice(1)),
  };
  return { ...base, lesson: id as LessonId, l: Number(l) };
}
export function formatLessonId(unit: UnitId, l: number): LessonId {
  return assertId("lesson", `${unit}.L${pad2(l)}`);
}

export interface ParsedCheckpoint {
  checkpoint: CheckpointId;
  track: "core" | TrackId;
  /** The core unit it closes (`U07`); `null` for track checkpoints. */
  unit: UnitId | null;
}
export function parseCheckpointId(id: string): ParsedCheckpoint | null {
  if (!ID_PATTERNS.checkpoint.test(id)) return null;
  if (id.startsWith("U"))
    return { checkpoint: id as CheckpointId, track: "core", unit: id.slice(0, 3) as UnitId };
  return { checkpoint: id as CheckpointId, track: id[0] as TrackId, unit: null };
}
/** `/checkpoint/$unitId` route parameter (contracts §11.9): `U07` for core, the full ID for tracks. */
export function checkpointRouteParam(id: CheckpointId): string {
  return id.startsWith("U") ? id.slice(0, 3) : id;
}
export function checkpointFromRouteParam(param: string): CheckpointId | null {
  const id = /^U\d{2}$/.test(param) ? `${param}.CP` : param;
  return isId("checkpoint", id) ? id : null;
}

export interface ParsedCapstoneSession {
  session: CapstoneSessionId;
  capstone: CapstoneId;
  /** 1-based. */
  n: number;
}
export function parseCapstoneSessionId(id: string): ParsedCapstoneSession | null {
  if (!ID_PATTERNS.capstoneSession.test(id)) return null;
  const i = id.lastIndexOf(".S");
  return {
    session: id as CapstoneSessionId,
    capstone: id.slice(0, i) as CapstoneId,
    n: Number(id.slice(i + 2)),
  };
}
export function formatCapstoneSessionId(capstone: CapstoneId, n: number): CapstoneSessionId {
  return assertId("capstoneSession", `${capstone}.S${n}`);
}

export function parseGymSessionId(id: string): { session: GymSessionId; n: number } | null {
  return ID_PATTERNS.gymSession.test(id) ? { session: id as GymSessionId, n: Number(id.slice(4)) } : null;
}
export function formatGymSessionId(n: number): GymSessionId {
  return assertId("gymSession", `GYM.${pad2(n)}`);
}

export type ParsedSession =
  | ({ kind: "lesson" } & ParsedLesson)
  | ({ kind: "checkpoint" } & ParsedCheckpoint)
  | ({ kind: "capstone" } & ParsedCapstoneSession)
  | { kind: "gym"; session: GymSessionId; n: number };
export function parseSessionId(id: string): ParsedSession | null {
  const lesson = parseLessonId(id);
  if (lesson) return { kind: "lesson", ...lesson };
  const cp = parseCheckpointId(id);
  if (cp) return { kind: "checkpoint", ...cp };
  const cap = parseCapstoneSessionId(id);
  if (cap) return { kind: "capstone", ...cap };
  const gym = parseGymSessionId(id);
  if (gym) return { kind: "gym", ...gym };
  return null;
}

export function parseStepId(id: string): { lesson: LessonId; step: StepLocalId; n: number } | null {
  if (!ID_PATTERNS.step.test(id)) return null;
  const [lesson, step] = id.split("/") as [string, string];
  return { lesson: lesson as LessonId, step: step as StepLocalId, n: Number(step.slice(1)) };
}
export function formatStepId(lesson: LessonId, step: StepLocalId | number): StepId {
  return assertId("step", `${lesson}/${typeof step === "number" ? `S${step}` : step}`);
}

export function parseExerciseId(id: string): { owner: ExerciseOwnerId; slug: string } | null {
  if (!ID_PATTERNS.exercise.test(id)) return null;
  const i = id.indexOf("/");
  return { owner: id.slice(0, i) as ExerciseOwnerId, slug: id.slice(i + 1) };
}
/** Global exercise ID = owner + "/" + slug. */
export function formatExerciseId(owner: ExerciseOwnerId, slug: string): ExerciseId {
  return assertId("exercise", `${owner}/${slug}`);
}

export function parseExampleId(id: string): { lesson: LessonId; slug: string } | null {
  if (!ID_PATTERNS.example.test(id)) return null;
  const i = id.indexOf("@");
  return { lesson: id.slice(0, i) as LessonId, slug: id.slice(i + 1) };
}
export function formatExampleId(lesson: LessonId, slug: string): ExampleId {
  return assertId("example", `${lesson}@${slug}`);
}

/** Skill regions by letter (contracts §4.1). */
export function parseSkillId(
  id: string,
): { skill: SkillId; letter: string; n: number; suffix: "a" | "b" | null } | null {
  if (!ID_PATTERNS.skill.test(id)) return null;
  const suffix = id.length === 4 ? (id[3] as "a" | "b") : null;
  return { skill: id as SkillId, letter: id[0] as string, n: Number(id.slice(1, 3)), suffix };
}

/** `E05/deg.6` to its node `E05` and category `deg.6`; a bare node has `category: null`. */
export function parseSkillRef(ref: string): { skill: SkillId; category: string | null } | null {
  if (ID_PATTERNS.skill.test(ref)) return { skill: ref as SkillId, category: null };
  if (!ID_PATTERNS.skillCategory.test(ref)) return null;
  const i = ref.indexOf("/");
  return { skill: ref.slice(0, i) as SkillId, category: ref.slice(i + 1) };
}
/** Evidence on a category rolls up to its node. */
export function skillOf(ref: string): SkillId {
  const parsed = parseSkillRef(ref);
  if (!parsed) throw new InvalidIdError("skillRef", ref);
  return parsed.skill;
}

export function parseFamilyId(
  id: string,
): { family: FamilyId; domain: string; name: string; composite: boolean } | null {
  if (!ID_PATTERNS.family.test(id)) return null;
  const [, domain, name] = id.split(".") as [string, string, string];
  return { family: id as FamilyId, domain, name, composite: domain === "mix" };
}

export function parseToolId(id: string): {
  tool: ToolId;
  group: "fn" | "mini" | "feature" | "lens" | "template" | "meter" | "dict" | "mode";
  name: string;
} | null {
  if (!ID_PATTERNS.tool.test(id)) return null;
  const parts = id.split(".");
  const head = parts[1] as string;
  const groups = ["mini", "feature", "lens", "template", "meter", "dict", "mode"] as const;
  const group = parts.length > 2 ? groups.find((g) => g === head) : undefined;
  return group
    ? { tool: id as ToolId, group, name: parts.slice(2).join(".") }
    : { tool: id as ToolId, group: "fn", name: parts.slice(1).join(".") };
}

export function parseFeedbackId(id: string): { id: FeedbackId; area: FeedbackArea; code: string } | null {
  if (!ID_PATTERNS.feedback.test(id)) return null;
  const i = id.indexOf(".");
  return { id: id as FeedbackId, area: id.slice(0, i) as FeedbackArea, code: id.slice(i + 1) };
}

export interface TutorThreadKey {
  subjectKind: SubjectKind;
  subjectId: string;
  /** Learner-local day, `YYYY-MM-DD` (04:00 rollover). */
  day: string;
  threadKind: TutorThreadKind;
}
/** `<subjectKind>:<subjectId>:<yyyy-mm-dd>:<threadKind>`. Runtime ID, not content. */
export function formatTutorThreadId(key: TutorThreadKey): string {
  return `${key.subjectKind}:${key.subjectId}:${key.day}:${key.threadKind}`;
}
export function parseTutorThreadId(id: string): TutorThreadKey | null {
  const parts = id.split(":");
  if (parts.length < 4) return null;
  const subjectKind = parts[0] as SubjectKind;
  const threadKind = parts[parts.length - 1] as TutorThreadKind;
  const day = parts[parts.length - 2] as string;
  const subjectId = parts.slice(1, -2).join(":");
  if (!SUBJECT_KINDS.includes(subjectKind) || !TUTOR_THREAD_KINDS.includes(threadKind)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || subjectId === "") return null;
  return { subjectKind, subjectId, day, threadKind };
}

/** IDs retired at v1 (contracts §1.2). `content/ids.lock.json` is the full ledger. */
export const RETIRED_IDS_V1: readonly { id: string; kind: IdKind; supersededBy: readonly string[] }[] = [
  { id: "CF", kind: "capstone", supersededBy: ["CF-A", "CF-T"] },
  { id: "E12", kind: "skill", supersededBy: ["E12a", "E12b"] },
];

/** One row of `content/ids.lock.json`. */
export interface IdLockEntry {
  id: string;
  kind: IdKind;
  retiredAt?: string;
  supersededBy?: string[];
}
