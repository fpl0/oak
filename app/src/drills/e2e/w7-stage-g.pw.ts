// Wave 7 ear training on the real Oak server (own stack, throwaway data), each learner from a Wave 7 dev seed
// (wave7.md §6) whose lessons really opened the family — nothing is opened by a dev hook:
// - a jazz day (J3.L02 next): a ii–V–I trial with the key it lands in, and a guide-tone line sung on Chromium's fake
//   microphone, then the same trial in Quiet mode (the mic never opens);
// - a rhythm day (R.CP due, R3.L02 next): a clave trial with its grid (the CLAVE lens opened by R3.L02) and a two-lane
//   polyrhythm tapped with F and J in real time, its pulse lanes drawn (the lens opened by R2.L04);
// - a sound day (A2.L04 next): a sound-control trial heard against its near miss;
// - the Practice hub's track groups (core complete, tracks untouched).
// Each trial is drawn on purpose (`__oakDrillForce`) at a level the seed has opened. Grading, words, plans and the
// machine are proved by bun tests (wave7.test.ts); this file proves the page: it plays, it moves, it records,
// keyboard-first, in both themes at both sizes.
import { fileURLToPath } from "node:url";
import type { DrillTrialRecord, Trial } from "@oak/api";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const HEADERS = { "X-Oak": "1", Origin: stack.baseURL, "Content-Type": "application/json" };

type Force = Record<number, { category?: string; level?: number }>;
type Choice = { ui: "choice"; options: { id: string; label: string }[] };
interface FollowUp {
  options: { id: string; label: string }[];
  correct: string;
}
interface Lane {
  key: "F" | "J";
  targets: number[];
}

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
    for (const t of (r.postDataJSON() as { trials: DrillTrialRecord[] }).trials) out.set(t.idx, t);
  });
  return out;
}

/** Counts every request for the microphone (the Quiet path must make none). */
async function countMic(page: Page): Promise<() => number> {
  let asked = 0;
  await page.exposeFunction("__w7MicAsked", () => {
    asked++;
  });
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    if (!md) return;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = (c) => {
      (window as unknown as { __w7MicAsked(): void }).__w7MicAsked();
      return orig(c);
    };
  });
  return () => asked;
}

async function seed(page: Page, point: string): Promise<void> {
  await page.request.put(`${stack.apiURL}/api/dev/clock`, { headers: HEADERS, data: { reset: true } });
  const res = await page.request.post(`${stack.apiURL}/api/dev/seed`, {
    headers: HEADERS,
    data: { point },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

/** Today names the day's track session ("Advanced Rhythm · session 12 of 20"): the seed is the day it says. */
async function trackDay(page: Page, line: RegExp): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("track-session")).toHaveText(line, { timeout: 60_000 });
}

async function setQuiet(page: Page, quiet: boolean): Promise<void> {
  const res = await page.request.put(`${stack.apiURL}/api/voice/quiet`, {
    headers: HEADERS,
    data: { quiet, scope: "today" },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

/** Blocks HMR, sets the theme, and draws the given trials on purpose (from what the seed has opened). */
async function prepare(page: Page, force: Force): Promise<void> {
  // Other engineers' edits must not reload the page mid-test.
  await page.routeWebSocket(/.*/, () => {});
  await useUiPrefs(page, { theme: "paper" });
  await page.addInitScript((f) => {
    (globalThis as { __oakDrillForce?: unknown }).__oakDrillForce = f;
  }, force);
}

async function startPractice(page: Page, familyId: string): Promise<void> {
  await page.goto(`/practice/${familyId}`);
  await expect(page.getByTestId("start-set")).toBeFocused({ timeout: 60_000 });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("trial-counter")).toHaveText(/Trial 1 of \d+/, { timeout: 60_000 });
}

const hook = <T>(page: Page, name: string): Promise<T> =>
  page.evaluate((n) => (globalThis as Record<string, unknown>)[n], name) as Promise<T>;

async function firstTrial(page: Page): Promise<Trial> {
  await expect
    .poll(async () => (await hook<Trial | undefined>(page, "__oakDrillTrial"))?.category)
    .toBeTruthy();
  return hook<Trial>(page, "__oakDrillTrial");
}

/** Picks a choice by the number the widget gives it (keyboard-first). */
async function pickByKey(page: Page, id: string): Promise<void> {
  const spec = await hook<Choice>(page, "__oakDrillSpec");
  const i = spec.options.findIndex((o) => o.id === id);
  expect(i, `${id} among ${spec.options.map((o) => o.id).join(" ")}`).toBeGreaterThanOrEqual(0);
  await page.keyboard.press(String(i + 1));
  const check = page.getByTestId("check-answer");
  if (await check.isVisible()) await page.keyboard.press("Enter");
}

/** A listening key plays something, and the runner says so; the next key may cut it short. */
async function plays(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await expect(page.getByTestId("stage-text")).toHaveText("Playing…");
}

/** Both themes at both sizes, resized in place: the primary action in view, no horizontal overflow. */
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

test.describe.configure({ mode: "serial" });

test("a jazz day's ii–V–I: major or minor, the key it lands in, the 3rds and 7ths alone, the other mode", async ({
  page,
}) => {
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page, "J3.L02 next");
  await prepare(page, { 0: { category: "major-ii-V", level: 2 } });
  await trackDay(page, /^Jazz Harmony · session 14 of 34$/);
  await startPractice(page, "fam.jzz.ii-v");
  const t = await firstTrial(page);
  expect(t.category).toBe("major-ii-V");
  // Answered while it still plays: the pad is live from the start.
  await pickByKey(page, "major-ii-V");
  const feedback = page.getByTestId("trial-feedback");
  await expect(feedback).toHaveAttribute("data-correct", "true");
  // The key is asked by ear next, so neither the details nor the fact say it yet.
  await expect(page.getByTestId("trial-details")).not.toContainText("major");
  await expect(page.getByTestId("trial-fact")).toHaveCount(0);
  await expect(page.getByTestId("hear-alone")).toHaveText(/The 3rds and 7ths alone/);
  await expect(page.getByTestId("hear-near")).toHaveText(/Against the minor ii–V–i/);
  await expect(page.getByTestId("hear-in-context")).toBeVisible();
  // The second question: which key did it land in (for the ear only; digits answer it).
  const follow = page.getByTestId("follow-up");
  await expect(follow).toContainText("Which key did it land in?");
  const f = await hook<FollowUp>(page, "__oakDrillFollow");
  await frameMatrix(page, "w7-ii-v-feedback");
  await page.keyboard.press(String(f.options.findIndex((o) => o.id === f.correct) + 1));
  await expect(page.getByTestId("follow-up-answer")).toHaveAttribute("data-right", "true");
  await expect(page.getByTestId("follow-up-answer")).toContainText("Home is the last chord, not the first.");
  await expect(page.getByTestId("trial-fact")).toHaveText(/^In [A-G][♭♯]? major(: .+)?\.$/);
  await plays(page, "l");
  await plays(page, "n");
  await expect.poll(() => posts.get(0)?.correct).toBe(true);
  expect(posts.get(0)?.familyId).toBe("fam.jzz.ii-v");
  expect(problems).toEqual([]);
});

test("a guide-tone line: sung on the fake mic, then the same trial in Quiet mode with the mic closed", async ({
  page,
}) => {
  test.slow(); // A real-time sung take (a count-in bar and three bars of chords).
  const problems = watch(page);
  const posts = trialPosts(page);
  const micAsked = await countMic(page);
  await seed(page, "J3.L02 next");
  await prepare(page, { 0: { category: "sing-3-7", level: 2 } });
  await startPractice(page, "fam.jzz.guide");
  const t = await firstTrial(page);
  expect(t.params.mode).toBe("sing");
  await expect(page.getByTestId("quiet-sing")).toHaveCount(0);
  const feedback = page.getByTestId("trial-feedback");
  // A sung trial waits for Start: nothing plays and the mic stays closed until then.
  await page.getByTestId("drill-start").click({ timeout: 30_000 });
  await expect(feedback).toBeVisible({ timeout: 40_000 });
  expect(micAsked()).toBeGreaterThan(0);
  await expect(page.getByTestId("hear-alone")).toHaveText(/The line alone/);
  // The near miss is the other line through the same chords (from the 7th when it started on the 3rd).
  await expect(page.getByTestId("hear-near")).toHaveText(
    t.params.startsOn === "7th" ? /The line from the 3rd/ : /The line from the 7th/,
  );
  await expect.poll(() => posts.get(0)?.response.sung?.length ?? 0).toBe(3);
  expect(posts.get(0)?.modality).toBe("normal");

  // Quiet mode for today: the same trial is heard in the head; the page says so before the set.
  await setQuiet(page, true);
  posts.clear();
  const before = micAsked();
  // A new set, not the first one picked up again (the set in flight is this browser's convenience).
  await page.evaluate(() => localStorage.removeItem("oak.drills.inflight.v1"));
  await page.goto("/practice/fam.jzz.guide");
  await expect(page.getByText("Quiet mode is on", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("start-set")).toBeFocused();
  await page.keyboard.press("Enter");
  const card = page.getByTestId("quiet-sing");
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card).toContainText("sing the guide-tone line in your head");
  await expect(page.getByTestId("quiet-heard")).toBeFocused({ timeout: 30_000 });
  await frameMatrix(page, "w7-guide-quiet", "quiet-heard");
  await page.keyboard.press("Space");
  await expect(feedback).toContainText("Heard in your head.");
  await expect(page.getByTestId("hear-alone")).toHaveText(/The line alone/);
  await plays(page, "l");
  await expect.poll(() => posts.get(0)?.modality).toBe("quiet");
  expect(posts.get(0)?.response.skipped).toBe(true);
  expect(posts.get(0)?.response.sung).toBeNull();
  expect(micAsked()).toBe(before);
  await setQuiet(page, false);
  expect(problems).toEqual([]);
});

test("a rhythm day's clave the other way round, its grid drawn; a sound day's change run backwards", async ({
  page,
}) => {
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page, "R.CP due");
  await prepare(page, { 0: { category: "son-2-3", level: 2 } });
  await startPractice(page, "fam.rhy.clave");
  const t = await firstTrial(page);
  expect(t.category).toBe("son-2-3");
  await pickByKey(page, "son-2-3");
  await expect(page.getByTestId("trial-feedback")).toHaveAttribute("data-correct", "true");
  await expect(page.getByTestId("trial-fact")).toHaveText(
    "Bar 1 has two strokes (2 and 3), bar 2 three strokes (1, the & of 2 and 4). Two first, so 2-3.",
  );
  await expect(page.getByTestId("hear-alone")).toHaveText(/The clave alone/);
  await expect(page.getByTestId("hear-near")).toHaveText(/Against Son clave, 3-2/);
  // The clave grid follows its lens, which R3.L02 opened for this learner: the two sides, the direction named.
  const grid = page.getByTestId("rhythm-lanes");
  await expect(grid).toBeVisible();
  await expect(grid).toContainText("2-side");
  await expect(grid).toContainText("3-side");
  await frameMatrix(page, "w7-clave-feedback");
  await plays(page, "n");
  await expect.poll(() => posts.get(0)?.correct).toBe(true);

  // A sound day: the learner on Arrangement & Sound, the controls family opened by its lessons.
  posts.clear();
  await seed(page, "A2.L04 next");
  await page.evaluate(() => localStorage.removeItem("oak.drills.inflight.v1"));
  await trackDay(page, /^Arrangement & Sound · session \d+ of 20$/);
  await page.goto("/practice/fam.snd.params");
  await expect(page.getByTestId("start-set")).toBeFocused({ timeout: 60_000 });
  await page.evaluate(() => {
    (globalThis as { __oakDrillForce?: unknown }).__oakDrillForce = { 0: { category: "cutoff", level: 1 } };
  });
  await page.keyboard.press("Enter");
  const s = await firstTrial(page);
  expect(s.category).toBe("cutoff");
  const want = (s.expected as { choice: string[] }).choice[0] as string;
  await pickByKey(page, want);
  await expect(page.getByTestId("trial-feedback")).toHaveAttribute("data-correct", "true");
  await expect(page.getByTestId("trial-fact")).toHaveText(
    /^In bar 2, lpf went from \d+ Hz to \d+ Hz\. The filter (opened, so bar 2 is brighter|closed, so bar 2 is darker)\.$/,
  );
  await expect(page.getByTestId("hear-near")).toHaveText(/The change the other way/);
  await plays(page, "n");
  await plays(page, "l");
  await expect.poll(() => posts.get(0)?.familyId).toBe("fam.snd.params");
  expect(problems).toEqual([]);
});

test("a rhythm day's 3 against 2 with two hands: F keeps the 2, J taps the 3; the pulse lanes drawn", async ({
  page,
}) => {
  test.slow(); // A real-time take: four bars of the pulse.
  const problems = watch(page);
  const posts = trialPosts(page);
  await seed(page, "R3.L02 next");
  await prepare(page, { 0: { category: "tap-3-over-2", level: 3 }, 1: { category: "4:3", level: 2 } });
  await trackDay(page, /^Advanced Rhythm · session 12 of 20$/);
  await startPractice(page, "fam.rhy.polyrhythm");
  await firstTrial(page);
  const lanes = await hook<Lane[]>(page, "__oakDrillLanes");
  expect(lanes.map((l) => l.key)).toEqual(["F", "J"]);
  await expect(page.getByTestId("tap-lane-F")).toContainText("Left hand: the 2");
  await expect(page.getByTestId("tap-lane-J")).toContainText("Right hand: the 3");
  await expect(page.getByTestId("stage-text")).toHaveText(
    "Your turn: F for the left hand, J for the right.",
    {
      timeout: 30_000,
    },
  );
  const hits = lanes
    .flatMap((l) => l.targets.map((at) => ({ at, key: l.key === "F" ? "f" : "j" })))
    .sort((a, b) => a.at - b.at);
  const started = Date.now();
  for (const h of hits) {
    const wait = h.at * 1000 - (Date.now() - started);
    // A real-time measurement: each tap at its target time, with its own hand.
    if (wait > 0) await page.waitForTimeout(wait);
    await page.keyboard.press(h.key);
  }
  await expect(page.getByTestId("trial-feedback")).toBeVisible({ timeout: 20_000 });
  // Each hand is read on its own (a steady lean is named: this learner's calibrated tap latency moves every tap).
  await expect(page.getByTestId("lane-report")).toHaveText(
    /^F: \d of 6 matched(, about \d+ ms (early|late))? · J: \d of 9 matched(, about \d+ ms (early|late))?$/,
  );
  await frameMatrix(page, "w7-lanes-feedback");
  await expect.poll(() => posts.get(0)?.response.taps?.length ?? 0).toBe(hits.length);
  // The next trial is heard, not tapped: once answered, its two pulses are drawn as lanes (the lens R2.L04 opened).
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("trial-counter")).toHaveText(/Trial 2 of \d+/, { timeout: 30_000 });
  await expect.poll(async () => (await hook<Trial>(page, "__oakDrillTrial")).category).toBe("4:3");
  await pickByKey(page, "4:3");
  const lanesDrawn = page.getByTestId("rhythm-lanes");
  await expect(lanesDrawn).toBeVisible();
  await expect(lanesDrawn).toContainText("High · 4");
  await expect(lanesDrawn).toContainText("Low · 3");
  await expect.poll(() => posts.get(1)?.familyId).toBe("fam.rhy.polyrhythm");
  expect(problems).toEqual([]);
});

test("the hub: the tracks' families grouped by track, each honest about what opens them", async ({
  page,
}) => {
  const problems = watch(page);
  await seed(page, "core complete, tracks untouched");
  await page.routeWebSocket(/.*/, () => {});
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/practice");
  const tracks = page.getByTestId("practice-tracks");
  await expect(tracks).toBeVisible({ timeout: 60_000 });
  const jazz = page.getByTestId("track-J");
  await expect(jazz.getByRole("heading", { name: "Jazz Harmony" })).toBeVisible();
  for (const id of ["fam.jzz.ii-v", "fam.jzz.guide", "fam.jzz.extension", "fam.jzz.subs"])
    await expect(jazz.locator(`[data-family="${id}"]`)).toHaveCount(1);
  const rhythm = page.getByTestId("track-R");
  for (const id of ["fam.rhy.clave", "fam.rhy.odd-grouping", "fam.rhy.polyrhythm"])
    await expect(rhythm.locator(`[data-family="${id}"]`)).toHaveCount(1);
  await expect(page.getByTestId("track-A").locator('[data-family="fam.snd.params"]')).toHaveCount(1);
  // The core's stage H keeps swing; the clave is no longer listed there.
  await expect(page.getByTestId("stage-H").locator('[data-family="fam.rhy.swing"]')).toHaveCount(1);
  await expect(page.getByTestId("stage-H").locator('[data-family="fam.rhy.clave"]')).toHaveCount(0);
  // The jazz track is open at this point, its families not yet: each names the lesson that opens it.
  const iiV = jazz.locator('[data-family="fam.jzz.ii-v"]');
  await expect(iiV).toHaveAttribute("data-status", "locked");
  await expect(iiV).toContainText("Opens with J1.L03");
  await expect(page.getByTestId("track-J-note")).toHaveText(/^Next: J1\.L01 /);
  // Each track names what Today would start in it: for Sound, its first side lesson (not a later track lesson).
  await expect(page.getByTestId("track-A-note")).toHaveText(/^Next: A1\.L01 /);
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((theme) => document.documentElement.setAttribute("data-theme", theme), m.theme);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await tracks.scrollIntoViewIfNeeded();
    await shoot(page, SHOTS, "w7-hub-tracks", m.theme);
  }
  expect(problems).toEqual([]);
});
