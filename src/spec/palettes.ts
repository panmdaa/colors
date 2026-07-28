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

import { DislikeAnalyzer } from '../science/dislike-analyzer';
import { Hct } from '../hct';
import { TonalPalette } from '../palette';
import { TemperatureCache } from '../science/temperature';
import { sanitizeDegreesDouble } from '../utils';

import { DynamicScheme } from '../scheme/dynamic-scheme';
import { Variant } from '../scheme/variant';

/**
 * A delegate that provides the palettes of a DynamicScheme.
 */
interface PaletteTokensDelegate {
	getPrimaryPalette: (
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	) => TonalPalette;

	getSecondaryPalette: (
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	) => TonalPalette;

	getTertiaryPalette: (
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	) => TonalPalette;

	getNeutralPalette: (
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	) => TonalPalette;

	getNeutralVariantPalette: (
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	) => TonalPalette;

	getErrorPalette: (
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		contrastLevel: number
	) => TonalPalette | undefined;
}

/**
 * Calculates palette tonal palettes for a DynamicScheme.
 */
export class PaletteTokens implements PaletteTokensDelegate {
	//////////////////////////////////////////////////////////////////
	// Scheme Palettes                                              //
	//////////////////////////////////////////////////////////////////

	getPrimaryPalette(
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		_contrastLevel: number
	): TonalPalette {
		switch (variant) {
			case Variant.CONTENT:
			case Variant.FIDELITY:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma);
			case Variant.FRUIT_SALAD:
				return TonalPalette.fromHueAndChroma(
					sanitizeDegreesDouble(sourceColorHct.hue - 50.0),
					48.0
				);
			case Variant.MONOCHROME:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
			case Variant.NEUTRAL:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					Hct.isBlue(sourceColorHct.hue)
						? 12
						: 8
				);
			case Variant.RAINBOW:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 48.0);
			case Variant.TONAL_SPOT:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					isDark ? 26 : 32
				);
			case Variant.EXPRESSIVE:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					isDark ? 36 : 48
				);
			case Variant.VIBRANT:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					74
				);
			case Variant.CMF:
				throw new Error(`Unsupported variant: ${String(variant)}`);
			default:
				throw new Error(`Unsupported variant: ${String(variant)}`);
		}
	}

	getSecondaryPalette(
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		_contrastLevel: number
	): TonalPalette {
		switch (variant) {
			case Variant.CONTENT:
			case Variant.FIDELITY:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					Math.max(sourceColorHct.chroma - 32.0, sourceColorHct.chroma * 0.5)
				);
			case Variant.FRUIT_SALAD:
				return TonalPalette.fromHueAndChroma(
					sanitizeDegreesDouble(sourceColorHct.hue - 50.0),
					36.0
				);
			case Variant.MONOCHROME:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
			case Variant.NEUTRAL:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					Hct.isBlue(sourceColorHct.hue)
						? 6
						: 4
				);
			case Variant.RAINBOW:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16.0);
			case Variant.TONAL_SPOT:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16);
			case Variant.EXPRESSIVE:
				return TonalPalette.fromHueAndChroma(
					DynamicScheme.getRotatedHue(
						sourceColorHct,
						[0, 105, 140, 204, 253, 278, 300, 333, 360],
						[-160, 155, -100, 96, -96, -156, -165, -160]
					),
					isDark ? 16 : 24
				);
			case Variant.VIBRANT:
				return TonalPalette.fromHueAndChroma(
					DynamicScheme.getRotatedHue(
						sourceColorHct,
						[0, 38, 105, 140, 333, 360],
						[-14, 10, -14, 10, -14]
					),
					56
				);
			case Variant.CMF:
				throw new Error(`Unsupported variant: ${String(variant)}`);
			default:
				throw new Error(`Unsupported variant: ${String(variant)}`);
		}
	}

	getTertiaryPalette(
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		_contrastLevel: number
	): TonalPalette {
		switch (variant) {
			case Variant.CONTENT:
				return TonalPalette.fromHct(
					DislikeAnalyzer.fixIfDisliked(
						new TemperatureCache(sourceColorHct).analogous(
							/* count= */ 3,
							/* divisions= */ 6
						)[2]!
					)
				);
			case Variant.FIDELITY:
				return TonalPalette.fromHct(
					DislikeAnalyzer.fixIfDisliked(new TemperatureCache(sourceColorHct).complement)
				);
			case Variant.FRUIT_SALAD:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 36.0);
			case Variant.MONOCHROME:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
			case Variant.NEUTRAL:
				return TonalPalette.fromHueAndChroma(
					DynamicScheme.getRotatedHue(
						sourceColorHct,
						[0, 38, 105, 161, 204, 278, 333, 360],
						[-32, 26, 10, -39, 24, -15, -32]
					),
					20
				);
			case Variant.RAINBOW:
			case Variant.TONAL_SPOT:
				return TonalPalette.fromHueAndChroma(
					DynamicScheme.getRotatedHue(
						sourceColorHct,
						[0, 20, 71, 161, 333, 360],
						[-40, 48, -32, 40, -32]
					),
					28
				);
			case Variant.EXPRESSIVE:
				return TonalPalette.fromHueAndChroma(
					DynamicScheme.getRotatedHue(
						sourceColorHct,
						[0, 105, 140, 204, 253, 278, 300, 333, 360],
						[-165, 160, -105, 101, -101, -160, -170, -165]
					),
					48
				);
			case Variant.VIBRANT:
				return TonalPalette.fromHueAndChroma(
					DynamicScheme.getRotatedHue(
						sourceColorHct,
						[0, 38, 71, 105, 140, 161, 253, 333, 360],
						[-72, 35, 24, -24, 62, 50, 62, -72]
					),
					56
				);
			case Variant.CMF:
				throw new Error(`Unsupported variant: ${String(variant)}`);
			default:
				throw new Error(`Unsupported variant: ${String(variant)}`);
		}
	}

	getNeutralPalette(
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		_contrastLevel: number
	): TonalPalette {
		switch (variant) {
			case Variant.CONTENT:
			case Variant.FIDELITY:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					sourceColorHct.chroma / 8.0
				);
			case Variant.FRUIT_SALAD:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 10.0);
			case Variant.MONOCHROME:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
			case Variant.NEUTRAL:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					1.4
				);
			case Variant.RAINBOW:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
			case Variant.TONAL_SPOT:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					5
				);
			case Variant.EXPRESSIVE:
				return TonalPalette.fromHueAndChroma(
					PaletteTokens.getExpressiveNeutralHue(sourceColorHct),
					PaletteTokens.getExpressiveNeutralChroma(sourceColorHct, isDark)
				);
			case Variant.VIBRANT:
				return TonalPalette.fromHueAndChroma(
					PaletteTokens.getVibrantNeutralHue(sourceColorHct),
					PaletteTokens.getVibrantNeutralChroma(sourceColorHct)
				);
			case Variant.CMF:
				throw new Error(`Unsupported variant: ${String(variant)}`);
			default:
				throw new Error(`Unsupported variant: ${String(variant)}`);
		}
	}

	private static getExpressiveNeutralHue(sourceColorHct: Hct): number {
		return DynamicScheme.getRotatedHue(
			sourceColorHct,
			[0, 71, 124, 253, 278, 300, 360],
			[10, 0, 10, 0, 10, 0]
		);
	}

	private static getExpressiveNeutralChroma(
		sourceColorHct: Hct,
		isDark: boolean
	): number {
		const neutralHue = PaletteTokens.getExpressiveNeutralHue(sourceColorHct);
		return isDark ? (Hct.isYellow(neutralHue) ? 6 : 14) : 18;
	}

	private static getVibrantNeutralHue(sourceColorHct: Hct): number {
		return DynamicScheme.getRotatedHue(
			sourceColorHct,
			[0, 38, 105, 140, 333, 360],
			[-14, 10, -14, 10, -14]
		);
	}

	private static getVibrantNeutralChroma(sourceColorHct: Hct): number {
		const neutralHue = PaletteTokens.getVibrantNeutralHue(sourceColorHct);
		return 28;
	}

	getNeutralVariantPalette(
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		_contrastLevel: number
	): TonalPalette {
		switch (variant) {
			case Variant.CONTENT:
			case Variant.FIDELITY:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					sourceColorHct.chroma / 8.0 + 4.0
				);
			case Variant.FRUIT_SALAD:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16.0);
			case Variant.MONOCHROME:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
			case Variant.NEUTRAL:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					1.4 * 2.2
				);
			case Variant.RAINBOW:
				return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
			case Variant.TONAL_SPOT:
				return TonalPalette.fromHueAndChroma(
					sourceColorHct.hue,
					5 * 1.7
				);
			case Variant.EXPRESSIVE: {
				const expressiveNeutralHue = PaletteTokens.getExpressiveNeutralHue(sourceColorHct);
				const expressiveNeutralChroma = PaletteTokens.getExpressiveNeutralChroma(
					sourceColorHct,
					isDark
				);
				return TonalPalette.fromHueAndChroma(
					expressiveNeutralHue,
					expressiveNeutralChroma *
						(expressiveNeutralHue >= 105 && expressiveNeutralHue < 125 ? 1.6 : 2.3)
				);
			}
			case Variant.VIBRANT: {
				const vibrantNeutralHue = PaletteTokens.getVibrantNeutralHue(sourceColorHct);
				const vibrantNeutralChroma = PaletteTokens.getVibrantNeutralChroma(
					sourceColorHct
				);
				return TonalPalette.fromHueAndChroma(
					vibrantNeutralHue,
					vibrantNeutralChroma * 1.29
				);
			}
			case Variant.CMF:
				throw new Error(`Unsupported variant: ${String(variant)}`);
			default:
				throw new Error(`Unsupported variant: ${String(variant)}`);
		}
	}

	getErrorPalette(
		variant: Variant,
		sourceColorHct: Hct,
		isDark: boolean,
		_contrastLevel: number
	): TonalPalette | undefined {
		const errorHue = DynamicScheme.getPiecewiseHue(
			sourceColorHct,
			[0, 3, 13, 23, 33, 43, 153, 273, 360],
			[12, 22, 32, 12, 22, 32, 22, 12]
		);
		switch (variant) {
			case Variant.NEUTRAL:
				return TonalPalette.fromHueAndChroma(errorHue, 50);
			case Variant.TONAL_SPOT:
				return TonalPalette.fromHueAndChroma(errorHue, 60);
			case Variant.EXPRESSIVE:
				return TonalPalette.fromHueAndChroma(errorHue, 64);
			case Variant.VIBRANT:
				return TonalPalette.fromHueAndChroma(errorHue, 80);
			default:
				return undefined;
		}
	}
}

const spec2025 = new PaletteTokens();

export function getSpec(): PaletteTokens {
	return spec2025;
}
