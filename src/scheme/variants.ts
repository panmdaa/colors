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

import { DynamicScheme, Variant } from '.';
import { Hct } from '../hct';
import { TonalPalette } from '../palette';

/**
 * A scheme that places the source color in `Scheme.primaryContainer`.
 *
 * Primary Container is the source color, adjusted for color relativity.
 * It maintains constant appearance in light mode and dark mode.
 * This adds ~5 tone in light mode, and subtracts ~5 tone in dark mode.
 * Tertiary Container is the complement to the source color, using
 * `TemperatureCache`. It also maintains constant appearance.
 */
export class SchemeContent extends DynamicScheme {
	constructor(
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorHcts: Hct[],
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number
	) {
		super({
			sourceColorHcts: Array.isArray(sourceColorOrList)
				? sourceColorOrList
				: [sourceColorOrList],
			variant: Variant.CONTENT,
			contrastLevel,
			isDark
		});
	}
}

/**
 * A Dynamic Color theme that is intentionally detached from the source color.
 */
export class SchemeExpressive extends DynamicScheme {
	constructor(
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorHcts: Hct[],
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number
	) {
		super({
			sourceColorHcts: Array.isArray(sourceColorOrList)
				? sourceColorOrList
				: [sourceColorOrList],
			variant: Variant.EXPRESSIVE,
			contrastLevel,
			isDark
		});
	}
}

/**
 * A scheme that places the source color in `Scheme.primaryContainer`.
 *
 * Primary Container is the source color, adjusted for color relativity.
 * It maintains constant appearance in light mode and dark mode.
 * This adds ~5 tone in light mode, and subtracts ~5 tone in dark mode.
 * Tertiary Container is the complement to the source color, using
 * `TemperatureCache`. It also maintains constant appearance.
 */
export class SchemeFidelity extends DynamicScheme {
	constructor(
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorHcts: Hct[],
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number
	) {
		super({
			sourceColorHcts: Array.isArray(sourceColorOrList)
				? sourceColorOrList
				: [sourceColorOrList],
			variant: Variant.FIDELITY,
			contrastLevel,
			isDark
		});
	}
}

/**
 * A playful theme - the source color's hue does not appear in the theme.
 */
export class SchemeFruitSalad extends DynamicScheme {
	constructor(
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorHcts: Hct[],
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number
	) {
		super({
			sourceColorHcts: Array.isArray(sourceColorOrList)
				? sourceColorOrList
				: [sourceColorOrList],
			variant: Variant.FRUIT_SALAD,
			contrastLevel,
			isDark
		});
	}
}

/** A Dynamic Color theme that is grayscale. */
export class SchemeMonochrome extends DynamicScheme {
	constructor(
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorHcts: Hct[],
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number
	) {
		super({
			sourceColorHcts: Array.isArray(sourceColorOrList)
				? sourceColorOrList
				: [sourceColorOrList],
			variant: Variant.MONOCHROME,
			contrastLevel,
			isDark
		});
	}
}

/** A Dynamic Color theme that is near grayscale. */
export class SchemeNeutral extends DynamicScheme {
	constructor(
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorHcts: Hct[],
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number
	) {
		super({
			sourceColorHcts: Array.isArray(sourceColorOrList)
				? sourceColorOrList
				: [sourceColorOrList],
			variant: Variant.NEUTRAL,
			contrastLevel,
			isDark
		});
	}
}

/**
 * A playful theme - the source color's hue does not appear in the theme.
 */
export class SchemeRainbow extends DynamicScheme {
	constructor(
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorHcts: Hct[],
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number
	) {
		super({
			sourceColorHcts: Array.isArray(sourceColorOrList)
				? sourceColorOrList
				: [sourceColorOrList],
			variant: Variant.RAINBOW,
			contrastLevel,
			isDark
		});
	}
}

/**
 * A Dynamic Color theme with low to medium colorfulness and a Tertiary
 * TonalPalette with a hue related to the source color.
 *
 * The default Material You theme on Android 12 and 13.
 */
export class SchemeTonalSpot extends DynamicScheme {
	constructor(
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorHcts: Hct[],
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number
	) {
		super({
			sourceColorHcts: Array.isArray(sourceColorOrList)
				? sourceColorOrList
				: [sourceColorOrList],
			variant: Variant.TONAL_SPOT,
			contrastLevel,
			isDark
		});
	}
}

/**
 * A Dynamic Color theme that maxes out colorfulness at each position in the
 * Primary Tonal Palette.
 */
export class SchemeVibrant extends DynamicScheme {
	constructor(
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorHcts: Hct[],
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number
	) {
		super({
			sourceColorHcts: Array.isArray(sourceColorOrList)
				? sourceColorOrList
				: [sourceColorOrList],
			variant: Variant.VIBRANT,
			contrastLevel,
			isDark
		});
	}
}

/**
 * A Dynamic Color theme with 2 source colors.
 */
export class SchemeCmf extends DynamicScheme {
	constructor(
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorHcts: Hct[],
		isDark: boolean,
		contrastLevel: number
	);
	constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number
	) {
		const isArray = Array.isArray(sourceColorOrList);
		const sourceColorHct =
			(isArray ? sourceColorOrList[0] : sourceColorOrList) ?? Hct.fromInt(0);
		const extraSourceColorsHct = isArray ? sourceColorOrList.slice(1) : [];

		const secondarySourceColorHct = extraSourceColorsHct[0] ?? sourceColorHct;

		const primaryPalette = TonalPalette.fromHueAndChroma(
			sourceColorHct.hue,
			sourceColorHct.chroma
		);
		const secondaryPalette = TonalPalette.fromHueAndChroma(
			sourceColorHct.hue,
			sourceColorHct.chroma * 0.5
		);
		const tertiaryPalette =
			sourceColorHct.toInt() === secondarySourceColorHct.toInt()
				? TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma * 0.75)
				: TonalPalette.fromHueAndChroma(
						secondarySourceColorHct.hue,
						secondarySourceColorHct.chroma
					);
		const neutralPalette = TonalPalette.fromHueAndChroma(
			sourceColorHct.hue,
			sourceColorHct.chroma * 0.2
		);
		const neutralVariantPalette = TonalPalette.fromHueAndChroma(
			sourceColorHct.hue,
			sourceColorHct.chroma * 0.2
		);
		const errorPalette = TonalPalette.fromHueAndChroma(
			SchemeCmf.getErrorHue(sourceColorHct.hue, secondarySourceColorHct.hue),
			Math.max(sourceColorHct.chroma, 50.0)
		);
		super({
			sourceColorHcts: isArray ? sourceColorOrList : [sourceColorOrList],
			variant: Variant.CMF,
			contrastLevel,
			isDark,
			primaryPalette,
			secondaryPalette,
			tertiaryPalette,
			neutralPalette,
			neutralVariantPalette,
			errorPalette
		});
	}

	static getErrorHue(primaryHue: number, tertiaryHue: number): number {
		if (primaryHue <= 8) {
			return tertiaryHue <= 24 ? 28 : tertiaryHue <= 32 ? 16 : 20;
		} else if (primaryHue <= 16) {
			return tertiaryHue <= 24 ? 32 : tertiaryHue <= 32 ? 20 : 24;
		} else if (primaryHue <= 20) {
			return tertiaryHue <= 28 ? 32 : tertiaryHue <= 32 ? 24 : 28;
		} else if (primaryHue <= 28) {
			return tertiaryHue <= 24 ? 32 : 16;
		} else if (primaryHue <= 32) {
			return tertiaryHue <= 20 ? 24 : tertiaryHue <= 28 ? 16 : 20;
		} else if (primaryHue <= 40) {
			return tertiaryHue > 20 && tertiaryHue <= 28 ? 16 : 24;
		} else if (primaryHue <= 152) {
			return tertiaryHue > 24 && tertiaryHue <= 36 ? 20 : 32;
		} else if (primaryHue <= 272) {
			return tertiaryHue > 20 && tertiaryHue <= 28 ? 16 : 24;
		} else {
			return tertiaryHue > 12 && tertiaryHue <= 28 ? 32 : 16;
		}
	}
}
