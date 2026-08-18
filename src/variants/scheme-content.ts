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
import { TemperatureCache } from '../science/temperature';
import { Hct } from '../hct';
import { TonalPalette } from '../palette';
import { Variant } from '../scheme/variant';
import { VariantScheme, firstSourceColor } from './variant-scheme';

/** A scheme that places the source color in `Scheme.primaryContainer`. */
export class SchemeContent extends VariantScheme {
	constructor(sourceColorHct: Hct, isDark: boolean, contrastLevel: number);
	constructor(sourceColorHcts: Hct[], isDark: boolean, contrastLevel: number);
	constructor(sourceColorOrList: Hct | Hct[], isDark: boolean, contrastLevel: number) {
		super(sourceColorOrList, isDark, contrastLevel, Variant.CONTENT);
	}

	static override primaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma);
	}

	static override secondaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			sourceColorHct.hue,
			Math.max(sourceColorHct.chroma - 32.0, sourceColorHct.chroma * 0.5)
		);
	}

	static override tertiaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHct(
			DislikeAnalyzer.fixIfDisliked(
				new TemperatureCache(sourceColorHct).analogous(/* count= */ 3, /* divisions= */ 6)[2]!
			)
		);
	}

	static override neutralPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma / 8.0);
	}

	static override neutralVariantPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const sourceColorHct = firstSourceColor(sourceColorOrList);
		return TonalPalette.fromHueAndChroma(
			sourceColorHct.hue,
			sourceColorHct.chroma / 8.0 + 4.0
		);
	}
}
