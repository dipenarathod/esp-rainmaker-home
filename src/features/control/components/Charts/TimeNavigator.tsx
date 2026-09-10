/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { tokens } from "@shared/theme/tokens";
import { globalStyles } from "@shared/theme/globalStyleSheet";
import { testProps } from "@shared/utils/testProps";
import {
  QA_CHART_RANGE_LABEL,
  QA_CHART_RANGE_NEXT,
  QA_CHART_RANGE_PREVIOUS,
} from "@shared/utils/constants";
import type { TimeNavigatorProps } from "@src/types/global";

/**
 * Shows the visible range and steps it one span backwards or forwards.
 * Tapping the range label opens the custom range picker. Forward stepping is
 * disabled once the range already reaches the present.
 */
const TimeNavigator = ({
  label,
  loading = false,
  onPrevious,
  onNext,
  onPressLabel,
  canNavigateNext,
}: TimeNavigatorProps) => {
  const isNextDisabled = !canNavigateNext || loading;

  return (
    <View style={globalStyles.timeNavigatorRow}>
      <TouchableOpacity
        {...testProps(QA_CHART_RANGE_PREVIOUS)}
        onPress={onPrevious}
        disabled={loading}
        style={[
          globalStyles.timeNavigatorButton,
          loading && globalStyles.timeNavigatorButtonDisabled,
        ]}
      >
        <ChevronLeft size={tokens.iconSize._20} color={tokens.colors.primary} />
      </TouchableOpacity>

      <TouchableOpacity
        {...testProps(QA_CHART_RANGE_LABEL)}
        style={globalStyles.timeNavigatorContent}
        onPress={onPressLabel}
        disabled={loading || !onPressLabel}
      >
        <Text style={globalStyles.timeNavigatorText} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        {...testProps(QA_CHART_RANGE_NEXT)}
        onPress={onNext}
        disabled={isNextDisabled}
        style={[
          globalStyles.timeNavigatorButton,
          isNextDisabled && globalStyles.timeNavigatorButtonDisabled,
        ]}
      >
        <ChevronRight size={tokens.iconSize._20} color={tokens.colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

export default TimeNavigator;
