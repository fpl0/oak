// Oak 2.0 W5 S4: closing the capture dialog while a tap take is still starting (sound unlocking, the click loading)
// starts nothing afterwards: no click plays and Space is not taken app-wide. `getOak` is held by a promise the test
// resolves after the close. A DOM simulator (happy-dom) renders it.
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let releaseOak: (oak: unknown) => void = () => {};
const oakPromise = new Promise((resolve) => {
  releaseOak = resolve;
});
const played: unknown[] = [];
const fakeOak = {
  unlock: async () => {},
  playEvents: (...args: unknown[]) => {
    played.push(args);
    return { startTime: 0, stop: () => {} };
  },
  ctx: { currentTime: 0 },
};

mock.module(new URL("../lib/oak.ts", import.meta.url).pathname, () => ({ getOak: () => oakPromise }));
mock.module(new URL("../lib/queries.ts", import.meta.url).pathname, () => ({
  useSketchCreate: () => ({ mutateAsync: async () => ({}) }),
}));
mock.module(new URL("../studio/scraps/queries.ts", import.meta.url).pathname, () => ({
  useScrapCreate: () => ({ mutateAsync: async () => ({}) }),
}));
mock.module(new URL("../voice/use-voice.ts", import.meta.url).pathname, () => ({
  useVoice: () => ({ quiet: { quiet: false } }),
}));
mock.module(new URL("../transcribe/HumDialog.tsx", import.meta.url).pathname, () => ({
  HumDialog: () => null,
}));
mock.module(new URL("../ui/kit/Dialog.tsx", import.meta.url).pathname, () => ({
  Dialog: ({ children, footer }: { children: unknown; footer: unknown }) => (
    <div>
      {children as never}
      {footer as never}
    </div>
  ),
}));
mock.module("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { CaptureDialog } = await import("./CaptureDialog.tsx");

let container: HTMLDivElement;
beforeAll(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
  });

describe("CaptureDialog: closed while a tap take starts", () => {
  test("nothing plays and Space is not swallowed after the dialog has gone", async () => {
    const root = createRoot(container);
    act(() =>
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <CaptureDialog request={{ to: "scrap", mode: "tap" }} onClose={() => {}} />
        </QueryClientProvider>,
      ),
    );
    const kick = container.querySelector('input[name="capture-drum"][value="bd"]') as HTMLInputElement;
    act(() => kick.click());
    const start = container.querySelector('[data-testid="capture-tap-start"]') as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    act(() => start.click());
    // Closed while `getOak()` is still pending.
    act(() => root.unmount());
    releaseOak(fakeOak);
    await settle();
    expect(played).toEqual([]);
    const space = new KeyboardEvent("keydown", { code: "Space", key: " ", cancelable: true, bubbles: true });
    window.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
  });
});
