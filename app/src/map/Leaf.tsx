// The leaf glyph (ux §5.2, contracts §7.10): hue from the mastery level, fill opacity from freshness, a dashed
// bud before anything is learned, a dry edge and a 10° droop only while drying. Used by the map, the legend,
// the panel and the thumbnail so they always agree.
import { clsx } from "clsx";
import type { LeafStatus, LeafView } from "./state.ts";

/** Fill classes per status, Paper then Bark (ux §5.2 palette; text never sits on these fills). */
export const LEAF_FILL: Record<LeafStatus, string> = {
  locked: "fill-none",
  available: "fill-none",
  introduced: "fill-[#b7791f] dark:fill-[#e0a54a]",
  practising: "fill-[#2a7f80] dark:fill-[#5fc0be]",
  mastered: "fill-[#1d7444] dark:fill-[#72d494]",
};
export const LEAF_STROKE: Record<LeafStatus, string> = {
  locked: "stroke-text-3",
  available: "stroke-accent",
  introduced: "stroke-[#b7791f] dark:stroke-[#e0a54a]",
  practising: "stroke-[#2a7f80] dark:stroke-[#5fc0be]",
  mastered: "stroke-[#1d7444] dark:stroke-[#72d494]",
};
/** Background fill for dots (thumbnail) and swatches. */
export const LEAF_DOT: Record<LeafStatus, string> = {
  locked: "fill-text-3/35",
  available: "fill-surface stroke-accent",
  introduced: LEAF_FILL.introduced,
  practising: LEAF_FILL.practising,
  mastered: LEAF_FILL.mastered,
};

const LEAF_PATH = "M1 13 C1 6 6 1 13 1 C13 8 8 13 1 13 Z";
const RIB_PATH = "M2.5 11.5 L9.5 4.5";

/** A 14×14 leaf drawn at the origin; place it with a parent transform. */
export function LeafGlyph({ view, className }: { view: LeafView; className?: string }) {
  const { status } = view;
  const outline = status === "locked" || status === "available";
  return (
    <g
      className={className}
      transform={view.drying ? "rotate(10 7 7)" : undefined}
      data-leaf={status}
      data-drying={view.drying || undefined}
    >
      {status === "available" && (
        <path d={LEAF_PATH} className="fill-none stroke-accent/25" strokeWidth={4} />
      )}
      <path
        d={LEAF_PATH}
        className={clsx(LEAF_FILL[status], LEAF_STROKE[status])}
        fillOpacity={outline ? undefined : view.opacity}
        strokeWidth={1.25}
        strokeDasharray={status === "locked" ? "2 2" : undefined}
      />
      {view.drying && (
        <path d={LEAF_PATH} className="fill-none stroke-issue" strokeWidth={1.25} strokeDasharray="1.5 2.5" />
      )}
      {!outline && (
        <path
          d={RIB_PATH}
          className="fill-none stroke-surface"
          strokeOpacity={0.55 * view.opacity}
          strokeWidth={1}
        />
      )}
    </g>
  );
}

/** A standalone 16 px leaf for legends and the panel. */
export function LeafSwatch({ view, label }: { view: LeafView; label?: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="-1 -1 16 16"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0 overflow-visible"
    >
      <LeafGlyph view={view} />
    </svg>
  );
}
