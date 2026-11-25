// /progress and the Oak in Wave 7, from dev seeds on the real server (wave7.md §6): the three tracks with their
// sessions, checkpoints and capstones — a lesson passed over until its gate (J2.L04 before U14.CP), a capstone that
// says exactly which gate it waits for (AC2's three-way gate), the pace said once, for the focus — and, once the
// whole course is complete, the Oak with every acorn hung. Nothing is filled or patched.
import { expect, type Page, test } from "@playwright/test";
import { shoot, useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { blockHmr, expectNoOverflow, SHOTS, seed, settle } from "./support.ts";
import { watch } from "./w5-helpers.ts";
import { verticalOverflow } from "./w6-helpers.ts";
import { NEVER7 } from "./w7-helpers.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  await blockHmr(page);
});

const card = (page: Page) => page.getByTestId("progress-tracks");

test("the jazz track taken before U14.CP: J2.L04 waits for its checkpoint, the track goes on; capstones name their gates", async ({
  page,
  request,
}) => {
  const errors = watch(page);
  await seed(request, "J2.L04 locked (U14.CP not passed)");
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/progress");
  await expect(card(page)).toBeVisible({ timeout: 30_000 });
  const jazz = card(page).locator('[data-track="J"]');
  await expect(jazz).toHaveAttribute("data-open", "true");
  // The track goes on to its checkpoint; J2.L04 is named as waiting, never as failed or missing.
  await expect(jazz.getByTestId("track-note")).toHaveText(/^Next: J\.CP1 /);
  await expect(jazz.getByTestId("track-waiting").first()).toHaveText(
    "J2.L04 Chord-Scales waits for the U14 checkpoint. The track goes on without it, and it is offered as soon as that is passed.",
  );
  await expect(jazz.getByTestId("track-count")).toHaveText("8 of 35 sessions");
  await expect(jazz.locator('[data-capstone="JC1"]').getByTestId("capstone-gate")).toHaveText(
    /first jazz checkpoint/,
  );
  await expect(page.locator("main")).not.toContainText(NEVER7);
  await jazz.scrollIntoViewIfNeeded();
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w7-progress-j2l04", "paper");
  // The Oak's course view says the same, one line per closed gate.
  await page.goto("/oak?view=course");
  const branch = page.locator('[data-testid="course-branch"][data-track="J"]');
  await expect(branch.getByTestId("course-branch-waiting").first()).toHaveText(
    /^J2\.L04 Chord-Scales waits/,
    {
      timeout: 30_000,
    },
  );
  await expect(page.locator('a[href^="/learn/J2.L04"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("two tracks under way: AC2's three-way gate named in full; the pace said once, for the focus", async ({
  page,
  request,
}) => {
  const errors = watch(page);
  await seed(request, "two tracks in progress");
  await useUiPrefs(page, { theme: "bark" });
  await page.goto("/progress");
  await expect(card(page)).toBeVisible({ timeout: 30_000 });
  await expect(card(page).locator('[data-track="J"]')).toHaveAttribute("data-focus", "true");
  await expect(card(page).locator('[data-capstone="AC2"]').getByTestId("capstone-gate")).toHaveText(
    /sound checkpoint.*Walking Bass.*Displacement/,
  );
  // A track checkpoint holds back only its capstones: no lesson row ever says it waits for one.
  for (const line of await card(page).getByTestId("track-waiting").allTextContents())
    expect(line).not.toMatch(/jazz checkpoint|rhythm checkpoint|sound checkpoint/);
  // At most one pace line, and only on the focused track.
  expect(await card(page).getByTestId("track-pace").count()).toBeLessThanOrEqual(1);
  await expect(card(page).locator('[data-track="R"]').getByTestId("track-pace")).toHaveCount(0);
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w7-progress-two-tracks", "bark");
  expect(errors).toEqual([]);
});

test("the whole course complete: the Oak with all twenty acorns hung, the B-sides on the ground; Progress keeps one entry", async ({
  page,
  request,
}) => {
  const errors = watch(page);
  await seed(request, "whole course complete");
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/oak");
  await expect(page.locator("[data-node]").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-acorn]:not([data-acorn="b-side"])')).toHaveCount(20);
  // The whole tree is grown, said once; each branch says it is complete, never that it is still being written.
  await expect(page.getByTestId("oak-no-next")).toHaveText(
    "Every limb and every branch is grown: the core and its three tracks. Reviews keep it green.",
  );
  const branches = page.getByTestId("oak-branches").locator("[data-track]");
  await expect(branches).toHaveCount(3);
  for (const text of await branches.allTextContents()) expect(text).toMatch(/All \d+ sessions done\./);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await settle(page);
    await expectNoOverflow(page);
    expect(await verticalOverflow(page), `${size.width}×${size.height}`).toBeLessThanOrEqual(1);
    await shoot(page, SHOTS, "w7-oak-whole-course", "paper");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/progress");
  await expect(page.getByTestId("progress-course-end")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("progress-ending")).toBeVisible();
  // Each track says it is complete, never that its next lessons are being written; no focus left to name.
  for (const id of ["J", "R", "A"]) {
    const row = card(page).locator(`[data-track="${id}"]`);
    await expect(row).toHaveAttribute("data-complete", "true");
    await expect(row.getByTestId("track-note")).toHaveText(/^All \d+ sessions done\./);
  }
  await expect(card(page).locator('[data-focus="true"]')).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/still being written/);
  await expect(page.locator("main")).not.toContainText(NEVER7);
  expect(errors).toEqual([]);
});
