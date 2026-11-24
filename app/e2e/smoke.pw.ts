// Smoke suite: every route of the contracts §11.9 table renders without console errors in Paper and Bark,
// keyboard navigation works (G-prefix, palette, shortcut sheet, focus-mode Esc, tabs), and the app survives a
// server that is down. The API is the in-page stub (stub-api.ts); fixtures are contract-checked by bun test.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { installStubApi } from "./stub-api.ts";

const ROUTES: { path: string; title: RegExp; focus?: boolean }[] = [
  { path: "/", title: /Today/ },
  { path: "/onboarding/1", title: /Hello, loop/i, focus: true },
  { path: "/onboarding/4", title: /Hello, loop/i, focus: true },
  { path: "/learn/U01.L02", title: /./, focus: true },
  { path: "/learn/U01.L02?step=S2", title: /./, focus: true },
  { path: "/checkpoint/U01", title: /Checkpoint/, focus: true },
  { path: "/capstone/C1", title: /./ },
  // Without a session in this browser the Coda hands back to Today (app/src/session/coda/CodaPage.tsx).
  { path: "/session/coda", title: /Today/ },
  { path: "/studio", title: /Studio/ },
  { path: "/studio/sk_1", title: /Sketch 001/ },
  { path: "/oak", title: /The Oak/ },
  { path: "/oak?view=course", title: /The Oak/ },
  { path: "/oak?view=leaves", title: /The Oak/ },
  { path: "/practice", title: /Practice/ },
  { path: "/practice/fam.rhy.pulse", title: /./, focus: true },
  { path: "/practice/review", title: /review/i, focus: true },
  { path: "/transcribe", title: /Transcribe/ },
  { path: "/transcribe/tx_1", title: /Oh! Susanna/ },
  { path: "/album", title: /Album/ },
  { path: "/album/tr_1", title: /First Groove/ },
  { path: "/album/tr_1?v=1", title: /First Groove/ },
  { path: "/toolbox", title: /Toolbox/ },
  { path: "/toolbox?cat=feature", title: /Toolbox/ },
  { path: "/toolbox/tb.feature.roll", title: /./ },
  { path: "/progress", title: /Progress/ },
  { path: "/settings/audio", title: /Audio/ },
  { path: "/settings/voice", title: /Voice/ },
  { path: "/settings/voice/setup", title: /Mic and voice/, focus: true },
  { path: "/settings/tutor", title: /Tutor/ },
  { path: "/settings/learning", title: /Learning/ },
  { path: "/settings/appearance", title: /Appearance/ },
  { path: "/settings/keys", title: /Keys/ },
  { path: "/settings/data", title: /Data/ },
  { path: "/settings/about", title: /About/ },
];

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-state=loading]")).toHaveCount(0, { timeout: 15_000 });
}

/** Each route's own deadline: what it had as a test of its own (the project's 60 s, its browser context included). */
const ROUTE_DEADLINE_MS = 60_000;

// One test per theme walks every route, each in a fresh browser context of its own (the project's options, this
// theme's colour scheme): as isolated as one test per route, without a test's own setup for each of 34 routes. Every
// route's step keeps the 60-second deadline it had as a test: a step that overruns fails and names its route.
for (const scheme of ["light", "dark"] as const) {
  test.describe(`routes in ${scheme === "light" ? "Paper" : "Bark"}`, () => {
    test.use({ colorScheme: scheme });
    test("every route renders", async ({ browser, baseURL, viewport, serviceWorkers, colorScheme }) => {
      test.setTimeout(ROUTES.length * 30_000);
      for (const r of ROUTES)
        await test.step(
          `${r.path} renders`,
          async () => {
            const context = await browser.newContext({
              ...(baseURL ? { baseURL } : {}),
              viewport,
              serviceWorkers,
              colorScheme,
            });
            try {
              const page = await context.newPage();
              const problems = watchConsole(page);
              await installStubApi(page);
              await page.goto(r.path);
              await settle(page);
              await expect(page.locator("html")).toHaveAttribute(
                "data-theme",
                scheme === "light" ? "paper" : "bark",
              );
              await expect(page.getByTestId("page-title")).toHaveText(r.title);
              await expect(page.locator("#main")).not.toBeEmpty();
              // Focus routes hide the NavRail (ux §2.1).
              await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(r.focus ? 0 : 1);
              await expect(page.locator("[data-state=error]")).toHaveCount(0);
              // The page scrolls inside the shell (#main); the window itself never does. A label positioned against
              // the document once made it thousands of pixels tall, with a second scrollbar that moved the shell.
              const overflow = await page.evaluate(
                () => document.documentElement.scrollHeight - window.innerHeight,
              );
              expect(overflow, `${r.path}: the window scrolls by ${overflow}px`).toBeLessThanOrEqual(1);
              expect(problems, `${r.path}: console`).toEqual([]);
            } finally {
              await context.close();
            }
          },
          { timeout: ROUTE_DEADLINE_MS },
        );
    });
  });
}

test("the body background follows the theme", async ({ page }) => {
  await installStubApi(page);
  await page.goto("/");
  await settle(page);
  const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("bark");
  const bark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(paper).toBe("rgb(246, 242, 234)");
  expect(bark).toBe("rgb(20, 17, 14)");
});

test.describe("keyboard", () => {
  test("G then a letter navigates; ? opens the shortcut sheet; Esc closes it", async ({ page }) => {
    const problems = watchConsole(page);
    await installStubApi(page);
    await page.goto("/");
    await settle(page);
    await page.keyboard.press("g");
    await page.keyboard.press("o");
    await expect(page).toHaveURL(/\/oak(\?view=tree)?$/);
    await page.keyboard.press("g");
    await page.keyboard.press("b");
    await expect(page).toHaveURL(/\/toolbox$/);
    await page.keyboard.press("Shift+Slash");
    const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Command palette");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/toolbox$/);
    expect(problems).toEqual([]);
  });

  test("the command palette navigates and runs actions", async ({ page }) => {
    const problems = watchConsole(page);
    await installStubApi(page);
    await page.goto("/");
    await settle(page);
    await page.keyboard.press("ControlOrMeta+k");
    const input = page.getByRole("combobox", { name: /Search commands/ });
    await expect(input).toBeFocused();
    await input.fill("progress");
    await expect(page.getByRole("option").first()).toContainText("Progress");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/progress$/);
    // Search reaches content too: a lesson by title or ID.
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeHidden();
    await settle(page);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(input).toBeFocused();
    await input.fill("U01.L01");
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/learn\/U01\.L01$/);
    expect(problems).toEqual([]);
  });

  test("focus routes switch off the G prefix and Esc goes back to Today", async ({ page }) => {
    await installStubApi(page);
    await page.goto("/learn/U01.L02");
    await settle(page);
    await page.keyboard.press("g");
    await page.keyboard.press("o");
    await expect(page).toHaveURL(/\/learn\/U01\.L02$/);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(`${test.info().project.use.baseURL}/`);
  });

  test("Tab reaches the skip link first, then the navigation; Enter on a nav link navigates", async ({
    page,
  }) => {
    await installStubApi(page);
    await page.goto("/");
    await settle(page);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute("data-nav", "oak");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/oak(\?view=tree)?$/);
    await expect(page.getByRole("link", { name: "The Oak", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("tabs move with the arrow keys and keep the view in the URL", async ({ page }) => {
    await installStubApi(page);
    await page.goto("/oak");
    await settle(page);
    await page.getByRole("tab", { name: "Tree" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/view=course/);
    await expect(page.getByRole("tab", { name: "Course" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page).toHaveURL(/view=leaves/);
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("Mod+J toggles the docked tutor panel", async ({ page }) => {
    await installStubApi(page);
    await page.goto("/");
    await settle(page);
    // Hidden, the panel is a 44 px rail; shown, it holds the conversation (here: the tutor is not set up).
    const rail = page.getByTestId("tutor-rail");
    await expect(rail).toBeVisible();
    await page.keyboard.press("ControlOrMeta+j");
    await expect(page.getByRole("complementary", { name: "Tutor" }).getByTestId("tutor-chat")).toBeVisible();
    await expect(rail).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+j");
    await expect(rail).toBeVisible();
  });
});

test("every API call carries X-Oak: 1", async ({ page }) => {
  const log: { method: string; endpoint: string | null; headers: Record<string, string> }[] = [];
  await installStubApi(page, { log });
  await page.goto("/");
  await settle(page);
  expect(log.length).toBeGreaterThan(2);
  for (const l of log) {
    expect(l.endpoint).not.toBeNull();
    expect(l.headers["x-oak"]).toBe("1");
  }
});

test("with the server down, pages show a calm error state instead of crashing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await installStubApi(page, { offline: true });
  await page.goto("/");
  await expect(page.getByText("Oak's server isn't answering").first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/studio");
  await expect(page.getByText("Oak's server isn't answering").first()).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test("unknown routes show the not-found page", async ({ page }) => {
  await installStubApi(page);
  await page.goto("/map");
  await expect(page.getByText("This page isn't part of Oak")).toBeVisible();
});

test("the first key press wakes sound from the local pack, with no errors", async ({ page }) => {
  // The pack the app loads is the one sounds/pack.lock.json names (publicRoot "/sounds/v2" → sounds/pack/v2).
  const lock = JSON.parse(readFileSync(join(import.meta.dirname, "../../sounds/pack.lock.json"), "utf8")) as {
    packVersion: string;
  };
  test.skip(
    !existsSync(join(import.meta.dirname, `../../sounds/pack/${lock.packVersion}/manifest.json`)),
    "sound pack not mirrored",
  );
  const problems = watchConsole(page);
  await installStubApi(page);
  await page.goto("/studio");
  await settle(page);
  await expect(page.getByTestId("audio-status").first()).toHaveAttribute("aria-label", /Sound asleep/);
  await page.keyboard.press("x");
  await expect(page.getByTestId("audio-status").first()).toHaveAttribute("aria-label", /Audio: Ready/, {
    timeout: 30_000,
  });
  // Strudel's draw module must reuse the hidden canvas, not add a visible one (spike S2, goal 7).
  await expect(page.locator("canvas#test-canvas")).toHaveCount(1);
  expect(problems).toEqual([]);
});

test("the browser grader host boots in a module worker and reads Strudel's pitches", async ({ page }) => {
  test.skip(process.env.E2E_MODE === "preview", "imports app source by path, dev server only");
  const problems = watchConsole(page);
  await installStubApi(page);
  await page.goto("/");
  await settle(page);
  const result = await page.evaluate(async () => {
    const path = "/src/lib/grader-client.ts";
    const g = (await import(path)) as typeof import("../src/lib/grader-client.ts");
    // C4 E4 G4, then the chord [a3,c,e]: octave-less notes are octave 3 in Strudel, so C3=48, E3=52, A3=57,
    // sorted by pitch within the onset. Headless Strudel 1.2.6 (midisOf) gives the same list.
    const r = await g.analyzeCode('setcpm(120/4)\nmel: note("c4 e4 g4 [a3,c,e]")', {
      mode: "lesson",
      bars: 1,
      lint: null,
    });
    const host = await g.graderHost();
    return {
      ok: r.ok,
      backend: host.backend,
      midis: r.ok ? r.events.map((e) => e.midi) : [],
      bpm: r.ok ? r.bpm : 0,
    };
  });
  expect(result.ok).toBe(true);
  expect(result.backend).toBe("web-worker");
  expect(result.midis).toEqual([60, 64, 67, 48, 52, 57]);
  expect(result.bpm).toBe(120);
  expect(problems).toEqual([]);
});
