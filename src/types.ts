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

export type ColorValue = `#${string}`;

export type ColorScheme = 'dark' | 'light';

export interface Palette {
	primary: ColorValue;
	'primary-dim': ColorValue;
	'on-primary': ColorValue;
	'primary-container': ColorValue;
	'on-primary-container': ColorValue;
	'primary-fixed': ColorValue;
	'primary-fixed-dim': ColorValue;
	'on-primary-fixed': ColorValue;
	'on-primary-fixed-variant': ColorValue;
	secondary: ColorValue;
	'secondary-dim': ColorValue;
	'on-secondary': ColorValue;
	'secondary-container': ColorValue;
	'on-secondary-container': ColorValue;
	'secondary-fixed': ColorValue;
	'secondary-fixed-dim': ColorValue;
	'on-secondary-fixed': ColorValue;
	'on-secondary-fixed-variant': ColorValue;
	tertiary: ColorValue;
	'tertiary-dim': ColorValue;
	'on-tertiary': ColorValue;
	'tertiary-container': ColorValue;
	'on-tertiary-container': ColorValue;
	'tertiary-fixed': ColorValue;
	'tertiary-fixed-dim': ColorValue;
	'on-tertiary-fixed': ColorValue;
	'on-tertiary-fixed-variant': ColorValue;
	error: ColorValue;
	'error-dim': ColorValue;
	'on-error': ColorValue;
	'error-container': ColorValue;
	'on-error-container': ColorValue;
	background: ColorValue;
	'on-background': ColorValue;
	surface: ColorValue;
	'surface-dim': ColorValue;
	'surface-bright': ColorValue;
	'surface-container-lowest': ColorValue;
	'surface-container-low': ColorValue;
	'surface-container': ColorValue;
	'surface-container-high': ColorValue;
	'surface-container-highest': ColorValue;
	'surface-variant': ColorValue;
	'on-surface': ColorValue;
	'on-surface-variant': ColorValue;
	'outline': ColorValue;
	'outline-variant': ColorValue;
	shadow: ColorValue;
	scrim: ColorValue;
	'surface-tint': ColorValue;
	'inverse-surface': ColorValue;
	'inverse-on-surface': ColorValue;
	'inverse-primary': ColorValue;
}

export interface Theme {
	color: ColorValue;
	light: Palette;
	dark: Palette;
}

export type Tones = 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 95 | 98 | 99 | 100;

export type Variant =
	| 'monochrome'
	| 'neutral'
	| 'tonal-spot'
	| 'vibrant'
	| 'expressive'
	| 'fidelity'
	| 'content'
	| 'rainbow'
	| 'fruit-salad'
	| 'cmf';

export interface GradientOptions {
	from: string;
	to: string;
	count: number;
}

export interface CustomTokenOptions {
	from?: keyof Palette;
	adjust?: {
		hue?: number;
		chroma?: number;
		tone?: number;
	};
	harmonize?: ColorValue;
	random?: boolean;
	gradient?: GradientOptions;
}

export interface PaletteOptions {
	variant?: Variant;
	extraColors?: Record<string, ColorValue | CustomTokenOptions>;
}
