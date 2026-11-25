// A key-free contrast: the same chord members and roots, either moved together or kept nearby.
import { buildPiece } from "../build.ts";
import { mod, spellMidi } from "../kernel.ts";
import { alt, chordOf } from "../pat.ts";
import { cueOf, type Generator, pickSound, pickTempo, trialOf } from "./common.ts";

export const MOTION_LABELS = {
  parallel: "Parallel: the chords move as one block",
  "voice-led": "Voice-led: each note moves as little as it can",
} as const;
export type Motion = keyof typeof MOTION_LABELS;

const intervals = (chord: readonly number[]) => chord.slice(1).map((n, i) => n - (chord[i] as number));

/** Every change must support the same answer: all block moves, or none. */
export function motionChecks(chords: readonly (readonly number[])[], roots: readonly number[]) {
  const valid =
    chords.length === 4 &&
    roots.length === 4 &&
    chords.every(
      (c) =>
        c.length === chords[0]?.length &&
        c.length >= 3 &&
        c.every((n, i) => Number.isFinite(n) && (i === 0 || n > (c[i - 1] as number))),
    );
  const shapes = new Set(chords.map((c) => intervals(c).join(",")));
  return {
    parallel:
      valid &&
      shapes.size === 1 &&
      chords
        .slice(1)
        .every((c, i) =>
          c.every(
            (n, v) => n - (chords[i]?.[v] as number) === (roots[i + 1] as number) - (roots[i] as number),
          ),
        ),
    "voice-led":
      valid &&
      shapes.size > 1 &&
      chords.slice(1).every((c, i) => new Set(c.map((n, v) => n - (chords[i]?.[v] as number))).size > 1) &&
      chords.slice(1).every((c, i) => Math.abs((c.at(-1) as number) - (chords[i]?.at(-1) as number)) <= 2),
  };
}

/** All ordered voicings in the playing register, one of each chord member; minimize total motion. */
export function nearestMotionChord(
  previous: readonly number[],
  root: number,
  shape: readonly number[],
): number[] {
  const pcs = shape.map((n) => mod(root + n, 12));
  let best: number[] = [];
  let cost = Infinity;
  const visit = (notes: number[], used: Set<number>, distance: number) => {
    if (distance > cost) return;
    if (notes.length === shape.length) {
      if (distance < cost) {
        best = notes;
        cost = distance;
      }
      return;
    }
    for (let n = (notes.at(-1) ?? 35) + 1; n <= 84; n++) {
      const pc = mod(n, 12);
      if (!pcs.includes(pc) || used.has(pc)) continue;
      visit(
        [...notes, n],
        new Set([...used, pc]),
        distance + Math.abs(n - (previous[notes.length] as number)),
      );
    }
  };
  visit([], new Set(), 0);
  return best;
}

export const harmonyMotion: Generator = {
  name: "harmony-motion",
  generate(ctx) {
    const answer: Motion = ctx.rng.pick(["parallel", "voice-led"]);
    for (let attempt = 0; attempt < 512; attempt++) {
      const shape = ctx.rng.pick([
        [0, 4, 7],
        [0, 3, 7],
        [0, 4, 7, 11],
        [0, 3, 7, 10],
      ]);
      const roots = [ctx.rng.int(48, 59)];
      for (let i = 1; i < 4; i++) {
        const step = ctx.category === "parallel-step" ? ctx.rng.int(1, 2) : ctx.rng.int(3, 7);
        roots.push((roots[i - 1] as number) + step * ctx.rng.pick([-1, 1]));
      }
      const chords = [shape.map((n) => n + (roots[0] as number))];
      for (const root of roots.slice(1))
        chords.push(
          answer === "parallel"
            ? shape.map((n) => n + root)
            : nearestMotionChord(chords.at(-1) as number[], root, shape),
        );
      const checks = motionChecks(chords, roots);
      if (
        !checks[answer] ||
        checks.parallel === checks["voice-led"] ||
        chords.flat().some((n) => n < 36 || n > 84)
      )
        continue;
      const piece = buildPiece({
        bpm: pickTempo(ctx),
        bars: 4,
        tracks: [
          {
            label: "chords",
            src: "note",
            pat: alt(chords.map((c) => chordOf(c.map((n) => spellMidi(n, null).code)))),
            s: pickSound(ctx),
            gain: 0.65,
          },
        ],
      });
      return trialOf(piece, { choice: [MOTION_LABELS[answer]] }, cueOf(ctx), {
        mode: "choice",
        options: Object.values(MOTION_LABELS),
        roots,
        shape,
        motion: answer,
        prompt: "Do the chords move as one block, or does each note stay close?",
      });
    }
    throw new Error("harmony-motion: could not draw an unambiguous progression");
  },
};
