// Comment stripping for the static readers (the adapter's sounds-in.ts, band-form.ts, the unit-song composer). Its
// own module with no imports: headless, so both realms share it (`@oak/grader/song`; the adapter re-exports it from
// packages/strudel/src/comments.ts).

/** Strips line and block comments, keeping offsets and string contents intact. */
export function stripComments(code: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < code.length) {
    const ch = code[i] as string;
    const next = code[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\" && next !== undefined) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      i++;
    } else if (ch === "/" && next === "/") {
      while (i < code.length && code[i] !== "\n") {
        out += " ";
        i++;
      }
    } else if (ch === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end < 0 ? code.length : end + 2;
      for (; i < stop; i++) out += code[i] === "\n" ? "\n" : " ";
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}
