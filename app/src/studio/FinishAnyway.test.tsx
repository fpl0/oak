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

describe("Finish it anyway owner calls (X25)", () => {
  afterEach(() => {
    localStorage.removeItem("oak.studio.length.sk_w5");
  });

  for (const sections of [3, 4]) {
    test(`an unarranged sketch fills 64 bars with ${sections} sections`, async () => {
      const { writeLength } = await import("./draft.ts");
      const { sectionsFromAst } = await import("@oak/grader");
      writeLength("sk_w5", 4);
      let received = "";
      function FillHost() {
        const [code, setCode] = useState('drums: s("bd*4")\nbass: note("c2").s("sine")\n');
        return (
          <FinishAnywayDialog
            open
            onClose={() => {}}
            code={code}
            applyCode={(next) => {
              received = next;
              setCode(next);
            }}
            target={{ kind: "sketch", sketch, liveCode: code }}
          />
        );
      }
      root = createRoot(container);
      act(() => root.render(<FillHost />));
      const selected = container.querySelector('[aria-label="Sections"] [aria-checked="true"]');
      expect(selected?.textContent).toBe("4");
      if (sections === 3) {
        const three = [
          ...container.querySelectorAll<HTMLButtonElement>('[aria-label="Sections"] button'),
        ].find((button) => button.textContent === "3");
        expect(three).toBeDefined();
        act(() => three?.click());
      }
      click("finish-fill");
      const read = sectionsFromAst(received);
      if (!read || !("sections" in read)) throw new Error("filled sections could not be read");
      expect(read.totalBars).toBe(64);
      expect(read.sections.map((s) => s.bars)).toEqual(sections === 3 ? [24, 20, 20] : [16, 16, 16, 16]);
    });
  }

  test("a stored two-bar loop fills three sections with 22, 22 and 20 bars", async () => {
    const { writeLength } = await import("./draft.ts");
    const { sectionsFromAst } = await import("@oak/grader");
    writeLength("sk_w5", 2);
    let received = "";
    function FillHost() {
      const [code, setCode] = useState('drums: s("bd*4")\nbass: note("c2").s("sine")\n');
      return (
        <FinishAnywayDialog
          open
          onClose={() => {}}
          code={code}
          applyCode={(next) => {
            received = next;
            setCode(next);
          }}
          target={{ kind: "sketch", sketch, liveCode: code }}
        />
      );
    }
    root = createRoot(container);
    act(() => root.render(<FillHost />));
    const three = [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Sections"] button')].find(
      (button) => button.textContent === "3",
    );
    expect(three).toBeDefined();
    act(() => three?.click());
    click("finish-fill");
    const read = sectionsFromAst(received);
    if (!read || !("sections" in read)) throw new Error("filled sections could not be read");
    expect(read.totalBars).toBe(64);
    expect(read.sections.map((s) => s.bars)).toEqual([22, 22, 20]);
  });

  test("the ask screen gives the reason once and the steps do not repeat it", () => {
    mount(HALF, true);
    expect(byTest("finish-anyway-ask")).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="finish-anyway-reason"]')).toHaveLength(1);
    expect(byTest("finish-anyway-reason")?.tagName).toBe("P");
    expect(byTest("finish-anyway-reason")?.textContent).toBe(FINISH_COPY.reason);
    click("finish-anyway-start");
    expect(byTest("finish-anyway")).not.toBeNull();
    expect(byTest("finish-anyway-reason")).toBeNull();
  });

  test("without abandon the steps begin with the reason exactly once", () => {
    mount(HALF);
    expect(container.querySelectorAll('[data-testid="finish-anyway-reason"]')).toHaveLength(1);
    const reason = byTest("finish-anyway-reason");
    expect(reason?.tagName).toBe("P");
    expect(reason?.textContent).toBe(FINISH_COPY.reason);
    expect(byTest("finish-anyway")?.firstElementChild).toBe(reason);
  });
});
