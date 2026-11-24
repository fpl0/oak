// Today's line about a finished song (`songReadyLine`): shown while a song is ready for the album and not on it.
import { describe, expect, test } from "bun:test";
import type { UnitId } from "@oak/api";
import { songReadyLine } from "./today-model.ts";

type Release = { albumTrackId: string | null };
const song = (unitId: string, title: string, o: { releasable?: boolean; releases?: Release[] } = {}) => ({
  unitId: unitId as UnitId,
  title,
  releasable: o.releasable ?? false,
  releases: (o.releases ?? []) as never,
  lessonsCount: 4,
});
const steps = () => 4;

describe("Today's finished-song line", () => {
  test("no song ready: nothing", () => {
    expect(songReadyLine([], steps)).toBeNull();
    expect(songReadyLine([song("U01", "Groove")], steps)).toBeNull();
  });

  test("a song ready for the album is named, in plain words, and links to its page", () => {
    expect(songReadyLine([song("U01", "Groove", { releasable: true })], steps)).toEqual({
      unitId: "U01" as UnitId,
      title: "Groove",
      text: "Your song “Groove” is finished. Release it to your album.",
    });
  });

  test("once released it goes; a song taken off the album is not offered here", () => {
    expect(
      songReadyLine([song("U01", "Groove", { releasable: true, releases: [{ albumTrackId: "t1" }] })], steps),
    ).toBeNull();
    expect(
      songReadyLine([song("U01", "Groove", { releasable: true, releases: [{ albumTrackId: null }] })], steps),
    ).toBeNull();
  });

  test("several ready: the newest is named and the others counted", () => {
    const ready = (u: string, t: string) => song(u, t, { releasable: true });
    expect(songReadyLine([ready("U01", "One"), ready("U02", "Two")], steps)?.text).toBe(
      "Your song “Two” is finished. Release it to your album. One more song is ready too.",
    );
    const three = songReadyLine([ready("U01", "One"), ready("U02", "Two"), ready("U03", "Three")], steps);
    expect(three?.unitId).toBe("U03" as UnitId);
    expect(three?.text).toBe(
      "Your song “Three” is finished. Release it to your album. 2 more songs are ready too.",
    );
  });
});
