// Wave 5 stage E ear training on the real Oak server (own stack, throwaway data), each test from the dev seed
// "after U11.L05" (U08–U11.L05 done: the minor degrees, the twelve bars, form by ear and the bass lines open at the
// levels the course gives them): a minor-degree set whose way home is sung on Chromium's fake microphone (do-based:
// ♭3 2 1 is me re do), the same family in Quiet mode (the mic never opens), a bass-line dictation answered in code
// right and then wrong (root motion first where the line has more notes than chords), a twelve-bar set (the bar
// that sounds lit in the chart, the numerals revealed, a bar heard alone), a form trial labelled on the form widget,
// the after-answer listening of major or minor, and the hub's stage E with graduation read as progress. Every trial
// record the runner posts is read back from the wire. Nothing is patched: what the page shows is the server's.
import { fileURLToPath } from "node:url";
import type { DrillTrialRecord, Trial } from "@oak/api";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const HEADERS = { "X-Oak": "1", Origin: stack.baseURL, "Content-Type": "application/json" };
const POINT = "after U11.L05";

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|501|Not Implemented/i.test(m.text()))
      problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

function trialPosts(page: Page): Map<number, DrillTrialRecord> {
  const out = new Map<number, DrillTrialRecord>();
  page.on("request", (r) => {
    if (r.method() !== "POST" || !/\/api\/drills\/sessions\/[^/]+\/trials$/.test(r.url())) return;
    const body = r.postDataJSON() as { trials: DrillTrialRecord[] };
    for (const t of body.trials) out.set(t.idx, t);
  });
  return out;
}

async function countMic(page: Page): Promise<() => number> {
  let asked = 0;
  await page.exposeFunction("__w5MicAsked", () => {
    asked++;
  });
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    if (!md) return;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = (c) => {
      (window as unknown as { __w5MicAsked(): void }).__w5MicAsked();
      return orig(c);
    };
  });
  return () => asked;
}

async function seed(page: Page, point = POINT): Promise<void> {
  await page.request.put(`${stack.apiURL}/api/dev/clock`, { headers: HEADERS, data: { reset: true } });
  const res = await page.request.post(`${stack.apiURL}/api/dev/seed`, {
    headers: HEADERS,
    data: { point },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

async function prepare(page: Page, opts: { quiet?: boolean; theme?: "paper" | "bark" } = {}): Promise<void> {
  // Other engineers' edits must not reload the page mid-test (wave3.md §8).
  await page.routeWebSocket(/.*/, () => {});
  await useUiPrefs(page, { theme: opts.theme ?? "paper" });
  if (opts.quiet !== undefined) {
    const res = await page.request.put(`${stack.apiURL}/api/voice/quiet`, {
      headers: HEADERS,
      data: { quiet: opts.quiet, scope: "today" },
    });
    expect(res.ok(), await res.text()).toBe(true);
  }
}

async function startPractice(page: Page, familyId: string, level = 1): Promise<void> {
  await page.goto(`/practice/${familyId}`);
  await expect(page.getByTestId("start-set")).toBeFocused({ timeout: 60_000 });
  const down = page.getByRole("button", { name: "Decrease Start at level" });
  while (await down.isEnabled()) await down.click();
  for (let l = 1; l < level; l++) await page.getByRole("button", { name: "Increase Start at level" }).click();
  if (level > 1) await expect(page.getByText(new RegExp(`^Level ${level}: `))).toBeVisible();
  await page.getByTestId("start-set").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("trial-counter")).toHaveText(/Trial 1 of \d+/, { timeout: 60_000 });
}

async function currentTrial(page: Page): Promise<Trial> {
  return (await page.evaluate(() => (globalThis as { __oakDrillTrial?: unknown }).__oakDrillTrial)) as Trial;
}
async function trialNo(page: Page, n: number, of: number): Promise<Trial> {
  await expect(page.getByTestId("trial-counter")).toHaveText(`Trial ${n} of ${of}`, { timeout: 30_000 });
  await expect.poll(async () => (await currentTrial(page))?.seed !== undefined).toBe(true);
  return currentTrial(page);
}

/** Both themes at both sizes: the primary action in view, no horizontal overflow; back to Paper 1440×900. */
async function frameMatrix(page: Page, name: string, primary = "next-trial"): Promise<void> {
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((theme) => document.documentElement.setAttribute("data-theme", theme), m.theme);
    await expect(page.getByTestId(primary)).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, name, m.theme);
  }
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "paper"));
  await page.setViewportSize({ width: 1440, height: 900 });
}

const digit = (d: string) => d.replace(/^[b#]/, "");

test.describe.configure({ mode: "serial" });

test("minor degrees: the minor cadence, the ♭3 ♭6 ♭7 pad, and the way home sung on the fake mic", async ({
  page,
}) => {
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page);
  await prepare(page, { quiet: false });
  await startPractice(page, "fam.deg.fet-minor", 3);
  const total = 8;
  let sung = 0;
  for (let i = 0; i < total; i++) {
    const t = await trialNo(page, i + 1, total);
    expect((t.params.key as { mode: string }).mode).toBe("minor");
    if (i === 0) {
      await expect(page.getByTestId("trial-prompt")).toHaveText(
        "After the minor cadence: which degree was the last note?",
      );
      const pad = page.getByRole("group", { name: "Your answer: which degree?" });
      await expect(pad).toBeVisible();
      // Do-based minor: the pad offers ♭3 ♭6 ♭7 (me le te), never 3 6 7 at this level.
      for (const name of ["flat 3, me", "flat 6, le", "flat 7, te"])
        await expect(pad.getByRole("radio", { name })).toHaveCount(1);
      await expect(pad.getByRole("radio", { name: "3, mi" })).toHaveCount(0);
      await shoot(page, SHOTS, "w5-minor-answering", "paper");
    }
    const want = (t.expected.degrees ?? [])[0] as string;
    await page.keyboard.press(digit(want));
    const feedback = page.getByTestId("trial-feedback");
    await expect(feedback).toHaveAttribute("data-correct", "true");
    // After every answer: the note alone, and in context.
    await expect(page.getByTestId("hear-alone")).toHaveText(/The note alone/);
    await expect(page.getByTestId("hear-in-context")).toBeVisible();
    const next = page.getByTestId("next-trial");
    if ((await next.textContent())?.includes("Sing it home")) {
      sung++;
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("pitch-lane")).toBeVisible();
      await expect(feedback).toContainText(/Sung home|Sung\. The trace|Singing skipped/, { timeout: 30_000 });
      // The way home in the learner's words, do-based (♭3 2 1 · me re do).
      const home = page.getByTestId("way-home");
      await expect(home).toBeVisible();
      const text = (await home.textContent()) ?? "";
      expect(text.startsWith(`The way home: ${want.replace(/^b/, "♭")}`)).toBe(true);
      if (want === "b3") expect(text).toContain("me");
      if (want === "b6") expect(text).toContain("le");
      if (want === "b7") expect(text).toContain("te");
      if (sung === 1) await frameMatrix(page, "w5-minor-sung-home");
    } else if (i === 1) {
      await page.keyboard.press("l");
      await expect(page.getByTestId("stage-text")).toHaveText(/Playing|Listen back/);
    }
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("set-summary")).toBeVisible({ timeout: 30_000 });
  expect(sung).toBe(2);
  expect(posts.size).toBe(total);
  const withRes = [...posts.values()].filter((r) => r.sungResolution);
  expect(withRes).toHaveLength(2);
  for (const r of withRes) {
    expect(r.modality).toBe("normal");
    expect(r.sungResolution).toMatchObject({ quiet: false, skipped: false });
    expect(r.sungResolution?.path.at(-1)).toBe("1");
    expect(r.sungResolution?.notes.length).toBe(r.sungResolution?.path.length);
  }
  for (const r of posts.values()) expect(r.correct).toBe(true);
  expect(problems).toEqual([]);
});

test("minor degrees in Quiet mode: the way home is heard and imagined, and the mic never opens", async ({
  page,
}) => {
  const problems = watch(page);
  const posts = trialPosts(page);
  const micAsked = await countMic(page);
  await seed(page);
  await prepare(page, { quiet: true, theme: "bark" });
  await startPractice(page, "fam.deg.fet-minor", 3);
  let heard = 0;
  for (let i = 0; i < 8; i++) {
    const t = await trialNo(page, i + 1, 8);
    await page.keyboard.press(digit((t.expected.degrees ?? [])[0] as string));
    await expect(page.getByTestId("trial-feedback")).toBeVisible();
    const next = page.getByTestId("next-trial");
    if ((await next.textContent())?.includes("Hear it home")) {
      heard++;
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("quiet-resolution")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("way-home")).toBeVisible();
      if (heard === 1) await shoot(page, SHOTS, "w5-minor-quiet", "bark");
      await page.keyboard.press("Space");
      await expect(page.getByTestId("trial-feedback")).toContainText("Heard home, in your head.");
    }
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("set-summary")).toBeVisible({ timeout: 30_000 });
  expect(heard).toBe(2);
  expect(micAsked()).toBe(0);
  const quiet = [...posts.values()].filter((r) => r.sungResolution);
  expect(quiet).toHaveLength(2);
  for (const r of quiet) expect(r.sungResolution).toMatchObject({ quiet: true, notes: [], credit: 0 });
  expect(problems).toEqual([]);
});

interface BassLine {
  code: string;
  roots: string[];
  staged: boolean;
}
async function bassLine(page: Page): Promise<BassLine> {
  await expect
    .poll(async () =>
      page.evaluate(() => (globalThis as { __oakDrillBassLine?: unknown }).__oakDrillBassLine),
    )
    .not.toBeNull();
  return (await page.evaluate(
    () => (globalThis as { __oakDrillBassLine?: unknown }).__oakDrillBassLine,
  )) as BassLine;
}

/** Writes a bass trial's line in code: the roots first when it is staged, then the line. */
async function writeLine(page: Page, line: BassLine, code: string, shot?: string): Promise<void> {
  if (line.staged) {
    await expect(page.getByTestId("step-prompt")).toHaveText("Step 1 · The root under each chord.");
    // The roots step is answered on the pad: the line's modes are offered only once the line is asked for.
    await expect(page.getByTestId("dictation-mode")).toHaveCount(0);
    for (const d of line.roots) await page.keyboard.press(digit(d));
    await page.getByTestId("check-answer").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("step-prompt")).toHaveText(
      "Step 2 · The whole line, passing notes and all.",
    );
    await expect(page.getByTestId("roots-found")).toBeVisible();
  }
  await expect(page.getByTestId("dictation-mode")).toBeVisible();
  await page.getByTestId("dictation-mode").locator('[data-mode="code"]').click();
  await expect(page.getByTestId("trial-prompt")).toHaveText(
    "Write the bass line as code: n is the degree − 1, in any octave.",
  );
  const box = page.getByRole("textbox", { name: "Your answer: the code" });
  await expect(box).toHaveValue(/^n\("<>"\)\.scale\("[A-G][b#]?\d:(major|minor)"\)\.s\("/);
  await box.fill(code);
  await expect(page.getByTestId("play-mine")).toBeEnabled();
  if (shot) await shoot(page, SHOTS, shot, "paper");
  await page.getByTestId("check-answer").click();
}

test("bass-line dictation: the line written as code, right and then wrong (root motion first)", async ({
  page,
}) => {
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page);
  await prepare(page);
  // d23: trial 2 is drawn on purpose as a staged line (more notes than chords, eight roots at this level), the
  // case whose feedback once pushed "Next" below the fold at 1280×800; before, one run in five drew it.
  await page.addInitScript(() => {
    (globalThis as { __oakDrillForce?: unknown }).__oakDrillForce = { 1: { category: "lines", level: 5 } };
  });
  await startPractice(page, "fam.har.bass", 5);
  // The mode switch ("Write it as") is asserted visible in `writeLine`, once the line is asked for: a staged trial
  // (more notes than chords) asks for its roots first, and the switch is not offered on that step (a random draw;
  // checking it here failed whenever trial 1 was staged).
  // Right.
  await trialNo(page, 1, 4);
  const first = await bassLine(page);
  await writeLine(page, first, first.code, "w5-bass-code");
  const feedback = page.getByTestId("trial-feedback");
  await expect(feedback).toHaveAttribute("data-correct", "true");
  await expect(page.getByTestId("hear-bass")).toBeVisible();
  await page.keyboard.press("Enter");
  // Wrong: the first note a step off.
  await trialNo(page, 2, 4);
  const second = await bassLine(page);
  expect(second.staged).toBe(true);
  const wrong = second.code.replace(/<\[?(\d)/, (m, d) => m.replace(d, String((Number(d) + 1) % 7)));
  await writeLine(page, second, wrong);
  await expect(feedback).toHaveAttribute("data-correct", "false");
  await expect(feedback).toContainText('It was n("<');
  await frameMatrix(page, "w5-bass-wrong");
  await page.keyboard.press("Enter");
  // The roots on the pad (the default mode) for the rest.
  for (const n of [3, 4]) {
    const t = await trialNo(page, n, 4);
    const line = await bassLine(page);
    if (line.staged) {
      for (const d of line.roots) await page.keyboard.press(digit(d));
      await page.getByTestId("check-answer").focus();
      await page.keyboard.press("Enter");
    }
    for (const d of t.expected.degrees ?? []) await page.keyboard.press(digit(d));
    // A full pad checks itself; a staged line is checked with Enter.
    if (line.staged) {
      await page.getByTestId("check-answer").focus();
      await page.keyboard.press("Enter");
    }
    await expect(feedback).toHaveAttribute("data-correct", "true");
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("set-summary")).toBeVisible({ timeout: 30_000 });
  const recs = [...posts.values()].sort((a, b) => a.idx - b.idx);
  expect(recs).toHaveLength(4);
  expect(recs[0]).toMatchObject({ correct: true, credit: 1 });
  expect(recs[0]?.response.answer?.text?.[0]).toBe(first.code);
  expect(recs[1]?.correct).toBe(false);
  expect(recs[1]?.response.answer?.text?.[0]).toBe(wrong);
  if (second.staged) expect(recs[1]?.response.answer?.stages?.bass).toEqual(second.roots);
  expect(problems).toEqual([]);
});

test("the twelve bars: the chart lights the bar that sounds, the numerals after the answer, a bar alone", async ({
  page,
}) => {
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page);
  await prepare(page);
  await startPractice(page, "fam.frm.blues", 1);
  const total = 6;
  for (let i = 0; i < total; i++) {
    const t = await trialNo(page, i + 1, total);
    const chart = page.getByTestId("bar-chart");
    await expect(chart).toBeVisible();
    await expect(chart.locator("[data-bar]")).toHaveCount(12);
    const marked = Number(t.params.markedBar);
    if (i === 0) {
      // While it plays, the bar that sounds is lit, and the asked one is marked.
      await expect(chart.locator("[data-playing]")).toHaveCount(1, { timeout: 15_000 });
      await expect(chart.locator(`[data-bar="${marked}"]`)).toHaveAttribute(
        "aria-label",
        /the bar asked about/,
      );
      await shoot(page, SHOTS, "w5-twelve-bars-playing", "paper");
    }
    const want = (t.expected.choice ?? [])[0] as string;
    await page.keyboard.press(String(["I", "IV", "V"].indexOf(want) + 1));
    await expect(page.getByTestId("trial-feedback")).toHaveAttribute("data-correct", "true");
    // The numerals of the form, read from the chords: bar 5 is IV7, bar 9 is V7.
    await expect(chart.locator('[data-bar="5"]')).toHaveAttribute("aria-label", /IV⁷|IV7/);
    await expect(chart.locator('[data-bar="9"]')).toHaveAttribute("aria-label", /V⁷|V7/);
    if (i === 0) {
      await chart.locator(`[data-bar="${marked}"]`).click();
      await expect(page.getByTestId("stage-text")).toHaveText("Playing…");
      await frameMatrix(page, "w5-twelve-bars-feedback");
      await page.getByTestId("next-trial").focus();
    }
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("set-summary")).toBeVisible({ timeout: 30_000 });
  expect(posts.size).toBe(total);
  for (const r of posts.values()) expect(r.correct).toBe(true);
  expect(problems).toEqual([]);
});

test("form by ear: the sections labelled on the form widget, right and then wrong, each heard alone", async ({
  page,
}) => {
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page);
  await prepare(page, { theme: "bark" });
  await startPractice(page, "fam.frm.sections", 1);
  const t1 = await trialNo(page, 1, 4);
  await expect(page.getByTestId("trial-prompt")).toHaveText(
    "Label the sections: the same music gets the same letter.",
  );
  const widget = page.getByRole("group", { name: "Your answer: a letter for each section" });
  await expect(widget).toBeVisible();
  // P plays the selected section by itself while answering (a replay of part of it).
  await page.keyboard.press("p");
  const letters = (t1.expected.choice?.[0] === "AABA" ? "AABA" : "ABAB").split("");
  // Any letters with the same shape: B for the first idea, A for the other (graded by the shape).
  for (const l of letters) await page.keyboard.press(l === "A" ? "b" : "a");
  await shoot(page, SHOTS, "w5-form-answering", "bark");
  await page.keyboard.press("Enter");
  const feedback = page.getByTestId("trial-feedback");
  await expect(feedback).toHaveAttribute("data-correct", "true");
  // After the answer, each section's letter, and each one alone.
  const bar = page.getByTestId("sections-bar");
  await expect(bar.locator("[data-section]")).toHaveCount(4);
  await bar.locator('[data-section="0"]').click();
  await expect(page.getByTestId("stage-text")).toHaveText("Playing…");
  await frameMatrix(page, "w5-form-feedback");
  await page.getByTestId("next-trial").focus();
  await page.keyboard.press("Enter");
  // Wrong: every section the same.
  await trialNo(page, 2, 4);
  for (let k = 0; k < 4; k++) await page.keyboard.press("a");
  await page.keyboard.press("Enter");
  await expect(feedback).toHaveAttribute("data-correct", "false");
  await expect(feedback).toContainText(/It was A [AB] [AB] [AB]/);
  await page.keyboard.press("Enter");
  // Trial 3 is answered by key while it plays (an answer never waits for the sections to finish).
  const t3 = await trialNo(page, 3, 4);
  // Level 1's forms are AABA and verse–chorus (ABAB), as for trial 1 (packages/drills/src/gen/form.ts).
  expect(["AABA", "verse-chorus"]).toContain(t3.expected.choice?.[0]);
  for (const l of (t3.expected.choice?.[0] === "AABA" ? "AABA" : "ABAB").split(""))
    await page.keyboard.press(l.toLowerCase());
  await page.keyboard.press("Enter");
  await expect(feedback).toHaveAttribute("data-correct", "true");
  await page.keyboard.press("Enter");
  // Trial 4: the sections heard through (the file's one full hearing of a form), then "Show me" on the form widget.
  await trialNo(page, 4, 4);
  await page.getByRole("button", { name: "Show me" }).click();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("set-summary")).toBeVisible({ timeout: 30_000 });
  const recs = [...posts.values()].sort((a, b) => a.idx - b.idx);
  expect(recs[0]?.correct).toBe(true);
  expect(recs[0]?.response.answer?.sections).toHaveLength(4);
  expect(recs[0]?.response.answer?.choice).toEqual(t1.expected.choice);
  expect(recs[1]?.correct).toBe(false);
  expect(recs[1]?.response.answer?.choice).toEqual(["AAAA"]);
  expect(recs[2]?.correct).toBe(true);
  expect(recs[3]?.credit).toBe(0);
  expect(problems).toEqual([]);
});

test("major or minor: the tune alone, the scale it was in, and in context", async ({ page }) => {
  const problems = watch(page);
  await seed(page);
  await prepare(page);
  await startPractice(page, "fam.key.mode", 1);
  const t = await trialNo(page, 1, 6);
  // Wave 6: the engine may ask its own question for this level; the runner's words are the fallback.
  await expect(page.getByTestId("trial-prompt")).toHaveText(/^(Major or minor\?|Which scale is this in\?)$/);
  const answer = page.getByRole("radiogroup", { name: /Your answer/ });
  await expect(answer.getByRole("radio", { name: "1. Major" })).toBeVisible();
  await expect(answer.getByRole("radio", { name: /^2\. (Minor|Natural minor)$/ })).toBeVisible();
  await page.keyboard.press(t.expected.choice?.[0] === "major" ? "1" : "2");
  await expect(page.getByTestId("trial-feedback")).toHaveAttribute("data-correct", "true");
  await expect(page.getByTestId("hear-alone")).toHaveText(/The tune alone/);
  await page.keyboard.press("m");
  await expect(page.getByTestId("stage-text")).toHaveText("Playing…");
  await expect(page.getByTestId("hear-scale")).toBeVisible();
  await expect(page.getByTestId("hear-in-context")).toBeVisible();
  await shoot(page, SHOTS, "w5-mode-feedback", "paper");
  expect(problems).toEqual([]);
});

test("straight or swung: the hats alone, and the same groove in the other feel", async ({ page }) => {
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page, "after U11.L07");
  await prepare(page);
  await startPractice(page, "fam.rhy.swing", 1);
  const t = await trialNo(page, 1, 8);
  await expect(page.getByTestId("trial-prompt")).toHaveText("Straight or swung?");
  const right = t.expected.choice?.[0] === "straight" ? "1" : "2";
  await page.keyboard.press(right);
  await expect(page.getByTestId("trial-feedback")).toHaveAttribute("data-correct", "true");
  await expect(page.getByTestId("hear-alone")).toHaveText(/Hats alone/);
  await expect(page.getByTestId("hear-other")).toHaveText(
    t.expected.choice?.[0] === "straight" ? /Hear it swung/ : /Hear it straight/,
  );
  await page.keyboard.press("o");
  await expect(page.getByTestId("stage-text")).toHaveText("Playing…");
  await expect(page.getByTestId("hear-in-context")).toBeVisible();
  await frameMatrix(page, "w5-swing-feedback");
  await expect.poll(() => posts.size).toBe(1);
  expect(problems).toEqual([]);
});

test("the hub's stage E: minor, form and the blues with honest levels; graduation reads as progress", async ({
  page,
}) => {
  const problems = watch(page);
  await seed(page);
  await prepare(page);
  await page.goto("/practice");
  const stage = page.getByTestId("stage-E");
  await expect(stage).toBeVisible({ timeout: 60_000 });
  await expect(stage.getByRole("heading", { name: "Stage E · Minor, sevenths and the blues" })).toBeVisible();
  for (const id of [
    "fam.deg.fet-minor",
    "fam.frm.blues",
    "fam.key.mode",
    "fam.frm.sections",
    "fam.rhy.groove-lock",
  ])
    await expect(stage.locator(`[data-family="${id}"]`)).toHaveCount(1);
  // A graduated family says where it lives now and that its level is kept: never loss.
  const minor = stage.locator('[data-family="fam.deg.fet-minor"]');
  await expect(minor).toHaveAttribute("data-status", "mastered");
  await expect(minor.getByTestId("family-graduated")).toHaveText(/^Graduated to Mixed pitch/);
  await expect(stage).not.toContainText(/slips|lost|lose/);
  // A level the lessons have not opened is never shown.
  const mode = stage.locator('[data-family="fam.key.mode"]');
  await expect(mode).toContainText(/Level [12] of 6/);
  await expect(stage.getByTestId("stage-E-count")).toContainText("mastered");
  // The seventh-chord family waits for U12, honestly.
  await expect(stage.locator('[data-family="fam.chd.quality-7th"]')).toContainText(
    "Unlocks in unit 12, Seventh Chords",
  );
  await stage.scrollIntoViewIfNeeded();
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((theme) => document.documentElement.setAttribute("data-theme", theme), m.theme);
    await stage.scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "w5-hub-stage-e", m.theme);
  }
  expect(problems).toEqual([]);
});
