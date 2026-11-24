// The Wave 1 platform proof, in headless Chromium against the REAL stack (root playwright.config.ts): the Oak
// server with a fresh data dir, the app on Vite, the production build served by the Oak server.
//   1. Every route of the app loads with zero console errors and no error state.
//   2. /dev/workbench plays a 4-track pattern from the self-hosted sound pack: audio comes out of the master
//      bus, no request leaves localhost, playhead + roll + staff light the same events, mute-by-label works.
//   3. The browser grader (module worker) grades the sample lesson's code-modify exercise: the solution
//      passes, the off-by-one variant fails with its feedback code.
//   4. The tutor status endpoint answers (a backend detected, or off) without any model call.
//   5. The production build is served by the Oak server and its Service Worker caches /sounds.
import { expect, type Page, test } from "@playwright/test";
import { shifted } from "./support/stack.ts";

// The platform stack's ports (root playwright.config.ts), moved by OAK_E2E_SHIFT like every stack.
const VITE_HOST = `127.0.0.1:${shifted(5173)}`;
const API_HEADERS = { "X-Oak": "1", Origin: `http://${VITE_HOST}` };
const PROD = `http://127.0.0.1:${shifted(8790)}`;

/** Console errors, uncaught exceptions, failed responses and any request that leaves this machine. */
function watch(page: Page): { problems: string[]; remote: string[] } {
  const problems: string[] = [];
  const remote: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (
      (u.protocol === "http:" || u.protocol === "https:") &&
      !["127.0.0.1", "localhost"].includes(u.hostname)
    )
      remote.push(r.url());
  });
  return { problems, remote };
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-state=loading]")).toHaveCount(0, { timeout: 20_000 });
}

test.describe("every route against the real server", () => {
  const ids = { sketch: "", transcription: "", track: "" };

  test.beforeAll(async ({ request }) => {
    const code = 'setcpm(90/4)\n\nmel: n("0 2 4 2").scale("C4:major").s("piano")';
    const sketch = await request.post("/api/sketches", {
      headers: API_HEADERS,
      data: {
        title: "E2E sketch",
        originKind: "free",
        originId: null,
        sessionId: null,
        code,
        bpm: 90,
        meter: "4/4",
        key: { tonic: "C", mode: "major" },
        analysis: null,
        note: null,
        tutorAssisted: false,
        band: null,
        flags: { lockedTools: [], previewTools: [] },
        ranOk: true,
      },
    });
    expect(sketch.status(), await sketch.text()).toBe(200);
    ids.sketch = (await sketch.json()).sketch.id;

    const tx = await request.post("/api/transcriptions", {
      headers: API_HEADERS,
      data: {
        sourceKind: "generated",
        audioId: null,
        songId: null,
        title: "Ladder piece",
        artist: null,
        ladderLevel: 1,
        templateId: null,
      },
    });
    expect(tx.status(), await tx.text()).toBe(200);
    ids.transcription = (await tx.json()).id;

    const track = await request.post("/api/album/tracks", {
      headers: API_HEADERS,
      data: {
        capstoneId: null,
        side: "Bside",
        title: "E2E track",
        flavour: null,
        sketchId: ids.sketch,
        sketchVersion: 1,
        linerNotesMd: "Four notes in C.",
        theoryTags: [],
        attribution: null,
      },
    });
    expect(track.status(), await track.text()).toBe(200);
    ids.track = (await track.json()).id;
  });

  const ROUTES: (string | ((x: typeof ids) => string))[] = [
    "/",
    "/onboarding/1",
    "/onboarding/4",
    "/learn/U00.L01",
    "/checkpoint/U01",
    "/capstone/C0",
    "/session/coda",
    "/studio",
    (x) => `/studio/${x.sketch}`,
    "/oak",
    "/oak?view=course",
    "/oak?view=leaves",
    "/practice",
    "/practice/fam.rhy.pulse",
    "/practice/review",
    "/transcribe",
    (x) => `/transcribe/${x.transcription}`,
    "/album",
    (x) => `/album/${x.track}`,
    "/toolbox",
    "/toolbox?cat=feature",
    "/toolbox/tb.scale",
    "/progress",
    "/settings/audio",
    "/settings/voice",
    "/settings/voice/setup",
    "/settings/tutor",
    "/settings/learning",
    "/settings/appearance",
    "/settings/keys",
    "/settings/data",
    "/settings/listening",
    "/settings/reports",
    "/settings/about",
    "/progress/sessions",
    "/dev/workbench",
  ];

  for (const [i, r] of ROUTES.entries()) {
    const label =
      typeof r === "string" ? r : r({ sketch: "<sketch>", transcription: "<tx>", track: "<track>" });
    test(`${String(i + 1).padStart(2, "0")} ${label} loads with no console error`, async ({ page }) => {
      const { problems, remote } = watch(page);
      await page.goto(typeof r === "string" ? r : r(ids));
      await settle(page);
      await expect(page.locator("#main, main").first()).not.toBeEmpty();
      await expect(page.locator("[data-state=error]")).toHaveCount(0);
      // Routes outside /dev carry the page title.
      if (!label.startsWith("/dev")) await expect(page.getByTestId("page-title")).not.toBeEmpty();
      expect(problems).toEqual([]);
      expect(remote).toEqual([]);
    });
  }
});

test("/dev/workbench plays the 4-track loop from the self-hosted pack; views stay in sync; mute by label", async ({
  page,
}) => {
  const { problems, remote } = watch(page);
  const sounds: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/sounds/")) sounds.push(r.url());
  });
  await page.goto("/dev/workbench");
  await page.getByTestId("wake-sound").click();
  const wb = page.locator("[data-testid=workbench]");
  await expect(wb).toHaveAttribute("data-analysis", "ready", { timeout: 60_000 });
  await expect(page.locator("[data-testid=staff-view]")).toHaveAttribute("data-status", "ready");
  for (const t of ["drums", "chords", "bass", "mel"])
    await expect(page.getByTestId(`mute-${t}`)).toBeVisible();

  const level = async (ms: number): Promise<number> => {
    let max = 0;
    for (let t = 0; t < ms; t += 100) {
      await page.waitForTimeout(100);
      const l = await page.evaluate(
        () =>
          (
            globalThis as { __oakStrudel?: { master: { level(): { rms: number } } } }
          ).__oakStrudel?.master.level().rms ?? -1,
      );
      max = Math.max(max, l);
    }
    return max;
  };

  await page.getByTestId("play-toggle").click();
  await expect(wb).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  expect(await level(2000)).toBeGreaterThan(0.01);

  // Playhead, roll and staff: the same events at the same moment, and the playhead moves.
  const samples: { head: number; roll: string[]; staff: string[] }[] = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(250);
    samples.push(
      await page.evaluate(() => {
        const ids = (s: string | null | undefined) => (s ? s.split(" ").filter(Boolean) : []);
        return {
          head: Number(document.querySelector("[data-testid=roll-canvas]")?.getAttribute("data-playhead")),
          roll: ids(document.querySelector("[data-testid=piano-roll]")?.getAttribute("data-active")),
          staff: ids(document.querySelector(".oak-staff-host")?.getAttribute("data-active-events")),
        };
      }),
    );
  }
  const heads = samples.map((s) => s.head).filter(Number.isFinite);
  expect(heads.length).toBeGreaterThanOrEqual(6);
  expect(new Set(heads).size).toBeGreaterThan(3);
  let melodyLit = 0;
  for (const s of samples) {
    expect(s.roll.length).toBeGreaterThan(0);
    for (const id of s.staff) expect(s.roll).toContain(id);
    const mel = s.roll.filter((id) => id.startsWith("mel|"));
    if (mel.length > 0 && mel.every((id) => s.staff.includes(id))) melodyLit++;
  }
  expect(melodyLit).toBeGreaterThanOrEqual(4);

  // Mute every label: silence; unmute: sound again. The code never changes.
  const before = await page.locator(".cm-content").first().textContent();
  for (const t of ["drums", "chords", "bass", "mel"]) {
    await page.getByTestId(`mute-${t}`).click();
    await expect(page.locator(`.oak-track-chip[data-track=${t}]`)).toHaveAttribute("data-state", "muted");
  }
  await page.waitForTimeout(1500); // let ringing voices decay
  expect(await level(1500)).toBeLessThan(0.002);
  await page.getByTestId("mute-drums").click();
  expect(await level(2000)).toBeGreaterThan(0.01);
  expect(await page.locator(".cm-content").first().textContent()).toBe(before);

  await page.getByTestId("play-toggle").click();
  await expect(wb).toHaveAttribute("data-playing", "0");
  // Every sample came from this machine's /sounds route; nothing left localhost.
  expect(sounds.length).toBeGreaterThan(0);
  for (const u of sounds) expect(new URL(u).host).toBe(VITE_HOST);
  expect(remote).toEqual([]);
  expect(problems).toEqual([]);
});

test("the browser grader grades the sample lesson's code-modify exercise", async ({ page }) => {
  const { problems } = watch(page);
  await page.goto("/");
  await settle(page);
  const results = await page.evaluate(async (repo: string) => {
    // Modules served by the app's Vite dev server: the sample lesson, the app's grader client and content.
    const load = (path: string) => import(/* @vite-ignore */ path);
    const lesson = (await load(`/@fs${repo}content/core/_sample/L00/lesson.ts`)).default;
    const { gradeInBrowser } = await load("/src/lib/grader-client.ts");
    const { loadContent } = await load("/src/lib/content.ts");
    const content = await loadContent();
    const step = lesson.steps.find((s: { id: string }) => s.id === "S5");
    const ex = step.exercise;
    const mel = (d: string) => `setcpm(90/4)\n\nmel: n("${d}").scale("C4:major").s("piano")`;
    const grade = (code: string) =>
      gradeInBrowser({
        exercise: ex,
        response: { code },
        ctx: {
          exerciseGlobalId: `${lesson.id}/${ex.id}`,
          mode: "lesson",
          key: lesson.key,
          meter: lesson.meter,
          bpm: lesson.bpm,
          params: {},
          attemptNo: 1,
          firstAttempt: true,
          rung: 0,
          tutorHints: 0,
          extraReplays: 0,
          lint: {
            profile: "graded",
            unlocked: new Set(content.toolbox.map((t: { id: string }) => t.id)),
            allowPreview: false,
            meter: lesson.meter,
            key: lesson.key,
          },
          profile: {
            rangeLow: 48,
            rangeHigh: 72,
            comfLow: 52,
            comfHigh: 67,
            tapLatencyMs: 0,
            tapJitterMs: 15,
            singLatencyMs: 0,
            singTolCents: 50,
            singTolMode: "auto",
            noiseFloorDb: -60,
            outputKind: "wired",
            inputKind: "builtin",
            quiet: false,
          },
        },
      });
    const pick = (r: { status: string; score: number; diagnostics: { id: string }[] }) => ({
      status: r.status,
      score: r.score,
      ids: r.diagnostics.map((d) => d.id),
    });
    return {
      kind: ex.kind as string,
      solution: pick(await grade(ex.reference.solutions[0])),
      offByOne: pick(await grade(mel("1 3 5 3"))),
      unchanged: pick(await grade(mel("0 1 2 3"))),
    };
  }, ROOT_DIR);
  expect(results.kind).toBe("code-modify");
  expect(results.solution.status).toBe("pass");
  expect(results.solution.score).toBe(1);
  expect(results.offByOne.status).toBe("fail");
  expect(results.offByOne.ids).toContain("melody.index-shift");
  expect(results.unchanged.status).toBe("fail");
  expect(results.unchanged.ids).toContain("code.unchanged");
  expect(problems).toEqual([]);
});

test("the tutor status endpoint answers without a model call", async ({ request }) => {
  const res = await request.get("/api/tutor/status", { headers: { "X-Oak": "1" } });
  expect(res.status()).toBe(200);
  const s = (await res.json()) as {
    tutor: string;
    active: string | null;
    backends: { id: string; ok: boolean }[];
    usage: { inputTokens: number; outputTokens: number; costUsd: number };
  };
  expect(["ready", "off", "unavailable", "missing_key", "degraded"]).toContain(s.tutor);
  expect(s.backends.map((b) => b.id).sort()).toEqual(["anthropic-api", "claude-cli"]);
  if (s.tutor === "ready") expect(s.backends.some((b) => b.ok && b.id === s.active)).toBe(true);
  // No turn ran: nothing was spent and no token was counted.
  expect(s.usage).toMatchObject({ inputTokens: 0, outputTokens: 0, costUsd: 0 });
  const health = await (await request.get("/api/health", { headers: { "X-Oak": "1" } })).json();
  expect(health.ok).toBe(true);
});

test("production: the Oak server serves the build and the Service Worker caches /sounds", async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: PROD });
  const page = await context.newPage();
  const { problems, remote } = watch(page);
  await page.goto("/");
  await settle(page);
  await expect(page.getByTestId("page-title")).toHaveText(/Today/);
  // The CSP of contracts §11.2 is on the HTML.
  const html = await context.request.get("/");
  expect(html.headers()["content-security-policy"]).toContain("default-src 'self'");
  // The first key wakes sound, which registers /sw.js?pack=<version> (production only).
  await page.keyboard.press("a");
  await expect
    .poll(
      () =>
        page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL ?? ""),
      {
        timeout: 30_000,
      },
    )
    .toMatch(/\/sw\.js\?pack=v\d+$/);
  // Reload so the page is controlled, fetch a pack file through the worker, and find it in the cache.
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const cached = await page.evaluate(async () => {
    const manifest = (await (await fetch("/sounds/manifest.json")).json()) as {
      packVersion: string;
      publicRoot: string;
    };
    const url = `${manifest.publicRoot.replace(/\/$/, "")}/piano.json`;
    const res = await fetch(url);
    const cache = await caches.open(`oak-sounds-${manifest.packVersion}`);
    return {
      ok: res.ok,
      names: await caches.keys(),
      hit: (await cache.match(url)) !== undefined,
      version: manifest.packVersion,
    };
  });
  expect(cached.ok).toBe(true);
  expect(cached.names).toContain(`oak-sounds-${cached.version}`);
  expect(cached.hit).toBe(true);
  expect(remote).toEqual([]);
  expect(problems).toEqual([]);
  await context.close();
});

const ROOT_DIR = new URL("..", import.meta.url).pathname;
