import { chainOf, child, nameOf, parseProgram, programInfo } from "../lint/ast.ts";

const AFTER_SCALE = new Set(["rev", "early", "late", "scaleTranspose", "ply", "segment"]);

/** Insert at AST boundaries so comments, other parts and the learner's layout survive unchanged. */
export function wrapChain(code: string, label: string, method: string, args: string): string {
  const parsed = parseProgram(code);
  if (!parsed.ok) return code;
  const part = programInfo(parsed.ast).labels.find((part) => part.label === label);
  if (!part?.expr) return code;
  const chain = chainOf(part.expr);
  const scale = chain.links.find((link) => link.name === "scale");
  let at = part.expr.end;
  if (scale && AFTER_SCALE.has(method)) at = scale.call.end;
  if (scale && method === "add") {
    const argument = parseProgram(`(${args})`);
    const expr = argument.ok ? programInfo(argument.ast).expressions[0] : undefined;
    if (expr?.type === "CallExpression" && nameOf(child(expr, "callee")) === "n") {
      const callee = child(scale.call, "callee");
      const receiver = callee ? child(callee, "object") : null;
      if (receiver) at = receiver.end;
    }
  }
  return `${code.slice(0, at)}.${method}(${args})${code.slice(at)}`;
}
