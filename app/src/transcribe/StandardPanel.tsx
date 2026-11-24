// A standard beside the Workbench: ladder L8 (contracts §2.9, §6.6 CF-T; content/specs/CF.md; wave6.md §5.4). A
// full arrangement taken down in four stages that open in order: the form map on the strip under the timeline
// (every section right), then the bass (0.90), the changes on a chord chart (0.85 of the bars, sevenths and applied
// dominants) and the melody (0.90), each one section at a time, each graded on the server. The form is never
// given; once the learner's map passes, the draft's skeleton is written from it and every later stage is worked in
// those sections. What is passed is kept between sessions (the server's passed stages, the map as the project's
// regions, this browser's marks). The hidden code never reaches the page.
import type { LadderSong, LadderSubmitResult, TranscriptionDetail } from "@oak/api";
import { OakApiError } from "@oak/api";
import type { KeySpec, NEvent } from "@oak/content-kit";
import { R } from "@oak/content-kit";
import { useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Check, CircleCheck, Eye, Lock, PenLine, Split } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { idempotencyKey } from "../lib/idempotency.ts";
import { useLadderNext, useLadderSubmit, useTranscriptionPatch } from "../lib/queries.ts";
import { PRACTICE_LINE } from "../lib/retry.ts";
import { currentSessionId } from "../session/store.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Card, Chip, Kbd } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { ResultActions } from "../ui/kit/ResultActions.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { ChangesChart } from "./ChangesChart.tsx";
import {
  type BarClock,
  emptyFormMap,
  type FormMap,
  type FormSection,
  formLettersOf,
  formMapAnswer,
  formMapOfRegions,
  formMapProblem,
  formMarks,
  formSummary,
  formVerdict,
  normalizeFormMap,
  readFormDraft,
  type SectionMark,
  sectionsOf,
  setLabel,
  withFormRegions,
  writeFormDraft,
} from "./form-map.ts";
import { checkLines, lineText, REALISM_TEXT } from "./ladder.ts";
import { ReferenceStaff } from "./ReferenceView.tsx";
import {
  type BarMark,
  barMarks,
  cycleOfBar,
  layerOfTrack,
  phraseStates,
  rememberItem,
  type SongGiven,
  type SpanStatus,
  songTitleText,
  spanLoop,
} from "./song.ts";
import {
  changesOfSection,
  currentStandardStage,
  formMapOfPhrases,
  hasSkeleton,
  isBareDraft,
  markSection,
  mergeStandardStages,
  passMarkText,
  readStandardMarks,
  STANDARD_STAGE_LABEL,
  STANDARD_STAGE_TASK,
  type StandardCheckTarget,
  type StandardCodeStage,
  type StandardMarks,
  type StandardStage,
  sectionConst,
  skeletonOfForm,
  splitSection,
  standardGivenChips,
  standardStageStates,
  standardVerdict,
  withSectionChanges,
  workSections,
  writeStandardMarks,
} from "./standard.ts";

/**
 * The chart's palette for a 1920s standard: triads, the dominant 7th (the key's own and the applied ones), the
 * minor 7th and the passing diminished 7th. Five, so the palette fits the panel; any other chord is typed in the
 * code.
 */
export const STANDARD_CHART_QUALITIES = ["maj", "min", "7", "m7", "dim7"] as const;

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

/** What the page draws for the panel: the form strip, the section worked now, the last check bar by bar. */
export interface StandardView {
  stage: StandardStage | null;
  /** The form is mapped (passed or shown): the strip is read-only and names the tune's sections. */
  formDone: boolean;
  /** The map on the strip: the learner's draft while the form stage is open, the tune's sections after. */
  map: FormMap;
  /** Edits the draft (the form stage only). */
  setMap(m: FormMap): void;
  /** The last form check per section, while the form stage is open. */
  formMarks: ReadonlyMap<number, SectionMark> | null;
  /** The sections the code stages are worked in. */
  sections: FormSection[];
  /** 0-based section being worked, `null` during the form stage and when all is done. */
  active: number | null;
  /** The section's bars and the last check of it, for the timeline. */
  span: [number, number] | null;
  barMarks: Map<number, BarMark> | null;
  /** Choose a section (a click on the strip, a digit key). */
  pick(index: number): void;
}

const failText = (e: unknown) =>
  e instanceof OakApiError && e.code === "not_implemented"
    ? "Not built yet: this server can't check a standard."
    : e instanceof Error
      ? e.message
      : String(e);

/**
 * The state of one standard: the stage marks (the server's and this browser's), the form map, the section being
 * worked, checks and reveals. One hook, so the strip in the source card and the panel beside the Workbench show
 * the same thing.
 */
export function useStandard(o: {
  project: TranscriptionDetail;
  given: SongGiven;
  listed: LadderSong | null;
  /** Where the bars sit in source seconds (the map is kept as the project's regions). */
  clock: BarClock | null;
  /**
   * The form as letters when the server gives it on the project ("AABA"). Read only once the form stage is behind
   * (shown, or passed on another device): it names the sections the server's phrases cut.
   */
  formLetters?: string | null;
  getCode(): string;
  setCode(code: string): void;
  onResult(r: LadderSubmitResult | null): void;
}) {
  const { project, given, listed, clock } = o;
  const pickup = given.pickupBeats !== null;
  const submit = useLadderSubmit();
  const patch = useTranscriptionPatch();
  const [local, setLocalState] = useState<StandardMarks>(() => readStandardMarks(project.id));
  const setLocal = (m: StandardMarks) => {
    setLocalState(m);
    writeStandardMarks(project.id, m);
  };
  const stages = mergeStandardStages(listed?.passedStages ?? [], local.stages);
  const stage = currentStandardStage(stages);
  const formDone = stages.form !== undefined;

  // The draft: what this browser last saw, else the project's own regions (another device), else one section.
  const [draft, setDraftState] = useState<FormMap>(
    () =>
      local.form ??
      readFormDraft(project.id, given.bars) ??
      formMapOfRegions(project.regions, clock, given.bars) ??
      emptyFormMap(given.bars),
  );
  const setDraft = (m: FormMap) => {
    setDraftState(m);
    writeFormDraft(project.id, m);
    setLastForm(null);
  };
  // The tune's sections once the form is done: the map that passed here; else the regions it was kept as; else the
  // server's phrases (a form that was shown, or passed on another device before regions were kept); else eight-bar
  // blocks. Never `null` once the form stage is behind: the skeleton and the sections always have a map.
  const known = useMemo(() => {
    if (!formDone) return null;
    const kept =
      local.form ??
      formMapOfRegions(project.regions, clock, given.bars) ??
      formMapOfPhrases(listed?.phrases ?? null, given.bars, o.formLetters ?? null);
    if (kept) return kept;
    const blocks = workSections(null, listed?.phrases ?? null, given.bars);
    return normalizeFormMap({
      bars: given.bars,
      cuts: blocks.map((b) => b.from),
      labels: blocks.map(() => ""),
    });
  }, [
    formDone,
    local.form,
    project.regions,
    clock?.barSec,
    clock?.firstBarS,
    listed?.phrases,
    given.bars,
    o.formLetters,
  ]);
  const sections = useMemo(() => (known ? sectionsOf(known) : []), [known]);
  // A draft that still is the bare starter (the form passed last session, nothing written since) gets its lines.
  useEffect(() => {
    if (!known) return;
    const code = o.getCode();
    if (!hasSkeleton(code, known) && isBareDraft(code)) o.setCode(skeletonOfForm(given, known));
  }, [known !== null]);
  const map = known ?? draft;

  // Sections of the open code stage: this browser's marks, and the server's (`passedLines`, as for L6's lines)
  // while the server's own open stage is this one (after a stage passes here, its list is the old stage's).
  const codeStage: StandardCodeStage | null = stage && stage !== "form" ? stage : null;
  const serverStage = currentStandardStage(mergeStandardStages(listed?.passedStages ?? [], {}));
  const serverLines = codeStage !== null && serverStage === codeStage ? (listed?.passedLines ?? []) : [];
  const progress = codeStage
    ? {
        passed: [...new Set([...local.sections[codeStage].passed, ...serverLines])],
        revealed: local.sections[codeStage].revealed,
      }
    : { passed: [], revealed: [] };
  const states = codeStage ? phraseStates(sections.length, progress.passed, progress.revealed) : [];
  const openSection = states.find((s) => s.status === "open")?.n ?? null;
  const [picked, setPicked] = useState<number | null>(null);
  const section = codeStage ? (picked ?? openSection) : null;
  const sectionOf = section !== null ? (sections[section - 1] ?? null) : null;

  const [last, setLast] = useState<{
    r: LadderSubmitResult;
    target: StandardCheckTarget;
    /** Checked after its section had passed: practice (docs/design/retry.md §3.6). */
    practice: boolean;
  } | null>(null);
  /** Checks run here: each one is a new result for the row (focus, Alt+R). */
  const [checks, setChecks] = useState(0);
  const [lastForm, setLastForm] = useState<{ r: LadderSubmitResult; map: FormMap } | null>(null);
  const [shown, setShown] = useState<{ span: [number, number]; layer: "melody" | "bass" | "chords" } | null>(
    null,
  );

  const span: [number, number] | null = sectionOf ? [sectionOf.from, sectionOf.to] : null;
  const lastBars =
    last && codeStage && last.target.stage === codeStage && last.target.section === section && span
      ? barMarks(last.r.result, span, pickup)
      : null;

  const target = (): StandardCheckTarget => ({
    stage: stage ?? "melody",
    section: codeStage ? section : null,
    label: sectionOf?.label || null,
  });

  const send = (code: string, rung: 0 | 4, t: StandardCheckTarget) =>
    submit.mutateAsync({
      params: { id: project.id },
      body: {
        sessionId: currentSessionId(),
        code,
        stage: t.stage,
        ...(t.stage === "form" ? { formMap: formMapAnswer(draft) } : {}),
        ...(t.section !== null ? { phrase: t.section } : {}),
        rung,
        idempotencyKey: idempotencyKey(),
      },
    });

  /** The map passed (or was shown): keep it here and on the project, and write the draft's skeleton from it. */
  const settleForm = (m: FormMap | null, how: "passed" | "revealed") => {
    setLocal({ ...local, stages: { ...local.stages, form: how }, form: m });
    if (!m) return;
    if (clock)
      patch.mutate(
        { params: { id: project.id }, body: { regions: withFormRegions(project.regions, m, clock) } },
        // The map is still kept in this browser; the regions carry it to a backup and to other devices.
        { onError: () => undefined },
      );
    const code = o.getCode();
    if (!hasSkeleton(code, m) && isBareDraft(code)) o.setCode(skeletonOfForm(given, m));
  };

  const check = async (chartCode?: string) => {
    const t = target();
    try {
      const practice = t.section !== null && codeStage !== null && progress.passed.includes(t.section);
      const r = await send(chartCode ?? o.getCode(), 0, t);
      o.onResult(r);
      setChecks((n) => n + 1);
      if (t.stage === "form") {
        setLastForm({ r, map: draft });
        setLast(null);
        if (r.passed) settleForm(draft, "passed");
        return;
      }
      setLast({ r, target: t, practice });
      if (r.passed && !practice && t.section !== null && codeStage) {
        setLocal(markSection(local, codeStage, t.section, "passed", sections.length));
        setPicked(null);
      }
    } catch (e) {
      toast.error("Couldn't check it", failText(e));
    }
  };

  /** A rung-4 hint (contracts §5.3): recorded as a revealed check, so the song can't count as a graded pass. */
  const reveal = async () => {
    const t = target();
    try {
      const r = await send(o.getCode(), 4, t);
      o.onResult(r);
      setLast(null);
      if (t.stage === "form") {
        setLastForm(null);
        settleForm(formMapOfPhrases(listed?.phrases ?? null, given.bars, o.formLetters ?? null), "revealed");
        return;
      }
      if (t.section !== null && codeStage && span) {
        setLocal(markSection(local, codeStage, t.section, "revealed", sections.length));
        setShown({ span, layer: codeStage === "changes" ? "chords" : codeStage });
        setPicked(null);
      }
    } catch (e) {
      toast.error("Couldn't show it", failText(e));
    }
  };

  const view: StandardView = {
    stage,
    formDone,
    map,
    setMap: setDraft,
    formMarks: !formDone && lastForm ? formMarks(lastForm.r.result, lastForm.map) : null,
    sections,
    active: section !== null ? section - 1 : null,
    span,
    barMarks: lastBars,
    pick: (index) => {
      const st = states[index];
      if (!codeStage || !st || st.status === "locked") return;
      setPicked(index + 1);
      setLast(null);
    },
  };

  return {
    view,
    stages,
    stage,
    codeStage,
    states,
    section,
    sectionOf,
    draft,
    setDraft,
    known,
    last,
    lastForm,
    shown,
    busy: submit.isPending,
    check,
    reveal,
    checks,
    /**
     * Try again (docs/design/retry.md §3.6): the verdict goes and its section opens again — even one that has just
     * passed (its check is then practice). A form that passed is settled into the sections; its verdict just goes.
     */
    retry: () => {
      if (last && last.target.section !== null && last.target.stage === codeStage)
        setPicked(last.target.section);
      setLast(null);
      setLastForm(null);
      o.onResult(null);
    },
    /** A section name typed in the panel (a word like "chorus"), during the form stage. */
    name: (index: number, label: string) => setDraft(setLabel(draft, index, label)),
    /** A repeat that ends differently gets its own lines (and its own name on the strip). */
    split: (index: number) => {
      if (!known) return;
      const out = splitSection(o.getCode(), known, index);
      if (out.map === known) return;
      o.setCode(out.code);
      setLocal({ ...local, form: out.map });
      if (clock)
        patch.mutate(
          { params: { id: project.id }, body: { regions: withFormRegions(project.regions, out.map, clock) } },
          { onError: () => undefined },
        );
    },
    writeSkeleton: () => {
      if (known) o.setCode(skeletonOfForm(given, known));
    },
  };
}
export type Standard = ReturnType<typeof useStandard>;

export function StandardPanel({
  project,
  given,
  std,
  code,
  getCode,
  setCode,
  sectionKey,
  onLoopSpan,
}: {
  project: TranscriptionDetail;
  given: SongGiven;
  std: Standard;
  /** The editor's code, a moment after each edit (the chart follows it). */
  code: string;
  getCode(): string;
  setCode(code: string): void;
  /** The key in force at a 1-based bar (the song's key plan): a section's chart is read there. */
  sectionKey(bar: number): KeySpec | null;
  onLoopSpan(span: readonly [number, number]): void;
}) {
  const { stage, codeStage, stages, states, section, sectionOf, draft, known, last, lastForm } = std;
  const pickup = given.pickupBeats !== null;
  const next = useLadderNext();
  const navigate = useNavigate();
  const [confirmReveal, setConfirmReveal] = useState(false);
  const done = stage === null;

  // The chart of the section worked now (the changes stage): read from its const, written back on Check.
  const chartConst = sectionOf ? sectionConst("changes", sectionOf.label, sectionOf.index) : null;
  const chartBars = sectionOf?.bars ?? 0;
  const [chart, setChart] = useState<string[]>([]);
  const [chartEdited, setChartEdited] = useState(false);
  useEffect(() => {
    if (codeStage !== "changes" || !chartConst) return;
    const fromCode = changesOfSection(code, chartConst, chartBars);
    setChart(fromCode ?? Array(chartBars).fill(""));
    setChartEdited(false);
  }, [codeStage, chartConst, chartBars, code]);

  const check = async () => {
    if (codeStage === "changes" && chartConst && chartEdited && chart.some((c) => c.trim())) {
      const now = getCode();
      const fromCode = changesOfSection(now, chartConst, chartBars);
      if (!fromCode || fromCode.join("|") !== chart.join("|")) {
        const written = withSectionChanges(now, chartConst, chart);
        setCode(written);
        await std.check(written);
        return;
      }
    }
    await std.check();
  };

  const nextStandard = async () => {
    try {
      const item = await next.mutateAsync({
        body: { sessionId: currentSessionId(), gymId: project.gymId ?? null, level: 8 },
      });
      rememberItem(item);
      void navigate({ to: "/transcribe/$projectId", params: { projectId: item.itemId } });
    } catch (e) {
      toast.error("Couldn't open the next standard", failText(e));
    }
  };

  const problem = stage === "form" ? formMapProblem(draft) : null;
  const checkLabel =
    stage === "form"
      ? "Check the form"
      : stage
        ? `Check section ${section ?? ""}${sectionOf?.label ? ` (${sectionOf.label})` : ""}`
        : "";
  const revealLabel =
    stage === "form"
      ? "Show the form"
      : `Show section ${section ?? ""}'s ${stage === "changes" ? "changes" : stage}`;
  // A code stage's lines name their bars ("Bar 19: …"); a form check's messages are whole sentences already.
  const lines: string[] = last
    ? checkLines(last.r.result).map(lineText)
    : lastForm && !lastForm.r.passed
      ? [...new Set(lastForm.r.result.messages.map((m) => m.text.trim()).filter(Boolean))]
      : [];
  const verdict = last
    ? standardVerdict(last.r, last.target)
    : lastForm
      ? formVerdict(lastForm.r, lastForm.map)
      : null;
  const passed = last?.r.passed ?? lastForm?.r.passed ?? false;
  const repeats =
    known && sectionOf ? sectionsOf(known).filter((s) => s.label && s.label === sectionOf.label).length : 0;
  const needsSkeleton = known !== null && codeStage !== null && !hasSkeleton(code, known);

  return (
    <div className="flex flex-col gap-3" data-testid="standard-panel">
      <Card className="flex flex-col gap-2 p-4" aria-live="polite">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-h3">Level 8 · A standard</h2>
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
          resultKey={verdict !== null ? std.checks : null}
          onRetry={verdict !== null ? std.retry : null}
          retryFocus={() => document.querySelector<HTMLElement>(".cm-content")}
          onContinue={done ? () => void nextStandard() : null}
          continueDisabled={next.isPending}
          continueLabel="Next standard"
          continueTestId="next-item"
          line={last?.practice ? PRACTICE_LINE : null}
          testId="standard-actions"
          // After a failed check the answer is changed through Try again (as in a lesson); after a pass the next
          // section's or stage's Check is open beside it.
          action={
            !done && (verdict === null || passed) ? (
              <Button
                variant="primary"
                loading={std.busy}
                disabled={problem !== null}
                aria-describedby={problem ? "standard-check-why" : undefined}
                onClick={() => void check()}
                data-testid="check"
              >
                {checkLabel}
              </Button>
            ) : null
          }
        >
          {done ? null : (
            <Button
              variant="ghost"
              icon={<Eye aria-hidden className="size-4" />}
              onClick={() => setConfirmReveal(true)}
              data-testid="reveal"
            >
              {stage === "form" ? "Show the form" : "Show it"}
            </Button>
          )}
          {!done && stage ? (
            <span className="text-sm text-text-3">passes with {passMarkText(stage)}</span>
          ) : null}
        </ResultActions>
        {problem ? (
          <p id="standard-check-why" className="text-sm text-text-2" data-testid="check-why">
            {problem}
          </p>
        ) : null}
        {confirmReveal ? (
          <Callout
            tone="attention"
            title={`${revealLabel}?`}
            onDismiss={() => setConfirmReveal(false)}
            actions={
              <Button
                size="sm"
                loading={std.busy}
                onClick={() => {
                  setConfirmReveal(false);
                  void std.reveal();
                }}
                data-testid="reveal-confirm"
              >
                Show it
              </Button>
            }
          >
            {stage === "form"
              ? "The sections appear on the strip and the bass opens."
              : "You'll see its notes on the staff, and the next section opens."}{" "}
            This standard then won't count as a graded pass.
          </Callout>
        ) : null}
        {verdict ? (
          <div data-testid="check-result">
            <p className="text-sm text-text" data-testid="verdict">
              {passed ? <CircleCheck aria-hidden className="mr-1 inline size-4 text-accent" /> : null}
              {verdict}
            </p>
            {!passed && lines.length > 0 ? (
              <ul className="mt-1.5 flex flex-col gap-1 text-sm text-text-2" data-testid="check-lines">
                {lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : done ? (
          <p className="text-sm text-text-2" data-testid="song-done-text">
            Form, bass, changes and melody of {given.title} are written
            {known ? `: ${formLettersOf(known).split("").join(" ")}` : ""}. Next: another standard, or your
            own arrangement of this one in Studio.
          </p>
        ) : (
          <p className="text-sm text-text-3">
            {stage === "form"
              ? "Play it through once (Space). Press X where a new section starts, then name the sections."
              : "Loop the section, switch with V between the source and yours, then Check. The song's notes stay hidden."}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 font-sans text-sm font-semibold text-text-2">
          Form, then bass, changes and melody
        </h3>
        <ol className="flex flex-col gap-1.5" data-testid="stages">
          {standardStageStates(stages).map((s, i) => (
            <li
              key={s.stage}
              className={clsx("flex items-center gap-2 text-sm", s.status === "locked" && "text-text-3")}
              data-status={s.status}
              data-stage={s.stage}
            >
              <StatusDot status={s.status} n={i + 1} />
              <span className={clsx(s.status === "open" && "font-medium text-text")}>
                {STANDARD_STAGE_LABEL[s.stage]}
              </span>
              <span className="text-text-3">{passMarkText(s.stage)}</span>
              <span className="sr-only">{STATUS_TEXT[s.status]}</span>
              {s.status === "revealed" ? <Chip>shown</Chip> : null}
            </li>
          ))}
        </ol>
        {stage ? <p className="mt-2 text-sm text-text-2">{STANDARD_STAGE_TASK[stage]}</p> : null}
      </Card>

      {stage === "form" ? (
        <Card className="flex flex-col gap-2 p-4" data-testid="form-card">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-sans text-sm font-semibold text-text-2">Your map</h3>
            <span className="text-sm text-text-3" data-testid="form-summary">
              {formSummary(draft)}
            </span>
          </div>
          <ol className="flex flex-col gap-1.5">
            {sectionsOf(draft).map((s) => (
              <li key={s.from} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-text-2">
                  bars {s.from}–{s.to}
                </span>
                <input
                  aria-label={`Name of section ${s.index + 1}, bars ${s.from} to ${s.to}`}
                  value={s.label}
                  maxLength={24}
                  placeholder="A, B, chorus…"
                  onChange={(e) => std.name(s.index, e.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-control border border-border bg-surface px-2 text-text"
                  data-testid="form-name"
                />
                <Button size="sm" variant="ghost" onClick={() => onLoopSpan([s.from, s.to])}>
                  Loop
                </Button>
              </li>
            ))}
          </ol>
          <p className="text-sm text-text-3">
            On the strip: <Kbd>←</Kbd> <Kbd>→</Kbd> along the bar lines, <Kbd>Enter</Kbd> or <Kbd>X</Kbd> cuts
            or joins, <Kbd>A</Kbd>–<Kbd>H</Kbd> name a section. Music that comes back gets the same letter; a
            repeat that ends differently can be A2.
          </p>
        </Card>
      ) : null}

      {codeStage ? (
        <Card className="p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="font-sans text-sm font-semibold text-text-2">
              {STANDARD_STAGE_LABEL[codeStage]}, section by section
            </h3>
            <span className="text-sm text-text-3" data-testid="phrase-progress">
              {states.filter((p) => p.status === "passed").length} of {states.length} passed
            </span>
          </div>
          <ol className="grid grid-cols-2 gap-1.5" data-testid="phrase-map">
            {states.map((p) => {
              const s = std.view.sections[p.n - 1] as FormSection;
              const selected = section === p.n;
              return (
                <li key={p.n}>
                  <button
                    type="button"
                    disabled={p.status === "locked"}
                    aria-pressed={selected}
                    aria-label={`Section ${p.n}${s.label ? ` (${s.label})` : ""}, bars ${s.from}–${s.to}: ${STATUS_TEXT[p.status]}. Loop it (${p.n})`}
                    onClick={() => {
                      std.view.pick(p.n - 1);
                      onLoopSpan([s.from, s.to]);
                    }}
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
                        {s.label ? `${s.label} · section ${p.n}` : `Section ${p.n}`}
                      </span>
                      <span className="block text-[0.75rem] text-text-3 tabular-nums">
                        bars {s.from}–{s.to}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {needsSkeleton ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-2">
              <span>Your code has no line per section yet.</span>
              <Button size="sm" onClick={std.writeSkeleton} data-testid="write-skeleton">
                Write the section lines
              </Button>
            </div>
          ) : null}
          {repeats > 1 && sectionOf && section !== null ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Button
                size="sm"
                variant="ghost"
                icon={<Split aria-hidden className="size-4" />}
                onClick={() => std.split(sectionOf.index)}
                data-testid="split-section"
              >
                Section {section} ends differently
              </Button>
              <span className="text-text-3">It gets its own lines, copied from {sectionOf.label}.</span>
            </div>
          ) : null}
          <p className="mt-2 text-sm text-text-3">
            Keys <Kbd>1</Kbd>–<Kbd>{Math.min(9, Math.max(1, states.length))}</Kbd> loop a section. A section
            that comes back is written once: check it again where it returns.
          </p>
        </Card>
      ) : null}

      {codeStage === "changes" && sectionOf && chartConst ? (
        <Card className="flex flex-col gap-2 p-4">
          <p className="text-sm font-medium text-text" data-testid="chart-title">
            Section {section}
            {sectionOf.label ? ` (${sectionOf.label})` : ""}: bars {sectionOf.from}–{sectionOf.to}
          </p>
          <ChangesChart
            chart={chart}
            onChart={(nextChart) => {
              setChart(nextChart);
              setChartEdited(true);
            }}
            bars={chartBars}
            meter={given.meter}
            keySpec={sectionKey(sectionOf.from) ?? given.key}
            bpm={given.bpm}
            swing={given.swing}
            marks={std.view.barMarks}
            firstCycle={cycleOfBar(sectionOf.from, pickup)}
            disabled={std.busy}
            onSubmit={() => void check()}
            qualities={STANDARD_CHART_QUALITIES}
            idBase={`tr-std-${sectionOf.index}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon={<PenLine aria-hidden className="size-4" />}
              disabled={!chart.some((c) => c.trim())}
              onClick={() => setCode(withSectionChanges(getCode(), chartConst, chart))}
              data-testid="chart-to-code"
            >
              Write the chart into my code
            </Button>
          </div>
          <p className="text-sm text-text-3">
            Check writes the chart into <code>{chartConst}</code> first. <Kbd>Q</Kbd> changes a chord's
            quality: a dominant 7th that leans on the next chord is still named by its own root. Two chords in
            a bar: write them in the code as <code>[Dm7 G7]</code>.
          </p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2 p-4">
        <h3 className="font-sans text-sm font-semibold text-text-2">Given</h3>
        <ul className="flex flex-wrap gap-1" aria-label="Given" data-testid="given">
          {standardGivenChips(given).map((c) => (
            <li key={c}>
              <Chip>{c}</Chip>
            </li>
          ))}
        </ul>
        <p className="text-sm text-text-3">Not given: the form. {REALISM_TEXT[project.realism ?? 0]}</p>
      </Card>

      {std.shown && project.stimulus ? (
        <ShownSection project={project} given={given} span={std.shown.span} layer={std.shown.layer} />
      ) : null}
    </div>
  );
}

/** The notes of a section after "Show it": the reference's events of that layer in that window. */
function ShownSection({
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
  const loop = spanLoop(span, pickup, layer === "melody");
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
