// The advanced tracks lived as the learner (review:learner, Wave 7): pins for what that review changed.
//   - Pace: no listen step of J1–J5, R1–R3, A1.L05–L07 or A2 asks for more audio than 85% of its minutes (a listen
//     step's items play one after another; the learner also reads the captions). J2.L01's tour of twelve keys runs
//     76 seconds, so its step gives it at least as long again to read the chord band.
//   - Hooks that now promise something: R2.L02 opens with odd-meter funk (a clav riff whose every note is in its
//     bar's chord), A2.L01's closing line names what A2.L02 opens with, and AC2's brief says the three tracks meet
//     there, which its gate makes true.
//   - Made something: A2.L01's Make invites a part of the learner's own, and its suggestion reads that.
//   - The end: ms.28 leaves a reason to keep making music in Oak.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import type { LessonDef } from "@oak/content-kit";
import { evalHeadless } from "@oak/grader/testing";
import capstones from "../capstones.ts";
import { loadLessons } from "../lib/load.bun.ts";
import milestones from "../milestones.ts";
import { isTrackLesson } from "./standard.ts";

setDefaultTimeout(300_000);

const { lessons } = await loadLessons();
const wave7 = lessons.filter((l) => !l.sample && isTrackLesson(l.def.id) && !/^A1\.L0[1-4]$/.test(l.def.id));
const byId = (id: string): LessonDef => {
  const l = lessons.find((x) => x.def.id === id);
  if (!l) throw new Error(`no lesson ${id}`);
  return l.def;
};
// biome-ignore lint/suspicious/noExplicitAny: the steps are read loosely, as the walk reads them
type AnyStep = any;
const seconds = async (code: string, bars: number): Promise<number> =>
  (await evalHeadless(code, bars)).cps ** -1 * bars;

describe("pace: listen steps fit their minutes", () => {
  test("the 51 lessons of the three tracks are all here", () => {
    expect(wave7.length).toBe(51);
  });
  test("every listen step's items fill at most 85% of its minutes", async () => {
    const over: string[] = [];
    for (const l of wave7)
      for (const s of l.def.steps as AnyStep[]) {
        if (s.kind !== "listen") continue;
        let audio = 0;
        for (const it of s.exercise?.items ?? []) if (it.code) audio += await seconds(it.code, it.bars ?? 4);
        if (audio > 0.85 * s.minutes * 60)
          over.push(`${l.def.id} ${s.id}: ${audio.toFixed(1)} s in ${s.minutes} min`);
      }
    expect(over).toEqual([]);
  });
  test("J2.L01's tour of twelve keys has as long again to be read", async () => {
    const s = (byId("J2.L01").steps as AnyStep[]).find((x) => x.id === "S3");
    const audio = await seconds(s.example.code, s.example.bars);
    expect(audio).toBeGreaterThan(70);
    expect(s.minutes * 60).toBeGreaterThanOrEqual(audio * 1.15);
  });
});

describe("hooks", () => {
  test("R2.L02 opens on the groove, then the same groove with a clav riff whose every note is in its bar's chord", async () => {
    const s = (byId("R2.L02").steps as AnyStep[]).find((x) => x.id === "S1");
    const items = s.exercise.items as { code: string; caption: string }[];
    expect(items).toHaveLength(2);
    const riff = await evalHeadless(items[1]?.code as string, 2);
    const keys = riff.events.filter((e) => e.track === "keys");
    expect(new Set(riff.events.map((e) => e.s))).toContain("clav");
    // Bar 1 is Am7 (A C E G), bar 2 Fmaj7 (F A C E).
    const chordPcs = [new Set([9, 0, 4, 7]), new Set([5, 9, 0, 4])];
    for (const e of keys) expect(chordPcs[Math.floor(e.onset)]?.has((e.midi as number) % 12)).toBe(true);
    // On the three group starts of 2+2+3 (eighths 0, 2 and 4 of seven) and on the last eighth, in both bars.
    expect(keys.map((e) => Math.round((e.onset % 1) * 7))).toEqual([0, 2, 4, 6, 0, 2, 4, 6]);
  });
  test("A2.L01's closing line names what A2.L02's hook plays", () => {
    const close = lessons.find((l) => l.def.id === "A2.L01")?.mdxSource ?? "";
    expect(close).toContain(
      "Next: the same loop as a verse with room in it and a chorus that fills every beat.",
    );
    const hook = (byId("A2.L02").steps as AnyStep[])[0];
    expect(hook.exercise.items[0].caption).toContain(
      "A verse with room in it, then a chorus that fills every beat",
    );
  });
  test("AC2's brief says the three tracks meet there, and its gate needs all three", () => {
    const ac2 = capstones.find((c) => c.id === "AC2");
    expect(ac2?.brief?.prompt).toStartWith("A neo-soul ballad where the three tracks meet");
    expect(ac2?.opensAfter).toEqual({ checkpoints: ["A.CP"], lessonsCompleted: ["J3.L04", "R1.L05"] });
  });
});

describe("made something", () => {
  test("A2.L01's Make invites a part of the learner's own and a suggestion reads it", () => {
    const make = (byId("A2.L01").steps as AnyStep[]).at(-1);
    expect(make.exercise.prompt).toContain("Then add a fourth line");
    const rule = make.exercise.rubric.find((r: { id: string }) => r.id === "a-fourth-part");
    expect(rule).toMatchObject({ required: false, rule: "tracks", min: 4 });
    expect(make.exercise.rubric.filter((r: { required: boolean }) => r.required)).toHaveLength(1);
  });
  test("R2.L02's Make invites the riff its hook played, as a suggestion only", () => {
    const make = (byId("R2.L02").steps as AnyStep[]).at(-1);
    expect(make.exercise.prompt).toContain("a clav riff on top");
    const rule = make.exercise.rubric.find((r: { id: string }) => r.id === "a-riff-on-top");
    expect(rule).toMatchObject({ required: false, rule: "sounds", contains: ["snd.clav"] });
    expect(make.exercise.rubric.filter((r: { required: boolean }) => r.required)).toHaveLength(1);
  });
});

describe("the end", () => {
  test("ms.28 respects the work and leaves somewhere to keep writing", () => {
    const ms = milestones.find((m) => m.id === "ms.28");
    expect(ms?.title).toBe("You have completed Oak.");
    expect(ms?.description).toContain("twenty album tracks");
    expect(ms?.description).toContain("Studio and the sketchbook stay open for it.");
    expect(ms?.description).not.toMatch(/!|congrat/i);
  });
});
