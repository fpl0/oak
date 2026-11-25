// Oak 2.0 W1 (PLAN §4 S3): the edit view after a jam. Each take: Play (sets it as the A/B target), Keep, Cut (cut =
// hidden, never deleted; "Show cut takes (n)" brings them back into view), its labelled lines with "Save line to
// scraps", and "Build a version": per label one take's line (or leave it out), saved as a new version whose code is
// plain Strudel in the editor. A take from an imported backup is only listed: it is never built from or saved as a
// scrap before it is reviewed (Review Focus 5).
import type { SketchDetail, SketchVersion, TakeState } from "@oak/api";
import { labelledLines, roleOfLabel, scrapCode } from "@oak/content-kit";
import { clsx } from "clsx";
import { type Ref, useState } from "react";
import { errorWords } from "../lib/error-words.ts";
import { formatDate } from "../lib/format.ts";
import { useApiMutation } from "../lib/queries.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Chip } from "../ui/kit/basics.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { needsReview, sinceText } from "./model.ts";
import { buildFromTakes, builtNote, showCutWords, TAKES_WORDS, takesOf } from "./takes.ts";

export function TakesPanel({
  sketch,
  showCut,
  onShowCut,
  comparing,
  onPlay,
  onBuild,
  headingRef,
}: {
  sketch: SketchDetail;
  showCut: boolean;
  onShowCut(show: boolean): void;
  /** The version set as the A/B target, if any. */
  comparing: number | null;
  /** Set a take as the A/B target (`null`: stop). */
  onPlay(v: SketchVersion | null): void;
  /** Save `code` as a new version (not a take) with `note`, and open it in the editor. */
  onBuild(code: string, note: string): Promise<void>;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const patchVersion = useApiMutation("sketches.patchVersion", ["sketches.get"]);
  const saveScrap = useApiMutation("scraps.create", ["scraps.list"]);
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [picks, setPicks] = useState<Readonly<Record<string, number>>>({});
  const [building, setBuilding] = useState(false);
  const takes = takesOf(sketch.versions, { showCut });
  const cutCount = sketch.versions.filter((v) => v.takeState === "cut").length;
  const now = Date.now();

  // Build options: per label, the takes (newest first) that have it; imported takes are left out until reviewed.
  const buildable = takes.filter((t) => !needsReview(t));
  const order: string[] = [];
  for (const t of [...buildable].sort((a, b) => a.version - b.version))
    for (const l of labelledLines(t.code)) if (!order.includes(l.label)) order.push(l.label);
  const labels = order.map((label) => ({
    label,
    takes: buildable.filter((t) => labelledLines(t.code).some((l) => l.label === label)),
  }));
  const activePicks = Object.fromEntries(
    Object.entries(picks).filter(([label, v]) =>
      labels.some((l) => l.label === label && l.takes.some((t) => t.version === v)),
    ),
  );

  const mark = async (v: SketchVersion, takeState: TakeState) => {
    try {
      await patchVersion.mutateAsync({
        params: { id: sketch.id, version: String(v.version) },
        body: { takeState },
      });
      if (takeState === "cut" && comparing === v.version) onPlay(null);
    } catch (e) {
      toast.error(TAKES_WORDS.changeError, errorWords(e));
    }
  };

  const saveLine = async (v: SketchVersion, label: string) => {
    const line = labelledLines(v.code).find((l) => l.label === label);
    const code = line ? scrapCode(v.code, line) : null;
    if (!line || code === null) return;
    try {
      await saveScrap.mutateAsync({
        body: {
          role: roleOfLabel(label),
          label,
          code,
          bpm: v.bpm,
          meter: v.meter,
          key: v.key,
          sourceKind: "sketch",
          sourceRef: `${sketch.id}@${v.version}`,
        },
      });
      setSaved((s) => new Set([...s, `${v.version}:${label}`]));
      toast.success(TAKES_WORDS.savedLine);
    } catch (e) {
      toast.error(TAKES_WORDS.saveError, errorWords(e));
    }
  };

  const build = async () => {
    const code = buildFromTakes(buildable, activePicks);
    if (code === "") {
      toast.info(TAKES_WORDS.buildNothing);
      return;
    }
    setBuilding(true);
    try {
      await onBuild(code, builtNote(activePicks));
      setPicks({});
    } finally {
      setBuilding(false);
    }
  };

  return (
    <section aria-labelledby="takes-title" className="flex flex-col gap-2" data-testid="takes-panel">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="takes-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-sans text-sm font-semibold text-text-2 outline-none"
        >
          {TAKES_WORDS.title} <span className="font-normal text-text-3">({takes.length})</span>
        </h2>
        {cutCount > 0 ? (
          <label className="flex items-center gap-1.5 text-sm text-text-2">
            <input
              type="checkbox"
              checked={showCut}
              onChange={(e) => onShowCut(e.target.checked)}
              className="accent-[var(--oak-accent)]"
              data-testid="show-cut-takes"
            />
            {showCut ? TAKES_WORDS.hideCut : showCutWords(cutCount)}
          </label>
        ) : null}
      </div>
      <p className="text-sm text-text-3">{TAKES_WORDS.intro}</p>
      <ol className="flex max-h-[24rem] flex-col gap-1 overflow-auto pr-1">
        {takes.map((v) => {
          const isComparing = comparing === v.version;
          const imported = needsReview(v);
          return (
            <li
              key={v.version}
              className={clsx(
                "rounded-control border px-2.5 py-2 text-sm",
                isComparing ? "border-accent bg-lane-in" : "border-border bg-surface",
                v.takeState === "cut" && "opacity-70",
              )}
              data-testid="take-row"
              data-version={v.version}
              data-take-state={v.takeState ?? undefined}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-text">
                  {TAKES_WORDS.takesChip} {v.version}
                </span>
                <span className="text-text-3">
                  {sinceText(v.createdAt, now, (iso) => formatDate(iso, true))}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {v.takeState === "kept" ? <Chip tone="accent">{TAKES_WORDS.kept}</Chip> : null}
                {imported ? <Chip tone="issue">{TAKES_WORDS.imported}</Chip> : null}
                <span className="ml-auto flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded-control px-2 py-0.5 text-link hover:bg-surface-2"
                    aria-pressed={isComparing}
                    title={TAKES_WORDS.playTitle}
                    onClick={() => onPlay(isComparing ? null : v)}
                    data-testid="take-play"
                  >
                    {isComparing ? TAKES_WORDS.playing : TAKES_WORDS.play}
                  </button>
                  {v.takeState === "cut" ? (
                    <button
                      type="button"
                      className="rounded-control px-2 py-0.5 text-link hover:bg-surface-2"
                      onClick={() => void mark(v, "open")}
                      data-testid="take-bring-back"
                    >
                      {TAKES_WORDS.bringBack}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="rounded-control px-2 py-0.5 text-link hover:bg-surface-2"
                        aria-pressed={v.takeState === "kept"}
                        onClick={() => void mark(v, v.takeState === "kept" ? "open" : "kept")}
                        data-testid="take-keep"
                      >
                        {v.takeState === "kept" ? TAKES_WORDS.kept : TAKES_WORDS.keep}
                      </button>
                      <button
                        type="button"
                        className="rounded-control px-2 py-0.5 text-link hover:bg-surface-2"
                        onClick={() => void mark(v, "cut")}
                        data-testid="take-cut"
                      >
                        {TAKES_WORDS.cut}
                      </button>
                    </>
                  )}
                </span>
              </div>
              {!imported ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {labelledLines(v.code).map((l, i) => (
                    <li key={`${l.label}${i}`} className="flex items-center justify-between gap-2">
                      <code className="min-w-0 truncate font-mono text-text-2" title={l.text}>
                        {l.text}
                      </code>
                      <button
                        type="button"
                        className="shrink-0 rounded-control px-1.5 py-0.5 text-link hover:bg-surface-2 disabled:text-text-3"
                        disabled={saved.has(`${v.version}:${l.label}`)}
                        onClick={() => void saveLine(v, l.label)}
                        data-testid="take-save-line"
                      >
                        {saved.has(`${v.version}:${l.label}`) ? TAKES_WORDS.savedLine : TAKES_WORDS.saveLine}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>

      {labels.length > 0 ? (
        <form
          className="flex flex-col gap-2 rounded-control border border-border bg-surface px-2.5 py-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void build();
          }}
          data-testid="build-from-takes"
        >
          <h3 className="font-sans text-sm font-semibold text-text-2">{TAKES_WORDS.build}</h3>
          <p className="text-text-3">{TAKES_WORDS.buildIntro}</p>
          {labels.map(({ label, takes: having }) => (
            <fieldset key={label} className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 border-0 p-0">
              <legend className="float-left mr-2 font-mono text-text">{label}</legend>
              {having.map((t) => (
                <label key={t.version} className="flex items-center gap-1 text-text-2">
                  <input
                    type="radio"
                    name={`build-${label}`}
                    checked={activePicks[label] === t.version}
                    onChange={() => setPicks((p) => ({ ...p, [label]: t.version }))}
                    data-testid={`build-${label}-${t.version}`}
                  />
                  {TAKES_WORDS.takesChip} {t.version}
                </label>
              ))}
              <label className="flex items-center gap-1 text-text-2">
                <input
                  type="radio"
                  name={`build-${label}`}
                  checked={activePicks[label] === undefined}
                  onChange={() =>
                    setPicks((p) => {
                      const { [label]: _drop, ...rest } = p;
                      return rest;
                    })
                  }
                  data-testid={`build-${label}-out`}
                />
                {TAKES_WORDS.leaveOut}
              </label>
            </fieldset>
          ))}
          <div>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              loading={building}
              disabled={Object.keys(activePicks).length === 0}
              data-testid="build-takes"
            >
              {TAKES_WORDS.buildButton}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
