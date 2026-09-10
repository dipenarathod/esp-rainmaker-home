/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TS_STAT_AVG,
  TS_STAT_COUNT,
  TS_STAT_FIRST,
  TS_STAT_LAST,
  TS_STAT_MAX,
  TS_STAT_MIN,
  TS_STAT_READING,
  TS_STAT_SUM,
} from "@shared/utils/constants";
import type {
  TimeSeriesBucket,
  TimeSeriesBucketStats,
  TimeSeriesStat,
  TimeSeriesWindow,
} from "./types";
import { windowEnd } from "./windowMath";

/**
 * Per-window statistics as both DynamoDB pre-compute backends (classic
 * `simple_tsdata` aggregates and Neo `timeseries/aggregates`) report them,
 * after their SDKs camelCase the wire fields.
 */
export interface PrecomputedWindowStats {
  count?: number;
  sum?: number;
  min?: number;
  max?: number;
  average?: number;
  firstValue?: number;
  lastValue?: number;
  /** Latest absolute meter reading (cumulative params only). */
  cumulativeValue?: number;
}

/** Statistics every pre-compute backend fills for numeric parameters. */
export const PRECOMPUTED_STATS: readonly TimeSeriesStat[] = [
  TS_STAT_AVG,
  TS_STAT_MIN,
  TS_STAT_MAX,
  TS_STAT_COUNT,
  TS_STAT_SUM,
  TS_STAT_FIRST,
  TS_STAT_LAST,
];

/** Returns the value when it is a finite number, else undefined. */
const finite = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/**
 * Builds a normalized bucket from a pre-computed window entry.
 *
 * For cumulative (meter) parameters both backends compute `sum`/`min`/`max`/
 * `average` over consumption deltas and keep the latest absolute reading in
 * `cumulativeValue`; a bucket with zero deltas (the first reading of a
 * window) reports zeros for those, which are dropped here so the chart shows a
 * gap instead of a fake zero. `cumulativeValue` is exposed as the `reading`
 * statistic only for cumulative params, where it is meaningful.
 * @param startMs - Bucket start on the phone-local grid (Unix ms)
 * @param window - Aggregation window
 * @param stats - Backend statistics of the window
 * @param isCumulative - Whether the parameter is a cumulative counter
 * @param live - Whether the window is still accumulating
 * @returns Normalized bucket
 */
export const bucketFromPrecomputed = (
  startMs: number,
  window: TimeSeriesWindow,
  stats: PrecomputedWindowStats,
  isCumulative: boolean,
  live: boolean,
): TimeSeriesBucket => {
  const count = finite(stats.count) ?? 0;
  const normalized: TimeSeriesBucketStats = {};
  if (count > 0) {
    normalized[TS_STAT_COUNT] = count;
    const avg = finite(stats.average);
    const min = finite(stats.min);
    const max = finite(stats.max);
    const sum = finite(stats.sum);
    if (avg !== undefined) normalized[TS_STAT_AVG] = avg;
    if (min !== undefined) normalized[TS_STAT_MIN] = min;
    if (max !== undefined) normalized[TS_STAT_MAX] = max;
    if (sum !== undefined) normalized[TS_STAT_SUM] = sum;
  }
  const first = finite(stats.firstValue);
  const last = finite(stats.lastValue);
  if (first !== undefined) normalized[TS_STAT_FIRST] = first;
  if (last !== undefined) normalized[TS_STAT_LAST] = last;
  if (isCumulative) {
    const reading = finite(stats.cumulativeValue);
    if (reading !== undefined) normalized[TS_STAT_READING] = reading;
  }
  return {
    start: startMs,
    end: windowEnd(startMs, window),
    live,
    isCumulative,
    stats: normalized,
  };
};

/**
 * Sorts buckets ascending and collapses buckets sharing a start. The live
 * (in-progress) bucket wins over a completed one at the same start: the
 * backends archive a window as soon as a sample lands in a different window,
 * and a device whose reported time zone changes mid-window (e.g. its first
 * sample after boot in the factory zone) shifts the window boundary and gets
 * a premature, near-empty archive under the same date key. The live bucket
 * carries the rest of the window's samples.
 * @param buckets - Buckets in any order
 * @returns Deduplicated ascending buckets
 */
export const normalizeBucketList = (
  buckets: TimeSeriesBucket[],
): TimeSeriesBucket[] => {
  const byStart = new Map<number, TimeSeriesBucket>();
  for (const bucket of buckets) {
    const existing = byStart.get(bucket.start);
    if (!existing || (bucket.live && !existing.live)) {
      byStart.set(bucket.start, bucket);
    }
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
};
