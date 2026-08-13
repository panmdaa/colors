# Token Utilities and the Public `Palette` Contract

- [What `token-utils.ts` is](#what-token-utilsts-is)
- [`getCurve` — building contrast curves](#getcurve--building-contrast-curves)
- [Tone-finding math](#tone-finding-math)
  - [`findBestToneForChroma`](#findbesttoneforchroma)
  - [`findDesiredChromaByTone`](#finddesiredchromabytone)
  - [`tMaxC` and `tMinC` — tone at max chroma](#tmaxc-and-tminc--tone-at-max-chroma)
- [`isFidelity` and `isMonochrome`](#isfidelity-and-ismonochrome)
- [Where kebab-casing actually lives](#where-kebab-casing-actually-lives)
- [The public `Palette` contract in `src/types.ts`](#the-public-palette-contract-in-srctypests)
  - [53 keys, one value type](#53-keys-one-value-type)
  - [What the contract constrains](#what-the-contract-constrains)
  - [Extending the contract](#extending-the-contract)
- [Why the contract is shaped this way](#why-the-contract-is-shaped-this-way)
- [Further reading](#further-reading)

## What `token-utils.ts` is

`src/spec/token-utils.ts` (118 lines) holds the shared math and small
predicates that the token and palette specs build on. It exports five helpers:

| Export | Line | Purpose |
| ------ | ---- | ------- |
| `isFidelity` | `token-utils.ts:19` | True for `FIDELITY` and `CONTENT` variants |
| `isMonochrome` | `token-utils.ts:23` | True for `MONOCHROME` |
| `findDesiredChromaByTone` | `token-utils.ts:27` | Walk tones toward a desired chroma |
| `findBestToneForChroma` | `token-utils.ts:60` | Walk tones to the chroma peak |
| `tMaxC` | `token-utils.ts:83` | Tone at (or near) the palette's max chroma |
| `tMinC` | `token-utils.ts:93` | Tone at the max chroma starting from tone 0 |
| `getCurve` | `token-utils.ts:98` | Build a `ContrastCurve` from a default ratio |

Only `getCurve`, `tMaxC`, and `tMinC` are actually imported by `tokens.ts`
(`tokens.ts:19`); the rest are available utilities that the current spec does
not call.

## `getCurve` — building contrast curves

`getCurve` (`token-utils.ts:98-118`) maps a single "default contrast ratio" to
the four-point `ContrastCurve` used by the engine. The mapping is the literal
table Material specifies:

| Default | low (-1.0) | normal (0.0) | medium (0.5) | high (1.0) | Code |
| ------- | ---------- | ------------ | ------------ | ---------- | ---- |
| 1.5 | 1.5 | 1.5 | 3 | 5.5 | `token-utils.ts:99-100` |
| 3 | 3 | 3 | 4.5 | 7 | `token-utils.ts:101-102` |
| 4.5 | 4.5 | 4.5 | 7 | 11 | `token-utils.ts:103-104` |
| 6 | 6 | 6 | 7 | 11 | `token-utils.ts:105-106` |
| 7 | 7 | 7 | 11 | 21 | `token-utils.ts:107-108` |
| 9 | 9 | 9 | 11 | 21 | `token-utils.ts:109-110` |
| 11 | 11 | 11 | 21 | 21 | `token-utils.ts:111-112` |
| 21 | 21 | 21 | 21 | 21 | `token-utils.ts:113-114` |
| any other | value | value | 7 | 21 | `token-utils.ts:115-117` |

Contrast curves are how a role's required ratio escalates as the user raises
`contrastLevel`. `tokens.ts` calls `getCurve` with 1.5, 3, 4.5, 6, 7, 9, and 11
(`tokens.ts:255`, `tokens.ts:278`, `tokens.ts:321`, `tokens.ts:402`, ...), and
`color-calculation.ts` samples the resulting curve at the scheme's contrast
level via `ContrastCurve.get` (`contrast-curve.ts:44-56`). The table makes the
escalation rules auditable in one place: a 4.5 default reaches 11 at high
contrast, while a 1.5 default only reaches 5.5.

## Tone-finding math

HCT's gamut means a palette's max chroma is reachable only near the middle of
the tone range. To answer "at which tone does this palette reach its chroma?"
the spec needs a numeric search, because there is no closed form.

### `findBestToneForChroma`

`findBestToneForChroma(hue, chroma, tone, byDecreasingTone)`
(`token-utils.ts:60-81`) walks the tone range one step at a time, starting from
`tone`, tracking the candidate that gets closest to the requested chroma, and
stops when chroma can no longer increase:

```ts
let answer = tone;
let bestCandidate = Hct.from(hue, chroma, answer);
while (bestCandidate.chroma < chroma) {
	if (tone < 0 || tone > 100) break;
	tone += byDecreasingTone ? -1.0 : 1.0;
	const newCandidate = Hct.from(hue, chroma, tone);
	if (bestCandidate.chroma < newCandidate.chroma) {
		bestCandidate = newCandidate;
		answer = tone;
	}
}
return answer;
```

It relies on the chroma curve being unimodal in tone: walk up from 0 (or down
from 100) and keep the tone where chroma peaks.

### `findDesiredChromaByTone`

`findDesiredChromaByTone` (`token-utils.ts:27-58`) is a related search that
keeps the *closest* candidate to the requested chroma rather than the peak,
with a small stopping tolerance (the loop breaks when the candidate is within
0.4 of the target chroma, `token-utils.ts:44-45`). It is exported but not
called anywhere in `src/` today.

### `tMaxC` and `tMinC` — tone at max chroma

`tMaxC` and `tMinC` wrap `findBestToneForChroma` with bounds
(`token-utils.ts:83-96`):

```ts
export function tMaxC(palette, lowerBound = 0, upperBound = 100, chromaMultiplier = 1): number {
	const answer = findBestToneForChroma(palette.hue, palette.chroma * chromaMultiplier, 100, true);
	return clampDouble(lowerBound, upperBound, answer);
}

export function tMinC(palette, lowerBound = 0, upperBound = 100): number {
	const answer = findBestToneForChroma(palette.hue, palette.chroma, 0, false);
	return clampDouble(lowerBound, upperBound, answer);
}
```

`tMaxC` searches down from tone 100 for the chroma peak; `tMinC` searches up
from tone 0. Bounds let callers confine the result to a tonal band. The tokens
use them in exactly that role:

- `secondary`: `isDark ? tMinC(...) : tMaxC(...)` (`tokens.ts:510`)
- `secondaryContainer`: `isDark ? tMinC(p, 20, 49) : tMaxC(p, 61, 90)` (`tokens.ts:550-551`)
- `error`: `tMaxC(...)` (`tokens.ts:769`); `errorContainer`:
  `isDark ? tMinC(...) : tMaxC(...)` (`tokens.ts:808`)
- `inversePrimary`: `tMaxC(s.primaryPalette)` (`tokens.ts:437`)

The `chromaMultiplier` argument of `tMaxC` is what lets an inverted role (which
reads against a dark surface in light mode) sample a chroma-adjusted peak
without a second palette.

## `isFidelity` and `isMonochrome`

`isFidelity(scheme)` (`token-utils.ts:19-21`) returns true for `FIDELITY` and
`CONTENT`; `isMonochrome(scheme)` (`token-utils.ts:23-25`) for `MONOCHROME`.
These predicate helpers exist to make variant-conditional logic read as intent
rather than raw enum comparisons. Neither is currently referenced outside
`token-utils.ts`; the palette spec performs the same checks inline via
`switch`/case (`palettes.ts:83`, `palettes.ts:91`, `palettes.ts:263`).

## Where kebab-casing actually lives

A note on the brief: **`token-utils.ts` contains no kebab-casing and no role
lookup helpers.** Those responsibilities live elsewhere:

- The internal names of `DynamicColor`s are snake_case (`tokens.ts:152`,
  `tokens.ts:205`, ...) and the public `Palette` keys are kebab-case
  (`types.ts:54`), but the conversion is done by the hardcoded object literal
  in `generateColorPalette` (`color.ts:433-487`), not by a string helper.
- Custom token names are normalized to kebab-case by `toKebabCase` in
  `extend-theme.ts:21-26`, which converts both underscores and camelCase
  boundaries:

  ```ts
  function toKebabCase(name: string): string {
  	return name
  		.replace(/_/g, "-")
  		.replace(/([a-z])([A-Z])/g, "$1-$2")
  		.toLowerCase();
  }
  ```

  So `myToken` and `my_token` both arrive at the same `--color-my-token` custom
  property (`extend-theme.ts:125-127`).

## The public `Palette` contract in `src/types.ts`

### 53 keys, one value type

The contract that constrains the token keys is the `Palette` interface
(`types.ts:16-70`):

```ts
export interface Palette {
	primary: ColorValue;
	'primary-dim': ColorValue;
	'on-primary': ColorValue;
	'primary-container': ColorValue;
	'on-primary-container': ColorValue;
	'primary-fixed': ColorValue;
	'primary-fixed-dim': ColorValue;
	'on-primary-fixed': ColorValue;
	'on-primary-fixed-variant': ColorValue;
	// ... secondary, tertiary, error, surface, outline, misc families
	'inverse-primary': ColorValue;
}
```

Every property is a kebab-cased role name and its value is a `ColorValue` — the
template literal type `` `#${string}` `` (`types.ts:12`). The interface has
exactly 53 properties, matching the role count resolved by
`generateColorPalette` (`color.ts:433-487`).

### What the contract constrains

1. **Completeness of `generateColorPalette`** — the object returned at
   `color.ts:433` must satisfy `Palette`; TypeScript rejects a missing or
   misspelled role.
2. **The CSS layer** — `generateCSS` iterates `Object.entries(palette)` and
   emits `` `${prefix}${role}: ${value};` `` (`css-props.ts:24-28`), so the
   interface's keys *are* the CSS custom property names. Renaming a role is a
   breaking change to generated stylesheets.
3. **Custom token references** — `CustomTokenOptions.from` is typed
   `keyof Palette` (`types.ts:99`), so `extraColors` can only copy roles that
   actually exist.

### Extending the contract

`palette()` widens the palette with custom tokens through a mapped type
(`color.ts:364-368`):

```ts
export type ExtraPalette<T extends Record<string, ColorValue | CustomTokenOptions>> = {
	[K in keyof T & string]: ColorValue;
} & {
	[K in keyof T & string as K extends `on-${string}` ? never : `on-${K}`]: ColorValue;
};
```

Custom tokens are added to `light`/`dark` at runtime by `resolveCustomTokens`
(`extend-theme.ts:114-159`), which also synthesizes an `on-{name}` companion
for every non-`on-` token (`extend-theme.ts:144-152`). The standard 53 roles,
however, cannot be extended — the contract is closed, which is what keeps the
Material role set canonical.

## Why the contract is shaped this way

The 53-key `Palette` interface exists so the design system's vocabulary is
**exact and stable**:

- **Exact** — a closed set of roles is type-checkable end to end, from the
  token descriptors in `tokens.ts` to the CSS custom properties in a generated
  stylesheet.
- **Stable** — because consumers (design tokens, CSS generators, custom-token
  references) key off the role names, Material's role names are the package's
  compatibility contract, and the declarative spec layer in `tokens.ts` is the
  single place where their behavior is defined.

The utility functions in `token-utils.ts` support that contract without
hardcoding it: they are generic math (curve construction, tone search) that the
role declarations compose, keeping the spec readable and the solving logic
shared.

## Further reading

- [tokens.md](./tokens.md) — the role declarations that use these helpers
- [palettes.md](./palettes.md) — where palette hue/chroma comes from
- [color-calculation.md](./color-calculation.md) — how curves and tones are consumed
- [../scheme/contrast-curve.md](../scheme/contrast-curve.md) — the `ContrastCurve` class
- [../api/overview.md](../api/overview.md) — the public type surface including `Palette`
