// "Try again" in the drill runner on the real Oak server (own stack, throwaway data, a dev seed), once per KIND of
// trial (docs/design/retry.md §3.3, §9): a picked trial (keyboard only: a right answer and a wrong one each tried
// again, the set's rating still the first answers'), a tapped trial and a sung trial on Chromium's fake microphone.
// What a practice take counts for — nothing — is proved by bun tests (machine.test.ts, retry.test.ts and
// retry-server.test.ts against the real server); this file proves the page: the row, the key, the focus, the line,
// and that the records the page sends keep the first answer.
import { fileURLToPath } from "node:url";
import type { DrillFinish, DrillTrialRecord, Trial } from "@oak/api";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const HEADERS = { "X-Oak": "1", Origin: stack.baseURL, "Content-Type": "application/json" };
const PRACTICE_LINE = "Practice: this take does not change your result.";
const RETRY = "Alt+KeyR";

type Choice = { ui: "choice"; options: { id: string; label: string }[] };

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|501|Not Implemented/i.test(m.text()))
      problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return problems;
}

/** Every trial record the page sends, in order (a practice take re-sends its trial with `retries`). */
function trialPosts(page: Page): DrillTrialRecord[] {
  const out: DrillTrialRecord[] = [];
  page.on("request", (r) => {
    if (r.method() !== "POST" || !/\/api\/drills\/sessions\/[^/]+\/trials$/.test(r.url())) return;
    out.push(...(r.postDataJSON() as { trials: DrillTrialRecord[] }).trials);
  });
  return out;
}

const hook = <T>(page: Page, name: string): Promise<T> =>
  page.evaluate((n) => (globalThis as Record<string, unknown>)[n], name) as Promise<T>;

/** Picks the right (or a wrong) option by the number the pad gives it. */
async function pick(page: Page, right: boolean): Promise<void> {
  const trial = await hook<Trial>(page, "__oakDrillTrial");
  const spec = await hook<Choice>(page, "__oakDrillSpec");
  const want = (trial.expected as { choice: string[] }).choice[0];
  const i = spec.options.findIndex((o) => (right ? o.id === want : o.id !== want));
  await page.keyboard.press(String(i + 1));
}

const item = (day: string, i: number, familyId: string, trials: number, mic: boolean) => ({
  id: `${day}:w:${i}`,
  kind: "family-set",
  familyId,
  members: [],
  cardIds: [familyId],
  level: 1,
  trials,
  estSec: trials * 8,
  mic,
  rated: true,
});

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  // Other engineers' edits must not reload the page mid-test.
  await page.routeWebSocket(/.*/, () => {});
});

test("Try again after a right pick, a wrong pick, a tap, a sung note and a fact card; the first answers stay", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const problems = watch(page);
  const posts = trialPosts(page);
  // A learner a few weeks in (treble-staff fact cards held): a working mic and a calibrated range (wave3.md §5.5).
  await page.request.put(`${stack.apiURL}/api/dev/clock`, { headers: HEADERS, data: { reset: true } });
  const seeded = await page.request.post(`${stack.apiURL}/api/dev/seed`, {
    headers: HEADERS,
    data: { point: "after U03.L02" },
  });
  expect(seeded.ok(), await seeded.text()).toBe(true);
  const boot = (await (
    await page.request.get(`${stack.apiURL}/api/bootstrap`, { headers: HEADERS })
  ).json()) as { day: string };
  // Today's warm-up as planned for this test: a set of picks, a tap set, a sung set (their lengths are the
  // families' own: 10, 4 and 5; the tap and sung sets are left after their first trial with "Skip this one") and
  // one fact card.
  await page.route(/\/api\/srs\/due(\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        budgetSec: 300,
        plannedSec: 40,
        items: [
          item(boot.day, 0, "fam.pit.compare", 10, false),
          item(boot.day, 1, "fam.rhy.pulse", 4, false),
          item(boot.day, 2, "fam.pit.match", 5, true),
          {
            ...item(boot.day, 3, "fam.pit.match", 1, false),
            kind: "fact-set",
            familyId: null,
            cardIds: ["fact.staff.treble.C4"],
          },
        ],
        label: "Today's review ≈ 1 min",
        moreAvailable: false,
      },
    }),
  );
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/practice/review");
  const counter = page.getByTestId("trial-counter");
  const feedback = page.getByTestId("trial-feedback");
  const next = page.getByTestId("next-trial");
  const retry = page.getByTestId("result-retry");
  const line = page.getByTestId("result-line");
  await expect(counter).toHaveText("Trial 1 of 10", { timeout: 60_000 });

  // 1. A right pick, then a wrong practice take — keyboard only.
  await pick(page, true);
  await expect(feedback).toHaveAttribute("data-correct", "true");
  // The row: Try again (⌥R) before the primary, which has the focus, so Enter would move on.
  await expect(retry).toBeVisible();
  await expect(retry).toHaveAccessibleName("Try again");
  await expect(retry).toHaveAttribute("aria-keyshortcuts", "Alt+R");
  await expect(next).toBeFocused();
  await expect(next).toContainText("Next trial");
  await expect(line).toHaveText(PRACTICE_LINE);
  const [rb, nb] = [await retry.boundingBox(), await next.boundingBox()];
  expect((rb?.x ?? 0) + (rb?.width ?? 0)).toBeLessThanOrEqual(nb?.x ?? 0);
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), m.theme);
    await expect(next).toBeInViewport();
    await expect(retry).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "retry-row", m.theme);
  }
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "paper"));
  await page.setViewportSize({ width: 1440, height: 900 });
  // Nothing moves on by itself.
  await expect(counter).toHaveText("Trial 1 of 10");
  await page.keyboard.press(RETRY);
  // The same trial, open again: no verdict, the pad answerable, still trial 1.
  await expect(feedback).toHaveCount(0);
  await expect(counter).toHaveText("Trial 1 of 10");
  await pick(page, false);
  await expect(feedback).toHaveAttribute("data-correct", "false");
  await expect(feedback).toHaveAttribute("data-practice", "true");
  await shoot(page, SHOTS, "retry-practice-take", "paper");
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");

  // 2. A wrong pick, then a right practice take.
  await expect(counter).toHaveText("Trial 2 of 10");
  await pick(page, false);
  await expect(feedback).toHaveAttribute("data-correct", "false");
  await page.keyboard.press(RETRY);
  await expect(feedback).toHaveCount(0);
  await pick(page, true);
  await expect(feedback).toHaveAttribute("data-correct", "true");
  await expect(feedback).toHaveAttribute("data-practice", "true");
  await page.keyboard.press("Enter");

  // 3. The rest right, no retry; the set ends and is rated on its first answers: 9 of 10.
  const finished = page.waitForResponse((r) => /\/api\/drills\/sessions\/[^/]+\/finish$/.test(r.url()));
  for (let i = 3; i <= 10; i++) {
    await expect(counter).toHaveText(`Trial ${i} of 10`);
    await pick(page, true);
    await expect(feedback).toBeVisible();
    if (i === 10) await expect(next).toContainText("Finish set");
    await page.keyboard.press("Enter");
  }
  const finish = (await (await finished).json()) as DrillFinish;
  expect(finish.meanCredit).toBeCloseTo(9 / 10, 5);
  const stored = (await (
    await page.request.get(`${stack.apiURL}/api/drills/sessions/${finish.session.id}`, { headers: HEADERS })
  ).json()) as { trials: DrillTrialRecord[] };
  expect(stored.trials.slice(0, 3).map((t) => [t.idx, t.correct, t.retries ?? 0])).toEqual([
    [0, true, 1],
    [1, false, 1],
    [2, true, 0],
  ]);
  expect(stored.trials.filter((t) => (t.retries ?? 0) > 0)).toHaveLength(2);
  // Every record the page sent for a trial carried its first answer.
  for (const p of posts.filter((r) => r.familyId === "fam.pit.compare"))
    expect(p.correct).toBe(stored.trials[p.idx]?.correct);
  await expect(page.getByTestId("set-summary")).toBeVisible();
  await page.keyboard.press("Enter");

  // 4. A tapped trial: the take, then Try again starts a new take at once (count-in and all).
  await expect(page.getByTestId("warmup-position")).toHaveText("Warm-up · 2 of 4");
  await expect(counter).toHaveText("Trial 1 of 4", { timeout: 60_000 });
  await expect(page.getByTestId("stage-text")).toHaveText("Your turn: tap with Space.", { timeout: 15_000 });
  for (let k = 0; k < 6; k++) {
    await page.waitForTimeout(450);
    await page.keyboard.press("Space");
  }
  await expect(feedback).toBeVisible({ timeout: 20_000 });
  const tapFirst = posts.filter((r) => r.familyId === "fam.rhy.pulse").at(-1) as DrillTrialRecord;
  expect(tapFirst.response.taps?.length).toBeGreaterThan(0);
  // A late Space never lands on Next trial: the focus stays in the runner after a tapped take.
  await expect(next).not.toBeFocused();
  await retry.click();
  await expect(page.getByTestId("stage-text")).toHaveText(/Count-in|Listening|Your turn/, {
    timeout: 15_000,
  });
  // No taps this time: the practice take is judged on its own and the first take stays the record.
  await expect(feedback).toHaveAttribute("data-practice", "true", { timeout: 20_000 });
  await expect.poll(() => posts.filter((r) => r.familyId === "fam.rhy.pulse").at(-1)?.retries ?? 0).toBe(1);
  const tapLast = posts.filter((r) => r.familyId === "fam.rhy.pulse").at(-1) as DrillTrialRecord;
  expect([tapLast.credit, tapLast.response.taps]).toEqual([tapFirst.credit, tapFirst.response.taps]);
  await page.keyboard.press("Enter");
  await expect(counter).toHaveText("Trial 2 of 4");
  await page.getByRole("button", { name: "Skip this one" }).click();

  // 5. A sung trial on the fake microphone: sung, then sung again as practice.
  await expect(page.getByTestId("warmup-position")).toHaveText("Warm-up · 3 of 4");
  await expect(counter).toHaveText("Trial 1 of 5", { timeout: 60_000 });
  // A sung trial waits for Start (and so does its practice take).
  await page.getByTestId("drill-start").click({ timeout: 15_000 });
  await expect(feedback).toBeVisible({ timeout: 30_000 });
  const sungFirst = posts.filter((r) => r.familyId === "fam.pit.match").at(-1) as DrillTrialRecord;
  expect(sungFirst.response.skipped).toBe(false);
  await page.keyboard.press(RETRY);
  await page.getByTestId("drill-start").click({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Microphone is live. Close it" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(feedback).toHaveAttribute("data-practice", "true", { timeout: 30_000 });
  await expect(line).toHaveText(PRACTICE_LINE);
  await expect.poll(() => posts.filter((r) => r.familyId === "fam.pit.match").at(-1)?.retries ?? 0).toBe(1);
  const sungLast = posts.filter((r) => r.familyId === "fam.pit.match").at(-1) as DrillTrialRecord;
  expect([sungLast.credit, sungLast.response.sung]).toEqual([sungFirst.credit, sungFirst.response.sung]);
  await shoot(page, SHOTS, "retry-sung", "paper");
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(counter).toHaveText("Trial 2 of 5");
  await page.getByRole("button", { name: "Skip this one" }).click();

  // 6. A fact card: a wrong first answer is its one review; Try again answers it again and posts nothing.
  await expect(page.getByTestId("warmup-position")).toHaveText("Warm-up · 4 of 4");
  const reviews: unknown[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/srs\/review$/.test(r.url())) reviews.push(r.postDataJSON());
  });
  const card = page.getByTestId("fact-card");
  const field = card.getByLabel("Your answer");
  await expect(field).toBeFocused();
  // The verdict's live region is on the page before the verdict, and the verdict fills that same element (a
  // region added with its content is not announced: docs/design/retry.md §2.3).
  const verdict = await card.getByRole("status").elementHandle();
  expect(await verdict?.textContent()).toBe("");
  await page.keyboard.type("D");
  await page.keyboard.press("Enter");
  await expect(card.getByRole("status")).toHaveText(/^It is C\./);
  expect(await verdict?.evaluate((el) => el.isConnected)).toBe(true);
  await expect(card.getByTestId("result-continue")).toBeFocused();
  await expect(card.getByTestId("result-line")).toHaveText(PRACTICE_LINE);
  await expect.poll(() => reviews.length).toBe(1);
  await shoot(page, SHOTS, "retry-fact", "paper");
  await page.keyboard.press(RETRY);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("");
  await page.keyboard.type("C");
  await page.keyboard.press("Enter");
  await expect(card.getByRole("status")).toHaveText(/^That's it: C\./);
  await expect(card.getByTestId("result-continue")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("fact-summary")).toContainText("The ones you flipped come back sooner.");
  expect(reviews).toEqual([expect.objectContaining({ outcome: expect.objectContaining({ meanCredit: 0 }) })]);
  expect(problems).toEqual([]);
});
