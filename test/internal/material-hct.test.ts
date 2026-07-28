import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Hct as MaterialHct } from "../../src/hct";

describe("internal — material HCT", () => {
	it("Hct.fromInt creates instance", () => {
		const h = MaterialHct.fromInt(0xffff0000);
		assert.ok(h.hue >= 0);
		assert.ok(h.chroma > 0);
		assert.ok(h.tone > 0);
	});

	it("Hct roundtrip preserves value", () => {
		const argb = 0xffff0000;
		const h = MaterialHct.fromInt(argb);
		assert.equal(h.toInt(), argb);
	});

	it("Hct.from(hue, chroma, tone)", () => {
		const h = MaterialHct.from(0, 100, 50);
		assert.ok(h.hue >= 0);
		assert.ok(h.chroma > 0);
	});
});
