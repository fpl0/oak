// The Brief panel (ux §2.3, 300 px in place of the Studio sidebar): the brief, the session plan, the flavour, the
// living Requirements checklist, going past the brief, Claude's review, and a quiet "Report a grading problem".
import type { CapstoneDef, CapstoneReview, CapstoneState, FlavourId } from "@oak/api";
import { clsx } from "clsx";
import { Check, Circle, Lock, Sparkles } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "../ui/kit/Button.tsx";
import { SegmentedControl } from "../ui/kit/Controls.tsx";
import { Checklist } from "./Checklist.tsx";
import type { ChecklistRow, Readiness } from "./checklist.ts";
import { FLAVOUR_TITLE } from "./content.ts";
import type { ReviewWait } from "./queries.ts";
import { ReviewAsk } from "./ReviewAsk.tsx";
import { ReviewCard } from "./ReviewCard.tsx";
import type { SessionView } from "./sessions.ts";
import type { RowExtra } from "./wave5.ts";

export interface BriefPanelProps {
  def: CapstoneDef;
  state: CapstoneState;
  views: readonly SessionView[];
  /** The session being worked in; `null` once every session is done. */
  current: SessionView | null;
  /** Lights bars on the roll and the staff (a checklist anchor, a review's bars). */
  onBars(from: number, to: number): void;
  released: boolean;
  onTryRevision?: ((i: number) => void) | undefined;
  tryPending?: boolean;
  rows: readonly ChecklistRow[];
  /** Wave 5: what a row says beyond met / not yet. */
  extras?: Readonly<Record<string, RowExtra>>;
  ready: Readiness;
  checking: boolean;
  stale: boolean;
  beyond: readonly string[];
  /** CF-A: the "Your devices so far" card, under the checklist. */
  devices?: ReactNode;
  flavour: FlavourId;
  shipping: readonly FlavourId[];
  onFlavour(f: FlavourId): void;
  flavourLocked: boolean;
  review: CapstoneReview | null;
  /** The review's timeline entry (`<conversationId>-<seq>`): its "Mark done" ticks. */
  reviewId?: string | null;
  /** The draft version the review was asked about. */
  reviewVersion?: number | null;
  /** Where the last review request stands (`useCapstoneReview`). */
  reviewWait: ReviewWait;
  canRequestReview: boolean;
  /** Oak 2.0 W4 F4: `question` is the learner's one question for the review, or `null` for none. */
  onRequestReview(question: string | null): void;
  onReport(note: string | null): Promise<void>;
}

export function BriefPanel(p: BriefPanelProps) {
  const { def } = p;
  return (
    <aside
      aria-label="Brief"
      className="flex w-[300px] shrink-0 flex-col gap-5 overflow-auto border-r border-border bg-surface px-4 py-4"
    >
      <header>
        <p className="text-sm text-text-3">Capstone</p>
        <h1 className="font-display text-h2 leading-tight">{def.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-2">{def.brief?.prompt ?? def.objective}</p>
      </header>

      <SessionList views={p.views} current={p.current} />

      <section aria-labelledby="cap-flavour">
        <h2 id="cap-flavour" className="mb-2 font-sans text-sm font-semibold text-text-2">
          Style
        </h2>
        {p.flavourLocked || p.shipping.length < 2 ? (
          <p className="text-sm">{FLAVOUR_TITLE[p.flavour]}</p>
        ) : (
          <SegmentedControl<FlavourId>
            label="Style"
            size="sm"
            value={p.flavour}
            options={p.shipping.map((f) => ({ value: f, label: FLAVOUR_TITLE[f] }))}
            onChange={p.onFlavour}
          />
        )}
      </section>

      <Checklist
        rows={p.rows}
        ready={p.ready}
        checking={p.checking}
        stale={p.stale}
        onBars={p.onBars}
        extras={p.extras ?? {}}
      />

      {p.devices}

      {p.beyond.length > 0 && (
        <div role="status" className="flex gap-2 rounded-card border border-accent/30 bg-lane-in p-3 text-sm">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <div>
            <p className="font-medium">Past the brief</p>
            <ul className="mt-0.5 text-text-2">
              {p.beyond.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="mt-1 text-text-2">Going further is welcome; nothing extra is required.</p>
          </div>
        </div>
      )}

      <ReviewSection {...p} />
      <Report onReport={p.onReport} />
    </aside>
  );
}

/** The plan with each session's state, and what this session is for (contracts §2.4 "goal"). */
export function SessionList({
  views,
  current,
}: {
  views: readonly SessionView[];
  current: SessionView | null;
}) {
  const total = views.length;
  return (
    <section aria-labelledby="cap-sessions" data-testid="session-plan">
      <h2 id="cap-sessions" className="mb-2 font-sans text-sm font-semibold text-text-2">
        Sessions
      </h2>
      <ol className="flex flex-col gap-1.5">
        {views.map((v) => {
          const now = current?.id === v.id;
          return (
            <li
              key={v.id}
              aria-current={now ? "step" : undefined}
              data-session={v.id}
              data-status={v.status}
              className={clsx("flex gap-2 rounded-control px-2 py-1 text-sm", now && "bg-lane-in")}
            >
              {v.status === "done" ? (
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              ) : v.status === "locked" && !now ? (
                <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-text-3" />
              ) : (
                <Circle
                  aria-hidden
                  className={clsx("mt-0.5 size-4 shrink-0", now ? "text-accent" : "text-text-3")}
                />
              )}
              <span className="min-w-0">
                <span className="font-mono text-text-3 tabular-nums">
                  {v.index + 1}/{total}
                </span>{" "}
                <span className={clsx(now ? "font-medium" : "text-text-2")}>{v.title}</span>
                <span className="sr-only">
                  {v.status === "done"
                    ? " (done)"
                    : now
                      ? " (now)"
                      : v.status === "locked"
                        ? " (after the one before)"
                        : ""}
                </span>
                {now && <span className="mt-0.5 block text-text-2">{v.goal}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ReviewSection(p: BriefPanelProps) {
  const r = p.review;
  return (
    <section aria-labelledby="cap-review" className="flex flex-col gap-2 border-t border-border pt-4">
      <h2 id="cap-review" className="font-sans text-sm font-semibold text-text-2">
        Claude's review
      </h2>
      {r ? (
        <div data-testid="review-summary">
          <ReviewCard
            key={p.reviewId ?? "review"}
            review={r}
            doneId={p.reviewId ?? undefined}
            heading={p.reviewVersion ? `Review of version ${p.reviewVersion}` : undefined}
            onBars={p.onBars}
            {...(p.onTryRevision ? { onTry: p.onTryRevision } : {})}
            tryPending={p.tryPending ?? false}
            headingLevel={3}
            compact
          />
          <p className="mt-2 text-sm text-text-3">
            {p.released
              ? "“Try the revision” opens a copy in the Studio; the released version stays as it is."
              : "The suggested code is in the tutor panel, as a preview until the first release."}
          </p>
        </div>
      ) : p.reviewWait.kind !== "idle" ? (
        <ReviewWaitNote wait={p.reviewWait} />
      ) : (
        <p className="text-sm text-text-2">
          A short structured review: what works, one revision to try, one question to listen for. It never
          affects pass or fail.
        </p>
      )}
      {r && p.reviewWait.kind !== "idle" ? <ReviewWaitNote wait={p.reviewWait} /> : null}
      <ReviewAsk
        disabled={!p.canRequestReview || p.reviewWait.kind === "pending"}
        onRequest={(question) => p.onRequestReview(question)}
        label={
          p.reviewWait.kind === "pending" ? "Review requested" : r ? "Ask for a new review" : "Request review"
        }
      />
      {!p.canRequestReview && (
        <p className="text-sm text-text-3">Check your track once first: the review reads that check.</p>
      )}
    </section>
  );
}

export function Report({ onReport }: { onReport(note: string | null): Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm text-text-3 underline-offset-2 hover:text-text hover:underline"
      >
        Report a grading problem
      </button>
    );
  return (
    <form
      className="flex flex-col gap-2 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onReport(note.trim() || null);
          setOpen(false);
          setNote("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="cap-report" className="font-medium">
        What looks wrong?
      </label>
      <textarea
        id="cap-report"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={2000}
        className="rounded-control border border-border bg-surface p-2"
        placeholder="For example: the snare is on 2 and 4 but the rule says it isn't."
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy}>
          Send report
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** A requested review on its way, failed, or not arrived (polling stops after `REVIEW_WAIT_MS`). */
export function ReviewWaitNote({ wait }: { wait: ReviewWait }) {
  if (wait.kind === "idle") return null;
  return (
    <p className="text-sm text-text-2" aria-live="polite" data-testid="review-wait" data-state={wait.kind}>
      {wait.kind === "pending"
        ? "Requested. It appears in the tutor panel and here when it is ready."
        : wait.kind === "failed"
          ? "The review didn't come through. The tutor panel says why; you can ask again."
          : "The review hasn't arrived. Ask again, or look in the tutor panel."}
    </p>
  );
}
