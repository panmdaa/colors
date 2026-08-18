import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Color } from "../../src/color";
import { approx } from "../helpers";

describe("public API — Color class", () => {
	it("from hex string", () => {
		const c = Color.from("#ff0000");
		assert.equal(c.hex, "#ff0000");
		assert.equal(c.toNumber(), 0xffff0000);
		assert.equal(c.toString(), "#ff0000");
		assert.equal(JSON.stringify(c), '"#ff0000"');
	});

	it("fromHex / fromArgb constructors", () => {
		assert.equal(Color.fromHex("#ff0000").hex, "#ff0000");
		assert.equal(Color.fromArgb(0x00ff00).hex, "#00ff00");
	});

	it("conversion methods", () => {
		const c = Color.from("#744c9d");
		assert.equal(c.toHexColor(), "#744c9d");
		assert.equal(c.toHex(), "#744c9d");
		assert.equal(c.toArgb(), 0xff744c9d);
		assert.equal(c.toNumber(), 0xff744c9d);
		assert.deepEqual(c.toRgb(), { r: 0x74, g: 0x4c, b: 0x9d });
		assert.equal(c.toHct().toInt(), 0xff744c9d);
	});

	it("fromHct defers the inverse solve until hex/argb is read", () => {
		const c = Color.fromHct(283, 36, 62);
		assert.equal(c.hue, 283);
		assert.equal(c.chroma, 36);
		assert.equal(c.tone, 62);
		assert.equal(typeof c.hex, "string");
	});

	it("from ARGB integer", () => {
		const c = Color.from(0x6750a4);
		assert.equal(c.hex, "#6750a4");
	});

	it("fromHct round-trips through hex", () => {
		const c = Color.fromHct(283, 36, 62);
		assert.equal(typeof c.hex, "string");
		assert.equal(typeof c.hue, "number");
		assert.ok(c.chroma > 0);
	});

	it("channels are consistent with static getters", () => {
		const c = Color.from("#6750a4");
		assert.equal(c.hue, Color.getHue("#6750a4"));
		assert.equal(c.chroma, Color.getChroma("#6750a4"));
		assert.equal(c.tone, Color.getTone("#6750a4"));
	});

	it("lazily caches channels (single computation)", () => {
		const c = Color.from("#6750a4");
		const hue = c.hue;
		assert.equal(c.hue, hue);
		assert.equal(c.chroma, c.chroma);
		assert.equal(c.tone, c.tone);
	});

	it("is immutable — mutating helpers return a new Color", () => {
		const c = Color.from("#ff0000");
		const light = c.lighten(10);
		assert.notEqual(light, c);
		assert.equal(c.hex, "#ff0000");
		assert.notEqual(light.hex, "#ff0000");
	});

	it("lighten/darken adjust tone", () => {
		const base = Color.from("#6750a4");
		assert.ok(base.lighten(10).tone > base.tone);
		assert.ok(base.darken(10).tone < base.tone);
	});

	it("saturate/desaturate adjust chroma", () => {
		const base = Color.from("#6750a4");
		assert.ok(base.saturate(20).chroma > base.chroma);
		assert.ok(base.desaturate(20).chroma < base.chroma);
	});

	it("rotateHue rotates hue", () => {
		const c = Color.from("#ff0000").rotateHue(90);
		assert.equal(c.hex, Color.rotateHue("#ff0000", 90).hex);
	});

	it("setHue/setChroma/setTone", () => {
		const c = Color.from("#ff0000");
		assert.ok(approx(c.setHue(180).hue, 180, 5));
		assert.ok(c.setChroma(50).chroma > 20);
		assert.ok(c.setTone(80).tone > 70);
	});

	it("edit is a no-op with empty options", () => {
		const c = Color.from("#ff0000");
		assert.equal(c.edit({}).hex, "#ff0000");
	});

	it("edit changes multiple channels at once", () => {
		const c = Color.from("#ff0000").edit({ hue: 200, tone: 40 });
		assert.ok(approx(c.hue, 200));
		assert.ok(approx(c.tone, 40));
	});

	it("atTone matches static tone()", () => {
		const c = Color.from("#6750a4").atTone(80);
		assert.equal(c.hex, Color.tone("#6750a4", 80).hex);
	});

	it("tones() returns all 14 reference tones", () => {
		const tones = Color.from("#6750a4").tones();
		assert.equal(Object.keys(tones).length, 14);
		assert.ok(tones[0]!.startsWith("#"));
		assert.ok(tones[100]!.startsWith("#"));
	});

	it("onColor matches static onColor", () => {
		const c = Color.from("#6750a4").onColor();
		assert.equal(c.hex, Color.onColor("#6750a4").hex);
	});

	it("contrastWith matches Contrast.ratioOfTones", () => {
		const c = Color.from("#ffffff").contrastWith("#000000");
		assert.ok(Math.abs(c - 21) < 0.01);
	});

	it("harmonize / isDisliked / fixDisliked", () => {
		const c = Color.from("#6750a4");
		assert.equal(typeof c.isDisliked(), "boolean");
		assert.equal(typeof c.harmonize("#ff0000").hex, "string");
		assert.equal(typeof c.fixDisliked().hex, "string");
	});

	it("chains multiple mutations", () => {
		const result = Color.from("#6750a4").lighten(10).saturate(20).rotateHue(45).hex;
		assert.ok(result.startsWith("#"));
		assert.notEqual(result, "#6750a4");
	});

	it("static setHue is consistent with the instance method", () => {
		assert.equal(Color.setHue("#ff0000", 180).hex, Color.from("#ff0000").setHue(180).hex);
	});
});
