// The catalog's "†" (audibility still to be confirmed, contracts §3.2 rule 7) never reaches a learner's label.
import { describe, expect, test } from "bun:test";
import { toolbox } from "../../../content/toolbox.ts";
import { shownMeaning, shownToolLabel, shownToolMeaning } from "./label.ts";

describe("tool labels on the Toolbox", () => {
  test("no label a learner sees carries the catalog's †", () => {
    const marked = toolbox.filter((t) => t.code.includes("†"));
    expect(marked.length).toBeGreaterThan(0);
    for (const t of toolbox) expect(shownToolLabel(t).text, t.id).not.toContain("†");
    const partials = toolbox.find((t) => t.id === "tb.partials");
    expect(partials && shownToolLabel(partials).text).toBe(".partials([…])");
  });
});

describe("sounds on the Toolbox", () => {
  const of = (id: string) => {
    const t = toolbox.find((x) => x.id === id);
    if (!t) throw new Error(id);
    return t;
  };
  test("a sound is named by the code the learner types, never by a credit or a soundfont file", () => {
    expect(shownToolLabel(of("snd.ebass"))).toEqual({ text: '.s("ebass")', mono: true });
    expect(shownToolLabel(of("snd.rockkit")).text).toBe('.bank("rockkit")');
    expect(shownToolLabel(of("snd.drum.bd")).text).toBe('s("bd")');
    for (const t of toolbox.filter((x) => x.kind === "sound")) {
      expect(shownToolLabel(t).text, t.id).not.toContain("gm_");
      expect(shownToolLabel(t).text, t.id).not.toContain("CC");
    }
  });
  test("a sound's meaning drops its credit, licence and soundfont file name", () => {
    expect(shownMeaning(of("snd.ebass"))).toBe("Oak's ebass sound: a real bass guitar, picked.");
    expect(shownMeaning(of("snd.acgtr"))).toBe("Oak's acgtr sound.");
    for (const t of toolbox.filter((x) => x.kind === "sound")) {
      expect(shownMeaning(t), t.id).not.toContain("gm_");
      expect(shownMeaning(t), t.id).not.toMatch(/\([^()]*(CC0|CC BY)[^()]*\)/);
    }
    // Anything but a sound keeps its meaning as written.
    expect(shownMeaning(of("tb.gain"))).toBe(of("tb.gain").catalog.meaning);
  });
});

describe("templates on the Toolbox", () => {
  test("a Studio template says in one sentence what its song is, never that it is coming", () => {
    const rows = toolbox.filter(
      (t) => t.kind === "template" && t.id.startsWith("tb.template.") && !t.code.startsWith("recipe"),
    );
    expect(rows.length).toBe(4);
    for (const t of rows) {
      const m = shownToolMeaning(t);
      expect(m, t.id).not.toMatch(/coming soon|cannot be opened|released/i);
      expect(m.split(/\.\s/).length, t.id).toBe(1);
    }
    const pop = rows.find((t) => t.id === "tb.template.four-chord-pop");
    expect(pop && shownToolMeaning(pop)).toContain("I–V–vi–IV");
  });
});
