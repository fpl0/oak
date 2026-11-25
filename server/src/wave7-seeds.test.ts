// The Wave 7 dev seeds (docs/design/wave7.md §6) on the real course: every point seeds a learner whose Today is what
// the point promises (or, while that track session is still being written, the honest day the planner makes of it),
// with the focus, the unlocks, the capstones and the album the point names. JC4 needs a 1930 standard with an answer
// key: with the real content alone a point that walks JC4 answers 400 naming the songs until author:repertoire writes
// one; with a test rendition (testing/wave7.ts) every point is checked. Points are built with `practice: false` (no
// warm-ups: the New block does not depend on them) apart from the three that other areas use most, built as e2e does.
import { beforeAll, describe, expect, test } from "bun:test";
import {
  type Album,
  type CapstoneGate,
  type CapstoneSessions,
  type CourseProgress,
  type DevSeedResult,
  type SessionPlan,
  type SessionSummary,
  type TrackFocus,
  type Tracks,
  type Unlock,
  WAVE7_SEED_POINTS,
  type WholeCourse,
} from "@oak/api";
import { loadContent } from "./content/loader.ts";
import type { ContentSource } from "./content/types.ts";
import { CONTENT_DIR } from "./testing/course.ts";
import { type Harness, harness } from "./testing/harness.ts";
import { withJc4 } from "./testing/wave7.ts";

let real: ContentSource;
let full: ContentSource;
beforeAll(async () => {
  real = await loadContent({ contentDir: CONTENT_DIR });
  full = withJc4(real);
});

const NOW = "2026-11-15T12:00:00.000Z";
const FALLBACK = "Nothing of the track you chose can be started today: the core's next session instead.";

/** What Today's New block is after each point (wave7.md §6), and the focus it records. */
const TODAY: Record<string, { kind: SessionPlan["kind"]; id: string | null; focus: TrackFocus["focus"] }> = {
  "core complete, tracks untouched": { kind: "review", id: null, focus: "core" },
  "J1.L03 next": { kind: "lesson", id: "J1.L03", focus: "J" },
  "J.CP1 due": { kind: "checkpoint", id: "J.CP1", focus: "J" },
  "JC1 open": { kind: "capstone", id: "JC1.S1", focus: "J" },
  "JC1 released": { kind: "lesson", id: "J2.L04", focus: "J" },
  "J2.L04 locked (U14.CP not passed)": { kind: "checkpoint", id: "J.CP1", focus: "J" },
  "J3.L02 next": { kind: "lesson", id: "J3.L02", focus: "J" },
  "J4.L03 next": { kind: "lesson", id: "J4.L03", focus: "J" },
  "JC2 open": { kind: "capstone", id: "JC2.S1", focus: "J" },
  "J.CP2 due": { kind: "checkpoint", id: "J.CP2", focus: "J" },
  "JC3 open": { kind: "capstone", id: "JC3.S1", focus: "J" },
  "JC4 open": { kind: "capstone", id: "JC4.S1", focus: "J" },
  "JC4.S2 done": { kind: "capstone", id: "JC4.S3", focus: "J" },
  "R1.L03 next": { kind: "lesson", id: "R1.L03", focus: "R" },
  "R2.L04 next": { kind: "lesson", id: "R2.L04", focus: "R" },
  "R3.L02 next": { kind: "lesson", id: "R3.L02", focus: "R" },
  "R.CP due": { kind: "checkpoint", id: "R.CP", focus: "R" },
  "RC1 open": { kind: "capstone", id: "RC1.S1", focus: "R" },
  "RC2 open": { kind: "capstone", id: "RC2.S1", focus: "R" },
  "A1.L05 next": { kind: "lesson", id: "A1.L05", focus: "A" },
  "A2.L04 next": { kind: "lesson", id: "A2.L04", focus: "A" },
  "A.CP due": { kind: "checkpoint", id: "A.CP", focus: "A" },
  "AC1 open": { kind: "capstone", id: "AC1.S1", focus: "A" },
  "AC1.S2 done": { kind: "capstone", id: "AC1.S3", focus: "A" },
  "AC2 open": { kind: "capstone", id: "AC2.S1", focus: "A" },
  "two tracks in progress": { kind: "lesson", id: "J1.L04", focus: "J" },
  // The learner's last session was an A one: picking a track's session after the core records the focus (§5.2).
  "whole course complete": { kind: "review", id: null, focus: "A" },
};
/** Built as e2e builds them (with warm-ups); the rest with `practice: false`. */
const WITH_PRACTICE = new Set([
  "core complete, tracks untouched",
  "two tracks in progress",
  "whole course complete",
]);
const NEEDS_JC4 = new Set(["JC4 open", "JC4.S2 done", "whole course complete"]);

async function ok<T>(h: Harness, method: string, path: string, body?: unknown): Promise<T> {
  const r = await h.json<T>(method, path, body);
  if (r.status !== 200) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
function lastSummary(h: Harness): SessionSummary {
  const row = h.server.deps.repos.db
    .query("SELECT summary_json FROM sessions WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1")
    .get() as { summary_json: string };
  return JSON.parse(row.summary_json) as SessionSummary;
}
const authored = (c: ContentSource, id: string | null) => id === null || c.lessons.some((l) => l.id === id);
const isLesson = (id: string | null) => id !== null && /^[JRA]\d\.L\d{2}$/.test(id);

describe("Wave 7 dev seeds (wave7.md §6)", () => {
  test("GET /api/dev/seed lists every Wave 7 point; on the real content a JC4 point names the songs it needs", async () => {
    const h = await harness({ dev: true, content: real, now: NOW });
    try {
      const listed = (await ok<{ items: { point: string }[] }>(h, "GET", "/api/dev/seed")).items.map(
        (p) => p.point,
      );
      for (const p of WAVE7_SEED_POINTS)
        expect({ p, listed: listed.includes(p) }).toEqual({ p, listed: true });
      if (real.songs.some((s) => s.id === "song.georgia-on-my-mind" || s.id === "song.body-and-soul")) return;
      const r = await h.json<{ error?: { message: string } }>("POST", "/api/dev/seed", { point: "JC4 open" });
      expect(r.status).toBe(400);
      expect(r.body.error?.message ?? "").toMatch(/song\.georgia-on-my-mind or song\.body-and-soul/);
    } finally {
      await h.close();
    }
  }, 60_000);

  test("every point: Today, the focus, the track's position and what the point names", async () => {
    const h = await harness({ dev: true, content: full, now: NOW });
    try {
      await h.json("PUT", "/api/profile", { timezone: "UTC" });
      for (const point of WAVE7_SEED_POINTS) {
        if (WITH_PRACTICE.has(point)) continue;
        const r = await h.json<DevSeedResult & { error?: { message: string } }>("POST", "/api/dev/seed", {
          point,
          practice: false,
        });
        expect({ point, status: r.status, error: r.body.error?.message }).toEqual({
          point,
          status: 200,
          error: undefined,
        });
        expect(r.body.lastActiveDay).not.toBeNull();
        await checkToday(h, point);
        await deepChecks(h, point);
      }
    } finally {
      await h.close();
    }
  }, 600_000);

  for (const point of WITH_PRACTICE)
    test(`“${point}” (with warm-ups, as e2e seeds it)`, async () => {
      const h = await harness({ dev: true, content: full, now: NOW });
      try {
        await h.json("PUT", "/api/profile", { timezone: "UTC" });
        const r = await h.json<DevSeedResult & { error?: { message: string } }>("POST", "/api/dev/seed", {
          point,
        });
        expect({ point, status: r.status, error: r.body.error?.message }).toEqual({
          point,
          status: 200,
          error: undefined,
        });
        await checkToday(h, point);
        await deepChecks(h, point);
      } finally {
        await h.close();
      }
    }, 300_000);

  void NEEDS_JC4;

  test("“after <track session>”: the core, then J, R and A in order up to it; Today is what follows", async () => {
    const h = await harness({ dev: true, content: real, now: NOW });
    try {
      await h.json("PUT", "/api/profile", { timezone: "UTC" });
      const cases: [string, { kind: SessionPlan["kind"]; id: string }, TrackFocus["focus"]][] = [
        ["after J2.L02", { kind: "lesson", id: "J2.L03" }, "J"],
        ["after JC1.S1", { kind: "capstone", id: "JC1.S2" }, "J"],
        ["after R2.L03", { kind: "lesson", id: "R2.L04" }, "R"],
        // Oak 2.0 W2: A2.L07 Hocket follows A2.L03 (content/syllabus.ts trackOrder.A).
        ["after A2.L03", { kind: "lesson", id: "A2.L07" }, "A"],
      ];
      for (const [point, today, focus] of cases) {
        const r = await h.json<DevSeedResult & { error?: { message: string } }>("POST", "/api/dev/seed", {
          point,
          practice: false,
        });
        expect({ point, status: r.status, error: r.body.error?.message }).toEqual({
          point,
          status: 200,
          error: undefined,
        });
        const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
        expect([point, plan.kind, plan.mapItemId]).toEqual([point, today.kind, today.id]);
        expect((await ok<TrackFocus>(h, "GET", "/api/tracks/focus")).focus).toBe(focus);
        // The core is complete under every track point; R and A points hold the whole of J (the order J, R, A).
        const progress = await ok<CourseProgress>(h, "GET", "/api/lessons/progress");
        expect(progress.next).toBeNull();
        const tracks = await ok<Tracks>(h, "GET", "/api/tracks");
        const j = tracks.items.find((t) => t.trackId === "J");
        if (focus !== "J") expect(j?.sessionsDone).toBe(j?.sessionsTotal);
      }
      // An id that is neither in the default order nor a track session is refused, naming it.
      const bad = await h.json<{ error?: { message: string } }>("POST", "/api/dev/seed", {
        point: "after J9.L01",
      });
      expect(bad.status).toBe(400);
      expect(bad.body.error?.message ?? "").toContain("J9.L01");
    } finally {
      await h.close();
    }
  }, 300_000);
});

async function checkToday(h: Harness, point: string): Promise<SessionPlan> {
  const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
  const want = TODAY[point];
  if (want === undefined) throw new Error(`no expectation for ${point}`);
  const focus = await ok<TrackFocus>(h, "GET", "/api/tracks/focus");
  expect({ point, focus: focus.focus, planFocus: plan.focus }).toEqual({
    point,
    focus: want.focus,
    planFocus: want.focus,
  });
  // Never a lesson that is not written; a written target is exactly Today's New block.
  if (isLesson(plan.mapItemId as string | null))
    expect({ point, written: authored(full, plan.mapItemId as string) }).toEqual({ point, written: true });
  if (!isLesson(want.id) || authored(full, want.id)) {
    expect({ point, kind: plan.kind, id: plan.mapItemId as string | null }).toEqual({
      point,
      kind: want.kind,
      id: want.id,
    });
    if (want.id !== null && want.focus !== "core") {
      const t = plan.track;
      expect({ point, track: t?.trackId }).toEqual({ point, track: want.focus });
      // Contracts 2.2 (Oak 2.0 W2): J 35, R 21, A 23 sessions (content/syllabus.ts SESSION_COUNTS; were 34, 20, 20).
      expect(t?.sessionsTotal).toBe({ J: 35, R: 21, A: 23 }[want.focus]);
    }
  } else if (plan.mapItemId === null) expect({ point, note: plan.note }).toEqual({ point, note: FALLBACK });
  return plan;
}

/** What other areas' e2e read from a point, beyond Today. */
async function deepChecks(h: Harness, point: string): Promise<void> {
  const unlocks = async () =>
    new Set((await ok<{ items: Unlock[] }>(h, "GET", "/api/unlocks")).items.map((u) => u.itemId));
  const tracks = async () => (await ok<Tracks>(h, "GET", "/api/tracks")).items;
  const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
  switch (point) {
    case "core complete, tracks untouched": {
      expect(plan.core).toBe("complete");
      expect(plan.course).toBe("in-progress");
      const focus = await ok<TrackFocus>(h, "GET", "/api/tracks/focus");
      expect(focus).toEqual({ focus: "core", chosenAt: null });
      // Each open track with a written first session is offered, J, R, A.
      const offers = (plan.trackOffers ?? []).map((o) => [o.trackId, o.next.mapItemId]);
      const want = (["J", "R", "A"] as const)
        .map((t) => [t, { J: "J1.L01", R: "R1.L01", A: "A1.L01" }[t]] as const)
        .filter(([, id]) => authored(full, id));
      expect(offers as unknown[]).toEqual(want.map(([t, id]) => [t, id]));
      const progress = await ok<CourseProgress>(h, "GET", "/api/lessons/progress");
      // 270 since Oak 2.0 W2 (content/syllabus.ts SESSION_COUNTS.total; it was 259).
      expect(progress.mapTotal).toBe(270);
      expect(progress.course).toBe("in-progress");
      break;
    }
    case "J1.L03 next": {
      const u = await unlocks();
      for (const id of ["tb.feature.jazz-glyphs", "chord.sixth-sus", "snd.jazzkit", "snd.vibes"])
        expect({ id, has: u.has(id) }).toEqual({ id, has: true });
      expect((await tracks()).find((t) => t.trackId === "J")?.focus).toBe(true);
      break;
    }
    case "J.CP1 due": {
      const u = await unlocks();
      for (const id of ["chord.alt", "chord.ext"]) expect({ id, has: u.has(id) }).toEqual({ id, has: true });
      break;
    }
    case "JC1 released": {
      const album = await ok<Album>(h, "GET", "/api/album");
      expect(album.sides?.find((s) => s.side === "B")).toEqual({
        side: "B",
        title: "Side B",
        released: 1,
        total: 8,
      });
      expect(album.sides?.find((s) => s.side === "A")?.released).toBe(12);
      const jc1 = album.tracks.find((t) => t.capstoneId === "JC1");
      expect(jc1?.side).toBe("B");
      expect(jc1?.trackNo).toBe(1);
      const src = await ok<{ code: string; fileName: string; trackId: string; key: unknown }>(
        h,
        "GET",
        `/api/album/tracks/${jc1?.id}/versions/1/source`,
      );
      expect(src.code).toContain("mel:");
      expect(src.key).toEqual({ tonic: "C", mode: "major" });
      expect(src.fileName).toMatch(/^oak-side-b-01-[a-z0-9-]+-v1$/);
      break;
    }
    case "J2.L04 locked (U14.CP not passed)": {
      expect(plan.core).toBe("in-progress");
      expect((plan.trackOffers ?? []).some((o) => o.next.mapItemId === "J2.L04")).toBe(false);
      const j = (await tracks()).find((t) => t.trackId === "J");
      expect(j?.nextSession?.mapItemId).toBe("J.CP1");
      const gate = j?.gates.find((g) => g.gateId === "J.chord-scales");
      expect(gate?.open).toBe(false);
      expect(gate?.requires.map((r) => r.ref)).toEqual(["U14.CP"]);
      break;
    }
    case "JC3 open": {
      const j = (await tracks()).find((t) => t.trackId === "J");
      expect(j?.capstones?.find((c) => c.capstoneId === "JC4")?.status).toBe("open");
      expect(j?.checkpoints?.map((c) => [c.cpId, c.status])).toEqual([
        ["J.CP1", "passed"],
        ["J.CP2", "passed"],
      ]);
      break;
    }
    case "RC1 open": {
      expect((await unlocks()).has("snd.horns")).toBe(false);
      break;
    }
    case "RC2 open": {
      const horns = (await ok<{ items: Unlock[] }>(h, "GET", "/api/unlocks")).items.find(
        (u) => u.itemId === "snd.horns",
      );
      expect(horns?.sourceId).toBe("U15.L05");
      break;
    }
    case "AC1.S2 done": {
      const ss = await ok<CapstoneSessions>(h, "GET", "/api/capstones/AC1/sessions");
      expect(ss.sessions.slice(0, 2).map((s) => s.status)).toEqual(["done", "done"]);
      const drafts = ss.sessions.slice(0, 2).map((s) => s.draft);
      expect(drafts.every((d) => d !== null)).toBe(true);
      if (ss.versions !== undefined) expect(ss.versions.every((v) => v.draft !== null)).toBe(true);
      const gate = await ok<CapstoneGate>(h, "GET", "/api/capstones/AC1/gate");
      for (const t of gate.tunes ?? []) expect(t.open || t.reason !== null).toBe(true);
      break;
    }
    case "AC2 open": {
      expect((await unlocks()).has("snd.choir")).toBe(false);
      const gate = await ok<CapstoneGate>(h, "GET", "/api/capstones/AC2/gate");
      expect(gate.open).toBe(true);
      expect(gate.conditions.map((c) => [c.ref, c.met])).toEqual([
        ["A.CP", true],
        ["J3.L04", true],
        ["R1.L05", true],
      ]);
      const album = await ok<Album>(h, "GET", "/api/album");
      const ac1 = album.tracks.find((t) => t.capstoneId === "AC1");
      expect(ac1?.side).toBe("B");
      break;
    }
    case "two tracks in progress": {
      const offers = (plan.trackOffers ?? []).map((o) => o.trackId);
      expect(offers[0]).toBe("J");
      expect(offers).toEqual([...offers].sort((a, b) => "JRA".indexOf(a) - "JRA".indexOf(b)));
      const summary = lastSummary(h);
      expect(summary.next?.trackId).toBe("J");
      break;
    }
    case "whole course complete": {
      expect(plan.course).toBe("complete");
      expect(plan.kind === "review" || plan.kind === "gym").toBe(true);
      // Wave 7 closer: with the focus on a finished track there is no core session to fall back to, so the plan
      // does not say there is; each complete track says it is complete, never "still being written".
      expect(plan.note ?? "").not.toContain("the core's next session");
      for (const t of await tracks()) {
        expect([t.trackId, t.sessionsDone]).toEqual([t.trackId, t.sessionsTotal]);
        expect(t.note).toBe(`All ${t.sessionsTotal} sessions done. Its lessons stay open to replay.`);
      }
      const whole = await ok<WholeCourse>(h, "GET", "/api/course/whole");
      expect(whole.stage).toBe("complete");
      expect(whole.sessionsDone).toBe(270);
      expect(whole.album).toMatchObject({ released: 20, total: 20 });
      const summary = lastSummary(h);
      expect(summary.courseComplete?.stage).toBe("complete");
      expect(whole.sessionId).toBe(summary.session.id);
      const album = await ok<Album>(h, "GET", "/api/album");
      expect(album.sides).toEqual([
        { side: "A", title: "Side A", released: 12, total: 12 },
        { side: "B", title: "Side B", released: 8, total: 8 },
      ]);
      const progress = await ok<CourseProgress>(h, "GET", "/api/lessons/progress");
      expect({ done: progress.mapDone, total: progress.mapTotal, course: progress.course }).toEqual({
        done: 270,
        total: 270,
        course: "complete",
      });
      break;
    }
    default:
      break;
  }
}
