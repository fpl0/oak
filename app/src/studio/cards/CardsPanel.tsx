// Oak 2.0 W3 (PLAN §4 S6): the sketch's cards (slot `cards`, place `aside`). Each drawn card shows its text, its
// "Instead, try…" line and the book chapter it comes from; outside Jam, after each Run, one row that only describes
// what the Run holds (`deck.describe` over `deck.facts` of `readPiece(lastRunCode)`). A card without a check has no
// row. "Draw a card", "Another card" (replaces the last drawn) and "Put it back" write `sketches.patch { cards }`.
// Nothing is ticked, counted or blocked; the panel never changes a Run or a save (W3 fidelity rule 1). In Jam the rows
// are hidden (Jam hides critique, W1 rule 2); the cards' own text stays.
import type { CardFacts, StudioCard } from "@oak/api";
import { Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useContent } from "../../lib/content.ts";
import { errorWords } from "../../lib/error-words.ts";
import { useCourseProgress, useSketchPatch } from "../../lib/queries.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { Card } from "../../ui/kit/basics.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { cardDeck } from "../card-deck.ts";
import { readLength } from "../draft.ts";
import type { EditorSlotProps } from "../editor-slots.ts";
import { readPiece } from "../piece-read.ts";
import { tempoOfCode } from "../tempo-try.ts";
import {
  availableCards,
  barsToRead,
  CARD_WORDS,
  cardOf,
  drawCard,
  replaceLastCard,
  withCard,
  withoutCard,
} from "./model.ts";

/** The lesson ids the learner has completed (the unlock of a card). */
export function useCompletedLessons(): ReadonlySet<string> {
  const progress = useCourseProgress();
  const lessons = progress.data?.lessons;
  return useMemo(
    () => new Set((lessons ?? []).filter((l) => l.status === "completed").map((l) => l.lessonId as string)),
    [lessons],
  );
}

/** What the last Run holds for the cards' rows, read once per Run (outside Jam). */
function useRunFacts(o: {
  code: string | null;
  enabled: boolean;
  sketchId: string;
  meter: EditorSlotProps["meter"];
  keySpec: EditorSlotProps["keySpec"];
}): { code: string; facts: CardFacts } | null {
  const deck = cardDeck();
  const content = useContent();
  const toolbox = content.data?.toolbox;
  const [read, setRead] = useState<{ code: string; facts: CardFacts } | null>(null);
  const { code, enabled, sketchId, meter, keySpec } = o;
  useEffect(() => {
    if (!enabled || code === null || deck === null) return;
    const ac = new AbortController();
    const bars = barsToRead(code, readLength(sketchId) ?? 4);
    void readPiece(code, { meter, key: keySpec, bars }, ac.signal).then((piece) => {
      if (ac.signal.aborted || piece === null) return;
      try {
        const facts = deck.facts({
          code,
          n: piece.view.n,
          bpm: tempoOfCode(code, meter),
          slots: piece.analysis.slots,
          toolbox: toolbox ?? [],
        });
        setRead({ code, facts });
      } catch {
        // A read the checkers cannot use leaves the rows as they were.
      }
    });
    return () => ac.abort();
  }, [code, enabled, sketchId, meter, keySpec, deck, toolbox]);
  return read !== null && read.code === code ? read : null;
}

export function CardsPanel({ sketch, lastRunCode, jam, meter, keySpec }: EditorSlotProps) {
  const deck = cardDeck();
  const patch = useSketchPatch();
  const completed = useCompletedLessons();
  const drawn = sketch.cards ?? [];
  const run = useRunFacts({
    code: lastRunCode,
    enabled: !jam && drawn.length > 0,
    sketchId: sketch.id,
    meter,
    keySpec,
  });

  if (deck === null)
    return (
      <Card className="p-4" data-testid="cards-panel">
        <h3 className="flex items-center gap-2 text-h3">
          <Layers aria-hidden className="size-4 text-text-3" />
          {CARD_WORDS.heading}
        </h3>
        <p className="mt-1 text-sm text-text-2" data-testid="cards-not-yet">
          {CARD_WORDS.noDeck}
        </p>
      </Card>
    );

  const available = availableCards(deck.cards, completed);
  const write = async (cards: typeof drawn) => {
    try {
      await patch.mutateAsync({ params: { id: sketch.id }, body: { cards } });
    } catch (e) {
      toast.error(CARD_WORDS.saveFailed, errorWords(e));
    }
  };
  const draw = (replace: boolean) => {
    const next = drawCard(available, drawn, Math.random);
    if (next === null) {
      toast.info(available.length === 0 ? CARD_WORDS.noneOpen : CARD_WORDS.allDrawn);
      return;
    }
    const at = new Date().toISOString();
    void write(replace ? replaceLastCard(drawn, next.id, at) : withCard(drawn, next.id, at));
  };
  const shown = drawn
    .map((d) => ({ drawn: d, card: cardOf(d.cardId, deck) }))
    .filter((x): x is { drawn: (typeof drawn)[number]; card: StudioCard } => x.card !== null);

  return (
    <Card className="p-4" data-testid="cards-panel">
      <h3 className="flex items-center gap-2 text-h3">
        <Layers aria-hidden className="size-4 text-text-3" />
        {CARD_WORDS.heading}
      </h3>
      {shown.length === 0 ? (
        <p className="mt-1 text-sm text-text-2">{CARD_WORDS.none}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {shown.map(({ card }) => {
            const check = card.check;
            const row =
              !jam && check && run !== null ? safeDescribe(() => deck.describe(check, run.facts)) : null;
            return (
              <li
                key={card.id}
                className="rounded-control border border-border p-3"
                data-testid="card"
                data-card={card.id}
              >
                <p className="font-medium" data-testid="card-text">
                  {card.text}
                </p>
                {card.instead ? <p className="mt-1 text-sm text-text-2">{card.instead}</p> : null}
                <p className="mt-1 text-xs text-text-3">{CARD_WORDS.from(card.source)}</p>
                {!jam && card.check ? (
                  <p className="mt-2 text-sm text-text-2" data-testid="card-row" aria-live="polite">
                    {row ?? (lastRunCode === null ? CARD_WORDS.afterRun : "")}
                  </p>
                ) : null}
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1"
                  disabled={patch.isPending}
                  onClick={() => void write(withoutCard(drawn, card.id))}
                  data-testid="card-put-back"
                >
                  {CARD_WORDS.putBack}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={patch.isPending}
          onClick={() => draw(false)}
          data-testid="card-draw"
        >
          {CARD_WORDS.draw}
        </Button>
        {drawn.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={patch.isPending}
            onClick={() => draw(true)}
            data-testid="card-another"
          >
            {CARD_WORDS.another}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/** A describer that throws on an odd read shows no row instead of breaking the panel. */
function safeDescribe(f: () => string): string | null {
  try {
    return f();
  } catch {
    return null;
  }
}
