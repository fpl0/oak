// The song player's ids (app/src/song/player.ts): one per song and version, so every ▶ and every grid that shows the
// same song agree on what plays. A grid follows an id (its playhead moves while that id plays).

/** The song as it stands now (Today's hero, the lesson card, the Coda's "with today", the song page). */
export const nowId = (unitId: string): string => `song:${unitId}:now`;
/** The song right after one take (the song page's history). */
export const takeId = (unitId: string, id: number): string => `song:${unitId}:take:${id}`;
/** The song right before one take (the Coda's "before today"). */
export const beforeId = (unitId: string, id: number): string => `song:${unitId}:before:${id}`;
/** A release as it was frozen. */
export const releaseId = (unitId: string, id: number): string => `song:${unitId}:release:${id}`;
/** Oak's song in a style, before the learner starts it (the New song previews). */
export const styleId = (unitId: string, flavour: string): string => `song:${unitId}:style:${flavour}`;
/** Any id of this unit's song. */
export const ofUnit =
  (unitId: string) =>
  (id: string): boolean =>
    id.startsWith(`song:${unitId}:`);
