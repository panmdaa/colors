# Palette Checking and Reports

- [Two entry points](#two-entry-points)
- [How pairs are found: `scanPairs`](#how-pairs-are-found-scanpairs)
- [The pair shape](#the-pair-shape)
- [The full-theme overload](#the-full-theme-overload)
- [CVD simulations in the checker](#cvd-simulations-in-the-checker)
- [`report()`](#report)
- [Checker vs. report](#checker-vs-report)

## Two entry points

There are two functions that audit a whole palette for WCAG compliance:

- **`paletteChecker`** (`color.ts:286-336`) — rich output: per-pair scores,
  optional CVD simulations, and a combined summary across light + dark.
- **`report`** (`report.ts:58-83`) — a lightweight pass/fail table for a single
  mode, with no scores and no simulations.

Both share the same core idea: iterate palette roles, find each `on-{role}`
companion, and compute the WCAG booleans from the tone-only ratio (see
[contrast.md](./contrast.md) for why tones suffice).

## How pairs are found: `scanPairs`

`scanPairs` (`color.ts:230-283`) is the engine behind `paletteChecker`:

```ts
function scanPairs(
  palette: Record<string, ColorValue>,
  cvd: boolean,
): PaletteCheckerMode {
  const pairs: PaletteCheckerPair[] = [];
  const handled = new Set<string>();
  let passingAA = 0;
  let passingAALarge = 0;
  let passingAAA = 0;

  for (const role of Object.keys(palette)) {
    const onRole = `on-${role}`;
    if (onRole in palette && !handled.has(onRole)) {
      handled.add(onRole);
      const base = palette[role]!;
      const on = palette[onRole]!;
      const ratio = Contrast.ratioOfTones(getTone(base), getTone(on));
      const score = toScore(ratio);
      const AA = ratio >= 4.5;
      const AALarge = ratio >= 3.0;
      const AAA = ratio >= 7.0;

      if (AA) passingAA++;
      if (AALarge) passingAALarge++;
      if (AAA) passingAAA++;
      // ... build pair, optionally add simulations, push
    }
  }

  return {
    pairs,
    summary: { total: pairs.length, passingAA, passingAALarge, passingAAA },
  };
}
```

A pair exists only when the palette contains both `role` and `on-${role}`
(`color.ts:242`). The `handled` set (`color.ts:235`) dedupes pairs: an entry
like `on-primary-container` is both a *value* (as the "on" of
`primary-container`) and a *candidate role* (whose "on" would be
`on-on-primary-container`). The set prevents a token that already played the
"on" role from being scanned again as a base, so each meaningful background /
foreground combination is counted exactly once.

For the 53-role `Palette` this yields **14 pairs** (see the families in
[palette.md](./palette.md)): `primary`, `primary-container`, `primary-fixed`,
the same three for secondary and tertiary, `error`, `error-container`,
`background`, `surface`, and `surface-variant`. With the default `cvd` enabled
(or `cvd: false`), a full-theme check returns 28 pairs total. Real output for
`palette('#6750a4')` checked with `cvd: false`:

```ts
paletteChecker(theme, false).summary
// → { total: 28, passingAA: 28, passingAALarge: 28, passingAAA: 6 }

paletteChecker(theme, false).light.pairs[0]
// → {
//     role: 'primary',
//     onRole: 'on-primary',
//     base: '#5b4497',
//     on: '#eadeff',
//     score: { ratio: 6.03, score: 5.9, smallText: 6.22, largeText: 7.28 },
//     AA: true, AALarge: true, AAA: false,
//   }
```

## The pair shape

Each pair is a `PaletteCheckerPair` (`types.ts:140-150`):

```ts
export interface PaletteCheckerPair {
  role: string;
  onRole: string;
  base: ColorValue;
  on: ColorValue;
  score: ContrastScore;              // { ratio, score, smallText, largeText }
  AA: boolean;                       // ratio >= 4.5
  AALarge: boolean;                  // ratio >= 3.0
  AAA: boolean;                      // ratio >= 7.0
  simulations?: Record<ColorVisionDeficiency, PaletteCheckerSimulation>;
}
```

`AA`/`AALarge`/`AAA` are the raw WCAG pass booleans at `color.ts:248-250`; the
`score` object carries the richer 0-10 breakdown. `simulations` is only present
when CVD checking is enabled.

## The full-theme overload

`paletteChecker` has overloads for both a single palette and a full theme
(`color.ts:286-311`). The runtime dispatch (`color.ts:313-336`) distinguishes
them by shape:

```ts
if ("light" in input && "dark" in input) {
  const light = scanPairs(input.light, cvd !== false);
  const dark = scanPairs(input.dark, cvd !== false);
  return {
    color: input.color,
    light,
    dark,
    summary: {
      total: light.summary.total + dark.summary.total,
      passingAA: light.summary.passingAA + dark.summary.passingAA,
      passingAALarge: light.summary.passingAALarge + dark.summary.passingAALarge,
      passingAAA: light.summary.passingAAA + dark.summary.passingAAA,
    },
  };
}
```

When given a theme (`{ color, light, dark }`), each mode is scanned
independently and the result combines them (`PaletteCheckerResult`,
`types.ts:164-168`):

```ts
export interface PaletteCheckerResult {
  color: ColorValue;
  light: PaletteCheckerMode;
  dark: PaletteCheckerMode;
  summary: PaletteModeSummary;
}
```

The `PaletteModeSummary` (`types.ts:152-157`) totals are plain sums across the
two modes, so for a `palette()` theme the combined `total` is 28 (14 per mode).

## CVD simulations in the checker

CVD is enabled by default: `scanPairs(input.light, cvd !== false)`
(`color.ts:319-320`). Passing `false` as the second argument opts out. When
enabled, each pair gets a `simulations` map built by `buildSimulation`
(`color.ts:212-228`):

```ts
const simBase = simulateCVD(base, deficiency);
const simOn = simulateCVD(on, deficiency);
const simRatio = Contrast.ratioOfTones(getTone(simBase), getTone(simOn));
return {
  base: simBase,
  on: simOn,
  score: toScore(simRatio),
  AA: simRatio >= 4.5,
  AALarge: simRatio >= 3.0,
  AAA: simRatio >= 7.0,
};
```

`PaletteCheckerSimulation` (`types.ts:131-138`) therefore contains the two
simulated colors plus their own score and pass booleans — so a pair that passes
trichromatic AA but fails simulated protanopia is directly visible in the data.

## `report()`

`report` (`report.ts:58-83`) is the minimal single-mode alternative:

```ts
export function report(
  theme: { light: Record<string, ColorValue>; dark: Record<string, ColorValue> },
  mode: "light" | "dark" = "light",
): ContrastReport {
  const palette = mode === "light" ? theme.light : theme.dark;
  // ... iterate roles, find on-{role} pairs, dedupe with handledOnRoles
  return { pairs, summary: { total, passingAA, passingAAA } };
}
```

It mirrors `scanPairs`' iteration and dedup (`report.ts:65-76`) but:

- operates on a **single mode**, defaulting to `"light"` (`report.ts:60`);
- produces `ContrastPair` entries (`report.ts:16-23`) with the raw `ratio` and
  the three booleans — no score breakdown;
- its summary (`report.ts:25-32`) omits `passingAALarge`, tracking only
  `total`, `passingAA`, and `passingAAA`.

The docstring example (`report.ts:49-57`) shows the intended usage:

```ts
const { pairs, summary } = report(theme);
// summary → { total: 14, passingAA: 14, passingAAA: 10 }
```

(The docstring's `passingAAA: 10` is illustrative — real counts depend on the
seed; `report(palette('#6750a4'))` returns `{ total: 14, passingAA: 14,
passingAAA: 3 }`.)

## Checker vs. report

| Aspect | `paletteChecker` | `report` |
| ------ | ---------------- | -------- |
| Modes | light + dark (or one palette) | one mode, `"light"` default |
| Per-pair scores | full `ContrastScore` | ratio + booleans only |
| CVD simulations | yes (default on) | no |
| Summary fields | `total`, `passingAA`, `passingAALarge`, `passingAAA` | `total`, `passingAA`, `passingAAA` |
| Ideal for | interactive audits, debugging tone ratios | CI gates, console summaries |
