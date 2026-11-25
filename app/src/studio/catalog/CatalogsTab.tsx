// Oak 2.0 W3 (PLAN §4 S6): the sketchbook's Catalogs tab (`/studio?catalog=new`; `?catalog=outside` opens "Outside your
// lane"). The learner's catalogs of attributes, newest first, each with its six lines and the sketch written from
// them; a catalog with no sketch offers "Write from these lines". "Catalog a reference" and "Outside your lane" open
// the flow (CatalogFlow). Nothing here shows Oak's reading: that waits in the sketch, beside the learner's lines.
import type { Catalog } from "@oak/api";
import { CATALOG_LINES } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { ListMusic } from "lucide-react";
import { useState } from "react";
import { formatDate } from "../../lib/format.ts";
import { useSketches } from "../../lib/queries.ts";
import { Button, buttonClass } from "../../ui/kit/Button.tsx";
import { Card, Chip, EmptyState } from "../../ui/kit/basics.tsx";
import { ErrorState, LoadingState } from "../../ui/kit/QueryState.tsx";
import { notBuilt } from "../habits/habits-queries.ts";
import { CatalogFlow, type CatalogMode, useRefOf, useWriteFromLines } from "./CatalogFlow.tsx";
import { useCatalogs } from "./catalog-queries.ts";
import { CATALOG_WORDS, LINE_LABELS, visibleCatalogs } from "./model.ts";

export function CatalogsTab({ initialMode = null }: { initialMode?: CatalogMode | null }) {
  const [mode, setMode] = useState<CatalogMode | null>(initialMode);
  const q = useCatalogs();
  return (
    <div className="flex flex-col gap-4" data-testid="catalogs-tab">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-[70ch] text-text-2">{CATALOG_WORDS.intro}</p>
        {mode === null ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMode("reference")} data-testid="catalog-new">
              {CATALOG_WORDS.start}
            </Button>
            <Button variant="ghost" onClick={() => setMode("outside")} data-testid="catalog-outside">
              {CATALOG_WORDS.outsideStart}
            </Button>
          </div>
        ) : null}
      </div>
      {mode !== null ? <CatalogFlow key={mode} mode={mode} onClose={() => setMode(null)} /> : null}
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        notBuilt(q.error) ? (
          <p className="text-text-2">{CATALOG_WORDS.empty}</p>
        ) : (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        )
      ) : q.data.items.length === 0 ? (
        mode === null ? (
          <EmptyState icon={<ListMusic aria-hidden />} title={CATALOG_WORDS.empty} />
        ) : null
      ) : (
        <ul className="flex flex-col gap-3" data-testid="catalog-list">
          {visibleCatalogs(q.data.items).map((c) => (
            <li key={c.id}>
              <CatalogCard catalog={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CatalogCard({ catalog: c }: { catalog: Catalog }) {
  const ref = useRefOf(c);
  const sketches = useSketches();
  const sketch = c.sketchId ? (sketches.data?.items.find((s) => s.id === c.sketchId) ?? null) : null;
  const { write, busy } = useWriteFromLines();
  return (
    <Card className="p-4" data-testid="catalog" data-catalog={c.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{ref.title}</p>
          <p className="text-sm text-text-3">{formatDate(c.createdAt)}</p>
        </div>
        <Chip>{CATALOG_WORDS.refOf(c.refKind)}</Chip>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
        {CATALOG_LINES.map((k) => (
          <div key={k} className="contents">
            <dt className="text-text-2">{LINE_LABELS[k]}</dt>
            <dd className={c.lines[k] ? undefined : "text-text-3"}>{c.lines[k] || CATALOG_WORDS.noLines}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {sketch ? (
          <Link
            to="/studio/$sketchId"
            params={{ sketchId: sketch.id }}
            className={buttonClass("secondary", "sm")}
            data-testid="catalog-open-sketch"
          >
            {sketch.title}
          </Link>
        ) : c.sketchId === null ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() =>
              void write({ refKind: c.refKind, refId: c.refId, refTitle: ref.title, lines: c.lines })
            }
            data-testid="catalog-write"
          >
            {CATALOG_WORDS.writeFromLines}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
