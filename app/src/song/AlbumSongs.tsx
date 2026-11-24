// The album's Songs shelf (spec 2026-11-24 §5.5 "Album"): one tile per unit song the learner has started, with its
// cover (one ring per take in it), its title, open or released, and ▶. A released song plays its newest release
// exactly as it was frozen (`songs.snapshot`, spec §5.4: never the current content); an open song plays as it stands.
// The released ones are also the album's B-sides; the shelf is where every song lives, open or released.
import type { UnitId, UnitSongDetail, UnitSongSnapshot, UnitSongSummary } from "@oak/api";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Loader2, Play, Square } from "lucide-react";
import { useState } from "react";
import { unitSongOfUnit } from "../../../content/unit-songs/index.ts";
import { apiQuery } from "../lib/queries.ts";
import { Chip } from "../ui/kit/basics.tsx";
import { PARTS_PALETTE } from "../ui/theme/palette.ts";
import { useUnitSongs } from "./hooks.ts";
import { nowId, releaseId } from "./ids.ts";
import { songBandOf } from "./model.ts";
import { playSong, stopSong, useSongPlay } from "./player.ts";
import { SongCover } from "./SongCover.tsx";
import { newestRelease, snapshotBand, styleName } from "./surfaces-model.ts";

/**
 * ▶ for a release: reads its frozen song (`songs.snapshot`) on the first press, then plays it. The words say what it
 * plays.
 */
export function ReleasePlayButton({
  unitId,
  release,
  label,
  className,
}: {
  unitId: string;
  release: number;
  label: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const id = releaseId(unitId, release);
  const p = useSongPlay(id);
  const [readError, setReadError] = useState<string | null>(null);
  const busy = p.playing || p.loading;
  const go = async () => {
    if (busy) return stopSong(id);
    setReadError(null);
    let snap: UnitSongSnapshot;
    try {
      snap = await qc.fetchQuery(
        apiQuery("songs.snapshot", { params: { unitId: unitId as UnitId, releaseId: String(release) } }),
      );
    } catch {
      setReadError(SONG_NOT_READ);
      return;
    }
    // A failure to play is the player's state (`p.error`), shown under the button.
    await playSong(id, snapshotBand(snap), { title: snap.title });
  };
  return (
    <RoundPlay
      busy={busy}
      loading={p.loading}
      playing={p.playing}
      label={busy ? `Stop ${label}` : label}
      onClick={() => void go()}
      className={className}
      error={p.error ?? readError}
    />
  );
}

/** What ▶ says when the song could not be read to play it. */
const SONG_NOT_READ = "The song did not load.";

/** ▶ for an open song: reads the song with its takes on the first press, then plays it as it stands. */
function OpenSongPlayButton({ unitId, label }: { unitId: string; label: string }) {
  const qc = useQueryClient();
  const id = nowId(unitId);
  const p = useSongPlay(id);
  const [readError, setReadError] = useState<string | null>(null);
  const busy = p.playing || p.loading;
  const def = unitSongOfUnit(unitId as UnitId);
  const go = async () => {
    if (busy) return stopSong(id);
    if (!def) return;
    setReadError(null);
    let detail: UnitSongDetail;
    try {
      detail = (await qc.fetchQuery(
        apiQuery("songs.get", { params: { unitId: unitId as UnitId } }),
      )) as UnitSongDetail;
    } catch {
      setReadError(SONG_NOT_READ);
      return;
    }
    await playSong(id, songBandOf(def, detail, { flavour: detail.flavour }), { title: detail.title });
  };
  return (
    <RoundPlay
      busy={busy}
      loading={p.loading}
      playing={p.playing}
      label={busy ? `Stop ${label}` : label}
      onClick={() => void go()}
      disabled={!def}
      error={p.error ?? readError}
    />
  );
}

function RoundPlay({
  busy,
  loading,
  playing,
  label,
  onClick,
  disabled,
  className,
  error = null,
}: {
  busy: boolean;
  loading: boolean;
  playing: boolean;
  label: string;
  onClick(): void;
  disabled?: boolean | undefined;
  className?: string | undefined;
  /** Why the last press did not play, said under the button (as `SongPlayButton` does). */
  error?: string | null;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={playing}
        data-testid="song-shelf-play"
        className={clsx(
          "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:opacity-50",
          busy
            ? "oak-song-breathe border-accent bg-lane-in text-accent"
            : "border-transparent bg-accent text-on-accent hover:bg-accent-hover",
          className,
        )}
      >
        {loading ? (
          <Loader2 aria-hidden className="size-4 animate-spin reduced:animate-none" />
        ) : playing ? (
          <Square aria-hidden className="size-3.5" fill="currentColor" />
        ) : (
          <Play aria-hidden className="size-4 translate-x-px" fill="currentColor" />
        )}
      </button>
      {error && (
        <span
          role="status"
          className="absolute top-full right-0 z-10 mt-1 w-max max-w-[14rem] text-right text-xs text-text-2"
          data-testid="song-shelf-play-error"
        >
          {error}
        </span>
      )}
    </span>
  );
}

/** A song tile: the cover as large as the tile, the title (a link to the song's page), where it stands, ▶. */
function SongTile({ song }: { song: UnitSongSummary }) {
  const release = newestRelease(song);
  const released = song.status === "released" && release !== null;
  // The cover's rings: one per take, in the part colours (the summary carries no cells: the tones cycle).
  const tones = Array.from(
    { length: song.takesCount },
    (_, i) => PARTS_PALETTE[i % PARTS_PALETTE.length] as string,
  );
  return (
    <li
      className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-3 shadow-card"
      data-testid="song-shelf-tile"
      data-unit={song.unitId}
      data-status={song.status}
    >
      <Link
        to="/song/$unitId"
        params={{ unitId: song.unitId }}
        className="block overflow-hidden rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label={`Open “${song.title}”`}
      >
        <SongCover
          seed={song.unitId}
          flavour={song.flavour}
          tones={tones}
          size="fill"
          className="aspect-square"
        />
      </Link>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link
            to="/song/$unitId"
            params={{ unitId: song.unitId }}
            className="block truncate font-display text-h3 font-semibold text-text hover:underline"
          >
            {song.title}
          </Link>
          {/* The summary counts takes, and a lesson redone adds one: the tile counts rings, never lessons. */}
          <p className="truncate text-sm text-text-3 tabular-nums">
            {styleName(song.flavour)} · {song.takesCount} {song.takesCount === 1 ? "ring" : "rings"}
          </p>
        </div>
        {released && release ? (
          <ReleasePlayButton
            unitId={song.unitId}
            release={release.id}
            label={`Play “${release.title}” as released`}
          />
        ) : (
          <OpenSongPlayButton unitId={song.unitId} label={`Play “${song.title}” as it stands`} />
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {released ? <Chip tone="accent">On the album</Chip> : <Chip>Still growing</Chip>}
        {song.changedSinceRelease && <Chip tone="amber">Changed since its release</Chip>}
      </div>
    </li>
  );
}

export function AlbumSongs() {
  const songs = useUnitSongs();
  const items = songs.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="album-songs" data-testid="album-songs">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2">
        <h2 id="album-songs" className="font-display text-h2">
          Songs
        </h2>
        <span className="text-sm text-text-3">
          One per unit. Each grows a ring every time a lesson's Make goes into it.
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((s) => (
          <SongTile key={s.unitId} song={s} />
        ))}
      </ul>
    </section>
  );
}
