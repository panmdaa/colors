import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { generateCSS } from "../../src/css-props";
import type { Palette } from "../../src/types";

const mockPalette: Palette = {
	primary: "#b091ce",
	"primary-dim": "#9a73c2",
	"on-primary": "#2b0052",
	"primary-container": "#efe2ff",
	"on-primary-container": "#150033",
	"primary-fixed": "#efe2ff",
	"primary-fixed-dim": "#d3b9ff",
	"on-primary-fixed": "#150033",
	"on-primary-fixed-variant": "#4a0080",
	secondary: "#625b71",
	"secondary-dim": "#544c5f",
	"on-secondary": "#ffffff",
	"secondary-container": "#e8def8",
	"on-secondary-container": "#1e192b",
	"secondary-fixed": "#e8def8",
	"secondary-fixed-dim": "#cac4d0",
	"on-secondary-fixed": "#1e192b",
	"on-secondary-fixed-variant": "#4a4458",
	tertiary: "#7e5260",
	"tertiary-dim": "#6f4250",
	"on-tertiary": "#ffffff",
	"tertiary-container": "#ffd9e1",
	"on-tertiary-container": "#31101d",
	"tertiary-fixed": "#ffd9e1",
	"tertiary-fixed-dim": "#efb8c8",
	"on-tertiary-fixed": "#31101d",
	"on-tertiary-fixed-variant": "#633b48",
	error: "#ba1a1a",
	"error-dim": "#a80707",
	"on-error": "#ffffff",
	"error-container": "#ffdad6",
	"on-error-container": "#410002",
	background: "#f2f0f4",
	"on-background": "#1b1b20",
	surface: "#f2f0f4",
	"surface-dim": "#d6d3da",
	"surface-bright": "#f2f0f4",
	"surface-container-lowest": "#ffffff",
	"surface-container-low": "#ece8f0",
	"surface-container": "#e5e2ea",
	"surface-container-high": "#dfdce4",
	"surface-container-highest": "#d9d6df",
	"surface-variant": "#e7e0ec",
	"on-surface": "#1b1b20",
	"on-surface-variant": "#49454e",
	outline: "#7a757f",
	"outline-variant": "#cac4d0",
	shadow: "#000000",
	scrim: "#000000",
	"surface-tint": "#b091ce",
	"inverse-surface": "#303034",
	"inverse-on-surface": "#f2f0f4",
	"inverse-primary": "#d3b9ff",
};

describe("generateCSS", () => {
	it("defaults to --color- prefix", () => {
		const result = generateCSS(mockPalette);
		assert.ok(result.includes("--color-primary: #b091ce;"));
		assert.ok(result.includes("--color-on-primary: #2b0052;"));
	});

	it("uses custom prefix via options", () => {
		const result = generateCSS(mockPalette, {
			prefix: "--md-sys-color-",
		});
		assert.ok(result.includes("--md-sys-color-primary: #b091ce;"));
		assert.ok(result.includes("--md-sys-color-on-primary: #2b0052;"));
	});

	it("uses custom prefix with no dashes", () => {
		const result = generateCSS(mockPalette, { prefix: "--my-" });
		assert.ok(result.includes("--my-primary: #b091ce;"));
	});

	it("uses transform function for full control", () => {
		const result = generateCSS(mockPalette, {
			transform: (_role, value) => `--custom-color: ${value};`,
		});
		const lines = result.split("\n");
		assert.equal(lines.length, Object.keys(mockPalette).length);
		for (const line of lines) {
			assert.ok(line.startsWith("--custom-color:"));
		}
	});

	it("transform receives role and value", () => {
		const calls: Array<[string, string]> = [];
		generateCSS(mockPalette, {
			transform: (role, value) => {
				calls.push([role, value]);
				return "";
			},
		});
		assert.ok(calls.some(([r]) => r === "primary"));
		assert.ok(calls.some(([r]) => r === "on-primary"));
	});

	it("prefix and transform are mutually exclusive — transform wins", () => {
		const result = generateCSS(mockPalette, {
			prefix: "--md-sys-color-",
			transform: () => "--forced: #000;",
		});
		assert.ok(!result.includes("--md-sys-color-"));
		assert.ok(result.includes("--forced: #000;"));
	});
});
