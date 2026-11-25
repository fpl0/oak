// Capstone rubrics of Wave 6 exactly as contracts §6.6 writes them (C6 Modal Vamp, C7 Chromatic Colour, CF-A Album
// Single), graded in capstone mode through the whole pipeline: one passing piece per shipped flavour (pop,
// jazz-soul, indie, funk: a flavour never changes a rubric, §5.10 rule 7) and the known-wrong pieces, each failing
// only the rule it breaks, with the sentence the checklist shows. CF-T Standard Transcription (form map correct,
// bass ≥ 0.90, changes ≥ 0.85 per bar, melody ≥ 0.90, then the arrangement) is in standard-ladder.test.ts.
// Music checked by hand and with `bun run theory` (G Mixolydian: ♭7 = F; D Dorian: 6 = B; in C: V7/ii = A7,
// ♭VI ♭VII I = A♭ B♭ C, a whole-step lift lands on D).
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { ExBase, ExerciseOf, GradeResult, KeySpec, RubricRule } from "@oak/content-kit";
import { CORE_DEVICES } from "@oak/content-kit";
import { headlessDeps } from "../analyze/__support__/fixtures.ts";
import type { GradeContext } from "../types.ts";
import { gradeWith } from "./index.ts";

setDefaultTimeout(120_000);
const deps = headlessDeps();
const req = (id: string, body: Record<string, unknown>): RubricRule =>
  ({ id, label: id, required: true, skills: [], ...body }) as unknown as RubricRule;
const base = <K extends string>(kind: K, id = "brief"): ExBase<K> => ({
  kind,
  id,
  version: 1,
  prompt: "",
  skills: [],
  role: "check",
  hints: null,
  tests: [],
});
const brief = (rubric: RubricRule[], o: Record<string, unknown> = {}): ExerciseOf<"compose-brief"> =>
  ({
    ...base("compose-brief"),
    brief: "",
    rubric,
    code: { starter: "" },
    saveAs: "album",
    ...o,
  }) as unknown as ExerciseOf<"compose-brief">;
const C: KeySpec = { tonic: "C", mode: "major" };
const ctx = (key: KeySpec = C, o: Partial<GradeContext> = {}): GradeContext => ({
  exerciseGlobalId: "C/brief",
  mode: "capstone",
  key,
  meter: "4/4",
  bpm: 100,
  params: {},
  attemptNo: 1,
  firstAttempt: true,
  rung: 0,
  tutorHints: 0,
  extraReplays: 0,
  lint: { profile: "graded", unlocked: new Set(), allowPreview: false, meter: "4/4", key: null },
  ...o,
});
const failing = (r: GradeResult): string[] => (r.rubric ?? []).filter((x) => !x.ok).map((x) => x.ruleId);
const detail = (r: GradeResult, id: string): string =>
  String((r.rubric ?? []).find((x) => x.ruleId === id)?.diag?.params.detail ?? "");

/** Each shipped flavour as the code a learner in it writes (contracts §5.10: sounds, chord depth, feel). */
interface Flavour {
  id: string;
  chords: string;
  bass: string;
  lead: string;
  drums: string;
  sevenths: boolean;
}
const FLAVOURS: Flavour[] = [
  {
    id: "pop",
    chords: "piano",
    bass: "sawtooth",
    lead: "piano",
    drums: 's("bd ~ sd ~, hh*8")',
    sevenths: false,
  },
  {
    id: "jazz-soul",
    chords: "rhodes",
    bass: "upright",
    lead: "vibes",
    drums: 's("bd ~ ~ bd, ~ sd ~ sd, hh*8").swingBy(1/3, 4)',
    sevenths: true,
  },
  {
    id: "indie",
    chords: "cleangtr",
    bass: "sawtooth",
    lead: "acgtr",
    drums: 's("bd ~ sd ~, hh*8").bank("LinnDrum")',
    sevenths: false,
  },
  {
    id: "funk",
    chords: "clav",
    bass: "fingerbass",
    lead: "organ",
    drums: 's("bd ~ ~ bd ~ ~ bd ~, ~ ~ sd ~ ~ ~ sd ~, hh*16")',
    sevenths: true,
  },
];

// --- C6 Modal Vamp ------------------------------------------------------------------------------------------
const C6 = brief([
  req("mode", {
    rule: "mode",
    tonic: "declared",
    mode: "mixolydian",
    anyOf: ["mixolydian", "dorian"],
    requireCharacteristic: true,
  }),
  req("bars", { rule: "bars", min: 16 }),
]);
interface Vamp {
  scale: string;
  /** Eight bars of chords for each of the two sections. */
  a: string;
  b: string;
  melA: string;
  melB: string;
  bass: string;
}
/** Mixolydian for the triad flavours (I–♭VII–IV–I), Dorian for the seventh flavours (i7–IV7). */
const vampOf = (f: Flavour): Vamp =>
  f.sevenths
    ? {
        scale: "D4:dorian",
        a: "<Dm7 G7 Dm7 G7>",
        b: "<Dm7 Dm7 G7 G7>",
        melA: "<[5 4 2 4] [5 ~ 4 2] [0 2 4 2] [5 4 2 0]>",
        melB: "<[7 ~ 5 4] [5 ~ ~ ~] [5 4 2 4] [0 ~ ~ ~]>",
        bass: "<d2 g2 d2 g2>",
      }
    : {
        scale: "G4:mixolydian",
        a: "<G F C G>",
        b: "<G G F C>",
        melA: "<[6 4 2 4] [6 ~ 4 2] [0 2 4 2] [6 4 2 0]>",
        melB: "<[7 ~ 6 4] [6 ~ ~ ~] [6 4 2 4] [0 ~ ~ ~]>",
        bass: "<g2 f2 c2 g2>",
      };
const c6Piece = (f: Flavour, o: Partial<Vamp> & { sections?: number } = {}): string => {
  const v = { ...vampOf(f), ...o };
  const parts = Array.from({ length: o.sections ?? 2 }, (_, i) => (i % 2 === 0 ? "A" : "B"));
  const arr = (role: string) => parts.map((p) => `[8, ${role}${p}]`).join(", ");
  return `setcpm(100/4)

const chordsA = chord("${v.a}").voicing()
const chordsB = chord("${v.b}").voicing()
const melA = n("${v.melA}")
const melB = n("${v.melB}")

chords: arrange(${arr("chords")}).s("${f.chords}")
mel: arrange(${arr("mel")}).scale("${v.scale}").s("${f.lead}")
bass: note("${v.bass}").s("${f.bass}")
drums: ${f.drums}`;
};
describe("C6 Modal Vamp (contracts §6.6)", () => {
  for (const f of FLAVOURS)
    test(`passes in ${f.id}`, async () => {
      const r = await gradeWith({ exercise: C6, response: { code: c6Piece(f) }, ctx: ctx() }, deps);
      expect(failing(r)).toEqual([]);
      expect(r.status).toBe("pass");
      expect(detail(r, "mode")).toBe("");
    });
  test("Mixolydian with a leading tone fails `mode` alone and says what the mode changes", async () => {
    const f = FLAVOURS[0] as Flavour;
    const r = await gradeWith(
      {
        exercise: C6,
        response: { code: c6Piece(f, { melA: "<[6# 4 2 4] [6 ~ 4 2] [0 2 4 2] [6 4 2 0]>" }) },
        ctx: ctx(),
      },
      deps,
    );
    expect(failing(r)).toEqual(["mode"]);
    expect(detail(r, "mode")).toBe("F♯ in bar 1 is degree 7; G Mixolydian has ♭7 (F) in its place");
  });
  test("Dorian with a ♭6 fails `mode` alone", async () => {
    const f = FLAVOURS[1] as Flavour;
    const r = await gradeWith(
      {
        exercise: C6,
        response: { code: c6Piece(f, { melA: "<[5b 4 2 4] [5 ~ 4 2] [0 2 4 2] [5 4 2 0]>" }) },
        ctx: ctx(),
      },
      deps,
    );
    expect(failing(r)).toEqual(["mode"]);
    expect(detail(r, "mode")).toBe("B♭ in bar 1 is degree ♭6; D Dorian has 6 (B) in its place");
  });
  test("the colour note never on a strong beat fails: the chords and the tune stay inside five notes", async () => {
    const f = FLAVOURS[0] as Flavour;
    const code = c6Piece(f, {
      a: "<G C G C>",
      b: "<G G C C>",
      melA: "<[0 2 4 2] [4 2 1 0]>",
      melB: "<[4 ~ 2 1] [0 ~ ~ ~]>",
      bass: "<g2 c2>",
    });
    const r = await gradeWith({ exercise: C6, response: { code }, ctx: ctx() }, deps);
    expect(failing(r)).toEqual(["mode"]);
    expect(detail(r, "mode")).toBe(
      "its colour note ♭7 (F) is on a strong beat 0 times; put it on beat 1 or 3 at least twice",
    );
  });
  test("the home chord in two bars of sixteen fails", async () => {
    const f = FLAVOURS[0] as Flavour;
    const r = await gradeWith(
      { exercise: C6, response: { code: c6Piece(f, { a: "<G F C F>", b: "<F C F C>" }) }, ctx: ctx() },
      deps,
    );
    expect(failing(r)).toEqual(["mode"]);
    expect(detail(r, "mode")).toBe("the G chord is in 13% of the bars; the home chord needs at least 40%");
  });
  test("eight bars fail `bars` alone", async () => {
    const r = await gradeWith(
      { exercise: C6, response: { code: c6Piece(FLAVOURS[2] as Flavour, { sections: 1 }) }, ctx: ctx() },
      deps,
    );
    expect(failing(r)).toEqual(["bars"]);
  });
  test("a vamp in plain major is told which scales the brief asks for", async () => {
    const f = FLAVOURS[0] as Flavour;
    const code = c6Piece(f, { scale: "G4:major", a: "<G C D G>", b: "<G G C D>", bass: "<g2 c2 d2 g2>" });
    const r = await gradeWith({ exercise: C6, response: { code }, ctx: ctx() }, deps);
    expect(failing(r)).toEqual(["mode"]);
    expect(
      detail(r, "mode").startsWith(
        "the scale in the code is G major; the brief asks for Mixolydian or Dorian",
      ),
    ).toBe(true);
  });
});

// --- C7 Chromatic Colour ------------------------------------------------------------------------------------
const C7 = brief(
  [
    req("secondary", {
      rule: "contains-rn",
      rn: [],
      kind: ["secondary-dominant"],
      min: 1,
      mustResolve: true,
    }),
    req("mixture", { rule: "contains-rn", rn: ["bVI", "bVII", "I"], min: 1, inOrder: true }),
    req("lift", { rule: "key-change", at: "last", semitones: [1, 2], minBarsAfter: 8, sameMelody: true }),
    req("bars", { rule: "bars", min: 32 }),
  ],
  { key: C },
);
interface Song7 {
  verse: string;
  chorus: string;
  chorus2: string;
  melVerse: string;
  melChorus: string;
  melChorus2: string;
  plan: string;
  bassPlan: string;
  order: string[];
}
const song7 = (f: Flavour): Song7 => {
  const s = f.sevenths;
  return {
    verse: s ? "<C^7 A7 Dm7 G7 C^7 Am7 F^7 G7>" : "<C A7 Dm G C Am F G>",
    chorus: s ? "<F^7 G7 C^7 Am7 F^7 G7 [Ab^7 Bb7] C^7>" : "<F G C Am F G [Ab Bb] C>",
    chorus2: s ? "<G^7 A7 D^7 Bm7 G^7 A7 [Bb^7 C7] D^7>" : "<G A D Bm G A [Bb C] D>",
    melVerse: "<[0 2 4 2] [4 2 1 ~] [1 3 5 3] [4 ~ ~ ~]>",
    melChorus: "<[7 6 4 2] [4 ~ 2 ~] [4 5 7 5] [4 ~ ~ ~] [7 6 4 2] [4 ~ 2 ~] [4 ~ 3 ~] [2 ~ ~ ~]>",
    melChorus2: "<[7 6 4 2] [4 ~ 2 ~] [4 5 7 5] [4 ~ ~ ~] [7 6 4 2] [4 ~ 2 ~] [4 ~ 3 ~] [2 ~ ~ ~]>",
    plan: "<C4:major!24 D4:major!8>",
    bassPlan: "<C2:major!24 D2:major!8>",
    order: ["Verse", "Chorus", "Verse", "Chorus2"],
  };
};
const c7Piece = (f: Flavour, o: Partial<Song7> = {}): string => {
  const s = { ...song7(f), ...o };
  const arr = (role: string) => s.order.map((p) => `[8, ${role}${p}]`).join(", ");
  return `setcpm(100/4)

const chordsVerse = chord("${s.verse}").voicing()
const chordsChorus = chord("${s.chorus}").voicing()
const chordsChorus2 = chord("${s.chorus2}").voicing()
const melVerse = n("${s.melVerse}")
const melChorus = n("${s.melChorus}")
const melChorus2 = n("${s.melChorus2}")

chords: arrange(${arr("chords")}).s("${f.chords}")
mel: arrange(${arr("mel")}).scale("${s.plan}").s("${f.lead}")
drums: ${f.drums}`;
};
describe("C7 Chromatic Colour (contracts §6.6)", () => {
  const grade = (code: string) => gradeWith({ exercise: C7, response: { code }, ctx: ctx() }, deps);
  for (const f of FLAVOURS)
    test(`passes in ${f.id}`, async () => {
      const r = await grade(c7Piece(f));
      expect(failing(r)).toEqual([]);
      expect(r.status).toBe("pass");
    });
  const pop = FLAVOURS[0] as Flavour;
  test("no secondary dominant: the diatonic vi in its place fails `secondary` alone", async () => {
    const r = await grade(c7Piece(pop, { verse: "<C Am Dm G C Am F G>" }));
    expect(failing(r)).toEqual(["secondary"]);
    expect(detail(r, "secondary").startsWith("no secondary dominant that resolves yet")).toBe(true);
  });
  test("a secondary dominant that goes elsewhere names where it points", async () => {
    const r = await grade(c7Piece(pop, { verse: "<C A7 F G C Am F G>" }));
    expect(failing(r)).toEqual(["secondary"]);
    expect(detail(r, "secondary")).toBe(
      "V7/ii (A7) in bar 2 doesn't resolve: it goes to IV (F), not to ii (Dm)",
    );
  });
  test("the lift's own dominant is not a secondary dominant: a diatonic song that lifts fails `secondary`", async () => {
    // Before Wave 6 the A of the lifted chorus was read in C as V/ii → II and passed by accident.
    const r = await grade(c7Piece(pop, { verse: "<C Am Dm G C Am F G>" }));
    expect((r.rubric ?? []).find((x) => x.ruleId === "secondary")?.ok).toBe(false);
  });
  test("♭VII before ♭VI, and ♭VI–♭VII into vi, fail `mixture` alone", async () => {
    const swapped = await grade(
      c7Piece(pop, { chorus: "<F G C Am F G [Bb Ab] C>", chorus2: "<G A D Bm G A [C Bb] D>" }),
    );
    expect(failing(swapped)).toEqual(["mixture"]);
    const deceptive = await grade(
      c7Piece(pop, { chorus: "<F G C Am F G [Ab Bb] Am>", chorus2: "<G A D Bm G A [Bb C] Bm>" }),
    );
    expect(failing(deceptive)).toEqual(["mixture"]);
    expect(detail(deceptive, "mixture")).toBe(
      "♭VI → ♭VII is there from bar 15, but then comes vi (Am), not I (C)",
    );
  });
  test("the run counts in the lifted chorus too: B♭ C D is ♭VI ♭VII I of D", async () => {
    const r = await grade(c7Piece(pop, { chorus: "<F G C Am F G F C>" }));
    expect(failing(r)).toEqual([]);
    expect(detail(r, "mixture")).toBe("");
  });
  test("a lift of a minor third, a lift of four bars, another tune and chords left behind each fail `lift`", async () => {
    const third = await grade(
      c7Piece(pop, { plan: "<C4:major!24 Eb4:major!8>", chorus2: "<Ab Bb Eb Cm Ab Bb [B Db] Eb>" }),
    );
    expect(failing(third)).toEqual(["lift"]);
    expect(detail(third, "lift")).toBe("C major → Eb major is +3; the brief asks for +1 or +2");
    const tune = await grade(
      c7Piece(pop, {
        melChorus2: "<[0 1 2 3] [4 ~ 2 ~] [4 5 7 5] [4 ~ ~ ~] [7 6 4 2] [4 ~ 2 ~] [4 ~ 3 ~] [2 ~ ~ ~]>",
      }),
    );
    expect(failing(tune)).toEqual(["lift"]);
    expect(detail(tune, "lift")).toBe("the melody of chorus2 isn't the chorus melody moved to the new key");
    const behind = await grade(c7Piece(pop, { chorus2: song7(pop).chorus }));
    expect(failing(behind)).toEqual(["lift"]);
    expect(detail(behind, "lift")).toBe(
      "the tune of chorus2 is in D major, but its chords are still the C major ones: bar 25 is F; lifted, it is G",
    );
    const none = await grade(c7Piece(pop, { plan: "C4:major", chorus2: song7(pop).chorus }));
    expect(failing(none)).toEqual(["lift"]);
  });
  test("twenty-four bars fail `bars` (and the lift is no longer the last chorus)", async () => {
    const r = await grade(
      c7Piece(pop, { order: ["Verse", "Chorus", "Chorus2"], plan: "<C4:major!16 D4:major!8>" }),
    );
    expect(failing(r)).toEqual(["bars"]);
  });
});

// --- CF-A Album Single --------------------------------------------------------------------------------------
const CFA = brief(
  [
    req("devices", { rule: "device-count", devices: [...CORE_DEVICES], min: 4 }),
    req("bridge", { rule: "form", pattern: "*", contains: ["bridge"] }),
    req("duration", { rule: "duration-sec", min: 120 }),
  ],
  { key: C, minDurationSec: 120 },
);
interface Single {
  verse: string;
  chorus: string;
  bridge: string;
  chorus2: string;
  bassStruct: string;
  melVerse: string;
  plan: string;
  bassPlan: string;
  order: [number, string][];
}
const single = (f: Flavour): Single => {
  const s = f.sevenths;
  return {
    verse: s ? "<C^7 Am7 F^7 G7>" : "<C Am F G>",
    // V7/vi → vi in the chorus.
    chorus: s ? "<F^7 G7 E7 Am7 F^7 G7 C^7 C^7>" : "<F G E7 Am F G C C>",
    // The minor iv, then ♭VI–♭VII.
    bridge: s ? "<Fm7 Fm7 C^7 C^7 Ab^7 Bb7 G7 G7>" : "<Fm Fm C C Ab Bb G G>",
    chorus2: s ? "<G^7 A7 F#7 Bm7 G^7 A7 D^7 D^7>" : "<G A F#7 Bm G A D D>",
    // The bass lands between the beats.
    bassStruct: "x ~ ~ x ~ x ~ ~",
    // A 4–3 suspension at the verse's cadence: C held over G, then B.
    melVerse: "<[4 ~ 4 2] [0 ~ ~ ~] [3 4 5 7] [7@2 6@2]>",
    plan: "<C4:major!48 D4:major!8>",
    bassPlan: "<C2:major!48 D2:major!8>",
    order: [
      [8, "Verse"],
      [8, "Chorus"],
      [8, "Verse"],
      [8, "Chorus"],
      [8, "Bridge"],
      [8, "Chorus"],
      [8, "Chorus2"],
    ],
  };
};
const cfaPiece = (f: Flavour, o: Partial<Single> = {}): string => {
  const s = { ...single(f), ...o };
  const arr = (role: string, map: (name: string) => string = (x) => x) =>
    s.order.map(([bars, p]) => `[${bars}, ${role}${map(p)}]`).join(", ");
  return `setcpm(100/4)

const chordsVerse = chord("${s.verse}").voicing()
const chordsChorus = chord("${s.chorus}").voicing()
const chordsBridge = chord("${s.bridge}").voicing()
const chordsChorus2 = chord("${s.chorus2}").voicing()
const bassVerse = n("<0 5 3 4>").struct("${s.bassStruct}")
const bassChorus = n("<3 4 2 5 3 4 0 0>").struct("${s.bassStruct}")
const bassBridge = n("<3 3 0 0 5b 6b 4 4>").struct("x ~ x ~")
const bassChorus2 = n("<3 4 2 5 3 4 0 0>").struct("${s.bassStruct}")
const melVerse = n("${s.melVerse}")
const melChorus = n("<[7 ~ 7 5] [8 ~ 8 ~] [9 8 6 4#] [5 ~ ~ ~] [7 ~ 7 5] [8 ~ 8 9] [7 ~ ~ ~] ~>")
const melBridge = n("<[5b ~ 4 3] [5b ~ 4 ~] [4 ~ 2 0] ~ [7 ~ 5b 4] [8 ~ 6b 3] [8 ~ ~ ~] [6 ~ ~ ~]>")
const melChorus2 = n("<[7 ~ 7 5] [8 ~ 8 ~] [9 8 6 4#] [5 ~ ~ ~] [7 ~ 7 5] [8 ~ 8 9] [7 ~ ~ ~] ~>")

drums: ${f.drums}
chords: arrange(${arr("chords")}).s("${f.chords}")
bass: arrange(${arr("bass")}).scale("${s.bassPlan}").s("${f.bass}")
mel: arrange(${arr("mel")}).scale("${s.plan}").s("${f.lead}")`;
};
describe("CF-A Album Single (contracts §6.6)", () => {
  const grade = (code: string) => gradeWith({ exercise: CFA, response: { code }, ctx: ctx() }, deps);
  for (const f of FLAVOURS)
    test(`passes in ${f.id}: 56 bars, 134.4 s, a bridge, five devices each named with its bar`, async () => {
      const r = await grade(cfaPiece(f));
      expect(failing(r)).toEqual([]);
      expect(r.status).toBe("pass");
      expect(r.analysis?.durationSec).toBe(134.4);
      const devices = new Map(
        (r.analysis?.deviceList ?? []).map((d) => [d.device, d.bar] as const).reverse(),
      );
      expect(Object.fromEntries(devices)).toEqual({
        "syncopated bass": 1,
        suspension: 4,
        "secondary dominant": 11,
        "borrowed chord": 33,
        modulation: 49,
      });
    });
  const pop = FLAVOURS[0] as Flavour;
  test("one event is one device: ♭VII beside ♭VI is borrowed, and the lift's A is not a secondary dominant", async () => {
    const r = await grade(cfaPiece(pop));
    const list = r.analysis?.deviceList ?? [];
    expect(list.filter((d) => d.device === "modal colour")).toEqual([]);
    expect(list.filter((d) => d.device === "borrowed chord").map((d) => d.bar)).toEqual([33, 37, 38]);
    // E7 → Am in each chorus, F♯7 → Bm in the lifted one (V7/vi of D); nothing at bar 50 (A is D's own V).
    expect(list.filter((d) => d.device === "secondary dominant").map((d) => d.bar)).toEqual([11, 27, 43, 51]);
    expect(list.find((d) => d.device === "modulation")).toMatchObject({ bar: 49, bars: 8 });
  });
  test("without its devices the same plan fails `devices` alone and lists what is still open", async () => {
    const plain = cfaPiece(pop, {
      chorus: "<F G Em Am F G C C>",
      bridge: "<Dm Dm C C F G G G>",
      chorus2: "<F G Em Am F G C C>",
      bassStruct: "x ~ x ~",
      melVerse: "<[4 ~ 4 2] [0 ~ ~ ~] [3 4 5 7] [6 ~ ~ ~]>",
      plan: "C4:major",
      bassPlan: "C2:major",
    })
      .replace("<3 3 0 0 5b 6b 4 4>", "<1 1 0 0 3 4 4 4>")
      .replaceAll("[9 8 6 4#]", "[9 8 6 4]")
      .replace(
        "<[5b ~ 4 3] [5b ~ 4 ~] [4 ~ 2 0] ~ [7 ~ 5b 4] [8 ~ 6b 3]",
        "<[5 ~ 4 3] [5 ~ 4 ~] [4 ~ 2 0] ~ [7 ~ 5 3] [8 ~ 6 4]",
      );
    const r = await grade(plain);
    expect(failing(r)).toEqual(["devices"]);
    expect(detail(r, "devices")).toBe(
      "0 of the 4 asked for; still open: secondary dominant, borrowed chord, modulation, suspension, syncopated bass, modal colour",
    );
  });
  test("three devices: the count and the bars are shown, and what is still open", async () => {
    const r = await grade(
      cfaPiece(pop, {
        chorus2: single(pop).chorus,
        plan: "C4:major",
        bassPlan: "C2:major",
        bassStruct: "x ~ x ~",
      }),
    );
    expect(failing(r)).toEqual(["devices"]);
    expect(detail(r, "devices")).toBe(
      "3 of the 4 asked for: secondary dominant (bar 11), borrowed chord (bar 33), suspension (bar 4); still open: modulation, syncopated bass, modal colour",
    );
  });
  test("no bridge fails `bridge` (and its borrowed chords go with it)", async () => {
    const order = single(pop).order.map(([bars, p]): [number, string] => [
      bars,
      p === "Bridge" ? "Verse" : p,
    ]);
    const r = await grade(cfaPiece(pop, { order }));
    expect(failing(r)).toContain("bridge");
    expect(
      detail(r, "bridge").startsWith(
        "the form is verse chorus verse chorus verse chorus chorus2: there is no bridge yet",
      ),
    ).toBe(true);
  });
  test("48 bars at 100 BPM are 115.2 s: `duration` fails", async () => {
    const order = single(pop).order.filter((_, i) => i !== 2);
    const r = await grade(
      cfaPiece(pop, { order, plan: "<C4:major!40 D4:major!8>", bassPlan: "<C2:major!40 D2:major!8>" }),
    );
    expect(failing(r)).toEqual(["duration", "min-duration"]);
    expect(detail(r, "duration")).toBe("115.2 s long; at least 120 s");
  });
  test("a minor-key single earns `borrowed chord` with the Dorian IV and a Picardy ending", async () => {
    const A_MINOR: KeySpec = { tonic: "A", mode: "minor" };
    const code = `setcpm(100/4)
chords: chord("<Am D Am E Am D E A>").voicing().s("piano")
mel: n("<[0 2 4 2] [4 2 1 ~]>").scale("A4:minor").s("piano")`;
    const r = await gradeWith(
      {
        exercise: brief([req("devices", { rule: "device-count", devices: [...CORE_DEVICES], min: 1 })], {
          key: A_MINOR,
        }),
        response: { code },
        ctx: ctx(A_MINOR),
      },
      deps,
    );
    expect(detail(r, "devices")).toBe("");
    expect([...new Set((r.analysis?.deviceList ?? []).map((d) => d.device))]).toEqual(["borrowed chord"]);
    expect((r.analysis?.deviceList ?? []).slice(0, 3).map((d) => d.text)).toEqual([
      "IV borrowed bar 2",
      "IV borrowed bar 6",
      "I borrowed bar 8",
    ]);
    // A final major chord is no key change.
    expect(r.analysis?.devices.join(" ")).not.toContain("modulation");
  });
});

// --- the shipped briefs -------------------------------------------------------------------------------------
// The rubrics above are contracts §6.6 as written; content/capstones.ts must carry the same rules (labels and
// skills aside), so a checklist line and these tests can never disagree. CF-T's marks are the ladder's L8 marks.
describe("content/capstones.ts carries exactly these required rules", () => {
  const body = (r: RubricRule): Record<string, unknown> => {
    const { label: _l, skills: _s, ...rest } = r as unknown as Record<string, unknown>;
    return rest;
  };
  for (const [id, ours] of [
    ["C6", C6],
    ["C7", C7],
    ["CF-A", CFA],
  ] as const)
    test(id, async () => {
      const { capstoneById } = await import("../../../../content/capstones.ts");
      const shipped = capstoneById.get(id)?.brief;
      expect(shipped).toBeTruthy();
      // The REQUIRED rules are contracts §6.6 exactly; a brief may add `required: false` suggestions beside them
      // (the finale spec's groove-lock, contrast, motif-reuse, chord-tones-strong and range), which never gate.
      const required = (rs: readonly RubricRule[]) => rs.filter((r) => r.required).map(body);
      // Oak 2.0 W4 F1 adds one required line to CF-A after these: it ends on purpose (U09.L06's endings).
      const w4 = (rs: readonly RubricRule[]) => rs.filter((r) => r.id === "ending");
      expect(required((shipped?.rubric ?? []).filter((r) => r.id !== "ending"))).toEqual(
        required(ours.rubric),
      );
      expect(required(w4(shipped?.rubric ?? []))).toEqual(
        id === "CF-A" ? [{ id: "ending", required: true, rule: "custom", fn: "ends-on-purpose" }] : [],
      );
      expect(ours.rubric.every((r) => r.required)).toBe(true);
    });
  test("CF-T: form map 1, bass 0.90, changes 0.85 per bar, melody 0.90", async () => {
    const { TRANSCRIBE_PASS } = await import("../../../../content/capstones.ts");
    const { STANDARD_LADDER_PASS } = await import("./standard-ladder.ts");
    const t = TRANSCRIBE_PASS["CF-T"];
    const shipped: Record<string, number> = {
      form: t.formMap,
      bass: t.bass,
      changes: t.changesPerBar,
      melody: t.melody,
    };
    expect(shipped).toEqual({ ...STANDARD_LADDER_PASS });
  });
});
