# WCAG Contrast

- [The ratio from two tones](#the-ratio-from-two-tones)
- [The luminance math](#the-luminance-math)
  - [Linearized sRGB](#linearized-srgb)
  - [Tone, L\* and Y](#tone-l-and-y)
  - [The ratio formula](#the-ratio-formula)
- [Why contrast needs only tone](#why-contrast-needs-only-tone)
- [The WCAG thresholds](#the-wcag-thresholds)
- [Finding a compliant tone: lighter and darker](#finding-a-compliant-tone-lighter-and-darker)
- [The unsafe variants and the on-\* pairing contract](#the-unsafe-variants-and-the-on--pairing-contract)
- [Contrast inside theme generation](#contrast-inside-theme-generation)
- [Where the dislike and heart rules are NOT](#where-the-dislike-and-heart-rules-are-not)

## The ratio from two tones

`Contrast` (`src/utils/contrast.ts:32`) computes the WCAG contrast ratio from
two **tones**, not from two colors. The entry point is `ratioOfTones`
(`utils/contrast.ts:39-43`):

```ts
ratioOfTones(toneA: number, toneB: number): number {
	toneA = clampDouble(0.0, 100.0, toneA);
	toneB = clampDouble(0.0, 100.0, toneB);
	return Contrast.ratioOfYs(yFromLstar(toneA), yFromLstar(toneB));
}
```

Both tones are clamped to `[0, 100]` (tone is a percentage), converted to
relative luminance `Y` via `yFromLstar`, and handed to `ratioOfYs`. Tones are
used everywhere in the library — `getTone` in `color.ts:55`, `Tones` in
`types.ts:78` — so `ratioOfTones` plugs directly into every existing value
without a color-space conversion.

## The luminance math

### Linearized sRGB

The chain starts with sRGB linearization. `linearized`
(`utils/color.ts:219-226`) converts an 8-bit channel to linear RGB in
`[0, 100]`:

```ts
export function linearized(rgbComponent: number): number {
	const normalized = rgbComponent / 255.0;
	if (normalized <= 0.040449936) {
		return (normalized / 12.92) * 100.0;
	} else {
		return Math.pow((normalized + 0.055) / 1.055, 2.4) * 100.0;
	}
}
```

This is the standard sRGB transfer function: the piecewise-linear low-end
segment (with the switch point at `0.040449936` and slope `1/12.92`) and the
`2.4` power curve above it. sRGB is nonlinear by design — it encodes more bits
to dark values, where the human eye is more sensitive — and WCAG's formula
operates on the *linear* values.

### Tone, L\* and Y

The linear RGB values are converted to XYZ (`xyzFromArgb`, `utils/color.ts:104`)
with the sRGB-to-XYZ matrix (`utils/color.ts:21-25`), whose middle row is the
luminance weights `[0.2126, 0.7152, 0.0722]`. Relative luminance is the Y
component of that matrix product:

```ts
export function lstarFromArgb(argb: number): number {
	const y = xyzFromArgb(argb)[1] ?? 100;
	return 116.0 * labF(y / 100.0) - 16.0;
}
```

This is the CIELAB L\* formula (`utils/color.ts:176-179`), and **HCT tone is
exactly this L\*** (`hct.ts:142`). The inverse direction is
`yFromLstar` (`utils/color.ts:192-194`):

```ts
export function yFromLstar(lstar: number): number {
	return 100.0 * labInvf((lstar + 16.0) / 116.0);
}
```

`labF`/`labInvf` (`utils/color.ts:254-272`) use the CIE constants
`kappa = 24389/27` and `epsilon = 216/24389`, the piecewise breakpoint of the
cube-root curve. So the round trip tone → Y is the exact inverse of the forward
L\* computation.

### The ratio formula

`ratioOfYs` (`utils/contrast.ts:45-49`) is the WCAG formula itself:

```ts
ratioOfYs(y1: number, y2: number): number {
	const lighter = y1 > y2 ? y1 : y2;
	const darker = lighter === y2 ? y1 : y2;
	return (lighter + 5.0) / (darker + 5.0);
}
```

The standard WCAG definition is `(L1 + 0.05) / (L2 + 0.05)` with luminance in
`[0, 1]`. Here luminance is in `[0, 100]`, so the `0.05` floor — which models
the minimum luminance contribution of any display including "black" — is
rescaled to `5.0`. The result is the familiar 1:1 (equal colors) to 21:1
(black on white) range.

## Why contrast needs only tone

WCAG contrast is a function of **relative luminance only**. Hue and chroma
never enter the formula. In HCT, tone *is* the luminance axis: it is L\*
derived from Y (`hct.ts:142`), and the tone values read from a color
(`getTone`, `color.ts:55`) are that color's actual luminance, so
`yFromLstar(tone)` recovers its exact Y. That makes `ratioOfTones(toneA,
toneB)` the exact WCAG ratio of the two underlying colors, with no
approximation — for any hue and chroma combination.

The approximation only appears when tones are *assumed* rather than measured.
HCT's design guarantees are spelled out in the module header
(`hct.ts:16-25`):

> A difference of 40 in HCT tone guarantees a contrast ratio >= 3.0, and a
> difference of 50 guarantees a contrast ratio >= 4.5.

Because L\* is defined directly from Y, equal-tone colors always have equal
luminance regardless of hue — which is precisely why ratio arithmetic can be
done on the single tone axis instead of per-pair luminance computations.

## The WCAG thresholds

The three well-known WCAG success criteria appear throughout the library:

| Threshold | Meaning | Where it is enforced |
| --------- | ------- | -------------------- |
| 4.5:1 | AA for normal text | `color.ts:248` (`AA`), `color.ts:148` (default ratio in `onColor`) |
| 3.0:1 | AA for large text (>= 24px, or 18.66px bold) | `color.ts:249` (`AALarge`) |
| 7.0:1 | AAA for all text | `color.ts:250` (`AAA`) |

In `paletteChecker` (`scanPairs`, `color.ts:246-250`) each `on-{role}` pair is
flagged `AA`, `AALarge`, and `AAA` by direct comparison against these three
numbers. The scoring layer in `color.ts` maps them onto a 0-10 scale with
`scoreSmallText`/`scoreLargeText` (`color.ts:174-186`), whose piecewise
breakpoints are exactly 4.5/7 and 3/4.5.

## Finding a compliant tone: lighter and darker

Given a known tone and a target ratio, `lighter` (`utils/contrast.ts:61-81`)
computes the lightest-compliant tone by solving the ratio formula for the
unknown luminance:

```ts
const darkY = yFromLstar(tone);
const lightY = ratio * (darkY + 5.0) - 5.0;
```

and then converts back with `lstarFromY(lightY)`. Two defensive details:

- A feasibility check: if the achieved contrast is below the target by more
  than `0.04`, it returns `-1` (impossible at this tone)
  (`utils/contrast.ts:70-72`).
- A gamut-mapping guard: the returned value is nudged by `+0.4`
  (`utils/contrast.ts:76`), with the mirror-image `-0.4` in `darker`
  (`utils/contrast.ts:109`). The comment explains why: when a requested HCT
  (hue, chroma, tone) falls outside the sRGB gamut, `Hct.from` reduces chroma
  while keeping tone, so a tiny overshoot on tone prevents the mapped color
  from landing just under the target ratio.

`darker` (`utils/contrast.ts:93-114`) is the mirror image, solving
`darkY = (lightY + 5.0) / ratio - 5.0` and darkening.

## The unsafe variants and the on-\* pairing contract

`lighterUnsafe` (`utils/contrast.ts:130-133`) and `darkerUnsafe`
(`utils/contrast.ts:149-152`) return the *bounds* instead of `-1` when the
ratio is unreachable:

```ts
lighterUnsafe(tone: number, ratio: number): number {
	const lighterSafe = Contrast.lighter(tone, ratio);
	return lighterSafe < 0.0 ? 100.0 : lighterSafe;
}
```

They are called "unsafe" because the returned tone does not actually guarantee
the ratio: there is no color lighter than T100 and no color darker than T0
(`utils/contrast.ts:121-123`). They are what `onColor` uses (`color.ts:148-155`):

```ts
export function onColor(bg: ColorValue, ratio = 4.5): ColorValue {
	const c = Color.hct(bg);
	const fgTone =
		c.tone >= 55
			? Contrast.darkerUnsafe(c.tone, ratio)
			: Contrast.lighterUnsafe(c.tone, ratio);
	return Color.fromHct(c.hue, c.chroma, fgTone).hex;
}
```

`onColor` keeps the background's hue and chroma and changes only the tone —
and because of the tone-only property, `ratioOfTones` then reports the exact
WCAG ratio between the two. The heuristic `tone >= 55` decides whether to
darken or lighten; it is the same "prefer light foregrounds on dark
backgrounds" rule formalized in `DynamicColor.tonePrefersLightForeground`
(`scheme/dynamic-color.ts:282-284`).

This is the **on-\* pairing contract**: every generated token has a sibling
`on-{role}` that shares hue and chroma and differs only in tone. The theme
builder enforces it — `generateOn` (`extend-theme.ts:28-32`) flips tone to 10
or 90 while keeping hue/chroma — and the role system follows it via
`DynamicColor.foregroundTone` (`scheme/dynamic-color.ts:242-269`), which picks
between `lighterUnsafe` and `darkerUnsafe` for each role pair. When two colors
share hue and chroma, `ratioOfTones` is not an approximation but the exact
WCAG ratio of the rendered colors, which is why the whole Material 3 tonal
system can be built from tone arithmetic alone.

## Contrast inside theme generation

Beyond the public `onColor`/`contrastChecker`/`paletteChecker`, `Contrast`
drives role resolution in the scheme/spec layer:

- `DynamicColor.foregroundTone(bgTone, ratio)` (`scheme/dynamic-color.ts:242`)
  picks the tone that reaches a target ratio, including the edge case where
  neither lighter nor darker reaches it (`dynamic-color.ts:259-265`).
- `src/spec/color-calculation.ts` evaluates candidate tones against `bgTone`
  using `Contrast.ratioOfTones` and solves for tones with `Contrast.lighter` /
  `Contrast.darker` (`color-calculation.ts:117-183`).

So every Material 3 role — every `on-primary`, `surface`, `outline` — owes its
final tone to these four functions.

## Where the dislike and heart rules are NOT

`utils/contrast.ts` contains no dislike or "heart" logic. The disliked-color
zone (`DislikeAnalyzer`) lives in `src/science/dislike-analyzer.ts` and is a
perceptual-preference rule, not an accessibility rule: contrast and liking are
independent axes, and the library keeps them in separate modules. If you came
here looking for the yellow-green fix, see
[dislike-analyzer](./dislike-analyzer.md).

Related: [overview](./overview.md),
[color-blindness](./color-blindness.md).
