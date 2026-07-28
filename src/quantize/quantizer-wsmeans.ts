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

import { LabPointProvider } from './lab-point-provider';

const MAX_ITERATIONS = 10;
const MIN_MOVEMENT_DISTANCE = 3.0;

/**
 * An image quantizer that improves on the speed of a standard K-Means algorithm
 * by implementing several optimizations, including deduping identical pixels
 * and a triangle inequality rule that reduces the number of comparisons needed
 * to identify which cluster a point should be moved to.
 *
 * Wsmeans stands for Weighted Square Means.
 *
 * This algorithm was designed by M. Emre Celebi, and was found in their 2011
 * paper, Improving the Performance of K-Means for Color Quantization.
 * https://arxiv.org/abs/1101.0395
 */
// material_color_utilities is designed to have a consistent API across
// platforms and modular components that can be moved around easily. Using a
// class as a namespace facilitates this.
//
export const QuantizerWsmeans = {
	/**
	 * @param inputPixels Colors in ARGB format.
	 * @param startingClusters Defines the initial state of the quantizer. Passing
	 *     an empty array is fine, the implementation will create its own initial
	 *     state that leads to reproducible results for the same inputs.
	 *     Passing an array that is the result of Wu quantization leads to higher
	 *     quality results.
	 * @param maxColors The number of colors to divide the image into. A lower
	 *     number of colors may be returned.
	 * @return Colors in ARGB format.
	 */
	quantize(
		inputPixels: number[],
		startingClusters: number[],
		maxColors: number
	): Map<number, number> {
		const pixelToCount = new Map<number, number>();
		const points: number[][] = [];
		const pixels: number[] = [];
		const pointProvider = new LabPointProvider();
		let pointCount = 0;
		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for (let i = 0; i < inputPixels.length; i++) {
			const inputPixel = inputPixels[i];
			const pixelCount = pixelToCount.get(inputPixel ?? 0);
			if (pixelCount === undefined) {
				pointCount++;
				points.push(pointProvider.fromInt(inputPixel ?? 0));
				pixels.push(inputPixel ?? 0);
				pixelToCount.set(inputPixel ?? 0, 1);
			} else {
				pixelToCount.set(inputPixel ?? 0, pixelCount + 1);
			}
		}

		const counts: number[] = [];
		for (let i = 0; i < pointCount; i++) {
			const pixel = pixels[i];
			const count = pixelToCount.get(pixel ?? 0);
			if (count !== undefined) {
				counts[i] = count;
			}
		}

		let clusterCount = Math.min(maxColors, pointCount);
		if (startingClusters.length > 0) {
			clusterCount = Math.min(clusterCount, startingClusters.length);
		}

		const clusters: number[][] = [];
		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for (let i = 0; i < startingClusters.length; i++) {
			clusters.push(pointProvider.fromInt(startingClusters[i] ?? 0));
		}
		const additionalClustersNeeded = clusterCount - clusters.length;
		if (startingClusters.length === 0 && additionalClustersNeeded > 0) {
			for (let i = 0; i < additionalClustersNeeded; i++) {
				const l = Math.random() * 100.0;
				const a = Math.random() * (100.0 - -100.0 + 1) + -100;
				const b = Math.random() * (100.0 - -100.0 + 1) + -100;

				clusters.push([l, a, b]);
			}
		}

		const clusterIndices: number[] = [];
		for (let i = 0; i < pointCount; i++) {
			clusterIndices.push(Math.floor(Math.random() * clusterCount));
		}

		const indexMatrix: number[][] = [];
		for (let i = 0; i < clusterCount; i++) {
			indexMatrix.push([] as number[]);
			for (let j = 0; j < clusterCount; j++) {
				(indexMatrix[i] ?? []).push(0);
			}
		}

		const distanceToIndexMatrix: DistanceAndIndex[][] = [];
		for (let i = 0; i < clusterCount; i++) {
			distanceToIndexMatrix.push([] as DistanceAndIndex[]);
			for (let j = 0; j < clusterCount; j++) {
				(distanceToIndexMatrix[i] ?? []).push(new DistanceAndIndex());
			}
		}

		const pixelCountSums: number[] = [];
		for (let i = 0; i < clusterCount; i++) {
			pixelCountSums.push(0);
		}
		for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
			for (let i = 0; i < clusterCount; i++) {
				for (let j = i + 1; j < clusterCount; j++) {
					const distance = pointProvider.distance(clusters[i] ?? [0], clusters[j] ?? [0]);
					distanceToIndexMatrix[j]![i]!.distance = distance;
					distanceToIndexMatrix[j]![i]!.index = i;
					distanceToIndexMatrix[i]![j]!.distance = distance;
					distanceToIndexMatrix[i]![j]!.index = j;
				}
				distanceToIndexMatrix[i]!.sort();
				for (let j = 0; j < clusterCount; j++) {
					indexMatrix[i]![j] = distanceToIndexMatrix[i]![j]!.index;
				}
			}

			let pointsMoved = 0;
			for (let i = 0; i < pointCount; i++) {
				const point = points[i];
				const previousClusterIndex = clusterIndices[i];
				const previousCluster = clusters[previousClusterIndex ?? 0];
				const previousDistance = pointProvider.distance(
					point ?? [0],
					previousCluster ?? [0]
				);
				let minimumDistance = previousDistance;
				let newClusterIndex = -1;
				for (let j = 0; j < clusterCount; j++) {
					if (
						distanceToIndexMatrix[previousClusterIndex ?? 0]![j]!.distance >=
						4 * previousDistance
					) {
						continue;
					}
					const distance = pointProvider.distance(point ?? [0], clusters[j] ?? [0]);
					if (distance < minimumDistance) {
						minimumDistance = distance;
						newClusterIndex = j;
					}
				}
				if (newClusterIndex !== -1) {
					const distanceChange = Math.abs(
						Math.sqrt(minimumDistance) - Math.sqrt(previousDistance)
					);
					if (distanceChange > MIN_MOVEMENT_DISTANCE) {
						pointsMoved++;
						clusterIndices[i] = newClusterIndex;
					}
				}
			}

			if (pointsMoved === 0 && iteration !== 0) {
				break;
			}

			const componentASums = new Array<number>(clusterCount).fill(0);
			const componentBSums = new Array<number>(clusterCount).fill(0);
			const componentCSums = new Array<number>(clusterCount).fill(0);

			for (let i = 0; i < clusterCount; i++) {
				pixelCountSums[i] = 0;
			}
			for (let i = 0; i < pointCount; i++) {
				const clusterIndex = clusterIndices[i];
				const point = points[i] ?? [0];
				const count = counts[i] ?? 0;
				pixelCountSums[clusterIndex ?? 0]! += count;
				componentASums[clusterIndex ?? 0]! += (point[0] ?? 1) * count;
				componentBSums[clusterIndex ?? 0]! += (point[1] ?? 1) * count;
				componentCSums[clusterIndex ?? 0]! += (point[2] ?? 1) * count;
			}

			for (let i = 0; i < clusterCount; i++) {
				const count = pixelCountSums[i] ?? 1;
				if (count === 0) {
					clusters[i] = [0.0, 0.0, 0.0];
					continue;
				}
				const a = (componentASums[i] ?? 1) / count;
				const b = (componentBSums[i] ?? 1) / count;
				const c = (componentCSums[i] ?? 1) / count;
				clusters[i] = [a, b, c];
			}
		}

		const argbToPopulation = new Map<number, number>();
		for (let i = 0; i < clusterCount; i++) {
			const count = pixelCountSums[i];
			if (count === 0) {
				continue;
			}

			const possibleNewCluster = pointProvider.toInt(clusters[i] ?? [1]);
			if (argbToPopulation.has(possibleNewCluster)) {
				continue;
			}

			argbToPopulation.set(possibleNewCluster, count ?? 1);
		}
		return argbToPopulation;
	}
};

/**
 *  A wrapper for maintaining a table of distances between K-Means clusters.
 */
class DistanceAndIndex {
	distance = -1;
	index = -1;
}
