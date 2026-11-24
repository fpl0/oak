// Settings › Grading reports (contracts §11.8): the "Report a grading problem" queue. A report becomes a
// ready-made `TestCase` for the exercise's `tests`, so a grader false negative turns into a regression test
// once it is fixed. Pure.
import type { QaReport, TestCase } from "@oak/api";

export const QA_STATUSES = ["open", "triaged", "fixed", "wontfix"] as const;
export type QaStatus = (typeof QA_STATUSES)[number];
export const QA_STATUS_LABEL: Record<QaStatus, string> = {
  open: "Open",
  triaged: "Triaged",
  fixed: "Fixed",
  wontfix: "Won't fix",
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The code a report carries (code responses, or a bare string from older clients), for the replay player. */
export function codeOf(r: Pick<QaReport, "response">): string | null {
  if (typeof r.response === "string") return r.response;
  if (isObj(r.response) && typeof r.response.code === "string") return r.response.code;
  return null;
}

/** The response as a `TestResponse`, or why it cannot be one. */
export function testResponseOf(
  response: unknown,
): { ok: true; value: TestCase["response"] } | { ok: false; why: string } {
  if (typeof response === "string") return { ok: true, value: { code: response } };
  if (!isObj(response)) return { ok: false, why: "The report has no response." };
  if (typeof response.code === "string") return { ok: true, value: { code: response.code } };
  if (isObj(response.blanks))
    return { ok: true, value: { blanks: response.blanks as Record<string, string> } };
  if (Array.isArray(response.order)) return { ok: true, value: { order: response.order as string[] } };
  if (response.answer !== undefined)
    return { ok: true, value: { answer: response.answer } as TestCase["response"] };
  if (Array.isArray(response.taps)) return { ok: true, value: { taps: response.taps as number[] } };
  if (typeof response.staff === "string") return { ok: true, value: { staff: response.staff } };
  if (response.click !== undefined)
    return { ok: true, value: { click: response.click } as TestCase["response"] };
  if (Array.isArray(response.sung))
    return { ok: false, why: "A sung answer needs a recorded pitch fixture; save the frames first." };
  if (response.skipped === true) return { ok: false, why: "The step was skipped: nothing to test." };
  return { ok: false, why: "This response shape has no test form yet." };
}

/**
 * The test case a report asks for: the learner says the grade was wrong, so the expectation is the opposite
 * of the recorded status (a reported fail should pass). Pinned params keep the same item.
 */
export function toTestCase(
  r: QaReport,
): { ok: true; test: TestCase; source: string } | { ok: false; why: string } {
  const resp = testResponseOf(r.response);
  if (!resp.ok) return resp;
  const status = r.gradeResult?.status;
  const expect: TestCase["expect"] = status === "pass" ? "fail" : "pass";
  const label = (r.note ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  const test: TestCase = {
    name: `qa#${r.id}${label ? `: ${label}` : ""}`,
    response: resp.value,
    expect,
  };
  if (r.params && Object.keys(r.params).length > 0) test.params = r.params as NonNullable<TestCase["params"]>;
  const where = [r.lessonId, r.exerciseId ?? r.familyId].filter(Boolean).join(" / ");
  const source = `// From grading report #${r.id}${where ? ` (${where})` : ""}, graded ${status ?? "without a result"} on ${r.at}.\n${JSON.stringify(test, null, 2)},\n`;
  return { ok: true, test, source };
}

export function countByStatus(
  reports: readonly Pick<QaReport, "status">[],
): Record<QaStatus | "all", number> {
  const out: Record<QaStatus | "all", number> = {
    all: reports.length,
    open: 0,
    triaged: 0,
    fixed: 0,
    wontfix: 0,
  };
  for (const r of reports) out[r.status] += 1;
  return out;
}
