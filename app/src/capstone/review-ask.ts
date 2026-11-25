// Oak 2.0 W4 F4 "Honest review, your question" (Getting Feedback): the learner may send one question with a review
// request, and three optional prompts (the sound, the form, a detail) write a starter question to edit. The review
// answers it first (X20, server side). Pure: `ReviewAsk.tsx` renders it.

export const REVIEW_PROMPTS = [
  // The sounds the learner chose in the code: the review reads code, it never hears the take (W5 F5).
  { id: "sound", chip: "The sound", text: "Do the sounds I chose suit the song?" },
  { id: "form", chip: "The form", text: "Does the form keep a listener with it to the end?" },
  { id: "detail", chip: "A detail", text: "In bars _ to _, does this part work?" },
] as const;

/** The longest question (Oak's call; the same limit as `TutorTurnRequest.reviewQuestion`). */
export const REVIEW_QUESTION_MAX = 300;

/** A lone "_" left from the detail prompt: the learner has not said which bars yet (`_bass` is a label, not one). */
export const hasPlaceholder = (text: string): boolean => /(?<![A-Za-z0-9_])_+(?![A-Za-z0-9])/.test(text);

/**
 * The question as it is sent: whitespace collapsed and trimmed. `null` for no question (empty), one longer than
 * `REVIEW_QUESTION_MAX`, or one still holding a `_` placeholder.
 */
export function cleanQuestion(raw: string): string | null {
  const q = raw.replace(/\s+/g, " ").trim();
  if (q === "" || q.length > REVIEW_QUESTION_MAX || hasPlaceholder(q)) return null;
  return q;
}

/** Every learner-facing string of the review field (checked with `isDescriptive` in `review-ask.test.ts`). */
export const REVIEW_ASK_COPY = {
  label: "Your question for the review (optional)",
  placeholder: "Ask one thing you want to know about this draft.",
  /** Under the field: what the review reads (the persona: it "cannot hear audio"). */
  readsCode: "Claude reads your code and Oak's analysis; it does not hear your take.",
  fillBars: "Write the bar numbers in place of each _ first.",
  tooLong: `Keep the question under ${REVIEW_QUESTION_MAX} characters.`,
  request: "Request review",
  requested: "Review requested",
} as const;
