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



import { clampDouble } from "./utils";
import { Color } from "./color-class";
import type { ColorValue, Palette, CustomTokenOptions, GradientOptions } from "./types";

function toKebabCase(name: string): string {
	return name
		.replace(/_/g, "-")
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.toLowerCase();
}

function generateOn(base: ColorValue): ColorValue {
	const c = Color.from(base);
	return c.setTone(c.tone >= 60 ? 10 : 90).hex;
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

	const c = colors.map((item) => {
		const hex =
			typeof item === "string" && item.startsWith("#")
				? (item as ColorValue)
				: (modePalette[item as keyof Palette] as ColorValue);
		return Color.from(hex);
	});
	const n = c.length;

	let sinSum = 0;
	let cosSum = 0;
	let chromaSum = 0;
	let toneSum = 0;

	for (const color of c) {
		const rad = (color.hue * Math.PI) / 180;
		sinSum += Math.sin(rad);
		cosSum += Math.cos(rad);
		chromaSum += color.chroma;
		toneSum += color.tone;
	}

	const avgHue = ((Math.atan2(sinSum / n, cosSum / n) * 180) / Math.PI + 360) % 360;
	const avgChroma = Math.max(0, chromaSum / n);
	const avgTone = Math.max(0, Math.min(100, toneSum / n));

	return Color.fromHct(avgHue, avgChroma, avgTone).hex;
}

function resolveOne(
	config: ColorValue | CustomTokenOptions,
	modePalette: Palette,
	seed: Color,
): ColorValue {
	if (typeof config === "string") {
		return config;
	}

	if (config.from) {
		const base = modePalette[config.from];
		if (!config.adjust) return base;
		const c = Color.from(base);
		const hue =
			config.adjust.hue !== undefined ? (c.hue + config.adjust.hue + 360) % 360 : undefined;
		const chroma =
			config.adjust.chroma !== undefined
				? Math.max(0, c.chroma + config.adjust.chroma)
				: undefined;
		const tone =
			config.adjust.tone !== undefined
				? clampDouble(0, 100, c.tone + config.adjust.tone)
				: undefined;
		return c.edit({ hue, chroma, tone }).hex;
	}

	if (config.harmonize) {
		return Color.from(config.harmonize).harmonize(seed.toNumber()).hex;
	}

	if (config.random) {
		const hue = (seed.hue + (Math.random() - 0.5) * 60 + 360) % 360;
		const chroma = Math.max(8, seed.chroma * (0.5 + Math.random() * 0.5));
		const tone = 40 + Math.random() * 40;
		return Color.fromHct(hue, chroma, tone).hex;
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
	const seedColor = Color.from(seed);
	const sharedTokens: Record<string, ColorValue> = {};
	const lightTokens: Record<string, ColorValue> = {};
	const darkTokens: Record<string, ColorValue> = {};

	for (let [name, config] of Object.entries(tokens)) {
		name = toKebabCase(name);

		if (typeof config !== "string" && config.gradient) {
			const grads = resolveGradient(name, config.gradient, light, seedColor);
			Object.assign(sharedTokens, grads);
			continue;
		}

		const resolvedOther = typeof config === "string" || config.harmonize || config.random;
		const value = resolveOne(config, resolvedOther ? light : light, seedColor);

		if (resolvedOther) {
			sharedTokens[name] = value;
		} else {
			lightTokens[name] = resolveOne(config, light, seedColor);
			darkTokens[name] = resolveOne(config, dark, seedColor);
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
	_seed: Color,
): Record<string, ColorValue> {
	const endpoint = (val: string): ColorValue => {
		if (val.startsWith("#")) return val as ColorValue;
		return (light[val as keyof Palette] as ColorValue) ?? (val as ColorValue);
	};

	const steps = Color.gradient(endpoint(options.from), endpoint(options.to), options.count);
	const result: Record<string, ColorValue> = {};
	for (let i = 0; i < steps.length; i++) {
		const key = `${name}-${i}`;
		result[key] = steps[i];
		result[`on-${key}`] = generateOn(steps[i]);
	}
	return result;
}
