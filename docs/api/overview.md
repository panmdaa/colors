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
(Apache-2.0) and wraps that internal color science in a small, ergonomic,
string-based API.

Every color that crosses the public API is a `ColorValue`, a template literal
type that constrains values to CSS hex strings (`types.ts:12`):

```ts
export type ColorValue = `#${string}`;
```

The entire package is exported from a single entry point (`index.ts`), which
re-exports four modules plus the shared types:

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

1. **Colors are hex strings.** Internally everything is a 32-bit ARGB integer;
   `toNumber` and `fromNumber` (`color.ts:23-29`) are the only bridge between
   the two worlds. Every public helper converts in and out so callers never see
   an integer.
2. **One function, one idea.** Instead of exposing the full `DynamicScheme`
   surface, the library offers `palette()` — a single entry point that builds a
   complete light and dark Material 3 theme (`color.ts:370`). Instead of
   exposing `Cam16`, `TonalPalette`, and `Contrast`, it offers `getTone`,
   `onColor`, `mix`, and `contrastChecker`.
3. **Compile-time safety, runtime simplicity.** Types like `Tones`
   (`types.ts:78`) and `ExtraPalette` (`color.ts:364`) give callers precise
   literal types while the runtime implementation stays plain object
   manipulation.

## Module layout

| Module | Public entry points | Internal machinery it wraps |
| ------ | ------------------- | --------------------------- |
| `src/color.ts` | `palette`, `contrastChecker`, `paletteChecker`, all single-color helpers | `Hct`, `DynamicScheme`, `Blend`, `DislikeAnalyzer`, `Contrast`, `simulateCVD` |
| `src/css-props.ts` | `generateCSS`, `GenerateCSSOptions` | none — pure string formatting |
| `src/css-sheet.ts` | `generateCSSSheet`, `GenerateCSSSheetOptions` | none — pure string formatting |
| `src/report.ts` | `report`, `ContrastReport`, `ContrastPair` | `Contrast`, `getTone` |
| `src/types.ts` | all shared types | — |

Note that `src/extend-theme.ts` (which provides `resolveCustomTokens`) is
internal: it is imported by `color.ts` but is **not** re-exported from
`index.ts`. It only surfaces through the `extraColors` option of `palette()`.

## Public API surface

### Theme generation

| Function / type | Purpose | Source |
| --------------- | ------- | ------ |
| `palette(color, options?)` | Build a full light + dark Material 3 theme from a seed color | `color.ts:370` |
| `Theme` | `{ color, light, dark }` — the shape returned by `palette()` | `types.ts:72` |
| `Palette` | The 53 Material 3 role tokens (primary, on-primary, surface, ...) | `types.ts:16` |
| `ExtraPalette<T>` | Mapped type that expands custom tokens into `{ name, on-name }` pairs | `color.ts:364` |
| `Variant` | The ten scheme variants (`'expressive'`, `'tonal-spot'`, `'monochrome'`, ...) | `types.ts:80` |

### Color manipulation

| Function | Purpose | Source |
| -------- | ------- | ------ |
| `toNumber` / `fromNumber` | Convert between `ColorValue` and ARGB integer | `color.ts:23-29` |
| `hct` / `fromHct` | Get the `Hct` object for a color / build a color from HCT components | `color.ts:35-45` |
| `getHue` / `getChroma` / `getTone` | Read a single HCT component | `color.ts:47-57` |
| `setHue` / `setChroma` / `setTone` | Write a single HCT component | `color.ts:59-75` |
| `rotateHue` | Rotate hue by degrees, wrapping at 360 | `color.ts:77` |
| `lighten` / `darken` | Shift tone toward 100 / 0 | `color.ts:83-93` |
| `saturate` / `desaturate` | Shift chroma up / down (floor 0) | `color.ts:95-105` |
| `edit` | Apply an arbitrary `{ hue, chroma, tone }` patch | `color.ts:107` |
| `tone` / `tones` | Produce one tone / the 14 Material reference tones | `color.ts:133-146` |
| `onColor` / `underColor` | Pick a foreground for a background (or vice versa) at a contrast ratio | `color.ts:148-159` |
| `mix` | Average N colors in HCT space (circular hue averaging) | `color.ts:338` |
| `gradient` | Produce `count` interpolated colors between two endpoints | `gradient.ts:16` |
| `harmonize` | Pull a design color toward the hue of a source color | `color.ts:118` |
| `fixDisliked` / `isDisliked` | Detect and fix "disliked" hues (yellow-green, etc.) | `color.ts:125-131` |

### Contrast and accessibility

| Function | Purpose | Source |
| -------- | ------- | ------ |
| `contrastChecker(base, on, cvd?)` | WCAG contrast score for one pair, with optional CVD simulation | `color.ts:194` |
| `paletteChecker(theme, cvd?)` | Score every `on-{role}` pair in a palette / full theme | `color.ts:286` |
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
| `fromImage(image)` | Extract a dominant source color from an `HTMLImageElement` | `color.ts:31` |

### Color vision deficiency

| Function | Purpose | Source |
| -------- | ------- | ------ |
| `simulateCVD(color, deficiency, severity?)` | Simulate one deficiency (Machado 2009 model) | re-exported at `color.ts:20` |
| `simulateAllCVD(color, severity?)` | Simulate all three deficiencies at once | re-exported at `color.ts:20` |

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
