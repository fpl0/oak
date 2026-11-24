// Wave 7 kit: the new pieces (track card, two-lane tap pad, version switch, export button, part levels, Euclid ring,
// slider that plays) in both themes and sizes, from the keyboard and under reduced motion. Logic (states, words,
// grids, levels) is proven by model-w7.test.ts; this file proves only what a page can: layout, AA, focus and the
// keys. Every test blocks Vite's HMR socket; the gallery needs no seed (mounted on its own over a settings page),
// and one page serves the whole screenshot matrix: size and theme change in place.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../../e2e/support/stack.ts";
import { useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { contrastIssuesIn } from "../../review/e2e/contrast-check.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

async function openGallery(page: Page) {
  await page.goto("/settings/about");
  await expect(page.locator("#main")).toBeAttached();
  await page.evaluate(async () => {
    const host = document.createElement("div");
    host.id = "kit-w7";
    host.setAttribute(
      "style",
      "position:fixed;inset:0;overflow:auto;z-index:60;background:var(--oak-bg);color:var(--oak-text)",
    );
    document.body.append(host);
    const src = "/src/ui/kit/gallery/KitWave7.tsx";
    const m = (await import(/* @vite-ignore */ src)) as { mountKitWave7(el: HTMLElement): () => void };
    m.mountKitWave7(host);
  });
  await expect(page.getByRole("heading", { level: 1, name: "UI kit · Wave 7" })).toBeVisible();
}

test("Wave 7 pieces render in both themes at both sizes: no overflow, AA text, a focus ring", async ({
  page,
}) => {
  const errors: string[] = [];
  // The gallery's own errors; a shell request to an endpoint the server answers "not built yet" (501, wave7.md §4.1)
  // is not the kit's.
  page.on(
    "console",
    (msg) => msg.type() === "error" && !/status of 501/.test(msg.text()) && errors.push(msg.text()),
  );
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await openGallery(page);
  mkdirSync(SHOTS, { recursive: true });
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    const overflow = await page.evaluate(() => {
      const el = document.getElementById("kit-w7") as HTMLElement;
      const spills = [
        ...el.querySelectorAll<HTMLElement>("article, [data-part], [data-tap-pad], [role=radiogroup]"),
      ]
        .filter((x) => x.scrollWidth > x.clientWidth + 1)
        .map((x) => x.getAttribute("aria-label") ?? x.dataset.part ?? x.tagName);
      return { page: el.scrollWidth - el.clientWidth, spills };
    });
    expect(overflow, `${m.theme} ${m.width}`).toEqual({ page: 0, spills: [] });
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
          .map((a) => a.finished.catch(() => undefined)),
      ).then(() => undefined),
    );
    if (m.width === 1440) expect(await contrastIssuesIn(page, ["#kit-w7"]), m.theme).toEqual([]);
    // The focus ring on the version switch's chosen segment is in every shot.
    await page.getByTestId("version-switch").getByRole("radio", { checked: true }).focus();
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) >= 2;
    });
    expect(ring, `${m.theme} ${m.width}: focus ring`).toBe(true);
    const pages = await page.evaluate(() => {
      const el = document.getElementById("kit-w7") as HTMLElement;
      return Math.max(1, Math.ceil(el.scrollHeight / el.clientHeight));
    });
    for (let i = 0; i < Math.min(pages, 6); i++) {
      await page.evaluate((n) => {
        const el = document.getElementById("kit-w7");
        if (el) el.scrollTop = n * el.clientHeight;
      }, i);
      await page.screenshot({
        path: `${SHOTS}/w7-kit-${m.theme}-${m.width}x${m.height}${i === 0 ? "" : `-p${i + 1}`}.png`,
        animations: "disabled",
      });
    }
    await page.evaluate(() => {
      const el = document.getElementById("kit-w7");
      if (el) el.scrollTop = 0;
    });
  }
  expect(errors).toEqual([]);
});

test("each piece works from the keyboard and says its state in words", async ({ page }) => {
  await useUiPrefs(page, { theme: "bark", motion: "on" });
  await openGallery(page);

  // Track cards: four states in words; a waiting track has no way in and names its gate; the focus is marked.
  const cards = page.getByTestId("track-cards");
  await expect(cards.locator("[data-track-state]")).toHaveCount(4);
  await expect(page.getByTestId("track-in-progress").getByTestId("track-state")).toHaveText("In progress");
  await expect(page.getByTestId("track-in-progress").getByTestId("track-focus")).toHaveText("Your focus");
  await expect(page.getByTestId("track-in-progress").getByTestId("track-progress")).toHaveText(
    "7 of 34 sessions · 0 of 4 capstones released",
  );
  const waiting = page.getByTestId("track-waiting");
  await expect(waiting.getByTestId("track-line")).toHaveText("Waits for the unit 9 checkpoint.");
  await expect(waiting.getByRole("button", { name: "This is never drawn" })).toHaveCount(0);
  await expect(page.getByTestId("track-complete").getByTestId("track-state")).toHaveText("Complete");
  await expect(page.getByTestId("track-open")).toHaveAttribute(
    "aria-label",
    "Advanced Rhythm: open. Next: R1.L01 Metric Weight · about 15 min",
  );

  // Two-lane tap pad: F and J tap their lanes while armed; nothing is taken before.
  const pad = page.getByTestId("tap-pad");
  await pad.focus();
  await page.keyboard.press("f");
  await expect(pad.locator('[data-lane="0"]').getByTestId("lane-count")).toHaveText("No taps yet");
  await page.getByTestId("tap-arm").click();
  await pad.focus();
  for (const k of ["f", "j", "f", "f", "j"]) await page.keyboard.press(k);
  await expect(pad.locator('[data-lane="0"]').getByTestId("lane-count")).toHaveText("3 taps");
  await expect(pad.locator('[data-lane="1"]').getByTestId("lane-count")).toHaveText("2 taps");
  // A press on a lane taps it too.
  await pad.getByRole("button", { name: "Tap 2 (J)" }).dispatchEvent("pointerdown", { button: 0 });
  await expect(pad.locator('[data-lane="1"]').getByTestId("lane-count")).toHaveText("3 taps");
  await page.getByTestId("tap-arm").click();
  await expect(pad.locator("[data-target]")).toHaveCount(5);

  // Version switch: one tab stop, arrows move and say which version plays.
  const versions = page.getByTestId("version-switch");
  await versions.getByRole("radio", { checked: true }).focus();
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", /^Version A: Swing .*, playing$/);
  await page.keyboard.press("ArrowRight");
  await expect(versions.getByRole("radio", { name: /^Version B: Funk/ })).toBeFocused();
  await expect(versions.getByRole("radio", { name: /^Version B: Funk/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(versions.locator('[data-playing="true"]')).toHaveAttribute("data-version", "b");

  // Export: progress with Cancel, then a saved file; a cancel saves nothing.
  const exp = page.getByTestId("export-live");
  await exp.getByRole("button", { name: /^Export WAV: Four-Chord Song/ }).click();
  await expect(exp).toHaveAttribute("data-export-phase", "rendering");
  await expect(exp.getByRole("progressbar")).toBeVisible();
  await exp.getByRole("button", { name: "Cancel" }).click();
  await expect(exp.getByTestId("export-status")).toHaveText("Export cancelled. Nothing was saved.");
  await exp.getByRole("button", { name: /Export WAV/ }).click();
  await expect(exp.getByTestId("export-status")).toHaveText("Saved Four-Chord Song.wav (2.1 MB).");
  await expect(page.getByTestId("export-failed").getByTestId("export-status")).toContainText(
    "Nothing was saved.",
  );
  await expect(page.getByTestId("export-disabled").getByRole("button")).toBeDisabled();

  // Part levels: the quiet part is marked as not heard in words, not by colour alone.
  const pad2 = page.getByTestId("levels").locator('[data-part="pad"]');
  await expect(pad2.getByRole("meter")).toHaveAttribute(
    "aria-valuetext",
    "not heard: 26.5 dB under the loudest part",
  );
  await expect(pad2).toContainText("Not heard");
  await expect(page.getByTestId("levels").locator("[data-heard]")).toHaveCount(3);

  // Euclid ring: arrows edit hits and rotation; the code and the name follow.
  const ring = page.getByTestId("euclid-edit").getByRole("group", { name: /^Rim:/ });
  await ring.focus();
  await expect(ring).toHaveAttribute("aria-label", "Rim: 5 hits in 16 steps, rotated by 10");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(ring).toHaveAttribute("aria-label", "Rim: 4 hits in 15 steps");
  await expect(page.getByTestId("euclid-edit").getByTestId("euclid-code")).toHaveText("x(4,15)");
  await expect(ring.locator("[data-hit]")).toHaveCount(4);

  // The slider that plays: Space plays; a settled change while playing is auditioned once, not once a step.
  const slider = page.getByTestId("swing-slider");
  await slider.getByRole("slider").focus();
  await expect(slider.getByTestId("play-slider-words")).toHaveText("1.5:1: light swing");
  await page.keyboard.press("Space");
  await expect(slider).toHaveAttribute("data-playing", "true");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("swing-heard")).toHaveText("Auditioned once, last at 0.35.");
  await page.keyboard.press("Space");
  await expect(slider).not.toHaveAttribute("data-playing", "true");
});
