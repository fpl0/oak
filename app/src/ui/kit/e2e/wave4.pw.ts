// Wave 4 kit: the new pieces (transport bar, fine slider, A/B switch, checklist, version list, file drop zone, media
// card) in both themes and sizes and from the keyboard; the NavRail's honest Transcribe and Album states; the
// shortcut sheet's Transcribe and harmony sections; Settings › Data's own recordings with sizes and a delete that
// asks first. Every test seeds its learner (POST /api/dev/seed) and blocks Vite's HMR socket.
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { stack } from "./playwright.config.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const HEADERS = { origin: stack.baseURL, "x-oak": "1" };

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

async function api<T>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  const res = await page.request.fetch(`${stack.apiURL}/api${path}`, {
    method,
    headers: { ...HEADERS, "content-type": "application/json" },
    ...(body === undefined ? {} : { data: JSON.stringify(body) }),
    timeout: 120_000,
  });
  expect(res.status(), `${method} ${path}: ${await res.text()}`).toBeLessThan(300);
  return (await res.json()) as T;
}

async function seed(page: Page, point: string) {
  await api(page, "PUT", "/dev/clock", { reset: true });
  await api(page, "POST", "/dev/seed", { point });
}

/** A short mono 16-bit WAV of a sine, `seconds` long (the server sniffs the type from the bytes). */
function wav(seconds: number, hz: number): Buffer {
  const rate = 8000;
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 8000), 44 + i * 2);
  return b;
}

async function upload(page: Page, name: string, data: Buffer): Promise<string> {
  const res = await page.request.fetch(`${stack.apiURL}/api/audio?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { ...HEADERS, "content-type": "audio/wav" },
    data,
  });
  expect(res.status(), await res.text()).toBeLessThan(300);
  return ((await res.json()) as { id: string }).id;
}

async function project(page: Page, title: string, audioId: string): Promise<string> {
  const t = await api<{ id: string }>(page, "POST", "/transcriptions", {
    sourceKind: "own-audio",
    audioId,
    songId: null,
    title,
    artist: null,
    ladderLevel: null,
    templateId: null,
  });
  return t.id;
}

/** The status of a recording's URL as the app sees it (media is same-origin only). */
function audioStatus(page: Page, id: string): Promise<number> {
  return page.evaluate(
    async (u) => (await fetch(u, { headers: { "X-Oak": "1", Range: "bytes=0-0" } })).status,
    `/api/audio/${id}`,
  );
}

// --- the gallery ---------------------------------------------------------------------------------

/** Mounts kit/gallery/KitWave4.tsx over an app page (no other area's route needed) in a scrolling layer. */
async function openGallery(page: Page) {
  await page.goto("/settings/about");
  await expect(page.locator("#main")).toBeAttached();
  await page.evaluate(async () => {
    const host = document.createElement("div");
    host.id = "kit-w4";
    host.setAttribute(
      "style",
      "position:fixed;inset:0;overflow:auto;z-index:60;background:var(--oak-bg);color:var(--oak-text)",
    );
    document.body.append(host);
    const src = "/src/ui/kit/gallery/KitWave4.tsx";
    const m = (await import(/* @vite-ignore */ src)) as { mountKitWave4(el: HTMLElement): () => void };
    m.mountKitWave4(host);
  });
  await expect(page.getByRole("heading", { level: 1, name: "UI kit · Wave 4" })).toBeVisible();
}

async function shootLayer(page: Page, name: string, theme: string) {
  const size = page.viewportSize() ?? { width: 0, height: 0 };
  const pages = await page.evaluate(() => {
    const el = document.getElementById("kit-w4");
    if (!el) return 1;
    el.scrollTop = 0;
    return Math.max(1, Math.ceil(el.scrollHeight / el.clientHeight));
  });
  for (let i = 0; i < Math.min(pages, 6); i++) {
    await page.evaluate((n) => {
      const el = document.getElementById("kit-w4");
      if (el) el.scrollTop = n * el.clientHeight;
    }, i);
    const suffix = i === 0 ? "" : `-p${i + 1}`;
    await page.screenshot({
      path: `${SHOTS}/${name}-${theme}-${size.width}x${size.height}${suffix}.png`,
      animations: "disabled",
    });
  }
}

for (const m of SCREENSHOT_MATRIX) {
  test(`Wave 4 pieces render in ${m.theme} at ${m.width}x${m.height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
    await page.setViewportSize({ width: m.width, height: m.height });
    await useUiPrefs(page, { theme: m.theme, motion: "off" });
    await openGallery(page);
    const overflow = await page.evaluate(() => {
      const el = document.getElementById("kit-w4") as HTMLElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
    // Focus a slider so its ring is in the shot.
    await page.getByRole("slider", { name: "Speed" }).first().focus();
    await shootLayer(page, "w4-kit", m.theme);
    expect(errors).toEqual([]);
  });
}

test("the pieces work from the keyboard", async ({ page }) => {
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await openGallery(page);
  const bar = page.getByRole("group", { name: "Transport", exact: true });

  // Rate: arrows 5 %, Alt 1 %, Shift 25 %, Home/End; reset appears once moved.
  const speed = bar.getByRole("slider", { name: "Speed" });
  await expect(speed).toHaveAttribute("aria-valuetext", "75 %");
  await speed.focus();
  await page.keyboard.press("ArrowRight");
  await expect(speed).toHaveAttribute("aria-valuetext", "80 %");
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(speed).toHaveAttribute("aria-valuetext", "79 %");
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(speed).toHaveAttribute("aria-valuetext", "54 %");
  await page.keyboard.press("Home");
  await expect(speed).toHaveAttribute("aria-valuetext", "25 %");
  await page.keyboard.press("PageUp");
  await expect(speed).toHaveAttribute("aria-valuetext", "50 %");
  await bar.getByRole("button", { name: "Reset speed to 100 %" }).click();
  await expect(speed).toHaveAttribute("aria-valuenow", "1");

  // Pointer: a click on the track snaps to the step.
  const box = await speed.locator("..").boundingBox();
  if (!box) throw new Error("no track");
  await page.mouse.click(box.x + 1, box.y + box.height / 2);
  await expect(speed).toHaveAttribute("aria-valuetext", "25 %");

  // Fine-tune is centred: a step left of 0 reads −5¢.
  const cents = bar.getByRole("slider", { name: "Fine-tune" });
  await cents.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(cents).toHaveAttribute("aria-valuetext", "−5¢");

  // Pitch nudge, play, loop.
  await bar.getByRole("button", { name: "Pitch up (=)" }).click();
  await bar.getByRole("button", { name: "Pitch up (=)" }).click();
  await expect(bar.getByRole("group", { name: "Pitch" }).locator("output")).toHaveText("+2 st");
  const play = bar.getByRole("button", { name: "Play (Space)" });
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(bar.getByRole("button", { name: "Pause (Space)" })).toHaveAttribute("aria-pressed", "true");
  await bar.getByRole("button", { name: /^Loop bars 3–4/ }).click();
  await expect(bar.getByRole("button", { name: /^Loop bars 3–4/ })).toHaveAttribute("aria-pressed", "false");

  // A/B: arrows move and select; only the chosen side is in the tab order.
  const ab = page.getByRole("radiogroup", { name: "Hear" });
  await ab.getByRole("radio", { name: "A: Source" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(ab.getByRole("radio", { name: "B: Mine" })).toHaveAttribute("aria-checked", "true");
  await expect(ab.getByRole("radio", { name: "B: Mine" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(ab.getByRole("radio", { name: "A+B: Both" })).toHaveAttribute("aria-checked", "true");
  await expect(ab.getByRole("radio", { name: "A: Source" })).toHaveAttribute("tabindex", "-1");

  // Checklist: states in words, the summary counts all but optional lines.
  const list = page.getByRole("list", { name: "C2 checklist" });
  await expect(page.getByTestId("checklist-summary")).toHaveText("1 of 7 met");
  await expect(list.locator('[data-state="unmet"]')).toContainText("Not yet");
  await expect(list.locator('[data-state="locked"]')).toContainText("Opens after the one before");
  await expect(list.locator('[data-state="partial"]')).toContainText("7 of 10 beats");

  // Versions: newest first, arrows move between rows, Enter opens.
  const versions = page.getByRole("list", { name: "Versions of “Porch Light”" });
  await expect(versions.locator("[data-version]").first()).toHaveAttribute("data-version", "3");
  await expect(versions.locator('[aria-current="true"]')).toHaveAttribute("data-version", "3");
  await versions.locator('[data-version="3"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(versions.locator('[data-version="2"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(versions.locator('[aria-current="true"]')).toHaveAttribute("data-version", "2");
  await expect(versions.locator('[data-version="2"]')).toContainText("v2 · Brighter chorus");

  // File drop: a wrong file is refused with a reason, an audio file is taken.
  const zone = page.getByTestId("drop-audio");
  const chooser = page.waitForEvent("filechooser");
  await zone.getByRole("button", { name: "Choose a file…" }).click();
  await (await chooser).setFiles({
    name: "notes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF"),
  });
  await expect(zone.getByTestId("file-problem")).toHaveText(
    "“notes.pdf” is not a file Oak can open here: use MP3, WAV, FLAC, OGG or M4A.",
  );
  await zone.locator('input[type="file"]').setInputFiles({
    name: "take.wav",
    mimeType: "audio/wav",
    buffer: wav(0.2, 440),
  });
  await expect(zone.getByTestId("file-problem")).toHaveText("");
  await expect(page.getByTestId("drop-result")).toHaveText("Taken: take.wav · 3.2 KB");
  // A drop works too.
  const dt = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.items.add(new File([new Uint8Array(10)], "drop.mp3", { type: "audio/mpeg" }));
    return d;
  });
  await zone.dispatchEvent("dragenter", { dataTransfer: dt });
  await expect(zone).toHaveAttribute("data-over", "true");
  await zone.dispatchEvent("drop", { dataTransfer: dt });
  await expect(page.getByTestId("drop-result")).toHaveText("Taken: drop.mp3 · 10 B");

  // Media card: the play button names the track; without a recording it says why.
  await page.getByRole("button", { name: "Play “Porch Light”" }).click();
  await expect(page.getByRole("button", { name: "Pause “Porch Light”" })).toBeVisible();
  await expect(page.getByRole("button", { name: "“Aura Lee”: no recording yet" })).toBeDisabled();
});

test("reduced motion: the checking spinner stands still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await useUiPrefs(page, { theme: "bark" });
  await openGallery(page);
  const spinner = page.locator('[data-state="running"] svg').first();
  expect(await spinner.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

// --- the shell -----------------------------------------------------------------------------------

test("Transcribe says when the gym opens and stays reachable; the album is open after C0", async ({
  page,
}) => {
  await seed(page, "after U04.CP");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/progress");
  const transcribe = page.locator('[data-nav="transcribe"]');
  await expect(transcribe).toHaveAttribute("data-nav-pending", "true");
  await expect(transcribe).toHaveAttribute(
    "aria-label",
    "Transcribe: the Transcription Gym opens with U07 · Melody",
  );
  await expect(page.locator('[data-nav="album"]')).not.toHaveAttribute("data-nav-pending", "true");
  await expect(page.locator('[data-nav="album"]')).toHaveAttribute("aria-label", "Album");
  await transcribe.hover();
  await expect(page.getByRole("tooltip")).toContainText("the Transcription Gym opens with U07 · Melody");
  await shoot(page, SHOTS, "w4-nav-pending", "paper");
  // Never gated: G R goes there.
  await page.locator("#main").focus();
  await page.keyboard.press("g");
  await page.keyboard.press("r");
  await expect(page).toHaveURL(/\/transcribe$/);
  await expect(transcribe).toHaveAttribute("aria-current", "page");

  // Once tb.feature.transcribe is granted (U07.L01) the mark goes.
  await page.route("**/api/unlocks", async (route) => {
    try {
      const res = await route.fetch();
      const body = (await res.json()) as { items: { itemId: string }[] };
      const first = body.items[0];
      body.items.push({ ...first, itemId: "tb.feature.transcribe" } as { itemId: string });
      await route.fulfill({ response: res, json: body });
    } catch {
      // A request the navigation below aborted.
    }
  });
  await page.goto("/progress");
  await expect(page.locator('[data-nav="transcribe"]')).toHaveAttribute("aria-label", "Transcribe");
  await expect(page.locator('[data-nav="transcribe"]')).not.toHaveAttribute("data-nav-pending", "true");
});

test("before the first capstone the album says when its first track arrives", async ({ page }) => {
  await seed(page, "onboarded");
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await page.goto("/progress");
  const album = page.locator('[data-nav="album"]');
  await expect(album).toHaveAttribute("data-nav-pending", "true");
  await expect(album).toHaveAttribute(
    "aria-label",
    "Album: your first track arrives with your first capstone",
  );
  await album.focus();
  await shoot(page, SHOTS, "w4-nav-pending", "bark");
  await album.click();
  await expect(page).toHaveURL(/\/album$/);
});

test("the shortcut sheet lists Transcribe and the harmony answers from any page", async ({ page }) => {
  await seed(page, "after U04.CP");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/settings/keys");
  await page.locator("#main").focus();
  await page.keyboard.press("?");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet).toBeVisible();
  const tr = sheet.locator('[data-sheet-section="transcribe"]');
  for (const t of ["Set the loop start (A) at the playhead", "Slower by 5%", "Fine-tune up 5 cents"])
    await expect(tr).toContainText(t);
  const harmony = sheet.locator('[data-sheet-section="harmony"]');
  await expect(harmony).toContainText("Numerals: next inversion");
  await expect(harmony).toContainText("Quality pad: pick a quality");
  // Rows listing several keys read as keys, not as a sequence ("A then B …").
  const texts = await sheet.locator("kbd").allTextContents();
  expect(texts.filter((t) => / then .* then /.test(t))).toEqual([]);
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    await tr.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/w4-shortcuts-${m.theme}-${m.width}x${m.height}.png` });
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

// --- Settings › Data -----------------------------------------------------------------------------

test("Settings › Data lists the learner's own recordings with sizes; deleting asks first", async ({
  page,
}) => {
  await seed(page, "after U04.CP");
  const a = await upload(page, "porch.wav", wav(1, 220));
  const b = await upload(page, "memo.wav", wav(0.5, 330));
  await project(page, "Porch Light", a);
  await project(page, "Porch Light, second pass", a);
  await project(page, "Voice memo", b);
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/settings/data");

  const list = page.getByRole("list", { name: "Recordings" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId("own-audio-total")).toHaveText("2 recordings, 24 KB");
  await expect(list.getByRole("listitem").filter({ hasText: "Voice memo" })).toContainText("7.9 KB");
  await expect(list.getByRole("listitem").filter({ hasText: "second pass" })).toContainText(
    "also in 1 other project",
  );
  // A backup includes them: the export with audio is at least that much bigger, and the help says so.
  const info = await api<{ bytesWithAudio: number; bytesWithoutAudio: number }>(page, "GET", "/backup");
  expect(info.bytesWithAudio - info.bytesWithoutAudio).toBeGreaterThanOrEqual(16_044 + 8_044);
  await expect(page.getByText("Your own recordings are 24 KB of that.")).toBeVisible();
  await expect(page.getByText("A backup includes it.")).toBeVisible();
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    await shoot(page, SHOTS, "w4-data", m.theme);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // W7 gate: "Export backup" saves a file through the UI. A plain link is a navigation without X-Oak, which the
  // server answers with 403; the button fetches with the header and hands the browser a Blob.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export backup" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.oakbackup$|\.zip$/);
  const saved = await download.path();
  expect(saved).toBeTruthy();
  await expect(page.getByText("Backup saved")).toBeVisible();

  // Cancelling the confirm deletes nothing.
  const questions: string[] = [];
  page.once("dialog", (d) => {
    questions.push(d.message());
    void d.dismiss();
  });
  await list.getByRole("button", { name: "Delete “Voice memo”…" }).click();
  await expect.poll(() => questions.length).toBe(1);
  expect(questions[0]).toBe(
    "Delete the transcription “Voice memo” and its recording (7.9 KB)? Its code versions and notes go too. This cannot be undone; a backup you exported earlier still has it.",
  );
  await expect(list.getByRole("listitem")).toHaveCount(3);

  // Accepting deletes the project and its recording (no other project uses it).
  page.once("dialog", (d) => void d.accept());
  await list.getByRole("button", { name: "Delete “Voice memo”…" }).focus();
  await page.keyboard.press("Enter");
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByTestId("own-audio-total")).toHaveText("1 recording, 16 KB");
  expect(await audioStatus(page, b)).toBe(404);

  // A shared recording stays when one of its projects goes.
  page.once("dialog", (d) => {
    questions.push(d.message());
    void d.accept();
  });
  await list.getByRole("button", { name: "Delete “Porch Light”…" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  expect(questions.at(-1)).toContain("the recording stays, because another project uses it");
  expect(await audioStatus(page, a)).toBe(206);
});

test("Settings › Data without recordings points to Transcribe", async ({ page }) => {
  await seed(page, "after U04.CP");
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await page.goto("/settings/data");
  await expect(page.getByTestId("own-audio-empty")).toContainText("No recordings yet");
  await page.getByRole("link", { name: "Open Transcribe" }).click();
  await expect(page).toHaveURL(/\/transcribe$/);
});
