# Blend

- [The three operations](#the-three-operations)
- [harmonize: hue-only rotation](#harmonize-hue-only-rotation)
- [The direction helpers](#the-direction-helpers)
- [cam16Ucs: perceptually uniform interpolation](#cam16ucs-perceptually-uniform-interpolation)
- [hctHue: blend the hue, keep the character](#hcthue-blend-the-hue-keep-the-character)
- [Why harmonize stays hue-only](#why-harmonize-stays-hue-only)
- [Where blend is used](#where-blend-is-used)

## The three operations

`Blend` (`src/science/blend.ts:28`) is a namespace of three blending functions,
all operating on ARGB integers:

| Function | Source | What it changes |
| -------- | ------ | --------------- |
| `Blend.harmonize(designColor, sourceColor)` | `blend.ts:40` | hue only (toward source) |
| `Blend.hctHue(from, to, amount)` | `blend.ts:61` | hue (toward `to`), keeps original chroma + tone |
| `Blend.cam16Ucs(from, to, amount)` | `blend.ts:78` | everything (hue, chroma, tone) |

All three convert ARGB to a perceptual representation, interpolate, and convert
back to ARGB. The perceptual spaces are HCT (for `harmonize`) and CAM16-UCS
(for the other two).

## harmonize: hue-only rotation

`harmonize` (`blend.ts:40-49`) is the flagship operation:

```ts
harmonize(designColor: number, sourceColor: number): number {
	const fromHct = Hct.fromInt(designColor);
	const toHct = Hct.fromInt(sourceColor);
	const difference = differenceDegrees(fromHct.hue, toHct.hue);
	const rotationDegrees = Math.min(difference * 0.5, 15.0);
	const outputHue = sanitizeDegreesDouble(
		fromHct.hue + rotationDegrees * rotationDirection(fromHct.hue, toHct.hue)
	);
	return Hct.from(outputHue, fromHct.chroma, fromTone).toInt();
}
```

Step by step:

1. Convert both colors to HCT.
2. Compute the circular hue distance `difference` between them.
3. Rotate the design hue toward the source hue by `min(difference / 2, 15°)`.
4. Rebuild the color with the rotated hue and the *original* chroma and tone.

The rotation is capped at 15 degrees and never moves more than half the way to
the source. The result is a color that is recognizable as the original but
visibly "pulled" toward the theme hue. The module comment describes it exactly
(`blend.ts:29-39`): a slightly warmer or cooler variant of the design color's
hue that leaves the original color recognizable.

## The direction helpers

Two utilities from `src/utils/math.ts` make the rotation correct on a circle:

- `differenceDegrees(a, b)` (`math.ts:122-124`) computes the shortest circular
  distance: `180 - |abs(a - b) - 180|`. This handles wrap-around, so hue 350
  and hue 10 are 20 degrees apart, not 340.
- `rotationDirection(from, to)` (`math.ts:114-117`) returns `1` if increasing
  `from` reaches `to` by the shorter path and `-1` otherwise. For hues exactly
  180 apart either direction works, and the function returns `1` by
  convention.

Combined they give a signed, always-shortest rotation. `sanitizeDegreesDouble`
(`math.ts:92-98`) wraps the result back into `[0, 360)`.

## cam16Ucs: perceptually uniform interpolation

`cam16Ucs` (`blend.ts:78-91`) interpolates in CAM16-UCS, the uniform color
space built into CAM16:

```ts
cam16Ucs(from: number, to: number, amount: number): number {
	const fromCam = Cam16.fromInt(from);
	const toCam = Cam16.fromInt(to);
	const fromJ = fromCam.jstar;
	const fromA = fromCam.astar;
	const fromB = fromCam.bstar;
	// ... same for to ...
	const jstar = fromJ + (toJ - fromJ) * amount;
	const astar = fromA + (toA - fromA) * amount;
	const bstar = fromB + (toB - fromB) * amount;
	return Cam16.fromUcs(jstar, astar, bstar).toInt();
}
```

CAM16-UCS coordinates `J*`, `a*`, `b*` are derived from CAM16's `J`, `M`, and
hue in `Cam16.fromInt` (`cam16.ts:146-149`): `J*` is a normalized lightness,
and `a*`/`b*` are a perceptual chroma (`M*`) decomposed into Cartesian
components by hue. The space is constructed so that *Euclidean distance* in
`(J*, a*, b*)` approximates perceived color difference (`cam16.ts:65-77`).
That is precisely why interpolation here happens on these three coordinates
rather than on raw `hue`/`chroma`/`tone`: lerping hue in degrees treats a 10°
step near red the same as a 10° step near green, even though the perceived
difference is completely different. Interpolating in `J*a*b*` makes the blend
move at a perceptually constant rate.

## hctHue: blend the hue, keep the character

`hctHue` (`blend.ts:61-67`) is the "blend but stay recognizable" variant:

```ts
hctHue(from: number, to: number, amount: number): number {
	const ucs = Blend.cam16Ucs(from, to, amount);
	const ucsCam = Cam16.fromInt(ucs);
	const fromCam = Cam16.fromInt(from);
	const blended = Hct.from(ucsCam.hue, fromCam.chroma, lstarFromArgb(from));
	return blended.toInt();
}
```

It runs the full UCS blend to find the intermediate *hue*, then throws away the
UCS blend's chroma and tone and reassembles the color from the **original**
color's chroma and tone. The result is `from`, recolored to a hue that is
`amount` of the way toward `to`, with its own chroma and lightness preserved.
`lstarFromArgb` (`utils/color.ts:176-179`) recovers the original tone. The
comment (`blend.ts:51-59`) states the contract plainly: "The chroma and tone of
the original color are maintained."

## Why harmonize stays hue-only

`harmonize` deliberately touches only hue and leaves chroma and tone alone.
The rationale is perceptual neutrality, and it is stated in the doc comment
(`blend.ts:30-39`):

- **Chroma and tone carry identity.** Hue is the axis that makes two colors
  "the same kind of color" (both blue, both orange). If harmonize also
  compressed chroma toward the source, dark design colors would muddy and pale
  ones would wash out; the palette would no longer be the designer's palette.
- **Chroma and tone carry meaning.** In a UI, tone encodes hierarchy (T90 is a
  container, T10 is an on-color) and chroma encodes emphasis. Shifting them
  would silently change accessibility and hierarchy along with the hue.
- **A full HCT lerp would "pass through" the wheel.** Moving hue and chroma
  simultaneously can produce intermediate colors with no relationship to
  either endpoint. Rotating only hue along the shortest arc stays perceptually
  monotone: the color only ever moves toward the source, never away.

The half-rotation cap (`min(difference * 0.5, 15.0)`) is a second layer of
conservatism: even within the hue axis, the design color should only lean
toward the source, never become it. This is what makes harmonize safe to apply
to *every* secondary color of a theme without the designer losing control of
the overall palette.

## Where blend is used

- `harmonize` is wrapped by the public `harmonize(design, source)`
  (`color.ts:118-123`).
- The same function powers the `harmonize` option of custom tokens in
  `palette(..., { extraColors })`: `resolveOne` calls
  `Blend.harmonize(argbFromHex(config.harmonize), seedHct.toInt())`
  (`extend-theme.ts:94-98`), which harmonizes a supplied design color toward
  the theme's seed.
- `hctHue` and `cam16Ucs` are exported from the science barrel
  (`science/index.ts`) but have no consumer in the current public API. They
  exist as reusable building blocks for gradient or animation tooling built on
  top of the package.

Related: [overview](./overview.md), [temperature](./temperature.md).
