import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { getTone, tones, tone as withTone } from "../../src/color";
import { approx } from "../helpers";

describe("color correctness — tonal palette", () => {
	it("has 14 entries with correct tone values (±5)", () => {
		const expected = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100];
		const all = tones("#6750a4");
		assert.equal(Object.keys(all).length, 14, "should have 14 tone entries");

		for (const t of expected) {
			const actualTone = getTone(all[t as unknown as keyof typeof all]);
			assert.ok(approx(actualTone, t, 5), `tone ${t}: got ${actualTone}`);
		}
	});

	it("tone(0) is black (tone = 0)", () => {
		const all = tones("#6750a4");
		assert.equal(getTone(all[0 as unknown as keyof typeof all]), 0);
	});

	it("tone() function produces approximate tone (±3)", () => {
		for (const t of [0, 20, 50, 80, 100]) {
			const result = withTone("#6750a4", t);
			assert.ok(approx(getTone(result), t, 3), `tone ${t}: got ${getTone(result)}`);
		}
	});
});
