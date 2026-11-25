// Wave 7 Codas on the real server, each from a dev seed (wave7.md §6): the "next" line is the planner's own next
// session (carry f6: `SessionSummary.next`) — a track checkpoint, a track capstone session, a track lesson after a
// switch of focus — never composed in the app; and the Coda of the session that completed the whole course
// (`SessionSummary.courseComplete`), then the same ending reopened from Progress. Nothing is filled or patched.
import { expect, type Page, test } from "@playwright/test";
import { useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { blockHmr, expectNoOverflow, matrix, settle } from "./support.ts";
import { watch } from "./w5-helpers.ts";
import { codaOfLastDay } from "./w6-helpers.ts";
import { lastSummary, NEVER7 } from "./w7-helpers.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  await blockHmr(page);
});

const TRACK = { J: "Jazz Harmony", R: "Advanced Rhythm", A: "Arrangement & Sound" } as const;

test("two days across the tracks: each Coda's next line is the planner's own next session, with its goal", async ({
  page,
  request,
}) => {
  const errors = watch(page, [/\/api\/tutor/]);
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  // A track checkpoint due (and what passing it opens), a capstone opened by its checkpoint: what tomorrow is, said
  // once. Track lessons, gym slots and review days are the same line from the same field (tracks-day.test.ts).
  for (const [point, kind] of [
    ["J.CP1 due", "checkpoint"],
    ["RC1 open", "capstone"],
  ] as const) {
    await codaOfLastDay(page, request, point);
    const next = (await lastSummary(request)).next;
    expect(next, `${point}: the summary carries the planner's next session`).toBeTruthy();
    expect(next?.kind, point).toBe(kind);
    const line = page.getByTestId("coda-tomorrow");
    await expect(line).toHaveAttribute("data-item", next?.mapItemId ?? "none");
    await expect(line).toHaveText(new RegExp(`^Next time: .*${(next?.mapItemId ?? "").split(".")[0]}`));
    if (next?.trackId) await expect(line).toContainText(TRACK[next.trackId]);
    if (next?.goal) await expect(page.getByTestId("coda-tomorrow-what")).toBeVisible();
    if (kind === "checkpoint")
      await expect(page.getByTestId("coda-tomorrow-opens")).toHaveText("Passing it opens JC1 ii–V Ballad.");
    await expect(page.locator("main")).not.toContainText(NEVER7);
    await settle(page);
    await expectNoOverflow(page);
  }
  expect(errors).toEqual([]);
});

test("the whole course complete: the ending, once, in place of the next line; reopened from Progress, read-only (keyboard)", async ({
  page,
  request,
}) => {
  const errors = watch(page, [/\/api\/tutor/]);
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const open = async (p: Page) => {
    await codaOfLastDay(p, request, "whole course complete");
    await expect(p.getByTestId("coda-course-finale")).toBeVisible({ timeout: 30_000 });
  };
  await open(page);
  const summary = await lastSummary(request);
  expect(summary.courseComplete?.stage).toBe("complete");
  // The heading (ms.28's sentence), the road, then the record, the three tracks, what they can do, what stays open.
  await expect(page.getByTestId("course-finale-heading")).toHaveText("You have completed Oak.");
  await expect(page.getByText("You have completed Oak.")).toHaveCount(1);
  await expect(page.getByTestId("course-finale-road")).toHaveText(/^Since .+: 270 sessions on \d+ days/);
  const order = await page
    .locator(
      '[data-testid="course-record"], [data-testid="course-tracks"], [data-testid="course-cando"], [data-testid="course-open"]',
    )
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(order).toEqual(["course-record", "course-tracks", "course-cando", "course-open"]);
  await expect(page.getByTestId("course-record-line")).toHaveText(
    "Twenty tracks: 12 on Side A, 8 on Side B.",
  );
  await expect(page.getByTestId("course-side-b").locator("[data-track]")).toHaveCount(8);
  await expect(page.getByTestId("course-tracks").locator("[data-track]")).toHaveCount(3);
  await expect(page.getByTestId("course-open")).toContainText(/^What stays open.*Tomorrow: /s);
  // In place of the day's next line, can-do card and the core's ending; nothing plays by itself.
  for (const id of ["coda-next", "coda-tomorrow", "coda-finale", "coda-cando"])
    await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId("side-a-record")).toHaveAttribute("data-state", "stopped");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(NEVER7);
  await matrix(page, "w7-coda-course-end", async (p) => {
    await p.goto("/session/coda");
    await expect(p.getByTestId("coda-course-finale")).toBeVisible({ timeout: 30_000 });
  });
  // Keyboard: Enter is "Done for today" at any moment.
  await expect(page.getByTestId("done-for-today")).toBeFocused();
  // Reopened from Progress: the same ending, read-only, with the way back.
  await page.goto("/progress");
  const entry = page.getByTestId("progress-course-end");
  await expect(entry).toBeVisible({ timeout: 30_000 });
  await expect(entry.getByRole("heading")).toHaveText("You have completed Oak.");
  await entry.getByTestId("open-course-ending").click();
  await expect(page).toHaveURL(/\/session\/coda\?ending=course$/);
  await expect(page.getByTestId("course-ending-page")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("ending-back")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/progress$/);
  expect(errors).toEqual([]);
});
