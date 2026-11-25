// Oak 2.0 W1 (S2): the learner's own templates, opened from "Your templates…" in the New sketch dialog. Rename one,
// make it the Blank (or stop it being the Blank), delete one (asks first). The Blank is listed first.
import type { UserTemplate } from "@oak/api";
import { useState } from "react";
import { errorWords } from "../lib/error-words.ts";
import { Button } from "../ui/kit/Button.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { focusOnOpen } from "./focus.ts";
import { TEMPLATE_COPY, templateStartDetail } from "./starts.ts";
import { useTemplateDelete, useTemplatePatch, useTemplates } from "./templates-queries.ts";

export function MyTemplates({ onBack }: { onBack(): void }) {
  const templates = useTemplates();
  const items = templates.data?.items ?? [];
  return (
    <div className="flex flex-col gap-3">
      {templates.isPending ? (
        <p className="text-sm text-text-2">Loading your templates…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-2">{TEMPLATE_COPY.none}</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Your templates">
          {items.map((t) => (
            <TemplateRow key={t.id} t={t} />
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onBack}>
          Back to New sketch
        </Button>
      </div>
    </div>
  );
}

function TemplateRow({ t }: { t: UserTemplate }) {
  const patch = useTemplatePatch();
  const del = useTemplateDelete();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(t.name);

  const save = async (body: { name?: string; isBlank?: boolean }) => {
    try {
      await patch.mutateAsync({ params: { id: t.id }, body });
      setRenaming(false);
    } catch (e) {
      toast.error("Couldn't change the template", errorWords(e));
    }
  };
  const remove = async () => {
    try {
      await del.mutateAsync({
        target: t.id,
        question: TEMPLATE_COPY.deleteQuestion(t.name),
        input: { params: { id: t.id } },
      });
    } catch (e) {
      toast.error("Couldn't delete the template", errorWords(e));
    }
  };

  return (
    <li className="flex flex-col gap-2 rounded-control border border-border p-3" data-testid="my-template">
      {renaming ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = name.trim();
            if (next && next !== t.name) void save({ name: next });
            else setRenaming(false);
          }}
        >
          <input
            aria-label="Template name"
            value={name}
            maxLength={80}
            ref={focusOnOpen}
            onChange={(e) => setName(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-control border border-border bg-surface px-2 text-text"
          />
          <Button type="submit" size="sm" variant="primary" loading={patch.isPending}>
            Save name
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setName(t.name);
              setRenaming(false);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <div className="min-w-0">
          <p className="font-medium">
            {t.name}
            {t.isBlank ? <span className="ml-2 text-sm text-text-2">({TEMPLATE_COPY.isBlank})</span> : null}
          </p>
          <p className="text-sm text-text-2">{templateStartDetail(t)}</p>
          {t.reviewBeforeRun ? <p className="text-sm text-text-3">{TEMPLATE_COPY.review}</p> : null}
        </div>
      )}
      {renaming ? null : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
            Rename
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={patch.isPending}
            onClick={() => void save({ isBlank: !t.isBlank })}
          >
            {t.isBlank ? TEMPLATE_COPY.stopBlank : TEMPLATE_COPY.makeItBlank}
          </Button>
          <Button size="sm" variant="ghost" loading={del.isPending} onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      )}
    </li>
  );
}
