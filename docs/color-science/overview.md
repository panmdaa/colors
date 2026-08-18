# Color Science Overview

## Table of Contents

- [What this layer is](#what-this-layer-is)
- [Where it fits in the pipeline](#where-it-fits-in-the-pipeline)
- [The seed to theme flow](#the-seed-to-theme-flow)
- [Forward conversion: RGB to HCT](#forward-conversion-rgb-to-hct)
- [Inverse conversion: HCT to RGB](#inverse-conversion-hct-to-rgb)
- [The ARGB pivot](#the-argb-pivot)
- [Why a separate color science core](#why-a-separate-color-science-core)

## What this layer is

The color science core is the lowest layer of `@panmdaa/colors`. It lives in
`src/hct/` and `src/utils/` and contains pure, side-effect-free math: the HCT
color space, the CAM16 color appearance model, the gamut solver that inverts
both, and the format conversions (ARGB, hex, linear RGB, XYZ, L\*a\*b\*) that
connect them.

It has zero knowledge of Material Design, themes, roles, or variants. That is a
deliberate architectural decision: the science must be independently testable
and identical to what Google's Material Color Utilities produces, so every
layer above it can be swapped without touching the math.

```
Layer 5 (science core)            hct/   Cam16, HctSolver, Hct, ViewingConditions
                                   utils/ color, math, string, contrast
```

## Where it fits in the pipeline

The whole library is a one-way assembly line that takes a single seed hex color
and produces a 53-role light/dark theme:

```
seed hex
   │  Color.toNumber(color)               ── src/color-class.ts
   ▼
ARGB int
   │  Hct.fromInt(argb)                  ── src/hct/hct.ts:65-67
   ▼
Hct (hue, chroma, tone)                  ── the only coordinate the rest of
   │                                        the library ever speaks
   ▼
DynamicScheme                            ── src/scheme/dynamic-scheme.ts
   │  scheme.primary, scheme.surface, ... resolves 53 roles, each an ARGB int
   ▼
Theme { light: {...}, dark: {...} }      ── generateColorPalette,
                                               src/color.ts:420-488
```

The key fact: **HCT is the language of the library.** `palette()` parses the
seed into an `Hct` exactly once (`src/color.ts:381`), and every role in the
resulting theme is derived from that Hct through `DynamicScheme`. Color
manipulation helpers (`lighten`, `setChroma`, `mix`) parse a hex into `Hct`,
mutate the three channels, and serialize back — they never touch raw RGB
(`src/color.ts:83-116`).

## The seed to theme flow

1. `palette(color, options)` normalizes the hex string to an ARGB int with
   `toNumber` (`src/color.ts:23-25`) and wraps it in an `Hct` via
   `Hct.fromInt` (`src/color.ts:381`, `src/hct/hct.ts:65-67`).
2. `generateColorPalette(source, variant, isDark, contrastLevel)` builds a
   `DynamicScheme` from that Hct (`src/color.ts:426-431`). The scheme is the
   "what conditions is this theme under" object: one source color, a variant,
   light or dark, and a contrast level.
3. Each of the 53 role getters on the scheme resolves a `DynamicColor` — which
   palette to draw from and which tone to pick — and that tone is converted to
   an ARGB int by the spec layer's calculation delegate.
4. `generateColorPalette` converts every ARGB int back to a hex string with
   `fromNumber` and assembles the plain `Theme` object (`src/color.ts:433-487`).

Step 3 is where the inverse solver is exercised most: a role declares "primary
at tone 40" and the spec delegate calls `HctSolver.solveToInt(hue, chroma, 40)`
to find the actual sRGB color. See
[hct-solver.md](./hct-solver.md) for how that works.

## Forward conversion: RGB to HCT

Parsing a color (`Hct.fromInt`, `src/hct/hct.ts:65-67`) is forward through the
model chain:

```
ARGB
   │  bit unpack                     src/utils/color.ts:62-78
   ▼
R, G, B (0-255, gamma encoded)
   │  linearized()                   src/utils/color.ts:219-226
   ▼
linear RGB (0-100)
   │  sRGB→XYZ matrix                src/hct/cam16.ts:101-103
   ▼
XYZ
   │  CAM16 fromIntInViewingConditions   src/hct/cam16.ts:94-152
   ▼
CAM16 { hue, chroma, J }             ── chroma and hue
   │
   │  lstarFromArgb(argb)            src/utils/color.ts:176-179
   ▼
L*  (CIELAB)                         ── tone
```

The constructor does exactly this (`src/hct/hct.ts:138-144`):

```ts
private constructor(private argb: number) {
    const cam = Cam16.fromInt(argb);
    this.internalHue = cam.hue;
    this.internalChroma = cam.chroma;
    this.internalTone = lstarFromArgb(argb);
    this.argb = argb;
}
```

So an HCT color is: CAM16 hue, CAM16 chroma, and CIELAB L\* for tone. The
forward chain always terminates inside the sRGB gamut, because it starts from a
real color — no clamping is needed.

## Inverse conversion: HCT to RGB

Building a color from HCT values (`Hct.from`, `src/hct/hct.ts:53-55`) goes the
other way and is not a closed-form computation:

```
Hue, Chroma, Tone
   │  HctSolver.solveToInt()        src/hct/hct-solver.ts:467-480
   │   ├─ Newton iteration on J (findResultByJ)     :388-453
   │   └─ gamut bisection fallback  (bisectToLimit) :327-371
   ▼
linear RGB (0-100)
   │  argbFromLinrgb                src/utils/color.ts:45-50
   ▼
ARGB
   │  hexFromArgb / fromNumber      src/utils/string.ts:22-36
   ▼
hex string
```

This is the hard direction. Not every `(hue, chroma, tone)` triple exists as an
sRGB color: chroma's maximum depends on both hue and tone, so the requested
chroma is frequently unreachable and must be reduced. The solver first tries a
fast Newton search and, when that fails, finds the gamut boundary with a
bisection search over linear RGB. The whole algorithm is documented in
[hct-solver.md](./hct-solver.md).

## The ARGB pivot

Both directions meet at ARGB. The forward direction starts from ARGB, the
inverse direction ends at ARGB, and `Hct.toInt()` (`src/hct/hct.ts:69-71`)
returns the ARGB of the nearest sRGB color. ARGB is the library's "internal
currency" because a single 32-bit integer can be unpacked into channels with
shifts and masks (`src/utils/color.ts:62-78`) and packed back with a bitwise OR
(`src/utils/color.ts:38-40`) — no allocation, no string parsing, and exactly
one canonical value per color. See [formats.md](./formats.md).

## Why a separate color science core

The design constraint that motivates this layer is compatibility. The README
and the architecture docs describe `@panmdaa/colors` as derived from Google's
Material Color Utilities — the HCT/CAM16 machinery must produce byte-identical
results to keep generated themes in sync with Material Design 3 tooling. By
isolating all the math in `src/hct/` and `src/utils/`, the project gets:

- **Testability**: the science core is exercised directly by `test/internal/`
  and `test/correctness/`, asserting known-good outputs without constructing a
  scheme.
- **Single responsibility**: `hct/` never hears about "primary" or "variant";
  `src/scheme/` never does color math. Each concern is localized.
- **Reuse**: `inViewingConditions` (`src/hct/hct.ts:168-190`), `Blend`,
  `DislikeAnalyzer`, and the quantizers all consume the same primitives.

The four follow-on documents go deep into each piece: [hct.md](./hct.md) (the
space), [cam16.md](./cam16.md) (the appearance model), [hct-solver.md](./hct-solver.md)
(the inversion), and [formats.md](./formats.md) (the representations).
