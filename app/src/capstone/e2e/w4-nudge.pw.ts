// Oak 2.0 W4 F2 "Is it better, or just different?" on the capstone stack (5210/8810, the fake tutor), from "C3.S3 done":
// the full demo is checked (every requirement met), then one `.gain()` value is changed twice (two saved versions):
// the card appears; the blind compare's buttons read "1" and "2" before the learner chooses; "1 is better" reveals
// which draft was which ("… was version N, the draft you checked …") and sends nothing to the server. A structural
// edit (a new line) instead of a tweak: no card. Run only at the wave gate (W4 Task 6 B7), after stage A has wired
// X18's classifier into `BetterOrDifferent` and stage B has registered the slot and mounted `capstones.checkHistory`.
import { expect, type Page, test } from "@playwright/test";
import { C3_FULL } from "./w5-pieces.ts";
import { editor, seedFirst, setCode, watchErrors } from "./w5-support.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

const HATS = 'hats: s("hh*8").gain(.4)';
const withHats = (gain: string) => C3_FULL.replace(HATS, `hats: s("hh*8").gain(${gain})`);

async function savedVersion(page: Page): Promise<number> {
  const text = (await page.getByTestId("saved-state").textContent()) ?? "";
  return Number(/Version (\d+) saved/.exec(text)?.[1] ?? 0);
}
/** Writes code and waits for the draft saver to store it as a new version. */
async function saveDraft(page: Page, code: string): Promise<number> {
  const was = await savedVersion(page);
  await setCode(page, "C3", code);
  await expect
    .poll(() => savedVersion(page), { timeout: 30_000, message: "the draft saves a new version" })
    .toBeGreaterThan(was);
  return savedVersion(page);
}
async function checkPassing(page: Page): Promise<void> {
  await expect(page.getByTestId("req-count")).toHaveText(/^(\d+) of \1 met$/, { timeout: 60_000 });
  await page.getByTestId("check-track").click();
  await expect(page.getByRole("status").filter({ hasText: /every requirement is met/ })).toBeVisible({
    timeout: 30_000,
  });
}

test("two gain tweaks after a passing check: a blind, matched A/B, named only after the choice", async ({
  page,
}) => {
  test.setTimeout(200_000);
  const errors = watchErrors(page);
  expect(C3_FULL).toContain(HATS);
  await seedFirst(page, ["C3.S3 done"]);
  await page.goto("/capstone/C3");
  await expect(page.getByTestId("capstone-workspace")).toBeVisible({ timeout: 60_000 });
  await editor(page, "C3");

  const passing = await saveDraft(page, C3_FULL);
  await checkPassing(page);
  const card = page.getByTestId("better-or-different");
  await expect(card).toHaveCount(0);

  await saveDraft(page, withHats(".45"));
  await saveDraft(page, withHats(".5"));
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Is it better, or just different?");
  await expect(card).toContainText("Your last edits only change numbers.");
  await expect(card).toContainText("If you can't tell, it may be done.");
  const compare = card.getByTestId("nudge-compare");
  await expect(compare.getByTestId("compare-a")).toHaveText("1");
  await expect(compare.getByTestId("compare-b")).toHaveText("2");
  await expect(card).not.toContainText(`version ${passing}`);

  // The choice is the learner's alone: nothing about it reaches the server.
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/") && r.method() !== "GET") writes.push(`${r.method()} ${r.url()}`);
  });
  await card.getByTestId("nudge-one").click();
  const reveal = card.getByTestId("nudge-reveal");
  await expect(reveal).toContainText(`was version ${passing}, the draft you checked`);
  await expect(reveal).toContainText(/^1 (was version \d+|is your draft now)/);
  await expect(compare.getByTestId("compare-a")).toContainText("1:");
  await page.waitForTimeout(500);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("a structural edit after the passing check: no card", async ({ page }) => {
  test.setTimeout(200_000);
  const errors = watchErrors(page);
  await seedFirst(page, ["C3.S3 done"]);
  await page.goto("/capstone/C3");
  await expect(page.getByTestId("capstone-workspace")).toBeVisible({ timeout: 60_000 });
  await editor(page, "C3");

  await saveDraft(page, C3_FULL);
  await checkPassing(page);
  await saveDraft(page, `${C3_FULL.trimEnd()}\nperc: s("~ rim ~ rim").gain(.3)\n`);
  await saveDraft(page, `${C3_FULL.trimEnd()}\nperc: s("~ rim ~ rim").gain(.35)\n`);
  // The window holds a change (a new line), so the edits are not "only numbers".
  await page.waitForTimeout(2_000);
  await expect(page.getByTestId("better-or-different")).toHaveCount(0);
  expect(errors).toEqual([]);
});
