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
import { ContrastCurve } from '../scheme/contrast-curve';
import type { DynamicScheme } from '../scheme/dynamic-scheme';
import { Variant } from '../scheme/variant';
import type { TonalPalette } from '../palette';
import { clampDouble } from '../utils';

export function isFidelity(scheme: DynamicScheme): boolean {
	return scheme.variant === Variant.FIDELITY || scheme.variant === Variant.CONTENT;
}

export function isMonochrome(scheme: DynamicScheme): boolean {
	return scheme.variant === Variant.MONOCHROME;
}

export function findDesiredChromaByTone(
	hue: number,
	chroma: number,
	tone: number,
	byDecreasingTone: boolean
): number {
	let answer = tone;

	let closestToChroma = Hct.from(hue, chroma, tone);
	if (closestToChroma.chroma < chroma) {
		let chromaPeak = closestToChroma.chroma;
		while (closestToChroma.chroma < chroma) {
			answer += byDecreasingTone ? -1.0 : 1.0;
			const potentialSolution = Hct.from(hue, chroma, answer);
			if (chromaPeak > potentialSolution.chroma) {
				break;
			}
			if (Math.abs(potentialSolution.chroma - chroma) < 0.4) {
				break;
			}

			const potentialDelta = Math.abs(potentialSolution.chroma - chroma);
			const currentDelta = Math.abs(closestToChroma.chroma - chroma);
			if (potentialDelta < currentDelta) {
				closestToChroma = potentialSolution;
			}
			chromaPeak = Math.max(chromaPeak, potentialSolution.chroma);
		}
	}

	return answer;
}

export function findBestToneForChroma(
	hue: number,
	chroma: number,
	tone: number,
	byDecreasingTone: boolean
): number {
	let answer = tone;
	let bestCandidate = Hct.from(hue, chroma, answer);
	while (bestCandidate.chroma < chroma) {
		if (tone < 0 || tone > 100) {
			break;
		}
		tone += byDecreasingTone ? -1.0 : 1.0;
		const newCandidate = Hct.from(hue, chroma, tone);
		if (bestCandidate.chroma < newCandidate.chroma) {
			bestCandidate = newCandidate;
			answer = tone;
		}
	}

	return answer;
}

export function tMaxC(
	palette: TonalPalette,
	lowerBound = 0,
	upperBound = 100,
	chromaMultiplier = 1
): number {
	const answer = findBestToneForChroma(palette.hue, palette.chroma * chromaMultiplier, 100, true);
	return clampDouble(lowerBound, upperBound, answer);
}

export function tMinC(palette: TonalPalette, lowerBound = 0, upperBound = 100): number {
	const answer = findBestToneForChroma(palette.hue, palette.chroma, 0, false);
	return clampDouble(lowerBound, upperBound, answer);
}

export function getCurve(defaultContrast: number): ContrastCurve {
	if (defaultContrast === 1.5) {
		return new ContrastCurve(1.5, 1.5, 3, 5.5);
	} else if (defaultContrast === 3) {
		return new ContrastCurve(3, 3, 4.5, 7);
	} else if (defaultContrast === 4.5) {
		return new ContrastCurve(4.5, 4.5, 7, 11);
	} else if (defaultContrast === 6) {
		return new ContrastCurve(6, 6, 7, 11);
	} else if (defaultContrast === 7) {
		return new ContrastCurve(7, 7, 11, 21);
	} else if (defaultContrast === 9) {
		return new ContrastCurve(9, 9, 11, 21);
	} else if (defaultContrast === 11) {
		return new ContrastCurve(11, 11, 21, 21);
	} else if (defaultContrast === 21) {
		return new ContrastCurve(21, 21, 21, 21);
	} else {
		return new ContrastCurve(defaultContrast, defaultContrast, 7, 21);
	}
}
