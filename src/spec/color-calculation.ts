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

import { Contrast } from '../utils/contrast';
import { Hct } from '../hct';
import { TonalPalette } from '../palette';
import { clampDouble } from '../utils';

import type { DynamicScheme } from '../scheme/dynamic-scheme';
import { DynamicColor } from '../scheme/dynamic-color';

/**
 * A delegate that provides the HCT and tone of a DynamicColor.
 */
export interface ColorCalculationDelegate {
	getArgb(scheme: DynamicScheme, color: DynamicColor): number;
	getHct(scheme: DynamicScheme, color: DynamicColor): Hct;
	getTone(scheme: DynamicScheme, color: DynamicColor): number;
}

/**
 * Base delegate for color calculation.
 */
class ColorCalculationDelegateBase implements ColorCalculationDelegate {
	getArgb(scheme: DynamicScheme, color: DynamicColor): number {
		const palette = color.palette(scheme);
		const tone = color.getTone(scheme);
		const multiplier = color.chromaMultiplier ? color.chromaMultiplier(scheme) : 1;
		if (multiplier === 1) {
			return palette.tone(tone);
		}

		const chroma = palette.chroma * multiplier;
		if (tone === 99 && Hct.isYellow(palette.hue)) {
			return TonalPalette.fromHueAndChroma(palette.hue, chroma).tone(tone);
		}
		return Hct.argbFrom(palette.hue, chroma, tone);
	}

	getHct(scheme: DynamicScheme, color: DynamicColor): Hct {
		const palette = color.palette(scheme);
		const tone = color.getTone(scheme);
		const multiplier = color.chromaMultiplier ? color.chromaMultiplier(scheme) : 1;
		if (multiplier === 1) {
			return palette.getHct(tone);
		}

		const chroma = palette.chroma * multiplier;
		if (tone === 99 && Hct.isYellow(palette.hue)) {
			return TonalPalette.fromHueAndChroma(palette.hue, chroma).getHct(tone);
		}
		return Hct.from(palette.hue, chroma, tone);
	}

	getTone(scheme: DynamicScheme, color: DynamicColor): number {
		const toneDeltaPair = color.toneDeltaPair ? color.toneDeltaPair(scheme) : undefined;

		// Case 0: tone delta constraint.
		if (toneDeltaPair) {
			const roleA = toneDeltaPair.roleA;
			const roleB = toneDeltaPair.roleB;
			const polarity = toneDeltaPair.polarity;
			const constraint = toneDeltaPair.constraint;
			const absoluteDelta =
				polarity === 'darker' ||
				(polarity === 'relative_lighter' && scheme.isDark) ||
				(polarity === 'relative_darker' && !scheme.isDark)
					? -toneDeltaPair.delta
					: toneDeltaPair.delta;

			const amRoleA = color.name === roleA.name;
			const selfRole = amRoleA ? roleA : roleB;
			const refRole = amRoleA ? roleB : roleA;
			let selfTone = selfRole.tone(scheme);
			const refTone = refRole.getTone(scheme);
			const relativeDelta = absoluteDelta * (amRoleA ? 1 : -1);

			if (constraint === 'exact') {
				selfTone = clampDouble(0, 100, refTone + relativeDelta);
			} else if (constraint === 'nearer') {
				if (relativeDelta > 0) {
					selfTone = clampDouble(
						0,
						100,
						clampDouble(refTone, refTone + relativeDelta, selfTone)
					);
				} else {
					selfTone = clampDouble(
						0,
						100,
						clampDouble(refTone + relativeDelta, refTone, selfTone)
					);
				}
			} else if (constraint === 'farther') {
				if (relativeDelta > 0) {
					selfTone = clampDouble(refTone + relativeDelta, 100, selfTone);
				} else {
					selfTone = clampDouble(0, refTone + relativeDelta, selfTone);
				}
			}

			if (color.background && color.contrastCurve) {
				const background = color.background(scheme);
				const contrastCurve = color.contrastCurve(scheme);
				if (background && contrastCurve) {
					const bgTone = background.getTone(scheme);
					const selfContrast = contrastCurve.get(scheme.contrastLevel);
					selfTone =
						Contrast.ratioOfTones(bgTone, selfTone) >= selfContrast &&
						scheme.contrastLevel >= 0
							? selfTone
							: DynamicColor.foregroundTone(bgTone, selfContrast);
				}
			}

			if (color.isBackground && !color.name.endsWith('_fixed_dim')) {
				if (selfTone >= 57) {
					selfTone = clampDouble(65, 100, selfTone);
				} else {
					selfTone = clampDouble(0, 49, selfTone);
				}
			}

			return selfTone;
		} else {
			// Case 1: No tone delta pair; just solve for itself.
			let answer = color.tone(scheme);

			if (
				color.background?.(scheme) === undefined ||
				color.contrastCurve?.(scheme) === undefined
			) {
				return answer;
			}

			const bgTone = color.background(scheme)?.getTone(scheme) ?? 50;
			const desiredRatio =
				color.contrastCurve(scheme)?.get(scheme.contrastLevel) ?? 0;

			answer =
				Contrast.ratioOfTones(bgTone, answer) >= desiredRatio &&
				scheme.contrastLevel >= 0
					? answer
					: DynamicColor.foregroundTone(bgTone, desiredRatio);

			if (color.isBackground && !color.name.endsWith('_fixed_dim')) {
				if (answer >= 57) {
					answer = clampDouble(65, 100, answer);
				} else {
					answer = clampDouble(0, 49, answer);
				}
			}

			if (color.secondBackground?.(scheme) === undefined) {
				return answer;
			}

			// Case 2: Adjust for dual backgrounds.
			const [bg1, bg2] = [color.background, color.secondBackground];
			const [bgTone1, bgTone2] = [
				bg1(scheme)?.getTone(scheme) ?? 50,
				bg2(scheme)?.getTone(scheme) ?? 50
			];
			const [upper, lower] = [Math.max(bgTone1, bgTone2), Math.min(bgTone1, bgTone2)];

			if (
				Contrast.ratioOfTones(upper, answer) >= desiredRatio &&
				Contrast.ratioOfTones(lower, answer) >= desiredRatio
			) {
				return answer;
			}

			const lightOption = Contrast.lighter(upper, desiredRatio);

			const darkOption = Contrast.darker(lower, desiredRatio);

			const availables: number[] = [];
			if (lightOption !== -1) availables.push(lightOption);
			if (darkOption !== -1) availables.push(darkOption);

			const prefersLight =
				DynamicColor.tonePrefersLightForeground(bgTone1) ||
				DynamicColor.tonePrefersLightForeground(bgTone2);
			if (prefersLight) {
				return lightOption < 0 ? 100 : lightOption;
			}
			if (availables.length === 1) {
				return availables[0] ?? 0;
			}
			return darkOption < 0 ? 0 : darkOption;
		}
	}
}

const spec = new ColorCalculationDelegateBase();

/**
 * Returns the ColorCalculationDelegate.
 */
export function getSpec(): ColorCalculationDelegate {
	return spec;
}
