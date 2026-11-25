// Oak 2.0 W3 (PLAN §4 S5 "Creating Variation 1–3"; editor slot `variation`, place `aside`): siblings and generations.
//   - Siblings: copies of one version (the one the editor shows when the learner starts), each changing one dimension
//     the learner picks. "Change it" puts the parent's code in the editor; the learner edits and Runs as usual; "Keep
//     this sibling" saves the draft as a child of the parent. Each kept sibling is described against its parent after
//     Oak has read both (`readPiece` + `diffDimensions`). "Play them back to back" plays the parent, then each sibling.
//   - Generations: a chain where each generation changes one dimension against the one before. The parent of the next
//     generation is the chain's tip, so Runs in between never become parents. The chain view lists the chain first to
//     last (`sketches.lineage`) with a note where a generation changes back what its parent changed.
// It describes and never scores (PLAN §2); in Jam the describe lines and notes are hidden, the buttons stay.
import { SKETCH_DIMENSIONS, type SketchDimension, type SketchVersion } from "@oak/api";
import { diffDimensions, sectionsFromAst } from "@oak/grader";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { errorWords } from "../../lib/error-words.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Tabs, tabPanelProps } from "../../ui/kit/Tabs.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { readLength } from "../draft.ts";
import type { EditorSlotProps } from "../editor-slots.ts";
import { needsReview } from "../model.ts";
import { readPiece } from "../piece-read.ts";
import { BackToBack } from "./BackToBack.tsx";
import { lineageNotBuilt, localChain, useLineage } from "./lineage-queries.ts";
import {
  chainTip,
  DIMENSION_NAMES,
  describeChange,
  generationsOnly,
  keepFields,
  readVariation,
  siblingsOf,
  undoNote,
  type VariationMode,
  type VariationState,
  VARIATION_WORDS as W,
  writeVariation,
} from "./model.ts";
import type { SequenceItem } from "./sequence.ts";

type Tab = "siblings" | "generations";
type Ctx = Pick<EditorSlotProps, "sketch" | "meter" | "keySpec">;

/** The bars Oak reads and plays of a version: its `arrange()` total, else the sketch's loop length. */
function barsOf(code: string, sketchId: string): number {
  try {
    const ast = sectionsFromAst(code);
    if (ast && "totalBars" in ast && ast.totalBars > 0) return ast.totalBars;
  } catch {
    // unreadable code: the loop length
  }
  return readLength(sketchId) ?? 4;
}

const itemOf = (v: SketchVersion, label: string, ctx: Ctx): SequenceItem => ({
  id: `v${v.version}`,
  label,
  code: v.code,
  bars: barsOf(v.code, ctx.sketch.id),
  meter: v.meter ?? ctx.meter,
});

export function VariationPanel(props: EditorSlotProps) {
  const { sketch, version, liveCode, jam, editor, applyCode, saveVersion } = props;
  const [state, setStateRaw] = useState<VariationState>(() => readVariation(sketch.id));
  const setState = (next: VariationState) => {
    setStateRaw(next);
    writeVariation(sketch.id, next);
  };
  const [tab, setTab] = useState<Tab>(state.draft?.mode === "generation" ? "generations" : "siblings");
  const [picking, setPicking] = useState<VariationMode | null>(null);
  const [pick, setPick] = useState<SketchDimension | null>(null);
  const [keeping, setKeeping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const idBase = useId();
  const versions = sketch.versions;
  const byVersion = new Map(versions.map((v) => [v.version, v]));
  // The editor holds code that is not the version it shows: a draft cannot start from it until a Run saves it.
  const unsaved = liveCode !== version.code;
  const draft = state.draft;

  const startDraft = (mode: VariationMode) => {
    if (pick === null) return;
    const next: VariationState = { ...state };
    let parentVersion: number;
    if (mode === "sibling") {
      parentVersion = state.siblingParent ?? version.version;
      next.siblingParent = parentVersion;
    } else {
      const start = state.chainStart ?? version.version;
      parentVersion = chainTip(generationsOnly(versions), start);
      next.chainStart = start;
    }
    const parent = byVersion.get(parentVersion);
    if (!parent) return;
    if (needsReview(parent)) {
      setNotice(W.imported);
      return;
    }
    setNotice(null);
    applyCode(parent.code);
    setState({ ...next, draft: { mode, parentVersion, dimension: pick } });
    setPicking(null);
    setPick(null);
  };

  const keep = async () => {
    if (!draft) return;
    let fields: ReturnType<typeof keepFields>;
    try {
      fields = keepFields(draft, versions);
    } catch {
      setState({ ...state, draft: null });
      return;
    }
    setKeeping(true);
    const note =
      draft.mode === "sibling"
        ? W.siblingNote(draft.dimension)
        : W.generationNote(fields.generation, draft.dimension);
    try {
      const saved = await saveVersion({ ...fields, note });
      if (saved) {
        setState({ ...readVariation(sketch.id), draft: null });
        toast.success(draft.mode === "sibling" ? W.keptSibling : W.keptGeneration, `v${saved.version}`);
      }
    } catch (e) {
      toast.error(W.keepError, errorWords(e));
    } finally {
      setKeeping(false);
    }
  };

  const picker = (mode: VariationMode) => {
    const needsSave =
      unsaved && (mode === "sibling" ? state.siblingParent === null : state.chainStart === null);
    if (needsSave)
      return (
        <div className="flex flex-col gap-1.5 text-sm text-text-2" data-testid="variation-save-first">
          <p>{W.saveFirst}</p>
          <div>
            <Button size="sm" disabled={!editor} onClick={() => void editor?.play()}>
              {W.runToSave}
            </Button>
          </div>
        </div>
      );
    return (
      <fieldset
        className="m-0 flex flex-col gap-1.5 rounded-control border border-border p-2 text-sm"
        data-testid="variation-pick"
      >
        <legend className="px-1 font-medium text-text-2">{W.pickDimension}</legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {SKETCH_DIMENSIONS.map((d) => (
            <label key={d} className="flex items-center gap-1 text-text">
              <input
                type="radio"
                name={`${idBase}-dimension`}
                checked={pick === d}
                onChange={() => setPick(d)}
                data-testid={`variation-dimension-${d}`}
              />
              {DIMENSION_NAMES[d]}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={pick === null}
            onClick={() => startDraft(mode)}
            data-testid="variation-change-it"
          >
            {W.changeIt}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPicking(null);
              setPick(null);
            }}
          >
            {W.notNow}
          </Button>
        </div>
      </fieldset>
    );
  };

  const draftBox = (mode: VariationMode) => {
    if (!draft || draft.mode !== mode) return null;
    let generation: number | null = null;
    try {
      generation = keepFields(draft, versions).generation;
    } catch {
      generation = null;
    }
    return (
      <div
        className="flex flex-col gap-1.5 rounded-control border border-accent/40 bg-lane-in p-2 text-sm"
        data-testid="variation-draft"
        data-mode={mode}
      >
        <p className="font-medium text-text">
          {W.changing(draft.dimension)}{" "}
          <span className="font-normal text-text-3">{W.parentOf(draft.parentVersion)}</span>
        </p>
        <p className="text-text-2">{W.changeHint}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            loading={keeping}
            onClick={() => void keep()}
            data-testid={mode === "sibling" ? "variation-keep-sibling" : "variation-keep-generation"}
          >
            {mode === "sibling" ? W.keepSibling : W.keepGeneration(generation ?? 1)}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setState({ ...state, draft: null })}>
            {W.dropDraft}
          </Button>
        </div>
      </div>
    );
  };

  const startButton = (mode: VariationMode) =>
    draft === null && picking !== mode ? (
      <div>
        <Button
          size="sm"
          onClick={() => {
            setPicking(mode);
            setPick(null);
          }}
          data-testid={mode === "sibling" ? "variation-add-sibling" : "variation-next-generation"}
        >
          {mode === "sibling" ? W.addSibling : W.nextGeneration}
        </Button>
      </div>
    ) : null;

  const ctx: Ctx = { sketch, meter: props.meter, keySpec: props.keySpec };

  return (
    <section
      aria-labelledby={`${idBase}-title`}
      className="flex flex-col gap-2"
      data-testid="variation-panel"
    >
      <h2 id={`${idBase}-title`} className="font-sans text-sm font-semibold text-text-2">
        {W.title}
      </h2>
      <Tabs
        label={W.title}
        idBase={idBase}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPicking(null);
          setNotice(null);
        }}
        items={[
          { value: "siblings", label: W.siblingsTab },
          { value: "generations", label: W.generationsTab },
        ]}
      />
      {notice ? (
        <p className="text-sm text-text-2" role="status">
          {notice}
        </p>
      ) : null}
      {tab === "siblings" ? (
        <div {...tabPanelProps(idBase, "siblings")} className="flex flex-col gap-2 outline-none">
          <p className="text-sm text-text-3">{W.siblingsIntro}</p>
          {startButton("sibling")}
          {picking === "sibling" && draft === null ? picker("sibling") : null}
          {draftBox("sibling")}
          <Siblings
            ctx={ctx}
            parentVersion={state.siblingParent}
            jam={jam}
            onUseCurrent={
              draft === null &&
              !unsaved &&
              state.siblingParent !== null &&
              state.siblingParent !== version.version
                ? () => setState({ ...state, siblingParent: version.version })
                : null
            }
          />
        </div>
      ) : (
        <div {...tabPanelProps(idBase, "generations")} className="flex flex-col gap-2 outline-none">
          <p className="text-sm text-text-3">{W.generationsIntro}</p>
          {startButton("generation")}
          {picking === "generation" && draft === null ? picker("generation") : null}
          {draftBox("generation")}
          <Chain
            ctx={ctx}
            chainStart={state.chainStart}
            jam={jam}
            onNewChain={
              draft === null && !unsaved && state.chainStart !== null && state.chainStart !== version.version
                ? () => setState({ ...state, chainStart: version.version })
                : null
            }
          />
        </div>
      )}
    </section>
  );
}

function Siblings({
  ctx,
  parentVersion,
  jam,
  onUseCurrent,
}: {
  ctx: Ctx;
  parentVersion: number | null;
  jam: boolean;
  onUseCurrent: (() => void) | null;
}) {
  const parent =
    parentVersion === null ? undefined : ctx.sketch.versions.find((v) => v.version === parentVersion);
  if (!parent) return <p className="text-sm text-text-3">{W.noSiblings}</p>;
  const siblings = siblingsOf(ctx.sketch.versions, parent.version);
  const items = [
    itemOf(parent, W.parentIs, ctx),
    ...siblings.map((s, i) => itemOf(s, W.siblingRow(i + 1, s.dimension ?? "sound"), ctx)),
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-2">{W.parentOf(parent.version)}</p>
      {siblings.length === 0 ? (
        <p className="text-sm text-text-3">{W.noSiblings}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {siblings.map((s, i) => (
            <li
              key={s.version}
              className="rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm"
              data-testid="sibling-row"
              data-version={s.version}
            >
              <p className="font-medium text-text">
                {W.siblingRow(i + 1, s.dimension ?? "sound")}{" "}
                <span className="font-normal text-text-3">v{s.version}</span>
              </p>
              {!jam && s.dimension ? (
                <ChangeLine ctx={ctx} parent={parent} child={s} picked={s.dimension} />
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {siblings.length > 0 ? <BackToBack items={items} playLabel={W.playSiblings} /> : null}
      {onUseCurrent ? (
        <div>
          <Button size="sm" variant="ghost" onClick={onUseCurrent}>
            {W.useCurrent}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** "You changed the rhythm.", after Oak has read the parent and the child (each read once, then cached). */
function ChangeLine({
  ctx,
  parent,
  child,
  picked,
}: {
  ctx: Ctx;
  parent: SketchVersion;
  child: SketchVersion;
  picked: SketchDimension;
}) {
  const readOf = (v: SketchVersion) => {
    const meter = v.meter ?? ctx.meter;
    const key = v.key ?? ctx.keySpec;
    const bars = barsOf(v.code, ctx.sketch.id);
    return {
      queryKey: [
        "oak2",
        "variation-read",
        v.sketchId,
        v.version,
        meter,
        key?.tonic ?? "",
        key?.mode ?? "",
        bars,
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) => readPiece(v.code, { meter, key, bars }, signal),
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    } as const;
  };
  const a = useQuery(readOf(parent));
  const b = useQuery(readOf(child));
  let text: string = W.reading;
  if (a.isSuccess && b.isSuccess) {
    text = a.data && b.data ? describeChange(picked, diffDimensions(a.data.view, b.data.view)) : W.unreadable;
  } else if (a.isError || b.isError) text = W.unreadable;
  return (
    <p className="text-text-2" data-testid="variation-change">
      {text}
    </p>
  );
}

function Chain({
  ctx,
  chainStart,
  jam,
  onNewChain,
}: {
  ctx: Ctx;
  chainStart: number | null;
  jam: boolean;
  onNewChain: (() => void) | null;
}) {
  const versions = ctx.sketch.versions;
  const tip = chainStart === null ? null : chainTip(generationsOnly(versions), chainStart);
  const hasChain = tip !== null && tip !== chainStart;
  const lineage = useLineage(ctx.sketch.id, hasChain ? tip : null);
  if (!hasChain || tip === null) return <p className="text-sm text-text-3">{W.noChain}</p>;

  type Row = {
    version: number;
    generation: number | null;
    dimension: SketchDimension | null;
    parentVersion: number | null;
    undoesGrandparent: boolean;
  };
  let rows: Row[];
  let status: string | null = null;
  if (lineage.data) rows = lineage.data.versions.map((v) => ({ ...v }));
  else {
    rows = localChain(versions, tip).map((v) => ({
      version: v.version,
      generation: v.generation ?? null,
      dimension: v.dimension ?? null,
      parentVersion: v.parentVersion ?? null,
      undoesGrandparent: false,
    }));
    if (lineage.isError) status = lineageNotBuilt(lineage.error) ? W.chainPending : W.chainUnread;
  }
  const byVersion = new Map(versions.map((v) => [v.version, v]));
  const items: SequenceItem[] = [];
  for (const r of rows) {
    const v = byVersion.get(r.version);
    if (v)
      items.push(
        itemOf(v, r.generation === null ? W.startOf(r.version) : W.chainRow(r.generation, r.dimension), ctx),
      );
  }
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1" data-testid="chain-list">
        {rows.map((r, i) => {
          const prev = rows[i - 1];
          const note =
            jam || r.generation === null || !prev
              ? null
              : undoNote(
                  { ...r, takeState: null, createdAt: "" },
                  { ...prev, takeState: null, createdAt: "" },
                );
          return (
            <li
              key={r.version}
              className="rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm"
              data-testid="chain-row"
              data-version={r.version}
              data-generation={r.generation ?? undefined}
            >
              <p className="font-medium text-text">
                {r.generation === null ? W.startOf(r.version) : W.chainRow(r.generation, r.dimension)}{" "}
                {r.generation === null ? null : <span className="font-normal text-text-3">v{r.version}</span>}
              </p>
              {note ? (
                <p className="text-text-2" data-testid="chain-undo-note">
                  {note}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {status && !jam ? (
        <p className="text-sm text-text-3" role="status" data-testid="chain-status">
          {status}
        </p>
      ) : null}
      <BackToBack items={items} playLabel={W.playChain} />
      {onNewChain ? (
        <div>
          <Button size="sm" variant="ghost" onClick={onNewChain}>
            {W.newChain}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
