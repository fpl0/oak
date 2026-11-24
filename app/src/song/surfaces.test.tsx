// The song surfaces render (spec 2026-11-24 §5.5): the grid, Today's hero, the New song moment, the song page's album
// offer, and the rule that a section is named only once its term is met (§4.3). A DOM simulator (happy-dom) renders
// them with React, a query client seeded with the learner's song, a fake API client and a memory router: it checks
// what is drawn and posted, never layout, sound or motion.
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
const { songViewOf } = await import("./model.ts");
const { SongGrid } = await import("./SongGrid.tsx");
const { SongHero } = await import("./SongHero.tsx");
const { NewSong } = await import("./NewSong.tsx");
const { SongPage } = await import("./SongPage.tsx");
const { SongCard } = await import("./SongCard.tsx");
const { SongGrew } = await import("./SongGrew.tsx");
const {
  cellsSentence,
  grewSentence,
  partTracks,
  releaseOffer,
  songReleaseOfVersion,
  songReleaseRenderRequest,
} = await import("./surfaces-model.ts");
const { TEST_SONG, testDetail, testTake } = await import("./test-song.ts");

import type { SessionPlan, TakeStep, UnitSongDetail, UnitSongSnapshot, UnitSongSummary } from "@oak/api";

const KICK_SNARE = 'setcpm(96/4)\n\ndrums: s("bd sd bd sd")';
const L01 = testTake(1, "U01.L01", KICK_SNARE, ["kick@verse", "snare@verse"], {
  bpm: 96,
  labels: { drums: null },
});
const L02_STEP = TEST_SONG.plan[1] as TakeStep;
const SECTION_WORDS = /\b(verse|chorus|intro|outro|bridge|break)\b/i;

// --- harness ------------------------------------------------------------------------------------------------

interface Sent {
  method: string;
  path: string;
  body: unknown;
}
let sent: Sent[] = [];
let answer: (s: Sent) => unknown = () => ({});
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

beforeAll(() => {
  document.documentElement.dataset.theme = "paper";
  document.documentElement.dataset.motion = "reduced";
  setApiClient(
    createClient({
      fetch: async (url, init) => {
        const s: Sent = {
          method: init?.method ?? "GET",
          path: new URL(String(url), "http://oak.test").pathname,
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        };
        sent.push(s);
        return json(answer(s));
      },
    }),
  );
});

afterAll(async () => {
  await act(async () => root?.unmount());
});

/** Renders a node with the learner's song and terms seeded, inside a memory router. */
async function render(node: ReactNode, seed: { detail?: UnitSongDetail | null; terms?: string[] } = {}) {
  if (root) await act(async () => root.unmount());
  container?.remove();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  sent = [];
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  if (seed.detail) qc.setQueryData(apiKey("songs.get", { params: { unitId: "U01" } }), seed.detail);
  qc.setQueryData(apiKey("terms.introduced"), {
    items: (seed.terms ?? []).map((termId) => ({
      termId,
      lessonId: "U01.L01",
      at: "2026-11-20T10:00:00.000Z",
    })),
  });
  const rootRoute = createRootRoute({ component: () => node });
  const router = createRouter({
    routeTree: rootRoute,
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

const all = (sel: string) => [...container.querySelectorAll<HTMLElement>(sel)];
const one = (sel: string) => {
  const el = container.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};
const text = () => container.textContent ?? "";

function plan(extra: Partial<NonNullable<SessionPlan["song"]>> = {}): SessionPlan {
  return {
    kind: "lesson",
    mapItemId: "U01.L02",
    title: "The second lesson",
    song: {
      unitId: "U01",
      songId: "usong.U01",
      title: "My groove",
      flavour: "flavour.indie",
      status: "open",
      takesCount: 1,
      lessonIndex: 2,
      lessonsInSong: 3,
      today: L02_STEP.today,
      side: false,
      ...extra,
    },
  } as unknown as SessionPlan;
}

// --- the tests ------------------------------------------------------------------------------------------------

describe("song surfaces", () => {
  test("SongGrid draws one column per section with widths by bars and marks yours, Oak's and today's cells", async () => {
    const view = songViewOf(TEST_SONG, testDetail([L01]), new Set(), { live: L02_STEP });
    await render(<SongGrid view={view} />);
    const heads = all("[data-section]");
    expect(heads.map((h) => h.dataset.section)).toEqual(["intro", "verse", "stop", "chorus1", "chorus2"]);
    expect(heads.map((h) => Number(h.dataset.bars))).toEqual([4, 8, 1, 8, 8]);
    // Each column spans its bars on a grid of 29 bars, after the row names' column.
    const spans = heads.map((h) => h.getAttribute("style") ?? "");
    expect(spans[0]).toContain("grid-column: 2 / span 4");
    expect(spans[1]).toContain("grid-column: 6 / span 8");
    expect(spans[2]).toContain("grid-column: 14 / span 1");
    expect(one("[data-section] ~ *").parentElement?.getAttribute("style")).toContain(
      "repeat(29, minmax(0, 1fr))",
    );
    const cell = (k: string) => one(`[data-cell="${k}"]`);
    expect(cell("kick@verse").dataset.owner).toBe("yours");
    expect(cell("kick@verse").getAttribute("style")).toContain("background");
    expect(cell("hats@chorus1").dataset.owner).toBe("today");
    expect(cell("hats@chorus2").dataset.owner).toBe("today");
    expect(cell("bass@verse").dataset.owner).toBe("oak");
    // Oak rests in the opening: that cell is drawn empty, not pencilled in.
    expect(cell("snare@intro").dataset.rests).toBe("1");
    expect(cell("kick@intro").dataset.rests).toBeUndefined();
    expect(all("[data-cell]")).toHaveLength(25);
    // The legend and the summary say the same in words.
    expect(text()).toContain("Yours");
    expect(one('[data-testid="song-grid-summary"]').textContent).toContain("Yours: Kick in B; Snare in B.");
    // A fixed playhead sits in the bar it is given.
    await render(<SongGrid view={view} playheadBar={5} />);
    expect(one('[data-testid="song-playhead"]').getAttribute("style")).toContain("opacity: 1");
    expect(one('[data-section="verse"]').dataset.playing).toBe("1");
  });

  test("SongHero shows today's line and the lesson count", async () => {
    await render(<SongHero plan={plan()} song={TEST_SONG} />, { detail: testDetail([L01]) });
    expect(one('[data-testid="song-hero-count"]').textContent).toContain("Lesson 2 of 3 in this song");
    expect(one('[data-testid="song-hero-today"]').textContent).toBe(L02_STEP.today);
    expect(one("#song-hero-title").textContent).toBe("My groove");
    // Today's cells are the step's in both big sections; the earlier take is yours.
    expect(one('[data-cell="kick@chorus1"]').dataset.owner).toBe("today");
    expect(one('[data-cell="kick@verse"]').dataset.owner).toBe("yours");
    // One dot per lesson of the plan: the first in, the second today, the side step a dash.
    expect(all("[data-dot]").map((d) => d.dataset.dot)).toEqual(["yours", "today", "side"]);
    expect(one('[data-testid="song-hero-play"]').hasAttribute("disabled")).toBe(false);
    // A side step says why its Make stays a sketch of its own.
    await render(
      <SongHero
        plan={{ ...plan({ today: null, side: true }), mapItemId: "U01.L03" } as SessionPlan}
        song={TEST_SONG}
      />,
      { detail: testDetail([L01]) },
    );
    expect(one('[data-testid="song-hero-side"]').textContent).toContain("three to a bar");
    // A song with no planned song line draws nothing.
    await render(<SongHero plan={{ ...plan(), song: null } as SessionPlan} song={TEST_SONG} />);
    expect(container.querySelector('[data-testid="song-hero"]')).toBeNull();
  });

  test("NewSong lists five styles and posts songs.start with the picked flavour", async () => {
    const fresh = testDetail([], { status: "new", flavour: "flavour.pop", title: "The test song" });
    answer = (s) => (s.path.endsWith("/start") ? testDetail([], { flavour: "flavour.funk" }) : fresh);
    let started = 0;
    await render(<NewSong unitId="U01" song={TEST_SONG} onStarted={() => started++} />, { detail: fresh });
    const options = all('[data-testid="style-option"]') as HTMLInputElement[];
    expect(options.map((o) => o.value)).toEqual([
      "flavour.pop",
      "flavour.indie",
      "flavour.jazz-soul",
      "flavour.funk",
      "flavour.electronic",
    ]);
    expect(all('[data-testid="style-play"]')).toHaveLength(5);
    // It opens on the profile's style (the server's answer for a song not started).
    expect(options.find((o) => o.checked)?.value).toBe("flavour.pop");
    expect(one('[data-testid="new-song-title"]').textContent).toBe("The test song");
    await act(async () => (options[3] as HTMLInputElement).click());
    expect(one('[data-style="flavour.funk"]').dataset.picked).toBe("1");
    expect(one('[data-testid="new-song-start"]').textContent).toBe("Start this song in Funk");
    await act(async () => one('[data-testid="new-song-start"]').click());
    await act(async () => {});
    const posts = sent.filter((s) => s.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.path).toBe("/api/songs/U01/start");
    expect(posts[0]?.body).toMatchObject({ flavour: "flavour.funk" });
    expect((posts[0]?.body as { idempotencyKey?: string } | undefined)?.idempotencyKey).toMatch(
      /^[A-Za-z0-9_-]{8,64}$/,
    );
    expect(started).toBe(1);
  });

  test("SongPage offers Release only when releasable and Release again when changed", async () => {
    const button = () => container.querySelector<HTMLElement>('[data-testid="song-release-go"]');
    answer = () => ({});
    // Not releasable yet: no button, a line that says what it waits for.
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail: testDetail([L01]) });
    expect(one('[data-testid="song-album"]').dataset.offer).toBe("not-yet");
    expect(button()).toBeNull();
    expect(one('[data-testid="song-album-wait"]').textContent).toContain(
      "once you finish this unit's checkpoint",
    );
    // The history lists the take with what it took and ▶ for that version.
    expect(all('[data-testid="song-take"]')).toHaveLength(1);
    expect(one('[data-testid="song-take"]').textContent).toContain("Kick and Snare in B");
    // Releasable: Release to the album.
    await render(<SongPage unitId="U01" song={TEST_SONG} />, {
      detail: testDetail([L01], { releasable: true }),
    });
    expect(button()?.textContent).toBe("Release to the album");
    // Released and unchanged: no button, the release is listed.
    const release = {
      id: 1,
      albumTrackId: "trk_1",
      albumVersion: 1,
      flavour: "flavour.indie" as const,
      title: "My groove",
      createdAt: "2026-11-24T10:00:00.000Z",
    };
    const released = testDetail([L01], { status: "released", releasable: true, releases: [release] });
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail: released });
    expect(button()).toBeNull();
    expect(all('[data-testid="song-release-row"]')).toHaveLength(1);
    // Changed since: Release again.
    await render(<SongPage unitId="U01" song={TEST_SONG} />, {
      detail: { ...released, changedSinceRelease: true },
    });
    expect(button()?.textContent).toBe("Release again");
    // Mute and solo for every part.
    expect(all('[data-testid="part-mute"]')).toHaveLength(TEST_SONG.parts.length);
    expect(all('[data-testid="part-solo"]')).toHaveLength(TEST_SONG.parts.length);
  });

  test("SongGrew fills today's cells, plays before and after, and offers the release when the song can go", async () => {
    const L02 = testTake(2, "U01.L02", 'setcpm(96/4)\n\ndrums: s("bd sd, hh*4")', [
      "kick@chorus1",
      "snare@chorus1",
      "hats@chorus1",
      "kick@chorus2",
      "snare@chorus2",
      "hats@chorus2",
    ]);
    await render(<SongGrew lessonId="U01.L02" song={TEST_SONG} fallback={<p data-testid="fallback" />} />, {
      detail: testDetail([L01, L02]),
    });
    expect(one('[data-testid="coda-song-grew"]').textContent).toContain("Your song grew");
    expect(one('[data-testid="coda-song-sentence"]').textContent).toBe(
      "The song now plays your kick, snare and hats in D.",
    );
    // They fill section by section: the order is each cell's delay index.
    const order = (c: HTMLElement) => Number(/--i:\s*(\d+)/.exec(c.getAttribute("style") ?? "")?.[1]);
    const fills = all(".oak-song-fresh").sort((a, b) => order(a) - order(b));
    expect(fills.map((c) => c.dataset.cell)).toEqual([
      "kick@chorus1",
      "snare@chorus1",
      "hats@chorus1",
      "kick@chorus2",
      "snare@chorus2",
      "hats@chorus2",
    ]);
    expect(one('[data-testid="coda-song-before"]').textContent).toBe("Before today");
    expect(one('[data-testid="coda-song-after"]').textContent).toBe("With today");
    expect(one('[data-testid="song-cover"]').dataset.rings).toBe("2");
    expect(container.querySelector('[data-testid="song-release"]')).toBeNull();
    await render(<SongGrew lessonId="U01.L02" song={TEST_SONG} />, {
      detail: testDetail([L01, L02], { releasable: true }),
    });
    expect(one('[data-testid="song-release-go"]').textContent).toBe("Release to the album");
    // A lesson with no take in the song, or a side step, shows the sketch card instead.
    await render(<SongGrew lessonId="U01.L03" song={TEST_SONG} fallback={<p data-testid="fallback" />} />, {
      detail: testDetail([L01]),
    });
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
    await render(<SongGrew lessonId="U01.L02" song={TEST_SONG} fallback={<p data-testid="fallback" />} />, {
      detail: testDetail([L01]),
    });
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
  });

  test("no section name before its term", async () => {
    await render(<SongHero plan={plan()} song={TEST_SONG} />, { detail: testDetail([L01]) });
    expect(text()).not.toMatch(SECTION_WORDS);
    expect(all("[data-section]").map((h) => h.textContent)).toEqual(["A", "B", "C", "D", "D"]);
    await render(<SongCard lessonId="U01.L02" song={TEST_SONG} />, { detail: testDetail([L01]) });
    expect(container.querySelector('[data-testid="song-card"]')).not.toBeNull();
    expect(text()).not.toMatch(SECTION_WORDS);
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail: testDetail([L01]) });
    expect(text()).not.toMatch(SECTION_WORDS);
    // Once the learner has met the terms, the names show.
    await render(<SongHero plan={plan()} song={TEST_SONG} />, {
      detail: testDetail([L01]),
      terms: ["term.verse", "term.chorus"],
    });
    expect(all("[data-section]").map((h) => h.textContent)).toEqual(["A", "Verse", "C", "Chorus", "Chorus"]);
  });
});

describe("song surface words", () => {
  const view = songViewOf(TEST_SONG, testDetail([L01]), new Set());
  test("what a take holds is said in the view's words", () => {
    expect(cellsSentence(view, ["kick@verse", "snare@verse"])).toBe("Kick and Snare in B");
    expect(cellsSentence(view, ["bass@chorus1", "bass@chorus2"])).toBe("Bass in D");
    expect(cellsSentence(view, [])).toBeNull();
    expect(grewSentence(view, ["kick@verse", "snare@verse"])).toBe(
      "The song now plays your kick and snare in B.",
    );
    expect(grewSentence(view, ["hats@verse", "hats@chorus1"])).toBe(
      "The song now plays your hats in B and D.",
    );
  });

  test("a part's mute acts on Oak's track and on the take line that plays it", () => {
    const detail = testDetail([L01]);
    expect(partTracks(TEST_SONG, detail, "kick")).toEqual(["band.oak.kick", "band.take.U01.L01.drums"]);
    expect(partTracks(TEST_SONG, detail, "bass")).toEqual(["band.oak.bass"]);
  });

  test("the album offer follows the song's state", () => {
    const base = testDetail([L01]);
    expect(releaseOffer(base)).toBe("not-yet");
    expect(releaseOffer({ ...base, releasable: true })).toBe("release");
  });
});

describe("a released song on the album plays its frozen release", () => {
  const L02 = testTake(2, "U01.L02", 'setcpm(96/4)\n\nhats: s("hh*8")', ["hats@chorus1"], { bpm: 98 });
  const snapshot: UnitSongSnapshot = {
    id: 7,
    unitId: "U01",
    albumTrackId: "trk_1",
    albumVersion: 2,
    songId: "usong.U01",
    songVersion: 1,
    flavour: "flavour.funk",
    title: "Second",
    bpm: 98,
    oakCode: 'kick: s("bd*4")',
    def: TEST_SONG,
    takes: [L01, L02].map((t) => ({
      takeId: t.id,
      lessonId: t.lessonId,
      sketchId: t.sketchId,
      sketchVersion: t.sketchVersion,
      code: t.code,
      cells: t.cells,
      labels: t.labels,
      bpm: t.bpm,
    })),
    reviewBeforeRun: false,
    createdAt: "2026-11-24T10:00:00.000Z",
  };

  test("the export renders the whole song as released, every take and Oak's frozen code", () => {
    const req = songReleaseRenderRequest(snapshot);
    expect(req.code).toBe("");
    expect(req.key).toBeNull();
    expect([...req.mutes.muted]).toEqual([]);
    const song = req.band?.song;
    expect(song?.oakCode).toBe('kick: s("bd*4")');
    expect(song?.flavour).toBe("flavour.funk");
    expect(song?.bpm).toBe(98);
    expect(song?.sources.map((s) => [s.sourceId, s.code])).toEqual([
      ["1", L01.code],
      ["2", L02.code],
    ]);
    expect(req.band?.tracks).toContain("take.U01.L01.drums");
    expect(req.band?.tracks).toContain("take.U01.L02.hats");
  });

  test("an album version is a song release when the song's releases name it", () => {
    const songs = [
      {
        ...testDetail([L01]),
        releases: [
          {
            id: 3,
            albumTrackId: "trk_1",
            albumVersion: 1,
            flavour: "flavour.pop",
            title: "First",
            createdAt: "x",
          },
          {
            id: 7,
            albumTrackId: "trk_1",
            albumVersion: 2,
            flavour: "flavour.funk",
            title: "Second",
            createdAt: "y",
          },
        ],
      },
    ] as UnitSongSummary[];
    expect(songReleaseOfVersion(songs, "trk_1", 2)).toEqual({ unitId: "U01", releaseId: 7 });
    expect(songReleaseOfVersion(songs, "trk_1", 1)).toEqual({ unitId: "U01", releaseId: 3 });
    expect(songReleaseOfVersion(songs, "trk_2", 1)).toBeNull();
    expect(songReleaseOfVersion(undefined, "trk_1", 1)).toBeNull();
  });
});
