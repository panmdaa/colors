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

import { argbFromHex, hexFromArgb, clampDouble, Contrast } from "./utils";
import { sourceColorFromImage, Blend, DislikeAnalyzer, simulateCVD } from "./science";
import { DynamicScheme, Variant as InternalVariant } from "./scheme";
import { Hct } from "./hct";

import type { ColorValue, Palette, Theme, Tones, Variant, CustomTokenOptions, ContrastScore, ContrastScoreCVD, ColorVisionDeficiency, CVDSeverity, PaletteCheckerPair, PaletteCheckerResult, PaletteCheckerMode, PaletteCheckerSimulation } from "./types";
import { resolveCustomTokens } from "./extend-theme";
export { gradient } from "./gradient";
export { simulateCVD, simulateAllCVD } from "./science";
export type { ColorVisionDeficiency, CVDSeverity, ContrastScoreCVD, PaletteCheckerPair, PaletteCheckerResult, PaletteCheckerMode, PaletteCheckerSimulation, PaletteModeSummary } from "./types";

export function toNumber(color: ColorValue): number {
	return argbFromHex(color);
}

export function fromNumber(color: number): ColorValue {
	return hexFromArgb(color) as ColorValue;
}

export function fromImage(image: HTMLImageElement): Promise<ColorValue> {
	return sourceColorFromImage(image).then((n) => fromNumber(n!));
}

export function hct(color: ColorValue) {
	return Hct.fromInt(toNumber(color));
}

export function fromHct(
	hue: number,
	chroma: number,
	tone: number,
): ColorValue {
	return fromNumber(Hct.from(hue, chroma, tone).toInt());
}

export function getHue(color: ColorValue): number {
	return hct(color).hue;
}

export function getChroma(color: ColorValue): number {
	return hct(color).chroma;
}

export function getTone(color: ColorValue): number {
	return hct(color).tone;
}

export function setHue(color: ColorValue, hue: number): ColorValue {
	const c = hct(color);
	c.hue = hue;
	return fromNumber(c.toInt());
}

export function setChroma(color: ColorValue, chroma: number): ColorValue {
	const c = hct(color);
	c.chroma = chroma;
	return fromNumber(c.toInt());
}

export function setTone(color: ColorValue, tone: number): ColorValue {
	const c = hct(color);
	c.tone = tone;
	return fromNumber(c.toInt());
}

export function rotateHue(color: ColorValue, degrees: number): ColorValue {
	const c = hct(color);
	c.hue = (c.hue + degrees + 360) % 360;
	return fromNumber(c.toInt());
}

export function lighten(color: ColorValue, amount: number): ColorValue {
	const c = hct(color);
	c.tone = Math.min(100, c.tone + amount);
	return fromNumber(c.toInt());
}

export function darken(color: ColorValue, amount: number): ColorValue {
	const c = hct(color);
	c.tone = Math.max(0, c.tone - amount);
	return fromNumber(c.toInt());
}

export function saturate(color: ColorValue, amount: number): ColorValue {
	const c = hct(color);
	c.chroma = Math.max(0, c.chroma + amount);
	return fromNumber(c.toInt());
}

export function desaturate(color: ColorValue, amount: number): ColorValue {
	const c = hct(color);
	c.chroma = Math.max(0, c.chroma - amount);
	return fromNumber(c.toInt());
}

export function edit(
	color: ColorValue,
	options: { hue?: number; chroma?: number; tone?: number },
): ColorValue {
	const c = hct(color);
	if (options.hue !== undefined) c.hue = options.hue;
	if (options.chroma !== undefined) c.chroma = options.chroma;
	if (options.tone !== undefined) c.tone = options.tone;
	return fromNumber(c.toInt());
}

export function harmonize(
	design: ColorValue,
	source: ColorValue,
): ColorValue {
	return fromNumber(Blend.harmonize(toNumber(design), toNumber(source)));
}

export function fixDisliked(color: ColorValue): ColorValue {
	return fromNumber(DislikeAnalyzer.fixIfDisliked(hct(color)).toInt());
}

export function isDisliked(color: ColorValue): boolean {
	return DislikeAnalyzer.isDisliked(hct(color));
}

export function tones(color: ColorValue): Record<Tones, ColorValue> {
	const c = hct(color);
	const toneValues: Tones[] = [
		0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100,
	];
	return Object.fromEntries(
		toneValues.map((t) => [t, fromHct(c.hue, c.chroma, t)]),
	) as Record<Tones, ColorValue>;
}

export function tone(color: ColorValue, tone: number): ColorValue {
	const c = hct(color);
	return fromHct(c.hue, c.chroma, tone);
}

export function onColor(bg: ColorValue, ratio = 4.5): ColorValue {
	const c = hct(bg);
	const fgTone =
		c.tone >= 55
			? Contrast.darkerUnsafe(c.tone, ratio)
			: Contrast.lighterUnsafe(c.tone, ratio);
	return fromHct(c.hue, c.chroma, fgTone);
}

export function underColor(fg: ColorValue, ratio = 4.5): ColorValue {
	return onColor(fg, ratio);
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
	const result = toScore(Contrast.ratioOfTones(getTone(base), getTone(on)));

	if (cvd !== false) {
		const simulations = {} as Record<ColorVisionDeficiency, ContrastScore>;
		for (const deficiency of DEFICIENCIES) {
			const simBase = simulateCVD(base, deficiency);
			const simOn = simulateCVD(on, deficiency);
			simulations[deficiency] = toScore(Contrast.ratioOfTones(getTone(simBase), getTone(simOn)));
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
	const simRatio = Contrast.ratioOfTones(getTone(simBase), getTone(simOn));
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
			const ratio = Contrast.ratioOfTones(getTone(base), getTone(on));
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

export function mix(...colors: [ColorValue, ...ColorValue[]]): ColorValue {
	if (colors.length === 1) return colors[0];

	const hcts = colors.map((c) => hct(c));
	const n = hcts.length;

	let sinSum = 0;
	let cosSum = 0;
	let chromaSum = 0;
	let toneSum = 0;

	for (const c of hcts) {
		const rad = (c.hue * Math.PI) / 180;
		sinSum += Math.sin(rad);
		cosSum += Math.cos(rad);
		chromaSum += c.chroma;
		toneSum += c.tone;
	}

	const avgHue = ((Math.atan2(sinSum / n, cosSum / n) * 180) / Math.PI + 360) % 360;
	const avgChroma = Math.max(0, chromaSum / n);
	const avgTone = Math.max(0, Math.min(100, toneSum / n));

	return fromHct(avgHue, avgChroma, avgTone);
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
	const source = Hct.fromInt(toNumber(color));
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
	source: Hct,
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
		primary: fromNumber(scheme.primary),
		"primary-dim": fromNumber(scheme.primaryDim),
		"on-primary": fromNumber(scheme.onPrimary),
		"primary-container": fromNumber(scheme.primaryContainer),
		"on-primary-container": fromNumber(scheme.onPrimaryContainer),
		"primary-fixed": fromNumber(scheme.primaryFixed),
		"primary-fixed-dim": fromNumber(scheme.primaryFixedDim),
		"on-primary-fixed": fromNumber(scheme.onPrimaryFixed),
		"on-primary-fixed-variant": fromNumber(scheme.onPrimaryFixedVariant),
		secondary: fromNumber(scheme.secondary),
		"secondary-dim": fromNumber(scheme.secondaryDim),
		"on-secondary": fromNumber(scheme.onSecondary),
		"secondary-container": fromNumber(scheme.secondaryContainer),
		"on-secondary-container": fromNumber(scheme.onSecondaryContainer),
		"secondary-fixed": fromNumber(scheme.secondaryFixed),
		"secondary-fixed-dim": fromNumber(scheme.secondaryFixedDim),
		"on-secondary-fixed": fromNumber(scheme.onSecondaryFixed),
		"on-secondary-fixed-variant": fromNumber(scheme.onSecondaryFixedVariant),
		tertiary: fromNumber(scheme.tertiary),
		"tertiary-dim": fromNumber(scheme.tertiaryDim),
		"on-tertiary": fromNumber(scheme.onTertiary),
		"tertiary-container": fromNumber(scheme.tertiaryContainer),
		"on-tertiary-container": fromNumber(scheme.onTertiaryContainer),
		"tertiary-fixed": fromNumber(scheme.tertiaryFixed),
		"tertiary-fixed-dim": fromNumber(scheme.tertiaryFixedDim),
		"on-tertiary-fixed": fromNumber(scheme.onTertiaryFixed),
		"on-tertiary-fixed-variant": fromNumber(scheme.onTertiaryFixedVariant),
		error: fromNumber(scheme.error),
		"error-dim": fromNumber(scheme.errorDim),
		"on-error": fromNumber(scheme.onError),
		"error-container": fromNumber(scheme.errorContainer),
		"on-error-container": fromNumber(scheme.onErrorContainer),
		background: fromNumber(scheme.background),
		"on-background": fromNumber(scheme.onBackground),
		surface: fromNumber(scheme.surface),
		"surface-dim": fromNumber(scheme.surfaceDim),
		"surface-bright": fromNumber(scheme.surfaceBright),
		"surface-container-lowest": fromNumber(scheme.surfaceContainerLowest),
		"surface-container-low": fromNumber(scheme.surfaceContainerLow),
		"surface-container": fromNumber(scheme.surfaceContainer),
		"surface-container-high": fromNumber(scheme.surfaceContainerHigh),
		"surface-container-highest": fromNumber(scheme.surfaceContainerHighest),
		"surface-variant": fromNumber(scheme.surfaceVariant),
		"on-surface": fromNumber(scheme.onSurface),
		"on-surface-variant": fromNumber(scheme.onSurfaceVariant),
		outline: fromNumber(scheme.outline),
		"outline-variant": fromNumber(scheme.outlineVariant),
		shadow: fromNumber(scheme.shadow),
		scrim: fromNumber(scheme.scrim),
		"surface-tint": fromNumber(scheme.surfaceTint),
		"inverse-surface": fromNumber(scheme.inverseSurface),
		"inverse-on-surface": fromNumber(scheme.inverseOnSurface),
		"inverse-primary": fromNumber(scheme.inversePrimary),
	};
}
