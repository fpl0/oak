// The Wave 6 learner review of C6, C7 and CF-A (review:studio): three honest pieces per capstone and plausible near
// misses (review-w6-pieces.ts), graded as the browser's check does (`checkPiece`: the key read from the code when
// the brief has none). Each verdict must be right, each open rule must say what is missing where the learner can
// act on it, and the device counter must name the bars where each device is. Regressions it pins:
// - the key lift's line counted the bars of the new key to the last note, not to the end: an eight-bar last chorus
//   whose last bar rests read "7 bars" under a met rule, and a four-bar lift "3 bars";
// - the lift's line was ticked whatever the rule said: a lift of a minor third or of four bars read as found, while
//   the rule's own sentence (for the four bars, "C major → C major is +0") said nothing a learner could use.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { CORE_DEVICES, type KeySpec } from "@oak/content-kit";
import { formView, keyEstimate, modeView } from "@oak/grader";
import { checklistOf } from "./checklist.ts";
import { deviceRows } from "./devices.ts";
import * as Pieces from "./review-w6-pieces.ts";

const P: Readonly<Record<string, string>> & typeof Pieces = { ...Pieces };

import { analysePiece, capstone, gradePiece } from "./test-support.ts";
import { pieceForm } from "./wave5.ts";
import { liftFound, type PieceRead, runningLength, wave6Extras } from "./wave6.ts";

setDefaultTimeout(180_000);

/** `engine.checkPiece` without the worker: the brief's key, else the code's stated mode, else the estimate. */
async function check(id: "C6" | "C7" | "CF-A", code: string) {
  const c = capstone(id);
  const a = await analysePiece(id, code);
  const key: KeySpec | null =
    c.key ?? modeView(a.n, { meter: c.meter }).stated ?? keyEstimate(a.n.all)[0]?.key ?? null;
  const piece: PieceRead = { n: a.n, code, meter: c.meter, key, bars: a.bars };
  const brief = c.brief?.rubric ?? [];
  const form = pieceForm(formView(a.n, { code, bars: a.bars }), code, brief);
  const result = await gradePiece(id, code, key);
  const rows = checklistOf(brief, result);
  const extras = wave6Extras(brief, result, { ...piece, form, analysis: a.analysis });
  const open = rows.filter((r) => r.required && r.state !== "met").map((r) => r.id);
  const found = (ruleId: string) => {
    const x = extras[ruleId];
    return x?.kind === "found" ? x.items : [];
  };
  const detail = (ruleId: string) => rows.find((r) => r.id === ruleId)?.detail ?? null;
  return { result, rows, open, found, detail, piece, analysis: a.analysis, bars: a.bars, key };
}

describe("C6 Modal Vamp", () => {
  test.each([
    ["C6_POP_D", "D Mixolydian", "bars 1, 2, 5, 6 and 4 more"],
    ["C6_JAZZ_A", "A Dorian", "bars 2, 4, 5, 6 and 6 more"],
    ["C6_FUNK_E", "E Mixolydian", "bars 2, 5, 6, 9 and 2 more"],
  ] as const)("%s passes, read in %s, with the colour note's strong bars", async (name, mode, bars) => {
    const r = await check("C6", P[name]);
    expect(r.result.status).toBe("pass");
    const [tone] = r.found("mode");
    expect(tone?.ok).toBe(true);
    expect(tone?.text).toStartWith(`${mode}: its colour note`);
    expect(tone?.text).toContain(bars);
  });

  test("a “Mixolydian” vamp that never sounds its ♭7 fails the mode, and both lines say so", async () => {
    const r = await check("C6", P.C6_MISS_NO_B7);
    expect(r.open).toEqual(["mode"]);
    expect(r.detail("mode")).toBe(
      "its colour note ♭7 (F) is on a strong beat 0 times; put it on beat 1 or 3 at least twice",
    );
    expect(r.found("mode")[0]).toMatchObject({
      ok: false,
      text: "G Mixolydian: its colour note ♭7 has not sounded yet.",
    });
  });

  test("Dorian with its raised 6 only on beats 2 and 4: how often it sounds, and never on 1 or 3", async () => {
    const r = await check("C6", P.C6_MISS_OFFBEAT);
    expect(r.open).toEqual(["mode"]);
    expect(r.found("mode")[0]?.text).toBe(
      "D Dorian: its colour note 6 sounds 12 times, never on beat 1 or 3 yet.",
    );
  });

  test("a D7 turnaround brings back F♯: the rule names the note and its bar; with the home chord too rare, both", async () => {
    const only = await check("C6", P.C6_MISS_LEADING2);
    expect(only.open).toEqual(["mode"]);
    expect(only.detail("mode")).toBe("F♯ in bar 4 is degree 7; G Mixolydian has ♭7 (F) in its place");
    const both = await check("C6", P.C6_MISS_LEADING);
    expect(both.detail("mode")).toContain("F♯ in bar 4 is degree 7");
    expect(both.detail("mode")).toContain(
      "the G chord is in 25% of the bars; the home chord needs at least 40%",
    );
  });
});

describe("C7 Chromatic Colour", () => {
  test.each([
    [
      "C7_POP_E7",
      "V7/vi (E7) in bar 2 resolves to vi (Am) in bar 3.",
      "♭VI–♭VII–I in bars 13–15.",
      "C major → D♭ major at bar 25: up a half step, 8 bars.",
    ],
    [
      "C7_BALLAD_D7",
      "V7/V (D7) in bar 10 resolves to V (G) in bar 11.",
      "♭VI–♭VII–I in bars 7–9.",
      "C major → D major at bar 25: up a whole step, 8 bars.",
    ],
    [
      "C7_SOUL_SEVENTHS",
      "V7/ii (A7) in bar 2 resolves to ii7 (Dm7) in bar 3.",
      "♭VI–♭VII–I in bars 15–16.",
      "C major → D♭ major at bar 25: up a half step, 8 bars.",
    ],
  ] as const)(
    "%s passes: each colour named with its bars, the lift eight bars long",
    async (name, sec, run, lift) => {
      const r = await check("C7", P[name]);
      expect(r.result.status).toBe("pass");
      expect(r.found("secondary")[0]).toMatchObject({ ok: true, text: sec });
      expect(r.found("mixture")[0]).toMatchObject({ ok: true, text: run });
      // The last chorus rests in its last bar (pop, soul): the new key still lasts to the end, eight bars.
      expect(r.found("lift")).toEqual([expect.objectContaining({ ok: true, text: lift })]);
    },
  );

  test("a secondary dominant that goes elsewhere: where it went and where it points, both times", async () => {
    const r = await check("C7", P.C7_MISS_UNRESOLVED);
    expect(r.open).toEqual(["secondary"]);
    expect(r.detail("secondary")).toBe(
      "V7/vi (E7) in bar 2 doesn't resolve: it goes to IV (F), not to vi (Am)",
    );
    expect(r.found("secondary").map((x) => x.text)).toEqual([
      "V7/vi (E7) in bar 2 goes to IV (F), not to vi.",
      "V7/vi (E7) in bar 18 goes to IV (F), not to vi.",
    ]);
  });

  test("a lift of four bars: the line says where it starts, that it lasts four bars and that eight are asked", async () => {
    const r = await check("C7", P.C7_MISS_SHORT_LIFT);
    expect(r.open).toEqual(["lift"]);
    const [lift] = r.found("lift");
    expect(lift).toEqual({
      text: "C major → D major at bar 29: up a whole step, 4 bars; the new key needs 8 bars or more to the end.",
      anchor: { from: 29, to: 32 },
      ok: false,
      keep: true,
    });
  });

  test("a lift of a minor third and a ♭VI–♭VII that lands on vi: neither is ticked", async () => {
    const r = await check("C7", P.C7_MISS_NO_HOME);
    expect(r.open.sort()).toEqual(["lift", "mixture"]);
    expect(r.detail("mixture")).toBe("♭VI → ♭VII is there from bar 13, but then comes vi (Am), not I (C)");
    expect(r.found("lift")[0]).toMatchObject({
      ok: false,
      keep: true,
      text: "C major → E♭ major at bar 25: 3 half steps up, 8 bars; the lift is a half step or a whole step up.",
    });
  });

  test("liftFound without a rule (the piece's key plan alone) still counts to the end and never judges", async () => {
    const r = await check("C7", P.C7_MISS_SHORT_LIFT);
    expect(liftFound(r.piece)[0]).toMatchObject({
      ok: true,
      text: "C major → D major at bar 29: up a whole step, 4 bars.",
    });
  });
});

// Oak 2.0 W4 F1: CF-A now also requires an ending on purpose (`ending`, contracts §6.6). These Wave 6 review pieces
// stop at the end of their last chorus, so that line is open on every one of them and nothing else changes: each
// "passes" below as "only the ending is open" (decision 133).
describe("CF-A Album Single", () => {
  const devices = async (code: string) => {
    const r = await check("CF-A", code);
    const rows = deviceRows(CORE_DEVICES, r.analysis.deviceList ?? []);
    return { ...r, firstBars: Object.fromEntries(rows.map((x) => [x.device, x.bars[0] ?? null])) };
  };

  test("pop in G at 120, 64 bars: four devices at the bars where they sound; 2:08", async () => {
    const r = await devices(P.CFA_G_POP);
    expect(r.key).toEqual({ tonic: "G", mode: "major" });
    expect(r.open).toEqual(["ending"]);
    // B7 in the chorus's third bar (13 + 2), Cm in the bridge's fifth (37 + 4), the 4–3 in the verse's last bar
    // (5 + 3), the pushed bass from the verse (the intro has none).
    expect(r.firstBars).toEqual({
      "secondary dominant": 15,
      "borrowed chord": 41,
      modulation: null,
      suspension: 8,
      "syncopated bass": 5,
      "modal colour": null,
    });
    expect(
      runningLength(capstone("CF-A").brief?.rubric ?? [], {
        bars: r.bars,
        durationSec: r.analysis.durationSec,
      }),
    ).toEqual({
      text: "64 bars · 2:08 of 2:00",
      ok: true,
    });
  });

  test("indie in A minor at 90: A7 into Dm, the Dorian IV borrowed, a pushed chorus bass, the last chorus in B minor", async () => {
    const r = await devices(P.CFA_AMIN_INDIE);
    expect(r.key).toEqual({ tonic: "A", mode: "minor" });
    expect(r.open).toEqual(["ending"]);
    expect(r.firstBars).toMatchObject({
      "secondary dominant": 12,
      "borrowed chord": 2,
      modulation: 49,
      "syncopated bass": 9,
      // An unprepared A over E (an appoggiatura) is not a suspension.
      suspension: null,
    });
  });

  test("funk in F at 104, exactly two minutes: E♭ alone is modal colour, B♭m is borrowed", async () => {
    const r = await devices(P.CFA_F_FUNK);
    expect(r.open).toEqual(["ending"]);
    expect(r.analysis.durationSec).toBeCloseTo(120, 6);
    expect(r.firstBars).toMatchObject({
      "secondary dominant": 11,
      "borrowed chord": 37,
      "modal colour": 2,
      "syncopated bass": 1,
    });
  });

  test("three devices: the count is open and names what is there and what is not", async () => {
    const r = await devices(P.CFA_MISS_THREE);
    expect(r.open).toEqual(["devices", "ending"]);
    expect(r.detail("devices")).toBe(
      "3 of the 4 asked for: secondary dominant (bar 15), borrowed chord (bar 41), syncopated bass (bar 5); still open: modulation, suspension, modal colour",
    );
  });

  test("a bridge that is the chorus renamed: the borrowed chord it carried is gone, and the suggestion line says it is no different from the chorus", async () => {
    const r = await devices(P.CFA_MISS_BRIDGE_RENAMED);
    expect(r.open).toEqual(["devices", "ending"]);
    expect(r.firstBars["borrowed chord"]).toBeNull();
    // The form rule counts a section named for a bridge (contracts §6.3); the suggestion line says what is wrong.
    expect(r.rows.find((x) => x.id === "bridge")?.state).toBe("met");
    expect(r.detail("contrast")).toContain("the bridge is no higher or lower in tune");
  });

  test("1:52: only the length is open, and it says by how much", async () => {
    const r = await devices(P.CFA_MISS_SHORT);
    expect(r.open).toEqual(["duration", "ending"]);
    expect(r.detail("duration")).toBe("112 s long; at least 120 s");
    expect(
      runningLength(capstone("CF-A").brief?.rubric ?? [], {
        bars: r.bars,
        durationSec: r.analysis.durationSec,
      }),
    ).toEqual({
      text: "56 bars · 1:52 of 2:00",
      ok: false,
    });
  });
});
