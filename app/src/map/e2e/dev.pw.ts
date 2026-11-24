// The tools that used to be dev pages, against the real server: Progress › Your sessions (/progress/sessions)
// over step rows posted through the API and the seeded session telemetry, Settings › Grading reports
// (/settings/reports) over reports posted through the API (replay, copy as test case, triage), Settings ›
// Listening pass (/settings/listening: every curated sound and example, verdicts saved on the server), and the
// dev-only /dev/kit with the Wave 4 and Wave 5 pieces. Screenshots in both themes.
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const API = { "X-Oak": "1", Origin: stack.baseURL };

const iso = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
const step = (
  lessonId: string,
  stepId: string,
  stepKind: string,
  authored: number,
  activeMin: number,
  over = {},
) => ({
  sessionId: "e2e-1",
  lessonId,
  lessonVersion: 1,
  stepId,
  stepKind,
  targetMinutes: 20,
  authoredMinutes: authored,
  scaledMinutes: authored * 1.4,
  startedAt: iso(60),
  endedAt: iso(50),
  activeMs: activeMin * 60_000,
  attempts: 1,
  maxHintRung: 0,
  tutorMessages: 0,
  passed: true,
  skipped: false,
  testedOut: false,
  splitPart: null,
  ...over,
});

const grade = (status: "pass" | "fail", score: number) => ({
  exerciseId: "U01.L01/busy-hats",
  exerciseVersion: 1,
  attemptNo: 2,
  firstAttempt: false,
  mode: "lesson",
  status,
  score,
  adjustedScore: score,
  dims: {},
  constraints: [],
  diagnostics: [{ id: "rhythm.missing-onset", severity: "error", params: {} }],
  messages: [{ id: "rhythm.missing-onset", text: "The hats miss beat 3 of bar 2." }],
  assist: { rung: 0, tutorHints: 0, extraReplays: 0, revealed: false },
});

test.beforeAll(async ({ request }) => {
  // Once per server: a retried worker reruns this hook against the same data.
  const existing = (await (await request.get("/api/qa/reports", { headers: API })).json()) as {
    items: unknown[];
  };
  if (existing.items.length > 0) return;
  const steps = [
    step("U01.L01", "S1", "listen", 1, 1.2),
    step("U01.L01", "S2", "tap", 2, 3.1, { attempts: 3, maxHintRung: 1 }),
    step("U01.L01", "S5", "modify", 3, 9.5, { attempts: 4, maxHintRung: 2, tutorMessages: 2 }),
    step("U01.L02", "S1", "listen", 1, 1.1, { endedAt: iso(30) }),
    step("U01.L02", "S2", "predict", 1, 1.3, { endedAt: iso(29) }),
  ];
  const t = await request.post("/api/telemetry/steps", { headers: API, data: { steps } });
  expect(t.ok(), await t.text()).toBe(true);
  const base = {
    lessonId: "U01.L01",
    stepId: "S5",
    exerciseVersion: 1,
    familyId: null,
    trialSeed: null,
    params: null,
    hintRung: 0,
    attemptId: null,
  };
  const reports = [
    {
      ...base,
      kind: "lesson-step",
      exerciseId: "busy-hats",
      response: { code: 'setcpm(96/4)\n\ndrums: s("bd sd bd sd")\nhats: s("hh*8")' },
      gradeResult: grade("fail", 0.4),
      note: "My hats are on every eighth and it still says beat 3 is missing.",
    },
    {
      ...base,
      kind: "lesson-step",
      stepId: "S2",
      exerciseId: "find-the-beat",
      response: { taps: [0, 0.625, 1.25, 1.875] },
      gradeResult: grade("pass", 0.9),
      note: null,
    },
  ];
  for (const r of reports) {
    const res = await request.post("/api/qa/reports", { headers: API, data: r });
    expect(res.ok(), await res.text()).toBe(true);
  }
});

test("your sessions: lessons against the plan, steps, warm-up, forecast, sessions", async ({ page }) => {
  await useUiPrefs(page, { theme: "paper" });
  // Reached from Progress.
  await page.goto("/progress");
  await page.getByTestId("progress-sessions-link").click();
  await expect(page).toHaveURL(/\/progress\/sessions$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your sessions" })).toBeVisible({
    timeout: 30_000,
  });
  const lessons = page.getByTestId("lesson-timings");
  // U01.L01: 6 authored → 8.4 budget; 13.8 min actual → over 1.15×.
  const l1 = lessons.locator('tr[data-lesson="U01.L01"]');
  await expect(l1).toHaveAttribute("data-over", "true");
  await expect(l1).toContainText("over 1.15×");
  await expect(lessons.locator('tr[data-lesson="U01.L02"]')).not.toHaveAttribute("data-over", "true");
  // Keyboard: open the step breakdown.
  await l1.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(l1.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  await expect(lessons.locator('tr[data-step="S5"]')).toContainText("9.5 min");
  await expect(page.getByRole("img", { name: /Warm-up minutes per day/ })).toBeVisible();
  await expect(page.getByTestId("session-timings").locator("tbody tr")).toHaveCount(6);
  await expect(page.getByText("A typical session")).toBeVisible();
  await expect(page.getByText(/The middle of 6 sessions; you planned 20 min/)).toBeVisible();
});

test("grading reports: replay, copy as test case, triage", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/settings/reports");
  await expect(page.getByRole("heading", { level: 2, name: "Grading reports" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("navigation", { name: "Settings" }).getByRole("link", { name: "Grading reports" }),
  ).toHaveAttribute("aria-current", "page");
  const cards = page.locator("[data-report]");
  await expect(cards).toHaveCount(2);
  const hats = cards.filter({ hasText: "busy-hats" });
  await expect(hats).toContainText("rhythm.missing-onset");
  await expect(hats).toContainText("The hats miss beat 3 of bar 2.");
  // Replay plays the reported code in a read-only workbench.
  await hats.getByRole("button", { name: "Replay" }).click();
  await expect(hats.locator(".cm-editor")).toBeVisible({ timeout: 30_000 });
  await expect(hats.getByRole("button", { name: "Close replay" })).toBeVisible();
  // Copy as test case: a reported fail becomes a test expecting a pass.
  await hats.getByRole("button", { name: "Copy as test case" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('"expect": "pass"');
  expect(clip).toContain('"code": "setcpm(96/4)');
  // Taps have a test form; the tap report expects a fail (it was graded a pass).
  const taps = cards.filter({ hasText: "find-the-beat" });
  await expect(taps.getByRole("button", { name: "Replay" })).toHaveCount(0);
  await taps.getByText(/Test case \(expects fail\)/).click();
  await expect(taps).toContainText('"taps"');
  // Triage from the keyboard: the report leaves the open queue.
  await taps.getByRole("combobox").selectOption("triaged");
  await expect(cards).toHaveCount(1);
  await page.getByRole("radio", { name: /Triaged \(1\)/ }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("find-the-beat");
});

test("listening pass: every curated sound and example, verdicts on the server", async ({ page }) => {
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/settings/listening");
  await expect(page.getByRole("heading", { level: 2, name: "Listening pass" })).toBeVisible({
    timeout: 30_000,
  });
  const list = page.getByTestId("listen-list");
  for (const s of ["rhodes", "upright", "ebass", "tenor", "piano", "bd", "hh", "gm_piano", "sawtooth"])
    await expect(list.locator(`[data-ref="sound:${s}"]`)).toHaveCount(1);
  // Keyboard: Tab to a play button, Enter plays it in the workbench.
  await list.getByRole("button", { name: "Play sound:rhodes" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 3, name: "sound:rhodes" })).toBeVisible();
  await expect(page.locator(".cm-editor")).toBeVisible({ timeout: 30_000 });
  const keep = page.getByRole("group", { name: "Verdict" }).getByRole("button", { name: "Keep" });
  const store = await page.request.get("/api/listen", { headers: API });
  if (store.status() === 501) {
    // The server's verdict endpoint is not built yet: the page says so and offers no dead buttons.
    await expect(page.getByText("Verdicts cannot be saved right now")).toBeVisible();
    await expect(keep).toBeDisabled();
  } else {
    await page.getByLabel("Note for the verdict").fill("Warm, sits well under a melody.");
    await keep.click();
    await expect(list.locator('[data-ref="sound:rhodes"]')).toHaveAttribute("data-status", "ok");
    await page.reload();
    await expect(page.getByTestId("listen-list").locator('[data-ref="sound:rhodes"]')).toHaveAttribute(
      "data-status",
      "ok",
    );
  }
  // Lesson examples are listed per unit.
  await page.getByRole("combobox", { name: "List" }).selectOption("U01");
  await expect(list.locator('[data-ref^="U01.L01"]').first()).toBeVisible();
});

for (const m of SCREENSHOT_MATRIX) {
  test(`sessions, grading reports and listening pass screenshots in ${m.theme} at ${m.width}x${m.height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme });
    for (const [path, name, heading, level] of [
      ["/progress/sessions", "your-sessions", "Your sessions", 1],
      ["/settings/reports", "grading-reports", "Grading reports", 2],
      ["/settings/listening", "listening-pass", "Listening pass", 2],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level, name: heading })).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(0);
      await shoot(page, SHOTS, name, m.theme);
    }
  });
}

test("the UI kit gallery shows the Wave 4 and Wave 5 pieces under the Wave 3 sections, in both themes", async ({
  page,
}) => {
  await page.routeWebSocket(/.*/, () => {});
  for (const theme of ["paper", "bark"] as const) {
    await useUiPrefs(page, { theme });
    await page.goto("/dev/kit");
    await expect(page.getByRole("heading", { level: 1, name: "UI kit", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const w4 = page.getByTestId("kit-wave4");
    await expect(w4).toBeVisible();
    // One h1 on the page: the Wave 4 gallery nests under it.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(w4.getByRole("heading", { level: 2, name: "UI kit · Wave 4" })).toBeVisible();
    await w4.scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "dev-kit-wave4", theme);
    // Wave 5: the scope, the section strip, the twelve-bar chart and the probe controls nest after Wave 4.
    const w5 = page.getByTestId("kit-wave5");
    await expect(w5).toBeVisible();
    await expect(w5.getByRole("heading", { level: 2, name: "UI kit · Wave 5" })).toBeVisible();
    await w5.scrollIntoViewIfNeeded();
    const overflow5 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow5).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "dev-kit-wave5", theme);
  }
});
