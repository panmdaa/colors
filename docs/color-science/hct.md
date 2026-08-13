# The HCT Color Space

## Table of Contents

- [What HCT is](#what-hct-is)
- [Hue, Chroma, Tone: the three channels](#hue-chroma-tone-the-three-channels)
- [Why Tone is a separate dimension](#why-tone-is-a-separate-dimension)
- [Hct.from / Hct.fromInt / Hct.toInt](#hctfrom--hctfromint--hcttoint)
- [Setting channels and the chroma fallback](#setting-channels-and-the-chroma-fallback)
- [Tone limits on chroma](#tone-limits-on-chroma)
- [Why HCT and not HSL / HSV / OKLCH](#why-hct-and-not-hsl--hsv--oklch)

## What HCT is

HCT is a color space built from two existing, well-understood models: the hue
and chroma of CAM16 (a color appearance model) and L\* from L\*a\*b\* (CIELAB)
for the lightness channel. The header of `src/hct/hct.ts:12-26` states the
intent directly:

> A color system built using CAM16 hue and chroma, and L\* from L\*a\*b\*.
>
> Using L\* creates a link between the color system, contrast, and thus
> accessibility. Contrast ratio depends on relative luminance, or Y in the XYZ
> color space. L\*, or perceptual luminance can be calculated from Y.

The design goal is a coordinate system where the three channels are independent
in a way humans can reason about: rotating hue keeps the same perceived
lightness and colorfulness, moving up in tone keeps the same color while
getting lighter, and the tone channel maps linearly to WCAG contrast. That is
what makes dynamic theme generation — choosing a tone for a role and trusting
the contrast — tractable.

## Hue, Chroma, Tone: the three channels

- **Hue** — a number in degrees, `0 <= hue < 360`, measuring what people call
  red, orange, yellow, and so on. It comes directly from CAM16
  (`src/hct/hct.ts:77-79`), which computes it as the angle of the
  redness-greenness / yellowness-blueness opponent response pair
  (`src/hct/cam16.ts:121-128`).
- **Chroma** — "informally, colorfulness / color intensity. like saturation in
  HSL, except perceptually accurate" (`src/hct/cam16.ts:44`). Pure `#ff0000`
  measures chroma ~113, gray measures 0, and no sRGB color exceeds roughly 133.
  Chroma's maximum depends on both hue and tone (`src/hct/hct.ts:42-44`).
- **Tone** — lightness, `0 <= tone <= 100`, equal to L\* in L\*a\*b\*. It is
  computed not from CAM16 but from Y via `lstarFromArgb` when parsing a color
  (`src/hct/hct.ts:142`, `src/utils/color.ts:176-179`).

Because hue and chroma come from CAM16 and tone comes from CIELAB, an `Hct`
object stores the two systems' results and reconciles them. `Hct` exposes
read-only getters for all three and setter methods that rebuild the whole state
through the solver (`src/hct/hct.ts:86-115`).

## Why Tone is a separate dimension

Tone is not a cosmetic addition. It is the channel that carries the library's
accessibility guarantee, and it exists precisely because of the relationship
between Y, L\*, and WCAG contrast ratio.

WCAG contrast ratio is computed from the relative luminance Y of two colors
(`src/utils/contrast.ts:45-49`):

```ts
ratioOfYs(y1: number, y2: number): number {
    const lighter = y1 > y2 ? y1 : y2;
    const darker = lighter === y2 ? y1 : y2;
    return (lighter + 5.0) / (darker + 5.0);
}
```

Y is *not* linear to human perception. The same step in Y looks much darker at
low luminance than at high luminance. L\* fixes that: it is the perceptually
linearized version of Y (`yFromLstar` / `lstarFromY`,
`src/utils/color.ts:192-209`), and it is exactly what the contrast formula
needs once inverted. The HCT header states the payoff with numbers
(`src/hct/hct.ts:24-25`):

> A difference of 40 in HCT tone guarantees a contrast ratio >= 3.0, and a
> difference of 50 guarantees a contrast ratio >= 4.5.

That is a linear rule in tone. Contrast in Y is a ratio; contrast in tone is a
difference. When `DynamicScheme` needs "the foreground for this surface",
it searches tone space (`Contrast.lighter` / `darker`,
`src/utils/contrast.ts:61-114`) knowing that moving 50 steps guarantees the
WCAG AA threshold — no per-color computation needed. If tone were not a
separate, perceptually linear dimension, every contrast decision would require
a full XYZ round-trip and a ratio check.

Tone is also why `onColor` in the public API can pick a readable foreground in
three lines: it compares tones, picks `darkerUnsafe` or `lighterUnsafe`, and
re-builds the color at that tone (`src/color.ts:148-155`).

## Hct.from / Hct.fromInt / Hct.toInt

`Hct` has two construction paths and one serialization method:

- `Hct.from(hue, chroma, tone)` — the inverse direction. It calls
  `HctSolver.solveToInt(hue, chroma, tone)` and wraps the resulting ARGB in a
  new `Hct` (`src/hct/hct.ts:53-55`). This is the expensive path: the solver
  has to find an sRGB color matching the requested coordinates (see
  [hct-solver.md](./hct-solver.md)).
- `Hct.argbFrom(hue, chroma, tone)` — identical, but returns the raw ARGB int
  instead of an `Hct` (`src/hct/hct.ts:57-59`).
- `Hct.fromInt(argb)` — the forward direction. It runs `Cam16.fromInt(argb)`
  for hue and chroma and `lstarFromArgb(argb)` for tone (`src/hct/hct.ts:138-144`).
- `toInt()` — returns the ARGB the `Hct` was built from (`src/hct/hct.ts:69-71`).
  After any setter, that ARGB is the result of the solver, so it is the nearest
  in-gamut color.

Both paths converge on ARGB and re-derive the three channels from it. This
round-trip discipline is what guarantees the inverse is exact: `Hct.fromInt(x)`
then `Hct.from(c.hue, c.chroma, c.tone)` returns a color whose ARGB is within a
rounding error of `x`.

```ts
// forward: parse a hex into perceptual coordinates
const c = Hct.fromInt(toNumber("#ff0000"));   // hue ~27.4, chroma ~113, tone ~53.2

// inverse: build an sRGB color from perceptual coordinates
const red = Hct.from(27.41, 113.36, 53.23).toInt();   // 0xffff0000
```

## Setting channels and the chroma fallback

Each setter re-solves the whole triple instead of patching one number
(`src/hct/hct.ts:86-115`):

```ts
set chroma(newChroma: number) {
    this.setInternalState(HctSolver.solveToInt(this.internalHue, newChroma, this.internalTone));
}
```

`setInternalState` (`src/hct/hct.ts:146-152`) re-runs the forward parse on the
solver's result. This is why the docstrings on every setter carry the same
warning: **"Chroma may decrease because chroma has a different maximum for any
given hue and tone."** If the requested chroma does not fit inside the sRGB
gamut at that hue and tone, `solveToInt` falls back to the gamut boundary and
the reported chroma comes back lower than requested. The setter does not
silently store the impossible value — it stores what is actually renderable.

The same fallback protects `tone`: a tone of 0 or 100 is only reachable as an
achromatic color, so setting a bright red to tone 100 returns a near-white with
chroma forced to roughly 0 (`HctSolver.solveToInt` short-circuits extreme tones
to `argbFromLstar`, `src/hct/hct-solver.ts:467-470`).

## Tone limits on chroma

Two hard limits bound the usable (hue, chroma, tone) space:

1. **The sRGB gamut.** The set of (hue, chroma) pairs that exist at a given
   tone is a non-circular, tone-dependent region. In RGB terms it is the
   intersection of the tone's Y-plane with the linear RGB cube
   (`HctSolver.nthVertex`, `src/hct/hct-solver.ts:223-257`). At tone 50, blue
   reaches far higher chroma than yellow; near tone 0 or 100, all chroma
   collapses. The solver is what computes this boundary (see
   [hct-solver.md](./hct-solver.md#the-gamut-search)).
2. **The linear response limit.** CAM16's post-adaptation compression is a
   saturating function — `400 * x^0.42 / (x^0.42 + 27.13)`
   (`src/hct/cam16.ts:113-119`). Above a chroma of roughly 100, pushing chroma
   harder moves the color less and less in RGB terms; at the extreme end the
   linear RGB channels exceed `100.01` and `findResultByJ` refuses to return a
   color (`src/hct/hct-solver.ts:438-446`).

The practical consequence for theme generation: `TonalPalette` never stores the
requested chroma as a promise. It asks `KeyColor` for the highest tone at which
that chroma is actually reachable (`src/palette/tonal-palette.ts:96`), so every
palette color is guaranteed in-gamut by construction.

## Why HCT and not HSL / HSV / OKLCH

This is the decision that makes the whole library possible, and it is worth
being precise about why the alternatives fail.

**HSL and HSV are not perceptually uniform, and their lightness is wrong for
contrast.** In HSL, "lightness" is `(max + min) / 2` — a geometric average of
channels, not a luminance measure. Two HSL colors with identical lightness can
have wildly different WCAG contrast against the same background, because the
ratio formula needs Y, not an average. Yellow (`#ffff00`, tone ~97) and blue
(`#0000ff`, tone ~32) have the same HSL lightness of 50, yet their contrast is
enormous. Hue is also distorted: the "hue ring" is not perceptually even, so
equal hue steps do not look equal. And the pure sRGB gamut is a hexagonal prism
in HSV space, which makes color manipulation ("raise chroma by 20") behave very
differently per hue.

**OKLCH fixes perceptual uniformity but has no contrast contract.** OKLab and
OKLCH give a perceptually decent lightness (L), but the WCAG contrast
guarantee HCT bakes in depends on a specific, linear-to-Y lightness — L\* —
with known thresholds ("40 tone steps → 3.0 ratio", `src/hct/hct.ts:24-25`).
OKLCH's L is not that L\*, so the guarantee does not transfer, and the library
would need a separate translation layer to get back to WCAG math. HCT avoids
the translation by choosing L\* directly.

**HCT composes two field-tested models instead of inventing a third.** Hue and
chroma come from CAM16, which accounts for viewing conditions (see
[cam16.md](./cam16.md)); tone comes from CIELAB L\*, the established
perceptual-lightness standard. Each piece is independently documented and
verifiable, and the whole is derived from Google's Material Color Utilities —
so themes match Material Design 3 tooling exactly. A bespoke color space would
forfeit that compatibility for no practical gain.

**The one honest drawback.** HCT is not closed-form in the inverse direction.
Because chroma's max depends on hue and tone inside a non-convex gamut, going
from (hue, chroma, tone) to sRGB requires the solver documented in
[hct-solver.md](./hct-solver.md). HSL/OKLCH conversions are closed formulas and
cheaper to evaluate. The library pays that cost deliberately: the solver runs
once per resolved color and is what buys the linear contrast rule that every
other layer depends on.
