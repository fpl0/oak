// Every repository over one connection. Services take this bundle; nothing else writes SQL.
import type { Db } from "../index.ts";
import { LessonsRepo } from "./lessons.ts";
import { AlbumRepo, AudioRepo, SketchesRepo, TranscriptionsRepo } from "./library.ts";
import { MasteryRepo } from "./mastery.ts";
import { ListenRepo, OnboardingRepo } from "./onboarding.ts";
import { OpsRepo } from "./ops.ts";
import { ProfileRepo, SettingsRepo } from "./profile.ts";
import { CanDoRepo, CapstonesRepo, CheckpointsRepo, TermsRepo, UnlocksRepo } from "./progress.ts";
import { GymRepo, SessionsRepo } from "./sessions.ts";
import { SrsRepo } from "./srs.ts";
import { StreakRepo } from "./streak.ts";
import { TutorRepo } from "./tutor.ts";
import { UnitSongsRepo } from "./unit-songs.ts";
import { IdempotencyRepo, SungNotesRepo, VoiceRepo } from "./voice.ts";
import { CapstoneSessionsRepo, LadderRepo } from "./wave4.ts";
import { CoreStateRepo, TakesRepo, TrackGatesRepo } from "./wave6.ts";
import { CapstoneVersionsRepo, CourseStateRepo, TrackFocusRepo } from "./wave7.ts";

export interface Repos {
  db: Db;
  profile: ProfileRepo;
  settings: SettingsRepo;
  sessions: SessionsRepo;
  gym: GymRepo;
  lessons: LessonsRepo;
  mastery: MasteryRepo;
  srs: SrsRepo;
  streak: StreakRepo;
  unlocks: UnlocksRepo;
  cando: CanDoRepo;
  terms: TermsRepo;
  checkpoints: CheckpointsRepo;
  capstones: CapstonesRepo;
  sketches: SketchesRepo;
  album: AlbumRepo;
  audio: AudioRepo;
  transcriptions: TranscriptionsRepo;
  tutor: TutorRepo;
  ops: OpsRepo;
  onboarding: OnboardingRepo;
  listen: ListenRepo;
  idempotency: IdempotencyRepo;
  voice: VoiceRepo;
  sung: SungNotesRepo;
  /** Wave 4. */
  capstoneSessions: CapstoneSessionsRepo;
  ladder: LadderRepo;
  /** Wave 6. */
  trackGates: TrackGatesRepo;
  coreState: CoreStateRepo;
  takes: TakesRepo;
  /** Wave 7. */
  trackFocus: TrackFocusRepo;
  courseState: CourseStateRepo;
  capstoneVersions: CapstoneVersionsRepo;
  /** Unit songs (0011). */
  unitSongs: UnitSongsRepo;
}

export function createRepos(db: Db, defaults: { timezone: string; now: () => Date }): Repos {
  return {
    db,
    profile: new ProfileRepo(db, defaults),
    settings: new SettingsRepo(db),
    sessions: new SessionsRepo(db),
    gym: new GymRepo(db),
    lessons: new LessonsRepo(db),
    mastery: new MasteryRepo(db),
    srs: new SrsRepo(db),
    streak: new StreakRepo(db),
    unlocks: new UnlocksRepo(db),
    cando: new CanDoRepo(db),
    terms: new TermsRepo(db),
    checkpoints: new CheckpointsRepo(db),
    capstones: new CapstonesRepo(db),
    sketches: new SketchesRepo(db),
    album: new AlbumRepo(db),
    audio: new AudioRepo(db),
    transcriptions: new TranscriptionsRepo(db),
    tutor: new TutorRepo(db),
    ops: new OpsRepo(db),
    onboarding: new OnboardingRepo(db),
    listen: new ListenRepo(db),
    idempotency: new IdempotencyRepo(db),
    voice: new VoiceRepo(db),
    sung: new SungNotesRepo(db),
    capstoneSessions: new CapstoneSessionsRepo(db),
    ladder: new LadderRepo(db),
    trackGates: new TrackGatesRepo(db),
    coreState: new CoreStateRepo(db),
    takes: new TakesRepo(db),
    trackFocus: new TrackFocusRepo(db),
    courseState: new CourseStateRepo(db),
    capstoneVersions: new CapstoneVersionsRepo(db),
    unitSongs: new UnitSongsRepo(db),
  };
}

export {
  AlbumRepo,
  AudioRepo,
  CanDoRepo,
  CapstonesRepo,
  CheckpointsRepo,
  GymRepo,
  IdempotencyRepo,
  LessonsRepo,
  ListenRepo,
  MasteryRepo,
  OnboardingRepo,
  OpsRepo,
  ProfileRepo,
  SessionsRepo,
  SettingsRepo,
  SketchesRepo,
  SrsRepo,
  StreakRepo,
  SungNotesRepo,
  TermsRepo,
  TranscriptionsRepo,
  TutorRepo,
  UnitSongsRepo,
  UnlocksRepo,
  VoiceRepo,
};
