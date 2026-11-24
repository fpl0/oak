// The "Listen for" line of every listening block (listen-for.ts): one for every family a learner can hear in a
// warm-up or Practice, in Oak's voice (AUTHORING §5), and in words the learner has by the family's unlock lesson
// (AUTHORING §7, §21.1): no term a later lesson introduces.
import { describe, expect, test } from "bun:test";
import { families } from "../../../content/families.ts";
import { defaultOrder } from "../../../content/syllabus.ts";
import { terms } from "../../../content/terms.ts";
import { exampleNoun, listenExampleLines, listenFor } from "./listen-for.ts";

const BANNED =
  /!|\bsimply\b|\bobviously\b|\beas(y|ily)\b|\blet['’]s\b|\byou should\b|\bawesome\b|\bamazing\b|\bjourney\b|\bmagic/i;
const order = defaultOrder as readonly string[];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Terms whose lesson comes after `lesson` in the default order (a track lesson: every core term is known). */
function laterTerms(lesson: string) {
  const here = order.indexOf(lesson);
  return here < 0 ? [] : terms.filter((t) => order.indexOf(t.introducedBy) > here);
}
const heard = families.filter((f) => f.kind !== "concept" && !f.id.startsWith("fam.mix."));

describe("listenFor", () => {
  test("every family a learner can listen to has its own line", () => {
    const generic = listenFor(undefined);
    for (const f of heard) {
      const line = listenFor(f);
      expect({ id: f.id, own: line !== generic && line.length > 40 }).toEqual({ id: f.id, own: true });
    }
  });

  test("each line keeps Oak's voice and stays short", () => {
    for (const f of families) {
      const line = listenFor(f);
      expect({ id: f.id, banned: BANNED.test(line) }).toEqual({ id: f.id, banned: false });
      expect({ id: f.id, words: line.split(/\s+/).length <= 40 }).toEqual({ id: f.id, words: true });
    }
  });

  test("no line uses a term before the lesson that introduces it", () => {
    for (const f of heard) {
      const line = listenFor(f);
      const early = laterTerms(f.unlock.lesson)
        .filter((t) =>
          new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(t.term)}(s|es)?(?![\\p{L}\\p{N}])`, "iu").test(line),
        )
        .map((t) => `${t.term} (${t.introducedBy})`);
      expect({ id: f.id, unlock: f.unlock.lesson, early }).toEqual({
        id: f.id,
        unlock: f.unlock.lesson,
        early: [],
      });
    }
  });

  test("a block of one repeated kind numbers its examples by what they are", () => {
    expect(exampleNoun("fam.pit.match")).toBe("Note");
    expect(exampleNoun("fam.rhy.pulse")).toBe("Example");
  });
});

describe("listenExampleLines", () => {
  test("a function block names each example's function, never its letters (UX review round 2)", () => {
    const gen = families.find((f) => f.id === "fam.har.function")?.generator;
    expect(listenExampleLines(["T", "PD", "D"], "fam.har.function", gen)).toEqual([
      "1. Tonic",
      "2. Predominant",
      "3. Dominant",
    ]);
  });
  test("one category heard every time is numbered instead", () => {
    expect(listenExampleLines(["match", "match"], "fam.pit.match")).toEqual(["Note 1", "Note 2"]);
    expect(listenExampleLines(["deg.5"], "fam.deg.fet-major")).toEqual(["1. Degree 5"]);
  });
});
