// The unit songs (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.1, §6): one song per unit, in
// content/unit-songs/<UNIT>.ts, each validated by `defineUnitSong` when it is imported. Isomorphic: the app, the
// server (server/src/content/loader.ts) and content CI import this registry directly.
import type { LessonId, TakeoverStep, UnitId, UnitSongDef, UnitSongId } from "@oak/content-kit";
import { U01_SONG } from "./U01.ts";
import { U02_SONG } from "./U02.ts";

export const unitSongs: readonly UnitSongDef[] = Object.freeze([U01_SONG, U02_SONG]);

export const unitSongById: ReadonlyMap<UnitSongId, UnitSongDef> = new Map(unitSongs.map((s) => [s.id, s]));

const byUnit = new Map<UnitId, UnitSongDef>();
const byLesson = new Map<LessonId, { song: UnitSongDef; step: TakeoverStep }>();
for (const song of unitSongs) {
  if (byUnit.has(song.unit)) throw new Error(`unit ${song.unit} has two songs`);
  byUnit.set(song.unit, song);
  for (const step of song.plan) {
    const other = byLesson.get(step.lesson);
    if (other) throw new Error(`${step.lesson} is in the plans of ${other.song.id} and ${song.id}`);
    byLesson.set(step.lesson, { song, step });
  }
}

/** The song of a unit, or `null` (U00 and the units whose song is not written yet). */
export function unitSongOfUnit(unit: UnitId): UnitSongDef | null {
  return byUnit.get(unit) ?? null;
}

/** The song a lesson belongs to and its step there (a take or a side step), or `null` for a lesson in no song. */
export function songStepOf(lesson: LessonId): { song: UnitSongDef; step: TakeoverStep } | null {
  return byLesson.get(lesson) ?? null;
}
