// Oak 2.0 W4 F3 and F5 in the Studio against the real server: "Erase and listen" mutes each part in turn on top of
// the learner's own mutes (read from the editor handle, which is what plays) and puts them back after the pass; Oak's
// reading of crowded registers is absent until the pass ends, then names bass and chords (both near C3); "Leave it
// out in the code" writes `_bass:`. Versions → "Compare with version 1" shows the matched compare in the aside
// ("A: now" / "B: version 1") and no live A/B strip. Run only at the wave gate (W4 Task 6 B7), after stage B has
// registered the `erase-pass` and `matched-compare` slots and turned off the live A/B for version compare (B2).
import { expect, type Page, test } from "@playwright/test";
import { createSketch, openSketch, unlockFirstLessons } from "./helpers.ts";

const CODE = [
  "setcpm(90/4)",
  "",
  'drums: s("bd ~ sd ~")',
  'bass: note("c3 ~ c3 ~").s("triangle")',
  'chords: note("[c3,e3,g3]").s("piano")',
  "",
].join("\n");

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel|status of 501/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** The muted labels of the sketch's editor, as the live filter plays them (the Studio page has one editor). */
async function mutedNow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const o = (
      globalThis as unknown as {
        __oakStrudel?: { editors: Map<string, { getMutes(): { muted: Set<string> } }> };
      }
    ).__oakStrudel;
    const ed = o ? [...o.editors.values()][0] : undefined;
    return ed ? [...ed.getMutes().muted].sort() : [];
  });
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await page.close();
});

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

test("the erase pass mutes each part in turn, reads crowding only after, and leaves a part out in the code", async ({
  page,
}) => {
  const errors = watchErrors(page);
  const id = await createSketch(page, "Erase pass", CODE);
  await openSketch(page, id);
  // Run once so the editor holds the pattern Oak reads.
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+Enter");

  await page.getByTestId("erase-open").click();
  const pass = page.getByTestId("erase-pass");
  await expect(pass).toContainText("this is not about having fewer parts");
  await expect(pass.getByTestId("erase-reading")).toHaveCount(0);
  const before = await mutedNow(page);

  await pass.getByTestId("erase-start").click();
  const step = pass.getByTestId("erase-step");
  await expect(step).toHaveAttribute("data-part", "drums");
  await expect(step).toContainText("Now without drums. Do you miss it?");
  expect(await mutedNow(page)).toEqual([...before, "drums"].sort());
  await expect(pass.getByTestId("erase-reading")).toHaveCount(0);
  await pass.getByTestId("erase-miss").click();

  await expect(step).toHaveAttribute("data-part", "bass");
  expect(await mutedNow(page)).toEqual([...before, "bass"].sort());
  await pass.getByTestId("erase-dont-miss").click();

  await expect(step).toHaveAttribute("data-part", "chords");
  expect(await mutedNow(page)).toEqual([...before, "chords"].sort());
  await expect(pass.getByTestId("erase-reading")).toHaveCount(0);
  await pass.getByTestId("erase-miss").click();

  // The pass is over: the learner's own mutes are back, and only now Oak's reading.
  await expect(pass.getByTestId("erase-after")).toBeVisible();
  expect(await mutedNow(page)).toEqual(before);
  const reading = pass.getByTestId("erase-reading");
  await expect(reading).toBeVisible();
  await expect(reading.getByTestId("erase-crowded").first()).toContainText("bass and chords play near C3");

  // The part not missed: leave it out, written in the code.
  await expect(pass.getByTestId("erase-part")).toHaveAttribute("data-part", "bass");
  await pass.getByTestId("erase-leave-out").click();
  await expect(page.locator(".cm-content")).toContainText('_bass: note("c3 ~ c3 ~")');
  // One undoable change.
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.locator(".cm-content")).not.toContainText("_bass:");
  expect(errors).toEqual([]);
});

test("Compare with version 1 is the matched compare in the aside, with no live A/B strip", async ({
  page,
}) => {
  const errors = watchErrors(page);
  const id = await createSketch(page, "Matched compare", CODE);
  await openSketch(page, id);
  // A second version, so version 1 is an earlier one.
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText('\nhats: s("hh*8").gain(.3)');
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("save-state")).toContainText("Saved v2", { timeout: 20_000 });

  const named = page.getByRole("checkbox", { name: "Named only" });
  if (await named.isChecked()) await named.uncheck();
  await page.getByRole("button", { name: "Compare with version 1" }).click();
  const card = page.getByTestId("matched-version-compare");
  await expect(card).toBeVisible();
  await expect(card.getByTestId("versions-compare")).toBeVisible();
  await expect(card.getByTestId("compare-a")).toHaveText("A: now");
  await expect(card.getByTestId("compare-b")).toHaveText("B: version 1");
  await expect(card).toContainText("louder often sounds better");
  await expect(page.getByTestId("ab-controls")).toHaveCount(0);
  expect(errors).toEqual([]);
});
