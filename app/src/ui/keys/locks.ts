// Honest locked rows in the shortcut sheet (Wave 5). The Workbench's lens and panel keys work only once their tool
// is unlocked (a lens, the form map, the scope, the chart …); the sheet lists every key, so a row whose tool the
// learner does not have yet says when it opens ("Opens with unit 9, Form.") instead of listing a key that does
// nothing. Pure: the tables come from the owners (workbench panels, app lenses) and the course from the content
// bundle, so nothing here repeats an unlock site (tested in locks.test.ts against content/toolbox.ts).
import type { SyllabusDef, ToolEntry } from "@oak/content-kit";
import {
  CHORD_LENS_UNLOCKS,
  LENS_UNLOCKS,
  LINE_LENS_UNLOCKS,
  MUSIC_LENS_UNLOCKS,
  TRACK_LENS_GATES,
} from "../../lib/lenses.ts";
import { PANEL_SWITCHES, PANEL_UNLOCKS } from "../../workbench/panels.ts";
import { lessonWords, opensWithNote, unitWords } from "../kit/lock-notes.ts";
import { TRACK_LENS_OF_KEY, trackLensOpens } from "../shell/track-lenses.ts";

/** Workbench keys → the toolbox row each needs (keys in the sheet's syntax, as `WORKBENCH_LENS_SHORTCUTS` writes them). */
export const WORKBENCH_KEY_UNLOCKS: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  if (LENS_UNLOCKS.degrees) out.D = LENS_UNLOCKS.degrees;
  if (LENS_UNLOCKS.solfege) out.S = LENS_UNLOCKS.solfege;
  if (LENS_UNLOCKS.noteNames) out["Shift+N"] = LENS_UNLOCKS.noteNames;
  out["Shift+H"] = CHORD_LENS_UNLOCKS.chordSymbols;
  out["Shift+R"] = CHORD_LENS_UNLOCKS.romanNumerals;
  out["Shift+O"] = LINE_LENS_UNLOCKS.sections;
  out["Shift+B"] = LINE_LENS_UNLOCKS.bassRoles;
  out["Shift+U"] = LINE_LENS_UNLOCKS.blueNotes;
  for (const p of PANEL_SWITCHES) out[p.keys] = PANEL_UNLOCKS[p.id];
  return out;
})();

/**
 * Wave 6: the music lenses (guide tones, the key ribbon, the beat grid) open with ANY ONE of their tools
 * (`MUSIC_LENS_UNLOCKS`: the beat grid with compound meter, U13.L04, or with `.ply()`, U13.L05). A locked row names
 * the first of them: where the course reaches the lens first.
 */
export const WORKBENCH_KEY_ANY_UNLOCKS: Readonly<Record<string, readonly string[]>> = {
  "Shift+I": MUSIC_LENS_UNLOCKS.guideTones,
  "Shift+J": MUSIC_LENS_UNLOCKS.keyPlan,
  "Shift+V": MUSIC_LENS_UNLOCKS.beatGrid,
};

/** Which sheet sections carry Workbench keys (their rows are checked against `WORKBENCH_KEY_UNLOCKS`). */
export const LOCKABLE_SECTIONS: ReadonlySet<string> = new Set(["workbench"]);

/**
 * "unit 9, Form", "the side lesson “Waves & Harmonics”", "the capstone “C1 Riff Builder”": the course place where a
 * toolbox row opens (its first unlock site), in words (`kit/lock-notes.ts`), or `null` when the row or the place is
 * unknown. A capstone keeps its album track number, part of its title.
 */
export function opensWith(
  unlockId: string,
  toolbox: readonly ToolEntry[],
  syllabus: SyllabusDef | null,
): string | null {
  const row = toolbox.find((t) => t.id === unlockId);
  if (!row) return null;
  const sites = Array.isArray(row.unlock.at) ? row.unlock.at : [row.unlock.at];
  const site = sites[0];
  if (!site) return null;
  const capstone = /^([CX]\d+)\./.exec(site)?.[1];
  if (capstone) {
    const c = syllabus?.capstones.find((x) => x.id === capstone);
    return c ? `the capstone “${capstone} ${c.title}”` : "a capstone";
  }
  const unitId = /^([A-Z]+\d+)\./.exec(site)?.[1];
  if (!unitId) return null;
  const unit = syllabus?.units.find((u) => u.id === unitId);
  const lesson = unit?.lessons.find((l) => l.id === site);
  if (lesson?.side) return `the side lesson “${lesson.title}”`;
  // A core unit by its number and title; a track's unit by the lesson that opens the row.
  if (/^U\d+$/.test(unitId)) return unitWords(unitId, unit?.title);
  return lessonWords(site, lesson?.title);
}

export interface RowLock {
  /** The row's tool is not unlocked yet. */
  locked: boolean;
  /** "Opens with unit 9, Form." (or "Not open yet" when the place is unknown). */
  note: string;
}

/**
 * Whether a sheet row is locked for this learner. Nothing is marked before the unlock list has loaded (`ready`),
 * so the sheet never flashes a lock at a learner who has the tool (as the NavRail).
 */
export function rowLock(
  sectionId: string,
  keys: string,
  unlocked: ReadonlySet<string>,
  ready: boolean,
  toolbox: readonly ToolEntry[],
  syllabus: SyllabusDef | null,
  /**
   * Wave 7: the lessons the learner has completed — a track lens (Shift+X, Shift+Q, Shift+D) opens with its tool OR
   * its lesson (`TRACK_LENS_GATES`). `null` while the course progress has not loaded: those rows are not marked.
   */
  completed: ReadonlySet<string> | null = null,
): RowLock | null {
  if (!ready || !LOCKABLE_SECTIONS.has(sectionId)) return null;
  const lens = TRACK_LENS_OF_KEY[keys];
  if (lens) {
    if (completed === null) return null;
    const gate = TRACK_LENS_GATES[lens];
    if (gate.tools.some((t) => unlocked.has(t)) || completed.has(gate.lesson)) return null;
    return { locked: true, note: trackLensOpens(lens, syllabus) };
  }
  const anyOf = WORKBENCH_KEY_ANY_UNLOCKS[keys];
  if (anyOf?.some((id) => unlocked.has(id))) return null;
  const need = WORKBENCH_KEY_UNLOCKS[keys] ?? anyOf?.[0];
  if (!need || unlocked.has(need)) return null;
  const where = opensWith(need, toolbox, syllabus);
  return { locked: true, note: where ? opensWithNote(where) : "Not open yet" };
}
