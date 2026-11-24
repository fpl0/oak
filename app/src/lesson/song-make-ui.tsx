// The Make inside the unit song, on screen (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.3, §5.5
// "Make"): the switch "In your song | Today's code", the song strip above the editor (sections as columns sized by
// bars, a thin row per part: today's cells, yours and Oak's told apart; a section loops on a click), "Play the whole
// song", and the notes about where the editor started and why a side step stays a sketch of its own. Words follow
// AUTHORING §5 and §22; a section shows its name only once its term is met (`songViewOf`).
import { clsx } from "clsx";
import { Play, Repeat } from "lucide-react";
import type { SongView, SongViewSection } from "../song/model.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Callout, SegmentedControl } from "../ui/kit/Controls.tsx";
import { PARTS_PALETTE } from "../ui/theme/palette.ts";

export type SongMode = "song" | "today";

export interface SongLoopNow {
  on: boolean;
  region: { from: number; bars: number };
}

const barsText = (s: Pick<SongViewSection, "startBar" | "bars">) =>
  s.bars === 1 ? `bar ${s.startBar + 1}` : `bars ${s.startBar + 1} to ${s.startBar + s.bars}`;

/** The switch beside the transport: the song with today's code in it, or today's code alone over the lesson's Band. */
export function SongModeSwitch({ mode, onChange }: { mode: SongMode; onChange(mode: SongMode): void }) {
  return (
    <SegmentedControl
      label="What plays"
      size="sm"
      value={mode}
      onChange={onChange}
      options={[
        { value: "song", label: "In your song" },
        { value: "today", label: "Today's code" },
      ]}
    />
  );
}

/**
 * The song strip: one column per section (as wide as its bars), today's sections marked, the looping one with the
 * loop icon; under it a thin row per part, each cell today's (accent), yours (the part's colour) or Oak's (outlined;
 * blank where Oak's part rests). A click on a section loops it; a second click stops the loop.
 */
export function SongStrip({
  view,
  loop,
  onLoop,
}: {
  view: SongView;
  loop: SongLoopNow | null;
  onLoop(section: SongViewSection | null): void;
}) {
  const span = Math.max(1, view.lengthBars);
  const looping = loop?.on
    ? (view.sections.find((s) => s.startBar === loop.region.from && s.bars === loop.region.bars) ?? null)
    : null;
  const todayText = view.sections.filter((s) => s.today).map((s) => s.label);
  const cols = { gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` };
  return (
    <section
      aria-label={`Your song, “${view.title}”`}
      className="flex min-w-0 flex-col gap-1"
      data-testid="song-strip"
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a labelled group of section buttons. */}
      <div role="group" aria-label="Sections of the song" className="grid min-w-0 gap-0.5" style={cols}>
        {view.sections.map((s) => {
          const isLoop = looping?.id === s.id;
          const compact = s.bars / span < 0.08;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={isLoop}
              aria-label={`${s.label}, ${barsText(s)}${s.today ? ", your code plays here" : ""}${isLoop ? ", looping" : ""}`}
              title={`${s.label} · ${barsText(s)}`}
              data-section={s.id}
              data-today={s.today ? "1" : "0"}
              data-looping={isLoop ? "1" : undefined}
              onClick={() => onLoop(isLoop ? null : s)}
              className={clsx(
                "relative flex h-8 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-control border px-1 text-sm transition-colors duration-200",
                s.today
                  ? "border-accent bg-accent/15 font-medium text-text"
                  : "border-border bg-surface-2 text-text-2",
                isLoop && "shadow-[inset_0_0_0_1px_var(--oak-accent)]",
                "hover:border-text-3",
              )}
              style={{ gridColumn: `${s.startBar + 1} / span ${Math.max(1, s.bars)}` }}
            >
              {!compact && <span className="truncate">{s.label}</span>}
              {isLoop && !compact && <Repeat aria-hidden className="size-3.5 shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
      <div aria-hidden className="flex min-w-0 flex-col gap-px">
        {view.parts.map((p, i) => (
          <div key={p.id} className="grid min-w-0 gap-0.5" style={cols} title={p.name}>
            {view.sections.map((s) => {
              const c = view.cells.find((x) => x.part === p.id && x.section === s.id);
              const tone = PARTS_PALETTE[i % PARTS_PALETTE.length];
              return (
                <span
                  key={s.id}
                  data-cell={`${p.id}@${s.id}`}
                  data-owner={c?.owner ?? "oak"}
                  className={clsx(
                    "h-1.5 rounded-[2px]",
                    c?.owner === "today" && "bg-accent",
                    c?.owner === "oak" && !c.rests && "border border-border",
                  )}
                  style={{
                    gridColumn: `${s.startBar + 1} / span ${Math.max(1, s.bars)}`,
                    ...(c?.owner === "yours" ? { background: tone } : {}),
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-3">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="inline-block h-1.5 w-3 rounded-[2px] bg-accent" />
          Today's code
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block h-1.5 w-3 rounded-[2px]"
            style={{ background: PARTS_PALETTE[0] }}
          />
          Yours
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="inline-block h-1.5 w-3 rounded-[2px] border border-border" />
          Oak
        </span>
        <span className="sr-only">
          {todayText.length > 0
            ? `Your code plays in ${todayText.join(", ")}.`
            : "Your code plays in the whole song."}
        </span>
      </p>
    </section>
  );
}

/** The controls beside the strip: the whole song, or back to looping where today's code plays. */
export function SongPlayControls({
  looping,
  hasToday,
  onWhole,
  onToday,
}: {
  looping: boolean;
  hasToday: boolean;
  onWhole(): void;
  onToday(): void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={onWhole} data-testid="song-play-whole" aria-pressed={!looping}>
        <Play aria-hidden className="size-3.5" />
        Play the whole song
      </Button>
      {hasToday ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={onToday}
          data-testid="song-loop-today"
          aria-pressed={looping}
        >
          <Repeat aria-hidden className="size-3.5" />
          Loop where your code plays
        </Button>
      ) : null}
    </div>
  );
}

/** A side step's Make: why it stays a sketch of its own (the content's `reason`). */
export function SideStepNote({ reason }: { reason: string }) {
  return (
    <Callout tone="info" title="Not in your song today" className="text-sm">
      <span data-testid="song-side-note">{reason}</span>
    </Callout>
  );
}
