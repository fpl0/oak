-- Unit songs (docs/superpowers/specs/2026-11-24-unit-songs-design.md §5.4): every unit is one song that Oak plays whole,
-- each lesson's Make takes over cells of it, and the song is released to the album as a frozen snapshot.
--
-- New tables and ADD COLUMN only. Never rebuild `sketches`, `album_tracks`, `album_track_versions` or `sessions`:
-- every migration runs inside one transaction with foreign keys on, so dropping a parent table there cascades into
-- its children and empties them (docs/design/songs/server.md §0.5). For the same reason the status, flavour and title
-- columns below carry no CHECK that a later wave would have to widen; the service validates them.

-- One row per unit song the learner has (started from the New song moment, by a take, or by the backfill of a unit
-- whose lessons were completed before songs existed). `song_version` is the `UnitSongDef.version` the song was last
-- arranged with; `flavour` is the learner's style for this song (the profile's by default); `backfilled` = Oak made
-- (part of) it from earlier lesson-make sketches; `style_seen` = the learner picked or saw the style (the one-time
-- style card of a backfilled song shows while it is 0).
CREATE TABLE unit_songs (
  unit_id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL,
  song_version INTEGER NOT NULL,
  flavour TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  backfilled INTEGER NOT NULL DEFAULT 0 CHECK (backfilled IN (0, 1)),
  style_seen INTEGER NOT NULL DEFAULT 0 CHECK (style_seen IN (0, 1)),
  created_at TEXT NOT NULL,
  released_at TEXT
) STRICT;

-- The takes of a song, append-only: the song's state is its takes in order (`created_at`, then `id`), a later take's
-- cells overriding an earlier one's. A take points at the lesson-make sketch version it plays (the code is read from
-- there, never copied). `cells_json` is the claimed cells (`["kick@verse", …]`), `labels_json` maps the take's track
-- labels to song parts (`{"drums": null, "bass": "bass"}`). A backfilled take (`backfilled = 1`) dates from its sketch
-- version and claims its step's sections × declared parts until the app saves it again with the cells it computed.
CREATE TABLE unit_song_takes (
  id INTEGER PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES unit_songs (unit_id),
  lesson_id TEXT NOT NULL,
  sketch_id TEXT NOT NULL,
  sketch_version INTEGER NOT NULL,
  cells_json TEXT NOT NULL DEFAULT '[]',
  labels_json TEXT NOT NULL DEFAULT '{}',
  bpm REAL NOT NULL,
  backfilled INTEGER NOT NULL DEFAULT 0 CHECK (backfilled IN (0, 1)),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX unit_song_takes_by_unit ON unit_song_takes (unit_id, created_at, id);

-- A release is a frozen snapshot (spec §5.4, §10a call 5): everything needed to play it again, whatever the content
-- or the takes become later — the exact Oak code of the flavour at release, the whole `UnitSongDef` as it was
-- (`def_json`), and each take in order with its cells, labels and code (`takes_json`). `album_track_id` and
-- `album_version` name the album version it became (no foreign key: the learner may delete the album track).
-- `review_before_run` is set by a backup import (contracts §11.3): the snapshot's code then runs only after the strict
-- lint.
CREATE TABLE unit_song_releases (
  id INTEGER PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES unit_songs (unit_id),
  album_track_id TEXT NOT NULL,
  album_version INTEGER NOT NULL,
  song_id TEXT NOT NULL,
  song_version INTEGER NOT NULL,
  flavour TEXT NOT NULL,
  title TEXT NOT NULL,
  bpm REAL NOT NULL,
  oak_code TEXT NOT NULL,
  def_json TEXT NOT NULL,
  takes_json TEXT NOT NULL,
  review_before_run INTEGER NOT NULL DEFAULT 0 CHECK (review_before_run IN (0, 1)),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX unit_song_releases_by_unit ON unit_song_releases (unit_id, id);

-- A released song is an album track with no capstone (the B-side path) that names its unit; each of its versions
-- names the snapshot it plays. NULL for every other track and version.
ALTER TABLE album_tracks ADD COLUMN unit_id TEXT;
ALTER TABLE album_track_versions ADD COLUMN song_release_id INTEGER;
