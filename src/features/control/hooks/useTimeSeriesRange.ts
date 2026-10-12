/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from "react";

import type { TimeSeriesProvider, TimeSeriesStat } from "@shared/timeSeries";

import type { ChartMode, ChartRange } from "@src/types/global";
import {
  EMPTY_FETCHED,
  RangeCache,
  fetchRange,
  rangeFetchKey,
  type FetchedRange,
} from "@features/control/utils/timeSeriesFetch";

/** A finished request: what it returned (or failed with) for which key. */
interface SettledFetch {
  key: string;
  result: FetchedRange;
  error: Error | null;
}

interface UseTimeSeriesRangeParams {
  /** Provider of the charted param */
  provider: TimeSeriesProvider | undefined;
  /** Active tab */
  mode: ChartMode | null;
  /** Visible range */
  range: ChartRange | null;
  /** Selected statistic */
  stat: TimeSeriesStat | null;
  /** Changes whenever the charted param changes; clears the cache */
  paramKey: string;
}

/**
 * Fetches and caches the data of the visible range. What the screen shows is
 * derived from the fetch key, never from a stale state slot: a key with no
 * answer yet is loading in the very frame the tab or range changes, so the
 * previous tab's buckets are never projected onto a new grid.
 * @param params - Provider and the current selection
 * @returns Data, loading and error for the current key
 */
export const useTimeSeriesRange = ({
  provider,
  mode,
  range,
  stat,
  paramKey,
}: UseTimeSeriesRangeParams) => {
  const [settled, setSettled] = useState<SettledFetch | null>(null);
  const requestIdRef = useRef(0);
  const cacheRef = useRef(new RangeCache());

  useEffect(() => {
    cacheRef.current.clear();
    setSettled(null);
  }, [paramKey]);

  const statPerFetch = provider?.limits.statsPerFetch === "single";
  const fetchKey =
    mode && range && (!statPerFetch || stat)
      ? rangeFetchKey(mode, range, stat, statPerFetch)
      : null;

  /** Cache entry answering the key, read during render so a cached tab renders in the same frame. */
  const cachedForKey = useMemo(
    () => (fetchKey ? cacheRef.current.get(fetchKey) : null),
    [fetchKey],
  );
  const settledForKey =
    settled && fetchKey && settled.key === fetchKey ? settled : null;

  useEffect(() => {
    if (!provider || !mode || !range || !fetchKey) return;
    if (cachedForKey || settledForKey) return;

    const key = fetchKey;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    fetchRange(provider, mode, range, stat)
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        const now = Date.now();
        cacheRef.current.set(key, result, range.end > now, now);
        setSettled({ key, result, error: null });
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setSettled({
          key,
          result: EMPTY_FETCHED,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
    // mode/range/stat are folded into fetchKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, fetchKey, cachedForKey, settledForKey]);

  return {
    fetched: cachedForKey ?? settledForKey?.result ?? EMPTY_FETCHED,
    error: settledForKey?.error ?? null,
    loading: !!fetchKey && !cachedForKey && !settledForKey,
  };
};
