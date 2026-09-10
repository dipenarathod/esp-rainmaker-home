/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef, useState } from "react";
import { Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";

// Components
import AggregationTooltip from "./AggregationTooltip";

// Constants
import { AGGREGATION_MENU_GAP } from "./constants";

// Styles
import { tokens } from "@shared/theme/tokens";
import { globalStyles } from "@shared/theme/globalStyleSheet";
import { testProps } from "@shared/utils/testProps";
import { QA_CHART_STAT_DROPDOWN } from "@shared/utils/constants";

// Types
import type { TimeSeriesStat } from "@shared/timeSeries";
import type {
  AggregationDropdownProps,
  AggregationMenuAnchor,
} from "@src/types/global";

/**
 * Chip in the preset row showing the plotted statistic; tapping it opens the
 * statistic menu right below the chip. On pre-compute backends the choice is
 * a client-side projection and costs no request.
 */
const AggregationDropdown: React.FC<AggregationDropdownProps> = ({
  stat,
  options,
  loading,
  onSelect,
}) => {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const chipRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<AggregationMenuAnchor | null>(null);

  /** Measures the chip in window coordinates so the menu hangs off its trailing edge. */
  const open = useCallback(() => {
    chipRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({
        top: y + height + AGGREGATION_MENU_GAP,
        right: windowWidth - (x + width),
      });
    });
  }, [windowWidth]);

  const close = useCallback(() => setAnchor(null), []);

  const handleSelect = useCallback(
    (next: TimeSeriesStat) => {
      onSelect(next);
      setAnchor(null);
    },
    [onSelect],
  );

  return (
    <>
      <View ref={chipRef} collapsable={false}>
        <TouchableOpacity
          {...testProps(QA_CHART_STAT_DROPDOWN)}
          onPress={open}
          disabled={loading}
          style={[
            globalStyles.statDropdownChip,
            loading && globalStyles.periodTabDisabled,
          ]}
        >
          <Text style={globalStyles.rangePresetChipText}>
            {t(`device.chart.aggregation.${stat}`)}
          </Text>
          <ChevronDown size={tokens.iconSize._15} color={tokens.colors.text_secondary} />
        </TouchableOpacity>
      </View>

      <AggregationTooltip
        visible={anchor !== null}
        anchor={anchor}
        selected={stat}
        options={options}
        onSelect={handleSelect}
        onClose={close}
      />
    </>
  );
};

export default AggregationDropdown;
