import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { getChroma, getHue, getTone, palette } from "../../src/color";
import { Contrast } from "../../src/utils";
import type { Palette } from "../../src/types";
import { approx } from "../helpers";

describe("color correctness — palette generation", () => {
	it("generates palettes for all 9 variants", () => {
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
		] as const;
		for (const variant of variants) {
			const theme = palette("#6750a4", { variant });
			assert.match(theme.light.primary, /^#[0-9a-f]{6}$/, `${variant} light missing`);
			assert.match(theme.dark.primary, /^#[0-9a-f]{6}$/, `${variant} dark missing`);
		}
	});

	it("contains all 53 required tokens", () => {
		const tokens: (keyof Palette)[] = [
			"primary", "primary-dim", "on-primary", "primary-container", "on-primary-container",
			"primary-fixed", "primary-fixed-dim", "on-primary-fixed", "on-primary-fixed-variant",
			"secondary", "secondary-dim", "on-secondary", "secondary-container", "on-secondary-container",
			"secondary-fixed", "secondary-fixed-dim", "on-secondary-fixed", "on-secondary-fixed-variant",
			"tertiary", "tertiary-dim", "on-tertiary", "tertiary-container", "on-tertiary-container",
			"tertiary-fixed", "tertiary-fixed-dim", "on-tertiary-fixed", "on-tertiary-fixed-variant",
			"error", "error-dim", "on-error", "error-container", "on-error-container",
			"background", "on-background",
			"surface", "surface-dim", "surface-bright",
			"surface-container-lowest", "surface-container-low", "surface-container",
			"surface-container-high", "surface-container-highest",
			"surface-variant", "on-surface", "on-surface-variant",
			"outline", "outline-variant", "shadow", "scrim",
			"surface-tint",
			"inverse-surface", "inverse-on-surface", "inverse-primary",
		];
		const theme = palette("#6750a4");
		for (const key of tokens) {
			assert.ok(theme.light[key], `light.${key} missing`);
			assert.ok(theme.dark[key], `dark.${key} missing`);
		}
	});

	it("light primary tone adjusts with source color (tonal-spot)", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		const tone = getTone(theme.light.primary);
		assert.ok(tone >= 55 && tone <= 75,
			`light primary tone: ${tone} (expected 55-75)`);
	});

	it("dark primary tone adjusts with source color (tonal-spot)", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		const tone = getTone(theme.dark.primary);
		assert.ok(tone >= 55 && tone <= 75,
			`dark primary tone: ${tone} (expected 55-75)`);
	});

	it("light and dark primary differ", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		assert.notEqual(theme.light.primary, theme.dark.primary);
	});

	it("on-primary has sufficient contrast against primary (light)", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		const ratio = Contrast.ratioOfTones(
			getTone(theme.light["on-primary"]),
			getTone(theme.light.primary),
		);
		assert.ok(ratio >= 4.0,
			`light on-primary vs primary: ${ratio.toFixed(2)}:1`);
	});

	it("on-primary has sufficient contrast against primary (dark)", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		const ratio = Contrast.ratioOfTones(
			getTone(theme.dark["on-primary"]),
			getTone(theme.dark.primary),
		);
		assert.ok(ratio >= 4.0,
			`dark on-primary vs primary: ${ratio.toFixed(2)}:1`);
	});

	it("primary hue approximates source hue for tonal-spot", () => {
		const sourceHue = getHue("#6750a4");
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		assert.ok(approx(getHue(theme.light.primary), sourceHue, 5));
	});

	it("variants produce meaningfully different palettes", () => {
		const mono = palette("#6750a4", { variant: "monochrome" }).light.primary;
		const vibrant = palette("#6750a4", { variant: "vibrant" }).light.primary;
		const chromaMono = getChroma(mono);
		const chromaVibrant = getChroma(vibrant);
		assert.ok(chromaVibrant > chromaMono,
			`vibrant chroma (${chromaVibrant}) should exceed monochrome (${chromaMono})`);
	});

	it("extraColors — direct color with on-*", () => {
		const theme = palette("#6750a4", {
			extraColors: { "custom": "#ff0000" },
		});
		assert.equal(theme.light.custom, "#ff0000");
		assert.equal(theme.dark.custom, "#ff0000");
		assert.ok(theme.light["on-custom"]);
		assert.notEqual(theme.light["on-custom"], theme.light.custom);
	});

	it("extraColors — from alias", () => {
		const theme = palette("#6750a4", {
			variant: "tonal-spot",
			extraColors: { "brand": { from: "primary" } },
		});
		assert.equal(theme.light.brand, theme.light.primary);
		assert.equal(theme.dark.brand, theme.dark.primary);
		assert.ok(theme.light["on-brand"]);
		assert.notEqual(theme.light["on-brand"], theme.light.brand);
	});

	it("extraColors — from + adjust tone", () => {
		const theme = palette("#6750a4", {
			variant: "tonal-spot",
			extraColors: { "brand-dim": { from: "primary", adjust: { tone: -5 } } },
		});
		assert.notEqual(theme.light["brand-dim"], theme.light.primary);
		assert.ok(theme.light["on-brand-dim"]);
	});

	it("extraColors — kebab-case normalization", () => {
		const theme = palette("#6750a4", {
			extraColors: { "myBrand": { from: "primary" } },
		});
		assert.ok(theme.light["my-brand"]);
		assert.ok(theme.light["on-my-brand"]);
	});

	it("extraColors — harmonize with on-*", () => {
		const theme = palette("#6750a4", {
			extraColors: { "accent": { harmonize: "#ff6600" } },
		});
		assert.ok(theme.light.accent.startsWith("#"));
		assert.ok(theme.light["on-accent"]);
	});

	it("extraColors — random with on-*", () => {
		const theme = palette("#6750a4", {
			extraColors: { "surprise": { random: true } },
		});
		assert.ok(theme.light.surprise.startsWith("#"));
		assert.equal(theme.light.surprise, theme.dark.surprise);
		assert.ok(theme.light["on-surprise"]);
	});

	it("extraColors — on-* not generated for on-* prefixed names", () => {
		const theme = palette("#6750a4", {
			extraColors: { "on-custom": "#ff0000" },
		});
		assert.equal(theme.light["on-custom"], "#ff0000");
		assert.ok(!("on-on-custom" in theme.light));
	});
});
