// A Band that follows the learner's song form (Wave 5, U09 on; contracts §6.3 and §5.10). The static reader and the
// rewrite live in the grader package (`@oak/grader/song`, packages/grader/src/song/band-form.ts) because the
// unit-song composer reads a source's sections with them and the grader may not import the adapter; they are
// re-exported here unchanged for the adapter (band.ts, editor.ts, pattern-player.ts).
export {
  type ArrangeCall,
  type ArrangeSection,
  arrangeCalls,
  followLearnerForm,
  formBarsOf,
  learnerSectionsOf,
  sectionTypeOf,
} from "@oak/grader/song";
