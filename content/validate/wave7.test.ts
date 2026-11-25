// Wave 7: the advanced tracks as one course with the core (contracts §2.6, §2.7, §4.3, §7.6). The track gates are
// the ones contracts §4.3 lists; each track lesson is judged at the earliest point a learner can take it (the
// course graph); every legal interleaving of the tracks with U14–U17 is a complete order of all 270 sessions;
// the end of the course is reached only when every session is done; and every shape and rule the registries
// plan for the tracks is implemented or planned, with valid parameters.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  flattenExercise,
  plannedOrImplemented,
  type SessionId,
  TRACK_CUSTOM_RULES,
  unimplementedIn,
  unimplementedInCapstoneSessions,
} from "@oak/content-kit";
import { candos } from "../candos.ts";
import { capstones } from "../capstones.ts";
import { PLANNED_DECKS } from "../decks/planned.ts";
import { families } from "../families.ts";
import { courseGraph, registries } from "../index.ts";
import { atOrBefore } from "../lib/course.ts";
import { CONTENT_ROOT, loadCheckpointFiles, loadLessons } from "../lib/load.bun.ts";
import { milestones } from "../milestones.ts";
import { SESSION_COUNTS, trackOrder } from "../syllabus.ts";
import { exerciseTexts, mdxSteps } from "./authoring.ts";
import { checkCapstone, checkCheckpoint } from "./owners.ts";
import { capstonesWithSongTests } from "./song-tests.ts";

setDefaultTimeout(600_000);

const g = courseGraph();
const ALL = [...g.nodes.keys()];
const S = (id: string) => id as SessionId;
const precedes = (a: string, b: string) => atOrBefore(g, S(a), S(b));

describe("counts (contracts §2.7)", () => {
  test("35 jazz, 21 rhythm, 23 arrangement sessions; 270 in all", () => {
    expect(trackOrder.J).toHaveLength(SESSION_COUNTS.jazz);
    expect(trackOrder.R).toHaveLength(SESSION_COUNTS.rhythm);
    expect(trackOrder.A).toHaveLength(SESSION_COUNTS.arrangement);
    expect(ALL).toHaveLength(SESSION_COUNTS.total);
    expect(SESSION_COUNTS.total).toBe(270);
    const inTracks = new Set([...trackOrder.J, ...trackOrder.R, ...trackOrder.A]);
    const core = new Set(registries.syllabus.defaultOrder);
    for (const id of ALL) expect([id, inTracks.has(id) !== core.has(id)]).toEqual([id, true]);
  });
});

describe("track gates (contracts §4.3)", () => {
  // [session, its gate (guaranteed before), the next core session that is NOT guaranteed before]
  const GATES: [string, string, string | null][] = [
    ["A1.L01", "U03.L02", "U03.L03"],
    ["A1.L05", "U09.CP", "U10.L03"],
    ["A2.L01", "U10.CP", "U11.L03"],
    ["J1.L01", "U13.CP", "U14.L03"],
    ["J2.L03", "U13.CP", "U14.L03"],
    ["J2.L04", "U14.CP", "U15.L03"],
    ["J3.L01", "U13.CP", "U14.L03"],
    ["J4.L01", "U15.L06", "U16.L01"],
    ["J5.L01", "U17.CP", null],
    ["R1.L01", "U13.CP", "U14.L03"],
    ["R3.L05", "U13.CP", "U14.L03"],
    ["JC1.S1", "J.CP1", "J3.L01"],
    ["RC1.S1", "R.CP", null],
    ["AC1.S1", "U11.CP", "U12.L03"],
    ["AC2.S1", "R1.L05", null],
    ["JC2.S1", "J4.L04", "J5.L01"],
    ["JC3.S1", "J.CP2", null],
    ["JC4.S1", "J.CP2", null],
  ];
  for (const [s, gate, notYet] of GATES)
    test(`${s} opens after ${gate}${notYet ? `, maybe before ${notYet}` : ""}`, () => {
      expect([s, gate, precedes(gate, s)]).toEqual([s, gate, true]);
      if (notYet) expect([s, notYet, precedes(notYet, s)]).toEqual([s, notYet, false]);
    });
  test("AC1 needs A.CP and U11.CP; AC2 needs A.CP, J3.L04 and R1.L05", () => {
    for (const x of ["A.CP", "U11.CP"]) expect([x, precedes(x, "AC1.S1")]).toEqual([x, true]);
    for (const x of ["A.CP", "J3.L04", "R1.L05"]) expect([x, precedes(x, "AC2.S1")]).toEqual([x, true]);
  });
  test("J2.L04 can be passed over: J.CP1 and J3 never wait for U14.CP", () => {
    for (const x of ["J.CP1", "J3.L01", "J3.L04", "JC1.S1"])
      expect([x, precedes("U14.CP", x)]).toEqual([x, false]);
    expect(precedes("J2.L04", "J.CP2")).toBe(true);
  });
  test("nothing in the core waits for a track session, and track checkpoints gate only track capstones", () => {
    const track = new Set([...trackOrder.J, ...trackOrder.R, ...trackOrder.A]);
    for (const core of registries.syllabus.defaultOrder)
      for (const t of track) expect([core, t, g.before(core).has(S(t))]).toEqual([core, t, false]);
    for (const cp of ["J.CP1", "J.CP2", "R.CP", "A.CP"])
      for (const [id] of g.nodes)
        if (g.before(id).has(S(cp)))
          expect([cp, id, /^(JC|RC|AC)\d\.S\d$/.test(id) || id === "J.CP2"]).toEqual([cp, id, true]);
  });
});

/** A legal order of the whole course: at each step, the first open session in `rank` order (§7.6). */
function legalOrder(rank: (id: SessionId) => number): SessionId[] {
  const done = new Set<SessionId>();
  const out: SessionId[] = [];
  const pending = new Set(ALL);
  while (pending.size) {
    const open = [...pending].filter((id) => (g.nodes.get(id)?.requires ?? []).every((r) => done.has(r)));
    if (open.length === 0)
      throw new Error(`stuck after ${out.length}: ${[...pending].slice(0, 5).join(" ")}`);
    open.sort((a, b) => rank(a) - rank(b));
    const next = open[0] as SessionId;
    out.push(next);
    done.add(next);
    pending.delete(next);
  }
  return out;
}
const coreRank = new Map(registries.syllabus.defaultOrder.map((id, i) => [id as SessionId, i]));
const trackRank = new Map(
  [...trackOrder.J, ...trackOrder.R, ...trackOrder.A].map((id, i) => [id as SessionId, i] as const),
);

describe("every legal interleaving ends at session 270 (contracts §7.6)", () => {
  // Tracks as early as they open (the learner takes every track session the day it opens), and as late as
  // possible (the core first, as the default order has it), and three seeded random interleavings between.
  const early = legalOrder((id) =>
    trackRank.has(id) ? -1000 + (trackRank.get(id) ?? 0) : (coreRank.get(id) ?? 0),
  );
  const late = legalOrder((id) =>
    coreRank.has(id) ? (coreRank.get(id) ?? 0) : 1000 + (trackRank.get(id) ?? 0),
  );
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const randoms = [1, 2, 3].map(() => {
    const r = new Map(ALL.map((id) => [id, rnd()]));
    return legalOrder((id) => r.get(id) ?? 0);
  });
  const orders = { early, late, random1: randoms[0], random2: randoms[1], random3: randoms[2] };
  for (const [name, order] of Object.entries(orders))
    test(`${name}: every one of the 270 sessions once, each after everything it needs`, () => {
      expect(order).toHaveLength(270);
      expect(new Set(order).size).toBe(270);
      const at = new Map((order ?? []).map((id, i) => [id, i]));
      for (const id of order ?? [])
        for (const r of g.nodes.get(id)?.requires ?? [])
          expect([id, r, (at.get(r) ?? 999) < (at.get(id) ?? -1)]).toEqual([id, r, true]);
    });
  test("the early order really interleaves: the jazz and rhythm tracks start before U14.L03", () => {
    const i = (id: string) => early.indexOf(S(id));
    expect(i("J1.L01")).toBeLessThan(i("U14.L03"));
    expect(i("R1.L01")).toBeLessThan(i("U14.L03"));
    expect(i("A1.L01")).toBeLessThan(i("U03.L03"));
    expect(i("J4.L01")).toBeLessThan(i("U16.L01"));
  });
  test("the late order is the default order of the core, then the tracks", () => {
    expect(late.slice(0, 191)).toEqual(registries.syllabus.defaultOrder as SessionId[]);
  });
  test("You have completed Oak: reached only when every session but the gym slots is done", () => {
    const ms = milestones.find((m) => m.id === "ms.28");
    const w = ms?.when as { sessions?: string[]; capstones?: string[] };
    const ends = [
      ...(w.sessions ?? []),
      ...(w.capstones ?? []).map((c) => {
        const cap = capstones.find((x) => x.id === c);
        return cap?.sessionDefs.at(-1)?.id as string;
      }),
    ].map(S);
    const covered = new Set<SessionId>(ends);
    for (const e of ends) for (const b of g.before(e)) covered.add(b);
    const missing = ALL.filter((id) => !covered.has(id) && !id.startsWith("GYM."));
    expect(missing).toEqual([]);
    // In every order above, the milestone's last condition is met by the course's final non-gym session.
    for (const order of Object.values(orders)) {
      const last = Math.max(...ends.map((e) => (order ?? []).indexOf(e)));
      const lastNonGym = (order ?? []).filter((id) => !id.startsWith("GYM.")).at(-1);
      expect((order ?? [])[last]).toBe(lastNonGym as SessionId);
    }
  });
});

describe("what the tracks plan is implemented or planned", () => {
  const impl = plannedOrImplemented();
  test("every track capstone's brief and sessions use only implemented or planned shapes", () => {
    for (const c of capstones.filter((x) => /^(JC|RC|AC)\d$/.test(x.id))) {
      const uses = [
        ...(c.brief ? unimplementedIn(c.brief, impl) : []),
        ...unimplementedInCapstoneSessions(c, impl),
      ];
      expect([c.id, uses]).toEqual([c.id, []]);
    }
  });
  test("every planned custom rule names the lessons or capstones that use it, and they exist", () => {
    const ids = new Set<string>([...ALL, ...capstones.map((c) => c.id)]);
    for (const [name, r] of Object.entries(TRACK_CUSTOM_RULES))
      for (const u of r.usedBy) expect([name, u, ids.has(u)]).toEqual([name, u, true]);
  });
  test("every planned deck unlocks at a track lesson, trains its nodes and gates its groups later", () => {
    const skillIds = new Set(registries.skills.map((s) => s.id as string));
    for (const d of PLANNED_DECKS) {
      expect([d.id, g.nodes.has(S(d.lesson))]).toEqual([d.id, true]);
      for (const n of d.nodes) expect([d.id, n, skillIds.has(n)]).toEqual([d.id, n, true]);
      for (const gate of Object.keys(d.gates))
        expect([d.id, gate, precedes(d.lesson, gate)]).toEqual([d.id, gate, true]);
    }
  });
  test("every stage G and H family of contracts §7.3 exists and unlocks at a track lesson or earlier", () => {
    const G = families.filter((f) => f.id.startsWith("fam.jzz."));
    expect(G.map((f) => f.id as string).sort()).toEqual(
      [
        "fam.jzz.chord-scale",
        "fam.jzz.extension",
        "fam.jzz.guide",
        "fam.jzz.ii-v",
        "fam.jzz.subs",
        "fam.jzz.voicing",
      ].sort(),
    );
    for (const id of ["fam.rhy.odd-grouping", "fam.rhy.polyrhythm", "fam.rhy.clave"])
      expect([id, families.find((f) => f.id === id)?.unlock.lesson.startsWith("R")]).toEqual([id, true]);
  });
});

// --- the advanced tracks are complete (integrate:content) ----------------------------------------------------------

const { lessons: authoredLessons } = await loadLessons();
const cpFiles = await loadCheckpointFiles();
const trackSessions = [...trackOrder.J, ...trackOrder.R, ...trackOrder.A] as string[];
const TRACK_LESSON_IDS = trackSessions.filter((id) => /\.L\d\d$/.test(id));
const trackLessons = authoredLessons.filter((l) => !l.sample && TRACK_LESSON_IDS.includes(l.def.id));

describe("the advanced tracks are complete (contracts §2.6, §2.7)", () => {
  test("all 55 track lessons are authored and load: J1–J5 (23), R1–R3 (16), A1 (7) and A2 (9)", () => {
    expect(TRACK_LESSON_IDS).toHaveLength(55);
    expect(trackLessons.map((l) => l.def.id as string).sort()).toEqual([...TRACK_LESSON_IDS].sort());
  });
  test("J.CP1, J.CP2, R.CP and A.CP have two or three authored items and a Make", () => {
    for (const id of ["J.CP1", "J.CP2", "R.CP", "A.CP"]) {
      const cp = cpFiles.defs.find((c) => c.id === id);
      expect([id, (cp?.authored.length ?? 0) >= 2 && (cp?.authored.length ?? 0) <= 3, cp?.make.kind]).toEqual(
        [id, true, "code-make"],
      );
    }
  });
  test("every track capstone has a tested brief and its sessions (JC3 against its stand-in head, decision 80)", async () => {
    const counts: Record<string, number> = { JC1: 2, JC2: 2, JC3: 3, JC4: 3, RC1: 2, RC2: 2, AC1: 3, AC2: 3 };
    const all = await capstonesWithSongTests(capstones);
    for (const [id, n] of Object.entries(counts)) {
      const c = all.find((x) => x.id === id);
      expect([id, c?.sessionDefs.length]).toEqual([id, n]);
      const tests = c?.brief?.tests ?? [];
      // JC3's `contrafact` reads I Got Rhythm's head once its answer key exists, and until then the brief's stand-in
      // (J4.L04's head; W7 gate, decision 80), so its brief is tested like every other.
      expect([id, tests.some((t) => t.expect === "pass"), tests.some((t) => t.expect === "fail")]).toEqual([
        id,
        true,
        true,
      ]);
    }
  });
  test("every lesson, step, example and exercise ID of the tracks is in ids.lock.json", () => {
    const lock = new Set(
      (
        JSON.parse(readFileSync(join(CONTENT_ROOT, "ids.lock.json"), "utf8")) as { ids: { id: string }[] }
      ).ids.map((x) => x.id),
    );
    const missing: string[] = [];
    for (const l of trackLessons) {
      const ids = [
        l.def.id,
        ...l.def.steps.flatMap((s) => [
          `${l.def.id}/${s.id}`,
          ...(s.example ? [`${l.def.id}@${s.example.id}`] : []),
          ...(s.exercise ? flattenExercise(s.exercise).map((e) => `${l.def.id}/${e.id}`) : []),
        ]),
      ];
      missing.push(...ids.filter((id) => !lock.has(id)));
    }
    expect(missing).toEqual([]);
  });
  test("each can-do of the tracks is awarded once, by the lesson the registry names", () => {
    const problems: string[] = [];
    for (const c of candos) {
      if (!TRACK_LESSON_IDS.includes(c.source as string)) continue;
      const by = trackLessons.filter((l) => (l.def.canDo as string[]).includes(c.id)).map((l) => l.def.id);
      if (by.join() !== c.source) problems.push(`${c.id}: source ${c.source}, awarded by [${by.join(" ")}]`);
    }
    expect(problems).toEqual([]);
  });
  test("no learner-facing text of a track lesson names a lesson, unit or capstone by its ID", () => {
    const id = /\b(U\d\d|J\d|R\d|A\d)(\.(L\d\d|CP\d?))\b|\b(JC|RC|AC)\d\b/;
    const found: string[] = [];
    for (const l of trackLessons) {
      for (const s of l.def.steps)
        for (const t of [
          { where: `${s.id} title`, text: s.title },
          ...(s.exercise ? exerciseTexts(s.exercise, s.id) : []),
        ])
          if (id.test(t.text)) found.push(`${l.def.id} ${t.where}`);
      for (const [step, m] of mdxSteps(l.mdxSource ?? ""))
        for (const [what, text] of [
          ["prose", m.prose],
          ["pass text", m.onPass],
        ] as const)
          if (id.test(text.replace(/\{\/\*[\s\S]*?\*\/\}/g, ""))) found.push(`${l.def.id} ${step} ${what}`);
    }
    expect(found).toEqual([]);
  });
});

describe("the track checkpoints and capstones pass content:check, the corrections standard included", () => {
  const issuesOf = (sections: { name: string; issues: string[] }[]) =>
    sections.flatMap((x) => x.issues.map((i) => `${x.name}: ${i}`));
  for (const id of ["J.CP1", "J.CP2", "R.CP", "A.CP"])
    test(id, async () => {
      const cp = cpFiles.defs.find((c) => c.id === id);
      expect(issuesOf(await checkCheckpoint(cp as NonNullable<typeof cp>))).toEqual([]);
    });
  // JC3 waits for I Got Rhythm's answer key (its brief has no tests yet). AC1's two versions are rendered by the
  // capstone workspace (`capstone.versions` is IMPLEMENTED), so every listed capstone checks clean.
  for (const id of ["JC1", "JC2", "JC4", "RC1", "RC2", "AC1", "AC2"])
    test(id, async () => {
      const c = capstones.find((x) => x.id === id);
      const found = issuesOf(await checkCapstone(c as NonNullable<typeof c>));
      expect(found).toEqual([]);
    });
});
