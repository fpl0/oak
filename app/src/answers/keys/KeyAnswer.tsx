// Key answer (`text` with `normalize: "key"`): pick the key on the circle of fifths or type it ("E flat major",
// "F#m"). Both write the same value, the text the grader normalises; the circle shows what the text reads as.
import { useEffect, useRef } from "react";
import { readsAs } from "../normalize.ts";
import type { AnswerWidgetProps } from "../types.ts";
import { AnswerFrame, KeyHint, markOf, revealedOf, SubmitHint } from "../ui.tsx";
import { circleKeyOf } from "./circle.ts";
import { KeyCircle } from "./KeyCircle.tsx";

export function KeyAnswer(p: AnswerWidgetProps<"text">) {
  const { value, onChange, disabled, feedback } = p;
  const root = useRef<HTMLDivElement>(null);
  const picked = circleKeyOf(value);
  const mark = markOf(feedback, 0);
  const revealed = revealedOf<string>(feedback);
  const answer = revealed === null ? null : circleKeyOf(revealed);
  const read = readsAs("key", value);
  const previewId = `${p.idBase}-reads`;
  useEffect(() => {
    if (p.autoFocus) root.current?.querySelector<HTMLElement>("[role='radio'][tabindex='0']")?.focus();
  }, [p.autoFocus]);
  return (
    <AnswerFrame
      kind="text"
      idBase={p.idBase}
      label={p.label}
      feedback={feedback}
      disabled={disabled}
      onSubmit={p.onSubmit}
      keys={
        <>
          <KeyHint keys={["←", "→"]}>round the circle</KeyHint>
          <KeyHint keys={["↑", "↓"]}>major / minor</KeyHint>
          <SubmitHint />
        </>
      }
    >
      <div ref={root} className="flex flex-wrap items-start gap-4">
        <KeyCircle
          idBase={p.idBase}
          label="Circle of fifths"
          value={picked?.text ?? null}
          onPick={(k) => onChange(k.text)}
          disabled={disabled}
          mark={mark ? (mark.ok ? "ok" : "bad") : null}
          answer={answer?.text ?? null}
        />
        <div className="flex min-w-[14rem] flex-col gap-2 pt-2">
          <label htmlFor={`${p.idBase}-input`} className="text-sm text-text-2">
            Or type the key
          </label>
          <input
            id={`${p.idBase}-input`}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={previewId}
            aria-invalid={mark ? !mark.ok : undefined}
            readOnly={disabled}
            placeholder="e.g. E♭ major"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-full max-w-[16rem] rounded-control border-2 border-border bg-surface px-3 text-base text-text placeholder:text-text-3"
          />
          <p id={previewId} className="min-h-6 text-sm text-text-2">
            {revealed !== null ? (
              <>
                <span>Answer: </span>
                <span className="rounded-control border-2 border-dashed border-accent-2 px-1.5 font-semibold text-text">
                  {answer
                    ? `${answer.label.replace(/m$/, " minor")}${answer.key.mode === "major" ? " major" : ""}`
                    : revealed}
                </span>
              </>
            ) : read.state === "ok" ? (
              <>
                Reads as <span className="font-semibold text-text">{read.display}</span>
              </>
            ) : read.state === "unknown" ? (
              <span>{read.hint}</span>
            ) : (
              <span className="text-text-3">Pick a key on the circle, or type one.</span>
            )}
          </p>
        </div>
      </div>
    </AnswerFrame>
  );
}
