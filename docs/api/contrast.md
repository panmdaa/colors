# The Contrast System

- [Two numbers: ratio and score](#two-numbers-ratio-and-score)
- [Why contrast is computed from tones only](#why-contrast-is-computed-from-tones-only)
- [The overall score](#the-overall-score)
- [Small and large text scores](#small-and-large-text-scores)
- [Scoring thresholds at a glance](#scoring-thresholds-at-a-glance)
- [`toScore`](#toscope)
- [`contrastChecker`](#contrastchecker)
- [CVD simulation block](#cvd-simulation-block)

## Two numbers: ratio and score

The contrast system works with two distinct numbers:

- **ratio** — the raw WCAG contrast ratio, 1 (identical) to 21 (black on
  white). Produced by `Contrast.ratioOfTones` (`src/utils/contrast.ts:39`).
- **score** — a normalized 0-10 rating derived from the ratio, designed so that
  WCAG thresholds land on round score boundaries.

`toScore(ratio)` (`color.ts:188-190`) bundles them together:

```ts
function toScore(ratio: number): ContrastScore {
  return { ratio, score: scoreOverall(ratio), smallText: scoreSmallText(ratio), largeText: scoreLargeText(ratio) };
}
```

`ContrastScore` (`types.ts:116-121`) is the shape shared by every scoring API:

```ts
export interface ContrastScore {
  ratio: number;
  score: number;        // 0-10 overall
  smallText: number;    // 0-10 for normal-size text
  largeText: number;    // 0-10 for large text (>= 24px / 18.66px bold)
}
```

## Why contrast is computed from tones only

Every contrast computation in the library derives the ratio from **tone alone**
— never from full RGB:

```ts
const ratio = Contrast.ratioOfTones(Color.getTone(base), Color.getTone(on));   // color.ts:197, 246
```

`Contrast.ratioOfTones` (`src/utils/contrast.ts:39-49`) clamps both tones to
`[0, 100]`, converts them to luminance via `yFromLstar`, and applies the WCAG
formula:

```ts
ratioOfYs(y1: number, y2: number): number {
  const lighter = y1 > y2 ? y1 : y2;
  const darker = lighter === y2 ? y1 : y2;
  return (lighter + 5.0) / (darker + 5.0);
}
```

**Why is this sound?** WCAG contrast is defined on *relative luminance* (the
linearized Y of XYZ), and in HCT the **tone axis is exactly that relative
luminance mapped through CIELAB L\*** (`yFromLstar` / `lstarFromY`,
`src/utils/color.ts:164-216`). The +5 offset in the formula is the WCAG
0.05 floor rescaled to the 0-100 luminance scale. Two colors of tone 40 and 80
always produce the same ratio regardless of hue or chroma, because hue/chroma
do not contribute to luminance. This makes the ratio a pure function of the
perceptual lightness difference — cheap, deterministic, and correct for the
purposes of Material 3, which itself picks role tones by ratio (see
`Contrast.lighter`/`darker` usage in `src/spec/color-calculation.ts`). The
tradeoff: it is an approximation. Within a single hue family, colors of equal
tone have near-identical luminance, so the error is tiny; across wildly
different hues it is still minor because L\* is defined from Y directly.

## The overall score

`scoreOverall` (`color.ts:169-172`) normalizes the ratio onto a logarithmic
scale:

```ts
function scoreOverall(ratio: number): number {
  // Logarithmic scale: log2(21) ≈ 4.39 → normalizes ratio 1..21 to 0..10
  return clampScore((Math.log2(Math.max(ratio, 1)) / Math.log2(21)) * 10);
}
```

**Why logarithmic?** Contrast ratio is itself roughly logarithmic in perceived
difference: the jump from 1:1 to 2:1 is a much bigger perceived change than
from 20:1 to 21:1. A linear mapping would compress all the "interesting"
low-ratio differences into the bottom of the scale. `log2` spreads the
perceptually meaningful range, and dividing by `log2(21) ≈ 4.39` makes ratio 21
land exactly on score 10 and ratio 1 (no contrast) land on score 0.
Consequently the scale is not ratio-symmetric — score 5 sits at ratio
`21^(5/10) = √21 ≈ 4.58`, right at the AA normal-text threshold. `clampScore`
(`color.ts:165-167`) keeps out-of-range inputs inside `[0, 10]`.

## Small and large text scores

Because WCAG's pass thresholds differ by text size, the library scores the two
cases separately with piecewise-linear mappings (`color.ts:174-186`):

```ts
function scoreSmallText(ratio: number): number {
  if (ratio <= 1) return 0;
  if (ratio <= 4.5) return clampScore(mapRange(ratio, 1, 4.5, 0, 5));
  if (ratio <= 7) return clampScore(mapRange(ratio, 4.5, 7, 5, 7));
  return clampScore(mapRange(Math.min(ratio, 21), 7, 21, 7, 10));
}

function scoreLargeText(ratio: number): number {
  if (ratio <= 1) return 0;
  if (ratio <= 3) return clampScore(mapRange(ratio, 1, 3, 0, 5));
  if (ratio <= 4.5) return clampScore(mapRange(ratio, 3, 4.5, 5, 7));
  return clampScore(mapRange(Math.min(ratio, 21), 4.5, 21, 7, 10));
}
```

`mapRange` (`color.ts:161-163`) is a simple linear remap between two segments.

**Why these anchor points?** The breakpoints are exactly the WCAG success
criteria:

- **AA normal text** needs ≥ 4.5:1 — `scoreSmallText` reaches 5 there.
- **AA large text** needs ≥ 3.0:1 — `scoreLargeText` reaches 5 there.
- **AAA** needs ≥ 7.0:1 for both — both functions reach 7 there.

So a 0-10 score encodes "how close am I to passing which level". The `<= 1`
guard returns 0 for identical colors, where the logarithmic overall score would
otherwise produce a small non-zero value. The `Math.min(ratio, 21)` cap
prevents extrapolating past the theoretical maximum in the top segment.

## Scoring thresholds at a glance

| Ratio | `score` (overall) | `smallText` | `largeText` | WCAG meaning |
| ----- | ----------------- | ----------- | ----------- | ------------ |
| 1.0 | 0 | 0 | 0 | no contrast |
| 3.0 | 3.61 | 2.86 | 5 | AA large text passes |
| 4.5 | 4.94 | 5 | 7 | AA normal text passes |
| 7.0 | 6.39 | 7 | 7.45 | AAA passes |
| 21.0 | 10 | 10 | 10 | theoretical maximum |

Overall scores at the anchor ratios are computed as
`log2(r)/log2(21)*10` (3.0 → 3.61, 4.5 → 4.94, 7.0 → 6.39), so the small/large
text scores are the ones with WCAG thresholds baked in, while the overall score
is a generic perceptual rating. Note that `scoreLargeText` reaches 7 already at
ratio 4.5 (its `3 → 4.5` segment maps to `5 → 7`), while `scoreSmallText`
reaches 7 only at ratio 7 — large text passes AAA-equivalent grading earlier
because its AA bar (3.0) is lower.

## `contrastChecker`

`contrastChecker` (`color.ts:194-210`) scores a single `base`/`on` pair:

```ts
export function contrastChecker(base: ColorValue, on: ColorValue): ContrastScoreCVD;
export function contrastChecker(base: ColorValue, on: ColorValue, cvd: false): ContrastScore;
export function contrastChecker(base: ColorValue, on: ColorValue, cvd?: boolean): ContrastScore | ContrastScoreCVD {
  const result = toScore(Contrast.ratioOfTones(Color.getTone(base), Color.getTone(on)));

  if (cvd !== false) {
    // ... CVD simulation block ...
    return { ...result, simulations } as ContrastScoreCVD;
  }

  return result;
}
```

The overloads make the behavior explicit at the type level:

- `contrastChecker(base, on)` — returns `ContrastScoreCVD` (default includes
  simulations).
- `contrastChecker(base, on, false)` — returns plain `ContrastScore`, skipping
  the simulation work.

Verified output for a real Material pair:

```ts
contrastChecker('#6750a4', '#ffffff')
// → {
//     ratio: 6.44,
//     score: 6.12,
//     smallText: 6.55,
//     largeText: 7.35,
//     simulations: {
//       protanopia:   { ratio: 6.32, score: 6.06, smallText: 6.46, largeText: 7.33 },
//       deuteranopia: { ratio: 6.49, score: 6.15, smallText: 6.60, largeText: 7.36 },
//       tritanopia:   { ratio: 6.24, score: 6.01, smallText: 6.39, largeText: 7.32 },
//     },
//   }
```

`ContrastScoreCVD` extends `ContrastScore` with a `simulations` map
(`types.ts:123-125`):

```ts
export interface ContrastScoreCVD extends ContrastScore {
  simulations: Record<ColorVisionDeficiency, ContrastScore>;
}
```

## CVD simulation block

When CVD simulation is enabled, each color is first run through `simulateCVD`
and the ratio is recomputed from the *simulated* tones (`color.ts:199-206`):

```ts
for (const deficiency of DEFICIENCIES) {
  const simBase = simulateCVD(base, deficiency);
  const simOn = simulateCVD(on, deficiency);
  simulations[deficiency] = toScore(Contrast.ratioOfTones(Color.getTone(simBase), Color.getTone(simOn)));
}
```

`DEFICIENCIES` (`color.ts:192`) is the three common types:
`["protanopia", "deuteranopia", "tritanopia"]`. `simulateCVD` (in
`src/science/color-blindness.ts:111`) applies the Machado (2009)
physiologically-based model — the same algorithm Chrome DevTools uses for its
"emulate vision deficiencies" feature — by matrix-multiplying the color's
linear RGB values.

**Why simulate before scoring?** A pair can pass AA for a trichromatic viewer
but fail for someone with a deficiency, because the two colors collapse toward
the same perceived tone. Re-running the ratio on the simulated colors exposes
those pairs; the ratio is still computed from tones only, but now from the
tones of the *perceived* colors. Each simulated score is a full `ContrastScore`,
so callers can compare `ratio`, `score`, `smallText`, and `largeText` between
normal and simulated vision.

See [palette-checker.md](./palette-checker.md) for how the same scoring
machinery is applied to an entire palette.
