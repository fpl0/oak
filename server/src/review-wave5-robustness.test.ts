// Adversarial review of Wave 5 data and scheduling (review:robustness): learners with random behaviour walk the
// course through the HTTP API from "after X1" through U08–U11, U09.CP–U11.CP, C3, C4, C5, X2 and on for weeks past
// the end of written content, taking the side lessons A1.L01–L04 at random legal points. Besides taking Today's
// plan, they misbehave:
//  - a capstone session is sometimes left open (draft saved, the day's Oak session ended without completing it):
//    the next day Today offers the same capstone session again, and nothing else takes its place;
//  - a lesson completion is sometimes sent twice: the map counts it once;
//  - a ladder submission (L4, L5 per phrase, L6 per stage) is sometimes sent twice with its idempotency key: it
//    counts once, and the same key with another body is refused;
//  - a released track is re-recorded: each recording is another take, the newest plays, none is lost (d20);
//  - a side lesson's completion is retried: track A counts it once, the core map not at all.
// Checked every day: the warm-up within the budget of the day's kind, nothing before it opens, a capstone in
// progress never interrupted, gym slots per the rule, side lessons never the New block; and every few days
// backup → import into a fresh server → the same plan, gym, ladder, songs, side lessons, progress, capstones and
// transcriptions (save the c2 review flag), every album recording byte for byte, and every restored transcription
// version held for review (c2) until confirmed once (200, then 409).
import { beforeAll, describe, expect, test } from "bun:test";
import type {
  AlbumTrack,
  CapstoneSessions,
  CourseProgress,
  GymSession,
  LadderItem,
  LadderState,
  SessionPlan,
  TranscriptionDetail,
} from "@oak/api";
import type { ContentSource } from "./content/types.ts";
import { realCourse } from "./testing/course.ts";
import { gradeResult, type Harness, harness } from "./testing/harness.ts";
import { rng, SimLearner } from "./testing/learner.ts";
import { withX2 } from "./testing/wave5.ts";

let course: ContentSource;
beforeAll(async () => {
  const real = await realCourse({
    standInUnits: ["U00", "U01", "U02", "U03", "U04", "U05", "U06", "U07", "U08", "U09", "U10", "U11", "A1"],
  });
  // Pinned to the course as Wave 5 shipped it: Wave 6 lessons authored now (U12–U17) would replace its review days.
  const lessons = real.lessons.filter(
    (l) => (!/^A1\.L0[5-7]$/.test(l.id) || l.title.indexOf("(stand-in)") < 0) && !/^U1[2-9]\./.test(l.id),
  );
  course = withX2({ ...real, lessons });
});

const DAY = 24 * 3_600_000;
const START = Date.parse("2026-11-13T17:00:00.000Z");
const BUDGET = { lesson: { 15: 240, 20: 300, 25: 360 }, checkpoint: 180, capstone: 180, gym: 240 } as const;
const SIDE = ["A1.L01", "A1.L02", "A1.L03", "A1.L04"];
const GATE: Record<string, string> = { C3: "U09.CP", C4: "U10.CP", C5: "U11.CP", X2: "C5.S2" };
const isTranscription = (id: string) => id.startsWith("GYM.") || /^X\d+\.S\d+$/.test(id);
const isCore = (id: string) => /^U\d+\./.test(id) || /^(C\d+|X\d+)\.S\d+$/.test(id);
const keyOf = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
/** A short valid 16-bit mono WAV whose samples depend on `seed` (each take differs byte for byte). */
const wav = (seed: number): Uint8Array => {
  const n = 800;
  const v = new DataView(new ArrayBuffer(44 + n * 2));
  const ascii = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++)
    v.setInt16(44 + 2 * i, Math.round(8000 * Math.sin((i * (seed + 1) * 2 * Math.PI) / 40)), true);
  return new Uint8Array(v.buffer);
};

interface Profile {
  name: string;
  seed: number;
  target: 15 | 20 | 25;
  skip: number;
  abandon: number;
  retry: number;
  side: number;
  backupEvery: number;
}
const PROFILES: Profile[] = [
  {
    name: "restless",
    seed: 91,
    target: 20,
    skip: 0.12,
    abandon: 0.3,
    retry: 0.4,
    side: 0.2,
    backupEvery: 29,
  },
  {
    name: "short-gappy",
    seed: 92,
    target: 15,
    skip: 0.3,
    abandon: 0.45,
    retry: 0.25,
    side: 0.1,
    backupEvery: 41,
  },
];

class Robust {
  readonly me: SimLearner;
  readonly r: () => number;
  readonly failures: string[] = [];
  readonly history: string[] = [];
  readonly sideDone: string[] = [];
  gyms = 0;
  abandoned: string | null = null;
  stats = {
    abandoned: 0,
    retriedCompletes: 0,
    retriedSubmissions: 0,
    conflicts: 0,
    rerecords: 0,
    backups: 0,
  };
  reviewDaysPast = 0;

  constructor(
    readonly h: Harness,
    readonly p: Profile,
  ) {
    this.me = new SimLearner(h, course, p.seed);
    this.r = rng(p.seed * 104_729);
  }
  fail(day: string, what: string): void {
    this.failures.push(`[${this.p.name} ${day}] ${what}`);
  }
  done(id: string): boolean {
    return this.history.includes(id);
  }
  inProgress(): string | null {
    for (const c of course.capstones)
      if (this.done(`${c.id}.S1`) && !this.done(`${c.id}.S${c.sessions}`))
        for (let k = 2; k <= c.sessions; k++) if (!this.done(`${c.id}.S${k}`)) return `${c.id}.S${k}`;
    return null;
  }
  sinceLast(): number {
    let n = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const id = this.history[i] as string;
      if (isTranscription(id)) break;
      // d19: a reviews-only session counts towards the slot like a core session.
      if (isCore(id) || id.startsWith("review:")) n++;
    }
    return n;
  }

  check(day: string, plan: SessionPlan): void {
    const budget =
      plan.kind === "checkpoint"
        ? BUDGET.checkpoint
        : plan.kind === "capstone"
          ? BUDGET.capstone
          : plan.kind === "gym"
            ? BUDGET.gym
            : BUDGET.lesson[this.p.target];
    if (plan.warmup.budgetSec !== budget)
      this.fail(day, `${plan.kind} budget ${plan.warmup.budgetSec}, want ${budget}`);
    if (plan.warmup.plannedSec > plan.warmup.budgetSec)
      this.fail(day, `warm-up ${plan.warmup.plannedSec}s over budget`);
    const id = plan.mapItemId as string | null;
    if (id !== null && SIDE.includes(id)) this.fail(day, `side lesson ${id} as the New block`);
    if (plan.sideLesson && (plan.kind === "checkpoint" || plan.kind === "capstone"))
      this.fail(day, `side lesson offered on a ${plan.kind} day`);
    // A capstone session left open yesterday is today's session again.
    if (this.abandoned !== null && id !== this.abandoned)
      this.fail(day, `capstone ${this.abandoned} left open, but Today offers ${plan.kind} ${id}`);
    const inProgress = this.inProgress();
    if (inProgress !== null && id !== inProgress)
      this.fail(day, `capstone ${inProgress} interrupted by ${plan.kind} ${id}`);
    if (plan.kind === "gym") {
      if (inProgress !== null || this.abandoned !== null) this.fail(day, "a gym slot inside a capstone");
      if (this.sinceLast() < 4) this.fail(day, `a gym slot after ${this.sinceLast()} core sessions`);
      const want = `GYM.${String(this.gyms + 1).padStart(2, "0")}`;
      if (id !== want) this.fail(day, `gym ${id}, want ${want}`);
    }
    if (plan.kind === "lesson" && id !== null) {
      const order = course.syllabus.defaultOrder;
      for (const l of order.slice(0, order.indexOf(id as never)))
        if (/^U\d+\.L\d+$/.test(l) && course.lessons.some((x) => x.id === l) && !this.done(l))
          this.fail(day, `${id} before ${l}`);
    }
    if (plan.kind === "capstone" && id !== null) {
      const gate = GATE[id.split(".")[0] as string];
      if (gate !== undefined && !this.done(gate)) this.fail(day, `${id} before ${gate}`);
    }
  }

  async day(): Promise<void> {
    const plan = await this.me.today();
    const day = plan.day;
    this.check(day, plan);
    if (plan.sideLesson?.placement === "alternative" && this.abandoned === null && this.r() < this.p.side) {
      await this.side(day, plan.sideLesson.lessonId, plan);
      return;
    }
    const ses = await this.me.startSession(plan);
    for (const item of plan.warmup.items) await this.me.doItem(ses.id, item);
    const id = plan.mapItemId as string | null;
    switch (plan.kind) {
      case "lesson":
        await this.lesson(day, id as string, ses.id);
        break;
      case "checkpoint": {
        const { outcome } = await this.me.checkpoint(id as string, ses.id, {
          gating: 0.95,
          levelSetting: 0.9,
        });
        if (outcome.passed) this.history.push(id as string);
        else this.fail(day, `${id} failed at 0.95`);
        break;
      }
      case "capstone":
        await this.capstone(day, id as string, ses.id);
        break;
      case "gym":
        await this.gym(day, id as string, ses.id);
        break;
      default:
        if (this.done("X2.S2")) this.reviewDaysPast++;
        if (plan.kind === "review" && this.done("U07.L01")) this.history.push(`review:${day}`);
    }
    await this.me.endSession(ses.id);
  }

  async lesson(day: string, id: string, oakSession: string): Promise<void> {
    const before = await this.me.api<CourseProgress>("GET", "/api/lessons/progress");
    await this.me.doLesson(id, oakSession);
    await this.me.completeLesson(id, oakSession);
    if (this.r() < this.p.retry) {
      // The same completion again (a retried request): never a 5xx, never counted twice.
      const sk = await this.me.sketch(`${id} — Make again`, "lesson-make", id, oakSession);
      const again = await this.h.json("POST", `/api/lessons/${id}/complete`, {
        sessionId: oakSession,
        sketchId: sk.id,
        lessonVersion: this.me.lesson(id).version,
        contentHash: `hash-${this.me.lesson(id).version}`,
        splitPart: null,
      });
      if (again.status >= 500) this.fail(day, `${id} completed again: ${again.status}`);
      this.stats.retriedCompletes++;
    }
    const after = await this.me.api<CourseProgress>("GET", "/api/lessons/progress");
    if (after.mapDone !== before.mapDone + 1)
      this.fail(day, `${id}: map ${before.mapDone} → ${after.mapDone}`);
    this.history.push(id);
  }

  async side(day: string, lessonId: string, plan: SessionPlan): Promise<void> {
    const before = await this.me.api<CourseProgress>("GET", "/api/lessons/progress");
    const ses = await this.me.api<{ id: string }>("POST", "/api/session/start", {
      kind: "lesson",
      mapItemId: lessonId,
      targetMinutes: this.p.target,
    });
    await this.me.doLesson(lessonId, ses.id);
    await this.me.completeLesson(lessonId, ses.id);
    if (this.r() < this.p.retry) await this.me.completeLesson(lessonId, ses.id).catch(() => null);
    await this.me.endSession(ses.id);
    this.sideDone.push(lessonId);
    const after = await this.me.api<CourseProgress>("GET", "/api/lessons/progress");
    // Wave 7: a side lesson is 1 in track A of the 259-session map (contracts §9.6); the core's part never moves.
    if (after.mapDone - (after.sideLessons?.done ?? 0) !== before.mapDone - (before.sideLessons?.done ?? 0))
      this.fail(day, `side lesson ${lessonId} moved the core map`);
    if ((after.sideLessons?.done ?? 0) !== this.sideDone.length)
      this.fail(day, `track A counts ${after.sideLessons?.done}, want ${this.sideDone.length}`);
    const again = await this.me.today();
    if (again.mapItemId !== plan.mapItemId)
      this.fail(day, `${lessonId} displaced ${plan.mapItemId} (${again.mapItemId})`);
  }

  async capstone(day: string, sessionId: string, oakSession: string): Promise<void> {
    const cap = sessionId.split(".")[0] as string;
    const def = course.capstones.find((c) => c.id === cap);
    const last = sessionId === `${cap}.S${def?.sessions}`;
    const sk = await this.me.sketch(`${cap} draft`, "capstone", cap, oakSession);
    const ss = await this.me.api<CapstoneSessions>("POST", `/api/capstones/${cap}/drafts`, {
      capstoneSessionId: sessionId,
      sessionId: oakSession,
      sketchId: sk.id,
      sketchVersion: sk.currentVersion,
    });
    // Left open: the draft is saved, the day ends, the session is not completed.
    if (this.abandoned === null && this.r() < this.p.abandon) {
      this.abandoned = sessionId;
      this.stats.abandoned++;
      return;
    }
    this.abandoned = null;
    const mine = ss.sessions.find((s) => s.capstoneSessionId === sessionId);
    for (const c of mine?.checks ?? []) {
      const now = await this.me.api<CapstoneSessions>("GET", `/api/capstones/${cap}/sessions`);
      const st = now.sessions
        .flatMap((s) => s.checks)
        .find((x) => x.checkId === c.checkId && x.stage === c.stage);
      const r = await this.h.json("POST", `/api/capstones/${cap}/checks/${c.checkId}`, {
        capstoneSessionId: sessionId,
        stage: c.stage,
        sketchId: sk.id,
        sketchVersion: sk.currentVersion,
        result: gradeResult({ exerciseId: `${cap}/${c.checkId}`, score: 0.93, mode: "capstone" }),
      });
      if (st?.open === true ? r.status !== 200 : r.status !== 409)
        this.fail(day, `${cap} ${c.checkId} (open ${st?.open}) → ${r.status}`);
    }
    if (!last) {
      await this.me.api("POST", `/api/capstones/${cap}/sessions`, {
        sessionId: oakSession,
        capstoneSessionId: sessionId,
        sketchId: sk.id,
        flavour: null,
      });
      this.history.push(sessionId);
      return;
    }
    if (def?.kind !== "transcribe")
      await this.me.api("POST", `/api/capstones/${cap}/checks`, {
        sessionId: oakSession,
        sketchId: sk.id,
        sketchVersion: sk.currentVersion,
        result: gradeResult({ exerciseId: `${cap}/brief`, score: 0.95, mode: "capstone" }),
      });
    const rel = await this.me.api<{ track: { id: string; currentVersion: number } }>(
      "POST",
      `/api/capstones/${cap}/release`,
      {
        sessionId: oakSession,
        sketchId: sk.id,
        sketchVersion: sk.currentVersion,
        title: cap,
        flavour: null,
        linerNotesMd: `${cap}, first take.`,
        theoryTags: [],
        includeReviewNote: false,
      },
    );
    const path = `/api/album/tracks/${rel.track.id}/versions/${rel.track.currentVersion}/audio`;
    const first = await this.h.req("PUT", path, wav(1), { "content-type": "audio/wav" });
    if (first.status !== 200) this.fail(day, `${cap} recording ${first.status}`);
    // d20 (the learner's decision of 2026-11-13; it replaces c11's confirm): re-recording keeps every take. A second
    // recording is another take that plays by default, with or without the old replace nonce; nothing is replaced.
    const bare = await this.h.req("PUT", path, wav(2), { "content-type": "audio/wav" });
    if (bare.status !== 200) this.fail(day, `${cap} re-recorded: ${bare.status}`);
    const nonce = (await (
      await this.h.req("POST", "/api/confirm", {
        action: "album.audio.replace",
        target: `${rel.track.id}/v${rel.track.currentVersion}`,
      })
    ).json()) as { nonce: string };
    const ok = await this.h.req("PUT", path, wav(3), {
      "content-type": "audio/wav",
      "x-oak-confirm": nonce.nonce,
    });
    if (ok.status !== 200) this.fail(day, `${cap} re-recorded with the old nonce: ${ok.status}`);
    const bytesOf = async (q: string) =>
      new Uint8Array(await (await this.h.req("GET", `${path}${q}`)).arrayBuffer());
    if (Bun.hash(await bytesOf("")) !== Bun.hash(wav(3)))
      this.fail(day, `${cap}: the newest take does not play`);
    for (const [take, n] of [
      [1, 1],
      [2, 2],
      [3, 3],
    ] as const)
      if (Bun.hash(await bytesOf(`?take=${take}`)) !== Bun.hash(wav(n)))
        this.fail(day, `${cap}: take ${take} was lost`);
    this.stats.rerecords++;
    for (let k = 1; k <= (def?.sessions ?? 1); k++)
      if (!this.done(`${cap}.S${k}`)) this.history.push(`${cap}.S${k}`);
  }

  async gym(day: string, gymId: string, oakSession: string): Promise<void> {
    const offer = await this.me.api<LadderState>("GET", "/api/ladder");
    if (offer.levelUp !== null) await this.me.api("PUT", "/api/ladder", { level: offer.levelUp.to });
    const g = await this.me.api<GymSession>("POST", "/api/gym/sessions", {
      sessionId: oakSession,
      kind: "ladder",
      transcriptionId: null,
    });
    if (g.gymId !== gymId) this.fail(day, `gym.start ${g.gymId}, Today ${gymId}`);
    const item = await this.me.api<LadderItem>("POST", "/api/ladder/items", { sessionId: oakSession, gymId });
    const bodies: Record<string, unknown>[] =
      item.level === 5
        ? (item.phrases ?? []).map((_, k) => ({ phrase: k + 1 }))
        : item.level === 6
          ? [
              { stage: "bass" },
              { stage: "changes" },
              ...(item.phrases ?? []).map((_, k) => ({ stage: "melody", phrase: k + 1 })),
            ]
          : item.stages === null
            ? [{}]
            : item.stages.map((stage) => ({ stage }));
    for (const extra of bodies) {
      const key = keyOf(`${this.p.name}-${gymId}-${JSON.stringify(extra)}-k`);
      const body = {
        sessionId: oakSession,
        code: 'drums: s("bd sd")',
        rung: 0,
        idempotencyKey: key,
        ...extra,
      };
      const first = await this.h.json("POST", `/api/ladder/items/${item.itemId}/submissions`, body);
      if (first.status !== 200) {
        this.fail(
          day,
          `${item.itemId} ${JSON.stringify(extra)} → ${first.status} ${JSON.stringify(first.body).slice(0, 160)}`,
        );
        continue;
      }
      if (this.r() < this.p.retry) {
        const before = await this.me.api<LadderState>("GET", "/api/ladder");
        const again = await this.h.json("POST", `/api/ladder/items/${item.itemId}/submissions`, body);
        const after = await this.me.api<LadderState>("GET", "/api/ladder");
        if (again.status !== 200) this.fail(day, `retried submission → ${again.status}`);
        if (JSON.stringify(before) !== JSON.stringify(after))
          this.fail(day, "a retried submission changed the ladder");
        const other = await this.h.json("POST", `/api/ladder/items/${item.itemId}/submissions`, {
          ...body,
          code: 'drums: s("bd*2 sd")',
        });
        if (other.status !== 409) this.fail(day, `same key, another body → ${other.status}`);
        else this.stats.conflicts++;
        this.stats.retriedSubmissions++;
      }
    }
    this.gyms++;
    this.history.push(g.gymId);
  }

  async views(h: Harness) {
    const get = async (path: string) => (await h.json("GET", path)).body;
    const album = (await h.json<{ tracks: AlbumTrack[] }>("GET", "/api/album")).body.tracks;
    const media: Record<string, string> = {};
    for (const t of album)
      for (let v = 1; v <= t.currentVersion; v++) {
        const res = await h.req("GET", `/api/album/tracks/${t.id}/versions/${v}/audio`);
        media[`${t.capstoneId}/v${v}`] = `${res.status}:${Bun.hash(new Uint8Array(await res.arrayBuffer()))}`;
      }
    const list = (await h.json<{ items: { id: string }[] }>("GET", "/api/transcriptions")).body.items;
    const details: unknown[] = [];
    for (const t of list) {
      const d = (await h.json<TranscriptionDetail>("GET", `/api/transcriptions/${t.id}`)).body;
      details.push(JSON.parse(JSON.stringify(d, (k, v) => (k === "reviewBeforeRun" ? undefined : v))));
    }
    const { passedCodeImported: _i, ...voicing } = (await get("/api/gates/voicing")) as Record<
      string,
      unknown
    >;
    return {
      today: await get("/api/session/today"),
      gym: await get("/api/gym"),
      ladder: await get("/api/ladder"),
      songs: await get("/api/ladder/songs"),
      side: await get("/api/side-lessons"),
      progress: await get("/api/lessons/progress"),
      capstones: await Promise.all(["C3", "C4", "C5", "X2"].map((c) => get(`/api/capstones/${c}/sessions`))),
      album: album.map((t) => ({ ...t })),
      media,
      transcriptions: details,
      voicing,
    };
  }

  async backup(day: string): Promise<void> {
    const before = await this.views(this.h);
    const archive = new Uint8Array(await (await this.h.req("GET", "/api/backup/export")).arrayBuffer());
    const fresh = await harness({ dev: true, content: course, now: this.h.clock.now().toISOString() });
    try {
      const imp = await fresh.destructive("POST", "/api/backup/import", "backup.import", "*", archive);
      if (imp.status !== 200) this.fail(day, `import ${imp.status}`);
      const after = await this.views(fresh);
      for (const k of Object.keys(before) as (keyof typeof before)[])
        if (JSON.stringify(after[k]) !== JSON.stringify(before[k]))
          this.fail(
            day,
            `after restore, ${k} differs: ${JSON.stringify(before[k]).slice(0, 160)} → ${JSON.stringify(after[k]).slice(0, 160)}`,
          );
      // c2: every transcription version that came back through the import is held for review until confirmed.
      const list = (await fresh.json<{ items: { id: string }[] }>("GET", "/api/transcriptions")).body.items;
      let confirmed = false;
      for (const t of list) {
        const d = (await fresh.json<TranscriptionDetail>("GET", `/api/transcriptions/${t.id}`)).body;
        for (const v of d.versions) {
          if (v.reviewBeforeRun !== true)
            this.fail(day, `restored ${t.id} v${v.version} not held for review`);
          if (!confirmed) {
            const c1 = await fresh.json("POST", `/api/transcriptions/${t.id}/versions/${v.version}/confirm`);
            // A version whose code fails the strict lint is refused (400) and stays held; a clean one confirms once.
            if (c1.status === 200) {
              const c2 = await fresh.json(
                "POST",
                `/api/transcriptions/${t.id}/versions/${v.version}/confirm`,
              );
              if (c2.status !== 409) this.fail(day, `confirmed twice: ${c2.status}`);
              confirmed = true;
            } else if (c1.status !== 400) this.fail(day, `confirm → ${c1.status}`);
          }
        }
      }
      this.stats.backups++;
    } finally {
      await fresh.close();
    }
  }
}

describe("Wave 5 robustness: random learners from X1 through C3–C5 and X2, and past the written course", () => {
  for (const p of PROFILES)
    test(`${p.name}: capstones left open, retried completions and submissions, re-recordings, backups`, async () => {
      const h = await harness({ dev: true, content: course, now: new Date(START).toISOString() });
      const sim = new Robust(h, p);
      try {
        await sim.me.api("PUT", "/api/profile", { timezone: "UTC", targetMinutes: p.target });
        const seed = await sim.me.api<{ done: string[] }>("POST", "/api/dev/seed", {
          point: "after X1 (U08.L02 next)",
          targetMinutes: p.target,
        });
        sim.history.push(...seed.done);
        sim.gyms = seed.done.filter((id) => id.startsWith("GYM.")).length;
        let t = START;
        // A backup is due every `backupEvery` days and taken on the first day the learner plays once it is due: a
        // skipped day no longer drops it (Oak 2.0 W2's longer course moved the skips onto the day-40 backup of
        // short-gappy, so the run had 2 backups instead of 3).
        let lastBackup = -1;
        for (let d = 0; d < 320 && sim.reviewDaysPast < 25; d++) {
          t += DAY;
          h.clock.set(new Date(t).toISOString());
          if (sim.abandoned === null && sim.r() < p.skip) continue;
          await sim.day();
          if (d - lastBackup >= p.backupEvery) {
            await sim.backup(`day ${d}`);
            lastBackup = d;
          }
        }
        await sim.backup("end");
        console.log(
          p.name,
          JSON.stringify(sim.stats),
          `side ${sim.sideDone.join(" ")}`,
          `gyms ${sim.gyms}`,
          `review days ${sim.reviewDaysPast}`,
        );
        expect(sim.failures.slice(0, 25)).toEqual([]);
        for (const id of ["U09.CP", "C3.S3", "U10.CP", "C4.S2", "U11.CP", "C5.S2", "X2.S2"])
          expect({ id, done: sim.done(id) }).toEqual({ id, done: true });
        expect(sim.stats.abandoned).toBeGreaterThanOrEqual(1);
        expect(sim.stats.retriedSubmissions).toBeGreaterThanOrEqual(1);
        expect(sim.stats.rerecords).toBe(4);
        expect(sim.stats.backups).toBeGreaterThanOrEqual(3);
        expect(sim.reviewDaysPast).toBeGreaterThanOrEqual(25);
      } finally {
        await h.close();
      }
    }, 900_000);
});

describe("the ladder refuses a level it has not offered, and says what opens it", () => {
  test("a jump of several levels, and L6 asked for at L5 before two songs", async () => {
    for (const [point, level, message] of [
      ["after X1 (U08.L02 next)", 6, "the ladder moves up one level at a time: L2 is next"],
      [
        "ladder L5",
        6,
        "L6 opens after two folk songs transcribed at L5 (a released X1 counts as one), once U11.L05 is done",
      ],
    ] as const) {
      const h = await harness({ dev: true, content: course, now: new Date(START).toISOString() });
      try {
        await h.json("PUT", "/api/profile", { timezone: "UTC", targetMinutes: 20 });
        expect((await h.json("POST", "/api/dev/seed", { point, targetMinutes: 20 })).status).toBe(200);
        const r = await h.json<{ error: { message: string } }>("PUT", "/api/ladder", { level });
        expect({ point, status: r.status, message: r.body.error.message }).toEqual({
          point,
          status: 409,
          message,
        });
      } finally {
        await h.close();
      }
    }
  }, 120_000);
});
