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
import { Variant } from '../scheme/variant';
import { VariantScheme, firstSourceColor, secondSourceColor } from './variant-scheme';

/**
 * A Dynamic Color theme with 2 source colors.
 */
export class SchemeCmf extends VariantScheme {
	constructor(sourceColorHct: Hct, isDark: boolean, contrastLevel: number);
	constructor(sourceColorHcts: Hct[], isDark: boolean, contrastLevel: number);
	constructor(sourceColorOrList: Hct | Hct[], isDark: boolean, contrastLevel: number) {
		super(sourceColorOrList, isDark, contrastLevel, Variant.CMF);
	}

	static override primaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const secondarySourceColorHct = secondSourceColor(sourceColorOrList) ?? sourceColorHct;
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma);
	}

	static override secondaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma * 0.5);
	}

	static override tertiaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const secondarySourceColorHct = secondSourceColor(sourceColorOrList) ?? sourceColorHct;
		return sourceColorHct.toInt() === secondarySourceColorHct.toInt()
			? TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma * 0.75)
			: TonalPalette.fromHueAndChroma(secondarySourceColorHct.hue, secondarySourceColorHct.chroma);
	}

	static override neutralPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma * 0.2);
	}

	static override neutralVariantPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma * 0.2);
	}

	static override errorPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		const secondarySourceColorHct = secondSourceColor(sourceColorOrList) ?? sourceColorHct;
		return TonalPalette.fromHueAndChroma(
			SchemeCmf.getErrorHue(sourceColorHct.hue, secondarySourceColorHct.hue),
			Math.max(sourceColorHct.chroma, 50.0),
		);
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
