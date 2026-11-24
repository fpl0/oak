// Wave 5 song items in Transcribe (contracts §2.9, §6.6 X2, §6.12; wave5.md §5.3), driven through the page with
// the song endpoints answered by a stand-in (song-fixtures.ts) — the real server's answers are exercised by
// w5-ladder.pw.ts from the "ladder L5" and "ladder L6" seeds. L5: the givens, the phrase map, a phrase that fails
// with lines that name its bars (marked on the timeline), a phrase that passes and moves the map on, the keys that
// loop phrases. L6: bass → changes → melody, "bass only" and "without melody" listening, the chart read from the
// chords: line, the melody line by line, the song done.
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import {
  BLUES_CHART,
  BLUES_ID,
  BLUES_MELODY,
  BLUES_ROOTS,
  bluesProject,
  FOLK_ID,
  FOLK_MELODY,
  folkProject,
  standIn,
} from "./song-fixtures.ts";
import { checkIt, seed } from "./support.ts";

const SHOTS = new URL("./screenshots", import.meta.url).pathname;

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

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

/** Replaces one labelled line of the editor's code (the learner edits that line). */
async function replaceLine(page: Page, label: string, line: string) {
  const code = await page.evaluate(() => {
    const el = document.querySelector(".cm-content") as HTMLElement | null;
    return el ? [...el.querySelectorAll(".cm-line")].map((l) => l.textContent ?? "").join("\n") : "";
  });
  const next = code.replace(new RegExp(`^${label}:.*$`, "m"), line);
  const editor = page.locator(".cm-content").first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(next);
}

test("L5: phrase by phrase — a wrong phrase names its bars, the right one passes, keys loop phrases", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await seed(page, "own-audio project");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const server = await standIn(page, folkProject());
  await page.goto(`/transcribe/${FOLK_ID}`);

  const panel = page.getByTestId("song-panel");
  await expect(panel).toContainText("Level 5 · Public-domain folk");
  await expect(page.getByTestId("song-title")).toHaveText("Test Folk (trad.)");
  const given = page.getByTestId("given");
  await expect(given).toContainText("96 BPM");
  await expect(given).toContainText("C major, home is C");
  await expect(given).toContainText("Pickup: 1 beat, from beat 4");
  // The timeline names the phrases and numbers bars from the first full bar.
  await expect(page.getByTestId("timeline-marks")).toContainText("Phrase 1");
  await expect(page.getByTestId("timeline-marks")).toContainText("Phrase 2");
  await expect(page.getByRole("button", { name: "Loop pickup" })).toBeVisible();
  await expect(page.getByTestId("phrase-map").locator("button").first()).toHaveAttribute(
    "data-status",
    "open",
  );
  await expect(page.getByTestId("phrase-map").locator("button").nth(1)).toHaveAttribute(
    "data-status",
    "locked",
  );
  // The starter writes the pickup as rests then a placeholder on beat 4.
  await expect(page.locator(".cm-content").first()).toContainText('melody: n("<[~ ~ ~ 0] 0 0 0 0 0 0 0 0>")');

  // Keyboard: digits loop a phrase (its pickup bar with it), PageDown the next, C the whole song.
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("transcribe-project").focus();
  await page.keyboard.press("1");
  await expect(page.getByTestId("loop-label")).toHaveText("pickup + bars 1–4");
  await page.keyboard.press("PageDown");
  await expect(page.getByTestId("loop-label")).toHaveText("bars 4–8");
  await page.keyboard.press("PageUp");
  await expect(page.getByTestId("loop-label")).toHaveText("pickup + bars 1–4");
  await page.keyboard.press("c");
  await expect(page.getByTestId("loop-label")).toHaveText("pickup + bars 1–8");
  await page.keyboard.press("c");
  await expect(page.getByTestId("loop-label")).toHaveText("Off");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("transport-play")).toHaveAccessibleName(/Pause/);
  await page.keyboard.press("Space");

  // The starter fails phrase 1: the verdict names the bars, each line its bar and beat, the timeline marks them.
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText(
    "Phrase 1: not yet, 40% right; 85% passes. Bars 2 and 3 differ. Loop it and listen again.",
  );
  await expect(page.getByTestId("check-lines")).toContainText("Bar 2, beat 3: 1 where the song has 5.");
  await expect(page.getByTestId("bar-marks")).toHaveText("bar 2, bar 3");
  await expect(page.getByTestId("bar-timeline").locator('[data-mark="issue"]')).toHaveCount(2);
  expect(server.submissions.at(-1)).toMatchObject({ phrase: 1, rung: 0 });
  await shots(page, "w5-l5-failed");

  // The tune as heard passes phrase 1; phrase 2 opens.
  await replaceLine(page, "melody", `melody: n("${FOLK_MELODY}").scale("C4:major").s("piano")`);
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText("Phrase 1: that's it (100%).");
  await expect(page.getByTestId("phrase-map").locator("button").first()).toHaveAttribute(
    "data-status",
    "passed",
  );
  await expect(page.getByTestId("check")).toHaveText("Check phrase 2");
  await expect(page.getByTestId("phrase-progress")).toHaveText("1 of 2 passed");
  await checkIt(page);
  await expect(page.getByTestId("song-done")).toBeVisible();
  await expect(page.getByTestId("next-item")).toHaveText("Next song");
  expect(server.submissions.at(-1)).toMatchObject({ phrase: 2, rung: 0 });
  await shots(page, "w5-l5-done");
});

test("L6: bass, then changes, then melody — listening to the bass alone, the chart, line by line", async ({
  page,
}) => {
  test.setTimeout(200_000);
  await seed(page, "own-audio project");
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  const server = await standIn(page, bluesProject());
  await page.goto(`/transcribe/${BLUES_ID}`);

  await expect(page.getByTestId("song-panel")).toContainText("Level 6 · Blues");
  const given = page.getByTestId("given");
  await expect(given).toContainText("G major, home is G");
  await expect(given).toContainText("one 12-bar strain");
  await expect(given).toContainText("Swing 8ths");
  await expect(given).toContainText("One chord a bar");
  await expect(page.getByTestId("swing-label")).toHaveText("Swing 8ths");
  await expect(page.getByTestId("timeline-marks")).toContainText("12-bar strain");
  await expect(page.getByTestId("timeline-marks")).toContainText("Line 2");
  const stages = page.getByTestId("stages").locator("li");
  await expect(stages.nth(0)).toHaveAttribute("data-status", "open");
  await expect(stages.nth(1)).toHaveAttribute("data-status", "locked");
  await expect(page.getByTestId("check")).toHaveText("Check the bass");

  // The bass stage listens to the bass alone (R1 allows it); Shift+M and Shift+B switch, again: everything.
  const listen = page.getByTestId("listen");
  await expect(listen.getByRole("radio", { name: "Bass only" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("transcribe-project").focus();
  await page.keyboard.press("Shift+M");
  await expect(listen.getByRole("radio", { name: "Without melody" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Shift+M");
  await expect(listen.getByRole("radio", { name: "Everything" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Shift+B");
  await expect(listen.getByRole("radio", { name: "Bass only" })).toHaveAttribute("aria-checked", "true");
  // C loops the chorus (the strain); 3 loops line 3.
  await page.keyboard.press("c");
  await expect(page.getByTestId("loop-label")).toHaveText("bars 1–12");
  await page.keyboard.press("3");
  await expect(page.getByTestId("loop-label")).toHaveText("bars 9–12");

  // A wrong bass names its bar; the roots as heard pass and the changes open, listening without the melody.
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText(
    "The bass: not yet, 50% right; 90% passes. Bar 2 differs. Loop it and listen again.",
  );
  await replaceLine(page, "bass", `bass: n("<${BLUES_ROOTS.join(" ")}>").scale("G2:major").s("ebass")`);
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText("The bass: that's it (95%).");
  await expect(stages.nth(0)).toHaveAttribute("data-status", "passed");
  await expect(stages.nth(1)).toHaveAttribute("data-status", "open");
  await expect(listen.getByRole("radio", { name: "Without melody" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("check")).toHaveText("Check the changes");

  // The chart fills in from the chords: line as it is typed; Check sends it.
  await expect(page.getByTestId("changes-chart")).toBeVisible();
  await replaceLine(
    page,
    "chords",
    `chords: chord("<${BLUES_CHART.join(" ")}>").voicing().s("piano").gain(.6)`,
  );
  await expect(page.getByTestId("changes-chart")).toContainText("D7");
  await shots(page, "w5-l6-changes");
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText("The changes: that's it (95%).");
  expect(server.submissions.at(-1)?.stage).toBe("changes");
  expect(server.submissions.at(-1)?.code).toContain(`chord("<${BLUES_CHART.join(" ")}>")`);

  // The melody, line by line: line 1 open, then the rest; the song is done.
  await expect(page.getByTestId("check")).toHaveText("Check line 1");
  await expect(listen.getByRole("radio", { name: "Everything" })).toHaveAttribute("aria-checked", "true");
  await replaceLine(page, "melody", `melody: n("${BLUES_MELODY}").scale("G4:major").s("piano")`);
  for (const line of [1, 2, 3]) {
    await expect(page.getByTestId("check")).toHaveText(`Check line ${line}`);
    await checkIt(page);
    await expect(page.getByTestId("verdict")).toHaveText(`Melody, line ${line}: that's it (95%).`);
  }
  expect(server.submissions.filter((x) => x.stage === "melody").map((x) => x.phrase)).toEqual([1, 2, 3]);
  await expect(page.getByTestId("song-done")).toBeVisible();
  await expect(stages.nth(2)).toHaveAttribute("data-status", "passed");
  await shots(page, "w5-l6-done");
});

test("L6 at R3: the whole mix plays, and the page says why", async ({ page }) => {
  await seed(page, "own-audio project");
  await standIn(page, { ...bluesProject(), realism: 3 });
  await page.goto(`/transcribe/${BLUES_ID}`);
  const listen = page.getByTestId("listen");
  await expect(listen).toContainText(
    "With this sound (a dense mix, the part a little buried) the whole mix plays",
  );
  await expect(listen.getByRole("radio", { name: "Bass only" })).toBeDisabled();
  await expect(listen.getByRole("radio", { name: "Everything" })).toHaveAttribute("aria-checked", "true");
});

test("the list offers the L5 pool: a locked song says why, Start opens the song with its givens", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seed(page, "own-audio project");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const project = folkProject();
  await standIn(page, project);
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  await page.route("**/api/ladder", (route) =>
    route.request().method() === "GET"
      ? route.fulfill(json({ level: 5, realism: 0, history: [], gradedPasses: { "5": 1 }, levelUp: null }))
      : route.continue(),
  );
  const song = (o: Record<string, unknown>) => ({
    year: "trad",
    level: 5,
    phrases: [
      [1, 4],
      [5, 8],
    ],
    status: "open",
    lockedReason: null,
    passedPhrases: [],
    passedStages: [],
    ...o,
  });
  await page.route("**/api/ladder/songs", (route) =>
    route.fulfill(
      json({
        items: [
          song({ songId: "song.test-folk", title: "Test Folk", passedPhrases: [] }),
          song({
            songId: "song.aura-lee",
            title: "Aura Lee",
            year: 1861,
            status: "done",
            passedPhrases: [1, 2],
          }),
          song({
            songId: "song.drunken-sailor",
            title: "Drunken Sailor",
            status: "locked",
            lockedReason: "Opens with the lesson “Modes”",
          }),
        ],
      }),
    ),
  );
  const asked: unknown[] = [];
  await page.route("**/api/ladder/items", (route) => {
    asked.push(route.request().postDataJSON());
    return route.fulfill(
      json({
        itemId: project.id,
        level: 5,
        realism: 0,
        seed: 1,
        stages: null,
        given: {
          bpm: 96,
          meter: "4/4",
          key: { tonic: "C", mode: "major" },
          pickup: { units: [1, 1] },
          bars: 8,
        },
        project,
        song: { songId: "song.test-folk", title: "Test Folk", year: "trad" },
        phrases: [
          [1, 4],
          [5, 8],
        ],
      }),
    );
  });
  await page.goto("/transcribe");
  const picker = page.getByTestId("song-picker");
  await expect(picker.getByTestId("song-row")).toHaveCount(3);
  await expect(picker.getByTestId("song-row").nth(1)).toContainText("done");
  await expect(picker.getByTestId("song-row").nth(2)).toContainText("Opens with the lesson “Modes”");
  await expect(picker.getByTestId("song-row").nth(2).getByRole("button")).toHaveCount(0);
  await shoot(page, SHOTS, "w5-song-picker", "paper");
  // Keyboard: Tab to Start and press Enter.
  await picker.getByRole("button", { name: "Start" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/transcribe/${project.id}$`));
  expect(asked).toEqual([{ sessionId: null, gymId: null, level: 5, songId: "song.test-folk" }]);
  await expect(page.getByTestId("given")).toContainText("Pickup: 1 beat, from beat 4");
  await expect(page.getByTestId("check")).toHaveText("Check phrase 1");
});
