# Why Derived From Material Color Utilities (and Refactored Into This)

## Table of Contents

- [The provenance](#the-provenance)
- [What was kept](#what-was-kept)
- [What was removed](#what-was-removed)
- [What was added](#what-was-added)
- [Why this beats using MCU directly](#why-this-beats-using-mcu-directly)
- [Why not culori / chroma-js / tinycolor2 / Radix Colors](#why-not-culori--chroma-js--tinycolor2--radix-colors)
- [License honesty](#license-honesty)

## The provenance

Every source file carries the derivation explicitly:

```ts
// src/index.ts:1-10
 * Copyright 2021 Google LLC
 * Copyright 2026 Panmdaa
 *
 * Derived from Material Color Utilities.
 * Modified and maintained by the Panmdaa project.
 *
 * SPDX-License-Identifier: Apache-2.0
```

The README's Origins section tells the story directly: the library "originated
from Google's Material Color Utilities project and preserves its underlying
color science (HCT, CAM16, dynamic color algorithms, quantization, etc.)", then
was "substantially refactored and evolved", removing "legacy compatibility
layers, version-specific branches, and internal abstractions in favor of a
unified architecture with a stable, developer-oriented API"
(`README.md:475-481`).

So the derivation is three-fold:

1. **Legal**: Apache-2.0 code can be reused and modified with attribution, which
   is exactly what the headers do.
2. **Scientific**: the HCT/CAM16/dynamic-color/quantization math is preserved
   (byte-for-byte in many places — `src/utils/contrast.ts:12-15` even keeps MCU's
   "class as a namespace" design note verbatim).
3. **Product**: everything around that science was rebuilt for developers, not
   for Google's internal Material Design tooling.

## What was kept

The parts that are genuinely hard and expensive to get right were kept intact:

- **HCT and CAM16** — `src/hct/cam16.ts` (the CAM16 color appearance model),
  `src/hct/hct-solver.ts` (the ~500-line gamut solver with its `CRITICAL_PLANES`
  table, `src/hct/hct-solver.ts:49+`), `src/hct/hct.ts`, and
  `src/hct/viewing-conditions.ts`. These files are marked "automatically
  generated. Do not modify it." (`src/hct/hct-solver.ts:12`).
- **Dynamic color** — the `DynamicColor`/`DynamicScheme` model
  (`src/scheme/`), including the contrast-curve and tone-delta constraint system
  that guarantees WCAG ratios.
- **Quantizers** — the Wu + Wsmeans pipeline (`src/quantize/`), which is Celebi's
  algorithm (`src/quantize/quantizer-celebi.ts:16-24`).
- **Supporting science** — `DislikeAnalyzer`, `TemperatureCache`, `Blend`,
  `Score`, and the color-space math in `src/utils/color.ts`.

The design philosophy survives too. `DynamicColor`'s comment explaining why
functional arguments beat subclassing ("arguably too flexible to ensure it can
support any scenario", `src/scheme/dynamic-color.ts:103-114`) is kept verbatim,
because the reasoning is still the design's foundation.

## What was removed

The refactor was a deletion exercise as much as a rewrite:

- **Version-specific branches.** MCU's published packages carried per-version
  API variations. This project has one `Variant` enum (`src/scheme/variant.ts:17-28`)
  and one spec, reported as `spec=2026` by `DynamicScheme.toString()`
  (`src/scheme/dynamic-scheme.ts:228`).
- **Legacy compatibility layers.** The old platforms (Java, Dart, Swift, C++)
  and their porting shims are gone. The TypeScript implementation was trimmed to
  a single source of truth.
- **Internal abstractions that did not earn their keep.** The `Scheme*`
  subclasses were flattened to thin constructors (`src/scheme/variants.ts`) and
  the real per-variant behavior centralized in `src/spec/palettes.ts` — one
  `switch` per palette instead of a class per variant. The result is that the
  entire variant vocabulary is readable in a few hundred lines.
- **The awkward public surface.** MCU exposes internals like `DynamicColor` and
  `SchemeTonalSpot` as the primary API; none of that is exported from
  `src/index.ts:12-15`. Consumers see only `palette`, `contrastChecker`,
  `report`, `mix`, `gradient`, `hct`, and friends.

## What was added

Everything that did not exist in MCU and that the README lists as a
differentiator (`README.md:483-489`):

- **A single unified entry point.** `palette(color, { variant, contrastLevel,
  extraColors })` (`src/color.ts:370-393`) replaces the per-scheme-class
  workflow. Ten variants as kebab-case strings (`src/types.ts:80-90`).
- **Custom tokens (`extraColors`).** Brand colors, palette-key references,
  adjusted colors, harmonized colors, random colors, blends, and gradients —
  all resolvable per-mode, with auto-generated `on-{name}` foregrounds
  (`src/extend-theme.ts:114-159`, `src/extend-theme.ts:28-32`). MCU has nothing
  equivalent.
- **Accessibility as a feature, not a byproduct.** `contrastChecker`
  (`src/color.ts:194-210`) scores pairs 0-10 with a logarithmic scale
  (`src/color.ts:169-172`), `paletteChecker` (`src/color.ts:313-336`) audits
  every `on-*` pair in a theme, and `report` (`src/report.ts:58-83`) produces a
  WCAG report. None of these exist in MCU.
- **CVD-simulated contrast.** `simulateCVD` uses the Machado (2009) model with
  inline matrices (`src/science/color-blindness.ts:25-63`) — the same algorithm
  Chrome DevTools uses (`README.md:261`, `README.md:329`). MCU has no color
  blindness support at all. `contrastChecker` and `paletteChecker` apply it to
  contrast scoring.
- **CSS generation.** `generateCSS` (`src/css-props.ts:19-30`) and
  `generateCSSSheet` (`src/css-sheet.ts:33-68`) turn a theme into custom
  properties or a light/dark stylesheet.
- **Color editing ergonomics.** `getHue`/`setTone`/`lighten`/`mix`/`gradient`/
  `onColor`/`harmonize`/`fixDisliked`/`fromImage` (`src/color.ts`, `src/gradient.ts`)
  wrap the science in a tiny, familiar API.
- **New science.** `mix` circular-averages hue in HCT space (`src/color.ts:338-362`),
  and `gradient` interpolates in HCT (`src/gradient.ts:16-33`). `onColor`
  guarantees a >= 4.5:1 foreground at the same hue/chroma
  (`src/color.ts:148-155`).

## Why this beats using MCU directly

**Because MCU's API is the wrong shape for a product, and this project keeps the
science while replacing the shape.**

- MCU makes you instantiate classes and know the object graph
  (`SchemeTonalSpot`, `DynamicColor.fromPalette`). This project gives you one
  function call and a plain `Theme` object with `light`/`dark` palettes
  (`README.md:75-113`).
- MCU's type surface is spread across dozens of modules; this project exports a
  single entry (`src/index.ts:12-15`) with branded types (`ColorValue`,
  `src/types.ts:12`).
- MCU has no contrast scoring, no CVD simulation, no CSS output, no custom
  tokens, no gradient helpers. Each of those is a feature this project adds
  without pulling in a second library.
- **Maintenance.** The spec layer's delegate pattern
  (`src/spec/color-calculation.ts:23-27`, `getSpec()` at
  `src/spec/color-calculation.ts:208-210`) means this project can track Material
  Design spec changes (the documented spec is 2026) by editing token tables,
  not by re-porting the whole upstream codebase.

The strongest evidence is the inverse test: `@material/material-color-utilities`
was kept around precisely to be compared against, and it cannot even be
benchmarked — its internal imports are missing `.js` extensions and the package
fails to load in Node and Vitest (`bench/theme.bench.ts:5-8`). The dependency's
own packaging is a reason a maintained fork/derivative is more usable than the
upstream. (The benchmark subproject in `bench/` carries only the libs that
actually load: `chroma-js` and `culori`.)

## Why not culori / chroma-js / tinycolor2 / Radix Colors

| Library | What it does well | Why it is not the answer here |
|---------|-------------------|-------------------------------|
| **culori** | Excellent general color space conversions and interpolation (`wcagContrast` is used in `bench/contrast.bench.ts:5`) | No HCT, no dynamic theme generation, no design-system roles, no contrast scoring with CVD, no CSS emission. It is a toolbox, not a design-system generator. |
| **chroma-js** | Mature, ubiquitous color manipulation and contrast (`bench/color.bench.ts:16`) | Same gap: no HCT/dynamic color, no theming. Also a single monolithic class API that cannot express the role graph. |
| **tinycolor2** | Tiny footprint, simple string manipulation | Even more limited: no color appearance model, no contrast math beyond ratios, no theming. Not referenced anywhere in `bench/` or `test/`. |
| **Radix Colors** | Beautiful pre-baked light/dark UI scales (`README.md:488`) | Static. There is no HCT, no seed-color generation, no programmatic color science. You cannot ask it to generate a theme from `#744c9d`. |
| **@material/material-color-utilities** | The exact color science this project is built on | The API is for Google's internal use, lacks the ergonomic surface, and ships broken ESM (`bench/theme.bench.ts:5-8`). |

The README condenses the positioning: this library is "the only library that
combines HCT color science, full design system theme generation, custom token
extensibility, contrast scores with CVD simulation, palette-wide accessibility
checks, and image quantization in a single tree-shakeable zero-dependency
package" (`README.md:485`). Each competitor covers one slice; the derivation
from MCU is what made covering all of them on top of correct color science
feasible instead of heroic.

## License honesty

The derivation is not cosmetic. All kept science files carry both copyrights and
the Apache-2.0 SPDX identifier, and the project license is Apache-2.0
(`package.json:6`). The new files — notably the CVD implementation, whose header
is Copyright 2026 Panmdaa only (`src/science/color-blindness.ts:1-13`) — are
genuinely original work layered on the compatible base. That is the correct way
to build on a permissive, attribution-requiring foundation.
