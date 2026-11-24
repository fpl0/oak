// Workbench e2e on its own Vite page (port 5193): real OakStrudel adapter, real browser grader host, real
// abcjs. Proves play → playhead moves → roll and staff light the same events in sync → clicking a staff
// note selects its code range in the editor; plus code → roll links, live mute, the narrow layout and the
// feedback panel (rung 3 ghosts, A/B, issue rows → code).
import { expect, type Page, test } from "@playwright/test";
import { FULL_LOOP } from "../examples.ts";

const WB = "[data-testid=workbench]";

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForSelector(`${WB}[data-analysis=ready]`, { timeout: 45_000 });
}

function snapshot(page: Page) {
  return page.evaluate(() => {
    const ids = (s: string | null | undefined) => (s ? s.split(" ").filter(Boolean) : []);
    const roll = document.querySelector("[data-testid=piano-roll]");
    const staff = document.querySelector(".oak-staff-host");
    return {
      playhead: Number(
        document.querySelector("[data-testid=roll-canvas]")?.getAttribute("data-playhead") || "NaN",
      ),
      roll: ids(roll?.getAttribute("data-active")),
      staff: ids(staff?.getAttribute("data-active-events")),
      litStaff: [...document.querySelectorAll(".oak-staff-host .oak-playing")].map(
        (e) => e.getAttribute("data-oak-events") ?? "",
      ),
      counter: document.querySelector("[data-testid=bar-counter]")?.textContent ?? "",
    };
  });
}

test("the 4-track loop is analysed without playing: roll, staff, tempo and track chips", async ({ page }) => {
  await open(page);
  await expect(page.locator("[data-testid=staff-view]")).toHaveAttribute("data-status", "ready");
  const notes = Number(await page.locator("[data-testid=roll-canvas]").getAttribute("data-notes"));
  // 4 bars: drums 16, chords 16, bass 4, melody 4+3+4+1 = 12
  expect(notes).toBe(48);
  await expect(page.locator("[data-testid=tempo]")).toContainText("92 BPM · 4/4");
  for (const t of ["drums", "chords", "bass", "mel"])
    await expect(page.locator(`[data-testid=mute-${t}]`)).toBeVisible();
  await expect(page.locator("[data-testid=roll-stale]")).toBeVisible();
  // the staff labels engraved notes with their spelled pitches
  await expect(page.locator('.oak-staff-host [data-oak-events="mel|1|0/1|62|0"]').first()).toHaveAttribute(
    "aria-label",
    /D4, bar 1, beat 1/,
  );
});

test("play: the playhead moves and the roll and the staff light the same events, in time", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("[data-testid=staff-view]")).toHaveAttribute("data-status", "ready");
  await page.locator("[data-testid=play-toggle]").click();
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 15_000 });
  // A late start is a fact of a busy page (wave5.md §7.1): the samples begin once the first note is lit, not a
  // fixed time after Play (under load the audible cycle was still before bar 1 at the first sample).
  await expect.poll(async () => (await snapshot(page)).roll.length, { timeout: 10_000 }).toBeGreaterThan(0);

  const samples = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(250);
    samples.push(await snapshot(page));
  }
  const heads = samples.map((s) => s.playhead).filter((h) => Number.isFinite(h));
  expect(heads.length).toBeGreaterThanOrEqual(6);
  // the playhead advances (allowing one wrap at the end of the 4-bar loop)
  let forward = 0;
  for (let i = 1; i < heads.length; i++) if ((heads[i] as number) > (heads[i - 1] as number)) forward++;
  expect(forward).toBeGreaterThanOrEqual(heads.length - 2);
  expect(new Set(samples.map((s) => s.counter)).size).toBeGreaterThan(1);

  let melodyInSync = 0;
  for (const s of samples) {
    expect(s.roll.length).toBeGreaterThan(0);
    // every staff-lit event is lit on the roll at the same moment (the staff engraves a subset: no Band)
    for (const id of s.staff) expect(s.roll).toContain(id);
    // what the staff marks .oak-playing is exactly those events
    for (const ev of s.litStaff) for (const id of ev.split(" ")) expect(s.staff).toContain(id);
    const mel = s.roll.filter((id) => id.startsWith("mel|"));
    if (mel.length > 0 && mel.every((id) => s.staff.includes(id))) melodyInSync++;
    // the lit melody note is the one under the playhead: onset ≤ playhead < next bar
    for (const id of mel) {
      const [, bar, onset] = id.split("|");
      const [n, d] = (onset as string).split("/").map(Number);
      const at = (n as number) / (d as number);
      expect(Number(bar)).toBe(Math.floor(at) + 1);
      expect(at).toBeLessThanOrEqual(s.playhead + 0.1);
    }
  }
  expect(melodyInSync).toBeGreaterThanOrEqual(4);

  await page.locator("[data-testid=play-toggle]").click();
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "0");
  await expect.poll(async () => (await snapshot(page)).roll.length).toBe(0);
});

test("clicking a staff note selects its events on the roll and its code range in the editor", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("[data-testid=staff-view]")).toHaveAttribute("data-status", "ready");
  // bar 1, beat 2 of the melody: n 3 in C4 major = F4
  const note = page.locator('.oak-staff-host [data-oak-events="mel|1|1/4|65|0"]').first();
  await expect(note).toHaveAttribute("aria-label", /F4, bar 1, beat 2/);
  const box = await note.boundingBox();
  if (!box) throw new Error("note not laid out");
  // abcjs hit-tests on its own svg: click the notehead area
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 4);
  await expect(page.locator("[data-testid=piano-roll]")).toHaveAttribute("data-selected", "mel|1|1/4|65|0");
  const sel = await page.locator(WB).getAttribute("data-editor-selection");
  const [range, text] = (sel ?? "").split(":");
  expect(text).toBe("3");
  // the selected "3" is the second step of the first <…> group of the melody: "<[1 3 5 3]"
  expect(range).toBe(`${FULL_LOOP.indexOf("<[1 3") + 4}-${FULL_LOOP.indexOf("<[1 3") + 5}`);
  await expect(note).toHaveClass(/oak-selected/);
});

test("a caret on the 'sd' atom selects every snare hit on the roll", async ({ page }) => {
  await open(page);
  const rect = await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.querySelector(".cm-content") as Node,
      NodeFilter.SHOW_TEXT,
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.textContent?.indexOf("sd") ?? -1;
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 1);
        const b = r.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }
    }
    return null;
  });
  if (!rect) throw new Error("no sd in the editor");
  await page.mouse.click(rect.x, rect.y);
  await expect
    .poll(async () => (await page.locator("[data-testid=piano-roll]").getAttribute("data-selected")) ?? "")
    .toBe(["drums|1|1/2|sd|0", "drums|2|3/2|sd|0", "drums|3|5/2|sd|0", "drums|4|7/2|sd|0"].join(" "));
});

test("mute and solo are live and never touch the code", async ({ page }) => {
  await open(page);
  const before = await page.locator(".cm-content").textContent();
  await page.locator("[data-testid=mute-drums]").click();
  await expect(page.locator(".oak-track-chip[data-track=drums]")).toHaveAttribute("data-state", "muted");
  await page.locator("[data-testid=solo-mel]").click();
  await expect(page.locator(".oak-track-chip[data-track=mel]")).toHaveAttribute("data-state", "solo");
  await expect(page.locator(".oak-track-chip[data-track=bass]")).toHaveAttribute("data-state", "silenced");
  expect(await page.locator(".cm-content").textContent()).toBe(before);
});

test("track chips say what they do and for which part; muted and solo-silenced look different", async ({
  page,
}) => {
  await open(page);
  // Each half has a name that is a phrase, never a bare "S" or a raw track id.
  await expect(page.getByRole("button", { name: "Mute Drums", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Solo Drums", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "S", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Mute Drums", exact: true }).click();
  await expect(page.locator("[data-testid=mute-drums]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-testid=mute-drums] [data-testid=chip-muted-mark]")).toHaveCount(1);
  await page.getByRole("button", { name: "Solo Mel", exact: true }).click();
  await expect(page.locator("[data-testid=mute-bass]")).toHaveAttribute(
    "title",
    /silent while another part is soloed/,
  );
  // Silenced by the solo: no muted mark and no line through it (only the part the learner muted has those).
  await expect(page.locator("[data-testid=mute-bass] [data-testid=chip-muted-mark]")).toHaveCount(0);
  const deco = (id: string) =>
    page.locator(`[data-testid=${id}]`).evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(await deco("mute-bass")).toBe("none");
  // Every chip half is a 24px target at the least.
  const box = await page.locator("[data-testid=solo-drums]").boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
});

test("the loop region shows on the roll and the staff; the badge clears when the loop is the first play", async ({
  page,
}) => {
  await open(page);
  const canvas = page.locator("[data-testid=roll-canvas]");
  await expect(canvas).not.toHaveAttribute("data-loop", /./);
  await page.locator("[data-testid=loop-toggle]").click();
  await expect(canvas).toHaveAttribute("data-loop", "0:2");
  await expect(page.getByTestId("staff-loop")).toHaveText("looping bars 1–2");
  await page.getByRole("button", { name: "Move the loop one bar later" }).click();
  await expect(canvas).toHaveAttribute("data-loop", "1:2");
  await expect(page.getByTestId("staff-loop")).toHaveText("looping bars 2–3");
  // A fresh page whose first play is the loop: the roll must not say "not playing" while it plays.
  await page.locator("[data-testid=play-toggle]").click();
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 15_000 });
  await expect(page.locator("[data-testid=roll-stale]")).toHaveCount(0, { timeout: 5_000 });
  await page.locator("[data-testid=play-toggle]").click();
  await page.locator("[data-testid=loop-toggle]").click();
  await expect(canvas).not.toHaveAttribute("data-loop", /./);
  await expect(page.getByTestId("staff-loop")).toHaveCount(0);
});

test("roll hover shows note name, degree and solfege", async ({ page }) => {
  await open(page, "?example=degrees-d");
  const canvas = page.locator("[data-testid=roll-canvas]");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas");
  // find the first note by scanning across the first eighth of the bar
  let text = "";
  for (let y = 0; y < box.height && !text; y += 3) {
    await page.mouse.move(box.x + 44 + 10, box.y + y);
    text = await page.evaluate(() => document.querySelector("[data-testid=roll-tooltip]")?.textContent ?? "");
  }
  expect(text).toBe("D4 · degree 1 · do · mel · bar 1, beat 1");
});

test("under 760 px the roll and the staff become tabs", async ({ page }) => {
  await open(page, "?narrow=1");
  await expect(page.locator("[data-testid=tab-roll]")).toBeVisible();
  await expect(page.locator("[data-testid=piano-roll]")).toBeVisible();
  await expect(page.locator("[data-testid=staff-view]")).toHaveCount(0);
  await page.locator("[data-testid=tab-staff]").click();
  await expect(page.locator("[data-testid=staff-view]")).toBeVisible();
});

test("feedback at rung 3: where, fix, ghost note, A/B, and the issue row selects the code", async ({
  page,
}) => {
  await open(page, "?example=degrees-d&feedback=1&rung=3");
  const panel = page.locator("[data-testid=feedback-panel]");
  await expect(panel).toHaveAttribute("data-status", "fail", { timeout: 30_000 });
  await expect(page.locator("[data-testid=feedback-summary]")).toHaveText("1 note differs: bar 1.");
  const row = page.locator("[data-testid=issue-row]").first();
  await expect(row).toContainText("mel, Bar 1, beat 4");
  // rung 3 releases the fix for the first issue: the learner has degree 1 (D5) where the tune has 3 (F♯4)
  await expect(row).toContainText("you have 1 (do); the melody has 3 (mi)");
  await expect(page.locator("[data-testid=ghost-note-count]")).toHaveText(
    "1 target note shown dashed on the roll",
  );
  await expect(page.locator("[data-testid=ab-a]")).toBeVisible();
  await expect(page.locator("[data-testid=ab-b]")).toBeVisible();
  await row.click();
  await expect(page.locator(WB)).toHaveAttribute("data-editor-selection", /:7$/);
  await expect(page.locator("[data-testid=piano-roll]")).toHaveAttribute("data-selected", "mel|1|3/4|74|0");
  // the hint button climbs the ladder
  await page.locator("[data-testid=hint-button]").click();
  await expect(panel).toHaveAttribute("data-rung", "4");
});

test("A/B: B plays the target as hidden code, A switches back to the editor", async ({ page }) => {
  await open(page, "?example=degrees-d&feedback=1&rung=2");
  await page.locator("[data-testid=ab-b]").click();
  await expect(page.locator("[data-testid=ab-now]")).toContainText("B · target", { timeout: 15_000 });
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "0");
  await page.locator("[data-testid=ab-a]").click();
  await expect(page.locator("[data-testid=ab-now]")).toContainText("A · yours", { timeout: 15_000 });
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1");
});

test("Band layer: hidden backing tracks are analysed, drawn and mutable, never in the editor", async ({
  page,
}) => {
  await open(page, "?example=degrees-d");
  const before = await page.locator(".cm-content").textContent();
  const notes = Number(await page.locator("[data-testid=roll-canvas]").getAttribute("data-notes"));
  await page.locator("[data-testid=band-toggle]").check();
  await expect(page.locator("[data-testid='mute-band.drums']")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-testid='mute-band.bass']")).toBeVisible();
  // Accompaniment Oak plays says so on its chip.
  await expect(page.locator("[data-testid='mute-band.drums']")).toHaveText("Drums (Oak)");
  await expect
    .poll(async () => Number(await page.locator("[data-testid=roll-canvas]").getAttribute("data-notes")))
    .toBeGreaterThan(notes);
  await page.locator("[data-testid='mute-band.drums']").click();
  await expect(page.locator(".oak-track-chip[data-track='band.drums']")).toHaveAttribute(
    "data-state",
    "muted",
  );
  expect(await page.locator(".cm-content").textContent()).toBe(before);
});

test("early units show at most two of roll, staff and keyboard", async ({ page }) => {
  await open(page);
  await expect(page.locator("[data-testid=keyboard]")).toBeVisible();
  await page.getByLabel("early unit").check();
  await expect(page.locator("[data-testid=keyboard]")).toHaveCount(0);
  await expect(page.locator("[data-testid=piano-roll]")).toBeVisible();
  await expect(page.locator("[data-testid=staff-view]")).toBeVisible();
});
