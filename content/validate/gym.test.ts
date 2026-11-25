// The Transcription Gym schedule (contracts §2.5, §2.9): the slot rule produces exactly the GYM.nn of the
// default order, a slot never interrupts a capstone, odd slots are graded ladder sessions with open
// material, and the ladder and the own-audio templates name what exists.
import { describe, expect, test } from "bun:test";
import type { SessionId } from "@oak/content-kit";
import { capstones } from "../capstones.ts";
import { ladder } from "../gym/ladder.ts";
import {
  GYM_SLOT_RULE,
  gymSlotKind,
  isTranscriptionSession,
  LADDER_OPENS,
  placeGymSlots,
} from "../gym/slots.ts";
import { templates } from "../gym/templates.ts";
import { courseGraph } from "../index.ts";
import { atOrBefore } from "../lib/course.ts";
import { syllabus } from "../syllabus.ts";
import { toolboxById } from "../toolbox.ts";

const order = syllabus.defaultOrder as readonly SessionId[];
const g = courseGraph();
const gyms = order.filter((s) => s.startsWith("GYM."));

describe("the slot rule (contracts §2.5)", () => {
  test("placing slots by the rule reproduces the default order exactly", () => {
    expect(placeGymSlots(order.filter((s) => !s.startsWith("GYM.")))).toEqual([...order]);
  });
  test("no slot before U07.L01, and the core has GYM.01 to GYM.18 in sequence", () => {
    expect(order.indexOf(gyms[0] as SessionId)).toBeGreaterThan(order.indexOf(GYM_SLOT_RULE.startsAt));
    expect<string[]>(gyms).toEqual(
      Array.from({ length: 18 }, (_, i) => `GYM.${String(i + 1).padStart(2, "0")}`),
    );
  });
  test("at most four core sessions between transcription sessions, except inside a capstone", () => {
    let run = 0;
    let started = false;
    const problems: string[] = [];
    for (const [i, s] of order.entries()) {
      if (s === GYM_SLOT_RULE.startsAt) started = true;
      if (!started) continue;
      if (isTranscriptionSession(s)) {
        run = 0;
        continue;
      }
      run++;
      const capstone = /^(C\d+|CF-A)\.S(\d+)$/.exec(s);
      const continues = capstone && Number(capstone[2]) > 1;
      if (run > GYM_SLOT_RULE.afterCoreSessions && !continues && !/^(C\d+|CF-A)\.S/.test(order[i - 1] ?? ""))
        problems.push(`${s}: ${run} core sessions since the last transcription session`);
    }
    expect(problems).toEqual([]);
  });
  test("a slot never falls inside a multi-session capstone", () => {
    for (const [i, s] of order.entries()) {
      if (!s.startsWith("GYM.")) continue;
      const before = /^(C\d+|CF-A)\.S(\d+)$/.exec(order[i - 1] ?? "");
      const after = /^(C\d+|CF-A)\.S(\d+)$/.exec(order[i + 1] ?? "");
      expect([s, !!before && !!after && before[1] === after[1]]).toEqual([s, false]);
    }
  });
});

describe("what a slot plays (contracts §2.5, §2.9)", () => {
  test("odd slots are graded ladder sessions, even slots the learner's own audio", () => {
    expect(gyms.filter((s) => gymSlotKind(s) === "ladder")).toEqual(gyms.filter((_, i) => i % 2 === 0));
  });
  test("every graded slot has ladder material open at it in every legal order (L1–L4 from GYM.01)", () => {
    for (const s of gyms.filter((x) => gymSlotKind(x) === "ladder")) {
      const open = ladder.filter((l) => l.grading === "auto" && atOrBefore(g, LADDER_OPENS[l.level], s));
      expect([s, open.length >= 4]).toEqual([s, true]);
    }
    for (const level of [1, 2, 3, 4] as const)
      expect([level, atOrBefore(g, LADDER_OPENS[level], "GYM.01" as SessionId)]).toEqual([level, true]);
  });
  test("the ladder: generated levels name a generator, song levels a pool, pass marks as §6.6 and §6.12", () => {
    for (const l of ladder) {
      if (l.level <= 4) expect([l.level, typeof l.generator]).toEqual([l.level, "string"]);
      if (l.level === 5 || l.level === 6)
        expect([l.level, (l.pool ?? []).length > 0]).toEqual([l.level, true]);
      if (l.grading === "auto") expect([l.level, l.pass >= 0.8]).toEqual([l.level, true]);
    }
    expect(ladder.find((l) => l.level === 3)?.layers).toEqual(["bass", "chords"]);
  });
  test("own-audio templates unlock with a toolbox row", () => {
    for (const t of templates) expect([t.id, toolboxById.has(t.tool)]).toEqual([t.id, true]);
  });
  // Wave 6: CF-T runs in gym slots (contracts §2.5 "What fills a slot"): from the moment it is open, each
  // slot is its next session until it is released, so its four sessions sit exactly where slots fall.
  test("CF-T's four sessions each sit on a slot, after U15.L01, and no GYM.nn falls among them", () => {
    const cft = capstones.find((c) => c.id === "CF-T");
    expect([cft?.inGymSlots, cft?.sessions, cft?.kind]).toEqual([true, 4, "transcribe"]);
    const at = (id: string) => order.indexOf(id as SessionId);
    const sessions = ["CF-T.S1", "CF-T.S2", "CF-T.S3", "CF-T.S4"];
    expect(sessions.map((id) => at(id) + 1)).toEqual([162, 167, 172, 177]);
    expect(at("CF-T.S1")).toBeGreaterThan(at("U15.L01"));
    expect(cft?.opensAfter).toEqual({ lessonsCompleted: ["U15.L01"] });
    for (const id of sessions) {
      // Exactly four core sessions since the last transcription session: the place a slot falls.
      let run = 0;
      for (let i = at(id) - 1; i >= 0 && !isTranscriptionSession(order[i] as string); i--) run++;
      expect([id, run]).toEqual([id, GYM_SLOT_RULE.afterCoreSessions]);
    }
    expect(order.slice(at("CF-T.S1"), at("CF-T.S4")).filter((x) => x.startsWith("GYM."))).toEqual([]);
    // The last gym slot before it and the first after it: GYM.16 and GYM.17.
    expect(
      order
        .slice(0, at("CF-T.S1"))
        .filter((x) => x.startsWith("GYM."))
        .at(-1),
    ).toBe("GYM.16");
    expect(order.slice(at("CF-T.S4")).find((x) => x.startsWith("GYM."))).toBe("GYM.17");
  });
  test("the default order ends with the Album Single: CF-A.S1–S4 are sessions 188–191", () => {
    expect(order.length).toBe(191);
    expect(order.slice(-4)).toEqual(["CF-A.S1", "CF-A.S2", "CF-A.S3", "CF-A.S4"] as SessionId[]);
    expect(order.at(-5)).toBe("GYM.18" as SessionId);
  });
  test("transcription capstones are transcription sessions, so they take a slot (X1 after C2)", () => {
    for (const c of capstones.filter((x) => x.kind === "transcribe"))
      for (const s of c.sessionDefs) expect([s.id, isTranscriptionSession(s.id)]).toEqual([s.id, true]);
  });
});
