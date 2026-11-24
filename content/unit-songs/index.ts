// The unit songs (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.1, §6): one song per unit, in
// content/unit-songs/<UNIT>.ts, each validated by `defineUnitSong` when it is imported. Isomorphic: the app, the
// server (server/src/content/loader.ts) and content CI import this registry directly.
// biome-ignore-all assist/source/organizeImports: the songs are imported in course order, as `unitSongs` lists them.
import type { LessonId, TakeoverStep, UnitId, UnitSongDef, UnitSongId } from "@oak/content-kit";
import { U01_SONG } from "./U01.ts";
import { U02_SONG } from "./U02.ts";
import { U03_SONG } from "./U03.ts";
import { U04_SONG } from "./U04.ts";
import { U05_SONG } from "./U05.ts";
import { U06_SONG } from "./U06.ts";
import { U07_SONG } from "./U07.ts";
import { U08_SONG } from "./U08.ts";
import { U09_SONG } from "./U09.ts";
import { U10_SONG } from "./U10.ts";
import { U11_SONG } from "./U11.ts";
import { U12_SONG } from "./U12.ts";
import { U13_SONG } from "./U13.ts";
import { U14_SONG } from "./U14.ts";
import { U15_SONG } from "./U15.ts";
import { U16_SONG } from "./U16.ts";
import { U17_SONG } from "./U17.ts";
import { J1_SONG } from "./J1.ts";
import { J2_SONG } from "./J2.ts";
import { J3_SONG } from "./J3.ts";
import { J4_SONG } from "./J4.ts";
import { J5_SONG } from "./J5.ts";
import { R1_SONG } from "./R1.ts";
import { R2_SONG } from "./R2.ts";
import { R3_SONG } from "./R3.ts";
import { A1_SONG } from "./A1.ts";
import { A2_SONG } from "./A2.ts";

export const unitSongs: readonly UnitSongDef[] = Object.freeze([
  U01_SONG,
  U02_SONG,
  U03_SONG,
  U04_SONG,
  U05_SONG,
  U06_SONG,
  U07_SONG,
  U08_SONG,
  U09_SONG,
  U10_SONG,
  U11_SONG,
  U12_SONG,
  U13_SONG,
  U14_SONG,
  U15_SONG,
  U16_SONG,
  U17_SONG,
  J1_SONG,
  J2_SONG,
  J3_SONG,
  J4_SONG,
  J5_SONG,
  R1_SONG,
  R2_SONG,
  R3_SONG,
  A1_SONG,
  A2_SONG,
]);

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
