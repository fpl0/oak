// Oak 2.0 W1 wiring (plan Task 9 Step B3): the W1 endpoints are mounted in the real app, and only the W3/W4 names
// still answer the typed 501.
import { describe, expect, test } from "bun:test";
import { harness } from "../testing/harness.ts";
import { OAK2_PENDING } from "./oak2.ts";

describe("Oak 2.0 W1 wiring", () => {
  test("OAK2_PENDING holds only the W3/W4 endpoints", () => {
    expect([...OAK2_PENDING]).toEqual([
      "sketches.lineage",
      "album.patchTrack",
      "habits.get",
      "catalogs.list",
      "catalogs.create",
      "capstones.checkHistory",
    ]);
  });

  test("scraps, templates and Later answer through the full app, and refuse a foreign Host", async () => {
    const h = await harness();
    try {
      for (const path of ["/api/scraps", "/api/templates", "/api/later"]) {
        const ok = await h.json<{ items: unknown[] }>("GET", path);
        expect({ path, status: ok.status, items: Array.isArray(ok.body.items) }).toEqual({
          path,
          status: 200,
          items: true,
        });
        const foreign = await h.json<{ error?: { code: string } }>("GET", path, undefined, {
          host: "evil.example:8787",
        });
        expect({ path, status: foreign.status, code: foreign.body?.error?.code }).toEqual({
          path,
          status: 403,
          code: "forbidden",
        });
      }
    } finally {
      await h.close();
    }
  });
});
