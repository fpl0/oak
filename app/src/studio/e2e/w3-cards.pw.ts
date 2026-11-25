// Oak 2.0 W3 Task 2 (PLAN §4 S2, S6 cards) against the real server: New sketch → With a card shows a card, Start
// opens the editor with that card in the aside; with the "No hi-hats" card on a sketch, a Run of a line with hats
// gets the row "hh plays in drums." and the Run still plays (a card never blocks); "Put it back" removes it. Run only
// at the wave gate (W3 Task 6 B6), after stage A has wired the deck and stage B has registered the slots.
import { expect, type Page, test } from "@playwright/test";
import { api, openSketch, unlockFirstLessons, WB } from "./helpers.ts";
import { stack } from "./playwright.config.ts";

/** Lessons whose completion opens the cards these specs draw (`card.no-hats` opens with U01.L04). */
const LESSONS = ["U00.L01", "U01.L01", "U01.L02", "U01.L03", "U01.L04"];

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Marks the lessons completed in this stack's throwaway database (the course cannot be walked through the API). */
async function completeLessons(ids: readonly string[]): Promise<void> {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(`${stack.dataDir}/oak.db`);
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    const at = new Date(Date.now() - 86_400_000).toISOString();
    const insert = db.prepare(
      "INSERT OR IGNORE INTO lesson_progress (lesson_id, status, started_at, completed_at, completed_version, content_hash, updated_at) VALUES (?, 'completed', ?, ?, 1, 'e2e', ?)",
    );
    for (const id of ids) insert.run(id, at, at, at);
  } finally {
    db.close();
  }
}

const editor = (page: Page) => page.locator(".cm-content").first();
async function setCode(page: Page, code: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await completeLessons(LESSONS);
  await page.close();
});

test("With a card: a card shows, Start opens the editor with it in the aside", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/studio");
  await page.getByTestId("new-sketch").click();
  const dialog = page.getByRole("dialog", { name: "New sketch" });
  await dialog.getByRole("radio", { name: /With a card/ }).check();
  const card = dialog.getByTestId("with-card");
  await expect(card).toBeVisible();
  const text = (await dialog.getByTestId("with-card-text").textContent())?.trim() ?? "";
  expect(text.length).toBeGreaterThan(0);
  await dialog.getByTestId("with-card-start").click();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  const panel = page.getByTestId("cards-panel");
  await expect(panel.getByTestId("card-text")).toHaveText(text);
  // The sketch holds the card.
  const id = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  const sketch = await api<{ cards: { cardId: string }[] }>(page, "GET", `/sketches/${id}`);
  expect(sketch.body.cards).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("a card's row describes the Run and never blocks it; Put it back removes the card", async ({ page }) => {
  const errors = watchErrors(page);
  const made = await api<{ sketch: { id: string } }>(page, "POST", "/sketches", {
    title: "No hats",
    originKind: "free",
    originId: null,
    sessionId: null,
    code: "setcpm(90/4)\n",
    bpm: 90,
    meter: "4/4",
    key: null,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: false,
  });
  const id = made.body.sketch.id;
  const drawnAt = new Date().toISOString();
  expect(
    (await api(page, "PATCH", `/sketches/${id}`, { cards: [{ cardId: "card.no-hats", drawnAt }] })).status,
  ).toBe(200);
  await openSketch(page, id);
  const panel = page.getByTestId("cards-panel");
  const card = panel.locator('[data-testid=card][data-card="card.no-hats"]');
  await expect(card.getByTestId("card-text")).toHaveText("No hi-hats in this piece.");

  await setCode(page, 'setcpm(90/4)\n\ndrums: s("bd*2, hh*4")\n');
  await page.keyboard.press("ControlOrMeta+Enter");
  // The Run plays: the card describes, it never stops a Run.
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  await expect(card.getByTestId("card-row")).toHaveText("hh plays in drums.", { timeout: 20_000 });
  await expect(page.getByTestId("save-state")).toContainText("Saved v2", { timeout: 20_000 });
  await page.keyboard.press("ControlOrMeta+.");

  await card.getByTestId("card-put-back").click();
  await expect(panel.locator('[data-testid=card][data-card="card.no-hats"]')).toHaveCount(0);
  const after = await api<{ cards: { cardId: string }[] }>(page, "GET", `/sketches/${id}`);
  expect(after.body.cards).toEqual([]);
  expect(errors).toEqual([]);
});
