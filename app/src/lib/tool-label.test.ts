import { describe, expect, test } from "bun:test";
import { toolbox } from "../../../content/toolbox.ts";
import { toolLabel, toolName } from "./tool-label.ts";

const of = (id: string) => {
  const t = toolbox.find((x) => x.id === id);
  if (!t) throw new Error(id);
  return toolLabel(t);
};

describe("toolLabel", () => {
  test("features drop the contract's editorial notes", () => {
    expect(of("tb.feature.band")).toEqual({ text: "Band layer", mono: false });
    expect(of("tb.feature.tuner")).toEqual({ text: "Sing panel", mono: false });
    expect(of("tb.feature.studio")).toEqual({ text: "Studio", mono: false });
    expect(of("tb.feature.transport")).toEqual({ text: "Play / Stop / Run", mono: false });
    expect(of("tb.feature.roll")).toEqual({ text: "Piano roll and drum lanes", mono: false });
  });
  test("a code row described in prose shows its signature", () => {
    expect(of("tb.label")).toEqual({ text: "label: pattern", mono: true });
    expect(of("tb.mini.seq")).toEqual({ text: '"a b c d"', mono: true });
    expect(of("tb.meter.3-4").text).toBe("setcpm(bpm/3)");
  });
  test("code rows keep their code", () => {
    expect(of("tb.setcpm")).toEqual({ text: "setcpm(bpm/4)", mono: true });
    expect(of("tb.gain")).toEqual({ text: ".gain(x)", mono: true });
    expect(of("tb.s").text).toBe('s("…") / sound("…")');
    expect(of("tb.mini.alt").text).toBe("<a b>");
  });
  test("a recipe template is its code, whole, without the registry's word 'recipe'", () => {
    expect(of("tb.template.synthbass")).toEqual({ text: 'note("…").s("sawtooth").lpf(600)', mono: true });
  });
  test("no label is empty or carries a parenthetical note", () => {
    for (const t of toolbox) {
      const l = toolLabel(t);
      expect(l.text.length).toBeGreaterThan(0);
      if (!l.mono) expect(l.text).not.toMatch(/\)$/);
    }
  });
});

describe("toolName (Today, the Coda, the ceremony)", () => {
  test("a sound is the code the learner types, a scale row its name, anything else its label", () => {
    expect(toolName({ kind: "sound", code: "ebass (gm_electric_bass_pick:0)" } as never)).toEqual({
      text: '.s("ebass")',
      mono: true,
    });
    expect(toolName({ kind: "scale", code: "X4:major" } as never)).toEqual({
      text: "the major scale",
      mono: false,
    });
    // A colon inside the scale's name reads in words (Wave 5: harmonic and melodic minor, the pentatonics).
    expect(toolName({ kind: "scale", code: "X4:harmonic:minor" } as never)).toEqual({
      text: "the harmonic minor scale",
      mono: false,
    });
    expect(toolName({ kind: "code", code: ".lpf()" } as never)).toEqual(
      toolLabel({ kind: "code", code: ".lpf()" } as never),
    );
  });
});
