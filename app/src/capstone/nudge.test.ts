// Oak 2.0 W4 F2: when "Is it better, or just different?" is offered. Most cases pass a `classify` double, so they pin
// only the trigger around it: which passing draft, which window, which side is "1", and that a "Not now" holds. The
// last block runs X18's `classifyRecentEdits`, as the card does.
import { describe, expect, test } from "bun:test";
import type { CapstoneCheckHistoryEntry } from "@oak/api";
import { isDescriptive } from "../studio/descriptive.ts";
import { classifyRecentEdits } from "./edit-kind.ts";
import {
  blindOrder,
  type EditKind,
  type EditVersion,
  NUDGE_COPY,
  type NudgeInput,
  nudgeOf,
} from "./nudge.ts";

const SK = "sk_draft";
const V = (version: number, code: string) => ({ version, code, analysis: null });
const VERSIONS = [
  V(1, 'bass: note("c2 e2").s("ebass")'),
  V(2, 'bass: note("c2 g2").s("ebass").gain(0.8)'),
  V(3, 'bass: note("c2 g2").s("ebass").gain(0.7)'),
  V(4, 'bass: note("c2 g2").s("ebass").gain(0.75)'),
];
let nextId = 1;
const H = (sketchVersion: number, passed: boolean, sketchId = SK): CapstoneCheckHistoryEntry => ({
  id: nextId++,
  capstoneId: "C3",
  sessionId: null,
  sketchId,
  sketchVersion,
  passed,
  at: `2026-11-25T09:0${sketchVersion}:00.000Z`,
});

const input = (over: Partial<NudgeInput> = {}): NudgeInput => ({
  capstoneId: "C3",
  history: [H(1, false), H(2, true)],
  sketchId: SK,
  versions: VERSIONS,
  liveCode: (VERSIONS[3] as { code: string }).code,
  dismissed: new Set(),
  ...over,
});

/** A classifier double that records the window it was given. */
function spy(kind: EditKind) {
  const seen: (readonly EditVersion[])[] = [];
  const fn = (v: readonly EditVersion[]) => {
    seen.push(v);
    return kind;
  };
  return { fn, seen };
}

describe("nudgeOf", () => {
  test("no history, or only failing checks: no nudge", () => {
    expect(nudgeOf(input({ history: [] }), spy("tweaks").fn)).toBeNull();
    expect(nudgeOf(input({ history: [H(1, false), H(2, false), H(3, false)] }), spy("tweaks").fn)).toBeNull();
  });

  test("a passing check at v2, versions to v4, tweaks: earlier is v2, current v4", () => {
    const c = spy("tweaks");
    const n = nudgeOf(input(), c.fn);
    expect(n).toMatchObject({
      kind: "tweaks",
      earlier: { version: 2, code: VERSIONS[1]?.code },
      current: { version: 4, code: VERSIONS[3]?.code },
      seed: "C3:2:4",
    });
    expect(c.seen[0]?.map((v) => v.version)).toEqual([2, 3, 4]);
  });

  test("swing-back gives a swing-back nudge; changes gives none", () => {
    expect(nudgeOf(input(), spy("swing-back").fn)?.kind).toBe("swing-back");
    expect(nudgeOf(input(), spy("changes").fn)).toBeNull();
  });

  test("live code ahead of v4: current is the live code, the window ends with it", () => {
    const live = 'bass: note("c2 g2").s("ebass").gain(0.72)';
    const c = spy("tweaks");
    const n = nudgeOf(input({ liveCode: live }), c.fn);
    expect(n?.current).toEqual({ version: null, code: live });
    expect(n?.seed).toBe("C3:2:live");
    expect(c.seen[0]?.at(-1)).toEqual({ version: null, code: live, analysis: null });
    expect(c.seen[0]?.map((v) => v.version)).toEqual([2, 3, 4, null]);
  });

  test("live code equal to v4 but for whitespace and comments is not a live entry", () => {
    const c = spy("tweaks");
    const live = `// my bass\nbass:   note("c2 g2").s("ebass").gain(0.75)\n`;
    expect(nudgeOf(input({ liveCode: live }), c.fn)?.current.version).toBe(4);
    expect(c.seen[0]?.map((v) => v.version)).toEqual([2, 3, 4]);
  });

  test("the passing version dismissed: no nudge", () => {
    expect(nudgeOf(input({ dismissed: new Set([2]) }), spy("tweaks").fn)).toBeNull();
  });

  test("a newer passing check at v3, not dismissed, is the earlier draft", () => {
    const n = nudgeOf(
      input({ history: [H(2, true), H(3, true)], dismissed: new Set([2]) }),
      spy("tweaks").fn,
    );
    expect(n?.earlier.version).toBe(3);
  });

  test("dismissed stays dismissed: an older passing draft never comes back in its place", () => {
    // v3 was dismissed; v2 also passed. Dismissing v3 must not bring back a nudge against v2.
    expect(
      nudgeOf(input({ history: [H(2, true), H(3, true)], dismissed: new Set([3]) }), spy("tweaks").fn),
    ).toBeNull();
  });

  test("the passing version's code equal to the live code (whitespace aside): no nudge", () => {
    const live = `bass: note("c2 g2")\n  .s("ebass")\n  .gain(0.8)`;
    expect(nudgeOf(input({ liveCode: live }), spy("tweaks").fn)).toBeNull();
  });

  test("history of another sketch: no nudge", () => {
    expect(nudgeOf(input({ history: [H(2, true, "sk_other")] }), spy("tweaks").fn)).toBeNull();
  });

  test("a passing check of the newest version itself is not an earlier draft", () => {
    expect(nudgeOf(input({ history: [H(4, true)] }), spy("tweaks").fn)).toBeNull();
  });

  test("no saved draft yet: no nudge", () => {
    expect(nudgeOf(input({ sketchId: null }), spy("tweaks").fn)).toBeNull();
    expect(nudgeOf(input({ versions: [] }), spy("tweaks").fn)).toBeNull();
  });

  test("the nudge never counts versions: one tweak after the passing draft is enough", () => {
    const n = nudgeOf(input({ history: [H(3, true)] }), spy("tweaks").fn);
    expect(n?.earlier.version).toBe(3);
  });
});

describe("nudgeOf with X18's classifier", () => {
  const BASS = (notes: string, tail: string) => `bass: note("${notes}").s("ebass")${tail}`;
  const real = (
    versions: { version: number; code: string }[],
    history: CapstoneCheckHistoryEntry[],
    liveCode?: string,
  ) =>
    nudgeOf(
      input({
        versions: versions.map((v) => ({ ...v, analysis: null })),
        history,
        liveCode: liveCode ?? (versions.at(-1) as { code: string }).code,
      }),
      classifyRecentEdits,
    );

  test("only gain tweaks since the passing draft: a tweaks nudge", () => {
    expect(real(VERSIONS, [H(2, true)])?.kind).toBe("tweaks");
  });

  test("a structural edit before the passing draft does not count: only the window since it is read", () => {
    // v1 → v2 changes a note (structural); the check passed at v2; v3, v4 only change the gain.
    expect(real(VERSIONS, [H(1, true), H(2, true)])?.kind).toBe("tweaks");
  });

  test("a structural edit since the passing draft: no nudge", () => {
    const versions = [
      { version: 1, code: BASS("c2 e2", ".gain(0.8)") },
      { version: 2, code: BASS("c2 e2", ".gain(0.7)") },
      { version: 3, code: `${BASS("c2 e2", ".gain(0.7)")}\nchords: note("<c3 e3>")` },
      { version: 4, code: `${BASS("c2 e2", ".gain(0.6)")}\nchords: note("<c3 e3>")` },
    ];
    expect(real(versions, [H(1, true)])).toBeNull();
  });

  test("live code coming back to an earlier draft: a swing-back nudge against the live code", () => {
    const versions = [
      { version: 1, code: BASS("c2 e2", "") },
      { version: 2, code: BASS("c2 g2", "") },
      { version: 3, code: BASS("c2 a2", "") },
    ];
    const n = real(versions, [H(1, true)], BASS("c2 g2", ""));
    expect(n).toMatchObject({ kind: "swing-back", earlier: { version: 1 }, current: { version: null } });
  });
});

describe("blindOrder", () => {
  test("the same seed gives the same order", () => {
    expect(blindOrder("C3:2:4")).toEqual(blindOrder("C3:2:4"));
  });

  test("the earlier side is 1 for some seeds and 2 for others", () => {
    const seeds = Array.from({ length: 19 }, (_, i) => `C3:${i + 1}:${i + 2}`).concat("C3:20:live");
    const firsts = new Set(seeds.map((s) => blindOrder(s)[0]));
    expect(firsts).toEqual(new Set(["earlier", "current"]));
  });
});

describe("copy", () => {
  test("every nudge string is descriptive", () => {
    const strings = [
      ...Object.values(NUDGE_COPY).filter((v): v is string => typeof v === "string"),
      NUDGE_COPY.goBack(2),
      NUDGE_COPY.reveal(["earlier", "current"], 2),
      NUDGE_COPY.reveal(["current", "earlier"], 2),
    ];
    for (const s of strings) expect(isDescriptive(s)).toBe(true);
  });

  test("the reveal names the sides in blind order", () => {
    expect(NUDGE_COPY.reveal(["earlier", "current"], 2)).toBe(
      "1 was version 2, the draft you checked; 2 is your draft now.",
    );
    expect(NUDGE_COPY.reveal(["current", "earlier"], 5)).toBe(
      "1 is your draft now; 2 was version 5, the draft you checked.",
    );
  });
});
