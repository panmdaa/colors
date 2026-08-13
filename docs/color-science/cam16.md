# CAM16: A Color Appearance Model

## Table of Contents

- [What CAM16 models](#what-cam16-models)
- [Why a color appearance model is needed](#why-a-color-appearance-model-is-needed)
- [Viewing conditions](#viewing-conditions)
- [Forward transform: XYZ to CAM16](#forward-transform-xyz-to-cam16)
- [Backward transform: CAM16 to XYZ](#backward-transform-cam16-to-xyz)
- [The CAM16-UCS coordinates](#the-cam16-ucs-coordinates)
- [The reference constants](#the-reference-constants)
- [HCT's use of CAM16](#hcts-use-of-cam16)

## What CAM16 models

CAM16 is a color appearance model: a system that predicts how a color is
*perceived*, not just how it is measured. The class docstring in
`src/hct/cam16.ts:15-31` puts it plainly:

> Colors are not just defined by their hex code, but rather, a hex code and
> viewing conditions.

Where a traditional color space answers "what is the physical measurement of
this color?", CAM16 answers "what does this color look like under *these*
lighting conditions?". It produces a full set of appearance dimensions:
hue, chroma, lightness (J), brightness (Q), colorfulness (M), and saturation
(S) — all in one object (`src/hct/cam16.ts:53-63`).

A useful intuition from the source: white under the traditional midday-sun
white point is not "white" to a color appearance model. CAM16 measures it as a
slightly chromatic blue — roughly hue 203, chroma 3, lightness 100
(`src/hct/cam16.ts:28-30`, `src/hct/viewing-conditions.ts:20-22`). A model that
does not account for viewing conditions cannot know that.

## Why a color appearance model is needed

A simple RGB-to-anything matrix transform describes colors as if every screen
were identical and every room equally lit. That breaks in two ways:

1. **The same hex looks different in different environments.** A color in a
   dark room, on a bright display, with a cool or warm surround does not look
   like the same color on paper. CAM16 takes an explicit description of the
   environment — the `ViewingConditions` — and computes appearance within it.
2. **The lightness that drives contrast is not a linear function of RGB.**
   Perceptual lightness is derived from luminance through a power law. A
   matrix-only transform cannot produce the perceptually linear lightness (J)
   that contrast calculations need; it also cannot model chromatic adaptation,
   the eye's tendency to discount the color of the ambient light
   (`src/hct/viewing-conditions.ts:48-51`).

CAM16 is CIECAM02's successor, kept computationally simpler while staying
accurate enough for color science work. It is the model Google's Material Color
Utilities chose, and `@panmdaa/colors` inherits that choice to stay
byte-compatible with Material Design 3 themes.

## Viewing conditions

`ViewingConditions` (`src/hct/viewing-conditions.ts:27`) bundles the
environment parameters CAM16 needs and — critically — **precomputes every
intermediate value that depends only on those parameters**, so the per-color
transform is fast. `ViewingConditions.DEFAULT` (`src/hct/viewing-conditions.ts:29`)
is the "sRGB-like" environment used by the whole library.

`ViewingConditions.make` (`src/hct/viewing-conditions.ts:53-97`) takes five
physical parameters, each with a default:

```ts
static make(
    whitePoint = whitePointD65(),
    adaptingLuminance = ((200.0 / Math.PI) * yFromLstar(50.0)) / 100.0,
    backgroundLstar = 50.0,
    surround = 2.0,
    discountingIlluminant = false
): ViewingConditions
```

- **whitePoint** — the reference white in XYZ, default D65: `[95.047, 100.0, 108.883]`
  (`src/utils/color.ts:33`), the standard "sunny day afternoon" illuminant.
- **adaptingLuminance** — how bright the room is. The default derives from 200
  lux (multiplying lux by `0.0586`).
- **backgroundLstar** — the L\* of the area around the color, default 50.
- **surround** — a coarse description of lighting: 0 is a dark theater, 1.0 a
  dim home theater, 2.0 is a color lit the same as its surroundings.
- **discountingIlluminant** — whether the eye compensates for the ambient
  light's tint. Default `false`, because displays are self-luminous and the eye
  does not perform this process on them (`src/hct/viewing-conditions.ts:48-51`).

From these it computes the derived parameters that CAM16 uses on every color:
the chromatic-adaptation discount factors `rgbD` (`:72-76`), the luminance-level
adaptation factor `fl` (`:77-80`), the background-adjusted parameters `n`,
`nbb`, `ncb`, `z`, `c`, `nc` (`:81-95`), and the achromatic response of the
white point `aw` (`:95`). The constructor docstring is candid about the naming
(`src/hct/viewing-conditions.ts:99-105`):

> Parameters are intermediate values of the CAM16 conversion process. Their
> names are shorthand for technical color science terminology... a complete
> overview requires a color science textbook, such as Fairchild's Color
> Appearance Models.

The default conditions matter to HCT: `Hct.from(hue, chroma, tone)` is always
an HCT *in default viewing conditions* (`src/hct/hct.ts:46`). To see a color in
a different environment, use `Hct.inViewingConditions`
(`src/hct/hct.ts:168-190`), which converts the color's XYZ to the target
conditions and recasts it back in the defaults.

## Forward transform: XYZ to CAM16

The forward direction is `Cam16.fromIntInViewingConditions`
(`src/hct/cam16.ts:94-152`), which parses ARGB → linear RGB → XYZ and then
runs the appearance model. The steps, each mapping to a block in the code:

1. **Unpack and linearize.** ARGB → R, G, B via bit shifts (`:95-97`), then
   `linearized()` removes gamma (`:98-100`, `src/utils/color.ts:219-226`).
2. **sRGB → XYZ.** The standard matrix rows 0.41233895 / 0.2126 / 0.01932141
   (`:101-103`).
3. **XYZ → cone responses.** A matrix maps XYZ onto the three photoreceptor
   response axes (`:105-107`).
4. **Discount the illuminant.** Multiply each cone response by the viewing
   conditions' `rgbD` factor, which is 1 minus the adaptation amount
   (`:109-111`, `src/hct/viewing-conditions.ts:72-76`).
5. **Post-adaptation nonlinear compression.** A saturating power curve
   simulates the cone response (`:113-119`):

   ```ts
   const rAF = ((viewingConditions.fl * Math.abs(rD)) / 100.0) ** 0.42;
   const rA = (signum(rD) * 400.0 * rAF) / (rAF + 27.13);
   ```

6. **Opponent signals and hue.** `a` (red-green) and `b` (yellow-blue) are
   linear combinations of the adapted responses (`:121-122`); hue is
   `Math.atan2(b, a)` in degrees, normalized to `0..360` (`:125-128`).
7. **Lightness and brightness.** The achromatic response `ac` is combined with
   the adapted white `aw` to produce lightness `J` and brightness `Q`
   (`:130-137`).
8. **Chroma, colorfulness, saturation.** From the hue-dependent eccentricity
   factor `eHue`, the model derives chroma `C`, colorfulness `M`, and
   saturation `S` (`:138-145`).
9. **CAM16-UCS projection.** J and M are re-projected into the uniform space
   (`:146-149`), described below.

## Backward transform: CAM16 to XYZ

`Cam16.viewed(viewingConditions)` (`src/hct/cam16.ts:245-285`) inverts the
above for a specific environment and returns ARGB. The inverse is mostly the
same formulas solved backwards:

- `alpha` and `t` re-derive the colorfulness magnitude from chroma and J
  (`:246-249`).
- `ac` is recomputed from J and the adapted white (`:253-257`).
- The hue angle recovers the `a`/`b` opponent signals (`:259-264`).
- The cone responses are reconstructed, the nonlinear compression is inverted
  with a `signum`-preserving power (`:265-274`), and the illuminant discount is
  undone by dividing by `rgbD` (`:275-277`).
- A 3x3 matrix converts back to XYZ (`:279-281`), and `argbFromXyz` finishes
  the job (`src/utils/color.ts:90-99`).

`Cam16.fromXyzInViewingConditions` (`:289-362`) and `xyzInViewingConditions`
(`:365-405`) are the same pair expressed against XYZ directly instead of ARGB —
that is the pair `Hct.inViewingConditions` uses (`src/hct/hct.ts:170-178`).

## The CAM16-UCS coordinates

Beyond the appearance dimensions, every `Cam16` carries a projection into
CAM16-UCS: `jstar`, `astar`, `bstar` (`src/hct/cam16.ts:146-149`). CAM16-UCS is
a Euclidean re-parameterization in which straight-line distance approximates
perceived color difference, and it is included in the CAM16 specification
(`src/hct/cam16.ts:17-22`):

```ts
const jstar = ((1.0 + 100.0 * 0.007) * j) / (1.0 + 0.007 * j);
const mstar = (1.0 / 0.0228) * Math.log(1.0 + 0.0228 * m);
const astar = mstar * Math.cos(hueRadians);
const bstar = mstar * Math.sin(hueRadians);
```

`Cam16.distance` (`src/hct/cam16.ts:70-77`) turns that into a ΔE score:

```ts
const dEPrime = Math.sqrt(dJ * dJ + dA * dA + dB * dB);
const dE = 1.41 * dEPrime ** 0.63;
```

This is the metric used where perceptual similarity matters: blending colors,
scoring a seed color's representativeness, and image quantization all operate
in CAM16-UCS so that "similar" means "looks similar", not "has close channel
values".

## The reference constants

The forward transform hard-codes the CAM16 standard matrices:

- sRGB → XYZ: `0.41233895 / 0.35762064 / 0.18051042` (R row), `0.2126 / 0.7152 /
  0.0722` (G row), `0.01932141 / 0.11916382 / 0.95034478` (B row)
  (`src/hct/cam16.ts:101-103`). These match the SRGB_TO_XYZ matrix in
  `src/utils/color.ts:21-25`.
- XYZ → cone responses: `0.401288 / 0.650173 / -0.051461` (R), `-0.250268 /
  1.204414 / 0.045854` (G), `-0.002079 / 0.048952 / 0.953127` (B)
  (`src/hct/cam16.ts:105-107`).
- Cone responses → XYZ (inverse): `1.86206786 / -1.01125463 / 0.14918677` (R),
  `0.38752654 / 0.62144744 / -0.00897398` (G), `-0.0158415 / -0.03412294 /
  1.04996444` (B) (`src/hct/cam16.ts:279-281`).
- The compression exponent `0.42`, the gain `400`, and the offset `27.13`
  (`src/hct/cam16.ts:113-119`).
- The white point D65 `[95.047, 100.0, 108.883]` (`src/utils/color.ts:33`).

These constants come straight from the CAM16 specification (Luo et al.) as
implemented in Google's Material Color Utilities, and are identical across the
forward and backward directions — which is what makes the round-trip
ARGB → CAM16 → ARGB stable.

## HCT's use of CAM16

HCT deliberately takes only **hue and chroma** from CAM16 and uses L\* (CIELAB)
for its lightness channel (`src/hct/hct.ts:12-26`, `src/hct/hct.ts:138-144`).
Why not CAM16's J? Because HCT's tone must be L\*, the perceptually linear
lightness that maps directly to WCAG contrast (see [hct.md](./hct.md#why-tone-is-a-separate-dimension)).
CAM16 still supplies everything else: hue and chroma carry the perceptual
uniformity of hue and colorfulness, `inViewingConditions` uses CAM16's XYZ
round-trip to translate colors between environments (`src/hct/hct.ts:168-190`),
and the CAM16-UCS coordinates power the blend, score, and quantization
utilities.
