// TrackCard (Wave 7): one advanced track — Jazz Harmony, Advanced Rhythm, Arrangement & Sound — as a real place in
// the course, with where the learner stands in it. Four states, each with its own icon and words (never colour
// alone): `open` (something to start, nothing done yet), `in-progress` (sessions done, the next one named),
// `waiting` (a named gate holds the next thing: "Waits for the unit 14 checkpoint." — never a count of what is
// missing, docs/design/wave7.md §10 item 18) and `complete` (every session done; its lessons stay open to replay).
// `trackCardState(TrackState)` picks the state and `trackCardLine` the line; an `action` is drawn only when there
// is something to start, so a waiting track can never look like a way in. `focus` marks the track the learner chose
// ("Your focus"); nothing marks a track as required. `layout="row"` lays it flat for a list (Today's offers, the
// palette); `card` stands in a grid (Progress, the Oak's course view, the Coda).
import { clsx } from "clsx";
import { CircleCheck, Hourglass, Play, Sprout } from "lucide-react";
import type { ReactNode } from "react";
import { Chip, Progress } from "./basics.tsx";
import {
  TRACK_CARD_WORDS,
  type TrackCardState,
  trackCapstonesText,
  trackCardLine,
  trackCardState,
  trackCardSummary,
  trackProgressText,
} from "./model-w7.ts";

export type { TrackCardState };

type TrackInput = Parameters<typeof trackCardState>[0];

export interface TrackCardProps {
  /** "Jazz Harmony". */
  title: string;
  /** The server's `TrackState` (or the same fields). */
  track: TrackInput;
  /** Overrides the state picked from `track` (a specimen, or a host that knows better). */
  state?: TrackCardState;
  /** Overrides the line picked from `track`. */
  line?: string;
  /** A small line over the title ("Advanced track"). */
  kicker?: string;
  /** The learner chose this track (`TrackState.focus`); defaults to `track.focus`. */
  focus?: boolean;
  /** The way in (a Link to the next session). Drawn only when the state is `open` or `in-progress`. */
  action?: ReactNode;
  /** A quiet link that is always honest (to the Oak's course view, the track's lessons). */
  more?: ReactNode;
  layout?: "card" | "row";
  headingLevel?: 2 | 3 | 4;
  className?: string;
  "data-testid"?: string;
}

const ICON: Record<TrackCardState, ReactNode> = {
  open: <Sprout aria-hidden className="size-4.5" strokeWidth={1.75} />,
  "in-progress": <Play aria-hidden className="size-4" strokeWidth={2} />,
  waiting: <Hourglass aria-hidden className="size-4" strokeWidth={1.75} />,
  complete: <CircleCheck aria-hidden className="size-4.5" strokeWidth={1.75} />,
};

const BADGE: Record<TrackCardState, string> = {
  open: "border-accent/40 bg-lane-in text-accent",
  "in-progress": "border-accent/40 bg-lane-in text-accent",
  waiting: "border-border bg-surface-2 text-text-2",
  complete: "border-accent-2/50 bg-accent-2/12 text-text",
};

export function TrackCard({
  title,
  track,
  state: stateProp,
  line: lineProp,
  kicker,
  focus: focusProp,
  action,
  more,
  layout = "card",
  headingLevel = 3,
  className,
  "data-testid": testId,
}: TrackCardProps) {
  const H = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";
  const row = layout === "row";
  const state = stateProp ?? trackCardState(track);
  const line = lineProp ?? trackCardLine(track);
  const focus = focusProp ?? track.focus === true;
  const progress = trackProgressText(track);
  const capstones = trackCapstonesText(track);
  const startable = state === "open" || state === "in-progress";
  const summary =
    lineProp || stateProp
      ? `${title}: ${TRACK_CARD_WORDS[state].toLowerCase()}${focus ? ", your focus" : ""}. ${line}`
      : trackCardSummary(title, { ...track, focus });
  return (
    <article
      aria-label={summary}
      data-testid={testId}
      data-track-state={state}
      data-track-focus={focus || undefined}
      className={clsx(
        "min-w-0 rounded-card border bg-surface",
        state === "waiting" ? "border-dashed border-border" : "border-border shadow-card",
        focus && state !== "waiting" && "ring-1 ring-accent/35",
        row ? "flex flex-wrap items-center gap-3 px-3 py-2.5" : "flex flex-col gap-2.5 p-4",
        className,
      )}
    >
      <div className={clsx("flex min-w-0 items-start gap-3", row && "flex-1 items-center")}>
        <span
          className={clsx(
            "flex size-8 shrink-0 items-center justify-center rounded-full border",
            BADGE[state],
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
              tone={state === "waiting" ? "neutral" : state === "complete" ? "amber" : "accent"}
              data-testid="track-state"
            >
              {TRACK_CARD_WORDS[state]}
            </Chip>
            {focus && (
              <Chip tone="neutral" data-testid="track-focus">
                Your focus
              </Chip>
            )}
          </div>
          <p className={clsx("text-sm text-text-2", !row && "mt-1")} data-testid="track-line">
            {line}
          </p>
          {!row && (progress || capstones) && (
            <div className="mt-2 flex flex-col gap-1.5">
              {progress && (
                <Progress
                  value={track.sessionsDone}
                  max={track.sessionsTotal}
                  label={`${title}: ${progress}`}
                  tone={state === "complete" ? "amber" : "accent"}
                />
              )}
              <p className="text-sm text-text-3 tabular-nums" data-testid="track-progress">
                {[progress, capstones].filter(Boolean).join(" · ")}
              </p>
            </div>
          )}
          {row && progress && (
            <p className="text-sm text-text-3 tabular-nums" data-testid="track-progress">
              {progress}
            </p>
          )}
        </div>
      </div>
      {((startable && action) || more) && (
        <div className={clsx("flex shrink-0 flex-wrap items-center gap-2", !row && "pl-11")}>
          {startable && action}
          {more}
        </div>
      )}
    </article>
  );
}
