// "Hum it, Oak drafts it" (contracts §6.12): a bar of clicks to count in, then the learner sings the line over
// the click for the item's bars; the take becomes a draft `n("…").scale("…")` line in the project's key. The
// draft is machine-made: it goes into the editor to be corrected, and gives no evidence until a corrected
// version is checked. The mic is analysed live on this computer and closed at once; nothing is recorded.
import { toLearnerProfile } from "@oak/api";
import type { HumDraft, PitchFrame } from "@oak/pitch";
import { METERS, tempoLine } from "@oak/theory";
import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { openMic } from "../lib/mic.ts";
import { getOak } from "../lib/oak.ts";
import { useProfile } from "../lib/queries.ts";
import { Button } from "../ui/kit/Button.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { Dialog } from "../ui/kit/Dialog.tsx";
import { draftLine, draftNotes, draftOfTake, type HumPlan, withDraft } from "./hum.ts";

type Phase =
  | { kind: "idle" }
  | { kind: "counting"; bar: number }
  | { kind: "singing"; bar: number }
  | { kind: "draft"; draft: HumDraft; line: string; degrees: string[] }
  | { kind: "error"; message: string };

export function HumDialog({
  open,
  onClose,
  plan,
  quiet,
  code,
  onUse,
  useLabel,
}: {
  open: boolean;
  onClose(): void;
  plan: HumPlan;
  /** Quiet mode or no mic: offer typing instead (wave4.md §10 item 9). */
  quiet: boolean;
  code: string;
  onUse(code: string, draft: HumDraft): void;
  /** The use button's text (Oak 2.0 capture: "Save to scraps"). Default "Put the draft in the editor". */
  useLabel?: string;
}) {
  const profileQ = useProfile();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!open) {
      stopRef.current?.();
      setPhase({ kind: "idle" });
    }
  }, [open]);
  useEffect(() => () => stopRef.current?.(), []);

  const barSec = (60 / plan.bpm) * METERS[plan.meter].unitsPerBar;
  const start = async () => {
    let session: Awaited<ReturnType<typeof openMic>> | null = null;
    let click: { stop(): void } | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    stopRef.current = () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      click?.stop();
      session?.close();
      stopRef.current = null;
    };
    try {
      const oak = await getOak();
      await oak.unlock();
      session = await openMic();
      const frames: PitchFrame[] = [];
      const off = session.onFrame((f) => frames.push(f));
      const { clickPlan } = await import("@oak/drills");
      const units = METERS[plan.meter].unitsPerBar;
      const plan2 = clickPlan(plan.bars + 1, 1 / barSec, units);
      const handle = oak.playEvents(plan2, { exclusive: true });
      click = handle;
      const downbeat = handle.startTime + barSec;
      const now = oak.ctx.currentTime;
      const ms = (t: number) => Math.max(0, (t - now) * 1000);
      setPhase({ kind: "counting", bar: 0 });
      for (let b = 0; b <= plan.bars; b++)
        timers.push(
          setTimeout(
            () => setPhase(b === 0 ? { kind: "counting", bar: 0 } : { kind: "singing", bar: b }),
            ms(handle.startTime + b * barSec),
          ),
        );
      await new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms(downbeat + plan.bars * barSec + 0.35)));
      });
      off();
      session.close();
      click.stop();
      stopRef.current = null;
      if (cancelled) return;
      const profile = profileQ.data ? toLearnerProfile(profileQ.data) : null;
      const { draft, degrees } = draftOfTake(
        frames,
        plan,
        {
          rangeLow: profile?.rangeLow ?? 48,
          noiseFloorDb: profile?.noiseFloorDb ?? -60,
          singLatencyMs: profile?.singLatencyMs ?? 0,
        },
        downbeat,
      );
      setPhase({
        kind: "draft",
        draft,
        line: draftLine(draft, plan.target),
        degrees: degrees.map((d) => String(d.degree)),
      });
    } catch (e) {
      stopRef.current?.();
      if (!cancelled)
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "The microphone did not open." });
    }
  };

  const busy = phase.kind === "counting" || phase.kind === "singing";
  return (
    <Dialog
      open={open}
      onClose={() => {
        stopRef.current?.();
        onClose();
      }}
      title="Hum it, Oak drafts it"
      description={
        quiet
          ? "Quiet mode is on, so the mic stays closed. Type the line in the editor instead: degrees as n() values, the degree minus one."
          : `Sing or hum the ${plan.target === "bass" ? "bass line (any octave)" : "melody"} over the click: one bar to count in, then ${plan.bars} ${plan.bars === 1 ? "bar" : "bars"}. Oak drafts it in ${plan.key.tonic} ${plan.key.mode}; you correct it.`
      }
      footer={
        quiet ? (
          <Button onClick={onClose}>Close</Button>
        ) : phase.kind === "draft" ? (
          <>
            <Button onClick={() => setPhase({ kind: "idle" })}>Try again</Button>
            <Button
              variant="primary"
              disabled={phase.draft.notes.length === 0}
              onClick={() => {
                onUse(withDraft(code, phase.line, tempoLine(Math.round(plan.bpm), plan.meter)), phase.draft);
                onClose();
              }}
              data-testid="hum-use"
            >
              {useLabel ?? "Put the draft in the editor"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<Mic aria-hidden className="size-4" />}
              loading={busy}
              onClick={() => void start()}
              data-testid="hum-start"
            >
              {phase.kind === "error" ? "Try again" : "Start"}
            </Button>
          </>
        )
      }
    >
      {quiet ? null : (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="text-sm text-text-3">
            Your voice is analysed live on this computer. Nothing is recorded or sent.
          </p>
          {phase.kind === "counting" ? <p className="text-h3">Count in…</p> : null}
          {phase.kind === "singing" ? (
            <p className="text-h3">
              Sing · bar {phase.bar} of {plan.bars}
            </p>
          ) : null}
          {phase.kind === "error" ? (
            <Callout tone="issue" title="The mic didn't open">
              {phase.message}
            </Callout>
          ) : null}
          {phase.kind === "draft" ? (
            <div className="flex flex-col gap-2" data-testid="hum-draft">
              <p className="text-sm text-text-2">
                Oak's draft ({phase.draft.notes.length} {phase.draft.notes.length === 1 ? "note" : "notes"}).
                It's a starting point, not an answer: listen with A/B and fix what's off.
              </p>
              {phase.degrees.length > 0 ? (
                <p className="text-sm" data-testid="hum-degrees">
                  <span className="text-text-3">Oak heard the degrees </span>
                  <span className="font-mono">{phase.degrees.join(" ")}</span>
                </p>
              ) : null}
              <pre className="whitespace-pre-wrap break-all rounded-control bg-surface-2 p-2 font-mono text-sm">
                {phase.line}
              </pre>
              {draftNotes(phase.draft).map((n) => (
                <p key={n} className="text-sm text-text-2">
                  {n}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
