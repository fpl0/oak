// Oak 2.0 W1 wiring (plan Task 9 Step B3): the editor slots and the capture engines are registered.
import { describe, expect, mock, test } from "bun:test";

// The slot components reach the content bundle, which Vite globs at build time; bun has no `import.meta.glob`.
mock.module(new URL("../lib/content.ts", import.meta.url).pathname, () => ({
  loadContent: async () => ({}),
  contentQuery: { queryKey: ["content"], queryFn: async () => ({}) },
  useContent: () => ({ data: undefined, isPending: false, isError: false }),
}));

const { captureEngines } = await import("../capture/engines.ts");
const { EDITOR_SLOTS } = await import("./editor-slots.ts");

describe("W1 registries", () => {
  test("the editor slots are Make this my Blank, the sound tools and the commit guard, in their places", () => {
    expect(EDITOR_SLOTS.map((s) => [s.id, s.place])).toEqual([
      ["make-blank", "header"],
      ["sound-tools", "toolbar"],
      ["commit-guard", "aside"],
    ]);
    for (const s of EDITOR_SLOTS) expect(typeof s.Component).toBe("function");
  });

  test("the capture engines are wired: four steady quarter taps at 120 bpm are four hits", () => {
    const engines = captureEngines();
    expect(engines).not.toBeNull();
    expect(engines?.tapsToMini([0, 0.5, 1, 1.5], 120).mini).toBe("x x x x");
    expect(typeof engines?.humFromPcm).toBe("function");
  });
});
