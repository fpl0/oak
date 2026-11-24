// Today's song hero (spec 2026-11-24 §5.5 "Today"), above the setlist: the song of the lesson Today plans, as it
// stands. Its cover (one ring per take, on the wood of its style), its title and style, a ▶ that plays it, the
// arrangement with a moving playhead and today's cells marked, "Lesson 4 of 9 in this song" with a dot per lesson,
// and today's line. A song Oak made from earlier lessons shows its one-time style card here (spec §5.6a).
import type { SessionPlan, UnitId, UnitSongDef } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { unitSongOfUnit } from "../../../content/unit-songs/index.ts";
import { WOODS } from "../album/cover.ts";
import { useIntroducedTerms, useLessonTitles, useUnitSong } from "./hooks.ts";
import { nowId, ofUnit } from "./ids.ts";
import { songBandOf, songViewOf } from "./model.ts";
import { StyleCheck } from "./NewSong.tsx";
import { ringTonesOf, SongCover } from "./SongCover.tsx";
import { SongGrid } from "./SongGrid.tsx";
import { SongPlayButton } from "./SongPlayButton.tsx";
import { type LessonDot, lessonDots, ownedCount, styleName } from "./surfaces-model.ts";

export function SongHero({ plan, song: given }: { plan: SessionPlan; song?: UnitSongDef }) {
  const s = plan.song ?? null;
  const def = given ?? (s ? unitSongOfUnit(s.unitId as UnitId) : null);
  const q = useUnitSong(s && def ? s.unitId : null);
  const introduced = useIntroducedTerms();
  const titleOf = useLessonTitles();
  if (!s || !def) return null;
  const detail = q.data ?? null;
  const step = def.plan.find((p) => p.lesson === plan.mapItemId) ?? null;
  const view = songViewOf(def, detail, introduced, {
    live: step?.kind === "take" ? step : null,
    flavour: s.flavour,
  });
  const fresh = (detail?.status ?? s.status) === "new";
  const count = ownedCount(view);
  const dots = lessonDots(def, detail, plan.mapItemId);
  const tones = detail ? ringTonesOf(def, detail.takes) : [];
  const id = nowId(def.unit);
  return (
    <section
      aria-labelledby="song-hero-title"
      className="relative overflow-hidden rounded-card border border-border bg-surface shadow-card"
      data-testid="song-hero"
      data-status={detail?.status ?? s.status}
    >
      {/* the style's wood as a thin edge: the song's colour on a page that is otherwise warm neutral */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: (WOODS[view.flavour as keyof typeof WOODS] ?? WOODS.default).line }}
      />
      <div className="flex flex-col gap-4 p-5 pl-6">
        <div className="flex items-start gap-4">
          <Link
            to="/song/$unitId"
            params={{ unitId: def.unit }}
            className="shrink-0 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={`Open “${view.title}”`}
          >
            <SongCover
              seed={def.unit}
              flavour={view.flavour}
              tones={tones}
              size={96}
              className="rounded-[10px] shadow-card"
            />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-sm text-text-3">
              {fresh ? "A new song starts today" : `Your song, in ${styleName(view.flavour)}`}
            </p>
            <h2
              id="song-hero-title"
              className="truncate font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.01em]"
            >
              {view.title}
            </h2>
            <p className="text-sm text-text-2 tabular-nums" data-testid="song-hero-count">
              Lesson {s.lessonIndex} of {s.lessonsInSong} in this song
              {!fresh && count.yours > 0 ? (
                <span className="text-text-3">
                  {" "}
                  · {count.yours} of {count.total} cells yours
                </span>
              ) : null}
            </p>
            <Dots dots={dots} titleOf={titleOf} />
          </div>
          <SongPlayButton
            id={id}
            band={detail ? songBandOf(def, detail, { flavour: view.flavour }) : null}
            label="Play your song"
            ariaLabel={`Play “${view.title}” as it stands`}
            look="round"
            data-testid="song-hero-play"
          />
        </div>

        <SongGrid view={view} follows={ofUnit(def.unit)} todayWord="Today" />

        {s.side || step?.kind === "side" ? (
          <p className="text-sm text-text-2" data-testid="song-hero-side">
            Today's Make stays a sketch of its own. {step?.kind === "side" ? step.reason : ""}
          </p>
        ) : s.today ? (
          <p className="border-l-2 border-accent pl-3 leading-snug text-text" data-testid="song-hero-today">
            {s.today}
            {fresh ? <span className="text-text-2"> You pick its style when the lesson opens.</span> : null}
          </p>
        ) : null}

        <StyleCheck unitId={def.unit} song={def} />

        {!fresh && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link
              to="/song/$unitId"
              params={{ unitId: def.unit }}
              className="font-medium text-link underline-offset-2 hover:underline"
              data-testid="song-hero-open"
            >
              Open the song
            </Link>
            {detail?.changedSinceRelease && (
              <span className="text-text-3">Changed since you released it</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const DOT_WORDS: Record<LessonDot["state"], string> = {
  yours: "in your song",
  today: "today",
  later: "later",
  side: "a sketch of its own",
};

/** One small ring per lesson of the song's plan: filled once its take is in, ringed for today. */
function Dots({ dots, titleOf }: { dots: readonly LessonDot[]; titleOf(id: string): string | null }) {
  return (
    <ol className="mt-1 flex flex-wrap items-center gap-1.5" aria-label="The lessons of this song">
      {dots.map((d) => (
        <li
          key={d.lessonId}
          data-dot={d.state}
          title={`${titleOf(d.lessonId) ?? d.lessonId}: ${DOT_WORDS[d.state]}`}
          className={clsx(
            "inline-block rounded-full",
            d.state === "side" ? "h-0.5 w-2.5 bg-text-3/50" : "size-2.5",
            d.state === "yours" && "bg-accent",
            d.state === "today" && "border-2 border-accent bg-accent/20 ring-2 ring-accent/20",
            d.state === "later" && "border border-text-3/50",
          )}
        >
          <span className="sr-only">
            {titleOf(d.lessonId) ?? d.lessonId}: {DOT_WORDS[d.state]}
          </span>
        </li>
      ))}
    </ol>
  );
}
