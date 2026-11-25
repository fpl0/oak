// U05.CP, U06.CP and U07.CP in the real app from their dev seeds ("U05.CP due" …, wave4.md §6): every item on
// screen is answered through its own widget wherever it has one (the staff by its typed note list, the quality pad,
// the RN palette, a staged chord dictation's three stages, options, the degree pad, the text field), else through
// the player's own grading path (code items, sung items on their targets, the Make from its passing test). The
// first widget item is answered wrong first and saved again right (a checkpoint shows no verdict per item, only
// "Answer saved"). The hand-in passes, by skill, with no raw IDs, and is stored on the server. Then one checkpoint
// to a soft pass (contracts §7.6): two attempts handed in empty fail; the third offers "Continue anyway", which
// soft-passes it and opens what a pass opens.
import type { Page } from "@playwright/test";
import { stack } from "./playwright.config.ts";
import { completeLessons, expect, test } from "./support.ts";
import { api, reseedFresh, seed, setQuiet } from "./w3support.ts";
import { answerWidget, enterStage, type PartLike, wrongFor } from "./walk.ts";

test.describe.configure({ mode: "serial" });
test.afterAll(async ({ request }) => {
  await request.put(`${stack.apiURL}/api/dev/clock`, {
    headers: { "X-Oak": "1", "Content-Type": "application/json", Origin: stack.baseURL },
    data: { reset: true },
  });
  await reseedFresh(request);
});

type Unit = "U05" | "U06" | "U07";
type Info = {
  kind: "family" | "authored" | "make" | null;
  ex: (PartLike & { tests?: PartLike["tests"] }) | null;
  exp: Record<string, unknown> | null;
  params: Record<string, unknown> | null;
  trialCode: string | null;
};
const info = (page: Page) =>
  page.evaluate(() => {
    const d = (
      globalThis as unknown as {
        __oakCheckpoint: {
          kind(): unknown;
          exercise(): unknown;
          expected(): unknown;
          params(): unknown;
          trialCode(): unknown;
        };
      }
    ).__oakCheckpoint;
    return {
      kind: d.kind(),
      ex: d.exercise(),
      exp: d.expected(),
      params: d.params(),
      trialCode: d.trialCode(),
    } as Info;
  });
const devAnswer = (page: Page, r: unknown) =>
  page.evaluate(
    (x) =>
      (
        globalThis as unknown as { __oakCheckpoint: { answer(r: unknown): Promise<void> } }
      ).__oakCheckpoint.answer(x),
    r,
  );

const RAW = /\btb\.|\bfam\.|\bcd\.|[{}]|undefined|NaN|\[object/;

/** The words a learner reads in a region (an engraved staff's own <style> is not text). */
const visibleText = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate(
    (el) => {
      const c = el.cloneNode(true) as HTMLElement;
      for (const s of c.querySelectorAll("style, script")) s.remove();
      return c.textContent ?? "";
    },
    undefined,
    { timeout: 20_000 },
  );

/** A dictation written right: the trial's tune line without its cue bar (`n("<~ A B>")` → `n("<A B>")`). */
function answerBarsCode(trialCode: string): string | null {
  const mel = trialCode
    .split("\n")
    .find((l) => l.startsWith("mel:"))
    ?.replace(/^mel:\s*/, "");
  const m = mel ? /n\("<~ (.*)>"\)/.exec(mel) : null;
  if (!mel || !m) return null;
  const bars = (m[1] as string).match(/\[[^[\]]*(?:\[[^\]]*\][^[\]]*)*\]|\S+/g) ?? [];
  const inner = bars.length === 1 ? bars[0] : `<${bars.join(" ")}>`;
  return mel.replace(m[0], `n("${inner}")`);
}

async function save(page: Page) {
  const check = page.getByTestId("check-stage").or(page.getByTestId("check"));
  await check.first().click();
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", "saved", {
    timeout: 20_000,
  });
}

async function startAttempt(page: Page, unit: Unit) {
  await page.goto(`/checkpoint/${unit}`);
  await expect(page.getByTestId("checkpoint-intro")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("start-checkpoint").click();
  await expect(page.getByTestId("hint")).toHaveCount(0);
}

async function makeCode(unit: Unit): Promise<string> {
  const def = (await import(`../../../../content/core/${unit}/CP/checkpoint.ts`)).default as {
    make: { tests: { expect: string; response: { code?: string } }[] };
  };
  const pass = def.make.tests.find((t) => t.expect === "pass" && typeof t.response.code === "string");
  return pass?.response.code as string;
}

/** Every item answered right (the first widget item wrong first); returns how each was answered. */
async function answerAll(page: Page, unit: Unit): Promise<string[]> {
  const kinds: string[] = [];
  let wrongDone = false;
  for (let i = 0; i < 40; i++) {
    const review = page.getByTestId("checkpoint-review");
    await expect(page.getByTestId("lesson-step").or(review)).toBeVisible({ timeout: 30_000 });
    if (await review.isVisible()) break;
    const it = await info(page);
    const ex = it.ex;
    expect(ex, "an item on screen").not.toBeNull();
    expect(await visibleText(page, "lesson-step"), "no raw IDs on the item").not.toMatch(RAW);
    if (it.kind === "make") {
      await devAnswer(page, { code: await makeCode(unit) });
      kinds.push("make");
      await expect(review).toBeVisible({ timeout: 30_000 });
      break;
    }
    if (ex?.kind === "sing") {
      const t = (it.params?.singTargets as { midi: number }[] | undefined) ?? [];
      expect(t.length, "a sung item has its targets").toBeGreaterThan(0);
      await devAnswer(page, { sung: t.map((x) => ({ midi: x.midi, cents: 3, credit: 1 })) });
      kinds.push("sing");
      continue;
    }
    const passTest = ex?.tests?.find((t) => t.expect === "pass");
    if (it.kind === "authored" && passTest && typeof passTest.response.code === "string") {
      // A code item is written in the item's Workbench (U07.CP "from the page" is a dictation in code).
      await expect(page.getByTestId("lesson-step").locator(".cm-editor").first()).toBeVisible({
        timeout: 30_000,
      });
      await devAnswer(page, { code: passTest.response.code });
      kinds.push(`code:${ex?.id}`);
      continue;
    }
    if (it.kind === "family" && ex?.answer?.ui === "code") {
      const code = (it.trialCode && answerBarsCode(it.trialCode)) ?? it.trialCode;
      expect(code, `${ex.id}: something to write`).toBeTruthy();
      await devAnswer(page, { code });
      kinds.push("code-family");
      continue;
    }
    const response: Record<string, unknown> =
      it.kind === "authored"
        ? (passTest?.response ?? { answer: ex?.correct ?? {} })
        : { answer: it.exp ?? {} };
    if (ex?.stageAnswers) {
      // A staged chord dictation: every stage answered, then one save (a checkpoint answers them together).
      const stages = (response.answer as { stages?: Record<string, string[]> }).stages ?? {};
      for (const [id, values] of Object.entries(stages)) await enterStage(page, ex, id, values);
      await save(page);
      kinds.push("ui:staged");
      await page.getByTestId("next-item").click();
      continue;
    }
    const ui = ex?.answer?.ui;
    if (
      !wrongDone &&
      ex &&
      it.kind === "family" &&
      ["choice", "degree-pad", "text", "quality-pad"].includes(ui ?? "")
    ) {
      const wrong = await wrongFor(page, ex, response.answer as Record<string, unknown>);
      if (await answerWidget(page, ex, wrong)) {
        await save(page);
        wrongDone = true;
        kinds.push("wrong-first");
      }
    }
    if (ex && (await answerWidget(page, ex, response))) {
      await save(page);
      kinds.push(`ui:${typeof response.staff === "string" ? "staff" : ui}`);
      await page.getByTestId("next-item").click();
    } else {
      await devAnswer(page, response);
      kinds.push(`dev:${ui}`);
    }
  }
  console.log(`[${unit}.CP items] ${kinds.join(", ")}`);
  return kinds;
}

/** Every item skipped, the Make saved: the hand-in counts nothing on the gating items. */
async function skipAll(page: Page, unit: Unit) {
  for (let i = 0; i < 40; i++) {
    const review = page.getByTestId("checkpoint-review");
    await expect(page.getByTestId("lesson-step").or(review)).toBeVisible({ timeout: 30_000 });
    if (await review.isVisible()) break;
    if ((await info(page)).kind === "make") {
      await devAnswer(page, { code: await makeCode(unit) });
      await expect(review).toBeVisible({ timeout: 30_000 });
      break;
    }
    await page.getByTestId("skip-item").click();
  }
}

async function cpStatus(page: Page, unit: Unit) {
  const prog = await api<{ checkpoints: { cpId: string; status: string; attempts: number }[] }>(
    page,
    "GET",
    "/lessons/progress",
  );
  return prog.body?.checkpoints.find((c) => c.cpId === `${unit}.CP`);
}

for (const unit of ["U05", "U06", "U07"] as const) {
  test(`${unit}.CP: every item answered on screen, one wrong then right, handed in, passed`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await seed(page, `${unit}.CP due`);
    await setQuiet(page, false);
    await startAttempt(page, unit);
    const kinds = await answerAll(page, unit);
    expect(kinds).toContain("make");
    expect(kinds, "one item was answered wrong first").toContain("wrong-first");
    expect(kinds.filter((k) => k.startsWith("ui:")).length, "items through their widgets").toBeGreaterThan(3);
    await expect(page.getByTestId("checkpoint-review")).toBeVisible();
    expect(await visibleText(page, "checkpoint-review")).not.toMatch(RAW);
    await page.getByTestId("hand-in").click();
    const result = page.getByTestId("checkpoint-result");
    await expect(result).toBeVisible({ timeout: 30_000 });
    await expect(result).toHaveAttribute("data-passed", "1");
    expect(await visibleText(page, "checkpoint-result")).not.toMatch(RAW);
    console.log(
      `[${unit}.CP result] ${((await result.textContent()) ?? "").replace(/\s+/g, " ").slice(0, 400)}`,
    );
    const values = await page
      .locator('[data-skill] [role="meter"]')
      .evaluateAll((els) => els.map((e) => Number(e.getAttribute("aria-valuenow"))));
    expect(values.length, "per-skill meters").toBeGreaterThan(2);
    expect(
      values.every((v) => v >= 0.999),
      `every skill at 100%: ${values.join(", ")}`,
    ).toBe(true);
    expect(await cpStatus(page, unit), `${unit}.CP on the server`).toMatchObject({
      status: "passed",
      attempts: 1,
    });
  });
}

test("U06.CP to a soft pass: two empty hand-ins fail, the third offers Continue anyway", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "U06.CP due");
  await setQuiet(page, false);
  for (const attempt of [1, 2]) {
    await startAttempt(page, "U06");
    await skipAll(page, "U06");
    await expect(
      page.getByTestId("continue-anyway"),
      `attempt ${attempt}: nothing offered at 0%`,
    ).toHaveCount(0);
    await page.getByTestId("hand-in").click();
    const result = page.getByTestId("checkpoint-result");
    await expect(result).toHaveAttribute("data-passed", "0", { timeout: 30_000 });
    await expect(result, "never shaming").not.toContainText(/failed|debt/i);
    expect(await cpStatus(page, "U06")).toMatchObject({ status: "failed", attempts: attempt });
    // A retake is another day's session.
    expect((await api(page, "PUT", "/dev/clock", { advanceDays: 1 })).status).toBe(200);
  }
  await startAttempt(page, "U06");
  await skipAll(page, "U06");
  const anyway = page.getByTestId("continue-anyway");
  await expect(anyway, "the third attempt offers Continue anyway").toBeVisible();
  await anyway.click();
  const result = page.getByTestId("checkpoint-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  expect(await visibleText(page, "checkpoint-result")).not.toMatch(RAW);
  await expect(result).not.toContainText(/failed|debt/i);
  console.log(
    `[U06.CP soft pass] ${((await result.textContent()) ?? "").replace(/\s+/g, " ").slice(0, 300)}`,
  );
  expect(await cpStatus(page, "U06")).toMatchObject({ status: "soft-passed", attempts: 3 });
  await expect(result).toContainText("The next lessons are open");
  // A soft pass opens what a pass opens: U07.L03 and on need U06.CP (contracts §7.6 rule 2). With U07.L02 and
  // U07.L11 (Oak 2.0 W2, between them in the default order) done, U07.L03 opens.
  completeLessons(["U07.L02", "U07.L11"]);
  await page.goto("/learn/U07.L03");
  await expect(page.getByTestId("lesson-step")).toHaveAttribute("data-step", "S1", { timeout: 30_000 });
  expect((await api(page, "PUT", "/dev/clock", { reset: true })).status).toBe(200);
});
