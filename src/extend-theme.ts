/**
 * @license
 * Copyright 2021 Google LLC
 * Copyright 2026 Panmdaa
 *
 * Derived from Material Color Utilities.
 * Modified and maintained by the Panmdaa project.
 *
 * SPDX-License-Identifier: Apache-2.0
*/



import { argbFromHex, hexFromArgb } from "./utils";
import { Blend } from "./science";
import { Hct } from "./hct";
import { clampDouble } from "./utils";
import { gradient as computeGradient } from "./gradient";
import type { ColorValue, Palette, CustomTokenOptions, GradientOptions } from "./types";

function toKebabCase(name: string): string {
	return name
		.replace(/_/g, "-")
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.toLowerCase();
}

function generateOn(base: ColorValue): ColorValue {
	const c = Hct.fromInt(argbFromHex(base));
	c.tone = c.tone >= 60 ? 10 : 90;
	return hexFromArgb(c.toInt()) as ColorValue;
}

function resolveMix(
	colors: (ColorValue | keyof Palette)[],
	modePalette: Palette,
): ColorValue {
	if (colors.length === 0) throw new Error("mix requires at least one color");
	if (colors.length === 1) {
		const c = colors[0];
		return typeof c === "string" && c.startsWith("#")
			? (c as ColorValue)
			: (modePalette[c as keyof Palette] as ColorValue);
	}

	const hcts = colors.map((c) => {
		const hex =
			typeof c === "string" && c.startsWith("#")
				? (c as ColorValue)
				: (modePalette[c as keyof Palette] as ColorValue);
		return Hct.fromInt(argbFromHex(hex));
	});
	const n = hcts.length;

	let sinSum = 0;
	let cosSum = 0;
	let chromaSum = 0;
	let toneSum = 0;

	for (const h of hcts) {
		const rad = (h.hue * Math.PI) / 180;
		sinSum += Math.sin(rad);
		cosSum += Math.cos(rad);
		chromaSum += h.chroma;
		toneSum += h.tone;
	}

	const avgHue = ((Math.atan2(sinSum / n, cosSum / n) * 180) / Math.PI + 360) % 360;
	const avgChroma = Math.max(0, chromaSum / n);
	const avgTone = Math.max(0, Math.min(100, toneSum / n));

	return hexFromArgb(Hct.from(avgHue, avgChroma, avgTone).toInt()) as ColorValue;
}

function resolveOne(
	config: ColorValue | CustomTokenOptions,
	modePalette: Palette,
	seedHct: Hct,
): ColorValue {
	if (typeof config === "string") {
		return config;
	}

	if (config.from) {
		const base = modePalette[config.from];
		if (!config.adjust) return base;
		const c = Hct.fromInt(argbFromHex(base));
		if (config.adjust.hue !== undefined) c.hue = (c.hue + config.adjust.hue + 360) % 360;
		if (config.adjust.chroma !== undefined) c.chroma = Math.max(0, c.chroma + config.adjust.chroma);
		if (config.adjust.tone !== undefined) c.tone = clampDouble(0, 100, c.tone + config.adjust.tone);
		return hexFromArgb(c.toInt()) as ColorValue;
	}

	if (config.harmonize) {
		return hexFromArgb(
			Blend.harmonize(argbFromHex(config.harmonize), seedHct.toInt()),
		) as ColorValue;
	}

	if (config.random) {
		const hue = (seedHct.hue + (Math.random() - 0.5) * 60 + 360) % 360;
		const chroma = Math.max(8, seedHct.chroma * (0.5 + Math.random() * 0.5));
		const tone = 40 + Math.random() * 40;
		return hexFromArgb(Hct.from(hue, chroma, tone).toInt()) as ColorValue;
	}

	if (config.mix) {
		return resolveMix(config.mix, modePalette);
	}

	throw new Error("Invalid token config: provide 'from', 'harmonize', 'random', or 'mix'");
}

export function resolveCustomTokens(
	light: Palette,
	dark: Palette,
	seed: ColorValue,
	tokens: Record<string, ColorValue | CustomTokenOptions>,
): { light: Record<string, ColorValue>; dark: Record<string, ColorValue> } {
	const seedHct = Hct.fromInt(argbFromHex(seed));
	const sharedTokens: Record<string, ColorValue> = {};
	const lightTokens: Record<string, ColorValue> = {};
	const darkTokens: Record<string, ColorValue> = {};

	for (let [name, config] of Object.entries(tokens)) {
		name = toKebabCase(name);

		if (typeof config !== "string" && config.gradient) {
			const grads = resolveGradient(name, config.gradient, light, seedHct);
			Object.assign(sharedTokens, grads);
			continue;
		}

		const resolvedOther = typeof config === "string" || config.harmonize || config.random;
		const value = resolveOne(config, resolvedOther ? light : light, seedHct);

		if (resolvedOther) {
			sharedTokens[name] = value;
		} else {
			lightTokens[name] = resolveOne(config, light, seedHct);
			darkTokens[name] = resolveOne(config, dark, seedHct);
		}

		if (!name.startsWith("on-")) {
			const onName = `on-${name}`;
			if (resolvedOther) {
				sharedTokens[onName] = generateOn(value);
			} else {
				lightTokens[onName] = generateOn(lightTokens[name]);
				darkTokens[onName] = generateOn(darkTokens[name]);
			}
		}
	}

	return {
		light: { ...lightTokens, ...sharedTokens },
		dark: { ...darkTokens, ...sharedTokens },
	};
}

function resolveGradient(
	name: string,
	options: GradientOptions,
	light: Palette,
	_seedHct: Hct,
): Record<string, ColorValue> {
	const endpoint = (val: string): ColorValue => {
		if (val.startsWith("#")) return val as ColorValue;
		return (light[val as keyof Palette] as ColorValue) ?? (val as ColorValue);
	};

	const steps = computeGradient(endpoint(options.from), endpoint(options.to), options.count);
	const result: Record<string, ColorValue> = {};
	for (let i = 0; i < steps.length; i++) {
		const key = `${name}-${i}`;
		result[key] = steps[i];
		result[`on-${key}`] = generateOn(steps[i]);
	}
	return result;
}
