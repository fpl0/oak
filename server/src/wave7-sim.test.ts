// Wave 7 through the HTTP API on the real course (lessons not written yet stand in; JC4's standard is a test
// rendition until author:repertoire writes one): simulated learners take Today's plan every day through the three
// advanced tracks in a random order of their own — the focus switched when a track has nothing to start, and now and
// then for no reason (interleaving) — to session 270 and sixty days beyond. Checked every day, against the server's
// own answers and an independent model of contracts §2.6, §4.3, §7.6, §9.1 and wave7.md §5:
//  - the warm-up stays within the budget of the day's kind (lesson 4/5/6 minutes by target, checkpoint and capstone
//    3, gym 4);
//  - nothing is scheduled before it opens: a track lesson after its gate (§4.3) and the lessons before it in its track
//    (J2.L04 the one passed over while U14.CP is not passed), a track checkpoint after every lesson it covers and on a
//    later day, a track capstone after its gate (AC2's three conditions), capstone sessions in order; a sound that
//    arrives at a capstone session's start (horns at RC1.S2, choir at AC2.S1) is granted by then;
//  - the order inside a track is fixed and the order between tracks is the learner's: with the focus on a track its
//    session is the New block (`plan.track` says where it stands) unless a core checkpoint is due or a core capstone is
//    under way; the focus never moves the core map;
//  - no dead day: a plan every day, never a review day while the focused track has something to start;
//  - the Coda's `next` is what Today plans on the next day (carry f6) when nothing changed in between;
//  - the whole course completes once, at the session that finished it, and stays complete; after it Today is a
//    review, gym or Studio day and the gym slot keeps its every-5th-session rhythm on review days;
//  - backup → import into a fresh server → the same plan, tracks, focus, whole course, album and progress.
import { beforeAll, describe, expect, test } from "bun:test";
import type {
  CapstoneSessions,
  CourseProgress,
  GymSession,
  LadderItem,
  SessionPlan,
  SessionSummary,
  TrackFocus,
  Unlock,
  WholeCourse,
} from "@oak/api";
import type { ContentSource } from "./content/types.ts";
import { realCourse } from "./testing/course.ts";
import { gradeResult, type Harness, harness } from "./testing/harness.ts";
import { rng, SimLearner } from "./testing/learner.ts";
import { withX2 } from "./testing/wave5.ts";
import { withCft } from "./testing/wave6.ts";
import { withJc4 } from "./testing/wave7.ts";

const CORE_UNITS = [
  "U00",
  "U01",
  "U02",
  "U03",
  "U04",
  "U05",
  "U06",
  "U07",
  "U08",
  "U09",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
];
const TRACK_UNITS = ["J1", "J2", "J3", "J4", "J5", "R1", "R2", "R3", "A1", "A2"];

let course: ContentSource;
beforeAll(async () => {
  const real = await realCourse({ standInUnits: [...CORE_UNITS, ...TRACK_UNITS] });
  course = withJc4(withCft(withX2(real)));
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const START = Date.parse("2026-11-15T17:00:00.000Z");
const BUDGET = { lesson: { 15: 240, 20: 300, 25: 360 }, checkpoint: 180, capstone: 180, gym: 240 } as const;
const DAYS_AFTER = 60;
type T = "J" | "R" | "A";

/** The fixed order inside each track (contracts §2.6), the model's own copy. */
const ORDER: Record<T, string[]> = {
  J: [
    ...["J1.L01", "J1.L02", "J1.L03", "J1.L04", "J1.L05", "J2.L01", "J2.L02", "J2.L03", "J2.L04", "J.CP1"],
    ...["JC1.S1", "JC1.S2", "J3.L01", "J3.L05", "J3.L02", "J3.L03", "J3.L04", "J4.L01", "J4.L02", "J4.L03"],
    ...["J4.L04", "JC2.S1", "JC2.S2", "J5.L01", "J5.L02", "J5.L03", "J5.L04", "J5.L05", "J.CP2", "JC3.S1"],
    ...["JC3.S2", "JC3.S3", "JC4.S1", "JC4.S2", "JC4.S3"],
  ],
  R: [
    ...["R1.L01", "R1.L02", "R1.L03", "R1.L04", "R1.L06", "R1.L05", "R2.L01", "R2.L02", "R2.L03", "R2.L04"],
    ...["R2.L05", "R3.L01", "R3.L02", "R3.L03", "R3.L04", "R3.L05", "R.CP", "RC1.S1", "RC1.S2", "RC2.S1"],
    ...["RC2.S2"],
  ],
  A: [
    ...["A1.L01", "A1.L02", "A1.L03", "A1.L04", "A1.L05", "A1.L06", "A1.L07", "A2.L01", "A2.L02", "A2.L08"],
    ...["A2.L09", "A2.L03", "A2.L07", "A2.L04", "A2.L05", "A2.L06", "A.CP", "AC1.S1", "AC1.S2", "AC1.S3"],
    ...["AC2.S1", "AC2.S2", "AC2.S3"],
  ],
};
const trackOf = (id: string): T | null =>
  (["J", "R", "A"] as const).find((t) => ORDER[t].includes(id)) ?? null;
/** §4.3: what each track lesson needs besides the lessons before it. */
const LESSON_GATE = (id: string): string[] => {
  if (/^J[13]\.|^J2\.L0[1-3]|^R/.test(id)) return ["U13.CP"];
  if (id === "J2.L04") return ["U14.CP"];
  if (/^J4\./.test(id)) return ["U15.L06"];
  if (/^J5\./.test(id)) return ["U17.CP"];
  if (/^A1\.L0[1-4]/.test(id)) return ["U03.L02"];
  if (/^A1\./.test(id)) return ["U09.CP"];
  if (/^A2\./.test(id)) return ["U10.CP"];
  return [];
};
const CAPSTONE_GATE: Record<string, string[]> = {
  JC1: ["J.CP1"],
  JC2: ["J4.L04"],
  JC3: ["J.CP2"],
  JC4: ["J.CP2"],
  RC1: ["R.CP"],
  RC2: ["R.CP"],
  AC1: ["A.CP", "U11.CP"],
  AC2: ["A.CP", "J3.L04", "R1.L05"],
};
const CP_COVERS: Record<string, string[]> = {
  "J.CP1": ORDER.J.slice(0, 8),
  "J.CP2": ["J2.L04", ...ORDER.J.filter((id) => /^J[34]\.L|^J5\.L0[1-4]/.test(id))],
  "R.CP": ORDER.R.filter((id) => /^R\d\.L/.test(id)),
  "A.CP": ORDER.A.filter((id) => /^A\d\.L/.test(id)),
};

interface Profile {
  name: string;
  seed: number;
  target: 15 | 20 | 25;
  from: string;
  order: T[];
  /** Chance a day switches the focus to another open track for no reason (interleaving). */
  wander: number;
  skip: number;
  backupEvery: number;
}
const PROFILES: Profile[] = [
  {
    name: "jazz-first",
    seed: 71,
    target: 20,
    from: "core complete, tracks untouched",
    order: ["J", "R", "A"],
    wander: 0.05,
    skip: 0.08,
    backupEvery: 47,
  },
  {
    name: "sound-then-rhythm",
    seed: 72,
    target: 25,
    from: "core complete, tracks untouched",
    order: ["A", "R", "J"],
    wander: 0.2,
    skip: 0.12,
    backupEvery: 37,
  },
  // Tracks taken beside the core from U13.CP on: J2.L04 passed over until U14.CP, J4 after U15.L06, J5 after U17.CP,
  // core checkpoints and capstones under way keep the New block whatever the focus.
  {
    name: "beside-the-core",
    seed: 73,
    target: 15,
    from: "tracks open (after U13.CP)",
    order: ["R", "J", "A"],
    wander: 0.3,
    skip: 0.05,
    backupEvery: 59,
  },
  randomProfile(Number(process.env.OAK_SIM_SEED ?? 76)),
];

/**
 * A fourth learner whose order between the tracks, daily target, interleaving and starting point are drawn from a
 * seed: `OAK_SIM_SEED=<n> bun test --isolate server/src/wave7-sim.test.ts` replays any of them (the default, 76,
 * takes J, then A, then R from the end of the core, the one order the three above leave out).
 */
function randomProfile(seed: number): Profile {
  const r = rng(seed * 7919);
  const order: T[] = ["J", "R", "A"];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j] as T, order[i] as T];
  }
  return {
    name: `random order (seed ${seed}: ${order.join("→")})`,
    seed,
    target: ([15, 20, 25] as const)[Math.floor(r() * 3)] as 15 | 20 | 25,
    from: r() < 0.25 ? "tracks open (after U13.CP)" : "core complete, tracks untouched",
    order,
    wander: Math.round(r() * 30) / 100,
    skip: 0.1,
    backupEvery: 41,
  };
}

class Sim {
  readonly me: SimLearner;
  readonly r: () => number;
  readonly failures: string[] = [];
  readonly done = new Set<string>();
  readonly doneDay = new Map<string, string>();
  readonly kinds = new Map<string, number>();
  focus: TrackFocus["focus"] = "core";
  courseSeen = 0;
  courseDay: string | null = null;
  daysAfter = 0;
  backups = 0;
  nextChecks = 0;
  expectedNext: { day: string; id: string | null; kind: string } | null = null;

  constructor(
    readonly h: Harness,
    readonly p: Profile,
  ) {
    this.me = new SimLearner(h, course, p.seed);
    this.r = rng(p.seed * 7919);
  }
  fail(day: string, what: string): void {
    this.failures.push(`[${this.p.name} ${day}] ${what}`);
  }
  has(id: string): boolean {
    return this.done.has(id);
  }
  /** A track has something the learner may start, by the model (written, open, in order). */
  trackOpen(t: T): boolean {
    return ORDER[t].some((id) => !this.has(id) && this.startable(id));
  }
  startable(id: string): boolean {
    if (/\.CP\d?$/.test(id)) return (CP_COVERS[id] ?? []).every((l) => this.has(l));
    const cap = /^(.+)\.S(\d+)$/.exec(id);
    if (cap !== null) {
      const n = Number(cap[2]);
      // AC1's tunes (wave7.md §5.3): Sweet Georgia Brown also needs U15.L05; St. Louis Blues only once written.
      const tune =
        cap[1] !== "AC1" || course.songs.some((s) => s.id === "song.st-louis-blues") || this.has("U15.L05");
      return (
        tune &&
        (CAPSTONE_GATE[cap[1] as string] ?? []).every((g) => this.has(g)) &&
        (n === 1 || this.has(`${cap[1]}.S${n - 1}`))
      );
    }
    if (!LESSON_GATE(id).every((g) => this.has(g))) return false;
    const t = trackOf(id) as T;
    const before = ORDER[t].slice(0, ORDER[t].indexOf(id)).filter((x) => /\.L\d{2}$/.test(x));
    return before.every((l) => this.has(l) || l === "J2.L04" || /^A1\.L0[1-4]$/.test(l));
  }

  check(day: string, plan: SessionPlan): void {
    const budget =
      plan.kind === "lesson" || plan.kind === "review" || plan.kind === "light"
        ? BUDGET.lesson[this.p.target]
        : plan.kind === "checkpoint"
          ? BUDGET.checkpoint
          : plan.kind === "capstone"
            ? BUDGET.capstone
            : plan.kind === "gym"
              ? BUDGET.gym
              : null;
    if (budget !== null && plan.warmup.budgetSec !== budget)
      this.fail(day, `${plan.kind} warm-up budget ${plan.warmup.budgetSec}, want ${budget}`);
    if (plan.warmup.plannedSec > plan.warmup.budgetSec)
      this.fail(day, `warm-up ${plan.warmup.plannedSec}s over the ${plan.warmup.budgetSec}s budget`);
    if (plan.focus !== this.focus) this.fail(day, `plan.focus ${plan.focus}, want ${this.focus}`);
    const id = plan.mapItemId as string | null;
    const t = id === null ? null : trackOf(id);
    if (t !== null && id !== null) {
      // Nothing of a track before it opens; the track's fixed order.
      if (!this.startable(id)) this.fail(day, `${id} scheduled before it opens`);
      // A due track checkpoint is scheduled (§7.6) and may come before an enrichment lesson (J5.L05) it does not cover.
      // An opened capstone comes before the lessons left (wave7.md §6), as its track order puts it after its gate.
      if (!/\.CP\d?$/.test(id) && !/^[JRA]C\d\.S/.test(id))
        for (const prev of ORDER[t].slice(0, ORDER[t].indexOf(id)))
          if (/\.L\d{2}$/.test(prev) && !this.has(prev) && this.startable(prev) && prev !== "J2.L04")
            this.fail(day, `${id} before ${prev}`);
      if (/\.CP\d?$/.test(id))
        for (const l of CP_COVERS[id] ?? [])
          if (this.doneDay.get(l) === day) this.fail(day, `${id} on the day ${l} was completed`);
      if (plan.track?.trackId !== t) this.fail(day, `${id} with plan.track ${JSON.stringify(plan.track)}`);
      if (this.focus !== t) this.fail(day, `${id} of ${t} with the focus on ${this.focus}`);
    } else if (plan.track !== null && plan.track !== undefined) this.fail(day, "plan.track on a core day");
    // No dead day: with the focus on a track that has something to start, its session is the New block unless the
    // core holds it (a due core checkpoint, a core capstone under way).
    if (this.focus !== "core" && t === null) {
      const offered = (plan.trackOffers ?? []).some((o) => o.trackId === this.focus);
      const coreHolds =
        plan.kind === "checkpoint" || (plan.kind === "capstone" && /\.S[2-9]$/.test(id ?? ""));
      if (offered && !coreHolds)
        this.fail(day, `focus ${this.focus} has a session but Today is ${plan.kind} ${id}`);
      const model = ORDER[this.focus].find((x) => !this.has(x) && this.startable(x));
      if (model !== undefined && !coreHolds)
        this.fail(
          day,
          `focus ${this.focus}: ${model} can be started but Today is ${plan.kind} ${id} (${plan.note})`,
        );
    }
    // The course's stage never goes back.
    if (this.courseDay !== null && plan.course !== "complete")
      this.fail(day, `course went back to ${plan.course}`);
    if (this.courseDay !== null && (plan.kind === "lesson" || plan.kind === "checkpoint"))
      this.fail(day, `after the whole course: ${plan.kind} ${id}`);
    // The Coda's next line is what Today plans the next day (nothing changed in between).
    const e = this.expectedNext;
    if (e !== null && e.day === day) {
      this.nextChecks++;
      if (e.id !== id || e.kind !== plan.kind)
        this.fail(day, `yesterday's Coda said next ${e.kind} ${e.id}, Today is ${plan.kind} ${id}`);
    }
    this.expectedNext = null;
  }

  async chooseFocus(day: string): Promise<void> {
    const open = (t: T) => this.trackOpen(t);
    const current = this.focus === "core" ? null : this.focus;
    let want: T | null = current !== null && open(current) ? current : null;
    if (want === null || this.r() < this.p.wander) {
      const candidates = this.p.order.filter((x) => open(x) && x !== current);
      want = candidates[0] ?? want;
    }
    if (want !== null && want !== this.focus) {
      const f = await this.me.api<TrackFocus>("PUT", "/api/tracks/focus", { focus: want });
      if (f.focus !== want) this.fail(day, `focus ${f.focus}, want ${want}`);
      this.focus = want;
      this.expectedNext = null;
    }
  }

  async day(nextDay: string): Promise<void> {
    const plan = await this.me.today();
    const day = plan.day;
    await this.chooseFocus(day);
    const p = this.focus === plan.focus ? plan : await this.me.today();
    this.kinds.set(p.kind, (this.kinds.get(p.kind) ?? 0) + 1);
    this.check(day, p);
    const ses = await this.me.startSession(p);
    for (const item of p.warmup.items) await this.me.doItem(ses.id, item);
    const id = p.mapItemId as string | null;
    switch (p.kind) {
      case "lesson":
        await this.me.doLesson(id as string, ses.id);
        await this.me.completeLesson(id as string, ses.id);
        this.mark(id as string, day);
        break;
      case "checkpoint": {
        const { outcome } = await this.me.checkpoint(id as string, ses.id, {
          gating: 0.95,
          levelSetting: 0.9,
        });
        if (!outcome.passed) this.fail(day, `${id} failed at 0.95`);
        else this.mark(id as string, day);
        break;
      }
      case "capstone":
        await this.capstone(day, id as string, ses.id);
        break;
      case "gym":
        await this.gymDay(id as string, ses.id);
        this.mark(id as string, day);
        break;
      default:
        break;
    }
    const s = await this.me.endSession(ses.id);
    this.summary(day, s);
    if ((s.courseComplete ?? null) !== null) {
      // The moment's numbers count the session that completes the course (wave 7 closer: it read 258 on 258).
      const fresh = await this.me.api<WholeCourse>("GET", "/api/course/whole");
      const got = s.courseComplete?.stats;
      if (got?.sessions !== fresh.stats.sessions || got?.days !== fresh.stats.days)
        this.fail(
          day,
          `courseComplete counts ${got?.sessions} on ${got?.days}, the course ${fresh.stats.sessions} on ${fresh.stats.days}`,
        );
    }
    if (s.next !== undefined && s.next !== null)
      this.expectedNext = { day: nextDay, id: s.next.mapItemId as string | null, kind: s.next.kind };
    if (this.courseDay !== null && this.courseDay !== day) this.daysAfter++;
  }

  mark(id: string, day: string): void {
    this.done.add(id);
    this.doneDay.set(id, day);
  }

  summary(day: string, s: SessionSummary): void {
    const unlocked = new Set(s.unlocks.map((u) => u.itemId));
    if (s.session.mapItemId === "AC2.S1" && !unlocked.has("snd.choir"))
      this.fail(day, "AC2.S1 started without the choir granted at its start");
    if ((s.courseComplete ?? null) !== null) {
      this.courseSeen++;
      if (s.courseComplete?.stage !== "complete")
        this.fail(day, `courseComplete with ${s.courseComplete?.stage}`);
      for (const t of ["J", "R", "A"] as const)
        for (const id of ORDER[t]) if (!this.has(id)) this.fail(day, `courseComplete before ${id}`);
      this.courseDay = day;
    }
  }

  async capstone(day: string, sessionId: string, oakSession: string): Promise<void> {
    const cap = sessionId.replace(/\.S\d+$/, "");
    const def = course.capstones.find((c) => c.id === cap);
    const meta = course.syllabus.capstones.find((c) => c.id === cap);
    const total = meta?.sessions ?? def?.sessions ?? 1;
    const last = sessionId === `${cap}.S${total}`;
    const sk = await this.me.sketch(`${cap} draft`, "capstone", cap, oakSession);
    const ss = await this.me.api<CapstoneSessions>("POST", `/api/capstones/${cap}/drafts`, {
      capstoneSessionId: sessionId,
      sessionId: oakSession,
      sketchId: sk.id,
      sketchVersion: sk.currentVersion,
    });
    const mine = ss.sessions.find((s) => s.capstoneSessionId === sessionId);
    if (mine?.status !== "in_progress") this.fail(day, `${sessionId} after its draft: ${mine?.status}`);
    for (const c of mine?.checks ?? [])
      await this.h.json("POST", `/api/capstones/${cap}/checks/${c.checkId}`, {
        capstoneSessionId: sessionId,
        stage: c.stage,
        sketchId: sk.id,
        sketchVersion: sk.currentVersion,
        result: gradeResult({ exerciseId: `${cap}/${c.checkId}`, score: 1, mode: "capstone" }),
      });
    if (last) {
      if (def?.kind !== "transcribe" || (def.sessionDefs ?? []).some((s) => (s.rubric ?? []).length > 0))
        await this.me.api("POST", `/api/capstones/${cap}/checks`, {
          sessionId: oakSession,
          sketchId: sk.id,
          sketchVersion: sk.currentVersion,
          result: gradeResult({ exerciseId: `${cap}/brief`, score: 0.95, mode: "capstone" }),
        });
      const rel = await this.h.json("POST", `/api/capstones/${cap}/release`, {
        sessionId: oakSession,
        sketchId: sk.id,
        sketchVersion: sk.currentVersion,
        title: cap,
        flavour: null,
        linerNotesMd: `${cap}, first take.`,
        theoryTags: [],
        includeReviewNote: false,
      });
      if (rel.status !== 200) this.fail(day, `${cap} release → ${rel.status} ${JSON.stringify(rel.body)}`);
      for (let n = 1; n <= total; n++) this.mark(`${cap}.S${n}`, day);
    } else {
      await this.me.api("POST", `/api/capstones/${cap}/sessions`, {
        sessionId: oakSession,
        capstoneSessionId: sessionId,
        sketchId: sk.id,
        flavour: null,
      });
      this.mark(sessionId, day);
    }
    if (sessionId === "RC1.S2") {
      const u = await this.me.api<{ items: Unlock[] }>("GET", "/api/unlocks");
      if (!u.items.some((x) => x.itemId === "snd.horns")) this.fail(day, "RC1.S2 without horns");
    }
  }

  async gymDay(gymId: string, oakSession: string): Promise<void> {
    const g = await this.me.api<GymSession>("POST", "/api/gym/sessions", {
      sessionId: oakSession,
      kind: "ladder",
      transcriptionId: null,
    });
    if (g.gymId !== gymId) this.fail("gym", `gym.start gave ${g.gymId}, Today said ${gymId}`);
    const item = await this.me.api<LadderItem>("POST", "/api/ladder/items", { sessionId: oakSession, gymId });
    if (item.stages === null)
      await this.h.json("POST", `/api/ladder/items/${item.itemId}/submissions`, {
        sessionId: oakSession,
        code: 'drums: s("bd sd")',
        rung: 0,
      });
  }

  async views(h: Harness) {
    const get = async (path: string) => (await h.json("GET", path)).body;
    return {
      today: await get("/api/session/today"),
      tracks: await get("/api/tracks"),
      focus: await get("/api/tracks/focus"),
      whole: await get("/api/course/whole"),
      album: await get("/api/album"),
      progress: await get("/api/lessons/progress"),
      ac2: await get("/api/capstones/AC2/gate"),
    };
  }

  async backupRoundTrip(day: string): Promise<void> {
    const before = await this.views(this.h);
    const exp = await this.h.req("GET", "/api/backup/export");
    const archive = new Uint8Array(await exp.arrayBuffer());
    const fresh = await harness({ dev: true, content: course, now: this.h.clock.now().toISOString() });
    try {
      const imp = await fresh.destructive("POST", "/api/backup/import", "backup.import", "*", archive);
      if (imp.status !== 200) this.fail(day, `import ${imp.status}`);
      const after = await this.views(fresh);
      for (const k of Object.keys(before) as (keyof typeof before)[])
        if (JSON.stringify(after[k]) !== JSON.stringify(before[k]))
          this.fail(day, `after restore, ${k} differs`);
      this.backups++;
    } finally {
      await fresh.close();
    }
  }
}

describe("Wave 7 simulation: the three tracks in the learner's order to session 270 and sixty days beyond", () => {
  for (const p of PROFILES)
    test(`${p.name}: every day per the rules, the whole course completed once, then review days`, async () => {
      const h = await harness({ dev: true, content: course, now: new Date(START).toISOString() });
      const sim = new Sim(h, p);
      try {
        await sim.me.api("PUT", "/api/profile", { timezone: "UTC", targetMinutes: p.target });
        const seed = await sim.me.api<{ done: string[] }>("POST", "/api/dev/seed", {
          point: p.from,
          targetMinutes: p.target,
        });
        for (const id of seed.done) sim.mark(id, "seed");
        let t = START;
        for (let d = 0; d < 520 && sim.daysAfter < DAYS_AFTER; d++) {
          t += DAY;
          h.clock.set(new Date(t).toISOString());
          if (sim.r() < p.skip) {
            sim.expectedNext = null;
            continue;
          }
          const tomorrow = new Date(t + DAY).toISOString().slice(0, 10);
          await sim.day(tomorrow);
          if (d % p.backupEvery === p.backupEvery - 1) await sim.backupRoundTrip(`day ${d}`);
        }
        await sim.backupRoundTrip("end");
        console.log(
          p.name,
          JSON.stringify([...sim.kinds]),
          `course ${sim.courseDay}`,
          `next checked ${sim.nextChecks}`,
          `backups ${sim.backups}`,
        );
        expect(sim.failures.slice(0, 30)).toEqual([]);
        expect(sim.courseSeen).toBe(1);
        expect(sim.daysAfter).toBeGreaterThanOrEqual(DAYS_AFTER);
        expect(sim.nextChecks).toBeGreaterThan(20);
        const whole = await sim.me.api<WholeCourse>("GET", "/api/course/whole");
        expect({ stage: whole.stage, done: whole.sessionsDone, total: whole.sessionsTotal }).toEqual({
          stage: "complete",
          done: 270,
          total: 270,
        });
        expect(whole.album).toMatchObject({ released: 20, total: 20 });
        const progress = await sim.me.api<CourseProgress>("GET", "/api/lessons/progress");
        expect(progress.course).toBe("complete");
        // The learner's order between tracks: the first track of the profile's order was finished first.
        const lastOf = (tr: T) => Math.max(...ORDER[tr].map((id) => [...sim.done].indexOf(id)));
        const firstTrack = p.order[0] as T;
        for (const other of p.order.slice(1))
          if (p.wander < 0.1) expect(lastOf(firstTrack)).toBeLessThan(lastOf(other));
        expect(sim.backups).toBeGreaterThanOrEqual(2);
      } finally {
        await h.close();
      }
    }, 900_000);
});
