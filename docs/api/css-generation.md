# CSS Generation

- [Two functions](#two-functions)
- [`generateCSS`](#generatecss)
- [`generateCSSSheet`](#generatecsssheet)
- [Custom property naming](#custom-property-naming)
- [The dark theme block](#the-dark-theme-block)
- [Custom selectors](#custom-selectors)
- [How extraColors tokens flow into CSS](#how-extracolors-tokens-flow-into-css)

## Two functions

The library exposes two pure string formatters for turning palettes into CSS.
Neither touches the DOM and neither does any color math — both are thin loops
over a palette object.

- **`generateCSS`** (`css-props.ts:19`) — flat list of custom-property
  declarations for a single palette.
- **`generateCSSSheet`** (`css-sheet.ts:33`) — a complete stylesheet wrapping
  the same declarations in light and dark blocks.

## `generateCSS`

```ts
export interface GenerateCSSOptions {
  prefix?: string;
  transform?: (role: string, value: ColorValue) => string;
}

export function generateCSS(palette: Palette, options?: GenerateCSSOptions): string {
  const { prefix = "--color-", transform } = options ?? {};
  return Object.entries(palette)
    .map(([role, value]) => {
      if (transform) return transform(role, value);
      return `${prefix}${role}: ${value};`;
    })
    .join("\n");
}
```

Given a light or dark palette it emits one `--color-{role}: {value};` line per
token. The optional `transform` callback replaces the default formatting for
the whole output — useful for emitting SCSS variables, `@layer` blocks, or
`color-mix()` expressions instead of plain custom properties.

## `generateCSSSheet`

```ts
export interface GenerateCSSSheetOptions {
  prefix?: string;
  lightSelector?: string;
  darkSelector?: string;
}

export function generateCSSSheet(
  theme: { light: Record<string, ColorValue>; dark: Record<string, ColorValue> },
  options?: GenerateCSSSheetOptions,
): string {
  const prefix = options?.prefix ?? "--color-";
  const lightSelector = options?.lightSelector ?? ":root";
  const darkSelector = options?.darkSelector ?? "@media (prefers-color-scheme: dark)";
  // ...
}
```

It accepts a full theme (the exact `{ light, dark }` shape `palette()`
returns), and composes three blocks:

1. a light block under `lightSelector`;
2. a dark block under `darkSelector`;
3. when `darkSelector` is a media query (starts with `@`, checked at
   `css-sheet.ts:52`), the dark declarations are **nested inside the media
   query, inside the light selector** (`css-sheet.ts:53-59`):

```ts
const isMediaQuery = darkSelector.startsWith("@");
if (isMediaQuery) {
  lines.push("");
  lines.push(`${darkSelector} {`);
  lines.push(`\t${lightSelector} {`);
  lines.push(props(theme.dark).replace(/\t/g, "\t\t"));
  lines.push("\t}");
  lines.push("}");
}
```

The output for the default options looks like this (real output for
`palette('#6750a4')`):

```css
:root {
	--color-primary: #5b4497;
	--color-primary-dim: #4f378b;
	--color-on-primary: #eadeff;
	--color-primary-container: #6750a4;
	/* ... */
}

@media (prefers-color-scheme: dark) {
	:root {
		--color-primary: #ab99d8;
		/* ... */
	}
}
```

The `replace(/\t/g, "\t\t")` at `css-sheet.ts:57` indents the nested dark
properties by an extra tab so the generated file stays readable.

## Custom property naming

Both functions default to the `--color-` prefix: a role named `primary`
becomes `--color-primary`, and `on-primary-container` becomes
`--color-on-primary-container`. The prefix is fully configurable through the
`prefix` option — the docstring in `css-sheet.ts:25-31` shows the common
Material-prefixed variant:

```ts
const css = generateCSSSheet(theme, {
  prefix: '--md-sys-color-',
  darkSelector: '[data-theme="dark"]',
});
```

## The dark theme block

The default `darkSelector` is the `@media (prefers-color-scheme: dark)` media
query (`css-sheet.ts:39`), which follows the user's OS preference. The
`@`-prefix check at `css-sheet.ts:52` is what decides between the two output
shapes:

- selector string starting with `@` → treated as a media query → the dark block
  wraps the light selector (`css-sheet.ts:53-59`);
- any other selector → a plain block like `[data-theme="dark"] { ... }`
  (`css-sheet.ts:60-65`).

Because a media query is not a selector, the dark properties must target
`:root` again; a plain selector can hold them directly.

## How extraColors tokens flow into CSS

`extraColors` tokens are merged into `theme.light` and `theme.dark` by
`palette()` (`color.ts:386-390`) *before* any CSS generation runs. As far as
`generateCSS` / `generateCSSSheet` are concerned they are just more entries in
the palette record, so they are emitted with the exact same naming rule:

```ts
// palette('#6750a4', { extraColors: { brand: '#ff5500' } })
// light & dark palettes now contain: brand: '#ff5500', on-brand: '#ffdbcf'
generateCSSSheet(theme, { prefix: '--color-' });
// → --color-brand: #ff5500;  and  --color-on-brand: #ffdbcf;
```

Two subtleties follow from the resolver (see [palette.md](./palette.md) for the
full rules):

- **Gradient tokens expand into multiple properties.** A `gradient` token with
  `count: 4` produces `--color-{name}-0` through `--color-{name}-3` plus their
  `on-` companions (`extend-theme.ts:172-179`), all in the CSS output.
- **Mode-independent tokens are shared.** Tokens resolved once (plain hex,
  `harmonize`, `random`) appear with the *same value* in the light and dark
  blocks, because `resolveCustomTokens` returns the shared value for both
  (`extend-theme.ts:156-157`). Mode-dependent tokens (`from`/`adjust`/`mix`)
  get distinct light and dark values.
