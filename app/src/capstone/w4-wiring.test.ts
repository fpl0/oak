// Oak 2.0 W4 wiring (plan Task 6 Step B3): the capstone workspace slots, W4's editor slots after W1's and W3's, and
// "From a form you mapped" after W3's "With a card" in the New sketch dialog.
import { describe, expect, mock, test } from "bun:test";
import { isDescriptive } from "@oak/content-kit";

// The slot components reach the content bundle, which Vite globs at build time; bun has no `import.meta.glob`.
mock.module(new URL("../lib/content.ts", import.meta.url).pathname, () => ({
  loadContent: async () => ({}),
  contentQuery: { queryKey: ["content"], queryFn: async () => ({}) },
  useContent: () => ({ data: undefined, isPending: false, isError: false }),
}));
// The Studio slots reach the grader worker (a Vite `?worker` import, which bun cannot load); nothing here evaluates.
mock.module(new URL("../lib/grader-client.ts", import.meta.url).pathname, () => ({
  graderHost: async () => {
    throw new Error("no grader worker in unit tests");
  },
  analyzeCode: async () => null,
  gradeInBrowser: async () => null,
  lintInBrowser: async () => null,
  disposeGraderHost: async () => {},
}));
// W3's BackToBack hides a Workbench, which loads the audio worklets (Vite `?worker&url` imports).
mock.module(new URL("../workbench/Workbench.tsx", import.meta.url).pathname, () => ({
  Workbench: () => null,
}));

const { CAPSTONE_SLOTS } = await import("./workspace-slots.ts");
const { EDITOR_SLOTS } = await import("../studio/editor-slots.ts");
const { START_SLOTS } = await import("../studio/start-slots.ts");

describe("W4 registries", () => {
  test("the capstone workspace slots, all in the main column, in order", () => {
    expect(CAPSTONE_SLOTS.map((s) => [s.id, s.place])).toEqual([
      ["commit-after-session", "main"],
      ["better-or-different", "main"],
      ["form-start", "main"],
      ["finish-anyway", "main"],
      ["erase-pass", "main"],
    ]);
    for (const s of CAPSTONE_SLOTS) expect(typeof s.Component).toBe("function");
  });

  test("the editor slots are W1's three, W3's six, then W4's three, in their places", () => {
    expect(EDITOR_SLOTS.map((s) => [s.id, s.place])).toEqual([
      ["make-blank", "header"],
      ["sound-tools", "toolbar"],
      ["commit-guard", "aside"],
      ["sounds-like", "header"],
      ["transforms", "toolbar"],
      ["tempo-try", "toolbar"],
      ["variation", "aside"],
      ["cards", "aside"],
      ["catalog-lines", "aside"],
      ["finish-anyway", "header"],
      ["erase-pass", "aside"],
      ["matched-compare", "aside"],
    ]);
    for (const s of EDITOR_SLOTS) expect(typeof s.Component).toBe("function");
  });

  test("the start slots are With a card, then From a form you mapped, in plain descriptive words", () => {
    expect(START_SLOTS.map((s) => s.id)).toEqual(["with-card", "form-start"]);
    const form = START_SLOTS[1];
    expect(form?.label).toBe("From a form you mapped");
    for (const s of START_SLOTS) {
      expect(isDescriptive(s.label)).toBe(true);
      expect(isDescriptive(s.detail)).toBe(true);
      expect(typeof s.Component).toBe("function");
    }
  });
});
