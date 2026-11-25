// Oak 2.0 W4 F3: "Erase and listen" in the capstone workspace (slot `erase-pass`, place `main`). A button opens the
// pass over the draft in the capstone's editor; closing it puts the learner's own mutes back. Every code change it
// offers goes through the workspace's `applyCode`, one undoable edit.
import { Eraser } from "lucide-react";
import { useState } from "react";
import { ErasePass } from "../listen/ErasePass.tsx";
import { ERASE_COPY } from "../listen/erase.ts";
import { Button } from "../ui/kit/Button.tsx";
import type { CapstoneSlotProps } from "./workspace-slots.ts";

export function ErasePassCard({ liveCode, editor, applyCode, bars }: CapstoneSlotProps) {
  const [open, setOpen] = useState(false);
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
      <ErasePass code={liveCode} editor={editor} applyCode={applyCode} bars={bars} testId="erase-pass" />
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
