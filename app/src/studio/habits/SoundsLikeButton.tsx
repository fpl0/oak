// Oak 2.0 W3 (PLAN §4 S6): "Sounds like something you made before?" in the sketch editor's header (slot
// `sounds-like`, place `header`). It opens the habits mirror's sentences; "Not this time" on one puts that habit on
// this sketch as an avoidance card (`habit.<id>`, through `sketches.patch { cards }`), which the Cards panel then shows.
// It only describes and offers: nothing is counted or blocked.
import { History } from "lucide-react";
import { useState } from "react";
import { errorWords } from "../../lib/error-words.ts";
import { useSketchPatch } from "../../lib/queries.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Dialog } from "../../ui/kit/Dialog.tsx";
import { ErrorState, LoadingState } from "../../ui/kit/QueryState.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { CARD_WORDS } from "../cards/model.ts";
import type { EditorSlotProps } from "../editor-slots.ts";
import { notBuilt, useHabits } from "./habits-queries.ts";
import { HABIT_WORDS, habitCardId, notThisTime } from "./model.ts";

export function SoundsLikeButton({ sketch }: EditorSlotProps) {
  const [open, setOpen] = useState(false);
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
        {open ? <HabitList sketchId={sketch.id} cards={sketch.cards} /> : null}
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
