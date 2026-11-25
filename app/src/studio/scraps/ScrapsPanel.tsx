// Oak 2.0 W1 (S1): the Scraps tab of the sketchbook. Every scrap newest first (the labelled lines of every sketch,
// and the lines the learner saved or captured), a role filter, Play in a small read-only Workbench, Delete for
// saved scraps only, and "New sketch from scraps" for one to four picks. It describes; it never rates a line.
import type { Scrap, ScrapRole, UnlockableId } from "@oak/api";
import { useNavigate } from "@tanstack/react-router";
import { Lightbulb, Play, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { openCapture } from "../../capture/store.ts";
import { errorWords } from "../../lib/error-words.ts";
import { useSketchCreate, useSketches } from "../../lib/queries.ts";
import { appWorkbenchServices } from "../../lib/workbench-services.ts";
import { currentSessionId } from "../../session/store.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Card, Chip, EmptyState } from "../../ui/kit/basics.tsx";
import { SegmentedControl } from "../../ui/kit/Controls.tsx";
import { QueryView } from "../../ui/kit/QueryState.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import "../../workbench/index.ts";
import { ServicesGate } from "../../workbench/ServicesGate.tsx";
import { Workbench } from "../../workbench/Workbench.tsx";
import { useUnlockedSet } from "../queries.ts";
import {
  INDEX_SCRAP_NOTE,
  MAX_SCRAPS_PER_SKETCH,
  REVIEW_SCRAP_NOTE,
  ROLE_FILTERS,
  ROLE_WORDS,
  scrapPlayCode,
  scrapSourceText,
  scrapsOfRole,
  sketchFromScraps,
} from "./model.ts";
import { useScrapDelete, useScraps } from "./queries.ts";

type RoleFilter = ScrapRole | "all";

export function ScrapsPanel() {
  const [role, setRole] = useState<RoleFilter>("all");
  // Picks in the order the learner made them: the first sets the tempo of the new sketch.
  const [picks, setPicks] = useState<string[]>([]);
  const scraps = useScraps();
  const sketches = useSketches();
  const create = useSketchCreate();
  const navigate = useNavigate();
  const titles = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sketches.data?.items ?? []) m.set(s.id, s.title);
    return m;
  }, [sketches.data]);
  const all = scraps.data?.items ?? [];
  const visible = scrapsOfRole(all, role);
  const byId = new Map(all.map((s) => [s.id, s]));
  const picked = picks.map((id) => byId.get(id)).filter((s): s is Scrap => s !== undefined);

  const toggle = (id: string) =>
    setPicks((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_SCRAPS_PER_SKETCH ? p : [...p, id],
    );

  const newSketch = async () => {
    if (picked.length === 0) return;
    try {
      const body = sketchFromScraps(picked, "From scraps", currentSessionId());
      const saved = await create.mutateAsync({ body });
      setPicks([]);
      void navigate({ to: "/studio/$sketchId", params: { sketchId: saved.sketch.id } });
    } catch (e) {
      toast.error("Couldn't make the sketch", errorWords(e));
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Scraps" data-testid="scraps-panel">
      <p className="text-sm text-text-2">
        Every labelled line of your sketches, and the lines you saved or captured. Pick up to{" "}
        {MAX_SCRAPS_PER_SKETCH} to start a new sketch from them.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<RoleFilter>
          label="Part"
          size="sm"
          value={role}
          onChange={setRole}
          options={ROLE_FILTERS}
        />
        <span className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<Lightbulb aria-hidden className="size-4" />}
            onClick={() => openCapture({ to: "scrap" })}
          >
            Capture an idea
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus aria-hidden className="size-4" />}
            disabled={picked.length === 0}
            loading={create.isPending}
            onClick={() => void newSketch()}
            data-testid="scraps-new-sketch"
          >
            {picked.length === 0
              ? "New sketch from scraps"
              : `New sketch from ${picked.length} ${picked.length === 1 ? "scrap" : "scraps"}`}
          </Button>
        </span>
      </div>
      <QueryView
        query={scraps}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon={<Lightbulb aria-hidden />}
            title="No scraps yet."
            action={
              <Button variant="primary" onClick={() => openCapture({ to: "scrap" })}>
                Capture an idea
              </Button>
            }
          >
            The labelled lines of your sketches show up here, with any line you save from a lesson and any
            idea you hum, tap or record.
          </EmptyState>
        }
      >
        {() =>
          visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-2" data-testid="scraps-filter-empty">
              No {role === "all" ? "" : ROLE_WORDS[role].toLowerCase()} scraps yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="scrap-list">
              {visible.map((s) => (
                <li key={s.id}>
                  <ScrapRow
                    scrap={s}
                    sketchTitle={s.sketchId ? (titles.get(s.sketchId) ?? null) : null}
                    pickedAt={picks.indexOf(s.id)}
                    pickFull={picks.length >= MAX_SCRAPS_PER_SKETCH}
                    onPick={() => toggle(s.id)}
                    onDeleted={() => setPicks((p) => p.filter((x) => x !== s.id))}
                  />
                </li>
              ))}
            </ul>
          )
        }
      </QueryView>
    </section>
  );
}

function ScrapRow({
  scrap: s,
  sketchTitle,
  pickedAt,
  pickFull,
  onPick,
  onDeleted,
}: {
  scrap: Scrap;
  sketchTitle: string | null;
  /** The pick's position (0-based), or -1. */
  pickedAt: number;
  pickFull: boolean;
  onPick(): void;
  onDeleted(): void;
}) {
  const [playing, setPlaying] = useState(false);
  const del = useScrapDelete();
  const review = s.reviewBeforeRun === true;
  const role = s.role ?? "other";
  const name = s.label ?? ROLE_WORDS[role].toLowerCase();
  const picked = pickedAt >= 0;

  const remove = async () => {
    try {
      const r = await del.mutateAsync({
        target: s.id,
        question: `Delete the scrap “${name}”? This cannot be undone.`,
        input: { params: { id: s.id } },
      });
      if (r) {
        onDeleted();
        toast.success("Scrap deleted");
      }
    } catch (e) {
      toast.error("Couldn't delete the scrap", errorWords(e));
    }
  };

  return (
    <Card className="flex flex-col gap-2 p-3" data-testid="scrap-row" data-role={role} data-origin={s.origin}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={picked}
            disabled={!picked && pickFull}
            onChange={onPick}
            aria-label={`Pick ${name} for a new sketch`}
            data-testid="scrap-pick"
          />
          <span className="font-mono text-sm font-semibold text-text">{name}</span>
        </label>
        <Chip>{ROLE_WORDS[role]}</Chip>
        <span className="text-sm text-text-2" data-testid="scrap-source">
          {scrapSourceText(s, sketchTitle)}
        </span>
        {picked ? (
          <Chip tone="accent">{pickedAt === 0 ? "Pick 1 · sets the tempo" : `Pick ${pickedAt + 1}`}</Chip>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          {review ? (
            <Chip tone="issue">{REVIEW_SCRAP_NOTE}</Chip>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              icon={playing ? <X aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
              onClick={() => setPlaying((p) => !p)}
              aria-expanded={playing}
              data-testid="scrap-play"
            >
              {playing ? "Close" : "Play"}
            </Button>
          )}
          {s.origin === "saved" ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 aria-hidden className="size-4" />}
              loading={del.isPending}
              onClick={() => void remove()}
              data-testid="scrap-delete"
            >
              Delete
            </Button>
          ) : (
            <span className="text-sm text-text-3" data-testid="scrap-index-note">
              {INDEX_SCRAP_NOTE}
            </span>
          )}
        </span>
      </div>
      {playing && !review ? (
        <ScrapPlayer scrap={s} />
      ) : (
        <pre
          className="overflow-x-auto whitespace-pre rounded-control bg-surface-2 p-2 font-mono text-sm text-text"
          data-testid="scrap-code"
        >
          {s.code}
        </pre>
      )}
    </Card>
  );
}

function ScrapPlayer({ scrap: s }: { scrap: Scrap }) {
  const { unlocked } = useUnlockedSet();
  const meter = s.meter ?? "4/4";
  const key = s.key ?? { tonic: "C", mode: "major" as const };
  return (
    <ServicesGate load={appWorkbenchServices} auto>
      <Workbench
        id={`scrap${s.id.replace(/[^A-Za-z0-9]/g, "")}`}
        code={scrapPlayCode(s)}
        variant="mini"
        readOnly
        autoPlay
        lessonCtx={{ key, meter, defaultBpm: s.bpm ?? 90, loopBars: 4 }}
        lint={{
          profile: "studio",
          unlocked: unlocked as ReadonlySet<UnlockableId>,
          allowPreview: true,
          meter,
          key,
        }}
      />
    </ServicesGate>
  );
}
