// One line per calibration run for Settings › Voice and Audio ("Range · A2–E4, comfortable C3–C4"), and the
// learner's words for the input in use. Pure; the record's `result` is whatever the set-up part stored.
import type { CalibrationRecord, Profile } from "@oak/api";
import { formatNoteMidi } from "../lib/notes.ts";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function calibrationLine(r: CalibrationRecord): string {
  const x = r.result;
  switch (r.kind) {
    case "output": {
      const choice =
        x.choice === "bluetooth" ? "Bluetooth" : x.choice === "speakers" ? "Speakers" : "Wired headphones";
      return `Output · ${choice}${x.lrCorrect === true ? ", left and right correct" : x.lrCorrect === false ? ", sides swapped" : ""}`;
    }
    case "noise": {
      const db = num(x.floorDb);
      return `Noise floor · ${db === null ? "not measured" : `${Math.round(db)} dBFS`}`;
    }
    case "bleed":
      return `Headphone leak · ${x.heard === true ? "the mic heard Oak's sound" : "none"}`;
    case "tap-latency": {
      const ms = num(x.latencyMs);
      return `Tap latency · ${ms === null ? "not measured" : `${Math.round(ms)} ms`}`;
    }
    case "sing-latency": {
      const ms = num(x.latencyMs);
      return `Sing latency · ${ms === null ? "not measured" : `${Math.round(ms)} ms`}`;
    }
    case "range": {
      const lo = num(x.lowMidi);
      const hi = num(x.highMidi);
      const cl = num(x.comfortLowMidi);
      const ch = num(x.comfortHighMidi);
      if (lo === null || hi === null) return "Range · not measured";
      const comf =
        cl !== null && ch !== null ? `, comfortable ${formatNoteMidi(cl)}–${formatNoteMidi(ch)}` : "";
      return `Range · ${formatNoteMidi(lo)}–${formatNoteMidi(hi)}${comf}`;
    }
    case "pitch-match": {
      const c = num(x.centsError);
      if (x.first === true)
        return `First note · sung${c === null ? "" : ` (${c > 0 ? "+" : ""}${Math.round(c)}¢)`}`;
      const within = num(x.within);
      const trials = Array.isArray(x.trials) ? x.trials.length : null;
      return within === null || trials === null
        ? "Pitch match"
        : `Pitch match · ${within} of ${trials} within ±${num(x.windowCents) ?? 50}¢`;
    }
  }
}

/**
 * The newest speaker check, as Settings › Voice shows it: "none" or "your mic hears Oak's sound", or null when
 * none was run.
 */
export function lastLeak(items: readonly CalibrationRecord[]): { heard: boolean; words: string } | null {
  const r = items.find((x) => x.kind === "bleed" && typeof x.result.heard === "boolean");
  if (!r) return null;
  return r.result.heard === true
    ? { heard: true, words: "Your mic hears Oak's sound" }
    : { heard: false, words: "None: your mic doesn't hear Oak" };
}

/** The newest three-note pitch match, as Settings › Voice shows it ("2 of 3 within ±50¢ · 11 Nov"), or null. */
export function lastMatch(items: readonly CalibrationRecord[]): string | null {
  const r = items.find(
    (x) => x.kind === "pitch-match" && x.result.first !== true && Array.isArray(x.result.trials),
  );
  if (!r) return null;
  const within = num(r.result.within);
  const trials = (r.result.trials as unknown[]).length;
  return within === null ? null : `${within} of ${trials} within ±${num(r.result.windowCents) ?? 50}¢`;
}

export function inputLabel(p: Pick<Profile, "inputKind" | "quiet">): string {
  if (p.inputKind === "none") return "No microphone (Quiet mode)";
  const kind =
    p.inputKind === "builtin"
      ? "Built-in microphone"
      : p.inputKind === "bluetooth"
        ? "Bluetooth microphone"
        : "External microphone";
  return p.quiet ? `${kind} · Quiet mode on` : kind;
}
