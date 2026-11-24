// Review of "Try again" in the drill runner (docs/design/retry.md §2.3, §2.4, §3.3) for what retry.pw.ts does not
// walk: a typed answer by keyboard alone (the focus after the verdict is where Enter moves on, never a locked
// field), a learner who never retries (one key to answer, one to go on: nothing added), the verdict heard by a
// screen reader (one live region that exists before the verdict), and a sung resolution tried again on the fake
// microphone (a practice take: the record keeps the first one).
import type { DrillTrialRecord, Trial } from "@oak/api";
import { expect, type Page, test } from "@playwright/test";
import { stack } from "./playwright.config.ts";

const HEADERS = { "X-Oak": "1", Origin: stack.baseURL, "Content-Type": "application/json" };
const PRACTICE_LINE = "Practice: this try does not change your result.";

const hook = <T>(page: Page, name: string): Promise<T> =>
  page.evaluate((n) => (globalThis as Record<string, unknown>)[n], name) as Promise<T>;

async function seed(page: Page, point: string): Promise<void> {
  await page.request.put(`${stack.apiURL}/api/dev/clock`, { headers: HEADERS, data: { reset: true } });
  const r = await page.request.post(`${stack.apiURL}/api/dev/seed`, { headers: HEADERS, data: { point } });
  expect(r.ok(), await r.text()).toBe(true);
}

async function startPractice(page: Page, familyId: string): Promise<void> {
  await page.goto(`/practice/${familyId}`);
  await expect(page.getByTestId("start-set")).toBeFocused({ timeout: 60_000 });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("trial-counter")).toHaveText(/^Trial 1 of \d+$/, { timeout: 60_000 });
}

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  // Other engineers' edits must not reload the page mid-test.
  await page.routeWebSocket(/.*/, () => {});
});

test("a typed answer: the verdict is announced, Enter moves on, Alt+R tries again; no extra key for anyone", async ({
  page,
}) => {
  await seed(page, "after U03.L02");
  await startPractice(page, "fam.pit.keyboard");
  const field = page.locator("[data-answer] input").first();
  await expect(field).toBeFocused();
  // The region the verdict will be read from is on the page before the verdict.
  const region = page.locator('[data-testid="trial-live"]');
  await expect(region).toHaveCount(1);
  await expect(region).toHaveText("");
  const before = await region.elementHandle();

  const trial = await hook<Trial>(page, "__oakDrillTrial");
  const right = (trial.expected as { text: string[] }).text[0] as string;
  const wrong = right.startsWith("c") ? "d" : "c";
  // 1. Wrong, typed and checked with Enter: the verdict, then the focus where Enter moves on.
  await field.fill(wrong);
  await page.keyboard.press("Enter");
  const feedback = page.getByTestId("trial-feedback");
  await expect(feedback).toHaveAttribute("data-correct", "false");
  expect(await before?.evaluate((el) => el.isConnected && /\S/.test(el.textContent ?? ""))).toBe(true);
  await expect(page.getByTestId("next-trial")).toBeFocused();
  await expect(page.getByTestId("result-line")).toHaveText(PRACTICE_LINE);
  // 2. Alt+R from there: the same trial, the field empty and focused; a right practice take.
  await page.keyboard.press("Alt+KeyR");
  await expect(feedback).toHaveCount(0);
  await expect(field).toBeFocused();
  await field.fill(right);
  await page.keyboard.press("Enter");
  await expect(feedback).toHaveAttribute("data-correct", "true");
  await expect(feedback).toHaveAttribute("data-practice", "true");
  await expect(page.getByTestId("next-trial")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("trial-counter")).toHaveText(/^Trial 2 of/);

  // 3. A learner who never retries: type, Enter, Enter — exactly as before the retry pass.
  for (let i = 2; i <= 3; i++) {
    const t = await hook<Trial>(page, "__oakDrillTrial");
    await expect(field).toBeFocused();
    await page.keyboard.type((t.expected as { text: string[] }).text[0] as string);
    await page.keyboard.press("Enter");
    await expect(feedback).toHaveAttribute("data-correct", "true");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("trial-counter")).toHaveText(new RegExp(`^Trial ${i + 1} of`));
  }
});

test("a sung resolution: Try again sings the way home again as practice; the record keeps the first take", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const posts: DrillTrialRecord[] = [];
  page.on("request", (r) => {
    if (r.method() !== "POST" || !/\/api\/drills\/sessions\/[^/]+\/trials$/.test(r.url())) return;
    posts.push(...(r.postDataJSON() as { trials: DrillTrialRecord[] }).trials);
  });
  await seed(page, "after U02.CP");
  // The degree family opens in U03 (as wave3.pw.ts does): its lessons read as done; the mic is on.
  const units = ["U03.L01", "U03.L02", "U03.L03", "U03.L04", "U03.L10", "U04.L01"];
  await page.route("**/api/lessons/progress", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { lessons: { lessonId: string; status: string }[] };
    for (const l of body.lessons) if (units.includes(l.lessonId)) l.status = "completed";
    await route.fulfill({ response: res, json: body });
  });
  await page.request.put(`${stack.apiURL}/api/voice/quiet`, {
    headers: HEADERS,
    data: { quiet: false, scope: "today" },
  });
  await startPractice(page, "fam.deg.fet-major");
  const next = page.getByTestId("next-trial");
  const feedback = page.getByTestId("trial-feedback");
  const retry = page.getByTestId("result-retry");
  let idx = -1;
  for (let i = 0; i < 8 && idx < 0; i++) {
    await expect(page.getByTestId("trial-counter")).toHaveText(new RegExp(`^Trial ${i + 1} of`));
    await page.keyboard.press("1");
    await expect(feedback).toBeVisible();
    if ((await next.textContent())?.includes("Sing it home")) idx = i;
    else await page.keyboard.press("Enter");
  }
  expect(idx).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Enter");
  await expect(feedback).toContainText(/Sung home|Sung\. The trace|Singing skipped/, { timeout: 30_000 });
  // The way home is a result like any other: Try again, then the primary; the next take is practice.
  await expect(retry).toBeVisible();
  await expect(page.getByTestId("result-line")).toHaveText(PRACTICE_LINE);
  await expect.poll(() => posts.filter((p) => p.idx === idx && p.sungResolution).length).toBe(1);
  const first = posts.find((p) => p.idx === idx && p.sungResolution)?.sungResolution;
  await page.keyboard.press("Alt+KeyR");
  await expect(page.getByTestId("pitch-lane")).toBeVisible();
  await expect(feedback).toContainText(/Sung home|Sung\. The trace|Singing skipped/, { timeout: 30_000 });
  await expect(retry).toBeVisible();
  // Whatever the practice take sent, the trial's resolution is the first one, with one practice take counted.
  await expect.poll(() => posts.filter((p) => p.idx === idx).at(-1)?.retries ?? 0).toBe(1);
  expect(posts.filter((p) => p.idx === idx).at(-1)?.sungResolution).toEqual(first);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("trial-counter")).toHaveText(new RegExp(`^Trial ${idx + 2} of`));
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("a fact card answered, then the page reloaded and the card answered again: one review", async ({
  page,
}) => {
  await seed(page, "after U03.L02");
  const boot = (await (
    await page.request.get(`${stack.apiURL}/api/bootstrap`, { headers: HEADERS })
  ).json()) as { day: string };
  // The session resumes a warm-up item after a reload, and its fact set from the first card; here the item is
  // planned the same way twice.
  await page.route(/\/api\/srs\/due(\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        budgetSec: 300,
        plannedSec: 10,
        items: [
          {
            id: `${boot.day}:w:0`,
            kind: "fact-set",
            familyId: null,
            members: [],
            cardIds: ["fact.staff.treble.C4"],
            level: 1,
            trials: 1,
            estSec: 8,
            mic: false,
            rated: true,
          },
        ],
        label: "Today's review ≈ 1 min",
        moreAvailable: false,
      },
    }),
  );
  const reviews: unknown[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/srs\/review$/.test(r.url())) reviews.push(r.postDataJSON());
  });
  const card = page.getByTestId("fact-card");
  const field = card.getByLabel("Your answer");
  await page.goto("/practice/review");
  await expect(field).toBeFocused({ timeout: 60_000 });
  await page.keyboard.type("D");
  await page.keyboard.press("Enter");
  await expect(card.getByRole("status")).toHaveText(/^It is C\./);
  await expect.poll(() => reviews.length).toBe(1);
  await page.reload();
  await expect(field).toBeFocused({ timeout: 60_000 });
  await page.keyboard.type("C");
  await page.keyboard.press("Enter");
  await expect(card.getByRole("status")).toHaveText(/^That's it: C\./);
  // The answer after the reload is practice: said, and never posted.
  await expect(card.getByTestId("result-line")).toHaveText(PRACTICE_LINE);
  await expect(card.getByTestId("result-continue")).toBeFocused();
  await page.keyboard.press("Enter");
  // The summary keeps the first answer (wrong).
  await expect(page.getByTestId("fact-summary")).toContainText("0/1");
  expect(reviews).toHaveLength(1);
});
