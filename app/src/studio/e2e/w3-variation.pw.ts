// Oak 2.0 W3 Task 1 (PLAN §4 S5 variation) against the real server: a transform rewrites the line under the cursor
// as one undoable change (Invert, then Mod+Z; Time shift writes a JS fraction); siblings each change one picked
// dimension and are described against their parent ("You changed the rhythm."), then play back to back; three kept
// generations with a Run between the second and the third make a chain of 1, 2, 3 (the Run never becomes a parent),
// and a third generation that puts back what the second changed is noted. Run only at the wave gate (W3 Task 6 B6),
// after stage A has mounted `sketches.lineage`.
import { expect, type Page, test } from "@playwright/test";
import { api, createSketch, openSketch, unlockFirstLessons } from "./helpers.ts";

const CODE = [
  "setcpm(90/4)",
  "",
  'drums: s("bd ~ sd ~")',
  'mel: n("0 2 4 7").scale("C4:major").s("piano")',
  "",
].join("\n");

interface Version {
  version: number;
  code: string;
  note: string | null;
  parentVersion?: number | null;
  generation?: number | null;
  dimension?: string | null;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const editor = (page: Page) => page.locator(".cm-content").first();
async function versions(page: Page, id: string): Promise<Version[]> {
  return (await api<{ versions: Version[] }>(page, "GET", `/sketches/${id}`)).body.versions;
}
/** Replaces the whole text of the sketch's editor (no key events, so no bracket is closed for us). */
async function setCode(page: Page, code: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
}
async function cursorOn(page: Page, label: string): Promise<void> {
  await page
    .locator(".cm-line", { hasText: `${label}:` })
    .first()
    .click();
}
async function saved(page: Page, version: number): Promise<void> {
  await expect(page.getByTestId("save-state")).toContainText(`Saved v${version}`, { timeout: 20_000 });
}
async function startDraft(page: Page, kind: "sibling" | "generation", dimension: string): Promise<void> {
  const panel = page.getByTestId("variation-panel");
  await panel.getByTestId(kind === "sibling" ? "variation-add-sibling" : "variation-next-generation").click();
  // No dimension is chosen for the learner.
  await expect(panel.getByTestId("variation-change-it")).toBeDisabled();
  await panel.getByTestId(`variation-dimension-${dimension}`).check();
  await panel.getByTestId("variation-change-it").click();
  await expect(panel.getByTestId("variation-draft")).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await page.close();
});

test.describe.configure({ mode: "serial" });

test("transforms rewrite the line under the cursor as one undoable change", async ({ page }) => {
  const errors = watchErrors(page);
  const id = await createSketch(page, "Transforms", CODE);
  await openSketch(page, id);

  await cursorOn(page, "mel");
  await page.getByTestId("transforms-open").click();
  const menu = page.getByTestId("transform-menu");
  await expect(menu).toBeVisible();
  await menu.getByTestId("transform-invert").click();
  await expect(menu).toBeHidden();
  await expect(editor(page)).toContainText('n("7 5 3 0")');
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(editor(page)).toContainText('n("0 2 4 7")');

  await cursorOn(page, "mel");
  await page.getByTestId("transforms-open").click();
  await page.getByTestId("transform-menu").getByTestId("transform-shift-8").click();
  await expect(editor(page)).toContainText(".early(1/8)");
  await expect(editor(page)).not.toContainText('.early("1/8")');
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(editor(page)).not.toContainText(".early(");

  // A transform that cannot apply says why and writes nothing.
  await cursorOn(page, "drums");
  await page.getByTestId("transforms-open").click();
  await page.getByTestId("transform-menu").getByTestId("transform-harmony").click();
  await expect(page.getByTestId("transform-status")).toContainText(
    "Add a harmony works on a line of scale steps",
  );
  await page.keyboard.press("Escape");
  await expect(editor(page)).toContainText('drums: s("bd ~ sd ~")');
  expect(errors).toEqual([]);
});

test("siblings: each changes one picked dimension, is described, and they play back to back", async ({
  page,
}) => {
  const errors = watchErrors(page);
  const id = await createSketch(page, "Siblings", CODE);
  await openSketch(page, id);
  const panel = page.getByTestId("variation-panel");
  await panel.getByRole("tab", { name: "Siblings" }).click();

  // A rhythm sibling: edited, Run as usual (an ordinary version), then kept.
  await startDraft(page, "sibling", "rhythm");
  await setCode(page, CODE.replace('s("bd ~ sd ~")', 's("bd bd sd ~")'));
  await page.keyboard.press("ControlOrMeta+Enter");
  await saved(page, 2);
  await page.keyboard.press("ControlOrMeta+.");
  await panel.getByTestId("variation-keep-sibling").click();
  await saved(page, 3);

  // A sound sibling of the same parent, kept without a Run.
  await startDraft(page, "sibling", "sound");
  await expect(editor(page)).toContainText('drums: s("bd ~ sd ~")');
  await setCode(page, CODE.replace('s("piano")', 's("sawtooth")'));
  await panel.getByTestId("variation-keep-sibling").click();
  await saved(page, 4);

  const all = await versions(page, id);
  expect(
    all.map((v) => [v.version, v.parentVersion ?? null, v.generation ?? null, v.dimension ?? null]),
  ).toEqual([
    [1, null, null, null],
    [2, null, null, null],
    [3, 1, 1, "rhythm"],
    [4, 1, 1, "sound"],
  ]);
  expect(all.map((v) => v.note)).toEqual([null, null, "Sibling: rhythm", "Sibling: sound"]);

  const rows = panel.getByTestId("sibling-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByTestId("variation-change")).toHaveText("You changed the rhythm.", {
    timeout: 30_000,
  });
  await expect(rows.nth(1).getByTestId("variation-change")).not.toHaveText(/should|must|missing|%|✓|✗/);

  await panel.getByTestId("back-to-back-play").click();
  await expect(panel.getByTestId("back-to-back-now")).toContainText("Playing", { timeout: 30_000 });
  await panel.getByTestId("back-to-back-stop").click();
  await expect(panel.getByTestId("back-to-back-now")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("generations: Runs in between never become parents; a change put back is noted", async ({ page }) => {
  const errors = watchErrors(page);
  const id = await createSketch(page, "Generations", CODE);
  await openSketch(page, id);
  const panel = page.getByTestId("variation-panel");
  await panel.getByRole("tab", { name: "Generations" }).click();

  const gen1 = CODE.replace('n("0 2 4 7")', 'n("0 2 4 5")');
  await startDraft(page, "generation", "notes");
  await setCode(page, gen1);
  await panel.getByTestId("variation-keep-generation").click();
  await saved(page, 2);

  const gen2 = gen1.replace('s("bd ~ sd ~")', 's("bd bd sd ~")');
  await startDraft(page, "generation", "rhythm");
  await setCode(page, gen2);
  await panel.getByTestId("variation-keep-generation").click();
  await saved(page, 3);

  // A Run in between: an ordinary version, never a parent.
  await setCode(page, gen2.replace('n("0 2 4 5")', 'n("0 2 4 4")'));
  await page.keyboard.press("ControlOrMeta+Enter");
  await saved(page, 4);
  await page.keyboard.press("ControlOrMeta+.");

  // The third generation starts from the chain's tip (v3) and puts back the rhythm the second changed.
  await startDraft(page, "generation", "rhythm");
  await expect(editor(page)).toContainText('n("0 2 4 5")');
  await expect(panel.getByTestId("variation-keep-generation")).toHaveText("Keep generation 3");
  await setCode(page, gen1);
  await panel.getByTestId("variation-keep-generation").click();
  await saved(page, 5);

  const lineage = await api<{ versions: { version: number; generation: number | null }[] }>(
    page,
    "GET",
    `/sketches/${id}/lineage?version=5`,
  );
  expect(lineage.status).toBe(200);
  expect(lineage.body.versions.map((v) => [v.version, v.generation])).toEqual([
    [1, null],
    [2, 1],
    [3, 2],
    [5, 3],
  ]);

  const chain = panel.getByTestId("chain-row");
  await expect(chain).toHaveCount(4);
  await expect(panel.locator("[data-testid=chain-row][data-generation]")).toHaveCount(3);
  for (const [i, g] of ["1", "2", "3"].entries())
    await expect(panel.locator("[data-testid=chain-row][data-generation]").nth(i)).toHaveAttribute(
      "data-generation",
      g,
    );
  await expect(panel.getByTestId("chain-undo-note")).toHaveText(
    "Generation 3 changes back what generation 2 changed.",
  );
  await panel.getByTestId("back-to-back-play").click();
  await expect(panel.getByTestId("back-to-back-now")).toContainText("Playing", { timeout: 30_000 });
  await panel.getByTestId("back-to-back-stop").click();
  expect(errors).toEqual([]);
});
