// The Wave 5 step kinds reach the tutor from the real lesson player (the scripted fake backend, OAK_TUTOR_FAKE=1;
// docs/design/wave2.md §5): after a wrong check (the lesson's own pinned mistake), a chat turn to a worst-case model
// (`#echo`: it repeats everything it was given) carries the learner's own answer — the form strip section by
// section with its bars, the scale built on the keyboard, the bar picked on the bar buttons, the code of a
// "match this sound" step — at rung 0, and never the step's expected answer or the hidden sound to match.
import type { Page, Request } from "@playwright/test";
import { expect, setCode, stepIs, test } from "./support.ts";
import { reseedFresh, seed, setQuiet } from "./w3support.ts";
import { lessonDefW5 } from "./w5walk.ts";
import { answerWidget, type PartLike } from "./walk.ts";

test.describe.configure({ mode: "serial" });
test.afterAll(async ({ request }) => {
  await reseedFresh(request);
});

function nextTurn(page: Page): Promise<Record<string, unknown>> {
  return page
    .waitForRequest((r: Request) => r.method() === "POST" && /\/api\/tutor\/(hint|chat)$/.test(r.url()), {
      timeout: 20_000,
    })
    .then((r) => r.postDataJSON() as Record<string, unknown>);
}

/** Opens the tutor and sends an `#echo` chat; returns what was sent and the echoed reply's text. */
async function echo(page: Page, question: string): Promise<{ sent: string; echoed: string }> {
  await page.getByRole("button", { name: "Show tutor" }).first().click();
  const chat = nextTurn(page);
  await page.getByTestId("composer").fill(`#echo ${question}`);
  await page.getByTestId("composer").press("Enter");
  const sent = JSON.stringify(await chat);
  const reply = page.getByTestId("tutor-message").last();
  await expect(reply).toHaveAttribute("data-status", "done", { timeout: 30_000 });
  await expect(reply).toContainText("hint_rung: 0");
  await expect(reply).toContainText('"solution":null');
  return { sent, echoed: (await reply.textContent()) ?? "" };
}

type Ex = PartLike & { correct?: Record<string, unknown> };
async function exerciseOf(id: string, step: string): Promise<Ex> {
  const def = await lessonDefW5(id);
  return def.steps.find((s) => s.id === step)?.exercise as Ex;
}

/** Opens a step from its seed, enters the lesson's own pinned mistake and checks it (the verdict fails). */
async function wrongCheck(page: Page, point: string, lessonId: string, stepId: string, mistake: string) {
  await seed(page, point);
  await setQuiet(page, false);
  const ex = await exerciseOf(lessonId, stepId);
  const wrong = ex.tests.find((t) => t.expect === "fail" && t.name === mistake);
  expect(wrong, `${lessonId} ${stepId}: the pinned mistake "${mistake}"`).toBeDefined();
  await page.goto(`/learn/${lessonId}?step=${stepId}`);
  await stepIs(page, stepId);
  expect(await answerWidget(page, ex, wrong?.response ?? {}), "entered through the widget").toBe(true);
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail", { timeout: 30_000 });
  return ex;
}

test("the form strip (U09.L03 S5): the learner's letters section by section, not the answer", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await wrongCheck(
    page,
    "after U09.L02",
    "U09.L03",
    "S5",
    "the third section heard as new because the sound changed",
  );
  const { sent, echoed } = await echo(page, "Is the third section new?");
  expect(sent).toContain("My answers, slot by slot:");
  expect(sent).toContain("Section 1 (bars 1–8): A");
  expect(sent).toContain("Section 3 (bars 17–24): B");
  expect(sent, "the right letter of section 3 is not sent").not.toContain("Section 3 (bars 17–24): A");
  expect(echoed).not.toContain("Section 3 (bars 17–24): A");
});

test("the scale builder (U11.L01 S6): the keys the learner picked, by name, not the expected scale", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await wrongCheck(page, "after GYM.09", "U11.L01", "S6", "all seven notes of G major");
  const { sent, echoed } = await echo(page, "Which keys are extra?");
  expect(sent).toContain("the scale I built from G: G3 A3 B3 C4 D4 E4 F♯4");
  for (const t of [sent, echoed]) {
    expect(t, "the five pentatonic notes are not sent as the answer").not.toMatch(/G3 A3 B3 D4 E4(?! )/);
    expect(t).not.toContain("degrees 1 2 3 5 6");
  }
});

test("the bar buttons (U09.L01 S6): the bar picked, not the bar where the section starts", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await wrongCheck(page, "after U08.L05", "U09.L01", "S6", "bar 5, the second phrase of the first section");
  const { sent, echoed } = await echo(page, "Where does the second section start?");
  expect(sent).toContain("My answer: bar 5");
  expect(sent).not.toMatch(/bar 9\b/);
  expect(sent).not.toContain('"number":9');
  expect(echoed).not.toMatch(/bar 9\b/);
});

test("match this sound (A1.L02 S4): the learner's own code, never the hidden target's cutoff", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seed(page, "side lesson offered");
  await setQuiet(page, false);
  const ex = await exerciseOf("A1.L02", "S4");
  const wrong = ex.tests.find((t) => t.expect === "fail" && typeof t.response.code === "string");
  await page.goto("/learn/A1.L02?step=S4");
  await stepIs(page, "S4");
  await setCode(page, wrong?.response.code as string);
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail", { timeout: 30_000 });
  const { sent, echoed } = await echo(page, "Is my cutoff close?");
  expect(sent).toContain(".lpf(4000)");
  for (const t of [sent, echoed]) expect(t, "the target's .lpf(400) is not sent").not.toMatch(/lpf\(400\)/);
});
