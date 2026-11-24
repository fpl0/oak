// "Your song grew" (the Coda and the lesson recap) says one thing in its sentence and its grid: a part the sentence
// says rests is not drawn as playing, and a part it says the song now plays is drawn as today's. This walks every take
// of all the songs, each take claiming its cells as the Make does (`claimsOf`: a take that plays chords also takes the
// pitched parts Oak does not keep, J1.L05's pad among them), once with the take playing every part its step names
// and once with the take leaving one of them out.
import { describe, expect, test } from "bun:test";
import { claimsOf, type SongPartId, type UnitSongDef, type UnitSongTake } from "@oak/api";
import { unitSongs } from "../../../content/unit-songs/index.ts";
import { songViewOf } from "./model.ts";
import { cellsHeldBy, grewSentence, grewView, partsPlayedByTake } from "./surfaces-model.ts";
import { testDetail, testTake } from "./test-song.ts";

/** The takes of a whole song, in plan order; `dropOne`: each take leaves out the last part its step names. */
function takesOf(def: UnitSongDef, dropOne: boolean): UnitSongTake[] {
  const out: UnitSongTake[] = [];
  for (const step of def.plan) {
    if (step.kind !== "take") continue;
    const parts = dropOne && step.parts.length > 1 ? step.parts.slice(0, -1) : [...step.parts];
    const roles = new Set(parts.map((p) => def.parts.find((x) => x.id === p)?.role));
    const playsChords = roles.has("chords") || roles.has("pad");
    const cells = claimsOf(def, step, { parts: new Set(parts), playsChords });
    const labels = Object.fromEntries(
      parts.map((p) => [def.parts.find((x) => x.id === p)?.label ?? p, p as string | null]),
    );
    out.push(testTake(out.length + 1, step.lesson, "x", cells, { labels }));
  }
  return out;
}

/** A part name inside a sentence, as `grewSentence` writes it. */
const inSentence = (name: string) =>
  /^[A-Z][a-z]/.test(name) ? name[0]?.toLowerCase() + name.slice(1) : name;

/** The parts each clause of a grew sentence names (longest names first, so a name inside another is not read twice). */
function saidParts(sentence: string, names: readonly { id: SongPartId; name: string }[]) {
  const tookOver = sentence.startsWith("Your code took over ");
  const [first = "", second = ""] = sentence.split("; ");
  let plays = tookOver ? "" : (first.split(" in ")[0] ?? "");
  let rests = tookOver ? (first.split(" in ")[0] ?? "") : second;
  const said = { plays: new Set<SongPartId>(), rests: new Set<SongPartId>() };
  for (const p of [...names].sort((a, b) => b.name.length - a.name.length)) {
    const n = inSentence(p.name);
    if (plays.includes(n)) {
      said.plays.add(p.id);
      plays = plays.replace(n, "");
    } else if (rests.includes(n)) {
      said.rests.add(p.id);
      rests = rests.replace(n, "");
    }
  }
  return said;
}

describe("Your song grew: the grid and the sentence agree", () => {
  test("every take of every song: a part said to rest is drawn resting, a part said to play is today's", () => {
    const bad: string[] = [];
    let read = 0;
    for (const def of unitSongs)
      for (const dropOne of [false, true]) {
        const takes = takesOf(def, dropOne);
        takes.forEach((take, i) => {
          const detail = testDetail(takes.slice(0, i + 1), { unitId: def.unit, flavour: "flavour.pop" });
          const view = songViewOf(def, detail, new Set());
          const held = cellsHeldBy(def, detail, take.id);
          const played = partsPlayedByTake(def, take);
          const sentence = grewSentence(view, held, played);
          if (!sentence) return;
          read++;
          const drawn = grewView(view, held, played).view;
          const heldParts = view.parts.filter((p) => held.some((k) => k.startsWith(`${p.id}@`)));
          const said = saidParts(sentence, heldParts);
          const where = `${take.lessonId}${dropOne ? " (one part left out)" : ""}`;
          for (const p of heldParts) {
            const cells = drawn.cells.filter(
              (c) => c.part === p.id && held.includes(`${c.part}@${c.section}`),
            );
            const today = cells.filter((c) => c.owner === "today").length;
            const resting = cells.filter((c) => c.owner === "oak" && c.rests).length;
            if (said.rests.has(p.id) && today > 0)
              bad.push(`${where}: ${p.name} said to rest, drawn as today's`);
            if (said.plays.has(p.id) && resting > 0)
              bad.push(`${where}: ${p.name} said to play, drawn resting`);
            if (said.plays.has(p.id) && today !== cells.length)
              bad.push(`${where}: ${p.name} said to play, not every block today's`);
            if (said.rests.has(p.id) && resting !== cells.length)
              bad.push(`${where}: ${p.name} said to rest, not every block resting`);
            if (!said.plays.has(p.id) && !said.rests.has(p.id))
              bad.push(`${where}: ${p.name} not in "${sentence}"`);
          }
        });
      }
    expect(bad).toEqual([]);
    expect(unitSongs.length).toBe(27);
    expect(read).toBeGreaterThan(100);
  });

  test("J1.L05: the chords comp the A sections; the pad rests there, drawn resting, not as today's", () => {
    const j1 = unitSongs.find((s) => s.unit === "J1") as UnitSongDef;
    const takes = takesOf(j1, false);
    const detail = testDetail(takes, { unitId: "J1", flavour: "flavour.pop" });
    const view = songViewOf(j1, detail, new Set());
    const mine = takes.at(-1) as UnitSongTake;
    const held = cellsHeldBy(j1, detail, mine.id);
    expect(held).toContain("pad@a1");
    const played = partsPlayedByTake(j1, mine);
    expect(grewSentence(view, held, played)).toBe(
      "The song now plays your chords in all three B sections; the pad rests there now.",
    );
    const { view: drawn, fresh } = grewView(view, held, played);
    const pad = drawn.cells.find((c) => c.part === "pad" && c.section === "a1");
    expect(pad).toMatchObject({ owner: "oak", rests: true });
    expect(fresh.has("pad@a1")).toBe(false);
    expect(drawn.cells.find((c) => c.part === "chords" && c.section === "a1")?.owner).toBe("today");
    expect(fresh.has("chords@a1")).toBe(true);
  });
});
