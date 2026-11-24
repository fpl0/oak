# Oak: technical architecture and implementation blueprint

I found no hard blockers. Everything below fits inside the decisions you already made. Five places need a refinement, and each is flagged ⚠ where it comes up:

* **⚠ A1. Per-route effort uses per-message effort.** Every route sends one top-level request shape with `output_config.effort:"medium"`. Each route's effort (low, medium or high) is set with effort-only `role:"system"` messages under beta `mid-conversation-output-config-2026-07-01`. Changing the top-level effort would invalidate the messages cache, and on some models also the tools and system cache. This keeps the 1-hour prefix shared across every route.
* **⚠ A2. React Compiler stays on Babel 7.** Pin `@babel/core@7.29.13`. `babel-plugin-react-compiler@1.0.0` depends on `@babel/types ^7`, but npm "latest" for `@babel/core` is now 8.1.0.
* **⚠ A3. The grader worker on the server runs with `env:{}`.** It is a Bun Worker with `env:{}` and `smol:true`, plus an AST safety lint. The API key is removed from `process.env` before any worker is spawned. `Bun.WorkerOptions.env` is verified in bun-types 1.4.4.
* **⚠ A4. The API contract lives in `@oak/api` and Hono only implements it.** App and server share zod contracts there. We do not import Hono's `AppType` into the app, so the DOM and Bun type worlds never mix.
* **⚠ A5. The sound pack budget needs pruning.** Five full drum-machine banks come to about 30–35 MB. Prune them to the voices we teach, with at most 2 variants each, to land at 20–25 MB. `bun run sounds:check` enforces the budget.

---

## 1. Repo layout and toolchain

### 1.1 Tree (`/Users/fpl0/Code/Oak`, Bun workspaces)

```
Oak/
  package.json                 # workspaces, scripts, patchedDependencies, engines {bun:1.4.4,node:>=26}
  bunfig.toml                  # [install] exact=true; [test] preload, timeout
  biome.json                   # lint+format; noRestrictedImports boundaries
  tsconfig.base.json           # shared compilerOptions + paths
  tsconfig.app.json            # app/ + packages/* + content/ (DOM, vite/client)
  tsconfig.server.json         # server/ + packages/* + content/ + scripts/ (bun-types, no DOM)
  tsconfig.worklet.json        # packages/audio/src/worklets/** (AudioWorkletGlobalScope lib)
  vitest.browser.config.ts     # optional browser-mode tests
  playwright.config.ts
  .env.local                   # ANTHROPIC_API_KEY (gitignored; optional, see §5.1)
  patches/@kabelsalat%2Fweb@0.4.1.patch
  types/                       # ambient .d.ts: strudel.d.ts, abcjs-ext.d.ts, signalsmith-stretch.d.ts
  app/                         # Vite 8 + React 19.3 SPA
    index.html                 # contains <canvas id="test-canvas" hidden> (Strudel getDrawContext sink)
    vite.config.ts
    public/sw.js               # hand-written Service Worker (prod only)
    src/
      main.tsx  router.tsx  styles/app.css
      routes/                  # TanStack file routes (see §2.12)
      workbench/               # Workbench, PianoRoll, StaffView, StaffInput, TransportBar, FeedbackPanel, highlight-bus.ts, clock.ts
      lesson/                  # LessonRunner, lesson.machine.ts (xstate), mdx/ (author component set)
      drills/                  # DrillRunner, drill.machine.ts, answer inputs
      tutor/                   # TutorPanel, sse-client.ts, CodeCard, store.ts
      session/                 # Today, plan view, streak, can-do, skill map, toolbox, album, sketchbook
      studio/                  # TranscriptionStudio
      lib/                     # api client, query hooks, grader-client.ts, content.ts
  server/
    src/
      main.ts  app.ts  config.ts  security.ts  static.ts
      db/ index.ts  migrate.ts  migrations/0001_init.sql …  repos/*.ts
      routes/*.ts              # one file per resource (implements @oak/api contracts)
      services/ srs.ts mastery.ts unlocks.ts session-plan.ts streak.ts cando.ts album.ts audio-store.ts backup.ts
      grader/ host.ts bun-worker.ts
      tutor/ client.ts request.ts loop.ts conversation.ts prompt/ tools/ pricing.ts usage.ts routes.ts cassettes/
  packages/
    api/          @oak/api          zod contracts, typed fetch client, SSE event types         (isomorphic)
    theory/       @oak/theory       tonal@6.5.1 wrappers + normalization, degrees, RN, schemas (isomorphic)
    grader/       @oak/grader       headless Strudel runtime, .p collector, normalize, checks,
                                    rules, safety lint, worker protocol, browser host          (isomorphic)
    notation/     @oak/notation     NotationModel, quantizer, speller, ABC emitter             (isomorphic)
    pitch/        @oak/pitch        pitchy wrapper, smoothing, segmentation, sung-note grading (isomorphic)
    drills/       @oak/drills       generators, staircase, trial grading, AudioPlan            (isomorphic)
    srs/          @oak/srs          ts-fsrs 6 wrapper, outcome→grade, queue builder            (isomorphic)
    content-kit/  @oak/content-kit  defineLesson/Unit/Fn/Family/Song, zod schemas, check builders (isomorphic)
    strudel/      @oak/strudel      OakStrudel adapter: editors, transport, prebake, sounds,
                                    preload, master bus, recorder, CM6 extensions               (browser)
    audio/        @oak/audio        mic graph, pitch worklet, calibration, headphone check,
                                    transcription player (stretch + wavesurfer)                (browser)
  content/
    AUTHORING.md STYLE.md course.ts concepts.ts families.ts facts.ts cando.ts
    catalog/functions/*.ts  catalog/sounds.ts
    repertoire/<song-id>/song.ts
    core/u00-welcome/unit.ts  core/u00-welcome/01-hello-strudel/{lesson.ts,lesson.mdx}
    advanced/{jazz,rhythm,arrangement}/…
    validate/*.test.ts  validate/__snapshots__/
    .qa/listen-log.json        # committed
    .generated/                # gitignored build output (§3.6)
  sounds/
    pack.lock.json             # committed: every file, source URL, bytes, sha256
    pack/                      # gitignored mirror output, served at /sounds/<packVersion>/
  scripts/
    sounds/{mirror,prune,manifest,check}.ts
    content/{build,new,check}.ts
    catalog/extract-strudel-docs.ts
    fixtures/synth-voice.ts
    check-deps.ts  tutor/{count-tokens,smoke}.ts  db/backup.ts
  tests/ setup/bun-preload.ts  fixtures/audio/*.wav  fixtures/notation/*.strudel
  e2e/ *.spec.ts
```

### 1.2 Package boundaries

Biome `noRestrictedImports` overrides enforce these rules.

| Importer | May import Strudel packages | Notes |
|---|---|---|
| `packages/strudel` | all granular `@strudel/*` (and transitive `superdough`), `worker-timers` | The only module that knows `defaultOutput` vs `onSchedule` (1.2.6 vs main). |
| `packages/grader` | `@strudel/core`, `mini`, `tonal`, `transpiler` only | Never webaudio, codemirror, draw or superdough. |
| everything else | none | Goes through `@oak/strudel` or `@oak/grader`. |
| isomorphic packages | no DOM and no `Bun` | Enforced because they typecheck under both `tsconfig.app` and `tsconfig.server`. |

### 1.3 TypeScript strategy (TS 7.0.2 native `tsc`, typecheck only)

* `tsconfig.base.json`:
  * `target es2022`, `module esnext`, `moduleResolution bundler`
  * `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
  * `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`, `isolatedModules`
  * `jsx react-jsx`, `skipLibCheck`, `types: []`
  * `paths: { "@content/*": ["content/*"], "@app/*": ["app/src/*"] }`
* Workspace packages expose `"exports": {".": "./src/index.ts"}`. There is no build step: Vite bundles them, and Bun runs the TS directly.
* There are three projects. `typecheck` = `tsc -p tsconfig.app.json && tsc -p tsconfig.server.json && tsc -p tsconfig.worklet.json`. Isomorphic packages appear in both the app and server projects, which proves they are environment-neutral.
* `types/strudel.d.ts` hand-declares only the Strudel surface we use: `StrudelMirror`, `repl`, `Pattern`, `Hap`, `State`, `TimeSpan`, `Fraction`, `evalScope`, `evaluate`, `transpiler`, the webaudio and soundfont registries, and `getSuperdoughAudioController`. Only the two Strudel-facing packages see it.

### 1.4 Scripts (root `package.json`)

```jsonc
{
  "scripts": {
    "dev": "concurrently -k -n srv,web,cnt -c blue,green,magenta \"bun --watch server/src/main.ts\" \"vite --config app/vite.config.ts\" \"bun scripts/content/build.ts --watch\"",
    "build": "bun scripts/content/build.ts && bun scripts/sounds/check.ts && vite build --config app/vite.config.ts",
    "start": "bun server/src/main.ts --serve-dist",           // http://127.0.0.1:8787 (daily use)
    "oak": "bun run build && bun run start",
    "typecheck": "tsc -p tsconfig.app.json && tsc -p tsconfig.server.json && tsc -p tsconfig.worklet.json",
    "lint": "biome ci .",
    "format": "biome format --write .",
    "test": "bun test",
    "test:content": "bun test content/validate",
    "test:browser": "vitest run --config vitest.browser.config.ts",
    "e2e": "playwright test",
    "check": "bun run typecheck && bun run lint && bun test",
    "check:full": "bun run check && bun run test:browser && bun run build && bun run e2e",
    "content:build": "bun scripts/content/build.ts",
    "content:new": "bun scripts/content/new.ts",           // content:new u03 scale-degrees
    "content:check": "bun scripts/content/check.ts",       // content:check u03.04 (pretty, focused)
    "sounds:mirror": "bun scripts/sounds/mirror.ts",
    "sounds:check": "bun scripts/sounds/check.ts",
    "tutor:tokens": "bun scripts/tutor/count-tokens.ts",
    "tutor:smoke": "bun scripts/tutor/smoke.ts",           // live API; asserts cache_read>0 on 2nd call
    "db:backup": "bun scripts/db/backup.ts",
    "postinstall": "bun scripts/check-deps.ts"
  },
  "patchedDependencies": { "@kabelsalat/web@0.4.1": "patches/@kabelsalat%2Fweb@0.4.1.patch" }
}
```

* `vite` keeps its node shebang under `bun run`, so it runs on Node 26.13 without `--bun`.
* The server runs on Bun.
* `check-deps.ts` fails if more than one resolved copy exists of `@strudel/core`, `superdough`, `@codemirror/state`, `@codemirror/view`, `@codemirror/language` or `acorn`.

### 1.5 Key configs

```ts
// app/vite.config.ts
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react'; // M0: verify export; fallback babel({plugins:[['babel-plugin-react-compiler',{}]]})
import babel from '@rolldown/plugin-babel';
import mdx from '@mdx-js/rollup';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [
    { enforce: 'pre', ...mdx({ providerImportSource: '@mdx-js/react' }) },
    tanstackRouter({ target: 'react', autoCodeSplitting: true, routesDirectory: 'src/routes' }),
    react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: { alias: { '@content': `${root}content`, '@app': `${root}app/src` } },
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true, fs: { allow: [root] },
    proxy: { '/api': 'http://127.0.0.1:8787', '/sounds': 'http://127.0.0.1:8787' },
  },
  worker: { format: 'es' },
  build: { target: 'es2022', outDir: `${root}dist`, emptyOutDir: true, sourcemap: true },
});
```

* **Tailwind dark mode:** use `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` so Strudel toggling `.dark` on `<html>` has no effect. Oak's own CSS variables are namespaced `--oak-*`, which avoids collisions with Strudel's `:root` variables.
* **`bunfig.toml`:**
  ```toml
  [install]
  exact = true

  [test]
  preload = ["./tests/setup/bun-preload.ts"]
  timeout = 20000
  ```
  The preload sets `OAK_DATA_DIR` to a temp dir and `TZ=UTC`.

### 1.6 The kabelsalat patch (required for `bun test` and the Bun grader)

```bash
bun add @strudel/core@1.2.6 …          # exact pins, §1.7
bun patch @kabelsalat/web
# edit node_modules/@kabelsalat/web/package.json:  "main": "dist/index.js"  →  "main": "dist/index.mjs"
bun patch --commit @kabelsalat/web     # writes patches/…, adds patchedDependencies
```

`tests/smoke/strudel-import.test.ts` asserts that `await import('@strudel/core')` succeeds under `bun test` and that `evaluate('note("c4")')` returns one hap. Browser bundlers already pick the `module` field, so they are unaffected.

### 1.7 Pinned dependencies (exact; `bun install` with `exact=true`)

**Runtime (app, server, packages)**

| Package | Version | Package | Version |
|---|---|---|---|
| @strudel/core | 1.2.6 | react / react-dom | 19.3.1 |
| @strudel/mini | 1.2.6 | @tanstack/react-router | 1.170.46 |
| @strudel/tonal | 1.2.6 | @tanstack/react-query | 5.107.1 |
| @strudel/transpiler | 1.2.6 | zustand | 5.1.0 |
| @strudel/draw | 1.2.6 | xstate / @xstate/react | 5.33.4 / 6.1.0 |
| @strudel/codemirror | 1.3.0 | @mdx-js/react | 3.1.1 |
| @strudel/webaudio | 1.3.0 | tonal | 6.5.1 |
| @strudel/soundfonts | 1.3.0 | abcjs | 6.7.2 |
| superdough (direct, deduped) | 1.3.0 | pitchy | 4.1.0 |
| supradough (transitive) | 1.2.4 | signalsmith-stretch | 1.3.2 |
| @kabelsalat/web (patched) | 0.4.1 | wavesurfer.js | 8.0.5 |
| @codemirror/state | 6.7.6 | ts-fsrs (server) | 6.0.0 |
| @codemirror/view | 6.43.15 | acorn (grader lint; dedupe with transpiler's) | 8.19.0 |
| @codemirror/autocomplete | 6.20.4 | zod | 4.6.7 |
| @codemirror/lint | 6.9.7 | hono / @hono/zod-validator | 4.13.17 / 0.9.1 |
| worker-timers | 8.0.34 | @anthropic-ai/sdk | ^1.8.0 (lock 1.8.0) |

**Dev**

| Package | Version | Package | Version |
|---|---|---|---|
| vite | 8.3.7 | typescript | 7.0.2 |
| @vitejs/plugin-react | 6.3.0 | @types/bun | 1.4.4 |
| @rolldown/plugin-babel | 0.3.1 | @types/react / react-dom | 19.3.0 |
| @babel/core ⚠A2 | 7.29.13 | @biomejs/biome | 2.6.6 |
| babel-plugin-react-compiler | 1.0.0 | vitest / @vitest/browser-playwright | 5.1.0 |
| @tanstack/router-plugin | 1.169.0 | @playwright/test | 1.65.0 |
| tailwindcss / @tailwindcss/vite | 4.3.5 | fast-check | 4.10.2 |
| @mdx-js/rollup / @mdx-js/mdx / remark-mdx | 3.1.1 | @happy-dom/global-registrator | 21.0.4 |
| unified / remark-parse / mdast-util-to-string | 11.0.5 / 11.0.0 / 4.0.0 | concurrently | 10.0.7 |

Packages we deliberately leave out:

* `@strudel/repl` and `@strudel/web`: self-contained bundles that duplicate core.
* Dexie: SQLite is the single source of truth.
* VexFlow and Verovio: only if the staff-input widget outgrows v1.
* Essentia and basic-pitch: not in v1.

---

## 2. Module design

### 2.1 `@oak/strudel`: the OakStrudel adapter (browser only, single instance)

```ts
export interface OakStrudel {
  readonly ctx: AudioContext;                       // Oak-created, shared with mic + stretch
  readonly ready: Promise<void>;                    // prebake + sound registration (no gesture needed)
  unlock(): Promise<void>;                          // from a user gesture: ctx.resume() + initAudio once (§6.1)
  readonly audio: Readable<{ state: 'locked'|'running'|'suspended'|'interrupted' }>;
  createEditor(root: HTMLElement, opts: EditorOptions): EditorHandle;
  readonly transport: Transport;
  preload(spec: PreloadSpec, onProgress?: (done: number, total: number) => void): Promise<PreloadReport>;
  playEvents(plan: AudioPlan, opts?: { at?: number }): PlaybackHandle; // direct superdough(), for drills
  stopAll(): void;                                  // stops every mirror + cancels drill plans
  readonly master: MasterBus;                       // limiter, meter analyser, record tap
  readonly recorder: Recorder;
  lint(code: string): OakDiagnostic[];              // dialect + safety lint (@oak/grader/lint)
  onLog(cb: (l: StrudelLog) => void): () => void;   // parsed 'strudel.log' events
}
export interface EditorOptions {
  id: string;                         // `oak_${slug}_${n}_`. MUST end with '_' (cleanupDraw prefix bug)
  initialCode: string;
  readOnly?: true | ReadonlyArray<[from: number, to: number]>;
  lessonCtx: { key: KeyCtx | null; meter: Meter; defaultBpm: number; loopBars: number };
  unlocked: ReadonlySet<FunctionId>;  forbidden?: ReadonlySet<FunctionId>;
  drawWindow?: [number, number];      // default [-2, 2] cycles
  onChange?(code: string): void;
  onEvaluated?(o: EvalOutcome): void; // {ok, code, cps, error?: OakDiagnostic, miniLocations}
  onToggle?(playing: boolean): void;
  onPaint?(f: PaintFrame): void;      // {haps: LiveHap[], cycle, audibleCycle} every rAF while playing
}
export interface EditorHandle {
  readonly id: string; readonly view: EditorView; readonly playing: boolean;
  getCode(): string; setCode(code: string, opts?: { undoable?: boolean }): void;
  evaluate(opts?: { autostart?: boolean }): Promise<EvalOutcome>; // serialized via EvalMutex
  play(): Promise<void>; stop(): void; toggle(): Promise<void>;
  setDiagnostics(d: OakDiagnostic[]): void; focusRanges(r: CodeRange[]): void;
  setUnlocked(fns: ReadonlySet<FunctionId>): void;
  dispose(): void;
}
export interface Transport {
  readonly activeEditorId: string | null;
  cycle(): number;          // active mirror .repl.scheduler.now()
  audibleCycle(): number;   // cycle() - (0.05 + ctx.outputLatency + ctx.baseLatency + userVisualOffset) * cps
  cps(): number; setCps(cps: number): void;
  subscribe(cb: (s: TransportState) => void): () => void;
}
```

**Editor construction.** This is the only place `StrudelMirror` is constructed.

```ts
const mirror = new StrudelMirror({
  root, id: opts.id, initialCode: opts.initialCode,
  defaultOutput: webaudioOutput,                  // 1.2.6 API; main renames to onSchedule (one-file migration)
  getTime: () => ctx.currentTime,
  transpiler, prebake: prebakeOnce,               // ONE shared module-level promise
  setInterval: WT.setInterval, clearInterval: WT.clearInterval,
  drawTime: opts.drawWindow ?? [-2, 2], drawContext: offscreen1x1, bgFill: false, solo: true, autodraw: false,
  editPattern: (pat) => pat.onPaint((_c, time, haps) => paint(time, haps)), // keeps drawTime ≠ [0,0]
  beforeEval: () => mirror.repl.setCps(bpmToCps(opts.lessonCtx.defaultBpm, opts.lessonCtx.meter)),
  beforeStart: () => audioReady,
  onEvalError: (e) => emitEval({ ok: false, error: toDiagnostic(e) }),
  afterEval: ({ code, meta }) => emitEval({ ok: true, code, cps: mirror.repl.scheduler.cps, miniLocations: meta.miniLocations }),
  onToggle: (started) => transport.onToggle(opts.id, started),
});
mirror.editor.dispatch({ effects: StateEffect.appendConfig.of(oakExtensions(opts)) });
```

**Internals.**

* **`EvalMutex`.** A promise chain, so every `evaluate()` in the main realm is serialized. The grader runs in its own Worker realm and doesn't need it.
* **Pre-eval lint.** `lint()` runs before each evaluate. Error diagnostics block evaluation.
* **`oakExtensions`:**
  * `autocompletion({ override: [unlockedFunctionsSource] })`. Strudel's own `isAutoCompletionEnabled` stays false.
  * `linter(oakLinter)`: acorn parse errors, `[mini] parse error at line N`, the "not unlocked yet (unlocks in the lesson “…”, named by its title)" rule, the forbidden-in-this-exercise rule, and dialect traps (`Cmaj7` → `C^7`).
  * A read-only `transactionFilter` over a `RangeSet` `StateField`.
  * `EditorView.updateListener` feeding the cursor into the HighlightBus.
* **Settings, before the first mirror is built:**
  ```ts
  codemirrorSettings.set({ ...defaultSettings, theme: 'strudelTheme', isAutoCompletionEnabled: false,
    isPatternHighlightingEnabled: true, isFlashEnabled: true, fontSize: 15, keybindings: 'codemirror' })
  ```
  A `MutationObserver` on `<html>` keeps `data-theme` authoritative.
* **`dispose()`:**
  ```ts
  repl.scheduler.stop(); drawer.stop(); clear(); editor.destroy(); root.replaceChildren(); cleanupDraw(true, id)
  ```
  It also removes our listeners.
* **React integration.** React 19 ref-callback cleanup:
  ```tsx
  ref={(el) => { const h = oak.createEditor(el, o); return () => h.dispose(); }}
  ```
  This is StrictMode-safe because dispose is complete.
* **Live mirror budget.** Mirrors are mounted lazily by an IntersectionObserver, with at most 6 live mirrors (LRU dispose). Offscreen editors render a static `<pre>`.
* **Visual-method stubs.** After evalScope, the prebake replaces `Pattern.prototype` `pianoroll|punchcard|spiral|pitchwheel|wordfall|scope|tscope|fscope|spectrum` and the `_*` inline variants with `function(){return this}`. Oak draws its own visuals, which also avoids widget bug #2128. The grader has the same stubs.
* **Logs.** `onLog` listens for `document` `'strudel.log'` and parses the `[query]`, `[getTrigger]`, `[cyclist]`, `[voicing]`, `[tonal]`, `[mini]` and `[webaudio] skip hap: still loading` prefixes. The last one triggers an auto-preload plus a toast.

### 2.2 Workbench (`app/src/workbench`)

* **`<Workbench mode="example|exercise|sketch|transcription" lessonCtx exercise? views={['code','roll','staff']}>`.** Layout: editor on the left, then a TransportBar (play/stop, BPM, loop bars, click), a stacked or tabbed PianoRoll and StaffView, a FeedbackPanel, and a "Ask tutor" affordance.
* **Analysis path (static and accurate).**
  1. `afterEval(activeCode)` sends `graderClient.analyze(code, loopBars)` to the Web Worker. Typing triggers a 300 ms debounced "preview" analysis with a "not playing" badge.
  2. The worker returns `OakEvent[]` plus cps.
  3. `@oak/notation` builds the Score, then `toAbc`, then StaffView renders.
  4. PianoRoll draws static events.
* **Live path.** `onPaint` delivers a `PaintFrame` (haps in [-2,2] cycles, plus `audibleCycle`). PianoRoll draws the live haps and the playhead. The staff highlight finds active notes by `audibleCycle mod loopBars` in an interval index over the NotationModel.
* **Clock.** One global rAF `Clock`, ticking only while something plays. Components subscribe through `useSyncExternalStore`.
* **`HighlightBus`.** `EventId` = stable hash of `(track, beginRat, endRat, midi, locationsKey)`.

  ```ts
  type HighlightSource = 'clock' | 'code' | 'roll' | 'staff';
  interface HighlightBus {
    setPlaying(ids: ReadonlySet<EventId>): void;                     // clock → roll + staff (.oak-playing)
    focus(sel: { events?: EventId[]; code?: CodeRange[] }, src: HighlightSource): void;
    subscribe(cb: (s: { playing: ReadonlySet<EventId>; focus: Focus }) => void): () => void;
  }
  ```
  * Clicking code finds the events whose `locations` contain the cursor offset, then highlights the roll rects and the `svg .oak-e{id}` notes.
  * Clicking a staff note uses the abcjs `clickListener`, reads the `oak-e{id}` class, finds the events, and calls `EditorHandle.focusRanges(locations)`.
  * Clicking a roll note goes through the same path.
  * During playback the editor uses Strudel's own `highlightMiniLocations`.
* **PianoRoll (own canvas).**
  * Rows auto-range from the events.
  * With a key: in-key rows are shaded, tonic rows are emphasised, and labels are **1-based scale degrees** (`1 2 ♭3 …`) with optional movable-do. Without a key, labels are letter names.
  * Unpitched tracks get drum lanes, and each track has its own colour.
* **StaffView.**
  * Lazy `import * as abcjs from 'abcjs'`, then:
    ```ts
    renderAbc(el, abc, { add_classes: true, responsive: 'resize', foregroundColor: 'currentColor',
      jazzchords: true, selectTypes: ['note'], clickListener })
    ```
  * TimingCallbacks is never used: highlighting is driven by Strudel's clock.

### 2.3 `@oak/grader`: the shared headless grader

**Runtime (one realm per worker):**

```ts
import * as core from '@strudel/core'; import * as mini from '@strudel/mini';
import * as tonal from '@strudel/tonal'; import { transpiler } from '@strudel/transpiler';
const { Pattern, silence, stack, evalScope, evaluate, State, TimeSpan, Fraction } = core;
const R = { tracks: new Map<string, any>(), anon: 0, cps: 0.5, all: [] as Fn[], each: [] as Fn[] };
Pattern.prototype.p = function (id: string) {            // copy of repl.mjs semantics (1.2.6)
  if (id.startsWith('_') || id.endsWith('_')) return silence;
  if (id.includes('$')) id = `${id}${R.anon++}`;
  R.tracks.set(id, this); return this;
};
stubVisualMethods(Pattern);                              // same list as the adapter
await evalScope(core, mini, tonal, {
  setcps: (v: number) => ((R.cps = v), silence), setCps: (v: number) => ((R.cps = v), silence),
  setcpm: (v: number) => ((R.cps = v / 60), silence), setCpm: (v: number) => ((R.cps = v / 60), silence),
  samples: async () => {}, sliderWithID: (_: string, v: number) => core.pure(v),
  all: (f: Fn) => (R.all.push(f), silence), each: (f: Fn) => (R.each.push(f), silence), hush: () => silence,
});
lockDown(globalThis);   // §5.10; no-op-ish in browser, strict in Bun
```

**Per request:**

1. Reset state: `R.tracks.clear(); R.anon = 0; R.cps = 0.5; R.all = []; R.each = []; tonal.resetVoicings?.(); core.useRNG?.('legacy')`.
2. Capture `console.*` into `logs`.
3. Run the safety and dialect lint (acorn AST). A lint error means no eval.
4. `const { pattern } = await evaluate(code, transpiler, { emitWidgets: false })`.
5. Labels: `tracks = R.tracks.size ? applySolo(R.tracks) : new Map([['main', pattern]])`. Solo keeps keys of length > 1 starting with `S`. Then apply each `each`, `stack`, then each `all`. A non-Pattern result raises `eval.not-a-pattern`.
6. Query each track with `pat.query(new State(new TimeSpan(Fraction(0), Fraction(bars)), { _cps: R.cps }))`. `query` throws where `queryArc` would swallow the error.
7. Keep `h.whole && h.hasOnset()`. Abort above the hap cap.
8. Normalize to `OakEvent`. Any `[mini|tonal|voicing|query|eval]` log becomes a diagnostic, and an **empty result means `eval.silence`**, never "wrong answer".

**Event normalization:**

```ts
type Rat = readonly [n: number, d: number];
interface OakEvent {
  id: EventId; track: string; begin: Rat; end: Rat; beginF: number; durF: number;
  bar: number; beatInBar: Rat;                         // 1 cycle = 1 bar
  midi: number | null; pitchSource: 'note' | 'freq' | 'scale' | 'voicing' | null;
  s: string | null; bank: string | null; n: number | null; velocity: number | null; gain: number | null;
  chord: string | null; scale: string | null;          // hap.context.scale
  locations: { start: number; end: number }[];         // offsets into the ORIGINAL code
}
```

Pitch rules, in priority order:

1. A numeric value is MIDI.
2. A string value goes through `noteToMidi` (accepts `s`/`f` accidentals; default octave 3).
3. For an object value: `freq` gives `Math.round(freqToMidi)`; a string `note` gives `noteToMidi`; a numeric `note` is used as is. Add `12*octave` if `octave` is set.
4. `n` without `note` and without a `scale` tag gives **`midi:null`**, flagged `pitch.n-without-scale` when the exercise expects pitch.

Never use `getPlayableNoteValue`. Spellings in `value.note` are ignored downstream: everything is re-spelled from MIDI plus context.

**Worker protocol** (same in browser and Bun):

```ts
type GraderRequest =
  | { id: string; kind: 'analyze'; code: string; bars: number }
  | { id: string; kind: 'grade';   code: string; spec: GradeSpec; reference?: string; bars: number }
  | { id: string; kind: 'compare'; learner: string; target: string; bars: number; mode: CompareMode }
  | { id: string; kind: 'ping' };
type GraderResponse =
  | { id: string; ok: true;  result: AnalyzeResult | GradeResult | CompareResult; logs: LogLine[]; ms: number }
  | { id: string; ok: false; error: { kind: 'timeout'|'too-many-events'|'lint'|'eval'|'internal'; message: string;
      diagnostics: OakDiagnostic[] }; logs: LogLine[]; ms: number };
interface AnalyzeResult { cps: number; bpm: number | null; tracks: string[]; events: OakEvent[];
  periodBars: number | null; diagnostics: OakDiagnostic[] }
```

**`GraderHost`** (`browser`: Web Worker created with `new Worker(new URL('./grader.worker.ts', import.meta.url), {type:'module'})`; `bun`: §5.10):

* One in-flight request per worker, FIFO queue.
* Timeouts: 1500 ms in the browser, 2000 ms on the server. On timeout: `terminate()`, respawn, and return `{ok:false, kind:'timeout'}` ("took too long: infinite loop or huge pattern?").
* Limits: `bars` clamped to 1–64 (tutor: 1–16); hap cap 20 000 (tutor: 5 000).

**Checks DSL.** It is serializable, has no closures, and is evaluated inside the worker.

```ts
type CompareMode = 'exact'|'pitch-class'|'degrees'|'onsets'|'transposition-invariant'|'chord-pcsets'|'bass-line';
type Check =
  | { type: 'hapsMatch'; track?: string | '*'; target: 'solution' | { code: string }; compare: CompareMode;
      bars: number; tolerance?: { onsetBeats?: number }; partialCredit?: boolean }
  | { type: 'tempo'; bpm: number; meter: MeterId; toleranceBpm?: number }
  | { type: 'requireFunctions' | 'forbidFunctions'; fns: FunctionId[] }
  | { type: 'trackCount'; min?: number; max?: number }
  | { type: 'pitchSet'; track?: string; allowed: 'key' | string[] }
  | { type: 'rule'; rule: RuleId; args?: Record<string, Json>; gating: boolean; weight?: number };
interface GradeSpec { key: KeyCtx | null; meter: MeterId; checks: Check[]; passScore: number /*default 1.0 gating*/ }
interface GradeResult { pass: boolean; score: number; checks: CheckResult[]; feedback: Feedback[] }
interface Feedback { code: FeedbackCode; severity: 'error'|'warn'|'info'; bar?: number; beat?: string;
  locations?: CodeRange[]; params?: Record<string, Json> }
```

**Comparators.**

* Melodies: transposition-invariant edit distance on (degree, onset) pairs.
* Rhythm: onset F-measure on exact `Rat`.
* Chords: pitch-class set per shared `whole`.
* `bass-line`: lowest pitch per chord onset.

Specialised diagnosers emit pedagogical codes:

| Code | Trigger |
|---|---|
| `pitch.degree-off-by-one` | ≥80% of notes exactly +1 scale step: the "n is degree−1" trap |
| `pitch.wrong-octave` | correct pitch classes, wrong octave |
| `rhythm.shifted` | constant onset offset |
| `harmony.wrong-quality` | wrong chord quality |
| `harmony.wrong-inversion` | wrong inversion |
| `tempo.missing-setcpm` | no `setcpm` call |

**Rule registry (`RuleId`):** `endsOnTonic`, `cadenceAtPhraseEnds`, `chordTonesOnStrongBeats{min}`, `rangeWithin{lo,hi}`, `stepwiseRatio{min}`, `barCount{n}`, `usesDevice{device:'secondary-dominant'|'borrowed-bVI'|…}`, `twelveBarForm`, `swingApplied`, `maxVoiceLeap{semitones}`, `bassLocksToKick{min}`.

**`FeedbackCode` set** (each has authored learner copy):

* `eval.*`: syntax, mini-parse, not-a-pattern, silence, timeout, too-many-events
* `lint.*`: forbidden-api, locked-function, chord-symbol, deprecated-voicings, remote-samples
* `pitch.*`: n-without-scale, degree-off-by-one, wrong-octave, wrong-notes, out-of-key
* `rhythm.*`: missing-onsets, extra-onsets, shifted, wrong-subdivision
* `tempo.*`: missing-setcpm, wrong-bpm
* `harmony.*`: wrong-root, wrong-quality, wrong-inversion, wrong-bass
* `form.wrong-length`, `struct.missing-track`, `struct.function-required`, `rule.<RuleId>`

### 2.4 `@oak/theory` (tonal@6.5.1 behind normalization; raw tonal strings never leak)

```ts
type Pc = 0|1|2|3|4|5|6|7|8|9|10|11;
interface Degree { num: 1|2|3|4|5|6|7; alt: -2|-1|0|1|2 }       // "b3", "#4"
type ModeName = 'major'|'minor'|'dorian'|'phrygian'|'lydian'|'mixolydian'|'locrian'|'harmonic minor'|'melodic minor';
interface KeyCtx { tonic: string /* 'Eb' */; mode: ModeName }
interface Meter { id: MeterId /* '4/4'|'3/4'|'6/8'|'12/8'|'5/4'|'7/8' */; beats: number; unit: number;
  groups: number[]; type: 'simple'|'compound'|'irregular' }
export function parseStrudelNote(s: string): { midi: number; letter: string; acc: number; oct: number } | null; // s/f, default oct 3
export function spellMidi(midi: number, ctx: { key: KeyCtx | null; chord?: ChordInfo; direction?: 1 | -1 }): SpelledPitch;
export function degreeOf(midi: number, key: KeyCtx): Degree;           // movable-do label via solfege(deg, 'do-minor')
export function strudelIndexOf(d: Degree): number;                      // d.num - 1  (taught explicitly)
export function normalizeChordSymbol(input: string): ChordInfo | null;  // ∆/Δ→^, ø→h, °→o, −→-, ♭→b, ♯→#, maj7→^7, dim→o, m7b5→h7
interface ChordInfo { tonicPc: Pc; chroma: string; bassPc: Pc; strudel: string /* 'C^7' */; leadSheet: string /* 'Cmaj7' */;
  display: string /* 'C∆7' */; quality: ChordQuality }
export function sameChord(a: ChordInfo, b: ChordInfo, opts?: { bass?: boolean }): boolean; // tonic+chroma(+bass); never string compare
export function romanOf(chord: ChordInfo, key: KeyCtx): RomanInfo;      // case computed from quality, not tonal
export function chordFromRoman(rn: string, key: KeyCtx): ChordInfo;     // quality from case + suffix (never trust tonal case)
export const SCHEMAS: readonly SchemaDef[];                             // four-chord I–V–vi–IV, axis vi–IV–I–V, doo-wop I–vi–IV–V,
                                                                        // aeolian i–VI–III–VII, mixolydian I–bVII–IV, andalusian,
                                                                        // blues12 (+quick-change), ii–V–I (maj/min)
export function detectSchema(rns: RomanInfo[]): SchemaMatch | null;
export function bpmToCpm(bpm: number, meter: Meter): number;            // bpm / beatsPerBar  (setcpm(bpm/4) in 4/4)
export function keySignature(key: KeyCtx): { accidentals: number; abcK: string /* 'Eb', 'Ddor', 'Am' */ };
```

The `theory_query` CLI and tutor tool are thin wrappers over these functions (§5.3).

### 2.5 `@oak/notation`: the NotationModel pipeline

```ts
interface NotationInput { events: OakEvent[]; meter: Meter; key: KeyCtx | null; bars: number; startBar?: number;
  staff: 'auto'|'treble'|'bass'|'grand'|'percussion'|'rhythm'; split?: 'register'|'track'; splitMidi?: number /*60*/;
  chordTrack?: { bar: number; beat: Rat; symbol: string }[]; tempoBpm?: number }
interface Score { meter: Meter; key: KeyCtx | null; tempoBpm?: number; staves: Staff[]; approximate: boolean; warnings: NotationWarning[] }
interface Staff { id: 'S1'|'RH'|'LH'|'DR'; clef: 'treble'|'bass'|'perc'; lines?: 1|5; voices: Voice[] }
interface Voice { id: string; bars: { index: number; items: NoteItem[] }[] }
interface NoteItem { kind: 'note'|'chord'|'rest'; id: string; onset: Rat; dur: Rat;
  written: { base: 1|2|4|8|16|32; dots: 0|1|2 }; pitches: SpelledPitch[]; tieToNext: boolean;
  tuplet?: { p: number; q: number; r: number; group: string; idx: number }; beamGroup: number; sourceEventIds: EventId[] }
export function buildScore(i: NotationInput): Score;
export function toAbc(s: Score): { abc: string; idMap: Map<string, { eventIds: EventId[]; locations: CodeRange[] }> };
```

**Pipeline.**

1. **Extract.** Use exact rationals from `whole`. Ignore clip and legato.
2. **Key context.** The lesson-declared key wins; otherwise `hap.context.scale`; otherwise `Scale.detect(pcs, {match:'fit'})`; otherwise no key, with accidentals chosen by melodic direction.
3. **Voices and staves.** Grand staff splits by register at `splitMidi` (60) or by track. Percussion gets a perc clef with an `s`→position map (bd F4, sd C5, hh/oh G5 with `!style=x!`). `rhythm` gives a 1-line staff.
4. **Bars.** `bar = floor(begin)`. Split at integer cycles into tie chains.
5. **Beats.** Group by `meter.groups`: simple meters by beat or half-bar, compound meters by dotted quarter.
6. **Tuplets.** Per group, take the LCD of the denominators. An odd factor k > 1 becomes `(p:q:r` with p = k and q = the nearest lower power of two. Nested tuplets combine into one ratio if p ≤ 9. Otherwise snap to a 1/12 or 1/16 grid and set `approximate`.
7. **Durations.** Use dotted and double-dotted values, never straddling the half-bar in 4/4, and tie the pieces. Gaps become rests. Notes with identical onset and duration become chords; differing durations go to extra `V:` voices.
8. **Spelling.** Chord-tone spelling wins over key-scale spelling, which wins over directional sharp/flat. Then `Note.enharmonic` fixes octaves and `Note.simplify` removes double accidentals unless the key requires them.
9. **ABC emission.**
   * Header: `X:1 M: L:1/16 Q:1/4=bpm K:<tonic><mode>`, with `%%score {RH LH}` for grand staff.
   * Each note is emitted as `!class=oak-e{id}!` + an accidental computed against the key signature and earlier accidentals in the same bar and octave (including `=`) + the pitch token + length + `-` for ties.
   * Spaces mark beam-group boundaries.
   * Chord symbols are translated for display: `^7→maj7`, `h7→ø7` (written `07`), `-→m`, `o→°`.

Unrenderable input (`.fast(1.1)`, `nudge`, polymeters crossing bars, p > 9) is notated as `approximate`. Content may notate such examples only when they declare `allowApproximate`.

### 2.6 `@oak/pitch` and the worklet in `@oak/audio`

**Worklet** (`packages/audio/src/worklets/pitch.worklet.ts`, loaded via `?worker&url`):

* A 2048-sample ring buffer analysed every 512 samples with `PitchDetector.forFloat32Array(2048)` and `minVolumeDecibels = -45`.
* It posts `{t: currentTime, hz, clarity, rms}`.
* Construct it as `new AudioWorkletNode(ctx,'oak-pitch',{numberOfInputs:1, numberOfOutputs:0})`. In M0, verify that it processes unconnected; the fallback is to connect it to a `GainNode(0)` that feeds the destination.

```ts
interface PitchFrame { t: number; hz: number; clarity: number; rms: number }
export class PitchTracker {                 // pure, main thread
  constructor(o?: { clarityMin?: 0.9; rmsMinDb?: -45; median?: 5; a4?: 440 });
  push(f: PitchFrame): { t: number; midi: number | null; voiced: boolean };   // median-of-5, octave-continuity prior
  segments(): NoteSegment[];                // new note when median deviates >70¢ for ≥3 frames; min note 120 ms
  reset(): void;
}
export function gradeSungNote(segs: NoteSegment[], target: { midi: number; start: number; dur: number },
  o: { toleranceCents: number; foldOctaves: boolean; latencySec: number }):
  { pass: boolean; centsError: number; octaveOffset: number; heldRatio: number; onsetErrorMs: number };
```

* **Pass rule.** Take the longest stable segment in the window [start − 150 ms, end + 300 ms]. It passes if |median cents| ≤ tolerance and it is held for ≥ 60% of the target duration (minimum 300 ms).
* **Tolerance.** ±50¢ at first, tightening to ±35¢ and then ±25¢ as `sing.*` mastery rises. Stored as `learner_profile.sing_tolerance_cents`.
* **Octaves.** Folded by default. Exact-octave tasks come only after register lessons.

### 2.7 `@oak/drills`: drill engine and generators

```ts
interface DrillFamily<P> {
  id: FamilyId; generator: GeneratorId; answerModes: AnswerMode[];          // 'buttons'|'sing'|'tap'|'code'|'staff'
  levels: DifficultyLevel<P>[];                                            // ordered param sets
  generate(rng: Rng, p: P, lc: LearnerAudioCtx): Trial;                    // lc: vocal range, unlocked sounds, key history
}
interface Trial { id: string; seed: number; familyId: FamilyId; prompt: AudioPlan; preload: PreloadSpec;
  question: QuestionSpec; answer: AnswerKey; followUp?: AudioPlan /* resolution to tonic */; singBack?: SingTarget[] }
interface AudioPlan { events: { at: number; dur: number; value: SuperdoughValue /* INTERNAL names: cutoff, roomsize … */ }[]; durationSec: number }
export function gradeTrial(t: Trial, r: TrialResponse): TrialGrade;        // pure, used client + server
export class Staircase { constructor(target = 0.85); update(correct: boolean): number /* level */ }
// Weighted up/down: +δ on correct, −δ·(0.85/0.15) on error, so it converges to ~85% success.
```

| Generator | Typical families | Notes |
|---|---|---|
| `degree-id` (FET) | `ear.degree.{major,minor}.{1..7,b3,b6,b7,#4,…}` | I–IV–V–I cadence in a random key, register, voicing and timbre, then the target. Answer, then the tonic resolution plays, then sing-back (mic optional). |
| `interval-in-key` | `ear.interval.inkey.{m2…P8}`, `ear.interval.iso.*` (minor deck) | Degree pairs in a key first; isolated intervals later. |
| `chord-quality` | `ear.quality.{M,m,dim,aug,maj7,7,m7,m7b5,dim7}` | Random inversion and voicing appear only at higher levels. |
| `schema-id` | `ear.schema.{four-chord,axis,doo-wop,aeolian,mixo,blues12,ii-V-I}` | Strudel loops rendered as AudioPlans. |
| `bass-dictation` | `ear.bass.loop.{diatonic,minor}` | Bass-first chord dictation; answer by degree buttons or by singing. |
| `rhythm-dictation` | `ear.rhythm.{quarters,eighths,sixteenths,synco,triplets,swing}` | Tap (keyboard) or mini-notation code. |
| `melodic-dictation` | `ear.melody.{stepwise,leaps,nct}` | 3–5 notes, then 1–2 bars; limited replays as a difficulty parameter; staff or code answer. |
| `sing-degree` / `sing-echo` | `sing.degree.*`, `sing.echo.*` | Transposed into the learner's vocal range. |
| `fact` | `fact.keysig.*`, `fact.spell.*`, `fact.rn.*`, `fact.interval.*` | Answers verified by `@oak/theory`. |

### 2.8 `@oak/srs`: wrapper over ts-fsrs 6

```ts
import { DefaultScheduler, Rating } from 'ts-fsrs';
export async function createSchedulers() {
  return {
    fact: await DefaultScheduler({ version: 'FSRS-7', desiredRetention: 0.9, enableFuzz: true, enableShortTerm: true,
      learningSteps: ['1m', '10m'], relearningSteps: ['10m'], maximumInterval: 365 }),
    family: await DefaultScheduler({ version: 'FSRS-7', desiredRetention: 0.85, enableFuzz: true, enableShortTerm: false,
      learningSteps: [], relearningSteps: [], maximumInterval: 180 }),
  };
}
type ReviewOutcome = { kind: 'fact'; grade: 1|2|3|4 } | { kind: 'family'; correct: number; total: number; medianRtMs: number };
export function familyGrade(o, fastRtMs): Rating { // <70% Again · 70–89 Hard · ≥90 Good · ≥90 && rt<fastRtMs Easy }
export interface SrsService {
  ensureCards(specs: CardSpec[], introducedBy: LessonId, now: Date): void;
  due(now: Date, budgetSec: number): DueBatch[];      // grouped by generator → ONE interleaved mixed set per group
  review(cardId: CardId, o: ReviewOutcome, now: Date): { due: Date };
  retrievability(cardId: CardId, now: Date): number;  // scheduler.model.forgettingCurve
  forecast(days: number): number[];                   // seconds/day, keeps load ≤ budget
}
```

* **Mixed sets.** A batch interleaves the due families of one generator (for example degree 6, degree 2 and degree 7: 3 trials each, shuffled). Each card is graded only on its own trials.
* **Ordering.** The first item of a session is the highest-retrievability due item, so the session opens with an easy win.
* **Storage.** Store `fsrs_json` (the card object) plus `model:'FSRS-7'` for future migration.
* **Intake caps.** At most 3 new families per day, and backlog spreading above the warm-up budget.

### 2.9 Mastery service (server)

```ts
interface MasteryService {
  record(e: { skillId: SkillId; source: 'exercise'|'drill'|'checkpoint'|'srs'; sourceId: string; score: number; weight: number; at: Date }): void;
  mastery(skillId: SkillId): { score: number; evidence: number; days: number; state: SkillState };
  unitGate(unitId: UnitId): { passed: boolean; reasons: GateReason[]; remediation: PracticeSuggestion[] };
  skillMap(now: Date): SkillMapNode[];  // brightness = mastery × retrievability (min R of linked cards)
}
```

* Mastery is an EWMA with a half-life of 10 evidence items. "Mastered" means EWMA ≥ 0.85, at least 6 evidence items, and at least 2 distinct days.
* Evidence weight is lower for `assisted` passes (solution revealed) and for self-reported predictions.
* **Unit gate:** checkpoint score ≥ `unit.gate.checkpointMin` (0.85–0.9), and every gate family ≥ 0.85 across ≥ 2 days within the last 14.
* A failed gate blocks only the next unit's concept lessons and produces a remediation plan. Sketchbook, toolbox playground, drills and transcription gym are **never gated**.

### 2.10 Unlock and toolbox service

```ts
interface UnlockService {
  onLessonComplete(id: LessonId): UnlockEvent[]; onGatePassed(id: UnitId): UnlockEvent[];
  isUnlocked(id: UnlockId): boolean; list(kind?: 'function'|'sound'|'feature'|'track'): Unlock[];
  nextPreview(): { item: UnlockId; lessonsRemaining: number; progress: number }; // goal-gradient bar
}
```

* **Sources.** Unlocks are declared in `lesson.ts` (`unlocks`) and `unit.ts` (`unlocksOnGate`).
* **Effects:**
  * CM6 autocompletion shows only unlocked functions.
  * A locked function in an exercise is a lint error, and a grader failure if the exercise forbids it.
  * In the sketchbook it is a warning only: it still plays.
  * The Toolbox page shows locked items with "unlocks at …".
* **Pedagogical invariant (tested).** `chord().voicing()` unlocks only at the U06 gate, after hand-voiced inversions in U05.

### 2.11 Content loader

```ts
interface ContentIndex { version: string; tracks: TrackMeta[]; units: UnitMeta[]; lessons: LessonMeta[] }
interface ContentLoader {
  index(): ContentIndex;                         // .generated/index.json
  lessonDef(id: LessonId): LessonDef;            // lesson.ts (browser: import.meta.glob lazy; Bun: direct import)
  lessonMdx(id: LessonId): Promise<React.ComponentType>;  // browser only, import.meta.glob('/content/**/lesson.mdx')
  catalog(): FunctionCatalog; sounds(): SoundCatalog; graph(): SkillGraph; families(): FamilyDef[];
}
```

### 2.12 Lesson runtime, routes and state

* **Routes** (TanStack file routes):

  | Route | Screen |
  |---|---|
  | `/` | Today |
  | `/onboarding/*` | Onboarding |
  | `/learn/$lessonId` | Lesson |
  | `/drills/$familyId` | Drill |
  | `/map` | Skill map |
  | `/toolbox` | Toolbox |
  | `/sketchbook`, `/sketchbook/$id` | Sketchbook |
  | `/album`, `/album/$trackId` | Album |
  | `/studio/$transcriptionId` | Transcription Studio |
  | `/settings` | Settings |
  | `/dev/listen`, `/dev/notation` | Dev only |

* **State.** TanStack Query holds server state, zustand holds UI and tutor state, and xstate runs the flows.
* **`lesson.machine.ts`.** Per step: `intro → (predict) → run → investigate → modify{attempting ⇄ grading → feedback} → passed → next`.
  * After 3 failed attempts it offers "reveal worked solution" (marked `assisted`) or "come back later". Nobody is ever stuck.
  * The final `make` step must save a sketch before the lesson can complete.
* **`drill.machine.ts`.** `preload → cue → prompt → answer → grade → followUp → (singBack) → next | summary`.

### 2.13 Session plan, streaks, can-do

* **`GET /api/session/today`:**
  * `warmup`: due SRS batches, ≤5 min (8 if there is a backlog), first item easy.
  * `core`: resume the lesson step, capstone, checkpoint, or transcription gym (an optional swap after U06).
  * `make`: the lesson's Make step or a generated "remix today's concept" prompt.
  * `close`: can-do updates, the next-unlock bar, an optional tutor listening comment.
* **Streak.**
  * A day counts when ≥ 1 review set is completed. The day rolls over at 04:00 local.
  * Earn 1 freeze token per 7 qualifying days, with at most 2 banked. A missed day is covered automatically.
  * A **repair** is possible within 48 h by doing one extra review set.
  * No shaming copy.
* **Can-do ledger.** `content/cando.ts` statements are awarded by lessons, capstones, gates or drill thresholds, each with a link to the evidence (sketch or album track).

---

## 3. Content format and pipeline

### 3.1 IDs

| Thing | Format | Example |
|---|---|---|
| Unit | `u00`…`u18` (u18 = Core Finale); `jz01…`, `rh01…`, `ar01…` | `u03` |
| Lesson | `<unit>.<NN>`; checkpoint `<unit>.cp`; capstone `<unit>.cap-<code>[.sN]` | `u03.04`, `u07.cap-c2.s1` |
| Exercise | `<lesson>#<slug>` | `u03.04#arpeggio-1358` |
| Example | `<lesson>@<slug>` | `u03.04@degrees-in-code` |
| Concept | `c.<area>.<slug>` | `c.pitch.scale-degree` |
| Family / fact | `ear.*`, `sing.*` / `fact.*` | `ear.degree.major.6`, `fact.keysig.Eb-major` |
| Function | `fn.<name>` | `fn.scale` |
| Sound | `snd.<alias>` | `snd.rhodes` |
| Can-do | `cando.<area>.<slug>` | `cando.compose.four-chord-song` |
| Song | `song.<slug>` | `song.amazing-grace` |

Capstone placement:

* Core: C1 in u02, C2 in u07, C3 in u09, C4 in u10, C5 in u11, C6 in u14, C7 in u17, Finale in u18.
* Jazz: J1–J4 and F3.
* Rhythm: F1, F2.
* Arrangement: A1.

### 3.2 Per-lesson folder: `lesson.ts` (typed truth) + `lesson.mdx` (prose only)

**Rule:** every piece of code or music lives in `lesson.ts` and is referenced by id from MDX. MDX contains no Strudel code fences, so validation never has to parse prose for code.

```ts
// content/core/u03-major-scale/04-degrees-in-code/lesson.ts
import { defineLesson, ex, codeExercise, choice, hapsMatch, rule, requireFns } from '@oak/content-kit';
export default defineLesson({
  id: 'u03.04', slug: 'degrees-in-code', unit: 'u03', title: 'Scale degrees in code', kind: 'concept', minutes: 20,
  concepts: ['c.pitch.scale-degree', 'c.strudel.scale-index'], prerequisites: ['u03.03'],
  objectives: ['Write degrees 1–8 with n().scale()', 'Explain why n is degree − 1'],
  key: { tonic: 'C', mode: 'major' }, meter: '4/4', bpm: 90,
  unlocks: { functions: ['fn.scale'], sounds: [], features: [] },
  introduces: { families: ['ear.degree.major.1', 'ear.degree.major.3', 'ear.degree.major.5'], facts: [] },
  cando: ['cando.code.degrees-to-n'],
  examples: {
    'degrees-in-code': ex(`setcpm(90/4)\n$: n("0 2 4 2").scale("C:major").s("piano")`, { bars: 2, staff: 'treble' }),
  },
  exercises: {
    'arpeggio-1358': codeExercise({
      prompt: 'Play degrees 1–3–5–8 going up, one per beat.',
      starter: `setcpm(90/4)\n$: n("0 0 0 0").scale("C:major").s("piano")`,
      solution: `setcpm(90/4)\n$: n("0 2 4 7").scale("C:major").s("piano")`,
      grade: [hapsMatch({ compare: 'degrees', bars: 1 }), requireFns(['fn.scale'])],
      wrong: [
        { code: `setcpm(90/4)\n$: n("1 3 5 8").scale("C:major").s("piano")`, expect: 'pitch.degree-off-by-one' },
        { code: `setcpm(90/4)\n$: n("0 2 4 7").s("piano")`, expect: 'pitch.n-without-scale' },
      ],
      hints: ['n counts from 0: degree 1 is n 0.', 'Subtract one from each degree.'],
      readOnly: [[0, 13]],
    }),
    'which-n': choice({ prompt: 'Degree 6 in Strudel is…', options: ['n 6', 'n 5', 'n 7'], answer: 1,
      verify: { op: 'strudel_index', args: ['6'], expect: '5' } }),
  },
  steps: [
    { id: 'hear', phase: 'run' }, { id: 'predict', phase: 'predict', exercise: 'which-n' },
    { id: 'investigate', phase: 'investigate' }, { id: 'modify', phase: 'modify', exercise: 'arpeggio-1358' },
    { id: 'make', phase: 'make', exercise: 'make-motif' },
  ],
});
```

```mdx
{/* lesson.mdx: prose only */}
<Step id="hear">
Press play. You're hearing degrees **1 3 5 3**. <Example id="degrees-in-code" views="code,roll,staff" />
<Callout kind="trap">Strudel counts from **0**: `n` is the degree **minus one**.</Callout>
</Step>
<Step id="predict"><Predict exercise="which-n" hum /></Step>
<Step id="modify"><Editor exercise="arpeggio-1358" /></Step>
<Step id="make"><Make exercise="make-motif" /><Unlock fn="scale" /></Step>
```

### 3.3 MDX component set

The props for each component are validated by zod in the content tests.

| Component | Purpose |
|---|---|
| `<Step id>` | One page of the lesson runner (PRIMM phase comes from `lesson.ts`) |
| `<Example id views? autoplay?>` | Read-only playable Workbench |
| `<Editor exercise>` | Graded code exercise Workbench |
| `<Predict exercise hum?>` | Prediction; optional hum capture compares contour |
| `<Choice exercise>` | Multiple choice (answer verified by the theory engine) |
| `<EarDrill family level? trials?>` | Embedded drill mini-set |
| `<Sing exercise>` | Mic-graded singing |
| `<Tap exercise>` | Rhythm tapping (keyboard) |
| `<StaffInput exercise>` | Pointer staff input (§2.5) |
| `<Parsons exercise>` | Order blocks (chord blocks, bars) |
| `<Make exercise>` | Sketch prompt and save; rule checks as suggestions |
| `<Staff example>` / `<PianoRoll example>` / `<LeadSheet example>` | Single-view renders |
| `<Keyboard notes|degrees key?>` | Keyboard diagram |
| `<Degrees key show>` | Degree ladder with movable-do |
| `<Compare a b>` | A/B two examples |
| `<Term id>` | Glossary popover |
| `<CodeRef fn>` | Inline function chip linking to the toolbox |
| `<Callout kind="tip|trap|why">` | Aside |
| `<Unlock fn|sound>` / `<CanDo id>` / `<Recap>` | Reward and summary cards |

### 3.4 Other content sources

* **`catalog/functions/*.ts`.** One file per area, `defineFn({ id, name, kind: 'control'|'pattern-method'|'function'|'mini-op', signature, summary, explanation, examples: string[], unlockedBy: LessonId, category, strudelDoc, gotchas, onStrudelCc: 'same'|string })`. It feeds the Toolbox UI, autocomplete, lint, and the tutor prefix. `scripts/catalog/extract-strudel-docs.ts` parses the `doc.json` inlined in the `@strudel/codemirror` dist only to produce a coverage diff; that file is not shipped.
* **`catalog/sounds.ts`.** The pack contents and curated aliases (§6.2), with unlock lessons.
* **`concepts.ts`.** Concept nodes plus prerequisite edges, which form the skill graph.
* **`families.ts` / `facts.ts`.** `defineFamily({ id, generator, params, introducedBy, gateFor?, fastRtMs })`.
* **`repertoire/<id>/song.ts`.** `defineSong({ id, title, composer, published /* ≤1930 */ | trad: true, provenance, key, meter, bpm, form, melody, chords, bass /* Strudel code */ })`. Lyrics are allowed only for public-domain or trad songs.
* **Course order and principles.** `course.ts` sets tracks and unit order: core u00–u18 (~160 sessions), then advanced jz (~34), rh (~20), ar (~20). Every snippet must also run on strudel.cc, except Oak instrument aliases, whose catalog entry shows the strudel.cc equivalent (`gm_epiano1:4`).

### 3.5 Example unlock schedule (excerpt)

| Unit | Functions | Sounds |
|---|---|---|
| u00 | `s`, `note`, `$:` labels, `setcpm`, mini `" " ~ * [ ]` | `piano`, uzu kit, `sine`/`tri`/`saw` |
| u01 | `.bank`, mini `< > ! @`, `.gain`, `.fast`/`.slow` | `RolandTR909`, `RolandTR808` |
| u03 | `n` + `.scale`, `scaleTranspose` | — |
| u05 | note lists `"[c3,e3,g3]"`, `.transpose` | `organ` |
| u06 gate | `chord()` + `.voicing()` | `rhodes` |
| u07 | `.rev`, `.add`, `.ply`, `.off` | `horns` |
| u08 | `rootNotes` | `ebass` |
| u09 | `arrange`, `cat`, `.mask` | — |
| u11 | `swingBy`, `.struct` | `upright`, `jazzkit` |
| u13 | euclid `(3,8)` | — |

### 3.6 Build-time generation (`scripts/content/build.ts`, Bun; `--watch` in dev)

It imports every `lesson.ts`, `unit.ts` and catalog file and parses MDX with `unified`+`remark-parse`+`remark-mdx`, writing:

| Output (`content/.generated/`) | Consumer |
|---|---|
| `index.json` (tracks, units, lessons meta, `version = sha256(content)`) | app, server |
| `skill-graph.json` (nodes, edges, layered layout x/y) | skill map |
| `toolbox.json` (catalog + unlock lesson titles) | Toolbox, CM6 |
| `examples.json` (every example, starter, solution, wrong variant: `{ref, code, hash, bars, key, meter}`) | Listen QA, validation |
| `sounds-used.json` (per lesson: s, bank, gm variants, MIDI range) | preloader, `sounds:check` |
| `lesson-text/<id>.json` (plain text per step) | tutor `get_lesson_context` |
| `tutor/syllabus.<hash>.md`, `tutor/catalog.<hash>.md` | tutor cached prefix |

### 3.7 Content validation (`bun test content/validate`, Bun GraderHost)

1. **Schema.** Every `lesson.ts`, `unit.ts`, `song.ts`, family and fn passes zod. IDs are unique and folder names match IDs.
2. **Referential integrity.** All referenced ids exist: prerequisites, concepts, families, facts, fns, sounds, can-dos, and every MDX component prop (an MDX AST walk). Every `<Step id>` matches a `steps[]` entry and vice versa.
3. **Examples run.** Every example, starter and solution evaluates headlessly with no eval error, no `[mini|tonal|voicing|query|eval]` log, ≥ 1 onset in `bars`, fewer events than the cap, and `setcpm` present when the lesson declares a BPM.
4. **Exercises discriminate.** Each solution **passes**. Each `wrong[]` variant **fails with exactly its `expect` feedback code**. Each starter **fails** unless `starterPasses:true`.
5. **Notation.** Every notated example produces `toAbc` output with `approximate=false` (unless `allowApproximate`), and `abcjs.parseOnly(abc)` returns zero warnings.
6. **Unlock graph.** It is acyclic (topological sort), and each fn unlocks exactly once. The AST call-identifier scan shows every function used in lesson L unlocked at or before L, unless the example is marked `preview:true`. `forbidFunctions` are honoured by solutions. The voicing-after-u05 invariant holds.
7. **Sounds.** Every `s`, `bank` and `gm_*:n` used is present in `sounds/pack.lock.json`, and MIDI ranges sit within sample coverage.
8. **Theory.** `choice.verify` answers, song chord symbols, Roman numerals and declared keys are re-derived with `@oak/theory`. A declared key matches `.scale()` usage.
9. **Dialect lint.** No `Cmaj7`/`Cdim`/lowercase roots in `chord()`, no `.voicings()`, no remote `samples()`, no inline widgets (`._pianoroll`).
10. **Catalog.** Every catalog fn exists in the grader realm (`globalThis[name]` or `Pattern.prototype[name]`) and its examples run. Every fn called in content is in the catalog.
11. **Repertoire.** `published ≤ 1930` or `trad`, with provenance text and no lyrics otherwise.
12. **Snapshots.** Event snapshots (`h.show(true)` lines) for every example detect Strudel drift on upgrade.
13. **Listen QA.** Any example whose hash changed since its last "OK" in `.qa/listen-log.json` produces a **warning** locally and **fails** under `OAK_RELEASE=1`.

### 3.8 Listen QA page (`/dev/listen`)

* It plays every entry of `examples.json` in sequence: auto-advance after N bars, with filters by unit and by "changed since OK".
* Code, roll and staff are shown side by side.
* The verdict buttons are **OK / Wrong sound / Wrong notation / Musically weak / Wrong theory**, each with a note. They write through `POST /api/dev/qa` to `content/.qa/listen-log.json`, keyed by example hash.

---

## 4. Server

### 4.1 Bun.serve + Hono on 127.0.0.1:8787

Hono gives us middleware, `streamSSE` and `zValidator` with no codegen. The contract lives in `@oak/api` (⚠A4).

```ts
// server/src/main.ts
const app = buildApp(deps);
const server = Bun.serve({ hostname: '127.0.0.1', port: 8787, idleTimeout: 30, fetch: app.fetch }); // c.env === server
```

**`security.ts`** applies to every `/api/*` request:

1. `Host` must be in {`127.0.0.1:8787`, `localhost:8787`} or, in dev, {`127.0.0.1:5173`, `localhost:5173`}. This blocks DNS rebinding.
2. Non-GET requests need an `Origin` in the same allowlist.
3. Every request needs the header `X-Oak: 1`. A cross-site page can't send it without a preflight, and we never answer preflights.
4. No CORS headers, ever.

Responses never include the API key. `/api/health` reports only `keyConfigured:boolean`.

* **Data directory.** `OAK_DATA_DIR` (default `~/.oak`) holds `oak.db`, `audio/`, `album/`, `backups/` and `secrets/anthropic.key` (0600).
* **Key source.** `ANTHROPIC_API_KEY` from `.env.local` or the secrets file written from Settings. It is read once into the client, then `delete process.env.ANTHROPIC_API_KEY` runs before any Worker is spawned (⚠A3).

### 4.2 SQLite schema (`bun:sqlite`; migration `0001_init.sql`)

Pragmas: `journal_mode=WAL; foreign_keys=ON; busy_timeout=5000; synchronous=NORMAL`. All timestamps are ISO-8601 UTC TEXT. `day` columns hold the learner-local date after the 04:00 rollover.

```sql
CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE learner_profile (id INTEGER PRIMARY KEY CHECK (id=1), display_name TEXT, timezone TEXT NOT NULL,
  rollover_hour INTEGER NOT NULL DEFAULT 4, daily_minutes INTEGER NOT NULL DEFAULT 20,
  vocal_low_midi INTEGER, vocal_high_midi INTEGER, vocal_tonic_midi INTEGER, sing_tolerance_cents INTEGER NOT NULL DEFAULT 50,
  output_latency_ms REAL, input_latency_ms REAL, user_offset_ms REAL, visual_offset_ms REAL NOT NULL DEFAULT 0,
  headphones TEXT CHECK (headphones IN ('wired','bluetooth','speakers','unknown')) DEFAULT 'unknown',
  solfege TEXT NOT NULL DEFAULT 'numbers+do', genre_pref TEXT, created_at TEXT NOT NULL);
CREATE TABLE calibration_runs (id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('range','latency','headphones','bleed')),
  result_json TEXT NOT NULL, at TEXT NOT NULL);

CREATE TABLE sessions (id TEXT PRIMARY KEY, day TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT,
  active_minutes REAL NOT NULL DEFAULT 0, plan_json TEXT NOT NULL, summary_json TEXT);
CREATE INDEX sessions_day ON sessions(day);

CREATE TABLE lesson_progress (lesson_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('locked','available','in_progress','completed')),
  current_step TEXT, started_at TEXT, completed_at TEXT, best_score REAL, content_hash TEXT, updated_at TEXT NOT NULL);
CREATE TABLE step_attempts (id INTEGER PRIMARY KEY, session_id TEXT REFERENCES sessions(id), lesson_id TEXT NOT NULL,
  step_id TEXT NOT NULL, exercise_id TEXT, attempt_no INTEGER NOT NULL, code TEXT, response_json TEXT,
  result_json TEXT, passed INTEGER NOT NULL, score REAL, feedback_codes TEXT NOT NULL DEFAULT '[]',
  hints_used INTEGER NOT NULL DEFAULT 0, assisted INTEGER NOT NULL DEFAULT 0, tutor_conversation_id TEXT, at TEXT NOT NULL);
CREATE INDEX step_attempts_lesson ON step_attempts(lesson_id, step_id, at);
CREATE TABLE exercise_results (exercise_id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL, first_pass_at TEXT,
  attempts_to_pass INTEGER, best_score REAL, last_score REAL, assisted INTEGER NOT NULL DEFAULT 0, last_at TEXT NOT NULL);
CREATE TABLE checkpoint_attempts (id INTEGER PRIMARY KEY, unit_id TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT,
  score REAL, passed INTEGER, detail_json TEXT);
CREATE INDEX checkpoint_unit ON checkpoint_attempts(unit_id, started_at);

CREATE TABLE skills (skill_id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('concept','family','fact-group')),
  ewma REAL NOT NULL DEFAULT 0, evidence_count INTEGER NOT NULL DEFAULT 0, distinct_days INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'available', mastered_at TEXT, last_evidence_at TEXT);
CREATE TABLE skill_evidence (id INTEGER PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES skills(skill_id),
  source TEXT NOT NULL CHECK (source IN ('exercise','drill','checkpoint','srs','capstone')), source_id TEXT NOT NULL,
  score REAL NOT NULL, weight REAL NOT NULL, day TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX skill_evidence_skill ON skill_evidence(skill_id, at);

CREATE TABLE srs_cards (card_id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('fact','family')),
  skill_id TEXT NOT NULL, generator TEXT, payload_json TEXT NOT NULL, fsrs_json TEXT NOT NULL, model TEXT NOT NULL,
  desired_retention REAL NOT NULL, due_at TEXT NOT NULL, state INTEGER NOT NULL, suspended INTEGER NOT NULL DEFAULT 0,
  introduced_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX srs_due ON srs_cards(due_at) WHERE suspended = 0;
CREATE INDEX srs_skill ON srs_cards(skill_id);
CREATE TABLE srs_revlog (id INTEGER PRIMARY KEY, card_id TEXT NOT NULL REFERENCES srs_cards(card_id), reviewed_at TEXT NOT NULL,
  rating INTEGER NOT NULL, revlog_json TEXT NOT NULL, drill_session_id TEXT, trials_correct INTEGER, trials_total INTEGER,
  median_rt_ms INTEGER);
CREATE INDEX srs_revlog_card ON srs_revlog(card_id, reviewed_at);

CREATE TABLE drill_sessions (id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id), generator TEXT NOT NULL,
  family_ids TEXT NOT NULL, purpose TEXT NOT NULL CHECK (purpose IN ('srs','practice','lesson','checkpoint','placement')),
  started_at TEXT NOT NULL, finished_at TEXT, trials_total INTEGER NOT NULL DEFAULT 0, trials_correct INTEGER NOT NULL DEFAULT 0);
CREATE TABLE drill_trials (id INTEGER PRIMARY KEY, drill_session_id TEXT NOT NULL REFERENCES drill_sessions(id),
  idx INTEGER NOT NULL, family_id TEXT NOT NULL, seed INTEGER NOT NULL, level REAL NOT NULL, trial_json TEXT NOT NULL,
  response_json TEXT NOT NULL, correct INTEGER NOT NULL, cents_error REAL, rt_ms INTEGER, at TEXT NOT NULL);
CREATE INDEX drill_trials_session ON drill_trials(drill_session_id, idx);
CREATE TABLE difficulty_state (family_id TEXT PRIMARY KEY, level REAL NOT NULL, history_json TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE streak_days (day TEXT PRIMARY KEY, qualified INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('practice','freeze','repair')), minutes REAL NOT NULL DEFAULT 0,
  review_sets INTEGER NOT NULL DEFAULT 0, sketch_saved INTEGER NOT NULL DEFAULT 0);
CREATE TABLE freeze_tokens (id INTEGER PRIMARY KEY, earned_at TEXT NOT NULL, reason TEXT NOT NULL, spent_day TEXT);

CREATE TABLE unlocks (item_id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('function','sound','feature','track','unit')),
  source_kind TEXT NOT NULL, source_id TEXT NOT NULL, unlocked_at TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0);
CREATE TABLE cando_ledger (cando_id TEXT PRIMARY KEY, statement TEXT NOT NULL, evidence_kind TEXT NOT NULL,
  evidence_id TEXT NOT NULL, achieved_at TEXT NOT NULL);

CREATE TABLE sketches (id TEXT PRIMARY KEY, title TEXT NOT NULL,
  origin_kind TEXT NOT NULL CHECK (origin_kind IN ('lesson-make','free','capstone','transcription','tutor')),
  origin_id TEXT, current_version INTEGER NOT NULL, tags_json TEXT NOT NULL DEFAULT '[]', archived INTEGER NOT NULL DEFAULT 0,
  listening_comment TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE sketch_versions (sketch_id TEXT NOT NULL REFERENCES sketches(id), version INTEGER NOT NULL, code TEXT NOT NULL,
  bpm REAL, meter TEXT, key TEXT, analysis_json TEXT, note TEXT, created_at TEXT NOT NULL, PRIMARY KEY (sketch_id, version));
CREATE INDEX sketches_origin ON sketches(origin_kind, origin_id);

CREATE TABLE album_tracks (id TEXT PRIMARY KEY, capstone_id TEXT NOT NULL, track_no INTEGER NOT NULL, title TEXT NOT NULL,
  genre TEXT, current_version INTEGER NOT NULL, cover_seed TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE album_track_versions (track_id TEXT NOT NULL REFERENCES album_tracks(id), version INTEGER NOT NULL,
  sketch_id TEXT NOT NULL, sketch_version INTEGER NOT NULL, audio_path TEXT, audio_mime TEXT, duration_s REAL,
  liner_notes_md TEXT NOT NULL, theory_tags_json TEXT NOT NULL, review_json TEXT, created_at TEXT NOT NULL,
  PRIMARY KEY (track_id, version));

CREATE TABLE audio_files (id TEXT PRIMARY KEY /* sha256 */, original_name TEXT NOT NULL, mime TEXT NOT NULL,
  bytes INTEGER NOT NULL, duration_s REAL, sample_rate INTEGER, channels INTEGER, stored_path TEXT NOT NULL,
  peaks_path TEXT, created_at TEXT NOT NULL);
CREATE TABLE transcriptions (id TEXT PRIMARY KEY, source_kind TEXT NOT NULL CHECK (source_kind IN ('own-audio','pd-song','generated')),
  audio_id TEXT REFERENCES audio_files(id), song_id TEXT, title TEXT NOT NULL, artist TEXT, key TEXT, bpm REAL, meter TEXT,
  downbeat_s REAL, regions_json TEXT NOT NULL DEFAULT '[]', checklist_json TEXT NOT NULL DEFAULT '{}', self_score REAL,
  current_version INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'in_progress', review_json TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE transcription_versions (transcription_id TEXT NOT NULL REFERENCES transcriptions(id), version INTEGER NOT NULL,
  code TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (transcription_id, version));

CREATE TABLE tutor_conversations (id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('panel','review-capstone','review-transcription')),
  subject_kind TEXT, subject_id TEXT, session_id TEXT, model TEXT NOT NULL, prefix_version TEXT NOT NULL,
  current_effort TEXT NOT NULL DEFAULT 'medium', created_at TEXT NOT NULL);
CREATE TABLE tutor_messages (id INTEGER PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES tutor_conversations(id),
  seq INTEGER NOT NULL, role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content_json TEXT NOT NULL,         -- exact MessageParam content as sent / received (post fallback-normalization)
  extra_json TEXT,                    -- e.g. {"output_config":{"effort":"low"}} for effort-only system messages
  excluded INTEGER NOT NULL DEFAULT 0,-- refused/truncated tail turns: logged, never replayed
  request_id TEXT, stop_reason TEXT, model TEXT, created_at TEXT NOT NULL, UNIQUE (conversation_id, seq));
CREATE TRIGGER tutor_messages_no_update BEFORE UPDATE ON tutor_messages BEGIN SELECT RAISE(ABORT,'append-only'); END;
CREATE TRIGGER tutor_messages_no_delete BEFORE DELETE ON tutor_messages BEGIN SELECT RAISE(ABORT,'append-only'); END;
CREATE TABLE tutor_usage (id INTEGER PRIMARY KEY, conversation_id TEXT NOT NULL, message_seq INTEGER, request_id TEXT,
  route TEXT NOT NULL, model TEXT NOT NULL, served_by TEXT NOT NULL, input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL,
  cache_write_5m INTEGER NOT NULL, cache_write_1h INTEGER NOT NULL, cache_read INTEGER NOT NULL, cost_usd REAL NOT NULL,
  ttft_ms INTEGER, latency_ms INTEGER, transformations_json TEXT, day TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX tutor_usage_day ON tutor_usage(day);
CREATE TABLE tutor_cards (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, tool_use_id TEXT NOT NULL,
  kind TEXT NOT NULL, title TEXT NOT NULL, code TEXT NOT NULL, explanation TEXT NOT NULL, valid INTEGER NOT NULL,
  eval_json TEXT, applied_at TEXT, saved_sketch_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE tutor_notes (id INTEGER PRIMARY KEY, concept_id TEXT NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL,
  conversation_id TEXT, at TEXT NOT NULL);
CREATE INDEX tutor_notes_concept ON tutor_notes(concept_id, at);
CREATE TABLE practice_suggestions (id INTEGER PRIMARY KEY, target_kind TEXT NOT NULL, target_id TEXT NOT NULL,
  reason TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL, dismissed_at TEXT, done_at TEXT);
```

### 4.3 Migrations and backup

* **Migrations.** `server/db/migrations/NNNN_name.sql`, with an optional `NNNN_name.ts` exporting `up(db)`. They are applied in order inside a transaction, tracked by `PRAGMA user_version`. Startup refuses to run if the DB version is newer than the code.
* **Automatic backup.** On the first launch of each day: `VACUUM INTO '~/.oak/backups/oak-YYYYMMDD.db'`, keeping 14.
* **JSON export (`GET /api/backup/export`).** Format:
  ```ts
  { format: 'oak-backup', formatVersion: 1, schemaVersion, contentVersion, exportedAt, tables: { [name]: rows[] } }
  ```
  Audio stays in `~/.oak/audio`, and the export lists the paths.
* **Import (`POST /api/backup/import`).**
  1. Zod-validate the file.
  2. Run an automatic `VACUUM INTO` first.
  3. In one transaction: drop the append-only triggers, replace all tables, recreate the triggers.
  4. Migrate forward if `schemaVersion` is older.

### 4.4 Endpoints (all under `/api`, zod-validated, typed via `@oak/api`)

| Area | Endpoints |
|---|---|
| Meta | `GET health`, `GET bootstrap` (profile, settings, unlocks, streak, content version), `PUT settings/:key`, `POST settings/anthropic-key` |
| Profile | `GET/PUT profile`, `POST profile/calibration` |
| Session | `GET session/today`, `POST session/start`, `POST session/:id/heartbeat`, `POST session/:id/end` (returns summary: streak, can-dos, unlock previews) |
| Lessons | `GET lessons/progress`, `POST lessons/:id/steps/:stepId/attempts`, `POST lessons/:id/complete`, `POST checkpoints/:unitId/attempts` |
| Skills / SRS | `GET skills/map`, `GET srs/due?budgetSec=`, `POST srs/review` |
| Drills | `POST drills/sessions`, `POST drills/sessions/:id/trials` (batch), `POST drills/sessions/:id/finish`, `GET drills/difficulty/:familyId` |
| Unlocks / can-do | `GET unlocks`, `POST unlocks/:id/seen`, `GET cando` |
| Sketches | `GET sketches`, `POST sketches`, `GET sketches/:id`, `POST sketches/:id/versions`, `PATCH sketches/:id` |
| Album | `GET album`, `POST album/tracks`, `POST album/tracks/:id/versions`, `PUT album/tracks/:id/versions/:v/audio` (binary), `GET album/tracks/:id/versions/:v/audio` (Range) |
| Audio | `POST audio` (streamed to disk, sha256 dedupe), `GET audio/:id` (Range), `PUT audio/:id/peaks`, `GET audio/:id/peaks` |
| Transcriptions | `GET/POST transcriptions`, `GET/PATCH transcriptions/:id`, `POST transcriptions/:id/versions` |
| Tutor | `POST tutor/chat` (SSE), `POST tutor/hint` (SSE), `POST tutor/listening-comment` (SSE), `POST tutor/reviews/capstone` (SSE), `POST tutor/reviews/transcription` (SSE), `POST tutor/retry/:conversationId` (SSE), `POST tutor/session-warm`, `GET tutor/conversations/:id`, `GET tutor/usage?range=`, `POST tutor/cards/:id/applied` |
| Grader | `POST grade` (Bun GraderHost; used by e2e and dev tools) |
| Backup | `GET backup/export`, `POST backup/import` |
| Dev | `POST dev/qa`, `GET dev/content-report`, `POST dev/count-tokens` (all only when `OAK_DEV=1`) |

Outside `/api`:

* `GET /sounds/manifest.json` (no-cache) and `GET /sounds/<packVersion>/*` (immutable, Range).
* In production: `dist/*` plus SPA fallback.

**Contract shape:**

```ts
// @oak/api
export const contract = {
  'sketches.create': { method: 'POST', path: '/sketches', body: SketchCreate, res: Sketch },
  /* … */
} as const;
// server: mount(app, contract['sketches.create'], (body, c) => …)   // zValidator('json', body)
// client: api('sketches.create', body)                              // fetch + 'X-Oak: 1', res parsed by zod
```

---

## 5. Tutor service

### 5.1 One request shape for every route

The prefix is shared, so caching is maximal. Per-route effort is set per message (⚠A1).

```ts
// server/src/tutor/request.ts: the ONLY place request params are assembled (SDK beta typings cast here)
export const BETAS = ['server-side-fallback-2026-07-01', 'thinking-display-updates-2026-08-18',
  'thinking-binding-controls-2026-08-01', 'mid-conversation-output-config-2026-07-01'] as const;
export function baseParams(p: Prefix) {
  return {
    model: 'claude-opus-5-5', betas: [...BETAS], fallbacks: 'default',
    thinking: { type: 'adaptive', display: 'updates',
      block_binding: { prefix_mismatch_behavior: cfg.dev || cfg.test ? 'error' : 'drop_block' } },
    output_config: { effort: 'medium' },             // NEVER varies; per-route effort via effort-only system messages
    tool_choice: { type: 'auto' },                   // forced choice 400s on Opus 5.5
    tools: p.tools,                                  // frozen, name-sorted, strict + eager_input_streaming
    system: p.system,                                // 3 frozen blocks; last has cache_control {ephemeral, ttl:'1h'}
    cache_control: { type: 'ephemeral' },            // automatic 5m breakpoint on the growing tail
  } as const;
}
```

* No `temperature`/`top_p`.
* Route-specific values are limited to `max_tokens` (hint 4k, listening 4k, chat 16k, reviews 32k) and `messages`.
* `client = new Anthropic({ apiKey, maxRetries: 2 })` is constructed once.
* The effort the model actually runs at is changed only with effort-only messages:
  ```ts
  { role: 'system', content: [], output_config: { effort } }
  ```
  `tutor_conversations.current_effort` tracks the active level so a message is emitted only when it changes. Review threads start with `messages[0] = {role:'system', content:[], output_config:{effort:'high'}}`, which is exempt from the placement rules.

### 5.2 System prompt and cache layout

Render order is tools, then system, then messages.

| # | Block | Size | Stability |
|---|---|---|---|
| tools | 9 tools, sorted by name (§5.3) | ~2.5k tok | per prefix version |
| system[0] | **Persona + pedagogy** (`prompt/persona.md`) | ~4k | rare edits |
| system[1] | **Syllabus vN** (`.generated/tutor/syllabus.<hash>.md`): units → lessons (id, title, objectives, concepts, unlocks), conventions | ~12–15k | per content build |
| system[2] | **Strudel catalog vN** (`catalog.<hash>.md`): fn, signature, one-line explanation, unlock lesson, gotchas; sound aliases → strudel.cc equivalents. Carries `cache_control: {type:'ephemeral', ttl:'1h'}` | ~15–18k | per content build |

`prefix_version = sha256(tools+system)` is stored per conversation. A conversation never changes its prefix. If the content changes mid-day, the next new conversation picks up the new prefix.

**Persona and pedagogy rules (`persona.md`):**

* **Role.** Oak's tutor is formative and never decides pass/fail. Refer to "Oak's checker" results that arrive in context.
* **Pedagogy:**
  * sound → code → symbol order; follow PRIMM.
  * Scale degrees first, with letter names in parentheses; movable-do (do-based minor) as the singing aid.
  * Always explain `n` = degree − 1.
* **Conventions:**
  * 1 cycle = 1 bar, `setcpm(bpm/4)` in 4/4.
  * iReal chord symbols in code; show the lead-sheet form alongside.
  * Middle C is `c4`, and `c` alone is C3.
* **Hint ladder:** L1 nudge → L2 concept pointer → L3 partial code → L4 worked solution. Never exceed the context's `hint_level_allowed`. Never paste the reference solution below L4.
* **Tools:**
  * Use `theory_query` for every spelling, Roman numeral or key fact.
  * Use `evaluate_strudel` or `compare_haps` before describing what code sounds like.
  * Use `propose_code` for any code of 2 or more lines, built only from unlocked functions unless it is labelled "preview".
  * Use `record_observation` for misconceptions; use `suggest_practice` sparingly.
  * Reviews end with exactly one `submit_review`.
* **Copyright.** No lyrics. Don't reproduce copyrighted melodies; public-domain repertoire only. Never ask for the learner's audio.
* **Style.** Encouraging and concise, one idea per message, ending with a concrete next action. Length: hint ≤ 80 words, chat ≤ 200 words unless asked, reviews in the structured `submit_review` form.
* **Context protocol.** Explains the meaning of `<oak_context>` system messages and `<learner_code>` user blocks.

### 5.3 Tools

All tools are `strict: true` and `eager_input_streaming: true`, and every object sets `additionalProperties:false` with all fields required. Each input is also zod-validated before it runs, and numeric ranges are clamped server-side.

```ts
export const TOOLS = [
 { name: 'compare_haps', description: 'Deterministically compare learner Strudel code with a target over N bars. Returns per-track pitch/onset/duration diffs at bar:beat and Oak feedback codes. Use when diagnosing a wrong answer.',
   input_schema: { type: 'object', additionalProperties: false, required: ['learner_code', 'target', 'bars', 'mode'], properties: {
     learner_code: { type: 'string' },
     target: { type: 'object', additionalProperties: false, required: ['kind', 'ref'], properties: {
       kind: { type: 'string', enum: ['exercise', 'code'] }, ref: { type: 'string', description: "exercise id 'u03.04#arpeggio-1358' or Strudel code" } } },
     bars: { type: 'integer', description: '1-16' },
     mode: { type: 'string', enum: ['exact', 'pitch-class', 'degrees', 'onsets', 'transposition-invariant', 'chord-pcsets', 'bass-line'] } } } },
 { name: 'evaluate_strudel', description: 'Run Strudel code headlessly (no audio). Returns tempo, per-track events (bar:beat, beats, spelled pitch, degree if key given, sound), errors and warnings. Use before claiming what code sounds like.',
   input_schema: { type: 'object', additionalProperties: false, required: ['code', 'bars', 'key'], properties: {
     code: { type: 'string' }, bars: { type: 'integer', description: '1-16' },
     key: { type: ['string', 'null'], description: "'C major', 'A minor', 'D dorian' or null" } } } },
 { name: 'get_learner_progress', description: 'Current unit/lesson, mastery per concept, weak skill families, recent feedback codes, unlocked functions and sounds, streak.',
   input_schema: { type: 'object', additionalProperties: false, required: [], properties: {} } },
 { name: 'get_lesson_context', description: 'Objectives, step text, exercise prompt, checks, authored hints, known mistakes (wrong variants + feedback codes) and the reference solution (reveal only at hint level 4).',
   input_schema: { type: 'object', additionalProperties: false, required: ['lesson_id', 'step_id'], properties: {
     lesson_id: { type: 'string' }, step_id: { type: ['string', 'null'] } } } },
 { name: 'propose_code', description: 'Show the learner a playable code card (validated by Oak before display). Use for any code of 2+ lines.',
   input_schema: { type: 'object', additionalProperties: false, required: ['kind', 'title', 'code', 'explanation', 'apply'], properties: {
     kind: { type: 'string', enum: ['hint', 'fix', 'variation', 'example', 'next_step'] }, title: { type: 'string' },
     code: { type: 'string' }, explanation: { type: 'string' },
     apply: { type: 'string', enum: ['card_only', 'offer_replace_editor'] } } } },
 { name: 'record_observation', description: 'Note something about the learner for future sessions (misconception, strength, struggle, preference).',
   input_schema: { type: 'object', additionalProperties: false, required: ['concept_id', 'kind', 'note'], properties: {
     concept_id: { type: 'string' }, kind: { type: 'string', enum: ['misconception', 'strength', 'struggle', 'preference'] }, note: { type: 'string' } } } },
 { name: 'submit_review', description: 'Finish a capstone or transcription review. Call exactly once at the end of a review.',
   input_schema: { type: 'object', additionalProperties: false, required: ['summary', 'strengths', 'one_change', 'theory_used', 'liner_note'], properties: {
     summary: { type: 'string' }, strengths: { type: 'array', items: { type: 'string' } }, one_change: { type: 'string' },
     theory_used: { type: 'array', items: { type: 'string' } }, liner_note: { type: 'string', description: '≤60 words' } } } },
 { name: 'suggest_practice', description: 'Add a non-binding suggestion to the learner\'s practice tray.',
   input_schema: { type: 'object', additionalProperties: false, required: ['target_kind', 'target_id', 'reason'], properties: {
     target_kind: { type: 'string', enum: ['family', 'lesson', 'concept'] }, target_id: { type: 'string' }, reason: { type: 'string' } } } },
 { name: 'theory_query', description: 'Deterministic music-theory facts from Oak\'s theory engine. Use instead of computing theory yourself.',
   input_schema: { type: 'object', additionalProperties: false, required: ['op', 'args', 'key'], properties: {
     op: { type: 'string', enum: ['spell_scale', 'spell_chord', 'chord_from_notes', 'roman_of_chord', 'chord_from_roman', 'interval', 'key_info', 'degree_of_note', 'strudel_index'] },
     args: { type: 'array', items: { type: 'string' } }, key: { type: ['string', 'null'] } } } },
] satisfies Anthropic.Beta.BetaTool[];
```

* **Executors** (`server/tutor/tools/*`):
  * `evaluate_strudel` and `compare_haps` run on the Bun GraderHost (§5.10).
  * Results are summarised to ≤ 64 events per track plus counts, keeping tool results small.
  * `get_*` read the DB and `.generated/lesson-text`.
  * `theory_query` calls `@oak/theory`.
* **Tool-call limits.** Tools execute concurrently, and all `tool_result` blocks go in **one** user message. A failure returns `is_error:true` with a reason, and validation failures return `{INVALID_JSON:…}`. Strict-schema totals: 9 tools, 3 union-typed parameters, 0 optional parameters.
* If the API rejects `strict` combined with `eager_input_streaming` (M0 S6), keep `eager` only on `propose_code`.

### 5.4 Context injection (append-only)

Oak-authored, trusted context goes in a mid-conversation **system** message. Learner-authored text goes in the **user** turn, so learner code never gains operator authority.

```
user:   <learner_code editor="exercise" evaluated="true">…code…</learner_code>
        <request kind="hint|question|explain_mistake">why does it sound wrong?</request>
system: [] output_config:{effort:"low"}        ← only if the route's effort ≠ conversation.current_effort
system: <oak_context v="1">
        screen: lesson u03.04 "Scale degrees in code" · step modify (PRIMM: Modify) · exercise u03.04#arpeggio-1358 · attempt 3
        hint_level_allowed: 2 · key C major · 4/4 · 90 bpm
        checker: FAIL score 0.62 · pitch.degree-off-by-one @ bar 1 beats 1-4 (n 1 3 5 8 for degrees 1 3 5 8)
        unlocked: s note setcpm bank scale … (delta: +scale)
        progress: u03 4/10 · due reviews 4 · streak 6
        </oak_context>
→ assistant
```

* A full context block is sent when the screen changes. Otherwise only changed lines are sent, as a delta.
* **Panel threads.** One per session day, `kind='panel'`. The first message's context includes the latest 10 `tutor_notes` as a learner summary.
* **Reviews.** Each capstone or transcription review has its own thread. The `submit_review` result is mirrored into that day's panel thread as a system context line ("Review of C2 completed: …"), so chat can discuss it.

### 5.5 Agent loop (`server/src/tutor/loop.ts`)

```ts
export async function* runTurn(conv: Conversation, route: RouteCfg, signal: AbortSignal): AsyncGenerator<TutorEvent> {
  for (let iter = 0; iter < route.maxIterations /* hint 3, chat 6, review 8 */; iter++) {
    const t0 = performance.now();
    const stream = client.beta.messages.stream(
      { ...baseParams(conv.prefix), max_tokens: route.maxTokens, messages: conv.replay() }, { signal });
    for await (const ev of relay(stream, conv)) yield ev;   // text, progress (non-empty thinking under display:'updates'),
                                                           // status, tool_start, tool_input (propose_code → live card draft)
    let msg: Anthropic.Beta.BetaMessage;
    try { msg = await stream.finalMessage(); }
    catch (e) { yield* errorEvents(e); return; }            // §5.9; nothing appended, so retry is a clean re-send
    usage.record(conv, msg, route, performance.now() - t0); yield { type: 'usage', data: usage.summary(msg) };
    if (msg.stop_reason === 'refusal') { conv.logExcluded(msg); yield err('refusal'); return; }
    const content = normalizeFallbackBoundary(msg.content);  // drop thinking/redacted_thinking/tool_use BEFORE the last
                                                             // `fallback` block; keep the fallback block in place
    const uses = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (msg.stop_reason === 'max_tokens' && uses.length) { conv.logExcluded(msg); yield err('max_tokens'); return; }
    conv.appendAssistant(content, msg);                       // exact blocks, incl. thinking + signatures
    if (msg.stop_reason !== 'tool_use' || uses.length === 0) {
      if (route.requiresSubmitReview && !conv.hasSubmitReview()) { conv.appendSystem(REMIND_SUBMIT_REVIEW); continue; }
      yield { type: 'done', data: { stopReason: msg.stop_reason } }; return;
    }
    const results = await Promise.all(uses.map((u) => executeTool(u, conv, signal)));
    for (const r of results) yield* r.events;               // tool_result summary, card (validated)
    conv.appendUser(results.map((r) => r.block));           // ONE user message with all tool_results
  }
  yield err('iteration_limit');
}
```

* **History is append-only by construction.**
  * `Conversation` exposes only `append*`, `logExcluded` and `replay()`.
  * `replay()` returns `WHERE excluded=0 ORDER BY seq` and parses `content_json` unchanged.
  * DB triggers forbid UPDATE and DELETE.
  * A tail turn that is refused, truncated or aborted is **not appended**. Because it is the tail, nothing earlier changes, and the API merges consecutive user turns if the learner then writes again.
* **Preserved thinking.** Thinking blocks are passed back verbatim. Every response's `input_transformations` is logged to `tutor_usage.transformations_json`, and an alert is raised on any `prefix_binding_mismatch`.

### 5.6 Routes

| Route | Thread | Effort | max_tokens | Input | Output |
|---|---|---|---|---|---|
| `chat` | panel (day) | medium | 16k | learner text + code + context | streamed text, cards |
| `hint` | panel | low | 4k | `kind:'hint'` or `'explain_mistake'`; authored hints + grader feedback in context | ≤80 words, ≤1 card |
| `listening-comment` | panel | low | 4k | saved sketch code + analysis (key, schema, form, rule checks) | ≤80-word comment, stored on the sketch |
| `review-capstone` | own | high | 32k | sketch code, analysis, capstone rubric, learner note | `submit_review` → album version `review_json` + liner note; ≤2 variation cards; ≤2 suggestions |
| `review-transcription` | own | high | 32k | transcription **code** + metadata + self-assessment checklist (never audio) | `submit_review` → `transcriptions.review_json` |
| `session-warm` | n/a | medium | **0** | non-streaming `client.beta.messages.create` with identical tools/system/thinking/effort/betas and a placeholder user `"warmup"`; **no** top-level `cache_control` | fired on Today mount and after more than 55 min idle with the app focused |

* **Offline fallbacks.** If the tutor is offline, has no key, or the budget is exhausted: hints fall back to authored hints and the feedback-code copy, and reviews fall back to deterministic liner notes. The app is fully usable without the tutor.

### 5.7 How code suggestions reach the UI

1. `propose_code` `input_json_delta` events stream as `tool_input`, and the panel shows a ghost card that fills in as it streams.
2. On `content_block_stop`, the server zod-validates the input, then runs `GraderHost.analyze(code, bars=4)` plus `oak` lint with the learner's unlocked set.
3. The result is inserted into `tutor_cards`, and the server emits `card` `{cardId, kind, title, code, explanation, valid, diagnostics, eventsSummary}`.
4. The tool_result returns `{card_id, shown: valid, errors}`. An invalid card renders collapsed ("tutor's draft didn't run; revising"), and the model sees the errors and fixes them.
5. `<CodeCard>` is a mini read-only Workbench with Play, **Apply to editor** (a diff preview, then `EditorHandle.setCode(code, {undoable:true})`, then `POST tutor/cards/:id/applied`) and **Save to sketchbook**.

### 5.8 SSE protocol, usage and budget

The protocol is SSE over POST. The client reads it with `fetch` and a `ReadableStream`, and an AbortController handles Stop.

```ts
export type TutorEvent =
  | { type: 'meta'; data: { conversationId: string; route: Route; model: string } }
  | { type: 'status'; data: { phase: 'thinking'|'tool'|'writing'; label: string } }
  | { type: 'text'; data: { delta: string } }
  | { type: 'progress'; data: { text: string } }
  | { type: 'tool_start'; data: { toolUseId: string; name: ToolName } }
  | { type: 'tool_input'; data: { toolUseId: string; partialJson: string } }
  | { type: 'card'; data: TutorCard }
  | { type: 'tool_result'; data: { toolUseId: string; name: ToolName; ok: boolean; summary: string } }
  | { type: 'usage'; data: { costUsd: number; cacheRead: number; cacheWrite: number; servedBy: string } }
  | { type: 'done'; data: { stopReason: string } }
  | { type: 'error'; data: { kind: 'rate_limit'|'overloaded'|'auth'|'bad_request'|'network'|'refusal'|'max_tokens'|'iteration_limit'|'budget'|'aborted'|'internal'; message: string; retryAfterSec?: number } };
```

**Hono handler:**

```ts
app.post('/api/tutor/chat', zValidator('json', ChatReq), (c) => {
  (c.env as Bun.Server).timeout(c.req.raw, 0);               // disable 10 s idle timeout for this stream
  return streamSSE(c, async (s) => {
    const ac = new AbortController(); s.onAbort(() => ac.abort());
    const hb = setInterval(() => void s.write(': ping\n\n'), 15_000);
    try { for await (const ev of tutor.handle('chat', c.req.valid('json'), ac.signal))
            await s.writeSSE({ event: ev.type, data: JSON.stringify(ev.data) }); }
    finally { clearInterval(hb); ac.abort(); }
  });
});
```

**Cost** is computed per `usage.iterations` entry from `pricing.ts`:

| Model | Input | Output | Cache write 5m | Cache write 1h | Cache read |
|---|---|---|---|---|---|
| Opus 5.5 | $4/M | $20/M | $5/M | $8/M | $0.20/M |
| Fallback models | own rates | | | | |

**Budget** is stored in settings:

* `tutor.dailySoftUsd = 1.50`: show a warning.
* `tutor.dailyHardUsd = 3.00`: only hints run, at low effort, with authored fallbacks.

**Expected cost** is about $0.32 for the 1-hour prefix write per session day, plus ~$0.008 per cached turn, plus output. That comes to roughly $0.6–1.0 per day. Settings shows today, 7-day and 30-day spend, per-route cost, cache-hit ratio and refusal or fallback counts.

### 5.9 Error-handling chain (most specific first)

| Error | Response |
|---|---|
| `Anthropic.RateLimitError` | `retry-after` → `error{kind:'rate_limit', retryAfterSec}`; the UI counts down and offers Retry |
| `Anthropic.AuthenticationError` | `auth` → setup screen |
| `Anthropic.BadRequestError` | log `requestID`, `errorCode`, `details`; `bad_request`. A thinking-binding mismatch can only happen in dev or test, where it fails loudly. |
| `Anthropic.OverloadedError` / `InternalServerError` (after the SDK's 2 retries) | `overloaded` + Retry |
| `Anthropic.APIConnectionError` / `APIConnectionTimeoutError` | `network` |
| `Anthropic.APIUserAbortError` | silent `aborted` |
| `APIError` (fallback) | logged + `internal` |
| In-stream `error` event after HTTP 200 (not retried by the SDK) | mapped to `overloaded`; Retry re-sends the unchanged history (nothing was appended) |
| `stop_reason:'refusal'` (whole fallback chain refused) | friendly `refusal` message; the tail is logged as excluded |

### 5.10 Sandbox for running model-written code (⚠A3)

```ts
// server/src/grader/host.ts
const spawn = () => new Worker(new URL('./bun-worker.ts', import.meta.url).href, { env: {}, smol: true, name: 'oak-grader' });
```

* **Isolation layers:**
  1. The Worker gets an empty `process.env`.
  2. The key was deleted from the parent's env before any spawn (§4.1).
  3. The `@oak/grader` safety lint rejects `ImportExpression` and `import.meta`, `with`, and the identifiers `globalThis`, `self`, `window`, `process`, `Bun`, `require`, `module`, `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `Worker`, `eval`, `Function`, `importScripts`, `navigator`, `postMessage`. It also rejects the member properties `constructor`, `__proto__` and `prototype`.
  4. `lockDown()` overwrites `fetch`, `WebSocket`, `Worker` and `XMLHttpRequest` with throwing stubs after evalScope, as a best-effort second layer.
  5. Tutor calls use a 1500 ms timeout, ≤ 16 bars and ≤ 5 000 events.
* **Fallback host.** If M0 shows `terminate()` is unreliable, swap the same interface to `Bun.spawn(['bun', 'server/src/grader/proc.ts'], { env: {}, stdin: 'pipe', stdout: 'pipe' })` and use `proc.kill()`.

---

## 6. Audio

### 6.1 Single AudioContext lifecycle (`@oak/strudel/audio-context.ts`)

1. On module init, `ctx = new AudioContext({ latencyHint: 'interactive' })`. Never force a sampleRate. Then `setAudioContext(ctx)` runs before anything can call `getAudioContext()`.
2. `ready = prebakeOnce()` registers sounds; no gesture is needed.
3. `unlock()` is wired to the first `pointerdown`, `keydown` or `touchstart` and to every Play button. It runs `await ctx.resume(); if (!worklets) await initAudio({ maxPolyphony: 128 }); ensureMasterChain(); audioReady.resolve()`. This sidesteps the `initAudio` resume bug and the mousedown-only listener.
4. `ctx.onstatechange` handles `suspended`/`interrupted`: playback halts and a "Tap to resume audio" banner appears.
5. The same `ctx` is shared with the mic graph, the signalsmith-stretch node and the recorder. Oak never closes it: `renderPatternAudio` is not used in v1.

### 6.2 Prebake and the self-hosted sound pack

```ts
export const prebakeOnce = once(async () => {
  const m = await (await fetch('/sounds/manifest.json', { cache: 'no-cache' })).json(); // {version, files[]}
  const B = `/sounds/${m.version}/`;
  await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/tonal'), import('@strudel/webaudio'),
    import('@strudel/draw'), import('@strudel/codemirror'), import('@strudel/soundfonts'));
  stubVisualMethods(Pattern);
  setSoundfontUrl(`${B}webaudiofontdata/sound`);                   // files at …/sound/<font>.js
  await Promise.all([
    registerSynthSounds(), registerZZFXSounds(), registerSoundfonts(),
    samples(`${B}piano.json`, `${B}piano/`, { prebake: true }),
    samples(`${B}uzu-drumkit.json`, `${B}uzu-drumkit/`, { prebake: true, tag: 'drum-machines' }),
    samples(`${B}tidal-drum-machines.oak.json`, `${B}tidal-drum-machines/machines/`, { prebake: true, tag: 'drum-machines' }),
    samples(`${B}oak-kits.json`, `${B}oak-kits/`, { prebake: true }),            // jazzkit (Dirt 'jazz' + VCSL subset)
  ]);
  await aliasBank(`${B}tidal-drum-machines-alias.json`);
  registerOakInstruments(OAK_INSTRUMENTS);  // soundAlias for variant 0; registerSound wrapper pinning n for others
  definePianoHelper();                      // Pattern.prototype.piano = s('piano').clip(1).release(0.1) + pan by pitch
});
```

**Mirror script** (`scripts/sounds/mirror.ts`, Bun; writes `sounds/pack/` and `sounds/pack.lock.json`):

* It downloads from `strudel.b-cdn.net`:
  * `piano.json` and its 29 MP3s.
  * `uzu-drumkit.json` and its 41 WAVs.
  * `tidal-drum-machines.json`, **pruned** to `RolandTR909`, `RolandTR808`, `LinnDrum`, `AkaiLinn` and `RolandTR707`, each limited to the taught voices {bd, sd, hh, oh, cp, rim, lt, mt, ht, cr, rd} and the first 2 variants each. That pruning is what keeps the pack at 20–25 MB (⚠A5).
  * `tidal-drum-machines-alias.json`, pruned to the same banks.
  * Dirt-Samples `jazz` (8 one-shots), plus a VCSL hihat and cymbal subset.
* Every JSON has `_base` **rewritten to `/sounds/<ver>/<dir>/`, ending in `/`**. Explicit `baseUrl` arguments are passed anyway, since explicit wins over `_base`.
* For WebAudioFont files, it extracts the `gm` table from `node_modules/@strudel/soundfonts/dist/index.mjs` (asserting 125 entries). It then downloads only the curated variants listed in `catalog/sounds.ts` from `felixroos.github.io/webaudiofontdata/sound/`. It never uses the `gm_electric_bass_finger:1` 404 typo.
* It writes `manifest.json` `{version: sha(lock), files:[{path, bytes, sha256}]}`.
* `sounds:check` enforces the ≤ 25 MB budget and lock/manifest parity.
* `--gm=all-v0` is an optional flag for the full GM variant-0 set, for free play.

**Curated aliases:**

| Alias | Base | Variant | Unlock | Alias | Base | Variant | Unlock |
|---|---|---|---|---|---|---|---|
| `piano` | Salamander samples | n/a | u00 | `ebass` | gm_electric_bass_pick | 0 | u08 |
| `organ` | gm_drawbar_organ | 0 | u05 | `upright` | gm_acoustic_bass | 1 | u11 |
| `rhodes` | gm_epiano1 | audition 0/4 (listening pass) | u06 gate | `jazzgtr` | gm_electric_guitar_jazz | 0 | u12 |
| `cleangtr` | gm_electric_guitar_clean | 5 | u02 | `tenor` | gm_tenor_sax | 0 | jz |
| `crunch` | gm_overdriven_guitar | 4 | u10 | `horns` | gm_brass_section | 0 | u07 |
| `strings` | gm_string_ensemble_1 | 4 | u09 | `jazzkit` | oak-kits bank | n/a | u11 |

### 6.3 Service Worker (`app/public/sw.js`, registered in production only)

* `/sounds/<ver>/*` is CacheFirst in cache `oak-sounds-<ver>`, and old versions are purged on `activate`.
* The app shell (`/`, `/assets/*`) is StaleWhileRevalidate.
* `/api/*` is never intercepted.
* Onboarding includes a "Download all sounds for offline" step that walks `manifest.files` with progress.
* In dev, the versioned paths plus `Cache-Control: public, max-age=31536000, immutable` already give the same warm behaviour.

### 6.4 Preloader

```ts
type PreloadSpec = { samples?: { s: string; bank?: string; n?: number; midi?: number[] }[]; fonts?: { s: string; n: number; midi: number[] }[] };
```

* Per lesson, the spec comes from `.generated/sounds-used.json`. Per drill, it comes from `Trial.preload`.
* **Implementation.** Use superdough's exported buffer and font loaders if M0 confirms the exports (`loadBuffer`, `getFontBufferSource`). Otherwise use a **silent pre-trigger**: `await superdough({ ...value, gain: 0 }, ctx.currentTime + 0.02, 0.05)` for each (sound, pitch).
* Play and Start-drill buttons are disabled until preload resolves.
* **Drills bypass the scheduler.** `playEvents(plan)` calls `superdough(value, ctx.currentTime + 0.08 + ev.at, ev.dur)` with **internal control names** (`cutoff`, `roomsize`, …).

### 6.5 Master bus, limiter and recorder

```
superdough destinationGain ──┐
stretch (Transcription) ─────┼─▶ master.input (Gain) ─▶ limiter (DynamicsCompressor: thr −3 dB, knee 0, ratio 20,
                             │                          attack 0.003, release 0.1) ─▶ makeup Gain 0.9 ─▶ ctx.destination
                             │                                                    └▶ meter Analyser
                             └──────────────────────────────────────────────────── └▶ MediaStreamDestination (record tap)
```

* `ensureMasterChain()` does `ctrl = getSuperdoughAudioController(); ctrl.output.destinationGain.disconnect(); …connect(master.input)`. It re-runs on every play and after anything that calls `resetGlobalEffects()`/`controller.reset()`, comparing node identity. M0 verifies the property names.
* **Recorder v1.** `MediaRecorder(recordTap.stream, { mimeType: 'audio/webm;codecs=opus' })`, falling back to `audio/mp4`. Recording starts at the next integer cycle (polling `transport.cycle()`) and runs for `bars / cps + 2 s` of tail. The result is uploaded to `PUT /api/album/tracks/:id/versions/:v/audio`.

### 6.6 Mic graph

```ts
const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false,
  autoGainControl: false, channelCount: 1 } });
const src = ctx.createMediaStreamSource(stream);                 // never connected to destination or orbits
await ctx.audioWorklet.addModule(pitchWorkletUrl);               // import pitchWorkletUrl from './worklets/pitch.worklet.ts?worker&url'
const node = new AudioWorkletNode(ctx, 'oak-pitch', { numberOfInputs: 1, numberOfOutputs: 0 });
src.connect(node); node.port.onmessage = (e) => tracker.push(e.data as PitchFrame);
```

* The source is rebuilt if the context or device changes.
* The mic opens only for sing steps and closes afterwards, so Bluetooth headsets don't stay in HFP.

### 6.7 Calibration and checks (onboarding u00.02, re-runnable in Settings)

* **Headphone check:**
  * `enumerateDevices` labels matching `/airpods|bluetooth|hands-free|headset|bt/i` produce a warning.
  * `ctx.outputLatency > 0.08` produces a "Bluetooth-like latency" warning.
  * A **bleed test** plays 880, 1175 and 1568 Hz tones with the mic open. If the tracker detects 2 or more at clarity > 0.9, the result is "mic hears the speakers: use wired headphones".
* **Vocal range.** Sustain the lowest and highest comfortable notes. Store `vocal_low/high_midi` and `vocal_tonic_midi`. Generators transpose sung targets into this range.
* **Latency:**
  * `output = ctx.outputLatency + ctx.baseLatency`.
  * `input = track.getSettings().latency ?? 0.01`.
  * The sing-along test is 4 clicks plus "da" on beats; the median onset offset (RMS rise) gives `user_offset_ms`.
  * Keyboard taps are mapped to context time with `ctx.getOutputTimestamp()`: `ctxTime = ts.contextTime + (ev.timeStamp − ts.performanceTime)/1000`. They are compared with the hap's scheduled time minus output latency. Windows: ±60 ms good, ±120 ms OK.
* **Visual offset.** `visual_offset_ms` is user-tunable via a flash-and-click test and feeds `transport.audibleCycle()`.

### 6.8 Transcription Studio audio

1. Upload with `POST /api/audio` (local disk only).
2. Fetch `/api/audio/:id` → `ctx.decodeAudioData` → `stretch = await SignalsmithStretch(ctx)`, then `stretch.addBuffers(channels)`, then `stretch.connect(origGain)` into `master.input`.
3. Controls use `stretch.schedule({ active, rate /*0.25–1*/, semitones, loopStart, loopEnd, input })`.
4. Display uses wavesurfer v8 only: peaks from the server (computed client-side once, `PUT …/peaks`), plus the Regions (A–B loops, section markers), Timeline, Zoom and Spectrogram (logarithmic, `frequencyMax: 4000`) plugins. The cursor is synced with `ws.setTime(stretch.inputTime)` each rAF.
5. **A/B and overlay sync:**
   * The learner sets BPM (tap tempo) and `downbeat_s`.
   * When playing "both", Strudel is started with `setcps(cps*rate)`.
   * An `editPattern` `onTrigger` probe captures the first downbeat hap's `targetTime` and calls `stretch.start(targetTime)` with `input = downbeat + k·barSec`. The trigger fires about 0.1 s early, so this can be scheduled exactly.
   * A crossfader balances `origGain` against the Strudel level.
6. **Review.** A self-assessment checklist (bass, chord changes, melody contour, form). The tutor review sends **code and metadata only**.

---

## 7. Testing

| Layer | Tool | What |
|---|---|---|
| Theory | `bun test packages/theory` | Spelling in all 30 keys; normalization round-trips (iReal ↔ lead-sheet ↔ abcjs display); RN case semantics; schema detection; `fast-check` properties (`spellMidi(midi).midi === midi`) |
| Grader | `bun test packages/grader` | `.p` collector (mute/solo/`$` indexing); stubs; normalization (n-without-scale, octave, freq); every comparator and diagnoser (degree-off-by-one); timeout kill (a `while(true)` 100× in under 2 s each); hap cap; lint denylist; snapshot lines in Strudel's `[ b → e \| … ]` format with rounded floats |
| Notation | `bun test packages/notation` | Golden corpus `tests/fixtures/notation/*.strudel` → `.abc` + spelled-pitch snapshots: `c d e`, `c [d e f]`, `c@3 d`, `<c d>`, `c ~ d`, cross-bar ties, quintuplets, nested triplets, `voicing()` in sharp keys, `F#:major`, 6/8, swing (approximate), drums. 30 at M1, 80 at M3. `abcjs.parseOnly` warnings = 0 |
| Pitch DSP | `bun test packages/pitch` | Synthetic sines (±1¢), synthetic-voice WAV fixtures (vibrato ±30¢, breath noise, low G2 voice for octave errors); segmentation; grading |
| SRS / drills | `bun test packages/{srs,drills}` | `ts-fsrs` 6 under Bun (M0); outcome→rating; mixed-set grouping; staircase converges to 0.85 ± 0.03 against a simulated learner; generator property tests (answers valid, ranges respected, deterministic by seed) |
| Server | `bun test server` | Routes via `app.request()` on an in-memory DB; migrations up from 0; append-only triggers; backup round-trip; security middleware (bad Host/Origin, missing `X-Oak`) |
| Tutor | `bun test server/src/tutor` | **Cassettes**: the SDK is constructed with a `fetch` that replays recorded SSE (`cassettes/*.ndjson`). Covers tool loop, parallel results in one message, refusal/max_tokens/abort tail handling, fallback-boundary normalization, prefix byte-stability (serialize tools+system twice and diff), effort-message emission rules |
| Tutor (live) | `bun run tutor:smoke` (manual, spends money) | Full beta set accepted; `cache_read_input_tokens > 0` on the 2nd identical request; `max_tokens:0` warm; `prefix_mismatch_behavior:'error'` across a 5-turn tool conversation with zero 400s |
| Content | `bun test content/validate` | §3.7 |
| Browser integration (optional) | Vitest 5.1 browser mode (Chromium, `--autoplay-policy=no-user-gesture-required`) | Adapter: prebake, play, limiter chain survives `resetGlobalEffects`, 3 editors with solo, dispose leaves 0 rAF / 0 listeners; CM6 extensions (autocomplete gating, read-only filter, lint); pitch worklet loads in dev and build; recorder produces a non-empty Blob |
| E2E | Playwright 1.65 (build + `bun run start` with `OAK_DATA_DIR=tmp`, `OAK_TUTOR_FAKE=1`) | Onboarding (audio unlock, calibration with fake mic); full u00–u01 path; drill with singing (per-file `test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=tests/fixtures/audio/sing-do-mi-sol.wav'] } })`); sketch save; tutor panel against cassettes; backup export/import |

* Lint and format: **Biome 2.6.6** (`biome ci`), including the import-boundary rules.
* `bun run check` = typecheck (3 configs) + Biome + `bun test`. This is the local gate before every commit and content merge.
* `check:full` adds browser mode, the build and e2e.

---

## 8. Phased implementation plan

| Milestone | Deliverables | Verification gate |
|---|---|---|
| **M0 De-risk spike** (1–2 wk) | Repo skeleton, exact pins, kabelsalat patch, `check-deps`. Seven spikes: **S1** Bun headless grader in a Worker (`$:` blocks, `.p` collector, `terminate()` reliability, `env:{}` isolation). **S2** StrudelMirror ×3 in Vite + React 19 StrictMode (solo, `appendConfig` extensions, dispose leak check, `<html>` class guard). **S3** sound pack mirror, prebake from `/sounds/<ver>`, SW offline, aliases (variant pinning), preload with no "skip hap", limiter re-insertion. **S4** 10 haps→ABC patterns with `!class=` highlight driven by `scheduler.now()`. **S5** pitchy worklet via `?worker&url` in dev and build (verify `/@vite/env` prelude and `numberOfOutputs:0`), Playwright fake-mic 440 Hz within ±5¢ while Strudel plays. **S6** tutor SSE through Hono with the full beta set, strict + eager tools, cache read > 0, `max_tokens:0` warm. **S7** ts-fsrs 6 on Bun. | All 7 spikes green, or a documented fallback chosen (subprocess grader; GainNode-pulled worklet; eager only on `propose_code`; Babel plugin form of React Compiler). Findings written into `docs/spikes.md` |
| **M1 Platform** (3–4 wk) | Every package in §2 at v1; Workbench (editor + roll + staff + HighlightBus); browser and Bun GraderHosts; theory core; notation v1; server (Hono, security, SQLite, migrations, all non-tutor endpoints, backup); content-kit, build, validation, `/dev/listen`; sound pack v1; Biome rules; test harness | `bun run check` green; one sample lesson using **every** MDX component and exercise kind passes §3.7; 30 golden notation snapshots; adapter leak test green |
| **M2 Vertical slice** (3–4 wk) | Onboarding u00 (3: hello Strudel + audio unlock, headphones/mic/range/latency calibration, first loop); u01 (9) and u02 (8, incl. C1); drill engine with stage-A families plus degree-id preview; SRS + Today plan + streak/freeze/repair; sketchbook; toolbox v1; skill map v1; tutor chat, hint, explain-mistake, listening comment, session-warm, cards, usage page | Dogfood 10 consecutive days; median session 15–25 min; e2e u00→u01 green; tutor cost under $1.50/day measured with cache hit ≥ 80% of input tokens; zero `prefix_binding_mismatch` |
| **M3 Notation and singing** (3 wk) | StaffInput pointer layer; bass clef and grand staff; key signatures; FET degree drills with sung resolution; sing-echo; tolerance progression; u03 (10) and u04 (6) | Pitch fixtures: ≥ 95% voiced frames within ±25¢ on clean synthetic voices, octave errors < 2%; 80 notation snapshots; u03 checkpoint gate works end to end |
| **M4 Album and transcription** (3 wk) | Capstone flow (multi-session), recorder, album and liner notes, capstone reviews; Transcription Studio (upload, stretch, regions, spectrogram, A/B sync, checklist, review); generated transcription ladder L1–L4; one public-domain folk song (L5) | C1 and C2 recorded into the album with reviews; A/B overlay drift < 20 ms over 8 bars at rate 0.75; L1–L4 graded exactly |
| **M5 Content waves** (~10–12 wk) | u05–u18 plus checkpoints and C3–C7 plus Finale, in waves of 2–3 units; remaining ear-training stages C–F; jazz kit; `voicing()` unlock at the u06 gate | Per wave: §3.7 green, reviewer-agent sign-off, Listen QA OK for every changed example hash, a dogfood week per wave |
| **M6 Advanced tracks** (~8 wk) | Jazz (iReal symbols ↔ lead sheets, guide tones, shells, rootless voicings via `dict`/`anchor`/`mode`, J1–J4, F3); Rhythm (swing ratios, 16th funk, clave, Euclid, odd meters → compound/irregular `Meter` + tuplets, F1–F2); Arrangement and sound (synthesis, FX, orbits, energy curves, A1) | Same per-wave gate, plus track-specific notation corpora (swing marked approximate, 7/8 groupings) |

### Content authoring workflow (multi-agent, at scale)

1. **Unit spec (human + architect agent).** `unit.ts` with objectives, lesson list, concepts, families, can-dos, unlocks, gate and capstone. It is checked against the concept graph: no forward references.
2. **Author agent (one per lesson, parallel within a unit).**
   * Inputs: `AUTHORING.md` (PRIMM template, sound→code→symbol, 20-min budget, voice), `STYLE.md`, the unit spec, the catalog of functions unlocked so far, and two exemplar lessons.
   * Outputs: `lesson.ts` + `lesson.mdx`.
   * Loop: run `bun run content:check <id>` until green. Every exercise needs ≥ 2 `wrong` variants mapped to distinct feedback codes.
3. **Musical-correctness reviewer agent (adversarial, separate context).**
   * Re-derives every theory claim with `bun scripts/theory.ts <op> …` (the `theory_query` CLI).
   * Checks pedagogy order, scale-degree-first language, the 0-based index teaching, and copyright rules.
   * Files findings as `// REVIEW:` comments, which the author resolves.
4. **Playtest agent.** Attempts each exercise using only prior lessons' knowledge and the prompt text. Failure patterns flag underspecified prompts.
5. **Listen QA (human, `/dev/listen`).** Every changed example hash must be marked OK. "Musically weak" sends the item back to step 2.
6. **Merge gate.** `bun run check`, then `OAK_RELEASE=1 bun test content/validate` (requires Listen QA), then the dogfood week.

Drills, facts and the L1–L4 transcription tasks are procedural. Hand-authored content is limited to concept lessons, capstone briefs and public-domain songs.

---

## 9. Top risks and mitigations

| Risk | Mitigation |
|---|---|
| **Strudel global state and multi-editor bugs** (shared scheduler state, `.p` injection, `cleanupDraw` prefix, #2128 widgets, no `destroy()`) | Single adapter; ids end in `_`; `solo:true`; EvalMutex; complete `dispose()`; inline widgets stubbed; ≤ 6 live mirrors (IntersectionObserver + LRU); grader isolated in its own Worker realm; adapter leak test in browser mode |
| **Stale npm release vs Codeberg main** (`onSchedule`, kabelsalat move, voicing modes) | Exact pins + lockfile; one-line patch (bun install fails loudly if stale); Biome import boundaries make migration a one-file change; event snapshots for all content detect drift; grade on MIDI/pitch-class sets, never voicing octaves; watch #2178, #2171, #1932; rehearse upgrades in a git worktree with `bun test content/validate` |
| **Sound loading latency and offline** | Self-hosted versioned pack; SW CacheFirst; preload per lesson and per drill (silent-trigger fallback); `skip hap` log → auto-preload + replay; offline download step in onboarding; 25 MB budget check |
| **Mic accuracy** (untrained voice, octave errors, bleed, Bluetooth) | AEC/NS/AGC off; wired-headphone and bleed checks; clarity ≥ 0.9, median-of-5, octave continuity, folding; tolerance 50¢ → 25¢ by mastery; never gate progress on singing alone (degree-button alternative, lower evidence weight); synthetic-voice fixtures; detector interface ready for a SwiftF0 swap |
| **Notation edge cases** (tuplets > 9, nesting, polymeter, abcjs wrap and clef bugs) | Exact rationals + explicit quantizer with an `approximate` flag; content may notate only notatable examples; golden corpus; abcjs pinned 6.7.2; fixed staff width and single clef per staff; percussion and rhythm staves covered by snapshots |
| **Tutor cost** | One request shape with a 1-hour cached prefix (~36k tokens), `session-warm`, per-message effort, low effort for hints and comments; summarised tool results; iteration caps; per-day soft and hard budgets; usage dashboard; cassette test for prefix byte-stability; `tutor:smoke` cache assertion |
| **Preserved-thinking and append-only violations** (enforced 400s for new accounts) | Conversation API cannot edit; DB triggers; fallback-boundary normalization at append time; context only as appended messages; `'error'` mode in dev and test, `'drop_block'` + `input_transformations` alerting in prod |
| **Model-written code execution on the server** | Bun Worker `env:{}`, key removed from the parent env, AST denylist, `lockDown`, strict time/bar/event caps; subprocess fallback |
| **Content correctness at 235 sessions** | Validation suite (solutions pass, wrong variants fail with codes, theory re-derivation, unlock-before-use, sounds exist), reviewer and playtest agents, Listen QA hash gate, event snapshots |
| **Brand-new toolchain majors** (Vite 8, TS 7 native, Vitest 5, React Compiler, ts-fsrs 6) | Exact pins; M0 spikes; React Compiler can be switched off with one plugin line; SRS behind Oak's interface with `model` stored per card |
| **Localhost exposure** | 127.0.0.1 bind; Host + Origin + `X-Oak` checks; no CORS; key never sent to the browser; secrets file 0600 |
| **Copyright** | Ships only Oak's own Strudel renditions of public-domain or trad material (≤ 1930 US; provenance validated); your own audio stays in `~/.oak/audio` and never goes to Claude; no lyrics outside public-domain material |
| **Motivation mechanics backfiring** | Rewards carry information (real tools, a decaying skill map, album, can-do ledger); no XP or leaderboards; streak freeze and repair, no shaming; sketching never gated |
| **AGPL** | Personal local use only; if Oak is ever published, release it as AGPL-3.0-or-later |

---

### Critical files for implementation

- /Users/fpl0/Code/Oak/packages/strudel/src/index.ts — the OakStrudel adapter: editors, prebake, transport, master bus, preload
- /Users/fpl0/Code/Oak/packages/grader/src/runtime.ts — headless Strudel realm, `.p` collector, normalization, checks, safety lint, worker protocol
- /Users/fpl0/Code/Oak/packages/notation/src/index.ts — NotationModel quantizer, speller and ABC emitter
- /Users/fpl0/Code/Oak/server/src/tutor/loop.ts — agent loop, request shape, append-only conversation, SSE events
- /Users/fpl0/Code/Oak/scripts/content/build.ts — content generation, with `/Users/fpl0/Code/Oak/content/validate/` as the gate
- /Users/fpl0/Code/Oak/server/src/db/migrations/0001_init.sql — SQLite schema