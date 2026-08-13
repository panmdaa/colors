# Color Manipulation

- [The HCT model in one paragraph](#the-hct-model-in-one-paragraph)
- [Number conversions](#number-conversions)
- [HCT access](#hct-access)
- [Read components](#read-components)
- [Write components](#write-components)
- [Rotating and shifting](#rotating-and-shifting)
- [Bulk edit](#bulk-edit)
- [Tones](#tones)
- [Foreground helpers: `onColor` / `underColor`](#foreground-helpers-oncolor--undercolor)
- [Mixing and gradients in HCT](#mixing-and-gradients-in-hct)
- [Harmonize and disliked colors](#harmonize-and-disliked-colors)

Every function in this document takes and returns `ColorValue` hex strings
unless noted otherwise. All of them are defined in `src/color.ts`.

## The HCT model in one paragraph

HCT stands for **H**ue, **C**hroma, **T**one. It is a color space derived from
CAM16 (perception) and CIELAB lightness: **hue** is the perceptual hue angle
(0-360), **chroma** is the perceptual colorfulness (0 to a gamut-bound maximum),
and **tone** is perceptual lightness (0 = black, 100 = white), equivalent to L*
in L*a*b*. Because the three axes are perceptually meaningful, editing "tone"
changes lightness without disturbing hue/chroma — something impossible to do
cleanly in RGB. Every helper below delegates to the `Hct` class, which in turn
sits on `Cam16` and the HCT solver.

## Number conversions

`toNumber` and `fromNumber` are the only bridge between public hex strings and
the internal 32-bit ARGB integer representation (`color.ts:23-29`):

```ts
export function toNumber(color: ColorValue): number {
  return argbFromHex(color);
}

export function fromNumber(color: number): ColorValue {
  return hexFromArgb(color) as ColorValue;
}
```

`argbFromHex` / `hexFromArgb` live in `src/utils/string.ts` and are the raw
parse/serialize primitives. Public functions always return hex, so the integer
format never leaks into user code.

## HCT access

```ts
export function hct(color: ColorValue) {
  return Hct.fromInt(toNumber(color));
}

export function fromHct(hue: number, chroma: number, tone: number): ColorValue {
  return fromNumber(Hct.from(hue, chroma, tone).toInt());
}
```

`hct()` (`color.ts:35`) returns a live, **mutable** `Hct` instance — this is the
escape hatch that powers every setter below. `fromHct()` (`color.ts:39`) is the
inverse: three HCT components in, one hex color out.

## Read components

`getHue`, `getChroma`, `getTone` (`color.ts:47-57`) each read a single axis:

```ts
export function getTone(color: ColorValue): number {
  return hct(color).tone;
}
```

These are the workhorses of the contrast system: tone is the only component the
scoring code ever extracts (see [contrast.md](./contrast.md)).

## Write components

`setHue`, `setChroma`, `setTone` (`color.ts:59-75`) mutate the corresponding
axis on a fresh `Hct` instance and convert back:

```ts
export function setTone(color: ColorValue, tone: number): ColorValue {
  const c = hct(color);
  c.tone = tone;
  return fromNumber(c.toInt());
}
```

Note that setting components is an *assignment*, not a delta — `setTone(c, 50)`
moves the color to exactly tone 50 regardless of where it was.

## Rotating and shifting

`rotateHue` wraps the hue around the circle (`color.ts:77-81`):

```ts
c.hue = (c.hue + degrees + 360) % 360;
```

The `+ 360` before the modulo guarantees a non-negative result for negative
rotations (e.g. `rotateHue(c, -30)`).

`lighten` / `darken` shift tone, clamped to the valid range (`color.ts:83-93`):

```ts
export function lighten(color: ColorValue, amount: number): ColorValue {
  const c = hct(color);
  c.tone = Math.min(100, c.tone + amount);
  return fromNumber(c.toInt());
}
```

`darken` mirrors it with `Math.max(0, ...)`. Because tone is the perceptual
lightness axis, "lighten by 10" means a perceptually uniform +10 steps — the
same delta reads identically across hues.

`saturate` / `desaturate` shift chroma (`color.ts:95-105`), flooring at 0 so a
gray cannot go "negative chroma":

```ts
export function saturate(color: ColorValue, amount: number): ColorValue {
  const c = hct(color);
  c.chroma = Math.max(0, c.chroma + amount);
  return fromNumber(c.toInt());
}
```

There is no upper clamp on chroma: out-of-gamut values are handled by the
gamut-mapping inside `Hct`, which pulls them back to the closest in-gamut color.

## Bulk edit

`edit` applies an optional `{ hue, chroma, tone }` patch in one call
(`color.ts:107-116`):

```ts
export function edit(
  color: ColorValue,
  options: { hue?: number; chroma?: number; tone?: number },
): ColorValue {
  const c = hct(color);
  if (options.hue !== undefined) c.hue = options.hue;
  if (options.chroma !== undefined) c.chroma = options.chroma;
  if (options.tone !== undefined) c.tone = options.tone;
  return fromNumber(c.toInt());
}
```

Undefined fields are left untouched — `edit(c, { tone: 90 })` is a three-liner
squeezed into one call.

## Tones

`tone` produces a single tone at a color's hue/chroma (`color.ts:143-146`):

```ts
export function tone(color: ColorValue, tone: number): ColorValue {
  const c = hct(color);
  return fromHct(c.hue, c.chroma, tone);
}
```

`tones` builds all **14 Material reference tones** at once (`color.ts:133-141`):

```ts
const toneValues: Tones[] = [
  0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100,
];

return Object.fromEntries(
  toneValues.map((t) => [t, fromHct(c.hue, c.chroma, t)]),
) as Record<Tones, ColorValue>;
```

The `Tones` literal type (`types.ts:78`) is exactly this list; the returned
object is keyed by numeric string keys (`{ "0": ..., "40": ..., "100": ... }`).
These are the tonal stops Material 3 palettes are built on — the same tones the
dynamic scheme consults when picking role tones.

## Foreground helpers: `onColor` / `underColor`

`onColor` picks a foreground color that contrasts with a given background at a
target ratio (`color.ts:148-155`):

```ts
export function onColor(bg: ColorValue, ratio = 4.5): ColorValue {
  const c = hct(bg);
  const fgTone =
    c.tone >= 55
      ? Contrast.darkerUnsafe(c.tone, ratio)
      : Contrast.lighterUnsafe(c.tone, ratio);
  return fromHct(c.hue, c.chroma, fgTone);
}
```

`underColor(fg, ratio)` (`color.ts:157-159`) is literally `onColor(fg, ratio)`:
the contrast ratio is symmetric, so the "color under" a foreground is the
foreground that contrasts with it.

**Why the `tone >= 55` branch?** The two possible directions are "make a
darker foreground" and "make a lighter foreground". `Contrast.lighter` computes
the tone that reaches `ratio` going up, and returns -1 when it is physically
impossible (see `src/utils/contrast.ts:61-81`). As tone rises, the lighter
direction runs out of headroom: a tone-55 background can only reach ~3.76:1 by
going to tone 100, below the default 4.5 target. The `>= 55` pivot therefore
chooses the direction that can actually satisfy the ratio — darkening for
anything at or above the middle of the tone scale, lightening below it.
`darkerUnsafe`/`lighterUnsafe` (`src/utils/contrast.ts:130-152`) are the "never
fails" variants that clamp to tone 0 or 100 if the requested ratio cannot be
met at all.

The result keeps the background's hue and chroma and only moves tone
(`fromHct(c.hue, c.chroma, fgTone)`), which is what makes `onColor` feel like a
"same color family" foreground rather than a different gray. Verified examples:

```ts
onColor('#6750a4')  // → '#e0d2ff'  (tone of #6750a4 < 55 → lighter foreground)
onColor('#ffffff')  // → '#747676'  (tone 100 >= 55 → darker foreground)
```

> Compare with `generateOn` in `src/extend-theme.ts:28-32`, used for custom
> tokens: it uses a `>= 60` threshold and fixed tones 10/90 with **no** ratio
> guarantee. The two helpers intentionally trade precision for simplicity in
> different places.

## Mixing and gradients in HCT

`mix` averages N colors (`color.ts:338-362`) using **circular hue averaging**:

```ts
const rad = (c.hue * Math.PI) / 180;
sinSum += Math.sin(rad);
cosSum += Math.cos(rad);
chromaSum += c.chroma;
toneSum += c.tone;

const avgHue = ((Math.atan2(sinSum / n, cosSum / n) * 180) / Math.PI + 360) % 360;
```

**Why circular averaging?** Hue is a circle: the arithmetic mean of 350° and
10° is 180°, but the perceptually sensible middle is 0°. By converting each hue
to a point on the unit circle (`sin`/`cos`), summing vectors, and taking the
`atan2` of the centroid, the wrap-around artifact disappears. Chroma and tone
are plain arithmetic means, clamped to `[0, 100]` for tone. `mix` with a single
argument is a no-op passthrough (`color.ts:339`). Verified examples:

```ts
mix('#ff0000', '#0000ff')  // → '#b500b3'  (magenta midway, not gray)
mix('#ff0000')             // → '#ff0000'
```

`gradient` (`gradient.ts:16-33`) interpolates linearly **in HCT**, not RGB:

```ts
const t = i / (count - 1);
const hue = a.hue + (b.hue - a.hue) * t;
const chroma = a.chroma + (b.chroma - a.chroma) * t;
const tone = a.tone + (b.tone - a.tone) * t;
```

**Why HCT, not RGB?** RGB interpolates through the middle of the cube, passing
through muddy gray-browns between complementary colors. Interpolating each
perceptual axis independently — hue ramps around the wheel, chroma fades,
tone marches uniformly — produces transitions that look smooth to the eye.
Two caveats are visible in the code: the hue interpolation is linear (not
circular, so it takes the "long way" across 0/360 when endpoints straddle it),
and chroma is clamped at 0 (`gradient.ts:30`) since hue interpolation can push
a color past gray. With `count < 2` the function returns `[from]`
(`gradient.ts:21`). Verified example:

```ts
gradient('#ff0000', '#0000ff', 5)
// → ['#ff0000', '#8c6e00', '#00753d', '#006174', '#0000ff']
```

Note how the middle stops pass through warm khaki and green, never the muddy
gray an RGB lerp would produce between pure red and blue.

`resolveMix` in `extend-theme.ts:46-73` is the same averaging math, but accepts
palette role names (`"primary"`, ...) in addition to hex strings so custom
tokens can mix existing roles.

## Harmonize and disliked colors

`harmonize` pulls a design color toward a source color's hue (`color.ts:118-123`):

```ts
export function harmonize(design: ColorValue, source: ColorValue): ColorValue {
  return fromNumber(Blend.harmonize(toNumber(design), toNumber(source)));
}
```

`Blend.harmonize` (from `src/science/blend.ts`) rotates the design hue toward
the source hue while preserving chroma and tone — the standard Material 3 trick
for making an off-palette accent feel on-theme. Verified example:

```ts
harmonize('#ff5500', '#6750a4')  // → '#ff5150'
```

`isDisliked` and `fixDisliked` (`color.ts:125-131`) delegate to Material's
`DislikeAnalyzer`, which flags a small set of hue ranges (yellow-greens like
"banana yellow", low-light browns) that people consistently rate as ugly:

```ts
export function isDisliked(color: ColorValue): boolean {
  return DislikeAnalyzer.isDisliked(hct(color));
}

export function fixDisliked(color: ColorValue): ColorValue {
  return fromNumber(DislikeAnalyzer.fixIfDisliked(hct(color)).toInt());
}
```

`fixDisliked` returns the color unchanged unless it is disliked, in which case
it rotates the hue out of the bad range while preserving chroma and tone —
useful as a safety net right after `palette()` if you want to guarantee a
"liked" seed.
