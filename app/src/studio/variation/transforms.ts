// Oak 2.0 W3 (PLAN §4 S5 "Transforms" and "Misuse cards"; the book's Note Transformations and Misusing Rhythmic
// Tools): each transform rewrites the line under the cursor as plain, visible Strudel — one undoable change through
// the tutor's Apply path. A transform that would change nothing says why in one sentence and writes nothing. Locked
// tools are allowed: the Run's lint raises the liner flag; nothing refuses (PLAN §10 call 4).
import type { KeySpec } from "@oak/api";
import { labelledLines } from "@oak/content-kit";
import {
  invertAroundCentre,
  retrogradePitches,
  rotatePitches,
  snapNotesToScale,
  wrapChain,
} from "@oak/grader";

export type TransformId =
  | "transpose"
  | "invert"
  | "retrograde"
  | "rev"
  | "rotate"
  | "shift"
  | "snap"
  | "harmony"
  | "segment"
  | "chop"
  | "striate"
  | "ply";

/**
 * Oak's starting values for the misuse moves (Oak's call): visible and editable in the code they write, never a
 * target. `segment(16)` samples a line sixteen times a bar, `chop(4)`/`striate(4)` cut each sound in four, `ply(2)`
 * plays each event twice.
 */
export const MISUSE_ARGS = { segment: "16", chop: "4", striate: "4", ply: "2" } as const;

export const TRANSFORMS: readonly { id: TransformId; label: string; detail: string; misuse: boolean }[] = [
  {
    id: "transpose",
    label: "Transpose",
    detail:
      "Moves every note up or down: in steps of the scale on a line of scale steps, in half steps on any other line.",
    misuse: false,
  },
  {
    id: "invert",
    label: "Invert",
    detail: "Turns the line upside down around its own centre: high notes go low and low notes go high.",
    misuse: false,
  },
  {
    id: "retrograde",
    label: "Retrograde",
    detail: "Plays the notes back to front while the rhythm stays where it was.",
    misuse: false,
  },
  {
    id: "rev",
    label: "Mirror",
    detail: "Plays the whole bar backwards, rhythm and all, with .rev().",
    misuse: false,
  },
  {
    id: "rotate",
    label: "Rotate",
    detail: "Moves each note to the next place in the line; the last one comes round to the front.",
    misuse: false,
  },
  {
    id: "shift",
    label: "Time shift",
    detail: "Plays the line earlier by an eighth or a quarter of a bar, with .early().",
    misuse: false,
  },
  {
    id: "snap",
    label: "Snap to the key",
    detail: "Moves each note outside the key's scale to the nearest note inside it.",
    misuse: false,
  },
  {
    id: "harmony",
    label: "Add a harmony",
    detail: "Plays a second copy of the line a third above in the scale, with .superimpose().",
    misuse: false,
  },
  {
    id: "segment",
    label: "Segment",
    detail:
      "On a busy line, .segment(16) samples it sixteen times a bar, so long notes turn into a stream of short ones.",
    misuse: true,
  },
  {
    id: "chop",
    label: "Chop",
    detail: "On a held pad, .chop(4) cuts each sound into four pieces played one after another.",
    misuse: true,
  },
  {
    id: "striate",
    label: "Striate",
    detail: "On a held pad, .striate(4) cuts the sounds into slices and weaves the slices together.",
    misuse: true,
  },
  {
    id: "ply",
    label: "Ply",
    detail: "On held chords, .ply(2) plays every chord twice in its own time, so the chords start to pulse.",
    misuse: true,
  },
];

/** Why a transform left the code as it is: one plain sentence each (checked with `isDescriptive`). */
export const UNCHANGED_WORDS = {
  noLine: (label: string) => `There is no line called ${label} in the code now.`,
  pickAmount: "Pick how far to move it first.",
  noKey: "Set the sketch's key first; snap moves notes into its scale.",
  alreadySteps: "This line already plays scale steps, so every note is in the scale.",
  inKey: "Every note of this line is already in the key's scale.",
  noNoteLine: 'Snap works on a line of notes: note("…").',
  noHarmony: 'Add a harmony works on a line of scale steps: n("…") with .scale().',
  noSteps: 'This works on a line of scale steps written as numbers: n("…") with .scale().',
  sameBack: "Back to front, these notes read the same, so nothing would change.",
  sameRotate: "Rotated, these notes read the same, so nothing would change.",
  sameInvert: "Upside down around its centre, this line reads the same, so nothing would change.",
  nothing: "This transform does not change this line.",
} as const;

/** The words of the Transforms menu (`TransformMenu.tsx`). */
export const TRANSFORM_MENU_WORDS = {
  button: "Transforms",
  noLine: "Put the cursor on a labelled line",
  title: (label: string) => `Change the line ${label}`,
  intro: "Each tool rewrites the line as code you can read; Mod+Z takes it back.",
  turnHeading: "Turn it around",
  misuseHeading: "Misuse a rhythm tool",
  misuseIntro: "Rhythm tools used on lines they were not made for.",
  write: "Write it",
  transposeBy: "Move by",
  pick: "Pick…",
  rotateBy: "Places",
  eighth: "An eighth of a bar",
  quarter: "A quarter of a bar",
  retroVsMirror: "Retrograde keeps the rhythm and turns the notes around; Mirror turns the whole bar around.",
  noOther: "There is no other labelled line yet.",
} as const;

const isScaleSteps = (text: string): boolean => /(?:^|[^\w$.])n\s*\(/.test(text) && /\.scale\s*\(/.test(text);
const hasNotes = (text: string): boolean => /(?:^|[^\w$])note\s*\(/.test(text);
const SHIFTS = new Set([4, 8]);

/**
 * The line `label` rewritten by the transform, or why it is left as it is. `ctx.key` is the sketch's key (`null`
 * when none is chosen). The result always evaluates when the input did.
 */
export function applyTransform(
  code: string,
  label: string,
  t: { id: TransformId; amount?: number },
  ctx: { key: KeySpec | null },
): { code: string } | { unchanged: string } {
  const line = labelledLines(code).find((l) => l.label === label);
  if (!line) return { unchanged: UNCHANGED_WORDS.noLine(label) };
  const steps = isScaleSteps(line.text);
  const done = (next: string, why: string = UNCHANGED_WORDS.nothing) =>
    next === code ? { unchanged: why } : { code: next };

  switch (t.id) {
    case "transpose": {
      const n = t.amount;
      if (n === undefined || !Number.isInteger(n) || n === 0 || Math.abs(n) > 12)
        return { unchanged: UNCHANGED_WORDS.pickAmount };
      return done(
        steps ? wrapChain(code, label, "add", `n(${n})`) : wrapChain(code, label, "transpose", String(n)),
      );
    }
    case "invert":
      return done(
        invertAroundCentre(code, label),
        steps ? UNCHANGED_WORDS.sameInvert : UNCHANGED_WORDS.noSteps,
      );
    case "retrograde":
      return done(retrogradePitches(code, label), steps ? UNCHANGED_WORDS.sameBack : UNCHANGED_WORDS.noSteps);
    case "rev":
      return done(wrapChain(code, label, "rev", ""));
    case "rotate": {
      const k = t.amount ?? 1;
      if (!Number.isInteger(k) || k === 0) return { unchanged: UNCHANGED_WORDS.pickAmount };
      return done(
        rotatePitches(code, label, k),
        steps ? UNCHANGED_WORDS.sameRotate : UNCHANGED_WORDS.noSteps,
      );
    }
    case "shift": {
      const d = t.amount ?? 8;
      if (!SHIFTS.has(d)) return { unchanged: UNCHANGED_WORDS.pickAmount };
      // A JS fraction, never a string: `.early("1/8")` would be "1 slowed 8 times" (contracts §0.16).
      return done(wrapChain(code, label, "early", `1/${d}`));
    }
    case "snap": {
      if (ctx.key === null) return { unchanged: UNCHANGED_WORDS.noKey };
      if (steps) return { unchanged: UNCHANGED_WORDS.alreadySteps };
      if (!hasNotes(line.text)) return { unchanged: UNCHANGED_WORDS.noNoteLine };
      return done(snapNotesToScale(code, label, ctx.key), UNCHANGED_WORDS.inKey);
    }
    case "harmony":
      if (!steps) return { unchanged: UNCHANGED_WORDS.noHarmony };
      return done(wrapChain(code, label, "superimpose", "x => x.scaleTranspose(2)"));
    case "segment":
    case "chop":
    case "striate":
    case "ply":
      return done(wrapChain(code, label, t.id, MISUSE_ARGS[t.id]));
  }
}
