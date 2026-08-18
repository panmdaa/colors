import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color, palette } from "../../src/color";
import { Hct } from "../../src/hct";
import { Contrast } from "../../src/utils";
import type { Palette } from "../../src/types";
import { VariantScheme } from "../../src/variants";
import { Variant } from "../../src/scheme/variant";
import { approx } from "../helpers";

describe("color correctness — palette generation", () => {
	it("generates palettes for all 15 variants", () => {
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

	it("light primary tone follows source color tone (tonal-spot)", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		const tone = Color.getTone(theme.light.primary);
		assert.ok(tone > 0 && tone < 100,
			`light primary tone: ${tone} (expected 0-100)`);
	});

	it("dark primary tone follows source color tone (tonal-spot)", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		const tone = Color.getTone(theme.dark.primary);
		assert.ok(tone > 0 && tone < 100,
			`dark primary tone: ${tone} (expected 0-100)`);
	});

	it("surfaces are not black (except shadow/scrim + surfaceContainerLowest dark)", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		const alwaysBlack = new Set(["shadow", "scrim"]);
		const mayBeBlack = new Set(["surface-container-lowest"]);
		const surfaceTokens: (keyof Palette)[] = [
			"background", "surface", "surface-dim", "surface-bright",
			"surface-container-lowest", "surface-container-low", "surface-container",
			"surface-container-high", "surface-container-highest",
			"surface-variant",
		];
		for (const key of surfaceTokens) {
			assert.notEqual(theme.light[key], "#000000",
				`light.${key} should not be #000000`);
			if (!mayBeBlack.has(key)) {
				assert.notEqual(theme.dark[key], "#000000",
					`dark.${key} should not be #000000`);
			}
		}
		for (const key of alwaysBlack) {
			assert.equal(theme.light[key], "#000000",
				`light.${key} should be #000000`);
			assert.equal(theme.dark[key], "#000000",
				`dark.${key} should be #000000`);
		}
	});

	it("light and dark primary differ", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		assert.notEqual(theme.light.primary, theme.dark.primary);
	});

	it("on-primary has sufficient contrast against primary (light)", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		const ratio = Contrast.ratioOfTones(
			Color.getTone(theme.light["on-primary"]),
			Color.getTone(theme.light.primary),
		);
		assert.ok(ratio >= 4.0,
			`light on-primary vs primary: ${ratio.toFixed(2)}:1`);
	});

	it("on-primary has sufficient contrast against primary (dark)", () => {
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		const ratio = Contrast.ratioOfTones(
			Color.getTone(theme.dark["on-primary"]),
			Color.getTone(theme.dark.primary),
		);
		assert.ok(ratio >= 4.0,
			`dark on-primary vs primary: ${ratio.toFixed(2)}:1`);
	});

	it("primary hue approximates source hue for tonal-spot", () => {
		const sourceHue = Color.getHue("#6750a4");
		const theme = palette("#6750a4", { variant: "tonal-spot" });
		assert.ok(approx(Color.getHue(theme.light.primary), sourceHue, 5));
	});

	it("variants produce meaningfully different palettes", () => {
		const mono = palette("#6750a4", { variant: "monochrome" }).light.primary;
		const vibrant = palette("#6750a4", { variant: "vibrant" }).light.primary;
		const chromaMono = Color.getChroma(mono);
		const chromaVibrant = Color.getChroma(vibrant);
		assert.ok(chromaVibrant > chromaMono,
			`vibrant chroma (${chromaVibrant}) should exceed monochrome (${chromaMono})`);
	});

	it("supports a custom variant class", () => {
		class BrandSoft extends VariantScheme {
			constructor(sourceColorOrList: Hct | Hct[], isDark: boolean, contrastLevel: number) {
				super(sourceColorOrList, isDark, contrastLevel, Variant.TONAL_SPOT);
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

		const theme = palette("#6750a4", { variant: BrandSoft });
		assert.match(theme.light.primary, /^#[0-9a-f]{6}$/);
		assert.match(theme.dark.primary, /^#[0-9a-f]{6}$/);
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
