// Wave 6 in Transcribe (contracts §2.9 L8, §6.6 CF-T; content/specs/CF.md; wave6.md §5.4), driven through the page
// with the L8 endpoints answered by a stand-in (standard-fixtures.ts); the real server's answers are exercised by
// w6-integration.pw.ts from the "ladder L8" and "CF-T open" seeds. A standard in four stages: the form map on the
// strip under the timeline, wrong (its sections marked, a message per section, never the answer) and right (the
// draft's skeleton written from it, the map kept as the project's regions); a code stage one section at a time,
// failed with a message that names its bars and passed; the key plan as a ribbon that follows the player's
// transposition; the swung grid. Keyboard first: the strip's own keys, X at the playing bar, digits loop sections.
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { A_CHART, STANDARD_ID, standardPool, standardStandIn } from "./standard-fixtures.ts";
import { checkIt, seed } from "./support.ts";

const SHOTS = new URL("./screenshots", import.meta.url).pathname;
const URL_OF = `/transcribe/${STANDARD_ID}`;

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

async function shots(page: Page, name: string) {
  for (const s of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), s.theme);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await shoot(page, SHOTS, name, s.theme);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "paper"));
}

const editorText = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector(".cm-content") as HTMLElement | null;
    return el ? [...el.querySelectorAll(".cm-line")].map((l) => l.textContent ?? "").join("\n") : "";
  });

/** Replaces one const line of the editor's code (the learner writes that section). */
async function setConst(page: Page, name: string, body: string) {
  const code = await editorText(page);
  const next = code.replace(new RegExp(`^const ${name} = .*$`, "m"), `const ${name} = ${body}`);
  expect(next, `the code has a line for ${name}`).not.toBe(code);
  const editor = page.locator(".cm-content").first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(next);
}

/** The map as the project's regions, as the "ladder L8" seed keeps a passed form. */
const MAPPED = [1, 9, 17, 25].map((bar, i) => ({
  id: `form-${bar}`,
  label: ["A", "A", "B", "A"][i] as string,
  startS: Math.round((((bar - 1) * 240) / 132) * 1000) / 1000,
  endS: Math.round((((bar + 7) * 240) / 132) * 1000) / 1000,
  kind: "section" as const,
}));

test("L8, the form map: a wrong map marks its sections and says what to compare; the right one writes the draft", async ({
  page,
}) => {
  await seed(page, "own-audio project");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const server = await standardStandIn(page);
  await page.goto(URL_OF);

  const panel = page.getByTestId("standard-panel");
  await expect(panel).toContainText("Level 8 · A standard");
  await expect(page.getByTestId("song-title")).toHaveText("Test Standard (1925)");
  const given = page.getByTestId("given");
  await expect(given).toContainText("132 BPM");
  await expect(given).toContainText("C major, home is C");
  await expect(given).toContainText("Swing 8ths");
  await expect(given).toContainText("One chorus, 32 bars");
  // The form is the question: it is nowhere on the page, and the bars carry no section marks.
  await expect(page.getByTestId("transcribe-project")).not.toContainText("AABA");
  await expect(page.getByTestId("swing-label")).toHaveText("Swing 8ths");
  const stages = page.getByTestId("stages").locator("li");
  await expect(stages).toHaveCount(4);
  await expect(stages.nth(0)).toHaveAttribute("data-status", "open");
  await expect(stages.nth(1)).toHaveAttribute("data-status", "locked");
  await expect(page.locator(".cm-content").first()).toContainText("First the form");

  // Nothing to check yet, and the button says why.
  await expect(page.getByTestId("check")).toBeDisabled();
  await expect(page.getByTestId("check-why")).toContainText("Cut the tune into sections first");

  // Keyboard: Shift+X goes to the strip; the arrows walk the bar lines; Enter cuts; a letter names.
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("transcribe-project").focus();
  await page.keyboard.press("Shift+X");
  const strip = page.getByTestId("form-strip");
  await expect(strip).toBeFocused();
  await expect(strip).toHaveAttribute("aria-valuetext", /Bar line 1: the start/);
  for (let i = 0; i < 16; i++) await page.keyboard.press("ArrowRight");
  await expect(strip).toHaveAttribute("data-cursor", "17");
  await page.keyboard.press("Enter");
  await expect(strip).toHaveAttribute(
    "aria-valuetext",
    /Bar line 17: a cut\. Section 2, bars 17 to 32, not named yet/,
  );
  await page.keyboard.press("b");
  await page.keyboard.press("Home");
  await page.keyboard.press("a");
  await expect(page.getByTestId("form-map")).toHaveAttribute("data-form", "AB");
  await expect(page.getByTestId("form-summary")).toHaveText("A B · 2 sections of 16 bars");

  // Two halves: wrong. The verdict counts, each line names a place, the strip marks the sections, no answer shown.
  await expect(page.getByTestId("check")).toBeEnabled();
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("The form: not yet.");
  await expect(page.getByTestId("check-lines")).toContainText(
    "A new section starts at bar 9; your map has no boundary there.",
  );
  await expect(page.getByTestId("check-lines").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("form-section").first()).toHaveAttribute("data-mark", "issue");
  await expect(page.getByTestId("stages").locator("li").nth(0)).toHaveAttribute("data-status", "open");
  expect(server.submissions.at(-1)).toMatchObject({
    stage: "form",
    formMap: { sections: ["A", "B"], bars: [1, 17] },
    rung: 0,
  });

  // X cuts at the bar now playing: 3 loops the third four-bar line (bars 9–12), X cuts where it starts. Then a
  // click on a bar line, and names typed in the panel.
  await page.getByTestId("transcribe-project").focus();
  await page.keyboard.press("3");
  await expect(page.getByTestId("loop-label")).toHaveText("bars 9–12");
  await page.keyboard.press("x");
  await expect(page.getByTestId("form-section")).toHaveCount(3);
  await page.locator('[data-testid="form-line"][data-bar="25"]').click();
  await expect(page.getByTestId("form-section")).toHaveCount(4);
  const names = page.getByTestId("form-name");
  await names.nth(1).fill("a");
  await names.nth(3).fill("A");
  await expect(page.getByTestId("form-map")).toHaveAttribute("data-form", "AABA");

  // A reload keeps the unchecked map (kept per project on this device).
  await page.reload();
  await expect(page.getByTestId("form-map")).toHaveAttribute("data-form", "AABA");

  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText("The form: that's it, A A B A.");
  await expect(page.getByTestId("stages").locator("li").nth(0)).toHaveAttribute("data-status", "passed");
  await expect(page.getByTestId("stages").locator("li").nth(1)).toHaveAttribute("data-status", "open");
  // The draft's skeleton: one const per distinct section and track, the sections in order.
  const code = await editorText(page);
  expect(code).toContain("// Form: A (bars 1–8) · A (9–16) · B (17–24) · A (25–32)");
  expect(code).toContain("bass: arrange([8, bassA], [8, bassA], [8, bassB], [8, bassA])");
  expect(code.match(/^const bass[AB] = /gm)).toHaveLength(2);
  // The map is kept as the project's sections (a backup exports it), and the strip now only loops.
  expect(server.regions).toHaveLength(4);
  expect(server.regions[2]).toMatchObject({ id: "form-17", label: "B", kind: "section" });
  await expect(page.locator('[data-testid="form-line"]')).toHaveCount(0);
  await expect(page.getByTestId("check")).toHaveText(/Check section 1 \(A\)/);
  await page.getByTestId("form-section").nth(2).click();
  await expect(page.getByTestId("loop-label")).toHaveText("bars 17–24");
});

test("L8, a stage section by section: the changes fail naming their bars, pass once written, and a repeat passes as it stands", async ({
  page,
}) => {
  await seed(page, "own-audio project");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const server = await standardStandIn(page, { passed: ["form", "bass"], regions: MAPPED });
  await page.goto(URL_OF);

  // Progress is kept between sessions: form and bass are passed, the changes are open, the map is on the strip.
  const stages = page.getByTestId("stages").locator("li");
  await expect(stages.nth(0)).toHaveAttribute("data-status", "passed");
  await expect(stages.nth(1)).toHaveAttribute("data-status", "passed");
  await expect(stages.nth(2)).toHaveAttribute("data-status", "open");
  await expect(stages.nth(3)).toHaveAttribute("data-status", "locked");
  await expect(page.getByTestId("form-map")).toHaveAttribute("data-form", "AABA");
  await expect(page.getByTestId("phrase-progress")).toHaveText("0 of 4 passed");
  await expect(page.getByTestId("chart-title")).toHaveText("Section 1 (A): bars 1–8");
  // No draft came with the project (the form passed last session, nothing written since): the section lines are
  // written from the map.
  await expect(page.locator(".cm-content").first()).toContainText("const chordsA =");
  await expect(page.locator(".cm-content").first()).toContainText(
    "mel: arrange([8, melA], [8, melA], [8, melB], [8, melA])",
  );

  // Digits loop a section.
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("transcribe-project").focus();
  await page.keyboard.press("3");
  await expect(page.getByTestId("loop-label")).toHaveText("bars 17–24");

  // A wrong chart: minor where the song has a dominant, a wrong root later.
  await setConst(page, "chordsA", 'chord("<C Em A7 A7 D7 D7 F G7>").voicing().s("piano").gain(.6)');
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText(
    "Changes, section 1 (A): not yet, 75% right; 85% passes. Bars 2 and 7 differ. Loop the section and listen again.",
  );
  await expect(page.getByTestId("check-lines")).toContainText(
    "Bar 2: a minor chord where the song has a dominant 7th on the same root.",
  );
  await expect(page.getByTestId("bar-marks")).toHaveText("bar 2, bar 7");
  expect(server.submissions.at(-1)).toMatchObject({ stage: "changes", phrase: 1, rung: 0 });

  // Written as heard: it passes, and the next section opens.
  await setConst(page, "chordsA", `chord("<${A_CHART.join(" ")}>").voicing().s("piano").gain(.6)`);
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toHaveText("Changes, section 1 (A): that's it (96%).");
  await expect(page.getByTestId("phrase-progress")).toHaveText("1 of 4 passed");
  await expect(page.getByTestId("check")).toHaveText(/Check section 2 \(A\)/);
  // The A that comes back is the same const: it passes as it stands.
  await checkIt(page);
  await expect(page.getByTestId("phrase-progress")).toHaveText("2 of 4 passed");
  await expect(page.getByTestId("chart-title")).toHaveText("Section 3 (B): bars 17–24");
  expect(server.submissions.at(-1)).toMatchObject({ stage: "changes", phrase: 2 });
  await shots(page, "w6-standard-changes");
});

test("L8: the key plan is a ribbon over the bars and follows the player's transposition; the form strip in both themes", async ({
  page,
}) => {
  await seed(page, "own-audio project");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await standardStandIn(page);
  // The song's key plan reaches the page with the item `ladder.next` returned (requested of the server on the
  // project too): here it is put where the page keeps that item.
  await page.addInitScript((id) => {
    sessionStorage.setItem(
      `oak.transcribe.song-item.${id}`,
      JSON.stringify({
        given: {
          bpm: 132,
          meter: "4/4",
          key: { tonic: "C", mode: "major" },
          pickup: null,
          bars: 32,
          keyPlan: [
            { bar: 1, key: { tonic: "C", mode: "major" } },
            { bar: 25, key: { tonic: "D", mode: "major" } },
          ],
        },
        song: { songId: "song.test-standard", title: "Test Standard", year: 1925 },
        phrases: null,
        stages: ["form", "bass", "changes", "melody"],
      }),
    );
  }, STANDARD_ID);
  await page.goto(URL_OF);
  const spans = page.getByTestId("key-span");
  await expect(spans).toHaveCount(2);
  await expect(spans.nth(0)).toHaveText("C major");
  await expect(spans.nth(1)).toContainText("D major");
  await expect(spans.nth(1)).toContainText("+2: up a whole step");
  await expect(page.getByTestId("key-plan-text")).toContainText("C major, then D major from bar 25");
  // Transposed down a whole step, the ribbon says what sounds; the given keys stay what is written.
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("transcribe-project").focus();
  await page.keyboard.press("-");
  await page.keyboard.press("-");
  await expect(spans.nth(0)).toContainText("sounds in B♭ major");
  await expect(spans.nth(1)).toContainText("sounds in C major");
  await expect(spans.nth(1)).toContainText("D major");
  await page.keyboard.press("=");
  await page.keyboard.press("=");
  await expect(spans.nth(0)).toHaveText("C major");

  // A map half made, for the screenshots: two cuts, one name.
  await page.locator('[data-testid="form-line"][data-bar="9"]').click();
  await page.locator('[data-testid="form-line"][data-bar="17"]').click();
  await page.getByTestId("form-name").first().fill("A");
  await expect(page.getByTestId("check-why")).toContainText("Name section 2 (bars 9–16)");
  await shots(page, "w6-standard-form");
  // No horizontal overflow at the smaller size.
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the ladder at L8: the standards, what is passed of each, and why one is not open", async ({ page }) => {
  await seed(page, "own-audio project");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await standardPool(page);
  await page.goto("/transcribe");
  await expect(page.getByTestId("ladder-summary")).toContainText("Level 8 · Standards, a full arrangement");
  await expect(page.getByTestId("l8-note")).toContainText("the form map first");
  const rows = page.getByTestId("song-picker").first().getByTestId("song-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Five Foot Two, Eyes of Blue (1925)");
  await expect(rows.nth(0)).toContainText("done");
  await expect(rows.nth(1)).toContainText("2 of 4 stages · next: the changes");
  await expect(rows.nth(1).getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(rows.nth(2)).toContainText("Form, bass, changes, melody");
  await expect(rows.nth(2)).toContainText("Being checked");
  await expect(rows.nth(2).getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("ladder-next")).toHaveText("Next standard · Level 8");
  await shots(page, "w6-ladder-l8");
});
