// Review of "Try again" in the lesson player (docs/design/retry.md), for what the build's retry.pw.ts does not
// walk: a typed answer by keyboard alone (focus after each verdict, so Enter always does the expected thing), a
// predict's second guess (practice), a step looked back at (practice from its first take), and the verdict heard
// by a screen reader before the actions (one live region that exists before the verdict and is filled by it).
import type { Page } from "@playwright/test";
import { expect, stepIs, test } from "./support.ts";
import { api, seed as reseedTo } from "./w3support.ts";

const PRACTICE = "Practice: this try does not change your result.";
const step$ = (page: Page) => page.getByTestId("lesson-step");
const retry$ = (page: Page) => step$(page).getByTestId("result-retry");
const feedback$ = (page: Page) => page.getByTestId("step-feedback");

test("a typed answer by keyboard alone: wrong → Enter tries again → right → Enter goes on", async ({
  page,
}) => {
  await reseedTo(page, "after U02.L03");
  await page.goto("/learn/U02.L04?step=S4");
  await stepIs(page, "S4");
  const field = step$(page).locator("[data-answer] input").first();
  await field.focus();
  // The verdict region exists before the verdict (a live region added with its content is not announced).
  const region = await step$(page)
    .locator('section[aria-live="polite"][aria-label="Check result"]')
    .elementHandle();
  expect(await region?.textContent()).toBe("");
  await field.fill("a b c");
  await page.keyboard.press("Enter");
  await expect(feedback$(page)).toHaveAttribute("data-status", "fail");
  // The same element now holds the verdict, and it comes before the actions in reading order.
  expect(
    await region?.evaluate(
      (el) =>
        el.isConnected &&
        el.getAttribute("data-testid") === "step-feedback" &&
        (el.compareDocumentPosition(document.querySelector('[data-testid="result-retry"]') as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0,
    ),
  ).toBe(true);
  // Continue is held: Enter must try again, so Try again has the focus (never the locked field).
  await expect(retry$(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(field).toBeFocused();
  await field.fill("g e c");
  await page.keyboard.press("Enter");
  await expect(feedback$(page)).toHaveAttribute("data-status", "pass");
  await expect(page.getByTestId("continue")).toBeFocused();
  await expect(page.getByTestId("result-line")).toHaveText(PRACTICE);
  await page.keyboard.press("Enter");
  await stepIs(page, "S5");
});

test("a predict: the guess locks in, Try again re-opens it as practice; looking back is practice too", async ({
  page,
}) => {
  await reseedTo(page, "after U01.L01");
  await page.goto("/learn/U01.L02?step=S3");
  await stepIs(page, "S3");
  await expect(page.getByTestId("result-line")).toHaveCount(0);
  await step$(page)
    .getByRole("radio", { name: /Beat 1/ })
    .click();
  await page.getByTestId("check").click();
  await expect(page.getByTestId("predict-outcome")).toBeVisible();
  await expect(retry$(page)).toBeVisible();
  await expect(page.getByTestId("continue")).toBeFocused();
  await expect(page.getByTestId("result-line")).toHaveText(PRACTICE);
  await page.keyboard.press("Alt+r");
  await expect(page.getByTestId("predict-outcome")).toHaveCount(0);
  await step$(page)
    .getByRole("radio", { name: /Beat 3/ })
    .click();
  await page.getByTestId("check").click();
  await expect(page.getByTestId("predict-outcome")).toBeVisible();
  const s3 = await api<{ attempts: number; practiceNext: boolean }>(page, "GET", "/lessons/U01.L02/steps/S3");
  expect(s3.body).toMatchObject({ attempts: 2, practiceNext: true });
  // On to the next step, then back: the last guess is on screen with the same row, and the line says that a
  // further guess is practice.
  await page.keyboard.press("Enter");
  await stepIs(page, "S4");
  await page.keyboard.press("Alt+ArrowLeft");
  await stepIs(page, "S3");
  await expect(page.getByTestId("predict-outcome")).toBeVisible();
  await expect(retry$(page)).toBeVisible();
  await expect(page.getByTestId("continue")).toBeEnabled();
  await expect(page.getByTestId("result-line")).toHaveText(PRACTICE);
});
