// A sung degree pattern with Chromium's fake microphone singing 1 3 5 in A (A3 C♯4 E4, one per second after the
// two-second count-in): the count-in shows its numerals, every target passes within the server-ladder band (±50¢),
// "Hear my singing" appears, and the stand-in host checks it right. Quiet mode: listen and self-check, reported as quiet
// evidence, never voice.
import { expect, test } from "@playwright/test";
import { useUiPrefs } from "../../../../e2e/support/ui.ts";
import { collectErrors, fakeMicArgs, MIC_FILES, openGallery } from "./fixtures.ts";

test.use({ launchOptions: { args: fakeMicArgs(MIC_FILES.pattern) } });

test("singing 1 3 5 in tune passes every target", async ({ page }) => {
  const errors = collectErrors(page);
  await page.routeWebSocket(/.*/, () => {});
  await useUiPrefs(page, { theme: "paper" });
  await openGallery(page, "?only=sing-degrees&state=idle");
  const w = page.locator('[data-live="sing-degrees"]');
  await expect(w.getByTestId("sing-phase")).toContainText("3 notes, within ±50¢");
  await w.getByRole("button", { name: "Sing", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(w.getByTestId("sing-phase")).toHaveText(/Count-in: [1-4]/, { timeout: 30_000 });
  await expect(w.getByTestId("sing-phase")).toHaveText("Sing now.", { timeout: 10_000 });
  await expect(w.getByTestId("sing-phase")).toHaveText("Done: 3 of 3 in tune.", { timeout: 15_000 });
  const notes = w.getByRole("list", { name: "Notes" });
  await expect(notes.getByRole("listitem")).toHaveCount(3);
  for (const d of ["1", "3", "5"])
    await expect(notes.getByRole("listitem", { name: new RegExp(`^degree ${d}, .*in tune$`) })).toHaveCount(
      1,
    );
  await expect(w.getByRole("button", { name: "Hear my singing" })).toBeVisible();
  // The trace wore each target's degree colour while in tune (wave3.md §0 carry-over, ux §4.3).
  await expect(w.locator("canvas")).toHaveAttribute("data-trace-degrees", "1 3 5");
  await w.getByRole("button", { name: "Check" }).focus();
  await page.keyboard.press("Enter");
  await expect(w.getByTestId("answer-status")).toHaveText("That's it.");
  expect(errors).toEqual([]);
});

test("Quiet mode: the lane on syllables, listen, self-check, quiet evidence and no voice", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.routeWebSocket(/.*/, () => {});
  await useUiPrefs(page, { theme: "bark" });
  await openGallery(page, "?only=sing-quiet&state=idle");
  const w = page.locator('[data-live="sing-quiet"]');
  const quiet = w.getByTestId("sing-quiet");
  await expect(quiet).toHaveAttribute("data-quiet-by", "mode");
  await expect(quiet).toContainText("Quiet mode: play it, then sing it in your head or aloud");
  await expect(quiet.getByRole("list", { name: "Notes" })).toContainText("1 · do3 · mi5 · sol");
  await expect(w.getByRole("button", { name: "Sing", exact: true })).toHaveCount(0);
  await expect(w.getByRole("button", { name: "Sing it after all" })).toHaveCount(0);
  await w.getByRole("button", { name: "Play it" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(w.getByRole("button", { name: "I heard it" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(w.getByRole("button", { name: "I heard it" })).toHaveAttribute("aria-pressed", "true");
  await expect(w.getByTestId("quiet-evidence")).toHaveAttribute("data-modality", "quiet");
  await expect(w.getByTestId("quiet-evidence")).toContainText("no voice");
  expect(errors).toEqual([]);
});

test("Can't sing now: the fallback, and back to singing", async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
  await useUiPrefs(page, { theme: "paper" });
  await openGallery(page, "?only=sing-degrees&state=idle");
  const w = page.locator('[data-live="sing-degrees"]');
  await w.getByRole("button", { name: "Can't sing now" }).click();
  await expect(w.getByTestId("sing-quiet")).toHaveAttribute("data-quiet-by", "choice");
  await w.getByRole("button", { name: "Not sure yet" }).click();
  await expect(w.getByTestId("quiet-evidence")).toHaveAttribute("data-modality", "fallback");
  await w.getByRole("button", { name: "Sing it after all" }).click();
  await expect(w.getByRole("button", { name: "Sing", exact: true })).toBeVisible();
});
