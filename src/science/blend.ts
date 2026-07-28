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

import { Cam16, Hct } from '../hct';
import {
	lstarFromArgb,
	differenceDegrees,
	rotationDirection,
	sanitizeDegreesDouble
} from '../utils';

// material_color_utilities is designed to have a consistent API across
// platforms and modular components that can be moved around easily. Using a
// class as a namespace facilitates this.
//

/**
 * Functions for blending in HCT and CAM16.
 */
export const Blend = {
	/**
	 * Blend the design color's HCT hue towards the key color's HCT
	 * hue, in a way that leaves the original color recognizable and
	 * recognizably shifted towards the key color.
	 *
	 * @param designColor ARGB representation of an arbitrary color.
	 * @param sourceColor ARGB representation of the main theme color.
	 * @return The design color with a hue shifted towards the
	 * system's color, a slightly warmer/cooler variant of the design
	 * color's hue.
	 */
	harmonize(designColor: number, sourceColor: number): number {
		const fromHct = Hct.fromInt(designColor);
		const toHct = Hct.fromInt(sourceColor);
		const difference = differenceDegrees(fromHct.hue, toHct.hue);
		const rotationDegrees = Math.min(difference * 0.5, 15.0);
		const outputHue = sanitizeDegreesDouble(
			fromHct.hue + rotationDegrees * rotationDirection(fromHct.hue, toHct.hue)
		);
		return Hct.from(outputHue, fromHct.chroma, fromHct.tone).toInt();
	},

	/**
	 * Blends hue from one color into another. The chroma and tone of
	 * the original color are maintained.
	 *
	 * @param from ARGB representation of color
	 * @param to ARGB representation of color
	 * @param amount how much blending to perform; 0.0 >= and <= 1.0
	 * @return from, with a hue blended towards to. Chroma and tone
	 * are constant.
	 */
	hctHue(from: number, to: number, amount: number): number {
		const ucs = Blend.cam16Ucs(from, to, amount);
		const ucsCam = Cam16.fromInt(ucs);
		const fromCam = Cam16.fromInt(from);
		const blended = Hct.from(ucsCam.hue, fromCam.chroma, lstarFromArgb(from));
		return blended.toInt();
	},

	/**
	 * Blend in CAM16-UCS space.
	 *
	 * @param from ARGB representation of color
	 * @param to ARGB representation of color
	 * @param amount how much blending to perform; 0.0 >= and <= 1.0
	 * @return from, blended towards to. Hue, chroma, and tone will
	 * change.
	 */
	cam16Ucs(from: number, to: number, amount: number): number {
		const fromCam = Cam16.fromInt(from);
		const toCam = Cam16.fromInt(to);
		const fromJ = fromCam.jstar;
		const fromA = fromCam.astar;
		const fromB = fromCam.bstar;
		const toJ = toCam.jstar;
		const toA = toCam.astar;
		const toB = toCam.bstar;
		const jstar = fromJ + (toJ - fromJ) * amount;
		const astar = fromA + (toA - fromA) * amount;
		const bstar = fromB + (toB - fromB) * amount;
		return Cam16.fromUcs(jstar, astar, bstar).toInt();
	}
};
