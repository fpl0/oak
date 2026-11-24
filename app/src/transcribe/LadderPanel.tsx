// A generated ladder item beside the Workbench (contracts §2.9, §6.12): what is given, what to write, L3's
// stages bass first, Check (graded exactly on the server, `ladder.submit`) with the result bar by bar, and —
// once solved or asked for — the source's roll and staff. The hidden code never reaches this page.
import type { LadderSubmitResult, TranscriptionDetail } from "@oak/api";
import { OakApiError } from "@oak/api";
import type { MeterId } from "@oak/content-kit";
import { useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Check, CircleCheck, Eye, Lock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatKey } from "../lib/format.ts";
import { idempotencyKey } from "../lib/idempotency.ts";
import { useLadderNext, useLadderSubmit } from "../lib/queries.ts";
import { PRACTICE_LINE } from "../lib/retry.ts";
import { currentSessionId } from "../session/store.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Card, Chip } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { ResultActions } from "../ui/kit/ResultActions.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import {
  checkLines,
  currentStage,
  type Given,
  givenChips,
  type LadderLevel,
  type LadderStage,
  LEVEL_TASK,
  LEVEL_TITLE,
  lineText,
  REALISM_TEXT,
  STAGE_LABEL,
  STAGE_NOUN,
  STAGE_TASK,
  type StageMarks,
  stageStatus,
  verdictText,
} from "./ladder.ts";
import { ReferenceRoll, ReferenceStaff } from "./ReferenceView.tsx";

interface ItemMarks {
  stages: StageMarks;
  revealed: boolean;
  solved: boolean;
}
const KEY = (id: string) => `oak.transcribe.item.${id}`;
function readMarks(id: string): ItemMarks {
  try {
    const raw = localStorage.getItem(KEY(id));
    if (raw)
      return { stages: {}, revealed: false, solved: false, ...(JSON.parse(raw) as Partial<ItemMarks>) };
  } catch {
    // storage blocked: start fresh
  }
  return { stages: {}, revealed: false, solved: false };
}
function writeMarks(id: string, m: ItemMarks): void {
  try {
    localStorage.setItem(KEY(id), JSON.stringify(m));
  } catch {
    // the marks are a convenience; the server keeps the graded versions
  }
}

export const L3_STAGES: readonly LadderStage[] = ["bass", "quality", "rn"];

export function givenOfProject(p: TranscriptionDetail): Given {
  return {
    bpm: p.bpm ?? Math.round((p.stimulus?.cps ?? 0.4) * 60 * 4),
    meter: (p.meter ?? "4/4") as MeterId,
    key: p.key,
    pickupBeats: null,
    bars: p.stimulus?.bars ?? 2,
  };
}

export function LadderPanel({
  project,
  given,
  getCode,
  onResult,
}: {
  project: TranscriptionDetail;
  given: Given;
  /** The editor's code now. */
  getCode(): string;
  onResult(r: LadderSubmitResult | null): void;
}) {
  const level = (project.ladderLevel ?? 1) as LadderLevel;
  const stages = level === 3 ? L3_STAGES : null;
  const [marks, setMarksState] = useState<ItemMarks>(() => readMarks(project.id));
  /** The verdict on screen; `practice` when it was checked after the item was already solved. */
  const [last, setLast] = useState<{
    r: LadderSubmitResult;
    stage: LadderStage | null;
    practice: boolean;
    n: number;
  } | null>(null);
  // A check's verdict can land below the fold of the right column: bring it into view when a check returns.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (last) resultRef.current?.scrollIntoView({ block: "nearest" });
  }, [last]);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const submit = useLadderSubmit();
  const next = useLadderNext();
  const navigate = useNavigate();
  /** A passed L3 stage the learner chose to try again (practice: it stays passed). */
  const [again, setAgain] = useState<LadderStage | null>(null);
  const open = currentStage(stages, marks.stages);
  const done = marks.solved || (stages !== null && open === null);
  const stage = again ?? open;
  const setMarks = (m: ItemMarks) => {
    setMarksState(m);
    writeMarks(project.id, m);
  };

  const check = async () => {
    try {
      const r = await submit.mutateAsync({
        params: { id: project.id },
        body: {
          sessionId: currentSessionId(),
          code: getCode(),
          ...(stage ? { stage } : {}),
          rung: marks.revealed ? 4 : 0,
          idempotencyKey: idempotencyKey(),
        },
      });
      const practice = done || (stage !== null && marks.stages[stage] === "passed");
      setLast({ r, stage, practice, n: (last?.n ?? 0) + 1 });
      setAgain(null);
      onResult(r);
      if (r.passed && !practice) {
        const stagesNext = stage ? { ...marks.stages, [stage]: "passed" as const } : marks.stages;
        const allDone = stages === null || currentStage(stages, stagesNext) === null;
        setMarks({ ...marks, stages: stagesNext, solved: allDone });
      }
    } catch (e) {
      const msg =
        e instanceof OakApiError && e.code === "not_implemented"
          ? "Checking ladder items isn't available on this server yet."
          : e instanceof Error
            ? e.message
            : String(e);
      toast.error("Couldn't check it", msg);
    }
  };

  /**
   * Showing the answer is a hint at rung 4 (contracts §5.3): it is recorded on the server as a revealed check of
   * the current code, so the next L3 stage opens and the item can no longer count as a graded pass.
   */
  const reveal = async () => {
    setConfirmReveal(false);
    try {
      const r = await submit.mutateAsync({
        params: { id: project.id },
        body: {
          sessionId: currentSessionId(),
          code: getCode(),
          ...(stage ? { stage } : {}),
          rung: 4,
          idempotencyKey: idempotencyKey(),
        },
      });
      onResult(r);
    } catch (e) {
      toast.error("Couldn't show it", e instanceof Error ? e.message : undefined);
      return;
    }
    setLast(null);
    setMarks({
      ...marks,
      revealed: true,
      stages: stage ? { ...marks.stages, [stage]: "revealed" } : marks.stages,
    });
  };

  /** Try again (docs/design/retry.md §3.6): the verdict goes, the editor gets the cursor, Check is back. */
  const tryAgain = () => {
    if (last?.r.passed && last.stage !== null && !done) setAgain(last.stage);
    setLast(null);
    onResult(null);
  };

  const nextItem = async () => {
    try {
      const item = await next.mutateAsync({
        body: { sessionId: currentSessionId(), gymId: project.gymId ?? null, level },
      });
      void navigate({ to: "/transcribe/$projectId", params: { projectId: item.itemId } });
    } catch (e) {
      toast.error("Couldn't make the next item", e instanceof Error ? e.message : undefined);
    }
  };

  const lines = last ? checkLines(last.r.result) : [];
  const showRef = (done || marks.revealed) && project.stimulus !== null;
  // A revealed bass stage shows the bass only: the chords stay to be heard.
  const chordsHidden =
    !done && stages !== null && marks.stages.quality === undefined && marks.stages.rn === undefined;
  const refEvents = useMemo(
    () => (project.stimulus?.events ?? []).filter((e) => !chordsHidden || e.track === "bass"),
    [project.stimulus, chordsHidden],
  );

  return (
    <div className="flex flex-col gap-3" data-testid="ladder-panel">
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-h3">
              Level {level} · {LEVEL_TITLE[level]}
            </h2>
            <p className="mt-0.5 text-sm text-text-2">{LEVEL_TASK[level]}</p>
          </div>
          {done ? (
            <Chip tone="accent" data-testid="solved">
              <CircleCheck aria-hidden className="size-3.5" /> Solved
            </Chip>
          ) : null}
        </div>
        <ul className="flex flex-wrap gap-1" aria-label="Given" data-testid="given">
          {givenChips(given).map((c) => (
            <li key={c}>
              <Chip>{c}</Chip>
            </li>
          ))}
        </ul>
        <p className="text-sm text-text-3">{REALISM_TEXT[project.realism ?? 0]}</p>
      </Card>

      {stages ? (
        <Card className="p-4">
          <h3 className="mb-2 font-sans text-sm font-semibold text-text-2">Bass first, then the chords</h3>
          <ol className="flex flex-col gap-1.5" data-testid="stages">
            {stageStatus(stages, marks.stages).map((s, i) => (
              <li
                key={s.stage}
                className={clsx("flex items-center gap-2 text-sm", s.status === "locked" && "text-text-3")}
                data-status={s.status}
              >
                <span
                  className={clsx(
                    "inline-flex size-5 items-center justify-center rounded-full border text-[0.75rem]",
                    s.status === "passed"
                      ? "border-accent bg-accent text-on-accent"
                      : s.status === "open"
                        ? "border-accent text-accent"
                        : "border-border",
                  )}
                  aria-hidden
                >
                  {s.status === "passed" ? (
                    <Check className="size-3" />
                  ) : s.status === "locked" ? (
                    <Lock className="size-3" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={clsx(s.status === "open" && "font-medium text-text")}>
                  {STAGE_LABEL[s.stage]}
                </span>
                <span className="sr-only">
                  {s.status === "passed" ? "passed" : s.status === "revealed" ? "shown" : s.status}
                </span>
                {s.status === "revealed" ? <Chip>shown</Chip> : null}
              </li>
            ))}
          </ol>
          {stage ? <p className="mt-2 text-sm text-text-2">{STAGE_TASK[stage]}</p> : null}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2 p-4" aria-live="polite">
        {/* The verdict first, then what to do about it (as a drill's feedback reads). */}
        {last ? (
          <div data-testid="check-result" ref={resultRef}>
            <p className={clsx("text-sm", last.r.passed ? "text-text" : "text-text")} data-testid="verdict">
              {last.r.passed ? <CircleCheck aria-hidden className="mr-1 inline size-4 text-accent" /> : null}
              {verdictText(last.r, last.stage)}
            </p>
            {!last.r.passed && lines.length > 0 ? (
              <ul className="mt-1.5 flex flex-col gap-1 text-sm text-text-2" data-testid="check-lines">
                {lines.map((l) => (
                  <li key={lineText(l)}>{lineText(l)}</li>
                ))}
              </ul>
            ) : null}
            {last.r.passed && !last.r.gradedPass && marks.revealed ? (
              <p className="mt-1 text-sm text-text-3">Shown before it passed, so it isn't a graded pass.</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-text-3">
            Loop a bar, switch with V between the source and yours, then Check. The source's notes stay hidden
            until you've got it.
          </p>
        )}
        <ResultActions
          resultKey={last ? last.n : null}
          onRetry={last ? tryAgain : null}
          retryFocus={() => document.querySelector<HTMLElement>(".cm-content")}
          onContinue={done ? () => void nextItem() : null}
          continueDisabled={next.isPending}
          continueLabel="Next item"
          continueTestId="next-item"
          line={last?.practice ? PRACTICE_LINE : null}
          testId="ladder-actions"
          // After a failed check the answer is changed through Try again (as in a lesson); after a passed stage the
          // next stage's Check is open beside it.
          action={
            last === null || (last.r.passed && !done) ? (
              <Button
                variant={done && again === null ? "secondary" : "primary"}
                loading={submit.isPending}
                onClick={() => void check()}
                data-testid="check"
              >
                {stage ? `Check the ${STAGE_NOUN[stage]}` : "Check"}
              </Button>
            ) : null
          }
        >
          {done || again !== null || (marks.revealed && !stage) ? null : (
            <Button
              variant="ghost"
              icon={<Eye aria-hidden className="size-4" />}
              onClick={() => setConfirmReveal(true)}
              data-testid="reveal"
            >
              {stage ? `Show the ${STAGE_NOUN[stage]}` : "Show the answer"}
            </Button>
          )}
        </ResultActions>
        {confirmReveal ? (
          <Callout
            tone="attention"
            title={stage ? `Show the ${STAGE_NOUN[stage]}?` : "Show the source's notes?"}
            onDismiss={() => setConfirmReveal(false)}
            actions={
              <Button
                size="sm"
                loading={submit.isPending}
                onClick={() => void reveal()}
                data-testid="reveal-confirm"
              >
                Show it
              </Button>
            }
          >
            You'll see its roll and staff. Checks still run, but this item won't count as a graded pass.
          </Callout>
        ) : null}
      </Card>

      {showRef && project.stimulus ? (
        <Card className="flex flex-col gap-2 p-4" data-testid="reference">
          <h3 className="font-sans text-sm font-semibold text-text-2">The source</h3>
          {chordsHidden ? (
            <p className="text-sm text-text-2">The bass line; the chords stay hidden.</p>
          ) : null}
          <ReferenceRoll events={refEvents} bars={project.stimulus.bars} />
          <ReferenceStaff
            events={refEvents}
            bars={project.stimulus.bars}
            meter={given.meter}
            keySpec={given.key}
          />
          <p className="text-sm text-text-3">
            {[given.key ? formatKey(given.key) : null, given.meter, `${Math.round(given.bpm)} BPM`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
