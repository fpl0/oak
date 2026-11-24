// Wave 3 journey (e): U04.L04 "Interval Ear Lab" as a real daily session from the "after U04.L03" seed. Its
// passive-listen blocks are played (pairs named as they sound, nothing marked), its harmonic step ("Pairs together":
// two notes at once) is answered on the interval pad, and the Make is saved. Then the ear lab's passive block in
// Practice: the interval family's listening run, opened with L, names each pair and needs no answer.
import { expect, test } from "@playwright/test";
import { fakeMic } from "../../app/src/onboarding/e2e/helpers.ts";
import u04l04 from "../../content/core/U04/L04/lesson.ts";
import { useUiPrefs } from "../support/ui.ts";
import { lessonDay } from "./day.ts";
import { api, expectClean, noHmr, resetClock, seed, shootAll, watch } from "./support.ts";

test.use({ launchOptions: { args: fakeMic("voice.wav") }, permissions: ["microphone"] });

test("U04.L04 as a daily session: named pairs, a harmonic interval step, then the ear lab's passive block", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  await resetClock(request);
  await seed(request, "after U04.L03");
  await noHmr(page);
  await useUiPrefs(page, { theme: "bark" });
  const w = watch(page);

  let sawTogether = false;
  await lessonDay(page, request, u04l04, {
    unlocks: "auto",
    warmupSets: 0,
    makeTitle: "Interval ear lab make",
    before: async (step) => {
      if (step.id === "S1") {
        // Before it plays, the block says what it is: nothing to answer, nothing marked.
        await expect(page.getByTestId("passive")).toContainText("Nothing here is marked.");
      }
      if (step.id !== "S6") return;
      // "Pairs together": both notes at once. The interval pad is the answer; the walker answers the drawn pair.
      await expect(page.getByTestId("step-title")).toHaveText("Pairs together");
      await expect(page.getByTestId("lesson-step").getByRole("group").first()).toBeVisible();
      const trial = await page.evaluate(() =>
        (globalThis as unknown as { __oakLesson: { trial(): unknown } }).__oakLesson.trial(),
      );
      expect(trial).not.toBeNull();
      await shootAll(page, "w3-u04-together");
      sawTogether = true;
    },
  });
  expect(sawTogether).toBe(true);
  const progress = await api<{ lessons: { lessonId: string; status: string }[] }>(
    request,
    "GET",
    "/api/lessons/progress",
  );
  expect(progress.lessons.find((l) => l.lessonId === "U04.L04")?.status).toBe("completed");

  // The ear lab: the interval family's page in Practice; L opens its passive listening run.
  await page.goto("/practice/fam.int.in-key");
  await expect(page.getByTestId("start-set")).toBeFocused({ timeout: 60_000 });
  await page.keyboard.press("l");
  const block = page.getByTestId("passive-listen");
  await expect(block).toBeVisible({ timeout: 30_000 });
  await expect(block).toContainText("Nothing here is scored.");
  await expect(page.getByTestId("passive-caption")).toHaveText(/\S/, { timeout: 30_000 });
  await shootAll(page, "w3-earlab-passive");
  await page.getByTestId("passive-continue").click();
  await expect(block).toBeHidden({ timeout: 30_000 });
  expectClean(w);
});
