// Oak 2.0 W4 F7 "Borrow a form you mapped" (DeSantis, Formal Skeletons) in a capstone (`CAPSTONE_SLOTS` entry
// `form-start`, registered by the W4 integrator): while the draft is bare or still the session's starter, the learner
// may write the sections of a song they mapped into it as an empty skeleton, one undoable change. The tempo starts at
// the form's, moved into the brief's range when it has one; the meter is the brief's; the key is the brief's when it
// names one, else the form's (C major when neither does).
import { useState } from "react";
import { type FormChoice, FormPicker, useOfferedForms } from "../studio/FormStart.tsx";
import { canOfferInCapstone, FORM_BPM, FORM_START_COPY, formStartCode } from "../studio/form-start.ts";
import { Button } from "../ui/kit/Button.tsx";
import type { CapstoneSlotProps } from "./workspace-slots.ts";

export function FormStartCard({ def, liveCode, starter, released, applyCode }: CapstoneSlotProps) {
  const { yours, oak } = useOfferedForms();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<FormChoice | null>(null);
  const [clamped, setClamped] = useState(false);
  if (released || yours.length === 0 || !canOfferInCapstone(liveCode, starter)) return null;

  const [lo, hi] = def.bpm ?? [FORM_BPM.min, FORM_BPM.max];
  const bpmFor = (bpm: number): number => Math.min(hi, Math.max(lo, Math.round(bpm)));
  const first = yours[0];
  const chosen: FormChoice | null =
    choice ??
    (first
      ? {
          form: first,
          bpm: bpmFor(first.bpm ?? 90),
          key: def.key ?? first.key ?? { tonic: "C", mode: "major" },
        }
      : null);
  const outside = (f: FormChoice | null): boolean =>
    f !== null && f.form.bpm !== null && bpmFor(f.form.bpm) !== Math.round(f.form.bpm);

  return (
    <div
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
      data-testid="form-start-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-text-2">{FORM_START_COPY.detail}</p>
        {open ? null : (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)} data-testid="form-start-open">
            {FORM_START_COPY.capstoneTitle}
          </Button>
        )}
      </div>
      {open ? (
        <>
          <FormPicker
            yours={yours}
            oak={oak}
            fixedKey={def.key ?? null}
            bpmFor={bpmFor}
            onChange={(c) => {
              setChoice(c);
              setClamped(outside(c));
            }}
          />
          {clamped || (choice === null && outside(chosen)) ? (
            <p className="text-sm text-text-3">{FORM_START_COPY.clamped}</p>
          ) : null}
          <p className="text-sm text-text-2">{FORM_START_COPY.capstoneLine}</p>
          <Button
            size="sm"
            variant="primary"
            className="self-start"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              applyCode(
                formStartCode(chosen.form, {
                  bpm: bpmFor(chosen.bpm),
                  meter: def.meter,
                  key: def.key ?? chosen.key,
                }),
              );
              setOpen(false);
            }}
            data-testid="form-start-use"
          >
            {FORM_START_COPY.use}
          </Button>
        </>
      ) : null}
    </div>
  );
}
