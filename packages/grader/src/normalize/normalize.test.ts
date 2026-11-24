// OakEvent → NEvent and role inference, with golden facts (contracts §5.7, §6.2).
import { beforeAll, describe, expect, test } from "bun:test";
import { initRealm } from "../runtime/realm.ts";
import { run } from "../testkit/run.ts";
import type { NormalizeContext } from "../types.ts";
import { drumRole, inferRoles, normalize } from "./nevent.ts";

const ctx: NormalizeContext = { meter: "4/4" };

beforeAll(async () => {
  await initRealm({ toolbox: [], lockdown: false });
});

describe("drumRole", () => {
  test("drum names map to roles; bank prefixes and sample indices are stripped; pitched sounds are not drums", () => {
    expect(drumRole("bd")).toBe("kick");
    expect(drumRole("sd")).toBe("snare");
    expect(drumRole("hh")).toBe("hatClosed");
    expect(drumRole("oh")).toBe("hatOpen");
    expect(drumRole("cp")).toBe("clap");
    expect(drumRole("rim")).toBe("rim");
    expect(drumRole("lt")).toBe("tom");
    expect(drumRole("cr")).toBe("crash");
    expect(drumRole("rd")).toBe("ride");
    expect(drumRole("sh")).toBe("shaker");
    expect(drumRole("cb")).toBe("perc");
    expect(drumRole("RolandTR909_bd", "RolandTR909")).toBe("kick");
    expect(drumRole("RolandTR808_hh")).toBe("hatClosed");
    expect(drumRole("bd:3")).toBe("kick");
    expect(drumRole("piano")).toBeNull();
    expect(drumRole("gm_acoustic_bass")).toBeNull();
  });

  test("sound pack v4: hand percussion, foley and breaks are percussion, sbd a kick; old names keep their roles", () => {
    // Every name the table had before v4, with the role it had (unchanged).
    const before: Record<string, string> = {
      bd: "kick",
      kick: "kick",
      sd: "snare",
      snare: "snare",
      cp: "clap",
      clap: "clap",
      rim: "rim",
      rm: "rim",
      hh: "hatClosed",
      ch: "hatClosed",
      oh: "hatOpen",
      lt: "tom",
      mt: "tom",
      ht: "tom",
      cr: "crash",
      crash: "crash",
      rd: "ride",
      ride: "ride",
      sh: "shaker",
      cb: "perc",
      tb: "perc",
      perc: "perc",
      misc: "perc",
      fx: "perc",
      brk: "perc",
    };
    for (const [name, role] of Object.entries(before)) {
      expect([name, drumRole(name)]).toEqual([name, role]);
      // The v4 kits are banks: `oak909_bd`, `jazzkit_rd` read by their voice.
      for (const kit of ["oak909", "oak808", "rockkit", "lofikit", "jazzkit"])
        expect([kit, name, drumRole(`${kit}_${name}`, kit)]).toEqual([kit, name, role]);
    }
    for (const s of ["conga", "bongo:2", "clave", "foley:10", "snap", "impact", "swoosh", "scratch:1"])
      expect([s, drumRole(s)]).toEqual([s, "perc"]);
    for (const s of ["brkfunk", "brkboombap", "brkjungle", "brkhouse", "brkjazz", "brklofi"])
      expect([s, drumRole(s)]).toEqual([s, "perc"]);
    expect(drumRole("sbd")).toBe("kick");
    // Beds, pitched instruments and wavetables are not drum hits.
    for (const s of [
      "vinyl",
      "tape",
      "drone",
      "marimba",
      "kalimba",
      "glockenspiel",
      "wt_basic",
      "wt_fmsweep",
    ])
      expect([s, drumRole(s)]).toEqual([s, null]);
  });
});

describe("normalize", () => {
  test("exact rationals, gain, drum roles and deterministic IDs", async () => {
    const r = await run('drums: s("bd [sd sd]").gain(.5)\nmel: note("c4 e4").velocity(.5)');
    const n = normalize(r, ctx);
    expect(n.byTrack.drums?.map((e) => [e.onset, e.dur, e.drum, e.gain])).toEqual([
      [[0, 1], [1, 2], "kick", 0.5],
      [[1, 2], [1, 4], "snare", 0.5],
      [[3, 4], [1, 4], "snare", 0.5],
    ]);
    expect(n.byTrack.mel?.map((e) => [e.midi, e.gain, e.pitchSource, e.written])).toEqual([
      [60, 0.4, "note-str", "c4"],
      [64, 0.4, "note-str", "e4"],
    ]);
    expect(n.byTrack.drums?.map((e) => e.id)).toEqual([
      "drums|1|0/1|bd|0",
      "drums|1|1/2|sd|0",
      "drums|1|3/4|sd|0",
    ]);
    expect(normalize(r, ctx).all.map((e) => e.id)).toEqual(n.all.map((e) => e.id));
    expect(new Set(n.all.map((e) => e.id)).size).toBe(n.all.length);
    expect(n.cps).toBe(0.5);
    expect(n.bpm).toBe(120);
  });

  test("duplicates get a counter; code ranges are the atoms, later-applied first", async () => {
    const code = 'note("[c4,c4] e4").s("piano")';
    const n = normalize(await run(code), ctx);
    expect(n.all.map((e) => e.id)).toEqual(["main|1|0/1|60|0", "main|1|0/1|60|1", "main|1|1/2|64|0"]);
    expect(n.all[2]?.locs.map((l) => code.slice(l.from, l.to))).toEqual(["piano", "e4"]);
  });

  test("pitch sources: n-scale, voicing (names and numbers), note-num, freq with cents, n-index", async () => {
    const scale = normalize(await run('n("0 3#").scale("C4:major")'), ctx).all;
    // Strudel spells 3# as Gb4; `written` is never taken from a scale.
    expect(scale.map((e) => [e.midi, e.pitchSource, e.scaleCtx, e.written])).toEqual([
      [60, "n-scale", "C4 major", undefined],
      [66, "n-scale", "C4 major", undefined],
    ]);
    const voiced = normalize(await run('chord("C").voicing()'), ctx).all;
    expect(voiced.map((e) => e.midi)).toEqual([52, 60, 64, 67, 72]);
    expect(voiced.every((e) => e.pitchSource === "voicing" && e.chordSymbol === "C")).toBe(true);
    const nFirst = normalize(await run('n("0 1").chord("Am").voicing()'), ctx).all;
    expect(nFirst.map((e) => [e.midi, e.pitchSource, e.chordSymbol])).toEqual([
      [57, "voicing", "Am"],
      [60, "voicing", "Am"],
    ]);
    expect(normalize(await run('note("60 61")'), ctx).all.map((e) => e.pitchSource)).toEqual([
      "note-num",
      "note-num",
    ]);
    const f = normalize(await run('freq("440 452")'), ctx).all;
    expect(f.map((e) => [e.midi, e.cents, e.pitchSource])).toEqual([
      [69, undefined, "freq"],
      [69, 47, "freq"],
    ]);
    const idx = normalize(await run('n("0 1").s("bd")'), ctx).all;
    expect(idx.map((e) => [e.midi, e.pitchSource, e.drum, e.sampleN])).toEqual([
      [null, "n-index", "kick", 0],
      [null, "n-index", "kick", 1],
    ]);
  });

  test("clip and legato set clipDur; transposed notes keep no `written` spelling", async () => {
    const n = normalize(await run('note("c4 e4").legato(.5)'), ctx).all;
    expect(n.map((e) => [e.dur, e.clipDur])).toEqual([
      [
        [1, 2],
        [1, 4],
      ],
      [
        [1, 2],
        [1, 4],
      ],
    ]);
    const t = normalize(await run('note("c4").transpose(2)'), ctx).all;
    expect(t.map((e) => [e.midi, e.written])).toEqual([[62, undefined]]);
  });

  test("roles: fixed labels, then inference for other labels and `$:` lines; Band tracks apart", async () => {
    const r = await run(
      '$: s("bd sd")\n$: note("c2 g1")\n$: note("[c4,e4,g4] [d4,f4,a4]")\n$: note("e5 g5 a5 c6")\nkeys: note("c5 d5")',
      { band: 'drums: s("hh*4")' },
    );
    const n = normalize(r, ctx);
    expect(n.roles).toEqual({ drums: "$0", bass: "$1", chords: "$2", melody: "$3" });
    expect(n.band.map((e) => e.track)).toEqual(["band.drums", "band.drums", "band.drums", "band.drums"]);
    expect(n.all.some((e) => e.track.startsWith("band."))).toBe(false);
    const fixed = normalize(
      await run('kick: s("bd")\nbass: note("c2")\nmel: note("c5")\npad: note("[c4,e4]")'),
      ctx,
    );
    expect(fixed.roles).toEqual({ drums: "kick", bass: "bass", melody: "mel", chords: "pad" });
    expect(inferRoles(fixed.byTrack)).toEqual(fixed.roles);
  });

  test("a silent track is present in byTrack", async () => {
    const n = normalize(await run('drums: s("bd")\nmel: note("~")'), ctx);
    expect(n.byTrack.mel).toEqual([]);
  });

  test("with a pickup, cycle 0 is bar 0 in the IDs", async () => {
    const n = normalize(await run('mel: note("<[~ ~ c4] e4>")', { bars: 2 }), {
      meter: "3/4",
      pickup: { units: [1, 1] },
    });
    expect(n.all.map((e) => e.id)).toEqual(["mel|0|2/3|60|0", "mel|1|1/1|64|0"]);
  });
});

describe("adversarial: event size", () => {
  test("a megabyte string in every hap leaves the realm as at most MAX_EVENT_TEXT characters per field", async () => {
    const { evaluateForGrading } = await import("../runtime/analyze.ts");
    const { MAX_EVENT_TEXT } = await import("./hap.ts");
    const r = await evaluateForGrading(
      "const big = 'x'.repeat(1000000)\npure({ s: big, bank: big, note: big, chord: big, n: big }).fast(4)",
      { mode: "lesson", bars: 1, lint: null },
    );
    if (!r.ok) throw new Error(r.error.message);
    expect(r.events.length).toBe(4);
    for (const e of r.events) {
      for (const v of [e.s, e.bank, e.note, e.chord, e.n])
        expect(String(v).length).toBeLessThanOrEqual(MAX_EVENT_TEXT);
    }
    expect(JSON.stringify(r.events).length).toBeLessThan(40_000);
  });
});
