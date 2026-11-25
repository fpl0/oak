// X24: the actual listen-through control asks while listening, and retains the chosen mode through Off.
import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { EditorSlotProps } from "./editor-slots.ts";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const setListenThrough = mock((_mode: string | null) => {});
const oak = { master: { setListenThrough } };
const getOak = mock(async () => oak);
mock.module(new URL("../lib/oak.ts", import.meta.url).pathname, () => ({ getOak, peekOak: () => oak }));
mock.module(new URL("../lib/queries.ts", import.meta.url).pathname, () => ({
  useSketchPatch: () => ({ mutate: mock(() => {}) }),
}));
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { SoundTools } = await import("./SoundTools.tsx");
const { COMMIT_COPY } = await import("./commit.ts");
const applyCode = mock((_code: string) => {});
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  applyCode.mockClear();
  setListenThrough.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const props = {
    liveCode: 'setcpm(90/4)\ndrums: s("bd")',
    applyCode,
    cursorLabel: null,
    editor: null,
  } as unknown as EditorSlotProps;
  await act(async () => root.render(<SoundTools {...props} />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});
const get = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement;
const choose = (value: string) =>
  act(async () => {
    const select = get("listen-through") as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
const fill = (text: string) =>
  act(async () => {
    const field = get("heard-field") as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
const submit = () =>
  act(async () => {
    get("heard-prompt").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
test("AC26: Muffled asks while on and Add writes the heard comment after tempo", async () => {
  await choose("muffled");
  expect(setListenThrough).toHaveBeenLastCalledWith("muffled");
  expect(get("listen-through-on").textContent).toBe(COMMIT_COPY.listenOn("Muffled"));
  const label = get("heard-prompt").querySelector("label");
  expect(label?.textContent).toBe(
    "Listen for something that seems to be there but isn't in the code: a note, a rhythm. Write it down, then try to make it real.",
  );
  expect(label?.htmlFor).toBe(get("heard-field").id);
  await fill("a note that isn't there");
  await submit();
  expect(applyCode).toHaveBeenCalledTimes(1);
  expect(applyCode).toHaveBeenLastCalledWith(
    'setcpm(90/4)\n// heard (muffled): a note that isn\'t there\ndrums: s("bd")',
  );
  expect(get("heard-prompt")).toBeNull();
});
test("AC27: Off retains Quiet; Not now stays closed through Off", async () => {
  await choose("quiet");
  expect(get("heard-prompt")).not.toBeNull();
  await choose("off");
  expect(get("heard-prompt")).not.toBeNull();
  expect(get("listen-through-on")).toBeNull();
  await fill("a melody");
  await submit();
  expect(applyCode).toHaveBeenCalledTimes(1);
  expect(applyCode).toHaveBeenLastCalledWith('setcpm(90/4)\n// heard (very quiet): a melody\ndrums: s("bd")');
  await choose("muffled");
  const dismiss = [...get("heard-prompt").querySelectorAll("button")].find(
    (b) => b.textContent === "Not now",
  );
  await act(async () => dismiss?.click());
  expect(get("heard-prompt")).toBeNull();
  await choose("off");
  expect(get("heard-prompt")).toBeNull();
  await choose("quiet");
  expect(get("heard-prompt")).not.toBeNull();
});
test("the prompt waits for audio acceptance and stays closed if audio fails", async () => {
  let rejectAudio: (reason: Error) => void = () => {};
  getOak.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectAudio = reject;
      }),
  );
  await choose("muffled");
  expect(get("heard-prompt")).toBeNull();
  await act(async () => rejectAudio(new Error("No audio")));
  expect(get("heard-prompt")).toBeNull();
  expect((get("listen-through") as HTMLSelectElement).value).toBe("off");
});

test("Off while audio loads cannot reveal or turn on the stale mode", async () => {
  let acceptAudio: (value: typeof oak) => void = () => {};
  getOak.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        acceptAudio = resolve;
      }),
  );
  await choose("muffled");
  await choose("off");
  await act(async () => acceptAudio(oak));
  expect(setListenThrough.mock.calls).toEqual([[null]]);
  expect(get("heard-prompt")).toBeNull();
  expect((get("listen-through") as HTMLSelectElement).value).toBe("off");
});
