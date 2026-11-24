// The New song gate of the lesson player (spec 2026-11-24 §5.5) follows the unit: starting one unit's song opens that
// song's lessons only. The player stays mounted when the learner moves from one lesson to another (the router keeps
// the /learn/$lessonId component across param changes), so starting J1 must not skip R1's New song moment.
import { afterAll, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
// The content loader uses Vite's `import.meta.glob`, which Bun has not: the gate never reads it.
mock.module(new URL("../lib/content.ts", import.meta.url).pathname, () => ({
  loadContent: async () => ({}),
  contentQuery: { queryKey: ["content"], queryFn: async () => ({}) },
  useContent: () => ({ data: undefined, isPending: false, isError: false }),
}));

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { unitSongs } = await import("../../../content/unit-songs/index.ts");
const { apiKey } = await import("../lib/queries.ts");
const { songFirstRead, useNewSongGate } = await import("../song/hooks.ts");

import type { NewSongGate } from "../song/hooks.ts";

afterAll(() => GlobalRegistrator.unregister());

const firstTake = (unit: string): string => {
  const song = unitSongs.find((s) => s.unit === unit);
  const step = song?.plan.find((p) => p.kind === "take");
  if (step?.kind !== "take") throw new Error(`no take lesson in ${unit}`);
  return step.lesson;
};

const songKey = (unitId: string) => apiKey("songs.get", { params: { unitId } } as never);
const detail = (unitId: string, status: "new" | "started") => ({
  unitId,
  status,
  flavour: "flavour.pop",
  takes: [],
});

test("starting one unit's song keeps another unit's New song moment", async () => {
  const j1 = firstTake("J1");
  const r1 = firstTake("R1");
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: false } },
  });
  qc.setQueryData(songKey("J1"), detail("J1", "new"));
  qc.setQueryData(songKey("R1"), detail("R1", "new"));

  let gate: NewSongGate | null = null;
  function Probe({ lessonId }: { lessonId: string }) {
    gate = useNewSongGate(lessonId, { enabled: true });
    return null;
  }
  const now = (): NewSongGate => {
    if (!gate) throw new Error("the probe did not render");
    return gate;
  };
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  const render = (lessonId: string) =>
    act(() =>
      root.render(
        React.createElement(QueryClientProvider, { client: qc }, React.createElement(Probe, { lessonId })),
      ),
    );

  await render(j1);
  expect(now().show).toBe(true);
  expect(now().unitId).toBe("J1");

  // The learner picks a style on J1: `songs.start` succeeded, then `onStarted` (the refetch may still be on its way).
  await act(() => now().onStarted());
  expect(now().show).toBe(false);

  // Same mount, another unit's take lesson whose song is still new: its moment shows.
  await render(r1);
  expect(now().unitId).toBe("R1");
  expect(now().show).toBe(true);

  // Back on J1 before its detail refetched: the moment stays closed.
  await render(j1);
  expect(now().show).toBe(false);

  await act(() => root.unmount());
  el.remove();
});

test("only the song's first read holds the lesson; a read that failed never does again", () => {
  // TanStack Query puts a query with no data back to `pending` while it reads again after an error (an observer that
  // mounts, a window focus). Holding the lesson then unmounted the player, whose remount read again: a loop.
  expect(songFirstRead({ isPending: true, errorUpdatedAt: 0 })).toBe(true);
  expect(songFirstRead({ isPending: true, errorUpdatedAt: 1_764_000_000_000 })).toBe(false);
  expect(songFirstRead({ isPending: false, errorUpdatedAt: 0 })).toBe(false);
  expect(songFirstRead({ isPending: false, errorUpdatedAt: 1_764_000_000_000 })).toBe(false);
});

test("a lesson that opened without its song (the read failed) is never swapped for the New song moment", async () => {
  const j1 = firstTake("J1");
  const r1 = firstTake("R1");
  // Every read fails, as with the server restarting: no request leaves the test.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError("network down");
  }) as unknown as typeof fetch;
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: false } },
  });
  qc.setQueryData(songKey("R1"), detail("R1", "new"));

  let gate: NewSongGate | null = null;
  function Probe({ lessonId }: { lessonId: string }) {
    gate = useNewSongGate(lessonId, { enabled: true });
    return null;
  }
  const now = (): NewSongGate => {
    if (!gate) throw new Error("the probe did not render");
    return gate;
  };
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  const render = (lessonId: string) =>
    act(() =>
      root.render(
        React.createElement(QueryClientProvider, { client: qc }, React.createElement(Probe, { lessonId })),
      ),
    );
  try {
    await render(j1);
    await act(async () => {
      await qc
        .getQueryCache()
        .find({ queryKey: songKey("J1") })
        ?.promise?.catch(() => undefined);
      await new Promise((r) => setTimeout(r, 20));
    });
    // The read failed: the lesson opens without the song, and nothing holds it.
    expect(now().pending).toBe(false);
    expect(now().show).toBe(false);

    // A later read succeeds with the song not started: the open lesson stays open.
    await act(async () => {
      qc.setQueryData(songKey("J1"), detail("J1", "new"));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(now().flavour).toBe("flavour.pop");
    expect(now().show).toBe(false);

    // The next lesson asks again.
    await render(r1);
    expect(now().show).toBe(true);
  } finally {
    await act(() => root.unmount());
    el.remove();
    globalThis.fetch = realFetch;
  }
});
