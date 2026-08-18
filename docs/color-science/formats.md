# Color Format Conversions

## Table of Contents

- [The representations in play](#the-representations-in-play)
- [ARGB as the internal currency](#argb-as-the-internal-currency)
- [ARGB integer to hex string](#argb-integer-to-hex-string)
- [Hex string to ARGB integer](#hex-string-to-argb-integer)
- [sRGB linearization](#srgb-linearization)
- [The public entry points](#the-public-entry-points)
- [XYZ and the white point](#xyz-and-the-white-point)
- [Accuracy notes](#accuracy-notes)

## The representations in play

The library moves between four representations, each with a dedicated home in
`src/utils/color.ts` and `src/utils/string.ts`:

| Representation | Example | Producer / consumer |
|----------------|---------|---------------------|
| ARGB integer | `0xfff44336` | Internal currency everywhere in the science core |
| Hex string | `"#f44336"` | The public `ColorValue` format |
| sRGB channels | `(244, 67, 54)` | The unpacked view of ARGB |
| Linear RGB | `(90.47, 5.61, 3.69)` on a 0-100 scale | The color-science workhorse |

Two extra spaces sit on top for CAM16: XYZ and L\*a\*b\*, both rooted at the D65
white point (`src/utils/color.ts:33`).

## ARGB as the internal currency

Every function in the science core takes or returns an ARGB integer. This is a
deliberate design choice with three concrete benefits:

1. **One value, no object graph.** A single 32-bit integer represents the color
   in every intermediate step. `Hct.fromInt(argb)` takes one number
   (`src/hct/hct.ts:65-67`), `Hct.toInt()` returns one (`src/hct/hct.ts:69-71`),
   and `Cam16.fromInt` / `Cam16.toInt` do the same (`src/hct/cam16.ts:84-86`,
   `:236-238`). There is nothing to allocate or garbage-collect.
2. **Channel access is bit manipulation.** Unpacking costs three shifts and
   three masks (`src/utils/color.ts:62-78`):

   ```ts
   redFromArgb(argb: number): number {
       return (argb >> 16) & 255;
   }
   ```

   Packing is one bitwise OR with the alpha pinned to opaque
   (`src/utils/color.ts:38-40`):

   ```ts
   argbFromRgb(red: number, green: number, blue: number): number {
       return ((255 << 24) | ((red & 255) << 16) | ((green & 255) << 8) | (blue & 255)) >>> 0;
   }
   ```

   The trailing `>>> 0` converts the signed 32-bit result back to an unsigned
   integer, keeping channel values in the canonical `0..0xffffffff` range.
3. **One canonical value per color.** `0xfff44336` *is* the color. Two hex
   strings that spell the same color — `"#f44336"` and `"#f44336FF"` — collapse
   to the same ARGB, so equality is a numeric comparison, never a string
   comparison.

## ARGB integer to hex string

`hexFromArgb` (`src/utils/string.ts:22-36`) converts ARGB to a 6-digit hex
string:

```ts
export function hexFromArgb(argb: number) {
    const r = redFromArgb(argb);
    const g = greenFromArgb(argb);
    const b = blueFromArgb(argb);
    const outParts = [r.toString(16), g.toString(16), b.toString(16)];

    for (const [i, part] of outParts.entries()) {
        if (part.length === 1) {
            outParts[i] = '0' + part;
        }
    }

    return '#' + outParts.join('');
}
```

It deliberately emits the alpha channel nowhere: the output is always
`#rrggbb`, never `#aarrggbb`. Because every color the library produces is
opaque (`argbFromRgb` hard-codes `255 << 24`, `src/utils/color.ts:39`), the
alpha is redundant on output and is dropped to keep the strings compact.

## Hex string to ARGB integer

`argbFromHex` (`src/utils/string.ts:44-70`) is the inverse and accepts three
lengths:

- 3 characters, `"f43"` — each digit is doubled into a channel (`:56-58`).
- 6 characters, `"f44336"` — the canonical form (`:60-62`).
- 8 characters, `"fff44336"` — the *leading two* characters are skipped
  (`:63-66`), treating the string as `#aarrggbb`.

```ts
hex = hex.replace('#', '');
const isThree = hex.length === 3;
const isSix = hex.length === 6;
const isEight = hex.length === 8;
if (!isThree && !isSix && !isEight) {
    throw new Error('unexpected hex ' + hex);
}
```

Any other length throws `'unexpected hex <value>'` (`:49-51`). The 8-character
case is the surprising one: the alpha nibble is parsed and **discarded**, and
the returned ARGB always has alpha `255` (`:69`). An 8-digit input is accepted
for compatibility but the alpha value it carries is not honored — the library
is opaque-only by design. The final value is built with the same `>>> 0`
packing as `argbFromRgb` (`:69`).

## sRGB linearization

The science core does not work in gamma-encoded 0-255 channels; it needs
physically linear light. The pair `linearized` / `delinearized`
(`src/utils/color.ts:219-243`) handles the round trip on a **0-100 scale**,
which is a notable and deliberate convention:

```ts
linearized(rgbComponent: number): number {
    const normalized = rgbComponent / 255.0;
    if (normalized <= 0.040449936) {
        return (normalized / 12.92) * 100.0;
    } else {
        return Math.pow((normalized + 0.055) / 1.055, 2.4) * 100.0;
    }
}
```

```ts
delinearized(rgbComponent: number): number {
    const normalized = rgbComponent / 100.0;
    let delinearized = 1.055 * Math.pow(normalized, 1.0 / 2.4) - 0.055;
    if (normalized <= 0.0031308) {
        delinearized = normalized * 12.92;
    }
    return clampInt(0, 255, Math.round(delinearized * 255.0));
}
```

Three things stand out:

1. **0-100 instead of 0-1.** Input to `linearized` is 0-255, output is 0-100.
   `delinearized` is its mirror. This is the scale the CAM16 code and the HCT
   solver use internally (the solver's linear RGB channels range `0..100` and
   are validated against `100.01`, `src/hct/hct-solver.ts:440-443`), so
   everything downstream shares one scale and avoids a repeated `* 100`.
2. **Self-consistent thresholds.** The linearization breakpoint `0.040449936`
   is exactly `0.0031308 * 12.92` — the delinearization breakpoint multiplied
   back through the linear segment. The two piecewise formulas are algebraic
   inverses of each other on each segment (up to the `Math.round` at the end of
   `delinearized`), so `delinearized(linearized(x))` returns `x` for the vast
   majority of channels and is never off by more than one unit.
3. **The delinearized side clamps and rounds.** `delinearized` finishes with
   `clampInt(0, 255, Math.round(...))` (`:242`), producing an integer channel.
   Float linear values that map outside the 8-bit range are clamped rather than
   wrapped, and `argbFromXyz` relies on this clamp to keep out-of-gamut XYZ
   values from producing garbage channel bits (`src/utils/color.ts:90-99`).

Note that the HCT solver carries its **own** delinearization variant,
`trueDelinearized` (`src/hct/hct-solver.ts:135-142`), which also returns 0-255
but is written without clamping so it can feed the plane-index arithmetic of
`bisectToLimit`. The two are siblings, not duplicates: `utils`'s version is the
final producer of channel values; the solver's version is an internal probe.

## The public entry points

The `Color` class in `src/color-class.ts` binds these conversions to the public
`ColorValue` type, which is the hex-string world:

```ts
Color.toNumber(color);              // argbFromHex(color) — hex → ARGB int
Color.fromNumber(n).hex;            // hexFromArgb(n) — ARGB int → hex
Color.hct(color);                   // Hct.fromInt(Color.toNumber(color))
Color.fromHct(h, c, t).hex;         // Hct.from(h, c, t).toInt() → hex
```

`toNumber` / `fromNumber` are the normalization point of the whole API: every
public function that takes a hex string starts with `Color.toNumber`, and every
function that returns a color ends with `Color.fromNumber`. `palette()`
and every color-manipulation helper (`setHue`, `lighten`,
`mix`, `onColor`, ...) route through exactly these two lines, which is why the
whole library can be opaque-only and hex-in/hex-out at the boundary.

## XYZ and the white point

The CAM16 machinery needs XYZ as its intermediate space. Two helpers convert
between ARGB and XYZ through the linear-RGB bridge
(`src/utils/color.ts:90-109`):

```ts
xyzFromArgb(argb: number): number[] {
    const r = linearized(redFromArgb(argb));
    const g = linearized(greenFromArgb(argb));
    const b = linearized(blueFromArgb(argb));
    return matrixMultiply([r, g, b], SRGB_TO_XYZ);
}
```

- `SRGB_TO_XYZ` and `XYZ_TO_SRGB` are the standard sRGB matrices, hard-coded as
  row-major 3x3 arrays (`src/utils/color.ts:21-31`) and applied by
  `matrixMultiply` (`src/utils/math.ts:129-134`).
- The white point `WHITE_POINT_D65 = [95.047, 100.0, 108.883]`
  (`src/utils/color.ts:33`) is returned by `whitePointD65()`
  (`:250-252`) and feeds `ViewingConditions.make` (`src/hct/viewing-conditions.ts:54`)
  and the L\*a\*b\* conversions (`:115-127`, `:136-155`).
- L\* rides on the same bridge: `lstarFromArgb` reads the Y row of the XYZ
  matrix (`src/utils/color.ts:176-179`) and `yFromLstar` / `lstarFromY`
  invert it (`:192-209`), which is how tone enters the picture — see
  [hct.md](./hct.md#why-tone-is-a-separate-dimension).

## Accuracy notes

A few behaviors worth knowing before relying on these helpers:

- **8-digit hex alpha is ignored.** `argbFromHex` accepts `#aarrggbb` but drops
  the leading two characters and always sets alpha to 255
  (`src/utils/string.ts:63-69`). The library cannot represent translucent
  colors; `isOpaque` always returns true for anything it produces
  (`src/utils/color.ts:83-85`).
- **`hexFromArgb` never emits 8 digits.** Even if you round-trip an 8-digit
  hex, the output is 6 digits — a design consequence of the opaque-only
  convention (`src/utils/string.ts:22-36`).
- **3-digit hex is a real input.** `"#f43"` expands to `"#ff4433"` via digit
  doubling (`src/utils/string.ts:56-58`), matching CSS shorthand semantics.
- **Out-of-range hex input is not rejected per-digit.** `argbFromHex` checks the
  total length but not the digit values; the packing masks with `& 0x0ff`
  (`src/utils/string.ts:69`), so malformed but same-length input is normalized
  rather than rejected.
- **`linearized` outputs 0-100, not 0-1.** Code outside this repo that assumes
  the conventional normalized linear RGB will get values 100x larger than
  expected (`src/utils/color.ts:224`).