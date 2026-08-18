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

import { Hct } from '../hct';
import { TonalPalette } from '../palette';
import { DynamicScheme } from '../scheme/dynamic-scheme';
import { Variant } from '../scheme/variant';
import { VariantScheme, firstSourceColor } from './variant-scheme';

/**
 * A Dynamic Color theme that maxes out colorfulness at each position in the
 * Primary Tonal Palette.
 */
export class SchemeVibrant extends VariantScheme {
	constructor(sourceColorHct: Hct, isDark: boolean, contrastLevel: number);
	constructor(sourceColorHcts: Hct[], isDark: boolean, contrastLevel: number);
	constructor(sourceColorOrList: Hct | Hct[], isDark: boolean, contrastLevel: number) {
		super(sourceColorOrList, isDark, contrastLevel, Variant.VIBRANT);
	}

	static override primaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 74);
	}

	static override secondaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			DynamicScheme.getRotatedHue(
				sourceColorHct,
				[0, 38, 105, 140, 333, 360],
				[-14, 10, -14, 10, -14]
			),
			56
		);
	}

	static override tertiaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			DynamicScheme.getRotatedHue(
				sourceColorHct,
				[0, 38, 71, 105, 140, 161, 253, 333, 360],
				[-72, 35, 24, -24, 62, 50, 62, -72]
			),
			56
		);
	}

	static override neutralPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const vibrantNeutralHue = DynamicScheme.getRotatedHue(
			sourceColorHct,
			[0, 38, 105, 140, 333, 360],
			[-14, 10, -14, 10, -14]
		);
		return TonalPalette.fromHueAndChroma(vibrantNeutralHue, 28);
	}

	static override neutralVariantPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const vibrantNeutralHue = DynamicScheme.getRotatedHue(
			sourceColorHct,
			[0, 38, 105, 140, 333, 360],
			[-14, 10, -14, 10, -14]
		);
		return TonalPalette.fromHueAndChroma(vibrantNeutralHue, 28 * 1.29);
	}

	static override errorPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			DynamicScheme.getPiecewiseHue(
				sourceColorHct,
				[0, 3, 13, 23, 33, 43, 153, 273, 360],
				[12, 22, 32, 12, 22, 32, 22, 12]
			),
			80
		);
	}
}
