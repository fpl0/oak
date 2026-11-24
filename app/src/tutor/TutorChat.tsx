// The tutor panel's content (ux §6.1–§6.3, contracts §10): status and thread, the context chips that show exactly
// what the next turn carries, the merged timeline with live turns, the quick actions (the hint ladder, Explain my
// mistake, a listening note, a capstone or transcription review), suggested prompts and the composer. It runs the asks other
// surfaces queue (context.ts) one at a time, and is never a dead panel: when the tutor is off, closed for a
// checkpoint or a drill trial, or the server is down, it says why and what to do.
import type { SubjectRef, TutorNote } from "@oak/api";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Lightbulb, Lock, MessageSquareText, Send, Square, Stethoscope, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useHealth, useTutorRetractNote, useTutorStatus, useTutorTimeline } from "../lib/queries.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Skeleton } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import {
  askChat,
  askExplain,
  askHint,
  askReview,
  askTranscriptionReview,
  type ContextChip,
  chipRemovable,
  chipsOf,
  dismissNotice,
  isReviewKind,
  patchSubject,
  sameThread,
  setReviewRequest,
  subjectSections,
  type TutorSubject,
  takeAsk,
  toggleChip,
  useReviewRequest,
  useTutorContext,
} from "./context.ts";
import { shownSubject, usePanelView, useShownSubject, useTokenContext } from "./hooks.ts";
import { Markdown } from "./Markdown.tsx";
import type { TokenContext } from "./music-tokens.ts";
import { REVIEW_WAIT_MS, reviewPending, unansweredReviewAt } from "./review-request.ts";
import { DayDivider, dayLabel, HistoryEntry, LiveTurnView, learnerDay } from "./Timeline.tsx";
import { reasonText } from "./TutorSettings.tsx";
import { onTurns, sendTurn, settleThread, stopTurn, streamingTurn, turnsOf, useTurns } from "./turns.ts";

// --- ask runner and turn side effects --------------------------------------------------------------

/** Runs queued asks one at a time and keeps the server's facts (rung, timeline, notes) in step. */
function useTurnEffects(): void {
  const qc = useQueryClient();
  const queue = useTutorContext((s) => s.queue.length);
  const streaming = useTurns((s) => s.turns.some((t) => t.state.status === "streaming"));
  useEffect(() => {
    if (queue === 0 || streaming) return;
    const ask = takeAsk();
    if (!ask) return;
    // The thread the ask is about comes into view.
    const current = useTutorContext.getState().subject;
    const thread = ask.request.thread;
    if (thread.subjectKind === "general" && current?.thread.subjectKind !== "general")
      usePanelView.setState({ general: true, override: null });
    else if (current && sameThread(current.thread, thread))
      usePanelView.setState({ general: false, override: null });
    else
      usePanelView.setState({
        general: false,
        override: ask.subject ?? { thread, title: ask.label, tutorOpen: true },
      });
    void sendTurn(ask.request, ask.label);
  }, [queue, streaming]);

  useEffect(
    () =>
      onTurns({
        meta(turn, meta) {
          if (meta.rung !== null) {
            patchSubject(turn.thread, { rung: meta.rung });
            void qc.invalidateQueries({ queryKey: ["api", "steps.state"] });
          }
        },
        finished(turn) {
          // c9: a review request that ended before reaching the server (no meta) has nothing on the timeline to
          // wait for: its "pending" clears at once, here and on the capstone Brief.
          if (isReviewKind(turn.kind)) {
            const st = turn.state;
            setReviewRequest(
              turn.thread,
              st.status === "done" ? "answered" : st.meta === null ? "failed-early" : "failed",
              st.error?.message,
            );
          }
          void qc.invalidateQueries({ queryKey: ["api", "tutor.timeline"] });
          void qc.invalidateQueries({ queryKey: ["api", "tutor.notes"] });
          // Every turn is counted in this month's usage (reviews included); a review lands on its version.
          void qc.invalidateQueries({ queryKey: ["api", "tutor.usage"] });
          void qc.invalidateQueries({ queryKey: ["api", "tutor.status"] });
          if (turn.state.review)
            for (const name of ["capstones.get", "tutor.reviews", "album.track", "transcriptions.get"])
              void qc.invalidateQueries({ queryKey: ["api", name] });
        },
      }),
    [qc],
  );
}

// --- header ------------------------------------------------------------------------------------------

type Availability = "checking" | "ready" | "off" | "down";

function useAvailability(): Availability {
  const health = useHealth();
  const availability = useTutorContext((s) => s.availability);
  if (health.isError) return "down";
  if (availability === "unknown") return "checking";
  return availability;
}

const STATUS_LINE: Record<Availability, { text: string; dot: string }> = {
  checking: { text: "Checking…", dot: "bg-text-3" },
  ready: { text: "Claude · ready", dot: "bg-accent" },
  off: { text: "Tutor off", dot: "bg-text-3" },
  down: { text: "Oak's server is not answering", dot: "bg-issue" },
};

function ThreadSwitch({ subject }: { subject: TutorSubject | null }) {
  const view = usePanelView();
  const shown = shownSubject(subject, view);
  const main = view.override && !view.general ? view.override : subject;
  if (!main || main.thread.subjectKind === "general") return null;
  const general = shown.thread.subjectKind === "general";
  const opts = [
    { v: false, label: main.title },
    { v: true, label: "General" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Thread"
      className="flex w-full min-w-0 rounded-control border border-border p-0.5 text-xs"
    >
      {opts.map((o) => (
        // biome-ignore lint/a11y/useSemanticElements: a two-option segmented switch.
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={general === o.v}
          onClick={() => usePanelView.setState({ general: o.v })}
          data-thread={o.v ? "general" : "subject"}
          className={clsx(
            "min-w-0 truncate rounded-[calc(var(--radius-control)-2px)] px-2 py-1",
            general === o.v ? "bg-surface-2 font-medium text-text" : "text-text-2 hover:text-text",
            o.v ? "shrink-0" : "flex-1 text-left",
          )}
          title={o.label}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TutorStatusLine() {
  const a = useAvailability();
  const line = STATUS_LINE[a];
  return (
    <span
      className="flex min-w-0 items-center gap-1.5 text-sm whitespace-nowrap text-text-2"
      data-testid="tutor-status"
      data-state={a}
    >
      <span aria-hidden className={clsx("size-2 rounded-full", line.dot)} />
      {line.text}
    </span>
  );
}

// --- chips -------------------------------------------------------------------------------------------

const CHIP_SEES: Record<ContextChip["id"], string> = {
  step: "Which lesson and step you are on. The server adds the prompt, never an answer you have not reached.",
  code: "The code in your editor now.",
  answer:
    "Your answer as you gave it: the notes or chords you placed, the numerals or choices you picked, how close each sung note was, the code you wrote by ear, or your transcription with Oak's bar-by-bar check. Never the expected answer or the hidden source.",
  key: "The key the music on screen is in, so degrees and numerals mean the same to Claude as to you.",
  labels:
    "Which note labels you see (degrees, solfège, note names), so Claude names notes the way you read them.",
  result: "Oak's last check of this step, held back to what your hints have opened.",
  hints: "How many hints are open. Claude says no more than they allow.",
  selection: "The code you selected, added under your message.",
  sketch: "This sketch: its title and code.",
  capstone: "This capstone's brief and your code.",
  track: "This album track and its code.",
  transcription: "This transcription's code and checklist.",
  form: "The sections of the music on screen and their bars, named as the section ribbon names them.",
  song: "The song this lesson builds: its title, its style, what you already play in it and today's line.",
};

function Chips({ subject }: { subject: TutorSubject }) {
  const excluded = useTutorContext((s) => s.excluded);
  const lenses = useTutorContext((s) => s.lenses);
  const chips = chipsOf(subject, lenses);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (chips.length === 0 && subject.thread.subjectKind !== "transcription") return null;
  return (
    <div className="border-b border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-3">Claude will see</p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-link underline-offset-2 hover:underline"
        >
          {open ? "Hide details" : "What Claude sees"}
        </button>
      </div>
      <ul
        className="mt-1.5 flex flex-wrap gap-1.5"
        aria-label="Context sent with your next message"
        data-testid="context-chips"
      >
        {chips.map((c) => {
          const off = excluded.includes(c.id);
          const removable = chipRemovable(c.id);
          return (
            <li key={c.id}>
              {removable ? (
                <button
                  type="button"
                  aria-pressed={!off}
                  onClick={() => toggleChip(c.id)}
                  data-chip={c.id}
                  aria-label={`${c.label}: ${off ? "not sent. Include it" : "sent. Leave it out"}`}
                  className={clsx(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs whitespace-nowrap",
                    off
                      ? "border-dashed border-border text-text-3 line-through"
                      : "border-accent/40 bg-lane-in text-text hover:bg-surface-2",
                  )}
                >
                  {c.label}
                  {!off && <X aria-hidden className="size-3 text-text-3" />}
                </button>
              ) : (
                <span
                  data-chip={c.id}
                  className="inline-flex h-6 items-center rounded-full border border-border bg-surface-2 px-2 text-xs whitespace-nowrap text-text-2"
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
        {subject.thread.subjectKind === "transcription" && (
          <li>
            <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border px-2 text-xs text-text-2">
              <Lock aria-hidden className="size-3" /> Audio never sent
            </span>
          </li>
        )}
      </ul>
      {open && (
        <dl id={id} className="mt-2 flex flex-col gap-1 text-xs text-text-2">
          {chips.map((c) => (
            <div key={c.id}>
              <dt className="inline font-medium text-text">{c.label}: </dt>
              <dd className="inline">
                {excluded.includes(c.id) ? "left out of your next message." : CHIP_SEES[c.id]}
              </dd>
            </div>
          ))}
          <div>
            <dt className="inline font-medium text-text">Never: </dt>
            <dd className="inline">your audio, your voice or your files.</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

// --- notes -------------------------------------------------------------------------------------------

function Notes({ notes, thread, ctx }: { notes: TutorNote[]; thread: SubjectRef; ctx: TokenContext }) {
  const retract = useTutorRetractNote();
  const live = notes.filter((n) => !n.retractedAt).slice(0, 5);
  if (live.length === 0) return null;
  return (
    <section
      aria-label="Notes Claude keeps"
      className="flex flex-col gap-1.5 rounded-card border border-border p-2.5"
    >
      <h3 className="font-sans text-xs font-semibold text-text-3">Notes Claude keeps on this</h3>
      <ul className="flex flex-col gap-1.5">
        {live.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-2 text-sm">
            {/* Notes carry the same music tokens as answers ([[deg:1]], [[bars:3]]): drawn as chips, never raw. */}
            <div className="min-w-0 flex-1">
              <Markdown text={`Noted: ${n.text}`} thread={thread} ctx={ctx} />
            </div>
            <Button
              size="sm"
              variant="ghost"
              loading={retract.isPending && retract.variables?.params.id === n.id}
              onClick={() =>
                retract.mutate(
                  { params: { id: n.id } },
                  { onError: (e) => toast.error("The note was not removed", e.message) },
                )
              }
              aria-label={`Remove note: ${n.text}`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- quick actions and prompts ------------------------------------------------------------------------

/** The three suggested prompts for the state (ux §6.3). */
export function suggestedPrompts(s: TutorSubject): string[] {
  const failed = s.lastResult && s.lastResult.status !== "pass" && s.lastResult.status !== "ungraded";
  if (s.thread.subjectKind === "drill") return ["How do I hear 6 against 4?", "A memory hook for ♭7?"];
  if (s.thread.subjectKind === "transcription")
    return ["Does this chord fit the bass?", "What form is this?", "Where should I listen next?"];
  // Wave 5: a song in sections asks about its form; the Wave 5 capstones about what their briefs grade.
  const sectioned = subjectSections(s).length > 0;
  const id = s.thread.subjectId;
  if (s.thread.subjectKind === "capstone" && (id === "C3" || id === "C4"))
    return [
      "Does my chorus contrast enough with the verse?",
      "Where could the energy rise?",
      "Is my bass locked to the kick?",
    ];
  if (s.thread.subjectKind === "capstone" && id === "C5")
    return [
      "Does my turnaround lead back to bar 1?",
      "Is my shuffle swinging?",
      "How could my riff answer itself?",
    ];
  if (s.thread.subjectKind === "capstone" && id === "X2")
    return [
      "What should I listen for in the bass?",
      "How do I hear where the chords change?",
      "Where should I listen next?",
    ];
  if ((s.thread.subjectKind === "sketch" || s.thread.subjectKind === "track") && sectioned)
    return [
      "Does my chorus contrast enough with the verse?",
      "Where could the energy rise?",
      "Help me add a bridge",
    ];
  if (s.thread.subjectKind === "sketch" || s.thread.subjectKind === "track")
    return ["What's this progression called?", "How could this swing?", "Help me add a bass line"];
  if (s.thread.subjectKind === "capstone")
    return [
      "Is my melody too jumpy?",
      "Suggest a stronger ending",
      "What would make bar 4 more interesting?",
    ];
  if (s.graded && !s.passed && failed) {
    const bar = s.lastResult?.diagnostics.find((d) => d.where?.bar)?.where?.bar;
    return [
      bar ? `What's different in bar ${bar}?` : "Where should I look first?",
      "Why does this sound off?",
    ];
  }
  if (s.lessonId && s.graded === false)
    return ["Why does 7 pull to 1?", "Play me this idea in minor", "How would a jazz player use this?"];
  if (s.passed) return ["Why does this work?", "What could I try next?"];
  return ["What is a scale degree?", "Why does n start at 0?", "What should I practise today?"];
}

function QuickActions({ subject, disabled }: { subject: TutorSubject; disabled: boolean }) {
  const rung = subject.rung ?? 0;
  // c9: "Request review" follows the same pending state as the capstone Brief: this browser's request, and the
  // server's timeline (a review asked from the Brief, or from another tab, that has not come back yet).
  const reviewable =
    subject.thread.subjectKind === "capstone" || subject.thread.subjectKind === "transcription";
  const request = useReviewRequest(reviewable ? subject.thread : null);
  const timeline = useTutorTimeline(reviewable ? subject.thread : null);
  const entries = timeline.data?.entries ?? [];
  const waiting = reviewable && reviewPending(request, entries, Date.now());
  // A review asked elsewhere that never comes back stops holding the button after the Brief's wait.
  const askedAt = waiting ? unansweredReviewAt(entries) : null;
  const [, tick] = useState(0);
  useEffect(() => {
    if (askedAt === null) return;
    const t = setTimeout(() => tick((x) => x + 1), Math.max(0, askedAt + REVIEW_WAIT_MS - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [askedAt]);
  const failed =
    subject.lastResult && (subject.lastResult.status === "fail" || subject.lastResult.status === "error");
  const hintable = subject.thread.subjectKind === "lesson" && subject.graded === true && !subject.passed;
  const actions: {
    key: string;
    icon: ReactNode;
    label: string;
    cost?: string;
    /** A review on its way: the button stays disabled until it is answered or fails. */
    waiting?: boolean;
    run(): void;
  }[] = [];
  if (hintable) {
    const next = Math.min(3, rung + 1);
    actions.push({
      key: "hint",
      icon: <Lightbulb aria-hidden className="size-3.5" />,
      label: rung >= 3 ? "Hint 3 again" : `Hint ${next} of 4`,
      cost:
        rung >= 3
          ? "Hint 3 is open; asking again stays at 3. The answer is the lesson's hint 4."
          : `Opens hint ${next} of 4 on this step.`,
      run: () => void askHint(),
    });
    if (failed)
      actions.push({
        key: "explain",
        icon: <Stethoscope aria-hidden className="size-3.5" />,
        label: "Explain my mistake",
        cost:
          rung >= 3
            ? "Explain my mistake counts as a hint too."
            : `Counts as a hint: opens hint ${Math.min(3, rung + 1)} of 4.`,
        run: () => void askExplain(),
      });
  }
  if (subject.thread.subjectKind === "capstone" && subject.capstoneId)
    actions.push({
      key: "review",
      icon: <MessageSquareText aria-hidden className="size-3.5" />,
      label: waiting ? "Review requested" : "Request review",
      waiting,
      cost: waiting
        ? "Claude is writing the review. It appears here and in the Brief."
        : "Reviews your last saved draft. It never affects pass or fail.",
      run: () =>
        void askReview({
          capstoneId: subject.capstoneId as string,
          title: subject.title,
          code: subject.code ?? "",
          ...(subject.albumTrackId !== undefined && subject.albumVersion !== undefined
            ? { albumTrackId: subject.albumTrackId, albumVersion: subject.albumVersion }
            : {}),
        }),
    });
  if (subject.thread.subjectKind === "transcription" && subject.code)
    actions.push({
      key: "review-transcription",
      icon: <MessageSquareText aria-hidden className="size-3.5" />,
      label: waiting ? "Review requested" : "Request review",
      waiting,
      cost: waiting
        ? "Claude is writing the review. It appears here when it is done."
        : "Reviews your saved transcription from its code and checklist, never audio. It never affects pass or fail.",
      run: () =>
        void askTranscriptionReview({
          projectId: subject.thread.subjectId,
          title: subject.title,
          code: subject.code as string,
          ...(subject.transcriptionVersion !== undefined ? { version: subject.transcriptionVersion } : {}),
        }),
    });
  if (actions.length === 0) return null;
  const captions = [...new Set(actions.map((a) => a.cost).filter(Boolean))] as string[];
  const hintCaption =
    hintable && failed && rung < 3
      ? `Either one opens hint ${Math.min(3, rung + 1)} of 4 on this step.`
      : null;
  return (
    <div className="flex flex-col gap-1" data-testid="quick-actions">
      <ul className="flex flex-wrap gap-1.5" aria-label="Ask Claude">
        {actions.map((a) => (
          <li key={a.key}>
            <Button
              size="sm"
              icon={a.icon}
              disabled={disabled || a.waiting === true}
              onClick={a.run}
              data-action={a.key}
              data-waiting={a.waiting ? "" : undefined}
            >
              {a.label}
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-3">{hintCaption ?? captions.join(" ")}</p>
    </div>
  );
}

// --- composer ----------------------------------------------------------------------------------------

const draftRef: { text: string; last: string } = { text: "", last: "" };

function Composer({
  subject,
  disabled,
  why,
  streaming,
  inputRef,
  draft,
  setDraft,
}: {
  subject: TutorSubject;
  disabled: boolean;
  why: string | null;
  streaming: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  draft: string;
  setDraft(v: string): void;
}) {
  const id = useId();
  const send = () => {
    const text = draft.trim();
    if (!text || disabled || streaming) return;
    const r = askChat(text, subject);
    if (r.ok) {
      draftRef.last = text;
      setDraft("");
    }
  };
  return (
    <form
      className="flex flex-col gap-1.5 border-t border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Message Claude
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={id}
          ref={inputRef}
          rows={2}
          value={draft}
          disabled={disabled}
          data-testid="composer"
          placeholder={disabled ? (why ?? "") : "Ask about this step, your code, or the music"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            } else if (e.key === "Escape" && streaming) {
              e.preventDefault();
              e.stopPropagation();
              stopTurn();
            } else if (e.key === "ArrowUp" && !draft && draftRef.last) {
              e.preventDefault();
              setDraft(draftRef.last);
            }
          }}
          className="max-h-40 min-h-[2.75rem] min-w-0 flex-1 resize-y rounded-control border border-border bg-bg px-2.5 py-2 text-sm placeholder:text-text-3 disabled:opacity-60"
        />
        {streaming ? (
          <Button
            type="button"
            size="md"
            variant="secondary"
            icon={<Square aria-hidden className="size-3.5" />}
            onClick={() => stopTurn()}
            aria-keyshortcuts="Escape"
          >
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            size="md"
            variant="primary"
            icon={<Send aria-hidden className="size-3.5" />}
            disabled={disabled || !draft.trim()}
          >
            Send
          </Button>
        )}
      </div>
      <p className="text-xs text-text-3">
        {streaming ? "Esc stops Claude." : "Enter sends · Shift+Enter for a new line · ↑ recalls"}
      </p>
    </form>
  );
}

// --- off and closed ----------------------------------------------------------------------------------

function OffGuidance({ down }: { down: boolean }) {
  const status = useTutorStatus();
  const health = useHealth();
  const offReason = useTutorContext((s) => s.offReason);
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const recheck = async () => {
    setChecking(true);
    try {
      await qc.fetchQuery({
        queryKey: ["api", "tutor.status", { query: { refresh: "1" } }],
        queryFn: async () =>
          (await import("../lib/api.ts")).callApi("tutor.status", { query: { refresh: "1" } }),
      });
      await Promise.all([health.refetch(), status.refetch()]);
    } finally {
      setChecking(false);
    }
  };
  const s = status.data;
  const signedOut = s?.backends.find((b) => b.id === "claude-cli" && b.reason === "not_logged_in");
  const title = down
    ? "Oak's server is not answering"
    : s?.setting === "off"
      ? "The tutor is turned off"
      : signedOut && s?.setting !== "anthropic-api"
        ? "Claude is not signed in"
        : "The tutor is off";
  const body = down
    ? "Start Oak again with `bun run start`. Your work is saved."
    : (s?.guidance ??
      reasonText(s?.reason ?? null) ??
      (offReason === "unreachable" ? "Claude could not be reached right now." : null));
  return (
    <Callout
      tone="info"
      title={title}
      actions={
        <>
          <Button size="sm" loading={checking} onClick={recheck}>
            Check again
          </Button>
          <Link
            to="/settings/tutor"
            className="text-sm font-medium text-link underline-offset-2 hover:underline"
          >
            Settings › Tutor
          </Link>
        </>
      }
    >
      <span data-testid="tutor-off">
        {body && <span className="block">{body}</span>}
        {!/without the tutor/i.test(body ?? "") && (
          <span className="block">Lessons, hints and grading all work without the tutor.</span>
        )}
      </span>
    </Callout>
  );
}

function closedCopy(subject: TutorSubject, reason: string | null): string {
  if (reason) return reason;
  if (subject.thread.subjectKind === "checkpoint")
    return "Checkpoint in progress. Claude reviews it with you afterwards.";
  if (subject.thread.subjectKind === "drill")
    return "The tutor is off during drill trials. It opens again between sets.";
  return "The tutor is closed here. It opens again afterwards.";
}

// --- the panel ---------------------------------------------------------------------------------------

function ThreadBody({
  subject,
  off,
  ctx,
  onRephrase,
  closedReasonOut,
}: {
  subject: TutorSubject;
  off: boolean;
  ctx: TokenContext;
  onRephrase(text: string): void;
  closedReasonOut(reason: string | null, open: boolean): void;
}) {
  const thread: SubjectRef = subject.thread;
  const timeline = useTutorTimeline(subject.tutorOpen ? thread : null);
  const allTurns = useTurns((s) => s.turns);
  const turns = turnsOf(allTurns, thread);
  const updatedAt = timeline.dataUpdatedAt;
  useEffect(() => {
    if (updatedAt) settleThread(thread, updatedAt);
  }, [updatedAt, thread]);
  const tl = timeline.data;
  useEffect(() => {
    closedReasonOut(tl ? tl.closedReason : null, tl ? tl.tutorOpen : true);
  }, [tl, closedReasonOut]);

  const today = learnerDay(Date.now());
  const entries = tl?.entries ?? [];
  const lastAssistant = [...entries].reverse().find((e) => e.role === "assistant");
  // History and live turns merged by time: a failed live turn stays where it happened, newer turns come after.
  type Row = { at: number; day: string; node: ReactNode };
  const rows: Row[] = [];
  for (const e of entries) {
    const revealAllowed =
      e === lastAssistant && turns.length === 0 && !!e.stepId && e.stepId === subject.stepId;
    rows.push({
      at: Date.parse(e.at),
      day: learnerDay(e.at),
      node: (
        <HistoryEntry
          key={`${e.conversationId}-${e.seq}`}
          entry={e}
          cards={tl?.cards ?? []}
          subject={subject}
          ctx={ctx}
          revealAllowed={revealAllowed}
        />
      ),
    });
  }
  for (const t of turns)
    rows.push({
      at: t.startedAt,
      day: learnerDay(t.startedAt),
      node: (
        <LiveTurnView key={`live-${t.id}`} turn={t} subject={subject} ctx={ctx} onRephrase={onRephrase} />
      ),
    });
  rows.sort((a, b) => a.at - b.at);
  const items: ReactNode[] = [];
  let day = "";
  for (const r of rows) {
    if (r.day !== day) {
      day = r.day;
      items.push(<DayDivider key={`d-${r.day}`} label={dayLabel(r.day, today)} />);
    }
    items.push(r.node);
  }

  if (timeline.isPending && subject.tutorOpen && turns.length === 0)
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Loading the conversation">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  return (
    <>
      {tl && <Notes notes={tl.notes} thread={thread} ctx={ctx} />}
      {timeline.isError && (
        <p className="text-sm text-text-3">Earlier messages could not be loaded. New ones still work.</p>
      )}
      {items.length === 0 && subject.tutorOpen && !off && (
        <div className="flex flex-col gap-1 py-4 text-sm text-text-2" data-testid="tutor-empty">
          <p className="font-medium text-text">Nothing here yet.</p>
          <p>
            {subject.thread.subjectKind === "general"
              ? "Ask anything about music or Oak. Claude answers with degrees first, and never decides pass or fail."
              : `Ask about ${subject.title}. Claude sees what the chips above show, and nothing else.`}
          </p>
        </div>
      )}
      {items}
    </>
  );
}

export interface TutorChatProps {
  /** The panel's own chrome (collapse button) for the header. */
  headerEnd?: ReactNode;
  /** In the drawer the drawer has its own title row. */
  variant?: "docked" | "drawer";
}

let seenFocus = 0;

export function TutorChat({ headerEnd, variant = "docked" }: TutorChatProps) {
  useTurnEffects();
  const subject = useShownSubject();
  const realSubject = useTutorContext((s) => s.subject);
  const notice = useTutorContext((s) => s.notice);
  const focusRequests = useTutorContext((s) => s.focusRequests);
  const availability = useAvailability();
  const ctx = useTokenContext();
  const streaming = useTurns((s) => s.turns.some((t) => t.state.status === "streaming"));
  const [closed, setClosed] = useState<{ reason: string | null; open: boolean }>({
    reason: null,
    open: true,
  });
  const [draft, setDraft] = useState(draftRef.text);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const lastTurn = useTurns((s) => s.turns.at(-1));
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    draftRef.text = draft;
  }, [draft]);

  // Mod+I and "Ask Claude" land in the composer.
  useEffect(() => {
    if (focusRequests === seenFocus) return;
    seenFocus = focusRequests;
    // No cleanup: a StrictMode re-run must not cancel the one focus this request asked for.
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [focusRequests]);

  // Follow the conversation while the learner is at the bottom.
  const textLen = lastTurn
    ? lastTurn.state.text.length + lastTurn.state.cards.length + lastTurn.state.tools.length
    : 0;
  useEffect(() => {
    const el = scroller.current;
    if (!el || textLen === 0) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [textLen]);

  // One polite announcement per turn: when it starts, and its whole text when it ends.
  const lastStatus = lastTurn?.state.status;
  const lastId = lastTurn?.id;
  useEffect(() => {
    const t = useTurns.getState().turns.find((x) => x.id === lastId);
    if (!t) return;
    if (t.state.status === "streaming") setAnnounce("Claude is answering.");
    else if (t.state.status === "done")
      setAnnounce(
        t.state.text ? `Claude: ${t.state.text.replace(/\[\[[^\]]*\]\]/g, "")}` : "Claude is done.",
      );
    else if (t.state.status === "error") setAnnounce(t.state.error?.message ?? "The tutor stopped.");
  }, [lastStatus, lastId]);

  const closedHere = !subject.tutorOpen || !closed.open;
  const off = availability === "off" || availability === "down";
  const composerDisabled = off || closedHere || availability === "checking";
  const why = off ? "The tutor is off" : closedHere ? "The tutor is closed here" : null;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="tutor-chat">
      <div
        className={clsx(
          "flex flex-col gap-1.5 border-b border-border px-3",
          variant === "docked" ? "py-2" : "pb-2",
        )}
      >
        <div className="flex min-h-8 items-center justify-between gap-2">
          <TutorStatusLine />
          {headerEnd}
        </div>
        <ThreadSwitch subject={realSubject} />
      </div>
      {!off && !closedHere && <Chips subject={subject} />}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-3" data-testid="tutor-timeline">
        <div className="flex flex-col gap-3">
          {notice && (
            <Callout tone="attention" title={notice.message} onDismiss={dismissNotice}>
              {notice.kind === "off" ? "Lessons, hints and grading all work without it." : null}
            </Callout>
          )}
          {off && <OffGuidance down={availability === "down"} />}
          {closedHere && (
            <Callout tone="info" title="The tutor is resting">
              <span data-testid="tutor-closed">{closedCopy(subject, closed.reason)}</span>
            </Callout>
          )}
          {availability === "checking" ? (
            <div className="flex flex-col gap-2" role="status" aria-label="Checking the tutor">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            (!closedHere || subject.thread.subjectKind !== "checkpoint") && (
              <ThreadBody
                key={`${subject.thread.subjectKind}:${subject.thread.subjectId}`}
                subject={subject}
                off={off}
                ctx={ctx}
                onRephrase={(t) => {
                  setDraft(t);
                  inputRef.current?.focus();
                }}
                closedReasonOut={(reason, open) =>
                  setClosed((c) => (c.reason === reason && c.open === open ? c : { reason, open }))
                }
              />
            )
          )}
        </div>
      </div>
      {!composerDisabled && (
        <div className="flex flex-col gap-2 border-t border-border px-3 pt-2">
          <QuickActions subject={subject} disabled={streaming} />
          <ul className="flex flex-wrap gap-1.5" aria-label="Suggested questions" data-testid="suggested">
            {suggestedPrompts(subject).map((p) => (
              <li key={p}>
                <button
                  type="button"
                  disabled={streaming}
                  onClick={() => void askChat(p, subject)}
                  className="h-7 rounded-full border border-border px-2.5 text-xs text-text-2 hover:bg-surface-2 hover:text-text disabled:opacity-50"
                >
                  {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Composer
        subject={subject}
        disabled={composerDisabled}
        why={why}
        streaming={streaming}
        inputRef={inputRef}
        draft={draft}
        setDraft={setDraft}
      />
      <p className="sr-only" aria-live="polite" data-testid="tutor-live">
        {announce}
      </p>
    </div>
  );
}

export { streamingTurn };
