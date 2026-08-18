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
export function firstSourceColor(sourceColorOrList: Hct | Hct[]): Hct {
	return Array.isArray(sourceColorOrList) ? sourceColorOrList[0] ?? Hct.fromInt(0) : sourceColorOrList;
}

export function secondSourceColor(sourceColorOrList: Hct | Hct[]): Hct | undefined {
	return Array.isArray(sourceColorOrList) ? sourceColorOrList[1] : undefined;
}

type VariantSchemeCtor = typeof VariantScheme & {
	primaryPalette?: VariantPaletteHook;
	secondaryPalette?: VariantPaletteHook;
	tertiaryPalette?: VariantPaletteHook;
	neutralPalette?: VariantPaletteHook;
	neutralVariantPalette?: VariantPaletteHook;
	errorPalette?: VariantPaletteHook;
};

type VariantPaletteHook = (
	sourceColorOrList: Hct | Hct[],
	isDark: boolean,
	contrastLevel: number,
) => TonalPalette | undefined;

/**
 * Shared base for the concrete theme variants.
 *
 * The subclasses only need to select the variant and, for special cases like
 * CMF, override a subset of the palettes. All source normalization and
 * DynamicScheme wiring lives here.
 */
export abstract class VariantScheme extends DynamicScheme {
	protected static tonalPalette(hue: number, chroma: number): TonalPalette {
		return TonalPalette.fromHueAndChroma(hue, chroma);
	}

	protected constructor(
		sourceColorOrList: Hct | Hct[],
		isDark: boolean,
		contrastLevel: number,
		variant: Variant,
	) {
		const ctor = new.target as VariantSchemeCtor;
		super({
			sourceColorHcts: Array.isArray(sourceColorOrList)
				? sourceColorOrList
				: [sourceColorOrList],
			variant,
			contrastLevel,
			isDark,
			...(ctor.primaryPalette
				? { primaryPalette: ctor.primaryPalette(sourceColorOrList, isDark, contrastLevel) }
				: {}),
			...(ctor.secondaryPalette
				? { secondaryPalette: ctor.secondaryPalette(sourceColorOrList, isDark, contrastLevel) }
				: {}),
			...(ctor.tertiaryPalette
				? { tertiaryPalette: ctor.tertiaryPalette(sourceColorOrList, isDark, contrastLevel) }
				: {}),
			...(ctor.neutralPalette
				? { neutralPalette: ctor.neutralPalette(sourceColorOrList, isDark, contrastLevel) }
				: {}),
			...(ctor.neutralVariantPalette
				? {
						neutralVariantPalette: ctor.neutralVariantPalette(
							sourceColorOrList,
							isDark,
							contrastLevel,
						),
					}
				: {}),
			...(ctor.errorPalette
				? { errorPalette: ctor.errorPalette(sourceColorOrList, isDark, contrastLevel) }
				: {}),
		});
	}

	static primaryPalette(
		_sourceColorOrList: Hct | Hct[],
		_isDark: boolean,
		_contrastLevel: number,
	): TonalPalette | undefined {
		return undefined;
	}

	static secondaryPalette(
		_sourceColorOrList: Hct | Hct[],
		_isDark: boolean,
		_contrastLevel: number,
	): TonalPalette | undefined {
		return undefined;
	}

	static tertiaryPalette(
		_sourceColorOrList: Hct | Hct[],
		_isDark: boolean,
		_contrastLevel: number,
	): TonalPalette | undefined {
		return undefined;
	}

	static neutralPalette(
		_sourceColorOrList: Hct | Hct[],
		_isDark: boolean,
		_contrastLevel: number,
	): TonalPalette | undefined {
		return undefined;
	}

	static neutralVariantPalette(
		_sourceColorOrList: Hct | Hct[],
		_isDark: boolean,
		_contrastLevel: number,
	): TonalPalette | undefined {
		return undefined;
	}

	static errorPalette(
		_sourceColorOrList: Hct | Hct[],
		_isDark: boolean,
		_contrastLevel: number,
	): TonalPalette | undefined {
		return undefined;
	}
}
