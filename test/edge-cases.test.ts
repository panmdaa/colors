import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { getChroma, getTone, hct } from "../src/color";

describe("public API — edge cases", () => {
	it("black has zero chroma and tone", () => {
		assert.equal(getChroma("#000000"), 0);
		assert.equal(getTone("#000000"), 0);
	});

	it("white has full tone and low chroma", () => {
		assert.equal(getTone("#ffffff"), 100);
		assert.ok(getChroma("#ffffff") < 5);
	});

	it("handles short hex", () => {
		const r = hct("#f00");
		assert.ok(r.hue > 0);
	});
});
