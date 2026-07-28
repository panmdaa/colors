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

import { argbFromLab, labFromArgb } from '../utils';

import type { PointProvider } from './point-provider';

/**
 * Provides conversions needed for K-Means quantization. Converting input to
 * points, and converting the final state of the K-Means algorithm to colors.
 */
export class LabPointProvider implements PointProvider {
	/**
	 * Convert a color represented in ARGB to a 3-element array of L*a*b*
	 * coordinates of the color.
	 */
	fromInt(argb: number): number[] {
		return labFromArgb(argb);
	}

	/**
	 * Convert a 3-element array to a color represented in ARGB.
	 */
	toInt(point: number[]): number {
		return argbFromLab(point[0] ?? 0, point[1] ?? 0, point[2] ?? 0);
	}

	/**
	 * Standard CIE 1976 delta E formula also takes the square root, unneeded
	 * here. This method is used by quantization algorithms to compare distance,
	 * and the relative ordering is the same, with or without a square root.
	 *
	 * This relatively minor optimization is helpful because this method is
	 * called at least once for each pixel in an image.
	 */
	distance(from: number[], to: number[]): number {
		const dL = (from[0] ?? 0) - (to[0] ?? 0);
		const dA = (from[1] ?? 0) - (to[1] ?? 0);
		const dB = (from[2] ?? 0) - (to[2] ?? 0);
		return dL * dL + dA * dA + dB * dB;
	}
}
