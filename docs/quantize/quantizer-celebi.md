# QuantizerCelebi

- [Introduction](#introduction)
- [The pipeline](#the-pipeline)
- [Why Wu first, then means](#why-wu-first-then-means)
- [How stable dominant-color extraction is guaranteed](#how-stable-dominant-color-extraction-is-guaranteed)
- [Return contract](#return-contract)
- [Further reading](#further-reading)

## Introduction

`QuantizerCelebi` (`src/quantize/quantizer-celebi.ts:30`) is the composed
quantizer the public image pipeline actually calls — `sourceColorFromImage`
uses it directly (`src/science/image.ts:82`). It combines the two algorithms
described in the sibling documents, and its docstring states the intent
precisely (`quantizer-celebi.ts:15-20`):

> An image quantizer that improves on the quality of a standard K-Means
> algorithm by setting the K-Means initial state to the output of a Wu
> quantizer, instead of random centroids. Improves on speed by several
> optimizations, as implemented in Wsmeans.

It is the combination from Celebi's 2011 paper, *Improving the Performance of
K-Means for Color Quantization* (https://arxiv.org/abs/1101.0395), cited in the
header (`quantizer-celebi.ts:22-24`).

## The pipeline

The entire implementation is three lines (`quantizer-celebi.ts:39-43`):

```ts
quantize(pixels: number[], maxColors: number): Map<number, number> {
    const wu = new QuantizerWu();
    const wuResult = wu.quantize(pixels, maxColors);
    return QuantizerWsmeans.quantize(pixels, wuResult, maxColors);
}
```

1. `QuantizerWu.quantize(pixels, maxColors)` produces `maxColors` deterministic
   centroids from its RGB histogram (`quantizer-wu.ts:50-56`).
2. Those centroids are passed as `startingClusters` to
   `QuantizerWsmeans.quantize(pixels, wuResult, maxColors)`
   (`quantizer-wsmeans.ts:45-49`), which refines them in CIELAB and returns the
   color→population map.

The data flow is: pixel array → Wu seeds (RGB box cutting) → weighted k-means
(L\*a\*b\*) → `Map<argb, population>`.

Note what the pipeline does **not** do: it does not pre-reduce the image to a
fixed large intermediate count and then shrink it. `QuantizerWu` is asked for
the final `maxColors` directly, and WSMeans runs with the same `maxColors`.
Both stages operate on the full (deduplicated) pixel set. When the public
image path calls `QuantizerCelebi.quantize(pixels, 128)`
(`src/science/image.ts:82`), the whole pipeline targets 128 colors end to end.

## Why Wu first, then means

The composition exists because the two algorithms fail in complementary ways
and succeed together:

- **K-means alone is nondeterministic and initialization-sensitive.** With
  random seeds it can converge to different local optima run to run, and bad
  seeds waste clusters in empty regions of the color space. WSMeans
  acknowledges this with its random fallback (`quantizer-wsmeans.ts:89-102`),
  which exists precisely because an empty `startingClusters` is the degenerate
  case the pipeline avoids.
- **Wu alone is perceptually crude.** Its box centroids are weighted RGB
  averages (`quantizer-wu.ts:171-174`). They carve the RGB cube into
  variance-optimal regions, but RGB variance is not perceptual variance, so the
  final colors can be slightly off-hue or off-chroma relative to what the eye
  groups together.
- **Wu → k-means gets both.** Wu provides deterministic, already-sensible
  seeds that are near the final clusters, so the k-means iterations only
  *refine* them in a perceptual space. The result is deterministic input
  producing stable, perceptually meaningful output — at the cost of the two
  stages' small overlap, which Celebi's paper shows is more than paid back by
  faster convergence.

This is the classic "initialization by hierarchical/quantile method, refinement
by k-means" pattern from the image-quantization literature. The library
follows it because it is the one combination with both published results and a
simple, defensible implementation.

## How stable dominant-color extraction is guaranteed

Stability here means: the same image yields the same palette, and the palette's
dominant color actually represents the image. The pipeline provides it through
three mechanisms:

1. **Deterministic first stage.** Wu's box cutting is fully deterministic
   (`quantizer-wu.ts:139-161`), so the seed set never varies.
2. **Seeded refinement.** WSMeans with Wu seeds is still technically
   randomized on first point assignment (`quantizer-wsmeans.ts:99-102`), but
   the randomness now only perturbs the *assignment order* of the first pass,
   not the initial centroid positions. The refined centroids are pulled toward
   the same fixed targets, so the dominant clusters survive run to run.
3. **Population-weighted output.** WSMeans returns clusters weighted by their
   pixel counts (`quantizer-wsmeans.ts:208-222`), so the largest cluster — the
   one `Score.score` will rank first (`src/science/score.ts:115-121`) —
   corresponds to the most-used color region of the image. The seed color that
   `sourceColorFromImage` picks is therefore both stable and representative.

None of this would hold if WSMeans were seeded with random centroids, which is
precisely the case `QuantizerCelebi` eliminates by construction.

## Return contract

The output is a `Map` with ARGB color keys and pixel-population values
(`quantizer-celebi.ts:31-38`), matching WSMeans' contract. This is the
interface expected by `Score.score` (`src/science/score.ts:84-90`), which
iterates `colorsToPopulation.entries()` to compute hue populations and rank
candidates. The return is at most `maxColors` entries; deduplication inside
WSMeans (`quantizer-wsmeans.ts:216-218`) can produce fewer.

## Further reading

- [overview.md](./overview.md) — why the two-algorithm architecture exists
- [quantizer-wu.md](./quantizer-wu.md) — the deterministic seed producer
- [quantizer-wsmeans.md](./quantizer-wsmeans.md) — the perceptual refiner
- [quantizer-map.md](./quantizer-map.md) — the exact-count histogram used inside Wu
