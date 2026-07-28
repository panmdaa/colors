import { bench, describe } from "vitest";
import { gradient } from "../src";
import { interpolate, samples } from "culori";
import chroma from "chroma-js";

const FROM = "#ff0000";
const TO = "#0000ff";
const COUNT = 10;

describe("gradient — HCT interpolation, 10 steps", () => {
	bench("@panmdaa/colors gradient()", () => {
		gradient(FROM, TO, COUNT);
	});

	bench("culori interpolate() lch", () => {
		const f = interpolate([FROM, TO], "lch");
		samples(COUNT).map(f);
	});

	bench("culori interpolate() rgb", () => {
		const f = interpolate([FROM, TO], "rgb");
		samples(COUNT).map(f);
	});

	bench("chroma-js scale().colors()", () => {
		chroma.scale([FROM, TO]).colors(COUNT);
	});
});

describe("gradient — 100 steps", () => {
	bench("@panmdaa/colors gradient() 100", () => {
		gradient(FROM, TO, 100);
	});

	bench("culori interpolate() lch 100", () => {
		const f = interpolate([FROM, TO], "lch");
		samples(100).map(f);
	});

	bench("chroma-js scale().colors() 100", () => {
		chroma.scale([FROM, TO]).colors(100);
	});
});

describe("gradient — 20 steps, warm to cool", () => {
	const warm = "#ff8800";
	const cool = "#2e5cb8";

	bench("@panmdaa/colors gradient() warm→cool", () => {
		gradient(warm, cool, 20);
	});

	bench("culori interpolate() lch warm→cool", () => {
		const f = interpolate([warm, cool], "lch");
		samples(20).map(f);
	});

	bench("chroma-js scale().colors() warm→cool", () => {
		chroma.scale([warm, cool]).colors(20);
	});
});
