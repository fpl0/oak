// The frame every step renders into (ux §3.1): the prompt column (kind label, title, the step's prose, the
// exercise prompt, answers, feedback) with its sticky footer (hints, Ask Claude, Check, Continue), and the stage
// beside it (the Workbench or a stimulus). Renderers return `<StepLayout stage answer actions />`; the host
// fills the rest through `StepHostContext`, so the lesson and the checkpoint share every renderer.
import type {
  AttemptResponse,
  Diagnostic,
  Exercise,
  GradeResult,
  HintRung,
  LessonDef,
  ParamValues,
  StepDef,
  StepState,
  Trial,
} from "@oak/api";
import { METERS } from "@oak/theory";
import { clsx } from "clsx";
import { createContext, type ReactNode, use, useEffect, useRef } from "react";
import type { WorkbenchProps } from "../workbench/Workbench.tsx";
import type { GradeEnv } from "./grading.ts";
import { howTo } from "./how-to.ts";
import { STEP_KIND_LABEL } from "./model.ts";
import type { SongStepHost } from "./song-make.ts";

export interface StepHost {
  mode: "lesson" | "checkpoint";
  lesson: LessonDef;
  step: StepDef;
  /** The exercise with the series' params substituted. */
  exercise: Exercise | undefined;
  index: number;
  total: number;
  params: ParamValues;
  seriesNo: number;
  state: StepState | null;
  result: GradeResult | null;
  rung: HintRung;
  passed: boolean;
  checking: boolean;
  /**
   * An earlier step revisited (Looking back) or a step of a completed lesson: it works as practice (docs/design/
   * retry.md §5 row 9); the server stores its attempts as practice.
   */
  review: boolean;
  /**
   * A verdict (a checkpoint's saved answer) is on screen: the answer cannot change until "Try again"
   * (docs/design/retry.md §2.5). Playback and auditions still work; a code editor stays editable.
   */
  locked: boolean;
  /** "Try again" presses on this step in this visit: a take widget starts a new take when it rises. */
  retake: number;
  env: GradeEnv;
  /**
   * Quiet mode (server state, `voice.get`; the profile's flag until that answers) and the learner's singing
   * labels. While quiet, a sing step plays as its fallback (contracts §8.5).
   */
  voice: { quiet: boolean; labels: "numbers" | "syllables" | null };
  /** What every Workbench of this step shares: lesson context, graded lint, views, the Band. */
  workbench: Omit<WorkbenchProps, "id" | "code">;
  /**
   * Unit songs (spec 2026-11-24 §5.3): the Make's place in its unit's song (a take, a side step, or a take whose song
   * is being read); absent for every other step and for a lesson in no song.
   */
  song?: SongStepHost | null;
  /** A live check on a Make (never posted). */
  preview(result: GradeResult | null): void;
  /** Registers the renderer's Check for `Mod+Shift+Enter` (one at a time). */
  setCheck(fn: (() => void) | null): void;
  /** The drill trial a generator stimulus plays in this series. */
  trial: Trial | null;
  /** One trial per part of an `all` step (`null` for parts without a generator stimulus). */
  trials: (Trial | null)[];
  /** The editor's code for this step. */
  code: string | null;
  setCode(code: string): void;
  /**
   * Grades a response in the browser (the machine shows "checking"), or `null` when the grader failed. The
   * renderer then calls `onCheck` with the result.
   */
  grade(response: AttemptResponse, exercise?: Exercise): Promise<GradeResult | null>;
  /**
   * Grades without telling the machine (the Make's live checklist, one stage of a staged dictation, one part of
   * a by-ear transcription): never an attempt. `exercise` grades against a narrowed copy of the step's exercise.
   */
  gradeQuiet(response: AttemptResponse, exercise?: Exercise): Promise<GradeResult | null>;
  /** The Make's "Save sketch" (the lesson completes; a checkpoint records its Make item). */
  save?(code: string, title: string): void;
  /** The step was completed without a graded pass (played, ran, answered). */
  markDone(): void;
  /** Catalog copy for a diagnostic (with the exercise's own overrides). */
  render(d: Diagnostic): string;
  /** The step's prose (MDX) and the host's footer and banners. */
  prose: ReactNode;
  /** The footer: hints, Ask Claude and Continue, with the renderer's own actions placed before Continue. */
  renderFooter(actions: ReactNode): ReactNode;
  banner: ReactNode;
}

export const StepHostContext = createContext<StepHost | null>(null);

export function useStepHostOptional(): StepHost | null {
  return use(StepHostContext);
}

export function useStepHost(): StepHost {
  const h = use(StepHostContext);
  if (!h) throw new Error("a step renderer needs a StepHostContext");
  return h;
}

/** Closing punctuation that follows a code chip. */
const CLOSING_PUNCT = /^[.,;:!?)\]”’]+/u;

/** `**bold**`, `*em*` and `` `code` `` in a one-paragraph prompt (authored Markdown, never HTML). */
export function InlineMd({ text, className }: { text: string; className?: string }) {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    const tok = m[0];
    last = at + tok.length;
    if (tok.startsWith("**")) parts.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) {
      // Punctuation right after a code chip hugs it: the chip's right padding is trimmed and the two never part at
      // a line end, so ".scale()." never reads ".scale() ." (as the Toolbox's `InlineCodeText` does). An opening
      // bracket or quote right before it hugs it the same way: "(rd)", not "( rd)".
      const punct = CLOSING_PUNCT.exec(text.slice(last))?.[0] ?? "";
      const opened = /[([“‘]$/u.test(text.slice(0, at));
      const chip = (
        <code
          key={k++}
          className={clsx(
            "rounded bg-surface-2 py-0.5 font-mono text-[0.9em]",
            opened ? "pl-0.5" : "pl-1",
            punct ? "pr-0.5" : "pr-1",
          )}
        >
          {tok.slice(1, -1)}
        </code>
      );
      if (punct) {
        parts.push(
          <span key={k++} className="whitespace-nowrap">
            {chip}
            {punct}
          </span>,
        );
        last += punct.length;
      } else parts.push(chip);
    } else parts.push(<em key={k++}>{tok.slice(1, -1)}</em>);
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={className}>{parts}</span>;
}

export interface StepLayoutProps {
  /** The Workbench or a stimulus panel; absent for steps that are only an answer. */
  stage?: ReactNode;
  /** Answers and the step's own feedback, in the prompt column. */
  answer?: ReactNode;
  /** The renderer's own buttons (Check, Play), placed before Continue in the footer. */
  actions?: ReactNode;
  /** Hide the exercise prompt (when the renderer shows it itself). */
  hidePrompt?: boolean;
  /** The prompt and the answer above the prose (the Make: the checklist matters more than the recap). */
  answerFirst?: boolean;
}

export function StepLayout({ stage, answer, actions, hidePrompt, answerFirst }: StepLayoutProps) {
  const h = useStepHost();
  const heading = useRef<HTMLHeadingElement>(null);
  const stepKey = `${h.mode}:${h.step.id}`;
  // Focus lands on the step's title after each transition (screen readers announce the new step).
  useEffect(() => {
    if (!stepKey) return;
    const el = heading.current;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [stepKey]);
  const prompt = h.exercise?.prompt;
  const how =
    h.mode === "lesson"
      ? howTo(h.exercise, {
          beatsPerBar: METERS[h.exercise?.meter ?? h.env.meter].unitsPerBar,
          inSong: h.song?.kind === "take",
        })
      : null;
  const kindLabel = h.mode === "checkpoint" ? "Checkpoint" : STEP_KIND_LABEL[h.step.kind];
  const wide = stage !== undefined && stage !== null;
  const prose = h.prose ? <div className="oak-lesson-prose mt-3">{h.prose}</div> : null;
  return (
    <div
      className={clsx(
        "grid h-full min-h-0",
        wide
          ? "grid-cols-[minmax(0,352px)_minmax(0,1fr)] min-[1400px]:grid-cols-[minmax(0,384px)_minmax(0,1fr)]"
          : "grid-cols-1",
      )}
      data-testid="lesson-step"
      data-step={h.step.id}
      data-kind={h.step.kind}
      data-exercise={h.exercise?.kind ?? "none"}
    >
      <section
        aria-labelledby={`${stepKey}-title`}
        data-keyscope="lesson-prompt"
        className={clsx(
          "flex min-h-0 flex-col",
          wide ? "border-r border-border" : "mx-auto w-full max-w-[44rem]",
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-4">
          <p className="text-xs font-medium tracking-wide text-text-3 uppercase">
            {kindLabel} · {h.mode === "checkpoint" ? "item" : "step"} {h.index + 1} of {h.total}
            {/* "checked" read as a status (already checked) before the learner had done anything */}
            {h.step.graded ? " · graded" : ""}
          </p>
          <h2
            id={`${stepKey}-title`}
            ref={heading}
            tabIndex={-1}
            className="mt-1 font-display text-h2 font-semibold outline-none"
            data-testid="step-title"
          >
            {h.step.title}
          </h2>
          {h.banner}
          {answerFirst ? null : prose}
          {prompt && !hidePrompt ? (
            <section
              aria-label="Your task"
              data-testid="step-task"
              className="mt-3 max-w-[60ch] rounded-control border-l-2 border-accent bg-lane-in px-3 py-2"
            >
              {/* The heading runs in, like "How:": on its own row it cost every step a line of height, and a
                  step's own action (U03.L09 S5's Sing) has to stay above the fold at 1280×720. */}
              <p className="leading-relaxed">
                <span className="mr-2 text-xs font-semibold tracking-wide text-text-2 uppercase">
                  Your task
                </span>
                <InlineMd text={prompt} />
              </p>
              {how ? (
                <p className="mt-2 text-sm leading-relaxed text-text-2" data-testid="step-how">
                  <span className="font-medium text-text">How: </span>
                  <InlineMd text={how} />
                </p>
              ) : null}
            </section>
          ) : null}
          {answer ? (
            <div className="mt-4 flex flex-col gap-4" data-answer-area>
              {answer}
            </div>
          ) : null}
          {answerFirst ? prose : null}
        </div>
        <footer className="shrink-0 border-t border-border bg-bg px-5 py-3" data-testid="step-footer">
          {h.renderFooter(actions ?? null)}
        </footer>
      </section>
      {wide ? (
        <section aria-label="Workbench" className="min-h-0 min-w-0 overflow-y-auto p-4">
          {stage}
        </section>
      ) : null}
    </div>
  );
}
