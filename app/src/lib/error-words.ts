// The learner's words for an action that failed (a toast's detail, a "Not saved." line): the same wording the
// pages' error states use (`describeError`), so no raw exception text ("TypeError: Failed to fetch",
// "sketches.update: HTTP 502") ever reaches the learner. A message Oak's own API wrote (a validation problem) is
// already said for the learner and stays as written.
import { OakApiError } from "@oak/api";
import { describeError, isServerDown, SERVER_DOWN } from "../ui/kit/QueryState.tsx";

/** Codes `describeError` has its own sentence for. */
const WORDED = new Set(["not_found", "contract", "forbidden", "not_implemented"]);

/** The browser's own words for a request that never got an answer (Chrome, Firefox, Safari). */
const NO_ANSWER = /failed to fetch|networkerror|load failed|network request failed/i;

const sentence = (s: string): string => {
  const t = s.trim();
  return /[.!?…]$/.test(t) ? t : `${t}.`;
};

/** One or two full sentences, each ending in a full stop, for any thrown value. */
export function errorWords(error: unknown): string {
  if (isServerDown(error) || (error instanceof TypeError && NO_ANSWER.test(error.message)))
    // Not SERVER_DOWN.body: its "Your work is saved." would contradict "Not saved." after a failed save.
    return `${SERVER_DOWN.title}. Start Oak again (in a terminal: bun run start).`;
  if (error instanceof OakApiError) {
    if (error.code === "aborted") return "It was stopped before it finished. Try again.";
    if (WORDED.has(error.code)) return sentence(describeError(error).body);
    // The client's own messages start with the endpoint's name ("sketches.update: HTTP 500"); a message the
    // server wrote for the learner does not.
    const own = error.message.trim();
    if (own && !own.startsWith(`${error.endpoint}:`) && !/\bHTTP \d{3}\b/.test(own)) return sentence(own);
    return "Oak's server could not do it. Try again.";
  }
  return "Something went wrong. Try again.";
}
