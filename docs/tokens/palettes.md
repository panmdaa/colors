# The Palette Specifications (`src/spec/palettes.ts`)

- [What `PaletteTokens` is](#what-palettetokens-is)
- [The delegate contract](#the-delegate-contract)
- [The six palettes and what they mean](#the-six-palettes-and-what-they-mean)
- [How a variant maps to palette hue and chroma](#how-a-variant-maps-to-palette-hue-and-chroma)
  - [Primary palette](#primary-palette)
  - [Secondary palette](#secondary-palette)
  - [Tertiary palette](#tertiary-palette)
  - [Neutral and neutral variant palettes](#neutral-and-neutral-variant-palettes)
  - [Error palette](#error-palette)
- [Special sources: analogous, complement, and rotated hue](#special-sources-analogous-complement-and-rotated-hue)
- [What this file does NOT do](#what-this-file-does-not-do)
- [The CMF exception](#the-cmf-exception)
- [Singleton and consumption](#singleton-and-consumption)
- [Why palettes and tokens are separate specs](#why-palettes-and-tokens-are-separate-specs)
- [Further reading](#further-reading)

## What `PaletteTokens` is

`palettes.ts` defines `PaletteTokens` (`palettes.ts:71`), a class with six
methods, one per tonal palette. Each method answers a single question: *given a
variant and a seed color, what hue and chroma does this palette live at?* The
result is always a `TonalPalette` — an object of constant hue and chroma that
can produce a color for any tone (`tonal-palette.ts:18-91`).

Like `ColorTokens`, this class is purely declarative. It contains no tone
logic — tones are the job of `tokens.ts` and `color-calculation.ts`. Here it
decides *where on the color wheel* each family sits and *how colorful* it is.

## The delegate contract

The public methods implement `PaletteTokensDelegate` (`palettes.ts:24-66`),
which documents the shape the scheme machinery expects:

```ts
interface PaletteTokensDelegate {
	getPrimaryPalette(variant, sourceColorHct, isDark, contrastLevel): TonalPalette;
	getSecondaryPalette(variant, sourceColorHct, isDark, contrastLevel): TonalPalette;
	getTertiaryPalette(variant, sourceColorHct, isDark, contrastLevel): TonalPalette;
	getNeutralPalette(variant, sourceColorHct, isDark, contrastLevel): TonalPalette;
	getNeutralVariantPalette(variant, sourceColorHct, isDark, contrastLevel): TonalPalette;
	getErrorPalette(variant, sourceColorHct, isDark, contrastLevel): TonalPalette | undefined;
}
```

Note that `contrastLevel` is accepted but unused (every implementation names it
`_contrastLevel`). Palette hue/chroma does not depend on contrast — contrast
only changes tones, which live in the token layer. `isDark` **is** used, but
only to pick between two chroma values (e.g. `getPrimaryPalette`,
`palettes.ts:105`). This asymmetry is exactly why the split between palettes
and tokens exists.

## The six palettes and what they mean

| Palette | Method | Design intent |
| ------- | ------ | ------------- |
| Primary | `getPrimaryPalette` (`palettes.ts:76`) | The main accent family. Keeps the seed's hue; chroma varies most across variants. |
| Secondary | `getSecondaryPalette` (`palettes.ts:124`) | A softer accent. Chroma is derived from the seed but reduced. |
| Tertiary | `getTertiaryPalette` (`palettes.ts:180`) | A contrasting third hue, often rotated or computed from temperature. |
| Neutral | `getNeutralPalette` (`palettes.ts:248`) | Near-gray, for surfaces, backgrounds, and outlines. |
| Neutral variant | `getNeutralVariantPalette` (`palettes.ts:323`) | Slightly more colorful neutral, for elevation steps. |
| Error | `getErrorPalette` (`palettes.ts:381`) | A reddish palette anchored to a piecewise error hue. |

## How a variant maps to palette hue and chroma

Each palette method is a `switch` over `Variant` (`variant.ts:17-27`). The
following tables summarize the real branches with their line numbers.

### Primary palette

`getPrimaryPalette` (`palettes.ts:82-121`):

| Variant | Hue | Chroma | Code |
| ------- | --- | ------ | ---- |
| `CONTENT`, `FIDELITY` | seed hue | seed chroma | `palettes.ts:83-85` |
| `FRUIT_SALAD` | seed hue − 50° | 48 | `palettes.ts:86-90` |
| `MONOCHROME` | seed hue | 0 | `palettes.ts:91-92` |
| `NEUTRAL` | seed hue | blue seed ? 12 : 8 | `palettes.ts:93-99` |
| `RAINBOW` | seed hue | 48 | `palettes.ts:100-101` |
| `TONAL_SPOT` | seed hue | dark ? 26 : 32 | `palettes.ts:102-106` |
| `EXPRESSIVE` | seed hue | dark ? 36 : 48 | `palettes.ts:107-111` |
| `VIBRANT` | seed hue | 74 | `palettes.ts:112-116` |
| `CMF` | — | throws | `palettes.ts:117-118` |

The story reads off the table: `MONOCHROME` zeroes chroma, `NEUTRAL` nearly
zeroes it, `VIBRANT` pushes it to 74, and `TONAL_SPOT`/`EXPRESSIVE` tune chroma
by mode. `Hct.isBlue` (`palettes.ts:96`) is a hue-region check (blue seeds need
a touch more chroma to avoid looking washed out).

### Secondary palette

`getSecondaryPalette` (`palettes.ts:124-178`). Secondary chroma is generally
smaller than primary. Notable branches:

| Variant | Hue | Chroma | Code |
| ------- | --- | ------ | ---- |
| `CONTENT`, `FIDELITY` | seed hue | `max(chroma − 32, chroma × 0.5)` | `palettes.ts:131-136` |
| `FRUIT_SALAD` | seed hue − 50° | 36 | `palettes.ts:137-141` |
| `MONOCHROME` | seed hue | 0 | `palettes.ts:142-143` |
| `NEUTRAL` | seed hue | blue seed ? 6 : 4 | `palettes.ts:144-150` |
| `RAINBOW` | seed hue | 16 | `palettes.ts:151-152` |
| `TONAL_SPOT` | seed hue | 16 | `palettes.ts:153-154` |
| `EXPRESSIVE` | rotated hue | dark ? 16 : 24 | `palettes.ts:155-163` |
| `VIBRANT` | rotated hue | 56 | `palettes.ts:164-172` |

The `max(chroma − 32, chroma × 0.5)` formula (`palettes.ts:135`) caps how much
chroma secondary can have relative to the seed — secondary must always be
visually subordinate to primary.

### Tertiary palette

`getTertiaryPalette` (`palettes.ts:180-246`) is where the palette spec becomes
science-heavy. `CONTENT` and `FIDELITY` derive tertiary from the color
*temperature* model instead of the seed directly:

- `CONTENT` takes the second analogous color of the seed's temperature cache:
  `new TemperatureCache(sourceColorHct).analogous(3, 6)[2]`, run through
  `DislikeAnalyzer.fixIfDisliked` (`palettes.ts:188-195`).
- `FIDELITY` uses the *complement* of the seed in temperature space, also
  dislike-fixed (`palettes.ts:196-199`).

The other variants rotate hue via `DynamicScheme.getRotatedHue`
(`dynamic-scheme.ts:286-297`), which applies a piecewise rotation per hue band
(e.g. `NEUTRAL` at `palettes.ts:205-212`, `VIBRANT` at `palettes.ts:232-240`).
Every rotation uses fixed chroma values: 20 for `NEUTRAL`, 28 for
`RAINBOW`/`TONAL_SPOT`, 48 for `EXPRESSIVE`, 56 for `VIBRANT`, and 36 for
`FRUIT_SALAD` (`palettes.ts:201`, `palettes.ts:215-222`, `palettes.ts:224-231`,
`palettes.ts:233-240`).

### Neutral and neutral variant palettes

`getNeutralPalette` (`palettes.ts:248-292`) keeps chroma near zero but not
always at zero — neutral surfaces carry a whisper of the seed hue:

| Variant | Chroma | Code |
| ------- | ------ | ---- |
| `CONTENT`, `FIDELITY` | `seed chroma / 8` | `palettes.ts:257-260` |
| `FRUIT_SALAD` | 10 | `palettes.ts:261-262` |
| `MONOCHROME` | 0 | `palettes.ts:263-264` |
| `NEUTRAL` | 1.4 | `palettes.ts:265-269` |
| `RAINBOW` | 0 | `palettes.ts:270-271` |
| `TONAL_SPOT` | 5 | `palettes.ts:272-276` |
| `EXPRESSIVE` | computed | `palettes.ts:277-281` |
| `VIBRANT` | 28 (from rotated neutral hue) | `palettes.ts:282-286` |

`EXPRESSIVE` and `VIBRANT` route through private helpers that rotate the neutral
hue (`getExpressiveNeutralHue` `palettes.ts:294-300`,
`getVibrantNeutralHue` `palettes.ts:310-316`) and, for `EXPRESSIVE`, pick chroma
by mode and yellow-ness (`getExpressiveNeutralChroma` `palettes.ts:302-308`).

`getNeutralVariantPalette` (`palettes.ts:323-379`) mirrors the neutral logic but
with slightly higher chroma — the visual step up that Material uses for
elevated surfaces. It reuses the neutral hue helpers, scaling chroma with
different factors (e.g. `NEUTRAL`: `1.4 × 2.2` at `palettes.ts:341-344`,
`TONAL_SPOT`: `5 × 1.7` at `palettes.ts:347-351`, `EXPRESSIVE`: `×1.6` or
`×2.3` depending on the rotated hue band at `palettes.ts:352-363`, `VIBRANT`:
`×1.29` at `palettes.ts:364-373`).

### Error palette

`getErrorPalette` (`palettes.ts:381-404`) is different in two ways:

1. The **hue** is independent of the variant. It is computed once via a
   piecewise function `DynamicScheme.getPiecewiseHue` (`dynamic-scheme.ts:253-263`)
   that maps seed hue bands to the canonical error reds:
   `[0, 3, 13, 23, 33, 43, 153, 273, 360]` → `[12, 22, 32, 12, 22, 32, 22, 12]`
   (`palettes.ts:387-391`).
2. It returns `undefined` for most variants (`palettes.ts:402`) and only
   produces a palette for `NEUTRAL` (chroma 50), `TONAL_SPOT` (60),
   `EXPRESSIVE` (64), and `VIBRANT` (80) (`palettes.ts:393-400`).

When it returns `undefined`, `DynamicScheme` substitutes the canonical error
palette `TonalPalette.fromHueAndChroma(25.0, 84.0)` (`dynamic-scheme.ts:201-209`).
This keeps error visible and recognizable even in variants that suppress
chroma elsewhere.

## Special sources: analogous, complement, and rotated hue

Three derivation techniques recur in `palettes.ts`:

- **Analogous (`CONTENT` tertiary)** — walk the temperature cache's color wheel
  and take the neighbor two steps over (`palettes.ts:190-194`).
- **Complement (`FIDELITY` tertiary)** — take the temperature-opposite color
  (`palettes.ts:198`).
- **Rotated hue (`EXPRESSIVE`, `VIBRANT`, `NEUTRAL` tertiary/neutral)** — apply
  a per-band hue rotation so the family lands at a predictable offset from the
  seed (`palettes.ts:206-212`, `palettes.ts:233-240`).

These are the mechanisms that make tertiary *feel* like a deliberate third hue
instead of a tint of primary — the palette spec is where Material's color
"personality" is encoded.

## What this file does NOT do

This is the accuracy-critical point: **`palettes.ts` does not map roles to
palettes, and it does not compute tones.** There is no "which role uses which
palette" table here, and no container-vs-plain tone mapping. Those live in
`tokens.ts`:

- The role → palette mapping is the `palette:` callback in each token, e.g.
  `primary` samples `s.primaryPalette` (`tokens.ts:371`), `surface` samples
  `s.neutralPalette` (`tokens.ts:98`), and the error roles sample
  `s.errorPalette` (`tokens.ts:767`).
- The container vs plain tone distinction is in the tokens too: compare
  `primary`'s source-tone strategy (`tokens.ts:372-373`) with
  `primaryContainer`'s clamped strategy (`tokens.ts:410-417`).

`palettes.ts` only fixes the *hue and chroma* each palette carries. The tone for
a given role is then solved by `color-calculation.ts` against that palette.

## The CMF exception

`PaletteTokens` throws `Unsupported variant: CMF` in every palette method
(`palettes.ts:118`, `palettes.ts:174`, `palettes.ts:242`, `palettes.ts:288`,
`palettes.ts:375`). The CMF variant is therefore **not** describable by this
spec: `SchemeCmf` (`variants.ts:301`) builds all six palettes by hand from the
seed — e.g. primary at seed hue/chroma (`variants.ts:324-327`), secondary at
half the seed chroma (`variants.ts:328-331`), tertiary from the optional second
source color (`variants.ts:332-338`) — and passes them explicitly to the
`DynamicScheme` constructor via the `args.primaryPalette`-style options
(`variants.ts:351-360`). Because `DynamicScheme` falls back to
`getSpec().get*Palette` only when no palette is provided
(`dynamic-scheme.ts:161-209`), CMF sidesteps the spec entirely.

## Singleton and consumption

`PaletteTokens` is instantiated once and exposed through a getter
(`palettes.ts:407-411`):

```ts
const spec2025 = new PaletteTokens();

export function getSpec(): PaletteTokens {
	return spec2025;
}
```

`DynamicScheme` calls `getSpec()` for all six palettes in its constructor
(`dynamic-scheme.ts:161-209`). The pattern mirrors the calculation engine's
singleton in `color-calculation.ts:203-210`: spec objects are stateless, so one
instance shared across every scheme avoids reallocating them per theme.

## Why palettes and tokens are separate specs

The separation encodes two independent dimensions of the Material system:

- **What you can vary** (palette hue/chroma) is per-*variant* — it changes with
  theme style, not with the role.
- **How a role behaves** (tone, contrast) is per-*role* — it changes with the
  role, not with the variant.

Putting both in one table would force every variant change to re-declare every
role. Splitting them means the set of variants and the set of roles can each
grow independently, and the two files stay small enough to audit against the
Material spec document line by line.

## Further reading

- [overview.md](./overview.md) — the spec layer composition
- [tokens.md](./tokens.md) — the role declarations that sample these palettes
- [color-calculation.md](./color-calculation.md) — how tones are solved against a palette
- [../scheme/overview.md](../scheme/overview.md) — how `TonalPalette`s feed `DynamicScheme`
- [../science/temperature.md](../science/temperature.md) — analogous/complement hue derivation
