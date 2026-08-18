# The `palette()` Function

- [Signature](#signature)
- [Options](#options)
  - [`variant`](#variant)
  - [`contrastLevel`](#contrastlevel)
  - [`extraColors`](#extracolors)
- [How a palette is built](#how-a-palette-is-built)
  - [1. Seed color to HCT](#1-seed-color-to-hct)
  - [2. Variant mapping](#2-variant-mapping)
  - [3. Light and dark schemes](#3-light-and-dark-schemes)
  - [4. The 53 role accessors](#4-the-53-role-accessors)
  - [5. Custom token merge](#5-custom-token-merge)
- [Return value](#return-value)
- [The `extend-theme` internals](#the-extend-theme-internals)

## Signature

`palette()` is the single entry point for theme generation (`color.ts:370-393`):

```ts
export function palette<
  T extends Record<string, ColorValue | CustomTokenOptions> = Record<string, never>,
>(
  color: ColorValue,
  options?: { variant?: Variant; contrastLevel?: number; extraColors?: T },
): Theme & {
  light: Palette & ExtraPalette<T> & Record<string, ColorValue>;
  dark: Palette & ExtraPalette<T> & Record<string, ColorValue>;
}
```

The generic parameter `T` is optional and defaults to an empty record; it exists
so that custom tokens passed via `extraColors` are reflected in the return type.
The return type is a `Theme` (`{ color, light, dark }`, `types.ts:72`) whose
`light` and `dark` palettes are each the standard 53-role `Palette`, augmented
by the mapped `ExtraPalette<T>` type and an escape hatch `Record<string,
ColorValue>`.

## Options

### `variant`

```ts
const variant = options?.variant ?? "expressive";   // color.ts:379
```

The variant selects which design style drives the scheme. The public `Variant`
type (`types.ts:80`) is translated to the internal `scheme.Variant` enum by
`toInternalVariant` (`color.ts:395-418`):

| Public variant | Internal enum |
| -------------- | ------------- |
| `'cmf'` | `InternalVariant.CMF` |
| `'content'` | `InternalVariant.CONTENT` |
| `'expressive'` | `InternalVariant.EXPRESSIVE` |
| `'fidelity'` | `InternalVariant.FIDELITY` |
| `'fruit-salad'` | `InternalVariant.FRUIT_SALAD` |
| `'monochrome'` | `InternalVariant.MONOCHROME` |
| `'neutral'` | `InternalVariant.NEUTRAL` |
| `'rainbow'` | `InternalVariant.RAINBOW` |
| `'tonal-spot'` | `InternalVariant.TONAL_SPOT` |
| `'vibrant'` | `InternalVariant.VIBRANT` |

The default is `'expressive'`, Material 3's "the hue is rotated around the
wheel, chroma is stronger, tones are offset" style — a good general-purpose
default because it keeps chroma for both accents and neutrals.

### `contrastLevel`

```ts
const contrastLevel = options?.contrastLevel ?? 0;   // color.ts:380
```

Passed straight through to `DynamicScheme` (`color.ts:383-384`). Per the scheme
contract, it is a value from -1 to 1: -1 is minimum contrast, 0 is the
spec-defined standard, 1 is maximum contrast. The `palette()` wrapper defaults
it to 0 (standard).

### `extraColors`

Custom design tokens merged into both palettes after scheme generation
(`color.ts:386-390`). Each entry can be a plain `ColorValue` string or a
`CustomTokenOptions` descriptor (`types.ts:98-109`):

```ts
export interface CustomTokenOptions {
  from?: keyof Palette;          // copy an existing role, optionally adjusted
  adjust?: { hue?: number; chroma?: number; tone?: number };
  harmonize?: ColorValue;        // pull a hex toward the seed hue
  random?: boolean;              // pseudo-random HCT around the seed
  gradient?: GradientOptions;    // emit {name}-{i} / on-{name}-{i} tokens
  mix?: (ColorValue | keyof Palette)[];  // blend existing roles / hexes
}
```

For every non-`on-` token name, a companion `on-{name}` token is generated
automatically (`extend-theme.ts:144-152`).

## How a palette is built

### 1. Seed color to HCT

```ts
const source = Hct.fromInt(Color.toNumber(color));
```

The hex seed is converted to an ARGB integer (`Color.toNumber`) and then to an
`Hct` object — the HCT color space that the whole scheme pipeline is built on.

### 2. Variant mapping

`toInternalVariant(variant)` (`color.ts:395`) switches over the public string
union and returns the matching internal enum value. Note that every case is
exhaustive: because `Variant` is a closed union, TypeScript guarantees the
switch covers all ten variants and no `default` branch is needed.

### 3. Light and dark schemes

```ts
const light = generateColorPalette(source, internalVariant, false, contrastLevel);
const dark = generateColorPalette(source, internalVariant, true, contrastLevel);
```

Both modes are generated from the **same** source HCT and variant; the only
difference is the `isDark` flag. `generateColorPalette` (`color.ts:420-488`)
constructs one `DynamicScheme` per mode:

```ts
const scheme = new DynamicScheme({
  variant,
  sourceColorHct: source,
  isDark: dark,
  contrastLevel,
});
```

`DynamicScheme` (in `src/scheme/dynamic-scheme.ts`) turns the variant + source
+ mode + contrast into a set of `TonalPalette`s, and its 53 token accessors
(`scheme.primary`, `scheme.onPrimary`, ...) resolve each role into an ARGB
integer using those palettes.

### 4. The 53 role accessors

`generateColorPalette` then maps every role accessor through `Color.fromNumber`
into the `Palette` object (`color.ts`):

```ts
return {
  primary: Color.fromNumber(scheme.primary).hex,
  "primary-dim": Color.fromNumber(scheme.primaryDim).hex,
  "on-primary": Color.fromNumber(scheme.onPrimary).hex,
  "primary-container": Color.fromNumber(scheme.primaryContainer).hex,
  // ... 49 more role tokens
};
```

The 53 roles are grouped by color family:

- **primary** (9): `primary`, `primary-dim`, `on-primary`, `primary-container`,
  `on-primary-container`, `primary-fixed`, `primary-fixed-dim`,
  `on-primary-fixed`, `on-primary-fixed-variant`
- **secondary** (9): the same nine-token family
- **tertiary** (9): the same nine-token family
- **error** (5): `error`, `error-dim`, `on-error`, `error-container`,
  `on-error-container`
- **background / surface** (13): `background`, `on-background`, `surface`,
  `surface-dim`, `surface-bright`, the five `surface-container-*` steps,
  `surface-variant`, `on-surface`, `on-surface-variant`
- **outline** (2): `outline`, `outline-variant`
- **miscellaneous** (6): `shadow`, `scrim`, `surface-tint`,
  `inverse-surface`, `inverse-on-surface`, `inverse-primary`

### 5. Custom token merge

If `extraColors` was provided, `resolveCustomTokens` (`extend-theme.ts:114-159`)
computes light and dark custom-token records and both are merged onto the
generated palettes:

```ts
if (options?.extraColors) {
  const extra = resolveCustomTokens(light, dark, color, options.extraColors);
  Object.assign(light, extra.light);
  Object.assign(dark, extra.dark);
}
```

## Return value

```ts
return { color, light, dark } as any;   // color.ts:392
```

A plain object carrying the original seed, the light palette, and the dark
palette. The `as any` cast is deliberate: the true compile-time shape is the
generic `Theme & { light: Palette & ExtraPalette<T> ... }` computed by the
mapped types, which cannot be expressed by the runtime object literal.

## The `extend-theme` internals

`resolveCustomTokens` (`extend-theme.ts:114`) is the engine behind
`extraColors`. Per token it:

1. Normalizes the name to kebab-case (`toKebabCase`, `extend-theme.ts:21-26`)
   so `myToken` and `my_token` both become `my-token`.
2. Short-circuits gradient tokens: each one becomes `{name}-{i}` +
   `on-{name}-{i}` for every step, computed from the **light** palette
   endpoints (`extend-theme.ts:128-132`, `resolveGradient` at 161).
3. Classifies the token as *mode-independent* (plain hex, `harmonize`, or
   `random`) or *mode-dependent* (`from`/`adjust`/`mix`):
   - mode-independent tokens are resolved once against the **light** palette and
     shared by both modes (`extend-theme.ts:134-138`). Notably both branches
     pass `light` as the mode palette (`extend-theme.ts:135`); the value is the
     same in light and dark.
   - mode-dependent tokens are resolved per mode against `light` and `dark`
     separately (`extend-theme.ts:140-141`).
4. Generates a `on-{name}` companion with `generateOn`
   (`extend-theme.ts:28-32`): if the base tone is >= 60 the "on" token goes to
   tone 10, otherwise to tone 90 — a fixed, non-ratio-guaranteed pairing. This
   is a deliberately different rule from `onColor` (which uses a ratio and a
   `>= 55` threshold); see [color-manipulation.md](./color-manipulation.md).

The final merge `{ ...lightTokens, ...sharedTokens }`
(`extend-theme.ts:156-157`) means shared (mode-independent) tokens take
precedence over mode-specific ones if a name collides.
