// The Tree tab of /oak: toolbar (what's next, legend, zoom), the canvas, and the node panel docked over the
// canvas' right edge. Keys: arrows between leaves, Enter opens, Esc closes, + / − zoom, 0 fits the whole map,
// W fits the width, N goes to what's next.
import type { SkillState } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { GitBranch, Maximize2, MicOff, Minus, MoveHorizontal, Plus, Route as RouteIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useAlbum } from "../lib/queries.ts";
import { useHotkeys } from "../ui/keys/KeymapProvider.tsx";
import { Button, buttonClass, IconButton } from "../ui/kit/Button.tsx";
import { EmptyState } from "../ui/kit/basics.tsx";
import { ErrorState, LoadingState } from "../ui/kit/QueryState.tsx";
import { IllustratedOakMap as OakMap } from "./illustrated/index.ts";
import { LeafSwatch } from "./Leaf.tsx";
import { NodePanel } from "./NodePanel.tsx";
import { newlyLearned } from "./newly-learned.ts";
import { type MapCommand, PANEL_WIDTH } from "./OakMap.tsx";
import { minutesOf } from "./revive.ts";
import { countLeaves, LEAF_STATUSES, leafView, STATUS_HELP, STATUS_LABEL } from "./state.ts";
import { type OakModel, useOak } from "./use-oak.ts";

const SAMPLE_STATE = {
  locked: "new",
  available: "available",
  introduced: "learning",
  practising: "practiced",
  mastered: "mastered",
} as const;

export function Legend({ className, quiet = false }: { className?: string; quiet?: boolean }) {
  const sample = (level: (typeof SAMPLE_STATE)[keyof typeof SAMPLE_STATE], freshness = 1, drying = false) =>
    leafView({
      skillId: "R01" as SkillState["skillId"],
      P: 0.5,
      R: null,
      D: 0,
      M: 0,
      level,
      debt: false,
      debtReason: null,
      provisional: false,
      paused: false,
      freshness,
      drying,
      updatedAt: "",
    });
  return (
    <ul
      aria-label="Legend"
      className={clsx("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-2", className)}
    >
      {LEAF_STATUSES.map((s) => (
        <li key={s} className="flex items-center gap-1.5" title={STATUS_HELP[s]}>
          <LeafSwatch view={sample(SAMPLE_STATE[s])} />
          {STATUS_LABEL[s]}
        </li>
      ))}
      <li className="flex items-center gap-1.5" title="Paler leaves have reviews coming due.">
        <LeafSwatch view={sample("practiced", 0.35)} />
        Paler: review soon
      </li>
      <li className="flex items-center gap-1.5" title="Its cards are in today's warm-up.">
        <LeafSwatch view={sample("practiced", 0.3, true)} />
        In today's warm-up
      </li>
      {quiet && (
        <li
          className="flex items-center gap-1.5"
          title="Quiet mode: singing reviews wait."
          data-testid="legend-quiet"
        >
          <MicOff aria-hidden className="size-3.5" />
          Voice: waiting for the mic
        </li>
      )}
    </ul>
  );
}

/** "Revive" (every drying leaf: today's planned sets, inside the budget) and "Revive more" (the opt-in). */
function ReviveBar({ model }: { model: OakModel }) {
  const ids = model.graph.nodes.map((n) => n.id);
  const counts = countLeaves(ids, model.states);
  const faded = ids.filter((id) => {
    const v = leafView(model.states.get(id));
    return v.freshness !== null && v.freshness < 0.999 && !v.drying && !v.paused;
  }).length;
  if (counts.drying === 0 && faded === 0) return null;
  return (
    // Its small buttons stand into the row's gaps: the row keeps the legend's one line, the height the canvas
    // below is sized for (the page never scrolls, a drying leaf or not).
    <div className="-my-1.5 flex items-center gap-2" data-testid="revive-bar">
      {counts.drying > 0 && (
        <Link to="/session/revive" className={buttonClass("secondary", "sm")} data-testid="revive-all">
          Revive {counts.drying} {counts.drying === 1 ? "leaf" : "leaves"} (≈ {minutesOf(model.reviveSec)}{" "}
          min)
        </Link>
      )}
      {faded > 0 && (
        <Link to="/session/revive" search={{ more: true }} className={buttonClass("ghost", "sm")}>
          Revive more
        </Link>
      )}
    </div>
  );
}

/**
 * The advanced tracks as branches (tracks-model.ts), once Jazz or Rhythm is open: each named, with its honest line
 * ("Open. Its first lessons are still being written."), and a way to its rows on the map. Absent before the U13
 * checkpoint: the core is the whole tree until then.
 */
function BranchBar({ model, onGo }: { model: OakModel; onGo: (leafId: string) => void }) {
  // Jazz and Rhythm: the branches that open at the U13 checkpoint. Arrangement & Sound has had its side lessons
  // since U03 (their own line on Today and Progress): it joins the bar once its track lessons are what comes next
  // (A1.L05 on), or the core is complete. The Course view lists all three.
  const rows = model.tracks.filter(
    (t) =>
      t.open &&
      (t.trackId !== "A" || model.core === "complete" || (t.next !== null && !/^A1\.L0[1-4]\b/.test(t.next))),
  );
  if (rows.length === 0) return null;
  const firstLeaf = (units: readonly string[]) =>
    model.layout.nodes.find((n) => units.includes(n.unit))?.id ?? null;
  return (
    <ul
      aria-label="Branches: the advanced tracks"
      className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm"
      data-testid="oak-branches"
    >
      {rows.map((t) => {
        const leaf = firstLeaf(t.openUnits);
        return (
          <li key={t.trackId} className="flex min-w-0 items-baseline gap-1.5" data-track={t.trackId}>
            <GitBranch aria-hidden className="size-3.5 shrink-0 self-center text-accent" />
            {leaf ? (
              <button
                type="button"
                onClick={() => onGo(leaf)}
                className="font-medium underline-offset-2 hover:underline"
                title={`Show ${t.title} on the map`}
              >
                {t.title}
              </button>
            ) : (
              <span className="font-medium">{t.title}</span>
            )}
            <span className="text-text-2">{t.next ? `Next: ${t.next}.` : t.note}</span>
          </li>
        );
      })}
    </ul>
  );
}

let commandSeq = 0;

function TreeBody({
  model,
  families,
  cards,
  familyStates,
  leaf,
}: { model: OakModel; leaf: string | null } & Pick<
  Parameters<typeof NodePanel>[0],
  "families" | "cards" | "familyStates"
>) {
  const { graph, layout, states, next } = model;
  const album = useAlbum();
  // Acorns: released capstones where their unit grows; B-sides (no capstone) on the ground, oldest first.
  const released = useMemo(
    () =>
      [...(album.data?.tracks ?? [])].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    [album.data],
  );
  // A leaf glints for 48 hours after the server first saw it introduced (`introducedAt`), never from `updatedAt`.
  const fresh = useMemo(() => newlyLearned([...states.values()], Date.now()), [states]);
  const [selected, setSelected] = useState<string | null>(leaf && model.layout.byId.has(leaf) ? leaf : null);
  const [showNext, setShowNext] = useState(true);
  const [command, setCommand] = useState<MapCommand | null>(null);
  const send = (kind: MapCommand["kind"], id?: string) =>
    setCommand(id === undefined ? { kind, seq: ++commandSeq } : { kind, id, seq: ++commandSeq });
  const firstNext = next.targets[0] ?? null;
  const initialId = selected ?? firstNext ?? layout.nodes[0]?.id ?? null;
  const node = selected ? graph.nodes.find((n) => n.id === selected) : undefined;
  const close = () => {
    const id = selected;
    const from = document.activeElement;
    setSelected(null);
    // Focus goes back to the leaf on the next frame — unless the learner has moved it since (a fast key after Esc,
    // such as N for what's next, must not be undone by this frame).
    if (id)
      requestAnimationFrame(() => {
        const now = document.activeElement;
        if (now !== from && now !== null && now !== document.body) return;
        document
          .querySelector<SVGGElement>(`[data-node="${CSS.escape(id)}"]`)
          ?.focus({ preventScroll: true });
      });
  };
  const goNext = () => {
    if (!firstNext) return;
    setShowNext(true);
    send("focus", firstNext);
    requestAnimationFrame(() =>
      document
        .querySelector<SVGGElement>(`[data-node="${CSS.escape(firstNext)}"]`)
        ?.focus({ preventScroll: true }),
    );
  };

  useHotkeys([
    {
      id: "oak.zoom-in",
      keys: "=|+|Shift+=",
      scope: "global",
      group: "The Oak",
      description: "Zoom in",
      run: () => send("zoom-in"),
    },
    {
      id: "oak.zoom-out",
      keys: "-",
      scope: "global",
      group: "The Oak",
      description: "Zoom out",
      run: () => send("zoom-out"),
    },
    {
      id: "oak.fit",
      keys: "0",
      scope: "global",
      group: "The Oak",
      description: "Show the whole map",
      run: () => send("fit"),
    },
    {
      id: "oak.fit-width",
      keys: "W",
      scope: "global",
      group: "The Oak",
      description: "Fit the width (reading size)",
      run: () => send("fit-width"),
    },
    {
      id: "oak.next",
      keys: "N",
      scope: "global",
      group: "The Oak",
      description: "Go to what's next",
      when: () => firstNext !== null,
      run: goNext,
    },
    {
      id: "oak.close",
      keys: "Escape",
      scope: "global",
      group: "The Oak",
      description: "Close the leaf panel",
      when: () => selected !== null,
      run: close,
    },
    // Listed for the shortcut sheet; the leaves handle these keys themselves.
    {
      id: "oak.arrows",
      keys: "ArrowUp|ArrowDown|ArrowLeft|ArrowRight",
      scope: "global",
      group: "The Oak",
      description: "Move between leaves",
      when: () => false,
      run: () => {},
    },
    {
      id: "oak.open",
      keys: "Enter",
      scope: "global",
      group: "The Oak",
      description: "Open the leaf panel",
      when: () => false,
      run: () => {},
    },
  ]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          {next.sessionId ? (
            <>
              <Button
                variant={showNext ? "primary" : "secondary"}
                size="sm"
                aria-pressed={showNext}
                icon={<RouteIcon aria-hidden className="size-4" />}
                onClick={() => setShowNext((s) => !s)}
                data-testid="whats-next-toggle"
              >
                What's next
              </Button>
              <button
                type="button"
                onClick={goNext}
                className="min-w-0 truncate text-left text-sm text-text-2 underline-offset-2 hover:text-text hover:underline"
                data-testid="whats-next"
              >
                {next.title}
                {!next.written && <span className="text-text-3"> · still being written</span>}
                {next.targets.length > 0 && (
                  <span className="text-text-3">
                    {" "}
                    · {next.kind !== "lesson" ? "checks" : next.grows ? "grows" : "deepens"}{" "}
                    {next.targets.length} {next.targets.length === 1 ? "leaf" : "leaves"}
                  </span>
                )}
              </button>
            </>
          ) : (
            <p className="text-sm text-text-2" data-testid="oak-no-next">
              {model.course === "complete"
                ? "Every limb and every branch is grown: the core and its three tracks. Reviews keep it green."
                : model.core === "complete"
                  ? "Every limb of the core is at full length. Reviews keep it green; the tracks are its open branches."
                  : "Every open lesson is done. New leaves appear as the course opens."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1" role="toolbar" aria-label="Map view">
          <IconButton
            label="Zoom out"
            shortcut="−"
            icon={<Minus aria-hidden className="size-4" />}
            onClick={() => send("zoom-out")}
          />
          <IconButton
            label="Zoom in"
            shortcut="+"
            icon={<Plus aria-hidden className="size-4" />}
            onClick={() => send("zoom-in")}
          />
          <IconButton
            label="Fit the width"
            shortcut="W"
            icon={<MoveHorizontal aria-hidden className="size-4" />}
            onClick={() => send("fit-width")}
          />
          <IconButton
            label="Show the whole map"
            shortcut="0"
            icon={<Maximize2 aria-hidden className="size-4" />}
            onClick={() => send("fit")}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Legend quiet={model.quiet.on} />
        <ReviveBar model={model} />
      </div>
      <BranchBar
        model={model}
        onGo={(id) => {
          send("focus", id);
          requestAnimationFrame(() =>
            document
              .querySelector<SVGGElement>(`[data-node="${CSS.escape(id)}"]`)
              ?.focus({ preventScroll: true }),
          );
        }}
      />
      {/* The branch bar is one more line above the canvas: the canvas gives it up, the page never scrolls. */}
      <div
        className={clsx(
          "relative min-h-[380px]",
          model.tracks.some((t) => t.open && t.trackId !== "A")
            ? "h-[calc(100dvh-298px)]"
            : "h-[calc(100dvh-262px)]",
        )}
      >
        <OakMap
          releasedTracks={released}
          newlyLearned={fresh}
          layout={layout}
          states={states}
          next={next}
          showNext={showNext}
          selectedId={selected}
          panelOpen={node !== undefined}
          onSelect={setSelected}
          onClose={close}
          command={command}
          unitProgress={model.units}
          openUnits={model.openUnits}
          initialId={initialId}
        />
        {node && (
          <div
            className="absolute top-px right-px bottom-px z-20 overflow-hidden rounded-r-card"
            style={{ width: PANEL_WIDTH }}
          >
            <NodePanel
              node={node}
              state={states.get(node.id)}
              states={states}
              graph={graph}
              families={families}
              cards={cards}
              {...(familyStates ? { familyStates } : {})}
              lessonStatus={model.lessonStatus}
              lessonTitle={model.lessonTitle}
              authored={model.authored}
              reviveSec={model.reviveSec}
              quiet={model.quiet}
              isNext={next.targets.includes(node.id)}
              // The open branch this leaf's unit grows on (a core unit never is one); the panel names the leaf's
              // lesson when it is written, else says the track's own line.
              branch={model.openUnits.get(node.unit) ?? null}
              onSelect={(id) => {
                setSelected(id);
                send("focus", id);
              }}
              onClose={close}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function OakTree({ leaf = null }: { leaf?: string | null }) {
  const { content, map, families, model } = useOak();
  if (content.isError) return <ErrorState error={content.error} onRetry={() => void content.refetch()} />;
  if (!model || map.isPending) return <LoadingState rows={4} label="Loading the map" />;
  if (model.layout.nodes.length === 0)
    return (
      <EmptyState title="No skills yet">
        The content build has no skill graph. Run <code>bun run content:build</code> and reload.
      </EmptyState>
    );
  return (
    <>
      {map.isError && (
        <p className="mb-2 text-sm text-text-2" role="status">
          Your progress could not be loaded, so every leaf shows as not open yet.
        </p>
      )}
      <TreeBody
        model={model}
        families={content.data?.families ?? []}
        cards={families.data?.cards ?? []}
        familyStates={families.data?.families ?? []}
        leaf={leaf}
      />
    </>
  );
}
