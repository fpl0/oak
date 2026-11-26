// The Oak v1 canvas (ux §5.2, contracts §4, §7.10): the skill graph as an SVG grid of leaves, strands across
// and units down, prerequisite edges, pan (drag, wheel), zoom (Ctrl/⌘-wheel, + and −, 0 to fit) and arrow-key
// travel between leaves with a roving tab stop. Strand names stay pinned above the canvas while it pans.
import type { SkillState } from "@oak/api";
import { clsx } from "clsx";
import { type KeyboardEvent, type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { REGION_LABEL } from "../lib/content-model.ts";
import { edgeKey, type NextPath } from "./guide.ts";
import { LEAF_FILL, LeafGlyph } from "./Leaf.tsx";
import type { MapLayout, PlacedNode } from "./layout.ts";
import {
  clampView,
  type Direction,
  ensureVisible,
  fitAll,
  fitWidth,
  neighbour,
  rowIntoView,
  type View,
  zoomAt,
} from "./nav.ts";
import { type LeafView, leafView, STATUS_LABEL } from "./state.ts";

/** Below this scale the leaf faces drop their labels and the map reads as an overview. */
export const LABEL_MIN_SCALE = 0.55;
export const PANEL_WIDTH = 336;
const HEADER_H = 32;

export interface MapCommand {
  kind: "zoom-in" | "zoom-out" | "fit" | "fit-width" | "focus";
  id?: string;
  /** Changes on every request so the same command can be sent twice. */
  seq: number;
}

export interface OakMapProps {
  layout: MapLayout;
  states: ReadonlyMap<string, SkillState>;
  next: NextPath;
  showNext: boolean;
  selectedId: string | null;
  panelOpen: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  command: MapCommand | null;
  unitProgress: ReadonlyMap<string, { done: number; total: number; current: boolean }>;
  /** Starting tab stop: the first "what's next" leaf, else the first leaf. */
  initialId: string | null;
  /**
   * Wave 6: unit rows of an advanced track whose gate is met (`J1` → "Jazz Harmony" and its honest note). The row
   * reads "open" where a core row reads its lesson count; a track never shows a count of what is missing.
   */
  openUnits?: ReadonlyMap<string, { title: string; note: string }>;
}

const ARROWS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function nodeAriaLabel(n: PlacedNode, v: LeafView, next: boolean): string {
  const parts = [`${n.name} (${n.id})`, STATUS_LABEL[v.status]];
  if (v.freshness !== null && v.freshness < 0.999) parts.push(`freshness ${Math.round(v.freshness * 100)}%`);
  if (v.drying) parts.push("in today's warm-up");
  if (v.paused) parts.push("waiting for the mic");
  if (next) parts.push("part of what's next");
  return parts.join(", ");
}

export function OakMap(props: OakMapProps) {
  const { layout, states, next, showNext, selectedId, panelOpen } = props;
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const [active, setActive] = useState<string | null>(props.initialId);
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const viewRef = useRef<View | null>(null);
  viewRef.current = view;

  // Measure the canvas; the first measurement fits the width and brings "what's next" into view.
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w === 0 || view !== null) return;
    let v = fitWidth(layout, size.w, size.h);
    const start = props.initialId ? layout.byId.get(props.initialId) : undefined;
    if (start) {
      const row = layout.rows.find((r) => r.unit === start.unit);
      if (row) v = rowIntoView(v, row, size.h - HEADER_H);
      v = clampView(ensureVisible(v, start, size.w, size.h, 48), layout, size.w, size.h);
    }
    setView(v);
  }, [size, view, layout, props.initialId]);

  useEffect(() => {
    if (props.initialId && active === null) setActive(props.initialId);
  }, [props.initialId, active]);

  const inset = panelOpen ? PANEL_WIDTH : 0;
  const reveal = (id: string, v: View | null = viewRef.current) => {
    const n = layout.byId.get(id);
    if (!n || !v) return;
    setView(clampView(ensureVisible(v, n, size.w, size.h, 24, inset), layout, size.w, size.h));
  };
  const focusNode = (id: string) => {
    setActive(id);
    reveal(id);
    // Focus after the roving tab stop moved.
    requestAnimationFrame(() => {
      svg.current
        ?.querySelector<SVGGElement>(`[data-node="${CSS.escape(id)}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  // Commands from the toolbar and the global keys.
  const lastSeq = useRef(-1);
  useEffect(() => {
    const c = props.command;
    if (!c || c.seq === lastSeq.current || !view || size.w === 0) return;
    lastSeq.current = c.seq;
    const cx = (size.w - inset) / 2;
    const cy = size.h / 2;
    if (c.kind === "zoom-in") setView(clampView(zoomAt(view, 1.25, cx, cy), layout, size.w, size.h));
    else if (c.kind === "zoom-out") setView(clampView(zoomAt(view, 0.8, cx, cy), layout, size.w, size.h));
    else if (c.kind === "fit") setView(fitAll(layout, size.w - inset, size.h));
    else if (c.kind === "fit-width") setView(fitWidth(layout, size.w, size.h));
    else if (c.kind === "focus" && c.id) {
      // Bring the leaf in at reading size.
      const base = view.k < LABEL_MIN_SCALE ? fitWidth(layout, size.w, size.h) : view;
      setActive(c.id);
      reveal(c.id, base);
    }
  });

  // Keep the selected leaf clear of the panel when it opens.
  useEffect(() => {
    if (selectedId && panelOpen) reveal(selectedId);
    // Only when the selection or the panel changes.
  }, [selectedId, panelOpen]);

  // Wheel: pan; Ctrl/⌘ + wheel (and trackpad pinch): zoom at the pointer. Non-passive to keep the page still.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      if (!v) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0025);
        setView(
          clampView(zoomAt(v, factor, e.clientX - r.left, e.clientY - r.top), layout, r.width, r.height),
        );
      } else {
        const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
        setView(clampView({ k: v.k, tx: v.tx - dx, ty: v.ty - dy }, layout, r.width, r.height));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [layout]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !view) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || !view) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      svg.current?.setPointerCapture(e.pointerId);
    }
    setView(clampView({ k: view.k, tx: d.tx + dx, ty: d.ty + dy }, layout, size.w, size.h));
  };
  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.moved) svg.current?.releasePointerCapture(e.pointerId);
    // A drag that moved must not count as a click on the leaf it ended on.
    setTimeout(() => {
      drag.current = null;
    }, 0);
  };

  const onNodeKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    const dir = ARROWS[e.key];
    if (dir) {
      e.preventDefault();
      const to = neighbour(layout, id, dir);
      if (to) focusNode(to);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onSelect(id);
    } else if (e.key === "Escape" && panelOpen) {
      e.preventDefault();
      props.onClose();
    } else if (e.key === "Home") {
      e.preventDefault();
      const first = layout.nodes[0];
      if (first) focusNode(first.id);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = layout.nodes.at(-1);
      if (last) focusNode(last.id);
    }
  };

  const v = view ?? { k: 1, tx: 0, ty: 0 };
  let lastUnitLabel = Number.NEGATIVE_INFINITY;
  const labels = v.k >= LABEL_MIN_SCALE;
  const focusId = hover ?? (panelOpen ? selectedId : null);
  const nextTargets = new Set(showNext ? next.targets : []);
  const nextFeeders = new Set(showNext ? next.feeders : []);
  const related = new Set<string>();
  if (focusId)
    for (const e of layout.edges) {
      if (e.from === focusId) related.add(e.to);
      if (e.to === focusId) related.add(e.from);
    }

  return (
    <div
      ref={box}
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface"
    >
      <div
        aria-hidden
        className="relative z-10 shrink-0 overflow-hidden border-b border-border bg-surface-2"
        style={{ height: HEADER_H }}
      >
        {layout.columns.map((c) =>
          c.w * v.k < 56 ? null : (
            <div
              key={c.region}
              className="absolute top-0 flex h-full items-center truncate px-1 text-sm font-semibold text-text-2"
              style={{ left: v.tx + c.x * v.k, width: c.w * v.k }}
            >
              {REGION_LABEL[c.region]}
            </div>
          ),
        )}
      </div>
      <svg
        ref={svg}
        className="block min-h-0 w-full flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="oak-canvas"
        data-scale={v.k.toFixed(3)}
      >
        <title>The Oak: skills by strand and unit</title>
        <g transform={`translate(${v.tx},${v.ty}) scale(${v.k})`}>
          {layout.rows.map((r, i) => {
            const p = props.unitProgress.get(r.unit);
            const branch = props.openUnits?.get(r.unit);
            // Overview labels are skipped where the previous one would collide.
            const labelY = (r.y + Math.min(r.h, 28) / 2) * v.k;
            const showUnit = labels || labelY - lastUnitLabel >= 13;
            if (showUnit) lastUnitLabel = labelY;
            return (
              <g key={r.unit} aria-hidden>
                <rect
                  x={4}
                  y={r.y - 8}
                  width={layout.width - 8}
                  height={r.h + 16}
                  rx={6}
                  className={clsx(
                    p?.current ? "fill-accent-2/10" : i % 2 === 0 ? "fill-lane-in" : "fill-transparent",
                  )}
                />
                {labels ? (
                  <text x={12} y={r.y + 14} className="fill-text font-mono text-[12px] font-semibold">
                    {r.unit}
                  </text>
                ) : (
                  // Overview: the unit names sit outside the map at a constant on-screen size.
                  showUnit && (
                    <text
                      x={-6}
                      y={r.y + Math.min(r.h, 28) / 2}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className={clsx(
                        "font-mono font-semibold",
                        p?.current ? "fill-accent-2" : "fill-text-2",
                      )}
                      style={{ fontSize: 11 / v.k }}
                    >
                      {r.unit}
                    </text>
                  )
                )}
                {labels && branch && !p?.current && (p?.done ?? 0) === 0 ? (
                  <text x={12} y={r.y + 29} className="fill-accent text-[10.5px]" data-branch-row={r.unit}>
                    open
                  </text>
                ) : (
                  labels &&
                  p &&
                  p.total > 0 && (
                    <text x={12} y={r.y + 29} className="fill-text-3 text-[10.5px]">
                      {p.current ? "now" : `${p.done}/${p.total}`}
                    </text>
                  )
                )}
                <title>
                  {branch
                    ? `${r.unit} · ${r.title} · ${branch.title}: ${branch.note}`
                    : `${r.unit} · ${r.title}${p ? ` · ${p.done} of ${p.total} lessons done` : ""}`}
                </title>
              </g>
            );
          })}
          <g aria-hidden className="fill-none">
            {layout.edges.map((e) => {
              const key = edgeKey(e.from, e.to);
              const into = focusId !== null && e.to === focusId;
              const out = focusId !== null && e.from === focusId;
              const path = showNext && next.edges.has(key);
              const dim = focusId !== null && !into && !out;
              return (
                <path
                  key={key}
                  d={e.d}
                  data-edge={key}
                  className={clsx(
                    into
                      ? "stroke-accent"
                      : out
                        ? "stroke-accent-2"
                        : path
                          ? "stroke-accent-2"
                          : "stroke-text-3",
                  )}
                  strokeOpacity={into || out ? 1 : path ? 0.9 : dim ? 0.12 : e.crossRegion ? 0.32 : 0.22}
                  strokeWidth={into || out || path ? 1.75 : 1}
                  strokeDasharray={e.crossRegion ? "4 3" : undefined}
                />
              );
            })}
          </g>
          {layout.nodes.map((n) => {
            const lv = leafView(states.get(n.id));
            const isNext = nextTargets.has(n.id);
            const feeder = nextFeeders.has(n.id);
            const selected = panelOpen && selectedId === n.id;
            const dim = focusId !== null && focusId !== n.id && !related.has(n.id) && !isNext;
            return (
              // biome-ignore lint/a11y/useSemanticElements: an SVG leaf; HTML buttons cannot live inside <svg>.
              <g
                key={n.id}
                data-node={n.id}
                data-status={lv.status}
                data-next={isNext || undefined}
                role="button"
                tabIndex={n.id === (active ?? layout.nodes[0]?.id) ? 0 : -1}
                aria-label={nodeAriaLabel(n, lv, isNext)}
                aria-pressed={selected}
                transform={`translate(${n.x},${n.y})`}
                className={clsx(
                  "cursor-pointer outline-none [&:focus-visible>.oak-focus]:opacity-100",
                  dim && "opacity-45",
                )}
                onFocus={() => {
                  setActive(n.id);
                  reveal(n.id);
                }}
                onKeyDown={(e) => onNodeKey(e, n.id)}
                onClick={() => {
                  if (drag.current?.moved) return;
                  setActive(n.id);
                  props.onSelect(n.id);
                }}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
              >
                <rect
                  className="oak-focus fill-none stroke-accent opacity-0"
                  x={-3}
                  y={-3}
                  width={n.w + 6}
                  height={n.h + 6}
                  rx={9}
                  strokeWidth={2}
                />
                {labels ? (
                  <>
                    <rect
                      width={n.w}
                      height={n.h}
                      rx={7}
                      className={clsx(
                        lv.status === "locked" ? "fill-surface-2" : "fill-surface",
                        selected
                          ? "stroke-accent"
                          : isNext
                            ? "stroke-accent-2"
                            : lv.status === "mastered"
                              ? "stroke-[#1d7444] dark:stroke-[#72d494]"
                              : feeder
                                ? "stroke-accent-2/60"
                                : "stroke-border",
                      )}
                      strokeWidth={selected || isNext || lv.status === "mastered" ? 1.75 : 1}
                      strokeDasharray={lv.status === "locked" && !isNext ? "3 2" : undefined}
                    />
                    <g transform={`translate(7,${(n.h - 14) / 2})`}>
                      <LeafGlyph view={lv} />
                    </g>
                  </>
                ) : (
                  // Overview: each leaf becomes a block in its state's colour, paler as it fades.
                  <rect
                    width={n.w}
                    height={n.h}
                    rx={7}
                    data-block={lv.status}
                    className={clsx(
                      lv.status === "locked"
                        ? "fill-border"
                        : lv.status === "available"
                          ? "fill-surface stroke-accent"
                          : LEAF_FILL[lv.status],
                      (isNext || selected) && "stroke-accent-2",
                      lv.drying && "stroke-issue",
                    )}
                    fillOpacity={lv.freshness === null ? undefined : lv.opacity}
                    strokeWidth={isNext || selected || lv.drying ? 6 : lv.status === "available" ? 4 : 0}
                  />
                )}
                {labels && (
                  <text
                    x={26}
                    y={n.h / 2 + 4}
                    className={clsx(
                      "text-[12px]",
                      lv.status === "locked" ? "fill-text-3" : "fill-text",
                      isNext && "font-semibold",
                    )}
                  >
                    {n.label}
                  </text>
                )}
                {lv.paused && labels && (
                  <g
                    transform={`translate(${n.w - 13},${n.h / 2 - 5})`}
                    className="stroke-text-3"
                    aria-hidden
                  >
                    <rect x={2} y={0} width={4} height={6} rx={2} className="fill-none" strokeWidth={1} />
                    <path d="M0 4 a4 4 0 0 0 8 0 M4 8 v2 M0 0 L8 10" className="fill-none" strokeWidth={1} />
                  </g>
                )}
                <title>{`${n.id} · ${n.name}`}</title>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
