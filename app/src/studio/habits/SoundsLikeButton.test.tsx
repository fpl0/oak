// X24: the learner writes first; the actual HabitList mounts only on reveal. Only queries and Dialog are stand-ins.
import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { ReactNode } from "react";
import type { EditorSlotProps } from "../editor-slots.ts";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const habits = [
  { id: "tempo.85-97", text: "Most of your sketches sit between 85 and 97 BPM." },
  { id: "sound.bass.ebass", text: "Your sketches give the bass the sound ebass." },
];
const useHabits = mock(() => ({ data: { habits }, isPending: false, isError: false }));
const mutateAsync = mock(async (_input: unknown) => ({}));
mock.module(new URL("./habits-queries.ts", import.meta.url).pathname, () => ({
  useHabits,
  notBuilt: () => false,
}));
mock.module(new URL("../../lib/queries.ts", import.meta.url).pathname, () => ({
  useSketchPatch: () => ({ mutateAsync }),
}));
mock.module(new URL("../../ui/kit/Dialog.tsx", import.meta.url).pathname, () => ({
  Dialog: ({ open, onClose, children }: { open: boolean; onClose(): void; children: ReactNode }) =>
    open ? (
      <div>
        <button type="button" data-testid="close-dialog" onClick={onClose}>
          Close
        </button>
        {children}
      </div>
    ) : null,
}));
const originalFetch = globalThis.fetch;
const fetchSpy = mock(async () => {
  throw new Error("Unexpected network request");
});
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { SoundsLikeButton } = await import("./SoundsLikeButton.tsx");
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  useHabits.mockClear();
  mutateAsync.mockClear();
  fetchSpy.mockClear();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  globalThis.fetch = originalFetch;
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});
const get = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
const field = () => get("sounds-like-same") as unknown as HTMLTextAreaElement;
const click = (id: string) => act(async () => get(id).click());
const fill = (value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(field(), value);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
const render = (id = "sk1") =>
  act(async () => root.render(<SoundsLikeButton {...({ sketch: { id, cards: [] } } as EditorSlotProps)} />));

test("AC12–17: reflection gates the list, persists in the editor, and only Not this time writes", async () => {
  const storageSizes = [localStorage.length, sessionStorage.length];
  await render();
  await click("sounds-like");
  expect(field().tagName).toBe("TEXTAREA");
  expect(container.querySelector(`label[for="${field().id}"]`)?.textContent).toBe(
    "What sounds the same as before?",
  );
  expect(field().hasAttribute("data-autofocus")).toBe(true);
  expect(field().maxLength).toBe(1000);
  const prompts = [...container.querySelectorAll<HTMLButtonElement>('[data-testid="sounds-like-prompt"]')];
  expect(prompts.map((p) => p.textContent)).toEqual(["Sound", "Harmony", "Melody", "Rhythm", "Form"]);
  expect(prompts.map((p) => p.dataset.category)).toEqual(["Sound", "Harmony", "Melody", "Rhythm", "Form"]);
  // A fieldset supplies the group role natively.
  expect(prompts[0]?.parentElement?.tagName).toBe("FIELDSET");
  expect(prompts[0]?.parentElement?.getAttribute("aria-label")).toBe("What sounds the same as before?");
  expect(get("sounds-like-reveal").textContent).toBe("Show what Oak reads across your sketches");
  expect(get("sounds-like-reveal").disabled).toBe(true);
  expect(get("sounds-like-list")).toBeNull();
  for (const habit of habits) expect(container.textContent).not.toContain(habit.text);
  expect(useHabits).not.toHaveBeenCalled();
  await fill("   ");
  expect(get("sounds-like-reveal").disabled).toBe(true);
  expect(get("sounds-like-list")).toBeNull();
  expect(useHabits).not.toHaveBeenCalled();
  await fill("");
  await act(async () => prompts[3]?.click());
  expect(document.activeElement).toBe(field());
  expect(field().value).toBe("Rhythm: ");
  await fill(`${field().value}the same kick every time`);
  expect(field().value).toBe("Rhythm: the same kick every time");
  expect(get("sounds-like-reveal").disabled).toBe(false);
  await act(async () => prompts[0]?.click());
  const text = "Rhythm: the same kick every time\nSound: ";
  expect(field().value).toBe(text);
  expect(document.activeElement).toBe(field());
  await click("sounds-like-reveal");
  for (const habit of habits) expect(get("sounds-like-list").textContent).toContain(habit.text);
  expect(get("sounds-like-list").querySelectorAll('[data-testid="not-this-time"]')).toHaveLength(2);
  expect(field().value).toBe(text);
  expect(
    field().compareDocumentPosition(get("sounds-like-list")) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
  expect(useHabits).toHaveBeenCalled();
  expect(mutateAsync).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
  expect([localStorage.length, sessionStorage.length]).toEqual(storageSizes);
  await click("close-dialog");
  await click("sounds-like");
  expect(field().value).toBe(text);
  expect(get("sounds-like-list")).not.toBeNull();
  await fill(`${text}ebass`);
  expect(field().value).toBe(`${text}ebass`);
  expect(mutateAsync).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
  const avoid = container.querySelector(
    '[data-habit="sound.bass.ebass"] [data-testid="not-this-time"]',
  ) as HTMLButtonElement;
  await act(async () => avoid.click());
  expect(mutateAsync).toHaveBeenCalledTimes(1);
  const input = mutateAsync.mock.calls[0]?.[0] as { body: { cards: { drawnAt: string }[] } };
  const drawnAt = input.body.cards[0]?.drawnAt;
  expect(drawnAt).toBeDefined();
  expect(new Date(drawnAt as string).toISOString()).toBe(drawnAt);
  expect(input).toEqual({
    params: { id: "sk1" },
    body: { cards: [{ cardId: "habit.sound.bass.ebass", drawnAt }] },
  });
});
test("a different sketch resets both reflection and reveal before reading habits", async () => {
  await render();
  await click("sounds-like");
  await fill("same bass");
  await click("sounds-like-reveal");
  useHabits.mockClear();
  await render("sk2");
  expect(field().value).toBe("");
  expect(get("sounds-like-list")).toBeNull();
  expect(get("sounds-like-reveal").disabled).toBe(true);
  expect(useHabits).not.toHaveBeenCalled();
});
