# Directory Structure

## Table of Contents

- [Top level](#top-level)
- [`src/hct/` — the HCT color space](#srchct--the-hct-color-space)
- [`src/palette/` — tonal palettes](#srcpalette--tonal-palettes)
- [`src/scheme/` — dynamic color schemes](#srcscheme--dynamic-color-schemes)
- [`src/spec/` — Material Design token specifications](#srcspec--material-design-token-specifications)
- [`src/science/` — standalone color science](#srcscience--standalone-color-science)
- [`src/quantize/` — image quantization](#srcquantize--image-quantization)
- [`src/utils/` — shared math and conversions](#srcutils--shared-math-and-conversions)
- [Root files](#root-files)

Every module under `src/` carries the same license header: Apache-2.0,
Copyright 2021 Google LLC and 2026 Panmdaa, derived from Material Color
Utilities. The dependency rule is strict: a layer may only import from itself
and from layers below it (see [overview.md](./overview.md)).

## Top level

```
src/
├── index.ts          Public entry point (re-exports only)
├── color.ts          Public API: palette, contrast, color editing
├── extend-theme.ts   extraColors / custom token resolution
├── gradient.ts       HCT gradient interpolation
├── css-props.ts      Theme → CSS custom properties
├── css-sheet.ts      Theme → full light/dark stylesheet
├── report.ts         WCAG contrast report for on-* pairs
├── types.ts          Shared public types
├── hct/              HCT color space (CAM16, solver, viewing conditions)
├── palette/          TonalPalette
├── scheme/           DynamicScheme, DynamicColor, variants
├── spec/             Token tables, palette specs, color calculation
├── science/          Blend, dislike, temperature, score, CVD
├── quantize/         Image quantization (Wu, Celebi, Wsmeans)
└── utils/            Math, color conversion, contrast, strings
```

## `src/hct/` — the HCT color space

**Responsibility:** the perceptually-uniform HCT color space and its machinery.
Feeds everything: palettes, schemes, specs, science, quantization, and every
public helper that reads or writes hue/chroma/tone.

| File | What it contains |
|------|------------------|
| `hct.ts` | The `Hct` class: `fromInt`, `from`, `argbFrom`, `toInt`, per-channel setters, `inViewingConditions`, hue-range helpers `isBlue`/`isYellow`/`isCyan` |
| `cam16.ts` | The CAM16 color appearance model (`Cam16`) plus CAM16-UCS coordinates (`jstar`/`astar`/`bstar`) and `distance` |
| `hct-solver.ts` | `HctSolver`: the binary search that maps `(hue, chroma, tone)` to an in-gamut ARGB int |
| `viewing-conditions.ts` | `ViewingConditions`, default and `make()`, for appearance under different environments |
| `index.ts` | Re-exports the four files |

Key relationships: `Hct` is constructed from `Cam16` for hue/chroma and CIELAB
`L*` for tone (`src/hct/hct.ts:138-144`), and delegates all gamut mapping to
`HctSolver.solveToInt` (`src/hct/hct.ts:53-59`). `Cam16` in turn depends only on
`ViewingConditions` and `src/utils` (`src/hct/cam16.ts:12-13`).

Why it exists: HCT is the substrate for the entire library — its tone channel is
linear to human perception, which is exactly what makes tone-based contrast
guarantees ("a difference of 50 in tone guarantees ratio >= 4.5") possible
(`src/hct/hct.ts:23-25`).

## `src/palette/` — tonal palettes

**Responsibility:** a `TonalPalette` = a fixed (hue, chroma) pair with a memoized
function that returns the color at any tone. Feeds `DynamicScheme` (which owns
six palettes) and the spec layer.

| File | What it contains |
|------|------------------|
| `tonal-palette.ts` | `TonalPalette` (`fromInt`, `fromHct`, `fromHueAndChroma`, `tone(t)`, `getHct(t)`) and the private `KeyColor` class |
| `index.ts` | Re-exports `tonal-palette.ts` |

`fromHueAndChroma` (`src/palette/tonal-palette.ts:43-46`) first builds a
`KeyColor` — the tone at which the requested chroma is actually reachable —
because chroma has a different maximum per hue/tone. `KeyColor.create`
(`src/palette/tonal-palette.ts:113-154`) binary-searches the tone axis using
`Hct` chroma probes, pivoting around T50 where the most chroma is available.
`tone(t)` (`src/palette/tonal-palette.ts:58-69`) is cached in a `Map`; there is
a special case for yellow at T99, which averages T98 and T100 instead of
solving directly.

## `src/scheme/` — dynamic color schemes

**Responsibility:** the stateful representation of "a theme under given UI
conditions" and the declarative role definitions. Feeds `generateColorPalette`
in `color.ts`, and is fed by `src/spec/`.

| File | What it contains |
|------|------------------|
| `dynamic-scheme.ts` | `DynamicScheme`: source color(s), variant, isDark, contrastLevel, the six `TonalPalette`s, one getter per role, memoized `getArgb` |
| `dynamic-color.ts` | `DynamicColor`: declarative role description (palette fn, tone fn, background, contrast curve, tone delta pair) + static tone helpers (`foregroundTone`, `tonePrefersLightForeground`, `enableLightForeground`) |
| `color-roles.ts` | `ColorRoles`: registry mapping every Material role name to a `DynamicColor` via `ColorTokens` |
| `contrast-curve.ts` | `ContrastCurve`: a 4-point curve (low/normal/medium/high) interpolated over contrast level -1..1 |
| `tone-delta-pair.ts` | `ToneDeltaPair`, `TonePolarity`, `DeltaConstraint`: tone-distance constraints between two roles |
| `variants.ts` | The 10 `Scheme*` subclasses (`SchemeTonalSpot`, `SchemeExpressive`, `SchemeCmf`, ...) |
| `variant.ts` | The internal `Variant` enum (10 values) |
| `index.ts` | Re-exports the six files |

Notable details:

- `DynamicScheme` constructor (`src/scheme/dynamic-scheme.ts:142-212`) resolves
  palettes from the spec layer; only `errorPalette` may be `undefined` and fall
  back to hue 25 / chroma 84 (`src/scheme/dynamic-scheme.ts:201-209`).
- `getArgb` memoizes by role name in a `Map` (`src/scheme/dynamic-scheme.ts:299-310`),
  so the 53-role palette is resolved once per scheme.
- The `Scheme*` subclasses are thin: they just pass a `Variant` value and
  optionally multiple source colors to the base constructor. `SchemeCmf`
  (`src/scheme/variants.ts:301-363`) is the exception — it computes all six
  palettes explicitly from up to two source colors.
- `DynamicColor` keeps an HCT cache that is cleared when it grows past 4 entries
  (`src/scheme/dynamic-color.ts:208-218`).

## `src/spec/` — Material Design token specifications

**Responsibility:** the Material Design rulebook — "which hue/chroma", "which
palette and tone", "how to resolve a tone to ARGB". This is the only layer that
knows the actual design values. It is consumed by `DynamicScheme` and
`DynamicColor`, and consumes `hct/`, `palette/`, `science/`, `utils/`.

| File | What it contains |
|------|------------------|
| `palettes.ts` | `PaletteTokens` (+ `PaletteTokensDelegate`): per-variant hue/chroma for the six palettes; `getSpec()` singleton |
| `tokens.ts` | `ColorTokens`: one method per role returning the role's `DynamicColor` (palette, tone, background, contrast curve, tone delta pair) |
| `color-calculation.ts` | `ColorCalculationDelegate` (+ base impl): `getArgb`/`getHct`/`getTone` — the actual contrast-curve and tone-delta solver; `getSpec()` singleton |
| `token-utils.ts` | Helpers: `getCurve`, `tMaxC`, `tMinC`, `isFidelity`, `isMonochrome`, `findDesiredChromaByTone`, `findBestToneForChroma` |
| `index.ts` | Re-exports `tokens.ts` and `palettes.ts` |

Data flow inside the layer:

- `DynamicScheme` asks `PaletteTokens.get*Palette` for each palette
  (`src/scheme/dynamic-scheme.ts:161-200`).
- `ColorRoles` asks `ColorTokens` for each role's `DynamicColor`
  (`src/scheme/color-roles.ts:20-26`).
- `DynamicColor.getArgb`/`getTone` ask `ColorCalculationDelegate.getArgb`/
  `getTone` (`src/scheme/dynamic-color.ts:196-231`), which enforces the
  constraints declared in `ColorTokens`.

Two accuracy notes about this layer:

- `getSpec()` in `palettes.ts` returns a constant named `spec2025`
  (`src/spec/palettes.ts:407-411`), while `DynamicScheme.toString()` reports
  `spec=2026` (`src/scheme/dynamic-scheme.ts:228`) and the README says
  "spec version 2026" (`README.md:503`). The variable name is stale relative to
  the documented version.
- `ColorTokens.surface()` uses tone 6 in dark / 98 in light for non-CMF variants
  (`src/spec/tokens.ts:95-107`) — note `DynamicScheme`'s `sourceColorHct.chroma <= 12`
  branch for `primary` tone (`src/spec/tokens.ts:368-387`): low-chroma seeds get
  forced 40 (light) / 80 (dark), keeping desaturated seeds readable.

## `src/science/` — standalone color science

**Responsibility:** algorithms that do not know anything about themes, roles, or
variants. These are the building blocks that both the spec layer and the public
API call directly. Consumes `hct/` and `utils/`.

| File | What it contains |
|------|------------------|
| `blend.ts` | `Blend`: `harmonize`, `hctHue`, `cam16Ucs` (CAM16-UCS interpolation) |
| `color-blindness.ts` | `simulateCVD`, `simulateAllCVD` — Machado (2009) model with inline matrices; this file is Panmdaa-original (header says Copyright 2026 only) |
| `dislike-analyzer.ts` | `DislikeAnalyzer`: `isDisliked`, `fixIfDisliked` (dark yellow-green avoidance, Palmer & Schloss research) |
| `image.ts` | `sourceColorFromImage`, `sourceColorFromImageBytes` — canvas extraction + quantize + score |
| `score.ts` | `Score`: ranks quantized colors for theme suitability |
| `temperature.ts` | `TemperatureCache`: analogous colors, complement, warm/cool temperature (Ou, Woodcock & Wright algorithm) |
| `index.ts` | Re-exports all six |

Cross-references: `image.ts` imports `QuantizerCelebi` and `Score`
(`src/science/image.ts:12-13`); the CVD functions export matrices inline
(`src/science/color-blindness.ts:25-63`); `fixIfDisliked` is used by the
spec layer for `CONTENT`/`FIDELITY` tertiary palettes
(`src/spec/palettes.ts:188-199`).

## `src/quantize/` — image quantization

**Responsibility:** reduce a large set of pixels to a small map of representative
colors with population counts. Consumes `hct/` indirectly (through `Score`) and
`utils/`.

| File | What it contains |
|------|------------------|
| `quantizer-celebi.ts` | `QuantizerCelebi`: Wu quantization followed by Wsmeans refinement |
| `quantizer-wu.ts` | `QuantizerWu`: fast histogram-based color quantization (Wu's algorithm) |
| `quantizer-wsmeans.ts` | `QuantizerWsmeans`: weighted square-means k-means with Lab-space distance |
| `quantizer-map.ts` | `QuantizerMap`: a trivial 1:1 map (each color as its own cluster) |
| `lab-point-provider.ts` | `LabPointProvider`: Lab distance metrics used by Wsmeans |
| `point-provider.ts` | `PointProvider` interface (type-only export) |
| `index.ts` | Re-exports all |

`QuantizerCelebi.quantize` (`src/quantize/quantizer-celebi.ts:39-43`) chains the
two: Wu produces the initial palette, Wsmeans refines it. This is Celebi's
improvement over plain k-means — deterministic initialization instead of random
centroids (`src/quantize/quantizer-celebi.ts:16-24`). Only `image.ts` uses this
directory today; it is not part of the public API.

## `src/utils/` — shared math and conversions

**Responsibility:** the leaf layer. Pure functions with no imports from `src/`
except each other. Consumed by every other directory.

| File | What it contains |
|------|------------------|
| `color.ts` | ARGB↔RGB↔XYZ↔Lab↔L* conversions, linearize/delinearize, white point, matrices |
| `contrast.ts` | `Contrast` namespace: `ratioOfTones`, `ratioOfYs`, `lighter`/`darker`, `lighterUnsafe`/`darkerUnsafe` |
| `math.ts` | `clampInt`/`clampDouble`, `lerp`, `signum`, `sanitizeDegrees*`, `rotationDirection`, `differenceDegrees`, `matrixMultiply` |
| `string.ts` | `hexFromArgb`, `argbFromHex` (3/6/8 digit) |
| `index.ts` | Re-exports all four |

The contrast utilities deserve special note: they operate on tones, not colors.
`ratioOfTones` (`src/utils/contrast.ts:39-43`) converts both tones to Y via
`yFromLstar` and applies `(lighter + 5) / (darker + 5)`. This is why the public
`contrastChecker` only needs `getTone(base)` and `getTone(on)`
(`src/color.ts:197`).

## Root files

| File | Responsibility | Imports from | Feeds |
|------|----------------|--------------|-------|
| `index.ts` | Public entry point; re-exports `color`, `css-props`, `css-sheet`, `report`, `types` | all root files | consumers |
| `color.ts` | The public API: `palette`, `contrastChecker`, `paletteChecker`, `mix`, `hct`, `onColor`, `simulateCVD` re-export, image, color editing | `utils`, `science`, `scheme`, `hct`, `extend-theme`, `types` | `index.ts` |
| `extend-theme.ts` | `resolveCustomTokens`, `resolveOne`, `resolveMix`, `resolveGradient`, `generateOn`, `toKebabCase` | `utils`, `science`, `hct`, `gradient`, `types` | `color.ts` |
| `gradient.ts` | `gradient(from, to, count)`: HCT-linear interpolation into N steps | `hct`, `utils`, `types` | `color.ts` (re-export), `extend-theme.ts` |
| `css-props.ts` | `generateCSS(palette, { prefix, transform })`: role → custom property string | `types` only | `index.ts` |
| `css-sheet.ts` | `generateCSSSheet(theme, { prefix, lightSelector, darkSelector })`: full light/dark stylesheet | `types` only | `index.ts` |
| `report.ts` | `report(theme, mode)`: WCAG contrast report over `on-*` pairs | `utils`, `color`, `types` | `index.ts` |
| `types.ts` | `ColorValue`, `Palette` (53 roles), `Theme`, `Variant`, `CustomTokenOptions`, contrast/CVD types | nothing | all root files (type-only) |

Two implementation notes for the CSS root files:

- `generateCSSSheet` distinguishes a media query from a plain selector by
  checking whether `darkSelector` starts with `@` (`src/css-sheet.ts:52-65`);
  media queries get nested `:root` blocks, plain selectors don't.
- `report` (unlike `paletteChecker`) does not expose `passingAALarge` in its
  summary type — its `ContrastReport.summary` has only `total`, `passingAA`,
  `passingAAA` (`src/report.ts:25-32`), while per-pair `AALarge` is still
  computed (`src/report.ts:73`).
