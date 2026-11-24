// A unit song's cover (spec 2026-11-24 §5.5): tree rings on the wood of the song's style, one ring per take, each ring
// in the colour of the part that take took (the same earth tones as the grid's rows). The rings' places come from
// the Sketchbook's covers (`ringsOf`, studio/model.ts), so a song and a sketch grow alike. `grow` draws the newest
// ring in (the Coda's "your song grew"); reduced motion shows it at once (album/cover.css).
import type { UnitSongDef, UnitSongTake } from "@oak/api";
import { clsx } from "clsx";
import type { CSSProperties } from "react";
import { WOODS } from "../album/cover.ts";
import { ringsOf } from "../studio/model.ts";
import { PARTS_PALETTE } from "../ui/theme/palette.ts";
import "../album/cover.css";

/**
 * Each take's ring colour: the colour of the part it brought into the song (the first part in its cells that no
 * earlier take held: that part's row colour in the grid); a take that brought no new part takes the next colour in
 * turn, so neighbouring rings stay apart.
 */
export function ringTonesOf(
  def: Pick<UnitSongDef, "parts">,
  takes: readonly Pick<UnitSongTake, "cells">[],
): string[] {
  const seen = new Set<string>();
  let last = -1;
  return takes.map((t) => {
    const parts = t.cells.map((c) => c.split("@")[0] ?? "");
    const added = parts.find((p) => p !== "" && !seen.has(p));
    for (const p of parts) seen.add(p);
    const i = added === undefined ? -1 : def.parts.findIndex((p) => p.id === added);
    last = i >= 0 ? i : last + 1;
    return PARTS_PALETTE[last % PARTS_PALETTE.length] as string;
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
