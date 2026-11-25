// Oak 2.0 W3 Task 2 (PLAN §4 S6 habits mirror, catalog of attributes) against the real server: every Studio Run saves
// its version with the worker's analysis; three free sketches that give the bass ebass make a habit sentence in the
// Habits tab; "Sounds like something you made before?" → Not this time puts the habit's avoidance card on a fourth
// sketch; a catalog of a unit song writes its six lines into a new sketch with no reading of the song on screen
// before, and Compare then shows Oak's tempo. Run only at the wave gate (W3 Task 6 B6), after stage A (habits, the
// deck) and stage B (catalogs, the slots).
import { expect, type Page, test } from "@playwright/test";
import { api, openSketch, unlockFirstLessons, WB } from "./helpers.ts";

const BASS = 'bass: note("a1 ~ e2 ~").s("ebass")';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const editor = (page: Page) => page.locator(".cm-content").first();
async function setCode(page: Page, code: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
}
async function run(page: Page, version: number): Promise<void> {
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("save-state")).toContainText(`Saved v${version}`, { timeout: 20_000 });
  await page.keyboard.press("ControlOrMeta+.");
}
async function newFree(page: Page, title: string): Promise<string> {
  const r = await api<{ sketch: { id: string } }>(page, "POST", "/sketches", {
    title,
    originKind: "free",
    originId: null,
    sessionId: null,
    code: "setcpm(84/4)\n",
    bpm: 84,
    meter: "4/4",
    key: null,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: false,
  });
  expect(r.status).toBe(200);
  return r.body.sketch.id;
}

interface Listed {
  id: string;
  archived: boolean;
}
/** The habits mirror reads every unarchived free sketch: the other specs' sketches are archived for this file. */
let parked: string[] = [];

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  const list = await api<{ items: Listed[] }>(page, "GET", "/sketches");
  parked = (list.body.items ?? []).filter((s) => !s.archived).map((s) => s.id);
  for (const id of parked) await api(page, "PATCH", `/sketches/${id}`, { archived: true });
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  for (const id of parked) await api(page, "PATCH", `/sketches/${id}`, { archived: false });
  await page.close();
});

test("three Runs save three versions, each with an analysis", async ({ page }) => {
  const errors = watchErrors(page);
  const id = await newFree(page, "Analysed");
  await openSketch(page, id);
  await setCode(page, 'setcpm(84/4)\n\ndrums: s("bd ~ sd ~")\n');
  await run(page, 2);
  await setCode(
    page,
    'setcpm(84/4)\n\ndrums: s("bd ~ sd ~")\nchords: note("<[a2,c3,e3] [f2,a2,c3]>").s("piano")\n',
  );
  await run(page, 3);
  await setCode(page, `setcpm(84/4)\n\ndrums: s("bd ~ sd ~")\n${BASS}\n`);
  await run(page, 4);
  const detail = await api<{ versions: { version: number; analysis: unknown }[] }>(
    page,
    "GET",
    `/sketches/${id}`,
  );
  const newest = [...detail.body.versions].sort((a, b) => b.version - a.version).slice(0, 3);
  expect(newest.map((v) => v.version)).toEqual([4, 3, 2]);
  for (const v of newest)
    expect({ v: v.version, analysed: v.analysis !== null }).toEqual({ v: v.version, analysed: true });
  // That sketch is not one of the three below.
  await api(page, "PATCH", `/sketches/${id}`, { archived: true });
  parked.push(id);
  expect(errors).toEqual([]);
});

test("the Habits tab names the bass sound three sketches share; Not this time puts it on a fourth as a card", async ({
  page,
}) => {
  const errors = watchErrors(page);
  for (const title of ["Ebass one", "Ebass two", "Ebass three"]) {
    const id = await newFree(page, title);
    await openSketch(page, id);
    await setCode(page, `setcpm(84/4)\n\n${BASS}\n`);
    await run(page, 2);
  }
  await page.goto("/studio?habits=1");
  const tab = page.getByTestId("habits-tab");
  await expect(tab.getByTestId("habit").filter({ hasText: "the bass the sound ebass" })).toHaveText(
    "3 of your 3 sketches give the bass the sound ebass.",
  );

  const fourth = await newFree(page, "Something new");
  await openSketch(page, fourth);
  await page.getByTestId("sounds-like").click();
  await expect(page.getByTestId("sounds-like-list")).toHaveCount(0);
  await page.getByTestId("sounds-like-same").fill("Sound: I keep using the same bass sound.");
  await page.getByTestId("sounds-like-reveal").click();
  const list = page.getByTestId("sounds-like-list");
  await list.locator('[data-habit="sound.bass.ebass"]').getByTestId("not-this-time").click();
  await expect(list.locator('[data-habit="sound.bass.ebass"]')).toContainText("On this sketch as a card");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("cards-panel").getByTestId("card-text")).toContainText(
    "Not this time: no ebass on the bass.",
  );
  const detail = await api<{ cards: { cardId: string }[] }>(page, "GET", `/sketches/${fourth}`);
  expect(detail.body.cards.map((c) => c.cardId)).toEqual(["habit.sound.bass.ebass"]);
  expect(errors).toEqual([]);
});

test("a catalog of a unit song: six lines, Hide it and write, and Oak's tempo only on Compare", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/studio?catalog=new");
  const tab = page.getByTestId("catalogs-tab");
  await tab.getByTestId("catalog-new").click();
  const flow = page.getByTestId("catalog-flow");
  await flow.getByTestId("catalog-ref").selectOption({ index: 1 });
  const lines: Record<string, string> = {
    tempo: "walking pace, about 100",
    sound: "piano and a soft kit",
    harmony: "bright, four chords",
    melody: "a short tune that climbs",
    rhythm: "kick on one and three",
    form: "an intro, then a verse and a chorus",
  };
  for (const [k, v] of Object.entries(lines)) await flow.getByTestId(`catalog-line-${k}`).fill(v);
  // The learner listens and writes first: nothing of Oak's reading is on screen.
  await expect(page.locator("[data-testid^=oak-reading-]")).toHaveCount(0);
  await expect(flow).not.toContainText("BPM");
  await flow.getByTestId("catalog-hide-and-write").click();

  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  const text = await editor(page).evaluate((el) =>
    [...el.querySelectorAll(".cm-line")].map((l) => l.textContent ?? "").join("\n"),
  );
  for (const [k, v] of Object.entries(lines)) expect(text).toContain(`// ${k}: ${v}`);
  expect(text).toContain("setcpm(100/4)");
  const aside = page.getByTestId("catalog-lines");
  await expect(aside).toBeVisible();
  await expect(page.locator("[data-testid^=oak-reading-]")).toHaveCount(0);
  // W5 S9: Compare waits until a part has been written from the lines, not just the comment-only sketch.
  await expect(aside.getByTestId("catalog-compare-open")).toHaveCount(0);
  await setCode(page, `${text}\ndrums: s("bd*4")\n`);
  await run(page, 2);
  await expect(page.locator("[data-testid^=oak-reading-]")).toHaveCount(0);
  await aside.getByTestId("catalog-compare-open").click();
  await expect(aside.getByTestId("oak-reading-tempo")).toContainText("BPM", { timeout: 60_000 });
  expect(errors).toEqual([]);
});
