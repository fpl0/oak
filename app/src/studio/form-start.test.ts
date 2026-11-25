// Oak 2.0 W4 F7 "Borrow a form you mapped" (DeSantis, Formal Skeletons): the sections of a song the learner mapped
// in Transcribe become an empty skeleton to write into: the form and its lengths, no notes and no sound names.
import { describe, expect, test } from "bun:test";
import { tempoLineOf } from "@oak/api";
import { lintBase } from "@oak/grader";
import { evalHeadless } from "@oak/grader/testing";
import type { SongGiven } from "../transcribe/song.ts";
import { skeletonOfForm } from "../transcribe/standard.ts";
import { isDescriptive } from "./descriptive.ts";
import {
  canOfferInCapstone,
  FORM_START_COPY,
  formOfProject,
  formStartBody,
  formStartCode,
  formsOffered,
  type MappedForm,
  oakForms,
} from "./form-start.ts";

const C = { tonic: "C", mode: "major" } as const;
const region = (label: string, startS: number, endS: number, kind: "section" | "loop" = "section") => ({
  id: `r_${label}_${startS}`,
  label,
  startS,
  endS,
  kind,
});
/** A A B A, eight bars each at 120 BPM in 4/4 (2 s a bar). */
const AABA = [region("A", 0, 16), region("A", 16, 32), region("B", 32, 48), region("A", 48, 64)];
const project = (over: Record<string, unknown> = {}) => ({
  id: "tr_1",
  title: "Blue Moon Line",
  bpm: 120,
  meter: "4/4" as const,
  key: C,
  regions: AABA,
  ...over,
});
const formOf = (over: Record<string, unknown> = {}): MappedForm => {
  const f = formOfProject(project(over) as never);
  if (f === null) throw new Error("no form");
  return f;
};

describe("formOfProject", () => {
  test("the section regions in order, each rounded to whole bars from bar 1", () => {
    const f = formOf();
    expect(f.map).toEqual({ bars: 32, cuts: [1, 9, 17, 25], labels: ["A", "A", "B", "A"] });
    expect([f.source, f.title, f.bpm, f.meter, f.key]).toEqual(["yours", "Blue Moon Line", 120, "4/4", C]);
    // A map cut a little late is the same map; a loop region is not a section; the order of the list does not matter.
    const late = AABA.map((r) => ({ ...r, startS: r.startS + 0.3, endS: r.endS + 0.3 }));
    expect(formOf({ regions: [region("loop me", 3, 5, "loop"), ...late.reverse()] }).map).toEqual(f.map);
  });
  test("no tempo, no section, or one unnamed section is no form", () => {
    expect(formOfProject(project({ bpm: null }) as never)).toBeNull();
    expect(formOfProject(project({ bpm: 0 }) as never)).toBeNull();
    expect(formOfProject(project({ regions: [region("x", 0, 8, "loop")] }) as never)).toBeNull();
    expect(formOfProject(project({ regions: [region("", 0, 16)] }) as never)).toBeNull();
  });
});

describe("formStartCode", () => {
  test("an empty skeleton: the tempo, one const per section and part, the form in arrange(), no sound, no note", async () => {
    const code = formStartCode(formOf(), { bpm: 120, meter: "4/4", key: C });
    expect(tempoLineOf(code)).toBe("setcpm(120/4)");
    expect(code.match(/const bassA\b/g)?.length).toBe(1);
    expect(code.match(/const bassB\b/g)?.length).toBe(1);
    expect(code).toContain("bass: arrange([8, bassA], [8, bassA], [8, bassB], [8, bassA])");
    expect(code).not.toContain(".s(");
    expect(lintBase(code).filter((d) => d.severity === "error")).toEqual([]);
    const { events } = await evalHeadless(code, 32);
    expect(events).toHaveLength(0);
  });
  test("without the option, skeletonOfForm writes exactly what it wrote before W4", () => {
    const g: SongGiven = {
      songId: null,
      title: "Blue Moon Line",
      year: null,
      bpm: 120,
      meter: "4/4",
      key: C,
      pickupBeats: null,
      bars: 32,
      phrases: [],
      swing: false,
      form: null,
    };
    const m = { bars: 32, cuts: [1, 9, 17, 25], labels: ["A", "A", "B", "A"] };
    // Pinned from the function at the W4 base commit (71e1916).
    expect(skeletonOfForm(g, m)).toBe(
      'setcpm(120/4)\n// Blue Moon Line · C major, home is C · 4/4\n// Starts on beat 1 of bar 1.\n// Form: A (bars 1–8) · A (9–16) · B (17–24) · A (25–32)\n\n// A: 8 bars (first heard at bar 1)\nconst bassA = n("<0 0 0 0 0 0 0 0>").scale("C2:major").s("ebass")\nconst chordsA = note("<~ ~ ~ ~ ~ ~ ~ ~>")\nconst melA = n("<~ ~ ~ ~ ~ ~ ~ ~>").scale("C4:major").s("piano")\n\n// B: 8 bars (first heard at bar 17)\nconst bassB = n("<0 0 0 0 0 0 0 0>").scale("C2:major").s("ebass")\nconst chordsB = note("<~ ~ ~ ~ ~ ~ ~ ~>")\nconst melB = n("<~ ~ ~ ~ ~ ~ ~ ~>").scale("C4:major").s("piano")\n\nbass: arrange([8, bassA], [8, bassA], [8, bassB], [8, bassA])\nchords: arrange([8, chordsA], [8, chordsA], [8, chordsB], [8, chordsA])\nmel: arrange([8, melA], [8, melA], [8, melB], [8, melA])\n',
    );
    expect(skeletonOfForm(g, m, { empty: true })).not.toContain(".s(");
  });
  test("formStartBody: a free sketch with the borrowed form, the tempo and key the learner chose", () => {
    const body = formStartBody(formOf(), {
      title: "My AABA",
      sessionId: null,
      bpm: 96,
      meter: "4/4",
      key: { tonic: "D", mode: "minor" },
    });
    expect(body).toMatchObject({
      title: "My AABA",
      originKind: "free",
      originId: null,
      sessionId: null,
      bpm: 96,
      meter: "4/4",
      key: { tonic: "D", mode: "minor" },
      note: "From the form of “Blue Moon Line”",
    });
    expect(tempoLineOf(body.code)).toBe("setcpm(96/4)");
    expect(body.code).toContain('.scale("D2:minor")');
  });
});

describe("which forms are offered", () => {
  const def = (sections: { type: string; bars: number }[]) => ({
    sections,
    bpm: 100,
    meter: "4/4" as const,
    key: C,
  });
  const songs = [
    { unitId: "U01", title: "First Loop", status: "open" as const },
    { unitId: "U02", title: "Second Song", status: "released" as const },
    { unitId: "U03", title: "Not Started", status: "new" as const },
  ];
  const defOf = () =>
    def([
      { type: "intro", bars: 4 },
      { type: "verse", bars: 8 },
      { type: "chorus", bars: 8 },
      { type: "verse", bars: 8 },
    ]);
  test("Oak's songs only after the learner has mapped one of their own, and never a song not started", () => {
    expect(formsOffered([], songs as never, defOf as never)).toEqual({ yours: [], oak: [] });
    const got = formsOffered([project()] as never, songs as never, defOf as never);
    expect(got.yours.map((f) => f.title)).toEqual(["Blue Moon Line"]);
    expect(got.oak.map((f) => f.title)).toEqual(["First Loop", "Second Song"]);
    expect(got.oak.every((f) => f.source === "oak")).toBe(true);
  });
  test("oakForms: the song's sections by type, a verse that comes back is one section", () => {
    const [f] = oakForms([songs[0]] as never, defOf as never);
    expect(f?.map).toEqual({ bars: 28, cuts: [1, 5, 13, 21], labels: ["intro", "verse", "chorus", "verse"] });
    expect([f?.bpm, f?.meter, f?.key]).toEqual([100, "4/4", C]);
    const code = formStartCode(f as MappedForm, { bpm: 100, meter: "4/4", key: C });
    expect(code.match(/const bassVerse\b/g)?.length).toBe(1);
  });
});

describe("in a capstone", () => {
  const starter = 'setcpm(100/4)\nconst bassVerse = n("<0 0>")\nbass: arrange([8, bassVerse])\n';
  test("offered on a bare draft or the untouched starter, not once the learner has written", () => {
    expect(canOfferInCapstone("setcpm(90/4)\n// nothing yet\n", starter)).toBe(true);
    expect(canOfferInCapstone(`${starter}\n\n  `, starter)).toBe(true);
    expect(canOfferInCapstone(starter.replace('"<0 0>"', '"<0 2>"'), starter)).toBe(false);
  });
});

test("every new string is descriptive", () => {
  for (const [k, v] of Object.entries(FORM_START_COPY)) expect([k, isDescriptive(v)]).toEqual([k, true]);
});
