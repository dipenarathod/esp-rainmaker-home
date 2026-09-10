/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TS_RANGE_UNIT_DAY,
  TS_RANGE_UNIT_HOUR,
  TS_RANGE_UNIT_MONTH,
  TS_RANGE_UNIT_WEEK,
  TS_WINDOW_DAILY,
  TS_WINDOW_HOURLY,
  TS_WINDOW_MONTHLY,
  TS_WINDOW_WEEKLY,
} from "@shared/utils/constants";
import type { TimeSeriesWindow } from "./types";

/** Calendar unit a chart range is aligned to and stepped by. */
export type TimeSeriesRangeUnit =
  | typeof TS_RANGE_UNIT_HOUR
  | typeof TS_RANGE_UNIT_DAY
  | typeof TS_RANGE_UNIT_WEEK
  | typeof TS_RANGE_UNIT_MONTH;

/** Milliseconds per calendar-free unit. */
export const MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

/** Both backends bucket weeks from Monday (`getDay() === 1`). */
export const WEEK_START_DAY = 1;

/** Calendar unit of one bucket for each window. */
const WINDOW_UNIT: Record<TimeSeriesWindow, TimeSeriesRangeUnit> = {
  [TS_WINDOW_HOURLY]: TS_RANGE_UNIT_HOUR,
  [TS_WINDOW_DAILY]: TS_RANGE_UNIT_DAY,
  [TS_WINDOW_WEEKLY]: TS_RANGE_UNIT_WEEK,
  [TS_WINDOW_MONTHLY]: TS_RANGE_UNIT_MONTH,
};

/**
 * Aligns a timestamp down to the start of its calendar unit in the phone's
 * local time zone.
 * @param ms - Unix ms
 * @param unit - Calendar unit to align to
 * @returns Unix ms of the unit start
 */
export const alignToUnitStart = (
  ms: number,
  unit: TimeSeriesRangeUnit,
): number => {
  const date = new Date(ms);
  switch (unit) {
    case TS_RANGE_UNIT_HOUR:
      date.setMinutes(0, 0, 0);
      return date.getTime();
    case TS_RANGE_UNIT_DAY:
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    case TS_RANGE_UNIT_WEEK: {
      const offset = (date.getDay() - WEEK_START_DAY + 7) % 7;
      date.setDate(date.getDate() - offset);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }
    case TS_RANGE_UNIT_MONTH:
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    default:
      return ms;
  }
};

/**
 * Adds whole calendar units with date arithmetic, so day/week/month steps
 * survive daylight-saving transitions and variable month lengths.
 * @param ms - Unix ms
 * @param unit - Calendar unit
 * @param count - Units to add (negative to subtract)
 * @returns Unix ms
 */
export const addUnits = (
  ms: number,
  unit: TimeSeriesRangeUnit,
  count: number,
): number => {
  const date = new Date(ms);
  switch (unit) {
    case TS_RANGE_UNIT_HOUR:
      return ms + count * MS.HOUR;
    case TS_RANGE_UNIT_DAY:
      date.setDate(date.getDate() + count);
      return date.getTime();
    case TS_RANGE_UNIT_WEEK:
      date.setDate(date.getDate() + count * 7);
      return date.getTime();
    case TS_RANGE_UNIT_MONTH:
      date.setMonth(date.getMonth() + count);
      return date.getTime();
    default:
      return ms;
  }
};

/**
 * Aligns a timestamp down to the start of its window bucket.
 * @param ms - Unix ms
 * @param window - Aggregation window
 * @returns Unix ms of the bucket start
 */
export const alignToWindowStart = (
  ms: number,
  window: TimeSeriesWindow,
): number => alignToUnitStart(ms, WINDOW_UNIT[window]);

/**
 * Exclusive end of the bucket that starts at `startMs`.
 * @param startMs - Bucket start (Unix ms)
 * @param window - Aggregation window
 * @returns Unix ms of the next bucket start
 */
export const windowEnd = (startMs: number, window: TimeSeriesWindow): number =>
  addUnits(startMs, WINDOW_UNIT[window], 1);

/**
 * Lists every bucket start of a window inside a half-open range.
 * @param startMs - Range start (Unix ms), aligned to the window
 * @param endMs - Range end, exclusive (Unix ms)
 * @param window - Aggregation window
 * @returns Ascending bucket starts
 */
export const enumerateWindowStarts = (
  startMs: number,
  endMs: number,
  window: TimeSeriesWindow,
): number[] => {
  const starts: number[] = [];
  let current = alignToWindowStart(startMs, window);
  while (current < endMs) {
    starts.push(current);
    current = windowEnd(current, window);
  }
  return starts;
};

/**
 * Number of buckets of a window inside a half-open range.
 * @param startMs - Range start (Unix ms)
 * @param endMs - Range end, exclusive (Unix ms)
 * @param window - Aggregation window
 * @returns Bucket count
 */
export const countWindowBuckets = (
  startMs: number,
  endMs: number,
  window: TimeSeriesWindow,
): number => enumerateWindowStarts(startMs, endMs, window).length;

/** Zero-pads a calendar component to two digits. */
const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Formats a timestamp as a phone-local `YYYY-MM-DD` calendar date, the bound
 * format the DynamoDB-backed aggregates endpoints take instead of epochs.
 * @param ms - Unix ms
 * @returns Calendar date
 */
export const formatLocalDate = (ms: number): string => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

/**
 * Formats a timestamp as a phone-local `YYYY-MM-DDTHH` calendar hour, the
 * bound format the aggregates endpoints take for the hourly window.
 * @param ms - Unix ms
 * @returns Calendar hour
 */
const formatLocalDateHour = (ms: number): string =>
  `${formatLocalDate(ms)}T${pad2(new Date(ms).getHours())}`;

/**
 * Formats an aggregates range bound for a window: hour-qualified for hourly
 * (a date-only hourly bound is read as hour 00 by classic), a plain date otherwise.
 * @param ms - Unix ms
 * @param window - Aggregation window
 * @returns Bound string
 */
export const formatWindowBound = (
  ms: number,
  window: TimeSeriesWindow,
): string =>
  window === TS_WINDOW_HOURLY ? formatLocalDateHour(ms) : formatLocalDate(ms);

/**
 * Parses a backend bucket date key (`YYYY-MM-DDTHH` hourly, `YYYY-MM-DD`
 * daily/weekly, `YYYY-MM` monthly) as a phone-local calendar instant. The key
 * names the calendar bucket the backend used in the device's time zone; the
 * chart places it on the same phone-local calendar grid it built the range
 * with, which keeps one bucket per grid slot even when zones differ.
 * @param key - Backend date key
 * @returns Unix ms of the bucket start, or undefined when unparseable
 */
export const parseWindowDateKey = (key: string): number | undefined => {
  const [datePart, hourPart] = key.split("T");
  const [year, month, day = 1] = datePart.split("-").map(Number);
  const hour = hourPart === undefined ? 0 : Number(hourPart);
  if (!year || !month || !day || !Number.isFinite(hour)) {
    return undefined;
  }
  return new Date(year, month - 1, day, hour).getTime();
};
