import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color } from "../../src/color";

describe("public API — HCT getters", () => {
	it("getHue returns the hue", () => {
		assert.equal(typeof Color.getHue("#ff0000"), "number");
	});

	it("getChroma returns the chroma", () => {
		assert.ok(Color.getChroma("#ff0000") > 0);
	});

	it("getTone returns the tone", () => {
		assert.equal(Color.getTone("#000000"), 0);
		assert.equal(Color.getTone("#ffffff"), 100);
	});

	it("getters are consistent with Color.hct()", () => {
		const c = Color.hct("#6750a4");
		assert.equal(Color.getHue("#6750a4"), c.hue);
		assert.equal(Color.getChroma("#6750a4"), c.chroma);
		assert.equal(Color.getTone("#6750a4"), c.tone);
	});
});
