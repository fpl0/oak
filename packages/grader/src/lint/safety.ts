// Safety profiles (contracts §11.3), on the acorn AST.
//
// Base (all code, including what the learner types): no import()/import.meta/with, no host identifiers,
// no `.constructor`/`.__proto__`/`.prototype`, no remote samples().
// Strict (code the learner did not type: tutor cards, authored content, Band code, imported sketches):
// base plus the four rule groups of §11.3 and the spike S1 findings (Object, Reflect, Symbol, Proxy
// reach Function without a banned word; destructuring keys; dunder names). A snippet that fails the
// strict profile is never evaluated anywhere.
//
// This is one layer, not a sandbox: the realm also shadows globals, neuters Function and bans import().
// In the PAGE (a card's Preview, an imported sketch, an Export) it is the only layer: the page keeps the
// Function constructor (Strudel's evaluate needs it) and every global. So the strict profile is an
// ALLOWLIST of the names code may read from outside itself (review:security, Wave 7): Strudel's own scope
// as the grader realm has it, minus the functions that hand back a host object or turn a string into a
// property key, plus a few plain ES builtins. Before it, `getDrawContext().canvas.ownerDocument` reached
// the DOM (and a `data:` script ran), and `parseFractional("con" + "structor")` returned `Object`.
import { type AstNode, child, children, staticString, stringLit, walk } from "./ast.ts";

export interface SafetyFinding {
  id:
    | "lint.base.import"
    | "lint.base.with"
    | "lint.base.identifier"
    | "lint.base.member"
    | "lint.base.remote-samples"
    | "lint.strict.computed-member"
    | "lint.strict.this"
    | "lint.strict.reserved-string"
    | "lint.strict.construct";
  start: number;
  end: number;
  params: Record<string, string>;
}

/** contracts §11.3: rejected for all code. */
export const BASE_IDENTIFIERS: ReadonlySet<string> = new Set(
  (
    "globalThis self window document process Bun require module fetch XMLHttpRequest WebSocket EventSource " +
    "Worker SharedWorker eval Function importScripts navigator postMessage localStorage sessionStorage " +
    "indexedDB caches"
  ).split(" "),
);

/** Strict profile additions (spike S1): every other route to the host realm or to code generation. */
export const STRICT_IDENTIFIERS: ReadonlySet<string> = new Set(
  (
    "global top parent frames location exports ServiceWorker BroadcastChannel MessageChannel AsyncFunction " +
    "GeneratorFunction ShadowRealm WebAssembly setTimeout setInterval setImmediate queueMicrotask " +
    "requestAnimationFrame Reflect Proxy Object Symbol evaluate evalScope strudelScope repl register " +
    "registerControl registerMultiControl createParam createParams registerLanguage registerWidgetType " +
    "compileKabel worklet arguments"
  ).split(" "),
);

export const RESERVED_WORDS: readonly string[] = ["constructor", "__proto__", "prototype"];

/**
 * Strict: names of Strudel's scope that code the learner did not type may not read. Each either hands back
 * something of the host (a clock, a trigger, the keyboard state, the realm's registries), changes the realm's
 * shared state, compiles a string into code (bytebeat) or looks a caller's string up as a property key
 * (`parseFractional("con" + "structor")` is `Object`; `fractionalArgs` applies it to every argument).
 */
export const STRICT_GADGETS: ReadonlySet<string> = new Set(
  (
    "parseFractional fractionalArgs getCurrentKeyboardState keyDown _keyDown logKey ClockCollator Cyclist " +
    "createClock getTrigger getTriggerFunc getPattern getTime getIsStarted setCpsFunc setIsStarted setPattern " +
    "setStringParser setTime setTriggerFunc reset_state reset_timelines cleanupUi backgroundImage logger " +
    "errorLogger controls bbexpr byteBeatExpression byteBeatStartTime Pattern Hap State TimeSpan StartRules " +
    "SyntaxError getLeafLocation getLeafLocations getLeaves mini2ast miniAllStrings minify parse " +
    "patternifyAST addVoicings resetVoicings registerVoicings setDefaultVoicings setVoicingRange voicingAlias " +
    "voicingRegistry packageName"
  ).split(" "),
);

/**
 * Strict: plain ES builtins code may read besides Strudel's scope (the grader realm's safe builtins without
 * `Object`, `Symbol`, `Reflect` and `Proxy`, which reach `Function`, and without the constructors only `new`
 * would use).
 */
export const STRICT_SAFE_GLOBALS: ReadonlySet<string> = new Set(
  (
    "undefined NaN Infinity Math Number String Boolean Array JSON isNaN isFinite parseInt parseFloat " +
    "encodeURIComponent decodeURIComponent"
  ).split(" "),
);

/**
 * Strict: property names that walk from a value Oak hands to a callback (a canvas context in `.onPaint`,
 * `.draw`) to the document or the window, that reflect on objects, or that compile a string into code in the
 * audio thread (bytebeat). Refused wherever the name appears.
 */
export const STRICT_MEMBER_NAMES: ReadonlySet<string> = new Set(
  (
    "canvas ownerDocument defaultView getRootNode parentNode parentElement contentWindow contentDocument " +
    "documentElement ownerElement frameElement opener audioWorklet srcElement baseURI cookie " +
    "getOwnPropertyDescriptor getOwnPropertyDescriptors getPrototypeOf setPrototypeOf defineProperty " +
    "defineProperties getOwnPropertyNames getOwnPropertySymbols bbexpr byteBeatExpression"
  ).split(" "),
);

/** Is this Identifier a reference or binding (not a property name after `.` or an object key)? */
function isReference(node: AstNode, parent: AstNode | undefined): boolean {
  if (!parent) return true;
  if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return false;
  if (
    (parent.type === "Property" || parent.type === "MethodDefinition") &&
    parent.key === node &&
    !parent.computed
  ) {
    // `{ fetch }` shorthand is still a reference to `fetch`.
    return parent.shorthand === true;
  }
  if (
    parent.type === "LabeledStatement" ||
    parent.type === "BreakStatement" ||
    parent.type === "ContinueStatement"
  )
    return false;
  return true;
}

/**
 * A sample location that leaves the machine: any URL scheme (`https:`, `github:`, `shabda:`, `wss:` ...)
 * or a network path (`//host`, and `\\host`, which a browser's URL parser reads as `//host`). Leading C0
 * controls and spaces are stripped first, as the URL parser does.
 */
export function isRemoteLocation(value: string): boolean {
  let i = 0;
  while (i < value.length && value.charCodeAt(i) <= 0x20) i++;
  const v = value.slice(i);
  return /^(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i.test(v);
}

/**
 * Calls that load sounds from a location: `samples(map | url, base?)`, `aliasBank(url)`, and superdough's
 * `tables(url, frameLen?, json?)` (wavetables, sound pack v4: Oak's own are served with the pack).
 */
const SAMPLE_LOADERS: ReadonlySet<string> = new Set(["samples", "aliasBank", "tables"]);

function calleeName(n: AstNode): string {
  const callee = child(n, "callee");
  if (callee?.type === "Identifier") return callee.name as string;
  if (callee?.type === "MemberExpression" && !callee.computed)
    return (child(callee, "property")?.name as string | undefined) ?? "";
  return "";
}

/** Every string value inside a loader's arguments (map values, array items, the base; not map keys). */
function stringsIn(arg: AstNode): StringLitLike[] {
  const out: StringLitLike[] = [];
  walk(arg, (n, ancestors) => {
    const parent = ancestors[ancestors.length - 1];
    if (parent?.type === "Property" && parent.key === n && !parent.computed) return undefined;
    const s = stringLit(n);
    if (s) out.push({ node: n, value: s.value });
    return undefined;
  });
  return out;
}
interface StringLitLike {
  node: AstNode;
  value: string;
}

/** Only literals, arrays and plain objects of them: what the lint can read in full. */
function isStaticData(n: AstNode): boolean {
  switch (n.type) {
    case "Literal":
      return !n.regex;
    case "TemplateLiteral":
      return children(n, "expressions").length === 0;
    case "ArrayExpression":
      return children(n, "elements").every(isStaticData);
    case "ObjectExpression":
      return children(n, "properties").every(
        (p) =>
          p.type === "Property" &&
          !p.computed &&
          !p.method &&
          p.kind === "init" &&
          isStaticData(child(p, "value") as AstNode),
      );
    default:
      return false;
  }
}

export function baseFindings(ast: AstNode): SafetyFinding[] {
  const out: SafetyFinding[] = [];
  const add = (id: SafetyFinding["id"], n: AstNode, params: Record<string, string> = {}) =>
    out.push({ id, start: n.start, end: n.end, params });
  walk(ast, (n, ancestors) => {
    const parent = ancestors[ancestors.length - 1];
    switch (n.type) {
      case "ImportExpression":
        add("lint.base.import", n, { what: "import()" });
        break;
      case "ImportDeclaration":
      case "ExportNamedDeclaration":
      case "ExportDefaultDeclaration":
      case "ExportAllDeclaration":
        add("lint.base.import", n, { what: n.type.startsWith("Import") ? "import" : "export" });
        break;
      case "MetaProperty":
        add("lint.base.import", n, { what: "import.meta" });
        break;
      case "WithStatement":
        add("lint.base.with", n);
        break;
      case "Identifier": {
        const name = n.name as string;
        if (BASE_IDENTIFIERS.has(name) && isReference(n, parent)) add("lint.base.identifier", n, { name });
        break;
      }
      case "MemberExpression": {
        const prop = child(n, "property");
        if (!n.computed && prop?.type === "Identifier" && RESERVED_WORDS.includes(prop.name as string)) {
          add("lint.base.member", prop, { name: prop.name as string });
        }
        break;
      }
      case "CallExpression": {
        if (SAMPLE_LOADERS.has(calleeName(n))) {
          for (const a of children(n, "arguments"))
            for (const s of stringsIn(a))
              if (isRemoteLocation(s.value))
                add("lint.base.remote-samples", s.node, { url: s.value, call: calleeName(n) });
        }
        break;
      }
    }
    return undefined;
  });
  return out;
}

const isNumericLiteral = (n: AstNode | null) => !!n && n.type === "Literal" && typeof n.value === "number";
/** An array written out in place (`f(...[a, b])` is `f(a, b)`): its length is in the source. */
const isLiteralArray = (n: AstNode | null) =>
  !!n && n.type === "ArrayExpression" && children(n, "elements").every((e) => e.type !== "SpreadElement");

/**
 * The strict rules. `allowedFree`: the names code may read from outside itself (`strictAllowedNames` in
 * oak.ts); every other free name is refused.
 */
export function strictFindings(ast: AstNode, allowedFree?: ReadonlySet<string>): SafetyFinding[] {
  const out: SafetyFinding[] = [];
  if (allowedFree) out.push(...freeNameFindings(ast, allowedFree));
  const construct = (n: AstNode, what: string) =>
    out.push({ id: "lint.strict.construct", start: n.start, end: n.end, params: { what } });
  const reserved = (n: AstNode, word: string) =>
    out.push({ id: "lint.strict.reserved-string", start: n.start, end: n.end, params: { word } });
  const checkText = (text: string, n: AstNode) => {
    for (const w of RESERVED_WORDS) if (text.includes(w)) reserved(n, w);
  };
  walk(ast, (n, ancestors) => {
    const parent = ancestors[ancestors.length - 1];
    switch (n.type) {
      case "ThisExpression":
        out.push({ id: "lint.strict.this", start: n.start, end: n.end, params: {} });
        break;
      case "Super":
        construct(n, "`super`");
        break;
      case "MemberExpression":
        if (n.computed && !isNumericLiteral(child(n, "property"))) {
          out.push({
            id: "lint.strict.computed-member",
            start: n.start,
            end: n.end,
            params: { what: "x[…] with a name or an expression" },
          });
        }
        break;
      case "Property":
        if (n.computed) {
          out.push({
            id: "lint.strict.computed-member",
            start: n.start,
            end: n.end,
            params: { what: "a computed key {[k]: …}" },
          });
        }
        if (n.kind === "get" || n.kind === "set") construct(n, "A getter or setter");
        if (n.method === true) construct(n, "A method definition");
        break;
      case "Identifier": {
        const name = n.name as string;
        if (RESERVED_WORDS.includes(name)) reserved(n, name);
        else if (name.startsWith("__")) construct(n, `The name \`${name}\``);
        else if (STRICT_MEMBER_NAMES.has(name)) construct(n, `The name \`${name}\``);
        else if (STRICT_IDENTIFIERS.has(name) && isReference(n, parent)) construct(n, `\`${name}\``);
        break;
      }
      case "PrivateIdentifier":
        construct(n, "A private name");
        break;
      case "Literal":
        if (typeof n.value === "string") checkText(n.value, n);
        if (n.regex) construct(n, "A regular expression");
        break;
      case "TemplateLiteral":
        if (children(n, "expressions").length > 0) construct(n, "An interpolation inside a template string");
        for (const q of children(n, "quasis")) {
          const v = q.value as { raw: string; cooked?: string | null };
          checkText(`${v.raw}\u0000${v.cooked ?? ""}`, q);
        }
        break;
      case "TaggedTemplateExpression":
        construct(n, "A tagged template");
        break;
      case "NewExpression":
        construct(n, "`new`");
        break;
      case "ClassDeclaration":
      case "ClassExpression":
        construct(n, "A class");
        break;
      case "FunctionDeclaration":
      case "FunctionExpression":
        construct(n, "A `function`");
        break;
      case "ArrowFunctionExpression":
        if (child(n, "body")?.type === "BlockStatement") construct(n, "An arrow function with a { } body");
        if (n.async) construct(n, "`async`");
        break;
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement":
      case "WhileStatement":
      case "DoWhileStatement":
        construct(n, "A loop");
        break;
      case "TryStatement":
        construct(n, "`try`");
        break;
      case "AwaitExpression":
        construct(n, "`await`");
        break;
      case "YieldExpression":
        construct(n, "A generator");
        break;
      case "AssignmentExpression":
      case "UpdateExpression":
        construct(n, "Assignment");
        break;
      case "VariableDeclaration":
        if (n.kind !== "const") construct(n, `\`${n.kind as string}\` (use const)`);
        break;
      case "SpreadElement":
        if (parent?.type === "CallExpression" || parent?.type === "NewExpression") {
          if (!isLiteralArray(child(n, "argument"))) construct(n, "Spreading a value into a call");
        }
        break;
      case "CallExpression":
        // What a loader fetches must be readable here, or the base rule cannot see a remote URL in it.
        if (SAMPLE_LOADERS.has(calleeName(n)) && !children(n, "arguments").every(isStaticData))
          construct(n, `\`${calleeName(n)}()\` with a value the lint cannot read`);
        break;
      case "DebuggerStatement":
        construct(n, "`debugger`");
        break;
      case "SequenceExpression":
        construct(n, "The comma operator");
        break;
      case "BinaryExpression": {
        // `"con" + "structor"`: the parts pass rule 3, the text they make does not.
        if (n.operator !== "+" || parent?.type === "BinaryExpression") break;
        const text = staticString(n);
        if (text !== null) checkText(text, n);
        break;
      }
    }
    return undefined;
  });
  return out;
}

/** Every name a pattern binds (`const {a, b: [c]} = …`, arrow parameters). */
function patternNames(p: AstNode | null, into: Set<AstNode>, names: Set<string>): void {
  if (!p) return;
  switch (p.type) {
    case "Identifier":
      into.add(p);
      names.add(p.name as string);
      break;
    case "ObjectPattern":
      for (const prop of children(p, "properties"))
        patternNames(
          prop.type === "RestElement" ? child(prop, "argument") : child(prop, "value"),
          into,
          names,
        );
      break;
    case "ArrayPattern":
      for (const e of children(p, "elements")) patternNames(e, into, names);
      break;
    case "RestElement":
      patternNames(child(p, "argument"), into, names);
      break;
    case "AssignmentPattern":
      patternNames(child(p, "left"), into, names);
      break;
  }
}

const SCOPES = new Set([
  "Program",
  "BlockStatement",
  "StaticBlock",
  "SwitchStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "CatchClause",
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
  "ClassExpression",
]);

/**
 * Strict: a name the code reads but never binds must be one of `allowed`. Scopes are lexical: a name bound
 * in one arrow does not make the same name free elsewhere (`(open => 1); open("…")` is refused).
 */
export function freeNameFindings(ast: AstNode, allowed: ReadonlySet<string>): SafetyFinding[] {
  const binders = new Set<AstNode>();
  const declared = new Map<AstNode, Set<string>>();
  const declare = (scope: AstNode | undefined, pattern: AstNode | null) => {
    if (!scope) return;
    const names = declared.get(scope) ?? new Set<string>();
    declared.set(scope, names);
    patternNames(pattern, binders, names);
  };
  const nearestScope = (ancestors: readonly AstNode[]) => {
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const a = ancestors[i] as AstNode;
      if (SCOPES.has(a.type)) return a;
    }
    return undefined;
  };
  walk(ast, (n, ancestors) => {
    switch (n.type) {
      case "VariableDeclarator":
        declare(nearestScope(ancestors), child(n, "id"));
        break;
      case "FunctionDeclaration":
      case "ClassDeclaration":
        declare(nearestScope(ancestors), child(n, "id"));
        if (n.type === "FunctionDeclaration") for (const p of children(n, "params")) declare(n, p);
        break;
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        declare(n, child(n, "id"));
        for (const p of children(n, "params")) declare(n, p);
        break;
      case "ClassExpression":
        declare(n, child(n, "id"));
        break;
      case "CatchClause":
        declare(n, child(n, "param"));
        break;
    }
    return undefined;
  });

  const out: SafetyFinding[] = [];
  walk(ast, (n, ancestors) => {
    if (n.type === "MetaProperty") return false;
    if (n.type !== "Identifier" || binders.has(n)) return undefined;
    const parent = ancestors[ancestors.length - 1];
    const name = n.name as string;
    if (parent) {
      // Property names, labels and keys are not reads (a shorthand `{ a }` reads its value copy).
      if (parent.type === "MemberExpression" && parent.property === n && !parent.computed) return undefined;
      if (
        (parent.type === "Property" ||
          parent.type === "MethodDefinition" ||
          parent.type === "PropertyDefinition") &&
        parent.key === n &&
        !parent.computed
      )
        return undefined;
      if (
        parent.type === "LabeledStatement" ||
        parent.type === "BreakStatement" ||
        parent.type === "ContinueStatement"
      )
        return undefined;
    }
    // The base and strict identifier rules already name these.
    if (BASE_IDENTIFIERS.has(name) || STRICT_IDENTIFIERS.has(name)) return undefined;
    if (ancestors.some((a) => declared.get(a)?.has(name))) return undefined;
    if (allowed.has(name)) return undefined;
    out.push({
      id: "lint.strict.construct",
      start: n.start,
      end: n.end,
      params: { what: `\`${name}\` (not a Strudel function this code may use)` },
    });
    return undefined;
  });
  return out;
}
