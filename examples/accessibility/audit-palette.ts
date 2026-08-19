/**
 * Accessibility audits (WCAG + color vision deficiency simulation).
 *
 * Before shipping, audit every foreground/background pair of your theme:
 * - report(): contrast report per on-* pair
 * - contrastChecker(): 0–10 score for any pair, with optional CVD simulation
 * - paletteChecker(): checks ALL pairs of a palette at once
 * - simulateCVD(): how a color looks under protanopia/deuteranopia/tritanopia
 *
 * Run with:  npx tsx examples/accessibility/audit-palette.ts
 */

import {
	palette,
	report,
	contrastChecker,
	paletteChecker,
	simulateCVD,
	simulateAllCVD,
} from "@panmdaa/colors";

const theme = palette("#6750a4", {
	extraColors: { warning: "#ff8800" },
});

// 1. Contrast report for light mode
console.log("=== report(theme, 'light') ===");
const { pairs, summary } = report(theme, "light");
console.log("summary:", summary);
console.log("first pair:", pairs[0]);
console.log("includes warning token?:", pairs.some((p) => p.role === "warning"));

// 2. Score any arbitrary pair with color vision deficiency simulation
console.log("\n=== contrastChecker('#ffffff', '#ff0000') ===");
const score = contrastChecker("#ffffff", "#ff0000");
console.log("ratio:", score.ratio, "| score:", score.score, "| smallText:", score.smallText, "| largeText:", score.largeText);
console.log("simulations:", {
	protanopia: score.simulations.protanopia,
	deuteranopia: score.simulations.deuteranopia,
});

// Without simulation (CVD disabled)
const plain = contrastChecker("#ffffff", "#ff0000", false);
console.log("without CVD:", plain);

// 3. Full palette audit (light + dark)
console.log("\n=== paletteChecker(theme) ===");
const check = paletteChecker(theme);
console.log("global summary:", check.summary);
console.log("light summary:", check.light.summary);
console.log("dark summary:", check.dark.summary);

const pair = check.light.pairs.find((p) => p.role === "warning");
if (pair) {
	console.log("warning pair:", {
		base: pair.base,
		on: pair.on,
		AA: pair.AA,
		deuteranopia: pair.simulations?.deuteranopia,
	});
}

// 4. Simulate a single color under the three common deficiencies
console.log("\n=== simulateCVD / simulateAllCVD ===");
console.log("simulateCVD('#ff0000', 'protanopia'):", simulateCVD("#ff0000", "protanopia"));
console.log("simulateCVD('#ff0000', 'deuteranopia'):", simulateCVD("#ff0000", "deuteranopia"));
console.log("simulateCVD('#ff0000', 'tritanopia'):", simulateCVD("#ff0000", "tritanopia"));
console.log("mild severity:", simulateCVD("#ff0000", "protanopia", "mild"));
console.log("simulateAllCVD('#ff0000'):", simulateAllCVD("#ff0000"));