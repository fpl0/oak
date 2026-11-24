// Wave 4 against the real server (the workbench owner's second stack 5236/8836, after lenses.pw.ts in the same
// throwaway data dir). The Wave 4 dev seeds are not built yet (wave4.md §6), so the unlocks a lesson would grant are
// written straight into this stack's database, as the Wave 3 lens spec does. In the Studio: a sketch with chords
// shows no chord labels before U05.L09 (contracts 1.6, d17: chord names moved out of U05.L04; only a hint of when they arrive); then the chord band names the chords, the
// numerals follow U06.L02, the function, chord-tone, range and lead-sheet switches follow their lessons, every one by
// keyboard, and the staff carries the symbols and numerals. The Toolbox's U05–U07 feature pages show them at work,
// and the voicing() unlock moment puts the learner's U05.L07 hand voicing beside Strudel's. Screenshots in both
// themes and sizes.
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
const C = { tonic: "C", mode: "major" } as const;

/** I V vi IV in C (theory: C G Am F, T D T PD) under a melody whose strong beats are 7 chord tones of 8. */
const SONG = `setcpm(90/4)

chords: n("<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>").scale("C3:major").s("piano")
mel: n("<[4 2 0 2] [4 3 2 ~] [2 0 2 4] [3 5 7 ~]>").scale("C4:major").s("piano")
`;
/** The hand-voiced I–IV–V–I of U05.L07: common tones held, every voice moving a step at most. */
const HAND = `setcpm(88/4)

chords: note("<[c4,e4,g4] [c4,f4,a4] [b3,d4,g4] [c4,e4,g4]>").s("piano")
bass: note("<c2 f2 g2 c2>").s("piano")
`;

const row = (id: string): [string, string, string] => {
  const t = toolbox.find((x) => x.id === id);
  if (!t) throw new Error(`no toolbox row ${id}`);
  const at = Array.isArray(t.unlock.at) ? t.unlock.at[0] : t.unlock.at;
  return [id, t.kind, at as string];
};
const BASE = [
  "tb.feature.transport",
  "tb.feature.roll",
  "tb.feature.studio",
  "tb.feature.staff",
  "tb.label",
  "tb.setcpm",
  "snd.piano",
  "tb.feature.degree-labels",
  "tb.n",
  "tb.scale",
  "scale.major",
  "tb.mini.stack",
  "tb.note",
].map(row);
const U05_L04 = ["tb.arp", "tb.feature.chord-symbols"].map(row);
const U06 = ["tb.feature.rn", "tb.lens.function"].map(row);
const U07 = ["tb.lens.range", "tb.lens.chord-tones", "tb.feature.leadsheet"].map(row);
const U05_L08 = ["tb.chord", "tb.voicing", "tb.anchor", "tb.mode.below", "tb.dict.triads", "chord.triad"].map(
  row,
);

async function api<T>(page: Page, method: string, path: string, body?: unknown) {
  const res = await page.request.fetch(`${stack.apiURL}/api${path}`, {
    method,
    headers: HEADERS,
    ...(body === undefined ? {} : { data: JSON.stringify(body) }),
  });
  return { status: res.status(), body: (await res.json().catch(() => null)) as T };
}

async function grant(page: Page, rows: readonly [string, string, string][]): Promise<void> {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(`${stack.dataDir}/oak.db`);
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    const insert = db.prepare(
      "INSERT OR IGNORE INTO unlocks (item_id, kind, source_kind, source_id, unlocked_at, seen) VALUES (?, ?, 'session-complete', ?, ?, 1)",
    );
    const at = new Date(Date.now() - 86_400_000).toISOString();
    for (const [id, kind, lesson] of rows) insert.run(id, kind, lesson, at);
  } finally {
    db.close();
  }
  const u = await api<{ items: { itemId: string }[] }>(page, "GET", "/unlocks");
  for (const [id] of rows) expect(u.body.items.map((i) => i.itemId)).toContain(id);
}

async function sketch(page: Page, title: string, code: string, origin: { kind: string; id: string | null }) {
  const r = await api<{ sketch: { id: string } }>(page, "POST", "/sketches", {
    title,
    originKind: origin.kind,
    originId: origin.id,
    sessionId: null,
    code,
    bpm: 90,
    meter: "4/4",
    key: C,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: true,
  });
  expect(r.status).toBe(200);
  return r.body.sketch.id;
}

async function open(page: Page, id: string): Promise<void> {
  await page.routeWebSocket(/.*/, () => {});
  await page.goto(`/studio/${id}`);
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
}

/** Shows the staff (the roll and the staff are tabs at 1280×800) and waits for it. */
async function staffReady(page: Page): Promise<void> {
  if (await page.getByTestId("tab-both").count()) await page.getByTestId("tab-both").click();
  await expect(page.getByTestId("staff-view")).toHaveAttribute("data-status", "ready", { timeout: 30_000 });
}

/** The staff pages when lines of labels sit under it: page 1 holds bars 1–2 or the whole loop. */
const PAGE_SYMBOLS = /^C G( Am F)?$/;

const regions = (page: Page) =>
  page
    .locator("[data-testid=chord-band] li[data-symbol]")
    .evaluateAll((els) => els.map((e) => [e.getAttribute("data-symbol"), e.getAttribute("data-rn")]));

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel|Failed to load resource/i.test(m.text()))
      errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

let songId = "";

test("Studio: no chord labels before U05.L09, only a hint; then symbols, numerals and the harmony panels", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await grant(page, BASE);
  songId = await sketch(page, "Four chords", SONG, { kind: "free", id: null });
  await open(page, songId);
  const wb = page.locator(WB);
  await expect(page.getByTestId("chord-band")).toHaveCount(0);
  await expect(wb).toHaveAttribute("data-chords", "");
  await expect(page.getByTestId("lens-chordSymbols")).toHaveCount(0);
  await expect(page.getByTestId("harmony-hints")).toContainText(
    "Chord names on the roll and the staff: from “Chord Names”",
  );
  await wb.focus();
  await page.keyboard.press("Shift+H");
  await expect(page.getByTestId("chord-band")).toHaveCount(0);

  // U05.L04 and U05.L09: arpeggios, then chord symbols (the lens is on by default once unlocked).
  await grant(page, U05_L04);
  await open(page, songId);
  expect(await regions(page)).toEqual([
    ["C", "I"],
    ["G", "V"],
    ["Am", "vi"],
    ["F", "IV"],
  ]);
  await expect(wb).toHaveAttribute("data-chords", "symbols");
  await expect(page.locator("[data-testid=chord-band] .oak-chord-rn")).toHaveCount(0);
  await expect(page.getByTestId("lens-chordSymbols")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("lens-romanNumerals")).toHaveCount(0);
  await staffReady(page);
  await expect(page.getByTestId("staff-view")).toHaveAttribute("data-chord-symbols", PAGE_SYMBOLS);
  await expect(page.getByTestId("staff-view")).not.toHaveAttribute("data-romans", /./);
  // Shift+H turns them off (the saved preference), and on again.
  await wb.focus();
  await page.keyboard.press("Shift+H");
  await expect(page.getByTestId("chord-band")).toHaveCount(0);
  await expect(page.getByTestId("lens-chordSymbols")).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Shift+H");
  await expect(page.getByTestId("chord-band")).toHaveCount(1);

  // U06.L02–L03: numerals and function bands.
  await grant(page, U06);
  await open(page, songId);
  await expect(wb).toHaveAttribute("data-chords", "symbols romans");
  await expect(page.locator("[data-testid=chord-band] .oak-chord-rn")).toHaveText(["I", "V", "vi", "IV"]);
  await staffReady(page);
  await expect(page.getByTestId("staff-view")).toHaveAttribute("data-romans", /^I V( vi IV)?$/);
  await wb.focus();
  await page.keyboard.press("Shift+F");
  await expect(wb).toHaveAttribute("data-chords", "symbols romans function");
  await expect(page.locator("[data-testid=chord-band] li[data-symbol] .oak-chord-fn")).toHaveText([
    "T",
    "D",
    "T",
    "PD",
  ]);
  await page.keyboard.press("Shift+R");
  await expect(wb).toHaveAttribute("data-chords", "symbols function");

  // U07: range, chord tones and the lead sheet.
  await grant(page, U07);
  await open(page, songId);
  await wb.focus();
  await page.keyboard.press("Shift+T");
  await expect(page.getByTestId("chord-tone-pct")).toHaveText("Chord tones on strong beats: 7 of 8 · 88%");
  await page.keyboard.press("Shift+G");
  await expect(page.getByTestId("range-facts")).toHaveText("mel: C4–C5, 12 half steps, high point bar 4");
  await page.keyboard.press("Shift+L");
  await staffReady(page);
  await expect(page.getByTestId("staff-view")).toHaveAttribute("data-lead", "1");
  await expect(page.getByTestId("staff-view")).toHaveAttribute("data-chord-symbols", PAGE_SYMBOLS);
  await expect(page.getByTestId("harmony-hints")).toHaveCount(0);
  // Numerals back on for the screenshots.
  await wb.focus();
  await page.keyboard.press("Shift+R");
  await expect(wb).toHaveAttribute("data-chords", "symbols romans function");
  expect(errors).toEqual([]);
});

test("Toolbox: the U05–U07 feature pages show their feature at work", async ({ page }) => {
  const errors = watchErrors(page);
  await page.routeWebSocket(/.*/, () => {});
  const example = page.getByTestId("tool-example");
  const ready = async () =>
    expect(example.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });

  await page.goto("/toolbox/tb.feature.rn");
  await ready();
  // The demo: I vi IV V in C (n stacks [0,2,4] [5,7,9] [3,5,7] [4,6,8]).
  expect(
    await example
      .locator("[data-testid=chord-band] li[data-symbol]")
      .evaluateAll((els) => els.map((e) => `${e.getAttribute("data-symbol")} ${e.getAttribute("data-rn")}`)),
  ).toEqual(["C I", "Am vi", "F IV", "G V"]);

  await page.goto("/toolbox/tb.lens.function");
  await ready();
  await expect(example.locator(WB)).toHaveAttribute("data-chords", /function/);
  await expect(example.locator("[data-testid=chord-band] li[data-fn]")).toHaveCount(4);

  await page.goto("/toolbox/tb.lens.chord-tones");
  await ready();
  await expect(example.getByTestId("chord-tone-pct")).toHaveText(
    "Chord tones on strong beats: 4 of 4 · 100%",
  );

  await page.goto("/toolbox/tb.lens.range");
  await ready();
  await expect(example.getByTestId("range-facts")).toHaveText("mel: C4–C5, 12 half steps, high point bar 2");

  await page.goto("/toolbox/tb.feature.leadsheet");
  await ready();
  await expect(example.getByTestId("staff-view")).toHaveAttribute("data-lead", "1", { timeout: 30_000 });
  await expect(example.getByTestId("staff-view")).toHaveAttribute("data-chord-symbols", "C F");

  // A chord tool's example is the compact Workbench with the chord band. .add() (U06.L01): one stack on the
  // degrees <0 3 4 0> plays C F G C (I IV V I).
  await grant(page, ["tb.add"].map(row));
  await page.goto("/toolbox/tb.add");
  await ready();
  await expect(example.locator(WB)).toHaveClass(/oak-workbench--compact/);
  expect(
    await example
      .locator("[data-testid=chord-band] li[data-symbol]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-symbol"))),
  ).toEqual(["C", "F", "G", "C"]);
  expect(errors).toEqual([]);
});

test("the voicing() unlock moment: the learner's U05.L07 hand voicing beside Strudel's", async ({ page }) => {
  const errors = watchErrors(page);
  await grant(page, U05_L08);
  await sketch(page, "Hand-voiced cadence", HAND, { kind: "lesson-make", id: "U05.L07" });
  await page.routeWebSocket(/.*/, () => {});
  await page.goto("/toolbox/tb.voicing");
  await expect(page.getByTestId("tool-example").locator(`${WB}[data-analysis=ready]`)).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Replay the unlock moment" }).click();
  const compare = page.getByTestId("voicing-compare");
  await expect(compare).toBeVisible();
  const hand = compare.getByTestId("voicing-side-vchand");
  const mine = compare.getByTestId("voicing-side-vcstrudel");
  await expect(hand.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await expect(mine.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  await expect(mine.locator(".cm-content")).toContainText('chord("<C F G C>").voicing().s("piano")');
  await expect(mine.locator(".cm-content")).toContainText('bass: note("<c2 f2 g2 c2>")');
  // Both name the same chords on their bands: I IV V I.
  for (const side of [hand, mine])
    expect(
      await side
        .locator("[data-testid=chord-band] li[data-symbol]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-symbol"))),
    ).toEqual(["C", "F", "G", "C"]);
  await page.keyboard.press("Escape");
  await expect(compare).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const m of SCREENSHOT_MATRIX)
  test(`harmony screens in ${m.theme} at ${m.width}x${m.height}`, async ({ page }) => {
    await useUiPrefs(page, { theme: m.theme });
    await page.setViewportSize({ width: m.width, height: m.height });
    const sketches = await api<{ items: { id: string; title: string }[] }>(page, "GET", "/sketches");
    const id = sketches.body.items.find((s) => s.title === "Four chords")?.id;
    if (!id) throw new Error("no sketch");
    await open(page, id);
    await staffReady(page);
    await shoot(page, SHOTS, "w4-studio-harmony", m.theme);
    await page.locator(WB).focus();
    await page.keyboard.press("Shift+L");
    await staffReady(page);
    await shoot(page, SHOTS, "w4-studio-lead", m.theme);
    await page.locator(WB).focus();
    await page.keyboard.press("Shift+L");
    await page.goto("/toolbox/tb.lens.function");
    await expect(page.getByTestId("tool-example").locator(`${WB}[data-analysis=ready]`)).toBeVisible({
      timeout: 60_000,
    });
    await shoot(page, SHOTS, "w4-tool-function", m.theme);
    await page.goto("/toolbox/tb.voicing");
    await expect(page.getByTestId("tool-example").locator(`${WB}[data-analysis=ready]`)).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Replay the unlock moment" }).click();
    await expect(page.locator(`[data-testid=voicing-side-vcstrudel] ${WB}[data-analysis=ready]`)).toBeVisible(
      {
        timeout: 60_000,
      },
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/w4-unlock-voicing-${m.theme}-${m.width}x${m.height}.png` });
    await page.keyboard.press("Escape");
  });
