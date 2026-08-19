/**
 * Theme from image (browser).
 *
 * End-to-end browser example: the user uploads an image, the dominant color
 * is extracted with Color.fromImage and used as the seed for palette(),
 * which is then injected as CSS variables via generateCSSSheet().
 *
 * It imports the library from its real package path:
 *   import { ... } from "@panmdaa/colors";
 *
 * It needs a bundler (e.g. `npx esbuild --bundle` or Vite) to resolve that
 * import in the browser. It will not work without one.
 */

import { Color, palette, generateCSSSheet } from "@panmdaa/colors";
import type { ColorValue } from "@panmdaa/colors";

const fileInput = document.querySelector<HTMLInputElement>("#picker");
const preview = document.querySelector<HTMLDivElement>("#preview");
const img = document.querySelector<HTMLImageElement>("#img");
const meta = document.querySelector<HTMLDivElement>("#meta");
const toggle = document.querySelector<HTMLButtonElement>("#toggle");

let dark = false;

function applyTheme(seedHex: ColorValue): void {
	const theme = palette(seedHex, { variant: "tonal-spot" });
	const css = generateCSSSheet(theme, {
		prefix: "--color-",
		darkSelector: '[data-theme="dark"]',
	});
	const style = document.createElement("style");
	style.textContent = css;
	document.head.appendChild(style);

	meta!.textContent = `Seed: ${seedHex} | light.primary: ${theme.light.primary} | dark.primary: ${theme.dark.primary}`;
	toggle!.hidden = false;
}

fileInput!.addEventListener("change", async () => {
	const file = fileInput!.files?.[0];
	if (!file) return;

	const url = URL.createObjectURL(file);
	img!.src = url;
	preview!.style.display = "block";

	await img!.decode();

	// Extract the dominant color from the loaded image
	const seed = await Color.fromImage(img!);
	applyTheme(seed.hex);
	URL.revokeObjectURL(url);
});

toggle!.addEventListener("click", () => {
	dark = !dark;
	document.documentElement.dataset.theme = dark ? "dark" : "light";
});