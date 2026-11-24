// One quiet line under the top bar when a newer Oak is out (desktop app only; the server answers null elsewhere).
// Dismissing it hides it for that version; Settings › About keeps the link.
import { X } from "lucide-react";
import { useState } from "react";
import { dismissedUpdate, dismissUpdate } from "../../lib/app-update.ts";
import { useAppUpdate } from "../../lib/queries.ts";

export function UpdateNotice() {
  const update = useAppUpdate();
  const [dismissed, setDismissed] = useState(dismissedUpdate);
  const u = update.data;
  if (!u || dismissed === u.latest) return null;
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-4 py-1.5 text-sm text-text-2"
      data-testid="update-notice"
    >
      <p className="min-w-0 flex-1 truncate">
        Oak {u.latest} is out.{" "}
        <a href={u.url} target="_blank" rel="noreferrer" className="text-link underline underline-offset-2">
          Download
        </a>
        {" · "}
        <a
          href={u.notesUrl}
          target="_blank"
          rel="noreferrer"
          className="text-link underline underline-offset-2"
        >
          What's new
        </a>
      </p>
      <button
        type="button"
        aria-label="Hide this notice"
        title="Hide this notice"
        className="inline-flex size-6 items-center justify-center rounded-control text-text-3 hover:bg-surface hover:text-text"
        onClick={() => {
          dismissUpdate(u.latest);
          setDismissed(u.latest);
        }}
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
