import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color } from "../../src/color";
import { approx } from "../helpers";

describe("public API — mutations", () => {
	it("setHue changes hue (approx)", () => {
		const result = Color.setHue("#ff0000", 180);
		assert.ok(approx(Color.getHue(result.hex), 180));
	});

	it("setChroma on gray increases chroma", () => {
		const result = Color.setChroma("#808080", 30);
		assert.ok(Color.getChroma(result.hex) > 20);
	});

	it("setTone changes tone", () => {
		const result = Color.setTone("#ff0000", 80);
		assert.ok(Color.getTone(result.hex) > 70);
	});
});
