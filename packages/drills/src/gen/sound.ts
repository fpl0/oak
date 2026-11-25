// Sound families (contracts §7.3, track A): `fam.snd.params` (what changed in the sound between bar 1 and
// bar 2: filter cutoff, resonance, attack, release, reverb, delay, or two of them) and `fam.snd.roles`
// (which instrument plays the bass, the pad or the lead; which part muddies the bass).
import type { KeySpec } from "@oak/content-kit";
import { buildPiece, type TrackSpec } from "../build.ts";
import { mod, spellMidi, stepToMidi } from "../kernel.ts";
import { above, rn, voiceProgression } from "../music.ts";
import { atom, chordOf, line, type Node, rest, seq } from "../pat.ts";
import { cueOf, type GenCtx, type Generator, jitter, pickKey, pickTempo, trialOf } from "./common.ts";

// --- fam.snd.params -----------------------------------------------------------------------------

/** One audible change: the Strudel control, its superdough name, the value in bar 1 and in bar 2. */
interface Change {
  id: string;
  label: string;
  control: string;
  internal: string;
  from: number;
  to: number;
  /** Extra controls the change needs to be heard (a delay's time and feedback). */
  with?: Record<string, { internal: string; value: number }>;
}
export const SOUND_CHANGES: Readonly<Record<string, Change>> = {
  brighter: {
    id: "brighter",
    label: "Brighter (filter opened)",
    control: "lpf",
    internal: "cutoff",
    from: 700,
    to: 3200,
  },
  darker: {
    id: "darker",
    label: "Darker (filter closed)",
    control: "lpf",
    internal: "cutoff",
    from: 3200,
    to: 700,
  },
  resonance: {
    id: "resonance",
    label: "A ringing peak (resonance up)",
    control: "lpq",
    internal: "resonance",
    from: 1,
    to: 18,
  },
  "slow-attack": {
    id: "slow-attack",
    label: "Softer start (longer attack)",
    control: "attack",
    internal: "attack",
    from: 0.005,
    to: 0.25,
  },
  "long-release": {
    id: "long-release",
    label: "Longer tail (longer release)",
    control: "release",
    internal: "release",
    from: 0.05,
    to: 0.9,
  },
  room: { id: "room", label: "More room (reverb)", control: "room", internal: "room", from: 0, to: 0.8 },
  delay: {
    id: "delay",
    label: "Echoes (delay)",
    control: "delay",
    internal: "delay",
    from: 0,
    to: 0.55,
    with: {
      delaytime: { internal: "delaytime", value: 0.375 },
      delayfeedback: { internal: "delayfeedback", value: 0.45 },
    },
  },
};
/** The changes each category asks about. */
export const CHANGES_OF: Readonly<Record<string, string[]>> = {
  cutoff: ["brighter", "darker"],
  resonance: ["resonance"],
  "attack-release": ["slow-attack", "long-release"],
  "room-delay": ["room", "delay"],
  "two-changes": [],
};

/** Base values every bar starts from, so a change is the only difference between the bars. */
const BASE: Readonly<Record<string, { internal: string; value: number }>> = {
  lpf: { internal: "cutoff", value: 1800 },
  lpq: { internal: "resonance", value: 1 },
  attack: { internal: "attack", value: 0.005 },
  release: { internal: "release", value: 0.05 },
  room: { internal: "room", value: 0 },
  delay: { internal: "delay", value: 0 },
};

export const soundParams: Generator = {
  name: "sound-params",
  generate(ctx) {
    const key: KeySpec = pickKey(ctx, "major");
    const openChanges = ctx.level.categories
      .filter((c) => ctx.openCategories.includes(c) || c === ctx.category)
      .flatMap((c) => CHANGES_OF[c] ?? []);
    let picked: Change[];
    if (ctx.category === "two-changes") {
      // Two changes on different controls.
      const pool = ctx.rng.shuffle(openChanges.length >= 2 ? openChanges : Object.keys(SOUND_CHANGES));
      const first = SOUND_CHANGES[pool[0] as string] as Change;
      const second = pool
        .map((id) => SOUND_CHANGES[id] as Change)
        .find((c) => c.control !== first.control) as Change;
      picked = [first, second];
    } else {
      picked = [SOUND_CHANGES[ctx.rng.pick(CHANGES_OF[ctx.category] ?? ["brighter"])] as Change];
    }
    // The same phrase twice: bar 1 with the base sound, bar 2 with the change.
    const steps = ctx.rng.pick([
      [0, 2, 4, 2],
      [0, 4, 2, 4],
      [4, 2, 0, null],
      [0, null, 4, null],
    ]);
    const names = steps.map((s) => (s === null ? null : spellMidi(stepToMidi(s, key, 3), key).code));
    const bar1: Record<string, number> = {};
    const bar2: Record<string, number> = {};
    const controls: Record<string, number | Node> = {};
    const used = new Set(picked.map((c) => c.control));
    for (const [control, b] of Object.entries(BASE)) {
      const change = picked.find((c) => c.control === control);
      const v1 = change ? change.from : b.value;
      const v2 = change ? change.to : b.value;
      bar1[b.internal] = v1;
      bar2[b.internal] = v2;
      if (used.has(control) || control === "lpf")
        controls[control] = v1 === v2 ? v1 : { t: "alt", items: [atom(v1), atom(v2)] };
    }
    for (const c of picked)
      for (const [control, w] of Object.entries(c.with ?? {})) {
        controls[control] = w.value;
        bar1[w.internal] = w.value;
        bar2[w.internal] = w.value;
      }
    const track: TrackSpec = {
      label: "synth",
      src: "note",
      pat: line(names),
      s: ctx.rng.pick(["sawtooth", "square"]),
      gain: jitter(ctx, 0.6),
      controls,
    };
    const piece = buildPiece({ bpm: pickTempo(ctx), bars: 2, tracks: [track] });
    const options = [...new Set(openChanges)];
    return trialOf(piece, { choice: picked.map((c) => c.id) }, cueOf(ctx), {
      mode: "choice",
      multi: picked.length > 1,
      options,
      optionLabels: Object.fromEntries(options.map((o) => [o, (SOUND_CHANGES[o] as Change).label])),
      controlsByBar: [bar1, bar2],
      prompt: picked.length > 1 ? "Bar 2 changed in two ways. Which two?" : "What changed in bar 2?",
    });
  },
};

// --- fam.snd.roles ------------------------------------------------------------------------------

/**
 * The instruments of each role, all unlocked by U10.CP (A2's gate, contracts §4.3): the stimulus never plays a
 * sound the learner has not met by name (no vibes before J1.L01, no trumpet before U15.L05).
 */
export const ROLE_SOUNDS = {
  bass: ["ebass", "upright", "fingerbass"],
  pad: ["pad", "strings", "organ"],
  lead: ["piano", "acgtr", "square"],
} as const;
type Role = keyof typeof ROLE_SOUNDS;
/** Fixed answers in A2.L01's words, the same on every trial (lessons and warm-ups ask the same question). */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  bass: "The bass (the low line)",
  pad: "The pad (the held chords)",
  lead: "The lead (the tune)",
};
export const MASK_LABELS = {
  pad: "The chords: they sit down in the bass's octave",
  lead: "The tune: it sits down in the bass's octave",
  none: "Neither: the bass has its octave to itself",
} as const;

export interface FrontEvent {
  track: string;
  t: number;
  dur: number;
  midi: number;
  gain: number;
}

/** Equal post-sound gain and a unique winner by distinct bar patterns, independent of register/rate. */
export function frontChecks(events: readonly FrontEvent[]): Record<Role, boolean> {
  const roles: Role[] = ["bass", "pad", "lead"];
  const counts = roles.map((role) => {
    const track = role === "lead" ? "mel" : role;
    const bars = Array.from({ length: 4 }, (_, b) =>
      events.filter((e) => e.track === track && Math.floor(e.t) === b),
    );
    if (bars.some((bar) => bar.length === 0)) return 0;
    return new Set(
      bars.map((bar) =>
        bar
          .map((e) => `${e.t % 1}|${e.dur}|${e.midi}`)
          .sort()
          .join(" "),
      ),
    ).size;
  });
  const gains = events.map((e) => e.gain);
  const equal = gains.length > 0 && gains.every((g) => g > 0 && Math.abs(g - (gains[0] as number)) < 1e-9);
  return Object.fromEntries(
    roles.map((role, i) => [
      role,
      equal && (counts[i] as number) > 1 && counts.every((n, j) => i === j || (counts[i] as number) > n),
    ]),
  ) as Record<Role, boolean>;
}

function frontTrial(ctx: GenCtx) {
  const key = pickKey(ctx, "major");
  const front = ctx.rng.pick(["bass", "pad", "lead"] as const);
  const highPad = ctx.rng.next() < 0.5;
  const octaves = { bass: 2, pad: highPad ? 4 : 3, lead: highPad ? 3 : 5 };
  const sounds = {
    bass: ctx.rng.pick(ROLE_SOUNDS.bass),
    pad: ctx.rng.pick(ROLE_SOUNDS.pad),
    lead: ctx.rng.pick(ROLE_SOUNDS.lead),
  };
  // A repeating background may be busier than the changing part. The pad keeps its held chords.
  const busy = front === "bass" ? "lead" : front === "lead" ? "bass" : ctx.rng.pick(["bass", "lead"]);
  const rates = {
    bass: busy === "bass" ? 8 : ctx.rng.pick([2, 4]),
    pad: 1,
    lead: busy === "lead" ? 8 : ctx.rng.pick([2, 4]),
  };
  const changes = ctx.rng.shuffle([0, 1, 2, 3]);
  const tracks: TrackSpec[] = (["bass", "pad", "lead"] as const).map((role) => ({
    label: role === "lead" ? "mel" : role,
    src: "note",
    pat: {
      t: "alt",
      items: Array.from({ length: 4 }, (_, bar) => {
        const offset = role === front ? (changes[bar] as number) : 0;
        const name = (degree: number) => spellMidi(stepToMidi(degree + offset, key, octaves[role]), key).code;
        return role === "pad"
          ? chordOf([0, 2, 4].map(name))
          : line(Array.from({ length: rates[role] }, (_, i) => name(i % 2 === 0 ? 0 : 2)));
      }),
    },
    s: sounds[role],
    // The pack supplies each sound's own level; no role gets an additional loudness cue.
    gain: 0.55,
  }));
  const piece = buildPiece({ bpm: pickTempo(ctx), bars: 4, tracks });
  const checks = frontChecks(
    piece.events.map((e) => ({
      track: e.track,
      t: e.onset[0] / e.onset[1],
      dur: e.dur[0] / e.dur[1],
      midi: e.midi as number,
      gain: e.gain,
    })),
  );
  if (!checks[front] || Object.values(checks).filter(Boolean).length !== 1)
    throw new Error("ambiguous front part");
  return trialOf(piece, { choice: [ROLE_LABELS[front]] }, cueOf(ctx), {
    mode: "choice",
    key,
    options: Object.values(ROLE_LABELS),
    front,
    sounds,
    prompt: "Which part is in front: which changes most from bar to bar?",
  });
}

/**
 * `fam.snd.roles` (A2.L01, content/specs/A2.md). Level 1 "roles": two bars of bass, pad and lead, then two bars
 * with one of them gone; which part dropped out? Level 2 "masking": one of the upper parts dropped into the
 * bass's register (close thirds under C3, or the tune two octaves down), or neither; which one crowds the bass?
 * The clean mix is the near miss of each muddy one (the same notes, the register changed).
 */
export const soundRoles: Generator = {
  name: "sound-roles",
  generate(ctx) {
    if (ctx.category === "front") return frontTrial(ctx);
    const key = pickKey(ctx, "major");
    const sounds = {
      bass: ctx.rng.pick(ROLE_SOUNDS.bass),
      pad: ctx.rng.pick(ROLE_SOUNDS.pad),
      lead: ctx.rng.pick(ROLE_SOUNDS.lead),
    };
    const chords = [rn("1", "maj"), rn("6", "min"), rn("4", "maj"), rn("5", "maj")];
    const masking = ctx.category === "masking";
    const muddy: Role | "none" = masking ? ctx.rng.pick(["pad", "lead", "none"] as const) : "none";
    const voiced = voiceProgression(chords, key);
    // A muddy part sits in the bass's own octave (C2–B2, where the bass's roots A1–A♭2 sound): every note
    // folded into it. The clean mix keeps the pad around middle C and the tune an octave above.
    const fold = (m: number): number => 36 + mod(m - 36, 12);
    const padNotes = voiced.map((v) =>
      muddy === "pad" ? [...new Set(v.midis.slice(1).map(fold))].sort((a, b) => a - b) : v.midis.slice(1),
    );
    const padBars = padNotes.map((ns) => seq([chordOf(ns.map((m) => spellMidi(m, key).code))]));
    const bassBars = voiced.map((v) =>
      line([spellMidi(above(v.rootPc, 33), key).code, null, spellMidi(above(v.rootPc, 33), key).code, null]),
    );
    const leadBars = chords.map((_c, i) =>
      line(
        [0, 2, 4, 2].map((s) => {
          const m = stepToMidi(s + ([0, 5, 3, 4][i] as number), key, 4);
          return spellMidi(muddy === "lead" ? fold(m) : m, key).code;
        }),
      ),
    );
    const dropped: Role | null = masking ? null : ctx.rng.pick(["bass", "pad", "lead"] as const);
    // Roles: bars 3–4 repeat bars 1–2 without the dropped part (a rest in its place).
    const lineOf = (role: Role, bars: Node[]): Node => {
      if (dropped !== role) return { t: "alt", items: bars };
      return { t: "alt", items: [bars[0] as Node, bars[1] as Node, seq([rest]), seq([rest])] };
    };
    const piece = buildPiece({
      bpm: pickTempo(ctx),
      bars: 4,
      tracks: [
        { label: "bass", src: "note", pat: lineOf("bass", bassBars), s: sounds.bass, gain: jitter(ctx, 0.8) },
        { label: "pad", src: "note", pat: lineOf("pad", padBars), s: sounds.pad, gain: jitter(ctx, 0.45) },
        { label: "mel", src: "note", pat: lineOf("lead", leadBars), s: sounds.lead, gain: jitter(ctx, 0.65) },
      ],
    });
    if (masking) {
      const options = Object.keys(MASK_LABELS);
      return trialOf(piece, { choice: [muddy] }, cueOf(ctx), {
        mode: "choice",
        key,
        options,
        optionLabels: MASK_LABELS,
        muddy,
        sounds,
        prompt: "Does a part crowd the bass's register? Which one?",
      });
    }
    const options = Object.keys(ROLE_LABELS);
    return trialOf(piece, { choice: [dropped as Role] }, cueOf(ctx), {
      mode: "choice",
      key,
      options,
      optionLabels: ROLE_LABELS,
      dropped,
      sounds,
      prompt: "Bars 3 and 4 lose one part. Which part dropped out?",
    });
  },
};
