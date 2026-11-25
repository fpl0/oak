// Oak 2.0 W4 F3: the erase pass as the learner meets it, over a fake editor handle. Each part is muted in turn on top
// of the learner's own mutes, which come back when the pass ends, is closed, or the card goes away; Oak's reading
// appears only after the pass (or on "Show Oak's reading now"); "Leave it out in the code" writes `_<label>:` through
// `applyCode`. A DOM simulator (happy-dom) renders it.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { ErasePass } = await import("./ErasePass.tsx");

import type { EditorHandle, LiveHap, MuteMap } from "@oak/strudel";

const CODE = 'setcpm(90/4)\nbass: note("c3").s("triangle")\nchords: note("[c3,e3,g3]").s("piano")';
const HAPS: LiveHap[] = [
  { track: "bass", begin: 0, end: 1, value: { note: "c3" }, locations: [] },
  { track: "chords", begin: 0, end: 1, value: { note: "c3" }, locations: [] },
  { track: "chords", begin: 0, end: 1, value: { note: "e3" }, locations: [] },
];

function fakeEditor(initial: MuteMap) {
  let mutes = initial;
  const log: string[][] = [];
  const handle = {
    disposed: false,
    getMutes: () => ({ muted: new Set(mutes.muted), solo: mutes.solo }),
    setMutes: (m: MuteMap) => {
      mutes = { muted: new Set(m.muted), solo: m.solo };
      log.push([...m.muted].sort());
    },
    queryHaps: () => HAPS,
  } as unknown as EditorHandle;
  return { handle, log, now: () => [...mutes.muted].sort() };
}

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

function mount(ed: ReturnType<typeof fakeEditor>, applied: string[] = []) {
  root = createRoot(container);
  act(() =>
    root.render(
      <ErasePass code={CODE} editor={() => ed.handle} applyCode={(c) => applied.push(c)} bars={1} />,
    ),
  );
}

describe("ErasePass", () => {
  test("each part is muted in turn over the learner's own mutes; they come back after the pass", () => {
    const ed = fakeEditor({ muted: new Set(["kick"]), solo: null });
    mount(ed);
    expect(byTest("erase-reading")).toBeNull();
    click("erase-start");
    expect(byTest("erase-step")?.dataset.part).toBe("bass");
    expect(ed.now()).toEqual(["bass", "kick"]);
    expect(byTest("erase-reading")).toBeNull();
    click("erase-dont-miss");
    expect(byTest("erase-step")?.dataset.part).toBe("chords");
    expect(ed.now()).toEqual(["chords", "kick"]);
    click("erase-miss");
    expect(ed.now()).toEqual(["kick"]);
    expect(byTest("erase-after")).not.toBeNull();
    // Only now: Oak's reading.
    expect(byTest("erase-reading")?.textContent).toContain(
      "bass and chords play near C3 at the same time in bar 1.",
    );
  });

  test("the parts not missed can be left out in the code, as one applyCode", () => {
    const ed = fakeEditor({ muted: new Set(), solo: null });
    const applied: string[] = [];
    mount(ed, applied);
    click("erase-start");
    click("erase-dont-miss");
    click("erase-miss");
    const rows = container.querySelectorAll('[data-testid="erase-part"]');
    expect([...rows].map((r) => (r as HTMLElement).dataset.part)).toEqual(["bass"]);
    click("erase-leave-out");
    expect(applied).toEqual([CODE.replace("\nbass:", "\n_bass:")]);
  });

  test("closing mid-pass, or the card going away, puts the mutes back", () => {
    const ed = fakeEditor({ muted: new Set(["kick"]), solo: null });
    mount(ed);
    click("erase-start");
    expect(ed.now()).toEqual(["bass", "kick"]);
    click("erase-close");
    expect(ed.now()).toEqual(["kick"]);
    click("erase-start");
    expect(ed.now()).toEqual(["bass", "kick"]);
    act(() => root.unmount());
    expect(ed.now()).toEqual(["kick"]);
    root = createRoot(container); // for afterEach
  });

  test("Show Oak's reading now shows it before the pass ends", () => {
    const ed = fakeEditor({ muted: new Set(), solo: null });
    mount(ed);
    click("erase-start");
    click("erase-show-reading");
    expect(byTest("erase-reading")?.textContent).toContain("bass and chords");
  });
});
