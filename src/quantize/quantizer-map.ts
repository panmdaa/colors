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

import { alphaFromArgb } from '../utils';

/**
 * Quantizes an image into a map, with keys of ARGB colors, and values of the
 * number of times that color appears in the image.
 */
// material_color_utilities is designed to have a consistent API across
// platforms and modular components that can be moved around easily. Using a
// class as a namespace facilitates this.
//
export const QuantizerMap = {
	/**
	 * @param pixels Colors in ARGB format.
	 * @return A Map with keys of ARGB colors, and values of the number of times
	 *     the color appears in the image.
	 */
	quantize(pixels: number[]): Map<number, number> {
		const countByColor = new Map<number, number>();
		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for (let i = 0; i < pixels.length; i++) {
			const pixel = pixels[i];
			const alpha = alphaFromArgb(pixel ?? 0);
			if (alpha < 255) {
				continue;
			}
			countByColor.set(pixel ?? 0, (countByColor.get(pixel ?? 0) ?? 0) + 1);
		}
		return countByColor;
	}
};
