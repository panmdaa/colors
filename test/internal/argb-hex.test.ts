import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color } from "../../src/color";
import type { ColorValue } from "../../src/types";

describe("internal — argb <-> hex", () => {
	it("fromNumber produces correct format", () => {
		assert.equal(Color.fromNumber(0x000000).hex, "#000000");
		assert.equal(Color.fromNumber(0xffffff).hex, "#ffffff");
		assert.equal(Color.fromNumber(0xff0000).hex, "#ff0000");
		assert.equal(Color.fromNumber(0x00ff00).hex, "#00ff00");
		assert.equal(Color.fromNumber(0x0000ff).hex, "#0000ff");
	});

	it("toNumber strips alpha and returns RGB", () => {
		assert.equal(Color.toNumber("#ff0000"), 0xffff0000);
		assert.equal(Color.toNumber("#00ff00"), 0xff00ff00);
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
			assert.equal(Color.fromNumber(Color.toNumber(c)).hex, c);
		}
	});
});
