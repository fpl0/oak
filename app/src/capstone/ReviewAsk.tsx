// Oak 2.0 W4 F4: the review request with the learner's one optional question. Three chips (the sound, the form, a
// detail) write a starter question into the field for the learner to edit; "Request review" sends the cleaned text,
// or no question at all when the field is empty. While the detail prompt still holds its "_" placeholders the button
// waits and says why. A line under the field says what the review reads: the code and Oak's analysis, never the take.
import { MessageSquareText } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../ui/kit/Button.tsx";
import {
  cleanQuestion,
  hasPlaceholder,
  REVIEW_ASK_COPY,
  REVIEW_PROMPTS,
  REVIEW_QUESTION_MAX,
} from "./review-ask.ts";

export function ReviewAsk({
  disabled,
  onRequest,
  label = REVIEW_ASK_COPY.request,
}: {
  disabled: boolean;
  onRequest(question: string | null): void;
  /** The button's words ("Ask for a new review", "Review requested"); default "Request review". */
  label?: string;
}) {
  const [text, setText] = useState("");
  const id = useId();
  const waiting = hasPlaceholder(text);
  return (
    <div className="flex flex-col gap-2 text-sm" data-testid="review-ask">
      <label htmlFor={id} className="font-medium text-text-2">
        {REVIEW_ASK_COPY.label}
      </label>
      <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0" aria-label="Starter questions">
        {REVIEW_PROMPTS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setText(p.text)}
            className="inline-flex h-6 items-center rounded-full border border-border bg-surface px-2 text-sm text-text-2 hover:border-accent hover:text-accent"
            data-testid={`review-prompt-${p.id}`}
          >
            {p.chip}
          </button>
        ))}
      </fieldset>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={REVIEW_QUESTION_MAX}
        placeholder={REVIEW_ASK_COPY.placeholder}
        aria-describedby={`${id}-reads`}
        className="rounded-control border border-border bg-surface p-2"
        data-testid="review-question"
      />
      <p id={`${id}-reads`} className="text-text-3" data-testid="review-reads">
        {REVIEW_ASK_COPY.readsCode}
      </p>
      {waiting && (
        <p className="text-text-3" data-testid="review-question-note">
          {REVIEW_ASK_COPY.fillBars}
        </p>
      )}
      <Button
        size="sm"
        className="self-start"
        icon={<MessageSquareText aria-hidden className="size-4" />}
        disabled={disabled || waiting}
        onClick={() => onRequest(cleanQuestion(text))}
        data-testid="request-review"
      >
        {label}
      </Button>
    </div>
  );
}
