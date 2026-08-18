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
import { DynamicScheme } from '../scheme/dynamic-scheme';
import type { Variant } from '../types';
import { SchemeCmf } from './scheme-cmf';
import { SchemeContent } from './scheme-content';
import { SchemeExpressive } from './scheme-expressive';
import { SchemeFidelity } from './scheme-fidelity';
import { SchemeFruitSalad } from './scheme-fruit-salad';
import { SchemeMonochrome } from './scheme-monochrome';
import { SchemeNeutral } from './scheme-neutral';
import { SchemeRainbow } from './scheme-rainbow';
import { SchemeSoft } from './scheme-soft';
import { SchemeTonalSpot } from './scheme-tonal-spot';
import { SchemeVibrant } from './scheme-vibrant';
import { SchemeWarm } from './scheme-warm';
import { SchemeCool } from './scheme-cool';
import { SchemeMuted } from './scheme-muted';
import { SchemeHighContrast } from './scheme-high-contrast';

export function createVariantScheme(
	sourceColorHct: Hct,
	variant: Variant,
	isDark: boolean,
	contrastLevel: number,
): DynamicScheme {
	if (typeof variant !== 'string') {
		return new variant(sourceColorHct, isDark, contrastLevel);
	}

	switch (variant) {
		case 'cmf':
			return new SchemeCmf(sourceColorHct, isDark, contrastLevel);
		case 'content':
			return new SchemeContent(sourceColorHct, isDark, contrastLevel);
		case 'expressive':
			return new SchemeExpressive(sourceColorHct, isDark, contrastLevel);
		case 'fidelity':
			return new SchemeFidelity(sourceColorHct, isDark, contrastLevel);
		case 'fruit-salad':
			return new SchemeFruitSalad(sourceColorHct, isDark, contrastLevel);
		case 'monochrome':
			return new SchemeMonochrome(sourceColorHct, isDark, contrastLevel);
		case 'neutral':
			return new SchemeNeutral(sourceColorHct, isDark, contrastLevel);
		case 'rainbow':
			return new SchemeRainbow(sourceColorHct, isDark, contrastLevel);
		case 'soft':
			return new SchemeSoft(sourceColorHct, isDark, contrastLevel);
		case 'cool':
			return new SchemeCool(sourceColorHct, isDark, contrastLevel);
		case 'warm':
			return new SchemeWarm(sourceColorHct, isDark, contrastLevel);
		case 'muted':
			return new SchemeMuted(sourceColorHct, isDark, contrastLevel);
		case 'high-contrast':
			return new SchemeHighContrast(sourceColorHct, isDark, contrastLevel);
		case 'tonal-spot':
			return new SchemeTonalSpot(sourceColorHct, isDark, contrastLevel);
		case 'vibrant':
			return new SchemeVibrant(sourceColorHct, isDark, contrastLevel);
		default:
			throw new Error(`Unsupported variant: ${String(variant)}`);
	}
}
