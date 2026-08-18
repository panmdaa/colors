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

/** A warmer theme that nudges hues toward reds and oranges. */
export class SchemeWarm extends VariantScheme {
	constructor(sourceColorHct: Hct, isDark: boolean, contrastLevel: number);
	constructor(sourceColorHcts: Hct[], isDark: boolean, contrastLevel: number);
	constructor(sourceColorOrList: Hct | Hct[], isDark: boolean, contrastLevel: number) {
		super(sourceColorOrList, isDark, contrastLevel, Variant.EXPRESSIVE);
	}

	static override primaryPalette(sourceColorOrList: Hct | Hct[], isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const primaryHue = DynamicScheme.getRotatedHue(sourceColorHct, [0, 90, 270, 360], [-14, 12, -10]);
		return TonalPalette.fromHueAndChroma(primaryHue, isDark ? 30 : 36);
	}

	static override secondaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const secondaryHue = DynamicScheme.getRotatedHue(sourceColorHct, [0, 120, 240, 360], [-24, -10, -18]);
		return TonalPalette.fromHueAndChroma(secondaryHue, 18);
	}

	static override tertiaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const tertiaryHue = DynamicScheme.getRotatedHue(sourceColorHct, [0, 120, 240, 360], [24, 14, 18]);
		return TonalPalette.fromHueAndChroma(tertiaryHue, 28);
	}

	static override neutralPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const neutralHue = DynamicScheme.getRotatedHue(sourceColorHct, [0, 180, 360], [-8, -6]);
		return TonalPalette.fromHueAndChroma(neutralHue, 3);
	}

	static override neutralVariantPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const neutralHue = DynamicScheme.getRotatedHue(sourceColorHct, [0, 180, 360], [-8, -6]);
		return TonalPalette.fromHueAndChroma(neutralHue, 5.5);
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
