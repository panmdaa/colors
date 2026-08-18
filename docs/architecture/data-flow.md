# Data Flow: From a Seed Color to a Full Theme

## Table of Contents

- [The journey in one picture](#the-journey-in-one-picture)
- [Step 1: Parse the seed](#step-1-parse-the-seed)
- [Step 2: Map the public variant to the internal enum](#step-2-map-the-public-variant-to-the-internal-enum)
- [Step 3: Construct a DynamicScheme](#step-3-construct-a-dynamicscheme)
- [Step 4: Resolve the 53 light-mode roles](#step-4-resolve-the-53-light-mode-roles)
- [Step 5: Repeat for dark mode](#step-5-repeat-for-dark-mode)
- [Step 6: Resolve extraColors](#step-6-resolve-extracolors)
- [How contrast curves and tone deltas shape a role](#how-contrast-curves-and-tone-deltas-shape-a-role)
- [The fromImage path: image → quantize → score → palette](#the-fromimage-path-image--quantize--score--palette)

## The journey in one picture

```
palette("#744c9d", { variant: "expressive", extraColors })
   color.ts:381   Hct.fromInt(toNumber("#744c9d"))
        │
   color.ts:382   toInternalVariant("expressive") → Variant.EXPRESSIVE
        ▼
   color.ts:383   generateColorPalette(source, variant, isDark=false, level=0)
        │
        │  color.ts:426  new DynamicScheme({...})
        │       │
        │       │  dynamic-scheme.ts:161-209   getSpec().get*Palette(variant, source, ...)
        │       ▼
        │  spec/palettes.ts:76-404   PaletteTokens → 6 TonalPalettes
        │       │
        │  scheme.primary (etc.)  →  dynamic-scheme.ts:301  getArgb(DynamicColor)
        │       │                        │
        │       │  color-roles.ts:145    primary()  →  spec/tokens.ts:368
        │       │                        │
        │       │  spec/color-calculation.ts:33   getArgb → getTone (contrast curves)
        │       ▼
        │  53 ARGB integers
        ▼
   generateColorPalette   Color.fromNumber().hex each → 53 hex strings → light Palette
        │
   color.ts:384   same for isDark=true → dark Palette
        │
   color.ts:386-389   resolveCustomTokens(light, dark, seed, extraColors)
        ▼
   { color, light, dark }  →  Theme
```

## Step 1: Parse the seed

`palette` is a generic function whose first argument is a `ColorValue` (a hex
string like `#744c9d`; see `src/types.ts:12`). The public API never works with
hex strings internally; everything downstream uses ARGB 32-bit integers and the
HCT class.

```ts
// src/color.ts
const source = Hct.fromInt(Color.toNumber(color));
```

- `toNumber` (`src/color.ts:23-25`) calls `argbFromHex` (`src/utils/string.ts:44-70`),
  which accepts 3, 6, or 8-digit hex (8-digit drops the alpha and keeps RGB).
- `Hct.fromInt` (`src/hct/hct.ts:65-67`) builds an `Hct` whose `hue`/`chroma`
  come from `Cam16.fromInt(argb)` and whose `tone` is `lstarFromArgb(argb)`
  (`src/hct/hct.ts:138-144`) — i.e. CAM16 hue/chroma paired with CIELAB `L*`.

From here on, "the seed" is an `Hct` object, and it flows through the whole
pipeline unchanged. `Hct` values are also what the final `Theme` records as
`theme.color` (`src/color.ts:392`).

## Step 2: Map the public variant to the internal enum

The public API exposes variants as kebab-case strings (`"tonal-spot"`,
`"expressive"`, `"cmf"`, ...; `src/types.ts:80-90`) because they are ergonomic
and match Material Design terminology. Internally the scheme layer uses a
numeric enum (`Variant.MONOCHROME = 0` ... `Variant.CMF = 9`,
`src/scheme/variant.ts:17-28`).

```ts
// src/color.ts:382
const internalVariant = toInternalVariant(variant);
```

`toInternalVariant` (`src/color.ts:395-418`) is a plain `switch` over the public
string. Two notable details:

- The **default variant is `"expressive"`**, not Tonal Spot: `options?.variant ?? "expressive"` (`src/color.ts:379`). The README's quick-look uses expressive too (`README.md:38`).
- The public names are the source of truth; the enum is an internal implementation detail that keeps the spec layer's `switch` statements cheap and exhaustive.

## Step 3: Construct a DynamicScheme

`generateColorPalette` (`src/color.ts:420-488`) is called twice — once for light,
once for dark. Each call creates a fresh `DynamicScheme`:

```ts
// src/color.ts:426-431
const scheme = new DynamicScheme({
	variant,
	sourceColorHct: source,
	isDark: dark,
	contrastLevel,
});
```

The constructor (`src/scheme/dynamic-scheme.ts:142-212`) does three things:

1. **Validates and normalizes the source colors.** With a single `sourceColorHct`,
   `sourceColorHcts` becomes `[sourceColorHct]` (`src/scheme/dynamic-scheme.ts:150-153`).
   The array form exists for multi-source variants like `CMF` (`src/scheme/variants.ts:301-363`).
2. **Computes `sourceColorArgb`** for downstream specs that need the raw seed
   (`src/scheme/dynamic-scheme.ts:157`).
3. **Resolves the six tonal palettes**, each by delegating to the spec layer.
   For each of primary/secondary/tertiary/neutral/neutralVariant, it calls
   `getSpec().get*Palette(variant, sourceColorHct, isDark, contrastLevel)`
   (`src/scheme/dynamic-scheme.ts:161-200`). Only `errorPalette` may come back
   `undefined`, in which case it falls back to the canonical red hue 25 / chroma 84:

   ```ts
   // src/scheme/dynamic-scheme.ts:201-209
   this.errorPalette =
       args.errorPalette ??
       getSpec().getErrorPalette(...) ??
       TonalPalette.fromHueAndChroma(25.0, 84.0);
   ```

A `TonalPalette` is just a fixed (hue, chroma) pair plus a memoized
`tone(tone)` function (`src/palette/tonal-palette.ts:58-69`). The hue/chroma for
each variant come from `PaletteTokens` (`src/spec/palettes.ts`); for Expressive,
primary gets chroma `isDark ? 36 : 48` (`src/spec/palettes.ts:107-111`).

The scheme also builds a `ColorRoles` instance (`src/scheme/dynamic-scheme.ts:211`),
the registry that knows every role's `DynamicColor`.

## Step 4: Resolve the 53 light-mode roles

`DynamicScheme` exposes one getter per role (`primary`, `onPrimary`,
`surfaceContainerHighest`, ...). `generateColorPalette` calls all 53 and copies
each ARGB result into a plain object keyed by the kebab-case role name:

```ts
"primary": Color.fromNumber(scheme.primary).hex,
"primary-dim": Color.fromNumber(scheme.primaryDim).hex,
"on-primary": Color.fromNumber(scheme.onPrimary).hex,
// ... 50 more
```

Every getter funnels through the memoizing `getArgb`:

```ts
// src/scheme/dynamic-scheme.ts:301-310
getArgb(dynamicColor: DynamicColor): number {
	const name = dynamicColor.name;
	if (name) {
		const cached = this.resolved.get(name);
		if (cached !== undefined) return cached;
	}
	const value = dynamicColor.getArgb(this);
	if (name) this.resolved.set(name, value);
	return value;
}
```

`dynamicColor.getArgb` (`src/scheme/dynamic-color.ts:196-198`) delegates to the
spec layer's `getSpec().getArgb(scheme, this)`. The actual math:

1. **Palette selection.** `color.palette(scheme)` returns one of the scheme's six
   `TonalPalette`s (defined by each role in `ColorTokens`).
2. **Tone resolution.** `color.getTone(scheme)` runs the full constraint solver in
   `spec/color-calculation.ts:63-200` — tone-delta pairs, contrast curves,
   background-aware foreground picking (see below).
3. **Chroma multiplier.** `getArgb` (`src/spec/color-calculation.ts:33-46`)
   applies `chromaMultiplier`; for surfaces in non-CMF variants the multiplier
   is 0, which is why surfaces stay neutral even when the neutral palette has
   nonzero chroma (`src/spec/tokens.ts:119-124`).
4. **ARGB lookup.** `palette.tone(tone)` (`src/palette/tonal-palette.ts:58-69`)
   calls `Hct.argbFrom(hue, chroma, tone)`, which is `HctSolver.solveToInt`
   (`src/hct/hct.ts:57-59`) — a binary search over CAM16 gamut planes
   (`src/hct/hct-solver.ts:49+`, `CRITICAL_PLANES`).

The result is an ARGB integer; `fromNumber` (`src/color.ts:27-29`) turns it back
into the `#rrggbb` string the API promises.

## Step 5: Repeat for dark mode

The same `generateColorPalette` call runs again with `isDark: true`
(`src/color.ts:384`). Nothing else changes — the same variant, the same seed.
Because `isDark` is an input to both the palette specs (light/dark palettes can
differ in chroma, e.g. `src/spec/palettes.ts:102-106`) and the tone functions in
`ColorTokens` (e.g. `surface` is tone 6 in dark, 98 in light,
`src/spec/tokens.ts:95-107`), the two modes are computed independently. The
53 role names are identical, so `theme.light.primary` and `theme.dark.primary`
are always addressable the same way.

## Step 6: Resolve extraColors

Only if the caller passed `extraColors`:

```ts
// src/color.ts:386-389
if (options?.extraColors) {
	const extra = resolveCustomTokens(light, dark, color, options.extraColors);
	Object.assign(light, extra.light);
	Object.assign(dark, extra.dark);
}
```

`resolveCustomTokens` (`src/extend-theme.ts:114-159`) classifies each token:

- **Shared across modes** — plain hex strings, `{ harmonize }`, `{ random }`,
  and `{ gradient }` resolve once against the light palette and are merged into
  both modes (`src/extend-theme.ts:134-139`, `128-132`).
- **Per-mode** — `{ from: "primary" }` and `{ mix: [...] }` with palette keys
  resolve against the mode's own palette, so `theme.light.muted` and
  `theme.dark.muted` differ (`src/extend-theme.ts:140-142`).

Names are kebab-cased (`toKebabCase`, `src/extend-theme.ts:21-26`), and every
non-`on-*` token gets a generated foreground: `generateOn`
(`src/extend-theme.ts:28-32`) sets tone 10 if the base is >= 60, else 90,
guaranteeing a high-contrast companion. Both resolved objects are spread over
the palettes with `Object.assign`, and the finished `Theme` is returned
(`src/color.ts:392`).

## How contrast curves and tone deltas shape a role

The heart of the scheme layer is the tone solver in
`src/spec/color-calculation.ts:63-200`. It handles three cases in order:

1. **Tone-delta constraint (`toneDeltaPair`)** — e.g. `primary` must stay 5
   tones away from `primaryContainer`, with `'relative_lighter'` polarity and a
   `'farther'` constraint (`src/spec/tokens.ts:377-385`). Polarity is flipped by
   mode: `relative_lighter` means lighter in light mode, darker in dark mode
   (`src/spec/color-calculation.ts:72-77`). `constraint` can be `'exact'`,
   `'nearer'`, or `'farther'` (`src/scheme/tone-delta-pair.ts:25`).
2. **Contrast curve (`contrastCurve`)** — every foreground role targets a WCAG
   ratio against its background. `getCurve(4.5)` produces a `ContrastCurve` with
   per-contrast-level anchors `(4.5, 4.5, 7, 11)` (`src/spec/token-utils.ts:103-104`).
   If the current tone doesn't reach the ratio, `DynamicColor.foregroundTone`
   (`src/scheme/dynamic-color.ts:242-269`) searches lighter or darker using
   `Contrast.lighterUnsafe`/`darkerUnsafe` (`src/utils/contrast.ts:130-152`).
3. **Dual backgrounds** — when a color has both a `background` and a
   `secondBackground` (e.g. `onSurface` on two surfaces), the solver picks the
   option that clears the ratio against both (`src/spec/color-calculation.ts:162-198`).

The constant `tonePrefersLightForeground` (`src/scheme/dynamic-color.ts:282-284`)
encodes a real design finding — tones below 60 prefer light foregrounds — and
`enableLightForeground` snaps borderline tones to 49 so white text passes 4.5:1
(`src/scheme/dynamic-color.ts:298-306`).

## The fromImage path: image → quantize → score → palette

`Color.fromImage(image)` (`src/color-class.ts`) is the only async entry point.
It reduces an image to a single dominant color, then hands it to the same
`palette` pipeline described above.

```
Color.fromImage(img)
   color-class.ts     → sourceColorFromImage(img).then(Color.from)
        │
   science/image.ts:23-58   draws to a <canvas>, reads RGBA pixels
        │
   science/image.ts:66-86   skips non-opaque pixels → argbFromRgb per pixel
        │
   quantize/quantizer-celebi.ts:39-43
        │      new QuantizerWu().quantize(pixels, 128)      → 128-color map
        │      QuantizerWsmeans.quantize(pixels, wuResult)  → refined map
        ▼
   Map<argb, population>
        │
   science/score.ts:74-153   Score.score(map) ranks by usage + chroma
        │
        ▼
   ranked[0]  →  seed ARGB  →  fromNumber → "#744c9d"-style hex
        │
        ▼
   palette(seed, { variant: "expressive" })   (README.md:438-440)
```

Two details worth knowing:

- `QuantizerCelebi` is a two-stage quantizer: the **Wu** quantizer produces a
  good initial palette, and **Wsmeans** (weighted square-means k-means) refines
  it with that initialization instead of random centroids
  (`src/quantize/quantizer-celebi.ts:39-43`, rationale at
  `src/quantize/quantizer-celebi.ts:16-24`).
- `Score.score` (`src/science/score.ts:74-153`) is opinionated: it prefers
  chroma near 48 (the `TARGET_CHROMA` constant, `src/science/score.ts:54`),
  weights usage at 0.7 and chroma at 0.3/0.1 depending on whether it's above or
  below target, filters out near-gray and under-used hues, and finally spreads
  the top colors across distinct hues (90 down to 15 degrees apart). Its
  fallback is Google Blue `0xff4285f4` (`src/science/score.ts:32`). The
  "dominant color" is simply `ranked[0]` (`src/science/image.ts:83-85`).
