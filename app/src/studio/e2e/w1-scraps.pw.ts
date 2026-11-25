// Oak 2.0 W1 scraps (Task 1) against the real server: the labelled lines of a sketch show as index scraps with their
// roles, the role filter, Play on a scrap that needs its const, a new sketch from two scraps both labelled `bass`
// (`bass` and `bass2`, both kept), and Delete on a saved scrap only (it asks first). Run only at the wave gate (W1
// plan Task 9 Step B6).
import { expect, type Page, test } from "@playwright/test";
import { api, createSketch, unlockFirstLessons, WB } from "./helpers.ts";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** The editor's text (CodeMirror lines joined by newlines). */
async function editorText(page: Page): Promise<string> {
  return page
    .locator(".cm-content")
    .evaluate((el) => [...el.querySelectorAll(".cm-line")].map((l) => l.textContent ?? "").join("\n"));
}

const GROOVE =
  'setcpm(100/4)\n\ndrums: s("bd*4")\nbass: note("c2 ~ g1 ~").s("ebass")\nconst changes = "<C Am>"\nchords: chord(changes).voicing().s("piano")\n';
const OTHER_BASS = 'setcpm(90/4)\n\nbass: note("~ e2 ~ d2").s("ebass")\n';

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await page.close();
});

test.describe.configure({ mode: "serial" });

test("a sketch's labelled lines are scraps with their parts; Play runs one with its const", async ({
  page,
}) => {
  const errors = watchErrors(page);
  // The version's bpm as the app saves it (from the code's tempo line); the helper's default body says 90.
  await createSketch(page, "Groove scraps", GROOVE, { bpm: 100 });
  await page.goto("/studio?scraps=1");
  const panel = page.getByTestId("scraps-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByRole("tab", { name: "Scraps" })).toHaveAttribute("aria-selected", "true");
  const fromGroove = panel.getByTestId("scrap-row").filter({ hasText: "Groove scraps" });
  await expect(fromGroove).toHaveCount(3);
  await expect(fromGroove.filter({ hasText: "drums" })).toHaveAttribute("data-role", "drums");
  await expect(fromGroove.filter({ hasText: "ebass" })).toHaveAttribute("data-role", "bass");
  const chords = fromGroove.filter({ hasText: "chord(changes)" });
  await expect(chords).toHaveAttribute("data-role", "chords");
  await expect(chords.getByTestId("scrap-code")).toContainText('const changes = "<C Am>"');
  await expect(fromGroove.first()).toContainText("from your sketch “Groove scraps” v1");
  // Index scraps go with their sketch line: no Delete.
  await expect(fromGroove.getByTestId("scrap-delete")).toHaveCount(0);
  await expect(fromGroove.getByTestId("scrap-index-note")).toHaveCount(3);

  // The Bass filter.
  await panel.getByRole("radio", { name: "Bass" }).click();
  await expect(panel.getByTestId("scrap-row").filter({ hasText: "Groove scraps" })).toHaveCount(1);
  await panel.getByRole("radio", { name: "All" }).click();

  // Play the chords scrap: it runs with its const and reaches an analysis.
  await chords.getByTestId("scrap-play").click();
  await expect(chords.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("two bass scraps make a sketch with bass and bass2", async ({ page }) => {
  const errors = watchErrors(page);
  await createSketch(page, "Other bass", OTHER_BASS);
  await page.goto("/studio?scraps=1");
  const panel = page.getByTestId("scraps-panel");
  await panel.getByRole("radio", { name: "Bass" }).click();
  const basses = panel.getByTestId("scrap-row");
  await basses.filter({ hasText: "Groove scraps" }).getByTestId("scrap-pick").check();
  await basses.filter({ hasText: "Other bass" }).getByTestId("scrap-pick").check();
  await panel.getByTestId("scraps-new-sketch").click();
  await expect(page).toHaveURL(/\/studio\/sk/);
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  const text = await editorText(page);
  expect(text).toContain("bass:");
  expect(text).toContain("bass2:");
  expect(text).toContain("setcpm(100/4)");
  expect(errors).toEqual([]);
});

test("a saved scrap can be deleted (asked first); an index scrap cannot", async ({ page }) => {
  const saved = await api<{ id: string }>(page, "POST", "/scraps", {
    role: "drums",
    label: "hats",
    code: 'hats: s("hh*8")',
    bpm: 90,
    meter: "4/4",
    key: null,
    sourceKind: "lesson",
    sourceRef: "U01.L01/S1",
  });
  expect(saved.status).toBe(200);
  await page.goto("/studio?scraps=1");
  const panel = page.getByTestId("scraps-panel");
  const row = panel
    .locator('[data-testid=scrap-row][data-origin="saved"]')
    .filter({ hasText: 'hats: s("hh*8")' });
  await expect(row).toContainText("from a lesson");
  let asked = "";
  page.once("dialog", (d) => {
    asked = d.message();
    void d.accept();
  });
  await row.getByTestId("scrap-delete").click();
  await expect(row).toHaveCount(0);
  expect(asked).toContain("Delete the scrap");
  const left = await api<{ items: { id: string }[] }>(page, "GET", "/scraps?origin=saved");
  expect(left.body.items.map((s) => s.id)).not.toContain(saved.body.id);
  await expect(
    panel.locator('[data-testid=scrap-row][data-origin="index"]').first().getByTestId("scrap-delete"),
  ).toHaveCount(0);
});
