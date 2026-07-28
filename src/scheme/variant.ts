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

/**
 * Set of themes supported by Dynamic Color.
 * Instantiate the corresponding subclass, ex. SchemeTonalSpot, to create
 * colors corresponding to the theme.
 */
export enum Variant {
	MONOCHROME = 0,
	NEUTRAL = 1,
	TONAL_SPOT = 2,
	VIBRANT = 3,
	EXPRESSIVE = 4,
	FIDELITY = 5,
	CONTENT = 6,
	RAINBOW = 7,
	FRUIT_SALAD = 8,
	CMF = 9
}
