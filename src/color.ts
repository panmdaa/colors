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

export { Color } from './color-class';
export * from './colors';
export { simulateCVD, simulateAllCVD } from './science';
export type {
	ColorVisionDeficiency,
	CVDSeverity,
	ContrastScore,
	ContrastScoreCVD,
	PaletteCheckerPair,
	PaletteCheckerResult,
	PaletteCheckerMode,
	PaletteCheckerSimulation,
	PaletteModeSummary,
} from './types';
