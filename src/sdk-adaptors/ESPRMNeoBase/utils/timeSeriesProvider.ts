/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ESPRMNeoDeviceParam,
  ESPRMNeoTSAggregationWindow,
  ESPRMNeoTSDataResult,
} from "@espressif/rainmaker-neo-base-sdk";

import {
  DATA_TYPE_STRING,
  ESPRM_PARAM_TIME_SERIES_PROPERTY,
  TS_PROVIDER_NEO,
  TS_WINDOWS,
} from "@shared/utils/constants";
import {
  PRECOMPUTED_STATS,
  alignToWindowStart,
  bucketFromPrecomputed,
  collectPages,
  formatWindowBound,
  normalizeBucketList,
  parseWindowDateKey,
  toNewestFirstRawPage,
  windowEnd,
  type TimeSeriesBucket,
  type TimeSeriesBucketQuery,
  type TimeSeriesProvider,
  type TimeSeriesRawPage,
  type TimeSeriesRawQuery,
  type TimeSeriesSample,
  type TimeSeriesWindow,
} from "@shared/timeSeries";

/**
 * RainMaker Neo time series: raw samples and pre-computed
 * hourly/daily/weekly/monthly aggregates. Unlike classic
 * DynamoDB, a Neo range query returns completed windows only; the
 * in-progress window comes from a separate no-date query and is stitched in
 * here so the chart sees one bucket list on every backend.
 */

/** Neo has no page cap; keep pages large so a range needs few round trips. */
const NEO_PAGE_SIZE = 200;

/** Whether a reported value is a plottable scalar (Neo may also carry objects for some data models). */
const isScalar = (value: unknown): value is number | string | boolean =>
  typeof value === "number" ||
  typeof value === "string" ||
  typeof value === "boolean";

/** Maps a Neo raw result to provider samples, dropping non-scalar values. */
const toSamples = (result: ESPRMNeoTSDataResult): TimeSeriesSample[] => {
  const samples: TimeSeriesSample[] = [];
  for (const point of result.data ?? []) {
    if (!isScalar(point.value)) continue;
    samples.push({ timestamp: point.timestamp, value: point.value });
  }
  return samples;
};

/** Wraps a Neo raw result as a provider page, newest sample first. */
const toRawPage = (result: ESPRMNeoTSDataResult): TimeSeriesRawPage =>
  toNewestFirstRawPage(result, toSamples);

/**
 * Normalizes the completed-window entries of one aggregates page.
 * @param result - SDK aggregates result
 * @param window - Requested window
 * @returns Buckets of the page
 */
const historicalBuckets = (
  result: ESPRMNeoTSDataResult,
  window: TimeSeriesWindow,
): TimeSeriesBucket[] => {
  const buckets: TimeSeriesBucket[] = [];
  for (const entry of result.aggregates ?? []) {
    const stats = entry.windows[window as ESPRMNeoTSAggregationWindow];
    if (!stats || typeof entry.date !== "string") continue;
    const start = parseWindowDateKey(entry.date);
    if (start === undefined) continue;
    buckets.push(
      bucketFromPrecomputed(start, window, stats, !!entry.isCumulative, false),
    );
  }
  return buckets;
};

/**
 * Reads the in-progress window. Neo omits the device time zone from
 * aggregates, so a bucket that is current is placed on the phone-local grid at
 * "now", matching how historical date keys are mapped. The backend only
 * archives a window when the next sample arrives, so an offline device keeps
 * an older window as "current": such a bucket is placed at its own start and
 * no longer flagged live.
 */
const liveBucket = async (
  param: ESPRMNeoDeviceParam,
  window: TimeSeriesWindow,
  now: number,
): Promise<TimeSeriesBucket | undefined> => {
  const result = await param.getTSData({
    window: window as ESPRMNeoTSAggregationWindow,
  });
  const entry = result.aggregates?.[0];
  const stats = entry?.windows[window as ESPRMNeoTSAggregationWindow];
  if (!entry || !stats) return undefined;

  const currentStart = alignToWindowStart(now, window);
  const reported =
    typeof stats.windowStart === "string" ? Date.parse(stats.windowStart) : NaN;
  const isCurrent =
    Number.isNaN(reported) ||
    (reported >= currentStart && reported < windowEnd(currentStart, window));
  const start = isCurrent ? currentStart : alignToWindowStart(reported, window);

  const bucket = bucketFromPrecomputed(
    start,
    window,
    stats,
    !!entry.isCumulative,
    isCurrent,
  );
  return Object.keys(bucket.stats).length > 0 ? bucket : undefined;
};

/** Reads completed buckets of a range and stitches the in-progress window when the range reaches now. */
const fetchBuckets = async (
  param: ESPRMNeoDeviceParam,
  query: TimeSeriesBucketQuery,
): Promise<TimeSeriesBucket[]> => {
  const now = Date.now();
  const buckets: TimeSeriesBucket[] = [];

  // Completed windows. Neo's end_date is inclusive of the period it names, so
  // the exclusive range end is stepped back into the last bucket.
  if (query.startMs < now) {
    const first = await param.getTSData({
      window: query.window as ESPRMNeoTSAggregationWindow,
      startDate: formatWindowBound(query.startMs, query.window),
      endDate: formatWindowBound(Math.min(query.endMs, now) - 1, query.window),
      pageSize: NEO_PAGE_SIZE,
    });
    buckets.push(
      ...(await collectPages(first, (page) =>
        historicalBuckets(page, query.window),
      )),
    );
  }

  // In-progress window, when the range reaches the present. If an archived
  // bucket shares its start (premature archive after a device time zone
  // change), the live bucket wins in normalizeBucketList.
  if (query.endMs > now) {
    const live = await liveBucket(param, query.window, now);
    if (live && live.start >= query.startMs && live.start < query.endMs) {
      buckets.push(live);
    }
  }

  return normalizeBucketList(buckets);
};

/** Reads one raw page from the Neo raw endpoint. */
const fetchRaw = async (
  param: ESPRMNeoDeviceParam,
  query: TimeSeriesRawQuery,
): Promise<TimeSeriesRawPage> =>
  toRawPage(
    await param.getRawTSData({
      startTs: query.startMs,
      endTs: query.endMs,
      pageSize: query.pageSize ?? NEO_PAGE_SIZE,
    }),
  );

/**
 * Creates the time series provider for a Neo param. Returns undefined for
 * params without the `time_series` property.
 * @param param - Neo SDK device param
 * @returns Provider, or undefined when the param has no time series
 */
export const createNeoTimeSeriesProvider = (
  param: ESPRMNeoDeviceParam,
): TimeSeriesProvider | undefined => {
  if (!param.properties?.includes(ESPRM_PARAM_TIME_SERIES_PROPERTY)) {
    return undefined;
  }
  // The stream processor aggregates bool (as 0/1) and numeric params; string
  // samples cannot be reduced to a number and fail aggregation.
  const aggregatable = param.dataType !== DATA_TYPE_STRING;
  return {
    id: TS_PROVIDER_NEO,
    limits: {
      windows: aggregatable ? TS_WINDOWS : [],
      maxWindowSpanMs: {},
      statsPerFetch: "all",
      stats: aggregatable ? PRECOMPUTED_STATS : [],
      supportsRaw: true,
    },
    fetchBuckets: (query) => fetchBuckets(param, query),
    fetchRaw: (query) => fetchRaw(param, query),
  };
};
