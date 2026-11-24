// A released track's own cover (the "Tree Rings" of its current version), for places outside the album that show
// one: Today's album strip, the Coda. It reads the track's versions and analyses the current one (cached for good).
// A unit-song release shows the song's rings as that release froze them, as the album and the song page do.
import type { AlbumTrack } from "@oak/api";
import { useAlbumTrack } from "../lib/queries.ts";
import { useUnitSongs } from "../song/hooks.ts";
import { SongReleaseCover } from "../song/SongCover.tsx";
import { songTracksOf } from "../song/surfaces-model.ts";
import { AlbumCover } from "../ui/AlbumCover.tsx";
import { useCoverMusic } from "./music.ts";

export function TrackCover({ track, size = 56 }: { track: AlbumTrack; size?: number }) {
  const songs = useUnitSongs();
  const song = songTracksOf(songs.data?.items).get(track.id);
  const release = song
    ? (song.releases.find((r) => r.version === track.currentVersion) ?? song.releases.at(-1) ?? null)
    : null;
  if (release) return <SongReleaseCover unitId={release.unitId} releaseId={release.releaseId} size={size} />;
  return <CodeCover track={track} size={size} />;
}

function CodeCover({ track, size }: { track: AlbumTrack; size: number }) {
  const detail = useAlbumTrack(track.id);
  const version =
    detail.data?.versions.find((v) => v.version === track.currentVersion) ??
    detail.data?.versions.at(-1) ??
    null;
  const { music, pending } = useCoverMusic(
    version ? { sketchId: version.sketchId, sketchVersion: version.sketchVersion } : null,
    track.flavour,
  );
  return (
    <AlbumCover
      seed={track.coverSeed}
      title={track.title}
      music={music}
      loading={!detail.isError && (pending || version === null)}
      size={size}
      plain
    />
  );
}
