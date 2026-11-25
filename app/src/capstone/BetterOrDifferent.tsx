// Oak 2.0 W4 F2 "Is it better, or just different?" (Diminishing Returns), a capstone workspace slot. When the last
// edits only change numbers, or come back to an earlier draft, the card offers a blind A/B of the newest earlier
// draft that passed its check against the draft now, both at the same loudness: "Which is better? If you can't tell,
// it may be done." The learner chooses (or says they can't tell), and only then are the sides named. Oak never says
// which is better and sends nothing about the choice to the server. "Not now" holds for that passing draft (this tab's
// `sessionStorage`) until a newer one passes.
import { Scale } from "lucide-react";
import { useMemo, useState } from "react";
import { MatchedCompare } from "../listen/MatchedCompare.tsx";
import { Button } from "../ui/kit/Button.tsx";
import { useCheckHistory } from "./check-history-queries.ts";
import { classifyRecentEdits } from "./edit-kind.ts";
import { blindOrder, NUDGE_COPY, type Nudge, nudgeOf, readDismissed, writeDismissed } from "./nudge.ts";
import { useDraft } from "./queries.ts";
import type { CapstoneSlotProps } from "./workspace-slots.ts";

export function BetterOrDifferent(p: CapstoneSlotProps) {
  const checked = p.state.checkedVersion;
  const last = p.state.lastResult;
  const refetchKey = `${checked?.sketchId ?? ""}@${checked?.sketchVersion ?? ""}:${last?.status ?? ""}:${last?.score ?? ""}`;
  const history = useCheckHistory(p.def.id, refetchKey);
  const draft = useDraft(p.sketchId);
  const [dismissed, setDismissed] = useState<ReadonlySet<number>>(() => readDismissed(p.def.id));
  const versions = draft.data?.versions;
  const nudge = useMemo(
    () =>
      history.data && versions
        ? nudgeOf(
            {
              capstoneId: p.def.id,
              history: history.data,
              sketchId: p.sketchId,
              versions,
              liveCode: p.liveCode,
              dismissed,
            },
            classifyRecentEdits,
          )
        : null,
    [history.data, versions, p.def.id, p.sketchId, p.liveCode, dismissed],
  );
  if (p.released || !nudge) return null;
  return (
    <NudgeCard
      key={nudge.seed}
      nudge={nudge}
      p={p}
      onDismiss={() => setDismissed(writeDismissed(p.def.id, nudge.earlier.version))}
    />
  );
}

type Choice = "earlier" | "current" | "cant-tell";

function NudgeCard({ nudge, p, onDismiss }: { nudge: Nudge; p: CapstoneSlotProps; onDismiss(): void }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const order = blindOrder(nudge.seed);
  const n = nudge.earlier.version;
  return (
    <section
      aria-labelledby="better-or-different-title"
      className="flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2.5 text-sm"
      data-testid="better-or-different"
      data-kind={nudge.kind}
    >
      <h2 id="better-or-different-title" className="flex items-center gap-2 font-sans text-sm font-semibold">
        <Scale aria-hidden className="size-4 text-text-3" />
        {NUDGE_COPY.title}
      </h2>
      <p className="text-text-2">
        {NUDGE_COPY[nudge.kind]} {NUDGE_COPY.ask}
      </p>
      <MatchedCompare
        testId="nudge-compare"
        title="Listen"
        blind={{ seed: nudge.seed, revealed: choice !== null }}
        sides={[
          { id: "earlier", label: `version ${n}`, code: nudge.earlier.code, band: p.band, key: p.keySpec },
          { id: "current", label: "your draft now", code: nudge.current.code, band: p.band, key: p.keySpec },
        ]}
      />
      {choice === null ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setChoice(order[0])} data-testid="nudge-one">
            {NUDGE_COPY.one}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setChoice(order[1])} data-testid="nudge-two">
            {NUDGE_COPY.two}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setChoice("cant-tell")}
            data-testid="nudge-cant-tell"
          >
            {NUDGE_COPY.cantTell}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} data-testid="nudge-not-now">
            {NUDGE_COPY.notNow}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-testid="nudge-reveal">
          <p className="text-text">{NUDGE_COPY.reveal(order, n)}</p>
          {choice === "earlier" ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => p.applyCode(nudge.earlier.code)} data-testid="nudge-go-back">
                {NUDGE_COPY.goBack(n)}
              </Button>
              <Button size="sm" variant="secondary" onClick={onDismiss} data-testid="nudge-keep">
                {NUDGE_COPY.keep}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-text-2">{choice === "current" ? NUDGE_COPY.keepIt : NUDGE_COPY.maybeDone}</p>
              <Button size="sm" variant="ghost" onClick={onDismiss} data-testid="nudge-not-now">
                {NUDGE_COPY.notNow}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
