// Version history (ux §2.3 "Versions"): every saved version, newest first; named versions (Mod+S) stand out.
// "Compare" sets that version as B of an A/B against what is in the editor now; "Open" puts its code back in
// the editor (the next Run saves it as the newest version; history is never rewritten). Oak 2.0 W1: a jam take has
// a "take" chip; a cut take is hidden unless the learner shows cut takes (it is never deleted); while Jam is on there
// is no Compare.
import type { SketchVersion } from "@oak/api";
import { clsx } from "clsx";
import { useState } from "react";
import { formatDate } from "../lib/format.ts";
import { Chip } from "../ui/kit/basics.tsx";
import { isNamed, needsReview, sinceText } from "./model.ts";
import { showCutWords } from "./takes.ts";

export function VersionHistory({
  versions,
  current,
  comparing,
  onCompare,
  onOpen,
  showCut = false,
  onShowCut,
  compare = true,
}: {
  versions: readonly SketchVersion[];
  current: number;
  comparing: number | null;
  onCompare(v: SketchVersion | null): void;
  onOpen(v: SketchVersion): void;
  /** Oak 2.0 W1: list cut takes too (shared with the takes panel). */
  showCut?: boolean;
  onShowCut?(show: boolean): void;
  /** Oak 2.0 W1: false while Jam is on (no A/B compare). */
  compare?: boolean;
}) {
  const [namedOnly, setNamedOnly] = useState(false);
  const now = Date.now();
  const cutCount = versions.filter((v) => v.takeState === "cut").length;
  const list = [...versions]
    .reverse()
    .filter((v) => !namedOnly || isNamed(v) || v.version === current)
    .filter((v) => showCut || v.takeState !== "cut" || v.version === current);
  return (
    <section aria-labelledby="versions-title" className="flex flex-col gap-2" data-testid="version-history">
      <div className="flex items-center justify-between gap-2">
        <h2 id="versions-title" className="font-sans text-sm font-semibold text-text-2">
          Versions <span className="font-normal text-text-3">({versions.length})</span>
        </h2>
        <label className="flex items-center gap-1.5 text-sm text-text-2">
          <input
            type="checkbox"
            checked={namedOnly}
            onChange={(e) => setNamedOnly(e.target.checked)}
            className="accent-[var(--oak-accent)]"
          />
          Named only
        </label>
      </div>
      {cutCount > 0 && onShowCut ? (
        <label className="flex items-center gap-1.5 self-end text-sm text-text-2">
          <input
            type="checkbox"
            checked={showCut}
            onChange={(e) => onShowCut(e.target.checked)}
            className="accent-[var(--oak-accent)]"
          />
          {showCutWords(cutCount)}
        </label>
      ) : null}
      <ol className="flex max-h-[28rem] flex-col gap-1 overflow-auto pr-1">
        {list.map((v) => {
          const named = isNamed(v);
          const isCurrent = v.version === current;
          const isComparing = comparing === v.version;
          return (
            <li
              key={v.version}
              className={clsx(
                "rounded-control border px-2.5 py-2",
                isComparing ? "border-accent bg-lane-in" : "border-border bg-surface",
              )}
              data-testid="version-row"
              data-version={v.version}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={clsx("min-w-0 truncate", named ? "font-semibold text-text" : "text-text")}>
                  v{v.version}
                  {named ? <span className="font-normal"> · {v.note}</span> : null}
                </span>
                <span className="shrink-0 text-sm text-text-3">
                  {sinceText(v.createdAt, now, (iso) => formatDate(iso, true))}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {isCurrent ? <Chip tone="accent">newest</Chip> : null}
                {v.tutorAssisted ? <Chip tone="amber">tutor-assisted</Chip> : null}
                {v.flags.lockedTools.length > 0 ? <Chip tone="amber">tools ahead</Chip> : null}
                {needsReview(v) ? <Chip tone="issue">imported</Chip> : null}
                {v.takeState ? (
                  <Chip tone="neutral" data-testid="take-chip">
                    {v.takeState === "kept" ? "kept take" : v.takeState === "cut" ? "cut take" : "take"}
                  </Chip>
                ) : null}
                <span className="ml-auto flex gap-1">
                  {compare ? (
                    <button
                      type="button"
                      className="rounded-control px-2 py-0.5 text-sm text-link hover:bg-surface-2"
                      aria-pressed={isComparing}
                      aria-label={`${isComparing ? "Stop comparing with" : "Compare with"} version ${v.version}`}
                      onClick={() => onCompare(isComparing ? null : v)}
                    >
                      {isComparing ? "Comparing" : "Compare"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-control px-2 py-0.5 text-sm text-link hover:bg-surface-2"
                    aria-label={`Open version ${v.version} in the editor`}
                    onClick={() => onOpen(v)}
                  >
                    Open
                  </button>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
