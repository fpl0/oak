// What every set-up part shares (and the onboarding screens with them, docs/design/retry.md §6.1): its props, the
// save helper (one `POST /profile/calibration` per measurement, contracts §8.6), the frame (one heading, one
// sentence saying what to do now, the body) and the footer: the kit's `ResultActions` row, with Back and "Set up
// later" at its left, "Try again" and the primary at its right, sticky to the bottom of the screen in onboarding.
import type { CalibrationRun, Profile } from "@oak/api";
import { ArrowLeft, Square } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useCalibrationRun } from "../../lib/queries.ts";
import { IS_MAC, useHotkeys } from "../../ui/keys/KeymapProvider.tsx";
import { Button } from "../../ui/kit/Button.tsx";
import { Kbd } from "../../ui/kit/basics.tsx";
import { ResultActions, type ResultActionsProps } from "../../ui/kit/ResultActions.tsx";
import { toast } from "../../ui/kit/Toast.tsx";

export type PartContext = "onboarding" | "settings" | "lesson";

/** The step before this one (onboarding), drawn as "Back: <name>" at the left of the actions. */
export interface PartBack {
  label: string;
  onBack(): void;
}

export interface PartProps {
  profile: Profile;
  context: PartContext;
  /** The part is finished (its result saved, or a path chosen that needs none). */
  onDone(): void;
  /** "Set up later": shown only where the step may be skipped. */
  onSkip?: (() => void) | undefined;
  /** Onboarding: the previous step. A part with sub-steps goes back to its own previous sub-step first. */
  back?: PartBack | null | undefined;
  /** Onboarding: the part's own sub-step changed ("2 of 3: a quiet moment"), for the progress in the header. */
  onSub?: ((sub: string | null) => void) | undefined;
}

/** "Set up later", on every skippable step and every sub-step (docs/design/retry.md §6.2). */
export const SKIP_LABEL = "Set up later";

/** Saves one calibration run; resolves the updated profile, or null after showing why it failed. */
export function useSaveRun() {
  const m = useCalibrationRun();
  return {
    pending: m.isPending,
    async save(run: CalibrationRun): Promise<Profile | null> {
      try {
        return await m.mutateAsync({ body: run });
      } catch (e) {
        toast.error("That result wasn't saved", e instanceof Error ? e.message : undefined);
        return null;
      }
    },
  };
}

/**
 * One step's frame: the heading (an `h1` in onboarding, where it is the page's title; an `h2` inside Settings and
 * a lesson), one sentence saying what to do now, then the body (explanations, the stage, the result).
 */
export function PartFrame({
  title,
  instruction,
  lead,
  children,
  testId,
  context = "settings",
}: {
  title: string;
  /** What to do now, in one sentence. */
  instruction?: ReactNode;
  /** Why, privacy lines, tips: under the instruction, never instead of it. */
  lead?: ReactNode;
  children: ReactNode;
  testId: string;
  context?: PartContext;
}) {
  const H = context === "onboarding" ? "h1" : "h2";
  return (
    <section className="flex flex-col gap-5" data-testid={testId} aria-labelledby={`${testId}-title`}>
      <header className="flex flex-col gap-1.5">
        <H
          id={`${testId}-title`}
          className={`${context === "onboarding" ? "text-h1" : "text-h2"} outline-none`}
          tabIndex={-1}
        >
          {title}
        </H>
        {instruction && (
          <p className="max-w-[60ch] font-medium text-text" data-testid="step-instruction">
            {instruction}
          </p>
        )}
        {lead && <div className="max-w-[60ch] text-text-2">{lead}</div>}
      </header>
      {children}
    </section>
  );
}

export interface PartActionsProps
  extends Pick<
    ResultActionsProps,
    | "resultKey"
    | "onRetry"
    | "retryDisabled"
    | "retryFocus"
    | "onContinue"
    | "continueDisabled"
    | "continueNote"
    | "continueLabel"
    | "line"
    | "action"
    | "shortcut"
  > {
  context: PartContext;
  back?: PartBack | null | undefined;
  /** "Set up later" (or the part's way on without the measurement); hidden while a take runs. */
  onSkip?: (() => void) | null | undefined;
  skipLabel?: string;
  skipTestId?: string;
  /**
   * A take or measurement is running: the primary place shows `label` ("Listening…", "Measuring…") and, when the
   * take can be ended early, a secondary Stop (Esc) sits at the left.
   */
  running?: { label: string; onStop?: (() => void) | null } | null;
  /** Auditions ("Hear it again"), at the left. */
  extra?: ReactNode;
  testId?: string;
}

/**
 * The footer of a set-up part or an onboarding screen: [Back] [Stop] [auditions] [Set up later] … [Try again]
 * [primary]. One green primary per state (the kit draws a held Continue as a secondary).
 */
export function PartActions({
  context,
  back,
  onSkip,
  skipLabel = SKIP_LABEL,
  skipTestId = "part-skip",
  running = null,
  extra,
  testId = "part-actions",
  action,
  retryFocus,
  onRetry,
  ...row
}: PartActionsProps) {
  const stopRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const onStop = running?.onStop ?? null;
  // One Try again per press: presses that arrive before the screen has redrawn (several in one task) are one.
  const retrying = useRef(false);
  const retry =
    onRetry === null
      ? null
      : () => {
          if (retrying.current) return;
          retrying.current = true;
          setTimeout(() => {
            retrying.current = false;
          }, 0);
          onRetry();
        };
  // A take or measurement starts: its Start button is replaced by "Listening…", which would leave the focus on
  // nothing (Enter and Tab then start from the top of the page). The step's heading takes it instead; Esc stops.
  const isRunning = running !== null;
  useEffect(() => {
    if (!isRunning) return;
    const f = requestAnimationFrame(() => {
      const a = document.activeElement;
      // The Start button the learner pressed may still hold the focus as the disabled "Listening…" in its place.
      const lost = !a || a === document.body || !a.isConnected || (a as HTMLButtonElement).disabled === true;
      if (!lost) return;
      wrapRef.current
        ?.closest("section")
        ?.querySelector<HTMLElement>("h1, h2")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(f);
  }, [isRunning]);
  useHotkeys(
    [
      {
        id: "take.stop",
        keys: "Escape",
        scope: "global",
        description: "Stop listening",
        allowInInput: true,
        when: () => onStop !== null,
        run: () => onStop?.(),
      },
    ],
    onStop !== null,
  );
  const left = (
    <>
      {back && !running && (
        <Button
          variant="ghost"
          onClick={back.onBack}
          icon={<ArrowLeft aria-hidden className="size-4" />}
          data-testid="onb-back"
        >
          Back: {back.label}
        </Button>
      )}
      {running && onStop && (
        <Button
          ref={stopRef}
          onClick={onStop}
          icon={<Square aria-hidden className="size-3.5" />}
          aria-keyshortcuts="Escape"
          data-testid="take-stop"
        >
          Stop
          <span aria-hidden className="contents">
            <Kbd>{IS_MAC ? "esc" : "Esc"}</Kbd>
          </span>
        </Button>
      )}
      {!running && extra}
      {onSkip && !running && (
        <Button variant="ghost" onClick={onSkip} data-testid={skipTestId}>
          {skipLabel}
        </Button>
      )}
    </>
  );
  const hasLeft = (back && !running) || (running && onStop) || (!running && extra) || (onSkip && !running);
  return (
    <div
      ref={wrapRef}
      className={
        context === "onboarding"
          ? "sticky bottom-0 z-10 -mb-2 border-t border-border bg-bg/95 py-3 backdrop-blur-sm"
          : "pt-1"
      }
    >
      <ResultActions
        testId={testId}
        {...row}
        onRetry={retry}
        retryFocus={retryFocus ?? (() => stopRef.current)}
        action={
          running ? (
            <Button variant="primary" loading data-testid="part-running">
              {running.label}
            </Button>
          ) : (
            action
          )
        }
      >
        {hasLeft ? left : null}
      </ResultActions>
    </div>
  );
}

/** A labelled result row ("Room noise · −58 dBFS"). */
export function ResultRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-text-2">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** The result or the problem, in one callout-sized slot directly above the footer (`role="status"` inside). */
export function StatusSlot({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 empty:hidden" data-testid="step-status">
      {children}
    </div>
  );
}
