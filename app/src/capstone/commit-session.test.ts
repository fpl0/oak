// Oak 2.0 W4 (W1 gap 1; PLAN S7 "a capstone can commit after its sound session"): after a session of a multi-session
// capstone the learner may commit the parts' sounds, so the next sessions arrange and mix. Never blocks anything.
import { describe, expect, test } from "bun:test";
import { isDescriptive } from "../studio/descriptive.ts";
import { COMMIT_SESSION_COPY, commitAll, showCommitOffer, uncommittedLabels } from "./commit-session.ts";

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
  test("commitAll keeps what is committed and adds the rest in source order", () => {
    expect(commitAll(CODE, 3, AT, [])).toEqual([
      { label: "bass", version: 3, at: AT },
      { label: "drums", version: 3, at: AT },
    ]);
    const kept = { label: "bass", version: 1, at: "2026-11-20T10:00:00.000Z" };
    expect(commitAll(CODE, 3, AT, [kept])).toEqual([kept, { label: "drums", version: 3, at: AT }]);
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
