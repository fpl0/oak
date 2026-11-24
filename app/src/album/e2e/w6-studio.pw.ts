// The Wave 6 studio review as the learner (review:studio), on the real stack from seeds (fake tutor, fake mic):
// - a take ends where the song ends: the tail after the last bar rings out and fades; it used to start the song over
//   for a second and a half and stop dead at a tenth of full scale, on every album track (real time, once);
// - CF-A's Master step: the shipped single reads "touching", not "working" (it was told to turn a well-mixed song
//   down); every gain ×6 is told by how much to come down, every gain ×0.05 that it is quiet and by how much to
//   come up (real-time measurements, three seconds each);
// - the finished album from "core complete": twelve distinct covers, Side A moves on after its 1.5-s breath and never
//   later, and the archive holds every recording byte for byte in running order;
// - A/B in 12/8 at 0.75×: bar lines within the drift gate over eight bars, the beats in four (real time, once);
// - CF-T on Bye Bye Blackbird and Ain't She Sweet: right cuts with wrong names are not yet and give nothing away,
//   the map and the bass pass, and the hidden code reaches neither the DOM, storage, the console, the API nor the
//   tutor; session 2 with the right bass and the wrong changes names bars of each section;
// - C7.S3 with a lift of four bars says so on its row (it was ticked, "3 bars");
// - ladder L8: the standard's code reaches neither the page, the network nor the tutor.
// The verdicts and messages of three honest and three near-miss C6, C7 and CF-A pieces are bun-tested with the real
// grader (app/src/capstone/review-w6.test.ts); the level advice in packages/audio/src/master-meter.test.ts; play-once
// and the take's fade in packages/strudel/src/take.test.ts.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import sweet from "../../../../content/repertoire/aint-she-sweet/song.ts";
import blackbird from "../../../../content/repertoire/bye-bye-blackbird/song.ts";
import fivefoottwo from "../../../../content/repertoire/five-foot-two/song.ts";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { burstOnsets } from "../../../../packages/audio/e2e/onsets.ts";
import { AB_DRIFT_GATE_BARS, AB_DRIFT_GATE_MS } from "../../../../packages/audio/src/stretch.ts";
import { CF_A_SINGLE } from "../../capstone/e2e/w6-pieces.ts";
import { C7_MISS_SHORT_LIFT, C7_POP_E7 } from "../../capstone/review-w6-pieces.ts";
import { makeBarBurstWav } from "../../transcribe/e2e/wav.ts";
import { stack } from "./playwright.config.ts";
import {
  blockHmr,
  ownProject,
  seed,
  setEditorCode,
  startCapture,
  stopCapture,
  watchErrors,
} from "./support.ts";

const HEADERS = { origin: stack.baseURL, "x-oak": "1" };

const SHOTS = new URL("./screenshots", import.meta.url).pathname;

/** Paper and Bark at 1440×900 and 1280×800, then back to Paper at 1440×900. */
async function shots(page: Page, name: string) {
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    await page.waitForTimeout(150);
    await shoot(page, SHOTS, name, m.theme);
  }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "paper";
  });
  await page.setViewportSize({ width: 1440, height: 900 });
}

test.beforeEach(async ({ page }) => {
  await blockHmr(page);
});

const LOOP = '"<[0,2,4] [4,6,8] [5,7,9] [3,5,7] [0,2,4] [4,6,8] [4,6,8] [0,2,4]>"';
const MELODY =
  'melody: n("<[4 4 2 ~] [4 4 1 ~] [5 5 2 ~] [3 3 0 ~] [4 4 2 ~] [4 4 1 ~] [4 4 1 ~] [0@4]>").scale("C4:major").s("piano")';
const C2_RHODES = `setcpm(96/4)\n\nchords: n(${LOOP}).scale("C3:major").s("rhodes")\n${MELODY}`;

/** RMS per 20 ms window of a decoded take, with its sample rate and length. */
async function takeEnvelope(audio: Locator) {
  return audio.evaluate(async (a: HTMLAudioElement) => {
    const bytes = await (await fetch(a.src)).arrayBuffer();
    const buf = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(bytes);
    const x = buf.getChannelData(0);
    const win = Math.round(buf.sampleRate * 0.02);
    const rms: number[] = [];
    for (let s = 0; s + win <= x.length; s += win) {
      let q = 0;
      for (let i = s; i < s + win; i++) q += (x[i] as number) ** 2;
      rms.push(Math.sqrt(q / win));
    }
    let last = 0;
    for (let i = Math.max(0, x.length - 64); i < x.length; i++)
      last = Math.max(last, Math.abs(x[i] as number));
    return { seconds: buf.duration, rms, lastPeak: last };
  });
}

test("a take ends where the song ends: the tail rings out and never starts the song again", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await seed(page, "C2 released");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/capstone/C2");
  await expect(page.getByTestId("capstone-workspace")).toBeVisible({ timeout: 60_000 });
  await setEditorCode(page, "oak_capstone-C2_0_", C2_RHODES);
  await expect(page.getByTestId("req-count")).toHaveText("7 of 7 met", { timeout: 60_000 });
  await page.getByTestId("check-track").click();
  const release = page.getByTestId("release");
  await expect(release).toHaveText(/Release a new version/, { timeout: 30_000 });
  await release.click();
  const dialog = page.getByRole("dialog", { name: "Release a new version" });
  await dialog.getByTestId("record-take").click();
  await expect(dialog.getByTestId("take-audio")).toBeVisible({ timeout: 60_000 });
  const env = await takeEnvelope(dialog.getByTestId("take-audio"));
  // 8 bars at 96 BPM: the song is 20 s from its first note; the tail is what follows.
  const at = (sec: number) => Math.round(sec / 0.02);
  const first = env.rms.findIndex((v) => v > 0.01) * 0.02;
  const end = first + (8 * 4 * 60) / 96;
  const lastBar = Math.max(...env.rms.slice(at(end - 2.5), at(end)));
  const tail = env.rms.slice(at(end + 0.3));
  console.log(
    `[review] take ${env.seconds.toFixed(2)} s, song from ${first.toFixed(2)} s; last bar ${lastBar.toFixed(3)}; tail ${tail
      .filter((_, i) => i % 5 === 0)
      .map((v) => v.toFixed(3))
      .join(" ")}; last samples ${env.lastPeak.toFixed(4)}`,
  );
  // The tail rings out: it never gets louder again (it started the song over: 0.09 after 0.03), and it ends in a
  // fade, not a cut at a tenth of full scale (a click at the end of every album track).
  expect(tail.length).toBeGreaterThan(20);
  expect(Math.max(...tail)).toBeLessThan(lastBar * 0.8);
  for (let i = 5; i < tail.length; i++)
    expect(tail[i] as number).toBeLessThan((tail[i - 5] as number) * 1.15 + 0.004);
  expect(env.lastPeak).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

// --- CF-A's Master step with a clipping single and a whispered one ----------------------------------------

/** The single at a level: every part's gain times `k` (a learner who pushed or pulled every fader). */
const atLevel = (k: number) =>
  CF_A_SINGLE.replace(
    /\.gain\(([\d.]+)\)/g,
    (_, g: string) => `.gain(${Math.round(Number(g) * k * 1000) / 1000})`,
  )
    .replace(/\.s\("ebass"\)/, `.s("ebass").gain(${k})`)
    .replace(/(mel: .*?\.s\("piano"\))/, `$1.gain(${k})`);

async function measureMaster(page: Page) {
  const master = page.getByTestId("master-card");
  await master.getByRole("tab", { name: /The limiter/ }).click();
  await page.getByRole("button", { name: /^Play/ }).first().click();
  await master.getByTestId("master-measure").click();
  await expect(master.getByTestId("master-measure")).toHaveText("Stop measuring", { timeout: 30_000 });
  // A real-time measurement: three seconds of the song through the limiter.
  await page.waitForTimeout(3_000);
  await master.getByTestId("master-measure").click();
  const reading = master.getByTestId("master-reading");
  await expect(reading).toBeVisible({ timeout: 30_000 });
  await page
    .getByRole("button", { name: /^Stop/ })
    .first()
    .click()
    .catch(() => {});
  return { state: await reading.getAttribute("data-limiter"), text: (await reading.innerText()).trim() };
}

test("the Master step: a clipping single is told by how much to come down, a whispered one to come up", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await seed(page, "CF-A.S3 done");
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await page.goto("/capstone/CF-A");
  await expect(page.getByTestId("capstone-workspace")).toBeVisible({ timeout: 60_000 });
  const met = page.getByTestId("req-count");
  // As written: the limiter at most touches, and there is nothing to add.
  await setEditorCode(page, "oak_capstone-CF-A_0_", CF_A_SINGLE);
  await expect(met).toHaveText(/^(\d+) of \1 met$/, { timeout: 60_000 });
  const asWritten = await measureMaster(page);
  console.log(`[review] master as written: ${asWritten.state}: ${asWritten.text}`);
  expect(asWritten.state).toMatch(/resting|touching/);
  expect(asWritten.text).not.toContain("times about");
  // Every fader pushed six times up: the limiter works all the time, and the card says by how much to come down.
  await setEditorCode(page, "oak_capstone-CF-A_0_", atLevel(6));
  await expect(met).toHaveText(/^(\d+) of \1 met$/, { timeout: 60_000 });
  const loud = await measureMaster(page);
  console.log(`[review] master, every gain ×6: ${loud.state}: ${loud.text}`);
  expect(loud.state).toBe("working");
  expect(loud.text).toMatch(/Turn every \.gain\(\) down by the same share\./);
  expect(loud.text).toMatch(
    /Every \.gain\(\) times about 0\.\d+ brings the loudest moment just under the limiter\./,
  );
  await shots(page, "master-clipping");
  // Every fader at a twentieth: the limiter rests, and the card says it is quiet and by how much to come up.
  await setEditorCode(page, "oak_capstone-CF-A_0_", atLevel(0.05));
  await expect(met).toHaveText(/^(\d+) of \1 met$/, { timeout: 60_000 });
  const quiet = await measureMaster(page);
  console.log(`[review] master, every gain ×0.05: ${quiet.state}: ${quiet.text}`);
  expect(quiet.state).toBe("resting");
  expect(quiet.text).toMatch(
    /That is quiet: the loudest moment is \d+ dB under where the limiter starts \(−3\.0 dB\)\. Every \.gain\(\) times about \d+(\.5)? brings it up/,
  );
  expect(errors).toEqual([]);
});

// --- the finished album --------------------------------------------------------------------------------------

/** The entries of a stored (uncompressed) zip: name and bytes, read from the local headers. */
function unzipStored(buf: Buffer): { name: string; data: Buffer }[] {
  const out: { name: string; data: Buffer }[] = [];
  let o = 0;
  while (o + 30 <= buf.length && buf.readUInt32LE(o) === 0x04034b50) {
    const method = buf.readUInt16LE(o + 8);
    const size = buf.readUInt32LE(o + 18);
    const nameLen = buf.readUInt16LE(o + 26);
    const extraLen = buf.readUInt16LE(o + 28);
    expect(method, "a stored entry").toBe(0);
    const name = buf.subarray(o + 30, o + 30 + nameLen).toString("utf8");
    const start = o + 30 + nameLen + extraLen;
    out.push({ name, data: buf.subarray(start, start + size) });
    o = start + size;
  }
  return out;
}

test("the finished album: twelve distinct covers; Side A goes on after a breath and never a longer silence; the archive is every recording, whole", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await seed(page, "core complete");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/album");
  const record = page.getByTestId("side-a-record");
  await expect(page.getByTestId("album-finished")).toBeVisible({ timeout: 60_000 });
  await expect(record.locator("svg[data-cover-rings]")).toHaveCount(12, { timeout: 60_000 });

  // Twelve covers, no two alike: each is drawn from its own music.
  const covers = await record
    .locator("[data-cover] svg[data-cover-rings]")
    .evaluateAll((els) => els.map((e) => e.outerHTML.replace(/\s(id|aria-labelledby)="[^"]*"/g, "")));
  expect(covers).toHaveLength(12);
  expect(new Set(covers).size).toBe(12);

  // Played through: at each track's end the next one sounds after the breath (1.5 s), not later; the record keeps
  // the order. Each track is moved to its last moment, so the whole side takes seconds.
  await page.evaluate(() => {
    const el = document.querySelector<HTMLAudioElement>('[data-testid="side-a-player"]');
    const log: { type: string; t: number; src: string }[] = [];
    (window as unknown as { __sideLog: typeof log }).__sideLog = log;
    for (const type of ["ended", "pause", "playing"])
      el?.addEventListener(type, () => log.push({ type, t: performance.now(), src: el.currentSrc }));
  });
  await record.getByTestId("play-side-a").click();
  for (let no = 1; no <= 12; no++) {
    await expect(record.getByTestId("now-playing")).toHaveText(new RegExp(`^${no} of 12 · `), {
      timeout: 15_000,
    });
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLAudioElement>('[data-testid="side-a-player"]');
      return !!el && Number.isFinite(el.duration) && el.duration > 0 && !el.paused && el.currentTime > 0;
    });
    await page.evaluate(() => {
      const el = document.querySelector<HTMLAudioElement>('[data-testid="side-a-player"]');
      if (el) el.currentTime = Math.max(0, el.duration - 0.25);
    });
  }
  await expect(record).toHaveAttribute("data-state", "stopped", { timeout: 15_000 });
  const log = await page.evaluate(
    () => (window as unknown as { __sideLog: { type: string; t: number; src: string }[] }).__sideLog,
  );
  const starts = log.filter((e) => e.type === "playing");
  const srcs = [...new Set(starts.map((e) => e.src))];
  expect(srcs).toHaveLength(12);
  const gaps: number[] = [];
  for (let i = 1; i < srcs.length; i++) {
    const end = log.filter((e) => e.src === srcs[i - 1] && (e.type === "ended" || e.type === "pause")).at(-1);
    const start = starts.find((e) => e.src === srcs[i]);
    if (end && start) gaps.push(Math.round(start.t - end.t));
  }
  console.log(`[review] Side A, track to track (ms): ${gaps.join(" ")}`);
  expect(gaps).toHaveLength(11);
  for (const g of gaps) {
    expect(g).toBeGreaterThan(1300);
    expect(g).toBeLessThan(2500);
  }

  // Every recording in one archive, byte for byte what the album serves, in running order.
  const album = await page.request.fetch(`${stack.apiURL}/api/album`, { headers: HEADERS });
  const tracks = (
    (await album.json()) as { tracks: { id: string; currentVersion: number; capstoneId: string | null }[] }
  ).tracks;
  const download = page.waitForEvent("download");
  await record.getByTestId("download-side-a").click();
  const file = await download;
  const zip = unzipStored(readFileSync(await file.path()));
  console.log(`[review] archive: ${zip.map((e) => `${e.name} ${e.data.length}`).join(", ")}`);
  expect(zip.map((e) => e.name.slice(0, 3))).toEqual(
    Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, "0")}-`),
  );
  const order = ["C0", "C1", "C2", "X1", "C3", "C4", "C5", "X2", "C6", "C7", "CF-T", "CF-A"];
  for (const [i, cap] of order.entries()) {
    const t = tracks.find((x) => x.capstoneId === cap);
    if (!t) throw new Error(`no ${cap} track`);
    // Fetched as the page fetches it (a media request from another site is refused).
    const served = await page.evaluate(async (url) => {
      const bytes = new Uint8Array(await (await fetch(url, { credentials: "same-origin" })).arrayBuffer());
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      return { length: bytes.length, hash: [...hash].map((x) => x.toString(16).padStart(2, "0")).join("") };
    }, `/api/album/tracks/${t.id}/versions/${t.currentVersion}/audio`);
    const entry = zip[i]?.data ?? Buffer.alloc(0);
    expect(served.length, `${cap}'s recording`).toBeGreaterThan(1000);
    expect(entry.length, `${cap} in the archive`).toBe(served.length);
    expect(createHash("sha256").update(entry).digest("hex"), `${cap} in the archive`).toBe(served.hash);
  }
  expect(errors).toEqual([]);
});

// --- A/B in 12/8 at 0.75× --------------------------------------------------------------------------------------

const BPM_128 = 100; // dotted quarters: a bar of four is 2.4 s, 3.2 s at 0.75×
const LEAD_128 = 0.5;
const RATE_128 = 0.75;
/** A blip on each dotted-quarter beat of a 12/8 bar (the eighths between rest: the onset detector needs quiet). */
const COMPOUND = `setcpm(${BPM_128}/4)\n\nblip: note("e7 ~ ~ e7 ~ ~ e7 ~ ~ e7 ~ ~").s("sine").attack(0).decay(0.03).sustain(0).gain(0.9)\n`;

test(`A/B in 12/8 at ${RATE_128}×: the code's bar lines stay within ${AB_DRIFT_GATE_MS} ms of the recording over ${AB_DRIFT_GATE_BARS} bars, its beats in four`, async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await seed(page, "own-audio project");
  const id = await ownProject(page, makeBarBurstWav({ bpm: BPM_128, bars: 12, leadInSec: LEAD_128 }), {
    bpm: BPM_128,
    meter: "12/8",
    downbeatS: LEAD_128,
    code: COMPOUND,
    settings: { rate: RATE_128 },
  });
  await page.goto(`/transcribe/${id}`);
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 60_000 });
  await page.getByTestId("transcribe-project").focus();
  await page.keyboard.press("o");
  await expect(page.getByRole("radio", { name: "Both" })).toHaveAttribute("aria-checked", "true");
  await startCapture(page, true);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("transport-play")).toHaveAccessibleName(/Pause/);
  const barS = ((60 / BPM_128) * 4) / RATE_128;
  // A real-time measurement: eight bars and a half of both, through the master bus.
  await page.waitForTimeout((AB_DRIFT_GATE_BARS + 1.5) * barS * 1000);
  const c = await stopCapture(page);
  await page.keyboard.press("Space");
  const src = burstOnsets(c.a, c.sr);
  const mine = burstOnsets(c.b, c.sr);
  const beatS = barS / 4;
  const drift = src.flatMap((s) => {
    const near = mine.filter((m) => Math.abs(m - s) < beatS / 3);
    return near.length ? [(near[0] as number) - s] : [];
  });
  console.log(
    `[review] 12/8 A/B drift at ${RATE_128}× (ms): ${drift.map((d) => (d * 1000).toFixed(1)).join(" ")}`,
  );
  expect(drift.length).toBeGreaterThanOrEqual(AB_DRIFT_GATE_BARS);
  for (const d of drift.slice(0, AB_DRIFT_GATE_BARS + 1))
    expect(Math.abs(d * 1000)).toBeLessThan(AB_DRIFT_GATE_MS);
  // The code's beats are the dotted quarters: four even beats a bar (±12 ms), not three or six.
  const gaps = mine.slice(1).map((m, i) => m - (mine[i] as number));
  expect(gaps.length).toBeGreaterThanOrEqual(AB_DRIFT_GATE_BARS * 4 - 1);
  for (const g of gaps.slice(0, AB_DRIFT_GATE_BARS * 4)) expect(Math.abs(g - beatS) * 1000).toBeLessThan(12);
  expect(errors).toEqual([]);
});

// --- CF-T: the other two standards, a wrong map, wrong changes, and the hidden code -----------------------------

interface Standard {
  id: string;
  title: string;
  bpm: number;
  answerKey: {
    bars: number;
    code: string;
    layers: Record<string, string | undefined>;
    sections?: { label: string; bars: [number, number] }[];
  };
}

/** The answer key's own strings (≥ 10 characters inside quotes): none may reach the learner's side. */
function answerFragments(song: Standard) {
  const layers = Object.values(song.answerKey.layers).filter((x): x is string => typeof x === "string");
  return [...layers, song.answerKey.code].flatMap((l) =>
    [...l.matchAll(/"([^"\n]{10,})"/g)].map((m) => m[1] as string),
  );
}

function watchBodies(page: Page) {
  const bodies: { url: string; req: string; res: string }[] = [];
  page.on("requestfinished", async (r) => {
    let res = "";
    try {
      res = (await (await r.response())?.text()) ?? "";
    } catch {
      // a body that is gone (a redirect, a stream)
    }
    bodies.push({ url: r.url(), req: r.postData() ?? "", res });
  });
  const logs: string[] = [];
  page.on("console", (m) => logs.push(m.text()));
  return { bodies, logs };
}

/** The hidden code reaches neither the DOM, storage, the console, an API request or response, nor the tutor. */
async function expectNoLeak(page: Page, w: ReturnType<typeof watchBodies>, fragments: readonly string[]) {
  const html = await page.content();
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  for (const f of fragments) {
    expect(html.includes(f), `DOM holds ${f}`).toBe(false);
    expect(storage.includes(f), `storage holds ${f}`).toBe(false);
    expect(
      w.logs.some((l) => l.includes(f)),
      `console holds ${f}`,
    ).toBe(false);
    for (const b of w.bodies) {
      expect(b.req.includes(f), `request to ${b.url} holds ${f}`).toBe(false);
      expect(b.res.includes(f), `response of ${b.url} holds ${f}`).toBe(false);
    }
  }
}

const cftRows = (page: Page, layer: string) =>
  page.getByTestId("x1-checks").locator(`[data-check^="${layer}-"]`);

async function nameSection(page: Page, i: number, label: string) {
  const s = page.getByTestId("cft-form-map").getByTestId("form-section").nth(i);
  await s.click();
  await page.keyboard.press(label);
  await expect(s).toHaveAttribute("data-label", label);
}

for (const song of [blackbird as Standard, sweet as Standard]) {
  test(`CF-T session 1 on ${song.title}: right cuts with wrong names are not yet and give nothing away; the map and the bass pass; nothing of the hidden code leaks`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    const w = watchBodies(page);
    await seed(page, "CF-T open (U15.L01 done)");
    await useUiPrefs(page, { theme: "paper", motion: "off" });
    await page.goto("/capstone/CF-T");
    await page.getByRole("radiogroup", { name: "The song" }).getByRole("radio", { name: song.title }).click();
    await page.getByRole("button", { name: /^Start session 1 of 4$/ }).click();
    const source = page.getByTestId("song-source");
    await expect(source).toHaveAttribute("data-song", song.id, { timeout: 60_000 });
    const sections = song.answerKey.sections ?? [];
    expect(sections.map((s) => s.label).join("")).toBe("AABA");
    const map = page.getByTestId("cft-form-map");
    await expect(map).toBeVisible({ timeout: 60_000 });
    // The learner listens first.
    const play = source.getByTestId("transport-play");
    await expect(play).toBeEnabled({ timeout: 60_000 });
    await play.click();
    await page.waitForTimeout(1500);
    await play.click();

    // The cuts are right, the names say A B A B: not yet, the bass still waits, and the answer is not given.
    for (const s of sections.slice(1))
      await map.locator(`[data-testid="form-line"][data-bar="${s.bars[0]}"]`).click();
    await expect(map.getByTestId("form-section")).toHaveCount(4);
    for (const [i, l] of ["A", "B", "A", "B"].entries()) await nameSection(page, i, l);
    await map.getByTestId("cft-form-check").click();
    const feedback = map.getByTestId("cft-form-feedback");
    await expect(feedback).toContainText(/not yet/i, { timeout: 30_000 });
    const said = await feedback.innerText();
    console.log(`[review] CF-T ${song.id} ABAB: ${said.replace(/\n/g, " | ")}`);
    expect(said).not.toContain("AABA");
    expect(said).not.toMatch(/\bA A B A\b/);
    await expect(cftRows(page, "bass").first()).toHaveAttribute("data-state", "locked");

    // The song's own names: passed; the draft is written from it and the bass opens.
    for (const [i, s] of sections.entries()) await nameSection(page, i, s.label);
    await map.getByTestId("cft-form-check").click();
    await expect(map.getByTestId("cft-form-state")).toHaveAttribute("data-state", "passed", {
      timeout: 30_000,
    });
    await expect(page.locator(".cm-content").first()).toContainText("bass: arrange(");
    await setEditorCode(
      page,
      "oak_capstone-CF-T_0_",
      `setcpm(${song.bpm}/4)\n\nbass: ${song.answerKey.layers.bass}`,
    );
    const bass = cftRows(page, "bass");
    await expect(bass).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await bass.nth(i).getByTestId("check-phrase").click();
      await expect(bass.nth(i)).toHaveAttribute("data-state", "passed", { timeout: 60_000 });
    }

    // The learner asks the tutor about the bridge: the hidden code is not in what is sent.
    await page
      .getByRole("complementary", { name: /Tutor/ })
      .getByRole("button", { name: "Show tutor" })
      .click();
    const ask = page.getByPlaceholder("Ask about this step, your code, or the music");
    await ask.fill("What happens in the bridge's bass that I should listen for?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect
      .poll(() => w.bodies.some((b) => /\/api\/tutor\//.test(b.url) && b.req.includes("bridge")), {
        timeout: 30_000,
      })
      .toBe(true);
    // The learner's own bass is theirs now; the rest of the answer key stays hidden.
    const mine = [...(song.answerKey.layers.bass ?? "").matchAll(/"([^"\n]{10,})"/g)].map((m) => m[1]);
    const hidden = answerFragments(song).filter((f) => !mine.includes(f));
    expect(hidden.length).toBeGreaterThanOrEqual(2);
    // The song modules themselves are fetched by the page: CF-T grades its phrase checks in the browser (wave4.md
    // §5.1), so the answer key is in the client by design (reported to the gate). Every API exchange is checked.
    w.bodies.splice(0, w.bodies.length, ...w.bodies.filter((x) => /\/api\//.test(x.url)));
    await expectNoLeak(page, w, hidden);
    expect(errors).toEqual([]);
  });
}

test("CF-T session 2: the right bass under the wrong changes; each section's changes are not yet and name their bars", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await seed(page, "C6 open");
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await page.goto("/capstone/CF-T");
  const start = page.getByRole("button", { name: /^(Start|Continue) session \d of 4$/ });
  await expect(start.or(page.getByTestId("capstone-workspace"))).toBeVisible({ timeout: 60_000 });
  if (await start.isVisible()) await start.click();
  const source = page.getByTestId("song-source");
  await expect(source).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-session="CF-T.S2"]')).toHaveAttribute("aria-current", "step");
  const id = await source.getAttribute("data-song");
  const song = [fivefoottwo, blackbird, sweet].find((s) => s.id === id) as Standard | undefined;
  if (!song) throw new Error(`an unknown song ${id}`);
  // The learner's bass is right; the changes are the first bar's chord held all through.
  await setEditorCode(
    page,
    "oak_capstone-CF-T_0_",
    `setcpm(${song.bpm}/4)\n\nbass: ${song.answerKey.layers.bass}\nchords: chord("<C>").voicing()`,
  );
  const changes = cftRows(page, "changes");
  await expect(changes).toHaveCount(4);
  for (const i of [0, 2]) {
    const row = changes.nth(i);
    await row.getByTestId("check-phrase").click();
    await expect(row).toHaveAttribute("data-state", "open", { timeout: 60_000 });
    await expect(row).toContainText(/Best so far \d+ % of \d+ %\./);
    const fb = page.getByTestId("x1-feedback");
    await expect(fb).toBeVisible();
    const said = (await fb.innerText()).replace(/\n/g, " | ");
    console.log(`[review] CF-T ${song.id} changes ${i + 1} with C throughout: ${said}`);
    // It names bars of this section (the grader's lines also name the expected numeral: reported to the gate).
    const [from, to] = song.answerKey.sections?.[i]?.bars ?? [0, 0];
    const bars = [...said.matchAll(/\bbars? (\d+)/gi)].map((m) => Number(m[1]));
    expect(bars.length).toBeGreaterThan(0);
    for (const b of bars) {
      expect(b).toBeGreaterThanOrEqual(from);
      expect(b).toBeLessThanOrEqual(to);
    }
  }
  // The session cannot be finished on wrong changes.
  await expect(page.getByTestId("finish-session")).toBeDisabled();
  expect(errors).toEqual([]);
});

// --- C7: a lift of four bars says so on its row --------------------------------------------------------------

test("C7.S3 with a lift of four bars: the lift row says where it starts, that it lasts four bars, and that eight are asked", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await seed(page, "C7.S2 done");
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await page.goto("/capstone/C7");
  const start = page.getByRole("button", { name: /^(Start|Continue) session \d of 3$/ });
  await expect(start.or(page.getByTestId("capstone-workspace"))).toBeVisible({ timeout: 60_000 });
  if (await start.isVisible()) await start.click();
  await expect(page.getByTestId("capstone-workspace")).toBeVisible({ timeout: 60_000 });
  await setEditorCode(page, "oak_capstone-C7_0_", C7_MISS_SHORT_LIFT);
  const lift = page.locator('[data-rule="lift"]');
  await expect(lift).toHaveAttribute("data-state", "open", { timeout: 60_000 });
  const line = lift.getByTestId("row-found").locator("li");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveText(
    /^Bars 29–32\s*C major → D major at bar 29: up a whole step, 4 bars; the new key needs 8 bars or more to the end\.$/,
  );
  await expect(line).toHaveAttribute("data-ok", "false");
  await shots(page, "c7-short-lift");
  // The whole last chorus lifted: met, and its line reads eight bars (its last bar rests).
  await setEditorCode(page, "oak_capstone-C7_0_", C7_POP_E7);
  await expect(lift).toHaveAttribute("data-state", "met", { timeout: 60_000 });
  await expect(lift.getByTestId("row-found").locator("li")).toHaveText(
    /C major → D♭ major at bar 25: up a half step, 8 bars\.$/,
  );
  expect(errors).toEqual([]);
});

// --- ladder L8: the standard's hidden code stays on the server -------------------------------------------------

test("ladder L8: listening, a check and a review request; the standard's code reaches neither the page, the network nor the tutor", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  const w = watchBodies(page);
  await seed(page, "ladder L8");
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  const songs = await page.request.fetch(`${stack.apiURL}/api/ladder/songs`, { headers: HEADERS });
  const rows = (
    (await songs.json()) as {
      items: { songId: string; level: number; status: string; passedStages: string[] }[];
    }
  ).items;
  const fresh = rows.find((s) => s.level === 8 && s.status === "open" && s.passedStages.length === 0);
  if (!fresh) throw new Error(`no fresh standard: ${JSON.stringify(rows)}`);
  const song = [fivefoottwo, blackbird, sweet].find((s) => s.id === fresh.songId) as Standard | undefined;
  if (!song) throw new Error(`an unknown song ${fresh.songId}`);
  const item = await page.request.fetch(`${stack.apiURL}/api/ladder/items`, {
    method: "POST",
    headers: { ...HEADERS, "content-type": "application/json" },
    data: { sessionId: null, gymId: null, level: 8, songId: song.id },
  });
  expect(item.status()).toBe(200);
  const itemId = ((await item.json()) as { itemId: string }).itemId;
  await page.goto(`/transcribe/${itemId}`);
  await expect(page.getByTestId("standard-panel")).toContainText("Level 8 · A standard", { timeout: 60_000 });
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 60_000 });
  const root = page.getByTestId("transcribe-project");
  await root.focus();
  // Everything, then the bass alone, then without the melody.
  await page.keyboard.press("Space");
  await page.waitForTimeout(1200);
  await page.keyboard.press("Shift+B");
  await page.waitForTimeout(600);
  await page.keyboard.press("Shift+M");
  await page.waitForTimeout(600);
  await page.keyboard.press("Space");
  // A wrong map (two halves) checked.
  const half = Math.floor(song.answerKey.bars / 2) + 1;
  await page.locator(`[data-testid="form-line"][data-bar="${half}"]`).click();
  await page.getByTestId("form-name").nth(0).fill("A");
  await page.getByTestId("form-name").nth(1).fill("B");
  await page.getByTestId("check").click();
  await expect(page.getByTestId("verdict")).toContainText("The form: not yet.", { timeout: 30_000 });
  const review = page.getByTestId("request-transcription-review");
  if ((await review.count()) > 0 && (await review.isEnabled())) {
    await review.click();
    await expect
      .poll(() => w.bodies.some((b) => /\/api\/tutor\//.test(b.url)), { timeout: 30_000 })
      .toBe(true);
  }
  // No song module (an answer key) reaches this page: L8 is graded on the server. The registry is metadata only.
  expect(w.bodies.filter((b) => /content\/repertoire\/.+\/song\.ts/.test(b.url)).map((b) => b.url)).toEqual(
    [],
  );
  await expectNoLeak(page, w, answerFragments(song));
  expect(errors).toEqual([]);
});
