// Wave 6 integration on the Transcribe stack (5213 / 8813), against the REAL server's L8 endpoints (wave6.md §5.4)
// from the "ladder L8" and "CF-T open" seeds (§6). From "ladder L8" (CF-T released, the ladder at L8, a second
// standard with its form and bass passed): the standard opens at its changes stage, a wrong chart fails with a
// message that names a bar, and the chart as the source plays it passes; the third standard starts at its form map,
// where a wrong map fails with what to listen for and the song's own map passes and writes the draft. From
// "CF-T open": the slots are CF-T's, Transcribe says so and links to it, and L8 is not on the ladder yet.
//
// What the right answer is comes from the song's answer key in content/repertoire (its `chords` and `sections`):
// the project's stimulus carries the recording's notes, not its chord symbols.
import { expect, type Page, test } from "@playwright/test";
import { useUiPrefs } from "../../../../e2e/support/ui.ts";
import { api, checkIt } from "./support.ts";

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

async function seedAt(page: Page, point: string) {
  await api(page, "PUT", "/dev/clock", { reset: true });
  const r = await api(page, "POST", "/dev/seed", { point });
  expect(r.status, `the dev seed "${point}" (wave6.md §6): ${JSON.stringify(r.body)}`).toBe(200);
}

interface SongRow {
  songId: string;
  title: string;
  level: number;
  status: string;
  passedStages: string[];
}
interface Detail {
  id: string;
  songId: string | null;
  ladderLevel: number | null;
}

const editorText = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector(".cm-content") as HTMLElement | null;
    return el ? [...el.querySelectorAll(".cm-line")].map((l) => l.textContent ?? "").join("\n") : "";
  });
async function setEditor(page: Page, code: string) {
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
}

/** The song's answer key (content/repertoire/<song>/song.ts): its chords by bar and beat, its sections. */
interface SongKey {
  bars: number;
  chords?: { bar: number; beat: number; symbol: string }[];
  sections?: { label: string; bars: [number, number] }[];
}
async function songKey(songId: string): Promise<SongKey> {
  const mod = (await import(`../../../../content/repertoire/${songId.replace(/^song\./, "")}/song.ts`)) as {
    default: { answerKey: SongKey };
  };
  return mod.default.answerKey;
}

/** The chord symbols the song plays in 1-based bars `from…to` (two in a bar when it changes on beat 3). */
function chartOf(key: SongKey, from: number, to: number): string[] {
  const out: string[] = [];
  for (let bar = from; bar <= to; bar++) {
    const inBar = (key.chords ?? []).filter((c) => c.bar === bar).sort((x, y) => x.beat - y.beat);
    const symbols = inBar.map((c) => c.symbol);
    out.push(symbols.length > 1 ? `[${symbols.join(" ")}]` : (symbols[0] ?? "~"));
  }
  return out;
}

test("ladder L8: a standard opens at its changes stage; a wrong chart names a bar, the chart as played passes", async ({
  page,
}) => {
  await seedAt(page, "ladder L8");
  await useUiPrefs(page, { theme: "paper", motion: "off" });

  // The ladder card: level 8, the standards, and the one under way says where it stands.
  await page.goto("/transcribe");
  await expect(page.getByTestId("ladder-summary")).toContainText("Level 8");
  const songs = await api<{ items: SongRow[] }>(page, "GET", "/ladder/songs");
  expect(songs.status, JSON.stringify(songs.body)).toBe(200);
  const under = songs.body.items.find(
    (s) => s.level === 8 && s.status === "open" && s.passedStages.includes("bass"),
  );
  expect(under, `a standard with its form and bass passed: ${JSON.stringify(songs.body.items)}`).toBeTruthy();
  const row = page.getByTestId("song-row").filter({ hasText: (under as SongRow).title });
  await expect(row).toContainText("2 of 4 stages · next: the changes");
  await row.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/transcribe\/tr/);
  const id = page.url().split("/").pop() as string;

  const stages = page.getByTestId("stages").locator("li");
  await expect(stages.nth(0)).toHaveAttribute("data-status", "passed");
  await expect(stages.nth(1)).toHaveAttribute("data-status", "passed");
  await expect(stages.nth(2)).toHaveAttribute("data-status", "open");
  await expect(page.getByTestId("check")).toHaveText(/Check section 1/);
  // The draft has (or gets) a line per section.
  if (await page.getByTestId("write-skeleton").isVisible()) await page.getByTestId("write-skeleton").click();
  await expect(page.locator(".cm-content").first()).toContainText("chords: arrange(");

  // The chart as the source plays it, for section 1's const.
  const project = await api<Detail>(page, "GET", `/transcriptions/${id}`);
  const first = /bars (\d+)–(\d+)/.exec((await page.getByTestId("chart-title").textContent()) ?? "");
  expect(first, "the chart names its bars").toBeTruthy();
  const from = Number(first?.[1]);
  const chart = chartOf(await songKey(project.body.songId as string), from, Number(first?.[2]));
  expect(
    chart.filter((c) => c === "~"),
    "the answer key has a chord in every bar of the section",
  ).toEqual([]);
  const code = await editorText(page);
  const name = /arrange\(\[\d+, (chords\w+)\]/.exec(code.slice(code.indexOf("chords: arrange(")))?.[1];
  expect(name, "section 1's chords const").toBeTruthy();
  const withChart = (bars: readonly string[]) =>
    code.replace(
      new RegExp(`^const ${name} = .*$`, "m"),
      `const ${name} = chord("<${bars.join(" ")}>").voicing().s("piano").gain(.6)`,
    );

  // A wrong chart (bars 2 and 3 chords the song does not play there; one wrong bar of eight would still pass at
  // 0.85): not a pass, and the result names the first of them.
  const wrong = chart.map((c, i) => (i === 1 || i === 2 ? (c.includes("F#o7") ? "Bb7" : "F#o7") : c));
  await setEditor(page, withChart(wrong));
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText(/Changes, section 1.*not yet/);
  await expect(page.getByTestId("check-lines")).toContainText(new RegExp(`Bar ${from + 1}\\b`));
  await expect(page.getByTestId("bar-marks")).toContainText("bar");

  // The chart as played passes.
  await setEditor(page, withChart(chart));
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText(/Changes, section 1.*that's it/);
  await expect(page.getByTestId("phrase-progress")).toContainText("1 of");
});

test("ladder L8: another standard starts at its form map; a wrong map says what to listen for, the right one writes the draft", async ({
  page,
}) => {
  await seedAt(page, "ladder L8");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  const songs = await api<{ items: SongRow[] }>(page, "GET", "/ladder/songs");
  const fresh = songs.body.items.find(
    (s) => s.level === 8 && s.status === "open" && s.passedStages.length === 0,
  );
  expect(fresh, `a standard not started yet: ${JSON.stringify(songs.body.items)}`).toBeTruthy();
  const songId = (fresh as SongRow).songId;
  // The song's own map, from its answer key (content/repertoire/<song>/song.ts).
  const key = await songKey(songId);
  const sections = key.sections ?? [];
  expect(sections.length, "the standard's answer key has its sections").toBeGreaterThan(1);

  const item = await api<{ itemId: string }>(page, "POST", "/ladder/items", {
    sessionId: null,
    gymId: null,
    level: 8,
    songId,
  });
  expect(item.status, JSON.stringify(item.body)).toBe(200);
  await page.goto(`/transcribe/${item.body.itemId}`);
  await expect(page.getByTestId("standard-panel")).toContainText("Level 8 · A standard");
  await expect(page.getByTestId("stages").locator("li").nth(0)).toHaveAttribute("data-status", "open");
  await expect(page.getByTestId("check")).toBeDisabled();

  // Wrong: two halves, named A and B.
  const half = Math.floor(key.bars / 2) + 1;
  await page.locator(`[data-testid="form-line"][data-bar="${half}"]`).click();
  await page.getByTestId("form-name").nth(0).fill("A");
  await page.getByTestId("form-name").nth(1).fill("B");
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("The form: not yet.");
  await expect(page.getByTestId("check-lines").locator("li").first()).not.toBeEmpty();
  await expect(page.getByTestId("stages").locator("li").nth(0)).toHaveAttribute("data-status", "open");

  // Right: the song's own sections, cut by keyboard and named.
  await page.locator(`[data-testid="form-line"][data-bar="${half}"]`).click();
  await page.getByTestId("form-strip").focus();
  for (const s of sections.slice(1)) {
    await page.keyboard.press("Home");
    for (let i = 1; i < s.bars[0]; i++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
  }
  for (const [i, s] of sections.entries()) await page.getByTestId("form-name").nth(i).fill(s.label);
  await expect(page.getByTestId("form-section")).toHaveCount(sections.length);
  await checkIt(page);
  await expect(page.getByTestId("verdict")).toContainText("The form: that's it");
  await expect(page.getByTestId("stages").locator("li").nth(0)).toHaveAttribute("data-status", "passed");
  await expect(page.getByTestId("stages").locator("li").nth(1)).toHaveAttribute("data-status", "open");
  await expect(page.locator(".cm-content").first()).toContainText("bass: arrange(");
  // Kept between sessions: a reload still has the form passed, on the strip and in the stages.
  await page.reload();
  await expect(page.getByTestId("stages").locator("li").nth(0)).toHaveAttribute("data-status", "passed");
  await expect(page.getByTestId("form-section")).toHaveCount(sections.length);
});

test("CF-T open: the transcription slots are CF-T's; Transcribe says so, links to it, and L8 is not offered yet", async ({
  page,
}) => {
  await seedAt(page, "CF-T open (U15.L01 done)");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/transcribe");
  await expect(page.getByTestId("cft-line")).toContainText("Standard Transcription");
  await expect(page.getByTestId("cft-line")).toContainText("(next: session 1)");
  await expect(page.getByTestId("ladder-summary")).not.toContainText("Level 8");
  await page.getByTestId("cft-line").getByRole("link", { name: "Open it" }).click();
  await expect(page).toHaveURL(/\/capstone\/CF-T/);
});
