// Wave 5 stage E sets inside real session days (contracts §7.3–§7.4, §9.1), each from a wave5.md §6 seed on the real
// planner (nothing filled or patched): a U08 day whose warm-up opens the bass-and-kick set (does the bass lock with
// the kick?); a U10 day whose warm-up opens the minor degrees, the way home sung on Chromium's fake microphone, and
// the same day in Quiet mode (the mic never opens, the way home is heard and imagined); a U11 gym day whose warm-up
// opens the twelve-bar position set; a U11 day whose warm-up opens straight or swung. Each set is the family's first
// (its blocked intro: the listening first, then the trials), answered with the keyboard, read back from the wire with
// the warm-up item it belongs to; then the session goes on.
import { expect, type Page, test } from "@playwright/test";
import { shoot, useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { api, blockHmr, expectNoOverflow, SHOTS, seed, settle } from "./support.ts";
import { watch } from "./w5-helpers.ts";
import {
  answerChoice,
  countMic,
  finishSet,
  frameMatrix,
  nextTrial,
  startDay,
  warmState as state,
  toFamily,
  totalOf,
  trialNo,
  wire,
} from "./warmup-helpers.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  await blockHmr(page);
});

test("a U08 day: the bass-and-kick set opens in the warm-up, answered by key, then the day goes on", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const sent = wire(page);
  // The day after U08.L04 opens the set it taught; since Oak 2.0 W2 that day is U08.L06 (Bass and Kick as One Line).
  const s = await seed(request, "after U08.L04");
  expect(s.next).toBe("U08.L06");
  await useUiPrefs(page, { theme: "paper" });
  await startDay(page, "U08.L06");
  const item = await toFamily(page, "fam.rhy.groove-lock", {
    hear: true,
    shot: "w5-warmup-intro-rhy.groove-lock",
  });
  const before = (await state(page)).warmupIndex;
  const total = await totalOf(page);
  expect(total).toBe(item.trials);
  for (let i = 0; i < total; i++) {
    const t = await trialNo(page, i + 1, total);
    // The U08.L04 level: locked with the kick, or a bass with its own rhythm.
    expect(t.params.options).toEqual(["locked", "independent"]);
    if (i === 0) {
      await expect(page.getByTestId("trial-prompt")).toHaveText("Does the bass lock with the kick?");
      await expect(page.getByRole("radio", { name: /Locked with the kick/ })).toBeVisible();
    }
    await answerChoice(page, t, i === 1);
    if (i === 0) {
      // After the answer: the kick and the bass alone, to hear them lock (or not).
      await expect(page.getByTestId("hear-alone")).toHaveText(/Kick and bass/);
      await frameMatrix(page, "w5-warmup-groove-lock");
    }
    await nextTrial(page);
  }
  await finishSet(page, before, "w5-warmup-groove-lock-summary");
  const start = sent.starts.find((b) => b.warmupItemId === item.id);
  expect(start).toMatchObject({ sessionId: (await state(page)).session?.id });
  expect(sent.trials.size).toBe(total);
  expect(sent.trials.get(1)?.correct).toBe(false);
  for (const r of sent.trials.values()) expect(r.familyId).toBe("fam.rhy.groove-lock");
  expect(problems).toEqual([]);
});

/** Plays the minor-degree set; returns how many trials sang (or heard) the way home. */
async function minorSet(page: Page, quiet: boolean): Promise<{ resolved: number; total: number }> {
  const total = await totalOf(page);
  let resolved = 0;
  for (let i = 0; i < total; i++) {
    const t = await trialNo(page, i + 1, total);
    expect((t.params.key as { mode: string }).mode).toMatch(/minor/);
    const want = (t.expected.degrees ?? [])[0] as string;
    if (i === 0) {
      await expect(page.getByTestId("trial-prompt")).toHaveText(
        "After the minor cadence: which degree was the last note?",
      );
      // Do-based minor (contracts §8): the pad names ♭3 me, never 3 mi.
      const pad = page.getByRole("group", { name: "Your answer: which degree?" });
      await expect(pad.getByRole("radio", { name: "flat 3, me" })).toHaveCount(1);
      await expect(pad.getByRole("radio", { name: "3, mi" })).toHaveCount(0);
    }
    await page.keyboard.press(want.replace(/^[b#]/, ""));
    const feedback = page.getByTestId("trial-feedback");
    await expect(feedback).toHaveAttribute("data-correct", "true");
    const next = page.getByTestId("next-trial");
    const label = (await next.textContent()) ?? "";
    if (!quiet && label.includes("Sing it home")) {
      resolved++;
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("pitch-lane")).toBeVisible();
      await expect(feedback).toContainText(/Sung home|Sung\. The trace|Singing skipped/, { timeout: 30_000 });
      const home = page.getByTestId("way-home");
      await expect(home).toContainText(`The way home: ${want.replace(/^b/, "♭")}`);
      if (want === "b3") await expect(home).toContainText("me");
      if (resolved === 1) await frameMatrix(page, "w5-warmup-minor-sung");
    } else if (quiet && label.includes("Hear it home")) {
      resolved++;
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("quiet-resolution")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("way-home")).toBeVisible();
      if (resolved === 1) {
        await settle(page);
        await expectNoOverflow(page);
        await shoot(page, SHOTS, "w5-warmup-minor-quiet", "bark");
      }
      await page.keyboard.press("Space");
      await expect(feedback).toContainText("Heard home, in your head.");
    }
    await nextTrial(page);
  }
  return { resolved, total };
}

test("a U10 day: the minor degrees open in the warm-up, the way home sung on the mic (do-based)", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const sent = wire(page);
  const micAsked = await countMic(page);
  const s = await seed(request, "after U10.L03");
  expect(s.next).toBe("U10.L04");
  await useUiPrefs(page, { theme: "paper" });
  await startDay(page, "U10.L04");
  const item = await toFamily(page, "fam.deg.fet-minor", { shot: "w5-warmup-intro-deg.fet-minor" });
  const before = (await state(page)).warmupIndex;
  const { resolved, total } = await minorSet(page, false);
  expect(total).toBe(item.trials);
  expect(resolved).toBeGreaterThan(0);
  await finishSet(page, before, "w5-warmup-minor-summary");
  expect(micAsked()).toBeGreaterThan(0);
  expect(sent.trials.size).toBe(total);
  const sung = [...sent.trials.values()].filter((r) => r.sungResolution);
  expect(sung).toHaveLength(resolved);
  for (const r of sung) {
    expect(r.sungResolution).toMatchObject({ quiet: false });
    expect(r.sungResolution?.path.at(-1)).toBe("1");
  }
  for (const r of sent.trials.values()) expect(r.familyId).toBe("fam.deg.fet-minor");
  expect(problems).toEqual([]);
});

test("the same U10 day in Quiet mode: the way home heard and imagined, the mic never opens", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const sent = wire(page);
  const micAsked = await countMic(page);
  await seed(request, "after U10.L03");
  await api(request, "PUT", "/api/voice/quiet", { quiet: true, scope: "today" });
  await useUiPrefs(page, { theme: "bark" });
  await startDay(page, "U10.L04");
  const item = await toFamily(page, "fam.deg.fet-minor", { shot: "w5-warmup-intro-deg.fet-minor" });
  const before = (await state(page)).warmupIndex;
  const { resolved, total } = await minorSet(page, true);
  expect(total).toBe(item.trials);
  expect(resolved).toBeGreaterThan(0);
  await finishSet(page, before, "w5-warmup-minor-quiet-summary");
  expect(micAsked()).toBe(0);
  const quiet = [...sent.trials.values()].filter((r) => r.sungResolution);
  expect(quiet).toHaveLength(resolved);
  for (const r of quiet) expect(r.sungResolution).toMatchObject({ quiet: true, notes: [], credit: 0 });
  // Nothing reads as a failure in Quiet mode.
  await expect(page.locator("main")).not.toContainText(/failed|missed the sing/i);
  expect(problems).toEqual([]);
});

test("a U11 gym day: the twelve-bar position set opens in the warm-up; the chart lights the bar that sounds", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const sent = wire(page);
  const s = await seed(request, "after U11.L05");
  expect(s.next).toBe("GYM.11");
  await useUiPrefs(page, { theme: "paper" });
  await startDay(page, "GYM.11");
  const item = await toFamily(page, "fam.frm.blues", { shot: "w5-warmup-intro-frm.blues" });
  const before = (await state(page)).warmupIndex;
  const total = await totalOf(page);
  expect(total).toBe(item.trials);
  for (let i = 0; i < total; i++) {
    const t = await trialNo(page, i + 1, total);
    const chart = page.getByTestId("bar-chart");
    await expect(chart).toBeVisible();
    await expect(chart.locator("[data-bar]")).toHaveCount(12);
    if (i === 0) {
      await expect(page.getByTestId("trial-prompt")).toHaveText(/^Which chord plays in bar \d+\?$/);
      await expect(chart.locator("[data-playing]")).toHaveCount(1, { timeout: 15_000 });
    }
    await answerChoice(page, t);
    // The numerals of the form after the answer, read in the blues key: bar 5 is IV7, bar 9 is V7 (never V7/IV).
    await expect(chart.locator('[data-bar="5"]')).toHaveAttribute("aria-label", /IV⁷|IV7/);
    await expect(chart.locator('[data-bar="9"]')).toHaveAttribute("aria-label", /V⁷|V7/);
    await expect(chart).not.toContainText("V7/IV");
    if (i === 0) await frameMatrix(page, "w5-warmup-twelve-bars");
    await nextTrial(page);
  }
  await finishSet(page, before, "w5-warmup-twelve-bars-summary");
  expect(sent.trials.size).toBe(total);
  for (const r of sent.trials.values()) expect(r).toMatchObject({ familyId: "fam.frm.blues", correct: true });
  expect(problems).toEqual([]);
});

test("a U11 day: straight or swung opens in the warm-up; the hats alone and the other feel after the answer", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const sent = wire(page);
  const s = await seed(request, "after U11.L07");
  expect(s.next).toBe("U11.L08");
  await useUiPrefs(page, { theme: "paper" });
  await startDay(page, "U11.L08");
  const item = await toFamily(page, "fam.rhy.swing", { shot: "w5-warmup-intro-rhy.swing" });
  const before = (await state(page)).warmupIndex;
  const total = await totalOf(page);
  expect(total).toBe(item.trials);
  for (let i = 0; i < total; i++) {
    const t = await trialNo(page, i + 1, total);
    // U11.L07's level: straight or swung (U13's triplet words never appear).
    expect(t.params.options).toEqual(["straight", "swung"]);
    if (i === 0) {
      await expect(page.getByTestId("trial-prompt")).toHaveText("Straight or swung?");
      await expect(page.locator("main")).not.toContainText(/triplet/i);
    }
    await answerChoice(page, t);
    if (i === 0) {
      await expect(page.getByTestId("hear-alone")).toHaveText(/Hats alone/);
      await expect(page.getByTestId("hear-other")).toHaveText(
        t.expected.choice?.[0] === "straight" ? /Hear it swung/ : /Hear it straight/,
      );
      await page.keyboard.press("o");
      await expect(page.getByTestId("stage-text")).toHaveText("Playing…");
      await frameMatrix(page, "w5-warmup-swing");
    }
    await nextTrial(page);
  }
  await finishSet(page, before, "w5-warmup-swing-summary");
  expect(sent.trials.size).toBe(total);
  for (const r of sent.trials.values()) expect(r).toMatchObject({ familyId: "fam.rhy.swing", correct: true });
  expect(problems).toEqual([]);
});
