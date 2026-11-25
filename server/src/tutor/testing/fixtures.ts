// One fixture lesson with everything the redaction matrix gates: a reference solution, authored
// hints, a known wrong variant, and a checker result with two issues. Test data only.
import type {
  GradeSnapshot,
  LessonSource,
  ProgressSnapshot,
  ReviewSource,
  StepSource,
  StepState,
  SubjectFacts,
} from "../domain.ts";
import type { CapstoneReview, TranscriptionReview } from "../reviews.ts";

export const LESSON_ID = "U03.L02";
export const STEP_ID = "U03.L02/S5";
export const MAKE_STEP_ID = "U03.L02/S9";
export const EXERCISE_REF = "U03.L02/arpeggio-to-the-octave";

export const LESSON: LessonSource = {
  id: LESSON_ID,
  title: "Scale degrees in code",
  objective: "Play an arpeggio that climbs to the octave and comes back.",
  key: "D dorian",
  meter: "4/4",
  bpm: 90,
};

export const STARTER_CODE = 'mel: n("0 ~ ~ ~ ~ ~").scale("D4:dorian")';
/** Two mistakes: the top note (6 instead of 7) and the last note (1 instead of 2). */
export const LEARNER_CODE = 'mel: n("0 2 4 6 4 1").scale("D4:dorian")';
export const SOLUTION_CODE = 'mel: n("0 2 4 7 4 2").scale("D4:dorian")';
export const VARIANT_CODE = 'mel: n("0 2 4 6 4 2").scale("D4:dorian")';

export const STEP: StepSource = {
  lessonId: LESSON_ID,
  id: STEP_ID,
  kind: "write-code",
  grading: "graded",
  exerciseRef: EXERCISE_REF,
  prompt: "Finish the arpeggio so it climbs 1 3 5 8 and steps back down through 5 to 3.",
  starterCode: STARTER_CODE,
  constraints: ["Six notes in the bar", "Stay in D dorian"],
  rubric: [
    { label: "Reaches the octave", required: true },
    { label: "Ends on a chord tone", required: false },
  ],
  hints: [
    "Where does an arpeggio feel finished?",
    "Look at beat 3 of bar 1: which number is the octave when counting starts at zero?",
    'In C major the same climb is n("0 2 4 7"): the top step is 7, not 6.',
    "Use 7 for the octave and 2 for the last note.",
  ],
  knownMistakes: [
    {
      feedback: "melody.degree-off-by-one",
      description: "Counted the octave as n 6, reading degree 7 as the top of the scale.",
      variantCode: VARIANT_CODE,
    },
  ],
  solutions: [SOLUTION_CODE],
};

export const MAKE_STEP: StepSource = {
  lessonId: LESSON_ID,
  id: MAKE_STEP_ID,
  kind: "make",
  grading: "make",
  exerciseRef: null,
  prompt: "Write your own four-bar melody over the drone.",
  starterCode: null,
  constraints: ["Four bars"],
  rubric: [{ label: "Uses at least three different degrees", required: true }],
  hints: null,
  knownMistakes: [],
  solutions: [],
};

/** What Oak's checker found for LEARNER_CODE against the exercise, unredacted. */
export const GRADE: GradeSnapshot = {
  status: "fail",
  score: 0.67,
  dims: { rhythm: 1, melody: 0.67 },
  counts: { missing: 0, extra: 0, wrong: 2 },
  issues: [
    {
      where: { track: "mel", bar: 1, beat: 3, code: { from: 14, to: 15 } },
      severity: "error",
      feedback: "melody.wrong-degree",
      direction: "too-low",
      concept: "the octave is degree 8",
      what: "The top of the arpeggio stops one step short of where it is heading.",
      fix: "Change the fourth step from 6 to 7.",
      expected: "degree 8 (D5), written n 7",
      got: "degree 7 (C5), written n 6",
    },
    {
      where: { track: "mel", bar: 1, beat: 4.33, code: { from: 18, to: 19 } },
      severity: "error",
      feedback: "melody.wrong-degree",
      direction: "too-low",
      concept: "chord tones of the tonic triad",
      what: "The last note lands next to the chord tone instead of on it.",
      fix: "Change the last step from 1 to 2.",
      expected: "degree 3 (F4), written n 2",
      got: "degree 2 (E4), written n 1",
    },
  ],
  warnings: ["code.octave-default"],
};

export function stepState(over: Partial<StepState> = {}): StepState {
  return { rung: 0, passed: false, attempts: 2, rubricMet: [false, false], matchedMistakes: [], ...over };
}

export const PROGRESS: ProgressSnapshot = {
  current: { unit: "U03", lesson: LESSON_ID, step: STEP_ID },
  unlocked: { recent: ["tb.scale", "tb.n", "tb.note", "tb.s", "tb.setcpm"], count: 5 },
  weakSkills: [{ id: "P03", name: "Scale degrees in code", strength: 0.4 }],
  debts: [],
  recentFeedback: [{ code: "melody.degree-off-by-one", count: 3 }],
  families: [{ id: "fam.deg.fet-major", level: 2, confusions: ["4/6"] }],
  streakWeeks: 3,
  singTolerance: 70,
  quiet: false,
};

export const INTRODUCED_TERMS = ["term.scale-degree", "term.octave", "term.arpeggio", "term.tonic"];

export const OPEN_FACTS: SubjectFacts = {
  tutorOpen: true,
  closedReason: null,
  title: null,
  released: null,
  transcriptionSource: null,
};

export const SYLLABUS =
  "# Syllabus v-test\n\nU03.L02 Scale degrees in code: term.scale-degree, term.octave\n";
export const CATALOG =
  "# Strudel catalog v-test\n\nn(pattern): scale steps, counted from zero. Unlocks at U03.L02.\n";

export const REVIEW_SOURCE: ReviewSource = {
  title: "Two-chord groove",
  code: 'drums: s("bd*2, ~ sd, hh*8")\nbass: n("0 ~ 0 4").scale("D2:dorian")',
  brief: "An eight-bar groove on two chords with a drum pattern and a bass line.",
  analysis: "key D dorian · 8 bars · chords i IV · bass on roots",
  rubric: [{ label: "Eight bars", required: true, met: true }],
  learnerNote: "I am not sure about the ending.",
  checklist: [],
  reference: null,
  totalBars: 8,
  revisions: 1,
};

export const CAPSTONE_REVIEW: CapstoneReview = {
  answer: null,
  strengths: [
    { text: "The bass sits on the root on every downbeat, so the two chords read clearly.", bars: [1, 4] },
    { text: "The hi-hats keep a steady eighth-note pulse under the changes.", bars: [1, 8] },
  ],
  revisions: [
    {
      title: "Land the ending on the tonic",
      bars: [7, 8],
      why: "The last bar stops on degree 4, which leaves the phrase open. Ending on degree 1 closes it.",
      tryCode: 'bass: n("0 ~ 0 4").scale("D2:dorian")',
      skills: ["H02"],
    },
  ],
  listeningQuestion: "In bar 8, does the bass sound finished or does it still lean forward?",
  linerNote:
    "An eight-bar groove in D dorian: a rooted bass under two chords, with a steady hi-hat pulse throughout.",
};

export const TRANSCRIPTION_REVIEW: TranscriptionReview = {
  strengths: [
    { text: "The kick pattern matches the downbeats throughout.", bars: [1, 4], layer: "drums" },
    { text: "The bass follows the chord roots in the first phrase.", bars: [1, 4], layer: "bass" },
  ],
  revisions: [
    {
      title: "Recheck the bass in bar 5",
      bars: [5, 5],
      layer: "bass",
      why: "The bass and the chord disagree here, which usually means one of them is a step off.",
      listenFor: "Loop bar 5 and hum the lowest note against the chord.",
    },
  ],
  plausibilityFlags: [{ bars: [5, 5], issue: "bass and chord disagree in bar 5" }],
  listeningQuestion: "Does the bass in bar 5 move up or down into bar 6?",
  linerNote:
    "A careful transcription of a four-chord song, with drums and bass set down first and the harmony built on top.",
};
