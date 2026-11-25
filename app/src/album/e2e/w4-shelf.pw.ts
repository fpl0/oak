// Oak 2.0 W4 F6 "Finish it anyway" and the Shelf (DeSantis, Fail Better) against the real server: a sketch with its
// drums in two sections and its bass not in sections shows "Finish it anyway…" in the editor header; Fill writes the
// bass into every section (`bassA`, `bassB`, a second `arrange(`); un-ticking drums in section 2 writes
// `silence /* drumsB */`; "Put it on the Shelf" with a title puts it under "The Shelf" on /album and on no side;
// "Put it on the album" moves it; Delete on another sketch first asks "Before you delete it: finish it anyway?" and
// "Delete it" reaches the existing confirm. Run only at the wave gate (W4 Task 6 B7), after stage B has registered
// the `finish-anyway` header slot, mounted `album.patchTrack` as built, and wired Delete/Archive through the dialog
// (Step B2).
import { expect, type Page, test } from "@playwright/test";
import { api, blockHmr, seed, watchErrors } from "./support.ts";

const HALF = [
  "setcpm(100/4)",
  "",
  'const drumsA = s("bd ~ sd ~")',
  'const drumsB = s("bd bd sd ~")',
  "drums: arrange([4, drumsA], [4, drumsB])",
  'bass: note("c2 ~ g1 ~").s("triangle")',
  "",
].join("\n");

const body = (title: string, code: string) => ({
  title,
  originKind: "free",
  originId: null,
  sessionId: null,
  code,
  bpm: 100,
  meter: "4/4",
  key: null,
  analysis: null,
  note: null,
  tutorAssisted: false,
  band: null,
  flags: { lockedTools: [], previewTools: [] },
  ranOk: false,
});

async function newSketch(page: Page, title: string, code: string): Promise<string> {
  const r = await api<{ sketch: { id: string } }>(page, "POST", "/sketches", body(title, code));
  expect(r.status).toBe(200);
  return r.body.sketch.id;
}

async function openSketch(page: Page, id: string): Promise<void> {
  await page.goto(`/studio/${id}`);
  await expect(page.locator("[data-testid=workbench][data-analysis=ready]")).toBeVisible({ timeout: 60_000 });
}

const editorText = (page: Page): Promise<string> =>
  page
    .locator(".cm-content")
    .first()
    .evaluate((el) => [...el.querySelectorAll(".cm-line")].map((l) => l.textContent ?? "").join("\n"));

test("a half-arranged sketch is finished anyway, carved and put on the Shelf; then on the album", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await blockHmr(page);
  await seed(page, "C0 ready");
  const errors = watchErrors(page);
  const id = await newSketch(page, "Half a song", HALF);
  await openSketch(page, id);

  await page.getByTestId("finish-anyway-open").click();
  const dialog = page.getByRole("dialog", { name: "Finish it anyway" });
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("finish-fill").click();
  await expect.poll(() => editorText(page)).toContain("bass: arrange([4, bassA], [4, bassB])");
  expect((await editorText(page)).match(/arrange\(/g)?.length).toBe(2);

  // Carve: the drums leave section 2.
  await dialog.getByTestId("carve-drums-1").uncheck();
  await expect.poll(() => editorText(page)).toContain("[4, silence /* drumsB */]");

  // Then the Shelf.
  await dialog.getByTestId("shelf-title").fill("Finished anyway");
  await dialog.getByTestId("shelve").click();
  await expect(dialog.getByTestId("finish-shelved")).toHaveText("Finished anyway");
  await dialog.getByRole("button", { name: "Close" }).last().click();

  await page.goto("/album");
  const shelf = page.getByTestId("the-shelf");
  await expect(shelf.getByRole("heading", { name: "The Shelf" })).toBeVisible({ timeout: 30_000 });
  await expect(shelf).toContainText("Finished anyway");
  await expect(page.locator("[data-side]").filter({ hasText: "Finished anyway" })).toHaveCount(0);

  await shelf.getByTestId("shelf-to-album").click();
  await expect(page.getByTestId("the-shelf")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator("[data-side=Bside]")).toContainText("Finished anyway");
  expect(errors).toEqual([]);
});

test("Delete first offers to finish it anyway; Delete it reaches the existing confirm", async ({ page }) => {
  test.setTimeout(120_000);
  await blockHmr(page);
  await seed(page, "C0 ready");
  const errors = watchErrors(page);
  const id = await newSketch(page, "Another start", HALF);
  await openSketch(page, id);
  const asked: string[] = [];
  page.on("dialog", (d) => {
    asked.push(d.message());
    void d.dismiss();
  });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const first = page.getByRole("dialog", { name: "Before you delete it: finish it anyway?" });
  await expect(first).toBeVisible();
  await first.getByTestId("finish-anyway-go-on").click();
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0]).toContain("Delete the sketch");
  // Dismissed: the sketch is still there.
  expect((await api(page, "GET", `/sketches/${id}`)).status).toBe(200);
  expect(errors).toEqual([]);
});
