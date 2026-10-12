/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import Skeleton, { type ISkeletonProps } from "react-native-reanimated-skeleton";


import { tokens } from "@shared/theme/tokens";
import { globalStyles } from "@shared/theme/globalStyleSheet";
import { SKELETON_ANIMATION_PULSE } from "@shared/utils/constants";

import {
  CHART_CANVAS_HEIGHT,
  CHART_SECTION_HORIZONTAL_INSET,
  CHART_SKELETON_BAR_COUNT,
  CHART_SKELETON_BAR_HEIGHTS,
  CHART_SKELETON_BAR_WIDTH,
  CHART_SKELETON_LABEL_HEIGHT,
  CHART_SKELETON_TOGGLE_BUTTON_GAP,
  CHART_SKELETON_TOGGLE_BUTTON_SIZE,
  CHART_SKELETON_TOGGLE_BUTTON_TOP,
  CHART_SKELETON_TOGGLE_LABEL_TOP,
  CHART_SKELETON_TOGGLE_LABEL_WIDTH,
  CHART_SKELETON_TOP_PADDING,
  CHART_SKELETON_X_AXIS_HEIGHT,
  CHART_SKELETON_X_LABEL_COUNT,
  CHART_SKELETON_X_LABEL_WIDTH,
  CHART_SKELETON_Y_AXIS_WIDTH,
  CHART_SKELETON_Y_LABEL_COUNT,
  CHART_SKELETON_Y_LABEL_WIDTH,
  CHART_TOGGLE_SLOT_HEIGHT,
} from "./constants";

/** One bone of a skeleton layout (the library exports it only through its props). */
type ICustomViewStyle = NonNullable<ISkeletonProps["layout"]>[number];

/**
 * Chart skeletons, one per layout slot, using the same bone library, colours
 * and pulse as the home device cards. Each fills its slot exactly, so the
 * loading, ready and empty states share one layout.
 */

interface BonesProps {
  /** Bone layout in absolute coordinates inside the slot */
  layout: ICustomViewStyle[];
  /** Slot height */
  height: number;
  /** Slot width (defaults to full width) */
  width?: number;
}

/**
 * Renders one pulsing bone group filling a slot.
 * @param props - Layout and slot size
 * @returns Skeleton element
 */
const Bones = ({ layout, height, width }: BonesProps) => (
  <Skeleton
    isLoading
    animationType={SKELETON_ANIMATION_PULSE}
    boneColor={tokens.colors.bg1}
    highlightColor={tokens.colors.bg}
    containerStyle={[globalStyles.chartSkeletonBox, { height, ...(width ? { width } : {}) }]}
    layout={layout}
  />
);

/**
 * Bones standing in for the chart canvas: Y-axis labels on the left, thin
 * bars spread across the plot, X-axis labels along the bottom.
 */
export const ChartCanvasSkeleton = () => {
  const { width: windowWidth } = useWindowDimensions();

  const layout = useMemo<ICustomViewStyle[]>(() => {
    const canvasWidth = windowWidth - CHART_SECTION_HORIZONTAL_INSET;
    const plotWidth = canvasWidth - CHART_SKELETON_Y_AXIS_WIDTH;
    const plotHeight =
      CHART_CANVAS_HEIGHT - CHART_SKELETON_X_AXIS_HEIGHT - CHART_SKELETON_TOP_PADDING;
    const barGap =
      (plotWidth - CHART_SKELETON_BAR_COUNT * CHART_SKELETON_BAR_WIDTH) /
      (CHART_SKELETON_BAR_COUNT - 1);

    const bars: ICustomViewStyle[] = CHART_SKELETON_BAR_HEIGHTS.slice(
      0,
      CHART_SKELETON_BAR_COUNT,
    ).map((ratio, index) => ({
      key: `chart_bar_${index}`,
      width: CHART_SKELETON_BAR_WIDTH,
      height: Math.round(plotHeight * ratio),
      borderRadius: CHART_SKELETON_BAR_WIDTH / 2,
      position: "absolute",
      left:
        CHART_SKELETON_Y_AXIS_WIDTH +
        Math.round(index * (CHART_SKELETON_BAR_WIDTH + barGap)),
      bottom: CHART_SKELETON_X_AXIS_HEIGHT,
    }));

    const yLabels: ICustomViewStyle[] = Array.from(
      { length: CHART_SKELETON_Y_LABEL_COUNT },
      (_, index) => ({
        key: `chart_y_label_${index}`,
        width: CHART_SKELETON_Y_LABEL_WIDTH,
        height: CHART_SKELETON_LABEL_HEIGHT,
        borderRadius: CHART_SKELETON_LABEL_HEIGHT / 2,
        position: "absolute",
        left: 0,
        top:
          CHART_SKELETON_TOP_PADDING +
          Math.round((index * plotHeight) / (CHART_SKELETON_Y_LABEL_COUNT - 1)) -
          CHART_SKELETON_LABEL_HEIGHT / 2,
      }),
    );

    const xLabelWidth = CHART_SKELETON_X_LABEL_WIDTH;
    const xLabels: ICustomViewStyle[] = Array.from(
      { length: CHART_SKELETON_X_LABEL_COUNT },
      (_, index) => ({
        key: `chart_x_label_${index}`,
        width: xLabelWidth,
        height: CHART_SKELETON_LABEL_HEIGHT,
        borderRadius: CHART_SKELETON_LABEL_HEIGHT / 2,
        position: "absolute",
        left:
          CHART_SKELETON_Y_AXIS_WIDTH +
          Math.round(
            (index * (plotWidth - xLabelWidth)) / (CHART_SKELETON_X_LABEL_COUNT - 1),
          ),
        bottom: 4,
      }),
    );

    return [...bars, ...yLabels, ...xLabels];
  }, [windowWidth]);

  return <Bones height={CHART_CANVAS_HEIGHT} layout={layout} />;
};

/**
 * Bones standing in for the chart type toggle (label plus two buttons).
 */
export const ChartToggleSkeleton = () => (
  <Bones
    height={CHART_TOGGLE_SLOT_HEIGHT}
    layout={[
      {
        key: "chart_toggle_label",
        width: CHART_SKELETON_TOGGLE_LABEL_WIDTH,
        height: CHART_SKELETON_LABEL_HEIGHT,
        borderRadius: CHART_SKELETON_LABEL_HEIGHT / 2,
        position: "absolute",
        left: tokens.spacing._15,
        top: CHART_SKELETON_TOGGLE_LABEL_TOP,
      },
      {
        key: "chart_toggle_bar",
        width: CHART_SKELETON_TOGGLE_BUTTON_SIZE,
        height: CHART_SKELETON_TOGGLE_BUTTON_SIZE,
        borderRadius: tokens.radius.sm,
        position: "absolute",
        left: tokens.spacing._15,
        top: CHART_SKELETON_TOGGLE_BUTTON_TOP,
      },
      {
        key: "chart_toggle_line",
        width: CHART_SKELETON_TOGGLE_BUTTON_SIZE,
        height: CHART_SKELETON_TOGGLE_BUTTON_SIZE,
        borderRadius: tokens.radius.sm,
        position: "absolute",
        left:
          tokens.spacing._15 +
          CHART_SKELETON_TOGGLE_BUTTON_SIZE +
          CHART_SKELETON_TOGGLE_BUTTON_GAP,
        top: CHART_SKELETON_TOGGLE_BUTTON_TOP,
      },
    ]}
  />
);
