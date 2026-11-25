// Musical truth of U12–U17, U13.CP, U14.CP, U17.CP, C6, C7 and CF-A, listened to with instruments: every
// example, starter, reference solution, stimulus, audio card and passing test is played headlessly and checked
// the way a player would hear it. Bass lines sit in a bass's register and seventh chords in a keyboard's
// middle; a guide-tone thread sits on top of the chords it threads; a ghost note is quiet and still there; a
// tune never sits a minor 2nd or 9th above its own chords for a beat unless that rub is the point (listed
// with its reason); a tune never holds the key's own note against the chromatic note a chord just brought
// (the cross-relation that hides an applied or borrowed chord's colour); a key plan never leaves the tune in
// one key and its chords in another; the Band never plays harmony under a lesson of this wave, so it cannot
// break a mode; and every sung target fits in one comfortable span. Written in the Wave 6 content
// integration.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { type Exercise, flattenExercise } from "@oak/content-kit";
import { evalHeadless } from "@oak/grader/testing";
import { exerciseCode } from "../../scripts/content/generate.ts";
import { capstones } from "../capstones.ts";
import { CHECKPOINT_MAKE_BANDS } from "../checkpoints.ts";
import { loadCheckpointFiles, loadLessons } from "../lib/load.bun.ts";

setDefaultTimeout(600_000);

const W6 = /^U1[2-7]\./;
const W6_CP = /^U1[347]\.CP$/;
const W6_CAPSTONES = /^(C6|C7|CF-A)$/;

interface Code {
  /** "U15.L03 S5/play-from-the-page solution:0" */
  where: string;
  code: string;
  bars: number;
  /** A starter is wrong on purpose (the learner fixes it); everything else is music Oak plays as right. */
  starter: boolean;
  /** The key the step is in: the exercise's, else the lesson's (C major for a capstone brief). */
  key: { tonic: string; mode: string };
  /** A whole song (a capstone brief's piece): played to its end rather than capped at 24 bars. */
  whole?: boolean;
}

/** Every piece of code an exercise plays as right, its starters marked: failing tests are left out. */
function codesOf(owner: string, e: Exercise, step: string, key: Code["key"]): Code[] {
  const out: Code[] = [];
  for (const x of flattenExercise(e)) {
    const k = ("key" in x && x.key ? x.key : key) as Code["key"];
    const failing = new Set(x.tests.filter((t) => t.expect === "fail").map((t) => `test:${t.name}`));
    const at = `${owner} ${step}/${x.id}`;
    for (const c of exerciseCode(x))
      if (!failing.has(c.what))
        out.push({
          where: `${at} ${c.what}`,
          code: c.code,
          bars: Math.max(c.bars, 1),
          starter: c.what === "starter",
          key: k,
        });
    if ("answer" in x && x.answer && "options" in x.answer)
      for (const o of (x.answer.options ?? []) as { id: string; audio?: string }[])
        if (o.audio)
          out.push({ where: `${at} card:${o.id}`, code: o.audio, bars: 4, starter: false, key: k });
    if ("rubric" in x)
      for (const r of x.rubric)
        if ("reference" in r && r.reference)
          for (const s of r.reference.solutions)
            out.push({
              where: `${at} rubric:${r.id}`,
              code: s,
              bars: r.reference.bars,
              starter: false,
              key: k,
            });
  }
  return out;
}

const { lessons } = await loadLessons();
const w6 = lessons
  .filter((l) => !l.sample && W6.test(l.def.id))
  .sort((a, b) => a.def.id.localeCompare(b.def.id));
const { defs: checkpoints } = await loadCheckpointFiles();
const C_MAJOR = { tonic: "C", mode: "major" };
const ALL: Code[] = [];
for (const l of w6)
  for (const s of l.def.steps) {
    const key = l.def.key as Code["key"];
    if (s.example)
      ALL.push({
        where: `${l.def.id} ${s.id} example`,
        code: s.example.code,
        bars: s.example.bars ?? 4,
        starter: false,
        key,
      });
    if (s.exercise) ALL.push(...codesOf(l.def.id, s.exercise, s.id, key));
  }
for (const d of checkpoints.filter((x) => W6_CP.test(x.id))) {
  for (const e of d.authored) ALL.push(...codesOf(d.id, e, "item", C_MAJOR));
  if (d.make) ALL.push(...codesOf(d.id, d.make, "make", C_MAJOR));
}
// A brief's pieces are whole songs (C7 is forty bars, CF-A fifty-six): each is played to its end, not the
// one bar a brief declares, so a rub in a last chorus or a bridge is heard too (Wave 6 teaching review).
const PIECE_BARS = 64;
for (const c of capstones.filter((x) => W6_CAPSTONES.test(x.id)))
  if (c.brief)
    ALL.push(
      ...codesOf(c.id, c.brief, "brief", C_MAJOR).map((x) => ({ ...x, bars: PIECE_BARS, whole: true })),
    );

const frac = (s: string) => {
  const [a, b] = s.split("/");
  return Number(a) / (b ? Number(b) : 1);
};
const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"];
const name = (m: number) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
const mod12 = (x: number) => ((x % 12) + 12) % 12;
const NAT: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const tonicPc = (t: string) =>
  mod12((NAT[t[0] as string] ?? 0) + (t.includes("#") ? 1 : t.includes("b") ? -1 : 0));
const MODE_STEPS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  blues: [0, 3, 5, 6, 7, 10],
};
const keyPcs = (k: Code["key"]) =>
  new Set((MODE_STEPS[k.mode] ?? []).map((s) => mod12(tonicPc(k.tonic) + s)));

/** Each code played once, for all the scans below. */
const played = await Promise.all(
  // `.scope()` draws in Oak's panel and plays nothing (contracts §3.1 rule 9); headless Strudel has no panel.
  ALL.map(async (c) => ({
    c,
    r: await evalHeadless(c.code.replaceAll(".scope()", ""), c.whole ? c.bars : Math.min(c.bars, 24)).catch(
      () => null,
    ),
  })),
);
const TUNE = /^(mel|gtr|vox|lead|riff|tune|horns?|sax|trumpet)/;
const HARM = /^(chords|pad|keys|organ|rhodes)/;

describe("the code plays", () => {
  test("every example, starter, reference, card and passing test of Wave 6 evaluates", () => {
    expect(played.filter((p) => !p.r).map((p) => p.c.where)).toEqual([]);
    expect(ALL.length).toBeGreaterThan(600);
  });
});

describe("register", () => {
  test("every bass note Oak plays sits in a bass's register, B0 to A3", () => {
    const out: string[] = [];
    for (const { c, r } of played)
      for (const e of r?.events ?? [])
        if (/^bass/.test(e.track) && e.midi != null && (e.midi < 23 || e.midi > 57))
          out.push(`${c.where}: ${name(e.midi)} at ${e.begin}`);
    expect(out).toEqual([]);
  });
  test("seventh chords and their voicings sit in a keyboard's middle, E2 to C6, never wider than two octaves", () => {
    const out = new Set<string>();
    for (const { c, r } of played) {
      const chords = (r?.events ?? []).filter((e) => HARM.test(e.track) && e.midi != null);
      for (const e of chords)
        if ((e.midi as number) < 40 || (e.midi as number) > 84)
          out.add(`${c.where}: ${name(e.midi as number)}`);
      const byOnset = new Map<string, number[]>();
      for (const e of chords)
        byOnset.set(`${e.track}@${e.begin}`, [
          ...(byOnset.get(`${e.track}@${e.begin}`) ?? []),
          e.midi as number,
        ]);
      for (const [at, ms] of byOnset)
        if (Math.max(...ms) - Math.min(...ms) > 24)
          out.add(`${c.where}: a chord at ${at} spans ${Math.max(...ms) - Math.min(...ms)}`);
    }
    expect([...out]).toEqual([]);
  });
});

/**
 * Rubs that are the music's point, each with its reason. A tune note a minor 2nd or 9th above a note of its own
 * chords, held for a beat or more, is otherwise the harshest sound a passing listener hears.
 */
/** A rub in one of CF-A's passing pieces, by test name and the two notes. */
const cfa = (test: string, rub: string) => `CF-A brief/brief test:${test}: ${rub}`;
const ALLOWED_RUBS: Record<string, string> = {
  "U13.L03 S1": "Ode to Joy's own passing F (e f g) over the C chord, as in U02.L08",
  "U14.L02 S6/old-joe-clark stimulus":
    "Old Joe Clark's own fa, passing from sol down to mi over the strummed A",
  "U14.L04 S1": "the hook's major half: B♭ weighs on A over F, the heaviness the Lydian half lifts off",
  "U15.L01 S1/bend-the-tune item:0":
    "the plain tune first: fa as a lower neighbour of sol over C, the note the bend to fi replaces",
  // A whole piece is one code: the key names the rub itself, so nothing else in the song is waved through.
  [cfa(
    "pop, five devices: E7 to Am in the chorus, Fm and A♭–B♭ in the bridge, the lift, a 4–3, a pushed bass",
    "C5 over B4",
  )]: "the verse's cadence is the 4–3 suspension the brief counts as a device: C held over G, then down to B",
  [cfa("pop, all six: the same single with a Mixolydian verse, I–♭VII–IV–V", "C5 over B4")]:
    "the same single: its verse cadence holds C over G before it falls to B, the 4–3 suspension",
  [cfa(
    "jazz-soul, exactly four: sevenths at 76, the borrowed B♭m7, a chain of dominants, a pushed upright, a 4–3",
    "F5 over E4",
  )]: "the verse's cadence holds F over C7 and falls to E, the 4–3 suspension the brief counts as a device",
  // Oak 2.0 W4: the pop single's two other endings keep its verse, and with it the same cadence.
  [cfa(
    "ends on one last hit: a new last bar, every part on beat 1 with a crash, then silence",
    "C5 over B4",
  )]:
    "the pop single ending on one hit: its verse cadence holds C over G before it falls to B, the 4–3 suspension",
  [cfa(
    "ends with a fade: the outro loops IV–I while every part falls to a tenth of its level",
    "C5 over B4",
  )]:
    "the pop single ending in a fade: its verse cadence holds C over G before it falls to B, the 4–3 suspension",
};

describe("tunes over their own chords", () => {
  test("no tune sits a minor 2nd or 9th above its chords for a beat, except the rubs listed with a reason", () => {
    const out = new Set<string>();
    for (const { c, r } of played) {
      if (!r || c.starter) continue;
      const beats = 4;
      const ev = r.events.filter((e) => e.midi != null);
      const harm = ev.filter((e) => HARM.test(e.track));
      for (const m of ev.filter((e) => TUNE.test(e.track))) {
        const b = frac(m.begin);
        if ((frac(m.end) - b) * beats < 1 - 1e-9) continue;
        // A tune note its own chord is sounding adds no rub the chord does not already hold: the root of a
        // major seventh chord over its 7th, a minor 7th's 3rd over a voiced 9th (Wave 6 teaching review).
        const sounding = harm.filter((h) => frac(h.begin) <= b + 1e-9 && frac(h.end) > b + 1e-9);
        if (sounding.some((h) => mod12(h.midi as number) === mod12(m.midi as number))) continue;
        for (const h of harm) {
          const d = (m.midi as number) - (h.midi as number);
          if (frac(h.begin) <= b + 1e-9 && frac(h.end) > b + 1e-9 && (d === 1 || d === 13))
            out.add(`${c.where}: ${name(m.midi as number)} over ${name(h.midi as number)} at ${m.begin}`);
        }
      }
    }
    const allowed = (f: string) => Object.keys(ALLOWED_RUBS).find((k) => f.startsWith(k));
    expect([...out].filter((f) => !allowed(f))).toEqual([]);
    expect(Object.keys(ALLOWED_RUBS).filter((k) => ![...out].some((f) => f.startsWith(k)))).toEqual([]);
  });
});

/**
 * An applied or borrowed chord is heard by the note it changes (F♯ in D7 over C, A♭ in Fm over C). A tune that
 * holds the key's own note a half step from it, for a beat while the chord sounds, cancels the colour: the
 * cross-relation the lessons' tips warn about ("give the tune the visitor's note and the rub becomes a lean").
 * Read in the key the step is in; a code with a key plan is read bar by bar in the key in force. Listed with a
 * reason where the clash is the music's point.
 */
const ALLOWED_CROSS: Record<string, string> = {
  "U15.L01 S1":
    "te has fallen to la over C7: la is the chord's 13th, a major 7th above its B♭, the turn's soul colour",
  "U15.L01 S3": "the same hook, read on the roll",
  "U15.L01 S4/fi-and-te": "the same fall, te to la over C7, written by the learner",
  "U16.L05 S2/three-ds code":
    "the predict plays the tune's three Ds over all three borrowed chords, so the two that clash are heard",
};

/** The key in force at each bar of a `.scale("<C4:major!6 G3:major!2>")` plan, or null without one. */
function keyPlanOf(code: string): ((bar: number) => Code["key"]) | null {
  const m = /\.scale\("<([^>"]+)>"\)/.exec(code);
  if (!m) return null;
  const segs: Code["key"][] = [];
  for (const part of (m[1] as string).trim().split(/\s+/)) {
    const pm = /^([A-G][#b]?)-?\d*:([a-z:]+?)(?:!(\d+))?$/.exec(part);
    if (!pm) return null;
    const mode = (pm[2] as string).replace("harmonic:minor", "minor").replace(":", "");
    for (let i = 0; i < Number(pm[3] ?? 1); i++) segs.push({ tonic: pm[1] as string, mode });
  }
  return (bar) => segs[bar % segs.length] as Code["key"];
}

describe("applied and borrowed chords are heard", () => {
  test("no tune holds the key's own note against a chord's chromatic note, except the cases listed", () => {
    const out = new Set<string>();
    for (const { c, r } of played) {
      if (!r || c.starter || c.where.includes(" test:")) continue;
      if (c.key.mode === "blues" || /:blues|pentatonic/.test(c.code)) continue;
      const plan = keyPlanOf(c.code);
      const ev = r.events.filter((e) => e.midi != null);
      const harm = ev.filter((e) => HARM.test(e.track));
      for (const m of ev.filter((e) => TUNE.test(e.track))) {
        const b = frac(m.begin);
        if ((frac(m.end) - b) * 4 < 1 - 1e-9) continue;
        const key = keyPcs(plan ? plan(Math.floor(b + 1e-9)) : c.key);
        const tune = mod12(m.midi as number);
        if (!key.has(tune)) continue;
        for (const h of harm) {
          if (!(frac(h.begin) <= b + 1e-9 && frac(h.end) > b + 1e-9)) continue;
          const pc = mod12(h.midi as number);
          if (!key.has(pc) && (mod12(pc - tune) === 1 || mod12(tune - pc) === 1))
            out.add(`${c.where}: ${name(m.midi as number)} against ${name(h.midi as number)} at ${m.begin}`);
        }
      }
    }
    const allowed = (f: string) => Object.keys(ALLOWED_CROSS).find((k) => f.startsWith(k));
    expect([...out].filter((f) => !allowed(f))).toEqual([]);
    expect(Object.keys(ALLOWED_CROSS).filter((k) => ![...out].some((f) => f.startsWith(k)))).toEqual([]);
  });
});

describe("rhythm II", () => {
  test("a ghost note is quiet and still there: between .15 and .45 of a full hit", () => {
    const out = new Set<string>();
    let seen = 0;
    for (const { c, r } of played) {
      if (!r || !/\.velocity\(/.test(c.code)) continue;
      for (const e of r.events) {
        const v = (e.value as { velocity?: number } | undefined)?.velocity;
        if (e.s !== "sd" || v == null) continue;
        seen++;
        if (v < 0.9 && (v < 0.15 || v > 0.45)) out.add(`${c.where}: a snare at ${v} (${e.begin})`);
      }
    }
    expect([...out]).toEqual([]);
    expect(seen).toBeGreaterThan(100);
  });
});

describe("guide tones (U12.L05)", () => {
  test("the thread sits on top of the chords it threads, so the ear can follow it", () => {
    const out: string[] = [];
    for (const { c, r } of played) {
      if (!r || !c.where.startsWith("U12.L05") || c.starter) continue;
      const mel = r.events.filter((e) => e.track === "mel" && e.midi != null);
      const chords = r.events.filter((e) => e.track === "chords" && e.midi != null);
      for (const m of mel) {
        const under = chords.filter(
          (h) => frac(h.begin) <= frac(m.begin) + 1e-9 && frac(h.end) > frac(m.begin) + 1e-9,
        );
        const top = Math.max(...under.map((h) => h.midi as number));
        if (under.length && (m.midi as number) < top)
          out.push(`${c.where}: ${name(m.midi as number)} under ${name(top)}`);
      }
    }
    expect(out).toEqual([]);
  });
});

describe("the Band (contracts §5.10)", () => {
  test("every Band of this wave's lessons and checkpoints plays drums only, so no mode or key plan is broken", () => {
    const out: string[] = [];
    for (const l of w6)
      for (const s of l.def.steps)
        if (s.ui.band && JSON.stringify(s.ui.band.tracks) !== '["drums"]')
          out.push(`${l.def.id} ${s.id}: ${s.ui.band.band} ${JSON.stringify(s.ui.band.tracks)}`);
    for (const id of ["U13.CP", "U14.CP", "U17.CP"] as const) {
      const b = CHECKPOINT_MAKE_BANDS[id];
      if (b && JSON.stringify(b.tracks) !== '["drums"]')
        out.push(`${id}: ${b.band} ${JSON.stringify(b.tracks)}`);
    }
    expect(out).toEqual([]);
  });
});

/** Semitones above do of a do-based degree, chromatic degrees included (U15.L01 on). */
const SEMIS: Record<string, number> = {
  "1": 0,
  "#1": 1,
  b2: 1,
  "2": 2,
  "#2": 3,
  b3: 3,
  "3": 4,
  "4": 5,
  "#4": 6,
  b5: 6,
  "5": 7,
  "#5": 8,
  b6: 8,
  "6": 9,
  b7: 10,
  "7": 11,
};

describe("singing (contracts §8)", () => {
  test("every sung target of Wave 6 fits in an octave", async () => {
    const out: string[] = [];
    for (const l of w6)
      for (const s of l.def.steps)
        for (const x of s.exercise ? flattenExercise(s.exercise) : []) {
          if (x.kind !== "sing") continue;
          let span: number;
          if (x.target.from === "degrees") {
            const t = x.target;
            const semis = t.degrees.map((d, i) => (SEMIS[d] ?? Number.NaN) + 12 * (t.octaves?.[i] ?? 0));
            span = Math.max(...semis) - Math.min(...semis);
          } else {
            if (x.stimulus.src !== "code") continue;
            const track = x.target.track;
            const r = await evalHeadless(x.stimulus.code, x.stimulus.bars);
            const m = r.events
              .filter((e) => e.track === track && e.midi != null)
              .map((e) => e.midi as number);
            span = Math.max(...m) - Math.min(...m);
          }
          if (!(span <= 12)) out.push(`${l.def.id} ${s.id}/${x.id}: spans ${span} half steps`);
        }
    expect(out).toEqual([]);
  });
});

describe("modes (U14, C6)", () => {
  test("music written on one mode keeps it: no chord, bass or tune note breaks the mode's colour", () => {
    const out = new Set<string>();
    let modal = 0;
    for (const { c, r } of played) {
      if (!r || c.starter) continue;
      const scales = [...c.code.matchAll(/\.scale\("([A-G][#b]?)-?\d*:([a-z]+)"\)/g)];
      const modes = new Set(scales.map((m) => `${m[1]}:${m[2]}`));
      if (modes.size !== 1 || /\.scale\("</.test(c.code)) continue;
      const [tonic, mode] = ([...modes][0] ?? ":").split(":") as [string, string];
      if (!["mixolydian", "dorian", "lydian", "phrygian"].includes(mode)) continue;
      modal++;
      const pcs = keyPcs({ tonic, mode });
      for (const e of r.events)
        if (e.midi != null && !pcs.has(mod12(e.midi)))
          out.add(`${c.where}: ${name(e.midi)} on ${e.track} is not in ${tonic} ${mode}`);
    }
    expect([...out]).toEqual([]);
    expect(modal).toBeGreaterThan(50);
  });
});
