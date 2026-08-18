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

import { HctSolver, Cam16, Hct } from './hct';
import { Blend, DislikeAnalyzer, sourceColorFromImage } from './science';
import {
	argbFromHex,
	hexFromArgb,
	lstarFromY,
	lstarFromArgb,
	clampDouble,
	redFromArgb,
	greenFromArgb,
	blueFromArgb,
	Contrast
} from './utils';

import type { ColorValue, Tones } from './types';

/**
 * A color encapsulated as an immutable, lazily-evaluated object.
 *
 * The class never re-parses or re-solves: it stores either the ARGB integer
 * (from `from`/`fromArgb`/`fromHex`) or the requested HCT channels (from
 * `fromHct`), and runs the expensive steps only on demand — the CAM16 forward
 * pass the first time a channel is read, and the inverse solve the first time
 * `argb`/`hex` is read after a channel change. Mutating helpers only touch
 * channels and return a new {@link Color}, so chained edits do not pay for an
 * inverse solve until the final color is actually materialized.
 */
export class Color {
	private _argb: number | undefined;
	private _hue: number | undefined;
	private _chroma: number | undefined;
	private _tone: number | undefined;

	private constructor() {}

	/**
	 * @param color Hex string (`#rrggbb`) or ARGB integer.
	 */
	static from(color: ColorValue | number): Color {
		return typeof color === 'string' ? Color.fromHex(color) : Color.fromArgb(color);
	}

	/** @param hex Hex string (`#rrggbb`). */
	static fromHex(hex: ColorValue): Color {
		const c = new Color();
		c._argb = argbFromHex(hex);
		return c;
	}

	/** @param argb ARGB integer. */
	static fromArgb(argb: number): Color {
		const c = new Color();
		c._argb = argb;
		return c;
	}

	/**
	 * @param hue 0 <= hue < 360; invalid values are corrected.
	 * @param chroma 0 <= chroma; the returned chroma may be lower when the color
	 *     falls outside the sRGB gamut for the given hue and tone.
	 * @param tone 0 <= tone <= 100; invalid values are corrected.
	 */
	static fromHct(hue: number, chroma: number, tone: number): Color {
		const c = new Color();
		c._hue = hue;
		c._chroma = chroma;
		c._tone = tone;
		return c;
	}

	/** @param argb ARGB integer. @return A color. */
	static fromNumber(argb: number): Color {
		return Color.fromArgb(argb);
	}

	/** @return The ARGB integer of a color given as hex/ARGB. */
	static toNumber(color: ColorValue | number): number {
		return typeof color === 'number' ? color : argbFromHex(color);
	}

	/** @param color A color given as hex or ARGB integer. @return A new color. */
	static fromImage(image: HTMLImageElement): Promise<Color> {
		return sourceColorFromImage(image).then((n) => Color.fromArgb(n!));
	}

	/** @return The perceptual hue (0 <= hue < 360) of the given color. */
	static getHue(color: ColorValue | number): number {
		return Color.from(color).hue;
	}

	/** @return The perceptual chroma of the given color. */
	static getChroma(color: ColorValue | number): number {
		return Color.from(color).chroma;
	}

	/** @return The perceptual tone (L*, 0..100) of the given color. */
	static getTone(color: ColorValue | number): number {
		return lstarFromArgb(typeof color === 'number' ? color : argbFromHex(color));
	}

	/** @return The live, mutable {@link Hct} instance of the given color. */
	static hct(color: ColorValue | number): Hct {
		return Hct.fromInt(typeof color === 'number' ? color : argbFromHex(color));
	}

	/** @return A new color with the same chroma and tone but the given hue. */
	static setHue(color: ColorValue | number, hue: number): Color {
		return Color.from(color).setHue(hue);
	}

	/** @return A new color with the same hue and tone but the given chroma. */
	static setChroma(color: ColorValue | number, chroma: number): Color {
		return Color.from(color).setChroma(chroma);
	}

	/** @return A new color with the same hue and chroma but the given tone. */
	static setTone(color: ColorValue | number, tone: number): Color {
		return Color.from(color).setTone(tone);
	}

	/** @return A new color with the hue rotated, keeping chroma and tone. */
	static rotateHue(color: ColorValue | number, degrees: number): Color {
		return Color.from(color).rotateHue(degrees);
	}

	/** @return A new, lighter color with the same hue and chroma. */
	static lighten(color: ColorValue | number, amount: number): Color {
		return Color.from(color).lighten(amount);
	}

	/** @return A new, darker color with the same hue and chroma. */
	static darken(color: ColorValue | number, amount: number): Color {
		return Color.from(color).darken(amount);
	}

	/** @return A new, more chromatic color with the same hue and tone. */
	static saturate(color: ColorValue | number, amount: number): Color {
		return Color.from(color).saturate(amount);
	}

	/** @return A new, less chromatic color with the same hue and tone. */
	static desaturate(color: ColorValue | number, amount: number): Color {
		return Color.from(color).desaturate(amount);
	}

	/**
	 * Batch-edits any subset of the HCT channels in a single inverse solve.
	 * Channels that are `undefined` keep their current value.
	 */
	static edit(
		color: ColorValue | number,
		options: { hue?: number; chroma?: number; tone?: number },
	): Color {
		return Color.from(color).edit(options);
	}

	/** @return A new color with its hue harmonized towards `other`. */
	static harmonize(
		design: ColorValue | number,
		source: ColorValue | number,
	): Color {
		return Color.from(design).harmonize(source);
	}

	/** @return Whether the given color is considered "disliked". */
	static isDisliked(color: ColorValue | number): boolean {
		return Color.from(color).isDisliked();
	}

	/** @return The color, or a new harmonized variant when "disliked". */
	static fixDisliked(color: ColorValue | number): Color {
		return Color.from(color).fixDisliked();
	}

	/** @return The 14 reference tones of the given color as hex strings. */
	static tones(color: ColorValue | number): Record<Tones, ColorValue> {
		return Color.from(color).tones();
	}

	/** @return A new color with the same hue and chroma at the given tone. */
	static tone(color: ColorValue | number, tone: number): Color {
		return Color.from(color).atTone(tone);
	}

	/** @return A foreground color that contrasts with the given background. */
	static onColor(bg: ColorValue | number, ratio = 4.5): Color {
		return Color.from(bg).onColor(ratio);
	}

	/** @return A background color that contrasts with the given foreground. */
	static underColor(fg: ColorValue | number, ratio = 4.5): Color {
		return Color.from(fg).onColor(ratio);
	}

	/**
	 * Averages N colors in HCT using circular hue averaging.
	 *
	 * @return A new color. With a single argument, returns that color.
	 */
	static mix(...colors: (ColorValue | number)[]): Color {
		if (colors.length === 1) return Color.from(colors[0]!);

		const c = colors.map((x) => Color.from(x));
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

		return Color.fromHct(avgHue, avgChroma, avgTone);
	}

	/**
	 * Interpolates linearly in HCT between two colors.
	 *
	 * @return An array of hex colors, one per step.
	 */
	static gradient(from: ColorValue | number, to: ColorValue | number, count: number): ColorValue[] {
		if (count < 2) return [Color.from(from).hex];
		const a = Color.from(from);
		const b = Color.from(to);
		const result: ColorValue[] = [];
		for (let i = 0; i < count; i++) {
			const t = i / (count - 1);
			const hue = a.hue + (b.hue - a.hue) * t;
			const chroma = a.chroma + (b.chroma - a.chroma) * t;
			const tone = a.tone + (b.tone - a.tone) * t;
			result.push(Color.fromHct(hue, Math.max(0, chroma), clampDouble(0, 100, tone)).hex);
		}
		return result;
	}

	/** ARGB integer representation. Forces the inverse solve if pending. */
	get argb(): number {
		this.solveIfPending();
		return this._argb!;
	}

	/** Hex string (`#rrggbb`) representation. */
	get hex(): ColorValue {
		return hexFromArgb(this.argb) as ColorValue;
	}

	/** Perceptual hue, in degrees. Ranges from 0 <= hue < 360. */
	get hue(): number {
		this.ensureChannels();
		return this._hue!;
	}

	/** Perceptual chroma (colorfulness). */
	get chroma(): number {
		this.ensureChannels();
		return this._chroma!;
	}

	/** Perceptual lightness (L*), ranges from 0 to 100. */
	get tone(): number {
		this.ensureChannels();
		return this._tone!;
	}

	/**
	 * @param hue 0 <= hue < 360; invalid values are corrected.
	 * @return A new color with the same chroma and tone but the given hue.
	 * Chroma may decrease because chroma has a different maximum for any given
	 * hue and tone.
	 */
	setHue(hue: number): Color {
		return Color.fromHct(hue, this.chroma, this.tone);
	}

	/**
	 * @param chroma 0 <= chroma; the returned chroma may be lower when the color
	 *     falls outside the sRGB gamut for the given hue and tone.
	 * @return A new color with the same hue and tone but the given chroma.
	 */
	setChroma(chroma: number): Color {
		return Color.fromHct(this.hue, chroma, this.tone);
	}

	/**
	 * @param tone 0 <= tone <= 100; invalid values are corrected.
	 * @return A new color with the same hue and chroma but the given tone.
	 * Chroma may decrease because chroma has a different maximum for any given
	 * hue and tone.
	 */
	setTone(tone: number): Color {
		return Color.fromHct(this.hue, this.chroma, tone);
	}

	/**
	 * @param degrees How many degrees to rotate the hue. May be negative.
	 * @return A new color with the hue rotated, keeping chroma and tone.
	 */
	rotateHue(degrees: number): Color {
		return Color.fromHct((this.hue + degrees + 360) % 360, this.chroma, this.tone);
	}

	/**
	 * @param amount 0 <= amount <= 100.
	 * @return A new, lighter color with the same hue and chroma.
	 */
	lighten(amount: number): Color {
		return Color.fromHct(this.hue, this.chroma, Math.min(100, this.tone + amount));
	}

	/**
	 * @param amount 0 <= amount <= 100.
	 * @return A new, darker color with the same hue and chroma.
	 */
	darken(amount: number): Color {
		return Color.fromHct(this.hue, this.chroma, Math.max(0, this.tone - amount));
	}

	/**
	 * @param amount 0 <= amount.
	 * @return A new, more chromatic color with the same hue and tone.
	 */
	saturate(amount: number): Color {
		return Color.fromHct(this.hue, Math.max(0, this.chroma + amount), this.tone);
	}

	/**
	 * @param amount 0 <= amount.
	 * @return A new, less chromatic color with the same hue and tone.
	 */
	desaturate(amount: number): Color {
		return Color.fromHct(this.hue, Math.max(0, this.chroma - amount), this.tone);
	}

	/**
	 * Batch-edits any subset of the HCT channels in a single inverse solve.
	 * Channels that are `undefined` keep their current value.
	 *
	 * @param options The channels to change.
	 */
	edit(options: { hue?: number; chroma?: number; tone?: number }): Color {
		if (options.hue === undefined && options.chroma === undefined && options.tone === undefined) {
			return this;
		}
		return Color.fromHct(
			options.hue ?? this.hue,
			options.chroma ?? this.chroma,
			options.tone ?? this.tone
		);
	}

	/**
	 * @param tone 0 <= tone <= 100.
	 * @return A new color with the same hue and chroma at the given tone.
	 */
	atTone(tone: number): Color {
		return Color.fromHct(this.hue, this.chroma, tone);
	}

	/**
	 * The 14 reference tones of the color as hex strings.
	 */
	tones(): Record<Tones, ColorValue> {
		const toneValues: Tones[] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100];
		return Object.fromEntries(toneValues.map((t) => [t, this.atTone(t).hex])) as Record<
			Tones,
			ColorValue
		>;
	}

	/**
	 * A foreground color that contrasts against this color as background.
	 *
	 * @param ratio The minimum desired contrast ratio.
	 * @return A new color guaranteed to contrast with this color.
	 */
	onColor(ratio = 4.5): Color {
		const fgTone =
			this.tone >= 55
				? Contrast.darkerUnsafe(this.tone, ratio)
				: Contrast.lighterUnsafe(this.tone, ratio);
		return this.setTone(fgTone);
	}

	/**
	 * @param other Another color (or hex string / ARGB integer).
	 * @return The contrast ratio between this color and `other`, from 1 to 21.
	 */
	contrastWith(other: Color | ColorValue | number): number {
		const toneB = other instanceof Color ? other.tone : Color.from(other).tone;
		return Contrast.ratioOfTones(this.tone, toneB);
	}

	/**
	 * @param other Another color (or hex string / ARGB integer).
	 * @return A new color with its hue harmonized towards `other`.
	 */
	harmonize(other: Color | ColorValue | number): Color {
		const otherArgb = other instanceof Color ? other.argb : Color.from(other).argb;
		return Color.fromArgb(Blend.harmonize(this.argb, otherArgb));
	}

	/** @return Whether this color is considered "disliked" by the analyzer. */
	isDisliked(): boolean {
		return DislikeAnalyzer.isDisliked(Hct.fromInt(this.argb));
	}

	/**
	 * @return This color, or a new harmonized variant when the analyzer
	 *     considers it "disliked".
	 */
	fixDisliked(): Color {
		return Color.fromArgb(DislikeAnalyzer.fixIfDisliked(Hct.fromInt(this.argb)).toInt());
	}

	/** @return The ARGB integer representation. */
	toNumber(): number {
		return this.argb;
	}

	/** @return The ARGB integer representation. */
	toArgb(): number {
		return this.argb;
	}

	/** @return The hex string (`#rrggbb`) representation. */
	toHex(): ColorValue {
		return this.hex;
	}

	/** @return The hex string (`#rrggbb`) representation. */
	toHexColor(): ColorValue {
		return this.hex;
	}

	/** @return The red, green, blue components (0-255) of the color. */
	toRgb(): { r: number; g: number; b: number } {
		const argb = this.argb;
		return { r: redFromArgb(argb), g: greenFromArgb(argb), b: blueFromArgb(argb) };
	}

	/** @return An {@link Hct} instance of this color. */
	toHct(): Hct {
		return Hct.fromInt(this.argb);
	}

	/** @return The hex string (`#rrggbb`) representation. */
	toString(): string {
		return this.hex;
	}

	/** @return The hex string (`#rrggbb`) representation. */
	toJSON(): string {
		return this.hex;
	}

	private ensureChannels(): void {
		if (this._hue !== undefined && this._chroma !== undefined && this._tone !== undefined) {
			return;
		}
		const { hue, chroma, y } = Cam16.hctFromArgb(this.argb);
		this._hue = hue;
		this._chroma = chroma;
		this._tone = lstarFromY(y);
	}

	private solveIfPending(): void {
		if (this._argb !== undefined) {
			return;
		}
		this._argb = HctSolver.solveToInt(this._hue!, this._chroma!, this._tone!);
		const { hue, chroma, y } = Cam16.hctFromArgb(this._argb);
		this._hue = hue;
		this._chroma = chroma;
		this._tone = lstarFromY(y);
	}
}