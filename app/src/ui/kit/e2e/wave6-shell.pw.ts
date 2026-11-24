// Wave 6 shell, rewritten in Wave 7 for tracks that have lessons: the advanced tracks in the rail, the palette and
// Settings › Learning (each a place: its next session opens from it; a lesson nobody wrote yet never opens), the
// shortcut sheet's rows and its honest locked lens keys (Wave 7: the track lenses open with their lesson), the eight
// track lenses in the palette with their state, the days after the core (nothing in the navigation reads as
// finished) and `G L` resuming this tab's own lesson (d21).
// Every test seeds its learner and blocks Vite's HMR socket. A Wave 6 seed point the server does not list yet is
// stood in for by the nearest point that exists with the Wave 6 fields laid over the API answer (as wave5-shell
// lays an unlock over `/api/unlocks`); the test's annotations say which it used.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../../e2e/support/stack.ts";
import { useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const HEADERS = { origin: stack.baseURL, "x-oak": "1" };
const FINISHED = /\b(finished|course complete|all done|nothing left|you're done|completed the course)\b/i;
const UNWRITTEN = "Open. Its first lessons are still being written.";

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

async function api<T>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  const res = await page.request.fetch(`${stack.apiURL}/api${path}`, {
    method,
    headers: { ...HEADERS, "content-type": "application/json" },
    ...(body === undefined ? {} : { data: JSON.stringify(body) }),
    timeout: 120_000,
  });
  expect(res.status(), `${method} ${path}: ${await res.text()}`).toBeLessThan(300);
  return (await res.json()) as T;
}

async function seed(page: Page, point: string) {
  await api(page, "PUT", "/dev/clock", { reset: true });
  await api(page, "POST", "/dev/seed", { point });
}

/**
 * Seeds the first of `wanted` the server can build, else `fallback`, and notes on the test which it was. A Wave 6
 * point answers 400 until the content it walks through is written (wave6.md §6): that is not this suite's failure.
 */
async function seedFirst(page: Page, wanted: readonly string[], fallback: string): Promise<string> {
  await api(page, "PUT", "/dev/clock", { reset: true });
  const why: string[] = [];
  for (const point of wanted) {
    const res = await page.request.fetch(`${stack.apiURL}/api/dev/seed`, {
      method: "POST",
      headers: { ...HEADERS, "content-type": "application/json" },
      data: JSON.stringify({ point }),
      timeout: 120_000,
    });
    if (res.status() < 300) {
      test.info().annotations.push({ type: "seed", description: point });
      return point;
    }
    expect(res.status(), `POST /dev/seed ${point}: ${await res.text()}`).toBe(400);
    why.push(((await res.json()) as { error?: { message?: string } }).error?.message ?? point);
  }
  test.info().annotations.push({
    type: "seed",
    description: `${fallback} with the Wave 6 fields laid over; ${why.join("; ")}`,
  });
  await seed(page, fallback);
  return fallback;
}

/** Lays fields over a JSON answer of the API for this page (the request still reaches the real server). */
async function overlay(page: Page, glob: string, patch: (body: Record<string, unknown>) => unknown) {
  await page.route(glob, async (route) => {
    try {
      const res = await route.fetch();
      const body = res.ok() ? ((await res.json()) as Record<string, unknown>) : {};
      await route.fulfill({ status: 200, contentType: "application/json", json: patch(body) });
    } catch {
      // A request a navigation aborted.
    }
  });
}

const trackState = (trackId: "J" | "R" | "A", title: string, note: string) => ({
  trackId,
  title,
  status: "open",
  openedAt: "2026-11-01T10:00:00.000Z",
  gates: [],
  sessionsDone: 0,
  sessionsTotal: trackId === "J" ? 34 : 20,
  next: null,
  note,
});
const OPEN_TRACKS = [
  trackState("J", "Jazz Harmony", UNWRITTEN),
  trackState("R", "Advanced Rhythm", UNWRITTEN),
  trackState("A", "Arrangement & Sound", "Its side lessons are open. The rest is still being written."),
];

async function openPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByRole("combobox", { name: /Search commands/ });
  await expect(input).toBeFocused();
  return input;
}

async function openSheet(page: Page) {
  await page.locator("#main").focus();
  await page.keyboard.press("?");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet).toBeVisible();
  return sheet;
}

test("the advanced tracks: locked before U13.CP, then open and still being written, never a way into an unwritten lesson", async ({
  page,
}) => {
  // Before the gate: the rail says nothing, the palette says what opens a track, the sheet marks the lens keys.
  await seed(page, "after U04.CP");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/settings/keys");
  const oak = page.locator('[data-nav="oak"]');
  await expect(oak).toHaveAttribute("aria-label", "The Oak");
  await expect(oak).not.toHaveAttribute("data-nav-tracks", "open");
  await page.waitForLoadState("networkidle");
  let input = await openPalette(page);
  await input.fill("Jazz Harmony");
  await expect(page.getByRole("option").first()).toContainText("Jazz Harmony");
  await expect(page.getByRole("option").first()).toContainText(
    "Advanced track · opens with the unit 13 checkpoint",
  );
  await page.keyboard.press("Escape");

  let sheet = await openSheet(page);
  const wb = sheet.locator('[data-sheet-section="workbench"]');
  const row = (k: string) => wb.locator(`[data-sheet-row="${k}"]`);
  await expect(row("Shift+I")).toHaveAttribute("data-locked", "true");
  await expect(row("Shift+I")).toContainText("Guide tones");
  await expect(row("Shift+I")).toContainText("Opens with unit 12, Seventh Chords.");
  await expect(row("Shift+V")).toContainText("Opens with unit 13, Rhythm II.");
  // The key ribbon's tool is the patterned .scale() of U03.L05: this learner has it.
  await expect(row("Shift+J")).not.toHaveAttribute("data-locked", "true");
  // The Wave 6 sections and rows are listed from any page.
  const record = sheet.locator('[data-sheet-section="keys-record"]');
  await expect(record.getByRole("heading", { name: "Key strip and the record" })).toBeVisible();
  for (const t of ["Key strip: the next key", "Record: play it through, or stop", "Record: next track"])
    await expect(record).toContainText(t);
  const rhythm = sheet.locator('[data-sheet-section="staff-rhythm"]');
  for (const t of ["Tie the note", "Dotted length", "Triplet values"]) await expect(rhythm).toContainText(t);
  await expect(sheet.locator('[data-sheet-section="harmony"]')).toContainText(
    "the target of an applied chord (V7/V)",
  );
  await expect(sheet.locator('[data-sheet-section="answers"]')).toContainText("Form map: cut a section");
  await row("Shift+I").scrollIntoViewIfNeeded();
  mkdirSync(SHOTS, { recursive: true });
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    await row("Shift+I").scrollIntoViewIfNeeded();
    // Two columns that scroll down, never a third column off to the side: every section starts inside the sheet.
    const layout = await sheet.getByTestId("shortcut-sheet-scroll").evaluate((el) => {
      const box = el.getBoundingClientRect();
      const lefts = [...el.querySelectorAll("section")].map((s) => s.getBoundingClientRect().left);
      return {
        sideways: el.scrollWidth - el.clientWidth,
        scrolledLeft: el.scrollLeft,
        outside: lefts.filter((l) => l < box.left - 1 || l > box.right).length,
        columns: new Set(lefts.map(Math.round)).size,
      };
    });
    expect(layout, `${m.theme} ${m.width}`).toEqual({ sideways: 0, scrolledLeft: 0, outside: 0, columns: 2 });
    await page.screenshot({ path: `${SHOTS}/w6-shortcuts-${m.theme}-${m.width}x${m.height}.png` });
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // After the U13 checkpoint: Jazz and Rhythm are open, and (Wave 7) their first lessons are written: the rail names
  // each track's next session; still never a lock and never a badge (a track is optional). Arrangement & Sound is
  // open too since U09.CP (its gate A.sound), so the rail names it with its next lesson (the side lessons first).
  const point = await seedFirst(page, ["tracks open (after U13.CP)"], "after U13.CP");
  expect(point).toMatch(/U13\.CP/);
  await page.goto("/settings/learning");
  await expect(oak).toHaveAttribute(
    "aria-label",
    /^The Oak: Jazz Harmony: next J1\.L\d\d; Advanced Rhythm: next R1\.L\d\d; Arrangement & Sound: next A1\.L\d\d$/,
  );
  await expect(oak).toHaveAttribute("data-nav-tracks", "open");
  await expect(oak).not.toHaveAttribute("data-nav-pending", "true");
  // The tooltip says the same on keyboard focus; both themes and sizes.
  await page.locator('[data-nav="today"]').focus();
  await page.keyboard.press("Tab");
  await expect(oak).toBeFocused();
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText("Jazz Harmony: next J1.L");
  // Wave 7: Settings › Learning shows the tracks as places, each with its state and the way into its next session.
  const cards = page.getByTestId("settings-tracks");
  await expect(cards.locator("[data-track-state]")).toHaveCount(3);
  await expect(cards.locator('[data-track-state="open"]').first()).toContainText("Jazz Harmony");
  await expect(cards.getByRole("link", { name: /^Start J1\.L\d\d$/ })).toBeVisible();
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    const box = await tip.boundingBox();
    expect(
      box && box.x + box.width,
      `${m.theme} ${m.width}: the tooltip stays on screen`,
    ).toBeLessThanOrEqual(m.width);
    await page.screenshot({
      path: `${SHOTS}/w7-rail-tracks-${m.theme}-${m.width}x${m.height}.png`,
      clip: { x: 0, y: 0, width: 760, height: 220 },
    });
  }
  await page.locator("#main").focus();
  await cards.scrollIntoViewIfNeeded();
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    const sideways = await page.locator("#main").evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(sideways, `${m.theme} ${m.width}: settings fit`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/w7-settings-tracks-${m.theme}-${m.width}x${m.height}.png` });
  }

  // The palette: the track is a place — its next lesson opens from it.
  await page.goto("/settings/keys");
  await page.waitForLoadState("networkidle");
  input = await openPalette(page);
  await input.fill("Jazz Harmony");
  const first = page.getByRole("option").first();
  await expect(first).toContainText("Jazz Harmony");
  await expect(first).toContainText(/Advanced track · open · next: J1\.L\d\d /);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/learn\/J1\.L\d\d$/);
  // A lesson nobody has written yet still says so and leads to the Oak, never to /learn (while one exists).
  await page.goto("/settings/keys");
  await page.waitForLoadState("networkidle");
  input = await openPalette(page);
  await input.fill("J5.L0");
  const unwritten = page.getByRole("option").filter({ hasText: "still being written" });
  if ((await unwritten.count()) > 0) {
    await expect(unwritten.first()).toContainText("Jazz Harmony · still being written");
    await unwritten.first().click();
    await expect(page).toHaveURL(/\/oak\?view=course$/);
  } else {
    test
      .info()
      .annotations.push({ type: "unwritten", description: "every J5 lesson is written in this tree" });
    await page.keyboard.press("Escape");
  }
  // Wave 7: every track lens is listed with its state; one not open yet says where it opens and leads to Settings.
  await page.goto("/settings/keys");
  await page.waitForLoadState("networkidle");
  input = await openPalette(page);
  await input.fill("clave lens");
  const clave = page.getByRole("option").filter({ hasText: "Clave lens" }).first();
  await expect(clave).toContainText("Opens with the lesson “Clave Direction”.");
  await input.fill("tensions lens");
  await expect(page.getByRole("option").filter({ hasText: "Tensions lens" }).first()).toContainText(
    "Opens with the lesson “Extensions”.",
  );
  await page.keyboard.press("Escape");

  // The lens keys this learner has now are no longer marked; the track lens keys say where they open.
  sheet = await openSheet(page);
  await expect(row("Shift+I")).not.toHaveAttribute("data-locked", "true");
  await expect(row("Shift+V")).not.toHaveAttribute("data-locked", "true");
  await expect(row("Shift+X")).toHaveAttribute("data-locked", "true");
  await expect(row("Shift+X")).toContainText("Opens with the lesson “Extensions”.");
  await expect(row("Shift+D")).toContainText("Opens with the lesson “Texture & Density”.");
});

test("after the core nothing in the navigation reads as finished, and what is open is one search away", async ({
  page,
}) => {
  const point = await seedFirst(page, ["core complete, tracks untouched", "core complete"], "X2 released");
  if (point === "X2 released") {
    await overlay(page, "**/api/lessons/progress", (b) => ({ ...b, core: "complete", tracks: OPEN_TRACKS }));
    await overlay(page, "**/api/course/completion", () => ({
      stage: "complete",
      completedAt: "2026-11-13T18:00:00.000Z",
      sessionsDone: 185,
      sessionsTotal: 185,
      remaining: [],
      milestone: null,
      stats: {
        firstDay: "2026-05-04",
        days: 150,
        sessions: 185,
        activeMinutes: 3600,
        lessons: 125,
        tracksReleased: 12,
        transcriptions: 9,
        sketches: 140,
      },
      canDo: [],
      album: { released: 12, total: 12, latestTrackId: null },
      open: [
        {
          kind: "review",
          id: null,
          title: "Reviews",
          note: "14 due. They keep the Oak green.",
          available: true,
        },
        {
          kind: "gym",
          id: null,
          title: "Transcription Gym",
          note: "Your own audio, a full arrangement at a time. Every fifth session, or any day from Today.",
          available: true,
        },
        {
          kind: "studio",
          id: null,
          title: "Studio",
          note: "Your sketchbook. Start the next song.",
          available: true,
        },
        { kind: "track", id: "J", title: "Jazz Harmony", note: UNWRITTEN, available: false },
        { kind: "track", id: "R", title: "Advanced Rhythm", note: UNWRITTEN, available: false },
      ],
    }));
  }
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await page.goto("/settings/keys");
  const nav = page.getByRole("navigation", { name: "Main" });
  // Every destination is still there, none locked, none worded as an ending; the Oak says what is open on it.
  await expect(nav.locator("[data-nav]")).toHaveCount(9);
  await expect(nav.locator('[data-nav="oak"]')).toHaveAttribute("data-nav-tracks", "open");
  const labels = await nav.locator("[data-nav]").evaluateAll((els) =>
    els.map((el) => ({
      id: (el as HTMLElement).dataset.nav,
      label: el.getAttribute("aria-label") ?? "",
      pending: (el as HTMLElement).dataset.navPending ?? null,
    })),
  );
  expect(labels.map((l) => l.id)).toEqual([
    "today",
    "oak",
    "practice",
    "studio",
    "transcribe",
    "album",
    "toolbox",
    "progress",
    "settings",
  ]);
  for (const l of labels) {
    expect(l.pending, l.id).toBeNull();
    expect(FINISHED.test(l.label), l.label).toBe(false);
  }
  // Wave 7: on the real "core complete" point the tracks have lessons and the Oak names each one's next session; the
  // stand-in (a Wave 6 overlay) keeps the "still being written" line.
  const real = point !== "X2 released";
  await expect(nav.locator('[data-nav="oak"]')).toHaveAttribute(
    "aria-label",
    real ? /Jazz Harmony: next J1\.L\d\d/ : /are open, their first lessons/,
  );

  // The palette lists what stays open; a track with nothing to start says so and leads to the Oak.
  await page.waitForLoadState("networkidle");
  let input = await openPalette(page);
  await input.fill("open to you");
  const options = page.getByRole("option");
  await expect(options.first()).toContainText("Open to you");
  const texts = await options.allTextContents();
  for (const t of texts) expect(FINISHED.test(t), t).toBe(false);
  expect(texts.some((t) => t.includes("Reviews") && t.includes("Open to you"))).toBe(true);
  expect(texts.some((t) => t.includes("Studio") && t.includes("Your sketchbook"))).toBe(true);
  await input.fill("Jazz Harmony");
  // The track is listed once, as open with nothing to start yet (Wave 7's "Focus on Jazz Harmony" is a command of
  // its own, not a second entry for the track).
  await expect(options.filter({ hasText: /^Jazz Harmony/ })).toHaveCount(1);
  await expect(options.filter({ hasText: /^Focus on Jazz Harmony/ })).toHaveCount(1);
  const track = options.filter({ hasText: /^Jazz Harmony/ }).first();
  if (real) await expect(track).toContainText(/Open to you · Next: J1\.L\d\d /);
  else
    await expect(track).toContainText(
      "Open, nothing to start yet · its first lessons are still being written.",
    );
  mkdirSync(SHOTS, { recursive: true });
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    await page.screenshot({ path: `${SHOTS}/w6-palette-after-core-${m.theme}-${m.width}x${m.height}.png` });
  }
  await track.click();
  await expect(page).toHaveURL(real ? /\/learn\/J1\.L\d\d$/ : /\/oak\?view=course$/);
  input = await openPalette(page);
  await input.fill("Reviews");
  await options.filter({ hasText: "Open to you" }).first().click();
  await expect(page).toHaveURL(/\/practice\/review$/);

  // G L with no lesson open goes to Today, and the sheet says so; nothing in the sheet reads as finished.
  await page.goto("/settings/keys");
  // The shell (and its keys) is up before the keys are pressed (d21's test waits for it too). G L then asks the
  // server for this tab's day and only navigates when it answers: beside other suites that answer took longer than
  // the URL check waited (the race of the Wave 6 run, and of the corrections gate's run). Wait for the answer.
  await expect(page.locator('[data-nav="today"]')).toBeVisible();
  await page.locator("#main").focus();
  const day = page.waitForResponse((r) => r.url().includes("/api/session/day"));
  await page.keyboard.press("g");
  await page.keyboard.press("l");
  await day;
  await expect(page).toHaveURL(/\/$/);
  const sheet = await openSheet(page);
  await expect(sheet).toContainText("Lesson (resume), or Today when none is open");
  expect(FINISHED.test((await sheet.textContent()) ?? "")).toBe(false);
});

test("G L resumes the lesson this tab left open, never another tab's (d21)", async ({ page }) => {
  await seed(page, "X2 released");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  // This tab's id (app/src/lib/tab-session.ts keeps it in sessionStorage; it survives the reloads below).
  const mine = "tab_00000000000000bb";
  await page.addInitScript((id) => sessionStorage.setItem("oak.tab", id), mine);
  await page.goto("/settings/keys");
  await expect(page.locator('[data-nav="today"]')).toBeVisible();
  const session = (tabId: string) => ({
    id: `ses_${tabId}`,
    day: "2026-11-14",
    kind: "lesson",
    targetMinutes: 20,
    mapItemId: "U12.L01",
    contentVersion: null,
    startedAt: "2026-11-14T09:00:00.000Z",
    endedAt: null,
    activeMinutes: 3,
    phase: "main",
    tabId,
  });
  // The day as a Wave 6 server answers it: another tab has a lesson open, this tab has none.
  let sessions = [session("tab_00000000000000aa")];
  let asked = "";
  await overlay(page, "**/api/session/day*", (b) => ({
    ...b,
    open: sessions.find((s) => s.tabId === mine) ?? null,
    openSessions: sessions,
  }));
  page.on("request", (r) => {
    if (r.url().includes("/api/session/day")) asked = r.url();
  });
  await page.locator("#main").focus();
  await page.keyboard.press("g");
  await page.keyboard.press("l");
  await expect(page).toHaveURL(/\/$/);
  // The shell asked for this tab's day.
  expect(asked).toContain(`tab=${mine}`);

  // The same tab with its own lesson open: G L goes back into it.
  sessions = [session("tab_00000000000000aa"), session(mine)];
  await page.goto("/settings/keys");
  await page.locator("#main").focus();
  await page.keyboard.press("g");
  await page.keyboard.press("l");
  await expect(page).toHaveURL(/\/learn\/U12\.L01$/);
});
