import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { edit, getChroma, getHue, getTone } from "../../src/color";
import { approx } from "../helpers";

describe("public API — edit", () => {
	it("batch edits hue and tone", () => {
		const result = edit("#ff0000", { hue: 200, tone: 40 });
		assert.ok(approx(getHue(result), 200));
		assert.ok(approx(getTone(result), 40));
	});

	it("edit with partial options", () => {
		const result = edit("#ff0000", { chroma: 50 });
		assert.ok(approx(getChroma(result), 50, 5));
	});

	it("edit with empty options is a no-op", () => {
		const result = edit("#ff0000", {});
		assert.equal(result, "#ff0000");
	});
});
