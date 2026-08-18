import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color } from "../src/color";

describe("public API — edge cases", () => {
	it("black has zero chroma and tone", () => {
		assert.equal(Color.getChroma("#000000"), 0);
		assert.equal(Color.getTone("#000000"), 0);
	});

	it("white has full tone and low chroma", () => {
		assert.equal(Color.getTone("#ffffff"), 100);
		assert.ok(Color.getChroma("#ffffff") < 5);
	});

	it("handles short hex", () => {
		const r = Color.hct("#f00");
		assert.ok(r.hue > 0);
	});
});
