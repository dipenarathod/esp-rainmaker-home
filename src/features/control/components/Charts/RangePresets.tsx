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
import { QA_CHART_PRESET_PREFIX } from "@shared/utils/constants";

// Types
import type { RangePreset, RangePresetsProps } from "@src/types/global";

/**
 * Chips of quick ranges for the active tab (e.g. 1H / 6H / 24H under the raw
 * tab). A chip stays highlighted only while the visible range still matches
 * it; stepping or picking a custom range clears the highlight. The chips fill
 * the leading side of the preset row; the screen places the statistic
 * dropdown after them.
 */
const RangePresets = ({
  presets,
  selectedKey,
  loading,
  onSelect,
}: RangePresetsProps) => {
  const { t } = useTranslation();

  /**
   * Renders one preset chip.
   * @param preset - Preset to render
   * @returns Chip element
   */
  const renderChip = (preset: RangePreset) => {
    const isActive = selectedKey === preset.key;
    return (
      <TouchableOpacity
        key={preset.key}
        {...testProps(`${QA_CHART_PRESET_PREFIX}${preset.key}`)}
        disabled={loading}
        style={[
          globalStyles.rangePresetChip,
          isActive && globalStyles.rangePresetChipActive,
          loading && globalStyles.periodTabDisabled,
        ]}
        onPress={() => onSelect(preset)}
      >
        <Text
          style={[
            globalStyles.rangePresetChipText,
            isActive && globalStyles.rangePresetChipTextActive,
          ]}
        >
          {t(`device.chart.preset.${preset.key}`)}
        </Text>
      </TouchableOpacity>
    );
  };

  return <View style={globalStyles.rangePresetChips}>{presets.map(renderChip)}</View>;
};

export default RangePresets;
