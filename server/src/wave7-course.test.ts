// Wave 7 behaviour beyond the simulation (docs/design/wave7.md §5): the track checkpoints' coverage, the fixed order
// inside a track, the focus endpoint, a due core checkpoint that keeps the New block whatever the focus, the sounds
// that arrive when a capstone session starts (horns at RC1.S2, choir at AC2.S1), families and decks of the tracks for
// a learner already past their lessons (a content update), "learned at" per skill, AC1's tunes and two versions, the
// album's source for Export.
import { beforeAll, describe, expect, test } from "bun:test";
import {
  type CapstoneGate,
  type CapstoneSessions,
  type Session,
  type SessionPlan,
  type SessionSummary,
  type SkillMap,
  TRACK_CHECKPOINTS,
  type TrackFocus,
  type Unlock,
} from "@oak/api";
import type { CapstoneDef } from "@oak/content-kit";
import { trackOrder } from "../../content/syllabus.ts";
import { createServer } from "./app.ts";
import { testConfig } from "./config.ts";
import { ContentIndex } from "./content/index.ts";
import { loadContent } from "./content/loader.ts";
import type { ContentSource } from "./content/types.ts";
import { TRACK_ORDER } from "./services/track-plan.ts";
import { CatalogAdapter } from "./srs-wiring.ts";
import { CONTENT_DIR } from "./testing/course.ts";
import { gradeResult, type Harness, harness } from "./testing/harness.ts";
import { withJc4 } from "./testing/wave7.ts";

let real: ContentSource;
let full: ContentSource;
beforeAll(async () => {
  real = await loadContent({ contentDir: CONTENT_DIR });
  full = withJc4(real);
});

const NOW = "2026-11-15T12:00:00.000Z";

async function ok<T>(h: Harness, method: string, path: string, body?: unknown): Promise<T> {
  const r = await h.json<T>(method, path, body);
  if (r.status !== 200) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
async function seeded(point: string, content: ContentSource): Promise<Harness> {
  const h = await harness({ dev: true, content, now: NOW });
  await h.json("PUT", "/api/profile", { timezone: "UTC" });
  const r = await h.json<{ error?: { message: string } }>("POST", "/api/dev/seed", {
    point,
    practice: false,
  });
  if (r.status !== 200) throw new Error(`seed ${point}: ${r.status} ${JSON.stringify(r.body)}`);
  return h;
}
async function sketch(h: Harness, originId: string, sessionId: string, code = 's("bd ~ sd ~, hh*8")') {
  const r = await ok<{ sketch: { id: string; currentVersion: number } }>(h, "POST", "/api/sketches", {
    title: `${originId} draft`,
    originKind: "capstone",
    originId,
    sessionId,
    code,
    bpm: 96,
    meter: "4/4",
    key: null,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: { lockedTools: [], previewTools: [] },
    ranOk: true,
  });
  return r.sketch;
}
const PHASES = { warmup: 0, main: 600_000, make: 0, coda: 0 };

describe("the tracks' order and checkpoints (contracts §2.6, §7.6)", () => {
  test("each track checkpoint covers the lessons after the previous one up to its own last lesson", () => {
    const idx = new ContentIndex(real);
    expect(idx.lessonsCovered("J.CP1")).toEqual([
      "J1.L01",
      "J1.L02",
      "J1.L03",
      "J1.L04",
      "J1.L05",
      "J2.L01",
      "J2.L02",
      "J2.L03",
    ]);
    const cp2 = idx.lessonsCovered("J.CP2");
    expect(cp2[0]).toBe("J2.L04");
    expect(cp2.at(-1)).toBe("J5.L04");
    expect(cp2).not.toContain("J5.L05");
    expect(idx.lessonsCovered("R.CP").length).toBe(16); // 15 before Oak 2.0 W2 added R1.L06
    expect(idx.lessonsCovered("A.CP")).toEqual(idx.trackLessons("A"));
    for (const cp of TRACK_CHECKPOINTS) expect(idx.lessonsCovered(cp.cpId).at(-1)).toBe(cp.afterLesson);
  });

  test("the planner's track order is the syllabus's", () => {
    expect(TRACK_ORDER).toEqual(trackOrder as unknown as typeof TRACK_ORDER);
  });
});

describe("tracks.focus (wave7.md §5.2)", () => {
  test("never chosen is the core; a choice is kept with its instant; the same choice again changes nothing", async () => {
    const h = await harness({ dev: true, now: NOW });
    try {
      expect(await ok<TrackFocus>(h, "GET", "/api/tracks/focus")).toEqual({ focus: "core", chosenAt: null });
      const a = await ok<TrackFocus>(h, "PUT", "/api/tracks/focus", { focus: "R" });
      expect(a).toEqual({ focus: "R", chosenAt: NOW });
      h.clock.advanceDays(1);
      expect(await ok<TrackFocus>(h, "PUT", "/api/tracks/focus", { focus: "R" })).toEqual(a);
      expect((await h.json("PUT", "/api/tracks/focus", { focus: "X" })).status).toBe(400);
      expect((await h.json("PUT", "/api/tracks/focus", { focus: "J", extra: 1 })).status).toBe(400);
      const b = await ok<TrackFocus>(h, "PUT", "/api/tracks/focus", { focus: "core" });
      expect(b.focus).toBe("core");
      expect(b.chosenAt).not.toBe(a.chosenAt);
    } finally {
      await h.close();
    }
  });

  test("a due core checkpoint stays the New block whatever the focus; the track is offered beside it", async () => {
    const h = await seeded("U14.CP due", full);
    try {
      await ok(h, "PUT", "/api/tracks/focus", { focus: "J" });
      const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
      expect({ kind: plan.kind, id: plan.mapItemId as string | null }).toEqual({
        kind: "checkpoint",
        id: "U14.CP",
      });
      expect(plan.track ?? null).toBeNull();
      expect(plan.focus).toBe("J");
      const j = (plan.trackOffers ?? []).find((o) => o.trackId === "J");
      if (full.lessons.some((l) => l.id === "J1.L01")) expect(j?.next.mapItemId).toBe("J1.L01");
      // The core map is not moved by the focus: the progress still counts the core's own order first.
      const summaryNext = await ok<{ items: unknown[] }>(h, "GET", "/api/tracks");
      expect(summaryNext.items.length).toBe(3);
    } finally {
      await h.close();
    }
  }, 120_000);
});

describe("sounds that arrive when a capstone session starts (contracts §3.2 rule 11; wave7.md §5.4)", () => {
  test("horns at RC1.S2's start for a learner without them; choir at AC2.S1's start", async () => {
    const h = await seeded("RC1 open", full);
    try {
      const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
      expect(plan.mapItemId).toBe("RC1.S1");
      const s1 = await ok<Session>(h, "POST", "/api/session/start", {
        kind: "capstone",
        mapItemId: "RC1.S1",
        targetMinutes: 20,
      });
      const sk = await sketch(h, "RC1", s1.id);
      await ok<CapstoneSessions>(h, "POST", "/api/capstones/RC1/drafts", {
        capstoneSessionId: "RC1.S1",
        sessionId: s1.id,
        sketchId: sk.id,
        sketchVersion: sk.currentVersion,
      });
      await ok(h, "POST", "/api/capstones/RC1/sessions", {
        sessionId: s1.id,
        capstoneSessionId: "RC1.S1",
        sketchId: sk.id,
        flavour: null,
      });
      const end1 = await ok<SessionSummary>(h, "POST", `/api/session/${s1.id}/end`, {
        wrappedEarly: false,
        phaseMs: PHASES,
      });
      expect(end1.unlocks.some((u) => u.itemId === "snd.horns")).toBe(false);
      expect(end1.next?.mapItemId).toBe("RC1.S2");
      h.clock.advanceDays(1);
      const s2 = await ok<Session>(h, "POST", "/api/session/start", {
        kind: "capstone",
        mapItemId: "RC1.S2",
        targetMinutes: 20,
      });
      const horns = (await ok<{ items: Unlock[] }>(h, "GET", "/api/unlocks")).items.find(
        (u) => u.itemId === "snd.horns",
      );
      expect({ sourceKind: horns?.sourceKind, sourceId: horns?.sourceId }).toEqual({
        sourceKind: "session-start",
        sourceId: "RC1.S2",
      });
      const end2 = await ok<SessionSummary>(h, "POST", `/api/session/${s2.id}/end`, {
        wrappedEarly: false,
        phaseMs: PHASES,
      });
      expect(end2.unlocks.map((u) => u.itemId)).toContain("snd.horns");
    } finally {
      await h.close();
    }
    const a = await seeded("AC2 open", full);
    try {
      const plan = await ok<SessionPlan>(a, "GET", "/api/session/today");
      expect(plan.mapItemId).toBe("AC2.S1");
      const s = await ok<Session>(a, "POST", "/api/session/start", {
        kind: "capstone",
        mapItemId: "AC2.S1",
        targetMinutes: 20,
      });
      const end = await ok<SessionSummary>(a, "POST", `/api/session/${s.id}/end`, {
        wrappedEarly: false,
        phaseMs: PHASES,
      });
      expect(end.unlocks.map((u) => u.itemId)).toContain("snd.choir");
    } finally {
      await a.close();
    }
  }, 240_000);
});

describe("a learner already past a track lesson when its families and decks arrive (a content update)", () => {
  test("the families are seeded at start-up, the decks' cards open, and nothing seeded twice", async () => {
    const trackFamily = (id: string) => /^fam\.(jzz|rhy\.(clave|odd|poly)|snd)\./.test(id);
    const older: ContentSource = {
      ...full,
      families: full.families.filter((f) => !trackFamily(f.id)),
      decks: full.decks.filter((d) => !/^deck\.(jzz|rhy|snd)\./.test(d.id)),
    };
    const h = await seeded("J4.L03 next", older);
    try {
      expect(h.server.deps.repos.srs.card("fam.jzz.ii-v")).toBeNull();
      await h.server.close();
      const server = await createServer({
        tutor: false,
        validateResponses: true,
        env: {},
        log: () => {},
        config: testConfig(h.dir, { dev: true }),
        content: full,
        graders: { learner: () => h.learner, tutor: () => h.tutorHost },
        clock: h.clock,
      });
      (h as { server: typeof server }).server = server;
      const repos = server.deps.repos;
      // J1.L03–J2.L04 are behind the learner: their families now have cards; R and A's do not (not reached).
      for (const id of ["fam.jzz.ii-v", "fam.jzz.guide", "fam.jzz.voicing", "fam.jzz.extension"])
        if (full.families.some((f) => f.id === id))
          expect({ id, seeded: repos.srs.card(id) !== null }).toEqual({ id, seeded: true });
      expect(repos.srs.card("fam.rhy.clave")).toBeNull();
      const again = await server.deps.srs()?.backfillFamilies?.();
      expect(again).toEqual([]);
      // The decks: every card of a deck whose lesson is completed is open to be introduced (newPerDay a day).
      const open = new CatalogAdapter(server.deps.content, server.deps.services)
        .openDeckCards()
        .map((c) => c.deckId);
      for (const deck of ["deck.jzz.symbols", "deck.jzz.ii-v", "deck.jzz.voicings", "deck.jzz.tensions"])
        if (full.decks.some((d) => d.id === deck))
          expect({ deck, open: open.includes(deck) }).toEqual({ deck, open: true });
      expect(open).not.toContain("deck.jzz.subs");
    } finally {
      await h.close();
    }
  }, 180_000);
});

describe("“learned at” per skill (carry f1; wave7.md §5.6)", () => {
  test("introducedAt is the introducing lesson's first evidence, null before, and survives a backup round trip", async () => {
    const h = await seeded("J1.L03 next", full);
    try {
      const map = await ok<SkillMap>(h, "GET", "/api/skills/map");
      const node = (id: string) => map.nodes.find((n) => n.skillId === id);
      const j01 = node("J01");
      const done = h.server.deps.repos.lessons.progress("J1.L02")?.completedAt ?? null;
      expect(j01?.introducedAt ?? null).not.toBeNull();
      expect((j01?.introducedAt ?? "") <= (done ?? "")).toBe(true);
      expect(node("J13")?.introducedAt ?? null).toBeNull();
      // The core's first skill was introduced long ago and is never moved by later evidence.
      const r02 = node("R02")?.introducedAt ?? null;
      expect(r02 !== null && r02 < (j01?.introducedAt ?? "")).toBe(true);
      const exp = await h.req("GET", "/api/backup/export");
      const fresh = await harness({ dev: true, content: full, now: h.clock.now().toISOString() });
      try {
        const imp = await fresh.destructive(
          "POST",
          "/api/backup/import",
          "backup.import",
          "*",
          new Uint8Array(await exp.arrayBuffer()),
        );
        expect(imp.status).toBe(200);
        const after = await ok<SkillMap>(fresh, "GET", "/api/skills/map");
        expect(after.nodes.map((n) => [n.skillId, n.introducedAt])).toEqual(
          map.nodes.map((n) => [n.skillId, n.introducedAt]),
        );
      } finally {
        await fresh.close();
      }
    } finally {
      await h.close();
    }
  }, 180_000);
});

describe("AC1: its tunes and its two versions (wave7.md §5.3, §5.4)", () => {
  test("only written tunes are listed, each open on its own condition; both versions released as one track", async () => {
    const versions = [
      { id: "a", label: "Version one", startsIn: "AC1.S1" },
      { id: "b", label: "Version two", startsIn: "AC1.S2" },
    ];
    const withVersions: ContentSource = {
      ...full,
      capstones: full.capstones.map((c) =>
        c.id === "AC1" && c.versions === undefined ? ({ ...c, versions } as CapstoneDef) : c,
      ),
    };
    const h = await seeded("AC1.S2 done", withVersions);
    try {
      const gate = await ok<CapstoneGate>(h, "GET", "/api/capstones/AC1/gate");
      const written = new Set(full.songs.map((s) => s.id as string));
      expect((gate.tunes ?? []).every((t) => written.has(t.songId))).toBe(true);
      const sgb = gate.tunes?.find((t) => t.songId === "song.sweet-georgia-brown");
      if (written.has("song.sweet-georgia-brown")) expect(sgb).toMatchObject({ open: true, reason: null });
      const ss = await ok<CapstoneSessions>(h, "GET", "/api/capstones/AC1/sessions");
      expect(ss.versions?.map((v) => [v.id, v.draft !== null])).toEqual([
        ["a", true],
        ["b", true],
      ]);
      const [a, b] = ss.versions ?? [];
      const code = (sk: { sketchId: string; sketchVersion: number } | null | undefined) =>
        h.server.deps.repos.sketches.version(sk?.sketchId ?? "", sk?.sketchVersion ?? 0)?.code ?? "";
      expect(code(a?.draft)).not.toBe(code(b?.draft));
      // The release (AC1.S3): one album track holding version one and version two.
      const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
      expect(plan.mapItemId).toBe("AC1.S3");
      const s = await ok<Session>(h, "POST", "/api/session/start", {
        kind: "capstone",
        mapItemId: "AC1.S3",
        targetMinutes: 20,
      });
      const draft = b?.draft as { sketchId: string; sketchVersion: number };
      await ok(h, "POST", "/api/capstones/AC1/checks", {
        sessionId: s.id,
        sketchId: draft.sketchId,
        sketchVersion: draft.sketchVersion,
        result: (await import("./testing/harness.ts")).gradeResult({
          exerciseId: "AC1/brief",
          score: 0.95,
          mode: "capstone",
        }),
      });
      const rel = await ok<{
        track: { id: string; side: string; versions: { version: number; sketchVersion: number }[] };
      }>(h, "POST", "/api/capstones/AC1/release", {
        sessionId: s.id,
        sketchId: draft.sketchId,
        sketchVersion: draft.sketchVersion,
        title: "One Tune, Two Genres",
        flavour: null,
        linerNotesMd: "Two versions.",
        theoryTags: [],
        includeReviewNote: false,
      });
      expect(rel.track.side).toBe("B");
      expect(rel.track.versions.map((v) => v.sketchVersion as number | undefined)).toEqual([
        a?.draft?.sketchVersion,
        b?.draft?.sketchVersion,
      ]);
      const src1 = await ok<{ code: string; fileName: string }>(
        h,
        "GET",
        `/api/album/tracks/${rel.track.id}/versions/1/source`,
      );
      expect(src1.code).toBe(code(a?.draft));
      expect(src1.fileName).toMatch(/^oak-side-b-\d{2}-one-tune-two-genres-v1$/);
      expect((await h.json("GET", `/api/album/tracks/${rel.track.id}/versions/3/source`)).status).toBe(404);
      expect((await h.json("GET", "/api/album/tracks/nope/versions/1/source")).status).toBe(404);
    } finally {
      await h.close();
    }
  }, 180_000);
});

describe("a gym session after the core keeps the source it served (the transcribe engineer's request)", () => {
  test("the source is stored, listed in the gym's history, refused when malformed, and survives backup → import", async () => {
    const h = await harness({ dev: true, content: real, now: NOW });
    const fresh = await harness({ dev: true, content: real, now: NOW });
    try {
      const a = await h.json<{ gymId: string; source?: string }>("POST", "/api/gym/sessions", {
        sessionId: null,
        kind: "ladder",
        transcriptionId: null,
        source: "jazz:rhythm-changes:Bb",
      });
      expect(a.status).toBe(200);
      expect(a.body.source).toBe("jazz:rhythm-changes:Bb");
      // A session that names none is recorded as before (no source), and a malformed one is refused.
      const b = await h.json<{ gymId: string; source?: string }>("POST", "/api/gym/sessions", {
        sessionId: null,
        kind: "own-audio",
        transcriptionId: null,
      });
      expect(b.body.source).toBeUndefined();
      for (const source of ["", "youtube:abc", "song:x y", "own:<script>"])
        expect(
          (
            await h.json("POST", "/api/gym/sessions", {
              sessionId: null,
              kind: "ladder",
              transcriptionId: null,
              source,
            })
          ).status,
        ).toBe(400);
      const history = (await ok<{ history: { gymId: string; source?: string }[] }>(h, "GET", "/api/gym"))
        .history;
      expect(history.map((g) => [g.gymId, g.source ?? null])).toEqual([
        ["GYM.01", "jazz:rhythm-changes:Bb"],
        ["GYM.02", null],
      ]);
      const exp = await h.req("GET", "/api/backup/export");
      const archive = new Uint8Array(await exp.arrayBuffer());
      expect(
        (await fresh.destructive("POST", "/api/backup/import", "backup.import", "*", archive)).status,
      ).toBe(200);
      const after = (await ok<{ history: { gymId: string; source?: string }[] }>(fresh, "GET", "/api/gym"))
        .history;
      expect(after.map((g) => [g.gymId, g.source ?? null])).toEqual(
        history.map((g) => [g.gymId, g.source ?? null]),
      );
    } finally {
      await h.close();
      await fresh.close();
    }
  }, 60_000);
});

describe("a two-lane tap answer (tap.lanes: R2.L04, R.CP's polyrhythm items)", () => {
  test("is accepted as a step attempt and refused by the server grader like any tap", async () => {
    const h = await harness({ dev: true, content: real, now: NOW });
    try {
      // A learner past the core: every core lesson is open to replay.
      expect(
        (await h.json("POST", "/api/dev/seed", { point: "core complete, tracks untouched", practice: false }))
          .status,
      ).toBe(200);
      const lesson = real.lessons.find(
        (l) => /^U\d/.test(l.id) && l.steps.some((s) => s.exercise?.kind === "tap"),
      );
      const step = lesson?.steps.find((s) => s.exercise?.kind === "tap");
      const ex = step?.exercise;
      expect(ex).toBeDefined();
      const exerciseId = `${lesson?.id}/${ex?.id}`;
      const lanes = {
        lanes: [
          [0, 0.5, 1, 1.5],
          [0, 1 / 3, 2 / 3, 1, 4 / 3, 5 / 3],
        ],
      };
      const graded = await h.json<{ error?: { message: string } }>("POST", "/api/grade", {
        exerciseId,
        response: lanes,
        params: null,
        mode: "lesson",
      });
      expect(graded.status).toBe(400);
      expect(graded.body.error?.message).toContain("graded in the browser");
      const attempt = await h.json("POST", `/api/lessons/${lesson?.id}/steps/${step?.id}/attempts`, {
        sessionId: null,
        exerciseId: ex?.id,
        exerciseVersion: ex?.version,
        seriesNo: 0,
        params: null,
        response: lanes,
        result: gradeResult({ exerciseId, score: 1 }),
        extraReplays: 0,
        activeMs: 1000,
        tutorAssisted: false,
      });
      expect(attempt.status).toBe(200);
      // One lane is not a two-hand answer.
      const one = await h.json("POST", `/api/lessons/${lesson?.id}/steps/${step?.id}/attempts`, {
        sessionId: null,
        exerciseId: ex?.id,
        exerciseVersion: ex?.version,
        seriesNo: 0,
        params: null,
        response: { lanes: [[0, 0.5]] },
        result: gradeResult({ exerciseId, score: 1 }),
        extraReplays: 0,
        activeMs: 1000,
        tutorAssisted: false,
      });
      expect(one.status).toBe(400);
    } finally {
      await h.close();
    }
  }, 60_000);
});

describe("sung checkpoint items never gate (contracts §7.6, §8.5; wave 7 closer)", () => {
  interface CpItem {
    idx: number;
    skillId: string;
    role: "gating" | "level-setting";
    source: { kind: string; familyId?: string };
  }
  test("J.CP1's guide-tone items are sung: level-setting, left out in Quiet mode; skipping them still passes", async () => {
    for (const quiet of [false, true]) {
      const h = await seeded("J.CP1 due", real);
      try {
        if (quiet) await h.json("PUT", "/api/voice/quiet", { quiet: true, scope: "always" });
        const start = await ok<{ attemptNo: number; items: CpItem[] }>(
          h,
          "POST",
          "/api/checkpoints/J.CP1/start",
        );
        const sung = start.items.filter((i) => i.source.familyId === "fam.jzz.guide");
        if (quiet) expect(sung).toEqual([]);
        else {
          expect(sung.length).toBeGreaterThan(0);
          expect(sung.every((i) => i.role === "level-setting")).toBe(true);
        }
        // Every item right except the sung ones, which are skipped (a learner who does not sing today).
        const out = await ok<{ passed: boolean }>(h, "POST", "/api/checkpoints/J.CP1/attempts", {
          sessionId: null,
          attemptNo: start.attemptNo,
          items: start.items.map((i) => {
            const skipped = i.source.familyId === "fam.jzz.guide";
            return { idx: i.idx, score: skipped ? 0 : 1, skipped, response: { code: "" }, result: null };
          }),
          makeSketchId: null,
          acceptSoftPass: false,
        });
        expect([quiet, out.passed]).toEqual([quiet, true]);
      } finally {
        await h.close();
      }
    }
  }, 120_000);
});

describe("a locked track capstone names its checkpoint as Today does (W7 gate)", () => {
  test("the server's lockedReason uses the same words as Today and Progress", async () => {
    const h = await seeded("J1.L03 next", full);
    for (const [id, words] of [
      ["JC1", "Opens after the first jazz checkpoint."],
      ["JC3", "Opens after the second jazz checkpoint."],
      ["RC1", "Opens after the rhythm checkpoint."],
      ["AC1", "Opens after the sound checkpoint."],
    ] as const) {
      const r = await ok<{ status: string; lockedReason: string | null }>(h, "GET", `/api/capstones/${id}`);
      expect(r.status).toBe("locked");
      expect(r.lockedReason).toBe(words);
    }
  });
});
