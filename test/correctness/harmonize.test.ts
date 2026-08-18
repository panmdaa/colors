import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color } from "../../src/color";
import { differenceDegrees } from "../../src/utils";

describe("color correctness — harmonize", () => {
	it("harmonize with same color is identity", () => {
		assert.equal(Color.harmonize("#6750a4", "#6750a4").hex, "#6750a4");
	});

	it("shifts hue towards source color (up to 15°)", () => {
		const designHue = Color.getHue("#ff0000");
		const sourceHue = Color.getHue("#ff4500");
		const resultHue = Color.getHue(Color.harmonize("#ff0000", "#ff4500").hex);

		const distBefore = differenceDegrees(designHue, sourceHue);
		const distAfter = differenceDegrees(resultHue, sourceHue);

		assert.ok(distAfter < distBefore, "result should be closer to source than design was");
	});

	it("rotates at most 15°", () => {
		const designHue = Color.getHue("#ff0000");
		const sourceHue = Color.getHue("#0000ff");
		const resultHue = Color.getHue(Color.harmonize("#ff0000", "#0000ff").hex);

		const shift = differenceDegrees(designHue, resultHue);
		assert.ok(shift <= 16, `harmonize rotated ${shift}°, expected ≤15°`);
	});
});
