import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { REGION_LABEL } from "../../lib/content-model.ts";
import { onNextDownbeat, useReducedMotion } from "../../ui/theme/motion.ts";
import { useThemeName } from "../../ui/theme/use-theme-name.ts";
import type { MapGraph } from "../graph.ts";
import type { MapLayout } from "../layout.ts";
import { clampView, type Direction, ensureVisible, fitAll, fitWidth, type View, zoomAt } from "../nav.ts";
import { type OakMapProps, PANEL_WIDTH } from "../OakMap.tsx";
import { leafView } from "../state.ts";
import { layoutIllustratedOak, type TreeLeaf } from "./layout.ts";
import { treeNeighbour } from "./navigation.ts";
import { type ReleasedTrack, TreeDrawing } from "./TreeDrawing.tsx";
import "./illustrated.css";

export type IllustratedOakMapProps = Omit<OakMapProps, "layout"> &
  ({ graph: MapGraph; layout?: never } | { layout: MapLayout; graph?: never }) & {
    releasedTracks?: readonly ReleasedTrack[];
    onOpenTrack?: (id: string) => void;
    onLeafFocus?: (id: string) => void;
    /** Real introduction evidence supplied by the caller; updatedAt is not an introduction date. */
    newlyLearned?: ReadonlySet<string>;
    clock?: Parameters<typeof onNextDownbeat>[1];
  };

const ARROWS: Readonly<Record<string, Direction>> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const EMPTY_NEW_LEAVES: ReadonlySet<string> = new Set();
const systemReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function watchSystemMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** A drop-in canvas for OakTree. The old layout is accepted at the boundary; positions come from the tree. */
export function IllustratedOakMap(props: IllustratedOakMapProps) {
  const graph = useMemo<MapGraph>(
    () =>
      props.graph ?? {
        nodes: props.layout.nodes,
        edges: props.layout.edges.map((e) => [e.from, e.to]),
        regions: props.layout.columns.map((c) => c.region),
        units: props.layout.rows.map((r) => ({ id: r.unit, title: r.title, track: r.track })),
      },
    [props.graph, props.layout],
  );
  const layout = useMemo(() => layoutIllustratedOak(graph), [graph]);
  const theme = useThemeName();
  const preferenceReduced = useReducedMotion();
  const osReduced = useSyncExternalStore(watchSystemMotion, systemReduced, () => false);
  const reduced = preferenceReduced || osReduced;
  const svg = useRef<SVGSVGElement>(null);
  const scene = useRef<SVGGElement>(null);
  const view = useRef<View>({ k: 1, tx: 0, ty: 0 });
  const size = useRef({ w: 0, h: 0 });
  const frame = useRef(0);
  const [active, setActive] = useState(props.initialId ?? layout.nodes[0]?.id ?? null);
  const [hover, setHover] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    tx: number;
    ty: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    if (!active || !layout.byId.has(active)) setActive(layout.nodes[0]?.id ?? null);
  }, [active, layout]);

  // Pan updates one SVG transform, at most once per frame. The 180-leaf scene does not re-render on drag.
  const paint = useCallback((next: View) => {
    view.current = next;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const v = view.current;
      scene.current?.setAttribute("transform", `translate(${v.tx} ${v.ty}) scale(${v.k})`);
      svg.current?.setAttribute("data-scale", v.k.toFixed(3));
      // The branch sub-labels are 12 units tall: below 11 px on screen they are unreadable, so they wait for a zoom.
      svg.current?.setAttribute("data-details", 12 * v.k >= 11 ? "shown" : "hidden");
    });
  }, []);
  const constrain = useCallback(
    (v: View) =>
      clampView(
        v,
        layout,
        Math.max(1, size.current.w - (latest.current.panelOpen ? PANEL_WIDTH : 0)),
        size.current.h,
      ),
    [layout],
  );
  const reveal = useCallback(
    (id: string) => {
      const leaf = layout.byId.get(id);
      if (leaf)
        paint(
          constrain(
            ensureVisible(
              view.current,
              leaf,
              size.current.w,
              size.current.h,
              28,
              latest.current.panelOpen ? PANEL_WIDTH : 0,
            ),
          ),
        );
    },
    [layout, paint, constrain],
  );
  const focusLeaf = useCallback(
    (id: string) => {
      if (!layout.byId.has(id)) return;
      setActive(id);
      reveal(id);
      svg.current
        ?.querySelector<SVGGElement>(`[data-node="${CSS.escape(id)}"]`)
        ?.focus({ preventScroll: true });
    },
    [layout, reveal],
  );
  const command = useCallback(
    (kind: string, id?: string) => {
      const { w, h } = size.current;
      const inset = latest.current.panelOpen ? PANEL_WIDTH : 0;
      if (kind === "focus" && id) {
        if (view.current.k < 0.55) paint(fitWidth(layout, w, h));
        focusLeaf(id);
      } else if (kind === "fit") paint(fitAll(layout, w - inset, h));
      else if (kind === "fit-width") paint(fitWidth(layout, w, h));
      else paint(constrain(zoomAt(view.current, kind === "zoom-in" ? 1.25 : 0.8, (w - inset) / 2, h / 2)));
    },
    [layout, focusLeaf, paint, constrain],
  );

  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      size.current = { w, h };
      paint(fitAll(layout, Math.max(1, w - (latest.current.panelOpen ? PANEL_WIDTH : 0)), h));
      setReady(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [layout, paint]);

  const lastSeq = useRef(-1);
  useEffect(() => {
    const c = props.command;
    if (ready && c && c.seq !== lastSeq.current) {
      lastSeq.current = c.seq;
      command(c.kind, c.id);
    }
  }, [props.command, ready, command]);
  useEffect(() => {
    if (props.selectedId && props.panelOpen) reveal(props.selectedId);
  }, [props.selectedId, props.panelOpen, reveal]);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      const rect = el.getBoundingClientRect();
      const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
      paint(
        constrain(
          e.ctrlKey || e.metaKey
            ? zoomAt(v, Math.exp(-e.deltaY * 0.0025), e.clientX - rect.left, e.clientY - rect.top)
            : { ...v, tx: v.tx - dx, ty: v.ty - dy },
        ),
      );
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [paint, constrain]);

  const animated = useRef(new Set<string>());
  useEffect(() => {
    const animations: Animation[] = [];
    const cancel = onNextDownbeat(() => {
      for (const id of props.newlyLearned ?? []) {
        if (animated.current.has(id)) continue;
        animated.current.add(id);
        const state = props.states.get(id);
        if (
          reduced ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          !state ||
          state.level === "new" ||
          state.level === "available"
        )
          continue;
        const el = svg.current?.querySelector<SVGGElement>(
          `[data-node="${CSS.escape(id)}"] .illustrated-glyph`,
        );
        if (el)
          animations.push(
            el.animate(
              [
                { transform: "scale(0.3, 0.65)", opacity: 0.35 },
                { transform: "scale(1)", opacity: 1 },
              ],
              { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)", iterations: 1 },
            ),
          );
      }
    }, props.clock);
    return () => {
      cancel();
      for (const a of animations) a.cancel();
    };
  }, [props.newlyLearned, props.states, props.clock, reduced]);

  const nodeKey = useCallback(
    (e: KeyboardEvent<SVGGElement>, id: string) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const dir = ARROWS[e.key];
      const key = e.key.toLowerCase();
      if (dir) {
        const to = treeNeighbour(layout, id, dir);
        if (to) focusLeaf(to);
      } else if (key === "enter" || key === " ") latest.current.onSelect(id);
      else if (key === "escape") latest.current.onClose();
      else if (key === "home" || key === "end") {
        const n = key === "home" ? layout.nodes[0] : layout.nodes.at(-1);
        if (n) focusLeaf(n.id);
      } else if (key === "+" || key === "=") command("zoom-in");
      else if (key === "-" || key === "−") command("zoom-out");
      else if (key === "0") command("fit");
      else if (key === "w") command("fit-width");
      else if (key === "n") {
        const next = latest.current.next.targets[0];
        if (next) command("focus", next);
      } else return;
      e.preventDefault();
      e.stopPropagation();
    },
    [layout, focusLeaf, command],
  );

  const targets = useMemo(
    () => new Set(props.showNext ? props.next.targets : []),
    [props.showNext, props.next],
  );
  const renderLeaf = useCallback(
    (n: TreeLeaf, glyph: ReactNode, description: string) => (
      // biome-ignore lint/a11y/useSemanticElements: SVG leaf with roving keyboard focus; HTML buttons cannot be SVG children.
      <g
        data-node={n.id}
        role="button"
        tabIndex={n.id === active ? 0 : -1}
        aria-label={`${description}${targets.has(n.id) ? ". Part of what's next" : ""}`}
        aria-pressed={props.selectedId === n.id && props.panelOpen}
        data-next={targets.has(n.id) || undefined}
        data-status={leafView(props.states.get(n.id)).status}
        transform={`translate(${n.cx} ${n.cy})`}
        className="illustrated-leaf"
        onFocus={() => {
          setActive(n.id);
          reveal(n.id);
          latest.current.onLeafFocus?.(n.id);
        }}
        onKeyDown={(e) => nodeKey(e, n.id)}
        onClick={() => {
          if (!suppressClick.current) {
            focusLeaf(n.id);
            latest.current.onSelect(n.id);
          }
        }}
        onPointerEnter={() => {
          if (!drag.current?.moved) setHover(n.id);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <title>{description}</title>
        <rect x={-21} y={-23} width={42} height={46} rx={12} fill="transparent" />
        <rect className="illustrated-focus-gap" x={-22} y={-24} width={44} height={48} rx={13} />
        <rect className="illustrated-focus oak-focus" x={-22} y={-24} width={44} height={48} rx={13} />
        {targets.has(n.id) && <circle r={23} className="illustrated-next" />}
        <g className="illustrated-glyph">{glyph}</g>
      </g>
    ),
    [active, targets, props.selectedId, props.panelOpen, props.states, reveal, nodeKey, focusLeaf],
  );

  const renderAcorn = useCallback(
    (track: ReleasedTrack, glyph: ReactNode, x: number, y: number) => (
      <g transform={`translate(${x} ${y})`}>
        <a
          href={`/album/${encodeURIComponent(track.id)}`}
          className="illustrated-acorn"
          aria-label={`${track.capstoneId ? "Open released track" : "Open B-side"}: ${track.title}`}
          onClick={
            props.onOpenTrack
              ? (e) => {
                  e.preventDefault();
                  props.onOpenTrack?.(track.id);
                }
              : undefined
          }
        >
          <title>{track.title}</title>
          <rect x={-14} y={-13} width={28} height={33} rx={8} fill="transparent" />
          {glyph}
        </a>
      </g>
    ),
    [props.onOpenTrack],
  );

  const pointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    drag.current = {
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      tx: view.current.tx,
      ty: view.current.ty,
      moved: false,
    };
  };
  const pointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
    d.moved = true;
    suppressClick.current = true;
    paint(constrain({ ...view.current, tx: d.tx + dx, ty: d.ty + dy }));
  };
  const pointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  };
  const relatedId = hover ?? (props.panelOpen ? props.selectedId : null);
  const caption = layout.byId.get(hover ?? active ?? "");
  const progress = caption ? props.unitProgress.get(caption.unit) : undefined;
  const branch = caption ? props.openUnits?.get(caption.unit) : undefined;
  return (
    <div className="illustrated-oak" data-ready={ready}>
      <ul className="illustrated-strands" aria-label="Course strands">
        {layout.regions.map((r) => (
          <li key={r} data-strand={r}>
            {REGION_LABEL[r]}
          </li>
        ))}
      </ul>
      <svg
        ref={svg}
        data-testid="oak-canvas"
        className="illustrated-canvas"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <title>The Oak: your music taking root</title>
        <desc>
          Arrows move between nearby leaves. Enter opens a leaf. Plus and minus zoom, zero fits, W fits width,
          N finds what is next. Drag to explore.
        </desc>
        <g ref={scene}>
          <TreeDrawing
            layout={layout}
            states={props.states}
            theme={theme}
            releasedTracks={props.releasedTracks ?? []}
            newlyLearned={props.newlyLearned ?? EMPTY_NEW_LEAVES}
            renderLeaf={renderLeaf}
            renderAcorn={renderAcorn}
          />
          <g aria-hidden pointerEvents="none" className="illustrated-connections">
            {layout.edges
              .filter(
                (e) =>
                  (relatedId && (e.from === relatedId || e.to === relatedId)) ||
                  (props.showNext && props.next.edges.has(`${e.from}>${e.to}`)),
              )
              .map((e) => (
                <path
                  key={`${e.from}>${e.to}`}
                  data-edge={`${e.from}>${e.to}`}
                  d={e.d}
                  fill="none"
                  strokeDasharray={e.crossRegion ? "4 4" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </g>
        </g>
      </svg>
      <div className="illustrated-caption" aria-live="polite" aria-atomic="true">
        <span>
          {caption?.name ?? "Your music, taking root."}
          {caption && branch && !progress?.current && (progress?.done ?? 0) === 0 ? (
            // An open track unit reads "open", never a count of what is missing (as the unit rows did).
            <>
              {` · ${caption.unit} · `}
              <span data-branch-row={caption.unit}>open</span>
            </>
          ) : progress && progress.total > 0 ? (
            ` · ${progress.done} of ${progress.total} lessons${progress.current ? " · current unit" : ""}`
          ) : (
            ""
          )}
        </span>
        <span className="illustrated-help">Arrows explore · Enter opens · 0 shows the whole tree</span>
      </div>
    </div>
  );
}
