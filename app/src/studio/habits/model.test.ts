// Oak 2.0 W3 habits mirror (PLAN §4 S6): "Not this time" adds the habit's avoidance card once, and the tab's words
// only describe (W3 Review Focus 1 and 4).
import { describe, expect, test } from "bun:test";
import { isDescriptive } from "../descriptive.ts";
import { HABIT_WORDS, habitCardId, notThisTime } from "./model.ts";

describe("Not this time", () => {
  const at = "2026-11-25T10:00:00.000Z";
  test("appends the habit card once", () => {
    const once = notThisTime([], "tempo.84-92", at);
    expect(once).toEqual([{ cardId: "habit.tempo.84-92", drawnAt: at }]);
    expect(notThisTime(once, "tempo.84-92", "2026-11-26T10:00:00.000Z")).toEqual(once);
  });

  test("keeps the cards already drawn, and reads undefined as none", () => {
    const drawn = [{ cardId: "card.no-hats", drawnAt: at }];
    expect(notThisTime(drawn, "sound.bass.ebass", at)).toEqual([
      ...drawn,
      { cardId: "habit.sound.bass.ebass", drawnAt: at },
    ]);
    expect(notThisTime(undefined, "form.loop", at)).toEqual([{ cardId: "habit.form.loop", drawnAt: at }]);
    expect(habitCardId("kit.oak909")).toBe("habit.kit.oak909");
  });
});

describe("words", () => {
  test("the intro and the empty state are the plan's", () => {
    expect(HABIT_WORDS.empty).toBe(
      "Nothing to mirror yet. Habits show once a few of your sketches share something.",
    );
    expect(HABIT_WORDS.intro).toBe(
      "What your sketches have in common so far. Oak reads your own sketches; its starting lines and defaults are left out.",
    );
  });

  test("every HABIT_WORDS value only describes", () => {
    for (const [k, v] of Object.entries(HABIT_WORDS))
      expect({ k, ok: isDescriptive(v) }).toEqual({ k, ok: true });
  });
});
