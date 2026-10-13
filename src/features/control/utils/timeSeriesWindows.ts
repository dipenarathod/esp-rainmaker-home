/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  TS_MODE_RAW,
  TS_RANGE_UNIT_DAY,
  TS_RANGE_UNIT_HOUR,
  TS_RANGE_UNIT_MONTH,
  TS_RANGE_UNIT_WEEK,
  TS_WINDOW_DAILY,
  TS_WINDOW_HOURLY,
  TS_WINDOW_MONTHLY,
  TS_WINDOW_WEEKLY,
} from "@shared/utils/constants";
import {
  MS,
  addUnits,
  alignToUnitStart,
  countWindowBuckets,
  enumerateWindowStarts,
  type TimeSeriesProvider,
  type TimeSeriesRangeUnit,
  type TimeSeriesWindow,
} from "@shared/timeSeries";

import type {
  ChartMode,
  ChartRange,
  ChartXAxis,
  RangePreset,
} from "@src/types/global";
import {
  TS_FETCH_PLAN_RAW,
  TS_FETCH_PLAN_SERVER,
  TS_FETCH_PLAN_UNSUPPORTED,
  TS_X_LABEL_DAY_MONTH,
  TS_X_LABEL_MONTH,
  TS_X_LABEL_MONTH_YEAR,
  TS_X_LABEL_TIME,
  TS_X_LABEL_WEEKDAY,
  TS_PRESET_1D,
  TS_PRESET_1H,
  TS_PRESET_1Y,
  TS_PRESET_24H,
  TS_PRESET_4W,
  TS_PRESET_6H,
  TS_PRESET_7D,
} from "@features/control/constants";

/**
 * Per-tab chart constraints. Each tab (one aggregation window, or raw
 * samples) owns its presets, the calendar unit custom ranges align to, and a
 * cap on how many units a range may span. Each window tab shows one span of
 * buckets (a day of hours, a week of days, four weeks, a year of months) so
 * bars stay legible on a phone; the navigator steps through history one span
 * at a time. The raw tab keeps its hour presets.
 */
interface ChartModeConfig {
  /** Quick range presets shown under the tab, newest range first. */
  presets: readonly RangePreset[];
  /** Preset selected when the tab is opened. */
  defaultPresetKey: string;
  /** Calendar unit a custom (calendar-picked) range is aligned to. */
  customUnit: TimeSeriesRangeUnit;
  /** Longest custom range, in `customUnit`s. */
  maxCustomUnits: number;
}

/** Tab order in the chart. */
const CHART_MODES: readonly ChartMode[] = [
  TS_WINDOW_HOURLY,
  TS_WINDOW_DAILY,
  TS_WINDOW_WEEKLY,
  TS_WINDOW_MONTHLY,
  TS_MODE_RAW,
];

export const CHART_MODE_CONFIG: Record<ChartMode, ChartModeConfig> = {
  [TS_WINDOW_HOURLY]: {
    presets: [{ key: TS_PRESET_1D, unit: TS_RANGE_UNIT_DAY, count: 1 }],
    defaultPresetKey: TS_PRESET_1D,
    customUnit: TS_RANGE_UNIT_DAY,
    maxCustomUnits: 1, // 24 hourly buckets
  },
  [TS_WINDOW_DAILY]: {
    presets: [{ key: TS_PRESET_7D, unit: TS_RANGE_UNIT_DAY, count: 7 }],
    defaultPresetKey: TS_PRESET_7D,
    customUnit: TS_RANGE_UNIT_DAY,
    maxCustomUnits: 7, // a week of daily buckets
  },
  [TS_WINDOW_WEEKLY]: {
    // Week-aligned rather than a calendar month, so no weekly bucket
    // straddles the range edges and every backend returns whole weeks.
    presets: [{ key: TS_PRESET_4W, unit: TS_RANGE_UNIT_WEEK, count: 4 }],
    defaultPresetKey: TS_PRESET_4W,
    customUnit: TS_RANGE_UNIT_WEEK,
    maxCustomUnits: 5, // a calendar month touches at most five weeks
  },
  [TS_WINDOW_MONTHLY]: {
    presets: [{ key: TS_PRESET_1Y, unit: TS_RANGE_UNIT_MONTH, count: 12 }],
    defaultPresetKey: TS_PRESET_1Y,
    customUnit: TS_RANGE_UNIT_MONTH,
    maxCustomUnits: 12, // a year of monthly buckets
  },
  [TS_MODE_RAW]: {
    presets: [
      { key: TS_PRESET_1H, unit: TS_RANGE_UNIT_HOUR, count: 1 },
      { key: TS_PRESET_6H, unit: TS_RANGE_UNIT_HOUR, count: 6 },
      { key: TS_PRESET_24H, unit: TS_RANGE_UNIT_HOUR, count: 24 },
    ],
    defaultPresetKey: TS_PRESET_1H,
    customUnit: TS_RANGE_UNIT_DAY,
    maxCustomUnits: 7,
  },
};

/** Whether a tab is an aggregation window (as opposed to raw samples). */
export const isWindowMode = (mode: ChartMode): mode is TimeSeriesWindow =>
  mode !== TS_MODE_RAW;

/**
 * Builds the range of a preset ending at the current unit boundary, so the
 * last bucket is the one in progress (e.g. 1D hourly = today, 00:00 → 24:00).
 * @param preset - Preset to materialize
 * @param now - Reference time (Unix ms)
 * @returns Half-open range
 */
export const presetRange = (preset: RangePreset, now: number): ChartRange => {
  const end = addUnits(alignToUnitStart(now, preset.unit), preset.unit, 1);
  return {
    start: addUnits(end, preset.unit, -preset.count),
    end,
    unit: preset.unit,
    units: preset.count,
    presetKey: preset.key,
  };
};

/**
 * Counts whole calendar units between two aligned instants.
 * @param start - Range start (Unix ms)
 * @param end - Range end (Unix ms)
 * @param unit - Calendar unit
 * @returns Unit count (at least 1)
 */
const countUnits = (
  start: number,
  end: number,
  unit: TimeSeriesRangeUnit,
): number => {
  let count = 0;
  let cursor = start;
  while (cursor < end) {
    cursor = addUnits(cursor, unit, 1);
    count += 1;
  }
  return Math.max(count, 1);
};

/**
 * Builds a custom range from two calendar days picked by the user, aligned to
 * the tab's custom unit and clamped to the tab's maximum span.
 * @param mode - Active tab
 * @param startDayMs - Any instant in the first selected day
 * @param endDayMs - Any instant in the last selected day (inclusive)
 * @returns Half-open range covering whole units
 */
export const customRange = (
  mode: ChartMode,
  startDayMs: number,
  endDayMs: number,
): ChartRange => {
  const { customUnit, maxCustomUnits } = CHART_MODE_CONFIG[mode];
  const start = alignToUnitStart(Math.min(startDayMs, endDayMs), customUnit);
  let end = addUnits(
    alignToUnitStart(Math.max(startDayMs, endDayMs), customUnit),
    customUnit,
    1,
  );
  let units = countUnits(start, end, customUnit);
  if (units > maxCustomUnits) {
    units = maxCustomUnits;
    end = addUnits(start, customUnit, units);
  }
  return { start, end, unit: customUnit, units };
};

/**
 * Longest custom range of a tab in milliseconds (approximate for calendar
 * units), used to disable calendar days beyond reach.
 * @param mode - Active tab
 * @param fromMs - Range start the limit is measured from
 * @returns Latest selectable end instant (Unix ms)
 */
export const maxCustomEnd = (mode: ChartMode, fromMs: number): number => {
  const { customUnit, maxCustomUnits } = CHART_MODE_CONFIG[mode];
  return addUnits(alignToUnitStart(fromMs, customUnit), customUnit, maxCustomUnits);
};

/**
 * Moves a range one span backwards or forwards, keeping its unit and length.
 * @param range - Current range
 * @param direction - `-1` for the previous span, `1` for the next
 * @returns Shifted range (no longer tied to a preset when custom)
 */
export const shiftRange = (range: ChartRange, direction: 1 | -1): ChartRange => ({
  start: addUnits(range.start, range.unit, direction * range.units),
  end: addUnits(range.end, range.unit, direction * range.units),
  unit: range.unit,
  units: range.units,
});

/**
 * Whether a later span exists: the current range must already end in the past.
 * @param range - Current range
 * @param now - Reference time (Unix ms)
 * @returns True when the next span contains data time
 */
export const canShiftForward = (range: ChartRange, now: number): boolean =>
  range.end <= now;

/**
 * Tabs the backend can serve for this parameter: its aggregation windows,
 * plus raw when samples can be read.
 * @param provider - Provider of the param
 * @returns Tabs in display order
 */
export const availableModes = (provider: TimeSeriesProvider): ChartMode[] =>
  CHART_MODES.filter((mode) =>
    isWindowMode(mode)
      ? provider.limits.windows.includes(mode)
      : provider.limits.supportsRaw,
  );

/** How a range will be fetched, see {@link resolveFetchPlan}. */
export type TimeSeriesFetchPlan =
  | typeof TS_FETCH_PLAN_SERVER
  | typeof TS_FETCH_PLAN_RAW
  | typeof TS_FETCH_PLAN_UNSUPPORTED;

/**
 * Decides how to fetch a range. Window tabs read server buckets (providers
 * split a range into as many requests as their backend's span cap needs);
 * the raw tab reads samples as long as the backend's raw span cap allows.
 * @param mode - Active tab
 * @param range - Range to fetch
 * @param provider - Provider of the param
 * @returns Fetch plan
 */
export const resolveFetchPlan = (
  mode: ChartMode,
  range: ChartRange,
  provider: TimeSeriesProvider,
): TimeSeriesFetchPlan => {
  const { limits } = provider;
  if (isWindowMode(mode)) {
    return limits.windows.includes(mode)
      ? TS_FETCH_PLAN_SERVER
      : TS_FETCH_PLAN_UNSUPPORTED;
  }
  const span = range.end - range.start;
  const rawFits =
    limits.supportsRaw &&
    (limits.maxRawSpanMs === undefined || span <= limits.maxRawSpanMs);
  return rawFits ? TS_FETCH_PLAN_RAW : TS_FETCH_PLAN_UNSUPPORTED;
};

/** X-axis label format, see `TS_X_LABEL_*`. */
export type XLabelKind =
  | typeof TS_X_LABEL_TIME
  | typeof TS_X_LABEL_WEEKDAY
  | typeof TS_X_LABEL_DAY_MONTH
  | typeof TS_X_LABEL_MONTH
  | typeof TS_X_LABEL_MONTH_YEAR;

const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

/**
 * Picks the X-axis label format from what the buckets represent, not from the
 * pixel span: hourly buckets read as clock times (weekdays once the range
 * spans days), daily buckets as weekdays or dates, weekly buckets as their
 * start date, monthly buckets as months (with the year beyond one).
 * @param mode - Active tab
 * @param range - Visible range
 * @returns Label format
 */
export const resolveXLabelKind = (mode: ChartMode, range: ChartRange): XLabelKind => {
  const spanDays = (range.end - range.start) / MS.DAY;
  switch (mode) {
    case TS_WINDOW_HOURLY:
    case TS_MODE_RAW:
      // Over several days the five tick labels land on different days, so
      // the weekday alone reads cleaner than weekday plus clock time.
      return spanDays <= 1 ? TS_X_LABEL_TIME : TS_X_LABEL_WEEKDAY;
    case TS_WINDOW_DAILY:
      return spanDays <= DAYS_PER_WEEK ? TS_X_LABEL_WEEKDAY : TS_X_LABEL_DAY_MONTH;
    case TS_WINDOW_WEEKLY:
      return TS_X_LABEL_DAY_MONTH;
    case TS_WINDOW_MONTHLY:
      return countWindowBuckets(range.start, range.end, TS_WINDOW_MONTHLY) <= MONTHS_PER_YEAR
        ? TS_X_LABEL_MONTH
        : TS_X_LABEL_MONTH_YEAR;
    default:
      return TS_X_LABEL_DAY_MONTH;
  }
};

/** Most labels drawn along the X axis; more than this bunches up on a phone. */
const MAX_X_TICKS = 7;

/** Label steps tried for a raw range inside one day, shortest first. */
const RAW_TICK_STEPS_MS: readonly number[] = [
  MS.MINUTE,
  2 * MS.MINUTE,
  5 * MS.MINUTE,
  10 * MS.MINUTE,
  15 * MS.MINUTE,
  30 * MS.MINUTE,
  MS.HOUR,
  2 * MS.HOUR,
  3 * MS.HOUR,
  4 * MS.HOUR,
  6 * MS.HOUR,
  12 * MS.HOUR,
];

/**
 * Lays out the X axis of a window tab: every bucket owns an equal slot with
 * its bar centred in it, and a label sits on every `step`-th bucket so no
 * more than {@link MAX_X_TICKS} are drawn (a day of hours → every 4th hour,
 * a week of days → every day, a year of months → every 2nd month).
 * @param window - Aggregation window
 * @param range - Visible range
 * @returns Domain and label positions
 */
const windowXAxis = (window: TimeSeriesWindow, range: ChartRange): ChartXAxis => {
  const starts = enumerateWindowStarts(range.start, range.end, window);
  const slotMs = (range.end - range.start) / Math.max(starts.length, 1);
  const step = Math.max(1, Math.ceil(starts.length / MAX_X_TICKS));
  return {
    domain: [range.start - slotMs / 2, range.end - slotMs / 2],
    ticks: starts.filter((_, index) => index % step === 0),
  };
};

/**
 * Label positions of a raw window. Inside a day the labels sit on round
 * clock times counted from local midnight (every 10 minutes for an hour,
 * every 4 hours for a day); the window end itself is not labelled, like the
 * last bucket edge of the window tabs. Over several days they sit on day
 * starts so weekday labels never repeat. Used for the whole range and for
 * any window the user zooms into.
 * @param start - Window start (Unix ms)
 * @param end - Window end, exclusive (Unix ms)
 * @returns Ascending label timestamps
 */
export const rawXTicks = (start: number, end: number): number[] => {
  const span = end - start;
  const ticks: number[] = [];
  if (span <= MS.DAY) {
    const step =
      RAW_TICK_STEPS_MS.find((candidate) => span / candidate <= MAX_X_TICKS - 1) ??
      MS.DAY;
    const midnight = alignToUnitStart(start, TS_RANGE_UNIT_DAY);
    const first = midnight + Math.ceil((start - midnight) / step) * step;
    for (let tick = first; tick < end; tick += step) ticks.push(tick);
  } else {
    const stepDays = Math.max(1, Math.ceil(span / MS.DAY / MAX_X_TICKS));
    let tick = alignToUnitStart(start, TS_RANGE_UNIT_DAY);
    if (tick < start) tick = addUnits(tick, TS_RANGE_UNIT_DAY, 1);
    for (; tick < end; tick = addUnits(tick, TS_RANGE_UNIT_DAY, stepDays)) {
      ticks.push(tick);
    }
  }
  return ticks;
};

/**
 * Lays out the X axis of the raw tab over the whole range.
 * @param range - Visible range
 * @returns Domain and label positions
 */
const rawXAxis = (range: ChartRange): ChartXAxis => ({
  domain: [range.start, range.end],
  ticks: rawXTicks(range.start, range.end),
});

/**
 * Lays out the X axis for a tab and range: the plotted domain and the
 * timestamps that get a label, spread evenly so the axis never clutters.
 * @param mode - Active tab
 * @param range - Visible range
 * @returns Domain and label positions
 */
export const resolveXAxis = (mode: ChartMode, range: ChartRange): ChartXAxis =>
  isWindowMode(mode) ? windowXAxis(mode, range) : rawXAxis(range);

/** Structured description of a range for the navigator label. */
interface RangeDescription {
  /** True when the range is the single current unit (today, this week, …). */
  current: boolean;
  /** Formatted start–end text (or single date/month for one-unit ranges). */
  text: string;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};
const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
/** Hour ranges: 24-hour clock like the axis labels, compact enough for the navigator. */
const CLOCK_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};
/** Day of an hour range; the year is added only when it is not the current one. */
const SHORT_DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const SHORT_DATE_YEAR_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

/**
 * Describes a range for display: one-unit ranges collapse to a single date,
 * month or hour span; multi-unit ranges show inclusive start and end. On the
 * raw tab, hour ranges use a compact day + 24-hour clock form so the
 * navigator never has to shrink its text; the window tabs keep full dates.
 * @param range - Range to describe
 * @param now - Reference time (Unix ms)
 * @param locale - BCP 47 locale
 * @param mode - Active tab; only the raw tab gets the compact hour form
 * @returns Description
 */
export const describeRange = (
  range: ChartRange,
  now: number,
  locale?: string,
  mode?: ChartMode,
): RangeDescription => {
  const start = new Date(range.start);
  const lastInstant = new Date(range.end - 1);
  const current =
    range.units === 1 && range.start <= now && now < range.end;
  if (mode === TS_MODE_RAW && range.unit === TS_RANGE_UNIT_HOUR) {
    // Keep the navigator label short: "Sep 24, 13:00 – 19:00" within a day,
    // "Sep 23, 13:00 – Sep 24, 13:00" across days; the year only when it differs from today's.
    const end = new Date(range.end);
    const dateFormat =
      start.getFullYear() === new Date(now).getFullYear()
        ? SHORT_DATE_FORMAT
        : SHORT_DATE_YEAR_FORMAT;
    const sameDay = start.toDateString() === lastInstant.toDateString();
    const startText = `${start.toLocaleDateString(locale, dateFormat)}, ${start.toLocaleTimeString(locale, CLOCK_FORMAT)}`;
    const endText = sameDay
      ? end.toLocaleTimeString(locale, CLOCK_FORMAT)
      : `${lastInstant.toLocaleDateString(locale, dateFormat)}, ${end.toLocaleTimeString(locale, CLOCK_FORMAT)}`;
    return { current, text: `${startText} – ${endText}` };
  }
  if (range.unit === TS_RANGE_UNIT_MONTH && range.units === 1) {
    return { current, text: start.toLocaleDateString(locale, MONTH_FORMAT) };
  }
  if (range.unit === TS_RANGE_UNIT_DAY && range.units === 1) {
    return { current, text: start.toLocaleDateString(locale, DATE_FORMAT) };
  }
  return {
    current,
    text: `${start.toLocaleDateString(locale, DATE_FORMAT)} – ${lastInstant.toLocaleDateString(locale, DATE_FORMAT)}`,
  };
};
