# Score

- [The problem Score solves](#the-problem-score-solves)
- [Options and defaults](#options-and-defaults)
- [The scoring pipeline](#the-scoring-pipeline)
  - [Step 1: hue population](#step-1-hue-population)
  - [Step 2: excited hue proportions](#step-2-excited-hue-proportions)
  - [Step 3: filtering](#step-3-filtering)
  - [Step 4: scoring](#step-4-scoring)
- [The weights and what they encode](#the-weights-and-what-they-encode)
- [Step 5: hue separation](#step-5-hue-separation)
- [The fallback color](#the-fallback-color)
- [What Score does NOT do](#what-score-does-not-do)
- [Where Score is used](#where-score-is-used)

## The problem Score solves

`Score` (`src/science/score.ts:53`) answers the question: given a map of colors
to their usage counts — typically the output of image quantization — which
color makes the *best seed for a UI theme*?

The module comment frames it precisely (`score.ts:46-52`): quantization should
run with a high cluster count so colors aren't muddied, and then Score's job is
to curate that large candidate set down to a small number of appropriate
choices. "Appropriate" is a perceptually-weighted judgment, not a pure
frequency count: the most common color of a photo is usually not the best
theme seed. Score encodes what makes a color good for a UI.

## Options and defaults

`score(colorsToPopulation, options?)` (`score.ts:74`) takes a
`Map<number, number>` of ARGB color to pixel count, plus optional overrides.
The defaults (`score.ts:30-34`) are documented:

```ts
const SCORE_OPTION_DEFAULTS = {
	desired: 4, // 4 colors matches what Android wallpaper picker.
	fallbackColorARGB: 0xff4285f4, // Google Blue.
	filter: true // Avoid unsuitable colors.
};
```

`desired` is the maximum number of colors returned — 4 because that matches the
Android wallpaper picker. `fallbackColorARGB` is Google Blue
(`#4285f4`), used when nothing survives the filters. `filter` enables the
suitability filters.

## The scoring pipeline

The pipeline has five stages inside `score` (`score.ts:74-153`).

### Step 1: hue population

Each ARGB is converted to HCT and bucketed into one of 360 hue slots, with the
bucket accumulating that color's population (`score.ts:82-90`):

```ts
const hct = Hct.fromInt(argb);
colorsHct.push(hct);
const hue = Math.floor(hct.hue);
huePopulation[hue]! += population;
populationSum += population;
```

`populationSum` is the total count, used to normalize proportions later.

### Step 2: excited hue proportions

A pure per-hue proportion would be too spiky — a hue bucket with 1% of pixels
but a neighbor with 20% should count as "near" that popular hue. Score smooths
each hue's proportion across a 30-degree window (`score.ts:93-100`):

```ts
const proportion = huePopulation[hue]! / populationSum;
for (let i = hue - 14; i < hue + 16; i++) {
	const neighborHue = sanitizeDegreesInt(i);
	hueExcitedProportions[neighborHue]! += proportion;
}
```

The window spans from `hue - 14` to `hue + 16`, inclusive, for a total of 30
degrees (note it is not perfectly centered: one extra degree on the positive
side). This is the "excited" proportion — how much of the image is active in
the neighborhood of each hue.

### Step 3: filtering

With `filter` enabled, a candidate is dropped if it fails either bar
(`score.ts:108-113`):

```ts
if (
	filter &&
	(hct.chroma < Score.CUTOFF_CHROMA || proportion <= Score.CUTOFF_EXCITED_PROPORTION)
) {
	continue;
}
```

- `CUTOFF_CHROMA = 5.0` excludes colors that are effectively grayscale
  (`score.ts:58`). A UI theme seed must have identity; a neutral gray is a
  poor seed.
- `CUTOFF_EXCITED_PROPORTION = 0.01` excludes colors whose hue neighborhood
  covers less than 1% of the image (`score.ts:59`). A color that barely
  appears should not drive the theme, even if it is a nice color.

These two filters are the "curation" step: they remove the majority of
quantizer output before any scoring happens, which is why `desired` can be so
much smaller than the quantizer's 128 colors.

### Step 4: scoring

Surviving candidates receive a score (`score.ts:115-121`):

```ts
const proportionScore = proportion * 100.0 * Score.WEIGHT_PROPORTION;
const chromaWeight =
	hct.chroma < Score.TARGET_CHROMA
		? Score.WEIGHT_CHROMA_BELOW
		: Score.WEIGHT_CHROMA_ABOVE;
const chromaScore = (hct.chroma - Score.TARGET_CHROMA) * chromaWeight;
const score = proportionScore + chromaScore;
```

Two terms:

- `proportionScore` — the excited proportion, scaled to a 0-100-like range and
  weighted by `WEIGHT_PROPORTION = 0.7`.
- `chromaScore` — how far the chroma deviates from the chroma target
  `TARGET_CHROMA = 48.0` (the "A1 chroma", `score.ts:54`), weighted by
  `WEIGHT_CHROMA_ABOVE = 0.3` above the target and `WEIGHT_CHROMA_BELOW = 0.1`
  below it.

## The weights and what they encode

| Constant | Value | Source |
| -------- | ----- | ------ |
| `TARGET_CHROMA` | 48.0 | `score.ts:54` |
| `WEIGHT_PROPORTION` | 0.7 | `score.ts:55` |
| `WEIGHT_CHROMA_ABOVE` | 0.3 | `score.ts:56` |
| `WEIGHT_CHROMA_BELOW` | 0.1 | `score.ts:57` |
| `CUTOFF_CHROMA` | 5.0 | `score.ts:58` |
| `CUTOFF_EXCITED_PROPORTION` | 0.01 | `score.ts:59` |

Three design choices are worth spelling out:

- **Dominance beats everything (0.7).** The seed should be a color the user
  actually sees a lot of. A photo's dominant hue anchors the theme; a rare
  pop of color does not.
- **48 is the sweet spot, and oversaturation is penalized more than
  undersaturation.** At 48 chroma a color is vivid enough to be interesting
  but not so saturated that it looks neon. Being *above* the target is
  penalized at 0.3 per chroma unit, while being *below* is penalized at only
  0.1 — the curve is deliberately lopsided toward "close to A1 is good, too
  colorful is worse than not colorful enough". This mirrors the Material
  aesthetic: seeds slightly under 48 are acceptable, seeds over it lose points
  quickly.
- **Chroma penalty is a linear ramp, not a cliff.** The `(chroma - 48) *
  weight` form means a color at chroma 80 loses `32 * 0.3 = 9.6` points from
  the chroma term alone — which no reasonable proportion score can recover. The
  formula therefore does double duty: near the target it fine-tunes, far from
  it it effectively disqualifies.

The sorted result is stored as `{ hct, score }` pairs and ordered
descending (`score.ts:125`, `compare` at `score.ts:36-43`).

## Step 5: hue separation

The highest-scoring colors are not simply taken — they must be *spread across
the wheel*. Material themes need tonal contrast, and a seed set of four colors
all within a few degrees of each other would produce a muddy theme. The loop
(`score.ts:131-144`) enforces a minimum hue distance that relaxes over time:

```ts
for (let difference = 90; difference >= 15; difference--) {
	chosenColors.length = 0;
	for (const { hct } of scoredHct) {
		const duplicateHue = chosenColors.find((chosenHct) => {
			return differenceDegrees(hct.hue, chosenHct.hue) < difference;
		});
		if (!duplicateHue) {
			chosenColors.push(hct);
		}
		if (chosenColors.length >= desired) break;
	}
	if (chosenColors.length >= desired) break;
}
```

It starts demanding 90 degrees of separation — the theoretical maximum for 4
colors on a 360-degree wheel — and progressively relaxes to 15 degrees until
`desired` colors fit. Within each pass, candidates are tried in score order, so
at every tolerance the highest-scoring colors win. The greedy pick maximizes
hue diversity while deferring to quality; `differenceDegrees` (`math.ts:122`)
handles the circular wrap.

The comment (`score.ts:127-130`) explains the loop's purpose: it selects
"the colors with the largest distribution of hues possible" starting at 90
degrees and decreasing to a 15 degree minimum.

## The fallback color

If filtering and separation leave `chosenColors` empty — every candidate failed
the chroma or proportion bars — Score returns the fallback (`score.ts:146-148`):

```ts
if (chosenColors.length === 0) {
	colors.push(fallbackColorARGB);
}
```

This guarantees the contract stated in the doc comment
(`score.ts:67-73`): `score` *always* returns at least one color. A seed color
must always be producible, even from a pathological image (solid white, a
photo of fog, etc.), because the caller expects a usable theme.

## What Score does NOT do

Two things are notably absent:

- **No dislike-zone filter.** Score does not reference the disliked
  yellow-green zone. A color in the disliked hue band can win if it dominates
  the image. Dislike handling is applied *later*, at theme-construction time
  (`DislikeAnalyzer.fixIfDisliked` on the `content`/`fidelity` tertiary
  palettes, `spec/palettes.ts:189`, `spec/palettes.ts:198`), not during seed
  selection.
- **No appeal-to-tone term.** Tone (lightness) plays no role in scoring. A
  very dark or very light color can win on proportion and chroma alone; the
  tonal range of the theme comes from the tone system, not the seed.

## Where Score is used

`Score.score` has a single in-package consumer: the image pipeline.
`sourceColorFromImageBytes` feeds the quantizer output into `Score.score` and
takes the top ranked color (`image.ts:82-85`):

```ts
const result = QuantizerCelebi.quantize(pixels, 128);
const ranked = Score.score(result);
const top = ranked[0];
return top;
```

`Score` is exported from the science barrel (`science/index.ts`) but not from
the package root, so it is an internal building block. Its role in the full
pipeline is described in [image](./image.md).

Related: [overview](./overview.md), [image](./image.md),
[dislike-analyzer](./dislike-analyzer.md).
