# The HCT Solver

## Table of Contents

- [The problem: not every (hue, chroma, tone) is a color](#the-problem-not-every-hue-chroma-tone-is-a-color)
- [The public entry points](#the-public-entry-points)
- [The fast path: findResultByJ](#the-fast-path-findresultbyj)
- [The fallback: gamut mapping by bisection](#the-fallback-gamut-mapping-by-bisection)
- [The critical planes lookup table](#the-critical-planes-lookup-table)
- [Why the solver is structured this way](#why-the-solver-is-structured-this-way)

## The problem: not every (hue, chroma, tone) is a color

The forward direction — parse a hex, read off hue/chroma/tone — always works,
because it starts from a real sRGB color. The inverse direction does not. The
set of HCT coordinates that map to a real color is a strict subset of all
`(hue, chroma, tone)` triples:

- Chroma's maximum depends on **both** hue and tone. At tone 50 the spread is
  extreme: yellow (hue ~112) tops out near chroma 50, blue (hue ~283) near 75,
  while red (hue ~25) reaches ~107.
- Near tone 0 and tone 100, chroma collapses entirely — the only colors are
  near-black and near-white.
- The valid region is non-convex, so there is no closed-form formula for the
  maximum chroma at a given hue and tone.

The header of `HctSolver.solveToInt` states the contract exactly
(`src/hct/hct-solver.ts:456-466`):

> @return A hexadecimal representing the sRGB color. The color has sufficiently
> close hue, chroma, and L\* to the desired values, if possible; otherwise, the
> hue and L\* will be sufficiently close, and chroma will be maximized.

So the solver must do two jobs: find the exact color when the request is inside
the gamut, and find the gamut boundary when it is not — degrading chroma, never
hue or tone.

## The public entry points

`HctSolver` is a class-as-namespace object (`src/hct/hct-solver.ts:34`). Its two
public methods are the entire interface used by `Hct`:

- `solveToInt(hueDegrees, chroma, lstar): number` — returns an ARGB int
  (`src/hct/hct-solver.ts:467-480`).
- `solveToCam(hueDegrees, chroma, lstar): Cam16` — `solveToInt` followed by a
  `Cam16.fromInt` (`src/hct/hct-solver.ts:494-496`).

`solveToInt` starts by short-circuiting the degenerate cases
(`src/hct/hct-solver.ts:468-470`):

```ts
if (chroma < 0.0001 || lstar < 0.0001 || lstar > 99.9999) {
    return argbFromLstar(lstar);
}
```

A chroma of zero (or an extreme tone) means "achromatic", so the answer is
simply the gray at that L\* — there is no hue to solve for. This is why
`Hct.setTone(100)` on a saturated color comes back white, and why grays have an
(arbitrary but deterministic) CAM16 hue even though chroma is 0
(`Cam16.fromInt` always computes `atan2(b, a)`, `src/hct/cam16.ts:125-127`).

Otherwise it normalizes the hue, converts L\* to Y, and tries the fast path
first (`src/hct/hct-solver.ts:471-479`):

```ts
const y = yFromLstar(lstar);
const exactAnswer = HctSolver.findResultByJ(hueRadians, chroma, y);
if (exactAnswer !== 0) {
    return exactAnswer;
}
const linrgb = HctSolver.bisectToLimit(y, hueRadians);
return argbFromLinrgb(linrgb);
```

The `0` sentinel is meaningful: `findResultByJ` returns `0` whenever the
requested color cannot exist, which is precisely when the bisection fallback
kicks in.

## The fast path: findResultByJ

`findResultByJ` (`src/hct/hct-solver.ts:388-453`) is a Newton iteration over
the CAM16 lightness J, keeping hue and chroma fixed. It starts from a rough
initial guess (`j = Math.sqrt(y) * 11.0`, `:390`) and refines it:

1. Derive the CAM16 intermediate values from the current J estimate — `alpha`,
   `t`, `ac`, `p2`, the opponent signals `a`/`b`, and the adapted cone
   responses (`:404-417`). The code comments note these operations are *inlined
   from Cam16 to avoid repeated calculation* (`:391-393`).
2. Invert the chromatic adaptation to get back to cone response space
   (`inverseChromaticAdaptation`, `:373-377`).
3. Multiply by `LINRGB_FROM_SCALED_DISCOUNT` to get linear RGB (`:421-424`).
4. Compute the Y of that linear RGB with `Y_FROM_LINRGB` (`:431-434`) and
   compare it to the target Y.
5. If the match is close enough (`|fnj - y| < 0.002`, `:438`) or it is the last
   of five rounds, return the color — but only if the channels are sane. Any
   negative channel or a channel above `100.01` means the color is out of the
   linear RGB cube, and the function returns `0` (`:428-430`, `:438-446`).
6. Otherwise update J with the Newton step — with the derivative approximated
   as `2 * fn(j) / j` (`:448-450`):

   ```ts
   j = j - ((fnj - y) * j) / (2 * fnj);
   ```

Five iterations is enough because the residual starts small and Newton
converges quadratically near the root. For requests inside the gamut this is
fast — typically a handful of multiplications per iteration — and it is what
the bulk of theme generation hits, since palette tones are chosen to be
in-gamut at the palette's chroma.

## The fallback: gamut mapping by bisection

When the exact color does not exist, the solver must find the in-gamut color
with the requested Y and hue that maximizes chroma. That is
`bisectToLimit(y, targetHue)` (`src/hct/hct-solver.ts:327-371`).

The strategy works in linear RGB space:

1. **Find the boundary segment.** The intersection of the Y-plane with the
   linear RGB cube is a polygon (a hexagon, generically) whose vertices can be
   computed in closed form. `nthVertex(y, n)` enumerates the up-to-12 candidate
   vertices, solving for the free channel given the two fixed ones and
   discarding vertices outside the cube (`:223-257`). `bisectToSegment`
   (`:268-301`) walks the polygon's vertices in order, tracking hue, and
   returns the two vertices whose hues bracket the target hue. The cyclic hue
   comparison (`areInCyclicOrder`, `:167-171`) handles the wrap around 0/360.

2. **Bisect along the segment.** The desired color lies on the polygon edge
   between those two vertices. The code refines the edge by intersecting the
   segment with successive "critical planes" — the linear RGB coordinates where
   the delinearized (gamma-corrected) channel value crosses an integer boundary
   — using `setCoordinate` (`:204-207`) and a binary search over plane indices
   (`:332-368`). Each iteration keeps the half of the segment whose hue still
   brackets the target, converging to the exact boundary point.

3. **Return the midpoint.** After refining all three axes, the midpoint between
   the two bracketing points is the boundary color (`:370`).

The result is the *most chromatic* color at that Y and hue, which matches the
contract's "chroma will be maximized" (`src/hct/hct-solver.ts:465`). This is
the path taken whenever `Hct.from` is called with an unreachable chroma — for
example `Hct.from(27, 200, 50)` requests far more chroma than sRGB can hold, so
the returned red sits on the gamut boundary.

## The critical planes lookup table

`bisectToLimit` indexes into `CRITICAL_PLANES` (`src/hct/hct-solver.ts:49-113`),
a precomputed table of 255 linear RGB values:

```ts
CRITICAL_PLANES: [
    0.015176349177441876, 0.045529047532325624, 0.07588174588720938, ...
]
```

Each entry is the linear RGB coordinate exactly halfway between two adjacent
integer gamma-encoded channel values — `linearized(k + 0.5)` for `k = 0..254`.
The first entry `0.015176` is `linearized(0.5)` (the half-step between channel
0 and channel 1), and the last entry `99.554` is `linearized(254.5)`. The
comment at the top of the file warns that this file is auto-generated and must
not be edited by hand (`src/hct/hct-solver.ts:12`).

Why planes at half-integer channel values? When a linear RGB coordinate is
delinearized and rounded to an integer channel, the rounding boundary falls
exactly at the half-step between integers. The critical planes are therefore
the precise locations where the gamut polygon's shape can change as Y varies —
rounding a channel up or down switches which faces of the cube are visible.
Indexing by `criticalPlaneAbove` / `criticalPlaneBelow`
(`src/hct/hct-solver.ts:311-317`) of a delinearized coordinate and bisecting
over plane indices guarantees the search lands on a real rounding boundary
instead of an arbitrary float, keeping the whole procedure deterministic.

## Why the solver is structured this way

**Because the inverse is not closed-form.** CAM16's saturating compression
(`400 * x^0.42 / (x^0.42 + 27.13)`, `src/hct/cam16.ts:113-119`) is invertible,
but inverting it while *simultaneously* hitting a target Y and hue inside a
non-convex sRGB gamut has no algebraic solution. Newton handles the interior;
bisection handles the boundary.

**Because the two cases need different speeds.** Theme generation calls the
solver constantly with in-gamut tones. The Newton path costs a few cheap
iterations and returns immediately. The bisection path is slower but only runs
when the color genuinely cannot exist — so the common case stays fast and the
edge case stays correct.

**Because the boundary must match what a monitor displays.** The gamut is
defined in linear RGB, but the visible boundary after gamma encoding and 8-bit
rounding runs through the critical planes. By bisecting over those planes, the
solver's "maximum chroma" is the actual maximum a screen can render, not a
theoretical linear-RGB maximum.

**Because fallback must preserve what the caller cares about.** The contract
degrades chroma, never hue or tone (`src/hct/hct-solver.ts:465`). Hue is fixed
by the segment bracketing, and Y is fixed by construction of the plane
intersection, so `Hct.from(hue, chroma, tone)` always returns a color with the
requested hue and tone and the closest reachable chroma. The `Hct` setters
depend on exactly this property: after `setChroma(200)` on a red, the reported
`chroma` reads back the boundary value, not the requested one
(`src/hct/hct.ts:94-101`).
