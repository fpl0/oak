// The redaction matrix of contracts §10.5: the single gate between solution-bearing data and
// anything that leaves the server towards a model or the browser. The tool executors and the
// <oak_context> builder both go through these functions.
//
// Rules of this file:
//  - views are built field by field (allow-list). Nothing is ever copied and then trimmed, so a new
//    solution-bearing field cannot leak by default;
//  - a withheld field is ABSENT, not null, so "no `expected` field below its rung" can be tested;
//  - the level comes from server state (`disclosureLevel`). It is never model or browser input.
import { type AnswerForm, answerForms, answerLeaks, maskAnswers } from "./answer-guard.ts";
import type {
  GradeSnapshot,
  LessonSong,
  LessonSource,
  RawIssue,
  Rung,
  StepSource,
  StepState,
} from "./domain.ts";
import type { AnswerPolicy } from "./types.ts";
import { keyPlanLine } from "./vocabulary.ts";

/** First level at which each row of the matrix may be returned. */
export const MIN_LEVEL = {
  hintNudge: 1,
  hintPointer: 2,
  hintPartial: 3,
  hintReveal: 4,
  what: 2,
  knownMistakes: 2,
  concept: 2,
  abTarget: 2,
  /** Fix and expected value: the first issue only at 3, all at 4. */
  fixFirst: 3,
  fixAll: 4,
  variantCode: 4,
  solution: 4,
} as const;

/** Tool results stay small: the counts say how many more there are. */
export const MAX_ISSUES = 12;

/** The column of the matrix to read: the rung, or "4 or passed". */
export function disclosureLevel(state: Pick<StepState, "rung" | "passed"> | null): Rung {
  if (state === null) return 0;
  return state.passed ? 4 : state.rung;
}

export function answerPolicy(
  step: Pick<StepSource, "grading" | "solutions"> | null,
  level: Rung,
): AnswerPolicy {
  // Make steps and compositions have no reference: there is nothing to withhold.
  if (step === null || step.grading !== "graded" || step.solutions.length === 0) return "open";
  return level >= MIN_LEVEL.solution ? "may_reveal" : "socratic";
}

export interface IssueView {
  /** Position in the list. Grader IDs are not used: an NEvent ID spells out the expected pitch. */
  n: number;
  severity: RawIssue["severity"];
  track: string | null;
  bar: number | null;
  beat: number | null;
  code_range: [number, number] | null;
  feedback?: string;
  direction?: string | null;
  what?: string;
  concept?: string | null;
  fix?: string | null;
  expected?: string | null;
  got?: string | null;
}

/**
 * `forms`: the step's answer forms (answer-guard.ts). On a chord, numeral, voice-leading or dictation step the
 * first issue's fix and expected value at rung 3 would name the answer itself: they are withheld (absent) when
 * they do, and catalog sentences mask it.
 */
export function redactIssue(
  issue: RawIssue,
  level: Rung,
  index: number,
  forms: readonly AnswerForm[] = [],
): IssueView {
  const view: IssueView = {
    n: index + 1,
    severity: issue.severity,
    track: issue.where.track,
    bar: issue.where.bar,
    beat: issue.where.beat,
    code_range: issue.where.code ? [issue.where.code.from, issue.where.code.to] : null,
  };
  // A degree answer (a dictation answered on a degree pad) is short digits: any fix or expected value with a digit in it may name one.
  const degreeAnswer = forms.some(
    (f) =>
      f.label.startsWith("answer sequence") &&
      f.tokens.every((t) => /^[b#]?\d$/.test(t)) &&
      level < f.minLevel,
  );
  const names = (t: string | null) =>
    t !== null && (answerLeaks(t, forms, level).length > 0 || (degreeAnswer && /\d/.test(t)));
  if (level >= MIN_LEVEL.what) {
    view.feedback = issue.feedback;
    view.direction = issue.direction;
    view.what = forms.length > 0 ? maskAnswers(issue.what, forms, level) : issue.what;
  }
  if (level >= MIN_LEVEL.concept)
    view.concept =
      issue.concept !== null && forms.length > 0 ? maskAnswers(issue.concept, forms, level) : issue.concept;
  if (level >= MIN_LEVEL.fixAll || (level >= MIN_LEVEL.fixFirst && index === 0)) {
    if (!names(issue.fix) && !names(issue.expected)) {
      view.fix = issue.fix;
      view.expected = issue.expected;
    }
    view.got = issue.got;
  }
  return view;
}

export interface GradeView {
  status: GradeSnapshot["status"];
  score: number;
  dims: Record<string, number>;
  counts: GradeSnapshot["counts"];
  issues: IssueView[];
  /** Issues beyond MAX_ISSUES that were left out. */
  issues_omitted: number;
  warnings: string[];
  /** Whether the tutor may suggest A/B against the target audio. */
  ab_target_allowed: boolean;
  /** The level this view was cut to; higher rungs unlock more. */
  redacted_to_rung: Rung;
}

function sortedRecord(rec: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(rec).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** `toIssueView(result, rung)` of the contracts, for the tutor's reduced grade. */
export function redactGrade(grade: GradeSnapshot, level: Rung, forms: readonly AnswerForm[] = []): GradeView {
  const shown = grade.issues.slice(0, MAX_ISSUES);
  return {
    status: grade.status,
    score: grade.score,
    dims: sortedRecord(grade.dims),
    counts: { missing: grade.counts.missing, extra: grade.counts.extra, wrong: grade.counts.wrong },
    issues: shown.map((issue, i) => redactIssue(issue, level, i, forms)),
    issues_omitted: grade.issues.length - shown.length,
    warnings: [...grade.warnings],
    ab_target_allowed: level >= MIN_LEVEL.abTarget,
    redacted_to_rung: level,
  };
}

/**
 * `compare_haps`: against an exercise the result is cut to the learner's level; against code
 * (two pieces of the learner's or the tutor's own code) there is no secret, so nothing is cut.
 */
export function compareView(
  grade: GradeSnapshot,
  level: Rung,
  targetKind: "exercise" | "code",
  forms: readonly AnswerForm[] = [],
): GradeView {
  return targetKind === "code" ? redactGrade(grade, 4) : redactGrade(grade, level, forms);
}

/** Authored hint texts: nudge at 1, + pointer at 2, + partial at 3, all at 4. */
export function hintsShown(hints: StepSource["hints"], level: Rung): string[] {
  if (hints === null) return [];
  return hints.slice(0, level);
}

export interface LessonContextView {
  lesson: {
    id: string;
    title: string;
    objective: string;
    key: string | null;
    meter: string | null;
    bpm: number | null;
  };
  /** Unit songs (contracts §5.11 rule 19): present only when the lesson is in a song. */
  song?: LessonSong;
  step: {
    id: string;
    kind: string;
    grading: StepSource["grading"];
    /** Wave 4: the step's own key, else the lesson's. */
    key: string | null;
    /**
     * Wave 6: the keys by bar when the step changes key (`"C major from bar 1 · D major from bar 9 (…)"`); `null`
     * for one key, and withheld (`"withheld"`) while naming the new key is the step's answer.
     */
    key_plan: string | null;
    /** Wave 6: the step's own meter when it differs from the lesson's. */
    meter: string | null;
    prompt: string;
    starter_code: string | null;
    constraints: string[];
    rubric: { label: string; required: boolean; met: boolean | null }[] | null;
    rung: Rung;
    passed: boolean;
    attempts: number;
    answer_policy: AnswerPolicy;
    hints_seen: string[];
    known_mistakes: { feedback: string; description: string; code?: string | null }[];
    solution: string | null;
  } | null;
}

/** The step's key plan as one line, or `"withheld"` while it names what the learner is asked to find. */
function keyPlanView(step: StepSource, level: Rung): string | null {
  const line = keyPlanLine(step.keyPlan);
  if (line === null) return null;
  const text = line.replace(/^key_plan: /, "");
  return answerLeaks(text, answerForms(step), level).length > 0 ? "withheld" : text;
}

/** The `get_lesson_context` result. `level` must be `disclosureLevel(state)` for this very step. */
export function lessonContextView(
  lesson: LessonSource,
  step: StepSource | null,
  state: StepState | null,
  level: Rung,
): LessonContextView {
  const view: LessonContextView = {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      objective: lesson.objective,
      key: lesson.key,
      meter: lesson.meter,
      bpm: lesson.bpm,
    },
    step: null,
  };
  if (lesson.song)
    view.song = {
      title: lesson.song.title,
      flavour: lesson.song.flavour,
      yours: [...lesson.song.yours],
      today: lesson.song.today,
    };
  if (step === null) return view;

  // Known mistakes: from level 2 the variant the learner's attempt matched; all of them, with
  // their code, only at level 4.
  const matched = new Set(state?.matchedMistakes ?? []);
  const mistakes: NonNullable<LessonContextView["step"]>["known_mistakes"] = [];
  if (level >= MIN_LEVEL.knownMistakes) {
    for (const m of step.knownMistakes) {
      if (level >= MIN_LEVEL.variantCode) {
        mistakes.push({ feedback: m.feedback, description: m.description, code: m.variantCode });
      } else if (matched.has(m.feedback)) {
        mistakes.push({ feedback: m.feedback, description: m.description });
      }
    }
  }

  view.step = {
    id: step.id,
    kind: step.kind,
    grading: step.grading,
    key: step.key ?? lesson.key,
    key_plan: keyPlanView(step, level),
    meter: step.meter ?? lesson.meter,
    prompt: step.prompt,
    starter_code: step.starterCode,
    constraints: [...step.constraints],
    rubric:
      step.rubric?.map((r, i) => ({
        label: r.label,
        required: r.required,
        met: state?.rubricMet?.[i] ?? null,
      })) ?? null,
    rung: state?.rung ?? 0,
    passed: state?.passed ?? false,
    attempts: state?.attempts ?? 0,
    answer_policy: answerPolicy(step, level),
    hints_seen: hintsShown(step.hints, level),
    known_mistakes: mistakes,
    solution: level >= MIN_LEVEL.solution ? (step.solutions[0] ?? null) : null,
  };
  return view;
}

export {
  decodeNested,
  findLeaks,
  forbiddenKeys,
  type LeakMarker,
  leakMarkers,
  miniNotationLiterals,
  normalizeWs,
} from "./leak-markers.ts";
