// Oak 2.0 W1 starting points (Task 2) against the real server: Oak's Blank at a tempo the learner picks, drums and
// bass first (plays, no page error), plain start (four labelled lines), fill it all (one arrange() per part), from
// scraps (Studio's Scraps tab), "Make this my Blank" (tempo and sounds, never notes) then "Your Blank" first in the
// dialog, and Your templates (rename, delete asks first). Run only at the wave gate (W1 plan Task 9 Step B6).
import { expect, type Page, test } from "@playwright/test";
import { api, createSketch, openSketch, unlockFirstLessons, WB } from "./helpers.ts";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/\[eval\]|strudel/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function openNewSketch(page: Page) {
  await page.goto("/studio");
  await page.getByTestId("new-sketch").click();
  const dialog = page.getByRole("dialog", { name: "New sketch" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The editor's text (CodeMirror lines joined by newlines). */
async function editorText(page: Page): Promise<string> {
  return page
    .locator(".cm-content")
    .evaluate((el) => [...el.querySelectorAll(".cm-line")].map((l) => l.textContent ?? "").join("\n"));
}

type Template = { id: string; name: string; code: string; isBlank: boolean };

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await unlockFirstLessons(page);
  await page.close();
});

// Leave no Blank behind for the specs that run after this one.
test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  const list = await api<{ items: Template[] }>(page, "GET", "/templates");
  for (const t of list.body?.items ?? []) {
    if (t.isBlank) await api(page, "PATCH", `/templates/${t.id}`, { isBlank: false });
  }
  await page.close();
});

test("Oak's Blank writes the tempo the learner picks and no part", async ({ page }) => {
  const errors = watchErrors(page);
  const dialog = await openNewSketch(page);
  await dialog.getByRole("radio", { name: /Oak's Blank/ }).check();
  await expect(dialog).toContainText("A tempo line, nothing else. You choose the tempo.");
  const tempo = dialog.getByLabel("Tempo", { exact: true });
  await expect(tempo).toHaveValue("90");
  await tempo.fill("72");
  await dialog.getByRole("button", { name: "Create sketch" }).click();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  const text = await editorText(page);
  expect(text).toContain("setcpm(72/4)");
  expect(text).not.toMatch(/^\s*[A-Za-z_$][\w$]*\s*:/m);
  expect(errors).toEqual([]);
});

test("drums and bass first writes a drum line and a bass line, and Run plays", async ({ page }) => {
  const errors = watchErrors(page);
  const dialog = await openNewSketch(page);
  await dialog.getByRole("radio", { name: /Drums and bass first/ }).check();
  await dialog.getByRole("button", { name: "Create sketch" }).click();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  const text = await editorText(page);
  expect(text).toMatch(/^drums: s\("~"\)$/m);
  expect(text).toMatch(/^bass: note\("~"\)\.s\("[a-z0-9]+"\)$/m);
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.locator(WB)).toHaveAttribute("data-playing", "1", { timeout: 20_000 });
  await page.keyboard.press("ControlOrMeta+.");
  expect(errors).toEqual([]);
});

test("plain start writes four labelled lines", async ({ page }) => {
  const dialog = await openNewSketch(page);
  await dialog.getByRole("radio", { name: /Plain start/ }).check();
  await dialog.getByRole("button", { name: "Create sketch" }).click();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  const text = await editorText(page);
  for (const label of ["drums", "bass", "chords", "mel"])
    expect(text).toMatch(new RegExp(`^${label}: `, "m"));
  expect(text).toContain("// Plain sounds on purpose: make the sounds yours later.");
});

test("fill it all puts each of three parts in four sections", async ({ page }) => {
  await createSketch(
    page,
    "Three parts",
    'setcpm(96/4)\n\ndrums: s("bd ~ sd ~")\nbass: note("c2 ~ g1 ~").s("ebass")\nconst riff = "0 2 4"\nmel: n(riff).scale("C4:major").s("piano")\n',
  );
  const dialog = await openNewSketch(page);
  await dialog.getByRole("radio", { name: /Fill it all/ }).check();
  await dialog.getByLabel("Sketch", { exact: true }).selectOption({ label: "Three parts" });
  await expect(
    dialog.getByRole("radiogroup", { name: "Sections" }).getByRole("radio", { name: "4" }),
  ).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "Create sketch" }).click();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  const text = await editorText(page);
  expect(text.match(/\barrange\(/g)?.length).toBe(3);
  expect(text.match(/const riff\b/g)?.length).toBe(1);
});

test("from scraps lands on Studio's Scraps tab", async ({ page }) => {
  const dialog = await openNewSketch(page);
  await dialog.getByRole("radio", { name: /From scraps/ }).check();
  await dialog.getByRole("button", { name: "Open scraps" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/studio\?scraps=true/);
  await expect(page.getByRole("tab", { name: "Scraps" })).toHaveAttribute("aria-selected", "true");
});

test("make this my Blank keeps tempo and sounds, never notes; New sketch then starts from it", async ({
  page,
}) => {
  const id = await createSketch(
    page,
    "Notes inside",
    'setcpm(100/4)\n\ndrums: s("bd ~ sd ~")\nbass: note("c2 e2 g2 b1").s("ebass").lpf(600)\nmel: n("0 2 4 7").scale("C4:major").s("piano")\n',
    { bpm: 100 },
  );
  await openSketch(page, id);
  await page.getByRole("button", { name: "Starting point" }).click();
  await page.getByRole("menuitem", { name: "Make this my Blank" }).click();
  const save = page.getByRole("dialog", { name: "Make this my Blank" });
  await save.getByRole("button", { name: "Make it my Blank" }).click();
  await expect(save).toContainText("Your Blank starts like this:");
  const shown = (await save.getByTestId("template-code").textContent()) ?? "";
  expect(shown).toContain("setcpm(100/4)");
  const strings = [...shown.matchAll(/"([^"]*)"/g)].map((m) => m[1] as string);
  expect(strings.length).toBeGreaterThan(0);
  for (const s of strings) {
    // A sound name (ebass, piano) or a rest; never a note name, a degree or a rhythm.
    expect({ s, plain: s === "~" || /^[a-z]+$/i.test(s) }).toEqual({ s, plain: true });
    expect(["c2", "e2", "g2", "b1", "bd ~ sd ~", "0 2 4 7"]).not.toContain(s);
  }
  await save.getByRole("button", { name: "Done" }).click();

  const dialog = await openNewSketch(page);
  const first = dialog.getByRole("radio").first();
  await expect(first).toHaveAccessibleName(/Your Blank/);
  await expect(first).toBeChecked();
  await dialog.getByRole("button", { name: "Create sketch" }).click();
  await expect(page.locator(`${WB}[data-analysis=ready]`)).toBeVisible({ timeout: 60_000 });
  expect((await editorText(page)).trim()).toBe(shown.trim());
});

test("your templates: rename one, and delete it after the question", async ({ page }) => {
  const made = await api<Template>(page, "POST", "/templates", {
    name: "Rest kit",
    isBlank: false,
    fromSketch: null,
    code: 'setcpm(80/4)\n\ndrums: s("~")\n',
    bpm: 80,
    meter: "4/4",
  });
  expect(made.status).toBe(200);
  const dialog = await openNewSketch(page);
  await expect(dialog.getByRole("radio", { name: /Rest kit/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Your templates…" }).click();
  const manage = page.getByRole("dialog", { name: "Your templates" });
  const row = manage.getByTestId("my-template").filter({ hasText: "Rest kit" });
  await row.getByRole("button", { name: "Rename" }).click();
  // While renaming, the name is an input's value, not text, so `row` (filtered by text) no longer matches.
  await manage.getByLabel("Template name").fill("Quiet kit");
  await manage.getByRole("button", { name: "Save name" }).click();
  const renamed = manage.getByTestId("my-template").filter({ hasText: "Quiet kit" });
  await expect(renamed).toBeVisible();
  let asked = "";
  page.once("dialog", (d) => {
    asked = d.message();
    void d.accept();
  });
  await renamed.getByRole("button", { name: "Delete" }).click();
  await expect(renamed).toHaveCount(0);
  expect(asked).toContain("Delete the template “Quiet kit”?");
  const list = await api<{ items: Template[] }>(page, "GET", "/templates");
  expect(list.body.items.map((t) => t.name)).not.toContain("Quiet kit");
});
