// The Toolbox (ux §5.1, contracts §3): every entry of the unlock table grouped by kind. Unlocked cards show
// the code form, what it does and where it was learned; locked ones stay visible, dimmed, with the concept
// that unlocks them and where. A category tab, a search and "Show locked" narrow the grid.
import type { ToolEntry } from "@oak/content-kit";
import { Link, useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Lock, Search } from "lucide-react";
import { useState } from "react";
import { useContent } from "../lib/content.ts";
import { lessonTitles } from "../lib/content-model.ts";
import { usePageTitle } from "../lib/nav.ts";
import { useUnlocks } from "../lib/queries.ts";
import { InlineCodeText } from "../session/today/SideOffer.tsx";
import { Card, Chip, EmptyState, Page, PageHeader, Progress } from "../ui/kit/basics.tsx";
import { ErrorState, LoadingState } from "../ui/kit/QueryState.tsx";
import { Tabs } from "../ui/kit/Tabs.tsx";
import { shownConcept, shownToolMeaning, shownToolLabel as toolLabel } from "./label.ts";
import { groupTools, KIND_LABEL, KIND_ORDER, sitesOf, siteText, siteTitle } from "./model.ts";

type Cat = ToolEntry["kind"] | "all";

export function ToolboxIndex({ cat }: { cat: string | undefined }) {
  usePageTitle("Toolbox");
  const navigate = useNavigate({ from: "/toolbox/" });
  const content = useContent();
  const unlocks = useUnlocks();
  const [showLocked, setShowLocked] = useState(true);
  const [q, setQ] = useState("");

  if (content.isPending)
    return (
      <Page>
        <LoadingState label="Opening the toolbox" />
      </Page>
    );
  if (content.isError)
    return (
      <Page>
        <ErrorState error={content.error} onRetry={() => void content.refetch()} />
      </Page>
    );
  const toolbox = content.data?.toolbox ?? [];
  const titles = lessonTitles(content.data?.syllabus ?? null);
  const unlocked = new Set((unlocks.data?.items ?? []).map((u) => u.itemId as string));
  const kinds = KIND_ORDER.filter((k) => toolbox.some((t) => t.kind === k));
  const active: Cat = cat && (kinds as string[]).includes(cat) ? (cat as Cat) : "all";
  const sections = groupTools(toolbox, unlocked, { kind: active, showLocked, query: q });
  const total = toolbox.length;
  const have = toolbox.filter((t) => unlocked.has(t.id)).length;

  return (
    <Page>
      <PageHeader
        title="Toolbox"
        sub={
          unlocks.isError
            ? "Your unlocks could not be loaded; everything shows as locked."
            : unlocks.isPending
              ? "Reading what you have unlocked…"
              : `${have} of ${total} unlocked. Each one arrives with the lesson that explains it.`
        }
      />
      <Progress value={have} max={total} label="Toolbox unlocked" className="mb-4 max-w-md" />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs<Cat>
          label="Category"
          value={active}
          onChange={(v) => void navigate({ search: v === "all" ? {} : { cat: v } })}
          items={[{ value: "all", label: "All" }, ...kinds.map((k) => ({ value: k, label: KIND_LABEL[k] }))]}
        />
        <label className="relative flex items-center">
          <span className="sr-only">Search the toolbox</span>
          <Search aria-hidden className="pointer-events-none absolute left-2 size-4 text-text-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="h-8 w-52 rounded-control border border-border bg-surface pr-2 pl-8 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-text-2">
          <input
            type="checkbox"
            checked={showLocked}
            onChange={(e) => setShowLocked(e.target.checked)}
            className="accent-[var(--oak-accent)]"
          />
          Show locked
        </label>
      </div>
      {sections.length === 0 ? (
        <EmptyState title={q ? `Nothing matches “${q}”` : "Nothing unlocked here yet"}>
          {q
            ? "Try the code form (gain, scale) or what it does (rests, tempo)."
            : "Tools arrive as lessons introduce them. Turn on “Show locked” to see what is coming."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map((s) => (
            <section key={s.kind} aria-labelledby={`tb-${s.kind}`}>
              <h2 id={`tb-${s.kind}`} className="mb-3 flex items-baseline gap-2 text-h3">
                {s.label}
                <span className="font-sans text-sm font-normal text-text-3">
                  {s.unlocked} of {toolbox.filter((t) => t.kind === s.kind).length} unlocked
                </span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {s.tools.map((t) => (
                  <li key={t.id}>
                    <ToolCard tool={t} open={unlocked.has(t.id)} titles={titles} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

function ToolCard({
  tool: t,
  open,
  titles,
}: {
  tool: ToolEntry;
  open: boolean;
  titles: ReadonlyMap<string, string>;
}) {
  // Lessons by title on the card (the id stays in the tooltip for reference), the same for unlocked and locked.
  const site = sitesOf(t)
    .map((x) => siteTitle(x, titles))
    .join(" or ");
  const siteIds = sitesOf(t)
    .map((x) => siteText(x, titles))
    .join(" or ");
  return (
    <Link
      to="/toolbox/$toolId"
      params={{ toolId: t.id }}
      className="block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      data-testid="tool-card"
      data-locked={open ? "0" : "1"}
    >
      <Card
        interactive
        className={clsx(
          "flex h-full min-h-40 flex-col gap-1.5 p-4",
          !open && "border-dashed bg-surface-2/60",
        )}
      >
        <span className="flex items-start justify-between gap-2">
          <code
            className={clsx(
              "line-clamp-2 text-sm [overflow-wrap:anywhere]",
              toolLabel(t).mono ? "font-mono" : "font-sans font-medium",
              open ? "text-text" : "text-text-2",
            )}
          >
            {toolLabel(t).text}
          </code>
          {open ? null : <Lock aria-label="locked" className="mt-0.5 size-3.5 shrink-0 text-text-3" />}
        </span>
        {open ? (
          <span className="line-clamp-3 text-sm text-text-2">
            <InlineCodeText text={shownToolMeaning(t)} />
          </span>
        ) : (
          <span className="line-clamp-3 text-sm text-text-3">Concept: {shownConcept(t)}</span>
        )}
        <span className="mt-auto pt-1 text-sm">
          {open ? (
            // A long lesson title ("Learned in Sixteenths & 1-e-&-a") is cut with an ellipsis inside the card, never
            // wider than it (the grid's narrowest column with the tutor docked at 1280 px).
            <Chip tone="accent" title={siteIds} className="max-w-full">
              <span className="truncate">Learned in {siteTitle(sitesOf(t)[0] ?? "", titles)}</span>
            </Chip>
          ) : (
            <span className="text-text-2" title={siteIds}>
              Unlocks at <span className="font-medium text-text">{site}</span>
            </span>
          )}
        </span>
      </Card>
    </Link>
  );
}
