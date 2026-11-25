// The Wave 5 dev seeds (docs/design/wave5.md §6) on the real course: every point either seeds a learner whose Today is
// what the point promises (or the honest review day while the next lesson is still being written), or answers 400
// naming the content it is missing (X2's songs, an L6 song). Each seeded learner's saved sketches are real course code:
// every version lints clean (the toolbox-aware lint, graded profile) under the learner's unlocks. Points other areas
// rely on are checked in depth: the capstone drafts, the album, the ladder state, the side lessons.
import { beforeAll, describe, expect, test } from "bun:test";
import {
  type AlbumTrackDetail,
  type CapstoneSessions,
  type CapstoneState,
  type DevSeedResult,
  type LadderSong,
  type LadderState,
  type SessionPlan,
  type SideLessons,
  type TranscriptionDetail,
  type Unlock,
  WAVE5_SEED_POINTS,
} from "@oak/api";
import type { UnlockableId } from "@oak/content-kit";
import { lintOak } from "@oak/grader";
import { loadContent } from "./content/loader.ts";
import type { ContentSource } from "./content/types.ts";
import { CONTENT_DIR } from "./testing/course.ts";
import { type Harness, harness } from "./testing/harness.ts";

let real: ContentSource;
beforeAll(async () => {
  real = await loadContent({ contentDir: CONTENT_DIR });
});

const NOW = "2026-11-13T12:00:00.000Z";
const PAUSE = "The next lessons are still being written. Today: a review, then Studio.";

/**
 * What Today holds after each point: the map item, or a review day when that lesson is not written yet. Oak 2.0 W2
 * put U08.L06 after U08.L04 and moved every later gym slot one ordinal on (contracts 2.2 §2.5).
 */
const TODAY: Record<string, { kind: SessionPlan["kind"]; id: string | null }> = {
  "after X1 (U08.L02 next)": { kind: "lesson", id: "U08.L02" },
  "after U08.L04": { kind: "lesson", id: "U08.L06" },
  "after U09.L01": { kind: "lesson", id: "U09.L02" },
  "after U09.L04": { kind: "lesson", id: "U09.L05" },
  "U09.CP due": { kind: "checkpoint", id: "U09.CP" },
  "C3 open": { kind: "capstone", id: "C3.S1" },
  "C3.S2 done": { kind: "capstone", id: "C3.S3" },
  "C3 released": { kind: "gym", id: "GYM.07" },
  "after U10.L02": { kind: "lesson", id: "U10.L03" },
  "after U10.L05": { kind: "gym", id: "GYM.08" },
  "after U10.L08": { kind: "lesson", id: "U10.L09" },
  "U10.CP due": { kind: "checkpoint", id: "U10.CP" },
  "C4 open": { kind: "capstone", id: "C4.S1" },
  "C4 released": { kind: "gym", id: "GYM.10" },
  "after U11.L03": { kind: "lesson", id: "U11.L04" },
  "after U11.L06": { kind: "lesson", id: "U11.L07" },
  "U11.CP due": { kind: "checkpoint", id: "U11.CP" },
  "C5 open": { kind: "capstone", id: "C5.S1" },
  "C5.S1 done": { kind: "capstone", id: "C5.S2" },
  "C5 released": { kind: "capstone", id: "X2.S1" },
  "X2 open": { kind: "capstone", id: "X2.S1" },
  "X2.S1 done": { kind: "capstone", id: "X2.S2" },
  "X2 released": { kind: "lesson", id: "U12.L02" },
  "ladder L5": { kind: "gym", id: "GYM.08" },
  "ladder L6": { kind: "capstone", id: "X2.S1" },
  "ladder level-up due": { kind: "gym", id: "GYM.05" },
  "ladder realism-up due": { kind: "gym", id: "GYM.05" },
  "side lesson offered": { kind: "lesson", id: "U03.L03" },
  "A1.L02 done": { kind: "lesson", id: "U03.L03" },
  "imported own-audio (c2)": { kind: "gym", id: "GYM.02" },
};
/** Points that may answer 400 while their own content is not written, and what the message must name. */
const NEEDS: Record<string, RegExp> = {
  "X2.S1 done": /X2's songs are not written yet/,
  "X2 released": /X2's songs are not written yet/,
  "ladder L6": /needs an L6 song/,
};
const X2_SONGS = ["song.careless-love", "song.st-louis-blues"];

async function ok<T>(h: Harness, method: string, path: string): Promise<T> {
  const r = await h.json<T>(method, path);
  if (r.status !== 200) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

/** Every version of every saved sketch lints clean under the learner's unlocks (real course code). */
async function sketchesLintClean(h: Harness): Promise<string[]> {
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
    if (/^U00\./.test((s as { originId?: string | null }).originId ?? "")) continue;
    const detail = await ok<{ versions: { version: number; code: string }[] }>(
      h,
      "GET",
      `/api/sketches/${s.id}`,
    );
    for (const v of detail.versions) {
      const lint = lintOak(
        v.code,
        { profile: "graded", unlocked, allowPreview: false, meter: "4/4", key: null },
        real.toolbox,
      );
      const errors = lint.diagnostics.filter((d) => d.severity === "error");
      if (errors.length > 0)
        problems.push(`${s.title} v${v.version}: ${errors.map((e) => `${e.id} ${e.message}`).join("; ")}`);
    }
  }
  return problems;
}

describe("Wave 5 dev seeds (wave5.md §6)", () => {
  test("GET /api/dev/seed lists every Wave 5 point", async () => {
    const h = await harness({ dev: true, content: real, now: NOW });
    try {
      const listed = (await ok<{ items: { point: string }[] }>(h, "GET", "/api/dev/seed")).items.map(
        (p) => p.point,
      );
      for (const p of WAVE5_SEED_POINTS)
        expect({ p, listed: listed.includes(p) }).toEqual({ p, listed: true });
    } finally {
      await h.close();
    }
  });

  for (const point of WAVE5_SEED_POINTS)
    test(`“${point}”`, async () => {
      const h = await harness({ dev: true, content: real, now: NOW });
      try {
        await h.json("PUT", "/api/profile", { timezone: "UTC" });
        // With the warm-ups as e2e builds them where a check reads the reviews or the ladder; elsewhere without them
        // (the New block, the unlocks, the capstones and the album do not depend on them).
        const r = await h.json<DevSeedResult & { error?: { message: string } }>("POST", "/api/dev/seed", {
          point,
          ...(/ladder|side|after X1|C3 released/i.test(point) ? {} : { practice: false }),
        });
        const need = NEEDS[point];
        const x2Written = real.songs.some((s) => X2_SONGS.includes(s.id));
        if (r.status === 400) {
          expect({ point, allowed: need !== undefined && !x2Written }).toEqual({ point, allowed: true });
          expect(r.body.error?.message ?? "").toMatch(need as RegExp);
          return;
        }
        expect({ point, status: r.status }).toEqual({ point, status: 200 });
        expect(r.body.lastActiveDay).not.toBeNull();
        const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
        const want = TODAY[point] as { kind: SessionPlan["kind"]; id: string | null };
        const written =
          want.id === null ||
          real.lessons.some((l) => l.id === want.id) ||
          !/^U\d{2}\.L\d{2}$/.test(want.id) ||
          (want.id.startsWith("X2.") && x2Written);
        if (want.id !== null && /^X2\.S/.test(want.id) && !x2Written)
          expect({ point, kind: plan.kind, note: plan.note }).toEqual({ point, kind: "review", note: PAUSE });
        else if (written)
          expect({ point, kind: plan.kind, id: plan.mapItemId as string | null }).toEqual({
            point,
            kind: want.kind,
            id: want.id,
          });
        else
          expect({ point, kind: plan.kind, note: plan.note }).toEqual({ point, kind: "review", note: PAUSE });
        expect({ point, problems: await sketchesLintClean(h) }).toEqual({ point, problems: [] });
        await deepChecks(h, point, plan);
      } finally {
        await h.close();
      }
    }, 120_000);
});

/** What other areas' e2e read from a point, beyond Today. */
async function deepChecks(h: Harness, point: string, plan: SessionPlan): Promise<void> {
  const unlockIds = async () =>
    new Set((await ok<{ items: Unlock[] }>(h, "GET", "/api/unlocks")).items.map((u) => u.itemId));
  const capstone = (id: string) => ok<CapstoneState>(h, "GET", `/api/capstones/${id}`);
  const draftCode = async (id: string): Promise<string> => {
    const st = await capstone(id);
    if (st.sketchId === null) return "";
    const d = await ok<{ versions: { code: string }[] }>(h, "GET", `/api/sketches/${st.sketchId}`);
    return d.versions.at(-1)?.code ?? "";
  };
  switch (point) {
    case "after X1 (U08.L02 next)": {
      expect((await capstone("X1")).status).toBe("released");
      const album = await ok<{ tracks: { capstoneId: string | null }[] }>(h, "GET", "/api/album");
      expect(album.tracks.map((t) => t.capstoneId).sort()).toEqual(expect.arrayContaining(["C2", "X1"]));
      break;
    }
    case "after U08.L04": {
      expect((await unlockIds()).has("tb.const")).toBe(true);
      if (real.families.some((f) => f.id === "fam.rhy.groove-lock" && f.unlock.lesson === "U08.L04"))
        expect(h.server.deps.repos.srs.family("fam.rhy.groove-lock")).not.toBeNull();
      break;
    }
    case "after U09.L04": {
      const ids = await unlockIds();
      for (const t of ["tb.arrange", "tb.signal", "tb.range", "tb.segment", "tb.lens.form"])
        expect({ t, has: ids.has(t) }).toEqual({ t, has: true });
      break;
    }
    case "C3.S2 done": {
      const ss = await ok<CapstoneSessions>(h, "GET", "/api/capstones/C3/sessions");
      // Contracts 1.6 (d13): C3 has a fourth session, the take and the release; it waits for S3.
      expect(ss.sessions.map((s) => s.status)).toEqual(["done", "done", "open", "locked"]);
      const code = await draftCode("C3");
      expect(code).toContain("arrange([8, melVerse], [8, melChorus], [8, melVerse], [8, melChorus])");
      expect(code).toContain('kick: s("bd ~ bd ~")');
      break;
    }
    case "C3 released":
    case "C4 released":
    case "C5 released": {
      const cap = point.slice(0, 2);
      const st = await capstone(cap);
      expect(st.status).toBe("released");
      expect(st.draftChangedSinceCheck).toBe(false);
      const track = await ok<AlbumTrackDetail>(h, "GET", `/api/album/tracks/${st.trackId}`);
      expect(track.versions[0]?.hasAudio).toBe(true);
      expect(track.versions[0]?.linerNotesMd.length).toBeGreaterThan(0);
      break;
    }
    case "X2 released": {
      // X2's seeded draft is tagged with its song and kept in the song's key (closer).
      // The seeder works X2's first written song, in the order X2 lists them (St. Louis Blues once it is written).
      const song = X2_SONGS.map((id) => real.songs.find((x) => x.id === id)).find((x) => x !== undefined);
      if (song === undefined) break;
      const list = await ok<{ items: { id: string; originId: string | null; tags: string[] }[] }>(
        h,
        "GET",
        "/api/sketches",
      );
      const draft = list.items.find((x) => x.originId === "X2");
      expect(draft?.tags).toContain(song.id);
      const detail = await ok<{ versions: { key: { tonic: string; mode: string } | null }[] }>(
        h,
        "GET",
        `/api/sketches/${draft?.id}`,
      );
      for (const v of detail.versions) expect(v.key).toEqual(song.key);
      break;
    }
    case "C5.S1 done": {
      const code = await draftCode("C5");
      expect(code).toContain(".swingBy(1/3, 4)");
      expect(code).toContain("C7!4 F7!2 C7!2 G7 F7 C7 G7");
      break;
    }
    case "ladder L5": {
      const ladder = await ok<LadderState>(h, "GET", "/api/ladder");
      expect({ level: ladder.level, realism: ladder.realism }).toEqual({ level: 5, realism: 0 });
      const songs = (await ok<{ items: LadderSong[] }>(h, "GET", "/api/ladder/songs")).items;
      expect(songs.some((s) => s.level === 5 && s.passedPhrases.includes(1))).toBe(true);
      break;
    }
    case "ladder level-up due": {
      const ladder = await ok<LadderState>(h, "GET", "/api/ladder");
      expect(ladder.level).toBe(4);
      expect(ladder.levelUp?.to).toBe(5);
      break;
    }
    case "ladder realism-up due": {
      const ladder = await ok<LadderState>(h, "GET", "/api/ladder");
      expect({ level: ladder.level, realism: ladder.realism }).toEqual({ level: 2, realism: 1 });
      expect(ladder.history.at(-1)).toMatchObject({ level: 2, realism: 1 });
      expect(ladder.history.at(-1)?.score).toBeGreaterThanOrEqual(0.9);
      break;
    }
    case "side lesson offered": {
      expect(plan.sideLesson).toMatchObject({ lessonId: "A1.L01", placement: "alternative" });
      expect(plan.alternatives.some((a) => a.kind === "lesson" && a.mapItemId === "A1.L01")).toBe(true);
      const side = await ok<SideLessons>(h, "GET", "/api/side-lessons");
      expect(side.open).toBe(true);
      expect(side.items.every((i) => i.status !== "done")).toBe(true);
      break;
    }
    case "imported own-audio (c2)": {
      const list = await ok<{ items: { id: string; sourceKind: string }[] }>(h, "GET", "/api/transcriptions");
      const own = list.items.find((t) => t.sourceKind === "own-audio") as { id: string };
      const d = await ok<TranscriptionDetail>(h, "GET", `/api/transcriptions/${own.id}`);
      expect(d.versions.length).toBeGreaterThan(0);
      expect(d.versions.every((v) => v.reviewBeforeRun === true)).toBe(true);
      // Confirming after the strict lint clears the flag; a second confirm is refused (nothing left to review).
      const v = d.versions[0]?.version as number;
      const c = await h.json("POST", `/api/transcriptions/${own.id}/versions/${v}/confirm`, {
        strictLintPassed: true,
      });
      expect(c.status).toBe(200);
      expect((c.body as { reviewBeforeRun?: boolean }).reviewBeforeRun).toBeUndefined();
      const again = await h.json("POST", `/api/transcriptions/${own.id}/versions/${v}/confirm`, {
        strictLintPassed: true,
      });
      expect(again.status).toBe(409);
      break;
    }
    case "A1.L02 done": {
      const side = await ok<SideLessons>(h, "GET", "/api/side-lessons");
      expect(side.items.filter((i) => i.status === "done").map((i) => i.lessonId)).toEqual([
        "A1.L01",
        "A1.L02",
      ]);
      const ids = await unlockIds();
      for (const t of ["tb.scope", "tb.partials", "tb.hpf", "tb.bpf", "tb.lpq", "tb.lpenv", "tb.lpf"])
        expect({ t, has: ids.has(t) }).toEqual({ t, has: true });
      const a13 = real.lessons.some((l) => l.id === "A1.L03");
      expect(plan.sideLesson?.lessonId ?? null).toBe(a13 ? "A1.L03" : null);
      const progress = await ok<{ sideLessons?: { done: number; total: number } }>(
        h,
        "GET",
        "/api/lessons/progress",
      );
      expect(progress.sideLessons).toEqual({ done: 2, total: 4 });
      break;
    }
    default:
      break;
  }
}
