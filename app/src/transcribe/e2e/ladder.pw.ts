// The generated ladder in Transcribe (contracts §2.9, §6.12; wave4.md §5.4), against the real server from the
// "ladder L3" seed: an L1 item fails with a bar-by-bar message, then is solved; an L4 item is solved; the L3 item
// is staged bass first; the source's notes stay hidden until solved. The learner's answers are written from the
// stimulus events the browser receives (the hidden code never reaches the page), as a learner would by ear.

import type { NEvent } from "@oak/content-kit";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { stimulusCode } from "../stimulus-code.ts";
import { api, checkIt, seed } from "./support.ts";

const SHOTS = new URL("./screenshots", import.meta.url).pathname;

interface Project {
  id: string;
  ladderLevel: number | null;
  bpm: number | null;
  stimulus: { events: NEvent[]; bars: number; cps: number } | null;
}

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

/** The item's bass and chords as heard (L3), or only its bass, on the tracks the grader reads. */
function l3Answer(p: Project, withChords: boolean): string {
  const st = p.stimulus as NonNullable<Project["stimulus"]>;
  const lines = [
    stimulusCode(
      st.events.filter((e) => e.track === "bass"),
      st.bars,
    ).code.replace(/^ref_\w+:/gm, "bass:"),
  ];
  if (withChords)
    lines.push(
      stimulusCode(
        st.events.filter((e) => e.track === "chords"),
        st.bars,
      ).code.replace(/^ref_\w+:/gm, "chords:"),
    );
  return `setcpm(${Math.round(p.bpm ?? 90)}/4)\n\n${lines.join("\n")}\n`;
}

/** One day's L3 item solved stage by stage through the ladder endpoints, then the clock moves to the next day. */
async function passL3Today(page: Page): Promise<void> {
  const next = await api<{ itemId: string }>(page, "POST", "/ladder/items", {
    sessionId: null,
    gymId: null,
    level: 3,
  });
  expect(next.status, JSON.stringify(next.body)).toBe(200);
  const p = (await api<Project>(page, "GET", `/transcriptions/${next.body.itemId}`)).body;
  for (const stage of ["bass", "quality", "rn"] as const) {
    const r = await api<{ passed: boolean }>(page, "POST", `/ladder/items/${p.id}/submissions`, {
      sessionId: null,
      code: l3Answer(p, stage !== "bass"),
      stage,
      rung: 0,
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.passed, `${stage} passes`).toBe(true);
  }
  await api(page, "PUT", "/dev/clock", { advanceMs: 24 * 3600 * 1000 });
}

/**
 * L4 is earned (wave4.md §5.4): realism rises after two sessions at ≥ 0.9, and the level-up is offered after two
 * graded passes at R2 or higher on two days. Four learner days of solved L3 items, then the offered level-up.
 */
async function earnL4(page: Page): Promise<string> {
  for (let day = 0; day < 4; day++) await passL3Today(page);
  const state = await api<{ realism: number; levelUp: { to: number } | null }>(page, "GET", "/ladder");
  expect(state.body.levelUp?.to, JSON.stringify(state.body)).toBe(4);
  const set = await api(page, "PUT", "/ladder", { level: 4 });
  expect(set.status, JSON.stringify(set.body)).toBe(200);
  const r = await api<{ itemId: string }>(page, "POST", "/ladder/items", { sessionId: null, gymId: null });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.itemId;
}

/** What the learner writes once they have heard it right: the item's notes, on the tracks the grader reads. */
async function answerFor(page: Page, id: string, label?: string): Promise<string> {
  const p = (await api<Project>(page, "GET", `/transcriptions/${id}`)).body;
  expect(p.stimulus, "a ladder item carries its stimulus events").toBeTruthy();
  const st = p.stimulus as NonNullable<Project["stimulus"]>;
  const { code } = stimulusCode(st.events, st.bars);
  const body = label ? code.replace(/^ref_\w+:/gm, `${label}:`) : code;
  return `setcpm(${Math.round(p.bpm ?? st.cps * 240)}/4)\n\n${body}\n`;
}

/** Both themes at both sizes (wave4.md §10 item 4), then back to Paper at 1440×900. */
async function shots(page: Page, name: string) {
  for (const s of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), s.theme);
    await page.waitForTimeout(300);
    await shoot(page, SHOTS, name, s.theme);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "paper"));
}

async function write(page: Page, code: string) {
  const editor = page.locator(".cm-content").first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
}

test("L1: a wrong groove fails bar by bar, the right one passes and shows the source", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "ladder L3");
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/transcribe");
  await expect(page.getByTestId("ladder-summary")).toContainText("Level 3");

  // Practise L1 from the list: the item opens with its givens, the starter and the bar timeline.
  await page.getByRole("button", { name: "Practise level 1", exact: true }).click();
  await expect(page).toHaveURL(/\/transcribe\/.+/, { timeout: 30_000 });
  await expect(page.getByTestId("ladder-panel")).toContainText("Level 1 · Drum loops");
  await expect(page.getByTestId("given")).toContainText("BPM");
  await expect(page.getByTestId("bar-timeline")).toBeVisible();
  await expect(page.getByTestId("reference")).toHaveCount(0);
  await expect(page.locator(".cm-content").first()).toContainText("kick:");
  const id = page.url().split("/").pop() as string;

  // Keyboard: loop bar 1, play, hear mine, stop.
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("transcribe-project").focus();
  await page.keyboard.press("l");
  await expect(page.getByTestId("loop-label")).toHaveText("bar 1");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("transport-play")).toHaveAccessibleName(/Pause/);
  await page.keyboard.press("v");
  await expect(page.getByRole("radio", { name: "Mine" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Space");

  // The starter is one kick per bar: not the groove. The check names the bars.
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("Not quite", { timeout: 60_000 });
  await expect(page.getByTestId("check-lines")).toContainText(/Bar \d/);
  await expect(page.getByTestId("reference")).toHaveCount(0);
  for (const s of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), s.theme);
    await page.waitForTimeout(300);
    await shoot(page, SHOTS, "ladder-l1-failed", s.theme);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // The groove as heard: it passes, the source's roll and staff appear, and the next item is offered.
  await write(page, await answerFor(page, id));
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("That's it", { timeout: 60_000 });
  await expect(page.getByTestId("solved")).toBeVisible();
  await expect(page.getByTestId("reference-roll")).toBeVisible();
  await expect(page.getByTestId("next-item")).toBeVisible();
  const saved = await api<{ versions: unknown[]; gradedPass?: boolean }>(
    page,
    "GET",
    `/transcriptions/${id}`,
  );
  expect(saved.body.versions.length).toBeGreaterThanOrEqual(2);
  // Try again after a pass (docs/design/retry.md §3.6): Alt+R from the editor opens Check again, and the re-check
  // of a solved item says it is practice.
  await expect(page.getByTestId("result-retry")).toHaveAccessibleName("Try again");
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Alt+r");
  await expect(page.getByTestId("result-retry")).toHaveCount(0);
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("That's it", { timeout: 60_000 });
  await expect(page.getByTestId("result-line")).toHaveText(
    "Practice: this take does not change your result.",
  );
  await expect(page.getByTestId("next-item")).toBeVisible();
  for (const s of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), s.theme);
    await page.waitForTimeout(300);
    await shoot(page, SHOTS, "ladder-l1-solved", s.theme);
  }
});

test("L4: the starter fails bar by bar, the melody as heard passes", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "ladder L3");
  const id = await earnL4(page);
  await page.goto(`/transcribe/${id}`);
  await expect(page.getByTestId("ladder-panel")).toContainText("Level 4 · Short melodies");
  await expect(page.locator(".cm-content").first()).toContainText("melody:");
  // The starter (one note a bar) is not the tune: it fails, bar by bar, and the source stays hidden.
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("Not quite", { timeout: 60_000 });
  await expect(page.getByTestId("check-lines")).toContainText(/Bar \d/);
  await expect(page.getByTestId("reference-staff")).toHaveCount(0);
  await write(page, await answerFor(page, id, "melody"));
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("That's it", { timeout: 60_000 });
  await expect(page.getByTestId("reference-staff")).toBeVisible();
  await shots(page, "ladder-l4-solved");
});

test("L3 is staged bass first; the seeded item opens on its bass stage", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page, "ladder L3");
  const list = await api<{ items: { id: string; ladderLevel: number | null; sourceKind: string }[] }>(
    page,
    "GET",
    "/transcriptions",
  );
  const l3 = list.body.items.find((t) => t.sourceKind === "generated" && t.ladderLevel === 3);
  expect(l3, "the seed has an L3 item started").toBeTruthy();
  await page.goto(`/transcribe/${l3?.id}`);
  await expect(page.getByTestId("stages").locator("li").first()).toHaveAttribute("data-status", "open");
  await expect(page.getByTestId("check")).toHaveText("Check the bass");
  await expect(page.getByTestId("stages").locator("li").nth(1)).toHaveAttribute("data-status", "locked");
  // The bass as heard passes the bass stage; the chord qualities open next.
  const p = (await api<Project>(page, "GET", `/transcriptions/${l3?.id}`)).body;
  const st = p.stimulus as NonNullable<Project["stimulus"]>;
  const bass = stimulusCode(
    st.events.filter((e) => e.track === "bass"),
    st.bars,
  ).code.replace(/^ref_\w+:/gm, "bass:");
  await write(page, `setcpm(${Math.round(p.bpm ?? 90)}/4)\n\n${bass}\n`);
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("On to the next stage", { timeout: 60_000 });
  await expect(page.getByTestId("check")).toHaveText("Check the chord qualities");
  await expect(page.getByTestId("stages").locator("li").first()).toHaveAttribute("data-status", "passed");
  // Show the chord qualities: recorded as a revealed check, the numerals open, and the item can't be a graded pass.
  await page.getByTestId("reveal").click();
  await page.getByTestId("reveal-confirm").click();
  await expect(page.getByTestId("stages").locator("li").nth(1)).toHaveAttribute("data-status", "revealed");
  await expect(page.getByTestId("check")).toHaveText("Check the Roman numerals");
  await expect(page.getByTestId("reference-roll")).toBeVisible();
});

test("L2: the starter bass fails, the bass as heard passes", async ({ page }) => {
  test.setTimeout(150_000);
  await seed(page, "ladder L3");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/transcribe");
  await expect(page.getByTestId("ladder-summary")).toContainText("Level 3");
  await shots(page, "transcribe-list");
  await page.getByRole("button", { name: "Practise level 2", exact: true }).click();
  await expect(page).toHaveURL(/\/transcribe\/.+/, { timeout: 30_000 });
  await expect(page.getByTestId("ladder-panel")).toContainText("Level 2");
  await expect(page.locator(".cm-content").first()).toContainText("bass:");
  const id = page.url().split("/").pop() as string;
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("Not quite", { timeout: 60_000 });
  await expect(page.getByTestId("check-lines")).toContainText(/Bar \d/);
  await expect(page.getByTestId("reference")).toHaveCount(0);
  await write(page, await answerFor(page, id, "bass"));
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("That's it", { timeout: 60_000 });
  await expect(page.getByTestId("solved")).toBeVisible();
  await expect(page.getByTestId("reference-roll")).toBeVisible();
  await shots(page, "ladder-l2-solved");
  const saved = await api<{ gradedPass?: boolean }>(page, "GET", `/transcriptions/${id}`);
  expect(saved.body.gradedPass).toBe(true);
});

test("L3: a wrong bass fails, then bass, qualities and numerals pass in turn and the item is solved", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await seed(page, "ladder L3");
  const list = await api<{ items: { id: string; ladderLevel: number | null; sourceKind: string }[] }>(
    page,
    "GET",
    "/transcriptions",
  );
  const l3 = list.body.items.find((t) => t.sourceKind === "generated" && t.ladderLevel === 3);
  expect(l3, "the seed has an L3 item started").toBeTruthy();
  const id = l3?.id as string;
  const p = (await api<Project>(page, "GET", `/transcriptions/${id}`)).body;
  await page.goto(`/transcribe/${id}`);
  await expect(page.getByTestId("check")).toHaveText("Check the bass", { timeout: 30_000 });
  // The item plays at its realism level (humanised timing from R1), not clean.
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByTestId("transcribe-project")).toContainText(
    /Level 3 · (humanised timing|swing and room|a dense mix|a sung lead)/,
  );
  await expect(page.getByTestId("realism-note")).toHaveCount(0);
  // The starter's bass (the tonic every bar) is not this bass line.
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("Not quite", { timeout: 60_000 });
  await expect(page.getByTestId("stages").locator("li").nth(1)).toHaveAttribute("data-status", "locked");
  await write(page, l3Answer(p, false));
  await checkIt(page);
  await expect(page.getByTestId("check")).toHaveText("Check the chord qualities", { timeout: 60_000 });
  // The bass alone does not name the chords: the qualities stage fails until the chords are written.
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("Not quite", { timeout: 60_000 });
  await write(page, l3Answer(p, true));
  await checkIt(page);
  await expect(page.getByTestId("check")).toHaveText("Check the Roman numerals", { timeout: 60_000 });
  await shots(page, "ladder-l3-stages");
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("That's it", { timeout: 60_000 });
  await expect(page.getByTestId("solved")).toBeVisible();
  for (const i of [0, 1, 2])
    await expect(page.getByTestId("stages").locator("li").nth(i)).toHaveAttribute("data-status", "passed");
  const saved = await api<{ gradedPass?: boolean }>(page, "GET", `/transcriptions/${id}`);
  expect(saved.body.gradedPass).toBe(true);
});
