// A DOM simulator checks event wiring when no browser can launch. It does not prove browser layout or fps.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { layoutOak } from "../layout.ts";
import type { MapCommand } from "../OakMap.tsx";
import { learnerFixture } from "./fixtures.ts";
import type { IllustratedOakMapProps } from "./IllustratedOakMap.tsx";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { IllustratedOakMap } = await import("./IllustratedOakMap.tsx");
const fixture = learnerFixture("mid");
let root: Root;
let container: HTMLDivElement;
let opened: string | null = null;
let focused: string | null = null;
let closes = 0;
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let props: IllustratedOakMapProps;

async function frame() {
  await act(async () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb(0);
  });
}
async function render(changes: Partial<IllustratedOakMapProps> = {}) {
  props = { ...props, ...changes } as IllustratedOakMapProps;
  await act(async () => root.render(createElement(IllustratedOakMap, props)));
  await frame();
}
function leaf(id: string) {
  const element = container.querySelector<SVGGElement>(`[data-node="${id}"]`);
  if (!element) throw new Error(`Missing leaf ${id}`);
  return element;
}
async function key(id: string, value: string) {
  await act(async () => {
    leaf(id).dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
  });
  await frame();
}

beforeAll(async () => {
  document.documentElement.dataset.theme = "paper";
  document.documentElement.dataset.motion = "reduced";
  globalThis.requestAnimationFrame = (cb) => {
    const id = ++frameId;
    frames.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  SVGElement.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 1200, 650);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  props = {
    // Exercise the existing grid's prop shape, not just the new graph entry point.
    layout: layoutOak(fixture.graph),
    states: fixture.states,
    next: fixture.next,
    showNext: true,
    selectedId: null,
    panelOpen: false,
    command: null,
    unitProgress: new Map(),
    initialId: "D01",
    onSelect: (id) => {
      opened = id;
    },
    onClose: () => {
      closes++;
    },
    onLeafFocus: (id) => {
      focused = id;
    },
    releasedTracks: fixture.releasedTracks,
  };
  await render();
});
afterAll(async () => {
  await act(async () => root.unmount());
  container.remove();
  await GlobalRegistrator.unregister();
});

test("grid props render the full scene, one tab stop and released acorn links", () => {
  expect(container.querySelectorAll("[data-node]").length).toBe(143);
  expect(container.querySelectorAll('[data-node][tabindex="0"]').length).toBe(1);
  expect(container.querySelectorAll('a[href^="/album/"]').length).toBe(3);
  expect(leaf("R01").getAttribute("aria-label")).toContain("Pulse & beat");
});

test("arrows focus without opening; Enter and Escape emit the existing events", async () => {
  await key("D01", "ArrowRight");
  expect(focused).not.toBeNull();
  expect(opened).toBeNull();
  const id = focused;
  if (!id) throw new Error("No focused leaf");
  await key(id, "Enter");
  expect(opened).toBe(id);
  await render({ selectedId: id, panelOpen: true });
  expect(leaf(id).getAttribute("aria-pressed")).toBe("true");
  await key(id, "Escape");
  expect(closes).toBe(1);
  await render({ selectedId: null, panelOpen: false });
});

test("Home, End, N and repeated toolbar commands use tree coordinates", async () => {
  await key("D01", "End");
  expect(focused).toBe(fixture.graph.nodes.at(-1)?.id ?? null);
  await key(focused ?? "D01", "Home");
  expect(focused).toBe(fixture.graph.nodes[0]?.id ?? null);
  await key(focused ?? "D01", "n");
  expect(focused).toBe("B01");
  const scale = () => Number(container.querySelector("svg")?.getAttribute("data-scale"));
  const send = (kind: MapCommand["kind"], seq: number) => render({ command: { kind, seq } });
  await send("fit", 1);
  const before = scale();
  await send("zoom-in", 2);
  expect(scale()).toBeGreaterThan(before);
  const zoomed = scale();
  await send("zoom-in", 3);
  expect(scale()).toBeGreaterThan(zoomed);
  await key("B01", "0");
  expect(scale()).toBeCloseTo(before, 3);
  await key("B01", "w");
  expect(scale()).toBeGreaterThanOrEqual(0.85);
});

test("theme updates redraw glyphs; wheel pan changes only the scene transform", async () => {
  await act(async () => {
    document.documentElement.dataset.theme = "bark";
    await Promise.resolve();
  });
  expect(leaf("R01").innerHTML).toContain("#72d494");
  const svg = container.querySelector("svg");
  const scene = svg?.querySelector(":scope > g");
  if (!svg || !scene) throw new Error("Missing scene");
  const before = scene.getAttribute("transform");
  const sameLeaf = leaf("R01");
  await act(async () =>
    svg.dispatchEvent(new WheelEvent("wheel", { deltaX: 100, deltaY: 50, bubbles: true, cancelable: true })),
  );
  await frame();
  expect(scene.getAttribute("transform")).not.toBe(before);
  expect(leaf("R01")).toBe(sameLeaf);
});

test("newly learned leaves animate at most once; the motion preference suppresses growth", async () => {
  const original = Element.prototype.animate;
  let starts = 0;
  let cancellations = 0;
  Element.prototype.animate = () => {
    starts++;
    return {
      cancel: () => {
        cancellations++;
      },
    } as Animation;
  };
  try {
    await act(async () => {
      document.documentElement.dataset.motion = "full";
      await Promise.resolve();
    });
    await render({ newlyLearned: new Set(["R01"]) });
    expect(starts).toBe(1);
    await render({ newlyLearned: new Set(["R01"]) });
    expect(starts).toBe(1);
    expect(cancellations).toBe(1);
    await act(async () => {
      document.documentElement.dataset.motion = "reduced";
      await Promise.resolve();
    });
    await render({ newlyLearned: new Set(["R02"]) });
    expect(starts).toBe(1);
  } finally {
    Element.prototype.animate = original;
  }
});
