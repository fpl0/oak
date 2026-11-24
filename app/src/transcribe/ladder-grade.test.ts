// The ladder as the server grades it (`gradeLadder`, the real pipeline, headless): every level's starter code
// fails with lines that name a bar and a beat, and the notes heard right — written from the stimulus events the
// page receives — pass. This is what the Check button shows the learner.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { KeySpec } from "@oak/content-kit";
import { DEFAULT_PROFILE, generateLadderPiece } from "@oak/drills";
import { gradeLadder } from "@oak/grader";
import { checkLines, lineText, starterCode, verdictText } from "./ladder.ts";
import { stimulusCode } from "./stimulus-code.ts";

setDefaultTimeout(60_000);
const ctx = {
  params: {},
  attemptNo: 1,
  firstAttempt: true,
  rung: 0 as const,
  tutorHints: 0,
  extraReplays: 0,
  lint: {
    profile: "graded" as const,
    unlocked: new Set<never>(),
    allowPreview: false,
    meter: "4/4" as const,
    key: null,
  },
};

const CASES = [
  { level: 1, realism: 1, label: null },
  { level: 2, realism: 1, label: "bass" },
  { level: 3, realism: 1, label: "bass" },
  { level: 4, realism: 0, label: "melody" },
  { level: 4, realism: 2, label: "melody" },
] as const;

describe("ladder checks through the real grader", () => {
  for (const c of CASES)
    test(`L${c.level} R${c.realism}: the starter fails bar by bar; the notes as heard pass`, async () => {
      const p = generateLadderPiece(c.level, c.realism, 77, DEFAULT_PROFILE);
      const bpm = Math.round(p.cps * 240);
      const tonic = /scale\("([A-G][b#]?)\d/.exec(p.code)?.[1] ?? "C";
      const key: KeySpec = { tonic, mode: "major" };
      const item = {
        itemId: `lad.${c.level}.77`,
        level: c.level,
        reference: p.code,
        bars: p.bars,
        key,
        meter: "4/4" as const,
        bpm,
        ...(c.level === 3 ? { stage: "bass" as const } : {}),
      };
      const heard = c.level === 3 ? p.events.filter((e) => e.track === "bass") : p.events;
      let answer = stimulusCode(heard, p.bars).code;
      if (c.label) answer = answer.replace(/^ref_\w+:/gm, `${c.label}:`);
      const good = await gradeLadder({ item, code: `setcpm(${bpm}/4)\n${answer}`, ctx });
      expect(good.status).toBe("pass");
      expect(good.score).toBeGreaterThanOrEqual(0.85);
      expect(verdictText({ passed: true, result: good }, null)).toStartWith("That's it");

      const starter = starterCode(c.level, { bpm, meter: "4/4", key, pickupBeats: null, bars: p.bars });
      const bad = await gradeLadder({ item, code: starter, ctx });
      expect(bad.status).toBe("fail");
      const lines = checkLines(bad).map(lineText);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toMatch(/^Bar \d+, beat \d/);
      expect(verdictText({ passed: false, result: bad }, null)).toMatch(
        /^Not quite: \d+% right; 85% passes\. Bars? /,
      );
    });
});
