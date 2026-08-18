# API Overview

- [Introduction](#introduction)
- [Design philosophy](#design-philosophy)
- [Module layout](#module-layout)
- [Public API surface](#public-api-surface)
  - [Theme generation](#theme-generation)
  - [Color manipulation](#color-manipulation)
  - [Contrast and accessibility](#contrast-and-accessibility)
  - [CSS output](#css-output)
  - [Image](#image)
  - [Color vision deficiency](#color-vision-deficiency)
  - [Types](#types)
- [Further reading](#further-reading)

## Introduction

`@panmdaa/colors` is a zero-dependency TypeScript library for color science and
dynamic theme generation. It is derived from Google's Material Color Utilities
(Apache-2.0) and wraps that internal color science in a small, ergonomic API.

Colors cross the public API as `ColorValue` hex strings or as `Color` instances.
`ColorValue` is a template literal type that constrains values to CSS hex
strings (`types.ts:12`):

```ts
export type ColorValue = `#${string}`;
```

The entire package is exported from a single entry point (`index.ts`), which
re-exports the color module plus the shared types:

```ts
export * from './color';
export * from './css-props';
export * from './css-sheet';
export * from './report';
export type * from './types';
```

## Design philosophy

The internal modules (`hct`, `science`, `scheme`, `utils`) speak in raw
machinery: ARGB integers, `Hct` objects, `DynamicScheme` instances. The public
modules are **thin ergonomic wrappers** over that machinery, built on three
rules:

1. **Colors are `Color` objects (or hex strings).** Internally everything is a
   32-bit ARGB integer; `Color.toNumber` / `Color.fromNumber`
   (`color-class.ts`) are the only bridge between the two worlds. `Color`
   converts in and out so callers never see a raw integer.
2. **One class, one idea.** Instead of exposing the full `DynamicScheme`
   surface, the library offers `palette()` — a single entry point that builds a
   complete light and dark Material 3 theme (`color.ts`). Instead of exposing
   `Cam16`, `TonalPalette`, and `Contrast`, the `Color` class offers `getTone`,
   `onColor`, `mix`, and `contrastChecker`.
3. **Compile-time safety, runtime simplicity.** Types like `Tones`
   (`types.ts:78`) and `ExtraPalette` (`color.ts`) give callers precise literal
   types while the runtime implementation stays plain object manipulation.

## Module layout

| Module | Public entry points | Internal machinery it wraps |
| ------ | ------------------- | --------------------------- |
| `src/color-class.ts` | `Color` — constructors, HCT getters/setters, mutations, `onColor`/`underColor`, `mix`, `gradient`, `tones`, `harmonize`, `fixDisliked`, conversions | `Hct`, `Cam16`, `Blend`, `DislikeAnalyzer`, `Contrast` |
| `src/color.ts` | `palette`, `contrastChecker`, `paletteChecker`, `simulateCVD` re-exports | `Hct`, `DynamicScheme`, `Contrast` |
| `src/css-props.ts` | `generateCSS`, `GenerateCSSOptions` | none — pure string formatting |
| `src/css-sheet.ts` | `generateCSSSheet`, `GenerateCSSSheetOptions` | none — pure string formatting |
| `src/report.ts` | `report`, `ContrastReport`, `ContrastPair` | `Contrast`, `Color` |
| `src/types.ts` | all shared types | — |

Note that `src/extend-theme.ts` (which provides `resolveCustomTokens`) is
internal: it is imported by `color.ts` but is **not** re-exported from
`index.ts`. It only surfaces through the `extraColors` option of `palette()`.

## Public API surface

### Theme generation

| Function / type | Purpose | Source |
| --------------- | ------- | ------ |
| `palette(color, options?)` | Build a full light + dark Material 3 theme from a seed color | `color.ts` |
| `Theme` | `{ color, light, dark }` — the shape returned by `palette()` | `types.ts:72` |
| `Palette` | The 53 Material 3 role tokens (primary, on-primary, surface, ...) | `types.ts:16` |
| `ExtraPalette<T>` | Mapped type that expands custom tokens into `{ name, on-name }` pairs | `color.ts` |
| `Variant` | The ten scheme variants (`'expressive'`, `'tonal-spot'`, `'monochrome'`, ...) | `types.ts:80` |

### Color manipulation

Everything below is a static method on `Color`, and also available as an
instance method on a `Color` object. See
[color-manipulation.md](./color-manipulation.md) for details.

| Method | Purpose |
| ------ | ------- |
| `Color.from` / `fromHex` / `fromArgb` / `fromNumber` / `fromHct` / `fromImage` | Constructors (hex, ARGB int, HCT components, image) |
| `Color.toNumber` | Convert a `ColorValue` to an ARGB integer |
| `Color.hct` | Get the live `Hct` object for a color |
| `Color.getHue` / `getChroma` / `getTone` | Read a single HCT component |
| `Color.setHue` / `setChroma` / `setTone` | Write a single HCT component (returns new `Color`) |
| `Color.rotateHue` | Rotate hue by degrees, wrapping at 360 |
| `Color.lighten` / `darken` | Shift tone toward 100 / 0 |
| `Color.saturate` / `desaturate` | Shift chroma up / down (floor 0) |
| `Color.edit` | Apply an arbitrary `{ hue, chroma, tone }` patch |
| `Color.tone` / `tones` | Produce one tone / the 14 Material reference tones |
| `Color.onColor` / `underColor` | Pick a foreground for a background (or vice versa) at a contrast ratio |
| `Color.mix` | Average N colors in HCT space (circular hue averaging) |
| `Color.gradient` | Produce `count` interpolated colors between two endpoints |
| `Color.harmonize` | Pull a design color toward the hue of a source color |
| `Color.fixDisliked` / `isDisliked` | Detect and fix "disliked" hues (yellow-green, etc.) |

### Contrast and accessibility

| Function | Purpose | Source |
| -------- | ------- | ------ |
| `contrastChecker(base, on, cvd?)` | WCAG contrast score for one pair, with optional CVD simulation | `color.ts` |
| `paletteChecker(theme, cvd?)` | Score every `on-{role}` pair in a palette / full theme | `color.ts` |
| `report(theme, mode?)` | Lightweight WCAG pass/fail report for a single mode | `report.ts:58` |
| `ContrastScore` / `ContrastScoreCVD` | Score shapes (ratio, overall score, small/large text scores) | `types.ts:116-125` |
| `PaletteCheckerResult` / `PaletteCheckerMode` / `PaletteCheckerPair` | Checker output shapes | `types.ts:140-168` |

### CSS output

| Function | Purpose | Source |
| -------- | ------- | ------ |
| `generateCSS(palette, options?)` | Emit `--color-{role}: {value};` lines | `css-props.ts:19` |
| `generateCSSSheet(theme, options?)` | Emit a full stylesheet with light + dark blocks | `css-sheet.ts:33` |

### Image

| Function | Purpose | Source |
| -------- | ------- | ------ |
| `Color.fromImage(image)` | Extract a dominant source color from an `HTMLImageElement` | `color-class.ts` |

### Color vision deficiency

| Function | Purpose | Source |
| -------- | ------- | ------ |
| `simulateCVD(color, deficiency, severity?)` | Simulate one deficiency (Machado 2009 model) | re-exported at `color.ts` |
| `simulateAllCVD(color, severity?)` | Simulate all three deficiencies at once | re-exported at `color.ts` |

### Types

`ColorValue`, `ColorScheme`, `Tones`, `Variant`, `Palette`, `Theme`,
`GradientOptions`, `CustomTokenOptions`, `PaletteOptions`, `ContrastScore`,
`ContrastScoreCVD`, `ColorVisionDeficiency`, `CVDSeverity`,
`PaletteCheckerSimulation`, `PaletteCheckerPair`, `PaletteModeSummary`,
`PaletteCheckerMode`, `PaletteCheckerResult` — all defined in `types.ts` and
re-exported as types from `index.ts:16`.

> Note: `PaletteOptions` (`types.ts:111`) is declared and exported but is not
> actually used by `palette()`'s signature, which inlines its own options
> including `contrastLevel` (`color.ts:374`). Treat `PaletteOptions` as
> documentation of intent rather than the function's contract.

## Further reading

- [palette.md](./palette.md) — the theme generation pipeline
- [color-manipulation.md](./color-manipulation.md) — single-color helpers
- [contrast.md](./contrast.md) — the scoring system
- [palette-checker.md](./palette-checker.md) — whole-palette accessibility
- [css-generation.md](./css-generation.md) — CSS output
