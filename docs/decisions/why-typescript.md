# Why TypeScript (Strict, ESM-Only, Tree-Shakeable)

## Table of Contents

- [The stack in one table](#the-stack-in-one-table)
- [Why TypeScript at all](#why-typescript-at-all)
- [Why `strict` (with two deliberate exceptions)](#why-strict-with-two-deliberate-exceptions)
- [Why ESM-only (`"type": "module"`)](#why-esm-only-type-module)
- [Why `"sideEffects": false`](#why-sideeffects-false)
- [Why `moduleResolution: "bundler"`](#why-moduleresolution-bundler)
- [Why `target`/`lib` are ESNext + DOM](#why-targetlib-are-esnext--dom)
- [Why `verbatimModuleSyntax`](#why-verbatimmodulesyntax)

## The stack in one table

Every one of these choices is encoded in the config files:

| Setting | Value | File |
|---------|-------|------|
| Language | TypeScript, `strict: true` | `tsconfig.json:15` |
| Module format | ESM (`"type": "module"`) | `package.json:34` |
| Tree-shaking hint | `"sideEffects": false` | `package.json:35` |
| Resolution | `moduleResolution: "bundler"` | `tsconfig.json:10` |
| Target / lib | `target: "ESNext"`, `lib: ["ESNext", "DOM", "DOM.Iterable"]` | `tsconfig.json:3-4` |
| Import style | `verbatimModuleSyntax: true` | `tsconfig.json:12` |
| Emit | tsup bundles JS; `tsc -p tsconfig.build.json` emits declarations only | `package.json:44-45`, `tsconfig.build.json:5-6` |

## Why TypeScript at all

A color science library is almost pure data shape: hex strings, ARGB ints,
tuples, option objects, result records. Getting those shapes wrong silently
produces wrong colors — the worst kind of bug, because the app still renders.
TypeScript turns the shapes into enforced contracts:

- `ColorValue` is a branded template-literal type: `export type ColorValue = \`#${string}\`` (`src/types.ts:12`). Callers cannot pass `"red"` or `"ff0000"`; the type system rejects invalid color inputs at compile time.
- `Palette` (`src/types.ts:16-70`) lists all 53 roles as named keys, so a typo like `theme.light.primar` is a compile error.
- `Variant` is a 10-literal union (`src/types.ts:80-90`) — exhaustive `switch` statements in `toInternalVariant` (`src/color.ts:395-418`) are checked for missing cases.
- `extraColors` is generic over the caller's token map, and the returned type adds `on-{name}` keys via a mapped type (`src/color.ts:364-368`).

The public API also ships overloads where the return type depends on the
argument — `contrastChecker(base, on, cvd: false)` returns `ContrastScore`,
while the default returns `ContrastScoreCVD` (`src/color.ts:194-196`). That is
unrepresentable without a static type system.

## Why `strict` (with two deliberate exceptions)

`strict: true` is on (`tsconfig.json:15`), and with it come `strictNullChecks`,
`strictFunctionTypes`, `noImplicitReturns`, and the rest. For numeric code this
matters most through `strictNullChecks`: the array index accesses throughout
the HCT/CAM16 math are type-guarded with non-null assertions, e.g.

```ts
// src/utils/color.ts:93
const linearR = matrix[0]![0]! * x + matrix[0]![1]! * y + matrix[0]![2]! * z;
```

and the spec layer guards `sourceColorHcts[0]` with a fallback before use
(`src/scheme/dynamic-scheme.ts:147`).

Two exceptions are deliberately, explicitly set:

```json
// tsconfig.json:8
"noImplicitAny": false,
// tsconfig.json:18
"noUncheckedIndexedAccess": false
```

This is worth being precise about. `strict` implies `noImplicitAny: true`, but
the explicit `noImplicitAny: false` overrides it back. Combined with
`noUncheckedIndexedAccess: false`, the config says: *implicit any is tolerated,
and indexed reads are allowed to silently be `T` rather than `T | undefined`.*
That is a pragmatic relaxation for the numerical core — the code uses
non-null assertions (`!`) at the hot math sites rather than carrying `undefined`
checks through every matrix multiply — while still getting null-safety and type
checking for the public API and data shapes. The two flags are the *admitted
exceptions*, not an accident: everything else strict stays on, including
`noImplicitOverride` (`tsconfig.json:19`) which the `Scheme*` subclasses rely on
to override `DynamicScheme` behavior cleanly, and `noFallthroughCasesInSwitch`
(`tsconfig.json:17`) which guards the exhaustive variant switches.

## Why ESM-only (`"type": "module"`)

`package.json:34` sets `"type": "module"`, and `tsup.config.ts:5` emits only
`format: ["esm"]`. The output is a single self-contained ESM file
(`tsup.config.ts:4`, `bundle: true`).

The ecosystem has moved. Node.js has shipped stable ESM since 12.17/14,
`moduleResolution: "bundler"` is the modern bundler default, and every
mainstream frontend toolchain (Vite, esbuild, Rollup, webpack) handles ESM
natively. Shipping CommonJS would mean maintaining two emit paths, a
`main`/`module` split, and interop shims — all so that legacy tools that nobody
in the target audience (Node >= 18, modern bundlers, `package.json:36-38`) needs.

A single ESM format also keeps the bundle deterministic and tree-shakeable, and
makes the `sideEffects: false` claim honest (see below). The cost is real but
small and intentional: CommonJS consumers cannot `require()` this package
directly. That is an acceptable trade for a library whose README and CI
(`.github/workflows/ci.yml`) target Node 22/23 and modern bundlers.

## Why `"sideEffects": false`

```json
// package.json:35
"sideEffects": false
```

This tells bundlers that **no module in the package has global side effects** —
importing anything never mutates globals, registers side tables, or reads
configuration. With that guarantee, a bundler can safely **drop unused exports**
(tree-shaking). Concretely: if you only use `contrastChecker`, the bundler can
eliminate the scheme layer, the spec layer, and the quantizers entirely from the
final bundle.

The claim is backed by the code's structure:

- Every module is pure functions, classes, or `export const` namespaces
  (`Blend` in `src/science/blend.ts:28`, `Score` in `src/science/score.ts:53`).
- The only module-level state is cache/singleton memoization that is local and
  immutable by consumers — e.g. `const spec2025 = new PaletteTokens()`
  (`src/spec/palettes.ts:407`) and `const spec = new ColorCalculationDelegateBase()`
  (`src/spec/color-calculation.ts:203`). These are lazily-internalized singletons
  that do not touch globals, so declaring `sideEffects: false` is truthful.
- The DOM-only path (`fromImage`) is isolated in `src/science/image.ts` and only
  touches `document` inside the function body (`src/science/image.ts:26-27`),
  so importing the package in Node never touches the DOM.

`tsup` also enables its own `treeshake: true` (`tsup.config.ts:10`), which runs
rollup-based tree-shaking on the bundle itself, so the *published single file*
is already pruned, not just the consumer's final build.

## Why `moduleResolution: "bundler"`

```json
// tsconfig.json:10
"moduleResolution": "bundler"
```

The `bundler` resolution mode models how esbuild/Rollup/Webpack/Vite actually
resolve imports today: it allows extensionless and extensioned imports, resolves
`exports` maps, and understands `package.json` `exports` — including the `types`
condition in this package's own map (`package.json:61-66`).

It pairs with two related flags:

- `module: "Preserve"` (`tsconfig.json:5`) — keeps ESM syntax as written instead
  of rewriting it, which matches the ESM-only output.
- `allowImportingTsExtensions: true` (`tsconfig.json:11`) — the source imports
  are extensionless (`./utils`, `./science`); this flag makes the type checker
  happy with that style. Because it requires `noEmit`, the base config sets
  `noEmit: true` (`tsconfig.json:13`), and the build config switches to
  `emitDeclarationOnly` (`tsconfig.build.json:6`), which satisfies the same
  constraint.

The alternative — `moduleResolution: "node"` (old "node10") — would insist on
CJS-style resolution rules and mis-model modern packages with `exports` maps.
`"node16"/"nodenext"` would require explicit `.js` extensions on all relative
imports, which the codebase deliberately does not use. `bundler` is the correct
choice for a package that is *consumed by bundlers*.

## Why `target`/`lib` are ESNext + DOM

```json
// tsconfig.json:3-4
"lib": ["ESNext", "DOM", "DOM.Iterable"],
"target": "ESNext",
```

- **`target: "ESNext"`** — the library does no transpilation down to older
  syntax. Class fields, `Map`/`Set`, `Object.fromEntries`, optional chaining are
  all used (`Object.fromEntries` in `src/color.ts:138-141`). Since tsup/esbuild
  targets modern runtimes and `engines.node >= 18` (`package.json:36-38`), there
  is nothing to gain from downleveling; the shipped ESM is close to the source.
- **`lib: ["ESNext", "DOM", "DOM.Iterable"]`** — `DOM` is required because the
  public API includes `Color.fromImage(image: HTMLImageElement)`
  (`src/color-class.ts`) and `sourceColorFromImage` uses `document.createElement`,
  `canvas.getContext`, and `ImageData` (`src/science/image.ts:26-44`). The DOM
  lib types those APIs. `DOM.Iterable` brings the iterable types for DOM
  collections, and `ESNext` covers the newer standard library APIs.

The consequence is that the *type declarations* ship with DOM types in scope for
the `fromImage` signature, but — per the `sideEffects` discussion — the *code*
only touches the DOM when that function is actually called.

## Why `verbatimModuleSyntax`

```json
// tsconfig.json:12
"verbatimModuleSyntax": true
```

This forces type-only imports to be written as `import type`, and regular
imports to be emitted as-is. The source complies everywhere: `src/index.ts`
uses `export type * from './types'` for the type surface (`src/index.ts:15`),
`src/color.ts` separates value imports from type imports
(`src/color.ts:12-17`), and `src/quantize/index.ts` uses `export type * from
'./point-provider'` (`src/quantize/index.ts:13`).

Why it matters in this project specifically: with a single ESM output and no
build-time type erasure other than esbuild, `verbatimModuleSyntax` guarantees
that a type-only import never survives into the JS bundle. That is exactly the
discipline that makes the tree-shaking claim in the previous section real — no
`import { SomeType } from ...` leaks into `dist/index.js` as a runtime import.
