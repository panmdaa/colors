# Contributing to @panmdaa/colors

Thank you for considering contributing to `@panmdaa/colors`.

This library provides HCT color space utilities, Material Design 3 dynamic theme generation, and WCAG contrast tools — with zero dependencies. Contributions that improve correctness, performance, documentation, tests, and API clarity are welcome.

## Ways To Contribute

- reporting bugs or regressions in color calculations or theme generation
- improving documentation, README, or examples
- adding tests for edge cases in color space conversion, contrast, or palette generation
- optimizing HCT/CAM16 math or reducing GC pressure in hot paths
- proposing API improvements aligned with the project's design goals

## Before You Start

For small fixes, open a pull request directly.

For larger changes, open an issue first so we can align on scope, API design, and compatibility impact.

Changes that should usually be discussed first:

- new public exports or subpath imports
- changes to the CAM16 or HCT solver internals
- changes to DynamicColor resolution, contrast curves, or tone-delta pairs
- adding runtime dependencies
- breaking changes to palette or theme generation output

## Local Setup

```bash
npm install
```

Useful commands during development:

```bash
npm run typecheck
npm test
npm run bench
npm run build
npm run lint
npm run format
```

If you touch performance-sensitive code (HCT solver, palette generation, contrast utilities), run the benchmark suite to check for regressions:

```bash
npm run bench
```

If you are testing visual palette output:

```bash
npm run swatch
```

## Contribution Guidelines

- Use English for code, comments, issues, and pull requests.
- Keep the public API minimal and predictable.
- Zero dependencies is a hard constraint.
- Avoid breaking changes unless clearly justified and documented.
- Add or update tests when changing color math, scheme resolution, or public API behavior.
- Update documentation when public behavior or output changes.
- Preserve existing naming conventions and import patterns.

## Code Style

- Use strict TypeScript with explicit return types on public API functions.
- Prefer readable, explicit code over clever abstractions.
- Keep modules focused: HCT math, palette logic, scheme resolution, and utilities are separate concerns.
- Preserve the existing file structure: `src/hct/`, `src/palette/`, `src/scheme/`, `src/spec/`, `src/utils/`.
- Performance-sensitive paths (HCT solve, ARGB conversion, contrast ratio) should avoid unnecessary allocation.

## Pull Request Checklist

Before opening a PR, make sure:

- `npm run typecheck` passes
- `npm test` passes
- new behavior is covered by tests
- docs are updated when public API or behavior changes
- breaking changes or migration notes are called out clearly
- if performance-sensitive, benchmark results are included

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add HCT gradient interpolation
fix: correct tone ramp for yellow hues at tone 99
perf: cache resolved ARGB values in DynamicScheme
docs: document palette() custom color options
```

## Review Expectations

Reviews focus on:

- correctness of color math and scheme resolution
- API clarity and consistency
- backward compatibility
- documentation quality
- test coverage
- maintainability
- performance in hot paths

Feedback is meant to improve the project. Questions, iterations, and design discussion are welcome.

## Need Help?

If you are unsure whether an idea fits `@panmdaa/colors`, open an issue and describe:

- the use case
- the proposed API or behavior
- alternatives you considered
- compatibility or performance concerns
