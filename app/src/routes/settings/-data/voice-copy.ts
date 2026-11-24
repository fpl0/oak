// Settings › Voice copy that depends on where the learner is in the course (pure; tested).

/** The lesson that introduces singing on syllables. */
export const SYLLABLES_LESSON = "U03.L08";

/**
 * The "Sing on syllables" help: the lesson that brings syllables, by its title, while it is still ahead; nothing
 * about it once it is done, or while the course is not read yet (never a bare lesson id).
 */
export function syllablesHelp(title: string | null, done: boolean | null): string {
  const base = "do re mi instead of numbers. Numbers are always accepted";
  return done === false && title ? `${base}; syllables arrive with the lesson ${title}.` : `${base}.`;
}
