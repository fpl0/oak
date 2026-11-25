// X24: render the actual six fields, with only network, routing and audio stand-ins for CatalogFlow's imports.
import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
mock.module("@tanstack/react-router", () => ({ Link: () => null, useNavigate: () => () => {} }));
mock.module(new URL("../../lib/queries.ts", import.meta.url).pathname, () => ({
  audioUrl: () => "",
  useProfile: () => ({}),
  useSketchCreate: () => ({}),
  useTranscriptions: () => ({}),
}));
mock.module(new URL("./catalog-queries.ts", import.meta.url).pathname, () => ({
  useCatalogCreate: () => ({}),
}));
mock.module(new URL("../../song/player.ts", import.meta.url).pathname, () => ({ stopSong: () => {} }));
mock.module(new URL("../../song/SongPlayButton.tsx", import.meta.url).pathname, () => ({
  SongPlayButton: () => null,
}));
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { LineFields } = await import("./CatalogFlow.tsx");
const { CATALOG_WORDS, emptyLines } = await import("./model.ts");
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
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
test("AC25: Outside's use question directly follows its lines prompt, absent for an ordinary catalog", async () => {
  for (const outside of [true, false]) {
    await act(async () =>
      root.render(<LineFields lines={emptyLines()} onChange={() => {}} outside={outside} />),
    );
    const use = container.querySelector('[data-testid="outside-use"]');
    if (outside) {
      expect(use?.textContent).toBe("Anything here you could use?");
      expect(use?.previousElementSibling?.tagName).toBe("P");
      expect(use?.previousElementSibling?.textContent).toBe(CATALOG_WORDS.outsideLines);
    } else expect(use).toBeNull();
  }
});
