# The ColorRoles Factory

- [What ColorRoles is](#what-colorroles-is)
- [The delegation to ColorTokens](#the-delegation-to-colortokens)
- [The five role families](#the-five-role-families)
  - [Accent roles: primary / secondary / tertiary](#accent-roles-primary--secondary--tertiary)
  - [Error roles](#error-roles)
  - [Fixed roles](#fixed-roles)
  - [Surface roles](#surface-roles)
  - [Special roles](#special-roles)
- [Which roles use the neutral palettes](#which-roles-use-the-neutral-palettes)
- [`allColors` and the dead `contentAccentToneDelta`](#allcolors-and-the-dead-contentaccenttonedelta)
- [Why a factory (and not a list)](#why-a-factory-and-not-a-list)

## What ColorRoles is

`ColorRoles` is "DynamicColors for the colors in the Material Design system"
(`color-roles.ts:16-19`). It is a factory: each of its ~50 methods builds and
returns a `DynamicColor` for one Material role token. `DynamicScheme` holds one
instance and calls these methods from its accessors (`dynamic-scheme.ts:140`,
`211`; each getter like `primary` is `getArgb(this.colors.primary())`).

It is important to be precise about where the wiring actually lives: `ColorRoles`
is a *facade*. Every method delegates to a shared `ColorTokens` singleton
(`color-roles.ts:23`), which is defined in `src/spec/tokens.ts`:

```ts
export class ColorRoles {
  static contentAccentToneDelta = 15.0;

  private static readonly colorSpec = new ColorTokens();

  // ...

  primary(): DynamicColor {
    return ColorRoles.colorSpec.primary();
  }
}
```

So `color-roles.ts` owns the *shape* of the role set (names, groups, the
`allColors` list) and `spec/tokens.ts` owns the *wiring* (palette, tone rule,
background, contrast curve, tone delta pair). When this doc says "the roles are
wired", the authoritative source is `tokens.ts`.

## The delegation to ColorTokens

The delegation is literal and mechanical (`color-roles.ts:145-147`,
`color-roles.ts:281-299`):

```ts
primary(): DynamicColor {
  return ColorRoles.colorSpec.primary();
}
```

Every method in `color-roles.ts` follows this one-line shape. The file's real
value is structural: it organizes the 53 roles into commented groups —
Main Palettes (`color-roles.ts:29-56`), Surfaces (`color-roles.ts:57-139`),
Primaries (`color-roles.ts:141-167`), Primary Fixed (`color-roles.ts:169-187`),
Secondaries (`color-roles.ts:189-231`), Tertiaries (`color-roles.ts:233-275`),
Errors (`color-roles.ts:277-299`) — and exposes `highestSurface`
(`color-roles.ts:25-27`), the reference background used by every text role:

```ts
highestSurface(s: DynamicScheme): DynamicColor {
  return ColorRoles.colorSpec.highestSurface(s);
}
```

`highestSurface` itself resolves to `surfaceBright` in dark mode and
`surfaceDim` in light mode (`tokens.ts:829-831`). The *highest* surface in dark
mode is the brightest; the *highest* in light mode is the darkest — in both
cases the surface that gives text the most room to contrast.

## The five role families

### Accent roles: primary / secondary / tertiary

The three accent families share the identical wiring *shape*, differing only in
which palette and tone rule they use. `primary` (`tokens.ts:368-387`) is
representative:

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
      new ToneDeltaPair(this.primaryContainer(), this.primary(), 5, 'relative_lighter', true, 'farther')
  });
}
```

Three details stand out:

- **The low-chroma guard**: if the source seed has chroma <= 12 (a near-neutral
  seed), `primary` abandons the source tone and snaps to T80 (dark) / T40
  (light) — the canonical M3 primary tones — so a desaturated seed still yields
  a legible accent (`tokens.ts:372-373`).
- **`onPrimary`** (`tokens.ts:397-404`) has *no tone rule*: its tone starts from
  its background's tone (`getInitialToneFromBackground`, `dynamic-color.ts:94-101`)
  and is pushed to a 6:1 ratio against `primary` by the solver. That is the
  "on-" contract: the foreground always *matches* its background's lightness and
  is then pushed to the far side of the tone scale.
- **`primaryContainer`** (`tokens.ts:406-422`) derives its tone from the source
  *tone*, flipped across the awkward zone: `sourceColorHct.tone > 55 ? clamp(61, 90, ...) : clamp(30, 49, ...)`. A dark source seed yields a *light* container
  (T61-90) and a light seed a *dark* container (T30-49), so the container always
  reads as the complement in lightness to the seed. In light mode with a
  low-chroma seed it is pinned to T90 (`tokens.ts:410-413`).

`secondary` differs only in tone source: it uses the tonal-palette *extremes*
— `tMinC(secondaryPalette)` in dark, `tMaxC` in light (`tokens.ts:509-511`) —
the tones that maximize chroma at each end of the scale, and its container uses
bounded versions `tMinC(..., 20, 49)` / `tMaxC(..., 61, 90)`
(`tokens.ts:544-557`).

`tertiary` is unique: its tone comes from the *second* source color when one is
provided — `s.sourceColorHcts[1]?.tone ?? s.sourceColorHct.tone`
(`tokens.ts:638-640`) — and its container reads the same second source
(`tokens.ts:673-687`). This is what lets multi-seed variants (CONTENT, FIDELITY,
CMF) put a genuinely different color in the tertiary family.

### Error roles

`error` (`tokens.ts:764-784`) uses the error palette and the same container
pair as the accents, with `tone: tMaxC(s.errorPalette)` — the tone of maximum
chroma — as its base, and `errorContainer` taking `tMinC`/`tMaxC` by mode
(`tokens.ts:803-814`). `onError` rides `error` at 6:1 (`tokens.ts:794-801`).
The error palette itself is special: only NEUTRAL/TONAL_SPOT/EXPRESSIVE/VIBRANT
define one (`spec/palettes.ts:381-404`); every other variant falls back to the
hardcoded `(hue 25, chroma 84)` red (`dynamic-scheme.ts:201-209`).

### Fixed roles

The `*Fixed` family (`tokens.ts:447-499`) guarantees a color that is identical
across light and dark. `primaryFixed`'s tone is "what `primaryContainer` would
be in a light, standard-contrast scheme":

```ts
tone: (s) => {
  const tempS = Object.assign({}, s, { isDark: false, contrastLevel: 0 });
  return this.primaryContainer().getTone(tempS);
}
```

(`tokens.ts:451-454`). `*FixedDim` sits exactly 5 tones darker via an `exact`
pair (`tokens.ts:468-476`), and `onPrimaryFixed`/`onPrimaryFixedVariant` choose
their background dynamically: they sit on `primaryFixedDim` when the fixed tone
is above 57, else on `primaryFixed` (`tokens.ts:481-499`). This two-background
arrangement is what exercises the dual-background solver in
`color-calculation.ts:162-199`.

### Surface roles

Surfaces are the only roles that use the neutral palettes (see below). They are
pure tone tables with `isBackground: true` and no contrast curves
(`tokens.ts:95-241`):

| Role | Tone (dark / light) | Chroma multiplier (non-CMF) |
|------|--------------------|-----------------------------|
| `surface` | 6 / 98 | 0 |
| `surfaceDim` | 4 / 87 | 0 |
| `surfaceBright` | 24 / 98 | 0 |
| `surfaceContainerLowest` | 0 / 100 | 0 |
| `surfaceContainerLow` | 10 / 96 | 0 |
| `surfaceContainer` | 12 / 94 | 0 |
| `surfaceContainerHigh` | 17 / 92 | 0 |
| `surfaceContainerHighest` | 22 / 90 | 0 |

The container ladder steps 4-6 tones apart (0, 10, 12, 17, 22) in dark mode and
(100, 96, 94, 92, 90) in light mode, giving UI surfaces a subtle elevation
progression. Every surface role sets `chromaMultiplier: 0` for non-CMF variants,
forcing an achromatic result (see
[dynamic-color.md](./dynamic-color.md#palette-vs-tone-the-2-step-split)); in CMF
the multipliers turn on (1.0-1.7) to tint the surfaces with the seed's hue
(`tokens.ts:119-147`, `193-241`).

### Special roles

- `background` is a clone of `surface` with only the name changed
  (`tokens.ts:78-83`); `onBackground` is a clone of `onSurface` whose tone rule
  forwards to `onSurface` (`tokens.ts:85-93`).
- `surfaceVariant` is a clone of `surfaceContainerHighest` (`tokens.ts:259-264`);
  `surfaceTint` is a clone of `primary` (`tokens.ts:357-362`).
- `inverseSurface` swaps the tone table (98 dark / 4 light, `tokens.ts:282-298`),
  and `inverseOnSurface` rides it at 7:1 (`tokens.ts:300-307`).
- `inversePrimary` uses the tone of *maximum chroma* in the primary palette
  (`tMaxC`, `tokens.ts:433-441`).
- `outline` (3:1) and `outlineVariant` (1.5:1) sit on `highestSurface`
  (`tokens.ts:309-339`); `shadow` and `scrim` are fixed at tone 0
  (`tokens.ts:341-355`).

## Which roles use the neutral palettes

Two families draw from the neutral palettes:

- **`neutralPalette`** — `surface`, `surfaceDim`, `surfaceBright`, the five
  `surfaceContainer*` steps, `onSurface`, `surfaceVariant`, `onSurfaceVariant`,
  `outline`, `outlineVariant`, `inverseSurface`, `inverseOnSurface`, `shadow`,
  `scrim` (and `background`/`onBackground` as clones).
- **`neutralVariantPalette`** — no role consumes it directly. It is exposed as a
  scheme palette (`dynamic-scheme.ts:193-200`), used by the palette key-color
  getter (`color-roles.ts:49-51`) and by CMF, but every *role* that could have
  used it is wired to `neutralPalette` instead. The `neutralVariantPalette`
  exists so downstream consumers can opt into a slightly more colorful neutral
  family.

Accent roles (`primary`/`secondary`/`tertiary`/`error`) use their own palettes;
only the error palette is not variant-driven.

## `allColors` and the dead `contentAccentToneDelta`

`ColorRoles` exposes `allColors` (`color-roles.ts:305-355`): a flat array of the
48 non-key-color roles (all surfaces, accents, fixed, inverse and error roles,
plus `onBackground`). It is filtered with `(c) => c !== undefined`, though no
method currently returns `undefined` — the filter is defensive.

One genuine wart: `static contentAccentToneDelta = 15.0`
(`color-roles.ts:21`) is declared but never read anywhere in `src/`. It is a
vestigial constant from the upstream design (a 15-tone offset used for content
accents in some M3 implementations). Do not rely on it.

## Why a factory (and not a list)

Roles must be built *lazily and per-scheme*: a role's constructor takes
functions of `DynamicScheme`, and those functions close over *other roles*
(`primaryContainer` closes over `highestSurface`, `onPrimaryFixed` closes over
both fixed roles). A factory method re-creates those closures fresh on every
call, which is what lets a single `ColorRoles`/`ColorTokens` pair serve any
number of schemes. An array literal would have forced roles to be built once,
capturing the first scheme they were created against — the exact bug the
function-of-scheme design exists to prevent.
