# Quantization Overview

- [Introduction](#introduction)
- [What image quantization is](#what-image-quantization-is)
- [Why the library needs it](#why-the-library-needs-it)
- [The two-algorithm architecture](#the-two-algorithm-architecture)
- [Why k-means alone is unstable](#why-k-means-alone-is-unstable)
- [Why Wu initializes the palette](#why-wu-initializes-the-palette)
- [The full pipeline, end to end](#the-full-pipeline-end-to-end)
- [Module layout](#module-layout)
- [Further reading](#further-reading)

## Introduction

The quantization layer lives in `src/quantize/` and answers one question: given
an arbitrary photograph, which handful of colors actually represent it? It is
the front door of `Color.fromImage` (`src/color-class.ts`), the API that turns an
`HTMLImageElement` into a seed color for theme generation.

The layer is deliberately *statistical* rather than perceptual in its first
stage. It is composed of two very different algorithms — Wu's 3D-histogram
box-cutting and Celebi's optimized weighted k-means — stitched together by
`QuantizerCelebi`. This document explains why the composition exists.

## What image quantization is

Image quantization is the process of reducing a continuous-color image to a
small set of representative colors. A photo of a sunset has thousands of unique
RGB values, but for the purpose of *theming* those pixels collapse into a dozen
perceptually meaningful clusters: the orange sky, the dark silhouette, the
reflection on the water.

The job is stated precisely in the quantizer contracts: input is an array of
ARGB pixel integers, output is either a `number[]` of ARGB colors
(`QuantizerWu`) or a `Map<number, number>` of color → pixel count
(`QuantizerWsmeans`, `QuantizerCelebi`, `QuantizerMap`).

## Why the library needs it

A Material Design 3 theme is generated from a *single* seed color
(`palette(color)`), but users cannot always hand the library a seed. When they
pass an image instead, the library must decide what color the image "is." That
decision — picking the dominant, theme-worthy color — is exactly what
quantization feeds:

```ts
// src/science/image.ts:82
const result = QuantizerCelebi.quantize(pixels, 128);
const ranked = Score.score(result);
const top = ranked[0];
```

The quantizer produces 128 candidate colors with their pixel populations, and
`Score.score` (`src/science/score.ts:74`) curates those candidates down to a
few theme-appropriate colors. The first ranked color becomes the seed. The
quantizer is the only component that can reduce millions of pixels to a small
map, so `fromImage` is only as good as the quantization underneath it.

## The two-algorithm architecture

The layer does not use one algorithm, because no single one satisfies both
requirements: **deterministic, good-quality initial centroids** and **a
perceptually meaningful final clustering**. The design is:

1. `QuantizerWu` (`src/quantize/quantizer-wu.ts:34`) — a deterministic
   variance-optimal box-cutting pass over a 33×33×33 RGB histogram that returns
   `maxColors` colors without any randomness.
2. `QuantizerWsmeans` (`src/quantize/quantizer-wsmeans.ts:33`) — Celebi's
   weighted k-means, run in CIELAB space, initialized with Wu's output.
3. `QuantizerCelebi` (`src/quantize/quantizer-celebi.ts:30`) — the composition
   of the two, and the only quantizer the public image pipeline calls.

This is not an ad-hoc hack; it is the specific combination Celebi published in
*Improving the Performance of K-Means for Color Quantization* (2011,
https://arxiv.org/abs/1101.0395), credited in both source headers
(`quantizer-wsmeans.ts:24-27`, `quantizer-celebi.ts:22-24`).

## Why k-means alone is unstable

Classic k-means is famously sensitive to its starting centroids. Depending on
where the initial `k` points land, it converges to different local optima, and
a bad initialization can strand clusters in sparse regions of the color space
while dense regions go under-sampled. The instability shows up in two places in
`QuantizerWsmeans`:

- When no starting clusters are given, it seeds centroids with pure random
  points (`quantizer-wsmeans.ts:89-97`):

  ```ts
  const l = Math.random() * 100.0;
  const a = Math.random() * (100.0 - -100.0 + 1) + -100;
  const b = Math.random() * (100.0 - -100.0 + 1) + -100;
  ```

- Every point is assigned an initial cluster index randomly
  (`quantizer-wsmeans.ts:100-102`).

Random initialization means the same image can produce different palettes on
every call, and in the worst case the converged centroids are poor. That is
unacceptable for a function whose whole purpose is to produce a *stable* seed
color for a UI theme.

## Why Wu initializes the palette

`QuantizerWu` fixes initialization by being fully deterministic: for a given
pixel array and `maxColors`, it always produces the same colors. There is no
randomness anywhere in `quantizer-wu.ts` — every step, from the histogram
(`quantizer-wu.ts:58`) to the box-cutting loop (`quantizer-wu.ts:139`), is a
pure function of its inputs.

More importantly, Wu's output is *good* initialization, not just deterministic
initialization. Wu recursively splits the RGB cube so that every cut maximizes
the variance between the two resulting sub-boxes. That is exactly what k-means
wants: centroids that already separate the color distribution along its most
variant axes. Feeding those to WSMeans means the centroids start close to a
reasonable answer, so the k-means iterations do refinement work rather than
exploration. This is the design intent stated in `QuantizerCelebi`'s docstring:
"setting the K-Means initial state to the output of a Wu quantizer, instead of
random centroids" (`quantizer-celebi.ts:15-20`).

The two algorithms are also complementary in *space*: Wu works in RGB (hard
cube geometry), WSMeans works in CIELAB (perceptual distance). Wu gets the
coarse structure right in cheap integer space; WSMeans fixes the perceptual
distortion that RGB distance ignores.

## The full pipeline, end to end

```
pixels (ARGB[])
   │
   ▼
QuantizerWu.quantize(pixels, maxColors)      ── deterministic box cutting
   │                                             in 33×33×33 RGB histogram
   ▼
WuResult: number[] of maxColors ARGB colors
   │
   ▼
QuantizerWsmeans.quantize(pixels, WuResult, maxColors)
   │                                             ── weighted k-means in
   │                                                CIELAB, Wu seeds
   ▼
Map<argb, population>
   │
   ▼
Score.score(map)                               ── rank + curate
   │
   ▼
first ranked color → seed for palette()
```

`Color.fromImage` (`src/color-class.ts`) hides this entire chain behind a one-line
promise.

## Module layout

| File | Export | Role |
| ---- | ------ | ---- |
| `src/quantize/quantizer-wu.ts` | `QuantizerWu` (class) | Deterministic box-cutting; returns `number[]` of colors |
| `src/quantize/quantizer-wsmeans.ts` | `QuantizerWsmeans` (namespace) | Weighted k-means in CIELAB; returns `Map<argb, population>` |
| `src/quantize/quantizer-celebi.ts` | `QuantizerCelebi` (namespace) | Wu → WSMeans composition; returns `Map<argb, population>` |
| `src/quantize/quantizer-map.ts` | `QuantizerMap` (namespace) | Exact-count histogram of input pixels; returns `Map<argb, count>` |
| `src/quantize/point-provider.ts` | `PointProvider` (interface) | Color-space abstraction for k-means |
| `src/quantize/lab-point-provider.ts` | `LabPointProvider` (class) | ARGB ↔ CIELAB + squared-distance for k-means |

All six are re-exported from `src/quantize/index.ts`, with `PointProvider`
re-exported as a type only (`index.ts:12-17`).

## Further reading

- [quantizer-wu.md](./quantizer-wu.md) — the deterministic RGB box-cutting pass
- [quantizer-wsmeans.md](./quantizer-wsmeans.md) — weighted k-means in CIELAB
- [quantizer-celebi.md](./quantizer-celebi.md) — the composition and its guarantees
- [quantizer-map.md](./quantizer-map.md) — the exact-count histogram
