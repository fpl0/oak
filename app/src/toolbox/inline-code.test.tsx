import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineCodeText } from "../session/today/SideOffer.tsx";

describe("inline code on toolbox cards", () => {
  test("punctuation after a code span hugs it and wraps with it", () => {
    const html = renderToStaticMarkup(<InlineCodeText text="The kick sound, written `bd`." />);
    expect(html).toContain('<span class="whitespace-nowrap"><code class="rounded bg-surface-2 pr-0.5 pl-1');
    expect(html).toMatch(/>bd<\/code>\.<\/span>$/);
    // The full stop is not printed a second time after the chip.
    expect(html).not.toContain("<span>.</span>");
  });

  test("a span followed by a word keeps its padding on both sides", () => {
    const html = renderToStaticMarkup(<InlineCodeText text="`const` pattern variables" />);
    expect(html).toBe(
      '<code class="rounded bg-surface-2 px-1 font-mono text-[0.85em]">const</code><span> pattern variables</span>',
    );
  });
});
