// Oak 2.0 W1 (S7): the Later list on Today against the real server. "Park something for later" adds an item; Done
// moves it under "Done (1)". The tutor's "Park it for later" button is not covered here: the fake tutor
// (`OAK_TUTOR_FAKE`) answers by markers in the learner's text and has no marker that answers with `[[later]]` (its
// markers are server/src/tutor-adapters/fake-backend.ts `FAKE_TUTOR_MARKERS`). Run at the wave gate only.
import { expect, test } from "@playwright/test";
import { api } from "./support.ts";

test.beforeEach(async ({ page }) => {
  // Other engineers' edits make Vite reload the page mid-test.
  await page.routeWebSocket(/.*/, () => {});
});

test("Today's Later list: park an item, then Done moves it under Done (1)", async ({ page, request }) => {
  // Today shows the Later list once onboarding is behind the learner (a first run has one action only).
  await api(request, "PUT", "/api/profile", { onboardedAt: new Date().toISOString() });
  const before = await api<{ items: unknown[] }>(request, "GET", "/api/later?done=1");
  await page.goto("/");
  const later = page.getByTestId("later-list");
  await expect(later).toBeVisible();
  const field = later.getByPlaceholder("Park something for later");
  await expect(field).toBeVisible();

  const text = `What a tritone sub is ${Date.now()}`;
  await field.fill(text);
  await later.getByRole("button", { name: "Park it" }).click();
  const row = later.getByTestId("later-open").getByTestId("later-item").filter({ hasText: text });
  await expect(row).toBeVisible();
  await expect(field).toHaveValue("");

  await row.getByRole("button", { name: "Done" }).click();
  await expect(later.getByTestId("later-open").getByText(text)).toHaveCount(0);
  const done = later.getByTestId("later-done");
  await expect(done.locator("summary")).toHaveText(`Done (${before.items.length + 1})`);
  await done.locator("summary").click();
  await expect(done.getByTestId("later-item").filter({ hasText: text })).toHaveAttribute("data-done", "true");

  const items = await api<{ items: { text: string; source: string | null; doneAt: string | null }[] }>(
    request,
    "GET",
    "/api/later?done=1",
  );
  expect(items.items.find((i) => i.text === text)).toMatchObject({
    source: "learner",
    doneAt: expect.any(String),
  });
});
