// Oak 2.0 W3 (PLAN §4 S6): the sketchbook's Habits tab (`/studio?habits=1`). The server's sentences about what the
// learner's own sketches share, as a plain list: no counts as goals, no charts, nothing to tick (W3 fidelity rule 1).
// Oak's starting lines and defaults are never read as a habit (X16).
import { Sparkles } from "lucide-react";
import { Card, EmptyState } from "../../ui/kit/basics.tsx";
import { ErrorState, LoadingState } from "../../ui/kit/QueryState.tsx";
import { notBuilt, useHabits } from "./habits-queries.ts";
import { HABIT_WORDS } from "./model.ts";

export function HabitsTab() {
  const q = useHabits();
  if (q.isPending) return <LoadingState />;
  if (q.isError)
    return notBuilt(q.error) ? (
      <p className="text-text-2" data-testid="habits-not-yet">
        {HABIT_WORDS.notYet}
      </p>
    ) : (
      <ErrorState error={q.error} onRetry={() => void q.refetch()} />
    );
  const habits = q.data.habits;
  return (
    <div className="flex flex-col gap-3" data-testid="habits-tab">
      <p className="max-w-[70ch] text-text-2">{HABIT_WORDS.intro}</p>
      {habits.length === 0 ? (
        <EmptyState icon={<Sparkles aria-hidden />} title={HABIT_WORDS.empty} />
      ) : (
        <Card className="p-4">
          <ul className="flex flex-col divide-y divide-border" data-testid="habits-list">
            {habits.map((h) => (
              <li key={h.id} className="py-2" data-testid="habit" data-habit={h.id}>
                {h.text}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
