// The song card above a lesson's first step (spec 2026-11-24 §5.5 "Lesson"): the unit's song in small, drawn by the
// app from data (never authored): its cover and title, ▶ "Your song so far", the grid with the cells today's Make
// takes, and today's line. A side step says why its Make stays a sketch of its own. Nothing for a lesson in no song,
// or while the song is not started (the New song moment comes first).
//
// A side lesson (A1.L01) says it is optional in the same card, under the song's line, and drops the grid: the card
// and a separate "Optional side lesson" box stacked to about 480 px and pushed the first step's task under the fold
// at 1280×800. The Make's strip and Today's hero still draw the grid.
import type { LessonId, UnitSongDef } from "@oak/api";
import type { ReactNode } from "react";
import { songStepOf } from "../../../content/unit-songs/index.ts";
import { useIntroducedTerms, useUnitSong } from "./hooks.ts";
import { nowId } from "./ids.ts";
import { songBandOf, songViewOf } from "./model.ts";
import { ringTonesOf, SongCover } from "./SongCover.tsx";
import { SongGrid } from "./SongGrid.tsx";
import { SongPlayButton } from "./SongPlayButton.tsx";
import { lessonOfSongLine } from "./surfaces-model.ts";

/** The side-lesson framing the card carries for a side lesson (app/src/lesson/side.ts `SideInfo`). */
export interface SongCardSide {
  /** "Optional side lesson, about 15 minutes". */
  heading: string;
  /** What it makes better and the reassurance that nothing waits for it. */
  text: string;
  /** "Leave for now", outside a session. */
  action?: ReactNode;
}

export function SongCard({
  lessonId,
  song: given,
  side = null,
  orElse = null,
}: {
  lessonId: string;
  song?: UnitSongDef;
  /** A side lesson: its framing inside this card, in place of the grid. */
  side?: SongCardSide | null;
  /** What shows when there is no card (a lesson in no song, a song not started): the side lesson's own box. */
  orElse?: ReactNode;
}) {
  const found = given
    ? { song: given, step: given.plan.find((p) => p.lesson === lessonId) ?? null }
    : songStepOf(lessonId as LessonId);
  const def = found?.song ?? null;
  const step = found?.step ?? null;
  const q = useUnitSong(def?.unit ?? null);
  const introduced = useIntroducedTerms();
  const detail = q.data ?? null;
  // While the song is read, the card's room is held (a side lesson's card is shorter: no grid), so the side lesson's
  // own box never shows first only to be replaced by the card that carries the same words.
  if (def && step && !detail && q.isPending)
    return (
      <div
        aria-hidden
        // About the card's height in the lesson's side column (measured 248 px with a side framing, 265 to 283 without).
        className={`mt-3 skeleton rounded-card ${side ? "h-[15.5rem]" : "h-[16.5rem]"}`}
        data-testid="song-card-pending"
      />
    );
  if (!def || !step || !detail || detail.status === "new") return <>{orElse}</>;
  const live = step.kind === "take" ? step : null;
  const view = songViewOf(def, detail, introduced, { live });
  const id = nowId(def.unit);
  return (
    <section
      aria-label={`Your song, “${view.title}”`}
      // A side lesson's card holds more words: tighter gaps keep the first step's task on the first screen.
      className={`mt-3 flex flex-col rounded-card border border-border bg-surface-2/60 p-3 ${side ? "gap-2" : "gap-2.5"}`}
      data-testid="song-card"
      data-step={step.kind}
    >
      <div className="flex items-center gap-3">
        <SongCover
          seed={def.unit}
          flavour={view.flavour}
          tones={ringTonesOf(def, detail.takes)}
          size={44}
          className="shrink-0 rounded-[6px]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[1.0625rem] leading-tight font-semibold">{view.title}</p>
          <p className="text-xs text-text-3 tabular-nums" data-testid="song-card-count">
            {/* Take lessons only (shared decision 2): a side lesson has no number. */}
            {lessonOfSongLine(def, lessonId) ?? `${view.lessonsInSong} lessons in this song`}
          </p>
        </div>
      </div>
      {side ? null : <SongGrid view={view} compact follows={id} todayWord="Today" />}
      {step.kind === "take" ? (
        <p className="text-sm leading-snug text-text" data-testid="song-card-today">
          {step.today}
        </p>
      ) : (
        <p className="text-sm leading-snug text-text-2" data-testid="song-card-side">
          {step.reason}
        </p>
      )}
      {side ? (
        <div data-testid="side-lesson-note">
          <p className="text-sm font-medium text-text">{side.heading}</p>
          <p className="text-sm leading-snug text-text-2">{side.text}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <SongPlayButton
          id={id}
          band={songBandOf(def, detail, { flavour: view.flavour })}
          label="Your song so far"
          ariaLabel={`Play “${view.title}” so far`}
          size="sm"
          data-testid="song-card-play"
        />
        {side?.action ?? null}
      </div>
    </section>
  );
}
