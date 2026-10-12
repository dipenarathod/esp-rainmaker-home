/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ESPAggregationInterval,
  ESPAggregationMethod,
  ESPWeekStart,
  type ESPRMDeviceParam,
  type ESPSimpleTSAggregate,
  type ESPSimpleTSAggregatesResponse,
  type ESPSimpleTSAggregateWindow,
  type ESPSimpleTSDataResponse,
  type ESPTSDataRequest,
} from "@espressif/rainmaker-base-sdk";

import {
  DATA_TYPE_BOOL,
  DATA_TYPE_FLOAT,
  DATA_TYPE_INT,
  TS_BUCKET_STATUS_LIVE,
  TS_PROVIDER_RM_DYNAMO,
  TS_PROVIDER_RM_TIMESTREAM,
  TS_STAT_AVG,
  TS_STAT_COUNT,
  TS_STAT_LAST,
  TS_STAT_MAX,
  TS_STAT_MIN,
  TS_STAT_SUM,
  TS_WINDOW_DAILY,
  TS_WINDOW_HOURLY,
  TS_WINDOW_MONTHLY,
  TS_WINDOW_WEEKLY,
  TS_WINDOWS,
} from "@shared/utils/constants";
import { canonicalizeIana } from "@shared/utils/timezone";
import {
  MS,
  PRECOMPUTED_STATS,
  alignToWindowStart,
  bucketFromPrecomputed,
  collectPages,
  formatWindowBound,
  normalizeBucketList,
  parseWindowDateKey,
  toNewestFirstRawPage,
  toPlottableNumber,
  windowEnd,
  type TimeSeriesBucket,
  type TimeSeriesBucketQuery,
  type TimeSeriesProvider,
  type TimeSeriesRawPage,
  type TimeSeriesRawQuery,
  type TimeSeriesSample,
  type TimeSeriesStat,
  type TimeSeriesWindow,
} from "@shared/timeSeries";

import {
  ESPRM_PARAM_SIMPLE_TIME_SERIES_PROPERTY,
  ESPRM_PARAM_TIME_SERIES_PROPERTY,
} from "../constants";

/**
 * RainMaker classic exposes two time series read models, selected by the
 * param property the firmware declares:
 * - `time_series` → Timestream (`/user/nodes/tsdata`): the server computes one
 *   aggregate per request over a client-chosen interval, with per-interval
 *   range caps.
 * - `simple_ts` → DynamoDB (`/user/nodes/simple_tsdata`): the stream processor
 *   pre-computes every statistic per hourly/daily/weekly/monthly window; the
 *   in-progress window is returned inside range queries with status `latest`.
 * Both are exposed to the chart through the same provider contract.
 */

/** Records per page the classic raw endpoints accept at most. */
const RM_RAW_PAGE_SIZE = 200;
/** Records per page the classic aggregates range endpoint accepts at most. */
const RM_AGGREGATES_PAGE_SIZE = 100;

/**
 * Range caps of one Timestream request per aggregation interval
 * (`esptsdata.yml`: 24 hours, 31 days, 12 weeks, 12 months; raw 31 days).
 * Wider ranges are fetched in chunks, see {@link timestreamChunks}.
 */
const RM_TIMESTREAM_MAX_SPAN_MS: Record<TimeSeriesWindow, number> = {
  [TS_WINDOW_HOURLY]: 24 * MS.HOUR,
  [TS_WINDOW_DAILY]: 31 * MS.DAY,
  [TS_WINDOW_WEEKLY]: 12 * 7 * MS.DAY,
  [TS_WINDOW_MONTHLY]: 366 * MS.DAY,
};
const RM_TIMESTREAM_MAX_RAW_SPAN_MS = 31 * MS.DAY;

const WINDOW_TO_INTERVAL: Record<TimeSeriesWindow, ESPAggregationInterval> = {
  [TS_WINDOW_HOURLY]: ESPAggregationInterval.Hour,
  [TS_WINDOW_DAILY]: ESPAggregationInterval.Day,
  [TS_WINDOW_WEEKLY]: ESPAggregationInterval.Week,
  [TS_WINDOW_MONTHLY]: ESPAggregationInterval.Month,
};

const STAT_TO_AGGREGATE: Partial<Record<TimeSeriesStat, ESPAggregationMethod>> =
  {
    [TS_STAT_AVG]: ESPAggregationMethod.Avg,
    [TS_STAT_MIN]: ESPAggregationMethod.Min,
    [TS_STAT_MAX]: ESPAggregationMethod.Max,
    [TS_STAT_COUNT]: ESPAggregationMethod.Count,
    [TS_STAT_SUM]: ESPAggregationMethod.Sum,
    [TS_STAT_LAST]: ESPAggregationMethod.Latest,
  };

/**
 * Statistics Timestream computes per data type: everything for numbers,
 * count and latest for bool (latest plots as 1/0), count only for strings
 * (a latest text value cannot be plotted).
 */
const RM_TIMESTREAM_NUMERIC_STATS: readonly TimeSeriesStat[] = [
  TS_STAT_AVG,
  TS_STAT_MIN,
  TS_STAT_MAX,
  TS_STAT_COUNT,
  TS_STAT_SUM,
  TS_STAT_LAST,
];
const RM_TIMESTREAM_BOOL_STATS: readonly TimeSeriesStat[] = [
  TS_STAT_COUNT,
  TS_STAT_LAST,
];
const RM_TIMESTREAM_STRING_STATS: readonly TimeSeriesStat[] = [TS_STAT_COUNT];

/**
 * Statistics Timestream can compute for a data type.
 * @param dataType - Param data type
 * @returns Selectable statistics
 */
const timestreamStats = (dataType?: string): readonly TimeSeriesStat[] => {
  if (isNumericDataType(dataType)) return RM_TIMESTREAM_NUMERIC_STATS;
  if (dataType === DATA_TYPE_BOOL) return RM_TIMESTREAM_BOOL_STATS;
  return RM_TIMESTREAM_STRING_STATS;
};

/** Whether a data type is float or int, the only types the stream processor aggregates. */
const isNumericDataType = (dataType?: string): boolean =>
  dataType === DATA_TYPE_FLOAT || dataType === DATA_TYPE_INT;

/** Converts Unix ms to the whole seconds the classic endpoints take. */
const toSeconds = (ms: number): number => Math.floor(ms / MS.SECOND);

/** IANA zone of the phone, sent to Timestream so buckets align with the local calendar. */
const phoneTimezone = (): string =>
  canonicalizeIana(Intl.DateTimeFormat().resolvedOptions().timeZone);

/** Classic raw points carry Unix seconds; the provider contract is milliseconds. */
const toSamples = (response: ESPSimpleTSDataResponse): TimeSeriesSample[] =>
  response.tsData.map((point) => ({
    timestamp: point.timestamp * MS.SECOND,
    value: point.value,
  }));

/** Wraps a classic raw response as a provider page, newest sample first. */
const toRawPage = (response: ESPSimpleTSDataResponse): TimeSeriesRawPage =>
  toNewestFirstRawPage(response, toSamples);

// ─────────────────────────────────────────────────────────────────────────────
// Timestream (`time_series`)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splits a range into chunks the Timestream endpoint accepts for the window,
 * each ending on a bucket boundary so no bucket straddles two requests.
 */
const timestreamChunks = (
  query: TimeSeriesBucketQuery,
): { startMs: number; endMs: number }[] => {
  const cap = RM_TIMESTREAM_MAX_SPAN_MS[query.window];
  const chunks: { startMs: number; endMs: number }[] = [];
  let start = query.startMs;
  while (start < query.endMs) {
    let end = Math.min(query.endMs, alignToWindowStart(start + cap, query.window));
    if (end <= start) end = Math.min(query.endMs, windowEnd(start, query.window));
    chunks.push({ startMs: start, endMs: end });
    start = end;
  }
  return chunks;
};

/** Fetches one capped chunk of Timestream buckets for a single statistic. */
const timestreamFetchChunk = async (
  param: ESPRMDeviceParam,
  query: TimeSeriesBucketQuery,
  chunk: { startMs: number; endMs: number },
  stat: TimeSeriesStat,
  aggregate: ESPAggregationMethod,
): Promise<TimeSeriesBucket[]> => {
  const request: ESPTSDataRequest = {
    aggregate,
    aggregationInterval: WINDOW_TO_INTERVAL[query.window],
    startTime: toSeconds(chunk.startMs),
    endTime: toSeconds(chunk.endMs),
    timezone: phoneTimezone(),
    resultCount: RM_RAW_PAGE_SIZE,
    descOrder: false,
  };
  if (query.window === TS_WINDOW_WEEKLY) {
    request.weekStart = ESPWeekStart.Monday;
  }
  const now = Date.now();
  const points = await collectPages(
    await param.getTSData(request),
    (page) => page.tsData,
  );
  const buckets: TimeSeriesBucket[] = [];
  for (const point of points) {
    const value = toPlottableNumber(point.value);
    if (value === undefined) continue;
    const start = alignToWindowStart(point.timestamp * MS.SECOND, query.window);
    const end = windowEnd(start, query.window);
    buckets.push({
      start,
      end,
      live: end > now,
      isCumulative: false,
      stats: { [stat]: value },
    });
  }
  return buckets;
};

/**
 * Timestream computes one statistic per request and caps the span per
 * interval, so a wide range is fetched as consecutive capped chunks (e.g. a
 * 7-day hourly view is seven 24-hour requests) and merged.
 */
const timestreamFetchBuckets = async (
  param: ESPRMDeviceParam,
  query: TimeSeriesBucketQuery,
): Promise<TimeSeriesBucket[]> => {
  const stat = query.stat ?? TS_STAT_AVG;
  const aggregate = STAT_TO_AGGREGATE[stat];
  if (!aggregate) {
    throw new Error(`Timestream cannot compute the "${stat}" statistic`);
  }
  const buckets: TimeSeriesBucket[] = [];
  for (const chunk of timestreamChunks(query)) {
    buckets.push(
      ...(await timestreamFetchChunk(param, query, chunk, stat, aggregate)),
    );
  }
  return normalizeBucketList(buckets);
};

/** Reads one raw page from the Timestream endpoint. */
const timestreamFetchRaw = async (
  param: ESPRMDeviceParam,
  query: TimeSeriesRawQuery,
): Promise<TimeSeriesRawPage> =>
  toRawPage(
    await param.getRawTSData({
      startTime: toSeconds(query.startMs),
      endTime: toSeconds(query.endMs),
      resultCount: Math.min(query.pageSize ?? RM_RAW_PAGE_SIZE, RM_RAW_PAGE_SIZE),
      descOrder: true,
    }),
  );

/**
 * Provider over the Timestream endpoint for a `time_series` param.
 * @param param - Classic SDK device param
 * @returns Provider
 */
const createTimestreamProvider = (
  param: ESPRMDeviceParam,
): TimeSeriesProvider => ({
  id: TS_PROVIDER_RM_TIMESTREAM,
  limits: {
    windows: TS_WINDOWS,
    maxWindowSpanMs: RM_TIMESTREAM_MAX_SPAN_MS,
    maxRawSpanMs: RM_TIMESTREAM_MAX_RAW_SPAN_MS,
    statsPerFetch: "single",
    stats: timestreamStats(param.dataType),
    supportsRaw: true,
  },
  fetchBuckets: (query) => timestreamFetchBuckets(param, query),
  fetchRaw: (query) => timestreamFetchRaw(param, query),
});

// ─────────────────────────────────────────────────────────────────────────────
// DynamoDB pre-compute (`simple_ts`)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes one aggregates entry; entries without a date (no-data placeholders) yield nothing.
 * @param entry - SDK aggregate entry
 * @param window - Requested window
 * @returns Bucket, or undefined
 */
const dynamoBucket = (
  entry: ESPSimpleTSAggregate,
  window: TimeSeriesWindow,
): TimeSeriesBucket | undefined => {
  if (!entry.date || entry.message) return undefined;
  const start = parseWindowDateKey(entry.date);
  if (start === undefined) return undefined;
  return bucketFromPrecomputed(
    start,
    window,
    entry,
    !!entry.cumulative,
    entry.status === TS_BUCKET_STATUS_LIVE,
  );
};

/** Reads pre-computed buckets of a range from the DynamoDB aggregates endpoint. */
const dynamoFetchBuckets = async (
  param: ESPRMDeviceParam,
  query: TimeSeriesBucketQuery,
): Promise<TimeSeriesBucket[]> => {
  // The range endpoint treats both bounds as inclusive bucket keys, so the
  // exclusive range end is stepped back into the last bucket.
  const first: ESPSimpleTSAggregatesResponse =
    await param.getSimpleTSDataAggregates({
      window: query.window as ESPSimpleTSAggregateWindow,
      startDate: formatWindowBound(query.startMs, query.window),
      endDate: formatWindowBound(query.endMs - 1, query.window),
      resultCount: RM_AGGREGATES_PAGE_SIZE,
    });
  const entries = await collectPages(first, (page) => page.aggregates);
  const buckets: TimeSeriesBucket[] = [];
  for (const entry of entries) {
    const bucket = dynamoBucket(entry, query.window);
    if (bucket) buckets.push(bucket);
  }
  return normalizeBucketList(buckets);
};

/** Reads one raw page from the DynamoDB simple time series endpoint. */
const dynamoFetchRaw = async (
  param: ESPRMDeviceParam,
  query: TimeSeriesRawQuery,
): Promise<TimeSeriesRawPage> =>
  toRawPage(
    await param.getSimpleTSData({
      startTime: toSeconds(query.startMs),
      endTime: toSeconds(query.endMs),
      resultCount: Math.min(query.pageSize ?? RM_RAW_PAGE_SIZE, RM_RAW_PAGE_SIZE),
    }),
  );

/**
 * Provider over the DynamoDB pre-compute endpoints for a `simple_ts` param.
 * @param param - Classic SDK device param
 * @returns Provider
 */
const createDynamoProvider = (param: ESPRMDeviceParam): TimeSeriesProvider => {
  const numeric = isNumericDataType(param.dataType);
  return {
    id: TS_PROVIDER_RM_DYNAMO,
    limits: {
      // Only float/int are aggregated by the stream processor; the endpoint
      // rejects aggregates queries for other types.
      windows: numeric ? TS_WINDOWS : [],
      maxWindowSpanMs: {},
      statsPerFetch: "all",
      stats: numeric ? PRECOMPUTED_STATS : [],
      supportsRaw: true,
    },
    fetchBuckets: (query) => dynamoFetchBuckets(param, query),
    fetchRaw: (query) => dynamoFetchRaw(param, query),
  };
};

/**
 * Creates the time series provider for a classic RainMaker param, picking the
 * backend read model from the param's declared property. Returns undefined
 * for params without time series.
 * @param param - Classic SDK device param
 * @returns Provider, or undefined when the param has no time series property
 */
export const createRMTimeSeriesProvider = (
  param: ESPRMDeviceParam,
): TimeSeriesProvider | undefined => {
  const properties = param.properties ?? [];
  if (properties.includes(ESPRM_PARAM_TIME_SERIES_PROPERTY)) {
    return createTimestreamProvider(param);
  }
  if (properties.includes(ESPRM_PARAM_SIMPLE_TIME_SERIES_PROPERTY)) {
    return createDynamoProvider(param);
  }
  return undefined;
};
