// Wave 6 kit: the new pieces (key strip, device counter, loudness read-out, album player bar, branch card) in both
// themes and sizes, from the keyboard and under reduced motion. Every test blocks Vite's HMR socket; the gallery
// needs no seed (it is mounted on its own over a settings page). One page serves the whole screenshot matrix: the
// size and the theme change in place.
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

/** Mounts kit/gallery/KitWave6.tsx over an app page (no other area's route needed) in a scrolling layer. */
async function openGallery(page: Page) {
  await page.goto("/settings/about");
  await expect(page.locator("#main")).toBeAttached();
  await page.evaluate(async () => {
    const host = document.createElement("div");
    host.id = "kit-w6";
    host.setAttribute(
      "style",
      "position:fixed;inset:0;overflow:auto;z-index:60;background:var(--oak-bg);color:var(--oak-text)",
    );
    document.body.append(host);
    const src = "/src/ui/kit/gallery/KitWave6.tsx";
    const m = (await import(/* @vite-ignore */ src)) as { mountKitWave6(el: HTMLElement): () => void };
    m.mountKitWave6(host);
  });
  await expect(page.getByRole("heading", { level: 1, name: "UI kit · Wave 6" })).toBeVisible();
}

async function shootLayer(page: Page, name: string, theme: string) {
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize() ?? { width: 0, height: 0 };
  const pages = await page.evaluate(() => {
    const el = document.getElementById("kit-w6");
    if (!el) return 1;
    el.scrollTop = 0;
    return Math.max(1, Math.ceil(el.scrollHeight / el.clientHeight));
  });
  for (let i = 0; i < Math.min(pages, 7); i++) {
    await page.evaluate((n) => {
      const el = document.getElementById("kit-w6");
      if (el) el.scrollTop = n * el.clientHeight;
    }, i);
    const suffix = i === 0 ? "" : `-p${i + 1}`;
    await page.screenshot({
      path: `${SHOTS}/${name}-${theme}-${size.width}x${size.height}${suffix}.png`,
      animations: "disabled",
    });
  }
}

test("Wave 6 pieces render in both themes at both sizes without overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await openGallery(page);
  // A playing record and a focused key segment are in the shots (the focus ring on a segment).
  await page.getByTestId("player-main").getByTestId("player-toggle").click();
  for (const m of SCREENSHOT_MATRIX) {
    await page.setViewportSize({ width: m.width, height: m.height });
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, m.theme);
    const overflow = await page.evaluate(() => {
      const el = document.getElementById("kit-w6") as HTMLElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow, `${m.theme} ${m.width}`).toBeLessThanOrEqual(0);
    // No piece is wider than its card, and no text of a strip segment spills out of its segment.
    const spills = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "#kit-w6 [data-key], #kit-w6 [data-device], #kit-w6 article",
        ),
      ]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.getAttribute("aria-label") ?? el.dataset.device ?? el.tagName),
    );
    expect(spills, `${m.theme} ${m.width}`).toEqual([]);
    // Every text run of every piece is AA on its surface, in both themes (read at rest: the theme changed in
    // place, and a colour part-way through its 150 ms transition is not the theme's).
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
          .map((a) => a.finished.catch(() => undefined)),
      ).then(() => undefined),
    );
    if (m.width === 1440) expect(await contrastIssuesIn(page, ["#kit-w6"]), m.theme).toEqual([]);
    await page
      .getByTestId("keystrip-lift")
      .getByRole("button", { name: /^D major/ })
      .focus();
    await shootLayer(page, "w6-kit", m.theme);
  }
  expect(errors).toEqual([]);
});

test("the key strip names each key and its change, moves from the keyboard and follows the playhead", async ({
  page,
}) => {
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await openGallery(page);
  const lift = page.getByTestId("keystrip-lift");
  const strip = lift.getByRole("group", { name: "Key along “Chromatic Colour”" });
  await expect(strip.getByRole("button")).toHaveCount(2);
  // One tab stop; the playhead is at bar 33, in the lifted chorus.
  await expect(strip.locator('[tabindex="0"]')).toHaveCount(1);
  const c = strip.locator('[data-key="C major"]');
  const d = strip.locator('[data-key="D major"]');
  await expect(c).toHaveAttribute("aria-label", "C major, bars 1–32");
  await expect(d).toHaveAttribute("aria-label", "D major, bars 33–40, +2: up a whole step, playing now");
  await expect(d).toHaveAttribute("aria-current", "true");
  // The change is drawn as a mark and said in words over the strip, and the plan is one sentence under it.
  await expect(d.getByTestId("key-change-mark")).toBeVisible();
  await expect(d).toContainText("+2: up a whole step");
  await expect(lift.getByTestId("keystrip-status")).toHaveText(
    "Now in D major. C major, then D major from bar 33 (+2: up a whole step).",
  );
  // The mark is on the bar line of bar 33: 32/40 of the way along.
  const where = await strip.evaluate((el) => {
    const g = el.getBoundingClientRect();
    const m = el.querySelector('[data-testid="key-change-mark"]')?.getBoundingClientRect();
    return m ? (m.left - g.left) / g.width : -1;
  });
  expect(where).toBeGreaterThan(0.79);
  expect(where).toBeLessThan(0.81);

  // Keyboard: arrows move, Enter picks, Enter again lets go; the playhead moves the "now" key.
  await c.focus();
  await page.keyboard.press("ArrowRight");
  await expect(d).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(lift.getByTestId("keystrip-state")).toHaveText("Bar 33 · picked k33");
  await expect(d).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Home");
  await expect(c).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Space");
  await expect(lift.getByTestId("keystrip-state")).toHaveText("Bar 33 · nothing picked");
  await lift.getByRole("button", { name: "Move the playhead" }).click();
  await expect(lift.getByTestId("keystrip-state")).toContainText("Stopped");
  await expect(d).not.toHaveAttribute("aria-current", "true");
  await expect(lift.getByTestId("keystrip-status")).toHaveText(
    "C major, then D major from bar 33 (+2: up a whole step).",
  );
  await lift.getByRole("button", { name: "Move the playhead" }).click();
  await expect(c).toHaveAttribute("aria-current", "true");

  // A read-only strip takes focus to be read but picks nothing; a pickup counts from the first full bar; a
  // transposed player says what sounds; one key is one calm segment; no key is a sentence.
  const bridge = page.getByTestId("keystrip-bridge");
  await expect(bridge.getByRole("button")).toHaveCount(3);
  await expect(bridge.getByRole("button").nth(1)).not.toHaveAttribute("aria-pressed");
  await expect(bridge.getByTestId("keystrip-status")).toHaveText(
    "C major, then G major from bar 17 (a fifth up), then C major from bar 25 (a fourth up).",
  );
  const pickup = page.getByTestId("keystrip-pickup");
  await expect(pickup.getByRole("button").first()).toHaveAttribute(
    "aria-label",
    "G major, the pickup and bars 1–8, sounding A major",
  );
  await expect(pickup.getByRole("button").nth(1)).toHaveAttribute(
    "aria-label",
    "E minor, bars 9–16, the relative key, sounding F♯ minor",
  );
  await expect(page.getByTestId("keystrip-one").getByTestId("keystrip-status")).toHaveText(
    "A minor throughout.",
  );
  await expect(page.getByTestId("keystrip-one").getByTestId("key-change-mark")).toHaveCount(0);
  await expect(page.getByTestId("keystrip-empty")).toContainText("No key yet");
  // A key too narrow for its name prints it short, with the change as a figure; the words stay in its name.
  const short = page.getByTestId("keystrip-short");
  const dShort = short.locator('[data-key="D major"]');
  await expect(dShort).toHaveText("+1D");
  await expect(dShort).toHaveAttribute("aria-label", "D major, bars 17–20, +1: up a half step, playing now");
  await expect(dShort).toHaveAttribute("title", "D major · bars 17–20 · +1: up a half step");
});

test("the device counter counts against the rule and says each row's state in words", async ({ page }) => {
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await openGallery(page);
  const short = page.getByTestId("devices-short");
  await expect(short.getByTestId("device-count")).toHaveText("3 of 6 found · 4 needed");
  await expect(short.locator("[data-device-counter]")).toHaveAttribute("data-met", "false");
  await expect(short.locator('[data-state="found"]')).toHaveCount(3);
  await expect(short.locator('[data-state="open"]')).toHaveCount(3);
  const sec = short.locator('[data-device="secondary-dominant"]');
  await expect(sec).toContainText("In this song: bars 11 and 27");
  const sus = short.locator('[data-device="suspension"]');
  await expect(sus).toContainText("Not yet");
  await expect(sus).toContainText("Taught in U07.L05.");
  // An open row is quiet, not an error: it never uses the issue colour.
  const tones = await short.evaluate((el) => {
    const issue = getComputedStyle(document.documentElement).getPropertyValue("--oak-issue").trim();
    const probe = document.createElement("span");
    probe.style.color = issue;
    el.append(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return [...el.querySelectorAll('[data-state="open"] *')].filter((n) => getComputedStyle(n).color === rgb)
      .length;
  });
  expect(tones).toBe(0);
  // The row's action is reachable and works from the keyboard.
  const play = sec.getByRole("button", { name: "Play bar 11: Secondary dominant" });
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(short.getByTestId("devices-played")).toHaveText("Played secondary-dominant");

  const met = page.getByTestId("devices-met");
  await expect(met.getByTestId("device-count")).toHaveText("4 of 6 found, enough for the rule");
  await expect(met.locator("[data-device-counter]")).toHaveAttribute("data-met", "true");
  await expect(met.locator('[data-device="syncopated-bass"]')).toContainText("bars 9, 10, 13 and 3 more");
  await expect(page.getByTestId("devices-none").getByTestId("device-count")).toContainText(
    "0 of 6 · next session",
  );
  const roles = page.getByTestId("devices-count");
  await expect(roles.getByTestId("device-count")).toHaveText("3 of 4 found");
  await expect(roles.locator('[data-device="melody"]')).toContainText("No melody track yet");
});

test("the loudness read-out prints numbers and words for each state, and never a red zone", async ({
  page,
}) => {
  await useUiPrefs(page, { theme: "paper", motion: "off" });
  await openGallery(page);
  const main = page.getByTestId("loudness-main");
  await expect(main).toHaveAttribute("data-loudness", "read");
  await expect(main.getByTestId("loudness-peak")).toHaveText("−4.2 dB");
  await expect(main.getByTestId("loudness-reduction")).toHaveText("0.2 dB");
  await expect(main.getByTestId("loudness-limiter")).toHaveText("Resting");
  await expect(main.getByTestId("loudness-level")).toHaveText("−16.8 dB");
  await expect(main.getByTestId("loudness-lines")).toHaveText(
    "Loudest moment −4.2 dB before the limiter; limiter resting.",
  );
  const peak = main.getByRole("meter", { name: "Loudest moment before the limiter" });
  await expect(peak).toHaveAttribute("aria-valuenow", "-4.2");
  await expect(peak).toHaveAttribute(
    "aria-valuetext",
    "Loudest moment −4.2 dB before the limiter; limiter resting.",
  );
  await expect(main.getByTestId("loudness-over")).toHaveCount(0);

  // The switch is one radio group from the keyboard; each state says itself.
  const pick = page.getByTestId("loudness-switch").getByRole("radio", { name: "Resting" });
  await pick.focus();
  await page.keyboard.press("ArrowRight");
  await expect(main).toHaveAttribute("data-limiter", "touching");
  await expect(main.getByTestId("loudness-limiter")).toHaveText("Catching peaks");
  await expect(main.getByTestId("loudness-over")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(main.getByTestId("loudness-peak")).toHaveText("+2.4 dB");
  await expect(main.getByTestId("loudness-limiter")).toHaveText("Working steadily");
  await expect(main.getByTestId("loudness-lines")).toHaveText(
    "Loudest moment +2.4 dB before the limiter; limiter working most of the time, up to 5.3 dB off.",
  );
  // Calm: neither the issue colour nor the danger colour is used anywhere on the read-out, even when it works.
  const hot = await main.evaluate((el) => {
    const root = getComputedStyle(document.documentElement);
    const rgb = (v: string) => {
      const probe = document.createElement("span");
      probe.style.color = v;
      el.append(probe);
      const out = getComputedStyle(probe).color;
      probe.remove();
      return out;
    };
    const bad = [rgb(root.getPropertyValue("--oak-issue")), rgb(root.getPropertyValue("--oak-danger"))];
    return [...el.querySelectorAll("*")].filter((n) => {
      const s = getComputedStyle(n);
      return bad.includes(s.color) || bad.includes(s.backgroundColor);
    }).length;
  });
  expect(hot).toBe(0);

  // Measuring: the numbers are live and no summary sentence is printed; before a measurement, a sentence says how.
  await main.getByRole("button", { name: "Measure while it plays" }).click();
  await expect(main).toHaveAttribute("data-loudness", "live");
  await expect(main.getByTestId("loudness-live")).toHaveText("measuring");
  await expect(main.getByTestId("loudness-lines")).toHaveCount(0);
  await main.getByRole("button", { name: "Stop measuring" }).click();
  await expect(main).toHaveAttribute("data-loudness", "read");
  await page.getByTestId("loudness-switch").getByRole("radio", { name: "Nothing yet" }).click();
  await expect(main).toHaveAttribute("data-loudness", "empty");
  await expect(main.getByTestId("loudness-empty")).toContainText("Nothing measured yet.");
  await expect(main.getByRole("meter")).toHaveCount(0);
});

test("the album player bar plays, changes track and stops from the keyboard; a branch card never offers a way into nothing", async ({
  page,
}) => {
  await useUiPrefs(page, { theme: "bark", motion: "off" });
  await openGallery(page);
  const wrap = page.getByTestId("player-main");
  const bar = wrap.getByRole("group", { name: "Side A player" });
  await expect(bar).toHaveAttribute("data-player-state", "stopped");
  await expect(bar.getByTestId("player-now")).toHaveText(
    "12 tracks · 18:40. Plays from the first track to the last.",
  );
  await expect(bar.getByRole("button", { name: "Play Side A" })).toBeVisible();
  await expect(bar.getByTestId("player-prev")).toBeDisabled();
  // Space on the bar plays; the line reads as the ending's spec has it.
  await bar.focus();
  await page.keyboard.press("Space");
  await expect(bar).toHaveAttribute("data-player-state", "playing");
  await expect(bar.getByTestId("player-now")).toHaveText("1 of 12·Intro·0:00 / 0:24");
  await expect(bar.getByRole("button", { name: "Stop Side A" })).toBeVisible();
  await wrap.getByRole("button", { name: "Ten seconds on" }).click();
  await expect(bar.getByTestId("player-now")).toHaveText("1 of 12·Intro·0:10 / 0:24");
  await expect(bar.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
  await expect(bar.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "1 of 12 · Intro · 0:10 / 0:24",
  );
  // Arrows change track (no previous before the first); Escape stops.
  await bar.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(bar.getByTestId("player-now")).toContainText("1 of 12");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(bar.getByTestId("player-now")).toHaveText("3 of 12·Four-Chord Song·0:00 / 1:36");
  await bar.getByTestId("player-prev").focus();
  await page.keyboard.press("Enter");
  await expect(bar.getByTestId("player-now")).toContainText("2 of 12·First Loop");
  // Space on a focused button is that button's, not also the bar's (one action, not two).
  await bar.getByTestId("player-next").focus();
  await page.keyboard.press("Space");
  await expect(bar.getByTestId("player-now")).toContainText("3 of 12");
  // Escape on the bar stops (on a button whose tooltip is showing, the first Escape closes the tooltip).
  await bar.focus();
  await page.keyboard.press("Escape");
  await expect(bar).toHaveAttribute("data-player-state", "stopped");
  await expect(bar.getByRole("progressbar")).toHaveCount(0);
  // Nothing to play: the button says why and cannot be pressed.
  const none = page.getByTestId("player-none");
  await expect(none.getByTestId("player-toggle")).toBeDisabled();
  await expect(none.getByTestId("player-toggle")).toHaveAttribute(
    "aria-label",
    "Side A: No track has a recording yet. Record a take on a track's page.",
  );

  // Branch cards: the three states in words; an open track with nothing to start draws no way in even when its
  // owner passes one; a ready track does.
  const open = page.getByTestId("branch-open");
  await expect(open).toHaveAttribute("data-branch-state", "open");
  await expect(open).toHaveAttribute(
    "aria-label",
    "Jazz Harmony: open. Its first lessons are still being written.",
  );
  await expect(open.getByTestId("branch-state")).toHaveText("Opened today");
  await expect(open.getByTestId("branch-note")).toHaveText("Its first lessons are still being written.");
  await expect(page.getByTestId("branch-rows").getByTestId("branch-state").first()).toHaveText("Open");
  await expect(open.getByRole("button", { name: /Start/ })).toHaveCount(0);
  await expect(open.getByRole("button", { name: "See it on the Oak" })).toBeVisible();
  const locked = page.getByTestId("branch-locked");
  await expect(locked.getByTestId("branch-state")).toHaveText("Not open yet");
  await expect(locked.getByTestId("branch-note")).toHaveText("Opens with the unit 13 checkpoint.");
  await expect(locked.getByRole("button")).toHaveCount(0);
  const ready = page.getByTestId("branch-ready");
  await expect(ready.getByRole("button", { name: "Start A1.L03" })).toBeVisible();
  await expect(ready).toContainText("2 of 20 sessions");
  // Rows: the two unwritten tracks carry no control at all.
  const rows = page.getByTestId("branch-rows").locator("article");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).getByRole("button")).toHaveCount(0);
  await expect(rows.nth(1).getByRole("button")).toHaveCount(0);
  await expect(rows.nth(2).getByRole("button", { name: "Side lessons" })).toBeVisible();
});

test("reduced motion: the meter and the player's progress jump without a transition", async ({ page }) => {
  // `motion: "on"` forces reduced motion on (app/src/ui/theme/prefs.ts).
  await useUiPrefs(page, { theme: "paper", motion: "on" });
  await openGallery(page);
  await page.getByTestId("player-main").getByTestId("player-toggle").click();
  const durations = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '#kit-w6 [role="meter"] > div, #kit-w6 [role="progressbar"] > div',
      ),
    ].map((el) => getComputedStyle(el).transitionProperty),
  );
  expect(durations.length).toBeGreaterThanOrEqual(9);
  for (const d of durations) expect(d).toBe("none");
});
