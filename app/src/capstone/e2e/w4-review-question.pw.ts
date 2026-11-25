// Oak 2.0 W4 F4 on the capstone stack (5210/8810, the fake tutor), from "C3.S3 done": the Brief's review field and its
// three chips; "The form" fills the field; the detail prompt waits until its "_" are filled; "Request review" posts
// the question as `reviewQuestion` on the review turn, and the review that comes back answers it first. The fake
// tutor (`OAK_TUTOR_FAKE`, X20) answers with `FAKE_REVIEW_ANSWER` whenever the context has `learner_question:`. Run
// only at the wave gate (W4 Task 6 B7).
import { expect, test } from "@playwright/test";
import { C3_FULL } from "./w5-pieces.ts";
import { editor, seedFirst, setCode, watchErrors } from "./w5-support.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

test("the review question: chips, the placeholder wait, reviewQuestion on the request, the answer first", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await seedFirst(page, ["C3.S3 done"]);
  await page.goto("/capstone/C3");
  await expect(page.getByTestId("capstone-workspace")).toBeVisible({ timeout: 60_000 });
  await editor(page, "C3");
  await setCode(page, "C3", C3_FULL);
  await expect(page.getByTestId("req-count")).toHaveText(/^(\d+) of \1 met$/, { timeout: 60_000 });
  await page.getByTestId("check-track").click();
  await expect(page.getByRole("status").filter({ hasText: /every requirement is met/ })).toBeVisible({
    timeout: 30_000,
  });

  const ask = page.getByTestId("review-ask");
  await expect(ask).toContainText("Your question for the review (optional)");
  await expect(ask.getByTestId("review-prompt-sound")).toHaveText("The sound");
  await expect(ask.getByTestId("review-prompt-form")).toHaveText("The form");
  await expect(ask.getByTestId("review-prompt-detail")).toHaveText("A detail");
  const field = ask.getByTestId("review-question");
  const request = ask.getByTestId("request-review");

  await ask.getByTestId("review-prompt-form").click();
  await expect(field).toHaveValue("Does the form keep a listener with it to the end?");
  await ask.getByTestId("review-prompt-detail").click();
  await expect(field).toHaveValue("In bars _ to _, does this part work?");
  await expect(request).toBeDisabled();
  await field.fill("In bars 9 to 16, does the chorus lift?");
  await expect(request).toBeEnabled();

  const sent = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().includes("/api/tutor/reviews/capstone"),
    { timeout: 30_000 },
  );
  await request.click();
  const body = JSON.parse((await sent).postData() ?? "{}") as { reviewQuestion?: string; kind?: string };
  expect(body.kind).toBe("review-capstone");
  expect(body.reviewQuestion).toBe("In bars 9 to 16, does the chorus lift?");

  // The fake tutor's answer (server/src/tutor-adapters/fake-backend.ts FAKE_REVIEW_ANSWER), before what works.
  const review = page.getByTestId("review-summary");
  const answer = review.getByTestId("review-answer");
  await expect(answer).toBeVisible({ timeout: 45_000 });
  await expect(answer).toContainText("Your question, answered");
  await expect(answer).toContainText(/Loop bars 1 to 4 and then the last bar/);
  const strengths = review.getByTestId("review-strengths");
  await expect(strengths).toBeVisible();
  const answerFirst = await answer.evaluate(
    (a, s) => s !== null && (a.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    await strengths.elementHandle(),
  );
  expect(answerFirst).toBe(true);
  expect(errors).toEqual([]);
});
