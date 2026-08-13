# QuantizerWu

- [Introduction](#introduction)
- [The 3D RGB histogram](#the-3d-rgb-histogram)
- [Cumulative moment arrays](#cumulative-moment-arrays)
- [The variance-based best plane split](#the-variance-based-best-plane-split)
- [Termination](#termination)
- [Producing the result colors](#producing-the-result-colors)
- [Why Wu gives good initial centers](#why-wu-gives-good-initial-centers)
- [Why the library keeps the code untouched](#why-the-library-keeps-the-code-untouched)

## Introduction

`QuantizerWu` (`src/quantize/quantizer-wu.ts:34`) is an image quantizer that
reduces a pixel array to at most `maxColors` colors by recursively cutting an
RGB cube. The algorithm is Xiaolin Wu's from *Graphic Gems II* (1991), per the
class docstring (`quantizer-wu.ts:26-33`).

It is a class, unlike the other quantizers, because it is stateful: the
constructor seeds mutable arrays for the histogram, moments, and boxes
(`quantizer-wu.ts:35-42`), and each `quantize()` call reuses that state.

```ts
quantize(pixels: number[], maxColors: number): number[] {
    this.constructHistogram(pixels);
    this.computeMoments();
    const createBoxesResult = this.createBoxes(maxColors);
    const results = this.createResult(createBoxesResult.resultCount);
    return results;
}
```

The output is a plain `number[]` of ARGB colors — **no pixel populations**.
Wu's role is purely to produce good initial centroids; counting is left to the
stage that consumes them.

## The 3D RGB histogram

Wu discretizes the RGB cube into a fixed 33×33×33 grid:

```ts
const INDEX_BITS = 5;
const SIDE_LENGTH = 33; // ((1 << INDEX_INDEX_BITS) + 1)
const TOTAL_SIZE = 35937; // SIDE_LENGTH * SIDE_LENGTH * SIDE_LENGTH
```

Each 8-bit channel is reduced from 256 levels to 33 buckets by shifting right
3 bits (`8 - INDEX_BITS`), then offset by +1 so the bucketed indices run 1..32
(`quantizer-wu.ts:72-76`):

```ts
const bitsToRemove = 8 - INDEX_BITS;
const iR = (red >> bitsToRemove) + 1;
const iG = (green >> bitsToRemove) + 1;
const iB = (blue >> bitsToRemove) + 1;
const index = this.getIndex(iR, iG, iB);
```

The +1 offset reserves bucket 0 as a zero-padding layer so the cumulative-moment
formulas can safely reference `r - 1`, `g - 1`, `b - 1` without bounds checks.

The histogram is not built by iterating pixels directly. It first delegates to
`QuantizerMap.quantize(pixels)` (`quantizer-wu.ts:65`) to get an exact
color→count map, then walks *distinct colors* and accumulates four parallel
arrays into the single flat index (`quantizer-wu.ts:78-82`):

```ts
this.weights[index] = (this.weights[index] ?? 0) + count;
this.momentsR[index]! += count * red;
this.momentsG[index]! += count * green;
this.momentsB[index]! += count * blue;
this.moments[index]! += count * (red * red + green * green + blue * blue);
```

This is why `QuantizerMap` must skip nothing but semi-transparent pixels: its
exact counts feed the weight array, which is the basis for every later
decision.

The flat index packs three 0..32 values into one integer
(`quantizer-wu.ts:406-408`):

```ts
private getIndex(r: number, g: number, b: number): number {
    return (r << (INDEX_BITS * 2)) + (r << (INDEX_BITS + 1)) + r + (g << INDEX_BITS) + g + b;
}
```

Expanded, this is `r * 1089 + g * 33 + b` — a base-33 address that keeps all
five arrays at the fixed `TOTAL_SIZE` of 35937 entries.

## Cumulative moment arrays

A recursive box-cutting algorithm needs the *total* weight and color moments of
arbitrary rectangular sub-boxes, and it needs them in O(1). Wu solves this with
3D prefix sums, computed once in `computeMoments` (`quantizer-wu.ts:86-122`).

The loop walks r, g, b in increasing order, maintaining a running `line` per
channel within the current g slice and a running `area` per column. Each cell is
then rewritten as:

```ts
this.weights[index] = this.weights[previousIndex]! + area[b]!;
```

where `previousIndex` is the cell at `(r - 1, g, b)` (`quantizer-wu.ts:113-118`).
After the pass, `weights[i]` holds the sum of all histogram weights in the box
from the origin `(0,0,0)` to the cell `i`. The same transform is applied to the
color moments and the squared-magnitude moment, producing five cumulative
arrays.

With those, the weight of *any* axis-aligned box can be read with a single
inclusion–exclusion expression of eight corner lookups — this is the `volume`
helper (`quantizer-wu.ts:337-348`):

```ts
private volume(cube: Box, moment: number[]) {
    return (
        moment[this.getIndex(cube.r1, cube.g1, cube.b1)]! -
        moment[this.getIndex(cube.r1, cube.g1, cube.b0)]! -
        moment[this.getIndex(cube.r1, cube.g0, cube.b1)]! +
        moment[this.getIndex(cube.r1, cube.g0, cube.b0)]! -
        moment[this.getIndex(cube.r0, cube.g1, cube.b1)]! +
        moment[this.getIndex(cube.r0, cube.g1, cube.b0)]! +
        moment[this.getIndex(cube.r0, cube.g0, cube.b1)]! -
        moment[this.getIndex(cube.r0, cube.g0, cube.b0)]!
    );
}
```

## The variance-based best plane split

Box cutting happens in `createBoxes` (`quantizer-wu.ts:124-163`). The process
starts with one box covering the entire cube (indices 0..32 in every channel,
`quantizer-wu.ts:129-135`) and, in each of `maxColors - 1` iterations, picks the
current box with the largest volume variance and cuts it in two
(`quantizer-wu.ts:139-147`):

```ts
if (this.cut(this.cubes[next]!, this.cubes[i]!)) {
    volumeVariance[next] =
        this.cubes[next]!.vol > 1 ? this.variance(this.cubes[next]!) : 0.0;
    volumeVariance[i] = this.cubes[i]!.vol > 1 ? this.variance(this.cubes[i]!) : 0.0;
} else {
    volumeVariance[next] = 0.0;
    i--;
}
```

If a cut fails (the box cannot be split further), its variance is zeroed and
the iteration counter is rolled back so the loop tries the next-highest-variance
box instead — and `next` is recomputed as the argmax of the variance array
(`quantizer-wu.ts:149-156`).

`cut` (`quantizer-wu.ts:199-280`) tries to split the box perpendicular to each
of the three axes and keeps whichever maximizes the between-class variance.
For each axis it calls `maximize` (`quantizer-wu.ts:282-335`), which scans every
plane position inside the box and, for each candidate split, computes the two
resulting half-boxes' moment magnitudes normalized by their weights:

```ts
let tempNumerator = (halfR * halfR + halfG * halfG + halfB * halfB) * 1.0;
let tempDenominator = halfW * 1.0;
let temp = tempNumerator / tempDenominator;
// ... add the complementary half ...
if (temp > max) {
    max = temp;
    cut = i;
}
```

The winning axis is then selected by comparing the three maxima
(`quantizer-wu.ts:236-248`), and the original box is truncated to one side of
the cut while the new box gets the other side (`quantizer-wu.ts:250-275`).

The `variance` function (`quantizer-wu.ts:181-197`) measures how spread out the
pixels inside a box are: it subtracts the squared magnitude of the box's mean
color vector (`dr² + dg² + db²`, normalized by weight) from the box's total
squared-magnitude moment. A box with high variance is one whose pixels span a
wide color range, so cutting it is the most valuable.

## Termination

`maxColors` is the target, not a guarantee. The loop stops early when no box
remains that can improve the split (`quantizer-wu.ts:157-160`):

```ts
if (temp <= 0.0) {
    generatedColorCount = i + 1;
    break;
}
```

`temp <= 0.0` means every candidate box has zero variance — either its volume is
a single histogram cell or its pixel weight is zero. `generatedColorCount` is
then fewer than `maxColors`, and `createResult` is called with that lower count
(`quantizer-wu.ts:54`). The result wrapper `CreateBoxesResult`
(`quantizer-wu.ts:430-441`) explicitly documents that the result count "may be
lower than the requested count."

## Producing the result colors

Each surviving box contributes exactly one color, computed as the weighted
average of its pixel channels (`quantizer-wu.ts:165-179`):

```ts
const weight = this.volume(cube!, this.weights);
if (weight > 0) {
    const r = Math.round(this.volume(cube!, this.momentsR) / weight);
    const g = Math.round(this.volume(cube!, this.momentsG) / weight);
    const b = Math.round(this.volume(cube!, this.momentsB) / weight);
    const color = (255 << 24) | ((r & 0x0ff) << 16) | ((g & 0x0ff) << 8) | (b & 0x0ff);
    colors.push(color);
}
```

An empty box (weight 0) is skipped entirely. The centroid is a true mass
average — the box's moment divided by its weight — not an arbitrary bin
representative. Because these centroids sit in RGB space, they are crude in
perceptual terms, which is exactly why WSMeans runs afterward in CIELAB.

## Why Wu gives good initial centers

Three properties make Wu's output ideal k-means initialization:

1. **Deterministic.** Nothing in `quantizer-wu.ts` uses randomness. The
   histogram, the prefix sums, the cut selection, and the centroid averaging
   are all pure functions of the pixel array. The same input yields the same
   colors, every time.
2. **Variance-optimal.** Every cut maximizes the separation of the two
   resulting boxes along the axis with the largest spread. The recursion
   spends its budget where the color distribution varies most, so the
   resulting boxes concentrate on genuinely different regions of the image's
   color gamut rather than wasting colors on uniform areas.
3. **Centroids are true means.** Each output color is the mass-weighted average
   of its box, so the seeds are already "in the middle" of their future
   clusters. K-means converges faster and to a better local optimum when its
   seeds are near the data than when they are random.

The library ports this specific algorithm because it is the accepted
deterministic first stage of Celebi's quantization pipeline — the same pairing
used by the JPEG-quantization literature the code cites. Wu supplies the
coarse, stable structure; WSMeans supplies the perceptual refinement.

## Why the library keeps the code untouched

The class is an unusually faithful port of the Material Color Utilities
implementation: the stateful-constructor pattern (`quantizer-wu.ts:35-42`), the
`Box`/`CreateBoxesResult`/`MaximizeResult` support classes
(`quantizer-wu.ts:415-452`), and even the naming like `wholeW` and `bottomR`
are preserved. The only changes are TypeScript strictness fixes (explicit
non-null assertions such as `this.moments[index]!`). Keeping it faithful means
bug-for-bug compatibility with the reference implementation and a documented,
peer-reviewed algorithm the project can defend — a tradeoff the project
prefers over a prettier rewrite of a subtle numerical routine.
