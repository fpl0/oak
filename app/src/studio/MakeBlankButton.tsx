// Oak 2.0 W1 (S2): the sketch editor's header slot "Starting point": "Make this my Blank" and "Save as a
// template…". The server keeps the saved version's tempo, meter and sounds and none of its notes (templateOfCode,
// X7), and the result is shown read-only, so the learner sees exactly what their Blank or template writes.
import type { UserTemplate } from "@oak/api";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { errorWords } from "../lib/error-words.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Dialog } from "../ui/kit/Dialog.tsx";
import type { EditorSlotProps } from "./editor-slots.ts";
import { focusOnOpen } from "./focus.ts";
import { TEMPLATE_COPY } from "./starts.ts";
import { useTemplateCreate } from "./templates-queries.ts";

type Mode = "blank" | "template";

export function MakeBlankButton({ sketch, version, liveCode }: EditorSlotProps) {
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const ids = useId();
  const wrap = useRef<HTMLDivElement>(null);

  // The menu closes on Escape and on a click outside it.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const pick = (m: Mode) => {
    setMenu(false);
    setMode(m);
  };

  return (
    <div ref={wrap} className="relative">
      <Button
        size="sm"
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={menu}
        aria-controls={`${ids}-menu`}
        onClick={() => setMenu((v) => !v)}
        icon={<ChevronDown aria-hidden className="size-3.5" />}
      >
        {TEMPLATE_COPY.menu}
      </Button>
      {menu ? (
        <div
          id={`${ids}-menu`}
          role="menu"
          aria-label={TEMPLATE_COPY.menu}
          className="absolute right-0 z-20 mt-1 flex min-w-56 flex-col rounded-control border border-border bg-surface p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="rounded-control px-3 py-2 text-left text-sm hover:bg-surface-2"
            onClick={() => pick("blank")}
          >
            {TEMPLATE_COPY.makeBlank}
          </button>
          <button
            type="button"
            role="menuitem"
            className="rounded-control px-3 py-2 text-left text-sm hover:bg-surface-2"
            onClick={() => pick("template")}
          >
            {TEMPLATE_COPY.saveTemplate}
          </button>
        </div>
      ) : null}
      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === "template" ? "Save as a template" : TEMPLATE_COPY.makeBlank}
        className="w-[min(94vw,32rem)]"
      >
        {mode !== null ? (
          <SaveStart
            key={mode}
            mode={mode}
            sketchId={sketch.id}
            sketchTitle={sketch.title}
            version={version.version}
            unsaved={liveCode !== version.code}
            onClose={() => setMode(null)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function SaveStart({
  mode,
  sketchId,
  sketchTitle,
  version,
  unsaved,
  onClose,
}: {
  mode: Mode;
  sketchId: string;
  sketchTitle: string;
  version: number;
  unsaved: boolean;
  onClose(): void;
}) {
  const create = useTemplateCreate();
  const [name, setName] = useState(sketchTitle.slice(0, 80));
  const [saved, setSaved] = useState<UserTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    try {
      const t = await create.mutateAsync({
        body: {
          name: mode === "blank" ? "My Blank" : name.trim() || sketchTitle.slice(0, 80),
          isBlank: mode === "blank",
          fromSketch: { sketchId, version },
          code: null,
          bpm: null,
          meter: null,
        },
      });
      setSaved(t);
    } catch (e) {
      // Shown in the dialog: the learner is looking there.
      setError(errorWords(e));
    }
  };

  if (saved) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">
          {mode === "blank" ? TEMPLATE_COPY.blankShown : TEMPLATE_COPY.templateShown}
        </p>
        <pre
          className="max-h-72 overflow-auto rounded-control border border-border bg-surface-2 p-3 font-mono text-sm"
          data-testid="template-code"
        >
          {saved.code}
        </pre>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="text-sm text-text-2">
        {mode === "blank" ? TEMPLATE_COPY.blankAbout : TEMPLATE_COPY.templateAbout}
      </p>
      {unsaved ? <p className="text-sm text-text-2">{TEMPLATE_COPY.fromSaved}</p> : null}
      {mode === "template" ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text-2">Name</span>
          <input
            ref={focusOnOpen}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className="h-9 rounded-control border border-border bg-surface px-2 text-base text-text"
          />
        </label>
      ) : null}
      {error ? (
        <p className="text-sm text-text-2" role="status">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={create.isPending}>
          {mode === "blank" ? TEMPLATE_COPY.makeItBlank : "Save template"}
        </Button>
      </div>
    </form>
  );
}
