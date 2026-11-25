// Renders the closed markdown AST of markdown.ts. Strings only ever become React text children (escaped); there
// is no dangerouslySetInnerHTML anywhere in the tutor UI. `[[reveal]]` is handed to `renderReveal`, `[[later]]` (Oak 2.0
// W1) to `renderLater`; without a renderer either renders nothing.
import type { SubjectRef } from "@oak/api";
import { Link } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext } from "react";
import { type Block, type Inline, parseInline, parseMarkdown } from "./markdown.ts";
import type { TokenContext } from "./music-tokens.ts";
import { splitSections } from "./sections.ts";
import { SectionChip, TokenChip } from "./TokenChip.tsx";

export interface MarkdownProps {
  text: string;
  ctx: TokenContext;
  thread: SubjectRef;
  /** What `[[reveal]]` becomes (the Reveal (hint 4) button, or nothing). */
  renderReveal?: () => ReactNode;
  /** What `[[later]]` becomes ("Park it for later" in chat, hint and explain threads; nothing elsewhere). */
  renderLater?: () => ReactNode;
}

/**
 * Oak 2.0 W1: what `[[later]]` becomes when a message's own `renderLater` is not given. The tutor panel provides it
 * around the replies of chat, hint and explain threads (with the question each one answers); everywhere else there is
 * no provider and the token renders nothing.
 */
export const LaterOfferContext = createContext<(() => ReactNode) | null>(null);

function withLater(props: MarkdownProps, fromContext: (() => ReactNode) | null): MarkdownProps {
  return props.renderLater || !fromContext ? props : { ...props, renderLater: fromContext };
}

function inlines(nodes: Inline[], p: MarkdownProps, key: string): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}.${i}`;
    switch (n.t) {
      case "text": {
        // Wave 5: section names become chips that select the section in the form view.
        const sections = p.ctx.sections ?? [];
        if (sections.length === 0) return n.text;
        const parts = splitSections(n.text, sections);
        if (parts.length === 1 && typeof parts[0] === "string") return n.text;
        return (
          <span key={k}>
            {parts.map((part, j) =>
              typeof part === "string" ? (
                part
              ) : (
                <SectionChip
                  key={`${k}.s${j}`}
                  raw={part.raw}
                  section={part.section}
                  pickup={p.ctx.pickup === true}
                  thread={p.thread}
                />
              ),
            )}
          </span>
        );
      }
      case "br":
        return <br key={k} />;
      case "code":
        return (
          <code key={k} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem]">
            {n.text}
          </code>
        );
      case "strong":
        return (
          <strong key={k} className="font-semibold">
            {inlines(n.children, p, k)}
          </strong>
        );
      case "em":
        return <em key={k}>{inlines(n.children, p, k)}</em>;
      case "link":
        return (
          <Link key={k} to={n.href as "/"} className="text-link underline underline-offset-2">
            {inlines(n.children, p, k)}
          </Link>
        );
      case "token":
        if (n.token.kind === "reveal") return <span key={k}>{p.renderReveal?.() ?? null}</span>;
        if (n.token.kind === "later") return <span key={k}>{p.renderLater?.() ?? null}</span>;
        return <TokenChip key={k} token={n.token} raw={n.raw} ctx={p.ctx} thread={p.thread} />;
      default:
        return null;
    }
  });
}

function blocks(bs: Block[], p: MarkdownProps, key: string): ReactNode[] {
  return bs.map((b, i) => {
    const k = `${key}.${i}`;
    switch (b.t) {
      case "p":
        return <p key={k}>{inlines(b.children, p, k)}</p>;
      case "h": {
        const H = b.level === 1 ? "h3" : b.level === 2 ? "h4" : "h5";
        return (
          <H key={k} className="font-sans text-base font-semibold text-text">
            {inlines(b.children, p, k)}
          </H>
        );
      }
      case "ul":
        return (
          <ul key={k} className="ml-5 list-disc space-y-1">
            {b.items.map((it, j) => (
              <li key={`${k}.${j}`}>{inlines(it, p, `${k}.${j}`)}</li>
            ))}
          </ul>
        );
      case "ol":
        return (
          <ol key={k} start={b.start} className="ml-5 list-decimal space-y-1">
            {b.items.map((it, j) => (
              <li key={`${k}.${j}`}>{inlines(it, p, `${k}.${j}`)}</li>
            ))}
          </ol>
        );
      case "quote":
        return (
          <blockquote key={k} className="border-l-2 border-border pl-3 text-text-2">
            {blocks(b.children, p, k)}
          </blockquote>
        );
      case "pre":
        return (
          <pre
            key={k}
            className="overflow-x-auto rounded-control border border-border bg-surface-2 p-2 font-mono text-[0.8125rem] leading-snug"
          >
            {b.text}
          </pre>
        );
      case "hr":
        return <hr key={k} className="border-border" />;
      default:
        return null;
    }
  });
}

export function Markdown(props: MarkdownProps) {
  const later = useContext(LaterOfferContext);
  const doc = parseMarkdown(props.text);
  return (
    <div className="flex flex-col gap-2 leading-relaxed break-words">
      {blocks(doc, withLater(props, later), "m")}
    </div>
  );
}

/**
 * One line of tutor markup inside other text (a review's strength, a revision's reason): music tokens become chips,
 * emphasis and inline code render, nothing becomes a block.
 */
export function InlineMarkdown(props: MarkdownProps) {
  const later = useContext(LaterOfferContext);
  return <>{inlines(parseInline(props.text), withLater(props, later), "i")}</>;
}
