// Shared pieces of every answer widget: the frame (group label, Enter to check, the feedback line with reserved
// height so feedback never shifts the layout), per-part marks, the theme for degree colours, the key hints.
import { clsx } from "clsx";
import { Check, Eye, Loader2, X } from "lucide-react";
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { RETRY_KEYS, RETRY_LABEL } from "../lib/retry.ts";
import { IS_MAC } from "../ui/keys/KeymapProvider.tsx";
import { formatKeys } from "../ui/keys/keymap.ts";
import { Kbd } from "../ui/kit/index.ts";
import { useSubmitVerb } from "./env.tsx";
import type { AnswerFeedback, AnswerValue, PartMark } from "./types.ts";
import { InlineMd } from "./widgets/InlineMd.tsx";

// --- theme --------------------------------------------------------------------------------------

/** Paper or Bark, following `<html data-theme>` (degree colours are data, not CSS). */
export { useThemeName } from "../ui/theme/use-theme-name.ts";

// --- marks --------------------------------------------------------------------------------------

export type Mark = "ok" | "bad" | null;

/** The mark of one part, or null when the feedback carries none for it. */
export function markOf(feedback: AnswerFeedback, part: number | string): PartMark | null {
  if (feedback.state === "idle" || feedback.state === "pending") return null;
  return feedback.marks?.find((m) => m.part === part) ?? null;
}

export function markState(feedback: AnswerFeedback, part: number | string): Mark {
  const m = markOf(feedback, part);
  return m ? (m.ok ? "ok" : "bad") : null;
}

/** The correct value, only when the host revealed it. */
export function revealedOf<V = AnswerValue>(feedback: AnswerFeedback): V | null {
  return feedback.state === "revealed" ? (feedback.correct as V) : null;
}

/** Border and ring classes for a marked part. The border width never changes, so nothing moves. */
export function markRing(mark: Mark): string {
  if (mark === "ok") return "border-accent ring-1 ring-accent";
  if (mark === "bad") return "border-issue ring-1 ring-issue";
  return "";
}

/** A small corner badge for a marked part (icon + screen-reader word): colour is never alone. */
export function MarkBadge({ mark, note }: { mark: Mark; note?: string | undefined }) {
  if (!mark) return null;
  return (
    <span
      className={clsx(
        "pointer-events-none absolute -top-1.5 -right-1.5 inline-flex size-4 items-center justify-center rounded-full",
        mark === "ok" ? "bg-accent text-on-accent" : "bg-issue text-white",
      )}
      title={note}
    >
      {mark === "ok" ? <Check aria-hidden className="size-3" /> : <X aria-hidden className="size-3" />}
      <span className="sr-only">{mark === "ok" ? "right" : "not this one"}</span>
    </span>
  );
}

// --- frame --------------------------------------------------------------------------------------

const STATUS_DEFAULT: Record<Exclude<AnswerFeedback["state"], "idle">, string> = {
  pending: "Checking…",
  correct: "That's it.",
  wrong: "Not quite.",
  revealed: "The answer is shown next to yours.",
};

function statusText(feedback: AnswerFeedback, verb: "check" | "save" = "check"): string {
  if (feedback.state === "idle") return "";
  if (feedback.state === "pending" && verb === "save") return "Saving…";
  if (feedback.state === "wrong") {
    if (feedback.message) return feedback.message;
    const bad = feedback.marks?.filter((m) => !m.ok).length ?? 0;
    if (bad > 0) return `Not quite: ${bad} ${bad === 1 ? "part differs" : "parts differ"}.`;
  }
  return STATUS_DEFAULT[feedback.state];
}

/** The one-line feedback under a widget: reserved height, polite live region, icon plus words. */
export function FeedbackLine({ feedback, id }: { feedback: AnswerFeedback; id: string }) {
  const text = statusText(feedback, useSubmitVerb());
  const icon =
    feedback.state === "pending" ? (
      <Loader2 aria-hidden className="size-4 animate-spin reduced:animate-none" />
    ) : feedback.state === "correct" ? (
      <Check aria-hidden className="size-4 text-accent" />
    ) : feedback.state === "wrong" ? (
      <X aria-hidden className="size-4 text-issue" />
    ) : feedback.state === "revealed" ? (
      <Eye aria-hidden className="size-4 text-accent-2" />
    ) : null;
  return (
    <p
      id={id}
      aria-live="polite"
      data-testid="answer-status"
      className="flex min-h-6 items-start gap-1.5 text-sm text-text-2"
    >
      <span className="mt-0.5 inline-flex w-4 shrink-0 justify-center">{icon}</span>
      <span className="min-w-0">
        <InlineMd text={text} />
      </span>
    </p>
  );
}

export interface FrameProps {
  kind: string;
  idBase: string;
  label: string;
  feedback: AnswerFeedback;
  disabled?: boolean | undefined;
  onSubmit(): void;
  /** Widget keys; return true when handled (the frame then prevents the default). */
  onKey?: ((e: KeyboardEvent<HTMLElement>) => boolean) | undefined;
  /** Let Enter through (multi-line inputs); `Mod+Enter` still checks. */
  enterIsNewline?: boolean;
  /** Keys this widget answers to, shown under it. */
  keys?: ReactNode;
  /** Visible question text above the controls (the host usually shows the prompt itself). */
  caption?: ReactNode;
  /** A tap pad says so (contracts: only a tap pad may take Space). */
  keyscope?: "tap" | "staff-input";
  className?: string;
  children: ReactNode;
}

/** True for the platform's command modifier. */
// --- a take's own "Try again" ------------------------------------------------------------------------

/**
 * A finished take (sung, tapped, hummed) before it is checked already shows how it went ("Done: 2 of 3 in tune.",
 * "8 taps recorded."): taking it again is the same "Try again" as after a verdict (docs/design/retry.md §2.1) —
 * the same words, the same counter-clockwise arrow, the same key. The widget draws it beside its take while no
 * verdict is on screen; once one is, the host's result row has the only Try again (the widget is `locked`).
 */
export const TAKE_RETRY_PROPS = {
  "aria-label": RETRY_LABEL,
  "aria-keyshortcuts": RETRY_KEYS,
  "data-take-retry": "",
} as const;

/** The words and key cap of a take's own Try again. */
export function TakeRetryLabel() {
  return (
    <>
      {RETRY_LABEL}
      <span aria-hidden className="contents">
        <Kbd>{formatKeys(RETRY_KEYS, IS_MAC)}</Kbd>
      </span>
    </>
  );
}

/**
 * Alt+R for a take's own Try again while it is shown (`active`). The host's row binds the same key only while a
 * verdict is on screen (and then marks the key handled), so the two never both act; with two takes on one
 * screen the key stays with the row (it never starts two takes at once).
 */
export function useTakeRetryKey(active: boolean, run: () => void): void {
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.code !== "KeyR") return;
      if (document.querySelectorAll("[data-take-retry]").length !== 1) return;
      e.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}

export function isMod(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return e.metaKey || e.ctrlKey;
}

/**
 * The frame every widget renders in: `role="group"` named by `label`, Enter = Check (never while disabled,
 * never with Alt, never while an IME composes), the widget's own keys, and the feedback line.
 */
export function AnswerFrame(p: FrameProps) {
  const statusId = `${p.idBase}-status`;
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.nativeEvent.isComposing) return;
    // Alt+R is the host's "Try again" (docs/design/retry.md §2.1): it reaches the keymap from inside any widget.
    if (e.altKey && e.code === "KeyR") return;
    if (p.onKey?.(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key !== "Enter" || e.altKey) return;
    if (p.enterIsNewline && !isMod(e)) return;
    const target = e.target as HTMLElement;
    // Links and the widget's own "play" buttons keep their Enter; everything else checks.
    if (target.closest("a[href], [data-enter='native']")) return;
    e.preventDefault();
    e.stopPropagation();
    if (!p.disabled) p.onSubmit();
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a styled custom control with roving focus (ux §7.9); native radios and fieldsets cannot take this layout
    <div
      role="group"
      aria-labelledby={`${p.idBase}-label`}
      aria-describedby={statusId}
      aria-busy={p.feedback.state === "pending" || undefined}
      aria-disabled={p.disabled || undefined}
      data-answer={p.kind}
      data-feedback={p.feedback.state}
      data-keyscope={p.keyscope}
      onKeyDown={onKeyDown}
      className={clsx("flex min-w-0 flex-col gap-2", p.className)}
    >
      <span id={`${p.idBase}-label`} className={p.caption ? "font-medium" : "sr-only"}>
        {p.caption ?? p.label}
      </span>
      {p.caption ? <span className="sr-only">{p.label}</span> : null}
      <FrameDisabled.Provider value={p.disabled === true}>
        {p.children}
        <FeedbackLine feedback={p.feedback} id={statusId} />
        {p.keys ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-text-3">
            {p.keys}
          </div>
        ) : null}
      </FrameDisabled.Provider>
    </div>
  );
}

/** "`1`–`7` pick" style key hints. */
export function KeyHint({ keys, children }: { keys: string[]; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <span key={`${k}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? <span aria-hidden>/</span> : null}
          <Kbd>{k}</Kbd>
        </span>
      ))}
      <span>{children}</span>
    </span>
  );
}

/** Whether the widget's frame is disabled (a checkpoint item once its answer is saved): read by the Enter hint. */
const FrameDisabled = createContext(false);

/**
 * What Enter does where the focus is, for a control that keeps its own Enter (one outside the answer widget, or a
 * widget's own play button, `data-enter="native"`): the control's label, read without its key caps ("Play again",
 * "Next item", "Back to item 2"), or null when Enter goes to the answer or the focus is on no control.
 */
export function enterActionOf(el: Element | null): string | null {
  if (!(el instanceof HTMLElement)) return null;
  if (el.closest("[data-answer]") && !el.closest("[data-enter='native']")) return null;
  const control = el.closest<HTMLElement>("button, a[href], [role='button']");
  if (!control) return null;
  const named = control.getAttribute("aria-label");
  let text = named;
  if (!text) {
    const copy = control.cloneNode(true) as HTMLElement;
    for (const k of copy.querySelectorAll("kbd, [aria-hidden='true'], .sr-only")) k.remove();
    text = copy.textContent;
  }
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? null : t.charAt(0).toLowerCase() + t.slice(1);
}

/**
 * The words after an Enter key cap. A lesson or drill says "check". A checkpoint says what Enter does for the control
 * that has focus, because Enter there is not always "save": on Play it replays (and spends one of the item's
 * limited plays), and once the answer is saved it goes to the next item. Only a plain Enter adapts; a chord such
 * as ⌘⇧↵ saves wherever the focus is.
 */
export function useEnterHint(keys: readonly string[] = ["Enter"]): string {
  const verb = useSubmitVerb();
  const disabled = useContext(FrameDisabled);
  const follows = verb === "save" && keys.length === 1 && keys[0] === "Enter";
  const [onControl, setOnControl] = useState<string | null>(null);
  useEffect(() => {
    if (!follows) return;
    // The focused control's label can change while it keeps the focus ("Play again" -> "Stop" -> "Play again"):
    // watch that control, and only it, so the hint always names what Enter does now.
    let watched: Element | null = null;
    const label = new MutationObserver(() => setOnControl(enterActionOf(document.activeElement)));
    const read = () => {
      const el = document.activeElement;
      setOnControl(enterActionOf(el));
      const control = el instanceof HTMLElement ? el.closest("button, a[href], [role='button']") : null;
      if (control === watched) return;
      label.disconnect();
      watched = control;
      if (control)
        label.observe(control, {
          subtree: true,
          childList: true,
          characterData: true,
          attributeFilter: ["aria-label"],
        });
    };
    read();
    // focusout runs before the new element has focus: read once the move is done.
    const later = () => setTimeout(read, 0);
    document.addEventListener("focusin", read);
    document.addEventListener("focusout", later);
    return () => {
      document.removeEventListener("focusin", read);
      document.removeEventListener("focusout", later);
      label.disconnect();
    };
  }, [follows]);
  if (!follows) return verb;
  return onControl ?? (disabled ? "next item" : "save");
}

/**
 * The Enter hint with the host's verb ("check", or "save" in a checkpoint: `AnswerEnv.submitVerb`, which follows
 * the focus: `useEnterHint`). Every widget names its submit key through this, so a checkpoint never says "check".
 */
export function SubmitHint({ keys = ["Enter"] }: { keys?: string[] }) {
  return <KeyHint keys={keys}>{useEnterHint(keys)}</KeyHint>;
}

/** A digit key (top row or numpad) as a number, ignoring modifiers other than Shift. */
export function digitOf(e: {
  code: string;
  key: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}): number | null {
  if (e.altKey || e.metaKey || e.ctrlKey) return null;
  const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code) ?? /^(\d)$/.exec(e.key);
  return m ? Number(m[1]) : null;
}

/** Focus the first focusable control inside `el` (the `autoFocus` prop). */
export function focusFirst(el: HTMLElement | null): void {
  el?.querySelector<HTMLElement>(
    "[data-autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex='0']",
  )?.focus();
}
