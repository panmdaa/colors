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

import { QuantizerCelebi } from '../quantize';
import { Score } from './score';

import { argbFromRgb } from '../utils';

/**
 * Get the source color from an image.
 *
 * @param image The image element
 * @return Source color - the color most suitable for creating a UI theme
 */
export async function sourceColorFromImage(image: HTMLImageElement) {
	// Convert Image data to Pixel Array
	const imageBytes = await new Promise<Uint8ClampedArray>((resolve, reject) => {
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		if (!context) {
			reject(new Error('Could not get canvas context'));
			return;
		}
		const loadCallback = () => {
			canvas.width = image.width;
			canvas.height = image.height;
			context.drawImage(image, 0, 0);
			let rect = [0, 0, image.width, image.height];
			const area = image.dataset['area'];
			if (area && /^\d+(\s*,\s*\d+){3}$/.test(area)) {
				rect = area.split(/\s*,\s*/).map((s) => {
					return parseInt(s, 10);
				});
			}
			const [sx, sy, sw, sh] = rect;
			resolve(context.getImageData(sx ?? 0, sy ?? 0, sw ?? 0, sh ?? 0).data);
		};
		const errorCallback = () => {
			reject(new Error('Image load failed'));
		};
		if (image.complete) {
			loadCallback();
		} else {
			image.onload = loadCallback;
			image.onerror = errorCallback;
		}
	});

	return sourceColorFromImageBytes(imageBytes);
}

/**
 * Get the source color from image bytes.
 *
 * @param imageBytes The image bytes
 * @return Source color - the color most suitable for creating a UI theme
 */
export function sourceColorFromImageBytes(imageBytes: Uint8ClampedArray) {
	// Convert Image data to Pixel Array
	const pixels: number[] = [];
	for (let i = 0; i < imageBytes.length; i += 4) {
		const r = imageBytes[i] ?? 0;
		const g = imageBytes[i + 1] ?? 0;
		const b = imageBytes[i + 2] ?? 0;
		const a = imageBytes[i + 3] ?? 0;
		if (a < 255) {
			continue;
		}
		const argb = argbFromRgb(r, g, b);
		pixels.push(argb);
	}

	// Convert Pixels to Material Colors
	const result = QuantizerCelebi.quantize(pixels, 128);
	const ranked = Score.score(result);
	const top = ranked[0];
	return top;
}
