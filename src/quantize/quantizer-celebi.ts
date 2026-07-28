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

import { QuantizerWsmeans } from './quantizer-wsmeans';
import { QuantizerWu } from './quantizer-wu';

/**
 * An image quantizer that improves on the quality of a standard K-Means
 * algorithm by setting the K-Means initial state to the output of a Wu
 * quantizer, instead of random centroids. Improves on speed by several
 * optimizations, as implemented in Wsmeans, or Weighted Square Means, K-Means
 * with those optimizations.
 *
 * This algorithm was designed by M. Emre Celebi, and was found in their 2011
 * paper, Improving the Performance of K-Means for Color Quantization.
 * https://arxiv.org/abs/1101.0395
 */
// material_color_utilities is designed to have a consistent API across
// platforms and modular components that can be moved around easily. Using a
// class as a namespace facilitates this.
//
export const QuantizerCelebi = {
	/**
	 * @param pixels Colors in ARGB format.
	 * @param maxColors The number of colors to divide the image into. A lower
	 *     number of colors may be returned.
	 * @return Map with keys of colors in ARGB format, and values of number of
	 *     pixels in the original image that correspond to the color in the
	 *     quantized image.
	 */
	quantize(pixels: number[], maxColors: number): Map<number, number> {
		const wu = new QuantizerWu();
		const wuResult = wu.quantize(pixels, maxColors);
		return QuantizerWsmeans.quantize(pixels, wuResult, maxColors);
	}
};
