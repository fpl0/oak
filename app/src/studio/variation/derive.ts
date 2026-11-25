// Oak 2.0 W3 (PLAN §4 S5 "Derive a part"; the book's Drums to Pitches): a new part made from an existing one, written
// as a new labelled line right after its source — one line's rhythm on another line's notes (`.struct`), a drum line
// as a tune, a tune as drums. The source lines stay as they are; the learner mutes what they like.
import type { KeySpec } from "@oak/api";
import { labelledLines, OAK_DEFAULTS, PLAIN_SOUNDS } from "@oak/content-kit";
import { drumsToDegrees, insertStatementAfter, rhythmMini } from "@oak/grader";
import { formatScaleName } from "@oak/theory";

/**
 * Drum names as degrees of the scale (Oak's call): the kick low, the snare in the middle, the hats high. Any other
 * drum takes `DRUM_DEGREE_FALLBACK`.
 */
export const DRUM_DEGREES: Readonly<Record<string, number>> = { bd: 0, sd: 4, hh: 7, oh: 7 };
export const DRUM_DEGREE_FALLBACK = 2;
/** The drums a tune can become (the learner picks one; none is preselected). */
export const MELODY_DRUMS = ["bd", "sd", "hh", "rim"] as const;
export type MelodyDrum = (typeof MELODY_DRUMS)[number];

export const DERIVE_WORDS = {
  heading: "Make a new part from this one",
  rhythmOn: "Its rhythm on another line's notes",
  rhythmOnDetail: "Writes a new line that plays the other line's notes in this line's rhythm.",
  pickNotes: "Whose notes?",
  drumsAsTune: "This drum line as a tune",
  drumsAsTuneDetail:
    "Each drum becomes a note of the scale: the kick low, the snare in the middle, the hats high.",
  tuneAsDrums: "This tune as drums",
  tuneAsDrumsDetail: "Writes a drum line that plays in this tune's rhythm, every note a hit.",
  pickDrum: "Which drum?",
  noRhythm: "Oak can only read a rhythm written in the line itself, in quotes.",
  sameLine: "Pick another line for the notes.",
  noDrums: 'This works on a drum line: s("…").',
  sourcesStay: "The lines it comes from stay as they are; mute any you like.",
} as const;

const strip = (label: string): string => label.replace(/^_+|_+$/g, "");

/** `base` if no line of the code is called that (muted or not), else `base2`, `base3`… */
export function freeLabel(code: string, base: string): string {
  const used = new Set(labelledLines(code).map((l) => strip(l.label)));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}

/** The labelled line's expression as written (`n("0 2").scale(…)`), or `null`. */
function exprOf(code: string, label: string): string | null {
  const line = labelledLines(code).find((l) => l.label === label);
  if (!line) return null;
  const m = /^[A-Za-z_$][\w$]*\s*:/.exec(line.text);
  const expr = line.text.slice(m?.[0].length ?? 0).trim();
  return expr.replace(/;\s*$/, "") || null;
}
const missing = (label: string) => ({ unchanged: `There is no line called ${label} in the code now.` });

/** A new line: the notes of `notesFrom` in the rhythm of `rhythmFrom`, right after the notes line. */
export function deriveRhythm(
  code: string,
  o: { rhythmFrom: string; notesFrom: string },
): { code: string; label: string } | { unchanged: string } {
  if (o.rhythmFrom === o.notesFrom) return { unchanged: DERIVE_WORDS.sameLine };
  const expr = exprOf(code, o.notesFrom);
  if (expr === null) return missing(o.notesFrom);
  if (!labelledLines(code).some((l) => l.label === o.rhythmFrom)) return missing(o.rhythmFrom);
  const rhythm = rhythmMini(code, o.rhythmFrom);
  if (rhythm === null) return { unchanged: DERIVE_WORDS.noRhythm };
  const label = freeLabel(code, strip(o.notesFrom) || "part");
  return {
    code: insertStatementAfter(code, o.notesFrom, `${label}: ${expr}.struct("${rhythm}")`),
    label,
  };
}

/** A new tune after the drum line: each drum a degree of the key's scale (C major when no key is chosen). */
export function drumsAsMelody(
  code: string,
  drumLabel: string,
  key: KeySpec | null,
): { code: string; label: string } | { unchanged: string } {
  if (!labelledLines(code).some((l) => l.label === drumLabel)) return missing(drumLabel);
  const degrees = drumsToDegrees(code, drumLabel, DRUM_DEGREES, DRUM_DEGREE_FALLBACK);
  if (degrees === null) return { unchanged: DERIVE_WORDS.noDrums };
  const scale = formatScaleName(key ?? OAK_DEFAULTS.key, 4);
  const label = freeLabel(code, "mel");
  return {
    code: insertStatementAfter(
      code,
      drumLabel,
      `${label}: n("${degrees}").scale("${scale}").s("${PLAIN_SOUNDS.tune}")`,
    ),
    label,
  };
}

/** A new drum line after the tune: one drum (the learner's pick) in the tune's rhythm, every note a hit. */
export function melodyAsDrums(
  code: string,
  melLabel: string,
  drum: MelodyDrum,
): { code: string; label: string } | { unchanged: string } {
  if (!labelledLines(code).some((l) => l.label === melLabel)) return missing(melLabel);
  const rhythm = rhythmMini(code, melLabel);
  if (rhythm === null) return { unchanged: DERIVE_WORDS.noRhythm };
  const label = freeLabel(code, "drums");
  return { code: insertStatementAfter(code, melLabel, `${label}: s("${drum}").struct("${rhythm}")`), label };
}
