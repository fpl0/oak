// The right column of Today (ux §1.4): the next unlock (goal gradient), the Oak in miniature, the album's first
// slots, the last sketch and Claude's one-line note. Each card renders its own loading and empty state and links
// out to the full surface.

import type { NextUnlock } from "@oak/api";
import { ALBUM_SIDES } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Disc3, Sprout } from "lucide-react";
import { TrackCover } from "../../album/TrackCover.tsx";
import { useContent } from "../../lib/content.ts";
import { useAlbum, useBootstrap, useCourseProgress, useNextUnlocks, useSketches } from "../../lib/queries.ts";
import { useUnlockedSet } from "../../lib/unlocked.ts";
import { useMediaQuery } from "../../lib/use-media.ts";
import { OakGlance as MapGlance } from "../../map/index.ts";
import { takeStepsOf } from "../../song/AlbumSongs.tsx";
import { useUnitSongs } from "../../song/hooks.ts";
import { Markdown } from "../../tutor/Markdown.tsx";
import { AcornIcon, LeafIcon, RingIcon } from "../../ui/icons/index.tsx";
import { Card, Skeleton } from "../../ui/kit/basics.tsx";
import { capstoneDayTitle } from "../capstone-day.ts";
import { goalGradient } from "../coda-model.ts";
import { isWritten, unitTitleOf } from "../edge.ts";
import { albumStripSlotsAB, doneItems, nextUnlocksFrom } from "../progress-model.ts";
import { songReadyLine } from "../today-model.ts";
import { toolName as toolLabel } from "../tool-name.ts";

function CardTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold text-text-2">
      {icon}
      {children}
    </h2>
  );
}

/** The server's `/unlocks/next`; while that is not available, the same count along the default order. */
export function useNextUnlockList(): { items: NextUnlock[] | null; pending: boolean } {
  const next = useNextUnlocks();
  const content = useContent();
  const course = useCourseProgress();
  const boot = useBootstrap();
  if (next.data) return { items: next.data.items, pending: false };
  if (!next.isError) return { items: null, pending: true };
  if (!content.data?.syllabus || !course.data || !boot.data)
    return { items: null, pending: content.isPending || course.isPending || boot.isPending };
  return {
    items: nextUnlocksFrom(
      content.data.syllabus.defaultOrder,
      doneItems(course.data),
      content.data.toolbox,
      new Set(boot.data.unlocks.map((u) => u.itemId as string)),
    ),
    pending: false,
  };
}

export function NextUnlockCard() {
  const content = useContent();
  const { items, pending } = useNextUnlockList();
  const first = items?.[0];
  const tool = first ? content.data?.toolbox.find((t) => t.id === first.itemId) : undefined;
  const label = tool ? toolLabel(tool) : null;
  const authored = new Set((content.data?.lessons ?? []).map((l) => l.id as string));
  // A tool granted by a lesson nobody has written yet: its count ("4 lessons to …") would not move, so the card
  // says where it comes from instead.
  const grantedUnwritten = !!first && content.data !== undefined && !isWritten(first.grantedBy, authored);
  return (
    <Card className="p-4" data-testid="next-unlock">
      <CardTitle icon={<AcornIcon size={16} />}>Next unlock</CardTitle>
      {pending ? (
        <Skeleton className="h-10 w-full" />
      ) : first ? (
        <div className="flex flex-col gap-1">
          <p data-testid="goal-gradient">
            {grantedUnwritten
              ? `Arrives with ${unitTitleOf(content.data?.syllabus ?? null, first.grantedBy)}, which is still being written: `
              : goalGradient(first, "")}
            {label?.mono === false ? (
              <span className="font-medium">{label.text}</span>
            ) : (
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm">
                {label?.text ?? first.itemId}
              </code>
            )}
          </p>
          {tool?.concept && <p className="text-sm text-text-2">{tool.concept}</p>}
          <Link
            to="/toolbox/$toolId"
            params={{ toolId: first.itemId }}
            className="text-sm text-link underline-offset-2 hover:underline"
          >
            Hear what it does
          </Link>
        </div>
      ) : (
        <p className="text-sm text-text-2">
          Everything on the course map so far is in your{" "}
          <Link to="/toolbox" className="text-link underline-offset-2 hover:underline">
            toolbox
          </Link>
          .
        </p>
      )}
    </Card>
  );
}

/**
 * A finished song waiting for the album (spec 2026-11-24 §5.5): one quiet line at the top of the right column, so it
 * sits beside the session card and never pushes Start down. It goes once the song is released (`songReadyLine`).
 */
export function SongReadyCard() {
  const songs = useUnitSongs();
  const line = songReadyLine(songs.data?.items ?? [], takeStepsOf);
  if (!line) return null;
  return (
    <Card className="p-4" data-testid="today-song-ready">
      <p className="flex items-start gap-2 text-sm text-text-2">
        <Disc3 aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        <span>{line.text}</span>
      </p>
      <Link
        to="/song/$unitId"
        params={{ unitId: line.unitId }}
        className="mt-1 ml-6 inline-flex min-h-6 items-center text-sm text-link underline-offset-2 hover:underline"
        aria-label={`Open “${line.title}” to release it`}
        data-testid="today-song-ready-open"
      >
        Open the song
      </Link>
    </Card>
  );
}

/** The Oak in miniature (the map's thumbnail, ux §1.4): every leaf in the strand × unit grid, shaded by freshness. */
export function OakGlanceCard() {
  const wide = useMediaQuery("(min-width: 1400px)");
  return (
    <Card className="p-4">
      <CardTitle icon={<LeafIcon size={16} />}>The Oak</CardTitle>
      <MapGlance width={wide ? 240 : 180} />
    </Card>
  );
}

/** The album's slots around where the learner is: the last ones filled and the next one to fill (Side A). */
export function AlbumStrip() {
  const album = useAlbum();
  const content = useContent();
  const course = useCourseProgress();
  const released = new Set((album.data?.tracks ?? []).map((t) => t.capstoneId as string | null));
  const slots = albumStripSlotsAB(
    content.data?.capstones ?? [],
    (content.data?.syllabus?.defaultOrder ?? []) as readonly string[],
    released,
    new Map(
      (album.data?.tracks ?? []).flatMap((t) =>
        t.capstoneId ? [[t.capstoneId as string, t.createdAt]] : [],
      ),
    ),
    ALBUM_SIDES.find((s) => s.side === "B")?.capstones ?? [],
    3,
  );
  return (
    <Card className="p-4" data-testid="album-strip">
      <CardTitle icon={<RingIcon size={16} />}>Album</CardTitle>
      {album.isPending || content.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <>
          <ul className="flex gap-3">
            {slots.map((c) => {
              const track = album.data?.tracks.find((t) => t.capstoneId === c.id);
              const status = course.data?.capstones.find((s) => s.capstoneId === c.id)?.status ?? "locked";
              return (
                <li key={c.id} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                  {track ? (
                    <Link
                      to="/album/$trackId"
                      params={{ trackId: track.id }}
                      aria-label={`${track.title}, released`}
                    >
                      <TrackCover track={track} size={56} />
                    </Link>
                  ) : (
                    <span
                      aria-hidden
                      className={clsx(
                        "block size-14 rounded-full border-2 border-dashed",
                        status === "locked" ? "border-border" : "border-accent/60",
                      )}
                    />
                  )}
                  <span
                    className="line-clamp-2 w-full break-words text-[0.75rem] leading-tight text-text-2"
                    title={capstoneDayTitle(c.title)}
                    data-slot={c.id}
                  >
                    {capstoneDayTitle(c.title)}
                  </span>
                  <span className="sr-only">
                    {track ? "released" : status === "locked" ? "not open yet" : status.replace("_", " ")}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link
            to="/album"
            className="mt-2 inline-block text-sm text-link underline-offset-2 hover:underline"
          >
            {album.data?.tracks.length ? "Open the album" : "Your capstones become its tracks"}
          </Link>
        </>
      )}
    </Card>
  );
}

export function LastSketchCard() {
  const sketches = useSketches();
  const last = sketches.data?.items[0];
  return (
    <Card className="p-4" data-testid="last-sketch">
      <CardTitle icon={<Sprout aria-hidden className="size-4" />}>Last sketch</CardTitle>
      {sketches.isPending ? (
        <Skeleton className="h-5 w-32" />
      ) : last ? (
        <Link
          to="/studio/$sketchId"
          params={{ sketchId: last.id }}
          className="text-link underline-offset-2 hover:underline"
        >
          {last.title}
        </Link>
      ) : (
        <p className="text-sm text-text-2">Your sketchbook fills up one session at a time.</p>
      )}
    </Card>
  );
}

/** The note's thread on Today: a general one (its chips name what they name; no workbench to point into). */
const TODAY_THREAD = { subjectKind: "general", subjectId: "today" } as const;

/**
 * Claude's latest note, in the tutor's own markup: its music tokens (`[[deg:1]]`, `[[bars:3]]`) become the chips
 * the tutor panel shows (Wave 7 review: they were printed raw on Today, "steps up to [[deg:4]] in [[bars:3]]").
 */
export function TutorNoteCard({ note }: { note: string }) {
  const content = useContent();
  const { unlocked } = useUnlockedSet();
  return (
    <Card className="p-4 text-text-2" data-testid="tutor-note">
      <h2 className="mb-1 font-sans text-sm font-semibold text-text-2">Claude's note</h2>
      <Markdown
        text={note}
        thread={TODAY_THREAD}
        ctx={{
          terms: content.data?.terms ?? [],
          introduced: null,
          tools: content.data?.toolbox ?? [],
          unlocked: unlocked as ReadonlySet<string>,
        }}
      />
    </Card>
  );
}
