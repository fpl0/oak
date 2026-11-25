// The Wave 6 dev seeds (docs/design/wave6.md §6) on the real course: every point seeds a learner whose Today is what
// the point promises (or the honest review day while that lesson is still being written), and each seeded learner's
// saved sketches are real course code (every version lints clean under the learner's unlocks). CF-T and ladder L8
// need standards with answer keys: with the real content alone a point about them answers 400 naming what is missing
// until the repertoire author writes one; with two test renditions (testing/wave6.ts) every point is checked in depth.
import { beforeAll, describe, expect, test } from "bun:test";
import {
  type AlbumTrackDetail,
  type CapstoneSessions,
  type CapstoneState,
  type CoreCompletion,
  type CourseProgress,
  type DevSeedResult,
  type GymPlan,
  type LadderSong,
  type LadderState,
  type SessionDay,
  type SessionPlan,
  type SessionSummary,
  type Tracks,
  type Unlock,
  WAVE6_SEED_POINTS,
} from "@oak/api";
import type { UnlockableId } from "@oak/content-kit";
import { lintOak } from "@oak/grader";
import { loadContent } from "./content/loader.ts";
import type { ContentSource } from "./content/types.ts";
import { cftStandards } from "./services/dev-seed.ts";
import { SECOND_TAB_ID } from "./services/seed-wave6.ts";
import { CONTENT_DIR } from "./testing/course.ts";
import { type Harness, harness } from "./testing/harness.ts";
import { withCft } from "./testing/wave6.ts";

let real: ContentSource;
let full: ContentSource;
beforeAll(async () => {
  real = await loadContent({ contentDir: CONTENT_DIR });
  full = withCft(real);
});

const NOW = "2026-11-14T12:00:00.000Z";
const PAUSE = "The next lessons are still being written. Today: a review, then Studio.";

/** What Today holds after each point (gym ordinals one on since Oak 2.0 W2, contracts 2.2 §2.5), or a review day. */
const TODAY: Record<string, { kind: SessionPlan["kind"]; id: string | null }> = {
  "after X2 (U12.L02 next)": { kind: "lesson", id: "U12.L02" },
  "after U12.L05": { kind: "gym", id: "GYM.13" },
  "after U13.L03": { kind: "gym", id: "GYM.14" },
  "U13.CP due": { kind: "checkpoint", id: "U13.CP" },
  "tracks open (after U13.CP)": { kind: "lesson", id: "U14.L02" },
  "after U14.L03": { kind: "lesson", id: "U14.L04" },
  "U14.CP due": { kind: "checkpoint", id: "U14.CP" },
  "CF-T open (U15.L01 done)": { kind: "capstone", id: "CF-T.S1" },
  "C6 open": { kind: "capstone", id: "C6.S1" },
  "C6 released": { kind: "lesson", id: "U15.L02" },
  "CF-T.S2 done": { kind: "lesson", id: "U15.L04" },
  "after U15.L05": { kind: "lesson", id: "U15.L06" },
  "after U16.L03": { kind: "lesson", id: "U16.L04" },
  "after U17.L02": { kind: "lesson", id: "U17.L03" },
  "U17.CP due": { kind: "checkpoint", id: "U17.CP" },
  "C7 open": { kind: "capstone", id: "C7.S1" },
  "C7.S2 done": { kind: "capstone", id: "C7.S3" },
  "C7 released": { kind: "gym", id: "GYM.18" },
  "CF-A open": { kind: "capstone", id: "CF-A.S1" },
  "CF-A.S3 done": { kind: "capstone", id: "CF-A.S4" },
  "core complete": { kind: "review", id: null },
  "ladder L8": { kind: "lesson", id: "U17.L03" },
  "C3.S3 in progress (d13)": { kind: "capstone", id: "C3.S3" },
  "two takes (d20)": { kind: "gym", id: "GYM.07" },
  "second tab (d21)": { kind: "lesson", id: "U12.L02" },
};
/** Points built with their warm-ups (as e2e seeds them): the ones whose checks read the reviews or the gym. */
const WITH_PRACTICE = new Set(["core complete", "tracks open (after U13.CP)", "ladder L8", "after U12.L05"]);
/** Points that answer 400 on content with no CF-T standard yet. */
const NEEDS_CFT = new Set(["CF-T open (U15.L01 done)", "CF-T.S2 done", "core complete", "ladder L8"]);

async function ok<T>(h: Harness, method: string, path: string): Promise<T> {
  const r = await h.json<T>(method, path);
  if (r.status !== 200) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

/** Every version of every saved sketch lints clean under the learner's unlocks (real course code). */
async function sketchesLintClean(h: Harness, content: ContentSource): Promise<string[]> {
  const unlocked = new Set(
    (await ok<{ items: Unlock[] }>(h, "GET", "/api/unlocks")).items.map((u) => u.itemId),
  ) as Set<UnlockableId>;
  const problems: string[] = [];
  const list = await ok<{ items: { id: string; title: string; originId: string | null }[] }>(
    h,
    "GET",
    "/api/sketches",
  );
  for (const s of list.items) {
    // The onboarding loop and U00.L02 are a preview context (contracts §3.1 rule 5a): they may show later tools.
    if (/^U00\./.test(s.originId ?? "")) continue;
    const detail = await ok<{ versions: { version: number; code: string }[] }>(
      h,
      "GET",
      `/api/sketches/${s.id}`,
    );
    for (const v of detail.versions) {
      const lint = lintOak(
        v.code,
        { profile: "graded", unlocked, allowPreview: false, meter: "4/4", key: null },
        content.toolbox,
      );
      const errors = lint.diagnostics.filter((d) => d.severity === "error");
      if (errors.length > 0)
        problems.push(`${s.title} v${v.version}: ${errors.map((e) => `${e.id} ${e.message}`).join("; ")}`);
    }
  }
  return problems;
}

/** The summary of the last session the seed ended (yesterday's Coda). */
function lastSummary(h: Harness): SessionSummary {
  const row = h.server.deps.repos.db
    .query("SELECT summary_json FROM sessions WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1")
    .get() as { summary_json: string };
  return JSON.parse(row.summary_json) as SessionSummary;
}

describe("Wave 6 dev seeds (wave6.md §6)", () => {
  test("GET /api/dev/seed lists every Wave 6 point", async () => {
    const h = await harness({ dev: true, content: real, now: NOW });
    try {
      const listed = (await ok<{ items: { point: string }[] }>(h, "GET", "/api/dev/seed")).items.map(
        (p) => p.point,
      );
      for (const p of WAVE6_SEED_POINTS)
        expect({ p, listed: listed.includes(p) }).toEqual({ p, listed: true });
      // The session engineer's request: the release day of the four-session C3.
      expect(listed).toContain("C3.S3 done");
    } finally {
      await h.close();
    }
  });

  test("on the real content a point about CF-T answers 400 naming the standards until one is written", async () => {
    if (cftStandards({ content: { capstoneDef: () => null } as never }).length > 0) return;
    const h = await harness({ dev: true, content: real, now: NOW });
    try {
      const written = cftStandards(h.server.deps).length > 0;
      // Once the real standards are complete, withCft adds nothing: `full` holds the real songs and capstones, and
      // each point below (the CF-T points and "C6 open") is built on it by its own test, which asserts 200, Today and
      // more ("C6 open": CF-T.S1 done). Building them a second time here would prove nothing more.
      const fullIsReal =
        full.songs.length === real.songs.length &&
        full.songs.every((s, i) => s === real.songs[i]) &&
        full.capstones.every((c, i) => c === real.capstones[i]);
      if (written && fullIsReal) return;
      for (const point of NEEDS_CFT) {
        if (point === "ladder L8" && cftStandards(h.server.deps).length >= 2) continue;
        const r = await h.json<{ error?: { message: string } }>("POST", "/api/dev/seed", { point });
        if (written && point !== "ladder L8")
          expect({ point, status: r.status }).toEqual({ point, status: 200 });
        else {
          expect({ point, status: r.status }).toEqual({ point, status: 400 });
          expect(r.body.error?.message ?? "").toMatch(/standard/);
        }
      }
      // Every other point works without CF-T: its sessions are left out, as Today leaves them out.
      const r = await h.json<DevSeedResult>("POST", "/api/dev/seed", { point: "C6 open" });
      expect(r.status).toBe(200);
      const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
      expect({ kind: plan.kind, id: plan.mapItemId as string | null }).toEqual({
        kind: "capstone",
        id: "C6.S1",
      });
      expect(r.body.done.includes("CF-T.S1")).toBe(written);
    } finally {
      await h.close();
    }
  }, 240_000);

  for (const point of [...WAVE6_SEED_POINTS, "C3.S3 done"])
    test(`“${point}”`, async () => {
      const h = await harness({ dev: true, content: full, now: NOW });
      try {
        await h.json("PUT", "/api/profile", { timezone: "UTC" });
        // Built with the warm-ups as e2e builds them where a check reads the reviews; elsewhere without them (the
        // New block, the unlocks, the capstones and the album do not depend on them), which halves the build.
        const r = await h.json<DevSeedResult & { error?: { message: string } }>("POST", "/api/dev/seed", {
          point,
          ...(WITH_PRACTICE.has(point) ? {} : { practice: false }),
        });
        expect({ point, status: r.status, error: r.body.error?.message }).toEqual({
          point,
          status: 200,
          error: undefined,
        });
        expect(r.body.lastActiveDay).not.toBeNull();
        const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
        const want = point === "C3.S3 done" ? { kind: "capstone" as const, id: "C3.S4" } : TODAY[point];
        if (want === undefined) throw new Error(`no expectation for ${point}`);
        const written =
          want.id === null || !/^U\d{2}\.L\d{2}$/.test(want.id) || full.lessons.some((l) => l.id === want.id);
        if (written)
          expect({ point, kind: plan.kind, id: plan.mapItemId as string | null }).toEqual({
            point,
            kind: want.kind,
            id: want.id,
          });
        else
          expect({ point, kind: plan.kind, note: plan.note }).toEqual({ point, kind: "review", note: PAUSE });
        expect({ point, problems: await sketchesLintClean(h, full) }).toEqual({ point, problems: [] });
        await deepChecks(h, point, plan);
      } finally {
        await h.close();
      }
    }, 300_000);
});

/** What other areas' e2e read from a point, beyond Today. */
async function deepChecks(h: Harness, point: string, plan: SessionPlan): Promise<void> {
  const unlockIds = async () =>
    new Set((await ok<{ items: Unlock[] }>(h, "GET", "/api/unlocks")).items.map((u) => u.itemId));
  const capstone = (id: string) => ok<CapstoneState>(h, "GET", `/api/capstones/${id}`);
  const sessions = (id: string) => ok<CapstoneSessions>(h, "GET", `/api/capstones/${id}/sessions`);
  const progress = () => ok<CourseProgress>(h, "GET", "/api/lessons/progress");
  const album = () => ok<{ tracks: { id: string; capstoneId: string | null }[] }>(h, "GET", "/api/album");
  const draftCode = async (id: string) => {
    const st = await capstone(id);
    const d = await ok<{ versions: { code: string }[]; tags: string[] }>(
      h,
      "GET",
      `/api/sketches/${st.sketchId}`,
    );
    return { code: d.versions.at(-1)?.code ?? "", tags: d.tags };
  };

  switch (point) {
    case "after X2 (U12.L02 next)": {
      expect((await unlockIds()).has("chord.seventh")).toBe(true);
      const caps = (await album()).tracks.map((t) => t.capstoneId);
      expect(caps).toContain("C5");
      expect(caps).toContain("X2");
      expect(plan.core).toBe("in-progress");
      expect(plan.tracks ?? null).toBeNull();
      break;
    }
    case "after U12.L05": {
      expect((await unlockIds()).has("chord.seventh-dim")).toBe(true);
      expect(plan.slot).toEqual({ fills: "gym", sinceLast: 4 });
      break;
    }
    case "after U13.L03": {
      const u = await unlockIds();
      for (const id of ["tb.dict.lefthand", "tb.early", "tb.late", "tb.velocity"])
        expect({ id, has: u.has(id) }).toEqual({ id, has: true });
      break;
    }
    case "U13.CP due": {
      const u = await unlockIds();
      for (const id of ["tb.meter.compound", "tb.ply"])
        expect({ id, has: u.has(id) }).toEqual({ id, has: true });
      const tracks = await ok<Tracks>(h, "GET", "/api/tracks");
      expect(tracks.items.find((t) => t.trackId === "J")?.status).toBe("locked");
      expect(tracks.items.find((t) => t.trackId === "J")?.note).toBe("Opens with the unit 13 checkpoint.");
      break;
    }
    case "tracks open (after U13.CP)": {
      const summary = lastSummary(h);
      expect((summary.gatesOpened ?? []).map((g) => g.gateId).sort()).toEqual(["J.main", "R.main"]);
      // Wave 7: the first lessons of J and R are written (J1.L01, R1.L01, the Foundation exemplars). The core stays
      // the New block and each open track is offered beside it (wave7.md §5.2); the map counts all 270 sessions
      // (content/syllabus.ts SESSION_COUNTS.total since Oak 2.0 W2; it was 259).
      const written = (id: string) => full.lessons.some((l) => l.id === id);
      const first = { J: "J1.L01", R: "R1.L01" } as const;
      const tracks = await ok<Tracks>(h, "GET", "/api/tracks");
      for (const id of ["J", "R"] as const) {
        const t = tracks.items.find((x) => x.trackId === id);
        const w = written(first[id]);
        expect({ id, status: t?.status, next: t?.next ?? null }).toEqual({
          id,
          status: "open",
          next: w ? first[id] : null,
        });
        if (w) expect(t?.note).toMatch(new RegExp(`^Next: ${first[id].replace(".", "\\.")} `));
        else expect(t?.note).toBe("Open. Its first lessons are still being written.");
        expect(t?.openedAt).not.toBeNull();
      }
      const p = await progress();
      expect(p.tracks?.find((t) => t.trackId === "J")?.status).toBe("open");
      if (written("J1.L01") && written("R1.L01")) {
        expect(plan.tracks ?? null).toBeNull();
        expect((plan.trackOffers ?? []).slice(0, 2).map((o) => o.next.mapItemId)).toEqual([
          "J1.L01",
          "R1.L01",
        ]);
        expect(p.mapTotal).toBe(270);
      } else {
        const unwritten: ("J" | "R")[] = (["J", "R"] as const).filter((t) => !written(first[t]));
        expect(plan.tracks?.open as string[] | undefined).toEqual(unwritten);
      }
      break;
    }
    case "after U14.L03": {
      const u = await unlockIds();
      for (const id of ["scale.mixolydian", "scale.dorian"])
        expect({ id, has: u.has(id) }).toEqual({ id, has: true });
      break;
    }
    case "U14.CP due": {
      expect((await unlockIds()).has("tb.n.chromatic")).toBe(true);
      // CF-T's gate is met (U15.L01 done); it is offered from the next transcription slot on, not on checkpoint day.
      expect((await capstone("CF-T")).status).toBe("open");
      break;
    }
    case "CF-T open (U15.L01 done)": {
      expect(plan.slot?.fills).toBe("cf-t");
      expect((await capstone("CF-T")).status).toBe("open");
      const gym = await ok<GymPlan>(h, "GET", "/api/gym");
      expect(gym.cfT).toEqual({ status: "open", nextSessionId: "CF-T.S1", takesSlot: true, songId: null });
      expect(gym.next).toBeNull();
      const tracks = await ok<Tracks>(h, "GET", "/api/tracks");
      const gate = tracks.items.flatMap((t) => t.gates).find((g) => g.gateId === "J.chord-scales");
      expect(gate?.open).toBe(true);
      expect(gate?.openedAt).not.toBeNull();
      // The compose capstone that waits is an alternative on the slot day.
      expect(plan.alternatives.some((a) => a.mapItemId === "C6.S1")).toBe(true);
      break;
    }
    case "C6 open": {
      const cft = await sessions("CF-T");
      expect(cft.sessions[0]?.status).toBe("done");
      const checks = cft.sessions[0]?.checks ?? [];
      expect(checks.find((c) => c.layer === "form")?.passed).toBe(true);
      expect(checks.filter((c) => c.layer === "bass").every((c) => c.passed)).toBe(true);
      expect(cft.current).toBe("CF-T.S2");
      const draft = await draftCode("CF-T");
      expect(draft.tags).toContain("song.five-foot-two");
      expect(draft.code).toContain("bass:");
      expect(draft.code).not.toContain("mel:");
      expect((await unlockIds()).has("tb.feature.transcribe.full")).toBe(true);
      // CF-T goes on as an alternative between its slots.
      expect(plan.alternatives.some((a) => a.mapItemId === "CF-T.S2")).toBe(true);
      const gym = await ok<GymPlan>(h, "GET", "/api/gym");
      expect(gym.cfT?.songId).toBe("song.five-foot-two");
      break;
    }
    case "C6 released": {
      const st = await capstone("C6");
      expect(st.status).toBe("released");
      const draft = await draftCode("C6");
      expect(draft.code).toContain("mixolydian");
      const track = await ok<AlbumTrackDetail>(h, "GET", `/api/album/tracks/${st.trackId}`);
      expect(track.versions[0]?.hasAudio).toBe(true);
      expect(track.versions[0]?.takes?.length).toBe(1);
      break;
    }
    case "CF-T.S2 done": {
      const cft = await sessions("CF-T");
      expect(cft.sessions.slice(0, 2).map((s) => s.status)).toEqual(["done", "done"]);
      expect((cft.sessions[1]?.checks ?? []).every((c) => c.passed)).toBe(true);
      const st = await capstone("CF-T");
      const d = await ok<{ versions: { key: { tonic: string; mode: string } | null }[]; tags: string[] }>(
        h,
        "GET",
        `/api/sketches/${st.sketchId}`,
      );
      expect(d.tags).toContain("song.five-foot-two");
      for (const v of d.versions) expect(v.key).toEqual({ tonic: "C", mode: "major" });
      break;
    }
    case "after U15.L05": {
      const u = await unlockIds();
      for (const id of ["snd.horns", "snd.trumpet"])
        expect({ id, has: u.has(id) }).toEqual({ id, has: true });
      break;
    }
    case "after U16.L03": {
      const tracks = await ok<Tracks>(h, "GET", "/api/tracks");
      expect(tracks.items.flatMap((t) => t.gates).find((g) => g.gateId === "J.forms")?.open).toBe(true);
      expect((await sessions("CF-T")).sessions[2]?.status).toBe("done");
      break;
    }
    case "after U17.L02": {
      expect((await unlockIds()).has("snd.tenor")).toBe(true);
      expect((await capstone("CF-T")).status).toBe("released");
      const gym = await ok<GymPlan>(h, "GET", "/api/gym");
      expect(gym.cfT).toMatchObject({ status: "released", nextSessionId: null, takesSlot: false });
      break;
    }
    case "C7 open": {
      const tracks = await ok<Tracks>(h, "GET", "/api/tracks");
      expect(tracks.items.flatMap((t) => t.gates).find((g) => g.gateId === "J.reharmonization")?.open).toBe(
        true,
      );
      expect((await capstone("C7")).status).toBe("open");
      break;
    }
    case "C7.S2 done": {
      const draft = await draftCode("C7");
      expect(draft.code).toContain("A7 Dm");
      expect(draft.code).toContain("Ab Bb C");
      expect(draft.code).toContain("melChorus");
      expect(draft.code).not.toContain("D4:major");
      break;
    }
    case "C7 released": {
      const draft = await draftCode("C7");
      expect((await capstone("C7")).status).toBe("released");
      expect(draft.code).toContain('.scale("<C4:major!32 D4:major!8>")');
      expect((await capstone("CF-A")).status).toBe("open");
      break;
    }
    case "CF-A open": {
      expect((await capstone("CF-A")).status).toBe("open");
      // Every core lesson and checkpoint is behind the learner; CF-A is the last track of the record left.
      expect(plan.core).toBe("lessons-done");
      break;
    }
    case "CF-A.S3 done": {
      expect(plan.core).toBe("lessons-done");
      const draft = await draftCode("CF-A");
      for (const part of ["chordsVerse", "chordsChorus", "chordsBridge", "E7 Am", "Fm", "Ab Bb", "D4:major"])
        expect({ part, has: draft.code.includes(part) }).toEqual({ part, has: true });
      const c = await ok<CoreCompletion>(h, "GET", "/api/course/completion");
      expect(c.stage).toBe("lessons-done");
      expect(c.remaining).toEqual([
        { kind: "capstone", id: "CF-A", title: "CF-A Core Finale: Album Single" },
      ]);
      expect(c.milestone?.reachedAt).toBeNull();
      break;
    }
    case "core complete": {
      expect(plan.core).toBe("complete");
      // Wave 7: with J1.L01 and R1.L01 written, the open tracks are offered (wave7.md §5.2), not named as unwritten.
      const writtenFirst = ["J1.L01", "R1.L01"].every((id) => full.lessons.some((l) => l.id === id));
      if (writtenFirst) {
        expect(plan.tracks ?? null).toBeNull();
        expect(plan.kind === "review" || plan.kind === "gym").toBe(true);
        expect((plan.trackOffers ?? []).slice(0, 2).map((o) => o.next.mapItemId)).toEqual([
          "J1.L01",
          "R1.L01",
        ]);
      } else expect(plan.tracks?.open).toEqual(["J", "R"]);
      const summary = lastSummary(h);
      expect(summary.coreComplete?.stage).toBe("complete");
      const c = await ok<CoreCompletion>(h, "GET", "/api/course/completion");
      expect(c.stage).toBe("complete");
      expect(c.completedAt).not.toBeNull();
      expect(c.remaining).toEqual([]);
      expect({ done: c.sessionsDone, total: c.sessionsTotal }).toEqual({ done: 191, total: 191 });
      expect(c.album).toMatchObject({ released: 12, total: 12 });
      expect(c.milestone?.id).toBe("ms.07");
      expect(c.milestone?.reachedAt).toBe(c.completedAt);
      expect(c.stats.sessions).toBe(191);
      expect(c.stats.tracksReleased).toBe(12);
      expect(c.sessionId).toBe(summary.session.id);
      // Every Side A track has a recording.
      const tracks = (await album()).tracks;
      expect(tracks.length).toBe(12);
      const p = await progress();
      expect(p.core).toBe("complete");
      expect(p.next).toBeNull();
      // What is open: the tracks whose first lesson is written lead (they can be started), then reviews, the gym
      // and Studio.
      const kinds = c.open.map((o) => `${o.kind}:${o.available}`).filter((k) => !k.startsWith("track"));
      expect(kinds.slice(0, 3)).toEqual(["review:true", "gym:true", "studio:true"]);
      if (writtenFirst) {
        expect(c.open.slice(0, 2).map((o) => [o.kind, o.id, o.available])).toEqual([
          ["track", "J1.L01", true],
          ["track", "R1.L01", true],
        ]);
      } else {
        expect(c.open.filter((o) => o.kind === "track").every((o) => !o.available)).toBe(true);
        expect(c.open.find((o) => o.id === "J")?.note).toBe(
          "Open. Its first lessons are still being written.",
        );
      }
      break;
    }
    case "ladder L8": {
      const ladder = await ok<LadderState>(h, "GET", "/api/ladder");
      expect({ level: ladder.level, realism: ladder.realism }).toEqual({ level: 8, realism: 1 });
      const songs = (await ok<{ items: LadderSong[] }>(h, "GET", "/api/ladder/songs")).items.filter(
        (s) => s.level === 8,
      );
      const worked = songs.find((s) => s.passedStages.length > 0);
      expect(worked?.songId).toBe("song.aint-she-sweet");
      expect(worked?.passedStages).toEqual(["form", "bass"]);
      // The form is behind: its sections are given now. The other standard's are not on the wire.
      expect(worked?.phrases.length).toBe(4);
      expect(songs.find((s) => s.songId === "song.five-foot-two")?.phrases).toEqual([]);
      break;
    }
    case "C3.S3 in progress (d13)": {
      const s = await sessions("C3");
      expect(s.sessions.map((x) => x.status)).toEqual(["done", "done", "in_progress", "locked"]);
      expect(s.sessions[2]?.draft).not.toBeNull();
      const st = await capstone("C3");
      expect(st.lastResult?.status).toBe("pass");
      expect(st.trackId).toBeNull();
      // Nothing is lost: C3.S3 can be completed without a take, and C3.S4 follows.
      const done = await h.json<CapstoneState>("POST", "/api/capstones/C3/sessions", {
        sessionId: null,
        capstoneSessionId: "C3.S3",
        sketchId: st.sketchId,
        flavour: null,
      });
      expect(done.status).toBe(200);
      expect((await ok<SessionPlan>(h, "GET", "/api/session/today")).mapItemId as string).toBe("C3.S4");
      break;
    }
    case "two takes (d20)": {
      const st = await capstone("C3");
      const track = await ok<AlbumTrackDetail>(h, "GET", `/api/album/tracks/${st.trackId}`);
      const v1 = track.versions.find((v) => v.version === 1);
      expect(v1?.takes?.map((t) => t.take)).toEqual([1, 2]);
      expect(v1?.currentTake).toBe(2);
      const current = await h.req("GET", `/api/album/tracks/${st.trackId}/versions/1/audio`);
      const first = await h.req("GET", `/api/album/tracks/${st.trackId}/versions/1/audio?take=1`);
      expect(current.status).toBe(200);
      expect(first.status).toBe(200);
      const a = new Uint8Array(await current.arrayBuffer());
      const b = new Uint8Array(await first.arrayBuffer());
      expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
      break;
    }
    case "second tab (d21)": {
      const other = await ok<SessionDay>(h, "GET", `/api/session/day?tab=${SECOND_TAB_ID}`);
      expect(other.open?.tabId).toBe(SECOND_TAB_ID);
      expect(other.open?.phase).toBe("main");
      expect(other.open?.mapItemId as string).toBe("U12.L02");
      const mine = await ok<SessionDay>(h, "GET", "/api/session/day?tab=tab_spec_0000001");
      expect(mine.open).toBeNull();
      expect(mine.openSessions?.length).toBe(1);
      expect(mine.doneForToday).toBe(false);
      break;
    }
    default:
      break;
  }
}
