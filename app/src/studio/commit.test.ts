// Oak 2.0 W1 commit sounds (PLAN S7): a sound change to a committed line is noticed; "Put it back" restores only the
// sound links. Copy is descriptive (W1 fidelity rule 1).
import { describe, expect, test } from "bun:test";
import {
  COMMIT_COPY,
  heardComment,
  insertAfterTempo,
  LISTEN_LABELS,
  restoreSound,
  soundChanges,
} from "./commit.ts";
import { isDescriptive } from "./descriptive.ts";

const V2 = [
  "setcpm(90/4)",
  'drums: s("bd hh sd hh")',
  'bass: note("c2 ~").s("ebass").lpf(600)',
  'mel: n("0 2").scale("C:minor")',
].join("\n");
const codeOf = (version: number): string | null => (version === 2 ? V2 : null);
const committed = [{ label: "bass", version: 2 }];
const withBass = (bass: string): string => V2.replace('bass: note("c2 ~").s("ebass").lpf(600)', bass);

describe("soundChanges", () => {
  test("notes only: nothing to ask", () => {
    expect(soundChanges(withBass('bass: note("c2 e2").s("ebass").lpf(600)'), committed, codeOf)).toEqual([]);
  });
  test("a changed sound link is listed", () => {
    expect(soundChanges(withBass('bass: note("c2 e2").s("ebass").lpf(900)'), committed, codeOf)).toEqual([
      { label: "bass", version: 2 },
    ]);
    expect(soundChanges(withBass('bass: note("c2 e2").s("upright").lpf(600)'), committed, codeOf)).toEqual([
      { label: "bass", version: 2 },
    ]);
    expect(
      soundChanges(withBass('bass: note("c2 e2").s("ebass").lpf(600).room(0.4)'), committed, codeOf),
    ).toEqual([{ label: "bass", version: 2 }]);
  });
  test("the mix is not the sound: a committed line's gain, velocity, postgain or pan may change without asking (W5 F3)", () => {
    const at = (bass: string) => withBass(bass);
    const v = withBass('bass: note("c2 ~").s("ebass").lpf(600).gain(.5)');
    const of = (n: number) => (n === 2 ? v : null);
    expect(soundChanges(at('bass: note("c2 ~").s("ebass").lpf(600).gain(.8)'), committed, of)).toEqual([]);
    expect(
      soundChanges(at('bass: note("c2 ~").s("ebass").lpf(600).gain(.5).pan(.2)'), committed, of),
    ).toEqual([]);
    expect(
      soundChanges(at('bass: note("c2 ~").s("ebass").lpf(600).velocity(.7).postgain(1.2)'), committed, of),
    ).toEqual([]);
    // A filter is still the sound: it asks.
    expect(soundChanges(at('bass: note("c2 ~").s("ebass").lpf(900).gain(.5)'), committed, of)).toEqual([
      { label: "bass", version: 2 },
    ]);
  });
  test("a label gone from either side is not listed", () => {
    expect(soundChanges(withBass("// no bass now"), committed, codeOf)).toEqual([]);
    expect(soundChanges(V2, [{ label: "chords", version: 2 }], codeOf)).toEqual([]);
    expect(
      soundChanges(withBass('bass: note("c2").s("upright")'), [{ label: "bass", version: 7 }], codeOf),
    ).toEqual([]);
  });
  test("a label committed twice counts once, at its last entry", () => {
    const v3 = withBass('bass: note("c2").s("ebass").lpf(900)');
    const twice = [
      { label: "bass", version: 2 },
      { label: "bass", version: 3 },
    ];
    const of = (v: number) => (v === 2 ? V2 : v === 3 ? v3 : null);
    expect(soundChanges(v3, twice, of)).toEqual([]);
  });
});

describe("restoreSound", () => {
  test("puts back the committed sound links; notes and every other line stay byte-identical", () => {
    const now = withBass('bass: note("c2 e2").s("ebass").lpf(900)');
    const back = restoreSound(now, "bass", V2);
    expect(back).toBe(withBass('bass: note("c2 e2").s("ebass").lpf(600)'));
    const before = now.split("\n");
    const after = back.split("\n");
    expect(after.length).toBe(before.length);
    for (let i = 0; i < before.length; i++) if (i !== 2) expect(after[i]).toBe(before[i] as string);
    expect(soundChanges(back, committed, codeOf)).toEqual([]);
  });
  test("a changed set of links: the committed ones replace them, non-sound links stay", () => {
    const now = withBass('bass: note("c2 e2").s("upright").struct("x ~ x x").room(0.5)');
    const back = restoreSound(now, "bass", V2);
    expect(back).toBe(withBass('bass: note("c2 e2").s("ebass").lpf(600).struct("x ~ x x")'));
    expect(soundChanges(back, committed, codeOf)).toEqual([]);
  });
  test("a chain written one link per line keeps its layout when only arguments change", () => {
    const then = 'bass: note("c2")\n  .s("ebass")\n  .lpf(600)';
    const now = '// mine\nbass: note("c2 g2")\n  .s("ebass")\n  .lpf(1200)\nmel: n("0")';
    expect(restoreSound(now, "bass", then)).toBe(
      '// mine\nbass: note("c2 g2")\n  .s("ebass")\n  .lpf(600)\nmel: n("0")',
    );
  });
  test("putting the sound back leaves the mix as it is now (W5 F3)", () => {
    const then = withBass('bass: note("c2 ~").s("ebass").lpf(600).gain(.5)');
    const now = withBass('bass: note("c2 e2").s("ebass").lpf(900).gain(.8).pan(.3)');
    expect(restoreSound(now, "bass", then)).toBe(
      withBass('bass: note("c2 e2").s("ebass").lpf(600).gain(.8).pan(.3)'),
    );
  });
  test("links added after commit are removed", () => {
    const now = withBass('bass: note("c2 e2").s("ebass").lpf(600)\n  .room(0.3)');
    expect(restoreSound(now, "bass", V2)).toBe(withBass('bass: note("c2 e2").s("ebass").lpf(600)'));
  });
  test("unknown label or a non-chain line: the code is unchanged", () => {
    expect(restoreSound(V2, "chords", V2)).toBe(V2);
    const odd = withBass("bass: stack(a, b)");
    expect(restoreSound(odd, "bass", "bass: x")).toBe(odd);
  });
});

describe("listen-through note", () => {
  test("heard comment goes right after the tempo line", () => {
    const line = heardComment("muffled", "  the kick  disappears ");
    expect(line).toBe("// heard (muffled): the kick disappears");
    expect(insertAfterTempo(V2, line, "setcpm(90/4)").split("\n").slice(0, 2)).toEqual([
      "setcpm(90/4)",
      line,
    ]);
    expect(insertAfterTempo('drums: s("bd")', line, null)).toBe(`${line}\ndrums: s("bd")`);
    expect(heardComment("small-speaker", "x")).toBe("// heard (small speaker): x");
  });
});

describe("copy", () => {
  test("every CommitGuard and SoundTools sentence is descriptive", () => {
    const strings = [
      COMMIT_COPY.changed("bass", 4),
      COMMIT_COPY.putBack,
      COMMIT_COPY.keep,
      COMMIT_COPY.commit("bass"),
      COMMIT_COPY.committed,
      COMMIT_COPY.uncommit,
      COMMIT_COPY.plainOn,
      COMMIT_COPY.plainSwitch,
      COMMIT_COPY.listenMenu,
      COMMIT_COPY.heardPrompt,
      COMMIT_COPY.heardAdd,
      COMMIT_COPY.notNow,
      COMMIT_COPY.noLine,
      ...Object.values(LISTEN_LABELS).map((m) => COMMIT_COPY.listenOn(m)),
    ];
    for (const s of strings) expect(isDescriptive(s)).toBe(true);
    expect(COMMIT_COPY.changed("bass", 4)).toBe("You changed the sound of bass, which you committed in v4.");
  });
});
