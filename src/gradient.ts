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

import { Hct } from "./hct";
import { argbFromHex, hexFromArgb, clampDouble } from "./utils";
import type { ColorValue } from "./types";

export function gradient(
	from: ColorValue,
	to: ColorValue,
	count: number,
): ColorValue[] {
	if (count < 2) return [from];
	const a = Hct.fromInt(argbFromHex(from));
	const b = Hct.fromInt(argbFromHex(to));
	const result: ColorValue[] = [];
	for (let i = 0; i < count; i++) {
		const t = i / (count - 1);
		const hue = a.hue + (b.hue - a.hue) * t;
		const chroma = a.chroma + (b.chroma - a.chroma) * t;
		const tone = a.tone + (b.tone - a.tone) * t;
		result.push(hexFromArgb(Hct.from(hue, Math.max(0, chroma), clampDouble(0, 100, tone)).toInt()) as ColorValue);
	}
	return result;
}
