// Oak 2.0 W3: the Studio's card deck (PLAN §4 S6), behind one function so the cards panel and "With a card" can be
// built before the deck exists. W3 stage A wired it: `content/studio/cards.ts` and `@oak/grader`'s checkers
// (`facts`, `describe` and `habitCard` are exactly `cardFacts`, `describeCard` and `habitCard`). The panels still treat
// `null` as "no deck" and show nothing.
import { STUDIO_CARDS } from "@content/studio/cards.ts";
import type { AnalysisSummary, CardCheck, CardFacts, StudioCard, ToolEntry } from "@oak/api";
import { cardFacts, describeCard, habitCard, type Normalized } from "@oak/grader";

export interface CardDeck {
  cards: readonly StudioCard[];
  /** `cardFacts` (`@oak/grader`): what the sketch holds, learner tracks only. */
  facts(o: {
    code: string;
    n: Normalized;
    bpm: number | null;
    slots: AnalysisSummary["slots"] | null;
    toolbox: readonly ToolEntry[];
  }): CardFacts;
  /** `describeCard`: one descriptive sentence, never a verdict. */
  describe(check: CardCheck, facts: CardFacts): string;
  /** `habitCard`: a "Not this time" card from a habit id, or `null`. */
  habitCard(habitId: string): StudioCard | null;
}

const DECK: CardDeck = { cards: STUDIO_CARDS, facts: cardFacts, describe: describeCard, habitCard };

export function cardDeck(): CardDeck | null {
  return DECK;
}
