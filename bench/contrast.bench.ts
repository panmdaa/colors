import { bench, describe } from "vitest";
import { palette, report } from "../src";
import { Contrast } from "../src/utils";
import { getTone } from "../src";
import { wcagContrast } from "culori";
import chroma from "chroma-js";

const PAIRS = [
	["#000000", "#ffffff"],
	["#1e192b", "#b091ce"],
	["#744c9d", "#ffffff"],
	["#ff0000", "#ffffff"],
	["#006b5f", "#ffffff"],
	["#f6c243", "#000000"],
	["#6750a4", "#eaddff"],
	["#ba1a1a", "#ffffff"],
	["#2e5cb8", "#ffffff"],
	["#ff8800", "#000000"],
	["#1e192b", "#eaddff"],
	["#4a7a3f", "#ffffff"],
	["#b091ce", "#1e192b"],
	["#d2b48c", "#000000"],
] as const;

describe("WCAG contrast ratio (single pair)", () => {
	bench("@panmdaa/colors Contrast.ratioOfTones", () => {
		const t1 = getTone("#000000");
		const t2 = getTone("#ffffff");
		Contrast.ratioOfTones(t1, t2);
	});

	bench("culori wcagContrast", () => {
		wcagContrast("#000000", "#ffffff");
	});

	bench("chroma-js .contrast()", () => {
		chroma.contrast("#000000", "#ffffff");
	});
});

describe("WCAG contrast — 14 pairs", () => {
	bench("@panmdaa/colors 14 pairs", () => {
		for (const [a, b] of PAIRS) {
			const t1 = getTone(a);
			const t2 = getTone(b);
			Contrast.ratioOfTones(t1, t2);
		}
	});

	bench("culori wcagContrast 14 pairs", () => {
		for (const [a, b] of PAIRS) {
			wcagContrast(a, b);
		}
	});

	bench("chroma-js .contrast() 14 pairs", () => {
		for (const [a, b] of PAIRS) {
			chroma.contrast(a, b);
		}
	});
});

describe("theme contrast report", () => {
	const theme = palette("#6750a4", {
		extraColors: { brand: "#ff6600", muted: { from: "primary" } },
	});

	bench("@panmdaa/colors report(theme)", () => {
		report(theme);
	});

	bench("@panmdaa/colors report(theme, dark)", () => {
		report(theme, "dark");
	});
});
