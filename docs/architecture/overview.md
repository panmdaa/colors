# Architecture Overview

## Table of Contents

- [The layers at a glance](#the-layers-at-a-glance)
- [Dependency diagram](#dependency-diagram)
- [Layer 1: Public API (`src/color.ts`)](#layer-1-public-api-srccolorts)
- [Layer 2: Orchestration (`generateColorPalette`, `extend-theme.ts`)](#layer-2-orchestration)
- [Layer 3: Scheme layer (`src/scheme/`)](#layer-3-scheme-layer-srcscheme)
- [Layer 4: Spec layer (`src/spec/`)](#layer-4-spec-layer-srcspec)
- [Layer 5: Color science core (`hct/`, `palette/`, `science/`, `quantize/`, `utils/`)](#layer-5-color-science-core)
- [Why the separation matters](#why-the-separation-matters)
- [Data flow, end to end](#data-flow-end-to-end)

## The layers at a glance

`@panmdaa/colors` is structured as five concentric layers. Each layer has a single
responsibility and may only depend on the layers beneath it:

| Layer | Directory / file | Responsibility |
|-------|------------------|----------------|
| 1. Public API | `src/color.ts` | The entire ergonomic surface: `palette`, `contrastChecker`, `paletteChecker`, `report`, `mix`, `gradient`, `hct`, color manipulation helpers |
| 2. Orchestration | `src/extend-theme.ts`, `generateColorPalette` in `color.ts` | Coordinates layers 1 and 3: maps the public `Variant` string to the internal enum, builds the 53-role palette from a scheme, merges custom tokens |
| 3. Scheme layer | `src/scheme/` | `DynamicScheme`, `DynamicColor`, `ColorRoles`, the 10 `Scheme*` variant classes |
| 4. Spec layer | `src/spec/` | The Material Design token values: `ColorTokens` (which role uses which palette and tone), `PaletteTokens` (which hue/chroma each variant uses), `ColorCalculationDelegate` (how a tone resolves to ARGB) |
| 5. Science core | `src/hct/`, `src/palette/`, `src/science/`, `src/quantize/`, `src/utils/` | Pure color science and math, with zero knowledge of themes, roles, or the public API |

The entry point `src/index.ts` re-exports only `color.ts`, `css-props.ts`,
`css-sheet.ts`, `report.ts`, and the types (`src/index.ts:12-15`). Everything
inside layers 2-5 stays internal; consumers never touch it.

## Dependency diagram

```
src/index.ts
    │  re-exports (public surface)
    ▼
┌─────────────────────────────── Layer 1 ───────────────────────────────┐
│ color.ts   css-props.ts   css-sheet.ts   report.ts                     │
│   │   │        │              │              │                         │
│   │   │        └──── import Palette type ────┘                         │
│   │   ▼                                                               │
│   │   extend-theme.ts  (resolveCustomTokens)  ── Layer 2 ──            │
│   ▼                        │                                          │
│   generateColorPalette (color.ts)                                     │
│       │                                                               │
└───────┼───────────────────────────────────────────────────────────────┘
        ▼
┌─────────────────────────────── Layer 3 ───────────────────────────────┐
│ DynamicScheme (dynamic-scheme.ts)                                      │
│   │  owns six TonalPalettes per mode                                   │
│   │  delegates each color role to ColorRoles → ColorTokens             │
│   ▼                                                                    │
│ DynamicColor (dynamic-color.ts)  ◄── resolves tone + ARGB              │
└───────┼───────────────────────────────────────────────────────────────┘
        ▼
┌─────────────────────────────── Layer 4 ───────────────────────────────┐
│ spec/palettes.ts            → which hue/chroma each variant uses       │
│ spec/tokens.ts              → which palette+tone each role uses        │
│ spec/color-calculation.ts   → tone → ARGB (contrast curves, deltas)    │
│ spec/token-utils.ts         → helpers (tMaxC, tMinC, getCurve)         │
└───────┼───────────────────────────────────────────────────────────────┘
        ▼
┌─────────────────────────────── Layer 5 ───────────────────────────────┐
│ hct/       Cam16, HctSolver, Hct, ViewingConditions                    │
│ palette/   TonalPalette, KeyColor                                      │
│ science/   Blend, DislikeAnalyzer, TemperatureCache, Score, simulateCVD│
│ quantize/  QuantizerCelebi, QuantizerWu, QuantizerWsmeans              │
│ utils/     color/math/contrast/string                                  │
└────────────────────────────────────────────────────────────────────────┘
```

## Layer 1: Public API (`src/color.ts`)

This is the only file a consumer can import from (via `src/index.ts:12`). It is a
thin, intentionally-stateless facade over the layers below. Every public function
is a small composition of science-core calls:

- `hct(color)` = `Hct.fromInt(toNumber(color))` (`src/color.ts:35-37`)
- `getHue` / `setHue` / `lighten` / `edit` all mutate an `Hct` and serialize back
  to a hex string (`src/color.ts:47-116`)
- `mix(...colors)` converts every input to `Hct`, circular-averages the hue via
  `Math.atan2` over sine/cosine sums, and arithmetic-averages chroma and tone
  (`src/color.ts:338-362`)
- `onColor(bg)` picks a foreground tone with >= 4.5:1 contrast using
  `Contrast.lighterUnsafe`/`darkerUnsafe` (`src/color.ts:148-155`)

The layer also contains the accessibility surface: `contrastChecker`
(`src/color.ts:194-210`) builds a `0-10` score from `Contrast.ratioOfTones`
(`src/utils/contrast.ts:39-43`), and `paletteChecker` (`src/color.ts:313-336`)
scans every `on-*` pair in a palette. Both compose `simulateCVD` from the
science layer (`src/science/color-blindness.ts:111-120`).

Why this layer exists: it is the contract. It normalizes hex strings to ARGB
ints (`toNumber`), strings to enums (`toInternalVariant`, `src/color.ts:395-418`),
and objects to hex. Without it, consumers would have to learn the internal
`DynamicScheme`/`DynamicColor` object graph — which is exactly the ergonomic gap
in Google's Material Color Utilities that the README calls out
(`README.md:483-486`).

## Layer 2: Orchestration

Two functions sit between the API layer and the scheme layer.

**`generateColorPalette`** (`src/color.ts:420-488`) is the heart of theme
generation. For one mode (light or dark) it:

1. Constructs a `DynamicScheme` from the source `Hct`, the internal variant, the
   mode, and the contrast level (`src/color.ts:426-431`).
2. Reads 53 named getters off the scheme — `scheme.primary`,
   `scheme.primaryContainer`, `scheme.surface`, ... — and converts each ARGB
   int back to a hex string via `fromNumber` (`src/color.ts:433-487`).

**`resolveCustomTokens`** (`src/extend-theme.ts:114-159`) is the layer that
extends the fixed 53 roles with user-defined tokens. It classifies each token
config as "shared" (direct hex, `harmonize`, `random`, `gradient` — identical in
light and dark) or "per-mode" (`from`, `mix` referencing palette keys), resolves
it with `resolveOne` (`src/extend-theme.ts:75-112`), and auto-generates an
`on-{name}` foreground with `generateOn` (`src/extend-theme.ts:28-32`).

Why this layer exists: it isolates the object-graph complexity of `DynamicScheme`
from the plain-data `Theme` object the API promises, and it gives `extraColors`
a single place to mutate the finished palettes without touching the scheme layer.

## Layer 3: Scheme layer (`src/scheme/`)

`DynamicScheme` (`src/scheme/dynamic-scheme.ts:67`) is the stateful container
that represents "a theme under specific UI conditions": one source `Hct`, a
`Variant`, `isDark`, and a `contrastLevel` from -1 to 1. Its constructor
(`src/scheme/dynamic-scheme.ts:142-212`) lazily resolves the six tonal palettes
(primary, secondary, tertiary, neutral, neutralVariant, error) from the spec
layer via `getSpec().getPrimaryPalette(...)` etc.

Every color role is exposed as a getter that memoizes through `getArgb`
(`src/scheme/dynamic-scheme.ts:301-310`): the first read of `scheme.primary`
resolves the role's `DynamicColor` and caches it in a `Map`, so the 53-role
palette is computed once and re-read cheaply.

`DynamicColor` (`src/scheme/dynamic-color.ts:71`) is the declarative description
of a role: which palette it draws from, what tone function produces its tone,
what its background is, and what contrast curve/delta constraints apply. It
delegates actual number-crunching to the spec layer's `getSpec().getArgb` /
`getHct` / `getTone` (`src/scheme/dynamic-color.ts:196-231`).

The `Scheme*` subclasses (`src/scheme/variants.ts`) — `SchemeTonalSpot`,
`SchemeExpressive`, `SchemeCmf`, and the rest — are thin constructors that pass
a `Variant` enum value up to `DynamicScheme`. The real per-variant behavior lives
in the spec layer.

Why this layer exists: it decouples "what conditions the theme is under" (scheme)
from "what the spec says the colors should be" (spec). A `DynamicScheme` is
reusable: the same object can resolve every role, in either mode, at any
contrast level, because `DynamicColor` functions take the scheme as an argument.

## Layer 4: Spec layer (`src/spec/`)

The spec layer is the Material Design rulebook, isolated from the machinery that
runs it. It has three delegates:

- **`PaletteTokens`** (`src/spec/palettes.ts:71`) answers "for this variant,
  what hue and chroma does each of the six palettes have?". `getPrimaryPalette`
  (`src/spec/palettes.ts:76-122`) is a `switch` over the variant enum — Tonal
  Spot uses chroma `isDark ? 26 : 32`, Vibrant uses 74, Monochrome uses 0.
  `getErrorPalette` (`src/spec/palettes.ts:381-404`) returns `undefined` for
  variants where the fallback error palette (hue 25, chroma 84) is used
  (`src/scheme/dynamic-scheme.ts:201-209`).
- **`ColorTokens`** (`src/spec/tokens.ts:21`) answers "for this role, which
  palette and tone?". Each method returns a `DynamicColor` built with
  `DynamicColor.fromPalette` — e.g. `primary` uses `s.primaryPalette` with a
  tone that is the source tone, or 40/80 when the source chroma is low
  (`src/spec/tokens.ts:368-387`), plus a `ToneDeltaPair` constraining it 5 steps
  away from `primaryContainer`.
- **`ColorCalculationDelegateBase`** (`src/spec/color-calculation.ts:32`)
  answers "given a tone, give me an ARGB int". Its `getTone`
  (`src/spec/color-calculation.ts:63-200`) is where contrast curves and
  tone-delta constraints are actually enforced: `ToneDeltaPair` polarity
  (`'relative_lighter'`, `'farther'`, ...), `Contrast.ratioOfTones` checks,
  and the background/dual-background resolution that `DynamicColor.foregroundTone`
  (`src/scheme/dynamic-color.ts:242-269`) drives.

`getSpec()` (`src/spec/palettes.ts:409-411`, `src/spec/color-calculation.ts:208-210`)
returns singleton instances, so the 53-role resolution never re-allocates the
delegates.

Why this layer exists: **single responsibility plus versioning.** The token
definitions are pure data-ish configuration. Because the spec is a delegate,
a future spec revision (the scheme's `toString()` reports `spec=2026`,
`src/scheme/dynamic-scheme.ts:228`) can swap the token tables without touching
`DynamicScheme` or the science core. `DynamicColor` and `DynamicScheme` are
deliberately "arguably too flexible" — the spec layer is what keeps that
flexibility bounded (`src/scheme/dynamic-color.ts:103-114`).

## Layer 5: Color science core

- **`src/hct/`** — HCT itself. `Cam16` (`src/hct/cam16.ts:32`) implements the
  CAM16 color appearance model (hue, chroma, lightness, plus CAM16-UCS `jstar`/
  `astar`/`bstar` for distance). `Hct` (`src/hct/hct.ts:39`) pairs CAM16 hue and
  chroma with `L*` from CIELAB for the tone channel, so tone is perceptually
  linear and contrast can be derived directly from it
  (`src/hct/hct.ts:12-26`). `HctSolver` (`src/hct/hct-solver.ts:34`) is the
  binary-search-based gamut mapper. `ViewingConditions` models the environment
  (used by `inViewingConditions`, `src/hct/hct.ts:168-190`).
- **`src/palette/`** — `TonalPalette` (`src/palette/tonal-palette.ts:18`): a
  fixed hue/chroma and a function that produces the color at any tone, memoized.
  `KeyColor` (`src/palette/tonal-palette.ts:96`) finds the tone at which the
  requested chroma is actually reachable.
- **`src/science/`** — standalone algorithms that don't know about themes:
  `Blend` (`src/science/blend.ts:28`) for harmonize and CAM16-UCS blending,
  `DislikeAnalyzer` (`src/science/dislike-analyzer.ts:28`) for the
  disliked-yellow-green fix, `TemperatureCache` (`src/science/temperature.ts:23`)
  for analogous/complement colors, `Score` (`src/science/score.ts:53`) for
  ranking quantized colors, `simulateCVD` for color blindness.
- **`src/quantize/`** — image quantization (Celebi = Wu + Wsmeans,
  `src/quantize/quantizer-celebi.ts:39-43`) that reduces an image to a few
  candidate colors for `fromImage`.
- **`src/utils/`** — shared math (`clampDouble`, `sanitizeDegrees*`), ARGB/hex
  conversion, color space matrices, and WCAG contrast math
  (`src/utils/contrast.ts:32-153`).

Why this layer exists: it is pure and side-effect free, with no knowledge of the
Material Design system. Every heavier layer is built on top of it, which makes
it independently testable (see `test/internal/` and `test/correctness/`) and
keeps the science identical to what Material Design's own tooling produces.

## Why the separation matters

**Testability.** Each layer has a seam. `test/internal/` exercises the science
core and utils directly; `test/correctness/` asserts known-good palette outputs;
`test/api/` tests the public facade. Because the layers only depend downward,
you can test `DynamicScheme` with a mock spec, or test `resolveCustomTokens`
against two plain palette objects without constructing a scheme at all.

**Single responsibility.** `color.ts` never does math; `dynamic-scheme.ts` never
decides what tone `primary` should be; `spec/tokens.ts` never converts ARGB to
hex; `hct/` never hears about "primary" or "variant". A change to any one
concern is localized.

**Swap-ability.** The delegate pattern in the spec layer means the "what the
system looks like" can evolve (spec version) independently of the "how colors
are computed" (science core) and "how consumers call it" (public API). This is
the architectural reason the project can keep Material Design compatibility
while shipping an API Google's MCU never had.

## Data flow, end to end

`palette("#744c9d", { variant: "expressive" })` (`src/color.ts:370-393`):

1. `Hct.fromInt(toNumber(color))` parses the hex seed into HCT
   (`src/color.ts:381`, `src/hct/hct.ts:65-67`).
2. `toInternalVariant("expressive")` maps the public string to the enum
   `Variant.EXPRESSIVE` (`src/color.ts:382`, `src/color.ts:401-402`).
3. `generateColorPalette(source, internalVariant, false, 0)` builds the light
   palette (`src/color.ts:383`) — a `DynamicScheme` is constructed
   (`src/scheme/dynamic-scheme.ts:142`), which pulls the six palettes from
   `PaletteTokens` (`src/spec/palettes.ts:76-404`).
4. Each of the 53 scheme getters resolves its `DynamicColor` through
   `ColorRoles` → `ColorTokens` → `ColorCalculationDelegateBase`, applying
   contrast curves and tone-delta pairs, then caching the ARGB result
   (`src/scheme/dynamic-scheme.ts:301-310`).
5. `generateColorPalette` converts all 53 ARGB ints to hex strings
   (`src/color.ts:433-487`). The same happens again with `isDark: true` for the
   dark palette (`src/color.ts:384`).
6. If `extraColors` was passed, `resolveCustomTokens` mutates both palettes in
   place via `Object.assign` and the returned `Theme` is assembled
   (`src/color.ts:386-392`).

The full trace with exact line references is in [data-flow.md](./data-flow.md).
