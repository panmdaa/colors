/**
 * @license
 * Copyright 2021 Google LLC
 * Copyright 2026 Panmdaa
 *
 * Derived from Material Color Utilities.
 * Modified and maintained by the Panmdaa project.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Color } from "../color-class";
import { resolveCustomTokens } from "../extend-theme";
import type { ColorValue, Palette, Theme, Variant, CustomTokenOptions } from "../types";
import { hexFromArgb } from "../utils";
import { createVariantScheme } from "../variants";

function toHex(argb: number): ColorValue {
	return hexFromArgb(argb) as ColorValue;
}

export type ExtraPalette<T extends Record<string, ColorValue | CustomTokenOptions>> = {
	[K in keyof T & string]: ColorValue;
} & {
	[K in keyof T & string as K extends `on-${string}` ? never : `on-${K}`]: ColorValue;
};

export function palette<
	T extends Record<string, ColorValue | CustomTokenOptions> = Record<string, never>,
>(
	color: ColorValue,
	options?: { variant?: Variant; contrastLevel?: number; extraColors?: T },
): Theme & {
	light: Palette & ExtraPalette<T> & Record<string, ColorValue>;
	dark: Palette & ExtraPalette<T> & Record<string, ColorValue>;
} {
	const variant = options?.variant ?? "expressive";
	const contrastLevel = options?.contrastLevel ?? 0;
	const source = Color.hct(color);
	const light = generateColorPalette(source, variant, false, contrastLevel);
	const dark = generateColorPalette(source, variant, true, contrastLevel);

	if (options?.extraColors) {
		const extra = resolveCustomTokens(light, dark, color, options.extraColors);
		Object.assign(light, extra.light);
		Object.assign(dark, extra.dark);
	}

	return { color, light, dark } as any;
}

function generateColorPalette(
	source: ReturnType<typeof Color.hct>,
	variant: Variant,
	dark: boolean,
	contrastLevel: number,
): Palette {
	const scheme = createVariantScheme(source, variant, dark, contrastLevel);

	return {
		primary: toHex(scheme.primary),
		"primary-dim": toHex(scheme.primaryDim),
		"on-primary": toHex(scheme.onPrimary),
		"primary-container": toHex(scheme.primaryContainer),
		"on-primary-container": toHex(scheme.onPrimaryContainer),
		"primary-fixed": toHex(scheme.primaryFixed),
		"primary-fixed-dim": toHex(scheme.primaryFixedDim),
		"on-primary-fixed": toHex(scheme.onPrimaryFixed),
		"on-primary-fixed-variant": toHex(scheme.onPrimaryFixedVariant),
		secondary: toHex(scheme.secondary),
		"secondary-dim": toHex(scheme.secondaryDim),
		"on-secondary": toHex(scheme.onSecondary),
		"secondary-container": toHex(scheme.secondaryContainer),
		"on-secondary-container": toHex(scheme.onSecondaryContainer),
		"secondary-fixed": toHex(scheme.secondaryFixed),
		"secondary-fixed-dim": toHex(scheme.secondaryFixedDim),
		"on-secondary-fixed": toHex(scheme.onSecondaryFixed),
		"on-secondary-fixed-variant": toHex(scheme.onSecondaryFixedVariant),
		tertiary: toHex(scheme.tertiary),
		"tertiary-dim": toHex(scheme.tertiaryDim),
		"on-tertiary": toHex(scheme.onTertiary),
		"tertiary-container": toHex(scheme.tertiaryContainer),
		"on-tertiary-container": toHex(scheme.onTertiaryContainer),
		"tertiary-fixed": toHex(scheme.tertiaryFixed),
		"tertiary-fixed-dim": toHex(scheme.tertiaryFixedDim),
		"on-tertiary-fixed": toHex(scheme.onTertiaryFixed),
		"on-tertiary-fixed-variant": toHex(scheme.onTertiaryFixedVariant),
		error: toHex(scheme.error),
		"error-dim": toHex(scheme.errorDim),
		"on-error": toHex(scheme.onError),
		"error-container": toHex(scheme.errorContainer),
		"on-error-container": toHex(scheme.onErrorContainer),
		background: toHex(scheme.background),
		"on-background": toHex(scheme.onBackground),
		surface: toHex(scheme.surface),
		"surface-dim": toHex(scheme.surfaceDim),
		"surface-bright": toHex(scheme.surfaceBright),
		"surface-container-lowest": toHex(scheme.surfaceContainerLowest),
		"surface-container-low": toHex(scheme.surfaceContainerLow),
		"surface-container": toHex(scheme.surfaceContainer),
		"surface-container-high": toHex(scheme.surfaceContainerHigh),
		"surface-container-highest": toHex(scheme.surfaceContainerHighest),
		"surface-variant": toHex(scheme.surfaceVariant),
		"on-surface": toHex(scheme.onSurface),
		"on-surface-variant": toHex(scheme.onSurfaceVariant),
		outline: toHex(scheme.outline),
		"outline-variant": toHex(scheme.outlineVariant),
		shadow: toHex(scheme.shadow),
		scrim: toHex(scheme.scrim),
		"surface-tint": toHex(scheme.surfaceTint),
		"inverse-surface": toHex(scheme.inverseSurface),
		"inverse-on-surface": toHex(scheme.inverseOnSurface),
		"inverse-primary": toHex(scheme.inversePrimary),
	};
}
