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

export interface GenerateCSSSheetOptions {
	prefix?: string;
	lightSelector?: string;
	darkSelector?: string;
}

/**
 * Generate a complete CSS stylesheet with light and dark theme.
 *
 * @example
 * ```ts
 * const css = generateCSSSheet(theme, {
 *   prefix: '--md-sys-color-',
 *   darkSelector: '[data-theme="dark"]',
 * });
 * ```
 */
export function generateCSSSheet(
	theme: { light: Record<string, ColorValue>; dark: Record<string, ColorValue> },
	options?: GenerateCSSSheetOptions,
): string {
	const prefix = options?.prefix ?? "--color-";
	const lightSelector = options?.lightSelector ?? ":root";
	const darkSelector = options?.darkSelector ?? "@media (prefers-color-scheme: dark)";

	const props = (palette: Record<string, ColorValue>) =>
		Object.entries(palette)
			.map(([role, value]) => `\t${prefix}${role}: ${value};`)
			.join("\n");

	const lines: string[] = [];

	lines.push(`${lightSelector} {`);
	lines.push(props(theme.light));
	lines.push("}");

	const isMediaQuery = darkSelector.startsWith("@");
	if (isMediaQuery) {
		lines.push("");
		lines.push(`${darkSelector} {`);
		lines.push(`\t${lightSelector} {`);
		lines.push(props(theme.dark).replace(/\t/g, "\t\t"));
		lines.push("\t}");
		lines.push("}");
	} else {
		lines.push("");
		lines.push(`${darkSelector} {`);
		lines.push(props(theme.dark));
		lines.push("}");
	}

	return lines.join("\n");
}
