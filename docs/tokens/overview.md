# The Spec Layer (`src/spec/`)

- [What the spec layer is](#what-the-spec-layer-is)
- [The four responsibilities](#the-four-responsibilities)
- [Why three files instead of one](#why-three-files-instead-of-one)
- [How the layer bridges `DynamicScheme` to the public `Palette`](#how-the-layer-bridges-dynamicscheme-to-the-public-palette)
- [The role-name contract](#the-role-name-contract)
- [The 53 roles at a glance](#the-53-roles-at-a-glance)
- [Why role names are the stable public contract](#why-role-names-are-the-stable-public-contract)
- [Why declarative data instead of hardcoded logic](#why-declarative-data-instead-of-hardcoded-logic)
- [Further reading](#further-reading)

## What the spec layer is

The `src/spec/` directory is the declarative heart of theme generation. It
answers three questions that the rest of the library treats as separate
concerns:

1. **Which roles exist** and how each behaves — `src/spec/tokens.ts` (832 lines)
2. **Which palettes they sample from**, per variant — `src/spec/palettes.ts` (411 lines)
3. **How a role resolves to a concrete color** — `src/spec/color-calculation.ts` (210 lines)

A fourth file, `src/spec/token-utils.ts` (118 lines), holds shared math helpers
used by the others. The barrel `src/spec/index.ts` is deliberately minimal:

```ts
export * from './tokens';    // index.ts:12
export * from './palettes';  // index.ts:13
```

`color-calculation.ts` and `token-utils.ts` are **not** exported from the
barrel. They are internal machinery: `color-calculation.ts` is imported by
`DynamicColor` (`dynamic-color.ts:16`) and `token-utils.ts` is imported by
`tokens.ts:19`. The public entry point of the package (`src/index.ts`) does not
re-export `spec` at all — this layer exists to serve the scheme machinery, not
library users.

## The four responsibilities

| File | Class / exports | Responsibility | Consumers |
| ---- | --------------- | -------------- | --------- |
| `tokens.ts` | `ColorTokens` (`tokens.ts:21`) | Declares every Material role as a `DynamicColor`: name, palette selector, tone function, contrast curve, tonal pairing | `ColorRoles` (`color-roles.ts:23`) |
| `palettes.ts` | `PaletteTokens` (`palettes.ts:71`) + `PaletteTokensDelegate` | Declares the six tonal palettes: given a variant, what hue and chroma each palette has | `DynamicScheme` constructor (`dynamic-scheme.ts:161-209`) |
| `color-calculation.ts` | `ColorCalculationDelegateBase` (`color-calculation.ts:32`) | The engine that turns a `DynamicColor` + a `DynamicScheme` into a tone, an `Hct`, or an ARGB integer | `DynamicColor.getArgb/getHct/getTone` (`dynamic-color.ts:196-231`) |
| `token-utils.ts` | `getCurve`, `tMaxC`, `tMinC`, ... | Shared math: tone-at-max-chroma search, contrast curve construction | `tokens.ts:19` |

## Why three files instead of one

The split mirrors the two axes along which Material roles vary independently:

- **Palette** = *hue and chroma*. Which colors the family lives in. This is the
  axis the 10 variants differ on (vibrant wants high chroma, monochrome wants
  none).
- **Role** = *tone and contrast behavior*. Which tone of that hue/chroma a role
  sits at, and how it moves when contrast changes.

A single hardcoded function that interleaved both would be a 1,000+ line switch
that is impossible to audit. Instead the library composes them:

```
variant + seed
     │
     ▼
palettes.ts ──► six TonalPalettes (hue + chroma per variant)
     │                  │
     ▼                  ▼
tokens.ts ──► one DynamicColor per role (tone + contrast per role)
     │                  │
     ▼                  ▼
color-calculation.ts ──► final ARGB per role
```

Because the two files are orthogonal, adding a new variant means touching only
`palettes.ts` (plus a case in `variants.ts`); adding a new role means touching
only `tokens.ts`. Neither change forces the other.

## How the layer bridges `DynamicScheme` to the public `Palette`

The pipeline runs in four hops:

1. **`DynamicScheme` builds its palettes.** The constructor calls
   `getSpec().getPrimaryPalette(...)`, `getSecondaryPalette`, and so on for all
   six palettes, falling back to the default error palette
   `TonalPalette.fromHueAndChroma(25.0, 84.0)` when `getErrorPalette` returns
   `undefined` (`dynamic-scheme.ts:201-209`).

2. **`ColorRoles` exposes the tokens.** `ColorRoles` wraps a single shared
   `ColorTokens` instance (`color-roles.ts:23`) and forwards one method per
   role:

   ```ts
   primary(): DynamicColor {
       return ColorRoles.colorSpec.primary();   // color-roles.ts:145-147
   }
   ```

   `ColorRoles` also carries `allColors`, the list of resolvable roles
   (`color-roles.ts:305-355`).

3. **`DynamicScheme` resolves each role to an ARGB integer.** Every scheme
   getter (from `primaryPaletteKeyColor` at `dynamic-scheme.ts:318` through
   `onErrorContainer` at `dynamic-scheme.ts:560`) calls
   `this.getArgb(this.colors.<role>())`. `getArgb` caches the result per role
   name (`dynamic-scheme.ts:299-310`). `DynamicColor.getArgb` itself delegates
   to the calculation engine (`dynamic-color.ts:196-198`).

4. **`color.ts` assembles the public `Palette`.** `generateColorPalette`
   (`color.ts:420-488`) reads 53 scheme accessors and maps each ARGB integer
   through `fromNumber` into the kebab-cased `Palette` object returned to the
   caller of `palette()` (`color.ts:370-393`).

The spec layer is the connective tissue: `palettes.ts` feeds the scheme's
palettes, `tokens.ts` feeds the roles, and `color-calculation.ts` executes both.

## The role-name contract

Role names cross three naming conventions on their way from spec to public API:

| Layer | Form | Example |
| ----- | ---- | ------- |
| `DynamicColor.name` | snake_case | `'surface_container_lowest'` (`tokens.ts:152`) |
| `ColorRoles` / `DynamicScheme` accessors | camelCase | `scheme.surfaceContainerLowest` (`dynamic-scheme.ts:364`) |
| Public `Palette` keys | kebab-case | `'surface-container-lowest'` (`types.ts:54`) |

There is no single automatic converter between the three. The public keys are
hardcoded in `generateColorPalette` (`color.ts:433-487`); only *custom* token
names are normalized, via `toKebabCase` in `extend-theme.ts:21-26`. See
[tokens.md](./tokens.md) and [token-utils.md](./token-utils.md) for the details.

## The 53 roles at a glance

The public `Palette` interface (`types.ts:16-70`) enumerates exactly 53 roles,
grouped by family:

- **primary, secondary, tertiary** (9 each): base, `-dim`, `on-`, `-container`,
  `on- -container`, `-fixed`, `-fixed-dim`, `on- -fixed`,
  `on- -fixed-variant`
- **error** (5): `error`, `error-dim`, `on-error`, `error-container`,
  `on-error-container`
- **background / surface** (13): `background`, `on-background`, `surface`,
  `surface-dim`, `surface-bright`, the five `surface-container-*` steps,
  `surface-variant`, `on-surface`, `on-surface-variant`
- **outline** (2): `outline`, `outline-variant`
- **miscellaneous** (6): `shadow`, `scrim`, `surface-tint`, `inverse-surface`,
  `inverse-on-surface`, `inverse-primary`

The families are delimited by the banner comments in `tokens.ts` (`[S]`
surfaces at `tokens.ts:74`, `[P]` primaries at `tokens.ts:364`, `[PF]` primary
fixed at `tokens.ts:443`, `[Q]` secondaries at `tokens.ts:501`, `[QF]`
secondary fixed at `tokens.ts:568`, `[T]` tertiaries at `tokens.ts:630`, `[TF]`
tertiary fixed at `tokens.ts:698`, `[E]` errors at `tokens.ts:760`) — the same
letter scheme Google uses in its Material color documentation.

## Why role names are the stable public contract

The `Palette` interface is what `palette()` returns and what `generateCSS`
turns into CSS custom properties (`css-props.ts:19-30`). Because Material 3
specifies a fixed set of roles, freezing them as a TypeScript interface
(`types.ts:16`) gives the library three guarantees for free:

1. **Compiler-checked completeness** — `generateColorPalette`'s object literal
   is checked against `Palette`; a missing role is a type error, not a runtime
   surprise.
2. **Stable CSS output** — the kebab-case keys are the exact CSS custom
   property suffixes (`--color-primary-dim: ...`), so documentation and
   generated stylesheets can never drift apart.
3. **A bounded extension point** — `extraColors` in `palette()` keys off
   `keyof Palette` for `CustomTokenOptions.from` (`types.ts:99`), so custom
   tokens can reference real roles and stay type-safe.

## Why declarative data instead of hardcoded logic

Consider the alternative: a single function `computePalette(variant, source,
isDark, contrastLevel)` with nested `switch` statements for every one of the 53
roles. It would conflate three independently changing dimensions — variant,
role, and contrast level — producing a combinatorial explosion of branches
(10 variants × 53 roles) that no human can reason about.

The spec layer instead encodes each dimension once:

- `palettes.ts` encodes "this variant's primary family lives at this hue and
  chroma" as a single line per variant (e.g. `getPrimaryPalette`,
  `palettes.ts:82-121`).
- `tokens.ts` encodes "this role's tone and contrast behavior" as a single
  `DynamicColor.fromPalette` descriptor, independent of variant.
- `color-calculation.ts` encodes "how tones get solved under contrast and
  pairing constraints" once, as generic logic that never mentions a specific
  role.

The result is that behavior is **data-shaped**: roles are declared, variants are
tables, and only the solving algorithm is imperative. This mirrors the "spec"
naming — the layer is a machine-readable transcription of the Material design
spec rather than a pile of branches.

## Further reading

- [tokens.md](./tokens.md) — the `ColorTokens` declarations in depth
- [palettes.md](./palettes.md) — the per-variant palette tables
- [color-calculation.md](./color-calculation.md) — the tone-solving engine
- [token-utils.md](./token-utils.md) — the shared math helpers
- [../scheme/color-roles.md](../scheme/color-roles.md) — how roles are wired to the scheme
- [../api/palette.md](../api/palette.md) — the public `palette()` entry point
