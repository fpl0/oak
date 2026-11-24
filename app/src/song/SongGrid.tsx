// The song's arrangement (spec 2026-11-24 §5.5): sections as columns as wide as their bars, parts as rows. A block
// (a part in a section) is in one of four states, drawn the same on every grid, here and on the Make strip
// (app/src/lesson/song-make-ui.tsx, which shares `cellLook`, `SongLegend` and the header rule): "Today" (outlined in
// the accent), "Yours" (filled in the part's colour), "Oak" (an outline with a faint hatch) and "Oak rests" (a dashed
// outline, empty: nothing sounds there). A playhead moves across while the song plays, and the section under it
// brightens. Every surface draws the same grid: in small on the lesson card, at full size on Today, the Coda and the
// song page, where a section header loops that section and each row carries its mute and solo.
// Names come from `songViewOf` (a section is a letter until its term is met). Colour is never the only cue: the
// legend says which is which, and a summary line gives screen readers the same facts.
import { clsx } from "clsx";
import { Repeat } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { SongCellOwner, SongView, SongViewCell, SongViewPart, SongViewSection } from "./model.ts";
import { songPartTones } from "./part-tones.ts";
import { subscribeFrames, useSongPlayState } from "./player.ts";
import { whereWords } from "./surfaces-model.ts";
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
  /** Parts that do not sound now (muted, or not the soloed one): their rows are drawn faded and struck through. */
  silent?(part: SongViewPart): boolean;
  /** Cells that fill in now (the Coda's new take), as `part@section`. */
  fresh?: ReadonlySet<string>;
  /** Bars are a term the learner has met: show the bar numbers. */
  showBars?: boolean;
  /** The words of the today cells in the legend ("Today"). */
  todayWord?: string;
  /** Hide the legend (a style preview, where every cell is Oak's). */
  legend?: boolean;
  /** Draw Oak's cells in a light wash of their part's colour (the New song moment: Oak plays all of it). */
  tintOak?: boolean;
  /**
   * Today's blocks are saved (the "Your song grew" card): drawn filled in the part's colour with the accent outline,
   * since they are yours and today's, and the legend's Today swatch is drawn the same way.
   */
  todaySaved?: boolean;
  /** Keep room in the legend for every entry this view has too, so swapping views never moves what is below. */
  legendReserve?: SongView;
  className?: string;
  "data-testid"?: string;
}

const matches = (f: string | ((id: string) => boolean), id: string) =>
  typeof f === "function" ? f(id) : f === id;

/**
 * The narrowest a section's column gets, in px: a one-bar section in a long song would otherwise be a sliver a few
 * px wide, too thin to see today's block in it or to read its letter.
 */
export const MIN_SECTION_PX = 14;

/** The grid's section tracks: one per section, as wide as its bars, never under MIN_SECTION_PX. */
export function sectionTracks(sections: readonly Pick<SongViewSection, "bars">[]): string {
  return sections.map((s) => `minmax(${MIN_SECTION_PX}px, ${Math.max(1, s.bars)}fr)`).join(" ");
}

/** What a section header shows in a column `width` px wide. */
export interface HeadText {
  text: string;
  /**
   * What the text is: the whole label, the start of the name cut short ("Bri…", its full name in the title and the
   * accessible name), or the section's letter (only in the narrowest columns).
   */
  form: "label" | "cut" | "letter";
  /** The text is not the label: it stands for a name ("Bri…" or "C" for "Bridge"). */
  letterForName: boolean;
  /** Set in the header's smaller type (a name that fits only at that size, a cut name, a letter with no padding). */
  small: boolean;
  /** Room for the start bar after the text (only after a whole label, so "A 5" never reads as one name). */
  bars: boolean;
  /** Room for the loop icon after the text. */
  icon: boolean;
  /** Too narrow for padding: the text sits centred with none. */
  tight: boolean;
}

export interface HeadOpts {
  compact?: boolean;
  showBars?: boolean;
  looping?: boolean;
  /**
   * The fewest characters of the name a cut form keeps, so it tells this section from every other one of its grid
   * (`headTexts` works it out; at least 3).
   */
  minCut?: number;
  /** How wide a text is in a header type (default: measured in the page's font, else estimated). */
  measure?(text: string, type: "full" | "small" | "cut" | "compact"): number;
}

// A header's type: 13px medium (compact: 10px semibold); a name that fits only smaller, or is cut, is set at 11px
// with less padding. Widths are measured in the page's own font where there is a canvas (`measureHead`), else
// estimated from the size (a DOM simulator): a little over the real width, so we cut a name, never the browser.
const TYPE = {
  full: { px: 13, weight: 500, pad: 12 },
  small: { px: 11, weight: 500, pad: 8 },
  cut: { px: 11, weight: 500, pad: 4 },
  compact: { px: 10, weight: 600, pad: 4 },
} as const;
type HeadType = keyof typeof TYPE;
const ICON_PX = 16;
/** A cut name keeps at least this many characters ("Int…"); fewer reads as a letter, not as the name. */
export const MIN_CUT = 3;

let canvas: CanvasRenderingContext2D | null | undefined;
let uiFont = "";
/** `text`'s width in px at a header type, in the page's UI font; `null` where nothing can measure (no canvas). */
export function measureHead(text: string, type: HeadType): number | null {
  if (canvas === undefined) {
    try {
      const ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
      canvas = ctx && typeof ctx.measureText === "function" ? ctx : null;
      uiFont = getComputedStyle(document.documentElement).getPropertyValue("--oak-font-ui").trim();
    } catch {
      canvas = null;
    }
  }
  if (!canvas || !uiFont) return null;
  const t = TYPE[type];
  canvas.font = `${t.weight} ${t.px}px ${uiFont}`;
  const w = canvas.measureText(text).width;
  return Number.isFinite(w) && w > 0 ? w : null;
}

/** `text`'s width in px at a header type: measured, else estimated (about 0.58em a character, 0.78em the ellipsis). */
export function headWidth(text: string, type: HeadType): number {
  return (
    measureHead(text, type) ?? [...text].reduce((w, ch) => w + (ch === "…" ? 0.78 : 0.58), 0) * TYPE[type].px
  );
}

/**
 * The header rule every song grid follows, for one section: its label when the column has room for it (in the
 * smaller type if only that fits); else, for a name, the start of the name cut short with an ellipsis when about three
 * characters fit; else, in the narrowest columns, its letter. Never nothing. The start bar and the loop icon come after
 * a whole label only when there is room for them too; they stay in the title and the accessible name. A grid uses
 * `headTexts`, which also keeps two different sections from showing the same text.
 */
export function headText(
  s: Pick<SongViewSection, "label" | "letter" | "startBar">,
  width: number,
  opts: HeadOpts = {},
): HeadText {
  const measure = opts.measure ?? headWidth;
  const full: HeadType = opts.compact ? "compact" : "full";
  const small: HeadType = opts.compact ? "compact" : "small";
  const cut: HeadType = opts.compact ? "compact" : "cut";
  const named = s.label !== s.letter;
  const extras = (textW: number, whole: boolean) => {
    const icon = !opts.compact && opts.looping === true && width >= textW + ICON_PX;
    // The bar number sits after a hairline (5px with its gap), so it never reads as part of the name.
    const bars =
      whole &&
      !opts.compact &&
      opts.showBars === true &&
      width >= textW + (icon ? ICON_PX : 0) + 5 + String(s.startBar + 1).length * 7 + 4;
    return { icon, bars };
  };
  const fullW = measure(s.label, full) + TYPE[full].pad;
  if (width >= fullW)
    return {
      text: s.label,
      form: "label",
      letterForName: false,
      small: false,
      tight: false,
      ...extras(fullW, true),
    };
  const smallW = measure(s.label, small) + TYPE[small].pad;
  if (!opts.compact && width >= smallW)
    return {
      text: s.label,
      form: "label",
      letterForName: false,
      small: true,
      tight: false,
      ...extras(smallW, true),
    };
  if (named) {
    const least = Math.max(MIN_CUT, opts.minCut ?? 0);
    for (let keep = s.label.length - 1; keep >= least; keep--) {
      const text = `${s.label.slice(0, keep).trimEnd()}…`;
      const cutW = measure(text, cut) + TYPE[cut].pad;
      if (width >= cutW)
        return { text, form: "cut", letterForName: true, small: true, tight: false, ...extras(cutW, false) };
    }
  }
  const tight = width < (opts.compact ? 18 : 28);
  return {
    text: s.letter,
    form: "letter",
    letterForName: named,
    small: tight,
    tight,
    ...extras(measure(s.letter, full) + (tight ? 0 : TYPE[full].pad), !named),
  };
}

/**
 * The fewest characters that tell a name from every other name of its grid ("Bre" for Break beside Bridge), at least
 * MIN_CUT: a cut form never shows the same text for two different sections.
 */
function minCutOf(label: string, labels: readonly string[]): number {
  const others = labels.filter((l) => l !== label);
  for (let k = MIN_CUT; k < label.length; k++) {
    const head = label.slice(0, k);
    if (!others.some((o) => o.startsWith(head))) return k;
  }
  return label.length;
}

/**
 * Every header of one grid (`headText` per section, `widths` their columns), so that two different sections never show
 * the same text: a letter that is another section's label or text (Intro's "A" beside the jazz "A" section) gives way
 * to the start of its own name ("I", then "In"). A repeated section (the same label) may show the same text.
 */
export function headTexts(
  sections: readonly Pick<SongViewSection, "label" | "letter" | "startBar">[],
  widths: readonly number[],
  opts: (s: Pick<SongViewSection, "label">, i: number) => HeadOpts = () => ({}),
): HeadText[] {
  const labels = [...new Set(sections.map((s) => s.label))];
  const heads = sections.map((s, i) =>
    headText(s, widths[i] ?? 0, { ...opts(s, i), minCut: minCutOf(s.label, labels) }),
  );
  const clashes = (text: string, label: string, skip: number) =>
    sections.some((o, j) => j !== skip && o.label !== label && (o.label === text || heads[j]?.text === text));
  sections.forEach((s, i) => {
    const head = heads[i];
    if (head?.form !== "letter" || !head.letterForName || !clashes(head.text, s.label, i)) return;
    for (let k = 1; k <= s.label.length; k++) {
      const text = s.label.slice(0, k);
      if (!clashes(text, s.label, i)) {
        heads[i] = { ...head, text };
        return;
      }
    }
  });
  return heads;
}

/** The section as a header names it to a screen reader: its name, and the letter it shows when that differs. */
export function headName(s: Pick<SongViewSection, "label" | "letter">, head: HeadText): string {
  return head.form === "letter" && head.letterForName ? `${s.label} (${head.text})` : s.label;
}

/**
 * The px width of each section header, measured after layout and again whenever the grid is resized; null until it
 * has been laid out (a DOM simulator never is). The tracks have a fixed minimum, so what a header shows never changes
 * its width and the measuring cannot loop.
 */
export function useSectionWidths(sections: readonly Pick<SongViewSection, "bars">[]): {
  grid: RefObject<HTMLDivElement | null>;
  heads: RefObject<(HTMLElement | null)[]>;
  widths: readonly number[] | null;
} {
  const grid = useRef<HTMLDivElement | null>(null);
  const heads = useRef<(HTMLElement | null)[]>([]);
  const [widths, setWidths] = useState<readonly number[] | null>(null);
  const shape = sections.map((s) => s.bars).join(",");
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const count = shape.split(",").length;
    const read = () => {
      const next = heads.current.slice(0, count).map((h) => h?.offsetWidth ?? 0);
      if (next.length !== count || next.every((w) => w === 0)) return;
      setWidths((prev) =>
        prev && prev.length === count && prev.every((w, i) => w === next[i]) ? prev : next,
      );
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shape]);
  return { grid, heads, widths };
}

/** A section's width before the grid is measured: its share of a typical grid. */
export const estimatedWidth = (s: Pick<SongViewSection, "bars">, total: number, compact: boolean) =>
  (Math.max(1, s.bars) / total) * (compact ? 320 : 640);

/** How a block is drawn for its state: the class and the style every song grid gives it. */
export function cellLook(
  owner: SongCellOwner,
  rests: boolean,
  tone: string,
  tintOak = false,
  todaySaved = false,
): { className: string; style: CSSProperties } {
  if (owner === "yours") return { className: "oak-song-yours", style: { background: tone } };
  if (owner === "today")
    return todaySaved
      ? { className: "oak-song-yours oak-song-today-saved", style: { background: tone } }
      : { className: "oak-song-today", style: {} };
  if (rests) return { className: "oak-song-rest", style: {} };
  // The New song's wash goes under the hatch, so a tinted Oak block never looks like a filled one of yours.
  return {
    className: "oak-song-oak",
    style: tintOak ? { backgroundColor: `color-mix(in oklab, ${tone} 42%, transparent)` } : {},
  };
}

/** The plain-words summary of the grid, for screen readers. */
export function gridSummary(view: SongView, todayWord = "Today"): string {
  const say = (owner: SongViewCell["owner"]) => {
    const out: string[] = [];
    for (const p of view.parts) {
      // The sections said as every song sentence says them (`whereWords`): "in B" alone reads as the key of B.
      const where = view.sections.filter((s) =>
        view.cells.some((c) => c.part === p.id && c.section === s.id && c.owner === owner),
      );
      if (where.length > 0) out.push(`${p.name} in ${whereWords(view, where)}`);
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

/**
 * The legend of the four block states, each shown when the grid has one. The "Yours" swatch is striped in the colours
 * of the parts that are yours (up to three), since yours are drawn in each part's own colour, not one.
 */
export function SongLegend({
  view,
  tones,
  todayWord = "Today",
  compact = false,
  todaySaved = false,
  reserve,
  className,
}: {
  view: SongView;
  tones: ReadonlyMap<string, string>;
  todayWord?: string;
  compact?: boolean;
  /** Today's blocks are saved: its swatch is filled, in the colours of today's parts, with the accent outline. */
  todaySaved?: boolean;
  /** Another view the grid swaps to: its entries keep their room here (drawn invisible) so nothing moves. */
  reserve?: SongView | undefined;
  className?: string;
}) {
  const stripeOf = (v: SongView | undefined, owner: SongCellOwner) => {
    const list = [
      ...new Set((v?.cells ?? []).filter((c) => c.owner === owner).map((c) => tones.get(c.part) ?? "")),
    ]
      .filter(Boolean)
      .slice(0, 3);
    return list.length <= 1
      ? list[0]
      : `linear-gradient(90deg, ${list
          .map((t, i, a) => `${t} ${(i / a.length) * 100}% ${((i + 1) / a.length) * 100}%`)
          .join(", ")})`;
  };
  // Shown: the view has it. Kept: only `reserve` has it, so the entry holds its room but is not seen.
  const state = (f: (c: SongViewCell) => boolean): "shown" | "kept" | null =>
    view.cells.some(f) ? "shown" : reserve?.cells.some(f) ? "kept" : null;
  const stripe = stripeOf(view, "yours") ?? stripeOf(reserve, "yours");
  const todayStripe = stripeOf(view, "today") ?? stripeOf(reserve, "today");
  const yours = state((c) => c.owner === "yours");
  const today = state((c) => c.owner === "today");
  const oak = state((c) => c.owner === "oak" && !c.rests);
  const rests = state((c) => c.owner === "oak" && c.rests);
  const kept = (s: "shown" | "kept" | null) => s === "kept" && "invisible";
  const swatch = "inline-block h-2 w-3.5 shrink-0 rounded-[2px]";
  return (
    <span
      aria-hidden
      data-testid="song-legend"
      className={clsx(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-text-3",
        compact ? "text-[0.6875rem]" : "text-xs",
        className,
      )}
    >
      {today && (
        <span className={clsx("inline-flex items-center gap-1", kept(today))} data-legend="today">
          {todaySaved ? (
            <span
              className={clsx(swatch, "oak-song-yours oak-song-today-saved")}
              style={{ background: todayStripe }}
            />
          ) : (
            <span className={clsx(swatch, "oak-song-today")} />
          )}
          {todayWord}
        </span>
      )}
      {yours && stripe !== undefined && (
        <span className={clsx("inline-flex items-center gap-1", kept(yours))} data-legend="yours">
          <span className={clsx(swatch, "oak-song-yours")} style={{ background: stripe }} />
          Yours
        </span>
      )}
      {oak && (
        <span className={clsx("inline-flex items-center gap-1", kept(oak))} data-legend="oak">
          <span className={clsx(swatch, "oak-song-oak")} />
          Oak
        </span>
      )}
      {rests && (
        <span className={clsx("inline-flex items-center gap-1", kept(rests))} data-legend="rests">
          <span className={clsx(swatch, "oak-song-rest")} />
          Oak rests
        </span>
      )}
    </span>
  );
}

export function SongGrid({
  view,
  playheadBar = null,
  follows,
  compact = false,
  loopSection = null,
  onLoop,
  rowControls,
  silent,
  fresh,
  showBars = false,
  todayWord = "Today",
  legend = true,
  tintOak = false,
  todaySaved = false,
  legendReserve,
  className,
  "data-testid": testId = "song-grid",
}: SongGridProps) {
  const total = Math.max(1, view.lengthBars);
  // Column 1 holds the row names (not in compact); sections start at column 2. The names column is as wide as the
  // longest name needs, up to a cap (wider with the mute and solo), and a longer name wraps to a second line.
  const offset = compact ? 1 : 2;
  const cols: CSSProperties = {
    gridTemplateColumns: compact
      ? sectionTracks(view.sections)
      : `fit-content(${rowControls ? "13.25rem" : "10rem"}) ${sectionTracks(view.sections)}`,
  };
  const tones = songPartTones(view.parts);
  const { grid, heads, widths } = useSectionWidths(view.sections);
  const texts = headTexts(
    view.sections,
    view.sections.map((s, i) => widths?.[i] ?? estimatedWidth(s, total, compact)),
    (_, i) => ({ compact, showBars, looping: loopSection === view.sections[i]?.id }),
  );
  const cellOf = (part: string, section: string) =>
    view.cells.find((c) => c.part === part && c.section === section);
  const freshOrder = new Map([...(fresh ?? [])].map((k, i) => [k, i]));
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
        ref={grid}
        className={clsx("relative grid min-w-0", compact ? "gap-x-px gap-y-[3px]" : "gap-x-0.5 gap-y-1")}
        style={cols}
      >
        {/* the section headers */}
        {!compact && <span aria-hidden className="row-start-1" />}
        {view.sections.map((s, i) => {
          const looping = loopSection === s.id;
          const head = texts[i] as HeadText;
          const name = `${headName(s, head)}${showBars ? `, ${barsWords(s)}` : ""}`;
          const inner = (
            <>
              <span className={clsx("min-w-0", !head.tight && "truncate")}>{head.text}</span>
              {head.bars && (
                // After a hairline, so a bar number never reads as part of the name ("A 5").
                <span
                  aria-hidden
                  className="shrink-0 border-l border-text-3/40 pl-1 text-[0.6875rem] leading-none font-normal text-text-3 tabular-nums"
                >
                  {s.startBar + 1}
                </span>
              )}
              {head.icon && <Repeat aria-hidden className="size-3 shrink-0 text-accent" strokeWidth={2.25} />}
            </>
          );
          const common = {
            ref: (el: HTMLElement | null) => {
              heads.current[i] = el;
            },
            "data-section": s.id,
            "data-bars": s.bars,
            "data-today": s.today ? "1" : "0",
            "data-playing": playingSection === s.id ? "1" : "0",
            title: name,
            style: { gridColumn: offset + i, gridRow: 1 },
          } as const;
          const look = clsx(
            "relative flex min-w-0 items-center gap-1 overflow-hidden text-left",
            compact
              ? "h-4 justify-center rounded-[3px] text-[0.625rem] font-semibold text-text-3"
              : // One size class only: two arbitrary font sizes on one element resolve by stylesheet order.
                clsx(
                  "h-7 rounded-control font-medium text-text-2",
                  head.small ? "text-[0.6875rem]" : "text-[0.8125rem]",
                ),
            head.tight
              ? "justify-center px-0"
              : compact || head.form === "cut"
                ? "px-0.5"
                : head.small
                  ? "px-1"
                  : "px-1.5",
            // Today's section is marked in the header too, so a one-bar today column is easy to find.
            s.today
              ? compact
                ? "bg-accent/15 text-text"
                : "bg-accent/10 text-text"
              : !compact && "bg-surface-2",
            looping && "shadow-[inset_0_0_0_1.5px_var(--oak-accent)] text-text",
          );
          return onLoop ? (
            <button
              key={s.id}
              type="button"
              {...common}
              aria-pressed={looping}
              aria-label={`${looping ? "Stop looping" : "Loop"} ${name}`}
              onClick={() => onLoop(looping ? null : s)}
              className={clsx(look, "transition-colors duration-150 hover:bg-text/[0.08]")}
            >
              {inner}
            </button>
          ) : (
            <span key={s.id} {...common} className={look}>
              {inner}
            </span>
          );
        })}

        {/* one row per part */}
        {view.parts.map((p, row) => {
          const tone = tones.get(p.id) as string;
          const quiet = silent?.(p) === true;
          return (
            <div key={p.id} className="contents" data-part={p.id} data-silent={quiet ? "1" : undefined}>
              {!compact && (
                <div
                  className="flex min-w-0 items-center gap-1.5 pr-2"
                  style={{ gridColumn: 1, gridRow: row + 2 }}
                >
                  <span
                    aria-hidden
                    className={clsx("size-2 shrink-0 rounded-full", quiet && "opacity-35")}
                    style={{ background: tone }}
                  />
                  <span
                    className={clsx(
                      "line-clamp-2 min-w-0 flex-1 text-[0.8125rem] leading-tight break-words",
                      quiet ? "text-text-3 line-through" : "text-text-2",
                    )}
                    title={p.name}
                    data-testid="song-part-name"
                  >
                    {p.name}
                  </span>
                  {rowControls?.(p)}
                </div>
              )}
              {view.sections.map((s, i) => {
                const c = cellOf(p.id, s.id);
                const owner = c?.owner ?? "oak";
                const key = `${p.id}@${s.id}`;
                const order = freshOrder.get(key);
                const rests = owner === "oak" && c?.rests === true;
                const drawn = cellLook(owner, rests, tone, tintOak, todaySaved);
                return (
                  <span
                    key={s.id}
                    aria-hidden
                    data-cell={key}
                    data-owner={owner}
                    data-rests={rests ? "1" : undefined}
                    data-playing={playingSection === s.id ? "1" : "0"}
                    className={clsx(
                      "oak-song-cell relative min-w-0 self-center",
                      compact ? "h-1.5 rounded-[2px]" : "h-[1.125rem] rounded-[4px]",
                      drawn.className,
                      quiet && "opacity-35",
                      order !== undefined && "oak-song-fresh",
                    )}
                    style={{
                      gridColumn: offset + i,
                      gridRow: row + 2,
                      ...drawn.style,
                      ...(order !== undefined ? ({ "--i": order } as CSSProperties) : {}),
                    }}
                  />
                );
              })}
            </div>
          );
        })}

        <Playhead
          sections={view.sections}
          heads={heads}
          widths={widths}
          total={total}
          bar={playheadBar}
          follows={follows}
          style={{ gridColumn: `${offset} / -1`, gridRow: `1 / ${view.parts.length + 2}` }}
        />
      </div>
      <figcaption className={clsx(!legend && "sr-only")}>
        {legend && (
          <SongLegend
            view={view}
            tones={tones}
            todayWord={todayWord}
            compact={compact}
            todaySaved={todaySaved}
            reserve={legendReserve}
          />
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
 * Where bar position `at` (fractional, 0-based) falls, in px from the playhead layer's left edge: inside its section's
 * header, since the columns are sized per section (with a minimum) and are not all a bar's width. Null before layout.
 */
function playheadX(
  at: number,
  sections: readonly SongViewSection[],
  heads: readonly (HTMLElement | null)[],
  layer: HTMLElement | null,
): number | null {
  const i = sections.findIndex((s) => at < s.startBar + s.bars);
  const k = i < 0 ? sections.length - 1 : i;
  const s = sections[k];
  const h = heads[k];
  if (!s || !h || !layer || h.offsetWidth === 0) return null;
  const within = Math.min(1, Math.max(0, (at - s.startBar) / Math.max(1, s.bars)));
  return h.offsetLeft - layer.offsetLeft + within * h.offsetWidth;
}

/**
 * The playhead over the bars: placed by script each frame from the song player (never a React render per frame), or
 * at a fixed bar. Under reduced motion it steps from bar to bar.
 */
function Playhead({
  sections,
  heads,
  widths,
  total,
  bar,
  follows,
  style,
}: {
  sections: readonly SongViewSection[];
  heads: RefObject<(HTMLElement | null)[]>;
  widths: readonly number[] | null;
  total: number;
  bar: number | null;
  follows?: string | ((id: string) => boolean) | undefined;
  style: CSSProperties;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const follow = useRef(follows);
  follow.current = follows;
  const secs = useRef(sections);
  secs.current = sections;
  const place = (el: HTMLElement, at: number) => {
    const x = playheadX(at, secs.current, heads.current, layer.current);
    el.style.left = x === null ? `${(Math.min(total, Math.max(0, at)) / total) * 100}%` : `${x}px`;
  };
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
      el.style.opacity = "1";
      place(el, reduced ? Math.floor(position) + 0.5 : position);
    });
  }, [follows === undefined, total]);
  const fixed = bar !== null && bar >= 0 && bar < total;
  // A fixed playhead moves to its section's real place once the columns are measured (and after a resize).
  useLayoutEffect(() => {
    if (fixed && line.current) place(line.current, bar + 0.5);
  }, [fixed, bar, widths]);
  return (
    <div ref={layer} aria-hidden className="pointer-events-none relative" style={style}>
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
