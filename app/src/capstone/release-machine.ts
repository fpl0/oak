// The release flow (XState 5, ux §2.3): name the track, write its one line, choose whether Claude's liner note
// goes in, record the performance, listen back, release.
//
//   details → recording → take ⇄ recording → releasing → released
//                 ↘ details (error)         ↘ take (error)
//
// The performance may be taken again: every take of the sitting is kept (d20) and one is chosen for the album. A
// take that fails (stopped, silent) leaves the earlier ones as they were.
//
// `record` and `release` are actors the workspace provides (the recorder and the server); the machine decides.
import type { Recording } from "@oak/strudel";
import { assign, fromPromise, setup } from "xstate";

export interface ReleaseDetails {
  title: string;
  /** The learner's one line for the liner notes. */
  line: string;
  includeReviewNote: boolean;
  /**
   * Oak 2.0 W4 F6: "Put it on the Shelf, not on the album". `true` releases to the Shelf, `false` to the album;
   * absent until the learner chooses (the workspace then sends the track's current place).
   */
  shelved?: boolean;
}

export interface ReleaseContext extends ReleaseDetails {
  /** The take that goes on the album as the one that plays: `takes[chosen]`. */
  recording: Recording | null;
  /** Every take of this sitting, in the order they were recorded. */
  takes: Recording[];
  /** Index into `takes` of the chosen one (the newest unless the learner picks another). */
  chosen: number;
  error: string | null;
  /** The released version (`AlbumTrackVersion.version`) and track. */
  trackId: string | null;
  version: number | null;
  audioError: string | null;
}

export type ReleaseEvent =
  | { type: "EDIT"; patch: Partial<ReleaseDetails> }
  | { type: "RECORD" }
  /** Choose which take plays on the album (an index into `takes`). */
  | { type: "CHOOSE"; index: number }
  /** Only when this browser cannot record (no MediaRecorder): the album shows "No recording yet". */
  | { type: "RELEASE_WITHOUT_AUDIO" }
  | { type: "RELEASE" }
  | { type: "BACK" };

export interface ReleaseActorInput extends ReleaseDetails {
  recording: Recording | null;
  /** The other takes of the sitting, kept with the track beside the chosen one. */
  otherTakes: Recording[];
}
export interface ReleaseActorOutput {
  trackId: string;
  version: number;
  audioError: string | null;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const releaseMachine = setup({
  types: {
    context: {} as ReleaseContext,
    events: {} as ReleaseEvent,
    input: {} as ReleaseDetails,
  },
  actors: {
    record: fromPromise<Recording, void>(async () => {
      throw new Error("record actor not provided");
    }),
    release: fromPromise<ReleaseActorOutput, ReleaseActorInput>(async () => {
      throw new Error("release actor not provided");
    }),
  },
  guards: {
    named: ({ context }) => context.title.trim().length > 0,
  },
}).createMachine({
  id: "capstone-release",
  context: ({ input }) => ({
    ...input,
    recording: null,
    takes: [],
    chosen: 0,
    error: null,
    trackId: null,
    version: null,
    audioError: null,
  }),
  initial: "details",
  states: {
    details: {
      on: {
        EDIT: { actions: assign(({ context, event }) => ({ ...context, ...event.patch, error: null })) },
        RECORD: { guard: "named", target: "recording" },
        RELEASE_WITHOUT_AUDIO: { guard: "named", target: "releasing" },
      },
    },
    recording: {
      entry: assign({ error: null }),
      invoke: {
        src: "record",
        onDone: {
          target: "take",
          actions: assign(({ context, event }) => {
            const takes = [...context.takes, event.output];
            return { takes, chosen: takes.length - 1, recording: event.output };
          }),
        },
        onError: [
          {
            // An earlier take is still there: back to it, with what went wrong.
            guard: ({ context }) => context.takes.length > 0,
            target: "take",
            actions: assign({ error: ({ event }) => message(event.error) }),
          },
          { target: "details", actions: assign({ error: ({ event }) => message(event.error) }) },
        ],
      },
    },
    take: {
      on: {
        RECORD: "recording",
        CHOOSE: {
          guard: ({ context, event }) => event.index >= 0 && event.index < context.takes.length,
          actions: assign(({ context, event }) => ({
            chosen: event.index,
            recording: context.takes[event.index] ?? context.recording,
          })),
        },
        RELEASE: "releasing",
        BACK: "details",
        EDIT: { actions: assign(({ context, event }) => ({ ...context, ...event.patch })) },
      },
    },
    releasing: {
      entry: assign({ error: null }),
      invoke: {
        src: "release",
        input: ({ context }) => ({
          title: context.title.trim(),
          line: context.line.trim(),
          includeReviewNote: context.includeReviewNote,
          ...(context.shelved === undefined ? {} : { shelved: context.shelved }),
          recording: context.recording,
          otherTakes: context.takes.filter((_, i) => i !== context.chosen),
        }),
        onDone: {
          target: "released",
          actions: assign({
            trackId: ({ event }) => event.output.trackId,
            version: ({ event }) => event.output.version,
            audioError: ({ event }) => event.output.audioError,
          }),
        },
        onError: [
          {
            guard: ({ context }) => context.recording !== null,
            target: "take",
            actions: assign({ error: ({ event }) => message(event.error) }),
          },
          { target: "details", actions: assign({ error: ({ event }) => message(event.error) }) },
        ],
      },
    },
    released: { type: "final" },
  },
});
