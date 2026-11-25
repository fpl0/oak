// The dev seeder (`POST /api/dev/seed`, OAK_DEV=1 only): wipes the learner's data and fast-forwards to a named
// point of the default order so other areas' e2e can start where they need to ("after U01.L03", "C0 ready",
// "10-day gap"). It drives the real services, one simulated day per map session with the dev clock moved
// into the past, so unlocks, terms, SRS cards (seeded and reviewed in warm-ups), evidence, can-dos, the
// streak and session telemetry all look as if a learner had done the work. It ends yesterday (or `gapDays`
// ago): today is a fresh day. /dev/listen verdicts survive the wipe (they are QA data, not the learner's).
import type {
  DevClock as DevClockDto,
  DevSeedPoint,
  DevSeedRequest,
  DevSeedResult,
  DrillTrialRecord,
  WarmupItem,
} from "@oak/api";
import { ONBOARDING_STEPS } from "@oak/api";
import {
  type Exercise,
  type GradeResult,
  type HintRung,
  type KeySpec,
  type SongDef,
  stripMarkers,
} from "@oak/content-kit";
import { analyzePiece, capstoneLength, linerNotes, normalize } from "@oak/grader";
import { triggerDdl } from "../db/migrate.ts";
import type { AppDeps } from "../deps.ts";
import { ApiError, badRequest } from "../errors.ts";
import { finishDrill, reviewCard } from "../routes/practice.ts";
import { markForReview } from "./backup.ts";
import { checkSlots } from "./capstone-sessions.ts";
import { LearnerTime } from "./context.ts";
import type { DevClock } from "./dev-clock.ts";
import { seedCacheOf } from "./dev-seed-cache.ts";
import {
  pickStandIn,
  STAND_INS,
  CAPSTONE_DRAFTS as WAVE5_DRAFTS,
  CAPSTONE_KEYS as WAVE5_KEYS,
  WAVE5_SEED_DESCRIPTIONS,
} from "./seed-wave5.ts";
import {
  SECOND_TAB_ID,
  WAVE6_CAPSTONE_DRAFTS,
  WAVE6_CAPSTONE_KEYS,
  WAVE6_SEED_DESCRIPTIONS,
  WAVE6_STAND_INS,
} from "./seed-wave6.ts";
import {
  ac1Versions,
  afterTrackWalk,
  jc4Reharm,
  REVIEW_DAY,
  TRACK_CHECKPOINT_UNIT,
  WAVE7_CAPSTONE_DRAFTS,
  WAVE7_CAPSTONE_KEYS,
  WAVE7_SEED_DESCRIPTIONS,
  WAVE7_STAND_INS,
  WAVE7_WALKS,
  type Wave7Walk,
} from "./seed-wave7.ts";
import { standardGaps } from "./standard-ladder.ts";
import { CAPSTONE_SONGS } from "./track-plan.ts";

const CAPSTONE_DRAFTS: Readonly<Record<string, readonly string[]>> = {
  ...WAVE5_DRAFTS,
  ...WAVE6_CAPSTONE_DRAFTS,
  ...WAVE7_CAPSTONE_DRAFTS,
};
const CAPSTONE_KEYS: Readonly<Record<string, KeySpec>> = {
  ...(WAVE5_KEYS as Record<string, KeySpec>),
  ...(WAVE6_CAPSTONE_KEYS as Record<string, KeySpec>),
  ...(WAVE7_CAPSTONE_KEYS as Record<string, KeySpec>),
};
const ALL_STAND_INS = [...STAND_INS, ...WAVE6_STAND_INS, ...WAVE7_STAND_INS];

const DAY_MS = 86_400_000;

export const SEED_POINTS: readonly DevSeedPoint[] = [
  { point: "fresh", description: "No data at all: the welcome screen and onboarding from the start." },
  {
    point: "onboarding at react (edit <N>)",
    description:
      "A fresh learner who began onboarding today: the welcome, the loop's build-up and the edit are done (the last note changed to N, 0–7; 3 without the suffix), the reaction is next. No mic, no choices, no sketch.",
  },
  { point: "onboarded", description: "Onboarding (U00.L01) finished yesterday; today's lesson is U00.L02." },
  {
    point: "after <SessionId>",
    description:
      "Every default-order session up to and including <SessionId> completed, one per day, the last yesterday (after U01.L03, after U01.CP, after C0.S1). Wave 7: a track session (after J1.L03, after J.CP1, after RC1.S2, after A2.L04) walks the core complete, then the tracks J, R, A in order up to it, the focus on its track.",
  },
  { point: "U01.CP due", description: "U02.L01 done yesterday: today's New block is the U01 checkpoint." },
  {
    point: "U01.CP failed",
    description: "U01.CP failed once (repair sets queued in the warm-up); retake due.",
  },
  {
    point: "U01.CP failed twice",
    description: "Two failed U01.CP attempts, the second at 0.80: the next attempt offers a soft pass.",
  },
  { point: "C0 ready", description: "U01.CP passed yesterday: C0 is open and today's New block is C0.S1." },
  {
    point: "C0 in progress",
    description: "C0.S1 started yesterday with a draft whose requirements check passed; not released yet.",
  },
  { point: "C0 released", description: "C0 released to the album yesterday (Side A track 1, version 1)." },
  { point: "U02.CP due", description: "U03.L01 done yesterday: today's New block is the U02 checkpoint." },
  {
    point: "C1 ready",
    description: "U02.CP passed yesterday: C1 is open; ebass and .lpf() unlock when C1.S1 starts.",
  },
  { point: "C1 in progress", description: "C1.S1 started yesterday with a passing draft; not released yet." },
  { point: "C1 released", description: "C1 released to the album yesterday." },
  // Wave 3 (wave3.md §5.5). The learner of every point has a working mic and a calibrated range (onboarding's
  // mic and range steps); `mic: false` seeds one without a mic (Quiet mode, reason no-mic).
  {
    point: "after U02.CP",
    description:
      "Every default-order session through U02.CP done (U03.L01 the day before it), the last yesterday; today is C1.S1.",
  },
  {
    point: "after U03.L02",
    description:
      "Through C1 (released) and U03.L02 'Degrees in Code', the last yesterday: degree labels, n() and .scale() unlocked; today is U03.L03.",
  },
  {
    point: "U03.CP due",
    description:
      "Every U03 lesson done (and U04.L01 once it is written), the last yesterday; today's New block is the U03 checkpoint.",
  },
  {
    point: "after U03.CP",
    description:
      "U03.CP passed yesterday (after U04.L01 once it is written); today is the next written U04 lesson, or a review day while U04 is being written.",
  },
  {
    point: "U04.CP due",
    description:
      "Every U04 lesson and U05.L01 (written in Wave 4) done, the last yesterday; today's New block is the U04 checkpoint.",
  },
  {
    point: "after U04.CP",
    description:
      "U04.CP passed yesterday. Today is the next written U05 lesson, or a review day (warm-up sets, 'a little more', Studio) with a note that the next lessons are still being written.",
  },
  // Wave 4 (wave4.md §6). Each point ends yesterday; today is a fresh day. Lessons that are not written yet are
  // completed as stand-ins (evidence for the skills they introduce), as in Wave 3; a point whose own content is
  // missing (U05.L07's gate check, X1's songs) answers 400 naming it.
  {
    point: "after U05.L04",
    description:
      "Every default-order session through U05.L04 done (chord symbols C Cm C° C+ met, tb.arp unlocked), the last yesterday; today is U05.L05.",
  },
  {
    point: "U05.L07 gate open",
    description:
      "Through U05.L06; U05.L07 started yesterday with its steps before the gate check passed and one gate attempt at 0.72 (not passed). Today resumes U05.L07 at the gate check. Needs U05.L07 written.",
  },
  {
    point: "after U05.L08",
    description:
      "Through U05.L08 with the voicing gate passed by a typed, unrevealed attempt at ≥ 0.9: chord(), voicing(), rhodes and organ unlocked; today is U06.L01.",
  },
  {
    point: "U05.CP due",
    description: "U05.L01–L08 and U06.L01 done, the last yesterday; today's New block is the U05 checkpoint.",
  },
  {
    point: "after U06.L05",
    description:
      "U05.CP passed, through U06.L05 (Roman numerals tb.feature.rn, function, cadences), the last yesterday; today is U06.L06.",
  },
  {
    point: "U06.CP due",
    description: "U06.L01–L12 and U07.L01 done, the last yesterday; today's New block is the U06 checkpoint.",
  },
  {
    point: "after U07.L03 (gym due)",
    description:
      "U06.CP passed, U07.L01–L03 done: four core sessions since U07.L01 started the slot rule. Today's New block is GYM.01 (ladder L1, R0).",
  },
  {
    point: "after U07.L07",
    description:
      "GYM.01 done (one graded L1 pass), U07.L04–L07, GYM.02 done (no audio project: a ladder session one realism level up, graded pass); today is U07.L08.",
  },
  {
    point: "U07.CP due",
    description:
      "U07.L01–L10 and GYM.03 (ladder, graded pass) done; U08.L01 is not written, so it is left out. Today's New block is the U07 checkpoint.",
  },
  { point: "C2 open", description: "U07.CP passed yesterday: C2 is open and today's New block is C2.S1." },
  {
    point: "C2.S1 done",
    description:
      "C2.S1 completed yesterday with its saved draft: an axis loop I–V–vi–IV–I–V then IV–I in bars 7–8, over drums (no melody yet). Today is C2.S2.",
  },
  {
    point: "C2 released",
    description:
      "C2 released yesterday: album Side A version 1 with the full song (chords and a melody that reuses its bar-1 idea), a 20-second recording and deterministic liner notes, no review. fam.mel.dictation is at level 3, so X1 is closed: “Two more gym sets open X1”, and today is a gym session.",
  },
  {
    point: "X1 open",
    description: "C2 released and fam.mel.dictation at level 4: X1 is open and today's New block is X1.S1.",
  },
  {
    point: "X1.S2 done",
    description:
      "X1.S1–S2 completed with drafts and every phrase check recorded (phrase checks pass at ≥ 0.85; the first one revealed). Today is X1.S3. Needs X1's songs and checks written.",
  },
  {
    point: "X1 released",
    description:
      "X1 released yesterday (chord stages checked, version 1 on the album); today is the next core session.",
  },
  {
    point: "ladder L3",
    description:
      "Through U07.L07 (GYM.01 done, GYM.02 not yet) with the ladder at L3, realism R1, and one L3 item started yesterday (no answer yet). Today's New block is GYM.02: no audio project, so a ladder session (L3, R2).",
  },
  {
    point: "own-audio project",
    description:
      "Through U07.L07 (GYM.02 not yet) with one own-audio project: a 6-second WAV in the data dir, two regions, one code version, the checklist half done (contour 2, rhythm 1, landing 1), player settings. Today's New block is GYM.02 (own audio).",
  },
  {
    point: "<N>-day gap",
    description:
      "After U01.L03 with N days missed since the last activity (3, 10, 21: the return policy of contracts §7.9).",
  },
  // Wave 5 (wave5.md §6). Lessons not written yet are completed as stand-ins (evidence for their skills, a Make of
  // real course code from seed-wave5.ts); a point whose own content is missing (X2's songs, an L6 song) answers 400.
  ...WAVE5_SEED_DESCRIPTIONS,
  // Wave 6 (wave6.md §6). A U12–U17 lesson not written yet is completed as a stand-in (seed-wave6.ts); a point that
  // is about CF-T or ladder L8 answers 400 naming the standard that has no answer key yet, and every other point
  // walks a gym session in each slot CF-T would take until one exists (as Today does: with nothing to transcribe the
  // slot is a gym session).
  ...WAVE6_SEED_DESCRIPTIONS,
  // Wave 7 (wave7.md §6): the core complete (or through U13.CP), then the tracks in the order J, R, A unless the point
  // says otherwise. A track lesson not written yet is completed as a stand-in (seed-wave7.ts), as Wave 6's were; a
  // point that needs a standard JC4 can work on, or a tune AC1 can work on, answers 400 naming what is missing.
  ...WAVE7_SEED_DESCRIPTIONS,
];

/** What a point expands to. */
interface SeedPlan {
  /** The last default-order item to complete (`null`: nothing). */
  upTo: string | null;
  /** After `upTo`: failed attempts of a checkpoint, or an unreleased capstone draft. */
  extra:
    | { kind: "cp-failed"; cpId: string; times: 1 | 2 }
    | { kind: "draft"; capstoneId: string }
    | { kind: "gate-open" }
    | { kind: "ladder-l3" }
    | { kind: "own-audio"; imported?: true }
    | { kind: "onboarding-at"; step: "react"; firstEdit: number }
    // Wave 5
    | { kind: "side"; lessons: string[] }
    | { kind: "ladder-song"; level: 5 | 6 | 8; realism: number }
    // Wave 6
    | { kind: "capstone-open"; capstoneSessionId: string }
    | { kind: "second-take" }
    | { kind: "second-tab" }
    | { kind: "ladder-levelup" }
    | { kind: "ladder-realism" }
    | null;
  /** Wave 4: family levels set after the walk (a learner who did, or did not yet do, the gym sets X1 waits for). */
  familyLevels?: { family: string; level: number }[];
  gapDays: number | null;
  /** An item of the unit the point is about (`U03.CP due` → U03.CP), when `upTo` is of another unit. */
  unit?: string;
  /**
   * Wave 6: the point is about CF-T (or needs it released): with no standard written it answers 400. Without the
   * flag CF-T's sessions are left out of the walk until a standard has an answer key.
   */
  needsCft?: boolean;
  /** Wave 7: the track sessions walked after the core walk, the focus, the horns taken away. */
  wave7?: Wave7Walk;
}

export function needDevClock(d: AppDeps): DevClock {
  if (d.devClock === null) throw new ApiError("unavailable", "the dev clock exists only with OAK_DEV=1");
  return d.devClock;
}

export function clockState(d: AppDeps): DevClockDto {
  const s = needDevClock(d).state();
  return {
    now: s.now.toISOString(),
    day: new LearnerTime(d.services.ctx).day(),
    offsetMs: s.offsetMs,
    frozen: s.frozen,
  };
}

/** Parses a seed point against the default order. Throws 400 for an unknown point or session. */
export function planSeed(point: string, order: readonly string[]): SeedPlan {
  const p = point.trim();
  const lower = p.toLowerCase();
  const before = (id: string): string | null => {
    const i = order.indexOf(id);
    if (i < 0) throw badRequest(`${id} is not in the default order`);
    return i === 0 ? null : (order[i - 1] as string);
  };
  const inOrder = (id: string): string => {
    if (!order.includes(id)) throw badRequest(`${id} is not in the default order`);
    return id;
  };
  if (lower === "fresh") return { upTo: null, extra: null, gapDays: null };
  const onb = /^onboarding at react(?: \(edit ([0-7])\))?$/.exec(lower.replace(/\s+/g, " "));
  if (onb !== null)
    return {
      upTo: null,
      extra: { kind: "onboarding-at", step: "react", firstEdit: Number(onb[1] ?? 3) },
      gapDays: null,
    };
  // Wave 4 points whose names do not follow the Wave 2 patterns (wave4.md §6).
  const named: Record<string, () => SeedPlan> = {
    "u05.l07 gate open": () => ({ upTo: before("U05.L07"), extra: { kind: "gate-open" }, gapDays: null }),
    "after u07.l03 (gym due)": () => ({ upTo: inOrder("U07.L03"), extra: null, gapDays: null }),
    // GYM.02 follows U07.L07 in the default order; the point includes it (today is U07.L08).
    "after u07.l07": () => ({ upTo: inOrder("GYM.02"), extra: null, gapDays: null, unit: "U07.L07" }),
    "c2 open": () => ({ upTo: before("C2.S1"), extra: null, gapDays: null }),
    "c2.s1 done": () => ({ upTo: inOrder("C2.S1"), extra: null, gapDays: null }),
    "c2 released": () => ({
      upTo: inOrder("C2.S2"),
      extra: null,
      gapDays: null,
      familyLevels: [{ family: "fam.mel.dictation", level: 3 }],
    }),
    "x1 open": () => ({
      upTo: inOrder("C2.S2"),
      extra: null,
      gapDays: null,
      familyLevels: [{ family: "fam.mel.dictation", level: 4 }],
    }),
    "x1.s2 done": () => ({ upTo: inOrder("X1.S2"), extra: null, gapDays: null }),
    "x1 released": () => ({ upTo: inOrder("X1.S3"), extra: null, gapDays: null }),
    "ladder l3": () => ({ upTo: inOrder("U07.L07"), extra: { kind: "ladder-l3" }, gapDays: null }),
    "own-audio project": () => ({ upTo: inOrder("U07.L07"), extra: { kind: "own-audio" }, gapDays: null }),
    // Wave 5 (wave5.md §6).
    "after x1 (u08.l02 next)": () => ({ upTo: inOrder("X1.S3"), extra: null, gapDays: null }),
    "c3 open": () => ({ upTo: inOrder("U09.CP"), extra: null, gapDays: null }),
    "c3.s2 done": () => ({ upTo: inOrder("C3.S2"), extra: null, gapDays: null }),
    "c4 open": () => ({ upTo: inOrder("U10.CP"), extra: null, gapDays: null }),
    "c5 open": () => ({ upTo: inOrder("U11.CP"), extra: null, gapDays: null }),
    "c5.s1 done": () => ({ upTo: inOrder("C5.S1"), extra: null, gapDays: null }),
    "x2 open": () => ({ upTo: inOrder("C5.S2"), extra: null, gapDays: null }),
    "x2.s1 done": () => ({ upTo: inOrder("X2.S1"), extra: null, gapDays: null }),
    "x2 released": () => ({ upTo: inOrder("X2.S2"), extra: null, gapDays: null }),
    // The ladder points end the day before a gym slot (Today is a ladder session; its Coda is the c10 card).
    "ladder l5": () => ({
      upTo: inOrder("U10.L05"),
      extra: { kind: "ladder-song", level: 5, realism: 0 },
      gapDays: null,
    }),
    "ladder l6": () => ({
      upTo: inOrder("C5.S2"),
      extra: { kind: "ladder-song", level: 6, realism: 1 },
      gapDays: null,
    }),
    // U09.L03, the day before GYM.05 since Oak 2.0 W2 moved the slots (it was U09.L04).
    "ladder level-up due": () => ({
      upTo: inOrder("U09.L03"),
      extra: { kind: "ladder-levelup" },
      gapDays: null,
    }),
    "ladder realism-up due": () => ({
      upTo: inOrder("U09.L03"),
      extra: { kind: "ladder-realism" },
      gapDays: null,
    }),
    "side lesson offered": () => ({ upTo: inOrder("U03.L02"), extra: null, gapDays: null }),
    "imported own-audio (c2)": () => ({
      upTo: inOrder("U07.L07"),
      extra: { kind: "own-audio", imported: true },
      gapDays: null,
    }),
    "a1.l02 done": () => ({
      upTo: inOrder("U03.L02"),
      extra: { kind: "side", lessons: ["A1.L01", "A1.L02"] },
      gapDays: null,
      unit: "U03.L02",
    }),
    // Wave 6 (wave6.md §6).
    "after x2 (u12.l02 next)": () => ({ upTo: inOrder("X2.S2"), extra: null, gapDays: null }),
    "tracks open (after u13.cp)": () => ({ upTo: inOrder("U13.CP"), extra: null, gapDays: null }),
    "cf-t open (u15.l01 done)": () => ({
      upTo: inOrder("U14.CP"),
      extra: null,
      gapDays: null,
      // U15.L01 (CF-T's gate) precedes U14.CP in the order: it is walked (as a stand-in until it is written).
      unit: "U15.L01",
      needsCft: true,
    }),
    "c6 open": () => ({ upTo: before("C6.S1"), extra: null, gapDays: null }),
    "cf-t.s2 done": () => ({ upTo: inOrder("CF-T.S2"), extra: null, gapDays: null, needsCft: true }),
    "c7 open": () => ({ upTo: inOrder("U17.CP"), extra: null, gapDays: null }),
    "c7.s2 done": () => ({ upTo: inOrder("C7.S2"), extra: null, gapDays: null }),
    "cf-a open": () => ({ upTo: before("CF-A.S1"), extra: null, gapDays: null }),
    "cf-a.s3 done": () => ({ upTo: inOrder("CF-A.S3"), extra: null, gapDays: null }),
    "core complete": () => ({ upTo: inOrder("CF-A.S4"), extra: null, gapDays: null, needsCft: true }),
    "ladder l8": () => ({
      upTo: inOrder("U17.L02"),
      extra: { kind: "ladder-song", level: 8, realism: 1 },
      gapDays: null,
      needsCft: true,
    }),
    "c3.s3 in progress (d13)": () => ({
      upTo: inOrder("C3.S2"),
      extra: { kind: "capstone-open", capstoneSessionId: inOrder("C3.S3") },
      gapDays: null,
    }),
    "c3.s3 done": () => ({ upTo: inOrder("C3.S3"), extra: null, gapDays: null }),
    "two takes (d20)": () => ({ upTo: inOrder("C3.S4"), extra: { kind: "second-take" }, gapDays: null }),
    "second tab (d21)": () => ({ upTo: inOrder("X2.S2"), extra: { kind: "second-tab" }, gapDays: null }),
  };
  const namedPlan = named[lower.replace(/\s+/g, " ")];
  if (namedPlan !== undefined) return namedPlan();
  // Wave 7 (wave7.md §6).
  const w7 = Object.entries(WAVE7_WALKS).find(([k]) => k.toLowerCase() === lower.replace(/\s+/g, " "));
  if (w7 !== undefined)
    return {
      upTo: inOrder(w7[1].coreTo),
      extra: null,
      gapDays: null,
      wave7: w7[1],
      needsCft: w7[1].coreTo === "CF-A.S4",
    };
  if (lower === "onboarded") return { upTo: inOrder("U00.L01"), extra: null, gapDays: null };
  let m = /^after\s+(\S+)$/i.exec(p);
  if (m !== null) {
    const id = (m[1] as string).toUpperCase();
    // Wave 7: a track session (J1.L03, J.CP1, JC1.S2, R2.L04, A.CP …): the core, then J, R and A up to it.
    const track = order.includes(id) ? null : afterTrackWalk(id);
    if (track !== null)
      return { upTo: inOrder(track.coreTo), extra: null, gapDays: null, wave7: track, needsCft: true };
    return { upTo: inOrder(id), extra: null, gapDays: null };
  }
  m = /^(U\d{2}\.CP)\s+due$/i.exec(p);
  if (m !== null) {
    const cpId = (m[1] as string).toUpperCase();
    const upTo = before(cpId);
    // Wave 6 (wave6.md §6): `U14.CP due` holds U15.L01 (CF-T's gate) whether or not it is written yet, so the unit
    // the point reaches is that of its last item, not the checkpoint's.
    const wave6 = Number(cpId.slice(1, 3)) >= 13;
    return { upTo, extra: null, gapDays: null, unit: wave6 && upTo !== null ? upTo : cpId };
  }
  m = /^(U\d{2}\.CP)\s+failed(\s+twice)?$/i.exec(p);
  if (m !== null) {
    const cpId = (m[1] as string).toUpperCase();
    return { upTo: before(cpId), extra: { kind: "cp-failed", cpId, times: m[2] ? 2 : 1 }, gapDays: null };
  }
  m = /^(C\d+|CF-A)\s+(ready|in progress|released)$/i.exec(p);
  if (m !== null) {
    const cap = (m[1] as string).toUpperCase();
    const sessions = order.filter((id) => id.startsWith(`${cap}.S`));
    if (sessions.length === 0) throw badRequest(`${cap} is not in the default order`);
    const state = (m[2] as string).toLowerCase();
    if (state === "released") return { upTo: sessions.at(-1) as string, extra: null, gapDays: null };
    return {
      upTo: before(sessions[0] as string),
      extra: state === "in progress" ? { kind: "draft", capstoneId: cap } : null,
      gapDays: null,
    };
  }
  m = /^(\d{1,3})[- ]day gap$/i.exec(p);
  if (m !== null) return { upTo: inOrder("U01.L03"), extra: null, gapDays: Number(m[1]) };
  throw badRequest(
    `unknown seed point "${point}"; GET /api/dev/seed lists them (${SEED_POINTS.map((s) => s.point).join(", ")})`,
  );
}

/**
 * The default-order items a plan completes, in order. A lesson that is not written yet is completed as a
 * stand-in (evidence for the skills it introduces) only inside the seed point's own unit or before it; one of a
 * later unit is left out, as Today never offers it (`CourseAdapter.next`): "U06.CP due" does not complete
 * U07.L01 until it is written, and "U03.CP due" completes U04.L01 only once it is written.
 */
export function seedItems(d: Pick<AppDeps, "content">, order: readonly string[], plan: SeedPlan): string[] {
  if (plan.upTo === null) return [];
  const unitOf = (id: string) => /^(U\d{2})\./.exec(id)?.[1] ?? null;
  const own = unitOf(plan.unit ?? (plan.extra?.kind === "cp-failed" ? plan.extra.cpId : plan.upTo));
  const cft = cftStandards(d);
  return order
    .slice(0, order.indexOf(plan.upTo) + 1)
    .filter((id) => {
      if (d.content.lessonSite(id) === null || d.content.lessonDef(id) !== null) return true;
      const unit = unitOf(id);
      return own === null || unit === null || unit <= own;
    })
    .map((id) =>
      // Wave 6: with no standard written CF-T has nothing to transcribe. Today then fills its transcription slot with
      // a gym session (contracts §2.5), so the walk does the same: one gym session where each CF-T session stood.
      id.startsWith("CF-T.") && cft.length === 0 ? CFT_SLOT_AS_GYM : id,
    );
}

/** A walk item: the transcription slot CF-T would take, worked as a gym session (no CF-T standard written yet). */
export const CFT_SLOT_AS_GYM = "GYM.slot";

/** The CF-T standards that have an answer key complete enough to work (form map, bass, changes, melody). */
export function cftStandards(d: Pick<AppDeps, "content">): SongDef[] {
  const ids = (d.content.capstoneDef("CF-T") as { song?: readonly string[] } | null)?.song ?? [];
  return ids
    .map((id) => d.content.source.songs.find((x) => x.id === id))
    .filter((x): x is SongDef => x !== undefined && standardGaps(x).length === 0);
}

/** A tiny seeded generator so a seed is the same every time. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A passing (or failing) grade for an authored exercise, with every rubric rule met when it passes. */
export function syntheticGrade(globalId: string, ex: Exercise, score: number): GradeResult {
  const rubric =
    "rubric" in ex && Array.isArray(ex.rubric)
      ? (ex.rubric as { id: string; required: boolean }[]).map((r) => ({
          ruleId: r.id,
          required: r.required,
          ok: score >= 0.8,
        }))
      : undefined;
  return {
    exerciseId: globalId,
    exerciseVersion: ex.version ?? 1,
    attemptNo: 1,
    firstAttempt: true,
    mode: ex.kind === "compose-brief" ? "capstone" : "lesson",
    status: score >= 0.8 ? "pass" : "fail",
    score,
    adjustedScore: score,
    dims: {},
    constraints: [],
    ...(rubric === undefined ? {} : { rubric }),
    diagnostics: [],
    messages: [],
    assist: { rung: 0 as HintRung, tutorHints: 0, extraReplays: 0, revealed: false },
  };
}

const PHASE_MS = { warmup: 240_000, main: 540_000, make: 240_000, coda: 60_000 };
const EMPTY_FLAGS = { lockedTools: [], previewTools: [] };

class Seeder {
  readonly done: string[] = [];
  readonly sketchIds: string[] = [];
  capstoneSketchId: string | null = null;
  trackId: string | null = null;
  readonly #rand: () => number;

  constructor(
    private readonly d: AppDeps,
    private readonly target: 15 | 20 | 25,
    private readonly practice: boolean,
    /** Each capstone release gets a recording (`DevSeedRequest.recordings`, default true). */
    private readonly recordings = true,
  ) {
    this.#rand = rng(0x0a4c);
  }

  get #s() {
    return this.d.services;
  }

  sketch(
    title: string,
    originKind: "lesson-make" | "capstone" | "checkpoint",
    originId: string,
    code: string,
    key: KeySpec = { tonic: "C", mode: "major" },
  ) {
    const saved = this.#s.library.createSketch({
      title,
      originKind,
      originId,
      code,
      bpm: 100,
      meter: "4/4",
      key,
      analysis: null,
      note: null,
      tutorAssisted: false,
      band: null,
      flags: EMPTY_FLAGS,
      ranOk: true,
      sessionId: null,
    });
    this.sketchIds.push(saved.sketch.id);
    return saved.sketch;
  }

  /**
   * The Make of a stand-in (a lesson not written yet, a checkpoint): course code the learner's unlocks allow.
   * Wave 5: the unit's own idea (seed-wave5.ts) once its tools are usable, in the session itself included (contracts
   * §3.1 rule 2); else a degree line over `.scale()` once U03.L02's tools are unlocked, a labelled groove before.
   */
  #standIn(sessionId?: string): string {
    const have = new Set(this.#s.unlocks.ids());
    if (sessionId !== undefined) {
      for (const t of this.d.content.unlockRowsAt(sessionId, "complete")) have.add(t.id);
      for (const t of this.d.content.unlockRowsAt(sessionId, "start")) have.add(t.id);
      const unit = TRACK_CHECKPOINT_UNIT[sessionId] ?? /^([A-Z]\d{1,2})\./.exec(sessionId)?.[1] ?? "";
      const pick = pickStandIn(unit, have, this.d.content.toolbox(), ALL_STAND_INS);
      if (pick !== null) return pick.code;
    }
    return DEGREE_LINE_TOOLS.every((t) => have.has(t)) ? DEGREE_LINE : CHECKPOINT_GROOVE;
  }

  /** One warm-up of today's plan, every set done at about 85% credit (one in ten below 0.65). */
  async warmup(sessionId: string): Promise<void> {
    const srs = this.d.srs();
    if (srs === null || !this.practice) return;
    const due = await srs.due({ budgetSec: null, more: false });
    for (const item of due.items) await this.#set(sessionId, item);
  }

  async #set(sessionId: string, item: WarmupItem): Promise<void> {
    const content = this.d.content;
    const facts = item.cardIds.filter((c) => content.fact(c) !== null);
    if (item.kind === "listen") return;
    if (facts.length > 0 && item.familyId === null && item.members.length === 0) {
      for (const cardId of facts)
        await reviewCard(this.d, {
          cardId,
          drillSessionId: null,
          outcome: {
            meanCredit: this.#rand() < 0.1 ? 0 : 1,
            medianRtMs: 2500,
            extraReplays: 0,
            hintRung: 0,
            revealed: false,
            playedLevel: null,
            meanAbsCents: null,
          },
        });
      return;
    }
    const familyIds = (item.familyId !== null ? [item.familyId] : item.members).filter(
      (f) => content.family(f) !== null,
    );
    if (familyIds.length === 0) return;
    const srs = this.d.srs();
    if (srs === null) return;
    const purpose = item.kind === "anchor" ? "anchor" : item.kind === "repair" ? "repair" : "srs";
    const drill = await srs.startDrill({ sessionId, purpose, familyIds, warmupItemId: item.id });
    const at = this.d.clock.now().toISOString();
    const weak = this.#rand() < 0.1;
    const trials: DrillTrialRecord[] = [];
    for (let idx = 0; idx < Math.max(1, drill.trialsPlanned); idx++) {
      const familyId = familyIds[idx % familyIds.length] as DrillTrialRecord["familyId"];
      const cats = drill.openCategories[familyId] ?? [];
      const credit = weak ? (this.#rand() < 0.5 ? 0 : 1) : this.#rand() < 0.86 ? 1 : 0.5;
      trials.push({
        idx,
        familyId,
        seed: idx + 1,
        level: drill.levels[familyId] ?? 1,
        category: cats[idx % Math.max(1, cats.length)] ?? "all",
        params: {},
        response: { answer: null, taps: null, sung: null, skipped: false },
        credit,
        correct: credit >= 0.8,
        rtMs: 1800 + Math.round(this.#rand() * 1200),
        replays: 0,
        confusion: null,
        centsError: null,
        at,
      });
    }
    await srs.recordTrials(drill.id, trials);
    await finishDrill(this.d, drill.id);
  }

  end(sessionId: string): void {
    // The Coda's `next` is filled for the last session of the seed only (buildSeed), as the learner then stands.
    this.#s.sessions.end(sessionId, { wrappedEarly: false, phaseMs: PHASE_MS }, null, { skipNext: true });
  }

  /** One map session on the current (simulated) day. */
  async item(id: string): Promise<void> {
    const content = this.d.content;
    if (id === REVIEW_DAY) return this.#review();
    if (content.lessonSite(id) !== null) return this.#lesson(id);
    if (content.checkpointMeta(id) !== null) return this.#checkpoint(id, 0.95);
    if (/^GYM\.\d{2}$/.test(id)) return this.#gym(id);
    if (id === CFT_SLOT_AS_GYM) return this.#gym(`GYM.${String(this.#s.gym.nextOrdinal()).padStart(2, "0")}`);
    const m = /^(.+)\.S(\d+)$/.exec(id);
    if (m !== null && content.capstoneMeta(m[1] as string) !== null)
      return this.#capstone(m[1] as string, id, true);
    throw badRequest(`the seeder does not know how to complete ${id}`);
  }

  /** Wave 7: a reviews-only session (the warm-up and nothing else), as Today plans on a day with no map item. */
  async #review(): Promise<void> {
    const ses = this.#s.sessions.start({ kind: "review", mapItemId: null, targetMinutes: this.target });
    await this.warmup(ses.id);
    this.end(ses.id);
  }

  async #lesson(lessonId: string): Promise<void> {
    const s = this.#s;
    const ses = s.sessions.start({
      kind: "lesson",
      mapItemId: lessonId as never,
      targetMinutes: this.target,
    });
    await this.warmup(ses.id);
    const def = this.d.content.lessonDef(lessonId);
    if (lessonId === "U00.L01") {
      const sk = this.sketch(
        "Sketch 001",
        "lesson-make",
        lessonId,
        lessonMakeCode(def?.steps.at(-1)?.exercise),
      );
      await s.onboarding.put({
        step: "coda",
        completed: [...ONBOARDING_STEPS],
        skipped: [],
        firstEdit: 4,
        sketchId: sk.id,
        finished: true,
      });
      this.end(ses.id);
      this.done.push(lessonId);
      return;
    }
    if (def !== null) {
      for (const step of def.steps) {
        const ex = step.exercise;
        if (ex === undefined) continue;
        await this.#attempt(lessonId, step.id, ex, ses.id, 0.9 + this.#rand() * 0.1);
      }
      const last = def.steps.at(-1);
      if (last !== undefined)
        s.course.position(lessonId, { sessionId: ses.id, stepId: last.id, splitPart: null, wrapped: false });
    } else {
      // The voicing gate's own lesson, not written yet: the learner's typed hand-voiced cadence passed the gate
      // check (contracts §3.1 rule 6), so the gated rows can unlock at U05.L08 as in the real course.
      this.#gateStandIn(lessonId, ses.id);
      // No lesson file yet: evidence for the skills it introduces, as a first pass would give.
      const meta = this.d.content.lessonSite(lessonId)?.meta;
      s.mastery.addEvidence(
        [...(meta?.introduces ?? []), ...(meta?.practises ?? [])].map((skillId) => ({
          skillId,
          category: null,
          score: 0.9,
          weight: 1,
          sourceKind: "step" as const,
          sourceId: `${lessonId}/seed`,
        })),
      );
    }
    const title = def?.title ?? this.d.content.lessonTitle(lessonId);
    const code = def === null ? this.#standIn(lessonId) : lessonMakeCode(def.steps.at(-1)?.exercise);
    const sk = this.sketch(title, "lesson-make", lessonId, code);
    await s.course.complete(
      lessonId,
      {
        sessionId: ses.id,
        sketchId: sk.id,
        lessonVersion: def?.version ?? 1,
        contentHash: this.d.content.contentVersion ?? "unbuilt",
        splitPart: null,
      },
      { allowUnauthored: true },
    );
    this.end(ses.id);
    this.done.push(lessonId);
  }

  /** One checkpoint attempt at `score` on every item; 0.95 passes, 0.5 fails, 0.8 fails gating at 0.85. */
  async #checkpoint(cpId: string, score: number): Promise<void> {
    const s = this.#s;
    const ses = s.sessions.start({
      kind: "checkpoint",
      mapItemId: cpId as never,
      targetMinutes: this.target,
    });
    await this.warmup(ses.id);
    const start = s.course.checkpointStart(cpId);
    const sk = this.sketch(`${cpId} Make`, "checkpoint", cpId, this.#standIn(cpId));
    s.course.checkpointSubmit(cpId, {
      sessionId: ses.id,
      attemptNo: start.attemptNo,
      items: start.items.map((i) => ({
        idx: i.idx,
        score,
        skipped: false,
        response: { code: "" },
        result: null,
      })),
      makeSketchId: sk.id,
      acceptSoftPass: false,
    });
    this.end(ses.id);
    if (score >= 0.85) this.done.push(cpId);
  }

  async failCheckpoint(cpId: string, attempt: number): Promise<void> {
    await this.#checkpoint(cpId, attempt === 1 ? 0.5 : 0.8);
  }

  /**
   * One graded attempt of a lesson exercise with the exercise's own passing test response (real course code, typed
   * by the learner), at `score`.
   */
  async #attempt(lessonId: string, stepId: string, ex: Exercise, sessionId: string, score: number) {
    const globalId = `${lessonId}/${ex.id}`;
    return this.#s.course.attempt(lessonId, stepId, {
      sessionId,
      exerciseId: ex.id,
      exerciseVersion: ex.version ?? 1,
      seriesNo: 0,
      params: {},
      response: passingResponse(ex),
      result: syntheticGrade(globalId, ex, score),
      extraReplays: 0,
      tutorAssisted: false,
    } as never);
  }

  /** The gate exercise's lesson is not written: record the learner's typed gate check as the lesson would. */
  #gateStandIn(lessonId: string, sessionId: string): void {
    const gate = this.#s.unlocks.gatedRows()?.condition;
    if (gate === undefined || !gate.exercise.startsWith(`${lessonId}/`)) return;
    if (this.#s.unlocks.conditionMet(gate)) return;
    const exerciseId = gate.exercise.slice(lessonId.length + 1);
    const result = syntheticGrade(
      gate.exercise,
      { kind: "code-modify", id: exerciseId } as unknown as Exercise,
      0.94,
    );
    this.d.repos.lessons.insertAttempt({
      sessionId,
      lessonId,
      stepId: "S5",
      exerciseId,
      exerciseVersion: 1,
      seriesNo: 0,
      attemptNo: 1,
      params: {},
      code: HAND_VOICED_CADENCE,
      response: { code: HAND_VOICED_CADENCE },
      result,
      passed: true,
      score: 0.94,
      adjusted: 0.94,
      feedbackCodes: [],
      hintRung: 0,
      assisted: false,
      modality: "normal",
      disputed: false,
      tutorAssisted: false,
      at: this.d.clock.now().toISOString(),
    });
  }

  /**
   * A gym session (contracts §2.5): odd ordinals a graded ladder item answered exactly (a graded pass), even ones
   * own audio when there is a project, else a ladder item one realism level up.
   */
  async #gym(id: string): Promise<void> {
    const s = this.#s;
    const ses = s.sessions.start({ kind: "gym", mapItemId: id as never, targetMinutes: this.target });
    await this.warmup(ses.id);
    const n = s.gym.nextOrdinal();
    const audio = s.gym.audioProject();
    const kind = n % 2 === 1 || audio === null ? "ladder" : "own-audio";
    const gym = s.gym.start({
      sessionId: ses.id,
      kind,
      transcriptionId: kind === "own-audio" ? audio : null,
    });
    if (kind === "ladder") await this.ladderItem(ses.id, gym.gymId, null, true);
    this.end(ses.id);
    this.done.push(gym.gymId);
  }

  /** A ladder item from the generator; answered with its own answer key when `answer` (every stage at L3). */
  async ladderItem(sessionId: string | null, gymId: string | null, level: number | null, answer: boolean) {
    const s = this.#s;
    const item = await s.ladder.next({
      sessionId,
      gymId: gymId as never,
      ...(level === null ? {} : { level: level as 1 | 2 | 3 | 4 }),
      seed: 4000 + this.done.length,
    });
    if (!answer) return item;
    for (const stage of (item.stages ?? [null]) as ("bass" | "quality" | "rn" | null)[]) {
      const code = s.ladder.answerOf(item.itemId, stage);
      if (code === null) break;
      await s.ladder.submit(item.itemId, {
        sessionId,
        code,
        rung: 0,
        ...(stage === null ? {} : { stage }),
      });
    }
    return item;
  }

  /**
   * One capstone session (multi-session capstones, wave4.md §5.1): started from Today, a draft saved in it (real
   * course code: the brief's own passing piece, C2's loop then the song, X1's song in Oak's rendition), X1's
   * phrase checks recorded, then the session completed, or the capstone released at its last session.
   */
  async #capstone(
    capstoneId: string,
    sessionId: string,
    finish: boolean,
    opts: { check?: boolean } = {},
  ): Promise<void> {
    const s = this.#s;
    const content = this.d.content;
    const ids = content.capstoneSessionIds(capstoneId);
    const index = ids.indexOf(sessionId);
    const last = index === ids.length - 1;
    this.#openFamilyGate(capstoneId);
    const ses = s.sessions.start({
      kind: "capstone",
      mapItemId: sessionId as never,
      targetMinutes: this.target,
    });
    await this.warmup(ses.id);
    const meta = content.capstoneMeta(capstoneId);
    const def = content.capstoneDef(capstoneId);
    const title = meta?.title.replace(/^[A-Z0-9-]+\s+/, "") ?? capstoneId;
    const brief = def?.brief;
    const code = capstoneSessionCode(this.d, capstoneId, index, last && finish);
    // A transcription's draft is in its song's key and tagged with the song (X1, X2: the workspace and the album
    // read the tag; the cover names the key); a compose capstone's in the key its brief gives.
    const song = capstoneSong(this.d, capstoneId);
    const key = CAPSTONE_KEYS[capstoneId] ?? song?.key;
    let sk =
      this.capstoneSketchId === null || s.library.sketch(this.capstoneSketchId).originId !== capstoneId
        ? this.sketch(`${title} (draft)`, "capstone", capstoneId, code, key)
        : s.library.sketch(this.capstoneSketchId);
    if (song !== null && !sk.tags.includes(song.id)) {
      s.library.patchSketch(sk.id, { tags: [song.id, ...sk.tags.filter((t) => !t.startsWith("song."))] });
      sk = s.library.sketch(sk.id);
    }
    if (sk.currentVersion > 0 && s.library.sketch(sk.id).versions.at(-1)?.code !== code) {
      s.library.addSketchVersion(sk.id, {
        ...draftVersion(code, key),
        sessionId: ses.id,
      });
      sk = s.library.sketch(sk.id);
    }
    this.capstoneSketchId = sk.id;
    s.capstoneSessions.saveDraft(capstoneId, {
      capstoneSessionId: sessionId as never,
      sessionId: ses.id,
      sketchId: sk.id,
      sketchVersion: sk.currentVersion,
    });
    // X1: every phrase (and chord stage) check of the session, graded in the browser in capstone mode. The first
    // phrase check of the capstone was revealed (hint 4): no evidence, and the liner notes name it.
    const sessionDef = def?.sessionDefs.find((x) => x.id === sessionId);
    // X1 only: its first phrase check was revealed (Wave 4). X2's checks all pass at their marks (bass ≥ 0.90 first).
    let first = index === 0 && capstoneId === "X1";
    for (const { check, stage } of checkSlots(sessionDef)) {
      const revealed = first && stage === null;
      first = false;
      const result = syntheticGrade(
        `${capstoneId}/${check.id}`,
        { kind: "transcribe-step", id: check.id } as unknown as Exercise,
        revealed ? 1 : Math.max(check.pass, 0.92),
      );
      if (revealed) result.assist = { ...result.assist, rung: 4, revealed: true };
      result.mode = "capstone";
      s.capstoneSessions.recordCheck(capstoneId, check.id, {
        capstoneSessionId: sessionId as never,
        stage,
        sketchId: sk.id,
        sketchVersion: sk.currentVersion,
        result,
      });
    }
    // The rubric run of the draft (compose capstones): the session's check of the whole piece. Wave 6: a transcribe
    // capstone whose last session has required rules of its own (CF-T.S4: the arrangement) is checked the same way.
    const sessionRubric = (sessionDef?.rubric ?? []).some((r) => r.required);
    if (brief !== undefined && (last || ids.length === 1 || opts.check === true)) {
      const result = syntheticGrade(`${capstoneId}/${brief.id}`, brief, 0.95);
      s.course.capstoneCheck(capstoneId, { sketchId: sk.id, sketchVersion: sk.currentVersion, result });
    } else if (
      brief === undefined &&
      last &&
      (s.capstoneSessions.checksCleared(capstoneId) === null || sessionRubric)
    ) {
      const result = syntheticGrade(
        `${capstoneId}/brief`,
        { kind: "compose-brief", id: "brief" } as unknown as Exercise,
        0.95,
      );
      s.course.capstoneCheck(capstoneId, { sketchId: sk.id, sketchVersion: sk.currentVersion, result });
    }
    if (finish) {
      if (last) {
        const r = s.release.release(capstoneId, {
          sessionId: ses.id,
          sketchId: sk.id,
          sketchVersion: sk.currentVersion,
          title,
          flavour: null,
          linerNotesMd: await this.#linerNotes(capstoneId, title, code),
          theoryTags: [],
          includeReviewNote: false,
        });
        this.trackId = r.track.id;
        // The recording of the release (`OakStrudel.recorder.record` then `album.putAudio`): the piece's length.
        const seconds = Math.min(30, Math.max(4, recordingSeconds(code)));
        if (this.recordings)
          s.library.putTrackAudio(
            r.track.id,
            r.track.currentVersion,
            makeWav(8000, seconds, 220),
            "audio/wav",
            seconds,
          );
      } else
        s.course.capstoneCompleteSession(capstoneId, {
          capstoneSessionId: sessionId,
          sketchId: sk.id,
          flavour: null,
        });
      this.done.push(sessionId);
    }
    this.end(ses.id);
  }

  /**
   * Liner notes as the release writes them: Oak's deterministic notes (`linerNotes` of @oak/grader) from the analysed
   * piece when the learner host can evaluate it, else the same facts written out.
   */
  async #linerNotes(capstoneId: string, title: string, code: string): Promise<string> {
    try {
      const lint = {
        profile: "studio" as const,
        unlocked: this.#s.unlocks.ids() as never,
        allowPreview: false,
        meter: "4/4" as const,
        key: null,
      };
      let r = await this.d.graders.learner().analyze(code, { mode: "capstone", bars: 128, lint });
      // One pass of the piece (contracts §6.4), as the release's notes describe it.
      if (r.ok) {
        const len = capstoneLength(code, normalize(r, { meter: "4/4" }).all, r.cps);
        if (len.queriedBars < 128)
          r = await this.d.graders.learner().analyze(code, { mode: "capstone", bars: len.queriedBars, lint });
      }
      if (r.ok) {
        const n = normalize(r, { meter: "4/4" });
        const analysis = analyzePiece(n, { meter: "4/4", code });
        const result = this.d.repos.capstones.get(capstoneId)?.lastResult;
        if (result !== null && result !== undefined) return linerNotes(analysis, result);
      }
    } catch {
      /* the fallback below */
    }
    return capstoneId === "C2"
      ? `${title}: eight bars at 96 BPM in C major. The chords loop I–V–vi–IV, then land IV–I in bars 7–8; the melody comes back to its bar-1 idea in bar 5.`
      : `${title}: the first take.`;
  }

  /** A capstone opened by a family level (X1): a learner who did the gym sets has the family at that level. */
  #openFamilyGate(capstoneId: string): void {
    const meta = this.d.content.capstoneMeta(capstoneId);
    if (meta === null || this.d.repos.capstones.get(capstoneId) !== null) return;
    const others = this.#s.gates.gateMissing({ ...meta.opensAfter, familyLevels: [] });
    if (others.length > 0) return;
    for (const f of meta.opensAfter.familyLevels ?? []) setFamilyLevel(this.d, f.family, f.level, true);
  }

  /** `U05.L07 gate open`: U05.L07 started, every step before the gate check passed, one gate attempt below 0.9. */
  async gateOpen(): Promise<void> {
    const s = this.#s;
    const gate = s.unlocks.gatedRows()?.condition;
    const lessonId = gate?.exercise.slice(0, gate.exercise.indexOf("/")) ?? "U05.L07";
    const def = this.d.content.lessonDef(lessonId);
    if (def === null || gate === undefined)
      throw badRequest(`${lessonId} is not written yet: the point "U05.L07 gate open" needs its gate check`);
    const gateEx = gate.exercise.slice(lessonId.length + 1);
    const ses = s.sessions.start({
      kind: "lesson",
      mapItemId: lessonId as never,
      targetMinutes: this.target,
    });
    await this.warmup(ses.id);
    let at: string | null = null;
    for (const step of def.steps) {
      const ex = step.exercise;
      if (ex === undefined) continue;
      const isGate = this.d.content.exercise(`${lessonId}/${ex.id}`) !== null && ex.id === gateEx;
      if (isGate) {
        await this.#attempt(lessonId, step.id, ex, ses.id, 0.72);
        at = step.id;
        break;
      }
      await this.#attempt(lessonId, step.id, ex, ses.id, 0.9 + this.#rand() * 0.1);
    }
    if (at !== null)
      s.course.position(lessonId, { sessionId: ses.id, stepId: at, splitPart: null, wrapped: false });
    this.end(ses.id);
  }

  /** `ladder L3`: the ladder at L3, realism R1, one L3 item started (no answer yet). */
  async ladderL3(): Promise<void> {
    this.d.repos.ladder.saveState(3, 1, this.d.clock.now().toISOString());
    await this.ladderItem(null, null, 3, false);
  }

  /** `own-audio project`: a short recording, regions, one code version, half the checklist, player settings. */
  async ownAudio(): Promise<void> {
    const lib = this.#s.library;
    const audio = lib.uploadAudio("my-song.wav", makeWav(8000, 6, 196), "audio/wav");
    const t = await lib.createTranscription({
      sourceKind: "own-audio",
      audioId: audio.id,
      songId: null,
      title: "My song",
      artist: null,
      ladderLevel: null,
      templateId: null,
    });
    lib.patchTranscription(t.id, {
      key: { tonic: "G", mode: "major" },
      bpm: 90,
      meter: "4/4",
      downbeatS: 0.1,
      regions: [
        { id: "r1", label: "Verse", startS: 0, endS: 3, kind: "section" },
        { id: "r2", label: "Hook", startS: 3, endS: 6, kind: "loop" },
      ],
      checklist: { contour: 2, rhythm: 1, landing: 1 },
    });
    lib.putTranscriptionSettings(t.id, {
      rate: 0.75,
      loop: { startS: 3, endS: 6 },
      notes: "The hook starts on 5.",
    });
    lib.saveTranscriptionVersion(t.id, { code: OWN_AUDIO_DRAFT, result: null, ranOk: true });
  }

  /**
   * `ladder L5` / `ladder L6`: the ladder at that level and realism, one song item started from the first open song
   * of the level and its first check answered with the answer key (L5 phrase 1, L6 the bass stage): a pass.
   */
  async ladderSong(level: 5 | 6 | 8, realism: number): Promise<void> {
    const s = this.#s;
    if (level === 8) return this.#ladderStandard(realism);
    this.d.repos.ladder.saveState(level, realism, this.d.clock.now().toISOString());
    let item: Awaited<ReturnType<typeof s.ladder.next>>;
    try {
      item = await s.ladder.next({ sessionId: null, gymId: null, level, seed: 5000 + this.done.length });
    } catch (e) {
      throw badRequest(
        `the point needs an L${level} song with a complete answer key in content/repertoire (${e instanceof Error ? e.message : String(e)})`,
      );
    }
    const full = s.ladder.songAnswerOf(item.itemId);
    if (full === null) throw badRequest(`the L${level} song ${item.song?.songId ?? ""} has no answer key`);
    // L6 saves only what the learner has written by then: the bass line, with the key's tempo line (review:studio
    // found the whole answer key, melody included, stored as the learner's version). L5 answers phrase 1 whole.
    const song = this.d.content.source.songs.find((x) => x.id === item.song?.songId);
    const bass = level === 6 ? song?.answerKey.layers.bass : undefined;
    const tempo = /^\s*setcpm\([^)]*\)/m.exec(full)?.[0];
    const code = bass === undefined ? full : `${tempo ? `${tempo.trim()}\n\n` : ""}bass: ${bass}`;
    await s.ladder.submit(item.itemId, {
      sessionId: null,
      code,
      rung: 0,
      ...(level === 5 ? { phrase: 1 } : { stage: "bass" as const }),
    });
  }

  /**
   * `ladder L8`: the ladder at L8 and `realism`, one standard that is not CF-T's song started, its form map answered
   * from the answer key's sections and its bass written from the key's bass layer: both pass, the changes are next.
   */
  async #ladderStandard(realism: number): Promise<void> {
    const s = this.#s;
    const standards = cftStandards(this.d);
    if (standards.length < 2)
      throw badRequest(
        `the point "ladder L8" needs two standards with complete answer keys in content/repertoire (one for CF-T, one for the ladder); ${standards.length} written`,
      );
    this.d.repos.ladder.saveState(8, realism, this.d.clock.now().toISOString());
    const item = await s.ladder.next({
      sessionId: null,
      gymId: null,
      level: 8,
      seed: 8000 + this.done.length,
    });
    const song = this.d.content.source.songs.find((x) => x.id === item.song?.songId);
    if (song === undefined) throw badRequest("the L8 standard has no answer key");
    const sections = song.answerKey.sections ?? [];
    await s.ladder.submit(item.itemId, {
      sessionId: null,
      code: "",
      rung: 0,
      stage: "form",
      formMap: { sections: sections.map((x) => x.label), bars: sections.map((x) => x.bars[0]) },
    });
    await s.ladder.submit(item.itemId, {
      sessionId: null,
      code: transcriptionDraft(song, ["bass"]),
      rung: 0,
      stage: "bass",
    });
  }

  /**
   * `C3.S3 in progress (d13)`: the session started, its draft saved and the rubric check of the draft recorded (the
   * lead sheet writes the song), not completed: as the three-session C3 stood before its take.
   */
  async capstoneOpen(capstoneSessionId: string): Promise<void> {
    const capstoneId = capstoneSessionId.replace(/\.S\d+$/, "");
    await this.#capstone(capstoneId, capstoneSessionId, false, { check: true });
  }

  /** `two takes (d20)`: a second recording of the released track's version 1; it becomes the current take. */
  secondTake(): void {
    if (this.trackId === null) throw badRequest("the point needs a released track");
    const track = this.#s.library.track(this.trackId);
    const first = track.versions.find((v) => v.version === 1);
    const seconds = first?.durationS ?? 12;
    this.#s.library.addTrackTake(this.trackId, 1, makeWav(8000, seconds, 330), "audio/wav", seconds);
  }

  /** `second tab (d21)`: a lesson session open today from another tab, in its main phase. */
  secondTab(): void {
    const next = this.#s.gates.nextMapItem();
    if (next === null || this.d.content.lessonSite(next) === null)
      throw badRequest("the point needs a lesson to be next");
    const ses = this.#s.sessions.start({
      kind: "lesson",
      mapItemId: next,
      targetMinutes: this.target,
      tabId: SECOND_TAB_ID,
    });
    this.#s.sessions.heartbeat(ses.id, { phase: "main", activeMs: 180_000, stepId: null });
  }

  /** `ladder level-up due`: the ladder at L4, R2, and one graded L4 pass (called on two different days). */
  async levelUpPass(): Promise<void> {
    const st = this.d.repos.ladder.state();
    if (st.level !== 4) this.d.repos.ladder.saveState(4, 2, this.d.clock.now().toISOString());
    await this.ladderItem(null, null, 4, true);
  }

  /** `ladder realism-up due`: the ladder at L2, R1, and one session at R1 scoring ≥ 0.9 (the item answered exactly). */
  async realismPass(): Promise<void> {
    this.d.repos.ladder.saveState(2, 1, this.d.clock.now().toISOString());
    await this.ladderItem(null, null, 2, true);
  }

  async draft(capstoneId: string): Promise<void> {
    const first = this.d.content.capstoneSessionIds(capstoneId)[0];
    if (first === undefined) throw badRequest(`capstone ${capstoneId} has no sessions`);
    await this.#capstone(capstoneId, first, false);
  }
}

/**
 * `POST /api/dev/seed`: the learner at `body.point`. The first request of a kind builds it (`buildSeed`); a repeat
 * restores that build's snapshot (dev-seed-cache.ts) while it may stand for a fresh build (same day, within the hour).
 */
export async function seedLearner(d: AppDeps, body: DevSeedRequest): Promise<DevSeedResult> {
  needDevClock(d);
  const cache = seedCacheOf(d);
  if (cache === null) return buildSeed(d, body);
  // An unknown point answers 400 before anything is wiped or restored, as the build does.
  planSeed(body.point, d.content.defaultOrder());
  return cache.seed(body, () => buildSeed(d, body));
}

/** Builds the learner at `body.point` by replaying the default order through the real services. */
export async function buildSeed(d: AppDeps, body: DevSeedRequest): Promise<DevSeedResult> {
  const clock = needDevClock(d);
  const order = d.content.defaultOrder();
  const plan = planSeed(body.point, order);
  const gapDays = body.gapDays ?? plan.gapDays ?? 0;
  // Wave 6: a point about CF-T (or one that needs it released) cannot be built before a standard has an answer key.
  if (plan.needsCft === true && cftStandards(d).length === 0) {
    const ids = (d.content.capstoneDef("CF-T") as { song?: readonly string[] } | null)?.song ?? [];
    throw badRequest(
      `the point "${body.point}" needs a CF-T standard with a complete answer key (form sections, bass, chords, melody) in content/repertoire: none of ${ids.join(", ") || "its songs"} is written yet`,
    );
  }
  const items = seedItems(d, order, plan);
  // Wave 7: what the track walk needs that content may not have yet, named before anything is wiped.
  const walk = plan.wave7?.walk ?? [];
  if ((walk.some((id) => id.startsWith("JC4.")) || /^JC4\b/i.test(body.point.trim())) && jc4Song(d) === null)
    throw badRequest(
      `the point "${body.point}" needs a standard JC4 can reharmonize with an answer key in content/repertoire (${(CAPSTONE_SONGS.JC4 ?? []).join(" or ")}): none is written yet`,
    );
  if (
    walk.some((id) => id.startsWith("AC1.")) &&
    !["song.st-louis-blues", "song.sweet-georgia-brown"].some((id) =>
      d.content.source.songs.some((x) => x.id === id),
    )
  )
    throw badRequest(
      `the point "${body.point}" needs a tune AC1 can work on with an answer key in content/repertoire (song.st-louis-blues, or song.sweet-georgia-brown once U15.L05 is done): none is written yet`,
    );
  const extraDays =
    plan.extra === null
      ? 0
      : plan.extra.kind === "cp-failed"
        ? plan.extra.times
        : plan.extra.kind === "draft" ||
            plan.extra.kind === "gate-open" ||
            plan.extra.kind === "capstone-open"
          ? 1
          : plan.extra.kind === "side"
            ? plan.extra.lessons.length
            : plan.extra.kind === "ladder-levelup"
              ? 2
              : 0;
  const days = items.length + walk.length + extraDays;

  // Wipe, keeping the /dev/listen verdicts.
  const marks = d.repos.listen.list();
  d.services.backup.reset();
  for (const m of marks) d.repos.listen.put(m);
  const target = body.targetMinutes ?? 20;
  const seeder = new Seeder(d, target, body.practice ?? true, body.recordings ?? true);

  const now = clock.now();
  // Item k on its own day; the last one `gapDays + 1` days before today (0 missed days: yesterday).
  const dayAt = (k: number) => new Date(now.getTime() - (gapDays + 1 + (days - 1 - k)) * DAY_MS);
  await clock.at(days === 0 ? now : dayAt(0), () => {
    // The profile exists from the first simulated day: the first week's goal and the day count start there.
    const p = d.repos.profile.get();
    if (body.targetMinutes !== undefined && p.targetMinutes !== body.targetMinutes)
      d.repos.profile.patch({ targetMinutes: body.targetMinutes });
    // Onboarding's mic and range steps: a working mic and a calibrated range (`mic: false`: no mic, Quiet mode).
    if (days > 0) seedVoice(d, body.mic ?? true);
  });
  let k = 0;
  for (const id of items) {
    await clock.at(dayAt(k), () => seeder.item(id));
    k++;
  }
  // Wave 7: the track sessions after the core walk, one a day, then the point's own settings on its last day.
  for (const id of walk) {
    await clock.at(dayAt(k), () => seeder.item(id));
    k++;
  }
  const w7 = plan.wave7;
  if (w7 !== undefined)
    await clock.at(dayAt(Math.max(0, k - 1)), () => {
      if (w7.focus !== null) d.services.trackPlan.setFocus(w7.focus);
      if (w7.removeHorns === true) removeUnlock(d, "snd.horns");
    });
  if (plan.extra?.kind === "cp-failed")
    for (let n = 1; n <= plan.extra.times; n++) {
      const cpId = plan.extra.cpId;
      await clock.at(dayAt(k), () => seeder.failCheckpoint(cpId, n));
      k++;
    }
  if (plan.extra?.kind === "draft") {
    const capId = plan.extra.capstoneId;
    await clock.at(dayAt(k), () => seeder.draft(capId));
    k++;
  }
  if (plan.extra?.kind === "gate-open") {
    await clock.at(dayAt(k), () => seeder.gateOpen());
    k++;
  }
  // Wave 6 (d13): a capstone session started the day after the walk, with its draft and its check, not completed.
  if (plan.extra?.kind === "capstone-open") {
    const sid = plan.extra.capstoneSessionId;
    await clock.at(dayAt(k), () => seeder.capstoneOpen(sid));
    k++;
  }
  // Wave 5: two graded L4 passes at R2 on two days after the walk (learner days never run backwards).
  if (plan.extra?.kind === "ladder-levelup")
    for (let n = 0; n < 2; n++) {
      await clock.at(dayAt(k), () => seeder.levelUpPass());
      k++;
    }
  // Wave 5: side lessons taken on the days after the walk (one a day, like Today offers them).
  if (plan.extra?.kind === "side")
    for (const id of plan.extra.lessons) {
      await clock.at(dayAt(k), () => seeder.item(id));
      k++;
    }
  // Same-day additions on the last seeded day (yesterday).
  const lastDay = dayAt(Math.max(0, days - 1));
  if (plan.extra?.kind === "ladder-l3") await clock.at(lastDay, () => seeder.ladderL3());
  if (plan.extra?.kind === "own-audio") {
    await clock.at(lastDay, () => seeder.ownAudio());
    // c2: as if the learner's data came back through a backup import — every version held for review.
    if (plan.extra.imported === true) markForReview(d.repos.db);
  }
  const extra = plan.extra;
  // Onboarding begun today: what the learner's own screens save after the welcome, the loop and the edit.
  if (extra?.kind === "onboarding-at")
    await d.services.onboarding.put({
      step: extra.step,
      completed: ["welcome", "loop", "edit"],
      skipped: [],
      firstEdit: extra.firstEdit,
      sketchId: null,
    });
  if (extra?.kind === "ladder-song")
    await clock.at(lastDay, () => seeder.ladderSong(extra.level, extra.realism));

  if (extra?.kind === "ladder-realism") await clock.at(lastDay, () => seeder.realismPass());
  // Wave 6: a second take on the released track (d20), yesterday; another tab's open session (d21), today.
  if (extra?.kind === "second-take") await clock.at(lastDay, () => seeder.secondTake());
  if (extra?.kind === "second-tab") seeder.secondTab();
  if (plan.familyLevels !== undefined)
    await clock.at(lastDay, () => {
      for (const f of plan.familyLevels ?? []) setFamilyLevel(d, f.family, f.level, false);
    });
  // Yesterday's Coda names the planner's next session as the learner now stands (Wave 7 carry f6: the focus included).
  const lastEnded = d.repos.db
    .query("SELECT id, ended_at FROM sessions WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1")
    .get() as { id: string; ended_at: string } | null;
  if (lastEnded !== null)
    await clock.at(new Date(lastEnded.ended_at), () => d.services.sessions.refreshNext(lastEnded.id));
  const time = new LearnerTime(d.services.ctx);
  return {
    point: body.point,
    done: seeder.done,
    next: seededNext(d),
    day: time.day(),
    lastActiveDay: days === 0 ? null : time.day(dayAt(days - 1)),
    gapDays: days === 0 ? 0 : gapDays,
    sketchIds: seeder.sketchIds,
    capstoneSketchId: seeder.capstoneSketchId,
    trackId: seeder.trackId,
  };
}

/** The voice part of onboarding as a seed: the mic check and the range sweep, or no mic at all. */
export function seedVoice(d: AppDeps, mic: boolean): void {
  const at = d.clock.now().toISOString();
  if (!mic) {
    d.repos.profile.patch({ inputKind: "none", quiet: false });
    return;
  }
  const range = { vocalLowMidi: 48, vocalHighMidi: 69, comfortLowMidi: 50, comfortHighMidi: 66 };
  d.repos.profile.addCalibration("noise", { floorDb: -62 }, at);
  d.repos.profile.addCalibration("range", { lowMidi: 48, highMidi: 69 }, at);
  d.repos.profile.patch({ inputKind: "builtin", noiseFloorDb: -62, quiet: false, ...range });
}

/**
 * A seeded capstone draft: the brief's own first passing test (content CI grades it), else its starter. Real
 * course code, so the seeded piece runs under the learner's unlocks in the browser.
 */
export function capstoneDraftCode(brief: Exercise | undefined): string {
  return firstPassingCode(brief) ?? 'setcpm(100/4)\n\ndrums: s("bd ~ sd ~")';
}

/** A seeded lesson Make: the Make's own first passing test (real course code), else its starter. */
export function lessonMakeCode(make: Exercise | undefined): string {
  return firstPassingCode(make) ?? 'setcpm(96/4)\n\ndrums: s("bd ~ sd ~")';
}

function firstPassingCode(ex: Exercise | undefined, starter = true): string | null {
  const b = ex as
    | { tests?: { expect: string; response?: { code?: string } }[]; code?: { starter?: string } }
    | undefined;
  const pass = b?.tests?.find((t) => t.expect === "pass" && typeof t.response?.code === "string");
  if (pass?.response?.code !== undefined) return pass.response.code;
  const raw = starter ? b?.code?.starter : undefined;
  // A starter carries ⟪…⟫ / ⟦id⟧ markers for the editor; the saved draft is the code the learner sees, which runs.
  return raw === undefined ? null : stripMarkers(raw).code;
}

/** A seeded Make in degrees (U03.L02 on): 1 3 5 3 | 4 2 1, home on the last beat but one. */
export const DEGREE_LINE = 'setcpm(84/4)\n\nmel: n("<[0 2 4 2] [3 1 0 ~]>").scale("C4:major").s("piano")';
const DEGREE_LINE_TOOLS = [
  "tb.n",
  "tb.scale",
  "scale.major",
  "snd.piano",
  "tb.s.pitched",
  "tb.label",
  "tb.mini.alt",
  "tb.mini.sub",
  "tb.mini.rest",
  "tb.setcpm",
];

/** A seeded checkpoint Make: labelled parts with tools every checkpoint from U01.CP on has unlocked. */
export const CHECKPOINT_GROOVE =
  'setcpm(100/4)\n\nkick: s("bd ~ bd ~")\nsnare: s("~ sd ~ sd")\nhats: s("hh*8")';

/**
 * Sets a family's level as a learner who did (or had not yet done) the strong sets would have it (contracts §7.3:
 * two sets ≥ 0.90 on two days per level). `atLeast`: only raise. The family's card is seeded if it was not.
 */
export function setFamilyLevel(
  d: Pick<AppDeps, "repos" | "clock">,
  family: string,
  level: number,
  atLeast: boolean,
): void {
  const at = d.clock.now().toISOString();
  const row = d.repos.srs.family(family) ?? {
    familyId: family,
    level: 1,
    promoDay: null,
    categoryStats: {},
    confusion: {},
    blockedRemaining: 0,
    compositeId: null,
    graduatedAt: null,
    updatedAt: at,
  };
  if (atLeast && row.level >= level) return;
  d.repos.srs.saveFamily({ ...row, level, promoDay: null, updatedAt: at });
}

/** The response of an exercise's first passing test (real course code or the answer), else an empty code line. */
export function passingResponse(ex: Exercise): Record<string, unknown> {
  const tests = (ex as { tests?: { expect: string; response?: Record<string, unknown> }[] }).tests ?? [];
  const pass = tests.find((t) => t.expect === "pass" && t.response !== undefined);
  return pass?.response ?? { code: "" };
}

/**
 * The learner's hand-voiced cadence for the voicing gate while U05.L07 is not written (three voices, common tones
 * held, the others by step; I–IV–V–I in C): C–E–G, C–F–A, B–D–G, C–E–G.
 */
export const HAND_VOICED_CADENCE =
  'setcpm(80/4)\n\nchords: note("<[c3,e3,g3] [c3,f3,a3] [b2,d3,g3] [c3,e3,g3]>").s("piano")';

/** C2.S1's draft, the loop then the landing (contracts §6.6): I V vi IV I V, then IV I in bars 7–8, over drums. */
export const C2_CHORDS =
  'setcpm(96/4)\n\ndrums: s("bd ~ sd ~, hh*8")\nchords: n("<[0,2,4] [4,6,8] [5,7,9] [3,5,7] [0,2,4] [4,6,8] [3,5,7] [0,2,4]>").scale("C3:major").s("piano")';
/**
 * C2.S2's song: the chords and a melody that arpeggiates each chord with bar 1's shape (up a 3rd, back, down to the
 * root: E G E C over C, B D B G over G, A C A F over F), so the idea comes back in five of eight bars; chord tones on
 * beats 1 and 3; it lands on 1.
 */
export const C2_SONG = `${C2_CHORDS}\nmelody: n("<[2 4 2 0] [6 8 6 4] [7 9 7 5] [5 7 5 3] [2 4 2 0] [6 8 6 4] [5 7 5 3] [0 ~ ~ ~]>").scale("C4:major").s("piano")`;

/** A first own-audio draft: the hook as degrees in G (what a learner types after a few listens). */
export const OWN_AUDIO_DRAFT =
  'setcpm(90/4)\n\nmelody: n("<[4 4 2 0] [1 2 4 ~]>").scale("G4:major").s("piano")';

/** The code a capstone session saves as its draft. */
export function capstoneSessionCode(
  d: Pick<AppDeps, "content">,
  capstoneId: string,
  index: number,
  releasing: boolean,
): string {
  if (capstoneId === "C2") return index === 0 && !releasing ? C2_CHORDS : C2_SONG;
  const def = d.content.capstoneDef(capstoneId);
  // Wave 7: AC1's two versions of its tune (S1 version one, S2 and S3 version two) and JC4's standard reharmonized.
  if (capstoneId === "AC1") {
    const song = ac1Song(d);
    if (song === null) throw badRequest("AC1 has no tune with an answer key yet");
    const v = ac1Versions(song.answerKey.code);
    return index === 0 ? v.a : v.b;
  }
  if (capstoneId === "JC4") {
    const song = jc4Song(d);
    if (song === null) throw badRequest("JC4 has no standard with an answer key yet");
    if (index === 0) return song.answerKey.code;
    // The brief's own passing piece once it is written for this standard (content CI grades it: three devices, the
    // tune untouched, its long notes fitting the new chords), else Oak's generic reharmonisation.
    const own = def?.song?.[0] === song.id ? firstPassingCode(def?.brief, false) : null;
    return own ?? jc4Reharm(song);
  }
  // Wave 5 compose capstones: the session's own draft (seed-wave5.ts); the release is the brief's own passing piece
  // once the capstones author pins one, else the seeded song.
  const drafts = CAPSTONE_DRAFTS[capstoneId];
  if (drafts !== undefined) {
    const last = drafts.length - 1;
    if (releasing) return firstPassingCode(def?.brief, false) ?? (drafts[last] as string);
    return drafts[Math.min(index, last)] as string;
  }
  if (def?.kind === "transcribe" || d.content.capstoneMeta(capstoneId)?.kind === "transcribe") {
    const song = capstoneSong(d, capstoneId);
    if (song === null)
      throw badRequest(
        `${capstoneId}'s songs are not written yet (content/repertoire: ${(def?.song ?? []).join(", ") || "none named"})`,
      );
    const melody = song.answerKey.layers.melody;
    const last = index === d.content.capstoneSessionIds(capstoneId).length - 1;
    // CF-T (Wave 6): the draft grows a layer a session — the bass, then the changes, then the tune — and the last
    // session saves the whole arrangement.
    if (capstoneId === "CF-T" && !last)
      return transcriptionDraft(song, (["bass", "chords", "melody"] as const).slice(0, index + 1));
    return last || melody === undefined ? song.answerKey.code : melody;
  }
  return capstoneDraftCode(def?.brief);
}

/** The first written song a transcribe capstone offers (X1, X2), as the Start page picks it; null for a compose one. */
export function capstoneSong(d: Pick<AppDeps, "content">, capstoneId: string): SongDef | null {
  // CF-T: the first standard whose answer key is complete (the form map needs its sections).
  if (capstoneId === "CF-T") return cftStandards(d)[0] ?? null;
  if (capstoneId === "AC1") return ac1Song(d);
  if (capstoneId === "JC4") return jc4Song(d);
  const def = d.content.capstoneDef(capstoneId);
  return (
    (def?.song ?? [])
      .map((id) => d.content.source.songs.find((x) => x.id === id))
      .find((x) => x !== undefined) ?? null
  );
}

/**
 * A transcription draft as a learner has it part-way: the song's tempo line, the consts its answer key defines and
 * the layers written so far, each on its own labelled line (`bass:`, `chords:`, `mel:`).
 */
export function transcriptionDraft(song: SongDef, layers: readonly ("bass" | "chords" | "melody")[]): string {
  const code = song.answerKey.code;
  const tempo = /^\s*setcpm\([^)]*\)/m.exec(code)?.[0]?.trim();
  const consts = code.split("\n").filter((l) => /^const\s/.test(l));
  const label = { bass: "bass", chords: "chords", melody: "mel" } as const;
  const lines = layers
    .map((l) => [l, song.answerKey.layers[l]] as const)
    .filter((x): x is readonly ["bass" | "chords" | "melody", string] => typeof x[1] === "string")
    .map(([l, text]) => (/^[a-z][A-Za-z0-9]*:\s/.test(text) ? text : `${label[l]}: ${text}`));
  return [tempo, consts.join("\n"), lines.join("\n")].filter((x) => x !== undefined && x !== "").join("\n\n");
}

/** A sketch version body for a draft. */
function draftVersion(code: string, key: KeySpec = { tonic: "C", mode: "major" }) {
  return {
    code,
    bpm: Number(/setcpm\((\d+(?:\.\d+)?)\s*\/\s*4\)/.exec(code)?.[1] ?? 96),
    meter: "4/4" as const,
    key,
    analysis: null,
    note: null,
    tutorAssisted: false,
    band: null,
    flags: EMPTY_FLAGS,
    ranOk: true,
  };
}

/** Seconds a piece plays: its `<…>` cycles at its tempo (`setcpm(bpm/4)`), 8 bars when it cannot tell. */
export function recordingSeconds(code: string): number {
  const bpm = Number(/setcpm\((\d+(?:\.\d+)?)\s*\/\s*4\)/.exec(code)?.[1] ?? 100);
  const bars = Math.max(
    1,
    ...[...code.matchAll(/<([^>]*)>/g)].map((m) => (m[1] as string).trim().split(/\s+(?![^[]*\])/).length),
  );
  return Math.round(((bars * 4 * 60) / bpm) * 10) / 10;
}

/** A mono 16-bit WAV of a quiet sine (a stand-in recording: the dev seeder has no audio engine). */
export function makeWav(sampleRate: number, seconds: number, hz: number): Uint8Array {
  const n = Math.round(sampleRate * seconds);
  const buf = new Uint8Array(44 + n * 2);
  const v = new DataView(buf.buffer);
  const str = (o: number, t: string) => {
    for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++)
    v.setInt16(44 + i * 2, Math.round(3000 * Math.sin((2 * Math.PI * hz * i) / sampleRate)), true);
  return buf;
}

/** Wave 7: the tune AC1's seeded versions take: the first tune of `CapstoneGate.tunes` that is open. */
export function ac1Song(d: Pick<AppDeps, "content"> & Partial<Pick<AppDeps, "services">>): SongDef | null {
  const tunes = d.services?.trackPlan.tunes("AC1") ?? [];
  const open = tunes.find((t) => t.open) ?? tunes[0] ?? null;
  return open === null ? null : (d.content.source.songs.find((s) => s.id === open.songId) ?? null);
}

/** Wave 7: the standard JC4's seeded drafts reharmonize: the first of its songs with an answer key. */
export function jc4Song(d: Pick<AppDeps, "content">): SongDef | null {
  for (const id of CAPSTONE_SONGS.JC4 ?? []) {
    const s = d.content.source.songs.find((x) => x.id === id);
    if (s !== undefined) return s;
  }
  return null;
}

/**
 * Wave 7 (dev only): takes an unlock away (`RC1 open`: the horns U15.L05 granted, so RC1.S2's own grant is seen).
 * Unlock rows are never revoked in the product; the append-only trigger is lifted for this one delete and restored.
 */
export function removeUnlock(d: Pick<AppDeps, "db">, itemId: string): void {
  const trigger = triggerDdl(d.db).find((t) => t.name === "unlocks_no_delete");
  d.db.transaction(() => {
    if (trigger !== undefined) d.db.run("DROP TRIGGER unlocks_no_delete");
    d.db.run("DELETE FROM unlocks WHERE item_id = ?", [itemId]);
    if (trigger !== undefined) d.db.run(trigger.sql);
  })();
}

/** The seed result's `next`: the core's next item, else (Wave 7) the session of the track the learner chose. */
export function seededNext(d: Pick<AppDeps, "services">): DevSeedResult["next"] {
  const core = d.services.gates.nextMapItem();
  if (core !== null) return core;
  const focus = d.services.trackPlan.focus().focus;
  if (focus === "core") return null;
  return (d.services.trackPlan.nextSession(focus)?.id ?? null) as DevSeedResult["next"];
}
