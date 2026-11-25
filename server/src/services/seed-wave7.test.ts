// The Wave 7 seed material is real course code (docs/design/wave7.md §6): every stand-in Make of a track unit lints
// clean with the toolbox-aware lint under the unlocks of the earliest legal route to the first session that uses it
// (the core up to the track's gate, then the track's own sessions), evaluates headlessly with no unknown chord, and
// says what its unit is about; every track capstone draft lints clean at its own session; AC1's two versions keep the
// tune; JC4's reharmonization keeps the melody and adds its three devices. Every musical claim of seed-wave7.ts is
// checked here by running it.
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { ToolEntry, UnlockableId } from "@oak/content-kit";
import { lintOak } from "@oak/grader";
import { evalHeadless, midisOf } from "@oak/grader/testing";
import { loadContent } from "../content/loader.ts";
import type { ContentSource } from "../content/types.ts";
import { CONTENT_DIR } from "../testing/course.ts";
import { testGeorgia } from "../testing/wave7.ts";
import { pickStandIn, STAND_INS } from "./seed-wave5.ts";
import { WAVE6_STAND_INS } from "./seed-wave6.ts";
import {
  ac1Versions,
  J1_SHELLS,
  J2_MINOR,
  J5_TRITONE,
  JC1_BALLAD,
  jc4Reharm,
  R2_THREE_TWO,
  R3_CLAVE,
  RC2_POLY,
  WAVE7_CAPSTONE_DRAFTS,
  WAVE7_STAND_INS,
  WAVE7_WALKS,
} from "./seed-wave7.ts";
import { TRACK_ORDER } from "./track-plan.ts";

setDefaultTimeout(120_000);

let content: ContentSource;
beforeAll(async () => {
  content = await loadContent({ contentDir: CONTENT_DIR });
});

/** The core item whose completion opens each track session at the earliest (contracts §4.3). */
function coreGate(session: string): string {
  if (/^J2\.L04|^J\.CP2|^J[45]|^JC[234]/.test(session))
    return /^J4|^JC2/.test(session) ? "U15.L06" : "U17.CP";
  if (/^J|^R/.test(session)) return "U13.CP";
  if (/^A1\.L0[1-4]/.test(session)) return "U03.L02";
  if (/^A1/.test(session)) return "U09.CP";
  if (/^AC1/.test(session)) return "U15.L05"; // its written tune, Sweet Georgia Brown, needs U15.L05
  if (/^AC2/.test(session)) return "U13.CP"; // J3.L04 and R1.L05 need U13.CP
  if (/^A/.test(session)) return "U10.CP"; // A2 and A.CP
  return "CF-A.S4";
}
/** Sessions done on the earliest legal route to `session` (its own included): core prefix, then track prefixes. */
function routeTo(session: string): Set<string> {
  const order = content.syllabus.defaultOrder as readonly string[];
  const gate = coreGate(session);
  const sites = new Set<string>(order.slice(0, order.indexOf(gate) + 1));
  const prefix = (t: "J" | "R" | "A", upTo: string) => {
    const o = TRACK_ORDER[t];
    for (const id of o.slice(0, o.indexOf(upTo) + 1))
      if (!/\.CP|^[JRA]C\d\./.test(id) || id === session) sites.add(id);
  };
  const t = session[0] as "J" | "R" | "A";
  prefix(t, session);
  if (session.startsWith("AC2")) {
    prefix("J", "J3.L04");
    prefix("R", "R1.L05");
  }
  // A track capstone needs its checkpoint passed: the checkpoint and the earlier sessions of the capstone.
  for (const id of TRACK_ORDER[t].slice(0, TRACK_ORDER[t].indexOf(session)))
    if (/\.CP\d?$/.test(id) || id.startsWith(session.replace(/\.S\d+$/, ""))) sites.add(id);
  return sites;
}
function unlockedAt(session: string): Set<string> {
  const sites = routeTo(session);
  const out = new Set<string>();
  for (const t of content.toolbox as readonly ToolEntry[]) {
    const at = ([] as string[]).concat(t.unlock.at as string | string[]);
    const fb = (t.unlock as { fallbackAt?: string }).fallbackAt;
    if (at.some((a) => sites.has(a)) || (fb !== undefined && sites.has(fb))) out.add(t.id);
  }
  // Sounds granted when a capstone session starts (horns at RC1.S2, choir at AC2.S1).
  if (session === "RC1.S2") out.add("snd.horns");
  return out;
}
const lintErrors = (code: string, unlocked: Set<string>) =>
  lintOak(
    code,
    {
      profile: "graded",
      unlocked: unlocked as Set<UnlockableId>,
      allowPreview: false,
      meter: "4/4",
      key: null,
    },
    content.toolbox,
  )
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => `${d.id}: ${d.message}`);

/** The first session each stand-in is used in. */
const FIRST: Record<string, string> = {
  shells: "J1.L02",
  "minor-two-five": "J2.L02",
  walk: "J3.L02",
  turnaround: "J4.L01",
  tritone: "J5.L02",
  pocket: "R1.L02",
  "three-two": "R2.L01",
  clave: "R3.L02",
  grit: "A1.L05",
  registers: "A2.L02",
};

const pcs = (midis: (number | null)[]) => midis.map((m) => (m === null ? -1 : ((m % 12) + 12) % 12));
/** Intervals above `root` (a pitch class) of a chord's notes. */
const above = (root: number, notes: number[]) =>
  [...new Set(notes.map((n) => (n - root + 12) % 12))].sort((a, b) => a - b);

describe("stand-in Makes of the track units (seed-wave7.ts)", () => {
  for (const c of WAVE7_STAND_INS)
    test(`${c.id} lints clean at ${FIRST[c.id]} (earliest route), evaluates, and the seeder picks it there`, async () => {
      const session = FIRST[c.id] as string;
      const unlocked = unlockedAt(session);
      expect(lintErrors(c.code, unlocked)).toEqual([]);
      const r = await evalHeadless(c.code, 4);
      expect(r.events.length).toBeGreaterThan(8);
      expect(r.logs.filter((l) => /unknown chord/.test(l))).toEqual([]);
      const unit = /^([A-Z]\d)\./.exec(session)?.[1] as string;
      expect(
        pickStandIn(unit, unlocked, content.toolbox, [...STAND_INS, ...WAVE6_STAND_INS, ...WAVE7_STAND_INS])
          ?.id,
      ).toBe(c.id);
    });

  test("the shells are the 3rd and 7th of each chord: ii–V–I in C and the minor ii–V–i in D minor", async () => {
    const chords = async (code: string) => {
      const r = await evalHeadless(code, 4);
      const bars: number[][] = [[], [], [], []];
      for (const e of r.events)
        if (e.track === "chords" && e.midi !== null) bars[Math.floor(e.onset)]?.push(e.midi);
      return bars;
    };
    const j1 = await chords(J1_SHELLS);
    // Dm7 (D=2): m3 and m7; G7 (G=7): M3 and m7; Cmaj7 (C=0): M3 and M7.
    expect([above(2, j1[0] ?? []), above(7, j1[1] ?? []), above(0, j1[2] ?? [])]).toEqual([
      [3, 10],
      [4, 10],
      [4, 11],
    ]);
    const j2 = await chords(J2_MINOR);
    // Em7♭5 (E=4): m3 and m7; A7 (A=9): M3 and m7; Dm7 (D=2): m3 and m7.
    expect([above(4, j2[0] ?? []), above(9, j2[1] ?? []), above(2, j2[2] ?? [])]).toEqual([
      [3, 10],
      [4, 10],
      [3, 10],
    ]);
  });

  test("the tritone sub: D♭7's root is a tritone from G, and the bass falls by half steps D–D♭–C", async () => {
    expect((7 - 1 + 12) % 12).toBe(6);
    const r = await evalHeadless(J5_TRITONE, 4);
    const bass = r.events.filter((e) => e.track === "bass").map((e) => e.midi);
    expect(bass).toEqual([38, 37, 36, 36]);
  });

  test("three against two: three even cowbells over two kicks in each bar", async () => {
    const r = await evalHeadless(R2_THREE_TWO, 1);
    const at = (track: string) => r.events.filter((e) => e.track === track).map((e) => e.begin);
    expect(at("perc")).toEqual(["0", "1/3", "2/3"]);
    expect(at("kick")).toEqual(["0", "1/2"]);
  });

  test("son clave 3-2 on the two-bar eighth grid: 1, the and of 2, 4 | 2, 3", async () => {
    for (const code of [R3_CLAVE, RC2_POLY]) {
      const r = await evalHeadless(code, 2);
      expect(r.events.filter((e) => e.track === "clave").map((e) => e.begin)).toEqual([
        "0",
        "3/8",
        "3/4",
        "5/4",
        "3/2",
      ]);
    }
    // The tresillo under it: (3,8) is 3+3+2.
    const r = await evalHeadless(R3_CLAVE, 1);
    expect(r.events.filter((e) => e.track === "bass").map((e) => e.begin)).toEqual(["0", "3/8", "3/4"]);
  });
});

describe("track capstone drafts (seed-wave7.ts)", () => {
  test("every draft lints clean at its own session (earliest route) and evaluates with no unknown chord", async () => {
    for (const [id, drafts] of Object.entries(WAVE7_CAPSTONE_DRAFTS))
      for (const [i, code] of drafts.entries()) {
        const session = `${id}.S${i + 1}`;
        expect({ session, errors: lintErrors(code, unlockedAt(session)) }).toEqual({ session, errors: [] });
        const r = await evalHeadless(code, 16);
        expect(r.events.length).toBeGreaterThan(20);
        expect({ session, unknown: r.logs.filter((l) => /unknown chord/.test(l)) }).toEqual({
          session,
          unknown: [],
        });
      }
  });

  test("JC1's guide-tone melody holds the 3rd or the 7th of every bar's chord", async () => {
    const roots = [2, 7, 0, 0, 5, 10, 3, 3, 11, 4, 9, 9, 2, 7, 0, 0];
    const guides = [
      [3, 10],
      [4, 10],
      [4, 11],
      [4, 11],
      [3, 10],
      [4, 10],
      [4, 11],
      [4, 11],
      [3, 10],
      [4, 10],
      [3, 10],
      [3, 10],
      [3, 10],
      [4, 10],
      [4, 11],
      [4, 11],
    ];
    const mel = pcs(
      await midisOf(
        JC1_BALLAD.split("\n")
          .filter((l) => !/^(drums|hats|chords|bass):/.test(l))
          .join("\n"),
        16,
      ),
    );
    expect(mel.length).toBe(16);
    mel.forEach((pc, i) => {
      const iv = (pc - (roots[i] as number) + 12) % 12;
      expect({ bar: i + 1, guide: (guides[i] as number[]).includes(iv) }).toEqual({
        bar: i + 1,
        guide: true,
      });
    });
  });

  test("AC1's version two keeps the tune and its changes, 30 BPM faster on other instruments", async () => {
    for (const song of content.songs.filter((s) =>
      ["song.st-louis-blues", "song.sweet-georgia-brown"].includes(s.id),
    )) {
      const { a, b } = ac1Versions(song.answerKey.code);
      expect(lintErrors(b, unlockedAt("AC1.S2"))).toEqual([]);
      const ra = await evalHeadless(a, 8);
      const rb = await evalHeadless(b, 8);
      expect(rb.cps * 240).toBeCloseTo(ra.cps * 240 + 30, 5);
      const notes = (r: typeof ra) =>
        r.events.filter((e) => e.midi !== null && /mel/.test(e.track)).map((e) => e.midi);
      expect(notes(rb)).toEqual(notes(ra));
      expect(new Set(rb.events.map((e) => e.s))).not.toEqual(new Set(ra.events.map((e) => e.s)));
    }
  });

  test("JC4's reharmonization: a secondary ii–V, a tritone sub and a backdoor; the melody untouched", async () => {
    const song = testGeorgia();
    const re = jc4Reharm(song);
    const changes = /chord\("<([^>"]+)>"\)/.exec(re)?.[1] ?? "";
    expect(changes).toContain("[Gm7 C7]"); // ii–V of the C7 that resolves to F^7
    expect(changes).toContain("Gb7"); // the tritone sub of the next resolving C7
    expect(changes).toContain("[Bbm7 Eb7]"); // iv7–♭VII7 into the last F^7
    const mel = (code: string) => code.split("\n").find((l) => l.startsWith("mel:"));
    expect(mel(re)).toBe(mel(song.answerKey.code));
    const r = await evalHeadless(re, 32);
    expect(r.logs.filter((l) => /unknown chord/.test(l))).toEqual([]);
    expect(lintErrors(re, unlockedAt("JC4.S2"))).toEqual([]);
  });
});

describe("the walks of the points (wave7.md §6)", () => {
  test("every walk keeps each track's order, and a capstone's sessions come after its gate", () => {
    for (const [point, w] of Object.entries(WAVE7_WALKS)) {
      for (const t of ["J", "R", "A"] as const) {
        const mine = w.walk.filter((id) => TRACK_ORDER[t].includes(id));
        const pos = mine.map((id) => TRACK_ORDER[t].indexOf(id));
        // Order inside a track; J.CP2 may come before the enrichment lesson J5.L05 (it does not cover it).
        const sorted = [...pos].sort((x, y) => x - y);
        const swapped = JSON.stringify(pos) !== JSON.stringify(sorted);
        // Two places where a walk leaves the default order as the planner does: a due checkpoint is scheduled first
        // (J.CP2 before the enrichment lesson J5.L05; J.CP1 and JC1 before J2.L04, which can be passed over).
        if (swapped) {
          const allowed = mine.filter((id) => id !== "J5.L05" && id !== "J2.L04");
          const ap = allowed.map((id) => TRACK_ORDER[t].indexOf(id));
          expect({
            point,
            t,
            inOrder: JSON.stringify(ap) === JSON.stringify([...ap].sort((x, y) => x - y)),
          }).toEqual({
            point,
            t,
            inOrder: true,
          });
        }
      }
      if (w.walk.includes("JC1.S1")) expect(w.walk.indexOf("J.CP1")).toBeLessThan(w.walk.indexOf("JC1.S1"));
      if (w.walk.includes("AC2.S1")) {
        for (const g of ["A.CP", "J3.L04", "R1.L05"])
          expect({ point, g, before: w.walk.indexOf(g) < w.walk.indexOf("AC2.S1") }).toEqual({
            point,
            g,
            before: true,
          });
      }
    }
    // 74 before Oak 2.0 W2 added J3.L05, R1.L06 and A2.L07–L09 to the tracks.
    expect(WAVE7_WALKS["whole course complete"]?.walk.length).toBe(79);
  });
});
