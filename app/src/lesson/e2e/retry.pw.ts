// "Try again" in the lesson and checkpoint players (docs/design/retry.md), once per family of answer: a pick
// (keyboard only: wrong, Try again focused, Enter, right, Continue focused, Alt+R, a practice take, Enter goes
// on), a text field, code in the editor, notes on the staff, a tapped take and a sung take (Try again starts the
// new take at once), and a checkpoint item (saved, Try again, saved again, Back, the review's Change). What each
// retry counts for is proven in bun tests (retry.test.ts, retry-kinds.test.ts, checkpoint/retry.test.ts and the
// server's retry tests); here: the row, the lock, the focus and the keys in the real app.
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import u01cp from "../../../../content/core/U01/CP/checkpoint.ts";
import u01l01 from "../../../../content/core/U01/L01/lesson.ts";
import u02l04 from "../../../../content/core/U02/L04/lesson.ts";
import { shoot } from "../../../../e2e/support/ui.ts";
import {
  completeLessons,
  expect,
  resetLessons,
  setCode,
  stepIs,
  submit,
  test,
  trialAnswer,
} from "./support.ts";
import { api, fakeMicSingingC, reseedFresh, seed, setQuiet } from "./w3support.ts";
import { answerWidget, type PartLike } from "./walk.ts";

const PRACTICE = "Practice: this try does not change your result.";
const MAKE_CODE = (
  u01cp.make.tests.find((t) => t.expect === "pass")?.response as { code: string } | undefined
)?.code as string;
const SHOTS = fileURLToPath(new URL("./screenshots/retry", import.meta.url));

/**
 * `OAK_RETRY_SHOTS=1`: the screen as it is now in both themes at 1440×900 and 1280×800, changed in place (no
 * reload), for looking at the row by eye. Off in the suite.
 */
async function matrix(page: Page, name: string): Promise<void> {
  if (process.env.OAK_RETRY_SHOTS !== "1") return;
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? null);
  for (const theme of ["paper", "bark"] as const)
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      if (focused) await page.getByTestId(focused).first().focus();
      await shoot(page, SHOTS, name, theme);
    }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "paper";
  });
}

const step$ = (page: Page) => page.getByTestId("lesson-step");
const retry$ = (page: Page) => step$(page).getByTestId("result-retry");
const feedback$ = (page: Page) => page.getByTestId("step-feedback");
const exOf = (def: { steps: readonly { id: string; exercise?: unknown }[] }, id: string) =>
  def.steps.find((s) => s.id === id)?.exercise as PartLike;
const testOf = (ex: PartLike, expectWhat: "pass" | "fail") =>
  (ex.tests.find((t) => t.expect === expectWhat) as { response: Record<string, unknown> }).response;

// Chromium's fake microphone sings a steady middle C (the sung take); nothing else listens.
test.use({ launchOptions: { args: fakeMicSingingC() } });
test.describe.configure({ mode: "serial" });
test.afterAll(async ({ request }) => {
  await reseedFresh(request);
});

test("a pick, keyboard only: wrong, Try again, right, Alt+R, a practice take, Enter goes on", async ({
  page,
}) => {
  await seed(page, "after U01.L03");
  await page.goto("/learn/U01.L04?step=S7");
  await stepIs(page, "S7");
  const right = (await trialAnswer(page))?.choice?.[0] as string;
  const pad = step$(page).locator("[data-answer]");
  const options = await pad
    .locator("[data-option]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-option")));
  const digit = (id: string) => String(options.indexOf(id) + 1);
  const wrong = options.find((o) => o !== right) as string;
  expect(options.length).toBeGreaterThan(1);

  // Into the pad by Tab alone.
  for (let i = 0; i < 25; i++) {
    if (await pad.evaluate((el) => el.contains(document.activeElement))) break;
    await page.keyboard.press("Tab");
  }
  await expect(pad.locator(":focus")).toHaveCount(1);
  await page.keyboard.press(digit(wrong));
  await page.keyboard.press("ControlOrMeta+Shift+Enter");
  await expect(feedback$(page)).toHaveAttribute("data-status", "fail");
  // The verdict locks the answer; Continue is held, so the focus is on Try again; Enter presses it.
  await expect(pad).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("check")).toHaveCount(0);
  await expect(page.getByTestId("continue")).toBeDisabled();
  await expect(retry$(page)).toBeFocused();
  await expect(retry$(page)).toHaveAttribute("aria-keyshortcuts", "Alt+R");
  await matrix(page, "pick-wrong");
  await page.keyboard.press("Enter");
  await expect(retry$(page)).toHaveCount(0);
  await expect(page.getByTestId("step-feedback")).toHaveCount(0);
  await expect(pad).not.toHaveAttribute("aria-disabled", "true");
  await expect(pad.locator(":focus")).toHaveCount(1);
  await page.keyboard.press(digit(right));
  await page.keyboard.press("ControlOrMeta+Shift+Enter");
  await expect(feedback$(page)).toHaveAttribute("data-status", "pass");
  // Passed: Continue has the focus (Enter goes on) and the next take is practice, said under the row.
  await expect(page.getByTestId("continue")).toBeFocused();
  await expect(page.getByTestId("result-line")).toHaveText(PRACTICE);
  await expect(retry$(page)).toHaveAttribute("aria-describedby", /.+/);
  await matrix(page, "pick-passed");
  await page.keyboard.press("Alt+r");
  await expect(retry$(page)).toHaveCount(0);
  await expect(pad.locator(":focus")).toHaveCount(1);
  await page.keyboard.press(digit(wrong));
  await page.keyboard.press("ControlOrMeta+Shift+Enter");
  await expect(feedback$(page)).toHaveAttribute("data-status", "fail");
  // A practice take never undoes the pass: still passed on the server, Continue open and focused.
  const s7 = await api<{ passed: boolean; attempts: number; practiceNext: boolean }>(
    page,
    "GET",
    "/lessons/U01.L04/steps/S7",
  );
  expect(s7.body).toMatchObject({ passed: true, attempts: 3, practiceNext: true });
  await expect(page.getByTestId("continue")).toBeFocused();
  await page.keyboard.press("Enter");
  await stepIs(page, "S8");
});

test("a text answer and notes on the staff: Try again re-opens them as they were; right then goes on", async ({
  page,
}) => {
  await seed(page, "after U02.L03");
  for (const id of ["S4", "S5"]) {
    const ex = exOf(u02l04, id);
    await page.goto(`/learn/U02.L04?step=${id}`);
    await stepIs(page, id);
    expect(await answerWidget(page, ex, testOf(ex, "fail"))).toBe(true);
    await page.getByTestId("check").click();
    await expect(feedback$(page)).toHaveAttribute("data-status", "fail");
    await expect(step$(page).locator("[data-answer]").first()).toHaveAttribute("aria-disabled", "true");
    await retry$(page).click();
    await expect(step$(page).locator("[data-answer]").first()).not.toHaveAttribute("aria-disabled", "true");
    expect(await answerWidget(page, ex, testOf(ex, "pass"))).toBe(true);
    await page.getByTestId("check").click();
    await expect(feedback$(page)).toHaveAttribute("data-status", "pass");
    await expect(retry$(page)).toBeVisible();
    await expect(page.getByTestId("continue")).toBeFocused();
  }
});

test("code: the editor stays open beside the verdict; Try again focuses it; the next Check is one attempt", async ({
  page,
}) => {
  resetLessons(["U01.L01"]);
  completeLessons(["U00.L01", "U00.L02"]);
  await page.goto("/learn/U01.L01?step=S6");
  await stepIs(page, "S6");
  const ex = exOf(u01l01, "S6");
  await setCode(page, testOf(ex, "fail").code as string);
  await page.getByTestId("check").click();
  await expect(feedback$(page)).toHaveAttribute("data-status", "fail");
  await matrix(page, "code-wrong");
  await retry$(page).click();
  await expect(page.locator(".cm-content").first()).toBeFocused();
  await expect(page.getByTestId("check")).toBeVisible();
  await setCode(page, testOf(ex, "pass").code as string);
  await page.getByTestId("check").click();
  await expect(feedback$(page)).toHaveAttribute("data-status", "pass");
  const s6 = await api<{ attempts: number; passed: boolean }>(page, "GET", "/lessons/U01.L01/steps/S6");
  expect(s6.body).toMatchObject({ attempts: 2, passed: true });
});

test("a tapped take: Try again re-arms the pad and counts in at once", async ({ page }) => {
  resetLessons(["U01.L01"]);
  completeLessons(["U00.L01", "U00.L02"]);
  await page.goto("/learn/U01.L01?step=S2");
  await stepIs(page, "S2");
  const beats = (n: number, every = 1) =>
    Array.from({ length: n }, (_, i) => Number((i * every * 0.625).toFixed(3)));
  expect((await submit(page, { taps: beats(4, 2) }))?.status).toBe("fail");
  await expect(feedback$(page)).toHaveAttribute("data-status", "fail");
  const pad = step$(page).locator("[data-phase]").first();
  // The pad's own start gives way to the row's Try again while the verdict shows.
  await expect(step$(page).getByRole("button", { name: "Start tapping" })).toHaveCount(0);
  await expect(step$(page).locator("[data-take-retry]")).toHaveCount(0);
  await retry$(page).click();
  await expect(pad).toHaveAttribute("data-phase", /starting|count-in|taking/);
  await expect(page.getByTestId("step-feedback")).toHaveCount(0);
  // The take itself is proven by the tap specs: the right taps go through the player's own grading path.
  expect((await submit(page, { taps: beats(8) }))?.status).toBe("pass");
  await expect(retry$(page)).toBeVisible();
});

test.describe("with the fake microphone", () => {
  test("a sung take: Try again starts the new take at once; singing never gates", async ({ page }) => {
    await seed(page, "after U02.CP");
    await setQuiet(page, false);
    await page.goto("/learn/U03.L02?step=S8");
    await stepIs(page, "S8");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Object.keys(
              (
                globalThis as unknown as { __oakLesson: { singTargets(): Record<string, number[]> } }
              ).__oakLesson.singTargets(),
            ).length,
        ),
      )
      .toBeGreaterThan(0);
    const targets = (await page.evaluate(
      () =>
        Object.values(
          (
            globalThis as unknown as { __oakLesson: { singTargets(): Record<string, number[]> } }
          ).__oakLesson.singTargets(),
        )[0],
    )) as number[];
    const sung = (ms: readonly number[]) => ms.map((midi) => ({ midi, cents: 4, credit: 1 }));
    expect(
      (await submit(page, { sung: sung(targets.map((m, i) => (i === 0 ? m : m + 3))) }))?.status,
    ).not.toBe("pass");
    await expect(page.getByTestId("continue")).toBeEnabled();
    await expect(retry$(page)).toBeVisible();
    await expect(step$(page).locator("[data-take-retry]")).toHaveCount(0);
    await matrix(page, "sing-wrong");
    await retry$(page).click();
    // The new take runs without a second press: the cue, then the mic, then Stop.
    const stop = step$(page).getByRole("button", { name: "Stop", exact: true });
    await expect(stop).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("continue")).toBeEnabled();
    await stop.click();
    expect((await submit(page, { sung: sung(targets) }))?.status).toBe("pass");
    await expect(retry$(page)).toBeVisible();
  });
});

test("a checkpoint item: saved, Try again re-opens it, saved again, Back, and the review's Change", async ({
  page,
}) => {
  await seed(page, "U01.CP due");
  await page.goto("/checkpoint/U01");
  await page.getByTestId("start-checkpoint").click();
  await expect(step$(page)).toBeVisible({ timeout: 30_000 });
  const info = () =>
    page.evaluate(() => {
      const cp = (globalThis as unknown as { __oakCheckpoint: { exercise(): unknown; expected(): unknown } })
        .__oakCheckpoint;
      return { ex: cp.exercise() as PartLike, expected: cp.expected() as Record<string, unknown> | null };
    });
  // The first pick or number item (the items are drawn per attempt): answered through its widget.
  const answerable = async (x: Awaited<ReturnType<typeof info>>) =>
    x.expected !== null &&
    ["choice", "degree-pad", "number"].includes(x.ex?.answer?.ui ?? "") &&
    (await answerWidget(page, x.ex, { answer: x.expected }));
  let it = await info();
  for (let i = 0; i < 14 && !(await answerable(it)); i++) {
    await page.getByTestId("skip-item").click();
    it = await info();
  }
  const first = await step$(page).getAttribute("data-step");
  await page.getByTestId("check").click();
  await expect(feedback$(page)).toHaveAttribute("data-status", "saved");
  await expect(page.getByTestId("result-line")).toHaveText("Your last saved answer is the one that counts.");
  await expect(page.getByTestId("next-item")).toBeFocused();
  await matrix(page, "checkpoint-saved");
  await expect(step$(page).locator("[data-answer]").first()).toHaveAttribute("aria-disabled", "true");
  await retry$(page).click();
  await expect(page.getByTestId("check")).toBeVisible();
  await expect(step$(page).locator("[data-answer]").first()).not.toHaveAttribute("aria-disabled", "true");
  await page.getByTestId("check").click();
  await expect(feedback$(page)).toHaveAttribute("data-status", "saved");
  await page.getByTestId("next-item").click();
  await expect(step$(page)).not.toHaveAttribute("data-step", first as string);
  await page.getByTestId("previous-item").click();
  await expect(step$(page)).toHaveAttribute("data-step", first as string);
  await expect(retry$(page)).toBeVisible();
  // To the review: every later item skipped; it lists each one, and Change opens a saved one again.
  await page.getByTestId("next-item").click();
  for (let i = 0; i < 40 && (await page.getByTestId("checkpoint-review").count()) === 0; i++) {
    await expect(step$(page).or(page.getByTestId("checkpoint-review"))).toBeVisible();
    if ((await page.getByTestId("skip-item").count()) > 0) await page.getByTestId("skip-item").click();
    // The Make (the last item) has no Skip: its passing sketch, through the player's own path.
    else if ((await page.getByTestId("save-sketch").count()) > 0)
      await page.evaluate(
        (code) =>
          (
            globalThis as unknown as { __oakCheckpoint: { answer(r: unknown): Promise<void> } }
          ).__oakCheckpoint.answer({ code }),
        MAKE_CODE,
      );
  }
  const review = page.getByTestId("checkpoint-review");
  await expect(review).toBeVisible();
  await matrix(page, "checkpoint-review");
  const answered = review.locator('[data-testid="review-item"][data-state="answered"]');
  // The item saved above and the Make.
  await expect(answered).toHaveCount(2);
  await expect(review.locator('[data-testid="review-item"][data-state="skipped"]').first()).toBeVisible();
  await answered.first().getByTestId("review-change").click();
  await expect(step$(page)).toHaveAttribute("data-step", first as string);
  await expect(page.getByTestId("check")).toBeVisible();
  // Re-opened, its saved answer still counts until it is saved again.
  await expect(page.getByTestId("checkpoint-progress")).toContainText("2 of");
});
