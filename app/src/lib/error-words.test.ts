import { describe, expect, test } from "bun:test";
import { OakApiError } from "@oak/api";
import { SERVER_DOWN } from "../ui/kit/QueryState.tsx";
import { errorWords } from "./error-words.ts";

const DOWN = `${SERVER_DOWN.title}. Start Oak again (in a terminal: bun run start).`;

describe("errorWords: a failed action in the learner's words", () => {
  test("no answer, a dev proxy 502 or 504, or the browser's fetch TypeError: the server isn't answering", () => {
    expect(errorWords(new OakApiError("sketches.create", 0, "network", "x: could not be reached"))).toBe(
      DOWN,
    );
    expect(errorWords(new OakApiError("sketches.update", 502, "internal", "sketches.update: HTTP 502"))).toBe(
      DOWN,
    );
    expect(errorWords(new OakApiError("sketches.update", 504, "internal", "sketches.update: HTTP 504"))).toBe(
      DOWN,
    );
    expect(errorWords(new TypeError("Failed to fetch"))).toBe(DOWN);
    expect(errorWords(new TypeError("NetworkError when attempting to fetch resource."))).toBe(DOWN);
    expect(errorWords(new TypeError("Load failed"))).toBe(DOWN);
  });

  test("a validation message Oak's own API wrote stays as written, as a sentence", () => {
    expect(errorWords(new OakApiError("sketches.create", 400, "bad_request", "The title is too long"))).toBe(
      "The title is too long.",
    );
    expect(errorWords(new OakApiError("sketches.create", 409, "conflict", "That name is taken."))).toBe(
      "That name is taken.",
    );
  });

  test("the client's own status lines and raw exceptions never reach the learner", () => {
    const http = errorWords(new OakApiError("sketches.delete", 500, "internal", "sketches.delete: HTTP 500"));
    expect(http).toBe("Oak's server could not do it. Try again.");
    expect(
      errorWords(new OakApiError("x", 400, "bad_request", "x: the request does not match the contract")),
    ).toBe("Oak's server could not do it. Try again.");
    expect(errorWords(new Error("Cannot read properties of undefined (reading 'play')"))).toBe(
      "Something went wrong. Try again.",
    );
    expect(errorWords("boom")).toBe("Something went wrong. Try again.");
    for (const w of [http, errorWords(new TypeError("Failed to fetch"))]) {
      expect(w).not.toMatch(/HTTP \d|TypeError|Failed to fetch|sketches\./);
      expect(w).toMatch(/\.$/);
      // A failed save must not also say the work is saved.
      expect(w).not.toContain("is saved");
    }
  });

  test("codes describeError words have its sentence; an aborted request says so", () => {
    expect(errorWords(new OakApiError("x", 404, "not_found", "x: HTTP 404"))).toBe(
      "This item doesn't exist, or it was deleted.",
    );
    expect(errorWords(new OakApiError("x", 0, "aborted", "x: aborted"))).toBe(
      "It was stopped before it finished. Try again.",
    );
  });
});
