// Oak 2.0 W4 F7 "From a form you mapped" (DeSantis, Formal Skeletons) against the real server: with no transcription
// project the start names the form strip and cannot create; a project at 120 BPM in 4/4 with four section regions
// (A A B A, eight bars each) makes it live; the picker shows "Your maps" and, once a unit song is started, "Oak's
// songs"; Create opens the editor with `setcpm(120/4)`, `const bassB` and four entries in `bass: arrange(`, and Run
// plays with no page error. Run only at the wave gate (W4 Task 6 B7), after stage B has registered `form-start` in
// `START_SLOTS` after `with-card`.
import { expect, type Page, test } from "@playwright/test";
import { api, unlockFirstLessons, WB } from "./helpers.ts";
import { stack } from "./playwright.config.ts";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** A second of a quiet 440 Hz sine as a 16-bit mono WAV: the audio a mapped project is made from. */
function sineWav(seconds = 1, sr = 22_050): Buffer {
  const n = Math.round(seconds * sr);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 4000), 44 + i * 2);
  return buf;
}

/** A Transcribe project with the learner's own form map: A A B A, eight bars each at 120 BPM (16 s a section). */
async function mappedProject(page: Page): Promise<string> {
  const up = await page.request.fetch(`${stack.apiURL}/api/audio?name=form.wav`, {
    method: "POST",
    headers: { origin: stack.baseURL, "x-oak": "1", "content-type": "audio/wav" },
    data: sineWav(),
  });
  expect(up.status(), await up.text()).toBe(200);
  const audioId = ((await up.json()) as { id: string }).id;
  const made = await api<{ id: string }>(page, "POST", "/transcriptions", {
    sourceKind: "own-audio",
    audioId,
    songId: null,
    title: "Blue Moon Line",
    artist: null,
    ladderLevel: null,
    templateId: null,
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  const region = (label: string, startS: number) => ({
    id: `r_${label}_${startS}`,
    label,
    startS,
    endS: startS + 16,
    kind: "section",
  });
  const patched = await api(page, "PATCH", `/transcriptions/${made.body.id}`, {
    bpm: 120,
    meter: "4/4",
    key: { tonic: "C", mode: "major" },
    regions: [region("A", 0), region("A", 16), region("B", 32), region("A", 48)],
  });
  expect(patched.status, JSON.stringify(patched.body)).toBe(200);
  return made.body.id;
}

async function openNewSketch(page: Page) {
  await page.goto("/studio");
  await page.getByTestId("new-sketch").click();
  const dialog = page.getByRole("dialog", { name: "New sketch" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: /From a form you mapped/ }).check();
  return dialog;
}

async function editorText(page: Page): Promise<string> {
  return page
    .locator(".cm-content")
    .evaluate((el) => [...el.querySelectorAll(".cm-line")].map((l) => l.textContent ?? "").join("\n"));
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await page.close();
});

test("From a form you mapped: none yet names the form strip; a mapped A A B A opens as an empty skeleton", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  const before = await api<{ items: unknown[] }>(page, "GET", "/transcriptions");
  test.skip((before.body.items ?? []).length > 0, "this stack already has a transcription project");

  let dialog = await openNewSketch(page);
  await expect(dialog.getByTestId("form-start-none")).toHaveText(
    "Map a song's sections in Transcribe first (the form strip under the song).",
  );
  await expect(dialog.getByTestId("form-start-create")).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await mappedProject(page);
  // A started unit song is offered as one of Oak's songs, only beside a map of the learner's own.
  const started = await api(page, "POST", "/songs/U01/start", { flavour: "flavour.pop" });
  dialog = await openNewSketch(page);
  const picker = dialog.getByTestId("form-picker");
  await expect(picker.getByText("Your maps")).toBeVisible();
  await expect(picker.getByText("Blue Moon Line")).toBeVisible();
  if (started.status === 200) await expect(picker.getByText("Oak's songs")).toBeVisible();
  await expect(dialog.getByTestId("form-bpm")).toHaveValue("120");
  await dialog.getByTestId("form-start-create").click();

  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  const code = await editorText(page);
  expect(code).toContain("setcpm(120/4)");
  expect(code.match(/const bassB\b/g)?.length).toBe(1);
  const bassLine = code.split("\n").find((l) => l.startsWith("bass: arrange(")) ?? "";
  expect(bassLine.match(/\[8, bass[AB]\]/g)?.length).toBe(4);
  expect(code).not.toContain(".s(");

  // The Workbench's Play (its button is named "Play"; `play-toggle`).
  await page.getByTestId("play-toggle").click();
  await page.waitForTimeout(1_500);
  expect(errors).toEqual([]);
});
