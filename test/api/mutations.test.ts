import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { getChroma, getHue, getTone, setChroma, setHue, setTone } from "../../src/color";
import { approx } from "../helpers";

describe("public API — mutations", () => {
	it("setHue changes hue (approx)", () => {
		const result = setHue("#ff0000", 180);
		assert.ok(approx(getHue(result), 180));
	});

	it("setChroma on gray increases chroma", () => {
		const result = setChroma("#808080", 30);
		assert.ok(getChroma(result) > 20);
	});

	it("setTone changes tone", () => {
		const result = setTone("#ff0000", 80);
		assert.ok(getTone(result) > 70);
	});
});
