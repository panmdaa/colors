import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { harmonize, getHue } from "../../src/color";
import { differenceDegrees } from "../../src/utils";

describe("color correctness — harmonize", () => {
	it("harmonize with same color is identity", () => {
		assert.equal(harmonize("#6750a4", "#6750a4"), "#6750a4");
	});

	it("shifts hue towards source color (up to 15°)", () => {
		const designHue = getHue("#ff0000");
		const sourceHue = getHue("#ff4500");
		const resultHue = getHue(harmonize("#ff0000", "#ff4500"));

		const distBefore = differenceDegrees(designHue, sourceHue);
		const distAfter = differenceDegrees(resultHue, sourceHue);

		assert.ok(distAfter < distBefore, "result should be closer to source than design was");
	});

	it("rotates at most 15°", () => {
		const designHue = getHue("#ff0000");
		const sourceHue = getHue("#0000ff");
		const resultHue = getHue(harmonize("#ff0000", "#0000ff"));

		const shift = differenceDegrees(designHue, resultHue);
		assert.ok(shift <= 16, `harmonize rotated ${shift}°, expected ≤15°`);
	});
});
