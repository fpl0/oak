// The checkpoint's Enter hint names what Enter does on the focused control, and follows that control's label while
// it keeps the focus (UX review P3: "Enter stop" stayed up after a replay ended on "Play again"). A DOM simulator
// (happy-dom) renders the hook with React: it checks what the hint says, never layout.
import { afterAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { act, createElement: h, useState } = await import("react");
const { createRoot } = await import("react-dom/client");
const { AnswerEnvProvider } = await import("./env.tsx");
const { useEnterHint } = await import("./ui.tsx");

afterAll(() => GlobalRegistrator.unregister());

let setLabel: (s: string) => void = () => {};
function Probe() {
  const [label, set] = useState("Play again");
  setLabel = set;
  return h(
    "div",
    null,
    h("button", { type: "button", "data-testid": "play" }, label),
    h("button", { type: "button", "data-testid": "next" }, "Next item"),
    h("output", { "data-testid": "hint" }, useEnterHint()),
  );
}

const tick = () => act(async () => await new Promise((r) => setTimeout(r, 5)));

test("the hint follows the focused control's label as it changes, and the focus as it moves", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(h(AnswerEnvProvider, { value: { submitVerb: "save" }, children: h(Probe) })),
  );
  const hint = () => container.querySelector('[data-testid="hint"]')?.textContent;
  expect(hint()).toBe("save");
  const play = container.querySelector<HTMLElement>('[data-testid="play"]');
  await act(async () => play?.focus());
  await tick();
  expect(hint()).toBe("play again");
  // The label changes while Play keeps the focus (a play starts, then ends).
  await act(async () => setLabel("Stop"));
  await tick();
  expect(hint()).toBe("stop");
  await act(async () => setLabel("Play again"));
  await tick();
  expect(hint()).toBe("play again");
  // Another control: the hint names it, and Play's later changes no longer reach the hint.
  await act(async () => container.querySelector<HTMLElement>('[data-testid="next"]')?.focus());
  await tick();
  expect(hint()).toBe("next item");
  await act(async () => setLabel("Stop"));
  await tick();
  expect(hint()).toBe("next item");
  await act(async () => root.unmount());
  container.remove();
});
