import { describe, expect, test } from "bun:test";
import { describeError, SERVER_DOWN } from "../ui/kit/QueryState.tsx";
import { fetchPackJson } from "./sound-credits.ts";

const answering = (status: number) => (async () => new Response("{}", { status })) as unknown as typeof fetch;
const failing = (async () => {
  throw new TypeError("Failed to fetch");
}) as unknown as typeof fetch;

async function wording(fetcher: typeof fetch) {
  try {
    await fetchPackJson("/sounds/manifest.json", fetcher);
  } catch (e) {
    return describeError(e);
  }
  throw new Error("expected a failure");
}

describe("sound credits while the server is down", () => {
  test("no answer, a 502 and a 504 read as the server not answering, never a raw error", async () => {
    expect(await wording(failing)).toEqual({ ...SERVER_DOWN });
    expect(await wording(answering(502))).toEqual({ ...SERVER_DOWN });
    expect(await wording(answering(504))).toEqual({ ...SERVER_DOWN });
  });

  test("another failure says the credits could not be read, with no status line", async () => {
    const w = await wording(answering(500));
    expect(w.body).toBe("The sound pack's credits could not be read.");
    expect(w.body).not.toMatch(/\d{3}|Error/);
  });
});
