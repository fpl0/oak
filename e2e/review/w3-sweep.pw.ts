// Wave 3 review, layout sweep: every step of U03 and U04 opened at the smallest window the review tries
// (1280×720, Bark) and at 1440×900 (Paper), with every lens on: no horizontal overflow, the step's primary
// action (Check or Continue) on screen without scrolling, and no console errors. Each lesson is its own test
// from one dev seed (every lesson done), so no test comes near the 4-minute limit.
// Test speed (cut:review): one page load per size; the lesson is loaded at that size on its first step, then
// every later step is reached in place with the player's own "next completed step" key (Alt+→), as a learner
// looking back through a lesson would, and measured once the page has settled (fonts, no busy region, no request
// in flight, two frames) instead of after a fixed 400 ms.
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { LessonDef } from "@oak/content-kit";
import { expect, test } from "@playwright/test";
import { REPO_ROOT } from "../support/stack.ts";
import { useUiPrefs } from "../support/ui.ts";
import { api, inFlight, noHmr, resetClock, seed, settled, snap, watch } from "./support.ts";

const LESSONS: string[] = [];
for (const unit of ["U03", "U04"]) {
  const dir = resolve(REPO_ROOT, "content/core", unit);
  for (const l of readdirSync(dir)
    .filter((d) => /^L\d\d$/.test(d))
    .sort())
    LESSONS.push(`${unit}.${l}`);
}

const SIZES = [
  { width: 1280, height: 720, theme: "bark" },
  { width: 1440, height: 900, theme: "paper" },
] as const;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  await resetClock(request);
  await seed(request, "U04.CP due");
  await api(request, "PUT", "/api/settings/lenses", {
    value: { degrees: true, solfege: true, noteNames: true },
  });
});

for (const id of LESSONS) {
  test(`${id}: every step fits 1280×720 and 1440×900`, async ({ page }) => {
    test.setTimeout(180_000);
    const [unit, l] = id.split(".") as [string, string];
    const def = (
      (await import(resolve(REPO_ROOT, "content/core", unit, l, "lesson.ts"))) as { default: LessonDef }
    ).default;
    await noHmr(page);
    await useUiPrefs(page, { theme: "bark" });
    const problems = watch(page);
    const requests = inFlight(page);
    const lessonStep = page.getByTestId("lesson-step");
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const [i, step] of def.steps.entries()) {
        if (i === 0) await page.goto(`/learn/${id}?step=${step.id}`);
        else {
          // The player's "next completed step" (every step of a done lesson is reachable); never from a field.
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await page.keyboard.press("Alt+ArrowRight");
        }
        await expect(lessonStep).toHaveAttribute("data-step", step.id, { timeout: 60_000 });
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, size.theme);
        await settled(page, requests);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        await snap(page, `w3-sweep-${id}-${step.id}-${size.width}x${size.height}`);
        expect(overflow, `${id} ${step.id} overflows at ${size.width}`).toBeLessThanOrEqual(0);
        const primary = page
          .getByTestId("continue")
          .or(page.getByRole("button", { name: /Save sketch|Save into your song/ }))
          .first();
        await expect(
          primary,
          `${id} ${step.id}: Continue on screen at ${size.width}×${size.height}`,
        ).toBeInViewport();
      }
    }
    expect(problems).toEqual([]);
  });
}
