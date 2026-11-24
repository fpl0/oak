// U03.CP in Quiet mode against the real server (contracts §7.6): seeded to after U04.L01, every item is answered
// through the player's own grading path (the key signature in order, the tune moved to D, family items with the
// drawn answer, the Make over the unit's Band); the sung items are set aside, said so calmly, and never count.
// The whole U03.CP out of Quiet mode (every item, the Make, the result by skill) is walk-cp.pw.ts.
import type { Page } from "@playwright/test";
import { expect, test } from "./support.ts";
import { reseedFresh, seed, setQuiet } from "./w3support.ts";

test.afterAll(async ({ request }) => {
  await reseedFresh(request);
});

type Dev = {
  kind(): "family" | "authored" | "make" | null;
  expected(): Record<string, unknown> | null;
  params(): Record<string, unknown> | null;
  exercise(): { id: string; kind: string; reference?: { solutions: string[] } } | null;
  answer(r: unknown): Promise<void>;
};
const itemKind = (page: Page) =>
  page.evaluate(
    () => (globalThis as unknown as { __oakCheckpoint: Dev }).__oakCheckpoint.exercise()?.kind ?? null,
  );

/** Answers the item on screen from what the item itself knows (its reference, its trial), then moves on. */
async function answerItem(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const d = (globalThis as unknown as { __oakCheckpoint: Dev }).__oakCheckpoint;
    const kind = d.kind();
    const ex = d.exercise();
    const exp = d.expected() ?? {};
    const params = d.params() ?? {};
    if (kind === "make") {
      const starter = (ex as unknown as { code: { starter: string } }).code.starter;
      await d.answer({ code: starter.replace(/⟪|⟫/g, "").replace("[1 ~ ~ ~]>", "[0 ~ ~ ~]>") });
      return "make";
    }
    if (ex?.kind === "sing") {
      const t = (params.singTargets as { midi: number }[] | undefined) ?? [];
      await d.answer({ sung: t.map((x) => ({ midi: x.midi, cents: 3, credit: 1 })) });
      return "sing";
    }
    if (ex?.id === "keysig-eb") {
      await d.answer({ answer: { text: ["Bb", "Eb", "Ab"] } });
      return "keysig";
    }
    if (kind === "authored" && ex?.reference) {
      await d.answer({ code: ex.reference.solutions[0] });
      return "code";
    }
    if (kind === "authored") {
      await d.answer({ answer: (ex as unknown as { correct: unknown }).correct });
      return "fact";
    }
    await d.answer({ answer: exp });
    return "family";
  });
}

test.describe.configure({ mode: "serial" });

test("U03.CP in Quiet mode: the sung items are set aside and never count", async ({ page }) => {
  test.setTimeout(240_000);
  await seed(page, "after U04.L01");
  await setQuiet(page, true);
  await page.goto("/checkpoint/U03");
  await page.getByTestId("start-checkpoint").click();
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId("checkpoint-review").isVisible()) break;
    await expect(page.getByTestId("lesson-step")).toBeVisible();
    expect(await itemKind(page)).not.toBe("sing");
    await answerItem(page);
    await page.waitForTimeout(150);
  }
  // The server may already leave sung items out of a Quiet attempt; any it composed are set aside, calmly.
  await expect(page.getByTestId("checkpoint-review")).toBeVisible();
  const note = page.getByTestId("quiet-set-aside");
  if ((await note.count()) > 0) await expect(note).toContainText("Singing never counts against a checkpoint");
  await page.getByTestId("hand-in").click();
  await expect(page.getByTestId("checkpoint-result")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-skill="V02"]')).toHaveCount(0);
  await setQuiet(page, false);
});

test("U04.CP ear item: every play started from Play, first or replay, by key or mouse, hands the focus to the answer, and the Enter hint follows the focused control", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await seed(page, "U04.CP due");
  await setQuiet(page, false);
  await page.goto("/checkpoint/U04");
  await page.getByTestId("start-checkpoint").click();
  const play = page.getByTestId("play-stimulus");
  const plays = page.getByTestId("stimulus").getByText(/plays? included|Extra plays/);
  // The first item with a limited play allowance (UX review P3): skip until one is on screen.
  for (let i = 0; i < 12 && !(await plays.isVisible()); i++) {
    await page.getByTestId("skip-item").click();
    await page.waitForTimeout(250);
  }
  await expect(plays).toBeVisible();
  const enterHint = page
    .locator("[data-answer] kbd", { hasText: /^Enter$/ })
    .first()
    .locator("xpath=../..");
  const focusInAnswer = page.locator("[data-answer] :focus");
  const left = async () => (await plays.textContent()) ?? "";
  /** One press on Play spends exactly one play and leaves the focus on the answer, where Enter saves. */
  const pressSpendsOne = async (press: () => Promise<void>) => {
    const before = await left();
    await press();
    await expect(focusInAnswer).toHaveCount(1);
    await expect(enterHint).toContainText(/Enter\s*save/);
    // One play spent (the play starts once the sounds are loaded).
    await expect(plays).not.toHaveText(before, { timeout: 30_000 });
    const after = await left();
    // The next Enter goes to the answer: it never replays, so no further play is spent.
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    expect(await left()).toBe(after);
  };
  // On Play the hint says what Enter does there; pressing it starts one play and moves the focus to the answer.
  await play.focus();
  await expect(enterHint).toContainText(/Enter\s*play/);
  await pressSpendsOne(() => page.keyboard.press("Enter"));
  // A replay by key, once the first play has ended: the label it is pressed on, then the same hand-over.
  await expect(play).toHaveText(/Play again/, { timeout: 30_000 });
  await play.focus();
  await expect(enterHint).toContainText(/Enter\s*play again/);
  await pressSpendsOne(() => page.keyboard.press("Enter"));
  // A replay by mouse hands the focus over too, so the hint never names a label Play no longer shows.
  await expect(play).toHaveText(/Play again/, { timeout: 30_000 });
  await pressSpendsOne(() => play.click());
  await expect(enterHint).not.toContainText(/Enter\s*(stop|play)/);
});
