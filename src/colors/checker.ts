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

import { Color } from "../color-class";
import { simulateCVD } from "../science";
import { Contrast } from "../utils";
import type {
	ColorValue,
	ColorVisionDeficiency,
	ContrastScore,
	ContrastScoreCVD,
	PaletteCheckerMode,
	PaletteCheckerPair,
	PaletteCheckerResult,
	PaletteCheckerSimulation,
} from "../types";

function mapRange(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
	return toMin + ((value - fromMin) / (fromMax - fromMin)) * (toMax - toMin);
}

function clampScore(value: number): number {
	return Math.min(10, Math.max(0, value));
}

function scoreOverall(ratio: number): number {
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
	return {
		ratio,
		score: scoreOverall(ratio),
		smallText: scoreSmallText(ratio),
		largeText: scoreLargeText(ratio),
	};
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

function buildSimulation(base: ColorValue, on: ColorValue, deficiency: ColorVisionDeficiency): PaletteCheckerSimulation {
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

function scanPairs(palette: Record<string, ColorValue>, cvd: boolean): PaletteCheckerMode {
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

			const pair: PaletteCheckerPair = { role, onRole, base, on, score, AA, AALarge, AAA };

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
export function paletteChecker(palette: Record<string, ColorValue>): PaletteCheckerMode;
export function paletteChecker(palette: Record<string, ColorValue>, cvd: false): PaletteCheckerMode;
export function paletteChecker(palette: Record<string, ColorValue>, cvd?: boolean): PaletteCheckerMode;
export function paletteChecker(
	input: ({ color: ColorValue; light: Record<string, ColorValue>; dark: Record<string, ColorValue> }) | Record<string, ColorValue>,
	cvd?: boolean,
): PaletteCheckerResult | PaletteCheckerMode {
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

	return scanPairs(input as Record<string, ColorValue>, cvd !== false);
}
