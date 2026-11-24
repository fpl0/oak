// Ladder L5 and L6 against the real server (contracts §2.9, §6.6 X2, §6.12; wave5.md §5.3, §6), from the "ladder
// L5" and "ladder L6" seeds. L5: the started song continues at phrase 2; the placeholder tune fails with lines
// that name phrase 2's bars; the tune as heard (written from the stimulus events the page receives, as a learner
// writes what they hear) passes. L6: the song opens on the changes (its bass passed in the seed); the changes, then
// the melody line by line, pass. A server that has not built a seed yet answers 400, and the test says so.
import type { NEvent } from "@oak/content-kit";
import { R } from "@oak/content-kit";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { layerOfTrack, withChanges } from "../song.ts";
import { stimulusCode } from "../stimulus-code.ts";
import { api, checkIt } from "./support.ts";

const SHOTS = new URL("./screenshots", import.meta.url).pathname;

interface Project {
  id: string;
  bpm: number | null;
  stimulus: { events: NEvent[]; bars: number; cps: number } | null;
}
interface Song {
  songId: string;
  level: 5 | 6;
  status: string;
  passedPhrases: number[];
  passedStages: string[];
  phrases: [number, number][];
}

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

/** Seeds `point`, or skips with the server's own words when this server has not built it yet. */
async function seedOrSkip(page: Page, point: string) {
  await api(page, "PUT", "/dev/clock", { reset: true });
  const r = await api(page, "POST", "/dev/seed", { point });
  test.skip(
    r.status !== 200,
    `the "${point}" seed is not on this server yet: ${r.status} ${JSON.stringify(r.body)}`,
  );
}

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

async function editorCode(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll(".cm-content .cm-line")].map((l) => l.textContent ?? "").join("\n"),
  );
}
async function write(page: Page, code: string) {
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
  const norm = (c: string) => c.replace(/\s+/g, " ").trim();
  await expect.poll(async () => norm(await editorCode(page))).toBe(norm(code));
}
/** A layer of the reference as the learner writes it once heard, on the line the grader reads. */
function layerLine(p: Project, layer: "melody" | "bass" | "chords", label: string): string {
  const st = p.stimulus as NonNullable<Project["stimulus"]>;
  const { code } = stimulusCode(
    st.events.filter((e) => layerOfTrack(e.track) === layer),
    st.bars,
  );
  return code.replace(/^ref_\w+:/gm, `${label}:`);
}
/**
 * Puts `line` where the code's `label` layer is: every labelled line whose track belongs to the same layer
 * (`mel:` and `melody:` are both the melody) is replaced by it, so no other line of that layer is left to grade.
 */
const replaceLine = (code: string, label: string, line: string) => {
  const layer = layerOfTrack(label);
  const lines = code.split("\n");
  const at = lines.findIndex((l) => {
    const m = /^([A-Za-z_]\w*)\s*:/.exec(l);
    return m !== null && layerOfTrack(m[1] as string) === layer;
  });
  const kept = lines.filter((l, i) => {
    const m = /^([A-Za-z_]\w*)\s*:/.exec(l);
    return i === at || m === null || layerOfTrack(m[1] as string) !== layer;
  });
  if (at < 0) return `${code.trimEnd()}\n${line}\n`;
  const idx = kept.indexOf(lines[at] as string);
  kept[idx] = line;
  return kept.join("\n");
};

async function openSong(page: Page, level: 5 | 6): Promise<{ song: Song; project: Project }> {
  const songs = await api<{ items: Song[] }>(page, "GET", "/ladder/songs");
  expect(songs.status, JSON.stringify(songs.body)).toBe(200);
  const song = songs.body.items.find(
    (s) =>
      s.level === level && s.status === "open" && (s.passedPhrases.length > 0 || s.passedStages.length > 0),
  );
  expect(song, `the seed started an L${level} song`).toBeTruthy();
  await page.goto("/transcribe");
  const row = page.getByTestId("song-picker").getByTestId("song-row").filter({ hasText: "Continue" }).first();
  await row.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/transcribe\/.+/, { timeout: 30_000 });
  const id = page.url().split("/").pop() as string;
  const project = (await api<Project>(page, "GET", `/transcriptions/${id}`)).body;
  expect(project.stimulus, "a song item carries its stimulus events").toBeTruthy();
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 30_000 });
  return { song: song as Song, project };
}

test("ladder L5 (real server): phrase 2 fails with a message naming its bars, then the tune as heard passes", async ({
  page,
}) => {
  test.setTimeout(200_000);
  await seedOrSkip(page, "ladder L5");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const { song, project } = await openSong(page, 5);
  expect(song.passedPhrases).toContain(1);
  await expect(page.getByTestId("phrase-map").locator("button").first()).toHaveAttribute(
    "data-status",
    "passed",
  );
  await expect(page.getByTestId("check")).toHaveText("Check phrase 2");

  // One placeholder a bar on the melody: phrase 2 fails, each line names a bar of phrase 2.
  const [from, to] = song.phrases[1] as [number, number];
  const placeholder = replaceLine(
    await editorCode(page),
    "melody",
    `melody: n("<${Array.from({ length: project.stimulus?.bars ?? 16 }, () => "0").join(" ")}>").scale("C4:major").s("piano")`,
  );
  await write(page, placeholder);
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText(/^Phrase 2: not yet, \d+% right; 85% passes\./, {
    timeout: 60_000,
  });
  const lines = await page.getByTestId("check-lines").locator("li").allTextContents();
  expect(lines.length).toBeGreaterThan(0);
  const bars = lines.flatMap((l) => (/^Bar (\d+)/.exec(l) ? [Number(/^Bar (\d+)/.exec(l)?.[1])] : []));
  expect(bars.length, lines.join(" | ")).toBeGreaterThan(0);
  for (const b of bars)
    expect(b >= from - 1 && b <= to, `bar ${b} is in phrase 2 (${from}–${to})`).toBe(true);
  await shots(page, "w5-real-l5-failed");

  // The tune as heard passes phrase 2.
  await write(page, replaceLine(placeholder, "melody", layerLine(project, "melody", "melody")));
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText(/^Phrase 2: that's it \(\d+%\)\.$/, {
    timeout: 60_000,
  });
  await expect(page.getByTestId("phrase-map").locator("button").nth(1)).toHaveAttribute(
    "data-status",
    "passed",
  );
});

test("ladder L6 (real server): the changes on the chart, then the melody line by line", async ({ page }) => {
  test.setTimeout(240_000);
  await seedOrSkip(page, "ladder L6");
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  const { song, project } = await openSong(page, 6);
  expect(song.passedStages).toContain("bass");
  const stages = page.getByTestId("stages").locator("li");
  await expect(stages.nth(0)).toHaveAttribute("data-status", "passed");
  await expect(stages.nth(1)).toHaveAttribute("data-status", "open");
  await expect(page.getByTestId("given")).toContainText("Swing 8ths");
  await expect(page.getByTestId("check")).toHaveText("Check the changes");

  // The changes, one chord a bar, as the chart writes them (the reference's chord symbols, bar by bar).
  const st = project.stimulus as NonNullable<Project["stimulus"]>;
  const pickup = !st.events.some((e) => layerOfTrack(e.track) === "bass" && R.toNum(e.onset) < 1);
  const full = st.bars - (pickup ? 1 : 0);
  const chart = Array.from({ length: full }, (_, i) => {
    const cycle = i + (pickup ? 1 : 0);
    const e = st.events.find(
      (x) => layerOfTrack(x.track) === "chords" && Math.floor(R.toNum(x.onset)) === cycle && x.chordSymbol,
    );
    return e?.chordSymbol ?? "";
  });
  let code = await editorCode(page);
  // First a wrong chart (an E♭ minor chord in every bar, a key away from the song): not yet, and the stage stays.
  const wrong = replaceLine(
    replaceLine(code, "bass", layerLine(project, "bass", "bass")),
    "chords",
    `chords: chord("<${pickup ? "~ " : ""}${Array.from({ length: full }, () => "Ebm").join(" ")}>").voicing().s("piano")`,
  );
  await write(page, wrong);
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText(/^The changes: not yet, \d+% right; 85% passes\./, {
    timeout: 60_000,
  });
  await expect(stages.nth(1)).toHaveAttribute("data-status", "open");
  // After a fail the answer is changed through Try again; the same stage's Check comes back.
  await expect(page.getByTestId("result-retry")).toBeVisible();
  await shots(page, "w5-real-l6-failed");
  await page.getByTestId("result-retry").click();
  await expect(page.getByTestId("check")).toHaveText("Check the changes");

  code = chart.every((c) => c)
    ? withChanges(code, chart, pickup)
    : replaceLine(code, "chords", layerLine(project, "chords", "chords"));
  code = replaceLine(code, "bass", layerLine(project, "bass", "bass"));
  await write(page, code);
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText(/^The changes: that's it/, { timeout: 60_000 });
  await expect(stages.nth(2)).toHaveAttribute("data-status", "open");

  // The melody, a line at a time.
  await write(page, replaceLine(code, "melody", layerLine(project, "melody", "melody")));
  for (let line = 1; line <= Math.ceil(full / 4); line++) {
    await expect(page.getByTestId("check")).toHaveText(`Check line ${line}`);
    await checkIt(page);
    await expect(page.getByTestId("verdict")).toHaveText(new RegExp(`^Melody, line ${line}: that's it`), {
      timeout: 60_000,
    });
  }
  await expect(page.getByTestId("song-done")).toBeVisible();
  await shots(page, "w5-real-l6-done");
});
