I couldn’t write an output file: no path was supplied, and the sandbox is read-only. The Markdown review follows. No files changed or test suites ran.

1. **Bug — startup backfill changes restored song state.**  
   [server/src/app.ts:129](/Users/fpl0/Code/Oak-wt/review-s1a/server/src/app.ts:129), [server/src/services/unit-songs.ts:444](/Users/fpl0/Code/Oak-wt/review-s1a/server/src/services/unit-songs.ts:444). Restore a backup containing an L01 take and a completed L02 sketch without a take. Import initially preserves it, but restarting adds L02 to the existing song, potentially replacing cell ownership. An in-memory probe confirmed this.  
   **Smallest fix:** persist completion of legacy backfill and skip established/restored song state on subsequent startups.

2. **Bug — released-song export reads the latest Make instead of the snapshot.**  
   [server/src/services/unit-songs.ts:317](/Users/fpl0/Code/Oak-wt/review-s1a/server/src/services/unit-songs.ts:317), [server/src/services/library.ts:213](/Users/fpl0/Code/Oak-wt/review-s1a/server/src/services/library.ts:213). Release a song containing several takes, then export its album version. `albumSource()` returns only the newest take’s sketch code and ordinary Band; the existing export path never reads `song_release_id`. Earlier takes and frozen Oak music are omitted, and Band content can come from current content.  
   **Smallest fix:** expose the release association through the album reader and build its playback/export request from the frozen snapshot. Verified by reading; **could not verify** the rendered WAV.

3. **Bug — valid saved learner takes silently revert to Oak.**  
   [packages/strudel/src/editor.ts:303](/Users/fpl0/Code/Oak-wt/review-s1a/packages/strudel/src/editor.ts:303). Editor playback, PatternPlayer, and analysis lint saved sources using profile `band`. For example, `setcpm(100/4)\n$: s("bd")` passes learner lint but fails authored Band lint. `buildSong()` consequently drops the take and returns its cells to Oak. Export uses a different check and can sound different. The lint discrepancy was reproduced.  
   **Smallest fix:** use `SongCheck`’s `who` argument: authored lint for Oak, consistent learner safety/preview lint for saved takes.

4. **Bug — song-only PatternPlayer loads fail before evaluation.**  
   [packages/strudel/src/pattern-player.ts:229](/Users/fpl0/Code/Oak-wt/review-s1a/packages/strudel/src/pattern-player.ts:229). `load("", { band: songSetup, … })` substitutes `silence`, then applies the default `content` lint. That requires a tempo line and returns `code.setcpm-missing`, preventing playback. The lint failure was reproduced.  
   **Smallest fix:** exempt this generated placeholder from content lint, while retaining checks on the actual song sources.

5. **Bug — changed playback can be treated as an unchanged release.**  
   [server/src/services/unit-songs.ts:499](/Users/fpl0/Code/Oak-wt/review-s1a/server/src/services/unit-songs.ts:499). Release a take at 100 BPM, then refine the same sketch version to 120 BPM without changing cells. `changedSinceRelease` remains false, and Release returns the old snapshot. An in-memory probe confirmed both release IDs remained identical. Label mappings and song-definition changes are also omitted from comparison.  
   **Smallest fix:** compare all playback-relevant take fields and the current definition/version against the snapshot.

6. **Bug — claim detection misses parts introduced later in a pattern.**  
   [packages/strudel/src/song-compose.ts:343](/Users/fpl0/Code/Oak-wt/review-s1a/packages/strudel/src/song-compose.ts:343), [song-compose.ts:525](/Users/fpl0/Code/Oak-wt/review-s1a/packages/strudel/src/song-compose.ts:525). Loops are inspected for four bars; arranged patterns are capped at sixteen. A live take declaring kick but introducing melody after a sixteen-bar intro never claims the melody. A probe confirmed Oak and the learner both played melody in the chorus.  
   **Smallest fix:** inspect every source interval that will actually play, within the song’s 64-bar bound, before computing played parts.

7. **Bug — numbered section variants disappear when another track repeats its unnumbered section.**  
   [packages/strudel/src/song-compose.ts:169](/Users/fpl0/Code/Oak-wt/review-s1a/packages/strudel/src/song-compose.ts:169). With drums arranging `[4, drumsChorus], [4, drumsChorus]` before melody arranging `[4, melChorus], [4, melChorus2]`, `sourceSectionsOf()` takes identifiers from drums and loses variant `2`. A probe confirmed the second song chorus repeated the first melody. The canonical AST reader already preserves numbered tags from any track.  
   **Smallest fix:** merge variant information across tracks, matching that AST reader’s behavior.

8. **Bug — polyphony inference can wrongly trigger the chords takeover rule.**  
   [packages/strudel/src/song-compose.ts:359](/Users/fpl0/Code/Oak-wt/review-s1a/packages/strudel/src/song-compose.ts:359). `chordShare` counts individual notes rather than distinct onsets. A `keys:` phrase containing one dyad and five single-note onsets produces `2/7`, exceeding 25%, although only `1/6` of its onsets are polyphonic. A probe classified it as chords, which unnecessarily claims Oak’s bass, harmony, and melody.  
   **Smallest fix:** calculate polyphonic onset groups divided by all pitched onset groups, matching `inferRoles`.

9. **Bug — overwritten labels claim parts that never play.**  
   [packages/strudel/src/evaluation.ts:73](/Users/fpl0/Code/Oak-wt/review-s1a/packages/strudel/src/evaluation.ts:73). For a live step declaring snare, `drums: s("bd")` followed by `drums: s("sd")` plays only snare under Strudel’s replacement semantics. However, `session.live` retains both patterns, so the composer also claims kick and silences Oak’s kick. This was reproduced.  
   **Smallest fix:** collect live patterns by label with last-write-wins semantics, as `collectTracks()` already does.

10. **Bug — subsequent releases retain the first album title and flavour.**  
    [server/src/services/unit-songs.ts:326](/Users/fpl0/Code/Oak-wt/review-s1a/server/src/services/unit-songs.ts:326). Release “First” in pop, change flavour/add a take, then release “Second.” The new snapshot stores the new metadata, but `addTrackVersion()` only inserts a version; the album row retains “First” and pop, including the export filename.  
    **Smallest fix:** update the album track’s current title/flavour when adding the release version, preserving older snapshots.

11. **Bug — content CI accepts inaudible songs.**  
    [content/validate/unit-songs.ts:380](/Users/fpl0/Code/Oak-wt/review-s1a/content/validate/unit-songs.ts:380), [unit-songs.ts:401](/Users/fpl0/Code/Oak-wt/review-s1a/content/validate/unit-songs.ts:401). Adding `.gain(0)` to every Oak track still produces raw events, satisfying both the non-silence and per-section presence checks. The same applies to zero velocity or postgain.  
    **Smallest fix:** apply the existing effective-gain audibility convention before these checks.

12. **Bug — flavour validation permits changes to chord function.**  
    [content/validate/unit-songs.ts:322](/Users/fpl0/Code/Oak-wt/review-s1a/content/validate/unit-songs.ts:322). The comparison discards chord quality and retains only `rootPc`. Otherwise identical chord-only flavours playing C major and C minor therefore compare equal; without melody or bass, the other checks cannot catch the change.  
    **Smallest fix:** compare harmonic function/triad quality as well as root, normalizing only the extensions expressly permitted for flavours.

13. **Bug — key validation rejects sections an arranged take never fills.**  
    [content/validate/unit-songs.ts:722](/Users/fpl0/Code/Oak-wt/review-s1a/content/validate/unit-songs.ts:722). Given a C-major verse, A-minor bridge, `sections: "all"`, and reference code arranging only the verse, the composer leaves the bridge to its existing owner. Validation nevertheless checks the Make against the bridge key and rejects it.  
    **Smallest fix:** determine mapped sections first and check keys only for sections the reference fills.

Findings 10–13 were verified by source inspection; **could not verify** their end-to-end execution. Browser audio and actual PCM export also remain unverified. Small probes used current checkout source and existing sibling dependencies without writing files.

Checked and found correct:

- Migration 0011 only adds tables, indexes, and columns; it rebuilds no existing tables.
- Stored release snapshots include definition, Oak code, take code, cells, labels, and BPM; subsequent take writes leave them unchanged.
- Start/take deduplication, shared idempotency handling, release prerequisites, and transactional writes are implemented.
- Routes use the existing security middleware and Zod validation; invalid sketch origins and out-of-step cells are rejected.
- Declared/played claims, `oakKeeps`, stale-cell handling, and later ownership overrides are correct; hit-by-hit drum filtering was also probed successfully.
- Loop playback passes the Band separately, and saved-source tempo neutralization is restored after evaluation.

