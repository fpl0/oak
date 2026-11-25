// Oak 2.0 W1 (S1): scraps put together as one sketch keep every part and every const, and play.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SCRAP_SOURCE_KINDS, type Scrap } from "@oak/api";
import { initRealm } from "@oak/grader";
import { evalHeadless } from "@oak/grader/testing";
import { isDescriptive } from "../descriptive.ts";
import {
  INDEX_SCRAP_NOTE,
  lineScrapBody,
  MAX_SCRAPS_PER_SKETCH,
  REVIEW_SCRAP_NOTE,
  ROLE_FILTERS,
  scrapPlayCode,
  scrapSourceText,
  scrapsOfRole,
  sketchFromScraps,
} from "./model.ts";

setDefaultTimeout(60_000);
beforeAll(async () => {
  await initRealm({ toolbox: [], lockdown: false });
});

let n = 0;
function scrap(code: string, o: Partial<Scrap> = {}): Scrap {
  n++;
  return {
    id: `scr_${n}`,
    origin: "saved",
    role: null,
    label: null,
    code,
    bpm: 100,
    meter: "4/4",
    key: null,
    sourceKind: "lesson",
    sourceRef: "U01-L01/s1",
    sketchId: null,
    sketchVersion: null,
    createdAt: `2026-11-25T10:00:${String(n % 60).padStart(2, "0")}.000Z`,
    ...o,
  };
}

const tracksOf = async (code: string) => new Set((await evalHeadless(code, 1)).events.map((e) => e.track));

describe("sketchFromScraps", () => {
  test("two bass scraps become bass and bass2; both play", async () => {
    const body = sketchFromScraps(
      [scrap('bass: note("c2 ~ g1 ~").s("ebass")'), scrap('bass: note("~ e2 ~ d2").s("ebass")')],
      "Two basses",
      null,
    );
    expect(body.code).toContain('bass: note("c2 ~ g1 ~").s("ebass")');
    expect(body.code).toContain('bass2: note("~ e2 ~ d2").s("ebass")');
    const tracks = await tracksOf(body.code);
    expect(tracks.has("bass")).toBe(true);
    expect(tracks.has("bass2")).toBe(true);
  });

  test("a chord(changes) scrap brings its const", async () => {
    const body = sketchFromScraps(
      [scrap('const changes = "<C Am>"\nchords: chord(changes).voicing().s("piano")')],
      "Changes",
      null,
    );
    expect(body.code.match(/const changes/g)?.length).toBe(1);
    expect(body.code.indexOf("const changes")).toBeLessThan(body.code.indexOf("chords:"));
    expect((await tracksOf(body.code)).has("chords")).toBe(true);
  });

  test("two scraps with the same const name", async () => {
    const body = sketchFromScraps(
      [
        scrap('const groove = "x ~ x ~"\ndrums: s("bd").struct(groove)'),
        scrap('const groove = "~ x ~ x"\nperc: s("sd").struct(groove)'),
      ],
      "Grooves",
      null,
    );
    expect(body.code).toContain('const groove = "x ~ x ~"\ndrums: s("bd").struct(groove)');
    expect(body.code).toContain('const groove2 = "~ x ~ x"\nperc: s("sd").struct(groove2)');
    const r = await evalHeadless(body.code, 1);
    expect(r.events.filter((e) => e.track === "drums").map((e) => e.begin)).toEqual(["0", "1/2"]);
    expect(r.events.filter((e) => e.track === "perc").map((e) => e.begin)).toEqual(["1/4", "3/4"]);
  });

  test("a const name inside a string is not renamed", () => {
    const body = sketchFromScraps(
      [
        scrap('const bd = "x ~"\ndrums: s("bd").struct(bd)'),
        scrap('const bd = "~ x"\nkick: s("bd").struct(bd)'),
      ],
      "Kicks",
      null,
    );
    expect(body.code).toContain('const bd2 = "~ x"\nkick: s("bd").struct(bd2)');
  });

  test("tempo, meter and key come from the first pick", () => {
    const body = sketchFromScraps(
      [
        scrap('mel: n("0 2 4").scale("C4:major")', { bpm: 96, meter: "3/4", key: null }),
        scrap('bass: note("c2")', { bpm: 120, meter: "4/4", key: { tonic: "C", mode: "major" } }),
      ],
      "Waltz",
      "ses_1",
    );
    expect(body.code.startsWith("setcpm(96/3)\n")).toBe(true);
    expect(body.bpm).toBe(96);
    expect(body.meter).toBe("3/4");
    expect(body.key).toEqual({ tonic: "C", mode: "major" });
    expect(body.sessionId).toBe("ses_1");
    expect(body.note).toBe("From scraps");
    expect(body.originKind).toBe("free");
  });

  test("a scrap with no tempo plays at Oak's 90 in 4/4", () => {
    const body = sketchFromScraps([scrap('drums: s("bd*4")', { bpm: null, meter: null })], "Plain", null);
    expect(body.code.startsWith("setcpm(90/4)\n")).toBe(true);
  });

  test("0 or 5 picks throw RangeError", () => {
    expect(MAX_SCRAPS_PER_SKETCH).toBe(4);
    expect(() => sketchFromScraps([], "None", null)).toThrow(RangeError);
    const five = Array.from({ length: 5 }, () => scrap('drums: s("bd")'));
    expect(() => sketchFromScraps(five, "Five", null)).toThrow(RangeError);
  });

  test("a scrap to review makes a sketch to review", () => {
    const body = sketchFromScraps(
      [scrap('drums: s("bd")'), scrap('bass: note("c2")', { reviewBeforeRun: true })],
      "Imported",
      null,
    );
    expect(body.flags.reviewBeforeRun).toBe(true);
    const fresh = sketchFromScraps([scrap('drums: s("bd")')], "Fresh", null);
    expect(fresh.flags.reviewBeforeRun).toBeUndefined();
  });
});

describe("scraps for the panel", () => {
  test("lineScrapBody keeps the line's consts and names its role", () => {
    const code =
      'setcpm(100/4)\nconst changes = "<C Am>"\ndrums: s("bd*4")\nchords: chord(changes).voicing().s("piano")';
    const body = lineScrapBody({
      code,
      label: "chords",
      sourceKind: "lesson",
      sourceRef: "U03-L02/s4",
      bpm: 100,
      meter: "4/4",
      key: null,
    });
    expect(body).not.toBeNull();
    expect(body?.role).toBe("chords");
    expect(body?.label).toBe("chords");
    expect(body?.code).toBe('const changes = "<C Am>"\nchords: chord(changes).voicing().s("piano")');
    expect(body?.sourceRef).toBe("U03-L02/s4");
    expect(
      lineScrapBody({
        code,
        label: "pad",
        sourceKind: "lesson",
        sourceRef: "U03-L02/s4",
        bpm: 100,
        meter: "4/4",
        key: null,
      }),
    ).toBeNull();
  });

  test("scrapPlayCode puts the scrap's tempo first", () => {
    expect(scrapPlayCode({ code: 'drums: s("bd")', bpm: 120, meter: "3/4" })).toBe(
      'setcpm(120/3)\ndrums: s("bd")',
    );
  });

  test("scrapsOfRole filters by role, newest first", () => {
    const a = scrap('drums: s("bd")', { role: "drums", createdAt: "2026-11-01T00:00:00.000Z" });
    const b = scrap('bass: note("c2")', { role: "bass", createdAt: "2026-11-02T00:00:00.000Z" });
    const c = scrap('drums: s("sd")', { role: "drums", createdAt: "2026-11-03T00:00:00.000Z" });
    const d = scrap('fx: s("x")', { role: null, createdAt: "2026-11-04T00:00:00.000Z" });
    expect(scrapsOfRole([a, b, c, d], "drums").map((s) => s.id)).toEqual([c.id, a.id]);
    expect(scrapsOfRole([a, b, c, d], "all").map((s) => s.id)).toEqual([d.id, c.id, b.id, a.id]);
    expect(scrapsOfRole([a, b, c, d], "other").map((s) => s.id)).toEqual([d.id]);
  });

  test("every label the panel shows is descriptive", () => {
    const words: string[] = [INDEX_SCRAP_NOTE, REVIEW_SCRAP_NOTE, ...ROLE_FILTERS.map((f) => f.label)];
    for (const kind of SCRAP_SOURCE_KINDS) {
      words.push(scrapSourceText({ sourceKind: kind, sketchVersion: 3 }, "Groove"));
      words.push(scrapSourceText({ sourceKind: kind, sketchVersion: null }));
    }
    expect(scrapSourceText({ sourceKind: "sketch", sketchVersion: 3 }, "Groove")).toBe(
      "from your sketch “Groove” v3",
    );
    expect(scrapSourceText({ sourceKind: "hum", sketchVersion: null })).toBe("hummed");
    expect(scrapSourceText({ sourceKind: "tap", sketchVersion: null })).toBe("tapped");
    expect(scrapSourceText({ sourceKind: "memo", sketchVersion: null })).toBe("from a voice memo");
    expect(scrapSourceText({ sourceKind: "lesson", sketchVersion: null })).toBe("from a lesson");
    for (const w of words) expect(isDescriptive(w)).toBe(true);
  });
});
