// The song page's album card, the Coda's song cards and the album's Songs shelf (2026-11-24 UI review, group
// "album"): the Release card stays as its confirmation and takes the focus, a closed rename gives the focus back,
// today's cells stay marked on the Coda, and the shelf says where each song stands in the song page's words. A DOM
// simulator (happy-dom) renders them with a seeded query client, a fake API client and a memory router.
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { ReactNode } from "react";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
// The content loader uses Vite's `import.meta.glob`, which Bun has not: the surfaces only read lesson titles from it.
mock.module(new URL("../lib/content.ts", import.meta.url).pathname, () => ({
  loadContent: async () => ({}),
  contentQuery: { queryKey: ["content"], queryFn: async () => ({}) },
  useContent: () => ({ data: undefined, isPending: false, isError: false }),
}));

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } = await import(
  "@tanstack/react-router"
);
const { createClient } = await import("@oak/api");
const { setApiClient } = await import("../lib/api.ts");
const { apiKey } = await import("../lib/queries.ts");
const { albumSides } = await import("../album/model.ts");
const { songViewOf } = await import("./model.ts");
const { SongPage } = await import("./SongPage.tsx");
const { SongGrew, SongRelease } = await import("./SongGrew.tsx");
const { AlbumSongs } = await import("./AlbumSongs.tsx");
const { changedSinceLine, firstTrackSong, grewSentence, snapshotSeconds, songStage, songTracksOf } =
  await import("./surfaces-model.ts");
const { TEST_SONG, testDetail, testTake } = await import("./test-song.ts");

import type { AlbumTrack, UnitSongDetail, UnitSongRelease, UnitSongSummary } from "@oak/api";
import type { QueryClient as QC } from "@tanstack/react-query";

const L01 = testTake(1, "U01.L01", 'setcpm(96/4)\n\ndrums: s("bd sd bd sd")', ["kick@verse", "snare@verse"], {
  labels: { drums: null },
});
const RELEASE: UnitSongRelease = {
  id: 1,
  albumTrackId: "trk_1",
  albumVersion: 1,
  flavour: "flavour.indie",
  title: "My groove",
  createdAt: "2026-11-23T12:00:00.000Z",
};

// --- harness ------------------------------------------------------------------------------------------------

let answer: (method: string, path: string) => unknown = () => ({});
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QC;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

beforeAll(() => {
  document.documentElement.dataset.theme = "paper";
  document.documentElement.dataset.motion = "reduced";
  setApiClient(
    createClient({
      fetch: async (url, init) => {
        const out = await answer(init?.method ?? "GET", new URL(String(url), "http://oak.test").pathname);
        return out instanceof Response ? out : json(out);
      },
    }),
  );
});

afterAll(async () => {
  await act(async () => root?.unmount());
});

async function render(
  node: ReactNode,
  seed: { detail?: UnitSongDetail; songs?: UnitSongSummary[] } = {},
): Promise<void> {
  if (root) await act(async () => root.unmount());
  container?.remove();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  if (seed.detail) qc.setQueryData(apiKey("songs.get", { params: { unitId: "U01" } }), seed.detail);
  if (seed.songs) qc.setQueryData(apiKey("songs.list"), { items: seed.songs });
  qc.setQueryData(apiKey("terms.introduced"), { items: [] });
  const router = createRouter({
    routeTree: createRootRoute({ component: () => node }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {});
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 5)));
const one = (sel: string) => {
  const el = container.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};
const none = (sel: string) => container.querySelector(sel) === null;

// --- the tests ------------------------------------------------------------------------------------------------

describe("the song page's album card", () => {
  test("after Release, the card stays as the confirmation, its heading takes the focus, and a later change brings the form back", async () => {
    const ready = testDetail([L01], { releasable: true });
    const released = testDetail([L01], { status: "released", releasable: true, releases: [RELEASE] });
    answer = (method, path) =>
      method === "POST" && path.endsWith("/release")
        ? { albumTrackId: "trk_1", albumVersion: 1, releaseId: 1, song: released }
        : released;
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail: ready });
    const go = one('[data-testid="song-release-go"]');
    go.focus();
    await act(async () => go.click());
    await settle();
    expect(one('[data-testid="song-album"]').dataset.offer).toBe("on-album");
    expect(one('[data-testid="song-release"]').dataset.offer).toBe("done");
    expect(one('[data-testid="song-release-done"]').textContent).toBe("“My groove” is on your album");
    expect(document.activeElement).toBe(one('[data-testid="song-release-done"]'));
    expect(one('[data-testid="song-release-open"]').textContent).toBe("Open it on the album");
    // The song page already plays the song and is its page: the card has neither.
    expect(none('[data-testid="song-release-play"]')).toBe(true);
    // The style changes later in the same visit: "Release again" comes back, saying what changed.
    await act(async () =>
      qc.setQueryData(apiKey("songs.get", { params: { unitId: "U01" } }), {
        ...released,
        flavour: "flavour.funk",
        changedSinceRelease: true,
      }),
    );
    await settle();
    expect(one('[data-testid="song-release"]').dataset.offer).toBe("again");
    expect(one('[data-testid="song-release-go"]').textContent).toBe("Release again");
    expect(one('[data-testid="song-release-why"]').textContent).toContain(
      "Since you released it, the style changed from Indie to Funk.",
    );
  });

  test("closing the rename field gives the focus back to Rename", async () => {
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail: testDetail([L01]) });
    await act(async () => one('[data-testid="song-rename"]').click());
    const field = one('[data-testid="song-rename-field"]');
    await act(async () => {
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(none('[data-testid="song-rename-field"]')).toBe(true);
    expect(document.activeElement).toBe(one('[data-testid="song-rename"]'));
  });

  test("the meta line says where the song stands", async () => {
    const done = testTake(2, "U01.L02", 'hats: s("hh*4")', ["hats@chorus1"]);
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail: testDetail([L01]) });
    expect(one('[data-testid="song-page-meta"]').textContent).toContain("Still growing");
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail: testDetail([L01, done]) });
    expect(one('[data-testid="song-page-meta"]').textContent).toContain("Every lesson is in");
    await render(<SongPage unitId="U01" song={TEST_SONG} />, {
      detail: testDetail([L01, done], { releasable: true }),
    });
    expect(one('[data-testid="song-page-meta"]').textContent).toContain("Ready for the album");
  });
});

describe("the Coda's song cards", () => {
  test("today's cells stay marked as Today, and the checkpoint day's Release card plays the song and opens it", async () => {
    const L02 = testTake(2, "U01.L02", 'hats: s("hh*4")', ["hats@chorus1", "hats@chorus2"]);
    await render(<SongGrew lessonId="U01.L02" song={TEST_SONG} />, { detail: testDetail([L01, L02]) });
    expect(one('[data-cell="hats@chorus1"]').dataset.owner).toBe("today");
    expect(one('[data-cell="kick@verse"]').dataset.owner).toBe("yours");
    expect(one('[data-testid="coda-song-grid"]').dataset.showing).toBe("now");
    // Saved today, so filled in the part's colour inside today's accent outline, and the legend's swatch alike.
    const fresh = one('[data-cell="hats@chorus1"]');
    expect(fresh.className).toContain("oak-song-today-saved");
    expect(fresh.getAttribute("style")).toContain("background");
    expect(one('[data-legend="today"] span').className).toContain("oak-song-today-saved");
    // The line that says the grid shows the song before today keeps its room while it is empty.
    expect(one('[data-testid="coda-song-showing"]').textContent).toBe("");
    // Every link of the card is at least 24px tall.
    for (const a of container.querySelectorAll('[data-testid="coda-song-grew"] a'))
      expect(a.className).toContain("min-h-6");
    expect(one('[data-testid="coda-song-after"]').getAttribute("aria-label")).not.toContain("take");
    // The checkpoint day: the Release card alone, with ▶ for the song as it is now and a link to its page.
    await render(<SongRelease unitId="U01" song={TEST_SONG} />, {
      detail: testDetail([L01], { releasable: true }),
    });
    expect(one('[data-testid="song-release-play"]').getAttribute("aria-label")).toBe(
      "Play “My groove” as it is now",
    );
    expect(container.textContent).toContain("Open the song");
    expect(
      [...container.querySelectorAll('[data-testid="song-release"] a')].every((a) =>
        a.className.includes("min-h-6"),
      ),
    ).toBe(true);
    // It stands out from the other Coda cards: its own accent border, not the kit Card's.
    expect(one('[data-testid="song-release"]').className).not.toContain("border-border");
  });
});

describe("the album's Songs shelf", () => {
  const summary = (extra: Partial<UnitSongSummary>): UnitSongSummary => {
    const { takes: _takes, ...d } = testDetail([L01]);
    return { ...d, lessonsCount: 1, ...extra };
  };

  test("each tile says where its song stands; a song off the album says so and offers the release again", async () => {
    answer = () => testDetail([L01]);
    await render(<AlbumSongs />, { songs: [summary({ releasable: true })], detail: testDetail([L01]) });
    expect(one('[data-testid="song-shelf-stage"]').textContent).toBe("Ready for the album");
    expect(one('[data-testid="song-shelf-release"]').textContent).toBe("Release it");
    // Its rings are drawn from the song's takes, as on its page.
    expect(one('[data-testid="song-cover"]').dataset.rings).toBe("1");
    await render(<AlbumSongs />, {
      songs: [
        summary({
          status: "released",
          releasable: true,
          changedSinceRelease: true,
          releases: [{ ...RELEASE, albumTrackId: null }],
        }),
      ],
      detail: testDetail([L01]),
    });
    expect(one('[data-testid="song-shelf-stage"]').textContent).toBe("Off the album");
    expect(one('[data-testid="song-shelf-release"]').textContent).toBe("Release again");
    expect(container.textContent).not.toContain("Changed since its release");
    expect(container.textContent).not.toContain("Still growing");
  });
});

describe("the empty album's first-track line", () => {
  const summary = (unitId: string, extra: Partial<UnitSongSummary>): UnitSongSummary => {
    const { takes: _takes, ...d } = testDetail([L01]);
    return { ...d, unitId: unitId as UnitSongSummary["unitId"], lessonsCount: 1, ...extra };
  };
  test("it speaks of the song ready for the album first, then one taken off it, then one still growing", () => {
    const growing = summary("U01", {});
    const ready = summary("U02", { releasable: true });
    const off = summary("U03", { status: "released", releases: [{ ...RELEASE, albumTrackId: null }] });
    const steps = () => 2;
    expect(firstTrackSong([growing, off, ready], steps)).toMatchObject({ song: ready, stage: "ready" });
    expect(firstTrackSong([growing, off], steps)).toMatchObject({ song: off, stage: "off-album" });
    expect(firstTrackSong([growing], steps)).toMatchObject({ song: growing, stage: "growing" });
    expect(firstTrackSong([], steps)).toBeNull();
  });
});

describe("album and Coda words", () => {
  const view = songViewOf(TEST_SONG, testDetail([L01]), new Set());

  test("a section letter is said as a section, never as a key", () => {
    expect(grewSentence(view, ["kick@verse"])).toBe("The song now plays your kick in section B.");
    const named = songViewOf(TEST_SONG, testDetail([L01]), new Set(["term.verse", "term.chorus"]));
    // A repeated section is told apart by its bar; a single one shares the article when it stands alone.
    const chorus1 = named.sections.find((s) => s.id === "chorus1");
    expect(grewSentence(named, ["kick@verse", "kick@chorus1"])).toBe(
      `The song now plays your kick in the verse and the chorus at bar ${(chorus1?.startBar ?? 0) + 1}.`,
    );
    expect(grewSentence(named, ["kick@verse", "kick@chorus1", "kick@chorus2"])).toBe(
      "The song now plays your kick in the verse and both choruses.",
    );
    const all = TEST_SONG.sections.map((s) => `kick@${s.id}`);
    expect(grewSentence(view, all)).toBe("The song now plays your kick in the whole song.");
  });

  test("where a song stands", () => {
    const base = testDetail([L01]);
    expect(songStage(base, { done: 1, of: 2 })).toBe("growing");
    expect(songStage(base, { done: 2, of: 2 })).toBe("complete");
    expect(songStage({ ...base, releasable: true }, { done: 2, of: 2 })).toBe("ready");
    expect(songStage({ ...base, releases: [RELEASE] }, { done: 2, of: 2 })).toBe("on-album");
    expect(songStage({ ...base, releases: [{ ...RELEASE, albumTrackId: null }] }, { done: 2, of: 2 })).toBe(
      "off-album",
    );
  });

  test("what changed since the release", () => {
    const later = testTake(5, "U01.L02", 'hats: s("hh*4")', ["hats@chorus1"]);
    expect(changedSinceLine({ ...testDetail([L01, later]), releases: [RELEASE] })).toBe(
      "Since you released it, a lesson's Make went into it.",
    );
    expect(changedSinceLine({ ...testDetail([L01]), flavour: "flavour.pop", releases: [RELEASE] })).toBe(
      "Since you released it, the style changed from Indie to Pop.",
    );
    expect(changedSinceLine(testDetail([L01]))).toBeNull();
  });

  test("a released song is a song track: listed once, on the shelf, and timed from its frozen song", () => {
    const songs = [{ unitId: "U01", releases: [RELEASE, { ...RELEASE, id: 2, albumVersion: 2 }] }];
    const tracks = songTracksOf(songs);
    expect(tracks.get("trk_1")?.releases.map((r) => r.version)).toEqual([1, 2]);
    const row = (id: string): AlbumTrack =>
      ({ id, side: "Bside", trackNo: 1, createdAt: "x", capstoneId: null }) as unknown as AlbumTrack;
    const sides = albumSides([row("trk_1"), row("trk_2")], [], [], new Set(tracks.keys()));
    const bsides = sides.find((s) => s.side === "Bside");
    expect(bsides?.slots.map((s) => (s.kind === "track" ? s.track.id : null))).toEqual(["trk_2"]);
    // 29 bars of 4/4 at 100 BPM: 29 × 4 × 60 / 100 seconds.
    expect(snapshotSeconds({ bpm: 100, def: TEST_SONG })).toBeCloseTo((29 * 4 * 60) / 100, 5);
  });
});
