// The song's arrangement (spec 2026-11-24 §5.5): sections as columns as wide as their bars, parts as rows. The
// learner's cells are inked in their part's colour, Oak's are pencilled in (an outline with a faint hatch; blank where
// Oak's part rests), today's are outlined in the accent. A playhead moves across while the song plays, and the
// section under it brightens. Every surface draws the same grid: in small on the lesson card, at full size on Today,
// the Coda and the song page, where a section header loops that section and each row carries its mute and solo.
// Names come from `songViewOf` (a section is a letter until its term is met). Colour is never the only cue: the
// legend says which is which, and a summary line gives screen readers the same facts.
import { clsx } from "clsx";
import { Repeat } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { PARTS_PALETTE } from "../ui/theme/palette.ts";
import type { SongView, SongViewCell, SongViewPart, SongViewSection } from "./model.ts";
import { subscribeFrames, useSongPlayState } from "./player.ts";
import { andList } from "./surfaces-model.ts";
import "./song.css";

export interface SongGridProps {
  view: SongView;
  /** A fixed playhead (0-based bar), when no player drives it. */
  playheadBar?: number | null;
  /** The song player's ids this grid follows (its playhead moves while one of them plays). */
  follows?: string | ((id: string) => boolean);
  /** Thin rows, letters for sections, no row names (the lesson card, a style preview). */
  compact?: boolean;
  /** The section looping now. */
  loopSection?: string | null;
  /** A click on a section header loops it (again: stops). Without it the headers only label. */
  onLoop?(section: SongViewSection | null): void;
  /** Controls at the end of each row's name (the song page's mute and solo). */
  rowControls?(part: SongViewPart): ReactNode;
  /** Cells that fill in now (the Coda's new take), as `part@section`. */
  fresh?: ReadonlySet<string>;
  /** Bars are a term the learner has met: show the bar numbers. */
  showBars?: boolean;
  /** The words of the today cells in the legend ("Today", "Today's code"). */
  todayWord?: string;
  /** Hide the legend (a style preview, where every cell is Oak's). */
  legend?: boolean;
  /** Draw Oak's cells in a light wash of their part's colour (the New song moment: Oak plays all of it). */
  tintOak?: boolean;
  className?: string;
  "data-testid"?: string;
}

const matches = (f: string | ((id: string) => boolean), id: string) =>
  typeof f === "function" ? f(id) : f === id;
const partTone = (i: number) => PARTS_PALETTE[i % PARTS_PALETTE.length] as string;
const span = (s: Pick<SongViewSection, "startBar" | "bars">, offset: number) =>
  `${s.startBar + offset} / span ${Math.max(1, s.bars)}`;

/** The plain-words summary of the grid, for screen readers. */
export function gridSummary(view: SongView, todayWord = "Today"): string {
  const say = (owner: SongViewCell["owner"]) => {
    const out: string[] = [];
    for (const p of view.parts) {
      const where = view.sections
        .filter((s) => view.cells.some((c) => c.part === p.id && c.section === s.id && c.owner === owner))
        .map((s) => s.label);
      if (where.length > 0) out.push(`${p.name} in ${andList([...new Set(where)])}`);
    }
    return out;
  };
  const yours = say("yours");
  const today = say("today");
  const parts = [
    yours.length > 0 ? `Yours: ${yours.join("; ")}.` : "Oak plays every part.",
    today.length > 0 ? `${todayWord}: ${today.join("; ")}.` : "",
    yours.length > 0 || today.length > 0 ? "Oak plays the rest." : "",
  ];
  return parts.filter(Boolean).join(" ");
}

export function SongGrid({
  view,
  playheadBar = null,
  follows,
  compact = false,
  loopSection = null,
  onLoop,
  rowControls,
  fresh,
  showBars = false,
  todayWord = "Today",
  legend = true,
  tintOak = false,
  className,
  "data-testid": testId = "song-grid",
}: SongGridProps) {
  const total = Math.max(1, view.lengthBars);
  // Column 1 holds the row names (not in compact); bars start at column 2.
  const offset = compact ? 1 : 2;
  const cols: CSSProperties = {
    gridTemplateColumns: compact
      ? `repeat(${total}, minmax(0, 1fr))`
      : `minmax(4.5rem, 7.5rem) repeat(${total}, minmax(0, 1fr))`,
  };
  const cellOf = (part: string, section: string) =>
    view.cells.find((c) => c.part === part && c.section === section);
  const freshOrder = new Map([...(fresh ?? [])].map((k, i) => [k, i]));
  const hasToday = view.cells.some((c) => c.owner === "today");
  const hasYours = view.cells.some((c) => c.owner === "yours");
  // The section under the playhead: the fixed bar, else the bar of the followed song (one re-render per bar).
  const played = useSongPlayState();
  const followed =
    follows !== undefined && played.id !== null && played.phase === "playing" && matches(follows, played.id)
      ? played.bar
      : null;
  const now = playheadBar ?? followed;
  const playingSection =
    now === null
      ? null
      : (view.sections.find((s) => now >= s.startBar && now < s.startBar + s.bars)?.id ?? null);

  return (
    <figure className={clsx("m-0 flex min-w-0 flex-col gap-1.5", className)} data-testid={testId}>
      <div
        className={clsx("relative grid min-w-0", compact ? "gap-x-px gap-y-[3px]" : "gap-x-0.5 gap-y-1")}
        style={cols}
      >
        {/* the section headers */}
        {!compact && <span aria-hidden className="row-start-1" />}
        {view.sections.map((s) => {
          const looping = loopSection === s.id;
          const narrow = s.bars / total < (compact ? 0.06 : 0.07);
          const text = compact || narrow ? s.letter : s.label;
          const head = (
            <>
              <span className={clsx("min-w-0 truncate", narrow && "sr-only")}>{text}</span>
              {showBars && !compact && !narrow && (
                <span aria-hidden className="shrink-0 text-[0.6875rem] font-normal text-text-3 tabular-nums">
                  {s.startBar + 1}
                </span>
              )}
              {looping && !narrow && (
                <Repeat aria-hidden className="size-3 shrink-0 text-accent" strokeWidth={2.25} />
              )}
            </>
          );
          const common = {
            "data-section": s.id,
            "data-bars": s.bars,
            "data-today": s.today ? "1" : "0",
            "data-playing": playingSection === s.id ? "1" : "0",
            title: `${s.label}${showBars ? `, ${barsWords(s)}` : ""}`,
            style: { gridColumn: span(s, offset), gridRow: 1 },
          } as const;
          const look = clsx(
            "relative flex min-w-0 items-center gap-1 overflow-hidden text-left",
            compact
              ? "h-4 justify-center rounded-[3px] px-0.5 text-[0.625rem] font-semibold text-text-3"
              : "h-7 rounded-control px-1.5 text-[0.8125rem] font-medium text-text-2",
            !compact && (s.today ? "bg-accent/10 text-text" : "bg-surface-2"),
            looping && "shadow-[inset_0_0_0_1.5px_var(--oak-accent)] text-text",
          );
          return onLoop ? (
            <button
              key={s.id}
              type="button"
              {...common}
              aria-pressed={looping}
              aria-label={`${looping ? "Stop looping" : "Loop"} ${s.label}${showBars ? `, ${barsWords(s)}` : ""}`}
              onClick={() => onLoop(looping ? null : s)}
              className={clsx(look, "transition-colors duration-150 hover:bg-text/[0.08]")}
            >
              {head}
            </button>
          ) : (
            <span key={s.id} {...common} className={look}>
              {head}
            </span>
          );
        })}

        {/* one row per part */}
        {view.parts.map((p, row) => {
          const tone = partTone(row);
          return (
            <div key={p.id} className="contents" data-part={p.id}>
              {!compact && (
                <div
                  className="flex min-w-0 items-center gap-1.5 pr-2"
                  style={{ gridColumn: 1, gridRow: row + 2 }}
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: tone }} />
                  <span
                    className="min-w-0 flex-1 truncate text-[0.8125rem] text-text-2"
                    data-testid="song-part-name"
                  >
                    {p.name}
                  </span>
                  {rowControls?.(p)}
                </div>
              )}
              {view.sections.map((s) => {
                const c = cellOf(p.id, s.id);
                const owner = c?.owner ?? "oak";
                const key = `${p.id}@${s.id}`;
                const order = freshOrder.get(key);
                const rests = owner === "oak" && c?.rests === true;
                return (
                  <span
                    key={s.id}
                    aria-hidden
                    data-cell={key}
                    data-owner={owner}
                    data-rests={rests ? "1" : undefined}
                    data-playing={playingSection === s.id ? "1" : "0"}
                    className={clsx(
                      "oak-song-cell relative min-w-0",
                      compact ? "h-1.5 rounded-[2px]" : "h-[1.125rem] rounded-[4px]",
                      owner === "yours" && "oak-song-yours",
                      owner === "today" && "oak-song-today",
                      owner === "oak" && !rests && !tintOak && "oak-song-oak border border-border",
                      owner === "oak" && rests && "border border-dashed border-border/50",
                      order !== undefined && "oak-song-fresh",
                    )}
                    style={{
                      gridColumn: span(s, offset),
                      gridRow: row + 2,
                      ...(owner === "yours" ? { background: tone } : {}),
                      ...(owner === "oak" && !rests && tintOak
                        ? { background: `color-mix(in oklab, ${tone} 42%, transparent)` }
                        : {}),
                      ...(order !== undefined ? ({ "--i": order } as CSSProperties) : {}),
                    }}
                  />
                );
              })}
            </div>
          );
        })}

        <Playhead
          total={total}
          bar={playheadBar}
          follows={follows}
          style={{ gridColumn: `${offset} / -1`, gridRow: `1 / ${view.parts.length + 2}` }}
        />
      </div>
      <figcaption className={clsx(!legend && "sr-only")}>
        {legend && (
          <span
            aria-hidden
            className={clsx(
              "flex flex-wrap items-center gap-x-3 gap-y-1 text-text-3",
              compact ? "text-[0.6875rem]" : "text-xs",
            )}
          >
            {hasToday && (
              <span className="inline-flex items-center gap-1">
                <span className="oak-song-today inline-block h-2 w-3.5 rounded-[2px]" />
                {todayWord}
              </span>
            )}
            {hasYours && (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-3.5 rounded-[2px]" style={{ background: partTone(0) }} />
                Yours
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="oak-song-oak inline-block h-2 w-3.5 rounded-[2px] border border-border" />
              Oak
            </span>
          </span>
        )}
        <span className="sr-only" data-testid="song-grid-summary">
          {gridSummary(view, todayWord)}
        </span>
      </figcaption>
    </figure>
  );
}

function barsWords(s: Pick<SongViewSection, "startBar" | "bars">): string {
  return s.bars === 1 ? `bar ${s.startBar + 1}` : `bars ${s.startBar + 1} to ${s.startBar + s.bars}`;
}

/**
 * The playhead over the bars: placed by script each frame from the song player (never a React render per frame), or
 * at a fixed bar. Under reduced motion it steps from bar to bar.
 */
function Playhead({
  total,
  bar,
  follows,
  style,
}: {
  total: number;
  bar: number | null;
  follows?: string | ((id: string) => boolean) | undefined;
  style: CSSProperties;
}) {
  const line = useRef<HTMLSpanElement>(null);
  const follow = useRef(follows);
  follow.current = follows;
  useEffect(() => {
    if (follows === undefined) return;
    return subscribeFrames((id, position) => {
      const el = line.current;
      if (!el) return;
      const f = follow.current;
      const mine = id !== null && f !== undefined && matches(f, id);
      if (!mine || position === null) {
        el.style.opacity = "0";
        return;
      }
      const reduced = document.documentElement.dataset.motion === "reduced";
      const at = reduced ? Math.floor(position) + 0.5 : position;
      el.style.opacity = "1";
      el.style.left = `${(Math.min(total, Math.max(0, at)) / total) * 100}%`;
    });
  }, [follows === undefined, total]);
  const fixed = bar !== null && bar >= 0 && bar < total;
  return (
    <div aria-hidden className="pointer-events-none relative" style={style}>
      <span
        ref={line}
        data-testid="song-playhead"
        className="oak-song-playhead absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded-full"
        style={{
          opacity: fixed ? 1 : 0,
          left: fixed ? `${((bar + 0.5) / total) * 100}%` : "0%",
        }}
      />
    </div>
  );
}
