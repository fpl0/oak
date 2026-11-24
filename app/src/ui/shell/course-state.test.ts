import { describe, expect, test } from "bun:test";
import type { CoreCompletion, CourseProgress, TrackState } from "@oak/api";
import type { SyllabusDef } from "@oak/content-kit";
import { syllabus } from "../../../../content/syllabus.ts";
import { NAV_ITEMS, SETTINGS_SECTIONS } from "../../lib/nav.ts";
import { CORE_SECTIONS } from "../keys/sheet.ts";
import {
  FINISHED_WORDS,
  lessonWritten,
  oakNavLabel,
  oakTracksNote,
  openCommands,
  shellTracks,
  trackHint,
  trackOfLesson,
  trackSessionTarget,
  tracksListedOpen,
  unwrittenHint,
} from "./course-state.ts";
import { NAV_GATES } from "./nav-state.ts";

const S = syllabus as unknown as SyllabusDef;

type P = Pick<CourseProgress, "lessons" | "checkpoints" | "tracks" | "core">;
const lesson = (lessonId: string, status: "completed" | "available") =>
  ({ lessonId, status }) as unknown as CourseProgress["lessons"][number];
const cp = (cpId: string, status: "passed" | "soft-passed" | "open" | "failed") =>
  ({ cpId, status }) as unknown as CourseProgress["checkpoints"][number];
const track = (
  trackId: "J" | "R" | "A",
  status: "locked" | "open",
  note: string,
  next: string | null = null,
): TrackState => ({
  trackId,
  title: { J: "Jazz Harmony", R: "Advanced Rhythm", A: "Arrangement & Sound" }[trackId],
  status,
  openedAt: status === "open" ? "2026-11-13T10:00:00.000Z" : null,
  gates: [],
  sessionsDone: 0,
  sessionsTotal: 34,
  next,
  note,
});

describe("the advanced tracks in the shell", () => {
  test("nothing is claimed before the course progress has loaded", () => {
    expect(shellTracks(undefined)).toEqual([]);
    expect(shellTracks(null)).toEqual([]);
    expect(oakNavLabel("The Oak", [])).toBe("The Oak");
  });

  test("the server's track states are used as they are, in the order J, R, A", () => {
    const p: P = {
      lessons: [],
      checkpoints: [],
      tracks: [
        track("A", "open", "Next: A1.L02 Filters.", "A1.L02"),
        track("J", "open", "Open. Its first lessons are still being written."),
        track("R", "open", "Open. Its first lessons are still being written."),
      ],
    };
    const t = shellTracks(p, S);
    expect(t.map((x) => [x.trackId, x.state, x.next])).toEqual([
      ["J", "open", null],
      ["R", "open", null],
      ["A", "ready", "A1.L02"],
    ]);
    // The rail names Jazz and Rhythm only, and says honestly that nothing can be started yet.
    expect(oakNavLabel("The Oak", t)).toBe(
      "The Oak: Jazz Harmony and Advanced Rhythm are open, their first lessons still being written",
    );
    expect(trackHint(t[0] as (typeof t)[number])).toBe(
      "Advanced track · open · its first lessons are still being written",
    );
    expect(trackHint(t[2] as (typeof t)[number])).toBe("Advanced track · open · next: A1.L02 Filters");
  });

  test("before U13.CP both are locked and the rail says nothing; the palette says what opens them", () => {
    const p: P = {
      lessons: [lesson("U03.L02", "completed")],
      checkpoints: [cp("U13.CP", "open")],
      tracks: [
        track("J", "locked", "Opens with the unit 13 checkpoint."),
        track("R", "locked", "Opens with the unit 13 checkpoint."),
        track("A", "open", "Its side lessons are open. The rest is still being written."),
      ],
    };
    const t = shellTracks(p, S);
    expect(oakTracksNote(t)).toBeNull();
    expect(trackHint(t[0] as (typeof t)[number])).toBe("Advanced track · opens with the unit 13 checkpoint");
  });

  test("one track open reads in the singular; a track with a lesson to start is named with it", () => {
    expect(
      oakTracksNote(
        shellTracks({
          lessons: [],
          checkpoints: [],
          tracks: [
            track("J", "open", "Open. Its first lessons are still being written."),
            track("R", "locked", "Opens with the unit 13 checkpoint."),
          ],
        }),
      ),
    ).toBe("Jazz Harmony is open, its first lessons still being written");
    expect(
      oakTracksNote(
        shellTracks({
          lessons: [],
          checkpoints: [],
          tracks: [
            track("J", "open", "Next: J1.L01 Swing Feel & the Ride.", "J1.L01"),
            track("R", "open", "Open. Its first lessons are still being written."),
          ],
        }),
      ),
    ).toBe("Jazz Harmony: next J1.L01");
  });

  test("from a server that does not send tracks yet, the same gates are read from the course progress", () => {
    const before: P = { lessons: [lesson("U03.L02", "available")], checkpoints: [cp("U13.CP", "open")] };
    expect(shellTracks(before, S).map((t) => [t.trackId, t.state, t.note])).toEqual([
      ["J", "locked", "Opens with the unit 13 checkpoint."],
      ["R", "locked", "Opens with the unit 13 checkpoint."],
      [
        "A",
        "locked",
        `Opens after ${S.units.flatMap((u) => u.lessons).find((l) => l.id === "U03.L02")?.title}.`,
      ],
    ]);
    // A soft pass opens the gate as a pass does (contracts §4.3); a failed attempt does not.
    for (const status of ["passed", "soft-passed"] as const) {
      const after: P = { lessons: [lesson("U03.L02", "completed")], checkpoints: [cp("U13.CP", status)] };
      expect(shellTracks(after, S).map((t) => [t.trackId, t.state, t.note])).toEqual([
        ["J", "open", "Open. Its first lessons are still being written."],
        ["R", "open", "Open. Its first lessons are still being written."],
        ["A", "open", "Its side lessons are open. The rest is still being written."],
      ]);
    }
    const failed: P = { lessons: [], checkpoints: [cp("U13.CP", "failed")] };
    expect(shellTracks(failed, S)[0]?.state).toBe("locked");
    // The fallback never invents a lesson to start.
    expect(
      shellTracks({ lessons: [], checkpoints: [cp("U13.CP", "passed")] }, S).every((t) => t.next === null),
    ).toBe(true);
  });
});

describe("lessons nobody has written yet", () => {
  const authored = new Set(["U12.L01", "A1.L01"]);

  test("a track lesson and a core lesson each say so; a written lesson and an unknown bundle say nothing", () => {
    expect(trackOfLesson("J1.L01")).toBe("J");
    expect(trackOfLesson("R2.L03")).toBe("R");
    expect(trackOfLesson("A1.L01")).toBe("A");
    expect(trackOfLesson("U12.L01")).toBeNull();
    expect(unwrittenHint("J1.L01", authored)).toBe("Jazz Harmony · still being written");
    expect(unwrittenHint("R1.L01", authored)).toBe("Advanced Rhythm · still being written");
    expect(unwrittenHint("A2.L01", authored)).toBe("Arrangement & Sound · still being written");
    expect(unwrittenHint("U17.L04", authored)).toBe("Still being written");
    expect(unwrittenHint("U12.L01", authored)).toBeNull();
    expect(unwrittenHint("A1.L01", authored)).toBeNull();
    // Built from the registries (no lesson files at all): nothing is judged unwritten.
    expect(lessonWritten("J1.L01", new Set())).toBe(true);
    expect(unwrittenHint("J1.L01", new Set())).toBeNull();
  });

  test("every J and R lesson of the syllabus has a track to be named with", () => {
    const ids = S.units
      .flatMap((u) => u.lessons.map((l) => l.id as string))
      .filter((id) => /^[JR]\d/.test(id));
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) expect(trackOfLesson(id)).not.toBeNull();
  });
});

describe("after the core", () => {
  const open: CoreCompletion["open"] = [
    { kind: "review", id: null, title: "Reviews", note: "14 due. They keep the Oak green.", available: true },
    {
      kind: "gym",
      id: null,
      title: "Transcription Gym",
      note: "Ladder level 8: Ain't She Sweet, form to tune. Every fifth session, or any day from Today.",
      available: true,
    },
    {
      kind: "studio",
      id: null,
      title: "Studio",
      note: "Your sketchbook. Start the next song.",
      available: true,
    },
    {
      kind: "side-lesson",
      id: "A1.L03",
      title: "Side lessons: sound",
      note: "Envelopes is next, about 15 minutes.",
      available: true,
    },
    {
      kind: "track",
      id: "J",
      title: "Jazz Harmony",
      note: "Open. Its first lessons are still being written.",
      available: false,
    },
    {
      kind: "track",
      id: "R",
      title: "Advanced Rhythm",
      note: "Open. Its first lessons are still being written.",
      available: false,
    },
  ];

  test("what stays open becomes commands in the server's order, each leading somewhere real", () => {
    const c = openCommands(open);
    expect(c.map((x) => x.title)).toEqual([
      "Reviews",
      "Transcription Gym",
      "Studio",
      "Side lessons: sound",
      "Jazz Harmony",
      "Advanced Rhythm",
    ]);
    expect(c.map((x) => x.to)).toEqual([
      { kind: "path", path: "/practice/review" },
      { kind: "path", path: "/transcribe" },
      { kind: "path", path: "/studio" },
      { kind: "lesson", lessonId: "A1.L03" },
      { kind: "path", path: "/oak" },
      { kind: "path", path: "/oak" },
    ]);
    // A track with nothing to start is never a way into a lesson, and its hint says "not yet".
    expect(c[0]?.hint).toBe("Open to you · 14 due. They keep the Oak green.");
    expect(c[4]?.hint).toBe("Open, nothing to start yet · its first lessons are still being written.");
    // The palette shows each track once: the ones this list names are not listed again as plain tracks.
    expect([...tracksListedOpen(open)].sort()).toEqual(["J", "R"]);
    expect(new Set(c.map((x) => x.id)).size).toBe(c.length);
  });

  test("Wave 7: a track with a lesson to start leads to it and is listed once", () => {
    const withLesson: CoreCompletion["open"] = [
      {
        kind: "track",
        id: "J1.L01",
        title: "Jazz Harmony",
        note: "Next: J1.L01 Swing Feel & the Ride.",
        available: true,
      },
      {
        kind: "track",
        id: "R",
        title: "Advanced Rhythm",
        note: "Open. Its next lessons are still being written.",
        available: false,
      },
    ];
    const c = openCommands(withLesson);
    expect(c.map((x) => x.to)).toEqual([
      { kind: "lesson", lessonId: "J1.L01" },
      { kind: "path", path: "/oak" },
    ]);
    expect(c[0]?.hint).toBe("Open to you · Next: J1.L01 Swing Feel & the Ride.");
    expect([...tracksListedOpen(withLesson)].sort()).toEqual(["J", "R"]);
  });

  test("a track with a next lesson leads to it; a capstone left to release opens its workspace", () => {
    const c = openCommands([
      {
        kind: "track",
        id: "J1.L01",
        title: "Jazz Harmony",
        note: "Next: J1.L01 Swing Feel & the Ride.",
        available: true,
      },
      { kind: "capstone", id: "X1", title: "Folk Transcription", note: "Left to release.", available: true },
      { kind: "track", id: "J1.L01", title: "Jazz Harmony", note: "Later.", available: false },
    ]);
    expect(c[0]?.to).toEqual({ kind: "lesson", lessonId: "J1.L01" });
    expect(c[1]?.to).toEqual({ kind: "capstone", capstoneId: "X1" });
    // Not available wins over a lesson-shaped id.
    expect(c[2]?.to).toEqual({ kind: "path", path: "/oak" });
  });

  test("nothing in the navigation reads as finished: rail labels, settings, gates and the sheet's own rows", () => {
    const words = [
      ...NAV_ITEMS.map((n) => n.label),
      ...SETTINGS_SECTIONS.map((s) => s.label),
      ...Object.values(NAV_GATES).map((g) => g?.opens ?? ""),
      ...CORE_SECTIONS.flatMap((s) => [s.title, ...s.rows.map(([, d]) => d)]),
      oakNavLabel(
        "The Oak",
        shellTracks({
          lessons: [],
          checkpoints: [],
          core: "complete",
          tracks: [
            track("J", "open", "Open. Its first lessons are still being written."),
            track("R", "open", "Open. Its first lessons are still being written."),
          ],
        }),
      ),
      ...openCommands(open).flatMap((c) => [c.title, c.hint]),
    ];
    for (const w of words) expect({ w, finished: FINISHED_WORDS.test(w) }).toEqual({ w, finished: false });
    // The rail keeps every destination whatever the stage: the same nine, none removed after the core.
    expect(NAV_ITEMS.map((n) => n.id)).toEqual([
      "today",
      "oak",
      "practice",
      "studio",
      "transcribe",
      "album",
      "toolbox",
      "progress",
      "settings",
    ]);
  });
});

describe("Wave 7: the tracks as places", () => {
  const g = (gateId: string, label: string, open: boolean): TrackState["gates"][number] => ({
    gateId,
    trackId: gateId.startsWith("A") ? "A" : gateId.startsWith("R") ? "R" : "J",
    opens: "",
    requires: [{ ref: "U13.CP", kind: "checkpoint", label, met: open }],
    open,
    openedAt: open ? "2026-11-13T10:00:00.000Z" : null,
    lessonsAuthored: 5,
    lessonsTotal: 5,
  });
  const ts = (over: Partial<TrackState> & Pick<TrackState, "trackId">): TrackState => ({
    ...track(over.trackId, "open", "Next."),
    gates: [g(`${over.trackId}.main`, "U13 checkpoint passed", true)],
    ...over,
  });

  test("a checkpoint or a capstone session is a way in; the rail and the palette name it", () => {
    const t = shellTracks({
      lessons: [],
      checkpoints: [],
      tracks: [
        ts({
          trackId: "J",
          sessionsDone: 8,
          next: null,
          note: "Next: J.CP1 Jazz checkpoint 1.",
          nextSession: { kind: "checkpoint", mapItemId: "J.CP1", title: "Jazz checkpoint 1", estMinutes: 25 },
        }),
        ts({
          trackId: "R",
          sessionsDone: 16,
          next: null,
          note: "Next: RC1.S2 16th-Note Funk.",
          nextSession: { kind: "capstone", mapItemId: "RC1.S2", title: "16th-Note Funk", estMinutes: 25 },
        }),
        ts({
          trackId: "A",
          gates: [g("A.side", "U03.L02 completed", true)],
          next: "A1.L01",
          note: "Next: A1.L01.",
        }),
      ],
    });
    const [j, r, a] = t as [ShellTrackT, ShellTrackT, ShellTrackT];
    expect([j.state, j.card, trackSessionTarget(j)]).toEqual([
      "ready",
      "in-progress",
      { kind: "checkpoint", unitId: "J.CP1" },
    ]);
    expect(trackSessionTarget(r)).toEqual({ kind: "capstone", capstoneId: "RC1" });
    expect(trackSessionTarget(a)).toEqual({ kind: "lesson", lessonId: "A1.L01" });
    // Arrangement & Sound's side lessons never mark the rail; its own lessons do (U09.CP).
    expect(oakTracksNote(t)).toBe("Jazz Harmony: next J.CP1; Advanced Rhythm: next RC1.S2");
    expect(trackHint(j)).toBe("Advanced track · in progress · next: J.CP1 Jazz checkpoint 1");
  });

  test("a waiting track names its gate; a complete one is not in the rail and nothing reads as finished", () => {
    const t = shellTracks({
      lessons: [],
      checkpoints: [],
      tracks: [
        ts({
          trackId: "J",
          sessionsDone: 8,
          gates: [
            g("J.main", "U13 checkpoint passed", true),
            g("J.chord-scales", "U14 checkpoint passed", false),
          ],
          next: null,
          nextSession: null,
          note: "J2.L04 opens with the U14 checkpoint.",
        }),
        ts({ trackId: "R", sessionsDone: 20, sessionsTotal: 20, next: null, nextSession: null }),
        ts({
          trackId: "A",
          gates: [g("A.side", "U03.L02 completed", true), g("A.sound", "U09 checkpoint passed", true)],
          next: "A1.L05",
          note: "Next: A1.L05 Grit.",
          nextSession: { kind: "lesson", mapItemId: "A1.L05", title: "Grit", estMinutes: 20 },
        }),
      ],
    });
    const [j, r] = t as [ShellTrackT, ShellTrackT];
    expect(j.card).toBe("waiting");
    expect(trackHint(j)).toBe("Advanced track · open · waits for: U14 checkpoint passed");
    expect(r.card).toBe("complete");
    expect(trackHint(r)).toBe("Advanced track · complete · every lesson stays open to replay");
    expect(oakTracksNote(t)).toBe("Arrangement & Sound: next A1.L05");
    const held = shellTracks({
      lessons: [],
      checkpoints: [],
      tracks: [
        ts({
          trackId: "J",
          sessionsDone: 12,
          gates: [g("J.main", "U13 checkpoint passed", true), g("J.forms", "U15.L06 completed", false)],
          next: null,
          nextSession: null,
        }),
      ],
    });
    expect(oakTracksNote(held)).toBe("Jazz Harmony waits for: U15.L06 completed");
    for (const s of [trackHint(j), trackHint(r), oakTracksNote(t) ?? ""])
      expect(FINISHED_WORDS.test(s), s).toBe(false);
  });
});

type ShellTrackT = ReturnType<typeof shellTracks>[number];

describe("trackHint never says open twice", () => {
  test("a server note of just “Open.” adds nothing after open", () => {
    const base = {
      trackId: "A",
      title: "Arrangement & Sound",
      state: "ready",
      card: "open",
      note: "Open.",
    } as never;
    expect(trackHint(base)).toBe("Advanced track · open");
    expect(trackHint({ ...(base as object), note: "Open. Next: A1.L05." } as never)).toBe(
      "Advanced track · open · next: A1.L05",
    );
  });
});
