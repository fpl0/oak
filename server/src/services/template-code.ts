import { chainLinks, constDecls, labelledLines, SOUND_LINKS, tempoLineOf } from "@oak/content-kit";

const HEADS = new Set(["n", "note", "s", "sound", "chord"]);

/** The set-up of a piece without its notes: tempo line, each part's sound chain with its patterns emptied. */
export function templateOfCode(code: string): { code: string; dropped: string[] } {
  const decls = new Map(constDecls(code).map((d) => [d.name, d.text.slice(d.text.indexOf("=") + 1)]));
  const parts: string[] = [];
  const dropped: string[] = [];
  for (const line of labelledLines(code)) {
    let chain = chainLinks(line.text.slice(line.text.indexOf(":") + 1));
    if (chain?.[0]?.name === "arrange") {
      // Read references in argument order, ignoring names inside comments and literal strings.
      const tokens = chain[0].args.matchAll(
        /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\/|([A-Za-z_$][\w$]*)/g,
      );
      let section: string | undefined;
      for (const token of tokens) {
        if (token[1] !== undefined && decls.has(token[1])) {
          section = decls.get(token[1]);
          break;
        }
      }
      const first = section === undefined ? null : chainLinks(section);
      chain = first === null ? null : [...first, ...chain.slice(1)];
    }
    const head = chain?.[0];
    if (line.muted || !chain || !head || !HEADS.has(head.name)) {
      dropped.push(line.label);
      continue;
    }
    const links = chain.slice(1);
    const content =
      head.name === "s" || head.name === "sound"
        ? links.findIndex((link) => link.name === "n" || link.name === "note")
        : -1;
    const sound = links
      .flatMap((link, i) =>
        i === content
          ? [`.${link.name}("~")`]
          : SOUND_LINKS.has(link.name)
            ? [`.${link.name}(${link.args})`]
            : [],
      )
      .join("");
    parts.push(`${line.label}: ${head.name}(${content < 0 ? '"~"' : head.args})${sound}`);
  }
  const tempo = tempoLineOf(code);
  const lines = tempo === null ? parts : parts.length === 0 ? [tempo] : [tempo, "", ...parts];
  return { code: lines.length === 0 ? "" : `${lines.join("\n")}\n`, dropped };
}
