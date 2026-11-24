// The song card above a lesson's first step (spec 2026-11-24 §5.5 "Lesson"): the unit's song in small, drawn by the
// app from data (never authored): its cover and title, ▶ "Your song so far", the grid with the cells today's Make
// takes, and today's line. A side step says why its Make stays a sketch of its own. Nothing for a lesson in no song,
// or while the song is not started (the New song moment comes first).
import type { LessonId, UnitSongDef } from "@oak/api";
import { songStepOf } from "../../../content/unit-songs/index.ts";
import { useIntroducedTerms, useUnitSong } from "./hooks.ts";
import { nowId } from "./ids.ts";
import { songBandOf, songViewOf } from "./model.ts";
import { ringTonesOf, SongCover } from "./SongCover.tsx";
import { SongGrid } from "./SongGrid.tsx";
import { SongPlayButton } from "./SongPlayButton.tsx";

export function SongCard({ lessonId, song: given }: { lessonId: string; song?: UnitSongDef }) {
  const found = given
    ? { song: given, step: given.plan.find((p) => p.lesson === lessonId) ?? null }
    : songStepOf(lessonId as LessonId);
  const def = found?.song ?? null;
  const step = found?.step ?? null;
  const q = useUnitSong(def?.unit ?? null);
  const introduced = useIntroducedTerms();
  const detail = q.data ?? null;
  if (!def || !step || !detail || detail.status === "new") return null;
  const live = step.kind === "take" ? step : null;
  const view = songViewOf(def, detail, introduced, { live });
  const index = def.plan.findIndex((p) => p.lesson === lessonId) + 1;
  const id = nowId(def.unit);
  return (
    <section
      aria-label={`Your song, “${view.title}”`}
      className="mt-3 flex flex-col gap-2.5 rounded-card border border-border bg-surface-2/60 p-3"
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
            Lesson {index} of {view.lessonsInSong} in this song
          </p>
        </div>
      </div>
      <SongGrid view={view} compact follows={id} todayWord="Today" />
      {step.kind === "take" ? (
        <p className="text-sm leading-snug text-text" data-testid="song-card-today">
          {step.today}
        </p>
      ) : (
        <p className="text-sm leading-snug text-text-2" data-testid="song-card-side">
          {step.reason}
        </p>
      )}
      <SongPlayButton
        id={id}
        band={songBandOf(def, detail, { flavour: view.flavour })}
        label="Your song so far"
        ariaLabel={`Play “${view.title}” so far`}
        size="sm"
        className="self-start"
        data-testid="song-card-play"
      />
    </section>
  );
}
