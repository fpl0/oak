// The two exemplar lessons against the real server, as a learner who finished the lessons before them: every
// step solved from its reference, a known-wrong variant first on the checked steps with its feedback, the
// keyboard-only path on a graded modify, resume after a reload, the Make inside the unit song, completion on the
// server (progress, sketch, unlocks), and the tutor's nudge through the fake backend.
import type { Page } from "@playwright/test";
import { stack } from "./playwright.config.ts";
import {
  completeLessons,
  expect,
  resetLessons,
  resetStep,
  setCode,
  snapshot,
  stepIs,
  submit,
  test,
  trialAnswer,
} from "./support.ts";

const H = { "X-Oak": "1" };
const api = async <T>(page: Page, path: string): Promise<T> => {
  const r = await page.request.get(`${stack.apiURL}/api${path}`, { headers: H });
  expect(r.ok()).toBe(true);
  return (await r.json()) as T;
};
const tempo = (bpm: number) => `setcpm(${bpm}/4)\n\n`;
const kickLine = (pattern: string, bpm = 120) => `${tempo(bpm)}drums: s("${pattern}")`;
const beatTimes = (bpm: number, n: number, every = 1) =>
  Array.from({ length: n }, (_, i) => Number((i * every * (60 / bpm)).toFixed(3)));

test.describe.configure({ mode: "serial" });

test("U01.L01 Heartbeat: every step, a wrong variant first, keyboard only on S6, resume, the Make", async ({
  page,
}) => {
  resetLessons(["U01.L01"]);
  completeLessons(["U00.L01", "U00.L02"]);
  await page.goto("/learn/U01.L01");

  // S1 listen over the band.
  await stepIs(page, "S1");
  await page.getByTestId("play-toggle").click();
  await expect(page.getByTestId("continue")).toHaveText(/Continue/, { timeout: 20_000 });
  await page.getByTestId("play-toggle").click();
  await page.getByTestId("continue").click();

  // S2 tap: on every other beat (wrong), then on every beat.
  await stepIs(page, "S2");
  expect((await submit(page, { taps: beatTimes(96, 4, 2) }))?.status).toBe("fail");
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail");
  expect((await submit(page, { taps: beatTimes(96, 8) }))?.status).toBe("pass");
  await expect(page.getByTestId("on-pass")).toContainText("pulse");
  await page.getByTestId("continue").click();

  // S3 predict.
  await stepIs(page, "S3");
  await page.locator('[data-option="faster"]').click();
  await page.getByTestId("check").click();
  await expect(page.getByTestId("predict-outcome")).toBeVisible();
  await page.getByTestId("continue").click();

  // S4 investigate.
  await stepIs(page, "S4");
  await page.locator('[data-option="hits"]').click();
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail");
  // The verdict locks the answer until Try again (docs/design/retry.md §2.5).
  await page.getByTestId("result-retry").click();
  await page.locator('[data-option="bpm"]').click();
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "pass");
  await page.getByTestId("continue").click();

  // S5 investigate: counted the next kick (wrong), then four.
  await stepIs(page, "S5");
  await page.locator('[data-question="1"] input').fill("5");
  await page.locator('[data-question="2"] [data-option="squeeze"]').click();
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail");
  await page.getByTestId("result-retry").click();
  await page.locator('[data-question="1"] input').fill("4");
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "pass");
  await page.getByTestId("continue").click();

  // S6 graded, keyboard only: edit the tempo in the editor, check with Mod+Shift+Enter, a hint with H.
  await stepIs(page, "S6");
  await expect(page.getByTestId("continue")).toBeDisabled();
  const editor = page.locator(".cm-content").first();
  await editor.getByText("80").dblclick();
  await page.keyboard.type("112");
  await page.keyboard.press("ControlOrMeta+Shift+Enter");
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail");
  await expect(page.getByTestId("continue")).toBeDisabled();
  await page.getByTestId("step-title").focus();
  await page.keyboard.press("h");
  await expect(page.getByTestId("hint-texts")).toContainText("Which line sets the speed?");
  await editor.getByText("112").dblclick();
  await page.keyboard.type("120");
  await page.keyboard.press("ControlOrMeta+Shift+Enter");
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "pass");
  await expect(page.getByTestId("on-pass")).toContainText("two beats every second");
  const s6 = await api<{ passed: boolean; rung: number; attempts: number }>(
    page,
    "/lessons/U01.L01/steps/S6",
  );
  expect(s6).toMatchObject({ passed: true, rung: 1, attempts: 2 });

  // A reload resumes at the step and its pass.
  await page.reload();
  await stepIs(page, "S6");
  await expect(page.getByTestId("continue")).toBeEnabled();
  await page.getByTestId("step-title").focus();
  await page.keyboard.press("Enter");

  // S7 graded: kept a snare (wrong), then a star.
  await stepIs(page, "S7");
  await setCode(page, kickLine("bd bd bd sd"));
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail");
  await setCode(page, kickLine("bd*4"));
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "pass");
  await page.getByTestId("continue").click();

  // S8 the Make inside the song: three to a bar leaves the required rule open ("Save anyway"); four ticks it.
  await stepIs(page, "S8");
  await setCode(page, kickLine("bd sd bd", 100));
  await page.getByTestId("play-toggle").click();
  await expect(page.locator('[data-rule="every-beat"]')).toHaveAttribute("data-ok", "0", { timeout: 20_000 });
  await expect(page.getByTestId("save-sketch")).toHaveText(/Save anyway/);
  // A tool this lesson has not opened yet (`< >` arrives in U01.L07) is refused in the Make, calmly.
  await setCode(page, `${tempo(118)}drums: s("<bd sd bd sd>")`);
  await page.getByTestId("play-toggle").click();
  await expect(page.getByTestId("locked-tool")).toContainText("U01.L07");
  await page.getByTestId("play-toggle").click();
  await setCode(page, `${tempo(118)}drums: s("bd cp bd cp")\nhats: s("hh*8")`);
  await page.getByTestId("play-toggle").click();
  await page.getByTestId("play-toggle").click();
  await expect(page.locator('[data-rule="every-beat"]')).toHaveAttribute("data-ok", "1", { timeout: 20_000 });
  await expect(page.locator('[data-rule="two-lines"]')).toHaveAttribute("data-ok", "1");
  // The Make plays inside the unit song (spec 2026-11-24-unit-songs-design.md §5.3): the transport's chips tell today's
  // code from Oak's parts, where the plain Band's "chords (band)" used to be.
  await expect(page.getByRole("button", { name: "drums (today's code)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chords (Oak)" })).toBeVisible();
  await page.getByTestId("play-toggle").click();
  await page.getByTestId("sketch-title").fill("My first heartbeat");
  await page.getByTestId("save-sketch").click();
  await expect(page.getByTestId("lesson-complete")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

  const progress = await api<{ lessons: { lessonId: string; status: string }[] }>(page, "/lessons/progress");
  expect(progress.lessons.find((l) => l.lessonId === "U01.L01")?.status).toBe("completed");
  const sketches = await api<{ items: { title: string; originKind: string; originId: string }[] }>(
    page,
    "/sketches",
  );
  expect(sketches.items.find((s) => s.title === "My first heartbeat")).toMatchObject({
    originKind: "lesson-make",
    originId: "U01.L01",
  });
});

test("U02.L01 High & Low: every step, the generated ear check, wrap up and resume", async ({ page }) => {
  resetLessons(["U02.L01"]);
  completeLessons([
    "U01.L01",
    "U01.L02",
    "U01.L03",
    "U01.L04",
    "U01.L05",
    "U01.L06",
    "U01.L07",
    "U01.L08",
    "U01.L09",
  ]);
  await page.goto("/learn/U02.L01");
  await stepIs(page, "S1");
  const ex = (await import("../../../../content/core/U02/L01/lesson.ts")).default;
  const step = (id: string) => ex.steps.find((s) => s.id === id);

  // S1 listen, S2 predict, S3 run.
  await page.getByTestId("continue").click();
  await stepIs(page, "S2");
  const predict = step("S2")?.exercise;
  const right =
    predict?.kind === "predict" && Array.isArray(predict.correct) ? (predict.correct[0] as string) : "";
  await page.locator(`[data-option="${right}"]`).click();
  await page.getByTestId("check").click();
  await expect(page.getByTestId("predict-outcome")).toBeVisible();
  await page.getByTestId("continue").click();
  await stepIs(page, "S3");
  await page.getByTestId("play-toggle").click();
  await expect(page.getByTestId("continue")).toHaveText(/Continue/);
  await page.getByTestId("play-toggle").click();
  await page.getByTestId("continue").click();

  // S4 investigate from its pinned test: the wrong one first.
  await stepIs(page, "S4");
  const s4 = step("S4")?.exercise;
  const tests = s4?.tests ?? [];
  const fail = tests.find((t) => t.expect === "fail");
  const pass = tests.find((t) => t.expect === "pass");
  const asParts = (r: unknown) => {
    const a = (r as { answer: { choice?: string[]; number?: number } }).answer;
    return { parts: [{ answer: { choice: a.choice } }, { answer: { number: a.number } }] };
  };
  expect((await submit(page, asParts(fail?.response)))?.status).toBe("fail");
  expect((await submit(page, asParts(pass?.response)))?.status).toBe("pass");
  await page.getByTestId("continue").click();

  // S5 graded modify: each fail test first, then the reference.
  await stepIs(page, "S5");
  const s5 = step("S5")?.exercise;
  for (const t of s5?.tests ?? []) {
    if (t.expect !== "fail" || !("code" in t.response)) continue;
    await setCode(page, t.response.code);
    await page.getByTestId("check").click();
    await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail");
    await expect(page.getByTestId("continue")).toBeDisabled();
    break;
  }
  const ref = s5?.kind === "code-modify" ? s5.reference.solutions[0] : "";
  await setCode(page, ref ?? "");
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "pass");
  await page.getByTestId("continue").click();

  // S6 the generated ear check (fam.pit.compare): a wrong choice, then the trial's own answer.
  await stepIs(page, "S6");
  await expect(page.getByTestId("play-stimulus")).toBeVisible();
  const answer = (await trialAnswer(page))?.choice?.[0] ?? "";
  const wrong = ["higher", "lower", "same"].find((c) => c !== answer) ?? "";
  await page.locator(`[data-option="${wrong}"]`).click();
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail");
  await page.getByTestId("result-retry").click();
  await page.locator(`[data-option="${answer}"]`).click();
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "pass");

  // Wrap up before the Make: a Quick sketch, then the lesson keeps its place.
  await page.getByTestId("wrap-up").click();
  await expect(page.getByTestId("quick-sketch")).toBeVisible();
  await page.getByTestId("save-quick").click();
  await expect(page.getByTestId("lesson-complete")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved for next time" })).toBeVisible();
  const progress = await api<{ lessons: { lessonId: string; status: string; currentStep: string | null }[] }>(
    page,
    "/lessons/progress",
  );
  expect(progress.lessons.find((l) => l.lessonId === "U02.L01")?.status).toBe("in_progress");

  // Back in: the passed checks stand; on to the Make.
  await page.goto("/learn/U02.L01");
  await expect(page.getByTestId("lesson-step")).toBeVisible();
  const at = (await snapshot(page))?.stepId ?? "";
  expect(["S5", "S6", "S7"]).toContain(at);
  while (((await snapshot(page))?.stepId ?? "") !== "S7") {
    await expect(page.getByTestId("continue")).toBeEnabled();
    await page.getByTestId("continue").click();
  }
  const make = step("S7")?.exercise;
  const minimal = make?.tests.find((t) => t.expect === "pass");
  await setCode(page, minimal && "code" in minimal.response ? minimal.response.code : "");
  await page.getByTestId("play-toggle").click();
  await expect(page.locator('[data-rule="three-heights"]')).toHaveAttribute("data-ok", "1", {
    timeout: 20_000,
  });
  await page.getByTestId("play-toggle").click();
  await page.getByTestId("save-sketch").click();
  await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible({ timeout: 30_000 });
});

test("the tutor nudges a failed graded step through the fake backend and the rung advances", async ({
  page,
}) => {
  completeLessons(["U00.L01", "U00.L02"]);
  resetStep("U01.L01", "S7");
  await page.goto("/learn/U01.L01?step=S7");
  await stepIs(page, "S7");
  await setCode(page, kickLine("bd bd bd"));
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail");
  const before = await api<{ rung: number }>(page, "/lessons/U01.L01/steps/S7");
  await expect(page.getByTestId("continue")).toBeDisabled();
  await page.getByTestId("ask-nudge").click();
  await expect(page.getByRole("complementary", { name: /tutor/i })).toBeVisible();
  await expect
    .poll(async () => (await api<{ rung: number }>(page, "/lessons/U01.L01/steps/S7")).rung, {
      timeout: 30_000,
    })
    .toBe(before.rung + 1);
  await expect(page.getByTestId("hint-dots")).toHaveAttribute(
    "aria-label",
    `Hints used: ${before.rung + 1} of 4`,
    {
      timeout: 15_000,
    },
  );
});

test("Report a grading problem saves the report and opens Continue at once", async ({ page }) => {
  completeLessons(["U00.L01", "U00.L02"]);
  resetStep("U01.L01", "S7");
  await page.goto("/learn/U01.L01?step=S7");
  await stepIs(page, "S7");
  await setCode(page, kickLine("bd bd bd sd"));
  await page.getByTestId("check").click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "fail");
  await expect(page.getByTestId("continue")).toBeDisabled();
  await page.getByTestId("report-problem").click();
  await page.getByTestId("report-note").fill("I think a snare on 4 should count.");
  await page.getByTestId("send-report").click();
  await expect(page.getByTestId("continue")).toBeEnabled();
  const qa = await api<{ items: { stepId: string | null; note: string | null; kind: string }[] }>(
    page,
    "/dev/qa",
  );
  expect(qa.items.find((r) => r.stepId === "S7")).toMatchObject({
    kind: "lesson-step",
    note: "I think a snare on 4 should count.",
  });
});

test("at the 15-minute target U01.L01 splits: part A ends at wrapAt with a Quick sketch, part B starts after it", async ({
  page,
}) => {
  const put = (targetMinutes: number) =>
    page.evaluate(
      (t) =>
        fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Oak": "1" },
          body: JSON.stringify({ targetMinutes: t }),
        }).then((r) => r.status),
      targetMinutes,
    );
  resetLessons(["U01.L01"]);
  completeLessons(["U00.L01", "U00.L02"]);
  await page.goto("/");
  expect(await put(15)).toBe(200);
  try {
    await page.goto("/learn/U01.L01?step=S6");
    await stepIs(page, "S6");
    await setCode(page, `${tempo(120)}drums: s("bd sd bd sd")\nhats: s("hh*8")`);
    await page.getByTestId("check").click();
    await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "pass");
    await expect(page.getByTestId("continue")).toHaveText(/Finish part A/);
    await page.getByTestId("continue").click();
    await expect(page.getByTestId("quick-sketch")).toContainText("That's part A");
    await page.getByTestId("save-quick").click();
    await expect(page.getByRole("heading", { name: "Part A done" })).toBeVisible();
    const progress = await api<{ lessons: { lessonId: string; splitPart: string | null }[] }>(
      page,
      "/lessons/progress",
    );
    expect(progress.lessons.find((l) => l.lessonId === "U01.L01")?.splitPart).toBe("A");

    await page.goto("/learn/U01.L01");
    await stepIs(page, "S7");
    await expect(page.getByText("Part B", { exact: true })).toBeVisible();
    await page.getByTestId("step-title").focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await stepIs(page, "S7");
  } finally {
    await put(20);
  }
});
