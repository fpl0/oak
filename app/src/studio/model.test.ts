// Studio's pure model: starters, the Band layer (checked against headless Strudel), locked-tool hints, the
// strict check for imported code, version bookkeeping, liner flags, export and the ring cover.
import { describe, expect, test } from "bun:test";
import type { SketchVersion } from "@oak/api";
import type { UnlockableId } from "@oak/content-kit";
import { lintOak } from "@oak/grader";
import { evalHeadless } from "@oak/grader/testing";
import { bandMeter, bands } from "../../../content/bands/index.ts";
import { toolbox } from "../../../content/toolbox.ts";
import {
  BLANK_CODE,
  bandKeyArg,
  bandMutesOf,
  bandReached,
  bandSetupFor,
  bandsForMeter,
  differsFrom,
  exportFileName,
  exportText,
  formSoundHints,
  formSoundTips,
  harmonyViewHints,
  isNamed,
  linerFlags,
  lockedHints,
  musicFactsOf,
  musicLensHints,
  musicLensTips,
  muteMapOf,
  needsReview,
  nextSketchTitle,
  OVER_BAND_CODE,
  ringsOf,
  sinceText,
  soundFactsOf,
  strictLint,
  strictVerdict,
  studioFlavour,
  studioLint,
  studioMeters,
  studioModes,
  versionBody,
  versionLabel,
} from "./model.ts";

const FIRST_LESSONS = new Set(
  toolbox
    .filter((t) => ["U00.L01", "U01.L01"].includes(t.unlock.at as string))
    .map((t) => t.id as UnlockableId),
);

describe("starters", () => {
  test("the blank and Band starters use only tools of the first lessons (no locked-tool hint)", () => {
    for (const code of [BLANK_CODE, OVER_BAND_CODE]) {
      const r = lintOak(code, studioLint(FIRST_LESSONS, "4/4", null), toolbox);
      expect(r.ok).toBe(true);
      expect(r.lockedTools).toEqual([]);
      expect(r.diagnostics.filter((d) => d.id.startsWith("code.locked"))).toEqual([]);
    }
  });

  test("the built-in Blank plays nothing and names no sound", async () => {
    const { events } = await evalHeadless(BLANK_CODE, 1);
    expect(events).toEqual([]);
    expect(BLANK_CODE).not.toMatch(/\bs\(/);
  });

  test("sketch titles count up from the highest number used", () => {
    expect(nextSketchTitle([])).toBe("Sketch 001");
    expect(nextSketchTitle([{ title: "Sketch 004" }, { title: "Groove" }, { title: "Sketch 002" }])).toBe(
      "Sketch 005",
    );
  });

  test("only the Wave 2 flavours are offered; anything else falls back to pop", () => {
    expect(studioFlavour("flavour.jazz-soul")).toBe("flavour.jazz-soul");
    expect(studioFlavour("flavour.funk")).toBe("flavour.pop");
    expect(studioFlavour(null)).toBe("flavour.pop");
  });
});

describe("the Band layer", () => {
  test("a sketch's Band is the flavour's code in the sketch's key; it carries no tempo line", () => {
    const b = bandSetupFor(
      { bandId: "band.two-chord-vamp", flavour: "flavour.jazz-soul", mutes: [] },
      bands,
      { tonic: "A", mode: "minor" },
    );
    expect(b?.flavour).toBe("flavour.jazz-soul");
    expect(b?.code).toContain('scale("A4:minor")');
    expect(b?.code).not.toContain("{{key}}");
    expect(b?.code).not.toContain("setcpm");
    expect(b?.code).toContain('s("rhodes")');
    expect(b?.tracks).toEqual(["drums", "bass", "chords"]);
    expect(bandSetupFor(null, bands, null)).toBeNull();
    expect(bandKeyArg(null)).toBe("C4:major");
  });

  test("the pop vamp in C plays C then F in the bass (I–IV), over the sketch's own tempo", async () => {
    const b = bandSetupFor({ bandId: "band.two-chord-vamp", flavour: "flavour.pop", mutes: [] }, bands, {
      tonic: "C",
      mode: "major",
    });
    const code = `setcpm(90/4)\n\n${b?.code ?? ""}`;
    const { events } = await evalHeadless(code, 2);
    const bass = events.filter((e) => e.track === "bass");
    expect(bass.map((e) => e.midi)).toEqual([36, 41]);
    // bar 1 chords are C E G (I), bar 2 F A C (IV)
    const chords = events.filter((e) => e.track === "chords");
    const pcs = (es: typeof chords) => new Set(es.map((e) => (e.midi ?? 0) % 12));
    const bar1 = pcs(chords.filter((e) => e.onset < 1));
    const bar2 = pcs(chords.filter((e) => e.onset >= 1));
    expect([...bar1].sort((a, z) => a - z)).toEqual([0, 4, 7]);
    expect([...bar2].sort((a, z) => a - z)).toEqual([0, 5, 9]);
  });

  test("jazz-soul plays its U03 stage (four-note chords, swung) once U03.L01 is reached, triads before", async () => {
    const band = { bandId: "band.two-chord-vamp", flavour: "flavour.jazz-soul", mutes: [] } as const;
    const before = bandReached({ lessons: [{ lessonId: "U02.L08", status: "completed" }] });
    const after = bandReached({
      lessons: [
        { lessonId: "U02.L08", status: "completed" },
        { lessonId: "U03.L01", status: "in_progress" },
      ],
    });
    expect(bandReached(undefined)("U03.L01")).toBe(false);
    expect(before("U03.L01")).toBe(false);
    expect(after("U03.L01")).toBe(true);
    const chordSizes = async (reached: (from: string) => boolean) => {
      const b = bandSetupFor(band, bands, { tonic: "C", mode: "major" }, reached);
      const { events } = await evalHeadless(`setcpm(90/4)\n\n${b?.code ?? ""}`, 1);
      const chords = events.filter((e) => e.track === "chords");
      const first = chords.filter((e) => e.onset === chords[0]?.onset);
      return { size: first.length, swung: (b?.code ?? "").includes("swingBy") };
    };
    expect(await chordSizes(before)).toEqual({ size: 3, swung: false });
    expect(await chordSizes(after)).toEqual({ size: 4, swung: true });
  });

  test("a 3/4 sketch offers the waltz vamp only; 4/4 never offers it", () => {
    expect(bandsForMeter(bands, "3/4", bandMeter).map((b) => b.id)).toEqual(["band.waltz-vamp"]);
    expect(bandsForMeter(bands, "4/4", bandMeter).map((b) => b.id)).not.toContain("band.waltz-vamp");
  });

  test("Band mutes round-trip between the workbench and the sketch", () => {
    expect(bandMutesOf({ muted: new Set(["band.drums", "mel", "band.chords"]), solo: null })).toEqual([
      "drums",
      "chords",
    ]);
    expect([
      ...muteMapOf({ bandId: "band.axis-4bar", flavour: "flavour.pop", mutes: ["bass"] }).muted,
    ]).toEqual(["band.bass"]);
  });
});

describe("lint: hints and the strict check", () => {
  test("locked tools become one hint each, with the session that unlocks them", () => {
    const code = 'setcpm(90/4)\n\ndrums: s("bd hh sd hh").gain(.8)\nfx: s("hh*8").gain(.5)\n';
    const r = lintOak(code, studioLint(FIRST_LESSONS, "4/4", null), toolbox);
    expect(r.ok).toBe(true);
    const hints = lockedHints(r, toolbox, new Map([["U01.L02", "Rests and accents"]]));
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      id: "tb.gain",
      at: "U01.L02",
      atTitle: "“Rests and accents”",
      lines: [3, 4],
    });
  });

  test("a tool with two unlock sites, one a capstone session, is named by titles, never by IDs", () => {
    const code = 'setcpm(90/4)\n\ndrums: s("bd hh sd hh").lpf(800)\n';
    const r = lintOak(code, studioLint(FIRST_LESSONS, "4/4", null), toolbox);
    const titles = new Map([
      ["C1", "C1 First Loop"],
      ["A1.L02", "Filters"],
    ]);
    const lpf = lockedHints(r, toolbox, titles).find((h) => h.id === "tb.lpf");
    expect(lpf?.atTitle).toBe("“C1 First Loop” or “Filters”");
    // One untitled site: no half-named sentence (the panel then says "a later lesson").
    expect(lockedHints(r, toolbox, new Map()).find((h) => h.id === "tb.lpf")?.atTitle).toBeNull();
  });

  test("the strict check stops unsafe or broken code and nothing else", () => {
    const ctx = strictLint("4/4", null);
    const ok = strictVerdict(lintOak('setcpm(90/4)\n\nmy: s("bd sd").fast(2)\n', ctx, toolbox));
    expect(ok.safe).toBe(true);
    const unsafe = strictVerdict(lintOak('setcpm(90/4)\n\nd: s("bd")\nconst x = globalThis\n', ctx, toolbox));
    expect(unsafe.safe).toBe(false);
    expect(unsafe.problems[0]?.id).toMatch(/^lint\./);
    const computed = strictVerdict(lintOak('setcpm(90/4)\nd: s("bd").p["x"]\n', ctx, toolbox));
    expect(computed.safe).toBe(false);
    const broken = strictVerdict(lintOak('setcpm(90/4)\nd: s("bd"', ctx, toolbox));
    expect(broken.problems.map((p) => p.id)).toContain("eval.syntax");
  });

  test("a version from an imported backup needs review", () => {
    expect(needsReview({ flags: { lockedTools: [], previewTools: [], reviewBeforeRun: true } })).toBe(true);
    expect(needsReview({ flags: { lockedTools: [], previewTools: [] } })).toBe(false);
    expect(needsReview(null)).toBe(false);
  });
});

const V = (over: Partial<SketchVersion> = {}): SketchVersion => ({
  sketchId: "sk_1",
  version: 3,
  code: BLANK_CODE,
  bpm: 90,
  meter: "4/4",
  key: { tonic: "C", mode: "major" },
  analysis: null,
  note: null,
  tutorAssisted: false,
  band: null,
  flags: { lockedTools: [], previewTools: [] },
  createdAt: "2026-11-11T10:00:00.000Z",
  ...over,
});

describe("versions", () => {
  test("a new version is saved only when code, key, meter or Band changed", () => {
    const latest = V();
    const now = { code: BLANK_CODE, key: latest.key, meter: "4/4" as const, band: null };
    expect(differsFrom(latest, now)).toBe(false);
    expect(differsFrom(latest, { ...now, code: `${BLANK_CODE} ` })).toBe(true);
    expect(differsFrom(latest, { ...now, key: { tonic: "D", mode: "major" } })).toBe(true);
    expect(differsFrom(latest, { ...now, meter: "3/4" })).toBe(true);
    expect(
      differsFrom(latest, { ...now, band: { bandId: "band.axis-4bar", flavour: "flavour.pop", mutes: [] } }),
    ).toBe(true);
    expect(differsFrom(null, now)).toBe(true);
  });

  test("version bodies carry the lint's locked tools and never claim tutor help", () => {
    const body = versionBody({
      code: "x",
      bpm: 90,
      meter: "4/4",
      key: null,
      band: null,
      lockedTools: ["tb.gain"],
      note: "Chorus",
      ranOk: true,
      sessionId: null,
    });
    expect(body.flags).toEqual({ lockedTools: ["tb.gain"], previewTools: [] });
    expect(body.tutorAssisted).toBe(false);
    expect(body.note).toBe("Chorus");
  });

  test("labels and names", () => {
    expect(versionLabel(V())).toBe("v3");
    expect(versionLabel(V({ note: "Chorus idea" }))).toBe("v3 · Chorus idea");
    expect(isNamed(V({ note: "  " }))).toBe(false);
    expect(isNamed(V({ note: "Verse" }))).toBe(true);
    const now = Date.parse("2026-11-11T10:05:00.000Z");
    const fmt = () => "11 Nov";
    expect(sinceText("2026-11-11T10:04:40.000Z", now, fmt)).toBe("just now");
    expect(sinceText("2026-11-11T10:00:00.000Z", now, fmt)).toBe("5 min ago");
    expect(sinceText("2026-11-09T10:00:00.000Z", now, fmt)).toBe("11 Nov");
  });
});

describe("liner flags and export", () => {
  test("liner notes say which tools are not unlocked yet and which Band plays", () => {
    const flags = linerFlags(
      V({
        flags: { lockedTools: ["tb.gain"], previewTools: [], reviewBeforeRun: true },
        band: { bandId: "band.axis-4bar", flavour: "flavour.jazz-soul", mutes: [] },
      }),
      toolbox,
      () => "Jazz-soul",
    );
    expect(flags).toEqual([
      "Uses tools not yet unlocked: .gain(x)",
      "Band: Oak (Jazz-soul style)",
      "Imported: review before running",
    ]);
  });

  test("the exported file is the code with a comment header, and it still runs", async () => {
    // A version with a part (Oak's Blank plays nothing since Oak 2.0 W1), so "it still runs" is heard.
    const groove = 'setcpm(90/4)\n\ndrums: s("bd hh sd hh")\n';
    const text = exportText({ title: "Sketch 007" }, V({ version: 4, code: groove }), [
      "Band: Oak (Pop style)",
    ]);
    expect(
      text.startsWith("// Sketch 007 (v4, 2026-11-11)\n// C major · 4/4 · 90 BPM\n// Band: Oak (Pop style)"),
    ).toBe(true);
    expect(text.endsWith(`${groove.trimEnd()}\n`)).toBe(true);
    expect((await evalHeadless(text, 1)).events).toHaveLength(4);
    expect(exportFileName("Sketch 007", 4)).toBe("sketch-007-v4.js");
    expect(exportFileName("¿Qué?", 1)).toBe("que-v1.js");
  });
});

describe("the tree-ring cover", () => {
  test("one ring per version, at most twelve, inside the cover, stable per sketch", () => {
    expect(ringsOf("sk_1", 1)).toHaveLength(1);
    expect(ringsOf("sk_1", 5)).toHaveLength(5);
    expect(ringsOf("sk_1", 40)).toHaveLength(12);
    expect(ringsOf("sk_1", 5)).toEqual(ringsOf("sk_1", 5));
    expect(ringsOf("sk_2", 5)).not.toEqual(ringsOf("sk_1", 5));
    for (const r of ringsOf("sk_3", 12)) {
      expect(r.r + r.width / 2 + Math.abs(r.dx)).toBeLessThanOrEqual(32);
      expect(r.r).toBeGreaterThan(0);
    }
    const rs = ringsOf("sk_4", 6).map((r) => r.r);
    expect([...rs].sort((a, b) => a - b)).toEqual(rs);
  });
});

describe("harmony view hints (Wave 4)", () => {
  const at = (id: string) =>
    ({ "tb.feature.chord-symbols": "U05.L04", "tb.feature.rn": "U06.L02" })[id] ?? null;
  test("a sketch with chords hears what is still locked, in course order; none once unlocked", () => {
    expect(harmonyViewHints(true, new Set(), at).map((h) => [h.id, h.at])).toEqual([
      ["tb.feature.chord-symbols", "U05.L04"],
      ["tb.feature.rn", "U06.L02"],
    ]);
    expect(harmonyViewHints(true, new Set(["tb.feature.chord-symbols"]), at).map((h) => h.id)).toEqual([
      "tb.feature.rn",
    ]);
    expect(harmonyViewHints(false, new Set(), at)).toEqual([]);
  });
});

describe("Wave 5: form and sound hints in the Studio", () => {
  const sites = (id: string) =>
    ({ "tb.lens.form": "U09.L02", "tb.scope": "A1.L01", "tb.lpf": "C1.S1", "tb.adsr": "A1.L03" })[id] ?? null;
  test("an arranged sketch hears when the ribbon opens; nothing once it is open", () => {
    const facts = soundFactsOf("drums: arrange([4, a], [4, b])", true);
    expect(formSoundHints(facts, new Set(), sites).map((h) => h.id)).toEqual(["tb.lens.form"]);
    expect(formSoundHints(facts, new Set(["tb.lens.form"]), sites)).toEqual([]);
    expect(formSoundTips(facts, new Set(["tb.lens.form"]))[0]).toMatch(/Shift\+E/);
  });
  test("the scope and probe hints follow the code's controls", () => {
    const facts = soundFactsOf('bass: note("c2").s("sawtooth").lpf(600).attack(.1).scope()', false);
    expect(facts).toEqual({ sections: false, scope: true, filter: true, envelope: true });
    expect(formSoundHints(facts, new Set(["tb.lpf"]), sites).map((h) => h.id)).toEqual([
      "tb.scope",
      "tb.adsr",
    ]);
    expect(formSoundTips(soundFactsOf('x: note("c2").lpf(600)', false), new Set(["tb.scope"]))[0]).toMatch(
      /Shift\+W/,
    );
    expect(formSoundHints(soundFactsOf('x: note("c2")', false), new Set(), sites)).toEqual([]);
  });
});

describe("Wave 6: modes, meters and lens hints in the Studio", () => {
  const sites = (id: string) =>
    ({ "chord.seventh": "U12.L01", "tb.early": "U13.L01", "tb.meter.compound": "U13.L04" })[id] ?? null;
  test("a sketch's key offers each mode once its scale is unlocked, and always keeps the one it has", () => {
    expect(studioModes(new Set())).toEqual(["major", "minor"]);
    expect(studioModes(new Set(["scale.mixolydian", "scale.dorian"]))).toEqual([
      "major",
      "minor",
      "mixolydian",
      "dorian",
    ]);
    expect(studioModes(new Set(), "phrygian")).toEqual(["major", "minor", "phrygian"]);
    expect(studioModes(new Set(), "harmonic minor")).toEqual(["major", "minor", "harmonic minor"]);
  });
  test("12/8 joins the meters with the compound meters; 6/8 was always there", () => {
    expect(studioMeters(new Set())).toEqual(["4/4", "3/4", "2/4", "6/8"]);
    expect(studioMeters(new Set(["tb.meter.compound"]))).toEqual(["4/4", "3/4", "2/4", "6/8", "12/8"]);
    expect(studioMeters(new Set(), "12/8")).toContain("12/8");
  });
  test("a sketch with sevenths and pushes hears when its lenses open; a tip once they are there", () => {
    const facts = musicFactsOf({
      harmony: { chords: [{ seventh: "m7" }, { seventh: null }] },
      keys: [{}, {}],
      rhythm: { grid: null, pushes: { size: 3 } },
    });
    expect(facts).toEqual({ sevenths: true, keyChange: true, beatGrid: false, pushes: true });
    expect(musicLensHints(facts, new Set(), sites).map((h) => `${h.id} ${h.at}`)).toEqual([
      "chord.seventh U12.L01",
      "tb.early U13.L01",
    ]);
    expect(musicLensHints(facts, new Set(["chord.seventh", "tb.late"]), sites)).toEqual([]);
    const tips = musicLensTips(facts, new Set(["chord.seventh", "tb.scale.patterned", "tb.early"]));
    expect(tips.map((t) => /Shift\+[IJV]/.exec(t)?.[0])).toEqual(["Shift+I", "Shift+J", "Shift+V"]);
    expect(musicLensTips(musicFactsOf(null), new Set(["chord.seventh"]))).toEqual([]);
    expect(musicLensHints(musicFactsOf(undefined), new Set(), sites)).toEqual([]);
  });
});
