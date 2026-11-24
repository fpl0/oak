// The unlock moment (ux §5.1 "Unlock ceremony", contracts §9.3: at most 8 seconds, skippable with Esc,
// replayable from the Toolbox). Used by the Coda (and the lesson player when a session grants a tool) and by
// the Toolbox's "Replay". The card appears (a cross-fade under reduced motion), a short I–IV–V–I arpeggio
// sounds on the UI bus, the tool's demo plays for at most two bars (never past 8 s), and the footer says
// where to read more. The unlocks are marked seen when the moment ends.
//
//   <UnlockMoment toolIds={["tb.gain"]} onDone={() => …} />
import type { ToolEntry } from "@oak/content-kit";
import type { PatternPlayer } from "@oak/strudel";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Play, Sparkles, Square } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useContent } from "../lib/content.ts";
import { lessonTitles } from "../lib/content-model.ts";
import { peekOak } from "../lib/oak.ts";
import { useUnlockSeen, useUnlocks } from "../lib/queries.ts";
import { InlineCodeText } from "../session/today/SideOffer.tsx";
import { Button } from "../ui/kit/Button.tsx";
import { Kbd } from "../ui/kit/basics.tsx";
import { FeatureGlimpse } from "./Glimpse.tsx";
import { glimpseOf } from "./glimpse.ts";
import { shownToolMeaning, shownToolLabel as toolLabel } from "./label.ts";
import { KIND_LABEL, sitesOf, unlockArpeggio } from "./model.ts";
import { VoicingCompare } from "./VoicingCompare.tsx";

/** The whole moment never runs longer than this (contracts §9.3). */
export const UNLOCK_MOMENT_MAX_MS = 8000;

export interface UnlockMomentProps {
  /** The entries granted now (tool, sound, scale, chord, feature, lens or template IDs). */
  toolIds: readonly string[];
  /** The moment ended: Continue, Esc, or the demo finished and the learner moved on. */
  onDone(): void;
  /** Play the arpeggio and the first demo by itself (default true). Needs the adapter to exist already. */
  autoPlay?: boolean;
  /** Mark these unlocks seen (`unlocks.seen`) when the moment ends (default true). */
  markSeen?: boolean;
  /** The primary button's label (default "Continue"). */
  continueLabel?: string;
  className?: string;
}

export function UnlockMoment({
  toolIds,
  onDone,
  autoPlay = true,
  markSeen = true,
  continueLabel = "Continue",
  className,
}: UnlockMomentProps) {
  const content = useContent();
  const unlocks = useUnlocks();
  const seen = useUnlockSeen();
  const titleId = useId();
  const byId = new Map((content.data?.toolbox ?? []).map((t) => [t.id as string, t]));
  const tools = toolIds.map((id) => byId.get(id)).filter((t): t is ToolEntry => !!t);
  const titles = lessonTitles(content.data?.syllabus ?? null);
  const [playing, setPlaying] = useState<string | null>(null);
  const player = useRef<PatternPlayer | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ended = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const stopDemo = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    player.current?.stop();
    setPlaying(null);
  };

  const playDemo = async (t: ToolEntry, budgetMs = UNLOCK_MOMENT_MAX_MS) => {
    const oak = peekOak();
    if (!oak || !t.catalog.demo.trim()) return;
    stopDemo();
    player.current ??= oak.createPatternPlayer();
    const p = player.current;
    // The demo is authored code (strict, previews allowed): it plays whatever the learner has unlocked.
    const out = await p.load(t.catalog.demo, {
      bars: 2,
      cps: 0,
      lint: { profile: "content", unlocked: new Set(), allowPreview: true, meter: "4/4", key: null },
    });
    if (!out.ok || ended.current) return;
    await p.play();
    setPlaying(t.id);
    const cps = oak.transport.cps() || 0.5;
    const twoBars = (2 / cps) * 1000;
    stopTimer.current = setTimeout(stopDemo, Math.min(twoBars, budgetMs));
  };

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    stopDemo();
    if (markSeen) {
      const unseen = new Set(
        (unlocks.data?.items ?? []).filter((u) => !u.seen).map((u) => u.itemId as string),
      );
      for (const id of toolIds) if (unseen.has(id)) seen.mutate({ params: { id } });
    }
    doneRef.current();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // Esc skips (capture: before the shell's own Esc, which would leave a focus route).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      finishRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // The arpeggio, then the first demo, inside the 8-second budget.
  const first = tools[0];
  useEffect(() => {
    if (!autoPlay || !first) return;
    const oak = peekOak();
    if (!oak) return;
    const arp = unlockArpeggio();
    oak.ui.play(arp.map((n) => ({ midi: n.midi, at: n.at, dur: n.dur })));
    const lead = Math.ceil(((arp.at(-1)?.at ?? 0) + 0.3) * 1000);
    const t = setTimeout(() => void playDemo(first, UNLOCK_MOMENT_MAX_MS - lead), lead);
    return () => clearTimeout(t);
  }, [first?.id]);

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      player.current?.dispose();
      player.current = null;
    },
    [],
  );

  if (tools.length === 0) return null;
  return (
    <section
      aria-labelledby={titleId}
      className={clsx("flex flex-col gap-4", className)}
      data-testid="unlock-moment"
    >
      <h2 id={titleId} className="flex items-center gap-2 text-h3">
        <Sparkles aria-hidden className="size-5 text-accent-2" />
        New in your toolbox
      </h2>
      <ul className={clsx("grid gap-3", tools.length > 1 && "sm:grid-cols-2")}>
        {tools.map((t, i) => (
          <li
            key={t.id}
            className="animate-pop-in rounded-card border border-accent/50 bg-lane-in p-4"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <p className="text-sm text-text-2">{KIND_LABEL[t.kind]}</p>
            <p className={clsx("mt-0.5 text-h3 text-text", toolLabel(t).mono && "font-mono")}>
              {toolLabel(t).text}
            </p>
            <p className="mt-2 text-text">
              <InlineCodeText text={shownToolMeaning(t)} />
            </p>
            {glimpseOf(t.id) ? (
              <div className="mt-3">
                <FeatureGlimpse glimpse={glimpseOf(t.id) as NonNullable<ReturnType<typeof glimpseOf>>} />
              </div>
            ) : null}
            <p className="mt-1 text-sm text-text-2">
              From{" "}
              {sitesOf(t)
                .map((s) => titles.get(s) ?? titles.get(s.replace(/\.S\d+$/, "")) ?? s)
                .join(" or ")}
              .
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {t.catalog.demo.trim() && peekOak() ? (
                <Button
                  size="sm"
                  icon={
                    playing === t.id ? (
                      <Square aria-hidden className="size-3.5" />
                    ) : (
                      <Play aria-hidden className="size-3.5" />
                    )
                  }
                  onClick={() => (playing === t.id ? stopDemo() : void playDemo(t))}
                  aria-pressed={playing === t.id}
                >
                  {playing === t.id ? "Stop" : "Hear it"}
                </Button>
              ) : null}
              <span className="text-sm text-text-2">
                {t.kind === "feature" || t.kind === "lens" ? "Ready to use. " : "Now in autocomplete. "}
                <Link to="/toolbox/$toolId" params={{ toolId: t.id }} className="text-link" onClick={finish}>
                  Read more in the toolbox
                </Link>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {/* voicing() arrives after voicing by hand (contracts §3.1 rule 6): the two side by side. */}
      {toolIds.includes("tb.voicing") ? <VoicingCompare /> : null}
      {/* Kept in view while a long moment (the voicing comparison) scrolls. */}
      <div className="sticky -bottom-5 -mb-5 flex items-center justify-end gap-3 bg-surface pt-2 pb-5">
        <span className="text-sm text-text-3">
          <Kbd>Esc</Kbd> skips
        </span>
        <Button variant="primary" onClick={finish} data-testid="unlock-continue">
          {continueLabel}
        </Button>
      </div>
    </section>
  );
}
