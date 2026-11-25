// Recording a performance through the @oak/strudel recorder (MediaRecorder on the master bus, UI sounds
// suppressed), for a capstone release and an album track's re-recording. No grader import: unit-testable.
// Oak 2.0 W4 F5: every take comes back normalised to the album's loudness (`normalize.ts`), once, here: both callers
// (`ReleaseDialog`, `TrackPage`) record through this function.
import type { EditorHandle, OakStrudel, Recording } from "@oak/strudel";
import { normalizeRecording } from "./normalize.ts";

/**
 * Plays the piece once from bar 1 and records it (the recorder starts at once when nothing plays; the editor
 * then starts on its first cycle). Resolves with the audio when the last bar and the tail have played: a silent
 * take is refused first, before any decoding; a take with sound comes back as a WAV at the album's loudness, or
 * as recorded when it cannot be decoded.
 */
export async function recordPerformance(
  oak: OakStrudel,
  handle: EditorHandle,
  bars: number,
): Promise<Recording> {
  await oak.unlock();
  if (handle.playing) handle.stop();
  const ran = await handle.evaluate({ autostart: false });
  if (!ran.ok) throw new Error(PIECE_DOES_NOT_RUN);
  const recording = oak.recorder.record({ bars, tailSec: 1.5 });
  // The recorder taps the master bus where its analyser listens: a take whose peak never leaves the noise floor
  // is silent (every part muted, a sample bank that did not load) and is not released as the learner's track.
  let peak = 0;
  const listen = setInterval(() => {
    peak = Math.max(peak, oak.master.level().peak);
  }, 40);
  try {
    // Once: the song's bars and nothing after them, so the tail rings out instead of starting the song again.
    await handle.play({ once: bars });
    const take = await recording;
    peak = Math.max(peak, oak.master.level().peak);
    if (isSilentTake(peak)) throw new Error(SILENT_TAKE);
    return await normalizeRecording(take, oak.ctx);
  } catch (e) {
    oak.recorder.cancel();
    throw e;
  } finally {
    clearInterval(listen);
    if (!handle.disposed) handle.stop();
  }
}

/** A take of code that does not evaluate (the editor shows the error). */
export const PIECE_DOES_NOT_RUN = "The piece doesn't run. Run it, fix the error it shows, then record again.";

/** Peak (linear, post-limiter) below which a take counts as silence: −70 dBFS. */
export const SILENT_PEAK = 10 ** (-70 / 20);
export const SILENT_TAKE =
  "The take was silent: no sound reached the recorder. Check that no part is muted (S) and that the piece plays, then record again.";
export function isSilentTake(peak: number): boolean {
  return !(peak >= SILENT_PEAK);
}
