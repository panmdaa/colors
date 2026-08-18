import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color } from "../../src/color";
import { DislikeAnalyzer } from "../../src/science";
import { Hct as MaterialHct } from "../../src/hct";

describe("color correctness — dislike", () => {
	it("rejects colors with hue 90-111, chroma > 16, tone < 65", () => {
		const h = MaterialHct.from(100, 40, 50);
		assert.ok(DislikeAnalyzer.isDisliked(h), "dark yellow-green should be disliked");
	});

	it("accepts red as not disliked", () => {
		assert.ok(!Color.isDisliked("#ff0000"));
	});

	it("fixDisliked lightens disliked color to tone ~70", () => {
		const h = MaterialHct.from(100, 40, 50);
		const fixed = Color.fixDisliked(Color.fromNumber(h.toInt()).hex);
		assert.ok(Color.getTone(fixed.hex) >= 65, `expected tone ~70, got ${Color.getTone(fixed.hex)}`);
	});

	it("fixDisliked leaves acceptable color unchanged", () => {
		assert.equal(Color.fixDisliked("#ff0000").hex, "#ff0000");
	});
});
