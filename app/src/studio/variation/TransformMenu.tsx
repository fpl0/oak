// Oak 2.0 W3 (PLAN §4 S5 "Transforms", "Derive a part", "Misuse cards"; editor slot `transforms`, place `toolbar`):
// the tools that rewrite the line under the cursor. Each writes plain Strudel into the editor as one undoable change
// (`applyCode`, the tutor's Apply path); one that would change nothing says why and writes nothing. Locked tools are
// allowed: the next Run's lint raises the liner flag. Without a labelled line under the cursor the button says so.
import { labelledLines } from "@oak/content-kit";
import { Shuffle } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../../ui/kit/Button.tsx";
import { Dialog } from "../../ui/kit/Dialog.tsx";
import type { EditorSlotProps } from "../editor-slots.ts";
import {
  DERIVE_WORDS,
  deriveRhythm,
  drumsAsMelody,
  MELODY_DRUMS,
  type MelodyDrum,
  melodyAsDrums,
} from "./derive.ts";
import { applyTransform, TRANSFORM_MENU_WORDS, TRANSFORMS, type TransformId } from "./transforms.ts";

const T = TRANSFORM_MENU_WORDS;

const TRANSPOSE_AMOUNTS = Array.from({ length: 25 }, (_, i) => i - 12).filter((n) => n !== 0);
const byId = (id: TransformId) => TRANSFORMS.find((t) => t.id === id);

export function TransformMenu({ liveCode, cursorLabel, keySpec, applyCode }: EditorSlotProps) {
  const [open, setOpen] = useState(false);
  // The line the menu was opened on: the cursor leaves the editor while the dialog is open.
  const [label, setLabel] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [transpose, setTranspose] = useState<number | null>(null);
  const [rotate, setRotate] = useState(1);
  const [notesFrom, setNotesFrom] = useState<string>("");
  const [drum, setDrum] = useState<MelodyDrum | null>(null);
  const idBase = useId();

  const close = () => {
    setOpen(false);
    setStatus(null);
  };
  const run = (id: TransformId, amount?: number) => {
    if (label === null) return;
    const r = applyTransform(liveCode, label, amount === undefined ? { id } : { id, amount }, {
      key: keySpec,
    });
    if ("unchanged" in r) {
      setStatus(r.unchanged);
      return;
    }
    applyCode(r.code);
    close();
  };
  const derive = (r: { code: string; label: string } | { unchanged: string }) => {
    if ("unchanged" in r) {
      setStatus(r.unchanged);
      return;
    }
    applyCode(r.code);
    close();
  };

  const others = labelledLines(liveCode)
    .map((l) => l.label)
    .filter((l, i, all) => l !== label && all.indexOf(l) === i);
  const plain = TRANSFORMS.filter((t) => !t.misuse);
  const misuse = TRANSFORMS.filter((t) => t.misuse);
  const simple = (id: TransformId, amount?: number) => {
    const t = byId(id);
    if (!t) return null;
    return (
      <li key={id} className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => run(id, amount)} data-testid={`transform-${id}`}>
            {t.label}
          </Button>
        </div>
        <p className="text-sm text-text-3">{t.detail}</p>
      </li>
    );
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        icon={<Shuffle aria-hidden className="size-4" />}
        disabled={cursorLabel === null}
        title={cursorLabel === null ? T.noLine : T.title(cursorLabel)}
        onClick={() => {
          setLabel(cursorLabel);
          setStatus(null);
          setTranspose(null);
          setRotate(1);
          setNotesFrom("");
          setDrum(null);
          setOpen(true);
        }}
        data-testid="transforms-open"
      >
        {T.button}
      </Button>
      {cursorLabel === null ? (
        <span className="text-sm text-text-3" data-testid="transforms-no-line">
          {T.noLine}
        </span>
      ) : null}
      <Dialog
        open={open}
        onClose={close}
        title={label === null ? T.button : T.title(label)}
        description={T.intro}
      >
        <div className="flex max-h-[65vh] flex-col gap-4 overflow-auto pr-1" data-testid="transform-menu">
          {status ? (
            <p
              className="rounded-control bg-surface-2 px-2.5 py-1.5 text-sm text-text"
              role="status"
              data-testid="transform-status"
            >
              {status}
            </p>
          ) : null}

          <section aria-labelledby={`${idBase}-turn`} className="flex flex-col gap-2">
            <h3 id={`${idBase}-turn`} className="text-sm font-semibold text-text-2">
              {T.turnHeading}
            </h3>
            <ul className="flex flex-col gap-2">
              <li className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-sm text-text-2">
                    {T.transposeBy}
                    <select
                      value={transpose ?? ""}
                      onChange={(e) => setTranspose(e.target.value === "" ? null : Number(e.target.value))}
                      className="h-8 rounded-control border border-border bg-surface px-1.5 text-text"
                      data-testid="transform-transpose-amount"
                    >
                      <option value="">{T.pick}</option>
                      {TRANSPOSE_AMOUNTS.map((n) => (
                        <option key={n} value={n}>
                          {n > 0 ? `+${n}` : n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    size="sm"
                    disabled={transpose === null}
                    onClick={() => run("transpose", transpose ?? undefined)}
                    data-testid="transform-transpose"
                  >
                    {byId("transpose")?.label}
                  </Button>
                </div>
                <p className="text-sm text-text-3">{byId("transpose")?.detail}</p>
              </li>
              {simple("invert")}
              <li className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => run("retrograde")} data-testid="transform-retrograde">
                    {byId("retrograde")?.label}
                  </Button>
                  <Button size="sm" onClick={() => run("rev")} data-testid="transform-rev">
                    {byId("rev")?.label}
                  </Button>
                </div>
                <p className="text-sm text-text-3">{byId("retrograde")?.detail}</p>
                <p className="text-sm text-text-3">{byId("rev")?.detail}</p>
                <p className="text-sm text-text-2">{T.retroVsMirror}</p>
              </li>
              <li className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-sm text-text-2">
                    {T.rotateBy}
                    <input
                      type="number"
                      min={-16}
                      max={16}
                      step={1}
                      value={rotate}
                      onChange={(e) => setRotate(Math.trunc(Number(e.target.value)) || 1)}
                      className="h-8 w-16 rounded-control border border-border bg-surface px-1.5 text-text"
                      data-testid="transform-rotate-amount"
                    />
                  </label>
                  <Button size="sm" onClick={() => run("rotate", rotate)} data-testid="transform-rotate">
                    {byId("rotate")?.label}
                  </Button>
                </div>
                <p className="text-sm text-text-3">{byId("rotate")?.detail}</p>
              </li>
              <li className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-text-2">{byId("shift")?.label}:</span>
                  <Button size="sm" onClick={() => run("shift", 8)} data-testid="transform-shift-8">
                    {T.eighth}
                  </Button>
                  <Button size="sm" onClick={() => run("shift", 4)} data-testid="transform-shift-4">
                    {T.quarter}
                  </Button>
                </div>
                <p className="text-sm text-text-3">{byId("shift")?.detail}</p>
              </li>
              {plain.filter((t) => t.id === "snap" || t.id === "harmony").map((t) => simple(t.id))}
            </ul>
          </section>

          <section aria-labelledby={`${idBase}-misuse`} className="flex flex-col gap-2">
            <h3 id={`${idBase}-misuse`} className="text-sm font-semibold text-text-2">
              {T.misuseHeading}
            </h3>
            <p className="text-sm text-text-3">{T.misuseIntro}</p>
            <ul className="flex flex-col gap-2">{misuse.map((t) => simple(t.id))}</ul>
          </section>

          <section aria-labelledby={`${idBase}-derive`} className="flex flex-col gap-2">
            <h3 id={`${idBase}-derive`} className="text-sm font-semibold text-text-2">
              {DERIVE_WORDS.heading}
            </h3>
            <p className="text-sm text-text-3">{DERIVE_WORDS.sourcesStay}</p>
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-text">{DERIVE_WORDS.rhythmOn}</span>
                {others.length === 0 ? (
                  <span className="text-sm text-text-3">{T.noOther}</span>
                ) : (
                  <>
                    <label className="flex items-center gap-1 text-sm text-text-2">
                      {DERIVE_WORDS.pickNotes}
                      <select
                        value={notesFrom}
                        onChange={(e) => setNotesFrom(e.target.value)}
                        className="h-8 rounded-control border border-border bg-surface px-1.5 font-mono text-text"
                        data-testid="derive-notes-from"
                      >
                        <option value="">{T.pick}</option>
                        {others.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      size="sm"
                      disabled={notesFrom === "" || label === null}
                      onClick={() =>
                        label !== null && derive(deriveRhythm(liveCode, { rhythmFrom: label, notesFrom }))
                      }
                      data-testid="derive-rhythm"
                    >
                      {T.write}
                    </Button>
                  </>
                )}
              </div>
              <p className="text-sm text-text-3">{DERIVE_WORDS.rhythmOnDetail}</p>
            </div>
            <div className="flex flex-col gap-0.5">
              <div>
                <Button
                  size="sm"
                  disabled={label === null}
                  onClick={() => label !== null && derive(drumsAsMelody(liveCode, label, keySpec))}
                  data-testid="derive-drums-as-tune"
                >
                  {DERIVE_WORDS.drumsAsTune}
                </Button>
              </div>
              <p className="text-sm text-text-3">{DERIVE_WORDS.drumsAsTuneDetail}</p>
            </div>
            <fieldset className="m-0 flex flex-col gap-0.5 border-0 p-0">
              <legend className="sr-only">{DERIVE_WORDS.pickDrum}</legend>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-text-2">{DERIVE_WORDS.pickDrum}</span>
                {MELODY_DRUMS.map((d) => (
                  <label key={d} className="flex items-center gap-1 font-mono text-sm text-text">
                    <input
                      type="radio"
                      name={`${idBase}-drum`}
                      checked={drum === d}
                      onChange={() => setDrum(d)}
                      data-testid={`derive-drum-${d}`}
                    />
                    {d}
                  </label>
                ))}
                <Button
                  size="sm"
                  disabled={drum === null || label === null}
                  onClick={() =>
                    label !== null && drum !== null && derive(melodyAsDrums(liveCode, label, drum))
                  }
                  data-testid="derive-tune-as-drums"
                >
                  {DERIVE_WORDS.tuneAsDrums}
                </Button>
              </div>
              <p className="text-sm text-text-3">{DERIVE_WORDS.tuneAsDrumsDetail}</p>
            </fieldset>
          </section>
        </div>
      </Dialog>
    </>
  );
}
