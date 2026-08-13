# QuantizerWsmeans

- [Introduction](#introduction)
- [The point-provider abstraction](#the-point-provider-abstraction)
- [Deduplication into weighted points](#deduplication-into-weighted-points)
- [Initialization and the Wu connection](#initialization-and-the-wu-connection)
- [The iteration loop](#the-iteration-loop)
- [Convergence](#convergence)
- [The output map](#the-output-map)
- [Why quantization happens in a perceptual space](#why-quantization-happens-in-a-perceptual-space)

## Introduction

`QuantizerWsmeans` (`src/quantize/quantizer-wsmeans.ts:33`) is Celebi's
optimized k-means for color quantization — "Weighted Square Means." Where
`QuantizerWu` returns a flat `number[]` of colors, WSMeans returns a
`Map<number, number>` of ARGB color → pixel population, which is exactly the
shape `Score.score` consumes (`src/science/score.ts:74`).

The algorithm is credited to M. Emre Celebi's 2011 paper *Improving the
Performance of K-Means for Color Quantization*
(https://arxiv.org/abs/1101.0395) in the module docstring
(`quantizer-wsmeans.ts:22-27`). It is a namespace object, not a class, because
it is stateless.

```ts
quantize(
    inputPixels: number[],
    startingClusters: number[],
    maxColors: number
): Map<number, number>
```

The `startingClusters` parameter is the whole point: pass it Wu's output and
the k-means is seeded well. Pass an empty array and the implementation falls
back to random initialization.

## The point-provider abstraction

K-means is defined over *points with a distance metric*, not over colors. The
`PointProvider` interface (`src/quantize/point-provider.ts:17-21`) makes that
explicit:

```ts
export declare interface PointProvider {
    toInt(point: number[]): number;
    fromInt(argb: number): number[];
    distance(from: number[], to: number[]): number;
}
```

A provider converts ARGB ↔ some 3D color space and measures distance between
points. The quantizer code is written entirely against this interface
(`quantizer-wsmeans.ts:53`) and never touches RGB channel math itself:

```ts
const pointProvider = new LabPointProvider();
// ...
points.push(pointProvider.fromInt(inputPixel ?? 0));
```

The concrete implementation is `LabPointProvider`
(`src/quantize/lab-point-provider.ts:20`), which maps colors into CIELAB:

```ts
fromInt(argb: number): number[] {
    return labFromArgb(argb);
}
toInt(point: number[]): number {
    return argbFromLab(point[0] ?? 0, point[1] ?? 0, point[2] ?? 0);
}
```

The conversion itself lives in `src/utils/color.ts`: `labFromArgb`
(`color.ts:136-155`) goes ARGB → linearized sRGB → XYZ (D65 white point) →
L\*a\*b\*, and `argbFromLab` (`color.ts:115-127`) is the inverse. The quantizer
never cares about the pipeline; it only sees `[l, a, b]` triples.

`distance` (`lab-point-provider.ts:44-49`) is the important optimization: it is
the squared Euclidean distance in L\*a\*b\*, with the square root explicitly
omitted:

```ts
distance(from: number[], to: number[]): number {
    const dL = (from[0] ?? 0) - (to[0] ?? 0);
    const dA = (from[1] ?? 0) - (to[1] ?? 0);
    const dB = (from[2] ?? 0) - (to[2] ?? 0);
    return dL * dL + dA * dA + dB * dB;
}
```

As the docstring notes (`lab-point-provider.ts:36-43`), relative ordering is
unchanged without the square root, and dropping it matters because this method
runs "at least once for each pixel in an image."

## Deduplication into weighted points

Real k-means assigns every data point every iteration. Photos can have
hundreds of thousands of pixels, but only a fraction of distinct colors — and
k-means is indifferent to multiplicities if you reweight the means. WSMeans
therefore compresses the input in one pass (`quantizer-wsmeans.ts:56-67`):

```ts
const pixelToCount = new Map<number, number>();
// ...
if (pixelCount === undefined) {
    pointCount++;
    points.push(pointProvider.fromInt(inputPixel ?? 0));
    pixels.push(inputPixel ?? 0);
    pixelToCount.set(inputPixel ?? 0, 1);
} else {
    pixelToCount.set(inputPixel ?? 0, pixelCount + 1);
}
```

Each unique color becomes exactly one point, and `counts[i]` records how many
pixels it represents (`quantizer-wsmeans.ts:69-76`). The counts then act as
weights in the centroid update (see below). This is the source of the "Weighted"
in Wsmeans, and it is the reason the algorithm is fast enough for images:
an iteration's cost scales with *distinct colors*, not with pixel count.

## Initialization and the Wu connection

The cluster count is capped by both `maxColors` and the number of available
starting clusters (`quantizer-wsmeans.ts:78-81`):

```ts
let clusterCount = Math.min(maxColors, pointCount);
if (startingClusters.length > 0) {
    clusterCount = Math.min(clusterCount, startingClusters.length);
}
```

When Wu seeds are provided, they are converted into points and used verbatim
(`quantizer-wsmeans.ts:85-87`):

```ts
for (let i = 0; i < startingClusters.length; i++) {
    clusters.push(pointProvider.fromInt(startingClusters[i] ?? 0));
}
```

Only when no seeds are given does the code fall back to randomness
(`quantizer-wsmeans.ts:89-97`), drawing L\* and a\*/b\* from the L\*a\*b\* valid
ranges. Even so, every point is initially assigned to a random cluster
(`quantizer-wsmeans.ts:99-102`).

## The iteration loop

Each iteration (`quantizer-wsmeans.ts:124-206`) has three phases.

**1. Distance matrix.** Before touching points, the algorithm computes the
squared distance between every pair of clusters and stores, for each cluster,
the sorted list of its neighbors (`quantizer-wsmeans.ts:126-137`). This
precomputation is what enables the triangle-inequality shortcut later.

**2. Assignment with triangle inequality.** For each point, the candidate
clusters are pruned using the fact that if cluster `j` is far from the point's
current cluster, `j` cannot be closer to the point than the current cluster is.
Since distances are squared, the cutoff becomes `4 * previousDistance`
(`quantizer-wsmeans.ts:151-156`):

```ts
if (
    distanceToIndexMatrix[previousClusterIndex ?? 0]![j]!.distance >=
    4 * previousDistance
) {
    continue;
}
```

This is the paper's central speed trick: instead of comparing every point
against every cluster (O(points × clusters) per iteration), most clusters are
skipped with one table lookup. The full distance is computed only for the
remaining candidates (`quantizer-wsmeans.ts:157-161`).

**3. Weighted mean update.** Assignment is followed by recomputing every
centroid as the pixel-count-weighted mean of its members
(`quantizer-wsmeans.ts:185-193`):

```ts
pixelCountSums[clusterIndex ?? 0]! += count;
componentASums[clusterIndex ?? 0]! += (point[0] ?? 1) * count;
componentBSums[clusterIndex ?? 0]! += (point[1] ?? 1) * count;
componentCSums[clusterIndex ?? 0]! += (point[2] ?? 1) * count;
// ...
const a = (componentASums[i] ?? 1) / count;
const b = (componentBSums[i] ?? 1) / count;
const c = (componentCSums[i] ?? 1) / count;
clusters[i] = [a, b, c];
```

Clusters with no members are reset to the origin `[0, 0, 0]`
(`quantizer-wsmeans.ts:196-200`) rather than left stale.

## Convergence

The loop runs at most `MAX_ITERATIONS = 10` times (`quantizer-wsmeans.ts:14`)
and stops early once the assignment is stable (`quantizer-wsmeans.ts:174-176`):

```ts
if (pointsMoved === 0 && iteration !== 0) {
    break;
}
```

The `iteration !== 0` guard forces at least one real pass. A point "moves" only
when the distance change is meaningful — the new cluster must improve the
distance by more than `MIN_MOVEMENT_DISTANCE = 3.0` (`quantizer-wsmeans.ts:15`),
applied on the *unsquared* distance (`quantizer-wsmeans.ts:163-171`):

```ts
const distanceChange = Math.abs(
    Math.sqrt(minimumDistance) - Math.sqrt(previousDistance)
);
if (distanceChange > MIN_MOVEMENT_DISTANCE) {
    pointsMoved++;
    clusterIndices[i] = newClusterIndex;
}
```

The small-movement filter stops near-converged centroids from jittering point
assignments back and forth, letting the loop terminate cleanly on images with
many nearly-equidistant colors.

## The output map

Final clusters are converted back to ARGB and emitted with their populations
(`quantizer-wsmeans.ts:208-222`):

```ts
const possibleNewCluster = pointProvider.toInt(clusters[i] ?? [1]);
if (argbToPopulation.has(possibleNewCluster)) {
    continue;
}
argbToPopulation.set(possibleNewCluster, count ?? 1);
```

Empty clusters are skipped, and duplicate colors are deduplicated. The result
is a map whose values are the total pixel weight of each cluster — ready for
`Score.score` to rank.

## Why quantization happens in a perceptual space

Distance is the one place where k-means makes a quality decision, and RGB
distance is a terrible perceptual proxy: the human eye is far more sensitive to
differences in green than in blue, so two colors that are numerically far apart
in RGB can look nearly identical, and two visually distinct colors can be close
in RGB. Clustering in RGB groups colors by *bytes*, not by *appearance*.

L\*a\*b\* was designed so that Euclidean distance between coordinates
approximates perceived color difference — this is the entire basis of the
CIE 1976 delta-E metric the provider implements (`lab-point-provider.ts:36-40`).
Running k-means there means a cluster boundary is a perceptual boundary, so the
final palette groups pixels that a human sees as the same color. The
`PointProvider` interface exists so this choice is swappable in principle; the
library ships with exactly one implementation because L\*a\*b\* is the right
answer for color quantization.
