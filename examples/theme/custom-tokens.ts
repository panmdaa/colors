/**
 * Custom tokens (extraColors).
 *
 * Extend the theme with your own tokens: direct brand colors, adjusted
 * copies of palette roles, harmonized colors, mixes and gradients. Every
 * non-`on-*` token auto-generates its `on-{name}` with guaranteed contrast.
 *
 * Run with:  npx tsx examples/theme/custom-tokens.ts
 */

import { palette } from "@panmdaa/colors";

const theme = palette("#6750a4", {
	variant: "tonal-spot",
	extraColors: {
		brand: "#ff6600", // direct color (shared across light/dark)
		muted: { from: "primary" }, // copy of a palette role (per-mode)
		"muted-bold": { from: "primary", adjust: { tone: -10 } }, // adjusted copy
		accent: { harmonize: "#ff0000" }, // harmonized with the seed
		duo: { mix: ["primary", "secondary"] }, // blend of palette roles
		sunset: { mix: ["#ff0000", "#ff8800"] }, // blend of direct colors
		ramp: { gradient: { from: "primary", to: "secondary", count: 3 } }, // gradient
	},
});

const light = theme.light;

console.log("=== Custom tokens (light) ===");
console.log("brand:", light.brand, "| on-brand:", light["on-brand"]);
console.log("muted:", light.muted, "| on-muted:", light["on-muted"]);
console.log("muted-bold:", light["muted-bold"]);
console.log("accent:", light.accent);
console.log("duo:", light.duo);
console.log("sunset:", light.sunset);
console.log("ramp:", light["ramp-0"], light["ramp-1"], light["ramp-2"]);

// "from" tokens resolve per-mode: different in light and dark
console.log("\n=== Per-mode (from) vs shared (direct/harmonize) ===");
console.log("muted — light:", light.muted, "| dark:", theme.dark.muted);
console.log("brand — light:", light.brand, "| dark:", theme.dark.brand);
console.log("accent — light:", light.accent, "| dark:", theme.dark.accent);

// Kebab-case normalization: "primaryButton" → "primary-button"
const kebab = palette("#6750a4", {
	extraColors: { primaryButton: "#123456" },
});
console.log("\n=== Kebab-case normalization ===");
console.log("primaryButton →", Object.keys(kebab.light).filter((k) => k.includes("button")));