// Interval answer (U04; `text` with `normalize: "interval"`): pick the generic number (a 3rd), then the quality it
// allows (major or minor; perfect for 1 4 5 8), or type it ("minor third", "m3", "P5"). Digits pick the number,
// `p` `M` `m` `a` `d` the quality, Backspace clears, Enter checks. The value is the text the grader normalises.
// Wave 6 (U12.L06, compound intervals): "+ an octave" (`O`) makes the number a 9th to a 14th (a 3rd becomes a
// 10th); the reading says what that is ("an octave plus a major 3rd"). The switch shows in a step about compound
// intervals (`AnswerEnv.harmony.compoundIntervals`) or when the typed answer is one; typing "M10" always works.

import { intervalFacts } from "@oak/theory";
import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { useAnswerEnv } from "../env.tsx";
import { readsAs } from "../normalize.ts";
import type { AnswerWidgetProps } from "../types.ts";
import {
  AnswerFrame,
  digitOf,
  KeyHint,
  MarkBadge,
  markOf,
  markRing,
  revealedOf,
  SubmitHint,
} from "../ui.tsx";
import {
  composeInterval,
  INTERVAL_NUMBERS,
  type IntervalQuality,
  numberWord,
  QUALITY_WORD,
  qualitiesFor,
  qualityForKey,
  splitInterval,
} from "./interval.ts";

const ALL_QUALITIES: IntervalQuality[] = ["P", "M", "m", "A", "d"];

export function IntervalAnswer(p: AnswerWidgetProps<"text">) {
  const { value, onChange, disabled, feedback } = p;
  const root = useRef<HTMLDivElement>(null);
  const env = useAnswerEnv();
  const parsed = splitInterval(value);
  const [draftNum, setDraftNum] = useState<number | null>(null);
  const num = parsed?.num ?? (parsed ? null : draftNum);
  // Compound: the number plus an octave (2–7 become 9–14). The pad's eight buttons stay the simple numbers.
  const [wide, setWide] = useState(false);
  const octave = num !== null ? num > 8 : wide;
  const simpleNum = num === null ? null : num > 8 ? ((num - 2) % 7) + 2 : num;
  const quality = parsed?.q ?? null;
  const mark = markOf(feedback, 0);
  const revealed = revealedOf<string>(feedback);
  const revealedRead = revealed === null ? null : readsAs("interval", revealed);
  const read = readsAs("interval", value);
  const previewId = `${p.idBase}-reads`;
  const revealedNum = revealed === null ? null : (splitInterval(revealed)?.num ?? null);
  const showOctave =
    env.harmony?.compoundIntervals === true || (num ?? 0) > 8 || (revealedNum ?? 0) > 8 || wide;
  const compoundNote = (name: string): string | null => {
    try {
      const f = intervalFacts(name);
      if (!f.compound) return null;
      return `${f.octaves === 1 ? "an octave" : `${f.octaves} octaves`} plus ${f.simple}`;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (p.autoFocus) root.current?.querySelector<HTMLButtonElement>("[data-num]")?.focus();
  }, [p.autoFocus]);

  const pickNum = (simple: number, up = octave) => {
    if (disabled) return;
    const n = up && simple >= 2 && simple <= 7 ? simple + 7 : simple;
    setDraftNum(n);
    const keep = quality ? composeInterval(n, quality) : null;
    onChange(keep ?? "");
  };
  const toggleOctave = () => {
    if (disabled) return;
    const next = !octave;
    setWide(next);
    if (simpleNum !== null) pickNum(simpleNum, next);
  };
  const pickQuality = (q: IntervalQuality) => {
    if (disabled || num === null) return;
    const name = composeInterval(num, q);
    if (name) onChange(name);
  };

  const onKey = (e: React.KeyboardEvent<HTMLElement>): boolean => {
    if ((e.target as HTMLElement).tagName === "INPUT") return false;
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    const d = digitOf(e);
    if (d !== null && d >= 1 && d <= 8) {
      pickNum(d);
      root.current?.querySelector<HTMLButtonElement>(`[data-num="${d}"]`)?.focus();
      return true;
    }
    if ((e.key === "o" || e.key === "O") && showOctave) {
      toggleOctave();
      return true;
    }
    const q = qualityForKey(e.key);
    if (q) {
      pickQuality(q);
      root.current?.querySelector<HTMLButtonElement>(`[data-quality="${q}"]`)?.focus();
      return true;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      if (!disabled) {
        onChange("");
        setDraftNum(null);
      }
      return true;
    }
    return false;
  };

  const allowed = num === null ? [] : qualitiesFor(num);
  return (
    <AnswerFrame
      kind="text"
      idBase={p.idBase}
      label={p.label}
      feedback={feedback}
      disabled={disabled}
      onSubmit={p.onSubmit}
      onKey={onKey}
      keys={
        <>
          <KeyHint keys={["1–8"]}>number</KeyHint>
          {showOctave ? <KeyHint keys={["O"]}>+ an octave</KeyHint> : null}
          <KeyHint keys={["P", "⇧M", "m", "A", "d"]}>quality</KeyHint>
          <SubmitHint />
        </>
      }
    >
      <div ref={root} className="flex flex-col gap-2" data-testid="interval-pad">
        <div role="radiogroup" aria-label="How far: the number" className="flex flex-wrap gap-1.5">
          {INTERVAL_NUMBERS.map((n) => {
            const on = simpleNum === n;
            const shown = octave && n >= 2 && n <= 7 ? n + 7 : n;
            return (
              // biome-ignore lint/a11y/useSemanticElements: a styled radio with roving focus (ux §7.9)
              <button
                key={n}
                type="button"
                role="radio"
                data-num={n}
                aria-checked={on}
                aria-disabled={disabled || undefined}
                tabIndex={(simpleNum ?? 1) === n ? 0 : -1}
                onClick={() => pickNum(n)}
                className={clsx(
                  "relative flex h-12 min-w-12 flex-col items-center justify-center rounded-control border-2 px-2 tabular-nums",
                  on ? "border-text bg-surface-2" : "border-border bg-surface hover:bg-surface-2",
                  on && mark ? markRing(mark.ok ? "ok" : "bad") : "",
                )}
              >
                <span className="text-base leading-none font-semibold">{shown}</span>
                <span className="mt-0.5 text-[0.7rem] leading-none text-text-2">{numberWord(shown)}</span>
              </button>
            );
          })}
          {showOctave ? (
            <button
              type="button"
              data-enter="native"
              data-octave
              aria-pressed={octave}
              aria-disabled={disabled || undefined}
              onClick={toggleOctave}
              className={clsx(
                "ml-1 inline-flex h-12 items-center rounded-control border-2 px-3 text-sm",
                octave ? "border-text bg-surface-2 text-text" : "border-border bg-surface text-text-2",
              )}
            >
              + an octave
            </button>
          ) : null}
        </div>
        <div role="radiogroup" aria-label="Quality" className="flex flex-wrap gap-1.5">
          {ALL_QUALITIES.map((q) => {
            const ok = allowed.includes(q);
            const on = quality === q;
            return (
              // biome-ignore lint/a11y/useSemanticElements: a styled radio with roving focus (ux §7.9)
              <button
                key={q}
                type="button"
                role="radio"
                data-quality={q}
                aria-checked={on}
                aria-disabled={disabled || !ok || undefined}
                tabIndex={(quality ?? allowed[0]) === q ? 0 : -1}
                onClick={() => pickQuality(q)}
                className={clsx(
                  "relative inline-flex h-9 items-center gap-1.5 rounded-control border-2 px-2.5 text-sm",
                  on ? "border-text bg-surface-2 text-text" : "border-border bg-surface text-text-2",
                  !ok && "opacity-40",
                  on && mark ? markRing(mark.ok ? "ok" : "bad") : "",
                )}
              >
                <span className="font-semibold text-text">{q}</span>
                <span>{QUALITY_WORD[q]}</span>
                {on && mark ? <MarkBadge mark={mark.ok ? "ok" : "bad"} note={mark.note} /> : null}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${p.idBase}-input`} className="text-sm text-text-2">
            Or type it
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
            placeholder="e.g. minor 3rd"
            value={value}
            onChange={(e) => {
              setDraftNum(null);
              onChange(e.target.value);
            }}
            className="h-9 w-48 rounded-control border-2 border-border bg-surface px-2.5 text-base text-text placeholder:text-text-3"
          />
        </div>
        <p id={previewId} className="min-h-6 text-sm text-text-2">
          {revealed !== null ? (
            <>
              <span>Answer: </span>
              <span className="rounded-control border-2 border-dashed border-accent-2 px-1.5 font-semibold text-text">
                {revealedRead?.state === "ok" ? `${revealedRead.display} (${revealedRead.spoken})` : revealed}
              </span>
            </>
          ) : read.state === "ok" ? (
            <>
              Reads as <span className="font-semibold text-text">{read.display}</span> ({read.spoken})
              {compoundNote(read.canonical) ? <span>: {compoundNote(read.canonical)}</span> : null}
            </>
          ) : read.state === "unknown" ? (
            <span>{read.hint}</span>
          ) : num !== null ? (
            <span className="text-text-3">
              Now the quality: {allowed.map((q) => QUALITY_WORD[q]).join(", ")}.
            </span>
          ) : (
            <span className="text-text-3">Pick how far (count both ends), then the quality.</span>
          )}
        </p>
      </div>
    </AnswerFrame>
  );
}
