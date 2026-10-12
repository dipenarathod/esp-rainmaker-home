/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  TimeSeriesBucket,
  TimeSeriesProvider,
  TimeSeriesSample,
  TimeSeriesStat,
} from "@shared/timeSeries";

import type { ChartMode, ChartRange } from "@src/types/global";
import {
  RAW_MAX_SAMPLES,
  TS_FETCH_PLAN_SERVER,
  TS_FETCH_PLAN_UNSUPPORTED,
} from "@features/control/constants";
import {
  isWindowMode,
  resolveFetchPlan,
  type TimeSeriesFetchPlan,
} from "@features/control/utils/timeSeriesWindows";
import {
  toNumericSamples,
  type NumericSample,
} from "@features/control/utils/timeSeriesBuckets";

/**
 * Pure fetch orchestration for one chart range: which plan applies, how
 * pages are followed, and how results are keyed and cached. No React here.
 */

/** One fetched range: buckets for window tabs, samples for the raw tab. */
export interface FetchedRange {
  /** How the range was served */
  plan: TimeSeriesFetchPlan;
  /** Buckets of the range (window tabs) */
  buckets: TimeSeriesBucket[];
  /** Numeric samples of the range (raw tab) */
  samples: NumericSample[];
  /** Raw samples were capped; the range holds more on the server */
  truncated: boolean;
}

export const EMPTY_FETCHED: FetchedRange = {
  plan: TS_FETCH_PLAN_UNSUPPORTED,
  buckets: [],
  samples: [],
  truncated: false,
};

/**
 * Key of the request a view needs. The statistic is part of it only on
 * backends that compute one statistic per request, so on pre-compute
 * backends switching the dropdown never produces a new key.
 * @param mode - Active tab
 * @param range - Visible range
 * @param stat - Selected statistic
 * @param statPerFetch - Whether the backend computes one statistic per request
 * @returns Stable string key
 */
export const rangeFetchKey = (
  mode: ChartMode,
  range: ChartRange,
  stat: TimeSeriesStat | null,
  statPerFetch: boolean,
): string =>
  `${mode}|${range.start}|${range.end}|${statPerFetch ? stat : ""}`;

/**
 * Follows raw pages newest-first until the sample cap is reached, so a capped
 * range keeps its most recent samples.
 * @param provider - Provider of the param
 * @param range - Range to read
 * @returns Numeric samples ascending, and whether the cap cut the range short
 */
const fetchRawSamples = async (
  provider: TimeSeriesProvider,
  range: ChartRange,
): Promise<{ samples: NumericSample[]; truncated: boolean }> => {
  const collected: TimeSeriesSample[] = [];
  let page = await provider.fetchRaw({ startMs: range.start, endMs: range.end });
  collected.push(...page.samples);
  while (page.hasMore && page.fetchNext && collected.length < RAW_MAX_SAMPLES) {
    page = await page.fetchNext();
    collected.push(...page.samples);
  }
  return {
    samples: toNumericSamples(collected.slice(0, RAW_MAX_SAMPLES)),
    truncated: collected.length > RAW_MAX_SAMPLES || page.hasMore,
  };
};

/**
 * Fetches one range according to its plan.
 * @param provider - Provider of the param
 * @param mode - Active tab
 * @param range - Range to read
 * @param stat - Statistic, needed by single-stat backends
 * @returns Fetched buckets or samples
 */
export const fetchRange = async (
  provider: TimeSeriesProvider,
  mode: ChartMode,
  range: ChartRange,
  stat: TimeSeriesStat | null,
): Promise<FetchedRange> => {
  const plan = resolveFetchPlan(mode, range, provider);
  if (plan === TS_FETCH_PLAN_UNSUPPORTED) {
    return { ...EMPTY_FETCHED, plan };
  }
  if (plan === TS_FETCH_PLAN_SERVER && isWindowMode(mode)) {
    const buckets = await provider.fetchBuckets({
      window: mode,
      startMs: range.start,
      endMs: range.end,
      stat: stat ?? undefined,
    });
    return { plan, buckets, samples: [], truncated: false };
  }
  const { samples, truncated } = await fetchRawSamples(provider, range);
  return { plan, buckets: [], samples, truncated };
};

/** Most cached ranges kept per param before the oldest is evicted. */
const RANGE_CACHE_SIZE = 24;
/** How long a range that reaches the present is served from cache. */
const LIVE_RANGE_CACHE_TTL_MS = 60 * 1000;

/** Cached fetch with the time it was taken and whether it can go stale. */
interface CachedRange {
  result: FetchedRange;
  fetchedAt: number;
  /** True when the range reached the present at fetch time. */
  live: boolean;
}

/**
 * Small LRU-ish cache of fetched ranges. Settled ranges are kept for the
 * session; ranges that reached the present are served for a short while so
 * hopping between tabs does not refetch, then refreshed.
 */
export class RangeCache {
  private readonly entries = new Map<string, CachedRange>();

  /**
   * Returns the cached result for a key when present and still fresh.
   * @param key - Fetch key
   * @param now - Reference time (Unix ms)
   * @returns Cached result, or null
   */
  get(key: string, now: number = Date.now()): FetchedRange | null {
    const cached = this.entries.get(key);
    if (!cached) return null;
    const fresh = !cached.live || now - cached.fetchedAt < LIVE_RANGE_CACHE_TTL_MS;
    return fresh ? cached.result : null;
  }

  /**
   * Stores a result, evicting the oldest entry past the size cap.
   * @param key - Fetch key
   * @param result - Fetched range
   * @param live - Whether the range reached the present when fetched
   * @param now - Reference time (Unix ms)
   */
  set(key: string, result: FetchedRange, live: boolean, now: number = Date.now()): void {
    this.entries.delete(key);
    if (this.entries.size >= RANGE_CACHE_SIZE) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { result, fetchedAt: now, live });
  }

  /** Drops every entry (new param). */
  clear(): void {
    this.entries.clear();
  }
}
