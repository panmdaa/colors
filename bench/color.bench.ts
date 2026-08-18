import { bench, describe } from "vitest";
import { Color } from "../src";
import { formatHex, hsl, lch } from "culori";
import chroma from "chroma-js";

const SEED = "#744c9d" as const;

describe("color space conversion (hex → internal)", () => {
	bench("@panmdaa/colors Color.hct()", () => {
		Color.hct(SEED);
	});

	bench("culori hsl()", () => {
		hsl(SEED);
	});

	bench("culori lch()", () => {
		lch(SEED);
	});

	bench("chroma-js chroma()", () => {
		chroma(SEED);
	});
});

describe("channel getters (hue/saturation/lightness)", () => {
	bench("@panmdaa/colors Color.getHue/Chroma/Tone", () => {
		Color.getHue(SEED);
		Color.getChroma(SEED);
		Color.getTone(SEED);
	});

	bench("@panmdaa/colors Color.from().hue/.chroma/.tone (cached)", () => {
		const c = Color.from(SEED);
		c.hue;
		c.chroma;
		c.tone;
	});

	bench("culori hsl.h/.s/.l", () => {
		const c = hsl(SEED);
		c.h; c.s; c.l;
	});

	bench("chroma-js .hsl()", () => {
		chroma(SEED).hsl();
	});
});

describe("lighten +10", () => {
	bench("@panmdaa/colors Color.lighten(10)", () => {
		Color.lighten(SEED, 10);
	});

	bench("@panmdaa/colors Color.from().lighten(10) materialized", () => {
		Color.from(SEED).lighten(10).hex;
	});

	bench("culori lch.l +10 + formatHex", () => {
		const c = lch(SEED);
		c.l = Math.min(100, c.l + 10);
		formatHex(c);
	});

	bench("chroma-js .brighten(1)", () => {
		chroma(SEED).brighten(1);
	});
});

describe("darken -10", () => {
	bench("@panmdaa/colors Color.darken(10)", () => {
		Color.darken(SEED, 10);
	});

	bench("chroma-js .darken(1)", () => {
		chroma(SEED).darken(1);
	});
});

describe("saturate +20", () => {
	bench("@panmdaa/colors Color.saturate(20)", () => {
		Color.saturate(SEED, 20);
	});

	bench("chroma-js .saturate(1)", () => {
		chroma(SEED).saturate(1);
	});
});

describe("rotate hue 90°", () => {
	bench("@panmdaa/colors Color.rotateHue(90)", () => {
		Color.rotateHue(SEED, 90);
	});

	bench("chroma-js .set('hsl.h', '+90')", () => {
		chroma(SEED).set("hsl.h", "+90");
	});
});

describe("reconstruct color from channels", () => {
	bench("@panmdaa/colors Color.fromHct().hex", () => {
		Color.fromHct(283, 36, 62).hex;
	});

	bench("culori lch → formatHex", () => {
		formatHex({ mode: "lch", l: 62, c: 36, h: 283 } as any);
	});

	bench("chroma-js chroma.lch()", () => {
		chroma.lch(62, 36, 283);
	});
});

describe("batch edit (3 channels at once)", () => {
	bench("@panmdaa/colors Color.edit() (single solve)", () => {
		Color.edit(SEED, { hue: 200, chroma: 40, tone: 70 });
	});

	bench("chroma-js 3x .set() chain", () => {
		chroma(SEED).set("hsl.h", 200).set("hsl.s", 0.5).set("lch.l", 70);
	});
});

describe("tone ramp (14 reference tones)", () => {
	bench("@panmdaa/colors Color.tones()", () => {
		Color.tones(SEED);
	});

	bench("chroma-js 14x .luminance()", () => {
		for (let t = 0; t <= 100; t += 10) chroma(SEED).luminance(t / 100);
	});
});
