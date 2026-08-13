# Image Seed Extraction (`fromImage`)

- [The public entry point](#the-public-entry-point)
- [Under the hood](#under-the-hood)
- [When to use it](#when-to-use-it)

## The public entry point

`fromImage` is the thin public wrapper that extracts a dominant, perceptually
pleasing seed color from an `<img>` element:

```ts
// src/color.ts:31-33
export function fromImage(image: HTMLImageElement): Promise<ColorValue> {
	return sourceColorFromImage(image).then((n) => fromNumber(n!));
}
```

It takes an `HTMLImageElement`, delegates to `sourceColorFromImage` from the
science layer, and converts the returned ARGB integer back to a hex string. It
returns a `Promise` because image decoding and pixel sampling are asynchronous.

## Under the hood

The real work happens in `src/science/image.ts`:

1. The image is drawn to a 16×16 Canvas 2D surface, reducing millions of
   pixels to 256 samples.
2. The pixels are quantized (Celebi: Wu + WSMeans) into a small set of
   candidate colors — see [quantize/overview](../quantize/overview.md).
3. The `Score` algorithm ranks the candidates by population, chroma and hue
   appeal, excluding near-white/near-black and disliked hues — see
   [science/score](../science/score.md).
4. The winning candidate becomes the seed color.

The full trace lives in [science/image](../science/image.md).

## When to use it

```ts
import { fromImage, palette } from "@panmdaa/colors";

const seed = await fromImage(imageElement);   // e.g. "#744c9d"
const theme = palette(seed, { variant: "expressive" });
```

This is the natural entry point for building a theme that *feels like a photo*:
the generated palette inherits the image's dominant hue rather than a
hand-picked brand color.
