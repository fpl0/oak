// The Make inside the unit song, on screen (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.3, §5.5
// "Make"): the switch "In your song | Today's code", the song strip above the editor (sections as columns sized by
// bars, a thin named row per part, its blocks drawn as on every song grid; a section loops on a click), "Play the whole
// song", and the notes about where the editor started and why a side step stays a sketch of its own. Words follow
// AUTHORING §5 and §22; a section shows its name only once its term is met (`songViewOf`).
import { clsx } from "clsx";
import { Play, Repeat } from "lucide-react";
import type { SongView, SongViewSection } from "../song/model.ts";
import { songPartTones } from "../song/part-tones.ts";
import {
  cellLook,
  estimatedWidth,
  type HeadText,
  headName,
  headTexts,
  headWidth,
  SongLegend,
  sectionTracks,
  useSectionWidths,
} from "../song/SongGrid.tsx";
import { Button } from "../ui/kit/Button.tsx";
import { Callout, SegmentedControl } from "../ui/kit/Controls.tsx";

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
 * loop icon; under it a thin row per part, named on the left, each block drawn as on every song grid (SongGrid's
 * `cellLook` and `SongLegend`): today's (outlined in the accent), yours (the part's colour), Oak's (outlined and
 * hatched) or where Oak rests (dashed, empty). A section header follows the grid's header rule (`headTexts`): its name, the name cut short, or in the narrowest
 * columns its letter. A
 * click on a section loops it; a second click stops the loop.
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
  const tones = songPartTones(view.parts);
  const { grid, heads, widths } = useSectionWidths(view.sections);
  const texts = headTexts(
    view.sections,
    view.sections.map((s, i) => widths?.[i] ?? estimatedWidth(s, span, false)),
    // The strip's type is a step larger than the grid's (14px, and 12px when small).
    (_, i) => ({
      looping: looping?.id === view.sections[i]?.id,
      measure: (text, type) => headWidth(text, type) * (type === "full" ? 14 / 13 : 12 / 11),
    }),
  );
  // The names column is as wide as the longest part name needs at its 10px type, up to 8rem (a longer name is cut,
  // with the full name in its title; the rows are pictures, and the line under the strip says the same in words).
  const longest = Math.max(0, ...view.parts.map((p) => p.name.length));
  const names = `${Math.min(128, Math.ceil(longest * 5.6) + 10)}px`;
  const cols = { gridTemplateColumns: `${names} ${sectionTracks(view.sections)}` };
  return (
    <section
      aria-label={`Your song, “${view.title}”`}
      className="flex min-w-0 flex-col gap-1"
      data-testid="song-strip"
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a labelled group of section buttons. */}
      <div
        ref={grid}
        role="group"
        aria-label="Sections of the song"
        className="grid min-w-0 gap-0.5"
        style={cols}
      >
        <span aria-hidden />
        {view.sections.map((s, i) => {
          const isLoop = looping?.id === s.id;
          const head = texts[i] as HeadText;
          return (
            <button
              key={s.id}
              ref={(el) => {
                heads.current[i] = el;
              }}
              type="button"
              aria-pressed={isLoop}
              aria-label={`${headName(s, head)}, ${barsText(s)}${s.today ? ", your code plays here" : ""}${isLoop ? ", looping" : ""}`}
              title={`${headName(s, head)} · ${barsText(s)}`}
              data-section={s.id}
              data-today={s.today ? "1" : "0"}
              data-looping={isLoop ? "1" : undefined}
              onClick={() => onLoop(isLoop ? null : s)}
              className={clsx(
                "relative flex h-8 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-control border transition-colors duration-200",
                // One size class each: text-sm and text-xs together resolve by stylesheet order, not by intent.
                head.tight
                  ? "px-0 text-xs"
                  : head.form === "cut"
                    ? "px-0.5 text-xs"
                    : head.small
                      ? "px-1 text-xs"
                      : "px-1 text-sm",
                s.today
                  ? "border-accent bg-accent/15 font-medium text-text"
                  : "border-border bg-surface-2 text-text-2",
                isLoop && "shadow-[inset_0_0_0_1px_var(--oak-accent)]",
                "hover:border-text-3",
              )}
              style={{ gridColumn: i + 2 }}
            >
              <span className={clsx("min-w-0", !head.tight && "truncate")}>{head.text}</span>
              {head.icon && <Repeat aria-hidden className="size-3.5 shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
      <div aria-hidden className="flex min-w-0 flex-col gap-0.5">
        {view.parts.map((p) => {
          const tone = tones.get(p.id) as string;
          return (
            <div key={p.id} className="grid min-w-0 items-center gap-x-0.5" style={cols} data-part={p.id}>
              <span
                className="truncate pr-1 text-[0.625rem] leading-[0.75rem] text-text-3"
                title={p.name}
                data-testid="song-strip-part"
              >
                {p.name}
              </span>
              {view.sections.map((s, i) => {
                const c = view.cells.find((x) => x.part === p.id && x.section === s.id);
                const owner = c?.owner ?? "oak";
                const drawn = cellLook(owner, owner === "oak" && c?.rests === true, tone);
                return (
                  <span
                    key={s.id}
                    data-cell={`${p.id}@${s.id}`}
                    data-owner={owner}
                    className={clsx("h-2 min-w-0 rounded-[2px]", drawn.className)}
                    style={{ gridColumn: i + 2, ...drawn.style }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SongLegend view={view} tones={tones} todayWord="Today" />
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
