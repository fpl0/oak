// @oak/grader: the shared headless grader. One module graph runs in three hosts: a browser module
// Worker (./host/browser.dom.ts), a Bun Worker and a Bun subprocess (./host/bun.bun.ts). The only Strudel
// packages it may import are @strudel/core, mini, tonal and transpiler.
//
// Promote spikes/s1-grader (runtime.ts, lint.ts, protocol.ts, host.ts, worker.ts, proc.ts, watchdog.ts).
// Everything below is the binding public surface; bodies are filled in by the grader builders.
import type {
  AnalysisSummary,
  Diagnostic,
  FeedbackId,
  GradeResult,
  KeySpec,
  Matcher,
  Md,
  MeterId,
  NEvent,
  ParamValues,
  RubricRule,
  TargetSelector,
  TrackRef,
} from "@oak/content-kit";
import type {
  CompareRequest,
  EvalResult,
  FeedbackTemplate,
  GradeRequest,
  MatchResult,
  NormalizeContext,
  Normalized,
  TutorEvalView,
} from "./types.ts";

// Wave 3 seam (docs/design/wave3.md §3.3): which key each stretch of each track is read in, for degree labels.
export {
  type EventLabel,
  eventLabels,
  type KeyContextOptions,
  type KeySpan,
  keyAt,
  type TrackKeyContext,
  trackKeyContexts,
  transposeAfterScaleTracks,
} from "./analyze/scale-context.ts";
// --- realm, evaluation, normalization, lint (grader runtime) --------------------------------------
export { lintBase, lintOak, lintStrict, sectionsFromAst, toolsUsed } from "./lint/index.ts";
export { drumRole, inferRoles, normalize, SILENT_GAIN } from "./normalize/nevent.ts";
// Performance steps: targets and pass rules; the pitch/tap measurement itself is @oak/pitch's.
export {
  minIoiMs,
  performancePasses,
  singTargets,
  tapTargets,
  tapWindow,
} from "./perf/index.ts";
export { evaluateForGrading } from "./runtime/analyze.ts";
export { barsToQuery } from "./runtime/caps.ts";
export { initRealm } from "./runtime/realm.ts";
export * from "./types.ts";

import { keyEstimate as keyEstimateImpl } from "./analyze/key.ts";
import { analyzePiece as analyzePieceImpl, linerNotes as linerNotesImpl } from "./analyze/piece.ts";
import { straighten as straightenImpl } from "./analyze/swing.ts";
import {
  periodOf as periodOfImpl,
  resolveTarget as resolveTargetImpl,
  selectTrack as selectTrackImpl,
} from "./analyze/tracks.ts";
import { toTutorEvalView as toTutorEvalViewImpl } from "./analyze/tutor-view.ts";
import { FEEDBACK_CATALOG as CATALOG, renderFeedback as renderFeedbackImpl } from "./feedback/catalog.ts";
import { compareWith } from "./grade/compare.ts";
import { type GradeDeps, gradeWith } from "./grade/index.ts";
import { type LadderGradeRequest, ladderGradeRequest as ladderGradeRequestImpl } from "./grade/ladder.ts";
import {
  type PhraseCheckGradeRequest,
  phraseCheckRequest as phraseCheckRequestImpl,
} from "./grade/phrase-check.ts";
import {
  type SongLadderGradeRequest,
  songLadderRequest as songLadderRequestImpl,
} from "./grade/song-ladder.ts";
import {
  type StandardLadderGradeRequest,
  standardLadderRequest as standardLadderRequestImpl,
} from "./grade/standard-ladder.ts";
import { toolsUsed as toolsUsedImpl } from "./lint/index.ts";
import { runMatcher as runMatcherImpl } from "./match/index.ts";
import { normalize as normalizeImpl } from "./normalize/nevent.ts";
import { runRubric as runRubricImpl } from "./rubric/index.ts";
import { evaluateForGrading as evaluateImpl } from "./runtime/analyze.ts";
import { R as REALM } from "./runtime/realm.ts";

// The realm is injected into the grade pipeline (./grade cannot import this module without a cycle).
// `toolsUsed` reads the toolbox the realm was initialised with; an empty toolbox means "no toolbox data".
// Without toolbox data `toolsUsed` is left out so `uses` / `must-use` fall back to their source scan.
const realmToolsUsed = (code: string): { id: string }[] => toolsUsedImpl(code, REALM.toolbox);
let codeIndex: { of: readonly unknown[]; map: Map<string, string> } | null = null;
/** A toolbox entry's code form (`ToolEntry.code`), indexed once per toolbox. */
const realmToolCode = (id: string): string | null => {
  if (codeIndex?.of !== REALM.toolbox)
    codeIndex = { of: REALM.toolbox, map: new Map(REALM.toolbox.map((t) => [t.id as string, t.code])) };
  return codeIndex.map.get(id) ?? null;
};
function realmDeps(): GradeDeps {
  const base: GradeDeps = { evaluate: evaluateImpl, normalize: normalizeImpl };
  return REALM.toolbox.length > 0 ? { ...base, toolsUsed: realmToolsUsed, toolCode: realmToolCode } : base;
}

// --- realm (call inside a worker, a subprocess, or directly in tests and content CI) -------------

/** Grades one response. Dispatches by exercise kind; code kinds run lint → constraints → eval → normalize → match → rubric. */
export function gradeExercise(req: GradeRequest): Promise<GradeResult> {
  return gradeWith(req, realmDeps());
}
/** `compare_haps`: the learner's code against an exercise's reference or against other code. */
export function compareCode(req: CompareRequest): Promise<GradeResult> {
  return compareWith(req, realmDeps());
}

// --- feedback catalog ---------------------------------------------------------------------------

/** The registry of feedback codes: exercises §2.6 plus the additions of contracts §5.7. Source of truth for `FeedbackId`. */
export const FEEDBACK_CATALOG: Readonly<Record<string, FeedbackTemplate>> = CATALOG;
/** Renders a diagnostic with its catalog template, or the exercise's override text. Deterministic. */
export function renderFeedback(d: Diagnostic, overrides?: Partial<Record<FeedbackId, Md>>): string {
  return renderFeedbackImpl(d, overrides);
}
export { catalogSeverity, messagesOf, sortDiagnostics } from "./feedback/catalog.ts";

// --- analysis shared with the app, the notation engine and the tutor -----------------------------

/** Events a `TrackRef` selects: a label, '*', '@role' or 'band.<label>'. */
export function selectTrack(n: Normalized, ref: TrackRef): NEvent[] {
  return selectTrackImpl(n, ref);
}
/** Resolves a predicate target at grade time: the selected events, whose `locs` and IDs are the accepted click targets. */
export function resolveTarget(n: Normalized, selector: TargetSelector, ctx: NormalizeContext): NEvent[] {
  return resolveTargetImpl(n, selector, ctx);
}
/** Smallest number of bars after which the events repeat, up to `maxBars`. */
export function periodOf(events: readonly NEvent[], maxBars: number): number {
  return periodOfImpl(events, maxBars);
}
/** The deterministic summary a compose or transcribe result carries, and liner notes are written from. */
export function analyzePiece(n: Normalized, ctx: NormalizeContext & { code: string }): AnalysisSummary {
  return analyzePieceImpl(n, ctx);
}
/** Deterministic liner notes from the analysis and the satisfied rules: the fallback when the tutor is off. */
export function linerNotes(
  analysis: AnalysisSummary,
  result: GradeResult,
  extra?: { band?: string; lockedTools?: string[]; attribution?: string },
): string {
  return linerNotesImpl(analysis, result, extra);
}
/** Straightens swung onsets back to the grid: subtracts `amount / 2 × slot` from each off-beat onset, durations untouched (contracts §6.10 item 6). */
export function straighten(
  events: readonly NEvent[],
  swing: { subdivision: 8 | 16; amount: number },
  meter: MeterId,
): NEvent[] {
  return straightenImpl(events, swing, meter);
}
export function keyEstimate(events: readonly NEvent[]): { key: KeySpec; r: number }[] {
  return keyEstimateImpl(events);
}

// --- matchers (also usable directly, on events the caller already has) ---------------------------

/** Runs a content `Matcher` on reference and answer events. */
export function runMatcher(
  matcher: Matcher,
  reference: Normalized,
  answer: Normalized,
  ctx: NormalizeContext,
): MatchResult {
  return runMatcherImpl(matcher, reference, answer, ctx);
}
/** Evaluates rubric rules on a piece. Numeric rules return `{ ok, value, target }` with partial credit `min(1, value / target)`. */
export function runRubric(
  rules: readonly RubricRule[],
  n: Normalized,
  ctx: NormalizeContext & { code: string; params: ParamValues },
): NonNullable<GradeResult["rubric"]> {
  return runRubricImpl(
    rules,
    n,
    REALM.toolbox.length > 0 ? { ...ctx, toolsUsed: realmToolsUsed, toolCode: realmToolCode } : ctx,
  );
}

// --- views for the tutor ------------------------------------------------------------------------

/** `evaluate_strudel` output (≤ 64 events per track), before redaction. */
export function toTutorEvalView(result: EvalResult, ctx: NormalizeContext): TutorEvalView {
  return toTutorEvalViewImpl(result, ctx);
}

// --- Wave 4 seams (docs/design/wave4.md §3.2) ------------------------------------------------------

export {
  type BeatHarmony,
  type FunctionBand,
  type HarmonyView,
  harmonyView,
  type MelodyNoteRelation,
  type MelodyNoteRole,
  type SoundingChord,
} from "./analyze/harmony-view.ts";
export { STAGE_PASS, stagePassed } from "./grade/index.ts";
export {
  type CapstoneLength,
  capstoneLength,
  LADDER_MATCHERS,
  LADDER_PASS,
  type LadderGradeRequest,
  type LadderItemSpec,
  type LadderLevel,
  type LadderSessionScore,
  type LadderStage,
  ladderExercise,
  ladderGradedPass,
  ladderGradeRequest,
  ladderMatcher,
  nextRealism,
  REALISM_DOWN_BELOW,
  REALISM_UP_AFTER,
  REALISM_UP_AT,
  type RealismLevel,
} from "./grade/ladder.ts";
export {
  PHRASE_PASS,
  PHRASE_STAGE_PASS,
  type PhraseCheckGradeRequest,
  phraseCheckExercise,
  phraseCheckPassed,
  phraseCheckRequest,
  phraseMatcher,
  phraseReference,
  phraseWindow,
} from "./grade/phrase-check.ts";
export { staffChordsCheck } from "./grade/staff-chords.ts";
export {
  type GateCheck,
  type GateFault,
  trackChords,
  type VoicedChord,
  voicedChords,
  voicingGateCheck,
} from "./rubric/harmony-rules.ts";

/**
 * Grades one phrase check of a transcribe capstone (X1) in the browser grader host, capstone mode: the
 * phrase's window of the learner's draft against the chosen song's answer key (pass 0.85; chord stages 0.80).
 */
export function gradePhraseCheck(req: PhraseCheckGradeRequest): Promise<GradeResult> {
  return gradeExercise(phraseCheckRequestImpl(req));
}

/** Grades a ladder submission exactly against the hidden reference (contracts §6.12; pass ≥ 0.85). */
export function gradeLadder(req: LadderGradeRequest): Promise<GradeResult> {
  return gradeExercise(ladderGradeRequestImpl(req));
}
/**
 * Grades a capstone draft in `capstone` mode (contracts §6.4: the whole piece up to 128 bars, 5 s, 60 000 haps,
 * `durationSec` from the AST). Same pipeline as `gradeExercise`; only the mode is fixed.
 */
export function gradeCapstone(
  req: Omit<GradeRequest, "ctx"> & { ctx: Omit<GradeRequest["ctx"], "mode"> },
): Promise<GradeResult> {
  return gradeExercise({ ...req, ctx: { ...req.ctx, mode: "capstone" } });
}

// --- Wave 5 seams (docs/design/wave5.md §3.2) ------------------------------------------------------

export {
  type BassNoteView,
  type BassView,
  type BluesView,
  bassView,
  bluesView,
  CONTRAST_AXES,
  CONTRAST_THRESHOLDS,
  type ContrastAxis,
  contrastAxes,
  type FormSectionView,
  type FormView,
  formView,
  type SectionFeatures,
  sectionFeatures,
  swingView,
  type TrackSwing,
} from "./analyze/wave5-views.ts";
export {
  nextSongStage,
  SONG_LADDER_MATCHERS,
  SONG_LADDER_PASS,
  SONG_LADDER_STAGES,
  type SongLadderGradeRequest,
  type SongLadderItem,
  type SongLadderLevel,
  type SongLadderStage,
  songLadderCheck,
  songLadderPassed,
  songLadderRequest,
} from "./grade/song-ladder.ts";

/**
 * Grades a ladder L5 phrase (lesson mode) or an L6 stage (capstone mode) against the song's answer key
 * (contracts §2.9, §6.6 X2). Runs in whichever host grades ladder items (the server's learner host).
 */
export function gradeSongLadder(req: SongLadderGradeRequest): Promise<GradeResult> {
  return gradeExercise(songLadderRequestImpl(req));
}

// Wave 6 Build: the key in force bar by bar as the rubric reads it (contracts §6.8), and the device detector with
// the bar of each device (CF-A's device rows and the "Your devices so far" card).
export { chordKeys, type KeysByBarOptions, keyChangesByBar, keysByBar } from "./analyze/key-plan.ts";
export { type Device, detectDevices, MODULATION_MIN_BARS, SYNCOPATED_BASS_MIN } from "./analyze/piece.ts";
// Wave 6 seam (docs/design/wave6.md §3.2): the U12–U17 views, the L8 / CF-T standard ladder, the rule fields
// that are not built yet.
export {
  type ChordColourView,
  type ChromaticHarmonyView,
  chromaticHarmonyView,
  type KeyChangeView,
  type KeyPlanSpanView,
  type KeyPlanView,
  keyAtBarOf,
  keyPlanView,
  type ModeView,
  modeView,
  type PushView,
  pushesOf,
  type RhythmView,
  rhythmView,
  type TrackRhythmView,
  type TupletView,
  tupletsOf,
} from "./analyze/wave6-views.ts";
export {
  type FormMapAnswer,
  type FormMapResult,
  type FormMapSection,
  formMapKey,
  gradeFormMap,
  nextStandardStage,
  STANDARD_LADDER_MATCHERS,
  STANDARD_LADDER_PASS,
  STANDARD_LADDER_STAGES,
  type StandardCodeStage,
  type StandardLadderGradeRequest,
  type StandardLadderItem,
  type StandardLadderStage,
  songFormOf,
  standardLadderCheck,
  standardLadderPassed,
  standardLadderRequest,
} from "./grade/standard-ladder.ts";
export {
  notBuiltYet,
  type UnbuiltRuleField,
  unbuiltWave6,
  unbuiltWave6Matcher,
  WAVE6_UNBUILT,
} from "./rubric/wave6-rules.ts";

/**
 * Grades one code stage of a ladder L8 standard or of CF-T (bass, changes, melody) against the song's answer key,
 * in capstone mode (contracts §2.9, §6.6 CF-T). The form map is graded without Strudel by `gradeFormMap`.
 */
export function gradeStandardLadder(req: StandardLadderGradeRequest): Promise<GradeResult> {
  return gradeExercise(standardLadderRequestImpl(req));
}
// Wave 7 seam (docs/design/wave7.md §3.2): the advanced tracks' views (built ones and typed `NotBuilt` stubs), the
// rule fields and planned custom rules that fail "not built yet", and the song melody a capstone passes.
export {
  // Wave 7 Build (grader).
  type ClaveAlignmentWindow,
  type ClaveView,
  type ClaveWindowView,
  type CompingBar,
  type ContrafactView,
  claveAlignmentView,
  claveView,
  compareIdioms,
  compingView,
  contrafactView,
  counterMelodyView,
  type DensityBarView,
  densityView,
  type EuclidBarView,
  euclidView,
  type FeelView,
  feelView,
  type GroupingView,
  groupingView,
  hemiolaView,
  type IdiomView,
  type InterlockView,
  idiomView,
  interlockView,
  isNotBuilt,
  JAZZ_DEVICE_NAMES,
  type LevelView,
  levelsView,
  NEUTRAL_CONTROL,
  type NotBuilt,
  notBuilt,
  type PolyrhythmBar,
  polymeterView,
  polyrhythmView,
  type RegisterClashView,
  type ReharmView,
  registerClashView,
  reharmView,
  sampleChopView,
  soundControlView,
  type TensionNoteView,
  type TwoFiveView,
  tensionView,
  twoFiveView,
  type VoicingView,
  voicedChordOf,
  voicingView,
  type WalkingBassBar,
  walkingBassView,
} from "./analyze/wave7-views.ts";
// Wave 7 Build (grader): the answers the tracks add (grouping, Euclid numbers, jazz chord text, voicings, two-lane
// taps) and the custom rules (rubric/wave7-custom.ts).
export {
  combineLanePerformances,
  euclidCheck,
  groupingCheck,
  jazzChordText,
  keyboardVoicingCheck,
  parseJazzChord,
  tapLaneTargets,
  voicingShapeCheck,
} from "./grade/answers-wave7.ts";
export { standInModel, WAVE7_BUILT_CUSTOM } from "./rubric/wave7-custom.ts";
export {
  notBuiltCustom,
  unbuiltWave7,
  WAVE7_REBUILD,
  WAVE7_UNBUILT,
  wave7CustomStubs,
  wave7UnbuiltCustom,
} from "./rubric/wave7-rules.ts";
