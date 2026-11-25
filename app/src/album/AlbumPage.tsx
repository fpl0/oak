// `/album` (ux §5.3): the album as a record sleeve. The front: the newest cover with the record peeking out, the
// album's name, its length, Play all. The back: the tracklist by side, covers grown from the music, durations,
// play, liner notes; empty slots say what opens them. With no track yet, the first one is made worth earning.
import type { AlbumTrack, AlbumTrackDetail, UnitId } from "@oak/api";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Check, ChevronDown, Download, Lock, Pause, Pencil, Play, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import "./cover.css";
import { useCapstoneContent } from "../capstone/content.ts";
import { FLAVOUR_LABEL, formatDate, formatDuration } from "../lib/format.ts";
import { usePageTitle } from "../lib/nav.ts";
import {
  albumAudioUrl,
  apiQuery,
  useAlbum,
  useCoreCompletion,
  useCourseProgress,
  useWholeCourse,
} from "../lib/queries.ts";
import { AlbumSongs, takeStepsOf } from "../song/AlbumSongs.tsx";
import { useUnitSongs } from "../song/hooks.ts";
import { releaseId } from "../song/ids.ts";
import { playSong, stopSong, useSongPlayState } from "../song/player.ts";
import { SongReleaseCover } from "../song/SongCover.tsx";
import {
  firstTrackSong,
  type SongStage,
  type SongTrackRelease,
  snapshotBand,
  snapshotSeconds,
  songTracksOf,
} from "../song/surfaces-model.ts";
import { AlbumCover } from "../ui/AlbumCover.tsx";
import { Button, buttonClass, IconButton } from "../ui/kit/Button.tsx";
import { Chip, Page, Skeleton } from "../ui/kit/basics.tsx";
import { ErrorState } from "../ui/kit/QueryState.tsx";
import { albumSides, audioFileName, runtime, type Slot, sideARecord } from "./model.ts";
import { useCoverMusic } from "./music.ts";
import { ShelfDrawer } from "./ShelfDrawer.tsx";
import { pauseOtherAudio, SideARecord, SideRecord } from "./SideARecord.tsx";
import { ALBUM_TITLE_MAX, cleanAlbumTitle, DEFAULT_ALBUM_TITLE, useAlbumTitle } from "./title.ts";
import { Vinyl } from "./Vinyl.tsx";
import { CourseCompleteHeading, PlayEverything, useWholeRecord } from "./WholeRecord.tsx";

interface Playing {
  trackId: string;
  version: number;
  /** A unit-song release: it plays its frozen song through the song player, not a recording. */
  song?: SongTrackRelease;
}

export function AlbumPage() {
  usePageTitle("Album");
  const album = useAlbum();
  const content = useCapstoneContent();
  const progress = useCourseProgress();
  const completion = useCoreCompletion();
  const wholeCourse = useWholeCourse();
  const whole = useWholeRecord();
  const tracks = album.data?.tracks ?? [];
  const details = useQueries({
    queries: tracks.map((t) => apiQuery("album.track", { params: { id: t.id } })),
  });
  const detailOf = new Map(details.flatMap((q) => (q.data ? [[q.data.id, q.data] as const] : [])));
  // The album rows that are unit-song releases, and the release each one's current version is.
  const songs = useUnitSongs();
  const songTracks = songTracksOf(songs.data?.items);
  const songReleaseOf = (t: Pick<AlbumTrack, "id" | "currentVersion">): SongTrackRelease | null => {
    const s = songTracks.get(t.id);
    return s ? (s.releases.find((r) => r.version === t.currentVersion) ?? s.releases.at(-1) ?? null) : null;
  };
  const songRows = tracks.flatMap((t) => {
    const r = songReleaseOf(t);
    return r ? [{ track: t, release: r }] : [];
  });
  const snapshots = useQueries({
    queries: songRows.map(({ release: r }) => ({
      ...apiQuery("songs.snapshot", {
        params: { unitId: r.unitId as UnitId, releaseId: String(r.releaseId) },
      }),
      staleTime: Number.POSITIVE_INFINITY,
    })),
  });
  const songSeconds = new Map(
    songRows.map(({ track }, i) => {
      const snap = snapshots[i]?.data;
      return [track.id, snap ? snapshotSeconds(snap) : 0] as const;
    }),
  );

  // One player for the page; "Play all" walks the tracks that have a recording, in record order, then the songs
  // (each plays its frozen release once through on the song player).
  const qc = useQueryClient();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [queue, setQueue] = useState<Playing[]>([]);
  const play = (p: Playing | null) => {
    const el = audio.current;
    const was = playing;
    setPlaying(p);
    if (was?.song && was.song !== p?.song) stopSong(releaseId(was.song.unitId, was.song.releaseId));
    if (!p) {
      el?.pause();
      return;
    }
    if (p.song) {
      el?.pause();
      void playRelease(p.song).catch(() => {
        setQueue([]);
        setPlaying(null);
      });
      return;
    }
    if (!el) return;
    pauseOtherAudio(el);
    el.src = albumAudioUrl(p.trackId, p.version);
    void el.play().catch(() => setPlaying(null));
  };
  const playRelease = async (r: SongTrackRelease) => {
    const snap = await qc.fetchQuery({
      ...apiQuery("songs.snapshot", {
        params: { unitId: r.unitId as UnitId, releaseId: String(r.releaseId) },
      }),
      staleTime: Number.POSITIVE_INFINITY,
    });
    await playSong(releaseId(r.unitId, r.releaseId), snapshotBand(snap), { title: snap.title });
  };
  // A song in the queue ends when the song player lets it go after its last bar; let go earlier (its Stop in the
  // shell, another ▶), it was stopped, and the queue stops with it. A song that did not start stops the queue too.
  const songPlay = useSongPlayState();
  const songOn = playing?.song ? releaseId(playing.song.unitId, playing.song.releaseId) : null;
  const heard = useRef<{ id: string; bar: number; of: number } | null>(null);
  useEffect(() => {
    if (!songOn) {
      heard.current = null;
      return;
    }
    if (songPlay.id === songOn) {
      if (songPlay.phase === "playing")
        heard.current = { id: songOn, bar: songPlay.bar ?? 0, of: songPlay.lengthBars };
      return;
    }
    if (songPlay.error?.id === songOn) {
      setQueue([]);
      setPlaying(null);
      return;
    }
    const h = heard.current;
    if (h?.id !== songOn) return;
    heard.current = null;
    if (h.bar >= h.of - 1) {
      const [next, ...rest] = queue;
      setQueue(rest);
      play(next ?? null);
    } else {
      setQueue([]);
      setPlaying(null);
    }
  });

  if (album.isError)
    return (
      <Page>
        <ErrorState error={album.error} onRetry={() => void album.refetch()} />
      </Page>
    );
  if (album.isPending || content.isPending)
    return (
      <Page>
        <div
          className="grid gap-8 md:grid-cols-[360px_1fr]"
          role="status"
          aria-busy="true"
          aria-label="Loading the album"
        >
          <Skeleton className="aspect-square w-full" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-6 h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </Page>
    );

  const metas = (content.data?.capstones ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    objective: c.objective,
    sessions: c.sessions,
  }));
  const sides = albumSides(tracks, metas, progress.data?.capstones ?? [], new Set(songTracks.keys()));
  const ordered = sides.flatMap((s) => s.slots.flatMap((sl) => (sl.kind === "track" ? [sl.track] : [])));
  const withAudio: Playing[] = [
    ...ordered.flatMap((t) => {
      const d = detailOf.get(t.id);
      const v = d?.versions.find((x) => x.version === t.currentVersion);
      return v?.hasAudio ? [{ trackId: t.id, version: v.version }] : [];
    }),
    ...songRows.map(({ track, release }) => ({
      trackId: track.id,
      version: track.currentVersion,
      song: release,
    })),
  ];
  const total =
    ordered.reduce((sum, t) => {
      const v = detailOf.get(t.id)?.versions.find((x) => x.version === t.currentVersion);
      return sum + (v?.durationS ?? 0);
    }, 0) + [...songSeconds.values()].reduce((a, b) => a + b, 0);
  const newest = [...tracks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const c0 = progress.data?.capstones.find((c) => c.capstoneId === "C0");
  // Side A finished (every core track released): the album's own page is the record (content/specs/END.md).
  const finished = sideARecord(tracks, detailOf, content.data?.capstones ?? []).complete;
  const finishedAt = completion.data?.stage === "complete" ? completion.data.completedAt : null;
  // Wave 7: Side B (the track capstones) beside Side A, and the whole course complete (session 259).
  const sideB = tracks.some((t) => t.side === "B");
  const courseComplete =
    wholeCourse.data?.stage === "complete" || (whole.record !== null && whole.record.complete);

  return (
    <Page>
      {/* biome-ignore lint/a11y/useMediaCaption: instrumental recordings of the learner's own pieces. */}
      <audio
        ref={audio}
        onEnded={() => {
          const [next, ...rest] = queue;
          setQueue(rest);
          play(next ?? null);
        }}
        onPause={() => {
          // A song of the queue plays on the song player, which pauses this element when it starts.
          if (audio.current?.ended || playing?.song) return;
          if (playing && audio.current?.paused) setPlaying(null);
        }}
        className="hidden"
        data-testid="album-player"
      />
      {finished ? (
        <header className="mb-10" data-testid="album-finished">
          <p className="text-sm tracking-[0.2em] text-text-3 uppercase">Album</p>
          <AlbumTitleHeading />
          {courseComplete && whole.record ? (
            <div className="mt-1" data-testid="album-meta">
              <CourseCompleteHeading whole={wholeCourse.data ?? null} record={whole.record} />
            </div>
          ) : (
            <p className="mt-1 max-w-[70ch] text-text-2" data-testid="album-meta">
              Side A is complete: {tracks.filter((t) => t.side === "A").length} tracks of your own, in the
              order you made them, the single last.
              {finishedAt ? ` Finished on ${formatDate(finishedAt)}.` : ""}
              {sideB ? " Side B grows with the tracks you take on." : ""}
            </p>
          )}
          {sideB && (
            <div className="mt-4">
              <PlayEverything />
            </div>
          )}
          <div className="mt-6 rounded-card border border-border bg-surface p-5 shadow-card">
            <SideARecord />
          </div>
          {sideB && (
            <div className="mt-6 rounded-card border border-border bg-surface p-5 shadow-card">
              <SideRecord side="B" />
            </div>
          )}
        </header>
      ) : (
        <header className="mb-10 grid items-center gap-8 md:grid-cols-[minmax(0,440px)_1fr]">
          <Sleeve
            newest={newest}
            spinning={playing !== null}
            detail={newest ? detailOf.get(newest.id) : undefined}
            song={newest ? songReleaseOf(newest) : null}
          />
          <div className="min-w-0">
            <p className="text-sm tracking-[0.2em] text-text-3 uppercase">Album</p>
            <AlbumTitleHeading />
            {tracks.length > 0 ? (
              <>
                <p className="mt-1 text-text-2" data-testid="album-meta">
                  {tracks.length} {tracks.length === 1 ? "track" : "tracks"} ·{" "}
                  {withAudio.length > 0 ? runtime(total || null) : "no recordings yet"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    icon={
                      playing ? (
                        <Pause aria-hidden className="size-4" />
                      ) : (
                        <Play aria-hidden className="size-4" />
                      )
                    }
                    disabled={withAudio.length === 0}
                    title={
                      withAudio.length === 0
                        ? "No track has a recording yet. Open a track to play its code live and record it."
                        : undefined
                    }
                    onClick={() => {
                      if (playing) {
                        setQueue([]);
                        play(null);
                      } else {
                        const [first, ...rest] = withAudio;
                        setQueue(rest);
                        play(first ?? null);
                      }
                    }}
                  >
                    {playing ? "Stop" : "Play all"}
                  </Button>
                  {newest && (
                    <Link
                      to="/album/$trackId"
                      params={{ trackId: newest.id }}
                      className={buttonClass("secondary")}
                    >
                      Newest: {newest.title}
                    </Link>
                  )}
                </div>
                <p className="mt-4 max-w-[52ch] text-sm text-text-2" data-testid="album-covers-line">
                  {coversLine(songRows.length, tracks.length - songRows.length)}
                </p>
              </>
            ) : (
              <FirstTrack c0={c0} song={firstTrackSong(songs.data?.items ?? [], takeStepsOf)} />
            )}
          </div>
        </header>
      )}

      <div className="flex flex-col gap-10">
        {sides.map((side) => (
          <section key={side.side} aria-labelledby={`side-${side.side}`} data-side={side.side}>
            <div className="mb-3 flex items-baseline gap-3 border-b border-border pb-2">
              <h2 id={`side-${side.side}`} className="font-display text-h2">
                {side.title}
              </h2>
              <span className="text-sm text-text-3">{side.sub}</span>
            </div>
            <ol className="flex flex-col">
              {side.slots.map((slot) => (
                <SlotRow
                  key={slot.kind === "track" ? slot.track.id : slot.capstone.id}
                  slot={slot}
                  detail={slot.kind === "track" ? detailOf.get(slot.track.id) : undefined}
                  playing={playing}
                  onPlay={(p) => {
                    setQueue([]);
                    play(p);
                  }}
                />
              ))}
            </ol>
          </section>
        ))}
        {/* Oak 2.0 W4 F6: finished pieces kept off the album, after the sides; hidden while empty. */}
        <ShelfDrawer shelf={album.data?.shelf ?? []} />
        {/* Unit songs (spec 2026-11-24 §5.5 "Album"): every unit's song, open or released, after the sides, so the
            hero and Side A stay at the top of the page. */}
        <AlbumSongs />
      </div>
    </Page>
  );
}

/** How the covers grow, said only for the kinds of track the album holds. */
function coversLine(songs: number, others: number): string {
  const tracks =
    "Every track's cover is grown from its music: one ring per bar, notes in their degree colours.";
  const ofSongs = "A song's cover grows one ring for each lesson's Make in it.";
  if (songs === 0) return tracks;
  if (others === 0) return ofSongs;
  return `${tracks} ${ofSongs}`;
}

/** The album's name, renamed in place (ux §5.3 "editable"): every cover prints the new name at once. */
function AlbumTitleHeading() {
  const album = useAlbumTitle();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(album.title);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const rename = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const back = useRef(false);
  useEffect(() => {
    if (editing) input.current?.select();
    else if (back.current) {
      back.current = false;
      rename.current?.focus();
    }
  }, [editing]);
  const close = () => {
    back.current = true;
    setEditing(false);
    setError(null);
  };
  const save = async () => {
    const next = cleanAlbumTitle(draft) ?? DEFAULT_ALBUM_TITLE;
    try {
      await album.set(next === DEFAULT_ALBUM_TITLE ? "" : next);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The name was not saved.");
    }
  };
  if (!editing)
    return (
      <div className="flex items-center gap-2">
        <h1
          className="min-w-0 font-display text-[2.6rem] leading-tight break-words"
          data-testid="album-title"
        >
          {album.title}
        </h1>
        <IconButton
          ref={rename}
          label="Rename the album"
          icon={<Pencil aria-hidden className="size-4" />}
          onClick={() => {
            setDraft(album.title);
            setEditing(true);
          }}
          data-testid="rename-album"
        />
      </div>
    );
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h1 className="sr-only">{album.title}</h1>
      <label htmlFor="album-title-input" className="text-sm font-medium text-text-2">
        Album name
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="album-title-input"
          ref={input}
          value={draft}
          maxLength={ALBUM_TITLE_MAX}
          aria-describedby={hintId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
          className="h-11 w-[min(100%,22rem)] rounded-control border border-border bg-surface px-3 font-display text-h2"
        />
        <Button
          type="submit"
          variant="primary"
          loading={album.saving}
          icon={<Check aria-hidden className="size-4" />}
        >
          Save
        </Button>
        <Button variant="ghost" icon={<X aria-hidden className="size-4" />} onClick={close}>
          Cancel
        </Button>
      </div>
      <p id={hintId} className="text-sm text-text-3">
        Printed on every cover. Leave it empty for “{DEFAULT_ALBUM_TITLE}”.
      </p>
      {error && (
        <p role="alert" className="text-sm text-issue">
          {error}
        </p>
      )}
    </form>
  );
}

function Sleeve({
  newest,
  detail,
  spinning,
  song,
}: {
  newest: AlbumTrack | null;
  detail: AlbumTrackDetail | undefined;
  spinning: boolean;
  /** The newest track is a unit-song release: its cover is the song's rings, as on the shelf. */
  song: SongTrackRelease | null;
}) {
  const version = detail?.versions.find((v) => v.version === newest?.currentVersion) ?? null;
  const { music, pending } = useCoverMusic(
    version ? { sketchId: version.sketchId, sketchVersion: version.sketchVersion } : null,
    newest?.flavour ?? null,
  );
  if (!newest)
    return (
      <div className="relative flex h-[300px] items-center" aria-hidden>
        <div className="absolute left-[150px]">
          <Vinyl size={280} empty />
        </div>
        <div className="relative z-10 flex size-[300px] items-center justify-center rounded-card border-2 border-dashed border-border bg-surface">
          <span className="font-display text-h3 text-text-3">Side A · 1</span>
        </div>
      </div>
    );
  return (
    <div className="relative flex h-[300px] items-center">
      <div className="absolute left-[130px] top-[10px]">
        <Vinyl
          size={280}
          spinning={spinning}
          label={
            song ? (
              <SongReleaseCover unitId={song.unitId} releaseId={song.releaseId} size={96} />
            ) : (
              <AlbumCover
                seed={newest.coverSeed}
                title={newest.title}
                music={music}
                loading={pending || !detail}
                size={96}
                plain
              />
            )
          }
        />
      </div>
      {/* A song's cover has the rounded corners of its wood (8 of 64 units): the shadow follows them. */}
      <div className={clsx("relative z-10 shadow-overlay", song && "rounded-[37.5px]")}>
        {song ? (
          <SongReleaseCover
            unitId={song.unitId}
            releaseId={song.releaseId}
            size={300}
            label={`The cover of “${newest.title}”: one ring for each lesson's Make in it`}
          />
        ) : (
          <AlbumCover
            seed={newest.coverSeed}
            title={newest.title}
            music={music}
            loading={pending || !detail}
            size={300}
          />
        )}
      </div>
    </div>
  );
}

function FirstTrack({
  c0,
  song,
}: {
  c0: { status: string; lockedReason: string | null } | undefined;
  /**
   * The unit song to speak of beside C0, so neither is "first" (`firstTrackSong`: a song ready to release before one
   * still growing), with where it stands.
   */
  song: { song: { title: string; unitId: UnitId }; stage: SongStage } | null;
}) {
  const open = c0 && c0.status !== "locked";
  return (
    <div className="mt-2 max-w-[56ch]" data-testid="album-empty">
      <h2 className="text-h2">Side A, track 1 is waiting</h2>
      <p className="mt-2 text-text-2">
        Side A starts with <strong className="font-medium text-text">C0 Intro</strong>: four to eight bars of
        drums you write yourself, with a fill in the last bar. When you release it, its cover grows from the
        music, one ring per bar, and the record starts to fill.
      </p>
      {song && (
        <p className="mt-2 text-text-2" data-testid="album-empty-song" data-stage={song.stage}>
          {song.stage === "ready" || song.stage === "off-album" ? (
            <>
              Your song{" "}
              <Link
                to="/song/$unitId"
                params={{ unitId: song.song.unitId }}
                className="text-link underline-offset-2 hover:underline"
              >
                “{song.song.title}”
              </Link>{" "}
              {song.stage === "ready"
                ? "is ready: release it from its page."
                : "is off the album: release it again from its page."}
            </>
          ) : (
            <>Your song “{song.song.title}” joins the album too, once you finish its unit and release it.</>
          )}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {open ? (
          <Link to="/capstone/$id" params={{ id: "C0" }} className={buttonClass("primary", "lg")}>
            {c0?.status === "in_progress" ? "Back to C0 Intro" : "Start C0 Intro"}
          </Link>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 text-sm text-text-2">
              <Lock aria-hidden className="size-4" />
              {c0?.lockedReason ?? "It opens after the Unit 1 checkpoint."}
            </span>
            <Link to="/oak" search={{ view: "course" }} className={buttonClass("secondary")}>
              See the way there
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  detail,
  playing,
  onPlay,
}: {
  slot: Slot;
  detail: AlbumTrackDetail | undefined;
  playing: Playing | null;
  onPlay(p: Playing | null): void;
}) {
  const [open, setOpen] = useState(false);
  if (slot.kind === "empty") {
    const s = slot;
    // Oak 2.0 W4 F6: a released capstone with no track on the album is on the Shelf (it still counts as finished).
    const where =
      s.status === "open"
        ? "Open now"
        : s.status === "in_progress"
          ? `In progress · ${s.sessionsDone} of ${s.sessionsTotal} sessions`
          : s.status === "released"
            ? "On the Shelf"
            : (s.lockedReason ?? "Opens later in the course");
    const reachable = s.status === "open" || s.status === "in_progress";
    return (
      <li className="flex items-center gap-4 border-b border-border/60 py-3" data-slot={s.capstone.id}>
        <span className="w-6 shrink-0 text-right font-display text-h3 text-text-3 tabular-nums">{s.no}</span>
        <span aria-hidden className="size-14 shrink-0 rounded-card border-2 border-dashed border-border" />
        <div className="min-w-0 flex-1">
          <p className="text-text-2">{s.capstone.title}</p>
          <p className="text-sm text-text-3">{where}</p>
        </div>
        {reachable && (
          <Link to="/capstone/$id" params={{ id: s.capstone.id }} className={buttonClass("secondary", "sm")}>
            {s.status === "in_progress" ? "Continue" : "Start"}
          </Link>
        )}
      </li>
    );
  }
  const t = slot.track;
  const v = detail?.versions.find((x) => x.version === t.currentVersion) ?? null;
  const isPlaying = playing?.trackId === t.id;
  return (
    <li className="border-b border-border/60" data-track={t.id}>
      <div className="flex items-center gap-4 py-3">
        <span className="w-6 shrink-0 text-right font-display text-h3 text-text-3 tabular-nums">
          {slot.no}
        </span>
        <TrackThumb track={t} version={v} />
        <div className="min-w-0 flex-1">
          <Link to="/album/$trackId" params={{ trackId: t.id }} className="font-medium hover:underline">
            {t.title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-text-2">
            {t.flavour && <span>{FLAVOUR_LABEL[t.flavour] ?? t.flavour}</span>}
            {t.currentVersion > 1 && <span>· v{t.currentVersion}</span>}
            {v?.theoryTags.slice(0, 3).map((tag) => (
              <Chip key={tag} className="h-5 text-[0.75rem]">
                {tag}
              </Chip>
            ))}
          </p>
        </div>
        <span className="hidden w-14 text-right text-sm text-text-3 tabular-nums sm:block">
          {v?.durationS ? formatDuration(v.durationS) : ""}
        </span>
        <Button
          size="sm"
          variant={isPlaying ? "primary" : "secondary"}
          disabled={!v?.hasAudio}
          title={v?.hasAudio ? undefined : "No recording of this version yet"}
          aria-label={isPlaying ? `Stop ${t.title}` : `Play ${t.title}`}
          icon={
            isPlaying ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />
          }
          onClick={() => onPlay(isPlaying || !v ? null : { trackId: t.id, version: v.version })}
        />
        {v?.hasAudio ? (
          <a
            href={albumAudioUrl(t.id, v.version)}
            download={audioFileName(t.title, v.version, v.audioMime)}
            aria-label="Download the recording"
            title="Download the recording"
            className={buttonClass("ghost", "sm")}
          >
            <Download aria-hidden className="size-4" />
          </a>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-controls={`liner-${t.id}`}
          onClick={() => setOpen((o) => !o)}
          icon={
            <ChevronDown
              aria-hidden
              className={clsx("size-4 transition-transform reduced:transition-none", open && "rotate-180")}
            />
          }
        >
          Liner notes
        </Button>
      </div>
      {open && (
        <div
          id={`liner-${t.id}`}
          className="mb-4 ml-24 max-w-[70ch] rounded-card bg-surface-2/60 p-4 text-sm"
        >
          {v ? (
            <>
              <LinerNotes text={v.linerNotesMd} attribution={v.attribution} />
              {v.theoryTags.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid="liner-theory">
                  <span className="text-text-3">Theory used</span>
                  {v.theoryTags.map((tag) => (
                    <Chip key={tag} className="h-5 text-[0.75rem]">
                      {tag}
                    </Chip>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-text-3">Loading…</p>
          )}
        </div>
      )}
    </li>
  );
}

function TrackThumb({
  track,
  version,
}: {
  track: AlbumTrack;
  version: AlbumTrackDetail["versions"][number] | null;
}) {
  const { music, pending } = useCoverMusic(
    version ? { sketchId: version.sketchId, sketchVersion: version.sketchVersion } : null,
    track.flavour,
  );
  return (
    <AlbumCover
      seed={track.coverSeed}
      title={track.title}
      music={music}
      loading={pending || !version}
      size={56}
      plain
    />
  );
}

/** Liner notes are short markdown: paragraphs, "- " lists and `code`. Rendered as text, never as HTML. */
export function LinerNotes({ text, attribution }: { text: string; attribution?: string | null }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="flex flex-col gap-2 leading-relaxed" data-testid="liner-notes">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- ")))
          return (
            <ul key={i} className="list-disc pl-5">
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.slice(2)} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j} className="block">
                <Inline text={l} />
              </span>
            ))}
          </p>
        );
      })}
      {attribution && <p className="text-text-3">{attribution}</p>}
      {blocks.length === 0 && <p className="text-text-3">No liner notes for this version.</p>}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-surface px-1 font-mono text-[0.9em]">
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
