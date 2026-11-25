// Claude's structured review beside the piece (contracts §10.6, ux §6.5): two or three strengths anchored to bars,
// the revision(s) with "Try the revision", one listening question, the liner note. Every bar range is a link: it
// lights those bars on the roll and the staff (and loops them in a Workbench that follows the tutor's bars). The
// header line says the review never affects pass or fail. Oak 2.0 W4 F4: when the learner asked one question, its
// answer comes first ("Your question, answered"); strengths are shown only when there are some (none is a valid
// review). A review stored before W4 (no `answer`) renders exactly as before.
import type { CapstoneReview } from "@oak/api";
import { clsx } from "clsx";
import { Check, FilePlus2 } from "lucide-react";
import { useState } from "react";
import { readDone, writeDone } from "../tutor/review-done.ts";
import { Button } from "../ui/kit/Button.tsx";

export const REVIEW_HEADER = "Claude's comments never affect pass or fail.";
/** Oak 2.0 W4 F4: the heading over the answer to the learner's question. */
export const REVIEW_ANSWER_HEADING = "Your question, answered";

export function barsLabel(b: readonly number[]): string {
  const from = b[0] ?? 1;
  const to = b[1] ?? from;
  return from === to ? `Bar ${from}` : `Bars ${from}–${to}`;
}

export function BarLink({
  bars,
  onBars,
  className,
}: {
  bars: readonly number[];
  onBars?: ((from: number, to: number) => void) | undefined;
  className?: string;
}) {
  const label = barsLabel(bars);
  const from = bars[0] ?? 1;
  const to = bars[1] ?? from;
  if (!onBars)
    return <span className={clsx("font-mono text-[0.75rem] text-text-3", className)}>{label}</span>;
  return (
    <button
      type="button"
      onClick={() => onBars(from, to)}
      className={clsx(
        "inline-flex h-5 shrink-0 items-center rounded-full border border-border bg-surface px-1.5 font-mono text-[0.75rem] text-text hover:border-accent hover:text-accent",
        className,
      )}
      aria-label={`${label}: show on the roll and the staff`}
      data-testid="review-bars"
    >
      {label}
    </button>
  );
}

export function ReviewCard({
  review,
  onBars,
  onTry,
  tryPending = false,
  tryLabel = "Try the revision",
  showLinerNote = true,
  compact = false,
  headingLevel = 2,
  doneId,
  heading,
}: {
  review: CapstoneReview;
  onBars?: (from: number, to: number) => void;
  /** Opens revision `i` in a copy; absent: no button. */
  onTry?: (i: number) => void;
  tryPending?: boolean;
  tryLabel?: string;
  showLinerNote?: boolean;
  compact?: boolean;
  headingLevel?: 2 | 3;
  /**
   * "Mark done" on each revision (ux §6.5, c9): the learner's own ticks, kept in this browser under the same key as
   * the tutor panel's copy of this review (`<conversationId>-<seq>`), so a tick shows in both. Absent: no ticks.
   */
  doneId?: string | undefined;
  /** A line above the review ("Review of version 3"). */
  heading?: string | undefined;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const answer =
    typeof review.answer === "string" && review.answer.trim() !== "" ? review.answer.trim() : null;
  const [done, setDone] = useState<number[]>(() => (doneId ? readDone(doneId) : []));
  const toggle = (i: number) => {
    if (!doneId) return;
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i].sort((a, b) => a - b);
    setDone(next);
    writeDone(doneId, next);
  };
  return (
    <div className={clsx("flex flex-col gap-3 text-sm", compact && "gap-2")} data-testid="review-card">
      {heading && (
        <p className="font-medium text-text" data-testid="review-heading">
          {heading}
        </p>
      )}
      <p className="text-text-3">{REVIEW_HEADER}</p>
      {answer !== null && (
        <div data-testid="review-answer">
          <H className="mb-1 font-sans text-sm font-semibold text-text-2">{REVIEW_ANSWER_HEADING}</H>
          <p className="text-text [overflow-wrap:anywhere]">{answer}</p>
        </div>
      )}
      {review.strengths.length > 0 && (
        <div>
          <H className="mb-1 font-sans text-sm font-semibold text-text-2">What works</H>
          <ul className="flex flex-col gap-1.5" data-testid="review-strengths">
            {review.strengths.map((s) => (
              <li key={s.text} className="flex items-start gap-2">
                <BarLink bars={s.bars} onBars={onBars} className="mt-0.5" />
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <H className="font-sans text-sm font-semibold text-text-2">
          {review.revisions.length === 1 ? "One revision to try" : "Revisions to try"}
        </H>
        {review.revisions.map((v, i) => (
          <div
            key={`${i}-${v.title}`}
            data-revision={i}
            data-done={done.includes(i) || undefined}
            className="rounded-control border border-border bg-surface p-2.5 data-[done]:bg-surface-2"
          >
            <p className="flex flex-wrap items-center gap-2 font-medium">
              <span className="min-w-0 [overflow-wrap:anywhere]">{v.title}</span>
              <BarLink bars={v.bars} onBars={onBars} />
              {doneId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  aria-pressed={done.includes(i)}
                  icon={done.includes(i) ? <Check aria-hidden className="size-3.5" /> : undefined}
                  onClick={() => toggle(i)}
                  data-testid="review-mark-done"
                >
                  {done.includes(i) ? "Done" : "Mark done"}
                </Button>
              )}
            </p>
            <p className="mt-1 text-text-2">{v.why}</p>
            {onTry && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                loading={tryPending}
                icon={<FilePlus2 aria-hidden className="size-4" />}
                onClick={() => onTry(i)}
                data-testid="try-revision"
              >
                {tryLabel}
              </Button>
            )}
          </div>
        ))}
      </div>
      <div>
        <H className="mb-1 font-sans text-sm font-semibold text-text-2">Listen for</H>
        <p className="italic text-text-2">{review.listeningQuestion}</p>
      </div>
      {showLinerNote && (
        <div>
          <H className="mb-1 font-sans text-sm font-semibold text-text-2">Claude's liner note</H>
          <p className="text-text-2">“{review.linerNote}”</p>
        </div>
      )}
    </div>
  );
}
