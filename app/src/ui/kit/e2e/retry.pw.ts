// The result actions (docs/design/retry.md §2) in both themes and sizes, from the keyboard and under reduced
// motion. What a retry counts for, the label, the key and the focus rule are proven by app/src/lib/retry.test.ts
// and server/src/routes/retry.test.ts; this file proves only what a page can: the row's layout and contrast, the
// focus ring, where the focus lands after a result and after Try again, and Alt+R. No seed: the gallery is mounted
// on its own over a settings page, and one page serves the whole screenshot matrix (size and theme change in place).
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../../e2e/support/stack.ts";
import { useUiPrefs } from "../../../../../e2e/support/ui.ts";
import { contrastIssuesIn } from "../../review/e2e/contrast-check.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const PRACTICE = "Practice: this try does not change your result.";

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/.*/, () => {});
});

async function openGallery(page: Page) {
  await page.goto("/settings/about");
  await expect(page.locator("#main")).toBeAttached();
  await page.evaluate(async () => {
    const host = document.createElement("div");
    host.id = "kit-retry";
    host.setAttribute(
      "style",
      "position:fixed;inset:0;overflow:auto;z-index:60;background:var(--oak-bg);color:var(--oak-text)",
    );
    document.body.append(host);
    const src = "/src/ui/kit/gallery/KitRetry.tsx";
    const m = (await import(/* @vite-ignore */ src)) as { mountKitRetry(el: HTMLElement): () => void };
    m.mountKitRetry(host);
  });
  await expect(page.getByRole("heading", { level: 1, name: "UI kit · Result actions" })).toBeVisible();
}

test("the row in both themes at both sizes, reduced motion: no overflow, AA text, a focus ring", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on(
    "console",
    (msg) => msg.type() === "error" && !/status of 501/.test(msg.text()) && errors.push(msg.text()),
  );
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await openGallery(page);
  // Every state: Try again sits immediately before the primary, which is last in its row.
  const states = page.getByTestId("retry-states");
  for (const id of [
    "state-fail",
    "state-pass",
    "state-revealed",
    "state-checkpoint",
    "state-measure",
    "state-drill",
  ]) {
    const order = await states
      .getByTestId(id)
      .locator("button")
      .evaluateAll((bs) => bs.map((b) => b.getAttribute("data-testid") ?? "other"));
    expect([id, order.slice(-2)]).toEqual([id, ["result-retry", "result-continue"]]);
  }
  await expect(states.getByTestId("state-before").getByTestId("result-retry")).toHaveCount(0);
  await expect(states.getByTestId("state-busy").getByTestId("result-retry")).toBeDisabled();
  await expect(states.getByTestId("state-pass").getByTestId("result-line")).toHaveText(PRACTICE);
  // The screen-reader name is the label alone; the key is announced as a shortcut and the line describes it.
  const passRetry = states.getByTestId("state-pass").getByTestId("result-retry");
  await expect(passRetry).toHaveAccessibleName("Try again");
  await expect(passRetry).toHaveAttribute("aria-keyshortcuts", "Alt+R");
  await expect(passRetry).toHaveAccessibleDescription(PRACTICE);

  mkdirSync(SHOTS, { recursive: true });
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    const overflow = await page.evaluate(() => {
      const el = document.getElementById("kit-retry") as HTMLElement;
      const spills = [...el.querySelectorAll<HTMLElement>("[data-testid$='-actions'], [data-state]")]
        .filter((x) => x.scrollWidth > x.clientWidth + 1)
        .map((x) => x.dataset.testid ?? x.dataset.state ?? x.tagName);
      return { page: el.scrollWidth - el.clientWidth, spills };
    });
    expect(overflow, `${m.theme} ${m.width}`).toEqual({ page: 0, spills: [] });
    if (m.width === 1440) expect(await contrastIssuesIn(page, ["#kit-retry"]), m.theme).toEqual([]);
    await passRetry.focus();
    const ring = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as HTMLElement);
      return s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) >= 2;
    });
    expect(ring, `${m.theme} ${m.width}: focus ring`).toBe(true);
    // Reduced motion: nothing in the rows loops or moves; a button's colour change on focus is not motion.
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => {
          const target = (a.effect as KeyframeEffect | null)?.target;
          if (!(target instanceof Element) || target.closest("#kit-retry") === null) return false;
          const prop = (a as CSSTransition).transitionProperty ?? "";
          return !/color|background|border|outline|opacity/.test(prop);
        })
        .map((a) => (a as CSSTransition).transitionProperty ?? (a as CSSAnimation).animationName ?? "?"),
    );
    expect(moving, `${m.theme} ${m.width}: motion`).toEqual([]);
    const pages = await page.evaluate(() => {
      const el = document.getElementById("kit-retry") as HTMLElement;
      return Math.max(1, Math.ceil(el.scrollHeight / el.clientHeight));
    });
    for (let i = 0; i < Math.min(pages, 4); i++) {
      await page.evaluate((n) => {
        const el = document.getElementById("kit-retry");
        if (el) el.scrollTop = n * el.clientHeight;
      }, i);
      await page.screenshot({
        path: `${SHOTS}/retry-kit-${m.theme}-${m.width}x${m.height}${i === 0 ? "" : `-p${i + 1}`}.png`,
        animations: "disabled",
      });
    }
    await page.evaluate(() => {
      const el = document.getElementById("kit-retry");
      if (el) el.scrollTop = 0;
    });
  }
  expect(errors).toEqual([]);
});

test("keyboard only: a wrong answer, Alt+R, a right one, practice, Enter continues; a take is taken again", async ({
  page,
}) => {
  await useUiPrefs(page, { theme: "bark", motion: "on" });
  await openGallery(page);
  const pick = page.getByTestId("live-pick");
  const actions = page.getByTestId("live-pick-actions");
  const option = (name: string) => pick.getByTestId("live-options").getByRole("button", { name });

  // A wrong answer: Continue is held, so the focus lands on Try again; the answer is locked with its verdict.
  await option("Degree 5").focus();
  await page.keyboard.press("Enter");
  await pick.getByTestId("live-check").focus();
  await page.keyboard.press("Enter");
  await expect(pick.getByTestId("live-verdict")).toHaveAttribute("data-status", "fail");
  await expect(actions.getByTestId("result-retry")).toBeFocused();
  await expect(actions.getByTestId("result-continue")).toBeDisabled();
  await expect(option("Degree 1: home")).toBeDisabled();
  await expect(actions.getByTestId("result-line")).toHaveCount(0);

  // Alt+R (from anywhere on the page): the verdict goes, the answer opens, the focus is on the first option.
  await page.keyboard.press("Alt+r");
  await expect(pick.getByTestId("live-verdict")).toHaveCount(0);
  await expect(option("Degree 1: home")).toBeFocused();
  await expect(actions.getByTestId("result-retry")).toHaveCount(0);

  // A right answer: Continue opens and has the focus; the next take is practice and says so.
  await page.keyboard.press("Enter");
  await pick.getByTestId("live-check").focus();
  await page.keyboard.press("Enter");
  await expect(pick.getByTestId("live-verdict")).toHaveAttribute("data-status", "pass");
  await expect(actions.getByTestId("result-continue")).toBeFocused();
  await expect(actions.getByTestId("result-line")).toHaveText(PRACTICE);

  // Try again after a pass (Shift+Tab to it, Enter): a wrong practice take never holds Continue again.
  await page.keyboard.press("Shift+Tab");
  await expect(actions.getByTestId("result-retry")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(option("Degree 1: home")).toBeFocused();
  await option("Degree 7").focus();
  await page.keyboard.press("Enter");
  await pick.getByTestId("live-check").focus();
  await page.keyboard.press("Enter");
  await expect(pick.getByTestId("live-verdict")).toHaveAttribute("data-status", "fail");
  await expect(actions.getByTestId("result-continue")).toBeEnabled();
  await expect(actions.getByTestId("result-continue")).toBeFocused();
  // Nothing moves on by itself: still here, until Enter.
  await expect(pick).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("live-pick-done")).toContainText("number 3");

  // A take: start, listen, a result with the focus on Continue; Try again takes it again, now as practice.
  const take = page.getByTestId("live-take");
  const takeActions = page.getByTestId("live-take-actions");
  await take.getByTestId("take-start").focus();
  await page.keyboard.press("Enter");
  await expect(take.getByTestId("take-result")).toHaveText("That note is 1: home. Take 1.");
  await expect(takeActions.getByTestId("result-continue")).toBeFocused();
  await expect(takeActions.getByTestId("result-line")).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(take).toHaveAttribute("data-phase", "running");
  await expect(take.getByTestId("take-result")).toHaveText("That note is 1: home. Take 2.");
  await expect(takeActions.getByTestId("result-continue")).toBeFocused();
  await expect(takeActions.getByTestId("result-line")).toHaveText(PRACTICE);

  // Onboarding's progress: the position in words; a done or skipped dot is a button that opens its step.
  const rail = page.getByTestId("rail-specimen");
  await expect(rail.getByTestId("rail-position")).toHaveText(
    "Step 4 of 6 · Microphone · 2 of 3: a quiet moment",
  );
  await expect(rail.getByRole("button")).toHaveCount(3);
  await rail.getByRole("button", { name: "Go back to 3. Your tutor (skipped)" }).focus();
  await page.keyboard.press("Enter");
  await expect(rail.getByTestId("rail-visited")).toHaveText("Opened: tutor.");
});
