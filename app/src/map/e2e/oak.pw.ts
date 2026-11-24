// The Oak against the real server with the seeded progress fixture (U01.L04 next; R01 and E01 drying; R02/R03
// practising; R04 R05 R06 introduced): states, the what's-next path, the panel, keyboard travel, zoom,
// the Leaves table, the mini Oak, and screenshots in both themes at both sizes.
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { SCREENSHOT_MATRIX } from "../../../../e2e/support/stack.ts";
import { shoot, useUiPrefs } from "../../../../e2e/support/ui.ts";
import { treeNeighbour } from "../illustrated/navigation.ts";

const SHOTS = fileURLToPath(new URL("./screenshots", import.meta.url));
const leaf = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);

/** Every leaf's drawn centre, read from the page (`translate(cx cy)` on each `[data-node]`). */
async function drawnLeaves(page: Page) {
  const nodes = await page.locator("[data-node]").evaluateAll((els) =>
    els.map((el) => {
      const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(el.getAttribute("transform") ?? "");
      return { id: el.getAttribute("data-node") ?? "", cx: Number(m?.[1]), cy: Number(m?.[2]) };
    }),
  );
  return { nodes, byId: new Map(nodes.map((n) => [n.id, n])) } as unknown as Parameters<
    typeof treeNeighbour
  >[0];
}

async function openTree(page: Page, theme: "paper" | "bark" = "paper") {
  await useUiPrefs(page, { theme });
  await page.goto("/oak");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "The Oak" })).toBeVisible();
  await expect(page.locator("[data-node]")).toHaveCount(143);
}

test("leaves carry the server's states, and what's next is U01.L04", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openTree(page);
  await expect(leaf(page, "R01")).toHaveAttribute("data-status", "practising");
  await expect(leaf(page, "R02")).toHaveAttribute("data-status", "practising");
  await expect(leaf(page, "R06")).toHaveAttribute("data-status", "introduced");
  await expect(leaf(page, "P05")).toHaveAttribute("data-status", "locked");
  // U01.L04 introduces R05, fed by R03.
  await expect(leaf(page, "R05")).toHaveAttribute("data-next", "true");
  await expect(page.getByTestId("whats-next")).toContainText("U01.L04");
  // The illustrated tree draws a prerequisite path only for what's next (and the leaf being inspected).
  await expect(page.locator('[data-edge="R03>R05"]')).toHaveCount(1);
  // Drying only where the cards are in today's warm-up (fam.rhy.pulse is two weeks overdue).
  await expect(leaf(page, "R01").locator("[data-drying]")).toHaveCount(1);
  await expect(leaf(page, "R02").locator("[data-drying]")).toHaveCount(0);
  // Freshness shading: an overdue node is paler than one on schedule.
  const fill = async (id: string) =>
    Number(
      await leaf(page, id).locator("[data-leaf] > path[fill-opacity]").first().getAttribute("fill-opacity"),
    );
  expect(await fill("R01")).toBeLessThan(1);
  expect(await fill("R02")).toBe(1);
  // Toggling what's next removes the highlight.
  await page.getByTestId("whats-next-toggle").click();
  await expect(page.getByTestId("whats-next-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-edge="R03>R05"]')).toHaveCount(0);
  await expect(page.locator('[data-node][data-next="true"]')).toHaveCount(0);
  // No horizontal overflow at 1440.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("the panel explains a leaf and points at the right practice", async ({ page }) => {
  await openTree(page);
  await leaf(page, "R01").click();
  const panel = page.getByTestId("oak-panel");
  await expect(panel.getByRole("heading", { name: "Pulse & beat" })).toBeFocused();
  await expect(panel).toContainText("The steady beat under the music");
  await expect(panel).toContainText("U01.L01");
  await expect(panel.getByTestId("oak-evidence")).toContainText("Solid days");
  await expect(panel.getByTestId("practise-this")).toHaveAttribute("href", "/practice/fam.rhy.pulse");
  // Revive runs exactly this leaf's planned sets (contracts §7.10).
  await expect(panel.getByTestId("revive")).toHaveAttribute("href", "/session/revive?skill=R01");
  // Builds-on and leads-to chips move the selection.
  await panel.getByRole("button", { name: /R02 Tempo/ }).click();
  await expect(panel.getByRole("heading", { name: "Tempo / BPM" })).toBeVisible();
  // R02 has no drill family yet: practise goes to its (completed) lesson.
  await expect(panel.getByTestId("practise-this")).toHaveAttribute("href", "/learn/U01.L01?from=map");
  // A locked leaf says which lesson opens it, with no dead button.
  await leaf(page, "P05").click();
  await expect(panel).toContainText("Opens with the lesson “The White Keys”.");
  await expect(panel.getByTestId("practise-this")).toHaveCount(0);
  await expect(panel).toContainText("None yet");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(leaf(page, "P05")).toBeFocused();
});

test("keyboard only: arrows between leaves, Enter opens, Esc closes, N goes to what's next", async ({
  page,
}) => {
  await openTree(page);
  // Tab from the toolbar (and the Revive links under it) reaches the map's single tab stop: the first
  // what's-next leaf.
  const revive = page.getByTestId("revive-bar").getByRole("link");
  if ((await revive.count()) > 0) await revive.last().focus();
  else await page.getByRole("button", { name: "Show the whole map" }).focus();
  await page.keyboard.press("Tab");
  await expect(leaf(page, "R05")).toBeFocused();
  await expect(page.locator('[data-node][tabindex="0"]')).toHaveCount(1);
  // Arrows follow the tree's own geometry: the nearest leaf in a 90° cone (treeNeighbour over the drawn centres).
  const geometry = await drawnLeaves(page);
  const up = treeNeighbour(geometry, "R05", "up");
  expect(up).toBeTruthy();
  await page.keyboard.press("ArrowUp");
  // Focus moves on the next animation frame, so wait for it instead of reading it at once.
  await expect(leaf(page, up ?? "")).toBeFocused();
  const back = treeNeighbour(geometry, up ?? "", "down");
  await page.keyboard.press("ArrowDown");
  await expect(leaf(page, back ?? "")).toBeFocused();
  await leaf(page, "R05").focus();
  await page.keyboard.press("ArrowRight");
  await expect(leaf(page, "R05")).not.toBeFocused();
  const right = await page.evaluate(() => document.activeElement?.getAttribute("data-node"));
  expect(right).toBeTruthy();
  expect(right).not.toBe("R05");
  // The focus ring shows on the focused leaf.
  const ring = page.locator(`[data-node="${right}"] .illustrated-focus`);
  await expect(ring).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("oak-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("oak-panel")).toHaveCount(0);
  await expect(leaf(page, right ?? "")).toBeFocused();
  // Far away, then N comes back to what's next.
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("n");
  await expect(leaf(page, "R05")).toBeFocused();
});

test("zoom and fit: buttons and keys; the whole tree, the width, the pointer", async ({ page }) => {
  await openTree(page);
  const canvas = page.getByTestId("oak-canvas");
  const scale = async () => Number(await canvas.getAttribute("data-scale"));
  // The illustrated tree opens on the whole tree: the 1600×1000 drawing fitted into the canvas.
  const box0 = await canvas.boundingBox();
  if (!box0) throw new Error("no canvas");
  await expect.poll(scale).toBeCloseTo(Math.min(box0.width / 1600, box0.height / 1000), 2);
  const start = await scale();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(scale).toBeGreaterThan(start);
  await page.locator("body").press("0");
  await expect.poll(scale).toBeCloseTo(start, 2);
  await page.locator("body").press("w");
  await expect.poll(scale).toBeGreaterThan(start);
  await page.locator("body").press("0");
  await expect.poll(scale).toBeCloseTo(start, 2);
  // Ctrl + wheel zooms at the pointer; a plain wheel pans.
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect.poll(scale).toBeGreaterThan(start);
  // Drag pans without opening a leaf.
  await page.mouse.move(box.x + 30, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 40, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId("oak-panel")).toHaveCount(0);
});

test("leaves table sorts and links to the map", async ({ page }) => {
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/oak?view=leaves");
  const table = page.getByTestId("leaves-table");
  await expect(table.locator("tbody tr")).toHaveCount(143);
  await table.getByRole("button", { name: "Strength" }).click();
  await expect(table.getByRole("columnheader", { name: "Strength" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  const first = await table.locator("tbody tr").first().getAttribute("data-leaf-row");
  expect(["R01", "R02", "R03", "E01"]).toContain(first);
  await table.locator('tbody tr[data-leaf-row="R06"] a').click();
  await expect(page).toHaveURL(/view=tree.*leaf=R06|leaf=R06.*view=tree/);
  await expect(page.getByTestId("oak-panel").getByRole("heading", { name: "Rests" })).toBeVisible();
});

test("course view marks the next lesson", async ({ page }) => {
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/oak?view=course");
  await expect(page.getByText("next", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Heartbeat" })).toBeVisible();
});

test("reduced motion: nothing on the map animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTree(page);
  const animated = await page.evaluate(
    () =>
      [...document.querySelectorAll("[data-testid=oak-canvas] *")].filter((el) => {
        const s = getComputedStyle(el);
        const longest = (v: string) =>
          Math.max(...v.split(",").map((x) => Number.parseFloat(x) * (x.includes("ms") ? 1 : 1000)));
        return longest(s.transitionDuration) > 120 || longest(s.animationDuration) > 120;
      }).length,
  );
  expect(animated).toBe(0);
});

test("the mini Oak counts and links to the map", async ({ page }) => {
  await useUiPrefs(page, { theme: "paper" });
  await page.goto("/dev/glance");
  const glance = page.getByTestId("oak-glance").first();
  await expect(glance.locator("[data-dot]")).toHaveCount(143);
  await expect(glance).toContainText("4 of 143 leaves grown");
  await expect(glance.getByRole("link", { name: /Revive/ })).toBeVisible();
  await glance.getByRole("link", { name: /The Oak: 4 of 143/ }).click();
  await expect(page).toHaveURL(/\/oak/);
});

for (const m of SCREENSHOT_MATRIX) {
  test(`screenshots in ${m.theme} at ${m.width}x${m.height}`, async ({ page }) => {
    await page.setViewportSize({ width: m.width, height: m.height });
    await openTree(page, m.theme);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await shoot(page, SHOTS, "oak-tree", m.theme);
    await leaf(page, "R01").click();
    await expect(page.getByTestId("oak-panel")).toBeVisible();
    await shoot(page, SHOTS, "oak-panel", m.theme);
    await page.keyboard.press("Escape");
    await page.locator("body").press("0");
    await shoot(page, SHOTS, "oak-fit", m.theme);
    await page.goto("/oak?view=leaves");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("leaves-table")).toBeVisible();
    await shoot(page, SHOTS, "oak-leaves", m.theme);
    await page.goto("/dev/glance");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("oak-glance").first()).toBeVisible();
    await shoot(page, SHOTS, "oak-glance", m.theme);
  });
}
