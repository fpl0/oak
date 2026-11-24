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
const { useNewSongGate } = await import("../song/hooks.ts");

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
