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

// material_color_utilities is designed to have a consistent API across
// platforms and modular components that can be moved around easily. Using a
// class as a namespace facilitates this.
//

/**
 * Check and/or fix universally disliked colors.
 * Color science studies of color preference indicate universal distaste for
 * dark yellow-greens, and also show this is correlated to distate for
 * biological waste and rotting food.
 *
 * See Palmer and Schloss, 2010 or Schloss and Palmer's Chapter 21 in Handbook
 * of Color Psychology (2015).
 */
export const DislikeAnalyzer = {
	/**
	 * Returns true if a color is disliked.
	 *
	 * @param hct A color to be judged.
	 * @return Whether the color is disliked.
	 *
	 * Disliked is defined as a dark yellow-green that is not neutral.
	 */
	isDisliked(hct: Hct): boolean {
		const huePasses = Math.round(hct.hue) >= 90.0 && Math.round(hct.hue) <= 111.0;
		const chromaPasses = Math.round(hct.chroma) > 16.0;
		const tonePasses = Math.round(hct.tone) < 65.0;

		return huePasses && chromaPasses && tonePasses;
	},

	/**
	 * If a color is disliked, lighten it to make it likable.
	 *
	 * @param hct A color to be judged.
	 * @return A new color if the original color is disliked, or the original
	 *   color if it is acceptable.
	 */
	fixIfDisliked(hct: Hct): Hct {
		if (DislikeAnalyzer.isDisliked(hct)) {
			return Hct.from(hct.hue, hct.chroma, 70.0);
		}

		return hct;
	}
};
