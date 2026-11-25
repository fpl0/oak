// Oak 2.0: the learner names their own repeats first (Avoidance List, p. 20), then reveals Oak's habits mirror.
// The field stays in memory for this editor only; cards from the field come in a later release.
// "Not this time" still puts an Oak habit on this sketch as an avoidance card through sketches.patch.
import { History } from "lucide-react";
import { useId, useRef, useState } from "react";
import { errorWords } from "../../lib/error-words.ts";
import { useSketchPatch } from "../../lib/queries.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Dialog } from "../../ui/kit/Dialog.tsx";
import { ErrorState, LoadingState } from "../../ui/kit/QueryState.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { CARD_WORDS } from "../cards/model.ts";
import type { EditorSlotProps } from "../editor-slots.ts";
import { notBuilt, useHabits } from "./habits-queries.ts";
import { HABIT_CATEGORIES, HABIT_WORDS, habitCardId, notThisTime, withCategory } from "./model.ts";

export function SoundsLikeButton({ sketch }: EditorSlotProps) {
  const [open, setOpen] = useState(false);
  const [sketchId, setSketchId] = useState(sketch.id);
  const [same, setSame] = useState("");
  const [revealed, setRevealed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  // Reset before rendering another sketch, so its habits never appear behind the old reveal.
  if (sketchId !== sketch.id) {
    setSketchId(sketch.id);
    setSame("");
    setRevealed(false);
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<History aria-hidden className="size-4" />}
        onClick={() => setOpen(true)}
        data-testid="sounds-like"
      >
        {HABIT_WORDS.soundsLike}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={HABIT_WORDS.soundsLike}
        className="w-[min(94vw,32rem)]"
      >
        <div className="flex flex-col gap-3">
          <label htmlFor={fieldId}>{HABIT_WORDS.sameAsk}</label>
          <textarea
            id={fieldId}
            ref={field}
            value={same}
            onChange={(e) => setSame(e.target.value)}
            // Oak's call: keep this short reflection bounded without making a writing target.
            maxLength={1000}
            data-testid="sounds-like-same"
            data-autofocus
            className="rounded-control border border-border bg-surface p-2 text-text"
          />
          <fieldset aria-label={HABIT_WORDS.sameAsk} className="m-0 flex flex-wrap gap-2 border-0 p-0">
            {HABIT_CATEGORIES.map((word) => (
              <Button
                key={word}
                size="sm"
                data-testid="sounds-like-prompt"
                data-category={word}
                onClick={() => {
                  setSame((text) => withCategory(text, word));
                  field.current?.focus();
                }}
              >
                {word}
              </Button>
            ))}
          </fieldset>
          <Button
            disabled={same.trim() === ""}
            onClick={() => setRevealed(true)}
            data-testid="sounds-like-reveal"
          >
            {HABIT_WORDS.reveal}
          </Button>
          {open && revealed ? <HabitList sketchId={sketch.id} cards={sketch.cards} /> : null}
        </div>
      </Dialog>
    </>
  );
}

function HabitList({ sketchId, cards }: { sketchId: string; cards: EditorSlotProps["sketch"]["cards"] }) {
  const q = useHabits();
  const patch = useSketchPatch();
  const [busy, setBusy] = useState<string | null>(null);
  if (q.isPending) return <LoadingState rows={2} />;
  if (q.isError)
    return notBuilt(q.error) ? (
      <p className="text-text-2">{HABIT_WORDS.notYet}</p>
    ) : (
      <ErrorState error={q.error} onRetry={() => void q.refetch()} />
    );
  const habits = q.data.habits;
  if (habits.length === 0)
    return (
      <p className="text-text-2" data-testid="sounds-like-empty">
        {HABIT_WORDS.empty}
      </p>
    );
  const onSketch = new Set((cards ?? []).map((c) => c.cardId));
  const avoid = async (habitId: string) => {
    setBusy(habitId);
    try {
      await patch.mutateAsync({
        params: { id: sketchId },
        body: { cards: notThisTime(cards, habitId, new Date().toISOString()) },
      });
    } catch (e) {
      toast.error(CARD_WORDS.saveFailed, errorWords(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-col gap-3" data-testid="sounds-like-list">
      <p className="text-sm text-text-2">{HABIT_WORDS.soundsLikeIntro}</p>
      <ul className="flex flex-col divide-y divide-border">
        {habits.map((h) => {
          const taken = onSketch.has(habitCardId(h.id));
          return (
            <li key={h.id} className="flex items-start justify-between gap-3 py-2" data-habit={h.id}>
              <span className="min-w-0">{h.text}</span>
              {taken ? (
                <span className="shrink-0 text-sm text-text-3">{HABIT_WORDS.onThisSketch}</span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  loading={busy === h.id}
                  disabled={busy !== null}
                  onClick={() => void avoid(h.id)}
                  data-testid="not-this-time"
                >
                  {HABIT_WORDS.notThisTime}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
