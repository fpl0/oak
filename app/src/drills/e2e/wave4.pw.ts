// Wave 4 stage D ear training on the real Oak server (own stack, throwaway data), each test from a dev seed: a
// chord-quality set (the key first, then the chord; bass alone, broken chords, in its key; yours then it), a
// staged chord dictation answered right and then wrong (bass → quality →
// numerals), a schema set, melodic dictation from level 4 as degrees, code or staff, and the hub's stage D.
// Every trial record the runner posts is read back from the wire.
//
// Every test starts from a named dev seed on the real server (wave4.md §6): "after U06.L10" (U05 and U06 through
// L10 done: the stage D families open at the levels the course gives them, the chord lenses unlocked) and, for the
// hub, "C2 released" (families graduated into Mixed harmony, melodic dictation below its mastery level in mixed
// practice). Nothing is patched: what the page shows is the server's.
import { fileURLToPath } from "node:url";
import type { DrillTrialRecord, Trial } from "@oak/api";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const HEADERS = { "X-Oak": "1", Origin: stack.baseURL, "Content-Type": "application/json" };
const QUALITY_KEYS: Record<string, string> = { maj: "1", min: "2", dim: "3", aug: "4" };

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|501|Not Implemented/i.test(m.text()))
      problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

/** Every trial record the runner posts (upserts: the last one per index wins). */
function trialPosts(page: Page): Map<number, DrillTrialRecord> {
  const out = new Map<number, DrillTrialRecord>();
  page.on("request", (r) => {
    if (r.method() !== "POST" || !/\/api\/drills\/sessions\/[^/]+\/trials$/.test(r.url())) return;
    const body = r.postDataJSON() as { trials: DrillTrialRecord[] };
    for (const t of body.trials) out.set(t.idx, t);
  });
  return out;
}

async function seed(page: Page, point = "after U06.L10"): Promise<void> {
  await page.request.put(`${stack.apiURL}/api/dev/clock`, { headers: HEADERS, data: { reset: true } });
  const res = await page.request.post(`${stack.apiURL}/api/dev/seed`, { headers: HEADERS, data: { point } });
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
  // The stepper starts at the family's own level: down to 1, then up to the one asked for.
  const down = page.getByRole("button", { name: "Decrease Start at level" });
  while (await down.isEnabled()) await down.click();
  for (let l = 1; l < level; l++) await page.getByRole("button", { name: "Increase Start at level" }).click();
  if (level > 1) await expect(page.getByText(new RegExp(`^Level ${level}: `))).toBeVisible();
  await page.getByTestId("start-set").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("trial-counter")).toHaveText(/Trial 1 of \d+/, { timeout: 60_000 });
}

/** The trial on screen (the runner's dev hook `__oakDrillTrial`; absent from production builds). */
async function currentTrial(page: Page): Promise<Trial> {
  return (await page.evaluate(() => (globalThis as { __oakDrillTrial?: unknown }).__oakDrillTrial)) as Trial;
}

/** Waits for the next trial (by its counter) and returns it. */
async function trialNo(page: Page, n: number, of: number): Promise<Trial> {
  await expect(page.getByTestId("trial-counter")).toHaveText(`Trial ${n} of ${of}`, { timeout: 30_000 });
  await expect.poll(async () => (await currentTrial(page))?.seed !== undefined).toBe(true);
  return currentTrial(page);
}

/** Both themes at both sizes: the primary action in view, no horizontal overflow; back to Paper 1440×900. */
async function frameMatrix(page: Page, name: string): Promise<void> {
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((theme) => document.documentElement.setAttribute("data-theme", theme), m.theme);
    await expect(page.getByTestId("next-trial")).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, name, m.theme);
  }
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "paper"));
  await page.setViewportSize({ width: 1440, height: 900 });
}

test("a chord-quality set: the key first, the chord, then the bass alone, broken, in its key, yours then it", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page);
  await prepare(page);
  await startPractice(page, "fam.chd.quality-triad", 3);
  // The key is set first (the reference cadence), then the chord.
  await expect(page.getByTestId("stage-text")).toHaveText(/Setting the key/, { timeout: 15_000 });
  await expect(page.getByTestId("trial-prompt")).toHaveText("After the key, one chord: what quality is it?");
  await expect(page.getByRole("button", { name: /Cadence/ })).toBeVisible({ timeout: 20_000 });
  await shoot(page, SHOTS, "w4-quality-answering", "paper");
  const total = Number((await page.getByTestId("trial-counter").textContent())?.match(/of (\d+)/)?.[1]);
  for (let i = 0; i < total; i++) {
    const t = await trialNo(page, i + 1, total);
    const want = t.expected.qualities?.[0] as string;
    const wrong = i === 1;
    const pick = wrong ? (want === "maj" ? "min" : "maj") : want;
    await expect(page.getByRole("group", { name: "Your answer: which chord quality?" })).toBeVisible();
    await page.keyboard.press(QUALITY_KEYS[pick] as string);
    const feedback = page.getByTestId("trial-feedback");
    await expect(feedback).toBeVisible();
    await expect(feedback).toHaveAttribute("data-correct", wrong ? "false" : "true");
    if (i === 0) {
      // After the answer: the bass alone, the chord broken, the chord in its key — by key.
      await expect(page.getByTestId("hear-bass")).toBeVisible();
      await expect(page.getByTestId("answer-in-context")).toBeVisible();
      await page.keyboard.press("b");
      await expect(page.getByTestId("stage-text")).toHaveText("Playing…");
      await expect(page.getByTestId("stage-text")).toHaveText("Listen back, try again, or move on.", {
        timeout: 15_000,
      });
      await page.keyboard.press("g");
      await expect(page.getByTestId("stage-text")).toHaveText("Listen back, try again, or move on.", {
        timeout: 15_000,
      });
      await page.keyboard.press("k");
      await expect(page.getByTestId("stage-text")).toHaveText("Playing…");
      await expect(page.getByTestId("stage-text")).toHaveText("Listen back, try again, or move on.", {
        timeout: 20_000,
      });
      // The chord lenses: symbols and numerals appear only when switched on.
      const symbols = page.getByTestId("lens-chordSymbols");
      const numerals = page.getByTestId("lens-romanNumerals");
      await expect(symbols).toBeVisible();
      if ((await symbols.getAttribute("aria-pressed")) !== "true") await symbols.click();
      if ((await numerals.getAttribute("aria-pressed")) !== "true") await numerals.click();
      await expect(page.getByTestId("trial-details")).toContainText(/Heard in [A-G][♭♯]? (major|minor)/);
      await expect(page.getByTestId("trial-details")).toContainText(/ · [ivIV]+[°+]?/);
      for (const m of SCREENSHOT_MATRIX) {
        await page.setViewportSize({ width: m.width, height: m.height });
        await page.evaluate((theme) => document.documentElement.setAttribute("data-theme", theme), m.theme);
        await expect(page.getByTestId("next-trial")).toBeInViewport();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await shoot(page, SHOTS, "w4-quality-feedback", m.theme);
      }
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "paper"));
      await page.setViewportSize({ width: 1440, height: 900 });
      await symbols.click();
      await numerals.click();
      await expect(page.getByTestId("trial-details")).not.toContainText(/ · [ivIV]+[°+]?\b/);
    }
    if (wrong) {
      await expect(feedback).toContainText(
        `It was ${({ maj: "major", min: "minor", dim: "diminished", aug: "augmented" } as Record<string, string>)[want]}`,
      );
      // Yours, then it: the same voicing in your quality, then the chord.
      await expect(page.getByRole("button", { name: /Compare/ })).toBeVisible();
      await page.keyboard.press("p");
      await expect(page.getByTestId("stage-text")).toHaveText("Yours, then it…");
      await shoot(page, SHOTS, "w4-quality-wrong", "paper");
    }
    await page.getByTestId("next-trial").focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("set-summary")).toBeVisible({ timeout: 30_000 });
  await shoot(page, SHOTS, "w4-quality-summary", "paper");
  expect(posts.size).toBe(total);
  expect(posts.get(1)?.correct).toBe(false);
  for (const r of posts.values()) expect(r.response.answer?.qualities).toHaveLength(1);
  expect(problems).toEqual([]);
});

// The bass-degree set (its roots sung on the mic, and the same set in Quiet mode) is walked once in the suite, inside
// a real session's warm-up: app/src/session/seeds/e2e/w4-warmups.pw.ts, "a U06 day: the bass-degree set …" and its
// Quiet twin, which hold every assertion the two practice-page copies made here but one. That one is the practice
// page's own and stays here: a set started from /practice at level 1 is four trials, the family's set size
// (`fam.har.bass`, `n: 4` in packages/drills/src/catalog/families.ts; app/src/drills/sources.ts `staircaseSource`
// takes its total from it). Nothing is sung: the picks go in by key as soon as the pad is there.
test("a bass-degree practice set at level 1 is four trials: each picked by key, all four on the wire", async ({
  page,
}) => {
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page);
  await prepare(page, { quiet: false });
  await startPractice(page, "fam.har.bass");
  const pad = page.getByRole("group", { name: "Your answer: the degrees, in order" });
  for (let i = 0; i < 4; i++) {
    const t = await trialNo(page, i + 1, 4);
    expect(t.family).toBe("fam.har.bass");
    await expect(pad).toBeVisible();
    if (i === 0) await pad.locator("button").first().focus();
    for (const d of t.expected.degrees ?? []) await page.keyboard.press(d.replace(/^[b#]/, ""));
    await expect(page.getByTestId("trial-feedback")).toHaveAttribute("data-correct", "true");
    await page.getByTestId("next-trial").focus();
    await page.keyboard.press("Enter");
  }
  // The fourth trial ends the set: its summary, and exactly four records posted (indexes 0 to 3).
  await expect(page.getByTestId("set-summary")).toBeVisible({ timeout: 30_000 });
  expect([...posts.keys()].sort()).toEqual([0, 1, 2, 3]);
  for (const r of posts.values()) {
    expect(r).toMatchObject({ familyId: "fam.har.bass", correct: true });
    expect(r.response.sung).toBeNull();
  }
  expect(problems).toEqual([]);
});

/** Picks a quality for each chord of the quality step (one pad per chord; a pick moves to the next). */
async function pickQualities(page: Page, qualities: readonly string[]): Promise<void> {
  const row = page.getByTestId("quality-row");
  await expect(row).toBeVisible();
  await row.locator("[data-quality-slot='0'] button").first().focus();
  for (const q of qualities) {
    await page.keyboard.press(QUALITY_KEYS[q] as string);
    await page.waitForTimeout(60);
  }
}

test("staged chord dictation: bass, quality and numerals right; then wrong, with a step shown", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page);
  await prepare(page);
  await startPractice(page, "fam.har.progression");
  const t0 = await trialNo(page, 1, 4);
  await expect(page.getByTestId("trial-prompt")).toContainText(
    "bass first, then each chord's quality, then the numerals",
  );
  await expect(page.getByTestId("step-prompt")).toHaveText("Step 1 · The bass: the degree under each chord.");
  const track = page.getByTestId("step-track");
  await expect(track.locator('[data-step="bass"]')).toHaveAttribute("data-state", "open");
  // Bass: the degree under each chord, then Enter.
  const pad = page.getByRole("group", { name: "Your answer: the degrees, in order" });
  await expect(pad).toBeVisible();
  await shoot(page, SHOTS, "w4-staged-bass", "paper");
  // The right bass degrees and qualities are what @oak/theory reads from the trial (exposed for the suite).
  const answers = (await page.evaluate(
    () => (globalThis as { __oakDrillSteps?: unknown }).__oakDrillSteps,
  )) as { bass: string[]; quality: string[]; rn: string[] };
  expect(answers.rn).toEqual(t0.expected.rn);
  await pad.locator("button").first().focus();
  for (const d of answers.bass) await page.keyboard.press(d.replace(/^[b#]/, ""));
  await page.keyboard.press("Enter");
  await expect(track.locator('[data-step="bass"]')).toHaveAttribute("data-state", "found");
  await expect(page.getByTestId("step-prompt")).toHaveText("Step 2 · The quality of each chord.");
  // Each chord's pad is captioned with the bass that is settled.
  await expect(page.getByTestId("quality-row")).toContainText(
    `Chord 1 · bass ${answers.bass[0]?.replace(/^b/, "♭")}`,
  );
  await pickQualities(page, answers.quality);
  await shoot(page, SHOTS, "w4-staged-quality", "paper");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("step-prompt")).toHaveText("Step 3 · The Roman numerals.");
  await expect(page.getByTestId("steps-so-far")).toContainText("Bass");
  const rnPad = page.getByRole("group", { name: "Your answer: Roman numerals" });
  await expect(rnPad).toBeVisible();
  await rnPad.locator("button").first().focus();
  for (const rn of answers.rn) await page.keyboard.press(String(romanDigit(rn)));
  await shoot(page, SHOTS, "w4-staged-numerals", "paper");
  await page.getByTestId("check-answer").click();
  const feedback = page.getByTestId("trial-feedback");
  await expect(feedback).toHaveAttribute("data-correct", "true");
  await expect(page.getByTestId("answer-in-context")).toBeVisible();
  await shoot(page, SHOTS, "w4-staged-right", "paper");
  await page.getByTestId("next-trial").focus();
  await page.keyboard.press("Enter");

  // Wrong: a wrong bass is marked and stays open; then the bass is shown, the qualities right, numerals wrong.
  const t1 = await trialNo(page, 2, 4);
  const a1 = (await page.evaluate(() => (globalThis as { __oakDrillSteps?: unknown }).__oakDrillSteps)) as {
    bass: string[];
    quality: string[];
    rn: string[];
  };
  expect(a1.rn).toEqual(t1.expected.rn);
  await pad.locator("button").first().focus();
  for (const d of a1.bass) await page.keyboard.press(d === "7" ? "6" : "7");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("step-retry")).toContainText("bass notes right so far");
  await expect(track.locator('[data-step="bass"]')).toHaveAttribute("data-state", "open");
  await shoot(page, SHOTS, "w4-staged-retry", "paper");
  await page.getByTestId("show-step").click();
  await expect(track.locator('[data-step="bass"]')).toHaveAttribute("data-state", "shown");
  await pickQualities(page, a1.quality);
  await page.keyboard.press("Enter");
  await expect(rnPad).toBeVisible();
  await rnPad.locator("button").first().focus();
  for (const rn of a1.rn) await page.keyboard.press(String(romanDigit(rn) === 1 ? 4 : 1));
  await page.getByTestId("check-answer").click();
  await expect(feedback).toHaveAttribute("data-correct", "false");
  await expect(feedback).toContainText("It was");
  await expect(track.locator('[data-step="rn"]')).toHaveAttribute("data-state", "missed");
  await expect(page.getByTestId("answer-in-context").getByTestId("yours").first()).toContainText("Yours:");
  await frameMatrix(page, "w4-staged-wrong");
  const r0 = posts.get(0);
  const r1 = posts.get(1);
  expect(r0).toMatchObject({ correct: true, credit: 1 });
  expect(r0?.response.answer?.stages).toEqual({
    bass: answers.bass,
    quality: answers.quality,
    rn: answers.rn,
  });
  expect(r1?.correct).toBe(false);
  // The shown bass counts as help (a replay past the limit).
  expect(r1?.replays).toBeGreaterThan(t1.cue.replays);
  expect(r1?.response.answer?.stages?.bass).toHaveLength(a1.bass.length);
  expect(problems).toEqual([]);
});

/** The diatonic triad key of the RN palette for a plain numeral ("vi" → 6). */
function romanDigit(rn: string): number {
  const base = rn.replace(/[^ivIV]/g, "").toUpperCase();
  return ["I", "II", "III", "IV", "V", "VI", "VII"].indexOf(base) + 1;
}

test("a schema set: name the loop; the answer in context lists each bar", async ({ page }) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page);
  await prepare(page);
  await startPractice(page, "fam.har.schema");
  for (let i = 0; i < 3; i++) {
    const t = await trialNo(page, i + 1, 6);
    const group = page.getByRole("radiogroup", { name: "Your answer" });
    await expect(group).toBeVisible();
    // Options are the level's loops, keyed 1, 2, … in order; the right one, except on trial 2.
    const options = (await group.getByRole("radio").allTextContents()).map((o) => o.replace(/^\d/, ""));
    expect(options.length).toBeGreaterThanOrEqual(2);
    const want = t.expected.choice?.[0] as string;
    const label = want === "axis" ? "I–V–vi–IV" : want === "three-chord" ? "I–IV–V" : want;
    const right = options.indexOf(label);
    expect(right).toBeGreaterThanOrEqual(0);
    await group.getByRole("radio").first().focus();
    await page.keyboard.press(String(i === 1 ? ((right + 1) % options.length) + 1 : right + 1));
    const feedback = page.getByTestId("trial-feedback");
    await expect(feedback).toHaveAttribute("data-correct", i === 1 ? "false" : "true");
    await expect(page.getByTestId("answer-in-context").locator("li")).toHaveCount(4);
    if (i === 0) await shoot(page, SHOTS, "w4-schema-feedback", "paper");
    await page.getByTestId("hear-broken").click();
    await expect(page.getByTestId("stage-text")).toHaveText("Listen back, try again, or move on.", {
      timeout: 30_000,
    });
    await page.getByTestId("next-trial").click();
  }
  expect(posts.size).toBe(3);
  expect(posts.get(1)?.correct).toBe(false);
  expect(problems).toEqual([]);
});

test("melodic dictation at level 4: written as degrees, then in code, then on the staff", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page);
  await prepare(page);
  await startPractice(page, "fam.mel.dictation", 4);
  const t0 = await trialNo(page, 1, 4);
  const modes = page.getByTestId("dictation-mode");
  await expect(modes).toBeVisible();
  await modes.locator('[data-mode="degrees"]').click();
  const pad = page.getByRole("group", { name: "Your answer: the degrees, in order" });
  await expect(pad).toBeVisible();
  await pad.locator("button").first().focus();
  for (const d of t0.expected.degrees ?? []) await page.keyboard.press(d.replace(/^[b#]/, ""));
  await shoot(page, SHOTS, "w4-dictation-degrees", "paper");
  await page.getByTestId("check-answer").click();
  await expect(page.getByTestId("trial-feedback")).toHaveAttribute("data-correct", "true");
  await page.getByTestId("next-trial").click();
  // The mode is remembered; switch to the staff and write it with the typed alternative is the answers
  // engineer's surface: here the staff is shown and the code mode checks a deliberately wrong tune.
  await trialNo(page, 2, 4);
  await expect(pad).toBeVisible();
  await modes.locator('[data-mode="staff"]').click();
  await expect(page.getByRole("group", { name: "Your answer: the notes on the staff" })).toBeVisible();
  await shoot(page, SHOTS, "w4-dictation-staff", "paper");
  await modes.locator('[data-mode="code"]').click();
  // In code: the starter is already in the trial's key; a tune of repeated tonics is not this one.
  const code = page.getByRole("textbox", { name: "Your answer: the code" });
  await expect(code).toHaveValue(/^n\(""\)\.scale\("[A-G][b#]?\d:major"\)\.s\("piano"\)$/);
  await code.fill((await code.inputValue()).replace('n("")', 'n("0 0 0 0")'));
  await shoot(page, SHOTS, "w4-dictation-code", "paper");
  await page.getByTestId("check-answer").click();
  await expect(page.getByTestId("trial-feedback")).toHaveAttribute("data-correct", "false");
  expect(posts.get(0)).toMatchObject({ correct: true });
  expect(posts.get(0)?.response.answer?.degrees).toEqual(t0.expected.degrees);
  expect(posts.get(1)?.response.answer?.text).toHaveLength(1);
  expect(problems).toEqual([]);
});

test("the Practice hub shows stage D honestly: levels, mixed practice and its composite", async ({
  page,
}) => {
  await seed(page, "C2 released");
  await prepare(page);
  await page.goto("/practice");
  const stage = page.getByTestId("stage-D");
  await expect(stage).toBeVisible({ timeout: 60_000 });
  await expect(stage).toContainText("Stage D · Chords and progressions");
  for (const id of [
    "fam.chd.quality-triad",
    "fam.har.bass",
    "fam.har.schema",
    "fam.har.cadence",
    "fam.chd.inversion",
    "fam.har.progression",
    "fam.har.function",
  ])
    await expect(stage.locator(`[data-family="${id}"]`)).toHaveCount(1);
  // Graduated at its mastery level: mastered, and practised now in Mixed harmony with the others.
  const quality = stage.locator('[data-family="fam.chd.quality-triad"]');
  await expect(quality).toHaveAttribute("data-status", "mastered");
  // Wave 5: graduation reads as progress (where it lives now, its level kept).
  // The company it keeps is the server's: every other family graduated into the same composite.
  const fams = (await (
    await page.request.get(`${stack.apiURL}/api/drills/families`, { headers: HEADERS })
  ).json()) as {
    families: { familyId: string; level: number; compositeId: string | null; graduatedAt: string | null }[];
  };
  // The level the card shows is the server's, at or past the family's mastery level (4 of 6), never more than it.
  const level = fams.families.find((f) => f.familyId === "fam.chd.quality-triad")?.level ?? 0;
  expect(level).toBeGreaterThanOrEqual(4);
  await expect(quality).toContainText(`Level ${level} of 6`);
  const others = fams.families.filter(
    (f) =>
      f.compositeId === "fam.mix.harmony" && f.graduatedAt !== null && f.familyId !== "fam.chd.quality-triad",
  ).length;
  expect(others).toBeGreaterThan(1);
  await expect(quality.getByTestId("family-graduated")).toContainText(
    `Graduated to Mixed harmony with ${others} others`,
  );
  // At the highest level its lessons open: the lesson that opens the next one is named, never a level beyond it.
  const cadence = stage.locator('[data-family="fam.har.cadence"]');
  await expect(cadence).toContainText("Level 3 of 4 · level 4 opens with “Mixolydian Rock”");
  // Melodic dictation left its own card below its mastery level: in mixed practice, never "mastered".
  const dictation = page.getByTestId("stage-C").locator('[data-family="fam.mel.dictation"]');
  await expect(dictation).toHaveAttribute("data-status", "resting");
  await expect(dictation).toContainText("Level 3 of 9");
  await expect(dictation.getByTestId("family-resting")).toBeVisible();
  await expect(stage).not.toContainText(/\bdue\b/i);
  await stage.scrollIntoViewIfNeeded();
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((theme) => document.documentElement.setAttribute("data-theme", theme), m.theme);
    await stage.scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/w4-hub-stage-d-${m.theme}-${m.width}x${m.height}.png` });
  }
});
