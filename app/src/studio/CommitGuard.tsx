// Oak 2.0 W1 (PLAN S7, commit sounds): when the sound of a committed line changes in the editor, ask once per line:
// put the committed sound back, or keep the change (which uncommits the line). It asks; it never blocks a Run. Slot
// `commit-guard`, place `aside`. Hidden while Jam is on (jam hides every Studio prompt, W1 fidelity rule 2); it asks
// again once the jam ends if the change is still there.
import { Fragment } from "react";
import { useSketchPatch } from "../lib/queries.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { COMMIT_COPY, restoreSound, soundChanges } from "./commit.ts";
import type { EditorSlotProps } from "./editor-slots.ts";

export function CommitGuard({ sketch, liveCode, jam, applyCode }: EditorSlotProps) {
  const patch = useSketchPatch();
  const committed = sketch.committed ?? [];
  if (jam || committed.length === 0) return null;
  const codeOf = (version: number): string | null =>
    sketch.versions.find((v) => v.version === version)?.code ?? null;
  const changes = soundChanges(liveCode, committed, codeOf);
  if (changes.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="commit-guard">
      {changes.map(({ label, version }) => {
        const [before, after] = COMMIT_COPY.changedParts(version);
        return (
          <Callout
            key={label}
            tone="info"
            title={
              <Fragment>
                {before}
                <code className="rounded bg-surface-2 px-1 font-mono text-[0.8125rem]">{label}</code>
                {after}
              </Fragment>
            }
            actions={
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    const from = codeOf(version);
                    if (from !== null) applyCode(restoreSound(liveCode, label, from));
                  }}
                  data-testid="commit-put-back"
                >
                  {COMMIT_COPY.putBack}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={patch.isPending}
                  onClick={() =>
                    patch.mutate({
                      params: { id: sketch.id },
                      body: { committed: committed.filter((c) => c.label !== label) },
                    })
                  }
                  data-testid="commit-keep"
                >
                  {COMMIT_COPY.keep}
                </Button>
              </>
            }
          />
        );
      })}
    </div>
  );
}
