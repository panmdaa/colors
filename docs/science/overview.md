# Science Layer Overview

- [What the science layer is](#what-the-science-layer-is)
- [Module layout](#module-layout)
- [The seven helpers](#the-seven-helpers)
  - [Blend](#blend)
  - [DislikeAnalyzer](#dislikeanalyzer)
  - [CVD simulation](#cvd-simulation)
  - [TemperatureCache](#temperaturecache)
  - [Score](#score)
  - [Image extraction](#image-extraction)
  - [Contrast](#contrast)
- [How the science layer is consumed](#how-the-science-layer-is-consumed)
- [Mapping: internal helper to public function](#mapping-internal-helper-to-public-function)
- [Design notes](#design-notes)

## What the science layer is

`src/science/` is the home of the perceptual algorithms that do not belong to
the color space machinery itself. The `hct/` module answers "what are the
HCT coordinates of this color"; the `science/` module answers questions like
"how close are these two hues", "is this color universally disliked",
"what would a deuteranope see", "what is the dominant color of an image", and
"which of these candidates makes the best theme seed".

It is deliberately thin: each file is either a namespace object (`Blend`,
`DislikeAnalyzer`, `Score`), a class (`TemperatureCache`), or a pair of
functions (`simulateCVD` / `simulateAllCVD`, `sourceColorFromImage` /
`sourceColorFromImageBytes`). Everything is exported through a single barrel
(`src/science/index.ts`) and everything it imports comes from `hct/`, `utils/`,
or `quantize/` — never the reverse. The science layer sits on top of the color
spaces and below the public API in `color.ts`.

## Module layout

| File | Exports | Shape |
| ---- | ------- | ----- |
| `blend.ts` | `Blend` (`harmonize`, `hctHue`, `cam16Ucs`) | namespace object |
| `dislike-analyzer.ts` | `DislikeAnalyzer` (`isDisliked`, `fixIfDisliked`) | namespace object |
| `color-blindness.ts` | `simulateCVD`, `simulateAllCVD` | functions |
| `temperature.ts` | `TemperatureCache` | class |
| `score.ts` | `Score` (`score`) | namespace object |
| `image.ts` | `sourceColorFromImage`, `sourceColorFromImageBytes` | functions |
| `index.ts` | re-exports all of the above | barrel |

`contrast.ts` lives in `src/utils/` rather than `src/science/`, but it is part
of the same conceptual layer: the WCAG contrast ratio is a perceptual quantity
computed from relative luminance. It is grouped with the pure math/string
utilities because it has no dependency on the HCT module — `ratioOfTones`
operates on raw tone numbers, not `Hct` instances.

## The seven helpers

### Blend

`Blend` (`blend.ts:28`) contains three operations in HCT and CAM16 spaces:

- `Blend.harmonize(designColor, sourceColor)` (`blend.ts:40`) rotates the
  design color's *hue* toward the source color's hue while keeping chroma and
  tone untouched.
- `Blend.hctHue(from, to, amount)` (`blend.ts:61`) blends hue toward another
  color, keeping the original color's chroma and tone.
- `Blend.cam16Ucs(from, to, amount)` (`blend.ts:78`) interpolates linearly in
  CAM16-UCS (`J*`, `a*`, `b*`), the perceptually uniform subset of CAM16.

### DislikeAnalyzer

`DislikeAnalyzer` (`dislike-analyzer.ts:28`) encodes a single, surprising fact
about human color psychology: dark yellow-greens are almost universally
disliked, an effect correlated with distaste for biological waste and rotting
food (see the module doc comment, `dislike-analyzer.ts:19-27`, citing Palmer &
Schloss 2010). It answers "is this color in the disliked zone"
(`isDisliked`, `dislike-analyzer.ts:37`) and "make it acceptable"
(`fixIfDisliked`, `dislike-analyzer.ts:52`).

### CVD simulation

`color-blindness.ts` implements the Machado (2009) physiologically-based model
for color vision deficiency simulation, using the pre-computed transformation
matrices from Machado (2010). Three deficiencies (`protanopia`,
`deuteranopia`, `tritanopia`) each have a full-severity matrix
(`CVD_MATRICES`, `color-blindness.ts:25`) and a mild-severity matrix
(`CVD_MATRICES_MILD`, `color-blindness.ts:47`). The same algorithm powers
Chrome DevTools' "Emulate vision deficiencies".

### TemperatureCache

`TemperatureCache` (`temperature.ts:23`) is a lazy cache around a perceptual
warm/cool measure. `rawTemperature` (`temperature.ts:282`) implements the
Ou, Woodcock & Wright algorithm on `L*a*b*` coordinates; the cache then
computes relative temperature, warmest/coldest colors, analogous colors, and a
complement (`analogous`, `temperature.ts:65`; `complement`, `temperature.ts:156`).

### Score

`Score` (`score.ts:53`) ranks a set of candidate colors by suitability as a
UI-theme seed. It weights usage proportion and chroma, filters out grays and
rarely-used hues, and greedily selects up to `desired` colors that are
maximally separated in hue (`score.ts:74`). It is the final "taste" step that
turns a large quantizer output into a small curated set.

### Image extraction

`image.ts` turns an `HTMLImageElement` or raw RGBA bytes into a seed color.
It samples pixels through a 2D canvas, drops transparent pixels, quantizes with
`QuantizerCelebi`, and lets `Score` pick the winner
(`sourceColorFromImageBytes`, `image.ts:66`).

### Contrast

`Contrast` (`utils/contrast.ts:32`) computes the WCAG contrast ratio between
two tones and finds tones that satisfy a target ratio
(`ratioOfTones`, `lighter`/`darker`, `lighterUnsafe`/`darkerUnsafe`). It is the
accessibility backbone: theme role tones, `onColor`, and both contrast checkers
all build on it.

## How the science layer is consumed

- `src/color.ts` — the main public API — imports `sourceColorFromImage`,
  `Blend`, `DislikeAnalyzer`, `simulateCVD` from the science barrel
  (`color.ts:13`), plus `Contrast` from `utils/` (`color.ts:12`).
- `src/extend-theme.ts` imports `Blend` to implement the `harmonize` option of
  custom tokens (`extend-theme.ts:15`, used at `extend-theme.ts:96`).
- `src/spec/palettes.ts` imports `DislikeAnalyzer` and `TemperatureCache` to
  build the tertiary palettes of the `content` and `fidelity` variants
  (`palettes.ts:189`, `palettes.ts:198`).
- `src/scheme/dynamic-color.ts` and `src/spec/color-calculation.ts` import
  `Contrast` to resolve role tones against a target contrast ratio.
- `src/report.ts` imports `Contrast` for its lightweight pass/fail report.

`simulateCVD` and `simulateAllCVD` are re-exported from the package root
(`color.ts:20`), making them the only science-layer functions that surface
directly on the public API besides the thin wrappers in `color.ts`.

## Mapping: internal helper to public function

| Internal helper | Source | Public function | Consumed by |
| --------------- | ------ | --------------- | ----------- |
| `Blend.harmonize` | `blend.ts:40` | `harmonize(design, source)` | `color.ts:122`; `extraColors` `harmonize` option via `resolveOne`, `extend-theme.ts:94-98` |
| `DislikeAnalyzer.isDisliked` | `dislike-analyzer.ts:37` | `isDisliked(color)` | `color.ts:130` |
| `DislikeAnalyzer.fixIfDisliked` | `dislike-analyzer.ts:52` | `fixDisliked(color)` | `color.ts:126`; tertiary palettes for `content`/`fidelity`, `palettes.ts:189`, `palettes.ts:198` |
| `simulateCVD` | `color-blindness.ts:111` | re-exported directly | `color.ts:20`; CVD branch of `contrastChecker` `color.ts:202-203`; `paletteChecker` simulation `color.ts:217-218` |
| `simulateAllCVD` | `color-blindness.ts:131` | re-exported directly | `color.ts:20` |
| `sourceColorFromImage` | `image.ts:23` | `fromImage(image)` | `color.ts:31-33` |
| `sourceColorFromImageBytes` | `image.ts:66` | (internal; used by `sourceColorFromImage`) | `image.ts:57` |
| `Score.score` | `score.ts:74` | (internal) | `image.ts:83` |
| `TemperatureCache` | `temperature.ts:23` | (internal) | `palettes.ts:190`, `palettes.ts:198` |
| `Contrast.ratioOfTones` | `utils/contrast.ts:39` | `onColor`/`underColor`; `contrastChecker`; `paletteChecker`; `report` | `color.ts:152-153`, `color.ts:197`, `color.ts:246`, `report.ts:40`, `spec/color-calculation.ts:117-183`, `scheme/dynamic-color.ts:243-246` |
| `Contrast.lighterUnsafe` / `darkerUnsafe` | `utils/contrast.ts:130`, `utils/contrast.ts:149` | `onColor`/`underColor` | `color.ts:152-153`; `scheme/dynamic-color.ts:243-244` |

Notes on the table:

- `Blend.hctHue` and `Blend.cam16Ucs` are exported from the barrel but have no
  consumer in the current public API. `hctHue` uses `cam16Ucs` internally
  (`blend.ts:62`), so the CAM16-UCS path is reachable, but it is only useful to
  library consumers who import from `src/science` directly.
- `Score` and `TemperatureCache` are internal to the package: they are exported
  from the science barrel but not from the package root `index.ts`. `Score` is
  consumed by the image pipeline; `TemperatureCache` by the `spec/` layer.

## Design notes

- **Everything speaks ARGB internally.** The science functions take and return
  32-bit integers (`designColor: number`, `sourceColor: number` in
  `Blend.harmonize`), which is why the public wrappers in `color.ts` always
  convert with `toNumber`/`fromNumber` around them. The two exceptions are the
  image functions — which operate on pixels and bytes — and `simulateCVD`,
  which accepts a `ColorValue` hex string directly.
- **Namespaces, not classes.** `Blend`, `DislikeAnalyzer`, and `Score` are
  plain `export const ... = { ... }` objects, following the upstream
  Material Color Utilities convention described in `blend.ts:20-22`. This keeps
  the API stateless and trivially tree-shakeable.
- **One step per layer.** The image pipeline is a textbook composition:
  sampling (`image.ts`) feeds quantization (`quantize/`), which feeds scoring
  (`score.ts`), which produces a seed for theme generation (`scheme/`). Each
  layer stays swappable because it only depends on the previous layer's output
  shape.

Related: [color-blindness](./color-blindness.md), [contrast](./contrast.md),
[temperature](./temperature.md), [blend](./blend.md),
[dislike-analyzer](./dislike-analyzer.md), [score](./score.md),
[image](./image.md).
