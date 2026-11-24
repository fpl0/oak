// The advanced tracks' eight lenses as the shell lists them (Wave 7, docs/design/wave7.md §4.2): three have a key of
// their own (Shift+X tensions, Shift+Q chord-scales, Shift+D density, registered by the Workbench); all eight are
// listed with their state in the command palette and in Settings › Learning, and switched there. A lens opens with
// its lesson or its tool (`TRACK_LENS_GATES`); a lens not open yet says where it opens ("Opens with the lesson
// “Extensions”."), never a count of what is missing. Pure: tested in track-lenses.test.ts.
import type { SyllabusDef } from "@oak/content-kit";
import {
  TRACK_LENS_GATES,
  TRACK_LENS_IDS,
  TRACK_LENS_LABELS,
  type TrackLensId,
  type TrackLensPrefs,
} from "../../lib/lenses.ts";
import { lessonWords, opensWithNote } from "../kit/lock-notes.ts";

/** What each lens draws, in one line (the palette's hint, the settings row's help). */
export const TRACK_LENS_WHAT: Readonly<Record<TrackLensId, string>> = {
  tensions: "the melody's 9, 11 and 13 against each chord",
  voicings: "the type of each hand voicing",
  chordScales: "a common chord-scale for each chord",
  clave: "the clave's two-bar grid and its direction",
  polyLanes: "a lane per pulse of a polyrhythm or polymeter",
  microtiming: "how far each onset sits from the grid, in milliseconds",
  registers: "register bands and the low clashes on the spectrum",
  density: "how busy each section is",
};

/** The three lenses with a key of their own (the Workbench handles the keys). */
export const TRACK_LENS_KEYS: Readonly<Partial<Record<TrackLensId, string>>> = {
  tensions: "Shift+X",
  chordScales: "Shift+Q",
  density: "Shift+D",
};

/**
 * "Opens with the lesson “Extensions”.": the lesson that opens a lens, by its title (its tools open it too,
 * wherever they unlock); "Opens with a later lesson." until the syllabus has loaded.
 */
export function trackLensOpens(id: TrackLensId, syllabus: SyllabusDef | null): string {
  const lesson = TRACK_LENS_GATES[id].lesson;
  const title = syllabus?.units.flatMap((u) => u.lessons).find((l) => l.id === lesson)?.title;
  return opensWithNote(lessonWords(lesson, title));
}

export interface TrackLensRow {
  id: TrackLensId;
  label: string;
  what: string;
  keys: string | null;
  available: boolean;
  on: boolean;
  /** "On", "Off" or "Opens with …". */
  state: string;
}

/** The eight lenses in their order, each with its state for this learner. */
export function trackLensRows(
  prefs: TrackLensPrefs,
  available: TrackLensPrefs,
  syllabus: SyllabusDef | null,
): TrackLensRow[] {
  return TRACK_LENS_IDS.map((id) => ({
    id,
    label: TRACK_LENS_LABELS[id],
    what: TRACK_LENS_WHAT[id],
    keys: TRACK_LENS_KEYS[id] ?? null,
    available: available[id],
    on: available[id] && prefs[id],
    state: available[id] ? (prefs[id] ? "On" : "Off") : trackLensOpens(id, syllabus),
  }));
}

/** The sheet's lens keys → the lens each switches (for the honest locks of `keys/locks.ts`). */
export const TRACK_LENS_OF_KEY: Readonly<Record<string, TrackLensId>> = Object.fromEntries(
  Object.entries(TRACK_LENS_KEYS).map(([id, k]) => [k, id as TrackLensId]),
);
