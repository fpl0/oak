// A unit song's cover (spec 2026-11-24 §5.5): tree rings on the wood of the song's style, one ring per take, each ring
// in the colour of the part that take took (its row colour on every grid, `ringTonesOf`). The rings' places come from
// the Sketchbook's covers (`ringsOf`, studio/model.ts), so a song and a sketch grow alike. `grow` draws the newest
// ring in (the Coda's "your song grew"); reduced motion shows it at once (album/cover.css).
import type { UnitId, UnitSongDef, UnitSongTake } from "@oak/api";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import type { CSSProperties } from "react";
import { WOODS } from "../album/cover.ts";
import { apiQuery } from "../lib/queries.ts";
import { ringsOf } from "../studio/model.ts";
import { SONG_PART_TONES } from "../ui/theme/palette.ts";
import { songPartTones } from "./part-tones.ts";
import "../album/cover.css";

/**
 * Each take's ring colour: the row colour in the grid (`partToneOf`, the one helper every song surface uses) of the
 * part it brought into the song, the first part in its cells that no earlier take held. A take that brought no new
 * part takes the row colour of the first part it holds; one with no cells at all, the first colour.
 */
export function ringTonesOf(
  def: Pick<UnitSongDef, "parts">,
  takes: readonly Pick<UnitSongTake, "cells">[],
): string[] {
  const tones = songPartTones(def.parts);
  const seen = new Set<string>();
  return takes.map((t) => {
    const parts = t.cells.map((c) => c.split("@")[0] ?? "").filter((p) => tones.has(p));
    const added = parts.find((p) => !seen.has(p)) ?? parts[0];
    for (const p of parts) seen.add(p);
    return added === undefined ? (SONG_PART_TONES[0] as string) : (tones.get(added) as string);
  });
}

export function SongCover({
  seed,
  flavour,
  tones,
  size = 96,
  grow = false,
  label,
  className,
}: {
  /** Stable per song (its unit id), so the rings keep their places as the song grows. */
  seed: string;
  flavour: string;
  /** One colour per take, oldest first (`ringTonesOf`). */
  tones: readonly string[];
  size?: number | "fill";
  /** Draw the newest ring in. */
  grow?: boolean;
  /** Accessible name; without it the cover is decorative. */
  label?: string;
  className?: string;
}) {
  const wood = WOODS[flavour as keyof typeof WOODS] ?? WOODS.default;
  const rings = tones.length > 0 ? ringsOf(seed, tones.length, 64) : [];
  const px = size === "fill" ? undefined : size;
  return (
    <svg
      viewBox="0 0 64 64"
      width={px}
      height={px}
      className={clsx(grow && "oak-cover-draw", size === "fill" && "size-full", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="song-cover"
      data-rings={rings.length}
    >
      <rect x="0" y="0" width="64" height="64" rx="8" fill={wood.bg} />
      {/* the grain every song has, before any take: faint early wood */}
      {[24, 15].map((r) => (
        <circle key={r} cx="32" cy="32" r={r} fill="none" stroke={wood.early} strokeWidth="2.4" />
      ))}
      <circle cx="32" cy="32" r="29" fill="none" stroke={wood.line} strokeOpacity="0.7" strokeWidth="1.5" />
      <circle
        className="oak-cover-pith"
        cx="32"
        cy="32"
        r="4.2"
        fill="var(--oak-accent-2)"
        fillOpacity="0.55"
      />
      {rings.map((r, i) => {
        const newest = i === rings.length - 1;
        return (
          <circle
            key={i}
            className={grow && newest ? "oak-cover-ring" : undefined}
            style={grow && newest ? ({ "--i": 0 } as CSSProperties) : undefined}
            cx={32 + r.dx}
            cy={32 + r.dy}
            r={r.r}
            fill="none"
            stroke={tones[i] ?? wood.line}
            strokeWidth={r.width + 0.4}
            strokeOpacity={newest ? 1 : 0.6 + (0.35 * i) / Math.max(1, rings.length - 1)}
            data-ring={i}
          />
        );
      })}
      <circle cx="32" cy="32" r="1.4" fill={wood.ink} fillOpacity="0.7" />
    </svg>
  );
}

/** A release's frozen song (`songs.snapshot`): it never changes, so it is read once. */
export function useSongSnapshot(release: { unitId: string; releaseId: number } | null) {
  return useQuery({
    ...apiQuery("songs.snapshot", {
      params: { unitId: (release?.unitId ?? "U01") as UnitId, releaseId: String(release?.releaseId ?? 0) },
    }),
    enabled: release !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * A song release's cover on the album (the hero, the track page, its versions, Today's album strip): the song's tree
 * rings as that release froze them, so a released song looks the same on the album as on the shelf and its page.
 */
export function SongReleaseCover({
  unitId,
  releaseId,
  size,
  label,
  className,
}: {
  unitId: string;
  releaseId: number;
  size: number | "fill";
  label?: string;
  className?: string;
}) {
  const snap = useSongSnapshot({ unitId, releaseId }).data;
  return (
    <SongCover
      seed={unitId}
      flavour={snap?.flavour ?? "default"}
      tones={snap ? ringTonesOf(snap.def, snap.takes) : []}
      size={size}
      {...(label ? { label } : {})}
      className={clsx("rounded-card", className)}
    />
  );
}
