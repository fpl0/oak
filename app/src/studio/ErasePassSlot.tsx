// Oak 2.0 W4 F3: "Erase and listen" in the Studio editor (slot `erase-pass`, place `aside`). A button opens the pass;
// closing it, or turning Jam on (Jam hides every Studio prompt, W1 fidelity rule 2), puts the learner's own mutes
// back. Every code change it offers goes through `applyCode`, one undoable edit.
import { Eraser } from "lucide-react";
import { useState } from "react";
import { ErasePass } from "../listen/ErasePass.tsx";
import { ERASE_COPY } from "../listen/erase.ts";
import { Button } from "../ui/kit/Button.tsx";
import type { EditorSlotProps } from "./editor-slots.ts";

export function ErasePassSlot({ liveCode, jam, editor, applyCode, version }: EditorSlotProps) {
  const [open, setOpen] = useState(false);
  if (jam) return null;
  if (!open)
    return (
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        icon={<Eraser aria-hidden className="size-4" />}
        onClick={() => setOpen(true)}
        data-testid="erase-open"
      >
        {ERASE_COPY.title}
      </Button>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <ErasePass
        code={liveCode}
        editor={() => editor}
        applyCode={applyCode}
        bars={version.analysis?.bars ?? null}
      />
      <Button
        size="sm"
        variant="ghost"
        className="self-start"
        onClick={() => setOpen(false)}
        data-testid="erase-hide"
      >
        {ERASE_COPY.hide}
      </Button>
    </div>
  );
}
