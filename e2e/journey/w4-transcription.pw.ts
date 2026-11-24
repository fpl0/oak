// Wave 4 journeys (d) and (g), the Transcription Gym and Transcribe on the real stack, each from a dev seed:
//   1. "after U07.L03 (gym due)": the fifth core session is a gym slot. Today names GYM.01 (the ladder, level 1,
//      R0); the session starts the gym session on the server and opens its ladder item in place; the groove as
//      heard (written from the stimulus the page receives) is checked: a graded pass, the saved version is the
//      Make, and the Coda names today's ladder work.
//   2. "after U07.L07": the learner's own recording. A WAV is imported into Transcribe (decoded in the page,
//      stored by the local server), its bars set, a bar looped at 0.75× on the time-stretch engine, and A/B
//      switches between the recording and the learner's code without stopping the transport.
import type { NEvent } from "@oak/content-kit";
import { expect, test } from "@playwright/test";
import { makeWav } from "../../app/src/transcribe/e2e/wav.ts";
import { stimulusCode } from "../../app/src/transcribe/stimulus-code.ts";
import { useUiPrefs as setUiPrefs } from "../support/ui.ts";
import { api, expectClean, noHmr, resetClock, seed, shootAll, watch } from "./support.ts";
import { doneForToday, sessionState, skipWarmup, startSession, today } from "./w4-day.ts";

test.describe.configure({ mode: "serial" });

interface Project {
  id: string;
  bpm: number | null;
  gymId?: string | null;
  gradedPass?: boolean;
  stimulus: { events: NEvent[]; bars: number; cps: number } | null;
}
interface GymPlan {
  history: { gymId: string; sessionId: string | null; kind: string; transcriptionId: string | null }[];
  next: { gymId: string } | null;
}

test("a gym day on the ladder: GYM.01 from Today, the item heard and written, a graded pass, the Coda", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  await resetClock(request);
  await seed(request, "after U07.L03 (gym due)");
  await noHmr(page);
  await setUiPrefs(page, { theme: "paper" });
  const w = watch(page);
  const plan = await api<{ kind: string; mapItemId: string }>(request, "GET", "/api/session/today");
  expect(plan).toMatchObject({ kind: "gym", mapItemId: "GYM.01" });
  await today(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-state", "gym");
  await expect(page.getByTestId("gym-explain")).toHaveAttribute("data-kind", "ladder");
  await expect(page.getByTestId("setlist").locator('[data-row="new"]')).toContainText(
    "GYM.01 · Ladder, level 1: drum loops · R0",
  );
  await shootAll(page, "w4-journey-today-gym");
  await startSession(page);
  const sessionId = (await sessionState(page)).session?.id;
  await skipWarmup(page);

  const block = page.getByTestId("gym-block");
  await expect(block).toHaveAttribute("data-gym", "GYM.01", { timeout: 60_000 });
  await expect(block).toHaveAttribute("data-kind", "ladder");
  await expect(page.getByTestId("ladder-panel")).toContainText("Level 1", { timeout: 60_000 });
  const row = (await api<GymPlan>(request, "GET", "/api/gym")).history.find((g) => g.gymId === "GYM.01");
  expect(row).toMatchObject({ sessionId, kind: "ladder" });
  const projectId = row?.transcriptionId as string;
  const p = await api<Project>(request, "GET", `/api/transcriptions/${projectId}`);
  expect(p.gymId).toBe("GYM.01");
  const st = p.stimulus as NonNullable<Project["stimulus"]>;
  const answer = `setcpm(${Math.round(p.bpm ?? st.cps * 240)}/4)\n\n${stimulusCode(st.events, st.bars).code}\n`;

  // Typed into the editor as the learner would, then checked.
  await expect(page.getByTestId("check")).toBeEnabled({ timeout: 30_000 });
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(answer);
  await page.getByTestId("check").click();
  await expect(page.getByTestId("verdict")).toContainText("That's it", { timeout: 60_000 });
  await expect(page.getByTestId("gym-block-made")).toContainText("1 version saved today", {
    timeout: 30_000,
  });
  await shootAll(page, "w4-journey-gym-pass");
  await page.getByTestId("gym-finish").click();
  await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  const ladder = page.getByTestId("coda-ladder-today");
  await expect(ladder).toHaveAttribute("data-passed", "true", { timeout: 30_000 });
  await expect(ladder).toContainText("Level 1, drum loops, at R0");
  await doneForToday(page);
  expect((await api<Project>(request, "GET", `/api/transcriptions/${projectId}`)).gradedPass).toBe(true);
  expect((await api<GymPlan>(request, "GET", "/api/gym")).next?.gymId ?? "GYM.02").toBe("GYM.02");
  expectClean(w);
});

test("own audio: a WAV imported, its bars set, a bar looped at 0.75× on the stretch engine, A/B with the code", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  await resetClock(request);
  await seed(request, "after U07.L07");
  await noHmr(page);
  await setUiPrefs(page, { theme: "bark" });
  const w = watch(page);
  await page.goto("/transcribe");
  await expect(page.getByRole("heading", { level: 1, name: "Transcribe" })).toBeVisible({ timeout: 60_000 });
  await page
    .getByTestId("import")
    .locator("input[type=file]")
    .setInputFiles({
      name: "groove_take_1.wav",
      mimeType: "audio/wav",
      buffer: makeWav({ bpm: 120, bars: 8, leadInSec: 0.5 }),
    });
  await expect(page).toHaveURL(/\/transcribe\/tr/, { timeout: 30_000 });
  const id = page.url().split("/").pop() as string;
  await expect(page.getByTestId("project-title")).toHaveText("groove take 1");
  await expect(page.getByTestId("transport-play")).toBeEnabled({ timeout: 30_000 });
  // Stored by the local server under its content hash, never sent anywhere else.
  const created = await api<{ sourceKind: string; audioId: string | null }>(
    request,
    "GET",
    `/api/transcriptions/${id}`,
  );
  expect(created).toMatchObject({ sourceKind: "own-audio" });
  expect(created.audioId).toBeTruthy();

  // The bars: 120 BPM, bar 1 half a second in.
  await page.getByTestId("bpm-input").fill("120");
  await expect
    .poll(async () => (await api<{ bpm: number }>(request, "GET", `/api/transcriptions/${id}`)).bpm)
    .toBe(120);
  await page.getByRole("button", { name: "Bar 1 starts here" }).click();
  for (let i = 0; i < 50; i++) await page.getByRole("button", { name: /later by 10 milliseconds/ }).click();
  await expect(page.getByTestId("downbeat")).toHaveText("0:00.5");

  // Keyboard only: 0.75×, a loop on bar 2, play.
  const root = page.getByTestId("transcribe-project");
  await root.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press(",");
  await expect(page.getByTestId("transport-rate")).toContainText("75 %");
  await page.keyboard.press("l");
  await page.keyboard.press("Alt+ArrowRight");
  await expect(page.getByTestId("loop-label")).toHaveText("bar 2");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("transport-play")).toHaveAccessibleName(/Pause/);
  // Slowed down without a pitch change: the time-stretch engine, not the plain element.
  await expect(page.locator("[data-engine]").first()).toHaveAttribute("data-engine", "stretch", {
    timeout: 30_000,
  });
  const pos = async () => {
    const text = (await page.getByTestId("position").textContent()) ?? "";
    const [m, sec] = (text.split(" / ")[0] ?? "0:0").split(":");
    return Number(m) * 60 + Number(sec);
  };
  // Bar 2 at 120 BPM is 2.5 s – 4.5 s of the recording; the playhead stays in it while it loops.
  await page.waitForTimeout(600);
  const times: number[] = [];
  for (let i = 0; i < 12; i++) {
    times.push(await pos());
    await page.waitForTimeout(250);
  }
  for (const t of times) {
    expect(t).toBeGreaterThanOrEqual(2.4);
    expect(t).toBeLessThanOrEqual(4.6);
  }

  // A/B: the learner's code at the same place; a switch never stops or restarts the transport.
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText('setcpm(120/4)\n\nbass: n("<0 3>").scale("A2:major").s("ebass")\n');
  await root.focus();
  await page.keyboard.press("v");
  await expect(page.getByRole("radio", { name: "Mine" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("transport-play")).toHaveAccessibleName(/Pause/);
  await page.keyboard.press("o");
  await expect(page.getByRole("radio", { name: "Both" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("v");
  await expect(page.getByRole("radio", { name: "Source" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("loop-label")).toHaveText("bar 2");
  await expect(page.getByTestId("transport-play")).toHaveAccessibleName(/Pause/);
  await shootAll(page, "w4-journey-own-audio");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("transport-play")).toHaveAccessibleName(/Play/);
  // The player settings are kept with the project.
  await expect
    .poll(
      async () =>
        (await api<{ settings?: { rate: number } }>(request, "GET", `/api/transcriptions/${id}`)).settings
          ?.rate,
    )
    .toBe(0.75);
  await page.getByTestId("save-version").click();
  await expect(page.getByTestId("versions")).toContainText("v1");
  expectClean(w);
});
