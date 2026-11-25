// Oak 2.0 W1 capture anywhere (Task 1) against the real server: "Capture an idea" and Mod+Shift+K open the dialog on
// Today and in a lesson (focus mode); a tapped snare rhythm at 120 bpm lands in Studio › Scraps as a drums line; a
// voice memo (C4 E4 G4 E4 at 100 bpm, made here with @oak/pitch/synth) with four taps on its beat lands as a tune
// line in C major. Tap and Memo need the capture engines (W1 stage A). Run only at the wave gate (W1 plan Task 9
// Step B6).
import { concat, encodeWav16, silence, tone } from "@oak/pitch/synth";
import { expect, type Page, test } from "@playwright/test";
import { unlockFirstLessons } from "./helpers.ts";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const captureDialog = (page: Page) => page.getByRole("dialog", { name: "Capture an idea" });

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await page.close();
});

test.describe.configure({ mode: "serial" });

test("the top-bar button and Mod+Shift+K open the capture dialog on Today and in a lesson", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Capture an idea" }).click();
  const dialog = captureDialog(page);
  await expect(dialog).toBeVisible();
  // The learner sees Oak's values before starting: C major, 90, 4/4.
  await expect(dialog.getByTestId("capture-bpm")).toHaveValue("90");
  await expect(dialog.getByTestId("capture-tonic")).toHaveValue("C");
  await expect(dialog.getByTestId("capture-meter")).toHaveValue("4/4");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.keyboard.press("ControlOrMeta+Shift+K");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");

  // In a lesson (focus mode), the focus bar has the button and the shortcut works too.
  await page.goto("/learn/U01.L01?preview=true");
  await expect(page.locator("[data-mode=focus]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Capture an idea" }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.keyboard.press("ControlOrMeta+Shift+K");
  await expect(dialog).toBeVisible();
  expect(errors).toEqual([]);
});

test("Tap: a snare rhythm at 120 bpm lands in scraps as a drums line", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Capture an idea" }).click();
  const dialog = captureDialog(page);
  await dialog.getByRole("radio", { name: "Tap" }).click();
  await dialog.getByTestId("capture-bpm").fill("120");
  // No drum is chosen for the learner.
  await expect(dialog.getByTestId("capture-tap-start")).toBeDisabled();
  await dialog.getByRole("radio", { name: "Snare" }).check();
  await expect(dialog.getByTestId("capture-bars")).toHaveValue("2");
  await dialog.getByTestId("capture-tap-start").click();
  // One bar of count-in, then two bars of taps on the beat (eight at 120 bpm: every 500 ms).
  await expect(dialog.getByTestId("capture-tapping")).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
  }
  const result = dialog.getByTestId("capture-result");
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(result).toContainText('drums: s("sd").struct(');
  await dialog.getByTestId("capture-save").click();
  await expect(dialog).toBeHidden();
  await page.goto("/studio?scraps=1");
  const row = page.getByTestId("scrap-row").filter({ hasText: 's("sd").struct(' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("tapped");
  await expect(row).toHaveAttribute("data-role", "drums");
  expect(errors).toEqual([]);
});

test("Memo: a recording with four taps on its beat lands as a tune line in C major", async ({ page }) => {
  const errors = watchErrors(page);
  const SR = 44_100;
  const beat = 60 / 100;
  const note = (hz: number) => tone({ hz, seconds: beat * 0.9, sampleRate: SR, wave: "voice", amp: 0.5 });
  const gap = () => silence(beat * 0.1, SR);
  const pcm = concat([
    silence(0.5, SR),
    note(261.63),
    gap(),
    note(329.63),
    gap(),
    note(392.0),
    gap(),
    note(329.63),
    gap(),
    silence(0.5, SR),
  ]);
  const wav = Buffer.from(encodeWav16(pcm, SR));

  await page.goto("/");
  await page.getByRole("button", { name: "Capture an idea" }).click();
  const dialog = captureDialog(page);
  await dialog.getByRole("radio", { name: "Voice memo" }).click();
  await expect(dialog.getByTestId("capture-tonic")).toHaveValue("C");
  await dialog.getByRole("radio", { name: "Tune" }).click();
  await dialog
    .getByTestId("capture-memo-file")
    .setInputFiles({ name: "idea.wav", mimeType: "audio/wav", buffer: wav });
  await expect(dialog).toContainText("idea.wav");
  await dialog.getByTestId("capture-memo-start").click();
  await expect(dialog.getByTestId("capture-listening")).toBeVisible({ timeout: 10_000 });
  // Playback starts 0.1 s after the click; the first note 0.5 s into the file. Four taps, one per note.
  await page.waitForTimeout(600);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Space");
    if (i < 3) await page.waitForTimeout(beat * 1000);
  }
  const result = dialog.getByTestId("capture-result");
  await expect(result).toBeVisible({ timeout: 20_000 });
  await expect(result).toContainText('mel: n("');
  await expect(result).toContainText('.scale("C4:major")');
  await dialog.getByTestId("capture-save").click();
  await expect(dialog).toBeHidden();
  await page.goto("/studio?scraps=1");
  const row = page.getByTestId("scrap-row").filter({ hasText: "from a voice memo" });
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-role", "tune");
  await expect(row.getByTestId("scrap-code")).toContainText('n("');
  await expect(row.getByTestId("scrap-code")).toContainText('.scale("C4:major")');
  expect(errors).toEqual([]);
});
