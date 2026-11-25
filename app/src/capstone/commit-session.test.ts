// Oak 2.0 W4 (W1 gap 1; PLAN S7 "a capstone can commit after its sound session"): after a session of a multi-session
// capstone the learner may commit the parts' sounds, so the next sessions arrange and mix. Never blocks anything.
import { describe, expect, test } from "bun:test";
import { soundChanges } from "../studio/commit.ts";
import { isDescriptive } from "../studio/descriptive.ts";
import {
  COMMIT_SESSION_COPY,
  commitAll,
  commitHeard,
  showCommitOffer,
  uncommittedLabels,
} from "./commit-session.ts";

// `hats` has no sound link: its `s("hh*8")` is the rhythm (soundSettingsOf), so there is no sound to commit.
const CODE =
  'setcpm(100/4)\nbass: note("c2").s("ebass").lpf(600)\ndrums: s("bd").bank("oak909")\nhats: s("hh*8")\n_mel: note("c4").s("piano")';
const AT = "2026-11-25T10:00:00.000Z";

describe("which parts can be committed", () => {
  test("unmuted labelled lines with a sound and no committed entry, in source order", () => {
    expect(uncommittedLabels(CODE, [])).toEqual(["bass", "drums"]);
    expect(uncommittedLabels(CODE, [{ label: "bass", version: 2 }])).toEqual(["drums"]);
    expect(uncommittedLabels('setcpm(100/4)\nbass: note("c2")', [])).toEqual([]);
  });
  test("a line whose only settings are the mix (gain, pan) has no sound to commit (W5 F3)", () => {
    expect(uncommittedLabels('setcpm(100/4)\npad: note("c3").gain(.5).pan(.2)', [])).toEqual([]);
    const at = commitAll(
      'setcpm(100/4)\npad: note("c3").gain(.5)\nbass: note("c2").s("ebass").gain(.7)',
      3,
      AT,
      [],
    );
    expect(at.map((c) => c.label)).toEqual(["bass"]);
  });
  test("commitAll keeps what is committed and adds the rest in source order", () => {
    expect(commitAll(CODE, 3, AT, [])).toEqual([
      { label: "bass", version: 3, at: AT },
      { label: "drums", version: 3, at: AT },
    ]);
    const kept = { label: "bass", version: 1, at: "2026-11-20T10:00:00.000Z" };
    expect(commitAll(CODE, 3, AT, [kept])).toEqual([kept, { label: "drums", version: 3, at: AT }]);
  });
});

describe("Commit the sounds commits what the learner hears (W5 F2)", () => {
  // Version 4 was autosaved with `lpf(600)`; the learner then opened the filter and clicked commit before the next
  // autosave (4 s).
  const SAVED = CODE;
  const LIVE = CODE.replace(".lpf(600)", ".lpf(900)");
  test("live code ahead of the save: the pending save is flushed and the commit names the version it returns", async () => {
    const versions = new Map<number, string>([[4, SAVED]]);
    const flushed: string[] = [];
    const out = await commitHeard({
      liveCode: LIVE,
      savedVersion: 4,
      savedCode: SAVED,
      saveNow: async (code) => {
        flushed.push(code);
        versions.set(5, code);
        return 5;
      },
      at: AT,
      committed: [],
    });
    expect(flushed).toEqual([LIVE]);
    expect(out).toEqual([
      { label: "bass", version: 5, at: AT },
      { label: "drums", version: 5, at: AT },
    ]);
    // Right after the commit nothing reads as a changed sound, so "Put it back" is not offered.
    expect(soundChanges(LIVE, out ?? [], (v) => versions.get(v) ?? null)).toEqual([]);
  });
  test("live code equal to the save: no new save, the saved version is committed", async () => {
    let calls = 0;
    const out = await commitHeard({
      liveCode: SAVED,
      savedVersion: 4,
      savedCode: SAVED,
      saveNow: async () => {
        calls += 1;
        return 9;
      },
      at: AT,
      committed: [],
    });
    expect(calls).toBe(0);
    expect(out?.map((c) => c.version)).toEqual([4, 4]);
  });
  test("never saved: nothing is committed (the card asks for a Run first)", async () => {
    const out = await commitHeard({
      liveCode: LIVE,
      savedVersion: null,
      savedCode: null,
      saveNow: async () => 1,
      at: AT,
      committed: [],
    });
    expect(out).toBeNull();
  });
});

describe("when the offer shows", () => {
  const base = { sessionsDone: 1, total: 3, released: false, uncommitted: 2 };
  test("after a session, before the last, unreleased, with a part to commit", () => {
    expect(showCommitOffer(base)).toBe(true);
    expect(showCommitOffer({ ...base, sessionsDone: 0 })).toBe(false);
    expect(showCommitOffer({ ...base, sessionsDone: 3, total: 3 })).toBe(false);
    expect(showCommitOffer({ ...base, released: true })).toBe(false);
    expect(showCommitOffer({ ...base, uncommitted: 0 })).toBe(false);
  });
});

test("every new string is descriptive", () => {
  for (const [k, v] of Object.entries(COMMIT_SESSION_COPY)) expect([k, isDescriptive(v)]).toEqual([k, true]);
});
