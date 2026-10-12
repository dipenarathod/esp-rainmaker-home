/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  ChartNoAxesColumn,
  CircleOff,
  Inbox,
  TriangleAlert,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";

// Components
import { Header } from "@shared/components";
import {
  AggregationDropdown,
  ChartCanvasSkeleton,
  ChartEmptyState,
  ChartHeader,
  ChartTips,
  ChartToggleSkeleton,
  ChartTypeToggle,
  DateRangeCalendarBottomSheet,
  GenericChart,
  RangePresets,
  TimeNavigator,
  WindowTabs,
} from "@features/control/components";

// Hooks
import { useTimeSeriesChart } from "@features/control/hooks";

// Constants
import {
  TS_EMPTY_KIND_ERROR,
  TS_EMPTY_KIND_UNSUPPORTED,
  TS_EMPTY_KIND_NO_TIME_SERIES,
} from "@features/control/constants";
import {
  CHART_CANVAS_HEIGHT,
  CHART_TOGGLE_SLOT_HEIGHT,
} from "@features/control/components/Charts/constants";

// Styles
import { tokens } from "@shared/theme/tokens";
import { globalStyles } from "@shared/theme/globalStyleSheet";

const EMPTY_STATE_ICON_SIZE = 48;

/**
 * Picks the icon of a non-ready chart state.
 * @param kind - Empty state kind (`TS_EMPTY_KIND_*`)
 * @returns Icon element
 */
const emptyStateIcon = (kind: string): ReactNode => {
  const props = { size: EMPTY_STATE_ICON_SIZE, color: tokens.colors.primary };
  switch (kind) {
    case TS_EMPTY_KIND_NO_TIME_SERIES:
      return <ChartNoAxesColumn {...props} />;
    case TS_EMPTY_KIND_UNSUPPORTED:
      return <CircleOff {...props} />;
    case TS_EMPTY_KIND_ERROR:
      return <TriangleAlert {...props} />;
    default:
      return <Inbox {...props} />;
  }
};

/**
 * Time series chart screen. Layout, top to bottom: current value editor
 * (writable params), window tabs, range navigator (tap the label for a custom
 * range), the preset row (quick presets on the left, statistic dropdown on
 * the right), the chart section, footnotes and usage tips. The chart section
 * is two fixed-height slots (canvas, type toggle) so loading skeletons, the
 * chart and the empty states never shift the layout. All backend differences
 * are absorbed by the param's time series provider; this screen only composes.
 */
const Chart = () => {
  const { t } = useTranslation();
  const { nodeId, deviceName, paramName } = useLocalSearchParams<{
    nodeId?: string;
    deviceName?: string;
    paramName?: string;
  }>();

  const { param, isWriteableParam, hasTimeSeries, selection, chart, scrollViewRef, actions } =
    useTimeSeriesChart({ nodeId, deviceName, paramName });
  const { modes, mode, presets, range, rangeLabel, canNavigateNext, stat, statOptions, showStatDropdown, chartType, calendarVisible } =
    selection;
  const { data: chartData, state: chartState, emptyState, notes, showTips, loading, valueUnit, formatXLabel, xAxis, zoom } = chart;

  const header = (
    <Header
      label={t("device.chart.title")}
      showBack={true}
      rightSlot={<View style={globalStyles.headerSpacer} />}
    />
  );

  if (!hasTimeSeries && emptyState) {
    return (
      <>
        {header}
        <ChartEmptyState
          fullScreen
          icon={emptyStateIcon(emptyState.kind)}
          title={emptyState.title}
          description={emptyState.description}
        />
      </>
    );
  }

  const isLoading = chartState === "loading";
  const isReady = chartState === "ready" && !!range;

  /** Canvas slot: skeleton, chart, or empty state. */
  const renderCanvasSlot = () => {
    if (isLoading) return <ChartCanvasSkeleton />;
    if (isReady && range && formatXLabel && xAxis) {
      return (
        <GenericChart
          key={`genericChart-${mode}-${range.start}-${range.end}-${stat}-${chartType}`}
          data={chartData}
          height={CHART_CANVAS_HEIGHT}
          type={chartType}
          unit={valueUnit}
          formatXLabel={formatXLabel}
          xAxis={xAxis}
          zoom={zoom}
        />
      );
    }
    if (emptyState) {
      return (
        <ChartEmptyState
          icon={emptyStateIcon(emptyState.kind)}
          title={emptyState.title}
          description={emptyState.description}
        />
      );
    }
    return null;
  };

  /** Type toggle slot: skeleton, toggle, or empty spacer. */
  const renderToggleSlot = () => {
    if (isLoading) return <ChartToggleSkeleton />;
    if (isReady) {
      return (
        <ChartTypeToggle chartType={chartType} loading={loading} onChange={actions.setChartType} />
      );
    }
    return null;
  };

  return (
    <>
      {header}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {!loading && isWriteableParam && (
          <ChartHeader
            label={paramName || t("device.chart.value")}
            param={param}
            isWriteable={isWriteableParam}
            disabled={loading}
          />
        )}

        <WindowTabs
          modes={modes}
          selected={mode}
          loading={loading}
          onSelect={actions.selectMode}
        />

        {range && (
          <View style={globalStyles.timeNavigatorContainer}>
            <TimeNavigator
              label={rangeLabel}
              loading={loading}
              onPrevious={actions.previous}
              onNext={actions.next}
              onPressLabel={actions.toggleCalendar}
              canNavigateNext={canNavigateNext}
            />
          </View>
        )}

        {(presets.length > 0 || showStatDropdown) && (
          <View style={globalStyles.rangePresetRow}>
            <RangePresets
              presets={presets}
              selectedKey={range?.presetKey}
              loading={loading}
              onSelect={actions.selectPreset}
            />
            {showStatDropdown && stat && (
              <AggregationDropdown
                stat={stat}
                options={statOptions}
                loading={loading}
                onSelect={actions.selectStat}
              />
            )}
          </View>
        )}

        <View style={globalStyles.chartSection}>
          <View style={[globalStyles.chartCanvasSlot, { height: CHART_CANVAS_HEIGHT }]}>
            {renderCanvasSlot()}
          </View>

          {notes.map((note) => (
            <Text key={note.kind} style={globalStyles.chartFootnoteText}>
              {t(`device.chart.notes.${note.kind}`, note.values)}
            </Text>
          ))}

          <View style={[globalStyles.chartToggleSlot, { height: CHART_TOGGLE_SLOT_HEIGHT }]}>
            {renderToggleSlot()}
          </View>
        </View>

        {showTips && <ChartTips showZoomTip={!!zoom} />}

        {mode && (
          <DateRangeCalendarBottomSheet
            visible={calendarVisible}
            onClose={actions.closeCalendar}
            onSelect={actions.selectCustomRange}
            range={range}
            maxEndFor={actions.maxEndFor}
          />
        )}
      </ScrollView>
    </>
  );
};

export default Chart;
