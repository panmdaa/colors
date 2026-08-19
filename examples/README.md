# Examples

Runnable examples that show how to use `@panmdaa/colors` the same way you
would in a real project: every file imports from the published package path
(`@panmdaa/colors`) and covers a concrete use case.

## Structure

```
examples/
├── theme/
│   ├── generate-theme.ts    Generate light + dark themes, variants, contrast level
│   ├── custom-tokens.ts     Extend a theme with custom tokens (extraColors)
│   └── custom-variant.ts    Create a custom variant by extending VariantScheme
├── css/
│   └── generate-css.ts      Generate CSS custom properties / stylesheets
├── color/
│   └── color-workshop.ts    The Color class: channels, edits, mix, gradients
├── accessibility/
│   └── audit-palette.ts     WCAG reports, contrast scoring, CVD simulation
└── image/
    ├── index.html           Browser demo: theme from an uploaded image
    └── main.ts              Color.fromImage -> palette -> CSS variables
```

## Prerequisites

Install the library the same way a consuming project would:

```sh
npm install @panmdaa/colors
```

When running the examples inside this repository, the package is resolved
through the local `node_modules` link. The `dist/` output must exist, so
build the library first if it has not been built yet:

```sh
npm run build
```

## Running

Use `tsx` to run a CLI example directly (tsx is available in the root
`node_modules`):

```sh
npx tsx examples/theme/generate-theme.ts
npx tsx examples/theme/custom-tokens.ts
npx tsx examples/theme/custom-variant.ts
npx tsx examples/css/generate-css.ts
npx tsx examples/color/color-workshop.ts
npx tsx examples/accessibility/audit-palette.ts
```

The CSS example writes the generated stylesheet to
`examples/css/output/theme.css`.

## Browser example

`examples/image/` is an end-to-end browser demo: upload an image, extract its
dominant color as the theme seed, and apply the generated light/dark theme as
CSS variables. The imports of `@panmdaa/colors` must be resolved by a bundler
(Vite, esbuild, ...); it will not work as a plain script tag.
