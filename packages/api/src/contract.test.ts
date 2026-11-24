import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  buildPath,
  contract,
  ENDPOINT_NAMES,
  type EndpointDef,
  OAK2_ENDPOINTS,
  pathParams,
} from "./contract.ts";
import {
  CONFIRM_ACTIONS,
  DEFAULT_SETTINGS,
  ProfileSchema,
  SETTING_KEYS,
  SettingsSchema,
  toLearnerProfile,
} from "./dto.ts";
import { schemas } from "./index.ts";

const defs = ENDPOINT_NAMES.map((name) => [name, contract[name] as EndpointDef] as const);
const sig = (d: EndpointDef): string => `${d.method} ${d.path}`;

describe("the contract table", () => {
  test("no two endpoints share a method and path", () => {
    const seen = new Map<string, string>();
    for (const [name, def] of defs) {
      // Compare with parameter names erased: /x/:id and /x/:key would collide at the router.
      const key = `${def.method} ${def.path.replace(/:[A-Za-z0-9]+/g, ":")}`;
      expect([key, seen.get(key)]).toEqual([key, undefined]);
      seen.set(key, name);
    }
  });

  test("every :param in a path has a schema key, and the reverse", () => {
    for (const [name, def] of defs) {
      const inPath = pathParams(def.path).sort();
      const inSchema = def.params ? Object.keys(def.params.shape).sort() : [];
      expect([name, inPath]).toEqual([name, inSchema]);
    }
  });

  test("GET and DELETE carry no JSON body; POST/PUT/PATCH bodies are objects or binary", () => {
    for (const [name, def] of defs) {
      if (def.method === "GET" || def.method === "DELETE")
        expect([name, def.body]).toEqual([name, undefined]);
      else if (def.body && def.body !== "binary")
        expect([name, def.body instanceof z.ZodObject]).toEqual([name, true]);
    }
  });

  test("every endpoint of architecture §4.4 as amended by contracts §11.9 is present", () => {
    const have = new Set(defs.map(([, d]) => sig(d)));
    const required = [
      "GET /health",
      "GET /bootstrap",
      "PUT /settings/:key",
      "POST /settings/anthropic-key",
      "DELETE /settings/anthropic-key",
      "GET /profile",
      "PUT /profile",
      "POST /profile/calibration",
      "GET /session/today",
      "POST /session/start",
      "POST /session/:id/heartbeat",
      "POST /session/:id/end",
      "GET /lessons/progress",
      "POST /lessons/:id/steps/:stepId/attempts",
      "POST /lessons/:id/complete",
      "POST /checkpoints/:cpId/attempts",
      "GET /skills/map",
      "GET /srs/due",
      "POST /srs/review",
      "POST /drills/sessions",
      "POST /drills/sessions/:id/trials",
      "POST /drills/sessions/:id/finish",
      "GET /drills/difficulty/:familyId",
      "GET /unlocks",
      "POST /unlocks/:id/seen",
      "GET /cando",
      "GET /sketches",
      "POST /sketches",
      "GET /sketches/:id",
      "POST /sketches/:id/versions",
      "PATCH /sketches/:id",
      "DELETE /sketches/:id",
      "GET /album",
      "POST /album/tracks",
      "POST /album/tracks/:id/versions",
      "PUT /album/tracks/:id/versions/:v/audio",
      "GET /album/tracks/:id/versions/:v/audio",
      "DELETE /album/tracks/:id",
      "POST /audio",
      "GET /audio/:id",
      "PUT /audio/:id/peaks",
      "GET /audio/:id/peaks",
      "DELETE /audio/:id",
      "GET /transcriptions",
      "POST /transcriptions",
      "GET /transcriptions/:id",
      "PATCH /transcriptions/:id",
      "POST /transcriptions/:id/versions",
      "DELETE /transcriptions/:id",
      "POST /tutor/chat",
      "POST /tutor/hint",
      "POST /tutor/note",
      "POST /tutor/reviews/capstone",
      "POST /tutor/reviews/transcription",
      "POST /tutor/warm",
      "GET /tutor/usage",
      "POST /tutor/cards/:id/applied",
      "POST /tutor/notes/:id/retract",
      "POST /grade",
      "GET /backup/export",
      "POST /backup/import",
      "POST /confirm",
      "POST /data/reset",
      "POST /qa/reports",
      "GET /qa/reports",
      "GET /telemetry",
      "POST /telemetry/steps",
      "POST /gym/sessions",
      "GET /terms/introduced",
    ];
    expect(required.filter((r) => !have.has(r))).toEqual([]);
  });

  test("the Oak 2.0 endpoints of contracts §13 have their binding names and paths", () => {
    expect(Object.fromEntries(OAK2_ENDPOINTS.map((n) => [n, sig(contract[n])]))).toEqual({
      "scraps.list": "GET /scraps",
      "scraps.create": "POST /scraps",
      "scraps.delete": "DELETE /scraps/:id",
      "templates.list": "GET /templates",
      "templates.create": "POST /templates",
      "templates.patch": "PATCH /templates/:id",
      "templates.delete": "DELETE /templates/:id",
      "sketches.patchVersion": "PATCH /sketches/:id/versions/:version",
      "sketches.lineage": "GET /sketches/:id/lineage",
      "album.patchTrack": "PATCH /album/tracks/:id",
      "habits.get": "GET /habits",
      "later.list": "GET /later",
      "later.create": "POST /later",
      "later.patch": "PATCH /later/:id",
      "catalogs.list": "GET /catalogs",
      "catalogs.create": "POST /catalogs",
      "capstones.checkHistory": "GET /capstones/:id/check-history",
    });
  });

  test("Oak 2.0 bodies: a 1.x client's version still parses; takes, lineage, commits and the Shelf are optional", () => {
    const version = {
      sessionId: null,
      code: 'drums: s("bd sd")',
      bpm: 90,
      meter: "4/4",
      key: null,
      analysis: null,
      note: null,
      tutorAssisted: false,
      band: null,
      flags: { lockedTools: [], previewTools: [] },
      ranOk: true,
    };
    const add = contract["sketches.addVersion"].body;
    expect(add.safeParse(version).success).toBe(true);
    expect(
      add.safeParse({ ...version, takeState: null, parentVersion: 3, generation: 2, dimension: "rhythm" })
        .success,
    ).toBe(true);
    expect(add.safeParse({ ...version, dimension: "melody" }).success).toBe(false);
    expect(add.safeParse({ ...version, takeState: "deleted" }).success).toBe(false);
    expect(contract["sketches.patchVersion"].body.safeParse({ takeState: "cut" }).success).toBe(true);
    expect(contract["sketches.patchVersion"].body.safeParse({}).success).toBe(false);
    const patch = contract["sketches.patch"].body;
    expect(
      patch.safeParse({
        committed: [{ label: "bass", version: 4, at: "2026-11-24T10:00:00.000Z" }],
        cards: [{ cardId: "card.no-hats", drawnAt: "2026-11-24T10:00:00.000Z" }],
      }).success,
    ).toBe(true);
    expect(contract["album.patchTrack"].body.safeParse({ shelved: true }).success).toBe(true);
    expect(contract["album.patchTrack"].body.safeParse({ title: "x" }).success).toBe(false);
    // A 1.x server's sketch and track responses (no 2.0 fields) still parse.
    expect(
      contract["album.patchTrack"].res.safeParse({
        id: "trk_1",
        capstoneId: null,
        sketchId: "sk_1",
        side: "Bside",
        trackNo: 1,
        title: "B",
        flavour: null,
        currentVersion: 1,
        coverSeed: "c",
        createdAt: "2026-11-24T10:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  test("renamed or removed endpoints are gone (contracts §11.9)", () => {
    const paths = defs.map(([, d]) => d.path);
    for (const gone of ["/tutor/session-warm", "/tutor/listening-comment", "/checkpoints/:unitId/attempts"])
      expect(paths).not.toContain(gone);
    // Tutor threads and messages have no delete endpoint at all.
    expect(defs.filter(([, d]) => d.method === "DELETE" && d.path.startsWith("/tutor"))).toEqual([]);
  });

  test("the destructive endpoints of contracts §11.6 (seven, plus Oak 2.0's two) need a confirm nonce, and only they do", () => {
    const destructive = defs
      .filter(([, d]) => d.confirm)
      .map(([, d]) => `${sig(d)} → ${d.confirm}`)
      .sort();
    expect(destructive).toEqual(
      [
        "POST /backup/import → backup.import",
        "POST /data/reset → data.reset",
        "DELETE /sketches/:id → sketch.delete",
        "DELETE /album/tracks/:id → track.delete",
        "DELETE /audio/:id → audio.delete",
        "DELETE /transcriptions/:id → transcription.delete",
        "DELETE /settings/anthropic-key → anthropic-key.delete",
        // Oak 2.0 (contracts §13): every DELETE is destructive.
        "DELETE /scraps/:id → scrap.delete",
        "DELETE /templates/:id → template.delete",
      ].sort(),
    );
    // Wave 5: `confirmIf` actions need the nonce only when they replace something (album.audio.replace).
    expect(
      new Set(defs.flatMap(([, d]) => (d.confirm ? [d.confirm] : d.confirmIf ? [d.confirmIf] : []))),
    ).toEqual(new Set(CONFIRM_ACTIONS));
    // Every DELETE is destructive.
    expect(defs.filter(([, d]) => d.method === "DELETE" && !d.confirm)).toEqual([]);
  });

  test("the three media GETs of contracts §11.1 rule 4 are the only X-Oak exemptions", () => {
    expect(
      defs
        .filter(([, d]) => d.media)
        .map(([, d]) => sig(d))
        .sort(),
    ).toEqual(["GET /album/tracks/:id/versions/:v/audio", "GET /audio/:id", "GET /audio/:id/peaks"]);
  });

  test("dev endpoints live under /dev and are flagged", () => {
    for (const [name, def] of defs)
      expect([name, def.path.startsWith("/dev/")]).toEqual([name, def.dev === true]);
  });

  test("no response schema can carry an API key", () => {
    for (const [name, def] of defs) {
      if (def.res === "binary" || def.res === "sse") continue;
      const json = JSON.stringify(z.toJSONSchema(def.res, { unrepresentable: "any", io: "output" }));
      expect([name, /api[_-]?key|anthropicKey|"key":\{"type":"string"/i.test(json)]).toEqual([name, false]);
    }
  });
});

describe("paths", () => {
  test("buildPath fills parameters, encodes them and appends the query", () => {
    expect(buildPath(contract["steps.attempt"], { id: "U03.L02", stepId: "S5" })).toBe(
      "/api/lessons/U03.L02/steps/S5/attempts",
    );
    expect(buildPath(contract["checkpoints.attempt"], { cpId: "J.CP1" })).toBe(
      "/api/checkpoints/J.CP1/attempts",
    );
    expect(buildPath(contract["families.state"], { familyId: "fam.deg.fet-major" })).toBe(
      "/api/drills/difficulty/fam.deg.fet-major",
    );
    expect(buildPath(contract["sketches.get"], { id: "a/b c" })).toBe("/api/sketches/a%2Fb%20c");
    expect(buildPath(contract["srs.due"], {}, { budgetSec: "300", more: undefined })).toBe(
      "/api/srs/due?budgetSec=300",
    );
    expect(() => buildPath(contract["sketches.get"], {})).toThrow("missing path parameter");
  });
});

describe("DTOs", () => {
  test("settings: every key has a default that satisfies its schema; PUT validates per key", () => {
    expect(SettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(SETTING_KEYS.sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort() as typeof SETTING_KEYS);
    expect(SettingsSchema.shape.theme.safeParse("bark").success).toBe(true);
    expect(SettingsSchema.shape.theme.safeParse("dark").success).toBe(false);
    expect(
      SettingsSchema.shape.pausedWeeks.safeParse([
        "2026-11-09",
        "2026-11-16",
        "2026-11-23",
        "2026-11-30",
        "2026-12-07",
      ]).success,
    ).toBe(false);
    expect(DEFAULT_SETTINGS.tutor).toEqual({
      backend: "auto",
      softMonthlyUsd: 25,
      softWarnedMonth: null,
    });
    // The hard monthly cap is gone: a client may no longer send it.
    expect(
      SettingsSchema.shape.tutor.safeParse({ ...DEFAULT_SETTINGS.tutor, hardMonthlyUsd: 40 }).success,
    ).toBe(false);
  });

  const profile = ProfileSchema.parse({
    displayName: null,
    timezone: "Europe/Lisbon",
    rolloverHour: 4,
    targetMinutes: 20,
    weeklyGoal: 5,
    flavour: "flavour.pop",
    vocalLowMidi: null,
    vocalHighMidi: null,
    comfortLowMidi: null,
    comfortHighMidi: null,
    singToleranceCents: 70,
    singTolMode: "auto",
    outputLatencyMs: null,
    inputLatencyMs: null,
    singLatencyMs: null,
    tapLatencyMs: null,
    tapJitterMs: null,
    visualOffsetMs: 0,
    outputKind: "unknown",
    inputKind: "none",
    inputDeviceId: null,
    noiseFloorDb: null,
    quiet: false,
    solfege: "numbers",
    onboardedAt: null,
    createdAt: "2026-11-11T09:00:00.000Z",
  });

  test("a new profile starts at ±70¢ and converts to the grader's LearnerProfile", () => {
    expect(schemas.LearnerProfileSchema.parse(toLearnerProfile(profile))).toMatchObject({
      singTolCents: 70,
      rangeLow: 48,
      rangeHigh: 72,
      comfLow: 50,
      comfHigh: 70,
      tapLatencyMs: 0,
    });
    expect(ProfileSchema.safeParse({ ...profile, singToleranceCents: 60 }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...profile, weeklyGoal: 2 }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...profile, createdAt: "2026-11-11" }).success).toBe(false);
  });

  test("request bodies are strict; a step attempt carries a contract GradeResult", () => {
    const attempt = {
      sessionId: null,
      exerciseId: "rest-on-three",
      exerciseVersion: 1,
      seriesNo: 0,
      params: null,
      response: { code: 'drums: s("bd bd ~ bd")' },
      extraReplays: 0,
      activeMs: 42_000,
      tutorAssisted: false,
      result: {
        exerciseId: "U01.L02/rest-on-three",
        exerciseVersion: 1,
        attemptNo: 1,
        firstAttempt: true,
        mode: "lesson",
        status: "pass",
        score: 1,
        adjustedScore: 1,
        dims: { rhythm: { score: 1, weight: 1 } },
        constraints: [],
        diagnostics: [],
        messages: [],
        assist: { rung: 0, tutorHints: 0, extraReplays: 0, revealed: false },
      },
    };
    const body = contract["steps.attempt"].body;
    expect(body.safeParse(attempt).success).toBe(true);
    expect(body.safeParse({ ...attempt, hintRung: 0 }).success).toBe(false);
    expect(body.safeParse({ ...attempt, result: { ...attempt.result, status: "passed" } }).success).toBe(
      false,
    );
    expect(contract.confirm.body.safeParse({ action: "tutor.delete", target: "x" }).success).toBe(false);
  });
});

describe("adversarial: path parameters", () => {
  test("a dot-segment parameter is refused (it would resolve to another endpoint)", () => {
    for (const id of [".", "..", "%2e", "%2E%2e", ".%2E"])
      expect(() => buildPath(contract["sketches.delete"], { id })).toThrow("cannot be");
    // Dots inside an ID, and slashes, are encoded as usual.
    expect(buildPath(contract["sketches.delete"], { id: "a..b" })).toBe("/api/sketches/a..b");
    expect(buildPath(contract["sketches.delete"], { id: "../x" })).toBe("/api/sketches/..%2Fx");
    expect(new URL(`http://h${buildPath(contract["sketches.delete"], { id: "../x" })}`).pathname).toBe(
      "/api/sketches/..%2Fx",
    );
  });
});
