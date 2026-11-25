// /progress and the Oak for Wave 6, from dev seeds on the real server (wave6.md §6): after U13.CP the Jazz and
// Rhythm tracks are open branches with their honest note, on Progress, on the Oak's tree and in its course view,
// while the core stays the path; the seventh-chord, rhythm, mode and chromatic strands read well as they light up
// ("what's next" says whether a lesson grows a leaf or deepens one); and once the core is complete Progress keeps
// one line for the day it ended, drawn from graded evidence, and the Oak is at full length. Nothing is filled or
// patched: `CourseProgress.tracks`, `CourseProgress.core`, `GET /course/completion` and the skill map are the
// server's own.
import { expect, type Page, test } from "@playwright/test";
import { shoot, useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { api, blockHmr, expectNoOverflow, matrix, SHOTS, seed, settle } from "./support.ts";
import { watch } from "./w5-helpers.ts";
import { NEVER, verticalOverflow } from "./w6-helpers.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  await blockHmr(page);
});

interface Progress {
  core?: string;
  next: string | null;
  tracks?: { trackId: string; status: string; note: string; next: string | null }[];
}

test("the tracks open on Progress: Jazz and Rhythm as open branches with their next lesson and what their gates hold back; the core stays the path", async ({
  page,
  request,
}) => {
  const errors = watch(page);
  // The day after the U13 checkpoint was passed. Wave 7: J1.L01 and R1.L01 are written, so each branch names its
  // next lesson (`TrackState.next`), and the gates still closed say what they wait for, one line each.
  await seed(request, "after U13.CP");
  const progress = await api<Progress>(request, "GET", "/api/lessons/progress");
  expect(progress.next).toBe("U14.L02");
  const nextOf = { J: "J1.L01 Swing Feel & the Ride", R: "R1.L01 Metric Weight" } as const;
  for (const id of ["J", "R"] as const)
    expect(progress.tracks?.find((x) => x.trackId === id)).toMatchObject({
      status: "open",
      next: nextOf[id].slice(0, 6),
    });
  const open = async (p: Page) => {
    await p.goto("/progress");
    await expect(p.getByTestId("progress-tracks")).toBeVisible({ timeout: 30_000 });
  };
  await useUiPrefs(page, { theme: "paper" });
  await open(page);
  const card = page.getByTestId("progress-tracks");
  for (const id of ["J", "R"] as const) {
    const row = card.locator(`[data-track="${id}"]`);
    await expect(row).toHaveAttribute("data-open", "true");
    await expect(row.getByTestId("track-note")).toHaveText(`Next: ${nextOf[id]}.`);
    await expect(row.getByTestId("track-count")).toHaveText(/^0 of (35|21) sessions$/);
  }
  // J2.L04 is passed over until U14.CP, named as waiting, never as a failure; J4 and J5 say what opens them.
  const waiting = card.locator('[data-track="J"]').getByTestId("track-waiting");
  await expect(waiting).toHaveText([
    "J2.L04 Chord-Scales waits for the U14 checkpoint. The track goes on without it, and it is offered as soon as that is passed.",
    "J4 opens after Hearing Secondaries.",
    "J5 opens after the U17 checkpoint.",
  ]);
  // A capstone says which gate it waits for; a track checkpoint holds back only its capstones.
  await expect(card.locator('[data-capstone="JC1"]').getByTestId("capstone-gate")).toHaveText(
    "Opens after the first jazz checkpoint.",
  );
  await expect(card.locator('[data-capstone="RC1"]').getByTestId("capstone-gate")).toHaveText(
    "Opens after the rhythm checkpoint.",
  );
  await expect(card).toContainText("The core stays your path; a track is never required.");
  await expect(card).not.toContainText(/still being written|remaining|locked|lessons left|behind/i);
  // The course card is still the core's, and the core is in progress: no ending, the pace estimate as before.
  await expect(page.getByTestId("progress-course")).toContainText("sessions on the map");
  await expect(page.getByTestId("progress-ending")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(NEVER);
  await card.scrollIntoViewIfNeeded();
  await settle(page);
  await matrix(page, "w6-progress-tracks", open);
  expect(errors).toEqual([]);
});

test("the tracks open on the Oak: a branch bar with each next lesson, a leaf that says where it grows, the course view's gate lines (keyboard)", async ({
  page,
  request,
}) => {
  const errors = watch(page);
  await seed(request, "after U13.CP");
  const open = async (p: Page) => {
    await p.goto("/oak");
    await expect(p.getByTestId("oak-branches")).toBeVisible({ timeout: 30_000 });
  };
  await useUiPrefs(page, { theme: "bark" });
  await open(page);
  const bar = page.getByTestId("oak-branches");
  await expect(bar.locator("[data-track]")).toHaveCount(2);
  await expect(bar.locator('[data-track="J"]')).toContainText("Jazz Harmony");
  await expect(bar.locator('[data-track="J"]')).toContainText("Next: J1.L01");
  await expect(bar.locator('[data-track="R"]')).toContainText("Advanced Rhythm");
  await expect(bar).not.toContainText("still being written");
  // The core is still what is next: the toolbar names the next core lesson.
  await expect(page.getByTestId("whats-next")).toContainText("U14.L02");
  // The branch bar is one more line: the tree view still fits the window at both sizes.
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await settle(page);
    await expectNoOverflow(page);
    expect(await verticalOverflow(page), `${size.width}×${size.height}`).toBeLessThanOrEqual(1);
    await shoot(page, SHOTS, "w6-oak-branches", "bark");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // Keyboard: the branch's name is a button that goes to its first leaf; Enter opens the leaf.
  const jazz = bar.getByRole("button", { name: "Jazz Harmony" });
  await jazz.focus();
  await page.keyboard.press("Enter");
  const focused = page.locator("[data-node]:focus");
  await expect(focused).toHaveCount(1);
  await page.keyboard.press("Enter");
  const panel = page.getByTestId("oak-panel");
  await expect(panel).toBeVisible();
  // The branch is open and has a next lesson: the panel says where the leaf grows and what the track does next (its
  // own lesson may be later in the track; it is named "still being written" only while its file does not exist).
  // Wave 7: the track's lessons are written, so the leaf names its own lesson, in the track's order.
  await expect(panel.getByTestId("leaf-branch")).toHaveText(
    "Jazz Harmony is open, and this leaf grows with the lesson “Reading 7th-Chord Symbols”. Next: J1.L01 Swing Feel & the Ride.",
  );
  await expect(panel.getByTestId("practise-this")).toHaveCount(0);
  await settle(page);
  await shoot(page, SHOTS, "w6-oak-branch-leaf", "bark");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);

  // The course view: the tracks follow the core under their own header, each branch with its next lesson and the
  // gates it still waits on; the first lesson of each open track is a link, the rest wait in the track's order.
  await page.goto("/oak?view=course");
  const tracks = page.getByTestId("course-tracks");
  await expect(tracks).toBeVisible({ timeout: 30_000 });
  await expect(tracks).toContainText("The core stays your path; a track is never required.");
  const jBranch = page.locator('[data-testid="course-branch"][data-track="J"]');
  await expect(jBranch).toHaveAttribute("data-open", "true");
  await expect(jBranch).toContainText("Next: J1.L01 Swing Feel & the Ride.");
  await expect(jBranch.getByTestId("course-branch-waiting").first()).toHaveText(
    /^J2\.L04 Chord-Scales waits for the U14 checkpoint\./,
  );
  await expect(page.locator('[data-testid="course-branch"]')).toHaveCount(3);
  await expect(page.locator('a[href^="/learn/J1.L01"]')).toHaveCount(1);
  await expect(page.locator('a[href^="/learn/J1.L02"], a[href^="/learn/J4"]')).toHaveCount(0);
  await tracks.scrollIntoViewIfNeeded();
  await settle(page);
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test("the strands light up: sevenths and rhythm grown, modes under way, and 'what's next' says grows or deepens", async ({
  page,
  request,
}) => {
  const errors = watch(page);
  await useUiPrefs(page, { theme: "paper" });
  // After U14.L03 (Dorian): the next lesson, U14.L04, grows a new leaf (Lydian & Phrygian).
  await seed(request, "after U14.L03");
  await page.goto("/oak");
  await expect(page.getByTestId("whats-next")).toContainText("U14.L04", { timeout: 30_000 });
  await expect(page.getByTestId("whats-next")).toContainText("grows 1 leaf");
  const leaf = (id: string) => page.locator(`[data-node="${id}"]`);
  // The seventh-chord and rhythm strands are lit (introduced or better), the mode strand is under way.
  for (const id of ["C07", "C08", "E11", "R09", "R10", "R11", "R12", "S12", "H11"])
    await expect(leaf(id), id).toHaveAttribute("data-status", /introduced|practising|mastered/);
  await expect(leaf("S13")).toHaveAttribute("data-next", "true");
  // What comes later is not marked as next (the seeded learner may already have evidence on it from drills).
  await expect(leaf("H12")).not.toHaveAttribute("data-next", "true");
  await settle(page);
  await expectNoOverflow(page);
  await shoot(page, SHOTS, "w6-oak-modes", "paper");
  // After U16.L03: U16.L04 works on the borrowed-chord leaf that is already there; it "deepens" it.
  await seed(request, "after U16.L03");
  await page.goto("/oak");
  await expect(page.getByTestId("whats-next")).toContainText("U16.L04", { timeout: 30_000 });
  await expect(page.getByTestId("whats-next")).toContainText("deepens 1 leaf");
  for (const id of ["E12a", "H12", "H13"])
    await expect(leaf(id), id).toHaveAttribute("data-status", /introduced|practising|mastered/);
  await expect(leaf("H13")).toHaveAttribute("data-next", "true");
  await expect(leaf("H14")).not.toHaveAttribute("data-next", "true");
  // Keyboard: N goes to what's next; the leaf's panel opens with Enter and says what the skill is.
  await page.locator("main").focus();
  await page.keyboard.press("n");
  await expect(leaf("H13")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("oak-panel")).toContainText("Chords borrowed from the parallel minor key");
  await settle(page);
  await shoot(page, SHOTS, "w6-oak-chromatic", "paper");
  expect(errors).toEqual([]);
});

test("the core complete: Progress keeps one line for the ending, from graded evidence; the Oak's core is at full length", async ({
  page,
  request,
}) => {
  const errors = watch(page);
  await seed(request, "core complete");
  const progress = await api<Progress>(request, "GET", "/api/lessons/progress");
  expect(progress.core).toBe("complete");
  const completion = await api<{ stage: string; completedAt: string | null; canDo: { candoId: string }[] }>(
    request,
    "GET",
    "/api/course/completion",
  );
  expect(completion.stage).toBe("complete");
  const open = async (p: Page) => {
    await p.goto("/progress");
    await expect(p.getByTestId("progress-ending")).toBeVisible({ timeout: 30_000 });
  };
  await useUiPrefs(page, { theme: "paper" });
  await open(page);
  const entry = page.getByTestId("progress-ending");
  await expect(entry.getByRole("heading")).toHaveText("You finished the core. Side A is complete.");
  await expect(entry.getByTestId("progress-ending-date")).toHaveText(/\d{4}/);
  await expect(entry).toContainText(/Since .+: \d+ sessions on \d+ days/);
  await expect(entry.getByRole("link", { name: "Open the ending" })).toHaveAttribute(
    "href",
    /\/session\/coda\?ending=1$/,
  );
  await expect(entry.getByRole("link", { name: "Play Side A" })).toHaveAttribute("href", "/album");
  await expect(entry.getByRole("link", { name: "Open the Oak" })).toHaveAttribute("href", /\/oak/);
  // No pace estimate (there is no map left to estimate) and no "edge of what's written".
  await expect(page.locator("main")).not.toContainText("you'll finish the core around");
  await expect(page.getByTestId("progress-edge")).toHaveCount(0);
  // The can-do ledger: every statement the ending showed is solid or strong here, from graded evidence.
  for (const c of completion.canDo) {
    const row = page.locator(`[data-cando="${c.candoId}"]`).first();
    await expect(row, c.candoId).toContainText(/solid|strong/);
    await expect(row, c.candoId).toContainText("latest from");
  }
  // The milestone itself is on the timeline, reached.
  await expect(page.getByTestId("progress-milestones").locator('[data-milestone="ms.07"]')).toHaveAttribute(
    "data-state",
    "reached",
  );
  await expect(page.getByTestId("progress-tracks")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(NEVER);
  await matrix(page, "w6-progress-ending", open);

  // The Oak: nothing "next" on the core, every core row done, the branches named.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/oak");
  // Wave 7: once a track has lessons, "what's next" names the track's next lesson; with none to start, the core's
  // full length is said in one line. Either way nothing on the core is next.
  const nextBar = page.getByTestId("whats-next").or(page.getByTestId("oak-no-next"));
  await expect(nextBar.first()).toBeVisible({ timeout: 30_000 });
  if (await page.getByTestId("oak-no-next").isVisible())
    await expect(page.getByTestId("oak-no-next")).toHaveText(
      "Every limb of the core is at full length. Reviews keep it green; the tracks are its open branches.",
    );
  else await expect(page.getByTestId("whats-next")).toContainText(/[JRA]\d\.L\d\d/);
  await expect(page.getByTestId("oak-branches")).toBeVisible();
  // No core leaf is still closed: every leaf of U12–U17 is introduced or better.
  for (const id of ["C07", "R10", "S12", "S13", "H12", "H13", "H14", "E13"])
    await expect(page.locator(`[data-node="${id}"]`), id).toHaveAttribute(
      "data-status",
      /introduced|practising|mastered/,
    );
  await settle(page);
  await expectNoOverflow(page);
  expect(await verticalOverflow(page)).toBeLessThanOrEqual(1);
  await shoot(page, SHOTS, "w6-oak-complete", "bark");
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(errors).toEqual([]);
});
