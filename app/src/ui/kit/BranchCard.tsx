// BranchCard (Wave 6): one branch of the course that is not the core's path — an advanced track (Jazz Harmony,
// Advanced Rhythm, Arrangement & Sound), and later a side branch of any kind — with where it stands and one honest
// line. Three states, each with its own icon and words: `locked` ("Not open yet", with what opens it), `open` (the
// gate is met and nothing can be started yet: "Open", with the server's note, e.g. "Its first lessons are still
// being written."), `ready` (a lesson can be started: the note names it and the card may carry its action). The
// card makes the honest state hard to get wrong: an `action` is drawn ONLY when the state is `ready`, so a track
// with no authored lesson can never look like a way in (docs/design/wave6.md §10 item 14). `fresh` marks a branch
// that opened today (its chip reads "Opened today" in place of "Open"). `layout="row"` lays it flat for a list (Today's "Open to
// you", the palette's result); `card` stands in a grid (Progress, the Coda).
import { clsx } from "clsx";
import { GitBranch, Lock, Sprout } from "lucide-react";
import type { ReactNode } from "react";
import { Chip } from "./basics.tsx";
import { BRANCH_STATE_WORDS, type BranchState, branchNote, branchSummary } from "./model-w6.ts";

export type { BranchState };

export interface BranchCardProps {
  /** "Jazz Harmony". */
  title: string;
  state: BranchState;
  /** The one honest line (the server's `TrackState.note`). */
  note: string;
  /** A small line over the title ("Advanced track"). */
  kicker?: string;
  /** What opens it, shown while locked when the note does not say ("Opens with the unit 13 checkpoint."). */
  opens?: string;
  /** Opened today: say so once. */
  fresh?: boolean;
  /** "3 of 34 sessions" once the branch has sessions to count; never shown for a branch with nothing written. */
  progress?: { done: number; total: number; unit?: string } | null;
  /** The way in (a Link). Drawn only when `state` is `ready`. */
  action?: ReactNode;
  /** A quiet link that is always honest (to the Oak, where the branch is drawn). */
  more?: ReactNode;
  layout?: "card" | "row";
  headingLevel?: 2 | 3 | 4;
  className?: string;
  "data-testid"?: string;
}

const ICON: Record<BranchState, ReactNode> = {
  locked: <Lock aria-hidden className="size-4" strokeWidth={2} />,
  open: <Sprout aria-hidden className="size-4.5" strokeWidth={1.75} />,
  ready: <GitBranch aria-hidden className="size-4.5" strokeWidth={1.75} />,
};

export function BranchCard({
  title,
  state,
  note,
  kicker,
  opens,
  fresh = false,
  progress = null,
  action,
  more,
  layout = "card",
  headingLevel = 3,
  className,
  "data-testid": testId,
}: BranchCardProps) {
  const H = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";
  const row = layout === "row";
  const showProgress = progress !== null && progress.total > 0 && state === "ready";
  return (
    <article
      aria-label={branchSummary(title, state, note)}
      data-testid={testId}
      data-branch-state={state}
      className={clsx(
        "min-w-0 rounded-card border bg-surface",
        state === "locked" ? "border-dashed border-border" : "border-border shadow-card",
        row ? "flex items-center gap-3 px-3 py-2.5" : "flex flex-col gap-2 p-4",
        className,
      )}
    >
      <div className={clsx("flex min-w-0 items-start gap-3", row && "flex-1 items-center")}>
        <span
          className={clsx(
            "flex size-8 shrink-0 items-center justify-center rounded-full border",
            state === "locked"
              ? "border-border bg-surface-2 text-text-3"
              : state === "open"
                ? "border-accent-2/50 bg-accent-2/12 text-text"
                : "border-accent/40 bg-lane-in text-accent",
          )}
        >
          {ICON[state]}
        </span>
        <div className="min-w-0 flex-1">
          {kicker && !row && (
            <p className="text-[0.75rem] font-medium tracking-wide text-text-3 uppercase">{kicker}</p>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <H className={clsx("min-w-0 truncate font-display font-semibold", row ? "text-base" : "text-h3")}>
              {title}
            </H>
            <Chip
              tone={state === "locked" ? "neutral" : state === "open" ? "amber" : "accent"}
              data-testid="branch-state"
            >
              {fresh && state !== "locked" ? "Opened today" : BRANCH_STATE_WORDS[state]}
            </Chip>
          </div>
          <p className={clsx("text-sm text-text-2", !row && "mt-1")} data-testid="branch-note">
            {branchNote(state, note)}
            {state === "locked" && opens && !note.includes(opens) ? ` ${opens}` : ""}
          </p>
          {showProgress && progress && (
            <p className="mt-1 text-sm text-text-3 tabular-nums">
              {progress.done} of {progress.total} {progress.unit ?? "sessions"}
            </p>
          )}
        </div>
      </div>
      {(more || (action && state === "ready")) && (
        <div className={clsx("flex shrink-0 flex-wrap items-center gap-2", !row && "pl-11")}>
          {state === "ready" && action}
          {more}
        </div>
      )}
    </article>
  );
}
