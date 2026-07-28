import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { fixDisliked, fromNumber, getTone, isDisliked } from "../../src/color";
import { DislikeAnalyzer } from "../../src/science";
import { Hct as MaterialHct } from "../../src/hct";

describe("color correctness — dislike", () => {
	it("rejects colors with hue 90-111, chroma > 16, tone < 65", () => {
		const h = MaterialHct.from(100, 40, 50);
		assert.ok(DislikeAnalyzer.isDisliked(h), "dark yellow-green should be disliked");
	});

	it("accepts red as not disliked", () => {
		assert.ok(!isDisliked("#ff0000"));
	});

	it("fixDisliked lightens disliked color to tone ~70", () => {
		const h = MaterialHct.from(100, 40, 50);
		const fixed = fixDisliked(fromNumber(h.toInt()));
		assert.ok(getTone(fixed) >= 65, `expected tone ~70, got ${getTone(fixed)}`);
	});

	it("fixDisliked leaves acceptable color unchanged", () => {
		assert.equal(fixDisliked("#ff0000"), "#ff0000");
	});
});
