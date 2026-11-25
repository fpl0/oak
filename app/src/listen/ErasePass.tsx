// Oak 2.0 W4 F3 "Erase and listen" (The Power of Erasing), shared by Studio's aside slot (`ErasePassSlot`) and the
// capstone workspace (`ErasePassCard`). The learner mutes each part in turn ("Now without bass. Do you miss it?") and
// listens; their own mutes are read once at the start and put back when the pass ends, is closed, or the card goes
// away. Only after the pass does Oak say where two parts crowd one register at the same moment; "Show Oak's reading
// now" brings it earlier, and is offered only once the learner has answered "Do you miss it?" for a part (decision
// 127: the question first, then Oak's reading; PLAN §2 rule 3). Every change to the code is offered, never applied
// without a click, and is one undoable edit. There is no quota: keeping every part is a fine result, and the copy
// says so.
import type { EditorHandle, MuteMap } from "@oak/strudel";
import { Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/kit/Button.tsx";
import {
  type CrowdedPair,
  crowdedPairs,
  crowdedSentence,
  crowdingHaps,
  ERASE_COPY,
  erasableParts,
  leaveOut,
  thinLine,
  withPartMuted,
} from "./erase.ts";

/** In Oak one cycle is one bar (contracts §6; the offline renderer reads code the same way). */
const CYCLES_PER_BAR = 1;
/** Bars read when the piece's length is not known yet (Oak's call). */
const DEFAULT_BARS = 8;

type Phase = { kind: "idle" } | { kind: "listening"; index: number } | { kind: "after" };

export function ErasePass({
  code,
  editor,
  applyCode,
  bars,
  testId = "erase-pass",
}: {
  /** The editor's code now. */
  code: string;
  editor(): EditorHandle | null;
  applyCode(code: string): void;
  /** Bars of the piece, when known (Oak's reading covers them). */
  bars: number | null;
  testId?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [parts, setParts] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, "miss" | "keep-out">>({});
  const [reading, setReading] = useState<CrowdedPair[] | "no-haps" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const before = useRef<MuteMap | null>(null);
  const codeRef = useRef(code);
  codeRef.current = code;
  // Read at call time: the unmount cleanup must reach the editor as it is then, not as it was at the first render.
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const restore = () => {
    const m = before.current;
    before.current = null;
    const h = editorRef.current();
    if (m && h && !h.disposed) h.setMutes(m);
  };
  // Closing the card or leaving the page puts the learner's own mutes back.
  useEffect(() => () => restore(), []);

  const muteFor = (part: string | null) => {
    const h = editor();
    if (h && !h.disposed && before.current) h.setMutes(withPartMuted(before.current, part));
  };

  const start = () => {
    const h = editor();
    const list = erasableParts(code);
    setProblem(null);
    if (!h || h.disposed) return setProblem(ERASE_COPY.noEditor);
    if (list.length === 0) return setProblem(ERASE_COPY.noneLeft);
    before.current = h.getMutes();
    setParts(list);
    setAnswers({});
    setReading(null);
    muteFor(list[0] as string);
    setPhase({ kind: "listening", index: 0 });
  };

  const readNow = () => {
    const h = editor();
    if (!h || h.disposed) return setReading("no-haps");
    const haps = h.queryHaps(0, Math.max(1, bars ?? DEFAULT_BARS) * CYCLES_PER_BAR);
    if (haps.length === 0) return setReading("no-haps");
    setReading(
      crowdedPairs(crowdingHaps(haps), {
        cyclesPerBar: CYCLES_PER_BAR,
        order: erasableParts(codeRef.current),
      }),
    );
  };

  const finish = () => {
    restore();
    setPhase({ kind: "after" });
    readNow();
  };

  const advance = (index: number) => {
    const next = index + 1;
    if (next >= parts.length) return finish();
    muteFor(parts[next] as string);
    setPhase({ kind: "listening", index: next });
  };

  const answer = (index: number, a: "miss" | "keep-out") => {
    const part = parts[index] as string;
    setAnswers((s) => ({ ...s, [part]: a }));
    advance(index);
  };

  const close = () => {
    restore();
    setReading(null);
    setPhase({ kind: "idle" });
  };

  const notMissed = parts.filter((p) => answers[p] === "keep-out");

  return (
    <section
      aria-labelledby={`${testId}-title`}
      className="flex flex-col gap-2 rounded-card border border-border bg-surface px-3 py-2.5 text-sm"
      data-testid={testId}
      data-phase={phase.kind}
    >
      <h2 id={`${testId}-title`} className="flex items-center gap-2 font-sans text-sm font-semibold">
        <Eraser aria-hidden className="size-4 text-text-3" />
        {ERASE_COPY.title}
      </h2>
      <p className="text-text-2">{ERASE_COPY.intro}</p>

      {phase.kind === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={start} data-testid="erase-start">
            {ERASE_COPY.start}
          </Button>
        </div>
      )}
      {problem && (
        <p className="text-text-3" role="status">
          {problem}
        </p>
      )}

      {phase.kind === "listening" && (
        <div className="flex flex-col gap-2" data-testid="erase-step" data-part={parts[phase.index]}>
          <p className="font-medium" aria-live="polite">
            {ERASE_COPY.now(parts[phase.index] as string)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => answer(phase.index, "miss")}
              data-testid="erase-miss"
            >
              {ERASE_COPY.missIt}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => answer(phase.index, "keep-out")}
              data-testid="erase-dont-miss"
            >
              {ERASE_COPY.dontMissIt}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => advance(phase.index)} data-testid="erase-next">
              {phase.index + 1 >= parts.length ? ERASE_COPY.finish : ERASE_COPY.next}
            </Button>
            <Button size="sm" variant="ghost" onClick={close} data-testid="erase-close">
              {ERASE_COPY.close}
            </Button>
            {reading === null && Object.keys(answers).length >= 1 && (
              <Button size="sm" variant="ghost" onClick={readNow} data-testid="erase-show-reading">
                {ERASE_COPY.showReading}
              </Button>
            )}
          </div>
        </div>
      )}

      {phase.kind === "after" && (
        <div className="flex flex-col gap-2" data-testid="erase-after">
          {notMissed.length === 0 ? (
            <p className="text-text-2">{ERASE_COPY.keptAll}</p>
          ) : (
            <>
              <p className="text-text-2">{ERASE_COPY.notMissed}</p>
              <ul className="flex flex-col gap-1.5">
                {notMissed.map((part) => (
                  <li
                    key={part}
                    className="flex flex-wrap items-center gap-2"
                    data-testid="erase-part"
                    data-part={part}
                  >
                    <span className="font-mono">{part}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => applyCode(leaveOut(codeRef.current, part))}
                      data-testid="erase-leave-out"
                    >
                      {ERASE_COPY.leaveOut}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyCode(thinLine(codeRef.current, part, "every-other-bar"))}
                      data-testid="erase-every-other-bar"
                    >
                      {ERASE_COPY.everyOtherBar}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyCode(thinLine(codeRef.current, part, "shorter"))}
                      data-testid="erase-shorter"
                    >
                      {ERASE_COPY.shorter}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div>
            <Button size="sm" variant="ghost" onClick={close} data-testid="erase-close">
              {ERASE_COPY.close}
            </Button>
          </div>
        </div>
      )}

      {reading !== null && (
        <div className="flex flex-col gap-1 border-t border-border pt-2" data-testid="erase-reading">
          <h3 className="font-sans text-sm font-semibold text-text-2">{ERASE_COPY.readingTitle}</h3>
          {reading === "no-haps" ? (
            <p className="text-text-3">{ERASE_COPY.runFirst}</p>
          ) : reading.length === 0 ? (
            <p className="text-text-2">{ERASE_COPY.noCrowding}</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1">
                {reading.map((p) => (
                  <li key={`${p.a}:${p.b}`} data-testid="erase-crowded">
                    {crowdedSentence(p)}
                  </li>
                ))}
              </ul>
              <p className="text-text-3">{ERASE_COPY.readingNote}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
