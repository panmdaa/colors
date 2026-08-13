# Color Vision Deficiency Simulation

- [The model](#the-model)
- [The pipeline](#the-pipeline)
  - [sRGB to linear RGB](#srgb-to-linear-rgb)
  - [Matrix transform](#matrix-transform)
  - [Back to sRGB](#back-to-srgb)
- [The three deficiencies and their matrices](#the-three-deficiencies-and-their-matrices)
- [Severity: full and mild](#severity-full-and-mild)
- [The two public functions](#the-two-public-functions)
- [Why Machado, and why this is the DevTools algorithm](#why-machado-and-why-this-is-the-devtools-algorithm)

## The model

`src/science/color-blindness.ts` implements the physiologically-based model for
simulation of color vision deficiency (CVD) described by Machado, Oliveira and
Fernandes in their 2009 paper, *"A Physiologically-based Model for Simulation of
Color Vision Deficiency"* (IEEE Transactions on Visualization and Computer
Graphics, 15(6), 1291-1298). The transformation matrices come from Machado's
2010 PhD thesis, as stated in the module header
(`color-blindness.ts:4-10`).

The physiological intuition behind the model: a CVD observer's cone response
is not a sharp single-cone response but a degraded one in which two cone types
partially "leak" into each other. Mathematically this is captured as a linear
transform of cone responses, which, projected back into RGB space, becomes a
3x3 matrix applied to linear RGB values. The matrices used here are exactly
those derived in the paper, rounded to six decimal places.

## The pipeline

`simulateCVD` (`color-blindness.ts:111`) chains three steps. The whole flow is:

```
hex → ARGB → linearized RGB [0, 1] → 3x3 matrix transform → clamp → hex
```

### sRGB to linear RGB

`hexToLinearRgb01` (`color-blindness.ts:84-90`) parses the hex color with
`argbFromHex` (`utils/string.ts:44`), extracts the 8-bit channels with
`redFromArgb`/`greenFromArgb`/`blueFromArgb` (`utils/color.ts:62-78`), and
linearizes each channel with `linearized` (`utils/color.ts:219-226`), dividing
by 100 to land in `[0, 1]`:

```ts
function hexToLinearRgb01(hex: ColorValue): [number, number, number] {
	const argb = argbFromHex(hex);
	const r = linearized(redFromArgb(argb)) / 100;
	const g = linearized(greenFromArgb(argb)) / 100;
	const b = linearized(blueFromArgb(argb)) / 100;
	return [r, g, b];
}
```

Why linearize? The sRGB encoding is gamma-compressed (a nonlinear power curve)
to match human brightness perception. The Machado matrices are defined in
linear radiometric space, because cone responses are linear in the number of
absorbed photons, not in encoded sRGB values. Applying the matrix to raw sRGB
channels would produce wrong results.

### Matrix transform

`applyMatrix` (`color-blindness.ts:65-75`) multiplies the linear RGB triple by
the selected matrix:

```ts
function applyMatrix(rgb: [number, number, number], matrix: number[][]): [number, number, number] {
	const [r, g, b] = rgb;
	return [
		r * matrix[0]![0]! + g * matrix[0]![1]! + b * matrix[0]![2]!,
		r * matrix[1]![0]! + g * matrix[1]![1]! + b * matrix[1]![2]!,
		r * matrix[2]![0]! + g * matrix[2]![1]! + b * matrix[2]![2]!,
	];
}
```

Each row of the matrix mixes the three original channels into one output
channel. Because the matrices are row-wise normalized so that the three rows
sum close to 1, a neutral gray stays roughly neutral (a white point-preserving
property of the Machado matrices).

### Back to sRGB

`linearRgb01ToHex` (`color-blindness.ts:95-97`) clamps the result to `[0, 1]`
with `clamp01` (`color-blindness.ts:77-79`), scales back to `[0, 100]`, and
converts through `argbFromLinrgb` (`utils/color.ts:45-50`) — which
delinearizes with `delinearized` (`utils/color.ts:236-243`) — then back to a
hex string via `hexFromArgb` (`utils/string.ts:22`).

The clamp is important: linear-space channel combinations can overshoot 1 or
go slightly negative, and a simulation must not emit out-of-range channel
values.

## The three deficiencies and their matrices

CVD is grouped into three common types, named in `types.ts:127`:

```ts
export type ColorVisionDeficiency = "protanopia" | "deuteranopia" | "tritanopia";
```

Each type corresponds to the loss or degradation of one cone type:

| Deficiency | Affected cone | Result | Full-severity matrix (`color-blindness.ts:26-30`) |
| ---------- | ------------- | ------ | ------------------------------------------------ |
| protanopia | L cones (long wavelength, red) | red-green confusion | `[0.152286, 1.052583, -0.204868]` / `[0.114503, 0.786281, 0.099216]` / `[-0.003882, -0.048116, 1.051998]` |
| deuteranopia | M cones (medium, green) | red-green confusion | `[0.367322, 0.860646, -0.227968]` / `[0.280085, 0.672501, 0.047413]` / `[-0.011820, 0.042940, 0.968881]` |
| tritanopia | S cones (short, blue) | blue-yellow confusion | `[1.255528, -0.076749, -0.178779]` / `[-0.078411, 0.930809, 0.147602]` / `[0.004733, 0.691367, 0.303900]` |

Reading the protanopia matrix: the red output channel is
`0.152 R + 1.053 G - 0.205 B`. The large negative on blue and the fact that
green is boosted above red in the red channel is exactly what a protanope
"sees": the distinction between red and green collapses because the L cone is
silent and the brain interprets the remaining M and S response as a mix of
yellow and blue. The rows sum to ~1.0 (e.g. `0.152286 + 1.052583 - 0.204868 =
0.999...`), preserving luminance approximately.

The naming is an historical accident worth knowing: "anopia" implies a complete
absence of the cone, but the matrices here model the more realistic
*dichromacy* case where the two surviving cone types plus the brain's opponent
processes still produce color, just collapsed along one axis. This is why red
`#ff0000` does not become black or gray but a muted olive
(`simulateCVD("#ff0000", "protanopia")` returns `#665900`, documented at
`color-blindness.ts:107`).

## Severity: full and mild

The API accepts two discrete severities (`types.ts:129`):

```ts
export type CVDSeverity = "full" | "mild";
```

`simulateCVD` selects the matrix set based on severity
(`color-blindness.ts:116`):

```ts
const matrix = severity === "full" ? CVD_MATRICES[deficiency] : CVD_MATRICES_MILD[deficiency];
```

The mild matrices (`CVD_MATRICES_MILD`, `color-blindness.ts:47-63`) model
*anomalous trichromacy* — the much more common condition in which all three
cone types exist but two of them have overlapping sensitivity curves. Compare
the protanopia rows:

```
full:  0.152286  1.052583 -0.204868     mild:  0.458064  0.679578 -0.137642
       0.114503  0.786281  0.099216            0.092785  0.846313  0.060902
      -0.003882 -0.048116  1.051998           -0.007494 -0.016807  1.024301
```

The mild matrix's diagonal (the "keep your own channel" weight) is much
stronger — `0.458064` vs `0.152286` on the red diagonal — so the mild
simulation is a subtle nudge toward the confusion axis rather than a collapse.
The mild set is the Machado matrices evaluated at approximately severity 0.5
of the interpolation between identity and full severity.

Note there is no continuous severity parameter: the model is baked at these two
points rather than exposing a blend factor `t` between identity and full
severity. Two discrete matrices are enough for practical auditing ("can a
mildly deficient and a fully deficient user both read this?").

## The two public functions

`simulateCVD` (`color-blindness.ts:111`) simulates one deficiency:

```ts
export function simulateCVD(
	color: ColorValue,
	deficiency: ColorVisionDeficiency,
	severity: CVDSeverity = "full",
): ColorValue
```

`simulateAllCVD` (`color-blindness.ts:131`) runs all three at once. It
linearizes the color once and reuses the linear triple for every matrix, so the
cost is one linearization plus three matrix products:

```ts
export function simulateAllCVD(color: ColorValue, severity: CVDSeverity = "full"): Record<ColorVisionDeficiency, ColorValue>
```

Both are re-exported from the package root (`color.ts:20`) and drive the CVD
branch of `contrastChecker` (`color.ts:202-203`) and the per-pair simulations
of `paletteChecker` (`color.ts:217-218`), where a pair's ratio is recomputed
from the *simulated* colors.

## Why Machado, and why this is the DevTools algorithm

Machado's model became the de facto standard for browser tooling because it is
simultaneously:

1. **Physiologically grounded.** It is built from an actual model of cone
   response rather than an ad-hoc desaturation, so results track real
   deficiencies better than simple "grayscale + red filter" tricks.
2. **Trivial to apply.** A single matrix multiply on linear RGB — no spectral
   computations, no parameterized cone response integrals at runtime. The hard
   physiology happens offline, at matrix derivation time.
3. **Compact to ship.** Twelve 3x3 matrices (three deficiencies x two
   severities) are the entire runtime footprint, which fits the zero-dependency
   philosophy of the package.

Chrome DevTools' "Emulate vision deficiencies" feature uses this same model
and these same matrices (the module header notes this at
`color-blindness.ts:10`). Reusing it here means a contrast audit performed with
`contrastChecker(..., cvd: true)` speaks the same language as a manual DevTools
check: a pair that fails under DevTools' protanopia emulation fails under this
library too, which makes the simulation trustworthy for accessibility
reporting.

Related: [overview](./overview.md), [contrast](./contrast.md).
