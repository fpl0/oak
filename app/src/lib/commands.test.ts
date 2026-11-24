import { describe, expect, test } from "bun:test";
import { type Command, commandSignature } from "./commands.ts";

const lens = (hint: string): Command => ({
  id: "lens:track:clave",
  title: "Clave lens",
  group: "Actions",
  hint,
  run() {},
});

describe("commandSignature", () => {
  test("a hint that changes under the same title changes the signature (the palette takes the new hint)", () => {
    // Before the syllabus loads the lesson title is unknown; after, the hint names it. The palette must update.
    expect(commandSignature([lens("Opens with R3.L02")])).not.toBe(
      commandSignature([lens("Opens with R3.L02 Clave Direction")]),
    );
  });

  test("a new array of the same commands keeps the signature (no store update on every render)", () => {
    expect(commandSignature([lens("Off · the clave's grid")])).toBe(
      commandSignature([lens("Off · the clave's grid")]),
    );
  });
});
