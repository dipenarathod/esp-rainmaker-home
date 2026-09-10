/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";

// Styles
import { globalStyles } from "@shared/theme/globalStyleSheet";
import { testProps } from "@shared/utils/testProps";
import { QA_CHART_WINDOW_TAB_PREFIX } from "@shared/utils/constants";

// Types
import type { ChartMode, WindowTabsProps } from "@src/types/global";

/**
 * Tab row selecting the aggregation window (hourly / daily / weekly /
 * monthly) or raw samples. Only the tabs the backend can serve are shown.
 */
const WindowTabs = ({ modes, selected, loading, onSelect }: WindowTabsProps) => {
  const { t } = useTranslation();

  /**
   * Renders one tab.
   * @param mode - Tab to render
   * @returns Tab element
   */
  const renderTab = (mode: ChartMode) => {
    const isActive = selected === mode;
    return (
      <TouchableOpacity
        key={mode}
        {...testProps(`${QA_CHART_WINDOW_TAB_PREFIX}${mode}`)}
        disabled={loading}
        style={[
          globalStyles.periodTab,
          isActive && globalStyles.periodTabActive,
          loading && globalStyles.periodTabDisabled,
        ]}
        onPress={() => onSelect(mode)}
      >
        <Text
          style={
            isActive
              ? globalStyles.periodTabTextActive
              : globalStyles.periodTabTextInactive
          }
        >
          {t(`device.chart.window.${mode}`)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={globalStyles.windowTabsContainer}>
      <View style={globalStyles.periodTabs}>{modes.map(renderTab)}</View>
    </View>
  );
};

export default WindowTabs;
