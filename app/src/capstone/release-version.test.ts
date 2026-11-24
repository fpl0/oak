// The release take goes on the track version whose draft was released (wave 7 closer): AC1's release puts both of
// its versions on one track (track v1 = version one, v2 = version two), and the take recorded of version one must
// not land on version two, which is the track's current version.
import { describe, expect, test } from "bun:test";
import { releasedDraftOf, releasedVersionOf, releaseStandingOf } from "./release-version.ts";

const v = (version: number, sketchId: string, sketchVersion: number) => ({
  version,
  sketchId,
  sketchVersion,
});

describe("releasedVersionOf", () => {
  test("AC1: version one's draft is track version 1 although version 2 is current", () => {
    const track = { currentVersion: 2, versions: [v(1, "sk_a", 1), v(2, "sk_a", 2)] } as never;
    expect(releasedVersionOf(track, "sk_a", 1)).toBe(1);
    expect(releasedVersionOf(track, "sk_a", 2)).toBe(2);
  });
  test("a revision released twice from the same draft: the newest version holding it", () => {
    const track = { currentVersion: 3, versions: [v(1, "sk", 4), v(2, "sk", 6), v(3, "sk", 6)] } as never;
    expect(releasedVersionOf(track, "sk", 6)).toBe(3);
  });
  test("a draft the track does not hold: the current version, as before", () => {
    const track = { currentVersion: 1, versions: [v(1, "sk", 1)] } as never;
    expect(releasedVersionOf(track, "other", 9)).toBe(1);
  });
});

describe("releasedDraftOf: the release an editor compares its draft with", () => {
  test("no track yet: no release to compare with", () => {
    expect(releasedDraftOf(undefined, "sk")).toBeNull();
  });
  test("the newest track version made from this draft, though a later one is current (AC1)", () => {
    const track = {
      currentVersion: 3,
      versions: [v(1, "sk_a", 2), v(2, "sk_b", 1), v(3, "sk_b", 4)],
    } as never;
    expect(releasedDraftOf(track, "sk_a")).toEqual({ sketchId: "sk_a", sketchVersion: 2 });
    expect(releasedDraftOf(track, "sk_b")).toEqual({ sketchId: "sk_b", sketchVersion: 4 });
  });
  test("a draft the track does not hold (or none yet): the current version", () => {
    const track = { currentVersion: 1, versions: [v(1, "sk", 3), v(2, "sk", 5)] } as never;
    expect(releasedDraftOf(track, "other")).toEqual({ sketchId: "sk", sketchVersion: 3 });
    expect(releasedDraftOf(track, null)).toEqual({ sketchId: "sk", sketchVersion: 3 });
  });
});

// UX review practice-5: after a release, an edit (autosaved as a new version) and a reload, the header said
// "Released" over a draft that differed from the release. The standing compares the draft with the release's code.
describe("releaseStandingOf: the header chip and the album notice", () => {
  test("not released: a draft", () => {
    expect(releaseStandingOf(false, "a", null)).toBe("draft");
    expect(releaseStandingOf(false, "a", "b")).toBe("draft");
  });
  test("the draft on screen is the release: Released", () => {
    expect(releaseStandingOf(true, 's("bd")', 's("bd")')).toBe("released");
  });
  test("the draft differs from the release, also after a reload: Released · revising", () => {
    expect(releaseStandingOf(true, 's("bd sd")', 's("bd")')).toBe("revising");
  });
  test("an edit undone back to the release: Released again", () => {
    const rel = 'note("c e g")';
    expect(releaseStandingOf(true, `${rel} `, rel)).toBe("revising");
    expect(releaseStandingOf(true, rel, rel)).toBe("released");
  });
  test("the release's code still loading: Released, never a revision it cannot show", () => {
    expect(releaseStandingOf(true, "anything", null)).toBe("released");
  });
});
