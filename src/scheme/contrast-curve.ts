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

import { lerp } from '../utils';

/**
 * A class containing a value that changes with the contrast level.
 *
 * Usually represents the contrast requirements for a dynamic color on its
 * background. The four values correspond to values for contrast levels -1.0,
 * 0.0, 0.5, and 1.0, respectively.
 */
export class ContrastCurve {
	/**
	 * Creates a `ContrastCurve` object.
	 *
	 * @param low Value for contrast level -1.0
	 * @param normal Value for contrast level 0.0
	 * @param medium Value for contrast level 0.5
	 * @param high Value for contrast level 1.0
	 */
	constructor(
		readonly low: number,
		readonly normal: number,
		readonly medium: number,
		readonly high: number
	) {}

	/**
	 * Returns the value at a given contrast level.
	 *
	 * @param contrastLevel The contrast level. 0.0 is the default (normal); -1.0
	 *     is the lowest; 1.0 is the highest.
	 * @return The value. For contrast ratios, a number between 1.0 and 21.0.
	 */
	get(contrastLevel: number): number {
		if (contrastLevel <= -1.0) {
			return this.low;
		} else if (contrastLevel < 0.0) {
			return lerp(this.low, this.normal, (contrastLevel - -1) / 1);
		} else if (contrastLevel < 0.5) {
			return lerp(this.normal, this.medium, (contrastLevel - 0) / 0.5);
		} else if (contrastLevel < 1.0) {
			return lerp(this.medium, this.high, (contrastLevel - 0.5) / 0.5);
		} else {
			return this.high;
		}
	}
}
