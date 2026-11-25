// Oak 2.0: what Oak writes and fills in when the learner has not chosen (moved from app/src/studio/model.ts in W3
// stage 0, names and values unchanged; model.ts re-exports them). Here so the server's habits mirror (W3 X16) and the
// grader's card checkers can read Oak's defaults as Oak's, never as the learner's habits (PLAN §2 fidelity).
import type { KeySpec } from "./schema/common.ts";
import { PLAIN_SOUNDS } from "./studio-code.ts";

/**
 * Oak's Blank (Oak 2.0 W1, PLAN §2 fidelity: defaults must not be mistaken for habits): a tempo line and a comment,
 * no part, so nothing Oak chose is heard as the learner's style. The New sketch dialog writes the learner's chosen
 * tempo in place of 90 (`blankStartBody` in app/src/studio/starts.ts).
 */
export const BLANK_CODE = "setcpm(90/4)\n\n// Your first part goes here: a name, a colon, then a pattern.\n";
/** Over a Band: a light part of the learner's own on top of the backing. */
export const OVER_BAND_CODE = 'setcpm(90/4)\n\nhats: s("hh*8")\n';
/** Over a Band in 3/4: the same light part, six hats a bar, at the waltz vamp's tempo. */
export const OVER_BAND_CODE_3_4 = 'setcpm(108/3)\n\nhats: s("hh*6")\n';

/**
 * The lines Oak's own starts write (app/src/studio/starts.ts composes them; OAK_DEFAULTS lists them). Every pattern
 * is a rest (`"~"`): a start gives parts a name and a plain sound, never notes or a rhythm.
 */
export const START_LINES = {
  blankComment: "// Your first part goes here: a name, a colon, then a pattern.",
  drumsBassComment: "// Drums first, then a bass that fits them; the rest comes later.",
  plainComment: "// Plain sounds on purpose: make the sounds yours later.",
  drums: 'drums: s("~")',
  bass: `bass: note("~").s("${PLAIN_SOUNDS.bass}")`,
  chords: `chords: note("~").s("${PLAIN_SOUNDS.chords}")`,
  mel: `mel: note("~").s("${PLAIN_SOUNDS.tune}")`,
} as const;

export const DEFAULT_KEY: KeySpec = { tonic: "C", mode: "major" };

/**
 * What Oak fills in when the learner has not chosen (Oak 2.0 W1): the tempo, meter and key of Oak's Blank, Over a
 * Band, captures and a sketch from scraps with no tempo of its own, and every line (trimmed) that any Oak start,
 * `OVER_BAND_CODE` or its 3/4 variant can write. The habits mirror (W3 X16 `summarizeHabits(items, defaults)`) reads
 * these as Oak's, never as the learner's habits. 90 BPM in 4/4, C major: Oak's call, never shown as a target.
 */
export const OAK_DEFAULTS: {
  readonly bpm: 90;
  readonly meter: "4/4";
  readonly key: KeySpec;
  readonly lines: readonly string[];
} = {
  bpm: 90,
  meter: "4/4",
  key: DEFAULT_KEY,
  lines: [
    ...new Set(
      [BLANK_CODE, OVER_BAND_CODE, OVER_BAND_CODE_3_4, ...Object.values(START_LINES)]
        .flatMap((code) => code.split("\n"))
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    ),
  ],
};

/**
 * First-version notes of free sketches that start from Oak's own code (a learning kit: `templateSketchBody`; a
 * toolbox demo: `toolSketchBody`): the habits mirror does not read them (Oak 2.0 W3, PLAN §2 "defaults are not
 * habits"). A note starts with one of these; the learner's own starts ("From scraps", "From your Blank", none) do not.
 */
export const OAK_START_NOTES: readonly string[] = ["From the learning kit ", "From the toolbox: "];
