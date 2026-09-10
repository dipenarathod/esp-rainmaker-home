/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from "react";

import type { TimeSeriesStat } from "@shared/timeSeries";
import {
  CHART_TYPE_BAR,
  CHART_TYPE_LINE,
  TS_WINDOW_HOURLY,
} from "@shared/utils/constants";

import type {
  ChartMode,
  ChartRange,
  GenericChartProps,
  RangePreset,
} from "@src/types/global";
import {
  CHART_MODE_CONFIG,
  canShiftForward,
  customRange,
  isWindowMode,
  maxCustomEnd,
  presetRange,
  shiftRange,
} from "@features/control/utils/timeSeriesWindows";

/** The tab and range shown together; changed atomically so a fetch never mixes the two. */
interface ChartView {
  mode: ChartMode;
  range: ChartRange;
}

/**
 * Opens a tab on its default preset.
 * @param mode - Tab to open
 * @returns View of that tab
 */
const openMode = (mode: ChartMode): ChartView => {
  const config = CHART_MODE_CONFIG[mode];
  const preset =
    config.presets.find((p) => p.key === config.defaultPresetKey) ??
    config.presets[0];
  return { mode, range: presetRange(preset, Date.now()) };
};

/**
 * Chart type a tab opens with: bars for buckets, a line for raw samples.
 * @param mode - Tab
 * @returns Chart type
 */
const defaultChartType = (mode: ChartMode): GenericChartProps["type"] =>
  isWindowMode(mode) ? CHART_TYPE_BAR : CHART_TYPE_LINE;

interface UseChartViewParams {
  /** Tabs the backend offers for the param, in display order */
  modes: readonly ChartMode[];
  /** Changes whenever the charted param (or its capabilities) changes */
  paramKey: string;
}

/**
 * User selection of the chart: tab, range, statistic and chart type, plus
 * the handlers that move them. Tab and range live in one state object so no
 * render can pair a tab with another tab's range. A new param opens the
 * first available tab (hourly when offered) on its default preset.
 * @param params - Available tabs and the param identity
 * @returns Current selection and handlers
 */
export const useChartView = ({ modes, paramKey }: UseChartViewParams) => {
  const [view, setView] = useState<ChartView | null>(null);
  const [stat, setStat] = useState<TimeSeriesStat | null>(null);
  const [chartType, setChartType] =
    useState<GenericChartProps["type"]>(CHART_TYPE_BAR);
  const [calendarVisible, setCalendarVisible] = useState(false);

  useEffect(() => {
    if (modes.length === 0) {
      setView(null);
      return;
    }
    const first = modes.includes(TS_WINDOW_HOURLY) ? TS_WINDOW_HOURLY : modes[0];
    setView(openMode(first));
    setChartType(defaultChartType(first));
    // `modes` is folded into paramKey; re-running on array identity alone would reset the chart on every store refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  const mode = view?.mode ?? null;
  const range = view?.range ?? null;
  const presets: readonly RangePreset[] = mode ? CHART_MODE_CONFIG[mode].presets : [];

  const selectMode = useCallback((next: ChartMode) => {
    setView((current) => (current?.mode === next ? current : openMode(next)));
    setChartType(defaultChartType(next));
  }, []);

  const selectPreset = useCallback((preset: RangePreset) => {
    setView((current) =>
      current ? { ...current, range: presetRange(preset, Date.now()) } : current,
    );
  }, []);

  const previous = useCallback(() => {
    setView((current) =>
      current ? { ...current, range: shiftRange(current.range, -1) } : current,
    );
  }, []);

  const next = useCallback(() => {
    setView((current) =>
      current && canShiftForward(current.range, Date.now())
        ? { ...current, range: shiftRange(current.range, 1) }
        : current,
    );
  }, []);

  const selectCustomRange = useCallback((startDayMs: number, endDayMs: number) => {
    setView((current) =>
      current
        ? { ...current, range: customRange(current.mode, startDayMs, endDayMs) }
        : current,
    );
    setCalendarVisible(false);
  }, []);

  const toggleCalendar = useCallback(() => {
    setCalendarVisible((visible) => !visible);
  }, []);

  const closeCalendar = useCallback(() => {
    setCalendarVisible(false);
  }, []);

  const maxEndFor = useCallback(
    (startDayMs: number) => (mode ? maxCustomEnd(mode, startDayMs) : startDayMs),
    [mode],
  );

  return {
    mode,
    range,
    presets,
    canNavigateNext: range ? canShiftForward(range, Date.now()) : false,
    stat,
    setStat,
    chartType,
    setChartType,
    calendarVisible,
    selectMode,
    selectPreset,
    previous,
    next,
    selectCustomRange,
    toggleCalendar,
    closeCalendar,
    maxEndFor,
  };
};
