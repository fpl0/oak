// The Studio against the real server: create, edit, autosave on Run, reload, a named version (Mod+S), A/B
// against an earlier version, the Band layer audible on the master bus, locked tools as hints that never
// block, an imported version that opens as text until the strict check passes, export, the listening note
// through the fake tutor, the shortcut sheet, keyboard-only use and the screenshots of both themes and sizes.
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { api, createSketch, openSketch, rms, typeAtEnd, unlockFirstLessons, WB } from "./helpers.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    // Strudel's repl logs one console.error per evaluation error of learner code (interfaces known gap 6).
    if (m.type() === "error" && !/\[eval\]|strudel/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await page.close();
});

test("an empty sketchbook says what to do; New sketch → Oak's Blank opens it in the workbench", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/studio");
  await expect(page.getByText("Your sketchbook fills up one session at a time.")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/sketchbook-empty-paper-1440x900.png` });
  // The command palette's "New sketch" arrives as ?new=true and opens the chooser.
  await page.goto("/studio?new=true");
  const dialog = page.getByRole("dialog", { name: "New sketch" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/studio$/);
  // No Blank of the learner's yet: Oak's Blank is the start (Oak 2.0 W1: a tempo line, no part).
  await expect(dialog.getByRole("radio", { name: /Oak's Blank/ })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: /Your Blank/ })).toHaveCount(0);
  // No lesson Make yet: that start is offered but explained, not clickable.
  await expect(dialog.getByRole("radio", { name: /Make/ })).toBeDisabled();
  await expect(dialog).toContainText("Finish a lesson's Make and you can carry it on here.");
  // The learning kits (Oak's song templates) wait for their capstones, each named by its title; none is offered yet.
  await expect(dialog).toContainText("Learning kits");
  await expect(dialog.getByTestId("template-locked")).toHaveCount(4);
  await expect(dialog.getByTestId("template-locked").first()).toContainText("Four-chord pop");
  await expect(dialog.getByTestId("template-locked").first()).toContainText("Unlocks when you release");
  await expect(dialog.getByRole("radio", { name: /Four-chord pop/ })).toHaveCount(0);
  await dialog.getByLabel("Title").fill("First free sketch");
  await dialog.getByRole("button", { name: "Create sketch" }).click();
  await expect(page).toHaveURL(/\/studio\/sk/);
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("sketch-title")).toHaveText("First free sketch");
  await expect(page.getByTestId("save-state")).toContainText("Saved v1");
  await expect(page.locator(".cm-content")).toContainText("setcpm(90/4)");
  await expect(page.locator(".cm-content")).not.toContainText("bd hh sd hh");
  expect(errors).toEqual([]);
});

test("New sketch from today's Make copies its code and Band; the Make itself is untouched", async ({
  page,
}) => {
  const make = await createSketch(
    page,
    "Heartbeat (Make)",
    'setcpm(96/4)\n\ndrums: s("bd sd bd sd")\nhats: s("hh*8")\n',
    {
      originKind: "lesson-make",
      originId: "U01.L01",
      band: { bandId: "band.two-chord-vamp", flavour: "flavour.pop", mutes: ["chords"] },
      key: { tonic: "C", mode: "major" },
    },
  );
  await page.goto("/studio");
  await page.getByTestId("new-sketch").click();
  const dialog = page.getByRole("dialog", { name: "New sketch" });
  const fromMake = dialog.getByRole("radio", { name: /Today's Make/ });
  await expect(fromMake).toBeEnabled({ timeout: 10_000 });
  await fromMake.check();
  await dialog.getByRole("button", { name: "Create sketch" }).click();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".cm-content")).toContainText('hats: s("hh*8")');
  await expect(page.getByTestId("band-select")).toHaveValue("band.two-chord-vamp");
  await expect(page.locator(".oak-track-chip[data-track='band.chords']")).toHaveAttribute(
    "data-state",
    "muted",
    {
      timeout: 20_000,
    },
  );
  const original = await api<{ versions: unknown[] }>(page, "GET", `/sketches/${make}`);
  expect(original.body.versions).toHaveLength(1);
});

test("edit, Run saves a version, reload keeps it; edits not run yet are restored", async ({ page }) => {
  const id = await createSketch(page, "Autosave");
  await openSketch(page, id);
  await typeAtEnd(page, 'hats: s("hh*8")');
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("save-state")).toContainText("Saved v2", { timeout: 20_000 });
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1");
  await page.keyboard.press("ControlOrMeta+.");
  // Running the same code again does not add a version.
  await page.keyboard.press("ControlOrMeta+Enter");
  await page.waitForTimeout(800);
  await page.keyboard.press("ControlOrMeta+.");
  const after = await api<{
    versions: { version: number; code: string; flags: { lockedTools: string[] } }[];
  }>(page, "GET", `/sketches/${id}`);
  expect(after.body.versions).toHaveLength(2);
  expect(after.body.versions[1]?.code).toContain('hats: s("hh*8")');

  await page.reload();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".cm-content")).toContainText('hats: s("hh*8")');
  await expect(page.getByTestId("version-row")).toHaveCount(2);

  // Typed but not run: kept in this browser and offered back after a reload.
  await typeAtEnd(page, '\nclap: s("~ cp ~ cp")');
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByText("Restored the edits you had not run yet")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".cm-content")).toContainText("clap:");
  await page.getByRole("button", { name: "Go back to v2" }).click();
  await expect(page.locator(".cm-content")).not.toContainText("clap:");
});

test("Mod+S names a version; history compares any earlier version with A/B", async ({ page }) => {
  const id = await createSketch(page, "Named");
  await openSketch(page, id);
  await typeAtEnd(page, 'bass: s("bd*2")');
  await page.keyboard.press("ControlOrMeta+s");
  const dialog = page.getByRole("dialog", { name: "Name this version" });
  await expect(dialog).toBeVisible();
  await page.getByTestId("version-name").fill("Kick doubled");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("version-row").first()).toContainText("v2 · Kick doubled");
  await page.getByRole("checkbox", { name: "Named only" }).check();
  await expect(page.getByTestId("version-row")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Named only" }).uncheck();

  await page.getByRole("button", { name: "Compare with version 1" }).click();
  const ab = page.getByTestId("ab-controls");
  await expect(ab).toContainText("B · v1");
  await page.getByTestId("ab-b").click();
  await expect(page.getByTestId("ab-now")).toContainText("B · v1", { timeout: 15_000 });
  // B is hidden code: the editor itself is not playing, but the master bus is.
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "0");
  expect(await rms(page, 1200)).toBeGreaterThan(0.005);
  await page.getByTestId("ab-a").click();
  await expect(page.getByTestId("ab-now")).toContainText("A · now", { timeout: 15_000 });
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1");
  await page.getByTestId("ab-now").getByRole("button", { name: "Stop" }).click();
  await page.getByRole("button", { name: "Stop comparing with version 1" }).click();
  await expect(ab).toHaveCount(0);

  // "Open" puts an earlier version back in the editor without rewriting history.
  await page.getByRole("button", { name: "Open version 1 in the editor" }).click();
  await expect(page.locator(".cm-content")).not.toContainText("bass:");
  await expect(page.getByTestId("version-row")).toHaveCount(2);
});

test("a Band layer (jazz-soul kit) plays under the sketch and is heard on the master bus", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.getByTestId("new-sketch").click();
  const dialog = page.getByRole("dialog", { name: "New sketch" });
  await dialog.getByRole("radio", { name: /Over a Band/ }).check();
  await dialog.getByRole("radiogroup", { name: "Style" }).getByRole("radio", { name: "Jazz-soul" }).click();
  await dialog.getByLabel("Key: tonic").selectOption("F");
  await dialog.getByRole("button", { name: "Create sketch" }).click();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("band-select")).toHaveValue("band.two-chord-vamp");
  await expect(
    page.getByRole("radiogroup", { name: "Band style" }).getByRole("radio", { name: "Jazz-soul" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("[data-testid='mute-band.chords']")).toBeVisible({ timeout: 20_000 });
  // Only the Band sounds: the learner's own hats are muted.
  await page.getByTestId("mute-hats").click();
  await page.getByTestId("play-toggle").click();
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  await page.waitForTimeout(500);
  const withBand = await rms(page, 1500);
  expect(withBand).toBeGreaterThan(0.01);
  // Muting the Band's three tracks leaves silence.
  for (const t of ["band.drums", "band.bass", "band.chords"])
    await page.locator(`[data-testid='mute-${t}']`).click();
  await page.waitForTimeout(900);
  expect(await rms(page, 1000)).toBeLessThan(withBand / 4);
  await page.getByTestId("play-toggle").click();
  // The Band is never in the code.
  await expect(page.locator(".cm-content")).not.toContainText("rhodes");
  await expect(page.locator(".cm-content")).not.toContainText("chords:");
  await expect(page.getByTestId("liner-flags")).toContainText("Band: Oak (Jazz-soul style)");
});

test("a locked tool is a hint with its unlock lesson, and the code still runs and saves", async ({
  page,
}) => {
  const id = await createSketch(page, "Ahead", 'setcpm(90/4)\n\ndrums: s("bd hh sd hh").gain(.8)\n');
  await openSketch(page, id);
  const hints = page.getByTestId("locked-hints");
  await expect(hints).toContainText(".gain(x)", { timeout: 20_000 });
  await expect(hints).toContainText("unlocks in “Count to Four”");
  await expect(hints).not.toContainText("U01.L02");
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  await expect(page.getByTestId("eval-banner")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+.");
  // Saved, with the liner flag (contracts §3.1 rule 4). Edit and run to make a version.
  await typeAtEnd(page, 'hats: s("hh*8")');
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("save-state")).toContainText("Saved v2", { timeout: 20_000 });
  await page.keyboard.press("ControlOrMeta+.");
  const s = await api<{ versions: { flags: { lockedTools: string[] } }[] }>(page, "GET", `/sketches/${id}`);
  expect(s.body.versions[1]?.flags.lockedTools).toEqual(["tb.gain"]);
  await page.reload();
  await expect(page.getByTestId("liner-flags")).toContainText("Uses tools not yet unlocked: .gain(x)");
  await hints.getByRole("link", { name: ".gain(x)" }).click();
  await expect(page).toHaveURL(/\/toolbox\/tb\.gain$/);
});

test("an imported version opens as text and runs only after the strict check passes", async ({ page }) => {
  const id = await createSketch(page, "Imported");
  const bad = 'setcpm(90/4)\n\ndrums: s("bd hh sd hh")\nconst w = globalThis\n';
  const r = await api(page, "POST", `/sketches/${id}/versions`, {
    sessionId: null,
    code: bad,
    bpm: 90,
    meter: "4/4",
    key: null,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [], reviewBeforeRun: true },
    ranOk: false,
  });
  expect(r.status).toBe(200);
  await page.goto(`/studio/${id}`);
  const review = page.getByTestId("review-panel");
  await expect(review).toBeVisible({ timeout: 30_000 });
  await expect(review.getByText("Review before running")).toBeVisible();
  await expect(page.getByTestId("review-code")).toContainText("globalThis");
  await expect(page.locator(WB)).toHaveCount(0);
  await page.getByTestId("review-check").click();
  await expect(page.getByTestId("review-problems")).toContainText("Line 4", { timeout: 20_000 });
  await expect(page.locator(WB)).toHaveCount(0);
  // Fix it as text, check again, then it may run.
  await review.getByRole("button", { name: "Edit as text" }).click();
  await review
    .getByRole("textbox", { name: "Code of version 2" })
    .fill('setcpm(90/4)\n\ndrums: s("bd hh sd hh")\n');
  await page.getByTestId("review-check").click();
  await expect(review.getByText("The check passed")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("review-open").click();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  // Comparing with the imported version is refused while it fails the check.
  await page.getByRole("button", { name: "Compare with version 2" }).click();
  await expect(page.getByText(/did not pass the safety check/)).toBeVisible();
  await expect(page.getByTestId("ab-controls")).toHaveCount(0);
});

test("export shows the code with its liner notes and downloads a .js file", async ({ page }) => {
  const id = await createSketch(page, "Export me", 'setcpm(90/4)\n\ndrums: s("bd hh sd hh")\n', {
    key: { tonic: "D", mode: "major" },
  });
  await openSketch(page, id);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export code" });
  await expect(page.getByTestId("export-preview")).toContainText("// Export me (v1,");
  await expect(page.getByTestId("export-preview")).toContainText("// D major · 4/4 · 90 BPM");
  const download = page.waitForEvent("download");
  await page.getByTestId("export-download").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("export-me-v1.js");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("no listening notes: the sketch page offers none (owner, 2026-11-22)", async ({ page }) => {
  const id = await createSketch(page, "Listen to me");
  await openSketch(page, id);
  await expect(page.getByTestId("ask-listening")).toHaveCount(0);
  await expect(page.getByTestId("listening-note")).toHaveCount(0);
});

test("keyboard only: new sketch, run, name a version, the shortcut sheet lists the Studio and loop keys", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page.getByTestId("new-sketch")).toBeVisible();
  await page.getByTestId("new-sketch").focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "New sketch" });
  await expect(dialog.getByLabel("Title")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  // F focuses the editor from the workbench; Mod+Enter runs; Mod+. stops.
  await page.locator(WB).evaluate((el) => (el as HTMLElement).focus());
  await page.keyboard.press("f");
  await expect(page.locator(".cm-content")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type('\nhats: s("hh*8")');
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("save-state")).toContainText("Saved v2", { timeout: 20_000 });
  await page.keyboard.press("ControlOrMeta+.");
  await page.keyboard.press("ControlOrMeta+s");
  // The dialog focuses its field on open; typing before that would land in the editor.
  await expect(page.getByTestId("version-name")).toBeFocused();
  await page.keyboard.type("Keys only");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("version-row").first()).toContainText("Keys only");
  // L loops from the workbench.
  await page.locator(WB).evaluate((el) => (el as HTMLElement).focus());
  await page.keyboard.press("l");
  await expect(page.locator(WB)).toHaveAttribute("data-loop", "1-2");
  await page.keyboard.press("l");
  // The shortcut sheet.
  await page.locator("#main").focus();
  await page.keyboard.press("?");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Save a named version");
  await expect(sheet).toContainText("Loop a region on / off");
  await expect(sheet).toContainText("Metronome on / off");
  await page.keyboard.press("Escape");
});

for (const m of SCREENSHOT_MATRIX) {
  test(`screens in ${m.theme} at ${m.width}x${m.height}`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme });
    const id = await createSketch(
      page,
      `Shot ${m.theme} ${m.width}`,
      'setcpm(96/4)\n\ndrums: s("bd hh sd hh").gain(.8)\nkick: s("bd*2")\n',
      {
        key: { tonic: "C", mode: "major" },
        band: { bandId: "band.axis-4bar", flavour: "flavour.pop", mutes: [] },
      },
    );
    await page.goto("/studio");
    await expect(page.getByTestId("sketch-card").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "sketchbook", m.theme);
    await page.getByTestId("new-sketch").click();
    await page.getByRole("radio", { name: /Over a Band/ }).check();
    await page.screenshot({ path: `${SHOTS}/new-sketch-${m.theme}-${m.width}x${m.height}.png` });
    await page.keyboard.press("Escape");
    await openSketch(page, id);
    await expect(page.getByTestId("locked-hints")).toBeVisible({ timeout: 20_000 });
    // At 1280×800 the primary actions are on screen without scrolling.
    for (const tid of ["play-toggle", "name-version"]) {
      const box = await page.getByTestId(tid).boundingBox();
      expect(box).not.toBeNull();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(m.height);
    }
    await page.getByRole("button", { name: "Compare with version 1" }).click();
    await shoot(page, SHOTS, "sketch", m.theme);
    expect(errors).toEqual([]);
  });
}
