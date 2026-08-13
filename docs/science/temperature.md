# Temperature

- [Why temperature exists](#why-temperature-exists)
- [The raw temperature formula](#the-raw-temperature-formula)
- [The cache: hctsByHue, tempsByHct, hctsByTemp](#the-cache-hctsbyhue-tempsbyhct-hctsbytemp)
- [Relative temperature](#relative-temperature)
- [Warmest and coldest](#warmest-and-coldest)
- [Analogous colors](#analogous-colors)
- [The complement](#the-complement)
- [Where temperature is used](#where-temperature-is-used)

## Why temperature exists

`TemperatureCache` (`src/science/temperature.ts:23`) implements a
warm/cool measure of color. The motivation is documented in the module
(`temperature.ts:263-271`): color psychology research ties warm-cool to
emotional response and harmony, and art theory builds the two most important
harmony constructs — analogous colors and complementary colors — on top of it.
The implementation follows the algorithm of Li-Chen Ou's chapter in the
*Handbook of Color Psychology* (2015, `temperature.ts:269`) and is itself an
implementation of the Ou, Woodcock and Wright model (`temperature.ts:272`),
which operates on `L*a*b*` / LCH coordinates rather than CAM16.

A key consequence of the model choice: warm-cool is not simply "red is warm,
blue is cool". It is a continuous, chroma-dependent quantity — a very saturated
orange is warmer than a pale orange, and every hue has a warm and a cool side
that changes with chroma. The design intent is that harmony operations
(analogous, complement) should walk the wheel by *temperature* rather than by
raw hue degrees, because temperature is the perceptually meaningful axis.

## The raw temperature formula

`rawTemperature` (`temperature.ts:282-290`) is the only math in the module. It
is a static method because it depends only on the color itself:

```ts
static rawTemperature(color: Hct): number {
	const lab = labFromArgb(color.toInt());
	const hue = sanitizeDegreesDouble((Math.atan2(lab[2]!, lab[1]!) * 180.0) / Math.PI);
	const chroma = Math.sqrt(lab[1]! * lab[1]! + lab[2]! * lab[2]!);
	const temperature =
		-0.5 +
		0.02 * chroma ** 1.07 * Math.cos((sanitizeDegreesDouble(hue - 50.0) * Math.PI) / 180.0);
	return temperature;
}
```

Piece by piece:

- `labFromArgb` (`utils/color.ts:136-155`) converts the color to `L*a*b*`
  space. The two chromatic coordinates `a*` and `b*` (`lab[1]`, `lab[2]`) form
  the familiar red-green / yellow-blue plane.
- The hue is the polar angle of that plane, `atan2(b, a)`, in degrees.
- The chroma is the polar radius, `sqrt(a^2 + b^2)`.
- The temperature is `-0.5 + 0.02 * chroma^1.07 * cos(hue - 50°)`.

Two design choices stand out:

- **The `-50°` phase offset.** The cosine peaks at hue 50°, which places the
  warmest point in the orange range rather than at pure red. This encodes the
  art-world intuition that the warmest color is orange, not red, and that
  "warm" and "cool" are anchored near the orange/blue axis.
- **The `chroma^1.07` term.** Temperature grows with saturation but slightly
  superlinearly (`1.07`), so very chromatic colors are disproportionately warm
  or cool. Neutral colors (chroma near 0) collapse to `-0.5`, a fixed
  "neither warm nor cool" midpoint, which is why grays behave neutrally
  regardless of any residual hue cast.

The result is a number with no fixed bounds: values below 0 read as cool,
above 0 as warm (`temperature.ts:275`). The header comment
(`temperature.ts:276-279`) documents approximate bounds assuming `chroma = 130`
(lower `-0.52 - chroma^1.07/20`, upper `-0.52 + chroma^1.07/20`); note that
this bound prose assumes a `1/20` coefficient while the code uses `0.02`
(`1/50`), so the practical range at that chroma is roughly `[-4.1, 3.1]` — the
comment's absolute numbers are only indicative. The sign of the value is what
matters.

## The cache: hctsByHue, tempsByHct, hctsByTemp

Computing temperature requires a Lab conversion, and the harmony operations
need temperature for *every* hue, so the class caches aggressively. Each
getter builds its cache once and reuses it (the constructor holds only the
input `Hct`, `temperature.ts:24`):

- `hctsByHue` (`temperature.ts:242-253`) materializes 361 `Hct` instances —
  one per integer hue from 0 to 360 — all with the input's chroma and tone.
  This is the "color wheel" the harmony operations walk.
- `tempsByHct` (`temperature.ts:225-236`) maps every one of those HCTs (plus
  the input) to its `rawTemperature`. These two caches are pure functions of
  the input color, so they are safe to memoize.
- `hctsByTemp` (`temperature.ts:32-42`) is the same set sorted ascending by
  temperature, which makes `warmest`/`coldest` O(1) lookups of the last/first
  elements.

## Relative temperature

`relativeTemperature` (`temperature.ts:202-212`) rescales a color's raw
temperature into `[0, 1]` relative to the warmest and coldest colors at the
input's chroma and tone:

```ts
relativeTemperature(hct: Hct): number {
	const range = this.tempsByHct.get(this.warmest)! - this.tempsByHct.get(this.coldest)!;
	const differenceFromColdest =
		this.tempsByHct.get(hct)! - this.tempsByHct.get(this.coldest)!;
	// Handle when there's no difference in temperature between warmest and
	// coldest: for example, at T100, only one color is available, white.
	if (range === 0.0) {
		return 0.5;
	}
	return differenceFromColdest / range;
}
```

"Relative" here means relative to the *same chroma and tone* — not to an
absolute warm/cool scale. That is deliberate: temperature comparisons are only
meaningful between colors that share chroma and tone, because chroma strongly
inflates the raw temperature. The `range === 0.0` guard returns the neutral
midpoint `0.5` when every hue collapses to the same temperature — which is
exactly what happens at T0 (black) and T100 (white), where only one color
exists. `inputRelativeTemperature` (`temperature.ts:215-222`) caches the
input's relative temperature because it is queried by the complement search.

## Warmest and coldest

`warmest` and `coldest` (`temperature.ts:44-50`) return the extreme elements of
`hctsByTemp`. Their importance is not the colors themselves but the fact that
they define the relative temperature scale, and the complement algorithm is
anchored on them.

## Analogous colors

`analogous(count = 5, divisions = 12)` (`temperature.ts:65-147`) returns
`count` colors adjacent to the input on the wheel. It is the art-school "5
colors on a 12-section color wheel" concept, made general.

The algorithm walks hue outward from the input in integer steps
(`temperature.ts:71-116`), accumulating *absolute* temperature deltas between
consecutive hues. It computes the total temperature delta around the full 360°
circle, divides it by `divisions` to get `tempStep`, and then walks again,
emitting a new wheel color every time the accumulated delta crosses the next
multiple of `tempStep`. Colors are thus spaced **equidistantly in temperature,
not in hue degrees** — that is the whole point of the class.

The inner loop (`temperature.ts:102-107`) handles a subtle edge case
documented in the source (`temperature.ts:94-101`): when there are fewer than
`divisions` discrete temperature steps in the full wheel — true for white and
black, which have no analogues at all — the same color is pushed repeatedly so
the output always has the requested length. After the wheel is built, the
answers are assembled symmetrically around the input: first rotating
counter-clockwise, then clockwise (`temperature.ts:118-144`).

## The complement

`complement` (`temperature.ts:156-196`) finds the color that is "as cool as
the input is warm". The implementation is a scan, not a formula:

1. Anchor on the coldest and warmest colors. `isBetween`
   (`temperature.ts:256-261`) decides whether the input hue lies on the
   cold-to-warm arc or the warm-to-cold arc; the search starts from the
   opposite end and rotates across the other section
   (`temperature.ts:167-174`).
2. The target is `complementRelativeTemp = 1.0 - inputRelativeTemperature`
   (`temperature.ts:178`): the mirror position of the input on the relative
   temperature scale.
3. The loop (`temperature.ts:181-193`) walks hue in single-degree steps across
   the opposite section, computes each candidate's relative temperature, and
   keeps the one with the smallest absolute error against the target.

This is the "across the color wheel" complement, but defined on the
temperature axis: the complement of a warm color is a color of the same
chroma/tone that is *equally cool*. The result is cached (`complementCache`,
`temperature.ts:156-159`).

## Where temperature is used

`TemperatureCache` is consumed only by the theme-spec layer, never directly by
the public API:

- The `content` variant builds its tertiary palette from
  `analogous(count = 3, divisions = 6)[2]` — the third color on a 6-section
  temperature wheel (`palettes.ts:188-195`).
- The `fidelity` variant builds its tertiary palette from `complement`
  (`palettes.ts:196-199`).

Both results pass through `DislikeAnalyzer.fixIfDisliked` on the way in
(`palettes.ts:189`, `palettes.ts:198`), because the analogous/complement
machinery can land on the disliked dark yellow-green zone. The scheme-variant
definitions also reference `TemperatureCache` in their rationale comments
(`variants.ts:23`, `variants.ts:89`).

Note that `temperature.ts` itself performs no blending — blending lives in
`Blend` (`src/science/blend.ts`). Temperature supplies the *geometry* of
harmony; blend supplies the *interpolation*. They are separate tools that the
spec layer composes.

Related: [overview](./overview.md), [blend](./blend.md),
[dislike-analyzer](./dislike-analyzer.md).
