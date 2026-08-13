# DynamicColor: How a Role Resolves Its Color

- [What a DynamicColor is](#what-a-dynamiccolor-is)
- [The two factories](#the-two-factories)
- [Palette vs tone: the 2-step split](#palette-vs-tone-the-2-step-split)
- [The tone solver: `getTone`](#the-tone-solver-gettone)
  - [Case 0: a tone delta pair](#case-0-a-tone-delta-pair)
  - [Case 1: a background and a contrast curve](#case-1-a-background-and-a-contrast-curve)
  - [Case 2: two backgrounds](#case-2-two-backgrounds)
- [The awkward zone and light-foreground heuristics](#the-awkward-zone-and-light-foreground-heuristics)
- [Caching](#caching)
- [Why this design](#why-this-design)

## What a DynamicColor is

`DynamicColor` is "a color that adjusts itself based on UI state provided by
`DynamicScheme`" (`dynamic-color.ts:60-70`). It is a *role*: an intent plus a
set of constraints, packaged as functions of a scheme rather than as a stored
value.

The full constructor shows the shape (`dynamic-color.ts:136-146`):

```ts
constructor(
  readonly name: string,
  readonly palette: (scheme: DynamicScheme) => TonalPalette,
  readonly tone: (scheme: DynamicScheme) => number,
  readonly isBackground: boolean,
  readonly chromaMultiplier?: (scheme: DynamicScheme) => number,
  readonly background?: (scheme: DynamicScheme) => DynamicColor | undefined,
  readonly secondBackground?: (scheme: DynamicScheme) => DynamicColor | undefined,
  readonly contrastCurve?: (scheme: DynamicScheme) => ContrastCurve | undefined,
  readonly toneDeltaPair?: (scheme: DynamicScheme) => ToneDeltaPair | undefined
)
```

Every field is a function of the scheme. That is deliberate: a role like
`onPrimary` needs to answer "what tone am I, given *this* light/dark scheme at
*this* contrast level, sitting on *this* background?" — and only a function can
do that lazily, at resolve time.

The constructor also *validates* the constraint combinations
(`dynamic-color.ts:147-161`). It throws if:

- `secondBackground` is set but `background` is not;
- `contrastCurve` is set but `background` is not;
- `background` is set but `contrastCurve` is not.

So a background always travels with a contrast curve, and there is never a
foreground role with a dangling second background.

## The two factories

The class doc comments note "prefer static constructors" (`dynamic-color.ts:66-69`).
Only one static factory exists in this codebase:

**`DynamicColor.fromPalette(args: FromPaletteOptions)`** (`dynamic-color.ts:80-92`)
is the only public factory. Its options type is `FromPaletteOptions`
(`dynamic-color.ts:48-58`) and the factory fills in the tone default:

```ts
static fromPalette(args: FromPaletteOptions): DynamicColor {
  return new DynamicColor(
    args.name ?? '',
    args.palette,
    args.tone ?? DynamicColor.getInitialToneFromBackground(args.background),
    args.isBackground ?? false,
    args.chromaMultiplier,
    args.background,
    args.secondBackground,
    args.contrastCurve,
    args.toneDeltaPair
  );
}
```

There is **no `fromArgb` factory** in this library. A hex-seeded role would
arrive via `TonalPalette.fromInt(argb)` (see `tonal-palette.ts:25-28`) and then
`fromPalette` with that palette — the factory contract is always "palette +
tone rule", never "a color out of nowhere".

The tone default is `getInitialToneFromBackground` (`dynamic-color.ts:94-101`):
tone 50 when there is no background, otherwise the background's own tone (or 50
if the background is undefined). A role with a background therefore starts at
its background's tone and lets the contrast solver push it apart — which is the
core M3 idea that foreground tones are *relative* to their background, not
absolute.

The base constructor itself is public but documented as "arguably too flexible"
(`dynamic-color.ts:103-115`); `fromPalette` is the supported path. `clone()`
(`dynamic-color.ts:167-179`) rebuilds the same role through `fromPalette`, which
is how `ColorTokens` derives sibling roles like `background` (a renamed
`surface` clone, `tokens.ts:78-83`) or `surfaceVariant` (a renamed
`surfaceContainerHighest` clone, `tokens.ts:259-264`).

## Palette vs tone: the 2-step split

A role resolves in two steps, and the split lives in
`spec/color-calculation.ts`:

1. **Tone first** — `color.getTone(scheme)` runs the entire solver (below) and
   produces a number in [0, 100].
2. **Chroma fallback second** — `getArgb`/`getHct` then combine the tone with
   the palette's hue/chroma, applying `chromaMultiplier`
   (`color-calculation.ts:33-46`):

```ts
getArgb(scheme: DynamicScheme, color: DynamicColor): number {
  const palette = color.palette(scheme);
  const tone = color.getTone(scheme);
  const multiplier = color.chromaMultiplier ? color.chromaMultiplier(scheme) : 1;
  if (multiplier === 1) {
    return palette.tone(tone);
  }
  const chroma = palette.chroma * multiplier;
  if (tone === 99 && Hct.isYellow(palette.hue)) {
    return TonalPalette.fromHueAndChroma(palette.hue, chroma).tone(tone);
  }
  return Hct.argbFrom(palette.hue, chroma, tone);
}
```

The hue and chroma come from the **palette** (`TonalPalette`, which is constant
in hue/chroma — see `tonal-palette.ts:14-18`); the tone is the only thing the
role computes. This is what keeps contrast adjustments "tonal": when a role
shifts tone to hit a contrast ratio, its chroma (and therefore its perceived
saturation) is preserved.

The `chromaMultiplier` is where the *chroma fallback for non-content colors*
happens. In `spec/tokens.ts`, surface-family roles set the multiplier to `0` for
every variant except `CMF`:

```ts
onSurface(): DynamicColor {
  return DynamicColor.fromPalette({
    name: 'on_surface',
    palette: (s) => s.neutralPalette,
    chromaMultiplier: (s) => {
      if (s.variant === Variant.CMF) {
        return 1.7;
      } else {
        return 0;
      }
    },
    // ...
  });
}
```

Multiplying the neutral palette's chroma by 0 forces the resulting color to be
achromatic *regardless of the palette the variant chose*. The neutral palette
can carry some chroma (tonal-spot uses 5, expressive up to 18), but the surface
*roles* deliberately discard it — except in CMF, which keeps a hint of color in
surfaces (`tokens.ts:247-256`). `surfaceDim`, `surfaceBright`, the container
steps, `inverseSurface`, `outline`, `outlineVariant` and `onSurfaceVariant` all
follow the same pattern (`tokens.ts:119-147`, `282-339`).

## The tone solver: `getTone`

`getTone` (`color-calculation.ts:63-200`) is the heart of the whole system. It
picks between three cases, in order of priority.

### Case 0: a tone delta pair

If the role has a `toneDeltaPair` (`color-calculation.ts:67-132`), the pair is
resolved first. The details are in [tone-delta-pair.md](./tone-delta-pair.md);
in short, the role finds its reference partner's resolved tone, adds the signed
delta, and applies the constraint (`exact`, `nearer` or `farther`). Then:

- if the role also has a background + contrast curve, the result is re-checked
  against the contrast target and moved by `foregroundTone` if it falls short
  (`color-calculation.ts:110-122`);
- if the role is a background, it is pushed out of the awkward zone
  (`color-calculation.ts:124-130`).

### Case 1: a background and a contrast curve

Without a pair, the role starts from its declared tone and adjusts it against
its background (`color-calculation.ts:133-164`):

```ts
let answer = color.tone(scheme);

if (
  color.background?.(scheme) === undefined ||
  color.contrastCurve?.(scheme) === undefined
) {
  return answer;
}

const bgTone = color.background(scheme)?.getTone(scheme) ?? 50;
const desiredRatio = color.contrastCurve(scheme)?.get(scheme.contrastLevel) ?? 0;

answer =
  Contrast.ratioOfTones(bgTone, answer) >= desiredRatio &&
  scheme.contrastLevel >= 0
    ? answer
    : DynamicColor.foregroundTone(bgTone, desiredRatio);
```

Two details are easy to miss:

- **No background, no curve, no change.** Roles like `shadow` and `scrim`
  (tone always 0, `tokens.ts:341-355`) never move, because they have no
  background.
- **The `contrastLevel >= 0` guard.** When contrast is at or below standard
  (level <= 0), a role that already meets its target keeps its declared tone;
  it is only *forced* to the curve value when the level is positive. And note
  that container roles *drop* their contrast curve entirely at level <= 0 —
  `primaryContainer` sets `contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)`
  (`tokens.ts:420`). So at standard contrast, containers keep their raw tonal
  design and only tighten to a 1.5:1 minimum against the surface when contrast
  is increased. This is the design intent: containers are *meant* to be
  low-contrast, quiet areas.

### Case 2: two backgrounds

If the role has a `secondBackground`, it must contrast against *both* at once
(`color-calculation.ts:162-199`). The solver picks the lighter and darker of the
two backgrounds, and if the current tone cannot reach the ratio against both, it
computes a light option against the lighter background and a dark option against
the darker one, then prefers the direction indicated by
`tonePrefersLightForeground`. This is how `onPrimaryFixed`/`onPrimaryFixedVariant`
survive sitting on either `primaryFixed` or `primaryFixedDim` depending on which
side of tone 57 the fixed color sits (`tokens.ts:481-499`).

## The awkward zone and light-foreground heuristics

Two static helpers encode perceptual research about how people read lightness:

- `tonePrefersLightForeground(tone)` — `Math.round(tone) < 60`
  (`dynamic-color.ts:282-284`). Below ~T60, people expect a white foreground.
  The comment cites Andrew Somers' APCA research and notes T60 is *excluded* so
  that `tertiaryContainer` in the dark monochrome scheme (which requires T60) is
  not adjusted.
- `toneAllowsLightForeground(tone)` — `Math.round(tone) <= 49`
  (`dynamic-color.ts:290-292`). White can only realistically hit 4.5:1 from
  tones at or below 49.

`foregroundTone(bgTone, ratio)` (`dynamic-color.ts:242-269`) is the workhorse:
it computes both a lighter and a darker candidate that reach the ratio, then
picks based on which side the background prefers. It also carries a defensive
edge case (documented in the code) where Tonal Spot's `onPrimaryContainer` could
flash black between high and max contrast — handled by the `negligibleDifference`
branch (`dynamic-color.ts:254-268`).

The *awkward zone* is handled directly in the solver for any role marked
`isBackground` (`color-calculation.ts:124-130` and `154-160`):

```ts
if (color.isBackground && !color.name.endsWith('_fixed_dim')) {
  if (selfTone >= 57) {
    selfTone = clampDouble(65, 100, selfTone);
  } else {
    selfTone = clampDouble(0, 49, selfTone);
  }
}
```

Tones 50-59 are neither clearly light nor clearly dark, so foregrounds are
ambiguous there. A *background* role is therefore clamped out of that band
entirely: it is forced to 0-49 or 65-100. The `_fixed_dim` roles are exempt
because `primaryFixedDim` etc. must stay exactly `delta` below their `*Fixed`
partner (`tokens.ts:461-479`), and clamping would break the pair.

`enableLightForeground(tone)` (`dynamic-color.ts:298-306`) ties the two helpers
together: if a tone prefers a light foreground but does not allow one, it snaps
to 49.

## Caching

`DynamicColor` keeps a per-scheme HCT cache (`dynamic-color.ts:72`,
`208-219`). It is bounded: when it grows past 4 entries it is cleared entirely,
because a single scheme typically resolves only a handful of schemes-worth of
colors over the life of a session and unbounded growth buys nothing.

## Why this design

The declarative, function-of-scheme design exists because roles are *relative*,
not absolute:

- `onPrimary` is not "a color" — it is "primary's foreground at >= 6:1 contrast",
  and since `primary` itself moves with contrast and mode, the foreground must be
  recomputed each time.
- The tone/background separation is what makes tonal palettes useful: adjusting
  contrast changes *only* the tone, preserving the designer's chosen hue and
  chroma.
- The constructor validation turns wiring mistakes into fail-fast errors at
  scheme construction instead of silent wrong colors.

The class doc puts the philosophy best (`dynamic-color.ts:110-114`): the default
behavior — push tone to a 7:1 ratio at max contrast — "is principled and matches
accessibility guidance. That does not mean it's the desired approach for *every*
design system." The functional constructor exists precisely so a design system
can override any single piece of it.
