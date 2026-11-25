// Oak 2.0: Studio never scores (PLAN §2, W1 fidelity rule 1). Every new Studio copy string is checked with
// `isDescriptive` in its task's unit test: it describes what happened and never passes, fails, counts or corrects.
// Moved from app/src/studio/descriptive.ts in W3 stage 0 (that file re-exports it) so the server's habits mirror and
// the grader's card checkers check their sentences with the same words.

/** Verdict words: pass, fail, score, correct, wrong, missing, should, must (and their forms), a percentage, ticks and crosses. */
export const VERDICT_WORDS: RegExp =
  /\b(?:pass(?:es|ed|ing)?|fail(?:s|ed|ing|ure)?|scor(?:e|es|ed|ing)|(?:in)?correct(?:ly)?|wrong(?:ly)?|missing|should|must)\b|\d+(?:\.\d+)?\s*%|[✓✗✔✘]/i;

/** True when `text` has no verdict word. */
export function isDescriptive(text: string): boolean {
  return !VERDICT_WORDS.test(text);
}
