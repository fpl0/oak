// Where a part plays is said one way in both song sentences (`cellsSentence` on the song page and the Make line,
// `grewSentence` on the Coda and the lesson recap): a single-letter section is "section A" / "the A sections" with its
// capital kept, a named one is in sentence case ("the bridge"), and a repeated section is told apart (all of them, or
// the ones held by their bars). This walks every take lesson of every song in every style, before and after the
// learner has met the section names, and reads both sentences.
import { describe, expect, test } from "bun:test";
import type { FlavourId, UnitSongDef, UnitSongTake } from "@oak/api";
import { unitSongs } from "../../../content/unit-songs/index.ts";
import { songViewOf } from "./model.ts";
import { cellsHeldBy, cellsSentence, grewSentence, SONG_STYLES } from "./surfaces-model.ts";
import { testDetail, testTake } from "./test-song.ts";

const NO_TERMS = new Set<string>();
const ALL_TERMS = new Set(["term.form", "term.verse", "term.chorus", "term.bridge", "term.head"]);
const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** The takes of a whole song: one per take lesson, each holding every cell its step hands over. */
function takesOf(def: UnitSongDef): UnitSongTake[] {
  return def.plan.flatMap((step, i) =>
    step.kind === "take"
      ? [
          testTake(
            i + 1,
            step.lesson,
            "x",
            step.sections.flatMap((s) => step.parts.map((p) => `${p}@${s}`)),
          ),
        ]
      : [],
  );
}

/** What is wrong with how `sentence` says where `cells` sit; empty when nothing is. */
function problems(sentence: string, view: ReturnType<typeof songViewOf>, cells: readonly string[]): string[] {
  const out: string[] = [];
  if (/\bthe [a-z]\b|\b[a-z] sections?\b|\bsections? [a-z]\b/.test(sentence))
    out.push("a lower-cased letter");
  if (/\bin [A-Z]\b(?! sections)/.test(sentence)) out.push("a bare letter with no 'section'");
  const held = new Set(cells.map((c) => c.split("@")[1]));
  if (view.sections.every((s) => held.has(s.id))) return out;
  for (const label of new Set(view.sections.filter((s) => held.has(s.id)).map((s) => s.label))) {
    const all = view.sections.filter((s) => s.label === label);
    if (all.length === 1) continue;
    const mine = all.filter((s) => held.has(s.id));
    const said =
      mine.length === all.length
        ? sentence.includes(all.length === 2 ? "both " : `all ${COUNT_WORDS[all.length]} `)
        : mine.every((s) => new RegExp(`\\bbars? [^.;]*\\b${s.startBar + 1}\\b`).test(sentence));
    if (!said) out.push(`a repeated ${label} not told apart`);
  }
  return out;
}

describe("where a part plays, in both song sentences", () => {
  test("every take of every song, in every style, says its sections one way", () => {
    const bad: string[] = [];
    let read = 0;
    for (const def of unitSongs) {
      const takes = takesOf(def);
      for (const style of SONG_STYLES)
        for (const terms of [NO_TERMS, ALL_TERMS])
          takes.forEach((take, i) => {
            const detail = testDetail(takes.slice(0, i + 1), { flavour: style.id as FlavourId });
            const whole = testDetail(takes, { flavour: style.id as FlavourId });
            const view = songViewOf(def, detail, terms);
            // The cells right after the lesson (the Coda, the recap) and what is left of them once later takes
            // have taken some over (the song page's history).
            for (const [cells, v] of [
              [cellsHeldBy(def, detail, take.id), view],
              [cellsHeldBy(def, whole, take.id), songViewOf(def, whole, terms)],
            ] as const) {
              for (const sentence of [cellsSentence(v, cells), grewSentence(v, cells)]) {
                if (sentence === null) continue;
                read++;
                for (const p of problems(sentence, v, cells))
                  bad.push(`${def.unit} ${take.lessonId} ${style.name}: ${p}: "${sentence}"`);
              }
            }
          });
    }
    expect(read).toBeGreaterThan(1000);
    expect(bad).toEqual([]);
  });

  test("the review's cases read as sections", () => {
    const j1 = unitSongs.find((s) => s.unit === "J1") as UnitSongDef;
    const view = songViewOf(j1, null, ALL_TERMS);
    const a = view.sections.filter((s) => s.label === "A").map((s) => `chords@${s.id}`);
    expect(grewSentence(view, a)).toBe("The song now plays your chords in all three A sections.");
    expect(cellsSentence(view, a)).toBe("Chords in all three A sections");
    const bridges = view.sections.filter((s) => s.label === "Bridge");
    const two = bridges.slice(0, 2).map((s) => `chords@${s.id}`);
    const bars = bridges.slice(0, 2).map((s) => s.startBar + 1);
    expect(cellsSentence(view, two)).toBe(`Chords in the bridges at bars ${bars[0]} and ${bars[1]}`);
    const u09 = unitSongs.find((s) => s.unit === "U09") as UnitSongDef;
    const u09View = songViewOf(u09, null, ALL_TERMS);
    const ab = u09View.sections.filter((s) => s.label === "A" || s.label === "B").map((s) => `lead@${s.id}`);
    expect(grewSentence(u09View, ab)).toBe("The song now plays your melody in sections B and A.");
  });
});
