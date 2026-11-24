// A take that did not reach the server is posted again with the same body (and idempotency key) after a transient
// failure, and never after an answer that says the take is wrong.
import { describe, expect, test } from "bun:test";
import { OakApiError } from "@oak/api";
import { isTransientTakeError, retryTakePost } from "./song-make.ts";

const noWait = async () => {};

describe("a take that did not reach the server", () => {
  test("is posted again after a transient failure until it lands", async () => {
    const sent: number[] = [];
    let fails = 2;
    const ok = await retryTakePost(
      async () => {
        sent.push(sent.length);
        if (fails-- > 0) throw new OakApiError("songs.recordTake", 0, "network", "no answer");
      },
      { delaysMs: [1, 1, 1], wait: noWait },
    );
    expect(ok).toBe(true);
    expect(sent).toHaveLength(3);
  });

  test("gives up after its tries, and at once on an answer that says the take is wrong", async () => {
    let posts = 0;
    expect(
      await retryTakePost(
        async () => {
          posts++;
          throw new OakApiError("songs.recordTake", 503, "internal", "busy");
        },
        { delaysMs: [1, 1], wait: noWait },
      ),
    ).toBe(false);
    expect(posts).toBe(2);
    posts = 0;
    expect(
      await retryTakePost(
        async () => {
          posts++;
          throw new OakApiError("songs.recordTake", 409, "conflict", "not a take step");
        },
        { delaysMs: [1, 1], wait: noWait },
      ),
    ).toBe(false);
    expect(posts).toBe(1);
  });

  test("transient: no answer, a server error, a thrown non-API error; not: 400, 404, 409", () => {
    expect(isTransientTakeError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isTransientTakeError(new OakApiError("x", 0, "network", "down"))).toBe(true);
    expect(isTransientTakeError(new OakApiError("x", 500, "internal", "boom"))).toBe(true);
    expect(isTransientTakeError(new OakApiError("x", 400, "bad_request", "bad"))).toBe(false);
    expect(isTransientTakeError(new OakApiError("x", 404, "not_found", "gone"))).toBe(false);
    expect(isTransientTakeError(new OakApiError("x", 409, "conflict", "no"))).toBe(false);
  });
});
