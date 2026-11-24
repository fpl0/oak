// The cases of the song loudness harness (songs.pw.ts): every unit song in content/unit-songs/index.ts in every
// flavour, Oak's whole song with no take (the grid all Oak, as a new song plays it), and every take step with its
// lesson's reference answer (the Make's first passing test, as content CI reads it: content/validate/unit-songs.ts)
// playing as the live Make in that step's sections, the way the Make plays inside the song (app/src/song/model.ts
// `songBandOf` with `live`). Node side: only plain data goes to the page.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type Exercise,
  FLAVOUR_IDS,
  type FlavourId,
  type LessonDef,
  type LessonId,
  resolveGrid,
  type TakeStep,
  type UnitSongDef,
} from "@oak/content-kit";
import { unitSongs } from "../../../content/unit-songs/index.ts";

export const FLAVOURS: readonly FlavourId[] = FLAVOUR_IDS;
export const SONGS: readonly UnitSongDef[] = unitSongs;

/** A `SongBandWire` (song-compose.ts) as plain JSON. */
export interface SongWire {
  def: UnitSongDef;
  flavour: FlavourId;
  bpm: number;
  sources: [];
  grid: [string, string][];
  live?: { sourceId: "live"; sections: TakeStep["sections"]; step: TakeStep };
}

export interface PlacedSection {
  id: string;
  type: string;
  fromBar: number;
  toBar: number;
}

/** The song's sections with their bars (from bar 0). */
export function layoutOf(def: UnitSongDef): PlacedSection[] {
  let at = 0;
  return def.sections.map((s) => {
    const out = { id: s.id, type: s.type, fromBar: at, toBar: at + s.bars };
    at += s.bars;
    return out;
  });
}

export const songBars = (def: UnitSongDef): number => def.sections.reduce((n, s) => n + s.bars, 0);

/** Oak's whole song in one flavour, no take, as a new song plays it. */
export function songWire(def: UnitSongDef, flavour: FlavourId, live?: TakeStep): SongWire {
  const wire: SongWire = {
    def,
    flavour,
    bpm: def.bpm,
    sources: [],
    grid: [...resolveGrid(def, [])] as [string, string][],
  };
  if (live) wire.live = { sourceId: "live", sections: live.sections, step: live };
  return wire;
}

/** The bar windows a take plays in: its sections, joined where they touch. */
export function takeWindows(def: UnitSongDef, step: TakeStep): [number, number][] {
  const layout = layoutOf(def);
  const ids = step.sections === "all" ? layout.map((s) => s.id) : step.sections;
  const out: [number, number][] = [];
  for (const s of layout) {
    if (!ids.includes(s.id)) continue;
    const last = out[out.length - 1];
    if (last && last[1] === s.fromBar) last[1] = s.toBar;
    else out.push([s.fromBar, s.toBar]);
  }
  return out;
}

const CONTENT = resolve(import.meta.dirname, "../../../content");

async function lessonDef(id: LessonId): Promise<LessonDef | null> {
  const m = /^([A-Z][A-Z0-9]*?\d+)\.(L\d{2})$/.exec(id);
  if (!m) return null;
  const unit = m[1] as string;
  const file = join(CONTENT, unit.startsWith("U") ? "core" : "advanced", unit, m[2] as string, "lesson.ts");
  if (!existsSync(file)) return null;
  const mod = (await import(file)) as { default?: LessonDef };
  return mod.default ?? null;
}

/** A Make's reference code (spec §8): its first passing test's code. */
function referenceOf(make: Exercise): string | null {
  for (const t of make.tests)
    if (t.expect === "pass" && "code" in t.response && typeof t.response.code === "string")
      return t.response.code;
  return null;
}

export interface TakeCase {
  lesson: LessonId;
  step: TakeStep;
  windows: [number, number][];
  /** The reference answer, or null when the Make has none to read (reported, not measured). */
  code: string | null;
}

/** Every take step of a song with its reference answer. */
export async function takesOf(def: UnitSongDef): Promise<TakeCase[]> {
  const out: TakeCase[] = [];
  for (const step of def.plan) {
    if (step.kind !== "take") continue;
    const lesson = await lessonDef(step.lesson);
    const ex = lesson?.steps[lesson.steps.length - 1]?.exercise;
    const code = ex?.kind === "code-make" ? referenceOf(ex) : null;
    out.push({ lesson: step.lesson, step, windows: takeWindows(def, step), code });
  }
  return out;
}

/**
 * Section types for the contrast check: the loud parts, and the parts a song plays quieter. A build (`pre`,
 * `prechorus`), a stop, an ending or a reprise is neither.
 */
export const LOUD_TYPES = new Set(["chorus", "drive", "lift"]);
export const QUIET_TYPES = new Set(["intro", "verse", "bridge", "vamp", "b", "ballad", "solo"]);
