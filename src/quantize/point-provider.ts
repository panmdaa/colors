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

/**
 * An interface to allow use of different color spaces by
 * quantizers.
 */

export declare interface PointProvider {
	toInt(point: number[]): number;
	fromInt(argb: number): number[];
	distance(from: number[], to: number[]): number;
}
