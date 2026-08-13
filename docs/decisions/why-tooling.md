# Why This Tooling

## Table of Contents

- [The toolchain map](#the-toolchain-map)
- [Why tsup for bundling](#why-tsup-for-bundling)
- [Why tsc for type declaration emit](#why-tsc-for-type-declaration-emit)
- [Why the build runs tsup then tsc](#why-the-build-runs-tsup-then-tsc)
- [Why Vitest over Jest](#why-vitest-over-jest)
- [Why Biome over ESLint + Prettier](#why-biome-over-eslint--prettier)
- [Why the release workflow is shaped this way](#why-the-release-workflow-is-shaped-this-way)

## The toolchain map

Every choice is observable in `package.json` scripts and the workflow files:

| Concern | Tool | Evidence |
|---------|------|----------|
| Bundling | tsup | `tsup.config.ts`, `scripts.build` (`package.json:45`) |
| Type declarations | `tsc -p tsconfig.build.json` | `tsconfig.build.json`, `scripts.build` |
| Tests | Vitest | `scripts.test` (`package.json:46`), `vitest.config.ts` |
| Benchmarks | Vitest bench | `scripts.bench` (`package.json:51`), `bench/*.bench.ts` |
| Lint + format | Biome | `scripts.lint`/`format` (`package.json:49-50`) |
| Typecheck gate | `tsc --noEmit` | `scripts.typecheck` (`package.json:48`), `ci.yml:28` |
| Release | npm + GitHub Actions | `.github/workflows/release.yml`, `publishConfig` |

## Why tsup for bundling

`tsup.config.ts` is eleven lines and says everything:

```ts
// tsup.config.ts
export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	outDir: "dist",
	clean: true,
	minify: true,
	bundle: true,
	treeshake: true,
});
```

tsup is a zero-config wrapper around **esbuild** with sensible defaults. For this
project it is the right size of tool:

- **One entry, one output file.** With `bundle: true`, all of `src/` collapses
  into a single `dist/index.js` — exactly the shape the `exports` map promises
  (`package.json:61-66`). No code-splitting, no multiple chunks to reason about.
- **ESM-only output** matches `"type": "module"` (`package.json:34`) and the
  `moduleResolution: "bundler"` story (see [why-typescript.md](./why-typescript.md)).
- **`minify: true`** is what makes the bundlephobia badges in the README
  (`README.md:13-18`) report real-world sizes.
- **`treeshake: true`** runs Rollup-style tree-shaking on the bundle, so even
  the *published file* is already pruned of unused exports — complementing the
  `"sideEffects": false` flag (`package.json:35`).
- **`clean: true`** wipes `dist/` before each build, so stale artifacts never
  survive into a publish.

esbuild is fast enough that the build is effectively instant; the heavy lifting
happens in `tsc`, which is the type declaration step below. Using webpack or
Rollup directly here would buy nothing — there is exactly one entry and no
assets, external chunks, or loaders.

## Why tsc for type declaration emit

tsup, via esbuild, does not type-check and does not emit declarations. So the
build's second half is the TypeScript compiler in declaration-only mode:

```json
// tsconfig.build.json
{
	"extends": "./tsconfig.json",
	"compilerOptions": {
		"noEmit": false,
		"declaration": true,
		"emitDeclarationOnly": true,
		"outDir": "dist",
		"rootDir": "src",
		"declarationMap": false
	}
}
```

This is the deliberate, boring choice: `tsc` is the reference implementation of
the type system, so the `.d.ts` files in `dist/index.d.ts` (referenced by
`package.json:63` and `package.json:67`) are guaranteed to match what the
compiler itself accepts. No third-party dts-bundler, no risk of emitting
declarations that diverge from the compiler's own resolution rules.

Three details are worth noting:

- **`emitDeclarationOnly`** satisfies `allowImportingTsExtensions`'s
  no-emit requirement (see [why-typescript.md](./why-typescript.md)); the base
  config keeps `noEmit: true` (`tsconfig.json:13`) so the standalone `tsc
  --noEmit` typecheck (`package.json:48`) stays a pure gate with zero output.
- **`declarationMap: false`** keeps the published tarball lean — source maps for
  declarations would add files without adding value for consumers of a
  tree-shaken single bundle.
- The same compiler does double duty: `tsc --noEmit` is the CI typecheck gate
  (`ci.yml:28`), and `tsc -p tsconfig.build.json` produces the artifact. One
  tool, two modes, no duplicated semantics.

## Why the build runs tsup then tsc

```json
// package.json:45
"build": "tsup && tsc -p tsconfig.build.json",
```

The order is not arbitrary — it is load-bearing. `tsup` runs first with
`clean: true`, which **deletes `dist/` before writing the JS bundle**. If `tsc`
ran first, its freshly emitted `.d.ts` files would be wiped by tsup's clean
step. Running `tsup && tsc` means: clean → emit JS → emit declarations into the
same `dist/`, and both artifacts land atomically with respect to the clean.

The same command is wired to `"prepare"` (`package.json:44`), which npm runs
automatically on local installs from Git. That guarantees a freshly checked-out
or `npm install <git-url>` consumer gets built artifacts, not stale ones.

## Why Vitest over Jest

`vitest.config.ts` is nearly empty:

```ts
// vitest.config.ts
export default defineConfig({
	test: {},
});
```

Zero configuration is the point. Vitest is the natural fit for this codebase:

- **ESM-first.** The package is `"type": "module"` with `moduleResolution:
  "bundler"`. Vitest runs on Vite/esbuild, so tests import the source directly
  (`test/**`, `bench/**` all `import { ... } from "../src"` and from
  `"culori"`/`"chroma-js"` in bench files) with no transform gymnastics. Jest's
  ESM support historically required `babel-jest`/`ts-jest` config, mocks of the
  module system, and separate config files.
- **Native TypeScript.** No ts-node, no ts-jest, no per-test compilation step.
- **One engine for tests and benchmarks.** `vitest bench` runs the
  `bench/*.bench.ts` files (`package.json:51`), which use `import { bench,
  describe } from "vitest"` (`bench/theme.bench.ts:1`). Jest has no built-in
  benchmark story; you would bolt on `benny`/`tinybench` and a second runner.
- **Speed and DX.** esbuild transformation makes the ~99 tests across
  `test/api`, `test/correctness`, `test/internal`, and `test/edge-cases.test.ts`
  run fast enough that CI just calls `npm test` (`ci.yml:38`).

For a zero-dependency library whose test suite mostly asserts numerical
correctness (HCT round-trips, contrast ratios, palette outputs), the simplest
runner that natively understands TypeScript + ESM is the right runner — and that
is Vitest, not Jest.

## Why Biome over ESLint + Prettier

The repo has **no lint/format config file at all** (no `biome.json`, no
`.eslintrc*`, no `.prettierrc*`), and the scripts are:

```json
// package.json:49-50
"lint": "biome lint --write .",
"format": "biome format --write .",
```

Biome's zero-config defaults are opinionated but internally consistent — the
same tool owns both linting and formatting, so there is no ESLint-vs-Prettier
disagreement (the classic cause of the infamous "eslint --fix then prettier
--write" ping-pong). Biome also ships as a single Rust binary: it is an order of
magnitude faster than the ESLint/Prettier Node pair, and `--write` gives
`--fix`-style autofixing for both concerns.

This is a deliberate maintenance posture, and CI reflects it honestly:
`typecheck` and `test` are hard gates (`ci.yml:28`, `ci.yml:38`), while lint and
format are run with `continue-on-error: true` (`ci.yml:30-36`). That says: the
compiler and the tests decide whether the build is correct; Biome is a hygiene
layer that catches issues without blocking the pipeline. That is a reasonable
trade for a library where correctness is numerical (tests) rather than
stylistic.

## Why the release workflow is shaped this way

`.github/workflows/release.yml` is triggered by tags (`release.yml:3-6`) and does
five things in order:

1. **Sync the version from the tag** — `npm version ${GITHUB_REF_NAME#v}
   --no-git-tag-version --allow-same-version` (`release.yml:26`). The tag is the
   single source of truth for the version; the local `package.json` is aligned
   to it without creating another git tag. `--allow-same-version` makes the step
   a no-op when they already match.
2. **Build** — `npm run build` (`release.yml:28`), the tsup + tsc pipeline above.
3. **Publish with provenance** — `npm publish --provenance` (`release.yml:30`),
   backed by `publishConfig.provenance: true` (`package.json:41`). Provenance
   attestations require the `id-token: write` permission on the job
   (`release.yml:12`) — that permission is scoped to the job, not the repo, and
   is exactly why the OIDC token flow works. Combined with `access: public`
   (`package.json:40`), this is the trust story for a zero-dependency package:
   the published tarball can be linked to the exact build that produced it.
4. **Commit the version bump back to main** (`release.yml:34-45`) with a
   `[skip ci]` marker, so the tag and the manifest never drift apart — a step
   whose history shows real iteration in the git log ("fix(release): commit
   version bump back to main", `fix(release): ... without detaching`).
5. **Create a GitHub Release** via `softprops/action-gh-release` with generated
   release notes (`release.yml:47-50`).

CI (`ci.yml`) is the pre-release gate: a Node 22/23 matrix runs typecheck, lint,
format, tests, and a build on every push/PR to `main` (`ci.yml:3-7,14-40`). The
matrix across two Node majors exists because the package declares `engines.node
>= 18` (`package.json:36-38`) but the modern features it ships deserve
verification on current runtimes — and a build failure here means no release
can ever be produced, since the release job runs the same build on Node 22
(`release.yml:20`).

One accuracy note: the manifest pins `"typescript": "^7.0.2"`
(`package.json:83`) — the current-generation native TypeScript compiler — which
is consistent with the "zero-config, fast, modern-runtime" posture the rest of
the toolchain takes. The tooling is uniformly chosen for one property: *least
moving parts that still produce compiler-verified output*.
