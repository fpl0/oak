// Wave 7 journeys (b), (c: RC2), (d: AC1), (e), (f) and (g): the track checkpoint and the track capstones as daily
// sessions on the real stack (real server, real content, the scripted fake tutor, Chrome's fake microphone), ONE
// session per test, each from the dev seed of its own day (wave7.md §6): Today names the session, Start, the
// warm-up reported skipped, the work inside the session, the Coda (its next line the planner's own), "Done for
// today". The pieces are the capstone suite's (app/src/capstone/e2e/w7-pieces.ts, graded against the briefs with the
// real grader in app/src/capstone/wave7.test.ts); what each checklist row and card says is that suite's
// (w7-capstones.pw.ts); here the days are walked.
//   (b) "J.CP1 due": the first jazz checkpoint as a session, to a pass; it opens JC1. "JC1 open" (S1) and
//       "after JC1.S1" (S2: the brief met, released to Side B with a seeded take).
//   (c) "RC2 open" (S1, the son clave over eight bars) and "after RC2.S1" (S2, released). The rhythm day with the
//       two-hand tap is w7-days.pw.ts (c).
//   (d) "AC1.S2 done": AC1.S3, version one released to the album, then version two added to the same track.
//   (e) "after JC4.S1": JC4.S2, the reharmonisation of Georgia on My Mind with the melody locked: typing in it
//       changes nothing; three devices of the learner's own.
//   (f) "JC1 released": the album's Side B, the track's Export: a WAV rendered offline (two bars: wave7.md §7.3).
//   (g) "after AC2.S2": AC2.S3, the last session of the course: released; the Coda of the whole course; the album
//       with both sides; the illustrated Oak fully grown; Today the day after.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { AC2_BALLAD, JC1_BALLAD, RC2_CLAVE } from "../../app/src/capstone/e2e/w7-pieces.ts";
import { georgiaReharm } from "../../app/src/capstone/e2e/w7-support.ts";
import { fakeMic } from "../../app/src/onboarding/e2e/helpers.ts";
import { walkCheckpoint } from "./checkpoint-walk.ts";
import { coda } from "./day.ts";
import { advanceDays, api, expectClean, resetClock, shootAll } from "./support.ts";
import { doneForToday, setCapstoneCode, skipWarmup, today } from "./w4-day.ts";
import {
  begin,
  capstoneDay,
  checkAllMet,
  finishSession,
  intoWorkspace,
  nextLineIs,
  onAlbum,
  releaseToCoda,
  statuses,
} from "./w7-support.ts";

test.use({ launchOptions: { args: fakeMic("voice.wav") }, permissions: ["microphone"] });
test.describe.configure({ mode: "serial" });

// --- (b) J.CP1, then JC1 ii–V Ballad over two days ------------------------------------------------------------

test("(b) J.CP1 as a day: the first jazz checkpoint passed; it opens JC1, which the Coda names for next time", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const w = await begin(page, request, "J.CP1 due");
  await today(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "checkpoint");
  await page.getByTestId("start-session").click();
  await page.waitForURL(/\/session\/?$/);
  await skipWarmup(page);
  const { passed } = await walkCheckpoint(page);
  expect(passed, "J.CP1 passed").toBe(true);
  const result = page.getByTestId("checkpoint-result");
  // A track checkpoint gates only its track's capstones: it names what it opened, by title, never by ID.
  await expect(result).toContainText("ii–V Ballad");
  await expect(result).not.toContainText(/\bJC1\b|\bfam\.|\btb\./);
  await page.getByTestId("checkpoint-done").click();
  await coda(page, { unlocks: "auto", inspect: () => nextLineIs(page, "JC1.S1", "J") });
  // JC1 is open: its first session can start.
  expect((await statuses(request, "JC1"))[0]).toBe("open");
  expectClean(w);
});

test("(b) JC1 session 1 as a day: ii–Vs into three keys; the session finished", async ({ page, request }) => {
  test.setTimeout(90_000);
  const w = await begin(page, request, "JC1 open", "bark");
  await capstoneDay(page, /ii–V Ballad · session 1 of 2/, "JC1.S1");
  await intoWorkspace(page, 1, 2);
  await setCapstoneCode(page, "JC1", JC1_BALLAD);
  await finishSession(page, () => nextLineIs(page, "JC1.S2", "J"));
  expect(await statuses(request, "JC1")).toEqual(["done", "open"]);
  expectClean(w);
});

test("(b) JC1 session 2 as a day: the brief met, released to Side B", async ({ page, request }) => {
  test.setTimeout(90_000);
  const w = await begin(page, request, "after JC1.S1");
  await capstoneDay(page, /ii–V Ballad · session 2 of 2/, "JC1.S2");
  await intoWorkspace(page, 2, 2);
  await setCapstoneCode(page, "JC1", JC1_BALLAD);
  await checkAllMet(page);
  await releaseToCoda(page, "Three Keys", "Two–fives into C, E♭ and A minor, the guide tones on top.");
  await expect(page.getByTestId("coda-release")).toContainText("joins your album");
  await doneForToday(page);
  expect(await statuses(request, "JC1")).toEqual(["done", "done"]);
  expect((await onAlbum(request, "JC1", "Three Keys")).side).toBe("B");
  expectClean(w);
});

// --- (c) RC2 Clave & Polyrhythm over two days -----------------------------------------------------------------

test("(c) RC2 session 1 as a day: the son clave over eight bars; the session finished", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const w = await begin(page, request, "RC2 open");
  await capstoneDay(page, /Clave & Polyrhythm · session 1 of 2/, "RC2.S1");
  await intoWorkspace(page, 1, 2);
  await setCapstoneCode(page, "RC2", RC2_CLAVE);
  await expect(page.getByTestId("clave-card").getByTestId("clave-heard")).toContainText("Son clave 3-2", {
    timeout: 45_000,
  });
  await finishSession(page, () => nextLineIs(page, "RC2.S2", "R"));
  expect(await statuses(request, "RC2")).toEqual(["done", "open"]);
  expectClean(w);
});

test("(c) RC2 session 2 as a day: the brief met, released to Side B", async ({ page, request }) => {
  test.setTimeout(90_000);
  const w = await begin(page, request, "after RC2.S1", "bark");
  await capstoneDay(page, /Clave & Polyrhythm · session 2 of 2/, "RC2.S2");
  await intoWorkspace(page, 2, 2);
  await setCapstoneCode(page, "RC2", RC2_CLAVE);
  await checkAllMet(page);
  await releaseToCoda(page, "Son of Eight", "The clave on the perc, three against two under it.");
  await doneForToday(page);
  expect(await statuses(request, "RC2")).toEqual(["done", "done"]);
  expect((await onAlbum(request, "RC2", "Son of Eight")).side).toBe("B");
  expectClean(w);
});

// --- (d) AC1 One Tune, Two Genres: both versions on the album ---------------------------------------------------

test("(d) AC1 session 3 as a day: both versions meet the brief; one release puts both on the album, the take on version one", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const w = await begin(page, request, "AC1.S2 done");
  await capstoneDay(page, /One Tune, Two Genres · session 3 of 3/, "AC1.S3");
  await intoWorkspace(page, 3, 3);
  await expect(page.getByTestId("versions-bar")).toBeVisible({ timeout: 60_000 });
  // Version two meets the brief on its own tab, then version one, which is released and recorded.
  await page.getByTestId("version-tab-b").click();
  await expect(page.getByTestId("capstone-workspace")).toHaveAttribute("data-version", "b", {
    timeout: 30_000,
  });
  await checkAllMet(page);
  await page.getByTestId("version-tab-a").click();
  await expect(page.getByTestId("capstone-workspace")).toHaveAttribute("data-version", "a", {
    timeout: 30_000,
  });
  await checkAllMet(page);
  await releaseToCoda(
    page,
    "One Tune",
    "The same tune twice: once as it was written, once thirty beats faster.",
  );
  await expect(page.getByTestId("coda-release")).toContainText("joins your album");
  await doneForToday(page);
  const track = await onAlbum(request, "AC1", "One Tune");
  expect(track.side).toBe("B");
  const detail = await api<{
    versions: { version: number; sketchId: string; sketchVersion: number; hasAudio: boolean }[];
  }>(request, "GET", `/api/album/tracks/${track.id}`);
  // One track, two versions: version one first, version two after it; the take is of version one.
  expect(detail.versions.map((v) => v.version)).toEqual([1, 2]);
  const draft = (v?: { sketchId: string; sketchVersion: number }) => `${v?.sketchId} v${v?.sketchVersion}`;
  expect(draft(detail.versions[0])).not.toBe(draft(detail.versions[1]));
  expect(detail.versions[0]?.hasAudio, "the take recorded of version one is version one's").toBe(true);
  expect(await statuses(request, "AC1")).toEqual(["done", "done", "done"]);
  expectClean(w);
});

// --- (e) JC4 Reharmonize a Standard: the melody locked ----------------------------------------------------------

test("(e) JC4 session 2 as a day: Georgia reharmonised with the melody locked, three devices of the learner's own", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const w = await begin(page, request, "after JC4.S1", "bark");
  await capstoneDay(page, /Reharmonize a Standard · session 2 of 3/, "JC4.S2");
  await intoWorkspace(page, 2, 3);
  const card = page.getByTestId("reharm-card");
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card.getByTestId("melody-locked")).toBeVisible();
  // The tune is the song's: typing in its line changes nothing.
  const line = page.locator(".cm-line", { hasText: /^mel(ody)?:/ }).first();
  await expect(line).toBeVisible({ timeout: 30_000 });
  const before = await line.textContent();
  await line.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" x");
  await expect(line).toHaveText(before ?? "");
  await expect(card.getByTestId("melody-touched")).toHaveCount(0);
  // The learner's three devices where the chart has the chords they replace; the tune kept.
  await setCapstoneCode(page, "JC4", await georgiaReharm());
  await expect(card.getByTestId("device-tally")).toContainText(/[34] different devices of 3/, {
    timeout: 45_000,
  });
  await expect(card.getByTestId("melody-touched")).toHaveCount(0);
  await shootAll(page, "w7-journey-jc4-s2");
  await finishSession(page, () => nextLineIs(page, "JC4.S3", "J"));
  expect(await statuses(request, "JC4")).toEqual(["done", "done", "open"]);
  expectClean(w);
});

// --- (f) An album track exported: rendered offline -------------------------------------------------------------

test("(f) the album's Side B: a released track exported as a WAV rendered offline; the release recording kept", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const w = await begin(page, request, "JC1 released");
  // What the version plays, cut to two bars (wave7.md §7.3: Export renders a whole song once, in offline.pw.ts):
  // its first line's tempo and the Band the release stored are kept.
  let served = false;
  await page.route(/\/api\/album\/tracks\/[^/]+\/versions\/\d+\/source$/, async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { code: string };
    const tempo = body.code.split("\n")[0] ?? "setcpm(72/4)";
    served = true;
    await route.fulfill({
      response: res,
      json: { ...body, code: `${tempo}\n\nkeys: note("<[d4,f4,a4,c5] [g3,b3,d4,f4]>").s("rhodes").gain(.5)` },
    });
  });
  await page.goto("/album");
  const sideB = page.locator("section[data-side='B']");
  await expect(sideB).toBeVisible({ timeout: 60_000 });
  const row = sideB.locator("li[data-track]").first();
  await row.getByRole("link").first().click();
  await expect(page.getByTestId("export")).toBeVisible({ timeout: 60_000 });
  const audio = page.getByTestId("track-audio");
  const audioBefore = (await audio.count()) > 0 ? await audio.getAttribute("src") : null;
  const download = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByTestId("export-wav").click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.wav$/);
  const bytes = readFileSync(await file.path());
  expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString()).toBe("WAVE");
  const seconds = bytes.readUInt32LE(40) / (bytes.readUInt32LE(24) * bytes.readUInt16LE(22) * 2);
  // Two bars at 72 BPM are 6.7 s; the tail rings out, at most the renderer's limit.
  expect(seconds).toBeGreaterThan(6.6);
  expect(seconds).toBeLessThan(40);
  let peak = 0;
  for (let i = 44; i + 1 < bytes.length; i += 2)
    peak = Math.max(peak, Math.abs(bytes.readInt16LE(i)) / 32768);
  expect(peak, "the render is heard").toBeGreaterThan(0.02);
  expect(peak, "never clipped").toBeLessThan(1);
  expect(served).toBe(true);
  await expect(page.getByTestId("export-done")).toContainText("The release recording stays as it is.");
  expect((await audio.count()) > 0 ? await audio.getAttribute("src") : null).toBe(audioBefore);
  expectClean(w);
});

// --- (g) The end of the course ----------------------------------------------------------------------------------

test("(g) AC2 session 3, the last session of the course: released; the Coda of the whole course; twenty tracks; the Oak grown; Today the day after", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const w = await begin(page, request, "after AC2.S2");
  await capstoneDay(page, /Neo-Soul Ballad · session 3 of 3/, "AC2.S3");
  await intoWorkspace(page, 3, 3);
  await setCapstoneCode(page, "AC2", AC2_BALLAD);
  await checkAllMet(page);
  await releaseToCoda(page, "Slow Light", "Ninths and elevenths by hand, the snare a breath behind.");
  // The Coda of session 259: what the learner made, both sides, before anything else.
  const finale = page.getByTestId("coda-course-finale");
  await expect(finale).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("course-finale-heading")).toHaveText("You have completed Oak.");
  await expect(page.getByTestId("course-finale-road")).toHaveText(/^Since .+: 270 sessions on \d+ days/, {
    timeout: 30_000,
  });
  await expect(page.getByTestId("course-record-line")).toHaveText(
    "Twenty tracks: 12 on Side A, 8 on Side B.",
  );
  await expect(page.getByTestId("course-side-b").locator("[data-track]")).toHaveCount(8);
  await expect(page.getByTestId("course-tracks").locator("[data-track]")).toHaveCount(3);
  await expect(page.getByTestId("coda-tomorrow")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/countdown|days left|sessions left/i);
  await shootAll(page, "w7-journey-course-coda");
  await doneForToday(page);
  const whole = await api<{
    stage: string;
    sessionsDone: number;
    album: { released: number; total: number };
  }>(request, "GET", "/api/course/whole");
  expect(whole).toMatchObject({ stage: "complete", sessionsDone: 270, album: { released: 20, total: 20 } });
  // The album: both sides as records.
  await page.goto("/album");
  await expect(page.getByTestId("course-complete")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("side-a-record").locator("[data-cover]")).toHaveCount(12);
  await expect(page.getByTestId("side-b-record").locator("[data-cover]")).toHaveCount(8);
  // The illustrated Oak, fully grown: every acorn hung, the whole tree said once.
  await page.goto("/oak");
  await expect(page.getByTestId("oak-canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-acorn]:not([data-acorn="b-side"])')).toHaveCount(20, { timeout: 30_000 });
  await expect(page.getByTestId("oak-no-next")).toHaveText(
    "Every limb and every branch is grown: the core and its three tracks. Reviews keep it green.",
  );
  await shootAll(page, "w7-journey-oak-grown");
  // The day after: an ordinary day, what stays open, one line back to the record.
  await advanceDays(request, 1);
  await today(page);
  await expect(page.getByTestId("course-first-day")).toHaveText(
    "Both sides of the record are complete. Play Side B.",
    { timeout: 20_000 },
  );
  await expect(page.getByTestId("start-session")).toBeVisible();
  await expect(page.getByTestId("open-to-you")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/track you chose|still being written/);
  await shootAll(page, "w7-journey-today-after-course");
  expectClean(w);
  await resetClock(request);
});
