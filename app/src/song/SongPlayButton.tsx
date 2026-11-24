// ▶ for a unit song (spec 2026-11-24 §5.5): plays the composed song through the one song player, so a second ▶
// anywhere stops the first. Its words say what it plays ("Play your song", "Before today"); while its song plays it
// says Stop. `round` is the big round button of Today's hero and the song page; the others are kit buttons. Its name
// changes between Play and Stop, so it has no `aria-pressed`: a name and a pressed state that both change would say
// the same thing twice ("Stop …, pressed").
import type { SongBand } from "@oak/strudel/song-compose";
import { clsx } from "clsx";
import { Loader2, Play, Square } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "../ui/kit/Button.tsx";
import { type PlaySongOptions, playSong, stopSong, useSongPlay } from "./player.ts";
import "./song.css";

export interface SongPlayButtonProps {
  /** This song and version for the player (`today:U01`, `take:U01:7`). */
  id: string;
  /** The song to play; `null` while it is being read (the button waits). */
  band: SongBand | null;
  /** What the button plays, in words ("Play your song"). */
  label: string;
  /**
   * The accessible name, when the label alone does not say what plays. It starts with "Play" ("Play “Count me in” as
   * it stands"); while the song plays, that word becomes "Stop".
   */
  ariaLabel?: string;
  options?: PlaySongOptions;
  look?: "round" | "button";
  /**
   * `quiet`: the round button as an accent ring that fills only while it plays, for Today, where Start session is the
   * one filled button of the page (ux.md §1.4). `solid` (default): filled.
   */
  tone?: "solid" | "quiet";
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  "data-testid"?: string;
}

export function SongPlayButton({
  id,
  band,
  label,
  ariaLabel,
  options,
  look = "button",
  tone = "solid",
  variant = "secondary",
  size = "md",
  className,
  "data-testid": testId = "song-play",
}: SongPlayButtonProps) {
  const p = useSongPlay(id);
  const onClick = () => {
    if (p.playing || p.loading) stopSong(id);
    else if (band) void playSong(id, band, options);
  };
  const name = p.playing || p.loading ? stopName(ariaLabel ?? label) : (ariaLabel ?? label);
  const error = p.error ? (
    <span
      role="status"
      className={clsx(
        "text-text-2",
        look === "round"
          ? "absolute top-full right-0 mt-1 w-max max-w-[14rem] text-right text-xs"
          : "text-sm",
      )}
      data-testid="song-play-error"
    >
      {p.error}
    </span>
  ) : null;
  if (look === "round")
    return (
      <span className={clsx("relative inline-flex flex-col items-center gap-1", className)}>
        <button
          type="button"
          onClick={onClick}
          disabled={!band}
          aria-label={name}
          data-testid={testId}
          data-state={p.playing ? "playing" : p.loading ? "loading" : "stopped"}
          data-tone={tone}
          className={clsx(
            "relative inline-flex size-12 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
            "disabled:cursor-not-allowed disabled:opacity-50",
            tone === "quiet"
              ? p.playing
                ? "oak-song-breathe border-transparent bg-accent text-on-accent hover:bg-accent-hover"
                : "border-2 border-accent bg-lane-in text-accent hover:bg-accent/15"
              : p.playing
                ? "oak-song-breathe border-accent bg-lane-in text-accent"
                : "border-transparent bg-accent text-on-accent hover:bg-accent-hover",
          )}
        >
          {p.loading ? (
            <Loader2 aria-hidden className="size-5 animate-spin reduced:animate-none" />
          ) : p.playing ? (
            <Square aria-hidden className="size-4" fill="currentColor" />
          ) : (
            <Play aria-hidden className="size-5 translate-x-px" fill="currentColor" />
          )}
        </button>
        {error}
      </span>
    );
  return (
    <span className={clsx("inline-flex flex-wrap items-center gap-2", className)}>
      <Button
        variant={p.playing ? "secondary" : variant}
        size={size}
        onClick={onClick}
        disabled={!band}
        loading={p.loading}
        aria-label={name}
        data-testid={testId}
        data-state={p.playing ? "playing" : p.loading ? "loading" : "stopped"}
        icon={
          p.playing ? (
            <Square aria-hidden className="size-3.5" fill="currentColor" />
          ) : (
            <Play aria-hidden className="size-3.5" fill="currentColor" />
          )
        }
      >
        {p.playing ? "Stop" : label}
      </Button>
      {error}
    </span>
  );
}

/** The name while the song plays: "Play “Count me in”" → "Stop “Count me in”"; a label with no "Play": "Stop: …". */
export function stopName(playName: string): string {
  return /^Play\b/.test(playName) ? playName.replace(/^Play\b/, "Stop") : `Stop: ${playName}`;
}
