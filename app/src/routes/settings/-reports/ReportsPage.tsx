// Settings › Grading reports (contracts §11.8), in every build: the "Report a grading problem" queue. Each
// report shows what was attempted, the code or answer, the grade with its feedback codes, a Replay of the
// code in a read-only workbench, triage status, and "Copy as test case" so a grader false negative becomes a
// regression test.
import type { LintContext, QaReport, UnlockableId } from "@oak/api";
import { Copy, Play, Square } from "lucide-react";
import { useState } from "react";
import { toolbox } from "../../../../../content/toolbox.ts";
import { usePageTitle } from "../../../lib/nav.ts";
import { useQaReports, useQaUpdate } from "../../../lib/queries.ts";
import { appWorkbenchServices } from "../../../lib/workbench-services.ts";
import { Button } from "../../../ui/kit/Button.tsx";
import { Card, Chip, EmptyState } from "../../../ui/kit/basics.tsx";
import { SegmentedControl } from "../../../ui/kit/Controls.tsx";
import { Select } from "../../../ui/kit/Field.tsx";
import { QueryView } from "../../../ui/kit/QueryState.tsx";
import { toast } from "../../../ui/kit/Toast.tsx";
import { ServicesGate } from "../../../workbench/ServicesGate.tsx";
import { Workbench } from "../../../workbench/Workbench.tsx";
import { codeOf, countByStatus, QA_STATUS_LABEL, QA_STATUSES, type QaStatus, toTestCase } from "./qa.ts";

const KIND_LABEL: Record<QaReport["kind"], string> = {
  "lesson-step": "Lesson step",
  "drill-trial": "Drill trial",
  "checkpoint-item": "Checkpoint item",
  "capstone-rubric": "Capstone rubric",
  "ladder-transcription": "Transcription",
};

const ALL_UNLOCKED: ReadonlySet<UnlockableId> = new Set(toolbox.map((t) => t.id as UnlockableId));
const REPLAY_LINT: LintContext = {
  profile: "content",
  unlocked: ALL_UNLOCKED,
  allowPreview: true,
  meter: "4/4",
  key: null,
};

function when(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime())
    ? at
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function ReportCard({
  r,
  replaying,
  onReplay,
}: {
  r: QaReport;
  replaying: boolean;
  onReplay: (on: boolean) => void;
}) {
  const update = useQaUpdate();
  const code = codeOf(r);
  const tc = toTestCase(r);
  const g = r.gradeResult;
  const copy = async () => {
    if (!tc.ok) return;
    try {
      await navigator.clipboard.writeText(tc.source);
      toast.success(
        "Test case copied",
        `Paste it into the tests of ${r.exerciseId ?? r.familyId ?? "the exercise"}.`,
      );
    } catch {
      toast.error(
        "Could not copy",
        "The browser refused clipboard access. Open the test case below and copy it by hand.",
      );
    }
  };
  return (
    <Card className="flex flex-col gap-3 p-4" data-report={r.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-h3">
            <span className="font-mono text-text-3">#{r.id}</span> {KIND_LABEL[r.kind]}
            {r.lessonId && <span className="ml-2 font-mono text-sm text-text-2">{r.lessonId}</span>}
            {(r.exerciseId ?? r.familyId) && (
              <span className="ml-1 font-mono text-sm text-text-2">/ {r.exerciseId ?? r.familyId}</span>
            )}
          </h3>
          <p className="text-sm text-text-2">
            {when(r.at)}
            {r.exerciseVersion !== null && ` · v${r.exerciseVersion}`}
            {r.stepId && ` · step ${r.stepId}`}
            {r.trialSeed !== null && ` · seed ${r.trialSeed}`} · hint level {r.hintRung}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {code !== null && (
            <Button
              variant={replaying ? "secondary" : "primary"}
              size="sm"
              icon={
                replaying ? (
                  <Square aria-hidden className="size-4" />
                ) : (
                  <Play aria-hidden className="size-4" />
                )
              }
              onClick={() => onReplay(!replaying)}
            >
              {replaying ? "Close replay" : "Replay"}
            </Button>
          )}
          {tc.ok && (
            <Button size="sm" icon={<Copy aria-hidden className="size-4" />} onClick={() => void copy()}>
              Copy as test case
            </Button>
          )}
          <span className="flex items-center gap-2 text-sm text-text-2">
            <label htmlFor={`qa-status-${r.id}`}>Status</label>
            <Select<QaStatus>
              id={`qa-status-${r.id}`}
              value={r.status}
              options={QA_STATUSES.map((s) => ({ value: s, label: QA_STATUS_LABEL[s] }))}
              disabled={update.isPending}
              onChange={(status) =>
                update.mutate(
                  { params: { id: String(r.id) }, body: { status } },
                  { onError: (e) => toast.error("Status not saved", e.message) },
                )
              }
            />
          </span>
        </div>
      </div>
      {r.note && <blockquote className="border-l-2 border-accent-2 pl-3 text-text">{r.note}</blockquote>}

      <section aria-label="The attempt" className="flex flex-col gap-2">
        {code !== null ? (
          <>
            <pre className="max-h-48 overflow-auto rounded-control border border-border bg-surface-2 p-3 font-mono text-sm whitespace-pre-wrap">
              {code}
            </pre>
            {replaying && (
              <ServicesGate load={appWorkbenchServices} auto>
                <Workbench
                  id={`qa-${r.id}`}
                  code={code}
                  lessonCtx={{ key: null, meter: "4/4", defaultBpm: 90, loopBars: 4 }}
                  lint={REPLAY_LINT}
                  views={["roll"]}
                  readOnly
                  variant="compact"
                  autoPlay
                />
              </ServicesGate>
            )}
          </>
        ) : (
          <pre className="max-h-48 overflow-auto rounded-control border border-border bg-surface-2 p-3 font-mono text-sm whitespace-pre-wrap">
            {JSON.stringify(r.response).length <= 100
              ? JSON.stringify(r.response)
              : JSON.stringify(r.response, null, 2)}
          </pre>
        )}
      </section>

      <section aria-label="The grade" className="flex flex-col gap-1 text-sm">
        {g ? (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <Chip tone={g.status === "pass" ? "accent" : g.status === "fail" ? "amber" : "neutral"}>
                Graded {g.status}
              </Chip>
              <span className="tabular-nums">score {Math.round(g.score * 100)}%</span>
              {g.diagnostics.map((d, i) => (
                <code
                  key={`${d.id}-${i}`}
                  className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.8rem]"
                >
                  {d.id}
                </code>
              ))}
            </p>
            {g.messages.length > 0 && (
              <ul className="list-disc pl-5 text-text-2">
                {g.messages.map((m, i) => (
                  <li key={`${m.id}-${i}`}>{m.text}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-text-2">No grade was recorded with this report.</p>
        )}
      </section>

      {!tc.ok && <p className="text-sm text-text-2">{tc.why}</p>}
      {tc.ok && (
        <details className="text-sm">
          <summary className="cursor-pointer text-text-2">Test case (expects {tc.test.expect})</summary>
          <pre className="mt-2 overflow-auto rounded-control border border-border bg-surface-2 p-3 font-mono whitespace-pre">
            {tc.source}
          </pre>
        </details>
      )}
    </Card>
  );
}

function Queue({ reports }: { reports: QaReport[] }) {
  const [filter, setFilter] = useState<QaStatus | "all">("open");
  const [replay, setReplay] = useState<number | null>(null);
  const counts = countByStatus(reports);
  const shown = [...reports]
    .filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<QaStatus | "all">
        label="Show reports"
        value={filter}
        onChange={setFilter}
        options={[
          ...QA_STATUSES.map((s) => ({ value: s, label: `${QA_STATUS_LABEL[s]} (${counts[s]})` })),
          { value: "all" as const, label: `All (${counts.all})` },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState title={filter === "open" ? "Nothing open" : "Nothing here"}>
          {filter === "open"
            ? "No grading problems are waiting. Reports come from “Report a grading problem” under any graded result."
            : "No report has this status."}
        </EmptyState>
      ) : (
        shown.map((r) => (
          <ReportCard
            key={r.id}
            r={r}
            replaying={replay === r.id}
            onReplay={(on) => setReplay(on ? r.id : null)}
          />
        ))
      )}
    </div>
  );
}

export function ReportsPage() {
  usePageTitle("Settings · Grading reports");
  const qa = useQaReports();
  return (
    <div className="flex flex-col gap-4" data-testid="grading-reports">
      <header className="min-w-0">
        <h2 className="text-h2">Grading reports</h2>
        <p className="mt-1 text-sm text-text-2">
          Each time you press “Report a grading problem” after a result, it lands here with what you played
          and how it was graded. The reports stay on this computer.
        </p>
      </header>
      <QueryView query={qa}>{(d) => <Queue reports={d.items} />}</QueryView>
    </div>
  );
}
