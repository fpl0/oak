// Regression: a warm-up's listen block of single notes ("Just listen · Match the note") stayed on "1. … playing"
// for ever. @oak/strudel's playEvents never resolves `done` when every event falls in its first scheduling
// window (one note), so the block never moved to the second example. Drills now settle playback by the clock.
// Its lines also read "1. match … 8. match" for a one-category family; they are numbered examples now ("Note 1"
// for single notes to match, "Example 1" otherwise).
import { expect, test } from "@playwright/test";
import { useUiPrefs } from "../support/ui.ts";
import { api, noHmr, openToday, resetClock, seed, shootAll, watch } from "./support.ts";

test("a listen block of single notes plays every example and then hands over", async ({ page, request }) => {
  await resetClock(request);
  await seed(request, "after U00.L02");
  const plan = await api<{ warmup: { items: { kind: string; familyId?: string }[] } }>(
    request,
    "GET",
    "/api/session/today",
  );
  expect(plan.warmup.items.length).toBeGreaterThan(0);
  await noHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const problems = watch(page);
  await openToday(page);
  await page.getByTestId("start-session").click();
  const block = page.getByTestId("listen-block");
  await expect(block).toBeVisible({ timeout: 60_000 });
  const items = block.locator("ol > li");
  const n = await items.count();
  expect(n).toBeGreaterThan(1);
  // Each example takes about a second: all of them are heard within a few seconds each.
  await expect(items.nth(1)).toHaveAttribute("aria-current", "true", { timeout: 8_000 });
  await expect(block.getByText("playing")).toHaveCount(0, { timeout: n * 4_000 });
  await expect(block.getByRole("button", { name: /Play again/ })).toBeEnabled();
  // Eight examples of one category read "Example 1 … 8" ("Note 1 … 8" for the match-the-note family), not
  // "1. match … 8. match".
  await expect(items.first()).toHaveText(/^(Example 1|Note 1|1\. (?!match$).+)$/);
  await shootAll(page, "warmup-listen-block");
  expect(problems).toEqual([]);
});
