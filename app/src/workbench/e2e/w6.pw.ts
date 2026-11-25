// Wave 6 on the workbench's own page (port 5193; the Wave 6 harness `/?w6=<piece>`, dev/Wave6Harness.tsx): the
// guide-tone lens, sevenths, applied and borrowed chords at each depth of the course, the key ribbon, the mode's
// colour note and the key panel's Wave 6 rows, the beat grid in 6/8 and with triplets, pushes and ghost notes, and
// the d3 carry-overs (the editor wraps, the ribbon's arrows reach every section, the staff pages to the section
// that plays). What a pure function decides is in wave6.test.ts; here is what only a page can show: that the roll,
// the band, the staff and the panels draw it, by pointer and by keyboard. Paper only (themes: the Studio suite).
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

const WB = "[data-testid=workbench]";
const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));

async function open(page: Page, query: string): Promise<void> {
  // Other engineers' edits reload the page through Vite's HMR socket mid-test: block it.
  await page.routeWebSocket(/.*/, () => {});
  await page.goto(`/?${query}`);
  await page.waitForSelector(`${WB}[data-analysis=ready]`, { timeout: 45_000 });
}

const canvas = (page: Page) => page.getByTestId("roll-canvas");
const regions = (page: Page) => page.locator("li.oak-chord-region");
const focusWorkbench = (page: Page) => page.getByTestId("transport").click({ position: { x: 300, y: 5 } });

test("sevenths: the guide tones are marked and joined on the roll and the staff; Shift+I switches them", async ({
  page,
}) => {
  await open(page, "w6=sevenths&done=all");
  const wb = page.locator(WB);
  await expect(wb).toHaveAttribute("data-depth", "sevenths applied borrowed chromatic");
  await expect(regions(page)).toHaveCount(3);
  await expect(regions(page).nth(0)).toHaveAttribute("data-symbol", /^Dm7/);
  await expect(regions(page).nth(1)).toHaveAttribute("data-symbol", /^G7/);
  await expect(regions(page).nth(2)).toHaveAttribute("data-symbol", /^Cmaj7/);
  await expect(wb).toHaveAttribute("data-music-lenses", "guideTones");
  await expect(canvas(page)).toHaveAttribute("data-guide-lines", "F → F → E | C → B → B");
  await expect(page.getByTestId("guide-facts")).toHaveText("Guide tones: F → F → E · C → B → B");
  await expect(page.getByTestId("lens-guideTones")).toHaveAttribute("aria-pressed", "true");
  // The staff marks the same heads: a 3rd and a 7th in each of the four bars' chords at least.
  await expect(page.locator("[data-testid=staff-view]")).toHaveAttribute("data-status", "ready");
  await expect.poll(() => page.locator(".oak-staff-host .oak-guide").count()).toBeGreaterThanOrEqual(6);
  await expect(page.locator(".oak-staff-host .oak-guide-seventh").first()).toBeVisible();
  // The bass plays roots: none of its notes is marked.
  expect(Number(await canvas(page).getAttribute("data-guide"))).toBe(10);
  await page.locator(".oak-wb-views").screenshot({ path: `${SHOTS}/w6-guide-tones.png` });
  // Hover text names the guide tone.
  // Keyboard: Shift+I turns the lens off and on again; nothing else changes.
  await focusWorkbench(page);
  await page.keyboard.press("Shift+I");
  await expect(page.getByTestId("lens-guideTones")).toHaveAttribute("aria-pressed", "false");
  await expect(canvas(page)).not.toHaveAttribute("data-guide-lines", /./);
  await expect(page.getByTestId("guide-facts")).toHaveCount(0);
  await expect(page.locator(".oak-staff-host .oak-guide")).toHaveCount(0);
  await expect(regions(page)).toHaveCount(3);
  await page.keyboard.press("Shift+I");
  await expect(canvas(page)).toHaveAttribute("data-guide-lines", "F → F → E | C → B → B");
});

test("before sevenths are taught the band writes triads and there is no guide-tone switch", async ({
  page,
}) => {
  await open(page, "w6=sevenths&unlocked=tb.feature.chord-symbols,tb.feature.rn");
  await expect(page.locator(WB)).toHaveAttribute("data-depth", "");
  await expect(regions(page).nth(0)).toHaveAttribute("data-symbol", /^Dm(\/|$)/);
  await expect(regions(page).nth(1)).toHaveAttribute("data-symbol", /^G(\/|$)/);
  await expect(regions(page).nth(2)).toHaveAttribute("data-symbol", /^C(\/|$)/);
  await expect(regions(page).nth(1)).toHaveAttribute("data-rn", /^V/);
  await expect(regions(page).nth(1)).toHaveAttribute("data-reduced", "1");
  await expect(page.getByTestId("lens-guideTones")).toHaveCount(0);
  await expect(page.locator(WB)).toHaveAttribute("data-music-lenses", "");
  // The staff's chord names agree with the band.
  await expect(page.getByTestId("staff-view")).toHaveAttribute(
    "data-chord-symbols",
    /^Dm(\/\S+)? G(\/\S+)?( C(\/\S+)?)?$/,
  );
});

test("applied and borrowed chords: an arrow to the target, a borrowed mark, and neither before its lesson", async ({
  page,
}) => {
  await open(page, "w6=chromatic&done=all");
  const d7 = regions(page).nth(1);
  await expect(d7).toHaveAttribute("data-kind", "applied");
  await expect(d7).toHaveAttribute("data-target", "V");
  await expect(d7).toHaveAttribute("data-resolves", "1");
  await expect(d7.locator(".oak-chord-arrow")).toHaveText("→ V");
  await expect(d7).toHaveAttribute("aria-label", /points at V and resolves to it/);
  const fm = regions(page).nth(4);
  await expect(fm).toHaveAttribute("data-symbol", /^Fm/);
  await expect(fm).toHaveAttribute("data-borrowed", "1");
  await expect(fm).toHaveAttribute("data-rn", /^iv/);
  await expect(fm).toHaveAttribute("aria-label", /borrowed from C minor/);
  await expect(regions(page).nth(6)).toHaveAttribute("data-rn", /^♭VI/);
  await expect(regions(page).nth(7)).toHaveAttribute("data-rn", /^♭VII/);
  // Chromatic degrees with their syllables in the notes table (♯4 fi, ♭6 le, ♭3 me).
  await page.getByRole("button", { name: "Notes table" }).click();
  const table = page.getByTestId("notes-table");
  await expect(table.locator("tr", { hasText: "♯4" }).first()).toContainText("fi");
  await page.getByRole("button", { name: "Notes table" }).click();
  await page.locator(".oak-wb-views").screenshot({ path: `${SHOTS}/w6-applied-borrowed.png` });

  // The same piece before U15.L02 and U16.L01, and before chromatic solfège: symbols stay, numerals and fi do not.
  await open(
    page,
    "w6=chromatic&unlocked=tb.feature.chord-symbols,tb.feature.rn,chord.dom7,tb.feature.degree-labels,tb.feature.solfege",
  );
  await expect(page.locator(WB)).toHaveAttribute("data-depth", "sevenths");
  const early = regions(page).nth(1);
  await expect(early).toHaveAttribute("data-symbol", /^D7/);
  await expect(early).not.toHaveAttribute("data-rn", /./);
  await expect(early).toHaveAttribute("data-reduced", "1");
  await expect(early.locator(".oak-chord-arrow")).toHaveCount(0);
  await expect(regions(page).nth(4)).not.toHaveAttribute("data-borrowed", /./);
  await expect(regions(page).nth(0)).toHaveAttribute("data-rn", /^I/);
  await page.getByRole("button", { name: "Notes table" }).click();
  const row = page.getByTestId("notes-table").locator("tr", { hasText: "♯4" }).first();
  await expect(row).toBeVisible();
  await expect(row).not.toContainText("fi");
  // The lesson that teaches a thing shows it in its own steps.
  await open(
    page,
    "w6=chromatic&lesson=U15.L02&unlocked=tb.feature.chord-symbols,tb.feature.rn,chord.dom7,tb.feature.degree-labels",
  );
  await expect(regions(page).nth(1)).toHaveAttribute("data-target", "V");
});

test("the key ribbon names the key along the piece and marks the change; numerals follow the key in force", async ({
  page,
}) => {
  await open(page, "w6=lift&done=all");
  const wb = page.locator(WB);
  await expect(wb).toHaveAttribute("data-key-plan", "C major → D major");
  const ribbon = page.getByTestId("key-ribbon");
  await expect(ribbon).toBeVisible();
  await expect(ribbon.locator("li")).toHaveCount(2);
  await expect(ribbon.locator("li").nth(1)).toHaveAttribute("data-key", "D major");
  await expect(page.getByTestId("key-change")).toHaveText("+2: up a step");
  await expect(ribbon).toHaveAttribute("aria-label", /C major from bar 1, then D major from bar 5/);
  // C F G C, then D G A D: I IV V I twice, never V/V after the lift.
  const rns = await regions(page).evaluateAll((els) =>
    els.map((el) => (el.getAttribute("data-rn") ?? "").replace(/[0-9]+$/, "")),
  );
  expect(rns).toEqual(["I", "IV", "V", "I", "I", "IV", "V", "I"]);
  // The ribbon starts where the roll's bar 5 starts.
  const edge = await page.evaluate(() => {
    const li = document.querySelectorAll("[data-testid=key-ribbon] li")[1] as HTMLElement;
    const region = document.querySelectorAll("li.oak-chord-region")[4] as HTMLElement;
    return Math.abs(li.getBoundingClientRect().left - region.getBoundingClientRect().left);
  });
  expect(edge).toBeLessThanOrEqual(2);
  await page.locator(".oak-wb-views").screenshot({ path: `${SHOTS}/w6-key-ribbon.png` });
  await focusWorkbench(page);
  await page.keyboard.press("Shift+J");
  await expect(ribbon).toHaveCount(0);
  await expect(page.getByTestId("lens-keyPlan")).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Shift+J");
  await expect(ribbon).toBeVisible();
  // A piece in one key has no ribbon and no switch for it.
  await open(page, "w6=sevenths&done=all");
  await expect(page.getByTestId("key-ribbon")).toHaveCount(0);
  await expect(page.getByTestId("lens-keyPlan")).toHaveCount(0);
});

test("a mode is named on the key panel, its colour note ringed on the roll, the modes on its tonic listed", async ({
  page,
}) => {
  await open(page, "w6=mixolydian&done=all&panels=key");
  await expect(page.getByTestId("key-panel-name")).toHaveText("G Mixolydian");
  await expect(page.getByTestId("key-panel-mode")).toHaveText(
    "Mixolydian is major with a lowered 7: F (♭7) is its colour note. It uses the notes of C major with G as home.",
  );
  await expect(page.locator("[data-testid=key-panel-scale] li[data-colour='1']")).toHaveText(/7\s*F/);
  expect(Number(await canvas(page).getAttribute("data-mode-tones"))).toBeGreaterThan(0);
  const modes = page.getByTestId("key-modes").locator("li");
  await expect(modes).toHaveCount(6);
  await expect(modes.nth(2)).toHaveAttribute("data-here", "1");
  await expect(modes.nth(3)).toContainText("G Dorian");
  // ♭VII is the mode's own chord.
  await expect(regions(page).nth(1)).toHaveAttribute("data-rn", "♭VII");
  await expect(regions(page).nth(1)).not.toHaveAttribute("data-borrowed", /./);
  await page.screenshot({ path: `${SHOTS}/w6-mode-key-panel.png`, fullPage: true });
  // Closing the panel takes the rings off (Shift+K).
  await focusWorkbench(page);
  await page.keyboard.press("Shift+K");
  await expect(canvas(page)).not.toHaveAttribute("data-mode-tones", /./);
  // Before any mode is unlocked the panel lists none (the piece's own mode is still named: the code says it).
  await open(page, "w6=mixolydian&panels=key&unlocked=tb.feature.keysig,tb.feature.degree-labels");
  await expect(page.getByTestId("key-modes").locator("li")).toHaveCount(2);
  await expect(canvas(page)).not.toHaveAttribute("data-mode-tones", /./);
});

test("6/8: the beat grid counts two beats of three; Shift+V switches it", async ({ page }) => {
  await open(page, "w6=compound&done=all");
  await expect(canvas(page)).toHaveAttribute("data-beat-grid", "compound");
  await expect(canvas(page)).toHaveAttribute("data-counts", "1 la li 2 la li");
  await expect(page.getByTestId("beat-grid-facts")).toHaveText(
    "2 beats of three eighths (count 1 la li 2 la li)",
  );
  // The tempo reads in dotted-quarter beats: 60.
  await expect(page.getByTestId("transport")).toContainText("60");
  await page.locator(".oak-wb-views").screenshot({ path: `${SHOTS}/w6-beat-grid-68.png` });
  await focusWorkbench(page);
  await page.keyboard.press("Shift+V");
  await expect(canvas(page)).not.toHaveAttribute("data-beat-grid", /./);
  await expect(page.getByTestId("lens-beatGrid")).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Shift+V");
  await expect(canvas(page)).toHaveAttribute("data-beat-grid", "compound");
});

test("4/4: a triplet's beat is cut in three, a pushed chord is drawn against its beat, ghost notes are counted", async ({
  page,
}) => {
  await open(page, "w6=rhythm&done=all");
  await expect(canvas(page)).toHaveAttribute("data-beat-grid", "triplets");
  await expect(canvas(page)).toHaveAttribute("data-counts", "1 & 2 trip let 3 & 4 &");
  expect(Number(await canvas(page).getAttribute("data-pushes"))).toBeGreaterThan(0);
  await expect(canvas(page)).toHaveAttribute("data-ghosts", "16");
  await page.locator(".oak-wb-views").screenshot({ path: `${SHOTS}/w6-rhythm.png` });
  // Before U13.L02 the quiet hits are still drawn small, but nothing is called a ghost note.
  await open(page, "w6=rhythm&unlocked=tb.feature.degree-labels");
  await expect(canvas(page)).not.toHaveAttribute("data-ghosts", /./);
  await expect(canvas(page)).not.toHaveAttribute("data-beat-grid", /./);
  await expect(page.getByTestId("lens-beatGrid")).toHaveCount(0);
});

test("the key panel lends the parallel minor's chords and previews a lift by a step; the code is untouched", async ({
  page,
}) => {
  await open(page, "w6=plain&done=all&panels=key,circle");
  const lent = page.getByTestId("key-borrowed");
  await expect(lent).toHaveAttribute("data-from", "C minor");
  await expect(lent.locator("li")).toHaveCount(4);
  await expect(lent.locator("li").nth(1)).toContainText("A♭");
  await expect(lent.locator("li").nth(1)).toContainText("♭VI");
  await expect(page.getByTestId("circle-lends")).toContainText("C minor sits three steps round the ring");
  await expect(page.locator(".oak-circle-slot[data-lends='1']")).toHaveAttribute("data-key", "E♭ major");
  await expect(page.locator(".oak-circle-slot[data-lift='1']")).toHaveAttribute("data-key", "D major");
  const before = await page.locator(".cm-content").textContent();
  const lift = page.getByTestId("key-panel").getByTestId("lift-2");
  await lift.click();
  await expect(lift).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
  await expect(page.getByTestId("key-panel").getByTestId("lift-status")).toContainText(
    '.scale("<C4:major!4 D4:major!4>")',
  );
  expect(await page.locator(".cm-content").textContent()).toBe(before);
  // Space stops the preview (keyboard), as it stops any key preview.
  await focusWorkbench(page);
  await page.keyboard.press("Space");
  await expect(lift).toHaveAttribute("aria-pressed", "false");
  // Before U16 and U17.L02 neither row is there.
  await open(page, "w6=plain&panels=key,circle&unlocked=tb.feature.keysig,tb.feature.circle");
  await expect(page.getByTestId("key-panel")).toBeVisible();
  await expect(page.getByTestId("key-borrowed")).toHaveCount(0);
  await expect(page.getByTestId("key-lift")).toHaveCount(0);
  await expect(page.locator(".oak-circle-slot[data-lends='1']")).toHaveCount(0);
});

test("a lesson step: the music lenses work inside it, a host can show or hide one, and Oak's copy comes back (d15)", async ({
  page,
}) => {
  // Inside a step the content names the labels (no label switches), but the guide-tone switch is still the learner's.
  await open(page, "w6=sevenths&done=all&step=1");
  const wb = page.locator(WB);
  await expect(wb).toHaveAttribute("data-labels", "content");
  await expect(page.getByTestId("lens-degrees")).toHaveCount(0);
  await expect(page.getByTestId("lens-guideTones")).toHaveAttribute("aria-pressed", "true");
  await expect(canvas(page)).toHaveAttribute("data-guide-lines", "F → F → E | C → B → B");
  await focusWorkbench(page);
  await page.keyboard.press("Shift+I");
  await expect(canvas(page)).not.toHaveAttribute("data-guide-lines", /./);
  // A host's choice wins and takes the switch away: hidden although unlocked and on, shown although locked.
  await open(page, "w6=sevenths&done=all&step=1&hide=guideTones");
  await expect(canvas(page)).not.toHaveAttribute("data-guide-lines", /./);
  await expect(page.getByTestId("lens-guideTones")).toHaveCount(0);
  await open(page, "w6=sevenths&step=1&show=guideTones&unlocked=tb.feature.degree-labels");
  await expect(canvas(page)).toHaveAttribute("data-guide-lines", "F → F → E | C → B → B");
  await expect(page.getByTestId("lens-guideTones")).toHaveCount(0);
  // d15: the host asks for its code again with `codeKey`; the learner's edit is replaced by Oak's copy.
  await open(page, "w6=plain&done=all&reset=1");
  const editor = page.locator(".cm-content");
  const oaks = await editor.textContent();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type('\nhats: s("hh*8")');
  await expect(editor).toContainText('hats: s("hh*8")');
  await page.getByTestId("reset-code").click();
  await expect(editor).not.toContainText("hats:");
  expect(await editor.textContent()).toBe(oaks);
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible();
});

test("d3: a 150-character line wraps inside the editor instead of scrolling it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "w6=longline&done=all");
  const m = await page.evaluate(() => {
    const scroller = document.querySelector(".oak-wb-editor .cm-scroller") as HTMLElement;
    const lines = [...document.querySelectorAll<HTMLElement>(".oak-wb-editor .cm-line")];
    const long = lines.find((l) => (l.textContent ?? "").length > 110) as HTMLElement;
    const short = lines.find((l) => (l.textContent ?? "").startsWith("drums")) as HTMLElement;
    return {
      overflow: scroller.scrollWidth - scroller.clientWidth,
      chars: (long.textContent ?? "").length,
      longH: long.getBoundingClientRect().height,
      shortH: short.getBoundingClientRect().height,
    };
  });
  expect(m.chars).toBeGreaterThan(110);
  expect(m.overflow).toBeLessThanOrEqual(1);
  expect(m.longH).toBeGreaterThan(m.shortH * 1.8);
  // The caret still lands where it is put: End goes to the end of the wrapped line, typing lands there.
  await page.locator(".oak-wb-editor .cm-line", { hasText: "bass:" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("End");
  await page.keyboard.type(".room(.2)");
  await expect(page.locator(".oak-wb-editor .cm-line", { hasText: "bass:" })).toContainText(
    ".gain(.7).room(.2)",
  );
});

test("d3: the ribbon's arrows reach every section; the staff pages to the section that plays", async ({
  page,
}) => {
  await open(page, "w6=sections&done=all");
  const wb = page.locator(WB);
  await expect(wb).toHaveAttribute("data-piece-bars", "40");
  const ribbon = page.getByTestId("section-ribbon");
  await expect(ribbon).toHaveAttribute("data-sections", "5");
  // The roll shows 16 bars at a time: Intro and Verse are on its first page.
  await expect(canvas(page)).toHaveAttribute("data-window", "0-16");
  await ribbon.locator("button").first().focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute("data-tag") ?? "");
  await expect.poll(focused).toBe("outro");
  await expect(canvas(page)).toHaveAttribute("data-window", "24-40");
  // Home goes back to the first section and its page; End to the last.
  await page.keyboard.press("Home");
  await expect.poll(focused).toBe("intro");
  await expect(canvas(page)).toHaveAttribute("data-window", "0-16");
  await page.keyboard.press("End");
  await expect.poll(focused).toBe("outro");
  // Enter loops the Outro: a new loop region turns the staff to the page that holds bar 33 at once, stopped or not
  // (StaffView `loopFrom`, the UI/UX review), although the tune rests there on its last bar. Play keeps it there.
  await page.keyboard.press("Enter");
  await expect(wb).toHaveAttribute("data-loop", "33-40");
  // (The page size depends on the lens lines under the staff: the pager names the bars.)
  await expect(page.getByTestId("staff-pager")).toContainText(/Bars 33–\d+ of 40/, { timeout: 15_000 });
  await expect(page.getByTestId("staff-view")).not.toHaveAttribute("data-page", "0");
  await page.getByTestId("play-toggle").click();
  await expect(wb).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  await expect(page.getByTestId("staff-pager")).toContainText(/Bars 33–\d+ of 40/, { timeout: 15_000 });
  await expect(page.getByTestId("staff-view")).not.toHaveAttribute("data-page", "0");
  await page.getByTestId("play-toggle").click();
  await expect(wb).toHaveAttribute("data-playing", "0");
});
