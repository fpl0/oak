// Oak 2.0 W4 F6 "Finish it anyway" (DeSantis, Fail Better): a piece about to be left half done is finished anyway,
// quickly, then kept on the Shelf. Three steps in one dialog: (1) Fill it all — every part plays in every section
// (`fillItAllCode` for a piece with no sections, `fillTheRest` for a half-arranged one), one undoable change, then
// "Play it through"; (2) Carve — a grid of parts × sections, each cell a toggle that writes `carveCell` as code;
// (3) Then the Shelf — a sketch goes on the Shelf as a B-side kept off the album; a capstone is released with "Put it
// on the Shelf" ticked. Opened from the editor header (`FinishAnywaySlot`), from the capstone card, and (wired by the
// W4 integrator in SketchEditor) before Delete or Archive, where a first screen asks first. It describes; it never
// scores (PLAN §2).
import type { SketchDetail } from "@oak/api";
import { labelledLines } from "@oak/api";
import { Archive, Layers, Play, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useShelveSketch } from "../album/shelf-queries.ts";
import { errorWords } from "../lib/error-words.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Callout, SegmentedControl } from "../ui/kit/Controls.tsx";
import { Dialog } from "../ui/kit/Dialog.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { readLength } from "./draft.ts";
import type { EditorSlotProps } from "./editor-slots.ts";
import { arrangementState, carveCell, FINISH_COPY, fillTheRest, sectionGrid } from "./finish-anyway.ts";
import { FILL_SECTIONS, type FillSections, fillItAllCode } from "./starts.ts";

export type FinishTarget =
  | { kind: "sketch"; sketch: SketchDetail; liveCode: string }
  | { kind: "capstone"; title: string };

export interface FinishAnywayDialogProps {
  open: boolean;
  onClose(): void;
  /** The code as it is now in the editor. */
  code: string;
  /** Writes code into the editor as one undoable change. */
  applyCode(code: string): void;
  target: FinishTarget;
  /** Delete or Archive was asked for: a first screen offers to finish it anyway, or to go on (`goOn`). */
  abandon?: { kind: "delete" | "archive"; goOn(): void };
  /** Plays the piece from the top (the editor's play); the button is hidden without it. */
  play?: () => void;
}

const fillWords = {
  "has-sections": FINISH_COPY.fillWhole,
  "no-parts": FINISH_COPY.carveNone,
  "no-sections": FINISH_COPY.fillNone,
  "nothing-to-fill": FINISH_COPY.fillWhole,
  "mixed-sections": FINISH_COPY.fillMixed,
} as const;

export function FinishAnywayDialog({
  open,
  onClose,
  code,
  applyCode,
  target,
  abandon,
  play,
}: FinishAnywayDialogProps) {
  const ids = useId();
  // The code the dialog last wrote, until the editor reports it back through `code`.
  const [current, setCurrent] = useState(code);
  useEffect(() => setCurrent(code), [code]);
  const [asked, setAsked] = useState(abandon === undefined);
  useEffect(() => {
    if (open) setAsked(abandon === undefined);
  }, [open, abandon]);
  const [sections, setSections] = useState<FillSections>(FILL_SECTIONS.preselected as FillSections);
  const [filled, setFilled] = useState(false);
  const sketchTitle = target.kind === "sketch" ? target.sketch.title : target.title;
  const [title, setTitle] = useState(sketchTitle);
  const [shelvedTitle, setShelvedTitle] = useState<string | null>(null);
  const shelve = useShelveSketch();

  const write = (next: string) => {
    if (next === current) return;
    applyCode(next);
    setCurrent(next);
  };

  const state = arrangementState(current);
  const bars = target.kind === "sketch" ? (readLength(target.sketch.id) ?? 4) : 4;
  const fillNow = (): void => {
    const r = state === "none" ? fillItAllCode(current, { sections, bars }) : fillTheRest(current);
    if ("code" in r) {
      write(r.code);
      setFilled(true);
    }
  };
  const fillProblem = (() => {
    if (state === "whole") return null;
    const r = state === "none" ? fillItAllCode(current, { sections, bars }) : fillTheRest(current);
    return "error" in r ? fillWords[r.error] : null;
  })();
  const grid = sectionGrid(current);

  const doShelve = async () => {
    if (target.kind !== "sketch" || title.trim() === "") return;
    try {
      const track = await shelve.mutateAsync({ sketch: target.sketch, liveCode: current, title });
      setShelvedTitle(track.title);
    } catch (e) {
      // The sketch is untouched; the learner can try again.
      toast.error(FINISH_COPY.shelveFailed, errorWords(e));
    }
  };

  if (!asked && abandon) {
    const del = abandon.kind === "delete";
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={del ? FINISH_COPY.askDelete : FINISH_COPY.askArchive}
        description={FINISH_COPY.shelfLine}
        footer={
          <>
            <Button
              variant={del ? "danger" : "secondary"}
              icon={
                del ? <Trash2 aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />
              }
              onClick={() => {
                onClose();
                abandon.goOn();
              }}
              data-testid="finish-anyway-go-on"
            >
              {del ? FINISH_COPY.goOnDelete : FINISH_COPY.goOnArchive}
            </Button>
            <Button variant="primary" onClick={() => setAsked(true)} data-testid="finish-anyway-start">
              {FINISH_COPY.finish}
            </Button>
          </>
        }
      >
        <span data-testid="finish-anyway-ask" />
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={FINISH_COPY.title}
      description={FINISH_COPY.shelfLine}
      className="w-[min(94vw,44rem)]"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {FINISH_COPY.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-5" data-testid="finish-anyway">
        <section aria-labelledby={`${ids}-fill`} className="flex flex-col gap-2">
          <h3 id={`${ids}-fill`} className="font-medium">
            {FINISH_COPY.fillStep}
          </h3>
          {state === "whole" ? (
            <p className="text-sm text-text-2">{filled ? FINISH_COPY.filled : FINISH_COPY.fillWhole}</p>
          ) : (
            <>
              <p className="text-sm text-text-2">
                {state === "none" ? FINISH_COPY.fillNone : FINISH_COPY.fillHalf}
              </p>
              {state === "none" ? (
                <SegmentedControl<string>
                  label="Sections"
                  size="sm"
                  value={String(sections)}
                  options={FILL_SECTIONS.choices.map((n) => ({ value: String(n), label: String(n) }))}
                  onChange={(v) => setSections(Number(v) as FillSections)}
                />
              ) : null}
              {fillProblem && fillProblem !== FINISH_COPY.fillNone ? (
                <p className="text-sm text-text-2" role="status">
                  {fillProblem}
                </p>
              ) : null}
              <Button
                size="sm"
                variant="primary"
                className="self-start"
                icon={<Layers aria-hidden className="size-4" />}
                disabled={fillProblem !== null && fillProblem !== FINISH_COPY.fillNone}
                onClick={fillNow}
                data-testid="finish-fill"
              >
                {FINISH_COPY.fill}
              </Button>
            </>
          )}
          {play ? (
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              icon={<Play aria-hidden className="size-4" />}
              onClick={play}
              data-testid="finish-play"
            >
              {FINISH_COPY.play}
            </Button>
          ) : null}
        </section>

        <section aria-labelledby={`${ids}-carve`} className="flex flex-col gap-2">
          <h3 id={`${ids}-carve`} className="font-medium">
            {FINISH_COPY.carveStep}
          </h3>
          {grid ? (
            <>
              <p className="text-sm text-text-2">{FINISH_COPY.carveLine}</p>
              <div className="overflow-x-auto">
                <table className="text-sm" data-testid="carve-grid">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">
                        <span className="sr-only">Part</span>
                      </th>
                      {grid.sections.map((s, i) => (
                        <th key={i} scope="col" className="px-2 py-1 text-center font-medium">
                          {i + 1}
                          <span className="block text-xs font-normal text-text-3">
                            {s.bars} {s.bars === 1 ? "bar" : "bars"}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.parts.map((part, p) => (
                      <tr key={part}>
                        <th scope="row" className="px-2 py-1 text-left font-mono font-normal">
                          {part}
                        </th>
                        {grid.sections.map((_, s) => {
                          const plays = grid.plays[p]?.[s] ?? false;
                          const next = carveCell(current, part, s, !plays);
                          return (
                            <td key={s} className="px-2 py-1 text-center">
                              <input
                                type="checkbox"
                                className="accent-[var(--oak-accent)]"
                                checked={plays}
                                disabled={next === current}
                                aria-label={`${part}, section ${s + 1}: ${FINISH_COPY.playsHere}`}
                                onChange={() => write(next)}
                                data-testid={`carve-${part}-${s}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-2">{FINISH_COPY.carveNone}</p>
          )}
        </section>

        <section aria-labelledby={`${ids}-shelf`} className="flex flex-col gap-2">
          <h3 id={`${ids}-shelf`} className="font-medium">
            {FINISH_COPY.shelfStep}
          </h3>
          {target.kind === "capstone" ? (
            <p className="text-sm text-text-2">{FINISH_COPY.capstoneShelf}</p>
          ) : shelvedTitle !== null ? (
            <Callout tone="success" title={FINISH_COPY.shelved}>
              <span data-testid="finish-shelved">{shelvedTitle}</span>
            </Callout>
          ) : (
            <>
              <label htmlFor={`${ids}-title`} className="text-sm font-medium">
                {FINISH_COPY.titleLabel}
              </label>
              <input
                id={`${ids}-title`}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 rounded-control border border-border bg-surface px-2"
                data-testid="shelf-title"
              />
              {shelve.isError ? (
                <p className="text-sm text-text-2" role="status">
                  {FINISH_COPY.shelveFailed}
                </p>
              ) : null}
              <Button
                variant="primary"
                className="self-start"
                loading={shelve.isPending}
                disabled={title.trim() === ""}
                onClick={() => void doShelve()}
                data-testid="shelve"
              >
                {shelve.isPending ? FINISH_COPY.shelving : FINISH_COPY.shelve}
              </Button>
            </>
          )}
        </section>
      </div>
    </Dialog>
  );
}

/**
 * The editor header's "Finish it anyway…" (W4 Task 6 Step B2 registers it as `finish-anyway`, place `header`):
 * shown while the piece has parts and is not fully in sections, never in a jam.
 */
export function FinishAnywaySlot({ sketch, liveCode, jam, editor, applyCode }: EditorSlotProps) {
  const [open, setOpen] = useState(false);
  const hasParts = labelledLines(liveCode).some((l) => !l.muted);
  if (jam || !hasParts || arrangementState(liveCode) === "whole") {
    if (!open) return null;
  }
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} data-testid="finish-anyway-open">
        {FINISH_COPY.open}
      </Button>
      {open ? (
        <FinishAnywayDialog
          open={open}
          onClose={() => setOpen(false)}
          code={liveCode}
          applyCode={applyCode}
          target={{ kind: "sketch", sketch, liveCode }}
          play={() => {
            if (editor && !editor.disposed) void editor.play();
          }}
        />
      ) : null}
    </>
  );
}
