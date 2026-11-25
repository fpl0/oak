// X25: real capstone starters wait for the learner's edits; an opened finish dialog survives a return to the starter.
import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { CapstoneDef } from "@oak/api";
import type { CapstoneSlotProps } from "./workspace-slots.ts";

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

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { capstoneById } = await import("../../../content/capstones.ts");
const { starterOf } = await import("./sessions.ts");
const { arrangementState, showsCapstoneFinishCard } = await import("../studio/finish-anyway.ts");
const { FinishAnywayCard } = await import("./FinishAnywayCard.tsx");

const ADD = '\nperc: s("~ ~ ~ rim")\n';
const defOf = (id: string): CapstoneDef => {
  const def = capstoneById.get(id);
  if (!def) throw new Error(`Missing capstone: ${id}`);
  return def;
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | undefined;
beforeAll(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

const byTest = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = (id: string) => act(() => byTest(id)?.click());

describe("showsCapstoneFinishCard", () => {
  for (const id of ["C3", "C7", "JC3"]) {
    const def = defOf(id);
    for (let i = 0; i < def.sessionDefs.length; i++) {
      test(`${id} session ${i}: only a touched, unreleased half arrangement shows the card`, () => {
        const starter = starterOf(def, i);
        expect(arrangementState(starter)).toBe("half");
        expect(showsCapstoneFinishCard({ liveCode: starter, starter, released: false })).toBe(false);
        expect(showsCapstoneFinishCard({ liveCode: `\n${starter}\n\n`, starter, released: false })).toBe(
          false,
        );
        expect(arrangementState(starter + ADD)).toBe("half");
        expect(showsCapstoneFinishCard({ liveCode: starter + ADD, starter, released: false })).toBe(true);
        expect(showsCapstoneFinishCard({ liveCode: starter + ADD, starter, released: true })).toBe(false);
        expect(
          showsCapstoneFinishCard({ liveCode: 'drums: arrange([4, s("bd")])\n', starter, released: false }),
        ).toBe(false);
      });
    }
  }
});

test("C3 hides the untouched starter, shows the touched card and keeps its open dialog on return", () => {
  const def = defOf("C3");
  const starter = starterOf(def, 0);
  const props = {
    def,
    starter,
    released: false,
    editor: () => null,
    applyCode: () => {},
  } as unknown as CapstoneSlotProps;
  root = createRoot(container);
  act(() => root?.render(<FinishAnywayCard {...props} liveCode={starter} />));
  expect(byTest("finish-anyway-card")).toBeNull();
  act(() => root?.render(<FinishAnywayCard {...props} liveCode={starter + ADD} />));
  expect(byTest("finish-anyway-card")).not.toBeNull();
  expect(byTest("finish-anyway-open")).not.toBeNull();
  click("finish-anyway-open");
  expect(byTest("finish-anyway")).not.toBeNull();
  act(() => root?.render(<FinishAnywayCard {...props} liveCode={starter} />));
  expect(byTest("finish-anyway")).not.toBeNull();
});
