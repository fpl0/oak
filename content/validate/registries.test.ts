// Registry integrity (architecture §3.7 items 1–2, contracts §1, §2.5, §2.7, §4, §7.3, §7.6): IDs are
// unique and well-formed, every reference resolves, the course adds up, the default order is a legal
// order, the skill graph is ordered in every legal order, and the ID ledger holds.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type IdKind, isId, type SessionId } from "@oak/content-kit";
import { CUSTOM_RUBRIC_FNS } from "../capstones.ts";
import { CHECKPOINT_RETESTS } from "../checkpoints.ts";
import { courseGraph, registries } from "../index.ts";
import { atOrBefore, sessionCycles, skillOrderIssues } from "../lib/course.ts";
import { LANDMARKS, SESSION_COUNTS } from "../syllabus.ts";
import { BAD_LOG, evaluate, lint } from "./harness.ts";

setDefaultTimeout(60_000);

const R = registries;
const g = courseGraph();
const ids = (kind: IdKind, list: readonly { id: string }[]) => list.map((x) => [kind, x.id] as const);

describe("IDs", () => {
  const all = [
    ...ids("unit", R.syllabus.units),
    ...R.syllabus.units.flatMap((u) => ids("lesson", u.lessons)),
    ...ids("checkpoint", R.checkpoints),
    ...ids("capstone", R.capstones),
    ...R.capstones.flatMap((c) => ids("capstoneSession", c.sessionDefs)),
    ...ids("skill", R.skills),
    ...ids("family", R.families),
    ...ids("deck", R.decks),
    ...R.decks.flatMap((d) => ids("fact", d.cards)),
    ...ids("term", R.terms),
    ...ids("canDo", R.candos),
    ...ids("milestone", R.milestones),
    ...ids("flavour", R.flavours),
    ...ids("band", R.bands),
    ...ids("song", R.repertoire),
    ...ids("unitSong", R.unitSongs),
    ...R.syllabus.defaultOrder.filter((s) => s.startsWith("GYM.")).map((id) => ["gymSession", id] as const),
  ];
  test("every ID matches its grammar", () => {
    const bad = all.filter(([kind, id]) => !isId(kind, id));
    expect(bad).toEqual([]);
  });
  test("every ID is globally unique", () => {
    const seen = new Map<string, number>();
    for (const [, id] of all) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1)).toEqual([]);
  });
  test("toolbox IDs match their grammar (tool, sound, scale or chord family)", () => {
    const bad = R.toolbox.filter(
      (t) => !(["tool", "sound", "scale", "chordFamily"] as IdKind[]).some((k) => isId(k, t.id)),
    );
    expect(bad.map((t) => t.id)).toEqual([]);
  });
  test("the ID ledger: nothing locked has disappeared unless retired", () => {
    const lock = JSON.parse(readFileSync(join(import.meta.dir, "..", "ids.lock.json"), "utf8")) as {
      ids: { id: string; kind: string; retiredAt?: string }[];
    };
    const live = new Set<string>([...all.map(([, id]) => id), ...R.toolbox.map((t) => t.id)]);
    // Step, exercise and example IDs live in lesson files: build.test.ts and course.test.ts check those.
    const lessonScoped = new Set(["step", "exercise", "example"]);
    const lost = lock.ids
      .filter((e) => !e.retiredAt && !lessonScoped.has(e.kind) && !live.has(e.id))
      .map((e) => e.id);
    expect(lost).toEqual([]);
    const retired = new Set(lock.ids.filter((e) => e.retiredAt).map((e) => e.id));
    expect([...retired].filter((id) => live.has(id))).toEqual([]);
    expect(retired.has("CF")).toBe(true);
    expect(retired.has("E12")).toBe(true);
  });
});

describe("course map (contracts §2)", () => {
  const core = R.syllabus.units.filter((u) => u.track === "core");
  const coreCaps = R.capstones.filter((c) => !/^[JRA]C/.test(c.id));
  test("session counts of §2.7", () => {
    expect(core.flatMap((u) => u.lessons).length).toBe(SESSION_COUNTS.coreLessons);
    expect(R.checkpoints.filter((c) => c.id.startsWith("U")).length).toBe(SESSION_COUNTS.coreCheckpoints);
    expect(coreCaps.reduce((n, c) => n + c.sessions, 0)).toBe(SESSION_COUNTS.coreCapstoneSessions);
    expect(R.syllabus.defaultOrder.filter((s) => s.startsWith("GYM.")).length).toBe(
      SESSION_COUNTS.gymSessions,
    );
    expect(R.syllabus.defaultOrder.length).toBe(SESSION_COUNTS.core);
    for (const track of R.syllabus.tracks) {
      const lessons = track.units.flatMap(
        (u) => R.syllabus.units.find((x) => x.id === u)?.lessons ?? [],
      ).length;
      const caps = R.capstones
        .filter((c) => track.capstones.includes(c.id))
        .reduce((n, c) => n + c.sessions, 0);
      const n = lessons + track.checkpoints.length + caps;
      expect(n).toBe(
        { J: SESSION_COUNTS.jazz, R: SESSION_COUNTS.rhythm, A: SESSION_COUNTS.arrangement }[track.id],
      );
    }
    expect(g.nodes.size).toBe(SESSION_COUNTS.total);
  });
  test("the default order lists every core session exactly once and is a legal order", () => {
    const order = R.syllabus.defaultOrder;
    expect(new Set(order).size).toBe(order.length);
    const coreSessions = [...g.nodes.values()]
      .filter((n) => n.track === "core" && n.kind !== "gym")
      .map((n) => n.id);
    expect(coreSessions.filter((s) => !order.includes(s))).toEqual([]);
    order.forEach((id, i) => {
      for (const r of g.nodes.get(id)?.requires ?? [])
        expect([id, r, order.indexOf(r) < i]).toEqual([id, r, true]);
    });
  });
  test("a checkpoint always falls after the next unit's L01 (§2.5)", () => {
    const order = R.syllabus.defaultOrder;
    for (const u of R.syllabus.units.filter((x) => x.track === "core" && x.checkpoint)) {
      const next = R.syllabus.units[R.syllabus.units.indexOf(u) + 1];
      if (next?.track !== "core") continue;
      expect([
        u.checkpoint,
        order.indexOf(u.checkpoint as SessionId) > order.indexOf(next.lessons[0]?.id as SessionId),
      ]).toEqual([u.checkpoint, true]);
    }
  });
  test("landmarks of §2.5", () => {
    for (const { session, n } of Object.values(LANDMARKS))
      expect(R.syllabus.defaultOrder.indexOf(session) + 1).toBe(n);
  });
  test("the session graph has no cycles", () => expect(sessionCycles(g)).toEqual([]));
  test("legal-order facts of §7.6", () => {
    expect(atOrBefore(g, "U02.CP", "U03.L03")).toBe(true);
    expect(atOrBefore(g, "U02.CP", "U03.L02")).toBe(false);
    expect(atOrBefore(g, "U07.CP", "U09.L01")).toBe(true);
    expect(atOrBefore(g, "C1.S1", "U03.L04")).toBe(false); // a capstone never gates a lesson
    expect(atOrBefore(g, "J2.L04", "J3.L01")).toBe(false); // J2.L04 can be passed over
    expect(atOrBefore(g, "U14.CP", "J2.L04")).toBe(true);
    expect(atOrBefore(g, "U03.L02", "A1.L01")).toBe(true);
    expect(atOrBefore(g, "U05.L01", "A1.L01")).toBe(false); // side lessons can come straight after U03.L02
    expect(atOrBefore(g, "C2.S2", "X1.S1")).toBe(true);
    expect(atOrBefore(g, "J2.L03", "J.CP1")).toBe(true);
    expect(atOrBefore(g, "J2.L04", "J.CP1")).toBe(false);
    expect(atOrBefore(g, "J5.L05", "J.CP2")).toBe(false);
  });
});

describe("skill graph (contracts §4)", () => {
  test("143 live nodes in 8 regions", () => {
    expect(R.skills.filter((s) => !s.retired).length).toBe(143);
    expect(new Set(R.skills.map((s) => s.region)).size).toBe(8);
  });
  test("every node is introduced once and every prerequisite comes first in every legal order", () => {
    expect(skillOrderIssues(g, R.syllabus, R.skills)).toEqual([]);
  });
  test("practised nodes were introduced before, in every legal order", () => {
    const intro = new Map(R.skills.map((s) => [s.id as string, s.introducedBy as string]));
    const bad: string[] = [];
    for (const u of R.syllabus.units)
      for (const l of u.lessons)
        for (const p of l.practises) {
          const at = intro.get(p);
          if (!at || !(at === l.id || atOrBefore(g, at as SessionId, l.id)))
            bad.push(`${l.id} practises ${p} (introduced ${at})`);
        }
    expect(bad).toEqual([]);
  });
  test("every node is first listed in exactly one checkpoint, and that is its `checkpoint`", () => {
    const first = new Map<string, string>();
    const retests = new Set(
      Object.entries(CHECKPOINT_RETESTS).flatMap(([cp, s]) => (s ?? []).map((x) => `${cp}:${x}`)),
    );
    for (const cp of R.checkpoints)
      for (const s of [...cp.gated, ...cp.levelSetting]) {
        if (first.has(s)) expect(retests.has(`${cp.id}:${s}`)).toBe(true);
        else first.set(s, cp.id);
      }
    for (const s of R.skills.filter((x) => !x.retired))
      expect([s.id, first.get(s.id)]).toEqual([s.id, s.checkpoint as string]);
  });
  test("gated skills are fact, concept or creative; level-setting ones perceptual or production (§7.6)", () => {
    const kind = new Map(R.skills.map((s) => [s.id as string, s.kind]));
    for (const cp of R.checkpoints) {
      for (const s of cp.gated)
        expect([cp.id, s, ["fact", "concept", "creative"].includes(kind.get(s) ?? "")]).toEqual([
          cp.id,
          s,
          true,
        ]);
      for (const s of cp.levelSetting)
        expect([cp.id, s, ["perceptual", "production"].includes(kind.get(s) ?? "")]).toEqual([
          cp.id,
          s,
          true,
        ]);
    }
  });
});

describe("references resolve", () => {
  const skillIds = new Set(R.skills.map((s) => s.id as string));
  const lessonIds = new Set(R.syllabus.units.flatMap((u) => u.lessons.map((l) => l.id as string)));
  const sessionIds = new Set(g.nodes.keys() as Iterable<string>);
  const node = (ref: string) => ref.split("/")[0] as string;
  test("families and decks", () => {
    const bad: string[] = [];
    for (const f of R.families) {
      if (!lessonIds.has(f.unlock.lesson)) bad.push(`${f.id} unlock ${f.unlock.lesson}`);
      for (const s of f.skills) if (!skillIds.has(node(s.skill))) bad.push(`${f.id} skill ${s.skill}`);
      for (const c of f.categories) {
        if (!lessonIds.has(c.unlockAt) && !c.id.startsWith("fam.")) bad.push(`${f.id}/${c.id} ${c.unlockAt}`);
        if (c.skill && !skillIds.has(node(c.skill))) bad.push(`${f.id}/${c.id} skill ${c.skill}`);
      }
      for (const v of Object.values(f.unlock.levelGates ?? {}))
        for (const l of Array.isArray(v) ? v : [v]) if (!lessonIds.has(l)) bad.push(`${f.id} gate ${l}`);
    }
    for (const d of R.decks) {
      if (!skillIds.has(d.unlock.skill) || !lessonIds.has(d.unlock.lesson)) bad.push(d.id);
      for (const c of d.cards) if (c.gate && !lessonIds.has(c.gate)) bad.push(`${c.id} gate ${c.gate}`);
    }
    expect(bad).toEqual([]);
  });
  test("a family's later level gates never open before the family itself in the default order", () => {
    const order = [
      ...R.syllabus.defaultOrder,
      ...R.syllabus.units.filter((u) => u.track !== "core").flatMap((u) => u.lessons.map((l) => l.id)),
    ];
    const rank = (l: string) => order.indexOf(l as SessionId);
    for (const f of R.families.filter((x) => !x.id.startsWith("fam.mix.")))
      for (const [level, v] of Object.entries(f.unlock.levelGates ?? {}))
        for (const l of Array.isArray(v) ? v : [v])
          expect([f.id, level, l, rank(l) >= rank(f.unlock.lesson)]).toEqual([f.id, level, l, true]);
  });
  test("terms, can-dos, capstones, repertoire, flavours", () => {
    const bad: string[] = [];
    for (const t of R.terms) if (!lessonIds.has(t.introducedBy)) bad.push(`${t.id} ${t.introducedBy}`);
    const termIds = new Set(R.terms.map((t) => t.id as string));
    for (const t of R.terms)
      if (t.pairedWith && !termIds.has(t.pairedWith)) bad.push(`${t.id} pair ${t.pairedWith}`);
    const candoIds = new Set(R.candos.map((c) => c.id as string));
    for (const c of R.candos) {
      if (!sessionIds.has(c.source) && !R.capstones.some((x) => x.id === c.source))
        bad.push(`${c.id} source ${c.source}`);
      for (const s of c.skills) if (!skillIds.has(s)) bad.push(`${c.id} skill ${s}`);
    }
    const songIds = new Set(R.repertoire.map((s) => s.id as string));
    for (const c of R.capstones) {
      for (const cd of c.canDo) if (!candoIds.has(cd)) bad.push(`${c.id} can-do ${cd}`);
      for (const s of c.song ?? []) if (!songIds.has(s)) bad.push(`${c.id} song ${s}`);
      for (const rule of c.brief?.rubric ?? []) {
        for (const s of rule.skills) if (!skillIds.has(node(s))) bad.push(`${c.id}/${rule.id} skill ${s}`);
        if (rule.rule === "custom" && !(rule.fn in CUSTOM_RUBRIC_FNS))
          bad.push(`${c.id}/${rule.id} custom ${rule.fn}`);
      }
    }
    for (const s of R.repertoire)
      for (const u of s.usedIn)
        if (!sessionIds.has(u) && !R.capstones.some((c) => c.id === u)) bad.push(`${s.id} used in ${u}`);
    const tools = new Set(R.toolbox.map((t) => t.id as string));
    for (const f of R.flavours)
      for (const s of [f.drums, f.bass, f.chords, f.lead]) if (!tools.has(s)) bad.push(`${f.id} sound ${s}`);
    expect(bad).toEqual([]);
  });
  test("repertoire: nothing after 1930, every source 1930 or earlier, nothing marked verified by a machine", () => {
    for (const s of R.repertoire) {
      if (s.year !== "trad") expect(s.year).toBeLessThanOrEqual(1930);
      expect(s.provenance.year).toBeLessThanOrEqual(1930);
      expect(s.verified).toBe(false);
      expect(s.status === "trad").toBe(s.year === "trad");
    }
  });
  test("capstones: one album slot each, the four flavours offered, the review count of §10.6", () => {
    for (const c of R.capstones) {
      expect(c.reviewRevisions).toBe(["C0", "C1", "C2", "C3", "C4", "X1"].includes(c.id) ? 1 : 2);
      if (c.kind === "compose") expect(c.brief?.flavours?.length).toBe(4);
    }
  });
  test("ear stages name real families (§7.3)", () => {
    const famIds = new Set(R.families.map((f) => f.id as string));
    for (const list of Object.values(R.earStages)) for (const f of list) expect(famIds.has(f)).toBe(true);
  });
});

// Wave 5: every glossary entry's audio example (terms.ts) plays and is legal where the term is introduced,
// in every legal order, so the glossary card of a side lesson (A1) is playable by a learner at U03.L02.
describe("glossary examples", () => {
  // The meter a glossary example's tempo line names (contracts §6.9); the odd meters are the R2 track's.
  const meterOf = (code: string) =>
    /setcpm\(\d+\/3\)/.test(code)
      ? "3/4"
      : /setcpm\(\d+\/2\)/.test(code)
        ? "2/4"
        : /setcpm\(\d+\/7\)/.test(code)
          ? "7/8"
          : /setcpm\(\d+\/9\)/.test(code)
            ? "9/8i"
            : /setcpm\(\d+\/5\)/.test(code)
              ? "5/4"
              : "4/4";
  for (const t of R.terms)
    test(`${t.id} plays and lints at ${t.introducedBy}`, async () => {
      const r = await evaluate(t.example, 2);
      expect([t.id, r.ok, r.error ?? ""]).toEqual([t.id, true, ""]);
      expect([t.id, r.events.length > 0]).toEqual([t.id, true]);
      expect(r.logs.filter((x) => BAD_LOG.test(x))).toEqual([]);
      const errors = lint(t.example, {
        session: t.introducedBy as SessionId,
        meter: meterOf(t.example),
        key: { tonic: "C", mode: "major" },
        allowPreview: t.introducedBy.startsWith("U00"),
      }).diagnostics.filter((d) => d.severity === "error");
      expect([t.id, errors.map((d) => `${d.id} ${d.message}`)]).toEqual([t.id, []]);
    });
});

describe("milestones", () => {
  test("every session and capstone a milestone waits for exists", () => {
    const sessions = new Set<string>([...g.nodes.keys()]);
    const caps = new Set<string>(R.capstones.map((c) => c.id));
    const bad: string[] = [];
    const conds = (w: (typeof R.milestones)[number]["when"]): (typeof w)[] => [w, ...(w.anyOf ?? [])];
    for (const m of R.milestones)
      for (const w of conds(m.when)) {
        for (const s of w.sessions ?? []) if (!sessions.has(s)) bad.push(`${m.id} session ${s}`);
        for (const c of w.capstones ?? []) if (!caps.has(c)) bad.push(`${m.id} capstone ${c}`);
      }
    expect(bad).toEqual([]);
  });
});
