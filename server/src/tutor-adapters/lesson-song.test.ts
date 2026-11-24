import { describe, expect, test } from "bun:test";
import type { UnitSongDetail, UnitSongPlan } from "@oak/api";
import { lessonSongPort } from "./lessons.ts";

const PLAN = {
  unitId: "U01",
  songId: "usong.U01",
  title: "Porch light",
  flavour: "flavour.indie",
  status: "open",
  takesCount: 2,
  lessonIndex: 3,
  lessonsInSong: 9,
  today: "Your snare joins the kick in the verse.",
  side: false,
} as UnitSongPlan;

const take = (id: number, cells: string[]) => ({ id, cells }) as unknown as UnitSongDetail["takes"][number];

function port(plan: UnitSongPlan | null, takes: UnitSongDetail["takes"] = []) {
  let gets = 0;
  const p = lessonSongPort({
    planSong: () => plan,
    get: () => {
      gets++;
      return { takes } as UnitSongDetail;
    },
  });
  return { p, gets: () => gets };
}

describe("lessonSongPort (contracts §5.11 rule 19)", () => {
  test("names the song, the learner's cells (deduped, in take order) and today's line", () => {
    const { p } = port(PLAN, [
      take(1, ["kick@verse", "kick@chorus"]),
      take(2, ["kick@verse", "snare@verse"]),
    ]);
    expect(p.songOf("U01.L03")).toEqual({
      title: "Porch light",
      flavour: "flavour.indie",
      yours: ["kick@verse", "kick@chorus", "snare@verse"],
      today: "Your snare joins the kick in the verse.",
    });
  });

  test("a new song has no cells and is not read; a lesson in no song has no song", () => {
    const fresh = port({ ...PLAN, status: "new", today: null });
    expect(fresh.p.songOf("U01.L01")).toEqual({
      title: "Porch light",
      flavour: "flavour.indie",
      yours: [],
      today: null,
    });
    expect(fresh.gets()).toBe(0);
    expect(port(null).p.songOf("U00.L01")).toBeNull();
  });
});
