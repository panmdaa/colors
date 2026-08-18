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
 * A Dynamic Color theme that is intentionally detached from the source color.
 */
export class SchemeExpressive extends VariantScheme {
	constructor(sourceColorHct: Hct, isDark: boolean, contrastLevel: number);
	constructor(sourceColorHcts: Hct[], isDark: boolean, contrastLevel: number);
	constructor(sourceColorOrList: Hct | Hct[], isDark: boolean, contrastLevel: number) {
		super(sourceColorOrList, isDark, contrastLevel, Variant.EXPRESSIVE);
	}

	static override primaryPalette(sourceColorOrList: Hct | Hct[], isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, isDark ? 36 : 48);
	}

	static override secondaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			DynamicScheme.getRotatedHue(
				sourceColorHct,
				[0, 105, 140, 204, 253, 278, 300, 333, 360],
				[-160, 155, -100, 96, -96, -156, -165, -160]
			),
			24
		);
	}

	static override tertiaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			DynamicScheme.getRotatedHue(
				sourceColorHct,
				[0, 105, 140, 204, 253, 278, 300, 333, 360],
				[-165, 160, -105, 101, -101, -160, -170, -165]
			),
			48
		);
	}

	static override neutralPalette(sourceColorOrList: Hct | Hct[], isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const expressiveNeutralHue = DynamicScheme.getRotatedHue(
			sourceColorHct,
			[0, 71, 124, 253, 278, 300, 360],
			[10, 0, 10, 0, 10, 0]
		);
		const expressiveNeutralChroma = isDark ? (Hct.isYellow(expressiveNeutralHue) ? 6 : 14) : 18;
		return TonalPalette.fromHueAndChroma(expressiveNeutralHue, expressiveNeutralChroma);
	}

	static override neutralVariantPalette(sourceColorOrList: Hct | Hct[], isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const expressiveNeutralHue = DynamicScheme.getRotatedHue(
			sourceColorHct,
			[0, 71, 124, 253, 278, 300, 360],
			[10, 0, 10, 0, 10, 0]
		);
		const expressiveNeutralChroma = isDark ? (Hct.isYellow(expressiveNeutralHue) ? 6 : 14) : 18;
		return TonalPalette.fromHueAndChroma(
			expressiveNeutralHue,
			expressiveNeutralChroma * (expressiveNeutralHue >= 105 && expressiveNeutralHue < 125 ? 1.6 : 2.3)
		);
	}

	static override errorPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			DynamicScheme.getPiecewiseHue(
				sourceColorHct,
				[0, 3, 13, 23, 33, 43, 153, 273, 360],
				[12, 22, 32, 12, 22, 32, 22, 12]
			),
			64
		);
	}
}
