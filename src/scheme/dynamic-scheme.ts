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
import { sanitizeDegreesDouble } from '../utils';

import { PaletteTokens, getSpec } from '../spec/palettes';
import type { DynamicColor } from './dynamic-color';
import { ColorRoles } from './color-roles';
import { Variant } from './variant';

/**
 * @param sourceColorHct The primary source color of the theme as an HCT color.
 * @param sourceColorHcts The source colors of the theme as HCT colors.
 * @param variant The variant, or style, of the theme.
 * @param contrastLevel Value from -1 to 1. -1 represents minimum contrast, 0
 *     represents standard (i.e. the design as spec'd), and 1 represents maximum
 *     contrast.
 * @param isDark Whether the scheme is in dark mode or light mode.
 * @param primaryPalette Given a tone, produces a color. Hue and chroma of the
 *     color are specified in the design specification of the variant. Usually
 *     colorful.
 * @param secondaryPalette Given a tone, produces a color. Hue and chroma of the
 *     color are specified in the design specification of the variant. Usually
 *     less colorful.
 * @param tertiaryPalette Given a tone, produces a color. Hue and chroma of the
 *     color are specified in the design specification of the variant. Usually a
 *     different hue from primary and colorful.
 * @param neutralPalette Given a tone, produces a color. Hue and chroma of the
 *     color are specified in the design specification of the variant. Usually
 *     not colorful at all, intended for background & surface colors.
 * @param neutralVariantPalette Given a tone, produces a color. Hue and chroma
 *     of the color are specified in the design specification of the variant.
 *     Usually not colorful, but slightly more colorful than Neutral. Intended
 *     for backgrounds & surfaces.
 * @param errorPalette Given a tone, produces a reddish, colorful, color.
 */
interface DynamicSchemeOptions {
	sourceColorHct?: Hct;
	sourceColorHcts?: Hct[];
	variant: Variant;
	contrastLevel: number;
	isDark: boolean;
	primaryPalette?: TonalPalette;
	secondaryPalette?: TonalPalette;
	tertiaryPalette?: TonalPalette;
	neutralPalette?: TonalPalette;
	neutralVariantPalette?: TonalPalette;
	errorPalette?: TonalPalette;
}

/**
 * Constructed by a set of values representing the current UI state (such as
 * whether or not its dark theme, what the theme style is, etc.), and
 * provides a set of TonalPalettes that can create colors that fit in
 * with the theme style. Used by DynamicColor to resolve into a color.
 */
export class DynamicScheme {
	/**
	 * The source color of the theme as an HCT color.
	 */
	sourceColorHct: Hct;

	/**
	 * The source colors of the theme as HCT colors.
	 *
	 * If provided, `sourceColorHct` will be the first color in this list. Any
	 * other colors will be used to generate multicolored palettes.
	 *
	 * If not provided, `sourceColorHcts` will be a list containing only
	 * `sourceColorHct`.
	 */
	sourceColorHcts: Hct[];

	/** The source color of the theme as an ARGB 32-bit integer. */
	readonly sourceColorArgb: number;

	/** The variant, or style, of the theme. */
	readonly variant: Variant;

	/**
	 * Value from -1 to 1. -1 represents minimum contrast. 0 represents standard
	 * (i.e. the design as spec'd), and 1 represents maximum contrast.
	 */
	readonly contrastLevel: number;

	/** Whether the scheme is in dark mode or light mode. */
	readonly isDark: boolean;

	/**
	 * Given a tone, produces a color. Hue and chroma of the
	 * color are specified in the design specification of the variant. Usually
	 * colorful.
	 */
	readonly primaryPalette: TonalPalette;

	/**
	 * Given a tone, produces a color. Hue and chroma of
	 * the color are specified in the design specification of the variant. Usually
	 * less colorful.
	 */
	readonly secondaryPalette: TonalPalette;

	/**
	 * Given a tone, produces a color. Hue and chroma of
	 * the color are specified in the design specification of the variant. Usually
	 * a different hue from primary and colorful.
	 */
	readonly tertiaryPalette: TonalPalette;

	/**
	 * Given a tone, produces a color. Hue and chroma of the
	 * color are specified in the design specification of the variant. Usually not
	 * colorful at all, intended for background & surface colors.
	 */
	readonly neutralPalette: TonalPalette;

	/**
	 * Given a tone, produces a color. Hue and chroma
	 * of the color are specified in the design specification of the variant.
	 * Usually not colorful, but slightly more colorful than Neutral. Intended for
	 * backgrounds & surfaces.
	 */
	readonly neutralVariantPalette: TonalPalette;

	/**
	 * Given a tone, produces a reddish, colorful, color.
	 */
	errorPalette: TonalPalette;

	readonly colors: ColorRoles;

	constructor(args: DynamicSchemeOptions) {
		if (args.sourceColorHcts) {
			if (args.sourceColorHcts.length === 0) {
				throw new Error('sourceColorHcts cannot be empty');
			}
			this.sourceColorHct = args.sourceColorHcts[0] ?? Hct.fromInt(0);

			this.sourceColorHcts = args.sourceColorHcts;
		} else if (args.sourceColorHct) {
			this.sourceColorHct = args.sourceColorHct;

			this.sourceColorHcts = [args.sourceColorHct];
		} else {
			throw new Error('sourceColorHct or sourceColorHcts required');
		}
		this.sourceColorArgb = this.sourceColorHct.toInt();
		this.variant = args.variant;
		this.contrastLevel = args.contrastLevel;
		this.isDark = args.isDark;
		this.primaryPalette =
			args.primaryPalette ??
			getSpec().getPrimaryPalette(
				this.variant,
				this.sourceColorHct,
				this.isDark,
				this.contrastLevel
			);
		this.secondaryPalette =
			args.secondaryPalette ??
			getSpec().getSecondaryPalette(
				this.variant,
				this.sourceColorHct,
				this.isDark,
				this.contrastLevel
			);
		this.tertiaryPalette =
			args.tertiaryPalette ??
			getSpec().getTertiaryPalette(
				this.variant,
				this.sourceColorHct,
				this.isDark,
				this.contrastLevel
			);
		this.neutralPalette =
			args.neutralPalette ??
			getSpec().getNeutralPalette(
				this.variant,
				this.sourceColorHct,
				this.isDark,
				this.contrastLevel
			);
		this.neutralVariantPalette =
			args.neutralVariantPalette ??
			getSpec().getNeutralVariantPalette(
				this.variant,
				this.sourceColorHct,
				this.isDark,
				this.contrastLevel
			);
		this.errorPalette =
			args.errorPalette ??
			getSpec().getErrorPalette(
				this.variant,
				this.sourceColorHct,
				this.isDark,
				this.contrastLevel
			) ??
			TonalPalette.fromHueAndChroma(25.0, 84.0);

		this.colors = new ColorRoles();
	}

	toString(): string {
		const extraColors =
			this.sourceColorHcts.length <= 1
				? ''
				: `sourceColorHctList=[${this.sourceColorHcts
						.map((hct) => hct.toString())
						.join(', ')}], `;
		return (
			`Scheme: ` +
			`variant=${Variant[this.variant]}, ` +
			`mode=${this.isDark ? 'dark' : 'light'}, ` +
			`contrastLevel=${this.contrastLevel.toFixed(1)}, ` +
			`seed=${this.sourceColorHct.toString()}, ` +
			extraColors +
			`spec=2026`
		);
	}

	/**
	 * Returns a new hue based on a piecewise function and input color hue.
	 *
	 * For example, for the following function:
	 * result = 26 if 0 <= hue < 101
	 * result = 39 if 101 <= hue < 210
	 * result = 28 if 210 <= hue < 360
	 *
	 * call the function as:
	 *
	 * const hueBreakpoints = [0, 101, 210, 360];
	 * const hues = [26, 39, 28];
	 * const result = scheme.piecewise(hue, hueBreakpoints, hues);
	 *
	 * @param sourceColorHct The input value.
	 * @param hueBreakpoints The breakpoints, in sorted order. No default lower or
	 *     upper bounds are assumed.
	 * @param hues The hues that should be applied when source color's hue is >=
	 *     the same index in hueBrakpoints array, and < the hue at the next index
	 *     in hueBrakpoints array. Otherwise, the source color's hue is returned.
	 */
	static getPiecewiseHue(sourceColorHct: Hct, hueBreakpoints: number[], hues: number[]): number {
		const size = Math.min(hueBreakpoints.length - 1, hues.length);
		const sourceHue = sourceColorHct.hue;
		for (let i = 0; i < size; i++) {
			if (sourceHue >= (hueBreakpoints[i] ?? 0) && sourceHue < (hueBreakpoints[i + 1] ?? 0)) {
				return sanitizeDegreesDouble(hues[i] ?? 0);
			}
		}
		// No condition matched, return the source hue.
		return sourceHue;
	}

	/**
	 * Returns a shifted hue based on a piecewise function and input color hue.
	 *
	 * For example, for the following function:
	 * result = hue + 26 if 0 <= hue < 101
	 * result = hue - 39 if 101 <= hue < 210
	 * result = hue + 28 if 210 <= hue < 360
	 *
	 * call the function as:
	 *
	 * const hueBreakpoints = [0, 101, 210, 360];
	 * const hues = [26, -39, 28];
	 * const result = scheme.getRotatedHue(hue, hueBreakpoints, hues);
	 *
	 * @param sourceColorHct the source color of the theme, in HCT.
	 * @param hueBreakpoints The "breakpoints", i.e. the hues at which a rotation
	 *     should be apply. No default lower or upper bounds are assumed.
	 * @param rotations The rotation that should be applied when source color's
	 *     hue is >= the same index in hues array, and < the hue at the next
	 *     index in hues array. Otherwise, the source color's hue is returned.
	 */
	static getRotatedHue(
		sourceColorHct: Hct,
		hueBreakpoints: number[],
		rotations: number[]
	): number {
		let rotation = DynamicScheme.getPiecewiseHue(sourceColorHct, hueBreakpoints, rotations);
		if (Math.min(hueBreakpoints.length - 1, rotations.length) <= 0) {
			// No condition matched, return the source hue.
			rotation = 0;
		}
		return sanitizeDegreesDouble(sourceColorHct.hue + rotation);
	}

	private readonly resolved = new Map<string, number>();

	getArgb(dynamicColor: DynamicColor): number {
		const name = dynamicColor.name;
		if (name) {
			const cached = this.resolved.get(name);
			if (cached !== undefined) return cached;
		}
		const value = dynamicColor.getArgb(this);
		if (name) this.resolved.set(name, value);
		return value;
	}

	getHct(dynamicColor: DynamicColor): Hct {
		return dynamicColor.getHct(this);
	}

	// Palette key colors

	get primaryPaletteKeyColor(): number {
		return this.getArgb(this.colors.primaryPaletteKeyColor());
	}

	get secondaryPaletteKeyColor(): number {
		return this.getArgb(this.colors.secondaryPaletteKeyColor());
	}

	get tertiaryPaletteKeyColor(): number {
		return this.getArgb(this.colors.tertiaryPaletteKeyColor());
	}

	get neutralPaletteKeyColor(): number {
		return this.getArgb(this.colors.neutralPaletteKeyColor());
	}

	get neutralVariantPaletteKeyColor(): number {
		return this.getArgb(this.colors.neutralVariantPaletteKeyColor());
	}

	get errorPaletteKeyColor(): number {
		return this.getArgb(this.colors.errorPaletteKeyColor());
	}

	// Surface colors

	get background(): number {
		return this.getArgb(this.colors.background());
	}

	get onBackground(): number {
		return this.getArgb(this.colors.onBackground());
	}

	get surface(): number {
		return this.getArgb(this.colors.surface());
	}

	get surfaceDim(): number {
		return this.getArgb(this.colors.surfaceDim());
	}

	get surfaceBright(): number {
		return this.getArgb(this.colors.surfaceBright());
	}

	get surfaceContainerLowest(): number {
		return this.getArgb(this.colors.surfaceContainerLowest());
	}

	get surfaceContainerLow(): number {
		return this.getArgb(this.colors.surfaceContainerLow());
	}

	get surfaceContainer(): number {
		return this.getArgb(this.colors.surfaceContainer());
	}

	get surfaceContainerHigh(): number {
		return this.getArgb(this.colors.surfaceContainerHigh());
	}

	get surfaceContainerHighest(): number {
		return this.getArgb(this.colors.surfaceContainerHighest());
	}

	get onSurface(): number {
		return this.getArgb(this.colors.onSurface());
	}

	get surfaceVariant(): number {
		return this.getArgb(this.colors.surfaceVariant());
	}

	get onSurfaceVariant(): number {
		return this.getArgb(this.colors.onSurfaceVariant());
	}

	get inverseSurface(): number {
		return this.getArgb(this.colors.inverseSurface());
	}

	get inverseOnSurface(): number {
		return this.getArgb(this.colors.inverseOnSurface());
	}

	get outline(): number {
		return this.getArgb(this.colors.outline());
	}

	get outlineVariant(): number {
		return this.getArgb(this.colors.outlineVariant());
	}

	get shadow(): number {
		return this.getArgb(this.colors.shadow());
	}

	get scrim(): number {
		return this.getArgb(this.colors.scrim());
	}

	get surfaceTint(): number {
		return this.getArgb(this.colors.surfaceTint());
	}

	// Primary colors

	get primary(): number {
		return this.getArgb(this.colors.primary());
	}

	get primaryDim(): number {
		return this.getArgb(this.colors.primaryDim());
	}

	get onPrimary(): number {
		return this.getArgb(this.colors.onPrimary());
	}

	get primaryContainer(): number {
		return this.getArgb(this.colors.primaryContainer());
	}

	get onPrimaryContainer(): number {
		return this.getArgb(this.colors.onPrimaryContainer());
	}

	get primaryFixed(): number {
		return this.getArgb(this.colors.primaryFixed());
	}

	get primaryFixedDim(): number {
		return this.getArgb(this.colors.primaryFixedDim());
	}

	get onPrimaryFixed(): number {
		return this.getArgb(this.colors.onPrimaryFixed());
	}

	get onPrimaryFixedVariant(): number {
		return this.getArgb(this.colors.onPrimaryFixedVariant());
	}

	get inversePrimary(): number {
		return this.getArgb(this.colors.inversePrimary());
	}

	// Secondary colors

	get secondary(): number {
		return this.getArgb(this.colors.secondary());
	}

	get secondaryDim(): number {
		return this.getArgb(this.colors.secondaryDim());
	}

	get onSecondary(): number {
		return this.getArgb(this.colors.onSecondary());
	}

	get secondaryContainer(): number {
		return this.getArgb(this.colors.secondaryContainer());
	}

	get onSecondaryContainer(): number {
		return this.getArgb(this.colors.onSecondaryContainer());
	}

	get secondaryFixed(): number {
		return this.getArgb(this.colors.secondaryFixed());
	}

	get secondaryFixedDim(): number {
		return this.getArgb(this.colors.secondaryFixedDim());
	}

	get onSecondaryFixed(): number {
		return this.getArgb(this.colors.onSecondaryFixed());
	}

	get onSecondaryFixedVariant(): number {
		return this.getArgb(this.colors.onSecondaryFixedVariant());
	}

	// Tertiary colors

	get tertiary(): number {
		return this.getArgb(this.colors.tertiary());
	}

	get tertiaryDim(): number {
		return this.getArgb(this.colors.tertiaryDim());
	}

	get onTertiary(): number {
		return this.getArgb(this.colors.onTertiary());
	}

	get tertiaryContainer(): number {
		return this.getArgb(this.colors.tertiaryContainer());
	}

	get onTertiaryContainer(): number {
		return this.getArgb(this.colors.onTertiaryContainer());
	}

	get tertiaryFixed(): number {
		return this.getArgb(this.colors.tertiaryFixed());
	}

	get tertiaryFixedDim(): number {
		return this.getArgb(this.colors.tertiaryFixedDim());
	}

	get onTertiaryFixed(): number {
		return this.getArgb(this.colors.onTertiaryFixed());
	}

	get onTertiaryFixedVariant(): number {
		return this.getArgb(this.colors.onTertiaryFixedVariant());
	}

	// Error colors

	get error(): number {
		return this.getArgb(this.colors.error());
	}

	get errorDim(): number {
		return this.getArgb(this.colors.errorDim());
	}

	get onError(): number {
		return this.getArgb(this.colors.onError());
	}

	get errorContainer(): number {
		return this.getArgb(this.colors.errorContainer());
	}

	get onErrorContainer(): number {
		return this.getArgb(this.colors.onErrorContainer());
	}
}
