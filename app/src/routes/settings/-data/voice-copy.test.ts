import { expect, test } from "bun:test";
import { syllablesHelp } from "./voice-copy.ts";

test("the syllables lesson is named by its title while it is ahead, and dropped once done", () => {
  expect(syllablesHelp("Solfège", false)).toBe(
    "do re mi instead of numbers. Numbers are always accepted; syllables arrive with the lesson Solfège.",
  );
  expect(syllablesHelp("Solfège", true)).toBe("do re mi instead of numbers. Numbers are always accepted.");
  expect(syllablesHelp(null, false)).not.toContain("U03");
  expect(syllablesHelp("Solfège", null)).not.toContain("arrive");
});
