// Wave 5 review (review:journey): the new answer widgets and the minor ear steps as the learner meets them, with
// every way to get stuck tried. Defect found and fixed: U10.L03 S2 "Do, me or sol?" offered all seven minor degrees
// instead of its three (lesson/model.ts `withTrialMode` widened every pad whose drawn trial carried a key, not only a
// pad authored for another mode; U03's three-degree pads over major trials grew the same way). And, with no defect:
//  - the form strip answered with other letters (C C C for A A A) reads as the same form and passes;
//  - a minor loop numbered in upper case (I VI VII I, by M on the palette) fails, names the bars, and the hints and
//    "Show the answer" are a way on;
//  - the scale builder given all seven notes of G major for the pentatonic fails, then the answer can be shown;
//  - "Straight or swung?" answered wrong five times in a row: the same honest line each time, never a dead end, the
//    answer shown on request and Continue open after it.
import { expect, test } from "@playwright/test";
import { useUiPrefs } from "../support/ui.ts";
import { shootAll, watch } from "./support.ts";
import { openStep, quietHmr, seedPoint, step, tryAgainIfShown } from "./w4-support.ts";
import { checkFor, forgetLesson, noSideScroll, RAW } from "./w5-support.ts";

const trialOf = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    (globalThis as unknown as { __oakLesson: { trial(): unknown } }).__oakLesson.trial(),
  ) as Promise<{ degrees?: string[]; choice?: string[] } | null>;

async function showAnswer(page: import("@playwright/test").Page) {
  const reveal = page.getByTestId("reveal-button");
  await expect(reveal).toBeVisible({ timeout: 20_000 });
  await reveal.click();
  await expect(page.getByTestId("continue")).toBeEnabled({ timeout: 30_000 });
}

test("U10.L03 S2: the pad offers do, me and sol only, answered by keys", async ({ page, request }) => {
  test.setTimeout(120_000);
  await seedPoint(request, "after U10.L05");
  forgetLesson("U10.L03");
  await quietHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const problems = watch(page);
  await openStep(page, "U10.L03", "S2");
  const pad = step(page).locator("[data-degree]");
  await expect(pad).toHaveCount(3);
  expect(await pad.evaluateAll((els) => els.map((e) => e.getAttribute("data-degree")))).toEqual([
    "1",
    "b3",
    "5",
  ]);
  await expect(step(page)).toContainText("me");
  await expect(step(page)).not.toContainText(/\bmi\b/);
  await shootAll(page, "w5-widget-minor-pad");
  const t = await trialOf(page);
  const want = (t?.degrees ?? [])[0] as string;
  await pad.first().focus();
  await page.keyboard.press(want.replace(/^[b#]/, ""));
  expect(await checkFor(page, /pass/)).not.toMatch(RAW);
  expect(problems).toEqual([]);
});

test("U09.L03 S5: the form strip answered C C C reads as A A A and passes, by keys", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await seedPoint(request, "after U09.L04");
  forgetLesson("U09.L03");
  await quietHmr(page);
  await useUiPrefs(page, { theme: "bark" });
  const problems = watch(page);
  await openStep(page, "U09.L03", "S5");
  await step(page)
    .getByRole("button", { name: /^Bars 1–8/ })
    .focus();
  // A letter fills the slot and moves on to the next one.
  for (let i = 0; i < 3; i++) await page.keyboard.press("c");
  await expect(step(page)).toContainText(/Reads as\s*A\s*A\s*A/);
  await shootAll(page, "w5-widget-form-ccc");
  const v = await checkFor(page, /pass/);
  expect(v).not.toMatch(RAW);
  await noSideScroll(page);
  expect(problems).toEqual([]);
});

test("U10.L04 S5: a minor loop numbered in upper case fails, names the bars, and there is a way on", async ({
  page,
  request,
}) => {
  test.setTimeout(150_000);
  await seedPoint(request, "after U10.L05");
  forgetLesson("U10.L04");
  await quietHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const problems = watch(page);
  await openStep(page, "U10.L04", "S5");
  await step(page)
    .getByRole("button", { name: /^Bar 1/ })
    .focus();
  // In A minor the digit gives the key's own chord (1 → i, 6 → VI, 7 → VII); M swaps the case: I and I again.
  await page.keyboard.press("1");
  await page.keyboard.press("m");
  await page.keyboard.press("6");
  await page.keyboard.press("7");
  await page.keyboard.press("1");
  await page.keyboard.press("m");
  await expect(step(page).locator("[data-rn-slot]")).toHaveText(["I", "VI", "VII", "I"]);
  const first = await checkFor(page, /fail/);
  expect(first).toMatch(/Bars 1 and 4/);
  expect(first).not.toMatch(RAW);
  const second = await checkFor(page, /fail/);
  expect(second).not.toMatch(RAW);
  // The hint ladder names what to look at (the first hint states the goal: count each root up from A); the
  // answer can be shown.
  await page.getByTestId("hint").click();
  await expect(page.getByTestId("hint-texts")).toContainText("Count each chord's root up from A");
  await shootAll(page, "w5-widget-rn-upper-case");
  await showAnswer(page);
  expect(problems).toEqual([]);
});

test("U11.L01 S6: seven notes for the pentatonic fail; the answer can be shown", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await seedPoint(request, "U10.CP due");
  forgetLesson("U11.L01");
  await quietHmr(page);
  await useUiPrefs(page, { theme: "bark" });
  const problems = watch(page);
  await openStep(page, "U11.L01", "S6");
  await step(page).getByRole("button", { name: "G 3, home" }).focus();
  for (const k of ["a", "s", "d", "f", "g", "h", "j"]) await page.keyboard.press(k);
  await expect(step(page)).toContainText(/Your scale:.*F♯/);
  for (let i = 0; i < 2; i++) expect(await checkFor(page, /fail/)).not.toMatch(RAW);
  await page.getByTestId("hint").click();
  // The first hint says what to do: start from all seven notes of G major and take two away.
  await expect(page.getByTestId("hint-texts")).toContainText("take two of them away");
  await shootAll(page, "w5-widget-scale-seven");
  await showAnswer(page);
  expect(problems).toEqual([]);
});

test("U11.L07 S6: straight or swung answered wrong five times: never a dead end", async ({
  page,
  request,
}) => {
  test.setTimeout(150_000);
  await seedPoint(request, "after U11.L06");
  await quietHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const problems = watch(page);
  await openStep(page, "U11.L07", "S6");
  const t = await trialOf(page);
  const right = (t?.choice ?? [])[0] as string;
  expect(right).toMatch(/straight|swung/);
  const wrong = right === "swung" ? "straight" : "swung";
  for (let i = 0; i < 5; i++) {
    await tryAgainIfShown(page);
    await step(page).locator(`[data-option="${wrong}"]`).click();
    const v = await checkFor(page, /fail/);
    expect(v).not.toMatch(RAW);
    expect(v).not.toMatch(/triplet/i);
  }
  await expect(page.getByTestId("hint")).toBeVisible();
  await shootAll(page, "w5-widget-swing-five-wrong");
  await showAnswer(page);
  expect(problems).toEqual([]);
});

test("U11.CP chart the blues: the given bar shows I7, the chart plays in F, sevenths by keys", async ({
  page,
  request,
}) => {
  test.setTimeout(150_000);
  await seedPoint(request, "U11.CP due");
  await quietHmr(page);
  await useUiPrefs(page, { theme: "paper" });
  const problems = watch(page);
  await page.goto("/checkpoint/U11");
  await expect(page.getByTestId("checkpoint-intro")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("start-checkpoint").click();
  const uiNow = () =>
    page.evaluate(
      () =>
        (
          globalThis as unknown as {
            __oakCheckpoint: { exercise(): { answer?: { ui?: string } } | null };
          }
        ).__oakCheckpoint.exercise()?.answer?.ui ?? null,
    );
  for (let i = 0; i < 12; i++) {
    await expect(step(page)).toBeVisible({ timeout: 30_000 });
    if ((await uiNow()) === "bar-grid") break;
    await page.getByTestId("skip-item").click();
  }
  expect(await uiNow()).toBe("bar-grid");
  // The given bar is printed filled, with its chord in F; the chart can be played (the step's key is known).
  const s = step(page);
  await expect(s).toContainText(/1\s*I7\s*·\s*F7/);
  await expect(s).not.toContainText("Playback needs the step's key");
  await expect(s.getByRole("button", { name: /Play the chart/ })).toBeVisible();
  // Sevenths by keys: the quality control set to 7, then the degrees of bars 2–12 (the quick change).
  await s.getByRole("radio", { name: "7" }).click();
  await s.locator("[data-bar]").nth(1).focus();
  for (const d of ["4", "1", "1", "4", "4", "1", "1", "5", "4", "1", "5"]) await page.keyboard.press(d);
  await expect(s).toContainText(/2\s*IV7\s*·\s*B♭7/);
  await expect(s).toContainText(/12\s*V7\s*·\s*C7/);
  await shootAll(page, "w5-widget-bar-grid-blues");
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "saved", {
    timeout: 20_000,
  });
  expect(problems).toEqual([]);
});
