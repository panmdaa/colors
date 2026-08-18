# Why Zero Runtime Dependencies

## Table of Contents

- [The claim](#the-claim)
- [What "zero dependencies" actually means here](#what-zero-dependencies-actually-means-here)
- [The bundle size story](#the-bundle-size-story)
- [What replaced what](#what-replaced-what)
- [The tradeoffs](#the-tradeoffs)
- [How other libraries compare](#how-other-libraries-compare)
- [The verdict](#the-verdict)

## The claim

The package's own description is the pitch:

```json
// package.json:5
"description": "HCT color space, Material Design 3 dynamic themes, WCAG contrast utilities — zero dependencies"
```

And it is verified by the manifest: `package.json` has **zero entries under
`"dependencies"`** (the whole file has only `devDependencies`, `package.json:75-86`).
The README repeats it as the headline and lists "tree-shakeable zero-dependency
package" as the first differentiator (`README.md:485`).

## What "zero dependencies" actually means here

Two separate claims are being made, and both hold:

1. **No runtime dependency** — `npm install @panmdaa/colors` pulls in nothing.
   Your node_modules does not grow a tree of transitive packages, and a bundler
   has nothing external to resolve, trace, or worry about.
2. **No peer dependency either** — there is no `react`, no DOM library, nothing
   you must provide. The only environment assumption is `node >= 18`
   (`package.json:36-38`) and, for `fromImage`, a browser DOM.

What the library *does* have is a rich set of **devDependencies**
(`package.json:75-82`) — TypeScript, Vitest, tsup, Biome, and `@types/node`.
Those exist to build, test, and lint the library itself; they are never bundled
and never shipped. The benchmark suite lives in its own subproject
(`bench/package.json`) with the comparison libraries (`chroma-js`, `culori`) as
its own devDependencies, so nothing benchmark-only leaks into the library's
dependency tree. The published tarball (`package.json:61-66`,
`files: ["dist", "misc", "LICENSE", "README.md"]`) contains no third-party code.

## The bundle size story

The README leads with bundlephobia badges (`README.md:13-18`):

```markdown
<a href="https://bundlephobia.com/result?p=@panmdaa/colors">
  <img src="https://img.shields.io/bundlephobia/min/@panmdaa/colors" alt="Bundle Size" />
</a>
<a href="https://bundlephobia.com/result?p=@panmdaa/colors">
  <img src="https://img.shields.io/bundlephobia/minzip/@panmdaa/colors" alt="Bundle Size (gzip)" />
</a>
```

That badge measures minified and min+gzipped sizes. The zero-dependency choice
is what makes those numbers meaningful: a single self-contained ESM bundle
(`tsup.config.ts:3-11` emits one minified ESM file) has no shared chunking, no
vendor duplication, and a gzip payload dominated entirely by this library's own
math. Compare that to pulling a general-purpose color library just to compute
contrast — you pay for dozens of color spaces and conversions you never touch.

## What replaced what

The library reimplements, in `src/`, everything that would otherwise arrive as
a runtime dependency. This is the "do not invent APIs" part of the story — the
implementations exist, and here is where:

| Would-be dependency | What would be imported | Internal replacement |
|---------------------|------------------------|----------------------|
| `@material/material-color-utilities` | HCT, CAM16, DynamicColor, quantizers | `src/hct/` (Cam16, HctSolver, ViewingConditions), `src/scheme/`, `src/quantize/` |
| `chroma-js` / `culori` | color parsing, conversions, interpolation | `src/utils/color.ts` (ARGB↔XYZ↔Lab↔L*), `src/utils/string.ts` (hex parsing), `src/gradient.ts`, `src/color.ts` `mix` |
| WCAG contrast libs | `wcagContrast` (culori) or `chroma.contrast()` | `src/utils/contrast.ts` (`ratioOfTones`, `lighter`, `darker`) |
| color-blindness libs | CVD simulation | `src/science/color-blindness.ts` — Machado matrices inlined (`src/science/color-blindness.ts:25-63`) |
| image quantization | — | `src/quantize/` (Wu, Wsmeans, Celebi) |

The clearest example is CVD simulation. Chrome DevTools uses the Machado (2009)
model; this library hardcodes the matrices directly into the source as constants
instead of shipping a dependency:

```ts
// src/science/color-blindness.ts:25-41
const CVD_MATRICES: Record<ColorVisionDeficiency, number[][]> = {
	protanopia: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	// ...
};
```

Contrast is likewise a pure function of two tones, implemented locally:

```ts
// src/utils/contrast.ts:39-49
ratioOfTones(toneA: number, toneB: number): number {
	toneA = clampDouble(0.0, 100.0, toneA);
	toneB = clampDouble(0.0, 100.0, toneB);
	return Contrast.ratioOfYs(yFromLstar(toneA), yFromLstar(toneB));
},
```

These are small, stable, well-understood algorithms. Depending on an external
package for them would add installation weight, version churn, and API
uncertainty without adding any capability.

## The tradeoffs

Zero dependencies is not free. Being honest about the costs:

**What you give up:**

- **Maintenance surface.** The library now owns CAM16, the HCT solver, the
  quantizers, and the contrast math. Bugs in those are bugs in *this* repo, not
  upstream. The HCT solver alone is ~500 lines of generated numerical code
  (`src/hct/hct-solver.ts:34-497`).
- **Proven ecosystem review.** `chroma-js` and `culori` are battle-tested by
  thousands of projects. The reimplemented pieces here are validated by the
  test suite (`test/correctness/`, ~99 test cases in `test/`) but they do not
  have the same external scrutiny budget.
- **Feature ceiling.** A general-purpose color library like `culori` exposes
  dozens of color spaces and conversions; this project only implements what it
  needs, so you cannot call `culori`'s XYZ-cam02 conversion on it.

**What you get back:**

- **Deterministic, tiny installs** — no resolution order, no hoisting surprises,
  no supply-chain surface for a color utility.
- **Predictable performance** — the code is right there; you can read
  `TonalPalette`'s memoization (`src/palette/tonal-palette.ts:19`) or
  `DynamicScheme`'s role cache (`src/scheme/dynamic-scheme.ts:299-310`) without
  guessing at a dependency's internals.
- **Complete control over correctness guarantees** — the library can make
  statements like "every on-* pair passes AA by construction" because it
  controls the contrast math and the palette generation end to end.

## How other libraries compare

| Library | Runtime deps | Gap this project fills |
|---------|--------------|------------------------|
| `@material/material-color-utilities` | none (modular) | Reference implementation; API designed for internal Material usage, lacks `palette()`, `onColor()`, `report()`, CSS generation (`README.md:486`) |
| `chroma-js` | none (single file) | General-purpose color math; no theme generation from a seed, no HCT (`README.md:487`) |
| `culori` | none | Interpolation and conversions; no design-system theme generation (`README.md:487`) |
| `tinycolor2` | none | Tiny color manipulation; no HCT, no contrast scoring, no theming |
| `radix-ui/colors` | none | Pre-baked light/dark scales; static, no HCT, no programmatic generation (`README.md:488`) |

Note that several competitors are *also* zero-dependency — so "zero deps" is
necessary but not sufficient. The real differentiator is combining that property
with HCT + dynamic theme generation + CVD-aware contrast in a single package
(`README.md:485`).

There is a wrinkle worth flagging: `tinycolor2` used to sit in
`devDependencies` but is not referenced anywhere in `bench/` or `test/`. It
appears to have been listed for comparison purposes but was unused, so it was
dropped when the benchmarks moved to their own subproject. `chroma-js` and
`culori` are imported by the benchmark suite (`bench/contrast.bench.ts:5-6`,
`bench/color.bench.ts:15-16`) and now live in `bench/package.json`.

Also note: `@material/material-color-utilities` cannot even be benchmarked —
its internal imports are missing `.js` extensions, making the package unloadable
in Node/Vitest, as documented in `bench/theme.bench.ts:5-8`.

## The verdict

The decision is coherent with the product: this library sells *guaranteed,
perceptually-correct design systems*. That guarantee depends on owning the full
pipeline from seed color to contrast check, and a dependency boundary anywhere
in that pipeline would make the guarantee conditional on someone else's math.
The cost — owning ~7k lines of color science across `src/`
(see [directory-structure.md](../architecture/directory-structure.md)) — is the
price of that control, and it is a price the benchmarks suggest is worth paying.
