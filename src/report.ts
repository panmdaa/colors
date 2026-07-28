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

import { Contrast } from "./utils";
import { getTone } from "./color";
import type { ColorValue } from "./types";

export interface ContrastPair {
	role: string;
	onRole: string;
	ratio: number;
	AA: boolean;
	AALarge: boolean;
	AAA: boolean;
}

export interface ContrastReport {
	pairs: ContrastPair[];
	summary: {
		total: number;
		passingAA: number;
		passingAAA: number;
	};
}

function checkPair(bg: ColorValue, fg: ColorValue): {
	ratio: number;
	AA: boolean;
	AALarge: boolean;
	AAA: boolean;
} {
	const ratio = Contrast.ratioOfTones(getTone(bg), getTone(fg));
	return {
		ratio,
		AA: ratio >= 4.5,
		AALarge: ratio >= 3.0,
		AAA: ratio >= 7.0,
	};
}

/**
 * Generate a WCAG contrast report for all on-* pairs in a palette.
 *
 * @example
 * ```ts
 * const { pairs, summary } = report(theme);
 * // summary → { total: 14, passingAA: 14, passingAAA: 10 }
 * ```
 */
export function report(
	theme: { light: Record<string, ColorValue>; dark: Record<string, ColorValue> },
	mode: "light" | "dark" = "light",
): ContrastReport {
	const palette = mode === "light" ? theme.light : theme.dark;
	const pairs: ContrastPair[] = [];

	const handledOnRoles = new Set<string>();

	for (const role of Object.keys(palette)) {
		const onRole = `on-${role}`;
		if (onRole in palette && !handledOnRoles.has(onRole)) {
			handledOnRoles.add(onRole);
			const bg = palette[role];
			const fg = palette[onRole];
			const { ratio, AA, AALarge, AAA } = checkPair(bg, fg);
			pairs.push({ role, onRole, ratio, AA, AALarge, AAA });
		}
	}

	const total = pairs.length;
	const passingAA = pairs.filter((p) => p.AA).length;
	const passingAAA = pairs.filter((p) => p.AAA).length;

	return { pairs, summary: { total, passingAA, passingAAA } };
}
