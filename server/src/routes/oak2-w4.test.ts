// Oak 2.0 W4 wiring (plan Task 6 Step B3): the capstone check history and the Shelf's track patch answer through the
// full app (no longer the 501 stub) and refuse a foreign Host. Their behaviour is pinned in
// `services/check-history.test.ts` and `services/shelf-w4.test.ts`.
import { describe, expect, test } from "bun:test";
import type { AlbumTrackDetail, SketchSaved } from "@oak/api";
import { harness } from "../testing/harness.ts";

const FOREIGN = { host: "evil.example:8787" };

describe("Oak 2.0 W4 wiring", () => {
  test("the check history and the track patch answer through the full app, and refuse a foreign Host", async () => {
    const h = await harness();
    try {
      const history = await h.json<{ items: unknown[] }>("GET", "/api/capstones/C0/check-history");
      expect({ status: history.status, body: history.body }).toEqual({ status: 200, body: { items: [] } });

      const made = await h.json<SketchSaved>("POST", "/api/sketches", {
        sessionId: null,
        code: 'drums: s("bd ~ sd ~")',
        bpm: 90,
        meter: "4/4",
        key: null,
        analysis: null,
        note: null,
        tutorAssisted: false,
        band: null,
        flags: { lockedTools: [], previewTools: [] },
        ranOk: true,
        title: "Kept",
        originKind: "free",
        originId: null,
      });
      expect(made.status).toBe(200);
      const track = await h.json<AlbumTrackDetail>("POST", "/api/album/tracks", {
        capstoneId: null,
        side: "Bside",
        title: "Kept",
        flavour: null,
        sketchId: made.body.sketch.id,
        sketchVersion: 1,
        linerNotesMd: "",
        theoryTags: [],
        attribution: null,
      });
      expect(track.status).toBe(200);
      const path = `/api/album/tracks/${track.body.id}`;
      const shelved = await h.json<AlbumTrackDetail>("PATCH", path, { shelved: true });
      expect({ status: shelved.status, shelved: shelved.body.shelved }).toEqual({
        status: 200,
        shelved: true,
      });

      const foreignHistory = await h.json<{ error?: { code: string } }>(
        "GET",
        "/api/capstones/C0/check-history",
        undefined,
        FOREIGN,
      );
      const foreignPatch = await h.json<{ error?: { code: string } }>(
        "PATCH",
        path,
        { shelved: false },
        FOREIGN,
      );
      for (const r of [foreignHistory, foreignPatch])
        expect({ status: r.status, code: r.body?.error?.code }).toEqual({ status: 403, code: "forbidden" });
      // The foreign patch changed nothing.
      const after = await h.json<AlbumTrackDetail>("GET", path);
      expect(after.body.shelved).toBe(true);
    } finally {
      await h.close();
    }
  });
});
