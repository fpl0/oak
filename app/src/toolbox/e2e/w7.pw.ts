// Wave 7 in the Studio and the Toolbox against the real server (the workbench owner's second stack 5236/8836): the
// advanced tracks' lenses as a learner meets them (docs/design/wave7.md §4.2). Each test starts from the dev seed
// "after X2 (U12.L02 next)"; the rows the track lessons would grant (their tools and their completion) are written
// straight into this stack's throwaway database, as the Wave 3–6 specs here do, because the Wave 7 seed points are
// the server engineer's and a lens needs only its unlocks. What each lens says about a piece is proved in bun
// (track-lens.test.ts, demos-w7.test.ts); here is what only a page shows: that the roll, the chord band, the strips
// and the switches draw it, by keyboard and by pointer, saved as the learner's preference, in both themes.
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { toolbox } from "../../../../content/toolbox.ts";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

test.describe.configure({ mode: "serial" });

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const HEADERS = { "content-type": "application/json", origin: stack.baseURL, "x-oak": "1" };
const WB = "[data-testid=workbench]";

/** Shells by hand under a tune with tensions, over a ii–V–I in C (the changes line carries the symbols). */
const JAZZ = `setcpm(110/4)

const changes = "<Dm7 G7 C^7 C^7>"

chords: note("<[d3,f3,c4] [g2,f3,b3] [c3,e3,b3] [c3,e3,b3]>").s("rhodes").gain(.5)
bass: chord(changes).rootNotes(2).s("upright")
mel: note("<[e4 f4 a4 c5] [a4 ~ e5 ~] [d5 ~ e5 ~] [f5 ~ ~ ~]>").s("vibes")
`;
/** A son clave 3-2, keys laid back 48 ms, and 3 against 2 on two drums. */
const GROOVE = `setcpm(100/4)

clave: s("rim").struct("<[x ~ ~ x ~ ~ x ~] [~ ~ x ~ x ~ ~ ~]>")
keys: note("[c4,e4,g4]").struct("~ x ~ x").late(.02).s("piano")
three: s("lt*3")
two: s("bd*2")
`;
/** 7/8 as 2+2+3, and a thin verse against a thick chorus. */
const SEVEN = `setcpm(240/7)

const drumsVerse = s("bd ~ ~ ~ sd ~ ~")
const drumsChorus = s("bd ~ sd ~ bd sd ~, hh*7")
const keysVerse = note("[c4,e4,g4]").s("piano")
const keysChorus = note("[c4,e4,g4]").struct("x ~ x ~ x ~ x").s("piano")
drums: arrange([2, drumsVerse], [2, drumsChorus])
keys: arrange([2, keysVerse], [2, keysChorus])
`;

const row = (id: string): [string, string, string] => {
  const t = toolbox.find((x) => x.id === id);
  if (!t) throw new Error(`no toolbox row ${id}`);
  const at = Array.isArray(t.unlock.at) ? t.unlock.at[0] : t.unlock.at;
  return [id, t.kind, at as string];
};

async function api<T>(page: Page, method: string, path: string, body?: unknown) {
  const res = await page.request.fetch(`${stack.apiURL}/api${path}`, {
    method,
    headers: HEADERS,
    ...(body === undefined ? {} : { data: JSON.stringify(body) }),
  });
  return { status: res.status(), body: (await res.json().catch(() => null)) as T };
}

async function seed(page: Page): Promise<void> {
  await api(page, "PUT", "/dev/clock", { reset: true });
  let r = await api(page, "POST", "/dev/seed", { point: "after X2 (U12.L02 next)" });
  if (r.status === 400) r = await api(page, "POST", "/dev/seed", { point: "X2 released" });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
}

async function db(run: (d: import("node:sqlite").DatabaseSync) => void): Promise<void> {
  const { DatabaseSync } = await import("node:sqlite");
  const d = new DatabaseSync(`${stack.dataDir}/oak.db`);
  try {
    d.exec("PRAGMA busy_timeout = 5000");
    run(d);
  } finally {
    d.close();
  }
}

/** What completing the track lessons would write: their toolbox rows and their completion. */
async function grant(rows: readonly string[], lessons: readonly string[]): Promise<void> {
  const at = new Date(Date.now() - 86_400_000).toISOString();
  await db((d) => {
    const unlock = d.prepare(
      "INSERT OR IGNORE INTO unlocks (item_id, kind, source_kind, source_id, unlocked_at, seen) VALUES (?, ?, 'session-complete', ?, ?, 1)",
    );
    for (const [id, kind, lesson] of rows.map(row)) unlock.run(id, kind, lesson, at);
    const done = d.prepare(
      "INSERT INTO lesson_progress (lesson_id, status, started_at, completed_at, best_score, completed_version, updated_at) VALUES (?, 'completed', ?, ?, 1, 1, ?) ON CONFLICT(lesson_id) DO UPDATE SET status = 'completed', completed_at = excluded.completed_at",
    );
    for (const l of lessons) done.run(l, at, at, at);
  });
}

async function sketch(page: Page, title: string, code: string, meter = "4/4") {
  const r = await api<{ sketch: { id: string } }>(page, "POST", "/sketches", {
    title,
    originKind: "free",
    originId: null,
    sessionId: null,
    code,
    bpm: 100,
    meter,
    key: { tonic: "C", mode: "major" },
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: true,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.sketch.id;
}

async function open(page: Page, path: string): Promise<void> {
  await page.routeWebSocket(/.*/, () => {});
  await page.goto(path);
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel|Failed to load resource/i.test(m.text()))
      errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function noOverflow(page: Page): Promise<void> {
  const over = await page.evaluate(() => {
    const main = document.getElementById("main") ?? document.documentElement;
    return main.scrollWidth - main.clientWidth;
  });
  expect(over).toBeLessThanOrEqual(1);
}

/** Both themes and both sizes: the size changes in place, a reload only changes the theme. */
async function shots(page: Page, name: string, ready: (page: Page) => Promise<void>): Promise<void> {
  let theme = "";
  for (const m of SCREENSHOT_MATRIX) {
    if (m.theme !== theme) {
      theme = m.theme;
      await useUiPrefs(page, { theme: m.theme });
      await page.setViewportSize({ width: m.width, height: m.height });
      await page.reload();
      await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
    } else await page.setViewportSize({ width: m.width, height: m.height });
    await ready(page);
    await noOverflow(page);
    await shoot(page, SHOTS, name, m.theme);
  }
}

const canvas = (page: Page) => page.getByTestId("roll-canvas");
const focusWorkbench = (page: Page) => page.getByTestId("transport").click({ position: { x: 300, y: 5 } });

test("Studio, a jazz sketch: hints before the lessons; then tensions, voicings, chord-scales, jazz names and the ii–V", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await seed(page);
  const id = await sketch(page, "Shells", JAZZ);
  await open(page, `/studio/${id}`);
  const wb = page.locator(WB);
  // Before the jazz track: no track lens, and no hint about a track the learner has not started.
  await expect(wb).toHaveAttribute("data-track-lenses", "");
  await expect(page.getByTestId("lens-tensions")).toHaveCount(0);
  await expect(page.getByTestId("track-hints")).toHaveCount(0);
  // The track started (J1.L01 done): a hint names, by its title, the lesson that opens each lens (never a block).
  await grant([], ["J1.L01"]);
  await page.reload();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await expect(wb).toHaveAttribute("data-track-lenses", "");
  await expect(page.getByTestId("track-hints")).toContainText(
    "Tensions: the 9, 11 and 13 your tune plays over each chord: coming in Extensions.",
  );
  await expect(page.locator("li.oak-chord-region").first()).toHaveAttribute("data-symbol", /^Dm7/);
  await expect(page.locator("li.oak-chord-region").first()).not.toHaveAttribute("data-jazz", /./);

  // J1.L02–J2.L04 done (what their completion writes): the same sketch, read with the jazz lenses.
  await grant(
    [
      "tb.feature.jazz-glyphs",
      "chord.sixth-sus",
      "tb.voicing.n",
      "tb.set",
      "chord.alt",
      "chord.ext",
      "scale.locrian",
    ],
    ["J1.L01", "J1.L02", "J1.L03", "J1.L04", "J1.L05", "J2.L01", "J2.L02", "J2.L03", "J2.L04"],
  );
  await page.reload();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await expect(wb).toHaveAttribute("data-track-lenses", "tensions voicings chordScales");
  await expect(wb).toHaveAttribute("data-chord-style", "jazz");
  // The roll: E over Dm7 is the 9, A over G7 the 9 and E the 13, D over C∆7 the 9, the held F the avoid 11.
  await expect(canvas(page)).toHaveAttribute("data-tensions", "9 9 13 9 avoid 11");
  await expect(canvas(page)).toHaveAttribute("data-voicings", "shell | shell | shell | shell");
  // The chord band in jazz names, a common chord-scale under each chord, the ii–V bracket aiming at C.
  await expect(page.locator("li.oak-chord-region").first()).toHaveAttribute("data-jazz", "D–7");
  await expect(page.locator("li.oak-chord-region").first().locator(".oak-chord-symbol")).toHaveText("D–7");
  await expect(page.locator(".oak-jazz-cell").first()).toHaveAttribute("data-scale", "Dorian");
  await expect(page.locator(".oak-jazz-cell").first()).toHaveAttribute("data-voicing", "shell");
  await expect(page.locator(".oak-two-five").first()).toHaveText("ii–V → C major");
  await expect(page.getByTestId("track-hints")).toContainText("Shift+X names the tensions");
  // The staff writes the jazz names too.
  await expect(page.getByTestId("staff-view")).toHaveAttribute("data-chord-symbols", /D–7/);
  // review:surfaces: the staff sets its chord symbols in the UI face (Helvetica has no ♭, ♯ or ∆: "C ∆ 7" with a
  // full-width glyph in each gap), and the chord chart speaks the same jazz names as the band and the staff.
  const chordFont = await page
    .locator("[data-testid=staff-view] text.abcjs-chord")
    .first()
    .evaluate((t) => getComputedStyle(t).fontFamily);
  expect(chordFont).toMatch(/^"?Inter/);
  await page.getByRole("button", { name: "Chart", exact: true }).click();
  await expect(page.locator("[data-testid=chart-panel] .oak-chart-chord").first()).toHaveText("D–7");
  await page.getByRole("button", { name: "Chart", exact: true }).click();

  // Keyboard: Shift+X hides the tensions, saved as the learner's preference; Shift+Q the chord-scales.
  await focusWorkbench(page);
  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/settings/lenses") && r.request().method() === "PUT",
  );
  await page.keyboard.press("Shift+X");
  await expect(page.getByTestId("lens-tensions")).toHaveAttribute("aria-pressed", "false");
  await expect(canvas(page)).not.toHaveAttribute("data-tensions", /./);
  expect((await saved).status()).toBe(200);
  const boot = await api<{ settings: { lenses: { tensions?: boolean } } }>(page, "GET", "/bootstrap");
  expect(boot.body.settings.lenses.tensions).toBe(false);
  await page.keyboard.press("Shift+Q");
  await expect(page.locator(".oak-jazz-cell[data-scale]")).toHaveCount(0);
  await expect(page.getByTestId("lens-chordScales")).toHaveAttribute("aria-pressed", "false");
  // The voicings stay, over each chord on the roll.
  await expect(canvas(page)).toHaveAttribute("data-voicings", "shell | shell | shell | shell");
  // The switches in the lens bar do the same by pointer.
  await page.getByTestId("lens-tensions").click();
  await page.getByTestId("lens-chordScales").click();
  await expect(canvas(page)).toHaveAttribute("data-tensions", "9 9 13 9 avoid 11");
  await expect(page.locator(".oak-jazz-cell").first()).toHaveAttribute("data-scale", "Dorian");
  await shots(page, "w7-studio-jazz", async (p) => {
    await expect(p.getByTestId("roll-canvas")).toHaveAttribute("data-tensions", /avoid 11/);
    await expect(p.getByTestId("jazz-row")).toBeVisible();
  });
  expect(errors).toEqual([]);
});

test("Studio, rhythm and texture: the clave, microtiming and pulse lanes; 7/8 counted in its groups; density per section", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await seed(page);
  const groove = await sketch(page, "Clave", GROOVE);
  const seven = await sketch(page, "Seven", SEVEN, "7/8");
  await grant(
    ["tb.meter.odd", "tb.mini.polymeter", "tb.mini.euclid"],
    ["R1.L01", "R1.L05", "R2.L01", "R2.L04", "R3.L01", "R3.L02", "A2.L01", "A2.L02"],
  );
  await open(page, `/studio/${groove}`);
  const wb = page.locator(WB);
  await expect(wb).toHaveAttribute("data-track-lenses", "clave polyLanes microtiming");
  await expect(page.getByTestId("clave-facts")).toHaveText("Son clave 3-2 · bars 1–4 (clave)");
  await expect(page.getByTestId("clave-strip")).toHaveAttribute("data-clave", "son 3-2");
  await expect(page.locator("[data-testid=clave-strip] [data-stroke]")).toHaveCount(10);
  await expect(page.getByTestId("micro-facts")).toHaveText("keys: 48 ms behind the grid");
  await expect(page.getByTestId("pulse-caption")).toHaveText(
    "3 against 2 a bar: three and two meet only on the downbeat",
  );
  // The lens bar switches them off by pointer (the five lenses without a key of their own).
  await page.getByTestId("lens-clave").click();
  await expect(page.getByTestId("clave-strip")).toHaveCount(0);
  await expect(page.getByTestId("lens-clave")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("lens-clave").click();
  await expect(page.getByTestId("clave-strip")).toBeVisible();
  await shots(page, "w7-studio-clave", async (p) => {
    await expect(p.getByTestId("clave-strip")).toBeVisible();
    await expect(p.getByTestId("pulse-lanes")).toBeVisible();
  });

  // 7/8: the meter menu names its grouping; the roll draws the groups and counts them; the sections' density.
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, `/studio/${seven}`);
  await expect(page.getByRole("combobox", { name: "Meter" }).locator("option:checked")).toHaveText(
    "7/8 (2+2+3)",
  );
  await expect(page.getByTestId("odd-meter-facts")).toHaveText("7/8 in 2+2+3 (count 1 2 | 1 2 | 1 2 3)");
  await expect(canvas(page)).toHaveAttribute("data-odd", "1 2 | 1 2 | 1 2 3");
  await expect(canvas(page)).toHaveAttribute("data-counts", "1 2 1 2 1 2 3");
  await expect(page.locator(".oak-density-span")).toHaveCount(2);
  await expect(page.locator(".oak-density-span").nth(1)).toHaveAttribute("data-level", "1.00");
  // Shift+D hides the density strip.
  await focusWorkbench(page);
  await page.keyboard.press("Shift+D");
  await expect(page.getByTestId("density-strip")).toHaveCount(0);
  await page.keyboard.press("Shift+D");
  await expect(page.getByTestId("density-strip")).toBeVisible();
  await page.locator(".oak-wb-views").screenshot({ path: `${SHOTS}/w7-seven-eight.png` });
  expect(errors).toEqual([]);
});

test("Toolbox: the track tools' pages play their grooves and show them at work", async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page);
  await grant(
    [
      "chord.ext",
      "tb.meter.odd",
      "tb.mini.polymeter",
      "tb.fscope",
      "tb.feature.jazz-glyphs",
      "snd.vibes",
      "snd.jazzkit",
    ],
    ["J1.L01", "J1.L02", "J2.L03", "A1.L01", "A2.L01"],
  );
  // Extensions: the tensions of the tune named on the roll; it sounds (the one example heard through here).
  await open(page, "/toolbox/chord.ext");
  await expect(page.getByTestId("tool-hint")).toContainText("Extensions stack thirds");
  await expect(canvas(page)).toHaveAttribute("data-tensions", /^9 .*13/);
  await page.getByTestId("play-toggle").click();
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  await expect
    .poll(async () => Number(await canvas(page).getAttribute("data-playhead")), { timeout: 15_000 })
    .toBeGreaterThan(0.5);
  await page.getByTestId("play-toggle").click();
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "0");
  // 7/8, the polymeter, the registers on the spectrum.
  await open(page, "/toolbox/tb.meter.odd");
  await expect(canvas(page)).toHaveAttribute("data-odd", "1 2 | 1 2 | 1 2 3");
  await expect(page.getByTestId("eval-banner")).toHaveCount(0);
  await open(page, "/toolbox/tb.mini.polymeter");
  await expect(page.getByTestId("pulse-lanes")).toHaveAttribute("data-kind", "polymeter");
  await open(page, "/toolbox/tb.fscope");
  await expect(page.getByTestId("register-bands")).toBeVisible();
  await expect(page.locator("[data-testid=register-bands] .oak-register-legend li")).toHaveText([
    /^bass/,
    /^chords/,
    /^mel/,
  ]);
  await expect(page.getByTestId("register-clashes")).toHaveText(
    "No close intervals low down: every part has room.",
  );
  await shots(page, "w7-toolbox-registers", async (p) => {
    await expect(p.getByTestId("register-bands")).toBeVisible();
  });
  // A feature page: the jazz names on the lead sheet; Open in Studio by keyboard.
  await open(page, "/toolbox/tb.feature.jazz-glyphs");
  await expect(page.locator("li.oak-chord-region").first()).toHaveAttribute("data-jazz", "D–7");
  await page.getByTestId("open-in-studio").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/studio\/sk_/, { timeout: 20_000 });
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});
