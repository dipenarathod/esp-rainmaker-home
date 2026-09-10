/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TimeSeriesRawPage, TimeSeriesSample } from "./types";

/** Upper bound on pages followed for one bucket query, on every backend. */
export const MAX_BUCKET_PAGES = 10;

/**
 * Minimal cursor-paginated response shape both SDKs return: a flag for more
 * pages and a resolver for the next one.
 */
export interface PagedResponse<P> {
  hasNext?: boolean;
  fetchNext?: () => Promise<P>;
}

/**
 * Follows `fetchNext` from the first page and concatenates what each page
 * yields, stopping at the backend's end or at `maxPages`.
 * @param first - First page, already fetched
 * @param itemsOf - Extracts the items of one page
 * @param maxPages - Safety cap on pages followed
 * @returns Items of every page visited, in page order
 */
export const collectPages = async <P extends PagedResponse<P>, T>(
  first: P,
  itemsOf: (page: P) => T[],
  maxPages: number = MAX_BUCKET_PAGES,
): Promise<T[]> => {
  const items: T[] = [];
  let page = first;
  for (let index = 0; index < maxPages; index += 1) {
    items.push(...itemsOf(page));
    if (!page.hasNext || !page.fetchNext) break;
    page = await page.fetchNext();
  }
  return items;
};

/**
 * Wraps a paginated SDK response as a provider raw page, newest sample first,
 * with `fetchNext` re-wrapped recursively so every page has the same shape.
 * @param response - SDK response of one page
 * @param samplesOf - Extracts the samples of one page
 * @returns Provider raw page
 */
export const toNewestFirstRawPage = <P extends PagedResponse<P>>(
  response: P,
  samplesOf: (page: P) => TimeSeriesSample[],
): TimeSeriesRawPage => {
  const samples = samplesOf(response).sort((a, b) => b.timestamp - a.timestamp);
  const next = response.fetchNext;
  const hasMore = !!response.hasNext && !!next;
  const page: TimeSeriesRawPage = { samples, hasMore };
  if (hasMore && next) {
    page.fetchNext = async () => toNewestFirstRawPage(await next(), samplesOf);
  }
  return page;
};
