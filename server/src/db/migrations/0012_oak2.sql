-- Oak 2.0 (docs/oak2/PLAN.md §4 Studio 2.0, §5 Course 2.0, §6 Finishing 2.0; contracts §13): the tables and columns
-- every 2.0 wave builds on, written once in W0 so later waves only implement.
--
-- New tables and ADD COLUMN only. Never rebuild `sketches`, `album_tracks`, `album_track_versions` or `sessions`:
-- every migration runs inside one transaction with foreign keys on, so dropping a parent table there cascades into
-- its children and empties them (docs/design/songs/server.md §0.5, 0011's header). For the same reason the status-like
-- text columns below (`take_state`, `dimension`, `role`, `source_kind`, `ref_kind`, `source`) carry no CHECK a later
-- wave would have to widen; the services validate them against the `@oak/api` enums. Only 0/1 flags are checked.
--
-- Code a backup import brings in runs only after the strict lint (contracts §11.3): the two new tables that hold
-- runnable code (`scraps`, `user_templates`) carry `review_before_run`, set by `markForReview` on import, like
-- `unit_song_releases`. `catalogs` holds plain words, never code; the sketch it names is flagged with its versions.

-- S1 Scraps: a line saved explicitly from a lesson, a capture (hum, tap, voice memo) or a sketch. The labelled lines
-- of every sketch are scraps too, but those are an index read from the sketches, never stored here. `role` is the
-- part (`drums`, `bass`, `chords`, `tune`, `other`); `label` the line's track label; `code` the one labelled line;
-- `key_json` a `KeySpec`; `source_kind` where it came from and `source_ref` which one (a step, a sketch version, an
-- audio id).
CREATE TABLE scraps (
  id TEXT PRIMARY KEY,
  role TEXT,
  label TEXT,
  code TEXT NOT NULL,
  bpm REAL,
  meter TEXT,
  key_json TEXT,
  source_kind TEXT NOT NULL,
  source_ref TEXT,
  created_at TEXT NOT NULL,
  review_before_run INTEGER NOT NULL DEFAULT 0 CHECK (review_before_run IN (0, 1))
) STRICT;
CREATE INDEX scraps_by_role ON scraps (role, created_at);

-- S2 The learner's own defaults: setup-only templates and "Make this my Blank" (tempo, meter, sounds, no notes).
-- At most one row has `is_blank = 1`; the service keeps it so (no partial unique index, so a later wave can relax it).
CREATE TABLE user_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  bpm REAL,
  meter TEXT,
  is_blank INTEGER NOT NULL DEFAULT 0 CHECK (is_blank IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  review_before_run INTEGER NOT NULL DEFAULT 0 CHECK (review_before_run IN (0, 1))
) STRICT;

-- F2 "Is it better, or just different?": one row per rubric check of a capstone draft, in order, so the nudge can
-- find an earlier passing draft. `capstone_checks` keeps the transcription checks' scores and is not touched.
CREATE TABLE capstone_check_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capstone_id TEXT NOT NULL,
  session_id TEXT,
  sketch_id TEXT NOT NULL,
  sketch_version INTEGER NOT NULL,
  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
  at TEXT NOT NULL
) STRICT;
CREATE INDEX capstone_check_history_by_capstone ON capstone_check_history (capstone_id, at, id);

-- S7 Tutor stance: off-topic deep dives parked in a Later list on Today. `source` is who parked it (`tutor`,
-- `learner`); `done_at` is set when the learner ticks it off (the row stays).
CREATE TABLE later_items (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL,
  done_at TEXT
) STRICT;
CREATE INDEX later_items_open ON later_items (done_at, created_at);

-- S6 Catalog of attributes: the learner's six plain lines about a reference (`lines_json`: tempo, sound, harmony,
-- melody, rhythm, form). `ref_kind` + `ref_id` name the reference (a unit song, a transcription project, the learner's
-- own audio); `sketch_id` is the sketch written from the lines, once there is one.
CREATE TABLE catalogs (
  id TEXT PRIMARY KEY,
  ref_kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  lines_json TEXT NOT NULL,
  sketch_id TEXT,
  created_at TEXT NOT NULL
) STRICT;

-- S3 Jam, then edit: every Run in a jam is a take, kept or cut (`take_state`: NULL | 'kept' | 'cut'; cut is hidden,
-- never deleted). S5 Variation: a sibling or a next-generation child names the version it was copied from
-- (`parent_version`, same sketch), its generation (`generation`, NULL for ordinary Runs) and the one dimension the
-- learner chose to change (`dimension`: 'sound' | 'rhythm' | 'notes' | 'harmony' | 'form').
ALTER TABLE sketch_versions ADD COLUMN take_state TEXT;
ALTER TABLE sketch_versions ADD COLUMN parent_version INTEGER;
ALTER TABLE sketch_versions ADD COLUMN generation INTEGER;
ALTER TABLE sketch_versions ADD COLUMN dimension TEXT;

-- S7 Commit sounds (`committed_json`: the lines whose sound settings are committed) and S6 cards drawn for this
-- sketch (`cards_json`). NULL = none.
ALTER TABLE sketches ADD COLUMN committed_json TEXT;
ALTER TABLE sketches ADD COLUMN cards_json TEXT;

-- F6 Finish it anyway, then shelve: a shelved piece counts as finished but is not on the album.
ALTER TABLE album_tracks ADD COLUMN shelved INTEGER NOT NULL DEFAULT 0 CHECK (shelved IN (0, 1));
