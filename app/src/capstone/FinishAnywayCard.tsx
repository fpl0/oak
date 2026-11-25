// Oak 2.0 W4 F6 (DeSantis, Fail Better): the capstone workspace's "Finish it anyway" card (`CAPSTONE_SLOTS` entry
// `finish-anyway`, registered by the W4 integrator). Shown while the draft is half arranged (some parts in sections,
// some not), changed from the starter and not released; it opens Studio's dialog, ending with the release with
// "Put it on the Shelf" ticked.
import { useState } from "react";
import { FinishAnywayDialog } from "../studio/FinishAnyway.tsx";
import { FINISH_COPY, showsCapstoneFinishCard } from "../studio/finish-anyway.ts";
import { Button } from "../ui/kit/Button.tsx";
import type { CapstoneSlotProps } from "./workspace-slots.ts";

export function FinishAnywayCard({ def, liveCode, starter, released, editor, applyCode }: CapstoneSlotProps) {
  const [open, setOpen] = useState(false);
  if (!open && !showsCapstoneFinishCard({ liveCode, starter, released })) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-3"
      data-testid="finish-anyway-card"
    >
      <p className="min-w-0 flex-1 text-sm text-text-2">{FINISH_COPY.cardLine}</p>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} data-testid="finish-anyway-open">
        {FINISH_COPY.open}
      </Button>
      {open ? (
        <FinishAnywayDialog
          open
          onClose={() => setOpen(false)}
          code={liveCode}
          applyCode={applyCode}
          target={{ kind: "capstone", title: def.title }}
          play={() => {
            const h = editor();
            if (h && !h.disposed) void h.play();
          }}
        />
      ) : null}
    </div>
  );
}
