// The step walker of the U03–U04 lesson specs (walk-u03*.pw.ts, walk-u04.pw.ts): a lesson opened from a dev seed
// is played step by step in the real app against the real server, with each step's own authored material. Every
// graded step is answered once with a plausible wrong answer first (the lesson's own failing test, or a wrong
// pick of the drawn trial), and its feedback is read: never empty, no raw IDs (`tb.`, `fam.`, `{param}`), and not
// the answer itself below rung 4. Then the reference (the passing test, or the drawn trial's answer) passes.
// Answers go through the widgets themselves (options, the degree pad, the text field, the key-signature staff
// by keyboard, the Workbench editor through the same CODE event as typing); a sung take is sung through the
// fake microphone when the walk asks for one (`mic`, w3walk.ts TAKES), then the targets
// are submitted through the player's own grading path. Ungraded steps are played (a listen loop, a passive stream, a run) and continued: one listening loop per spec
// file is heard through, every other one is heard playing and moving, then skipped (listening never gates; see
// `playUntilDone`). The Make is solved from its passing test and saved; the lesson must end complete on the server.
import { type Locator, type Page, test as pwTest } from "@playwright/test";
import { expect, setCode, snapshot, stepIs, submit, tryAgainIfShown } from "./support.ts";
import { api } from "./w3support.ts";

/** The lesson file's shape as far as the walker reads it (content-kit types stay out of the e2e project). */
export interface TestCaseLike {
  name: string;
  expect: "pass" | "fail" | "error";
  response: Record<string, unknown>;
  feedback?: string[];
}
export interface PartLike {
  kind: string;
  id: string;
  prompt?: string;
  answer?: {
    ui?: string;
    mode?: string;
    normalize?: string;
    options?: { id: string }[];
    set?: string[];
    allow?: string[];
    multi?: boolean;
    rows?: string[];
  };
  stageAnswers?: Record<string, unknown>;
  stages?: string[];
  stimulus?: { src: string; family?: string };
  correct?: { text?: string[]; choice?: string[]; number?: number; degrees?: string[] };
  reference?: { solutions: string[] };
  code?: { starter?: string };
  questions?: { q: string; options?: { id: string }[]; correct?: unknown }[];
  passive?: unknown;
  rubric?: { id: string; required?: boolean }[];
  byEar?: { parts?: { track: string; label: string }[] };
  mode?: string;
  target?: { from: string; degrees?: string[] };
  tests: TestCaseLike[];
}
interface StepLike {
  id: string;
  kind: string;
  graded?: boolean;
  optional?: boolean;
  /** U05.L08's second chance at the voicing gate: shown only while the gate is unmet. */
  gateCheck?: boolean;
  exercise?: PartLike & { parts?: PartLike[] };
}
export interface LessonLike {
  id: string;
  title: string;
  steps: StepLike[];
}

/** The authored lesson (`content/core/U03/L05/lesson.ts` for `U03.L05`). */
export async function lessonDef(id: string): Promise<LessonLike> {
  const [unit, lesson] = id.split(".") as [string, string];
  const mod = (await import(`../../../../content/core/${unit}/${lesson}/lesson.ts`)) as {
    default: LessonLike;
  };
  return mod.default;
}

type Dev = {
  trial(): Record<string, unknown> | null;
  singTargets(): Record<string, number[]>;
};
const drawnAnswer = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __oakLesson: Dev }).__oakLesson.trial());
/** The drawn trial of each part of an `all` step (`null` for an authored part). */
const drawnAnswers = (page: Page) =>
  page.evaluate(() =>
    (
      globalThis as unknown as { __oakLesson: { trials(): (Record<string, unknown> | null)[] } }
    ).__oakLesson.trials(),
  );
const singTargetsOf = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __oakLesson: Dev }).__oakLesson.singTargets());

const RAW = /\btb\.|\bfam\.|\bcd\.|\bterm\.|[{}]|undefined|NaN|\[object/;

/** Words that, in a below-rung-4 feedback, would hand over the answer. */
function answerLeaks(part: PartLike, trial: Record<string, unknown> | null): string[] {
  const out: string[] = [];
  const text = (trial?.text as string[] | undefined) ?? part.correct?.text;
  if (text && text.length > 1) out.push(text.join(" "), text.join(", "));
  if (part.kind === "staff-write" && part.answer?.mode === "key-signature") {
    const pass = part.tests.find((t) => t.expect === "pass");
    const sig = (pass?.response.answer as { text?: string[] } | undefined)?.text ?? [];
    if (sig.length > 1) {
      out.push(sig.join(" "), sig.join(", "));
      const pretty = sig.map((a) => a.replace("#", "♯").replace(/b$/, "♭"));
      out.push(pretty.join(" "), pretty.join(", "));
    }
  }
  // A code step: a quoted pattern of the reference that the starter does not have.
  const ref = part.reference?.solutions[0] ?? passingCode(part);
  if (ref) {
    const starter = (part.code?.starter ?? "").replace(/[⟪⟫]/g, "");
    // A pattern the prompt itself names (U08.L05 S5: "`.s("fingerbass")` or `.s("sawtooth")`") is the task.
    const prompt = part.prompt ?? "";
    for (const m of ref.matchAll(/"([^"]{6,})"/g)) {
      const q = m[1] as string;
      if (!starter.includes(q) && !prompt.includes(q)) out.push(q);
    }
  }
  return out;
}

function passingCode(part: PartLike): string | null {
  const t = part.tests.find((x) => x.expect === "pass" && typeof x.response.code === "string");
  return (t?.response.code as string | undefined) ?? null;
}

/** The step's verdict box after a wrong answer: there, specific, clean, not the answer. */
export async function expectHonestFeedback(page: Page, leaks: readonly string[], label: string) {
  const fb = page.getByTestId("step-feedback");
  await expect(fb, `${label}: feedback`).toHaveAttribute("data-status", /fail|error/, { timeout: 30_000 });
  const text = ((await fb.textContent()) ?? "").trim();
  expect(text.length, `${label}: feedback text`).toBeGreaterThan(8);
  expect(text, `${label}: no raw IDs or template slots`).not.toMatch(RAW);
  for (const l of leaks) expect(text, `${label}: does not print the answer`).not.toContain(l);
  console.log(`[feedback] ${label}: ${text.replace(/\s+/g, " ")}`);
  return text;
}

/**
 * The verdict is the author's own: the result the player graded and stored carries every feedback code the
 * lesson pins on this mistake (the words themselves wait for the hint ladder, contracts §10.5).
 */
export async function expectPinned(page: Page, wrong: TestCaseLike, label: string) {
  const codes = wrong.feedback ?? [];
  if (codes.length === 0) return;
  await expect
    .poll(
      async () => {
        const snap = (await snapshot(page)) as {
          lastResult?: { diagnostics: { id: string }[] } | null;
        } | null;
        const ids = (snap?.lastResult?.diagnostics ?? []).map((d) => d.id);
        return codes.filter((c) => !ids.includes(c));
      },
      { message: `${label}: the pinned feedback ${codes.join(", ")}`, timeout: 15_000 },
    )
    .toEqual([]);
}

async function expectPass(page: Page, label: string) {
  await expect(page.getByTestId("step-feedback"), `${label}: passes`).toHaveAttribute("data-status", "pass", {
    timeout: 30_000,
  });
}

async function next(page: Page) {
  const c = page.getByTestId("continue");
  await expect(c).toBeEnabled({ timeout: 30_000 });
  await c.click();
}

/**
 * The spec files whose Workbench listening item has been heard through already (one per file: the spec file is
 * `titlePath[0]`, also for the suites registered from w4walk.ts / w5walk.ts / chain.ts).
 */
const heardThrough = new Set<string>();

/** Beats (tempo units) per bar of each meter the Workbench counts in (@oak/theory METERS `unitsPerBar`). */
const UNITS_PER_BAR: Record<string, number> = {
  "4/4": 4,
  "3/4": 3,
  "2/4": 2,
  "6/8": 2,
  "9/8": 3,
  "12/8": 4,
  "5/4": 5,
  "5/8": 5,
  "7/8": 7,
  "9/8i": 9,
};

/** A loop this short (seconds, one pass) is the one a walk suite hears through (WalkOptions.listen "short"). */
const SHORT_LOOP_S = 12;

/** One pass of the playing loop in seconds, from the transport (`1.1 / 4` bars, `84 BPM · 4/4`); null if unread. */
async function loopSeconds(page: Page): Promise<number | null> {
  const bars = /\/ (\d+)$/.exec(((await page.getByTestId("bar-counter").first().textContent()) ?? "").trim());
  const tempo = /([\d.]+) BPM · (\S+)/.exec((await page.getByTestId("tempo").first().textContent()) ?? "");
  const units = tempo ? UNITS_PER_BAR[tempo[2] as string] : undefined;
  if (!bars || !tempo || !units) return null;
  return (Number(bars[1]) * units * 60) / Number(tempo[1]);
}

/**
 * Plays the Workbench of a listening step. One such item per spec file is heard through: the step says the loop
 * has been heard (Continue, no longer Skip). It is the file's first loop; with `listen: "short"` (the walk suites,
 * every lesson but their last) a loop longer than SHORT_LOOP_S is passed over, so a suite hears through its first
 * short loop (most last 10–11 s; some 20–34 s), or its last lesson's first loop when none was short. A long one
 * (U07.L10 S1 plays a hook 16 times, about 37 s) is heard playing and moving through its bars, then skipped, as
 * before; the next one is heard through instead. Every other item is heard playing (Stop pressed, Skip offered from
 * the start: listening never gates) and moving (the bar.beat counter leaves its first reading: a frozen transport
 * fails, a one-bar loop that wraps passes), then stopped and skipped.
 * A run step without questions (`run`, U03.L04 S3) offers Continue from the start: it is heard playing and moving.
 */
async function playUntilDone(
  page: Page,
  label: string,
  kind: "listen" | "run" = "listen",
  listen: "first" | "short" = "first",
) {
  const file = pwTest.info().titlePath[0] ?? pwTest.info().file;
  const toggle = page.getByTestId("play-toggle").first();
  const cont = page.getByTestId("continue");
  const counter = page.getByTestId("bar-counter").first();
  await toggle.click();
  await expect(toggle, `${label}: it plays`).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  // A step of several loops to compare is heard through only once every loop has played through (renderers.tsx
  // `ListenItems`, since d051fe2): its buttons Loop 1, Loop 2… switch the loop and play it at once.
  const loops = page.getByRole("group", { name: "Loops" }).getByRole("button");
  const loopCount = kind === "listen" ? Math.max(1, await loops.count()) : 1;
  let skip = kind === "run" || heardThrough.has(file);
  let why = `heard through earlier in ${file}`;
  if (!skip && listen === "short") {
    // The tempo shows once the code has run (pressing play runs it); unread, the loop is heard through.
    await expect(page.getByTestId("tempo").first())
      .toContainText("BPM", { timeout: 5_000 })
      .catch(() => undefined);
    const one = await loopSeconds(page);
    // All its loops, counted as long as the first: near enough to tell a short step from a long one.
    const s = one === null ? null : one * loopCount;
    if (s !== null && s > SHORT_LOOP_S) {
      skip = true;
      why =
        loopCount > 1
          ? `${loopCount} loops of ${Math.round(s)} s in all: a shorter item of the file is heard through`
          : `a loop of ${Math.round(s)} s: a shorter one of the file is heard through`;
    }
  }
  if (skip) {
    if (kind === "run") await expect(cont, `${label}: a run never gates`).toHaveText(/Continue/);
    else await expect(cont, `${label}: listening never gates (Skip from the start)`).toHaveText(/Skip/);
    const first = ((await counter.textContent()) ?? "").trim();
    expect(first, `${label}: the bar counter`).toMatch(/^\d+\.\d+ \/ \d+$/);
    await expect
      .poll(async () => ((await counter.textContent()) ?? "").trim(), {
        message: `${label}: the transport moves on from ${first}`,
        timeout: 15_000,
      })
      .not.toBe(first);
    if (kind === "listen") console.log(`[listen] ${label}: heard playing and moving, then skipped (${why})`);
    await toggle.click();
    return;
  }
  try {
    for (let n = 1; n < loopCount; n++) {
      await expect(page.getByTestId("listen-progress"), `${label}: loop ${n} heard`).toContainText(
        `${n} of ${loopCount} heard`,
        { timeout: 25_000 },
      );
      await loops.nth(n).click();
    }
    await expect(cont, `${label}: one loop heard`).toHaveText(/Continue/, { timeout: 25_000 });
    heardThrough.add(file);
    console.log(`[listen] ${label}: ${loopCount > 1 ? `all ${loopCount} loops` : "one loop"} heard through`);
  } catch {
    await expect(page.getByTestId("bar-counter").first(), `${label}: the bars move on`).not.toHaveText(
      /^1\./,
    );
    await expect(cont).toHaveText(/Skip/);
    console.log(`[listen] ${label}: a long item, heard playing, then skipped`);
  }
  await toggle.click();
}

const check = (page: Page) => page.getByTestId("check").click();

/** Answers one investigate/run response through the question widgets. */
async function answerQuestions(page: Page, part: PartLike, response: Record<string, unknown>) {
  await tryAgainIfShown(page);
  const qs = part.questions ?? [];
  const parts = Array.isArray(response.parts) ? (response.parts as Record<string, unknown>[]) : null;
  for (const [i, q] of qs.entries()) {
    const r = (parts ? parts[i]?.answer : response.answer) as
      | { choice?: string[]; number?: number; text?: string[] }
      | undefined;
    const box = page.locator(`[data-question="${i + 1}"]`);
    if (q.q === "choice") {
      const ids = new Set((q.options ?? []).map((o) => o.id));
      const pick = (r?.choice ?? []).find((c) => ids.has(c));
      if (pick) await box.locator(`[data-option="${pick}"]`).click();
    } else if (q.q === "number") {
      if (r?.number !== undefined) await box.locator("input").fill(String(r.number));
    } else if (r?.text?.[0] !== undefined) await box.locator("input").fill(r.text.join(" "));
  }
}

/** Types a key signature on the staff by keyboard: `#` or `-` picks sharps or flats, letters place them. */
async function typeKeySignature(page: Page, accidentals: readonly string[]) {
  const surface = page.getByTestId("keysig-surface");
  await surface.focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press("Backspace");
  if (accidentals.length === 0) return;
  await page.keyboard.press(accidentals[0]?.endsWith("b") ? "-" : "#");
  for (const a of accidentals) await page.keyboard.press(`${(a[0] ?? "").toUpperCase()}`);
}

/** Clicks the option with this ID (IDs can be code, with quotes no CSS selector takes). */
export async function clickOption(page: Page, id: string, scope: Locator = page.getByTestId("lesson-step")) {
  const options = scope.locator("[data-option]");
  const ids = await options.evaluateAll((els) => els.map((e) => e.getAttribute("data-option")));
  const at = ids.indexOf(id);
  expect(at, `the option "${id}" is shown`).toBeGreaterThanOrEqual(0);
  await options.nth(at).click();
}

async function pickDegrees(
  page: Page,
  degrees: readonly string[],
  step: Locator = page.getByTestId("lesson-step"),
) {
  // Clear what an earlier attempt left on the pad.
  const pad = step.locator("[data-degree]").first();
  await pad.focus();
  for (let i = 0; i < degrees.length + 2; i++) await page.keyboard.press("Backspace");
  for (const d of degrees) {
    // A chromatic pad offers each pitch once (U15, U17.CP: ♭2 for ♯1, ♭6 for ♯5): the asked spelling's key, else
    // the key of the same pitch, which the player reads as the asked spelling.
    const own = step.locator(`[data-degree="${d}"]`);
    if ((await own.count()) > 0) {
      await own.first().click();
      continue;
    }
    const shown = await step
      .locator("[data-degree]")
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-degree") ?? ""))]);
    const same = shown.find((x) => semisOf(x) === semisOf(d));
    expect(same, `the pad has a key for ${d}`).toBeDefined();
    await step.locator(`[data-degree="${same}"]`).first().click();
  }
}

/** Semitones above home of a degree ("#4" 6, "b6" 8), for a pad that spells a pitch once. */
function semisOf(d: string): number {
  const m = /^([#b]?)(\d+)$/.exec(d);
  if (!m) return Number.NaN;
  const base = [0, 2, 4, 5, 7, 9, 11][(Number(m[2]) - 1) % 7] ?? 0;
  return (base + (m[1] === "#" ? 1 : m[1] === "b" ? -1 : 0) + 12) % 12;
}

/** The fake microphone sings one take (whatever it hears), Check reads it out; then the targets pass. */
async function singStep(page: Page, step: StepLike, o: WalkOptions) {
  const label = `${step.id} sing`;
  const ex = step.exercise as PartLike & { parts?: PartLike[] };
  const parts = ex.kind === "all" ? (ex.parts ?? []) : [ex];
  await expect(page.getByTestId("continue"), `${label}: singing never gates`).toBeEnabled();
  if (o.quiet) {
    // Quiet mode (server state): no mic anywhere, the fallback instead, nothing posted.
    await expect(page.getByRole("button", { name: "Sing", exact: true })).toHaveCount(0);
    if (ex.kind === "sing") {
      await expect(page.getByTestId("quiet-chip")).toBeVisible();
      const identify = page.getByTestId("sing-quiet-identify");
      if ((await identify.count()) > 0) {
        for (const d of ex.target?.degrees ?? []) await identify.locator(`[data-degree="${d}"]`).click();
        await page.getByTestId("quiet-check").click();
        await expect(page.getByTestId("quiet-verdict")).toContainText("That's the pattern");
      } else {
        await page.getByTestId("heard-it").click();
        await expect(page.getByTestId("heard-it-done")).toBeVisible();
      }
    }
    const r = await api<{ attempts: number }>(page, "GET", `/lessons/${o.lessonId}/steps/${step.id}`);
    expect(r.body?.attempts ?? 0, `${label}: nothing recorded in Quiet mode`).toBe(0);
    return;
  }
  if (o.mic) {
    const sing = page.getByRole("button", { name: "Sing", exact: true }).first();
    await sing.click();
    await expect(page.getByTestId("sing-phase").first()).toHaveText(/Done/, { timeout: 60_000 });
    if (ex.kind === "sing") {
      await check(page);
      const fb = page.getByTestId("step-feedback");
      await expect(fb).toHaveAttribute("data-status", /fail|pass|error/, { timeout: 30_000 });
      const text = ((await fb.textContent()) ?? "").trim();
      expect(text.length, `${label}: the take is read back`).toBeGreaterThan(8);
      expect(text, `${label}: no raw IDs`).not.toMatch(RAW);
      console.log(`[take] ${label}: ${text.replace(/\s+/g, " ")}`);
      // A take that missed says where: the first note that went wrong, or why nothing could be heard.
      if ((await fb.getAttribute("data-status")) === "fail")
        expect(text, `${label}: names the note`).toMatch(/Note \d|note \d|Hold each note|noise|voice/);
    }
  }
  // The targets themselves, through the player's own path: in tune passes, a wrong first note does not.
  // Targets read from music (`from: "stimulus"`) are evaluated after the step renders: wait for them.
  await expect
    .poll(
      async () => {
        const t = await singTargetsOf(page);
        return parts.every((p) => (t[p.id] ?? []).length > 0);
      },
      { message: `${label}: the sung targets are read`, timeout: 15_000 },
    )
    .toBe(true);
  const targets = await singTargetsOf(page);
  const sung = (ms: readonly number[]) => ms.map((midi) => ({ midi, cents: 4, credit: 1 }));
  const each = parts.map((p) => targets[p.id] ?? []);
  for (const [i, t] of each.entries())
    expect(t.length, `${label}: part ${i + 1} has targets`).toBeGreaterThan(0);
  // Home right, then every later note a minor third off: a pattern sung wrong, not one slip in five.
  const wrongTake = (t: readonly number[]) => sung(t.map((m, i) => (i === 0 && t.length > 1 ? m : m + 3)));
  const wrong =
    ex.kind === "all"
      ? { parts: each.map((t) => ({ sung: wrongTake(t) })) }
      : { sung: wrongTake(each[0] ?? []) };
  const w = await submit(page, wrong);
  expect(w?.status, `${label}: a pattern sung wrong does not pass`).not.toBe("pass");
  if (ex.kind === "sing") {
    const said = await expectHonestFeedback(page, [], `${label} wrong`);
    // The grader's pattern finding, not a generic line: the first note that is not the pattern's.
    expect(said, `${label}: names the first wrong note`).toMatch(/Note 2/);
  }
  const right =
    ex.kind === "all" ? { parts: each.map((t) => ({ sung: sung(t) })) } : { sung: sung(each[0] ?? []) };
  const r = await submit(page, right);
  expect(r?.status, `${label}: on the targets passes`).toBe("pass");
}

export interface WalkOptions {
  lessonId: string;
  /** The browser has the fake microphone: sung steps take a real take first. */
  mic: boolean;
  /** Quiet mode is on for today: sung steps are their fallbacks. */
  quiet: boolean;
  /**
   * The lesson is played as a preview (nothing saved): the walk ends on the complete screen and the server is
   * not asked. Only while a dev seed the lesson needs is not built yet.
   */
  preview?: boolean;
  /** Walks from this step on (the earlier ones are already done). */
  from?: string;
  /** Stops when this step is on screen, before playing it (the caller plays it its own way). */
  until?: string;
  /** Played inside its own session (started from Today): it ends on the session's Coda, not its own end. */
  inSession?: boolean;
  /**
   * Which listening item of the spec file is heard through (see `playUntilDone`): the first one (default), or the
   * first short one; a walk suite passes "short" for every lesson but its last.
   */
  listen?: "first" | "short";
  /**
   * Each graded step takes the lesson's own pinned mistake first (default). `false` (Wave 7's unit smoke walks,
   * w7walk.ts): every step is opened, played and given its reference only — the mistakes are proven by the full
   * walks and, for every authored test, by wave7-grading.test.ts.
   */
  mistakes?: boolean;
}

/** Answers a single answer-kind part through its widget; `false` when the widget cannot enter this answer. */
export async function answerWidget(
  page: Page,
  part: PartLike,
  response: Record<string, unknown>,
  scope: Locator = page.getByTestId("lesson-step"),
): Promise<boolean> {
  await tryAgainIfShown(page);
  const a = (response.answer ?? {}) as {
    choice?: string[];
    text?: string[];
    number?: number;
    degrees?: string[];
    midi?: number[];
    rn?: string[];
    qualities?: string[];
  };
  const ui = part.answer?.ui;
  const step = scope;
  if (typeof response.staff === "string") {
    // A note list on the staff, through the staff's typed alternative (keyboard and screen-reader users).
    const typed = step.locator('input[aria-label$="(as text)"]').first();
    if ((await typed.count()) === 0 || !(await typed.isVisible()))
      await step.getByText("Type the notes instead").click();
    await typed.fill(response.staff);
    return true;
  }
  if (ui === "keyboard") {
    // Wave 4: a chord built on the keyboard (U05.L01 S5), cleared first.
    for (const m of a.midi ?? []) if ((await step.locator(`[data-midi="${m}"]`).count()) === 0) return false;
    const clear = step.getByRole("button", { name: "Clear", exact: true });
    if ((await clear.count()) > 0 && (await clear.isEnabled())) await clear.click();
    for (const m of a.midi ?? []) await step.locator(`[data-midi="${m}"]`).first().click();
    return true;
  }
  if (ui === "euclid") {
    // Wave 7 (R3.L03 S6): the Steps, Hits and Rotation steppers, set by keyboard (Home, then ArrowUp) in that
    // order, since the hits cannot exceed the steps.
    const [k, n, r] = (response.answer as { euclid?: number[] } | undefined)?.euclid ?? [];
    if (k === undefined || n === undefined) return false;
    const spin = (id: string) => step.locator(`[data-stepper="${id}"] [role="spinbutton"]`).first();
    if ((await spin("n").count()) === 0) return false;
    const setTo = async (id: string, v: number, min: number) => {
      await spin(id).focus();
      await page.keyboard.press("Home");
      for (let i = min; i < v; i++) await page.keyboard.press("ArrowUp");
      await expect(spin(id)).toHaveAttribute("aria-valuenow", String(v));
    };
    await setTo("n", n, 2);
    await setTo("k", k, 1);
    if (r !== undefined && (await spin("r").count()) > 0) await setTo("r", r, 0);
    return true;
  }
  if (ui === "grouping") {
    // Wave 7: the bar cut into groups of 2 and 3, by keyboard (Backspace clears, 2 and 3 add a group).
    const groups = (response.answer as { grouping?: number[] } | undefined)?.grouping ?? [];
    const add = step.locator("[data-add='2']").first();
    if ((await add.count()) === 0) return false;
    await add.focus();
    for (let i = 0; i < 8; i++) await page.keyboard.press("Backspace");
    for (const g of groups) await step.locator(`[data-add='${g}']`).first().click();
    await expect(step.locator("[data-grouping]").first()).toHaveAttribute(
      "data-grouping",
      groups.join(" + "),
    );
    return true;
  }
  if (ui === "rn-palette") return enterNumerals(page, step, a.rn ?? []);
  if (ui === "quality-pad") {
    const q = a.qualities?.[0];
    if (!q || (await step.locator(`[data-quality="${q}"]`).count()) === 0) return false;
    await step.locator(`[data-quality="${q}"]`).first().click();
    return true;
  }
  if (ui === "slot-choice") {
    // One option per slot (U06.L03 S6 the function strip, U06.L04 S5 the cadence per phrase).
    const choice = a.choice ?? [];
    for (const c of choice) if ((await step.locator(`[data-option="${c}"]`).count()) === 0) return false;
    for (const [i, c] of choice.entries()) {
      if (c === "") continue;
      await step.locator(`[data-slot="${i}"]`).first().click();
      await step.locator(`[data-option="${c}"]`).first().click();
    }
    return true;
  }
  if (ui === "form" || ui === "bar-grid" || ui === "scale-builder") return answerWave5(part, response, step);
  if (ui === "grid") {
    // A rhythm grid (fam.rhy.dictation in a checkpoint; U13's 6- and 12-step grids): exactly these cells on. One
    // row answers with step numbers ("0", "4"), several rows with "row:step".
    // A "find the push" trial names its cells `c14`; on the grid that is step 14.
    const want = new Set((a.choice ?? []).map((c) => c.replace(/^c(?=\d+$)/, "")));
    const cells = step.locator("[data-cell]");
    const n = await cells.count();
    if (n === 0) return false;
    const rows = part.answer?.rows ?? [];
    for (let i = 0; i < n; i++) {
      const cell = cells.nth(i);
      const [r, c] = ((await cell.getAttribute("data-cell")) ?? "0:0").split(":") as [string, string];
      const id = rows.length > 1 ? `${rows[Number(r)] ?? r}:${c}` : c;
      const on = (await cell.getAttribute("aria-pressed")) === "true";
      if (on !== want.has(id)) await cell.click();
    }
    return true;
  }
  if (ui === "bar-buttons" && a.choice?.[0] !== undefined) {
    // A drawn "which bar" trial (U15.L06 S2, U17.L03 S4) brings its own bars ("none" too): a choice drawn as the
    // same bar timeline, its options by ID.
    if ((await step.locator(`[data-option="${a.choice[0]}"]`).count()) === 0) return false;
    await clickOption(page, a.choice[0], step);
    return true;
  }
  if (ui === "bar-buttons") {
    // "Which bar?" (U09.L01 S6, U09.L05 S6, U11.L08 S5): the bar's own button.
    if (a.number === undefined) return false;
    const bar = step.getByRole("radio", { name: `Bar ${a.number}`, exact: true });
    if ((await bar.count()) === 0) return false;
    await bar.first().click();
    await expect(bar.first()).toHaveAttribute("aria-checked", "true");
    return true;
  }
  if (ui === "choice" && part.answer?.multi) {
    // Several boxes ticked (U06.L08 S6 "which bars hold two chords"): exactly these, the others cleared.
    const want = new Set(a.choice ?? []);
    const options = step.locator("[data-option]");
    for (let i = 0; i < (await options.count()); i++) {
      const o = options.nth(i);
      const on = (await o.getAttribute("aria-checked")) === "true";
      if (on !== want.has((await o.getAttribute("data-option")) ?? "")) await o.click();
    }
  } else if (ui === "choice") {
    await clickOption(page, a.choice?.[0] as string, step);
  } else if (ui === "number") {
    await step.locator("input").first().fill(String(a.number));
  } else if (ui === "staff-input" && part.answer?.mode === "key-signature") {
    await typeKeySignature(page, a.text ?? []);
  } else if (ui === "degree-pad") {
    await pickDegrees(page, a.degrees ?? [], step);
  } else if (ui === "text") {
    await step
      .locator('input[type="text"]')
      .first()
      .fill((a.text ?? []).join(" "));
  } else throw new Error(`walker: no way to answer ${ui}`);
  return true;
}

/**
 * Wave 5 (wave5.md §11): the form strip (a label per section block), the 12-bar grid (a numeral or a chord per
 * bar) and the scale builder (degrees on the pad, or keys). Each is entered through its widget (the answers
 * engineer's `[data-form-block]` + `[data-form-option]`, `[data-bar]` + `[data-chord]`, `[data-degree]` or
 * `[data-midi]` toggles, 0-based blocks and bars) when the widget offers every value; `false` when it does not
 * (the registry has no widget for the kind yet: the walker then answers through the player's own grading path,
 * see `answerOrSubmit`).
 */
async function answerWave5(
  part: PartLike,
  response: Record<string, unknown>,
  step: Locator,
): Promise<boolean> {
  const a = (response.answer ?? {}) as {
    sections?: string[];
    rn?: string[];
    text?: string[];
    degrees?: string[];
    midi?: number[];
  };
  const ui = part.answer?.ui;
  const has = async (sel: string) => (await step.locator(sel).count()) > 0;
  if (ui === "form") {
    const labels = a.sections ?? [];
    if (!(await has('[data-form-block="0"]'))) return false;
    for (const l of labels) if (!(await has(`[data-form-option="${l}"]`))) return false;
    for (const [i, l] of labels.entries()) {
      await step.locator(`[data-form-block="${i}"]`).first().click();
      await step.locator(`[data-form-option="${l}"]`).first().click();
    }
    return true;
  }
  if (ui === "bar-grid") {
    const values = a.rn ?? a.text ?? [];
    if (!(await has('[data-bar="0"]'))) return false;
    for (const [i, v] of values.entries()) {
      if (v === "") continue;
      const bar = step.locator(`[data-bar="${i}"]`).first();
      // A given bar is printed filled (bar 1's I7) and cannot be changed.
      if ((await bar.getAttribute("data-given")) !== null) continue;
      await bar.click();
      const chord = step.locator(`[data-chord="${v}"]`).first();
      if ((await chord.count()) === 0) {
        // A palette of several qualities (U11.CP: triads and sevenths) offers the key's own first: the quality
        // control turns the buttons into sevenths, as a learner would.
        const qualities = step
          .locator('[aria-label="Quality of the next chord"]')
          .locator('button, [role="radio"]');
        for (let q = 0; q < (await qualities.count()) && (await chord.count()) === 0; q++)
          await qualities.nth(q).click();
      }
      if ((await chord.count()) === 0) return false;
      await chord.click();
    }
    return true;
  }
  // scale-builder: degrees on the pad, or keys on the keyboard, toggled until exactly these are in.
  const attr = a.midi ? "data-midi" : "data-degree";
  const want = new Set((a.midi ?? a.degrees ?? []).map(String));
  for (const v of want) if (!(await has(`[${attr}="${v}"]`))) return false;
  const buttons = step.locator(`[${attr}]`);
  for (let i = 0; i < (await buttons.count()); i++) {
    const b = buttons.nth(i);
    const on = (await b.getAttribute("aria-pressed")) === "true";
    if (on !== want.has((await b.getAttribute(attr)) ?? "")) await b.click();
  }
  return true;
}

/** A Wave 5 answer kind (form, bar-grid, scale-builder) whose widget may not exist yet. */
const WAVE5_UIS = new Set(["form", "bar-grid", "scale-builder"]);

/**
 * Enters a response through its widget, or — for a Wave 5 kind the answers registry does not draw yet, and for a
 * tap step, whose taps need real timing — grades and submits it through the player's own path. Returns the
 * submitted result for the latter (`null` when the widget took it: the caller presses Check).
 */
export async function answerOrSubmit(
  page: Page,
  part: PartLike,
  response: Record<string, unknown>,
  scope: Locator = page.getByTestId("lesson-step"),
): Promise<"widget" | "submitted" | "none"> {
  await tryAgainIfShown(page);
  if (part.kind !== "tap" && (await answerWidget(page, part, response, scope))) return "widget";
  if (part.kind === "tap" || WAVE5_UIS.has(part.answer?.ui ?? "")) {
    await submit(page, response);
    return "submitted";
  }
  return "none";
}

/**
 * Numerals into the RN palette, one per slot: a numeral the palette offers is clicked; an inverted one (`V6`,
 * `I64`) is its root-position button, then the slot's `I` key steps the figure. `false` when a numeral cannot be
 * entered at all (a case the palette does not offer, such as `VI` in a major key).
 */
export async function enterNumerals(page: Page, step: Locator, rns: readonly string[]): Promise<boolean> {
  const plan: { base: string; steps: number }[] = [];
  for (const rn of rns) {
    if ((await step.locator(`[data-rn="${rn}"]`).count()) > 0) {
      plan.push({ base: rn, steps: 0 });
      continue;
    }
    const m = /^(.*?)(64|6)$/.exec(rn);
    if (!m || (await step.locator(`[data-rn="${m[1]}"]`).count()) === 0) return false;
    plan.push({ base: m[1] as string, steps: m[2] === "6" ? 1 : 2 });
  }
  for (const [i, p] of plan.entries()) {
    await step.locator(`[data-rn-slot="${i}"]`).first().click();
    await step.locator(`[data-rn="${p.base}"]`).first().click();
    if (p.steps > 0) {
      await step.locator(`[data-rn-slot="${i}"]`).first().click();
      for (let k = 0; k < p.steps; k++) await page.keyboard.press("i");
    }
  }
  return true;
}

/** A wrong answer to a drawn trial: another option, another first degree, another letter. */
export async function wrongFor(
  page: Page,
  part: PartLike,
  expected: Record<string, unknown>,
  scope: Locator = page.getByTestId("lesson-step"),
) {
  const ui = part.answer?.ui;
  if (ui === "choice" || (ui === "bar-buttons" && Array.isArray(expected.choice))) {
    const right = (expected.choice as string[])[0];
    const ids = await scope
      .locator("[data-option]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-option") ?? ""));
    expect(ids, `${part.id}: the drawn answer is one of the options shown`).toContain(right);
    return { answer: { choice: [ids.find((i) => i !== right) as string] } };
  }
  if (ui === "degree-pad") {
    const right = expected.degrees as string[];
    const shown = await scope
      .locator("[data-degree]")
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-degree") ?? ""))]);
    const other = shown.find((d) => d !== right[0]) as string;
    return { answer: { degrees: [other, ...right.slice(1)] } };
  }
  if (ui === "quality-pad") {
    const right = (expected.qualities as string[])[0];
    const shown = await scope
      .locator("[data-quality]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-quality") ?? ""));
    return { answer: { qualities: [shown.find((q) => q !== right) as string] } };
  }
  if (ui === "rn-palette") {
    const right = expected.rn as string[];
    const shown = await scope
      .locator("[data-rn]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-rn") ?? ""));
    return { answer: { rn: [shown.find((r) => r !== right[0]) as string, ...right.slice(1)] } };
  }
  if (ui === "form") {
    // Two sections swapped (A B A B → B A A B …), else the first relabelled.
    const right = [...((expected.sections as string[] | undefined) ?? [])];
    const j = right.findIndex((s) => s !== right[0]);
    if (j > 0) [right[0], right[j]] = [right[j] as string, right[0] as string];
    else right[0] = right[0] === "A" ? "B" : "A";
    return { answer: { sections: right } };
  }
  if (ui === "bar-grid") {
    const key = expected.rn ? "rn" : "text";
    const right = [...((expected[key] as string[] | undefined) ?? [])];
    const j = right.findIndex((s) => s !== "" && s !== right.find((x) => x !== ""));
    const i = right.findIndex((s) => s !== "");
    if (i >= 0 && j >= 0) [right[i], right[j]] = [right[j] as string, right[i] as string];
    return { answer: { [key]: right } };
  }
  if (ui === "scale-builder") {
    if (Array.isArray(expected.midi)) return { answer: { midi: (expected.midi as number[]).slice(1) } };
    return { answer: { degrees: ((expected.degrees as string[] | undefined) ?? []).slice(1) } };
  }
  if (ui === "text") {
    const right = expected.text as string[];
    const first = right[0] ?? "C";
    const other = /^C/.test(first) ? "D" : "C";
    return { answer: { text: [other, ...right.slice(1)] } };
  }
  throw new Error(`walker: no wrong answer for ${ui}`);
}

/** A sung step: a `sing`, or an `all` whose every part is sung (the walker's own test, see `walkLesson`). */
export function isSung(step: StepLike): boolean {
  const ex = step.exercise;
  return (
    !!ex && (ex.kind === "sing" || (ex.kind === "all" && (ex.parts ?? []).every((p) => p.kind === "sing")))
  );
}

/**
 * The first sung step of a lesson: Quiet mode changes only sung steps (the sing widget's fallback; every other
 * step kind reads nothing of it), so a Quiet walk starts there (`?step=`) and walks on to the end.
 */
export function firstSungStep(def: LessonLike): string {
  const s = def.steps.find((x) => !x.optional && isSung(x));
  if (!s) throw new Error(`${def.id} has no sung step`);
  return s.id;
}

/** The steps a walk from `from` (or from the start) must show: not optional, not a gate's second chance. */
export function shownFrom(def: LessonLike, from?: string): string[] {
  const at = from === undefined ? 0 : def.steps.findIndex((s) => s.id === from);
  return def.steps
    .slice(Math.max(0, at))
    .filter((s) => !s.optional && !s.gateCheck)
    .map((s) => s.id);
}

/** Walks the whole lesson from the step on screen to completion. */
export async function walkLesson(page: Page, def: LessonLike, o: WalkOptions): Promise<string[]> {
  const seen: string[] = [];
  const mistakes = o.mistakes !== false;
  let started = o.from === undefined;
  for (const step of def.steps) {
    if (!started && step.id !== o.from) continue;
    started = true;
    if (step.id === o.until) {
      await stepIs(page, step.id);
      return seen;
    }
    if (step.optional) continue;
    if (step.gateCheck) {
      // U05.L08's second chance shows only while the voicing gate is unmet (the seed may have passed it).
      const at = page.getByTestId("lesson-step");
      await expect(at).toHaveAttribute("data-step", /.+/, { timeout: 30_000 });
      if ((await at.getAttribute("data-step")) !== step.id) {
        console.log(`[gate] ${def.id} ${step.id}: the gate is already met, the second chance is not shown`);
        continue;
      }
    }
    await stepIs(page, step.id);
    seen.push(step.id);
    const label = `${def.id} ${step.id}`;
    const ex = step.exercise;
    if (!ex) {
      await next(page);
      continue;
    }
    if (step.kind === "make") {
      const rule = (ex.rubric ?? []).find((r) => r.required);
      // The starter leaves the rule that counts open; the passing sketch ticks it.
      if (rule)
        await expect(page.locator(`[data-rule="${rule.id}"]`)).toHaveAttribute("data-ok", "0", {
          timeout: 30_000,
        });
      const code = passingCode(ex);
      expect(code, `${label}: the Make has a passing test`).not.toBeNull();
      await setCode(page, code as string);
      if (rule)
        await expect(
          page.locator(`[data-rule="${rule.id}"]`),
          `${label}: the rule that counts`,
        ).toHaveAttribute("data-ok", "1", { timeout: 30_000 });
      await page.getByTestId("save-sketch").click();
      continue;
    }
    if (isSung(step)) {
      await singStep(page, step, o);
      await next(page);
      continue;
    }
    if (ex.kind === "listen") {
      if (ex.passive) {
        await page.getByTestId("passive-play").click();
        await expect(
          page.getByTestId("passive-names"),
          `${label}: the stream names what it plays`,
        ).not.toBeEmpty({
          timeout: 30_000,
        });
        await expect(page.getByTestId("passive-names")).not.toHaveText(RAW);
      } else await playUntilDone(page, label, "listen", o.listen);
      await next(page);
      continue;
    }
    if (ex.kind === "predict") {
      const step$ = page.getByTestId("lesson-step");
      const opt = step$.locator("[data-option]").first();
      if ((await opt.count()) > 0) await opt.click();
      else await step$.locator("input").first().fill("4");
      await check(page);
      await expect(page.getByTestId("predict-outcome")).toBeVisible();
      await next(page);
      continue;
    }
    if (ex.kind === "run-investigate" && (ex.questions ?? []).length === 0) {
      await playUntilDone(page, label, "run");
      await next(page);
      continue;
    }
    if (ex.kind === "run-investigate") {
      const wrong = ex.tests.find((t) => t.expect === "fail");
      const pass = ex.tests.find((t) => t.expect === "pass");
      if (wrong && mistakes) {
        await answerQuestions(page, ex, wrong.response);
        await check(page);
        await expectHonestFeedback(page, [], `${label} wrong`);
        await expectPinned(page, wrong, label);
      }
      if (pass) await answerQuestions(page, ex, pass.response);
      await check(page);
      await expectPass(page, label);
      await next(page);
      continue;
    }
    const codeKind =
      ["code-modify", "code-make", "error-hunt", "compose-brief"].includes(ex.kind) ||
      ((ex.kind === "dictation" || ex.kind === "staff-read") && ex.answer?.ui === "code");
    if (codeKind) {
      const leaks = answerLeaks(ex, null);
      // A real mistake (the lesson's own pinned one), not the untouched starter, when there is one.
      const fails = ex.tests.filter((t) => t.expect === "fail" && typeof t.response.code === "string");
      const wrong =
        fails.find((t) => !(t.feedback ?? []).includes("code.unchanged") && !/unchanged/i.test(t.name)) ??
        fails[0];
      if (ex.byEar?.parts && ex.byEar.parts.length > 0) {
        await partsStep(page, ex, mistakes ? (wrong ?? null) : null, leaks, label);
        await next(page);
        continue;
      }
      if (wrong && mistakes) {
        // What the learner wrote themselves is not a leak: a quoted pattern of the reference that is also in the
        // wrong code ("lefthand" put after .voicing(), U12.L06 S5) may be named back to them.
        const own = leaks.filter((l) => !(wrong.response.code as string).includes(l));
        leaks.splice(0, leaks.length, ...own);
        await setCode(page, wrong.response.code as string);
        await check(page);
        await expectHonestFeedback(page, leaks, `${label} wrong (${wrong.name})`);
        await expectPinned(page, wrong, label);
        // The Workbench's own list says what and where: read it with the same rules.
        const panel = page.getByTestId("feedback-panel").first();
        if ((await panel.count()) > 0) {
          const said = ((await panel.textContent()) ?? "").trim();
          expect(said, `${label}: the Workbench feedback`).not.toMatch(RAW);
          for (const l of leaks)
            expect(said, `${label}: the Workbench does not print the answer`).not.toContain(l);
          console.log(`[panel] ${label}: ${said.replace(/\s+/g, " ").slice(0, 240)}`);
        }
      }
      await setCode(page, passingCode(ex) as string);
      await check(page);
      await expectPass(page, label);
      await next(page);
      continue;
    }
    if (ex.kind === "dictation" && ex.stageAnswers) {
      await stagedStep(page, ex, label);
      await next(page);
      continue;
    }
    if (ex.kind === "all") {
      await allAnswersStep(page, ex.parts ?? [], label, mistakes);
      await next(page);
      continue;
    }
    // Answer kinds: a drawn trial, or the step's own tests.
    const generator = ex.stimulus?.src === "generator";
    if (ex.stimulus?.src === "code") {
      const play = page.getByTestId("play-stimulus");
      if ((await play.count()) > 0) {
        await play.click();
        await expect(play, `${label}: the stimulus plays`).toHaveText(/Stop|Play again/);
      }
    }
    if (generator && ex.kind === "tap") {
      // A drawn echo (U13.L05 S2): taps never gate. The figure tapped a sixteenth late everywhere is read back as
      // late, then the trial's own targets pass.
      const targets = await page.evaluate(() =>
        (
          globalThis as unknown as { __oakLesson: { tapTargets(): number[] | null } }
        ).__oakLesson.tapTargets(),
      );
      expect(targets?.length ?? 0, `${label}: a drawn tap trial`).toBeGreaterThan(0);
      await expect(page.getByTestId("continue"), `${label}: tapping never gates`).toBeEnabled();
      const all = targets as number[];
      if (mistakes) {
        const w = await submit(page, { taps: all.slice(0, Math.ceil(all.length / 2)) });
        expect(w?.status, `${label}: half the figure does not pass`).not.toBe("pass");
        await expectHonestFeedback(page, [], `${label} wrong (half the figure)`);
      }
      const r = await submit(page, { taps: all });
      expect(r?.status, `${label}: on the targets passes`).toBe("pass");
      await next(page);
      continue;
    }
    if (generator) {
      const expected = (await drawnAnswer(page)) as Record<string, unknown>;
      expect(expected, `${label}: a drawn trial`).not.toBeNull();
      if (mistakes) {
        const wrong = await wrongFor(page, ex, expected);
        if ((await answerOrSubmit(page, ex, wrong)) === "widget") await check(page);
        await expectHonestFeedback(page, answerLeaks(ex, expected), `${label} wrong`);
      }
      if ((await answerOrSubmit(page, ex, { answer: expected })) === "widget") await check(page);
      await expectPass(page, label);
      await next(page);
      continue;
    }
    const pass = ex.tests.find((t) => t.expect === "pass");
    expect(pass, `${label}: a passing test`).toBeDefined();
    // The lesson's own pinned mistake: the first failing test the widget can enter (Wave 5 kinds without a widget
    // yet, and taps, through the player's own grading path).
    for (const wrong of mistakes ? ex.tests.filter((t) => t.expect === "fail") : []) {
      const how = await answerOrSubmit(page, ex, wrong.response);
      if (how === "none") continue;
      if (how === "widget") await check(page);
      await expectHonestFeedback(page, answerLeaks(ex, null), `${label} wrong (${wrong.name})`);
      await expectPinned(page, wrong, label);
      break;
    }
    const how = await answerOrSubmit(page, ex, (pass as TestCaseLike).response);
    expect(how, `${label}: the right answer`).not.toBe("none");
    if (how === "submitted")
      console.log(`[answer] ${label}: through the player's grading path (${ex.answer?.ui ?? ex.kind})`);
    if (how === "widget") await check(page);
    await expectPass(page, label);
    await next(page);
  }
  if (o.inSession) {
    // Inside its own session the lesson's end is the session's Coda (its Make done, the Coda follows).
    await page.waitForURL(/\/session\/coda$/, { timeout: 30_000 });
  } else
    await expect(page.getByTestId("lesson-complete"), `${def.id}: complete`).toBeVisible({ timeout: 30_000 });
  if (o.inSession) return checkCompleted(page, def.id, seen);
  // What opens next is named by title, never by ID ("Blues checkpoint", not "U11.CP"; Wave 7: "Shells", not
  // "J1.L05"; "ii–V Ballad", not "JC1"; "Jazz checkpoint 1", not "J.CP1").
  await expect(page.getByTestId("lesson-complete"), `${def.id}: no lesson IDs`).not.toContainText(
    /\b(U\d\d|[JRA]\d)\.(L\d\d|CP)\b|\b[JRA]\.CP\d?\b|\b[JRA]C\d\.?/,
  );
  if (o.preview) return seen;
  return checkCompleted(page, def.id, seen);
}

async function checkCompleted(page: Page, lessonId: string, seen: string[]): Promise<string[]> {
  const prog = await api<{ lessons: { lessonId: string; status: string }[] }>(
    page,
    "GET",
    "/lessons/progress",
  );
  expect(
    prog.body?.lessons.find((l) => l.lessonId === lessonId)?.status,
    `${lessonId} completed on the server`,
  ).toBe("completed");
  return seen;
}

/** Enters one stage of a staged chord dictation through its own widget (degree pad, quality strip, numerals). */
export async function enterStage(page: Page, ex: PartLike, id: string, values: readonly string[]) {
  const ui = (ex.stageAnswers?.[id] as { ui?: string } | undefined)?.ui;
  const box = page.getByTestId("lesson-step").locator(`li[data-stage="${id}"]`);
  if (ui === "degree-pad") {
    await box.locator("[data-degree]").first().focus();
    for (let i = 0; i < values.length + 2; i++) await page.keyboard.press("Backspace");
    for (const d of values) await box.locator(`[data-degree="${d}"]`).first().click();
  } else if (ui === "quality-pad") {
    for (const [c, q] of values.entries()) {
      if (values.length > 1) await box.locator(`[data-slot="${c}"]`).click();
      await box.locator(`[data-quality="${q}"], [data-option="${q}"]`).first().click();
    }
  } else if (ui === "rn-palette") {
    expect(await enterNumerals(page, box, values), `${id}: numerals entered`).toBe(true);
  } else throw new Error(`walker: no way to answer the ${id} stage (${ui})`);
}

/**
 * A staged chord dictation (U06.L09 S2): the bass first on the degree pad, then a quality per chord, then the
 * numerals. The bass stage gets the lesson's own pinned mistake first (its stage check fails and says where to
 * listen; the quality stage stays shut), then the right bass; each later stage is answered right, and the last
 * stage is the step's own Check.
 */
async function stagedStep(page: Page, ex: PartLike, label: string) {
  const step = page.getByTestId("lesson-step");
  const stage = (id: string) => step.locator(`li[data-stage="${id}"]`);
  const stagesOf = (t: TestCaseLike) =>
    ((t.response.answer as { stages?: Record<string, string[]> } | undefined)?.stages ?? {}) as Record<
      string,
      string[]
    >;
  const pass = ex.tests.find((t) => t.expect === "pass") as TestCaseLike;
  const right = stagesOf(pass);
  const order = ex.stages && ex.stages.length > 0 ? ex.stages : Object.keys(ex.stageAnswers ?? {});
  const first = order[0] as string;
  const wrong = ex.tests.find(
    (t) => t.expect === "fail" && JSON.stringify(stagesOf(t)[first]) !== JSON.stringify(right[first]),
  );
  const enter = (id: string, values: readonly string[]) => enterStage(page, ex, id, values);
  await expect(stage(first)).toHaveAttribute("data-status", "open", { timeout: 30_000 });
  for (const later of order.slice(1)) await expect(stage(later)).toHaveAttribute("data-status", "locked");
  if (wrong) {
    await enter(first, stagesOf(wrong)[first] ?? []);
    await page.getByTestId("check-stage").click();
    const v = page.getByTestId("stage-verdict");
    await expect(v, `${label}: the ${first} stage fails`).toHaveAttribute("data-status", /fail|error/, {
      timeout: 30_000,
    });
    const text = ((await v.textContent()) ?? "").trim();
    expect(text, `${label}: the stage says where to listen`).toMatch(/bar \d|Bar \d/);
    expect(text).not.toMatch(RAW);
    console.log(`[stage] ${label} wrong (${wrong.name}): ${text.replace(/\s+/g, " ")}`);
    if (order[1])
      await expect(stage(order[1]), `${label}: the next stage stays shut`).toHaveAttribute(
        "data-status",
        "locked",
      );
  }
  for (const id of order) {
    await expect(stage(id)).toHaveAttribute("data-status", "open", { timeout: 30_000 });
    await enter(id, right[id] ?? []);
    await page.getByTestId("check-stage").click();
  }
  await expectPass(page, label);
}

/**
 * A by-ear step in parts (U06.L09 S3): the lesson's pinned mistake is checked part by part until a part says
 * what is wrong (the step's own Check stays shut meanwhile); then the reference passes every part and the step.
 */
async function partsStep(
  page: Page,
  ex: PartLike,
  wrong: TestCaseLike | null,
  leaks: readonly string[],
  label: string,
) {
  const parts = ex.byEar?.parts ?? [];
  const box = page.getByTestId("by-ear-parts");
  const mark = (track: string) => box.locator(`[data-part-track="${track}"]`);
  await expect(page.getByTestId("check"), `${label}: Check waits for the parts`).toBeDisabled();
  if (wrong) {
    await setCode(page, wrong.response.code as string);
    for (const part of parts) {
      if ((await mark(part.track).getAttribute("data-mark")) !== "open") continue;
      await page.getByTestId("check-part").click();
      const v = mark(part.track).getByTestId("part-verdict");
      await expect(v).toHaveAttribute("data-status", /pass|fail|error/, { timeout: 30_000 });
      if ((await v.getAttribute("data-status")) === "pass") continue;
      const text = ((await mark(part.track).textContent()) ?? "").trim();
      expect(text, `${label}: the part's verdict`).not.toMatch(RAW);
      for (const l of leaks) expect(text, `${label}: the part does not print the answer`).not.toContain(l);
      expect(text, `${label}: says where`).toMatch(/[Bb]ars? \d/);
      console.log(`[part] ${label} ${part.track} wrong (${wrong.name}): ${text.replace(/\s+/g, " ")}`);
      break;
    }
  }
  await setCode(page, passingCode(ex) as string);
  for (const part of parts) {
    if ((await mark(part.track).getAttribute("data-mark")) === "passed") continue;
    await page.getByTestId("check-part").click();
    await expect(mark(part.track), `${label}: the ${part.track} part`).toHaveAttribute(
      "data-mark",
      "passed",
      {
        timeout: 30_000,
      },
    );
  }
  await expect(page.getByTestId("check")).toBeEnabled();
  await check(page);
  await expectPass(page, label);
}

/**
 * An `all` of answer parts (U07.L01 S6, U07.L03 S4, U07.L09 S6): the first part takes its own pinned mistake
 * while the others are right, the step fails and says so; then the first part is put right and the step passes.
 */
async function allAnswersStep(page: Page, parts: readonly PartLike[], label: string, mistakes = true) {
  const box = (i: number) => page.getByTestId("lesson-step").locator(`li[data-part="${i + 1}"]`);
  // A part drawn from a family (U12.L02 S5, U15.L01 S5) is answered with its own drawn trial; an authored one with
  // its passing test.
  const drawn = (await drawnAnswers(page)) ?? [];
  const passOf = (p: PartLike, i: number): Record<string, unknown> =>
    p.stimulus?.src === "generator"
      ? { answer: drawn[i] ?? {} }
      : (p.tests.find((t) => t.expect === "pass") as TestCaseLike).response;
  for (const [i, p] of parts.entries()) {
    if (p.stimulus?.src === "generator")
      expect(drawn[i], `${label} part ${i + 1}: a drawn trial`).toBeTruthy();
    const play = box(i).getByTestId("play-stimulus");
    if ((await play.count()) > 0) await play.first().click();
    if (i > 0) expect(await answerWidget(page, p, passOf(p, i), box(i)), `${label} part ${i + 1}`).toBe(true);
  }
  const first = parts[0] as PartLike;
  if (!mistakes) {
    // A smoke walk: the reference only.
  } else if (first.stimulus?.src === "generator") {
    const wrong = await wrongFor(page, first, drawn[0] ?? {}, box(0));
    expect(await answerWidget(page, first, wrong, box(0)), `${label} part 1 wrong`).toBe(true);
    await check(page);
    await expectHonestFeedback(
      page,
      answerLeaks(first, drawn[0] ?? null),
      `${label} part 1 wrong (another pick)`,
    );
  } else
    for (const wrong of first.tests.filter((t) => t.expect === "fail")) {
      if (!(await answerWidget(page, first, wrong.response, box(0)))) continue;
      await check(page);
      await expectHonestFeedback(page, answerLeaks(first, null), `${label} part 1 wrong (${wrong.name})`);
      await expectPinned(page, wrong, label);
      break;
    }
  expect(await answerWidget(page, first, passOf(first, 0), box(0)), `${label} part 1`).toBe(true);
  await check(page);
  await expectPass(page, label);
}

/** The session before each U03–U07 lesson in the default order (the dev seed `after <it>`). */
export const BEFORE: Record<string, string> = {
  // Wave 4 (contracts §2.5's default order: U04.CP sits after U05.L01, U05.CP after U06.L01, U06.CP after
  // U07.L01, the gym slots inside U07).
  "U05.L01": "U04.L04",
  "U05.L02": "U04.CP",
  "U05.L03": "U05.L02",
  "U05.L04": "U05.L03",
  // Contracts 1.6 (d17): U05.L09 "Chord Names" was split out of U05.L04 and follows it in the order.
  "U05.L09": "U05.L04",
  "U05.L05": "U05.L09",
  "U05.L06": "U05.L05",
  "U05.L07": "U05.L06",
  "U05.L08": "U05.L07",
  "U06.L01": "U05.L08",
  "U06.L02": "U05.CP",
  "U06.L03": "U06.L02",
  "U06.L04": "U06.L03",
  "U06.L05": "U06.L04",
  "U06.L06": "U06.L05",
  "U06.L07": "U06.L06",
  "U06.L08": "U06.L07",
  "U06.L09": "U06.L08",
  "U06.L10": "U06.L09",
  "U06.L11": "U06.L10",
  "U06.L12": "U06.L11",
  "U07.L01": "U06.L12",
  "U07.L02": "U06.CP",
  "U07.L03": "U07.L02",
  "U07.L04": "GYM.01",
  "U07.L05": "U07.L04",
  "U07.L06": "U07.L05",
  "U07.L07": "U07.L06",
  "U07.L08": "U07.L07",
  "U07.L09": "U07.L08",
  "U07.L10": "U07.L09",
  "U03.L01": "U02.L08",
  "U03.L02": "C1.S1",
  "U03.L03": "U03.L02",
  "U03.L04": "U03.L03",
  "U03.L05": "U03.L04",
  "U03.L06": "U03.L05",
  "U03.L07": "U03.L06",
  "U03.L08": "U03.L07",
  "U03.L09": "U03.L08",
  "U03.L10": "U03.L09",
  "U03.L11": "U03.L10",
  "U04.L01": "U03.L11",
  "U04.L02": "U03.CP",
  "U04.L03": "U04.L02",
  "U04.L04": "U04.L03",
};
