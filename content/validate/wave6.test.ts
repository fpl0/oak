// Wave 6 tooling: what content CI adds for the end of the core (AUTHORING §19). The registries hold U12–U17,
// C6, C7 and the two finales before their lessons are written (terms, can-dos, milestones, repertoire, the
// default order through session 185); contracts 1.6 is applied everywhere it lands (U05.L09 split out of
// U05.L04, C3 in four sessions, the nine promoted fact decks, X1's chord stages at 0.85); and the two
// course-position rules of the wave hold: chromatic degrees only from U15.L01, and a Make that opens with an
// earlier sketch names a lesson that is done by then.
import { describe, expect, test } from "bun:test";
import {
  CONTRACTS_VERSION,
  type Exercise,
  type KeySpec,
  type LessonDef,
  type LessonId,
  type SessionId,
} from "@oak/content-kit";
import { candos } from "../candos.ts";
import { capstones, TRANSCRIBE_PASS, X1_CHECKS } from "../capstones.ts";
import U05L04 from "../core/U05/L04/lesson.ts";
import U05L09 from "../core/U05/L09/lesson.ts";
import U06L10 from "../core/U06/L10/lesson.ts";
import U10L06 from "../core/U10/L06/lesson.ts";
import U11L07 from "../core/U11/L07/lesson.ts";
import U12L01 from "../core/U12/L01/lesson.ts";
import { decks, PENDING_DECKS, PROMOTED_DECKS } from "../decks/index.ts";
import { courseGraph, registries } from "../index.ts";
import { atOrBefore } from "../lib/course.ts";
import { milestones } from "../milestones.ts";
import { repertoire } from "../repertoire/index.ts";
import { skills } from "../skills.ts";
import { unitSpecs } from "../specs/index.ts";
import { LANDMARKS, SESSION_COUNTS, units } from "../syllabus.ts";
import { terms } from "../terms.ts";
import { toolboxById } from "../toolbox.ts";
import { CHROMATIC_FROM, chromaticDegreeIssues, fromSketchIssues } from "./authoring.ts";
import { unlockedFor } from "./harness.ts";

const ORDER = registries.syllabus.defaultOrder as readonly string[];
const g = courseGraph();
const at = (id: string) => ORDER.indexOf(id) + 1;
const WAVE6_UNITS = ["U12", "U13", "U14", "U15", "U16", "U17"];
const wave6Lessons = units
  .filter((u) => WAVE6_UNITS.includes(u.id))
  .flatMap((u) => u.lessons.map((l) => l.id as string));

describe("contracts 1.6", () => {
  test("the version, the session counts and the landmarks", () => {
    // 1.7 (the corrections pass) and 1.9 (unit songs) changed no count or
    // landmark held here.
    expect(CONTRACTS_VERSION).toBe("1.9");
    expect(SESSION_COUNTS).toMatchObject({
      coreLessons: 125,
      coreCapstoneSessions: 30,
      core: 185,
      total: 259,
    });
    expect(ORDER.length).toBe(185);
    expect(LANDMARKS.firstComposedSong).toEqual({ session: "C2.S2", n: 80 });
    expect(LANDMARKS.tracksOpen).toEqual({ session: "U13.CP", n: 147 });
    expect(LANDMARKS.coreComplete).toEqual({ session: "CF-A.S4", n: 185 });
    for (const { session, n } of Object.values(LANDMARKS))
      expect([session, at(session)]).toEqual([session, n]);
  });

  test("d17: U05.L09 Chord Names is split out of U05.L04 and taught directly after it; no ID changed", () => {
    const u05 = units.find((u) => u.id === "U05");
    expect(u05?.lessons.map((l) => l.id)).toEqual(
      ["U05.L01", "U05.L02", "U05.L03", "U05.L04", "U05.L09", "U05.L05", "U05.L06", "U05.L07", "U05.L08"].map(
        (x) => x as LessonId,
      ),
    );
    const l09 = u05?.lessons.find((l) => l.id === "U05.L09");
    expect([l09?.title, l09?.splitFrom, l09?.introduces]).toEqual(["Chord Names", "U05.L04", ["N05"]]);
    expect(u05?.lessons.find((l) => l.id === "U05.L04")).toMatchObject({
      title: "Arpeggios",
      introduces: [],
    });
    expect([at("U05.L04"), at("U05.L09"), at("U05.L05")]).toEqual([44, 45, 46]);
    // In every legal order: U05.L04, then U05.L09, then U05.L05; the checkpoint before the unit gates it too.
    expect(g.before("U05.L09" as SessionId).has("U05.L04" as SessionId)).toBe(true);
    expect(g.before("U05.L05" as SessionId).has("U05.L09" as SessionId)).toBe(true);
    expect(g.before("U05.L09" as SessionId).has("U04.CP" as SessionId)).toBe(true);
    // What moved with the names: the skill, the term, the can-do, the unlock, the deck.
    expect(skills.find((s) => s.id === "N05")?.introducedBy).toBe("U05.L09");
    expect(terms.find((t) => t.id === "term.chord-symbol")?.introducedBy).toBe("U05.L09");
    expect(terms.find((t) => t.id === "term.arpeggio")?.introducedBy).toBe("U05.L04");
    expect(candos.find((c) => c.id === "cd.read.chord-symbols")?.source).toBe("U05.L09");
    expect(toolboxById.get("tb.feature.chord-symbols")?.unlock.at).toBe("U05.L09");
    expect(toolboxById.get("tb.arp")?.unlock.at).toBe("U05.L04");
    expect(decks.find((d) => d.id === "deck.chd.symbols")?.unlock.lesson).toBe("U05.L09");
    // U05.L05's slash names still come after the names themselves.
    expect(unlockedFor("U05.L05" as SessionId).has("tb.feature.chord-symbols" as never)).toBe(true);
    expect(unlockedFor("U05.L04" as SessionId).has("tb.feature.chord-symbols" as never)).toBe(false);
  });
  test("d17: both lessons are authored; the arpeggio lesson kept its exercise IDs and has one idea", () => {
    expect([U05L04.title, U05L04.terms.map((t) => t.id), U05L04.canDo]).toEqual([
      "Arpeggios",
      ["term.arpeggio"],
      ["cd.code.arpeggio"],
    ]);
    const ids = (def: LessonDef) => def.steps.flatMap((s) => (s.exercise ? [s.exercise.id] : []));
    expect(ids(U05L04)).toEqual([
      "one-note-at-a-time",
      "which-order",
      "patterns-of-positions",
      "twice-as-fast",
      "broken-chords-on-the-bass",
    ]);
    expect([U05L09.title, U05L09.introduces, U05L09.terms.map((t) => t.id), U05L09.canDo]).toEqual([
      "Chord Names",
      ["N05"],
      ["term.chord-symbol"],
      ["cd.read.chord-symbols"],
    ]);
    expect(ids(U05L09)).toContain("name-the-stack");
    expect(U05L09.steps.at(-1)?.kind).toBe("make");
  });

  test("d13: C3 takes four sessions; the take, the review and the release are the fourth", () => {
    const c3 = capstones.find((c) => c.id === "C3");
    expect(c3?.sessions).toBe(4);
    expect(c3?.sessionDefs.map((s) => [s.id, s.goal, s.review ?? false, s.release ?? false])).toEqual([
      ["C3.S1", "Groove and changes for verse and chorus.", false, false],
      ["C3.S2", "Melodies and section contrast.", false, false],
      ["C3.S3", "Arrange V C V C; lead sheet.", false, false],
      ["C3.S4", "Record the full take, review, release.", true, true],
    ]);
    // Nothing a learner part-way through the old C3.S3 had is renamed: the first three session IDs and the
    // brief's rule IDs are the ones their draft and checks are stored under.
    expect(c3?.brief?.rubric.map((r) => r.id)).toEqual(
      expect.arrayContaining(["form", "contrast", "duration", "groove-lock", "leadsheet"]),
    );
    expect([at("C3.S3"), at("C3.S4"), at("GYM.06")]).toEqual([99, 100, 101]);
  });

  test("d18: X1's chord stages pass at 0.85, like its melody", () => {
    expect(TRANSCRIBE_PASS.X1).toMatchObject({ melodyPerPhrase: 0.85, chordsPerStage: 0.85 });
    expect(X1_CHECKS.flat().map((c) => [c.id, c.pass])).toEqual([
      ["phrase-1", 0.85],
      ["phrase-2", 0.85],
      ["phrase-3", 0.85],
      ["phrase-4", 0.85],
      ["chords", 0.85],
    ]);
  });

  test("d1: the nine written decks are in the catalog, one new card a day each; none is pending", () => {
    expect(PENDING_DECKS).toEqual([]);
    expect(PROMOTED_DECKS.map((d) => d.id as string).sort()).toEqual(
      [
        "deck.int.names",
        "deck.chd.triads",
        "deck.har.rn",
        "deck.har.cadence",
        "deck.scl.degrees",
        "deck.key.minor",
        "deck.har.minor",
        "deck.chd.dom7",
        "deck.frm.twelve-bar",
      ].sort(),
    );
    for (const d of PROMOTED_DECKS) {
      expect(decks).toContain(d);
      expect([d.id, d.newPerDay]).toEqual([d.id, 1]);
    }
    // Plus the six U12–U17 decks since contracts 1.7 (content/decks/wave6-decks.test.ts).
    expect(decks.length).toBe(18);
    // In course order of their unlock lessons.
    const sites = decks.map((d) => at(d.unlock.lesson));
    expect(sites).toEqual([...sites].sort((a, b) => a - b));
  });
});

describe("the registries hold U12–U17 before their lessons are written", () => {
  test("33 lessons in six units, in the default order with their checkpoints and capstones", () => {
    expect(wave6Lessons.length).toBe(33);
    for (const id of wave6Lessons) expect([id, at(id) > 0]).toEqual([id, true]);
    expect(["U13.CP", "U14.CP", "U17.CP"].map(at)).toEqual([147, 155, 177]);
    expect(["C6.S1", "C6.S2", "C7.S1", "C7.S2", "C7.S3"].map(at)).toEqual([157, 158, 178, 179, 180]);
    expect(at("U12.L01")).toBe(125);
    expect(at("U12.L01")).toBeLessThan(at("U11.CP"));
  });
  test("every lesson of U12–U17 awards at least one can-do, whose skills are introduced by then", () => {
    for (const id of wave6Lessons) {
      const own = candos.filter((c) => c.source === id);
      expect([id, own.length >= 1]).toEqual([id, true]);
      for (const c of own)
        for (const s of c.skills) {
          const intro = skills.find((x) => x.id === s)?.introducedBy as SessionId;
          expect([c.id, s, atOrBefore(g, intro, id as SessionId)]).toEqual([c.id, s, true]);
        }
    }
  });
  test("at most three new terms a lesson (a pair counts once), each with a definition and an example", () => {
    const wave6Terms = terms.filter((t) => wave6Lessons.includes(t.introducedBy));
    expect(wave6Terms.length).toBeGreaterThanOrEqual(28);
    for (const id of wave6Lessons) {
      const own = wave6Terms.filter((t) => t.introducedBy === id);
      const pairs = own.filter((t) => t.pairedWith && own.some((o) => o.id === t.pairedWith)).length / 2;
      expect([id, own.length - pairs <= 3]).toEqual([id, true]);
    }
    for (const t of wave6Terms) {
      expect([t.id, t.definition.length > 30, t.example.startsWith("setcpm(")]).toEqual([t.id, true, true]);
      if (t.pairedWith) expect(terms.find((o) => o.id === t.pairedWith)?.pairedWith).toBe(t.id);
    }
    // The guide tones are named in the core's preview (U12.L05); the jazz track builds on the term.
    expect(terms.find((t) => t.id === "term.guide-tones")?.introducedBy).toBe("U12.L05");
  });
  test("the skills of U12–U17 are each introduced by the lesson contracts §2.3 names", () => {
    const expected: Record<string, string> = {
      C07: "U12.L01",
      E11: "U12.L02",
      C08: "U12.L04",
      I04: "U12.L06",
      R10: "U13.L01",
      R09: "U13.L03",
      N08: "U13.L03",
      R11: "U13.L04",
      R12: "U13.L05",
      N09: "U13.L05",
      E14: "U13.L06",
      S12: "U14.L01",
      H11: "U14.L02",
      S13: "U14.L04",
      E12a: "U15.L01",
      H12: "U15.L02",
      H13: "U16.L01",
      E12b: "U16.L05",
      H14: "U17.L01",
      E13: "U17.L03",
    };
    for (const [id, lesson] of Object.entries(expected))
      expect([id, skills.find((s) => s.id === id)?.introducedBy]).toEqual([id, lesson]);
  });
  test("the tools of contracts §3.2 for U12–U17 unlock where the table says", () => {
    const sites: Record<string, string | string[]> = {
      "chord.seventh": "U12.L01",
      "chord.seventh-dim": "U12.L03",
      "tb.dict.lefthand": "U12.L06",
      "snd.jazzgtr": "U12.L06",
      "tb.early": "U13.L01",
      "tb.late": "U13.L01",
      "tb.velocity": "U13.L02",
      "snd.cleangtr": "U13.L02",
      "tb.meter.compound": "U13.L04",
      "tb.ply": "U13.L05",
      "scale.mixolydian": "U14.L01",
      "scale.dorian": "U14.L03",
      "scale.lydian": "U14.L04",
      "scale.phrygian": "U14.L05",
      "tb.jux": "U14.L06",
      "tb.n.chromatic": "U15.L01",
      "snd.trumpet": "U15.L05",
      "snd.tenor": "U16.L05",
      "tb.feature.transcribe.full": "CF-T.S1",
      "tb.template.dorian-funk-vamp": "C6.S2",
    };
    for (const [id, site] of Object.entries(sites))
      expect<unknown>([id, toolboxById.get(id)?.unlock.at]).toEqual([id, site]);
    expect(toolboxById.get("snd.horns")?.unlock.at).toEqual(["U15.L05", "RC1.S2"]);
    // Key changes use the patterned `.scale()` the learner has had since U03.L05 (contracts §6.8).
    expect(unlockedFor("U17.L02" as SessionId).has("tb.scale.patterned" as never)).toBe(true);
  });
  test("milestones: one per thing the learner can now do, and the end of the core needs both finales", () => {
    const when = (id: string) => milestones.find((m) => m.id === id);
    expect(when("ms.15")).toMatchObject({
      title: "You can now write with seventh chords.",
      when: { sessions: ["U12.L06"] },
    });
    expect(when("ms.16")).toMatchObject({
      title: "You can now groove with syncopation.",
      when: { sessions: ["U13.CP"] },
    });
    expect(when("ms.17")).toMatchObject({
      title: "You can now write in a mode.",
      when: { capstones: ["C6"] },
    });
    expect(when("ms.18")).toMatchObject({
      title: "You can now use chords from outside the key.",
      when: { sessions: ["U16.L05"] },
    });
    expect(when("ms.19")).toMatchObject({ title: "You can now change key.", when: { capstones: ["C7"] } });
    expect(when("ms.20")).toMatchObject({ when: { capstones: ["CF-T"] } });
    // CF-T.S4 is session 171, before U17: "either finale" would end the core fourteen sessions early.
    expect(when("ms.07")?.when).toEqual({ capstones: ["CF-A", "CF-T"] });
    expect(at("CF-T.S4")).toBeLessThan(at("U17.L01"));
  });
  test("the recorded gates of the J and R tracks, and of the lessons that wait for U14–U17", () => {
    const gate = (opens: string) =>
      registries.syllabus.trackGates.find((x) => (x.opens as string[]).includes(opens))?.gate;
    expect(gate("J1")).toEqual({ checkpoints: ["U13.CP"] });
    expect(gate("R1")).toEqual({ checkpoints: ["U13.CP"] });
    expect(gate("J2.L04")).toEqual({ checkpoints: ["U14.CP"] });
    expect(gate("J4")).toEqual({ lessonsCompleted: ["U15.L06"] });
    expect(gate("J5")).toEqual({ checkpoints: ["U17.CP"] });
  });
  test("capstones: C6 two sessions, C7 three, both finales four; no custom rule left in their rubrics", () => {
    const by = (id: string) => capstones.find((c) => c.id === id);
    expect(["C6", "C7", "CF-A", "CF-T"].map((id) => by(id)?.sessions)).toEqual([2, 3, 4, 4]);
    expect(by("C6")?.opensAfter).toEqual({ checkpoints: ["U14.CP"] });
    expect(by("C7")?.opensAfter).toEqual({ checkpoints: ["U17.CP"] });
    expect(by("CF-A")?.opensAfter).toEqual({ capstones: ["C7"] });
    expect(by("CF-T")).toMatchObject({ inGymSlots: true, kind: "transcribe" });
    for (const id of ["C6", "C7", "CF-A"])
      expect([
        id,
        by(id)
          ?.brief?.rubric.filter((r) => r.rule === "custom")
          .map((r) => r.id),
      ]).toEqual([id, []]);
    // The required lines are contracts §6.6 exactly; a brief may add `required: false` suggestions beside them.
    const required = (id: string) =>
      by(id)
        ?.brief?.rubric.filter((r) => r.required)
        .map((r) => r.rule);
    expect(required("CF-A")).toEqual(["device-count", "form", "duration-sec"]);
    expect(required("C7")).toEqual(["contains-rn", "contains-rn", "key-change", "bars"]);
    expect(required("C6")).toEqual(["mode", "bars"]);
    expect(TRANSCRIBE_PASS["CF-T"]).toMatchObject({
      formMap: 1,
      bass: 0.9,
      changesPerBar: 0.85,
      melody: 0.9,
    });
  });
  test("repertoire: the nine songs of U14–U17 and the finale are registered, the three standards at L8", () => {
    const by = (id: string) => repertoire.find((s) => s.id === `song.${id}`);
    for (const id of [
      "old-joe-clark",
      "scarborough-fair",
      "drunken-sailor",
      "sweet-georgia-brown",
      "five-foot-two",
      "aint-she-sweet",
      "bye-bye-blackbird",
      "body-and-soul",
      "georgia-on-my-mind",
    ])
      expect([id, Boolean(by(id))]).toEqual([id, true]);
    const cft = capstones.find((c) => c.id === "CF-T");
    for (const id of cft?.song ?? [])
      expect([id, repertoire.find((s) => s.id === id)?.ladder]).toEqual([id, 8]);
    expect(by("old-joe-clark")?.availableFrom).toBe("U14.L02");
    expect(by("drunken-sailor")?.availableFrom).toBe("U14.L03");
    expect(by("sweet-georgia-brown")?.availableFrom).toBe("U15.L05");
    expect(by("body-and-soul")?.availableFrom).toBe("U17.L04");
    for (const s of repertoire) if (typeof s.year === "number") expect(s.year).toBeLessThanOrEqual(1930);
  });
});

describe("the U12 spec and its exemplar", () => {
  const spec = unitSpecs.find((s) => s.unit === "U12");
  test("six lessons, each with its enjoyment, pace and return lines; U12.L01 is the content lead's", () => {
    expect(spec?.lessons.map((l) => l.id)).toEqual(
      ["U12.L01", "U12.L02", "U12.L03", "U12.L04", "U12.L05", "U12.L06"].map((x) => x as LessonId),
    );
    for (const l of spec?.lessons ?? []) {
      expect([l.id, Boolean(l.epr?.enjoyment && l.epr.pace && l.epr.return)]).toEqual([l.id, true]);
      // Every hook is a loop of seventh chords by name.
      expect([l.id, /chord\(/.test(l.hook.code) && /\^7|m7|7/.test(l.hook.code)]).toEqual([l.id, true]);
    }
    expect(spec?.lessons[0]?.author).toBe("content-lead");
    // The U06.L10 preview is called back where the unit starts.
    expect(spec?.lessons[0]?.hook.hear).toContain("Seventh Colour");
    expect(spec?.lessons[0]?.connects.back).toContain("U06.L10");
  });
  test("U12.L01 is authored, in the syllabus's words, with three graded checks and a soul loop to make", () => {
    expect([U12L01.id, U12L01.title, U12L01.introduces]).toEqual(["U12.L01", "Major 7 & Minor 7", ["C07"]]);
    expect(U12L01.steps.filter((s) => s.graded).length).toBe(3);
    expect(U12L01.terms.map((t) => t.id)).toEqual(["term.major-seventh-chord", "term.minor-seventh-chord"]);
    const make = U12L01.steps.at(-1)?.exercise;
    expect(make?.kind).toBe("code-make");
    if (make?.kind === "code-make") {
      const required = make.rubric.filter((r) => r.required);
      expect(required.map((r) => r.rule)).toEqual(["chord-qualities"]);
      expect(required[0]).toMatchObject({ contains: ["maj7", "m7"], depth: "seventh" });
    }
  });
});

describe("chromatic degrees wait for U15.L01 (chromatic.before-u15)", () => {
  const C: KeySpec = { tonic: "C", mode: "major" };
  const pad = (set: string[], key?: KeySpec) =>
    ({
      kind: "identify",
      id: "pad",
      ...(key ? { key } : {}),
      answer: { ui: "degree-pad", set, syllables: true },
    }) as unknown as Exercise;
  const sung = (degrees: string[]) =>
    ({ kind: "sing", id: "sung", target: { from: "degrees", degrees } }) as unknown as Exercise;
  test("before it, a pad and a sung target stay inside the key's own degrees", () => {
    expect(CHROMATIC_FROM).toBe("U15.L01");
    expect(chromaticDegreeIssues(pad(["1", "3", "5", "b7"]), "S5/pad", C, "U12.L02")).toEqual([
      "S5/pad: the degree pad offers b7 is outside C major; chromatic degrees and their syllables wait for U15.L01",
    ]);
    expect(chromaticDegreeIssues(sung(["1", "#4", "5"]), "S6/sung", C, "U14.L04").length).toBe(1);
    expect(chromaticDegreeIssues(pad(["1", "2", "3", "4", "5", "6", "7"]), "x", C, "U12.L02")).toEqual([]);
  });
  test("a mode's own degrees are not chromatic in that mode; the three minors are one key", () => {
    const lydian: KeySpec = { tonic: "F", mode: "lydian" };
    expect(chromaticDegreeIssues(sung(["1", "#4", "5"]), "x", lydian, "U14.L04")).toEqual([]);
    expect(
      chromaticDegreeIssues(pad(["1", "b3", "5", "b7"], { tonic: "C", mode: "blues" }), "x", C, "U11.L03"),
    ).toEqual([]);
    const melodic: KeySpec = { tonic: "A", mode: "melodic minor" };
    expect(chromaticDegreeIssues(sung(["1", "7", "b7", "b6", "5"]), "x", melodic, "U10.L08")).toEqual([]);
  });
  test("from U15.L01 on they are free", () => {
    expect(chromaticDegreeIssues(pad(["1", "#4", "5", "b7"]), "x", C, "U15.L01")).toEqual([]);
    expect(chromaticDegreeIssues(sung(["b6", "5"]), "x", C, "U16.L01")).toEqual([]);
  });
});

describe("a Make that opens with an earlier sketch (make.from-sketch, d15)", () => {
  const make = (fromSketch?: string) =>
    ({ kind: "code-make", id: "m", ...(fromSketch ? { fromSketch } : {}) }) as unknown as Exercise;
  test("the lesson named exists and is done before this one in every legal order", () => {
    expect(fromSketchIssues(make("U10.L05"), "S7/m", "U10.L06")).toEqual([]);
    expect(fromSketchIssues(make(), "S7/m", "U10.L06")).toEqual([]);
    expect(fromSketchIssues(make("U10.L07"), "S7/m", "U10.L06").length).toBe(1);
    expect(fromSketchIssues(make("U10.L06"), "S7/m", "U10.L06").length).toBe(1);
    expect(fromSketchIssues(make("U99.L01"), "S7/m", "U10.L06").length).toBe(1);
    expect(fromSketchIssues(make("U10.CP"), "S7/m", "U11.L01").length).toBe(1);
    // A side lesson is never guaranteed before a core lesson, so its sketch may not exist.
    expect(fromSketchIssues(make("A1.L01"), "S7/m", "U12.L01").length).toBe(1);
  });
  test('the three Makes that say "your loop" or "your blues" name their lesson', () => {
    const of = (def: LessonDef) => {
      const e = def.steps.at(-1)?.exercise;
      return e?.kind === "code-make" ? e.fromSketch : undefined;
    };
    expect([of(U06L10), of(U10L06), of(U11L07)]).toEqual(["U05.L01", "U10.L05", "U11.L06"]);
    expect(of(U12L01)).toBeUndefined();
  });
});
