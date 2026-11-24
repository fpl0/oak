// Settings › Tutor (ux §2.3, contracts §10.9, §10.A): which backend answers and why (from `/api/tutor/status`,
// with the server's own set-up guidance when one is signed out or missing), the backend choice, the API key,
// this month's usage and the soft monthly marker (a marker only: there is no cap), the notes Claude keeps (each
// removable), and what Claude sees.
import { EFFORT_OF, type Lane, type TutorSettings, type TutorStatus } from "@oak/api";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { callApi } from "../lib/api.ts";
import { formatDate, formatMonth } from "../lib/format.ts";
import {
  useAnthropicKeyDelete,
  useAnthropicKeySet,
  useBootstrap,
  useSettingsPut,
  useTutorNotes,
  useTutorRetractNote,
  useTutorStatus,
  useTutorUsage,
} from "../lib/queries.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Chip } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { Field, ReadOnlyRow, Section, Select } from "../ui/kit/Field.tsx";
import { Meter } from "../ui/kit/Meters.tsx";
import { ErrorState, QueryView } from "../ui/kit/QueryState.tsx";
import { toast } from "../ui/kit/Toast.tsx";

const HEALTH_COPY: Record<TutorStatus["tutor"], string> = {
  ready: "Ready",
  missing_key: "Off",
  invalid_key: "The API key was refused",
  unreachable: "Claude could not be reached",
};
const BACKEND_LABEL: Record<string, string> = {
  "anthropic-api": "Anthropic API (your key)",
  "claude-cli": "Claude CLI (your Claude login)",
};
const LANE_LABEL: Record<Lane, string> = {
  hint: "Hints and Explain my mistake",
  note: "Listening notes",
  chat: "Questions",
  review: "Reviews",
};
const MARKERS = [5, 10, 25, 50, 100];

/** The server's reason codes (`server/src/tutor/select.ts`) in words. */
export const REASON_COPY: Record<string, string> = {
  auto: "Chosen automatically: the first backend that is ready.",
  setting: "The backend you chose below.",
  off: "You turned the tutor off below.",
  missing_key: "No API key and no signed-in Claude CLI were found.",
  invalid_key: "The saved API key was refused.",
  unreachable: "Claude could not be reached just now.",
  not_installed: "Not available on this computer.",
  not_logged_in: "The Claude CLI is installed but not signed in.",
};
export const reasonText = (r: string | null): string | null => (r === null ? null : (REASON_COPY[r] ?? r));

function useInvalidateTutor() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["health", "tutor.status", "tutor.usage", "bootstrap"].map((n) =>
        qc.invalidateQueries({ queryKey: ["api", n] }),
      ),
    );
}

function StatusSection() {
  const status = useTutorStatus();
  const bootstrap = useBootstrap();
  const put = useSettingsPut();
  const invalidate = useInvalidateTutor();
  const [checking, setChecking] = useState(false);
  const recheck = async () => {
    setChecking(true);
    try {
      await callApi("tutor.status", { query: { refresh: "1" } });
      await invalidate();
    } catch (e) {
      toast.error("The tutor could not be checked", e instanceof Error ? e.message : undefined);
    } finally {
      setChecking(false);
    }
  };
  const setTutor = (patch: Partial<TutorSettings>) => {
    const cur = bootstrap.data?.settings.tutor;
    if (!cur) return;
    put.mutate(
      { params: { key: "tutor" }, body: { value: { ...cur, ...patch } } },
      {
        onSuccess: () => void invalidate(),
        onError: (e) => toast.error("That setting wasn't saved", e.message),
      },
    );
  };
  // One failure, one message and one way to retry: both reads of this card fail together when the server is down.
  const failed = status.isError ? status.error : bootstrap.isError ? bootstrap.error : null;
  if (failed !== null)
    return (
      <Section
        title="Status"
        description="Oak is fully usable without the tutor: lessons, hints and grading never need it."
      >
        <ErrorState
          error={failed}
          onRetry={() => void Promise.all([status.refetch(), bootstrap.refetch()])}
        />
      </Section>
    );
  return (
    <Section
      title="Status"
      description="Oak is fully usable without the tutor: lessons, hints and grading never need it."
    >
      <QueryView query={status} loading={<p className="py-3 text-text-3">Checking…</p>}>
        {(s) => (
          <>
            <ReadOnlyRow
              label="Tutor"
              value={
                <span className="flex flex-wrap items-center gap-2" data-testid="settings-tutor-status">
                  <Chip tone={s.tutor === "ready" ? "accent" : "neutral"}>{HEALTH_COPY[s.tutor]}</Chip>
                  <span>{s.active ? BACKEND_LABEL[s.active] : "No backend answering"}</span>
                </span>
              }
            />
            <ReadOnlyRow
              label="Why"
              value={<span data-testid="settings-tutor-reason">{reasonText(s.reason)}</span>}
            />
            {s.guidance && (
              <div className="py-3">
                <Callout tone="info" title="To turn it on">
                  <span className="whitespace-pre-wrap" data-testid="settings-tutor-guidance">
                    {s.guidance}
                  </span>
                </Callout>
              </div>
            )}
            <div className="py-3">
              <h3 className="mb-2 text-sm font-semibold text-text-2">Backends</h3>
              <ul className="flex flex-col gap-2">
                {s.backends.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-col gap-0.5 rounded-control border border-border p-2.5 text-sm"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{BACKEND_LABEL[b.id]}</span>
                      {b.active ? (
                        <Chip tone="accent">Answering</Chip>
                      ) : b.ok ? (
                        <Chip>Available</Chip>
                      ) : (
                        <Chip>{b.wired ? "Not available" : "Not set up"}</Chip>
                      )}
                      <span className="text-text-3">
                        {b.billing === "plan" ? "Included in your Claude plan" : "Billed to your API key"}
                      </span>
                    </span>
                    {b.reason && <span className="text-text-2">{reasonText(b.reason)}</span>}
                    {b.guidance && !b.active && <span className="text-text-3">{b.guidance}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <ReadOnlyRow label="Model" value={s.model} />
          </>
        )}
      </QueryView>
      <QueryView query={bootstrap} loading={null}>
        {(b) => (
          <Field
            label="Backend"
            help="Auto: an API key if there is one, then a signed-in Claude CLI, otherwise off."
          >
            {({ id, describedBy }) => (
              <Select<TutorSettings["backend"]>
                id={id}
                describedBy={describedBy}
                value={b.settings.tutor.backend}
                disabled={put.isPending}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "anthropic-api", label: "Anthropic API" },
                  { value: "claude-cli", label: "Claude CLI" },
                  { value: "off", label: "Off" },
                ]}
                onChange={(backend) => setTutor({ backend })}
              />
            )}
          </Field>
        )}
      </QueryView>
      <div className="pt-3">
        <Button size="sm" loading={checking} onClick={recheck}>
          Check again
        </Button>
      </div>
    </Section>
  );
}

/**
 * There may be a key to remove: the API backend has one (from this page or the environment). "missing_key" says there
 * is none; "not_installed" that the backend is not in this build. Unknown (status not read) counts as none, so the
 * button never offers to remove what may not exist.
 */
export function mayHaveKey(status: Pick<TutorStatus, "backends"> | undefined): boolean {
  const api = status?.backends.find((b) => b.id === "anthropic-api");
  return api !== undefined && api.reason !== "missing_key" && api.reason !== "not_installed";
}

function KeyForm() {
  const [key, setKey] = useState("");
  const set = useAnthropicKeySet();
  const del = useAnthropicKeyDelete();
  const status = useTutorStatus();
  const invalidate = useInvalidateTutor();
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await set.mutateAsync({ body: { key: key.trim() } });
            setKey("");
            await invalidate();
            if (r.status === "ready") toast.success("Key saved", "The tutor is ready.");
            else toast.error("Key saved, but not usable", HEALTH_COPY[r.status]);
          } catch (err) {
            toast.error("The key was not saved", err instanceof Error ? err.message : undefined);
          }
        }}
      >
        <label htmlFor="api-key" className="sr-only">
          Anthropic API key
        </label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste an API key (sk-ant-…)"
          className="h-8 w-80 max-w-full rounded-control border border-border bg-surface px-2 font-mono text-sm"
        />
        <Button type="submit" disabled={key.trim().length < 20} loading={set.isPending}>
          Save key
        </Button>
        <Button
          variant="ghost"
          loading={del.isPending}
          disabled={!mayHaveKey(status.data)}
          onClick={async () => {
            try {
              const r = await del.mutateAsync({
                target: "*",
                question:
                  "Remove the saved Anthropic API key from this computer? The tutor will use your Claude login if you have one.",
              });
              if (r) {
                await invalidate();
                toast.success("Key removed");
              }
            } catch (err) {
              toast.error("The key was not removed", err instanceof Error ? err.message : undefined);
            }
          }}
        >
          Remove saved key
        </Button>
      </form>
      <p className="text-sm text-text-2">
        Stored in <code>~/.oak/secrets</code> with owner-only permissions. It never comes back to this page,
        never goes into backups, and the grader never sees it.
      </p>
    </div>
  );
}

function UsageSection() {
  const usage = useTutorUsage();
  const bootstrap = useBootstrap();
  const put = useSettingsPut();
  const invalidate = useInvalidateTutor();
  return (
    <Section
      title="This month"
      description="Spending only ever raises a marker here. The tutor is never cut off and never answers with less effort to save money."
    >
      <QueryView query={usage} loading={<p className="py-3 text-text-3">Loading usage…</p>}>
        {(u) => {
          const plan = u.includedInPlan && u.costUsd === 0;
          const marker = bootstrap.data?.settings.tutor.softMonthlyUsd ?? u.softMonthlyUsd;
          return (
            <>
              <ReadOnlyRow label="Month" value={formatMonth(u.month)} />
              <ReadOnlyRow
                label="Cost"
                value={
                  <span data-testid="settings-tutor-cost">
                    {plan ? "Included in your Claude plan" : `≈ $${u.costUsd.toFixed(2)} (estimate)`}
                  </span>
                }
              />
              {!plan && (
                <div className="py-3">
                  <Meter
                    label="This month against your marker"
                    value={Math.min(u.costUsd, Math.max(marker, u.costUsd))}
                    max={Math.max(marker, u.costUsd, 0.01)}
                    valueText={`$${u.costUsd.toFixed(2)} of $${marker}`}
                    tone={u.softPassed ? "amber" : "accent"}
                    ticks={[{ at: marker, label: `$${marker} marker` }]}
                  />
                </div>
              )}
              {u.softPassed && (
                <div className="py-3">
                  <Callout tone="attention" title="Tutor spending passed your monthly marker">
                    Nothing changes: the tutor keeps working as before. Raise the marker below if you like.
                  </Callout>
                </div>
              )}
              <Field
                label="Monthly marker"
                help="A soft marker for the API backend: one notice when passed. No cap."
              >
                {({ id, describedBy }) => (
                  <Select<number>
                    id={id}
                    describedBy={describedBy}
                    value={marker}
                    disabled={!bootstrap.data || put.isPending}
                    options={(MARKERS.includes(marker)
                      ? MARKERS
                      : [...MARKERS, marker].sort((a, b) => a - b)
                    ).map((v) => ({
                      value: v,
                      label: `$${v}`,
                    }))}
                    onChange={(softMonthlyUsd) => {
                      const cur = bootstrap.data?.settings.tutor;
                      if (!cur) return;
                      put.mutate(
                        { params: { key: "tutor" }, body: { value: { ...cur, softMonthlyUsd } } },
                        {
                          onSuccess: () => void invalidate(),
                          onError: (e) => toast.error("That setting wasn't saved", e.message),
                        },
                      );
                    }}
                  />
                )}
              </Field>
              <ReadOnlyRow
                label="Tokens"
                value={`${u.inputTokens.toLocaleString()} in · ${u.outputTokens.toLocaleString()} out · cache hits ${Math.round(u.cacheHitRatio * 100)}%`}
              />
              <div className="py-3">
                <table className="w-full text-sm" data-testid="usage-by-lane">
                  <caption className="mb-2 text-left text-sm text-text-2">
                    <span className="font-semibold">By kind of request.</span> Each kind has a fixed effort;
                    it never changes inside a conversation.
                  </caption>
                  <thead>
                    <tr className="text-left text-text-3">
                      <th scope="col" className="py-1 font-medium">
                        Kind
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        Effort
                      </th>
                      <th scope="col" className="py-1 text-right font-medium">
                        Requests
                      </th>
                      <th scope="col" className="py-1 text-right font-medium">
                        Tokens out
                      </th>
                      {!plan && (
                        <th scope="col" className="py-1 text-right font-medium">
                          Cost
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {u.byLane.map((l) => (
                      <tr key={l.lane} className="border-t border-border">
                        <th scope="row" className="py-1.5 text-left font-normal">
                          {LANE_LABEL[l.lane]}
                        </th>
                        <td className="py-1.5 text-text-2">{EFFORT_OF[l.lane]}</td>
                        <td className="py-1.5 text-right tabular-nums">{l.requests}</td>
                        <td className="py-1.5 text-right tabular-nums">{l.outputTokens.toLocaleString()}</td>
                        {!plan && <td className="py-1.5 text-right tabular-nums">${l.costUsd.toFixed(2)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      </QueryView>
    </Section>
  );
}

function NotesSection() {
  const notes = useTutorNotes();
  const retract = useTutorRetractNote();
  return (
    <Section
      title="Notes Claude keeps"
      description="Short notes from listening notes, reviews and your checks. Claude reads the latest ten. Removed notes are never sent again."
    >
      <QueryView query={notes} loading={<p className="py-3 text-text-3">Loading notes…</p>}>
        {(n) => {
          const live = n.items.filter((x) => !x.retractedAt);
          if (live.length === 0)
            return (
              <p className="py-3 text-sm text-text-2" data-testid="notes-empty">
                No notes yet. They appear after a listening note or a review.
              </p>
            );
          return (
            <ul className="flex flex-col divide-y divide-border" data-testid="settings-notes">
              {live.map((x) => (
                <li key={x.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm">{x.text}</p>
                    <p className="text-xs text-text-3">
                      {formatDate(`${x.day}T12:00:00`)} ·{" "}
                      {x.source === "listening" ? "listening note" : x.source} ·{" "}
                      {x.subjectKind === "general" ? "general" : `${x.subjectKind} ${x.subjectId}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove note: ${x.text}`}
                    loading={retract.isPending && retract.variables?.params.id === x.id}
                    onClick={() =>
                      retract.mutate(
                        { params: { id: x.id } },
                        {
                          onSuccess: () => toast.success("Note removed", "Claude will not see it again."),
                          onError: (e) => toast.error("The note was not removed", e.message),
                        },
                      )
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          );
        }}
      </QueryView>
    </Section>
  );
}

export function TutorSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <StatusSection />
      <Section title="API key" description="Only needed for the Anthropic API backend.">
        <KeyForm />
      </Section>
      <UsageSection />
      <NotesSection />
      <Section title="What Claude sees">
        <ul className="ml-5 list-disc space-y-1 py-1 text-text-2">
          <li>
            Your code, Oak's check of it, and the lesson you are in. The context chips in the panel show each.
          </li>
          <li>Short notes from earlier sessions, so it can follow your progress.</li>
          <li>
            Never your audio, your voice or your files. Answers you have not reached are held back until you
            ask for them with the lesson's hints.
          </li>
        </ul>
      </Section>
    </div>
  );
}
