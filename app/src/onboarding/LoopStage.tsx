// The loop, the edit and the reaction (ux §8 `onb.loop`, `onb.edit`, `onb.react`) on one Workbench that stays
// mounted across the three screens, so the music never stops between them. The build-up is conducted from
// outside the workbench: the editor's mutes open one layer per bar (drums, bass in bar 2, chords in bar 3, the
// melody in bar 5) on the transport's own clock.
//
// Each screen has the onboarding frame (docs/design/retry.md §6.1): its name as the heading, one sentence saying
// what to do, the stage, the status line, and the footer. The reaction can be tried again as often as the learner
// likes: Try again puts the cursor on the boxed number, and every number that runs becomes theirs (`onEdited`).
// No music lenses here (no "guide tones", no "avoid 11" on the second screen of the course), and the playback
// highlights are hidden so that the only box drawn in the code is the one number to change.
import type { OnboardingStep } from "@oak/api";
import type { CodeRange } from "@oak/content-kit";
import { type EvalOutcome, editorId } from "@oak/strudel";
import { clsx } from "clsx";
import { ArrowRight, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/kit/Button.tsx";
import { Chip, Kbd } from "../ui/kit/basics.tsx";
import { Callout } from "../ui/kit/Controls.tsx";
import { PartActions, type PartBack, PartFrame, StatusSlot } from "../voice/parts/common.tsx";
import { useWorkbenchServices, Workbench } from "../workbench/index.ts";
import {
  BUILD_BARS,
  editableRange,
  isChanged,
  LAYERS,
  type Layer,
  lineRanges,
  mutedAt,
  ONBOARDING_LOOP,
  REACTIONS,
  readEdit,
  STARTER_VALUE,
  withEdit,
} from "./loop.ts";
import { LOOP_LESSON_CTX, ONBOARDING_LINT } from "./services.ts";

export const LOOP_EDITOR = "onb-loop";
const EDITOR_ID = editorId(LOOP_EDITOR, 0);

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * On the edit and reaction screens the one box in the code is the number to change: Strudel's playback outlines
 * (drawn as inline styles on every token that plays) are hidden there, and the target box is drawn strongly.
 *
 * Day 1 asks only to listen and change one number: the transport keeps play/stop, the bar counter and the
 * musicians' mute chips. Tempo, metre, key, practice speed, solo and the read-only badge are terms and tools the
 * first lessons bring; shown here they were noise. The Workbench's own `transport="minimal"` leaves them out (the
 * loop region and metronome are off through `loopControls`).
 */
const QUIET_CODE_CSS = `
.onb-loop--edit .cm-content [style*="outline"] { outline: none !important; }
.onb-loop--edit .oak-mark-target { outline: 2px solid var(--oak-accent) !important; outline-offset: 1px; border-radius: 2px; }
`;

export interface LoopStageProps {
  step: Extract<OnboardingStep, "loop" | "edit" | "react">;
  /** The number the learner chose (a resumed session starts from it). */
  firstEdit: number | null;
  /** A number ran: on the edit screen it finishes the step; on the reaction it becomes the learner's number. */
  onEdited(value: number, code: string): void;
  onContinue(): void;
  onCode?(code: string): void;
  back?: PartBack | null;
}

/** Bars of the build-up heard so far (0 before it starts); `null` while stopped. */
function useBuildUp(active: boolean): { bar: number | null; playing: boolean; restart(): void } {
  const { oak } = useWorkbenchServices();
  const [bar, setBar] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const start = useRef<number | null>(null);
  const lastMutes = useRef<string>("");
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let iv: ReturnType<typeof setInterval> | null = null;
    start.current = null;
    lastMutes.current = "";
    const apply = (muted: Layer[]) => {
      const h = oak.editors.get(EDITOR_ID);
      const key = muted.join(",");
      if (!h || h.disposed || key === lastMutes.current) return;
      // The learner touched the mute chips: the build-up is theirs now.
      const cur = [...h.getMutes().muted].sort().join(",");
      if (lastMutes.current !== "" && cur !== [...lastMutes.current.split(",")].sort().join(",")) return;
      h.setMutes({ muted: new Set(muted), solo: null });
      lastMutes.current = key;
    };
    const run = async () => {
      // Wait for the workbench's editor.
      for (let i = 0; i < 100 && !oak.editors.get(EDITOR_ID); i++)
        await new Promise((r) => setTimeout(r, 30));
      const h = oak.editors.get(EDITOR_ID);
      if (!h || stopped) return;
      apply(mutedAt(0));
      await oak.unlock();
      if (!h.playing) await h.play();
      if (stopped) return;
      start.current = Math.floor(oak.transport.audibleCycle() + 1e-6);
      iv = setInterval(() => {
        if (h.disposed) return;
        setPlaying(h.playing);
        if (!h.playing || start.current === null) return;
        const b = Math.max(0, Math.floor(oak.transport.audibleCycle() - start.current));
        setBar(b);
        if (b <= BUILD_BARS) apply(mutedAt(b));
      }, 80);
    };
    void run();
    return () => {
      stopped = true;
      if (iv) clearInterval(iv);
    };
  }, [active, oak, epoch]);

  return {
    bar,
    playing,
    restart: () => {
      setBar(null);
      setEpoch((e) => e + 1);
    },
  };
}

function LayerRow({ bar }: { bar: number | null }) {
  const muted = new Set(bar === null ? [] : mutedAt(bar));
  return (
    <ul className="flex flex-wrap gap-2" aria-label="The four musicians" data-testid="layers">
      {LAYERS.map((l) => {
        const on = bar !== null && !muted.has(l.id);
        return (
          <li
            key={l.id}
            data-layer={l.id}
            data-on={on ? "1" : "0"}
            className={clsx(
              "flex items-center gap-2 rounded-card border px-3 py-1.5 text-sm transition-colors duration-200",
              on ? "border-accent/50 bg-lane-in" : "border-border bg-surface",
            )}
          >
            <span
              className={clsx("size-2 rounded-full", on ? "bg-accent" : "border border-text-3")}
              aria-hidden
            />
            <span className="font-medium">{l.name}</span>
            <span className="text-text-3">
              {on ? "playing" : bar === null ? `enters in bar ${l.entersAtBar}` : `in bar ${l.entersAtBar}`}
            </span>
            <Chip
              className="hidden xl:inline-flex"
              title={`You write ${l.tool} yourself from ${l.unlockLesson}`}
            >
              you'll unlock this
            </Chip>
          </li>
        );
      })}
    </ul>
  );
}

export function LoopStage(props: LoopStageProps) {
  const { oak } = useWorkbenchServices();
  const { step, firstEdit, back } = props;
  const [code, setCode] = useState(() =>
    firstEdit !== null && step !== "loop" ? withEdit(ONBOARDING_LOOP, firstEdit) : ONBOARDING_LOOP,
  );
  const [ran, setRan] = useState<number | null>(firstEdit);
  const [runs, setRuns] = useState(0);
  const [problem, setProblem] = useState<{ text: string; n: number } | null>(null);
  const build = useBuildUp(step === "loop");
  const heard = build.bar !== null && build.bar >= BUILD_BARS;
  const propsRef = useRef(props);
  propsRef.current = props;
  const continueRef = useRef<HTMLButtonElement>(null);
  // The build-up has been heard: Continue opens and takes the focus, so Enter goes on (retry.md §6.5 item 6).
  useEffect(() => {
    if (heard) requestAnimationFrame(() => continueRef.current?.focus());
  }, [heard]);
  // Arriving on the reaction (from ⌘↵ in the code): Continue has the focus, so Enter goes on; Try again puts the
  // cursor back on the box.
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step !== "react") return;
    const f = requestAnimationFrame(() =>
      stage.current?.querySelector<HTMLElement>('[data-testid="result-continue"]')?.focus(),
    );
    return () => cancelAnimationFrame(f);
  }, [step]);

  // The one editable number: an editable region per mode (the editor maps it through the learner's edits, so an
  // emptied slot stays typeable); the Workbench redraws its box after every edit (`targetRegions`).
  const editMode = step === "loop" ? "listen" : "edit";
  const ro = useRef<{ mode: string; value: true | { editable: CodeRange[] } } | null>(null);
  if (ro.current?.mode !== editMode) {
    const r = editableRange(code);
    ro.current = { mode: editMode, value: editMode === "listen" || !r ? true : { editable: [r] } };
  }
  const readOnly = ro.current.value;
  useEffect(() => {
    const h = oak.editors.get(EDITOR_ID);
    if (!h || h.disposed) return;
    // From the edit on, the whole band plays: the build-up is over.
    if (editMode === "edit") h.setMutes({ muted: new Set(), solo: null });
    // The box on entering the edit: the Workbench redraws it after every change (`targetRegions`), but the
    // editable region is only set once the new mode reaches the editor.
    const f = requestAnimationFrame(() => {
      if (h.disposed) return;
      const live = h.editableRanges();
      const r = live && live.length > 0 ? live[0] : editableRange(h.getCode());
      h.setMarks(editMode === "edit" && r ? [{ range: r, kind: "target" }] : []);
    });
    return () => cancelAnimationFrame(f);
  }, [editMode, oak]);

  // Arriving on the edit: the cursor is on the boxed number, so the learner types the new one and presses ⌘↵
  // (before, the focus sat on "Run it", and Enter there only said "That's still 4").
  useEffect(() => {
    if (step !== "edit") return;
    let f = requestAnimationFrame(() => {
      f = requestAnimationFrame(() => {
        const h = oak.editors.get(EDITOR_ID);
        if (!h || h.disposed) return;
        const live = h.editableRanges();
        const one = editableRange(h.getCode());
        const r = live && live.length > 0 ? live : one ? [one] : null;
        if (r) h.focusRanges(r);
        h.view.focus();
      });
    });
    return () => cancelAnimationFrame(f);
  }, [step, oak]);

  /** Puts the cursor on the boxed number (the edit screen's Try again, the reaction's Try again). */
  const focusBox = () => {
    const h = oak.editors.get(EDITOR_ID);
    if (!h || h.disposed) return null;
    const r = h.editableRanges();
    if (r && r.length > 0) h.focusRanges(r);
    h.view.focus();
    return h.view.contentDOM;
  };

  const onEvaluated = (o: EvalOutcome) => {
    if (step === "loop" || !o.ok) return;
    const { text, value } = readEdit(o.code);
    if (value === null) {
      setProblem((p) => ({
        n: (p?.n ?? 0) + 1,
        text:
          text === ""
            ? "The box is empty. Type a number from 0 to 7."
            : `"${text}" isn't a number from 0 to 7. The melody uses eight notes, numbered 0 to 7.`,
      }));
      return;
    }
    if (!isChanged(value) && ran === null) {
      setProblem((p) => ({
        n: (p?.n ?? 0) + 1,
        text: `That's still ${STARTER_VALUE}, the number it started with. Try another one.`,
      }));
      return;
    }
    setProblem(null);
    setRan(value);
    setRuns((n) => n + 1);
    propsRef.current.onEdited(value, o.code);
    // Another number on the reaction is a new result: Continue takes the focus, so Enter goes on and Alt+R (Try
    // again) puts the cursor back on the box. Without it the keyboard was left in the code, nineteen Tabs away.
    if (propsRef.current.step === "react")
      requestAnimationFrame(() =>
        stage.current?.querySelector<HTMLElement>('[data-testid="result-continue"]')?.focus(),
      );
  };

  const run = async () => {
    const h = oak.editors.get(EDITOR_ID);
    if (!h || h.disposed) return;
    await oak.unlock();
    await h.evaluate({ autostart: true });
  };

  const mod = isMac() ? "⌘" : "Ctrl";
  const reaction = ran !== null ? REACTIONS[ran] : undefined;
  const lines = lineRanges(code);

  const workbench = (
    <div
      className={clsx("onb-loop", step === "loop" ? "onb-loop--build" : "onb-loop--edit")}
      data-lines={Object.keys(lines).join(" ")}
    >
      <style>{QUIET_CODE_CSS}</style>
      <Workbench
        id={LOOP_EDITOR}
        code={code}
        lessonCtx={LOOP_LESSON_CTX}
        lint={ONBOARDING_LINT}
        unit="U00"
        views={["roll"]}
        variant="compact"
        roll={{ color: "part", labels: "none" }}
        lenses={null}
        targetRegions={step !== "loop"}
        loopControls={false}
        transport="minimal"
        readOnly={readOnly}
        onChange={(c) => {
          setCode(c);
          props.onCode?.(c);
        }}
        onEvaluated={onEvaluated}
      />
    </div>
  );

  // One tree for the three screens: the Workbench keeps its place (and keeps playing) from screen to screen.
  const loop = step === "loop";
  const edit = step === "edit";
  return (
    <div ref={stage} className="contents">
      <PartFrame
        testId={`screen-${step}`}
        context="onboarding"
        title={loop ? "Your first loop" : edit ? "Change one number" : "What you changed"}
        instruction={
          loop ? (
            "Listen: the four musicians come in one at a time."
          ) : edit ? (
            <>
              Change the boxed <span className="font-mono">4</span> to any number from 0 to 7, then run it.
            </>
          ) : (
            "Listen to the fourth bar, then try another number or go on."
          )
        }
        lead={
          loop ? (
            "This is code. Each line is a musician: drums, then bass, then chords, then the melody. You'll learn to write every one of them."
          ) : edit ? (
            <>
              It is the melody's last note, in the last line; you'll hear it in the fourth bar of every loop.
              Run it with <Kbd>{mod}</Kbd> <Kbd>Enter</Kbd> in the code, or the button below.
            </>
          ) : null
        }
      >
        {loop ? <LayerRow bar={build.bar} /> : null}
        {/* The result sits above the code: the roll is taller than the screen. */}
        <StatusSlot>
          {!loop && !edit && reaction && (
            <Callout tone="info" title={reaction.title}>
              <span data-testid="react-reaction">{reaction.body}</span>
              <span className="mt-1 block text-text-3">{reaction.listen}</span>
            </Callout>
          )}
          {!loop && problem && <Callout tone="attention" title={problem.text} />}
        </StatusSlot>
        {workbench}
        {loop ? (
          <PartActions
            context="onboarding"
            back={back}
            resultKey={null}
            onRetry={null}
            onContinue={null}
            testId="loop-actions"
            extra={
              !build.playing && build.bar !== null ? (
                <Button onClick={build.restart} icon={<Play aria-hidden className="size-4" />}>
                  Hear it again
                </Button>
              ) : null
            }
            action={
              <Button
                ref={continueRef}
                variant={heard ? "primary" : "secondary"}
                disabled={!heard}
                title={heard ? undefined : "Listening to the build-up…"}
                onClick={props.onContinue}
                icon={heard ? <ArrowRight aria-hidden className="size-4" /> : undefined}
                data-testid="loop-continue"
              >
                {heard ? "Continue" : "Listening to the build-up…"}
              </Button>
            }
          />
        ) : edit ? (
          <PartActions
            context="onboarding"
            back={back}
            resultKey={problem ? `problem-${problem.n}` : null}
            onRetry={
              problem
                ? () => {
                    setProblem(null);
                  }
                : null
            }
            retryFocus={focusBox}
            onContinue={null}
            testId="edit-actions"
            action={
              <Button variant="primary" onClick={() => void run()} data-testid="edit-run">
                Run it
              </Button>
            }
          />
        ) : (
          <PartActions
            context="onboarding"
            back={back}
            resultKey={`react-${ran ?? "none"}-${runs}`}
            onRetry={() => {
              setProblem(null);
            }}
            retryFocus={focusBox}
            onContinue={props.onContinue}
            testId="react-actions"
            extra={
              <span className="text-sm text-text-3">
                Change the number in the box and press <Kbd>{mod}</Kbd> <Kbd>Enter</Kbd>.
              </span>
            }
          />
        )}
      </PartFrame>
    </div>
  );
}
