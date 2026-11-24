// Unit songs (spec 2026-11-24 §5.1): the `UnitSongDef` schema, its cross-field rules and the `usong.<UNIT>` IDs.
import { describe, expect, test } from "bun:test";
import { ZodError } from "zod";
import { idKind, isId } from "./ids.ts";
import { defineUnitSong, FLAVOUR_IDS, type UnitSongDef, unitSongSchema } from "./index.ts";

const CODE = [
  'const kickIntro = s("bd ~ ~ ~")',
  'const kickVerse = s("bd ~ bd ~")',
  'const bassVerse = n("<0 3>")',
  "",
  "kick: arrange([4, kickIntro], [8, kickVerse])",
  'bass: arrange([4, silence], [8, bassVerse]).scale("C2:major").s("ebass").lpf(800)',
].join("\n");
const ALL_CODE = Object.fromEntries(FLAVOUR_IDS.map((f) => [f, CODE])) as UnitSongDef["code"];

/** One 4/4 song: two sections (4 + 8 bars), two parts, every flavour, one take step and one side step. */
const minimal = (): UnitSongDef => ({
  id: "usong.U01",
  unit: "U01",
  version: 1,
  title: "The groove song",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 100,
  sections: [
    { id: "intro", type: "intro", bars: 4 },
    { id: "verse", type: "verse", bars: 8 },
  ],
  parts: [
    { id: "kick", label: "kick", role: "drums", sounds: ["bd"], name: "Kick", plainName: "Kick" },
    { id: "bass", label: "bass", role: "bass", name: "Bass", plainName: "Bass" },
  ],
  code: ALL_CODE,
  plan: [
    {
      lesson: "U01.L01",
      kind: "take",
      sections: ["verse"],
      parts: ["kick"],
      startFrom: "oak",
      today: "Your drum line plays the second part of the song.",
    },
    { lesson: "U01.L02", kind: "side", reason: "This lesson stays a sketch of its own." },
  ],
  releaseAfter: "U01.CP",
});

/** The issues of a rejected song, as `path: message`, or [] when it is accepted. */
function issuesOf(def: unknown): { path: string; message: string }[] {
  const r = unitSongSchema.safeParse(def);
  return r.success ? [] : r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}
const paths = (def: unknown): string[] => issuesOf(def).map((i) => i.path);

describe("UnitSongDef (spec §5.1)", () => {
  test("accepts a minimal valid song", () => {
    expect(issuesOf(minimal())).toEqual([]);
    const song = defineUnitSong(minimal());
    expect(song.id).toBe("usong.U01");
    expect(Object.isFrozen(song)).toBe(true);
    expect(Object.isFrozen(song.plan[0])).toBe(true);
  });

  test("rejects a missing flavour", () => {
    const { "flavour.indie": _, ...three } = ALL_CODE;
    const def = { ...minimal(), code: three as UnitSongDef["code"] };
    expect(paths(def).some((p) => p === "code" || p.startsWith("code."))).toBe(true);
    let thrown: unknown = null;
    try {
      defineUnitSong(def);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ZodError);
    expect((thrown as ZodError).issues[0]?.path[0]).toBe("code");
  });

  test("rejects duplicate section or part ids", () => {
    const def = minimal();
    const twoVerses = {
      ...def,
      sections: [...def.sections, { id: "verse", type: "verse", bars: 4 }],
    };
    expect(paths(twoVerses)).toContain("sections.2.id");
    const twoKicks = {
      ...def,
      parts: [
        ...def.parts,
        { id: "kick", label: "snare", role: "drums", sounds: ["sd"], name: "S", plainName: "S" },
      ],
    };
    expect(paths(twoKicks)).toContain("parts.2.id");
    expect(() => defineUnitSong(twoKicks as UnitSongDef)).toThrow(ZodError);
  });

  test("rejects a take step naming an unknown section or part, including in oakKeeps", () => {
    const def = minimal();
    const take = def.plan[0] as Extract<UnitSongDef["plan"][number], { kind: "take" }>;
    const unknownSection = { ...def, plan: [{ ...take, sections: ["chorus"] }, def.plan[1]] };
    expect(paths(unknownSection)).toEqual(["plan.0.sections.0"]);
    const unknownPart = { ...def, plan: [{ ...take, parts: ["snare"] }, def.plan[1]] };
    expect(paths(unknownPart)).toEqual(["plan.0.parts.0"]);
    const unknownKeep = { ...def, plan: [{ ...take, oakKeeps: ["lead"] }, def.plan[1]] };
    expect(paths(unknownKeep)).toEqual(["plan.0.oakKeeps.0"]);
    // `all` names every section.
    expect(paths({ ...def, plan: [{ ...take, sections: "all" }, def.plan[1]] })).toEqual([]);
  });

  test("rejects sounds on a pitched part and a drum part without sounds", () => {
    const def = minimal();
    const [kick, bass] = def.parts as [UnitSongDef["parts"][number], UnitSongDef["parts"][number]];
    const soundsOnBass = { ...def, parts: [kick, { ...bass, sounds: ["bd"] }] };
    expect(paths(soundsOnBass)).toEqual(["parts.1.sounds"]);
    const { sounds: _, ...kickWithout } = kick;
    expect(paths({ ...def, parts: [kickWithout, bass] })).toEqual(["parts.0.sounds"]);
    expect(paths({ ...def, parts: [{ ...kick, sounds: [] }, bass] })).toEqual(["parts.0.sounds"]);
  });

  test("rejects a total over 64 bars", () => {
    const def = minimal();
    const long = {
      ...def,
      sections: [
        { id: "intro", type: "intro", bars: 32 },
        { id: "verse", type: "verse", bars: 36 },
      ],
      code: Object.fromEntries(
        FLAVOUR_IDS.map((f) => [f, CODE.replaceAll("[4, ", "[32, ").replaceAll("[8, ", "[36, ")]),
      ),
    };
    expect(paths(long)).toEqual(["sections"]);
    expect(issuesOf(long)[0]?.message).toContain("64");
  });

  test("ids: usong.U01 and usong.J1 are valid, song.U01 and usong.u01 are not", () => {
    for (const id of ["usong.U01", "usong.J1", "usong.A2", "usong.R3"]) {
      expect([id, isId("unitSong", id)]).toEqual([id, true]);
      expect(idKind(id)).toBe("unitSong");
    }
    for (const id of ["song.U01", "usong.u01", "usong.U1", "usong.J6", "usong.", "usong.U01.L01"])
      expect([id, isId("unitSong", id)]).toEqual([id, false]);
    expect(idKind("song.U01")).not.toBe("unitSong");
    // The id names its unit.
    expect(paths({ ...minimal(), id: "usong.U02" })).toEqual(["id"]);
  });
});

describe("UnitSongDef: the rest of the structural rules", () => {
  test("a code that misses a part's track, or plays a track that is no part, is rejected", () => {
    const def = minimal();
    const noBass = Object.fromEntries(FLAVOUR_IDS.map((f) => [f, CODE.split("\n").slice(0, -1).join("\n")]));
    expect(paths({ ...def, code: noBass })).toEqual(FLAVOUR_IDS.map((f) => `code.${f}`));
    const extra = { ...ALL_CODE, "flavour.pop": `${CODE}\nhats: s("hh*8")` };
    expect(paths({ ...def, code: extra })).toEqual(["code.flavour.pop"]);
  });

  test("Oak's code has no tempo line and arranges every track in the song's sections", () => {
    const def = minimal();
    const tempo = { ...ALL_CODE, "flavour.funk": `setcpm(100/4)\n\n${CODE}` };
    expect(paths({ ...def, code: tempo })).toEqual(["code.flavour.funk"]);
    const wrongBars = { ...ALL_CODE, "flavour.jazz-soul": CODE.replace("[8, kickVerse]", "[4, kickVerse]") };
    expect(paths({ ...def, code: wrongBars })).toEqual(["code.flavour.jazz-soul"]);
    const wrongName = { ...ALL_CODE, "flavour.jazz-soul": CODE.replace("[4, kickIntro]", "[4, kickVerse]") };
    expect(paths({ ...def, code: wrongName })).toEqual(["code.flavour.jazz-soul"]);
    const plain = { ...ALL_CODE, "flavour.pop": CODE.replace(/kick: arrange\(.*\)/, 'kick: s("bd*4")') };
    expect(paths({ ...def, code: plain })).toEqual(["code.flavour.pop"]);
  });

  test("sections are whole fours, or a one-bar stop", () => {
    const def = minimal();
    const odd = {
      ...def,
      sections: [def.sections[0], { id: "verse", type: "verse", bars: 6 }],
      code: Object.fromEntries(FLAVOUR_IDS.map((f) => [f, CODE.replaceAll("[8, ", "[6, ")])),
    };
    expect(paths(odd)).toEqual(["sections.1.bars"]);
    const stop = {
      ...def,
      sections: [...def.sections, { id: "stop", type: "break", bars: 1 }],
      code: Object.fromEntries(
        FLAVOUR_IDS.map((f) => [
          f,
          CODE.replace("[8, kickVerse])", "[8, kickVerse], [1, silence])").replace(
            "[8, bassVerse])",
            "[8, bassVerse], [1, silence])",
          ),
        ]),
      ),
    };
    expect(paths(stop)).toEqual([]);
  });

  test("plan rules: one entry per lesson of the unit, startFrom an earlier take, oakKeeps pitched", () => {
    const def = minimal();
    const take = def.plan[0] as Extract<UnitSongDef["plan"][number], { kind: "take" }>;
    expect(paths({ ...def, plan: [take, { ...take, today: "Again." }] })).toEqual(["plan.1.lesson"]);
    expect(paths({ ...def, plan: [{ ...take, lesson: "U02.L01" }] })).toEqual(["plan.0.lesson"]);
    expect(paths({ ...def, plan: [{ ...take, startFrom: "U01.L02" }, def.plan[1]] })).toEqual([
      "plan.0.startFrom",
    ]);
    const second = { ...take, lesson: "U01.L03" as const, startFrom: "U01.L01" as const };
    expect(paths({ ...def, plan: [take, def.plan[1], second] })).toEqual([]);
    expect(paths({ ...def, plan: [take, def.plan[1], { ...second, startFrom: "U01.L02" }] })).toEqual([
      "plan.2.startFrom",
    ]);
    expect(paths({ ...def, plan: [{ ...take, oakKeeps: ["kick"] }, def.plan[1]] })).toEqual([
      "plan.0.oakKeeps.0",
    ]);
    const wordy =
      "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone";
    expect(paths({ ...def, plan: [{ ...take, today: wordy }, def.plan[1]] })).toEqual(["plan.0.today"]);
  });

  test("a drum sound belongs to one part only, and labels follow STYLE §2", () => {
    const def = minimal();
    const [kick, bass] = def.parts as [UnitSongDef["parts"][number], UnitSongDef["parts"][number]];
    const snare = {
      id: "snare",
      label: "snare",
      role: "drums" as const,
      sounds: ["bd", "sd"],
      name: "Snare",
      plainName: "Snare",
    };
    const code = Object.fromEntries(
      FLAVOUR_IDS.map((f) => [f, `${CODE}\nsnare: arrange([4, silence], [8, snareVerse])`]),
    );
    expect(paths({ ...def, parts: [kick, bass, snare], code })).toEqual(["parts.2.sounds.0"]);
    expect(paths({ ...def, parts: [kick, { ...bass, label: "Bass" }] })).toContain("parts.1.label");
    expect(paths({ ...def, parts: [kick, { ...bass, role: "drums", sounds: ["sd"] }] })).toEqual([
      "parts.1.role",
    ]);
  });
});
