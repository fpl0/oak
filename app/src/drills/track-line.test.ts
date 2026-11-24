// The practice hub names an open track's next session in words, never by its id alone (UX review practice-8a).
import { expect, test } from "bun:test";
import { nextSessionLine } from "./track-line.ts";

test("a lesson: its title in quotes, without its id", () => {
  expect(
    nextSessionLine({ kind: "lesson", mapItemId: "J1.L01", title: "Swing Feel & the Ride" } as never),
  ).toBe("Next: “Swing Feel & the Ride”.");
});

test("a checkpoint: its title", () => {
  expect(
    nextSessionLine({ kind: "checkpoint", mapItemId: "J.CP1", title: "Jazz checkpoint 1" } as never),
  ).toBe("Next: “Jazz checkpoint 1”.");
});

test("a capstone session: the capstone's title (with its album track number) and the session in words", () => {
  expect(nextSessionLine({ kind: "capstone", mapItemId: "JC1.S2", title: "JC1 ii–V Ballad" } as never)).toBe(
    "Next: “JC1 ii–V Ballad”, session 2.",
  );
});

test("a title the server could not find (the bare id): the kind in words instead", () => {
  expect(nextSessionLine({ kind: "lesson", mapItemId: "R1.L01", title: "R1.L01" } as never)).toBe(
    "Next: the next lesson.",
  );
  expect(nextSessionLine({ kind: "capstone", mapItemId: "RC1.S1", title: "RC1.S1" } as never)).toBe(
    "Next: the track's capstone, session 1.",
  );
});
