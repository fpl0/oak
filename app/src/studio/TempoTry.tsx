// Oak 2.0 W3 (PLAN §4 S6, "Choosing a Tempo"): tempo try (slot `tempo-try`, place `toolbar`). The learner's loop
// plays at three tempos, its own and 8 BPM either side, as A, B and C in a shuffled order through `BackToBack`
// (TEMPO_TRY_BARS each), with the BPM hidden. The learner picks one by feel; only then does Oak name its BPM
// ("B was 104 BPM."), and "Use it" writes that tempo line (one undoable change) or "Keep mine" leaves the code as it
// is. Oak never recommends a tempo (W3 fidelity rule 2).
import { Gauge } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/kit/Button.tsx";
import { Dialog } from "../ui/kit/Dialog.tsx";
import type { EditorSlotProps } from "./editor-slots.ts";
import {
  bpmOfCode,
  shuffledOffsets,
  TEMPO_TRY_BARS,
  TEMPO_TRY_WORDS,
  type TempoOption,
  tempoTryOptions,
  withTempo,
} from "./tempo-try.ts";
import { BackToBack } from "./variation/BackToBack.tsx";

export function TempoTry({ liveCode, meter, applyCode }: EditorSlotProps) {
  const [open, setOpen] = useState(false);
  // Each opening gets a new shuffle and forgets the last pick.
  const [round, setRound] = useState(0);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<Gauge aria-hidden className="size-4" />}
        onClick={() => {
          setRound((r) => r + 1);
          setOpen(true);
        }}
        data-testid="tempo-try"
      >
        {TEMPO_TRY_WORDS.button}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={TEMPO_TRY_WORDS.button}
        className="w-[min(94vw,30rem)]"
      >
        {open ? (
          <TempoTryBody
            key={round}
            code={liveCode}
            meter={meter}
            onUse={(code) => {
              applyCode(code);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function TempoTryBody({
  code,
  meter,
  onUse,
  onClose,
}: {
  code: string;
  meter: EditorSlotProps["meter"];
  onUse(code: string): void;
  onClose(): void;
}) {
  // The code and the order are fixed when the tempo try opens: an edit meanwhile does not reshuffle it.
  const [snapshot] = useState(() => ({ code, order: shuffledOffsets(Math.random) }));
  const options: TempoOption[] = tempoTryOptions(snapshot.code, meter, snapshot.order);
  const [picked, setPicked] = useState<TempoOption | null>(null);
  if (snapshot.code.trim() === "")
    return <p className="text-sm text-text-2">{TEMPO_TRY_WORDS.nothingToPlay}</p>;
  const items = options.map((o) => ({
    id: o.name,
    label: TEMPO_TRY_WORDS.option(o.name),
    code: o.code,
    bars: TEMPO_TRY_BARS,
    meter,
  }));
  return (
    <div className="flex flex-col gap-3" data-testid="tempo-try-panel">
      <p className="text-sm text-text-2">{TEMPO_TRY_WORDS.intro}</p>
      <BackToBack items={items} playLabel={TEMPO_TRY_WORDS.play} />
      {picked === null ? (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <Button
              key={o.name}
              size="sm"
              variant="secondary"
              onClick={() => setPicked(o)}
              data-testid="tempo-pick"
            >
              {TEMPO_TRY_WORDS.pick(o.name)}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-testid="tempo-reveal">
          <p className="font-medium" role="status">
            {TEMPO_TRY_WORDS.reveal(picked.name, picked.bpm)}
          </p>
          <p className="text-sm text-text-2">{TEMPO_TRY_WORDS.yours(bpmOfCode(snapshot.code, meter))}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onUse(withTempo(snapshot.code, picked.bpm, meter))}
              data-testid="tempo-use"
            >
              {TEMPO_TRY_WORDS.use}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} data-testid="tempo-keep">
              {TEMPO_TRY_WORDS.keep}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
