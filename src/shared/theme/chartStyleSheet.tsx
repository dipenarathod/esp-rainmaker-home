/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { StyleSheet } from "react-native";
import { tokens } from "./tokens";

export const chartStyles = StyleSheet.create({
  // Chart Styles
  chartSection: {
    margin: tokens.spacing._10,
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing._10,
    paddingTop: tokens.spacing._5,
    paddingBottom: tokens.spacing._15,
    shadowColor: tokens.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    position: "relative"
  },
  periodTabs: {
    flexDirection: "row",
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.sm,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: tokens.colors.borderColor,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.sm - 2,
  },
  chartTypeSection: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: tokens.colors.borderColor,
  },
  iconButtonActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  // Selected Point Display Styles
  selectedPointContainer: {
    margin: tokens.spacing._10,
    marginBottom: 0,
    padding: tokens.spacing._15,
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
  },
  selectedPointContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedPointLabel: {
    fontSize: tokens.fontSize.lg,
    fontFamily: tokens.fonts.medium,
    color: tokens.colors.text_primary,
  },
  selectedPointModal: {
    backgroundColor: tokens.colors.white,
    borderTopLeftRadius: tokens.radius.md,
    borderTopRightRadius: tokens.radius.md,
    minHeight: "40%",
    maxHeight: "80%",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: tokens.colors.black,
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedPointModalContent: {
    flex: 1,
    padding: tokens.spacing._20,
    paddingBottom: 0,
  },
  selectedPointModalBody: {
    flex: 1,
  },
  selectedPointModalButtonContainer: {
    flexDirection: "row",
    display: "flex",
    gap: tokens.spacing._10,
    paddingTop: tokens.spacing._20,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.bg2,
  },

  // Header Spacer
  headerSpacer: {
    width: 24,
  },

  // Section Label with Secondary Color
  sectionLabelSecondary: {
    fontSize: tokens.fontSize.xs,
    fontFamily: tokens.fonts.regular,
    marginBottom: tokens.spacing._10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: tokens.colors.text_secondary,
  },

  // Period Tab Active State
  periodTabActive: {
    backgroundColor: tokens.colors.primary,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  // Period Tab Disabled State
  periodTabDisabled: {
    opacity: 0.5,
  },

  // Period Tab Text Active
  periodTabTextActive: {
    fontSize: tokens.fontSize.sm,
    fontFamily: tokens.fonts.medium,
    fontWeight: "600",
    color: tokens.colors.white,
  },

  // Period Tab Text Inactive
  periodTabTextInactive: {
    fontSize: tokens.fontSize.sm,
    fontFamily: tokens.fonts.medium,
    fontWeight: "600",
    color: tokens.colors.text_secondary,
  },

  // Chart Type Section Container
  chartTypeSectionContainer: {
    marginLeft: tokens.spacing._15,
  },

  // Icon Button Disabled State
  iconButtonDisabled: {
    opacity: 0.5,
  },

  // Time Navigator Styles
  timeNavigatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.spacing._10,
    backgroundColor: tokens.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderColor,
    margin: tokens.spacing._10,
    borderRadius: tokens.radius.md,
    marginBottom: 0,
    paddingHorizontal: 16
  },
  timeNavigatorButton: {
    borderRadius: tokens.radius.md,
    minWidth: 30,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8
  },
  timeNavigatorButtonDisabled: {
    opacity: 0.5,
  },
  timeNavigatorContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing._20,
    maxWidth: "100%"
  },
  timeNavigatorText: {
    fontSize: tokens.fontSize.sm,
    fontFamily: tokens.fonts.medium,
    color: tokens.colors.primary,
    textAlign: "center",
    maxWidth: "100%",
  },

  // GenericChart Styles
  genericChartContainer: {
    height: 300,
    width: "100%",
  },

  // ============================================================================
  // Date Range Calendar Bottom Sheet Styles
  // ============================================================================
  dateRangeCalendarBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  dateRangeCalendarContent: {
    backgroundColor: tokens.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: "80%",
    width: "100%",
  },
  dateRangeCalendarHandle: {
    width: 40,
    height: 4,
    backgroundColor: tokens.colors.bg2,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  dateRangeCalendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  dateRangeCalendarTitle: {
    fontSize: tokens.fontSize.md,
    fontFamily: tokens.fonts.medium,
    color: tokens.colors.text_primary,
    flex: 1,
  },
  dateRangeCalendarRangeDisplay: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0,
  },
  dateRangeCalendarRangeText: {
    fontSize: tokens.fontSize.sm,
    fontFamily: tokens.fonts.regular,
    color: tokens.colors.text_primary,
  },
  dateRangeCalendarContainer: {
    paddingHorizontal: 0,
    height: 400,
  },
  dateRangeCalendarActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
    gap: 8,
    justifyContent: "space-between",
  },
  dateRangeCalendarButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dateRangeCalendarClearButton: {
    backgroundColor: tokens.colors.bg1,
    borderWidth: 1,
    borderColor: tokens.colors.borderColor,
  },
  dateRangeCalendarClearButtonText: {
    fontSize: tokens.fontSize.xs,
    fontFamily: tokens.fonts.medium,
    color: tokens.colors.text_primary,
  },
  dateRangeCalendarConfirmButton: {
    backgroundColor: tokens.colors.primary,
    borderWidth: 1,
    borderColor: tokens.colors.primary,
  },
  dateRangeCalendarConfirmButtonText: {
    fontSize: tokens.fontSize.xs,
    fontFamily: tokens.fonts.medium,
    color: tokens.colors.white,
  },
  dateRangeCalendarCloseButtonAction: {
    backgroundColor: tokens.colors.bg2,
    borderWidth: 1,
    borderColor: tokens.colors.borderColor,
  },
  dateRangeCalendarCloseButtonText: {
    fontSize: tokens.fontSize.xs,
    fontFamily: tokens.fonts.medium,
    color: tokens.colors.text_primary,
  },
  dateRangeCalendarButtonDisabled: {
    opacity: 0.5,
  },
  dateRangeCalendarButtonTextDisabled: {
    opacity: 0.5,
  },
  dateRangeCalendarBottomSafeArea: {
    height: 34, // Safe area for devices with home indicator
  },

  // ============================================================================
  // Aggregation Tooltip Styles (statistic menu in a transparent modal)
  // ============================================================================
  aggregationTooltipBackdrop: {
    flex: 1,
  },
  aggregationTooltipContainer: {
    position: "absolute",
    width: 160,
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing._5,
    paddingVertical: tokens.spacing._5,
    borderWidth: 1,
    borderColor: tokens.colors.borderColor,
    shadowColor: tokens.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  aggregationTooltipHidden: {
    opacity: 0,
  },
  aggregationTooltipArrow: {
    position: "absolute",
    top: -7,
    right: 16,
    width: 12,
    height: 12,
    backgroundColor: tokens.colors.white,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: tokens.colors.borderColor,
    transform: [{ rotate: "-45deg" }],
  },
  aggregationTooltipMenuItem: {
    minHeight: 44,
    paddingVertical: tokens.spacing._10,
    paddingHorizontal: tokens.spacing._10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: tokens.colors.borderColor,
  },
  aggregationTooltipLastMenuItem: {
    borderBottomWidth: 0,
  },
  aggregationTooltipSelectedMenuItem: {
    backgroundColor: tokens.colors.bg1,
    borderWidth: 1,
    borderColor: tokens.colors.lightBlue,
    borderRadius: tokens.radius.sm - 2,
  },
  aggregationTooltipSelectedMenuItemText: {
    color: tokens.colors.primary,
    fontWeight: "bold",
  },
  aggregationTooltipMenuText: {
    fontSize: tokens.fontSize.sm,
    color: tokens.colors.text_primary,
    fontFamily: tokens.fonts.regular,
  },
  windowTabsContainer: {
    marginHorizontal: tokens.spacing._10,
    marginTop: tokens.spacing._10,
  },
  timeNavigatorRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  rangePresetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginHorizontal: tokens.spacing._10,
    marginTop: tokens.spacing._10,
  },
  rangePresetChips: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  statDropdownChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderColor,
    backgroundColor: tokens.colors.white,
  },
  rangePresetChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderColor,
    backgroundColor: tokens.colors.white,
  },
  rangePresetChipActive: {
    backgroundColor: tokens.colors.bg4,
    borderColor: tokens.colors.primary,
  },
  rangePresetChipText: {
    fontSize: tokens.fontSize.xs,
    fontFamily: tokens.fonts.medium,
    color: tokens.colors.text_secondary,
  },
  rangePresetChipTextActive: {
    color: tokens.colors.primary,
  },
  chartCanvasSlot: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: tokens.spacing._10,
  },
  chartToggleSlot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  chartSkeletonBox: {
    position: "relative",
    width: "100%",
  },
  chartFootnoteText: {
    fontSize: tokens.fontSize.xxs,
    fontFamily: tokens.fonts.regular,
    color: tokens.colors.text_secondary,
    marginBottom: tokens.spacing._5,
  },
  chartTipsContainer: {
    marginHorizontal: tokens.spacing._10,
    marginBottom: tokens.spacing._20,
    gap: tokens.spacing._10,
  },
  chartTipText: {
    fontSize: tokens.fontSize.sm,
    fontFamily: tokens.fonts.regular,
    color: tokens.colors.text_secondary,
    lineHeight: 20,
  },
  chartTipLabel: {
    fontFamily: tokens.fonts.medium,
    color: tokens.colors.text_primary,
  },
  chartEmptyStateInline: {
    width: "100%",
    height: "100%",
    borderRadius: tokens.radius.md,
  },
  chartEmptyStateFullScreen: {
    flexGrow: 1,
    justifyContent: "center",
  },
});
