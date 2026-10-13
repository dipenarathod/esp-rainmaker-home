/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { useTranslation } from "react-i18next";

// Styles
import { tokens } from "@shared/theme/tokens";
import { globalStyles } from "@shared/theme/globalStyleSheet";

// Utils
import {
  MS,
  WEEK_START_DAY,
  addUnits,
  alignToUnitStart,
  formatLocalDate,
} from "@shared/timeSeries";
import { TS_RANGE_UNIT_DAY, TS_CALENDAR_LOOKBACK_YEARS } from "@shared/utils/constants";

// Types
import type {
  DateRangeCalendarBottomSheetProps,
  DateRangeCalendarBottomSheetRef,
} from "@src/types/global";

/** Calendar day key (`YYYY-MM-DD`) → local midnight. */
const dayToMs = (day: string): number => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).getTime();
};

/**
 * Bottom sheet calendar picking a custom range as two calendar days. The
 * active tab decides how far the range may reach (`maxEndFor`): days beyond
 * that limit, and days in the future, are disabled once a start is chosen.
 * Alignment to weeks or months happens in the caller.
 */
const DateRangeCalendarBottomSheet = forwardRef<
  DateRangeCalendarBottomSheetRef,
  DateRangeCalendarBottomSheetProps
>(({ visible, onClose, onSelect, range, maxEndFor, weekStart = WEEK_START_DAY }, ref) => {
  const { t } = useTranslation();

  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<string>(
    formatLocalDate(Date.now()),
  );

  /** Pre-selects the visible range whenever the sheet opens. */
  useEffect(() => {
    if (!visible) return;
    if (range) {
      const start = formatLocalDate(range.start);
      setSelectedStart(start);
      setSelectedEnd(formatLocalDate(range.end - 1));
      setCurrentMonth(start);
    } else {
      setSelectedStart(null);
      setSelectedEnd(null);
    }
  }, [visible, range]);

  const today = alignToUnitStart(Date.now(), TS_RANGE_UNIT_DAY);
  const calendarMinDate = useMemo(
    () => formatLocalDate(today - TS_CALENDAR_LOOKBACK_YEARS * 365 * MS.DAY),
    [today],
  );
  const calendarMaxDate = formatLocalDate(today);

  /** Marks the selected span. */
  const markedDates = useMemo(() => {
    const marked: Record<string, object> = {};
    if (!selectedStart) return marked;
    marked[selectedStart] = {
      startingDay: true,
      endingDay: !selectedEnd,
      color: tokens.colors.primary,
      textColor: tokens.colors.white,
    };
    if (!selectedEnd) return marked;
    let cursor = addUnits(dayToMs(selectedStart), TS_RANGE_UNIT_DAY, 1);
    const end = dayToMs(selectedEnd);
    while (cursor < end) {
      marked[formatLocalDate(cursor)] = {
        color: tokens.colors.bg4,
        textColor: tokens.colors.text_primary,
      };
      cursor = addUnits(cursor, TS_RANGE_UNIT_DAY, 1);
    }
    marked[selectedEnd] = {
      endingDay: true,
      color: tokens.colors.primary,
      textColor: tokens.colors.white,
    };
    return marked;
  }, [selectedStart, selectedEnd]);

  /** Disables days the active tab cannot reach from the chosen start. */
  const disabledDates = useMemo(() => {
    const disabled: Record<string, object> = {};
    if (!selectedStart || selectedEnd) return disabled;
    const limit = maxEndFor(dayToMs(selectedStart));
    let cursor = limit;
    while (cursor <= today) {
      disabled[formatLocalDate(cursor)] = {
        disabled: true,
        disableTouchEvent: true,
      };
      cursor = addUnits(cursor, TS_RANGE_UNIT_DAY, 1);
    }
    return disabled;
  }, [selectedStart, selectedEnd, maxEndFor, today]);

  const rangeText = useMemo(() => {
    if (!selectedStart) return null;
    const format = (day: string) =>
      new Date(dayToMs(day)).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    return selectedEnd
      ? `${format(selectedStart)} - ${format(selectedEnd)}`
      : format(selectedStart);
  }, [selectedStart, selectedEnd]);

  /**
   * First tap picks the start, second tap the end; a tap before the start or
   * beyond the reachable limit restarts the selection at that day.
   */
  const handleDayPress = useCallback(
    (day: { dateString: string }) => {
      const dayMs = dayToMs(day.dateString);
      if (!selectedStart || selectedEnd) {
        setSelectedStart(day.dateString);
        setSelectedEnd(null);
        return;
      }
      const startMs = dayToMs(selectedStart);
      if (dayMs < startMs || dayMs >= maxEndFor(startMs)) {
        setSelectedStart(day.dateString);
        setSelectedEnd(null);
        return;
      }
      setSelectedEnd(day.dateString);
    },
    [selectedStart, selectedEnd, maxEndFor],
  );

  const handleConfirm = useCallback(() => {
    if (!selectedStart) return;
    onSelect(dayToMs(selectedStart), dayToMs(selectedEnd ?? selectedStart));
    onClose();
  }, [selectedStart, selectedEnd, onSelect, onClose]);

  const handleClearSelection = useCallback(() => {
    setSelectedStart(null);
    setSelectedEnd(null);
  }, []);

  const handleClose = useCallback(() => {
    handleClearSelection();
    onClose();
  }, [handleClearSelection, onClose]);

  useImperativeHandle(ref, () => ({ clearSelection: handleClearSelection }), [
    handleClearSelection,
  ]);

  const nothingSelected = !selectedStart;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={globalStyles.dateRangeCalendarBackdrop} onPress={onClose}>
        <Pressable
          style={globalStyles.dateRangeCalendarContent}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={globalStyles.dateRangeCalendarHandle} />

          <View style={[globalStyles.flex, globalStyles.dateRangeCalendarHeader]}>
            <Text style={globalStyles.dateRangeCalendarTitle}>
              {t("device.chart.selectDateRange")}
            </Text>
          </View>

          {rangeText && (
            <View style={globalStyles.dateRangeCalendarRangeDisplay}>
              <Text style={globalStyles.dateRangeCalendarRangeText}>{rangeText}</Text>
            </View>
          )}

          <ScrollView
            style={globalStyles.dateRangeCalendarContainer}
            showsVerticalScrollIndicator={false}
          >
            <Calendar
              current={currentMonth}
              minDate={calendarMinDate}
              maxDate={calendarMaxDate}
              onDayPress={handleDayPress}
              markedDates={{ ...markedDates, ...disabledDates }}
              markingType="period"
              onMonthChange={(month: { dateString: string }) =>
                setCurrentMonth(month.dateString)
              }
              enableSwipeMonths
              hideExtraDays
              firstDay={weekStart}
              disableAllTouchEventsForDisabledDays
              theme={{
                backgroundColor: tokens.colors.white,
                calendarBackground: tokens.colors.white,
                textSectionTitleColor: tokens.colors.text_secondary,
                selectedDayBackgroundColor: tokens.colors.primary,
                selectedDayTextColor: tokens.colors.white,
                todayTextColor: tokens.colors.primary,
                dayTextColor: tokens.colors.text_primary,
                textDisabledColor: tokens.colors.text_secondary,
                dotColor: tokens.colors.primary,
                selectedDotColor: tokens.colors.white,
                arrowColor: tokens.colors.primary,
                monthTextColor: tokens.colors.text_primary,
                indicatorColor: tokens.colors.primary,
                textDayFontFamily: tokens.fonts.regular,
                textMonthFontFamily: tokens.fonts.medium,
                textDayHeaderFontFamily: tokens.fonts.regular,
                textDayFontSize: tokens.fontSize.sm,
                textMonthFontSize: tokens.fontSize.md,
                textDayHeaderFontSize: tokens.fontSize.xs,
              }}
            />
          </ScrollView>

          <View style={[globalStyles.flex, globalStyles.dateRangeCalendarActions]}>
            <TouchableOpacity
              style={[
                globalStyles.dateRangeCalendarButton,
                globalStyles.dateRangeCalendarClearButton,
                nothingSelected && globalStyles.dateRangeCalendarButtonDisabled,
              ]}
              onPress={handleClearSelection}
              disabled={nothingSelected}
            >
              <Text
                style={[
                  globalStyles.dateRangeCalendarClearButtonText,
                  nothingSelected && globalStyles.dateRangeCalendarButtonTextDisabled,
                ]}
              >
                {t("common.clear")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                globalStyles.dateRangeCalendarButton,
                globalStyles.dateRangeCalendarConfirmButton,
                nothingSelected && globalStyles.dateRangeCalendarButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={nothingSelected}
            >
              <Text
                style={[
                  globalStyles.dateRangeCalendarConfirmButtonText,
                  nothingSelected && globalStyles.dateRangeCalendarButtonTextDisabled,
                ]}
              >
                {t("common.confirm")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                globalStyles.dateRangeCalendarButton,
                globalStyles.dateRangeCalendarCloseButtonAction,
              ]}
              onPress={handleClose}
            >
              <Text style={globalStyles.dateRangeCalendarCloseButtonText}>
                {t("common.close")}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={globalStyles.dateRangeCalendarBottomSafeArea} />
        </Pressable>
      </Pressable>
    </Modal>
  );
});

DateRangeCalendarBottomSheet.displayName = "DateRangeCalendarBottomSheet";

export default DateRangeCalendarBottomSheet;
