// The New song moment (spec 2026-11-24 §5.5): before the first take lesson of a unit whose song is not started, a
// full page with Oak's song, finished, in five styles, each with ▶, the working title, and "Start this song" (the
// title and Start in the header, so the way on is on the first screen). It opens on the profile's style (the
// server's answer for a song not started). `StyleCheck` is the one-time card on Today for a song Oak made from
// earlier lessons (spec §5.6a): keep the style or pick another.
import type { FlavourId, UnitId, UnitSongDef, UnitSongTake } from "@oak/api";
import { clsx } from "clsx";
import { Check, Loader2, Play, Square } from "lucide-react";
import { type CSSProperties, useId, useState } from "react";
import { unitSongOfUnit } from "../../../content/unit-songs/index.ts";
import { WOODS } from "../album/cover.ts";
import { idempotencyKey } from "../lib/idempotency.ts";
import { Button } from "../ui/kit/Button.tsx";
import { ErrorState, LoadingState } from "../ui/kit/QueryState.tsx";
import {
  useAckSongStyle,
  useIntroducedTerms,
  useRenameSong,
  useSetSongFlavour,
  useStartSong,
  useUnitSong,
} from "./hooks.ts";
import { ofUnit, styleId } from "./ids.ts";
import { songBandOf, songViewOf } from "./model.ts";
import { playSong, stopSong, useSongPlay } from "./player.ts";
import { SongCover } from "./SongCover.tsx";
import { SongGrid } from "./SongGrid.tsx";
import { SONG_STYLES, type SongStyle, styleName } from "./surfaces-model.ts";

const keyFor = (what: string) => `${what}-${idempotencyKey()}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);

/**
 * A style's ▶, through the one song player. With `takes` (Today's style card: the song exists) it plays the learner's
 * song in that style, their code in it, as the card says; without (the New song moment) Oak's whole song. Its name
 * changes between Play and Stop, so it has no `aria-pressed`.
 */
function StylePlay({
  def,
  style,
  dark,
  takes,
  title,
}: {
  def: UnitSongDef;
  style: SongStyle;
  dark: boolean;
  takes: readonly UnitSongTake[] | null;
  /** The song's title, for the top bar's Now playing ("Count me in, in Funk"). */
  title: string;
}) {
  const id = styleId(def.unit, style.id);
  const p = useSongPlay(id);
  const busy = p.playing || p.loading;
  // The style is the one asked for: a detail-like object whose flavour is this style, not the song's own.
  const band = () =>
    songBandOf(def, takes ? { flavour: style.id, takes: [...takes] } : null, { flavour: style.id });
  const what = takes ? `your song in ${style.name}` : `the song in ${style.name}`;
  return (
    <button
      type="button"
      onClick={() => (busy ? stopSong(id) : void playSong(id, band(), { title, style: style.name }))}
      aria-label={busy ? (takes ? `Stop ${what}` : `Stop the ${style.name} preview`) : `Play ${what}`}
      data-testid="style-play"
      data-state={p.playing ? "playing" : p.loading ? "loading" : "stopped"}
      className={clsx(
        // Above the label's click area, which covers the whole card.
        "pointer-events-auto relative z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        dark
          ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
          : "border-black/15 bg-black/5 text-black/80 hover:bg-black/10",
        p.playing && "oak-song-breathe",
      )}
    >
      {p.loading ? (
        <Loader2 aria-hidden className="size-4 animate-spin reduced:animate-none" />
      ) : p.playing ? (
        <Square aria-hidden className="size-3.5" fill="currentColor" />
      ) : (
        <Play aria-hidden className="size-4 translate-x-px" fill="currentColor" />
      )}
    </button>
  );
}

/**
 * The five styles as wood swatches, one to pick, each with ▶. A card is a column: the style's cover and its ▶ on the
 * first row, then the name (and, on the New song moment, what it sounds like) across the card's whole width, so a
 * long name ("Electronic") never runs under the ▶ and a blurb never wraps a word a line. The picked card has an
 * accent ring and a check on its cover (not colour alone). Columns follow the picker's own width, not the window's:
 * the lesson's sidebar and rail narrow it.
 */
export function StylePicker({
  def,
  value,
  onChange,
  compact = false,
  takes = null,
  title,
}: {
  def: UnitSongDef;
  value: FlavourId;
  onChange(flavour: FlavourId): void;
  compact?: boolean;
  /** The learner's takes: each ▶ plays their song in its style (Today's style card). */
  takes?: readonly UnitSongTake[] | null;
  /** The song's title as the learner has it (default: Oak's working title). */
  title?: string;
}) {
  const name = useId();
  return (
    <div className="@container">
      <div
        role="radiogroup"
        aria-label="The song's style"
        className={clsx(
          "grid gap-3",
          compact
            ? "grid-cols-2 @md:grid-cols-3 @xl:grid-cols-5"
            : "grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-5",
        )}
        data-testid="style-picker"
      >
        {SONG_STYLES.map((s) => {
          const wood = WOODS[s.id as keyof typeof WOODS] ?? WOODS.default;
          const dark = wood.theme === "bark";
          const on = value === s.id;
          return (
            <div
              key={s.id}
              data-style={s.id}
              data-picked={on ? "1" : "0"}
              className={clsx(
                "relative flex flex-col gap-2.5 rounded-card p-3 transition-shadow duration-200",
                "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent",
                "bg-(--wood-bg)",
                // A light wood on Bark is toned down a little, so it reads as wood on a dark page rather than as a
                // card of the light theme; its ink keeps well over 7:1 on it.
                !dark && "dark:bg-[color-mix(in_oklab,var(--wood-bg)_84%,black)]",
                on && "shadow-[0_0_0_2px_var(--oak-accent),0_6px_18px_-8px_rgba(0,0,0,.35)]",
              )}
              style={
                {
                  "--wood-bg": wood.bg,
                  color: wood.ink,
                  // Every card's edge comes from its own ink, so a dark wood shows its edge on Bark and a light wood
                  // on Paper (a fixed dark hairline vanished on the dark woods).
                  ...(on
                    ? {}
                    : { boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${wood.ink} 24%, transparent)` }),
                } as CSSProperties
              }
            >
              {/* The label's click area covers the card (after:inset-0); the ▶ sits above it. */}
              <label className="flex min-w-0 cursor-pointer flex-col gap-0.5 after:absolute after:inset-0 after:rounded-card">
                <input
                  type="radio"
                  name={name}
                  value={s.id}
                  checked={on}
                  onChange={() => onChange(s.id)}
                  className="sr-only"
                  data-testid="style-option"
                />
                <span
                  className={clsx(
                    "font-display leading-tight font-semibold whitespace-nowrap",
                    compact ? "text-base" : "text-h3",
                  )}
                >
                  {s.name}
                </span>
                {!compact && <span className="text-sm leading-snug opacity-80">{s.blurb}</span>}
              </label>
              {/* Drawn first (order-first) but after the radio in the DOM, so Tab reaches the card's radio, then its ▶.
                  Clicks pass through it to the label's click area, except on the ▶. */}
              <div className="pointer-events-none order-first flex items-start justify-between gap-2">
                <span className="relative shrink-0">
                  <SongCover
                    seed={`${def.unit}:${s.id}`}
                    flavour={s.id}
                    tones={[wood.line, wood.line, wood.line]}
                    size={compact ? 32 : 48}
                    className="rounded-[6px]"
                  />
                  {on && (
                    <span
                      aria-hidden
                      data-testid="style-check"
                      className="absolute -right-1.5 -bottom-1.5 inline-flex size-4 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_0_0_2px_var(--wood-bg)]"
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <StylePlay def={def} style={s} dark={dark} takes={takes} title={title ?? def.title} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NewSong({
  unitId,
  onStarted,
  song: given,
}: {
  unitId: string;
  onStarted(): void;
  /** The song (default: the content's song of the unit). */
  song?: UnitSongDef;
}) {
  const def = given ?? unitSongOfUnit(unitId as UnitId);
  const q = useUnitSong(def ? unitId : null);
  const introduced = useIntroducedTerms();
  const start = useStartSong();
  const rename = useRenameSong();
  const [picked, setPicked] = useState<FlavourId | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [key] = useState(() => keyFor("song-start"));
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  if (!def) return null;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <LoadingState label="Opening the song" />;
  const detail = q.data;
  const flavour = picked ?? detail.flavour;
  const name = title ?? detail.title;
  // Spaces alone are no title: the heading keeps Oak's, and Start says why it waits.
  const untitled = name.trim() === "";
  const view = songViewOf(def, null, introduced, { flavour });
  const busy = start.isPending || rename.isPending;

  const begin = async () => {
    setError(null);
    stopSong();
    try {
      await start.mutateAsync({
        params: { unitId: unitId as UnitId },
        body: { flavour, idempotencyKey: key },
      });
      const clean = name.trim();
      if (clean && clean !== detail.title && clean.length <= 60)
        await rename.mutateAsync({ params: { unitId: unitId as UnitId }, body: { title: clean } });
      onStarted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The song did not start.");
    }
  };

  return (
    <section
      aria-labelledby={`${titleId}-h`}
      className="mx-auto flex max-w-5xl flex-col gap-7 py-4 animate-fade-in"
      data-testid="new-song"
    >
      {/* The title and Start sit in the header, beside the cover: the way on is on the first screen at 1280×800. */}
      <header className="grid items-start gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <SongCover
          seed={def.unit}
          flavour={flavour}
          tones={[]}
          size={148}
          className="rounded-[14px] shadow-card"
          label={`The cover of “${name.trim() || def.title}”: no rings yet`}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-sm text-text-3">A new song</p>
          <h1
            id={`${titleId}-h`}
            className="font-display text-[clamp(2rem,4.2vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.015em] break-words"
            data-testid="new-song-title"
          >
            {name.trim() || def.title}
          </h1>
          <p className="max-w-[58ch] text-text-2">
            Oak plays all of this song from the start. In each lesson of this unit your code takes over a
            little more of it, until most of it is yours.
          </p>
          <div className="mt-1 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[14rem] max-w-md flex-1 flex-col gap-1">
              <span className="text-sm font-medium">Song title</span>
              <input
                type="text"
                value={name}
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
                aria-describedby={untitled ? `${titleId}-need` : undefined}
                className="h-10 rounded-control border border-control-border bg-control px-3 font-display text-lg"
                data-testid="new-song-name"
              />
            </label>
            <Button
              variant="primary"
              size="lg"
              onClick={() => void begin()}
              loading={busy}
              disabled={untitled}
              aria-describedby={untitled ? `${titleId}-need` : undefined}
              data-testid="new-song-start"
            >
              Start this song in {styleName(flavour)}
            </Button>
          </div>
          {untitled && (
            <p id={`${titleId}-need`} className="text-sm text-text-2" data-testid="new-song-need-title">
              Give the song a title to start.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-issue">
              {error}
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-2" data-testid="new-song-grid-caption">
          The song, part by part: each row is a part, each column a section.
        </p>
        <SongGrid view={view} follows={ofUnit(def.unit)} legend={false} tintOak />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-h3">Pick a style</h2>
        <StylePicker def={def} value={flavour} onChange={setPicked} title={name.trim() || def.title} />
        <p className="text-sm text-text-3">
          You can change the style later. The song keeps everything you add to it.
        </p>
      </div>
    </section>
  );
}

/**
 * Today's one-time card for a song Oak made from the learner's earlier lessons (spec §5.6a): it says so, and offers the
 * styles, each ▶ playing the learner's own song in that style. "Keep" marks the style seen; another style changes it
 * (which also marks it seen). The card then goes; `onDone` says what was kept or changed, so the hero can say it
 * and move focus on.
 */
export function StyleCheck({
  unitId,
  song: given,
  onDone,
}: {
  unitId: string;
  song?: UnitSongDef;
  onDone?(said: string): void;
}) {
  const def = given ?? unitSongOfUnit(unitId as UnitId);
  const q = useUnitSong(def ? unitId : null);
  const ack = useAckSongStyle();
  const set = useSetSongFlavour();
  const [picked, setPicked] = useState<FlavourId | null>(null);
  const detail = q.data;
  if (!def || !detail?.backfilled || detail.styleSeen || detail.status === "new") return null;
  const flavour = picked ?? detail.flavour;
  const changed = flavour !== detail.flavour;
  const lessons = new Set(detail.takes.map((t) => t.lessonId)).size;
  const params = { unitId: unitId as UnitId };
  return (
    <div
      className="flex flex-col gap-3 rounded-control border border-accent-2/40 bg-accent-2/8 p-4"
      data-testid="song-style-check"
    >
      <div>
        <p className="font-medium">Oak made this song from your earlier lessons</p>
        <p className="mt-0.5 text-sm text-text-2">
          Your code from {lessons} {lessons === 1 ? "lesson is" : "lessons is"} already in it, playing in the{" "}
          {styleName(detail.flavour)} style. Play a style to hear your song in it. Keep it, or pick another
          style.
        </p>
      </div>
      <StylePicker
        def={def}
        value={flavour}
        onChange={setPicked}
        compact
        takes={detail.takes}
        title={detail.title}
      />
      <div className="flex flex-wrap gap-2">
        {/* Secondary: Start session stays the one filled button on Today (ux.md §1.4). */}
        {changed ? (
          <Button
            size="sm"
            loading={set.isPending}
            onClick={() =>
              set.mutate(
                { params, body: { flavour } },
                { onSuccess: () => onDone?.(`Your song now plays in ${styleName(flavour)}.`) },
              )
            }
            data-testid="song-style-use"
          >
            Use {styleName(flavour)}
          </Button>
        ) : (
          <Button
            size="sm"
            loading={ack.isPending}
            onClick={() =>
              ack.mutate(
                { params },
                { onSuccess: () => onDone?.(`Your song stays in ${styleName(detail.flavour)}.`) },
              )
            }
            data-testid="song-style-keep"
          >
            Keep {styleName(detail.flavour)}
          </Button>
        )}
      </div>
      {(changed ? set : ack).isError && (
        <p role="alert" className="text-sm text-issue" data-testid="song-style-check-error">
          {changed ? "The style was not changed" : "That was not saved"}:{" "}
          {(changed ? set : ack).error?.message}
        </p>
      )}
    </div>
  );
}
