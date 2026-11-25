// Oak 2.0 W1 (PLAN §4 S4 focus one part): the header's "Focus one part" switch takes the labelled line under the
// cursor; while it is on, the other lines are muted (the Workbench's `soloLabel`) and locked (only the focused
// statement is editable, outlined), and the learner asks themself one question. The answer only changes the next
// line; nothing is stored or scored (W1 fidelity rule 6).
import { Crosshair } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/kit/Button.tsx";
import { FOCUS_ASK, FOCUS_NOT_YET, FOCUS_YES, focusLine, focusMutes, JAM_WORDS } from "./jam.ts";

/** The header's switch. With no labelled line under the cursor it says what to do instead. */
export function FocusToggle({
  focus,
  cursorLabel,
  onFocus,
  onNoLine,
  disabled,
}: {
  focus: string | null;
  cursorLabel: string | null;
  onFocus(label: string | null): void;
  onNoLine(): void;
  disabled?: boolean;
}) {
  const on = focus !== null;
  return (
    <Button
      variant={on ? "primary" : "ghost"}
      icon={<Crosshair aria-hidden className="size-4" />}
      aria-pressed={on}
      title={JAM_WORDS.focusTitle}
      disabled={disabled}
      onClick={() => {
        if (on) onFocus(null);
        else if (cursorLabel === null) onNoLine();
        else onFocus(cursorLabel);
      }}
      data-testid="focus-toggle"
    >
      {JAM_WORDS.focus}
    </Button>
  );
}

/** The row under the header while a part is focused: what is muted, the self-check, End focus. */
export function FocusPanel({
  label,
  labels,
  onEnd,
}: {
  label: string;
  /** Every labelled line of the code now. */
  labels: readonly string[];
  onEnd(): void;
}) {
  const [answer, setAnswer] = useState<"yes" | "not-yet" | null>(null);
  const muted = [...focusMutes(labels, label).muted];
  return (
    <section
      aria-label={JAM_WORDS.focus}
      className="flex flex-col gap-1.5 rounded-card border border-accent/40 bg-lane-in px-3 py-2 text-sm"
      data-testid="focus-panel"
      data-focus={label}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-text">{focusLine(label)}</p>
        {muted.length > 0 ? (
          <p className="text-text-2" data-testid="focus-muted">
            {JAM_WORDS.focusOthersMuted} <span className="font-mono">{muted.join(", ")}</span>
          </p>
        ) : null}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onEnd} data-testid="focus-end">
          {JAM_WORDS.focusEnd}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2" data-testid="focus-check">
        <span className="text-text">{FOCUS_ASK}</span>
        <Button
          size="sm"
          variant={answer === "yes" ? "primary" : "secondary"}
          aria-pressed={answer === "yes"}
          onClick={() => setAnswer("yes")}
        >
          {JAM_WORDS.yes}
        </Button>
        <Button
          size="sm"
          variant={answer === "not-yet" ? "primary" : "secondary"}
          aria-pressed={answer === "not-yet"}
          onClick={() => setAnswer("not-yet")}
        >
          {JAM_WORDS.notYet}
        </Button>
        {answer !== null ? (
          <span className="text-text-2" data-testid="focus-answer">
            {answer === "yes" ? FOCUS_YES : FOCUS_NOT_YET}
          </span>
        ) : null}
      </div>
    </section>
  );
}
