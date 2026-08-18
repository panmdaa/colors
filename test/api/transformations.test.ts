import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color } from "../../src/color";
import { approx } from "../helpers";

describe("public API — transformations", () => {
	it("rotateHue rotates relative to current hue", () => {
		const initial = Color.getHue("#ff0000");
		const result = Color.rotateHue("#ff0000", 90);
		assert.ok(approx(Color.getHue(result.hex), initial + 90, 5));
	});

	it("rotateHue wraps past 360", () => {
		const result = Color.rotateHue("#0000ff", 350);
		assert.ok(Color.getHue(result.hex) >= 0);
	});

	it("lighten increases tone", () => {
		const result = Color.lighten("#000000", 40);
		assert.ok(Color.getTone(result.hex) >= 38);
	});

	it("lighten caps near 100", () => {
		const result = Color.lighten("#000000", 200);
		assert.ok(approx(Color.getTone(result.hex), 100));
	});

	it("darken decreases tone", () => {
		const result = Color.darken("#ffffff", 40);
		assert.ok(Color.getTone(result.hex) <= 62);
	});

	it("darken floors near 0", () => {
		const result = Color.darken("#ffffff", 200);
		assert.ok(approx(Color.getTone(result.hex), 0, 1));
	});

	it("saturate increases chroma", () => {
		const gray = "#808080";
		const before = Color.getChroma(gray);
		const result = Color.saturate(gray, 40);
		assert.ok(Color.getChroma(result.hex) > before);
	});

	it("desaturate reduces chroma", () => {
		const initial = Color.getChroma("#ff0000");
		const result = Color.desaturate("#ff0000", initial * 0.5);
		assert.ok(Color.getChroma(result.hex) < initial);
	});

	it("desaturate reduces chroma significantly", () => {
		const initial = Color.getChroma("#ff0000");
		const result = Color.desaturate("#ff0000", initial * 0.9);
		assert.ok(Color.getChroma(result.hex) < initial * 0.2);
	});
});
