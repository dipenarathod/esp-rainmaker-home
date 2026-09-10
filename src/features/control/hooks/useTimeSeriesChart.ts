/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

import { useCDF } from "@shared/hooks/useCDF";
import { getTimeSeriesProvider } from "@shared/timeSeries";
import {
  DATA_TYPE_BOOL,
  TS_MODE_RAW,
  TS_STAT_COUNT,
  WRITE_PERMISSION,
} from "@shared/utils/constants";
import { getParamUnit } from "@shared/utils/paramUnits";

import type { ChartDataPoint, ChartState, ChartZoom } from "@src/types/global";
import {
  RAW_RENDER_SAMPLES,
  RAW_ZOOM_MIN_SPAN_MS,
  TS_EMPTY_KIND_ERROR,
  TS_EMPTY_KIND_NO_DATA,
  TS_EMPTY_KIND_NO_TIME_SERIES,
  TS_EMPTY_KIND_UNSUPPORTED,
  TS_FETCH_PLAN_RAW,
  TS_FETCH_PLAN_UNSUPPORTED,
  TS_NOTE_DOWNSAMPLED,
  TS_NOTE_RAW_TRUNCATED,
} from "@features/control/constants";
import {
  availableModes,
  describeRange,
  isWindowMode,
  rawXTicks,
  resolveXAxis,
  resolveXLabelKind,
} from "@features/control/utils/timeSeriesWindows";
import {
  bucketsAreCumulative,
  defaultStat,
  downsampleLTTB,
  projectBuckets,
  resolveStatOptions,
  samplesToPoints,
} from "@features/control/utils/timeSeriesBuckets";
import { createXLabelFormatter } from "@features/control/utils/timeSeriesHelper";
import { useChartView } from "./useChartView";
import { useTimeSeriesRange } from "./useTimeSeriesRange";

interface UseTimeSeriesChartParams {
  nodeId?: string;
  deviceName?: string;
  paramName?: string;
}

/** Content of a non-ready chart state. */
export interface ChartEmptyContent {
  /** Which state (see `TS_EMPTY_KIND_*`) */
  kind: string;
  /** Headline */
  title: string;
  /** Detail or error message */
  description?: string;
}

/** Footnote shown under the chart. */
export interface ChartNote {
  /** Note kind (i18n under `device.chart.notes.*`) */
  kind: string;
  /** Interpolation values for the note */
  values?: Record<string, number>;
}

/**
 * Business logic of the time series chart screen. Composes the user's
 * selection (`useChartView`) with the data of that selection
 * (`useTimeSeriesRange`) and shapes both for the screen: chart points, state,
 * empty-state copy, footnotes, labels and units.
 *
 * Switching the statistic never refetches on backends that pre-compute every
 * statistic (classic DynamoDB, Neo); on classic Timestream each statistic is
 * one request, cached once fetched.
 * @param params - Route params identifying the param
 * @returns Grouped chart state and actions for the screen
 */
export const useTimeSeriesChart = ({
  nodeId,
  deviceName,
  paramName,
}: UseTimeSeriesChartParams) => {
  const { t, i18n } = useTranslation();
  const { store } = useCDF();

  const node = store?.nodeStore?.nodesByIDMap?.[nodeId || ""];
  const device = node?.devices?.find((d) => d.name === deviceName);
  const param = device?.params?.find((p) => p.name === paramName) || null;
  const isWriteableParam = !!param?.properties?.includes(WRITE_PERMISSION);

  const provider = useMemo(() => getTimeSeriesProvider(param), [param]);
  const modes = useMemo(
    () => (provider ? availableModes(provider) : []),
    [provider],
  );
  const hasTimeSeries = !!provider && modes.length > 0;
  /** Identity of the charted param; store refreshes may recreate the object. */
  const paramKey = `${nodeId}|${deviceName}|${paramName}|${provider?.id}|${modes.join(",")}`;

  const view = useChartView({ modes, paramKey });
  const { mode, range, stat, setStat, selectMode } = view;
  const { fetched, loading, error } = useTimeSeriesRange({
    provider,
    mode,
    range,
    stat,
    paramKey,
  });

  const scrollViewRef = useRef<ScrollView>(null);

  /** Single-stat backends need a statistic before the first fetch. */
  useEffect(() => {
    if (!provider) return;
    setStat((current) =>
      current && provider.limits.stats.includes(current)
        ? current
        : defaultStat(provider.limits.stats, false),
    );
  }, [provider, setStat]);

  const isCumulative = useMemo(
    () => bucketsAreCumulative(fetched.buckets),
    [fetched.buckets],
  );
  const statOptions = useMemo(
    () => (provider ? resolveStatOptions(provider, isCumulative) : []),
    [provider, isCumulative],
  );

  /** Keeps the statistic valid for the buckets on screen; meters default to consumption. */
  useEffect(() => {
    if (statOptions.length === 0) return;
    setStat((current) =>
      current && statOptions.includes(current)
        ? current
        : defaultStat(statOptions, isCumulative),
    );
  }, [statOptions, isCumulative, setStat]);

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!mode || !range) return [];
    if (isWindowMode(mode)) {
      if (!stat) return [];
      return projectBuckets(fetched.buckets, stat, mode, range.start, range.end);
    }
    return samplesToPoints(downsampleLTTB(fetched.samples, RAW_RENDER_SAMPLES));
  }, [mode, range, stat, fetched]);

  const hasValues = useMemo(
    () => chartData.some((point) => point.value !== null),
    [chartData],
  );

  const chartState: ChartState = useMemo(() => {
    if (!hasTimeSeries) return "unsupported";
    if (loading) return "loading";
    if (error) return "error";
    if (fetched.plan === TS_FETCH_PLAN_UNSUPPORTED) return "unsupported";
    if (!hasValues) return "empty";
    return "ready";
  }, [hasTimeSeries, loading, error, fetched.plan, hasValues]);

  /** Tips appear after the first successful render and step aside for empty and error states. */
  const [hasRenderedChart, setHasRenderedChart] = useState(false);
  useEffect(() => {
    setHasRenderedChart(false);
  }, [paramKey]);
  useEffect(() => {
    if (chartState === "ready") setHasRenderedChart(true);
  }, [chartState]);
  const showTips =
    hasRenderedChart && (chartState === "ready" || chartState === "loading");

  /** Headline and detail for the non-ready chart states. */
  const emptyState: ChartEmptyContent | null = useMemo(() => {
    if (chartState === "ready" || chartState === "loading") return null;
    if (!hasTimeSeries) {
      return {
        kind: TS_EMPTY_KIND_NO_TIME_SERIES,
        title: t("device.chart.empty.noTimeSeriesTitle"),
        description: t("device.chart.empty.noTimeSeriesDescription"),
      };
    }
    if (chartState === "error") {
      return {
        kind: TS_EMPTY_KIND_ERROR,
        title: t("device.chart.empty.errorTitle"),
        description: error?.message,
      };
    }
    if (chartState === "unsupported") {
      return {
        kind: TS_EMPTY_KIND_UNSUPPORTED,
        title: t("device.chart.empty.unsupportedTitle"),
        description: t("device.chart.empty.unsupportedDescription"),
      };
    }
    return {
      kind: TS_EMPTY_KIND_NO_DATA,
      title: t("device.chart.empty.noDataTitle"),
      description: t("device.chart.empty.noDataDescription"),
    };
  }, [chartState, hasTimeSeries, error, t]);

  const notes: ChartNote[] = useMemo(() => {
    const list: ChartNote[] = [];
    if (chartState !== "ready") return list;
    if (fetched.plan === TS_FETCH_PLAN_RAW && fetched.truncated) {
      list.push({
        kind: TS_NOTE_RAW_TRUNCATED,
        values: { shown: fetched.samples.length },
      });
    }
    if (fetched.plan === TS_FETCH_PLAN_RAW && fetched.samples.length > RAW_RENDER_SAMPLES) {
      list.push({
        kind: TS_NOTE_DOWNSAMPLED,
        values: { total: fetched.samples.length, shown: RAW_RENDER_SAMPLES },
      });
    }
    return list;
  }, [chartState, fetched]);

  const rangeLabel = useMemo(() => {
    if (!range) return "";
    const description = describeRange(range, Date.now(), i18n.language, mode ?? undefined);
    return description.current
      ? t(`device.chart.range.current.${range.unit}`)
      : description.text;
  }, [range, mode, i18n.language, t]);

  /** Tooltip unit: counts are unitless, and a boolean plotted as 0/1 has no unit either. */
  const valueUnit =
    (mode && isWindowMode(mode) && stat === TS_STAT_COUNT) ||
    param?.dataType === DATA_TYPE_BOOL
      ? ""
      : getParamUnit(param);

  /** Every bucket owns an equal slot; labels are thinned so they never bunch up. */
  const xAxis = useMemo(
    () => (mode && range ? resolveXAxis(mode, range) : undefined),
    [mode, range],
  );

  /**
   * Raw samples can be zoomed into; the axis of the visible window follows
   * the same rules as a whole range (round clock times, weekdays over days).
   */
  const zoom: ChartZoom | undefined = useMemo(() => {
    if (mode !== TS_MODE_RAW || !range) return undefined;
    return {
      minSpanMs: RAW_ZOOM_MIN_SPAN_MS,
      axisFor: (start, end) => ({
        ticks: rawXTicks(start, end),
        formatLabel: createXLabelFormatter(
          resolveXLabelKind(mode, { ...range, start, end }),
          i18n.language,
        ),
      }),
    };
  }, [mode, range, i18n.language]);

  /** Axis labels follow what the buckets represent (hours, days, weeks, months). */
  const formatXLabel = useMemo(
    () =>
      mode && range
        ? createXLabelFormatter(resolveXLabelKind(mode, range), i18n.language)
        : undefined,
    [mode, range, i18n.language],
  );

  return {
    param,
    isWriteableParam,
    hasTimeSeries,

    /** What the user selected */
    selection: {
      modes,
      mode,
      presets: view.presets,
      range,
      rangeLabel,
      canNavigateNext: view.canNavigateNext,
      stat,
      statOptions,
      showStatDropdown: !!mode && isWindowMode(mode) && statOptions.length > 0,
      chartType: view.chartType,
      calendarVisible: view.calendarVisible,
    },

    /** What the chart shows */
    chart: {
      data: chartData,
      state: chartState,
      emptyState,
      notes,
      showTips,
      loading,
      valueUnit,
      formatXLabel,
      xAxis,
      zoom,
    },

    scrollViewRef,

    actions: {
      selectMode,
      selectPreset: view.selectPreset,
      previous: view.previous,
      next: view.next,
      selectCustomRange: view.selectCustomRange,
      selectStat: setStat,
      toggleCalendar: view.toggleCalendar,
      closeCalendar: view.closeCalendar,
      setChartType: view.setChartType,
      maxEndFor: view.maxEndFor,
    },
  };
};
