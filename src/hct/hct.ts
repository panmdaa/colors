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
 * A color system built using CAM16 hue and chroma, and L* from
 * L*a*b*.
 *
 * Using L* creates a link between the color system, contrast, and thus
 * accessibility. Contrast ratio depends on relative luminance, or Y in the XYZ
 * color space. L*, or perceptual luminance can be calculated from Y.
 *
 * Unlike Y, L* is linear to human perception, allowing trivial creation of
 * accurate color tones.
 *
 * Unlike contrast ratio, measuring contrast in L* is linear, and simple to
 * calculate. A difference of 40 in HCT tone guarantees a contrast ratio >= 3.0,
 * and a difference of 50 guarantees a contrast ratio >= 4.5.
 */

import { lstarFromArgb, lstarFromY } from '../utils';

import { Cam16 } from './cam16';
import { HctSolver } from './hct-solver';
import { ViewingConditions } from './viewing-conditions';

/**
 * HCT, hue, chroma, and tone. A color system that provides a perceptually
 * accurate color measurement system that can also accurately render what colors
 * will appear as in different lighting environments.
 */
export class Hct {
	/**
	 * @param hue 0 <= hue < 360; invalid values are corrected.
	 * @param chroma 0 <= chroma < ?; Informally, colorfulness. The color
	 *     returned may be lower than the requested chroma. Chroma has a different
	 *     maximum for any given hue and tone.
	 * @param tone 0 <= tone <= 100; invalid values are corrected.
	 * @return HCT representation of a color in default viewing conditions.
	 */

	internalHue: number;
	internalChroma: number;
	internalTone: number;

	static from(hue: number, chroma: number, tone: number) {
		return new Hct(HctSolver.solveToInt(hue, chroma, tone));
	}

	static argbFrom(hue: number, chroma: number, tone: number): number {
		return HctSolver.solveToInt(hue, chroma, tone);
	}

	/**
	 * @param argb ARGB representation of a color.
	 * @return HCT representation of a color in default viewing conditions
	 */
	static fromInt(argb: number) {
		return new Hct(argb);
	}

	toInt(): number {
		return this.argb;
	}

	/**
	 * A number, in degrees, representing ex. red, orange, yellow, etc.
	 * Ranges from 0 <= hue < 360.
	 */
	get hue(): number {
		return this.internalHue;
	}

	/**
	 * @param newHue 0 <= newHue < 360; invalid values are corrected.
	 * Chroma may decrease because chroma has a different maximum for any given
	 * hue and tone.
	 */
	set hue(newHue: number) {
		this.setInternalState(HctSolver.solveToInt(newHue, this.internalChroma, this.internalTone));
	}

	get chroma(): number {
		return this.internalChroma;
	}

	/**
	 * @param newChroma 0 <= newChroma < ?
	 * Chroma may decrease because chroma has a different maximum for any given
	 * hue and tone.
	 */
	set chroma(newChroma: number) {
		this.setInternalState(HctSolver.solveToInt(this.internalHue, newChroma, this.internalTone));
	}

	/** Lightness. Ranges from 0 to 100. */
	get tone(): number {
		return this.internalTone;
	}

	/**
	 * @param newTone 0 <= newTone <= 100; invalid valids are corrected.
	 * Chroma may decrease because chroma has a different maximum for any given
	 * hue and tone.
	 */
	set tone(newTone: number) {
		this.setInternalState(HctSolver.solveToInt(this.internalHue, this.internalChroma, newTone));
	}

	/** Sets a property of the Hct object. */
	setValue(propertyName: string, value: number) {
		(this as unknown as Record<string, number>)[propertyName] = value;
	}

	toString(): string {
		return `HCT(${this.hue.toFixed(0)}, ${this.chroma.toFixed(0)}, ${this.tone.toFixed(0)})`;
	}

	static isBlue(hue: number): boolean {
		return hue >= 250 && hue < 270;
	}

	static isYellow(hue: number): boolean {
		return hue >= 105 && hue < 125;
	}

	static isCyan(hue: number): boolean {
		return hue >= 170 && hue < 207;
	}

	private constructor(private argb: number) {
		const cam = Cam16.fromInt(argb);
		this.internalHue = cam.hue;
		this.internalChroma = cam.chroma;
		this.internalTone = lstarFromArgb(argb);
		this.argb = argb;
	}

	private setInternalState(argb: number) {
		const cam = Cam16.fromInt(argb);
		this.internalHue = cam.hue;
		this.internalChroma = cam.chroma;
		this.internalTone = lstarFromArgb(argb);
		this.argb = argb;
	}

	/**
	 * Translates a color into different [ViewingConditions].
	 *
	 * Colors change appearance. They look different with lights on versus off,
	 * the same color, as in hex code, on white looks different when on black.
	 * This is called color relativity, most famously explicated by Josef Albers
	 * in Interaction of Color.
	 *
	 * In color science, color appearance models can account for this and
	 * calculate the appearance of a color in different settings. HCT is based on
	 * CAM16, a color appearance model, and uses it to make these calculations.
	 *
	 * See [ViewingConditions.make] for parameters affecting color appearance.
	 */
	inViewingConditions(vc: ViewingConditions): Hct {
		// 1. Use CAM16 to find XYZ coordinates of color in specified VC.
		const cam = Cam16.fromInt(this.toInt());
		const viewedInVc = cam.xyzInViewingConditions(vc);

		// 2. Create CAM16 of those XYZ coordinates in default VC.
		const recastInVc = Cam16.fromXyzInViewingConditions(
			viewedInVc[0] ?? 0,
			viewedInVc[1] ?? 0,
			viewedInVc[2] ?? 0,
			ViewingConditions.make()
		);

		// 3. Create HCT from:
		// - CAM16 using default VC with XYZ coordinates in specified VC.
		// - L* converted from Y in XYZ coordinates in specified VC.
		const recastHct = Hct.from(
			recastInVc.hue,
			recastInVc.chroma,
			lstarFromY(viewedInVc[1] ?? 0)
		);
		return recastHct;
	}
}
