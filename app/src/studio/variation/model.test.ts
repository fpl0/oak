// Oak 2.0 W3 (PLAN §4 S5 siblings and generations): which version a kept sibling or generation names as its parent,
// and the sentences that describe a change. Studio describes, never scores (PLAN §2).
import { afterEach, describe, expect, test } from "bun:test";
import type { SketchLineage, SketchVersion } from "@oak/api";
import { isDescriptive } from "@oak/content-kit";
import { diffDimensions } from "@oak/grader";
import { strudel } from "../../../../packages/grader/src/analyze/__support__/fixtures.ts";
import { localChain } from "./lineage-queries.ts";
import {
  chainTip,
  changeLineReady,
  childFields,
  childrenOf,
  DIMENSION_NAMES,
  DIMENSION_WORDS,
  describeChange,
  generationsOnly,
  keepFields,
  readVariation,
  siblingsOf,
  undoNote,
  VARIATION_WORDS,
  type VariationDraft,
  writeVariation,
} from "./model.ts";

const v = (
  version: number,
  parentVersion: number | null = null,
  generation: number | null = null,
  note: string | null = null,
): SketchVersion => ({
  sketchId: "sk_1",
  version,
  code: 'drums: s("bd")',
  bpm: null,
  meter: "4/4",
  key: null,
  analysis: null,
  note,
  tutorAssisted: false,
  band: null,
  flags: { lockedTools: [], previewTools: [] },
  createdAt: "2026-11-25T10:00:00.000Z",
  takeState: null,
  parentVersion,
  generation,
  dimension: parentVersion === null ? null : "rhythm",
});
type LineageItem = SketchLineage["versions"][number];
const item = (version: number, generation: number | null, undoesGrandparent: boolean): LineageItem => ({
  version,
  parentVersion: version - 1,
  generation,
  dimension: "notes",
  takeState: null,
  undoesGrandparent,
  createdAt: "2026-11-25T10:00:00.000Z",
});

const strings = (o: object): string[] => Object.values(o).filter((w) => typeof w === "string");

describe("childFields", () => {
  test("a child of a version outside any chain is generation 1", () => {
    expect(childFields({ version: 4, generation: null }, "rhythm")).toEqual({
      parentVersion: 4,
      generation: 1,
      dimension: "rhythm",
    });
  });
  test("a child of generation 2 is generation 3", () => {
    expect(childFields({ version: 6, generation: 2 }, "sound").generation).toBe(3);
  });
});

describe("keepFields and chainTip", () => {
  test("keeping a generation after Runs names the chain's tip, not the last Run", () => {
    const versions = [v(1), v(2, 1, 1), v(3), v(4)];
    const draft: VariationDraft = { mode: "generation", parentVersion: 2, dimension: "notes" };
    expect(keepFields(draft, versions)).toEqual({ parentVersion: 2, generation: 2, dimension: "notes" });
    expect(chainTip(versions, 1)).toBe(2);
    expect(() => keepFields({ ...draft, parentVersion: 9 }, versions)).toThrow(RangeError);
  });
  test("the tip follows the chain to its newest child; a start with no child is its own tip", () => {
    const versions = [v(1), v(2, 1, 1), v(3), v(4, 2, 2), v(5), v(6, 4, 3), v(7)];
    expect(chainTip(versions, 1)).toBe(6);
    expect(chainTip(versions, 4)).toBe(6);
    expect(chainTip(versions, 7)).toBe(7);
  });
  test("a parent loop never hangs", () => {
    const versions = [v(1, 2, 1), v(2, 1, 1)];
    expect([1, 2]).toContain(chainTip(versions, 1));
    expect(chainTip(versions, 3)).toBe(3);
  });
  test("siblings are not part of a chain of generations", () => {
    const versions = [
      v(1),
      v(2, 1, 1, "Sibling: sound"),
      v(3, 1, 1, "Generation 1: notes"),
      v(4, 1, 1, "Sibling: form"),
    ];
    expect(generationsOnly(versions).map((x) => x.version)).toEqual([1, 3]);
    expect(chainTip(generationsOnly(versions), 1)).toBe(3);
    expect(siblingsOf(versions, 1).map((x) => x.version)).toEqual([2, 4]);
  });
  test("a sibling is generation 1 of its parent too", () => {
    const draft: VariationDraft = { mode: "sibling", parentVersion: 3, dimension: "sound" };
    expect(keepFields(draft, [v(1), v(2), v(3)])).toEqual({
      parentVersion: 3,
      generation: 1,
      dimension: "sound",
    });
  });
});

describe("childrenOf", () => {
  test("children of one parent, oldest first, never an ordinary Run", () => {
    const versions = [v(6), v(8, 6, 1), v(7, 6, 1), v(9), v(10, 7, 2)];
    expect(childrenOf(versions, 6).map((x) => x.version)).toEqual([7, 8]);
  });
});

describe("describeChange only describes", () => {
  test("the three sentences", () => {
    expect(describeChange("rhythm", ["rhythm"])).toBe("You changed the rhythm.");
    expect(describeChange("rhythm", ["sound", "rhythm"])).toBe(
      "You picked the rhythm. What changed: the sound and the rhythm.",
    );
    expect(describeChange("notes", [])).toBe("Nothing has changed against its parent yet.");
    expect(describeChange("form", ["sound", "rhythm", "notes"])).toBe(
      "You picked the form. What changed: the sound, the rhythm and the notes of a part.",
    );
  });
  test("from two real pieces", async () => {
    const bass = '\nbass: note("c2 ~ g1 ~").s("ebass")';
    const a = `drums: s("bd ~ sd ~")${bass}`;
    const b = `drums: s("bd bd sd ~")${bass}`;
    const changed = diffDimensions({ n: await strudel(a, 1), code: a }, { n: await strudel(b, 1), code: b });
    expect(changed).toEqual(["rhythm"]);
    expect(describeChange("rhythm", changed)).toBe("You changed the rhythm.");
  });
});

describe("localChain", () => {
  test("the chain from the sketch's own versions, first to last, Runs in between left out", () => {
    const versions = [v(1), v(2, 1, 1), v(3), v(4, 2, 2), v(5)];
    expect(localChain(versions, 4).map((x) => x.version)).toEqual([1, 2, 4]);
    expect(localChain(versions, 9)).toEqual([]);
  });
});

describe("undoNote", () => {
  test("a child that changes back what its parent changed", () => {
    expect(undoNote(item(5, 3, true), item(4, 2, false))).toBe(
      "Generation 3 changes back what generation 2 changed.",
    );
  });
  test("null otherwise", () => {
    expect(undoNote(item(5, 3, false), item(4, 2, false))).toBeNull();
    expect(undoNote(item(5, 3, true), item(4, null, false))).toBeNull();
    expect(undoNote(item(5, 3, true), undefined)).toBeNull();
  });
});

describe("the draft in this browser's session", () => {
  const EMPTY = { draft: null, chainStart: null, siblingParent: null };
  const store = new Map<string, string>();
  const fake = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, val: string) => void store.set(k, val),
    removeItem: (k: string) => void store.delete(k),
  };
  const g = globalThis as { sessionStorage?: unknown };
  const before = g.sessionStorage;
  afterEach(() => {
    g.sessionStorage = before;
    store.clear();
  });
  test("kept per sketch under oak.variation.<id>; a bad value reads as nothing", () => {
    g.sessionStorage = fake;
    const draft: VariationDraft = { mode: "sibling", parentVersion: 3, dimension: "sound" };
    writeVariation("sk_1", { draft, chainStart: 2, siblingParent: 3 });
    expect(store.has("oak.variation.sk_1")).toBe(true);
    expect(readVariation("sk_1")).toEqual({ draft, chainStart: 2, siblingParent: 3 });
    expect(readVariation("sk_2")).toEqual(EMPTY);
    store.set("oak.variation.sk_3", '{"draft":{"mode":"other"}}');
    expect(readVariation("sk_3")).toEqual(EMPTY);
    store.set("oak.variation.sk_4", "not json");
    expect(readVariation("sk_4")).toEqual(EMPTY);
    writeVariation("sk_1", EMPTY);
    expect(store.has("oak.variation.sk_1")).toBe(false);
  });
  test("no storage at all is no draft", () => {
    g.sessionStorage = undefined;
    expect(readVariation("sk_1")).toEqual(EMPTY);
    expect(() => writeVariation("sk_1", { ...EMPTY, chainStart: 1 })).not.toThrow();
  });
});

describe("every note only describes", () => {
  test("the words", () => {
    const all: string[] = [
      ...Object.values(DIMENSION_WORDS),
      ...strings(VARIATION_WORDS),
      VARIATION_WORDS.keepGeneration(3),
      VARIATION_WORDS.generationNote(2, "rhythm"),
      VARIATION_WORDS.siblingNote("sound"),
      VARIATION_WORDS.chainRow(2, "rhythm"),
      VARIATION_WORDS.siblingRow(1, "notes"),
      VARIATION_WORDS.changing("rhythm"),
      VARIATION_WORDS.parentOf(3),
      VARIATION_WORDS.startOf(1),
      VARIATION_WORDS.chainRow(1, null),
    ];
    for (const text of all) expect(isDescriptive(text)).toBe(true);
  });
});

test("X24 AC1: changeLineReady needs both versions", () => {
  expect(changeLineReady(new Set([1, 2]), 1, 2)).toBe(true);
  expect(changeLineReady(new Set([1]), 1, 2)).toBe(false);
  expect(changeLineReady(new Set([2]), 1, 2)).toBe(false);
  expect(changeLineReady(new Set(), 1, 2)).toBe(false);
  expect(changeLineReady(new Set([1, 2, 3]), 1, 3)).toBe(true);
});
test("X24 AC23: notes name a part without changing the button or stored note", () => {
  expect(describeChange("notes", ["notes"])).toBe("You changed the notes of a part.");
  expect(isDescriptive(describeChange("notes", ["notes"]))).toBe(true);
  expect(VARIATION_WORDS.siblingRow(1, "notes")).toBe("Sibling 1, picked the notes of a part");
  expect(VARIATION_WORDS.changing("notes")).toBe("Changing the notes of a part.");
  expect(DIMENSION_NAMES.notes).toBe("Notes");
  expect(VARIATION_WORDS.siblingNote("notes")).toBe("Sibling: notes");
});
