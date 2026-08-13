# The 10 Theme Variants

- [How variants work](#how-variants-work)
- [Where palettes come from: `PaletteTokens`](#where-palettes-come-from-palettetokens)
- [The shared tone-delta-pair wiring](#the-shared-tone-delta-pair-wiring)
- [Per-variant reference](#per-variant-reference)
  - [1. Monochrome](#1-monochrome)
  - [2. Neutral](#2-neutral)
  - [3. Tonal Spot](#3-tonal-spot)
  - [4. Vibrant](#4-vibrant)
  - [5. Expressive](#5-expressive)
  - [6. Fidelity](#6-fidelity)
  - [7. Content](#7-content)
  - [8. Rainbow](#8-rainbow)
  - [9. Fruit Salad](#9-fruit-salad)
  - [10. CMF](#10-cmf)
- [Comparison table](#comparison-table)
- [Design rationale](#design-rationale)
- [Accuracy notes](#accuracy-notes)

## How variants work

The `Variant` enum (`variant.ts:17-28`) lists the 10 supported themes, and each
value has a matching `Scheme*` subclass in `variants.ts`:

```ts
export enum Variant {
  MONOCHROME = 0,
  NEUTRAL = 1,
  TONAL_SPOT = 2,
  VIBRANT = 3,
  EXPRESSIVE = 4,
  FIDELITY = 5,
  CONTENT = 6,
  RAINBOW = 7,
  FRUIT_SALAD = 8,
  CMF = 9
}
```

Every `Scheme*` class is a thin constructor overload around `super({ ... })`
that only selects the `variant` enum and passes the source colors through.
`SchemeMonochrome` is representative (`variants.ts:149-174`):

```ts
export class SchemeMonochrome extends DynamicScheme {
  constructor(
    sourceColorHct: Hct, isDark: boolean, contrastLevel: number
  );
  constructor(
    sourceColorHcts: Hct[], isDark: boolean, contrastLevel: number
  );
  constructor(sourceColorOrList: Hct | Hct[], isDark: boolean, contrastLevel: number) {
    super({
      sourceColorHcts: Array.isArray(sourceColorOrList)
        ? sourceColorOrList
        : [sourceColorOrList],
      variant: Variant.MONOCHROME,
      contrastLevel,
      isDark
    });
  }
}
```

All 10 classes accept either a single `Hct` or an `Hct[]` — the array form feeds
the multi-source variants (CONTENT, FIDELITY, CMF). The variant enum value is the
only behavioral difference; every other decision is delegated to the palette
spec (`DynamicScheme` constructor, `dynamic-scheme.ts:161-209`).

## Where palettes come from: `PaletteTokens`

The variant's entire identity lives in `PaletteTokens` (`src/spec/palettes.ts`),
a switch over `Variant` with one method per palette family:
`getPrimaryPalette` (`palettes.ts:76-122`), `getSecondaryPalette`
(`palettes.ts:124-178`), `getTertiaryPalette` (`palettes.ts:180-246`),
`getNeutralPalette` (`palettes.ts:248-292`), `getNeutralVariantPalette`
(`palettes.ts:323-379`) and `getErrorPalette` (`palettes.ts:381-404`).

Two helper patterns recur:

- **`TonalPalette.fromHueAndChroma(hue, chroma)`** — builds a palette with a
  fixed hue and chroma (the standard path). Hue comes from the source hue
  directly, from `sanitizeDegreesDouble(sourceColorHct.hue - 50)`
  (rotation), or from `DynamicScheme.getRotatedHue` — a piecewise hue rotation
  over breakpoints (`dynamic-scheme.ts:253-297`).
- **`TonalPalette.fromHct(hct)`** — takes an *existing* color's hue/chroma,
  used by FIDELITY/CONTENT tertiary palettes derived from `TemperatureCache`.

The neutral-variant palette is almost always the neutral palette's chroma
scaled by a factor (e.g. tonal-spot: `5 * 1.7`, `palettes.ts:350`; neutral:
`1.4 * 2.2`, `palettes.ts:342-344`), keeping the two "grey" palettes family-consistent.

## The shared tone-delta-pair wiring

A crucial fact: **tone delta pairs and contrast curves are identical across all
10 variants.** They are wired once in `spec/tokens.ts`, not per variant. Every
accent family uses `ToneDeltaPair(container, base, 5, 'relative_lighter', true, 'farther')`
(`tokens.ts:377-385`, `515-523`, `644-652`, `774-782`) and the fixed families
use `exact` 5-darker pairs (`tokens.ts:468-476`). So variants differ only in
*palette selection*; the *tonal architecture* (container 5 tones toward the
light end, "on-" roles at 4.5-6:1, fixed roles frozen in light mode) is constant.
See [tone-delta-pair.md](./tone-delta-pair.md) and
[color-roles.md](./color-roles.md).

The only variant-specific *role* behavior is the CMF surface handling: in CMF
the surface roles turn on `chromaMultiplier` (1.0-1.7) to tint surfaces, and the
dark-mode surface tone shifts to 4 instead of 6 (`tokens.ts:100-101`,
`119-147`). For all other variants surfaces are forced achromatic.

## Per-variant reference

### 1. Monochrome

> A Dynamic Color theme that is grayscale. — `variants.ts:148`

Every palette uses `chroma: 0.0` — primary, secondary, tertiary, neutral and
neutral variant all produce strictly grey colors (`palettes.ts:91-92`, `143`,
`202-203`, `263-264`, `338-339`). Hue is preserved (the source hue) but is
meaningless at chroma 0.

The one exception is **error**: `getErrorPalette` returns `undefined` for
MONOCHROME, so the scheme falls back to the hardcoded `(hue 25, chroma 84)` red
(`dynamic-scheme.ts:201-209`). Monochrome is therefore *not* fully grayscale —
the error role stays red by design, because error must remain recognizable
regardless of theme.

### 2. Neutral

> A Dynamic Color theme that is near grayscale. — `variants.ts:176`

Primary chroma is 8, secondary 4, tertiary (a rotated hue at chroma 20),
neutral 1.4, neutral variant ~3.08 (`palettes.ts:93-99`, `144-150`, `204-212`,
`265-269`, `340-344`). If the source hue is blue (250-270, `hct.ts:126-128`)
chroma is boosted to 12/6 — blue reads less saturated at a given chroma than
other hues, so it needs a higher value to *look* equally colorful.

The tertiary hue is rotated by `getRotatedHue` over breakpoints `[0, 38, 105,
161, 204, 278, 333, 360]` with rotations `[-32, 26, 10, -39, 24, -15, -32]`
(`palettes.ts:205-210`), pulling it toward a different hue family for a hint of
variety. Error gets a piecewise hue (`getErrorPalette`) at chroma 50.

### 3. Tonal Spot

> A Dynamic Color theme with low to medium colorfulness and a Tertiary
> TonalPalette with a hue related to the source color. The default Material You
> theme on Android 12 and 13. — `variants.ts:234-239`

Primary: source hue, chroma **26 in dark / 32 in light** (`palettes.ts:102-106`).
Secondary: source hue, chroma 16 (`palettes.ts:153-154`). Tertiary: rotated hue
(breakpoints `[0, 20, 71, 161, 333, 360]`, rotations `[-40, 48, -32, 40, -32]`),
chroma 28 (`palettes.ts:215-221`). Neutral: 5; neutral variant: 8.5
(`palettes.ts:272-276`, `347-351`). Error hue from the piecewise table at chroma
60.

The name says it all: the *spot* of color lands on primary, with everything else
deliberately muted. This is the reference Material You look — a strong accent on
a near-neutral field.

### 4. Vibrant

> A Dynamic Color theme that maxes out colorfulness at each position in the
> Primary Tonal Palette. — `variants.ts:267-270`

Primary chroma is a flat **74** (`palettes.ts:112-116`), the highest of any
variant. Secondary is a rotated hue at chroma 56 (`palettes.ts:164-172`);
tertiary a different rotated hue at 56 (`palettes.ts:232-240`); neutral at 28
(`palettes.ts:310-321`) is the most colorful neutral of any variant — and even
the neutral *variant* multiplies that by 1.29 (`palettes.ts:364-373`). Error
chroma 80.

Vibrant keeps the source hue only in the primary palette; secondary/tertiary are
rotated with small offsets (-14/10) so they stay harmonically close. The effect
is a theme that is saturated almost everywhere.

### 5. Expressive

Primary: source hue, chroma **36 dark / 48 light** (`palettes.ts:107-111`) —
the most colorful non-vibrant primary. Secondary: a wide rotation set over
breakpoints `[0, 105, 140, 204, 253, 278, 300, 333, 360]`
(`palettes.ts:155-163`), chroma 16/24. Tertiary: another wide rotation
(`palettes.ts:223-231`), chroma 48. Neutral: `getExpressiveNeutralHue` (rotation
`[10, 0, 10, 0, 10, 0]` over `[0, 71, 124, 253, 278, 300, 360]`) at chroma 18 in
light, 14 in dark (or 6 if the neutral hue is yellow) (`palettes.ts:294-308`).
Neutral variant multiplies that by 2.3 (or 1.6 near the yellow band 105-125,
`palettes.ts:352-363`).

Expressive is the palette default for `palette()` in the public API
(`color.ts:379`). Its strategy: strong chroma, hues that wander far from the
seed, and the most colorful neutrals outside Vibrant.

### 6. Fidelity

> A scheme that places the source color in `Scheme.primaryContainer`. Primary
> Container is the source color, adjusted for color relativity. It maintains
> constant appearance in light mode and dark mode. This adds ~5 tone in light
> mode, and subtracts ~5 tone in dark mode. Tertiary Container is the complement
> to the source color, using `TemperatureCache`. — `variants.ts:82-90`

Fidelity is the variant that *trusts the seed*. Primary is the source hue and
chroma verbatim (`palettes.ts:83-85`). Secondary keeps the source hue at the
larger of `chroma - 32` or `chroma * 0.5` (`palettes.ts:132-136`). Tertiary is
the seed's *complement* from `TemperatureCache.complement`
(`palettes.ts:196-199`), passed through `DislikeAnalyzer.fixIfDisliked` to avoid
the muddy yellow-green zone humans dislike (`science/dislike-analyzer.ts:52-54`).
Neutral is `chroma / 8` and neutral variant `chroma / 8 + 4`
(`palettes.ts:255-260`, `330-335`) — the more colorful the seed, the more
colorful even the greys.

The role wiring then places that primary exactly where the class comment says:
`primaryContainer` clamps the source *tone* into the light band (61-90) or dark
band (30-49) (`tokens.ts:410-417`), which is the "+5 / -5 for color relativity".

### 7. Content

The class doc comment is identical to Fidelity's (`variants.ts:16-24`), and
the primary, secondary, neutral and neutral-variant palettes are identical
(`palettes.ts:83-85`, `132-136`, `255-260`, `330-335`). The **only** difference
is the tertiary palette: Content uses the third color of the seed's *analogous
set* — `new TemperatureCache(sourceColorHct).analogous(3, 6)[2]` — instead of the
complement (`palettes.ts:187-195`). The analogous set is computed by walking the
hue wheel in temperature steps (`science/temperature.ts:65-147`); index 2 picks a
neighbor hue rather than the opposite one, so Content's tertiary stays *related*
to the seed instead of opposing it. Content is the natural fit for app content
(images, avatars) whose colors should feel derived from the seed.

### 8. Rainbow

> A playful theme - the source color's hue does not appear in the theme.
> — `variants.ts:203-205`

Primary is source hue at chroma 48 (`palettes.ts:100-101`); secondary source hue
at 16 (`palettes.ts:151-152`); tertiary rotated hue at 28 (`palettes.ts:215-221`,
same rotation as Tonal Spot); neutral at **0** (`palettes.ts:270-271`) — fully
grey, unlike the tinted neutrals of Expressive/Vibrant. Error falls back to the
hardcoded (25, 84) red.

The name reflects the *behavior*: a strong, saturated primary sitting on pure
greys, which reads like a single pop of rainbow color. See the accuracy notes
below about the class comment.

### 9. Fruit Salad

> A playful theme - the source color's hue does not appear in the theme.
> — `variants.ts:118-120`

The comment is accurate here. Primary is `sourceHue - 50` at chroma 48
(`palettes.ts:86-90`), secondary `sourceHue - 50` at chroma 36
(`palettes.ts:137-141`) — both rotated a fixed 50 degrees off the seed, so the
seed's hue genuinely does not appear. Tertiary *does* keep the source hue, at
chroma 36 (`palettes.ts:200-201`); neutral at 10, neutral variant at 16
(`palettes.ts:261-262`, `336-337`). Error falls back to the hardcoded red.

The effect is a cheerful multi-hue palette: the two accents sit together on the
wheel while tertiary and the tinted greys stay near the seed.

### 10. CMF

> A Dynamic Color theme with 2 source colors. — `variants.ts:298-300`

CMF ("Custom Material Framework") is the outlier: it does **not** delegate to
`PaletteTokens`. It builds all six palettes explicitly in its constructor
(`variants.ts:317-362`), and `PaletteTokens` throws for `Variant.CMF`
(`palettes.ts:117-118`, `173-174`, etc.) — the scheme never calls it because
every palette is supplied in the options.

Given a first source (`primarySource`) and an optional second
(`secondarySource`), it wires (`variants.ts:324-350`):

- **primary**: first source hue/chroma verbatim.
- **secondary**: first source hue, chroma `* 0.5`.
- **tertiary**: if no second source exists, first source hue at chroma `* 0.75`;
  otherwise the **second** source's hue/chroma.
- **neutral** and **neutral variant**: both first source hue at chroma `* 0.2`.
- **error**: hue from `SchemeCmf.getErrorHue(primaryHue, tertiaryHue)` — a
  piecewise table of 9 hue bands (`variants.ts:365-385`) that nudges the error
  hue away from the source hues so error stays distinguishable — at
  `Math.max(chroma, 50)`.

Only the *first* extra source is consumed (`variants.ts:320`); further sources
are ignored. The role wiring then gives CMF its distinctive surfaces: the
surface `chromaMultiplier` turns on (tinted surfaces) and dark surface drops to
tone 4 (`tokens.ts:100-101`, `119-147`).

## Comparison table

All chroma values are the palette chroma; "rotated" means a `getRotatedHue`
rotation set is applied. "c" = source chroma.

| Variant | Primary (hue / chroma) | Secondary (hue / chroma) | Tertiary (hue / chroma) | Neutral chroma | Error chroma | Signature |
|---|---|---|---|---|---|---|
| Monochrome | source / 0 | source / 0 | source / 0 | 0 | 84 (hardcoded) | pure grey |
| Neutral | source / 8 (12 if blue) | source / 4 (6 if blue) | rotated / 20 | 1.4 | 50 | near-grey |
| Tonal Spot | source / 32-26 | source / 16 | rotated / 28 | 5 | 60 | spot of color |
| Vibrant | source / 74 | rotated / 56 | rotated / 56 | 28 | 80 | max saturation |
| Expressive | source / 48-36 | rotated / 24-16 | rotated / 48 | 6-18 | 64 | wandering hues |
| Fidelity | source / c | source / max(c-32, c·0.5) | complement | c/8 | 84 (hardcoded) | trust the seed |
| Content | source / c | source / max(c-32, c·0.5) | analogous[2] | c/8 | 84 (hardcoded) | seed-derived |
| Rainbow | source / 48 | source / 16 | rotated / 28 | 0 | 84 (hardcoded) | pop of color on grey |
| Fruit Salad | source-50 / 48 | source-50 / 36 | source / 36 | 10 | 84 (hardcoded) | hue shifted |
| CMF | source / c | source / c·0.5 | 2nd source or c·0.75 | c·0.2 | errorHue, max(c, 50) | two sources |

Tone-delta pairs and contrast curves are identical across all ten; the table's
differences are entirely palette selection.

## Design rationale

- **Chroma scales with how much luminance a mode offers.** Tonal Spot and
  Expressive use *more* primary chroma in light mode (32/48) than dark (26/36).
  Dark surfaces are near-black, and at very low tones the gamut cannot display
  high chroma; light mode has more headroom, so the spec spends it.
- **Primary vs secondary vs tertiary chroma encodes hierarchy.** In every
  colorful variant, primary chroma >= secondary chroma. Primary carries the
  brand color; secondary is a quieter companion (tonal spot 32 vs 16, vibrant
  74 vs 56); tertiary is a *different hue* at medium chroma. The perceived
  hierarchy — what should be the loudest element — is baked into the numbers.
- **Hue rotations keep families distinct.** Neutrals, secondary and tertiary
  use `getRotatedHue` so a green seed doesn't produce a green secondary and a
  green tertiary and a green grey. Expressive uses the widest rotations
  (up to ~170 degrees), Vibrant the tightest (-14/10), which is why Expressive
  "wanders" and Vibrant stays harmonically close.
- **Fidelity/Content scale chroma *from the seed* rather than fixing it.** Their
  chroma values are expressions of `sourceColorHct.chroma` (verbatim, `c - 32`,
  `c/8`, `c·0.5`), because the whole point of these variants is that the theme
  *is* the seed.
- **Error is tuned per variant but never *themed*.** Its chroma (50-84) is high
  in every variant, and five variants use the hardcoded (25, 84) red rather than
  any seed-derived value. Error must be instantly recognizable, so it is
  deliberately kept outside the variant's creative latitude.
- **Monochrome isn't really monochrome.** The hardcoded error red means a
  "grayscale" theme still ships a red error. This is upstream M3 behavior and is
  intentional: accessibility constraints outrank stylistic purity.

## Accuracy notes

- The "playful theme - the source color's hue does not appear in the theme"
  comment is attached to **both** `SchemeRainbow` (`variants.ts:203-205`) and
  `SchemeFruitSalad` (`variants.ts:118-120`). It is accurate for Fruit Salad
  (primary/secondary rotate the hue by -50) but **not** for Rainbow, whose
  primary and secondary keep the source hue (`palettes.ts:100-101`,
  `151-152`). The comment is a copy-paste artifact.
- `SchemeCmf` ignores all but the first extra source (`variants.ts:320`),
  despite being documented as a "2 source colors" theme.
- The two dead helpers `isFidelity` and `isMonochrome`
  (`spec/token-utils.ts:19-25`) are exported but never referenced.
- `getNeutralPalette`/`getNeutralVariantPalette` return `undefined`-throwing
  errors for CMF (`palettes.ts:287-288`, `374-375`), but this is unreachable
  because `SchemeCmf` always supplies its palettes explicitly.
