// The unit-song registry (spec 2026-11-24 §5.1, §6): every song is valid, a lesson finds its song and step, and
// the ID ledger knows every song.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineUnitSong } from "@oak/content-kit";
import { collectIds } from "../../scripts/content/generate.ts";
import { registries } from "../index.ts";
import { syllabus } from "../syllabus.ts";
import { songStepOf, unitSongById, unitSongOfUnit, unitSongs } from "./index.ts";

describe("unit songs", () => {
  test("every registered song parses with defineUnitSong", () => {
    expect(unitSongs.map((s) => s.id)).toEqual(expect.arrayContaining(["usong.U01", "usong.U02"]));
    for (const song of unitSongs) {
      expect(() => defineUnitSong(structuredClone(song))).not.toThrow();
      expect(unitSongById.get(song.id)).toBe(song);
      expect(unitSongOfUnit(song.unit)).toBe(song);
    }
    expect(new Set(unitSongs.map((s) => s.unit)).size).toBe(unitSongs.length);
    expect(registries.unitSongs).toBe(unitSongs);
  });

  test("each plan lists its unit's lessons once, in syllabus order", () => {
    for (const song of unitSongs) {
      const unit = syllabus.units.find((u) => u.id === song.unit);
      expect([song.id, song.plan.map((s) => s.lesson)]).toEqual([
        song.id,
        (unit?.lessons ?? []).map((l) => l.id),
      ]);
    }
  });

  test("songStepOf finds a lesson's step and returns null for a lesson in no song", () => {
    const take = songStepOf("U01.L03");
    expect(take?.song.id).toBe("usong.U01");
    expect(take?.step).toMatchObject({ lesson: "U01.L03", kind: "take" });
    const side = songStepOf("U01.L08");
    expect(side?.song.id).toBe("usong.U01");
    expect(side?.step.kind).toBe("side");
    expect(songStepOf("U02.L05")?.song.id).toBe("usong.U02");
    // U00 is onboarding and never has a song (spec 2026-11-24 §6: core U01–U17, advanced J1–J5, R1–R3, A1–A2).
    expect(songStepOf("U00.L01")).toBeNull();
    expect(songStepOf("U00.L02")).toBeNull();
    expect(unitSongOfUnit("U00")).toBeNull();
  });

  test("the id ledger lists every usong id", () => {
    const lock = JSON.parse(readFileSync(join(import.meta.dir, "..", "ids.lock.json"), "utf8")) as {
      ids: { id: string; kind: string; retiredAt?: string }[];
    };
    const ledgered = new Set(lock.ids.filter((e) => e.kind === "unitSong" && !e.retiredAt).map((e) => e.id));
    for (const song of unitSongs) expect([song.id, ledgered.has(song.id)]).toEqual([song.id, true]);
    // The build collects them under their own kind, so `content:build` keeps the ledger in step.
    expect(collectIds([]).unitSong).toEqual(unitSongs.map((s) => s.id).sort());
  });
});
