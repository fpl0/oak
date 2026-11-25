// What the current wave supports (contracts §5.1). A kind or rule may sit in the schema before it is
// implemented; content CI rejects a lesson that uses anything outside this list. Rubric rules are
// implemented when the first capstone that needs them is authored.
import { flattenExercise } from "./define.ts";
import type {
  AnswerUi,
  AnswerUiKind,
  AstConstraintName,
  CapstoneDef,
  Exercise,
  ExerciseKind,
  LessonDef,
  Matcher,
  MatcherName,
  MeterId,
  RubricRule,
  RubricRuleName,
} from "./schema/index.ts";
import { TRACK_CUSTOM_RULES } from "./schema/wave7.ts";

export interface Implemented {
  exerciseKinds: readonly ExerciseKind[];
  matchers: readonly MatcherName[];
  constraints: readonly AstConstraintName[];
  rubricRules: readonly RubricRuleName[];
  answerUis: readonly AnswerUiKind[];
  customRules: readonly string[];
  /**
   * Wave 4. Named shapes inside a kind that the platform must support before content may use them
   * (`SchemaFeature`): a new staff expectation, a new field of an existing rule, a step UI option.
   */
  features?: readonly SchemaFeature[];
}

/**
 * Wave 4 shapes that live inside an existing kind, so the kind lists alone cannot tell whether the platform
 * handles them. `unimplementedIn` reports a use of one that `features` does not list.
 */
export const SCHEMA_FEATURES = [
  /** `StaffExpect` `chords` with `palette.chords` (chords built on the staff). */
  "staff-expect.chords",
  /** `DictationEx.stageAnswers` / `stageFlow` / `stagePass` (staged chord dictation). */
  "dictation.stage-answers",
  /** `ByEarSpec.parts` (by-ear transcription one track at a time, bass first). */
  "by-ear.parts",
  /** `TranscribeStepEx.grading.stages` and `given`. */
  "transcribe.stages",
  /** `Stimulus` `capstone-song`. */
  "stimulus.capstone-song",
  /** `Stimulus.showLeadSheet` and `StepUi.leadSheet`. */
  "lead-sheet",
  /** `StepUi.initialPanels`. */
  "step.initial-panels",
  /** `voice-leading` with `voices`, `commonTones`, `noCrossing` or `bassFree` (the U05.L07 gate check). */
  "voice-leading.gate",
  /** `progression` with `bars`. */
  "progression.bars",
  /** `StepDef.gateCheck` (U05.L08's second chance at the voicing gate) and the condition's `variants`. */
  "step.gate-check",
  // Wave 5 (U08–U11, A1, C3–C5, X2; AUTHORING §18).
  /** `RubricRuleBase.section`: a rule read on one section or bar window of the piece. */
  "rubric.section",
  /** `chord-qualities` with `depth: "seventh"` (C5: every chord a dominant seventh). */
  "chord-qualities.depth",
  /** `degree-set` with `anyOf` (C5: ♭3 or ♭5 at least twice). */
  "degree-set.any-of",
  /** `ends-on-degree` with `over` (C4: ends on 1 over i). */
  "ends-on-degree.over",
  /** `blues-form` with `choruses` or `quickChangeOk` (C5). */
  "blues-form.choruses",
  /** `StepUi.probe`: a filter curve, envelope shape or harmonics beside the sound (A1). */
  "step.probe",
  /** `StepUi.initialPanels` with `form`, `scope` or `spectrum`. */
  "panel.wave5",
  /** `PhraseCheck.after`: a capstone check that opens after others (X2: bass → changes → melody). */
  "capstone.check-after",
  // Wave 6 (U12–U17, C6, C7, CF-A, CF-T; AUTHORING §19).
  /** `ExBase.keyPlan`: an exercise whose example or answer changes key, read bar by bar in the key in force. */
  "key-plan",
  /** `rn-palette` with `labels` or `slotKeys` (a pivot chord named in two keys). */
  "rn-palette.slot-keys",
  /** `grid` with `stepsPerBar` 6 (a 6/8 bar) or 24 (sixteenth-note triplets). */
  "grid.steps",
  /** `form` with `input: "map"` and `Answer.bars` (the form map of a whole tune). */
  "form.map",
  /** `scale-builder` with `from` ("raise or lower one note to get the mode"). */
  "scale-builder.from",
  /** `staff-input` with `palette.ties: true`. */
  "staff-input.ties",
  /** `staff-input` with a dotted duration token (`4.`). */
  "staff-input.dots",
  /** `staff-input` with a triplet duration token (`8t`). */
  "staff-input.triplets",
  /** A lesson or exercise in 6/8, 9/8 or 12/8: the dotted-quarter beat in the roll, the staff, taps and grids. */
  "meter.compound",
  /** `SingEx` with `mode: "guide-tones"`. */
  "sing.guide-tones",
  /** The `harmony` matcher with `wrongQuality: "none"` (d11: no credit for a right root with the wrong quality). */
  "harmony.wrong-quality",
  /** `contains-rn` with `kind` (any secondary dominant, any borrowed chord). */
  "contains-rn.kind",
  /** `contains-rn` with `inOrder` (♭VI–♭VII–I somewhere in the piece). */
  "contains-rn.in-order",
  /** `form` with `contains` and the `*` pattern (the form contains a bridge). */
  "form.contains",
  /** `form` with the `@song` pattern and `extra` (CF-T.S4: the arrangement keeps the song's sections). */
  "form.song",
  /** `mode` with `anyOf` or `tonic: "declared"` (C6: Mixolydian or Dorian). */
  "mode.any-of",
  /** `guide-tones` with `at` or `maxMoveSemis`. */
  "guide-tones.motion",
  /** `modulation` with `via` (a pivot chord, or none). */
  "modulation.via",
  /** `velocity-ghosts` with `drum` or `accents`. */
  "velocity-ghosts.accents",
  /** `CodeMakeEx.fromSketch` (d15: a Make that opens with the learner's sketch of an earlier lesson). */
  "make.from-sketch",
  /** `CapstoneSessionDef.formMap` (CF-T.S1). */
  "capstone.form-map",
  /** `CapstoneSessionDef.rubric` (CF-T.S4). */
  "capstone.session-rubric",
  // Corrections pass (before the learner starts; docs/design/wave6.md "Wave 6 state").
  /** The `melody` matcher with `durations` (written note lengths and rests compared, not only onsets). */
  "melody.durations",
  /** `cadence` with `before` (V → I only, not vii° → I). */
  "cadence.before",
  /** `chord-tones-strong` with `cover` (every strong position needs a note). */
  "chord-tones-strong.cover",
  /** `motif-reuse` with `loopRepeats` (a bar written again unchanged counts as a return). */
  "motif-reuse.loop-repeats",
  /** `voice-leading` with `loop` (the move from the last chord back to the first is judged too). */
  "voice-leading.loop",
  /** `sounds` with `track` (the sound of one named track). */
  "sounds.track",
  /** `pickup` with `leadsIn` (the pickup sounds in the last beat of bar 0). */
  "pickup.leads-in",
  /** `guide-tones` with `at: "bar"` (the note on beat 1 of every bar). */
  "guide-tones.bar",
  /** `guide-tones` with `changes` (judged against the given cycle, whatever the chords line plays; gate). */
  "guide-tones.changes",
  /** `onsets` with `excludes` (places that must hold no onset; gate). */
  "onsets.excludes",
  /** `modulation` with `cadence` (the new key's V goes to its I or i). */
  "modulation.cadence",
  /** The `pcset` matcher with `durations` (each chord lasts as the target's does). */
  "pcset.durations",
  // Wave 7 (the advanced tracks; AUTHORING §20, docs/design/wave7.md). Planned until the Build lands each one.
  /** `text` with `normalize: "chord"` and `jazz: true` (jazz glyphs and extensions read as chords; J1.L02). */
  "text.jazz-chord",
  /** `KeyboardEx.expect.voicing` ("build this voicing": shell, rootless A/B, drop-2; J1.L05, J3.L01–L02). */
  "keyboard.voicing",
  /** `StaffExpect` `chords` with `voicing` (the same, written on the staff). */
  "staff-expect.voicing",
  /** `TapEx.lanes` (two lanes at once, one per hand: R2.L04's 3 against 2). */
  "tap.lanes",
  /** `clave` with `minBars` or `exact` (every two-bar window holds the whole clave; RC2). */
  "clave.coverage",
  /** `polyrhythm` with `minBars` or `span` (both pulses in the same bars; R2.L04, RC2). */
  "polyrhythm.together",
  /** `voice-leading` with `voice: "top"` or `minRatio` (AC2's top voice). */
  "voice-leading.top",
  /** `reharmonize` with `devices` (the jazz devices; J5.L01–L04). */
  "reharmonize.devices",
  /** `CapstoneDef.versions` (AC1: one tune, two versions, two pieces of code). */
  "capstone.versions",
] as const;
export type SchemaFeature = (typeof SCHEMA_FEATURES)[number];

/**
 * Wave 1 (the platform, exemplar lessons U00 to U03, C0 and C1): what @oak/grader grades and @oak/notation
 * supports. `transcribe-step` and `staff-write` (with the `staff-input` answer, @oak/notation's staff
 * editing helpers) joined at integration, once gradeExercise handled all kinds; the app's answer UIs are
 * Wave 2 for every kind alike.
 *
 * Wave 4 Foundation added what the grader already grades and unit-tests and the app already renders (the
 * drills use them): the `harmony` matcher; the rules `cadence`, `chord-tones-strong`, `progression`,
 * `contains-rn`, `harmonic-rhythm` and `voice-leading` (its Wave 3 fields; the gate fields are
 * `voice-leading.gate` in `PLANNED`); the `quality-pad` and `rn-palette` widgets (app/src/answers/widgets/
 * Harmony.tsx). C2 is the first capstone that needs the rules (contracts §5.1).
 */
export const IMPLEMENTED: Implemented = {
  exerciseKinds: [
    "predict",
    "run-investigate",
    "code-modify",
    "code-fill",
    "parsons",
    "error-hunt",
    "code-make",
    "identify",
    "fact",
    "keyboard",
    "staff-read",
    "tap",
    "sing",
    "dictation",
    "transcribe-step",
    "staff-write",
    "compose-brief",
    "listen",
    "all",
  ],
  // Wave 5 Build (grader): `controls`, "match this sound" (A1), graded on each event's sound controls with
  // superdough's defaults (packages/grader/src/match/controls.ts and controls.test.ts).
  matchers: ["events", "rhythm", "melody", "harmony", "pcset", "rubric", "all", "controls"],
  constraints: [
    "must-use",
    "must-not-use",
    "arg-matches",
    "labels",
    "no-note-names",
    "no-randomness",
    "max-changed-tokens",
    "edit-only-regions",
    "tempo",
    "max-chars",
  ],
  rubricRules: [
    "bars",
    "tempo-bpm",
    "tracks",
    "in-key",
    "ends-on-degree",
    "range",
    "step-ratio",
    "uses",
    "onsets",
    "degree-set",
    "sounds",
    "distinct-pitches",
    "motif-reuse",
    "cadence",
    "chord-tones-strong",
    "progression",
    "contains-rn",
    "harmonic-rhythm",
    "voice-leading",
    // Wave 4 Build (grader): graded with tests in packages/grader/src/rubric/wave4.test.ts.
    "pickup",
    "chord-qualities",
    "chord-inversions",
    "non-chord-tones",
    // Wave 5 Foundation: graded in @oak/grader since Wave 1 (rubric.test.ts "matches", rubric/wave4.test.ts
    // "matches inside a Make"; the reference is resolved by grade/index.ts) and drawn by the Make like any
    // rule. U08.L01's Make reads the bass under each chord with it (a `harmony` matcher at level `bass`).
    "matches",
    // Wave 5 Build (grader), each with its golden tests: the per-track arrange() pass and the disagreeing-
    // sections fail of contracts §6.3 item 8 (rubric/form-golden.test.ts: form, contrast, groove-lock,
    // key-change), the §6.6 rubrics with one passing piece per shipped flavour and the known-wrong pieces
    // (grade/capstone-wave5.test.ts: C3, C4, C5), and the rule tests (rubric/wave5-rules.test.ts,
    // wave5-features.test.ts, rubric.test.ts).
    "bass-line",
    "notates",
    "groove-lock",
    "duration-sec",
    "form",
    "contrast",
    "swing",
    "syncopation",
    "blues-form",
    // Wave 6 Build (grader), each with its golden tests: the §6.6 rubrics of C6, C7 and CF-A with one passing
    // piece per shipped flavour and the known-wrong pieces (packages/grader/src/grade/capstone-wave6.test.ts),
    // the rule tests on real Strudel output (rubric/wave6-rules.test.ts) and the device detector with the bar of
    // each device (analyze/devices-wave6.test.ts).
    "mode",
    "key-change",
    "modulation",
    "guide-tones",
    "velocity-ghosts",
    "device-count",
    "reharmonize",
    // Added in the Wave 6 Build at the U13 spec's request ("a triplet somewhere"); graded with tests
    // (rubric/wave6-rules.test.ts).
    "tuplets",
    // Corrections pass: the `custom` rule itself. Which functions exist is `customRules` below; `ruleUses` reports
    // an unregistered `fn` as a "custom-rule" use.
    "custom",
    // Wave 7 Build (grader): rebuilt on the views of analyze/wave7-views.ts and golden-tested on real Strudel output
    // with the pre-flight's counterexamples (packages/grader/src/rubric/wave7-rules.test.ts): every bar of a pass is
    // E(k, n) from the onsets heard; the clave in every two-bar window; both pulses in the same bars; the low-interval
    // limits of @oak/theory; the parts not crossing.
    "euclid",
    "clave",
    "polyrhythm",
    "register-separation",
    "no-muddy-low",
  ],
  answerUis: [
    "choice",
    "degree-pad",
    "quality-pad",
    "rn-palette",
    "text",
    "number",
    "keyboard",
    "grid",
    "code",
    "tap",
    "mic",
    "bar-buttons",
    "click-code",
    "click-staff",
    "click-roll",
    "staff-input",
    // Wave 4 integration: graded (grade/answers.ts slotChoices) and rendered (app/src/answers registry).
    "slot-choice",
    // Wave 5 integration: graded (grade/answers-wave5.ts, answers-wave5.test.ts) and rendered (app/src/answers
    // widgets Form.tsx, BarGrid and ScaleBuilder; registry and gallery).
    "form",
    "bar-grid",
    "scale-builder",
    // Wave 7 integration (packages): graded (packages/grader grade/answers-wave7.test.ts) and rendered (app/src/answers
    // widgets Grouping.tsx and Euclid.tsx, registry, gallery, answers/e2e/wave7.pw.ts); the lesson host passes
    // `rhythm.bpm` and a reveal shows `correct` (build-answers, build-lesson).
    "grouping",
    "euclid",
  ],
  // Corrections pass (grader): effect checks for the lesson fixes, each unit-tested on a right and a wrong piece in
  // packages/grader/src/rubric/corrections-rules.test.ts (`CORRECTION_RULES` in rubric/corrections-rules.ts).
  customRules: [
    // Oak 2.0 W0 (docs/oak2/PLAN.md §5–§6): oak2-form.ts, oak2-pitch.ts, oak2-rhythm.ts.
    "ends-on-purpose",
    "carved",
    "staggered-boundary",
    "unique-event",
    "arc",
    "same-shape",
    "bass-names-chord",
    "inverted-copy",
    "rotated-copy",
    "time-shifted",
    "gap-fill",
    "kick-bass-composite",
    "hocket",
    "stepped-control",
    "no-chance",
    "depth-layers",
    "linear-drums",
    "silent-beat",
    "split-beat",
    "held",
    "bars-differ",
    "speed-change",
    "transposed-copy",
    "distinct-keys",
    "orbits-differ",
    "call-response",
    "stack-intervals",
    "chords-per-bar",
    "last-chord",
    "song-kept",
    "tuplets-every-bar",
    "swung-offbeats",
    "voiced-with",
    // Corrections pass, the leftovers (fix:leftovers): a sound control set to a value you can hear, and parts
    // that come in or drop out. `transposed-copy` also takes `unitBars`, `steps`, `pairs`, `together`, `semis`,
    // `otherSound` and `minRatio` (U03.L10, U03.L11, U02.L06).
    "control-set",
    "parts-enter",
    // Corrections gate (attack:still-passes): chords really broken, a note on a black key, a repeat that chance
    // really changes.
    "broken-chord",
    "black-keys",
    "chance-varies",
    "echo",
    // Wave 7 Build (grader): every custom rule of `TRACK_CUSTOM_RULES` (walking-bass, allowed-tensions and
    // ii-v-chain rebuilt to their Wave 7 definitions), each built on its view and tested with right answers, the
    // pre-flight's counterexample and a wrong answer that uses the right function
    // (packages/grader/src/rubric/wave7-custom.test.ts).
    ...Object.keys(TRACK_CUSTOM_RULES),
  ],
  // Wave 4 Build (grader): shapes that need only the grader (no renderer), graded with tests. Wave 4
  // integration: the shapes whose grading is tested here and whose renderer has landed — staff chords
  // (app/src/answers StaffInput with `palette.chords`), staged dictation and by-ear parts (app/src/lesson
  // staged.tsx, byear.tsx), lead sheets (lesson lead-sheet.tsx over @oak/notation `leadSheetInput`), the
  // panels a step opens (lesson → Workbench `initialPanels`) and the gate check (lesson gate.ts).
  features: [
    "voice-leading.gate",
    "progression.bars",
    "staff-expect.chords",
    "dictation.stage-answers",
    "by-ear.parts",
    "lead-sheet",
    "step.initial-panels",
    "step.gate-check",
    // Wave 5 Build (grader): fields of existing rules that only the grader reads (rubric/wave5-features.test.ts;
    // C4 and C5 in grade/capstone-wave5.test.ts). A Make line and the capstone checklist draw them as any rule.
    "rubric.section",
    "chord-qualities.depth",
    "degree-set.any-of",
    "ends-on-degree.over",
    "blues-form.choruses",
    // Wave 5 integration: the X2 check order (graded per check by `gradePhraseCheck`, kept by the server's
    // capstone sessions, opened in order by the capstone workspace), and the A1 probe and the form, scope and
    // spectrum panels a step opens (lesson `initialPanelsOf` / `scopePanel` → the Workbench draws them).
    "capstone.check-after",
    "step.probe",
    "panel.wave5",
    // Wave 6 Foundation: `CodeMakeEx.fromSketch` changes nothing a grader or a test reads (the starter stays a
    // complete starter, and every test grades against it). Until the lesson host and the Workbench open the
    // learner's saved sketch (Wave 6 Build, d15) the Make opens with Oak's copy, as it always has, so content
    // may carry the field from now on: the three Makes that say "your loop" or "your blues" do (U06.L10,
    // U10.L06, U11.L07), and the host's tests read them.
    "make.from-sketch",
    // Wave 6 Build (grader): fields that only the grader reads, graded with tests (packages/grader/src
    // rubric/wave6-rules.test.ts, grade/decisions-wave6.test.ts for d11, grade/capstone-wave6.test.ts,
    // grade/standard-ladder.test.ts). A Make line and the capstone checklist draw them as any rule.
    "harmony.wrong-quality",
    "contains-rn.kind",
    "contains-rn.in-order",
    "form.contains",
    "form.song",
    "mode.any-of",
    "guide-tones.motion",
    "modulation.via",
    "velocity-ghosts.accents",
    // Wave 6 Build: rendered by their owners and graded with tests, moved here on the renderer owner's request.
    //   staff-input.ties / .dots / .triplets  answers (staff/rhythm.ts → StaffInput.tsx) on notation's note list; a
    //                          tied note is one event, `4.` lasts three 8ths, `8t` a third of a beat (packages/grader
    //                          grade/staff-rhythm-wave6.test.ts against Strudel's own `@` and brackets)
    //   grid.steps             answers (RhythmGrid grouped by the meter), drills-ui; graded as the cells chosen
    //   meter.compound         lesson (tap pad and grid in the meter, counted on the dotted quarter), workbench (beat
    //                          grid, 12/8 in Studio), notation (beams by the dotted quarter); the grader has been
    //                          meter-aware since Wave 3 (match/rhythm-wave6.test.ts: tempo unit, grid, no tuplets)
    //   form.map, scale-builder.from, rn-palette.slot-keys  answers (FormMap, ScaleBuilder `from`, RnPalette labels
    //                          and slot keys); graded in grade/answers-wave6.test.ts and grade/key-plan-wave6.test.ts
    "staff-input.ties",
    "staff-input.dots",
    "staff-input.triplets",
    "grid.steps",
    "meter.compound",
    "form.map",
    "scale-builder.from",
    "rn-palette.slot-keys",
    // Wave 6 integration (packages): rendered by the capstone engineer and graded with tests.
    //   capstone.form-map      the CF-T workspace opens S1 with the map (app/src/capstone/x1/FormMapPanel.tsx,
    //                          cft.ts `formMapGrade` → `gradeFormMap`; grade/standard-ladder.test.ts)
    //   capstone.session-rubric  CF-T.S4 grades its own rules on the whole arrangement (cft.ts
    //                          `sessionRubricRequest`, with `songFormOf(song)` for `@song`; capstone-wave6.test.ts)
    "capstone.form-map",
    "capstone.session-rubric",
    // Corrections pass (grader): fields only the grader reads, graded with tests in packages/grader/src/rubric/
    // corrections-rules.test.ts and match/melody-durations.test.ts. A Make line draws them as any rule.
    "melody.durations",
    "cadence.before",
    "chord-tones-strong.cover",
    "motif-reuse.loop-repeats",
    "voice-leading.loop",
    "sounds.track",
    "pickup.leads-in",
    "guide-tones.bar",
    "guide-tones.changes",
    "onsets.excludes",
    "modulation.cadence",
    "pcset.durations",
    // Wave 7 Build (grader): fields that only the grader reads, golden-tested in packages/grader/src/rubric/
    // wave7-rules.test.ts. A Make line and the capstone checklist draw them as any rule.
    "clave.coverage",
    "polyrhythm.together",
    "voice-leading.top",
    "reharmonize.devices",
    // Wave 7 integration (packages): graded (grader grade/answers-wave7.test.ts) and rendered (answers JazzChord.tsx,
    // VoicingLine.tsx with the keyboard and the grand staff, answers/e2e/wave7.pw.ts); the lesson host passes
    // `harmony.chordStyle`, `harmony.jazz` and `harmony.voicing` (build-answers, build-lesson).
    "text.jazz-chord",
    "keyboard.voicing",
    "staff-expect.voicing",
    // Wave 7 integration (closer): `tap.lanes` renders (answers TapPad lanes), the API accepts `{ lanes }`
    // (packages/api AttemptResponseSchema), the lesson host and content/validate/harness.ts grade both hands at once
    // with @oak/pitch `gradeLaneTaps` against `tapLaneTargets(...)`. `capstone.versions` renders in the capstone
    // workspace (app/src/capstone/Versions.tsx; two drafts, A/B at matched loudness, `two-versions-differ` graded with
    // the other version in `GradeContext.otherVersion`; capstone wave7.test.ts, w7-capstones.pw.ts).
    "tap.lanes",
    "capstone.versions",
  ],
};

/**
 * Wave 4 shapes whose GRADING is built and tested (packages/grader: grade/wave4.test.ts, grade/staff-chords.ts,
 * grade/phrase-check.ts) but whose renderer belongs to another owner (answers, lesson, notation, transcribe,
 * capstone). The renderer's owner moves the shape from `PLANNED` into `IMPLEMENTED` once it renders.
 */
export const GRADER_READY: Pick<Implemented, "answerUis" | "features"> = {
  // Wave 7 Build (grader) graded `grouping` and `euclid`; Wave 7 integration moved both into `IMPLEMENTED`.
  answerUis: [],
  // Rendered by Transcribe (ladder items) and the capstone X1 workspace, which read them from the API and
  // content/capstones.ts; no lesson host renders a staged `transcribe-step` or a `capstone-song` stimulus yet.
  features: [
    "transcribe.stages",
    "stimulus.capstone-song",
    // Wave 6 Build (grader): graded and tested, waiting for their renderer. The owner of the renderer asks for the
    // move into `IMPLEMENTED` (this file is the grader engineer's during Build; the integrators' afterwards).
    //   key-plan               melody, events and harmony matchers and every rule read the key in force at each bar
    //                          (packages/grader grade/key-plan-wave6.test.ts); the hosts draw it (notation, workbench)
    "key-plan",
    // Wave 7 Build (grader), graded and tested in packages/grader/src/grade/answers-wave7.test.ts. Wave 7 integration
    // moved text.jazz-chord, keyboard.voicing, staff-expect.voicing, tap.lanes and capstone.versions into `IMPLEMENTED`.
  ],
};

/**
 * Wave 4: in the schema, not yet graded or rendered. The Build phase implements each one (grader, notation,
 * answers, transcribe, capstone, lesson) and moves it into `IMPLEMENTED` with its tests. Unit specs may
 * plan with these (content/validate/specs.test.ts); a lesson that uses one fails content CI until it moves.
 * Docs: AUTHORING §17, docs/design/wave4.md.
 */
export const PLANNED: Implemented = {
  exerciseKinds: [],
  // Wave 5 Build: the `controls` matcher and the rules bass-line, notates, groove-lock, duration-sec, form,
  // contrast, swing, syncopation and blues-form moved into `IMPLEMENTED` with their golden tests.
  matchers: [],
  constraints: [],
  // Wave 6 Build (grader): mode, key-change, modulation, guide-tones, velocity-ghosts, device-count and
  // reharmonize moved into `IMPLEMENTED` with their golden tests. Wave 7 Foundation: the rhythm and arrangement
  // rules that have sat in the schema since Wave 0 (contracts §5.6) meet the tracks; the Build implements each
  // with its golden tests and the pre-flight's counterexamples (clave coverage, simultaneous polyrhythm).
  // Wave 7 Build (grader): all five moved into `IMPLEMENTED` with their golden tests.
  rubricRules: [],
  // Wave 5 integration moved the form strip, the twelve-bar chart and the scale builder into `IMPLEMENTED`.
  // Wave 7 Foundation: the odd-meter grouping and the Euclid numbers; Wave 7 integration moved both into `IMPLEMENTED`.
  answerUis: [],
  // Wave 7 Foundation: the advanced tracks' effect rules, each with its parameters (`TRACK_CUSTOM_RULES`).
  // Wave 7 Build (grader): every one moved into `IMPLEMENTED` with its golden tests.
  customRules: Object.keys(TRACK_CUSTOM_RULES).filter((fn) => !IMPLEMENTED.customRules.includes(fn)),
  features: SCHEMA_FEATURES.filter((f) => !(IMPLEMENTED.features ?? []).includes(f)),
};

/** `IMPLEMENTED` plus `PLANNED`: what a unit spec may promise for this wave. */
export function plannedOrImplemented(
  impl: Implemented = IMPLEMENTED,
  planned: Implemented = PLANNED,
): Implemented {
  const u = <T>(a: readonly T[] = [], b: readonly T[] = []): T[] => [...new Set([...a, ...b])];
  return {
    exerciseKinds: u(impl.exerciseKinds, planned.exerciseKinds),
    matchers: u(impl.matchers, planned.matchers),
    constraints: u(impl.constraints, planned.constraints),
    rubricRules: u(impl.rubricRules, planned.rubricRules),
    answerUis: u(impl.answerUis, planned.answerUis),
    customRules: u(impl.customRules, planned.customRules),
    features: u(impl.features, planned.features),
  };
}

export interface UnimplementedUse {
  what: "exercise" | "matcher" | "constraint" | "rubric-rule" | "answer-ui" | "custom-rule" | "feature";
  name: string;
  /** Exercise slug. */
  exercise: string;
}

function matcherUses(m: Matcher, ex: string, impl: Implemented, out: UnimplementedUse[]): void {
  if (!impl.matchers.includes(m.m)) out.push({ what: "matcher", name: m.m, exercise: ex });
  if (m.m === "harmony" && m.wrongQuality === "none") featureUse("harmony.wrong-quality", ex, impl, out);
  if (m.m === "melody" && m.durations) featureUse("melody.durations", ex, impl, out);
  if (m.m === "pcset" && m.durations) featureUse("pcset.durations", ex, impl, out);
  if (m.m === "all") for (const sub of m.of) matcherUses(sub, ex, impl, out);
  if (m.m === "rubric") for (const r of m.rules) ruleUses(r, ex, impl, out);
}
function featureUse(f: SchemaFeature, ex: string, impl: Implemented, out: UnimplementedUse[]): void {
  if (
    !(impl.features ?? []).includes(f) &&
    !out.some((u) => u.what === "feature" && u.name === f && u.exercise === ex)
  )
    out.push({ what: "feature", name: f, exercise: ex });
}
function ruleUses(r: RubricRule, ex: string, impl: Implemented, out: UnimplementedUse[]): void {
  if (!impl.rubricRules.includes(r.rule)) out.push({ what: "rubric-rule", name: r.rule, exercise: ex });
  if (r.rule === "voice-leading" && (r.voices !== undefined || r.commonTones || r.noCrossing || r.bassFree))
    featureUse("voice-leading.gate", ex, impl, out);
  if (r.rule === "progression" && r.bars) featureUse("progression.bars", ex, impl, out);
  if (r.section) featureUse("rubric.section", ex, impl, out);
  if (r.rule === "chord-qualities" && r.depth === "seventh")
    featureUse("chord-qualities.depth", ex, impl, out);
  if (r.rule === "degree-set" && r.anyOf) featureUse("degree-set.any-of", ex, impl, out);
  if (r.rule === "ends-on-degree" && r.over) featureUse("ends-on-degree.over", ex, impl, out);
  if (r.rule === "blues-form" && (r.choruses !== undefined || r.quickChangeOk))
    featureUse("blues-form.choruses", ex, impl, out);
  if (r.rule === "contains-rn" && r.kind) featureUse("contains-rn.kind", ex, impl, out);
  if (r.rule === "contains-rn" && r.inOrder) featureUse("contains-rn.in-order", ex, impl, out);
  if (r.rule === "form" && (r.contains || r.pattern === "*")) featureUse("form.contains", ex, impl, out);
  if (r.rule === "form" && (r.pattern === "@song" || r.extra)) featureUse("form.song", ex, impl, out);
  if (r.rule === "mode" && (r.anyOf || r.tonic === "declared")) featureUse("mode.any-of", ex, impl, out);
  if (r.rule === "guide-tones" && (r.at !== undefined || r.maxMoveSemis !== undefined))
    featureUse("guide-tones.motion", ex, impl, out);
  if (r.rule === "modulation" && r.via) featureUse("modulation.via", ex, impl, out);
  if (r.rule === "guide-tones" && r.at === "bar") featureUse("guide-tones.bar", ex, impl, out);
  if (r.rule === "guide-tones" && r.changes) featureUse("guide-tones.changes", ex, impl, out);
  if (r.rule === "onsets" && r.excludes) featureUse("onsets.excludes", ex, impl, out);
  if (r.rule === "modulation" && r.cadence) featureUse("modulation.cadence", ex, impl, out);
  if (r.rule === "velocity-ghosts" && (r.drum || r.accents !== undefined))
    featureUse("velocity-ghosts.accents", ex, impl, out);
  if (r.rule === "reharmonize") {
    if (r.kinds) featureUse("contains-rn.kind", ex, impl, out);
  }
  if (r.rule === "cadence" && r.before) featureUse("cadence.before", ex, impl, out);
  if (r.rule === "chord-tones-strong" && r.cover) featureUse("chord-tones-strong.cover", ex, impl, out);
  if (r.rule === "motif-reuse" && r.loopRepeats) featureUse("motif-reuse.loop-repeats", ex, impl, out);
  if (r.rule === "voice-leading" && r.loop) featureUse("voice-leading.loop", ex, impl, out);
  if (r.rule === "sounds" && r.track) featureUse("sounds.track", ex, impl, out);
  if (r.rule === "pickup" && r.leadsIn) featureUse("pickup.leads-in", ex, impl, out);
  if (r.rule === "clave" && (r.minBars !== undefined || r.exact !== undefined))
    featureUse("clave.coverage", ex, impl, out);
  if (r.rule === "polyrhythm" && (r.minBars !== undefined || r.span !== undefined))
    featureUse("polyrhythm.together", ex, impl, out);
  if (r.rule === "voice-leading" && (r.voice !== undefined || r.minRatio !== undefined))
    featureUse("voice-leading.top", ex, impl, out);
  if (r.rule === "reharmonize" && r.devices) featureUse("reharmonize.devices", ex, impl, out);
  if (r.rule === "custom" && !impl.customRules.includes(r.fn))
    out.push({ what: "custom-rule", name: r.fn, exercise: ex });
  if (r.rule === "matches") matcherUses(r.matcher, ex, impl, out);
}

/** Wave 6. The compound meters (contracts §6.9: the dotted-quarter beat). */
export const COMPOUND_METERS: readonly MeterId[] = ["6/8", "9/8", "12/8"];
function answerUiFeatures(ui: AnswerUi, ex: string, impl: Implemented, out: UnimplementedUse[]): void {
  if (ui.ui === "text" && ui.jazz) featureUse("text.jazz-chord", ex, impl, out);
  if (ui.ui === "rn-palette" && (ui.labels || ui.slotKeys)) featureUse("rn-palette.slot-keys", ex, impl, out);
  if (ui.ui === "grid" && (ui.stepsPerBar === 6 || ui.stepsPerBar === 24))
    featureUse("grid.steps", ex, impl, out);
  if (ui.ui === "form" && ui.input === "map") featureUse("form.map", ex, impl, out);
  if (ui.ui === "scale-builder" && ui.from) featureUse("scale-builder.from", ex, impl, out);
  if (ui.ui === "staff-input") {
    if (ui.palette.ties) featureUse("staff-input.ties", ex, impl, out);
    if (ui.palette.durations.some((d) => d.includes("."))) featureUse("staff-input.dots", ex, impl, out);
    if (ui.palette.durations.some((d) => d.endsWith("t"))) featureUse("staff-input.triplets", ex, impl, out);
  }
}

/** Everything an exercise uses that `impl` does not list. Empty = the exercise can ship in this wave. */
export function unimplementedIn(exercise: Exercise, impl: Implemented = IMPLEMENTED): UnimplementedUse[] {
  const out: UnimplementedUse[] = [];
  for (const ex of flattenExercise(exercise)) {
    if (!impl.exerciseKinds.includes(ex.kind)) out.push({ what: "exercise", name: ex.kind, exercise: ex.id });
    if ("matcher" in ex && ex.matcher) matcherUses(ex.matcher, ex.id, impl, out);
    if ("rubric" in ex) for (const r of ex.rubric) ruleUses(r, ex.id, impl, out);
    if ("constraints" in ex)
      for (const c of ex.constraints ?? [])
        if (!impl.constraints.includes(c.c)) out.push({ what: "constraint", name: c.c, exercise: ex.id });
    if ("answer" in ex && !impl.answerUis.includes(ex.answer.ui))
      out.push({ what: "answer-ui", name: ex.answer.ui, exercise: ex.id });
    if ("answer" in ex) answerUiFeatures(ex.answer, ex.id, impl, out);
    if (ex.kind === "dictation")
      for (const ui of Object.values(ex.stageAnswers ?? {})) if (ui) answerUiFeatures(ui, ex.id, impl, out);
    if (ex.keyPlan) featureUse("key-plan", ex.id, impl, out);
    if (ex.meter && COMPOUND_METERS.includes(ex.meter)) featureUse("meter.compound", ex.id, impl, out);
    if (ex.kind === "sing" && ex.mode === "guide-tones") featureUse("sing.guide-tones", ex.id, impl, out);
    if (ex.kind === "code-make" && ex.fromSketch) featureUse("make.from-sketch", ex.id, impl, out);
    if ("stimulus" in ex && ex.stimulus) {
      if (ex.stimulus.src === "capstone-song") featureUse("stimulus.capstone-song", ex.id, impl, out);
      if (ex.stimulus.src === "code" && ex.stimulus.showLeadSheet) featureUse("lead-sheet", ex.id, impl, out);
    }
    if (ex.kind === "staff-write" && (ex.expect.e === "chords" || ex.answer.palette.chords))
      featureUse("staff-expect.chords", ex.id, impl, out);
    if (ex.kind === "staff-write" && ex.expect.e === "chords" && ex.expect.voicing)
      featureUse("staff-expect.voicing", ex.id, impl, out);
    if (ex.kind === "keyboard" && ex.expect.voicing) featureUse("keyboard.voicing", ex.id, impl, out);
    if (ex.kind === "tap" && ex.lanes) featureUse("tap.lanes", ex.id, impl, out);
    if (ex.kind === "dictation") {
      if (ex.stageAnswers || ex.stageFlow || ex.stagePass !== undefined)
        featureUse("dictation.stage-answers", ex.id, impl, out);
      for (const ui of Object.values(ex.stageAnswers ?? {}))
        if (ui && !impl.answerUis.includes(ui.ui))
          out.push({ what: "answer-ui", name: ui.ui, exercise: ex.id });
      if (ex.byEar?.parts) {
        featureUse("by-ear.parts", ex.id, impl, out);
        for (const p of ex.byEar.parts) matcherUses(p.matcher, ex.id, impl, out);
      }
    }
    if (ex.kind === "transcribe-step" && (ex.given || (ex.grading.mode === "auto" && ex.grading.stages))) {
      featureUse("transcribe.stages", ex.id, impl, out);
      if (ex.grading.mode === "auto")
        for (const st of ex.grading.stages ?? []) matcherUses(st.matcher, ex.id, impl, out);
    }
    if (ex.kind === "parsons") {
      if (ex.accept.matcher) matcherUses(ex.accept.matcher, ex.id, impl, out);
      for (const r of ex.accept.rubric ?? []) ruleUses(r, ex.id, impl, out);
    }
    if (ex.kind === "transcribe-step" && ex.grading.mode === "auto")
      matcherUses(ex.grading.matcher, ex.id, impl, out);
    if (ex.kind === "staff-write" && ex.expect.e === "events")
      matcherUses(ex.expect.matcher, ex.id, impl, out);
  }
  return out;
}

export function unimplementedInLesson(def: LessonDef, impl: Implemented = IMPLEMENTED): UnimplementedUse[] {
  return def.steps.flatMap((s, i) => {
    const out = s.exercise ? unimplementedIn(s.exercise, impl) : [];
    // A lesson in a compound meter needs the whole surface in that meter: reported once, on its first step.
    if (i === 0 && COMPOUND_METERS.includes(def.meter)) featureUse("meter.compound", s.id, impl, out);
    if (s.ui.initialPanels) featureUse("step.initial-panels", s.id, impl, out);
    if (s.ui.initialPanels?.some((p) => p === "form" || p === "scope" || p === "spectrum"))
      featureUse("panel.wave5", s.id, impl, out);
    if (s.ui.probe) featureUse("step.probe", s.id, impl, out);
    if (s.ui.leadSheet) featureUse("lead-sheet", s.id, impl, out);
    if (s.gateCheck) featureUse("step.gate-check", s.id, impl, out);
    return out;
  });
}

/**
 * Wave 5. What a capstone's sessions use outside `impl`: each phrase check's matcher, the `after` order of
 * checks (X2), and every stage exercise. The brief is checked as an exercise (`unimplementedIn`).
 */
export function unimplementedInCapstoneSessions(
  def: CapstoneDef,
  impl: Implemented = IMPLEMENTED,
): UnimplementedUse[] {
  const out: UnimplementedUse[] = [];
  if (def.versions) featureUse("capstone.versions", def.id, impl, out);
  for (const s of def.sessionDefs) {
    for (const x of s.checks ?? []) {
      matcherUses(x.matcher, x.id, impl, out);
      if (x.after) featureUse("capstone.check-after", x.id, impl, out);
    }
    for (const st of s.stages ?? []) out.push(...unimplementedIn(st, impl));
    if (s.formMap) {
      featureUse("capstone.form-map", s.formMap.id, impl, out);
      if (s.formMap.boundaries === "asked") featureUse("form.map", s.formMap.id, impl, out);
    }
    if (s.rubric) {
      featureUse("capstone.session-rubric", s.id, impl, out);
      for (const r of s.rubric) ruleUses(r, s.id, impl, out);
    }
  }
  return out;
}
