/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { globalStyles } from "@shared/theme/globalStyleSheet";

interface ChartTipsProps {
  /** Mention pinch and double-tap zoom (raw tab) */
  showZoomTip?: boolean;
}

/**
 * Usage tip shown under the chart.
 */
const ChartTips = ({ showZoomTip = false }: ChartTipsProps) => {
  const { t } = useTranslation();

  return (
    <View style={globalStyles.chartTipsContainer}>
      <Text style={globalStyles.chartTipText}>
        <Text style={globalStyles.chartTipLabel}>{t("device.chart.tips.tipLabel")} </Text>
        {t("device.chart.tips.tip")}
        {showZoomTip ? ` ${t("device.chart.tips.zoomTip")}` : ""}
      </Text>
    </View>
  );
};

export default ChartTips;
