// Oak 2.0 W1 (PLAN S4, plain sounds): a listening aid that plays the learner's bass, chords and tune with one plain
// sound each, so the notes are heard without their sound design. A live filter on the playing pattern (like mute and
// solo, contracts §6.2 rule 3): the code is never rewritten, drums and the Band are untouched, and turning it off
// restores the sounds as written at once.
import { PLAIN_SOUNDS, roleOfLabel } from "@oak/content-kit";

/**
 * The sound-shaping keys a plain sound drops. Level (`gain`, `velocity`, `postgain`), place (`pan`), pitch (`note`,
 * `n`, `freq`) and length stay, so the part keeps its notes, rhythm and balance. The first group is W1's list (some
 * are aliases Strudel stores under another name: `.lpf` as `cutoff`, `.size` as `roomsize`, `.lpq` as `resonance`,
 * `.hpq` as `hresonance`); the second is the names Strudel 1.2.6 actually stores for those controls and the synth
 * modulation that would colour the plain sound (Oak's call, kept loose).
 */
export const PLAIN_STRIP: readonly string[] = [
  "bank",
  "lpf",
  "cutoff",
  "hpf",
  "hcutoff",
  "resonance",
  "lpq",
  "hpq",
  "room",
  "size",
  "roomsize",
  "delay",
  "delaytime",
  "delayfeedback",
  "distort",
  "crush",
  "coarse",
  "shape",
  "vowel",
  "phaser",
  "attack",
  "decay",
  "sustain",
  "release",
  // Stored names and synth modulation (Oak's call).
  "hresonance",
  "bandf",
  "bandq",
  "bpenv",
  "lpenv",
  "hpenv",
  "lpattack",
  "lpdecay",
  "lpsustain",
  "lprelease",
  "hpattack",
  "hpdecay",
  "hpsustain",
  "hprelease",
  "ftype",
  "drive",
  "distortvol",
  "distorttype",
  "shapevol",
  "phaserrate",
  "phaserdepth",
  "phasercenter",
  "phasersweep",
  "fmi",
  "fmh",
  "fmenv",
  "fmattack",
  "fmdecay",
  "fmsustain",
  "fmrelease",
  "vib",
  "vibmod",
  "detune",
  "unison",
  "spread",
  "penv",
  "pattack",
  "pdecay",
  "prelease",
];

const STRIP = new Set(PLAIN_STRIP);

type PlainRole = keyof typeof PLAIN_SOUNDS;

/** The plain role of a learner track, or null for drums, the Band, untagged haps and parts that carry no pitch. */
function plainRoleOf(track: string | null, value: Record<string, unknown>): PlainRole | null {
  if (track === null || track.startsWith("band.")) return null;
  const role = roleOfLabel(track);
  if (role === "bass" || role === "chords" || role === "tune") return role;
  if (role === "other" && (value.note !== undefined || value.freq !== undefined)) return "tune";
  return null;
}

/**
 * A hap value as plain sounds play it. On a learner `bass`, `chords` or `tune` track (by `roleOfLabel`; any other
 * label that carries a `note` or `freq` counts as `tune`): `s` becomes that role's plain sound and the
 * `PLAIN_STRIP` keys go. Anything else comes back as the same value.
 */
export function plainValue(value: unknown, track: string | null): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const v = value as Record<string, unknown>;
  const role = plainRoleOf(track, v);
  if (role === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, x] of Object.entries(v)) if (!STRIP.has(key)) out[key] = x;
  out.s = PLAIN_SOUNDS[role];
  return out;
}
