# ToneDeltaPair: Guaranteeing Tonal Distance Between Roles

- [What a ToneDeltaPair is](#what-a-tonedeltapair-is)
- [Polarity and constraint](#polarity-and-constraint)
- [How the solver applies a pair](#how-the-solver-applies-a-pair)
- [The pairs the token spec uses](#the-pairs-the-token-spec-uses)
- [Why tonal distance is a first-class constraint](#why-tonal-distance-is-a-first-class-constraint)

## What a ToneDeltaPair is

A `ToneDeltaPair` documents a constraint between two `DynamicColor`s: their
tones must keep a certain *distance* from each other (`tone-delta-pair.ts:27-34`):

> Documents a constraint between two DynamicColors, in which their tones must
> have a certain distance from each other. Prefer a DynamicColor with a
> background, this is for special cases when designers want tonal distance,
> literally contrast, between two colors that don't have a background /
> foreground relationship or a contrast guarantee.

The class pairs a *self* role with a *reference* role. The pair is directional:
role A's tone is described relative to role B's.

## Polarity and constraint

The constructor (`tone-delta-pair.ts:61-70`):

```ts
constructor(
  readonly roleA: DynamicColor,
  readonly roleB: DynamicColor,
  readonly delta: number,
  readonly polarity: TonePolarity,
  readonly stayTogether: boolean,
  readonly constraint?: DeltaConstraint
) {
  this.constraint = constraint ?? 'exact';
}
```

The two type aliases define the vocabulary (`tone-delta-pair.ts:19-25`):

```ts
export type TonePolarity =
  'darker' | 'lighter' | 'nearer' | 'farther' | 'relative_darker' | 'relative_lighter';

export type DeltaConstraint = 'exact' | 'nearer' | 'farther';
```

The doc comment's example is the best definition of polarity
(`tone-delta-pair.ts:40-48`):

> ToneDeltaPair(A, B, 15, 'darker', 'exact') states that A's tone should be
> exactly 15 darker than B's.

The interesting entries are the two *relative* polarities, which flip their
meaning with the mode:

> 'relative_darker' and 'relative_lighter' describe the tone adjustment relative
> to the surface color trend (white in light mode; black in dark mode). For
> instance, ToneDeltaPair(A, B, 10, 'relative_lighter', 'farther') states that A
> should be at least 10 lighter than B in light mode, and at least 10 darker
> than B in dark mode.

So `relative_lighter` is shorthand for "A sits toward the *light end* of the
scheme relative to B" — i.e. lighter in light mode (where surfaces are light)
and darker in dark mode (where surfaces are dark). This is exactly the pattern
used by `primaryContainer` vs `primary`.

The `constraint` selects how strictly the delta is honored:

- `exact` — the tone difference is exactly `delta`.
- `nearer` — `delta` is a *maximum* distance; the tone may come closer if it
  already satisfies other constraints.
- `farther` — `delta` is a *minimum* distance; the tone is pushed away to at
  least `delta`, or kept further out if it is already beyond.

`stayTogether` marks pairs that must remain on the same side of the awkward zone
(T50-59). The class comment notes it is necessary "for certain cases where one
role has two backgrounds" (`tone-delta-pair.ts:57-60`).

One deprecated wart worth knowing: `nearer` and `farther` are *deprecated* as
`TonePolarity` values in favor of the `DeltaConstraint` field
(`tone-delta-pair.ts:16-17`), and the token spec only ever uses the
`relative_*`/`darker` polarities.

## How the solver applies a pair

Pairs are applied inside `DynamicColor.getTone`, case 0
(`spec/color-calculation.ts:67-132`). The steps:

1. **Determine the sign of the delta** from polarity and mode
   (`color-calculation.ts:72-77`):

```ts
const absoluteDelta =
  polarity === 'darker' ||
  (polarity === 'relative_lighter' && scheme.isDark) ||
  (polarity === 'relative_darker' && !scheme.isDark)
    ? -toneDeltaPair.delta
    : toneDeltaPair.delta;
```

   `darker` is always negative; `relative_lighter` is negative in dark mode and
   positive in light mode; `relative_darker` is the mirror image.

2. **Compute the role-relative delta.** `absoluteDelta` describes A vs B; the
   role being solved flips it if it is B (`color-calculation.ts:79-84`):

```ts
const amRoleA = color.name === roleA.name;
const selfRole = amRoleA ? roleA : roleB;
const refRole = amRoleA ? roleB : roleA;
let selfTone = selfRole.tone(scheme);
const refTone = refRole.getTone(scheme);
const relativeDelta = absoluteDelta * (amRoleA ? 1 : -1);
```

   Note `refTone` is *resolved* (`getTone`) while `selfTone` is the role's raw
   declared tone — the pair is anchored on the already-solved partner.

3. **Apply the constraint** (`color-calculation.ts:86-108`):

```ts
if (constraint === 'exact') {
  selfTone = clampDouble(0, 100, refTone + relativeDelta);
} else if (constraint === 'nearer') {
  // clamp selfTone toward the refTone+delta window
} else if (constraint === 'farther') {
  selfTone = clampDouble(refTone + relativeDelta, 100, selfTone);
  // or clampDouble(0, refTone + relativeDelta, selfTone) when delta is negative
}
```

   `farther` pushes `selfTone` *away* from the reference: it must be at least
   `delta` apart, and if it was already further, it stays there.

4. **Re-check contrast against the background.** If the pair member also has a
   background + contrast curve, its final tone is validated against the ratio
   target and corrected with `DynamicColor.foregroundTone` if needed
   (`color-calculation.ts:110-122`). A pair guarantees *tonal distance*; the
   curve still guarantees *contrast* against the surface the role sits on.

5. **Awkward-zone clamp for background roles** (`color-calculation.ts:124-130`),
   identical to the no-pair path described in
   [dynamic-color.md](./dynamic-color.md#the-awkward-zone-and-light-foreground-heuristics).

This gives the pair's guarantee its full meaning: *at least* `delta` tones of
separation, and the tones will never collapse onto each other even when other
constraints (background contrast) are pulling them the same way.

## The pairs the token spec uses

Every accent family in `spec/tokens.ts` uses the same core pair: its container
must sit at a tonal distance from its base color, *toward the light end of the
scheme*. `primary` (`tokens.ts:377-385`):

```ts
toneDeltaPair: () =>
  new ToneDeltaPair(
    this.primaryContainer(),
    this.primary(),
    5,
    'relative_lighter',
    true,
    'farther'
  )
```

- In light mode: `primaryContainer` is 5+ tones *lighter* than `primary`.
- In dark mode: `primaryContainer` is 5+ tones *darker* than `primary`.

The identical pair is wired for `secondary` (`tokens.ts:515-523`), `tertiary`
(`tokens.ts:644-652`) and `error` (`tokens.ts:774-782`).

The fixed families use a second pair with `exact` polarity: `primaryFixedDim`
must sit *exactly* 5 tones darker than `primaryFixed`
(`tokens.ts:468-476`):

```ts
toneDeltaPair: () =>
  new ToneDeltaPair(
    this.primaryFixedDim(),
    this.primaryFixed(),
    5,
    'darker',
    true,
    'exact'
  )
```

`secondaryFixedDim` (`tokens.ts:593-601`) and `tertiaryFixedDim`
(`tokens.ts:723-731`) mirror it. Because these roles are exempt from the
awkward-zone clamp (their names end in `_fixed_dim`,
`color-calculation.ts:124`), the `exact` delta is preserved even when it lands
inside the 50-59 band.

## Why tonal distance is a first-class constraint

Material 3's containers exist at a *tonal* offset from their base role, not a
*contrast* offset. `primary` and `primaryContainer` often live on the same
surface and neither is "text on the other" — the design wants them *related but
distinct*: same hue, clearly different lightness. A `ContrastCurve` cannot
express that (the two may never sit on top of each other), so the system needs a
separate mechanism: literally, "these two tones must stay apart."

This is also why `primaryContainer` carries **both** a `toneDeltaPair`
(tonal distance from `primary`) and a `contrastCurve` (minimum 1.5:1 against the
surface, only at positive contrast — see [contrast-curve.md](./contrast-curve.md)).
The pair expresses the *relative* design relation; the curve expresses the
*absolute* accessibility floor. They solve different problems and neither can
replace the other.
