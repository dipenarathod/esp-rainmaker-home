/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef, useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";

// Types
import type { TimeSeriesStat } from "@shared/timeSeries";
import type { AggregationTooltipProps } from "@src/types/global";

// Styles
import { globalStyles } from "@shared/theme/globalStyleSheet";

/**
 * Pop-over menu listing the statistics that can be plotted for the buckets
 * on screen. Rendered in a transparent modal so it floats above the chart
 * and closes on any tap outside; selecting an entry closes it too.
 */
const AggregationTooltip: React.FC<AggregationTooltipProps> = ({
  visible,
  anchor,
  options,
  onSelect,
  onClose,
  selected,
}) => {
  const { t } = useTranslation();
  const backdropRef = useRef<View>(null);
  const [backdropTop, setBackdropTop] = useState<number | null>(null);

  /**
   * The chip and the backdrop are both measured in window coordinates; the
   * backdrop's own offset reconciles the two frames (Android's modal window
   * may start above or below the status bar depending on edge-to-edge).
   */
  const handleBackdropLayout = useCallback(() => {
    backdropRef.current?.measureInWindow((_x, y) => setBackdropTop(y));
  }, []);

  if (!visible || !anchor) return null;

  /**
   * Renders one statistic entry.
   * @param stat - Statistic to render
   * @param index - Position in the list
   * @returns Menu item element
   */
  const renderOption = (stat: TimeSeriesStat, index: number) => {
    const isSelected = selected === stat;
    const isLast = index === options.length - 1;

    return (
      <TouchableOpacity
        key={`stat-${stat}`}
        onPress={() => onSelect(stat)}
        style={[
          globalStyles.aggregationTooltipMenuItem,
          isSelected && globalStyles.aggregationTooltipSelectedMenuItem,
          isLast && globalStyles.aggregationTooltipLastMenuItem,
        ]}
      >
        <Text
          style={[
            globalStyles.aggregationTooltipMenuText,
            isSelected && globalStyles.aggregationTooltipSelectedMenuItemText,
          ]}
        >
          {t(`device.chart.aggregation.${stat}`)}
        </Text>
      </TouchableOpacity>
    );
  };

  const menuPosition =
    backdropTop === null
      ? globalStyles.aggregationTooltipHidden
      : { top: anchor.top - backdropTop, right: anchor.right };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable
        ref={backdropRef}
        onLayout={handleBackdropLayout}
        style={globalStyles.aggregationTooltipBackdrop}
        onPress={onClose}
      >
        <View style={[globalStyles.aggregationTooltipContainer, menuPosition]}>
          <View style={globalStyles.aggregationTooltipArrow} />
          {options.map(renderOption)}
        </View>
      </Pressable>
    </Modal>
  );
};

export default AggregationTooltip;
