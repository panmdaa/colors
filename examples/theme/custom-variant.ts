/**
 * Custom variant (extending VariantScheme).
 *
 * If the 15 built-in variants are not enough, create your own by extending
 * VariantScheme and overriding only the palette methods you need. The result
 * is passed to palette() just like a string variant.
 *
 * Run with:  npx tsx examples/theme/custom-variant.ts
 */

import {
	Hct,
	VariantScheme,
	SchemeVariant,
	palette,
	Color,
} from "@panmdaa/colors";

class BrandSoft extends VariantScheme {
	constructor(sourceColorOrList: Hct | Hct[], isDark: boolean, contrastLevel: number) {
		super(sourceColorOrList, isDark, contrastLevel, SchemeVariant.TONAL_SPOT);
	}

	static override primaryPalette(sourceColorOrList: Hct | Hct[], isDark: boolean, _contrastLevel: number) {
		const source = Array.isArray(sourceColorOrList)
			? sourceColorOrList[0] ?? Hct.fromInt(0)
			: sourceColorOrList;
		return this.tonalPalette(source.hue, isDark ? 16 : 20);
	}

	static override secondaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const source = Array.isArray(sourceColorOrList)
			? sourceColorOrList[0] ?? Hct.fromInt(0)
			: sourceColorOrList;
		return this.tonalPalette(source.hue, 12);
	}

	static override tertiaryPalette(sourceColorOrList: Hct | Hct[], _isDark: boolean, _contrastLevel: number) {
		const source = Array.isArray(sourceColorOrList)
			? sourceColorOrList[0] ?? Hct.fromInt(0)
			: sourceColorOrList;
		return this.tonalPalette((source.hue + 40) % 360, 24);
	}
}

const theme = palette("#744c9d", { variant: BrandSoft });

console.log("\n=== Theme with custom BrandSoft variant ===");
console.log("light.primary:", theme.light.primary);
console.log("light.secondary:", theme.light.secondary);
console.log("light.tertiary:", theme.light.tertiary);
console.log("dark.primary:", theme.dark.primary);
console.log("dark.tertiary:", theme.dark.tertiary);

// Compare against the standard tonal-spot
const standard = palette("#744c9d", { variant: "tonal-spot" });
console.log("\n=== Compare with standard tonal-spot ===");
console.log("standard light.primary:", standard.light.primary);
console.log("brandSoft light.primary:", theme.light.primary);
console.log("seed hct:", Color.hct("#744c9d"));