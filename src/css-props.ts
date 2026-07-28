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

import type { ColorValue, Palette } from "./types";

export interface GenerateCSSOptions {
	prefix?: string;
	transform?: (role: string, value: ColorValue) => string;
}

export function generateCSS(
	palette: Palette,
	options?: GenerateCSSOptions,
): string {
	const { prefix = "--color-", transform } = options ?? {};
	return Object.entries(palette)
		.map(([role, value]) => {
			if (transform) return transform(role, value);
			return `${prefix}${role}: ${value};`;
		})
		.join("\n");
}
