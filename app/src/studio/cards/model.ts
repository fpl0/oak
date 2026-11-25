// Oak 2.0 W3 (PLAN §4 S6): the cards a sketch holds. A card is a constraint the learner chose (by the book's design an
// arbitrary one): the panel shows its text, its "Instead, try…" line and the chapter it comes from, and after each
// Run one row that only describes what the sketch holds (`deck.describe`). Nothing is ticked, counted or blocked; a
// card never changes a Run or a save (W3 fidelity rule 1). Pure: tested in model.test.ts.
import type { Sketch, StudioCard } from "@oak/api";
import { sectionsFromAst } from "@oak/grader";
import type { CardDeck } from "../card-deck.ts";

/** The bars a read of the piece covers (as the editor's saves read it): the `arrange()` total, else `loopBars`. */
export function barsToRead(code: string, loopBars: number): number {
  try {
    const ast = sectionsFromAst(code);
    if (ast && "totalBars" in ast && ast.totalBars > 0) return ast.totalBars;
  } catch {
    // unreadable code: the loop length
  }
  return loopBars;
}

/** One card drawn for a sketch (`sketches.cards_json`). */
export type DrawnCard = NonNullable<Sketch["cards"]>[number];

/** The cards whose unlock lesson the learner has completed (`lessons.progress`, status `completed`). */
export function availableCards(cards: readonly StudioCard[], completed: ReadonlySet<string>): StudioCard[] {
  return cards.filter((c) => completed.has(c.unlock));
}

/**
 * A card from `available` that is not already on the sketch, picked by `rng` (`Math.random` in the app); `null` when
 * every available card is drawn.
 */
export function drawCard(
  available: readonly StudioCard[],
  drawn: readonly { cardId: string }[],
  rng: () => number,
): StudioCard | null {
  const taken = new Set(drawn.map((d) => d.cardId));
  const pool = available.filter((c) => !taken.has(c.id));
  if (pool.length === 0) return null;
  const i = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));
  return pool[i] ?? null;
}

/** The card a drawn id names: `habit.<id>` is a "Not this time" card (`deck.habitCard`), else a deck card. */
export function cardOf(cardId: string, deck: CardDeck): StudioCard | null {
  if (cardId.startsWith("habit.")) return deck.habitCard(cardId.slice("habit.".length));
  return deck.cards.find((c) => c.id === cardId) ?? null;
}

/** The list with `cardId` drawn at `at` appended; unchanged (a copy) when it is already there. */
export function withCard(cards: Sketch["cards"], cardId: string, at: string): DrawnCard[] {
  const list = [...(cards ?? [])];
  if (list.some((c) => c.cardId === cardId)) return list;
  return [...list, { cardId, drawnAt: at }];
}

/** The list without `cardId` ("Put it back"). */
export function withoutCard(cards: Sketch["cards"], cardId: string): DrawnCard[] {
  return (cards ?? []).filter((c) => c.cardId !== cardId);
}

/** "Another card": the last drawn card replaced by `cardId` (appended when none is drawn). */
export function replaceLastCard(cards: Sketch["cards"], cardId: string, at: string): DrawnCard[] {
  const list = withoutCard(cards, cardId);
  return [...list.slice(0, -1), { cardId, drawnAt: at }];
}

/** Every string of the cards panel and the "With a card" start (descriptive: model.test.ts checks each). */
export const CARD_WORDS = {
  heading: "Cards",
  intro: "A card is a constraint you chose for this sketch. It describes; it never changes a Run or a save.",
  none: "No card on this sketch. Draw one if you would like a constraint to work with.",
  draw: "Draw a card",
  another: "Another card",
  putBack: "Put it back",
  allDrawn: "Every card you have so far is on this sketch.",
  noDeck: "Cards arrive with this update.",
  noneOpen: "Your first card opens with your first lesson.",
  afterRun: "Run the sketch and a line here says what it holds.",
  from: (source: string) => `From “${source}”`,
  startIntro: "Oak draws a card from your deck; you start a sketch with it.",
  start: "Start with this card",
  saveFailed: "The card did not save. Try again.",
} as const;
