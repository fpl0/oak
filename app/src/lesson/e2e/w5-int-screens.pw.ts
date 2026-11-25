// Wave 5 integration surfaces in Paper and Bark at 1440×900 and 1280×800 (wave5.md §10 item 4), on the real
// lesson U09.L01 from its seed: a tap step's verdict after tapping every beat (one finding said once with how many
// taps, not 24 identical lines), "which bar?" on the bar buttons after a wrong bar, and the lesson's end, which
// names what opens by title. No horizontal overflow; Check and Continue on screen with the tutor drawer closed.
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot } from "../../../../e2e/support/ui.ts";
import { expect, submit, test } from "./support.ts";
import { noOverflow, onScreen, reseedFresh, seed, setQuiet } from "./w3support.ts";
import { lessonDefW5 } from "./w5walk.ts";
import { answerWidget, type PartLike, walkLesson } from "./walk.ts";

test.describe.configure({ mode: "serial" });
test.afterAll(async ({ request }) => {
  await reseedFresh(request);
});

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));

/** The same screen in every cell of the matrix: the theme switched in place, the viewport resized. */
async function matrix(page: Page, name: string, visible: readonly string[]) {
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    // A resize keeps the step column's scroll: bring the verdict back as a check would.
    await page
      .getByTestId(visible[0] as string)
      .first()
      .scrollIntoViewIfNeeded();
    await noOverflow(page);
    for (const id of visible) await onScreen(page, id);
    await shoot(page, SHOTS, name, m.theme);
  }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "paper";
  });
  await page.setViewportSize({ width: 1440, height: 900 });
}

test("U09.L01: the tap verdict, the bar buttons and the end, in both themes and sizes", async ({ page }) => {
  test.setTimeout(150_000);
  await seed(page, "after U08.L05");
  await setQuiet(page, false);
  const def = await lessonDefW5("U09.L01");
  await page.goto("/learn/U09.L01");
  await walkLesson(page, def, { lessonId: "U09.L01", mic: false, quiet: false, until: "S4" });

  // S4: a tap on every beat where the step asks for beat 1 of each bar.
  const s4 = def.steps.find((s) => s.id === "S4")?.exercise as PartLike;
  const every = s4.tests.find((t) => t.name === "on every beat");
  expect((await submit(page, every?.response))?.status).toBe("fail");
  const fb = page.getByTestId("step-feedback");
  await expect(fb).toHaveAttribute("data-status", "fail");
  await expect(page.getByTestId("step-feedback-summary")).toContainText("Not in time yet");
  const lines = page.getByTestId("feedback-line");
  expect(await lines.count(), "one line per finding, not one per tap").toBeLessThanOrEqual(3);
  await expect(lines.first()).toContainText(/\(\d+ taps\)/);
  await expect(fb).not.toContainText("Somewhere in the piece");
  await matrix(page, "w5-int-tap-verdict", ["step-feedback", "continue"]);

  // On to S6: the bar buttons, a wrong bar checked.
  await walkLesson(page, def, { lessonId: "U09.L01", mic: false, quiet: false, from: "S4", until: "S6" });
  const s6 = def.steps.find((s) => s.id === "S6")?.exercise as PartLike;
  const wrong = s6.tests.find((t) => t.expect === "fail");
  expect(await answerWidget(page, s6, wrong?.response ?? {})).toBe(true);
  await page.getByTestId("check").click();
  await expect(fb).toHaveAttribute("data-status", "fail", { timeout: 30_000 });
  await expect(page.getByRole("radio", { name: "Bar 5", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await matrix(page, "w5-int-bar-buttons", ["result-retry", "continue"]);
  // The verdict locks the bars until Try again (docs/design/retry.md §2.5); then the digit picks a bar.
  await page.getByTestId("lesson-step").getByTestId("result-retry").click();
  await page.getByRole("radio", { name: "Bar 5", exact: true }).focus();
  await page.keyboard.press("9");
  await expect(page.getByRole("radio", { name: "Bar 9", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByTestId("check").click();
  await expect(fb).toHaveAttribute("data-status", "pass", { timeout: 30_000 });
  await page.getByTestId("continue").click();

  // The Make and the end: what opens is named by title.
  await walkLesson(page, def, { lessonId: "U09.L01", mic: false, quiet: false, from: "S7" });
  const done = page.getByTestId("lesson-complete");
  await expect(done).toBeVisible();
  await expect(done).not.toContainText(/\b(U\d\d|A\d)\.(L\d\d|CP)\b/);
  await matrix(page, "w5-int-complete", ["back-to-today"]);
});
