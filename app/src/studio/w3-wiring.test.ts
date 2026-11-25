// Oak 2.0 W3 wiring (plan Task 6 Step B3): the editor slots, the start slots and the card deck are registered.
import { describe, expect, mock, test } from "bun:test";
import { isDescriptive } from "@oak/content-kit";

// The slot components reach the content bundle, which Vite globs at build time; bun has no `import.meta.glob`.
mock.module(new URL("../lib/content.ts", import.meta.url).pathname, () => ({
  loadContent: async () => ({}),
  contentQuery: { queryKey: ["content"], queryFn: async () => ({}) },
  useContent: () => ({ data: undefined, isPending: false, isError: false }),
}));
// W3's slots reach the grader worker (a Vite `?worker` import, which bun cannot load); nothing here evaluates code.
mock.module(new URL("../lib/grader-client.ts", import.meta.url).pathname, () => ({
  graderHost: async () => {
    throw new Error("no grader worker in unit tests");
  },
  analyzeCode: async () => null,
  gradeInBrowser: async () => null,
  lintInBrowser: async () => null,
  disposeGraderHost: async () => {},
}));
// BackToBack's hidden player is a Workbench, which loads the audio worklets (Vite `?worker&url` imports).
mock.module(new URL("../workbench/Workbench.tsx", import.meta.url).pathname, () => ({
  Workbench: () => null,
}));

const { EDITOR_SLOTS } = await import("./editor-slots.ts");
const { START_SLOTS } = await import("./start-slots.ts");
const { cardDeck } = await import("./card-deck.ts");

describe("W3 registries", () => {
  test("the editor slots are W1's three, then W3's six, in their places", () => {
    // W4 appends its slots after these (app/src/capstone/w4-wiring.test.ts pins the whole list).
    expect(EDITOR_SLOTS.slice(0, 9).map((s) => [s.id, s.place])).toEqual([
      ["make-blank", "header"],
      ["sound-tools", "toolbar"],
      ["commit-guard", "aside"],
      ["sounds-like", "header"],
      ["transforms", "toolbar"],
      ["tempo-try", "toolbar"],
      ["variation", "aside"],
      ["cards", "aside"],
      ["catalog-lines", "aside"],
    ]);
    for (const s of EDITOR_SLOTS) expect(typeof s.Component).toBe("function");
  });

  test("the start slots open with With a card, in plain descriptive words", () => {
    // W4 appends "From a form you mapped" (app/src/capstone/w4-wiring.test.ts).
    expect(START_SLOTS[0]?.id).toBe("with-card");
    for (const s of START_SLOTS) {
      expect(isDescriptive(s.label)).toBe(true);
      expect(isDescriptive(s.detail)).toBe(true);
      expect(typeof s.Component).toBe("function");
    }
  });

  test("the card deck is wired: fifteen cards and the grader's checkers", () => {
    const deck = cardDeck();
    expect(deck).not.toBeNull();
    expect(deck?.cards.length).toBe(15);
    expect(deck?.habitCard("sound.bass.ebass")?.id).toBe("habit.sound.bass.ebass");
  });
});
