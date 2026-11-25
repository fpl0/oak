// Oak 2.0 W3 Task 2 (PLAN §4 S6) on Today against the real server: on a light day (12 days away, the server's clock
// moved) Today shows one calm "Just play" line that opens a toolbox page, and "Outside your lane"; "Not now" hides
// the outside line and it stays hidden after a reload. Run only at the wave gate (W3 Task 6 B6), after stage B has
// mounted `catalogs.list` (the outside line waits for it).
import { expect, test } from "@playwright/test";
import { api, serverNow, travel } from "./support.ts";

/** studio-offers.ts `daySeed` (FNV-1a of the date string, mod n), repeated so the spec picks a "Just play" day. */
function daySeed(day: string, n: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % n;
}

test.beforeEach(async ({ page }) => {
  // Other engineers' edits make Vite reload the page mid-test.
  await page.routeWebSocket(/.*/, () => {});
});

test.afterAll(() => travel(0));

test("a light day: one Just play line to a toolbox page; Outside your lane, and Not now hides it", async ({
  page,
  request,
}) => {
  travel(0);
  // A learner through U01.L03 (the last session yesterday), with that lesson's tools unlocked.
  await api(request, "POST", "/api/dev/seed", { point: "after U01.L03" });
  // Twelve or more days away is a light day; pick one that offers a tool, not a Band style (about one in four).
  let days = 12;
  for (; days < 40; days++) {
    travel(days);
    const { day } = await serverNow(request);
    if (daySeed(day, 4) !== 0) break;
  }
  await page.goto("/");
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "light", { timeout: 20_000 });

  const offers = page.getByTestId("studio-offers");
  const justPlay = offers.locator("[data-testid=studio-offer][data-kind=just-play]");
  await expect(justPlay).toHaveCount(1);
  await expect(justPlay.getByTestId("studio-offer-line")).toContainText("Just play: try");
  await expect(justPlay.getByTestId("just-play-open")).toHaveAttribute("href", /\/toolbox\//);
  // One calm line: never a primary button.
  await expect(offers.locator(".bg-accent")).toHaveCount(0);

  const outside = offers.locator("[data-testid=studio-offer][data-kind=outside-lane]");
  await expect(outside).toBeVisible();
  await expect(outside.getByTestId("outside-open")).toHaveAttribute("href", /catalog=outside/);
  await outside.getByTestId("outside-not-now").click();
  await expect(outside).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "light", { timeout: 20_000 });
  await expect(page.getByTestId("studio-offers").locator("[data-kind=just-play]")).toHaveCount(1);
  await expect(page.locator("[data-testid=studio-offer][data-kind=outside-lane]")).toHaveCount(0);

  await justPlay.getByTestId("just-play-open").click();
  await page.waitForURL(/\/toolbox\//);
});
