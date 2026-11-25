// Accepting a review: the shared last step of both delivery channels (the `submit_*` tools on
// the API backend, `--json-schema` output on the CLI backend). Schema, counts and word limits are
// checked by reviews.ts; here every `tryCode` is also run, like a card, and prose is sanitized.
import { sanitizeMarkdown } from "../markup.ts";
import type { GraderPort } from "../ports.ts";
import {
  type CapstoneReview,
  type ReviewKind,
  type ReviewRules,
  type ReviewValue,
  type TranscriptionReview,
  validateReview,
} from "../reviews.ts";
import type { StructuredCheck } from "../types.ts";
import { CARD_EVAL_BARS } from "./schemas.ts";
import { totalEvents } from "./views.ts";

function cleanCapstone(r: CapstoneReview): CapstoneReview {
  return {
    strengths: r.strengths.map((s) => ({ text: sanitizeMarkdown(s.text), bars: s.bars })),
    revisions: r.revisions.map((v) => ({
      title: sanitizeMarkdown(v.title),
      bars: v.bars,
      why: sanitizeMarkdown(v.why),
      tryCode: v.tryCode,
      skills: [...v.skills],
    })),
    listeningQuestion: sanitizeMarkdown(r.listeningQuestion),
    linerNote: sanitizeMarkdown(r.linerNote),
    ...(r.answer === undefined ? {} : { answer: r.answer === null ? null : sanitizeMarkdown(r.answer) }),
  };
}

function cleanTranscription(r: TranscriptionReview): TranscriptionReview {
  return {
    strengths: r.strengths.map((s) => ({ text: sanitizeMarkdown(s.text), bars: s.bars, layer: s.layer })),
    revisions: r.revisions.map((v) => ({
      title: sanitizeMarkdown(v.title),
      bars: v.bars,
      layer: v.layer,
      why: sanitizeMarkdown(v.why),
      listenFor: sanitizeMarkdown(v.listenFor),
    })),
    plausibilityFlags: r.plausibilityFlags.map((f) => ({ bars: f.bars, issue: sanitizeMarkdown(f.issue) })),
    listeningQuestion: sanitizeMarkdown(r.listeningQuestion),
    linerNote: sanitizeMarkdown(r.linerNote),
  };
}

export async function acceptReview(
  kind: ReviewKind,
  raw: unknown,
  rules: ReviewRules,
  grader: GraderPort,
  signal: AbortSignal,
): Promise<StructuredCheck<ReviewValue>> {
  const check = validateReview(kind, raw, rules);
  if (!check.ok) return check;
  if (kind === "transcription")
    return { ok: true, value: cleanTranscription(check.value as TranscriptionReview) };

  const review = check.value as CapstoneReview;
  const problems: string[] = [];
  // validateReview has already held every tryCode to the strict lint, so it is safe to run.
  for (const [i, rev] of review.revisions.entries()) {
    const run = await grader.evaluate(
      { code: rev.tryCode, fromBar: 1, bars: CARD_EVAL_BARS, key: null, origin: "tutor" },
      signal,
    );
    if (!run.ok) problems.push(`revisions[${i}].tryCode: ${run.error?.message ?? "the code did not run"}`);
    else if (totalEvents(run) === 0)
      problems.push(`revisions[${i}].tryCode: silent in its first ${CARD_EVAL_BARS} bars`);
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, value: cleanCapstone(review) };
}
