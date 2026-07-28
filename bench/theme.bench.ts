import { bench, describe } from "vitest";
import { palette, generateCSS, generateCSSSheet } from "../src";

/**
 * @material/material-color-utilities v0.4.0 excluded from benchmarks:
 * internal imports missing `.js` extension (bug in package), making it
 * unloadable in both Node.js and Vitest. Only panmdaa benchmarks shown.
 */

const SEED = "#6750a4" as const;

const COLORS = [
	"#744c9d",
	"#ff0000",
	"#00ff00",
	"#0000ff",
	"#ff8800",
	"#6750a4",
	"#006b5f",
	"#ba1a1a",
	"#f6c243",
	"#2e5cb8",
];

const VARIANTS = [
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
] as const;

describe("palette() — default variant", () => {
	bench("@panmdaa/colors palette()", () => {
		palette(SEED);
	});
});

describe("palette() — all 10 variants", () => {
	const seed = "#744c9d" as const;

	bench("@panmdaa/colors 10 variants", () => {
		for (const v of VARIANTS) palette(seed, { variant: v });
	});
});

describe("palette() — 10 seeds, all variants", () => {
	bench("@panmdaa/colors 10 × 10 = 100 themes", () => {
		for (const c of COLORS) {
			for (const v of VARIANTS) palette(c as `#${string}`, { variant: v });
		}
	});
});

describe("palette() with extra colors", () => {
	bench("palette + 5 extra colors", () => {
		palette(SEED, {
			extraColors: {
				brand: "#ff6600",
				muted: { from: "primary" },
				accent: { harmonize: "#ff0000" },
				darker: { from: "primary", adjust: { tone: -10 } },
				sunset: { gradient: { from: "#ff0000", to: "#0000ff", count: 5 } },
			},
		});
	});
});

describe("CSS generation", () => {
	const theme = palette(SEED);

	bench("generateCSS (light custom props)", () => {
		generateCSS(theme.light);
	});

	bench("generateCSSSheet (light + dark)", () => {
		generateCSSSheet(theme);
	});
});
