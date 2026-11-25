import type { CardCheck, CardFacts, CardTrackFacts } from "@oak/content-kit";
import { spellMidi } from "@oak/theory";

function list(items: readonly string[], conjunction: "and" | "or" = "and"): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}

// Without a key, spellMidi uses C major's chromatic labels (including flats); cards use sharps for all black keys.
const SHARPS: Readonly<Record<number, string>> = { 1: "C#", 3: "D#", 6: "F#", 8: "G#", 10: "A#" };
function noteName(midi: number): string {
  const pitch = spellMidi(midi, { key: null });
  const sharp = SHARPS[((pitch.midi % 12) + 12) % 12];
  return sharp ? `${sharp}${Math.floor(pitch.midi / 12) - 1}` : pitch.name;
}

function rangeOf(track: CardTrackFacts & { low: number; high: number }): string {
  return track.distinct === 1
    ? `1 note, ${noteName(track.low)}`
    : `${track.distinct} different notes, from ${noteName(track.low)} to ${noteName(track.high)}`;
}

export function describeCard(check: CardCheck, facts: CardFacts): string {
  switch (check.kind) {
    case "tools": {
      const present = check.tools.filter((tool) => facts.tools.includes(tool.id));
      return present.length
        ? `This sketch uses ${list(present.map((tool) => tool.label))}.`
        : `No ${list(
            check.tools.map((tool) => tool.label),
            "or",
          )} so far.`;
    }
    case "sounds": {
      if (check.sounds.length === 0) {
        const tracks = facts.tracks.filter((track) => track.sounds.length > 0);
        return tracks.length
          ? `Sounds so far: ${tracks.map((track) => `${track.label}: ${track.sounds.join(", ")}`).join("; ")}.`
          : "No sound plays yet.";
      }
      const tracks = facts.tracks.filter((track) => check.role === undefined || track.role === check.role);
      const present = check.sounds.filter((sound) => tracks.some((track) => track.sounds.includes(sound)));
      const labels = tracks
        .filter((track) => present.some((sound) => track.sounds.includes(sound)))
        .map((track) => track.label);
      return present.length
        ? `${list(present)} ${present.length === 1 ? "plays" : "play"} in ${list(labels)}.`
        : `No ${list(check.sounds, "or")} so far.`;
    }
    case "range": {
      const tracks = facts.tracks.filter(
        (track): track is CardTrackFacts & { low: number; high: number } =>
          track.role === check.role && track.low !== null && track.high !== null && track.distinct > 0,
      );
      const first = tracks[0];
      if (!first) return `No ${check.role} yet.`;
      if (tracks.length === 1)
        return `The ${check.role} ${check.role === "chords" ? "use" : "uses"} ${rangeOf(first)}.`;
      return `The ${check.role} parts: ${tracks.map((track) => `${track.label} uses ${rangeOf(track)}`).join("; ")}.`;
    }
    case "parts": {
      const tracks = facts.tracks.filter((track) => track.notes > 0);
      if (tracks.length === 0) return "No part plays yet.";
      return `${tracks.length} ${tracks.length === 1 ? "part plays" : "parts play"}: ${list(tracks.map((track) => track.label))}.`;
    }
    case "tempo":
      return facts.bpm === null
        ? "This sketch has no tempo line yet."
        : `This sketch is at ${Number(facts.bpm.toFixed(1))} BPM.`;
    case "numerals":
      return facts.numerals.length ? `The chords so far: ${facts.numerals.join("–")}.` : "No chords yet.";
  }
}
