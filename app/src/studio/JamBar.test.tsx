// X24: the real Jam bar names a break and leaves playback under the learner's control.
import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { JamBar } = await import("./JamBar.tsx");
const { JAM_WORDS } = await import("./jam.ts");
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const switchToEditing = mock(() => {});
beforeEach(() => {
  sessionStorage.clear();
  switchToEditing.mockClear();
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
const get = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement;
const render = (code: string | null) =>
  act(async () =>
    root.render(<JamBar sketchId="sk1" lastRunCode={code} onSwitchToEditing={switchToEditing} />),
  );

test("AC21: time up has only Switch to editing, which clears the clock", async () => {
  sessionStorage.setItem(
    "oak.studio.timebox.sk1",
    JSON.stringify({ task: "groove", minutes: 5, startedAt: Date.now() - 6 * 60_000 }),
  );
  await render(null);
  const action = get("timebox-switch");
  const callout = action.closest('[role="status"]');
  expect(callout).not.toBeNull();
  expect(callout?.textContent).toContain("Time's up for “groove”. Stop here and take a short break.");
  expect([...(callout?.querySelectorAll("button") ?? [])].map((b) => b.textContent)).toEqual([
    "Switch to editing",
  ]);
  expect(document.querySelector('[data-testid="timebox-keep"]')).toBeNull();
  expect(document.body.textContent).not.toContain("Keep jamming");
  await act(async () => action.click());
  expect(switchToEditing).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem("oak.studio.timebox.sk1")).toBeNull();
});
test("AC22: rough pass shows the listening prompt only with a last Run", async () => {
  await render('setcpm(96/4)\ndrums: s("bd sd")\nbass: note("c2")');
  await act(async () => get("rough-pass-toggle").click());
  expect((get("rough-pass-toggle") as HTMLInputElement).checked).toBe(true);
  expect(get("rough-pass").textContent).toBe("This take has drums and bass.");
  expect(get("rough-pass-listen").textContent).toBe("Listen past the sounds and the mix: how are the notes?");
  await render(null);
  expect(get("rough-pass").textContent).toBe(JAM_WORDS.roughPassEmpty);
  expect(get("rough-pass-listen")).toBeNull();
});
