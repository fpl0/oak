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
const { ReleasePlayButton } = await import("./AlbumSongs.tsx");
const { stopName } = await import("./SongPlayButton.tsx");
const {
  blocksLine,
  cellsSentence,
  cellsHeldBy,
  grewSentence,
  lessonDots,
  lessonsInSong,
  ownedCount,
  partsPlayedByTake,
  partTracks,
  releaseOffer,
  songReleaseOfVersion,
  songLessonOf,
  songReleaseRenderRequest,
  todayAdds,
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
/** The query client of the last `render`. */
let client: QueryClient;

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
        const out = await answer(s);
        return out instanceof Response ? out : json(out);
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
  client = qc;
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
    // One column per section after the row names' column, as wide as its bars, never under 14px (the one-bar stop).
    const spans = heads.map((h) => h.getAttribute("style") ?? "");
    expect(spans[0]).toContain("grid-column: 2;");
    expect(spans[2]).toContain("grid-column: 4;");
    expect(one("[data-section] ~ *").parentElement?.getAttribute("style")).toContain(
      "minmax(14px, 4fr) minmax(14px, 8fr) minmax(14px, 1fr) minmax(14px, 8fr) minmax(14px, 8fr)",
    );
    // Every header shows at least its letter (shared decision 4): none is left blank, the one-bar stop included.
    expect(heads.map((h) => h.textContent)).toEqual(["A", "B", "C", "D", "D"]);
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
    // The legend names the four states the grid has; "Oak rests" is the empty, dashed block.
    expect(all("[data-legend]").map((l) => l.textContent)).toEqual(["Today", "Yours", "Oak", "Oak rests"]);
    expect(cell("snare@intro").className).toContain("oak-song-rest");
    expect(cell("bass@verse").className).toContain("oak-song-oak");
    // The summary says the same in words.
    expect(one('[data-testid="song-grid-summary"]').textContent).toContain(
      "Yours: Kick in section B; Snare in section B.",
    );
    // A fixed playhead sits in the bar it is given.
    await render(<SongGrid view={view} playheadBar={5} />);
    expect(one('[data-testid="song-playhead"]').getAttribute("style")).toContain("opacity: 1");
    expect(one('[data-section="verse"]').dataset.playing).toBe("1");
  });

  test("SongHero shows today's line and the lesson count", async () => {
    await render(<SongHero plan={plan()} song={TEST_SONG} />, { detail: testDetail([L01]) });
    // Take lessons only (the side step L03 has no number), and blocks, never "cells": only saved blocks are yours (as
    // the song page says), today's are said apart.
    expect(one('[data-testid="song-hero-count"]').textContent).toBe(
      "Lesson 2 of 2 in this song · 2 of 16 blocks are yours · today adds 6",
    );
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
    // A side day has no number, and its dash keeps its shape (ringed as today's).
    expect(one('[data-testid="song-hero-count"]').textContent).toMatch(/^2 lessons in this song/);
    expect(all("[data-dot]").map((d) => d.dataset.dot)).toEqual(["yours", "later", "side-today"]);
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
    expect(one('[data-testid="song-take"]').textContent).toContain("Kick and Snare in section B");
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

  test("the song page's status line says which parts are muted or soloed", async () => {
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail: testDetail([L01]) });
    const parts = () => one('[data-testid="song-page-parts"]').textContent;
    expect(parts()).toBe("");
    const mute = all('[data-testid="part-mute"]');
    await act(async () => mute[0]?.click());
    const first = TEST_SONG.parts[0]?.name;
    expect(parts()).toBe(`${first} muted.`);
    await act(async () => all('[data-testid="part-solo"]')[1]?.click());
    expect(parts()).toBe(`Only ${TEST_SONG.parts[1]?.name} plays.`);
    expect(one('[data-testid="song-page-parts"]').getAttribute("aria-live")).toBe("polite");
  });

  test("the lesson's song card holds its room while the song is read, never showing the side box first", async () => {
    answer = (s) => (s.path === "/api/songs/U01" ? new Promise(() => {}) : {});
    await render(<SongCard lessonId="U01.L02" song={TEST_SONG} orElse={<p data-testid="alone" />} />);
    expect(container.querySelector('[data-testid="song-card-pending"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="alone"]')).toBeNull();
    answer = () => ({});
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
      "The song now plays your kick, snare and hats in both D sections.",
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
    expect(cellsSentence(view, ["kick@verse", "snare@verse"])).toBe("Kick and Snare in section B");
    // A repeated section is told apart: all of them ("both"), or some of them by their bars.
    expect(cellsSentence(view, ["bass@chorus1", "bass@chorus2"])).toBe("Bass in both D sections");
    const chorus2 = view.sections.find((x) => x.id === "chorus2");
    expect(cellsSentence(view, ["bass@chorus2"])).toBe(
      `Bass in section D at bar ${(chorus2?.startBar ?? 0) + 1}`,
    );
    expect(cellsSentence(view, [])).toBeNull();
    expect(grewSentence(view, ["kick@verse", "snare@verse"])).toBe(
      "The song now plays your kick and snare in section B.",
    );
    expect(grewSentence(view, ["hats@verse", "hats@chorus1"])).toBe(
      `The song now plays your hats in section B and section D at bar ${(view.sections.find((x) => x.id === "chorus1")?.startBar ?? 0) + 1}.`,
    );
    expect(grewSentence(view, ["hats@intro", "hats@verse"])).toBe(
      "The song now plays your hats in sections A and B.",
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

// --- review fixes (wave F1) -----------------------------------------------------------------------------------

describe("review fixes", () => {
  const release = {
    id: 1,
    albumTrackId: "trk_1",
    albumVersion: 1,
    flavour: "flavour.indie" as const,
    title: "My groove",
    createdAt: "2026-11-24T10:00:00.000Z",
  };

  test("a released song whose album track was removed offers the release again and is not 'On the album'", async () => {
    const gone = testDetail([L01], {
      status: "released",
      releasable: true,
      releases: [{ ...release, albumTrackId: null }],
    });
    expect(releaseOffer(gone)).toBe("release");
    expect(releaseOffer({ ...gone, releasable: false })).toBe("not-yet");
    expect(releaseOffer({ ...gone, releases: [release] })).toBe("on-album");
    expect(releaseOffer({ ...gone, releases: [release], changedSinceRelease: true })).toBe("again");
    answer = () => ({});
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail: gone });
    expect(one('[data-testid="song-page-meta"]').textContent).toContain("Off the album");
    expect(one('[data-testid="song-release-go"]').textContent).toBe("Release to the album");
    expect(one('[data-testid="song-release-row"]').textContent).toContain("Removed from the album");
  });

  test("a lesson redone counts once: 'N of M lessons in it' counts lessons, of the take steps", async () => {
    const again = testTake(2, "U01.L01", KICK_SNARE, ["kick@verse", "snare@verse"], { sketchId: "sk_9" });
    const detail = testDetail([L01, again]);
    expect(lessonsInSong(TEST_SONG, detail)).toEqual({ done: 1, of: 2 });
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail });
    expect(one('[data-testid="song-page-meta"]').textContent).toContain("1 of 2 lessons in it");
    expect(one('[data-testid="song-cover"]').getAttribute("aria-label") ?? "").not.toContain(
      "one per lesson",
    );
  });

  test("the style line names the style asked for, and a failed change says so", async () => {
    let respond!: (r: Response) => void;
    answer = (s) => (s.method === "GET" ? testDetail([L01]) : new Promise<Response>((r) => (respond = r)));
    await render(<SongPage unitId="U01" song={TEST_SONG} />, { detail: testDetail([L01]) });
    const funk = all('[role="radio"]').find((b) => b.textContent === "Funk");
    await act(async () => funk?.click());
    await act(() => new Promise((r) => setTimeout(r, 5)));
    expect(one('[data-testid="song-style-line"]').textContent).toBe("Changing to Funk…");
    await act(async () =>
      respond(json({ error: { code: "internal", message: "The server stopped." } }, 500)),
    );
    await act(() => new Promise((r) => setTimeout(r, 5)));
    expect(one('[data-testid="song-style-error"]').textContent).toContain("The style is still Indie");
  });

  test("a release ▶ whose song cannot be read says so", async () => {
    answer = () => json({ error: { code: "internal", message: "down" } }, 500);
    await render(<ReleasePlayButton unitId="U01" release={1} label="Play it as released" />);
    await act(async () => one('[data-testid="song-shelf-play"]').click());
    await act(async () => {});
    expect(one('[data-testid="song-shelf-play-error"]').textContent).toBe("The song did not load.");
  });

  test("the Coda shows today's take only when it is from today's sketch; a release point that is a side step offers the release", async () => {
    const fallback = <p data-testid="fallback" />;
    // A redo whose take did not reach the song: the newest take of the lesson is an earlier run's.
    await render(
      <SongGrew lessonId="U01.L01" song={TEST_SONG} sketchIds={["sk_today"]} fallback={fallback} />,
      { detail: testDetail([L01]) },
    );
    expect(container.querySelector('[data-testid="coda-song-grew"]')).toBeNull();
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
    expect(one('[data-testid="coda-song-missing"]').textContent).toContain("has not reached your song yet");
    // Today's sketch is the take's: the song grew.
    await render(<SongGrew lessonId="U01.L01" song={TEST_SONG} sketchIds={["sk_1"]} fallback={fallback} />, {
      detail: testDetail([L01]),
    });
    expect(container.querySelector('[data-testid="coda-song-grew"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="coda-song-missing"]')).toBeNull();
    // A side step that is the song's release point: the sketch card, then the Release card.
    await render(<SongGrew lessonId="U01.L03" song={TEST_SONG} release="U01" fallback={fallback} />, {
      detail: testDetail([L01], { releasable: true }),
    });
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
    expect(one('[data-testid="song-release-go"]').textContent).toBe("Release to the album");
  });

  test("right after a save, the song in hand is not judged until the grown song is read", async () => {
    // The save invalidated the song: the copy in hand predates today's take, and the new read is under way.
    let release: (detail: UnitSongDetail) => void = () => {};
    const grown = testDetail([L01, testTake(2, "U01.L02", 'chords: n("0 2 4")', ["chords@verse"])]);
    await render(
      <SongGrew
        lessonId="U01.L02"
        song={TEST_SONG}
        sketchIds={["sk_2"]}
        fallback={<p data-testid="fallback" />}
        pending={<p data-testid="grew-pending" />}
      />,
      { detail: testDetail([L01]) },
    );
    answer = (s) =>
      s.path.endsWith("/songs/U01") ? new Promise((resolve) => (release = (d) => resolve(json(d)))) : {};
    await act(async () => {
      void client.invalidateQueries({ queryKey: ["api", "songs.get"] });
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(container.querySelector('[data-testid="grew-pending"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="coda-song-missing"]')).toBeNull();
    expect(container.querySelector('[data-testid="fallback"]')).toBeNull();
    await act(async () => {
      release(grown);
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(container.querySelector('[data-testid="coda-song-grew"]')).not.toBeNull();
  });

  test("the Coda's sentence names only the parts the take's code plays", () => {
    const view = songViewOf(TEST_SONG, testDetail([L01]), new Set());
    const fourKicks = { labels: { drums: null }, code: 'setcpm(96/4)\n\ndrums: s("bd bd bd bd")' };
    const played = partsPlayedByTake(TEST_SONG, fourKicks);
    expect([...(played ?? [])]).toEqual(["kick"]);
    expect(grewSentence(view, ["kick@verse", "snare@verse", "hats@verse"], played)).toBe(
      "The song now plays your kick in section B; the snare and hats rest there now.",
    );
    expect(partsPlayedByTake(TEST_SONG, { labels: {}, code: 's("bd")' })).toBeNull();
    expect(
      [
        ...(partsPlayedByTake(TEST_SONG, { labels: { drums: null }, code: 'drums: s("bd sd, hh*4")' }) ?? []),
      ].sort(),
    ).toEqual(["hats", "kick", "snare"]);
    expect(grewSentence(view, ["kick@verse"], new Set())).toBe(
      "Your code took over the kick in section B; it rests there now.",
    );
  });

  test("an imported take that fails the strict lint leaves its cells, mute and solo to Oak", () => {
    const cells = TEST_SONG.sections.map((s) => `kick@${s.id}`);
    const bad = testTake(7, "U01.L01", 'kick: s("bd*4")\nfetch("http://x")', cells, {
      reviewBeforeRun: true,
      labels: { kick: "kick" },
    });
    const detail = testDetail([bad]);
    const view = songViewOf(TEST_SONG, detail, new Set());
    expect(view.cells.filter((c) => c.owner === "yours")).toHaveLength(0);
    expect(cellsHeldBy(TEST_SONG, detail, 7)).toEqual([]);
    expect(partTracks(TEST_SONG, detail, "kick")).toEqual(["band.oak.kick"]);
  });

  test("on a side step before a song starts, Today does not say a new song starts today", async () => {
    const fresh = testDetail([], { status: "new" });
    const sidePlan = {
      ...plan({ status: "new", today: null, side: true }),
      mapItemId: "U01.L03",
    } as SessionPlan;
    await render(<SongHero plan={sidePlan} song={TEST_SONG} />, { detail: fresh });
    expect(text()).not.toContain("A new song starts today");
    expect(text()).toContain("A new song starts");
    // The reason alone: it already says the Make stays a sketch of its own.
    const sideStep = TEST_SONG.plan[2] as { reason: string };
    expect(one('[data-testid="song-hero-side"]').textContent).toBe(sideStep.reason);
  });
});

/** Lets queries and effects run until `done` holds (or a few rounds pass). */
async function settle(done: () => boolean) {
  for (let i = 0; i < 20 && !done(); i++) await act(async () => new Promise((r) => setTimeout(r, 5)));
}

describe("the hero, the style cards and the New song moment (2026-11-24 review, group hero)", () => {
  test("counts: blocks that sound, only saved ones yours, today's said apart; lessons are take lessons only", () => {
    const view = songViewOf(TEST_SONG, testDetail([L01]), new Set(), { live: L02_STEP });
    const saved = songViewOf(TEST_SONG, testDetail([L01]), new Set());
    // The song page's number (the saved song) and Today's are the same; Today adds today's blocks apart.
    expect(blocksLine(saved)).toBe("2 of 16 blocks are yours");
    expect(todayAdds(saved, view)).toBe(6);
    expect(blocksLine(saved, todayAdds(saved, view))).toBe("2 of 16 blocks are yours · today adds 6");
    // Today's blocks in a view never count as yours, even with the Make open.
    expect(ownedCount(view).yours).toBe(2);
    // Once today's Make is saved, its blocks are yours on both surfaces, and today adds nothing more.
    const todays = view.cells.filter((c) => c.owner === "today").map((c) => `${c.part}@${c.section}`);
    const L02 = testTake(2, "U01.L02", L01.code, todays);
    const after = songViewOf(TEST_SONG, testDetail([L01, L02]), new Set());
    const afterLive = songViewOf(TEST_SONG, testDetail([L01, L02]), new Set(), { live: L02_STEP });
    expect(todayAdds(after, afterLive)).toBe(0);
    expect(ownedCount(after).yours).toBe(ownedCount(saved).yours + 6);
    expect(songLessonOf(TEST_SONG, "U01.L02")).toEqual({ index: 2, of: 2 });
    expect(songLessonOf(TEST_SONG, "U01.L03")).toEqual({ index: null, of: 2 });
    expect(view.lessonsInSong).toBe(2);
  });

  test("dots: a finished lesson of a song not started is done, a side lesson keeps its dash on its own day", () => {
    const states = (today: string, done: string[] = []) =>
      lessonDots(TEST_SONG, null, today, new Set(done)).map((d) => d.state);
    expect(states("U01.L02", ["U01.L01"])).toEqual(["done", "today", "side"]);
    expect(states("U01.L03", ["U01.L01", "U01.L02"])).toEqual(["done", "done", "side-today"]);
    expect(lessonDots(TEST_SONG, testDetail([L01]), "U01.L02").map((d) => d.state)).toEqual([
      "yours",
      "today",
      "side",
    ]);
  });

  test("a play button's name says Stop in place of Play, never 'Stop Play …'", () => {
    expect(stopName("Play “Count me in” as it stands")).toBe("Stop “Count me in” as it stands");
    expect(stopName("Before today")).toBe("Stop: Before today");
  });

  test("done for today: the hero speaks of the next lesson, not today's", async () => {
    await render(<SongHero plan={plan()} song={TEST_SONG} done />, { detail: testDetail([L01]) });
    // The next lesson's blocks are not counted as yours yet.
    expect(one('[data-testid="song-hero-count"]').textContent).toBe(
      "Next: lesson 2 of 2 in this song · 2 of 16 blocks are yours",
    );
    expect(one('[data-testid="song-hero-today"]').textContent).toBe(`Next time: ${L02_STEP.today}`);
    expect(text()).toContain("Next lesson");
    expect(one('[data-dot="today"]').getAttribute("title")).toMatch(/: next$/);
    expect(one('[data-testid="song-hero"]').dataset.state).toBe("done");
  });

  test("the hero's play button is the quiet one, and has no pressed state", async () => {
    await render(<SongHero plan={plan()} song={TEST_SONG} />, { detail: testDetail([L01]) });
    const play = one('[data-testid="song-hero-play"]');
    expect(play.dataset.tone).toBe("quiet");
    expect(play.hasAttribute("aria-pressed")).toBe(false);
    expect(play.getAttribute("aria-label")).toBe("Play “My groove” as it stands");
  });

  test("while the song is read the hero draws no lesson as not in it; a failed read says so with Try again", async () => {
    answer = (s) => (s.path === "/api/songs/U01" ? new Promise(() => {}) : {});
    await render(<SongHero plan={plan()} song={TEST_SONG} />);
    expect(one('[data-testid="song-hero"]').dataset.state).toBe("loading");
    expect(container.querySelector("[data-cell]")).toBeNull();
    expect(container.querySelector("[data-dot]")).toBeNull();
    expect(one('[data-testid="song-hero-count"]').textContent).toBe("Lesson 2 of 2 in this song");

    answer = (s) =>
      s.path === "/api/songs/U01" ? json({ error: { code: "internal", message: "boom" } }, 500) : {};
    await render(<SongHero plan={plan()} song={TEST_SONG} />);
    await settle(() => one('[data-testid="song-hero"]').dataset.state !== "loading");
    expect(one('[data-testid="song-hero"]').dataset.state).toBe("error");
    expect(one('[data-testid="song-hero-error"]').textContent).toContain("Your song could not be read");
    expect(container.querySelector("[data-cell]")).toBeNull();
    answer = (s) => (s.path === "/api/songs/U01" ? testDetail([L01]) : {});
    await act(async () => one('[data-testid="song-hero-retry"]').click());
    await settle(() => one('[data-testid="song-hero"]').dataset.state === "ready");
    expect(one('[data-testid="song-hero"]').dataset.state).toBe("ready");
    expect(one('[data-cell="kick@verse"]').dataset.owner).toBe("yours");
    // "Try again" went with the error: focus moves on to the hero's ▶, not to the page.
    expect(document.activeElement).toBe(one('[data-testid="song-hero-play"]'));
    answer = () => ({});
  });

  test("in each style card Tab reaches the radio first, then its ▶", async () => {
    const fresh = testDetail([], { status: "new", flavour: "flavour.pop", title: "The test song" });
    answer = () => fresh;
    await render(<NewSong unitId="U01" song={TEST_SONG} onStarted={() => {}} />, { detail: fresh });
    for (const card of all("[data-style]")) {
      const radio = card.querySelector('[data-testid="style-option"]') as HTMLElement;
      const play = card.querySelector('[data-testid="style-play"]') as HTMLElement;
      expect(radio.compareDocumentPosition(play) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    answer = () => ({});
  });

  test("the style card plays the learner's song in each style; Keep says so and moves focus on", async () => {
    const made = testDetail([L01], { backfilled: true, styleSeen: false });
    answer = (s) => (s.method === "POST" ? { ...made, styleSeen: true } : made);
    await render(<SongHero plan={plan()} song={TEST_SONG} />, { detail: made });
    const plays = all('[data-testid="style-play"]');
    expect(plays.map((b) => b.getAttribute("aria-label"))).toContain("Play your song in Funk");
    expect(plays.some((b) => b.hasAttribute("aria-pressed"))).toBe(false);
    // The picked style has its check on the cover, not only the ring.
    expect(one('[data-picked="1"]').querySelector('[data-testid="style-check"]')).not.toBeNull();
    await act(async () => one('[data-testid="song-style-keep"]').click());
    await act(async () => {});
    expect(sent.some((x) => x.method === "POST" && x.path === "/api/songs/U01/style-seen")).toBe(true);
    expect(one('[data-testid="song-hero-said"]').textContent).toBe("Your song stays in Indie.");
    expect(document.activeElement).toBe(one('[data-testid="song-hero-open"]'));
    answer = () => ({});
  });

  test("New song: a title of spaces keeps Oak's heading and says why Start waits", async () => {
    const fresh = testDetail([], { status: "new", flavour: "flavour.pop", title: "The test song" });
    answer = () => fresh;
    await render(<NewSong unitId="U01" song={TEST_SONG} onStarted={() => {}} />, { detail: fresh });
    // Before the style is picked, its ▶ plays Oak's song (there is no song of the learner's yet).
    expect(all('[data-testid="style-play"]').map((b) => b.getAttribute("aria-label"))).toContain(
      "Play the song in Funk",
    );
    expect(one('[data-testid="new-song-grid-caption"]').textContent).toContain("each row is a part");
    const input = one('[data-testid="new-song-name"]') as HTMLInputElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      set?.call(input, "   ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(one('[data-testid="new-song-title"]').textContent).toBe(TEST_SONG.title);
    const start = one('[data-testid="new-song-start"]');
    expect(start.hasAttribute("disabled")).toBe(true);
    const need = one('[data-testid="new-song-need-title"]');
    expect(need.textContent).toBe("Give the song a title to start.");
    expect(start.getAttribute("aria-describedby")).toBe(need.id);
    answer = () => ({});
  });
});

describe("the lesson's song card (2026-11-24 review, group lesson)", () => {
  test("a side lesson's framing goes inside the card, without the grid; with no card it shows on its own", async () => {
    const side = { heading: "Optional side lesson, about 15 minutes", text: "Nothing waits for it." };
    await render(
      <SongCard lessonId="U01.L02" song={TEST_SONG} side={side} orElse={<p data-testid="alone" />} />,
      { detail: testDetail([L01]) },
    );
    const card = container.querySelector('[data-testid="song-card"]');
    expect(card?.querySelector('[data-testid="side-lesson-note"]')?.textContent).toContain(side.heading);
    expect(card?.querySelector("[data-section]")).toBeNull();
    expect(container.querySelector('[data-testid="alone"]')).toBeNull();
    // A song not started has no card: the side lesson's own box shows instead.
    await render(
      <SongCard lessonId="U01.L02" song={TEST_SONG} side={side} orElse={<p data-testid="alone" />} />,
      { detail: testDetail([], { status: "new" }) },
    );
    expect(container.querySelector('[data-testid="song-card"]')).toBeNull();
    expect(container.querySelector('[data-testid="alone"]')).not.toBeNull();
  });
});
