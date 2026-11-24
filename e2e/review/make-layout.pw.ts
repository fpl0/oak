// Regressions on U00.L02's Make ("Change the highlighted number so the tune ends on the note that feels like
// home"): the four-bar loop ran and showed as ONE bar ("1.1 / 1", "Loop bar 1"), so the last bar, where the tune
// lands, was never on screen; and the editor sat beside the roll, cutting the ~90-character lines off, the
// highlighted number with them; and nothing was highlighted at all (the starter's marked spot was dropped). Now the
// Make loops its own four bars, the code has the full width, and the number to change has its target box.
import { expect, test } from "@playwright/test";
import u00l02 from "../../content/core/U00/L02/lesson.ts";
import u01l01 from "../../content/core/U01/L01/lesson.ts";
import { walkLesson } from "../journey/lesson-walk.ts";
import { SCREENSHOT_MATRIX } from "../support/stack.ts";
import { useUiPrefs } from "../support/ui.ts";
import { noHmr, openToday, resetClock, reviewMic, seed, shootAll, watch } from "./support.ts";

test.use({ launchOptions: { args: reviewMic("hold-c4.wav") }, permissions: ["microphone"] });

const SING = { S5: { sung: [{ midi: 60, cents: 0, credit: 1 }] } };

test("the first Make shows all four bars and every line of its code", async ({ page, request }) => {
  await resetClock(request);
  await seed(request, "onboarded");
  await noHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const problems = watch(page);
  await openToday(page);
  await page.getByTestId("start-session").click();
  await walkLesson(page, u00l02, { stopAt: "S6", answers: SING });
  const wb = page.getByTestId("workbench").first();
  await expect(wb).toContainText("/ 4");
  await expect(wb).not.toContainText("Loop bar 1 ");
  for (const size of [
    ...SCREENSHOT_MATRIX.map((m) => ({ width: m.width, height: m.height })),
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(200);
    const clipped = await page.evaluate(() => {
      const sc = document.querySelector<HTMLElement>('[data-testid="workbench"] .cm-scroller');
      return sc ? sc.scrollWidth - sc.clientWidth : -1;
    });
    expect(clipped, `editor clips its lines at ${size.width}×${size.height}`).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await shootAll(page, "make-u00l02");
  expect(problems).toEqual([]);
});

test("a short-code Make keeps the side-by-side layout", async ({ page, request }) => {
  await resetClock(request);
  await seed(request, "after U00.L02");
  await noHmr(page);
  await page.goto("/learn/U01.L01?step=S8");
  await expect(page.getByTestId("lesson-step")).toHaveAttribute("data-step", "S8", { timeout: 60_000 });
  await expect(page.locator(".oak-workbench--full")).toHaveCount(1);
  // U01.L01's Make plays inside the unit song (spec 2026-11-24-unit-songs-design.md §5.3): the transport counts the
  // whole song (37 bars) and starts looping today's section, the 4-bar opening. "Today's code" plays the Make alone,
  // and the transport counts its own two bars again.
  const wb = page.getByTestId("workbench").first();
  await expect(wb).toContainText("/ 37");
  await expect(wb).toHaveAttribute("data-loop", "1-4");
  await page.getByRole("radio", { name: "Today's code" }).click();
  await expect(wb).toContainText("/ 2");
  await expect(page.locator(".oak-workbench--full")).toHaveCount(1);
  void u01l01;
});
