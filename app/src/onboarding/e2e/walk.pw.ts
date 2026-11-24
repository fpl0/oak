// The learner's report, as a walk (docs/design/retry.md §6): from the reaction to Today with a microphone, from
// the keyboard alone (focus moves where Enter goes on; Alt+R is Try again; Esc stops a take). Every judged step has
// "Try again" after its result and nothing moves on by itself: the reaction takes a second number and keeps it, the
// first sung note is stopped early (a missed take), sung again (accepted) and sung a third time as practice, and
// only Continue moves on. Reloads in the middle of the microphone, the timing and the first note come back to the
// same step with nothing lost. The header says where the learner is ("Step 8 of 13 · Microphone · 3 of 3: …").
import { expect, test } from "@playwright/test";
import { useUiPrefs } from "../../../../e2e/support/ui.ts";
import {
  expectStep,
  fakeMic,
  fromTheReaction,
  noHmr,
  partContinue,
  partRetry,
  position,
  reactContinue,
  resetData,
  shootAll,
  tapAlong,
  watchErrors,
} from "./helpers.ts";
import { stack } from "./playwright.config.ts";

test.use({ launchOptions: { args: fakeMic("voice.wav") }, reducedMotion: "reduce" });
test.beforeEach(async ({ request }) => resetData(request, stack.apiURL));

const H = { "x-oak": "1" };

test("with a microphone, keyboard only: every result can be tried again, and only Continue moves on", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  await noHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const problems = watchErrors(page);
  await fromTheReaction(page, request, stack.apiURL, 6);

  // --- the reaction: Try again puts the cursor on the box; the number that runs last is the learner's ---------
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What you changed");
  await expect(position(page)).toHaveText("Step 4 of 13 · What you changed");
  await expect(page.getByTestId("react-reaction")).toBeVisible();
  await expect(reactContinue(page)).toBeFocused();
  await page.keyboard.press("Alt+KeyR");
  await expect(page.locator(".cm-content")).toBeFocused();
  await page.keyboard.type("0");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("0 plays C, the note the loop calls home")).toBeVisible();
  await expect(page.locator(".oak-mark-target")).toHaveText("0");
  // The new number is a new result: Continue has the focus again (it was left in the code, 19 Tabs away).
  await expect(reactContinue(page)).toBeFocused();
  await shootAll(page, "w01-react-again");
  await page.keyboard.press("Enter");

  // Every screen's primary has the focus on arrival, so Enter goes on (prefs and the tutor left it on the heading).
  await expectStep(page, "prefs");
  await expect(page.getByTestId("prefs-continue")).toBeFocused();
  await page.keyboard.press("Enter");
  await expectStep(page, "tutor");
  await expect(page.getByTestId("tutor-ready")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("tutor-continue")).toBeFocused();
  await page.keyboard.press("Enter");

  // --- headphones: the ear test, answered, then taken again -------------------------------------------------
  await expectStep(page, "headphones");
  await expect(page.getByTestId("lr-play")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("lr-left")).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press("Enter");
  await expect(partContinue(page)).toBeFocused();
  await expect(partRetry(page)).toBeVisible();
  // Answered: Continue is the way on; "Set up later" beside it would throw the answer away.
  await expect(page.getByTestId("part-skip")).toHaveCount(0);
  await page.keyboard.press("Enter");

  // --- the microphone: three sub-steps, each with Try again; a reload resumes at the first one not measured ----
  await expectStep(page, "mic");
  await expect(position(page)).toHaveText("Step 8 of 13 · Microphone · 1 of 3: permission");
  await expect(page.getByTestId("mic-allow")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Oak can hear you.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(partContinue(page)).toBeEnabled();
  await expect(partContinue(page)).toBeFocused();
  // A working mic: "Set up later" (Quiet mode) is not offered beside Continue.
  await expect(page.getByTestId("mic-quiet")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(position(page)).toHaveText("Step 8 of 13 · Microphone · 2 of 3: a quiet moment");
  await expect(page.getByTestId("noise-start")).toBeFocused();
  await page.keyboard.press("Enter");
  // While it measures, the focus is on the step's heading, not lost to the page.
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.getByTestId("noise-result")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Your room is quiet enough")).toBeVisible();
  await expect(partContinue(page)).toBeFocused();
  await expect(page.getByTestId("mic-quiet")).toHaveCount(0);
  await shootAll(page, "w02-mic-quiet-result");
  await page.reload();
  await expectStep(page, "mic");
  await expect(position(page)).toHaveText("Step 8 of 13 · Microphone · 3 of 3: speaker check");
  await expect(page.getByTestId("bleed-start")).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("bleed-result")).toBeVisible({ timeout: 15_000 });
  await expect(partContinue(page)).toBeFocused();
  await expect(page.getByTestId("result-line")).toHaveText(
    "A new measurement replaces this one only if it works.",
  );
  await page.keyboard.press("Enter");

  // --- the range ---------------------------------------------------------------------------------------------
  await expectStep(page, "range");
  await expect(page.getByTestId("range-start")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("take-stop")).toBeVisible();
  await expect(page.getByTestId("range-result")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("status").filter({ hasText: "about an octave" })).toBeVisible();
  // A saved range: "Set up later" is gone, Continue is the way on.
  await expect(page.getByTestId("part-skip")).toHaveCount(0);
  await expect(partContinue(page)).toBeFocused();
  await page.keyboard.press("Enter");

  // --- timing: tapping, a reload, Back inside the step, then singing ------------------------------------------
  await expectStep(page, "latency");
  await expect(position(page)).toHaveText("Step 10 of 13 · Timing · 1 of 2: tapping");
  await expect(page.getByTestId("tap-start")).toBeFocused();
  await tapAlong(page);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("tap-result")).toHaveAttribute("data-ok", "1", { timeout: 20_000 });
  await expect(partContinue(page)).toBeFocused();
  await page.reload();
  await expectStep(page, "latency");
  await expect(position(page)).toHaveText("Step 10 of 13 · Timing · 2 of 2: singing", { timeout: 10_000 });
  await page.getByTestId("onb-back").focus();
  await expect(page.getByTestId("onb-back")).toHaveText("Back: Tapping");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("tap-result")).toBeVisible();
  await expect(partRetry(page)).toBeVisible();
  await partContinue(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("sing-start")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("sing-result")).toHaveAttribute("data-ok", "1", { timeout: 20_000 });
  await expect(partContinue(page)).toBeFocused();
  await expect(page.getByTestId("step-status")).toContainText(/Tapping\s*\d+ ms (early|late)/);
  await shootAll(page, "w03-latency-sing-result");
  await page.keyboard.press("Enter");

  // --- the first note: stopped early (missed), sung again (accepted), sung once more as practice --------------
  await expectStep(page, "first-sing");
  await expect(position(page)).toHaveText("Step 11 of 13 · Your first note");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your first note");
  await expect(page.getByTestId("first-sing-start")).toBeFocused();
  await shootAll(page, "w04-first-sing-ready");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("first-sing-status")).toHaveText("Now sing it back.", { timeout: 10_000 });
  await page.keyboard.press("Escape");
  const result = page.getByTestId("first-sing-result");
  await expect(result).toHaveAttribute("data-passed", "0", { timeout: 10_000 });
  // Nothing counts yet: Continue is held, Try again has the focus, and "Set up later" is there.
  await expect(partRetry(page)).toBeFocused();
  await expect(partContinue(page)).toBeDisabled();
  await expect(page.getByTestId("part-skip")).toBeVisible();
  await shootAll(page, "w05-first-sing-missed");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("take-stop")).toBeVisible({ timeout: 10_000 });
  await expect(result).toHaveAttribute("data-passed", "1", { timeout: 25_000 });
  await expect(page.getByText("That note is 1: home.")).toBeVisible();
  // The pass did not move on: Continue has the focus, Try again is beside it, and nothing was cut short. The take
  // that counted is not called practice (the line read "this try does not change your result" under it).
  await expectStep(page, "first-sing");
  await expect(partContinue(page)).toBeFocused();
  await expect(page.getByTestId("result-line")).toHaveCount(0);
  await shootAll(page, "w06-first-sing-passed");
  // Try again pressed ten times before the screen redraws is one take, not ten at once (they closed each other's
  // mic, and the take heard nothing).
  await page.getByTestId("part-actions").evaluate(() => {
    const b = document.querySelector<HTMLButtonElement>(
      '[data-testid="part-actions"] [data-testid="result-retry"]',
    );
    for (let i = 0; i < 10; i++) b?.click();
  });
  await expect(page.getByTestId("take-stop")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("first-sing-takes").locator("li")).toHaveCount(3, { timeout: 25_000 });
  await expect(page.getByTestId("first-sing-takes").locator("li").nth(2)).toContainText("Try 3 · practice");
  await expect(page.getByTestId("first-sing-takes").locator("li").nth(2)).toContainText("on the note");
  await expect(page.getByTestId("result-line")).toHaveText("Practice: this try does not change your result.");
  await expect(page.getByTestId("first-sing-takes").locator("li").nth(0)).toContainText("no steady note");
  await expect(partContinue(page)).toBeFocused();
  // Only the first passing take was saved.
  const runs = await (
    await request.get(`${stack.apiURL}/api/profile/calibrations?kind=pitch-match`, { headers: H })
  ).json();
  expect(runs.items.filter((r: { result: { first?: boolean } }) => r.result.first === true)).toHaveLength(1);
  // A reload after the pass: the step opens in its result, Continue and Try again.
  await page.reload();
  await expectStep(page, "first-sing");
  await expect(result).toHaveAttribute("data-passed", "1", { timeout: 10_000 });
  await expect(partRetry(page)).toBeVisible();
  await expect(partContinue(page)).toBeFocused();
  await page.keyboard.press("Enter");

  // --- the sketch and the coda follow the last number run ------------------------------------------------------
  await expectStep(page, "sketch");
  await page.getByTestId("gate-start").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="workbench"]')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("sketch-save").focus();
  await page.keyboard.press("Enter");
  await expectStep(page, "coda");
  await expect(page.getByTestId("coda-rows")).toContainText("You changed the last note to 0");
  await expect(page.getByTestId("coda-rows")).not.toContainText("dBFS");
  await expect(page.getByTestId("onb-back")).toHaveText("Back: Sketch 001");
  await expect(page.getByTestId("coda-done")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  expect(problems).toEqual([]);
});
