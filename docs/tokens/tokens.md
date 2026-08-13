# The Token Specification (`src/spec/tokens.ts`)

- [What `ColorTokens` is](#what-colortokens-is)
- [The structure of a token](#the-structure-of-a-token)
- [The token naming scheme](#the-token-naming-scheme)
- [Real token entries](#real-token-entries)
  - [The `primary` family](#the-primary-family)
  - [Surfaces](#surfaces)
  - [Fixed colors freeze light-mode tones](#fixed-colors-freeze-light-mode-tones)
  - [Errors](#errors)
  - [Aliases built from clones](#aliases-built-from-clones)
- [Tone patterns shared across families](#tone-patterns-shared-across-families)
- [How tokens enumerate what gets exported](#how-tokens-enumerate-what-gets-exported)
- [Why the structure looks like this](#why-the-structure-looks-like-this)
- [Further reading](#further-reading)

## What `ColorTokens` is

`tokens.ts` defines a single class, `ColorTokens` (`tokens.ts:21`), with one
method per role. Each method returns a `DynamicColor` — a self-describing
object that says *what palette to sample*, *what tone to start from*, and *what
contrast and tonal-pairing constraints to honor*. The class is purely
declarative: it never computes a color itself. Computing is delegated to
`color-calculation.ts` (see [color-calculation.md](./color-calculation.md)).

`ColorTokens` is consumed by `ColorRoles` (`color-roles.ts:23`), which forwards
each token to `DynamicScheme`'s accessors.

## The structure of a token

Every token is built through `DynamicColor.fromPalette` (`dynamic-color.ts:80-92`),
whose options (`dynamic-color.ts:48-58`) are:

```ts
interface FromPaletteOptions {
	name?: string;
	palette: (scheme: DynamicScheme) => TonalPalette;      // which palette to sample
	tone?: (scheme: DynamicScheme) => number;              // baseline tone (0-100)
	chromaMultiplier?: (scheme: DynamicScheme) => number;  // scale chroma (default 1)
	isBackground?: boolean;                                // background-role flag
	background?: (scheme: DynamicScheme) => DynamicColor | undefined;
	secondBackground?: (scheme: DynamicScheme) => DynamicColor | undefined;
	contrastCurve?: (scheme: DynamicScheme) => ContrastCurve | undefined;
	toneDeltaPair?: (scheme: DynamicScheme) => ToneDeltaPair | undefined;
}
```

Note that the real code does **not** store a `darkTone`/`lightTone` pair. Tone is
a single function of the scheme, and light/dark behavior is expressed as an
`isDark` conditional *inside* that function. Similarly, the container/plain
distinction is not a dedicated "container" flag — it is a combination of the
`isBackground` flag, the background role, and the contrast curve. For example
`primaryContainer` is marked `isBackground: true` and points its `background`
at the highest surface (`tokens.ts:418-420`), while `onPrimaryContainer`
inverts that relationship by using the container as its own background
(`tokens.ts:424-431`).

The constructor enforces invariants on this structure: a `background` requires
a `contrastCurve`, a `contrastCurve` requires a `background`, and a
`secondBackground` requires a `background` (`dynamic-color.ts:147-161`). These
checks exist because the calculation engine relies on the pairing — a tone can
only be contrast-adjusted against a background it is paired with.

## The token naming scheme

Internal `DynamicColor` names are snake_case and mirror the public kebab-case
`Palette` keys. The banner comments group families by Material's letter codes:

| Banner | Family | Roles |
| ------ | ------ | ----- |
| `Main Palettes` | `tokens.ts:23` | The six palette key colors (`primary_palette_key_color`, ...) |
| `Surfaces [S]` | `tokens.ts:74` | `background` through `surface_tint` (20 roles) |
| `Primaries [P]` | `tokens.ts:364` | `primary`, `primary_dim`, `on_primary`, `primary_container`, `on_primary_container`, `inverse_primary` |
| `Primary Fixed [PF]` | `tokens.ts:443` | `primary_fixed`, `primary_fixed_dim`, `on_primary_fixed`, `on_primary_fixed_variant` |
| `Secondaries [Q]` | `tokens.ts:501` | `secondary`, `secondary_dim`, `on_secondary`, `secondary_container`, `on_secondary_container` |
| `Secondary Fixed [QF]` | `tokens.ts:568` | `secondary_fixed`, `secondary_fixed_dim`, `on_secondary_fixed`, `on_secondary_fixed_variant` |
| `Tertiaries [T]` | `tokens.ts:630` | `tertiary`, `tertiary_dim`, `on_tertiary`, `tertiary_container`, `on_tertiary_container` |
| `Tertiary Fixed [TF]` | `tokens.ts:698` | `tertiary_fixed`, `tertiary_fixed_dim`, `on_tertiary_fixed`, `on_tertiary_fixed_variant` |
| `Errors [E]` | `tokens.ts:760` | `error`, `error_dim`, `on_error`, `error_container`, `on_error_container` |

The naming is systematic: `<family>` (base), `<family>_dim` (slightly darker),
`on_<family>` (foreground), `<family>_container` (soft tinted surface),
`on_<family>_container` (its foreground), and the `_fixed` variants that stay
constant across light and dark modes.

## Real token entries

### The `primary` family

The base role shows every knob working together (`tokens.ts:368-387`):

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

- **`tone`** — low-chroma seeds (< 12) fall back to the fixed Material tones 80
  (dark) / 40 (light); otherwise the role keeps the source color's own tone.
- **`isBackground: true`** — marks this as a background role so the engine can
  clamp its tone away from the "awkward zone" (see
  [color-calculation.md](./color-calculation.md)).
- **`toneDeltaPair`** — guarantees a tone distance of 5 between `primary` and
  `primaryContainer`, so the two roles never collide visually
  (`tokens.ts:377-385`; see `tone-delta-pair.ts:35-71`).

Its companion roles are simpler:

- `primaryDim` subtracts 5 from the primary tone and clamps to 0-100
  (`tokens.ts:389-395`). The same `- 5` pattern appears in every family's
  `*Dim` (`secondaryDim` `tokens.ts:527-533`, `tertiaryDim` `tokens.ts:656-662`,
  `errorDim` `tokens.ts:786-792`).
- `onPrimary` defines **no tone at all** — it only declares its background
  (`primary()`) and a contrast curve of 6 (`tokens.ts:397-404`). The engine
  derives the tone from the contrast target against that background. This is
  the classic "on-role" shape: the foreground is a *derived* color, not a
  specified one.
- `primaryContainer` picks its tone from the source tone with tight clamping:
  tone > 55 becomes `clamp(61, 90, ...)`, otherwise `clamp(30, 49, ...)`
  (`tokens.ts:410-417`), and only requests a contrast curve when `contrastLevel
  > 0` (`tokens.ts:420`).
- `onPrimaryContainer` pairs with it (background + curve 6, `tokens.ts:424-431`).

### Surfaces

Surfaces all sample `s.neutralPalette` and differ only in tone. The step
hierarchy is expressed as literal tone values per mode (`tokens.ts:183-201`):

```ts
surfaceContainer(): DynamicColor {
	return DynamicColor.fromPalette({
		name: 'surface_container',
		palette: (s) => s.neutralPalette,
		tone: (s) => {
			if (s.variant === Variant.CMF) {
				return s.isDark ? 9 : 94;
			}
			return s.isDark ? 12 : 94;
		},
		chromaMultiplier: (s) => {
			if (s.variant === Variant.CMF) {
				return 1.4;
			}
			return 0;
		},
		isBackground: true
	});
}
```

Two details stand out:

1. **CMF is special-cased.** Under the `CMF` variant, surface steps shift tone
   and get a `chromaMultiplier` (surfaces become slightly tinted instead of
   fully neutral). `surface`, `surfaceContainerLowest`, and the two `surfaceDim`
   tone branches are identical between CMF and non-CMF (   `tokens.ts:100-103`,
   `tokens.ts:113-117`, `tokens.ts:154-157`), but `surfaceBright` and every
   `surfaceContainer*` step differ (`tokens.ts:134-138`, `tokens.ts:167-172`,
   `tokens.ts:187-192`, `tokens.ts:207-212`, `tokens.ts:227-232`). The
   `chromaMultiplier` pattern recurs in `onSurface` (`tokens.ts:247-253`),
   `inverseSurface` (`tokens.ts:289-295`), `outline` (`tokens.ts:313-319`), and
   `outlineVariant` (`tokens.ts:329-335`).
2. **`highestSurface` picks the elevation context** (`tokens.ts:829-831`): dark
   mode uses `surfaceBright`, light mode uses `surfaceDim` — the surface that
   visually "sits highest" in each mode. This is the common `background` target
   for every accent role that needs to be read against the surface elevation
   (`tokens.ts:375`, `tokens.ts:419`, `tokens.ts:513`, ...).

`onSurface` and `onSurfaceVariant` get their tones from contrast curves against
that highest surface (`tokens.ts:243-257`, `tokens.ts:266-280`) — note the
asymmetric curves: dark mode demands more contrast (curve 11 vs 9 for
`onSurface`, curve 6 vs 4.5 for `onSurfaceVariant`).

### Fixed colors freeze light-mode tones

`primaryFixed` deliberately recomputes the **light-mode** container tone even in
a dark scheme, by fabricating a temporary light scheme (`tokens.ts:447-459`):

```ts
tone: (s) => {
	const tempS = Object.assign({}, s, { isDark: false, contrastLevel: 0 });
	return this.primaryContainer().getTone(tempS);
}
```

This is the "fixed" contract: these roles must look identical in light and dark
mode (they are used for sticky elements like elevated chips that cross mode
boundaries). `primaryFixedDim` then derives from `primaryFixed` and pairs with
it through a `ToneDeltaPair` (delta 5, `darker`, `exact`,
`tokens.ts:461-479`). Note that pair is built with `this.primaryFixedDim()` as
`roleA` and `this.primaryFixed()` as `roleB` — the pair constructor is
symmetric, and the engine resolves each side independently
([color-calculation.md](./color-calculation.md)).

`onPrimaryFixed` and `onPrimaryFixedVariant` both switch their background
between `primaryFixedDim` and `primaryFixed` based on the fixed tone's
brightness threshold (`tokens.ts:485-486`, `tokens.ts:495-496`):

```ts
background: (s) =>
	this.primaryFixed().getTone(s) > 57 ? this.primaryFixedDim() : this.primaryFixed()
```

### Errors

The error family is the smallest (5 roles). Unlike the accent families it has
no `_fixed` variants — errors have no sticky, mode-crossing component. `error`
uses the tone of maximum chroma (`tMaxC`, `tokens.ts:769`), `errorContainer`
switches between min/max chroma tones by mode (`tokens.ts:808`), and the
on-roles pair by contrast (`onError` `tokens.ts:794-801`,
`onErrorContainer` `tokens.ts:816-823`).

### Aliases built from clones

Several tokens are not independent roles but renamings of other roles:

| Token | Source | Code |
| ----- | ------ | ---- |
| `background` | `surface()` | `tokens.ts:78-83` |
| `onBackground` | `onSurface()` with its own `tone` | `tokens.ts:85-93` |
| `surfaceVariant` | `surfaceContainerHighest()` | `tokens.ts:259-264` |
| `surfaceTint` | `primary()` | `tokens.ts:357-362` |

These exist because the Material spec names them distinctly while their design
intent matches another role. The clone preserves the palette/tone/contrast
behavior and only overrides the `name` (and, for `onBackground`, the tone
callback to re-evaluate `onSurface` against the current scheme).

## Tone patterns shared across families

Across all 53 roles, only a handful of tone strategies recur:

| Strategy | Example | Code |
| -------- | ------- | ---- |
| Literal per-mode tone | `surface`: `isDark ? 6 : 98` | `tokens.ts:100-103` |
| Source tone with clamps | `primaryContainer` | `tokens.ts:410-417` |
| Tone of maximum chroma (`tMaxC`) | `error`, `inversePrimary` | `tokens.ts:769`, `tokens.ts:437` |
| Tone of min/max chroma by mode | `secondary`, `errorContainer` | `tokens.ts:510`, `tokens.ts:808` |
| Base minus 5 (`*Dim`) | `primaryDim` | `tokens.ts:389-395` |
| Derived from another role | `primaryFixed` ← `primaryContainer` | `tokens.ts:452-454` |
| Contrast-derived (no `tone` field) | `onPrimary` | `tokens.ts:397-404` |
| Constant | `shadow`, `scrim` at tone 0 | `tokens.ts:341-355` |

## How tokens enumerate what gets exported

`ColorTokens` alone does not define the export set — that is shared with two
other files:

1. `ColorRoles.allColors` (`color-roles.ts:305-355`) lists the roles the scheme
   can resolve, but it is **not** the full 53: it omits `surface_variant`,
   `shadow`, `scrim`, and `surface_tint` (49 entries). Those four still reach
   the public API through their dedicated scheme accessors
   (`dynamic-scheme.ts:388-422`).
2. The authoritative export set is the `Palette` interface in `types.ts:16-70`,
   and the object literal in `generateColorPalette` (`color.ts:433-487`) that
   satisfies it. `tokens.ts` provides a superset of the behavior those 53 keys
   need (including the six palette key colors, which are exposed as scheme
   getters like `scheme.primaryPaletteKeyColor` at `dynamic-scheme.ts:318` but
   are **not** part of the public `Palette`).

## Why the structure looks like this

The spec is written as a tree of small declarative objects because it is a
transcription of the Material 3 role table: a document where each row names a
role and each column is a design constraint (palette, tone range, contrast).
Encoding each row as a `DynamicColor.fromPalette({...})` descriptor keeps the
mapping one-to-one with that table — you can open `tokens.ts:368`, see
`primary`, and read its complete behavior in eight lines. Hardcoding these 53
roles into the solving algorithm would make the Material spec un-auditable and
un-derivable; the declarative form makes both the role *and its why* visible.

The functional options (`palette`, `tone`, `background`, ...) are also what
lets roles reference each other at resolution time (`primaryContainer` is used
inside `primary`'s `ToneDeltaPair`, `highestSurface` is referenced by almost
every accent role) without any ordering dependency — every role is built on
demand, lazily.

## Further reading

- [overview.md](./overview.md) — where tokens sit in the spec layer
- [palettes.md](./palettes.md) — the palettes these roles sample from
- [color-calculation.md](./color-calculation.md) — how a token's tone is solved
- [token-utils.md](./token-utils.md) — `getCurve`, `tMaxC`, `tMinC`
- [../scheme/dynamic-color.md](../scheme/dynamic-color.md) — the `DynamicColor` class
