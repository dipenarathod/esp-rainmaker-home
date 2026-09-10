/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TS_X_LABEL_DAY_MONTH,
  TS_X_LABEL_MONTH,
  TS_X_LABEL_MONTH_YEAR,
  TS_X_LABEL_TIME,
  TS_X_LABEL_WEEKDAY,
} from "@features/control/constants";
import type { XLabelKind } from "@features/control/utils/timeSeriesWindows";

/**
 * Rendering helpers shared by the chart canvas and its tooltip. Data
 * shaping lives in `timeSeriesBuckets.ts`, range math in `timeSeriesWindows.ts`.
 */

/** Formats a Unix-ms timestamp for an axis label. */
type TimestampFormatter = (timestamp: number) => string;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Formats a timestamp for the chart tooltip (`15-Jan-25 2:30 pm`). Runs on
 * the UI thread as a Reanimated worklet, so it avoids `Intl`.
 * @param timestamp - Unix ms
 * @returns Formatted date-time
 */
export const formatTooltipDateTime = (timestamp: number): string => {
  "worklet";
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, "0");
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear().toString().slice(-2);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const suffix = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 || 12;
  return `${day}-${month}-${year} ${displayHours}:${minutes} ${suffix}`;
};

/**
 * Formats a value for the chart tooltip with precision that shrinks as the
 * magnitude grows. Runs as a Reanimated worklet.
 * @param value - Plotted value
 * @returns Formatted value, empty for NaN
 */
export const formatTooltipValue = (value: number): string => {
  "worklet";
  if (isNaN(value)) {
    return "";
  }
  if (Math.abs(value) >= 1000) {
    return value.toFixed(0);
  } else if (Math.abs(value) >= 1) {
    return value.toFixed(2);
  }
  return value.toFixed(4);
};

/**
 * Builds the X-axis label formatter for a resolved label kind.
 * @param kind - Label format (see `resolveXLabelKind`)
 * @param locale - BCP 47 locale for `toLocale*String`
 * @returns Formatter for axis labels
 */
export const createXLabelFormatter = (
  kind: XLabelKind,
  locale: string = "en-US",
): TimestampFormatter => {
  const time = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  const weekday = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(locale, { weekday: "short" });
  switch (kind) {
    case TS_X_LABEL_TIME:
      return time;
    case TS_X_LABEL_WEEKDAY:
      return weekday;
    case TS_X_LABEL_DAY_MONTH:
      return (timestamp) =>
        new Date(timestamp)
          .toLocaleDateString(locale, { day: "2-digit", month: "short" })
          .replace(",", "");
    case TS_X_LABEL_MONTH:
      return (timestamp) =>
        new Date(timestamp).toLocaleDateString(locale, { month: "short" });
    case TS_X_LABEL_MONTH_YEAR:
      return (timestamp) =>
        new Date(timestamp).toLocaleDateString(locale, {
          month: "short",
          year: "2-digit",
        });
    default:
      return weekday;
  }
};

/** Labels drawn along the Y axis. */
export const Y_AXIS_TICK_COUNT = 5;

/**
 * Spreads Y-axis ticks evenly from the smallest to the largest plotted
 * value, so the first label is the minimum and the last the maximum. A flat
 * series is padded around its value so the ticks still differ.
 * @param min - Smallest plotted value
 * @param max - Largest plotted value
 * @param count - Number of ticks
 * @returns Ascending tick values, empty when the bounds are not finite
 */
export const buildYAxisTicks = (
  min: number,
  max: number,
  count: number = Y_AXIS_TICK_COUNT,
): number[] => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count < 2) return [];
  let low = Math.min(min, max);
  let high = Math.max(min, max);
  if (high === low) {
    const pad = Math.max(Math.abs(low) * 0.1, 1);
    low -= pad;
    high += pad;
  }
  const step = (high - low) / (count - 1);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? high : low + index * step,
  );
};

/**
 * Builds the Y-axis label formatter: every label carries as many decimals
 * as the gap between ticks needs, so neighbouring labels never read alike.
 * @param ticks - Y-axis tick values
 * @returns Formatter for axis labels
 */
export const createYLabelFormatter = (ticks: number[]): ((value: number) => string) => {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
  const decimals = step >= 10 ? 0 : step >= 1 ? 1 : step >= 0.1 ? 2 : 3;
  return (value: number) => value.toFixed(decimals);
};

/**
 * Share of each bar's slot left empty on either side: bars grow with their
 * slot, but dense charts keep a thin gap so bars stay visible.
 * @param barCount - Slots across the chart
 * @returns Padding ratio in `[0, 1)`
 */
export const calculateBarChartInnerPadding = (barCount: number): number => {
  if (barCount >= 24) {
    return 0.4;
  } else if (barCount >= 12) {
    return 0.5;
  } else if (barCount >= 7) {
    return 0.6;
  }
  return 0.7;
};
