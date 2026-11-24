// The unit song's server state (spec docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.4, §5.5): the song of
// a unit or of a lesson (`songs.get`), the terms that name its sections and parts, the writes every song surface
// makes, the New song gate of a take lesson, and everything a take step's Make needs to play inside the song
// (`useSongMake`). Keys follow app/src/lib/queries.ts (`["api", name, input]`), so a write invalidates by name.
import type {
  CodeRange,
  FlavourId,
  JsonEndpointName,
  LessonDef,
  LessonId,
  SessionId,
  UnitId,
  UnitSongDetail,
} from "@oak/api";
import { stripMarkers } from "@oak/api";
import { songLengthBars } from "@oak/strudel/song-compose";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { songStepOf } from "../../../content/unit-songs/index.ts";
import { bandSetupOf } from "../lesson/band.ts";
import {
  newestTakeOf,
  newSongGateOf,
  openingCode,
  openingsOf,
  type SongStepHost,
  shiftRanges,
  songChipLabel,
  tempoRangeOf,
  todayLoopOf,
  withSongTempo,
} from "../lesson/song-make.ts";
import { useContent } from "../lib/content.ts";
import { apiQuery, useApiMutation, useTermsIntroduced } from "../lib/queries.ts";
import { playableTakes, songBandOf, songBpmOf, songViewOf } from "./model.ts";

/** What a song write changes: the song, the list of songs and Today's song line. */
export const SONG_READS: readonly JsonEndpointName[] = ["songs.get", "songs.list", "session.today"];

// --- reads -----------------------------------------------------------------------------------------------

/** A unit's song (`songs.get`): `status: "new"` while the learner has not started it. Off for `null`. */
export function useUnitSong(unitId: string | null) {
  return useQuery({
    ...apiQuery("songs.get", { params: { unitId: (unitId ?? "U01") as UnitId } }),
    enabled: unitId !== null,
  });
}

/** The learner's songs (`songs.list`), started ones only, in course order. */
export const useUnitSongs = () => useQuery(apiQuery("songs.list"));

/** The song a lesson belongs to (its take or side step) and the learner's song, or nulls for a lesson in no song. */
export function useSongOfLesson(lessonId: string | null) {
  const found = lessonId ? songStepOf(lessonId as LessonId) : null;
  const query = useUnitSong(found?.song.unit ?? null);
  return {
    song: found?.song ?? null,
    step: found?.step ?? null,
    detail: (query.data as UnitSongDetail | undefined) ?? null,
    query,
  };
}

const NO_TERMS: ReadonlySet<string> = new Set();

/** The terms the learner has met (`terms.introduced`): an empty set until they are read. */
export function useIntroducedTerms(): ReadonlySet<string> {
  const terms = useTermsIntroduced();
  const items = terms.data?.items;
  return useMemo(() => (items ? new Set(items.map((t) => t.termId as string)) : NO_TERMS), [items]);
}

/** A lesson's title from the content bundle, for "yours (from …)" and the opening note. */
export function useLessonTitles(): (lessonId: string) => string | null {
  const content = useContent();
  const syllabus = content.data?.syllabus;
  return useMemo(() => {
    const titles = new Map<string, string>();
    for (const u of syllabus?.units ?? []) for (const l of u.lessons) titles.set(l.id, l.title);
    return (id: string) => titles.get(id) ?? null;
  }, [syllabus]);
}

// --- writes ----------------------------------------------------------------------------------------------

/** Start the unit's song in a style (the New song moment); it also records the unit's earlier Makes. */
export const useStartSong = () => useApiMutation("songs.start", SONG_READS);
/** Change the song's style: the takes stay. */
export const useSetSongFlavour = () => useApiMutation("songs.setFlavour", SONG_READS);
export const useRenameSong = () => useApiMutation("songs.rename", SONG_READS);
/** Today's one-time style card of a song Oak made from earlier lessons was seen. */
export const useAckSongStyle = () => useApiMutation("songs.ackStyle", SONG_READS);
/** Release the song to the album (or again, after it changed). */
export const useReleaseSong = () =>
  useApiMutation("songs.release", [...SONG_READS, "album.get", "album.track"]);

// --- the New song gate (spec §5.5) -------------------------------------------------------------------------

export interface NewSongGate {
  /** The lesson waits for the New song moment: a take lesson of a song not started. */
  show: boolean;
  /** The song is still being read (the lesson may wait, so the moment does not flash in late). */
  pending: boolean;
  unitId: UnitId | null;
  /** The style the moment offers first: the profile's, as the server answers for a song not started. */
  flavour: FlavourId | null;
  /** The learner started the song (after `songs.start`): the lesson opens. */
  onStarted(): void;
}

/**
 * The hook point of the New song moment: the first visit to a take lesson whose song is not started shows it before
 * the lesson (spec §5.5). The moment itself is `<NewSong unitId onStarted />` (app/src/song); it posts `songs.start`
 * with the picked style and then calls `onStarted`.
 */
export function useNewSongGate(lessonId: string, o: { enabled: boolean }): NewSongGate {
  const { song, step, detail, query } = useSongOfLesson(o.enabled ? lessonId : null);
  // The unit whose song the learner just started (until `songs.get` refetches as started). A unit id, not a flag: the
  // player stays mounted across lessons, and starting one song must not skip another unit's moment.
  const [startedUnit, setStartedUnit] = useState<UnitId | null>(null);
  const unitId = song?.unit ?? null;
  const show = o.enabled && startedUnit !== unitId && newSongGateOf(step, detail);
  return {
    show,
    pending: o.enabled && step?.kind === "take" && query.isPending,
    unitId,
    flavour: detail?.flavour ?? null,
    onStarted: () => setStartedUnit(unitId),
  };
}

// --- the Make inside the song (spec §5.3) --------------------------------------------------------------------

/**
 * `none`: a lesson in no song, or a song that could not be read (the Make is a plain sketch, as before); `pending`:
 * the song is being read (the Make waits, so its editor never opens with one code and switches to another).
 */
export type SongMakeState = { kind: "none" } | SongStepHost;

const makeStepOf = (lesson: LessonDef) => [...lesson.steps].reverse().find((s) => s.kind === "make") ?? null;

/**
 * Everything a take step's Make needs to play inside its song, recomputed from the song whenever the Make opens
 * (never stored): the song band with today's code live in it, the opening code and Oak's copy at the song's tempo,
 * the codes that count as unchanged, today's loop, the grid with today's cells, and the chips' words.
 */
export function useSongMake(lesson: LessonDef, o: { flavour: FlavourId }): SongMakeState {
  const { song, step, detail, query } = useSongOfLesson(lesson.id);
  const introduced = useIntroducedTerms();
  const titleOf = useLessonTitles();
  const flavour = o.flavour;
  return useMemo((): SongMakeState => {
    if (!song || !step) return { kind: "none" };
    if (step.kind === "side") return { kind: "side", def: song, reason: step.reason };
    if (query.isPending) return { kind: "pending" };
    if (query.isError) return { kind: "none" };
    const make = makeStepOf(lesson);
    const ex = make?.exercise;
    const authored =
      ex?.kind === "code-make" || ex?.kind === "compose-brief" ? stripMarkers(ex.code.starter) : null;
    if (!make || !ex || !authored) return { kind: "none" };
    const bpm = songBpmOf(song, playableTakes(detail));
    const allowed = tempoRangeOf(ex);
    const band = songBandOf(song, detail, { flavour, live: step });
    const setup = bandSetupOf(make.ui.band, {
      flavour,
      key: lesson.key,
      bpm: lesson.bpm,
      at: lesson.id as SessionId,
      song: band,
    });
    const todays = bandSetupOf(make.ui.band, {
      flavour,
      key: lesson.key,
      bpm: lesson.bpm,
      at: lesson.id as SessionId,
    });
    const oakCopy = withSongTempo(authored.code, bpm, allowed);
    const opening = openingCode(step, detail, authored.code, bpm, allowed);
    const take = step.startFrom === "oak" ? null : newestTakeOf(detail, step.startFrom);
    const view = songViewOf(song, detail, introduced, { live: step, flavour });
    const partName = (label: string) => view.parts.find((p) => p.label === label)?.name ?? null;
    return {
      kind: "take",
      def: song,
      step,
      unitId: song.unit,
      detail,
      bpm,
      lengthBars: songLengthBars(song),
      setup: setup as NonNullable<typeof setup>,
      todays,
      opening,
      oakCopy,
      tempoSet:
        opening.source === "oak" ? oakCopy !== authored.code : take !== null && take.code !== opening.code,
      oakEditable: authored.editable
        ? (shiftRanges(authored.editable, authored.code, oakCopy) as CodeRange[])
        : null,
      own: take
        ? {
            lessonId: take.lessonId,
            title: titleOf(take.lessonId) ?? take.lessonId,
            code: withSongTempo(take.code, bpm, allowed),
          }
        : null,
      unchangedFrom: openingsOf(step, detail, authored.code, bpm, allowed),
      loop: todayLoopOf(song, step),
      view,
      takeIds: playableTakes(detail).map((t) => t.id),
      chipLabel: (track) => songChipLabel(track, { partName, lessonTitle: titleOf }),
    };
  }, [song, step, detail, query.isPending, query.isError, lesson, flavour, introduced, titleOf]);
}
