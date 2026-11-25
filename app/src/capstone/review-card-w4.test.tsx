// Oak 2.0 W4 F4: the review card answers the learner's question first, shows strengths only when there are some, and
// renders a review stored before W4 (no `answer`) exactly as before; the review field's chips write a starter question
// and "Request review" sends the cleaned text. A DOM simulator (happy-dom) renders them.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { ReviewCard } = await import("./ReviewCard.tsx");
const { ReviewAsk } = await import("./ReviewAsk.tsx");

import type { CapstoneReview } from "@oak/api";
import type { ReactNode } from "react";

/** The shape of the server's `CAPSTONE_REVIEW` fixture (`server/src/tutor/testing/fixtures.ts`), without `answer`. */
const STORED: CapstoneReview = {
  strengths: [
    { text: "The bass sits on the root on every downbeat, so the two chords read clearly.", bars: [1, 4] },
    { text: "The hi-hats keep a steady eighth-note pulse under the changes.", bars: [1, 8] },
  ],
  revisions: [
    {
      title: "Land the ending on the tonic",
      bars: [7, 8],
      why: "The last bar stops on degree 4, which leaves the phrase open. Ending on degree 1 closes it.",
      tryCode: 'bass: n("0 ~ 0 4").scale("D2:dorian")',
      skills: ["H02"],
    },
  ],
  listeningQuestion: "In bar 8, does the bass sound finished or does it still lean forward?",
  linerNote:
    "An eight-bar groove in D dorian: a rooted bass under two chords, with a steady hi-hat pulse throughout.",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeAll(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => root?.unmount());
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

function render(node: ReactNode) {
  root = createRoot(container);
  act(() => root.render(node));
}
const byTest = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const before = (a: Element, b: Element) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("ReviewCard", () => {
  test("a stored review without answer renders as before", () => {
    expect("answer" in STORED).toBe(false);
    render(<ReviewCard review={STORED} />);
    expect(byTest("review-answer")).toBeNull();
    expect(byTest("review-strengths")?.querySelectorAll("li")).toHaveLength(2);
    expect(container.textContent).toContain("What works");
    expect(container.textContent).toContain("One revision to try");
    // A null answer (a W4 review without a question) is the same.
    act(() => root.unmount());
    render(<ReviewCard review={{ ...STORED, answer: null }} />);
    expect(byTest("review-answer")).toBeNull();
    expect(byTest("review-strengths")?.querySelectorAll("li")).toHaveLength(2);
  });

  test("the answer comes first", () => {
    const answer = "Yes: the bridge's chords climb while the chorus's stay put (bars 17–24).";
    render(<ReviewCard review={{ ...STORED, answer }} />);
    const a = byTest("review-answer");
    const s = byTest("review-strengths");
    expect(a?.textContent).toContain("Your question, answered");
    expect(a?.textContent).toContain(answer);
    expect(a && s && before(a, s)).toBe(true);
    // …and before the revisions and the listening question too.
    const rev = container.querySelector("[data-revision]");
    expect(a && rev && before(a, rev)).toBe(true);
  });

  test("zero strengths: no strengths list, revisions still shown", () => {
    render(<ReviewCard review={{ ...STORED, strengths: [] }} />);
    expect(byTest("review-strengths")).toBeNull();
    expect(container.textContent).not.toContain("What works");
    expect(container.querySelectorAll("[data-revision]")).toHaveLength(1);
    expect(container.textContent).toContain("Land the ending on the tonic");
  });

  test("a blank answer is not shown", () => {
    render(<ReviewCard review={{ ...STORED, answer: "   " }} />);
    expect(byTest("review-answer")).toBeNull();
  });
});

describe("ReviewAsk", () => {
  const setValue = (el: HTMLTextAreaElement, value: string) => {
    const proto = Object.getPrototypeOf(el) as object;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    act(() => {
      setter?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  test("a chip fills the field; the detail prompt waits for its bars; the request sends the cleaned text", () => {
    const sent: (string | null)[] = [];
    render(<ReviewAsk disabled={false} onRequest={(q) => sent.push(q)} />);
    const field = byTest("review-question") as HTMLTextAreaElement;
    const button = byTest("request-review") as HTMLButtonElement;
    act(() => (byTest("review-prompt-form") as HTMLButtonElement).click());
    expect(field.value).toBe("Does the form keep a listener with it to the end?");
    act(() => (byTest("review-prompt-detail") as HTMLButtonElement).click());
    expect(field.value).toBe("In bars _ to _, does this part work?");
    expect(button.disabled).toBe(true);
    expect(byTest("review-question-note")).not.toBeNull();
    setValue(field, "  In bars 5 to 8,   does this part work? ");
    expect(button.disabled).toBe(false);
    act(() => button.click());
    expect(sent).toEqual(["In bars 5 to 8, does this part work?"]);
  });

  test("an empty field requests a review with no question", () => {
    const sent: (string | null)[] = [];
    render(<ReviewAsk disabled={false} onRequest={(q) => sent.push(q)} />);
    act(() => (byTest("request-review") as HTMLButtonElement).click());
    expect(sent).toEqual([null]);
  });

  test("disabled stays disabled", () => {
    render(<ReviewAsk disabled onRequest={() => {}} />);
    expect((byTest("request-review") as HTMLButtonElement).disabled).toBe(true);
  });
});
