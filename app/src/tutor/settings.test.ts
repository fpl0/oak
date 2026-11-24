import { describe, expect, test } from "bun:test";
import { mayHaveKey } from "./TutorSettings.tsx";

describe("Settings › Tutor: Remove saved key", () => {
  const api = (reason: string | null) => ({
    backends: [
      {
        id: "anthropic-api" as const,
        wired: true,
        ok: reason === null,
        active: false,
        reason,
        guidance: null,
        billing: "api" as const,
      },
    ],
  });

  test("offered only when the API backend may have a key", () => {
    expect(mayHaveKey(api(null))).toBe(true);
    expect(mayHaveKey(api("invalid_key"))).toBe(true);
    expect(mayHaveKey(api("unreachable"))).toBe(true);
    expect(mayHaveKey(api("missing_key"))).toBe(false);
    expect(mayHaveKey(api("not_installed"))).toBe(false);
    expect(mayHaveKey(undefined)).toBe(false);
    expect(mayHaveKey({ backends: [] })).toBe(false);
  });
});
