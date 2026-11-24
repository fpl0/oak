// The capstone and the album against the real server (seeded through U02.CP, fake tutor): C0 from the empty album
// to a released track with a recorded, non-silent performance; a failing rubric item shows its bar anchor; a
// reload mid-capstone resumes the draft; Claude's review offers its liner note; C1's start grants ebass and
// .lpf(); screenshots of every surface in both themes at both sizes.
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { capstones } from "../../../../content/capstones.ts";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { seedTake } from "./seeded-take.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const C0 = capstones.find((c) => c.id === "C0");
const piece = (name: string) => {
  const t = C0?.brief?.tests.find((x) => x.name === name);
  if (!t || !("code" in t.response)) throw new Error(name);
  return t.response.code;
};
const NO_BACKBEAT = piece("no backbeat");
const REFERENCE = piece("four bars, tom fill in bar 4");
const EDITOR = "oak_capstone-C0_0_";

test.describe.configure({ mode: "serial" });

// Other engineers edit the shared working tree while this suite runs; Vite's HMR would hot-swap or reload
// their modules under a running test. The app opens no WebSocket of its own, so every socket (Vite's HMR) is
// answered here and never reaches the dev server.
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

/** Strudel's repl logs one console.error per failed learner evaluation (interfaces "Known gaps" 6). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // Vite's first start on this port re-optimizes dependencies and answers 504 to the old chunks once.
    // Until the server builds `capstones.release` it answers a typed 501, and the release falls back (engine.ts).
    if (/\[eval\]|evaluation error|Outdated Optimize Dep|status of 501 \(Not Implemented\)/.test(t)) return;
    errors.push(t);
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

async function setCode(page: Page, code: string, editor = EDITOR) {
  await page.waitForFunction(
    (id) =>
      !!(globalThis as { __oakStrudel?: { editors: Map<string, unknown> } }).__oakStrudel?.editors.get(id),
    editor,
  );
  await page.evaluate(
    ([id, c]) => {
      const o = (
        globalThis as unknown as { __oakStrudel: { editors: Map<string, { setCode(c: string): void }> } }
      ).__oakStrudel;
      o.editors.get(id as string)?.setCode(c as string);
    },
    [editor, code],
  );
}

async function api<T>(page: Page, path: string, init: RequestInit = {}): Promise<T> {
  return page.evaluate(
    async ([p, i]) => {
      const res = await fetch(`/api${p}`, {
        ...(i as RequestInit),
        headers: { "X-Oak": "1", "Content-Type": "application/json" },
      });
      return res.json();
    },
    [path, init] as const,
  );
}

const rule = (page: Page, id: string) => page.locator(`[data-rule="${id}"]`);

test("the empty album makes the first track worth earning", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/album");
  const empty = page.getByTestId("album-empty");
  await expect(empty.getByRole("heading", { name: "Side A, track 1 is waiting" })).toBeVisible();
  await expect(empty.getByRole("link", { name: "Start C0 Intro" })).toBeVisible();
  // Side A lists the core capstones as empty slots; C1 is open too (seeded through U02.CP), C2 is locked.
  await expect(page.locator('[data-slot="C0"]')).toContainText("Open now");
  await expect(page.locator('[data-slot="C2"]')).toContainText(/checkpoint/i);
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme });
    await page.reload();
    await expect(page.getByTestId("album-empty")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "album-empty", m.theme);
  }
  expect(errors).toEqual([]);
});

test("C0 starts; a failing rule shows its bar anchor; a reload resumes the draft", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/album");
  await page.getByRole("link", { name: "Start C0 Intro" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "C0 Intro" })).toBeVisible({ timeout: 60_000 });
  await shoot(page, SHOTS, "capstone-start", "paper");
  await page.getByRole("button", { name: "Start session 1 of 1" }).click();
  await expect(page.getByTestId("capstone-workspace")).toBeVisible({ timeout: 60_000 });

  // The starter: one bar, no fill. The checklist is live: bars and the fill are open, the rest met.
  await expect(rule(page, "meter")).toHaveAttribute("data-state", "open", { timeout: 30_000 });
  await expect(rule(page, "meter").getByTestId("bar-anchor")).toHaveText("Bars 2–4");
  await expect(rule(page, "fill")).toHaveAttribute("data-state", "open");
  await expect(rule(page, "snare-backbeat")).toHaveAttribute("data-state", "met");

  // No backbeat: the snare rule opens, anchored to bars 1–3 where the brief asks for it.
  await setCode(page, NO_BACKBEAT);
  await expect(rule(page, "snare-backbeat")).toHaveAttribute("data-state", "open", { timeout: 30_000 });
  await expect(rule(page, "snare-backbeat").getByTestId("bar-anchor")).toHaveText("Bars 1–3");
  await expect(rule(page, "snare-backbeat")).toContainText("the hits are not where this asks yet");
  await expect(page.getByTestId("req-count")).toHaveText("5 of 6 met");
  await expect(page.getByTestId("release")).toBeDisabled();

  // Check my track from the keyboard: the check is recorded on the server against a saved version.
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+Shift+Enter");
  await expect(page.getByRole("status").filter({ hasText: "5 of 6 requirements met" })).toBeVisible({
    timeout: 30_000,
  });
  const state = await api<{ sketchId: string | null; lastResult: { status: string } | null; status: string }>(
    page,
    "/capstones/C0",
  );
  expect(state.status).toBe("in_progress");
  expect(state.sketchId).not.toBeNull();
  expect(state.lastResult?.status).toBe("fail");

  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme });
    await page.reload();
    await expect(rule(page, "snare-backbeat")).toHaveAttribute("data-state", "open", { timeout: 30_000 });
    // At 1280×800 the primary actions are visible without scrolling.
    await expect(page.getByTestId("check-track")).toBeInViewport();
    await expect(page.getByTestId("release")).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "capstone-open-rule", m.theme);
  }

  // The reload resumed the draft: the code is the saved version, not the starter.
  await expect(page.locator(".cm-content")).toContainText('s("bd bd bd bd")');
  await expect(page.getByTestId("saved-state")).toContainText(/Version \d+ saved/);
  expect(errors).toEqual([]);
});

test("C0 from the reference solution: check, review, record, release, album", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.goto("/capstone/C0");
  await expect(page.getByTestId("capstone-workspace")).toBeVisible();
  // The draft the test before saved is loaded first (it would replace code typed before it arrives).
  await expect(page.getByTestId("saved-state")).toContainText(/Version \d+ saved/);
  await setCode(page, REFERENCE);
  await expect(page.getByTestId("req-count")).toHaveText("6 of 6 met", { timeout: 30_000 });
  await page.getByTestId("check-track").click();
  await expect(page.getByRole("status").filter({ hasText: "every requirement is met" })).toBeVisible({
    timeout: 30_000,
  });

  // Claude's review through the fake tutor (the panel streams the queued ask; here the turn is sent directly).
  await expect(page.getByTestId("request-review")).toBeEnabled();
  const done = await page.evaluate(async () => {
    const res = await fetch("/api/tutor/reviews/capstone", {
      method: "POST",
      headers: { "X-Oak": "1", "Content-Type": "application/json" },
      body: JSON.stringify({
        thread: { subjectKind: "capstone", subjectId: "C0" },
        kind: "review-capstone",
        userText: "Please review my draft.",
      }),
    });
    return (await res.text()).includes("event: done");
  });
  expect(done).toBe(true);
  await page.reload();
  await expect(page.getByTestId("review-summary")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("req-count")).toHaveText("6 of 6 met", { timeout: 30_000 });

  // Release: keyboard through the dialog, a real recording through the @oak/strudel recorder.
  await page.getByTestId("release").click();
  const dialog = page.getByRole("dialog", { name: "Release to the album" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByLabel("Title")).toHaveValue("Intro");
  await dialog.getByLabel(/One line for the liner notes/).fill("Straight time, then the toms take bar 4.");
  await expect(dialog.getByRole("switch", { name: "Include Claude's liner note" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await shoot(page, SHOTS, "release-dialog", "paper");
  await dialog.getByTestId("record-take").focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByTestId("take-audio")).toBeVisible({ timeout: 40_000 });
  await dialog.getByTestId("confirm-release").click();

  const ceremony = page.getByTestId("release-ceremony");
  await expect(ceremony).toBeVisible({ timeout: 30_000 });
  await expect(ceremony.getByRole("heading", { name: "Intro" })).toBeVisible();
  await expect(ceremony.locator("svg[data-cover-rings]")).toHaveAttribute("data-cover-rings", "4");
  await shoot(page, SHOTS, "release-ceremony", "paper");

  // The upload: a real, non-silent recording of the piece.
  const state = await api<{ status: string; trackId: string }>(page, "/capstones/C0");
  expect(state.status).toBe("released");
  const audio = await page.evaluate(async (trackId) => {
    const res = await fetch(`/api/album/tracks/${trackId}/versions/1/audio`);
    const bytes = await res.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 44_100, 44_100);
    const buf = await ctx.decodeAudioData(bytes.slice(0));
    const data = buf.getChannelData(0);
    let sum = 0;
    let peak = 0;
    for (const x of data) {
      sum += x * x;
      peak = Math.max(peak, Math.abs(x));
    }
    return {
      type: res.headers.get("content-type"),
      bytes: bytes.byteLength,
      seconds: buf.duration,
      rms: Math.sqrt(sum / data.length),
      peak,
    };
  }, state.trackId);
  expect(audio.bytes).toBeGreaterThan(4000);
  expect(audio.seconds).toBeGreaterThan(9);
  expect(audio.rms).toBeGreaterThan(0.003);
  expect(audio.peak).toBeGreaterThan(0.05);

  // The album: the track with its cover and liner notes.
  await ceremony.getByRole("link", { name: "See the album" }).click();
  await expect(page).toHaveURL(/\/album$/);
  const row = page.locator(`[data-track="${state.trackId}"]`);
  await expect(row.getByRole("link", { name: "Intro" })).toBeVisible();
  await expect(row.locator("svg[data-cover-rings]")).toHaveAttribute("data-cover-rings", "4");
  await row.getByRole("button", { name: "Liner notes" }).click();
  const notes = row.getByTestId("liner-notes");
  await expect(notes).toContainText("Straight time, then the toms take bar 4.");
  await expect(notes).toContainText("4 bars of 4/4 at 100 BPM");
  await expect(notes).toContainText("Theory used:");
  await expect(page.getByTestId("album-meta")).toContainText("1 track");
  await expect(row.getByRole("button", { name: "Play Intro" })).toBeEnabled();

  // The track page.
  await row.getByRole("link", { name: "Intro" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Intro" })).toBeVisible();
  await expect(page.getByTestId("track-audio")).toBeVisible();
  await expect(page.getByTestId("liner-notes").first()).toContainText("4 bars of 4/4 at 100 BPM");
  await expect(page.getByRole("link", { name: "Revise and release version 2" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("album and track page in both themes at both sizes", async ({ page }) => {
  const errors = watchErrors(page);
  const state = await (async () => {
    await page.goto("/album");
    return api<{ trackId: string }>(page, "/capstones/C0");
  })();
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme });
    await page.goto("/album");
    await expect(page.locator(`[data-track="${state.trackId}"] svg[data-cover-rings="4"]`)).toBeVisible({
      timeout: 30_000,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "album", m.theme);
    await page.goto(`/album/${state.trackId}`);
    await expect(page.getByTestId("track-audio")).toBeVisible();
    await expect(page.locator('main svg[data-cover-rings="4"]').first()).toBeVisible({ timeout: 30_000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "track", m.theme);
    await page.goto("/capstone/C0");
    await expect(page.getByText("On the album")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("req-count")).toHaveText("6 of 6 met", { timeout: 30_000 });
    await expect(page.getByText("No music yet.")).toHaveCount(0, { timeout: 30_000 });
    await shoot(page, SHOTS, "capstone-revising", m.theme);
  }
  expect(errors).toEqual([]);
});

test("reduced motion: the ceremony cover does not animate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/album");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  const anim = await page.evaluate(() => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "oak-cover-draw");
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "oak-cover-ring");
    svg.appendChild(g);
    document.body.appendChild(svg);
    const name = getComputedStyle(g).animationName;
    svg.remove();
    return name;
  });
  expect(anim).toBe("none");
});

test("C1: starting the first session grants ebass and .lpf()", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/capstone/C1");
  await expect(page.getByRole("heading", { level: 1, name: "C1 First Loop" })).toBeVisible();
  // A session per tab (d21, which reverses decision 28): another tab's open session never blocks this one, so the
  // Start button stays. This tab's own open session does: the page says so and sends the learner to Today instead
  // of a Start button the server would answer with that session. Ending it frees the tab.
  const start = (tabId?: string) =>
    api<{ id: string }>(page, "/session/start", {
      method: "POST",
      body: JSON.stringify({
        kind: "studio",
        mapItemId: null,
        targetMinutes: 20,
        ...(tabId ? { tabId } : {}),
      }),
    });
  const end = (id: string) =>
    api(page, `/session/${id}/end`, {
      method: "POST",
      body: JSON.stringify({ wrappedEarly: true, phaseMs: { warmup: 0, main: 0, make: 0, coda: 0 } }),
    });
  const other = await start();
  await page.reload();
  await expect(page.getByRole("button", { name: /Start session/ })).toBeVisible();
  await expect(page.getByTestId("capstone-session-open")).toHaveCount(0);
  const tab = await page.evaluate(() => sessionStorage.getItem("oak.tab"));
  if (!tab) throw new Error("the app has not named this tab");
  const own = await start(tab);
  await page.reload();
  await expect(page.getByTestId("capstone-session-open")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Today" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start session/ })).toHaveCount(0);
  await shoot(page, SHOTS, "w3-capstone-session-open", "paper");
  await end(own.id);
  await end(other.id);
  await page.reload();
  await expect(page.getByTestId("capstone-session-open")).toHaveCount(0);
  await expect(page.getByText("Starting this session unlocks")).toBeVisible();
  const ids = async () =>
    (await api<{ items: { itemId: string }[] }>(page, "/unlocks")).items.map((u) => u.itemId);
  const before = await ids();
  expect(before).not.toContain("snd.ebass");
  expect(before).not.toContain("tb.lpf");
  await page.getByRole("radiogroup", { name: "Style" }).getByRole("radio", { name: "Jazz-soul" }).click();
  await page.getByRole("button", { name: "Start session 1 of 1" }).click();
  await expect(page.getByTestId("capstone-workspace")).toBeVisible();
  const after = await ids();
  expect(after).toContain("snd.ebass");
  expect(after).toContain("tb.lpf");
  // The starter uses ebass and .lpf(): with them unlocked it lints and checks (only the length is open).
  await expect(rule(page, "bars")).toHaveAttribute("data-state", "open", { timeout: 30_000 });
  await expect(rule(page, "bass-range")).toHaveAttribute("data-state", "met");
  await expect(page.getByText("Jazz-soul")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a revision releases version 2; the track page compares versions A/B and plays the code live", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.goto("/capstone/C0");
  await expect(page.getByText("On the album")).toBeVisible({ timeout: 30_000 });
  await setCode(page, piece("eight bars, sixteenth hats, crash and fill"));
  await expect(page.getByTestId("req-count")).toHaveText("6 of 6 met", { timeout: 30_000 });
  await expect(page.getByText("The full 8 bars the brief allows.")).toBeVisible();
  await page.getByTestId("release").click();
  const dialog = page.getByRole("dialog", { name: "Release a new version" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByLabel("Title")).toHaveValue("Intro");
  // A seeded take (seeded-take.ts): the recorder's own window, uploaded through the release path.
  await seedTake(page);
  await dialog.getByTestId("record-take").click();
  await expect(dialog.getByTestId("take-audio")).toBeVisible({ timeout: 30_000 });
  await dialog.getByTestId("confirm-release").click();
  const ceremony = page.getByTestId("release-ceremony");
  await expect(ceremony.getByText("Version 2 is on the album.")).toBeVisible({ timeout: 30_000 });
  await expect(ceremony.locator("svg[data-cover-rings]")).toHaveAttribute("data-cover-rings", "8");
  await ceremony.getByRole("link", { name: "Open the track" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Intro" })).toBeVisible();
  const versions = page
    .getByRole("region", { name: "Versions" })
    .or(page.locator("section[aria-labelledby=trk-versions]"));
  await expect(versions.getByRole("link", { name: /Version 2/ })).toContainText(/lines? changed/);
  await expect(versions.getByRole("link", { name: /Version 1/ })).toContainText("First release");
  const compare = page.getByRole("group", { name: "Compare two versions" });
  await expect(compare.getByRole("button", { name: "A · v2" })).toHaveAttribute("aria-pressed", "true");
  await compare.getByRole("button", { name: "B · v1" }).click();
  await expect(compare.getByRole("button", { name: "B · v1" })).toHaveAttribute("aria-pressed", "true");
  await compare.getByRole("button", { name: "A · v2" }).focus();
  await page.keyboard.press("a");
  await expect(compare.getByRole("button", { name: "A · v2" })).toHaveAttribute("aria-pressed", "true");

  // Version 1 keeps its own cover (4 rings) next to version 2's (8).
  await versions.getByRole("link", { name: /Version 1/ }).click();
  await expect(page).toHaveURL(/v=1/);
  await expect(page.locator('main svg[data-cover-rings="4"]').first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Play it live" }).click();
  await expect(page.locator(".cm-content").first()).toContainText("setcpm(100/4)", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Record another take" })).toBeVisible();
  expect(errors).toEqual([]);
});
