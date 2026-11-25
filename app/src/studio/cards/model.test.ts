// Oak 2.0 W3 cards (PLAN §4 S6): which cards the learner can draw, drawing one, a "Not this time" card from a habit,
// and the sketch's list of drawn cards. Nothing here ticks, counts or blocks (W3 Review Focus 4).
import { describe, expect, test } from "bun:test";
import type { StudioCard } from "@oak/api";
import { syllabus } from "../../../../content/syllabus.ts";
import { type CardDeck, cardDeck } from "../card-deck.ts";
import { isDescriptive } from "../descriptive.ts";
import {
  availableCards,
  CARD_WORDS,
  cardOf,
  drawCard,
  replaceLastCard,
  withCard,
  withoutCard,
} from "./model.ts";

const A: StudioCard = {
  id: "card.a",
  kind: "focus",
  text: "One part only today.",
  unlock: "U00.L01",
  source: "S",
};
const B: StudioCard = {
  id: "card.b",
  kind: "constraint",
  text: "Drums last.",
  unlock: "U01.L03",
  source: "S",
};
const C: StudioCard = {
  id: "card.c",
  kind: "constraint",
  text: "No chords part.",
  unlock: "U05.L01",
  source: "S",
};

function fakeDeck(calls: string[]): CardDeck {
  return {
    cards: [A, B, C],
    facts: () => ({ bpm: null, tracks: [], tools: [], numerals: [] }),
    describe: () => "",
    habitCard: (id) => {
      calls.push(id);
      return {
        id: `habit.${id}`,
        kind: "avoid",
        text: `Not this time: ${id}.`,
        unlock: "U00.L01",
        source: "S",
      };
    },
  };
}

describe("drawing cards", () => {
  test("availableCards keeps the cards whose lesson is completed", () => {
    expect(availableCards([A, B, C], new Set(["U00.L01", "U01.L03"]))).toEqual([A, B]);
    expect(availableCards([A, B, C], new Set())).toEqual([]);
  });

  test("drawCard never draws a card already on the sketch; null when none is left", () => {
    const at = "2026-11-25T10:00:00.000Z";
    expect(drawCard([A, B], [], () => 0)).toBe(A);
    expect(drawCard([A, B], [{ cardId: "card.a" }], () => 0)).toBe(B);
    expect(drawCard([A, B], [{ cardId: "card.a" }, { cardId: "card.b" }], () => 0)).toBeNull();
    expect(drawCard([], [], () => 0)).toBeNull();
    // An rng at its top end still picks a card of the pool.
    expect(drawCard([A, B, C], [{ cardId: "card.b" }], () => 0.999999)).toBe(C);
    expect(withCard([], "card.a", at).map((c) => c.cardId)).toEqual(["card.a"]);
  });

  test("cardOf resolves a habit card through the deck, a deck card by id, anything else to null", () => {
    const calls: string[] = [];
    const deck = fakeDeck(calls);
    expect(cardOf("habit.sound.bass.ebass", deck)?.id).toBe("habit.sound.bass.ebass");
    expect(calls).toEqual(["sound.bass.ebass"]);
    expect(cardOf("card.b", deck)).toBe(B);
    expect(cardOf("card.gone", deck)).toBeNull();
  });
});

describe("the sketch's drawn cards", () => {
  const at = "2026-11-25T10:00:00.000Z";
  test("withCard twice with the same id keeps one entry; undefined reads as none", () => {
    const once = withCard(undefined, "card.a", at);
    expect(once).toEqual([{ cardId: "card.a", drawnAt: at }]);
    expect(withCard(once, "card.a", "2026-11-26T10:00:00.000Z")).toEqual(once);
  });

  test("withoutCard removes it", () => {
    const two = withCard(withCard([], "card.a", at), "card.b", at);
    expect(withoutCard(two, "card.a")).toEqual([{ cardId: "card.b", drawnAt: at }]);
    expect(withoutCard(undefined, "card.a")).toEqual([]);
  });

  test("replaceLastCard swaps the last drawn card for another", () => {
    const two = withCard(withCard([], "card.a", at), "card.b", at);
    expect(replaceLastCard(two, "card.c", "2026-11-25T11:00:00.000Z")).toEqual([
      { cardId: "card.a", drawnAt: at },
      { cardId: "card.c", drawnAt: "2026-11-25T11:00:00.000Z" },
    ]);
    expect(replaceLastCard([], "card.c", at)).toEqual([{ cardId: "card.c", drawnAt: at }]);
  });
});

describe("words", () => {
  test("every CARD_WORDS value only describes", () => {
    for (const [k, v] of Object.entries(CARD_WORDS)) {
      const text = typeof v === "function" ? v("hh plays in drums.") : v;
      expect({ k, ok: isDescriptive(text) }).toEqual({ k, ok: true });
      expect(text).not.toMatch(/\b(must|should|missing)\b/i);
    }
  });
});

// W3 Step 7: the real deck (W3 stage A wires `cardDeck()`; until then these are skipped and the panels say "Cards
// arrive with this update").
const realDeck = cardDeck();
describe("the real deck", () => {
  test.skipIf(realDeck === null)("every real card is drawable once its lesson is done", () => {
    const deck = realDeck as CardDeck;
    const every = new Set(syllabus.units.flatMap((u) => u.lessons.map((l) => l.id as string)));
    expect(availableCards(deck.cards, every)).toEqual([...deck.cards]);
  });

  test.skipIf(realDeck === null)("a habit card resolves", () => {
    const deck = realDeck as CardDeck;
    const card = cardOf("habit.sound.bass.ebass", deck);
    expect(card?.text).toBe("Not this time: no ebass on the bass.");
    expect(card?.id).toBe("habit.sound.bass.ebass");
  });

  test.skipIf(realDeck === null)("every real card's words only describe", () => {
    const deck = realDeck as CardDeck;
    for (const c of deck.cards)
      for (const s of [c.text, c.instead ?? "", c.source])
        expect({ id: c.id, s, ok: isDescriptive(s) }).toEqual({ id: c.id, s, ok: true });
  });
});
