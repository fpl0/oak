// Single and multiple choice (contracts §5.4 `choice`): buttons, cards or audio cards. `1`–`9` pick the n-th
// option (toggle when multi), `Shift+1`–`9` plays its audio, arrows move between options (and pick, for a single
// choice, as a radio group does). Marks per option ID; a reveal outlines the right ones.
// Wave 6: a single choice whose options are bars (and "none": `fam.har.modulation`) is drawn as a bar timeline
// (BarStrip.tsx), with the keys named from `AnswerEnv.keyChange`. After a check, a "which mode" pick can say the
// one changed note of the mode (`AnswerEnv.facts`), and a pick among chords, when the host names both keys of a
// modulation, says what the chord is in each (the pivot). Those lines have reserved height: nothing moves.
import type { Choice } from "@oak/api";
import { clsx } from "clsx";
import { Play } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAnswerEnv } from "../env.tsx";
import { isBarChoice, isChordChoice, isModeChoice, modeFact, pivotFact } from "../facts.ts";
import type { AnswerWidgetProps } from "../types.ts";
import {
  AnswerFrame,
  digitOf,
  focusFirst,
  KeyHint,
  MarkBadge,
  markOf,
  markRing,
  revealedOf,
  SubmitHint,
} from "../ui.tsx";
import { BarStrip, keyChangeLine } from "./BarStrip.tsx";
import { InlineMd, plainMd } from "./InlineMd.tsx";

export function ChoiceAnswer(p: AnswerWidgetProps<"choice">) {
  const { spec, value, onChange, disabled, feedback } = p;
  const root = useRef<HTMLDivElement>(null);
  const env = useAnswerEnv();
  const thumbOf = env.choiceThumb;
  const multi = spec.multi === true;
  const layout = spec.layout ?? "buttons";
  const cards = layout !== "buttons";
  const correct = revealedOf<string[]>(feedback) ?? [];
  const canPlay = Boolean(p.audition) && spec.options.some((o) => o.audio);
  // Wave 6: a bar timeline, and the lines that say what a pick means once it is checked.
  const kc = env.keyChange;
  const barPick = !multi && layout === "buttons" && isBarChoice(spec.options);
  const modePick = env.facts === true && !multi && isModeChoice(spec.options);
  const pivotPick =
    !multi && !modePick && !barPick && Boolean(kc?.from && kc.to) && isChordChoice(spec.options);
  const answered =
    feedback.state === "correct" || feedback.state === "wrong" || feedback.state === "revealed";
  const known = feedback.state === "correct" || feedback.state === "revealed";
  // The option the line is about: the answer when it is shown, else the learner's own pick (never the answer).
  const aboutId = feedback.state === "revealed" ? (correct[0] ?? null) : answered ? (value[0] ?? null) : null;
  const about = aboutId === null ? null : (spec.options.find((o) => o.id === aboutId) ?? null);
  const fact = !about
    ? null
    : modePick
      ? modeFact(about.id, env.harmony?.key?.tonic)
      : pivotPick && kc?.from && kc.to
        ? pivotFact(about, kc.from, kc.to)
        : null;
  const factLead = feedback.state === "wrong" ? "Your pick: " : "";
  // A drill grades a single pick at once (no Check step): a digit answers, and there is no Enter hint.
  const oneShot = env.autoSubmit === true && !multi;
  // Once a one-shot pick is graded its digits are dead; the host's result row says what Enter does now.
  const hideKeys = oneShot && answered;

  useEffect(() => {
    if (p.autoFocus) focusFirst(root.current);
  }, [p.autoFocus]);

  const pick = (o: Choice) => {
    if (disabled) return;
    if (multi) onChange(value.includes(o.id) ? value.filter((v) => v !== o.id) : [...value, o.id]);
    else onChange([o.id]);
  };
  const play = (o: Choice) => {
    if (o.audio) p.audition?.(o.audio);
  };
  const buttons = () => [...(root.current?.querySelectorAll<HTMLButtonElement>("[data-option]") ?? [])];

  const onKey = (e: React.KeyboardEvent<HTMLElement>): boolean => {
    const n = digitOf(e);
    // On a bar timeline a digit is the bar's own number and 0 is "No key change" (Wave 6 review: digits counted
    // the options, so with bar 1 not offered and "No key change" last, 5 picked bar 6, one bar late).
    if (barPick && n !== null) {
      const id = n === 0 ? "none" : String(n);
      const i = spec.options.findIndex((o) => o.id === id);
      if (i < 0) return true;
      const o = spec.options[i] as Choice;
      if (e.shiftKey) play(o);
      else {
        pick(o);
        root.current?.querySelector<HTMLButtonElement>(`[data-option="${id}"]`)?.focus();
      }
      return true;
    }
    if (n !== null && n >= 1 && n <= spec.options.length) {
      const o = spec.options[n - 1] as Choice;
      if (e.shiftKey) play(o);
      else {
        pick(o);
        buttons()[n - 1]?.focus();
      }
      return true;
    }
    const dir =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (dir === 0) return false;
    const list = buttons();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return false;
    const next = (at + dir + list.length) % list.length;
    list[next]?.focus();
    if (!multi) pick(spec.options[next] as Choice);
    return true;
  };

  const tabStop = multi ? null : (value[0] ?? spec.options[0]?.id);
  if (barPick) {
    /** The key that picks an option on the timeline: the bar's number, 0 for "No key change". */
    const keyOf = (o: Choice) => (o.id === "none" ? "0" : o.id);
    const bars = Math.max(...spec.options.map((o) => Number(o.id)).filter((n) => Number.isFinite(n)));
    const shownId = feedback.state === "revealed" ? (correct[0] ?? null) : (value[0] ?? null);
    const shownBar = shownId === null ? null : shownId === "none" ? "none" : Number(shownId);
    const cell = (o: Choice, wide: boolean) => {
      const on = value.includes(o.id);
      const mark = markOf(feedback, o.id);
      const bad = mark !== null && !mark.ok;
      const isAnswer = correct.includes(o.id);
      return (
        // biome-ignore lint/a11y/useSemanticElements: a styled custom control with roving focus (ux §7.9); native radios cannot take this layout
        <button
          type="button"
          data-option={o.id}
          role="radio"
          aria-checked={on}
          aria-disabled={disabled || undefined}
          aria-label={`${keyOf(o)}. ${plainMd(o.label)}${kc && on && !wide ? ", the new key begins here" : ""}${isAnswer ? " (the answer)" : ""}`}
          tabIndex={o.id === tabStop ? 0 : -1}
          onClick={() => pick(o)}
          className={clsx(
            "relative flex items-center justify-center rounded-control border-2 font-medium tabular-nums transition-colors",
            wide ? "min-h-10 gap-2 px-3 py-1.5" : "h-11 w-full min-w-0 flex-col px-1 leading-tight",
            on && !bad
              ? "border-accent bg-lane-in text-text"
              : "border-border bg-surface text-text hover:border-text-3",
            markRing(mark ? (mark.ok ? "ok" : "bad") : null),
            isAnswer && !on && "border-dashed border-accent-2",
            disabled && "cursor-default opacity-80",
          )}
        >
          {wide ? (
            <>
              <span
                aria-hidden
                className={clsx(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded border text-[0.75rem]",
                  chipTone(on, bad),
                )}
              >
                {keyOf(o)}
              </span>
              <InlineMd text={o.label} />
            </>
          ) : (
            <>
              <span aria-hidden className="text-[0.65rem] font-normal text-text-3">
                bar
              </span>
              <span aria-hidden>{o.id}</span>
            </>
          )}
          <MarkBadge mark={mark ? (mark.ok ? "ok" : "bad") : null} note={mark?.note} />
        </button>
      );
    };
    const noneAt = spec.options.findIndex((o) => o.id === "none");
    const none = noneAt >= 0 ? (spec.options[noneAt] as Choice) : null;
    const offered = spec.options
      .map((o) => Number(o.id))
      .filter((b) => Number.isInteger(b) && b >= 1 && b <= 9);
    const barKeys = offered.length === 0 ? "1–9" : `${Math.min(...offered)}–${Math.max(...offered)}`;
    return (
      <AnswerFrame
        kind="choice"
        idBase={p.idBase}
        label={p.label}
        feedback={feedback}
        disabled={disabled}
        onSubmit={p.onSubmit}
        onKey={onKey}
        keys={
          hideKeys ? null : (
            <>
              <KeyHint keys={[`${barKeys}`]}>{oneShot ? "answer" : "bar"}</KeyHint>
              {none ? <KeyHint keys={["0"]}>no key change</KeyHint> : null}
              <KeyHint keys={["←", "→"]}>move</KeyHint>
              {oneShot ? null : <SubmitHint />}
            </>
          )
        }
      >
        <div
          ref={root}
          role="radiogroup"
          aria-label={p.label}
          aria-describedby={kc ? `${p.idBase}-keyline` : undefined}
          data-choice-layout="bars"
        >
          <BarStrip
            bars={bars}
            idBase={p.idBase}
            from={kc && typeof shownBar === "number" ? shownBar : null}
            keyChange={kc}
            none={none ? cell(none, true) : undefined}
            line={kc ? keyChangeLine({ from: kc.from, to: kc.to, bar: shownBar, known }) : null}
            renderCell={(bar) => {
              const i = spec.options.findIndex((o) => o.id === String(bar));
              return i < 0 ? null : cell(spec.options[i] as Choice, false);
            }}
          />
        </div>
      </AnswerFrame>
    );
  }
  return (
    <AnswerFrame
      kind="choice"
      idBase={p.idBase}
      label={p.label}
      feedback={feedback}
      disabled={disabled}
      onSubmit={p.onSubmit}
      onKey={onKey}
      keys={
        hideKeys ? null : (
          <>
            <KeyHint keys={[`1–${Math.min(9, spec.options.length)}`]}>
              {multi ? "toggle" : oneShot ? "answer" : "pick"}
            </KeyHint>
            {canPlay ? <KeyHint keys={["⇧ + digit"]}>play</KeyHint> : null}
            {oneShot ? null : <SubmitHint />}
          </>
        )
      }
    >
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is chosen at runtime (radio for one answer, checkbox or group for several) */}
      <div
        ref={root}
        role={multi ? "group" : "radiogroup"}
        aria-label={p.label}
        className={clsx(
          cards
            ? "grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]"
            : "flex flex-wrap gap-2",
        )}
      >
        {spec.options.map((o, i) => {
          const on = value.includes(o.id);
          const mark = markOf(feedback, o.id);
          const bad = mark !== null && !mark.ok;
          const isAnswer = correct.includes(o.id);
          return (
            <div key={o.id} className={clsx("relative", cards && "flex")}>
              {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is chosen at runtime (radio for one answer, checkbox or group for several) */}
              <button
                type="button"
                data-option={o.id}
                role={multi ? "checkbox" : "radio"}
                aria-checked={on}
                aria-disabled={disabled || undefined}
                aria-label={`${i + 1}. ${plainMd(o.label)}${isAnswer ? " (the answer)" : ""}`}
                tabIndex={multi || o.id === tabStop ? 0 : -1}
                onClick={() => pick(o)}
                className={clsx(
                  "relative flex min-h-10 items-center gap-2 rounded-control border-2 px-3 text-left transition-colors",
                  cards ? "w-full flex-1 py-3 pr-12" : "py-1.5",
                  on && !bad
                    ? "border-accent bg-lane-in text-text"
                    : "border-border bg-surface text-text hover:border-text-3",
                  markRing(mark ? (mark.ok ? "ok" : "bad") : null),
                  isAnswer && !on && "border-dashed border-accent-2",
                  disabled && "cursor-default opacity-80",
                )}
              >
                <span
                  aria-hidden
                  className={clsx(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded border text-[0.75rem] tabular-nums",
                    chipTone(on, bad),
                  )}
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  {cards && o.thumb && thumbOf ? <span aria-hidden>{thumbOf(o)}</span> : null}
                  <span>
                    <InlineMd text={o.label} />
                  </span>
                </span>
                {isAnswer ? (
                  <span className="absolute -top-2 left-2 rounded bg-surface px-1 text-[0.65rem] leading-4 font-medium text-accent-2">
                    answer
                  </span>
                ) : null}
              </button>
              {cards && o.audio && p.audition ? (
                <button
                  type="button"
                  data-enter="native"
                  aria-label={`Play ${plainMd(o.label)}`}
                  title={`Play (⇧${i + 1})`}
                  onClick={() => play(o)}
                  className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-control border border-border bg-surface text-text-2 hover:bg-surface-2 hover:text-text"
                >
                  <Play aria-hidden className="size-4" />
                </button>
              ) : null}
              <MarkBadge mark={mark ? (mark.ok ? "ok" : "bad") : null} note={mark?.note} />
            </div>
          );
        })}
      </div>
      {modePick || pivotPick ? (
        <p className="min-h-12 text-sm text-text-2" data-testid="choice-fact" aria-live="polite">
          {fact ? (
            <>
              {factLead}
              {fact}
            </>
          ) : null}
        </p>
      ) : null}
    </AnswerFrame>
  );
}

/**
 * The option's number chip: filled accent while picked, outlined in the issue tone once that pick is marked wrong
 * (a wrong tile never shows the "right" fill), neutral otherwise.
 */
function chipTone(on: boolean, bad: boolean): string {
  if (bad) return "border-issue text-issue";
  return on ? "border-accent bg-accent text-on-accent" : "border-border text-text-3";
}
