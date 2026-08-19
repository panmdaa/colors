/**
 * Theme generation (light + dark) from a seed color.
 *
 * Typical entry point: pick a seed color (brand, photo, etc.) and get a
 * complete theme with 53 color roles for light and dark modes, with
 * WCAG-guaranteed contrast.
 *
 * Run with:  npx tsx examples/theme/generate-theme.ts
 */

import { palette } from "@panmdaa/colors";
import type { ColorValue } from "@panmdaa/colors";

// Default theme (variant "expressive")
const theme = palette("#744c9d");

console.log("=== Default theme (expressive) ===");
console.log("Seed:", theme.color);
console.log("Light primary:", theme.light.primary);
console.log("Light on-primary:", theme.light["on-primary"]);
console.log("Light surface:", theme.light.surface);
console.log("Dark primary:", theme.dark.primary);
console.log("Dark on-primary:", theme.dark["on-primary"]);
console.log("Dark background:", theme.dark.background);

// Same seed, different variants
const variants = [
	"monochrome",
	"neutral",
	"tonal-spot",
	"vibrant",
	"expressive",
	"fidelity",
	"content",
	"rainbow",
	"fruit-salad",
	"cmf",
	"soft",
	"muted",
	"warm",
	"cool",
	"high-contrast",
] as const;

console.log("\n=== Available variants ===");
for (const variant of variants) {
	const t = palette("#744c9d", { variant });
	console.log(`${variant.padEnd(14)} light.primary: ${t.light.primary}  dark.primary: ${t.dark.primary}`);
}

// Contrast level: 0 = normal, 1 = less contrast, -1 = more contrast
console.log("\n=== Contrast level ===");
for (const contrastLevel of [-1, 0, 1]) {
	const t = palette("#744c9d", { variant: "tonal-spot", contrastLevel });
	console.log(`contrastLevel ${contrastLevel}: light.on-primary = ${t.light["on-primary"]}`);
}

// Typical usage: derive brand tokens for the design
const seed: ColorValue = "#006b5f";
const appTheme = palette(seed, { variant: "tonal-spot" });

const brand = appTheme.light.primary;
const background = appTheme.light.surface;
const onBackground = appTheme.light["on-surface"];

console.log("\n=== Derived brand tokens ===");
console.log({ seed, brand, background, onBackground });