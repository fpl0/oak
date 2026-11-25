// Oak 2.0 W4 F7 "Borrow a form you mapped" (DeSantis, Formal Skeletons; W1 gap 3): the New sketch dialog's start
// "From a form you mapped" (`FormStartOption`, a `StartSlot` the W4 integrator registers in `START_SLOTS` after
// `with-card`), and the form picker the capstone card shares. The picker lists "Your maps" (Transcribe projects
// whose sections the learner marked on the form strip) and, only once there is one, "Oak's songs" (the unit songs
// the learner has started). The tempo and key are fields, prefilled from the source; Create writes the empty
// skeleton (`formStartBody`) and opens it. With no map yet the start says where to make one.
import type { KeySpec, MeterId, UnitId } from "@oak/content-kit";
import { keyFromFifths } from "@oak/theory";
import { useId, useMemo, useState } from "react";
import { unitSongOfUnit } from "../../../content/unit-songs/index.ts";
import { errorWords } from "../lib/error-words.ts";
import { useSketchCreate, useTranscriptions } from "../lib/queries.ts";
import { useUnitSongs } from "../song/hooks.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Select } from "../ui/kit/Field.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { keyName } from "../workbench/key-tools.ts";
import { FORM_BPM, FORM_START_COPY, formStartBody, formsOffered, type MappedForm } from "./form-start.ts";
import { nextSketchTitle } from "./model.ts";
import type { StartSlot, StartSlotProps } from "./start-slots.ts";

const C_MAJOR: KeySpec = { tonic: "C", mode: "major" };
const clampBpm = (n: number): number => Math.min(FORM_BPM.max, Math.max(FORM_BPM.min, Math.round(n)));

/** The learner's maps and, once there is one, Oak's songs: read from Transcribe's projects and the unit songs. */
export function useOfferedForms(): { yours: MappedForm[]; oak: MappedForm[]; loading: boolean } {
  const projects = useTranscriptions();
  const songs = useUnitSongs();
  return useMemo(() => {
    const got = formsOffered(projects.data?.items ?? [], songs.data?.items ?? [], (u: UnitId) =>
      unitSongOfUnit(u),
    );
    return { ...got, loading: projects.isPending };
  }, [projects.data, projects.isPending, songs.data]);
}

/** The keys a form can be written in: twelve tonics in the chosen mode, plus the source's own key. */
function keyOptions(mode: "major" | "minor", extra: KeySpec | null): KeySpec[] {
  const keys = Array.from({ length: 12 }, (_, i) => keyFromFifths(i - 5, mode));
  if (extra && !keys.some((k) => k.tonic === extra.tonic && k.mode === extra.mode)) keys.unshift(extra);
  return keys;
}
const keyId = (k: KeySpec): string => `${k.tonic}:${k.mode}`;

export interface FormChoice {
  form: MappedForm;
  bpm: number;
  key: KeySpec;
}

/**
 * The list of forms (yours, then Oak's) and the tempo and key fields. `fixedKey`: a brief that names its key keeps it
 * (no key field). `bpmFor` turns the form's tempo into the field's first value (a capstone clamps it to its brief).
 */
export function FormPicker({
  yours,
  oak,
  fixedKey,
  bpmFor,
  onChange,
}: {
  yours: readonly MappedForm[];
  oak: readonly MappedForm[];
  fixedKey?: KeySpec | null;
  bpmFor?: (bpm: number) => number;
  onChange(choice: FormChoice | null): void;
}) {
  const ids = useId();
  const all = [...yours, ...oak];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = all.find((f) => f.id === pickedId) ?? all[0] ?? null;
  const firstBpm = (f: MappedForm): number => (bpmFor ?? clampBpm)(f.bpm ?? 90);
  const [bpm, setBpm] = useState<number | null>(null);
  const [key, setKey] = useState<KeySpec | null>(null);
  const bpmNow = bpm ?? (picked ? firstBpm(picked) : 90);
  const keyNow = fixedKey ?? key ?? picked?.key ?? C_MAJOR;
  const mode: "major" | "minor" = keyNow.mode === "minor" ? "minor" : "major";

  const emit = (f: MappedForm | null, b: number, k: KeySpec) =>
    onChange(f ? { form: f, bpm: b, key: k } : null);
  const pick = (f: MappedForm) => {
    setPickedId(f.id);
    setBpm(null);
    setKey(null);
    emit(f, firstBpm(f), fixedKey ?? f.key ?? C_MAJOR);
  };

  const row = (f: MappedForm) => (
    <label key={f.id} className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="radio"
        name={`${ids}-form`}
        className="mt-1 accent-[var(--oak-accent)]"
        checked={picked?.id === f.id}
        onChange={() => pick(f)}
        data-testid={`form-${f.source}`}
      />
      <span className="min-w-0">
        <span className="block font-medium">{f.title}</span>
        <span className="block text-text-3">
          {f.map.labels.map((l) => l || "·").join(" ")} · {f.map.bars} bars
        </span>
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-2" data-testid="form-picker">
      {yours.length > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium text-text-2">{FORM_START_COPY.yours}</legend>
          {yours.map(row)}
        </fieldset>
      ) : null}
      {oak.length > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium text-text-2">{FORM_START_COPY.oak}</legend>
          {oak.map(row)}
        </fieldset>
      ) : null}
      {picked ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{FORM_START_COPY.tempo}</span>
            <input
              type="number"
              min={FORM_BPM.min}
              max={FORM_BPM.max}
              value={bpmNow}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                setBpm(n);
                emit(picked, clampBpm(n), keyNow);
              }}
              onBlur={() => setBpm(clampBpm(bpmNow))}
              className="h-8 w-20 rounded-control border border-border bg-surface px-2"
              data-testid="form-bpm"
            />
          </label>
          {fixedKey ? null : (
            <fieldset className="flex flex-col gap-1 text-sm">
              <legend className="font-medium">{FORM_START_COPY.key}</legend>
              <div className="flex gap-2">
                <Select<string>
                  value={keyId(keyNow)}
                  options={keyOptions(mode, picked.key).map((k) => ({ value: keyId(k), label: keyName(k) }))}
                  onChange={(v) => {
                    const [tonic, m] = v.split(":");
                    const next = { tonic: tonic as string, mode: m as KeySpec["mode"] };
                    setKey(next);
                    emit(picked, clampBpm(bpmNow), next);
                  }}
                />
                <Select<"major" | "minor">
                  value={mode}
                  options={[
                    { value: "major", label: "major" },
                    { value: "minor", label: "minor" },
                  ]}
                  onChange={(m) => {
                    const next = { tonic: keyNow.tonic, mode: m };
                    setKey(next);
                    emit(picked, clampBpm(bpmNow), next);
                  }}
                />
              </div>
            </fieldset>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** The start's own Create (a `type="button"`: the dialog is a form), in place of the dialog's. */
export function FormStart({ sketches, sessionId, onCreated }: StartSlotProps) {
  const { yours, oak, loading } = useOfferedForms();
  const [choice, setChoice] = useState<FormChoice | null>(null);
  const create = useSketchCreate();
  const first = yours[0] ?? null;
  const chosen: FormChoice | null =
    choice ?? (first ? { form: first, bpm: clampBpm(first.bpm ?? 90), key: first.key ?? C_MAJOR } : null);

  if (!loading && yours.length === 0)
    return (
      <>
        <p className="order-first basis-full text-sm text-text-2" data-testid="form-start-none">
          {FORM_START_COPY.none}
        </p>
        <Button variant="primary" disabled data-testid="form-start-create">
          {FORM_START_COPY.create}
        </Button>
      </>
    );

  const start = async () => {
    if (!chosen) return;
    try {
      const meter: MeterId = chosen.form.meter;
      const saved = await create.mutateAsync({
        body: formStartBody(chosen.form, {
          title: nextSketchTitle(sketches),
          sessionId,
          bpm: clampBpm(chosen.bpm),
          meter,
          key: chosen.key,
        }),
      });
      onCreated(saved.sketch.id);
    } catch (e) {
      toast.error(FORM_START_COPY.failed, errorWords(e));
    }
  };

  return (
    <>
      <div
        className="order-first flex basis-full flex-col gap-2 rounded-control border border-border bg-surface-2 p-3"
        data-testid="form-start"
      >
        <FormPicker yours={yours} oak={oak} onChange={setChoice} />
      </div>
      <Button
        variant="primary"
        loading={create.isPending}
        disabled={!chosen}
        onClick={() => void start()}
        data-testid="form-start-create"
      >
        {FORM_START_COPY.create}
      </Button>
    </>
  );
}

/** The New sketch dialog's "From a form you mapped" (registered in `START_SLOTS` after `with-card`). */
export const FormStartOption: StartSlot = {
  id: "form-start",
  label: FORM_START_COPY.label,
  detail: FORM_START_COPY.detail,
  Component: FormStart,
};
