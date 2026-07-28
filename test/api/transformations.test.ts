import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
	darken,
	desaturate,
	getChroma,
	getHue,
	getTone,
	lighten,
	rotateHue,
	saturate,
} from "../../src/color";
import { approx } from "../helpers";

describe("public API — transformations", () => {
	it("rotateHue rotates relative to current hue", () => {
		const initial = getHue("#ff0000");
		const result = rotateHue("#ff0000", 90);
		assert.ok(approx(getHue(result), initial + 90, 5));
	});

	it("rotateHue wraps past 360", () => {
		const result = rotateHue("#0000ff", 350);
		assert.ok(getHue(result) >= 0);
	});

	it("lighten increases tone", () => {
		const result = lighten("#000000", 40);
		assert.ok(getTone(result) >= 38);
	});

	it("lighten caps near 100", () => {
		const result = lighten("#000000", 200);
		assert.ok(approx(getTone(result), 100));
	});

	it("darken decreases tone", () => {
		const result = darken("#ffffff", 40);
		assert.ok(getTone(result) <= 62);
	});

	it("darken floors near 0", () => {
		const result = darken("#ffffff", 200);
		assert.ok(approx(getTone(result), 0, 1));
	});

	it("saturate increases chroma", () => {
		const gray = "#808080";
		const before = getChroma(gray);
		const result = saturate(gray, 40);
		assert.ok(getChroma(result) > before);
	});

	it("desaturate reduces chroma", () => {
		const initial = getChroma("#ff0000");
		const result = desaturate("#ff0000", initial * 0.5);
		assert.ok(getChroma(result) < initial);
	});

	it("desaturate reduces chroma significantly", () => {
		const initial = getChroma("#ff0000");
		const result = desaturate("#ff0000", initial * 0.9);
		assert.ok(getChroma(result) < initial * 0.2);
	});
});
