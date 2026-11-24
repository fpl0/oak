// Where a Make starts (decision of 2026-11-13, d15): a Make that builds on an earlier lesson's sketch ("your blues",
// "your Aeolian loop": content-kit `CodeMakeEx.fromSketch`, a typed field, never prose matching) opens with the
// learner's saved sketch of that lesson when there is one, with "Start from Oak's copy" beside it; with no such
// sketch it opens with Oak's copy, as before. Code the learner already has in this step (a resumed visit, an edit)
// always wins: nothing is ever replaced under their hands. Pure rules; the query is `useLessonSketch`.
import type { Exercise, LessonSketch } from "@oak/api";

/** The lesson whose saved sketch this Make opens with, or `null` (most Makes). */
export function fromSketchOf(ex: Exercise | undefined): string | null {
  if (ex?.kind !== "code-make") return null;
  return typeof ex.fromSketch === "string" ? ex.fromSketch : null;
}

/** The learner's own material for the Make: the newest version of their newest sketch of that lesson. */
export interface OwnSketch {
  sketchId: string;
  title: string;
  code: string;
}

export function ownSketchOf(data: LessonSketch | null | undefined): OwnSketch | null {
  const s = data?.sketch;
  if (!s || s.versions.length === 0) return null;
  const newest = s.versions.reduce((a, b) => (b.version > a.version ? b : a));
  if (newest.code.trim() === "") return null;
  return { sketchId: s.id, title: s.title, code: newest.code };
}

export type MakeSource = "sketch" | "oak";

export interface MakeStart {
  /** What the editor opens with. */
  code: string;
  /** Whose it is: the learner's sketch, or Oak's starter. */
  source: MakeSource;
  /** Whether the choice is offered (a sketch exists): "Start from Oak's copy" / "Use my sketch". */
  choice: boolean;
}

/**
 * The Make's opening code. `current` is what the step already holds (the machine's code for the step: a resumed
 * visit or an edit in this one); it wins, and reads as the sketch's or Oak's only when it is exactly that text.
 */
export function makeStart(o: { starter: string; own: OwnSketch | null; current: string | null }): MakeStart {
  if (o.own === null) return { code: o.current ?? o.starter, source: "oak", choice: false };
  if (o.current === null) return { code: o.own.code, source: "sketch", choice: true };
  return { code: o.current, source: o.current === o.starter ? "oak" : "sketch", choice: true };
}

/** The line above the editor: whose copy this is, in the learner's words (the lesson by title, never by ID). */
export function makeStartNote(source: MakeSource, own: OwnSketch, lessonTitle: string | null): string {
  const where = lessonTitle ? ` from “${lessonTitle}”` : "";
  return source === "sketch"
    ? `This opens with your own sketch${where}, “${own.title}”.`
    : `This is Oak's copy. Your sketch${where}, “${own.title}”, is kept as it is.`;
}

/**
 * Unit songs (spec 2026-11-24 §5.3): the line above a take Make that opens with the learner's code of an earlier
 * lesson of the song (`startFrom`), or with Oak's copy beside it. `tempo` is the song's tempo when the first line was
 * set to it.
 */
export function songStartNote(source: MakeSource, lessonTitle: string, tempo: number | null): string {
  const line =
    tempo === null ? "" : ` The first line is set to your song's tempo, ${tempo} beats per minute.`;
  return source === "sketch"
    ? `This opens with your code from “${lessonTitle}”, as your song plays it.${line}`
    : `This is Oak's copy. Your code from “${lessonTitle}” is kept as it is.${line}`;
}

/** The tempo line of a take Make that opens with Oak's copy and nothing of the learner's to start from. */
export function songTempoNote(tempo: number): string {
  return `The first line is set to your song's tempo, ${tempo} beats per minute.`;
}
