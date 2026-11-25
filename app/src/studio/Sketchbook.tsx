// The sketchbook (ux §2.3): every sketch with its ring cover (one ring per version), flavour, key and tempo,
// when it was last edited and its liner flags (tools not yet unlocked, an imported version to review).
// Filters, search, sort, and "New sketch from…". Oak 2.0: the Scraps tab (W1), the Habits and Catalogs tabs (W3).
import type { Sketch, SketchDetail } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { NotebookPen, Plus, Search } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FLAVOUR_LABEL, formatDate, formatKey } from "../lib/format.ts";
import { usePageTitle } from "../lib/nav.ts";
import { type SketchOrigin, useSketches } from "../lib/queries.ts";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { Card, Chip, EmptyState, Page, PageHeader } from "../ui/kit/basics.tsx";
import { QueryView } from "../ui/kit/QueryState.tsx";
import { Tabs, tabPanelProps } from "../ui/kit/Tabs.tsx";
import type { CatalogMode } from "./catalog/CatalogFlow.tsx";
import { CatalogsTab } from "./catalog/CatalogsTab.tsx";
import { HabitsTab } from "./habits/HabitsTab.tsx";
import { needsReview, sinceText } from "./model.ts";
import { NewSketchDialog } from "./NewSketchDialog.tsx";
import { useSketchDetails } from "./queries.ts";
import { SketchCover } from "./SketchCover.tsx";
import { ScrapsPanel } from "./scraps/ScrapsPanel.tsx";

/** Oak 2.0: the sketchbook's tabs (S1 Scraps; S6 Habits and Catalogs, W3). */
export type BookTab = "sketches" | "scraps" | "habits" | "catalogs";
const BOOK_TABS: { value: BookTab; label: string }[] = [
  { value: "sketches", label: "Sketches" },
  { value: "scraps", label: "Scraps" },
  { value: "habits", label: "Habits" },
  { value: "catalogs", label: "Catalogs" },
];

type Filter = "all" | "free" | "lesson-make" | "capstone" | "transcription";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "free", label: "Mine" },
  { value: "lesson-make", label: "From lessons" },
  { value: "capstone", label: "Capstone drafts" },
  { value: "transcription", label: "Transcriptions" },
];
const ORIGIN_LABEL: Record<Sketch["originKind"], string> = {
  "lesson-make": "Lesson Make",
  free: "Free play",
  capstone: "Capstone draft",
  transcription: "Transcription",
  tutor: "From the tutor",
  keepalive: "Keep-alive",
  checkpoint: "Checkpoint",
};
type Sort = "recent" | "title" | "oldest";

/**
 * What an empty filter says and offers. A transcription or a capstone draft is not made with "New sketch", so those
 * filters point to where they are made.
 */
function emptyFilter(filter: Filter, onNew: () => void): { title: string; body: string; action: ReactNode } {
  const newSketch = (
    <Button variant="primary" onClick={onNew}>
      New sketch
    </Button>
  );
  switch (filter) {
    case "all":
      return {
        title: "Your sketchbook fills up one session at a time.",
        body: "Start blank, from a lesson's Make, or over a Band.",
        action: newSketch,
      };
    case "transcription":
      return {
        title: "No transcriptions yet.",
        body: "A song you transcribe is kept here as a sketch.",
        action: (
          <Link to="/transcribe" className={buttonClass("primary")}>
            Transcribe a song
          </Link>
        ),
      };
    case "capstone":
      return {
        title: "No capstone drafts yet.",
        body: "When you start a capstone, its draft is kept here.",
        action: (
          <Link to="/album" className={buttonClass("primary")}>
            Open the album
          </Link>
        ),
      };
    default:
      return {
        title: "Nothing here yet.",
        body: "Sketches of this kind appear here as you make them.",
        action: newSketch,
      };
  }
}

export function Sketchbook({
  wantsNew,
  onNewHandled,
  wantsScraps = false,
  wantsHabits = false,
  wantsCatalog = null,
  onScrapsChange,
  onTabChange,
}: {
  wantsNew: boolean;
  onNewHandled(): void;
  /** Oak 2.0 S1 (`/studio?scraps=1`): the sketchbook shows its Scraps tab. */
  wantsScraps?: boolean;
  /** Oak 2.0 W3 (`/studio?habits=1`): the Habits tab. */
  wantsHabits?: boolean;
  /**
   * Oak 2.0 W3 (`/studio?catalog=new|outside`): the Catalogs tab; `outside` opens "Outside your lane" in it.
   */
  wantsCatalog?: "new" | "outside" | null;
  /** The learner switched between Sketches and Scraps (the route keeps `?scraps` in step). */
  onScrapsChange?(open: boolean): void;
  /** The learner switched tabs (the route keeps `?scraps`, `?habits` and `?catalog` in step); wins over `onScrapsChange`. */
  onTabChange?(tab: BookTab): void;
}) {
  usePageTitle("Studio");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [dialog, setDialog] = useState(false);
  // The tab follows `?scraps`, `?habits` and `?catalog` when the route keeps them; without a route callback it is
  // local.
  const asked: BookTab = wantsScraps
    ? "scraps"
    : wantsHabits
      ? "habits"
      : wantsCatalog !== null
        ? "catalogs"
        : "sketches";
  const [localTab, setLocalTab] = useState<BookTab>(asked);
  const routed = onTabChange !== undefined || onScrapsChange !== undefined;
  const tab: BookTab = routed ? asked : localTab;
  const setTab = (t: BookTab) => {
    if (onTabChange) onTabChange(t);
    else if (onScrapsChange) onScrapsChange(t === "scraps");
    else setLocalTab(t);
  };
  const catalogMode: CatalogMode | null = wantsCatalog === "outside" ? "outside" : null;
  const sketches = useSketches(filter === "all" ? undefined : (filter as SketchOrigin));
  const all = useSketches();

  // "New sketch" from the command palette arrives as ?new=true: open the chooser.
  useEffect(() => {
    if (wantsNew) {
      setDialog(true);
      onNewHandled();
    }
  }, [wantsNew, onNewHandled]);

  const items = sketches.data?.items ?? [];
  const needle = q.trim().toLowerCase();
  const visible = [...items]
    .filter(
      (s) =>
        !needle ||
        s.title.toLowerCase().includes(needle) ||
        s.tags.some((t) => t.toLowerCase().includes(needle)) ||
        (s.originId ?? "").toLowerCase().includes(needle),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const details = useSketchDetails(visible.map((s) => s.id));
  const now = Date.now();

  return (
    <Page>
      <PageHeader
        title="Studio"
        sub="Free play and your sketchbook. Every Run saves a version; nothing here is graded."
        actions={
          <Button
            variant="primary"
            icon={<Plus aria-hidden className="size-4" />}
            onClick={() => setDialog(true)}
            data-testid="new-sketch"
          >
            New sketch
          </Button>
        }
      />
      <Tabs<BookTab>
        label="Sketchbook"
        value={tab}
        onChange={setTab}
        items={BOOK_TABS}
        className="mb-4"
        idBase="sketchbook"
      />
      {tab === "scraps" ? (
        <div {...tabPanelProps("sketchbook", "scraps")}>
          <ScrapsPanel />
        </div>
      ) : tab === "habits" ? (
        <div {...tabPanelProps("sketchbook", "habits")}>
          <HabitsTab />
        </div>
      ) : tab === "catalogs" ? (
        <div {...tabPanelProps("sketchbook", "catalogs")}>
          <CatalogsTab key={catalogMode ?? "list"} initialMode={catalogMode} />
        </div>
      ) : (
        <div {...tabPanelProps("sketchbook", "sketches")}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Tabs<Filter> label="Show" value={filter} onChange={setFilter} items={FILTERS} />
            <label className="relative flex items-center">
              <span className="sr-only">Search sketches</span>
              <Search aria-hidden className="pointer-events-none absolute left-2 size-4 text-text-3" />
              <input
                ref={searchRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="h-8 w-56 rounded-control border border-border bg-surface pr-2 pl-8 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-text-2">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-8 rounded-control border border-border bg-surface px-2 text-text"
              >
                <option value="recent">Last edited</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title</option>
              </select>
            </label>
          </div>
          <QueryView
            query={sketches}
            isEmpty={(d) => d.items.length === 0}
            empty={(() => {
              const e = emptyFilter(filter, () => setDialog(true));
              return (
                <EmptyState icon={<NotebookPen aria-hidden />} title={e.title} action={e.action}>
                  {e.body}
                </EmptyState>
              );
            })()}
          >
            {() =>
              visible.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-1 py-8 text-center text-text-2"
                  data-testid="search-empty"
                >
                  <p>No sketches match “{q}”.</p>
                  <p className="text-sm">Search looks at titles and tags.</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setQ("");
                      // The button goes away with the empty result: keep the focus where the learner types next.
                      searchRef.current?.focus();
                    }}
                  >
                    Clear search
                  </Button>
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="sketch-list">
                  {visible.map((s) => (
                    <li key={s.id}>
                      <SketchCard sketch={s} detail={details.get(s.id) ?? null} now={now} />
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryView>
        </div>
      )}
      <NewSketchDialog open={dialog} onClose={() => setDialog(false)} sketches={all.data?.items ?? []} />
    </Page>
  );
}

function SketchCard({
  sketch: s,
  detail,
  now,
}: {
  sketch: Sketch;
  detail: SketchDetail | null;
  now: number;
}) {
  const v = detail?.versions.find((x) => x.version === s.currentVersion) ?? detail?.versions.at(-1) ?? null;
  const locked = v?.flags.lockedTools.length ?? 0;
  return (
    <Link
      to="/studio/$sketchId"
      params={{ sketchId: s.id }}
      className="block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      data-testid="sketch-card"
    >
      <Card interactive className="flex h-full gap-3 p-3">
        <SketchCover seed={s.id} versions={s.currentVersion} flavour={v?.band?.flavour ?? null} size={64} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-medium text-text">{s.title}</span>
          <span className="text-sm text-text-2">
            v{s.currentVersion} · edited {sinceText(s.updatedAt, now, (iso) => formatDate(iso))}
          </span>
          <span className="mt-auto flex flex-wrap gap-1 pt-1">
            {v?.band ? <Chip tone="accent">{FLAVOUR_LABEL[v.band.flavour] ?? v.band.flavour}</Chip> : null}
            {v?.key ? <Chip>{formatKey(v.key)}</Chip> : null}
            {v?.bpm ? <Chip>{Math.round(v.bpm)} BPM</Chip> : null}
            {s.originKind !== "free" ? <Chip>{ORIGIN_LABEL[s.originKind]}</Chip> : null}
            {locked > 0 ? (
              <Chip tone="amber" title="Liner note: uses tools not yet unlocked">
                {locked === 1 ? "1 tool ahead" : `${locked} tools ahead`}
              </Chip>
            ) : null}
            {needsReview(v) ? <Chip tone="issue">review before running</Chip> : null}
          </span>
        </span>
      </Card>
    </Link>
  );
}
