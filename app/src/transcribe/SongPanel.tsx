// A song item beside the Workbench (contracts §2.8–§2.9, §6.6 X2, §6.12; wave5.md §5.3). L5: public-domain folk,
// worked phrase by phrase — what is given, the phrase map (done, now, next), a check per phrase graded on the
// server at 0.85, the result bar by bar. L6: a blues strain in three stages — bass (0.90), then the changes on a
// chord chart (0.85), then the melody one 4-bar line at a time (0.85) — each opening once the one before passed.
// The hidden code never reaches the page; a phrase or stage is shown only when asked for (a rung-4 hint).
import type { LadderSong, LadderSubmitResult, TranscriptionDetail } from "@oak/api";
import { OakApiError } from "@oak/api";
import type { NEvent } from "@oak/content-kit";
import { R } from "@oak/content-kit";
import { useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Check, CircleCheck, Eye, Lock, PenLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { idempotencyKey } from "../lib/idempotency.ts";
import { useLadderNext, useLadderSongs, useLadderSubmit } from "../lib/queries.ts";
import { PRACTICE_LINE } from "../lib/retry.ts";
import { currentSessionId } from "../session/store.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Card, Chip } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { ResultActions } from "../ui/kit/ResultActions.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { ChangesChart } from "./ChangesChart.tsx";
import { checkLines, lineText, REALISM_TEXT } from "./ladder.ts";
import { ReferenceStaff } from "./ReferenceView.tsx";
import {
  type BarMark,
  barMarks,
  changesOfCode,
  currentPhrase,
  currentSongStage,
  cycleOfBar,
  layerOfTrack,
  mergeStageMarks,
  passMarkOf,
  phraseStates,
  rememberItem,
  SONG_STAGE_LABEL,
  SONG_STAGE_TASK,
  type SongCheckTarget,
  type SongGiven,
  type SongLevel,
  type SongStage,
  type SpanStatus,
  type StageMarks,
  songGivenChips,
  songStageStates,
  songTitleText,
  songVerdict,
  spanLoop,
  type TimelineMark,
  timelineMarks,
  withChanges,
} from "./song.ts";

interface SongMarks {
  /** L5 phrases (1-based) passed or shown in this browser. */
  passed: number[];
  revealed: number[];
  /** L6 stages. */
  stages: StageMarks;
  /** L6 melody lines (1-based) passed or shown. */
  lines: number[];
  linesRevealed: number[];
}
const EMPTY: SongMarks = { passed: [], revealed: [], stages: {}, lines: [], linesRevealed: [] };
const KEY = (id: string) => `oak.transcribe.song.${id}`;
function readMarks(id: string): SongMarks {
  try {
    const raw = localStorage.getItem(KEY(id));
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<SongMarks>) };
  } catch {
    // storage blocked: the server's passes still show
  }
  return EMPTY;
}
function writeMarks(id: string, m: SongMarks): void {
  try {
    localStorage.setItem(KEY(id), JSON.stringify(m));
  } catch {
    // a convenience; the server keeps the graded versions
  }
}

/** What the page draws on the timeline for the panel: the span worked now and the last check bar by bar. */
export interface SongFocus {
  /** The phrase or line being worked (1-based bars), `null` for a whole-strain stage. */
  span: [number, number] | null;
  marks: Map<number, BarMark> | null;
  stage: SongStage | null;
}

const STATUS_TEXT: Record<SpanStatus, string> = {
  passed: "passed",
  revealed: "shown",
  open: "now",
  locked: "next",
};

function StatusDot({ status, n }: { status: SpanStatus; n: number | string }) {
  return (
    <span
      className={clsx(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.75rem]",
        status === "passed"
          ? "border-accent bg-accent text-on-accent"
          : status === "open"
            ? "border-accent text-accent"
            : "border-border text-text-3",
      )}
      aria-hidden
    >
      {status === "passed" ? (
        <Check className="size-3" />
      ) : status === "locked" ? (
        <Lock className="size-3" />
      ) : (
        n
      )}
    </span>
  );
}

export function SongPanel({
  project,
  level,
  given,
  code,
  getCode,
  setCode,
  onResult,
  onFocus,
  onLoopSpan,
}: {
  project: TranscriptionDetail;
  level: SongLevel;
  given: SongGiven;
  /** The editor's code, a moment after each edit (the chart follows it). */
  code: string;
  /** The editor's code now. */
  getCode(): string;
  /** Put code in the editor (the chart written into the chords: line). */
  setCode(code: string): void;
  onResult(r: LadderSubmitResult | null): void;
  onFocus(f: SongFocus): void;
  /** Loop a phrase or line (1-based bars). */
  onLoopSpan(span: readonly [number, number]): void;
}) {
  const songs = useLadderSongs();
  const listed: LadderSong | null = useMemo(
    () => songs.data?.items.find((s) => s.songId === (given.songId ?? project.songId)) ?? null,
    [songs.data, given.songId, project.songId],
  );
  const [marks, setMarksState] = useState<SongMarks>(() => readMarks(project.id));
  const setMarks = (m: SongMarks) => {
    setMarksState(m);
    writeMarks(project.id, m);
  };
  const pickup = given.pickupBeats !== null;
  const passedPhrases = useMemo(
    () => [...new Set([...(listed?.passedPhrases ?? []), ...marks.passed])],
    [listed, marks.passed],
  );
  // L6 has three stages; `form` is the L8 form map (Wave 6), which this panel does not show yet.
  const stageMarks = mergeStageMarks(
    (listed?.passedStages ?? []).filter((s) => s !== "form"),
    marks.stages,
  );
  /** A passed L6 stage the learner chose to try again (practice: it stays passed). */
  const [againStage, setAgainStage] = useState<SongStage | null>(null);
  const stage = level === 6 ? (againStage ?? currentSongStage(stageMarks)) : null;
  const phraseNow = level === 5 ? currentPhrase(given.phrases.length, passedPhrases, marks.revealed) : null;
  const lineNow =
    level === 6 && stage === "melody"
      ? currentPhrase(given.phrases.length, marks.lines, marks.linesRevealed)
      : null;
  // The span the learner may pick (L5: any phrase up to the open one; L6 melody: lines likewise).
  const [picked, setPicked] = useState<number | null>(null);
  const span = level === 5 ? (picked ?? phraseNow) : stage === "melody" ? (picked ?? lineNow) : null;
  const spanBars = span !== null ? (given.phrases[span - 1] ?? null) : null;
  const done = level === 5 ? phraseNow === null : stage === null || (stage === "melody" && lineNow === null);

  /** The verdict on screen; `practice` when its target had already passed; `n` counts checks for the row. */
  const [last, setLast] = useState<{
    r: LadderSubmitResult;
    target: SongCheckTarget;
    practice: boolean;
    n: number;
  } | null>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [shown, setShown] = useState<{ span: [number, number]; layer: "melody" | "bass" | "chords" } | null>(
    null,
  );
  const submit = useLadderSubmit();
  const next = useLadderNext();
  const navigate = useNavigate();

  // The chart (L6 changes): read from the code when the stage opens; the learner fills it, Check writes it in.
  const [chart, setChart] = useState<string[]>(() =>
    level === 6 ? (changesOfCode(getCode(), given.bars, pickup) ?? Array(given.bars).fill("")) : [],
  );
  // Whether the learner filled the chart since it last followed the code: only then does Check write it into the
  // code. A chords line the chart cannot read (hand-voiced stacks) is never overwritten by an older chart.
  const [chartEdited, setChartEdited] = useState(false);
  const editChart = (next: string[]) => {
    setChart(next);
    setChartEdited(true);
  };
  // The chart follows the code as it is typed (a chords: line written one chord a bar).
  useEffect(() => {
    if (stage !== "changes") return;
    const fromCode = changesOfCode(code, given.bars, pickup);
    if (fromCode?.some((c) => c)) {
      setChart(fromCode);
      setChartEdited(false);
    }
  }, [stage, code]);

  const checkedSpan: [number, number] | null = level === 5 || stage === "melody" ? spanBars : [1, given.bars];
  const lastMarks =
    last && (last.target.stage === stage || level === 5) && checkedSpan
      ? barMarks(last.r.result, checkedSpan, pickup)
      : null;
  useEffect(() => {
    onFocus({ span: level === 5 || stage === "melody" ? spanBars : null, marks: lastMarks, stage });
  }, [span, stage, last, given.bars]);

  const target = (): SongCheckTarget => ({
    level,
    span: level === 5 || stage === "melody" ? span : null,
    stage,
  });

  const send = async (rung: 0 | 4) => {
    let code = getCode();
    if (level === 6 && stage === "changes" && rung === 0 && chartEdited && chart.some((c) => c.trim())) {
      const fromCode = changesOfCode(code, given.bars, pickup);
      if (!fromCode || fromCode.join("|") !== chart.join("|")) {
        code = withChanges(code, chart, pickup);
        setCode(code);
      }
    }
    const t = target();
    return {
      t,
      r: await submit.mutateAsync({
        params: { id: project.id },
        body: {
          sessionId: currentSessionId(),
          code,
          ...(t.stage ? { stage: t.stage } : {}),
          ...(t.span !== null ? { phrase: t.span } : {}),
          rung,
          idempotencyKey: idempotencyKey(),
        },
      }),
    };
  };

  const failText = (e: unknown) =>
    e instanceof OakApiError && e.code === "not_implemented"
      ? "Not built yet: this server can't check song items."
      : e instanceof Error
        ? e.message
        : String(e);

  const check = async () => {
    try {
      const { r, t } = await send(0);
      const practice = alreadyPassed(t);
      setLast({ r, target: t, practice, n: (last?.n ?? 0) + 1 });
      setAgainStage(null);
      onResult(r);
      if (!r.passed || practice) return;
      if (level === 5 && t.span !== null) {
        setMarks({ ...marks, passed: [...new Set([...marks.passed, t.span])] });
        setPicked(null);
      } else if (t.stage === "melody" && t.span !== null) {
        const lines = [...new Set([...marks.lines, t.span])];
        const all = currentPhrase(given.phrases.length, lines, marks.linesRevealed) === null;
        setMarks({ ...marks, lines, stages: all ? { ...marks.stages, melody: "passed" } : marks.stages });
        setPicked(null);
      } else if (t.stage) setMarks({ ...marks, stages: { ...marks.stages, [t.stage]: "passed" } });
    } catch (e) {
      toast.error("Couldn't check it", failText(e));
    }
  };

  /** A rung-4 hint (contracts §5.3): recorded as a revealed check, so it can't count as a graded pass. */
  const reveal = async () => {
    setConfirmReveal(false);
    try {
      const { r, t } = await send(4);
      onResult(r);
      setLast(null);
      if (level === 5 && t.span !== null && spanBars) {
        setMarks({ ...marks, revealed: [...new Set([...marks.revealed, t.span])] });
        setShown({ span: spanBars, layer: "melody" });
      } else if (t.stage === "melody" && t.span !== null && spanBars) {
        const linesRevealed = [...new Set([...marks.linesRevealed, t.span])];
        const all = currentPhrase(given.phrases.length, marks.lines, linesRevealed) === null;
        setMarks({
          ...marks,
          linesRevealed,
          stages: all ? { ...marks.stages, melody: marks.stages.melody ?? "revealed" } : marks.stages,
        });
        setShown({ span: spanBars, layer: "melody" });
      } else if (t.stage) {
        setMarks({ ...marks, stages: { ...marks.stages, [t.stage]: "revealed" } });
        setShown({ span: [1, given.bars], layer: t.stage === "changes" ? "chords" : "bass" });
      }
      setPicked(null);
    } catch (e) {
      toast.error("Couldn't show it", failText(e));
    }
  };

  /** Whether a target had passed before this check: a check of it now is practice (docs/design/retry.md §3.6). */
  const alreadyPassed = (t: SongCheckTarget): boolean =>
    t.span !== null
      ? level === 5
        ? passedPhrases.includes(t.span)
        : marks.lines.includes(t.span)
      : t.stage !== null && stageMarks[t.stage] === "passed";

  /**
   * Try again (docs/design/retry.md §3.6): the verdict goes and its target opens again — the same phrase, line or
   * stage, even one that has just passed (then the check is practice) — and the editor gets the cursor.
   */
  const tryAgain = () => {
    if (last) {
      if (last.target.span !== null) setPicked(last.target.span);
      else if (last.target.stage !== null && last.r.passed) setAgainStage(last.target.stage);
    }
    setLast(null);
  };

  const nextSong = async () => {
    try {
      const item = await next.mutateAsync({
        body: { sessionId: currentSessionId(), gymId: project.gymId ?? null, level },
      });
      rememberItem(item);
      void navigate({ to: "/transcribe/$projectId", params: { projectId: item.itemId } });
    } catch (e) {
      toast.error("Couldn't open the next song", failText(e));
    }
  };

  const pick = (n: number, bars: [number, number]) => {
    setPicked(n);
    setLast(null);
    onLoopSpan(bars);
  };

  const lines = last ? checkLines(last.r.result) : [];
  const mark = passMarkOf(level, stage);
  const marksForStage = level === 5 ? null : songStageStates(stageMarks);
  const phraseList =
    level === 5
      ? phraseStates(given.phrases.length, passedPhrases, marks.revealed)
      : stage === "melody" || stageMarks.melody !== undefined
        ? phraseStates(given.phrases.length, marks.lines, marks.linesRevealed)
        : null;
  const checkLabel =
    level === 5
      ? `Check phrase ${span ?? ""}`.trim()
      : stage === "melody"
        ? `Check line ${span ?? ""}`.trim()
        : stage === "changes"
          ? "Check the changes"
          : "Check the bass";
  // Opening a target that already passed (Try again after a pass, or picking a passed phrase) checks as practice.
  const retrying =
    againStage !== null || (span !== null && (level === 5 ? passedPhrases : marks.lines).includes(span));
  const checkOpen = (last === null || (last.r.passed && !done)) && (!done || (last === null && retrying));
  const revealLabel =
    level === 5
      ? `Show phrase ${span ?? ""}`.trim()
      : stage === "melody"
        ? `Show line ${span ?? ""}`.trim()
        : `Show the ${stage ?? "answer"}`;

  return (
    <div className="flex flex-col gap-3" data-testid="song-panel">
      <Card className="flex flex-col gap-2 p-4" aria-live="polite">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-h3">
              Level {level} · {level === 5 ? "Public-domain folk" : "Blues"}
            </h2>
            <p className="mt-0.5 truncate font-medium" data-testid="song-title">
              {songTitleText(given)}
            </p>
          </div>
          {done ? (
            <Chip tone="accent" data-testid="song-done">
              <CircleCheck aria-hidden className="size-3.5" /> Done
            </Chip>
          ) : null}
        </div>
        <ResultActions
          resultKey={last ? last.n : null}
          onRetry={last ? tryAgain : null}
          retryFocus={() => document.querySelector<HTMLElement>(".cm-content")}
          onContinue={done ? () => void nextSong() : null}
          continueDisabled={next.isPending}
          continueLabel="Next song"
          continueTestId="next-item"
          line={last?.practice ? PRACTICE_LINE : null}
          testId="song-actions"
          // After a failed check the answer is changed through Try again (as in a lesson); after a pass the next
          // phrase's or stage's Check is open beside it.
          action={
            checkOpen ? (
              <Button
                variant="primary"
                loading={submit.isPending}
                onClick={() => void check()}
                data-testid="check"
              >
                {checkLabel}
              </Button>
            ) : null
          }
        >
          {done || retrying ? null : (
            <Button
              variant="ghost"
              icon={<Eye aria-hidden className="size-4" />}
              onClick={() => setConfirmReveal(true)}
              data-testid="reveal"
            >
              {revealLabel}
            </Button>
          )}
          {!done ? <span className="text-sm text-text-3">passes at {Math.round(mark * 100)}%</span> : null}
        </ResultActions>
        {confirmReveal ? (
          <Callout
            tone="attention"
            title={`${revealLabel}?`}
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
            You'll see its notes on the staff. The next {level === 5 ? "phrase" : "stage"} opens, but this
            song won't count as a graded pass.
          </Callout>
        ) : null}
        {last ? (
          <div data-testid="check-result">
            <p className="text-sm text-text" data-testid="verdict">
              {last.r.passed ? <CircleCheck aria-hidden className="mr-1 inline size-4 text-accent" /> : null}
              {songVerdict(last.r, last.target)}
            </p>
            {!last.r.passed && lines.length > 0 ? (
              <ul className="mt-1.5 flex flex-col gap-1 text-sm text-text-2" data-testid="check-lines">
                {lines.map((l) => (
                  <li key={lineText(l)}>{lineText(l)}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : done ? (
          <p className="text-sm text-text-2" data-testid="song-done-text">
            {level === 5
              ? `Every phrase of ${given.title} is written. Next: another song from the pool.`
              : `Bass, changes and melody of ${given.title} are written. Next: another strain.`}
          </p>
        ) : (
          <p className="text-sm text-text-3">
            Loop the {level === 5 ? "phrase" : stage === "melody" ? "line" : "strain"}, switch with V between
            the source and yours, then Check. The song's notes stay hidden.
          </p>
        )}
      </Card>

      {marksForStage ? (
        <Card className="p-4">
          <h3 className="mb-2 font-sans text-sm font-semibold text-text-2">
            Bass, then changes, then melody
          </h3>
          <ol className="flex flex-col gap-1.5" data-testid="stages">
            {marksForStage.map((s, i) => (
              <li
                key={s.stage}
                className={clsx("flex items-center gap-2 text-sm", s.status === "locked" && "text-text-3")}
                data-status={s.status}
              >
                <StatusDot status={s.status} n={i + 1} />
                <span className={clsx(s.status === "open" && "font-medium text-text")}>
                  {SONG_STAGE_LABEL[s.stage]}
                </span>
                <span className="text-text-3">≥ {Math.round(passMarkOf(6, s.stage) * 100)}%</span>
                <span className="sr-only">{STATUS_TEXT[s.status]}</span>
                {s.status === "revealed" ? <Chip>shown</Chip> : null}
              </li>
            ))}
          </ol>
          {stage ? <p className="mt-2 text-sm text-text-2">{SONG_STAGE_TASK[stage]}</p> : null}
        </Card>
      ) : null}

      {phraseList ? (
        <Card className="p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="font-sans text-sm font-semibold text-text-2">
              {level === 5 ? "Phrases" : "Melody lines"}
            </h3>
            <span className="text-sm text-text-3" data-testid="phrase-progress">
              {phraseList.filter((p) => p.status === "passed").length} of {phraseList.length} passed
            </span>
          </div>
          <ol className="grid grid-cols-2 gap-1.5" data-testid="phrase-map">
            {phraseList.map((p) => {
              const bars = given.phrases[p.n - 1] as [number, number];
              const selected = span === p.n;
              return (
                <li key={p.n}>
                  <button
                    type="button"
                    disabled={p.status === "locked"}
                    aria-pressed={selected}
                    aria-label={`${level === 5 ? "Phrase" : "Line"} ${p.n}, bars ${bars[0]}–${bars[1]}: ${STATUS_TEXT[p.status]}. Loop it (${p.n})`}
                    onClick={() => pick(p.n, bars)}
                    data-status={p.status}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-control border px-2 py-1.5 text-left text-sm",
                      "hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent",
                      selected ? "border-accent bg-lane-in" : "border-border",
                    )}
                  >
                    <StatusDot status={p.status} n={p.n} />
                    <span className="min-w-0">
                      <span className={clsx("block", p.status === "locked" ? "text-text-3" : "text-text")}>
                        {level === 5 ? "Phrase" : "Line"} {p.n}
                      </span>
                      <span className="block text-[0.75rem] text-text-3 tabular-nums">
                        bars {bars[0]}–{bars[1]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-sm text-text-3">
            Keys <kbd>1</kbd>–<kbd>{Math.min(9, phraseList.length)}</kbd> loop a{" "}
            {level === 5 ? "phrase" : "line"}; <kbd>PageDown</kbd> the next.
          </p>
        </Card>
      ) : null}

      {level === 6 && stage === "changes" ? (
        <Card className="flex flex-col gap-2 p-4">
          <ChangesChart
            chart={chart}
            onChart={editChart}
            bars={given.bars}
            meter={given.meter}
            keySpec={given.key}
            bpm={given.bpm}
            swing={given.swing}
            marks={lastMarks}
            firstCycle={cycleOfBar(1, pickup)}
            disabled={submit.isPending}
            onSubmit={() => void check()}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon={<PenLine aria-hidden className="size-4" />}
              disabled={!chart.some((c) => c.trim())}
              onClick={() => setCode(withChanges(getCode(), chart, pickup))}
              data-testid="chart-to-code"
            >
              Write the chart into my code
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const fromCode = changesOfCode(getCode(), given.bars, pickup);
                if (fromCode) setChart(fromCode);
                else
                  toast.info(
                    "The chords: line isn't one chord a bar",
                    'The chart reads chord("<…>") lines only.',
                  );
              }}
            >
              Read my code
            </Button>
          </div>
          <p className="text-sm text-text-3">
            Check writes the chart you filled into the chords: line first. A bar with two chords: write it in
            the code as <code>[G7 D7]</code>.
          </p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2 p-4">
        <h3 className="font-sans text-sm font-semibold text-text-2">Given</h3>
        <p className="text-sm text-text-2">
          {level === 5
            ? "Write the tune phrase by phrase, as scale degrees on the melody: line."
            : "Bass first, then the changes, then the melody, each checked before the next opens."}
        </p>
        <ul className="flex flex-wrap gap-1" aria-label="Given" data-testid="given">
          {songGivenChips(given).map((c) => (
            <li key={c}>
              <Chip>{c}</Chip>
            </li>
          ))}
        </ul>
        <p className="text-sm text-text-3">{REALISM_TEXT[project.realism ?? 0]}</p>
      </Card>

      {shown && project.stimulus ? (
        <ShownSpan project={project} given={given} span={shown.span} layer={shown.layer} />
      ) : null}
    </div>
  );
}

/** The notes of a phrase, line or stage after "Show": the reference's events of that layer in that window. */
function ShownSpan({
  project,
  given,
  span,
  layer,
}: {
  project: TranscriptionDetail;
  given: SongGiven;
  span: [number, number];
  layer: "melody" | "bass" | "chords";
}) {
  const pickup = given.pickupBeats !== null;
  const loop = spanLoop(span, pickup);
  const events = useMemo(
    () =>
      (project.stimulus?.events ?? [])
        .filter((e) => {
          const on = R.toNum(e.onset);
          const l = layerOfTrack(e.track);
          return (
            on >= loop.fromBar &&
            on < loop.fromBar + loop.bars &&
            (l === layer || (layer === "chords" && l === "bass"))
          );
        })
        .map((e): NEvent => ({ ...e, onset: R.sub(e.onset, [loop.fromBar, 1]) })),
    [project.stimulus, loop.fromBar, loop.bars, layer],
  );
  return (
    <Card className="flex flex-col gap-2 p-4" data-testid="reference">
      <h3 className="font-sans text-sm font-semibold text-text-2">
        Shown: bars {span[0]}–{span[1]}
        {layer === "melody" ? "" : layer === "bass" ? ", the bass" : ", bass and chords"}
      </h3>
      <ReferenceStaff
        events={events}
        bars={loop.bars}
        meter={given.meter}
        keySpec={given.key}
        swing={given.swing}
      />
    </Card>
  );
}

/** The timeline's marks for a song item (exported for the page and the X2 workspace). */
export function songMarks(level: SongLevel, given: SongGiven): TimelineMark[] {
  return timelineMarks(level, given);
}
