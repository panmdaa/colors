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

import { hexFromArgb, Contrast } from "./utils";
import { simulateCVD } from "./science";
import { DynamicScheme, Variant as InternalVariant } from "./scheme";
import { Color } from "./color-class";
export { Color } from "./color-class";

import type { ColorValue, Palette, Theme, Variant, CustomTokenOptions, ContrastScore, ContrastScoreCVD, ColorVisionDeficiency, CVDSeverity, PaletteCheckerPair, PaletteCheckerResult, PaletteCheckerMode, PaletteCheckerSimulation } from "./types";
import { resolveCustomTokens } from "./extend-theme";
export { simulateCVD, simulateAllCVD } from "./science";
export type { ColorVisionDeficiency, CVDSeverity, ContrastScoreCVD, PaletteCheckerPair, PaletteCheckerResult, PaletteCheckerMode, PaletteCheckerSimulation, PaletteModeSummary } from "./types";

function toHex(argb: number): ColorValue {
	return hexFromArgb(argb) as ColorValue;
}

function mapRange(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
	return toMin + ((value - fromMin) / (fromMax - fromMin)) * (toMax - toMin);
}

function clampScore(value: number): number {
	return Math.min(10, Math.max(0, value));
}

function scoreOverall(ratio: number): number {
	// Logarithmic scale: log2(21) ≈ 4.39 → normalizes ratio 1..21 to 0..10
	return clampScore((Math.log2(Math.max(ratio, 1)) / Math.log2(21)) * 10);
}

function scoreSmallText(ratio: number): number {
	if (ratio <= 1) return 0;
	if (ratio <= 4.5) return clampScore(mapRange(ratio, 1, 4.5, 0, 5));
	if (ratio <= 7) return clampScore(mapRange(ratio, 4.5, 7, 5, 7));
	return clampScore(mapRange(Math.min(ratio, 21), 7, 21, 7, 10));
}

function scoreLargeText(ratio: number): number {
	if (ratio <= 1) return 0;
	if (ratio <= 3) return clampScore(mapRange(ratio, 1, 3, 0, 5));
	if (ratio <= 4.5) return clampScore(mapRange(ratio, 3, 4.5, 5, 7));
	return clampScore(mapRange(Math.min(ratio, 21), 4.5, 21, 7, 10));
}

function toScore(ratio: number): ContrastScore {
	return { ratio, score: scoreOverall(ratio), smallText: scoreSmallText(ratio), largeText: scoreLargeText(ratio) };
}

const DEFICIENCIES: ColorVisionDeficiency[] = ["protanopia", "deuteranopia", "tritanopia"];

export function contrastChecker(base: ColorValue, on: ColorValue): ContrastScoreCVD;
export function contrastChecker(base: ColorValue, on: ColorValue, cvd: false): ContrastScore;
export function contrastChecker(base: ColorValue, on: ColorValue, cvd?: boolean): ContrastScore | ContrastScoreCVD {
	const result = toScore(Contrast.ratioOfTones(Color.getTone(base), Color.getTone(on)));

	if (cvd !== false) {
		const simulations = {} as Record<ColorVisionDeficiency, ContrastScore>;
		for (const deficiency of DEFICIENCIES) {
			const simBase = simulateCVD(base, deficiency);
			const simOn = simulateCVD(on, deficiency);
			simulations[deficiency] = toScore(Contrast.ratioOfTones(Color.getTone(simBase), Color.getTone(simOn)));
		}
		return { ...result, simulations } as ContrastScoreCVD;
	}

	return result;
}

function buildSimulation(
	base: ColorValue,
	on: ColorValue,
	deficiency: ColorVisionDeficiency,
): PaletteCheckerSimulation {
	const simBase = simulateCVD(base, deficiency);
	const simOn = simulateCVD(on, deficiency);
	const simRatio = Contrast.ratioOfTones(Color.getTone(simBase), Color.getTone(simOn));
	return {
		base: simBase,
		on: simOn,
		score: toScore(simRatio),
		AA: simRatio >= 4.5,
		AALarge: simRatio >= 3.0,
		AAA: simRatio >= 7.0,
	};
}

function scanPairs(
	palette: Record<string, ColorValue>,
	cvd: boolean,
): PaletteCheckerMode {
	const pairs: PaletteCheckerPair[] = [];
	const handled = new Set<string>();
	let passingAA = 0;
	let passingAALarge = 0;
	let passingAAA = 0;

	for (const role of Object.keys(palette)) {
		const onRole = `on-${role}`;
		if (onRole in palette && !handled.has(onRole)) {
			handled.add(onRole);
			const base = palette[role]!;
			const on = palette[onRole]!;
			const ratio = Contrast.ratioOfTones(Color.getTone(base), Color.getTone(on));
			const score = toScore(ratio);
			const AA = ratio >= 4.5;
			const AALarge = ratio >= 3.0;
			const AAA = ratio >= 7.0;

			if (AA) passingAA++;
			if (AALarge) passingAALarge++;
			if (AAA) passingAAA++;

			const pair: PaletteCheckerPair = {
				role,
				onRole,
				base,
				on,
				score,
				AA,
				AALarge,
				AAA,
			};

			if (cvd) {
				const simulations = {} as Record<ColorVisionDeficiency, PaletteCheckerSimulation>;
				for (const deficiency of DEFICIENCIES) {
					simulations[deficiency] = buildSimulation(base, on, deficiency);
				}
				pair.simulations = simulations;
			}

			pairs.push(pair);
		}
	}

	return {
		pairs,
		summary: { total: pairs.length, passingAA, passingAALarge, passingAAA },
	};
}

// Full theme (light + dark)
export function paletteChecker(theme: {
	color: ColorValue;
	light: Record<string, ColorValue>;
	dark: Record<string, ColorValue>;
}): PaletteCheckerResult;
export function paletteChecker(
	theme: {
		color: ColorValue;
		light: Record<string, ColorValue>;
		dark: Record<string, ColorValue>;
	},
	cvd: false,
): PaletteCheckerResult;
export function paletteChecker(
	theme: {
		color: ColorValue;
		light: Record<string, ColorValue>;
		dark: Record<string, ColorValue>;
	},
	cvd?: boolean,
): PaletteCheckerResult;

// Single palette (light or dark)
export function paletteChecker(palette: Record<string, ColorValue>): PaletteCheckerMode;
export function paletteChecker(palette: Record<string, ColorValue>, cvd: false): PaletteCheckerMode;
export function paletteChecker(palette: Record<string, ColorValue>, cvd?: boolean): PaletteCheckerMode;

export function paletteChecker(
	input: ({ color: ColorValue; light: Record<string, ColorValue>; dark: Record<string, ColorValue> }) | Record<string, ColorValue>,
	cvd?: boolean,
): PaletteCheckerResult | PaletteCheckerMode {
	// Full theme con light + dark
	if ("light" in input && "dark" in input) {
		const light = scanPairs((input as any).light, cvd !== false);
		const dark = scanPairs((input as any).dark, cvd !== false);
		return {
			color: (input as any).color,
			light,
			dark,
			summary: {
				total: light.summary.total + dark.summary.total,
				passingAA: light.summary.passingAA + dark.summary.passingAA,
				passingAALarge: light.summary.passingAALarge + dark.summary.passingAALarge,
				passingAAA: light.summary.passingAAA + dark.summary.passingAAA,
			},
		};
	}

	// Single palette (light o dark)
	return scanPairs(input as Record<string, ColorValue>, cvd !== false);
}

export type ExtraPalette<T extends Record<string, ColorValue | CustomTokenOptions>> = {
	[K in keyof T & string]: ColorValue;
} & {
	[K in keyof T & string as K extends `on-${string}` ? never : `on-${K}`]: ColorValue;
};

export function palette<
	T extends Record<string, ColorValue | CustomTokenOptions> = Record<string, never>,
>(
	color: ColorValue,
	options?: { variant?: Variant; contrastLevel?: number; extraColors?: T },
): Theme & {
	light: Palette & ExtraPalette<T> & Record<string, ColorValue>;
	dark: Palette & ExtraPalette<T> & Record<string, ColorValue>;
} {
	const variant = options?.variant ?? "expressive";
	const contrastLevel = options?.contrastLevel ?? 0;
	const source = Color.hct(color);
	const internalVariant = toInternalVariant(variant);
	const light = generateColorPalette(source, internalVariant, false, contrastLevel);
	const dark = generateColorPalette(source, internalVariant, true, contrastLevel);

	if (options?.extraColors) {
		const extra = resolveCustomTokens(light, dark, color, options.extraColors);
		Object.assign(light, extra.light);
		Object.assign(dark, extra.dark);
	}

	return { color, light, dark } as any;
}

function toInternalVariant(variant: Variant): InternalVariant {
	switch (variant) {
		case "cmf":
			return InternalVariant.CMF;
		case "content":
			return InternalVariant.CONTENT;
		case "expressive":
			return InternalVariant.EXPRESSIVE;
		case "fidelity":
			return InternalVariant.FIDELITY;
		case "fruit-salad":
			return InternalVariant.FRUIT_SALAD;
		case "monochrome":
			return InternalVariant.MONOCHROME;
		case "neutral":
			return InternalVariant.NEUTRAL;
		case "rainbow":
			return InternalVariant.RAINBOW;
		case "tonal-spot":
			return InternalVariant.TONAL_SPOT;
		case "vibrant":
			return InternalVariant.VIBRANT;
	}
}

function generateColorPalette(
	source: ReturnType<typeof Color.hct>,
	variant: InternalVariant,
	dark: boolean,
	contrastLevel: number,
): Palette {
	const scheme = new DynamicScheme({
		variant,
		sourceColorHct: source,
		isDark: dark,
		contrastLevel,
	});

	return {
		primary: toHex(scheme.primary),
		"primary-dim": toHex(scheme.primaryDim),
		"on-primary": toHex(scheme.onPrimary),
		"primary-container": toHex(scheme.primaryContainer),
		"on-primary-container": toHex(scheme.onPrimaryContainer),
		"primary-fixed": toHex(scheme.primaryFixed),
		"primary-fixed-dim": toHex(scheme.primaryFixedDim),
		"on-primary-fixed": toHex(scheme.onPrimaryFixed),
		"on-primary-fixed-variant": toHex(scheme.onPrimaryFixedVariant),
		secondary: toHex(scheme.secondary),
		"secondary-dim": toHex(scheme.secondaryDim),
		"on-secondary": toHex(scheme.onSecondary),
		"secondary-container": toHex(scheme.secondaryContainer),
		"on-secondary-container": toHex(scheme.onSecondaryContainer),
		"secondary-fixed": toHex(scheme.secondaryFixed),
		"secondary-fixed-dim": toHex(scheme.secondaryFixedDim),
		"on-secondary-fixed": toHex(scheme.onSecondaryFixed),
		"on-secondary-fixed-variant": toHex(scheme.onSecondaryFixedVariant),
		tertiary: toHex(scheme.tertiary),
		"tertiary-dim": toHex(scheme.tertiaryDim),
		"on-tertiary": toHex(scheme.onTertiary),
		"tertiary-container": toHex(scheme.tertiaryContainer),
		"on-tertiary-container": toHex(scheme.onTertiaryContainer),
		"tertiary-fixed": toHex(scheme.tertiaryFixed),
		"tertiary-fixed-dim": toHex(scheme.tertiaryFixedDim),
		"on-tertiary-fixed": toHex(scheme.onTertiaryFixed),
		"on-tertiary-fixed-variant": toHex(scheme.onTertiaryFixedVariant),
		error: toHex(scheme.error),
		"error-dim": toHex(scheme.errorDim),
		"on-error": toHex(scheme.onError),
		"error-container": toHex(scheme.errorContainer),
		"on-error-container": toHex(scheme.onErrorContainer),
		background: toHex(scheme.background),
		"on-background": toHex(scheme.onBackground),
		surface: toHex(scheme.surface),
		"surface-dim": toHex(scheme.surfaceDim),
		"surface-bright": toHex(scheme.surfaceBright),
		"surface-container-lowest": toHex(scheme.surfaceContainerLowest),
		"surface-container-low": toHex(scheme.surfaceContainerLow),
		"surface-container": toHex(scheme.surfaceContainer),
		"surface-container-high": toHex(scheme.surfaceContainerHigh),
		"surface-container-highest": toHex(scheme.surfaceContainerHighest),
		"surface-variant": toHex(scheme.surfaceVariant),
		"on-surface": toHex(scheme.onSurface),
		"on-surface-variant": toHex(scheme.onSurfaceVariant),
		outline: toHex(scheme.outline),
		"outline-variant": toHex(scheme.outlineVariant),
		shadow: toHex(scheme.shadow),
		scrim: toHex(scheme.scrim),
		"surface-tint": toHex(scheme.surfaceTint),
		"inverse-surface": toHex(scheme.inverseSurface),
		"inverse-on-surface": toHex(scheme.inverseOnSurface),
		"inverse-primary": toHex(scheme.inversePrimary),
	};
}