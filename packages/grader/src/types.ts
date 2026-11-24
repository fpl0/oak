// Public types of @oak/grader: the raw event, evaluation results, the worker protocol and the host
// interface. `NEvent`, `GradeResult`, `Diagnostic`, `Matcher` and `RubricRule` are the content contract and
// live in @oak/content-kit; this file is the plumbing around them.
import type {
  AnalysisSummary,
  Answer,
  CodeRange,
  Diagnostic,
  Dimension,
  DimScore,
  Exercise,
  GradeResult,
  GradingMode,
  HintRung,
  KeyPlanEntry,
  KeySpec,
  Layer,
  LearnerProfile,
  LintContext,
  LintDiagnostic,
  LintResult,
  Matcher,
  MeterId,
  NEvent,
  ParamValues,
  PickupSpec,
  Rat,
  SwingSpec,
  ToolEntry,
} from "@oak/content-kit";
import type { SongBandWire } from "./song/compose.ts";

// --- raw events ---------------------------------------------------------------------------------

/**
 * One onset hap as it leaves the Strudel realm: JSON-safe (a raw Hap has BigInt fields), unnormalized.
 * `events` arrays are ALWAYS sorted by (begin, track order, midi): `queryArc` is not time-sorted across
 * cycle boundaries (spikes S2, S4).
 */
export interface OakEvent {
  /** Label ('mel'), '$0', 'main', or 'band.<label>'. */
  track: string;
  /** Exact `whole.begin` / `whole.end` as fraction strings ("0", "1/3", "25/24"), in cycles. */
  begin: string;
  end: string;
  beginF: number;
  endF: number;
  /** MIDI, possibly fractional (from `freq`); `null` when the hap carries no pitch (drums, `n` without scale). */
  midi: number | null;
  pitchSource: "note-str" | "note-num" | "freq" | "value" | "n-index" | "none";
  /** `value.note` as Strudel carries it. Never display it: `.scale()` spells accidentals backwards. */
  note: string | number | null;
  freq: number | null;
  s: string | null;
  /** Sample index, or the raw step string before `.scale()` ("3#"). */
  n: number | string | null;
  bank: string | null;
  gain: number | null;
  velocity: number | null;
  postgain: number | null;
  /** `clip` / `legato` (one control, two names). */
  clip: number | null;
  /** `octave` control: shifts playback by 12 per step without changing `note`. */
  octave: number | null;
  /** The chord symbol: `chord()` value, or the `_oakChord` tag the voicing shim leaves on each voiced note. */
  chord: string | null;
  /** `hap.context.scale` ("C4 major") when the pitch came through `.scale()`. */
  scale: string | null;
  /**
   * The note was moved to another pitch class after `voicing()` / `rootNotes()` (`.note()`, `.transpose()`):
   * `chord` no longer names what sounds, and `normalize` drops the symbol of its whole chord.
   */
  chordStale?: true;
  /** Corrections pass: the voicing dictionary in force when `voicing()` voiced this note (`NEvent.voicedWith`). */
  voicedWith?: string;
  /** Wave 5. The sound controls the hap sets (`SOUND_CONTROL_KEYS`), when it sets any (`NEvent.controls`). */
  controls?: Record<string, number | string>;
  /**
   * [start, end) offsets into the ORIGINAL code, one per contributing mini-notation atom, later-applied
   * first: for `note("c4").s("piano")` the first entry is the word `piano`, not the note.
   */
  locations: OakLocation[];
}

/**
 * One contributing mini-notation atom. `fn` is the role of the location: the call whose string argument
 * holds the atom (`note`, `n`, `s`, `scale`, `chord`, …); `text` is the atom as written. Both are absent
 * when the location falls outside a string argument of a call.
 */
export interface OakLocation {
  start: number;
  end: number;
  fn?: string;
  text?: string;
}

export interface LogLine {
  level: "log" | "warn" | "error";
  /** Tag between the brackets of a Strudel logger line: voicing, tonal, query, eval, mini; `null` for plain output. */
  tag: string | null;
  message: string;
}

export type GraderErrorKind =
  | "lint"
  | "eval"
  | "query"
  | "not-a-pattern"
  /** Post-query count above the hap cap. */
  | "too-many-events"
  /** The fuel budget ran out inside the query (a pattern like `s("bd*1000000")`). */
  | "too-much-work"
  /** The host killed the realm after the wall-clock limit. */
  | "timeout"
  | "crashed"
  | "internal";

export interface GraderErrorInfo {
  kind: GraderErrorKind;
  message: string;
  line?: number;
  pos?: number;
  lint?: LintDiagnostic[];
}

// --- limits (contracts §6.4) --------------------------------------------------------------------

export interface ModeLimits {
  /** Most bars queried. */
  maxBars: number;
  /** Wall clock; on expiry the worker is killed and respawned. */
  timeoutMs: number;
  hapCap: number;
  /** `periodOf` is capped here. */
  periodCap: number;
}
export const MODE_LIMITS: Readonly<Record<GradingMode, ModeLimits>> = {
  lesson: { maxBars: 64, timeoutMs: 1500, hapCap: 20_000, periodCap: 16 },
  capstone: { maxBars: 128, timeoutMs: 5000, hapCap: 60_000, periodCap: 128 },
  tutor: { maxBars: 16, timeoutMs: 1500, hapCap: 5_000, periodCap: 16 },
};
/** Fraction operations measured per event in spike S1: the default fuel is `max(1e6, hapCap × FUEL_PER_EVENT)`. */
export const FUEL_PER_EVENT = 50;
export function defaultFuel(hapCap: number): number {
  return Math.max(1_000_000, hapCap * FUEL_PER_EVENT);
}

// --- evaluation ---------------------------------------------------------------------------------

export interface EvalOptions {
  mode: GradingMode;
  /** Cycles to query, [fromBar − 1, fromBar − 1 + bars). Clamped to the mode's `maxBars`. */
  bars: number;
  /** 1-based first bar; default 1. Only `tutor` mode starts elsewhere. */
  fromBar?: number;
  /** Override of the mode's cap (tests). */
  hapCap?: number;
  /** Fraction-operation budget for evaluate + query; default `defaultFuel(hapCap)`. */
  fuel?: number;
  /** Lint before evaluating; an error-severity finding means no evaluation. `null` skips the lint (tests only). */
  lint: LintContext | null;
  /** Band-layer code, evaluated separately; its tracks are collected as `band.<label>`. */
  band?: string;
  /**
   * The labels of `band` to keep (`drums`, `bass`): the Band's tracks are filtered by the label they register, never
   * line by line. Absent or empty: every label.
   */
  bandTracks?: readonly string[];
  /**
   * A unit song (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.2) in place of `band`: composed
   * exactly as the adapter plays it (song/compose.ts, the one composer), its tracks collected as `band.oak.<label>` and
   * `band.take.<lessonId>.<label>`. With a live Make the evaluated code is placed into today's sections. The Workbench
   * analysis only: grading never passes it (spec §4.1).
   */
  song?: SongBandWire;
  meter?: MeterId;
}

export interface EvalSuccess {
  ok: true;
  cps: number;
  /** False when the code never called setcps/setcpm (the default 0.5 applies). */
  cpsSet: boolean;
  bpm: number;
  /** Track names in source order; Band tracks last. */
  tracks: string[];
  /** Sorted by (begin, track order, midi). */
  events: OakEvent[];
  /** [start, end] of every mini-notation atom, in source order (from the transpiler). */
  miniLocations: [number, number][];
  logs: LogLine[];
  /** Findings of the lint (non-blocking) and of the evaluation (`[tonal]`, `[voicing]` log lines mapped to codes). */
  diagnostics: Diagnostic[];
  lint: LintResult | null;
  /** Bars actually queried. */
  bars: number;
  /** The `arrange()` sum from the AST, else `periodOf` up to the mode's cap; `null` when unknown. */
  totalBars: number | null;
  /** The piece is longer than the mode's cap: only the first `bars` were queried (`eval.truncated`). */
  truncated: boolean;
  fuelUsed: number;
  ms: number;
}
export interface EvalFailure {
  ok: false;
  error: GraderErrorInfo;
  logs: LogLine[];
  lint: LintResult | null;
  ms: number;
}
/** A lint or evaluation failure is data (`ok: false`), never a thrown error; only infrastructure failures throw. */
export type EvalResult = EvalSuccess | EvalFailure;

/** Events normalized to the content contract's `NEvent`, grouped for the matchers. */
export interface Normalized {
  byTrack: Record<string, NEvent[]>;
  /** Learner tracks only, sorted by (onset, midi). */
  all: NEvent[];
  /** Band tracks (`band.drums`, ...): never matched by '*' or a role. */
  band: NEvent[];
  cps: number;
  bpm: number;
  roles: Partial<Record<Exclude<Layer, "all">, string>>;
}
export interface NormalizeContext {
  meter: MeterId;
  key?: KeySpec;
  swing?: SwingSpec;
  pickup?: PickupSpec;
  /**
   * Wave 6 (feature `key-plan`, contracts §6.8): the keys of an exercise whose example or answer changes key,
   * by bar (1-based; the pickup bar is 0). Degrees, syllables and numerals of a bar are read in the key in force
   * at that bar (`keyAtOnset`); `key` stays the first key.
   */
  keyPlan?: readonly KeyPlanEntry[];
}

// --- grading ------------------------------------------------------------------------------------

/** What the learner answered, by exercise kind. Performance kinds arrive already measured by @oak/pitch. */
export type ExerciseResponse =
  /**
   * `part` (Wave 4, `by-ear.parts`): grade one part of a by-ear transcription, by its track label. `stage`
   * (Wave 4, `transcribe.stages`): grade one stage of a staged chord transcription.
   */
  | { code: string; part?: string; stage?: "bass" | "quality" | "rn" }
  | { blanks: Record<string, string> }
  | { order: string[] }
  | { answer: Answer }
  | { staff: NEvent[] }
  | { click: CodeRange | string }
  | { clicks: (CodeRange | string)[]; code?: string }
  /** `tap` and `sing`: graded on the main thread by @oak/pitch; the grader only wraps the result. */
  | { performance: MatchResult }
  | { parts: ExerciseResponse[] }
  | { skipped: true };

export interface GradeContext {
  /** `${owner}/${slug}`. */
  exerciseGlobalId: string;
  mode: GradingMode;
  /** The lesson's defaults; the exercise's own fields win. */
  key: KeySpec;
  meter: MeterId;
  bpm: number;
  swing?: SwingSpec;
  pickup?: PickupSpec;
  params: ParamValues;
  attemptNo: number;
  firstAttempt: boolean;
  rung: HintRung;
  tutorHints: number;
  extraReplays: number;
  lint: LintContext;
  band?: string;
  profile?: LearnerProfile;
  /**
   * Wave 4: only notes with an onset in `[from, to)` cycles are compared, on both sides (a phrase of an X1
   * draft, `phraseCheckRequest`). Absent: the whole query.
   */
  window?: { from: Rat; to: Rat };
  /**
   * Wave 6 (d12): the answer must be in the recording's key (ladder L5, L6 and L8, set by `songLadderRequest`
   * and `standardLadderRequest`). A transposed tune fails with `melody.wrong-key`; without it (L1–L4, X1, X2) a
   * tune in another key keeps the `melody.transposed` note.
   */
  requireKey?: boolean;
  /**
   * Wave 6 (CF-T.S4): the sections of the song a transcription capstone arranges, in order, each with its length
   * in bars (`SongDef.answerKey.sections`; `songFormOf`). The `form` rule's `@song` pattern compares with it.
   * Corrections pass: `chords`, the song's lead-sheet symbols bar by bar, for the `song-kept` rule.
   */
  songForm?: readonly { label: string; bars: number; chords?: readonly (readonly string[])[] }[];
  /**
   * Wave 7 (carry f4; docs/design/wave7.md §3.2): the song's own melody, note by note, for the rules that keep a
   * tune (CF-T.S4's arrangement, JC4's reharmonisation, AC1's two versions; `song-melody-kept`). Onsets in bars from
   * the first full bar (a pickup's notes are negative), MIDI as the answer key writes it. The capstone host fills it
   * from `SongDef.answerKey` (the song the learner picked); absent, those rules fail "not built yet" or name it.
   */
  songMelody?: readonly SongMelodyNote[];
  /**
   * Wave 7 (content-kit `CapstoneDef.versions`, AC1): the OTHER version's code of a two-version capstone, for the
   * rules named in the brief's `across` (`two-versions-differ`). The grader engineer evaluates it in the same realm
   * and passes it to the rubric as `RubricContext.otherVersion`; until then those rules answer "not built yet".
   */
  otherVersion?: { id: "a" | "b"; code: string };
  /**
   * W7 gate: the brief names no key (JC1 travels through three; `CapstoneDef.key` absent), so `key` is the host's
   * reading of the piece, not a key the brief asks for: no `harmony.key-mismatch` note is given.
   */
  keyFree?: boolean;
}

/** One note of a song's melody (`GradeContext.songMelody`). */
export interface SongMelodyNote {
  onset: Rat;
  dur: Rat;
  midi: number;
}

export interface GradeRequest {
  exercise: Exercise;
  response: ExerciseResponse;
  ctx: GradeContext;
}

export type CompareMode = "auto" | "events" | "rhythm" | "melody" | "harmony" | "pcset";
export interface CompareRequest {
  learnerCode: string;
  /** `code`: two pieces of the learner's or the tutor's own code (never redacted). */
  target: { kind: "exercise"; exercise: Exercise; params: ParamValues } | { kind: "code"; code: string };
  fromBar: number;
  bars: number;
  mode: CompareMode;
  key: KeySpec | null;
  meter: MeterId;
  lint: LintContext;
}

/** What a matcher or analyzer returns before it is folded into a `GradeResult`. */
export interface MatchResult {
  score: number;
  dims: Partial<Record<Dimension, DimScore>>;
  diagnostics: Diagnostic[];
  overlay?: GradeResult["overlay"];
  /**
   * `all` matchers: the lowest score of any member (nested `all`s included). "Every member must pass"
   * (content-kit `Matcher`): the step passes only when this floor reaches the pass mark too, so a perfect
   * rhythm can never carry a third of the notes wrong past 0.85 (X1), nor a right voice leading a wrong chord.
   */
  floor?: number;
}

/** A matcher: reference events against answer events. Registered by `Matcher["m"]`. */
export type MatcherFn<M extends Matcher = Matcher> = (
  reference: Normalized,
  answer: Normalized,
  cfg: M,
  ctx: NormalizeContext,
) => MatchResult;

// --- worker protocol (the same in the browser Worker, the Bun Worker and the subprocess) ---------

export interface GraderInit {
  kind: "init";
  /** The unlock table, so the realm can lint: `content/.generated/toolbox.json`. */
  toolbox: ToolEntry[];
  /** Disable the Function constructors and eval after set-up. True in every worker and subprocess. */
  lockdown: boolean;
}
export interface GraderReady {
  kind: "ready";
  initMs: number;
  /** Names in the evaluation scope (about 930 with core + mini + tonal). */
  scopeSize: number;
  /** Pattern methods stubbed to identity (the visual methods and their `_inline` variants). */
  stubbedMethods: string[];
}
export type GraderRequest =
  | { id: string; kind: "ping" }
  | { id: string; kind: "analyze"; code: string; opts: EvalOptions }
  | { id: string; kind: "grade"; req: GradeRequest }
  | { id: string; kind: "compare"; req: CompareRequest }
  | { id: string; kind: "lint"; code: string; ctx: LintContext };
export type GraderResponse =
  | { id: string; ok: true; kind: "ping"; ms: number }
  | { id: string; ok: true; kind: "analyze"; result: EvalResult; ms: number }
  | { id: string; ok: true; kind: "grade"; result: GradeResult; ms: number }
  | { id: string; ok: true; kind: "compare"; result: GradeResult; ms: number }
  | { id: string; ok: true; kind: "lint"; result: LintResult; ms: number }
  /** Infrastructure failure: the request did not run to an answer. */
  | { id: string; ok: false; error: GraderErrorInfo; ms: number };

// --- host ---------------------------------------------------------------------------------------

export type HostBackend =
  /** Browser: a module Web Worker. */
  | "web-worker"
  /** Bun: `new Worker(..., { env: {} })`. For the learner's own code, tests and content CI. */
  | "bun-worker"
  /** Bun: `Bun.spawn(..., { env: {} })` with a watchdog. The only backend with memory isolation: required for model-written code. */
  | "bun-subprocess";

export interface GraderHostOptions {
  toolbox: ToolEntry[];
  /** Per-request wall clock; default: the request mode's `timeoutMs`. */
  timeoutMs?: number;
  /** How long a cold backend may take to report ready. Default 10 000. */
  bootTimeoutMs?: number;
}
export interface HostStats {
  backend: HostBackend;
  spawns: number;
  kills: number;
  crashes: number;
  spawnMs: number[];
  killMs: number[];
}

/**
 * One realm, one request at a time (FIFO), a hard timeout with kill and respawn, a warm spare.
 * A timeout resolves to an `EvalFailure` / an `error`-status `GradeResult` with `eval.timeout`; it never rejects.
 */
export interface GraderHost {
  readonly backend: HostBackend;
  ready(): Promise<GraderReady>;
  analyze(code: string, opts: EvalOptions, signal?: AbortSignal): Promise<EvalResult>;
  grade(req: GradeRequest, signal?: AbortSignal): Promise<GradeResult>;
  compare(req: CompareRequest, signal?: AbortSignal): Promise<GradeResult>;
  lint(code: string, ctx: LintContext): Promise<LintResult>;
  readonly stats: HostStats;
  dispose(): Promise<void>;
}

// --- views for the tutor's GraderPort (server/src/tutor/ports.ts) --------------------------------

/** `evaluate_strudel` output before redaction (contracts §10.3), ≤ 64 events per track. */
export interface TutorEvalView {
  ok: boolean;
  error: { kind: string; message: string; line: number | null } | null;
  tempo: { cps: number; bpm: number; meter: string } | null;
  tracks: {
    label: string;
    role: string;
    totalEvents: number;
    events: {
      bar: number;
      beat: number;
      durBeats: number;
      pitch: string | null;
      degree: string | null;
      sound: string | null;
      chord: string | null;
    }[];
  }[];
  warnings: string[];
  lockedTools: string[];
}

/** One feedback-catalog entry (exercises §2.6 plus the additions of contracts §5.7). */
export interface FeedbackTemplate {
  id: string;
  /** Severity by lint profile where it differs (`code.locked-tool`: error when graded, info in Studio). */
  severity: Diagnostic["severity"] | Partial<Record<"graded" | "studio" | "content", Diagnostic["severity"]>>;
  /** With `{param}` slots. */
  template: string;
}

export interface SectionInfo {
  /** Section type from the const name: `melChorus2` → "chorus". */
  label: string;
  /** The tagged name: "chorus2". */
  tag: string;
  bars: number;
  /** 0-based first cycle. */
  startBar: number;
}

export type { AnalysisSummary, Rat };
