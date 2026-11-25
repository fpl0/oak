// Oak 2.0 W3 (PLAN §4 S5, S6): plays pieces one after another in one small read-only Workbench — a sketch's parent
// and its siblings, a chain of generations first to last, the tempo try's three tempos. On Play the first item's code
// goes into the player and plays once for its bars (`handle.play({ once })`); at `sequenceTimes`' boundary the player
// stops and the next item plays from bar 1; after the last it stops. Stop works at any time. It never edits the
// sketch: the player is its own editor. `gainOf` (1 for every item by default) is the seam W4's matched-loudness
// compare fills after its merge.
import type { UnlockableId } from "@oak/api";
import { OAK_DEFAULTS } from "@oak/content-kit";
import type { EditorHandle } from "@oak/strudel";
import { Play, Square } from "lucide-react";
import { type JSX, useEffect, useId, useRef, useState } from "react";
import { appWorkbenchServices } from "../../lib/workbench-services.ts";
import { Button } from "../../ui/kit/Button.tsx";
import "../../workbench/index.ts";
import { ServicesGate } from "../../workbench/ServicesGate.tsx";
import { Workbench } from "../../workbench/Workbench.tsx";
import { useUnlockedSet } from "../queries.ts";
import { BACK_TO_BACK_WORDS, type SequenceItem, sequenceTimes, withGain } from "./sequence.ts";

export function BackToBack({
  items,
  playLabel,
  onCurrent,
  gainOf,
  onPlayed,
}: {
  items: readonly SequenceItem[];
  playLabel: string;
  onCurrent?(index: number | null): void;
  gainOf?(index: number): number;
  /** Called at an item's full-bar boundary, never for an interrupted or failed item. */
  onPlayed?(item: SequenceItem, index: number): void;
}): JSX.Element {
  const { unlocked } = useUnlockedSet();
  const slug = `b2b${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [handle, setHandle] = useState<EditorHandle | null>(null);
  const pending = useRef(false);
  // Each start gets a new run number; a timer or a play from an older run does nothing.
  const run = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onCurrentRef = useRef(onCurrent);
  onCurrentRef.current = onCurrent;
  const onPlayedRef = useRef(onPlayed);
  onPlayedRef.current = onPlayed;
  const gainRef = useRef(gainOf);
  gainRef.current = gainOf;

  const show = (index: number | null) => {
    setCurrent(index);
    onCurrentRef.current?.(index);
  };
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const stop = () => {
    run.current++;
    pending.current = false;
    clearTimer();
    if (handle && !handle.disposed) handle.stop();
    show(null);
  };

  const playFrom = async (h: EditorHandle, index: number, id: number) => {
    const list = itemsRef.current;
    const item = list[index];
    if (id !== run.current || h.disposed) return;
    if (!item) {
      h.stop();
      show(null);
      return;
    }
    // A stopped player starts at bar 1, so each item plays its own first bars.
    h.stop();
    h.setCode(withGain(item.code, gainRef.current?.(index) ?? 1), { undoable: false });
    show(index);
    const outcome = await h.play({ once: item.bars });
    if (id !== run.current) return;
    if (!outcome.ok) {
      h.stop();
      setProblem(BACK_TO_BACK_WORDS.didNotRun(item.label));
      show(null);
      return;
    }
    const times = sequenceTimes(list)[index];
    const ms = times ? (times.endSec - times.startSec) * 1000 : 0;
    clearTimer();
    timer.current = setTimeout(() => {
      if (id !== run.current || h.disposed) return;
      onPlayedRef.current?.(item, index);
      void playFrom(h, index + 1, id);
    }, ms);
  };

  const start = (h: EditorHandle) => {
    pending.current = false;
    clearTimer();
    setProblem(null);
    const id = ++run.current;
    void playFrom(h, 0, id);
  };

  // The player mounts on the first Play; it starts as soon as its editor exists.
  useEffect(() => {
    if (handle && pending.current) start(handle);
  }, [handle]);
  useEffect(
    () => () => {
      run.current++;
      clearTimer();
    },
    [],
  );

  const onPlay = () => {
    if (items.length === 0) return;
    if (handle && !handle.disposed) start(handle);
    else {
      pending.current = true;
      setOpen(true);
    }
  };

  const first = items[0];
  const meter = first?.meter ?? OAK_DEFAULTS.meter;
  const key = OAK_DEFAULTS.key;
  const playing = current !== null;
  const now = current === null ? undefined : items[current];

  return (
    <div className="flex flex-col gap-2" data-testid="back-to-back">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={playing ? "secondary" : "primary"}
          icon={playing ? <Square aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          disabled={items.length === 0}
          onClick={playing ? stop : onPlay}
          data-testid={playing ? "back-to-back-stop" : "back-to-back-play"}
        >
          {playing ? BACK_TO_BACK_WORDS.stop : playLabel}
        </Button>
        {now && current !== null ? (
          <span className="text-sm text-text-2" role="status" data-testid="back-to-back-now">
            {BACK_TO_BACK_WORDS.playing(now.label, current, items.length)}
          </span>
        ) : null}
      </div>
      {problem ? (
        <p className="text-sm text-text-2" role="status" data-testid="back-to-back-problem">
          {problem}
        </p>
      ) : null}
      {open && first ? (
        <ServicesGate load={appWorkbenchServices} auto>
          <Workbench
            id={slug}
            code={first.code}
            variant="mini"
            readOnly
            lessonCtx={{ key, meter, defaultBpm: OAK_DEFAULTS.bpm, loopBars: Math.max(1, first.bars) }}
            lint={{
              profile: "studio",
              unlocked: unlocked as ReadonlySet<UnlockableId>,
              allowPreview: true,
              meter,
              key,
            }}
            onHandle={setHandle}
          />
        </ServicesGate>
      ) : null}
    </div>
  );
}
