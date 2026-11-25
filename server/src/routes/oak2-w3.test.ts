// Oak 2.0 W3 wiring (plan Task 6 Step B3): lineage, habits and catalogs answer through the full app (no longer the
// 501 stub) and refuse a foreign Host.
import { describe, expect, test } from "bun:test";
import type { Habits, SketchLineage, SketchSaved } from "@oak/api";
import { harness } from "../testing/harness.ts";

const FOREIGN = { host: "evil.example:8787" };

describe("Oak 2.0 W3 wiring", () => {
  test("habits, catalogs and a sketch's lineage answer through the full app, and refuse a foreign Host", async () => {
    const h = await harness();
    try {
      const habits = await h.json<Habits>("GET", "/api/habits");
      expect({ status: habits.status, body: habits.body }).toEqual({
        status: 200,
        body: { sketches: 0, habits: [] },
      });

      const catalogs = await h.json<{ items: unknown[] }>("GET", "/api/catalogs");
      expect({ status: catalogs.status, items: Array.isArray(catalogs.body.items) }).toEqual({
        status: 200,
        items: true,
      });

      const made = await h.json<SketchSaved>("POST", "/api/sketches", {
        sessionId: null,
        code: 'drums: s("bd ~ sd ~")',
        bpm: 90,
        meter: "4/4",
        key: { tonic: "C", mode: "major" },
        analysis: null,
        note: null,
        tutorAssisted: false,
        band: null,
        flags: { lockedTools: [], previewTools: [] },
        ranOk: false,
        title: "Groove",
        originKind: "free",
        originId: null,
      });
      expect(made.status).toBe(200);
      const id = made.body.sketch.id;
      const lineage = await h.json<SketchLineage>("GET", `/api/sketches/${id}/lineage`);
      expect({ status: lineage.status, versions: lineage.body.versions.map((v) => v.version) }).toEqual({
        status: 200,
        versions: [1],
      });

      for (const path of ["/api/habits", "/api/catalogs", `/api/sketches/${id}/lineage`]) {
        const foreign = await h.json<{ error?: { code: string } }>("GET", path, undefined, FOREIGN);
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
