// /dev/listen (OAK_DEV=1, architecture §3.8): the listening pass. Every curated sound of the pack (keep,
// replace or flag) and every code example of the course (OK or one of four problems), each with a play
// button; the selected item plays in a read-only workbench. Verdicts are saved on the server
// (`PUT /api/dev/listen/:ref`), carry the code's hash, and go stale when the code changes.
import { type LessonDef, type LintContext, OakApiError, type UnlockableId } from "@oak/api";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Download, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toolbox } from "../../../../../content/toolbox.ts";
import { usePageTitle } from "../../../lib/nav.ts";
import { apiQuery, useApiMutation } from "../../../lib/queries.ts";
import { appWorkbenchServices } from "../../../lib/workbench-services.ts";
import { Button } from "../../../ui/kit/Button.tsx";
import { Card, Chip, EmptyState, Page, PageHeader } from "../../../ui/kit/basics.tsx";
import { Callout } from "../../../ui/kit/Controls.tsx";
import { Switch } from "../../../ui/kit/Field.tsx";
import { LoadingState } from "../../../ui/kit/QueryState.tsx";
import { toast } from "../../../ui/kit/Toast.tsx";
import { ServicesGate } from "../../../workbench/ServicesGate.tsx";
import { Workbench } from "../../../workbench/Workbench.tsx";
import {
  exportMarks,
  filterExamples,
  fromGenerated,
  fromLessons,
  type ListenExample,
  type ListenStatus,
  marksByRef,
  type PackSounds,
  SOUND_VERDICTS,
  SOUNDS_UNIT,
  soundItems,
  statusOf,
  VERDICT_LABEL,
  VERDICTS,
  type Verdict,
} from "../-lib/listen.ts";
import { DevGate } from "./DevGate.tsx";

const generated = import.meta.glob<unknown>("../../../../../content/.generated/examples.json", {
  import: "default",
});
const lessonFiles = import.meta.glob<LessonDef>("../../../../../content/core/**/lesson.ts", {
  import: "default",
});

async function loadExamples(): Promise<{ examples: ListenExample[]; source: "generated" | "lessons" }> {
  const gen = Object.values(generated)[0];
  if (gen) {
    const examples = fromGenerated(await gen());
    if (examples.length > 0) return { examples, source: "generated" };
  }
  const lessons: LessonDef[] = [];
  for (const load of Object.values(lessonFiles)) {
    try {
      lessons.push(await load());
    } catch (e) {
      console.warn("oak: a lesson failed to load", e);
    }
  }
  return { examples: fromLessons(lessons), source: "lessons" };
}

/** The pack's curated sounds: aliases (GM and sample-backed), soundfonts, the plain sample maps, breaks and one-shots. */
async function loadSounds(): Promise<ListenExample[]> {
  const res = await fetch("/sounds/manifest.json", { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`the sound pack manifest answered ${res.status}`);
  const m = (await res.json()) as {
    aliases?: Record<string, unknown>;
    sampleAliases?: Record<string, unknown>;
    soundfonts?: Record<string, unknown>;
    sampleMaps?: { json: string; tag?: string }[];
  };
  const samples: Record<string, string[]> = {};
  for (const map of m.sampleMaps ?? []) {
    // Oak's kits are heard through their banks; breaks and one-shots (v4) are listed by name.
    if (map.tag && map.tag !== "oak-breaks" && map.tag !== "oak-perc") continue;
    const r = await fetch(map.json, { headers: { Accept: "application/json" } });
    if (!r.ok) continue;
    const names = Object.keys((await r.json()) as Record<string, unknown>);
    samples[
      map.json
        .split("/")
        .at(-1)
        ?.replace(/\.json$/, "") ?? map.json
    ] = names;
  }
  const pack: PackSounds = {
    aliases: [...Object.keys(m.aliases ?? {}), ...Object.keys(m.sampleAliases ?? {})],
    soundfonts: Object.keys(m.soundfonts ?? {}),
    samples,
  };
  return soundItems(pack);
}

const ALL_UNLOCKED: ReadonlySet<UnlockableId> = new Set(toolbox.map((t) => t.id as UnlockableId));
const lintFor = (e: ListenExample): LintContext => ({
  profile: "content",
  unlocked: ALL_UNLOCKED,
  allowPreview: true,
  meter: e.meter,
  key: e.key,
});

const STATUS_CHIP: Record<ListenStatus, { label: string; tone: "neutral" | "accent" | "amber" | "issue" }> = {
  unmarked: { label: "not heard", tone: "neutral" },
  ok: { label: "OK", tone: "accent" },
  flagged: { label: "flagged", tone: "issue" },
  changed: { label: "changed since", tone: "amber" },
};

export function ListenPage() {
  usePageTitle("Listening pass");
  return (
    <DevGate>
      <ListenBody />
    </DevGate>
  );
}

function ListenBody() {
  const examples = useQuery({
    queryKey: ["dev-listen", "examples"],
    queryFn: loadExamples,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const sounds = useQuery({
    queryKey: ["dev-listen", "sounds"],
    queryFn: loadSounds,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const marksQ = useQuery(apiQuery("dev.listen"));
  const save = useApiMutation("dev.listenMark", ["dev.listen"]);
  const [unit, setUnit] = useState<string | null>(SOUNDS_UNIT);
  const [needsListen, setNeedsListen] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [awake, setAwake] = useState(false);
  const [note, setNote] = useState("");
  const [cps, setCps] = useState(0.5);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);

  const all = [...(sounds.data ?? []), ...(examples.data?.examples ?? [])];
  const marks = marksByRef(marksQ.data?.items ?? []);
  const list = filterExamples(all, marks, { unit, needsListen });
  const units = [SOUNDS_UNIT, ...[...new Set((examples.data?.examples ?? []).map((e) => e.unit))].sort()];
  const current = all.find((e) => e.ref === selected) ?? null;
  const storeDown = marksQ.isError;
  const notBuilt = marksQ.error instanceof OakApiError && marksQ.error.code === "not_implemented";

  const play = (ref: string) => {
    setSelected(ref);
    setPlaying(true);
    setAwake(true);
    setNote(marks[ref]?.note ?? "");
  };

  // Auto-advance once the item has played through.
  useEffect(() => {
    if (advance.current) clearTimeout(advance.current);
    if (!autoAdvance || !current || !playing) return;
    advance.current = setTimeout(
      () => {
        const i = list.findIndex((e) => e.ref === current.ref);
        const next = list[i + 1];
        if (next) play(next.ref);
      },
      (current.bars / Math.max(0.05, cps)) * 1000 + 400,
    );
    return () => {
      if (advance.current) clearTimeout(advance.current);
    };
  }, [autoAdvance, current?.ref, playing, cps]);

  const mark = (verdict: Verdict) => {
    if (!current) return;
    save.mutate(
      { params: { ref: current.ref }, body: { hash: current.hash, verdict, note } },
      {
        onSuccess: () =>
          toast.success(`Saved: ${current.ref}`, verdict === "ok" ? undefined : VERDICT_LABEL[verdict]),
        onError: (e) => toast.error("Verdict not saved", e.message),
      },
    );
  };

  const download = () => {
    const blob = new Blob([exportMarks(marks)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "listen-log.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const heard = all.filter((e) => {
    const s = statusOf(e, marks[e.ref]);
    return s === "ok" || s === "flagged";
  }).length;
  const isSound = current?.unit === SOUNDS_UNIT;
  const verdicts = isSound ? SOUND_VERDICTS : VERDICTS.map((v) => ({ verdict: v, label: VERDICT_LABEL[v] }));
  const currentMark = current ? marks[current.ref] : undefined;
  const currentStatus = current ? statusOf(current, currentMark) : "unmarked";

  let lastGroup: string | undefined;
  return (
    <Page width="full" className="max-w-[1400px]">
      <PageHeader
        title="Listening pass"
        sub={`Every curated sound and every lesson example, heard once. ${heard} of ${all.length} have a current verdict.`}
        actions={
          <Button
            size="sm"
            icon={<Download aria-hidden className="size-4" />}
            onClick={download}
            disabled={Object.keys(marks).length === 0}
          >
            Export verdicts
          </Button>
        }
      />
      {storeDown && (
        <Callout tone="attention" title="Verdicts cannot be saved right now" className="mb-4">
          {notBuilt
            ? "The server's listening-log endpoint is not built yet. You can still play everything."
            : "The server did not answer for the listening log. You can still play everything."}
        </Callout>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <Card className="flex max-h-[calc(100dvh-210px)] min-h-[360px] flex-col p-0">
          <div className="flex flex-col gap-2 border-b border-border p-3">
            <div className="flex items-center gap-2 text-sm text-text-2">
              <label htmlFor="listen-filter">List</label>
              <select
                id="listen-filter"
                value={unit ?? ""}
                onChange={(e) => setUnit(e.target.value || null)}
                className="h-8 flex-1 rounded-control border border-border bg-surface px-2 text-text"
              >
                <option value="">Everything</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u === SOUNDS_UNIT ? "Sounds of the pack" : `${u} examples`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span id="listen-needs">Only what needs a listen</span>
              <Switch checked={needsListen} onChange={setNeedsListen} describedBy="listen-needs" />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span id="listen-auto">Play the next one after each</span>
              <Switch checked={autoAdvance} onChange={setAutoAdvance} describedBy="listen-auto" />
            </div>
          </div>
          {examples.isPending || sounds.isPending ? (
            <div className="p-3">
              <LoadingState rows={4} label="Loading sounds and examples" />
            </div>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="listen-list">
              {sounds.isError && (unit === SOUNDS_UNIT || unit === null) && (
                <li className="p-2 text-sm text-text-2">
                  The sound pack did not load: {String(sounds.error)}
                </li>
              )}
              {list.map((e) => {
                const st = statusOf(e, marks[e.ref]);
                const chip = STATUS_CHIP[st];
                const header = e.group && e.group !== lastGroup ? e.group : null;
                lastGroup = e.group;
                return [
                  header && (
                    <li key={`g-${header}`} className="px-2 pt-3 pb-1 text-sm font-semibold text-text-2">
                      {header}
                    </li>
                  ),
                  <li
                    key={e.ref}
                    data-ref={e.ref}
                    data-status={st}
                    className={clsx(
                      "flex items-center gap-2 rounded-control px-1 py-0.5",
                      e.ref === selected && "bg-lane-in",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => play(e.ref)}
                      aria-label={`Play ${e.ref}`}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-2 hover:text-text"
                    >
                      <Play aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left font-mono text-sm hover:underline"
                      onClick={() => {
                        setSelected(e.ref);
                        setNote(marks[e.ref]?.note ?? "");
                      }}
                      aria-current={e.ref === selected ? "true" : undefined}
                    >
                      {e.ref.replace(/^sound:/, "")}
                    </button>
                    <Chip tone={chip.tone} className="h-5 text-[0.75rem]">
                      {st === "flagged" ? VERDICT_LABEL[marks[e.ref]?.verdict ?? "weak"] : chip.label}
                    </Chip>
                  </li>,
                ];
              })}
              {list.length === 0 && (
                <li className="p-3 text-sm text-text-2">
                  {needsListen ? "Everything here has a current verdict." : "Nothing matches this filter."}
                </li>
              )}
            </ul>
          )}
        </Card>
        <section aria-label="Selected item" className="flex min-w-0 flex-col gap-3">
          {current ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-mono text-h3">{current.ref}</h2>
                <p className="text-sm text-text-2">
                  {isSound
                    ? `${current.group} · demo in C`
                    : `${current.unit} · ${current.bars} bars · ${current.meter}`}
                  {currentMark &&
                    ` · verdict: ${VERDICT_LABEL[currentMark.verdict]}${currentStatus === "changed" ? " (code changed since)" : ""}`}
                </p>
              </div>
              {awake ? (
                <ServicesGate load={appWorkbenchServices} auto>
                  <Workbench
                    key={current.ref}
                    id="dev-listen"
                    code={current.code}
                    lessonCtx={{
                      key: current.key,
                      meter: current.meter,
                      defaultBpm: 96,
                      loopBars: current.bars,
                    }}
                    lint={lintFor(current)}
                    views={["roll", "staff"]}
                    readOnly
                    variant="compact"
                    autoPlay={playing}
                    onModel={(m) => setCps(m.cps)}
                  />
                </ServicesGate>
              ) : (
                <Card className="flex flex-col items-start gap-2 p-4">
                  <pre className="w-full overflow-auto font-mono text-sm whitespace-pre-wrap">
                    {current.code}
                  </pre>
                  <Button
                    variant="primary"
                    icon={<Play aria-hidden className="size-4" />}
                    onClick={() => play(current.ref)}
                  >
                    Play
                  </Button>
                </Card>
              )}
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="sr-only">Verdict</legend>
                <div className="flex flex-wrap gap-2">
                  {verdicts.map((v) => {
                    const pressed = currentMark?.verdict === v.verdict && currentMark.hash === current.hash;
                    return (
                      <Button
                        key={v.verdict}
                        size="sm"
                        variant={pressed ? "primary" : "secondary"}
                        aria-pressed={pressed}
                        disabled={storeDown}
                        loading={save.isPending && save.variables?.body.verdict === v.verdict}
                        onClick={() => mark(v.verdict)}
                      >
                        {v.label}
                      </Button>
                    );
                  })}
                </div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    isSound ? "What to replace it with, or what is wrong" : "What sounds wrong, and where"
                  }
                  aria-label="Note for the verdict"
                  maxLength={2000}
                  className="h-8 rounded-control border border-border bg-surface px-2 text-text"
                />
                <p className="text-sm text-text-2">The note is saved with the verdict you press.</p>
              </fieldset>
            </>
          ) : (
            <EmptyState title="Pick something to hear">
              Press ▶ beside a sound or an example. With “Play the next one after each” on, the list plays
              through.
            </EmptyState>
          )}
        </section>
      </div>
    </Page>
  );
}
