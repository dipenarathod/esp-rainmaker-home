/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TS_STATS, TS_WINDOWS } from "@shared/utils/constants";

/**
 * Server aggregation window. The same four windows exist on RainMaker classic
 * (DynamoDB pre-compute and Timestream) and RainMaker Neo.
 */
export type TimeSeriesWindow = (typeof TS_WINDOWS)[number];

/**
 * One statistic of a bucket. Every window bucket may carry several of these;
 * the chart's aggregator dropdown picks which one to plot.
 */
export type TimeSeriesStat = (typeof TS_STATS)[number];

/** Statistics of one bucket; a stat the backend did not compute is absent. */
export type TimeSeriesBucketStats = Partial<Record<TimeSeriesStat, number>>;

/**
 * One aggregation bucket, normalized across backends.
 */
export interface TimeSeriesBucket {
  /** Bucket start on the phone-local calendar grid (Unix ms). */
  start: number;
  /** Bucket end, exclusive (Unix ms). */
  end: number;
  /** True while the bucket is still accumulating samples (current window). */
  live: boolean;
  /** True for meter-style cumulative parameters (stats are consumption deltas). */
  isCumulative: boolean;
  /** Statistics available for the bucket. */
  stats: TimeSeriesBucketStats;
}

/** One unaggregated sample as reported by the device. */
export interface TimeSeriesSample {
  /** Sample time (Unix ms). */
  timestamp: number;
  /** Reported value. */
  value: number | string | boolean;
}

/**
 * One page of raw samples. Pages are newest-first so a capped consumer keeps
 * the most recent data; the consumer decides how many pages to follow.
 */
export interface TimeSeriesRawPage {
  /** Samples of this page. */
  samples: TimeSeriesSample[];
  /** True when the backend has more samples in the queried range. */
  hasMore: boolean;
  /** Resolves the next page; present only when `hasMore` is true. */
  fetchNext?: () => Promise<TimeSeriesRawPage>;
}

/** Bucket query for one window over a half-open time range. */
export interface TimeSeriesBucketQuery {
  /** Aggregation window. */
  window: TimeSeriesWindow;
  /** Range start (Unix ms), aligned to the window. */
  startMs: number;
  /** Range end, exclusive (Unix ms), aligned to the window. */
  endMs: number;
  /**
   * Statistic to compute. Required by providers whose backend computes one
   * statistic per request (`statsPerFetch === "single"`); ignored otherwise.
   */
  stat?: TimeSeriesStat;
}

/** Raw sample query over a half-open time range. */
export interface TimeSeriesRawQuery {
  /** Range start (Unix ms). */
  startMs: number;
  /** Range end, exclusive (Unix ms). */
  endMs: number;
  /** Samples per page; providers clamp to their backend maximum. */
  pageSize?: number;
}

/**
 * What a backend can do for one parameter. Resolved per param by the SDK
 * adaptor, consumed by the chart to shape its tabs, ranges and dropdown.
 */
export interface TimeSeriesProviderLimits {
  /** Windows the backend aggregates for this parameter. */
  windows: readonly TimeSeriesWindow[];
  /**
   * Longest range one bucket query may span per window (Unix ms). Absent
   * windows have no server cap; the chart still applies its own bucket cap.
   */
  maxWindowSpanMs: Partial<Record<TimeSeriesWindow, number>>;
  /** Longest range one raw query may span (Unix ms); absent means no server cap. */
  maxRawSpanMs?: number;
  /**
   * `"all"`: every bucket carries every statistic, so switching the aggregator
   * is a client-side projection. `"single"`: the backend computes one
   * statistic per request, so switching refetches.
   */
  statsPerFetch: "all" | "single";
  /** Statistics the backend can produce for this parameter. */
  stats: readonly TimeSeriesStat[];
  /** Whether unaggregated samples can be read. */
  supportsRaw: boolean;
}

/**
 * Backend-neutral time series read surface for one device parameter.
 * Implemented per SDK adaptor and attached to the CDF param via
 * {@link attachTimeSeriesProvider}; the chart never sees SDK types.
 */
export interface TimeSeriesProvider {
  /** Which backend read model serves this param (see `TS_PROVIDER_*`). */
  readonly id: string;
  /** Capabilities and caps of the backend for this param. */
  readonly limits: TimeSeriesProviderLimits;
  /**
   * Fetches every bucket of the range (following backend pagination),
   * ascending by start. Buckets without data are simply absent.
   */
  fetchBuckets(query: TimeSeriesBucketQuery): Promise<TimeSeriesBucket[]>;
  /** Fetches the first (newest) page of raw samples in the range. */
  fetchRaw(query: TimeSeriesRawQuery): Promise<TimeSeriesRawPage>;
}
