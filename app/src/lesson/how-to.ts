// The "How" line under a step's task (content/AUTHORING.md §22.2 item 6). Prompts say what to do musically; the
// controls are said here, from the exercise's own data, the same way on every step of a kind. The owner, learning
// from the course, found the tap pad "weird and hard to understand": the count-in, the length of the take and the
// key to press were never said where the task is.
import type { Exercise } from "@oak/content-kit";
import { METERS } from "@oak/theory";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One or two short sentences, inline Markdown; `null` where the step needs no controls explained. */
export function howTo(
  ex: Exercise | undefined,
  opts: { beatsPerBar?: number; inSong?: boolean } = {},
): string | null {
  if (!ex) return null;
  const beats = opts.beatsPerBar ?? 4;
  switch (ex.kind) {
    case "tap": {
      const countIn = Math.max(1, ex.cue.countInBars);
      const clicks = `${countIn * beats} count-in clicks`;
      const keys =
        ex.lanes && ex.lanes.length > 1 ? "**F** for the first lane and **J** for the second" : "**Space**";
      if (ex.mode === "echo")
        return `Press **Start tapping**. Listen to the pattern, then tap it back with ${keys} (or click the pad). When the bars are up, press **Check**.`;
      if (ex.mode === "read")
        return `Press **Start tapping**. After ${clicks}, tap the written rhythm with ${keys} (or click the pad) for ${plural(ex.bars, "bar")}. When the bars are up, press **Check**.`;
      return `Press **Start tapping**. After ${clicks}, the music plays for ${plural(ex.bars, "bar")}. Tap with ${keys} (or click the pad) as the task says. When it stops, press **Check**.`;
    }
    case "sing":
      // The sing renderer says how beside its own Sing button (`singHowText`; in sight mode the widget's line
      // "Press Sing, wait for the count-in, then sing the notes on the staff"), and in Quiet mode there is no Sing
      // button at all. A second "Press Sing" line in the task box repeated it, and on U03.L09 S5 pushed Sing below
      // the fold at 1280×720.
      return null;
    case "code-modify":
    case "code-fill":
    case "error-hunt":
      return "Change the code on the right, press **Play** to hear it, then press **Check**.";
    case "code-make":
      // A take step's Make (a unit song): Save puts the code into the song, and the button says so.
      if (opts.inSong)
        return "Write in the editor and press **Play** to hear it in your song. The checklist ticks itself as you go. Press **Save into your song** when you are happy with it.";
      return "Write in the editor and press **Play** to hear it. The checklist ticks itself as you go. Press **Save sketch** when you are happy with it.";
    case "parsons":
      return "Drag the blocks into order, then press **Check**.";
    case "predict":
      return "Answer first, then press **Check** to run the code and hear if you were right.";
    case "run-investigate":
      return "Press **Play** and listen, then answer below and press **Check**.";
    case "identify":
    case "fact":
    case "keyboard":
    case "staff-read":
    case "staff-write":
    case "dictation":
    case "transcribe-step":
      return "Answer below, then press **Check**.";
    default:
      return null;
  }
}

/** Grid cells per beat on a lesson's tap pad, by what the learner has been taught (null: the pad's default). */
export function padStepsFor(lessonId: string, meter: string): number | null {
  if (!/^U0[01]\./.test(lessonId) || METERS[meter as keyof typeof METERS]?.tempoUnit !== "quarter")
    return null;
  if (lessonId < "U01.L04") return 1;
  if (lessonId < "U01.L06") return 2;
  return null;
}
