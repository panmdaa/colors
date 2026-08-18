# Color Manipulation

- [The HCT model in one paragraph](#the-hct-model-in-one-paragraph)
- [Constructors](#constructors)
- [Number conversions](#number-conversions)
- [Read components](#read-components)
- [Write components](#write-components)
- [Rotating and shifting](#rotating-and-shifting)
- [Bulk edit](#bulk-edit)
- [Tones](#tones)
- [Foreground helpers: `onColor` / `underColor`](#foreground-helpers-oncolor--undercolor)
- [Mixing and gradients in HCT](#mixing-and-gradients-in-hct)
- [Harmonize and disliked colors](#harmonize-and-disliked-colors)

All color manipulation is encapsulated in the immutable, lazily-evaluated
`Color` class (`src/color-class.ts`). Every operation exists both as a
**static method** (taking a hex string or ARGB integer) and as an **instance
method** (operating on a `Color`), so `Color.lighten("#744c9d", 10)` and
`Color.from("#744c9d").lighten(10)` are equivalent.

## The HCT model in one paragraph

HCT stands for **H**ue, **C**hroma, **T**one. It is a color space derived from
CAM16 (perception) and CIELAB lightness: **hue** is the perceptual hue angle
(0-360), **chroma** is the perceptual colorfulness (0 to a gamut-bound maximum),
and **tone** is perceptual lightness (0 = black, 100 = white), equivalent to L*
in L*a*b*. Because the three axes are perceptually meaningful, editing "tone"
changes lightness without disturbing hue/chroma — something impossible to do
cleanly in RGB. The `Color` class delegates to the `Hct` class, which in turn
sits on `Cam16` and the HCT solver.

## Constructors

```ts
Color.from("#744c9d");       // hex string
Color.from(0x744c9d);        // ARGB integer
Color.fromHex("#744c9d");
Color.fromArgb(0x744c9d);
Color.fromNumber(0x744c9d);  // alias of fromArgb
Color.fromHct(283, 36, 62);  // HCT components — deferred solve
Color.fromImage(img);        // Promise<Color> — dominant color of an <img>
```

`Color.from` is the universal constructor: it accepts a hex string or an ARGB
integer and normalizes to a single internal representation. `fromHct` stores
the channels **without** running the expensive inverse solve — the solve
happens only when `hex`/`argb`/`toRgb` is first read. Reading `hue`/`chroma`/
`tone` never triggers it.

## Number conversions

`Color.toNumber` / `Color.fromNumber` are the only bridge between public hex
strings and the internal 32-bit ARGB integer representation:

```ts
Color.toNumber("#744c9d");  // 0xff744c9d (ARGB int)
Color.fromNumber(0xff744c9d).hex;  // "#744c9d"

c.toNumber();  // same as c.toArgb()
c.toArgb();    // 0xff744c9d
c.toHexColor();  // "#744c9d"
c.toHex();       // alias of toHexColor
c.toRgb();       // { r: 116, g: 76, b: 157 }
c.toHct();       // live Hct instance
```

`argbFromHex` / `hexFromArgb` live in `src/utils/string.ts` and are the raw
parse/serialize primitives. `Color` always returns hex strings from `.hex`, so
the integer format never leaks into user code.

## Read components

`Color.getHue`, `Color.getChroma`, `Color.getTone` each read a single axis; the
instance properties `hue`/`chroma`/`tone` read the same values but cache them:

```ts
Color.getHue("#744c9d");    // 283
Color.getChroma("#744c9d"); // 36
Color.getTone("#744c9d");   // 62

const c = Color.from("#744c9d");
c.hue; c.chroma; c.tone;    // computed once, then cached
```

`getTone` is the workhorse of the contrast system: tone is the only component
the scoring code ever extracts (see [contrast.md](./contrast.md)). It uses a
fast path (`lstarFromArgb`) that avoids the full CAM16 pass.

## Write components

`Color.setHue`, `Color.setChroma`, `Color.setTone` set the corresponding axis
and return a new `Color` (the receiver never changes):

```ts
Color.setHue("#744c9d", 200);   // shift hue
Color.setChroma("#744c9d", 50); // increase saturation
Color.setTone("#744c9d", 80);   // lighten

// instance form
c.setHue(200).setChroma(50).setTone(80);
```

Note that setting components is an *assignment*, not a delta — `setTone(c, 50)`
moves the color to exactly tone 50 regardless of where it was.

## Rotating and shifting

`rotateHue` wraps the hue around the circle:

```ts
c.hue = (c.hue + degrees + 360) % 360;
```

The `+ 360` before the modulo guarantees a non-negative result for negative
rotations (e.g. `Color.rotateHue(c, -30)`).

`lighten` / `darken` shift tone, clamped to the valid range. Since the class is
lazy-cached, each call does a single forward CAM16 pass (only when a channel is
first read) plus one inverse solve:

```ts
Color.lighten("#744c9d", 10);  // +10 tone
Color.darken("#744c9d", 10);   // -10 tone
```

`darken` mirrors `lighten` with `Math.max(0, ...)`. Because tone is the
perceptual lightness axis, "lighten by 10" means a perceptually uniform +10
steps — the same delta reads identically across hues.

`saturate` / `desaturate` shift chroma, flooring at 0 so a gray cannot go
"negative chroma":

```ts
Color.saturate("#744c9d", 20);   // +20 chroma
Color.desaturate("#744c9d", 20); // -20 chroma
```

There is no upper clamp on chroma: out-of-gamut values are handled by the
gamut-mapping inside `Hct`, which pulls them back to the closest in-gamut color.

## Bulk edit

`edit` applies an optional `{ hue, chroma, tone }` patch in one call. Unlike the
naive three sequential setters, it resolves the final hue/chroma/tone with a
**single** inverse solve — roughly 3× faster:

```ts
Color.edit("#744c9d", { hue: 200, chroma: 40, tone: 70 });
// instance form — one inverse solve, not three
c.edit({ hue: 200, chroma: 40, tone: 70 });
```

Undefined fields are left untouched — `edit(c, { tone: 90 })` is a three-liner
squeezed into one call.

## Tones

`Color.tone` produces a single tone at a color's hue/chroma:

```ts
Color.tone("#744c9d", 90);  // same hue/chroma, tone 90
c.atTone(90);               // instance form
```

`Color.tones` builds all **14 Material reference tones** at once:

```ts
const ts = Color.tones("#744c9d");
ts[50]; // tone 50 at source color's hue/chroma
```

The `Tones` literal type (`types.ts:78`) is exactly the list
`[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100]`; the returned object
is keyed by numeric string keys (`{ "0": ..., "40": ..., "100": ... }`).
These are the tonal stops Material 3 palettes are built on — the same tones the
dynamic scheme consults when picking role tones.

## Foreground helpers: `onColor` / `underColor`

`onColor` picks a foreground color that contrasts with a given background at a
target ratio:

```ts
Color.onColor("#000000");       // foreground for dark background
Color.onColor("#000000", 7);    // custom ratio
Color.underColor("#ffffff");    // background for light foreground
c.onColor();                    // instance form
```

`underColor(fg, ratio)` is literally `onColor(fg, ratio)`: the contrast ratio
is symmetric, so the "color under" a foreground is the foreground that
contrasts with it.

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

The result keeps the background's hue and chroma and only moves tone, which is
what makes `onColor` feel like a "same color family" foreground rather than a
different gray. Verified examples:

```ts
Color.onColor('#6750a4')  // → '#e0d2ff'  (tone of #6750a4 < 55 → lighter foreground)
Color.onColor('#ffffff')  // → '#747676'  (tone 100 >= 55 → darker foreground)
```

> Compare with `generateOn` in `src/extend-theme.ts`, used for custom
> tokens: it uses a `>= 60` threshold and fixed tones 10/90 with **no** ratio
> guarantee. The two helpers intentionally trade precision for simplicity in
> different places.

## Mixing and gradients in HCT

`Color.mix` averages N colors using **circular hue averaging**:

```ts
Color.mix("#ff0000", "#0000ff");               // hue ~283 (purple)
Color.mix("#ff0000", "#00ff00", "#0000ff");    // three-way blend
Color.mix("#ff0000");                          // single color → itself
```

**Why circular averaging?** Hue is a circle: the arithmetic mean of 350° and
10° is 180°, but the perceptually sensible middle is 0°. By converting each hue
to a point on the unit circle (`sin`/`cos`), summing vectors, and taking the
`atan2` of the centroid, the wrap-around artifact disappears. Chroma and tone
are plain arithmetic means, clamped to `[0, 100]` for tone. `mix` with a single
argument is a no-op passthrough. Verified examples:

```ts
Color.mix('#ff0000', '#0000ff')  // → '#b500b3'  (magenta midway, not gray)
Color.mix('#ff0000')             // → '#ff0000'
```

`Color.gradient` interpolates linearly **in HCT**, not RGB:

```ts
const steps = Color.gradient("#ff0000", "#0000ff", 5);
```

**Why HCT, not RGB?** RGB interpolates through the middle of the cube, passing
through muddy gray-browns between complementary colors. Interpolating each
perceptual axis independently — hue ramps around the wheel, chroma fades,
tone marches uniformly — produces transitions that look smooth to the eye.
Two caveats are visible in the code: the hue interpolation is linear (not
circular, so it takes the "long way" across 0/360 when endpoints straddle it),
and chroma is clamped at 0 since hue interpolation can push a color past gray.
With `count < 2` the function returns `[from]`. Verified example:

```ts
Color.gradient('#ff0000', '#0000ff', 5)
// → ['#ff0000', '#8c6e00', '#00753d', '#006174', '#0000ff']
```

Note how the middle stops pass through warm khaki and green, never the muddy
gray an RGB lerp would produce between pure red and blue.

`resolveMix` in `extend-theme.ts` is the same averaging math, but accepts
palette role names (`"primary"`, ...) in addition to hex strings so custom
tokens can mix existing roles.

## Harmonize and disliked colors

`harmonize` pulls a design color toward a source color's hue:

```ts
Color.harmonize("#ff0000", "#744c9d");  // shifts design color toward source
```

The implementation uses `Blend.harmonize` (from `src/science/blend.ts`), which
rotates the design hue toward the source hue while preserving chroma and tone —
the standard Material 3 trick for making an off-palette accent feel on-theme.
Verified example:

```ts
Color.harmonize('#ff5500', '#6750a4')  // → '#ff5150'
```

`isDisliked` and `fixDisliked` delegate to Material's `DislikeAnalyzer`, which
flags a small set of hue ranges (yellow-greens like "banana yellow", low-light
browns) that people consistently rate as ugly:

```ts
Color.isDisliked("#4a7a3f");   // true
Color.fixDisliked("#4a7a3f");  // shifted to avoid the disliked zone
c.isDisliked(); c.fixDisliked();  // instance form
```

`fixDisliked` returns the color unchanged unless it is disliked, in which case
it rotates the hue out of the bad range while preserving chroma and tone —
useful as a safety net right after `palette()` if you want to guarantee a
"liked" seed.

## The `Color` class

The `Color` class is the recommended way to work with a single color
repeatedly:

```ts
import { Color } from "@panmdaa/colors";

const c = Color.from("#744c9d");
c.hue;      // 283 — CAM16 forward pass runs once, then is cached
c.chroma;   // 36
c.tone;     // 62
```

- `Color.from(hex | argb)` parses the input once and stores the ARGB integer.
- `Color.fromHct(hue, chroma, tone)` stores the channels **without** running the
  expensive inverse solve — the solve happens only when `hex`/`argb`/`toRgb` is
  first read (`solveIfPending`). Reading `hue`/`chroma`/`tone` never triggers it.
- The first read of `hue`, `chroma`, or `tone` on an argb-backed color runs a
  single lean CAM16 forward pass (`Cam16.hctFromArgb`, `src/hct/cam16.ts`) that
  computes all three channels — and the XYZ `y` used for tone — in one pass,
  avoiding the separate RGB→XYZ recomputation the eager `Hct` used to do.
- Every mutation (`setHue`, `lighten`, `saturate`, `edit`, ...) is **immutable**:
  it returns a new `Color` and never modifies the receiver, so chains like
  `Color.from(seed).lighten(10).saturate(20).rotateHue(45)` are safe. A chain
  that never reads the final `.hex` pays **zero** inverse solves.

Methods:

```ts
c.setHue(200).setChroma(50).setTone(80);  // per-channel, one solve each
c.rotateHue(90);
c.lighten(10); c.darken(10);               // tone shifts
c.saturate(20); c.desaturate(20);          // chroma shifts
c.edit({ hue: 200, chroma: 40, tone: 70 }); // one inverse solve, not three
c.atTone(90);                              // single tone at same hue/chroma
c.tones();                                 // Record<Tones, ColorValue>
c.onColor();                               // contrast-safe foreground
c.contrastWith("#ffffff");                 // WCAG ratio vs another color
c.harmonize("#ff0000");
c.isDisliked(); c.fixDisliked();

// Constructors
Color.from("#744c9d");    // hex string
Color.from(0x744c9d);     // ARGB integer
Color.fromHex("#744c9d");
Color.fromArgb(0x744c9d);
Color.fromNumber(0x744c9d);
Color.fromHct(283, 36, 62);

// Conversions
c.toHexColor(); c.toHex();  // "#744c9d"
c.toArgb(); c.toNumber();   // 0xff744c9d
c.toRgb();                  // { r: 116, g: 76, b: 157 }
c.toHct();                  // live Hct instance
c.toString(); c.toJSON();   // "#744c9d"
```

Every static helper in this document is a thin wrapper over the instance
methods — `Color.lighten(color, amount)` is `Color.from(color).lighten(amount)
.hex`. Because the class defers solves, repeated channel reads and chained
mutations are measurably faster than re-parsing the hex and re-solving from
scratch on every call — `Color#edit()` runs at ~2.5M ops/s (solve deferred
until `.hex` is read) vs ~278k for the old eager functional `edit()` that
materialized immediately (see `bench/color.bench.ts`).
