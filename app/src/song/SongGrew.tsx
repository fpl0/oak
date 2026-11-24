// The Coda's "Your song grew" (spec 2026-11-24 §5.5 "Coda"), in place of "Sketch saved" for a take lesson: the song's
// cover grows today's ring, the cells today's Make took fill in bar by bar, and two buttons play the song before
// today and with today. When the song can go to the album, the Release card follows (`SongRelease`; also on the
// Coda of the day that completes the song's `releaseAfter`: a checkpoint, or a lesson, a side step included).
import type { LessonId, UnitId, UnitSongDef } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { Disc3 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { songStepOf, unitSongOfUnit } from "../../../content/unit-songs/index.ts";
import { idempotencyKey } from "../lib/idempotency.ts";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { Card } from "../ui/kit/basics.tsx";
import { useIntroducedTerms, useReleaseSong, useUnitSong } from "./hooks.ts";
import { beforeId, nowId, ofUnit } from "./ids.ts";
import { songBandOf, songViewOf } from "./model.ts";
import { ringTonesOf, SongCover } from "./SongCover.tsx";
import { SongGrid } from "./SongGrid.tsx";
import { SongPlayButton } from "./SongPlayButton.tsx";
import {
  cellsHeldBy,
  detailBefore,
  grewSentence,
  newestTakeOfLesson,
  partsPlayedByTake,
  releaseOffer,
} from "./surfaces-model.ts";

export function SongGrew({
  lessonId,
  song: given,
  fallback = null,
  sketchIds,
  release = null,
}: {
  lessonId: string;
  song?: UnitSongDef;
  /** What to show when the lesson is not a take of a song, or its take is not in the song (the sketch card). */
  fallback?: ReactNode;
  /**
   * The sketches the session saved: today's take is the one made from one of them. A take of the lesson from an
   * earlier run never stands for today's (a redo whose take did not reach the song shows the sketch card instead).
   */
  sketchIds?: readonly string[];
  /**
   * The unit whose song this day lets the learner release (`songReleasedBy`): its Release card follows whatever this
   * shows, the sketch card too (a release point that is a side step, a take that did not reach the song).
   */
  release?: string | null;
}) {
  const found = given
    ? { song: given, step: given.plan.find((p) => p.lesson === lessonId) ?? null }
    : songStepOf(lessonId as LessonId);
  const def = found?.song ?? null;
  const take = found?.step?.kind === "take";
  const q = useUnitSong(def && take ? def.unit : null);
  const introduced = useIntroducedTerms();
  const releaseCard = (shown: string | null) =>
    release && release !== shown ? (
      <SongRelease unitId={release} {...(def && def.unit === release ? { song: def } : {})} />
    ) : null;
  if (!def || !take)
    return (
      <>
        {fallback}
        {releaseCard(null)}
      </>
    );
  const detail = q.data ?? null;
  const mine = newestTakeOfLesson(detail, lessonId, sketchIds);
  if (!detail || !mine)
    return (
      <>
        {fallback}
        {detail && detail.status !== "new" && (
          <p className="text-sm text-text-2" role="status" data-testid="coda-song-missing">
            Today's Make has not reached your song yet: it is kept as a sketch. If it is still not in the song
            later, redo the lesson to put it there.
          </p>
        )}
        {releaseCard(null)}
      </>
    );
  const view = songViewOf(def, detail, introduced);
  const held = cellsHeldBy(def, detail, mine.id);
  // Today's cells fill in section by section, from the first bar of the song on (the grid's own order).
  const heldSet = new Set<string>(held);
  const fresh = new Set<string>(
    view.cells.map((c) => `${c.part}@${c.section}`).filter((k) => heldSet.has(k)),
  );
  const before = detailBefore(detail, mine.id);
  const sentence = grewSentence(view, held, partsPlayedByTake(def, mine));
  return (
    <>
      <Card className="flex flex-col gap-4 p-5 animate-fade-in" data-testid="coda-song-grew">
        <div className="flex items-start gap-4">
          <SongCover
            seed={def.unit}
            flavour={view.flavour}
            tones={ringTonesOf(def, detail.takes)}
            size={104}
            grow
            className="shrink-0 rounded-[10px] shadow-card"
            label={`The cover of “${view.title}”, ${detail.takes.length} ${detail.takes.length === 1 ? "ring" : "rings"}`}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-h2">Your song grew</h2>
            <p className="font-display text-lg leading-tight">{view.title}</p>
            {sentence && (
              <p className="text-text-2" data-testid="coda-song-sentence">
                {sentence}
              </p>
            )}
          </div>
        </div>
        <SongGrid view={view} fresh={fresh} follows={ofUnit(def.unit)} />
        <div className="flex flex-wrap items-center gap-2">
          <SongPlayButton
            id={beforeId(def.unit, mine.id)}
            band={songBandOf(def, before, { flavour: view.flavour })}
            label="Before today"
            ariaLabel={`Play “${view.title}” as it was before today`}
            options={{ title: view.title }}
            size="sm"
            data-testid="coda-song-before"
          />
          <SongPlayButton
            id={nowId(def.unit)}
            band={songBandOf(def, detail, { flavour: view.flavour })}
            label="With today"
            ariaLabel={`Play “${view.title}” with today's take`}
            options={{ title: view.title }}
            variant="primary"
            size="sm"
            data-testid="coda-song-after"
          />
          <span className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link
              to="/song/$unitId"
              params={{ unitId: def.unit }}
              className="text-link underline-offset-2 hover:underline"
            >
              Open the song
            </Link>
            <Link
              to="/studio/$sketchId"
              params={{ sketchId: mine.sketchId }}
              className="text-link underline-offset-2 hover:underline"
            >
              Open today's code in Studio
            </Link>
          </span>
        </div>
      </Card>
      <SongRelease unitId={def.unit} song={def} />
      {releaseCard(def.unit)}
    </>
  );
}

/** The unit whose song a lesson or checkpoint lets the learner release (its `releaseAfter`), or `null`. */
export function songReleasedBy(
  mapItemId: string | null | undefined,
  songs: readonly UnitSongDef[],
): string | null {
  if (!mapItemId) return null;
  return songs.find((s) => s.releaseAfter === mapItemId)?.unit ?? null;
}

/**
 * The Release card (spec §5.4, §5.5): shown when the song can go to the album (or go again after it changed). It
 * releases a frozen copy under the title in the field; later lessons still change the song, never the release.
 */
export function SongRelease({ unitId, song: given }: { unitId: string; song?: UnitSongDef }) {
  const def = given ?? unitSongOfUnit(unitId as UnitId);
  const q = useUnitSong(def ? unitId : null);
  const release = useReleaseSong();
  const [title, setTitle] = useState<string | null>(null);
  const [key] = useState(() =>
    `song-release-${idempotencyKey()}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64),
  );
  const [done, setDone] = useState<{ albumTrackId: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const detail = q.data ?? null;
  if (!def || !detail) return null;
  const offer = releaseOffer(detail);
  if (!done && offer !== "release" && offer !== "again") return null;
  const name = title ?? detail.title;
  const go = async () => {
    setError(null);
    try {
      const out = await release.mutateAsync({
        params: { unitId: unitId as UnitId },
        body: { title: name.trim(), idempotencyKey: key },
      });
      setDone({ albumTrackId: out.albumTrackId, title: name.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The song was not released.");
    }
  };
  return (
    <Card
      className="flex flex-col gap-3 border-accent/50 bg-lane-in p-5 animate-fade-in"
      data-testid="song-release"
      data-offer={done ? "done" : offer}
    >
      <div className="flex items-start gap-4">
        <SongCover
          seed={def.unit}
          flavour={detail.flavour}
          tones={ringTonesOf(def, detail.takes)}
          size={72}
          grow={done !== null}
          className="shrink-0 rounded-[8px]"
        />
        <div className="min-w-0">
          {done ? (
            <>
              <h2 className="text-h3">“{done.title}” is on your album</h2>
              <p className="mt-0.5 text-sm text-text-2">
                A copy of the song as it is now. Lessons that change the song later leave this copy as it is.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-h3">
                {offer === "again" ? "Your song changed" : "Your song is ready for the album"}
              </h2>
              <p className="mt-0.5 text-sm text-text-2">
                {offer === "again"
                  ? "Release it again and the album gets this version beside the earlier one."
                  : "Release it and a copy of the song as it is now joins your album. Later lessons can still change the song."}
              </p>
            </>
          )}
        </div>
      </div>
      {done ? (
        <div className="flex flex-wrap gap-2">
          <Link
            to="/album/$trackId"
            params={{ trackId: done.albumTrackId }}
            className={buttonClass("primary", "sm")}
            data-testid="song-release-open"
          >
            Open it on the album
          </Link>
          <Link to="/song/$unitId" params={{ unitId: def.unit }} className={buttonClass("secondary", "sm")}>
            Open the song
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label htmlFor={fieldId} className="flex min-w-[14rem] flex-1 flex-col gap-1">
            <span className="text-sm font-medium">Title on the album</span>
            <input
              id={fieldId}
              type="text"
              value={name}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 rounded-control border border-control-border bg-control px-2.5"
            />
          </label>
          <Button
            variant="primary"
            icon={<Disc3 aria-hidden className="size-4" />}
            loading={release.isPending}
            disabled={!name.trim()}
            onClick={() => void go()}
            data-testid="song-release-go"
          >
            {offer === "again" ? "Release again" : "Release to the album"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-issue">
          {error}
        </p>
      )}
    </Card>
  );
}
