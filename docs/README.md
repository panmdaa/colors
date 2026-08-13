# @panmdaa/colors — Documentation

This directory documents the internal workings of `@panmdaa/colors`: what each
layer does, how it works, why it is designed that way, and why the project
chose these technologies over the alternatives.

## How to read this documentation

Start with the architecture overview to understand the big picture, then dive
into whichever layer interests you. Every doc references the real source code
(`file.ts:line`), so keep the `src/` tree open.

## The system in one paragraph

`@panmdaa/colors` turns a single seed color into a complete, accessible design
system theme (53 color roles × light/dark). The seed is converted into the HCT
color space (a perceptual model built on CAM16), fed into a `DynamicScheme`
that applies one of 10 theme variants, and resolved into concrete colors by a
declarative token/spec layer. On top sit ergonomic utilities: WCAG contrast
scoring with color-blindness simulation, custom token extension, CSS custom
property generation, gradient interpolation, and image-based seed extraction.

## Documentation tree

### Architecture & decisions

| Doc | Covers |
|-----|--------|
| [architecture/overview](architecture/overview.md) | The layered architecture and why each layer exists |
| [architecture/data-flow](architecture/data-flow.md) | The journey of a seed color from hex to full theme |
| [architecture/directory-structure](architecture/directory-structure.md) | Walkthrough of every directory in `src/` |
| [decisions/why-zero-dependencies](decisions/why-zero-dependencies.md) | Why the package ships with zero runtime deps |
| [decisions/why-typescript](decisions/why-typescript.md) | TypeScript strict, ESM-only, tree-shaking choices |
| [decisions/why-derived-from-material](decisions/why-derived-from-material.md) | Origins in Material Color Utilities and what changed |
| [decisions/why-tooling](decisions/why-tooling.md) | tsup, Vitest, Biome — the build/test/lint pipeline |

### Color science core

| Doc | Covers |
|-----|--------|
| [color-science/overview](color-science/overview.md) | The HCT pipeline: RGB ↔ HCT forward/inverse flow |
| [color-science/hct](color-science/hct.md) | The HCT color space and why not HSL/OKLCH |
| [color-science/cam16](color-science/cam16.md) | The CAM16 color appearance model and viewing conditions |
| [color-science/hct-solver](color-science/hct-solver.md) | The bidirectional gamut solver |
| [color-science/formats](color-science/formats.md) | ARGB ↔ hex conversions, sRGB linearization |

### Scheme generation

| Doc | Covers |
|-----|--------|
| [scheme/overview](scheme/overview.md) | The DynamicScheme architecture |
| [scheme/dynamic-color](scheme/dynamic-color.md) | How a role resolves its final tone and palette |
| [scheme/contrast-curve](scheme/contrast-curve.md) | Piecewise tone curves over contrast level |
| [scheme/tone-delta-pair](scheme/tone-delta-pair.md) | Paired roles with guaranteed tonal deltas |
| [scheme/color-roles](scheme/color-roles.md) | Wiring primary/secondary/tertiary/neutral roles |
| [scheme/variants](scheme/variants.md) | The 10 theme variants and their rationale |
| [scheme/dynamic-scheme-usage](scheme/dynamic-scheme-usage.md) | How the library instantiates schemes |

### Token & spec layer

| Doc | Covers |
|-----|--------|
| [tokens/overview](tokens/overview.md) | Why tokens, palettes and calculation are separated |
| [tokens/tokens](tokens/tokens.md) | The token specification (53 roles) |
| [tokens/palettes](tokens/palettes.md) | Palette specs per variant and tone mapping |
| [tokens/color-calculation](tokens/color-calculation.md) | The engine combining tokens + palettes |
| [tokens/token-utils](tokens/token-utils.md) | Token helpers and the public `Palette` contract |

### Public API

| Doc | Covers |
|-----|--------|
| [api/overview](api/overview.md) | Map of the exported API surface |
| [api/palette](api/palette.md) | `palette()` end-to-end theme generation |
| [api/color-manipulation](api/color-manipulation.md) | Per-channel HCT editing, `mix`, `tone`, `onColor` |
| [api/contrast](api/contrast.md) | Contrast scores, WCAG thresholds, scoring math |
| [api/palette-checker](api/palette-checker.md) | `paletteChecker` and `report` audits |
| [api/css-generation](api/css-generation.md) | `generateCSS` and `generateCSSSheet` |
| [api/image](api/image.md) | `fromImage` seed extraction |

### Science & accessibility

| Doc | Covers |
|-----|--------|
| [science/overview](science/overview.md) | The science layer at a glance |
| [science/color-blindness](science/color-blindness.md) | Machado 2009 CVD simulation |
| [science/contrast](science/contrast.md) | WCAG ratio math and tone-based contrast |
| [science/temperature](science/temperature.md) | The warm/cool temperature model |
| [science/blend](science/blend.md) | `harmonize` and blending in CAM16 |
| [science/dislike-analyzer](science/dislike-analyzer.md) | The disliked hue zone and fix |
| [science/score](science/score.md) | Seed color selection scoring |
| [science/image](science/image.md) | Image sampling and dominant color extraction |

### Quantization

| Doc | Covers |
|-----|--------|
| [quantize/overview](quantize/overview.md) | Why image quantization and the two-algorithm design |
| [quantize/quantizer-wu](quantize/quantizer-wu.md) | The Wu 3D-histogram variance split |
| [quantize/quantizer-wsmeans](quantize/quantizer-wsmeans.md) | k-means in CAM16 with `LabPointProvider` |
| [quantize/quantizer-celebi](quantize/quantizer-celebi.md) | Wu → WSMeans composition |
| [quantize/quantizer-map](quantize/quantizer-map.md) | Exact-count histogram |

---

Crafted with ❤️ by the Panmdaa project.
