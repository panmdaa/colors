import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { fromNumber, toNumber } from "../../src/color";
import type { ColorValue } from "../../src/types";

describe("internal — argb <-> hex", () => {
	it("fromNumber produces correct format", () => {
		assert.equal(fromNumber(0x000000), "#000000");
		assert.equal(fromNumber(0xffffff), "#ffffff");
		assert.equal(fromNumber(0xff0000), "#ff0000");
		assert.equal(fromNumber(0x00ff00), "#00ff00");
		assert.equal(fromNumber(0x0000ff), "#0000ff");
	});

	it("toNumber strips alpha and returns RGB", () => {
		assert.equal(toNumber("#ff0000"), 0xffff0000);
		assert.equal(toNumber("#00ff00"), 0xff00ff00);
	});

	it("roundtrip toNumber -> fromNumber", () => {
		const colors: ColorValue[] = [
			"#000000",
			"#ffffff",
			"#ff0000",
			"#00ff00",
			"#0000ff",
			"#6750a4",
			"#123456",
		];
		for (const c of colors) {
			assert.equal(fromNumber(toNumber(c)), c);
		}
	});
});
