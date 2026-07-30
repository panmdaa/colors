/**
 * @license
 * Copyright 2026 Panmdaa
 *
 * Color vision deficiency simulation based on:
 *   Machado, Oliveira & Fernandes (2009)
 *   "A Physiologically-based Model for Simulation of Color Vision Deficiency"
 *   IEEE Transactions on Visualization and Computer Graphics, 15(6), 1291-1298.
 *
 * Matrices from Machado (2010) PhD thesis — same model Chrome DevTools uses.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { argbFromLinrgb, linearized, redFromArgb, greenFromArgb, blueFromArgb } from "../utils";
import { argbFromHex, hexFromArgb } from "../utils/string";
import type { ColorValue, ColorVisionDeficiency, CVDSeverity } from "../types";

/**
 * Pre-computed linear RGB transformation matrices at full severity (1.0)
 * for dichromacy simulation, from Machado (2010).
 *
 * Applied to linear RGB values in [0, 1] range.
 */
const CVD_MATRICES: Record<ColorVisionDeficiency, number[][]> = {
	protanopia: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	deuteranopia: [
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.011820, 0.042940, 0.968881],
	],
	tritanopia: [
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.303900],
	],
};

/**
 * Pre-computed linear RGB transformation matrices at mild severity (~0.5)
 * for anomalous trichromacy simulation, from Machado (2010).
 */
const CVD_MATRICES_MILD: Record<ColorVisionDeficiency, number[][]> = {
	protanopia: [
		[0.458064, 0.679578, -0.137642],
		[0.092785, 0.846313, 0.060902],
		[-0.007494, -0.016807, 1.024301],
	],
	deuteranopia: [
		[0.547494, 0.607765, -0.155259],
		[0.181692, 0.781742, 0.036566],
		[-0.010410, 0.027275, 0.983136],
	],
	tritanopia: [
		[0.948035, 0.089490, -0.037526],
		[0.014364, 0.946792, 0.038844],
		[0.010853, 0.193991, 0.795156],
	],
};

function applyMatrix(
	rgb: [number, number, number],
	matrix: number[][],
): [number, number, number] {
	const [r, g, b] = rgb;
	return [
		r * matrix[0]![0]! + g * matrix[0]![1]! + b * matrix[0]![2]!,
		r * matrix[1]![0]! + g * matrix[1]![1]! + b * matrix[1]![2]!,
		r * matrix[2]![0]! + g * matrix[2]![1]! + b * matrix[2]![2]!,
	];
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/**
 * Convert a hex color to linear RGB values in [0, 1] range.
 */
function hexToLinearRgb01(hex: ColorValue): [number, number, number] {
	const argb = argbFromHex(hex);
	const r = linearized(redFromArgb(argb)) / 100;
	const g = linearized(greenFromArgb(argb)) / 100;
	const b = linearized(blueFromArgb(argb)) / 100;
	return [r, g, b];
}

/**
 * Convert linear RGB values in [0, 1] range back to a hex color.
 */
function linearRgb01ToHex(r: number, g: number, b: number): ColorValue {
	return hexFromArgb(argbFromLinrgb([clamp01(r) * 100, clamp01(g) * 100, clamp01(b) * 100])) as ColorValue;
}

/**
 * Simulate a color as perceived by someone with the given color vision deficiency.
 *
 * Uses the Machado (2009) physiologically-based model — the same algorithm
 * Chrome DevTools uses for "Emulate vision deficiencies".
 *
 * @example
 * ```ts
 * simulateCVD("#ff0000", "protanopia") // → "#665900"
 * simulateCVD("#00ff00", "deuteranopia") // → "#998700"
 * ```
 */
export function simulateCVD(
	color: ColorValue,
	deficiency: ColorVisionDeficiency,
	severity: CVDSeverity = "full",
): ColorValue {
	const matrix = severity === "full" ? CVD_MATRICES[deficiency] : CVD_MATRICES_MILD[deficiency];
	const linear = hexToLinearRgb01(color);
	const simulated = applyMatrix(linear, matrix);
	return linearRgb01ToHex(simulated[0], simulated[1], simulated[2]);
}

/**
 * Simulate a color under all three common color vision deficiencies at once.
 *
 * @example
 * ```ts
 * simulateAllCVD("#ff0000")
 * // → { protanopia: "#665900", deuteranopia: "#998700", tritanopia: "#ff000e" }
 * ```
 */
export function simulateAllCVD(
	color: ColorValue,
	severity: CVDSeverity = "full",
): Record<ColorVisionDeficiency, ColorValue> {
	const linear = hexToLinearRgb01(color);

	const matrices = severity === "full" ? CVD_MATRICES : CVD_MATRICES_MILD;

	const result = {} as Record<ColorVisionDeficiency, ColorValue>;
	for (const key of Object.keys(matrices) as ColorVisionDeficiency[]) {
		const simulated = applyMatrix(linear, matrices[key]!);
		result[key] = linearRgb01ToHex(simulated[0], simulated[1], simulated[2]);
	}
	return result;
}
