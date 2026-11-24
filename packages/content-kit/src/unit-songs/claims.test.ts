// The claims model of unit songs (spec 2026-11-24 §5.2, §5.6): which cells (part × section) a take owns, and who
// owns each cell once the takes are applied in order.
import { describe, expect, test } from "bun:test";
import type { TakeStep, UnitSongDef } from "../schema/index.ts";
import {
  type CellKey,
  cellKey,
  claimsOf,
  drumPartsOfSound,
  ownedBy,
  type PlayedParts,
  parseCellKey,
  partOfDrumSound,
  partOfTrack,
  resolveGrid,
} from "./claims.ts";

const SONG: UnitSongDef = {
  id: "usong.U01",
  unit: "U01",
  version: 1,
  title: "Claims",
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  bpm: 100,
  sections: [
    { id: "intro", type: "intro", bars: 4 },
    { id: "verse", type: "verse", bars: 8 },
    { id: "chorus", type: "chorus", bars: 8 },
  ],
  parts: [
    { id: "kick", label: "kick", role: "drums", sounds: ["bd"], name: "Kick", plainName: "Kick" },
    {
      id: "snare",
      label: "snare",
      role: "drums",
      sounds: ["sd", "rim", "cp"],
      name: "Snare",
      plainName: "Snare",
    },
    { id: "hats", label: "hats", role: "drums", sounds: ["hh", "oh"], name: "Hats", plainName: "Hats" },
    { id: "bass", label: "bass", role: "bass", name: "Bass", plainName: "Bass" },
    { id: "chords", label: "chords", role: "chords", name: "Chords", plainName: "Chords" },
    { id: "keys", label: "keys", role: "chords", name: "Keys", plainName: "Keys" },
    { id: "lead", label: "mel", role: "melody", name: "Lead", plainName: "Tune" },
  ],
  code: {
    "flavour.pop": "",
    "flavour.indie": "",
    "flavour.jazz-soul": "",
    "flavour.funk": "",
    "flavour.electronic": "",
  },
  plan: [],
  releaseAfter: "U01.CP",
};

const take = (o: Partial<TakeStep>): TakeStep => ({
  lesson: "U01.L01",
  kind: "take",
  sections: ["verse"],
  parts: ["kick"],
  startFrom: "oak",
  today: "Today.",
  ...o,
});
const played = (parts: string[] = [], playsChords = false): PlayedParts => ({
  parts: new Set(parts),
  playsChords,
});

describe("claimsOf (spec §5.2)", () => {
  test("declared parts claimed in declared sections", () => {
    expect(claimsOf(SONG, take({ parts: ["kick", "hats"] }), played())).toEqual(["kick@verse", "hats@verse"]);
    expect(claimsOf(SONG, take({ sections: ["chorus", "intro"] }), played())).toEqual([
      "kick@intro",
      "kick@chorus",
    ]);
  });

  test("'all' covers every section", () => {
    expect(claimsOf(SONG, take({ sections: "all", parts: ["bass"] }), played())).toEqual([
      "bass@intro",
      "bass@verse",
      "bass@chorus",
    ]);
  });

  test("played parts claim beyond the declared parts", () => {
    // A snare played in a kick take (U01.L01 going past the brief) takes Oak's snare in that take's sections only.
    expect(claimsOf(SONG, take({ parts: ["kick"] }), played(["kick", "snare"]))).toEqual([
      "kick@verse",
      "snare@verse",
    ]);
    // A played part the song does not have claims nothing.
    expect(claimsOf(SONG, take({ parts: ["kick"] }), played(["cowbell"]))).toEqual(["kick@verse"]);
  });

  test("playing chords claims every Oak pitched part except oakKeeps", () => {
    const step = take({ sections: ["chorus"], parts: ["chords"], oakKeeps: ["lead"] });
    expect(claimsOf(SONG, step, played(["chords"], true))).toEqual([
      "bass@chorus",
      "chords@chorus",
      "keys@chorus",
    ]);
    // Without oakKeeps the lead goes too; the drums always stay Oak's.
    expect(claimsOf(SONG, take({ sections: ["chorus"], parts: ["chords"] }), played([], true))).toEqual([
      "bass@chorus",
      "chords@chorus",
      "keys@chorus",
      "lead@chorus",
    ]);
    // A played part is claimed even when oakKeeps names it: oakKeeps only spares a part from the chords rule.
    expect(claimsOf(SONG, step, played(["chords", "lead"], true))).toContain("lead@chorus");
  });

  test("filled narrows the sections", () => {
    const step = take({ sections: "all", parts: ["kick"] });
    expect(claimsOf(SONG, step, played(), ["verse"])).toEqual(["kick@verse"]);
    // A filled section the step does not play in stays out; an empty fill claims nothing.
    expect(claimsOf(SONG, take({ sections: ["verse"] }), played(), ["chorus", "verse"])).toEqual([
      "kick@verse",
    ]);
    expect(claimsOf(SONG, step, played(), [])).toEqual([]);
  });
});

describe("resolveGrid and ownedBy", () => {
  test("a later take overrides an earlier one cell by cell", () => {
    const grid = resolveGrid(SONG, [
      { sourceId: "t1", cells: ["kick@verse", "snare@verse"] },
      { sourceId: "t2", cells: ["kick@verse", "kick@chorus"] },
    ]);
    expect(grid.size).toBe(SONG.parts.length * SONG.sections.length);
    expect(grid.get("kick@verse")).toBe("t2");
    expect(grid.get("snare@verse")).toBe("t1");
    expect(grid.get("kick@chorus")).toBe("t2");
    expect(grid.get("kick@intro")).toBe("oak");
    expect(grid.get("lead@chorus")).toBe("oak");
    // Section-major order, parts in song order: the grid reads like the arrangement.
    expect([...grid.keys()].slice(0, 3)).toEqual(["kick@intro", "snare@intro", "hats@intro"]);

    expect(ownedBy(grid, "t1").parts).toEqual(new Map([["verse", new Set(["snare"])]]));
    expect(ownedBy(grid, "t2").parts).toEqual(
      new Map([
        ["verse", new Set(["kick"])],
        ["chorus", new Set(["kick"])],
      ]),
    );
    expect(ownedBy(grid, "gone").parts.size).toBe(0);
    expect(ownedBy(grid, "oak").parts.get("intro")?.size).toBe(SONG.parts.length);
  });

  test("cells naming a part or section the song no longer has fall back to Oak", () => {
    const grid = resolveGrid(SONG, [
      { sourceId: "t1", cells: ["tom@verse", "kick@bridge", "kick@verse", "junk" as CellKey] },
    ]);
    expect(grid.size).toBe(SONG.parts.length * SONG.sections.length);
    expect(grid.has("tom@verse")).toBe(false);
    expect(grid.has("kick@bridge")).toBe(false);
    expect([...grid.values()].filter((o) => o === "t1")).toEqual(["t1"]);
  });

  test("cell keys round-trip", () => {
    expect(cellKey("kick", "verse")).toBe("kick@verse");
    expect(parseCellKey("kick@verse")).toEqual({ part: "kick", section: "verse" });
    expect(parseCellKey("kick")).toBeNull();
    expect(parseCellKey("@verse")).toBeNull();
  });
});

describe("parts of a learner's tracks", () => {
  test("partOfDrumSound maps bd:3 to kick and an unknown sound to null", () => {
    expect(partOfDrumSound(SONG, "bd")).toBe("kick");
    expect(partOfDrumSound(SONG, "bd:3")).toBe("kick");
    expect(partOfDrumSound(SONG, "rim")).toBe("snare");
    expect(partOfDrumSound(SONG, "oh:1")).toBe("hats");
    expect(partOfDrumSound(SONG, "cb")).toBeNull();
    expect(partOfDrumSound(SONG, "")).toBeNull();
  });

  /** SONG with the percussion part every unit song has (kick, snare, hats, perc). */
  const KIT: UnitSongDef = {
    ...SONG,
    parts: [
      ...SONG.parts.slice(0, 3),
      {
        id: "perc",
        label: "perc",
        role: "drums",
        sounds: ["cr", "rd", "lt", "mt", "ht", "sh", "cb", "tb"],
        name: "Percussion",
        plainName: "Percussion",
      },
      ...SONG.parts.slice(3),
    ],
  };
  const KIT_NAMES =
    "bd sd hh oh cp rim rm lt mt ht cr rd sh cb tb perc misc fx brk piano sawtooth gm_piano wt_basic";

  test("sound pack v4: every name a song could list before reads exactly as before", () => {
    // The answers of partOfDrumSound before the v4 names were added: by `sounds` only, the bank read after `_`.
    const before = (def: UnitSongDef, sound: string) => {
      const name = (sound.split(":")[0] ?? "").trim();
      if (name === "") return null;
      const owner = (n: string) => def.parts.find((p) => p.role === "drums" && (p.sounds ?? []).includes(n));
      const part =
        owner(name) ?? (name.includes("_") ? owner(name.slice(name.lastIndexOf("_") + 1)) : undefined);
      return part?.id ?? null;
    };
    for (const def of [SONG, KIT])
      for (const base of KIT_NAMES.split(" "))
        for (const sound of [base, `${base}:2`, `oak909_${base}`, `RolandTR808_${base}`]) {
          expect([sound, partOfDrumSound(def, sound)]).toEqual([sound, before(def, sound)]);
          const one = before(def, sound);
          expect([sound, drumPartsOfSound(def, sound)]).toEqual([sound, one === null ? [] : [one]]);
        }
  });

  test("sound pack v4: hand percussion and foley are the percussion part, sbd the kick, a break every drum part", () => {
    for (const s of ["conga", "bongo:3", "clave", "foley:7", "snap", "impact", "swoosh", "scratch"])
      expect([s, partOfDrumSound(KIT, s)]).toEqual([s, "perc"]);
    expect(partOfDrumSound(KIT, "sbd")).toBe("kick");
    for (const s of ["brkfunk", "brkboombap", "brkjungle", "brkhouse", "brkjazz", "brklofi:1"]) {
      expect([s, drumPartsOfSound(KIT, s)]).toEqual([s, ["kick", "snare", "hats", "perc"]]);
      // Not one part: partOfDrumSound says so.
      expect([s, partOfDrumSound(KIT, s)]).toEqual([s, null]);
    }
    // Beds and wavetables are not drum hits.
    for (const s of ["vinyl", "tape", "drone", "wt_basic"])
      expect([s, drumPartsOfSound(KIT, s)]).toEqual([s, []]);
  });

  test("sound pack v4: a part that lists the name keeps it; a song with no percussion part leaves a conga unowned", () => {
    const listed: UnitSongDef = {
      ...KIT,
      parts: KIT.parts.map((p) =>
        p.id === "snare" ? { ...p, sounds: [...(p.sounds ?? []), "clave", "brkfunk"] } : p,
      ),
    };
    expect(partOfDrumSound(listed, "clave")).toBe("snare");
    expect(drumPartsOfSound(listed, "brkfunk")).toEqual(["snare"]);
    expect(partOfDrumSound(listed, "conga")).toBe("perc");
    // SONG has kick, snare and hats only: nothing owns percussion, and nothing is labelled perc.
    expect(partOfDrumSound(SONG, "conga")).toBeNull();
    expect(drumPartsOfSound(SONG, "brkfunk")).toEqual(["kick", "snare", "hats"]);
    // A part labelled perc that lists none of the kit's percussion names still takes it.
    const bare: UnitSongDef = {
      ...SONG,
      parts: [
        ...SONG.parts,
        { id: "shaker", label: "perc", role: "drums", sounds: ["cr"], name: "Perc", plainName: "Perc" },
      ],
    };
    expect(partOfDrumSound(bare, "bongo")).toBe("shaker");
  });

  test("a break claims every drum part in the sections it plays; a conga line claims the percussion part", () => {
    const hits = (sounds: string[]): PlayedParts => played(sounds.flatMap((s) => drumPartsOfSound(KIT, s)));
    expect(claimsOf(KIT, take({ sections: ["verse"], parts: [] }), hits(["brkhouse"]))).toEqual([
      "kick@verse",
      "snare@verse",
      "hats@verse",
      "perc@verse",
    ]);
    expect(claimsOf(KIT, take({ sections: ["verse"], parts: [] }), hits(["conga", "conga:3"]))).toEqual([
      "perc@verse",
    ]);
  });

  test("partOfTrack prefers the exact label", () => {
    // `keys` is a chords-role track: its own part, not the first chords part.
    expect(partOfTrack(SONG, { label: "keys", role: "chords" })).toBe("keys");
    expect(partOfTrack(SONG, { label: "mel", role: "melody" })).toBe("lead");
    // No part has the label: the first part with the role.
    expect(partOfTrack(SONG, { label: "vox", role: "melody" })).toBe("lead");
    expect(partOfTrack(SONG, { label: "gtr", role: "chords" })).toBe("chords");
    expect(partOfTrack(SONG, { label: "bass2", role: "bass" })).toBe("bass");
    // Neither: no part.
    expect(partOfTrack(SONG, { label: "fx", role: null })).toBeNull();
    const noMelody = { ...SONG, parts: SONG.parts.filter((p) => p.role !== "melody") };
    expect(partOfTrack(noMelody, { label: "vox", role: "melody" })).toBeNull();
  });

  test("a chords-role track falls back to a pad part when the song has no chords part", () => {
    const padSong: UnitSongDef = {
      ...SONG,
      parts: [
        ...SONG.parts.filter((p) => p.role !== "chords"),
        { id: "pad", label: "pad", role: "pad", name: "Pad", plainName: "Pad" },
      ],
    };
    expect(partOfTrack(padSong, { label: "chords", role: "chords" })).toBe("pad");
  });
});
