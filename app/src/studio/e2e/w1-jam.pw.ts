// Oak 2.0 W1 (S3 jam then edit, S4 focus one part) against the real server: Jam hides every hint, tip and compare
// and closes the tutor with its own notice; edited Runs are takes; Jam off opens the takes; Cut hides a take (never
// deletes it); Build writes a new version from picked lines; the timebox names a stop and break and never stops the playback;
// Focus mutes the other lines; the rough-pass row only describes. Run at the wave gate only (Task 9 Step B6).
import { expect, type Page, test } from "@playwright/test";
import { api, createSketch, openSketch, typeAtEnd, unlockFirstLessons, WB } from "./helpers.ts";

// `JAM_TUTOR_NOTICE` in app/src/studio/jam.ts (written out: the spec does not load app modules).
const JAM_NOTICE = "Jam is on: the tutor waits until you switch to editing.";

// `.swingBy` is ahead of the course after the first lessons, so "Ahead of the course" shows outside a jam.
const CODE = [
  "setcpm(90/4)",
  "",
  'drums: s("bd hh sd hh").swingBy(1/3, 4)',
  'bass: note("c2 ~ g2 ~").s("triangle")',
  'mel: n("0 2 4 2").scale("C4:major").s("piano")',
  "",
].join("\n");

const HINTS = ["locked-hints", "harmony-hints", "sound-hints", "music-hints", "track-hints"] as const;

interface Version {
  version: number;
  code: string;
  note: string | null;
  takeState?: "open" | "kept" | "cut" | null;
}

async function versions(page: Page, id: string): Promise<Version[]> {
  return (await api<{ versions: Version[] }>(page, "GET", `/sketches/${id}`)).body.versions;
}

async function runAndStop(page: Page, saved: string): Promise<void> {
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("save-state")).toContainText(saved, { timeout: 20_000 });
  await page.keyboard.press("ControlOrMeta+.");
}

async function openTutor(page: Page): Promise<void> {
  const rail = page.getByTestId("tutor-rail");
  if (await rail.isVisible()) await rail.getByRole("button", { name: "Show tutor" }).click();
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await page.close();
});

test("jam then edit: takes, cut, build, timebox, focus and the rough pass", async ({ page }) => {
  const id = await createSketch(page, "Jam", CODE);
  await openSketch(page, id);
  await expect(page.getByTestId("locked-hints")).toBeVisible({ timeout: 20_000 });

  // Jam on: no hint or tip callout, no Compare, the tutor waits with the jam notice.
  await page.getByTestId("jam-toggle").click();
  await expect(page.getByTestId("jam-toggle")).toHaveAttribute("aria-pressed", "true");
  for (const h of HINTS) await expect(page.getByTestId(h)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Compare with version/ })).toHaveCount(0);
  await openTutor(page);
  await expect(page.getByTestId("tutor-closed")).toHaveText(JAM_NOTICE);

  // Three edited Runs: three takes.
  await typeAtEnd(page, 'hats: s("hh*8")');
  await runAndStop(page, "Saved v2");
  await typeAtEnd(page, '\nperc: s("~ cp")');
  await runAndStop(page, "Saved v3");
  await typeAtEnd(page, '\nkick: s("bd*2")');
  await runAndStop(page, "Saved v4");
  const jammed = await versions(page, id);
  expect(jammed.map((v) => v.takeState ?? null)).toEqual([null, "open", "open", "open"]);

  // The rough-pass row only describes the last Run.
  await page.getByTestId("rough-pass-toggle").check();
  await expect(page.getByTestId("rough-pass")).toHaveText(/^This take has /);
  await expect(page.getByTestId("rough-pass")).not.toHaveText(/[✓✗%]|\d/);

  // Jam off: the takes panel, newest first; the hints come back.
  await page.getByTestId("jam-toggle").click();
  const panel = page.getByTestId("takes-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("take-row")).toHaveCount(3);
  await expect(page.getByTestId("locked-hints")).toBeVisible({ timeout: 20_000 });

  // Cut the middle take: hidden, never deleted; "Show cut takes (1)" brings it back into view.
  await panel.locator("[data-testid=take-row][data-version='3']").getByTestId("take-cut").click();
  await expect(panel.getByTestId("take-row")).toHaveCount(2);
  await expect(panel.getByText("Show cut takes (1)")).toBeVisible();
  expect((await versions(page, id)).map((v) => v.version)).toEqual([1, 2, 3, 4]);
  await panel.getByTestId("show-cut-takes").check();
  await expect(panel.getByTestId("take-row")).toHaveCount(3);
  await panel.getByTestId("show-cut-takes").uncheck();

  // Build: drums from the first take, kick from the last; a new version with both lines, opened in the editor.
  await panel.getByTestId("build-drums-2").check();
  await panel.getByTestId("build-kick-4").check();
  await panel.getByTestId("build-takes").click();
  await expect(page.getByTestId("save-state")).toContainText("Saved v5", { timeout: 20_000 });
  const built = (await versions(page, id)).at(-1) as Version;
  expect(built.takeState ?? null).toBeNull();
  expect(built.note).toBe("Built from takes 2, 4");
  expect(built.code).toContain('drums: s("bd hh sd hh").swingBy(1/3, 4)');
  expect(built.code).toContain('kick: s("bd*2")');
  expect(built.code).not.toContain("bass:");
  await expect(page.locator(".cm-content")).toContainText('kick: s("bd*2")');

  // Timebox: the stop-and-break line appears when the clock runs out, and the playback keeps going.
  await page.getByTestId("jam-toggle").click();
  await page.clock.install();
  await page.getByTestId("timebox-task").fill("groove");
  await page.getByTestId("timebox-5").check({ force: true });
  await page.getByRole("button", { name: "Start the clock" }).click();
  await expect(page.getByTestId("timebox-clock")).toBeVisible();
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  await page.clock.fastForward("05:01");
  await expect(page.getByText("Time's up for “groove”. Stop here and take a short break.")).toBeVisible();
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1");
  await page.getByTestId("timebox-switch").click();
  await page.keyboard.press("ControlOrMeta+.");
  await expect(page.getByTestId("jam-toggle")).toHaveAttribute("aria-pressed", "false");

  // Focus on the drums line: the other lines are muted (their chips show it), the self-check asks the learner.
  await page.locator(".cm-line", { hasText: "drums:" }).click();
  await page.getByTestId("focus-toggle").click();
  const focus = page.getByTestId("focus-panel");
  await expect(focus).toHaveAttribute("data-focus", "drums");
  await expect(page.getByTestId("focus-check")).toContainText("Could this part be released on its own?");
  await expect(page.getByTestId("mute-kick")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("mute-drums")).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Not yet" }).click();
  await expect(page.getByTestId("focus-answer")).toHaveText("Stay with it a little longer.");
  await page.getByTestId("focus-end").click();
  await expect(page.getByTestId("mute-kick")).toHaveAttribute("aria-pressed", "false");
});

test("focus on the bass line mutes drums", async ({ page }) => {
  const id = await createSketch(page, "Focus", CODE);
  await openSketch(page, id);
  await page.locator(".cm-line", { hasText: "bass:" }).click();
  await page.getByTestId("focus-toggle").click();
  await expect(page.getByTestId("focus-panel")).toHaveAttribute("data-focus", "bass");
  await expect(page.getByTestId("mute-drums")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("mute-bass")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("focus-check")).toBeVisible();
});
