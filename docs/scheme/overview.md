# The DynamicScheme Architecture

- [What DynamicScheme is](#what-dynamicscheme-is)
- [The scheme -> role -> palette -> tone chain](#the-scheme---role---palette---tone-chain)
- [How a scheme is constructed](#how-a-scheme-is-constructed)
- [How roles are wired](#how-roles-are-wired)
- [Resolving a concrete color: `getArgb`](#resolving-a-concrete-color-getargb)
- [The accessor surface](#the-accessor-surface)
- [Why this design](#why-this-design)

## What DynamicScheme is

`DynamicScheme` is the container that turns four scalar inputs — a source HCT
color, a `Variant`, an `isDark` flag and a `contrastLevel` — into the six tonal
palettes and the `ColorRoles` wiring that every Material role token needs.

Its own doc comment puts it plainly (`dynamic-scheme.ts:61-66`):

> Constructed by a set of values representing the current UI state (such as
> whether or not its dark theme, what the theme style is, etc.), and provides a
> set of TonalPalettes that can create colors that fit in with the theme style.
> Used by DynamicColor to resolve into a color.

A `DynamicScheme` is state, not behavior. All the intelligence — how a role
picks its tone, how contrast is enforced — lives in `DynamicColor` and in the
`spec/` delegates. The scheme just holds the palettes and exposes thin accessors.

## The scheme -> role -> palette -> tone chain

The resolution chain has four layers, and understanding it makes every other
doc in this directory easy:

```
DynamicScheme.getArgb(role)
  -> role.getArgb(scheme)                          (DynamicColor, dynamic-color.ts:196)
    -> getSpec().getArgb(scheme, color)            (spec/color-calculation.ts:33)
      -> palette = color.palette(scheme)           (a TonalPalette from the scheme)
      -> tone    = color.getTone(scheme)           (the whole contrast solver)
      -> palette.tone(tone)                        (ARGB integer out)
```

Each piece answers one question:

1. **Scheme** decides *which* `TonalPalette` each family gets (primary,
   secondary, tertiary, neutral, neutral variant, error). That choice is the
   variant's entire identity (see [variants.md](./variants.md)).
2. **Role** (`DynamicColor`) decides *which tone* to ask for, given the scheme.
   The tone is computed by a solver that honors background contrast curves and
   tone delta pairs (see [dynamic-color.md](./dynamic-color.md)).
3. **Palette** (`TonalPalette`) is a function `tone -> ARGB` with a fixed
   hue/chroma, so once the tone is known the color is fully determined
   (`tonal-palette.ts:58-69`).
4. **Tone** is the single degree of freedom left after hue and chroma are fixed
   by the palette — which is exactly why the whole M3 system is "tonal".

## How a scheme is constructed

The constructor signature is `DynamicSchemeOptions` (`dynamic-scheme.ts:47-59`).
Of the nine fields, four describe UI state and six are palettes:

```ts
interface DynamicSchemeOptions {
  sourceColorHct?: Hct;
  sourceColorHcts?: Hct[];
  variant: Variant;
  contrastLevel: number;
  isDark: boolean;
  primaryPalette?: TonalPalette;
  secondaryPalette?: TonalPalette;
  tertiaryPalette?: TonalPalette;
  neutralPalette?: TonalPalette;
  neutralVariantPalette?: TonalPalette;
  errorPalette?: TonalPalette;
}
```

The constructor (`dynamic-scheme.ts:142-212`) does three things:

1. **Normalizes the source color.** If `sourceColorHcts` (a list) is given it is
   kept as-is and its first element becomes `sourceColorHct`; otherwise a single
   `sourceColorHct` is wrapped into a one-element list. Supplying neither throws
   (`dynamic-scheme.ts:143-156`). The list form exists because the `CONTENT` and
   `FIDELITY` variants (and CMF) derive palettes from *multiple* seeds — the
   `tertiary` role even reads its tone from `sourceColorHcts[1]`
   (`tokens.ts:638-640`).
2. **Materializes the six palettes.** Each one is taken from the options if
   provided, otherwise derived from the variant via the palette spec:
   `getSpec().getPrimaryPalette(variant, sourceColorHct, isDark, contrastLevel)`
   (`dynamic-scheme.ts:161-168`). The palette spec lives in
   `src/spec/palettes.ts` (see [variants.md](./variants.md)). The error palette
   is the only one with a hard fallback: if the variant does not define one,
   `TonalPalette.fromHueAndChroma(25.0, 84.0)` — the canonical M3 error red —
   is used (`dynamic-scheme.ts:201-209`).
3. **Instantiates the role wiring**: `this.colors = new ColorRoles()`
   (`dynamic-scheme.ts:211`).

## How roles are wired

The scheme holds one `ColorRoles` instance (`dynamic-scheme.ts:140`). `ColorRoles`
(`color-roles.ts:20`) is a thin facade: each of its ~50 methods returns a
`DynamicColor`, delegating to a shared `ColorTokens` singleton
(`color-roles.ts:23`, defined in `src/spec/tokens.ts`).

For example `primary()` is just:

```ts
primary(): DynamicColor {
  return ColorRoles.colorSpec.primary();
}
```

The real wiring — which palette, which tone rule, which background, which
contrast curve, which tone-delta pair — lives in `spec/tokens.ts`. `primary`
(`tokens.ts:368-387`) is representative:

```ts
primary(): DynamicColor {
  return DynamicColor.fromPalette({
    name: 'primary',
    palette: (s) => s.primaryPalette,
    tone: (s) =>
      s.sourceColorHct.chroma <= 12 ? (s.isDark ? 80 : 40) : s.sourceColorHct.tone,
    isBackground: true,
    background: (s) => this.highestSurface(s),
    contrastCurve: () => getCurve(4.5),
    toneDeltaPair: () =>
      new ToneDeltaPair(
        this.primaryContainer(),
        this.primary(),
        5,
        'relative_lighter',
        true,
        'farther'
      )
  });
}
```

This single factory call is the whole contract: the palette and tone are *the
intent*, and `background` + `contrastCurve` + `toneDeltaPair` are *the
constraints* that the tone solver re-resolves the tone against.

## Resolving a concrete color: `getArgb`

The scheme caches resolved values per role name (`dynamic-scheme.ts:299-310`):

```ts
getArgb(dynamicColor: DynamicColor): number {
  const name = dynamicColor.name;
  if (name) {
    const cached = this.resolved.get(name);
    if (cached !== undefined) return cached;
  }
  const value = dynamicColor.getArgb(this);
  if (name) this.resolved.set(name, value);
  return value;
}
```

Resolution is memoized by the role's `name`. This matters because the tone
solver is recursive — `primaryContainer` resolves against `highestSurface`,
which resolves `surfaceBright`/`surfaceDim`, which resolve `surface`, and a
tone-delta pair makes two roles resolve against each other. Without the cache
the same role would be solved dozens of times per scheme. `DynamicColor` has its
own per-scheme HCT cache on top (`dynamic-color.ts:208-219`).

Note `getArgb` caches *ARGB* values only; `getHct` (`dynamic-scheme.ts:312-314`)
always recomputes through the dynamic color.

## The accessor surface

The scheme exposes ~50 role accessors, each one a one-liner over `getArgb`
(`dynamic-scheme.ts:342-562`). They fall into four groups:

- **Palette key colors** — `primaryPaletteKeyColor`, `secondaryPaletteKeyColor`,
  etc. (`dynamic-scheme.ts:318-340`). Each resolves the palette's *key color*
  (the tone that most represents the palette's hue/chroma, see
  `tonal-palette.ts:93-165`).
- **Surfaces** — `background`, `surface`, `surfaceDim`, `surfaceBright`, the
  five `surfaceContainer*` steps, `onSurface`, `surfaceVariant`,
  `onSurfaceVariant`, `inverseSurface`, `inverseOnSurface`, `outline`,
  `outlineVariant`, `shadow`, `scrim`, `surfaceTint` (`dynamic-scheme.ts:344-422`).
- **The four accent families** — `primary`/`secondary`/`tertiary`/`error` and
  their `*Dim`, `on*`, `*Container`, `on*Container`, `*Fixed`, `*FixedDim`,
  `on*Fixed`, `on*FixedVariant` companions (`dynamic-scheme.ts:424-562`).
- **Inverse roles** — `inversePrimary` (`dynamic-scheme.ts:462-464`).

Each getter is literally `return this.getArgb(this.colors.primary())`, and the
`ColorRoles`/`ColorTokens` split means the scheme never needs to change when a
role's tone rule changes.

## Why this design

The split exists so that the *intent* of a role (which palette, which tone) is
declared independently of the *constraints* that adjust it (contrast curves,
tone delta pairs), and both are computed independently of the *UI state* that
selects the palette (the variant). That is a clean three-way separation of
concerns:

- **State** (`DynamicScheme`) — the variant, mode, contrast level, palettes.
- **Roles** (`ColorRoles` + `ColorTokens`) — what each of the 53 tokens means.
- **Math** (`spec/color-calculation.ts`) — how a tone is solved from a role's
  intent plus its constraints.

Because every role is a *function of the scheme* rather than a stored value, a
single `ColorRoles` instance serves any number of schemes, and the whole system
is trivially testable: build a scheme, read a role, assert on the ARGB.
