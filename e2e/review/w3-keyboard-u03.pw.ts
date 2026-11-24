// Wave 3 review: a whole U03 day from the keyboard alone (Tab, Shift+Tab, Enter, Space, digits, letters; never
// the mouse), with reduced motion, in Bark: Today → the warm-up (degree drills, fact cards, sung ways home) →
// U03.L03 "Degrees 4 & 5" step by step (choices, numbers, code typed into the editor, the degree pad, the sung
// patterns, the Make) → the Coda → Done for today. The page is only read (to know what the drawn trial asks);
// every action is a key press. Every control that takes focus shows a focus ring.
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { lessonDef } from "../../app/src/lesson/e2e/walk.ts";
import { textNow, useUiPrefs } from "../support/ui.ts";
import {
  api,
  noHmr,
  openToday,
  playsAndMoves,
  resetClock,
  reviewMic,
  seed,
  sessionEnd,
  shootAll,
  watch,
} from "./support.ts";

test.use({
  launchOptions: { args: reviewMic("hold-c4.wav") },
  permissions: ["microphone"],
  reducedMotion: "reduce",
  viewport: { width: 1280, height: 800 },
});

interface Active {
  id: string;
  text: string;
  tag: string;
  ring: boolean;
  scope: string;
  editable: boolean;
  option: string | null;
}

const active = (page: Page): Promise<Active> =>
  page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    if (!e || e === document.body)
      return { id: "body", text: "", tag: "body", ring: false, scope: "", editable: false, option: null };
    // The code editor draws its ring on its frame (the Workbench's editor box), not on the contenteditable.
    const ringed = (n: Element | null) => {
      if (!n) return false;
      const cs = getComputedStyle(n);
      return (
        (cs.outlineStyle !== "none" && Number.parseFloat(cs.outlineWidth) > 0) ||
        (cs.boxShadow !== "none" && cs.boxShadow !== "")
      );
    };
    const cm = e.closest(".cm-editor");
    const ring =
      ringed(e) ||
      (cm !== null && (ringed(cm.parentElement) || ringed(cm.parentElement?.parentElement ?? null)));
    const scoped = e.closest("[data-keyscope]") as HTMLElement | null;
    return {
      id: e.dataset.testid ?? "",
      text: (e.getAttribute("aria-label") || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
      tag: e.tagName.toLowerCase(),
      ring,
      scope: e.closest(".cm-editor") ? "editor" : (scoped?.dataset.keyscope ?? ""),
      editable: e.isContentEditable || e.tagName === "INPUT" || e.tagName === "TEXTAREA",
      option: e.getAttribute("data-option") ?? (e.hasAttribute("data-degree") ? "degree" : null),
    };
  });

/** Tab (or Shift+Tab) until the focused control matches; asserts that it shows a focus ring. */
async function tabTo(
  page: Page,
  match: (a: Active) => boolean,
  what: string,
  o: { back?: boolean; max?: number } = {},
): Promise<Active> {
  for (let i = -1; i < (o.max ?? 60); i++) {
    if (i >= 0) await page.keyboard.press(o.back ? "Shift+Tab" : "Tab");
    const a = await active(page);
    if (match(a)) {
      expect(a.ring, `focus ring on ${what} (${a.id || a.text})`).toBe(true);
      return a;
    }
  }
  throw new Error(`Tab never reached ${what}`);
}
const byId = (id: string) => (a: Active) => a.id === id;
const byText = (r: RegExp) => (a: Active) => r.test(a.text);

async function onStep(page: Page, id: string) {
  await expect(page.getByTestId("lesson-step")).toHaveAttribute("data-step", id, { timeout: 30_000 });
}

/** Leaves whatever has focus and puts it on the step's Continue, then presses Enter. */
async function continueStep(page: Page) {
  await expect(page.getByTestId("continue")).toBeEnabled({ timeout: 30_000 });
  const from = await page.getByTestId("lesson-step").getAttribute("data-step");
  await tabTo(page, byId("continue"), "Continue");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("lesson-step")).not.toHaveAttribute("data-step", from ?? "", {
    timeout: 30_000,
  });
  // The new step takes focus on its title (in place of a fixed 800 ms before the next Tab).
  await expect.poll(async () => (await active(page)).id, { timeout: 10_000 }).toBe("step-title");
  console.log(`[continue] ${from} -> ${await page.getByTestId("lesson-step").getAttribute("data-step")}`);
}

/** Check from anywhere, the documented chord (contracts §11.9): Mod+Shift+Enter. */
async function checkStep(page: Page, expectStatus: RegExp) {
  await page.keyboard.press("ControlOrMeta+Shift+Enter");
  await expect(page.getByTestId("step-feedback")).toHaveAttribute("data-status", expectStatus, {
    timeout: 30_000,
  });
}

/** Picks an option by keyboard: Tab into the group (one tab stop, roving focus), then its digit. */
async function pickOption(page: Page, scope: string, id: string) {
  const ids = await page
    .locator(`${scope} [data-option]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-option")));
  const at = ids.indexOf(id);
  expect(at, `option ${id} is shown`).toBeGreaterThanOrEqual(0);
  await tabTo(page, (a) => a.option !== null && ids.includes(a.option), `the options (${id})`);
  await page.keyboard.press(String(at + 1));
  await expect(page.locator(`${scope} [data-option="${id}"]`).first()).toHaveAttribute(
    "aria-checked",
    "true",
  );
}

type DrillTrial = { expected: { degrees?: string[]; choice?: string[]; text?: string[] }; seed: number };

/**
 * The warm-up, keys only. Returns how many sets were walked. A typed set (a scale to spell) is walked until two
 * trials have been answered by typing and moved on with Enter, and a degree set until a way home has been sung
 * (Enter on "Sing it home", the take) and the trial after it is up: each is then reported skipped (its further
 * trials repeat the same keys; w3-fet-mic walks a whole degree set by keys to its summary). Any other set (the
 * sung notes, Shift+S) is walked to its summary, which is left by keys.
 */
async function warmupByKeys(
  page: Page,
  budgetMs: number,
  maxSets: number,
): Promise<{ sets: number; sungHome: number }> {
  const deadline = Date.now() + budgetMs;
  const t0 = Date.now();
  const warmup = page.getByTestId("warmup");
  await expect(warmup).toBeVisible({ timeout: 60_000 });
  const out = { sets: 0, sungHome: 0 };
  let lastTrial = "";
  // This set's trials answered and ways home sung so far.
  let answered = 0;
  let sungHere = 0;
  const since = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
  while (Date.now() < deadline) {
    if (!(await warmup.isVisible().catch(() => false))) return out;
    if (out.sets >= maxSets) {
      await skipRestOfWarmup(page);
      return out;
    }
    const vis = async (id: string) =>
      page
        .getByTestId(id)
        .filter({ visible: true })
        .first()
        .isVisible()
        .catch(() => false);
    if (await vis("start-set")) {
      await expect(page.getByTestId("start-set")).toBeFocused({ timeout: 10_000 });
      await page.keyboard.press("Enter");
    } else if (await vis("passive-listen")) {
      await page.keyboard.press("Enter");
    } else if (await vis("listen-block")) {
      await page.keyboard.press("Enter");
    } else if (await vis("fact-summary")) {
      out.sets++;
      answered = 0;
      sungHere = 0;
      console.log(`[warm-up] facts summary at ${since()}`);
      expect((await active(page)).tag, "the fact summary's button has focus").toBe("button");
      await page.keyboard.press("Enter");
    } else if (await vis("fact-card")) {
      const a = await active(page);
      if (a.editable) {
        // An honest "I don't know": Tab to Flip the card.
        await tabTo(page, byText(/^Flip the card/), "Flip the card");
        await page.keyboard.press("Enter");
      } else {
        expect(a.tag, "the fact card's next button has focus").toBe("button");
        await page.keyboard.press("Enter");
      }
    } else if (await vis("set-summary")) {
      out.sets++;
      const fam = await page.evaluate(
        () => (globalThis as { __oakDrillTrial?: { family?: string } }).__oakDrillTrial?.family ?? "",
      );
      answered = 0;
      sungHere = 0;
      console.log(`[warm-up] ${fam} summary at ${since()}`);
      const a = await active(page);
      if (a.tag !== "button")
        await tabTo(page, byText(/^(Next set|On to|Continue|Done)/), "the summary's button");
      await page.keyboard.press("Enter");
    } else if (await vis("drill-start")) {
      // A sung trial waits for Start (main f492370). The focus stays on the drill runner (the answer pad's scope),
      // where Enter is the drill's Start key; on the Start button itself Enter presses it. Never another control.
      const a = await active(page);
      expect(a.id === "drill-start" || (a.tag !== "button" && !a.editable), "Enter reaches Start").toBe(true);
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("drill-start")).toHaveCount(0, { timeout: 10_000 });
    } else if (await vis("trial-feedback")) {
      const label = (
        (await page.getByTestId("next-trial").filter({ visible: true }).first().textContent()) ?? ""
      ).trim();
      if (/Sing it home/.test(label)) {
        out.sungHome++;
        sungHere++;
      }
      // Enter is "next" in the drill's scope (the way home, sung on the fake mic, then the next trial).
      await page.keyboard.press("Enter");
      if (/Sing it home/.test(label))
        await expect(page.getByTestId("trial-feedback")).toContainText(
          /Sung home|Sung\. The trace|Singing skipped/,
          {
            timeout: 30_000,
          },
        );
    } else {
      const stage = (await textNow(page.getByTestId("stage-text"))).trim();
      const counter = await textNow(page.getByTestId("trial-counter"));
      if (/your turn/i.test(stage) && counter !== lastTrial) {
        const t = await page.evaluate(
          () => (globalThis as { __oakDrillTrial?: DrillTrial }).__oakDrillTrial ?? null,
        );
        const a = await active(page);
        const typed = a.editable && !!t?.expected.text?.length;
        if (answered >= 2 && ((t?.expected.degrees?.length && sungHere > 0) || typed)) {
          // Every key path of this set taken: the rest of it reported skipped; the next set comes up.
          out.sets++;
          console.log(`[warm-up] ${await skipThisSet(page)} walked by keys to ${counter}, at ${since()}`);
          answered = 0;
          sungHere = 0;
          lastTrial = "";
          await expect(page.getByTestId("trial-counter").filter({ hasText: counter })).toHaveCount(0, {
            timeout: 30_000,
          });
          continue;
        }
        answered++;
        if (t?.expected.degrees?.length) {
          lastTrial = counter;
          for (const d of t.expected.degrees) await page.keyboard.press(d.replace(/^b/, ""));
          if (!(await vis("trial-feedback"))) await page.keyboard.press("Enter");
        } else if (a.editable && t?.expected.text?.length) {
          lastTrial = counter;
          await page.keyboard.type(t.expected.text.join(" "));
          await page.keyboard.press("Enter");
        } else if (/sing/i.test(stage)) {
          lastTrial = counter;
          await page.keyboard.press("Shift+S");
        }
      }
    }
    await page.waitForTimeout(300);
  }
  throw new Error("the warm-up did not finish in time");
}

// One U03 day from the keyboard, as two tests from the same seed (Wave 5 test speed: it was one test of two
// minutes): Today → Start → the warm-up by keys; then Today → Start → the lesson and the Coda by keys, the warm-up
// reported skipped through the session's dev hook. Every key path and assertion of the whole day is still made.
for (const part of ["the warm-up", "the lesson and the Coda"] as const)
  test(`a U03 day from the keyboard, with reduced motion: ${part}`, async ({ page, request }) => {
    await useUiPrefs(page, { theme: "bark", motion: "system" });
    await keyboardDay(page, request, part);
  });

async function keyboardDay(
  page: Page,
  request: APIRequestContext,
  part: "the warm-up" | "the lesson and the Coda",
): Promise<void> {
  test.setTimeout(180_000);
  await resetClock(request);
  await seed(request, "after U03.L02");
  await noHmr(page);
  const problems = watch(page);
  const ended = sessionEnd(page);
  const plan = await api<{ kind: string; mapItemId: string }>(request, "GET", "/api/session/today");
  expect(plan).toMatchObject({ kind: "lesson", mapItemId: "U03.L03" });
  await openToday(page);
  // Today has decided before Tab is pressed (under load the card shows before its Start button).
  await expect(page.getByTestId("start-session")).toBeVisible({ timeout: 30_000 });
  await tabTo(page, byId("start-session"), "Start session");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/session\/?$/);
  // Three sets by keys (the scale spelling, the degree set with its ways home sung, a sung set); the rest are
  // reported skipped through the session's dev hook so the spec stays short (the drill suites walk every family).
  const run = await warmupByKeys(page, 150_000, part === "the warm-up" ? 3 : 0);
  console.log(`[warm-up] ${JSON.stringify(run)}`);
  const def = await lessonDef("U03.L03");
  if (part === "the warm-up") {
    // The warm-up hands over to the lesson's first step.
    await onStep(page, def.steps.find((st) => !st.optional)?.id as string);
    expect(problems).toEqual([]);
    return;
  }

  for (const step of def.steps) {
    if (step.optional) continue;
    await onStep(page, step.id);
    const ex = step.exercise;
    console.log(
      `[step] ${step.id} ${step.kind} ${ex?.kind ?? ""} focus=${JSON.stringify(await active(page))}`,
    );
    if (!ex) {
      await continueStep(page);
      continue;
    }
    if (step.kind === "make") {
      const code = ex.tests.find((t) => t.expect === "pass")?.response.code as string;
      await typeCode(page, code);
      await expect(page.locator('[data-rule][data-ok="0"]').filter({ visible: true })).toHaveCount(0, {
        timeout: 30_000,
      });
      await shootAll(page, "w3-kbd-make");
      await tabTo(page, byId("save-sketch"), "Save");
      await page.keyboard.press("Enter");
      continue;
    }
    if (ex.kind === "listen" || (ex.kind === "run-investigate" && (ex.questions ?? []).length === 0)) {
      // Play from the keyboard: it plays and the transport moves on; then stop and go on. (Listening never gates;
      // a whole loop heard through to "Continue" is the lesson walkers' check, once per walker file.)
      await tabTo(page, byId("play-toggle"), "Play");
      await page.keyboard.press("Enter");
      await playsAndMoves(page);
      // Known (workbench, reported): the transport disables Play while it starts, and Chromium drops the focus
      // of a disabled button onto <body>. Tab back to Stop.
      await tabTo(page, byId("play-toggle"), "Stop");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("play-toggle").first()).toHaveAttribute("aria-pressed", "false");
      await continueStep(page);
      continue;
    }
    if (ex.kind === "predict") {
      const opt = page.getByTestId("lesson-step").locator("[data-option]").first();
      const id = (await opt.getAttribute("data-option")) as string;
      await pickOption(page, '[data-testid="lesson-step"]', id);
      await tabTo(page, byId("check"), "Check");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("predict-outcome")).toBeVisible();
      await continueStep(page);
      continue;
    }
    if (ex.kind === "run-investigate") {
      const pass = ex.tests.find((t) => t.expect === "pass")?.response.answer as {
        choice?: string[];
        number?: number;
      };
      for (const [i, q] of (ex.questions ?? []).entries()) {
        const box = `[data-question="${i + 1}"]`;
        if (q.q === "choice") {
          const ids = new Set((q.options ?? []).map((o) => o.id));
          await pickOption(page, box, (pass.choice ?? []).find((c) => ids.has(c)) as string);
        } else {
          await tabTo(page, (a) => a.editable && a.tag === "input", `question ${i + 1}'s field`);
          await page.keyboard.type(String(pass.number));
        }
      }
      await checkStep(page, /pass/);
      await continueStep(page);
      continue;
    }
    if (["code-modify", "code-make"].includes(ex.kind)) {
      const code = ex.tests.find((t) => t.expect === "pass")?.response.code as string;
      const starter = ex.code?.starter ?? "";
      const open = starter.indexOf("⟪");
      const close = starter.indexOf("⟫");
      if (open >= 0 && close > open) {
        // A region-locked starter: the learner edits only the boxed part. Untouched, Check names it.
        await checkStep(page, /fail/);
        await expect(page.getByTestId("step-feedback")).toContainText("Nothing changed yet");
        await expect(page.getByTestId("step-feedback")).not.toContainText("thing to look at");
        await expect(page.locator(".oak-mark-target").first()).toBeVisible();
        await shootAll(page, `w3-kbd-${step.id}-region`);
        const before = starter.slice(0, open);
        const after = starter.slice(close + 1);
        await typeRegion(
          page,
          starter.slice(open + 1, close),
          code.slice(before.length, code.length - after.length),
        );
      } else await typeCode(page, code);
      await checkStep(page, /pass/);
      await continueStep(page);
      continue;
    }
    if (ex.kind === "sing" || ex.kind === "all") {
      // Sing from the keyboard: Tab to Sing, Enter; the fake mic holds a C. Then on, whatever the take said.
      const sing = await page.getByRole("button", { name: "Sing", exact: true }).count();
      if (sing > 0) {
        await tabTo(page, (a) => a.text === "Sing", "Sing");
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("sing-phase").first()).toHaveText(/Done/, { timeout: 60_000 });
        await shootAll(page, `w3-kbd-${step.id}-take`);
      }
      await continueStep(page);
      continue;
    }
    // Answer kinds: the drawn trial (the degree pad) or the step's own test (a choice).
    if (ex.answer?.ui === "degree-pad") {
      const t = (await page.evaluate(
        () => (globalThis as { __oakLesson?: { trial(): unknown } }).__oakLesson?.trial() ?? null,
      )) as { degrees?: string[] } | null;
      const play = page.getByTestId("play-stimulus");
      if ((await play.count()) > 0) {
        await tabTo(page, byId("play-stimulus"), "Play");
        await page.keyboard.press("Enter");
      }
      await tabTo(page, (a) => a.option === "degree", "the degree pad");
      for (const d of t?.degrees ?? []) await page.keyboard.press(d);
      await checkStep(page, /pass/);
      await continueStep(page);
      continue;
    }
    if (ex.answer?.ui === "choice") {
      const pass = ex.tests.find((t) => t.expect === "pass")?.response.answer as { choice: string[] };
      const play = page.getByTestId("play-stimulus");
      if ((await play.count()) > 0) {
        await tabTo(page, byId("play-stimulus"), "Play");
        await page.keyboard.press("Enter");
      }
      await pickOption(page, '[data-testid="lesson-step"]', pass.choice[0] as string);
      await checkStep(page, /pass/);
      await continueStep(page);
      continue;
    }
    throw new Error(`no keyboard path for ${step.id} (${ex.kind}, ${ex.answer?.ui})`);
  }

  await expect(page).toHaveURL(/\/session\/coda$/, { timeout: 60_000 });
  const moment = page.getByTestId("coda-unlock-moment");
  // The moment plays only for tools this session unlocked: with none, it is absent at once (no 5-s wait).
  const shows =
    (await ended()).unlocks.length > 0 &&
    (await moment
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false));
  if (!shows) await expect(moment).toHaveCount(0);
  if (shows) {
    await shootAll(page, "w3-kbd-coda-moment");
    await tabTo(page, byText(/See the rest of today/), "See the rest of today");
    await page.keyboard.press("Enter");
  }
  await tabTo(page, byId("done-for-today"), "Done for today");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "done");
  const prog = await api<{ lessons: { lessonId: string; status: string }[] }>(
    request,
    "GET",
    "/api/lessons/progress",
  );
  expect(prog.lessons.find((l) => l.lessonId === "U03.L03")?.status).toBe("completed");
  expect(problems).toEqual([]);
}

type SessionHandle = {
  report(r: unknown): void;
  state(): { plan: { warmup: { items: { id: string; familyId: string }[] } } | null; warmupIndex: number };
};

/** Reports the warm-up set on screen skipped (`__oakSession`); returns its family. */
async function skipThisSet(page: Page): Promise<string> {
  return page.evaluate(() => {
    const o = (window as never as { __oakSession: SessionHandle }).__oakSession;
    const st = o.state();
    const item = st.plan?.warmup.items[st.warmupIndex];
    if (!item) throw new Error("no warm-up set on screen");
    o.report({
      block: "warmup",
      source: "drills",
      warmupItemId: item.id,
      drillSessionId: null,
      meanCredit: null,
      skipped: true,
    });
    return item.familyId;
  });
}

/** Reports every warm-up set not done yet as skipped (`__oakSession`, the session runner's dev hook). */
async function skipRestOfWarmup(page: Page): Promise<void> {
  await page.evaluate(() => {
    const o = (window as never as { __oakSession: SessionHandle }).__oakSession;
    for (const item of o.state().plan?.warmup.items ?? [])
      o.report({
        block: "warmup",
        source: "drills",
        warmupItemId: item.id,
        drillSessionId: null,
        meanCredit: null,
        skipped: true,
      });
  });
  await expect(page.getByTestId("warmup")).toBeHidden({ timeout: 30_000 });
}

/**
 * Tabs into a region-locked editor: the caret lands at the end of the boxed region (never on a locked line), so
 * Shift+Left over the old text and typing replaces it.
 */
async function typeRegion(page: Page, old: string, next: string) {
  await tabTo(page, (a) => a.editable && a.scope === "editor", "the code editor");
  for (let i = 0; i < old.length; i++) await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.insertText(next);
  await expect(page.locator(".cm-content").first()).toContainText(next);
  await page.keyboard.press("Escape");
}

/** Tabs into the code editor and replaces its text by typing (select all, then the new code). */
async function typeCode(page: Page, code: string) {
  await tabTo(page, (a) => a.editable && a.scope === "editor", "the code editor");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  // CodeMirror auto-closes brackets and quotes: insert the text as one input, as a paste would.
  await page.keyboard.insertText(code);
  // Escape leaves the editor (Tab is indentation inside it only when the learner opts in).
  await page.keyboard.press("Escape");
}
