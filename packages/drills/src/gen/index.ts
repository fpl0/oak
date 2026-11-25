// The generators this package implements, by the name a `FamilyDef.generator` uses.
import type { LevelParams } from "@oak/content-kit";
import { spell as chordSpell, inversion, qualityId } from "./chord.ts";
import { codeFunctions, codeMini } from "./code.ts";
import type { Generator } from "./common.ts";
import { degResolve, degSing, fet, nIndex, tonic } from "./degree.ts";
import { formBlues, formSections } from "./form.ts";
import { grooveLock, polyrhythm } from "./groove.ts";
import { bassDegrees, cadence, functionId, iiV, rnFacts, schema } from "./harmony.ts";
import { inKey, isolated, singIv, spellIv } from "./interval.ts";
import { jazzChordScale, jazzExtension, jazzGuide, jazzSubs, jazzVoicing } from "./jazz.ts";
import { circle, modeId, scaleSpell } from "./key.ts";
import { melDictation, melEcho, melSight, notRead } from "./melody.ts";
import { harmonyMotion } from "./motion.ts";
import { melodyNct } from "./nct.ts";
import { compare, keyboard, match, steps } from "./pitch.ts";
import { chromaticChord, modulation, progression } from "./progression.ts";
import {
  clave,
  count,
  dictation,
  echo,
  meterId,
  oddGrouping,
  pulse,
  read,
  subdivision,
  swingFeel,
  syncopation,
} from "./rhythm.ts";
import { soundParams, soundRoles } from "./sound.ts";

const ALL: readonly Generator[] = [
  pulse,
  echo,
  read,
  dictation,
  count,
  meterId,
  subdivision,
  syncopation,
  swingFeel,
  clave,
  oddGrouping,
  compare,
  match,
  steps,
  keyboard,
  fet,
  degSing,
  degResolve,
  tonic,
  nIndex,
  inKey,
  isolated,
  spellIv,
  singIv,
  qualityId,
  inversion,
  chordSpell,
  rnFacts,
  functionId,
  bassDegrees,
  schema,
  cadence,
  iiV,
  melDictation,
  melEcho,
  melSight,
  notRead,
  modeId,
  scaleSpell,
  circle,
  codeMini,
  codeFunctions,
  grooveLock,
  polyrhythm,
  melodyNct,
  harmonyMotion,
  progression,
  chromaticChord,
  modulation,
  formSections,
  formBlues,
  jazzGuide,
  jazzVoicing,
  jazzExtension,
  jazzChordScale,
  jazzSubs,
  soundParams,
  soundRoles,
];

export const GENERATOR_MAP: ReadonlyMap<string, Generator> = new Map(ALL.map((g) => [g.name, g]));
export const GENERATOR_NAMES: readonly string[] = ALL.map((g) => g.name);
export function generatorFor<L extends LevelParams>(name: string): Generator<L> | undefined {
  return GENERATOR_MAP.get(name) as Generator<L> | undefined;
}
