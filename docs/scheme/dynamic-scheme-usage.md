# DynamicScheme in the Library: Usage

- [The public entry point: `palette()`](#the-public-entry-point-palette)
- [`generateColorPalette`: instantiating the scheme](#generatecolorpalette-instantiating-the-scheme)
- [The role accessors -> Palette map](#the-role-accessors---palette-map)
- [Light and dark, side by side](#light-and-dark-side-by-side)
- [Scheme subclasses as direct API](#scheme-subclasses-as-direct-api)
- [Accuracy notes](#accuracy-notes)

## The public entry point: `palette()`

The library's one-call theme generator is `palette()` (`src/color.ts:370-393`).
It converts a hex seed to HCT, maps the public variant name to the internal
enum, and generates two schemes:

```ts
export function palette(
  color: ColorValue,
  options?: { variant?: Variant; contrastLevel?: number; extraColors?: T },
): Theme & { light: Palette & ExtraPalette<T> ...; dark: ... } {
  const variant = options?.variant ?? "expressive";
  const contrastLevel = options?.contrastLevel ?? 0;
  const source = Hct.fromInt(toNumber(color));
  const internalVariant = toInternalVariant(variant);
  const light = generateColorPalette(source, internalVariant, false, contrastLevel);
  const dark = generateColorPalette(source, internalVariant, true, contrastLevel);
  // ...
  return { color, light, dark } as any;
}
```

`toInternalVariant` (`color.ts:395-418`) maps the public string union to the
internal `scheme.Variant` enum — `"expressive"` -> `InternalVariant.EXPRESSIVE`,
`"cmf"` -> `InternalVariant.CMF`, and so on, exhaustively covering all ten.

## `generateColorPalette`: instantiating the scheme

The scheme is constructed in `generateColorPalette` (`color.ts:420-431`):

```ts
function generateColorPalette(
  source: Hct,
  variant: InternalVariant,
  dark: boolean,
  contrastLevel: number,
): Palette {
  const scheme = new DynamicScheme({
    variant,
    sourceColorHct: source,
    isDark: dark,
    contrastLevel,
  });
  // ...
}
```

This is the canonical, minimal instantiation: four fields, no palettes. The
constructor derives all six `TonalPalette`s from the variant via
`getSpec().getPrimaryPalette(...)` etc. (`dynamic-scheme.ts:161-209`), which is
where all of [variants.md](./variants.md) comes into play. Nothing else needs
configuring: the 53 role accessors are already wired through `ColorRoles`
(`dynamic-scheme.ts:211`).

## The role accessors -> Palette map

The function then reads every role accessor on the scheme and converts the ARGB
integer to a hex string via `fromNumber` (an alias for `hexFromArgb`,
`color.ts:27-29`). The return object keys are the public kebab-case token names
(`color.ts:433-487`):

```ts
return {
  primary: fromNumber(scheme.primary),
  "primary-dim": fromNumber(scheme.primaryDim),
  "on-primary": fromNumber(scheme.onPrimary),
  "primary-container": fromNumber(scheme.primaryContainer),
  "on-primary-container": fromNumber(scheme.onPrimaryContainer),
  // ... 49 more roles
};
```

Each accessor is `this.getArgb(this.colors.primary())`, and `getArgb` memoizes
the resolution per role name (`dynamic-scheme.ts:299-310`) — important because
the 53 roles form a dense dependency graph (containers reference surfaces,
"on-" roles reference their base, tone-delta pairs reference each other), and
without the cache the recursion would resolve the same role many times.

The `Palette` type (defined in `src/types.ts`) covers all 53 roles: the 9-role
primary/secondary/tertiary families, the 5-role error family, the surface
family, `background`/`on-background`, `outline`/`outline-variant`, `shadow`,
`scrim`, `surface-tint`, `inverse-surface`, `inverse-on-surface` and
`inverse-primary`.

## Light and dark, side by side

`palette()` calls `generateColorPalette` twice with the *same* source and
variant, differing only in `dark`:

```ts
const light = generateColorPalette(source, internalVariant, false, contrastLevel);
const dark = generateColorPalette(source, internalVariant, true, contrastLevel);
```

`isDark` influences three things downstream:

1. **Palette selection** for Tonal Spot and Expressive, which pick different
   primary chroma per mode (`palettes.ts:102-106`, `107-111`).
2. **Role tone tables** — surfaces (`tokens.ts:95-107`), `inverseSurface`
   (`tokens.ts:282-298`), `onSurface`'s curve selection (`tokens.ts:255`).
3. **The tone solver** — through `ToneDeltaPair`'s `relative_*` polarity sign
   flip (`color-calculation.ts:72-77`) and the `isDark` checks throughout
   `tokens.ts`.

Because every role is a function of the scheme, both modes are generated from
stateless, shared role definitions (`ColorRoles`/`ColorTokens` singletons); only
the two `DynamicScheme` instances differ.

## Scheme subclasses as direct API

Beyond `palette()`, the `Scheme*` subclasses are exported directly from
`src/scheme/index.ts` (`scheme/index.ts:12-18`), so advanced users can
instantiate a scheme themselves — e.g. with multi-source seeds for Content,
Fidelity or CMF, or with explicitly overridden palettes:

```ts
import { SchemeExpressive, Hct } from "@panmdaa/colors";

const scheme = new SchemeExpressive(Hct.fromInt(0xff4285f4), true, 0.5);
const primary = scheme.primary; // ARGB integer
```

This is also how `SchemeCmf` exercises the palette-override path: it computes
its six palettes and passes them in the options (`variants.ts:351-362`), which
bypasses `PaletteTokens` entirely.

## Accuracy notes

- `generateColorPalette` is a module-private helper (`color.ts:420`); the only
  public instantiation path is `palette()` (and the exported `Scheme*`
  subclasses). Neither accepts custom palettes directly.
- `palette()` defaults the variant to `"expressive"` (`color.ts:379`), not
  Tonal Spot — even though Tonal Spot is the reference Material You theme. The
  choice is deliberate in this library: Expressive is the general-purpose
  default with balanced chroma.
- The default `contrastLevel` is 0 (`color.ts:380`), which is the spec-defined
  standard; negative values (minimum contrast) and positive values up to 1
  (maximum contrast) are accepted and flow straight into the `ContrastCurve`
  and tone-delta resolution.
- The scheme's `toString()` reports `spec=2026` (`dynamic-scheme.ts:228`), a
  marker of the palette/token spec generation used by the library.
