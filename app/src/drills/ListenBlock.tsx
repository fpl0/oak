// A listen-only block (contracts §7.4: 15–20 s after every second perceptual set; the opening of a blocked
// introduction): labelled examples of a family's categories, played one after another. Nothing is graded.
import type { FamilyId } from "@oak/api";
import { listenBlock } from "@oak/drills";
import { useEffect, useRef, useState } from "react";
import { getOak } from "../lib/oak.ts";
import { useHotkeys } from "../ui/keys/KeymapProvider.tsx";
import { Button } from "../ui/kit/Button.tsx";
import { Card, Kbd } from "../ui/kit/basics.tsx";
import { listenExampleLines, listenFor } from "./listen-for.ts";
import { playSettled, preloadSpec } from "./runtime.ts";
import type { DrillData } from "./use-drill-data.ts";

export function ListenBlock({
  data,
  familyId,
  level,
  seed,
  onDone,
  doneLabel,
}: {
  data: DrillData;
  familyId: FamilyId;
  level: number;
  seed: number;
  onDone(): void;
  doneLabel: string;
}) {
  const def = data.defs.get(familyId);
  const examples = (() => {
    try {
      const family = data.registry.family(familyId);
      return listenBlock(family, level, seed, data.states.get(familyId)?.openCategories ?? []);
    } catch {
      return [];
    }
  })();
  const lines = listenExampleLines(
    examples.map((e) => e.caption),
    familyId,
    def?.generator,
  );
  const [playing, setPlaying] = useState<number | null>(null);
  const [heard, setHeard] = useState(false);
  const stop = useRef<(() => void) | null>(null);

  const playAll = async () => {
    stop.current?.();
    let cancelled = false;
    stop.current = () => {
      cancelled = true;
    };
    try {
      const oak = await getOak();
      await oak.preload(preloadSpec([...new Set(examples.flatMap((e) => e.plan.preload))]));
      for (let i = 0; i < examples.length && !cancelled; i++) {
        setPlaying(i);
        const h = playSettled(oak, (examples[i] as (typeof examples)[number]).plan);
        const prev = stop.current;
        stop.current = () => {
          prev?.();
          h.stop();
        };
        await h.done;
        await new Promise((r) => setTimeout(r, 450));
      }
    } finally {
      if (!cancelled) {
        setPlaying(null);
        setHeard(true);
      }
    }
  };

  useEffect(() => {
    void playAll();
    return () => stop.current?.();
    // Plays once on arrival; "Play again" replays.
  }, []);
  // A level with nothing to hear (the function family's first level reads chords, it plays none) has no
  // examples: the block steps aside at once rather than showing an empty "Just listen" with nothing in it.
  const skipped = useRef(false);
  useEffect(() => {
    if (examples.length > 0 || skipped.current) return;
    skipped.current = true;
    onDone();
  }, []);
  // Once every example has played, focus moves to the next action (`autoFocus` acts only on the first render).
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (heard) done.current?.focus();
  }, [heard]);

  useHotkeys([
    {
      id: "listen-again",
      keys: "R",
      scope: "global",
      group: "Drills",
      description: "Play the examples again",
      run: () => void playAll(),
    },
    {
      // The button shows Enter: it works wherever focus is (it used to need focus on the button, which only
      // `autoFocus` gave on first render — a keyboard learner pressed Enter and nothing happened).
      id: "listen-done",
      keys: "Enter",
      scope: "global",
      group: "Drills",
      description: "Start the set",
      when: (k) => !k.onControl,
      run: () => {
        stop.current?.();
        onDone();
      },
    },
  ]);

  if (examples.length === 0) return null;
  return (
    <Card className="flex flex-col gap-4 p-6" data-testid="listen-block">
      <div>
        <p className="text-sm text-text-2">Just listen · {def?.title ?? familyId}</p>
        <h2 className="text-h3">Hear each one, nothing to answer.</h2>
        <p className="mt-2 max-w-[60ch] text-text-2" data-testid="listen-for">
          <span className="font-medium text-text">Listen for: </span>
          {listenFor(def)}
        </p>
      </div>
      <ol className="flex flex-col gap-1.5" aria-live="polite">
        {lines.map((line, i) => (
          <li
            key={i}
            aria-current={playing === i ? "true" : undefined}
            className={playing === i ? "font-medium text-text" : "text-text-2"}
          >
            {line}
            {playing === i && <span className="ml-2 text-sm text-accent">playing</span>}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => onDone()} ref={done}>
          {doneLabel} <Kbd tone="inverse">Enter</Kbd>
        </Button>
        <Button onClick={() => void playAll()} disabled={playing !== null}>
          Play again <Kbd>R</Kbd>
        </Button>
      </div>
    </Card>
  );
}
