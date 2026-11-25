// X24: the real sequence timer reports full items, never interrupted or failed ones. Audio is a fake editor.
import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { EditorHandle } from "@oak/strudel";
import type { ReactNode } from "react";
import { BACK_TO_BACK_WORDS, type SequenceItem } from "./sequence.ts";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { act, useEffect } = await import("react");
const { createRoot } = await import("react-dom/client");
let plays = 0;
let failAt = -1;
const handle = {
  disposed: false,
  stop: () => {},
  setCode: () => {},
  play: async () => ({ ok: plays++ !== failAt }),
} as unknown as EditorHandle;
mock.module(new URL("../../lib/workbench-services.ts", import.meta.url).pathname, () => ({
  appWorkbenchServices: async () => ({}),
}));
mock.module(new URL("../../workbench/index.ts", import.meta.url).pathname, () => ({}));
mock.module(new URL("../../workbench/ServicesGate.tsx", import.meta.url).pathname, () => ({
  ServicesGate: ({ children }: { children: ReactNode }) => children,
}));
mock.module(new URL("../../workbench/Workbench.tsx", import.meta.url).pathname, () => ({
  Workbench: ({ onHandle }: { onHandle(h: EditorHandle): void }) => {
    useEffect(() => onHandle(handle), [onHandle]);
    return null;
  },
}));
mock.module(new URL("../queries.ts", import.meta.url).pathname, () => ({
  useUnlockedSet: () => ({ unlocked: new Set() }),
}));
const { BackToBack } = await import("./BackToBack.tsx");
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const completed: [SequenceItem, number][] = [];
const current: (number | null)[] = [];
beforeEach(() => {
  plays = 0;
  failAt = -1;
  completed.length = 0;
  current.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});
const sleep = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const click = async (id: string) => {
  const button = container.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
  expect(button).not.toBeNull();
  await act(async () => button.click());
};
async function mount(bars: number) {
  const items: SequenceItem[] = [0, 1, 2].map((i) => ({
    id: `v${i + 1}`,
    label: `Item ${i + 1}`,
    code: "setcpm(6000/4)",
    bars,
    meter: "4/4",
  }));
  await act(async () =>
    root.render(
      <BackToBack
        items={items}
        playLabel="Play"
        onPlayed={(item, i) => completed.push([item, i])}
        onCurrent={(i) => current.push(i)}
      />,
    ),
  );
  await click("back-to-back-play");
  return items;
}

test("AC9: all three completed boundaries report matching items in order", async () => {
  const items = await mount(1);
  await sleep(300);
  expect(completed).toEqual(items.map((item, i) => [item, i]));
  expect(current).toEqual([0, 1, 2, null]);
});
test("AC10: Stop during the second item reports only the first", async () => {
  const items = await mount(25);
  for (let i = 0; i < 30 && !current.includes(1); i++) await sleep(50);
  expect(current.at(-1)).toBe(1);
  await click("back-to-back-stop");
  await sleep(1500);
  expect(completed).toEqual([[items[0], 0]]);
  expect(current.at(-1)).toBeNull();
});
test("AC11: a failed second play reports only the first and explains the stop", async () => {
  failAt = 1;
  const items = await mount(1);
  await sleep(300);
  expect(completed).toEqual([[items[0], 0]]);
  expect(container.querySelector('[data-testid="back-to-back-problem"]')?.textContent).toBe(
    BACK_TO_BACK_WORDS.didNotRun("Item 2"),
  );
  expect(current.at(-1)).toBeNull();
});
test("unmount cancels an unfinished item's boundary", async () => {
  await mount(1);
  act(() => root.unmount());
  root = createRoot(container);
  await sleep(100);
  expect(completed).toEqual([]);
});
test("a new run after Stop never reports the old unfinished item", async () => {
  const items = await mount(1);
  await click("back-to-back-stop");
  await click("back-to-back-play");
  await sleep(300);
  expect(completed).toEqual(items.map((item, i) => [item, i]));
});
