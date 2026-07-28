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

import { ColorTokens } from '../spec/tokens';
import type { DynamicColor } from './dynamic-color';
import type { DynamicScheme } from './dynamic-scheme';

/**
 * DynamicColors for the colors in the Material Design system.
 */
// Material Color Utilities namespaces the various utilities it provides.
export class ColorRoles {
	static contentAccentToneDelta = 15.0;

	private static readonly colorSpec = new ColorTokens();

	highestSurface(s: DynamicScheme): DynamicColor {
		return ColorRoles.colorSpec.highestSurface(s);
	}

	////////////////////////////////////////////////////////////////
	// Main Palettes                                              //
	////////////////////////////////////////////////////////////////

	primaryPaletteKeyColor(): DynamicColor {
		return ColorRoles.colorSpec.primaryPaletteKeyColor();
	}

	secondaryPaletteKeyColor(): DynamicColor {
		return ColorRoles.colorSpec.secondaryPaletteKeyColor();
	}

	tertiaryPaletteKeyColor(): DynamicColor {
		return ColorRoles.colorSpec.tertiaryPaletteKeyColor();
	}

	neutralPaletteKeyColor(): DynamicColor {
		return ColorRoles.colorSpec.neutralPaletteKeyColor();
	}

	neutralVariantPaletteKeyColor(): DynamicColor {
		return ColorRoles.colorSpec.neutralVariantPaletteKeyColor();
	}

	errorPaletteKeyColor(): DynamicColor {
		return ColorRoles.colorSpec.errorPaletteKeyColor();
	}

	////////////////////////////////////////////////////////////////
	// Surfaces [S]                                               //
	////////////////////////////////////////////////////////////////

	background(): DynamicColor {
		return ColorRoles.colorSpec.background();
	}

	onBackground(): DynamicColor {
		return ColorRoles.colorSpec.onBackground();
	}

	surface(): DynamicColor {
		return ColorRoles.colorSpec.surface();
	}

	surfaceDim(): DynamicColor {
		return ColorRoles.colorSpec.surfaceDim();
	}

	surfaceBright(): DynamicColor {
		return ColorRoles.colorSpec.surfaceBright();
	}

	surfaceContainerLowest(): DynamicColor {
		return ColorRoles.colorSpec.surfaceContainerLowest();
	}

	surfaceContainerLow(): DynamicColor {
		return ColorRoles.colorSpec.surfaceContainerLow();
	}

	surfaceContainer(): DynamicColor {
		return ColorRoles.colorSpec.surfaceContainer();
	}

	surfaceContainerHigh(): DynamicColor {
		return ColorRoles.colorSpec.surfaceContainerHigh();
	}

	surfaceContainerHighest(): DynamicColor {
		return ColorRoles.colorSpec.surfaceContainerHighest();
	}

	onSurface(): DynamicColor {
		return ColorRoles.colorSpec.onSurface();
	}

	surfaceVariant(): DynamicColor {
		return ColorRoles.colorSpec.surfaceVariant();
	}

	onSurfaceVariant(): DynamicColor {
		return ColorRoles.colorSpec.onSurfaceVariant();
	}

	outline(): DynamicColor {
		return ColorRoles.colorSpec.outline();
	}

	outlineVariant(): DynamicColor {
		return ColorRoles.colorSpec.outlineVariant();
	}

	inverseSurface(): DynamicColor {
		return ColorRoles.colorSpec.inverseSurface();
	}

	inverseOnSurface(): DynamicColor {
		return ColorRoles.colorSpec.inverseOnSurface();
	}

	shadow(): DynamicColor {
		return ColorRoles.colorSpec.shadow();
	}

	scrim(): DynamicColor {
		return ColorRoles.colorSpec.scrim();
	}

	surfaceTint(): DynamicColor {
		return ColorRoles.colorSpec.surfaceTint();
	}

	////////////////////////////////////////////////////////////////
	// Primaries [P]                                              //
	////////////////////////////////////////////////////////////////

	primary(): DynamicColor {
		return ColorRoles.colorSpec.primary();
	}

	primaryDim(): DynamicColor {
		return ColorRoles.colorSpec.primaryDim();
	}

	onPrimary(): DynamicColor {
		return ColorRoles.colorSpec.onPrimary();
	}

	primaryContainer(): DynamicColor {
		return ColorRoles.colorSpec.primaryContainer();
	}

	onPrimaryContainer(): DynamicColor {
		return ColorRoles.colorSpec.onPrimaryContainer();
	}

	inversePrimary(): DynamicColor {
		return ColorRoles.colorSpec.inversePrimary();
	}

	/////////////////////////////////////////////////////////////////
	// Primary Fixed [PF]                                          //
	/////////////////////////////////////////////////////////////////

	primaryFixed(): DynamicColor {
		return ColorRoles.colorSpec.primaryFixed();
	}

	primaryFixedDim(): DynamicColor {
		return ColorRoles.colorSpec.primaryFixedDim();
	}

	onPrimaryFixed(): DynamicColor {
		return ColorRoles.colorSpec.onPrimaryFixed();
	}

	onPrimaryFixedVariant(): DynamicColor {
		return ColorRoles.colorSpec.onPrimaryFixedVariant();
	}

	////////////////////////////////////////////////////////////////
	// Secondaries [Q]                                            //
	////////////////////////////////////////////////////////////////

	secondary(): DynamicColor {
		return ColorRoles.colorSpec.secondary();
	}

	secondaryDim(): DynamicColor {
		return ColorRoles.colorSpec.secondaryDim();
	}

	onSecondary(): DynamicColor {
		return ColorRoles.colorSpec.onSecondary();
	}

	secondaryContainer(): DynamicColor {
		return ColorRoles.colorSpec.secondaryContainer();
	}

	onSecondaryContainer(): DynamicColor {
		return ColorRoles.colorSpec.onSecondaryContainer();
	}

	/////////////////////////////////////////////////////////////////
	// Secondary Fixed [QF]                                        //
	/////////////////////////////////////////////////////////////////

	secondaryFixed(): DynamicColor {
		return ColorRoles.colorSpec.secondaryFixed();
	}

	secondaryFixedDim(): DynamicColor {
		return ColorRoles.colorSpec.secondaryFixedDim();
	}

	onSecondaryFixed(): DynamicColor {
		return ColorRoles.colorSpec.onSecondaryFixed();
	}

	onSecondaryFixedVariant(): DynamicColor {
		return ColorRoles.colorSpec.onSecondaryFixedVariant();
	}

	////////////////////////////////////////////////////////////////
	// Tertiaries [T]                                             //
	////////////////////////////////////////////////////////////////

	tertiary(): DynamicColor {
		return ColorRoles.colorSpec.tertiary();
	}

	tertiaryDim(): DynamicColor {
		return ColorRoles.colorSpec.tertiaryDim();
	}

	onTertiary(): DynamicColor {
		return ColorRoles.colorSpec.onTertiary();
	}

	tertiaryContainer(): DynamicColor {
		return ColorRoles.colorSpec.tertiaryContainer();
	}

	onTertiaryContainer(): DynamicColor {
		return ColorRoles.colorSpec.onTertiaryContainer();
	}

	/////////////////////////////////////////////////////////////////
	// Tertiary Fixed [TF]                                         //
	/////////////////////////////////////////////////////////////////

	tertiaryFixed(): DynamicColor {
		return ColorRoles.colorSpec.tertiaryFixed();
	}

	tertiaryFixedDim(): DynamicColor {
		return ColorRoles.colorSpec.tertiaryFixedDim();
	}

	onTertiaryFixed(): DynamicColor {
		return ColorRoles.colorSpec.onTertiaryFixed();
	}

	onTertiaryFixedVariant(): DynamicColor {
		return ColorRoles.colorSpec.onTertiaryFixedVariant();
	}

	////////////////////////////////////////////////////////////////
	// Errors [E]                                                 //
	////////////////////////////////////////////////////////////////

	error(): DynamicColor {
		return ColorRoles.colorSpec.error();
	}

	errorDim(): DynamicColor {
		return ColorRoles.colorSpec.errorDim();
	}

	onError(): DynamicColor {
		return ColorRoles.colorSpec.onError();
	}

	errorContainer(): DynamicColor {
		return ColorRoles.colorSpec.errorContainer();
	}

	onErrorContainer(): DynamicColor {
		return ColorRoles.colorSpec.onErrorContainer();
	}

	////////////////////////////////////////////////////////////////
	// All Colors                                                 //
	////////////////////////////////////////////////////////////////

	allColors: DynamicColor[] = [
		this.background(),
		this.onBackground(),
		this.surface(),
		this.surfaceDim(),
		this.surfaceBright(),
		this.surfaceContainerLowest(),
		this.surfaceContainerLow(),
		this.surfaceContainer(),
		this.surfaceContainerHigh(),
		this.surfaceContainerHighest(),
		this.onSurface(),
		this.onSurfaceVariant(),
		this.outline(),
		this.outlineVariant(),
		this.inverseSurface(),
		this.inverseOnSurface(),
		this.primary(),
		this.primaryDim(),
		this.onPrimary(),
		this.primaryContainer(),
		this.onPrimaryContainer(),
		this.primaryFixed(),
		this.primaryFixedDim(),
		this.onPrimaryFixed(),
		this.onPrimaryFixedVariant(),
		this.inversePrimary(),
		this.secondary(),
		this.secondaryDim(),
		this.onSecondary(),
		this.secondaryContainer(),
		this.onSecondaryContainer(),
		this.secondaryFixed(),
		this.secondaryFixedDim(),
		this.onSecondaryFixed(),
		this.onSecondaryFixedVariant(),
		this.tertiary(),
		this.tertiaryDim(),
		this.onTertiary(),
		this.tertiaryContainer(),
		this.onTertiaryContainer(),
		this.tertiaryFixed(),
		this.tertiaryFixedDim(),
		this.onTertiaryFixed(),
		this.onTertiaryFixedVariant(),
		this.error(),
		this.errorDim(),
		this.onError(),
		this.errorContainer(),
		this.onErrorContainer()
	].filter((c) => c !== undefined);}
