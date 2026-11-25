// Oak 2.0 W3 (PLAN §4 S6): the habits mirror. The server reads the learner's own sketches (`habits.get`, X16) and
// says, in plain sentences, what several of them share; Oak's starting lines and defaults are left out. "Not this
// time" turns one habit into an avoidance card on the sketch open now (`habit.<habit id>`, shown by the cards panel
// through `deck.habitCard`). Plain words only: no counts as goals, no charts. Pure: tested in model.test.ts.
import type { Sketch } from "@oak/api";
import { type DrawnCard, withCard } from "../cards/model.ts";

/** The drawn-card id of a habit's "Not this time" card. */
export const habitCardId = (habitId: string): string => `habit.${habitId}`;

/** The sketch's cards with the habit's avoidance card appended (drawn at `at`); unchanged when it is already there. */
export function notThisTime(cards: Sketch["cards"], habitId: string, at: string): DrawnCard[] {
  return withCard(cards, habitCardId(habitId), at);
}

/** Every string of the Habits tab and "Sounds like something you made before?" (descriptive: model.test.ts). */
export const HABIT_WORDS = {
  tab: "Habits",
  intro:
    "What your sketches have in common so far. Oak reads your own sketches; its starting lines and defaults are left out.",
  empty: "Nothing to mirror yet. Habits show once a few of your sketches share something.",
  soundsLike: "Sounds like something you made before?",
  soundsLikeIntro:
    "What your sketches share so far. “Not this time” puts that habit on this sketch as a card.",
  notThisTime: "Not this time",
  onThisSketch: "On this sketch as a card",
  close: "Close",
  loadFailed: "Oak could not read your habits just now.",
  notYet: "The habits mirror arrives with this update.",
} as const;
