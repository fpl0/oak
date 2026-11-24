// What Today shows (ux §1.4): one decision — start the session — and the state around it. Pure, so every plan
// and return state is unit-tested from fixture plans (today-model.test.ts). The page (TodayPage.tsx) renders it.
import type { Bootstrap, OnboardingState, SessionDay, SessionPlan, SideLessons, WarmupItem } from "@oak/api";
import { learnerDay } from "@oak/srs";
import { otherOpenSessions, ownOpenSession, tabId } from "../lib/tab-session.ts";
import { FLOW, STEP_META } from "../onboarding/flow.ts";
import type { CapstoneDay } from "./capstone-day.ts";
import type { CftDay } from "./cft-day.ts";
import { type CourseEdge, edgeLead } from "./edge.ts";
import type { AfterCore } from "./finale-model.ts";
import type { GymDay } from "./gym-day.ts";
import { type SideOffer, sideOffer } from "./side-lessons.ts";
import { blockBudget } from "./store.ts";
import { isRestDay } from "./streak-model.ts";
import { tracksLine } from "./tracks-model.ts";

export type TodayState =
  /** Before onboarding: the only action is to begin it. */
  | "first-run"
  /** A session was started today and not ended: resume it. */
  | "in-session"
  /** Today's session is over: "Session complete. See you tomorrow." */
  | "done"
  /** This week is paused (Settings → Learning → Pause Oak). */
  | "paused-week"
  | "welcome-back"
  | "light"
  | "resume"
  | "split-a"
  | "split-b"
  | "checkpoint"
  | "capstone"
  | "gym"
  | "review"
  /** Every written lesson is done: a review day, Studio, and the plain fact that the next unit is being written. */
  | "edge"
  | "normal";

export type RowKey = "warmup" | "recap" | "new" | "make" | "coda";
/**
 * The line Today shows under "Next time" for a lesson whose syllabus objective is written for authors, not for the
 * learner who just did half of it: U00.L02 repeats nothing onboarding set up (its set-up parts say "Already set
 * up"), so its line says what is new — the same words as the onboarding coda.
 */
export const LEARNER_NEXT_LINE: Readonly<Record<string, string>> = {
  "U00.L02":
    "What you set up today is kept, so it goes straight to the music: you sing the loop's home note, then make the tune end on it.",
};

/** What Today says a lesson is for: the learner line when there is one, else the syllabus objective. */
export function learnerObjective(id: string, objective: string | null): string | null {
  return LEARNER_NEXT_LINE[id] ?? objective;
}

export interface SetlistRow {
  key: RowKey;
  label: string;
  /** Minutes, or seconds for the recap (`unit`). */
  amount: number;
  unit: "min" | "s";
  detail: string;
  /** What today's lesson is for, in one line (its objective), so the day ahead reads as worth opening. */
  sub?: string;
}

export interface TodayView {
  state: TodayState;
  heading: string;
  lead: string | null;
  rows: SetlistRow[];
  /** "20 min", "about 20 min" (checkpoint day at 15). */
  length: string;
  primary: { action: "start" | "resume" | "onboarding"; label: string } | null;
  /** This week's goal is met and today is free: the copy says so, Start stays. */
  restDay: boolean;
  /** ≥ 21 days away: one tap to loosen the sing tolerance one step (contracts §7.9). */
  offerLoosen: boolean;
  /** A Keep-alive (one easy set, ~2 min) is a real option today. */
  keepAlive: boolean;
  /**
   * Wave 5: an optional side lesson offered beside today's session (`alternative`) or, once today's session is
   * done, as "one more" (`after-core`). Never the primary action; null on checkpoint, capstone and return days.
   */
  side: SideOffer | null;
  /** Wave 6: today's New block is a session of the learner's standard (cft-day.ts), with where they are in it. */
  cft: CftDay | null;
  /** Wave 6: a compose capstone under way that waits behind today's CF-T session, in one line. */
  waiting: string | null;
  /** Wave 6: the advanced tracks' honest line (`plan.tracks.note`), or null before any gate is met. */
  tracksLine: string | null;
  /** Wave 6: the lessons of the core are done (finale-model.ts `afterCore`): what is open, under the session. */
  after: AfterCore | null;
  /** Wave 6 (d21): sessions other tabs have open today. This tab starts its own; the day counts once. */
  otherTabs: number;
}

export interface TodayInput {
  plan: SessionPlan;
  boot: Pick<Bootstrap, "profile" | "streak" | "day" | "openSession" | "settings">;
  /**
   * The session this browser ended last (persist.ts), to show "done". `endedAt` (the server's end instant, from
   * the summary) also counts: a session begun before the 04:00 rollover and finished after it belongs to the
   * previous day, yet the learner has just finished for today.
   */
  lastEnded: { sessionId: string; day: string; endedAt?: string | null } | null;
  /**
   * Today's sessions as the server stores them (`GET /session/day`, wave3.md §5.1): the record of "done for
   * today" and of the one open session, so a second browser, a moved dev clock and a seed all agree. `null`
   * while it loads or when the server has not built it (501): then `boot.openSession` and `lastEnded` decide.
   */
  server?: Pick<SessionDay, "day" | "open" | "doneForToday" | "openSessions"> | null;
  /** This tab's id (d21; `tabId()` when absent): the open session Today resumes is this tab's own. */
  tab?: string;
  /** Map item titles (lessons, checkpoints, capstones). */
  titleOf: (id: string) => string;
  /** Step count of a lesson, for "from step 4 of 8". */
  stepsOf?: (lessonId: string) => number | null;
  /** A lesson's objective (the syllabus), shown under the New row. */
  objectiveOf?: (id: string) => string | null;
  /** `GET /side-lessons` (Wave 5): the offer's fallback on a server whose plan has no `sideLesson`. */
  sideLessons?: Pick<SideLessons, "open" | "items" | "next"> | null;
  /** The written course is used up (edge.ts): review days until the next unit is written. */
  edge?: CourseEdge | null;
  /** A capstone session day (capstone-day.ts): which session of how many, and whether the draft resumes. */
  capstone?: CapstoneDay | null;
  /** A transcription slot (gym-day.ts): ladder or own audio, level and realism, explained. */
  gym?: GymDay | null;
  /** The Transcription Gym is open (from U07.L01): the edge names it among the ways on. */
  gymOpen?: boolean;
  /**
   * The tolerance ladder (`voice.get`, wave3.md §5.3): the one-tap loosen is offered when the server offers it.
   * `null` while it loads; then the plan's return note and the profile decide, as in Wave 2.
   */
  ladder?: { cents: 25 | 35 | 50 | 70; offerLoosen: boolean } | null;
  /** Wave 6: the CF-T day of today's plan (cft-day.ts), and the capstone that waits behind it. */
  cft?: CftDay | null;
  waiting?: string | null;
  /** Wave 6: what is open once the lessons of the core are done (finale-model.ts). */
  after?: AfterCore | null;
  /**
   * Onboarding as the server keeps it (`GET /onboarding`): a learner who left it half-way is told where they are
   * and carries on ("Step 8 of 13: Microphone" + Continue), never "Begin" again (docs/design/retry.md §6.4).
   */
  onboarding?: Pick<OnboardingState, "step" | "completed"> | null;
}

/** Where a learner who left onboarding half-way stands, or null when they have not begun it. */
export function onboardingPlace(
  o: Pick<OnboardingState, "step" | "completed"> | null | undefined,
): { n: number; total: number; label: string } | null {
  if (!o || (o.step === "welcome" && o.completed.length === 0)) return null;
  const n = FLOW.indexOf(o.step);
  if (n < 0) return null;
  return { n: n + 1, total: FLOW.length, label: STEP_META[o.step].label };
}

const WARMUP_LABEL: Record<WarmupItem["kind"], [string, string]> = {
  anchor: ["sure-footed set", "sure-footed sets"],
  repair: ["repair set", "repair sets"],
  "family-set": ["ear set", "ear sets"],
  "composite-set": ["mixed set", "mixed sets"],
  "concept-set": ["concept set", "concept sets"],
  "fact-set": ["fact set", "fact sets"],
  "blocked-intro": ["new family", "new families"],
  listen: ["listening", "listenings"],
};

/** "1 sure-footed set · 2 ear sets · 1 sing" (set counts, never raw due-card counts). */
export function warmupSummary(items: readonly WarmupItem[]): string {
  const counts = new Map<WarmupItem["kind"], number>();
  for (const i of items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  const parts = [...counts].map(([k, n]) => `${n} ${WARMUP_LABEL[k][n === 1 ? 0 : 1]}`);
  const sing = items.filter((i) => i.mic).length;
  if (sing > 0) parts.push(`${sing} with singing`);
  return parts.join(" · ");
}

const stepNo = (stepId: string) => stepId.replace(/^S/, "");
const round = (x: number) => Math.max(1, Math.round(x));

/** The rows of the setlist (contracts §9.1 budgets; capstone, gym and light days have no separate Make). */
export function setlistRows(
  plan: SessionPlan,
  titleOf: (id: string) => string,
  days: {
    capstone?: CapstoneDay | null;
    gym?: GymDay | null;
    cft?: CftDay | null;
    objectiveOf?: ((id: string) => string | null) | undefined;
  } = {},
): SetlistRow[] {
  const b = blockBudget(plan.kind, plan.targetMinutes);
  const rows: SetlistRow[] = [];
  if (plan.warmup.items.length > 0)
    rows.push({
      key: "warmup",
      label: "Warm-up",
      amount: Math.min(b.warmup, round(plan.warmup.plannedSec / 60)),
      unit: "min",
      detail: warmupSummary(plan.warmup.items),
    });
  if (plan.returning?.recap)
    rows.push({
      key: "recap",
      label: "Recap",
      amount: 30,
      unit: "s",
      detail: "Your last can-do and your last sketch, to pick up the thread",
    });
  const main = plan.main;
  const title = plan.mapItemId ? titleOf(plan.mapItemId) : plan.title;
  switch (plan.kind) {
    case "lesson": {
      if (!main) break;
      const split = main.splitPart;
      const quick = split === "A";
      const makeMin = quick ? 1.5 : b.make;
      const what =
        split === "A"
          ? `${title} · part 1 of 2`
          : split === "B"
            ? `${title} · part 2 of 2, from step ${stepNo(main.resumeStep ?? "S1")}`
            : main.resumeStep
              ? `${title} · from step ${stepNo(main.resumeStep)}`
              : title;
      const objective = plan.mapItemId ? (days.objectiveOf?.(plan.mapItemId) ?? null) : null;
      rows.push({
        key: "new",
        label: "New",
        amount: round(main.estMinutes - makeMin),
        unit: "min",
        detail: what,
        ...(objective ? { sub: objective } : {}),
      });
      rows.push(
        quick
          ? {
              key: "make",
              label: "Quick sketch",
              amount: 1.5,
              unit: "min",
              detail: "Saves your loop at the lesson's midpoint",
            }
          : {
              key: "make",
              label: "Make",
              amount: makeMin,
              unit: "min",
              // A take lesson's Make plays inside the unit's song (spec 2026-11-24 §5.5): its line says where.
              detail:
                plan.song?.today && !plan.song.side ? plan.song.today : "A short sketch with today's tools",
            },
      );
      break;
    }
    case "checkpoint":
      rows.push({
        key: "new",
        label: "Checkpoint",
        amount: b.new,
        unit: "min",
        detail: `${title} · no hints, no rush`,
      });
      rows.push({
        key: "make",
        label: "Make",
        amount: b.make,
        unit: "min",
        detail: "A groove or melody with this unit's tools",
      });
      break;
    case "capstone":
      // CF-T fills the transcription slot (contracts §2.5): the row reads as the slot it is, with the song.
      if (days.cft) {
        rows.push({
          key: "new",
          label: "Transcribe",
          amount: b.new,
          unit: "min",
          detail: `${days.capstone ? days.capstone.detail : title}${
            days.cft.songTitle ? ` · ${days.cft.songTitle}` : ""
          } · the saved draft is the Make`,
        });
        break;
      }
      rows.push({
        key: "new",
        label: "Capstone",
        amount: b.new,
        unit: "min",
        detail: days.capstone
          ? `${days.capstone.detail} · the draft is the Make`
          : `${title} · the draft is the Make`,
      });
      break;
    case "gym":
      rows.push({
        key: "new",
        label: "Transcribe",
        amount: b.new,
        unit: "min",
        detail: days.gym ? `${days.gym.detail} · the saved version is the Make` : plan.title,
      });
      break;
    case "light":
      if (main?.light)
        rows.push({
          key: "new",
          label: "Light session",
          amount: round(main.estMinutes),
          unit: "min",
          detail: `Revisit the Make of ${titleOf(main.light.lessonId)}. New idea: ${main.light.constraint}`,
        });
      break;
    default:
      break;
  }
  rows.push({
    key: "coda",
    label: "Coda",
    amount: 1,
    unit: "min",
    detail: "What changed today, and what's next",
  });
  return rows;
}

function stateOfPlan(plan: SessionPlan): TodayState {
  if (plan.kind === "light") return "light";
  if (plan.returning) return "welcome-back";
  switch (plan.kind) {
    case "checkpoint":
      return "checkpoint";
    case "capstone":
      return "capstone";
    case "gym":
      return "gym";
    case "review":
      return "review";
    case "lesson":
      if (plan.main?.splitPart === "A") return "split-a";
      if (plan.main?.splitPart === "B") return "split-b";
      if (plan.main?.resumeStep) return "resume";
      return "normal";
    default:
      return "normal";
  }
}

const HEADING: Record<TodayState, string> = {
  "first-run": "Welcome to Oak",
  "in-session": "Your session is open",
  done: "Session complete. See you tomorrow.",
  "paused-week": "Oak is paused this week",
  "welcome-back": "Welcome back. We'll ease in.",
  light: "Welcome back. We'll ease in.",
  resume: "Pick up where you left off",
  "split-a": "Your setlist for today",
  "split-b": "Pick up where you left off",
  checkpoint: "Checkpoint day",
  capstone: "Capstone day",
  gym: "Transcription Gym",
  review: "Review day",
  edge: "The edge of what's written",
  normal: "Your setlist for today",
};

function leadOf(state: TodayState, input: TodayInput): string | null {
  const { plan } = input;
  const title = plan.mapItemId ? input.titleOf(plan.mapItemId) : plan.title;
  switch (state) {
    case "first-run": {
      const place = onboardingPlace(input.onboarding);
      return place
        ? `Step ${place.n} of ${place.total}: ${place.label}. Everything you have set up so far is kept.`
        : "Your first loop in a minute, then about ten minutes to set up sound and your voice.";
    }
    case "in-session":
      return "Everything you did is saved. Carry on from the block you were in.";
    case "done":
      return "Stopping here is good practice: spacing beats cramming.";
    case "paused-week":
      return "Nothing is expected this week. If you feel like playing, the session is here.";
    case "welcome-back":
      return `A warm-up of things you know, a short recap, then straight on with ${title}.`;
    case "light":
      return "A warm-up of things you know, a short recap, then a light session: a Make you have done before, with one new idea. The course carries on next time.";
    case "resume": {
      const step = plan.main?.resumeStep;
      const total = input.stepsOf?.(plan.mapItemId ?? "") ?? null;
      return step
        ? `${title}, from step ${stepNo(step)}${total ? ` of ${total}` : ""}. Everything before it is saved.`
        : null;
    }
    case "split-a":
      return `At 15 minutes, ${title} comes in two parts. Today ends at its midpoint with a quick sketch; part 2 is next time.`;
    case "split-b":
      return `Part 2 of ${title}: a 20-second recap, then the rest of the lesson and its Make.`;
    case "checkpoint":
      return plan.note ? `No hints, no rush. ${plan.note}.` : "No hints, no rush.";
    case "capstone":
      return (
        input.cft?.lead ??
        input.capstone?.lead ??
        plan.note ??
        "Today's work is a draft for your album. It saves as you go."
      );
    case "gym":
      return input.gym?.lead ?? plan.note ?? "Listen, then write down what you hear.";
    case "review":
      return (
        // After the whole course the planner's "nothing of the track you chose…" fallback is not news: every track
        // is complete, and the day is an ordinary review day.
        (plan.course === "complete" && plan.note && /track|focus/i.test(plan.note) ? null : plan.note) ??
        (plan.course === "complete"
          ? "Reviews keep what you know fresh and the Oak green. The gym and Studio are open when they are done."
          : plan.core === "complete"
            ? "Reviews keep what you know fresh and the Oak green. Studio is open when they are done."
            : "Nothing new is open right now. Today keeps what you know fresh.")
      );
    case "edge":
      return input.edge ? edgeLead(input.edge, { gym: input.gymOpen === true }) : plan.note;
    default:
      return plan.note;
  }
}

/** The ISO week start (Monday) of a day, for the paused-week check. */
function weekStartOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/** The learner day a session ended on: its end instant through the rollover, else the session's own day. */
function endedOn(
  e: NonNullable<TodayInput["lastEnded"]>,
  p: Pick<Bootstrap["profile"], "timezone" | "rolloverHour">,
): string {
  if (!e.endedAt) return e.day;
  const at = new Date(e.endedAt);
  if (Number.isNaN(at.getTime())) return e.day;
  try {
    const ended = learnerDay(at, p.timezone, p.rolloverHour);
    return ended.localeCompare(e.day) > 0 ? ended : e.day;
  } catch {
    return e.day;
  }
}

/** A day with nothing open and nothing done: a paused week, or the plan's own state. */
function activeState({ plan, boot, edge }: TodayInput): TodayState {
  if (boot.settings.pausedWeeks.includes(weekStartOf(boot.day))) return "paused-week";
  const state = stateOfPlan(plan);
  // Once the core is complete a review day is an ordinary day, never "the edge of what's written".
  return state === "review" && edge && plan.core !== "complete" ? "edge" : state;
}

export function todayView(input: TodayInput): TodayView {
  const { plan, boot } = input;
  const rows = setlistRows(plan, input.titleOf, {
    capstone: input.capstone ?? null,
    gym: input.gym ?? null,
    cft: input.cft ?? null,
    objectiveOf: input.objectiveOf,
  });
  // A review day is as long as its sets, not the day's target (the server plans what is due, nothing more).
  const rowMinutes = rows.reduce((sum, r) => sum + (r.unit === "min" ? r.amount : r.amount / 60), 0);
  const length =
    plan.kind === "checkpoint" && plan.targetMinutes === 15
      ? "about 20 min"
      : plan.kind === "review"
        ? `about ${Math.max(1, Math.round(rowMinutes))} min`
        : `${plan.targetMinutes} min`;
  let state: TodayState;
  const server = input.server && input.server.day === boot.day ? input.server : null;
  const tab = input.tab ?? tabId();
  // d21: the session this tab resumes is its own. Another tab's open session is never joined.
  const own = server ? ownOpenSession(server, tab) : null;
  const bootOwn =
    boot.openSession && (boot.openSession.tabId == null || boot.openSession.tabId === tab)
      ? boot.openSession
      : null;
  if (!boot.profile.onboardedAt) state = "first-run";
  else if (server) {
    // The server is the record. Only one thing is newer than its answer: the session this tab just ended
    // (a `session.day` read before the end still lists it as open).
    const justEnded = input.lastEnded?.sessionId ?? null;
    if (own && own.id !== justEnded) state = "in-session";
    else if (server.doneForToday || (own !== null && own.id === justEnded)) state = "done";
    else state = activeState(input);
  } else if (bootOwn && bootOwn.day === boot.day && bootOwn.id !== input.lastEnded?.sessionId)
    state = "in-session";
  else if (input.lastEnded && endedOn(input.lastEnded, boot.profile) === boot.day) state = "done";
  else state = activeState(input);

  const primary: TodayView["primary"] =
    state === "first-run"
      ? { action: "onboarding", label: onboardingPlace(input.onboarding) ? "Continue" : "Begin" }
      : state === "in-session"
        ? { action: "resume", label: "Resume session" }
        : state === "done"
          ? null
          : { action: "start", label: "Start session" };
  const active = state !== "first-run" && state !== "done" && state !== "in-session";
  // The side lesson never displaces the core (wave5.md §5.1): beside an active day, or as "one more" once done.
  const side =
    active || state === "done"
      ? sideOffer(plan, input.sideLessons, { done: state === "done", titleOf: input.titleOf })
      : null;
  const cft = state === "capstone" ? (input.cft ?? null) : null;
  return {
    state,
    heading: cft
      ? cft.fillsSlot
        ? "Transcription slot: your standard"
        : "Your standard"
      : state === "first-run" && onboardingPlace(input.onboarding)
        ? "Carry on setting up"
        : HEADING[state],
    lead: leadOf(state, input),
    rows,
    length,
    primary,
    restDay: active && state !== "paused-week" && isRestDay(boot.streak),
    offerLoosen:
      active &&
      (input.ladder
        ? input.ladder.offerLoosen && input.ladder.cents < 70
        : plan.returning?.offerLoosen === true && boot.profile.singToleranceCents < 70),
    keepAlive: active && plan.kind !== "review" && plan.warmup.items.length > 0,
    side,
    cft,
    waiting: cft ? (input.waiting ?? null) : null,
    tracksLine: state === "first-run" ? null : tracksLine(plan),
    after: state === "first-run" ? null : (input.after ?? null),
    otherTabs: server && state !== "first-run" ? otherOpenSessions(server, tab).length : 0,
  };
}

/** The one step looser on the sing-tolerance ladder (contracts §8.2): 25 → 35 → 50 → 70. */
export function looserTolerance(cents: 25 | 35 | 50 | 70): 35 | 50 | 70 {
  return cents === 25 ? 35 : cents === 35 ? 50 : 70;
}

/** A Keep-alive plan from today's plan: its first warm-up set (the sure win) and the optional riff. */
export function keepAlivePlan(plan: SessionPlan): SessionPlan {
  const first = plan.warmup.items[0];
  return {
    ...plan,
    kind: "keepalive",
    mapItemId: null,
    title: "Keep-alive",
    note: null,
    main: null,
    returning: null,
    warmup: {
      ...plan.warmup,
      items: first ? [first] : [],
      plannedSec: first?.estSec ?? 0,
      moreAvailable: false,
    },
  };
}
