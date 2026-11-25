// Wave 4 on the real course, over HTTP: the dev seeds other areas' e2e start from (wave4.md §6), with real course
// code in every saved sketch and honest SRS, mastery, ladder and album state; the music of the seeded C2 draft
// checked by the real grader against C2's brief.
import { beforeAll, describe, expect, test } from "bun:test";
import {
  type AlbumTrackDetail,
  type BackupInfo,
  type CapstoneGate,
  type CapstoneSessions,
  type DevSeedResult,
  type GymPlan,
  type LadderState,
  type SessionPlan,
  type Transcription,
  type Unlock,
  type VoicingGate,
  WAVE4_SEED_POINTS,
} from "@oak/api";
import { loadContent } from "./content/loader.ts";
import type { ContentSource } from "./content/types.ts";
import { C2_CHORDS, C2_SONG, HAND_VOICED_CADENCE, recordingSeconds } from "./services/dev-seed.ts";
import { CONTENT_DIR, wave4Course } from "./testing/course.ts";
import { type Harness, harness } from "./testing/harness.ts";
import { SimLearner } from "./testing/learner.ts";

let real: ContentSource;
beforeAll(async () => {
  // Pinned to the course as Wave 4 shipped it (Wave 5 lessons are authored in parallel).
  real = wave4Course(await loadContent({ contentDir: CONTENT_DIR }));
});

const NOW = "2026-11-11T12:00:00.000Z";

async function learner(content: ContentSource): Promise<{ h: Harness; me: SimLearner }> {
  const h = await harness({ dev: true, content, now: NOW });
  const me = new SimLearner(h, content);
  await me.api("PUT", "/api/profile", { timezone: "UTC" });
  return { h, me };
}
const written = (c: ContentSource, id: string) => c.lessons.some((l) => l.id === id);
const songsWritten = (c: ContentSource) =>
  (c.capstones.find((x) => x.id === "X1")?.song ?? []).some((id) => c.songs.some((s) => s.id === id));

/** Every saved sketch lints clean under the learner's unlocks; Today offers only open, written items. */
async function checkSeeded(me: SimLearner, content: ContentSource): Promise<SessionPlan> {
  const { lintOak } = await import("@oak/grader");
  const plan = await me.today();
  if (plan.kind === "lesson") expect(written(content, plan.mapItemId as string)).toBe(true);
  expect(plan.warmup.plannedSec).toBeLessThanOrEqual(plan.warmup.budgetSec);
  const unlocked = new Set(
    (await me.api<{ items: Unlock[] }>("GET", "/api/unlocks")).items.map((u) => u.itemId as string),
  );
  const sketches = (
    await me.api<{ items: { id: string; originKind: string; originId: string | null }[] }>(
      "GET",
      "/api/sketches",
    )
  ).items.filter((s) => !(s.originKind === "lesson-make" && s.originId?.startsWith("U00")));
  for (const sk of sketches) {
    const versions = (
      await me.api<{ versions: { code: string; version: number }[] }>("GET", `/api/sketches/${sk.id}`)
    ).versions;
    for (const v of versions) {
      const lint = lintOak(
        v.code,
        { profile: "graded", unlocked: unlocked as never, allowPreview: false, meter: "4/4", key: null },
        content.toolbox,
      );
      expect({
        sketch: sk.originId,
        v: v.version,
        errors: lint.diagnostics.filter((d) => d.severity === "error").map((d) => d.id),
      }).toEqual({
        sketch: sk.originId,
        v: v.version,
        errors: [],
      });
    }
  }
  return plan;
}

describe("the Wave 4 dev seeds on the real content (wave4.md §6)", () => {
  test("GET /dev/seed lists every Wave 4 point", async () => {
    const { h, me } = await learner(real);
    try {
      const points = (await me.api<{ items: { point: string }[] }>("GET", "/api/dev/seed")).items.map(
        (p) => p.point,
      );
      for (const p of WAVE4_SEED_POINTS) expect(points).toContain(p);
    } finally {
      await h.close();
    }
  });

  for (const point of WAVE4_SEED_POINTS)
    test(`"${point}": the state its description promises`, async () => {
      const { h, me } = await learner(real);
      try {
        const t0 = performance.now();
        const r = await h.json<DevSeedResult & { error?: { message: string } }>("POST", "/api/dev/seed", {
          point,
        });
        // A point whose own content is not written yet answers 400 naming it (wave4.md §6).
        if (point === "U05.L07 gate open" && !written(real, "U05.L07")) {
          expect(r.status).toBe(400);
          expect(r.body.error?.message).toContain("U05.L07");
          return;
        }
        if ((point === "X1.S2 done" || point === "X1 released") && !songsWritten(real)) {
          expect(r.status).toBe(400);
          expect(r.body.error?.message).toContain("X1");
          return;
        }
        expect(r.status).toBe(200);
        const seeded = r.body;
        expect(performance.now() - t0).toBeLessThan(30_000);
        expect(seeded.lastActiveDay).toBe("2026-11-10");
        const plan = await checkSeeded(me, real);
        const done = new Set(seeded.done);
        const gym = await me.api<GymPlan>("GET", "/api/gym");
        const ladder = await me.api<LadderState>("GET", "/api/ladder");
        const voicing = await me.api<VoicingGate>("GET", "/api/gates/voicing");
        const unlocked = new Set(
          (await me.api<{ items: Unlock[] }>("GET", "/api/unlocks")).items.map((u) => u.itemId),
        );
        const after = (id: string) => done.has(id);
        // The voicing gate opens exactly when U05.L08 is done (the seeded learner passes it typing).
        if (after("U05.L08")) {
          expect(voicing.passed).toBe(true);
          expect(voicing.best).toBeGreaterThanOrEqual(0.9);
          // The voicing the learner typed, for the Workbench's voicing() comparison.
          expect(voicing.passedCode).toContain("chords:");
          for (const id of ["tb.voicing", "tb.chord", "snd.rhodes", "snd.organ"])
            expect(unlocked.has(id)).toBe(true);
        } else
          for (const id of ["tb.voicing", "snd.rhodes", "snd.organ"]) expect(unlocked.has(id)).toBe(false);
        expect(gym.active).toBe(after("U07.L01"));
        switch (point) {
          case "after U05.L04":
            expect(seeded.done.at(-1)).toBe("U05.L04");
            expect(unlocked.has("tb.arp")).toBe(true);
            // Contracts 1.6 (d17): U05.L09 "Chord Names", split out of U05.L04, is taught directly after it.
            if (written(real, "U05.L09"))
              expect(plan).toMatchObject({ kind: "lesson", mapItemId: "U05.L09" });
            else if (written(real, "U05.L05"))
              expect(plan).toMatchObject({ kind: "lesson", mapItemId: "U05.L05" });
            break;
          case "U05.L07 gate open":
            expect(voicing).toMatchObject({ passed: false, attempts: 1, passedCode: null });
            expect(plan).toMatchObject({ kind: "lesson", mapItemId: "U05.L07" });
            expect(plan.main?.resumeStep).not.toBeNull();
            break;
          case "after U05.L08":
            expect(seeded.done.at(-1)).toBe("U05.L08");
            if (written(real, "U06.L01")) expect(plan).toMatchObject({ mapItemId: "U06.L01" });
            break;
          case "U05.CP due":
            expect(seeded.done.at(-1)).toBe(written(real, "U06.L01") ? "U06.L01" : "U05.L08");
            expect(plan).toMatchObject({ kind: "checkpoint", mapItemId: "U05.CP" });
            break;
          case "after U06.L05":
            expect(after("U05.CP")).toBe(true);
            expect(seeded.done.at(-1)).toBe("U06.L05");
            expect(unlocked.has("tb.feature.rn")).toBe(true);
            break;
          case "U06.CP due":
            // U07.L01 belongs to the next unit: completed only once it is written (Today never offers it before).
            expect(seeded.done.at(-1)).toBe(written(real, "U07.L01") ? "U07.L01" : "U06.L12");
            expect(plan).toMatchObject({ kind: "checkpoint", mapItemId: "U06.CP" });
            break;
          case "after U07.L03 (gym due)":
            expect(gym).toMatchObject({ active: true, sinceLast: 4, slotDue: true });
            expect(gym.next).toMatchObject({ gymId: "GYM.01", kind: "ladder", ladderLevel: 1, realism: 0 });
            expect(plan).toMatchObject({ kind: "gym", mapItemId: "GYM.01" });
            break;
          case "after U07.L07": {
            expect(gym.history.map((g) => g.gymId)).toEqual(["GYM.01", "GYM.02"]);
            expect(gym.history[1]).toMatchObject({ kind: "ladder", realism: 1 });
            expect(ladder.gradedPasses["1"]).toBe(2);
            // Since Oak 2.0 W2 (decision 103) GYM.02 follows U07.L06, so U07.L07 is one core session after it.
            expect(gym.sinceLast).toBe(1);
            if (written(real, "U07.L08"))
              expect(plan).toMatchObject({ kind: "lesson", mapItemId: "U07.L08" });
            const projects = await me.api<{ items: Transcription[] }>("GET", "/api/transcriptions");
            expect(projects.items.filter((t) => t.gradedPass === true)).toHaveLength(2);
            for (const t of projects.items) expect(JSON.stringify(t)).not.toContain("hiddenCode");
            break;
          }
          case "U07.CP due":
            expect(after("GYM.03")).toBe(true);
            expect(after("U08.L01")).toBe(written(real, "U08.L01"));
            expect(plan).toMatchObject({ kind: "checkpoint", mapItemId: "U07.CP" });
            break;
          case "C2 open":
            expect(seeded.done.at(-1)).toBe("U07.CP");
            expect(plan).toMatchObject({ kind: "capstone", mapItemId: "C2.S1" });
            break;
          case "C2.S1 done": {
            expect(plan).toMatchObject({ kind: "capstone", mapItemId: "C2.S2" });
            const ss = await me.api<CapstoneSessions>("GET", "/api/capstones/C2/sessions");
            expect(ss.current).toBe("C2.S2");
            expect(ss.sessions.map((s) => s.status)).toEqual(["done", "open"]);
            const draft = ss.sessions[0]?.draft;
            expect(draft).not.toBeNull();
            const sk = await me.api<{ versions: { code: string; version: number }[] }>(
              "GET",
              `/api/sketches/${draft?.sketchId}`,
            );
            expect(sk.versions.find((v) => v.version === draft?.sketchVersion)?.code).toBe(C2_CHORDS);
            break;
          }
          case "C2 released": {
            const track = await me.api<AlbumTrackDetail>("GET", `/api/album/tracks/${seeded.trackId}`);
            expect(track).toMatchObject({ capstoneId: "C2", side: "A", currentVersion: 1 });
            const v1 = track.versions[0];
            expect(v1).toMatchObject({ version: 1, hasAudio: true, review: null, includeReviewNote: false });
            expect(v1?.linerNotesMd.length).toBeGreaterThan(20);
            const audio = await h.req("GET", `/api/album/tracks/${seeded.trackId}/versions/1/audio`);
            expect(audio.status).toBe(200);
            const info = await me.api<BackupInfo>("GET", "/api/backup");
            // Every recorded album version counts (C0 and C1 were released with recordings too).
            expect(info.albumAudioBytes).toBeGreaterThan((await audio.arrayBuffer()).byteLength);
            expect(info.ownAudio).toEqual({ files: 0, bytes: 0, unusedFiles: 0, unusedBytes: 0 });
            const gate = await me.api<CapstoneGate>("GET", "/api/capstones/X1/gate");
            expect(gate).toMatchObject({
              open: false,
              gymSetsToOpen: 2,
              message: "Two more gym sets open X1",
            });
            expect(gym.x1?.message).toBe("Two more gym sets open X1");
            expect(plan).toMatchObject({ kind: "gym", note: "Two more gym sets open X1" });
            break;
          }
          case "X1 open":
            expect((await me.api<CapstoneGate>("GET", "/api/capstones/X1/gate")).open).toBe(true);
            expect(gym.x1).toBeNull();
            expect(plan).toMatchObject({ kind: "capstone", mapItemId: "X1.S1" });
            break;
          case "X1.S2 done": {
            const ss = await me.api<CapstoneSessions>("GET", "/api/capstones/X1/sessions");
            expect(ss.current).toBe("X1.S3");
            const checks = ss.sessions.slice(0, 2).flatMap((s) => s.checks);
            expect(checks.every((c) => c.passed || c.revealed)).toBe(true);
            if (checks.length > 0) expect(checks.filter((c) => c.revealed)).toHaveLength(1);
            expect(plan).toMatchObject({ kind: "capstone", mapItemId: "X1.S3" });
            break;
          }
          case "X1 released":
            expect((await me.api<{ status: string }>("GET", "/api/capstones/X1")).status).toBe("released");
            break;
          case "ladder L3": {
            expect(ladder).toMatchObject({ level: 3, realism: 1 });
            const projects = await me.api<{ items: Transcription[] }>("GET", "/api/transcriptions");
            const l3 = projects.items.filter((t) => t.ladderLevel === 3);
            expect(l3).toHaveLength(1);
            expect(l3[0]?.currentVersion).toBe(0);
            expect(gym.next).toMatchObject({
              gymId: "GYM.02",
              kind: "ladder",
              ladderLevel: 3,
              realism: 2,
              ownAudioFallback: true,
            });
            expect(plan).toMatchObject({ kind: "gym", mapItemId: "GYM.02" });
            break;
          }
          case "own-audio project": {
            const projects = await me.api<{ items: Transcription[] }>("GET", "/api/transcriptions");
            const own = projects.items.find((t) => t.sourceKind === "own-audio");
            expect(own).toMatchObject({
              currentVersion: 1,
              checklist: { contour: 2, rhythm: 1, landing: 1 },
            });
            expect(own?.regions).toHaveLength(2);
            expect(own?.settings).toMatchObject({ rate: 0.75, loop: { startS: 3, endS: 6 } });
            expect((await h.req("GET", `/api/audio/${own?.audioId}`)).status).toBe(200);
            // Settings › Data reads the recordings' sizes from the backup info (kit's request).
            const info = await me.api<BackupInfo>("GET", "/api/backup");
            expect(info.ownAudio).toMatchObject({ files: 1, unusedFiles: 0, unusedBytes: 0 });
            expect(info.ownAudio?.bytes).toBeGreaterThan(1000);
            expect(gym.next).toMatchObject({ gymId: "GYM.02", kind: "own-audio", transcriptionId: own?.id });
            expect(plan).toMatchObject({
              kind: "gym",
              mapItemId: "GYM.02",
              title: "Transcription Gym: your own audio",
            });
            break;
          }
        }
      } finally {
        await h.close();
      }
    }, 90_000);

  test("`mic: false` works for a Wave 4 point: Quiet mode, nothing waits for a voice", async () => {
    const { h, me } = await learner(real);
    try {
      await me.api("POST", "/api/dev/seed", { point: "after U07.L03 (gym due)", mic: false });
      const plan = await me.today();
      expect(plan.kind).toBe("gym");
      expect(plan.warmup.items.some((i) => i.mic)).toBe(false);
    } finally {
      await h.close();
    }
  }, 90_000);

  test("`recordings: false`: the releases are on the album with no recording yet", async () => {
    const { h, me } = await learner(real);
    try {
      await me.api("POST", "/api/dev/seed", { point: "C0 released", recordings: false });
      const album = (await me.api("GET", "/api/album")) as { tracks: { id: string }[] };
      expect(album.tracks.length).toBe(1);
      const t = (await me.api("GET", `/api/album/tracks/${album.tracks[0]?.id}`)) as {
        versions: { hasAudio: boolean }[];
      };
      expect(t.versions.map((v) => v.hasAudio)).toEqual([false]);
    } finally {
      await h.close();
    }
  }, 90_000);
});

describe("the music of the seeded pieces", () => {
  test("C2's seeded song passes C2's brief on the real grader; the S1 draft is the loop then the landing", async () => {
    const { gradeCapstone, lintOak } = await import("@oak/grader");
    const c2 = real.capstones.find((c) => c.id === "C2");
    const brief = c2?.brief;
    if (brief === undefined) throw new Error("C2 has no brief");
    const unlocked = new Set(real.toolbox.map((t) => t.id as string));
    const ctx = {
      exerciseGlobalId: "C2/brief",
      key: { tonic: "C", mode: "major" } as const,
      meter: "4/4" as const,
      bpm: 96,
      params: {},
      attemptNo: 1,
      firstAttempt: true,
      rung: 0 as const,
      tutorHints: 0,
      extraReplays: 0,
      lint: {
        profile: "graded" as const,
        unlocked: unlocked as never,
        allowPreview: false,
        meter: "4/4" as const,
        key: null,
      },
    };
    const song = await gradeCapstone({ exercise: brief, response: { code: C2_SONG }, ctx });
    expect({
      status: song.status,
      unmet: (song.rubric ?? []).filter((r) => r.required && !r.ok).map((r) => r.ruleId),
    }).toEqual({
      status: "pass",
      unmet: [],
    });
    const loop = await gradeCapstone({ exercise: brief, response: { code: C2_CHORDS }, ctx });
    const ok = new Map((loop.rubric ?? []).map((r) => [r.ruleId, r.ok]));
    expect(ok.get("schema")).toBe(true);
    expect(ok.get("cadence")).toBe(true);
    expect(recordingSeconds(C2_SONG)).toBe(20);
    // The voicing gate's stand-in cadence is plain note names a learner can type at U05.L07.
    const lint = lintOak(
      HAND_VOICED_CADENCE,
      { profile: "studio", unlocked: unlocked as never, allowPreview: false, meter: "4/4", key: null },
      real.toolbox,
    );
    expect(lint.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  }, 60_000);
});
