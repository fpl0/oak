// Oak 2.0 W1 (PLAN S7): the Later list on Today. Questions the tutor offered to park and notes the learner parks
// themselves wait here, oldest first, so a long detour never takes over today's session. Plain words, no counts as
// goals: "Done" moves an item under "Done (n)", which is a list, not a score.
import type { LaterItem } from "@oak/api";
import { type FormEvent, useId, useState } from "react";
import { Button } from "../../ui/kit/Button.tsx";
import { Card } from "../../ui/kit/basics.tsx";
import { useLaterCreate, useLaterDone, useLaterOpen, useLaterPatch } from "./later-queries.ts";

export const LATER_COPY = {
  title: "Later",
  sub: "Questions and ideas parked for another day.",
  field: "Park something for later",
  park: "Park it",
  done: "Done",
  reopen: "Back to the list",
  doneHeading: (n: number) => `Done (${n})`,
  fromTutor: "from the tutor",
} as const;

function ItemRow({ item, onToggle, busy }: { item: LaterItem; onToggle(): void; busy: boolean }) {
  const done = item.doneAt !== null;
  return (
    <li className="flex items-start justify-between gap-3 py-2" data-testid="later-item" data-done={done}>
      <div className="min-w-0">
        <p className={done ? "text-text-2" : undefined}>{item.text}</p>
        {item.source === "tutor" && <p className="text-sm text-text-3">{LATER_COPY.fromTutor}</p>}
      </div>
      <Button variant={done ? "ghost" : "secondary"} size="sm" onClick={onToggle} disabled={busy}>
        {done ? LATER_COPY.reopen : LATER_COPY.done}
      </Button>
    </li>
  );
}

export function LaterList() {
  const open = useLaterOpen();
  const done = useLaterDone();
  const create = useLaterCreate();
  const patch = useLaterPatch();
  const [text, setText] = useState("");
  const fieldId = useId();

  const park = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t === "") return;
    create.mutate({ body: { text: t.slice(0, 500), source: "learner" } }, { onSuccess: () => setText("") });
  };
  const toggle = (item: LaterItem) =>
    patch.mutate({ params: { id: item.id }, body: { done: item.doneAt === null } });

  const openItems = open.data?.items ?? [];
  const doneItems = done.data?.items ?? [];
  return (
    <Card className="p-5" data-testid="later-list">
      <h2 className="text-h3">{LATER_COPY.title}</h2>
      <p className="mt-0.5 text-sm text-text-2">{LATER_COPY.sub}</p>
      {openItems.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-border" data-testid="later-open">
          {openItems.map((item) => (
            <ItemRow key={item.id} item={item} onToggle={() => toggle(item)} busy={patch.isPending} />
          ))}
        </ul>
      )}
      <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={park}>
        <label htmlFor={fieldId} className="sr-only">
          {LATER_COPY.field}
        </label>
        <input
          id={fieldId}
          type="text"
          value={text}
          maxLength={500}
          placeholder={LATER_COPY.field}
          onChange={(e) => setText(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-control border border-control-border bg-control px-2 text-text placeholder:text-text-3"
          data-testid="later-field"
        />
        <Button type="submit" size="sm" disabled={text.trim() === ""} loading={create.isPending}>
          {LATER_COPY.park}
        </Button>
      </form>
      {doneItems.length > 0 && (
        <details className="mt-3" data-testid="later-done">
          <summary className="cursor-pointer text-sm text-text-2">
            {LATER_COPY.doneHeading(doneItems.length)}
          </summary>
          <ul className="mt-1 flex flex-col divide-y divide-border">
            {doneItems.map((item) => (
              <ItemRow key={item.id} item={item} onToggle={() => toggle(item)} busy={patch.isPending} />
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
