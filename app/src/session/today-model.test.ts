import { describe, expect, test } from "bun:test";
import { STEP_META } from "../onboarding/flow.ts";
import { DAY, fixtureBootstrap, fixturePlan, fixtureSession, fixtureStreak, PLANS } from "./fixtures.ts";
import {
  keepAlivePlan,
  learnerObjective,
  looserTolerance,
  onboardingPlace,
  setlistRows,
  type TodayInput,
  todayView,
  warmupSummary,
} from "./today-model.ts";

const TITLES: Record<string, string> = {
  "U01.L01": "Heartbeat",
  "U01.CP": "Checkpoint U01",
  "C0.S1": "Intro",
};
const titleOf = (id: string) => TITLES[id] ?? id;

const input = (over: Partial<TodayInput> = {}): TodayInput => ({
  plan: PLANS.lesson,
  boot: fixtureBootstrap(),
  lastEnded: null,
  titleOf,
  stepsOf: () => 8,
  ...over,
});

describe("Today states (ux §1.4)", () => {
  test("normal day: the setlist, Start session, 20 min", () => {
    const v = todayView(input());
    expect(v.state).toBe("normal");
    expect(v.heading).toBe("Your setlist for today");
    expect(v.primary).toEqual({ action: "start", label: "Start session" });
    expect(v.length).toBe("20 min");
    expect(v.rows.map((r) => r.key)).toEqual(["warmup", "new", "make", "coda"]);
    expect(v.keepAlive).toBe(true);
  });

  test("first run (before onboarding) → Begin", () => {
    const boot = fixtureBootstrap();
    const v = todayView(input({ boot: { ...boot, profile: { ...boot.profile, onboardedAt: null } } }));
    expect(v.state).toBe("first-run");
    expect(v.primary?.action).toBe("onboarding");
    expect(v.keepAlive).toBe(false);
  });

  test("first run left half-way → where they are, and Continue (never Begin again)", () => {
    const boot = fixtureBootstrap();
    const fresh = { ...boot, profile: { ...boot.profile, onboardedAt: null } };
    const begin = todayView(input({ boot: fresh, onboarding: { step: "welcome", completed: [] } }));
    expect(begin.heading).toBe("Welcome to Oak");
    expect(begin.primary).toEqual({ action: "onboarding", label: "Begin" });
    expect(begin.lead).toBe(
      "Your first loop in a minute, then about ten minutes to set up sound and your voice.",
    );
    const mid = todayView(
      input({ boot: fresh, onboarding: { step: "mic", completed: ["welcome", "loop", "edit", "react"] } }),
    );
    expect(mid.state).toBe("first-run");
    expect(mid.heading).toBe("Carry on setting up");
    expect(mid.lead).toBe(`Step 8 of 13: ${STEP_META.mic.label}. Everything you have set up so far is kept.`);
    expect(mid.primary).toEqual({ action: "onboarding", label: "Continue" });
    expect(onboardingPlace({ step: "welcome", completed: ["welcome"] })).toEqual({
      n: 1,
      total: 13,
      label: STEP_META.welcome.label,
    });
    expect(onboardingPlace(null)).toBeNull();
  });

  test("a session open today → Resume session", () => {
    const v = todayView(input({ boot: fixtureBootstrap({ openSession: fixtureSession() }) }));
    expect(v.state).toBe("in-session");
    expect(v.primary?.label).toBe("Resume session");
  });

  test("the session this browser just ended is done, even before the server's open session is re-read", () => {
    const v = todayView(
      input({
        boot: fixtureBootstrap({ openSession: fixtureSession() }),
        lastEnded: { sessionId: "ses_1", day: DAY },
      }),
    );
    expect(v.state).toBe("done");
  });

  test("an open session from yesterday is not resumed", () => {
    const v = todayView(
      input({ boot: fixtureBootstrap({ openSession: fixtureSession({ day: "2026-11-10" }) }) }),
    );
    expect(v.state).toBe("normal");
  });

  test("done for today: no Start, the calm line", () => {
    const v = todayView(input({ lastEnded: { sessionId: "ses_1", day: DAY } }));
    expect(v.state).toBe("done");
    expect(v.heading).toBe("Session complete. See you tomorrow.");
    expect(v.primary).toBeNull();
    expect(todayView(input({ lastEnded: { sessionId: "ses_0", day: "2026-11-10" } })).state).toBe("normal");
  });

  test("a session begun before the 04:00 rollover and ended after it is done for the new day", () => {
    const boot = fixtureBootstrap();
    const prev = "2026-11-10";
    // Ended at 04:15 local on DAY: the session's own day is the previous one.
    const endedAt = new Date(`${DAY}T04:15:00`).toISOString();
    const local = todayView(
      input({
        boot: {
          ...boot,
          profile: { ...boot.profile, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        },
        lastEnded: { sessionId: "ses_0", day: prev, endedAt },
      }),
    );
    expect(local.state).toBe("done");
    // Ended before the rollover: still yesterday's, so today is a normal day.
    const early = new Date(`${DAY}T03:30:00`).toISOString();
    const v = todayView(
      input({
        boot: {
          ...boot,
          profile: { ...boot.profile, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        },
        lastEnded: { sessionId: "ses_0", day: prev, endedAt: early },
      }),
    );
    expect(v.state).toBe("normal");
  });

  test("resume a lesson at its step", () => {
    const v = todayView(input({ plan: PLANS.resume }));
    expect(v.state).toBe("resume");
    expect(v.heading).toBe("Pick up where you left off");
    expect(v.lead).toBe("Heartbeat, from step 4 of 8. Everything before it is saved.");
    expect(v.rows.find((r) => r.key === "new")?.detail).toBe("Heartbeat · from step 4");
  });

  test("15-minute split: part A ends with a Quick sketch, part B resumes", () => {
    const a = todayView(input({ plan: PLANS.splitA }));
    expect(a.state).toBe("split-a");
    expect(a.rows.find((r) => r.key === "make")).toMatchObject({ label: "Quick sketch", amount: 1.5 });
    expect(a.rows.find((r) => r.key === "new")?.detail).toBe("Heartbeat · part 1 of 2");
    const b = todayView(input({ plan: PLANS.splitB }));
    expect(b.state).toBe("split-b");
    expect(b.rows.find((r) => r.key === "new")?.detail).toBe("Heartbeat · part 2 of 2, from step 5");
  });

  test("checkpoint day: no hints, a Make; about 20 minutes at the 15-minute target", () => {
    const v = todayView(input({ plan: PLANS.checkpoint }));
    expect(v.state).toBe("checkpoint");
    expect(v.lead).toBe("No hints, no rush.");
    expect(v.rows.map((r) => [r.key, r.amount])).toEqual([
      ["warmup", 3],
      ["new", 12],
      ["make", 4],
      ["coda", 1],
    ]);
    const v15 = todayView(input({ plan: PLANS.checkpoint15 }));
    expect(v15.length).toBe("about 20 min");
    expect(v15.lead).toBe("No hints, no rush. Checkpoint day: about 20 minutes.");
  });

  test("capstone and gym days: no separate Make row", () => {
    const c = todayView(input({ plan: PLANS.capstone }));
    expect(c.state).toBe("capstone");
    expect(c.rows.map((r) => r.key)).toEqual(["warmup", "new", "coda"]);
    expect(c.rows.find((r) => r.key === "new")).toMatchObject({ label: "Capstone", amount: 15 });
    const g = todayView(input({ plan: PLANS.gym }));
    expect(g.state).toBe("gym");
    expect(g.rows.find((r) => r.key === "new")).toMatchObject({ label: "Transcribe", amount: 14 });
  });

  test("review day: warm-up and Coda, no Keep-alive offer", () => {
    const v = todayView(input({ plan: PLANS.review }));
    expect(v.state).toBe("review");
    expect(v.rows.map((r) => r.key)).toEqual(["warmup", "coda"]);
    expect(v.keepAlive).toBe(false);
  });

  test("review day: the server's note is the lead", () => {
    const note = "The next lessons are still being written. Today: a review, then Studio.";
    const v = todayView(input({ plan: { ...PLANS.review, note } }));
    expect(v.state).toBe("review");
    expect(v.lead).toBe(note);
  });

  test("the edge of what's written: a review day that says so, with Start, never a dead lesson", () => {
    const edge = {
      nextId: "U05.L01",
      nextUnit: { id: "U05", title: "Triads" },
      doneUnit: { id: "U04", title: "Intervals (compressed)" },
    };
    const v = todayView(input({ plan: PLANS.review, edge }));
    expect(v.state).toBe("edge");
    expect(v.heading).toBe("The edge of what's written");
    expect(v.lead).toContain("through Intervals (compressed)");
    expect(v.lead).toContain("Triads, the next unit, is still being written.");
    expect(v.lead).not.toMatch(/behind|missed|lost/i);
    expect(v.primary).toEqual({ action: "start", label: "Start session" });
    expect(v.rows.map((r) => r.key)).toEqual(["warmup", "coda"]);
    // The edge never hides an open session or today's done state.
    const open = todayView(
      input({
        plan: PLANS.review,
        edge,
        server: { day: DAY, open: fixtureSession({ id: "s_open" }), doneForToday: false },
      }),
    );
    expect(open.state).toBe("in-session");
    const done = todayView(
      input({ plan: PLANS.review, edge, server: { day: DAY, open: null, doneForToday: true } }),
    );
    expect(done.state).toBe("done");
  });

  test("the one-tap loosen follows the server's ladder when it answers", () => {
    const ladder = { cents: 35 as const, offerLoosen: true };
    expect(todayView(input({ plan: PLANS.welcomeBack, ladder })).offerLoosen).toBe(true);
    expect(
      todayView(input({ plan: PLANS.lightLoosen, ladder: { cents: 35, offerLoosen: false } })).offerLoosen,
    ).toBe(false);
    expect(
      todayView(input({ plan: PLANS.welcomeBack, ladder: { cents: 70, offerLoosen: true } })).offerLoosen,
    ).toBe(false);
  });

  test("welcome back after 3+ days: recap row, no gap counts in the copy", () => {
    const v = todayView(input({ plan: PLANS.welcomeBack }));
    expect(v.state).toBe("welcome-back");
    expect(v.heading).toBe("Welcome back. We'll ease in.");
    expect(v.rows.map((r) => r.key)).toEqual(["warmup", "recap", "new", "make", "coda"]);
    expect(`${v.heading} ${v.lead}`).not.toMatch(/\d+ days?/);
  });

  test("10+ days: a light session with the constraint; 21+: offer to loosen the sing tolerance", () => {
    const v = todayView(input({ plan: PLANS.light }));
    expect(v.state).toBe("light");
    expect(v.rows.map((r) => r.key)).toEqual(["warmup", "recap", "new", "coda"]);
    expect(v.rows.find((r) => r.key === "new")?.detail).toBe(
      "Revisit the Make of Heartbeat. New idea: Halve the tempo and fill the space.",
    );
    expect(v.offerLoosen).toBe(false);
    expect(todayView(input({ plan: PLANS.lightLoosen })).offerLoosen).toBe(true);
    // Already at the loosest step: nothing to offer.
    const boot = fixtureBootstrap();
    const loose = { ...boot, profile: { ...boot.profile, singToleranceCents: 70 as const } };
    expect(todayView(input({ plan: PLANS.lightLoosen, boot: loose })).offerLoosen).toBe(false);
  });

  test("rest day: the week's goal is met and today is free; Start stays", () => {
    const boot = fixtureBootstrap({
      streak: fixtureStreak({ thisWeek: { ...fixtureStreak().thisWeek, goal: 2 } }),
    });
    const v = todayView(input({ boot }));
    expect(v.restDay).toBe(true);
    expect(v.primary?.action).toBe("start");
  });

  test("a paused week", () => {
    const boot = fixtureBootstrap();
    const v = todayView(
      input({ boot: { ...boot, settings: { ...boot.settings, pausedWeeks: ["2026-11-09"] } } }),
    );
    expect(v.state).toBe("paused-week");
    expect(v.restDay).toBe(false);
  });
});

describe("setlist details", () => {
  test("warm-up summary counts sets, never due cards", () => {
    expect(warmupSummary(PLANS.lesson.warmup.items)).toBe("1 sure-footed set · 1 ear set · 1 fact set");
    expect(
      warmupSummary([
        ...PLANS.lesson.warmup.items,
        { ...(PLANS.lesson.warmup.items[1] as (typeof PLANS.lesson.warmup.items)[number]), mic: true },
      ]),
    ).toBe("1 sure-footed set · 2 ear sets · 1 fact set · 1 with singing");
  });

  test("budgets by target (contracts §9.1): 15 / 20 / 25", () => {
    const at = (t: 15 | 20 | 25) =>
      setlistRows(
        fixturePlan({
          targetMinutes: t,
          warmup: { ...PLANS.lesson.warmup, plannedSec: 600 },
          main: { resumeStep: null, splitPart: null, light: null, estMinutes: { 15: 10, 20: 13, 25: 18 }[t] },
        }),
        titleOf,
      ).map((r) => r.amount);
    expect(at(15)).toEqual([4, 7, 3, 1]);
    expect(at(20)).toEqual([5, 9, 4, 1]);
    expect(at(25)).toEqual([6, 13, 5, 1]);
  });

  test("no warm-up row when nothing is due", () => {
    expect(setlistRows(PLANS.noWarmup, titleOf).map((r) => r.key)).toEqual(["new", "make", "coda"]);
  });

  test("the Make row of a take lesson says what it plays in the song", () => {
    const song = {
      unitId: "U01",
      songId: "usong.U01",
      title: "Count me in",
      flavour: "flavour.pop",
      status: "open",
      takesCount: 2,
      lessonIndex: 3,
      lessonsInSong: 9,
      today: "Your backbeat takes over the second part of the song.",
      side: false,
    } as const;
    const make = (plan: Parameters<typeof setlistRows>[0]) =>
      setlistRows(plan, titleOf).find((r) => r.key === "make")?.detail;
    expect(make(fixturePlan({ song }))).toBe("Your backbeat takes over the second part of the song.");
    // A side step's Make stays a sketch of its own; a lesson in no song is unchanged.
    expect(make(fixturePlan({ song: { ...song, today: null, side: true } }))).toBe(
      "A short sketch with today's tools",
    );
    expect(make(fixturePlan({}))).toBe("A short sketch with today's tools");
  });
});

describe("helpers", () => {
  test("the tolerance ladder loosens one step", () => {
    expect(looserTolerance(25)).toBe(35);
    expect(looserTolerance(35)).toBe(50);
    expect(looserTolerance(50)).toBe(70);
  });

  test("a Keep-alive takes the first (sure) set only", () => {
    const k = keepAlivePlan(PLANS.lesson);
    expect(k.kind).toBe("keepalive");
    expect(k.mapItemId).toBeNull();
    expect(k.main).toBeNull();
    expect(k.warmup.items.map((i) => i.id)).toEqual(["w1"]);
  });
});

describe("Today from the server's record of the day (wave3.md §5.1)", () => {
  const day = (over: Partial<NonNullable<TodayInput["server"]>> = {}) => ({
    day: DAY,
    open: null,
    doneForToday: false,
    ...over,
  });

  test("done for today on the server: done in any browser, whatever this one remembers", () => {
    const v = todayView(input({ server: day({ doneForToday: true }), lastEnded: null }));
    expect(v.state).toBe("done");
    expect(v.primary).toBeNull();
  });

  test("not done on the server: this browser's stale record does not make it done", () => {
    const v = todayView(input({ server: day(), lastEnded: { sessionId: "ses_old", day: DAY } }));
    expect(v.state).toBe("normal");
  });

  test("a session open on the server (another tab, another browser) → Resume session", () => {
    const v = todayView(input({ server: day({ open: fixtureSession({ id: "ses_9" }) }) }));
    expect(v.state).toBe("in-session");
    expect(v.primary?.label).toBe("Resume session");
  });

  test("open before Done, ended since: the session this tab just ended is done", () => {
    const v = todayView(
      input({
        server: day({ open: fixtureSession({ id: "ses_9" }) }),
        lastEnded: { sessionId: "ses_9", day: DAY },
      }),
    );
    expect(v.state).toBe("done");
  });

  test("an open session after an earlier one ended (More practice) is resumed, not done", () => {
    const v = todayView(
      input({ server: day({ open: fixtureSession({ id: "ses_2" }), doneForToday: true }) }),
    );
    expect(v.state).toBe("in-session");
  });

  test("a record of another day (the dev clock moved) is ignored; the bootstrap decides", () => {
    const v = todayView(input({ server: day({ day: "2026-11-10", doneForToday: true }) }));
    expect(v.state).toBe("normal");
  });

  test("a paused week still reads paused when nothing is open or done", () => {
    const boot = fixtureBootstrap();
    const v = todayView(
      input({
        server: day(),
        boot: { ...boot, settings: { ...boot.settings, pausedWeeks: ["2026-11-09"] } },
      }),
    );
    expect(v.state).toBe("paused-week");
  });
});

describe("learnerObjective (retry pass: Today after onboarding)", () => {
  test("U00.L02 says what is new, not the set-up the learner just did", () => {
    const line = learnerObjective(
      "U00.L02",
      "~12 min. Headphones (with AirPods guidance), mic, noise and bleed",
    );
    expect(line).toContain("What you set up today is kept");
    expect(line).not.toMatch(/bleed|¢|octave folding|tonic/);
  });
  test("other lessons keep their syllabus objective", () => {
    expect(learnerObjective("U01.L01", "Feel pulse and beat.")).toBe("Feel pulse and beat.");
    expect(learnerObjective("U01.L01", null)).toBeNull();
  });
});
