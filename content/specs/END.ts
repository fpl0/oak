// The end of the core, as a spec (contracts §2.5 "core complete"; docs/design/wave6.md §5.5; ux §5.5 M7): what
// the learner sees when the last piece of the core lands, and on the days after. It has no lessons and no
// capstones: the session, capstone and server engineers build its surfaces from this document. The two
// finale tracks themselves are content/specs/CF.ts. Titles and the milestone's words are read from the
// registries, so this spec cannot disagree with them.
import { capstones } from "../capstones.ts";
import { milestones } from "../milestones.ts";
import type { UnitSpec } from "./types.ts";

const ms07 = milestones.find((m) => m.id === "ms.07");
const MS07_TITLE = ms07?.title ?? "";
const MS07_TEXT = ms07?.description ?? "";

/**
 * Side A in running order: the core capstones as content/capstones.ts lists them, with the single moved to the
 * end, so the record closes on the learner's own song (and the standard, released earlier, sits before it).
 */
const core = capstones.filter((c) => !/^(JC|RC|AC)\d/.test(c.id));
export const SIDE_A_ORDER: readonly string[] = [
  ...core.filter((c) => c.id !== "CF-A").map((c) => c.id as string),
  "CF-A",
];
const titleOf = (id: string) =>
  (core.find((c) => c.id === id)?.title ?? id).replace(/^\S+\s/, "").replace(/^Core Finale: /, "");
const RUNNING_ORDER = SIDE_A_ORDER.map((id, i) => `${i + 1} ${titleOf(id)} (${id})`).join(", ");

export const END: UnitSpec = {
  unit: "END",
  title: "The End of the Core",
  summary: `What the learner sees when the core is complete, and what the app is on the days after. In the default order the last piece is the release of the single at the end of CF-A.S4, session 185: the take has just played, two minutes and more of the learner's own song. The Coda of that session is the ending. It has four parts on one page, in this order: the record (Side A, ${SIDE_A_ORDER.length} tracks, with a way to play it through), what the learner can now do (from graded evidence), the Oak (every core limb at full length), and what is open now (with one real thing for tomorrow). It is said once, calmly, with the learner's own music and their own numbers. Nothing celebrates on their behalf. The next day Today is an ordinary day with a session in it.`,
  lessons: [],
  capstones: [],
  conventions: [
    'Session 185 is the core\'s last in the default order of contracts 1.6 (the wave plan and some comments in `packages/api` still say 183). No surface shows a session number or a count of sessions "left".',
    "The ending is one page. The four parts are sections of the finale Coda, so the record can keep playing while the learner reads the rest; nothing in it navigates by itself.",
    "Every number and every sentence about the learner comes from the server (`SessionSummary.coreComplete`, `course.completion`, `cando.list`, the album, the skill map). The page only counts and formats what it is given, and invents no praise.",
    "The same parts are reachable afterwards: `/album` is the record, `/progress` keeps the can-do ledger and a permanent line for the day the core was finished, `/oak` is the Oak. The finale Coda itself can be reopened from that line.",
    "Copy is given word for word below. Braces mark values. Sentences end with a full stop, never an exclamation mark.",
    "Both themes, keyboard only, reduced motion, Quiet mode and a learner with no recordings are states of every surface, listed with it.",
  ],
  ending: {
    summary:
      "The core is complete when every core lesson is completed, every core checkpoint is passed or soft-passed, and all twelve core tracks are released (C0–C7, X1, X2, CF-A, CF-T). That instant is recorded once (`completedAt`). The session that reached it ends in the finale Coda; every later day, Today plans from what is open.",
    when: [
      "Stages (`CORE_STAGES`, wave6.md §5.5): `in-progress` while a core lesson or checkpoint remains; `lessons-done` when none remains and at least one core track is unreleased; `complete` when all twelve are out. Core lessons are linear and CF-A needs C7, which needs U17.CP: by the time CF-A opens, the stage is `lessons-done`.",
      "The trigger is whatever lands last. In the default order: the release in CF-A.S4 (session 185). It can be CF-T's release, or a track left open months ago (X1 may stay closed for a while, contracts §2.4). The ending is the same; its first card is that session's own release.",
      "`lessons-done` is not the ending. Today and the Coda say what is left in one line and show no finale.",
      "Once: only the summary of the session that completed the core carries `coreComplete`. It is stored with that summary, so reopening that Coda shows the ending again; no later Coda repeats it.",
      `The milestone ms.07 ("${MS07_TITLE}") is shown by the ending and only by it. Today its condition is the two finales alone: a learner who releases both with another track still open would be told Side A is complete with eleven tracks on it. The ending shows ms.07 when the stage is \`complete\`; until the registry says the same, the server holds ms.07 back while the stage is \`lessons-done\` (requested; see Notes).`,
    ],
    principles: [
      "A real ending. The heading is one sentence, the milestone's. There is no confetti, no fanfare, no badge, no trophy, no counting-up number, no modal. The only sound is the learner's own music, and only when they press play.",
      "Evidence, not praise. A track is on the record because it was released. A can-do line is shown because graded work made it solid or strong, and the line says which work. The numbers are the learner's own and are compared with nothing.",
      "Honest. Leaves that are pale are drawn pale. Statements that are still settling are counted, in one calm line. A track with no lessons yet says so and is not a button.",
      "A real next step. Exactly one thing is named for tomorrow, and it can be started tomorrow. The list under it holds only things that exist.",
      'Short. The ending adds about two minutes of reading to the Coda. "Done for today" is reachable with Enter at any moment; playing the record through is offered, never required.',
      "The same app tomorrow. No surface says or implies that the learner has finished with Oak. The Oak needs its reviews, the gym has standards left, the sketchbook is open, and the tracks are named for what they are.",
    ],
    epr: {
      enjoyment:
        "The session ends with the learner's own song on a finished record, and the record can be played from its first track to that song: half a year of their own music, in order, in about ten minutes.",
      pace: "One page, four short parts, about two minutes to read; the play-through runs beside the reading and can be left for another day. Nothing new is asked of the learner on the day they finish.",
      return:
        "The page ends on tomorrow: one named session that exists (reviews, the gym's next standard, or the first lesson of a track once tracks have lessons), and a short list of what else is open. The next day's Today is an ordinary Today.",
    },
    surfaces: [
      {
        id: "coda",
        title: "The finale Coda",
        owner: "session",
        where:
          '`/session/coda`, for the session whose summary carries `coreComplete` with `stage: "complete"`. A section of the existing Coda (`app/src/session/coda/`), replacing its "Next" card.',
        purpose:
          "The ending itself. The usual Coda cards for the day come first and stay short; then the finale section with its four parts; then the two buttons.",
        sees: [
          "The session's own release card, as on any release day (the single's cover, its title, play).",
          `The heading "${MS07_TITLE}" and under it the milestone's own text, then the road in one line of the learner's numbers.`,
          "The record (surface `record`).",
          "What you can now do (surface `can-do`).",
          "Your Oak (surface `oak`).",
          "What is open now, ending on the line for tomorrow (surface `open`).",
          'The weekly rhythm line, as every day, and the listening note if the learner asks for one. Then the buttons: "Done for today" (primary) and "Keep playing in Studio".',
        ],
        hears:
          "Nothing by itself. The release card and the record play when the learner presses play. The milestone banner's usual two bars are not played on this day: the record is there instead.",
        actions: [
          '"Done for today" (Enter): ends the day as on any day.',
          '"Keep playing in Studio": as on any day.',
          "Tab order follows the page: release, record, can-do link, Oak link, open list, buttons. Every link opens its page in the same tab; coming back returns to the Coda with the record stopped.",
        ],
        data: [
          "`SessionSummary.coreComplete` (`CoreCompletion`): `milestone`, `stats`, `canDo`, `album`, `open`.",
          'The cards that stay: the release (as today), the weekly rhythm, the listening note. The cards the finale replaces on this day: can-do changes (shown inside `can-do`, marked "new today"), the tree (shown as `oak`), the teaser and the goal-gradient line (there is no next lesson to tease).',
        ],
        states: [
          "Reduced motion: every part is present at once; no card slides in.",
          "The last piece was not the single (CF-T, or a track left open): the same section under that track's release card.",
          'Reopened later from `/progress`: the same page, read-only, with "Back to Progress" in place of the two buttons.',
          "The summary fails to load: the Coda's usual error state with Retry; the release has already happened and nothing is lost.",
          "1280×800: the heading, the road and the top of the record are visible without scrolling; the whole section is at most three screens.",
        ],
        copy: [
          { where: "Heading", text: MS07_TITLE },
          { where: "Under the heading", text: MS07_TEXT },
          {
            where: "The road (one line; a value of zero drops its clause)",
            text: "Since {first day, as 3 March}: {sessions} sessions on {days} days, about {hours} hours of practice. {lessons} lessons, {tracks} tracks, {transcriptions} transcriptions, {sketches} sketches.",
          },
          { where: "Primary button", text: "Done for today" },
          { where: "Secondary button", text: "Keep playing in Studio" },
        ],
      },
      {
        id: "record",
        title: "The record: Side A, finished",
        owner: "capstone",
        where:
          "A component of the album (`app/src/album/`, exported for the Coda) used in the finale Coda and as the header of `/album` once Side A is complete.",
        purpose:
          "The album as a finished record: twelve covers in running order, its length, and one button that plays it from the first track to the last.",
        sees: [
          'The album\'s title (the learner\'s; "Oak Sessions" until they change it), "Side A", the number of tracks and the total running time.',
          `The twelve covers in running order, each with its number, its title and its length: ${RUNNING_ORDER}. Six to a row at 1440, four at 1280.`,
          '"Play Side A". While it plays: the playing cover is outlined, and one line says where the record is.',
          '"Open the album" (in the Coda only).',
        ],
        hears:
          "Each track's chosen take, in running order, with a breath of a second and a half between tracks. It keeps playing while the learner scrolls and stops when they leave the page or press Stop. It never starts by itself.",
        actions: [
          '"Play Side A" / "Stop" (Space when focus is inside the record).',
          "A click or Enter on a cover plays from that track on. Left and Right move between covers.",
          '"Open the album": `/album`.',
        ],
        data: [
          "`album.list` and each track's current version (`hasAudio`, `durationS`, `currentTake`); audio from `album.getAudio`.",
          "The running order: the core capstones in registry order with the single last (`SIDE_A_ORDER` in this spec's source; today the album lists CF-A before CF-T). `coreComplete.album` gives `released` and `total` (12 of 12 on this day).",
        ],
        states: [
          'A track with no recording (released without one, or its file is missing): it is skipped in the play-through, its cover says "No recording yet", and its page offers "Record a take". The running time counts the tracks that have one.',
          "A track with several takes: the chosen one plays (d20).",
          "Loading: twelve cover-sized placeholders, the button disabled.",
          "Reduced motion: the record on the sleeve does not turn; the outline moves without a transition.",
          "Before Side A is complete, `/album` is as it is today (empty slots say what opens them); this header replaces the sleeve's only once all twelve are out.",
          "Both themes: covers keep their own colours; the outline and the line under it use the theme's tokens.",
        ],
        copy: [
          { where: "Title line", text: "{album title} · Side A · 12 tracks · {m:ss}" },
          { where: "Button", text: "Play Side A" },
          { where: "Button while playing", text: "Stop" },
          { where: "Now playing", text: "{n} of 12 · {track title} · {elapsed} / {length}" },
          { where: "A cover with no recording", text: "No recording yet" },
          { where: "Link (Coda only)", text: "Open the album" },
        ],
      },
      {
        id: "can-do",
        title: "What you can now do",
        owner: "session",
        where: "A part of the finale Coda. The full ledger stays on `/progress`.",
        purpose:
          "Seven sentences at most, one for each kind of thing the learner can do, each backed by the graded work that made it true.",
        sees: [
          'Up to seven lines, in this order of areas: compose, transcribe, hear, write, read, code, sing. Each is a can-do statement in the learner\'s voice ("I can finish a two-minute song with a bridge.") with its evidence beside it in quieter type.',
          'A line whose status changed today is marked "new today".',
          "One closing line with the counts, and a link to the whole ledger.",
        ],
        actions: ['"See all of them": `/progress`, at the can-do ledger.'],
        data: [
          '`coreComplete.canDo` (`candoId`, `text`, `status`): chosen by the server with the rule in "The server\'s part": one per area, only `solid` or `strong`.',
          'The evidence beside a line: the latest `cando.list` entry for that statement (`evidenceKind`, `evidenceId`, `at`), worded by kind. Track: "from {track title}, released {date}". Transcription: "from {song title}, by ear". Checkpoint: "the {unit} checkpoint". Lesson: "{lesson title}". Set: "review sets, last on {date}".',
          "The counts: statements at `solid` or `strong`, and statements at `emerging` or `fading`, among the can-dos whose source is in the core (`cando.list` against the registry).",
        ],
        states: [
          "An area with nothing solid yet is left out; the list is simply shorter. Singing in particular: a learner in Quiet mode has no sung evidence, and no line says so.",
          "Nothing is still settling: the second sentence of the closing line is dropped.",
          "A statement that is `fading` is never in the seven, and never named here.",
        ],
        copy: [
          { where: "Heading", text: "What you can now do" },
          { where: "Mark on a line that changed today", text: "new today" },
          {
            where: "Closing line",
            text: "{n} of {total} statements are solid or strong. {m} are still settling; reviews firm them up.",
          },
          { where: "Link", text: "See all of them" },
        ],
      },
      {
        id: "oak",
        title: "Your Oak",
        owner: "session",
        where: "A part of the finale Coda, drawn with the map's `OakGlance` (`app/src/map/`).",
        purpose:
          "The picture of the same fact: every leaf of the core has opened. It shows the tree as it is today, pale leaves included, and what part of it is still bare.",
        sees: [
          "The Oak at 320 px: every core unit's row at full length, leaves shaded as on the map (hue from mastery, paleness from freshness), the released tracks where the map draws them, the rows of the tracks still bare.",
          "Two or three lines under it, from the leaf counts.",
          '"Open the Oak".',
        ],
        actions: ['"Open the Oak": `/oak`.'],
        data: [
          "The skill map as `/oak` reads it (`useOak`, `countLeaves`, `leafView`): leaves by status (`mastered`, `practising`, `introduced`) among core nodes, and `drying` (leaves whose cards are in the next planned warm-up).",
        ],
        states: [
          "Reduced motion: no growth is drawn; the tree is simply there.",
          "No leaf is in the next warm-up: the third line is dropped.",
          "Production leaves with no microphone keep their mic glyph, as on the map.",
          'The map fails to load: "The map is not available right now." and the link.',
        ],
        copy: [
          { where: "Heading", text: "Your Oak" },
          {
            where: "Line 1",
            text: "Every limb of the core is at full length: {mastered} leaves mastered, {practising} practising, {introduced} still settling.",
          },
          {
            where: "Line 2",
            text: "The crown and the deep roots are still to grow: they are the jazz, rhythm and arrangement tracks.",
          },
          { where: "Line 3 (only when some are)", text: "{n} leaves are in your next warm-up." },
          { where: "Link", text: "Open the Oak" },
        ],
      },
      {
        id: "open",
        title: "What is open now",
        owner: "session",
        where: "The last part of the finale Coda; the same list, shorter, on Today from the next day on.",
        purpose:
          "The next step, and it is real: one line for tomorrow that names a session the learner can start, then what else is open. Things that cannot be started yet say so and are not buttons.",
        sees: [
          'The line for tomorrow: "Tomorrow:" and the first entry that can be started.',
          "The entries that can be started, each a row with a title and one line: reviews, the Transcription Gym, Studio, the next side lesson; a track's next lesson once tracks have lessons.",
          "Then the entries that cannot be started yet, in quieter type and without an arrow: today, the three tracks.",
        ],
        actions: [
          'A row that can be started links to where it starts: reviews and the gym to Today (they start from there, tomorrow), Studio to `/studio`, a side lesson to its lesson. On the day of the ending these are links, not "start now" buttons: the day is done.',
          "A row that cannot be started has no link.",
        ],
        data: [
          "`coreComplete.open` (`kind`, `id`, `title`, `note`, `available`), in the server's order (see \"The server's part\").",
          "`tracks.list` is not needed here: each track's row is its `open` entry, whose `note` is the track's own honest line.",
        ],
        states: [
          "No track has a lesson yet (this wave): the three tracks are the quiet rows, each with its note.",
          "A track has a next lesson (a later wave): its row is first among the rows that can be started, and tomorrow's line names it.",
          "Every side lesson is done: that row is gone.",
          "The stage is `lessons-done` (this list is also used then, on Today): the first rows are the tracks left to release.",
        ],
        copy: [
          { where: "Heading", text: "What is open now" },
          {
            where: "Tomorrow (the first entry that can be started: its title in lower case, then its note)",
            text: "Tomorrow: {title}. {note}",
          },
          {
            where: "Tomorrow, for example",
            text: "Tomorrow: reviews. 14 due. They keep the Oak green.",
          },
          { where: "Reviews: title / note", text: "Reviews / {n} due. They keep the Oak green." },
          {
            where: "Transcription Gym: title / note, with L8 open",
            text: "Transcription Gym / Ladder level 8: {next standard}, form to tune. Every fifth session, or any day from Today.",
          },
          {
            where: "Transcription Gym: note, with no standard left or L8 not yet taken",
            text: "Your own audio, a full arrangement at a time. Every fifth session, or any day from Today.",
          },
          { where: "Studio: title / note", text: "Studio / Your sketchbook. Start the next song." },
          {
            where: "Side lesson: title / note",
            text: "Side lessons: sound / {next lesson title} is next, about 15 minutes.",
          },
          {
            where: "A track with no lesson yet (Jazz Harmony, Advanced Rhythm): title / note",
            text: "{track title} / Open. Its first lessons are still being written.",
          },
          {
            where: "Arrangement & Sound, whose side lessons exist: title / note",
            text: "Arrangement & Sound / Its side lessons are open. The rest is still being written.",
          },
          {
            where: "A track with a next lesson (later): title / note",
            text: "{track title} / Next: {lesson id} {lesson title}.",
          },
        ],
      },
      {
        id: "today",
        title: "Today, from the next day on",
        owner: "session",
        where: "`/` when `plan.core` is `complete` (and, with its own line, `lessons-done`).",
        purpose:
          "An ordinary Today. The session the planner chose is the main block as on any day; the list of what is open sits under it. Nothing counts down and nothing announces the end again.",
        sees: [
          "The main block: today's planned session with its minutes, as always: reviews (with a riff of the day at the end, so the day still ends in a sketch), a gym session on slot days, a keep-alive, or Studio.",
          'Under it, "Open to you": the rows of surface `open` that can be started, as chips or a short list; then the tracks\' line.',
          "On the first day after the ending only: one line under the header that leads back to the record.",
          "The Oak glance and the weekly rhythm, as always.",
        ],
        actions: [
          "Start (Enter) starts the planned session.",
          'A row of "Open to you" starts that instead (the gym as an extra session, a side lesson, Studio).',
          '"Play it" (first day only): `/album`, the record.',
        ],
        data: [
          "`session.today`: `kind` (`review`, `gym`, `capstone`, `keepalive` or `studio`), `core`, `tracks` (`note`), `alternatives`, `sideLesson`, `slot`.",
          "`course.completion.open` for the rows; `session.day` for whether yesterday's summary was the ending (the first-day line).",
        ],
        states: [
          "`lessons-done`: the main block is the track left to release (CF-A.S1 in the default order), and one line above the list says what is left.",
          "`complete`, a slot day: the main block is the gym (ladder L8 when the learner is on it).",
          "`complete`, nothing due: a keep-alive (the riff of the day) or Studio; Today says so plainly and still offers Start.",
          "A return after a long gap: the return policy of contracts §7.9 runs as before; the gap is never shown.",
        ],
        copy: [
          { where: "First day only, under the header", text: "Side A is complete. Play it." },
          { where: "List heading", text: "Open to you" },
          {
            where: "The tracks' line (`plan.tracks.note`, this wave)",
            text: "The Jazz and Rhythm tracks are open. Their first lessons are still being written.",
          },
          {
            where: "`lessons-done`, above the list",
            text: "The lessons of the core are done. Left to release: {track titles}.",
          },
        ],
      },
      {
        id: "progress",
        title: "The line that stays",
        owner: "session",
        where: "`/progress`, at the top of the timeline, from the day the core is complete.",
        purpose: "The permanent record of the ending, and the way back to it. One entry, not a banner.",
        sees: [
          "The ms.07 entry on the timeline, with its date, the road line, and three links.",
          "The can-do ledger below it, as before, now also grouped by area.",
          "The pace estimate is gone (there is no map left to estimate); nothing replaces it.",
        ],
        actions: [
          '"Open the ending": the finale Coda of that session, read-only.',
          '"Play Side A": `/album`.',
          '"Open the Oak": `/oak`.',
        ],
        data: ["`course.completion` (`stage`, `completedAt`, `milestone`, `stats`); `progress` as today."],
        states: [
          "`lessons-done`: the pace estimate is replaced by the one line of what is left to release.",
          "`in-progress`: unchanged.",
        ],
        copy: [
          { where: "Entry title", text: MS07_TITLE },
          { where: "Entry date line", text: "{date, as 14 November 2026}" },
          { where: "Links", text: "Open the ending · Play Side A · Open the Oak" },
        ],
      },
    ],
    server: [
      "`course.completion` answers at any time with the stage. `complete` needs every core lesson completed, every core checkpoint passed or soft-passed and all twelve core tracks released; a revision of a released track never changes it. `completedAt` is set once.",
      "`SessionSummary.coreComplete` is filled for the session whose end made the stage `complete`, stored with that summary, and `null` on every other summary. `SessionPlan.core` and `CourseProgress.core` carry the stage from then on.",
      "ms.07 is recorded as reached at that same instant and not before: while the stage is `lessons-done` it stays unreached even when CF-A and CF-T are both out. ms.20 keeps its own moment (CF-T's release).",
      "`stats`: the learner's own totals (first day, days with a session, sessions ended, active minutes, core lessons, Side A tracks released, transcriptions finished, sketches saved). Never a comparison, never days missed.",
      '`canDo`: at most seven, one per area, in the order compose, transcribe, hear, write, read, code, sing. Within an area: only statements at `solid` or `strong`; a statement whose source is a capstone before one whose source is a lesson; then `strong` before `solid`; then the one whose source comes latest in the default order. (The DTO\'s comment says "newest first, at most 8": this rule replaces it; the shape is unchanged.)',
      "`album`: `released` and `total` count core tracks (12); `latestTrackId` is the track released last.",
      "`open`, in this order: tracks left to release (only before `complete`); a track with a next lesson the learner may start; reviews (`note`: the count due on the next learner day, from the schedule); the gym (`note`: the next L8 standard when the ladder is at 8 and one is left, otherwise own audio); Studio; the next unfinished side lesson; then every track with no lesson to start, `available: false`, with the track's own note. Titles and notes as in the copy tables.",
      "The planner after the core (wave6.md §5.5): a track left open first; else due reviews, with the every-fifth-session gym slot kept (d19); else a keep-alive or a Studio day. It never plans a lesson that is not authored, and `plan.tracks` carries the tracks' line.",
      "Dev seeds: `core complete` (yesterday's summary carries `coreComplete`; today is a review day) and `CF-A.S3 done` (today is CF-A.S4; releasing it from a seeded take reaches the ending).",
    ],
    never: [
      "Confetti, fireworks, a fanfare or any sound the learner did not make.",
      "A badge, a trophy, a certificate, a level, points, or a number that counts up.",
      '"Congratulations", an exclamation mark, or praise the evidence does not carry.',
      'A comparison: with a plan ("on schedule", "in 37 weeks"), with other people, or with the learner\'s own missed days.',
      'A modal, an overlay, or anything that stands between the learner and "Done for today".',
      "Music that starts by itself, or a page that moves on by itself.",
      "A button that leads to a lesson that does not exist.",
      '"You\'re done", "course complete" as a full stop, or any wording that makes tomorrow sound optional or empty.',
      "A share button, an upsell, a countdown.",
    ],
    acceptance: [
      "bun: the stage is `complete` exactly when every core lesson, checkpoint and track is done; `lessons-done` with CF-A and CF-T released and X1 unreleased; ms.07 unreached in that state (server).",
      "bun: `coreComplete` is on the summary of the completing session, on a reload of it, and on no later summary (server).",
      "bun: the can-do rule: one per area, capstone sources first, never `emerging` or `fading`, an area with nothing solid left out, at most seven (server).",
      "bun: the order and the notes of `open` in both worlds: no track lesson authored (tracks last, `available: false`); a track with a next lesson (first, and tomorrow's line names it) (server, session model).",
      "bun: the road line drops a zero clause and never prints a comparison; the evidence wording per `evidenceKind`; the Oak lines from counts, the third dropped at zero (session model).",
      "bun: Side A's running order puts the single last and numbers the twelve 1–12; the running time skips tracks with no recording (album model).",
      "bun: the finale section replaces the teaser and the goal-gradient line and keeps the release card (coda model).",
      'browser, from `core complete`: Today is a review day with "Open to you", the tracks\' line and, on this first day, "Side A is complete. Play it."; nothing on the page counts down. One page, both themes, 1440×900 and 1280×800.',
      'browser, from `core complete`: the ending reopened from `/progress` shows the heading, the four parts in order and no teaser; "Play Side A" plays track 1 and moves to track 2 (one track heard through, the rest asserted to move); Space stops it; reduced motion draws everything at once.',
      "browser, from `core complete`: `/album` has the finished header, twelve covers in running order, the single last.",
      "browser, journey (the one real take of CF-A, d9): from `CF-A.S3 done`, CF-A.S4 with a real take over two minutes, the release, and the Coda that follows is the ending.",
      "No page of the ending contains an exclamation mark, the word \"Congratulations\" or a canvas of particles (a bun test over the copy tables of this spec's source, and the browser test's text).",
    ],
    seeds: [
      '`core complete`: everything through CF-A.S4, all twelve tracks released with recordings; yesterday\'s summary carries `coreComplete`; today a review day with `plan.core: "complete"` and `plan.tracks` set.',
      '`CF-A.S3 done`: CF-A.S1–S3 completed with a draft that has a verse, a chorus, a bridge and four devices; today CF-A.S4, `plan.core: "lessons-done"`.',
      "Wanted, small: `core complete` with `recordings: false` (the record with no recordings) and with `mic: false` (Quiet mode: no sung can-do); both are flags the seed endpoint already takes.",
    ],
    notes: [
      "Why the single is last. The registry lists CF-A before CF-T and the album follows the registry. Played through, a record that ends on a 1920s standard and not on the learner's own song ends on someone else's tune. The running order above keeps the registry's order and moves the single to the end; CF-T, released fourteen sessions earlier, sits before it. This is a decision of this spec for the gate to confirm; ux §5.3 lists the single first.",
      `ms.07's condition is \`{ capstones: ["CF-A", "CF-T"] }\` (content/milestones.ts; content/validate/course.test.ts pins it). To say what its title says it should name all twelve core tracks. Requested of the content lead; until then the server's rule above keeps the banner honest.`,
      '`course.completion.canDo` is described in `packages/api` as "newest first (at most 8)". The rule here (one per area, at most seven) fits the same shape; the comment should follow.',
      "The can-do counts are computed in the page from `cando.list` and the registry. If the server engineer prefers, `CoreCompletion` can carry `canDoCounts: { solid, settling, total }` (additive).",
      "The tracks' line on Today is the server's `plan.tracks.note`, which names the tracks with no lesson to start (Jazz and Rhythm in this wave). Arrangement & Sound is different: its four side lessons exist and are the \"Side lessons\" row; its own row says the rest is still being written.",
      "After the core, a review day should still end with something made. The keep-alive already has its riff of the day; this spec asks the same of a review day once the core is complete (the planner's `review` kind with the riff as its Make). If that is not built in this wave, the Coda's \"Keep playing in Studio\" is the way to a sketch, and Today says so.",
      "The record component is the capstone engineer's and the Coda is the session engineer's: the Coda imports the component from the album's public module; it does not rebuild a player.",
      "Not in this spec: Side B, track checkpoints and track capstones (the next wave); a way to export the whole record as one file (each track already exports its own audio).",
    ],
  },
};
