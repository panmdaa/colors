# The Calculation Engine (`src/spec/color-calculation.ts`)

- [What the engine is](#what-the-engine-is)
- [The delegate interface](#the-delegate-interface)
- [Where the engine sits](#where-the-engine-sits)
- [`getArgb` and `getHct` — palette lookup](#getargb-and-gethct--palette-lookup)
- [`getTone` — the tone resolution steps](#gettone--the-tone-resolution-steps)
  - [Case 0: a `ToneDeltaPair` is present](#case-0-a-tonedeltapair-is-present)
  - [Case 1: no pair, contrast-solved](#case-1-no-pair-contrast-solved)
  - [Case 2: dual backgrounds](#case-2-dual-backgrounds)
- [The background clamping rule](#the-background-clamping-rule)
- [Contrast helpers it relies on](#contrast-helpers-it-relies-on)
- [Why a singleton delegate](#why-a-singleton-delegate)
- [Further reading](#further-reading)

## What the engine is

`color-calculation.ts` is the only imperative file in the spec layer. It takes
the declarative pieces — a `DynamicColor` (from `tokens.ts`) and a
`DynamicScheme` carrying the six tonal palettes (from `palettes.ts`) — and
produces the three concrete values the rest of the library needs: a tone, an
`Hct`, and an ARGB integer.

It is the bridge between `DynamicScheme` and the final `Theme`: every role's
color passes through this engine before `palette()` returns it
([overview.md](./overview.md) shows the full path).

## The delegate interface

The contract is three methods over a `DynamicColor` (`color-calculation.ts:23-27`):

```ts
export interface ColorCalculationDelegate {
	getArgb(scheme: DynamicScheme, color: DynamicColor): number;
	getHct(scheme: DynamicScheme, color: DynamicColor): Hct;
	getTone(scheme: DynamicScheme, color: DynamicColor): number;
}
```

The concrete implementation, `ColorCalculationDelegateBase`
(`color-calculation.ts:32-201`), is instantiated once and returned by
`getSpec()` (`color-calculation.ts:203-210`) — the same singleton pattern used
by `palettes.ts:407-411`.

## Where the engine sits

`DynamicColor` is the entry point. Its three methods delegate straight to this
engine (`dynamic-color.ts:196-231`):

```ts
getArgb(scheme: DynamicScheme): number {
	return getSpec().getArgb(scheme, this);      // dynamic-color.ts:196-198
}
getHct(scheme: DynamicScheme): Hct {
	return getSpec().getHct(scheme, this);       // dynamic-color.ts:208-219
}
getTone(scheme: DynamicScheme): number {
	return getSpec().getTone(scheme, this);      // dynamic-color.ts:229-231
}
```

`DynamicScheme.getArgb` (called by its 50+ role getters) wraps the same path
with a per-role-name memo (`dynamic-scheme.ts:299-310`), so each role is solved
exactly once per scheme. The flow is then:

```
DynamicColor.getArgb ──► getSpec().getArgb        (color-calculation.ts:33)
                              ├─ color.getTone     (color-calculation.ts:63)
                              └─ palette.tone()    (tonal-palette.ts:58)
```

## `getArgb` and `getHct` — palette lookup

`getArgb` (`color-calculation.ts:33-46`) resolves the color in three steps:

1. Pick the palette and tone: `color.palette(scheme)` and `color.getTone(scheme)`.
2. Apply the chroma multiplier (`chromaMultiplier ?? 1`).
3. If the multiplier is 1, sample the palette directly with `palette.tone(tone)`
   (the cached ARGB lookup in `tonal-palette.ts:58-69`). Otherwise the color is
   re-created at `palette.hue` with scaled chroma via
   `TonalPalette.fromHueAndChroma(...).tone(tone)` — or, when the tone is 99 and
   the palette is yellow, `Hct.argbFrom(palette.hue, chroma, tone)`
   (`color-calculation.ts:42-45`).

The yellow-at-99 special case mirrors a quirk in `TonalPalette`: yellow chroma
collapses at very light tones, so `TonalPalette.tone(99)` averages the ARGB of
tones 98 and 100 instead of computing HCT directly (`tonal-palette.ts:61-68`).
`getHct` (`color-calculation.ts:48-61`) is the same logic returning an `Hct`
object instead of an integer.

## `getTone` — the tone resolution steps

`getTone` (`color-calculation.ts:63-200`) is the heart of the engine. It has
two main branches, chosen by whether the color declares a `toneDeltaPair`.

### Case 0: a `ToneDeltaPair` is present

When the color is part of a pair (e.g. `primary` ⇄ `primaryContainer`,
`tokens.ts:377-385`), the tone must satisfy the pair's distance constraint
first (`color-calculation.ts:66-132`):

1. **Polarity sign** (`color-calculation.ts:72-77`): `darker`, or
   `relative_lighter` in dark mode, or `relative_darker` in light mode, negate
   the delta. `relative_lighter` flips the constraint with the mode — "lighter
   in light mode, darker in dark mode" — which is how Material keeps accent and
   container on the correct side of the background in both modes.
2. **Self/ref split** (`color-calculation.ts:79-84`): the color being solved is
   `selfRole`, the other half is `refRole`; the reference tone is resolved
   recursively via `refRole.getTone(scheme)`.
3. **Constraint application** (`color-calculation.ts:86-108`):
   - `exact` — `selfTone = clamp(0, 100, refTone + relativeDelta)`
   - `nearer` — move self toward the reference by `relativeDelta`, clamped
   - `farther` — move self at least `relativeDelta` away, clamped
4. **Contrast override** (`color-calculation.ts:110-122`): if the color also
   has a `background` and `contrastCurve`, the pair-resolved tone is re-checked
   against the background contrast target; if it falls short, it is replaced
   with `DynamicColor.foregroundTone(bgTone, selfContrast)`.
5. **Background clamp** (`color-calculation.ts:124-130`): see below.

### Case 1: no pair, contrast-solved

Without a pair, the engine solves the tone for the color alone
(`color-calculation.ts:133-199`):

```ts
let answer = color.tone(scheme);

if (
	color.background?.(scheme) === undefined ||
	color.contrastCurve?.(scheme) === undefined
) {
	return answer;                                     // early return
}

const bgTone = color.background(scheme)?.getTone(scheme) ?? 50;
const desiredRatio = color.contrastCurve(scheme)?.get(scheme.contrastLevel) ?? 0;

answer =
	Contrast.ratioOfTones(bgTone, answer) >= desiredRatio &&
	scheme.contrastLevel >= 0
		? answer
		: DynamicColor.foregroundTone(bgTone, desiredRatio);   // color-calculation.ts:148-152
```

The `contrastLevel >= 0` guard is deliberate: at negative contrast levels the
spec asks for *less* contrast, so the tone is never pushed toward its ratio.

After the ratio step, the background clamp applies (`color-calculation.ts:154-160`),
and if the color declares a second background, execution continues into Case 2.

### Case 2: dual backgrounds

A few roles must contrast against *two* backgrounds at once
(`color-calculation.ts:162-198`). The engine:

1. Reads both background tones (`color-calculation.ts:167-171`).
2. Accepts the current tone if it meets the ratio against **both** the lighter
   and darker background (`color-calculation.ts:174-179`).
3. Otherwise computes a `lightOption` against the lighter background and a
   `darkOption` against the darker one (`Contrast.lighter`/`Contrast.darker`,
   `color-calculation.ts:181-183`).
4. Prefers light if either background "prefers a light foreground"
   (`DynamicColor.tonePrefersLightForeground`, `dynamic-color.ts:282-284`),
   otherwise picks the single available option, defaulting to the dark option
   (`color-calculation.ts:189-198`).

This is what guarantees a role like `onPrimaryFixedVariant` reads correctly
whether it is rendered on a light surface or a dark one.

## The background clamping rule

Both cases share the same post-step (`color-calculation.ts:124-130` and
`color-calculation.ts:154-160`):

```ts
if (color.isBackground && !color.name.endsWith('_fixed_dim')) {
	if (selfTone >= 57) {
		selfTone = clampDouble(65, 100, selfTone);
	} else {
		selfTone = clampDouble(0, 49, selfTone);
	}
}
```

Roles flagged `isBackground` are kept out of the T50-59 "awkward zone" where
neither a light nor a dark foreground is comfortable — except `*_fixed_dim`
roles, which are exempt because their pair constraint already pins them.

## Contrast helpers it relies on

The engine composes generic pieces from the utility and scheme layers:

- `Contrast.ratioOfTones` — WCAG ratio between two tones (`utils/contrast.ts`).
- `Contrast.lighter` / `darker` — find a tone meeting a ratio; return -1 when
  impossible (`color-calculation.ts:181-183`).
- `DynamicColor.foregroundTone(bgTone, ratio)` — pick the lighter or darker
  foreground tone, including the "negligible difference" edge case at very high
  ratios (`dynamic-color.ts:242-269`).
- `ContrastCurve.get(contrastLevel)` — map a contrast level (-1 to 1) to a
  ratio target by interpolation (`contrast-curve.ts:44-56`).

## Why a singleton delegate

The delegate is stateless — it never mutates `DynamicColor`, `DynamicScheme`,
or any palette. A single shared instance therefore costs nothing and avoids
allocating a new engine per scheme or per role resolution. The same reasoning
produces the `getSpec()` singleton in `palettes.ts`. `DynamicColor`'s own HCT
cache (`dynamic-color.ts:72`, `dynamic-color.ts:209-218`) handles the
per-scheme memoization instead, keeping the engine pure.

## Further reading

- [overview.md](./overview.md) — the spec layer composition
- [tokens.md](./tokens.md) — the roles this engine solves
- [palettes.md](./palettes.md) — the palettes it samples
- [token-utils.md](./token-utils.md) — `getCurve` and tone-finding helpers
- [../scheme/dynamic-color.md](../scheme/dynamic-color.md) — the `DynamicColor` contract
- [../scheme/contrast-curve.md](../scheme/contrast-curve.md) — contrast curves
- [../scheme/tone-delta-pair.md](../scheme/tone-delta-pair.md) — pair constraints
