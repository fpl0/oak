// Oak 2.0 W3 (PLAN §4 S2, S6; closes W1 gap 2): "With a card", a start of the New sketch dialog (`START_SLOTS` entry
// `with-card`, registered by the W3 integrator). Oak draws one card from the learner's deck ("Another card" draws a
// different one); Start creates a Blank sketch (the learner's own Blank, else Oak's: `blankStartBody`), puts the card
// on it (`sketches.patch { cards }`) and opens it. The card is the learner's chosen constraint: it is never checked.
import type { UserTemplate } from "@oak/api";
import { useMemo, useState } from "react";
import { errorWords } from "../../lib/error-words.ts";
import { lintInBrowser } from "../../lib/grader-client.ts";
import { useSketchCreate, useSketchPatch } from "../../lib/queries.ts";
import { Button } from "../../ui/kit/Button.tsx";
import { toast } from "../../ui/kit/Toast.tsx";
import { cardDeck } from "../card-deck.ts";
import { nextSketchTitle, OAK_DEFAULTS, strictLint, strictVerdict } from "../model.ts";
import type { StartSlotProps } from "../start-slots.ts";
import { blankStartBody } from "../starts.ts";
import { useTemplates } from "../templates-queries.ts";
import { useCompletedLessons } from "./CardsPanel.tsx";
import { availableCards, CARD_WORDS, drawCard, withCard } from "./model.ts";

export function WithCardStart({ sketches, sessionId, onCreated }: StartSlotProps) {
  const deck = cardDeck();
  const completed = useCompletedLessons();
  const available = useMemo(() => (deck ? availableCards(deck.cards, completed) : []), [deck, completed]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  // The first card is drawn (one random draw per opening) once the deck and the learner's progress are known;
  // "Another card" draws a different one.
  const [seed] = useState(Math.random);
  const card =
    available.find((c) => c.id === pickedId) ??
    (pickedId === null ? drawCard(available, [], () => seed) : null);
  const mine = useTemplates();
  const yourBlank: UserTemplate | null = (mine.data?.items ?? []).find((t) => t.isBlank) ?? null;
  const create = useSketchCreate();
  const patch = useSketchPatch();
  const [busy, setBusy] = useState(false);

  if (deck === null)
    return (
      <p className="order-first basis-full text-sm text-text-2" data-testid="with-card-not-yet">
        {CARD_WORDS.noDeck}
      </p>
    );
  if (card === null)
    return (
      <p className="order-first basis-full text-sm text-text-2" data-testid="with-card-none">
        {available.length === 0 ? CARD_WORDS.noneOpen : CARD_WORDS.allDrawn}
      </p>
    );

  const another = () => {
    const next = drawCard(available, [{ cardId: card.id }], Math.random);
    if (next) setPickedId(next.id);
  };
  const start = async () => {
    setBusy(true);
    try {
      let body = blankStartBody(yourBlank, {
        title: nextSketchTitle(sketches),
        sessionId,
        bpm: OAK_DEFAULTS.bpm,
        meter: OAK_DEFAULTS.meter,
      });
      // A Blank from a backup: the strict lint decides, as in the dialog's own Blank start.
      if (body.flags.reviewBeforeRun === true) {
        const verdict = await lintInBrowser(
          body.code,
          strictLint(body.meter ?? OAK_DEFAULTS.meter, null),
        ).then(strictVerdict, () => null);
        if (verdict?.safe) {
          const { reviewBeforeRun: _checked, ...flags } = body.flags;
          body = { ...body, flags };
        }
      }
      const saved = await create.mutateAsync({ body });
      await patch.mutateAsync({
        params: { id: saved.sketch.id },
        body: { cards: withCard([], card.id, new Date().toISOString()) },
      });
      onCreated(saved.sketch.id);
    } catch (e) {
      toast.error("Couldn't create the sketch", errorWords(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="order-first flex basis-full flex-col gap-1 rounded-control border border-border bg-surface-2 p-3"
        data-testid="with-card"
        data-card={card.id}
      >
        <p className="text-sm text-text-2">{CARD_WORDS.startIntro}</p>
        <p className="font-medium" data-testid="with-card-text">
          {card.text}
        </p>
        {card.instead ? <p className="text-sm text-text-2">{card.instead}</p> : null}
        <p className="text-xs text-text-3">{CARD_WORDS.from(card.source)}</p>
        {available.length > 1 ? (
          <Button
            variant="link"
            size="sm"
            className="self-start"
            onClick={another}
            disabled={busy}
            data-testid="with-card-another"
          >
            {CARD_WORDS.another}
          </Button>
        ) : null}
      </div>
      <Button variant="primary" loading={busy} onClick={() => void start()} data-testid="with-card-start">
        {CARD_WORDS.start}
      </Button>
    </>
  );
}
