import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { createClient, OakApiError } from "@oak/api";
import { midisOf } from "@oak/grader/testing";
import { coverRings } from "../ui/AlbumCover.tsx";
import { describeError, SERVER_DOWN } from "../ui/kit/QueryState.tsx";
import { setApiClient } from "./api.ts";
import { type Command, groupInOrder, matchScore, rankCommands } from "./commands.ts";
import { accidentals, formatBytes, formatDuration, formatKey } from "./format.ts";
import { formatNoteMidi } from "./notes.ts";
import { shouldRetry } from "./query-client.ts";
import { routeOfItem, routeOfPlan } from "./session-route.ts";

setDefaultTimeout(30_000);

describe("command ranking", () => {
  const cmd = (title: string, keywords: string[] = []): Command => ({
    id: title,
    title,
    group: "Actions",
    keywords,
    run() {},
  });
  const cmds = [
    cmd("New sketch"),
    cmd("Go to Studio", ["sketchbook"]),
    cmd("Recalibrate mic", ["voice"]),
    cmd("Go to Today"),
  ];

  test("prefix beats word start beats subsequence", () => {
    expect(matchScore("new", "New sketch")).toBeGreaterThan(matchScore("sk", "New sketch"));
    expect(matchScore("sk", "New sketch")).toBeGreaterThan(matchScore("nsk", "New sketch"));
    expect(matchScore("xyz", "New sketch")).toBe(0);
  });

  test("keywords match, accents and ♭ are normalised", () => {
    expect(rankCommands("voice", cmds)[0]?.title).toBe("Recalibrate mic");
    expect(rankCommands("sketchbook", cmds)[0]?.title).toBe("Go to Studio");
    expect(matchScore("bb major", "B♭ major")).toBeGreaterThan(0);
  });

  test("empty query keeps the registry order", () => {
    expect(rankCommands("", cmds).map((c) => c.title)).toEqual(cmds.map((c) => c.title));
  });

  test("a scattered subsequence is dropped once a word or a run of letters matches", () => {
    const list = [cmd(".lpf(hz)"), cmd("Raise the Seventh"), cmd("Settings › Data", ["reset progress"])];
    expect(rankCommands("reset", list).map((c) => c.title)).toEqual(["Settings › Data"]);
    // With nothing better, an abbreviation still finds its command.
    expect(rankCommands("nwsk", cmds).map((c) => c.title)).toEqual(["New sketch"]);
  });

  test("a search-only command is found by typing, not listed in the empty palette", () => {
    const lens: Command = { ...cmd("Clave lens", ["lens"]), searchOnly: true };
    expect(rankCommands("", [...cmds, lens]).map((c) => c.title)).not.toContain("Clave lens");
    expect(rankCommands("clave", [...cmds, lens]).map((c) => c.title)).toEqual(["Clave lens"]);
  });

  test("each group is gathered where its best command stands, rank order kept inside it", () => {
    const g = (title: string, group: Command["group"]): Command => ({ ...cmd(title), group });
    const ranked = [g("a", "Lessons"), g("b", "Tools"), g("c", "Lessons"), g("d", "Songs"), g("e", "Tools")];
    expect(groupInOrder(ranked).map((c) => c.title)).toEqual(["a", "c", "b", "e", "d"]);
  });
});

describe("session routes (contracts §11.9)", () => {
  test("map items", () => {
    expect(routeOfItem("U01.L02")).toEqual({ to: "/learn/$lessonId", params: { lessonId: "U01.L02" } });
    expect(routeOfItem("U01.L02", "S5")).toEqual({
      to: "/learn/$lessonId",
      params: { lessonId: "U01.L02" },
      search: { step: "S5" },
    });
    // Core checkpoints drop `.CP` in the URL; track checkpoints keep the full ID.
    expect(routeOfItem("U07.CP")).toEqual({ to: "/checkpoint/$unitId", params: { unitId: "U07" } });
    expect(routeOfItem("J.CP1")).toEqual({ to: "/checkpoint/$unitId", params: { unitId: "J.CP1" } });
    expect(routeOfItem("C2")).toEqual({ to: "/capstone/$id", params: { id: "C2" } });
    expect(routeOfItem("C2.S2")).toEqual({ to: "/capstone/$id", params: { id: "C2" } });
    expect(routeOfItem("GYM.04")).toEqual({ to: "/transcribe" });
    expect(routeOfItem(null)).toEqual({ to: "/practice/review" });
  });

  test("plans", () => {
    expect(routeOfPlan({ kind: "review", mapItemId: null, main: null })).toEqual({ to: "/practice/review" });
    expect(routeOfPlan({ kind: "studio", mapItemId: null, main: null })).toEqual({ to: "/studio" });
    expect(
      routeOfPlan({
        kind: "light",
        mapItemId: "U03.L02",
        main: {
          resumeStep: null,
          splitPart: null,
          light: { lessonId: "U03.L01", constraint: "in minor" },
          estMinutes: 8,
        },
      }),
    ).toEqual({ to: "/learn/$lessonId", params: { lessonId: "U03.L01" } });
    expect(
      routeOfPlan({
        kind: "lesson",
        mapItemId: "U06.L04",
        main: { resumeStep: "S5", splitPart: null, light: null, estMinutes: 8 },
      }),
    ).toEqual({ to: "/learn/$lessonId", params: { lessonId: "U06.L04" }, search: { step: "S5" } });
  });
});

describe("music display", () => {
  test("note names match Strudel's pitches (MIDI 60 = C4, octave-less = octave 3)", async () => {
    // Golden facts first, then confirm Strudel 1.2.6 agrees on the MIDI numbers.
    expect(formatNoteMidi(60)).toBe("C4");
    expect(formatNoteMidi(69)).toBe("A4");
    expect(formatNoteMidi(48)).toBe("C3");
    expect(formatNoteMidi(70)).toBe("B♭4");
    expect(await midisOf('note("c4 a4 c bb4")')).toEqual([60, 69, 48, 70]);
  });

  test("keys, accidentals and durations", () => {
    expect(formatKey({ tonic: "Bb", mode: "major" })).toBe("B♭ major");
    expect(formatKey({ tonic: "F#", mode: "minor" })).toBe("F♯ minor");
    expect(accidentals("Eb4 C#3")).toBe("E♭4 C♯3");
    expect(formatDuration(125)).toBe("2:05");
    expect(formatBytes(52_428_800)).toBe("50 MB");
  });
});

describe("album covers", () => {
  test("deterministic per seed, different across seeds, inside the sleeve", () => {
    expect(coverRings("tr_1")).toEqual(coverRings("tr_1"));
    expect(coverRings("tr_1")).not.toEqual(coverRings("tr_2"));
    for (const r of coverRings("abc")) expect(r.r).toBeLessThanOrEqual(47);
  });
});

describe("API errors and retries", () => {
  test("no retry when retrying cannot help", () => {
    expect(shouldRetry(0, new OakApiError("health", 0, "network", "down"))).toBe(false);
    expect(shouldRetry(0, new OakApiError("sketches.get", 404, "not_found", "gone"))).toBe(false);
    expect(shouldRetry(0, new OakApiError("health", 500, "internal", "boom"))).toBe(true);
    expect(shouldRetry(2, new OakApiError("health", 500, "internal", "boom"))).toBe(false);
  });

  test("learner-facing copy, never a raw status", () => {
    expect(describeError(new OakApiError("health", 0, "network", "x")).title).toBe(
      "Oak's server isn't answering",
    );
    expect(describeError(new OakApiError("x", 200, "contract", "x")).title).toContain("disagree");
  });

  test("a server that is not there reads the same whether the fetch failed or the dev proxy answered for it", () => {
    for (const e of [
      new OakApiError("bootstrap", 0, "network", "x"),
      new OakApiError("bootstrap", 502, "internal", "bootstrap: HTTP 502"),
      new OakApiError("tutor.status", 504, "internal", "tutor.status: HTTP 504"),
    ])
      expect(describeError(e)).toEqual({ ...SERVER_DOWN });
    expect(SERVER_DOWN.body).not.toContain("bun run dev");
    expect(describeError(new OakApiError("x", 500, "internal", "boom")).title).toBe("Something went wrong");
  });

  test("callApi sends X-Oak and validates the response against the contract", async () => {
    const { callApi } = await import("./api.ts");
    const seen: Record<string, string>[] = [];
    setApiClient(
      createClient({
        fetch: async (_url, init) => {
          seen.push(init.headers as Record<string, string>);
          return new Response(JSON.stringify({ ok: true, appVersion: "1" }), { status: 200 });
        },
      }),
    );
    // A response missing required fields is a contract error, not data.
    const err = await callApi("health").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OakApiError);
    expect((err as OakApiError).code).toBe("contract");
    expect(seen[0]?.["X-Oak"]).toBe("1");
    setApiClient(createClient());
  });
});

describe("backup export (W7 gate: fetched with X-Oak, never a bare link)", () => {
  test("the file name comes from the server's content-disposition, else a dated .oakbackup", async () => {
    const { backupFileName } = await import("./queries.ts");
    expect(backupFileName('attachment; filename="oak-2026-11-15.oakbackup"')).toBe(
      "oak-2026-11-15.oakbackup",
    );
    expect(backupFileName(null, new Date("2026-01-02T10:00:00Z"))).toBe("oak-2026-01-02.oakbackup");
  });

  test("downloadBackup calls backup.export through the client, so X-Oak is sent", async () => {
    const seen: { url: string; xoak: string | null }[] = [];
    const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      seen.push({ url: String(input), xoak: h.get("X-Oak") });
      return new Response(new Uint8Array([80, 75]), {
        headers: {
          "content-type": "application/zip",
          "content-disposition": 'attachment; filename="b.oakbackup"',
        },
      });
    }) as typeof fetch;
    setApiClient(createClient({ fetch: fakeFetch }));
    const { downloadBackup } = await import("./queries.ts");
    const g = globalThis as unknown as { document?: unknown; URL: typeof URL };
    const clicks: string[] = [];
    const prevDoc = g.document;
    const prevCreate = URL.createObjectURL;
    g.document = {
      createElement: () => ({
        href: "",
        download: "",
        click() {
          clicks.push(this.download);
        },
        remove() {},
      }),
      body: { append() {} },
    };
    URL.createObjectURL = () => "blob:x";
    try {
      expect(await downloadBackup(false)).toBe("b.oakbackup");
    } finally {
      g.document = prevDoc;
      URL.createObjectURL = prevCreate;
      setApiClient(createClient());
    }
    expect(clicks).toEqual(["b.oakbackup"]);
    expect(seen[0]?.url).toContain("/api/backup/export?audio=0");
    expect(seen[0]?.xoak).toBe("1");
  });
});
