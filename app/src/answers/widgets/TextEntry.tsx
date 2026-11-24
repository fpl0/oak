// Text and number entry (contracts §5.4 `text`, `number`; exercises §3.9): forgiving input, exact canonical display.
// The text is sent as typed and normalised by the grader; the "reads as" line shows what Oak reads with the same
// normaliser before the learner checks. Numbers accept `1,5`, `1/3`, `120 BPM`, `three`.
import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { expectedText, formatNumber, parseNumberText, readsAs, type TextKind } from "../normalize.ts";
import type { AnswerWidgetProps } from "../types.ts";
import { AnswerFrame, KeyHint, MarkBadge, markOf, markRing, revealedOf, SubmitHint } from "../ui.tsx";

const INPUT =
  "h-10 w-full max-w-[22rem] rounded-control border-2 bg-surface px-3 text-base text-text placeholder:text-text-3 focus-visible:outline-offset-2 disabled:opacity-80";

const PLACEHOLDER: Record<TextKind, string> = {
  note: "E♭",
  chord: "Cmaj7",
  rn: "V7",
  interval: "m3",
  key: "E♭ major",
  free: "",
};

export function TextAnswer(p: AnswerWidgetProps<"text">) {
  const { spec, value, onChange, disabled, feedback } = p;
  const kind = spec.normalize as TextKind;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (p.autoFocus) ref.current?.focus();
  }, [p.autoFocus]);
  const read = readsAs(kind, value);
  const mark = markOf(feedback, 0);
  const revealed = revealedOf<string>(feedback);
  const revealedRead = revealed === null ? null : readsAs(kind, revealed);
  const previewId = `${p.idBase}-reads`;
  return (
    <AnswerFrame
      kind="text"
      idBase={p.idBase}
      label={p.label}
      feedback={feedback}
      disabled={disabled}
      onSubmit={p.onSubmit}
      keys={<SubmitHint />}
    >
      <div className="relative w-fit max-w-full">
        <input
          ref={ref}
          id={`${p.idBase}-input`}
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={p.label}
          aria-describedby={previewId}
          aria-invalid={mark ? !mark.ok : undefined}
          readOnly={disabled}
          placeholder={PLACEHOLDER[kind] ? `e.g. ${PLACEHOLDER[kind]}` : ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(INPUT, "border-border", markRing(mark ? (mark.ok ? "ok" : "bad") : null))}
        />
        <MarkBadge mark={mark ? (mark.ok ? "ok" : "bad") : null} note={mark?.note} />
      </div>
      <p id={previewId} className="min-h-6 text-sm text-text-2">
        {revealed !== null ? (
          <>
            <span>Answer: </span>
            <span className="rounded-control border-2 border-dashed border-accent-2 px-1.5 font-semibold text-text">
              {revealedRead?.state === "ok" ? revealedRead.display : revealed}
            </span>
          </>
        ) : read.state === "ok" && kind !== "free" ? (
          <>
            Reads as <span className="font-semibold text-text">{read.display}</span>
            {read.spoken !== read.display ? <span className="sr-only"> ({read.spoken})</span> : null}
          </>
        ) : read.state === "unknown" ? (
          <span>{read.hint}</span>
        ) : kind !== "free" ? (
          <span className="text-text-3">Type {expectedText(kind)}.</span>
        ) : null}
      </p>
    </AnswerFrame>
  );
}

export function NumberAnswer(p: AnswerWidgetProps<"number">) {
  const { value, onChange, disabled, feedback } = p;
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value === null ? "" : formatNumber(value));
  // A value set from outside (a reset, a new trial) replaces the draft.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (parseNumberText(draft) !== value) setDraft(value === null ? "" : formatNumber(value));
  }
  useEffect(() => {
    if (p.autoFocus) ref.current?.focus();
  }, [p.autoFocus]);
  const parsed = parseNumberText(draft);
  const mark = markOf(feedback, 0);
  const revealed = revealedOf<number>(feedback);
  const previewId = `${p.idBase}-reads`;
  const set = (text: string) => {
    setDraft(text);
    const n = parseNumberText(text);
    setSeen(n);
    onChange(n);
  };
  const onKey = (e: React.KeyboardEvent<HTMLElement>): boolean => {
    if (disabled || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return false;
    const base = parsed ?? 0;
    set(formatNumber(base + (e.key === "ArrowUp" ? 1 : -1)));
    return true;
  };
  return (
    <AnswerFrame
      kind="number"
      idBase={p.idBase}
      label={p.label}
      feedback={feedback}
      disabled={disabled}
      onSubmit={p.onSubmit}
      onKey={onKey}
      keys={
        <>
          <KeyHint keys={["↑", "↓"]}>±1</KeyHint>
          <SubmitHint />
        </>
      }
    >
      <div className="relative w-fit">
        <input
          ref={ref}
          id={`${p.idBase}-input`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-label={p.label}
          aria-describedby={previewId}
          aria-invalid={mark ? !mark.ok : undefined}
          readOnly={disabled}
          value={draft}
          placeholder="e.g. 3"
          onChange={(e) => set(e.target.value)}
          className={clsx(
            INPUT,
            "w-40 tabular-nums",
            "border-border",
            markRing(mark ? (mark.ok ? "ok" : "bad") : null),
          )}
        />
        <MarkBadge mark={mark ? (mark.ok ? "ok" : "bad") : null} note={mark?.note} />
      </div>
      <p id={previewId} className="min-h-6 text-sm text-text-2">
        {revealed !== null ? (
          <>
            <span>Answer: </span>
            <span className="rounded-control border-2 border-dashed border-accent-2 px-1.5 font-semibold text-text tabular-nums">
              {formatNumber(revealed)}
            </span>
          </>
        ) : draft.trim() === "" ? (
          <span className="text-text-3">A number, like 3.</span>
        ) : parsed === null ? (
          <span>Oak reads a number here, like 3, 1.5 or 1/3.</span>
        ) : formatNumber(parsed) !== draft.trim() ? (
          <>
            Reads as <span className="font-semibold text-text tabular-nums">{formatNumber(parsed)}</span>
          </>
        ) : null}
      </p>
    </AnswerFrame>
  );
}
