/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TS_STAT_AVG,
  TS_STAT_READING,
  TS_STAT_SUM,
} from "@shared/utils/constants";
import {
  enumerateWindowStarts,
  toPlottableNumber,
  type TimeSeriesBucket,
  type TimeSeriesProvider,
  type TimeSeriesSample,
  type TimeSeriesStat,
  type TimeSeriesWindow,
} from "@shared/timeSeries";

import type { ChartDataPoint } from "@src/types/global";

/** A sample reduced to a plottable number. */
export interface NumericSample {
  /** Sample time (Unix ms). */
  timestamp: number;
  /** Numeric value. */
  value: number;
}

/**
 * Converts raw samples to ascending numeric samples, dropping the unplottable.
 * @param samples - Raw samples in any order
 * @returns Ascending numeric samples
 */
export const toNumericSamples = (
  samples: TimeSeriesSample[],
): NumericSample[] => {
  const numeric: NumericSample[] = [];
  for (const sample of samples) {
    const value = toPlottableNumber(sample.value);
    if (value === undefined) continue;
    numeric.push({ timestamp: sample.timestamp, value });
  }
  return numeric.sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Projects one statistic out of the buckets onto the full bucket grid of the
 * range: every grid slot yields a point, with `null` where the backend has no
 * bucket, so bars keep their slot and lines show gaps.
 * @param buckets - Buckets of the range (any order)
 * @param stat - Statistic to plot
 * @param window - Aggregation window
 * @param startMs - Range start (Unix ms)
 * @param endMs - Range end, exclusive (Unix ms)
 * @returns One chart point per grid slot, ascending
 */
export const projectBuckets = (
  buckets: TimeSeriesBucket[],
  stat: TimeSeriesStat,
  window: TimeSeriesWindow,
  startMs: number,
  endMs: number,
): ChartDataPoint[] => {
  const byStart = new Map<number, TimeSeriesBucket>();
  for (const bucket of buckets) byStart.set(bucket.start, bucket);
  return enumerateWindowStarts(startMs, endMs, window).map((start) => {
    const value = byStart.get(start)?.stats[stat];
    return {
      timestamp: start,
      value: typeof value === "number" ? value : null,
      label: "",
    };
  });
};

/**
 * Converts numeric samples to chart points.
 * @param samples - Ascending numeric samples
 * @returns Chart points
 */
export const samplesToPoints = (samples: NumericSample[]): ChartDataPoint[] =>
  samples.map((sample) => ({
    timestamp: sample.timestamp,
    value: sample.value,
    label: "",
  }));

/**
 * Largest-Triangle-Three-Buckets downsampling: keeps the visual shape of a
 * dense series with `threshold` points by picking, per bucket, the sample
 * forming the largest triangle with its neighbours.
 * @param samples - Ascending numeric samples
 * @param threshold - Points to keep (at least 3)
 * @returns Downsampled samples, first and last always kept
 */
export const downsampleLTTB = (
  samples: NumericSample[],
  threshold: number,
): NumericSample[] => {
  const length = samples.length;
  if (threshold >= length || threshold < 3) return samples;

  const sampled: NumericSample[] = [samples[0]];
  const bucketSize = (length - 2) / (threshold - 2);
  let previousIndex = 0;

  for (let i = 0; i < threshold - 2; i += 1) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, length);
    let avgX = 0;
    let avgY = 0;
    for (let j = rangeStart; j < rangeEnd; j += 1) {
      avgX += samples[j].timestamp;
      avgY += samples[j].value;
    }
    const rangeLength = Math.max(rangeEnd - rangeStart, 1);
    avgX /= rangeLength;
    avgY /= rangeLength;

    const bucketStart = Math.floor(i * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, length);
    const previous = samples[previousIndex];
    let maxArea = -1;
    let chosenIndex = bucketStart;
    for (let j = bucketStart; j < bucketEnd; j += 1) {
      const area = Math.abs(
        (previous.timestamp - avgX) * (samples[j].value - previous.value) -
          (previous.timestamp - samples[j].timestamp) * (avgY - previous.value),
      );
      if (area > maxArea) {
        maxArea = area;
        chosenIndex = j;
      }
    }
    sampled.push(samples[chosenIndex]);
    previousIndex = chosenIndex;
  }

  sampled.push(samples[length - 1]);
  return sampled;
};

/**
 * Statistics the aggregator dropdown offers for the buckets on screen: what
 * the backend computes, plus the meter `reading` for cumulative parameters.
 * @param provider - Provider of the param
 * @param isCumulative - Whether the buckets belong to a cumulative counter
 * @returns Selectable statistics in display order
 */
export const resolveStatOptions = (
  provider: TimeSeriesProvider,
  isCumulative: boolean,
): TimeSeriesStat[] => {
  const options = [...provider.limits.stats];
  if (
    isCumulative &&
    provider.limits.statsPerFetch === "all" &&
    !options.includes(TS_STAT_READING)
  ) {
    options.push(TS_STAT_READING);
  }
  return options;
};

/**
 * Statistic a fresh chart opens with: consumption (`sum`) for cumulative
 * counters, otherwise the average, falling back to the first option.
 * @param options - Selectable statistics
 * @param isCumulative - Whether the parameter is a cumulative counter
 * @returns Default statistic
 */
export const defaultStat = (
  options: readonly TimeSeriesStat[],
  isCumulative: boolean,
): TimeSeriesStat => {
  const preferred = isCumulative ? TS_STAT_SUM : TS_STAT_AVG;
  if (options.includes(preferred)) return preferred;
  return options[0] ?? TS_STAT_AVG;
};

/**
 * Whether any bucket belongs to a cumulative counter.
 * @param buckets - Buckets on screen
 * @returns True when the parameter is cumulative
 */
export const bucketsAreCumulative = (buckets: TimeSeriesBucket[]): boolean =>
  buckets.some((bucket) => bucket.isCumulative);
