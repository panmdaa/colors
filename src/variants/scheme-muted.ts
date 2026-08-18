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

/** A low-chroma, quiet theme without going fully monochrome. */
export class SchemeMuted extends VariantScheme {
	constructor(sourceColorHct: Hct, isDark: boolean, contrastLevel: number);
	constructor(sourceColorHcts: Hct[], isDark: boolean, contrastLevel: number);
	constructor(sourceColorOrList: Hct | Hct[], isDark: boolean, contrastLevel: number) {
		super(sourceColorOrList, isDark, contrastLevel, Variant.NEUTRAL);
	}

	static override primaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 14);
	}

	static override secondaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 8);
	}

	static override tertiaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			DynamicScheme.getRotatedHue(sourceColorHct, [0, 120, 240, 360], [10, -6, 10]),
			10
		);
	}

	static override neutralPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 1.5);
	}

	static override neutralVariantPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 3.2);
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
