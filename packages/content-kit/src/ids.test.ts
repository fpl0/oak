import { describe, expect, test } from "bun:test";
import {
  assertId,
  checkpointFromRouteParam,
  checkpointRouteParam,
  formatCapstoneSessionId,
  formatExerciseId,
  formatGymSessionId,
  formatLessonId,
  formatStepId,
  formatTutorThreadId,
  formatUnitId,
  ID_KINDS,
  ID_PATTERNS,
  type IdKind,
  InvalidIdError,
  idKind,
  isId,
  isSessionId,
  isSkillRef,
  isUnlockableId,
  parseCapstoneSessionId,
  parseCheckpointId,
  parseExampleId,
  parseExerciseId,
  parseFamilyId,
  parseFeedbackId,
  parseLessonId,
  parseSessionId,
  parseSkillRef,
  parseStepId,
  parseToolId,
  parseTutorThreadId,
  skillOf,
} from "./ids.ts";

// Every example of the grammar table in contracts §1.2, and strings that must not match.
const EXAMPLES: Record<IdKind, { ok: string[]; bad: string[] }> = {
  unit: { ok: ["U07", "U00", "U17", "J2", "R3", "A1"], bad: ["U7", "u07", "J6", "R4", "A3", "U007", "X1"] },
  lesson: {
    ok: ["U03.L02", "J1.L05", "A1.L04"],
    bad: ["u03.04", "u03.l02", "U03.L2", "U3.L02", "U03.L02 ", "JC1.L01"],
  },
  checkpoint: {
    ok: ["U07.CP", "J.CP1", "J.CP2", "R.CP", "A.CP"],
    bad: ["U07.CP1", "J.CP", "J.CP3", "R.CP1", "U7.CP"],
  },
  capstone: {
    ok: ["C0", "C7", "X1", "X2", "CF-A", "CF-T", "JC1", "JC4", "RC2", "AC2"],
    bad: ["CF", "C8", "X3", "JC5", "RC3", "F1", "cf-a"],
  },
  capstoneSession: { ok: ["X1.S3", "CF-A.S4", "C0.S1"], bad: ["X1.S", "X1.S10", "CF.S1", "X1/S3"] },
  gymSession: { ok: ["GYM.07", "GYM.17"], bad: ["GYM.7", "GYM.007", "gym.07"] },
  step: { ok: ["U03.L02/S5", "J1.L05/S12"], bad: ["U03.L02/S", "U03.L02/S123", "U03.L02/s5", "C2/S1"] },
  exercise: {
    ok: ["U05.L07/hand-voiced-cadence", "C2/brief", "U03.CP/key-of-g", "CF-A/single"],
    bad: ["U05.L07/Hand", "U05.L07/", "hand-voiced", "U05.L07/a_b"],
  },
  example: { ok: ["U03.L02@degrees-in-code"], bad: ["U03.L02@", "U03.L02@Degrees", "C2@x"] },
  skill: { ok: ["S02", "E12a", "E12b", "R01", "D11"], bad: ["E12c", "S2", "Z01", "s02", "S002"] },
  skillCategory: { ok: ["E05/deg.6", "R05/code.mini.sub"], bad: ["E05/", "E05/Deg", "deg.6"] },
  family: {
    ok: ["fam.deg.fet-major", "fam.mix.pitch", "fam.chd.quality-7th", "fam.rhy.groove-lock"],
    bad: ["deg.fet-major", "fam.deg", "fam.Deg.x", "fam.deg.fet_major"],
  },
  deck: { ok: ["deck.key.signature", "deck.pit.staff-names"], bad: ["deck.key", "key.signature"] },
  fact: {
    ok: ["fact.keysig.Eb-major", "fact.staff.treble.F5", "fact.keysig.F#-major"],
    bad: ["fact.", "fact.Keysig.x", "facts.keysig"],
  },
  tool: {
    ok: [
      "tb.scale",
      "tb.mini.rest",
      "tb.feature.band",
      "tb.dict.triads",
      "tb.swingBy",
      "tb.meter.2-4",
      "tb.n.chromatic",
    ],
    bad: ["tool.scale", "tb.", "tb.mini.", "tb.a b"],
  },
  sound: {
    ok: ["snd.rhodes", "snd.drum.bd", "snd.bank.RolandTR909", "snd.wave.sawtooth"],
    bad: ["snd.", "snd.a.b.c", "rhodes", "snd.drum.b-d"],
  },
  scale: {
    ok: ["scale.harmonic-minor", "scale.major"],
    bad: ["scale.Major", "scale.harmonic minor", "scale."],
  },
  chordFamily: {
    ok: ["chord.triad", "chord.dom7", "chord.seventh-dim", "chord.sixth-sus"],
    bad: ["chord.", "chord.Triad"],
  },
  schema: { ok: ["schema.axis", "schema.doo-wop", "schema.blues12"], bad: ["schema.", "schema.Axis"] },
  canDo: {
    ok: ["cd.compose.fourchord", "cd.read.count-four"],
    bad: ["cando.compose.x", "cd.compose", "cd.Compose.x"],
  },
  milestone: { ok: ["ms.03"], bad: ["ms.3", "ms.003"] },
  term: { ok: ["term.cadence", "term.half-step"], bad: ["term.", "term.Cadence", "term.a.b"] },
  song: { ok: ["song.aura-lee"], bad: ["song.", "song.Aura"] },
  flavour: {
    ok: ["flavour.pop", "flavour.indie", "flavour.jazz-soul", "flavour.funk"],
    bad: ["flavour.rock", "flavor.pop", "flavour.jazz"],
  },
  band: { ok: ["band.axis-8bar", "band.two-chord-vamp"], bad: ["band.", "band.Axis"] },
  unitSong: {
    ok: ["usong.U01", "usong.U17", "usong.J1", "usong.R3", "usong.A2"],
    bad: ["song.U01", "usong.u01", "usong.U1", "usong.J6", "usong.", "usong.U01.L01"],
  },
  feedback: {
    ok: ["rhythm.missing", "code.locked-tool", "lint.strict.this", "eval.truncated", "form.section-period"],
    bad: ["rhythm", "tb.scale", "pitch.n-without-scale", "rhythm.a.b.c", "Rhythm.missing"],
  },
};

describe("ID grammar (contracts §1.2)", () => {
  test("every kind has examples", () => {
    expect(Object.keys(EXAMPLES).sort()).toEqual([...ID_KINDS].sort());
  });

  for (const kind of ID_KINDS) {
    test(`${kind}: accepts its examples and rejects the rest`, () => {
      for (const id of EXAMPLES[kind].ok) expect([id, ID_PATTERNS[kind].test(id)]).toEqual([id, true]);
      for (const id of EXAMPLES[kind].bad) expect([id, ID_PATTERNS[kind].test(id)]).toEqual([id, false]);
    });
  }

  test("the shape decides the kind: no example matches two kinds", () => {
    for (const kind of ID_KINDS) {
      for (const id of EXAMPLES[kind].ok) {
        const matching = ID_KINDS.filter((k) => ID_PATTERNS[k].test(id));
        expect([id, matching]).toEqual([id, [kind]]);
        expect(idKind(id)).toBe(kind);
      }
    }
  });

  test("retired forms from the design docs match nothing", () => {
    for (const id of [
      "u03.04",
      "u03.l02",
      "c.pitch.degree",
      "ear.degree.major.6",
      "fn.scale",
      "tool.scale",
      "cando.x",
      "deg.fet-major",
      "CF",
      "F1",
    ]) {
      expect([id, idKind(id)]).toEqual([id, null]);
    }
    // "E12" is retired but still has the skill shape: the lock file, not the grammar, retires it.
    expect(idKind("E12")).toBe("skill");
  });
});

describe("guards and assertions", () => {
  test("isId narrows and assertId throws InvalidIdError", () => {
    expect(isId("lesson", "U03.L02")).toBe(true);
    expect(isId("lesson", 3)).toBe(false);
    expect(assertId("tool", "tb.voicing")).toBe("tb.voicing");
    expect(() => assertId("tool", "voicing")).toThrow(InvalidIdError);
  });

  test("session, unlockable and skill-ref unions", () => {
    for (const id of ["U03.L02", "U07.CP", "X1.S3", "GYM.07", "J.CP1"])
      expect([id, isSessionId(id)]).toEqual([id, true]);
    for (const id of ["X1", "U07", "C2", "U03.L02/S5"]) expect([id, isSessionId(id)]).toEqual([id, false]);
    for (const id of ["tb.scale", "snd.rhodes", "scale.major", "chord.triad"])
      expect(isUnlockableId(id)).toBe(true);
    expect(isUnlockableId("term.rest")).toBe(false);
    expect(isSkillRef("E05")).toBe(true);
    expect(isSkillRef("E05/deg.6")).toBe(true);
    expect(isSkillRef("fam.deg.fet-major")).toBe(false);
  });
});

describe("parse and format", () => {
  test("units and lessons round-trip", () => {
    expect(parseLessonId("U03.L02")).toEqual({ unit: "U03", track: "core", n: 3, lesson: "U03.L02", l: 2 });
    expect(parseLessonId("J1.L05")).toEqual({ unit: "J1", track: "J", n: 1, lesson: "J1.L05", l: 5 });
    expect(parseLessonId("u03.l02")).toBeNull();
    expect(formatLessonId("U03", 2)).toBe("U03.L02");
    expect(formatLessonId(formatUnitId("A", 1), 4)).toBe("A1.L04");
    expect(formatUnitId("core", 7)).toBe("U07");
    expect(() => formatUnitId("J", 6)).toThrow(InvalidIdError);
  });

  test("checkpoints and their route parameter (contracts §11.9)", () => {
    expect(parseCheckpointId("U07.CP")).toEqual({ checkpoint: "U07.CP", track: "core", unit: "U07" });
    expect(parseCheckpointId("J.CP1")).toEqual({ checkpoint: "J.CP1", track: "J", unit: null });
    expect(checkpointRouteParam("U07.CP")).toBe("U07");
    expect(checkpointRouteParam("J.CP1")).toBe("J.CP1");
    expect(checkpointFromRouteParam("U07")).toBe("U07.CP");
    expect(checkpointFromRouteParam("A.CP")).toBe("A.CP");
    expect(checkpointFromRouteParam("X1")).toBeNull();
  });

  test("capstone sessions, gym sessions and the session union", () => {
    expect(parseCapstoneSessionId("CF-A.S4")).toEqual({ session: "CF-A.S4", capstone: "CF-A", n: 4 });
    expect(formatCapstoneSessionId("X1", 3)).toBe("X1.S3");
    expect(formatGymSessionId(7)).toBe("GYM.07");
    expect(parseSessionId("GYM.07")).toEqual({ kind: "gym", session: "GYM.07", n: 7 });
    expect(parseSessionId("U07.CP")?.kind).toBe("checkpoint");
    expect(parseSessionId("X1.S3")?.kind).toBe("capstone");
    expect(parseSessionId("U03.L02")?.kind).toBe("lesson");
    expect(parseSessionId("X1")).toBeNull();
  });

  test("steps, exercises, examples", () => {
    expect(parseStepId("U03.L02/S5")).toEqual({ lesson: "U03.L02", step: "S5", n: 5 });
    expect(formatStepId("U03.L02", 5)).toBe("U03.L02/S5");
    expect(formatStepId("U03.L02", "S12")).toBe("U03.L02/S12");
    expect(parseExerciseId("U05.L07/hand-voiced-cadence")).toEqual({
      owner: "U05.L07",
      slug: "hand-voiced-cadence",
    });
    expect(parseExerciseId("CF-A/single")).toEqual({ owner: "CF-A", slug: "single" });
    expect(formatExerciseId("C2", "brief")).toBe("C2/brief");
    expect(() => formatExerciseId("C2", "Brief")).toThrow(InvalidIdError);
    expect(parseExampleId("U03.L02@degrees-in-code")).toEqual({ lesson: "U03.L02", slug: "degrees-in-code" });
  });

  test("skills roll categories up to their node", () => {
    expect(parseSkillRef("E05/deg.6")).toEqual({ skill: "E05", category: "deg.6" });
    expect(parseSkillRef("E12a")).toEqual({ skill: "E12a", category: null });
    expect(skillOf("R05/code.mini.sub")).toBe("R05");
    expect(() => skillOf("deg.major.6")).toThrow(InvalidIdError);
  });

  test("families, tools, feedback codes", () => {
    expect(parseFamilyId("fam.mix.pitch")).toEqual({
      family: "fam.mix.pitch",
      domain: "mix",
      name: "pitch",
      composite: true,
    });
    expect(parseFamilyId("fam.deg.fet-major")?.composite).toBe(false);
    expect(parseToolId("tb.mini.rest")).toEqual({ tool: "tb.mini.rest", group: "mini", name: "rest" });
    expect(parseToolId("tb.swingBy")).toEqual({ tool: "tb.swingBy", group: "fn", name: "swingBy" });
    expect(parseToolId("tb.n.chromatic")).toEqual({
      tool: "tb.n.chromatic",
      group: "fn",
      name: "n.chromatic",
    });
    expect(parseFeedbackId("lint.strict.this")).toEqual({
      id: "lint.strict.this",
      area: "lint",
      code: "strict.this",
    });
    expect(parseFeedbackId("tb.scale")).toBeNull();
  });

  test("tutor thread IDs match the server's conversation IDs", () => {
    const key = {
      subjectKind: "lesson",
      subjectId: "U06.L04",
      day: "2026-12-02",
      threadKind: "hint",
    } as const;
    expect(formatTutorThreadId(key)).toBe("lesson:U06.L04:2026-12-02:hint");
    expect(parseTutorThreadId("lesson:U06.L04:2026-12-02:hint")).toEqual(key);
    // A subject ID may itself contain colons.
    expect(parseTutorThreadId("sketch:a:b:2026-12-02:chat")?.subjectId).toBe("a:b");
    expect(parseTutorThreadId("lesson:U06.L04:2026-12-02:panel")).toBeNull();
    expect(parseTutorThreadId("lesson:U06.L04:tomorrow:hint")).toBeNull();
  });
});
