// The record: Side A, finished (content/specs/END.md "The record"; ux §5.3), and Side B, the eight track capstones
// in release order (Wave 7, wave7.md §5.5), drawn by the same component. Twelve covers in running order, the
// single last, the side's length, and one button that plays it from the first track to the last with a breath
// between tracks. Used as the header of `/album` once every core track is released, and by the finale Coda
// (`coda`: "Open the album" in place of the download). It never starts by itself, keeps playing while the page
// scrolls and stops when the learner leaves or presses Stop. A track without a recording is skipped and says so.
import type { AlbumTrackDetail } from "@oak/api";
import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { ArrowRight, Download, Play, Square } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import "./cover.css";
import { useCapstoneContent } from "../capstone/content.ts";
import { formatDuration } from "../lib/format.ts";
import { albumAudioUrl, apiQuery, useAlbum } from "../lib/queries.ts";
import { AlbumCover } from "../ui/AlbumCover.tsx";
import { Button, buttonClass } from "../ui/kit/Button.tsx";
import { Skeleton } from "../ui/kit/basics.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import {
  atTrackEnd,
  neighbourCover,
  nextPlayable,
  nowPlayingLine,
  type RecordTrack,
  recordFileName,
  recordTitleLine,
  type SideARecordView,
  sideRecord,
  TRACK_GAP_MS,
} from "./model.ts";
import { useCoverMusic } from "./music.ts";
import { useAlbumTitle } from "./title.ts";
import { zipStore } from "./zip.ts";

/** Side A as the album and the Coda read it: every core capstone in running order with its released track. */
export function useSideARecord(): { record: SideARecordView | null; isError: boolean; retry(): void } {
  return useSideRecord("A");
}

/** One side as a record (Wave 7: Side B holds the eight track capstones, in release order). */
export function useSideRecord(side: "A" | "B"): {
  record: SideARecordView | null;
  isError: boolean;
  retry(): void;
  /** Tracks whose detail (and so the version a cover grows from) is still on its way. */
  detailsPending: ReadonlySet<string>;
} {
  const album = useAlbum();
  const content = useCapstoneContent();
  const tracks = album.data?.tracks ?? [];
  const details = useQueries({
    queries: tracks.map((t) => apiQuery("album.track", { params: { id: t.id } })),
  });
  const detailsPending = new Set(tracks.flatMap((t, i) => (details[i]?.isPending ? [t.id] : [])));
  if (!album.data || !content.data)
    return {
      record: null,
      isError: album.isError || content.isError,
      retry: () => {
        void album.refetch();
        void content.refetch();
      },
      detailsPending,
    };
  const detailOf = new Map<string, AlbumTrackDetail>(
    details.flatMap((q) => (q.data ? [[q.data.id, q.data] as const] : [])),
  );
  return {
    record: sideRecord(side, tracks, detailOf, content.data.capstones),
    isError: false,
    retry: () => void album.refetch(),
    detailsPending,
  };
}

/** One recording sounds at a time on a page: every other `<audio>` pauses before this one plays. */
export function pauseOtherAudio(el: HTMLAudioElement | null): void {
  if (typeof document === "undefined") return;
  for (const a of document.querySelectorAll("audio")) if (a !== el && !a.paused) a.pause();
}

/** Fetches every recording of the side and hands the browser one archive. */
async function downloadSide(record: SideARecordView, albumTitle: string, side: "A" | "B"): Promise<number> {
  const entries = [];
  for (const t of record.playable) {
    if (!t.trackId || t.version === null) continue;
    const res = await fetch(albumAudioUrl(t.trackId, t.version), { credentials: "same-origin" });
    if (!res.ok) continue;
    entries.push({ name: recordFileName(t), data: new Uint8Array(await res.arrayBuffer()) });
  }
  if (entries.length === 0) return 0;
  const blob = new Blob([zipStore(entries) as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug =
    albumTitle
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "album";
  a.href = url;
  a.download = `${slug}-side-${side.toLowerCase()}.zip`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return entries.length;
}

export function SideARecord({ coda = false }: { coda?: boolean }) {
  return <SideRecord side="A" coda={coda} />;
}

/** One side of the record: its covers in running order, Play from first to last, its recordings in one archive. */
export function SideRecord({ side, coda = false }: { side: "A" | "B"; coda?: boolean }) {
  const { record, isError, retry, detailsPending } = useSideRecord(side);
  const low = side.toLowerCase();
  const sideName = `Side ${side}`;
  const album = useAlbumTitle();
  const audio = useRef<HTMLAudioElement>(null);
  const gap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const covers = useRef(new Map<number, HTMLButtonElement>());
  const [playing, setPlaying] = useState<RecordTrack | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [zipping, setZipping] = useState(false);
  const latest = useRef(record);
  latest.current = record;

  const clearGap = () => {
    if (gap.current) clearTimeout(gap.current);
    gap.current = null;
  };
  const stop = () => {
    clearGap();
    audio.current?.pause();
    setPlaying(null);
    setElapsed(0);
  };
  const play = (t: RecordTrack | null) => {
    clearGap();
    const el = audio.current;
    if (!t?.trackId || t.version === null || !el) {
      stop();
      return;
    }
    setPlaying(t);
    setElapsed(0);
    pauseOtherAudio(el);
    el.src = albumAudioUrl(t.trackId, t.version);
    void el.play().catch((err: unknown) => {
      // Stopped (or moved to another track) before it began: not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPlaying(null);
      toast.error("The record didn't start", `Press Play ${sideName} again.`);
    });
  };
  // At the end of a track: a breath, then the next one (the outline stays on the track that just ended until the
  // next begins); after the last, the record stops.
  const next = () => {
    const now = playing;
    const after = now && latest.current ? nextPlayable(latest.current, now.no) : null;
    if (!after) {
      stop();
      return;
    }
    gap.current = setTimeout(() => play(after), TRACK_GAP_MS);
  };
  // Leaving the page stops the record.
  useEffect(
    () => () => {
      if (gap.current) clearTimeout(gap.current);
    },
    [],
  );

  if (isError)
    return (
      <section aria-label={sideName} className="rounded-card border border-border bg-surface p-4">
        <p className="text-text-2">The record is not available right now.</p>
        <Button size="sm" className="mt-2" onClick={retry}>
          Try again
        </Button>
      </section>
    );
  if (!record)
    return (
      <section aria-label={sideName} aria-busy="true" data-testid={`side-${low}-record`} data-state="loading">
        <Skeleton className="mb-3 h-6 w-72" />
        <div className="grid grid-cols-4 gap-3 min-[1400px]:grid-cols-6">
          {Array.from({ length: side === "A" ? 12 : 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
        <Button variant="primary" className="mt-4" disabled icon={<Play aria-hidden className="size-4" />}>
          Play {sideName}
        </Button>
      </section>
    );

  const first = record.playable[0] ?? null;
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const coverNo = Number(target.closest<HTMLElement>("[data-cover-no]")?.dataset.coverNo ?? Number.NaN);
    if (e.key === " " && target.closest("[data-cover-no]")) {
      // Space anywhere on the covers is the record's play and stop (a cover's own action is Enter).
      e.preventDefault();
      if (e.type === "keydown") playing ? stop() : play(first);
      return;
    }
    if (e.type !== "keydown" || !Number.isFinite(coverNo)) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const next = neighbourCover(record, coverNo, e.key === "ArrowRight" ? 1 : -1);
      if (next) {
        e.preventDefault();
        covers.current.get(next.no)?.focus();
      }
    }
  };

  return (
    <section
      aria-labelledby={`side-${low}-heading`}
      className="flex flex-col gap-4"
      data-testid={`side-${low}-record`}
      data-state={playing ? "playing" : "stopped"}
      onKeyDown={onKey}
      onKeyUp={onKey}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: instrumental recordings of the learner's own pieces. */}
      <audio
        ref={audio}
        className="hidden"
        data-testid={`side-${low}-player`}
        onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        onPause={(e) => {
          // Paused from outside (another player on the page started): the record stops. The end of a track is not
          // a pause, and neither is the breath before the next one. A track can stop at its last sample without
          // "ended" (seen with a WAV whose last frame is read as the stream ends): that is its end too.
          if (gap.current !== null) return;
          if (e.currentTarget.ended || atTrackEnd(e.currentTarget)) {
            next();
            return;
          }
          setPlaying(null);
          setElapsed(0);
        }}
        onEnded={() => {
          if (gap.current === null) next();
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm tracking-[0.2em] text-text-3 uppercase">
            {sideName}
            {side === "B" ? " · the tracks" : ""}
          </p>
          <h2 id={`side-${low}-heading`} className="font-display text-h2" data-testid={`side-${low}-title`}>
            {/* On the album's own page the name stands above, as its heading. */}
            {coda
              ? recordTitleLine(album.title, record, side)
              : recordTitleLine(album.title, record, side).split(" · ").slice(2).join(" · ")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={record.playable.length === 0}
            title={record.playable.length === 0 ? "No track has a recording yet" : undefined}
            icon={
              playing ? <Square aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />
            }
            onClick={() => (playing ? stop() : play(first))}
            data-testid={`play-side-${low}`}
          >
            {playing ? "Stop" : `Play ${sideName}`}
          </Button>
          {coda ? (
            <Link to="/album" className={buttonClass("secondary")} data-testid="open-album">
              Open the album <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <Button
              icon={<Download aria-hidden className="size-4" />}
              loading={zipping}
              disabled={record.playable.length === 0}
              onClick={async () => {
                setZipping(true);
                try {
                  const n = await downloadSide(record, album.title, side);
                  if (n === 0) toast.info("No recording to download yet.");
                  else toast.success(`${n} ${n === 1 ? "recording" : "recordings"} in one archive.`);
                } catch (e) {
                  toast.error("The download didn't work", e instanceof Error ? e.message : undefined);
                } finally {
                  setZipping(false);
                }
              }}
              data-testid={`download-side-${low}`}
            >
              Download every recording
            </Button>
          )}
        </div>
      </div>
      <p className="min-h-6 text-sm text-text-2 tabular-nums" aria-live="polite" data-testid="now-playing">
        {playing
          ? nowPlayingLine(playing, record.total, elapsed)
          : record.playable.length < record.released
            ? `${record.released - record.playable.length} of ${record.released} released tracks have no recording yet; they are skipped.`
            : "Plays from the first track to the last. A cover plays from that track on."}
      </p>
      <ol
        className={clsx(
          // Both sides in the same grid: Side B's eight covers are as large as Side A's, two rows.
          "grid grid-cols-4 gap-x-3 gap-y-4 min-[1400px]:grid-cols-6",
        )}
        aria-label={`${sideName}, in ${side === "A" ? "running" : "release"} order`}
      >
        {record.tracks.map((t) => (
          <li key={t.capstoneId} className="min-w-0">
            <Cover
              t={t}
              detailPending={t.trackId !== null && detailsPending.has(t.trackId)}
              playing={playing?.no === t.no}
              side={side}
              onPlay={() => play(t)}
              register={(el) => {
                if (el) covers.current.set(t.no, el);
                else covers.current.delete(t.no);
              }}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Cover({
  t,
  detailPending,
  playing,
  side,
  onPlay,
  register,
}: {
  t: RecordTrack;
  /** The track's detail is still on its way: which version the cover grows from is not known yet. */
  detailPending: boolean;
  playing: boolean;
  side: "A" | "B";
  onPlay(): void;
  register(el: HTMLButtonElement | null): void;
}) {
  const { music, pending } = useCoverMusic(t.sketch, t.flavour);
  const caption = (
    <span className="mt-1.5 flex min-w-0 items-baseline gap-1.5 text-left text-sm leading-snug">
      <span className="font-display text-text-3 tabular-nums">{t.no}</span>
      {/* A long title takes a second line rather than lose its words ("Reharmonize a Standard"). */}
      <span className="line-clamp-2 min-w-0 flex-1 font-medium" title={t.title}>
        {t.title}
      </span>
      <span className="shrink-0 text-text-3 tabular-nums">
        {t.hasAudio && t.durationS ? formatDuration(t.durationS) : ""}
      </span>
    </span>
  );
  if (!t.trackId || !t.coverSeed)
    return (
      <div data-cover={t.capstoneId} data-state="empty">
        <div className="flex aspect-square w-full items-center justify-center rounded-card border-2 border-dashed border-border text-sm text-text-3">
          Not released yet
        </div>
        {caption}
      </div>
    );
  return (
    <div data-cover={t.capstoneId} data-state={playing ? "playing" : t.hasAudio ? "ready" : "silent"}>
      <button
        type="button"
        ref={register}
        data-cover-no={t.no}
        aria-disabled={!t.hasAudio}
        aria-pressed={playing}
        aria-label={
          t.hasAudio
            ? `${t.no}. ${t.title}: play Side ${side} from here`
            : `${t.no}. ${t.title}: no recording yet`
        }
        onClick={() => {
          if (t.hasAudio) onPlay();
        }}
        className={clsx(
          "relative block w-full rounded-card outline-offset-2 reduced:transition-none",
          "transition-shadow aria-disabled:cursor-default",
          playing ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : "hover:ring-1 hover:ring-text-3",
        )}
      >
        <AlbumCover
          seed={t.coverSeed}
          title={t.title}
          music={music}
          // Until the detail names the version, the cover shows its wood: never the seed-only rings first and
          // the music's rings after (a cover that changed under the learner's eyes, and under a test's).
          loading={pending || detailPending}
          size={220}
          className="h-auto w-full"
        />
        {!t.hasAudio && (
          <span className="absolute inset-x-0 bottom-0 rounded-b-card bg-bg/85 px-2 py-1 text-center text-sm text-text-2">
            No recording yet
          </span>
        )}
      </button>
      {caption}
      {!t.hasAudio && (
        <Link
          to="/album/$trackId"
          params={{ trackId: t.trackId }}
          className="text-sm text-link underline underline-offset-2"
        >
          Record a take
        </Link>
      )}
    </div>
  );
}
