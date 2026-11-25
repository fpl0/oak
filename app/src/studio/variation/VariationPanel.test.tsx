// Oak 2.0 W5 S1 (contracts §11.3): Siblings and the Chain never read or play a version a backup import flagged
// "review before running". Such a row says so (VARIATION_WORDS.imported) with no read and no play; a flagged parent
// shows the notice only. `readPiece` and `BackToBack` are stand-ins that record what reached them. A DOM simulator
// (happy-dom) renders it.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { SketchDetail, SketchVersion } from "@oak/api";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const readCalls: string[] = [];
mock.module(new URL("../piece-read.ts", import.meta.url).pathname, () => ({
  readPiece: async (code: string) => {
    readCalls.push(code);
    return null;
  },
}));
const played: string[][] = [];
mock.module(new URL("./BackToBack.tsx", import.meta.url).pathname, () => ({
  BackToBack: ({ items }: { items: readonly { code: string }[] }) => {
    played.push(items.map((i) => i.code));
    return null;
  },
}));
mock.module(new URL("./lineage-queries.ts", import.meta.url).pathname, () => ({
  useLineage: () => ({ data: undefined, isError: false, error: null }),
  lineageNotBuilt: () => false,
  localChain: (versions: readonly SketchVersion[], tip: number) => {
    const byVersion = new Map(versions.map((v) => [v.version, v]));
    const out: SketchVersion[] = [];
    let at = byVersion.get(tip);
    while (at) {
      out.push(at);
      at = at.parentVersion == null ? undefined : byVersion.get(at.parentVersion);
    }
    return out.reverse();
  },
}));

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { VariationPanel } = await import("./VariationPanel.tsx");
const { VARIATION_WORDS: W, writeVariation } = await import("./model.ts");

const FLAGGED = { lockedTools: [], previewTools: [], reviewBeforeRun: true as const };
const PLAIN = { lockedTools: [], previewTools: [] };

function ver(version: number, code: string, extra: Partial<SketchVersion> = {}): SketchVersion {
  return {
    sketchId: "sk1",
    version,
    code,
    bpm: null,
    meter: null,
    key: null,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: PLAIN,
    createdAt: "2026-11-25T00:00:00.000Z",
    takeState: null,
    parentVersion: null,
    generation: null,
    dimension: null,
    ...extra,
  };
}

function sketchOf(versions: SketchVersion[]): SketchDetail {
  return {
    id: "sk1",
    title: "Test",
    originKind: "blank",
    originId: null,
    currentVersion: versions.length,
    tags: [],
    archived: false,
    listeningNote: null,
    createdAt: "2026-11-25T00:00:00.000Z",
    updatedAt: "2026-11-25T00:00:00.000Z",
    versions,
  } as SketchDetail;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeAll(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});
beforeEach(() => {
  readCalls.length = 0;
  played.length = 0;
  sessionStorage.clear();
});
afterEach(() => {
  act(() => root?.unmount());
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

async function mount(sketch: SketchDetail, shown: SketchVersion) {
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <VariationPanel
          sketch={sketch}
          version={shown}
          liveCode={shown.code}
          lastRunCode={null}
          cursorLabel={null}
          meter="4/4"
          keySpec={null}
          jam={false}
          editor={null}
          applyCode={() => {}}
          saveVersion={async () => null}
          compareWith={null}
        />
      </QueryClientProvider>,
    );
  });
  // Let the queries settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
}

const all = (id: string) => [...container.querySelectorAll(`[data-testid="${id}"]`)] as HTMLElement[];

describe("Variation: versions flagged review-before-running", () => {
  const parent = ver(1, 'drums: s("bd*4")');
  const okSibling = ver(2, 'drums: s("bd*8")', {
    parentVersion: 1,
    generation: 1,
    dimension: "rhythm",
    note: "Sibling: rhythm",
  });
  const flaggedSibling = ver(3, 'drums: s("FLAGGED")', {
    parentVersion: 1,
    generation: 1,
    dimension: "sound",
    note: "Sibling: sound",
    flags: FLAGGED,
  });

  test("a flagged sibling is never read or played; its row says it waits for review", async () => {
    writeVariation("sk1", { draft: null, chainStart: null, siblingParent: 1 });
    await mount(sketchOf([parent, okSibling, flaggedSibling]), parent);
    expect(readCalls.length).toBeGreaterThan(0);
    expect(readCalls.some((c) => c.includes("FLAGGED"))).toBe(false);
    expect(played.length).toBeGreaterThan(0);
    for (const list of played) {
      expect(list).toEqual([parent.code, okSibling.code]);
    }
    const rows = all("sibling-row");
    expect(rows.map((r) => r.dataset.version)).toEqual(["2", "3"]);
    expect(rows[1]?.querySelector('[data-testid="variation-change"]')).toBeNull();
    expect(rows[1]?.querySelector('[data-testid="variation-imported"]')?.textContent).toBe(W.imported);
    expect(rows[0]?.querySelector('[data-testid="variation-change"]')).not.toBeNull();
  });

  test("a flagged parent shows the notice only: no rows, no read, no play", async () => {
    const flaggedParent = { ...parent, flags: FLAGGED };
    writeVariation("sk1", { draft: null, chainStart: null, siblingParent: 1 });
    await mount(sketchOf([flaggedParent, okSibling]), flaggedParent);
    expect(readCalls).toEqual([]);
    expect(played).toEqual([]);
    expect(all("sibling-row")).toEqual([]);
    expect(all("variation-imported").map((e) => e.textContent)).toEqual([W.imported]);
  });

  test("the chain plays only the versions not flagged, and the flagged row says so", async () => {
    const start = ver(1, 'drums: s("bd*4")');
    const g1 = ver(2, 'drums: s("FLAGGED")', {
      parentVersion: 1,
      generation: 1,
      dimension: "sound",
      flags: FLAGGED,
    });
    const g2 = ver(3, 'drums: s("bd*8")', { parentVersion: 2, generation: 2, dimension: "rhythm" });
    writeVariation("sk1", { draft: null, chainStart: 1, siblingParent: null });
    await mount(sketchOf([start, g1, g2]), start);
    // Open the Generations tab.
    const tab = [...container.querySelectorAll('[role="tab"]')].find(
      (t) => t.textContent === W.generationsTab,
    );
    await act(async () => (tab as HTMLElement).click());
    expect(all("chain-row").map((r) => r.dataset.version)).toEqual(["1", "2", "3"]);
    const last = played.at(-1) ?? [];
    expect(last).toEqual([start.code, g2.code]);
    const rows = all("chain-row");
    expect(rows[1]?.querySelector('[data-testid="variation-imported"]')?.textContent).toBe(W.imported);
    expect(readCalls.some((c) => c.includes("FLAGGED"))).toBe(false);
  });
});
