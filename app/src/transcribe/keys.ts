// Transcribe's keys (ux §7.10 "Transcription", contracts §11.9 scope `transcription`): every transport action
// has one, and each appears in the shortcut sheet under "Transcribe". They act while focus is in the project
// page outside the editor; inside the Workbench its own keys win (contracts §11.9).
import type { Binding } from "../ui/keys/keymap.ts";

export type TranscribeAction =
  | "play"
  | "setA"
  | "setB"
  | "loop"
  | "rateDown"
  | "rateUp"
  | "semiDown"
  | "semiUp"
  | "centsDown"
  | "centsUp"
  | "abToggle"
  | "overlay"
  | "tap"
  | "prevBar"
  | "nextBar"
  | "zoomIn"
  | "zoomOut"
  | "spectrogram"
  // Wave 5: song items (L5 phrases, L6 lines and choruses), listening to one layer, and own audio's bars.
  | "loopLine"
  | "prevLine"
  | "nextLine"
  | "loopChorus"
  | "listenBass"
  | "listenNoMelody"
  | "downbeatEarlier"
  | "downbeatLater"
  | "swing"
  // Wave 6: the form map of a standard (L8) and of the learner's own recording.
  | "formCut"
  | "formFocus"
  // Wave 7: swung 16ths on own audio's grid, and the two-bar clave grid over any timeline.
  | "swing16"
  | "clave";

export const TRANSCRIBE_KEYS: readonly { action: TranscribeAction; keys: string; description: string }[] = [
  { action: "play", keys: "Space", description: "Play or pause" },
  { action: "setA", keys: "[", description: "Set the loop start (A) at the playhead" },
  { action: "setB", keys: "]", description: "Set the loop end (B) at the playhead" },
  { action: "loop", keys: "L", description: "Loop on or off" },
  { action: "rateDown", keys: ",", description: "Slower by 5%" },
  { action: "rateUp", keys: ".", description: "Faster by 5%" },
  { action: "semiDown", keys: "-", description: "Transpose down a semitone" },
  { action: "semiUp", keys: "=", description: "Transpose up a semitone" },
  { action: "centsDown", keys: "_", description: "Fine-tune down 5 cents (Shift+-)" },
  { action: "centsUp", keys: "Plus", description: "Fine-tune up 5 cents (Shift+=)" },
  { action: "abToggle", keys: "V", description: "Switch between the source and your code" },
  { action: "overlay", keys: "O", description: "Hear both together" },
  { action: "tap", keys: "T", description: "Tap the tempo (from a bar's first beat)" },
  { action: "prevBar", keys: "Alt+ArrowLeft", description: "Previous bar" },
  { action: "nextBar", keys: "Alt+ArrowRight", description: "Next bar" },
  { action: "zoomIn", keys: ">", description: "Zoom the waveform in" },
  { action: "zoomOut", keys: "<", description: "Zoom the waveform out" },
  { action: "spectrogram", keys: "Shift+S", description: "Spectrogram on or off" },
  {
    action: "loopLine",
    keys: "1",
    description: "Loop phrase, line or section 1 of a song (2 to 9 likewise)",
  },
  { action: "prevLine", keys: "PageUp", description: "Loop the previous phrase or 4-bar line" },
  { action: "nextLine", keys: "PageDown", description: "Loop the next phrase or 4-bar line" },
  { action: "loopChorus", keys: "C", description: "Loop the chorus at the playhead (a blues: its 12 bars)" },
  { action: "listenBass", keys: "Shift+B", description: "Hear the bass alone (again: everything)" },
  {
    action: "listenNoMelody",
    keys: "Shift+M",
    description: "Hear it without the melody (again: everything)",
  },
  {
    action: "downbeatEarlier",
    keys: "Shift+ArrowLeft",
    description: "Your audio: move bar 1 a beat earlier",
  },
  { action: "downbeatLater", keys: "Shift+ArrowRight", description: "Your audio: move bar 1 a beat later" },
  { action: "swing", keys: "W", description: "Your audio: swing 8ths on the bar grid, on or off" },
  {
    action: "formCut",
    keys: "X",
    description: "Form map: cut a section at the bar now playing (again: join it back)",
  },
  { action: "formFocus", keys: "Shift+X", description: "Form map: go to the form strip" },
  { action: "swing16", keys: "G", description: "Your audio: swung 16ths on the bar grid, on or off" },
  {
    action: "clave",
    keys: "K",
    description: "The two-bar clave grid over the bars: son 3-2, son 2-3, rumba 3-2, rumba 2-3, off",
  },
];

export const TRANSCRIBE_KEY_GROUP = "Transcribe";

/** Keys a focused control keeps for itself (a slider's PageUp/PageDown, a radio group's arrows). */
const CONTROL_KEYS: ReadonlySet<TranscribeAction> = new Set(["play", "prevLine", "nextLine"]);

/**
 * The bindings for `useHotkeys`: one per action, scope `transcription`, `run` dispatching to `act`. `loopLine` is
 * bound to the digits 1–9 and passes the digit as `n`.
 */
export function transcribeBindings(
  act: (a: TranscribeAction, n?: number) => void,
  enabled: (a: TranscribeAction) => boolean = () => true,
): Binding[] {
  return TRANSCRIBE_KEYS.flatMap((k) => {
    const base = {
      scope: "transcription" as const,
      // Space on a focused button presses the button (the same action for the Play button); a focused slider
      // keeps PageUp/PageDown.
      when: (ctx: { onControl: boolean }) =>
        enabled(k.action) && !(CONTROL_KEYS.has(k.action) && ctx.onControl),
    };
    if (k.action === "loopLine")
      return Array.from({ length: 9 }, (_, i) => ({
        ...base,
        id: `transcribe:loopLine:${i + 1}`,
        keys: String(i + 1),
        // One row in the shortcut sheet stands for the nine digits.
        ...(i === 0 ? { group: TRANSCRIBE_KEY_GROUP } : {}),
        description: i === 0 ? k.description : `Loop phrase or line ${i + 1} of a song`,
        run: () => act("loopLine", i + 1),
      }));
    return [
      {
        ...base,
        id: `transcribe:${k.action}`,
        keys: k.keys,
        group: TRANSCRIBE_KEY_GROUP,
        description: k.description,
        run: () => act(k.action),
      },
    ];
  });
}

/** The key shown next to a control ("Space", "[", "V"). */
export function keyOf(action: TranscribeAction): string {
  return TRANSCRIBE_KEYS.find((k) => k.action === action)?.keys ?? "";
}
