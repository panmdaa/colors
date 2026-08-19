/**
 * Color manipulation with the Color class.
 *
 * The Color class is immutable and lazily evaluated: you can chain edits
 * without paying the CAM16 solve cost until you materialize the result
 * (hex, argb, ...).
 *
 * Run with:  npx tsx examples/color/color-workshop.ts
 */

import { Color } from "@panmdaa/colors";

// Constructors
const fromHex = Color.from("#744c9d");
const fromArgb = Color.from(0x744c9d);
const fromHct = Color.fromHct(283, 36, 62);
const fromNumber = Color.fromNumber(7629981);

console.log("=== Constructors ===");
console.log("from('#744c9d').hex:", fromHex.hex);
console.log("from(0x744c9d).hex:", fromArgb.hex);
console.log("fromHct(283, 36, 62).hex:", fromHct.hex);
console.log("fromNumber(7629981).hex:", fromNumber.hex);

// HCT channels (cheap to read; computed only once)
const c = Color.from("#744c9d");
console.log("\n=== HCT channels ===");
console.log("hue:", c.hue, "| chroma:", c.chroma, "| tone:", c.tone);
console.log("static getHue:", Color.getHue("#744c9d"));
console.log("static getTone:", Color.getTone("#744c9d"));

// Chained edits (always return a new Color)
console.log("\n=== Chained edits ===");
console.log("lighten(10).saturate(20):", c.lighten(10).saturate(20).hex);
console.log("setTone(80):", c.setTone(80).hex);
console.log("edit({ hue: 200, tone: 80 }):", c.edit({ hue: 200, tone: 80 }).hex);
console.log("rotateHue(90):", c.rotateHue(90).hex);
console.log("darken(30):", Color.darken("#744c9d", 30).hex);

// Reference tones
console.log("\n=== Reference tones ===");
const tones = c.tones();
for (const t of [10, 40, 60, 90]) console.log(`tone ${t}:`, tones[t as keyof typeof tones]);
console.log("atTone(90):", c.atTone(90).hex);

// Contrast and foreground / background pairing
console.log("\n=== Contrast ===");
console.log("contrastWith('#ffffff'):", c.contrastWith("#ffffff"));
console.log("onColor() for dark background:", Color.onColor("#1a1a2e").hex);
console.log("underColor() for light foreground:", Color.underColor("#ffffff").hex);

// Blends and gradients (HCT-space interpolation)
console.log("\n=== Blends and gradients ===");
console.log("mix(red, blue):", Color.mix("#ff0000", "#0000ff").hex);
console.log("mix 3 colors:", Color.mix("#ff0000", "#00ff00", "#0000ff").hex);
console.log("gradient(red → blue, 5):", Color.gradient("#ff0000", "#0000ff", 5));

// Corrections
console.log("\n=== Corrections ===");
console.log("isDisliked('#4a7a3f'):", Color.isDisliked("#4a7a3f"));
console.log("fixDisliked('#4a7a3f'):", Color.fixDisliked("#4a7a3f").hex);
console.log("harmonize('#ff0000', '#744c9d'):", Color.harmonize("#ff0000", "#744c9d").hex);

// Conversions
console.log("\n=== Conversions ===");
console.log("toArgb():", c.toArgb());
console.log("toRgb():", c.toRgb());
console.log("toHct():", c.toHct());
console.log("toHexColor():", c.toHexColor());