import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { onColor, underColor, mix, gradient, palette } from "../../src/color";
import { generateCSSSheet } from "../../src/css-sheet";
import { report } from "../../src/report";
import { Contrast } from "../../src/utils";
import { getTone } from "../../src/color";

describe("onColor", () => {
	it("dark bg gets light foreground", () => {
		const fg = onColor("#000000");
		const ratio = Contrast.ratioOfTones(getTone("#000000"), getTone(fg));
		assert.ok(ratio >= 4.5, `contrast ${ratio}:1`);
	});

	it("light bg gets dark foreground", () => {
		const fg = onColor("#ffffff");
		const ratio = Contrast.ratioOfTones(getTone("#ffffff"), getTone(fg));
		assert.ok(ratio >= 4.5, `contrast ${ratio}:1`);
	});

	it("customizes contrast ratio", () => {
		const fg = onColor("#000000", 7);
		const ratio = Contrast.ratioOfTones(getTone("#000000"), getTone(fg));
		assert.ok(ratio >= 7.0, `contrast ${ratio}:1`);
	});

	it("colored bg achieves at least 4.5:1", () => {
		const bg = "#b091ce";
		const fg = onColor(bg);
		const ratio = Contrast.ratioOfTones(getTone(bg), getTone(fg));
		assert.ok(ratio >= 4.5, `contrast ${ratio}:1`);
	});
});

describe("underColor", () => {
	it("dark fg gets light background", () => {
		const bg = underColor("#000000");
		const ratio = Contrast.ratioOfTones(getTone(bg), getTone("#000000"));
		assert.ok(ratio >= 4.5, `contrast ${ratio}:1`);
	});

	it("light fg gets dark background", () => {
		const bg = underColor("#ffffff");
		const ratio = Contrast.ratioOfTones(getTone("#ffffff"), getTone(bg));
		assert.ok(ratio >= 4.5, `contrast ${ratio}:1`);
	});

	it("customizes contrast ratio", () => {
		const bg = underColor("#000000", 7);
		const ratio = Contrast.ratioOfTones(getTone(bg), getTone("#000000"));
		assert.ok(ratio >= 7.0, `contrast ${ratio}:1`);
	});
});

describe("mix", () => {
	it("single color returns itself", () => {
		assert.equal(mix("#ff0000"), "#ff0000");
	});

	it("two colors average in HCT", () => {
		const result = mix("#ff0000", "#0000ff");
		assert.ok(result.startsWith("#"));
		assert.equal(result.length, 7);
	});

	it("three colors blend without error", () => {
		const result = mix("#ff0000", "#00ff00", "#0000ff");
		assert.ok(result.startsWith("#"));
		assert.equal(result.length, 7);
	});

	it("identical colors return same color", () => {
		const result = mix("#744c9d", "#744c9d", "#744c9d");
		assert.equal(result, "#744c9d");
	});
});

describe("gradient", () => {
	it("returns start and end colors", () => {
		const s = gradient("#000000", "#ffffff", 2);
		assert.equal(s[0], "#000000");
		assert.equal(s[1], "#ffffff");
	});

	it("returns interpolated colors for count=5", () => {
		const s = gradient("#000000", "#ffffff", 5);
		assert.equal(s.length, 5);
		assert.equal(s[0], "#000000");
		assert.equal(s[4], "#ffffff");
		assert.ok(s[1] !== s[2]);
		assert.ok(s[2] !== s[3]);
	});

	it("handles count=1 (same color)", () => {
		const s = gradient("#ff0000", "#0000ff", 1);
		assert.equal(s.length, 1);
		assert.equal(s[0], "#ff0000");
	});

	it("interpolates from red to blue", () => {
		const s = gradient("#ff0000", "#0000ff", 3);
		assert.equal(s.length, 3);
		assert.notEqual(s[0], s[1]);
		assert.notEqual(s[1], s[2]);
	});

	it("gradient in palette extraColors generates -N tokens", () => {
		const theme = palette("#6750a4", {
			extraColors: {
				sunset: { gradient: { from: "#ff0000", to: "#0000ff", count: 5 } },
			},
		});
		assert.ok(theme.light["sunset-0"]);
		assert.ok(theme.light["sunset-4"]);
		assert.ok(theme.light["on-sunset-0"]);
		assert.ok(theme.light["on-sunset-4"]);
		assert.notEqual(theme.light["sunset-0"], theme.light["sunset-4"]);
	});

	it("gradient with palette key reference", () => {
		const theme = palette("#6750a4", {
			extraColors: {
				ramp: { gradient: { from: "primary", to: "secondary", count: 3 } },
			},
		});
		assert.ok(theme.light["ramp-0"]);
		assert.ok(theme.light["ramp-2"]);
		assert.ok(theme.light["on-ramp-0"]);
	});
});

describe("generateCSSSheet", () => {
	it("generates light and dark blocks", () => {
		const theme = palette("#6750a4");
		const css = generateCSSSheet(theme);
		assert.ok(css.includes(":root {"));
		assert.ok(css.includes("@media (prefers-color-scheme: dark)"));
		assert.ok(css.includes("--color-primary:"));
		assert.ok(css.includes("--color-"));
	});

	it("uses custom prefix", () => {
		const theme = palette("#6750a4");
		const css = generateCSSSheet(theme, { prefix: "--md-sys-" });
		assert.ok(css.includes("--md-sys-primary:"));
	});

	it("uses custom dark selector (class-based)", () => {
		const theme = palette("#6750a4");
		const css = generateCSSSheet(theme, {
			darkSelector: '[data-theme="dark"]',
		});
		assert.ok(css.includes('[data-theme="dark"]'));
		assert.ok(!css.includes("@media"));
	});

	it("includes extraColors when present", () => {
		const theme = palette("#6750a4", {
			extraColors: { brand: { from: "primary" } },
		});
		const css = generateCSSSheet(theme);
		assert.ok(css.includes("--color-brand:"));
		assert.ok(css.includes("--color-on-brand:"));
	});
});

describe("report", () => {
	it("reports contrast pairs for all on-* roles", () => {
		const theme = palette("#6750a4");
		const { pairs, summary } = report(theme);
		assert.ok(pairs.length >= 10);
		assert.equal(pairs.length, summary.total);
	});

	it("each pair has ratio and WCAG flags", () => {
		const theme = palette("#6750a4");
		const { pairs } = report(theme);
		for (const pair of pairs) {
			assert.ok(pair.ratio >= 1, `${pair.role}/${pair.onRole} bad ratio`);
			assert.equal(typeof pair.AA, "boolean");
			assert.equal(typeof pair.AAA, "boolean");
		}
	});

	it("primary pair passes AA", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		const { pairs } = report(theme);
		const primary = pairs.find((p) => p.role === "primary");
		assert.ok(primary, "primary pair not found");
		assert.ok(primary.AA, `primary AA failed: ratio ${primary.ratio}:1`);
	});

	it("works for dark mode", () => {
		const theme = palette("#6750a4");
		const { pairs } = report(theme, "dark");
		assert.ok(pairs.length >= 10);
	});

	it("includes extraColors pairs", () => {
		const theme = palette("#6750a4", {
			extraColors: { brand: { from: "primary" } },
		});
		const { pairs } = report(theme);
		assert.ok(pairs.some((p) => p.role === "brand"));
	});
});
