// Wave 6 integration seams on the real course (integrate:server): what the builders asked of the server once their
// surfaces met it. Each test starts from a Wave 6 dev seed and asserts the wire shape the surface reads.
//  - The skill map shows nothing as practised before it is taught: a composite family's set (fam.mix.harmony at
//    U13) is no evidence for a skill whose introducing lesson the learner has not started (U15–U17, J, R).
//  - The course map counts the core's sessions of contracts §2.5 (185) and no more.
//  - CF-T is an alternative on Today while it is open and unfinished; on its slot day the compose capstone that
//    waits is one.
//  - The own-audio checklist's form row (OWN_AUDIO_FORM_ROW) is self-reported evidence for the form skills.
//  - A ladder item gives a tune's key plan with its key; an L8 standard keeps its sections off the wire until the
//    form map is behind.
import { afterAll, describe, expect, test } from "bun:test";
import {
  type CourseProgress,
  type DevSeedResult,
  type LadderItem,
  type LadderSong,
  OWN_AUDIO_FORM_ROW,
  type SessionPlan,
  type SkillMap,
  type Transcription,
  type Unlock,
} from "@oak/api";
import type { SongDef } from "@oak/content-kit";
import { loadContent } from "./content/loader.ts";
import type { ContentSource } from "./content/types.ts";
import { makeWav } from "./services/dev-seed.ts";
import { CONTENT_DIR } from "./testing/course.ts";
import { type Harness, harness } from "./testing/harness.ts";
import { dropSharedSeeds, sharedSeed } from "./testing/seed-cache.ts";

const NOW = "2026-11-14T12:00:00.000Z";
let realP: Promise<ContentSource> | null = null;
const real = () => {
  realP ??= loadContent({ contentDir: CONTENT_DIR });
  return realP;
};

afterAll(dropSharedSeeds);

async function seeded(point: string, content?: ContentSource): Promise<Harness> {
  const source = content ?? (await real());
  const h = await harness({ dev: true, content: source, now: NOW });
  await h.json("PUT", "/api/profile", { timezone: "UTC" });
  // A point several tests start from is built once and restored for the others (testing/seed-cache.ts).
  const r = await sharedSeed<DevSeedResult>(h, source, { point });
  if (r.status !== 200) {
    await h.close();
    throw new Error(`seed ${point}: ${r.status} ${JSON.stringify(r.body)}`);
  }
  return h;
}
async function ok<T>(h: Harness, method: string, path: string, body?: unknown): Promise<T> {
  const r = await h.json<T>(method, path, body);
  if (r.status < 200 || r.status >= 300)
    throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

describe("the skill map shows nothing as practised before it is taught", () => {
  test("after U13.CP: no set evidence and no level above available for a skill whose lesson is not started", async () => {
    const content = await real();
    const h = await seeded("tracks open (after U13.CP)");
    try {
      const map = await ok<SkillMap>(h, "GET", "/api/skills/map");
      const started = (lessonId: string) => {
        const st = h.server.deps.repos.lessons.progress(lessonId)?.status;
        return st === "completed" || st === "in_progress";
      };
      const early: string[] = [];
      let checked = 0;
      for (const skill of content.skills) {
        const by = skill.introducedBy;
        if (by === undefined || by === null || started(by)) continue;
        checked++;
        const ev = h.server.deps.repos.mastery
          .evidenceOf(skill.id)
          .filter((e) => /-set$|^self-transcription$/.test(e.sourceKind));
        const node = map.nodes.find((n) => n.skillId === skill.id);
        if (ev.length > 0 || (node !== undefined && !["new", "available"].includes(node.level)))
          early.push(`${skill.id} (${by}): ${node?.level} with ${ev.length} set evidence`);
      }
      // U15–U17 skills, the advanced tracks' and the side lessons': dozens of them are not taught yet here.
      expect(checked).toBeGreaterThan(30);
      expect(early).toEqual([]);
      // A skill that IS taught keeps its set evidence (the composite still feeds U12–U13 skills).
      const e11 = h.server.deps.repos.mastery.evidenceOf("E11").filter((e) => e.sourceKind === "srs-set");
      expect(e11.length).toBeGreaterThan(0);
    } finally {
      await h.close();
    }
  }, 240_000);
});

describe("the course map and Today's alternatives", () => {
  // Counts of contracts 2.2 (Oak 2.0 W2, content/syllabus.ts SESSION_COUNTS): core 191, whole course 270 (were 185, 259).
  test("mapTotal is the core's 191 sessions until a track lesson is written, then all 270 (wave7.md §5)", async () => {
    const content = await real();
    const h = await seeded("after X2 (U12.L02 next)");
    try {
      const p = await ok<CourseProgress>(h, "GET", "/api/lessons/progress");
      const trackWritten = content.lessons.some((l) => /^[JR]\d\.|^A2\./.test(l.id));
      expect(p.mapTotal).toBe(trackWritten ? 270 : 191);
      expect(p.mapDone).toBeLessThan(p.mapTotal);
    } finally {
      await h.close();
    }
  }, 240_000);

  test("CF-T's next session is an alternative while it is open; on its slot day the waiting compose capstone is one", async () => {
    // The CF-T slot day: C6 opened at U14.CP and waits; Today is CF-T.S1 in the slot.
    let h = await seeded("CF-T open (U15.L01 done)");
    try {
      const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
      expect({ kind: plan.kind, id: plan.mapItemId, fills: plan.slot?.fills }).toEqual({
        kind: "capstone",
        id: "CF-T.S1",
        fills: "cf-t",
      });
      expect(plan.alternatives.map((a) => a.mapItemId)).toContain("C6.S1");
      // Full-arrangement mode comes with CF-T.S1's completion (contracts §3.2 has no START note; CF.md).
      const unlocks = await ok<{ items: Unlock[] }>(h, "GET", "/api/unlocks");
      expect(unlocks.items.some((u) => u.itemId === "tb.feature.transcribe.full")).toBe(false);
    } finally {
      await h.close();
    }
    // A C6 day with CF-T under way: CF-T.S2 can be opened from Today at any time.
    h = await seeded("C6 open");
    try {
      const plan = await ok<SessionPlan>(h, "GET", "/api/session/today");
      expect(plan.mapItemId).toBe("C6.S1");
      const unlocks = await ok<{ items: Unlock[] }>(h, "GET", "/api/unlocks");
      expect(unlocks.items.some((u) => u.itemId === "tb.feature.transcribe.full")).toBe(true);
      expect(plan.alternatives).toContainEqual(
        expect.objectContaining({ kind: "capstone", mapItemId: "CF-T.S2" }),
      );
    } finally {
      await h.close();
    }
  }, 240_000);
});

describe("Transcribe's Wave 6 givens", () => {
  test("the own-audio checklist's form row is self-reported evidence for the form skills, once sections are taught", async () => {
    const content = await real();
    const formSkills = new Set(
      (content.families.find((f) => f.id === "fam.frm.sections")?.skills ?? []).map(
        (s) => s.skill.split("/")[0] as string,
      ),
    );
    expect(formSkills.size).toBeGreaterThan(0);
    expect(OWN_AUDIO_FORM_ROW.id).toBe("form");
    const formEvidence = async (h: Harness, own: string) => {
      await ok(h, "PATCH", `/api/transcriptions/${own}`, { checklist: { [OWN_AUDIO_FORM_ROW.id]: 2 } });
      return h.server.deps.repos.mastery.allEvidence().filter((e) => e.sourceId === `${own}/form`);
    };
    // At U07 the sections are not taught yet (U09): the row is kept, it is no evidence.
    let h = await seeded("own-audio project");
    try {
      const own = (await ok<{ items: Transcription[] }>(h, "GET", "/api/transcriptions")).items.find(
        (t) => t.sourceKind === "own-audio",
      ) as Transcription;
      expect(await formEvidence(h, own.id)).toEqual([]);
      const t = h.server.deps.repos.transcriptions.get(own.id);
      expect(t?.checklist.form).toBe(2);
    } finally {
      await h.close();
    }
    // After U13.CP (full arrangements are the next step): evidence at 0.3 for the form skills only.
    h = await seeded("tracks open (after U13.CP)");
    try {
      const lib = h.server.deps.services.library;
      const audio = lib.uploadAudio("my-song.wav", makeWav(8000, 2, 196), "audio/wav");
      const own = await lib.createTranscription({
        sourceKind: "own-audio",
        audioId: audio.id,
        songId: null,
        title: "My song",
        artist: null,
        ladderLevel: null,
        templateId: null,
      });
      const ev = await formEvidence(h, own.id);
      expect(ev.length).toBeGreaterThan(0);
      expect(ev.every((e) => formSkills.has(e.skillId) && e.weight === 0.3 && e.score === 1)).toBe(true);
    } finally {
      await h.close();
    }
  }, 240_000);

  test("an L8 item gives the tune's key plan; its sections stay off the wire until the form map is behind", async () => {
    const base = await real();
    // A standard that changes key for its bridge (as a Body and Soul key would): the plan is a given, like the key.
    const KEY_PLAN: NonNullable<SongDef["keyPlan"]> = [
      { bar: 0, key: { tonic: "C", mode: "major" } },
      { bar: 16, key: { tonic: "D", mode: "major" } },
      { bar: 24, key: { tonic: "C", mode: "major" } },
    ];
    const content: ContentSource = {
      ...base,
      songs: base.songs.map((s) =>
        /five-foot-two|aint-she|blackbird/.test(s.id) ? ({ ...s, keyPlan: KEY_PLAN } as SongDef) : s,
      ),
    };
    const h = await seeded("ladder L8", content);
    try {
      const songs = await ok<{ items: LadderSong[] }>(h, "GET", "/api/ladder/songs");
      const item = await ok<LadderItem>(h, "POST", "/api/ladder/items", {
        sessionId: null,
        gymId: null,
        level: 8,
      });
      expect(item.level).toBe(8);
      expect(item.given.keyPlan).toEqual(KEY_PLAN);
      expect(item.project.given?.keyPlan).toEqual(KEY_PLAN);
      // The seeded standard has its form and bass behind: its sections are given now.
      expect(item.phrases?.length).toBe(4);
      // Every other standard's form is still to be found: its sections are not on the wire.
      for (const s of songs.items.filter(
        (x) => x.level === 8 && x.songId !== item.song?.songId && !x.passedStages.includes("form"),
      ))
        expect({ song: s.songId, phrases: s.phrases }).toEqual({ song: s.songId, phrases: [] });
    } finally {
      await h.close();
    }
  }, 240_000);
});
