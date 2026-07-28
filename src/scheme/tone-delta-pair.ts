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

import type { DynamicColor } from './dynamic-color';

/**
 * Describes the different in tone between colors.
 *
 * nearer and farther are deprecated. Use DeltaConstraint instead.
 */
export type TonePolarity =
	'darker' | 'lighter' | 'nearer' | 'farther' | 'relative_darker' | 'relative_lighter';

/**
 * Describes how to fulfill a tone delta pair constraint.
 */
export type DeltaConstraint = 'exact' | 'nearer' | 'farther';

/**
 * Documents a constraint between two DynamicColors, in which their tones must
 * have a certain distance from each other.
 *
 * Prefer a DynamicColor with a background, this is for special cases when
 * designers want tonal distance, literally contrast, between two colors that
 * don't have a background / foreground relationship or a contrast guarantee.
 */
export class ToneDeltaPair {
	/**
	 * Documents a constraint in tone distance between two DynamicColors.
	 *
	 * The polarity is an adjective that describes "A", compared to "B".
	 *
	 * For instance, ToneDeltaPair(A, B, 15, 'darker', 'exact') states that
	 * A's tone should be exactly 15 darker than B's.
	 *
	 * 'relative_darker' and 'relative_lighter' describes the tone adjustment
	 * relative to the surface color trend (white in light mode; black in dark
	 * mode). For instance, ToneDeltaPair(A, B, 10, 'relative_lighter',
	 * 'farther') states that A should be at least 10 lighter than B in light
	 * mode, and at least 10 darker than B in dark mode.
	 *
	 * @param roleA The first role in a pair.
	 * @param roleB The second role in a pair.
	 * @param delta Required difference between tones. Absolute value, negative
	 * values have undefined behavior.
	 * @param polarity The relative relation between tones of roleA and roleB,
	 * as described above.
	 * @param constraint How to fulfill the tone delta pair constraint.
	 * @param stayTogether Whether these two roles should stay on the same side
	 * of the "awkward zone" (T50-59). This is necessary for certain cases where
	 * one role has two backgrounds.
	 */
	constructor(
		readonly roleA: DynamicColor,
		readonly roleB: DynamicColor,
		readonly delta: number,
		readonly polarity: TonePolarity,
		readonly stayTogether: boolean,
		readonly constraint?: DeltaConstraint
	) {
		this.constraint = constraint ?? 'exact';
	}
}
