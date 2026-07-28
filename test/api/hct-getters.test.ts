import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { getChroma, getHue, getTone, hct } from "../../src/color";

describe("public API — HCT getters", () => {
	it("getHue returns the hue", () => {
		assert.equal(typeof getHue("#ff0000"), "number");
	});

	it("getChroma returns the chroma", () => {
		assert.ok(getChroma("#ff0000") > 0);
	});

	it("getTone returns the tone", () => {
		assert.equal(getTone("#000000"), 0);
		assert.equal(getTone("#ffffff"), 100);
	});

	it("getters are consistent with hct()", () => {
		const c = hct("#6750a4");
		assert.equal(getHue("#6750a4"), c.hue);
		assert.equal(getChroma("#6750a4"), c.chroma);
		assert.equal(getTone("#6750a4"), c.tone);
	});
});
