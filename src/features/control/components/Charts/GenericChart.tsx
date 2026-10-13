/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useFont, DashPathEffect } from "@shopify/react-native-skia";
import {
  CartesianChart,
  Line,
  Scatter,
  Bar,
  useChartPressState,
  type CartesianChartRenderArg,
  type ChartBounds,
} from "victory-native";

// Assets
// @ts-ignore
import inter from "@assets/fonts/inter-medium.ttf";

// Utils
import {
  buildYAxisTicks,
  calculateBarChartInnerPadding,
  createYLabelFormatter,
} from "@features/control/utils/timeSeriesHelper";

import { CHART_TYPE_BAR, CHART_TYPE_LINE } from "@shared/utils/constants";
import {
  ZOOM_DOUBLE_TAP_FACTOR,
  ZOOM_PAN_ACTIVE_OFFSET_X,
  ZOOM_PAN_FAIL_OFFSET_Y,
  ZOOM_PRESS_DELAY_MS,
} from "./constants";

// Styles
import { tokens } from "@shared/theme/tokens";
import { globalStyles } from "@shared/theme/globalStyleSheet";

// Types
import type { GenericChartProps, NormalizedChartDataPoint } from "@src/types/global";

// Local components
import ActiveValueIndicator from "./ActiveValueIndicator";
import { ChartValueDisplayToolTip } from "./ChartValueDisplayToolTip";

const AXIS_FONT_SIZE = 12;
const LINE_STROKE_WIDTH = 1;
const POINT_RADIUS = 2;
/** Pixels kept free around the plotted domain on each side. */
const DOMAIN_PADDING = { left: 4, right: 4, top: 10, bottom: 10 };
const GRID_DASH = <DashPathEffect intervals={[4, 4]} />;

/** A visible X window, `[start, end]` in Unix ms. */
type XWindow = [number, number];

/**
 * GenericChart - renders time series points as bars or as a line. The caller
 * lays out the X axis from the visible range (every bucket owns an equal
 * slot and labels are thinned so they never bunch up); the Y axis spreads
 * five labels evenly from the smallest to the largest plotted value. Press
 * and hold shows the value under the finger.
 *
 * With `zoom` set, pinching, dragging and double-tapping move a visible
 * window over the range. The chart re-lays out that window (no stretched
 * marks) and both axes follow it: X labels come from the caller for the
 * window, Y labels from the values inside it.
 * @param data - Points with timestamp and value (`null` for an empty slot)
 * @param height - Canvas height
 * @param type - Chart type: "line" or "bar" (defaults to "line")
 * @param unit - Unit appended to the tooltip value
 * @param formatXLabel - Axis label formatter chosen by the caller
 * @param xAxis - Domain and label positions chosen by the caller
 * @param zoom - Zoom limits and per-window axis layout; omit for a fixed chart
 * @returns Rendered chart component
 */
export default function GenericChart({
  data,
  height,
  type = CHART_TYPE_LINE,
  unit,
  formatXLabel,
  xAxis,
  zoom,
}: GenericChartProps) {
  // Chart press state for tooltip
  const { state: pressState, isActive } = useChartPressState({
    x: 0,
    y: { value: 0 },
  });

  // Indicator color for ActiveValueIndicator
  const indicatorColor = useDerivedValue(() => tokens.colors.primary);

  // Load font for chart labels
  const font = useFont(inter, AXIS_FONT_SIZE);

  /**
   * Normalized chart data with a numeric timestamp. Missing values stay
   * `null` so the renderer leaves their slot empty (no bar, a gap in the
   * line) and a press over them reports no value instead of a fake zero.
   * @returns Array of normalized data points
   */
  const chartData = useMemo(() => {
    return data.map((item) => ({
      timestamp: item.timestamp ?? 0,
      value: item.value ?? null,
    })) as NormalizedChartDataPoint[];
  }, [data]);

  // ---------------------------------------------------------------------------
  // Visible window. Gestures move it on the UI thread; React mirrors it so the
  // chart re-lays out. Without `zoom` it is the whole domain and never moves.
  // ---------------------------------------------------------------------------
  const [view, setView] = useState<XWindow>(xAxis.domain);
  const viewValue = useSharedValue<XWindow>(xAxis.domain);
  const fullValue = useSharedValue<XWindow>(xAxis.domain);
  /** Plot area in canvas pixels, for mapping finger positions to time. */
  const plotValue = useSharedValue({ left: 0, width: 1 });
  /** Window and focal time captured when a pinch begins. */
  const pinchBase = useSharedValue({ start: 0, end: 0, focalT: 0 });

  useAnimatedReaction(
    () => viewValue.value,
    (next, previous) => {
      if (!previous || next[0] !== previous[0] || next[1] !== previous[1]) {
        runOnJS(setView)(next);
      }
    },
  );

  const handleBoundsChange = useCallback(
    (bounds: ChartBounds) => {
      plotValue.value = {
        left: bounds.left,
        width: Math.max(bounds.right - bounds.left, 1),
      };
    },
    [plotValue],
  );

  /** Pinch to zoom around the fingers, drag to pan, double-tap to zoom in or reset. */
  const zoomGestures = useMemo(() => {
    if (!zoom) return undefined;
    const minSpan = zoom.minSpanMs;

    /**
     * Keeps a window of `span` inside the full domain.
     * @param start - Wanted window start
     * @param span - Window length
     * @returns Clamped window
     */
    const clampWindow = (start: number, span: number): XWindow => {
      "worklet";
      const [fullStart, fullEnd] = fullValue.value;
      const clampedStart = Math.min(Math.max(start, fullStart), fullEnd - span);
      return [clampedStart, clampedStart + span];
    };

    /**
     * Time under a canvas x coordinate for a window.
     * @param x - Canvas x (px)
     * @param window - Window the chart shows
     * @returns Unix ms
     */
    const timeAt = (x: number, window: XWindow): number => {
      "worklet";
      const { left, width } = plotValue.value;
      return window[0] + ((x - left) / width) * (window[1] - window[0]);
    };

    /**
     * Resizes a window to `span`, keeping `focalT` under the same finger.
     * @param base - Window before the gesture
     * @param focalT - Time under the fingers (Unix ms)
     * @param span - Wanted window length
     * @returns New window, within limits
     */
    const zoomTo = (base: XWindow, focalT: number, span: number): XWindow => {
      "worklet";
      const [fullStart, fullEnd] = fullValue.value;
      const clampedSpan = Math.min(Math.max(span, minSpan), fullEnd - fullStart);
      const ratio = (focalT - base[0]) / (base[1] - base[0]);
      return clampWindow(focalT - ratio * clampedSpan, clampedSpan);
    };

    const pinch = Gesture.Pinch()
      .onBegin((event) => {
        const base = viewValue.value;
        pinchBase.value = {
          start: base[0],
          end: base[1],
          focalT: timeAt(event.focalX, base),
        };
      })
      .onChange((event) => {
        const { start, end, focalT } = pinchBase.value;
        viewValue.value = zoomTo([start, end], focalT, (end - start) / event.scale);
      });

    const pan = Gesture.Pan()
      .activeOffsetX([-ZOOM_PAN_ACTIVE_OFFSET_X, ZOOM_PAN_ACTIVE_OFFSET_X])
      .failOffsetY([-ZOOM_PAN_FAIL_OFFSET_Y, ZOOM_PAN_FAIL_OFFSET_Y])
      .onChange((event) => {
        const [start, end] = viewValue.value;
        const span = end - start;
        const shift = (-event.changeX / plotValue.value.width) * span;
        viewValue.value = clampWindow(start + shift, span);
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event) => {
        const [fullStart, fullEnd] = fullValue.value;
        const current = viewValue.value;
        const showsAll = current[0] <= fullStart && current[1] >= fullEnd;
        viewValue.value = showsAll
          ? zoomTo(
              current,
              timeAt(event.x, current),
              (fullEnd - fullStart) / ZOOM_DOUBLE_TAP_FACTOR,
            )
          : [fullStart, fullEnd];
      });

    return Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));
  }, [zoom, fullValue, viewValue, plotValue, pinchBase]);

  /** X labels of the visible window (the caller's layout when the chart is fixed). */
  const { xTicks, formatVisibleXLabel } = useMemo(() => {
    if (!zoom) return { xTicks: xAxis.ticks, formatVisibleXLabel: formatXLabel };
    const axis = zoom.axisFor(view[0], view[1]);
    return { xTicks: axis.ticks, formatVisibleXLabel: axis.formatLabel };
  }, [zoom, xAxis.ticks, formatXLabel, view]);

  /**
   * Y-axis ticks: minimum, maximum and three evenly spaced values of the
   * visible points. Bars grow from zero, so a bar chart with negative values
   * keeps zero in range (bars hang from the zero line instead of the canvas
   * edge); otherwise the axis hugs the data.
   */
  const yTicks = useMemo(() => {
    const plotted = chartData.filter(
      (point): point is NormalizedChartDataPoint & { value: number } =>
        point.value !== null,
    );
    const visible = plotted.filter(
      (point) => point.timestamp >= view[0] && point.timestamp <= view[1],
    );
    const values = (visible.length > 0 ? visible : plotted).map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const anchorAtZero = type === CHART_TYPE_BAR && min < 0;
    return buildYAxisTicks(min, anchorAtZero ? Math.max(max, 0) : max);
  }, [chartData, view, type]);

  const formatYLabel = useMemo(() => createYLabelFormatter(yTicks), [yTicks]);

  /** Gap share of each bar slot; every slot holds one grid point. */
  const innerPadding = useMemo(
    () => calculateBarChartInnerPadding(chartData.length),
    [chartData.length],
  );

  /**
   * CartesianChart configuration object.
   * Contains domain, viewport, axis options, and styling configuration.
   * @returns Configuration object for CartesianChart component
   */
  const cartesianChartConfig = useMemo(
    () => ({
      domainPadding: DOMAIN_PADDING,
      domain: {
        x: xAxis.domain,
        ...(yTicks.length > 0 ? { y: [yTicks[0], yTicks[yTicks.length - 1]] } : {}),
      },
      ...(zoom ? { viewport: { x: view } } : {}),
      yAxis: [
        {
          font,
          tickValues: yTicks,
          tickCount: yTicks.length,
          formatYLabel,
          enableRescaling: false,
          labelPosition: "outset",
          linePathEffect: GRID_DASH,
        },
      ],
      xAxis: {
        font,
        tickValues: xTicks,
        tickCount: xTicks.length,
        formatXLabel: formatVisibleXLabel,
        labelPosition: "outset",
        labelOffset: 5,
        linePathEffect: GRID_DASH,
      },
    }),
    [xAxis.domain, zoom, view, yTicks, font, formatYLabel, xTicks, formatVisibleXLabel],
  );

  return (
    <View style={[globalStyles.genericChartContainer, height ? { height } : null]}>
      {/* @ts-ignore - Type inference issue with victory-native generics */}
      <CartesianChart
        data={chartData}
        xKey="timestamp"
        yKeys={["value"]}
        chartPressState={pressState}
        chartPressConfig={
          zoom ? { pan: { activateAfterLongPress: ZOOM_PRESS_DELAY_MS } } : undefined
        }
        customGestures={zoomGestures}
        onChartBoundsChange={handleBoundsChange}
        {...cartesianChartConfig}
        renderOutside={({ chartBounds }: { chartBounds: ChartBounds }) => (
          <>
            {isActive && (
              <>
                <ActiveValueIndicator
                  xPosition={pressState.x.position}
                  yPosition={pressState.y.value.position}
                  bottom={chartBounds.bottom}
                  top={chartBounds.top}
                  lineColor={tokens.colors.gray}
                  indicatorColor={indicatorColor}
                />
                <ChartValueDisplayToolTip
                  activeValue={pressState.y.value.value}
                  activeTimestamp={pressState.x.value}
                  xPosition={pressState.x.position}
                  yPosition={pressState.y.value.position}
                  chartLeft={chartBounds.left}
                  chartRight={chartBounds.right}
                  chartTop={chartBounds.top}
                  chartBottom={chartBounds.bottom}
                  unit={unit}
                />
              </>
            )}
          </>
        )}
      >
        {({
          points,
          chartBounds,
        }: CartesianChartRenderArg<NormalizedChartDataPoint, "value">) => (
          <>
            {type === CHART_TYPE_BAR ? (
              <Bar
                points={points.value}
                chartBounds={chartBounds}
                barCount={chartData.length}
                innerPadding={innerPadding}
                color={tokens.colors.primary}
              />
            ) : (
              <>
                <Line
                  points={points.value}
                  color={tokens.colors.primary}
                  strokeWidth={LINE_STROKE_WIDTH}
                  connectMissingData={false}
                />
                <Scatter
                  points={points.value}
                  color={tokens.colors.primary}
                  radius={POINT_RADIUS}
                  shape="circle"
                />
              </>
            )}
          </>
        )}
      </CartesianChart>
    </View>
  );
}
