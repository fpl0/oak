// Oak 2.0 W4 (W1 gap 1; PLAN S7 Rendering as Commitment): the capstone workspace's "Commit the sounds" card
// (`CAPSTONE_SLOTS` entry `commit-after-session`, registered by the W4 integrator). After a completed session of a
// multi-session capstone, before the last, it offers to commit every part's sound as the learner hears it (the live
// code, saved first when it is ahead of the last autosave), so the next sessions arrange and mix. A later edit to a committed sound shows W1's sentence with "Put it back" and
// "Keep the change" (which uncommits that part). It never blocks a Run, a check or a release.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { errorWords } from "../lib/error-words.ts";
import { apiQuery, useSketchPatch } from "../lib/queries.ts";
import { COMMIT_COPY, restoreSound, soundChanges } from "../studio/commit.ts";
import { Button } from "../ui/kit/Button.tsx";
import { toast } from "../ui/kit/Toast.tsx";
import { COMMIT_SESSION_COPY, commitHeard, showCommitOffer, uncommittedLabels } from "./commit-session.ts";
import type { CapstoneSlotProps } from "./workspace-slots.ts";

export function CommitAfterSession(p: CapstoneSlotProps) {
  // The draft sketch: its committed lines and the code of each version (to read a committed sound back).
  const sketchQ = useQuery({
    ...apiQuery("sketches.get", { params: { id: p.sketchId ?? "" } }),
    enabled: p.sketchId !== null,
  });
  const sketch = p.sketchId === null ? null : (sketchQ.data ?? null);
  const patch = useSketchPatch();
  const [flushing, setFlushing] = useState(false);
  const committed = sketch?.committed ?? [];
  const codeOf = (version: number): string | null =>
    sketch?.versions.find((v) => v.version === version)?.code ?? null;
  const changes = p.released ? [] : soundChanges(p.liveCode, committed, codeOf);
  const offer = showCommitOffer({
    sessionsDone: p.sessionsDone,
    total: p.totalSessions,
    released: p.released,
    uncommitted: uncommittedLabels(p.liveCode, committed).length,
  });
  if (!offer && changes.length === 0) return null;

  const save = async (next: typeof committed, after?: string) => {
    if (!p.sketchId) return;
    try {
      await patch.mutateAsync({ params: { id: p.sketchId }, body: { committed: next } });
      if (after) toast.success(after);
    } catch (e) {
      toast.error(COMMIT_SESSION_COPY.failed, errorWords(e));
    }
  };
  // The code the learner hears: a sound edited since the last autosave is saved first (W5 F2).
  const commit = async () => {
    setFlushing(true);
    try {
      const next = await commitHeard({
        liveCode: p.liveCode,
        savedVersion: p.savedVersion,
        savedCode: p.savedCode,
        saveNow: p.saveNow,
        at: new Date().toISOString(),
        committed,
      });
      if (next) await save(next, COMMIT_SESSION_COPY.committed);
    } catch (e) {
      toast.error(COMMIT_SESSION_COPY.failed, errorWords(e));
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3"
      data-testid="commit-after-session"
    >
      {offer ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm text-text-2">
            {p.savedVersion === null ? COMMIT_SESSION_COPY.needsSave : COMMIT_SESSION_COPY.offer}
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={p.savedVersion === null || p.sketchId === null}
            loading={flushing || patch.isPending}
            onClick={() => void commit()}
            data-testid="commit-sounds"
          >
            {COMMIT_SESSION_COPY.commit}
          </Button>
        </div>
      ) : null}
      {changes.map((c) => {
        const [before, after] = COMMIT_COPY.changedParts(c.version);
        const then = codeOf(c.version);
        return (
          <div
            key={c.label}
            className="flex flex-wrap items-center gap-2 text-sm"
            data-testid="commit-changed"
          >
            <p className="min-w-0 flex-1 text-text-2">
              {before}
              <code className="font-mono">{c.label}</code>
              {after}
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={then === null}
              onClick={() => {
                if (then !== null) p.applyCode(restoreSound(p.liveCode, c.label, then));
              }}
            >
              {COMMIT_COPY.putBack}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void save(committed.filter((x) => x.label !== c.label))}
            >
              {COMMIT_COPY.keep}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
