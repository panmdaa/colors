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
import { DynamicColor } from '../scheme/dynamic-color';
import type { DynamicScheme } from '../scheme/dynamic-scheme';
import { ToneDeltaPair } from '../scheme/tone-delta-pair';
import { Variant } from '../scheme/variant';
import { clampDouble } from '../utils';

import { getCurve, tMaxC, tMinC } from '../spec/token-utils';

export class ColorTokens {
	////////////////////////////////////////////////////////////////
	// Main Palettes                                              //
	////////////////////////////////////////////////////////////////

	primaryPaletteKeyColor(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'primary_palette_key_color',
			palette: (s) => s.primaryPalette,
			tone: (s) => s.primaryPalette.keyColor.tone
		});
	}

	secondaryPaletteKeyColor(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'secondary_palette_key_color',
			palette: (s) => s.secondaryPalette,
			tone: (s) => s.secondaryPalette.keyColor.tone
		});
	}

	tertiaryPaletteKeyColor(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'tertiary_palette_key_color',
			palette: (s) => s.tertiaryPalette,
			tone: (s) => s.tertiaryPalette.keyColor.tone
		});
	}

	neutralPaletteKeyColor(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'neutral_palette_key_color',
			palette: (s) => s.neutralPalette,
			tone: (s) => s.neutralPalette.keyColor.tone
		});
	}

	neutralVariantPaletteKeyColor(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'neutral_variant_palette_key_color',
			palette: (s) => s.neutralVariantPalette,
			tone: (s) => s.neutralVariantPalette.keyColor.tone
		});
	}

	errorPaletteKeyColor(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'error_palette_key_color',
			palette: (s) => s.errorPalette,
			tone: (s) => s.errorPalette.keyColor.tone
		});
	}

	////////////////////////////////////////////////////////////////
	// Surfaces [S]                                               //
	////////////////////////////////////////////////////////////////

	background(): DynamicColor {
		const surfaceColor = this.surface();
		return Object.assign(surfaceColor.clone(), {
			name: 'background'
		});
	}

	onBackground(): DynamicColor {
		const onSurfaceColor = this.onSurface();
		return Object.assign(onSurfaceColor.clone(), {
			name: 'on_background',
			tone: (s: DynamicScheme) => {
				return this.onSurface().getTone(s);
			}
		});
	}

	surface(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'surface',
			palette: (s) => s.neutralPalette,
			tone: (s) => {
				if (s.variant === Variant.CMF) {
					return s.isDark ? 4 : 98;
				}
				return s.isDark ? 6 : 98;
			},
			isBackground: true
		});
	}

	surfaceDim(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'surface_dim',
			palette: (s) => s.neutralPalette,
			tone: (s) => {
				if (s.variant === Variant.CMF) {
					return s.isDark ? 4 : 87;
				}
				return s.isDark ? 4 : 87;
			},
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return s.isDark ? 1 : 1.7;
				}
				return 0;
			},
			isBackground: true
		});
	}

	surfaceBright(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'surface_bright',
			palette: (s) => s.neutralPalette,
			tone: (s) => {
				if (s.variant === Variant.CMF) {
					return s.isDark ? 18 : 98;
				}
				return s.isDark ? 24 : 98;
			},
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return s.isDark ? 1.7 : 1;
				}
				return 0;
			},
			isBackground: true
		});
	}

	surfaceContainerLowest(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'surface_container_lowest',
			palette: (s) => s.neutralPalette,
			tone: (s) => {
				if (s.variant === Variant.CMF) {
					return s.isDark ? 0 : 100;
				}
				return s.isDark ? 0 : 100;
			},
			isBackground: true
		});
	}

	surfaceContainerLow(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'surface_container_low',
			palette: (s) => s.neutralPalette,
			tone: (s) => {
				if (s.variant === Variant.CMF) {
					return s.isDark ? 6 : 96;
				}
				return s.isDark ? 10 : 96;
			},
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return 1.25;
				}
				return 0;
			},
			isBackground: true
		});
	}

	surfaceContainer(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'surface_container',
			palette: (s) => s.neutralPalette,
			tone: (s) => {
				if (s.variant === Variant.CMF) {
					return s.isDark ? 9 : 94;
				}
				return s.isDark ? 12 : 94;
			},
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return 1.4;
				}
				return 0;
			},
			isBackground: true
		});
	}

	surfaceContainerHigh(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'surface_container_high',
			palette: (s) => s.neutralPalette,
			tone: (s) => {
				if (s.variant === Variant.CMF) {
					return s.isDark ? 12 : 92;
				}
				return s.isDark ? 17 : 92;
			},
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return 1.5;
				}
				return 0;
			},
			isBackground: true
		});
	}

	surfaceContainerHighest(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'surface_container_highest',
			palette: (s) => s.neutralPalette,
			tone: (s) => {
				if (s.variant === Variant.CMF) {
					return s.isDark ? 15 : 90;
				}
				return s.isDark ? 22 : 90;
			},
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return 1.7;
				}
				return 0;
			},
			isBackground: true
		});
	}

	onSurface(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_surface',
			palette: (s) => s.neutralPalette,
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return 1.7;
				} else {
					return 0;
				}
			},
			background: (s) => this.highestSurface(s),
			contrastCurve: (s) => (s.isDark ? getCurve(11) : getCurve(9))
		});
	}

	surfaceVariant(): DynamicColor {
		const container = this.surfaceContainerHighest();
		return Object.assign(container.clone(), {
			name: 'surface_variant'
		});
	}

	onSurfaceVariant(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_surface_variant',
			palette: (s) => s.neutralPalette,
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return 1.7;
				} else {
					return 0;
				}
			},
			background: (s) => this.highestSurface(s),
			contrastCurve: (s) => (s.isDark ? getCurve(6) : getCurve(4.5))
		});
	}

	inverseSurface(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'inverse_surface',
			palette: (s) => s.neutralPalette,
			tone: (s) => {
				return s.isDark ? 98 : 4;
			},
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return 1.7;
				} else {
					return 0;
				}
			},
			isBackground: true
		});
	}

	inverseOnSurface(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'inverse_on_surface',
			palette: (s) => s.neutralPalette,
			background: () => this.inverseSurface(),
			contrastCurve: () => getCurve(7)
		});
	}

	outline(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'outline',
			palette: (s) => s.neutralPalette,
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return 1.7;
				} else {
					return 0;
				}
			},
			background: (s) => this.highestSurface(s),
			contrastCurve: () => getCurve(3)
		});
	}

	outlineVariant(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'outline_variant',
			palette: (s) => s.neutralPalette,
			chromaMultiplier: (s) => {
				if (s.variant === Variant.CMF) {
					return 1.7;
				} else {
					return 0;
				}
			},
			background: (s) => this.highestSurface(s),
			contrastCurve: () => getCurve(1.5)
		});
	}

	shadow(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'shadow',
			palette: (s) => s.neutralPalette,
			tone: () => 0
		});
	}

	scrim(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'scrim',
			palette: (s) => s.neutralPalette,
			tone: () => 0
		});
	}

	surfaceTint(): DynamicColor {
		const primaryColor = this.primary();
		return Object.assign(primaryColor.clone(), {
			name: 'surface_tint'
		});
	}

	////////////////////////////////////////////////////////////////
	// Primaries [P]                                              //
	////////////////////////////////////////////////////////////////

	primary(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'primary',
			palette: (s) => s.primaryPalette,
			tone: (s) =>
				s.sourceColorHct.chroma <= 12 ? (s.isDark ? 80 : 40) : s.sourceColorHct.tone,
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: () => getCurve(4.5),
			toneDeltaPair: () =>
				new ToneDeltaPair(
					this.primaryContainer(),
					this.primary(),
					5,
					'relative_lighter',
					true,
					'farther'
				)
		});
	}

	primaryDim(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'primary_dim',
			palette: (s) => s.primaryPalette,
			tone: (s) => clampDouble(0, 100, this.primary().getTone(s) - 5)
		});
	}

	onPrimary(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_primary',
			palette: (s) => s.primaryPalette,
			background: () => this.primary(),
			contrastCurve: () => getCurve(6)
		});
	}

	primaryContainer(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'primary_container',
			palette: (s) => s.primaryPalette,
			tone: (s) => {
				if (!s.isDark && s.sourceColorHct.chroma <= 12) {
					return 90;
				}
				return s.sourceColorHct.tone > 55
					? clampDouble(61, 90, s.sourceColorHct.tone)
					: clampDouble(30, 49, s.sourceColorHct.tone);
			},
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)
		});
	}

	onPrimaryContainer(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_primary_container',
			palette: (s) => s.primaryPalette,
			background: () => this.primaryContainer(),
			contrastCurve: () => getCurve(6)
		});
	}

	inversePrimary(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'inverse_primary',
			palette: (s) => s.primaryPalette,
			tone: (s) => tMaxC(s.primaryPalette),
			background: () => this.inverseSurface(),
			contrastCurve: () => getCurve(6)
		});
	}

	////////////////////////////////////////////////////////////////
	// Primary Fixed Colors [PF]                                  //
	////////////////////////////////////////////////////////////////

	primaryFixed(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'primary_fixed',
			palette: (s) => s.primaryPalette,
			tone: (s) => {
				const tempS = Object.assign({}, s, { isDark: false, contrastLevel: 0 });
				return this.primaryContainer().getTone(tempS);
			},
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)
		});
	}

	primaryFixedDim(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'primary_fixed_dim',
			palette: (s) => s.primaryPalette,
			tone: (s) => this.primaryFixed().getTone(s),
			isBackground: true,
			background: (s) => this.highestSurface(s),
			toneDeltaPair: () =>
				new ToneDeltaPair(
					this.primaryFixedDim(),
					this.primaryFixed(),
					5,
					'darker',
					true,
					'exact'
				),
			contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)
		});
	}

	onPrimaryFixed(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_primary_fixed',
			palette: (s) => s.primaryPalette,
			background: (s) =>
				this.primaryFixed().getTone(s) > 57 ? this.primaryFixedDim() : this.primaryFixed(),
			contrastCurve: () => getCurve(7)
		});
	}

	onPrimaryFixedVariant(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_primary_fixed_variant',
			palette: (s) => s.primaryPalette,
			background: (s) =>
				this.primaryFixed().getTone(s) > 57 ? this.primaryFixedDim() : this.primaryFixed(),
			contrastCurve: () => getCurve(4.5)
		});
	}

	////////////////////////////////////////////////////////////////
	// Secondaries [Q]                                            //
	////////////////////////////////////////////////////////////////

	secondary(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'secondary',
			palette: (s) => s.secondaryPalette,
			tone: (s) => {
				return s.isDark ? tMinC(s.secondaryPalette) : tMaxC(s.secondaryPalette);
			},
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: () => getCurve(4.5),
			toneDeltaPair: () =>
				new ToneDeltaPair(
					this.secondaryContainer(),
					this.secondary(),
					5,
					'relative_lighter',
					true,
					'farther'
				)
		});
	}

	secondaryDim(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'secondary_dim',
			palette: (s) => s.secondaryPalette,
			tone: (s) => clampDouble(0, 100, this.secondary().getTone(s) - 5)
		});
	}

	onSecondary(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_secondary',
			palette: (s) => s.secondaryPalette,
			background: () => this.secondary(),
			contrastCurve: () => getCurve(6)
		});
	}

	secondaryContainer(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'secondary_container',
			palette: (s) => s.secondaryPalette,
			tone: (s) => {
				return s.isDark
					? tMinC(s.secondaryPalette, 20, 49)
					: tMaxC(s.secondaryPalette, 61, 90);
			},
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)
		});
	}

	onSecondaryContainer(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_secondary_container',
			palette: (s) => s.secondaryPalette,
			background: () => this.secondaryContainer(),
			contrastCurve: () => getCurve(6)
		});
	}

	////////////////////////////////////////////////////////////////
	// Secondary Fixed Colors [QF]                                //
	////////////////////////////////////////////////////////////////

	secondaryFixed(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'secondary_fixed',
			palette: (s) => s.secondaryPalette,
			tone: (s) => {
				const tempS = Object.assign({}, s, { isDark: false, contrastLevel: 0 });
				return this.secondaryContainer().getTone(tempS);
			},
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)
		});
	}

	secondaryFixedDim(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'secondary_fixed_dim',
			palette: (s) => s.secondaryPalette,
			tone: (s) => this.secondaryFixed().getTone(s),
			isBackground: true,
			background: (s) => this.highestSurface(s),
			toneDeltaPair: () =>
				new ToneDeltaPair(
					this.secondaryFixedDim(),
					this.secondaryFixed(),
					5,
					'darker',
					true,
					'exact'
				),
			contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)
		});
	}

	onSecondaryFixed(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_secondary_fixed',
			palette: (s) => s.secondaryPalette,
			background: (s) =>
				this.secondaryFixed().getTone(s) > 57
					? this.secondaryFixedDim()
					: this.secondaryFixed(),
			contrastCurve: () => getCurve(7)
		});
	}

	onSecondaryFixedVariant(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_secondary_fixed_variant',
			palette: (s) => s.secondaryPalette,
			background: (s) =>
				this.secondaryFixed().getTone(s) > 57
					? this.secondaryFixedDim()
					: this.secondaryFixed(),
			contrastCurve: () => getCurve(4.5)
		});
	}

	////////////////////////////////////////////////////////////////
	// Tertiaries [T]                                             //
	////////////////////////////////////////////////////////////////

	tertiary(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'tertiary',
			palette: (s) => s.tertiaryPalette,
			tone: (s) => {
				return s.sourceColorHcts[1]?.tone ?? s.sourceColorHct.tone;
			},
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: () => getCurve(4.5),
			toneDeltaPair: () =>
				new ToneDeltaPair(
					this.tertiaryContainer(),
					this.tertiary(),
					5,
					'relative_lighter',
					true,
					'farther'
				)
		});
	}

	tertiaryDim(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'tertiary_dim',
			palette: (s) => s.tertiaryPalette,
			tone: (s) => clampDouble(0, 100, this.tertiary().getTone(s) - 5)
		});
	}

	onTertiary(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_tertiary',
			palette: (s) => s.tertiaryPalette,
			background: () => this.tertiary(),
			contrastCurve: () => getCurve(6)
		});
	}

	tertiaryContainer(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'tertiary_container',
			palette: (s) => s.tertiaryPalette,
			tone: (s) => {
				const secondarySourceColorHct = s.sourceColorHcts[1] ?? s.sourceColorHct;
				return secondarySourceColorHct.tone > 55
					? clampDouble(61, 90, secondarySourceColorHct.tone)
					: clampDouble(20, 49, secondarySourceColorHct.tone);
			},
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)
		});
	}

	onTertiaryContainer(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_tertiary_container',
			palette: (s) => s.tertiaryPalette,
			background: () => this.tertiaryContainer(),
			contrastCurve: () => getCurve(6)
		});
	}

	////////////////////////////////////////////////////////////////
	// Tertiary Fixed Colors [TF]                                 //
	////////////////////////////////////////////////////////////////

	tertiaryFixed(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'tertiary_fixed',
			palette: (s) => s.tertiaryPalette,
			tone: (s) => {
				const tempS = Object.assign({}, s, { isDark: false, contrastLevel: 0 });
				return this.tertiaryContainer().getTone(tempS);
			},
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)
		});
	}

	tertiaryFixedDim(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'tertiary_fixed_dim',
			palette: (s) => s.tertiaryPalette,
			tone: (s) => this.tertiaryFixed().getTone(s),
			isBackground: true,
			background: (s) => this.highestSurface(s),
			toneDeltaPair: () =>
				new ToneDeltaPair(
					this.tertiaryFixedDim(),
					this.tertiaryFixed(),
					5,
					'darker',
					true,
					'exact'
				),
			contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)
		});
	}

	onTertiaryFixed(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_tertiary_fixed',
			palette: (s) => s.tertiaryPalette,
			background: (s) =>
				this.tertiaryFixed().getTone(s) > 57
					? this.tertiaryFixedDim()
					: this.tertiaryFixed(),
			contrastCurve: () => getCurve(7)
		});
	}

	onTertiaryFixedVariant(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_tertiary_fixed_variant',
			palette: (s) => s.tertiaryPalette,
			background: (s) =>
				this.tertiaryFixed().getTone(s) > 57
					? this.tertiaryFixedDim()
					: this.tertiaryFixed(),
			contrastCurve: () => getCurve(4.5)
		});
	}

	////////////////////////////////////////////////////////////////
	// Errors [E]                                                 //
	////////////////////////////////////////////////////////////////

	error(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'error',
			palette: (s) => s.errorPalette,
			tone: (s) => {
				return tMaxC(s.errorPalette);
			},
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: () => getCurve(4.5),
			toneDeltaPair: () =>
				new ToneDeltaPair(
					this.errorContainer(),
					this.error(),
					5,
					'relative_lighter',
					true,
					'farther'
				)
		});
	}

	errorDim(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'error_dim',
			palette: (s) => s.errorPalette,
			tone: (s) => clampDouble(0, 100, this.error().getTone(s) - 5)
		});
	}

	onError(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_error',
			palette: (s) => s.errorPalette,
			background: () => this.error(),
			contrastCurve: () => getCurve(6)
		});
	}

	errorContainer(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'error_container',
			palette: (s) => s.errorPalette,
			tone: (s) => {
				return s.isDark ? tMinC(s.errorPalette) : tMaxC(s.errorPalette);
			},
			isBackground: true,
			background: (s) => this.highestSurface(s),
			contrastCurve: (s) => (s.contrastLevel > 0 ? getCurve(1.5) : undefined)
		});
	}

	onErrorContainer(): DynamicColor {
		return DynamicColor.fromPalette({
			name: 'on_error_container',
			palette: (s) => s.errorPalette,
			background: () => this.errorContainer(),
			contrastCurve: () => getCurve(6)
		});
	}

	////////////////////////////////////////////////////////////////
	// Other                                                      //
	////////////////////////////////////////////////////////////////

	highestSurface(s: DynamicScheme): DynamicColor {
		return s.isDark ? this.surfaceBright() : this.surfaceDim();
	}
}
