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

/** A Dynamic Color theme that is near grayscale. */
export class SchemeNeutral extends VariantScheme {
	constructor(sourceColorHct: Hct, isDark: boolean, contrastLevel: number);
	constructor(sourceColorHcts: Hct[], isDark: boolean, contrastLevel: number);
	constructor(sourceColorOrList: Hct | Hct[], isDark: boolean, contrastLevel: number) {
		super(sourceColorOrList, isDark, contrastLevel, Variant.NEUTRAL);
	}

	static override primaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			sourceColorHct.hue,
			Hct.isBlue(sourceColorHct.hue) ? 12 : 8
		);
	}

	static override secondaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			sourceColorHct.hue,
			Hct.isBlue(sourceColorHct.hue) ? 6 : 4
		);
	}

	static override tertiaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			DynamicScheme.getRotatedHue(
				sourceColorHct,
				[0, 38, 105, 161, 204, 278, 333, 360],
				[-32, 26, 10, -39, 24, -15, -32]
			),
			20
		);
	}

	static override neutralPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 1.4);
	}

	static override neutralVariantPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 1.4 * 2.2);
	}

	static override errorPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			DynamicScheme.getPiecewiseHue(
				sourceColorHct,
				[0, 3, 13, 23, 33, 43, 153, 273, 360],
				[12, 22, 32, 12, 22, 32, 22, 12]
			),
			50
		);
	}
}
