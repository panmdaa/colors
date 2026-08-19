/**
 * CSS generation from a theme.
 *
 * Generates stylesheets with custom properties (CSS variables) for light
 * and dark modes. This is the typical flow to inject a theme into your app
 * without writing CSS by hand.
 *
 * Run with:  npx tsx examples/css/generate-css.ts
 */

import { palette, generateCSS, generateCSSSheet } from "@panmdaa/colors";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const theme = palette("#6750a4", {
	variant: "tonal-spot",
	extraColors: { brand: "#ff6600" },
});

// 1. Light variables only
const css = generateCSS(theme.light);
console.log("=== generateCSS(theme.light) ===");
console.log(css.split("\n").slice(0, 6).join("\n"));
console.log("...");

// 2. Full sheet with prefers-color-scheme media query
const sheet = generateCSSSheet(theme);
console.log("\n=== generateCSSSheet(theme) ===");
console.log(sheet.split("\n").slice(0, 8).join("\n"));
console.log("...");

// 3. Customization: custom prefix and dark selector (e.g. a toggle)
const customized = generateCSSSheet(theme, {
	prefix: "--md-sys-",
	darkSelector: '[data-theme="dark"]',
});
console.log("\n=== generateCSSSheet with custom prefix and dark selector ===");
console.log(customized.split("\n").slice(0, 6).join("\n"));
console.log("...");

// 4. Transform the output (e.g. only base/on-* pairs)
const minimal = generateCSS(theme.light, {
	prefix: "",
	transform: (role, value) =>
		role === "primary" || role === "on-primary"
			? `.${role} { color: ${value}; }`
			: "",
})
	.split("\n")
	.filter(Boolean)
	.join("\n");
console.log("\n=== generateCSS with transform ===");
console.log(minimal);

// 5. Save the final sheet to consume via a <link> or CSS import
const outDir = join(dirname(fileURLToPath(import.meta.url)), "output");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "theme.css"), generateCSSSheet(theme), "utf8");

console.log(`\nSheet saved to: ${join(outDir, "theme.css")}`);