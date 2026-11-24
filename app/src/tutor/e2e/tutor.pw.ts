// The tutor panel against the scripted fake backend (OAK_TUTOR_FAKE=1; docs/design/wave2.md §5): streaming with
// the thinking line, Stop, errors and retry, every quick action (the hint ladder, Explain my mistake, Reveal, a
// listening note, a capstone review), code cards (Preview-only rules, Preview audio by RMS, Apply to new sketch),
// music-token chips, context chips that really change what is sent, the off and closed states, Settings › Tutor,
// keyboard-only use, reduced motion, and screenshots in both themes at both reference sizes.
//
// The surfaces that set subjects (lesson, Studio, capstone) are other engineers' and are built in parallel, so
// the spec stands in for them through `window.__oakTutor` (app/src/tutor/dev-hook.ts, dev server only).
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { PREFS_KEY, shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const API = stack.apiURL;
const HEADERS = { "X-Oak": "1", "Content-Type": "application/json", Origin: stack.baseURL };

type Subject = Record<string, unknown>;

const LESSON: Subject = {
  thread: { subjectKind: "lesson", subjectId: "U01.L01" },
  title: "U01.L01 · Heartbeat",
  tutorOpen: true,
  lessonId: "U01.L01",
  stepId: "S6",
  graded: true,
  passed: false,
  code: 'setcpm(96/4)\n\ndrums: s("bd bd bd bd")',
  rung: 0,
  lastResult: {
    exerciseId: "U01.L01/S6",
    exerciseVersion: 1,
    attemptNo: 1,
    firstAttempt: true,
    mode: "lesson",
    status: "fail",
    score: 0.5,
    adjustedScore: 0.5,
    dims: { rhythm: { score: 0.5, weight: 1 } },
    constraints: [],
    diagnostics: [
      { id: "rhythm.missing", severity: "error", params: {}, where: { track: "drums", bar: 2, beat: 3 } },
    ],
    messages: [],
    assist: { rung: 0, tutorHints: 0, extraReplays: 0, revealed: false },
  },
};

async function openApp(page: Page, theme: "paper" | "bark" = "paper", motion?: "on" | "off") {
  await useUiPrefs(page, { theme, ...(motion ? { motion } : {}) });
  await page.addInitScript((key) => {
    const cur = JSON.parse(localStorage.getItem(key) || "{}");
    if (cur.tutorOpen === undefined) localStorage.setItem(key, JSON.stringify({ ...cur, tutorOpen: true }));
  }, PREFS_KEY);
  await page.goto("/settings/about");
  await page.waitForFunction(() => "__oakTutor" in window);
  await expect(page.getByTestId("tutor-status")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
}

const setSubject = (page: Page, s: Subject) =>
  page.evaluate(
    (subj) =>
      (window as unknown as { __oakTutor: { setSubject(x: unknown): void } }).__oakTutor.setSubject(subj),
    s,
  );

const panel = (page: Page) => page.getByTestId("tutor-chat");
const lastMessage = (page: Page) => panel(page).getByTestId("tutor-message").last();

async function send(page: Page, text: string) {
  const box = panel(page).getByTestId("composer");
  await box.fill(text);
  await box.press("Enter");
}

async function waitDone(page: Page) {
  await expect(lastMessage(page)).toHaveAttribute("data-status", /done|error/, { timeout: 30_000 });
}

async function setBackend(page: Page, backend: "auto" | "off") {
  const res = await page.request.put(`${API}/api/settings/tutor`, {
    headers: HEADERS,
    data: { value: { backend, softMonthlyUsd: 25, softWarnedMonth: null } },
  });
  expect(res.ok()).toBe(true);
}

test.describe.configure({ mode: "serial" });

// Other engineers edit the shared tree while this suite runs: Vite's HMR socket must not reload the page mid-test.
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

test("chat streams with a thinking line, then lands in the merged timeline", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openApp(page);
  await expect(panel(page).getByTestId("tutor-empty")).toBeVisible();
  await send(page, "What does n do?");
  const msg = lastMessage(page);
  await expect(msg.getByTestId("thinking")).toBeVisible();
  await expect(msg.getByTestId("turn-phase")).toBeVisible();
  await waitDone(page);
  await expect(msg).toContainText("n counts from zero");
  // The degree token is a chip, not raw markup.
  await expect(msg.locator('[data-token="deg"]').first()).toHaveText("1");
  await expect(msg).not.toContainText("[[deg");
  // Reload: the turn comes back from the server's timeline under "Today".
  await page.reload();
  await expect(panel(page).getByTestId("day-divider").filter({ hasText: "Today" })).toBeVisible();
  await expect(lastMessage(page)).toContainText("n counts from zero");
  expect(errors).toEqual([]);
});

test("Esc stops a slow answer and keeps its text; Send again works", async ({ page }) => {
  await openApp(page);
  await send(page, "Tell me slowly #slow");
  const msg = lastMessage(page);
  await expect(msg).toContainText("word 3", { timeout: 10_000 });
  await panel(page).getByTestId("composer").press("Escape");
  await expect(msg).toHaveAttribute("data-status", "error");
  await expect(msg.getByTestId("turn-error")).toHaveAttribute("data-kind", "aborted");
  await expect(msg).toContainText("Slowly 1");
  await expect(msg.getByRole("button", { name: "Send again" })).toBeVisible();
  // The panel is still usable.
  await send(page, "And now quickly");
  await waitDone(page);
  await expect(lastMessage(page)).toHaveAttribute("data-status", "done");
});

test("errors: a rate limit cools down, overload offers Retry, auth points to Settings", async ({ page }) => {
  // The page's clock runs as usual; it is only moved past the overload cool-down at the end (no audio plays here).
  await page.clock.install();
  await openApp(page);
  await send(page, "Hello #error");
  await waitDone(page);
  await expect(lastMessage(page).getByTestId("turn-error")).toHaveAttribute("data-kind", "rate_limit");
  await expect(lastMessage(page)).toContainText(/Cooling down — 0:(1|2)\d/);

  await send(page, "Hello #error:auth");
  await waitDone(page);
  await expect(lastMessage(page).getByRole("link", { name: "Open Settings › Tutor" })).toBeVisible();

  await send(page, "#empty");
  await waitDone(page);
  await expect(lastMessage(page)).toContainText("Claude had nothing to add");

  // Last, because the clock jump below puts the page's time ahead of the server's for the turns after it.
  await send(page, "Hello #error:overloaded");
  await waitDone(page);
  const busy = lastMessage(page);
  await expect(busy.getByTestId("turn-error")).toHaveAttribute("data-kind", "overloaded");
  await expect(busy).toContainText("Claude was interrupted (overloaded)");
  // The server asked for a pause (retryAfterSec): the cool-down runs out, then Retry sends the turn again.
  await expect(busy).toContainText("Cooling down");
  // The cool-down is the panel's own timer (Date.now and a 1-s setTimeout): jump the page's clock past the
  // server's 20-s pause instead of waiting it out, then Retry must be there.
  await page.clock.fastForward(25_000);
  await expect(busy.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 45_000 });
  await busy.getByRole("button", { name: "Retry" }).click();
  await waitDone(page);
  await expect(lastMessage(page).getByTestId("turn-error")).toHaveAttribute("data-kind", "overloaded");

  // HEAD sent the auth and empty turns after the retried one: the panel still sends after a retry. Counted, not read
  // from the last message, because the page's clock is now ahead of the server's turn times.
  const empties = panel(page).getByText("Claude had nothing to add");
  const before = await empties.count();
  await send(page, "#empty");
  await waitDone(page);
  await expect(empties).toHaveCount(before + 1);
});

/**
 * The lesson player starts a lesson by opening it; a fresh profile has U01.L01 locked behind U00, whose content is
 * another author's work in progress. The spec opens it the way the player's first step would leave it.
 */
function openLesson(id: string, step: string) {
  execFileSync("sqlite3", [
    `${stack.dataDir}/oak.db`,
    `INSERT OR REPLACE INTO lesson_progress (lesson_id, status, current_step, updated_at) VALUES ('${id}', 'in_progress', '${step}', '2026-11-11T09:00:00.000Z')`,
  ]);
}

test("hint ladder, Explain my mistake and Reveal on a graded lesson step", async ({ page }) => {
  openLesson("U01.L01", "S6");
  await openApp(page);
  await setSubject(page, LESSON);
  const chips = panel(page).getByTestId("context-chips");
  await expect(chips).toContainText("U01.L01 · S6");
  await expect(chips).toContainText("Hints 0/4");
  const actions = panel(page).getByTestId("quick-actions");
  await expect(actions).toContainText("opens hint 1 of 4 on this step.");
  await actions.getByRole("button", { name: "Hint 1 of 4" }).click();
  await waitDone(page);
  await expect(lastMessage(page)).toContainText("Which beat feels empty");
  // The server advanced the rung; the chips and the next action say so.
  await expect(chips).toContainText("Hints 1/4");
  await actions.getByRole("button", { name: "Hint 2 of 4" }).click();
  await waitDone(page);
  await expect(lastMessage(page).locator('[data-token="bars"]')).toHaveText("bar 2");
  await expect(chips).toContainText("Hints 2/4");
  // Explain my mistake counts as a hint.
  await expect(actions).toContainText("Either one opens hint 3 of 4 on this step.");
  await actions.getByRole("button", { name: "Explain my mistake" }).click();
  await waitDone(page);
  await expect(lastMessage(page)).toContainText("bracket");
  await expect(chips).toContainText("Hints 3/4");
  await expect(actions.getByRole("button", { name: "Hint 3 again" })).toBeVisible();

  // Asking for the answer: one sentence and the Reveal (hint 4) button, which records hint 4 through steps.hint.
  await send(page, "Just tell me the answer #reveal");
  await waitDone(page);
  // Before two checks the server keeps hint 4 shut, and the panel says why.
  await lastMessage(page).getByTestId("reveal").click();
  await page.getByRole("button", { name: "Reveal the answer" }).click();
  await expect(lastMessage(page).getByTestId("reveal-problem")).toContainText("checked this step twice");
  // Two checks later (the lesson player records them), the reveal goes through.
  execFileSync("sqlite3", [
    `${stack.dataDir}/oak.db`,
    "UPDATE step_state SET attempts = 2 WHERE lesson_id = 'U01.L01' AND step_id = 'S6'",
  ]);
  await lastMessage(page).getByTestId("reveal").click();
  await page.getByRole("button", { name: "Reveal the answer" }).click();
  await expect(lastMessage(page)).toContainText("Hint 4 is open in the lesson");
  const state = await page.request.get(`${API}/api/lessons/U01.L01/steps/S6`, { headers: HEADERS });
  expect((await state.json()).rung).toBe(4);
});

test("context chips: switching one off really leaves it out of the request", async ({ page }) => {
  await openApp(page);
  await setSubject(page, {
    ...LESSON,
    thread: { subjectKind: "lesson", subjectId: "U02.L01" },
    lessonId: "U02.L01",
    stepId: "S1",
    graded: false,
  });
  const bodies: string[] = [];
  page.on(
    "request",
    (r) => r.url().includes("/api/tutor/") && r.method() === "POST" && bodies.push(r.postData() ?? ""),
  );
  await panel(page).locator('[data-chip="code"]').click();
  await expect(panel(page).locator('[data-chip="code"]')).toHaveAttribute("aria-pressed", "false");
  await expect(panel(page).locator('[data-chip="step"]')).not.toHaveAttribute("aria-pressed");
  await send(page, "Why four beats?");
  await waitDone(page);
  const body = JSON.parse(bodies.at(-1) ?? "{}");
  expect(body.learnerCode).toBeUndefined();
  expect(body.graderResult).toBeDefined();
  expect(body.stepId).toBe("S1");
});

test("cards: Preview-only on a graded step, Preview plays (RMS), applicable in General", async ({ page }) => {
  await openApp(page);
  await setSubject(page, { ...LESSON, thread: { subjectKind: "lesson", subjectId: "U01.L01" } });
  // Tool activity shows while Claude works, in fixed words: nothing the tool saw.
  await send(page, "Check my progress #tool #slow");
  await expect(lastMessage(page).getByTestId("tool-activity")).toContainText("Looked at your progress");
  await expect(lastMessage(page).getByTestId("tool-activity")).not.toContainText(/score|rung|progress:/);
  await panel(page).getByTestId("composer").press("Escape");
  await expect(lastMessage(page).getByTestId("tool-activity")).toBeVisible();
  await send(page, "Show me an idea #card");
  await waitDone(page);
  const msg = lastMessage(page);
  const card = msg.getByTestId("code-card");
  await expect(card).toHaveAttribute("data-apply", "preview_only");
  await expect(card.getByTestId("preview-only")).toContainText("Try it yourself first, or take hint 4.");
  await expect(card.getByRole("button", { name: /Copy|Apply/ })).toHaveCount(0);
  expect(await card.getByTestId("card-code").evaluate((el) => getComputedStyle(el).userSelect)).toBe("none");
  await card.getByRole("button", { name: "Diff" }).click();
  await expect(card.locator("ins").first()).toBeVisible();
  await card.getByRole("button", { name: "Code" }).click();

  await card.getByRole("button", { name: /^Preview / }).click();
  await expect(card.getByRole("button", { name: /^Stop preview/ })).toBeVisible({ timeout: 30_000 });
  let max = 0;
  for (let i = 0; i < 20; i++) {
    max = Math.max(
      max,
      await page.evaluate(
        () =>
          (
            globalThis as { __oakStrudel?: { master: { level(): { rms: number } } } }
          ).__oakStrudel?.master.level().rms ?? -1,
      ),
    );
    await page.waitForTimeout(100);
  }
  expect(max).toBeGreaterThan(0.01);
  await card.getByRole("button", { name: /^Stop preview/ }).click();
  await expect(card.getByRole("button", { name: /^Preview / })).toBeVisible();

  // In the General thread the same card is applicable: Copy and Apply to new sketch, which opens Studio.
  await panel(page).locator('[data-thread="general"]').click();
  await send(page, "An idea for my sketchbook #card");
  await waitDone(page);
  const free = lastMessage(page).getByTestId("code-card");
  await expect(free).toHaveAttribute("data-apply", "applicable");
  await expect(free.getByRole("button", { name: "Copy" })).toBeVisible();
  await free.getByRole("button", { name: "Apply to new sketch" }).click();
  await expect(page).toHaveURL(/\/studio\/[^/]+$/, { timeout: 15_000 });
});

test("music tokens: every kind renders as a chip with a definition; bars loop in the Workbench", async ({
  page,
}) => {
  await openApp(page);
  await send(page, "Walk me through it #long");
  await waitDone(page);
  const msg = lastMessage(page);
  for (const kind of ["deg", "rn", "note", "chord", "bars", "tool", "term"])
    await expect(msg.locator(`[data-token="${kind}"]`).first()).toBeVisible();
  // Wave 4: numerals before U06.L02 (a fresh learner) wear the preview badge.
  await expect(msg.locator('[data-token="rn"]').nth(2)).toHaveText("V7preview");
  await expect(msg.locator('[data-token="note"]')).toHaveText("E4");
  // A term beyond the learner's vocabulary carries the preview badge; hover shows its definition.
  const term = msg.locator('[data-token="term"]');
  await expect(term).toContainText("preview");
  await term.hover();
  await expect(page.getByRole("tooltip")).toContainText("cadence");
  // A locked tool links to the Toolbox and says so.
  await expect(msg.locator('[data-token="tool"]').first()).toHaveAttribute("href", "/toolbox/tb.scale");
  // Bars dispatch the Workbench event when no surface hosts them.
  const got = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        window.addEventListener("oak:tutor-bars", (e) => resolve((e as CustomEvent).detail), { once: true });
        (document.querySelector('[data-testid="tutor-chat"] [data-token="bars"]') as HTMLElement).click();
      }),
  );
  expect(got).toEqual({ from: 1, to: 2 });
  // The learner's own words render as text, never as HTML.
  await send(page, '<img src=x onerror="window.__pwned=1"> **hi**');
  await waitDone(page);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  await expect(panel(page).getByText('<img src=x onerror="window.__pwned=1"> **hi**')).toBeVisible();
});

test("no listening note on a sketch; a capstone review rendered from the schema", async ({ page }) => {
  await openApp(page);
  // A sketch and a saved C0 draft, as Studio and the capstone workspace would make them.
  const sk = await page.request.post(`${API}/api/sketches`, {
    headers: HEADERS,
    data: {
      title: "Four on the floor",
      originKind: "capstone",
      originId: "C0",
      sessionId: null,
      code: 'setcpm(96/4)\n\ndrums: s("bd*4, ~ sd ~ sd, hh*8")',
      bpm: 96,
      meter: "4/4",
      key: null,
      analysis: null,
      note: null,
      tutorAssisted: false,
      band: null,
      flags: { lockedTools: [], previewTools: [] },
      ranOk: true,
    },
  });
  expect(sk.ok(), await sk.text()).toBe(true);
  const sketch = (await sk.json()).sketch;
  // C0 opens after the U01 checkpoint, which a fresh profile has not passed: the spec puts the draft in place the
  // way the capstone workspace's first check would (capstone_state.sketch_id is what the review reads).
  execFileSync("sqlite3", [
    `${stack.dataDir}/oak.db`,
    `INSERT OR REPLACE INTO capstone_state (capstone_id, status, sketch_id, started_at, updated_at) VALUES ('C0', 'in_progress', '${sketch.id}', '2026-11-11T09:00:00.000Z', '2026-11-11T09:00:00.000Z')`,
  ]);

  await setSubject(page, {
    thread: { subjectKind: "sketch", subjectId: sketch.id },
    title: "Four on the floor",
    tutorOpen: true,
    sketchId: sketch.id,
    code: 'setcpm(96/4)\n\ndrums: s("bd*4, ~ sd ~ sd, hh*8")',
  });
  // The panel offers no Listening note on a sketch (owner, 2026-11-22).
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Listening note" })).toHaveCount(0);

  await setSubject(page, {
    thread: { subjectKind: "capstone", subjectId: "C0" },
    title: "C0 · First groove",
    tutorOpen: true,
    capstoneId: "C0",
    code: 'setcpm(96/4)\n\ndrums: s("bd*4, ~ sd ~ sd, hh*8")',
  });
  await panel(page).getByTestId("quick-actions").getByRole("button", { name: "Request review" }).click();
  await waitDone(page);
  const review = lastMessage(page).getByTestId("review");
  await expect(review).toContainText("Claude's comments never affect pass or fail.");
  const strengths = review.getByTestId("review-strengths").getByRole("listitem");
  expect(await strengths.count()).toBeGreaterThanOrEqual(2);
  await expect(strengths.first().locator('[data-token="bars"]')).toBeVisible();
  await expect(review.getByTestId("review-revisions").getByRole("listitem")).toHaveCount(1);
  await expect(review.getByTestId("review-revisions").getByTestId("code-card")).toHaveAttribute(
    "data-apply",
    "preview_only",
  );
  await expect(review.getByTestId("review-question")).toContainText("?");
  await expect(review.getByTestId("review-liner")).not.toBeEmpty();
  // "Mark done" on a revision (ux §6.5): a toggle, kept in this browser.
  const done = review.getByTestId("review-mark-done");
  await expect(done).toHaveText("Mark done");
  await done.click();
  await expect(done).toHaveAttribute("aria-pressed", "true");
  await expect(done).toHaveText("Done");
  await expect(review.getByTestId("review-revisions").getByRole("listitem").first()).toHaveAttribute(
    "data-done",
    "true",
  );
  for (const m of SCREENSHOT_MATRIX.slice(0, 2)) {
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), m.theme);
    await panel(page)
      .getByTestId("tutor-timeline")
      .evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    await page.screenshot({ path: `${SHOTS}/review-${m.theme}-${m.width}x${m.height}.png` });
  }
});

test("closed subjects and the tutor turned off are explained, never a dead panel", async ({ page }) => {
  await openApp(page);
  await setSubject(page, {
    thread: { subjectKind: "checkpoint", subjectId: "U01.CP" },
    title: "U01 checkpoint",
    tutorOpen: false,
  });
  await expect(panel(page).getByTestId("tutor-closed")).toContainText(
    "Checkpoint in progress. Claude reviews it with you afterwards.",
  );
  await expect(panel(page).getByTestId("composer")).toBeDisabled();
  await setSubject(page, {
    thread: { subjectKind: "drill", subjectId: "fam.pit.compare" },
    title: "Higher or lower",
    tutorOpen: false,
  });
  await expect(panel(page).getByTestId("tutor-closed")).toContainText("drill trials");
  // An ask while closed is a visible no-op.
  await page.evaluate(() =>
    (window as unknown as { __oakTutor: { askChat(t: string): unknown } }).__oakTutor.askChat("help"),
  );
  await expect(
    panel(page).getByRole("status").filter({ hasText: "checkpoints and drill trials are yours alone" }),
  ).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/closed-paper-1440x900.png` });

  await setBackend(page, "off");
  try {
    await page.goto("/settings/tutor");
    await expect(page.getByTestId("tutor-status")).toHaveAttribute("data-state", "off", { timeout: 40_000 });
    await expect(panel(page).getByTestId("tutor-off")).toContainText("without the tutor");
    await expect(panel(page).getByTestId("composer")).toBeDisabled();
    await expect(page.getByTestId("settings-tutor-status")).toContainText("Off");
    for (const theme of ["paper", "bark"] as const) {
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      await shoot(page, SHOTS, "settings-off", theme);
    }
  } finally {
    await setBackend(page, "auto");
  }
  await page.getByRole("button", { name: "Check again" }).first().click();
  await expect(page.getByTestId("tutor-status")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
});

test("Settings › Tutor: status, usage by kind, no cap, notes with Remove", async ({ page }) => {
  await openApp(page);
  await page.goto("/settings/tutor");
  await expect(page.getByTestId("settings-tutor-status")).toContainText("Ready");
  await expect(page.getByTestId("settings-tutor-cost")).toContainText("Included in your Claude plan");
  await expect(page.getByTestId("usage-by-lane")).toContainText("Hints and Explain my mistake");
  await expect(page.getByText("never cut off")).toBeVisible();
  // The listening note of the earlier test left a note; Remove retracts it.
  const notes = page.getByTestId("settings-notes");
  await expect(notes.getByRole("listitem").first()).toBeVisible();
  const before = await notes.getByRole("listitem").count();
  await notes
    .getByRole("button", { name: /^Remove note/ })
    .first()
    .click();
  if (before === 1) await expect(page.getByTestId("notes-empty")).toBeVisible();
  else await expect(notes.getByRole("listitem")).toHaveCount(before - 1);
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), m.theme);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "settings", m.theme);
  }
});

test("keyboard only: Mod+I, Enter, ↑ recall, Esc stop, Mod+I closes to the rail, resize with arrows", async ({
  page,
}) => {
  await openApp(page);
  // Start with the panel collapsed to its rail.
  await page.keyboard.press("ControlOrMeta+j");
  await expect(page.getByTestId("tutor-rail")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+i");
  const box = panel(page).getByTestId("composer");
  await expect(box).toBeFocused();
  await page.keyboard.type("Tell me slowly #slow");
  await page.keyboard.press("Enter");
  await expect(lastMessage(page)).toContainText("word 2", { timeout: 10_000 });
  await page.keyboard.press("Escape");
  await expect(lastMessage(page).getByTestId("turn-error")).toHaveAttribute("data-kind", "aborted");
  await expect(box).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(box).toHaveValue("Tell me slowly #slow");
  await box.fill("");
  // The splitter is focusable and moves with the arrow keys; the width is remembered.
  const sep = page.getByTestId("tutor-resize");
  await sep.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(sep).toHaveAttribute("aria-valuenow", "380");
  await page.reload();
  await expect(page.getByTestId("tutor-panel")).toHaveCSS("width", "380px");
  // The app after the reload is up as openApp waits for it, its keys mounted, before Mod+I is pressed: beside other
  // suites the panel was drawn before the key handler was, and the key was lost (corrections gate's run).
  await page.waitForFunction(() => "__oakTutor" in window);
  await expect(page.getByTestId("tutor-status")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  // Mod+I from inside the panel closes it.
  await panel(page).getByTestId("composer").focus();
  await page.keyboard.press("ControlOrMeta+i");
  await expect(page.getByTestId("tutor-rail")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+j");
  await expect(page.getByTestId("tutor-panel")).toBeVisible();
  // Visible focus on the chips.
  await setSubject(page, LESSON);
  await panel(page).locator('[data-chip="code"]').focus();
  await page.keyboard.press("Enter");
  await expect(panel(page).locator('[data-chip="code"]')).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Space");
  await expect(panel(page).locator('[data-chip="code"]')).toHaveAttribute("aria-pressed", "true");
});

test("reduced motion: the streaming indicators do not animate longer than 120 ms", async ({ page }) => {
  await openApp(page, "paper", "on");
  await send(page, "Tell me slowly #slow");
  const dot = lastMessage(page).getByTestId("turn-phase").locator("span").first();
  await expect(dot).toBeVisible();
  const anim = await dot.evaluate((el) => {
    const s = getComputedStyle(el);
    return { name: s.animationName, dur: s.animationDuration, count: s.animationIterationCount };
  });
  expect(anim.name === "none" || (Number.parseFloat(anim.dur) <= 0.12 && anim.count === "1")).toBe(true);
  await panel(page).getByTestId("composer").press("Escape");
});

for (const m of SCREENSHOT_MATRIX)
  test(`screenshots: panel in ${m.theme} at ${m.width}x${m.height}`, async ({ page }) => {
    await page.setViewportSize({ width: m.width, height: m.height });
    await openApp(page, m.theme);
    await setSubject(page, {
      ...LESSON,
      thread: { subjectKind: "lesson", subjectId: "U02.L01" },
      lessonId: "U02.L01",
      stepId: "S5",
    });
    await send(page, "Walk me through it #long #card #tool");
    await waitDone(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await panel(page)
      .getByTestId("tutor-timeline")
      .evaluate((el) => {
        el.scrollTop = 0;
      });
    await page.screenshot({ path: `${SHOTS}/panel-${m.theme}-${m.width}x${m.height}.png` });
    await panel(page)
      .getByTestId("tutor-timeline")
      .evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    await page.screenshot({ path: `${SHOTS}/panel-${m.theme}-${m.width}x${m.height}-end.png` });
    // Focus ring on a token chip.
    await lastMessage(page).locator('[data-token="deg"]').first().focus();
    await page.screenshot({ path: `${SHOTS}/panel-focus-${m.theme}-${m.width}x${m.height}.png` });
  });
