// Oak 2.0 W1 (S4 plain sounds and listen-through, S7 commit sounds) against the real server: plain sounds say so
// and leave the code alone; listen-through runs on the master bus and asks while on for an illusion heard, which
// "Add to code" writes after the tempo line; a committed line's sound change is noticed and put back; leaving the
// sketch turns both listening modes off. Run at the wave gate only (Task 9 Step B6).
import { expect, type Page, test } from "@playwright/test";
import { api, createSketch, openSketch, unlockFirstLessons, WB } from "./helpers.ts";

// `COMMIT_COPY` in app/src/studio/commit.ts (written out: the spec does not load app modules).
const PLAIN_ON = "Plain sounds: you hear one plain sound per part. Your code is unchanged.";
const HEARD_PROMPT =
  "Listen for something that seems to be there but isn't in the code: a note, a rhythm. Write it down, then try to make it real.";

const CODE = [
  "setcpm(90/4)",
  "",
  'drums: s("bd hh sd hh")',
  'bass: note("c2 ~ g2 ~").s("triangle").lpf(600)',
  "",
].join("\n");

const editorText = (page: Page) => page.locator(".cm-content").textContent();
// `null` (off) must come back as `null`: `?? "no-oak"` would turn it into "no-oak".
const listenThrough = (page: Page) =>
  page.evaluate(() => {
    const oak = (globalThis as { __oakStrudel?: { master: { listenThrough(): string | null } } })
      .__oakStrudel;
    return oak === undefined ? "no-oak" : oak.master.listenThrough();
  });

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await page.close();
});

test("plain sounds, listen-through and commit sounds", async ({ page }) => {
  const id = await createSketch(page, "Sound tools", CODE);
  await openSketch(page, id);
  const tools = page.getByTestId("sound-tools");
  await expect(tools).toBeVisible();

  // Plain sounds: the line shows, the code does not change.
  const before = await editorText(page);
  await tools.getByRole("switch", { name: "Plain sounds" }).click();
  await expect(page.getByTestId("plain-sounds-on")).toHaveText(PLAIN_ON);
  expect(await editorText(page)).toBe(before);
  await tools.getByRole("switch", { name: "Plain sounds" }).click();
  await expect(page.getByTestId("plain-sounds-on")).toHaveCount(0);

  // Listen through → Muffled, then Off: the prompt; "Add to code" writes after the tempo line.
  await page.getByTestId("listen-through").selectOption("muffled");
  await expect(page.getByTestId("listen-through-on")).toContainText("Muffled");
  await expect.poll(() => listenThrough(page)).toBe("muffled");
  await expect(page.getByTestId("heard-prompt")).toContainText(HEARD_PROMPT);
  expect(await editorText(page)).toBe(before);
  await page.getByTestId("listen-through").selectOption("off");
  await expect.poll(() => listenThrough(page)).toBe(null);
  const prompt = page.getByTestId("heard-prompt");
  await expect(prompt).toContainText(HEARD_PROMPT);
  await page.getByTestId("heard-field").fill("the hats almost vanish");
  await prompt.getByRole("button", { name: "Add to code" }).click();
  await expect(page.locator(".cm-line").nth(0)).toHaveText("setcpm(90/4)");
  await expect(page.locator(".cm-line").nth(1)).toHaveText("// heard (muffled): the hats almost vanish");

  // Commit sounds of bass, then change its sound: CommitGuard asks; Put it back restores .lpf(600).
  await page.locator(".cm-line", { hasText: "bass:" }).click();
  await tools.getByTestId("commit-sounds").click();
  await expect(tools.getByTestId("commit-state")).toContainText("Committed");
  await expect
    .poll(
      async () =>
        (await api<{ committed?: { label: string }[] }>(page, "GET", `/sketches/${id}`)).body.committed,
    )
    .toEqual([expect.objectContaining({ label: "bass", version: 1 })]);
  await page.locator(".cm-line", { hasText: "bass:" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("900");
  await expect(page.locator(".cm-line", { hasText: "bass:" })).toContainText(".lpf(900)");
  const guard = page.getByTestId("commit-guard");
  await expect(guard).toContainText("You changed the sound of bass, which you committed in v1.");
  await guard.getByTestId("commit-put-back").click();
  await expect(page.locator(".cm-line", { hasText: "bass:" })).toHaveText(
    'bass: note("c2 ~ g2 ~").s("triangle").lpf(600)',
  );
  await expect(guard).toHaveCount(0);

  // Leaving the sketch and returning: plain sounds and listen-through are off.
  await tools.getByRole("switch", { name: "Plain sounds" }).click();
  await page.getByTestId("listen-through").selectOption("quiet");
  await expect.poll(() => listenThrough(page)).toBe("quiet");
  // In-app navigation (no reload): the same audio context, so "off" is the slot's own cleanup.
  await page.locator("header").getByRole("link", { name: "Studio", exact: true }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect.poll(() => listenThrough(page)).toBe(null);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/studio/${id}$`));
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("sound-tools").getByRole("switch", { name: "Plain sounds" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(page.getByTestId("plain-sounds-on")).toHaveCount(0);
  await expect(page.getByTestId("listen-through")).toHaveValue("off");
  await expect(page.getByTestId("listen-through-on")).toHaveCount(0);
  expect(await listenThrough(page)).toBe(null);
});
