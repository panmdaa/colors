# Image Source Color Extraction

- [The two entry points](#the-two-entry-points)
- [Step 1: sampling pixels with a 2D canvas](#step-1-sampling-pixels-with-a-2d-canvas)
- [Step 2: filtering transparency](#step-2-filtering-transparency)
- [Step 3: quantization with QuantizerCelebi](#step-3-quantization-with-quantizercelebi)
- [Step 4: choosing the seed with Score](#step-4-choosing-the-seed-with-score)
- [The full pipeline at a glance](#the-full-pipeline-at-a-glance)
- [Why the pipeline is built this way](#why-the-pipeline-is-built-this-way)

## The two entry points

`src/science/image.ts` exposes two functions:

- `sourceColorFromImage(image: HTMLImageElement)` (`image.ts:23`) — browser
  entry point; samples an image element and returns a seed.
- `sourceColorFromImageBytes(imageBytes: Uint8ClampedArray)` (`image.ts:66`) —
  byte-level entry point; takes raw RGBA pixel data and returns a seed.

The former is a thin adapter over the latter: it does the canvas work, then
delegates to `sourceColorFromImageBytes` (`image.ts:57`). The byte-level
version is the actual algorithm and is reusable outside the DOM (workers,
Node tests). The public API exposes only the image-element form through
`fromImage` (`color.ts:31-33`), which converts the ARGB seed back to a
`ColorValue` hex string.

## Step 1: sampling pixels with a 2D canvas

`sourceColorFromImage` (`image.ts:23-58`) reads pixels through Canvas 2D:

```ts
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');
// ...
const loadCallback = () => {
	canvas.width = image.width;
	canvas.height = image.height;
	context.drawImage(image, 0, 0);
	// ...
	resolve(context.getImageData(sx ?? 0, sy ?? 0, sw ?? 0, sh ?? 0).data);
};
```

- The canvas is sized to the image's natural dimensions (`image.ts:33-34`) and
  the image is drawn at full resolution (`image.ts:35`). `getImageData`
  returns the raw RGBA `Uint8ClampedArray`.
- An optional `data-area` attribute on the image element crops the sampled
  region (`image.ts:36-44`). If present and well-formed
  (`/^\d+(\s*,\s*\d+){3}$/`), it is parsed as `sx, sy, sw, sh` and only that
  rectangle is read. This lets callers sample a logo or a focal point rather
  than the whole picture.
- Loading is handled defensively: if the image is already complete the data is
  read synchronously, otherwise the function waits on `onload`/`onerror`
  (`image.ts:49-54`). A missing 2D context or a load failure rejects with a
  descriptive error (`image.ts:28-30`, `image.ts:46-48`).

There is no explicit downsampling to a fixed grid in this implementation: the
pixels are read at native resolution and the reduction in workload happens
later, inside the quantizer (identical pixels are deduplicated and the result
is capped at 128 colors). For a 1920x1080 image that means about two million
pixel samples — fine for an offscreen canvas — which the next steps compress
heavily.

## Step 2: filtering transparency

`sourceColorFromImageBytes` (`image.ts:66-86`) walks the RGBA buffer four bytes
at a time and keeps only opaque pixels:

```ts
for (let i = 0; i < imageBytes.length; i += 4) {
	const r = imageBytes[i] ?? 0;
	const g = imageBytes[i + 1] ?? 0;
	const b = imageBytes[i + 2] ?? 0;
	const a = imageBytes[i + 3] ?? 0;
	if (a < 255) {
		continue;
	}
	const argb = argbFromRgb(r, g, b);
	pixels.push(argb);
}
```

Two decisions here:

- **Only fully opaque pixels (`a < 255` → skip) survive.** A transparent pixel
  composites against an unknown backdrop, so its RGB values are meaningless for
  theme selection. Dropping them also avoids the common PNG artifact of
  semi-transparent edges corrupting the histogram.
- **`argbFromRgb`** (`utils/color.ts:38-40`) packs the three channels into the
  ARGB integer the rest of the library speaks, with alpha forced to 255.

## Step 3: quantization with QuantizerCelebi

The surviving ARGB values go into `QuantizerCelebi.quantize(pixels, 128)`
(`image.ts:82`). This is the dimensionality reduction step: up to millions of
pixels become at most 128 representative colors, each with a population count.

`QuantizerCelebi` (`quantize/quantizer-celebi.ts:39-43`) composes two
algorithms from Celebi's 2011 paper *"Improving the Performance of K-Means for
Color Quantization"*:

1. `QuantizerWu` runs first and produces a high-quality initial cluster
   state from a 3D histogram.
2. `QuantizerWsmeans` then refines with a weighted squared-means k-means
   (`quantize/quantizer-wsmeans.ts`), running in `L*a*b*` space through
   `LabPointProvider` (`quantize/lab-point-provider.ts`), so clustering
   distances are perceptual. It deduplicates identical pixels and caps
   iterations at 10 (`quantize/quantizer-wsmeans.ts:14`).

The result is a `Map<number, number>` — ARGB color to pixel count — which is
exactly the input shape `Score.score` expects. The high cluster count (128) is
deliberate: it keeps the quantization faithful (colors aren't muddied by
averaging) and offloads the *curation* to Score (`score.ts:46-52`).

## Step 4: choosing the seed with Score

Finally the quantizer output is ranked and the winner is taken
(`image.ts:83-85`):

```ts
const ranked = Score.score(result);
const top = ranked[0];
return top;
```

`Score.score` (`score.ts:74`) applies the suitability judgment described in
[score](./score.md): it weights each candidate by how much of the image its
hue neighborhood covers (dominance wins), scores chroma against the 48-target
curve, filters out near-grays and rare hues, and returns up to 4 colors spread
across the hue wheel. `ranked[0]` is the dominant, theme-worthy color of the
image.

The score step is what makes this "source color extraction" rather than "most
common color". The most frequent color of a photograph is often grayish or
dusty — a bad theme seed. Score prefers a color that is common *and* vivid
enough to carry a theme.

## The full pipeline at a glance

```
HTMLImageElement
      │  sourceColorFromImage (image.ts:23)
      │  canvas 2D draw + getImageData  [full resolution, optional data-area crop]
      ▼
RGBA pixels
      │  sourceColorFromImageBytes (image.ts:66)
      │  drop alpha < 255, pack via argbFromRgb
      ▼
ARGB integers
      │  QuantizerCelebi.quantize(pixels, 128)  (image.ts:82)
      │  Wu init → WSMeans k-means in L*a*b*
      ▼
Map<color, population>  (≤ 128 colors)
      │  Score.score(result)  (image.ts:83)
      │  filter → weight proportion+chroma → hue-separated selection
      ▼
ranked[0]  →  fromImage returns ColorValue hex (color.ts:31-33)
```

## Why the pipeline is built this way

Each stage exists to convert a different problem into a cheaper, better-shaped
one:

- **Sampling at full resolution then compressing** avoids aliasing and color
  bleeding that aggressive pre-downsampling would cause, at the cost of a few
  million pixel reads — cheap on an offscreen canvas and amortized by the
  quantizer's dedup.
- **Quantization in `L*a*b*`** makes the cluster boundaries land where human
  perception does, so the 128 representatives genuinely cover the visible
  color gamut of the image.
- **Score as the final arbiter** applies the perceptual "taste" that no
  histogram can: dominance weighted against saturation, with an explicit
  guarantee that a seed is always returned (the Google Blue fallback,
  `score.ts:146-148`), so `fromImage` never fails on a degenerate image.

Related: [overview](./overview.md), [score](./score.md).
