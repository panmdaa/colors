# DislikeAnalyzer

- [The psychology](#the-psychology)
- [The disliked zone](#the-disliked-zone)
- [isDisliked: the predicate](#isdisliked-the-predicate)
- [fixIfDisliked: the fix](#fixifdisliked-the-fix)
- [Why this fix and not another](#why-this-fix-and-not-another)
- [Where dislike is applied](#where-dislike-is-applied)

## The psychology

`DislikeAnalyzer` (`src/science/dislike-analyzer.ts:28`) encodes a specific
result from color psychology: universally, people dislike **dark
yellow-greens**. The module header cites Palmer and Schloss (2010) and Schloss
and Palmer's chapter in the *Handbook of Color Psychology* (2015)
(`dislike-analyzer.ts:19-27`), noting that the aversion correlates with
distaste for biological waste and rotting food — an evolutionary-hedonic
explanation rather than a purely aesthetic one.

This matters for a theme generator because a seed color that lands in the
disliked zone would propagate the aversion through every role token. The
library therefore ships a tiny predicate and a tiny fix, and applies them
opportunistically wherever an algorithm could produce a disliked color.

## The disliked zone

The zone is three intersecting ranges, each one an HCT dimension
(`dislike-analyzer.ts:37-43`):

```ts
isDisliked(hct: Hct): boolean {
	const huePasses = Math.round(hct.hue) >= 90.0 && Math.round(hct.hue) <= 111.0;
	const chromaPasses = Math.round(hct.chroma) > 16.0;
	const tonePasses = Math.round(hct.tone) < 65.0;

	return huePasses && chromaPasses && tonePasses;
}
```

- **Hue 90-111** is the yellow-green band of the HCT hue circle.
- **Chroma > 16** excludes neutral or near-neutral colors, which are not
  offensive even when their hue is yellowish.
- **Tone < 65** excludes light colors. The aversion is specifically to *dark*
  yellow-greens; a pale yellow-green reads as fresh and pleasant, not
  waste-like.

The conjunction is what makes the rule conservative: only colors that are
simultaneously in the hue band, saturated enough, and dark enough are flagged.
A dull olive (chroma below the bar) and a bright chartreuse (tone above the
bar) both pass through untouched. The test suite pins this exact behavior
(`test/correctness/dislike.test.ts:8-15`), including that red is not disliked.

## isDisliked: the predicate

`isDisliked(hct)` (`dislike-analyzer.ts:37`) takes an `Hct` instance and
returns a boolean. It uses `Math.round` on all three channels, so a color just
inside a boundary (e.g. hue 111.4, chroma 16.0, tone 64.9) is evaluated at its
nearest integer and the thresholds are strict (`>` for chroma, `<` for tone).
This makes the zone slightly smaller than its nominal bounds, which is the
conservative direction for an aesthetic guardrail.

## fixIfDisliked: the fix

`fixIfDisliked` (`dislike-analyzer.ts:52-58`) either returns the input
unchanged or produces a corrected color:

```ts
fixIfDisliked(hct: Hct): Hct {
	if (DislikeAnalyzer.isDisliked(hct)) {
		return Hct.from(hct.hue, hct.chroma, 70.0);
	}
	return hct;
}
```

The fix is a single operation: raise tone to 70, keeping hue and chroma. The
doc comment (`dislike-analyzer.ts:45-47`) calls it "lighten it to make it
likable". The choice of 70 is deliberate:

- Tone 70 is safely above the `65` dislike ceiling, so the result can never
  still be disliked even after the gamut solver adjusts the exact tone.
- 70 is a light, fresh tone — the "not dark" half of the aversion. The hue and
  chroma are preserved, so the color stays recognizably the same hue family,
  just moved from "rotten" territory into "fresh" territory.

Note that the hue is *not* changed. The psychology motivating the fix says the
aversion is to the dark-yellow-green *combination*; the cheapest reliable
escape is to lighten, which preserves the color's identity while leaving the
disliked region entirely. Because hue and chroma are untouched, the corrected
color still harmonizes with the seed the way the original did.

## Why this fix and not another

An alternative would be to rotate the hue out of the 90-111 band (for example
toward green or yellow), but that would change the color's family and its
relationship to the theme. The library instead exploits the structure of the
dislike predicate itself: since the zone requires `tone < 65`, raising tone is
a *guaranteed* exit, whereas a hue rotation would need to know how far to push
before the predicate clears, and would sacrifice hue identity in the process.
Lightening is also visually conservative — the corrected color stays in the
same palette neighborhood — which is exactly what an automated theme pipeline
wants: a fix that is invisible in intent and bounded in effect.

## Where dislike is applied

- **Public API**: `isDisliked(color)` and `fixDisliked(color)` wrap the two
  methods over hex strings (`color.ts:129-131`, `color.ts:125-127`).
- **Theme variants**: the `content` variant's tertiary palette is
  `fixIfDisliked(analogous(...)[2])` and the `fidelity` variant's tertiary is
  `fixIfDisliked(complement)` (`spec/palettes.ts:188-199`). Both are cases
  where the temperature machinery could land on the disliked zone, so the fix
  is applied at the source.
- `spec/tokens.ts:12` imports `DislikeAnalyzer` but never uses it — a dead
  import, presumably left from an earlier refactor. The active consumers are
  the public wrappers and `spec/palettes.ts`.

Related: [overview](./overview.md), [temperature](./temperature.md),
[blend](./blend.md).
