# QuantizerMap

- [Introduction](#introduction)
- [What it does](#what-it-does)
- [How it counts](#how-it-counts)
- [When it is used](#when-it-is-used)
- [Statistical quantizers versus exact counting](#statistical-quantizers-versus-exact-counting)
- [Further reading](#further-reading)

## Introduction

`QuantizerMap` (`src/quantize/quantizer-map.ts:22`) is the smallest and simplest
quantizer in the layer: it counts how many times each opaque color appears in a
pixel array and returns that exact count map. It performs no clustering, no
averaging, and no color-space conversion — it is a histogram in the literal
sense.

```ts
quantize(pixels: number[]): Map<number, number>
```

## What it does

It maps each distinct ARGB value to the number of pixels that use it. The name
"Map" is the contract: the output is a `Map<number, number>` of color → count,
rather than a reduced palette. The docstring is explicit
(`quantizer-map.ts:14-17`): "Quantizes an image into a map, with keys of ARGB
colors, and values of the number of times that color appears in the image."

## How it counts

The implementation is a single pass over the pixel array
(`quantizer-map.ts:28-40`):

```ts
quantize(pixels: number[]): Map<number, number> {
    const countByColor = new Map<number, number>();
    for (let i = 0; i < pixels.length; i++) {
        const pixel = pixels[i];
        const alpha = alphaFromArgb(pixel ?? 0);
        if (alpha < 255) {
            continue;
        }
        countByColor.set(pixel ?? 0, (countByColor.get(pixel ?? 0) ?? 0) + 1);
    }
    return countByColor;
}
```

Two behaviors worth noting:

- **Semi-transparent pixels are dropped.** Any pixel whose alpha is below 255
  is skipped (`quantizer-map.ts:33-36`). The library's theming pipeline has no
  use for translucent pixels — the same filter appears when pixels are
  collected from image bytes (`src/science/image.ts:74`).
- **The full ARGB value is the key.** `alphaFromArgb` (`src/utils/color.ts:55`)
  is read for the filter, but the key stored is the whole 32-bit integer. Since
  only opaque pixels survive, the alpha byte is always 0xFF and the key
  effectively carries just the RGB.

## When it is used

`QuantizerMap` appears in two roles:

1. **As the preprocessing step inside `QuantizerWu`.** Wu needs an exact
   color→count histogram to weight its 33×33×33 buckets, so `constructHistogram`
   delegates to it first (`quantizer-wu.ts:65`) and then walks the distinct
   colors (`quantizer-wu.ts:67-83`). Without this, Wu would re-count duplicate
   pixels for every moment accumulation.
2. **As a standalone counting utility.** Because it is exported from the
   module index (`src/quantize/index.ts:15`), callers can use it directly
   whenever they need exact pixel counts rather than a reduced palette — for
   example, to measure a color's true share of an image before deciding whether
   it is worth theming.

## Statistical quantizers versus exact counting

The rest of the layer is *statistical*: `QuantizerWu` buckets pixels into a
33×33×33 grid and aggregates moments (`quantizer-wu.ts:72-82`), and
`QuantizerWsmeans` clusters in L\*a\*b\* (`quantizer-wsmeans.ts:124-206`). Both
deliberately discard exact per-color detail to gain representativeness and
speed — Wu's result is a handful of box centroids (`quantizer-wu.ts:165-179`),
WSMeans' a handful of cluster centers.

`QuantizerMap` is the opposite: it is exact, lossless, and O(n) with no
distance computations. It exists precisely because the statistical algorithms
need exact counts as *input* (Wu's weights) and because some consumers want
ground-truth populations rather than centroids. It is not an alternative
"flavor" of quantization; it is the counting primitive the statistical
quantizers build on.

## Further reading

- [overview.md](./overview.md) — the layer and how the pieces fit together
- [quantizer-wu.md](./quantizer-wu.md) — where `QuantizerMap` feeds the histogram
- [quantizer-celebi.md](./quantizer-celebi.md) — the composed pipeline that consumes Wu and WSMeans
