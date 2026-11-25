// Oak 2.0 W5 S5 and S6: "Finish it anyway" as the learner meets it from Delete or Archive.
//   - S5: the parent passes `abandon` inline, and Fill it all's `applyCode` re-renders the parent; the dialog stays on
//     its steps and never jumps back to its first question.
//   - S6: the Shelf takes a piece only once Fill it all has put every part in every section (PLAN F6; Fail Better
//     p. 292): before that, "Put it on the Shelf" is disabled and one line says to fill it first.
// A DOM simulator (happy-dom) renders it; the Dialog is a plain stand-in and the Shelf mutation is a stub.
import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { SketchDetail } from "@oak/api";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

mock.module(new URL("../album/shelf-queries.ts", import.meta.url).pathname, () => ({
  useShelveSketch: () => ({
    mutateAsync: async () => ({ title: "Shelved" }),
    isError: false,
    isPending: false,
  }),
}));
mock.module(new URL("../ui/kit/Dialog.tsx", import.meta.url).pathname, () => ({
  Dialog: ({ children, footer, open }: { children: unknown; footer: unknown; open: boolean }) =>
    open ? (
      <div>
        {children as never}
        {footer as never}
      </div>
    ) : null,
}));

const { act, useState } = await import("react");
const { createRoot } = await import("react-dom/client");
const { FinishAnywayDialog } = await import("./FinishAnyway.tsx");
const { FINISH_COPY } = await import("./finish-anyway.ts");

const HALF = [
  'const drumsA = s("bd*4")',
  'const drumsB = s("bd sd")',
  "drums: arrange([4, drumsA], [4, drumsB])",
  'bass: note("c2").s("sine")',
].join("\n");
const WHOLE = 'drums: arrange([4, s("bd*4")], [4, s("bd sd")])';

const sketch = { id: "sk_w5", title: "Loop", versions: [] } as unknown as SketchDetail;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeAll(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => root?.unmount());
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

const byTest = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = (id: string) => act(() => byTest(id)?.click());

/** Like SketchEditor: `abandon` is a new object on every render, and `applyCode` sets the parent's state. */
function Host({ start, abandon }: { start: string; abandon: boolean }) {
  const [code, setCode] = useState(start);
  return (
    <FinishAnywayDialog
      open
      onClose={() => {}}
      code={code}
      applyCode={setCode}
      target={{ kind: "sketch", sketch, liveCode: code }}
      abandon={abandon ? { kind: "delete", goOn: () => {} } : undefined}
    />
  );
}

function mount(start: string, abandon = false) {
  root = createRoot(container);
  act(() => root.render(<Host start={start} abandon={abandon} />));
}

describe("Finish it anyway from Delete (S5)", () => {
  test("Fill it all re-renders the parent; the dialog stays on its steps", () => {
    mount(HALF, true);
    expect(byTest("finish-anyway-ask")).not.toBeNull();
    click("finish-anyway-start");
    expect(byTest("finish-anyway")).not.toBeNull();
    click("finish-fill");
    expect(byTest("finish-anyway-ask")).toBeNull();
    expect(byTest("finish-anyway")).not.toBeNull();
    expect(byTest("finish-anyway")?.textContent).toContain(FINISH_COPY.filled);
  });
});

describe("The Shelf after Fill it all (S6)", () => {
  test("a half-arranged piece with a title cannot be shelved until Fill it all", () => {
    mount(HALF);
    const shelve = () => byTest("shelve") as HTMLButtonElement;
    expect((byTest("shelf-title") as HTMLInputElement).value).toBe("Loop");
    expect(shelve().disabled).toBe(true);
    expect(byTest("shelf-fill-first")?.textContent).toBe(FINISH_COPY.shelfFillFirst);
    click("finish-fill");
    expect(shelve().disabled).toBe(false);
    expect(byTest("shelf-fill-first")).toBeNull();
  });

  test("a piece already whole can be shelved at once", () => {
    mount(WHOLE);
    expect((byTest("shelve") as HTMLButtonElement).disabled).toBe(false);
    expect(byTest("shelf-fill-first")).toBeNull();
  });
});
