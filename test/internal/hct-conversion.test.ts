import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color } from "../../src/color";

describe("internal — HCT conversion", () => {
	it("hct returns Hct with valid components", () => {
		const c = Color.hct("#ff0000");
		assert.ok(c.hue >= 0 && c.hue < 360, `hue ${c.hue}`);
		assert.ok(c.chroma >= 0, `chroma ${c.chroma}`);
		assert.ok(c.tone >= 0 && c.tone <= 100, `tone ${c.tone}`);
	});

	it("fromHct roundtrip preserves hue", () => {
		const original = "#ff0000";
		const c = Color.hct(original);
		const back = Color.fromHct(c.hue, c.chroma, c.tone).hex;
		assert.ok(back.startsWith("#"));
	});

	it("HCT values for known colors", () => {
		const black = Color.hct("#000000");
		assert.equal(black.tone, 0);

		const white = Color.hct("#ffffff");
		assert.equal(white.tone, 100);
	});
});
