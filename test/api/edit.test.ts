import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color } from "../../src/color";
import { approx } from "../helpers";

describe("public API — edit", () => {
	it("batch edits hue and tone", () => {
		const result = Color.edit("#ff0000", { hue: 200, tone: 40 });
		assert.ok(approx(Color.getHue(result.hex), 200));
		assert.ok(approx(Color.getTone(result.hex), 40));
	});

	it("edit with partial options", () => {
		const result = Color.edit("#ff0000", { chroma: 50 });
		assert.ok(approx(Color.getChroma(result.hex), 50, 5));
	});

	it("edit with empty options is a no-op", () => {
		const result = Color.edit("#ff0000", {});
		assert.equal(result.hex, "#ff0000");
	});
});
