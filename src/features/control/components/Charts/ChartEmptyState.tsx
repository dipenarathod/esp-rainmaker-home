/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text, View } from "react-native";

import { globalStyles } from "@shared/theme/globalStyleSheet";
import { testProps } from "@shared/utils/testProps";
import { QA_CHART_EMPTY_STATE } from "@shared/utils/constants";
import type { ChartEmptyStateProps } from "@src/types/global";

/**
 * Empty, unsupported and error states of the chart. Inside the chart area it
 * keeps the tabs and range controls reachable; full screen it replaces them
 * when the param has no time series at all.
 */
const ChartEmptyState = ({ icon, title, description, fullScreen = false }: ChartEmptyStateProps) => (
  <View
    {...testProps(QA_CHART_EMPTY_STATE)}
    style={[
      globalStyles.emptyStateContainer,
      fullScreen ? globalStyles.chartEmptyStateFullScreen : globalStyles.chartEmptyStateInline,
    ]}
  >
    <View style={globalStyles.emptyStateIconContainer}>{icon}</View>
    <Text style={globalStyles.emptyStateTitle}>{title}</Text>
    {description ? (
      <Text style={globalStyles.emptyStateDescription}>{description}</Text>
    ) : null}
  </View>
);

export default ChartEmptyState;
