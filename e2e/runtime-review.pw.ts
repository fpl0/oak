// Adversarial review of the browser runtime and the workbench UX, against the REAL dev stack (and the production
// build for the offline case). Each test pins a defect that was found and fixed:
//   1. the editor used Strudel's dark theme (white text, pastel tokens) on Paper, and the workbench surfaces
//      ignored the app tokens (Paper colours on Bark); the editor font was bare `monospace`;
//   2. evaluation errors surfaced as raw parser dumps; a silent pattern looked broken; an error must never
//      stop the loop that is playing;
//   3. rapid play/stop/re-evaluate and navigation while playing leave no editor, rAF loop, sound or listener;
//   4. the staff engraved 8 bars only, so its highlight died at bar 9 of a long loop; the roll's bar numbers
//      overlapped; the clock must not drift from the audio over 32 bars;
//   5. the 760 px rule ignored height (ux §2.1) and had no "Both"; tabs had no arrow keys; the staff was one
//      tab stop per note; Space/F/T were documented but did nothing;
//   6. a suspended context still said "Ready" (the Mic-live dot: e2e/mic-indicator.pw.ts);
//   7. reduced motion did not calm the code highlights;
//   8. the top bar and the streak chip broke at phone width;
//   9. production: the first offline reload found no cached shell.
// Vite's HMR socket is stubbed in every page: other packages are edited while this runs, and a full reload
// mid-test is not what is being tested.
import { expect, type Page, test } from "@playwright/test";
import { shifted } from "./support/stack.ts";

const SHOTS = new URL("./screenshots/", import.meta.url).pathname;
const PROD = process.env.OAK_PROD_URL ?? `http://127.0.0.1:${shifted(8790)}`;

type OakGlobal = {
  __oakStrudel?: {
    editors: Map<string, { playing: boolean; getCode(): string }>;
    transport: { get(): { playing: boolean }; audibleCycle(): number };
    master: { level(): { rms: number } };
    ctx: AudioContext;
  };
};

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

async function noHmr(page: Page): Promise<void> {
  await page.routeWebSocket(/\/(\?token=|@vite)/, () => {});
}

async function openWorkbench(page: Page, query = ""): Promise<void> {
  await noHmr(page);
  await page.goto(`/dev/workbench${query}`);
  await page.getByTestId("wake-sound").click();
  await expect(page.getByTestId("workbench")).toHaveAttribute("data-analysis", "ready", { timeout: 60_000 });
}

const level = (page: Page) =>
  page.evaluate(() => (globalThis as OakGlobal).__oakStrudel?.master.level().rms ?? -1);

async function maxLevel(page: Page, ms: number): Promise<number> {
  let max = 0;
  for (let t = 0; t < ms; t += 100) {
    await page.waitForTimeout(100);
    max = Math.max(max, await level(page));
  }
  return max;
}

async function typeCode(page: Page, code: string): Promise<void> {
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(code);
  await page.keyboard.press("ControlOrMeta+Enter");
}

/** WCAG relative-luminance contrast of two CSS colours (rgb/rgba strings, alpha ignored). */
function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map((x) => {
      const v = Number(x) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

for (const scheme of ["light", "dark"] as const) {
  test(`theme ${scheme}: the editor and every workbench surface follow the app theme, code is AA`, async ({
    page,
  }) => {
    const problems = watch(page);
    await page.emulateMedia({ colorScheme: scheme });
    await openWorkbench(page);
    const info = await page.evaluate(() => {
      const cs = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el) : null;
      };
      const root = getComputedStyle(document.documentElement);
      const surface = root.getPropertyValue("--oak-surface").trim();
      const probe = document.createElement("div");
      probe.style.color = surface;
      document.body.append(probe);
      const surfaceRgb = getComputedStyle(probe).color;
      probe.remove();
      const spans = [...document.querySelectorAll(".cm-line span")]
        .filter((s) => /[A-Za-z0-9]/.test(s.textContent ?? "") && s.children.length === 0)
        .map((s) => ({ text: s.textContent ?? "", color: getComputedStyle(s).color }));
      return {
        theme: document.documentElement.dataset.theme,
        htmlClass: document.documentElement.className,
        strudelVars: document.getElementById("strudel-theme-vars")?.textContent ?? "",
        surfaceRgb,
        line: cs(".cm-line")?.color,
        font: cs(".cm-content")?.fontFamily,
        transport: cs("[data-testid=transport]")?.backgroundColor,
        roll: cs("[data-testid=piano-roll]")?.backgroundColor,
        staff: cs("[data-testid=staff-view]")?.backgroundColor,
        editorBox: cs(".oak-wb-editor")?.backgroundColor,
        spans,
      };
    });
    expect(info.theme).toBe(scheme === "light" ? "paper" : "bark");
    // Strudel's activateTheme side effects stay neutralised.
    expect(info.htmlClass).not.toContain("dark");
    expect(info.strudelVars).toBe("");
    expect(info.font).toContain("JetBrains Mono");
    // Every surface is the theme's surface (Bark #1C1814, Paper #FFFDF8).
    const want = scheme === "light" ? "rgb(255, 253, 248)" : "rgb(28, 24, 20)";
    expect(info.surfaceRgb).toBe(want);
    for (const bg of [info.roll, info.staff, info.editorBox]) expect(bg).toBe(want);
    expect(info.transport).not.toBe(scheme === "light" ? "rgb(38, 32, 26)" : "rgb(239, 233, 222)");
    // Plain text and every word-bearing token reach AA on the surface.
    expect(contrast(info.line ?? "", want)).toBeGreaterThanOrEqual(7);
    expect(info.spans.length).toBeGreaterThan(10);
    for (const s of info.spans)
      expect(contrast(s.color, want), `${s.text} ${s.color}`).toBeGreaterThanOrEqual(4.5);
    // Syntax is coloured (strings and functions differ from plain text).
    expect(new Set(info.spans.map((s) => s.color)).size).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: `${SHOTS}review-theme-${scheme}.png` });
    expect(problems).toEqual([]);
  });
}

test("evaluation errors are friendly, located, and never stop the loop that plays; silence is explained", async ({
  page,
}) => {
  const problems = watch(page);
  await openWorkbench(page);
  const wb = page.getByTestId("workbench");
  await page.getByTestId("play-toggle").click();
  await expect(wb).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  expect(await maxLevel(page, 1500)).toBeGreaterThan(0.01);
  const banner = page.getByTestId("eval-banner");

  // 1. Mini-notation: an unclosed bracket.
  await typeCode(page, 'setcpm(92/4)\nmel: note("c4 e4 [g4").s("triangle")');
  await expect(banner).toContainText('A "[" is never closed: add a "]"', { timeout: 5000 });
  await expect(banner.locator("p")).not.toContainText("Expected");
  await expect(banner).toContainText("keeps playing");
  // The raw text is one click away, not in the sentence.
  await banner.getByText("Details").click();
  await expect(banner.locator("code")).toContainText("[mini] parse error");
  // The editor marks the bracket itself.
  const mark = await page.evaluate(() => {
    const el = document.querySelector(".cm-lintRange-error");
    return el?.textContent ?? null;
  });
  expect(mark).toBe("[");
  await expect(wb).toHaveAttribute("data-playing", "1");
  expect(await maxLevel(page, 1200)).toBeGreaterThan(0.01);
  await page.screenshot({ path: `${SHOTS}review-error-mini.png` });

  // 2. An unknown function.
  await typeCode(page, 'setcpm(92/4)\nmel: note("c4 e4 g4").s("triangle").fooBar()');
  await expect(banner).toContainText("fooBar isn't a Strudel function", { timeout: 5000 });
  await expect(banner.locator("p")).not.toContainText("TypeError");
  await expect(wb).toHaveAttribute("data-playing", "1");

  // 3. An unknown name.
  await typeCode(page, "setcpm(92/4)\nmel: wobble(3)");
  await expect(banner).toContainText("wobble isn't something Strudel knows", { timeout: 5000 });
  await expect(wb).toHaveAttribute("data-playing", "1");
  expect(await maxLevel(page, 1000)).toBeGreaterThan(0.01);

  // 4. Silence runs, says so, and is not an error.
  await typeCode(page, 'setcpm(92/4)\nmel: note("c4 e4").s("triangle").mask("0")');
  await expect(page.getByTestId("eval-silent")).toContainText("plays no notes yet", { timeout: 5000 });
  await expect(banner).toHaveCount(0);

  // 5. Fixed code clears both and plays again.
  await typeCode(page, 'setcpm(92/4)\nmel: note("c4 e4 g4 e4").s("triangle")');
  await expect(banner).toHaveCount(0);
  await expect(page.getByTestId("eval-silent")).toHaveCount(0);
  await expect(wb).toHaveAttribute("data-playing", "1");
  expect(await maxLevel(page, 1500)).toBeGreaterThan(0.01);
  await page.getByTestId("play-toggle").click();
  await expect(wb).toHaveAttribute("data-playing", "0");
  // Strudel's repl logs each learner error to the console itself; nothing else may.
  const learner = /\[mini\] parse error|fooBar is not a function|wobble is not defined/;
  expect(problems.filter((p) => !learner.test(p))).toEqual([]);
});

test("rapid play/stop/Run, then navigating away while playing, leaves nothing behind", async ({ page }) => {
  const problems = watch(page);
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    let raf = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      raf++;
      return orig(cb);
    };
    w.__raf = () => raf;
    const counts = new Map<string, number>();
    for (const [name, target] of [
      ["window", window],
      ["document", document],
    ] as const) {
      const add = target.addEventListener.bind(target);
      const rem = target.removeEventListener.bind(target);
      target.addEventListener = ((type: string, ...rest: unknown[]) => {
        counts.set(`${name}:${type}`, (counts.get(`${name}:${type}`) ?? 0) + 1);
        return (add as (...a: unknown[]) => void)(type, ...rest);
      }) as typeof target.addEventListener;
      target.removeEventListener = ((type: string, ...rest: unknown[]) => {
        counts.set(`${name}:${type}`, (counts.get(`${name}:${type}`) ?? 0) - 1);
        return (rem as (...a: unknown[]) => void)(type, ...rest);
      }) as typeof target.removeEventListener;
    }
    w.__listeners = () => [...counts.values()].reduce((a, b) => a + b, 0);
  });
  const rafRate = async () => {
    const a = await page.evaluate(() => (window as unknown as { __raf(): number }).__raf());
    await page.waitForTimeout(1000);
    return (await page.evaluate(() => (window as unknown as { __raf(): number }).__raf())) - a;
  };
  const listeners = () => page.evaluate(() => (window as unknown as { __listeners(): number }).__listeners());
  const oakState = () =>
    page.evaluate(() => {
      const o = (globalThis as OakGlobal).__oakStrudel;
      return {
        editors: o?.editors.size ?? -1,
        playing: [...(o?.editors.values() ?? [])].filter((e) => e.playing).length,
        transport: o?.transport.get().playing ?? null,
        mirrors: document.querySelectorAll(".cm-editor").length,
      };
    });

  await openWorkbench(page);
  const wb = page.getByTestId("workbench");
  const toggle = page.getByTestId("play-toggle");
  // 15 clicks in under a second: the last one wins, the UI and the adapter agree.
  for (let i = 0; i < 15; i++) {
    await toggle.click({ noWaitAfter: true });
    await page.waitForTimeout(20 + (i % 3) * 30);
  }
  await page.waitForTimeout(1500);
  let s = await oakState();
  expect(s.playing).toBe((await wb.getAttribute("data-playing")) === "1" ? 1 : 0);
  expect(s.transport).toBe(s.playing === 1);
  // Ctrl+Enter ten times in a row (each goes through the evaluation mutex) keeps one clean loop.
  await page.locator(".cm-content").first().click();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ControlOrMeta+Enter");
  await expect(wb).toHaveAttribute("data-playing", "1", { timeout: 10_000 });
  expect(await maxLevel(page, 1500)).toBeGreaterThan(0.01);
  s = await oakState();
  expect(s).toMatchObject({ editors: 1, playing: 1, transport: true, mirrors: 1 });

  // Navigate away while it plays, five times over.
  const baseline = await listeners();
  for (let round = 0; round < 5; round++) {
    await page.getByRole("link", { name: "Today" }).first().click();
    await expect(page.getByTestId("page-title")).toHaveText(/Today|Wednesday|day/i);
    await page.waitForTimeout(300);
    s = await oakState();
    expect(s).toMatchObject({ editors: 0, playing: 0, transport: false, mirrors: 0 });
    await page.evaluate(() => {
      history.pushState({}, "", "/dev/workbench");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.getByTestId("wake-sound").click();
    await expect(wb).toHaveAttribute("data-analysis", "ready", { timeout: 30_000 });
    await toggle.click();
    await expect(wb).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  }
  await page.getByRole("link", { name: "Today" }).first().click();
  await page.waitForTimeout(1500);
  expect(await oakState()).toMatchObject({ editors: 0, playing: 0, transport: false, mirrors: 0 });
  // No sound, no animation loop, and the listener count is back where it was (± a route's own few).
  expect(await maxLevel(page, 800)).toBeLessThan(0.002);
  expect(await rafRate()).toBe(0);
  expect(await listeners()).toBeLessThanOrEqual(baseline + 4);
  expect(problems).toEqual([]);
});

test("Listen QA: switching examples quickly keeps one live mirror and one source; panic stops it", async ({
  page,
}) => {
  const problems = watch(page);
  await noHmr(page);
  await page.goto("/settings/listening");
  // The listening pass has no separate wake button any more: the first Play wakes the sound (a user gesture).
  const plays = page.getByTestId("listen-list").getByRole("button", { name: /^Play / });
  await expect(plays.first()).toBeVisible({ timeout: 30_000 });
  const n = Math.min(await plays.count(), 6);
  for (let round = 0; round < 3; round++)
    for (let i = 0; i < n; i++) {
      await plays.nth(i).click({ noWaitAfter: true });
      await page.waitForTimeout(50 + ((i * 37) % 80));
    }
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => {
    const o = (globalThis as OakGlobal).__oakStrudel;
    return {
      editors: o?.editors.size,
      playing: [...(o?.editors.values() ?? [])].filter((e) => e.playing).length,
      mirrors: document.querySelectorAll(".cm-editor").length,
    };
  });
  expect(st).toEqual({ editors: 1, playing: 1, mirrors: 1 });
  await page.keyboard.press("Control+.");
  await expect(page.getByTestId("workbench")).toHaveAttribute("data-playing", "0", { timeout: 2000 });
  expect(problems).toEqual([]);
});

test("64 bars: smooth frames, legible roll, the staff pages with the playhead, no drift over 32 bars", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const problems = watch(page);
  await openWorkbench(page, "?example=long-64");
  await expect(page.getByTestId("staff-view")).toHaveAttribute("data-status", "ready", { timeout: 30_000 });
  // A page holds as many bars as fit at most 4 systems at this width (Wave 3's staff-height cap, pageBarsFor).
  const pager = page.getByTestId("staff-pager");
  await expect(pager).toContainText(/Bars 1–\d+ of 64/);
  const per = Number(/Bars 1–(\d+) of 64/.exec((await pager.textContent()) ?? "")?.[1]);
  expect(per).toBeGreaterThanOrEqual(2);
  expect(per).toBeLessThanOrEqual(16);
  // The pager turns by hand while stopped, and engraves the right bars.
  await page.getByRole("button", { name: "Next bars" }).click();
  await expect(pager).toContainText(`Bars ${per + 1}–${2 * per} of 64`);
  await expect(page.locator(`.oak-staff-host [aria-label*='bar ${per + 1},']`).first()).toBeAttached();
  await page.getByRole("button", { name: "Previous bars" }).click();

  await page.getByTestId("play-toggle").click();
  await expect(page.getByTestId("workbench")).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const ts: number[] = [];
        const f = (t: number) => {
          ts.push(t);
          if (ts.length < 120) requestAnimationFrame(f);
          else resolve(ts);
        };
        requestAnimationFrame(f);
      }),
  );
  const gaps = frames
    .slice(1)
    .map((t, i) => t - (frames[i] as number))
    .sort((a, b) => a - b);
  expect(gaps[Math.floor(gaps.length * 0.95)] as number).toBeLessThan(34);

  let staffLitPastBar8 = 0;
  const pagesSeen = new Set<string>();
  let worst = 0;
  for (let i = 0; i < 32; i++) {
    // The roll and the staff repaint in separate frames: a sample taken on a step boundary can catch one of them a
    // step ahead, so a mismatched sample is taken again on the next frame.
    const sample = () =>
      page.evaluate(() => {
        const o = (globalThis as OakGlobal).__oakStrudel;
        const head = Number(
          document.querySelector("[data-testid=roll-canvas]")?.getAttribute("data-playhead"),
        );
        const audible = (o?.transport.audibleCycle() ?? 0) % 64;
        const ids = (sel: string, attr: string) =>
          (document.querySelector(sel)?.getAttribute(attr) ?? "").split(" ").filter(Boolean);
        return {
          head,
          audible,
          roll: ids("[data-testid=piano-roll]", "data-active"),
          staff: ids(".oak-staff-host", "data-active-events"),
          page: document.querySelector("[data-testid=staff-view]")?.getAttribute("data-page") ?? "",
        };
      });
    let s = await sample();
    if (!s.staff.every((id) => s.roll.includes(id))) {
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      s = await sample();
    }
    if (Number.isFinite(s.head)) {
      let d = Math.abs(s.head - s.audible);
      if (d > 32) d = 64 - d;
      worst = Math.max(worst, d);
    }
    for (const id of s.staff) expect(s.roll).toContain(id);
    if (s.audible > 8.5 && s.staff.length > 0) staffLitPastBar8++;
    pagesSeen.add(s.page);
    await page.waitForTimeout(1000);
  }
  // 240 BPM: one bar a second. The playhead is at most a few frames from the audio, at bar 32 as at bar 1.
  expect(worst).toBeLessThan(0.08);
  expect(staffLitPastBar8).toBeGreaterThanOrEqual(15);
  expect(pagesSeen.size).toBeGreaterThanOrEqual(4);
  await page.screenshot({ path: `${SHOTS}review-64-bars.png`, fullPage: true });
  await page.getByTestId("play-toggle").click();
  expect(problems).toEqual([]);
});

test("the 760 px rule: tabs below 760 px of width OR height (Roll | Staff | Both), arrow keys between tabs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkbench(page);
  await expect(page.locator("[role=tab]")).toHaveCount(0);
  await expect(page.getByTestId("piano-roll")).toBeVisible();
  await expect(page.getByTestId("staff-view")).toBeVisible();
  // 1280×800 (ux "M"): 752 px under the 48 px top bar.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("tab")).toHaveText(["Roll", "Staff", "Both"]);
  await expect(page.getByTestId("staff-view")).toHaveCount(0);
  await page.getByRole("tab", { name: "Roll" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Staff" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Staff" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("staff-view")).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Both" })).toBeFocused();
  await expect(page.getByTestId("piano-roll")).toBeVisible();
  await expect(page.getByTestId("staff-view")).toBeVisible();
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", /tab-both$/);
  // Narrow and tall: tabs too, and nothing scrolls sideways.
  await page.setViewportSize({ width: 700, height: 1100 });
  await expect(page.getByRole("tab")).toHaveCount(3);
  const sw = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sw).toBe(0);
  await page.screenshot({ path: `${SHOTS}review-tabs-700.png`, fullPage: true });
});

test("keyboard only: one tab stop for the staff, arrows walk its notes, Space/F/T work in the workbench", async ({
  page,
}) => {
  const problems = watch(page);
  await openWorkbench(page);
  await expect(page.getByTestId("staff-view")).toHaveAttribute("data-status", "ready");
  const stops = await page.evaluate(() => document.querySelectorAll(".oak-staff-host [tabindex='0']").length);
  expect(stops).toBe(1);
  // From the transport, Tab reaches the staff after the loop and metronome controls (Wave 2), the track chips and
  // the notes-table toggle.
  await page.getByTestId("play-toggle").focus();
  let onStaff = false;
  for (let i = 0; i < 30 && !onStaff; i++) {
    await page.keyboard.press("Tab");
    onStaff = await page.evaluate(() => document.activeElement?.closest(".oak-staff-host") !== null);
  }
  expect(onStaff).toBe(true);
  const first = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await page.keyboard.press("ArrowRight");
  const second = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  expect(second).not.toBe(first);
  expect(second).toMatch(/bar \d+, beat/);
  // ArrowDown moves on too (abcjs would otherwise drag the note on a read-only staff).
  await page.keyboard.press("ArrowDown");
  const transform = await page.evaluate(() =>
    [...document.querySelectorAll(".oak-staff-host [data-oak-events]")].some((e) =>
      (e.getAttribute("transform") ?? "").includes("translate"),
    ),
  );
  expect(transform).toBe(false);
  await page.keyboard.press("Enter");
  await expect.poll(() => page.getByTestId("workbench").getAttribute("data-editor-selection")).not.toBeNull();
  // Tab leaves the staff in one step.
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest(".oak-staff-host") === null)).toBe(true);

  // Space plays and stops when the workbench has focus (not on a button), F focuses the editor.
  await page.getByTestId("piano-roll").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Space");
  await expect(page.getByTestId("workbench")).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  await page.keyboard.press("Space");
  await expect(page.getByTestId("workbench")).toHaveAttribute("data-playing", "0");
  await page.keyboard.press("t");
  await expect(page.getByTestId("transport")).toContainText("Practice 85%");
  await page.keyboard.press("f");
  expect(await page.evaluate(() => document.activeElement?.classList.contains("cm-content"))).toBe(true);
  // Tab out of the editor is not trapped.
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest(".cm-editor") === null)).toBe(true);
  expect(problems).toEqual([]);
});

test("reduced motion: code highlights hold for the cycle instead of blinking with every step", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWorkbench(page);
  await typeCode(page, 'setcpm(30/4)\ndrums: s("bd ~ sd ~")');
  await expect(page.getByTestId("workbench")).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  await page.waitForTimeout(600);
  const lit = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".cm-line span[style*='outline']")]
        .map((e) => e.textContent)
        .sort()
        .join(","),
    );
  // 30 BPM in 4/4: one step lasts 2 s. Within one cycle both tokens stay lit together.
  const samples: string[] = [];
  for (let i = 0; i < 6; i++) {
    samples.push(await lit());
    await page.waitForTimeout(400);
  }
  expect(samples.every((s) => s === "bd,sd")).toBe(true);
  await page.getByTestId("play-toggle").click();
});

test("a context suspended after it ran shows 'Sound paused' and the next key resumes it", async ({
  page,
}) => {
  await openWorkbench(page);
  const status = page.getByRole("banner").getByTestId("audio-status");
  await expect(status).toHaveAccessibleName(/Ready/);
  await page.evaluate(() => (globalThis as OakGlobal).__oakStrudel?.ctx.suspend());
  await expect(status).toHaveAccessibleName(/Sound paused/);
  await expect(status).toContainText("Sound paused — press any key");
  await page.keyboard.press("a");
  await expect(status).toHaveAccessibleName(/Ready/, { timeout: 5000 });
  expect(await page.evaluate(() => (globalThis as OakGlobal).__oakStrudel?.ctx.state)).toBe("running");
});

test("phone width: the top bar keeps its title, the audio status is a dot, nothing scrolls sideways", async ({
  page,
}) => {
  await noHmr(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const title = page.getByTestId("page-title");
  const w = await title.evaluate((e) => e.getBoundingClientRect().width);
  expect(w).toBeGreaterThan(70);
  const status = page.getByRole("banner").getByTestId("audio-status");
  expect(await status.evaluate((e) => e.getBoundingClientRect().height)).toBeLessThanOrEqual(32);
  expect(await status.evaluate((e) => e.getBoundingClientRect().width)).toBeLessThanOrEqual(32);
  await expect(status).toHaveAccessibleName(/Sound asleep/);
  const chip = page.getByText(/⁀ week/);
  if (await chip.count()) expect(await chip.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.screenshot({ path: `${SHOTS}review-phone-today.png` });
});

test("production: after the first load, an offline reload still opens the app from the Service Worker", async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: PROD });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("page-title")).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("a"); // wakes sound: registers /sw.js and warms the shell cache
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const cache = await caches.open("oak-shell-v1");
          const keys = (await cache.keys()).map((r) => new URL(r.url).pathname);
          return keys.includes("/") && keys.some((k) => k.endsWith(".js"));
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("page-title")).toBeVisible({ timeout: 15_000 });
  // A deep link offline falls back to the cached index (SPA) and renders its route.
  await page.goto("/settings/appearance");
  await expect(page.getByTestId("page-title")).toHaveText(/Appearance|Settings/, { timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}review-offline.png` });
  await context.setOffline(false);
  await context.close();
});
