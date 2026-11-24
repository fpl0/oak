// Today's song hero (spec 2026-11-24 §5.5 "Today"), above the setlist: the song of the lesson Today plans, as it
// stands. Its cover (one ring per take, on the wood of its style), its title and style, a ▶ that plays it, the
// arrangement with a moving playhead and today's blocks marked, "Lesson 4 of 8 in this song" (take lessons only) with
// a dot per lesson, and today's line. A song Oak made from earlier lessons shows its one-time style card here (spec
// §5.6a). Once the day's session is done, the plan is the next lesson's: the hero says "next", not "today".
import type { SessionPlan, UnitId, UnitSongDef } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { unitSongOfUnit } from "../../../content/unit-songs/index.ts";
import { WOODS } from "../album/cover.ts";
import { useCourseProgress } from "../lib/queries.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Skeleton } from "../ui/kit/basics.tsx";
import { describeError } from "../ui/kit/QueryState.tsx";
import { useIntroducedTerms, useLessonTitles, useUnitSong } from "./hooks.ts";
import { nowId, ofUnit } from "./ids.ts";
import { songBandOf, songViewOf } from "./model.ts";
import { StyleCheck } from "./NewSong.tsx";
import { ringTonesOf, SongCover } from "./SongCover.tsx";
import { SongGrid } from "./SongGrid.tsx";
import { SongPlayButton } from "./SongPlayButton.tsx";
import {
  blocksLine,
  type LessonDot,
  lessonDots,
  ownedCount,
  songLessonOf,
  styleName,
  todayAdds,
} from "./surfaces-model.ts";

const NONE: ReadonlySet<string> = new Set();

export function SongHero({
  plan,
  song: given,
  done = false,
}: {
  plan: SessionPlan;
  song?: UnitSongDef;
  /** The day's session is done: the plan is the next lesson's, so the hero speaks of it as next, not today. */
  done?: boolean;
}) {
  const s = plan.song ?? null;
  const def = given ?? (s ? unitSongOfUnit(s.unitId as UnitId) : null);
  const q = useUnitSong(s && def ? s.unitId : null);
  const introduced = useIntroducedTerms();
  const titleOf = useLessonTitles();
  const progress = useCourseProgress();
  const lessons = progress.data?.lessons;
  const completed = useMemo(
    () => (lessons ? new Set(lessons.filter((l) => l.completedAt !== null).map((l) => l.lessonId)) : NONE),
    [lessons],
  );
  // What the style card kept or changed, said once it goes (a polite status), and where focus goes then.
  const [said, setSaid] = useState<string | null>(null);
  const openRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!said) return;
    const t = setTimeout(() => setSaid(null), 8000);
    return () => clearTimeout(t);
  }, [said]);
  // "Try again" goes with the error it sits in: once the song is read, focus moves to the hero's ▶ (its title when the
  // ▶ cannot take it), never to the page.
  const heroRef = useRef<HTMLElement>(null);
  const [retried, setRetried] = useState(false);
  const readBack = q.data !== undefined;
  useEffect(() => {
    if (!retried || !readBack) return;
    setRetried(false);
    const play = heroRef.current?.querySelector<HTMLButtonElement>('[data-testid="song-hero-play"]');
    if (play && !play.disabled) play.focus();
    else heroRef.current?.querySelector<HTMLElement>("#song-hero-title")?.focus();
  }, [retried, readBack]);
  if (!s || !def) return null;
  const detail = q.data ?? null;
  // Until the song is read (or when it cannot be), nothing is drawn as if no lesson were in it yet.
  const reading = detail === null && q.isPending;
  const failed = detail === null && q.isError;
  const step = def.plan.find((p) => p.lesson === plan.mapItemId) ?? null;
  const view = songViewOf(def, detail, introduced, {
    live: step?.kind === "take" ? step : null,
    flavour: s.flavour,
  });
  const fresh = (detail?.status ?? s.status) === "new";
  const side = s.side || step?.kind === "side";
  // A song not started starts at its first take lesson (the New song moment): on a side step before it, nothing does.
  const firstTake = def.plan.find((p) => p.kind === "take") ?? null;
  const firstTitle = firstTake ? titleOf(firstTake.lesson) : null;
  // Only saved blocks are yours (shared decision 1), so the song page says the same number; today's are said apart
  // ("today adds 4") until the day is done, when they are the next lesson's.
  const saved = songViewOf(def, detail, introduced, { flavour: s.flavour });
  const count = ownedCount(saved);
  const adds = done ? 0 : todayAdds(saved, view);
  const dots = lessonDots(def, detail, plan.mapItemId, completed);
  const tones = detail ? ringTonesOf(def, detail.takes) : [];
  const id = nowId(def.unit);
  const where = songLessonOf(def, plan.mapItemId);
  // The next take lesson after a side step, to say where the song goes on.
  const at = def.plan.findIndex((p) => p.lesson === plan.mapItemId);
  const nextTake = def.plan.slice(at + 1).find((p) => p.kind === "take") ?? null;
  const nextTitle = nextTake ? titleOf(nextTake.lesson) : null;
  // Shared decision 2: take lessons only. A side lesson has no number, so its day says where the song goes on.
  const lessonLine =
    where.index !== null
      ? `${done ? "Next: lesson" : "Lesson"} ${where.index} of ${where.of} in this song`
      : !fresh && nextTitle
        ? `Next in this song: “${nextTitle}”`
        : `${where.of} lessons in this song`;
  return (
    <section
      ref={heroRef}
      aria-labelledby="song-hero-title"
      className="relative overflow-hidden rounded-card border border-border bg-surface shadow-card"
      data-testid="song-hero"
      data-status={detail?.status ?? s.status}
      data-state={reading ? "loading" : failed ? "error" : done ? "done" : "ready"}
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
              {!fresh
                ? `Your song, in ${styleName(view.flavour)}`
                : !side
                  ? done
                    ? "A new song starts with your next lesson"
                    : "A new song starts today"
                  : firstTitle
                    ? `A new song starts with “${firstTitle}”`
                    : "A new song starts in a later lesson"}
            </p>
            {/* Two lines before it is cut, and the whole title on hover: a long title is still read. */}
            <h2
              id="song-hero-title"
              tabIndex={-1}
              title={view.title}
              className="line-clamp-2 outline-none font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.01em] break-words"
            >
              {view.title}
            </h2>
            <p className="text-sm text-text-2 tabular-nums" data-testid="song-hero-count">
              {lessonLine}
              {!fresh && detail && count.yours + adds > 0 ? (
                <span className="text-text-3"> · {blocksLine(saved, adds)}</span>
              ) : null}
            </p>
            {reading ? (
              <Skeleton className="mt-1 h-2.5 w-40" />
            ) : failed ? null : (
              <Dots dots={dots} titleOf={titleOf} done={done} fresh={fresh} />
            )}
          </div>
          {/* Quiet: Start session is the one filled button on Today (ux.md §1.4); it fills while the song plays. */}
          <SongPlayButton
            id={id}
            band={detail ? songBandOf(def, detail, { flavour: view.flavour }) : null}
            label="Play your song"
            ariaLabel={`Play “${view.title}” as it stands`}
            look="round"
            tone="quiet"
            data-testid="song-hero-play"
          />
        </div>

        {reading ? (
          <div role="status" data-testid="song-hero-loading">
            <span className="sr-only">Reading your song…</span>
            <Skeleton className="h-40 w-full" />
          </div>
        ) : failed ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-control border border-border bg-surface-2 px-4 py-3 text-sm"
            data-testid="song-hero-error"
          >
            <span className="min-w-0 flex-1">
              Your song could not be read. {describeError(q.error).title}.
            </span>
            <Button
              size="sm"
              icon={<RotateCcw aria-hidden className="size-4" />}
              onClick={() => {
                setRetried(true);
                void q.refetch();
              }}
              data-testid="song-hero-retry"
            >
              Try again
            </Button>
          </div>
        ) : (
          <SongGrid view={view} follows={ofUnit(def.unit)} todayWord={done ? "Next lesson" : "Today"} />
        )}

        {side ? (
          <p className="text-sm text-text-2" data-testid="song-hero-side">
            {/* The content's reason is one finished line that already says so (AUTHORING §23). */}
            {step?.kind === "side" ? step.reason : "Today's Make stays a sketch of its own."}
          </p>
        ) : s.today ? (
          <p className="border-l-2 border-accent pl-3 leading-snug text-text" data-testid="song-hero-today">
            {done ? <span className="text-text-2">Next time: </span> : null}
            {s.today}
            {fresh ? <span className="text-text-2"> You pick its style when the lesson opens.</span> : null}
          </p>
        ) : null}

        <StyleCheck
          unitId={def.unit}
          song={def}
          onDone={(line) => {
            setSaid(line);
            // The card goes with the button that had focus: focus moves on to the next control.
            openRef.current?.focus();
          }}
        />

        {!fresh && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link
              ref={openRef}
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
            <span role="status" className="text-text-2" data-testid="song-hero-said">
              {said}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function dotWords(state: LessonDot["state"], o: { done: boolean; fresh: boolean }): string {
  switch (state) {
    case "yours":
      return "in your song";
    case "today":
      return o.done ? "next" : "today";
    case "side-today":
      return o.done ? "next, a sketch of its own" : "today, a sketch of its own";
    case "side":
      return "a sketch of its own";
    case "done":
      return o.fresh ? "done, joins the song when it starts" : "done";
    case "later":
      return "later";
  }
}

/**
 * One small mark per lesson of the song's plan: filled once its take is in, ringed for today, a dash for a side
 * lesson (ringed on its own day, so it keeps its shape). Each mark says its lesson and state on hover and to a
 * screen reader; a side dash is named in a short key beside the row, the one mark a learner cannot guess.
 */
function Dots({
  dots,
  titleOf,
  done,
  fresh,
}: {
  dots: readonly LessonDot[];
  titleOf(id: string): string | null;
  done: boolean;
  fresh: boolean;
}) {
  const hasSide = dots.some((d) => d.state === "side" || d.state === "side-today");
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="The lessons of this song">
        {dots.map((d) => {
          const words = `${titleOf(d.lessonId) ?? "A lesson"}: ${dotWords(d.state, { done, fresh })}`;
          return (
            <li
              key={d.lessonId}
              data-dot={d.state}
              title={words}
              className={clsx(
                "inline-block rounded-full",
                d.state === "side" || d.state === "side-today" ? "h-0.5 w-2.5" : "size-2.5",
                // Full-strength text-3 for the quiet marks: 3:1 against the card in both themes.
                d.state === "side" && "bg-text-3",
                d.state === "side-today" &&
                  "bg-accent ring-2 ring-accent/40 ring-offset-1 ring-offset-surface",
                d.state === "yours" && "bg-accent",
                d.state === "done" && "bg-text-3",
                d.state === "today" && "border-2 border-accent bg-accent/20 ring-2 ring-accent/20",
                d.state === "later" && "border border-text-3",
              )}
            >
              <span className="sr-only">{words}</span>
            </li>
          );
        })}
      </ol>
      {hasSide && (
        <span aria-hidden className="inline-flex items-center gap-1.5 text-xs text-text-3">
          <span className="inline-block h-0.5 w-2.5 rounded-full bg-text-3" />a sketch of its own
        </span>
      )}
    </div>
  );
}
