/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Active value indicator constants
export const ACTIVE_VALUE_INDICATOR_OUTER_RADIUS = 8;
export const ACTIVE_VALUE_INDICATOR_OUTER_COLOR = "hsla(0, 0, 100%, 0.25)";

// Tooltip constants
export const TOOLTIP_FONT_SIZE = 14;
export const TOOLTIP_DATE_FONT_SIZE = 12;
export const TOOLTIP_PADDING = 8;
export const TOOLTIP_BOX_RADIUS = 6;
export const TOOLTIP_BOX_SPACING = 4;
export const TOOLTIP_VERTICAL_OFFSET = 10; // Offset above the point
export const TOOLTIP_EDGE_MARGIN = 2; // Margin from chart edges

// Zoom gestures (raw chart)
/** Horizontal travel before a one-finger drag pans the zoomed window. */
export const ZOOM_PAN_ACTIVE_OFFSET_X = 12;
/** Vertical travel that hands a one-finger drag back to the page scroll. */
export const ZOOM_PAN_FAIL_OFFSET_Y = 10;
/** Hold before a press shows the tooltip on a zoomable chart, so a drag can pan first. */
export const ZOOM_PRESS_DELAY_MS = 250;
/** How much a double-tap zooms in around the tapped time. */
export const ZOOM_DOUBLE_TAP_FACTOR = 4;

// Statistic menu
/** Gap between the dropdown chip and the menu below it. */
export const AGGREGATION_MENU_GAP = 6;


// Chart layout slots (fixed heights so loading, ready and empty states never shift the layout)
/** Height of the chart canvas (and of its skeleton / empty state). */
export const CHART_CANVAS_HEIGHT = 300;
/** Height of the chart type toggle row (label + 42px buttons). */
export const CHART_TOGGLE_SLOT_HEIGHT = 70;
/** Horizontal space the chart section takes off the window (margins + padding). */
export const CHART_SECTION_HORIZONTAL_INSET = 40;

// Skeleton bones
export const CHART_SKELETON_BAR_COUNT = 14;
export const CHART_SKELETON_BAR_WIDTH = 8;
export const CHART_SKELETON_Y_LABEL_COUNT = 5;
export const CHART_SKELETON_X_LABEL_COUNT = 4;
export const CHART_SKELETON_Y_AXIS_WIDTH = 34;
export const CHART_SKELETON_X_AXIS_HEIGHT = 24;
export const CHART_SKELETON_TOP_PADDING = 10;
/** Relative bar heights, left to right. */
export const CHART_SKELETON_BAR_HEIGHTS = [
  0.45, 0.7, 0.55, 0.85, 0.6, 0.35, 0.75, 0.5, 0.9, 0.4, 0.65, 0.8, 0.3, 0.6,
];
export const CHART_SKELETON_LABEL_HEIGHT = 10;
export const CHART_SKELETON_Y_LABEL_WIDTH = 22;
export const CHART_SKELETON_X_LABEL_WIDTH = 40;
export const CHART_SKELETON_TOGGLE_LABEL_WIDTH = 44;
export const CHART_SKELETON_TOGGLE_BUTTON_SIZE = 42;
export const CHART_SKELETON_TOGGLE_BUTTON_GAP = 8;
export const CHART_SKELETON_TOGGLE_LABEL_TOP = 4;
export const CHART_SKELETON_TOGGLE_BUTTON_TOP = 26;
