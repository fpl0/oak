// The retry policy on the client (docs/design/retry.md): one label, one key, one line, and what a retry counts for
// on each kind of surface. The server decides it for lesson steps (`StepState.practiceNext`, `attempt.practice`)
// and keeps the first answer of a drill trial whatever is re-posted; these rules let every surface say the same
// thing before the take, and let the drill, checkpoint and set-up surfaces (which decide on the client) decide it
// the same way. Pure: unit-tested in retry.test.ts.

/** The one label of the control (docs/design/retry.md §2). Never "Retry", "Check again", "Sing it again". */
export const RETRY_LABEL = "Try again";
/** The one key, in the keymap's syntax: free in every scope (contracts §11.9 and the shortcut sheet). */
export const RETRY_KEYS = "Alt+R";
/** The primary action beside it. A checkpoint item says "Next item"; a drill's last trial "Finish the set". */
export const CONTINUE_LABEL = "Continue";

/** The line shown with the control when the next take cannot change what was recorded. */
export const PRACTICE_LINE = "Practice: this try does not change your result.";
/** After a reveal, before the step has passed (contracts §5.3: rung 4 multiplies the score by 0). */
export const REVEALED_LINE = "Answer shown: a pass now finishes the step but does not count as known.";
/** A checkpoint item before hand-in: answers are saved, never judged on screen (contracts §7.6). */
export const CHECKPOINT_LINE = "Your last saved answer is the one that counts.";
/** A set-up measurement (headphones, quiet room, range, timing): a new one replaces the old only if it succeeds. */
export const MEASURE_LINE = "A new measurement replaces this one only if it works.";

/** Kinds of surface that judge something (docs/design/retry.md §5 lists every one). */
export type RetrySurface =
  | "lesson-step"
  | "predict"
  | "drill-trial"
  | "sung-resolution"
  | "fact-card"
  | "checkpoint-item"
  | "measurement"
  | "first-sing"
  | "capstone-check"
  | "ladder-item";

/** What the next take counts for: as the contracts' normal next attempt, as practice, or replacing the last. */
export type RetryCount = "counts" | "practice" | "replaces";

export interface RetryContext {
  surface: RetrySurface;
  /**
   * A result that counts already exists for this exercise: a lesson step's `StepState.practiceNext` (passed, or a
   * completed lesson, or a predict answered), a drill trial or fact card answered once, a sung resolution sung
   * once, a first sing that passed, a capstone version or ladder stage already checked.
   */
  counted: boolean;
  /** The answer was shown (hint rung 4) and the step has not passed yet. */
  revealed?: boolean;
}

/** What the next take counts for (docs/design/retry.md §3). */
export function retryCount(c: RetryContext): RetryCount {
  switch (c.surface) {
    case "checkpoint-item":
      // Before hand-in the last saved answer is the item's answer; no verdict is ever shown, so it cannot be
      // repeated "until right". After hand-in the retake is a new attempt with new items (§7.6, §9.6).
      return "replaces";
    case "measurement":
      return "replaces";
    default:
      return c.counted ? "practice" : "counts";
  }
}

/** The one line shown under the result actions, or null when the next take counts as usual. */
export function retryLine(c: RetryContext): string | null {
  if (c.surface === "checkpoint-item") return CHECKPOINT_LINE;
  if (c.surface === "measurement") return c.counted ? MEASURE_LINE : null;
  if (c.counted) return PRACTICE_LINE;
  if (c.revealed === true && (c.surface === "lesson-step" || c.surface === "ladder-item"))
    return REVEALED_LINE;
  return null;
}

/** Where the focus goes when a result appears (docs/design/retry.md §2.4). */
export type ResultFocus = "continue" | "retry" | "stay";

export function resultFocusTarget(s: {
  continueEnabled: boolean;
  retryEnabled: boolean;
  /** Focus is in the code editor or a text field: the learner fixes the answer there, so it stays. */
  inEditor: boolean;
}): ResultFocus {
  if (s.inEditor) return "stay";
  if (s.continueEnabled) return "continue";
  if (s.retryEnabled) return "retry";
  return "stay";
}
