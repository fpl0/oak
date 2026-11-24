// The New song moment (spec 2026-11-24 §5.5): before the first take lesson of a unit whose song is not started, a
// full page with Oak's song, finished, in five styles, each with ▶, the working title, and "Start this song". It
// opens on the profile's style (the server's answer for a song not started). `StyleCheck` is the one-time card on
// Today for a song Oak made from earlier lessons (spec §5.6a): keep the style or pick another.
import type { FlavourId, UnitId, UnitSongDef } from "@oak/api";
import { clsx } from "clsx";
import { Check, Loader2, Play, Square } from "lucide-react";
import { useId, useState } from "react";
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

/** A style's ▶: Oak's whole song in that style, through the one song player. */
function StylePlay({ def, style, dark }: { def: UnitSongDef; style: SongStyle; dark: boolean }) {
  const id = styleId(def.unit, style.id);
  const p = useSongPlay(id);
  const busy = p.playing || p.loading;
  return (
    <button
      type="button"
      onClick={() => (busy ? stopSong(id) : void playSong(id, songBandOf(def, null, { flavour: style.id })))}
      aria-label={busy ? `Stop the ${style.name} preview` : `Play the song in ${style.name}`}
      aria-pressed={p.playing}
      data-testid="style-play"
      className={clsx(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
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

/** The five styles as wood swatches, one to pick, each with ▶. */
export function StylePicker({
  def,
  value,
  onChange,
  compact = false,
}: {
  def: UnitSongDef;
  value: FlavourId;
  onChange(flavour: FlavourId): void;
  compact?: boolean;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label="The song's style"
      className={clsx(
        "grid gap-3",
        compact
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
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
              "relative flex items-start gap-3 overflow-hidden rounded-card p-3 transition-shadow duration-200",
              "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent",
              on
                ? "shadow-[0_0_0_2px_var(--oak-accent),0_6px_18px_-8px_rgba(0,0,0,.35)]"
                : "shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]",
            )}
            style={{ background: wood.bg, color: wood.ink }}
          >
            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
              <input
                type="radio"
                name={name}
                value={s.id}
                checked={on}
                onChange={() => onChange(s.id)}
                className="sr-only"
                data-testid="style-option"
              />
              {!compact && (
                <SongCover
                  seed={`${def.unit}:${s.id}`}
                  flavour={s.id}
                  tones={[wood.line, wood.line, wood.line]}
                  size={52}
                  className="shrink-0 rounded-[6px]"
                />
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={clsx(
                    "flex items-center gap-1.5 font-display leading-tight font-semibold",
                    compact ? "text-base" : "text-h3",
                  )}
                >
                  {s.name}
                  {on && (
                    <span
                      aria-hidden
                      className="inline-flex size-4 items-center justify-center rounded-full bg-accent text-on-accent"
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </span>
                {!compact && <span className="text-sm leading-snug opacity-80">{s.blurb}</span>}
              </span>
            </label>
            <StylePlay def={def} style={s} dark={dark} />
          </div>
        );
      })}
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
      className="mx-auto flex max-w-5xl flex-col gap-8 py-4 animate-fade-in"
      data-testid="new-song"
    >
      <header className="grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <SongCover
          seed={def.unit}
          flavour={flavour}
          tones={[]}
          size={148}
          className="rounded-[14px] shadow-card"
          label={`The cover of “${name}”: no rings yet`}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-sm text-text-3">A new song</p>
          <h1
            id={`${titleId}-h`}
            className="font-display text-[clamp(2rem,4.2vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.015em]"
            data-testid="new-song-title"
          >
            {name || def.title}
          </h1>
          <p className="max-w-[58ch] text-text-2">
            Oak plays all of this song from the start. In each lesson of this unit your code takes over a
            little more of it, until most of it is yours.
          </p>
        </div>
      </header>

      <SongGrid view={view} follows={ofUnit(def.unit)} legend={false} tintOak />

      <div className="flex flex-col gap-3">
        <h2 className="text-h3">Pick a style</h2>
        <StylePicker def={def} value={flavour} onChange={setPicked} />
        <p className="text-sm text-text-3">
          You can change the style later. The song keeps everything you add to it.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-t border-border pt-5">
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
          <span className="text-sm font-medium">Song title</span>
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 rounded-control border border-control-border bg-control px-3 font-display text-lg"
            data-testid="new-song-name"
          />
        </label>
        <Button
          variant="primary"
          size="lg"
          onClick={() => void begin()}
          loading={busy}
          disabled={!name.trim()}
          data-testid="new-song-start"
        >
          Start this song in {styleName(flavour)}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-issue">
          {error}
        </p>
      )}
    </section>
  );
}

/**
 * Today's one-time card for a song Oak made from the learner's earlier lessons (spec §5.6a): it says so, and offers the
 * styles. "Keep" marks the style seen; another style changes it (which also marks it seen).
 */
export function StyleCheck({ unitId, song: given }: { unitId: string; song?: UnitSongDef }) {
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
          {styleName(detail.flavour)} style. Keep it, or pick another style.
        </p>
      </div>
      <StylePicker def={def} value={flavour} onChange={setPicked} compact />
      <div className="flex flex-wrap gap-2">
        {changed ? (
          <Button
            variant="primary"
            size="sm"
            loading={set.isPending}
            onClick={() => set.mutate({ params, body: { flavour } })}
            data-testid="song-style-use"
          >
            Use {styleName(flavour)}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            loading={ack.isPending}
            onClick={() => ack.mutate({ params })}
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
