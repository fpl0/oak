// Content validation of the unit songs (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §8): every
// registered song and every step of its plan passes the checks `content:check` runs as section 15, and each check
// names the problem it was built for, by its issue code, on a fixture that has exactly that problem.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { FlavourId, LessonDef, LessonId, TakeoverStep, TakeStep, UnitSongDef } from "@oak/content-kit";
import { unitSongById, unitSongs } from "../unit-songs/index.ts";
import { checkPlanCoverage, checkSong, checkSongStep, loadLessonDef, type SongIssue } from "./unit-songs.ts";

setDefaultTimeout(120_000);

const errorsOf = (issues: readonly SongIssue[]) =>
  issues.filter((i) => i.severity === "error").map((i) => `${i.code} ${i.where}: ${i.message}`);
const codesOf = (issues: readonly SongIssue[]) => [
  ...new Set(issues.filter((i) => i.severity === "error").map((i) => i.code)),
];

const U01 = unitSongById.get("usong.U01") as UnitSongDef;
const U02 = unitSongById.get("usong.U02") as UnitSongDef;
const lesson = async (id: string): Promise<LessonDef> => {
  const def = await loadLessonDef(id as LessonId);
  if (!def) throw new Error(`no lesson ${id}`);
  return def;
};
const stepOf = (song: UnitSongDef, id: string): TakeoverStep => {
  const step = song.plan.find((s) => s.lesson === id);
  if (!step) throw new Error(`${id} is not in ${song.id}`);
  return step;
};
const takeOf = (song: UnitSongDef, id: string): TakeStep => {
  const step = stepOf(song, id);
  if (step.kind !== "take") throw new Error(`${id} is not a take step`);
  return step;
};
/** The song with one flavour's code (or every flavour's) passed through `edit`. */
const withCode = (
  song: UnitSongDef,
  edit: (code: string, flavour: FlavourId) => string,
  only?: FlavourId,
): UnitSongDef => ({
  ...song,
  code: Object.fromEntries(
    Object.entries(song.code).map(([f, code]) => [
      f,
      only === undefined || f === only ? edit(code, f as FlavourId) : code,
    ]),
  ) as Record<FlavourId, string>,
});
/** Replaces one exact piece of a code, failing loudly when the fixture no longer finds it. */
const swap = (from: string, to: string) => (code: string) => {
  if (!code.includes(from)) throw new Error(`fixture: "${from}" is not in the song's code`);
  return code.replaceAll(from, to);
};

describe("every registered song", () => {
  for (const song of unitSongs) {
    test(`${song.id} passes checkSong and checkPlanCoverage`, async () => {
      expect(errorsOf(await checkSong(song))).toEqual([]);
      expect(errorsOf(checkPlanCoverage(song))).toEqual([]);
    });
    test(`every step of ${song.id} passes checkSongStep`, async () => {
      for (const step of song.plan)
        expect([step.lesson, errorsOf(await checkSongStep(song, step, await lesson(step.lesson)))]).toEqual([
          step.lesson,
          [],
        ]);
    });
  }
});

describe("checkSong names what is wrong", () => {
  test("a silent flavour", async () => {
    const silent = (code: string) =>
      code.replace(
        /arrange\((.*)\)/g,
        (_all, entries: string) => `arrange(${entries.replace(/\[(\d+), [A-Za-z]\w*\]/g, "[$1, silence]")})`,
      );
    expect(codesOf(await checkSong(withCode(U02, silent, "flavour.funk")))).toContain("usong.silent");
  });

  test("a flavour whose lead plays another pitch", async () => {
    const fixture = withCode(
      U02,
      swap(
        'const melVerse = note("<[c4 ~ e4 g4 ~ a4 g4 ~]',
        'const melVerse = note("<[c4 ~ e4 g4 ~ a4 c5 ~]',
      ),
      "flavour.indie",
    );
    expect(codesOf(await checkSong(fixture))).toContain("usong.flavour-notes");
  });

  test("a held lead note a half step above a chord tone", async () => {
    // F4 held for the whole bar over C E G (the quiet part's first bar): a half step above E.
    const fixture = withCode(U02, swap('note("<[c5 a4 g4 ~] ~', 'note("<[f4@4] ~'));
    const issues = await checkSong(fixture);
    expect(codesOf(issues)).toContain("usong.clash");
    expect(codesOf(issues)).not.toContain("usong.flavour-notes");
  });

  test("the registered songs carry no clash, so the fixture above is the only cause", async () => {
    expect(codesOf(await checkSong(U02))).not.toContain("usong.clash");
  });

  test("a flavour whose bass lands on another root, or whose chords change root", async () => {
    const bass = withCode(
      U02,
      swap('const bassVerse = note("<[c2', 'const bassVerse = note("<[d2'),
      "flavour.funk",
    );
    expect(codesOf(await checkSong(bass))).toContain("usong.flavour-roots");
    const chords = withCode(
      U02,
      swap(
        'const chordsVerse = note("<[c3,e3,g3] [c3,f3,a3]>")',
        'const chordsVerse = note("<[c3,e3,g3] [d3,f3,a3]>")',
      ),
      "flavour.pop",
    );
    expect(codesOf(await checkSong(chords))).toContain("usong.flavour-chords");
  });

  test("a flavour whose every track is turned down to nothing is silent", async () => {
    const muted = withCode(U02, (code) => code.replace(/^(\w+): (.*)$/gm, "$1: $2.gain(0)"), "flavour.funk");
    expect(codesOf(await checkSong(muted))).toContain("usong.silent");
    // One part at no volume sounds in none of its sections.
    const quietKick = withCode(
      U02,
      (code) => code.replace(/^(kick: .*)$/m, "$1.postgain(0)"),
      "flavour.funk",
    );
    const issues = await checkSong(quietKick);
    expect(codesOf(issues)).toContain("usong.sections");
    expect(errorsOf(issues).join("\n")).toContain('"kick:"');
  });

  test("a flavour whose chords change quality on the same roots", async () => {
    // C major to C minor: the same root, another function. A seventh or a sixth on the same triad is a colour.
    const minor = withCode(
      U02,
      swap(
        'const chordsVerse = note("<[c3,e3,g3] [c3,f3,a3]>")',
        'const chordsVerse = note("<[c3,eb3,g3] [c3,f3,a3]>")',
      ),
      "flavour.pop",
    );
    expect(codesOf(await checkSong(minor))).toContain("usong.flavour-chords");
    const seventh = withCode(
      U02,
      swap(
        'const chordsVerse = note("<[c3,e3,g3] [c3,f3,a3]>")',
        'const chordsVerse = note("<[c3,e3,g3,b3] [c3,f3,a3]>")',
      ),
      "flavour.pop",
    );
    expect(codesOf(await checkSong(seventh))).not.toContain("usong.flavour-chords");
  });

  test("a flavour with a track that is not a part", async () => {
    const extra = withCode(U02, (code) => `${code}\nfx: s("~ ~ ~ cp")`, "flavour.indie");
    expect(codesOf(await checkSong(extra))).toContain("usong.tracks");
  });
});

describe("checkSongStep names what is wrong", () => {
  test("a take in another key", async () => {
    const def = await lesson("U02.L02");
    const inG = { ...def, key: { tonic: "G", mode: "major" } } as LessonDef;
    expect(codesOf(await checkSongStep(U02, stepOf(U02, "U02.L02"), inG))).toContain("usong.key");
  });

  test("an arranged take is held to the keys of the sections it fills, not the others", async () => {
    const base = await lesson("U02.L02");
    const make = base.steps.at(-1)?.exercise;
    if (make?.kind !== "code-make") throw new Error("fixture: U02.L02 has no code Make");
    // The reference arranges a verse only: it fills the song's verses and leaves the bridge to its owner.
    const verseOnly =
      'setcpm(96/4)\n\nconst melVerse = note("c4 e4 g4 a4").s("piano")\nmel: arrange([8, melVerse])';
    const tests = make.tests.map((t) =>
      t.expect === "pass" && "code" in t.response ? { ...t, response: { code: verseOnly } } : t,
    );
    const arranged = {
      ...base,
      steps: [...base.steps.slice(0, -1), { ...base.steps.at(-1), exercise: { ...make, tests } }],
    } as LessonDef;
    const step = { ...takeOf(U02, "U02.L02"), sections: "all" as const };
    const inKey = (id: string) =>
      ({
        ...U02,
        sections: U02.sections.map((s) => (s.id === id ? { ...s, key: { tonic: "A", mode: "minor" } } : s)),
      }) as UnitSongDef;
    expect(codesOf(await checkSongStep(inKey("bridge"), step, arranged))).not.toContain("usong.key");
    expect(codesOf(await checkSongStep(inKey("verse2"), step, arranged))).toContain("usong.key");
  });

  test("a startFrom code that already meets today's required rule", async () => {
    const step = takeOf(U02, "U02.L03");
    expect(step.startFrom).toBe("U02.L02");
    const before = await lesson("U02.L02");
    const make = before.steps.at(-1)?.exercise;
    if (make?.kind !== "code-make") throw new Error("fixture: U02.L02 has no code Make");
    // The earlier take's passing code already lands on a black key, today's required rule.
    const passes = 'setcpm(96/4)\n\nmel: note("c4 e4 g4 bb4").s("piano")';
    const tests = make.tests.map((t) =>
      t.expect === "pass" && "code" in t.response ? { ...t, response: { code: passes } } : t,
    );
    const earlier = {
      ...before,
      steps: [...before.steps.slice(0, -1), { ...before.steps.at(-1), exercise: { ...make, tests } }],
    } as LessonDef;
    const issues = await checkSongStep(U02, step, await lesson("U02.L03"), {
      lessonOf: async (id) => (id === "U02.L02" ? earlier : loadLessonDef(id)),
    });
    expect(codesOf(issues)).toContain("usong.start-passes");
  });

  test("parts missing a part the reference code plays", async () => {
    // U01.L01's passing code plays bd and sd: the kick and the snare.
    const step = { ...takeOf(U01, "U01.L01"), parts: ["kick"] };
    const issues = await checkSongStep(U01, step, await lesson("U01.L01"));
    expect(codesOf(issues)).toContain("usong.parts");
    expect(errorsOf(issues).join("\n")).toContain("snare");
  });

  test("a today line with a term the learner has not met", async () => {
    // Backbeat is U01.L03's term; the line is read before U01.L01.
    const step = { ...takeOf(U01, "U01.L01"), today: "Your backbeat plays the second part of the song." };
    expect(codesOf(await checkSongStep(U01, step, await lesson("U01.L01")))).toContain("usong.terms");
  });

  test("a today line with the lesson's own term, read before the lesson teaches it", async () => {
    const step = { ...takeOf(U01, "U01.L03"), today: "Your backbeat takes over the second part." };
    expect(codesOf(await checkSongStep(U01, step, await lesson("U01.L03")))).toContain("usong.terms");
  });

  test("a take in another meter", async () => {
    const step: TakeStep = {
      lesson: "U01.L08",
      kind: "take",
      sections: ["verse"],
      parts: ["kick", "snare"],
      startFrom: "oak",
      today: "Your beat plays the second part of the song.",
    };
    expect(codesOf(await checkSongStep(U01, step, await lesson("U01.L08")))).toContain("usong.meter");
  });

  test("startFrom naming a take that does not come earlier", async () => {
    const step = { ...takeOf(U02, "U02.L02"), startFrom: "U02.L03" as LessonId };
    expect(codesOf(await checkSongStep(U02, step, await lesson("U02.L02")))).toContain("usong.start-from");
  });

  test("a take that plays chords clashes with the Oak tune it keeps, and claims it otherwise", async () => {
    // Held C#, F and G# against Oak's verse riff (C E G A G): C# is a half step above C, G# above G.
    const base = await lesson("U02.L02");
    const make = base.steps.at(-1)?.exercise;
    if (make?.kind !== "code-make") throw new Error("fixture: U02.L02 has no code Make");
    const chords = 'setcpm(96/4)\n\nchords: note("[c#4,f4,g#4]").s("piano")';
    const tests = make.tests.map((t) =>
      t.expect === "pass" && "code" in t.response ? { ...t, response: { code: chords } } : t,
    );
    const withChords = {
      ...base,
      steps: [...base.steps.slice(0, -1), { ...base.steps.at(-1), exercise: { ...make, tests } }],
    } as LessonDef;
    const keeps = { ...takeOf(U02, "U02.L02"), parts: ["chords"], oakKeeps: ["lead"] };
    expect(codesOf(await checkSongStep(U02, keeps, withChords))).toContain("usong.clash");
    // Without oakKeeps the chords take every Oak pitched part in the verse: nothing of Oak's is left to clash with.
    const takesAll = { ...takeOf(U02, "U02.L02"), parts: ["chords"] };
    const issues = await checkSongStep(U02, takesAll, withChords);
    expect(issues.filter((i) => i.code === "usong.clash")).toEqual([]);
  });

  test("a side step's reason is held to the same words", async () => {
    const side = { lesson: "U01.L08", kind: "side", reason: "Awesome! This one is a waltz." } as TakeoverStep;
    expect(codesOf(await checkSongStep(U01, side, await lesson("U01.L08")))).toContain("usong.voice");
  });
});

describe("checkPlanCoverage names what is wrong", () => {
  test("a lesson missing from the plan, or out of syllabus order", () => {
    const missing = { ...U02, plan: U02.plan.filter((s) => s.lesson !== "U02.L04") };
    expect(codesOf(checkPlanCoverage(missing))).toContain("usong.plan");
    const [a, b, ...rest] = U02.plan;
    const swapped = { ...U02, plan: [b, a, ...rest] as TakeoverStep[] };
    expect(codesOf(checkPlanCoverage(swapped))).toContain("usong.plan");
  });

  test("releaseAfter that does not exist or comes before the last take", () => {
    expect(codesOf(checkPlanCoverage({ ...U02, releaseAfter: "U02.L05" }))).toContain("usong.release");
    expect(codesOf(checkPlanCoverage({ ...U02, releaseAfter: "U02.L99" as LessonId }))).toContain(
      "usong.release",
    );
  });
});
