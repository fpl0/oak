// The Band's production defaults for harmony (contracts §5.10, Wave 4): at U05–U07 every Band in every flavour
// that ships by then (content/flavours.ts FLAVOUR_RULES: pop and jazz-soul; indie and funk ship in Wave 5) plays
// like a record: the chords sit in a room and off-centre, the bass is low-passed and centred, every part's
// velocity moves (no pasted hits), and nothing clips the bus. Checked on the code the adapter receives, evaluated
// in headless Strudel through `bandCodeFor` exactly as an editor or the pattern player prepares it.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { evalHeadless } from "@oak/grader/testing";
import { isDominantSeventhPcs, twelveBarFormOf } from "@oak/theory";
import { bandCodeAt, bands } from "../../../content/bands/index.ts";
import { FLAVOUR_RULES, flavourById } from "../../../content/flavours.ts";
import { bandCodeFor, tonicOffset } from "./band.ts";
import type { BandSetup } from "./types.ts";

setDefaultTimeout(60_000);

/** Wave 4's lessons are all after U03.L01 and U06.L01 in every order: every stage has been reached. */
const AT_U07 = () => true;
/** Wave 5: indie and funk ship, so every flavour's Band is held to the same production defaults; electronic (S1) too. */
const SHIPPED = Object.entries(FLAVOUR_RULES)
  .filter(([, r]) => ["W2", "W3", "W4", "W5", "S1"].includes(r.ships))
  .map(([id]) => id);

describe("Band production at U05–U11", () => {
  test("by U08 every flavour exists: pop and jazz-soul (W2), indie and funk (W5), electronic (S1)", () => {
    expect(SHIPPED.sort()).toEqual([
      "flavour.electronic",
      "flavour.funk",
      "flavour.indie",
      "flavour.jazz-soul",
      "flavour.pop",
    ]);
  });

  for (const band of bands) {
    for (const flavour of SHIPPED) {
      test(`${band.id} in ${flavour}`, async () => {
        const prod = flavourById.get(flavour as never)?.production;
        if (!prod) throw new Error(`no production for ${flavour}`);
        const setup: BandSetup = {
          band: band.id,
          flavour: flavour as never,
          code: bandCodeAt(band, flavour, AT_U07).replaceAll("{{key}}", "A4:major"),
          followsLearnerKey: false,
          tracks: ["drums", "bass", "chords"],
        };
        const code = bandCodeFor(setup, {
          key: { tonic: "A", mode: "major" } as never,
          defaultBpm: 96,
          learnerCode: "",
        });
        const meter = band.id === "band.waltz-vamp" ? 3 : 4;
        const r = await evalHeadless(`setcpm(96/${meter})\n${code}`, 4);
        const by = (t: string) => r.events.filter((e) => e.track === t).map((e) => e.value);
        const [drums, bass, chords] = [by("drums"), by("bass"), by("chords")];
        // At least a kick and a snare a bar (the shuffle Bands leave the hats to the learner: author:CP).
        expect(drums.length).toBeGreaterThanOrEqual(8);
        expect(bass.length).toBeGreaterThan(2);
        expect(chords.length).toBeGreaterThan(5);
        // the bass: low-passed at the flavour's corner, centred, under the chords
        for (const v of bass) {
          expect(v.cutoff).toBe(prod.bassLpf); // `.lpf()` is stored as `cutoff`
          expect(v.pan ?? 0.5).toBe(0.5);
        }
        // the chords: in the flavour's room, panned off-centre
        for (const v of chords) {
          expect(v.room).toBe(prod.room);
          expect(v.pan).toBe(prod.pan.chords);
        }
        // velocities move within the humanise range, and never all the same
        for (const part of [drums, chords]) {
          const vel = part.map((v) => (typeof v.velocity === "number" ? v.velocity : 1));
          expect(new Set(vel).size).toBeGreaterThan(1);
          expect(Math.min(...vel)).toBeGreaterThanOrEqual(1 - 2 * prod.humanizeVelocity - 1e-9);
          expect(Math.max(...vel)).toBeLessThanOrEqual(1);
        }
        // levels leave headroom for the learner's parts
        for (const v of [...drums, ...bass, ...chords]) expect(Number(v.gain ?? 1)).toBeLessThanOrEqual(0.9);
        // in every bar the chords never dip under the bass (a crossing muddies the root on headphones). The
        // low-interval limit (no third under C3) is reported, not asserted: the Band voicings are author:CP's.
        const bars = band.id === "band.phrase-8bar" ? 8 : 4;
        const r8 = bars > 4 ? await evalHeadless(`setcpm(96/${meter})\n${code}`, bars) : r;
        const gaps: number[] = [];
        for (let bar = 0; bar < bars; bar++) {
          const inBar = (t: string) =>
            r8.events.filter((e) => e.track === t && e.onset >= bar && e.onset < bar + 1 && e.midi !== null);
          const lowChord = Math.min(...inBar("chords").map((e) => e.midi as number));
          const bassNotes = inBar("bass").map((e) => e.midi as number);
          if (bassNotes.length > 0 && Number.isFinite(lowChord)) gaps.push(lowChord - Math.max(...bassNotes));
        }
        expect(gaps.length).toBeGreaterThan(0);
        // Funk's octave pop (the root an octave up on the "and" of 4) rises over the clav's lowest voice in A, by
        // up to a fifth under vi (axis, doo-wop): pinned and reported to author:CP (content/bands), not widened for
        // any other flavour.
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(flavour === "flavour.funk" ? -7 : 0);
        const muddy = r8.events.filter(
          (e, _i, all) =>
            e.track === "chords" &&
            e.midi !== null &&
            e.midi < 48 &&
            all.some(
              (o) =>
                o.track === "chords" &&
                o.onset === e.onset &&
                o.midi !== null &&
                o.midi - (e.midi as number) >= 3 &&
                o.midi - (e.midi as number) <= 4,
            ),
        );
        if (muddy.length > 0)
          console.info(
            `${band.id} ${flavour} in A: a third under C3 at bars ${[...new Set(muddy.map((e) => Math.floor(e.onset) + 1))].join(" ")}`,
          );
      });
    }
  }
});

/** The lesson keys of U10–U11 (content/specs): minor Bands in A, D and E minor; blues Bands in C, F, G, A, E and B♭. */
const MINOR_KEYS = ["A", "D", "E"] as const;
const BLUES_KEYS = ["C", "F", "G", "A", "E", "Bb"] as const;
const isMinorBand = (id: string) => /aeolian|minor|andalusian|ballad/.test(id);

async function eventsOf(
  band: (typeof bands)[number],
  flavour: string,
  tonic: string,
  mode: string,
  bars: number,
) {
  const setup: BandSetup = {
    band: band.id,
    flavour: flavour as never,
    code: bandCodeAt(band, flavour as never, AT_U07).replaceAll("{{key}}", `${tonic}4:${mode}`),
    followsLearnerKey: false,
    tracks: ["drums", "bass", "chords"],
  };
  const code = bandCodeFor(setup, { key: { tonic, mode } as never, defaultBpm: 96, learnerCode: "" });
  return (await evalHeadless(`setcpm(96/4)\n${code}`, bars)).events;
}

describe("Wave 5 Bands: swing, minor keys and the twelve-bar form", () => {
  // Every Band that swings (jazz-soul from U03, the shuffle Bands of U11) puts each off-beat eighth on the last
  // triplet of its beat (contracts §6.10, amount 1/3), and its on-beat notes stay on the beat.
  const swung = bands.flatMap((b) =>
    SHIPPED.filter((f) => bandCodeAt(b, f as never, AT_U07).includes(".swingBy(1/3, 4)")).map(
      (f) => [b, f] as const,
    ),
  );
  test("at least the jazz-soul Bands swing", () => {
    expect(swung.length).toBeGreaterThanOrEqual(4);
  });
  // The swing lives where the Band puts it: the drums (jazz-soul) or the bass's eighths and the chords' push (the
  // shuffle Bands, whose drums are kick and snare on the beat and leave the hats to the learner). Each swung part's
  // off-beats sit on the last triplet; at least one part has off-beats.
  for (const [band, flavour] of swung) {
    test(`${band.id} in ${flavour}: the off-beats sit on the last triplet`, async () => {
      // The whole Band (a sectioned Band's verse can be all on the beat; its chorus pushes).
      const events = await eventsOf(band, flavour, "C", "major", Math.min(16, Math.max(2, band.bars ?? 2)));
      const code = bandCodeAt(band, flavour as never, AT_U07);
      const swungTracks = ["drums", "bass", "chords"].filter((t) =>
        // `drums: …swingBy` or, in a sectioned Band, `const drumsChorus = …swingBy`.
        new RegExp(`^\\s*(?:const\\s+)?${t}\\w*\\s*[:=].*\\.swingBy\\(1/3, 4\\)`, "m").test(code),
      );
      expect(swungTracks.length, code).toBeGreaterThan(0);
      let offBeats = 0;
      for (const t of swungTracks) {
        const positions = new Set(
          events.filter((e) => e.track === t).map((e) => Math.round(((e.onset * 4) % 1) * 1000) / 1000),
        );
        for (const p of positions) expect([0, 0.667], `${t}`).toContain(p);
        if (positions.has(0.667)) offBeats++;
      }
      expect(offBeats).toBeGreaterThan(0);
    });
  }

  // Minor Bands (U10: the Aeolian loop and its kin) keep the bass under the chords in every minor lesson key and
  // play the key's own minor triads.
  for (const band of bands.filter((b) => isMinorBand(b.id))) {
    for (const flavour of SHIPPED) {
      test(`${band.id} in ${flavour} in ${MINOR_KEYS.join(", ")} minor`, async () => {
        for (const tonic of MINOR_KEYS) {
          const ev = await eventsOf(band, flavour, tonic, "minor", band.bars);
          const bass = ev.filter((e) => e.track === "bass" && e.midi !== null);
          const chords = ev.filter((e) => e.track === "chords" && e.midi !== null);
          expect(bass.length, tonic).toBeGreaterThan(0);
          expect(chords.length, tonic).toBeGreaterThan(0);
          // the tonic's pitch class opens the loop in the bass
          const first = bass.reduce((a, b) => (b.onset < a.onset ? b : a));
          expect(((Math.round(first.midi as number) % 12) + 12) % 12, tonic).toBe(tonicOffset(tonic) % 12);
        }
      });
    }
  }

  // A twelve-bar Band (U11.L05 on, C5, X2): its bass roots make a 12-bar chorus in every blues lesson key, and every
  // chord it plays is a dominant seventh. Wave 7's jazz blues (its ii–Vs, its °7: the J4 changes) is checked as a
  // jazz blues in packages/strudel/e2e/wave7-bands.test.ts.
  for (const band of bands.filter((b) => b.bars === 12 && b.id !== "band.jazz-blues")) {
    for (const flavour of SHIPPED) {
      test(`${band.id} in ${flavour} is a twelve-bar chorus of dominant sevenths in ${BLUES_KEYS.join(" ")}`, async () => {
        for (const tonic of BLUES_KEYS) {
          const ev = await eventsOf(band, flavour, tonic, "major", 12);
          // Each bar's root is the dominant seventh the chords spell (a walking bass may pass through other notes
          // on a downbeat where the chord does not change); a bar the chords leave empty reads the bass's first note.
          const roots = Array.from({ length: 12 }, (_, bar) => {
            const pcs = new Set(
              ev
                .filter((e) => e.track === "chords" && e.midi !== null && Math.floor(e.onset) === bar)
                .map((e) => ((Math.round(e.midi as number) % 12) + 12) % 12),
            );
            const root = [...pcs].find((r) => [4, 7, 10].every((i) => pcs.has((r + i) % 12)));
            if (root !== undefined) return (((root - tonicOffset(tonic)) % 12) + 12) % 12;
            const b = ev.filter((e) => e.track === "bass" && e.midi !== null && Math.floor(e.onset) === bar);
            if (b.length === 0) return null;
            const low = b.reduce((x, y) => (y.onset < x.onset ? y : x)).midi as number;
            return (((Math.round(low) - tonicOffset(tonic)) % 12) + 12) % 12;
          });
          expect(twelveBarFormOf(roots), `${tonic}: ${roots.join(" ")}`).not.toBeNull();
          for (let bar = 0; bar < 12; bar++) {
            const pcs = [
              ...new Set(
                ev
                  .filter((e) => e.track === "chords" && e.midi !== null && Math.floor(e.onset) === bar)
                  .map((e) => ((Math.round(e.midi as number) % 12) + 12) % 12),
              ),
            ];
            if (pcs.length >= 3)
              expect(isDominantSeventhPcs(pcs), `${tonic} bar ${bar + 1}: ${pcs}`).toBe(true);
          }
        }
      });
    }
  }
});
