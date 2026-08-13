# ContrastCurve: Tone Targets Over Contrast Level

- [What a ContrastCurve is](#what-a-contrastcurve-is)
- [The constructor: four anchors](#the-constructor-four-anchors)
- [Computing a value: `get`](#computing-a-value-get)
- [The curves used by the token spec](#the-curves-used-by-the-token-spec)
- [Why curves over tonal deltas](#why-curves-over-tonal-deltas)

## What a ContrastCurve is

`ContrastCurve` is a tiny value object: a piecewise-linear function of the
scheme's `contrastLevel`. Its class comment is precise (`contrast-curve.ts:14-19`):

> A class containing a value that changes with the contrast level. Usually
> represents the contrast requirements for a dynamic color on its background.

The "value" in question is a WCAG contrast ratio. A role's declared tone is
checked against this target and pushed further away from its background when it
falls short — see `DynamicColor.getTone` in
[dynamic-color.md](./dynamic-color.md#case-1-a-background-and-a-contrast-curve).

## The constructor: four anchors

```ts
constructor(
  readonly low: number,
  readonly normal: number,
  readonly medium: number,
  readonly high: number
) {}
```

`contrast-curve.ts:30-35`. The four anchors are exactly the four named contrast
levels, in order (`contrast-curve.ts:22-28`):

| Parameter | Contrast level | Meaning |
|-----------|----------------|---------|
| `low`     | -1.0           | Minimum contrast |
| `normal`  | 0.0            | Standard (the design as spec'd) |
| `medium`  | 0.5            | Between standard and max |
| `high`    | 1.0            | Maximum contrast |

Note there is no anchor for the *negative* half's midpoint; `get` interpolates
`low -> normal` over the whole [-1, 0] span.

## Computing a value: `get`

`get(contrastLevel)` (`contrast-curve.ts:44-56`) returns the curve value at a
level, interpolating linearly between the two surrounding anchors:

```ts
get(contrastLevel: number): number {
  if (contrastLevel <= -1.0) {
    return this.low;
  } else if (contrastLevel < 0.0) {
    return lerp(this.low, this.normal, (contrastLevel - -1) / 1);
  } else if (contrastLevel < 0.5) {
    return lerp(this.normal, this.medium, (contrastLevel - 0) / 0.5);
  } else if (contrastLevel < 1.0) {
    return lerp(this.medium, this.high, (contrastLevel - 0.5) / 0.5);
  } else {
    return this.high;
  }
}
```

`lerp` is the standard linear interpolation `(1 - a) * start + a * stop`
(`utils/math.ts:36-38`). The three interpolation segments are:

- `[-1.0, 0.0]` → `low` to `normal`
- `[0.0, 0.5]` → `normal` to `medium`
- `[0.5, 1.0]` → `medium` to `high`

Values at or below -1 return `low`, at or above 1 return `high`. For contrast
ratios the return value is "a number between 1.0 and 21.0"
(`contrast-curve.ts:42`).

The midpoints are asymmetrical (0.5, not 0.0/1.0 halves): the standard-level
segment is the design target, and the jump to `medium` is where the system
starts prioritizing accessibility; going from `normal` to `medium` in a 0.5 step
keeps the curve from over-reacting at the most common positive levels.

## The curves used by the token spec

The library never constructs `ContrastCurve` by hand at role sites. It goes
through the `getCurve(defaultContrast)` helper (`spec/token-utils.ts:98-118`),
which maps a single "default" ratio onto a full curve:

| Default | low (-1) | normal (0) | medium (0.5) | high (1) |
|---------|----------|------------|--------------|----------|
| 1.5     | 1.5      | 1.5        | 3            | 5.5      |
| 3       | 3        | 3          | 4.5          | 7        |
| 4.5     | 4.5      | 4.5        | 7            | 11       |
| 6       | 6        | 6          | 7            | 11       |
| 7       | 7        | 7          | 11           | 21       |
| 9       | 9        | 9          | 11           | 21       |
| 11      | 11       | 11         | 21           | 21       |
| 21      | 21       | 21         | 21           | 21       |
| *other* | *x*      | *x*        | 7            | 21       |

So the table *encodes* the accessibility ladder: at maximum contrast (level 1),
every text role is pushed to at least 11:1 (roughly WCAG AAA for small text),
and `getCurve(7)`/`getCurve(9)`/`getCurve(11)` roles cap out at 21:1 — the
maximum ratio white/black can achieve.

The curves map onto roles in `spec/tokens.ts`:

- **1.5** — container roles at positive contrast: `primaryContainer`,
  `primaryFixed`, `primaryFixedDim`, and their secondary/tertiary/error
  counterparts (`tokens.ts:420`, `457`, `477`, ...). Containers are meant to be
  quiet; the curve only guarantees a floor against the surface.
- **4.5** — standard text: `onPrimaryContainer`, `onSecondaryContainer`,
  `onTertiaryContainer`, `onErrorContainer`, `onSurfaceVariant`
  (`tokens.ts:429`, `565`, `695`, `821`, `278`), plus the *base* accent roles
  (`primary` at `tokens.ts:376`, `secondary` at `tokens.ts:514`, `tertiary` at
  `tokens.ts:643`, `error` at `tokens.ts:773`).
- **6** — the "on" foregrounds over a solid accent: `onPrimary`,
  `onSecondary`, `onTertiary`, `onError` (`tokens.ts:402`, `540`, `669`, `799`),
  and `inversePrimary` (`tokens.ts:439`).
- **7 / 9 / 11** — highest-stakes text: `onPrimaryFixed` and `onSecondaryFixed`
  use 7 (`tokens.ts:487`, `614`); `inverseOnSurface` uses 7 (`tokens.ts:305`);
  `onSurface` uses 9 in light and **11 in dark** (`tokens.ts:255`);
  `inverseOnSurface` at 7.

The dark/light asymmetry on `onSurface` is deliberate: in dark mode the surface
itself is very dark (tone 6) and the foreground is near-white, so the same
*visual* lightness gap corresponds to a higher ratio; the curve compensates by
demanding more at the ratio level.

## Why curves over tonal deltas

Why not just say "foreground is 40 tones darker than background"? Three reasons,
all visible in the code:

1. **Tone and ratio are not linear in each other.** WCAG ratio is computed from
   relative luminance (`Contrast.ratioOfYs`, `utils/contrast.ts:45-49`), which is
   a *power curve* over tone. A fixed 30-tone delta means different ratios at
   the dark end than the light end. Contrast curves specify the *outcome*
   (ratio) and let `DynamicColor.foregroundTone` find the tone
   (`dynamic-color.ts:242-269`).
2. **The relationship flips between modes.** The same pair — e.g. `primary` on
   `surface` — sits at ~T40 in light mode and ~T80 in dark mode, yet must deliver
   ~4.5:1 in both. A tonal delta would need to be different per mode; a ratio
   target is mode-independent, and the scheme's `isDark` + tone solver handles
   the rest.
3. **Accessibility policy is centralized.** All the WCAG laddering lives in one
   table (`getCurve`), so raising the max-contrast guarantee from 11 to 21 is a
   one-line change that ripples through every role.

In short: tone deltas describe *what the design looks like at standard
contrast*; curves describe *how accessible it must remain when the user demands
it*. They are complementary, which is exactly why a `DynamicColor` can carry
both a `contrastCurve` *and* a `toneDeltaPair` at once
(`dynamic-color.ts:144-145`).
