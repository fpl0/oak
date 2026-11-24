// The session area against the real server (ports 5205/8805, fake tutor): a fresh learner, Today, a whole session
// (New → Wrap up → Quick sketch → Coda → Done for today), Today done, then the server clock moved forward for the
// return states (3+ and 10+ days away, 21+ with the sing-tolerance offer) and the weekly streak (a met week, a
// banked rest, an open tie, a new phrase). Screenshots in both themes at 1440×900 and 1280×800.
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import {
  addDays,
  api,
  daysBetween,
  expectNoOverflow,
  mondayOf,
  SHOTS,
  serverNow,
  settle,
  travel,
} from "./support.ts";

test.describe.configure({ mode: "serial" });
// Other engineers' edits make Vite reload the page mid-test (an HMR update reloaded a running session).
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

let day0 = "";

async function today(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("today-card")).toBeVisible();
  await expect(page.getByTestId("today-card")).not.toHaveAttribute("data-state", "");
}

async function matrix(page: Page, name: string, open: (page: Page) => Promise<void>) {
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme });
    // Other areas edit shared files while this runs; Vite may reload the page once. Try a second time.
    for (let attempt = 0; ; attempt++) {
      try {
        await open(page);
        await settle(page);
        await expectNoOverflow(page);
        await shoot(page, SHOTS, name, m.theme);
        break;
      } catch (e) {
        if (attempt > 0 || !String(e).includes("Execution context was destroyed")) throw e;
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test("a fresh learner sees one action: begin onboarding", async ({ page, request }) => {
  travel(0);
  day0 = (await serverNow(request)).day;
  await today(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "first-run");
  await expect(page.getByRole("heading", { name: "Welcome to Oak" })).toBeVisible();
  await expect(page.getByTestId("begin-onboarding")).toHaveAttribute("href", /\/onboarding\//);
  await expect(page.getByTestId("start-session")).toHaveCount(0);
  await settle(page);
  await shoot(page, SHOTS, "today-first-run", "paper");
  // Left half-way (at the microphone): Today says where they are and carries on there, never "Begin" again.
  await api(request, "PUT", "/api/onboarding", {
    step: "mic",
    completed: ["welcome", "loop", "edit", "react", "prefs", "tutor", "headphones"],
  });
  await today(page);
  await expect(page.getByRole("heading", { name: "Carry on setting up" })).toBeVisible();
  await expect(page.getByTestId("today-card")).toContainText(/Step 8 of 13: Microphone\./);
  const carryOn = page.getByTestId("begin-onboarding");
  await expect(carryOn).toHaveText("Continue");
  await expect(carryOn).toHaveAttribute("href", /\/onboarding\/mic$/);
  await settle(page);
  await shoot(page, SHOTS, "today-onboarding-half-way", "paper");
});

test("after onboarding: the setlist for U01.L01, keyboard first, every glance card", async ({
  page,
  request,
}) => {
  await api(request, "PUT", "/api/profile", { onboardedAt: new Date().toISOString() });
  // The U00 lessons are another author's work in progress: mark them done so the plan reaches the exemplar.
  await api(request, "POST", "/__e2e/complete-lessons", { ids: ["U00.L01", "U00.L02"] });
  const plan = await api<{ mapItemId: string; kind: string }>(request, "GET", "/api/session/today");
  expect(plan).toMatchObject({ kind: "lesson", mapItemId: "U01.L01" });

  await today(page);
  const card = page.getByTestId("today-card");
  await expect(card).toHaveAttribute("data-state", "normal");
  await expect(page.getByRole("heading", { name: "Your setlist for today" })).toBeVisible();
  await expect(page.getByTestId("setlist").locator("[data-row]")).toHaveCount(3); // nothing due: New, Make, Coda
  await expect(page.getByTestId("setlist")).toContainText("Heartbeat");
  await expect(page.getByTestId("setlist")).toContainText("Coda · 1 min");
  await expect(page.getByTestId("goal-line")).toBeVisible();
  await expect(page.getByTestId("weekly-rhythm").locator("li")).toHaveCount(7);
  await expect(page.getByTestId("next-unlock")).toBeVisible();
  await expect(page.getByTestId("oak-glance")).toBeVisible();
  await expect(page.getByTestId("album-strip")).toBeVisible();
  await expect(page.getByTestId("last-sketch")).toContainText("Your sketchbook fills up");
  // No banned patterns: no red, no countdown, no loss framing.
  await expect(page.locator("main")).not.toContainText(/you'll lose|missed|left to|hours left/i);
  await matrix(page, "today-normal", today);
});

test("a whole session: Start (Enter) → New → Wrap up → Quick sketch → Coda → Done for today", async ({
  page,
}) => {
  await useUiPrefs(page, { theme: "paper" });
  await today(page);
  // Today's Enter starts the plan once it is loaded (TodayPage's hotkey does nothing before): the setlist is the
  // plan on screen. Without this wait a fast page took the Enter while the plan was still in flight.
  await expect(page.getByTestId("setlist").locator("[data-row]").first()).toBeVisible();
  // Keyboard only: Enter starts the session from Today.
  await page.locator("main").focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/(session|learn\/U01\.L01)/);

  // The lesson runs in the player mounted here or on its own route; either way the session keeps time.
  if (page.url().includes("/learn/")) {
    await page.evaluate(() =>
      (window as never as { __oakSession: { runner: { wrapUp(): void } } }).__oakSession.runner.wrapUp(),
    );
  } else {
    // The first open of the session page compiles the session, lesson and drill modules in the dev server.
    await expect(page.getByTestId("session-header")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("session-block")).toContainText("New");
    // The lesson player, mounted inside the session (lesson's own surface), once it has loaded.
    await expect(page.locator(".skeleton"))
      .toHaveCount(0, { timeout: 20_000 })
      .catch(() => {});
    await settle(page);
    await expectNoOverflow(page);
    await shoot(page, SHOTS, "session-new", "paper");
    // Pause and resume at the step.
    await page.getByTestId("pause").click();
    await expect(page.getByTestId("paused")).toBeVisible();
    await expect(page.getByTestId("resume")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("paused")).toHaveCount(0);
    // One "Wrap up": the session's own, or the mounted lesson player's.
    await expect(page.getByTestId("wrap-up")).toHaveCount(1);
    await page.getByTestId("wrap-up").click();
  }
  await page.waitForURL(/\/session\/?$/);
  await expect(page.getByTestId("session-block")).toContainText("Quick sketch");
  // The lesson player saves its own quick sketch when it is mounted; otherwise the session's does.
  const lessonQuick = page.getByTestId("quick-sketch");
  const sessionQuick = page.getByTestId("sketch-block-quick");
  await expect(lessonQuick.or(sessionQuick)).toBeVisible({ timeout: 20_000 });
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "session-quick-sketch", "paper");
  const ownSketch = await sessionQuick.isVisible();

  // Saving is never blocked: "Save sketch anyway" before a Run.
  await page.getByTestId(ownSketch ? "save-sketch" : "save-quick").click();
  await page.waitForURL(/\/session\/coda$/);
  await expect(page.getByTestId("coda-title")).toHaveText("A good place to stop.");
  await expect(page.getByTestId("coda-sketch")).toContainText(/quick sketch/i);
  await expect(page.getByTestId("coda-week")).toBeVisible();
  // Claude's listening note is gone (owner, 2026-11-22): the Coda neither asks for one nor offers it.
  await expect(page.getByTestId("coda-listen")).toHaveCount(0);
  await expect(page.getByTestId("done-for-today")).toBeFocused();

  // A reload keeps the Coda (the summary is saved in this browser); with reduced motion it appears at once.
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme, motion: "on" });
    await page.reload();
    await expect(page.getByTestId("coda-title")).toHaveText("A good place to stop.");
    const longest = await page.evaluate(() =>
      Math.max(
        0,
        ...[...document.querySelectorAll("*")].map((el) => {
          const d = getComputedStyle(el).animationDuration.split(",")[0] ?? "0s";
          return d.endsWith("ms") ? Number.parseFloat(d) : Number.parseFloat(d) * 1000;
        }),
      ),
    );
    expect(longest).toBeLessThanOrEqual(120);
    await settle(page);
    await expectNoOverflow(page);
    await shoot(page, SHOTS, "coda", m.theme);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await useUiPrefs(page, { theme: "paper", motion: "system" });
  await page.reload();
  await expect(page.getByTestId("done-for-today")).toBeFocused();

  // Enter: Done for today → Today says so, with no Start button.
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done");
  await expect(page.getByRole("heading", { name: "Session complete. See you tomorrow." })).toBeVisible();
  await expect(page.getByTestId("today-done")).toContainText("Next time: Heartbeat");
  await expect(page.getByTestId("start-session")).toHaveCount(0);
  await matrix(page, "today-done", today);
});

test("progress: the course by unit, the ledger, honest time, the rhythm", async ({ page }) => {
  await matrix(page, "progress", async (p) => {
    await p.goto("/progress");
    await expect(p.getByTestId("progress-course")).toBeVisible();
    await expect(p.getByTestId("progress-time")).toBeVisible();
    await expect(p.getByTestId("progress-rhythm")).toBeVisible();
  });
  await expect(page.getByTestId("progress-course")).toContainText("U00");
  await expect(page.getByTestId("progress-course")).toContainText("2 of 2 lessons");
});

test("3+ days away: welcome back, a recap row; no gap counts", async ({ page, request }) => {
  // The first day counts (a session with a sketch that ran, or reviews).
  await api(request, "POST", "/__e2e/qualify", { day: day0, kind: "review" });
  travel(4);
  await today(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "welcome-back");
  await expect(page.getByRole("heading", { name: "Welcome back. We'll ease in." })).toBeVisible();
  await expect(page.getByTestId("setlist").locator('[data-row="recap"]')).toContainText("30 s");
  await expect(page.locator("main")).not.toContainText(/\b\d+ days? (away|ago|off)\b/i);
  await settle(page);
  await shoot(page, SHOTS, "today-welcome-back", "paper");
});

test("10+ days away: a light session — recap card, then the last lesson's Make with one new idea", async ({
  page,
}) => {
  travel(12);
  await useUiPrefs(page, { theme: "paper" });
  await today(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "light");
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText("New idea:");
  await settle(page);
  await shoot(page, SHOTS, "today-light", "paper");
  await page.getByTestId("start-session").click();
  await page.waitForURL(/\/session\/?$/);
  await expect(page.getByTestId("recap-card")).toBeVisible();
  await expect(page.getByTestId("recap-continue")).toBeFocused();
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "session-recap", "paper");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("sketch-block-light")).toBeVisible();
  await expect(page.getByText("Today's new idea")).toBeVisible();
  await matrix(page, "session-light", async (p) => {
    await p.goto("/session");
    await expect(p.getByTestId("sketch-block-light")).toBeVisible();
  });
  // Leave for now: Today offers to resume the open session.
  // The focus header's "Today" (the session is a focus route; time counts only on session routes).
  await page.getByRole("banner").getByRole("link", { name: "Today" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "in-session");
  await expect(page.getByTestId("start-session")).toHaveText(/Resume session/);
  await page.getByTestId("start-session").click();
  await page.waitForURL(/\/session\/?$/);
  // "Resume session" picks the clock up again: no pause screen in the way.
  await expect(page.getByTestId("sketch-block-light")).toBeVisible();
  await expect(page.getByTestId("paused")).toHaveCount(0);
  await page.getByTestId("save-sketch").click();
  await page.waitForURL(/\/session\/coda$/);
  await page.getByTestId("done-for-today").click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done");
});

test("21+ days away: one tap to loosen the sing tolerance, never by itself", async ({ page, request }) => {
  await api(request, "PUT", "/api/profile", { singToleranceCents: 35 });
  await api(request, "POST", "/__e2e/qualify", { day: addDays(day0, 12), kind: "review" });
  travel(12 + 23);
  await today(page);
  await expect(page.getByText("Ease into singing again?")).toBeVisible();
  await page.getByRole("button", { name: "Check singing at ±50¢" }).click();
  await expect
    .poll(
      async () =>
        (await api<{ singToleranceCents: number }>(request, "GET", "/api/profile")).singToleranceCents,
    )
    .toBe(50);
});

test("the weekly streak: a met week, a banked rest, an open tie, then a new phrase", async ({
  page,
  request,
}) => {
  // A clean week well after the return tests: Monday M.
  const now = (await serverNow(request)).day;
  const M = addDays(mondayOf(now), 7);
  const offsetTo = (d: string) => daysBetween(day0, d);
  // The first, partial week (this file's first days) may already have earned a rest, depending on the weekday the
  // run starts: what week 1 must show is one more than that (the bank holds at most two).
  const bankBefore = (await api<{ summary: { bankedRests: number } }>(request, "GET", "/api/streak")).summary
    .bankedRests;
  const bankAfter = Math.min(2, bankBefore + 1);
  // Week 1: five practice days → met (goal 5), one rest banked.
  for (let i = 0; i < 5; i++) {
    travel(offsetTo(addDays(M, i)));
    await api(request, "POST", "/__e2e/qualify", { day: addDays(M, i), kind: "review" });
  }
  travel(offsetTo(addDays(M, 7)));
  await today(page);
  await expect(page.getByTestId("streak-chip")).toHaveText("1 week in a row");
  await expect(page.locator("main header")).toContainText(
    `${bankAfter} ${bankAfter === 1 ? "rest" : "rests"} banked`,
  );
  await settle(page);
  await shoot(page, SHOTS, "today-streak-met", "paper");

  // Week 2: two days only. On Monday of week 3 the tie is open (the bank covers one day, not three).
  for (let i = 7; i < 9; i++) {
    travel(offsetTo(addDays(M, i)));
    await api(request, "POST", "/__e2e/qualify", { day: addDays(M, i), kind: "review" });
  }
  travel(offsetTo(addDays(M, 14)));
  await today(page);
  await expect(page.getByText("An open tie on last week")).toBeVisible();
  await expect(
    page.getByText(/days? short\. Practise before Wednesday 04:00 and it's tied over\./),
  ).toBeVisible();
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "today-repair", "paper");
  await useUiPrefs(page, { theme: "bark" });
  await today(page);
  await settle(page);
  await shoot(page, SHOTS, "today-repair", "bark");

  // Thursday of week 3, nothing done: the tie lapsed. Neutral copy, no red.
  travel(offsetTo(addDays(M, 17)));
  await today(page);
  await expect(page.getByTestId("streak-chip")).toHaveText("A new phrase begins. Longest run: 1 week.");
  await expect(page.getByText("An open tie on last week")).toHaveCount(0);
  const chipColor = await page.getByTestId("streak-chip").evaluate((el) => getComputedStyle(el).color);
  expect(chipColor).not.toMatch(/rgb\(2[0-5]\d, [0-6]\d, [0-6]\d\)/);
  await settle(page);
  await shoot(page, SHOTS, "today-new-phrase", "bark");
  travel(0);
});
